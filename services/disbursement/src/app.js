const express = require('express');
const routes = require('./routes');
const { connectDB } = require('./config/db');
const eventHandler = require('./services/eventHandler.service');

const app = express();
app.use(express.json());

// Init DB (mock)
connectDB();

// Init Event Listeners
eventHandler.init();

// Routes
app.use('/api', routes);

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`[Disbursement Service] listening on port ${PORT}`);
});
