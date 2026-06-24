import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { v4 as uuid } from 'uuid';
import { StoredEvent } from './event-store';
import { ROUTING_KEYS, CreditEventType } from '../domain/events';

/**
 * Publica los eventos de dominio al Event Bus (RabbitMQ, exchange topic
 * `neolend.events`). Otros servicios (disbursement, investor-portal,
 * audit-trail) reaccionan a estas routing keys.
 *
 * Tolerante a fallos: si RabbitMQ no está disponible, reintenta sin tumbar el
 * servicio (los eventos ya quedaron persistidos en el Event Store, que es la
 * fuente de verdad).
 */
@Injectable()
export class EventBus implements OnModuleInit {
  private readonly logger = new Logger(EventBus.name);
  private readonly exchange = 'neolend.events';
  private channel: amqp.Channel | null = null;

  async onModuleInit(): Promise<void> {
    this.connectWithRetry();
  }

  private connectWithRetry(): void {
    const url = process.env.AMQP_URL;
    if (!url) {
      this.logger.warn('AMQP_URL no definido; publicación de eventos deshabilitada');
      return;
    }
    this.connect(url).catch((err) => {
      this.logger.warn(`RabbitMQ no disponible (${(err as Error).message}); reintento en 5s`);
      setTimeout(() => this.connectWithRetry(), 5000);
    });
  }

  private async connect(url: string): Promise<void> {
    const conn = await amqp.connect(url);
    conn.on('close', () => {
      this.channel = null;
      setTimeout(() => this.connectWithRetry(), 5000);
    });
    conn.on('error', () => undefined);
    this.channel = await conn.createChannel();
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    this.logger.log('Conectado al Event Bus');
  }

  publish(event: StoredEvent): void {
    if (!this.channel) return; // ya persistido; se republicará vía outbox/reproyección si hace falta
    const routingKey = ROUTING_KEYS[event.type as CreditEventType] ?? `credit.${event.type}`;
    const envelope = {
      eventId: event.eventId,
      eventType: routingKey,
      aggregateId: event.aggregateId,
      aggregateType: 'CreditApplication',
      version: event.version,
      occurredAt: event.occurredAt,
      producer: 'credit-ledger',
      payload: { creditId: event.aggregateId, ...event.payload },
      metadata: { correlationId: event.correlationId ?? uuid() },
    };
    this.channel.publish(this.exchange, routingKey, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      contentType: 'application/json',
    });
  }
}
