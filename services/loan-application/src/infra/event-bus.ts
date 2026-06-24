import { Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';

const logger = new Logger('EventBus');
// exchange tipo "topic" — permite routing keys con wildcards (ej. credit.*)
const EXCHANGE = 'neolend.events';

let channel: amqplib.Channel | null = null;

export async function getChannel(): Promise<amqplib.Channel> {
  if (channel) return channel;

  const conn = await amqplib.connect(
    process.env.AMQP_URL ?? 'amqp://neolend:neolend@localhost:5672',
  );
  channel = await conn.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  conn.on('close', () => {
    channel = null;
    logger.warn('Conexión AMQP cerrada — reconectará en el próximo intento');
  });

  logger.log('Conectado a RabbitMQ');
  return channel;
}

export async function publish(
  routingKey: string,
  payload: Record<string, any> & { correlationId?: string },
): Promise<void> {
  const ch = await getChannel();
  const envelope = {
    eventId: crypto.randomUUID(),
    eventType: routingKey,
    aggregateId: (payload as any).applicationId ?? (payload as any).applicantId,
    aggregateType: 'CreditApplication',
    version: 1,
    occurredAt: new Date().toISOString(),
    producer: 'loan-application',
    payload,
    metadata: { correlationId: payload.correlationId ?? crypto.randomUUID() },
  };
  ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(envelope)), {
    persistent: true,
  });
  logger.debug(`publicado ${routingKey} — eventId=${envelope.eventId}`);
}

export async function subscribe(
  routingKey: string,
  handler: (payload: any) => Promise<void>,
): Promise<void> {
  const ch = await getChannel();
  const q = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(q.queue, EXCHANGE, routingKey);

  ch.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      await handler(event.payload);
      ch.ack(msg);
    } catch (err) {
      logger.error(`Error procesando evento ${routingKey}`, (err as Error).message);
      ch.nack(msg, false, false);
    }
  });

  logger.log(`Suscrito a ${routingKey}`);
}
