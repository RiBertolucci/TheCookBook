# Backend Structure

## Root Layout

```text
backend/
|-- package.json
|-- README.md
|-- STRUCTURE.md
|-- content/
|   |-- Recipes/
|   |-- Ingredients/
|   |   |-- SpicesAndHerbs/
|   |-- .indexes/                # generated
|   |-- .telegram/               # generated
|   `-- sync-metadata.json       # generated
`-- src/
    |-- app.js
    |-- server.js
    |-- index.js
    |-- controllers/
    |-- routes/
    |-- services/
    |-- middleware/
    `-- utils/
```

## HTTP Application Layer

### `src/app.js`

- Creates Express app.
- Registers middleware and all route modules.

### `src/server.js`

- Loads env via `dotenv`.
- Starts HTTP server.

### `src/middleware/request-id.middleware.js`

- Attaches request identifier used by logs/controllers.

## Routing and Controllers

### Routes

- `src/routes/system.routes.js`
- `src/routes/content-read.routes.js`
- `src/routes/content-write.routes.js`

### Controllers

- `src/controllers/system.controller.js`
- `src/controllers/content-read.controller.js`
- `src/controllers/content-write.controller.js`

Controller responsibilities:

- Request validation and status mapping.
- Delegation to services.
- Stable JSON response shapes.

## Services

### Content and Files

- `src/services/fileReader.js`: read hierarchy and markdown files.
- `src/services/content-storage.service.js`: write/delete filesystem operations.
- `src/services/parser.js`: markdown section parsing and updates.
- `src/services/linker.js`: sync/linking logic for cross-file relations.
- `src/services/metadata.js`: metadata tracking for sync.
- `src/services/sync.js`: sync orchestration.

### Indexing

- `src/services/index-store.service.js`: persistent index loading/writing/rebuild.
- `src/services/index-search.service.js`: index-based search operations.
- `src/services/index-validator.js`: index schema validation.
- `src/services/ingredient-families.service.js`: family/group transformations.
- `src/services/index-adapters/registry.js`: adapter registry.
- `src/services/index-adapters/recipes-by-ingredients.adapter.js`
- `src/services/index-adapters/ingredients-by-goes-with-ingredients.adapter.js`
- `src/services/index-adapters/ingredients-catalog.adapter.js`

### Telegram

- `src/services/telegram-shopping.service.js`: Telegram send/load/target operations.

### Support

- `src/services/logger.js`: structured logging helper.

## Utilities

### `src/utils/content-path.utils.js`

- Path normalization and safety checks.
- Section-to-folder mapping helpers.

## CLI Entry

### `src/index.js`

- Provides `sync` command used by `npm run sync`.

## Runtime and Data Flow

1. Request reaches route module.
2. Controller validates input and calls service layer.
3. Services read/write markdown and indexes under `content/`.
4. Controller returns JSON response with appropriate status code.

## Generated Files and Folders

- `content/.indexes/*.json`: persistent indexes.
- `content/.telegram/*.json`: Telegram targets and last-list snapshots.
- `content/sync-metadata.json`: sync file tracking.
