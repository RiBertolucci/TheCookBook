# Content Model (Markdown)

Last-verified: 2026-03-06
Storage root: `backend/content`

## Sections
- `Recipes/`
- `Ingredients/`
- `SpicesAndHerbs/`

## Recipe Expected Blocks
- `# <Title>`
- `## Ingredients`
- `## Procedure`

## Ingredient Expected Blocks
- `# <Title>`
- `## Properties`
- `## Substitutes`
- optional pairing sections used by linker/indexing

## Spice/Herb Expected Blocks
- `# <Title>`
- `## Mixes Well With`
- `## Good With Ingredients`

## Linking Pattern
- Canonical links generally point to API paths:
- Ingredients: `/api/ingredients/<relative-path>.md`
- Spices: `/api/spices/<relative-path>.md`
- Recipes: `/api/recipes/<relative-path>.md`

## Generated/Derived Data
- `sync-metadata.json`: file tracking
- `.indexes/*.json`: search/index snapshots
- Ingredient families and suggestions are API-derived from indexes
