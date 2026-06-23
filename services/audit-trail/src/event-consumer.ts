import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AuditService, CreditDecision } from './audit.service';

/**
 * Consume las decisiones de crédito del Event Bus (RabbitMQ) y las audita.
 *
 * Escucha el exchange `neolend.events` (topic) con routing keys de decisiones:
 *   credit.approved · credit.rejected · credit.escalated
 *
 * Es tolerante a fallos: si RabbitMQ no está disponible, reintenta la conexión
 * sin tumbar el servicio (el camino HTTP /audit/record sigue funcionando).
 */
@Injectable()
export class EventConsumer implements OnModuleInit {
  private readonly logger = new Logger(EventConsumer.name);
  private readonly exchange = 'neolend.events';
  private readonly queue = 'audit.decisions';

  constructor(private readonly audit: AuditService) {}

  async onModuleInit(): Promise<void> {
    this.connectWithRetry();
  }

  private connectWithRetry(): void {
    const url = process.env.AMQP_URL;
    if (!url) {
      this.logger.warn('AMQP_URL no definido; consumidor de eventos deshabilitado');
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
      this.logger.warn('Conexión RabbitMQ cerrada; reintentando');
      setTimeout(() => this.connectWithRetry(), 5000);
    });
    conn.on('error', () => undefined);

    const ch = await conn.createChannel();
    await ch.assertExchange(this.exchange, 'topic', { durable: true });
    await ch.assertQueue(this.queue, { durable: true });
    for (const key of ['credit.approved', 'credit.rejected', 'credit.escalated']) {
      await ch.bindQueue(this.queue, this.exchange, key);
    }
    await ch.prefetch(20);

    await ch.consume(this.queue, async (msg) => {
      if (!msg) return;
      try {
        const envelope = JSON.parse(msg.content.toString());
        const decision = this.toDecision(envelope);
        await this.audit.record(decision);
        ch.ack(msg);
      } catch (err) {
        this.logger.error(`Evento descartado: ${(err as Error).message}`);
        ch.nack(msg, false, false); // a dead-letter, no requeue infinito
      }
    });

    this.logger.log('Consumiendo decisiones de crédito desde el Event Bus');
  }

  /** Normaliza el envelope del bus a la decisión auditable. */
  private toDecision(envelope: any): CreditDecision {
    const p = envelope.payload ?? envelope;
    const outcome =
      envelope.eventType === 'credit.rejected'
        ? 'rejected'
        : envelope.eventType === 'credit.escalated'
          ? 'escalated'
          : 'approved';
    return {
      creditId: p.creditId ?? p.creditId ?? envelope.aggregateId,
      applicationId: p.applicationId,
      inputs: p.inputs ?? p.features ?? {},
      modelWeights: p.modelWeights ?? {},
      outcome,
      score: p.score,
      amount: p.amount,
      modelVersion: p.modelVersion,
      source: `bus:${envelope.eventType}`,
      decidedAt: envelope.occurredAt,
    };
  }
}
