const { normalizeRelativePath } = require('../../utils/content-path.utils');

function normalizePathForIndex(relativePath) {
  return normalizeRelativePath(relativePath || '');
}

function normalizeSetValue(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractIngredientName(relativePath) {
  const normalized = normalizePathForIndex(relativePath);
  const fileName = normalized.split('/').filter(Boolean).pop() || '';
  const raw = fileName.replace(/\.md$/i, '').trim();
  if (!raw) return '';

  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .join(' ')
    .trim();
}

module.exports = {
  name: 'ingredients-catalog',
  fileName: 'ingredients-catalog.json',
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
  preprocess(markdown, relativePath) {
    const name = extractIngredientName(relativePath);
    return name ? [name] : [];
  },
  normalizeValue(value) {
    return normalizeSetValue(value);
  }
};
