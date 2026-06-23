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
import { FinancialCalculationService } from './financial-calculation.service';

/**
 * Servicio principal del portal de inversionistas.
 * Calcula y expone las métricas requeridas:
 *   - TIR (Tasa Interna de Retorno)
 *   - Morosidad por segmento
 *   - Flujo de caja proyectado (30d, 60d, 90d)
 *   - Exposición al riesgo
 *   - Distribución de créditos por estado
 *   - Tendencias históricas (12 meses)
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(private readonly financialService: FinancialCalculationService) {}

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
    
    // Proyección de flujo de caja usando el modelo financiero avanzado
    const cashFlowProjections = this.financialService.projectCashFlow(
        portfolio.totalDisbursed - portfolio.totalCollected, // Saldo vigente
        0.08, // 8% pago mensual
        portfolio.delinquencyRate / 100, // Tasa de mora como probabilidad de default
        3 // 3 meses (30d, 60d, 90d)
    ).map((p) => ({
      period: `${p.month * 30}d`,
      expectedIncome: p.expectedIncome,
      expectedDefaults: p.expectedLoss,
      netCashFlow: p.netFlow,
    }));

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

    // Simulando flujos de caja para calcular TIR real con Newton-Raphson
    const simulatedCashFlows = [-mock.totalDisbursed];
    for(let i=0; i<12; i++) {
        simulatedCashFlows.push(mock.totalCollected / 12);
    }
    const realTIR = this.financialService.calculateTIR(simulatedCashFlows);

    return {
      ...mock,
      tir: realTIR > 0 ? realTIR : mock.tir, // Usar la calculada o la mock si falla
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
}
