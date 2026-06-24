import { Injectable } from '@nestjs/common';
import { EventStore } from '../infra/event-store';
import { CreditApplication } from '../domain/credit-application.aggregate';

/**
 * Lado QUERY del CQRS.
 *
 * El read model se DERIVA de la proyección de los eventos (no hay tabla de
 * estado mutable). Para un MVP esto reconstruye el agregado on-demand desde el
 * Event Store; en producción se materializaría en una vista de lectura
 * actualizada por un proyector que escucha el bus.
 */
@Injectable()
export class QueryService {
  constructor(private readonly store: EventStore) {}

  /** Estado actual de un crédito (proyección del stream de eventos). */
  async getById(creditId: string): Promise<any | null> {
    const events = await this.store.load(creditId);
    if (events.length === 0) return null;
    const agg = CreditApplication.rehydrate(events);
    return {
      creditId: agg.applicationId,
      applicantId: agg.applicantId,
      amount: agg.amount,
      score: agg.score,
      status: agg.status,
      version: agg.version,
    };
  }

  /** Trazabilidad completa: la secuencia inmutable de eventos del crédito. */
  async getEvents(creditId: string): Promise<any> {
    const timeline = await this.store.timeline(creditId);
    return { creditId, count: timeline.length, events: timeline };
  }
}
