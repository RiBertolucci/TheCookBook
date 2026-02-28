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
  return readMarkdownFile(rootDir, 'SpicesAndHerbs', filename);
}

/**
 * Recursively scan the content directory and return a tree structure
 * of all folders and markdown files.
 */
async function getContentHierarchy(rootDir) {
  logger.info({ service: 'fileReader', method: 'getContentHierarchy' }, 'starting hierarchy scan');
  const hierarchy = {};
  const folders = ['Recipes', 'Ingredients', 'SpicesAndHerbs'];

  for (const folder of folders) {
    const folderPath = path.join(rootDir, folder);
    hierarchy[folder] = await scanFolderRecursive(folderPath);
  }

  return hierarchy;
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
  // Sanitize filename to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }

  // Ensure .md extension
  const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
  const filePath = path.join(rootDir, folder, safeFilename);

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
