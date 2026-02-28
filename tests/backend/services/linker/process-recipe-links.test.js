(async () => {
  const path = require('path');
  const fs = require('fs').promises;
  const linker = require(path.resolve(__dirname, '../../../../backend/src/services/linker'));
  const rootDir = path.resolve(__dirname, '../../../../backend/content');
  const recipePath = path.join(rootDir, 'Recipes', 'garlic-bread.md');
  const content = await fs.readFile(recipePath, 'utf8');
  const { newContent, modified } = await linker.processRecipe(content, recipePath, rootDir);
  console.log('modified', modified);
  console.log(newContent);
})();
