<!-- able:template-start -- PLAYBOOK.md removes this block in new apps -->
# Able

A TypeScript app skeleton, plus a playbook that Claude Code follows to turn
it into a new, fully deployed app: a Production environment and a Preview
for every pull request, with sign-in and live data working end to end.

**To start a new app** with Claude Code on the web (claude.ai/code works
fine from a phone or tablet), do these first. A cloud session starts from
a repo and runs on an environment, both chosen before it starts, so they
can't be part of the playbook itself:

1. **Pick the App Name**, the app's human-readable name, e.g.
   `Chore Chart`.
2. **Connect Claude Code to GitHub** at https://claude.ai/connect-github.
3. **Make the app's repo from this template**: open
   https://github.com/lightbody/able/generate, name it after the app in
   lowercase with hyphens (`chore-chart`, the **App Handle**), choose
   **Private** and tap **Create repository**. If the Claude GitHub App is
   installed on selected repos only, add the new one at
   https://github.com/apps/claude/installations/select_target.
4. **Create the app's Agent Environment**, a cloud environment of its own,
   so its tokens never reach your other projects. On the new-session
   screen, tap the environment selector (the first control under the
   message box) → **New environment**, type the App Name, set **Network
   access** to **Full** (recommended: nothing gets blocked, during setup
   or later) and tap **Add environment**. If you'd rather limit where the
   app's sessions can connect, skip this, start on any environment and
   ask Claude for a **Limited** one: it creates it with the hosts the app
   needs, and you add three wildcard hosts for Previews.
5. **Start a session** on the Agent Environment with the new repo selected
   (not `lightbody/able`), and paste:

> Read https://github.com/lightbody/able/blob/main/PLAYBOOK.md and follow
> it to set up my new app. I've done the steps before the session: this
> session should be on my app's new repo, made from the Able template, and
> on a cloud environment named after the app. Check both first.

With another coding agent, make the repo the same way, open the agent in
a clone of it, and paste the same prompt.

Claude checks the repo and the Agent Environment (and helps fix either),
walks you through creating accounts and API tokens, and does the rest: it renames the skeleton, provisions Neon, Fly and
Cloudflare, sets up observability in Grafana Cloud, configures CI, and verifies Production and Previews. A custom
domain is an optional last step. Claude asks for each token with only the
permissions it needs at the time, and has you narrow them once setup is
done, so later sessions can debug the app without setup-level access.

The landing page at **https://able.lightbody.net** lives in `site/` and
deploys with `.github/workflows/site.yml`. New apps don't get either.

Everything below describes the app that results, with `My App` / `myapp`
as placeholder names. `PLAYBOOK.md` opens with a glossary ("Terms") of the
names it uses: the App Name, the App Handle, the App Environments
(Development, Preview, Production) and the Agent Environment.

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
| Observability | OpenTelemetry + Grafana Faro → Grafana Cloud (Tempo, Loki, Mimir, Frontend Observability) |
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
- **Telemetry**: every request is traced
  from the browser through the backend into Postgres, and logs and metrics
  carry the same trace ids. See "Observability" below.

## Layout

```
backend/     Node/Fastify API + migrations
shared/      @myapp/shared -- placeholder shared logic (used by backend + frontend)
frontend/    React SPA
observability/  Grafana Frontend Observability app spec
scripts/     gcx -- Grafana's CLI, installed on first use, for querying telemetry
docker-compose.yml   Postgres for backend tests
.github/     CI workflows + preview-env scripts
```

## Local development

This is the **Development** environment, alongside **Preview** (one per
PR) and **Production** (deployed from `main`). Neon Realtime only runs on Neon -- there's no local live query engine -- so
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
account and Pages project; the prod frontend origin; the WorkOS client
ID; and the Grafana Stack. Every workflow loads it first. The only GitHub
secrets are a few API tokens, the CI Tokens: `NEON_API_KEY`
(project-scoped), `FLY_API_TOKEN` (org token, since Previews create apps),
`CLOUDFLARE_API_TOKEN` (an account API token: Account → Cloudflare
Pages → Edit), and
`GRAFANA_OTLP_TOKEN` (write-only telemetry).
**[`SECRETS.md`](SECRETS.md)** covers what each token is, where it lives,
and how to rotate it.

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
- **WorkOS** (its Production environment only: Production and every
  Preview share it; WorkOS's Staging and Development environments aren't
  used) -- on the application's
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

Every pull request gets an isolated Preview: a Realtime-enabled Neon
branch, a dedicated backend Fly app and a Pages preview. It's torn down when
the PR closes.

## Observability

The app sends traces, metrics and logs to a **Grafana Stack** (Grafana
Cloud; the free tier is enough to start). One stack can serve all your
apps: each app's telemetry is labelled with its App Handle
(`service.namespace`). Everything is plain
OpenTelemetry; Development and tests send nothing.

| Source | What | How it gets there |
|---|---|---|
| Backend | traces: HTTP (named by route, with the WorkOS `user.id`), `pg` queries, outgoing fetch; metrics: HTTP rate/errors/latency, pg pool, Node runtime, the app's own counters; logs: every line, with its trace id | OTel Node SDK → the Grafana Stack's OTLP gateway (`backend/src/telemetry.ts`) |
| Frontend | page loads, Web Vitals, JS errors, fetch spans joined to the backend's traces | Grafana Faro → Frontend Observability (`frontend/src/telemetry.ts`) |
| Fly (optional) | machine CPU/memory/restarts, Fly edge requests and latency | Fly's built-in Prometheus, as a Grafana data source (below) |

Everything is labelled `deployment.environment.name=myapp` for Production,
or `myapp-pr<n>` for a Preview, plus `service.version=<commit sha>`, so each
deploy of each app is easy to pick out, even on a shared stack. Claude Code sessions query it with
`scripts/gcx` (Grafana's CLI) through the `observability` skill, using a
read-only Claude Code Token; `CLAUDE.md` "Observability" has the details.

PLAYBOOK.md sets this up for a new app: the Grafana Stack (an existing
one, or a new one), the Faro app
(`observability/faro-app.yaml`), the Grafana values in `deploy.env`, the
`GRAFANA_OTLP_TOKEN` CI Token and Claude's read-only service account.

**Fly's metrics (optional).** Fly keeps platform metrics for every org at
`https://api.fly.io/prometheus/<FLY_ORG>/`. To see them next to the app's
own:

1. Claude creates a Prometheus data source named **My App: Fly** (uid
   `myapp-fly-prometheus`, one per app, since each app has its own Fly
   org) without a secret. For this, its Grafana service
   account is widened for the task to **Data sources → Writer** (in its
   **Role** picker, then **Update**)
   (SECRETS.md, "Widening a token for a task").
2. In the Fly dashboard → the app's org → **Tokens**, create an Org Deploy
   Token named `myapp-grafana-fly-metrics`.
3. In Grafana → **Connections → Data sources → My App: Fly** → **HTTP headers**,
   paste it as the `Authorization` value (`FlyV1 fm2_…`, exactly one
   `FlyV1`), then **Save & test**.
4. Back to the Baseline: remove the Writer role and tap **Update**, **and**
   remove the service account from the data source's own **Permissions**
   tab.

It's an org token because Fly's dashboard can't make read-only ones;
SECRETS.md ("Tokens held by other services") says why that's acceptable and
how to rotate it.
