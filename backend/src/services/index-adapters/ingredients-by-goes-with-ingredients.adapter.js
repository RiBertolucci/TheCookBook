const parser = require('../parser');
const { normalizeRelativePath } = require('../../utils/content-path.utils');

function normalizePathForIndex(relativePath) {
  return normalizeRelativePath(relativePath || '');
}

function normalizeSetValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractLinkedDisplayNames(text) {
  const labels = [];
  const source = String(text || '');
  const regex = /\[([^\]]+)\]\([^\)]+\)/g;
  let match = regex.exec(source);
  while (match) {
    const label = String(match[1] || '').trim();
    if (label) {
      labels.push(label);
    }
    match = regex.exec(source);
  }
  return labels;
}

function extractIngredientPairings(markdown) {
  const entries = parser.extractSection(markdown, 'Goes with ingredients');
  const values = new Set();

  for (const entry of entries) {
    const linked = extractLinkedDisplayNames(entry);
    if (linked.length > 0) {
      for (const label of linked) {
        const normalized = normalizeSetValue(label);
        if (normalized) {
          values.add(normalized);
        }
      }
      continue;
    }

    const normalized = normalizeSetValue(entry);
    if (normalized) {
      values.add(normalized);
    }
  }

  return Array.from(values).sort();
}

module.exports = {
  name: 'ingredients-by-goes-with-ingredients',
  fileName: 'ingredients-by-goes-with-ingredients.json',
  version: 1,
  keyType: 'path',
  strategy: 'key-set',
  matchesFile(relativePath) {
    const normalized = normalizePathForIndex(relativePath).toLowerCase();
    return normalized.startsWith('ingredients/') && normalized.endsWith('.md');
  },
  keyFromRelativePath(relativePath) {
    return normalizePathForIndex(relativePath);
  },
  preprocess(markdown) {
    return extractIngredientPairings(markdown);
  },
  normalizeValue(value) {
    return normalizeSetValue(value);
  }
};