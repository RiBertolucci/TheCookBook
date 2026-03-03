function normalizeRelativePath(inputPath) {
  const value = String(inputPath || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!value) return '';
  const parts = value.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid path');
  }
  return parts.join('/');
}

function mapSectionToFolder(section) {
  switch (String(section || '').trim()) {
    case 'Recipes':
      return 'Recipes';
    case 'Ingredients':
      return 'Ingredients';
    case 'SpicesAndHerbs':
      return 'SpicesAndHerbs';
    default:
      return null;
  }
}

function sanitizeFilename(title) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base.replace(/^-+|-+$/g, '') || 'untitled';
}

function normalizeFilenameParam(filenameParam) {
  return Array.isArray(filenameParam) ? filenameParam.join('/') : filenameParam;
}

module.exports = {
  normalizeRelativePath,
  mapSectionToFolder,
  sanitizeFilename,
  normalizeFilenameParam
};
