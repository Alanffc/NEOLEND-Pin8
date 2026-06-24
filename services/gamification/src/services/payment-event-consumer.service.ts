import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Consumer de eventos de pagos desde el Event Bus.
 * Escucha `payment.received` para otorgar XP por pagos puntuales
 * y desbloquear el logro "Pago Puntual".
 *
 * Según events.md, `payment.received` es emitido por collections
 * y es consumido por: credit-ledger, investor, gamification.
 */
@Injectable()
export class PaymentEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentEventConsumer.name);

  /** Eventos de pago procesados */
  private processedPayments: any[] = [];
  private processedEventIds = new Set<string>();

  async onModuleInit() {
    this.logger.log('📡 Suscribiéndose a eventos: payment.received');
    this.logger.log('✅ Consumer de pagos inicializado (modo mock)');
    // En producción: bindQueue('neolend.events', 'payment.received')
  }

  /**
   * Procesa evento de pago recibido.
   * Otorga XP al usuario y verifica logros de pago.
   */
  async processPaymentReceived(event: any): Promise<{ xpAwarded: number; achievementUnlocked?: string }> {
    // Deduplicación por eventId
    if (this.processedEventIds.has(event.eventId)) {
      this.logger.warn(`⚠️ Evento de pago duplicado: ${event.eventId}`);
      return { xpAwarded: 0 };
    }

    this.processedEventIds.add(event.eventId);

    const { creditId, amount, paymentNumber } = event.payload;
    this.logger.log(`💰 Pago recibido procesado — crédito: ${creditId} | monto: $${amount} | pago #${paymentNumber}`);

    // Otorgar XP por pago puntual
    const xpAwarded = 10;
    let achievementUnlocked: string | undefined;

    // Verificar si es el primer pago (logro ON_TIME_PAYMENT)
    if (paymentNumber === 1) {
      achievementUnlocked = 'ON_TIME_PAYMENT';
      this.logger.log('🏆 Logro desbloqueado: Pago Puntual');
    }

    this.processedPayments.push({
      ...event,
      xpAwarded,
      achievementUnlocked,
      processedAt: new Date().toISOString(),
    });

    return { xpAwarded, achievementUnlocked };
  }

  /** Obtener estadísticas de pagos procesados */
  getPaymentStats() {
    return {
      totalProcessed: this.processedPayments.length,
      totalXpAwarded: this.processedPayments.reduce((sum, p) => sum + p.xpAwarded, 0),
      achievementsUnlocked: this.processedPayments.filter((p) => p.achievementUnlocked).length,
    };
  }
}
