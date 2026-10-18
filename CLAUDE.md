# CLAUDE.md

## Project

Wolvo is an Australian online auction marketplace.

| Layer    | Stack                                                              | Path         |
| -------- | ------------------------------------------------------------------ | ------------ |
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query  | `frontend/`  |
| Backend  | NestJS + TypeScript                                                | `backend/`   |
| Database | PostgreSQL                                                         | (via `backend/` migrations) |

- `docs/` — the project reference and notes folder. Check it first for requirements and context; write any notes, plans or decisions there as markdown.
- `docs/assessment/` — assessment report, inventory, gap analysis, dependencies.
- `docs/Completed-task.md` — log of completed tasks (see "After each task").
- Current state: `frontend/` is the exported Base44 app (still `.jsx`, Base44 SDK; its own notes are in `frontend/AGENTS.md`). `backend/` is empty and will hold the NestJS API.

## Data rules

- Money is always **integer cents (AUD)**. Never use floats for money, in the DB, API or UI state. Format to dollars only at display time.
- Timestamps are **`timestamptz` stored in UTC**. The API sends ISO-8601 UTC; the UI converts to the user's local time for display.

## API rules

- Every permission, bidding and payment rule is enforced in the API, never only in the UI. UI checks are convenience only.
- Validate every request with DTOs (class-validator / class-transformer, global `ValidationPipe` with whitelist).
- Return one consistent error shape from every endpoint (single global exception filter).
- Keep the OpenAPI (Swagger) spec current with every endpoint/DTO change.

## Database rules

- Schema changes only through migrations.
- Never edit a migration that has already been applied; add a new one instead.

## Security

- Never log or commit secrets, tokens, passwords or personal/identity documents.
- Secrets live in local `.env` files (gitignored); commit only `.env.example` with placeholder values.

## Scope

- Only change what the task needs. No unrelated refactoring, renaming or reformatting.

## After each task

1. Run, for every package touched (`frontend/`, `backend/`):
   - lint
   - type check
   - unit tests
   - e2e tests — against a real PostgreSQL database (not mocks, not SQLite)
2. Fix anything you broke.
3. List the changed files.
4. Add an entry to `docs/Completed-task.md` (date, task, summary, changed files, check results).
5. Commit with a clear message.
