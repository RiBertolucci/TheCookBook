const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const linker = require('./linker');

/**
 * File reader service handles retrieving markdown files by name
 * from the content directory structure.
 */

async function getRecipe(rootDir, filename) {
  logger.debug({ service: 'fileReader', method: 'getRecipe', data: filename }, 'invoked');
  return readMarkdownFile(rootDir, 'Recipes', filename);
}

async function getIngredient(rootDir, filename) {
  logger.debug({ service: 'fileReader', method: 'getIngredient', data: filename }, 'invoked');
  return readMarkdownFile(rootDir, 'Ingredients', filename);
}

async function getSpice(rootDir, filename) {
  logger.debug({ service: 'fileReader', method: 'getSpice', data: filename }, 'invoked');
  const normalized = String(filename || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const withoutPrefix = normalized.toLowerCase().startsWith('spicesandherbs/')
    ? normalized.slice('spicesandherbs/'.length)
    : normalized;

  const nestedRelativeFilename = `SpicesAndHerbs/${withoutPrefix}`;
  const nestedResult = await readMarkdownFile(rootDir, 'Ingredients', nestedRelativeFilename);
  if (nestedResult) {
    return {
      ...nestedResult,
      type: 'ingredients'
    };
  }

  // Legacy fallback for older repositories still using top-level SpicesAndHerbs.
  return readMarkdownFile(rootDir, 'SpicesAndHerbs', withoutPrefix);
}

/**
 * Recursively scan the content directory and return a tree structure
 * of all folders and markdown files.
 */
async function getContentHierarchy(rootDir) {
  logger.info({ service: 'fileReader', method: 'getContentHierarchy' }, 'starting hierarchy scan');
  const hierarchy = {
    Recipes: await scanFolderRecursive(path.join(rootDir, 'Recipes')),
    Ingredients: await scanFolderRecursive(path.join(rootDir, 'Ingredients'))
  };

  const nestedSpicesPath = path.join(rootDir, 'Ingredients', 'SpicesAndHerbs');
  const legacySpicesPath = path.join(rootDir, 'SpicesAndHerbs');

  const hasNestedSpices = await directoryExists(nestedSpicesPath);
  const hasLegacySpices = await directoryExists(legacySpicesPath);

  if (!hasNestedSpices && hasLegacySpices) {
    if (!hierarchy['Ingredients']) {
      hierarchy['Ingredients'] = { files: [], subdirs: {} };
    }
    hierarchy['Ingredients'].subdirs = hierarchy['Ingredients'].subdirs || {};
    hierarchy['Ingredients'].subdirs['SpicesAndHerbs'] = await scanFolderRecursive(legacySpicesPath);
  }

  return hierarchy;
}

async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Recursively scan a directory and return structure of subdirectories and files.
 * Returns { files: [], subdirs: {} }
 */
async function scanFolderRecursive(dirPath) {
  const result = {
    files: [],
    subdirs: {},
  };

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        result.subdirs[entry.name] = await scanFolderRecursive(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        result.files.push(entry.name);
      }
    }
  } catch (err) {
    logger.warn({ service: 'fileReader', method: 'scanFolderRecursive', data: dirPath }, `Error scanning directory ${dirPath}: ${err.message}`);
  }

  return result;
}


async function readMarkdownFile(rootDir, folder, filename) {
  const normalizedInput = String(filename || '').replace(/\\/g, '/');
  const normalizedPath = path.posix.normalize(normalizedInput);

  // Sanitize filename/path to prevent directory traversal
  if (
    !normalizedPath ||
    normalizedPath === '.' ||
    normalizedPath.startsWith('/') ||
    normalizedPath.startsWith('../') ||
    normalizedPath.includes('/../')
  ) {
    throw new Error('Invalid filename');
  }

  // Ensure .md extension
  const safeFilename = normalizedPath.endsWith('.md') ? normalizedPath : `${normalizedPath}.md`;
  const baseFolder = path.resolve(rootDir, folder);
  const filePath = path.resolve(baseFolder, safeFilename);

  if (!filePath.startsWith(baseFolder + path.sep) && filePath !== baseFolder) {
    throw new Error('Invalid filename');
  }

  try {
    let content = await fs.readFile(filePath, 'utf8');
    // augment with links without mutating disk
    try {
      content = await linker.augmentContent(content, filePath, rootDir);
    } catch (e) {
      logger.debug({ service: 'fileReader', method: 'readMarkdownFile', data: e.message }, 'could not augment links');
    }
    return {
      filename: safeFilename,
      type: folder.toLowerCase(),
      content: content,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.debug({ service: 'fileReader', method: 'readMarkdownFile', data: filePath }, 'file not found');
      return null; // File not found
    }
    logger.error({ service: 'fileReader', method: 'readMarkdownFile', data: err.message }, 'error reading file');
    throw err;
  }
}

module.exports = {
  getRecipe,
  getIngredient,
  getSpice,
  getContentHierarchy,
};
