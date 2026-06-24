const { getDb } = require('../config/db');

const getDisbursementByCreditId = async (creditId) => {
  const db = getDb();
  // Consulta optimizada para lectura en modelo CQRS
  return db.disbursements.find(d => d.creditId === creditId);
};

module.exports = {
  getDisbursementByCreditId
};
