const express = require('express');
const {
  getRecipe,
  getIngredient,
  getSpice,
  getHierarchy,
  getIngredientSuggestions,
  getIngredientFamilies,
  getIngredientFamilyByName,
  getIndexes,
  getIndexByName,
  searchFilesByIndex
} = require('../controllers/content-read.controller');

const router = express.Router();

router.get('/api/recipes/:filename', getRecipe);
router.get('/api/ingredients/suggestions', getIngredientSuggestions);
router.get('/api/ingredients/families', getIngredientFamilies);
router.get('/api/ingredients/families/:name', getIngredientFamilyByName);
router.get('/api/ingredients/*filename', getIngredient);
router.get('/api/spices/*filename', getSpice);
router.get('/api/hierarchy', getHierarchy);
router.get('/api/indexes', getIndexes);
router.get('/api/indexes/:indexName', getIndexByName);
router.post('/api/indexes/:indexName/search', searchFilesByIndex);

module.exports = router;
