import { Injectable, Logger } from '@nestjs/common';
import { EventStore, StoredEvent } from '../infra/event-store';
import { EventBus } from '../infra/event-bus';
import { AuditClient } from '../infra/audit.client';
import { CreditApplication } from '../domain/credit-application.aggregate';

export interface DecideCommand {
  applicationId: string;
  applicantId: string;
  amount: number;
  score: number;
  fraudPassed: boolean;
  modelVersion?: string;
  modelWeights?: Record<string, number>;
  inputs?: Record<string, unknown>;
}

/**
 * Lado COMMAND del CQRS.
 *
 * Flujo de una decisión:
 *  1. Rehidrata el agregado desde el Event Store.
 *  2. Ejecuta el comando de dominio → produce eventos nuevos.
 *  3. Anexa los eventos (transacción + concurrencia optimista).
 *  4. Publica al Event Bus y notifica al audit-trail (firma digital).
 */
@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name);

  constructor(
    private readonly store: EventStore,
    private readonly bus: EventBus,
    private readonly audit: AuditClient,
  ) {}

  async decide(cmd: DecideCommand): Promise<{ creditId: string; status: string; events: string[] }> {
    const history = await this.store.load(cmd.applicationId);
    const agg = CreditApplication.rehydrate(history);

    const newEvents = agg.decide(cmd);
    const stored = await this.store.append(
      cmd.applicationId,
      agg.version,
      newEvents,
      cmd.applicationId, // correlationId = applicationId
    );

    await this.dispatch(cmd.applicationId, stored);

    // Estado resultante tras aplicar los nuevos eventos
    const finalAgg = CreditApplication.rehydrate([...history, ...newEvents]);
    this.logger.log(`Decisión de ${cmd.applicationId} => ${finalAgg.status}`);
    return { creditId: cmd.applicationId, status: finalAgg.status, events: stored.map((e) => e.type) };
  }

  async disburse(creditId: string, channel: string, reference: string): Promise<{ status: string }> {
    const history = await this.store.load(creditId);
    const agg = CreditApplication.rehydrate(history);
    const events = agg.disburse(channel, reference);
    const stored = await this.store.append(creditId, agg.version, events, creditId);
    await this.dispatch(creditId, stored);
    return { status: 'DISBURSED' };
  }

  async registerPayment(creditId: string, amount: number): Promise<{ status: string }> {
    const history = await this.store.load(creditId);
    const agg = CreditApplication.rehydrate(history);
    const events = agg.pay(amount);
    const stored = await this.store.append(creditId, agg.version, events, creditId);
    await this.dispatch(creditId, stored);
    return { status: 'PAID' };
  }

  /** Publica al bus y, para decisiones, refuerza la auditoría por HTTP. */
  private async dispatch(creditId: string, stored: StoredEvent[]): Promise<void> {
    for (const e of stored) {
      this.bus.publish(e);
    }

    // Auditoría: si el bus no está conectado, refuerzo síncrono por HTTP para no
    // perder la traza. Si el bus SÍ está, él alimenta la auditoría (vía única,
    // desacoplada) y evitamos el registro duplicado.
    if (!this.bus.isConnected()) {
      for (const e of stored) {
        if (e.type === 'CreditApproved' || e.type === 'CreditRejected' || e.type === 'CreditEscalated') {
          await this.audit.record(creditId, e);
        }
      }
    }
  }
}
