const path = require('path');
const fs = require('fs/promises');
const {
  normalizeRelativePath,
  sanitizeFilename
} = require('../utils/content-path.utils');

const contentRoot = path.resolve(__dirname, '../../content');

function createHttpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function ensureInsideContentRoot(targetPath) {
  if (!targetPath.startsWith(contentRoot)) {
    throw createHttpError(400, 'Invalid destination');
  }
}

function toRelative(targetPath) {
  return path.relative(contentRoot, targetPath).replace(/\\/g, '/');
}

function requireMarkdownFilename(normalizedFilename, actionLabel) {
  if (!normalizedFilename.toLowerCase().endsWith('.md')) {
    throw createHttpError(400, `Only .md files can be ${actionLabel}`);
  }
}

async function createMarkdownFile({ targetPath, title, markdown }) {
  const safePath = normalizeRelativePath(targetPath);
  const filename = `${sanitizeFilename(title)}.md`;
  const destinationDir = path.resolve(contentRoot, safePath || '.');

  ensureInsideContentRoot(destinationDir);
  await fs.mkdir(destinationDir, { recursive: true });

  // Prevent duplicates in the same folder with a clear message.
  // This also guards against casing differences in environments that allow them.
  const existingEntries = await fs.readdir(destinationDir, { withFileTypes: true });
  const duplicateFile = existingEntries.find(
    (entry) => entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()
  );
  if (duplicateFile) {
    throw createHttpError(409, `File \"${duplicateFile.name}\" already exists in this path`);
  }

  const outputFile = path.resolve(destinationDir, filename);
  ensureInsideContentRoot(outputFile);

  try {
    await fs.access(outputFile);
    throw createHttpError(409, `File \"${filename}\" already exists in this path`);
  } catch (err) {
    if (err && err.status === 409) throw err;
  }

  await fs.writeFile(outputFile, String(markdown).trimEnd() + '\n', 'utf8');
  return toRelative(outputFile);
}

async function updateMarkdownFile({ sectionFolder, filename, markdown }) {
  const safeFilename = normalizeRelativePath(filename);
  requireMarkdownFilename(safeFilename, 'updated');

  const targetFile = path.resolve(contentRoot, sectionFolder, safeFilename);
  ensureInsideContentRoot(targetFile);

  try {
    await fs.access(targetFile);
  } catch {
    throw createHttpError(404, 'File not found');
  }

  await fs.writeFile(targetFile, String(markdown).trimEnd() + '\n', 'utf8');
  return toRelative(targetFile);
}

async function deleteMarkdownFile({ sectionFolder, filename }) {
  const safeFilename = normalizeRelativePath(filename);
  requireMarkdownFilename(safeFilename, 'deleted');

  const targetFile = path.resolve(contentRoot, sectionFolder, safeFilename);
  ensureInsideContentRoot(targetFile);

  try {
    await fs.unlink(targetFile);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw createHttpError(404, 'File not found', 'ENOENT');
    }
    throw err;
  }

  return `${sectionFolder}/${safeFilename}`;
}

async function deleteFolderTree({ folderPath }) {
  const safePath = normalizeRelativePath(folderPath);
  if (!safePath) {
    throw createHttpError(400, 'Invalid folder path');
  }

  const parts = safePath.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw createHttpError(400, 'Deleting top-level section folders is not allowed');
  }

  const targetFolder = path.resolve(contentRoot, safePath);
  ensureInsideContentRoot(targetFolder);

  try {
    await fs.rm(targetFolder, { recursive: true, force: false });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw createHttpError(404, 'Folder not found', 'ENOENT');
    }
    throw err;
  }

  return safePath;
}

module.exports = {
  createMarkdownFile,
  updateMarkdownFile,
  deleteMarkdownFile,
  deleteFolderTree
};
