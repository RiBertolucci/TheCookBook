const fs = require('fs').promises;
const path = require('path');
const parser = require('./parser');
const logger = require('./logger');

/**
 * Linker service handles cross-document linking logic for all document types.
 */

/**
 * Pure helpers that return a modified string (with links inserted) but do not
 * persist any changes.  These are used both when processing new files on disk
 * and when serving content to the frontend.
 */
function applyIngredientLinks(content, filePath, rootDir) {
  let modified = false;
  // 1. Goes with ingredients
  const goesWithIngredients = parser.extractSection(content, 'Goes with ingredients');
  if (goesWithIngredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    for (const item of goesWithIngredients) {
      logger.debug({ service: 'linker', method: 'applyIngredientLinks', data: item }, 'looking for ingredient file');
      const foundFile = parser.findFileSync ? parser.findFileSync(ingredientDir, item) : null;
      // parser.findFile is async; we can't await here, so reuse logic from processIngredient
    }
  }
  // We will not actually reuse this pure function; easier is to call processIngredient
  // with content and return the potentially modified content as done below.
  return content;
}

async function augmentContent(content, filePath, rootDir) {
  const docType = parser.getDocumentType(filePath, rootDir);
  if (!docType) return content;

  if (docType === 'ingredient') {
    const { newContent } = await processIngredient(content, filePath, rootDir);
    return newContent;
  } else if (docType === 'recipe') {
    const { newContent } = await processRecipe(content, filePath, rootDir);
    return newContent;
  } else if (docType === 'spice') {
    const { newContent } = await processSpice(content, filePath, rootDir);
    return newContent;
  }
  return content;
}

async function processNewFile(filePath, rootDir) {
  logger.info({ service: 'linker', method: 'processNewFile', data: filePath }, 'processing new file');
  const docType = parser.getDocumentType(filePath, rootDir);

  if (!docType) {
    logger.warn({ service: 'linker', method: 'processNewFile', data: filePath }, 'unknown document type');
    return;
  }

  let content = await fs.readFile(filePath, 'utf8');
  const updated = await augmentContent(content, filePath, rootDir);
  const modified = updated !== content;
  if (modified) {
    await fs.writeFile(filePath, updated, 'utf8');
    logger.info({ service: 'linker', method: 'processNewFile', data: path.relative(rootDir, filePath) }, 'updated file with links');
  }

  return { modified, docType };
}


async function processIngredient(content, filePath, rootDir) {
  let modified = false;
  let newContent = content;

  // 1. Link to "Goes with ingredients"
  const goesWithIngredients = parser.extractSection(newContent, 'Goes with ingredients');
  if (goesWithIngredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    for (const item of goesWithIngredients) {
      logger.debug({ service: 'linker', method: 'processIngredient', data: item }, 'looking for ingredient file');
      const foundFile = await parser.findFile(ingredientDir, item);
      if (foundFile) {
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      newContent = parser.updateOrCreateSection(newContent, 'Goes with ingredients', links);
      logger.info({ service: 'linker', method: 'processIngredient', data: links }, 'added ingredient links');
    }
  }

  // 2. Link to "Goes with spicesAndHerbs"
  const goesWithSpices = parser.extractSection(newContent, 'Goes with spicesAndHerbs');
  if (goesWithSpices.length > 0) {
    const spiceDir = path.join(rootDir, 'SpicesAndHerbs');
    const links = [];
    for (const item of goesWithSpices) {
      const foundFile = await parser.findFile(spiceDir, item);
      if (foundFile) {
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      newContent = parser.updateOrCreateSection(newContent, 'Goes with spicesAndHerbs', links);
    }
  }

  return { newContent, modified };
}

async function processRecipe(content, filePath, rootDir) {
  let modified = false;
  let newContent = content;

  // Search for "Ingredients" section
  const ingredients = parser.extractSection(newContent, 'Ingredients');
  if (ingredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    const foundMap = []; // { item, file }
    for (const item of ingredients) {
      // If the item is already a markdown link like [Name](...), extract the
      // visible text to avoid creating nested links.
      const linkMatch = item.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
      const displayName = linkMatch ? linkMatch[1] : item;
      logger.debug({ service: 'linker', method: 'processRecipe', data: displayName }, 'searching for ingredient');
      const foundFile = await parser.findFile(ingredientDir, displayName);
      if (foundFile) {
        // create API endpoint link target so frontend can intercept
        const apiPath = `/api/ingredients/${foundFile}`;
        links.push(`[${displayName}](${apiPath})`);
        foundMap.push({ item: displayName, file: foundFile });
        modified = true;
      }
    }
    if (links.length > 0) {
      newContent = parser.updateOrCreateSection(newContent, 'Ingredients', links);
      logger.info({ service: 'linker', method: 'processRecipe', data: links }, 'added recipe ingredient links');

      // Intentionally do NOT replace inline occurrences throughout the
      // recipe body. Replacing inside paragraphs can create nested links or
      // noisy output; the Ingredients section provides explicit navigation
      // and the frontend viewer will navigate to referenced items when
      // clicked.
    }
  }

  return { newContent, modified };
}

async function processSpice(content, filePath, rootDir) {
  let modified = false;
  let newContent = content;

  // 1. Link to "Goes with ingredients"
  const goesWithIngredients = parser.extractSection(newContent, 'Goes with ingredients');
  if (goesWithIngredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    for (const item of goesWithIngredients) {
      logger.debug({ service: 'linker', method: 'processSpice', data: item }, 'searching ingredient for spice');
      const foundFile = await parser.findFile(ingredientDir, item);
      if (foundFile) {
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      newContent = parser.updateOrCreateSection(newContent, 'Goes with ingredients', links);
      logger.info({ service: 'linker', method: 'processSpice', data: links }, 'added ingredient links for spice');
    }
  }

  // 2. Link to "Goes with spicesAndHerbs"
  const goesWithSpices = parser.extractSection(newContent, 'Goes with spicesAndHerbs');
  if (goesWithSpices.length > 0) {
    const spiceDir = path.join(rootDir, 'SpicesAndHerbs');
    const links = [];
    for (const item of goesWithSpices) {
      logger.debug({ service: 'linker', method: 'processSpice', data: item }, 'searching spice for spice');
      const foundFile = await parser.findFile(spiceDir, item);
      if (foundFile) {
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      newContent = parser.updateOrCreateSection(newContent, 'Goes with spicesAndHerbs', links);
      logger.info({ service: 'linker', method: 'processSpice', data: links }, 'added spice links for spice');
    }
  }

  return { newContent, modified };
}

module.exports = {
  processNewFile,
  processIngredient,
  processRecipe,
  processSpice,
  augmentContent,
};
