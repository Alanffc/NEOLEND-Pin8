/**
 * DTOs de respuesta del portal de inversionistas.
 * Contratos de salida de la API REST.
 */

/** Resumen general del portafolio para un fondo */
export class PortfolioDashboardDto {
  fundId: string;
  fundName: string;
  /** Tasa Interna de Retorno (%) */
  tir: number;
  totalCredits: number;
  totalDisbursed: number;
  totalCollected: number;
  /** Tasa de morosidad general (%) */
  delinquencyRate: number;
  projectedCashFlow30d: number;
  projectedCashFlow90d: number;
  /** Monto total en créditos de alto riesgo */
  riskExposure: number;
  /** Relación riesgo/desembolso (%) */
  riskRatio: number;
  updatedAt: Date;
}

/** Morosidad detallada por segmento */
export class DelinquencySegmentDto {
  segment: string;
  totalCredits: number;
  overdueCredits: number;
  delinquencyRate: number;
  amountAtRisk: number;
}

/** Flujo de caja proyectado */
export class CashFlowProjectionDto {
  period: string; // '30d', '60d', '90d'
  expectedIncome: number;
  expectedDefaults: number;
  netCashFlow: number;
}

/** Métrica histórica para gráficos de tendencia */
export class HistoricalMetricDto {
  date: string;
  tir: number;
  delinquencyRate: number;
  totalDisbursed: number;
  totalCollected: number;
}

/** Distribución de créditos por estado */
export class CreditStatusDistributionDto {
  status: string; // 'activo', 'pagado', 'en_mora', 'reestructurado'
  count: number;
  amount: number;
  percentage: number;
}

/** Respuesta completa del dashboard */
export class FullDashboardResponseDto {
  portfolio: PortfolioDashboardDto;
  delinquencyBySegment: DelinquencySegmentDto[];
  cashFlowProjections: CashFlowProjectionDto[];
  historicalMetrics: HistoricalMetricDto[];
  creditDistribution: CreditStatusDistributionDto[];
  lastEventProcessed: string;
}
