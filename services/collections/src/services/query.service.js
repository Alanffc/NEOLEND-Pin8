const { getDb } = require('../config/db');

const getCreditStatus = async (creditId) => {
  const db = getDb();
  
  const payments = db.payments.filter(p => p.creditId === creditId);
  const agreements = db.agreements.filter(a => a.creditId === creditId);
  
  return {
    creditId,
    payments,
    agreements,
    summary: {
      totalPayments: payments.length,
      hasActiveAgreement: agreements.some(a => a.status === 'ACTIVE')
    }
  };
};

module.exports = {
  getCreditStatus
};
