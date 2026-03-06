const recipesByIngredientsAdapter = require('./recipes-by-ingredients.adapter');
const ingredientsByGoesWithIngredientsAdapter = require('./ingredients-by-goes-with-ingredients.adapter');
const ingredientsCatalogAdapter = require('./ingredients-catalog.adapter');

module.exports = [
  recipesByIngredientsAdapter,
  ingredientsByGoesWithIngredientsAdapter,
  ingredientsCatalogAdapter
];
