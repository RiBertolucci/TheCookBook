const fs = require('fs').promises;
const path = require('path');

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

  if (folder === 'Recipes') return 'recipe';
  if (folder === 'Ingredients') return 'ingredient';
  if (folder === 'SpicesAndHerbs') return 'spice';
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
  try {
    const entries = await fs.readdir(searchDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        // Simple matching: file name without .md should match item name (case-insensitive)
        const fileNameWithoutExt = entry.name.slice(0, -3);
        const normalizedFileName = fileNameWithoutExt.toLowerCase().replace(/-/g, ' ');
        const normalizedItemName = itemName.toLowerCase().replace(/\s+/g, ' ');
        if (normalizedFileName === normalizedItemName) {
          return entry.name;
        }
      }
    }
  } catch (err) {
    console.warn(`Error searching ${searchDir}:`, err.message);
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
