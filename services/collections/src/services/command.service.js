const { getDb } = require('../config/db');
const eventBus = require('../config/pubsub.mock');
const { v4: uuidv4 } = require('uuid');
const remindersService = require('./reminders.service');

const processPayment = async ({ creditId, amount }) => {
  const db = getDb();
  
  const payment = {
    id: uuidv4(),
    creditId,
    amount,
    date: new Date().toISOString()
  };
  
  db.payments.push(payment);
  
  // Publicar evento
  eventBus.publish('payment.received', 'collections', { creditId, amount });
  
  // Detener o reprogramar recordatorios
  remindersService.cancelReminders(creditId);
  
  return payment;
};

const createAgreement = async ({ creditId, newTerms }) => {
  const db = getDb();
  
  const agreement = {
    id: uuidv4(),
    creditId,
    newTerms,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
  
  db.agreements.push(agreement);
  
  console.log(`[Command Service] Acuerdo de reestructuración creado para: ${creditId}`);
  
  return agreement;
};

module.exports = {
  processPayment,
  createAgreement
};
