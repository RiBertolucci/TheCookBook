# Backend Skeleton

This directory contains the initial Node.js backend for TheCookBook project.

## Structure

```
backend/
├── package.json         # Node project manifest
├── README.md            # Backend-specific documentation
├── content/             # Markdown repository (Recipes, Ingredients, SpicesAndHerbs)
└── src/
    ├── index.js         # Entry point / CLI
    └── sync.js          # Sync logic placeholder
```

## Getting started

1. `cd backend`
2. `npm install` (add dependencies as needed)
3. `npm run sync` to perform a scan of the content folders.

Sync currently logs parsed files; real linking/parsing will be implemented later.

### API / Communication

A minimal HTTP layer (Express) exposes the sync functionality to a frontend or other clients.

- `POST /sync` – triggers a full repository scan; returns `{ status: 'ok' }` on success.
- Root `/` responds with a simple liveness message.

### Telegram Shopping List

The backend can forward a shopping list to Telegram through a bot.

- `POST /api/shopping-list/telegram`
    - Request body: `{ "items": ["Item 1", "Item 2"], "targetId": "me" }`
    - Response: `{ "status": "ok", "messageId": 123, "targetId": "me", "targetName": "Riccardo" }`

- `GET /api/shopping-list/telegram/last`
    - Query: `?targetId=me`
    - Response: `{ "status": "ok", "items": ["Item 1"], "sentAt": "...", "messageId": 123, "targetId": "me", "targetName": "Riccardo" }`

- `GET /api/shopping-list/telegram/targets`
    - Response: `{ "status": "ok", "targets": [{ "id": "me", "name": "Riccardo" }] }`

- `POST /api/shopping-list/telegram/targets/add-latest`
    - Reads `TELEGRAM_BOT_TOKEN` from env and calls Telegram `getUpdates`.
    - Uses the chat from the latest update only.
    - Response: `{ "status": "ok", "created": true, "target": { "id": "riccardo-202258240", "name": "Riccardo", "chatId": "202258240" } }`
    - If the chat already exists in configured/stored targets: `"created": false`.

Required environment variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_TARGETS_JSON` (recommended for multiple named chats)

Legacy fallback (single chat):

- `TELEGRAM_CHAT_ID`

You can store them in `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_TARGETS_JSON=[{"id":"me","name":"Riccardo","chatId":"202258240"},{"id":"family","name":"Family","chatId":"-1001234567890"}]
```

PowerShell example before starting backend:

```powershell
$env:TELEGRAM_BOT_TOKEN = "<your-bot-token>"
$env:TELEGRAM_TARGETS_JSON = '[{"id":"me","name":"Riccardo","chatId":"202258240"}]'
npm start
```

The server is started with `npm start` (defaults to port 3000).