const express = require('express');
const {
  addFile,
  updateFile,
  deleteFile,
  deleteFolder
} = require('../controllers/content-write.controller');

const router = express.Router();

router.post('/api/addFile', addFile);
router.post('/api/updateFile', updateFile);
router.post('/api/deleteFile', deleteFile);
router.post('/api/deleteFolder', deleteFolder);

module.exports = router;
