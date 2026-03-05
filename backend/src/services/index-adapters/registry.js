const recipesByIngredientsAdapter = require('./recipes-by-ingredients.adapter');
const ingredientsByGoesWithIngredientsAdapter = require('./ingredients-by-goes-with-ingredients.adapter');

module.exports = [
  recipesByIngredientsAdapter,
  ingredientsByGoesWithIngredientsAdapter
];
