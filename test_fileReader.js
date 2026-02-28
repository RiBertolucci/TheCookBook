(async () => {
  const fileReader = require('./backend/src/services/fileReader');
  const path = require('path');
  const rootDir = path.resolve('./backend/content');
  const data = await fileReader.getRecipe(rootDir, 'garlic-bread.md');
  console.log(data);
})();
