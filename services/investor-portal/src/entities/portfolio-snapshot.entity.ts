import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Snapshot del portafolio de un fondo inversionista.
 * Se actualiza en tiempo real conforme llegan eventos del Event Bus.
 * Contiene las métricas requeridas: TIR, morosidad, flujo de caja, exposición al riesgo.
 */
@Entity('portfolio_snapshots')
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID del fondo inversionista */
  @Column({ name: 'fund_id' })
  fundId: string;

  /** Nombre del fondo */
  @Column({ name: 'fund_name' })
  fundName: string;

  /** Tasa Interna de Retorno (TIR) — porcentaje anualizado */
  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  tir: number;

  /** Total de créditos activos en el portafolio */
  @Column({ name: 'total_credits', default: 0 })
  totalCredits: number;

  /** Monto total desembolsado en USD */
  @Column({ name: 'total_disbursed', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDisbursed: number;

  /** Monto total cobrado en USD */
  @Column({ name: 'total_collected', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCollected: number;

  /** Porcentaje de morosidad general */
  @Column({ name: 'delinquency_rate', type: 'decimal', precision: 6, scale: 2, default: 0 })
  delinquencyRate: number;

  /** Flujo de caja proyectado a 30 días en USD */
  @Column({ name: 'projected_cash_flow_30d', type: 'decimal', precision: 15, scale: 2, default: 0 })
  projectedCashFlow30d: number;

  /** Flujo de caja proyectado a 90 días en USD */
  @Column({ name: 'projected_cash_flow_90d', type: 'decimal', precision: 15, scale: 2, default: 0 })
  projectedCashFlow90d: number;

  /** Exposición al riesgo (monto total en créditos de alto riesgo) */
  @Column({ name: 'risk_exposure', type: 'decimal', precision: 15, scale: 2, default: 0 })
  riskExposure: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
