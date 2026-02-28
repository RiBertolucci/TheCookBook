(async () => {
  const parser = require('./backend/src/services/parser');
  const path = require('path');
  const root = path.resolve('./backend/content');
  const found = await parser.findFile(path.join(root, 'Ingredients'), 'Garlic');
  console.log('found', found);
})();
