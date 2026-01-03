const express = require('express');
const cors = require('cors');
const { startSchedulers } = require('./services/schedulerService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/kpis', require('./routes/kpis'));
app.use('/api/kpi-acknowledgement', require('./routes/kpiAcknowledgement'));
app.use('/api/kpi-review', require('./routes/kpiReview'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/email-templates', require('./routes/emailTemplates'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/power-automate', require('./routes/powerAutomate'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'KPI Management API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start schedulers
  startSchedulers();
});

module.exports = app;

