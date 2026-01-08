import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startSchedulers } from './services/schedulerService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import authRouter from './routes/auth.js';
import companiesRouter from './routes/companies.js';
import employeesRouter from './routes/employees.js';
import usersRouter from './routes/users.js';
import kpisRouter from './routes/kpis.js';
import kpiAcknowledgementRouter from './routes/kpiAcknowledgement.js';
import kpiReviewRouter from './routes/kpiReview.js';
import notificationsRouter from './routes/notifications.js';
import settingsRouter from './routes/settings.js';
import departmentsRouter from './routes/departments.js';
import emailTemplatesRouter from './routes/emailTemplates.js';
import meetingsRouter from './routes/meetings.js';
import powerAutomateRouter from './routes/powerAutomate.js';
import kpiTemplatesRouter from './routes/kpiTemplates.js';
import ratingOptionsRouter from './routes/ratingOptions.js';

app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/users', usersRouter);
app.use('/api/kpis', kpisRouter);
app.use('/api/kpi-acknowledgement', kpiAcknowledgementRouter);
app.use('/api/kpi-review', kpiReviewRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/email-templates', emailTemplatesRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/power-automate', powerAutomateRouter);
app.use('/api/kpi-templates', kpiTemplatesRouter);
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
  console.log('✅ Rating options router loaded successfully');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Start schedulers
  startSchedulers();
});

export default app;

