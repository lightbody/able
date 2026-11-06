# My App

My App is a new web app. Currently a skeleton -- no domain features exist
yet, just the plumbing (Postgres -> Neon Realtime -> React, a REST write
path, and WorkOS auth gating all of it), generated from the
[Able](https://github.com/lightbody/able) template.

## Stack

- `frontend/` -- React 18 + TypeScript + Vite. Data sync via Neon Realtime
  live queries (`useSealedView` + `useLiveQuery`, in `frontend/src/realtime.tsx`
  and `App.tsx`). It holds a WebSocket straight to Neon's Live SQL API, using
  queries sealed by the backend. Auth via WorkOS AuthKit (`frontend/src/main.tsx`,
  `frontend/src/pages/Landing.tsx`).
- `backend/` -- Node + TypeScript (Fastify, `pg`), Postgres. `authenticate()`
  in `backend/src/auth.ts` validates the WorkOS bearer token on every
  protected route.
- `shared/` -- `@myapp/shared`, an npm workspace package. Consumed by
  `backend/` (compiled `shared/dist`) and by `frontend/` (via a Vite/tsconfig
  path alias straight to `shared/src`, no build step).

This repo is an npm workspaces monorepo (`"workspaces": ["shared", "frontend",
"backend"]` in the root `package.json`) -- run `npm install` once from the
repo root before working in any workspace, so `frontend`'s and `backend`'s
`node_modules/@myapp/shared` symlinks exist.

## Commands

Backend, from `backend/`:
- `npm run dev` -- tsx watch, runs migrations on startup, listens on :8080.
  Needs a Realtime-enabled Neon branch in `.env.local`. There is no local
  live query engine, so see README "Local development".
- `npm run build` -- `tsc -p tsconfig.json`.
- `npm test` -- vitest (needs Postgres on 127.0.0.1:5432: `docker compose up`
  locally; in Claude Code cloud sessions `.claude/hooks/session-start.sh`
  starts one at session start). It needs no Neon: sealing is local crypto, and the tests mint their
  own Realtime secret and decrypt the capability to check the sealed SQL.

Frontend, from `frontend/`:
- `npm run dev` -- Vite dev server on :5173, proxies `/api` -> :8080.
- `npx tsc --noEmit` -- typecheck.
- `npm run build` -- `tsc && vite build`, the full gate before calling a
  frontend change done.

## Auth gates access, not rows yet

Every route except `/health` requires a valid WorkOS bearer token
(`authenticate()` in `backend/src/auth.ts`). Live reads are authorized at *seal time*. `POST /live/:view` in
`backend/src/routes/live.ts` looks the view up in a fixed `VIEWS` registry,
builds that view's SQL from the authenticated userId, and seals it. The
client only ever names a view, and can't change the sealed SQL or its
parameters. Today no view is scoped *per user* -- every signed-in
user sees the same shared `greetings` view.

Before any view needs to be scoped to one person or household, bind the
userId into its query as a `$1` parameter. Never take it from the request.
Prefer a join through a membership table: because the join is part of the
live query, removing a member revokes their access immediately, rather than
when their 60s sealed query next fails to renew. Live queries must be
read-only, deterministic `SELECT`s (no `now()`, no `gen_random_uuid()`), on
tables with a primary key. Add a test that decrypts the capability and
asserts the SQL and params, like the existing `POST /live/:view` test.

## Deploys

- Non-secret deploy config (Neon project/branch/db, Fly org/app, Cloudflare
  account/project, prod origin, WorkOS client ID) lives in
  `.github/deploy.env`. Change it there, not in workflow files. Deploy jobs
  skip themselves while any value in it is empty
  (`.github/workflows/deploy-config.yml`).
- GitHub has only three secrets: `NEON_API_KEY`, `FLY_API_TOKEN` and
  `CLOUDFLARE_API_TOKEN` -- this app's narrowly scoped CI tokens. See
  `SECRETS.md` for scopes and rotation. `.github/actions/deploy-backend` pulls the DB URL
  and Realtime credentials from Neon on every deploy, so never set those on
  Fly by hand.
- Cloud sessions on the owner's environment may have broader `able-setup`
  API keys for `console.neon.tech`, `api.fly.io`, `api.machines.dev` and
  `api.cloudflare.com`, injected by the network proxy (separate from the CI
  tokens, and possibly revoked -- check with a read-only call first; the
  Fly one is an org token and may be for another app's org). To use the CLIs, set
  the key variable to the placeholder `proxy-injected`, e.g.
  `NEON_API_KEY=proxy-injected npx neon@<NEON_CLI version> ...`,
  `FLY_API_TOKEN=proxy-injected flyctl ...`. Direct Postgres connections
  (port 5432) are blocked from these containers, so use Neon's HTTPS SQL
  endpoint (`@neondatabase/serverless`) if you need to query a branch.
- Never print connection strings or Realtime secrets. When checking
  `neon env pull` output, match on shape (as `deploy-backend` does)
  instead of echoing values.

## Verifying UI changes in this sandbox

No harness exists yet -- the app is small enough that `npm run dev` in both
`backend/` and `frontend/` and opening the page directly is enough. If the UI
grows complex enough to need auth/routing to reach the screen under test,
add a harness page (`frontend/<name>-harness.html` + a matching `.tsx`
that renders the component with stubbed data, added to Vite's
`build.rollupOptions.input`) rather than wiring real auth into the test.
