(async () => {
  const fs = require('fs').promises;
  const os = require('os');
  const path = require('path');
  const linker = require(path.resolve(__dirname, '../../../../backend/src/services/linker'));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cookbook-linker-'));
  const root = path.join(tmp, 'content');

  await fs.mkdir(path.join(root, 'Ingredients', 'Mediterranei'), { recursive: true });
  await fs.mkdir(path.join(root, 'SpicesAndHerbs'), { recursive: true });

  const ingredientA = `# Onion

## Goes with ingredients
- Carrot

## Goes with spicesAndHerbs
- Basil
`;
  const ingredientB = `# Carrot

## Goes with ingredients
- Onion

## Goes with spicesAndHerbs
- Oregano
`;
  const spiceA = `# Basil

## Mixes Well With
- Oregano

## Good With Ingredients
- Onion
`;
  const spiceB = `# Oregano

## Mixes Well With
- Basil

## Good With Ingredients
- Carrot
`;

  await fs.writeFile(path.join(root, 'Ingredients', 'onion.md'), ingredientA);
  await fs.writeFile(path.join(root, 'Ingredients', 'carrot.md'), ingredientB);
  await fs.writeFile(path.join(root, 'SpicesAndHerbs', 'basil.md'), spiceA);
  await fs.writeFile(path.join(root, 'SpicesAndHerbs', 'oregano.md'), spiceB);

  const newIngredientPath = path.join(root, 'Ingredients', 'Mediterranei', 'celery.md');
  const newIngredient = `# Celery

## Goes with ingredients
- Onion

## Goes with spicesAndHerbs
- Basil
`;
  await fs.writeFile(newIngredientPath, newIngredient);
  await linker.processNewFile(newIngredientPath, root);

  const onionAfterIngredient = await fs.readFile(path.join(root, 'Ingredients', 'onion.md'), 'utf8');
  const basilAfterIngredient = await fs.readFile(path.join(root, 'SpicesAndHerbs', 'basil.md'), 'utf8');

  const newSpicePath = path.join(root, 'SpicesAndHerbs', 'thyme.md');
  const newSpice = `# Thyme

## Mixes Well With
- Basil

## Good With Ingredients
- Onion
`;
  await fs.writeFile(newSpicePath, newSpice);
  await linker.processNewFile(newSpicePath, root);

  const basilAfterSpice = await fs.readFile(path.join(root, 'SpicesAndHerbs', 'basil.md'), 'utf8');
  const onionAfterSpice = await fs.readFile(path.join(root, 'Ingredients', 'onion.md'), 'utf8');

  const assertions = {
    ingredientBacklinkInIngredient: onionAfterIngredient.includes('[Celery](/api/ingredients/Mediterranei/celery.md)'),
    ingredientBacklinkInSpice: basilAfterIngredient.includes('[Celery](/api/ingredients/Mediterranei/celery.md)'),
    spiceBacklinkInSpice: basilAfterSpice.includes('[Thyme](/api/spices/thyme.md)'),
    spiceBacklinkInIngredient: onionAfterSpice.includes('[Thyme](/api/spices/thyme.md)'),
  };

  console.log(assertions);

  const allPass = Object.values(assertions).every(Boolean);
  if (!allPass) {
    process.exit(1);
  }
})();
