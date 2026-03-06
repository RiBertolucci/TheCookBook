# Frontend Map

Last-verified: 2026-03-06
Root: `frontend/src/app`
Framework: Angular 13

## App Shell
- `app.component.ts/html/css`: toolbar, settings, tabs
- Main tabs:
- `overview` -> content browser
- `search` -> indexed search view
- `shopping` -> shopping + telegram

## Feature Components
- `features/content/browser/*`: file tree + viewer tabs
- `features/content/editor/*`: markdown create/edit forms
- `features/search/*`: search by indexes, preview pane
- `features/shopping-list/*`: list management + telegram send/load
- `features/viewer/*`: markdown rendering support

## Core Services
- `core/services/content.service.ts`: all HTTP API calls
- `core/services/shopping-list-state.service.ts`: shopping state store
- `core/services/recipe-ingredient-render.service.ts`: recipe list decoration (add button, family dropdown)
- `core/services/logger.service.ts`: client logging

## Frontend Runtime
- Dev server: `ng serve` on `:4200`
- API via proxy config in `frontend/proxy.conf.json`

## Notable UI Flows
- Settings menu contains theme + force indexing + telegram add user.
- Shopping target dropdown has send/load target pickers.
- Recipe ingredient family arrow opens variants dropdown.
