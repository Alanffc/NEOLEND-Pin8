const express = require('express');
const routes = require('./routes');
const { connectDB } = require('./config/db');

const app = express();
app.use(express.json());

// Init DB (mock)
connectDB();

// Routes
app.use('/api', routes);

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`[Collections Service] listening on port ${PORT}`);
});
