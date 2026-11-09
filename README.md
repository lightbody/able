<!-- able:template-start -- PLAYBOOK.md removes this block in new apps -->
# Able

A TypeScript app skeleton, plus a playbook that Claude Code follows to turn
it into a new, fully deployed app: production and per-PR preview
environments, with sign-in and live data working end to end.

**To start a new app** with Claude Code on the web (claude.ai/code works
fine from a phone or tablet), give the app a cloud environment of its own,
named after it, e.g. `chore-chart`. Every session on the app, starting with
the setup session, runs there, so its tokens never reach your other
projects. Either:

- **Full network access:** on the new-session screen, tap the environment
  selector (the first control under the message box) → **New
  environment**, type the name, set **Network access** to **Full**, tap
  **Add environment**, and start the session on it (no repository
  needed); or
- **Limited network access:** start a session on any environment. Claude
  asks the app's name first, offers to create a Limited one with the hosts
  it needs, and moves the session onto it. You add three wildcard hosts
  for PR previews when it asks.

Then paste:

> Read https://github.com/lightbody/able/blob/main/PLAYBOOK.md and follow
> it to set up a new app for me. Ask me what it's called first.

Claude asks for a name, walks you through creating accounts and API
tokens, and does the rest: it renames the skeleton, provisions Neon, Fly and
Cloudflare, configures CI, and verifies production and previews. A custom domain is
an optional last step. Claude asks for each token with only the
permissions it needs at the time, and has you narrow them once setup is
done, so later sessions can debug the app without setup-level access.

The landing page at **https://able.lightbody.net** lives in `site/` and
deploys with `.github/workflows/site.yml`. New apps don't get either.

Everything below describes the app that results, with `My App` / `myapp`
as placeholder names.

---
<!-- able:template-end -->

# My App

"Hello world" for a new app: a Postgres table seeded with a greeting, synced
live to the browser through Neon Realtime, plus a form that writes a new one
back through the backend, all gated behind WorkOS sign-in. Replace it with
real features as they land.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + TypeScript (Fastify, `pg`), deployed on Fly.io |
| Shared code | `@myapp/shared` npm workspace, used by both backend and frontend |
| Database | Neon (serverless Postgres) |
| Realtime | Neon Realtime live SQL queries, sealed by the backend |
| Auth | WorkOS AuthKit (stateless bearer JWTs) |
| Frontend | React + Vite SPA on Cloudflare Pages |
| CI/CD | GitHub Actions with per-PR preview stacks |

### How it fits together

- **Auth**: the frontend signs in via WorkOS AuthKit and attaches the
  resulting bearer token to every backend call. The backend validates it
  against WorkOS's JWKS (fetched once at boot) -- see `backend/src/auth.ts`.
- **Reads** flow through [Neon Realtime](https://neon.com/docs/realtime/overview).
  The client asks the backend for a named view (`POST /live/greetings`).
  The backend checks the token, then *seals* that view's fixed SQL query:
  it signs and encrypts the query with the branch's `NEON_REALTIME_SECRET`,
  valid for 60s. The browser subscribes to the sealed query over a WebSocket
  straight to Neon's Live SQL API, and renews it through the backend before
  it expires. The client can never change the SQL or its parameters. Views
  don't yet scope rows to a particular user -- every signed-in user sees the
  same shared view.
- **Writes** are plain REST calls (`POST /greetings`), also behind auth. The
  backend validates and inserts into Postgres (recording who wrote it), then
  returns the write's transaction id. The client waits for that txid to
  arrive on its live query (`awaitTxId`), so it knows its own write has
  synced.
- `GET /me` is a minimal smoke-test endpoint: it just echoes back the
  authenticated user's WorkOS id, to confirm the token round-trips.

## Layout

```
backend/     Node/Fastify API + migrations
shared/      @myapp/shared -- placeholder shared logic (used by backend + frontend)
frontend/    React SPA
docker-compose.yml   Postgres for backend tests
.github/     CI workflows + preview-env scripts
```

## Local development

Neon Realtime only runs on Neon -- there's no local live query engine -- so
local dev runs against your own Neon branch rather than a local Postgres. You
need the [Neon CLI](https://neon.com/docs/cli) (`npm i -g neon`, then
`neon login`).

```bash
# 1. Install dependencies (npm workspaces -- run once from the repo root)
npm install

# 2. Create your dev branch (once). It inherits Realtime from the default branch.
neon branches create --project-id $NEON_PROJECT_ID --name dev/<you> --parent <default branch>
neon realtime enable --project-id $NEON_PROJECT_ID --branch dev/<you> \
  --allowed-origin http://localhost:5173

# 3. Backend
cd backend
cp .env.example .env
cp .env.local.example .env.local   # fill in WORKOS_JWKS_URL, then:
neon env pull --project-id $NEON_PROJECT_ID --branch dev/<you> \
  --service postgres --service realtime --file .env.local
npm run dev                        # tsx watch src/main.ts; runs migrations on startup, listens on :8080

# 4. Frontend
cd frontend
cp .env.example .env
cp .env.local.example .env.local   # fill in VITE_WORKOS_CLIENT_ID
npm run dev                        # Vite dev server on :5173, proxies /api -> :8080
```

Open http://localhost:5173, sign in, and you should see "Hello, My App!"
from the seeded row -- adding a greeting in the form should show up instantly
(open a second tab to watch it sync). `neon realtime subscribe --branch
dev/<you> "SELECT * FROM greetings"` shows the same live query from the
terminal.

### Tests

```bash
npm test --workspace=shared        # pure-function unit tests
npm test --workspace=backend       # HTTP integration tests (needs Postgres: `docker compose up`)
cd frontend && npm test            # currently no frontend tests; add as components appear
```

## Deploy setup

All non-secret deploy config lives in `.github/deploy.env`: the Neon project
ID, database and default branch; the Fly org and app name; the Cloudflare
account and Pages project; the prod frontend origin; and the WorkOS client
ID. Every workflow loads it first. The only GitHub secrets are three API
tokens: `NEON_API_KEY` (project-scoped), `FLY_API_TOKEN` (org token, since
previews create apps), and `CLOUDFLARE_API_TOKEN` (Account → Cloudflare
Pages → Edit). **[`SECRETS.md`](SECRETS.md)** covers what each token is,
where it lives, and how to rotate it.

Nothing else is copied by hand. On every deploy,
`.github/actions/deploy-backend` pulls the target Neon branch's pooled
`DATABASE_URL` and its `NEON_REALTIME_URL`/`NEON_REALTIME_SECRET` with
`neon env pull`, stages them as Fly secrets, and passes the non-secret
runtime config (`NEON_DB_NAME`, `WORKOS_JWKS_URL`, `ALLOWED_ORIGIN`) as
`--env`. Rotating the Neon password or Realtime secret therefore needs only
a redeploy.

One-time state outside the repo (set up by PLAYBOOK.md):

- **Neon** -- a project in a
  [Realtime region](https://neon.com/docs/realtime/overview#which-regions-is-it-enabled-in)
  (`aws-us-east-1` sits next to Fly's `iad`; PLAYBOOK.md step 1 pairs each
  Realtime region with a Fly region, set as `primary_region` in
  `fly.backend.toml`). Realtime is enabled on the
  default branch, with allowed origin `PROD_FRONTEND_ORIGIN`. Preview
  branches inherit Realtime, and `preview.yml` widens their origins to `*`.
- **Cloudflare Pages** -- a direct-upload project, `CLOUDFLARE_PAGES_PROJECT`,
  with production branch `main`.
- **Fly** -- nothing. The deploy action creates apps on demand in `FLY_ORG`.
- **WorkOS** (Production environment only: prod and every PR preview share
  it; Staging and Development aren't used) -- on the application's
  **Redirects** tab, Redirect URIs (the prod origin is the default) and
  Sign-out URIs (just the prod origin, as the default: the app's sign-out
  names no return address; the other four address settings stay empty),
  and on its **Session** tab, the CORS origins under **Manage**:
  `PROD_FRONTEND_ORIGIN`, plus `https://*.<pages project>.pages.dev` for
  previews. Enter them with **no trailing slash**. The app sends the bare
  origin (`window.location.origin`), and WorkOS matches wildcard entries
  exactly, so `…pages.dev/` rejects every preview. You can check an entry
  without signing in: `GET
  https://api.workos.com/user_management/authorize?client_id=<id>&redirect_uri=<origin>&response_type=code&provider=authkit`
  redirects to `error.workos.com/redirect-uri-invalid` when the origin isn't
  registered.

Prod is served at `PROD_FRONTEND_ORIGIN`. To move it (e.g. to a custom
domain), attach the domain to the Pages project, update
`PROD_FRONTEND_ORIGIN`, re-run
`neon realtime enable --branch <default branch> --allowed-origin <origin>`,
and add it to the WorkOS Redirect URIs and Sign-out URIs (as the default in
both) and CORS origins. Sign-in and API calls
work only from `PROD_FRONTEND_ORIGIN`.

Every pull request gets an isolated preview stack: a Realtime-enabled Neon
branch, a dedicated backend Fly app and a Pages preview. It's torn down when
the PR closes.
