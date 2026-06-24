import {
  DomainEvent,
  CreditRequested,
  CreditApproved,
  CreditRejected,
  CreditEscalated,
  DisbursementCompleted,
  PaymentReceived,
} from './events';

export type CreditStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'DISBURSED'
  | 'PAID';

/** Reglas de negocio (inciso III). */
export const AUTO_APPROVE_MAX_AMOUNT = 500; // USD
export const MIN_APPROVE_SCORE = 600;

/**
 * Agregado CreditApplication.
 *
 * Se RECONSTRUYE aplicando en orden los eventos del Event Store (`rehydrate`),
 * nunca leyendo un estado mutable. Los métodos de comando (decide/disburse/pay)
 * validan invariantes y DEVUELVEN eventos nuevos — no mutan persistencia
 * directamente; de eso se encarga el Event Store.
 */
export class CreditApplication {
  status!: CreditStatus;
  applicationId!: string;
  applicantId!: string;
  amount = 0;
  score = 0;
  version = 0; // nº de eventos aplicados (concurrencia optimista)

  static rehydrate(events: DomainEvent[]): CreditApplication {
    const agg = new CreditApplication();
    for (const e of events) agg.apply(e);
    return agg;
  }

  /** Aplica un evento al estado en memoria (proyección interna). */
  apply(event: DomainEvent): void {
    switch (event.type) {
      case 'CreditRequested': {
        const p = event.payload as CreditRequested;
        this.applicationId = p.applicationId;
        this.applicantId = p.applicantId;
        this.amount = p.amount;
        this.status = 'REQUESTED';
        break;
      }
      case 'CreditApproved': {
        const p = event.payload as CreditApproved;
        this.amount = p.amount;
        this.score = p.score;
        this.status = 'APPROVED';
        break;
      }
      case 'CreditRejected':
        this.status = 'REJECTED';
        break;
      case 'CreditEscalated':
        this.status = 'ESCALATED';
        break;
      case 'DisbursementCompleted':
        this.status = 'DISBURSED';
        break;
      case 'PaymentReceived':
        this.status = 'PAID';
        break;
    }
    this.version += 1;
  }

  // ---- Comandos (validan invariantes y emiten eventos) ----

  /**
   * Decide sobre una solicitud nueva a partir del score y la verificación de
   * fraude. Devuelve el/los eventos que representan la decisión.
   *
   *  - fraude => CreditRejected
   *  - score < MIN_APPROVE_SCORE => CreditRejected
   *  - monto > $500 => CreditEscalated (revisión manual con evidencia)
   *  - resto => CreditApproved (automático)
   */
  decide(cmd: {
    applicationId: string;
    applicantId: string;
    amount: number;
    score: number;
    fraudPassed: boolean;
    modelVersion?: string;
    modelWeights?: Record<string, number>;
    inputs?: Record<string, unknown>;
  }): DomainEvent[] {
    if (this.status && this.status !== 'REQUESTED') {
      throw new Error(`La solicitud ya fue decidida (estado=${this.status})`);
    }

    const requested: DomainEvent<CreditRequested> = {
      type: 'CreditRequested',
      payload: {
        applicationId: cmd.applicationId,
        applicantId: cmd.applicantId,
        amount: cmd.amount,
        inputs: cmd.inputs,
      },
    };

    if (!cmd.fraudPassed) {
      return [requested, this.reject('fraud_check_failed', cmd)];
    }
    if (cmd.score < MIN_APPROVE_SCORE) {
      return [requested, this.reject('score_below_threshold', cmd)];
    }
    if (cmd.amount > AUTO_APPROVE_MAX_AMOUNT) {
      const escalated: DomainEvent<CreditEscalated> = {
        type: 'CreditEscalated',
        payload: {
          reason: 'amount_exceeds_auto_limit',
          amount: cmd.amount,
          score: cmd.score,
          evidence: { inputs: cmd.inputs, modelWeights: cmd.modelWeights, modelVersion: cmd.modelVersion },
        },
      };
      return [requested, escalated];
    }

    const approved: DomainEvent<CreditApproved> = {
      type: 'CreditApproved',
      payload: {
        amount: cmd.amount,
        score: cmd.score,
        modelVersion: cmd.modelVersion,
        modelWeights: cmd.modelWeights,
        inputs: cmd.inputs,
        terms: { termDays: 30, interestRate: 0.025 },
        auto: true,
      },
    };
    return [requested, approved];
  }

  disburse(channel: string, reference: string): DomainEvent[] {
    if (this.status !== 'APPROVED') {
      throw new Error(`No se puede desembolsar en estado=${this.status}`);
    }
    return [{ type: 'DisbursementCompleted', payload: { channel, reference } as DisbursementCompleted }];
  }

  pay(amount: number): DomainEvent[] {
    if (this.status !== 'DISBURSED') {
      throw new Error(`No se puede registrar pago en estado=${this.status}`);
    }
    return [{ type: 'PaymentReceived', payload: { amount } as PaymentReceived }];
  }

  private reject(reason: string, cmd: { score: number; inputs?: Record<string, unknown> }): DomainEvent<CreditRejected> {
    return { type: 'CreditRejected', payload: { reason, score: cmd.score, inputs: cmd.inputs } };
  }
}
