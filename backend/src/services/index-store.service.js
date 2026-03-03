const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const adapters = require('./index-adapters/registry');
const { validateAdapters } = require('./index-validator');
const { normalizeRelativePath } = require('../utils/content-path.utils');

const contentRoot = path.resolve(__dirname, '../../content');
const indexesRoot = path.join(contentRoot, '.indexes');

const loadedIndexes = new Map();
let initializationPromise = null;
let adaptersValidated = false;

function normalizePathForIndex(relativePath) {
  return normalizeRelativePath(relativePath || '');
}

function normalizeSetValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function ensureAdaptersValid() {
  if (adaptersValidated) return;

  validateAdapters(adapters);

  adaptersValidated = true;
  logger.info({ service: 'indexStore', method: 'ensureAdaptersValid', data: adapters.length }, 'index adapter schema validation passed');
}

function createEmptyIndex(adapter) {
  return {
    name: adapter.name,
    version: adapter.version,
    strategy: adapter.strategy || 'key-set',
    updatedAt: new Date().toISOString(),
    entries: {}
  };
}

function getAdapterByName(indexName) {
  return adapters.find((adapter) => adapter.name === indexName) || null;
}

function getIndexFilePath(adapter) {
  return path.join(indexesRoot, adapter.fileName);
}

function ensureInsideContentRoot(absolutePath) {
  if (!absolutePath.startsWith(contentRoot)) {
    throw new Error('Invalid index path outside content root');
  }
}

async function ensureIndexDirectory() {
  await fs.mkdir(indexesRoot, { recursive: true });
}

async function readIndexFromDisk(adapter) {
  const indexFilePath = getIndexFilePath(adapter);
  try {
    const raw = await fs.readFile(indexFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') {
      return null;
    }

    const entries = {};
    for (const [key, values] of Object.entries(parsed.entries || {})) {
      if (!Array.isArray(values)) continue;
      const normalizedValues = values
        .map((value) => normalizeSetValue(value))
        .filter(Boolean);
      entries[String(key)] = Array.from(new Set(normalizedValues)).sort();
    }

    return {
      name: adapter.name,
      version: adapter.version,
      strategy: adapter.strategy || 'key-set',
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      entries
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return null;
    }
    logger.warn({ service: 'indexStore', method: 'readIndexFromDisk', data: err.message }, 'index file invalid, rebuilding');
    return null;
  }
}

async function writeIndexToDisk(adapter, indexData) {
  const indexFilePath = getIndexFilePath(adapter);
  const serialized = JSON.stringify(
    {
      name: indexData.name,
      version: indexData.version,
      strategy: indexData.strategy,
      updatedAt: new Date().toISOString(),
      entries: indexData.entries
    },
    null,
    2
  ) + '\n';

  await fs.writeFile(indexFilePath, serialized, 'utf8');
}

async function collectMarkdownFilesRecursively(startDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.indexes') {
        continue;
      }

      const absoluteEntryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absoluteEntryPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const relative = path.relative(contentRoot, absoluteEntryPath).split(path.sep).join('/');
      files.push(relative);
    }
  }

  await walk(startDir);
  return files;
}

async function rebuildAllIndexesInternal() {
  ensureAdaptersValid();
  await ensureIndexDirectory();

  const markdownFiles = await collectMarkdownFilesRecursively(contentRoot);
  const nextIndexes = new Map();

  for (const adapter of adapters) {
    nextIndexes.set(adapter.name, createEmptyIndex(adapter));
  }

  for (const relativeFilePath of markdownFiles) {
    const absoluteFilePath = path.resolve(contentRoot, relativeFilePath);
    ensureInsideContentRoot(absoluteFilePath);
    const markdown = await fs.readFile(absoluteFilePath, 'utf8');

    for (const adapter of adapters) {
      if (!adapter.matchesFile(relativeFilePath)) continue;

      const key = adapter.keyFromRelativePath(relativeFilePath);
      const valueNormalizer = adapter.normalizeValue || normalizeSetValue;
      const values = Array.from(new Set((adapter.preprocess(markdown, relativeFilePath) || [])
        .map((value) => valueNormalizer(value))
        .filter(Boolean))).sort();

      const indexData = nextIndexes.get(adapter.name);
      indexData.entries[key] = values;
    }
  }

  for (const adapter of adapters) {
    const indexData = nextIndexes.get(adapter.name);
    await writeIndexToDisk(adapter, indexData);
    loadedIndexes.set(adapter.name, indexData);
  }

  logger.info({ service: 'indexStore', method: 'rebuildAllIndexesInternal' }, 'all indexes rebuilt');
}

async function ensureInitialized() {
  ensureAdaptersValid();

  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = (async () => {
    await ensureIndexDirectory();

    let hasMissingIndex = false;
    for (const adapter of adapters) {
      const indexData = await readIndexFromDisk(adapter);
      if (!indexData) {
        hasMissingIndex = true;
        continue;
      }
      loadedIndexes.set(adapter.name, indexData);
    }

    if (hasMissingIndex || loadedIndexes.size !== adapters.length) {
      await rebuildAllIndexesInternal();
    }
  })();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

async function persistIndexByName(indexName) {
  const adapter = getAdapterByName(indexName);
  if (!adapter) {
    throw new Error(`Unknown index: ${indexName}`);
  }

  const indexData = loadedIndexes.get(indexName) || createEmptyIndex(adapter);
  loadedIndexes.set(indexName, indexData);
  await writeIndexToDisk(adapter, indexData);
}

async function refreshFile(relativeFilePath) {
  await ensureInitialized();

  const normalizedRelativePath = normalizePathForIndex(relativeFilePath);
  if (!normalizedRelativePath || !normalizedRelativePath.toLowerCase().endsWith('.md')) {
    return;
  }

  const absoluteFilePath = path.resolve(contentRoot, normalizedRelativePath);
  ensureInsideContentRoot(absoluteFilePath);

  let markdown = '';
  try {
    markdown = await fs.readFile(absoluteFilePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      logger.warn({ service: 'indexStore', method: 'refreshFile', data: normalizedRelativePath }, 'file not found while refreshing index entry');
      return;
    }
    throw err;
  }

  const changedIndexes = new Set();

  for (const adapter of adapters) {
    const indexData = loadedIndexes.get(adapter.name) || createEmptyIndex(adapter);
    loadedIndexes.set(adapter.name, indexData);

    const key = adapter.keyFromRelativePath(normalizedRelativePath);
    if (!adapter.matchesFile(normalizedRelativePath)) {
      if (Object.prototype.hasOwnProperty.call(indexData.entries, key)) {
        delete indexData.entries[key];
        changedIndexes.add(adapter.name);
      }
      continue;
    }

    const valueNormalizer = adapter.normalizeValue || normalizeSetValue;
    const values = Array.from(new Set((adapter.preprocess(markdown, normalizedRelativePath) || [])
      .map((value) => valueNormalizer(value))
      .filter(Boolean))).sort();

    const currentSerialized = JSON.stringify(indexData.entries[key] || []);
    const nextSerialized = JSON.stringify(values);

    if (currentSerialized !== nextSerialized) {
      indexData.entries[key] = values;
      changedIndexes.add(adapter.name);
    }
  }

  for (const indexName of changedIndexes) {
    await persistIndexByName(indexName);
  }
}

async function removeFile(relativeFilePath) {
  await ensureInitialized();

  const normalizedRelativePath = normalizePathForIndex(relativeFilePath);
  if (!normalizedRelativePath) return;

  const changedIndexes = new Set();

  for (const adapter of adapters) {
    const indexData = loadedIndexes.get(adapter.name) || createEmptyIndex(adapter);
    loadedIndexes.set(adapter.name, indexData);

    const key = adapter.keyFromRelativePath(normalizedRelativePath);
    if (Object.prototype.hasOwnProperty.call(indexData.entries, key)) {
      delete indexData.entries[key];
      changedIndexes.add(adapter.name);
    }
  }

  for (const indexName of changedIndexes) {
    await persistIndexByName(indexName);
  }
}

async function removeByPrefix(relativePathPrefix) {
  await ensureInitialized();

  const normalizedPrefix = normalizePathForIndex(relativePathPrefix);
  if (!normalizedPrefix) return;

  const prefixWithSlash = `${normalizedPrefix}/`;
  const changedIndexes = new Set();

  for (const adapter of adapters) {
    if (adapter.keyType !== 'path') continue;

    const indexData = loadedIndexes.get(adapter.name) || createEmptyIndex(adapter);
    loadedIndexes.set(adapter.name, indexData);

    for (const key of Object.keys(indexData.entries)) {
      if (key === normalizedPrefix || key.startsWith(prefixWithSlash)) {
        delete indexData.entries[key];
        changedIndexes.add(adapter.name);
      }
    }
  }

  for (const indexName of changedIndexes) {
    await persistIndexByName(indexName);
  }
}

async function rebuildAllIndexes() {
  await rebuildAllIndexesInternal();
}

async function getIndexSnapshot(indexName) {
  await ensureInitialized();

  const adapter = getAdapterByName(indexName);
  if (!adapter) {
    throw new Error(`Unknown index: ${indexName}`);
  }

  const indexData = loadedIndexes.get(indexName) || createEmptyIndex(adapter);
  return JSON.parse(JSON.stringify(indexData));
}

function listIndexes() {
  return adapters.map((adapter) => ({
    name: adapter.name,
    version: adapter.version,
    strategy: adapter.strategy || 'key-set'
  }));
}

module.exports = {
  ensureInitialized,
  refreshFile,
  removeFile,
  removeByPrefix,
  rebuildAllIndexes,
  getIndexSnapshot,
  listIndexes
};
