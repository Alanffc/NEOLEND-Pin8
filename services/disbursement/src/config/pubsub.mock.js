const { v4: uuidv4 } = require('uuid');

// Event Bus en memoria (simulando RabbitMQ exchange 'neolend.events')
const eventBus = {
  listeners: {},
  
  subscribe(routingKey, callback) {
    if (!this.listeners[routingKey]) {
      this.listeners[routingKey] = [];
    }
    this.listeners[routingKey].push(callback);
    console.log(`[PubSub Mock] Suscrito a evento: ${routingKey}`);
  },

  publish(routingKey, producer, payload) {
    const envelope = {
      eventId: uuidv4(),
      eventType: routingKey,
      aggregateId: payload.creditId || uuidv4(),
      aggregateType: 'Credit',
      version: 1,
      occurredAt: new Date().toISOString(),
      producer,
      payload,
      metadata: { correlationId: uuidv4(), causationId: uuidv4() }
    };
    
    console.log(`[PubSub Mock] Publicando evento ${routingKey}:`, envelope);
    
    if (this.listeners[routingKey]) {
      this.listeners[routingKey].forEach(cb => {
        // Simulando asincronía en el procesamiento de eventos
        setTimeout(() => cb(envelope), 100);
      });
    }
  }
};

module.exports = eventBus;
