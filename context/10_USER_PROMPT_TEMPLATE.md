# Reusable Prompt Template (User -> Copilot)

Use this template for every new request.

```text
You are working in the TheCookBook workspace.

Before planning or coding, read these files in order:
1) context/00_READ_ORDER.md
2) context/01_PROJECT_BRIEF.md
3) context/02_RUNBOOK.md

Then load only the task-relevant context files from context/00_READ_ORDER.md.

Task:
<WRITE YOUR REQUEST HERE>

Scope and constraints:
- Goal: <what success looks like>
- In scope: <files/components/areas allowed>
- Out of scope: <what must not be changed>
- Keep behavior backward compatible unless explicitly requested.
- Prefer minimal, focused edits.

Execution requirements:
- Implement the change directly (do not stop at analysis).
- If backend/frontend both are affected, update both.
- Run the smallest useful validation (tests/build/lint or endpoint check).
- Report changed files and why.
- If blocked, state exact blocker and best workaround.

Output format:
1) What changed
2) Validation performed
3) Notes/risks
4) Next optional steps
```

## Fast Variant (for tiny tasks)

```text
Read first:
- context/00_READ_ORDER.md
- context/01_PROJECT_BRIEF.md

Task:
<WRITE YOUR REQUEST HERE>

Do the implementation now, run a quick validation, and summarize changed files.
```

## Task Add-ons (append only when needed)

- Backend/API work:
```text
Also read:
- context/03_BACKEND_API.md
- context/04_BACKEND_MAP.md
```

- Frontend/UI work:
```text
Also read:
- context/05_FRONTEND_MAP.md
- context/06_CONTENT_MODEL.md
```

- Telegram-related work:
```text
Also read:
- context/07_TELEGRAM_FLOW.md
```

- Debugging issues:
```text
Also read:
- context/09_TROUBLESHOOTING.md
```
