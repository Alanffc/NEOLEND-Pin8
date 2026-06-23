import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio de cálculos financieros avanzados para el portal de inversionistas.
 * Implementa fórmulas financieras reales para:
 *   - TIR (Tasa Interna de Retorno) por Newton-Raphson
 *   - VAN (Valor Actual Neto)
 *   - Ratio de Sharpe
 *   - Cálculo de morosidad ponderada
 *   - Proyección de flujo de caja con modelo de pérdida esperada
 */
@Injectable()
export class FinancialCalculationService {
  private readonly logger = new Logger(FinancialCalculationService.name);

  /**
   * Calcula la TIR usando el método de Newton-Raphson.
   * @param cashFlows Array de flujos de caja (el primero es negativo = inversión)
   * @param tolerance Tolerancia para convergencia
   * @param maxIterations Máximo de iteraciones
   * @returns TIR como porcentaje
   */
  calculateTIR(cashFlows: number[], tolerance: number = 0.0001, maxIterations: number = 100): number {
    this.logger.log(`Calculando TIR para ${cashFlows.length} flujos de caja`);

    if (cashFlows.length < 2) return 0;

    let rate = 0.1; // Estimación inicial del 10%

    for (let i = 0; i < maxIterations; i++) {
      const { npv, derivative } = this.npvAndDerivative(cashFlows, rate);

      if (Math.abs(derivative) < 1e-10) break; // Evitar división por cero

      const newRate = rate - npv / derivative;

      if (Math.abs(newRate - rate) < tolerance) {
        return parseFloat((newRate * 100).toFixed(4));
      }

      rate = newRate;
    }

    return parseFloat((rate * 100).toFixed(4));
  }

  /**
   * Calcula el VAN (Valor Actual Neto).
   * @param cashFlows Array de flujos de caja
   * @param discountRate Tasa de descuento (decimal)
   * @returns VAN en USD
   */
  calculateNPV(cashFlows: number[], discountRate: number): number {
    let npv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + discountRate, t);
    }
    return parseFloat(npv.toFixed(2));
  }

  /**
   * Calcula la morosidad ponderada por monto.
   * @param segments Array de { amount, overdueAmount }
   * @returns Morosidad ponderada como porcentaje
   */
  calculateWeightedDelinquency(
    segments: Array<{ totalAmount: number; overdueAmount: number }>,
  ): number {
    const totalAmount = segments.reduce((sum, s) => sum + s.totalAmount, 0);
    if (totalAmount === 0) return 0;

    const weightedOverdue = segments.reduce(
      (sum, s) => sum + (s.overdueAmount / totalAmount) * (s.overdueAmount / s.totalAmount) * 100,
      0,
    );

    return parseFloat(weightedOverdue.toFixed(2));
  }

  /**
   * Proyecta el flujo de caja futuro considerando la tasa de incumplimiento.
   * @param outstandingBalance Saldo vigente total
   * @param monthlyPaymentRate Porcentaje del saldo que se cobra mensualmente
   * @param defaultRate Tasa de incumplimiento mensual esperada
   * @param months Meses a proyectar
   */
  projectCashFlow(
    outstandingBalance: number,
    monthlyPaymentRate: number,
    defaultRate: number,
    months: number,
  ): Array<{ month: number; expectedIncome: number; expectedLoss: number; netFlow: number }> {
    this.logger.log(`Proyectando flujo de caja a ${months} meses`);
    const projections = [];
    let balance = outstandingBalance;

    for (let m = 1; m <= months; m++) {
      const expectedIncome = balance * monthlyPaymentRate;
      const expectedLoss = balance * defaultRate;
      const netFlow = expectedIncome - expectedLoss;

      projections.push({
        month: m,
        expectedIncome: parseFloat(expectedIncome.toFixed(2)),
        expectedLoss: parseFloat(expectedLoss.toFixed(2)),
        netFlow: parseFloat(netFlow.toFixed(2)),
      });

      balance -= expectedIncome; // El saldo se reduce con los pagos
      balance += expectedLoss * 0.3; // Parte de la pérdida se recupera
    }

    return projections;
  }

  /**
   * Calcula el Ratio de Sharpe (riesgo-retorno).
   * @param portfolioReturn Retorno del portafolio (%)
   * @param riskFreeRate Tasa libre de riesgo (%)
   * @param standardDeviation Desviación estándar del retorno (%)
   */
  calculateSharpeRatio(
    portfolioReturn: number,
    riskFreeRate: number,
    standardDeviation: number,
  ): number {
    if (standardDeviation === 0) return 0;
    return parseFloat(((portfolioReturn - riskFreeRate) / standardDeviation).toFixed(4));
  }

  /**
   * Calcula la distribución de pérdida esperada (Expected Loss).
   * EL = PD × LGD × EAD
   * @param probabilityOfDefault Probabilidad de incumplimiento
   * @param lossGivenDefault Pérdida en caso de incumplimiento
   * @param exposureAtDefault Exposición al momento del incumplimiento
   */
  calculateExpectedLoss(
    probabilityOfDefault: number,
    lossGivenDefault: number,
    exposureAtDefault: number,
  ): number {
    return parseFloat((probabilityOfDefault * lossGivenDefault * exposureAtDefault).toFixed(2));
  }

  // ─── Helper privado ──────────────────────────────────────

  private npvAndDerivative(cashFlows: number[], rate: number) {
    let npv = 0;
    let derivative = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        derivative -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
      }
    }
    return { npv, derivative };
  }
}
