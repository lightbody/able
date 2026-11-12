# Changes to `postgres`

Notes for apps that have this Module, newest first. `able/CHANGES.md`
says how to write an entry.

## 2026-11-12: Database setup in one place, and its own deploy steps

`backend/src/db.ts` (`initDb`) creates the pool, runs migrations and sets
up sealing. Deploys use two actions: `postgres-stage` (credentials for a
deploy) and `postgres-preview-up` (a Preview's branch). The live list
moved to `frontend/src/Greetings.tsx`.

- **Why:** the database is one line in the boot sequence and one step in
  each workflow.
- **Touches:** `backend/src/db.ts`, `main.ts`;
  `.github/actions/postgres-stage/`, `postgres-preview-up/`,
  `preview.yml`; `frontend/src/Greetings.tsx`.
- **Needs from you:** nothing. Check the first Preview after taking it.
