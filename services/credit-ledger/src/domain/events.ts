/**
 * Eventos de dominio del agregado CreditApplication (Event Sourcing).
 *
 * El estado del crédito NO se guarda como una fila mutable: se deriva de la
 * secuencia inmutable de estos eventos. Esto da la trazabilidad regulatoria
 * que exige la Superintendencia (cada cambio queda registrado para siempre).
 */

export type CreditEventType =
  | 'CreditRequested'
  | 'CreditApproved'
  | 'CreditRejected'
  | 'CreditEscalated'
  | 'DisbursementCompleted'
  | 'PaymentReceived';

/** Routing keys publicadas al Event Bus (ver shared/events/events.md). */
export const ROUTING_KEYS: Record<CreditEventType, string> = {
  CreditRequested: 'credit.requested',
  CreditApproved: 'credit.approved',
  CreditRejected: 'credit.rejected',
  CreditEscalated: 'credit.escalated',
  DisbursementCompleted: 'disbursement.completed',
  PaymentReceived: 'payment.received',
};

export interface DomainEvent<T = any> {
  type: CreditEventType;
  payload: T;
}

// ---- Payloads ----

export interface CreditRequested {
  applicationId: string;
  applicantId: string;
  amount: number;
  /** Variables de entrada del scoring (para auditoría). */
  inputs?: Record<string, unknown>;
}

export interface CreditApproved {
  amount: number;
  score: number;
  modelVersion?: string;
  modelWeights?: Record<string, number>;
  inputs?: Record<string, unknown>;
  terms: { termDays: number; interestRate: number };
  auto: boolean;
}

export interface CreditRejected {
  reason: string;
  score?: number;
  inputs?: Record<string, unknown>;
}

export interface CreditEscalated {
  reason: string;
  amount: number;
  score?: number;
  /** Evidencia pre-cargada para el analista (inciso III). */
  evidence?: Record<string, unknown>;
}

export interface DisbursementCompleted {
  channel: string;
  reference: string;
}

export interface PaymentReceived {
  amount: number;
}
