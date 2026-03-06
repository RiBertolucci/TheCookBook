const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Parser service handles markdown parsing, link extraction, and link insertion
 * for Recipe, Ingredient, and SpicesAndHerb documents.
 */

/**
 * Determines the document type based on folder hierarchy.
 * Returns 'recipe', 'ingredient', 'spice', or null if unknown.
 */
function getDocumentType(filePath, rootDir) {
  const rel = path.relative(rootDir, filePath);
  const parts = rel.split(path.sep);
  const folder = parts[0];
  const subFolder = parts[1] || '';
  logger.debug({ service: 'parser', method: 'getDocumentType', data: rel }, 'determining document type');

  if (folder === 'Recipes') return 'recipe';
  if (folder === 'Ingredients' && subFolder === 'SpicesAndHerbs') return 'spice';
  if (folder === 'Ingredients') return 'ingredient';
  if (folder === 'SpicesAndHerbs') return 'spice';
  logger.warn({ service: 'parser', method: 'getDocumentType', data: folder }, 'unknown folder type');
  return null;
}

/**
 * Extract section content from markdown.
 * Returns an array of bullet point items (without the leading '- ').
 */
function extractSection(content, sectionName) {
  const lines = content.split('\n');
  const items = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`## ${sectionName}`)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('## ')) {
      break;
    }
    if (inSection && line.trim().startsWith('- ')) {
      const item = line.trim().slice(2).trim();
      items.push(item);
    }
  }

  return items;
}

/**
 * Format a link in markdown.
 * Converts "Item Name" -> "[Item Name](./item-name.md)"
 */
function formatLink(itemName, filePath) {
  const fileName = itemName.toLowerCase().replace(/\s+/g, '-') + '.md';
  return `[${itemName}](${filePath}/${fileName})`;
}

/**
 * Search for a file by name in a directory.
 * Returns relative path if found, null otherwise.
 */
async function findFile(searchDir, itemName) {
  const linkMatch = itemName.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
  const effectiveItemName = linkMatch ? linkMatch[1] : itemName;

  async function walk(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const foundInSubdir = await walk(entryPath);
        if (foundInSubdir) {
          return foundInSubdir;
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const fileNameWithoutExt = entry.name.slice(0, -3);
        const normalizedFileName = fileNameWithoutExt.toLowerCase().replace(/-/g, ' ');
        const normalizedItemName = effectiveItemName.toLowerCase().replace(/\s+/g, ' ');
        if (normalizedFileName === normalizedItemName) {
          const relativePath = path.relative(searchDir, entryPath);
          return relativePath.split(path.sep).join('/');
        }
      }
    }
    return null;
  }

  try {
    return await walk(searchDir);
  } catch (err) {
    logger.warn({ service: 'parser', method: 'findFile', data: searchDir }, `Error searching directory: ${err.message}`);
  }
  return null;
}

/**
 * Add or update a section with links in markdown.
 * If the section doesn't exist, it is created at the end.
 */
function updateOrCreateSection(content, sectionName, linksList) {
  const lines = content.split('\n');
  const sectionHeader = `## ${sectionName}`;

  let sectionStartIndex = -1;
  let sectionEndIndex = -1;

  // Find section boundaries
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(sectionHeader)) {
      sectionStartIndex = i;
    } else if (sectionStartIndex !== -1 && lines[i].startsWith('## ')) {
      sectionEndIndex = i;
      break;
    }
  }

  if (sectionEndIndex === -1 && sectionStartIndex !== -1) {
    sectionEndIndex = lines.length;
  }

  if (sectionStartIndex === -1) {
    // Section doesn't exist, create it at the end
    const linkLines = linksList.map(link => `- ${link}`);
    lines.push('');
    lines.push(sectionHeader);
    lines.push(...linkLines);
  } else {
    // Replace section content (remove old bullet points, keep header)
    const linkLines = linksList.map(link => `- ${link}`);
    lines.splice(sectionStartIndex + 1, sectionEndIndex - sectionStartIndex - 1, ...linkLines);
  }

  return lines.join('\n');
}

module.exports = {
  getDocumentType,
  extractSection,
  formatLink,
  findFile,
  updateOrCreateSection,
};
