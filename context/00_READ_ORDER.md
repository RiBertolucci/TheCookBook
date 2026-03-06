# Context Read Order (LLM-Optimized)

Last-verified: 2026-03-06
Goal: Load minimal files for maximal context accuracy.

## Core Rule
- Read files in numeric order.
- Stop as soon as required confidence is reached.
- Prefer short files first, deep files only on demand.

## Default Load
1. `context/01_PROJECT_BRIEF.md`
2. `context/02_RUNBOOK.md`
3. `context/03_BACKEND_API.md`
4. `context/05_FRONTEND_MAP.md`

## Task-Based Load
- Build/run/debug setup:
1. `context/01_PROJECT_BRIEF.md`
2. `context/02_RUNBOOK.md`
3. `context/09_TROUBLESHOOTING.md`

- Backend feature/API work:
1. `context/01_PROJECT_BRIEF.md`
2. `context/03_BACKEND_API.md`
3. `context/04_BACKEND_MAP.md`
4. `context/07_TELEGRAM_FLOW.md` (only if Telegram related)

- Frontend/UI work:
1. `context/01_PROJECT_BRIEF.md`
2. `context/05_FRONTEND_MAP.md`
3. `context/06_CONTENT_MODEL.md`

- Prompting another LLM/agent:
1. `context/01_PROJECT_BRIEF.md`
2. `context/08_PROMPT_TEMPLATES.md`
3. Add only one domain file (`03`, `04`, `05`, or `07`).

## Compression Policy
- Keep bullets flat (no nested bullets).
- Keep one fact per line.
- Use path literals instead of prose.
- Prefer key:value over sentences.
