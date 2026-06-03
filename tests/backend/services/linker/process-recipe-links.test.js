(async () => {
  const fs = require('fs').promises;
  const os = require('os');
  const path = require('path');
  const linker = require(path.resolve(__dirname, '../../../../backend/src/services/linker'));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cookbook-linker-recipe-'));
  const root = path.join(tmp, 'content');

  await fs.mkdir(path.join(root, 'Ingredients'), { recursive: true });
  await fs.mkdir(path.join(root, 'Ingredients', 'SpicesAndHerbs'), { recursive: true });
  await fs.mkdir(path.join(root, 'Recipes'), { recursive: true });

  const ingredient = `# Brodo vegetale

## Used for
`;

  const referencedRecipe = `# Brodo vegetale

## Ingredients
- Acqua
`;

  const plainRecipe = `# Sugo base

## Ingredients
- Pomodoro
`;

  const mainRecipe = `# Ricetta principale

## Ingredients
- [Brodo vegetale](/api/recipes/brodo-vegetale.md)
- Sugo base
`;

  await fs.writeFile(path.join(root, 'Ingredients', 'brodo-vegetale.md'), ingredient);
  await fs.writeFile(path.join(root, 'Recipes', 'brodo-vegetale.md'), referencedRecipe);
  await fs.writeFile(path.join(root, 'Recipes', 'sugo-base.md'), plainRecipe);

  const mainRecipePath = path.join(root, 'Recipes', 'ricetta-principale.md');
  await fs.writeFile(mainRecipePath, mainRecipe);

  const content = await fs.readFile(mainRecipePath, 'utf8');
  const { newContent, modified } = await linker.processRecipe(content, mainRecipePath, root);

  const ingredientAfter = await fs.readFile(path.join(root, 'Ingredients', 'brodo-vegetale.md'), 'utf8');

  const assertions = {
    recipeLinkPreserved: newContent.includes('[Brodo vegetale](/api/recipes/brodo-vegetale.md)'),
    plainRecipeAutoLinked: newContent.includes('[Sugo base](/api/recipes/sugo-base.md)'),
    noIngredientBacklinkForRecipeRef: !ingredientAfter.includes('[Ricetta principale](/api/recipes/ricetta-principale.md)'),
    modifiedFlagTrue: modified === true,
  };

  console.log(assertions);

  const allPass = Object.values(assertions).every(Boolean);
  if (!allPass) {
    process.exit(1);
  }
})();
