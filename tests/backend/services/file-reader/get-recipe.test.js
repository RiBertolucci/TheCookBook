(async () => {
  const path = require('path');
  const fileReader = require(path.resolve(__dirname, '../../../../backend/src/services/fileReader'));
  const rootDir = path.resolve(__dirname, '../../../../backend/content');
  const data = await fileReader.getRecipe(rootDir, 'garlic-bread.md');
  console.log(data);
})();
