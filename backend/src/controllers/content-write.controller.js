const logger = require('../services/logger');
const storage = require('../services/content-storage.service');
const indexStore = require('../services/index-store.service');
const telegramShopping = require('../services/telegram-shopping.service');
const {
  mapSectionToFolder
} = require('../utils/content-path.utils');

async function syncIndexesSafely(requestId, operation, actionLabel) {
  try {
    await operation();
  } catch (err) {
    logger.error(
      { service: 'server', method: actionLabel, requestId, data: err.message },
      'index update failed, trying full rebuild'
    );

    try {
      await indexStore.rebuildAllIndexes();
      logger.warn(
        { service: 'server', method: actionLabel, requestId },
        'index rebuild completed after update failure'
      );
    } catch (rebuildErr) {
      logger.error(
        { service: 'server', method: actionLabel, requestId, data: rebuildErr.message },
        'index rebuild failed'
      );
    }
  }
}

async function addFile(req, res) {
  const { path: targetPath, title, markdown } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!markdown || !String(markdown).trim()) {
    return res.status(400).json({ error: 'markdown is required' });
  }

  try {
    const relativeFile = await storage.createMarkdownFile({
      targetPath,
      title,
      markdown
    });
    logger.info(
      { service: 'server', method: 'POST /api/addFile', requestId: req.requestId, data: relativeFile },
      'content file created'
    );

    await syncIndexesSafely(req.requestId, () => indexStore.refreshFile(relativeFile), 'POST /api/addFile');

    res.status(201).json({ status: 'ok', file: relativeFile });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error({ service: 'server', method: 'POST /api/addFile', requestId: req.requestId, data: err.message }, 'create content failed');
    res.status(500).json({ error: err.message });
  }
}

async function updateFile(req, res) {
  const { section, filename, markdown } = req.body || {};

  const sectionFolder = mapSectionToFolder(section);
  if (!sectionFolder) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  if (!filename || !String(filename).trim()) {
    return res.status(400).json({ error: 'filename is required' });
  }
  if (!markdown || !String(markdown).trim()) {
    return res.status(400).json({ error: 'markdown is required' });
  }

  try {
    const relativeFile = await storage.updateMarkdownFile({
      sectionFolder,
      filename,
      markdown
    });
    logger.info(
      { service: 'server', method: 'POST /api/updateFile', requestId: req.requestId, data: relativeFile },
      'content file updated'
    );

    await syncIndexesSafely(req.requestId, () => indexStore.refreshFile(relativeFile), 'POST /api/updateFile');

    res.json({ status: 'ok', file: relativeFile });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error({ service: 'server', method: 'POST /api/updateFile', requestId: req.requestId, data: err.message }, 'update content failed');
    res.status(500).json({ error: err.message });
  }
}

async function deleteFile(req, res) {
  const { section, filename } = req.body || {};

  const sectionFolder = mapSectionToFolder(section);
  if (!sectionFolder) {
    return res.status(400).json({ error: 'Invalid section' });
  }
  if (!filename || !String(filename).trim()) {
    return res.status(400).json({ error: 'filename is required' });
  }

  try {
    const deletedRef = await storage.deleteMarkdownFile({
      sectionFolder,
      filename
    });

    logger.info(
      { service: 'server', method: 'POST /api/deleteFile', requestId: req.requestId, data: deletedRef },
      'content file deleted'
    );

    res.json({ status: 'ok' });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error({ service: 'server', method: 'POST /api/deleteFile', requestId: req.requestId, data: err.message }, 'delete content failed');
    res.status(500).json({ error: err.message });
  }
}

async function deleteFolder(req, res) {
  const { path: folderPath } = req.body || {};

  if (!folderPath || !String(folderPath).trim()) {
    return res.status(400).json({ error: 'path is required' });
  }

  try {
    const safePath = await storage.deleteFolderTree({ folderPath });

    logger.info(
      { service: 'server', method: 'POST /api/deleteFolder', requestId: req.requestId, data: safePath },
      'folder hierarchy deleted'
    );

    res.json({ status: 'ok' });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    logger.error({ service: 'server', method: 'POST /api/deleteFolder', requestId: req.requestId, data: err.message }, 'delete folder failed');
    res.status(500).json({ error: err.message });
  }
}

async function sendShoppingListToTelegram(req, res) {
  const rawItems = req.body && Array.isArray(req.body.items) ? req.body.items : null;
  const targetId = req.body ? String(req.body.targetId || '').trim() : '';

  if (!rawItems || rawItems.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const items = rawItems
    .map((item) => String(item || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  if (items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }

  if (!targetId) {
    return res.status(400).json({ error: 'targetId is required' });
  }

  try {
    const result = await telegramShopping.sendShoppingListToTelegram(items, targetId);
    logger.info(
      { service: 'server', method: 'POST /api/shopping-list/telegram', requestId: req.requestId, data: { count: items.length, targetId } },
      'shopping list sent to telegram'
    );
    res.json({ status: 'ok', messageId: result.messageId, targetId: result.targetId, targetName: result.targetName });
  } catch (err) {
    const errorCode = err && err.code ? err.code : 'UNKNOWN';

    if (errorCode === 'MISSING_TELEGRAM_CONFIG') {
      logger.error(
        { service: 'server', method: 'POST /api/shopping-list/telegram', requestId: req.requestId, data: err.message },
        'telegram configuration missing'
      );
      return res.status(500).json({ error: err.message });
    }

    if (errorCode === 'TELEGRAM_API_ERROR') {
      logger.error(
        { service: 'server', method: 'POST /api/shopping-list/telegram', requestId: req.requestId, data: err.message },
        'telegram api request failed'
      );
      return res.status(502).json({ error: err.message });
    }

    if (errorCode === 'TARGET_NOT_FOUND' || errorCode === 'INVALID_TELEGRAM_TARGETS_CONFIG') {
      return res.status(400).json({ error: err.message });
    }

    logger.error(
      { service: 'server', method: 'POST /api/shopping-list/telegram', requestId: req.requestId, data: err.message },
      'shopping list telegram send failed'
    );
    return res.status(500).json({ error: err.message });
  }
}

async function getLastSentShoppingList(req, res) {
  const targetId = String((req.query && req.query.targetId) || '').trim();

  if (!targetId) {
    return res.status(400).json({ error: 'targetId is required' });
  }

  try {
    const result = await telegramShopping.getLastSentShoppingList(targetId);
    return res.json({ status: 'ok', ...result });
  } catch (err) {
    const errorCode = err && err.code ? err.code : 'UNKNOWN';

    if (errorCode === 'NO_LAST_SHOPPING_LIST') {
      return res.status(404).json({ error: err.message });
    }

    if (errorCode === 'TARGET_NOT_FOUND' || errorCode === 'INVALID_TELEGRAM_TARGETS_CONFIG') {
      return res.status(400).json({ error: err.message });
    }

    logger.error(
      { service: 'server', method: 'GET /api/shopping-list/telegram/last', requestId: req.requestId, data: err.message },
      'failed to read last sent shopping list'
    );
    return res.status(500).json({ error: err.message });
  }
}

async function getTelegramTargets(req, res) {
  try {
    const targets = telegramShopping.getTelegramTargets();
    return res.json({ status: 'ok', targets });
  } catch (err) {
    const errorCode = err && err.code ? err.code : 'UNKNOWN';

    if (errorCode === 'MISSING_TELEGRAM_CONFIG' || errorCode === 'INVALID_TELEGRAM_TARGETS_CONFIG') {
      return res.status(400).json({ error: err.message });
    }

    logger.error(
      { service: 'server', method: 'GET /api/shopping-list/telegram/targets', requestId: req.requestId, data: err.message },
      'failed to load telegram targets'
    );
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  addFile,
  updateFile,
  deleteFile,
  deleteFolder,
  sendShoppingListToTelegram,
  getLastSentShoppingList,
  getTelegramTargets
};
