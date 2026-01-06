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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware for rating-options
app.use('/api/rating-options', (req, res, next) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 [SERVER] ===== RATING OPTIONS ROUTE HIT =====');
  console.log('🔍 [SERVER] Method:', req.method);
  console.log('🔍 [SERVER] URL:', req.url);
  console.log('🔍 [SERVER] Path:', req.path);
  console.log('🔍 [SERVER] Full URL:', req.originalUrl);
  console.log('🔍 [SERVER] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 [SERVER] Timestamp:', new Date().toISOString());
  console.log('🔍 [SERVER] This middleware runs BEFORE route handlers');
  console.log('═══════════════════════════════════════════════════════════');
  next();
});

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
// Register rating options routes
const ratingOptionsRouter = require('./routes/ratingOptions');
app.use('/api/rating-options', ratingOptionsRouter);

// Debug: Log registered routes after registration
console.log('🔍 [SERVER] Rating options router registered');
console.log('🔍 [SERVER] Router stack length:', ratingOptionsRouter.stack?.length || 0);
if (ratingOptionsRouter.stack) {
  ratingOptionsRouter.stack.forEach((layer, idx) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(', ');
      console.log(`🔍 [SERVER] Route ${idx + 1}: ${methods} ${layer.route.path}`);
    }
  });
}

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
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS allowed origins:`, allowedOrigins);
  console.log(`📡 Rating options route: /api/rating-options`);
  console.log(`📡 Rating options test route: /api/rating-options/test`);
  console.log(`📡 Rating options POST route: /api/rating-options (POST)`);
  console.log(`📡 Rating options PUT route: /api/rating-options/:id (PUT)`);
  console.log(`📡 Rating options DELETE route: /api/rating-options/:id (DELETE)`);
  
  // Verify rating options routes are loaded
  try {
    const ratingOptionsRouter = require('./routes/ratingOptions');
    console.log('✅ Rating options router loaded successfully');
    console.log('✅ Router type:', typeof ratingOptionsRouter);
  } catch (error) {
    console.error('❌ Failed to load rating options router:', error);
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  
  // Start schedulers
  startSchedulers();
});

module.exports = app;

