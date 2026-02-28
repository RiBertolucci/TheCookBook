(async () => {
  const path = require('path');
  const parser = require(path.resolve(__dirname, '../../../../backend/src/services/parser'));
  const root = path.resolve(__dirname, '../../../../backend/content');
  const found = await parser.findFile(path.join(root, 'Ingredients'), 'Garlic');
  console.log('found', found);
})();
