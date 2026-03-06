# Backend API Map

Last-verified: 2026-03-06
Base: `http://localhost:3000`

## System
- `GET /` -> health/liveness
- `POST /sync` -> sync content
- `POST /api/sync` -> sync content
- `POST /api/indexes/rebuild` -> force index rebuild

## Content Read
- `GET /api/hierarchy`
- `GET /api/recipes/:filename`
- `GET /api/ingredients/*filename`
- `GET /api/spices/*filename`

## Indexes
- `GET /api/indexes`
- `GET /api/indexes/:indexName`
- `POST /api/indexes/:indexName/search`

## Ingredients Discovery
- `GET /api/ingredients/suggestions`
- `GET /api/ingredients/families`
- `GET /api/ingredients/families/:name`

## Content Write
- `POST /api/addFile`
- `POST /api/updateFile`
- `POST /api/deleteFile`
- `POST /api/deleteFolder`

## Shopping + Telegram
- `POST /api/shopping-list/telegram`
- `GET /api/shopping-list/telegram/last?targetId=...`
- `GET /api/shopping-list/telegram/targets`
- `POST /api/shopping-list/telegram/targets/add-latest`

## Known Status Patterns
- 400: invalid request/config
- 404: missing resource or no telegram updates
- 502: telegram upstream/network failure
- 500: unexpected backend failure
