import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Morosidad por segmento — read model calculado.
 * Segmentos: micro (0-100), pequeño (101-500), mediano (501-2000), grande (2001+).
 * Permite al inversionista ver exposición granular por tipo de crédito.
 */
@Entity('delinquency_by_segment')
export class DelinquencyBySegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID del fondo inversionista */
  @Column({ name: 'fund_id' })
  fundId: string;

  /** Nombre del segmento: micro, pequeño, mediano, grande */
  @Column()
  segment: string;

  /** Total de créditos en el segmento */
  @Column({ name: 'total_credits', default: 0 })
  totalCredits: number;

  /** Créditos en mora dentro del segmento */
  @Column({ name: 'overdue_credits', default: 0 })
  overdueCredits: number;

  /** Tasa de morosidad del segmento (porcentaje) */
  @Column({ name: 'delinquency_rate', type: 'decimal', precision: 6, scale: 2, default: 0 })
  delinquencyRate: number;

  /** Monto total en riesgo en el segmento */
  @Column({ name: 'amount_at_risk', type: 'decimal', precision: 15, scale: 2, default: 0 })
  amountAtRisk: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
