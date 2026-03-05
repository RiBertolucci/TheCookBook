const https = require('https');
const fs = require('fs/promises');
const path = require('path');

const TELEGRAM_API_HOST = 'api.telegram.org';
const TELEGRAM_STORAGE_DIR = path.resolve(__dirname, '../../content/.telegram');
const LAST_SHOPPING_LIST_FILE_PREFIX = 'last-shopping-list';

function normalizeTarget(value) {
  if (!value || typeof value !== 'object') return null;

  const id = String(value.id || '').trim();
  const name = String(value.name || '').trim();
  const chatId = String(value.chatId || '').trim();
  if (!id || !name || !chatId) return null;

  return { id, name, chatId };
}

function getTargetsFromEnv() {
  const rawJson = String(process.env.TELEGRAM_TARGETS_JSON || '').trim();
  if (!rawJson) return [];

  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    const err = new Error('Invalid TELEGRAM_TARGETS_JSON format. It must be a JSON array.');
    err.code = 'INVALID_TELEGRAM_TARGETS_CONFIG';
    throw err;
  }

  if (!Array.isArray(parsed)) {
    const err = new Error('Invalid TELEGRAM_TARGETS_JSON format. It must be a JSON array.');
    err.code = 'INVALID_TELEGRAM_TARGETS_CONFIG';
    throw err;
  }

  const targets = parsed
    .map((item) => normalizeTarget(item))
    .filter(Boolean);

  if (targets.length === 0) {
    const err = new Error('TELEGRAM_TARGETS_JSON has no valid targets.');
    err.code = 'INVALID_TELEGRAM_TARGETS_CONFIG';
    throw err;
  }

  return targets;
}

function getLegacyTarget() {
  const legacyChatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!legacyChatId) return null;

  return {
    id: 'default',
    name: 'Default chat',
    chatId: legacyChatId
  };
}

function getConfig(targetId) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const targetsFromEnv = getTargetsFromEnv();
  const legacyTarget = getLegacyTarget();
  const targets = targetsFromEnv.length > 0 ? targetsFromEnv : (legacyTarget ? [legacyTarget] : []);

  if (!token || targets.length === 0) {
    const err = new Error('Telegram configuration is missing. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID or TELEGRAM_TARGETS_JSON.');
    err.code = 'MISSING_TELEGRAM_CONFIG';
    throw err;
  }

  const requestedTargetId = String(targetId || '').trim();
  const target = requestedTargetId
    ? targets.find((item) => item.id === requestedTargetId)
    : targets[0];

  if (!target) {
    const err = new Error(`Unknown Telegram target id "${requestedTargetId}".`);
    err.code = 'TARGET_NOT_FOUND';
    throw err;
  }

  return { token, target, targets };
}

function formatShoppingListMessage(items) {
  const now = new Date();
  const lines = [
    'Shopping List',
    `Created: ${now.toLocaleString()}`,
    '',
    ...items.map((item, index) => `${index + 1}. ${item}`)
  ];

  return lines.join('\n');
}

function callTelegramSendMessage({ token, chatId, text }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text
    });

    const request = https.request(
      {
        host: TELEGRAM_API_HOST,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = {};
          }

          if (response.statusCode < 200 || response.statusCode >= 300 || !parsed.ok) {
            const err = new Error(parsed.description || `Telegram API request failed with status ${response.statusCode}`);
            err.code = 'TELEGRAM_API_ERROR';
            return reject(err);
          }

          resolve(parsed);
        });
      }
    );

    request.on('error', (err) => {
      const error = new Error(err.message || 'Telegram network error');
      error.code = 'TELEGRAM_API_ERROR';
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

function toSafeTargetKey(targetId) {
  const safe = String(targetId || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-');
  return safe.replace(/^-+|-+$/g, '') || 'default';
}

function getLastShoppingListFilePath(targetId) {
  const safeTarget = toSafeTargetKey(targetId);
  return path.resolve(TELEGRAM_STORAGE_DIR, `${LAST_SHOPPING_LIST_FILE_PREFIX}-${safeTarget}.json`);
}

async function persistLastSentShoppingList(items, messageId, target) {
  const outputPath = getLastShoppingListFilePath(target.id);
  const payload = {
    sentAt: new Date().toISOString(),
    messageId: messageId || null,
    targetId: target.id,
    targetName: target.name,
    items: Array.isArray(items) ? items : []
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function getLastSentShoppingList(targetId) {
  const { target } = getConfig(targetId);
  const targetFilePath = getLastShoppingListFilePath(target.id);

  try {
    const raw = await fs.readFile(targetFilePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    if (items.length === 0) {
      const err = new Error('No saved shopping list found.');
      err.code = 'NO_LAST_SHOPPING_LIST';
      throw err;
    }

    return {
      sentAt: parsed.sentAt || null,
      messageId: parsed.messageId || null,
      targetId: target.id,
      targetName: target.name,
      items
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const notFoundErr = new Error('No saved shopping list found.');
      notFoundErr.code = 'NO_LAST_SHOPPING_LIST';
      throw notFoundErr;
    }
    throw err;
  }
}

function getTelegramTargets() {
  const { targets } = getConfig();
  return targets.map((target) => ({ id: target.id, name: target.name }));
}

async function sendShoppingListToTelegram(items, targetId) {
  const { token, target } = getConfig(targetId);
  const text = formatShoppingListMessage(items);
  const result = await callTelegramSendMessage({ token, chatId: target.chatId, text });

  const messageId = result && result.result ? result.result.message_id : null;
  await persistLastSentShoppingList(items, messageId, target);

  return {
    messageId,
    targetId: target.id,
    targetName: target.name
  };
}

module.exports = {
  sendShoppingListToTelegram,
  getLastSentShoppingList,
  getTelegramTargets
};
