const queryService = require('../services/query.service');
const bureauService = require('../services/bureau.service');

const getCreditStatus = async (req, res) => {
  try {
    const { creditId } = req.params;
    const status = await queryService.getCreditStatus(creditId);
    
    if (!status) {
      return res.status(404).json({ error: 'Crédito no encontrado en cobranza' });
    }
    
    res.status(200).json({ data: status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBureauPayload = async (req, res) => {
  try {
    const { creditId } = req.params;
    const payload = await bureauService.generateBureauReport(creditId);
    
    res.status(200).json({ data: payload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCreditStatus,
  getBureauPayload
};
