---
module: backend
provider: Fly.io
requires:
---

# backend

A Node + TypeScript API (Fastify) on Fly.io: the Production app, and one Fly
app per Preview. It also brings `shared/`, the workspace for code used by
both the backend and the frontend.

## Files

- `backend/`
- `shared/`
- `fly.backend.toml`
- `.dockerignore`
- `.github/workflows/backend.yml`
- `.github/actions/deploy-backend/`
- `frontend/src/api.ts`
- `frontend/src/Hello.tsx`

## npm dependencies

- `frontend`: `@myapp/shared`

## Edits markers can't express

- Root `package.json`: `shared` and `backend` in `workspaces`.
- `frontend/tsconfig.json`: the `@myapp/shared` entry in `paths`.

## Deploy

- `deploy.env`: `FLY_ORG`, `FLY_BACKEND_APP`.
- CI Token: `FLY_API_TOKEN`. Claude Code Token hosts: `api.fly.io`,
  `api.machines.dev`.
- `deploy-backend` creates the Fly app if it's missing, lets each other
  module stage its secrets and settings, then deploys.
