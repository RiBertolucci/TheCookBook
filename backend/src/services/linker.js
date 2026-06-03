const fs = require('fs').promises;
const path = require('path');
const parser = require('./parser');
const logger = require('./logger');

const SPICE_SUBFOLDER = 'SpicesAndHerbs';
const CANONICAL_SPICE_API_PREFIX = '/api/ingredients/SpicesAndHerbs';

/**
 * Linker service handles cross-document linking logic for all document types.
 */

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

function normalizeForCatalog(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildSearchCatalog(searchDir, apiPrefix, kind) {
  const items = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const relativePath = path.relative(searchDir, absolutePath).split(path.sep).join('/');
      const slug = entry.name.slice(0, -3).replace(/-/g, ' ').trim();
      const normalizedName = normalizeForCatalog(slug);
      if (!normalizedName) continue;

      items.push({
        kind,
        relativePath,
        apiPath: `${apiPrefix}/${relativePath}`,
        normalizedName,
      });
    }
  }

  await walk(searchDir);
  return items;
}

function findBestCatalogMatch(rawLine, catalog) {
  const haystack = normalizeForCatalog(rawLine);
  if (!haystack) return null;

  let best = null;
  for (const entry of catalog) {
    const candidate = entry.normalizedName;
    if (!candidate) continue;

    const pattern = new RegExp(`(^|\\s)${escapeRegExp(candidate)}(?=\\s|$)`, 'i');
    if (!pattern.test(haystack)) continue;

    if (!best || candidate.length > best.normalizedName.length) {
      best = entry;
    }
  }

  return best;
}

function autoLinkRecipeIngredientLine(rawItem, catalog) {
  const raw = String(rawItem || '').trim();
  if (!raw) return raw;

  const linkedMatch = raw.match(/^(.*?)\[(.+?)\]\((.+?)\)(.*)$/);
  if (linkedMatch) {
    const prefix = String(linkedMatch[1] || '');
    const linkedLabel = String(linkedMatch[2] || '').trim();
    const linkedHref = String(linkedMatch[3] || '').trim();
    const suffix = String(linkedMatch[4] || '');

    if (!linkedHref.toLowerCase().startsWith('/api/')) {
      return raw;
    }

    const hasValidTarget = catalog.some((entry) => entry.apiPath.toLowerCase() === linkedHref.toLowerCase());
    if (hasValidTarget) {
      return raw;
    }

    const unlinked = `${prefix}${linkedLabel}${suffix}`
      .replace(/\s{2,}/g, ' ')
      .trim();
    const fallback = findBestCatalogMatch(unlinked, catalog);
    if (!fallback) {
      return unlinked;
    }

    const escapedLabel = escapeRegExp(linkedLabel);
    const labelFinder = new RegExp(escapedLabel, 'i');
    const relinked = unlinked.replace(labelFinder, `[${linkedLabel}](${fallback.apiPath})`);
    let rewrittenLinked = relinked;
    if (fallback.kind === 'spice') {
      rewrittenLinked = rewrittenLinked.replace(/\s+in\s+polvere\b/ig, '');
    }

    return rewrittenLinked.replace(/\s{2,}/g, ' ').trim();
  }

  const best = findBestCatalogMatch(raw, catalog);
  if (!best) {
    return raw;
  }

  const tokenPattern = best.normalizedName
    .split(' ')
    .filter(Boolean)
    .map((part) => escapeRegExp(part))
    .join('\\s+');

  const finder = new RegExp(tokenPattern, 'i');
  const found = raw.match(finder);
  if (!found) {
    return raw;
  }

  const matchedText = found[0];
  let rewritten = raw.replace(finder, `[${matchedText}](${best.apiPath})`);

  if (best.kind === 'spice') {
    rewritten = rewritten.replace(/\s+in\s+polvere\b/ig, '');
  }

  rewritten = rewritten.replace(/\s{2,}/g, ' ').trim();
  return rewritten;
}

async function resolveRecipeIngredientLine(item, ingredientDir) {
  const raw = String(item || '').trim();
  if (!raw) {
    return { quantity: '', ingredientName: '', foundFile: null };
  }

  const linkedMatch = raw.match(/^(.*?)\[(.+?)\]\((.+?)\)\s*$/);
  if (linkedMatch) {
    const quantity = linkedMatch[1].trim();
    const ingredientName = linkedMatch[2].trim();
    const linkedHref = String(linkedMatch[3] || '').trim().toLowerCase();

    // Recipe references inside a recipe ingredient line are supported, but
    // they are not ingredient targets and must not receive ingredient back-links.
    if (linkedHref.startsWith('/api/recipes/')) {
      return { quantity, ingredientName, foundFile: null };
    }

    const foundFile = await parser.findFile(ingredientDir, ingredientName);
    return { quantity, ingredientName, foundFile };
  }

  const directFound = await parser.findFile(ingredientDir, raw);
  if (directFound) {
    return { quantity: '', ingredientName: raw, foundFile: directFound };
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  for (let suffixLength = parts.length - 1; suffixLength >= 1; suffixLength--) {
    const ingredientName = parts.slice(parts.length - suffixLength).join(' ');
    const foundFile = await parser.findFile(ingredientDir, ingredientName);
    if (!foundFile) continue;

    const quantity = parts.slice(0, parts.length - suffixLength).join(' ').trim();
    return { quantity, ingredientName, foundFile };
  }

  return { quantity: '', ingredientName: raw, foundFile: null };
}

async function relinkSectionItems(items, searchDir, apiPrefix, logMethod, logMessage) {
  if (!items.length) {
    return { rewrittenItems: items, modified: false };
  }

  let modified = false;
  const rewrittenItems = [];

  for (const item of items) {
    const displayName = extractDisplayName(item);
    logger.debug({ service: 'linker', method: logMethod, data: displayName }, logMessage);

    const foundFile = await parser.findFile(searchDir, displayName);
    if (!foundFile) {
      rewrittenItems.push(item);
      continue;
    }

    const linkedItem = `[${displayName}](${apiPrefix}/${foundFile.split('\\').join('/')})`;
    rewrittenItems.push(linkedItem);
    if (linkedItem !== item) {
      modified = true;
    }
  }

  return { rewrittenItems, modified };
}

function parseSubstituteItem(rawItem) {
  const trimmed = String(rawItem || '').trim();
  if (!trimmed) {
    return {
      original: trimmed,
      displayName: '',
      explanation: '',
      existingHref: '',
      hasLink: false,
    };
  }

  const explanationMatch = trimmed.match(/^(.*?)(\s*\([^\)]*\)\s*)$/);
  const withoutExplanation = explanationMatch ? String(explanationMatch[1] || '').trim() : trimmed;
  const explanation = explanationMatch ? String(explanationMatch[2] || '').trim() : '';

  const linkMatch = withoutExplanation.match(/^\[(.+?)\]\((.+?)\)$/);
  if (linkMatch) {
    return {
      original: trimmed,
      displayName: String(linkMatch[1] || '').trim(),
      explanation,
      existingHref: String(linkMatch[2] || '').trim(),
      hasLink: true,
    };
  }

  return {
    original: trimmed,
    displayName: withoutExplanation,
    explanation,
    existingHref: '',
    hasLink: false,
  };
}

async function resolveSubstituteTarget(displayName, ingredientDir, spiceDir) {
  const ingredientFile = await parser.findFile(ingredientDir, displayName);
  if (ingredientFile) {
    return {
      apiPath: `/api/ingredients/${ingredientFile.split('\\').join('/')}`,
      relativePath: ingredientFile,
      kind: 'ingredient',
    };
  }

  const spiceFile = await parser.findFile(spiceDir, displayName);
  if (spiceFile) {
    return {
      apiPath: `${CANONICAL_SPICE_API_PREFIX}/${spiceFile.split('\\').join('/')}`,
      relativePath: spiceFile,
      kind: 'spice',
    };
  }

  return null;
}

async function relinkSubstituteItems(items, ingredientDir, spiceDir, logMethod, logMessage) {
  if (!items.length) {
    return { rewrittenItems: items, modified: false };
  }

  let modified = false;
  const rewrittenItems = [];

  for (const item of items) {
    const parsed = parseSubstituteItem(item);
    if (!parsed.displayName) {
      rewrittenItems.push(item);
      continue;
    }

    logger.debug({ service: 'linker', method: logMethod, data: parsed.displayName }, logMessage);
    const target = await resolveSubstituteTarget(parsed.displayName, ingredientDir, spiceDir);
    if (!target) {
      rewrittenItems.push(item);
      continue;
    }

    const linkedLabel = `[${parsed.displayName}](${target.apiPath})`;
    const rewritten = parsed.explanation ? `${linkedLabel} ${parsed.explanation}` : linkedLabel;

    rewrittenItems.push(rewritten);
    if (rewritten !== item) {
      modified = true;
    }
  }

  return { rewrittenItems, modified };
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

async function resolveSpiceDirectory(rootDir) {
  const nestedSpiceDir = path.join(rootDir, 'Ingredients', SPICE_SUBFOLDER);
  try {
    const nestedStats = await fs.stat(nestedSpiceDir);
    if (nestedStats.isDirectory()) {
      return nestedSpiceDir;
    }
  } catch {
    // Fall back to legacy top-level folder if nested one is not available.
  }

  return path.join(rootDir, SPICE_SUBFOLDER);
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
  const spiceDir = await resolveSpiceDirectory(rootDir);
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
  const spiceDir = await resolveSpiceDirectory(rootDir);
  const sourceRelPath = toPosixPath(path.relative(spiceDir, sourceFilePath));
  const sourceDisplayName = getTitleFromContent(sourceContent) || path.basename(sourceFilePath, '.md');

  const mixesWithSpices = getSectionItemsByCandidates(sourceContent, ['Goes with spicesAndHerbs', 'Mixes Well With']);
  for (const item of mixesWithSpices) {
    const targetName = extractDisplayName(item);
    const targetRelPath = await parser.findFile(spiceDir, targetName);
    if (!targetRelPath) continue;
    const targetFilePath = path.join(spiceDir, targetRelPath.split('/').join(path.sep));
    if (path.resolve(targetFilePath) === path.resolve(sourceFilePath)) continue;

    await upsertBackLinkInTarget(
      targetFilePath,
      ['Goes with spicesAndHerbs', 'Mixes Well With'],
      sourceDisplayName,
      `${CANONICAL_SPICE_API_PREFIX}/${sourceRelPath}`,
    );
  }

  const goodWithIngredients = getSectionItemsByCandidates(sourceContent, ['Goes with ingredients', 'Good With Ingredients']);
  for (const item of goodWithIngredients) {
    const targetName = extractDisplayName(item);
    const targetRelPath = await parser.findFile(ingredientDir, targetName);
    if (!targetRelPath) continue;
    const targetFilePath = path.join(ingredientDir, targetRelPath.split('/').join(path.sep));

    await upsertBackLinkInTarget(
      targetFilePath,
      ['Goes with spicesAndHerbs'],
      sourceDisplayName,
      `${CANONICAL_SPICE_API_PREFIX}/${sourceRelPath}`,
    );
  }
}


async function processIngredient(content, filePath, rootDir) {
  let modified = false;
  let newContent = content;
  const ingredientDir = path.join(rootDir, 'Ingredients');
  const spiceDir = await resolveSpiceDirectory(rootDir);

  // 1. Link to "Goes with ingredients"
  const goesWithIngredients = parser.extractSection(newContent, 'Goes with ingredients');
  if (goesWithIngredients.length > 0) {
    const result = await relinkSectionItems(
      goesWithIngredients,
      ingredientDir,
      '/api/ingredients',
      'processIngredient',
      'looking for ingredient file',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Goes with ingredients', result.rewrittenItems);
      logger.info({ service: 'linker', method: 'processIngredient', data: result.rewrittenItems }, 'updated ingredient links');
    }
  }

  // 2. Link to "Goes with spicesAndHerbs"
  const goesWithSpices = parser.extractSection(newContent, 'Goes with spicesAndHerbs');
  if (goesWithSpices.length > 0) {
    const result = await relinkSectionItems(
      goesWithSpices,
      spiceDir,
      CANONICAL_SPICE_API_PREFIX,
      'processIngredient',
      'looking for spice file',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Goes with spicesAndHerbs', result.rewrittenItems);
    }
  }

  // 3. Link to "Substitutes" (ingredients/spices) preserving explanations.
  const substitutes = parser.extractSection(newContent, 'Substitutes');
  if (substitutes.length > 0) {
    const result = await relinkSubstituteItems(
      substitutes,
      ingredientDir,
      spiceDir,
      'processIngredient',
      'looking for substitute target file',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Substitutes', result.rewrittenItems);
      logger.info({ service: 'linker', method: 'processIngredient', data: result.rewrittenItems }, 'updated substitute links');
    }
  }

  // 4. Link to "Used for" (recipes)
  const usedForRecipes = parser.extractSection(newContent, 'Used for');
  if (usedForRecipes.length > 0) {
    const recipeDir = path.join(rootDir, 'Recipes');
    const result = await relinkSectionItems(
      usedForRecipes,
      recipeDir,
      '/api/recipes',
      'processIngredient',
      'looking for recipe file',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Used for', result.rewrittenItems);
      logger.info({ service: 'linker', method: 'processIngredient', data: result.rewrittenItems }, 'updated used-for recipe links');
    }
  }

  return { newContent, modified };
}

async function processRecipe(content, filePath, rootDir) {
  let modified = false;
  let newContent = content;
  const ingredientDir = path.join(rootDir, 'Ingredients');
  const recipeDir = path.join(rootDir, 'Recipes');
  const recipeRelPath = toPosixPath(path.relative(recipeDir, filePath));

  // Search for "Ingredients" section
  const ingredients = parser.extractSection(newContent, 'Ingredients');
  if (ingredients.length > 0) {
    const spiceDir = await resolveSpiceDirectory(rootDir);
    const ingredientCatalog = await buildSearchCatalog(ingredientDir, '/api/ingredients', 'ingredient');
    const spiceCatalog = await buildSearchCatalog(spiceDir, CANONICAL_SPICE_API_PREFIX, 'spice');
    const recipeCatalog = (await buildSearchCatalog(recipeDir, '/api/recipes', 'recipe'))
      .filter((entry) => entry.relativePath.toLowerCase() !== recipeRelPath.toLowerCase());
    const searchCatalog = [...ingredientCatalog, ...spiceCatalog, ...recipeCatalog];
    const rewrittenItems = [];

    for (const item of ingredients) {
      const linkedItem = autoLinkRecipeIngredientLine(item, searchCatalog);
      rewrittenItems.push(linkedItem);
      if (linkedItem !== item) {
        modified = true;
      }
    }

    if (modified) {
      newContent = parser.updateOrCreateSection(newContent, 'Ingredients', rewrittenItems);
      logger.info({ service: 'linker', method: 'processRecipe', data: rewrittenItems }, 'updated recipe ingredient links');

      // Intentionally do NOT replace inline occurrences throughout the
      // recipe body. Replacing inside paragraphs can create nested links or
      // noisy output; the Ingredients section provides explicit navigation
      // and the frontend viewer will navigate to referenced items when
      // clicked.
    }

    const recipeDisplayName = getTitleFromContent(newContent) || path.basename(filePath, '.md');
    const recipeApiPath = `/api/recipes/${recipeRelPath}`;
    const ingredientsForBackLinks = modified ? rewrittenItems : ingredients;

    for (const item of ingredientsForBackLinks) {
      const resolved = await resolveRecipeIngredientLine(item, ingredientDir);
      if (!resolved.foundFile) continue;

      const normalizedTarget = toPosixPath(resolved.foundFile);
      if (normalizedTarget.toLowerCase().startsWith(`${SPICE_SUBFOLDER.toLowerCase()}/`)) continue;

      const targetFilePath = path.join(ingredientDir, normalizedTarget.split('/').join(path.sep));
      await upsertBackLinkInTarget(
        targetFilePath,
        ['Used for'],
        recipeDisplayName,
        recipeApiPath,
      );
    }
  }

  return { newContent, modified };
}

async function processSpice(content, filePath, rootDir) {
  let modified = false;
  let newContent = content;
  const ingredientDir = path.join(rootDir, 'Ingredients');
  const spiceDir = await resolveSpiceDirectory(rootDir);

  // 1. Link to "Goes with ingredients"
  const goesWithIngredients = getSectionItemsByCandidates(newContent, ['Goes with ingredients', 'Good With Ingredients']);
  if (goesWithIngredients.length > 0) {
    const result = await relinkSectionItems(
      goesWithIngredients,
      ingredientDir,
      '/api/ingredients',
      'processSpice',
      'searching ingredient for spice',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Goes with ingredients', result.rewrittenItems);
      logger.info({ service: 'linker', method: 'processSpice', data: result.rewrittenItems }, 'updated ingredient links for spice');
    }
  }

  // 2. Link to "Goes with spicesAndHerbs"
  const goesWithSpices = getSectionItemsByCandidates(newContent, ['Goes with spicesAndHerbs', 'Mixes Well With']);
  if (goesWithSpices.length > 0) {
    const result = await relinkSectionItems(
      goesWithSpices,
      spiceDir,
      CANONICAL_SPICE_API_PREFIX,
      'processSpice',
      'searching spice for spice',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Goes with spicesAndHerbs', result.rewrittenItems);
      logger.info({ service: 'linker', method: 'processSpice', data: result.rewrittenItems }, 'updated spice links for spice');
    }
  }

  // 3. Link to "Substitutes" (ingredients/spices) preserving explanations.
  const substitutes = parser.extractSection(newContent, 'Substitutes');
  if (substitutes.length > 0) {
    const result = await relinkSubstituteItems(
      substitutes,
      ingredientDir,
      spiceDir,
      'processSpice',
      'looking for substitute target file for spice',
    );

    if (result.modified) {
      modified = true;
      newContent = parser.updateOrCreateSection(newContent, 'Substitutes', result.rewrittenItems);
      logger.info({ service: 'linker', method: 'processSpice', data: result.rewrittenItems }, 'updated substitute links for spice');
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
