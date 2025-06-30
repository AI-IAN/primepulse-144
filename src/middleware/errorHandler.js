const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: 'Internal server error',
      requestId: req.id || 'unknown'
    });
  }

  res.status(err.status || 500).json({
    error: err.message,
    stack: err.stack,
    requestId: req.id || 'unknown'
  });
};

module.exports = errorHandler;