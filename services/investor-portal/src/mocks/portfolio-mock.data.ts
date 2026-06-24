import { v4 as uuidv4 } from 'uuid';

/**
 * Generador de datos mock para el portal de inversionistas.
 * Simula los eventos que vendrían de credit-ledger, disbursement y collections.
 * Se reemplazará por el consumo real del Event Bus (RabbitMQ) en integración.
 */

// IDs fijos de fondos para consistencia
const FUND_IDS = [
  'fund-latam-growth-001',
  'fund-microfinance-002',
  'fund-digital-003',
  'fund-impact-004',
  'fund-venture-005',
];

const FUND_NAMES = [
  'LatAm Growth Capital Fund',
  'MicroFinance Opportunity Fund',
  'Digital Lending Partners',
  'Impact Investment Alliance',
  'Venture Credit Solutions',
];

const SEGMENTS = ['micro', 'pequeño', 'mediano', 'grande'];

const CHANNELS = ['wallet', 'bank_transfer', 'correspondent'];

/** Genera un snapshot de portafolio mockeado para un fondo */
export function generateMockPortfolio(fundIndex: number) {
  const baseCredits = [450, 280, 620, 180, 340][fundIndex] || 300;
  const baseDisbursed = [2250000, 1400000, 5580000, 900000, 2720000][fundIndex] || 1500000;
  const collectionRate = [0.82, 0.78, 0.85, 0.72, 0.88][fundIndex] || 0.80;

  return {
    fundId: FUND_IDS[fundIndex],
    fundName: FUND_NAMES[fundIndex],
    tir: parseFloat((12.5 + Math.random() * 8).toFixed(4)),
    totalCredits: baseCredits + Math.floor(Math.random() * 50),
    totalDisbursed: baseDisbursed + Math.random() * 100000,
    totalCollected: baseDisbursed * collectionRate + Math.random() * 50000,
    delinquencyRate: parseFloat((3.5 + Math.random() * 6).toFixed(2)),
    projectedCashFlow30d: baseDisbursed * 0.12 + Math.random() * 20000,
    projectedCashFlow90d: baseDisbursed * 0.35 + Math.random() * 50000,
    riskExposure: baseDisbursed * (0.08 + Math.random() * 0.05),
    updatedAt: new Date(),
  };
}

/** Genera morosidad por segmento mockeada */
export function generateMockDelinquencyBySegment(fundId: string) {
  return SEGMENTS.map((segment) => {
    const totalCredits = Math.floor(50 + Math.random() * 200);
    const overdueCredits = Math.floor(totalCredits * (0.02 + Math.random() * 0.08));
    return {
      fundId,
      segment,
      totalCredits,
      overdueCredits,
      delinquencyRate: parseFloat(((overdueCredits / totalCredits) * 100).toFixed(2)),
      amountAtRisk: overdueCredits * (200 + Math.random() * 800),
    };
  });
}

/** Genera proyecciones de flujo de caja mockeadas */
export function generateMockCashFlowProjections(totalDisbursed: number) {
  return [
    {
      period: '30d',
      expectedIncome: totalDisbursed * 0.12,
      expectedDefaults: totalDisbursed * 0.015,
      netCashFlow: totalDisbursed * 0.105,
    },
    {
      period: '60d',
      expectedIncome: totalDisbursed * 0.24,
      expectedDefaults: totalDisbursed * 0.028,
      netCashFlow: totalDisbursed * 0.212,
    },
    {
      period: '90d',
      expectedIncome: totalDisbursed * 0.36,
      expectedDefaults: totalDisbursed * 0.04,
      netCashFlow: totalDisbursed * 0.32,
    },
  ];
}

/** Genera métricas históricas (últimos 12 meses) */
export function generateMockHistoricalMetrics() {
  const metrics = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    metrics.push({
      date: date.toISOString().slice(0, 7), // YYYY-MM
      tir: parseFloat((10 + i * 0.5 + Math.random() * 3).toFixed(2)),
      delinquencyRate: parseFloat((8 - i * 0.3 + Math.random() * 2).toFixed(2)),
      totalDisbursed: 500000 + i * 200000 + Math.random() * 100000,
      totalCollected: 400000 + i * 180000 + Math.random() * 80000,
    });
  }

  return metrics;
}

/** Genera distribución de créditos por estado */
export function generateMockCreditDistribution(totalCredits: number) {
  const activo = Math.floor(totalCredits * 0.55);
  const pagado = Math.floor(totalCredits * 0.25);
  const enMora = Math.floor(totalCredits * 0.12);
  const reestructurado = totalCredits - activo - pagado - enMora;

  return [
    {
      status: 'activo',
      count: activo,
      amount: activo * 450,
      percentage: parseFloat(((activo / totalCredits) * 100).toFixed(1)),
    },
    {
      status: 'pagado',
      count: pagado,
      amount: pagado * 380,
      percentage: parseFloat(((pagado / totalCredits) * 100).toFixed(1)),
    },
    {
      status: 'en_mora',
      count: enMora,
      amount: enMora * 520,
      percentage: parseFloat(((enMora / totalCredits) * 100).toFixed(1)),
    },
    {
      status: 'reestructurado',
      count: reestructurado,
      amount: reestructurado * 600,
      percentage: parseFloat(((reestructurado / totalCredits) * 100).toFixed(1)),
    },
  ];
}

/** Genera eventos simulados del Event Bus (para probar el consumer) */
export function generateMockCreditEvents(count: number = 50) {
  const events = [];

  for (let i = 0; i < count; i++) {
    const fundIndex = Math.floor(Math.random() * FUND_IDS.length);
    const eventTypes = ['credit.approved', 'disbursement.completed', 'payment.received', 'payment.overdue'];
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const creditId = `credit-${uuidv4().slice(0, 8)}`;

    const baseEvent = {
      eventId: uuidv4(),
      eventType,
      aggregateId: creditId,
      aggregateType: 'Credit',
      version: 1,
      occurredAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      producer: eventType.split('.')[0] === 'credit' ? 'credit-ledger' :
                eventType.split('.')[0] === 'disbursement' ? 'disbursement' : 'collections',
      metadata: {
        correlationId: uuidv4(),
        causationId: uuidv4(),
      },
    };

    let payload: Record<string, any> = {};

    switch (eventType) {
      case 'credit.approved':
        payload = {
          creditId,
          amount: 100 + Math.random() * 4900,
          terms: {
            months: [3, 6, 12, 18, 24][Math.floor(Math.random() * 5)],
            interestRate: 12 + Math.random() * 18,
            monthlyPayment: 50 + Math.random() * 300,
          },
          applicantId: `applicant-${uuidv4().slice(0, 8)}`,
          fundId: FUND_IDS[fundIndex],
          segment: SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)],
        };
        break;
      case 'disbursement.completed':
        payload = {
          creditId,
          channel: CHANNELS[Math.floor(Math.random() * CHANNELS.length)],
          amount: 100 + Math.random() * 4900,
          fundId: FUND_IDS[fundIndex],
        };
        break;
      case 'payment.received':
        payload = {
          creditId,
          amount: 30 + Math.random() * 300,
          fundId: FUND_IDS[fundIndex],
          paymentNumber: Math.floor(1 + Math.random() * 12),
          remainingBalance: Math.random() * 3000,
        };
        break;
      case 'payment.overdue':
        payload = {
          creditId,
          daysLate: Math.floor(1 + Math.random() * 90),
          amount: 50 + Math.random() * 400,
          fundId: FUND_IDS[fundIndex],
        };
        break;
    }

    events.push({ ...baseEvent, payload });
  }

  return events;
}

/** Lista de fondos disponibles */
export function getMockFunds() {
  return FUND_IDS.map((id, idx) => ({
    fundId: id,
    fundName: FUND_NAMES[idx],
    totalInvested: [5000000, 3000000, 8000000, 2000000, 4500000][idx],
    status: 'activo',
  }));
}
