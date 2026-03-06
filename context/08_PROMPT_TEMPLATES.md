# Prompt Templates (Token-Efficient)

Use these to brief another LLM quickly.

## Template: Backend API Change
Context files:
- `context/01_PROJECT_BRIEF.md`
- `context/03_BACKEND_API.md`
- `context/04_BACKEND_MAP.md`
Task:
- "Implement <feature> in backend only. Update routes, controller, service, and docs. Keep existing API behavior stable unless specified. Return changed files + verification steps."

## Template: Frontend UI Fix
Context files:
- `context/01_PROJECT_BRIEF.md`
- `context/05_FRONTEND_MAP.md`
Task:
- "Fix <ui-bug>. Keep style consistent. Update component html/ts/css. Include fast validation command."

## Template: Telegram Issue
Context files:
- `context/01_PROJECT_BRIEF.md`
- `context/07_TELEGRAM_FLOW.md`
Task:
- "Diagnose Telegram issue <symptom>. Verify endpoint, env, and runtime process state. Provide root cause + minimal patch."

## Template: Fast Onboarding
Context files:
- `context/00_READ_ORDER.md`
- `context/01_PROJECT_BRIEF.md`
- `context/02_RUNBOOK.md`
Task:
- "Summarize architecture in <=12 bullets and list exact run commands for local dev."

## Prompt Hygiene Rules
- Ask for exact file paths in output.
- Ask for one verification command per change set.
- Ask model to avoid broad refactors unless requested.
- Ask model to preserve existing behavior first.
