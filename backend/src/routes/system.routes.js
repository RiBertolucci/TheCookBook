const express = require('express');
const { healthCheck, syncContent } = require('../controllers/system.controller');

const router = express.Router();

router.get('/', healthCheck);
router.post('/sync', syncContent);
router.post('/api/sync', syncContent);

module.exports = router;
