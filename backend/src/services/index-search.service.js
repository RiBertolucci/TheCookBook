const indexStore = require('./index-store.service');
const { normalizeRelativePath } = require('../utils/content-path.utils');

function normalizeSearchTerm(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function countMatchedTerms(values, terms) {
  if (!terms.length) return 0;

  const normalizedValues = (Array.isArray(values) ? values : [])
    .map((value) => normalizeSearchTerm(value))
    .filter(Boolean);

  if (!normalizedValues.length) {
    return 0;
  }

  let matches = 0;
  for (const term of terms) {
    if (normalizedValues.some((value) => value.includes(term))) {
      matches += 1;
    }
  }

  return matches;
}

function mapPathToFileDescriptor(relativePath) {
  const normalized = normalizeRelativePath(relativePath || '');
  if (!normalized.toLowerCase().endsWith('.md')) {
    return null;
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const section = parts[0];
  const filename = parts.slice(1).join('/');

  if (section !== 'Recipes' && section !== 'Ingredients' && section !== 'SpicesAndHerbs') {
    return null;
  }

  return {
    path: normalized,
    section,
    filename
  };
}

async function searchFilesByIndex(indexName, rawTerms) {
  const normalizedIndexName = String(indexName || '').trim();
  if (!normalizedIndexName) {
    throw new Error('indexName is required');
  }

  const terms = Array.from(new Set((Array.isArray(rawTerms) ? rawTerms : [])
    .map((value) => normalizeSearchTerm(value))
    .filter(Boolean)));

  const snapshot = await indexStore.getIndexSnapshot(normalizedIndexName);
  const results = [];
  const grouped = new Map();

  for (const [key, values] of Object.entries(snapshot.entries || {})) {
    const matchedTerms = countMatchedTerms(values, terms);

    if (terms.length > 0 && matchedTerms === 0) {
      continue;
    }

    const descriptor = mapPathToFileDescriptor(key);
    if (!descriptor) {
      continue;
    }

    const enriched = {
      ...descriptor,
      matchedTerms,
      totalSelectedTerms: terms.length
    };

    results.push(enriched);

    if (!grouped.has(matchedTerms)) {
      grouped.set(matchedTerms, []);
    }
    grouped.get(matchedTerms).push(enriched);
  }

  results.sort((left, right) => {
    if (right.matchedTerms !== left.matchedTerms) {
      return right.matchedTerms - left.matchedTerms;
    }
    return left.path.localeCompare(right.path);
  });

  const groupedByMatchedTerms = Array.from(grouped.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([matchedCount, files]) => ({
      matchedTerms: matchedCount,
      totalSelectedTerms: terms.length,
      files: files.sort((left, right) => left.path.localeCompare(right.path))
    }));

  return {
    indexName: normalizedIndexName,
    terms,
    files: results,
    groupedByMatchedTerms
  };
}

module.exports = {
  searchFilesByIndex
};
