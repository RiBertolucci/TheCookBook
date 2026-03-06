function normalizeIngredientKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDisplayLabel(value) {
  const compact = normalizeIngredientKey(value);
  if (!compact) return '';

  return compact
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeIndexPath(pathValue) {
  return String(pathValue || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function getRelativeIngredientPathFromIndexKey(indexKey) {
  const normalized = normalizeIndexPath(indexKey);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0].toLowerCase() !== 'ingredients') return null;
  return parts.slice(1).join('/');
}

function getFileStem(fileName) {
  return String(fileName || '').replace(/\.md$/i, '').trim();
}

function buildIngredientFamiliesFromSnapshot(snapshot) {
  const familiesByKey = new Map();
  const exactFileKeys = new Set();

  for (const indexKey of Object.keys((snapshot && snapshot.entries) || {})) {
    const relativePath = getRelativeIngredientPathFromIndexKey(indexKey);
    if (!relativePath) continue;

    const pathParts = relativePath.split('/').filter(Boolean);
    if (pathParts.length < 2) continue;

    const fileName = pathParts[pathParts.length - 1];
    const fileStem = getFileStem(fileName);
    const fileKey = normalizeIngredientKey(fileStem);
    if (fileKey) {
      exactFileKeys.add(fileKey);
    }

    const folderParts = pathParts.slice(0, -1);
    // Require at least one category folder + one family folder.
    if (folderParts.length < 2) continue;

    const familySegment = folderParts[folderParts.length - 1];
    const familyKey = normalizeIngredientKey(familySegment);
    if (!familyKey) continue;

    const family = familiesByKey.get(familyKey) || {
      key: familyKey,
      label: toDisplayLabel(familyKey),
      hasExactFile: false,
      isFamily: false,
      variants: []
    };

    const variantPath = relativePath;
    const variantLabel = toDisplayLabel(fileStem);
    if (variantLabel && !family.variants.some((variant) => variant.path === variantPath)) {
      family.variants.push({
        path: variantPath,
        label: variantLabel
      });
    }

    familiesByKey.set(familyKey, family);
  }

  const families = Array.from(familiesByKey.values()).map((family) => {
    const variants = family.variants
      .slice()
      .sort((left, right) => left.label.localeCompare(right.label, 'it'));

    return {
      key: family.key,
      label: family.label,
      hasExactFile: exactFileKeys.has(family.key),
      isFamily: variants.length > 0,
      variants
    };
  }).sort((left, right) => left.label.localeCompare(right.label, 'it'));

  return {
    families,
    exactFileKeys
  };
}

function findIngredientFamilyByName(snapshot, rawName) {
  const key = normalizeIngredientKey(rawName);
  if (!key) return null;

  const { families, exactFileKeys } = buildIngredientFamiliesFromSnapshot(snapshot);
  const found = families.find((family) => family.key === key);
  if (found) return found;

  return {
    key,
    label: toDisplayLabel(key),
    hasExactFile: exactFileKeys.has(key),
    isFamily: false,
    variants: []
  };
}

module.exports = {
  normalizeIngredientKey,
  toDisplayLabel,
  buildIngredientFamiliesFromSnapshot,
  findIngredientFamilyByName
};
