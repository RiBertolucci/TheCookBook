# Content Model (Markdown)

Last-verified: 2026-03-06
Storage root: `backend/content`

## Sections
- `Recipes/`
- `Ingredients/`
- `Ingredients/SpicesAndHerbs/`

## Recipe Expected Blocks
- `# <Title>`
- `## Ingredients`
- `## Procedure`

## Ingredient Expected Blocks
- `# <Title>`
- `## Properties`
- `## Substitutes`
- Optional: `## Used for` (recipes where ingredient is used)
- Optional: `## Goes with ingredients`
- Optional: `## Goes with spicesAndHerbs`

## Spice/Herb Expected Blocks
- `# <Title>`
- `## Goes with spicesAndHerbs`
- `## Goes with ingredients`

## Linking Pattern
- Canonical links generally point to API paths:
- Ingredients: `/api/ingredients/<relative-path>.md`
- Spices: `/api/ingredients/SpicesAndHerbs/<relative-path>.md`
- Recipes: `/api/recipes/<relative-path>.md`
- Legacy spice links `/api/spices/<relative-path>.md` are still accepted by backend read routes.

## Generated/Derived Data
- `sync-metadata.json`: file tracking
- `.indexes/*.json`: search/index snapshots
- Ingredient families and suggestions are API-derived from indexes
