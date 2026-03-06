const fs = require('fs').promises;
const path = require('path');
const fileReader = require('../services/fileReader');
const indexStore = require('../services/index-store.service');
const indexSearch = require('../services/index-search.service');
const ingredientFamilies = require('../services/ingredient-families.service');
const parser = require('../services/parser');
const logger = require('../services/logger');
const { normalizeFilenameParam, normalizeRelativePath } = require('../utils/content-path.utils');

const contentRoot = path.resolve(__dirname, '../../content');
const INGREDIENT_SUGGESTIONS_INDEX = 'ingredients-catalog';
const GOES_WITH_INGREDIENTS_SECTION = 'Goes with ingredients';
const GOES_WITH_SPICES_SECTION = 'Goes with spicesAndHerbs';

function toDisplayName(value) {
  const compact = String(value || '').trim().replace(/\s+/g, ' ');
  if (!compact) return '';

  return compact
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toIngredientFamiliesResponse(snapshot) {
  const catalog = ingredientFamilies.buildIngredientFamiliesFromSnapshot(snapshot);
  return {
    indexName: snapshot.name,
    updatedAt: snapshot.updatedAt || null,
    families: catalog.families
  };
}

function normalizeIngredientKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractMarkdownLabels(value) {
  const source = String(value || '').trim();
  if (!source) return [];

  const labels = [];
  const regex = /\[([^\]]+)\]\([^\)]+\)/g;
  let match = regex.exec(source);
  while (match) {
    const label = String(match[1] || '').trim();
    if (label) {
      labels.push(label);
    }
    match = regex.exec(source);
  }

  return labels.length > 0 ? labels : [source];
}

function collectPairingKeys(content, labelsByKey) {
  const sections = [GOES_WITH_INGREDIENTS_SECTION, GOES_WITH_SPICES_SECTION];
  const keys = new Set();

  for (const sectionName of sections) {
    const entries = parser.extractSection(content, sectionName);
    for (const entry of entries) {
      const labels = extractMarkdownLabels(entry);
      for (const label of labels) {
        const compact = String(label || '').trim().replace(/\s+/g, ' ');
        const key = normalizeIngredientKey(compact);
        if (!key) continue;

        if (!labelsByKey.has(key)) {
          labelsByKey.set(key, toDisplayName(compact));
        }
        keys.add(key);
      }
    }
  }

  return keys;
}

function intersectKeySets(keySets) {
  if (!Array.isArray(keySets) || keySets.length === 0) return new Set();

  const [first, ...rest] = keySets;
  const result = new Set(first);
  for (const key of Array.from(result)) {
    if (!rest.every((set) => set.has(key))) {
      result.delete(key);
    }
  }

  return result;
}

function toSafeIngredientAbsolutePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath || '');
  const absolute = path.resolve(contentRoot, normalized);
  if (!absolute.startsWith(contentRoot + path.sep) && absolute !== contentRoot) {
    throw new Error('Invalid ingredient path');
  }

  return absolute;
}

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

async function getIngredientSuggestions(req, res) {
  try {
    const snapshot = await indexStore.getIndexSnapshot(INGREDIENT_SUGGESTIONS_INDEX);
    const labelsByKey = new Map();

    for (const values of Object.values(snapshot.entries || {})) {
      for (const value of Array.isArray(values) ? values : []) {
        const key = String(value || '').trim().toLowerCase();
        if (!key || labelsByKey.has(key)) continue;
        labelsByKey.set(key, toDisplayName(key));
      }
    }

    const suggestions = Array.from(labelsByKey.values())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'it'));

    return res.json({
      indexName: snapshot.name,
      updatedAt: snapshot.updatedAt || null,
      suggestions
    });
  } catch (err) {
    if (String(err.message || '').startsWith('Unknown index:')) {
      return res.status(404).json({ error: err.message });
    }
    logger.error(
      { service: 'indexStore', method: 'getIngredientSuggestions', requestId: req.requestId, data: err.message },
      'Error loading ingredient suggestions index'
    );
    return res.status(500).json({ error: err.message });
  }
}

async function getCompatibleIngredientSuggestions(req, res) {
  const rawSelected = Array.isArray(req.query?.selected)
    ? req.query.selected
    : (req.query?.selected ? [req.query.selected] : []);

  try {
    const snapshot = await indexStore.getIndexSnapshot(INGREDIENT_SUGGESTIONS_INDEX);
    const labelsByKey = new Map();
    const ingredientPathByKey = new Map();

    for (const [relativePath, values] of Object.entries(snapshot.entries || {})) {
      const safePath = normalizeRelativePath(relativePath || '');
      for (const value of Array.isArray(values) ? values : []) {
        const key = normalizeIngredientKey(value);
        if (!key) continue;

        if (!labelsByKey.has(key)) {
          labelsByKey.set(key, toDisplayName(key));
        }
        if (!ingredientPathByKey.has(key)) {
          ingredientPathByKey.set(key, safePath);
        }
      }
    }

    const selectedKeys = Array.from(new Set(
      rawSelected
        .flatMap((value) => String(value || '').split(','))
        .map((value) => normalizeIngredientKey(value))
        .filter(Boolean)
    ));

    const selected = selectedKeys.map((key) => labelsByKey.get(key) || toDisplayName(key));

    if (selectedKeys.length === 0) {
      const suggestions = Array.from(labelsByKey.values())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, 'it'));
      return res.json({
        indexName: snapshot.name,
        updatedAt: snapshot.updatedAt || null,
        selected,
        suggestions
      });
    }

    const pairingSets = [];
    for (const selectedKey of selectedKeys) {
      const selectedPath = ingredientPathByKey.get(selectedKey);
      if (!selectedPath) {
        return res.json({
          indexName: snapshot.name,
          updatedAt: snapshot.updatedAt || null,
          selected,
          suggestions: []
        });
      }

      const absolutePath = toSafeIngredientAbsolutePath(selectedPath);
      const markdown = await fs.readFile(absolutePath, 'utf8');
      pairingSets.push(collectPairingKeys(markdown, labelsByKey));
    }

    const compatibleKeys = intersectKeySets(pairingSets);
    for (const selectedKey of selectedKeys) {
      compatibleKeys.delete(selectedKey);
    }

    const suggestions = Array.from(compatibleKeys)
      .map((key) => labelsByKey.get(key) || toDisplayName(key))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'it'));

    return res.json({
      indexName: snapshot.name,
      updatedAt: snapshot.updatedAt || null,
      selected,
      suggestions
    });
  } catch (err) {
    if (String(err.message || '').startsWith('Unknown index:')) {
      return res.status(404).json({ error: err.message });
    }
    logger.error(
      { service: 'indexStore', method: 'getCompatibleIngredientSuggestions', requestId: req.requestId, data: err.message },
      'Error loading compatible ingredient suggestions'
    );
    return res.status(500).json({ error: err.message });
  }
}

async function getIngredientFamilies(req, res) {
  try {
    const snapshot = await indexStore.getIndexSnapshot(INGREDIENT_SUGGESTIONS_INDEX);
    return res.json(toIngredientFamiliesResponse(snapshot));
  } catch (err) {
    if (String(err.message || '').startsWith('Unknown index:')) {
      return res.status(404).json({ error: err.message });
    }
    logger.error(
      { service: 'indexStore', method: 'getIngredientFamilies', requestId: req.requestId, data: err.message },
      'Error loading ingredient families'
    );
    return res.status(500).json({ error: err.message });
  }
}

async function getIngredientFamilyByName(req, res) {
  const name = String(req.params.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const snapshot = await indexStore.getIndexSnapshot(INGREDIENT_SUGGESTIONS_INDEX);
    const family = ingredientFamilies.findIngredientFamilyByName(snapshot, name);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    return res.json({
      indexName: snapshot.name,
      updatedAt: snapshot.updatedAt || null,
      family
    });
  } catch (err) {
    if (String(err.message || '').startsWith('Unknown index:')) {
      return res.status(404).json({ error: err.message });
    }
    logger.error(
      { service: 'indexStore', method: 'getIngredientFamilyByName', requestId: req.requestId, data: err.message },
      'Error loading ingredient family'
    );
    return res.status(500).json({ error: err.message });
  }
}

async function searchFilesByIndex(req, res) {
  const indexName = String(req.params.indexName || '').trim();
  if (!indexName) {
    return res.status(400).json({ error: 'indexName is required' });
  }

  const terms = Array.isArray(req.body?.terms) ? req.body.terms : [];

  try {
    const response = await indexSearch.searchFilesByIndex(indexName, terms);
    res.json(response);
  } catch (err) {
    if (String(err.message || '').startsWith('Unknown index:')) {
      return res.status(404).json({ error: err.message });
    }
    if (String(err.message || '') === 'indexName is required') {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ service: 'indexSearch', method: 'searchFilesByIndex', requestId: req.requestId, data: err.message }, 'Error searching files by index');
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getRecipe,
  getIngredient,
  getSpice,
  getHierarchy,
  getIndexes,
  getIndexByName,
  searchFilesByIndex,
  getIngredientSuggestions,
  getCompatibleIngredientSuggestions,
  getIngredientFamilies,
  getIngredientFamilyByName
};
