const express = require('express');
const commandController = require('../controllers/command.controller');
const queryController = require('../controllers/query.controller');

const router = express.Router();

// Commands (Writes)
router.post('/commands/disburse', commandController.triggerDisbursement);

// Queries (Reads)
router.get('/queries/disbursement/:creditId', queryController.getDisbursementStatus);

module.exports = router;
