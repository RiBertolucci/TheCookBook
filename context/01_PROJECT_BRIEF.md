# Project Brief

Last-verified: 2026-03-06
Name: TheCookBook
Type: Full-stack cookbook app (Angular + Node/Express)
Primary-data-store: Markdown files on disk

## Workspace Roots
- `backend/`
- `frontend/`
- `tests/`
- `context/` (LLM context pack)

## Main Product Flows
- Browse recipes and ingredients from markdown files, including spices/herbs under `Ingredients/SpicesAndHerbs`.
- Edit and create markdown files from UI.
- Auto-link recipe ingredients/spices and ingredient `Used for` recipe references.
- Index-based search.
- Shopping list + Telegram send/load.
- Ingredients mixer suggestions based on overlap of selected ingredients' `Goes with ingredients` and `Goes with spicesAndHerbs` sections, with Telegram send/load.

## Runtime Ports
- Frontend dev: `http://localhost:4200`
- Backend API: `http://localhost:3000`
- Proxy: frontend `/api` -> backend `:3000`

## Key Facts
- Backend loads env from `backend/.env` via `dotenv`.
- Content roots: `backend/content/Recipes` and `backend/content/Ingredients`.
- Spices/herbs are stored under `backend/content/Ingredients/SpicesAndHerbs`.
- Canonical spice links use `/api/ingredients/SpicesAndHerbs/<relative-path>.md`.
- Legacy read alias `/api/spices/*filename` is still supported.
- Generated backend artifacts:
- `backend/content/sync-metadata.json`
- `backend/content/.indexes/*.json`
- `backend/content/.telegram/*.json`

## High-Value Entry Files
- Backend app bootstrap: `backend/src/app.js`
- Backend server start: `backend/src/server.js`
- Frontend root module: `frontend/src/app/app.module.ts`
- Frontend shell/settings: `frontend/src/app/app.component.ts`
