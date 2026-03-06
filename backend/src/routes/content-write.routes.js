const express = require('express');
const {
  addFile,
  updateFile,
  deleteFile,
  deleteFolder,
  sendShoppingListToTelegram,
  getLastSentShoppingList,
  getTelegramTargets,
  addTelegramTargetFromLatestMessage
} = require('../controllers/content-write.controller');

const router = express.Router();

router.post('/api/addFile', addFile);
router.post('/api/updateFile', updateFile);
router.post('/api/deleteFile', deleteFile);
router.post('/api/deleteFolder', deleteFolder);
router.post('/api/shopping-list/telegram', sendShoppingListToTelegram);
router.get('/api/shopping-list/telegram/last', getLastSentShoppingList);
router.get('/api/shopping-list/telegram/targets', getTelegramTargets);
router.post('/api/shopping-list/telegram/targets/add-latest', addTelegramTargetFromLatestMessage);

module.exports = router;
