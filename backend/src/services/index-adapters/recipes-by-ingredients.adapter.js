const parser = require('../parser');
const { normalizeRelativePath } = require('../../utils/content-path.utils');

const quantityWords = new Set(['x', 'qb', 'q.b.', 'ca', 'ca.', 'circa', 'about']);
const quantityUnits = new Set([
  'g', 'kg', 'mg', 'ml', 'l', 'cl',
  'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb',
  'pc', 'pcs', 'piece', 'pieces',
  'cucchiaio', 'cucchiai', 'cucchiaino', 'cucchiaini',
  'spicchio', 'spicchi', 'rametto', 'rametti'
]);

function normalizePathForIndex(relativePath) {
  return normalizeRelativePath(relativePath || '');
}

function normalizeSetValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isQuantityToken(token) {
  const normalized = String(token || '').toLowerCase().replace(/[,]/g, '');
  if (!normalized) return false;
  if (quantityWords.has(normalized)) return true;
  return /^\d+(?:[./,-]\d+)?$/.test(normalized) || /^\d+\/\d+$/.test(normalized);
}

function isUnitToken(token) {
  const normalized = String(token || '').toLowerCase().replace(/[.,]/g, '');
  return quantityUnits.has(normalized);
}

function extractLinkedDisplayName(value) {
  const match = String(value || '').trim().match(/^(.*?)\[(.+?)\]\(.+?\)\s*$/);
  if (!match) return null;
  return String(match[2] || '').trim();
}

function stripLeadingQuantity(text) {
  const original = String(text || '').trim();
  if (!original) return '';

  const tokens = original.split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';

  let quantitySeen = false;
  let index = 0;

  while (index < tokens.length && index < 5) {
    const token = tokens[index];
    if (!quantitySeen && isQuantityToken(token)) {
      quantitySeen = true;
      index += 1;
      continue;
    }
    if (quantitySeen && (isQuantityToken(token) || isUnitToken(token))) {
      index += 1;
      continue;
    }
    break;
  }

  if (!quantitySeen || index >= tokens.length) {
    return original;
  }

  return tokens.slice(index).join(' ').trim();
}

function extractRecipeIngredientSet(markdown) {
  const ingredients = parser.extractSection(markdown, 'Ingredients');
  const values = new Set();

  for (const item of ingredients) {
    const linkedDisplayName = extractLinkedDisplayName(item);
    const candidate = linkedDisplayName || stripLeadingQuantity(item);
    const normalized = normalizeSetValue(candidate);
    if (normalized) {
      values.add(normalized);
    }
  }

  return Array.from(values).sort();
}

module.exports = {
  name: 'recipes-by-ingredients',
  fileName: 'recipes-by-ingredients.json',
  version: 1,
  keyType: 'path',
  strategy: 'key-set',
  matchesFile(relativePath) {
    const normalized = normalizePathForIndex(relativePath).toLowerCase();
    return normalized.startsWith('recipes/') && normalized.endsWith('.md');
  },
  keyFromRelativePath(relativePath) {
    return normalizePathForIndex(relativePath);
  },
  preprocess(markdown) {
    return extractRecipeIngredientSet(markdown);
  },
  normalizeValue(value) {
    return normalizeSetValue(value);
  }
};
