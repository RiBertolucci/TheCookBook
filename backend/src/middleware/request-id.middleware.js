const { randomUUID } = require('crypto');
const logger = require('../services/logger');

function requestIdMiddleware(req, res, next) {
  req.requestId = randomUUID();
  logger.info({ service: 'server', method: `${req.method} ${req.path}`, requestId: req.requestId }, 'incoming request');
  next();
}

module.exports = requestIdMiddleware;
