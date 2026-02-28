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

The server is started with `npm start` (defaults to port 3000).