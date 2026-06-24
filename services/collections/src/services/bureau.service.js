const { getDb } = require('../config/db');

const generateBureauReport = async (creditId) => {
  // Simula la lectura de la vista proyectada de mora
  const db = getDb();
  const payments = db.payments.filter(p => p.creditId === creditId);
  
  // Payload estándar simulado para buró (Equifax, TransUnion, Datacrédito, etc.)
  const payload = {
    reportDate: new Date().toISOString(),
    creditId,
    status: payments.length > 0 ? 'CURRENT' : 'DELINQUENT',
    daysPastDue: payments.length > 0 ? 0 : 30, // Mock lógico simple
    debtBalance: 5000, // Mock de monto
    currency: 'USD',
    bureauCode: 'BUREAU-001'
  };
  
  console.log(`[Bureau Service] Generando reporte para buró:`, payload);
  return payload;
};

module.exports = {
  generateBureauReport
};
