# Recipe and Ingredient Authoring Format

Last-verified: 2026-04-26
Purpose: canonical markdown format for creating new content that works with backend parsing, linking, and suggestions.

## Why This File Exists
- Use this as context when asking Copilot/LLMs to generate new recipes or ingredient cards.
- It defines the exact section names and link style expected by backend services.
- If section names or link format are wrong, auto-linking and compatibility features can fail.

## Storage Paths
- Recipes live under: `backend/content/Recipes/...`
- Ingredients live under: `backend/content/Ingredients/...`
- Spices and herbs live under: `backend/content/Ingredients/SpicesAndHerbs/...`

## Global Markdown Rules
- First line must be a single H1 title: `# <Display Name>`
- Section headers must be H2 (`##`).
- List items in parsed sections must be bullet lines starting with `- `.
- Keep one item per bullet line.
- Use markdown links for known internal entities when possible.
- Internal API link style:
- Ingredient: `/api/ingredients/<relative-path>.md`
- Spice/Herb: `/api/ingredients/SpicesAndHerbs/<relative-path>.md`
- Recipe: `/api/recipes/<relative-path>.md`

## Recipe Format

Required sections:
- `# <Recipe Title>`
- `## Ingredients`
- `## Procedure`

Recommended optional sections:
- Short intro paragraph after title
- `## Tips`
- Domain-specific sections (for example `## Preparazione della salsa`)

Notes:
- Recipe text is meant to be written in Italian (title, intro, steps, and tips).
- Backend only parses `## Ingredients` for recipe auto-linking/back-links.
- `## Procedure` content can be numbered list (`1.`) and is not link-parsed.
- Ingredient bullets can include free text quantities before/after links.

### Recipe Template
```md
# <Recipe Title>

<Short description in 1-3 lines>

## Ingredients
- 500 g [Ingredient Name](/api/ingredients/<path>/<file>.md)
- 1 tsp [Spice Name](/api/ingredients/SpicesAndHerbs/<path>/<file>.md)
- [Related Recipe](/api/recipes/<path>/<file>.md) q.b.
- free text item allowed

## Procedure
1. Step one.
2. Step two.
3. Step three.

## Tips
- Optional tip.
```

### Recipe Ingredient Line Patterns (Accepted)
- `- 2 [cipolle](/api/ingredients/verdure/Cipolla/cipolla.md)`
- `- [sale](/api/ingredients/dispensa/sale.md) q.b.`
- `- 300 ml [brodo classico di manzo limpido](/api/recipes/Brodi/brodo-classico-di-manzo.md) caldo`
- `- zenzero fresco` (allowed, linker may auto-link on sync)

## Ingredient Format (Non-Spice)

Expected sections:
- `# <Ingredient Name>`
- `## Properties`
- `## Substitutes`
- `## Goes with ingredients`
- `## Goes with spicesAndHerbs`
- Optional: `## Used for`

Notes:
- `## Used for` is commonly maintained by sync/back-linking from recipes.
- `## Substitutes` supports plain text and linked items.
- In `## Substitutes`, explanatory text in parentheses is supported.

### Ingredient Template
```md
# <Ingredient Name>

<Short functional description>

## Properties
- Property 1
- Property 2

## Substitutes
- [Alternative Ingredient](/api/ingredients/<path>/<file>.md) (when available)
- Plain text alternative (when no file exists)

## Goes with ingredients
- [Other Ingredient](/api/ingredients/<path>/<file>.md)

## Goes with spicesAndHerbs
- [Spice or Herb](/api/ingredients/SpicesAndHerbs/<path>/<file>.md)

## Used for
- [Recipe Title](/api/recipes/<path>/<file>.md)
```

## Spice/Herb Format

Canonical sections:
- `# <Spice/Herb Name>`
- `## Goes with spicesAndHerbs`
- `## Goes with ingredients`
- Optional: `## Substitutes`
- Optional: `## Composed of` (useful for blends like Garam Masala)

Compatibility note:
- Backend still tolerates legacy headings `Mixes Well With` and `Good With Ingredients`.
- Prefer canonical names above for all new files.

### Spice/Herb Template
```md
# <Spice or Herb Name>

<Short aroma/flavor profile>

## Goes with spicesAndHerbs
- [Another Spice](/api/ingredients/SpicesAndHerbs/<path>/<file>.md)

## Goes with ingredients
- [Ingredient](/api/ingredients/<path>/<file>.md)

## Substitutes
- [Alternative](/api/ingredients/SpicesAndHerbs/<path>/<file>.md) (optional explanation)
```

## Naming and Path Conventions
- File names should be lowercase kebab-case: `patata-novella.md`.
- Folder names can be nested by family/category.
- Display title in H1 can use uppercase/accented letters.
- Link target should match real file location under `backend/content`.

## Authoring Checklist (Before Saving)
- Title is an H1 and matches intended ingredient/recipe display name.
- Required H2 sections exist with exact spelling.
- Parsed sections use `- ` bullets, one item per line.
- Internal links use `/api/...` paths (not local relative links like `./x.md`).
- Recipe has `## Ingredients` and `## Procedure`.
- Ingredient has both `## Goes with ingredients` and `## Goes with spicesAndHerbs`.

