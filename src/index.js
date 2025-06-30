const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const schedulerService = require('./services/scheduler');

// Routes
const asinRoutes = require('./routes/asin');
const priceRoutes = require('./routes/price');
const alertRoutes = require('./routes/alert');
const healthRoutes = require('./routes/health');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  duration: Math.floor((process.env.RATE_LIMIT_WINDOW_MS || 900000) / 1000),
});

const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({ error: 'Too Many Requests', retryAfter: secs });
  }
};

// Security middleware
app.use(helmet());
app.use(cors());
app.use(rateLimitMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/asins', authMiddleware, asinRoutes);
app.use('/api/prices', authMiddleware, priceRoutes);
app.use('/api/alerts', authMiddleware, alertRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PrimePulse 144',
    version: process.env.npm_package_version || '0.1.0',
    description: 'Amazon Prime Day price monitoring system',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await schedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await schedulerService.stop();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  logger.info(`PrimePulse 144 server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start scheduler in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
    try {
      await schedulerService.start();
      logger.info('Scheduler service started successfully');
    } catch (error) {
      logger.error('Failed to start scheduler service:', error);
    }
  }
});

module.exports = app;