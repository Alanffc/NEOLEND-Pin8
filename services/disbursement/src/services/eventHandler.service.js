const eventBus = require('../config/pubsub.mock');
const commandService = require('./command.service');

const init = () => {
  eventBus.subscribe('credit.approved', async (envelope) => {
    console.log(`[EventHandler] Recibido evento credit.approved:`, envelope.eventId);
    const { creditId, amount, terms } = envelope.payload;
    
    try {
      // Disparamos el commmand automáticamente
      await commandService.executeDisbursement({
        creditId,
        amount,
        terms,
        channel: 'digital_wallet' // Por defecto para este flujo
      });
      console.log(`[EventHandler] Procesamiento de credit.approved exitoso.`);
    } catch (error) {
      console.error(`[EventHandler] Error procesando desembolso:`, error);
    }
  });
};

module.exports = { init };
