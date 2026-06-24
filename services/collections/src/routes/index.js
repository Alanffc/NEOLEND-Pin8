const express = require('express');
const commandController = require('../controllers/command.controller');
const queryController = require('../controllers/query.controller');

const router = express.Router();

// Commands
router.post('/commands/payment', commandController.registerPayment);
router.post('/commands/restructure', commandController.restructureDebt);

// Queries
router.get('/queries/status/:creditId', queryController.getCreditStatus);
router.get('/queries/bureau-payload/:creditId', queryController.getBureauPayload);

module.exports = router;
