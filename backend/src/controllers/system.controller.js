const path = require('path');
const sync = require('../services/sync');
const logger = require('../services/logger');

const contentRoot = path.resolve(__dirname, '../../content');

async function healthCheck(req, res) {
  logger.info({ service: 'server', method: 'GET /', requestId: req.requestId }, 'health check');
  res.send('TheCookBook backend is running');
}

async function syncContent(req, res) {
  logger.info({ service: 'sync', method: `POST ${req.path}`, requestId: req.requestId }, 'sync requested');
  try {
    await sync.run(contentRoot);
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error({ service: 'sync', method: `POST ${req.path}`, requestId: req.requestId, data: err.message }, 'Sync error');
    res.status(500).json({ status: 'error', message: err.message });
  }
}

module.exports = {
  healthCheck,
  syncContent
};
