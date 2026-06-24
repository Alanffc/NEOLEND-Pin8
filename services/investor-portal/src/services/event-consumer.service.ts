import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEnvelope } from '../dto/event-envelope.dto';

/**
 * Consumer de eventos del Event Bus (RabbitMQ).
 * Escucha los eventos relevantes para el portal de inversionistas:
 *   - credit.approved    → nuevo crédito aprobado, incrementa portafolio
 *   - disbursement.completed → desembolso realizado, actualiza totales
 *   - payment.received   → pago recibido, actualiza cobros y TIR
 *   - payment.overdue    → mora detectada, actualiza morosidad
 *
 * Según el contrato de events.md:
 *   - Idempotencia: deduplicamos por eventId
 *   - Trazabilidad: correlationId viaja en toda la cadena
 *
 * NOTA: En este MVP se mockea la conexión a RabbitMQ.
 * Para la integración real, se usará @nestjs/microservices con RMQ transport.
 */
@Injectable()
export class EventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(EventConsumerService.name);

  /** Set para deduplicación de eventos por eventId (idempotencia) */
  private processedEventIds = new Set<string>();

  /** Almacén en memoria de eventos procesados (read model temporal) */
  private eventStore: EventEnvelope[] = [];

  async onModuleInit() {
    this.logger.log('🔌 Inicializando consumer de eventos del Event Bus...');
    this.logger.log('📡 Suscribiéndose a routing keys: credit.approved, disbursement.completed, payment.received, payment.overdue');

    // En producción se conectaría a RabbitMQ así:
    // const connection = await amqplib.connect(process.env.AMQP_URL);
    // const channel = await connection.createChannel();
    // await channel.assertExchange('neolend.events', 'topic', { durable: true });
    // const q = await channel.assertQueue('investor-portal-queue', { durable: true });
    // await channel.bindQueue(q.queue, 'neolend.events', 'credit.approved');
    // await channel.bindQueue(q.queue, 'neolend.events', 'disbursement.completed');
    // await channel.bindQueue(q.queue, 'neolend.events', 'payment.received');
    // await channel.bindQueue(q.queue, 'neolend.events', 'payment.overdue');

    this.logger.log('✅ Consumer de eventos inicializado (modo mock)');
  }

  /**
   * Procesa un evento recibido del Event Bus.
   * Implementa deduplicación por eventId según contrato.
   */
  async processEvent(event: EventEnvelope): Promise<{ processed: boolean; reason?: string }> {
    // Deduplicación por eventId (idempotencia — regla del contrato)
    if (this.processedEventIds.has(event.eventId)) {
      this.logger.warn(`⚠️ Evento duplicado ignorado: ${event.eventId}`);
      return { processed: false, reason: 'Evento duplicado (ya procesado)' };
    }

    this.logger.log(`📨 Procesando evento: ${event.eventType} | eventId: ${event.eventId}`);
    this.logger.log(`   correlationId: ${event.metadata.correlationId}`);

    // Marcar como procesado
    this.processedEventIds.add(event.eventId);

    // Almacenar en read model
    this.eventStore.push(event);

    // Procesar según tipo
    switch (event.eventType) {
      case 'credit.approved':
        await this.handleCreditApproved(event);
        break;
      case 'disbursement.completed':
        await this.handleDisbursementCompleted(event);
        break;
      case 'payment.received':
        await this.handlePaymentReceived(event);
        break;
      case 'payment.overdue':
        await this.handlePaymentOverdue(event);
        break;
      default:
        this.logger.warn(`Tipo de evento no reconocido: ${event.eventType}`);
    }

    return { processed: true };
  }

  private async handleCreditApproved(event: EventEnvelope) {
    const { creditId, amount, terms, fundId, segment } = event.payload;
    this.logger.log(`✅ Crédito aprobado: ${creditId} | Monto: $${amount} | Fondo: ${fundId} | Segmento: ${segment}`);
    this.logger.log(`   Plazo: ${terms?.months} meses | Tasa: ${terms?.interestRate}%`);
    // En producción: INSERT en credit_events + UPDATE portfolio_snapshots
  }

  private async handleDisbursementCompleted(event: EventEnvelope) {
    const { creditId, channel, amount, fundId } = event.payload;
    this.logger.log(`💸 Desembolso completado: ${creditId} | Canal: ${channel} | Monto: $${amount}`);
    // En producción: UPDATE totalDisbursed en portfolio_snapshots
  }

  private async handlePaymentReceived(event: EventEnvelope) {
    const { creditId, amount, paymentNumber, remainingBalance } = event.payload;
    this.logger.log(`💰 Pago recibido: ${creditId} | Monto: $${amount} | Pago #${paymentNumber} | Saldo restante: $${remainingBalance}`);
    // En producción: UPDATE totalCollected, recalcular TIR
  }

  private async handlePaymentOverdue(event: EventEnvelope) {
    const { creditId, daysLate, amount } = event.payload;
    this.logger.log(`🚨 Pago en mora: ${creditId} | Días de atraso: ${daysLate} | Monto: $${amount}`);
    // En producción: UPDATE delinquencyRate, riskExposure
  }

  /** Obtener eventos procesados (para debug/testing) */
  getProcessedEvents(): EventEnvelope[] {
    return [...this.eventStore];
  }

  /** Obtener conteo de eventos procesados por tipo */
  getEventStats() {
    const stats: Record<string, number> = {};
    for (const event of this.eventStore) {
      stats[event.eventType] = (stats[event.eventType] || 0) + 1;
    }
    return {
      totalProcessed: this.eventStore.length,
      totalDeduplicated: this.processedEventIds.size,
      byType: stats,
    };
  }
}
