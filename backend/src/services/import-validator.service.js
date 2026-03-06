const { normalizeRelativePath } = require('../utils/content-path.utils');

function createHttpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function normalizeKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (value === 'recipe' || value === 'ingredient') {
    return value;
  }
  throw createHttpError(400, 'kind must be either recipe or ingredient');
}

function ensureMarkdownFilename(filename) {
  const value = String(filename || '').trim();
  if (!value) {
    throw createHttpError(400, 'originalFilename is required');
  }
  if (!value.toLowerCase().endsWith('.md')) {
    throw createHttpError(400, 'Only .md files are allowed for import');
  }
  return value;
}

function toStorageTitleFromFilename(filename) {
  return String(filename || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.md$/i, '')
    .trim();
}

function extractTitle(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const titleLine = lines.find((line) => line.trim().startsWith('# '));
  if (!titleLine) {
    throw createHttpError(400, 'Invalid markdown format: missing top-level title (# ...)');
  }

  const title = titleLine.trim().slice(2).trim();
  if (!title) {
    throw createHttpError(400, 'Invalid markdown format: empty title');
  }
  return title;
}

function parseSections(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const sections = new Map();
  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      current = String(headingMatch[1] || '').trim();
      if (!sections.has(current)) {
        sections.set(current, []);
      }
      continue;
    }

    if (current) {
      sections.get(current).push(line);
    }
  }

  return sections;
}

function hasDescription(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const titleIndex = lines.findIndex((line) => line.trim().startsWith('# '));
  if (titleIndex < 0) return false;

  const firstSectionIndex = lines.findIndex((line, index) => index > titleIndex && /^##\s+/.test(line));
  const endIndex = firstSectionIndex >= 0 ? firstSectionIndex : lines.length;

  const description = lines
    .slice(titleIndex + 1, endIndex)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return description.length > 0;
}

function hasBulletItems(sectionLines) {
  return (sectionLines || []).some((line) => String(line || '').trim().startsWith('- '));
}

function hasNumberedSteps(sectionLines) {
  return (sectionLines || []).some((line) => /^\s*\d+\.\s+/.test(String(line || '')));
}

function ensureSectionWithBullets(sections, sectionName, kindLabel) {
  if (!sections.has(sectionName)) {
    throw createHttpError(400, `Invalid ${kindLabel} format: missing section \"## ${sectionName}\"`);
  }
  if (!hasBulletItems(sections.get(sectionName))) {
    throw createHttpError(400, `Invalid ${kindLabel} format: section \"## ${sectionName}\" must include bullet items`);
  }
}

function validateRecipeMarkdown(markdown) {
  const sections = parseSections(markdown);
  ensureSectionWithBullets(sections, 'Ingredients', 'recipe');

  if (!sections.has('Procedure')) {
    throw createHttpError(400, 'Invalid recipe format: missing section "## Procedure"');
  }
  if (!hasNumberedSteps(sections.get('Procedure'))) {
    throw createHttpError(400, 'Invalid recipe format: section "## Procedure" must include numbered steps (1. 2. 3.)');
  }
}

function validateIngredientMarkdown(markdown) {
  const sections = parseSections(markdown);
  ensureSectionWithBullets(sections, 'Properties', 'ingredient');
  ensureSectionWithBullets(sections, 'Substitutes', 'ingredient');
  ensureSectionWithBullets(sections, 'Goes with ingredients', 'ingredient');
  ensureSectionWithBullets(sections, 'Goes with spicesAndHerbs', 'ingredient');

  if (!sections.has('Used for')) {
    throw createHttpError(400, 'Invalid ingredient format: missing section "## Used for"');
  }
}

function buildTargetPath(kind, inputPath) {
  const normalized = normalizeRelativePath(inputPath);
  const baseFolder = kind === 'recipe' ? 'Recipes' : 'Ingredients';
  return normalized ? `${baseFolder}/${normalized}` : baseFolder;
}

function validateImportPayload(payload) {
  const kind = normalizeKind(payload && payload.kind);
  const originalFilename = ensureMarkdownFilename(payload && payload.originalFilename);

  const markdown = String((payload && payload.markdown) || '').trim();
  if (!markdown) {
    throw createHttpError(400, 'markdown is required');
  }

  const title = extractTitle(markdown);
  if (!hasDescription(markdown)) {
    throw createHttpError(400, 'Invalid markdown format: missing description text under the title');
  }

  if (kind === 'recipe') {
    validateRecipeMarkdown(markdown);
  } else {
    validateIngredientMarkdown(markdown);
  }

  return {
    kind,
    title,
    storageTitle: toStorageTitleFromFilename(originalFilename),
    originalFilename,
    markdown,
    targetPath: buildTargetPath(kind, payload && payload.path),
  };
}

module.exports = {
  validateImportPayload,
  createHttpError,
};
