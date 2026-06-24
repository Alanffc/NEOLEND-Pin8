// Mock DB connection para CQRS
let mockDbInstance = {
  disbursements: [] // Colección de desembolsos
};

const connectDB = () => {
  console.log('[DB] Conectado a la base de datos de Desembolsos (Mock)');
};

const getDb = () => mockDbInstance;

module.exports = { connectDB, getDb };
