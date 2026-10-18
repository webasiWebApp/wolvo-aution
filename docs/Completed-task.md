# Completed Tasks

## 2026-10-18 — Project rules (CLAUDE.md) and M2 branch

- **Summary:** Created the root `CLAUDE.md` with the Wolvo project rules: stack, integer-cent AUD money, UTC `timestamptz`, API-side enforcement, DTO validation, one error shape, Swagger, migrations-only DB changes, secrets policy, scope rule and the after-task checklist. Created and switched to branch `m2-marketplace-core`.
- **Changed files:**
  - `CLAUDE.md` (new)
  - `docs/Completed-task.md` (this log)
- **Checks:** Docs only, no code changed, so lint, type check, unit and e2e tests were not run. `backend/` has no code yet.

## 2026-10-18 — docs/ as the reference and notes folder

- **Summary:** Added a rule to `CLAUDE.md` that `docs/` is the place to look for project context and to write notes.
- **Changed files:** `CLAUDE.md`, `docs/Completed-task.md`
- **Checks:** Docs only, so no lint or tests were run.

## 2026-10-18 — M2 database migration and test seed

- **Summary:** `backend/` was empty and `wolvo_db` had no tables, so there was no M1 schema to extend. Set up a minimal NestJS + TypeORM backend that reads the `DB_*` settings. Added two migrations:
  - `M1Foundation`: the missing prerequisite tables (`users` with the 4 roles, `categories`, a base `auctions` table, `bids`).
  - `M2MarketplaceCore`: everything requested for M2, as one migration. It adds the auction columns M1 lacks (seller, auctioneer, status, moderation, featured, cancel reason, published date, listing details, AU `state` enum, integer-cent amounts, bidding type, start/end, viewing notes, a unique item code), the checks (amounts > 0, `end_at > start_at`, reserve null or ≥ starting bid), and the `auction_images`, `watchlist` (primary key on `user_id, auction_id`) and `audit_log` tables, plus the requested indexes.
- **Test seed** (`npm run seed:test`): 1 admin, 1 auctioneer, 2 sellers, 2 buyers, 8 categories, 10 listings across every status (2 draft, 2 upcoming, 3 open including 1 hidden and 1 featured, 2 closed, 1 cancelled), 7 bids and 3 watchlist entries. Marked as test data: `@test.wolvo.invalid` emails, `TEST` names, `[TEST]` titles, `TEST-` item codes. Re-running it replaces the old test data, and it refuses to run with `NODE_ENV=production`.
- **Migration runs:** a fresh database (`wolvo_fresh_check`, dropped afterwards) and the current `wolvo_db` both applied both migrations; re-running reported "No migrations are pending". Both databases ended up with identical tables and seed counts.
- **Decision:** chose TypeORM, to match the `DB_*` configuration style.
- **Changed files:** `backend/.env.example`, `backend/.gitignore`, `backend/package.json`, `backend/package-lock.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/eslint.config.mjs`, `backend/jest.config.js`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/config/database.config.ts`, `backend/src/config/database.config.spec.ts`, `backend/src/database/data-source.ts`, `backend/src/database/migrations/1792281600000-M1Foundation.ts`, `backend/src/database/migrations/1792285200000-M2MarketplaceCore.ts`, `backend/src/database/seeds/test-seed.ts`, `backend/src/database/seeds/test-seed.spec.ts`, `backend/src/database/seeds/run-test-seed.ts`, `backend/test/jest-e2e.json`, `backend/test/database.e2e-spec.ts`, `docs/Completed-task.md`. `backend/.env` holds the local password and is gitignored, not committed.
- **Checks:** lint ✅, type check ✅, build ✅, unit tests 8/8 ✅, e2e tests 11/11 ✅. The e2e tests run against a real PostgreSQL database (`wolvo_test`, created and dropped each run). They cover the migrations, columns, indexes, every check, watchlist uniqueness, seed re-runs, the Nest app starting against the database, and both migrations reverting cleanly. Frontend untouched, so its checks were not run.

## 2026-10-18 — graphify knowledge graph for code search

- **Summary:** Built a graphify knowledge graph of the repo (266 files: 250 code, 16 docs) with 1,205 nodes, 2,928 edges and 65 labelled communities. Ran `graphify claude install`, which added a `## graphify` section to `CLAUDE.md`: codebase questions go through `graphify query` / `path` / `explain` before raw file searches, and `graphify update .` runs after code changes. Its search-reminder hooks are in `.claude/settings.local.json`, which is personal and not committed because it holds a machine-specific path. `graphify-out/` is generated, so it is gitignored.
- **Changed files:** `CLAUDE.md`, `.gitignore` (new), `docs/Completed-task.md`
- **Checks:** Docs and config only, so no lint or tests were run.
