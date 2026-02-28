const fs = require('fs').promises;
const path = require('path');
const parser = require('./parser');

/**
 * Linker service handles cross-document linking logic for all document types.
 */

async function processNewFile(filePath, rootDir) {
  const docType = parser.getDocumentType(filePath, rootDir);

  if (!docType) {
    console.warn(`Unknown document type for ${filePath}`);
    return;
  }

  let content = await fs.readFile(filePath, 'utf8');
  let modified = false;

  if (docType === 'ingredient') {
    modified = await processIngredient(content, filePath, rootDir);
  } else if (docType === 'recipe') {
    modified = await processRecipe(content, filePath, rootDir);
  } else if (docType === 'spice') {
    modified = await processSpice(content, filePath, rootDir);
  }

  if (modified) {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Updated file with links: ${path.relative(rootDir, filePath)}`);
  }

  return { modified, docType };
}

async function processIngredient(content, filePath, rootDir) {
  let modified = false;

  // 1. Link to "Goes with ingredients"
  const goesWithIngredients = parser.extractSection(content, 'Goes with ingredients');
  if (goesWithIngredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    for (const item of goesWithIngredients) {
      const foundFile = await parser.findFile(ingredientDir, item);
      if (foundFile) {
        const relPath = path.relative(path.dirname(filePath), path.join(ingredientDir, foundFile));
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      content = parser.updateOrCreateSection(content, 'Goes with ingredients', links);
    }
  }

  // 2. Link to "Goes with spicesAndHerbs"
  const goesWithSpices = parser.extractSection(content, 'Goes with spicesAndHerbs');
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
      content = parser.updateOrCreateSection(content, 'Goes with spicesAndHerbs', links);
    }
  }

  // 3. Search in all recipes for this ingredient and add link back
  // (this is handled by processRecipe when it links to ingredients)

  return modified;
}

async function processRecipe(content, filePath, rootDir) {
  let modified = false;

  // Search for "Ingredients" section
  const ingredients = parser.extractSection(content, 'Ingredients');
  if (ingredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    for (const item of ingredients) {
      const foundFile = await parser.findFile(ingredientDir, item);
      if (foundFile) {
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      content = parser.updateOrCreateSection(content, 'Ingredients', links);
    }
  }

  return modified;
}

async function processSpice(content, filePath, rootDir) {
  let modified = false;

  // 1. Link to "Goes with ingredients"
  const goesWithIngredients = parser.extractSection(content, 'Goes with ingredients');
  if (goesWithIngredients.length > 0) {
    const ingredientDir = path.join(rootDir, 'Ingredients');
    const links = [];
    for (const item of goesWithIngredients) {
      const foundFile = await parser.findFile(ingredientDir, item);
      if (foundFile) {
        links.push(parser.formatLink(item, '.'));
        modified = true;
      }
    }
    if (links.length > 0) {
      content = parser.updateOrCreateSection(content, 'Goes with ingredients', links);
    }
  }

  // 2. Link to "Goes with spicesAndHerbs"
  const goesWithSpices = parser.extractSection(content, 'Goes with spicesAndHerbs');
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
      content = parser.updateOrCreateSection(content, 'Goes with spicesAndHerbs', links);
    }
  }

  // 3. Search all ingredient files for this spice and add link back
  // (this would require cross-linking; for now we mark it for future iteration)

  return modified;
}

module.exports = {
  processNewFile,
  processIngredient,
  processRecipe,
  processSpice,
};
