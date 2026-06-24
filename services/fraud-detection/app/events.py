# fraud-detection — event bus (RabbitMQ) según shared/events/events.md.
#
# Consume: loan.application.submitted  (producer: loan-application)
# Publica: fraud.check.passed / fraud.check.failed
#
# Si AMQP_URL está configurado se usa RabbitMQ real (aio-pika). Si no, se usa un
# MockEventBus en memoria: registra lo publicado y permite inyectar eventos
# entrantes para probar el flujo sin la infra (mock de lo que aún no existe).
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Awaitable, Callable

from .config import settings
from .models import EventEnvelope, EventMetadata

log = logging.getLogger("fraud.events")

Handler = Callable[[EventEnvelope], Awaitable[None]]


def build_envelope(
    event_type: str,
    aggregate_id: str,
    payload: dict,
    correlation_id: str | None = None,
    causation_id: str | None = None,
) -> EventEnvelope:
    return EventEnvelope(
        eventId=str(uuid.uuid4()),
        eventType=event_type,
        aggregateId=aggregate_id,
        aggregateType="CreditApplication",
        version=1,
        occurredAt=datetime.now(timezone.utc).isoformat(),
        producer=settings.service_name,
        payload=payload,
        metadata=EventMetadata(correlationId=correlation_id, causationId=causation_id),
    )


class EventBus:
    async def connect(self) -> None: ...
    async def publish(self, routing_key: str, envelope: EventEnvelope) -> None: ...
    def on(self, routing_key: str, handler: Handler) -> None: ...
    async def start_consuming(self) -> None: ...
    async def close(self) -> None: ...


class MockEventBus(EventBus):
    """Bus en memoria para correr sin RabbitMQ."""

    def __init__(self) -> None:
        self.published: list[tuple[str, EventEnvelope]] = []
        self._handlers: dict[str, Handler] = {}

    async def connect(self) -> None:
        log.warning("EventBus en modo MOCK (sin RabbitMQ). AMQP_URL no configurado.")

    async def publish(self, routing_key: str, envelope: EventEnvelope) -> None:
        self.published.append((routing_key, envelope))
        log.info("[mock-bus] publish %s -> %s", routing_key, envelope.eventId)

    def on(self, routing_key: str, handler: Handler) -> None:
        self._handlers[routing_key] = handler

    async def start_consuming(self) -> None:
        # En mock no hay loop de consumo: los eventos se inyectan vía inject().
        return None

    async def inject(self, routing_key: str, envelope: EventEnvelope) -> None:
        """Simula un evento entrante (usado por el endpoint de prueba)."""
        handler = self._handlers.get(routing_key)
        if handler is None:
            log.warning("[mock-bus] sin handler para %s", routing_key)
            return
        await handler(envelope)

    async def close(self) -> None:
        return None


class RabbitMQEventBus(EventBus):
    """Bus real sobre RabbitMQ (exchange topic `neolend.events`)."""

    def __init__(self) -> None:
        self._conn = None
        self._channel = None
        self._exchange = None
        self._handlers: dict[str, Handler] = {}

    async def connect(self) -> None:
        import aio_pika  # import diferido: solo si se usa el bus real

        self._conn = await aio_pika.connect_robust(settings.amqp_url)
        self._channel = await self._conn.channel()
        self._exchange = await self._channel.declare_exchange(
            settings.event_exchange, aio_pika.ExchangeType.TOPIC, durable=True
        )
        log.info("EventBus conectado a RabbitMQ (%s).", settings.event_exchange)

    async def publish(self, routing_key: str, envelope: EventEnvelope) -> None:
        import aio_pika

        body = json.dumps(envelope.model_dump()).encode()
        await self._exchange.publish(
            aio_pika.Message(
                body=body,
                content_type="application/json",
                message_id=envelope.eventId,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=routing_key,
        )
        log.info("publish %s -> %s", routing_key, envelope.eventId)

    def on(self, routing_key: str, handler: Handler) -> None:
        self._handlers[routing_key] = handler

    async def start_consuming(self) -> None:
        if not self._handlers:
            return
        queue = await self._channel.declare_queue(
            f"{settings.service_name}.inbox", durable=True
        )
        for routing_key in self._handlers:
            await queue.bind(self._exchange, routing_key)
        await queue.consume(self._dispatch)

    async def _dispatch(self, message) -> None:
        async with message.process():
            envelope = EventEnvelope(**json.loads(message.body))
            handler = self._handlers.get(message.routing_key)
            if handler:
                await handler(envelope)

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()


def get_bus() -> EventBus:
    return RabbitMQEventBus() if settings.use_real_bus else MockEventBus()
