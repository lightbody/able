---
module: postgres
provider: Neon (Postgres and Neon Realtime)
requires: backend, auth
---

# postgres

A Neon Postgres database with migrations, live queries through Neon
Realtime (sealed by the backend), and a Neon branch for every Preview.
It requires `auth` so stored data is never reachable without sign-in.

## Files

- `backend/src/db.ts`
- `backend/src/migrate.ts`
- `backend/migrations/`
- `backend/src/routes/live.ts`
- `backend/src/routes/greetings.ts`
- `backend/test/postgres.test.ts`
- `frontend/src/Greetings.tsx`
- `frontend/src/realtime.tsx`
- `docker-compose.yml`
- `.github/actions/postgres-stage/`
- `.github/actions/postgres-preview-up/`

## npm dependencies

- `backend`: `pg`, `@neon/realtime`, `@types/pg`
- `frontend`: `@neon/realtime`, `@neon/realtime-react`

## Deploy

- `deploy.env`: `NEON_PROJECT_ID`, `NEON_PROD_BRANCH`, `NEON_DB_NAME`,
  `NEON_DB_ROLE`, `NEON_CLI`.
- CI Token: `NEON_API_KEY`. Claude Code Token host: `console.neon.tech`.
- `postgres-stage` pulls the branch's credentials from Neon on every deploy
  and stages them as Fly secrets. `postgres-preview-up` creates a Preview's
  branch.
