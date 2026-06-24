const commandService = require('../services/command.service');

const triggerDisbursement = async (req, res) => {
  try {
    const { creditId, amount, terms, channel } = req.body;
    
    // Esto es un endpoint manual o webhook de contingencia
    const result = await commandService.executeDisbursement({ creditId, amount, terms, channel });
    
    res.status(202).json({
      message: 'Desembolso en proceso',
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  triggerDisbursement
};
