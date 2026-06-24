/**
 * Interfaz del Envelope de eventos — contrato definido en shared/events/events.md.
 * Todos los eventos que llegan del Event Bus (RabbitMQ) siguen esta estructura.
 */
export interface EventEnvelope {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string; // ISO-8601
  producer: string;
  payload: Record<string, any>;
  metadata: {
    correlationId: string;
    causationId: string;
  };
}

/** Payload de credit.approved */
export interface CreditApprovedPayload {
  creditId: string;
  amount: number;
  terms: {
    months: number;
    interestRate: number;
    monthlyPayment: number;
  };
  applicantId: string;
  fundId: string;
  segment: string;
}

/** Payload de disbursement.completed */
export interface DisbursementCompletedPayload {
  creditId: string;
  channel: string; // 'wallet', 'bank', 'correspondent'
  amount: number;
  fundId: string;
}

/** Payload de payment.received */
export interface PaymentReceivedPayload {
  creditId: string;
  amount: number;
  fundId: string;
  paymentNumber: number;
  remainingBalance: number;
}

/** Payload de payment.overdue */
export interface PaymentOverduePayload {
  creditId: string;
  daysLate: number;
  amount: number;
  fundId: string;
}
