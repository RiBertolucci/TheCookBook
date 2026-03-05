# Backend Project Structure

## Directory Layout

```
backend/
├── package.json              # Node dependencies and scripts
├── .gitignore                # Git exclusions
├── README.md                 # Backend documentation
│
├── content/                  # Markdown repository (scanned during sync)
│   ├── Recipes/              # Recipe files (.md)
│   ├── Ingredients/          # Ingredient files (.md)
│   └── SpicesAndHerbs/       # Spice and herb files (.md)
│   └── sync-metadata.json    # Metadata (auto-generated, tracks file changes)
│   └── .indexes/             # Persistent search indexes (auto-generated JSON)
│
└── src/                      # Application source code
    ├── index.js              # CLI entry point (npm run sync)
    ├── server.js             # HTTP server (Express, npm start)
    │
    └── services/             # Core business logic
        ├── index-adapters/   # One adapter per index (preprocessing + mapping)
        │   ├── registry.js
        │   ├── recipes-by-ingredients.adapter.js
        │   └── ingredients-by-goes-with-ingredients.adapter.js
        ├── metadata.js       # Tracks file creation/modification times
        ├── parser.js         # Markdown parsing and link formatting
        ├── linker.js         # Cross-document linking logic
        ├── index-store.service.js # Generic key-set persistent indexing engine
        └── sync.js           # Main sync orchestration
```

## Service Layers

### `services/metadata.js`
- Manages persistent file tracking via JSON.
- Detects new and modified files.

### `services/parser.js`
- Parses markdown sections and extracts bullet-point items.
- Determines document type (recipe, ingredient, spice).
- Handles link formatting and section updates.

### `services/linker.js`
- Orchestrates linking logic for each document type.
- Handles ingredient, recipe, and spice/herb processing.
- Calls parser helpers to read and update markdown.

### `services/sync.js`
- Main orchestration module.
- Scans directories recursively.
- Delegates to metadata and linker services.

## Usage

```bash
# Start HTTP server (port 3000)
npm start

# Trigger sync via CLI
npm run sync

# Trigger sync via HTTP
POST http://localhost:3000/sync
```
