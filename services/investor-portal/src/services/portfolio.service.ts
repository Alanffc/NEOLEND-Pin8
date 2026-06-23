import { Injectable, Logger } from '@nestjs/common';
import {
  PortfolioDashboardDto,
  DelinquencySegmentDto,
  CashFlowProjectionDto,
  HistoricalMetricDto,
  CreditStatusDistributionDto,
  FullDashboardResponseDto,
} from '../dto';
import {
  generateMockPortfolio,
  generateMockDelinquencyBySegment,
  generateMockCashFlowProjections,
  generateMockHistoricalMetrics,
  generateMockCreditDistribution,
  getMockFunds,
} from '../mocks/portfolio-mock.data';

/**
 * Servicio principal del portal de inversionistas.
 * Calcula y expone las métricas requeridas:
 *   - TIR (Tasa Interna de Retorno)
 *   - Morosidad por segmento
 *   - Flujo de caja proyectado (30d, 60d, 90d)
 *   - Exposición al riesgo
 *   - Distribución de créditos por estado
 *   - Tendencias históricas (12 meses)
 *
 * NOTA: Actualmente usa datos mock. Cuando se integre con el Event Bus real,
 * se reemplazarán las llamadas a generateMock* por consultas a la BD (read model).
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  /** Obtener lista de fondos disponibles */
  getFunds() {
    this.logger.log('Consultando lista de fondos inversionistas');
    return getMockFunds();
  }

  /** Obtener dashboard completo de un fondo específico */
  getFullDashboard(fundId: string): FullDashboardResponseDto {
    this.logger.log(`Generando dashboard completo para fondo ${fundId}`);

    const funds = getMockFunds();
    const fundIndex = funds.findIndex((f) => f.fundId === fundId);

    if (fundIndex === -1) {
      this.logger.warn(`Fondo ${fundId} no encontrado, usando fondo por defecto`);
    }

    const idx = fundIndex >= 0 ? fundIndex : 0;
    const portfolio = this.getPortfolioSummary(idx);
    const delinquencyBySegment = this.getDelinquencyBySegment(fundId);
    const cashFlowProjections = this.getCashFlowProjections(portfolio.totalDisbursed);
    const historicalMetrics = this.getHistoricalMetrics();
    const creditDistribution = this.getCreditDistribution(portfolio.totalCredits);

    return {
      portfolio,
      delinquencyBySegment,
      cashFlowProjections,
      historicalMetrics,
      creditDistribution,
      lastEventProcessed: new Date().toISOString(),
    };
  }

  /** Resumen del portafolio con TIR, morosidad y riesgo */
  getPortfolioSummary(fundIndex: number = 0): PortfolioDashboardDto {
    this.logger.log('Calculando resumen del portafolio');
    const mock = generateMockPortfolio(fundIndex);

    return {
      ...mock,
      riskRatio: mock.totalDisbursed > 0
        ? parseFloat(((mock.riskExposure / mock.totalDisbursed) * 100).toFixed(2))
        : 0,
    };
  }

  /** Morosidad desglosada por segmento (micro, pequeño, mediano, grande) */
  getDelinquencyBySegment(fundId: string): DelinquencySegmentDto[] {
    this.logger.log(`Calculando morosidad por segmento para fondo ${fundId}`);
    return generateMockDelinquencyBySegment(fundId);
  }

  /** Proyecciones de flujo de caja a 30, 60 y 90 días */
  getCashFlowProjections(totalDisbursed: number): CashFlowProjectionDto[] {
    this.logger.log('Calculando proyecciones de flujo de caja');
    return generateMockCashFlowProjections(totalDisbursed);
  }

  /** Métricas históricas de los últimos 12 meses para gráficos de tendencia */
  getHistoricalMetrics(): HistoricalMetricDto[] {
    this.logger.log('Obteniendo métricas históricas (12 meses)');
    return generateMockHistoricalMetrics();
  }

  /** Distribución de créditos por estado */
  getCreditDistribution(totalCredits: number): CreditStatusDistributionDto[] {
    this.logger.log('Calculando distribución de créditos por estado');
    return generateMockCreditDistribution(totalCredits);
  }

  /**
   * Calcula la TIR simplificada basada en flujos de caja.
   * En producción, se usaría el método de Newton-Raphson sobre los flujos reales.
   */
  calculateTIR(totalInvested: number, totalReturned: number, months: number): number {
    if (totalInvested <= 0 || months <= 0) return 0;
    // TIR simplificada: ((totalReturned / totalInvested) ^ (12/months)) - 1
    const ratio = totalReturned / totalInvested;
    const annualizedReturn = Math.pow(ratio, 12 / months) - 1;
    return parseFloat((annualizedReturn * 100).toFixed(4));
  }
}
