const https = require('https');
const fs = require('fs/promises');
const path = require('path');

const TELEGRAM_API_HOST = 'api.telegram.org';
const TELEGRAM_STORAGE_DIR = path.resolve(__dirname, '../../content/.telegram');
const LAST_SHOPPING_LIST_FILE_PREFIX = 'last-shopping-list';
const TELEGRAM_TARGETS_FILE_NAME = 'targets.json';

function normalizeTarget(value) {
  if (!value || typeof value !== 'object') return null;

  const id = String(value.id || '').trim();
  const name = String(value.name || '').trim();
  const chatId = String(value.chatId || '').trim();
  if (!id || !name || !chatId) return null;

  return { id, name, chatId };
}

function getBotToken() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    const err = new Error('Telegram bot token is missing. Set TELEGRAM_BOT_TOKEN in backend/.env.');
    err.code = 'MISSING_TELEGRAM_TOKEN';
    throw err;
  }
  return token;
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

function getTelegramTargetsFilePath() {
  return path.resolve(TELEGRAM_STORAGE_DIR, TELEGRAM_TARGETS_FILE_NAME);
}

async function getStoredTargets() {
  const filePath = getTelegramTargetsFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!String(raw || '').trim()) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const err = new Error('Invalid telegram targets storage format.');
      err.code = 'INVALID_TELEGRAM_TARGETS_STORAGE';
      throw err;
    }

    return parsed
      .map((item) => normalizeTarget(item))
      .filter(Boolean);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }

    if (err && err.code === 'INVALID_TELEGRAM_TARGETS_STORAGE') {
      throw err;
    }

    if (err instanceof SyntaxError) {
      const parseErr = new Error('Invalid telegram targets storage format.');
      parseErr.code = 'INVALID_TELEGRAM_TARGETS_STORAGE';
      throw parseErr;
    }

    throw err;
  }
}

async function persistStoredTargets(targets) {
  const filePath = getTelegramTargetsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(targets, null, 2) + '\n', 'utf8');
}

function mergeTargets(targetGroups) {
  const merged = [];
  const ids = new Set();
  const chatIds = new Set();

  targetGroups.flat().forEach((rawTarget) => {
    const target = normalizeTarget(rawTarget);
    if (!target) return;

    if (chatIds.has(target.chatId)) return;
    if (ids.has(target.id)) return;

    merged.push(target);
    ids.add(target.id);
    chatIds.add(target.chatId);
  });

  return merged;
}

async function getAllTargets() {
  const targetsFromEnv = getTargetsFromEnv();
  const legacyTarget = getLegacyTarget();
  const storedTargets = await getStoredTargets();

  return mergeTargets([
    targetsFromEnv,
    legacyTarget ? [legacyTarget] : [],
    storedTargets
  ]);
}

async function getConfig(targetId) {
  const token = getBotToken();
  const targets = await getAllTargets();

  if (targets.length === 0) {
    const err = new Error('No Telegram targets configured. Use Add user from Settings after sending a message to the bot.');
    err.code = 'MISSING_TELEGRAM_TARGETS';
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

function callTelegramGetUpdates({ token, limit = 100 }) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        host: TELEGRAM_API_HOST,
        path: `/bot${token}/getUpdates?limit=${encodeURIComponent(String(limit || 100))}`,
        method: 'GET'
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

    request.end();
  });
}

function toSafeTargetKey(targetId) {
  const safe = String(targetId || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-');
  return safe.replace(/^-+|-+$/g, '') || 'default';
}

function chatDisplayName(chat) {
  const safeChat = chat && typeof chat === 'object' ? chat : {};

  if (safeChat.type === 'private') {
    const fullName = [safeChat.first_name, safeChat.last_name]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName) return fullName;
    if (String(safeChat.username || '').trim()) return `@${String(safeChat.username).trim()}`;
    return 'Private chat';
  }

  const title = String(safeChat.title || '').trim();
  if (title) return title;
  if (String(safeChat.username || '').trim()) return `@${String(safeChat.username).trim()}`;

  return `Chat ${String(safeChat.id || '').trim()}`;
}

function extractChatFromUpdate(update) {
  if (!update || typeof update !== 'object') return null;

  const candidateMessages = [
    update.message,
    update.edited_message,
    update.channel_post,
    update.edited_channel_post,
    update.callback_query && update.callback_query.message
  ];

  for (const candidate of candidateMessages) {
    if (candidate && candidate.chat && typeof candidate.chat === 'object') {
      return candidate.chat;
    }
  }

  if (update.my_chat_member && update.my_chat_member.chat) {
    return update.my_chat_member.chat;
  }
  if (update.chat_member && update.chat_member.chat) {
    return update.chat_member.chat;
  }

  return null;
}

function findLastChatFromUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    const err = new Error('No Telegram messages found for this bot yet. Send a message to the bot first.');
    err.code = 'NO_TELEGRAM_UPDATES';
    throw err;
  }

  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const chat = extractChatFromUpdate(updates[index]);
    const chatId = chat ? String(chat.id || '').trim() : '';
    if (chatId) {
      return {
        chatId,
        name: chatDisplayName(chat)
      };
    }
  }

  const err = new Error('No Telegram messages found for this bot yet. Send a message to the bot first.');
  err.code = 'NO_TELEGRAM_UPDATES';
  throw err;
}

function buildTargetId(name, chatId, existingTargets) {
  const base = toSafeTargetKey(name) || 'chat';
  const chatKey = toSafeTargetKey(chatId) || 'id';
  const root = `${base}-${chatKey}`;

  let candidate = root;
  let suffix = 2;
  while (existingTargets.some((target) => target.id === candidate && target.chatId !== chatId)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
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
  const { target } = await getConfig(targetId);
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

async function getTelegramTargets() {
  getBotToken();
  const targets = await getAllTargets();
  return targets.map((target) => ({ id: target.id, name: target.name }));
}

async function sendShoppingListToTelegram(items, targetId) {
  const { token, target } = await getConfig(targetId);
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

async function addTelegramTargetFromLatestMessage() {
  const token = getBotToken();
  const updatesResponse = await callTelegramGetUpdates({ token, limit: 100 });
  const updates = Array.isArray(updatesResponse && updatesResponse.result) ? updatesResponse.result : [];
  const latest = findLastChatFromUpdates(updates);

  const allTargets = await getAllTargets();
  const existingTarget = allTargets.find((target) => target.chatId === latest.chatId);
  if (existingTarget) {
    return {
      created: false,
      target: existingTarget
    };
  }

  const storedTargets = await getStoredTargets();
  const nextTarget = {
    id: buildTargetId(latest.name, latest.chatId, allTargets),
    name: latest.name,
    chatId: latest.chatId
  };

  const nextStoredTargets = mergeTargets([storedTargets, [nextTarget]]);
  await persistStoredTargets(nextStoredTargets);

  return {
    created: true,
    target: nextTarget
  };
}

module.exports = {
  sendShoppingListToTelegram,
  getLastSentShoppingList,
  getTelegramTargets,
  addTelegramTargetFromLatestMessage
};
