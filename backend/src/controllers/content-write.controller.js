const logger = require('../services/logger');
const storage = require('../services/content-storage.service');
const indexStore = require('../services/index-store.service');
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

module.exports = {
  addFile,
  updateFile,
  deleteFile,
  deleteFolder
};
