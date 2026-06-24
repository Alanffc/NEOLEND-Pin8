const queryService = require('../services/query.service');

const getDisbursementStatus = async (req, res) => {
  try {
    const { creditId } = req.params;
    
    const status = await queryService.getDisbursementByCreditId(creditId);
    
    if (!status) {
      return res.status(404).json({ error: 'Desembolso no encontrado' });
    }
    
    res.status(200).json({ data: status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDisbursementStatus
};
