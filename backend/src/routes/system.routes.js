const express = require('express');
const { healthCheck, syncContent, forceIndexing } = require('../controllers/system.controller');

const router = express.Router();

router.get('/', healthCheck);
router.post('/sync', syncContent);
router.post('/api/sync', syncContent);
router.post('/api/indexes/rebuild', forceIndexing);

module.exports = router;
