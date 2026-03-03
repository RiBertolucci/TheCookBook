const express = require('express');
const {
  getRecipe,
  getIngredient,
  getSpice,
  getHierarchy,
  getIndexes,
  getIndexByName
} = require('../controllers/content-read.controller');

const router = express.Router();

router.get('/api/recipes/:filename', getRecipe);
router.get('/api/ingredients/*filename', getIngredient);
router.get('/api/spices/*filename', getSpice);
router.get('/api/hierarchy', getHierarchy);
router.get('/api/indexes', getIndexes);
router.get('/api/indexes/:indexName', getIndexByName);

module.exports = router;
