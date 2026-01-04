const express = require('express');
const cors = require('cors');
const { startSchedulers } = require('./services/schedulerService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  'https://determined-magenta-raccoon.84-16-249-171.cpanel.site',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Log CORS configuration on startup
console.log('🌐 CORS allowed origins:', allowedOrigins);

// Middleware
app.use(cors(corsOptions));

// Explicit OPTIONS handler for preflight
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
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
app.use('/api/rating-options', require('./routes/ratingOptions'));

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

