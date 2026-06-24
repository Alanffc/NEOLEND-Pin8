import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Evento de crédito recibido desde el Event Bus (RabbitMQ).
 * Read model que almacena eventos: credit.approved, disbursement.completed,
 * payment.received, payment.overdue, etc.
 * Se usa para calcular métricas del portafolio en tiempo real.
 */
@Entity('credit_events')
@Index(['creditId'])
@Index(['eventType'])
@Index(['fundId'])
export class CreditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID del evento original (para idempotencia según contrato events.md) */
  @Column({ name: 'event_id', unique: true })
  eventId: string;

  /** Tipo del evento: credit.approved, payment.received, etc. */
  @Column({ name: 'event_type' })
  eventType: string;

  /** ID del crédito asociado */
  @Column({ name: 'credit_id' })
  creditId: string;

  /** ID del fondo inversionista que fondea este crédito */
  @Column({ name: 'fund_id', nullable: true })
  fundId: string;

  /** Monto asociado al evento (desembolso, pago, etc.) */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  /** Días de atraso (solo para payment.overdue) */
  @Column({ name: 'days_late', default: 0 })
  daysLate: number;

  /** Canal de desembolso (solo para disbursement.completed) */
  @Column({ nullable: true })
  channel: string;

  /** Segmento del crédito para análisis de morosidad */
  @Column({ nullable: true })
  segment: string;

  /** Payload completo del evento (JSON) */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  /** Fecha en que ocurrió el evento (del envelope) */
  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
