# Telegram Flow

Last-verified: 2026-03-06

## Purpose
- Send shopping list to Telegram.
- Load last sent list by target.
- Add target from latest bot message.

## Required Env
- `TELEGRAM_BOT_TOKEN`

## Optional Env
- `TELEGRAM_TARGETS_JSON` (named targets)
- `TELEGRAM_CHAT_ID` (legacy fallback)

## Add User Flow
1. UI button: Settings -> `Add user`.
2. Frontend calls:
- `POST /api/shopping-list/telegram/targets/add-latest`
3. Backend calls Telegram:
- `getUpdates`
4. Backend takes only latest update chat.
5. If chat already known: return `created:false`.
6. Else persist target in:
- `backend/content/.telegram/targets.json`

## Send/Load Flow
- Send:
- `POST /api/shopping-list/telegram`
- Load last:
- `GET /api/shopping-list/telegram/last?targetId=...`
- List targets:
- `GET /api/shopping-list/telegram/targets`

## Common Failure Causes
- 404 on add-latest: backend process not restarted after route change.
- 400 config error: missing/invalid env token.
- 404 no updates: bot has no messages yet.
- 502: Telegram API/network issue.
