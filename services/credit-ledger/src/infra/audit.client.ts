import { Injectable, Logger } from '@nestjs/common';
import { StoredEvent } from './event-store';

/**
 * Cliente HTTP que notifica al servicio audit-trail cada decisión de crédito
 * (aprobada / rechazada / escalada) para su firma digital y encadenamiento.
 *
 * El audit-trail también consume del Event Bus; esta llamada HTTP directa es
 * un refuerzo síncrono para que la traza quede registrada de inmediato. Si
 * falla, no rompe la decisión (el evento ya está en el Event Store y el bus).
 */
@Injectable()
export class AuditClient {
  private readonly logger = new Logger(AuditClient.name);

  async record(creditId: string, event: StoredEvent): Promise<void> {
    const url = `${process.env.AUDIT_URL ?? 'http://audit-trail:3008'}/audit/record`;
    const p = event.payload ?? {};
    const outcome =
      event.type === 'CreditApproved'
        ? 'approved'
        : event.type === 'CreditRejected'
          ? 'rejected'
          : 'escalated';

    const decision = {
      creditId,
      applicationId: creditId,
      inputs: p.inputs ?? {},
      modelWeights: p.modelWeights ?? {},
      outcome,
      score: p.score,
      amount: p.amount,
      modelVersion: p.modelVersion,
      source: 'credit-ledger',
      decidedAt: event.occurredAt,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`audit-trail respondió ${res.status}`);
      this.logger.log(`Decisión ${outcome} de ${creditId} enviada a auditoría`);
    } catch (err) {
      this.logger.warn(`No se pudo auditar ${creditId} por HTTP: ${(err as Error).message}`);
    }
  }
}
