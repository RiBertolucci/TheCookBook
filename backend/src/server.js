const express = require('express');
const path = require('path');
const { randomUUID } = require('crypto');
const sync = require('./services/sync');
const fileReader = require('./services/fileReader');
const logger = require('./services/logger');

// attach a unique id to each request and log arrival


const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  req.requestId = randomUUID();
  logger.info({ service: 'server', method: `${req.method} ${req.path}`, requestId: req.requestId }, 'incoming request');
  next();
});

// lightweight JSON middleware for future POST endpoints
app.use(express.json());

// Health‑check endpoint.
// Method: GET
// Request: no body expected.
// Response: simple text confirming the server is running.
app.get('/', (req, res) => {
  logger.info({ service: 'server', method: 'GET /', requestId: req.requestId }, 'health check');
  res.send('TheCookBook backend is running');
});

// Trigger a full repository synchronization.
// Method: POST
// Request: optionally accept JSON configuration in body (e.g. { "force": true }).
// Currently no body parameters are used; the endpoint simply scans the
// content directories for new/modified markdown files.
// Response: { status: 'ok' } on success or an error object on failure.
app.post('/sync', async (req, res) => {
  const root = path.resolve(__dirname, '../content');
  logger.info({ service: 'sync', method: 'POST /sync', requestId: req.requestId }, 'sync requested');
  try {
    await sync.run(root);
    res.json({ status: 'ok' });
  } catch (err) {
    logger.error({ service: 'sync', method: 'POST /sync', requestId: req.requestId, data: err.message }, 'Sync error');
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Retrieve a recipe by filename.
// Method: GET
// URL: /api/recipes/:filename (e.g., /api/recipes/tomato-pasta or /api/recipes/tomato-pasta.md)
// Response: { filename, type, content } containing the markdown content or 404 if not found.
app.get('/api/recipes/:filename', async (req, res) => {
  const root = path.resolve(__dirname, '../content');
  logger.debug({ service: 'fileReader', method: 'getRecipe', requestId: req.requestId, data: req.params.filename }, 'fetching recipe');
  try {
    const data = await fileReader.getRecipe(root, req.params.filename);
    if (!data) {
      logger.warn({ service: 'fileReader', method: 'getRecipe', requestId: req.requestId, data: req.params.filename }, 'recipe not found');
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getRecipe', requestId: req.requestId, data: err.message }, 'Error reading recipe');
    res.status(500).json({ error: err.message });
  }
});

// Retrieve an ingredient by filename.
// Method: GET
// URL: /api/ingredients/:filename (e.g., /api/ingredients/tomato or /api/ingredients/tomato.md)
// Response: { filename, type, content } containing the markdown content or 404 if not found.
app.get('/api/ingredients/:filename', async (req, res) => {
  const root = path.resolve(__dirname, '../content');
  logger.debug({ service: 'fileReader', method: 'getIngredient', requestId: req.requestId, data: req.params.filename }, 'fetching ingredient');
  try {
    const data = await fileReader.getIngredient(root, req.params.filename);
    if (!data) {
      logger.warn({ service: 'fileReader', method: 'getIngredient', requestId: req.requestId, data: req.params.filename }, 'ingredient not found');
      return res.status(404).json({ error: 'Ingredient not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getIngredient', requestId: req.requestId, data: err.message }, 'Error reading ingredient');
    res.status(500).json({ error: err.message });
  }
});

// Retrieve a spice or herb by filename.
// Method: GET
// URL: /api/spices/:filename (e.g., /api/spices/oregano or /api/spices/oregano.md)
// Response: { filename, type, content } containing the markdown content or 404 if not found.
app.get('/api/spices/:filename', async (req, res) => {
  const root = path.resolve(__dirname, '../content');
  logger.debug({ service: 'fileReader', method: 'getSpice', requestId: req.requestId, data: req.params.filename }, 'fetching spice');
  try {
    const data = await fileReader.getSpice(root, req.params.filename);
    if (!data) {
      logger.warn({ service: 'fileReader', method: 'getSpice', requestId: req.requestId, data: req.params.filename }, 'spice not found');
      return res.status(404).json({ error: 'Spice or herb not found' });
    }
    res.json(data);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getSpice', requestId: req.requestId, data: err.message }, 'Error reading spice');
    res.status(500).json({ error: err.message });
  }
});

// Retrieve the full content directory hierarchy.
// Method: GET
// URL: /api/hierarchy
// Response: { Recipes: {...}, Ingredients: {...}, SpicesAndHerbs: {...} }
// Each folder contains a recursive structure with files and subdirs.
app.get('/api/hierarchy', async (req, res) => {
  const root = path.resolve(__dirname, '../content');
  logger.debug({ service: 'fileReader', method: 'getContentHierarchy', requestId: req.requestId }, 'building hierarchy');
  try {
    const hierarchy = await fileReader.getContentHierarchy(root);
    res.json(hierarchy);
  } catch (err) {
    logger.error({ service: 'fileReader', method: 'getContentHierarchy', requestId: req.requestId, data: err.message }, 'Error reading hierarchy');
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

module.exports = app;
