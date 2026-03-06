# Backend Map

Last-verified: 2026-03-06
Root: `backend/src`

## Layers
- `app.js`: express app + middleware + routes
- `server.js`: load env, listen on port
- `controllers/`: HTTP handlers
- `routes/`: endpoint declarations
- `services/`: business logic
- `utils/`: path/normalization helpers

## Core Services
- `services/sync.js`: orchestrates markdown sync
- `services/parser.js`: markdown section parsing
- `services/linker.js`: auto-link logic, including ingredient `Used for` recipe linking/back-links
- `services/fileReader.js`: markdown reads + hierarchy shape
- `services/metadata.js`: tracks file mtimes
- `services/index-store.service.js`: persistent index operations
- `services/index-search.service.js`: index search
- `services/ingredient-families.service.js`: family grouping logic
- `services/telegram-shopping.service.js`: telegram send/load/targets

## Route Files
- `routes/system.routes.js`
- `routes/content-read.routes.js`
- `routes/content-write.routes.js`

## Data Side Effects
- sync updates:
- `backend/content/sync-metadata.json`
- `backend/content/.indexes/*.json`
- telegram writes:
- `backend/content/.telegram/last-shopping-list-*.json`
- `backend/content/.telegram/targets.json`

## Critical Invariants
- Content lives under `backend/content/*`.
- Spices/herbs are canonically stored under `backend/content/Ingredients/SpicesAndHerbs/*`.
- Canonical spice links point to `/api/ingredients/SpicesAndHerbs/...`.
- API always returns JSON.
- Telegram features require valid `TELEGRAM_BOT_TOKEN`.
- Route order matters for specific vs wildcard endpoints.
