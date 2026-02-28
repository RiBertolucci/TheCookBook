(async () => {
  const linker = require('./backend/src/services/linker');
  const path = require('path');
  const recipePath = path.resolve('./backend/content/Recipes/garlic-bread.md');
  const content = await require('fs').promises.readFile(recipePath, 'utf8');
  const { newContent, modified } = await linker.processRecipe(content, recipePath, path.resolve('./backend/content'));
  console.log('modified', modified);
  console.log(newContent);
})();
