const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Health check endpoint
router.get('/', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0'
  };
  
  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    healthcheck.message = 'ERROR';
    res.status(503).json(healthcheck);
  }
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      duckdb: 'unknown',
      aws: 'unknown',
      slack: 'unknown'
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  // TODO: Add actual health checks for dependencies
  // For now, just return basic status
  res.status(200).json(health);
});

module.exports = router;