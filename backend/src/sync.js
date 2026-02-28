const fs = require('fs').promises;
const path = require('path');

/**
 * Synchronization module for scanning markdown folders and updating links.
 *
 * Coordinates scanning and linking of markdown files using the linker service.
 */

const metadata = require('./metadata');
const linker = require('./linker');
let _rootDir = null;

async function run(rootDir) {
  // Prepare metadata store using new service
  _rootDir = rootDir;
  await metadata.init(rootDir);

  const folders = ['Recipes', 'Ingredients', 'SpicesAndHerbs'];
  for (const folder of folders) {
    const dirPath = path.join(rootDir, folder);
    await scanDirectory(dirPath);
  }

  // Persist metadata after scanning
  await metadata.save();
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
      console.log(`New file detected: ${path.relative(_rootDir, filePath)}`);
      try {
        await linker.processNewFile(filePath, _rootDir);
      } catch (err) {
        console.error(`Error processing new file ${filePath}:`, err.message);
      }
      break;
    case 'modified':
      console.log(`Modified file: ${path.relative(_rootDir, filePath)}`);
      // TODO: re-parse and update links for modified files
      break;
    case 'unchanged':
      console.log(`Unchanged: ${path.relative(_rootDir, filePath)}`);
      break;
  }
}
