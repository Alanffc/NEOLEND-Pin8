const commandService = require('../services/command.service');

const registerPayment = async (req, res) => {
  try {
    const { creditId, amount } = req.body;
    const result = await commandService.processPayment({ creditId, amount });
    res.status(201).json({ message: 'Pago registrado', data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const restructureDebt = async (req, res) => {
  try {
    const { creditId, newTerms } = req.body;
    const result = await commandService.createAgreement({ creditId, newTerms });
    res.status(201).json({ message: 'Reestructuración aprobada', data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  registerPayment,
  restructureDebt
};
