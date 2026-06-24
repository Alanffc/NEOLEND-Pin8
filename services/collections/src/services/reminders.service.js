const scheduleReminder = (creditId, type, date) => {
  console.log(`[Reminders Service] Programando recordatorio tipo ${type} para el crédito ${creditId} en la fecha ${date}`);
  
  // Simulación automática de ejecución del recordatorio programado
  setTimeout(() => {
    sendMockNotification(creditId, ['whatsapp', 'sms', 'email']);
  }, 5000);
};

const sendMockNotification = (creditId, channels) => {
  console.log(`[Reminders Service] Ejecutando envíos automáticos para el crédito ${creditId}...`);
  channels.forEach(channel => {
    console.log(` > [Mock ${channel.toUpperCase()}] Notificación enviada al cliente.`);
  });
};

const cancelReminders = (creditId) => {
  console.log(`[Reminders Service] Recordatorios cancelados/reprogramados para crédito ${creditId} por pago recibido.`);
};

module.exports = {
  scheduleReminder,
  sendMockNotification,
  cancelReminders
};
