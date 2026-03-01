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

async function processFileWithPropagation(filePath, rootDir, methodName, logMessage) {
  logger.info({ service: 'linker', method: methodName, data: filePath }, logMessage);
  const docType = parser.getDocumentType(filePath, rootDir);

  if (!docType) {
    logger.warn({ service: 'linker', method: methodName, data: filePath }, 'unknown document type');
    return;
  }

  let content = await fs.readFile(filePath, 'utf8');
  const updated = await augmentContent(content, filePath, rootDir);
  const modified = updated !== content;
  if (modified) {
    await fs.writeFile(filePath, updated, 'utf8');
    logger.info({ service: 'linker', method: methodName, data: path.relative(rootDir, filePath) }, 'updated file with links');
  }

  if (docType === 'ingredient') {
    await propagateNewIngredient(filePath, updated, rootDir);
  } else if (docType === 'spice') {
    await propagateNewSpice(filePath, updated, rootDir);
  }

  return { modified, docType };
}

async function processNewFile(filePath, rootDir) {
  return processFileWithPropagation(filePath, rootDir, 'processNewFile', 'processing new file');
}

async function processModifiedFile(filePath, rootDir) {
  return processFileWithPropagation(filePath, rootDir, 'processModifiedFile', 'processing modified file');
}

function extractDisplayName(item) {
  const linkMatch = String(item || '').match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
  return (linkMatch ? linkMatch[1] : String(item || '')).trim();
}

function normalizeName(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function toPosixPath(p) {
  return String(p || '').split('\\').join('/');
}

function sectionExists(content, sectionName) {
  return content.includes(`## ${sectionName}`);
}

function pickSectionName(content, candidates) {
  for (const candidate of candidates) {
    if (sectionExists(content, candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function getSectionItemsByCandidates(content, candidates) {
  const existing = candidates.find(candidate => sectionExists(content, candidate));
  if (!existing) return [];
  return parser.extractSection(content, existing);
}

function getTitleFromContent(content) {
  const line = String(content || '').split(/\r?\n/).find(l => l.startsWith('# '));
  return line ? line.slice(2).trim() : '';
}

async function upsertBackLinkInTarget(targetFilePath, sectionCandidates, sourceDisplayName, sourceApiPath) {
  let targetContent;
  try {
    targetContent = await fs.readFile(targetFilePath, 'utf8');
  } catch (err) {
    logger.warn({ service: 'linker', method: 'upsertBackLinkInTarget', data: targetFilePath }, `unable to read target file: ${err.message}`);
    return;
  }

  const sectionName = pickSectionName(targetContent, sectionCandidates);
  const items = getSectionItemsByCandidates(targetContent, sectionCandidates);
  const exists = items.some(item => normalizeName(extractDisplayName(item)) === normalizeName(sourceDisplayName));
  if (exists) return;

  const updatedItems = [...items, `[${sourceDisplayName}](${sourceApiPath})`];
  const newTargetContent = parser.updateOrCreateSection(targetContent, sectionName, updatedItems);
  if (newTargetContent === targetContent) return;

  await fs.writeFile(targetFilePath, newTargetContent, 'utf8');
}

async function propagateNewIngredient(sourceFilePath, sourceContent, rootDir) {
  const ingredientDir = path.join(rootDir, 'Ingredients');
  const spiceDir = path.join(rootDir, 'SpicesAndHerbs');
  const sourceRelPath = toPosixPath(path.relative(ingredientDir, sourceFilePath));
  const sourceDisplayName = getTitleFromContent(sourceContent) || path.basename(sourceFilePath, '.md');

  const goesWithIngredients = parser.extractSection(sourceContent, 'Goes with ingredients');
  for (const item of goesWithIngredients) {
    const targetName = extractDisplayName(item);
    const targetRelPath = await parser.findFile(ingredientDir, targetName);
    if (!targetRelPath) continue;
    const targetFilePath = path.join(ingredientDir, targetRelPath.split('/').join(path.sep));
    if (path.resolve(targetFilePath) === path.resolve(sourceFilePath)) continue;

    await upsertBackLinkInTarget(
      targetFilePath,
      ['Goes with ingredients'],
      sourceDisplayName,
      `/api/ingredients/${sourceRelPath}`,
    );
  }

  const goesWithSpices = parser.extractSection(sourceContent, 'Goes with spicesAndHerbs');
  for (const item of goesWithSpices) {
    const targetName = extractDisplayName(item);
    const targetRelPath = await parser.findFile(spiceDir, targetName);
    if (!targetRelPath) continue;
    const targetFilePath = path.join(spiceDir, targetRelPath.split('/').join(path.sep));

    await upsertBackLinkInTarget(
      targetFilePath,
      ['Good With Ingredients', 'Goes with ingredients'],
      sourceDisplayName,
      `/api/ingredients/${sourceRelPath}`,
    );
  }
}

async function propagateNewSpice(sourceFilePath, sourceContent, rootDir) {
  const ingredientDir = path.join(rootDir, 'Ingredients');
  const spiceDir = path.join(rootDir, 'SpicesAndHerbs');
  const sourceRelPath = toPosixPath(path.relative(spiceDir, sourceFilePath));
  const sourceDisplayName = getTitleFromContent(sourceContent) || path.basename(sourceFilePath, '.md');

  const mixesWithSpices = parser.extractSection(sourceContent, 'Mixes Well With');
  for (const item of mixesWithSpices) {
    const targetName = extractDisplayName(item);
    const targetRelPath = await parser.findFile(spiceDir, targetName);
    if (!targetRelPath) continue;
    const targetFilePath = path.join(spiceDir, targetRelPath.split('/').join(path.sep));
    if (path.resolve(targetFilePath) === path.resolve(sourceFilePath)) continue;

    await upsertBackLinkInTarget(
      targetFilePath,
      ['Mixes Well With', 'Goes with spicesAndHerbs'],
      sourceDisplayName,
      `/api/spices/${sourceRelPath}`,
    );
  }

  const goodWithIngredients = parser.extractSection(sourceContent, 'Good With Ingredients');
  for (const item of goodWithIngredients) {
    const targetName = extractDisplayName(item);
    const targetRelPath = await parser.findFile(ingredientDir, targetName);
    if (!targetRelPath) continue;
    const targetFilePath = path.join(ingredientDir, targetRelPath.split('/').join(path.sep));

    await upsertBackLinkInTarget(
      targetFilePath,
      ['Goes with spicesAndHerbs'],
      sourceDisplayName,
      `/api/spices/${sourceRelPath}`,
    );
  }
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
      const linkMatch = item.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
      const displayName = linkMatch ? linkMatch[1] : item;
      logger.debug({ service: 'linker', method: 'processIngredient', data: displayName }, 'looking for ingredient file');
      const foundFile = await parser.findFile(ingredientDir, displayName);
      if (foundFile) {
        links.push(`[${displayName}](/api/ingredients/${foundFile.split('\\').join('/')})`);
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
      const linkMatch = item.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
      const displayName = linkMatch ? linkMatch[1] : item;
      const foundFile = await parser.findFile(spiceDir, displayName);
      if (foundFile) {
        links.push(`[${displayName}](/api/spices/${foundFile.split('\\').join('/')})`);
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
        const apiPath = `/api/ingredients/${foundFile.split('\\').join('/')}`;
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
      const linkMatch = item.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
      const displayName = linkMatch ? linkMatch[1] : item;
      logger.debug({ service: 'linker', method: 'processSpice', data: displayName }, 'searching ingredient for spice');
      const foundFile = await parser.findFile(ingredientDir, displayName);
      if (foundFile) {
        links.push(`[${displayName}](/api/ingredients/${foundFile.split('\\').join('/')})`);
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
      const linkMatch = item.match(/^\s*\[(.+?)\]\(.+?\)\s*$/);
      const displayName = linkMatch ? linkMatch[1] : item;
      logger.debug({ service: 'linker', method: 'processSpice', data: displayName }, 'searching spice for spice');
      const foundFile = await parser.findFile(spiceDir, displayName);
      if (foundFile) {
        links.push(`[${displayName}](/api/spices/${foundFile.split('\\').join('/')})`);
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
  processModifiedFile,
  processIngredient,
  processRecipe,
  processSpice,
  augmentContent,
};
