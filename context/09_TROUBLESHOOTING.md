# Troubleshooting Quick Sheet

Last-verified: 2026-03-06

## Symptom: `/api/...` 404 from frontend
Checks:
- Backend running on `:3000`.
- Route exists in `backend/src/routes/*.js`.
- Frontend proxy active (`frontend/proxy.conf.json`).
- Backend restarted after route changes.

## Symptom: Telegram add user fails
Checks:
- `TELEGRAM_BOT_TOKEN` present in `backend/.env`.
- Bot received at least one message.
- Direct call works:
- `POST http://localhost:3000/api/shopping-list/telegram/targets/add-latest`

## Symptom: Dropdown visible but not clickable
Checks:
- Overlay/backdrop z-index not above menu.
- Click handlers bound in html.
- Menu close handlers not firing before select handler.

## Symptom: Search or suggestions stale
Checks:
- Run sync/index rebuild.
- Verify `.indexes` refreshed.
- Refresh frontend data caches by reloading tab/app.

## Minimal Health Commands
- Backend root:
- `Invoke-WebRequest http://localhost:3000/`
- Targets endpoint:
- `Invoke-WebRequest http://localhost:3000/api/shopping-list/telegram/targets`
