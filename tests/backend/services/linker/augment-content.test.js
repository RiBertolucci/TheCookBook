(async () => {
  const fs = require('fs').promises;
  const path = require('path');
  const linker = require(path.resolve(__dirname, '../../../../backend/src/services/linker'));
  const rootDir = path.resolve(__dirname, '../../../../backend/content');
  const recipePath = path.join(rootDir, 'Recipes', 'garlic-bread.md');
  const content = await fs.readFile(recipePath, 'utf8');
  const augmented = await linker.augmentContent(content, recipePath, rootDir);
  console.log('augmented:\n', augmented);
})();
