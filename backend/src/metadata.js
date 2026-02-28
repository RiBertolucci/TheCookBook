const fs = require('fs').promises;
const path = require('path');

let store = {};
let metadataPath;

async function init(rootDir) {
  metadataPath = path.join(rootDir, 'sync-metadata.json');
  try {
    const text = await fs.readFile(metadataPath, 'utf8');
    store = JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') {
      store = {};
    } else {
      throw err;
    }
  }
}

async function save() {
  if (!metadataPath) throw new Error('metadata not initialized');
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
