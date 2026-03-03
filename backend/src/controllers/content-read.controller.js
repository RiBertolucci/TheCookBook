const path = require('path');
const fileReader = require('../services/fileReader');
const indexStore = require('../services/index-store.service');
const logger = require('../services/logger');
const { normalizeFilenameParam } = require('../utils/content-path.utils');

const contentRoot = path.resolve(__dirname, '../../content');

async function getRecipe(req, res) {
  logger.debug({ service: 'fileReader', method: 'getRecipe', requestId: req.requestId, data: req.params.filename }, 'fetching recipe');
  try {
    const data = await fileReader.getRecipe(contentRoot, req.params.filename);
    if (!data) {
      logger.warn({ service: 'fileReader', method: 'getRecipe', requestId: req.requestId, data: req.params.filename }, 'recipe not found');
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getRecipe', requestId: req.requestId, data: err.message }, 'Error reading recipe');
    res.status(500).json({ error: err.message });
  }
}

async function getIngredient(req, res) {
  const filename = normalizeFilenameParam(req.params.filename);
  logger.debug({ service: 'fileReader', method: 'getIngredient', requestId: req.requestId, data: filename }, 'fetching ingredient');
  try {
    const data = await fileReader.getIngredient(contentRoot, filename);
    if (!data) {
      logger.warn({ service: 'fileReader', method: 'getIngredient', requestId: req.requestId, data: filename }, 'ingredient not found');
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getIngredient', requestId: req.requestId, data: err.message }, 'Error reading ingredient');
    res.status(500).json({ error: err.message });
  }
}

async function getSpice(req, res) {
  const filename = normalizeFilenameParam(req.params.filename);
  logger.debug({ service: 'fileReader', method: 'getSpice', requestId: req.requestId, data: filename }, 'fetching spice');
  try {
    const data = await fileReader.getSpice(contentRoot, filename);
    if (!data) {
      logger.warn({ service: 'fileReader', method: 'getSpice', requestId: req.requestId, data: filename }, 'spice not found');
      return res.status(404).json({ error: 'Spice or herb not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getSpice', requestId: req.requestId, data: err.message }, 'Error reading spice');
    res.status(500).json({ error: err.message });
  }
}

async function getHierarchy(req, res) {
  logger.debug({ service: 'fileReader', method: 'getContentHierarchy', requestId: req.requestId }, 'building hierarchy');
  try {
    const hierarchy = await fileReader.getContentHierarchy(contentRoot);
    res.json(hierarchy);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getContentHierarchy', requestId: req.requestId, data: err.message }, 'Error reading hierarchy');
    res.status(500).json({ error: err.message });
  }
}

async function getIndexes(req, res) {
  try {
    await indexStore.ensureInitialized();
    res.json({ indexes: indexStore.listIndexes() });
  } catch (err) {
    logger.error({ service: 'indexStore', method: 'getIndexes', requestId: req.requestId, data: err.message }, 'Error listing indexes');
    res.status(500).json({ error: err.message });
  }
}

async function getIndexByName(req, res) {
  const indexName = String(req.params.indexName || '').trim();
  if (!indexName) {
    return res.status(400).json({ error: 'indexName is required' });
  }

  try {
    const snapshot = await indexStore.getIndexSnapshot(indexName);
    res.json(snapshot);
  } catch (err) {
    if (String(err.message || '').startsWith('Unknown index:')) {
      return res.status(404).json({ error: err.message });
    }
    logger.error({ service: 'indexStore', method: 'getIndexByName', requestId: req.requestId, data: err.message }, 'Error loading index');
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getRecipe,
  getIngredient,
  getSpice,
  getHierarchy,
  getIndexes,
  getIndexByName
};
