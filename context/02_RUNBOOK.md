# Runbook

Last-verified: 2026-03-06

## Install
- Backend:
- `cd backend`
- `npm install`
- Frontend:
- `cd frontend`
- `npm install`

## Start (2 terminals)
- Backend:
- `cd backend`
- `npm start`
- Frontend:
- `cd frontend`
- `npm run start`

## Start (single command, bash)
- Root:
- `./start-dev.sh`

## Important Scripts
- Backend:
- `npm start` -> `node src/server.js`
- `npm run sync` -> `node src/index.js sync`
- Frontend:
- `npm run start` -> Angular dev server + proxy
- `npm run start:lan` -> host `0.0.0.0:4200`
- `npm run test` -> Karma/Jasmine

## Proxy
- File: `frontend/proxy.conf.json`
- `/api` -> `http://localhost:3000`
- `/sync` -> `http://localhost:3000`

## Env (backend/.env)
- Required for Telegram:
- `TELEGRAM_BOT_TOKEN=...`
- Optional targets:
- `TELEGRAM_TARGETS_JSON=[{"id":"me","name":"Riccardo","chatId":"..."}]`
- Legacy fallback:
- `TELEGRAM_CHAT_ID=...`

## Verify API quickly
- Health:
- `GET http://localhost:3000/`
- Sync:
- `POST http://localhost:3000/api/sync`
- Telegram targets:
- `GET http://localhost:3000/api/shopping-list/telegram/targets`
