const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    logger.warn('Authentication failed: No API key provided', {
      ip: req.ip,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ error: 'API key required' });
  }

  if (apiKey !== process.env.API_KEY) {
    logger.warn('Authentication failed: Invalid API key', {
      ip: req.ip,
      url: req.originalUrl,
      providedKey: apiKey.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });
    return res.status(401).json({ error: 'Invalid API key' });
  }

  logger.debug('Authentication successful', {
    ip: req.ip,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
  
  next();
};

module.exports = authMiddleware;