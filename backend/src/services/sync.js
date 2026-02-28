const fs = require('fs').promises;
const path = require('path');

/**
 * Synchronization module for scanning markdown folders and updating links.
 *
 * Coordinates scanning and linking of markdown files using the linker service.
 */

const metadata = require('./metadata');
const linker = require('./linker');
const logger = require('./logger');
let _rootDir = null;

async function run(rootDir) {
  logger.info({ service: 'sync', method: 'run', data: rootDir }, 'starting synchronization');
  // Prepare metadata store using new service
  _rootDir = rootDir;
  await metadata.init(rootDir);

  const folders = ['Recipes', 'Ingredients', 'SpicesAndHerbs'];
  for (const folder of folders) {
    const dirPath = path.join(rootDir, folder);
    logger.debug({ service: 'sync', method: 'run', data: folder }, 'scanning folder');
    await scanDirectory(dirPath);
  }

  // Persist metadata after scanning
  await metadata.save();
  logger.info({ service: 'sync', method: 'run' }, 'sync complete');
}

// additional helpers will go here later (parseFile, updateLinks, etc.)

module.exports = {
  run,
};

async function scanDirectory(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await scanDirectory(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        await processFile(path.join(dir, entry.name));
      }
    }
  } catch (err) {
    console.warn(`Failed to read directory ${dir}:`, err.message);
  }
}

async function processFile(filePath) {
  // inspect file stats
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (err) {
    console.warn(`Unable to stat ${filePath}:`, err.message);
    return;
  }

  const result = metadata.checkFile(_rootDir, filePath, stats);
  switch (result.status) {
    case 'new':
      logger.info({ service: 'sync', method: 'processFile', data: path.relative(_rootDir, filePath) }, 'new file detected');
      try {
        await linker.processNewFile(filePath, _rootDir);
      } catch (err) {
        logger.error({ service: 'sync', method: 'processFile', data: err.message }, `Error processing new file ${filePath}`);
      }
      break;
    case 'modified':
      logger.info({ service: 'sync', method: 'processFile', data: path.relative(_rootDir, filePath) }, 'modified file');
      // TODO: re-parse and update links for modified files
      break;
    case 'unchanged':
      logger.debug({ service: 'sync', method: 'processFile', data: path.relative(_rootDir, filePath) }, 'unchanged file');
      break;
  }
}

module.exports = {
  run,
};
