const { getDb } = require('../config/db');
const eventBus = require('../config/pubsub.mock');
const { v4: uuidv4 } = require('uuid');

const executeDisbursement = async (payload) => {
  const { creditId, amount, terms, channel = 'bank_account' } = payload;
  
  console.log(`[Command Service] Iniciando desembolso para crédito: ${creditId}`);
  
  // Simulación de llamadas a integraciones externas
  await mockExternalIntegration(channel, amount);
  
  const db = getDb();
  const disbursementRecord = {
    id: uuidv4(),
    creditId,
    amount,
    channel,
    status: 'COMPLETED',
    disbursedAt: new Date().toISOString()
  };
  
  // Guardamos en nuestro modelo de escritura (Mock DB)
  db.disbursements.push(disbursementRecord);
  
  console.log(`[Command Service] Desembolso completado y guardado en DB.`);
  
  // Publicamos evento de dominio
  eventBus.publish('disbursement.completed', 'disbursement', {
    creditId,
    channel
  });
  
  return disbursementRecord;
};

const mockExternalIntegration = (channel, amount) => {
  return new Promise((resolve, reject) => {
    const supportedChannels = ['digital_wallet', 'bank_account', 'correspondent_network'];
    if (!supportedChannels.includes(channel)) {
      return reject(new Error(`Canal de desembolso no soportado: ${channel}`));
    }
    
    console.log(`[Integration] Simulando conexión con la red de ${channel} para transferir ${amount}...`);
    setTimeout(() => {
      console.log(`[Integration] Transferencia exitosa vía ${channel}`);
      resolve(true);
    }, 500);
  });
};

module.exports = {
  executeDisbursement
};
