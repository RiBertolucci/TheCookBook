const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

let store = {};
let metadataPath;

async function init(rootDir) {
  logger.info({ service: 'metadata', method: 'init', data: rootDir }, 'initializing metadata store');
  metadataPath = path.join(rootDir, 'sync-metadata.json');
  try {
    const text = await fs.readFile(metadataPath, 'utf8');
    store = JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.debug({ service: 'metadata', method: 'init' }, 'metadata file not found, starting fresh');
      store = {};
    } else {
      logger.error({ service: 'metadata', method: 'init', data: err.message }, 'error initializing metadata');
      throw err;
    }
  }
}

async function save() {
  logger.info({ service: 'metadata', method: 'save' }, 'saving metadata to disk');
  if (!metadataPath) {
    const err = new Error('metadata not initialized');
    logger.error({ service: 'metadata', method: 'save', data: err.message }, 'save failed');
    throw err;
  }
  await fs.writeFile(metadataPath, JSON.stringify(store, null, 2));
}

function _relative(rootDir, filePath) {
  return path.relative(rootDir, filePath);
}

/**
 * Record or update a file entry based on its stats.  Returns an object
 * indicating the type of change: 'new', 'modified', or 'unchanged'.
 */
function checkFile(rootDir, filePath, stats) {
  const rel = _relative(rootDir, filePath);
  logger.debug({ service: 'metadata', method: 'checkFile', data: rel }, 'checking file metadata');
  const mtime = stats.mtime.toISOString();
  const existing = store[rel];
  if (!existing) {
    store[rel] = {
      created: stats.birthtime.toISOString(),
      modified: mtime,
    };
    return { status: 'new', entry: store[rel] };
  }
  if (existing.modified !== mtime) {
    existing.modified = mtime;
    return { status: 'modified', entry: existing };
  }
  return { status: 'unchanged', entry: existing };
}

module.exports = {
  init,
  save,
  checkFile,
};
