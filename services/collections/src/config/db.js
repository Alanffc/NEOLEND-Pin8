// Mock DB connection para CQRS
let mockDbInstance = {
  credits: [], // Estado de los créditos
  payments: [], // Historial de pagos
  agreements: [] // Acuerdos de reestructuración
};

const connectDB = () => {
  console.log('[DB] Conectado a la base de datos de Cobranza (Mock)');
};

const getDb = () => mockDbInstance;

module.exports = { connectDB, getDb };
