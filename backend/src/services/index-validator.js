function validateAdapterSchema(adapter, index) {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error(`Invalid index adapter at position ${index}: expected object`);
  }

  const label = adapter.name || `#${index}`;
  const requiredStringProps = ['name', 'fileName'];
  for (const prop of requiredStringProps) {
    if (!String(adapter[prop] || '').trim()) {
      throw new Error(`Invalid adapter ${label}: missing required string property '${prop}'`);
    }
  }

  if (!Number.isInteger(adapter.version) || adapter.version <= 0) {
    throw new Error(`Invalid adapter ${label}: 'version' must be a positive integer`);
  }

  const allowedStrategies = new Set(['key-set']);
  if (adapter.strategy && !allowedStrategies.has(adapter.strategy)) {
    throw new Error(`Invalid adapter ${label}: unsupported strategy '${adapter.strategy}'`);
  }

  if (!['path'].includes(adapter.keyType)) {
    throw new Error(`Invalid adapter ${label}: unsupported keyType '${adapter.keyType}'`);
  }

  const requiredFunctions = ['matchesFile', 'keyFromRelativePath', 'preprocess'];
  for (const fnName of requiredFunctions) {
    if (typeof adapter[fnName] !== 'function') {
      throw new Error(`Invalid adapter ${label}: missing required function '${fnName}'`);
    }
  }

  if (adapter.normalizeValue && typeof adapter.normalizeValue !== 'function') {
    throw new Error(`Invalid adapter ${label}: optional function 'normalizeValue' must be a function`);
  }

  const testPath = 'Recipes/sample.md';
  const matchResult = adapter.matchesFile(testPath);
  if (typeof matchResult !== 'boolean') {
    throw new Error(`Invalid adapter ${label}: 'matchesFile' must return boolean`);
  }

  const keyResult = adapter.keyFromRelativePath(testPath);
  if (!String(keyResult || '').trim()) {
    throw new Error(`Invalid adapter ${label}: 'keyFromRelativePath' must return a non-empty key`);
  }

  const preprocessed = adapter.preprocess('', testPath);
  if (!Array.isArray(preprocessed)) {
    throw new Error(`Invalid adapter ${label}: 'preprocess' must return an array`);
  }
}

function validateAdapters(adapters) {
  if (!Array.isArray(adapters) || adapters.length === 0) {
    throw new Error('Index adapters registry must export a non-empty array');
  }

  const usedNames = new Set();
  const usedFileNames = new Set();

  adapters.forEach((adapter, index) => {
    validateAdapterSchema(adapter, index);

    if (usedNames.has(adapter.name)) {
      throw new Error(`Duplicate index adapter name '${adapter.name}'`);
    }
    usedNames.add(adapter.name);

    if (usedFileNames.has(adapter.fileName)) {
      throw new Error(`Duplicate index adapter fileName '${adapter.fileName}'`);
    }
    usedFileNames.add(adapter.fileName);
  });
}

module.exports = {
  validateAdapters,
  validateAdapterSchema
};
