<!-- able:begin template -->
# Able

A TypeScript app skeleton, plus a playbook that Claude Code follows to turn
it into a new, fully deployed app: a Production environment and a Preview
for every pull request, with the parts you choose working end to end.

**To start a new app** with Claude Code on the web (claude.ai/code works
fine from a phone or tablet), do these first. A cloud session starts from
a repo and runs on an environment, both chosen before it starts, so they
can't be part of the playbook itself:

1. **Name your app**, e.g. `Todoable` (its **App Name**), and write the
   same name in lowercase, with hyphens instead of spaces: `todoable`, its
   **App Handle**. (https://able.lightbody.net does this for you, and fills
   in the steps and the prompt.)
2. **Make the app's repo from this template** at
   https://github.com/new?template_owner=lightbody&template_name=able&owner=@me&visibility=private&name=todoable
   (change `name=` to your App Handle). The repository name must be the
   App Handle.
3. **Connect GitHub to Claude Code.**
4. **Create the app's Agent Environment**: a cloud environment in Claude
   Code named with the App Name, with **Full** network access. (For
   **Limited** access instead, start on any environment and ask Claude to
   create one.)
5. **Start a session** on the Agent Environment with the new repo
   selected, and paste:

> Read https://github.com/lightbody/able/blob/main/PLAYBOOK.md and follow
> it to set up my new app. App Name: "Todoable". App Handle: `todoable`.
> I've made the `todoable` repo from the Able template and a cloud
> environment named "Todoable", and this session should be on both. Check
> that first.

(with your own App Name and App Handle in place of `Todoable` and
`todoable`)

With another coding agent, make the repo the same way, open the agent in
a clone of it, and paste the same prompt.

Claude checks the repo and the Agent Environment (and helps fix either),
asks what the app needs, walks you through creating accounts and API
tokens, and does the rest. Every app gets a page on Cloudflare Pages. You
choose what goes behind it: an API (Fly), sign-in (WorkOS), a database
with live updates (Neon), observability (Grafana Cloud) and a custom
domain. Claude removes what you didn't choose, provisions the rest,
configures CI, and verifies Production and Previews. Claude asks for each token with only the
permissions it needs at the time, and has you narrow them once setup is
done, so later sessions can debug the app without setup-level access.

The landing page at **https://able.lightbody.net** lives in `site/` and
deploys with `.github/workflows/site.yml`. New apps don't get either.

The app's optional parts (`backend`, `auth`, `postgres`, `observability`)
are **Modules**. `able/README.md` describes how the template marks them,
for anyone changing Able itself; new apps don't get `able/` either.

Everything below describes the app that results, with `My App` / `myapp`
as placeholder names. `PLAYBOOK.md` opens with a glossary ("Terms") of the
names it uses: the App Name, the App Handle, the App Environments
(Development, Preview, Production) and the Agent Environment.

---
<!-- able:end -->

# My App

"Hello world" for a new app, with everything it was set up with working
end to end. Replace it with real features as they land.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite SPA on Cloudflare Pages |
| Backend | Node.js + TypeScript (Fastify), deployed on Fly.io | <!-- able:only backend -->
| Shared code | `@myapp/shared` npm workspace, used by both backend and frontend | <!-- able:only backend -->
| Auth | WorkOS AuthKit (stateless bearer JWTs) | <!-- able:only auth -->
| Database | Neon (serverless Postgres, `pg`) | <!-- able:only postgres -->
| Realtime | Neon Realtime live SQL queries, sealed by the backend | <!-- able:only postgres -->
| Observability | Grafana Faro → Grafana Cloud (Frontend Observability) | <!-- able:only observability -->
| CI/CD | GitHub Actions, with a Preview for every pull request |

### How it fits together

- **The page** (`frontend/src/App.tsx`) is a single-page app. Each feature
  adds one line to it.
<!-- able:begin backend -->
- **The API**: the page calls the backend's `GET /hello` and shows the
  greeting it returns, which proves the two can talk and that both use the
  same code from `shared/`.
<!-- able:end -->
<!-- able:begin auth -->
- **Auth**: the frontend signs in via WorkOS AuthKit and attaches the
  resulting bearer token to every backend call. The backend validates it
  against WorkOS's JWKS (fetched once at boot) -- see `backend/src/auth.ts`.
- `GET /me` is a minimal smoke-test endpoint: it just echoes back the
  authenticated user's WorkOS id, to confirm the token round-trips.
<!-- able:end -->
<!-- able:begin postgres -->
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
<!-- able:end -->
<!-- able:begin observability -->
- **Telemetry**: page loads, errors and requests are recorded, each
  labelled with the deploy it came from. See "Observability" below.
<!-- able:end -->

## Layout

| Path | What's there |
|---|---|
| `frontend/` | React SPA |
| `backend/` | Node/Fastify API | <!-- able:only backend -->
| `backend/migrations/` | SQL migrations, applied when the backend boots | <!-- able:only postgres -->
| `shared/` | `@myapp/shared` -- placeholder shared logic (used by backend + frontend) | <!-- able:only backend -->
| `observability/` | Grafana Frontend Observability app spec | <!-- able:only observability -->
| `scripts/` | `gcx` -- Grafana's CLI, installed on first use, for querying telemetry | <!-- able:only observability -->
| `docker-compose.yml` | Postgres for backend tests | <!-- able:only postgres -->
| `.github/` | CI workflows and the scripts they use |

## Local development

This is the **Development** environment, alongside **Preview** (one per
PR) and **Production** (deployed from `main`).

```bash
# Install dependencies (npm workspaces -- run once from the repo root)
npm install
```

<!-- able:begin postgres -->
Neon Realtime only runs on Neon -- there's no local live query engine -- so
local dev runs against your own Neon branch rather than a local Postgres. You
need the [Neon CLI](https://neon.com/docs/cli) (`npm i -g neon`, then
`neon login`).

```bash
# Create your dev branch (once). It inherits Realtime from the default branch.
neon branches create --project-id $NEON_PROJECT_ID --name dev/<you> --parent <default branch>
neon realtime enable --project-id $NEON_PROJECT_ID --branch dev/<you> \
  --allowed-origin http://localhost:5173
```

<!-- able:end -->
<!-- able:begin backend -->
```bash
# Backend
cd backend
cp .env.example .env
cp .env.local.example .env.local
```

<!-- able:begin auth -->
Fill in `WORKOS_JWKS_URL` in `backend/.env.local`.

<!-- able:end -->
<!-- able:begin postgres -->
```bash
# Still in backend/: add your Neon branch's credentials
neon env pull --project-id $NEON_PROJECT_ID --branch dev/<you> \
  --service postgres --service realtime --file .env.local
```

<!-- able:end -->
```bash
npm run dev                        # tsx watch; listens on :8080
```

<!-- able:end -->
```bash
# Frontend
cd frontend
cp .env.example .env
cp .env.local.example .env.local   # fill in VITE_WORKOS_CLIENT_ID # able:only auth
npm run dev                        # Vite dev server on :5173
```

Open http://localhost:5173 and you should see "My App".
<!-- able:begin backend -->
Under it is "Hello from the API!", fetched from the backend (Vite proxies
`/api` to :8080).
<!-- able:end -->
<!-- able:begin auth -->
You're asked to sign in first.
<!-- able:end -->
<!-- able:begin postgres -->
Below that is "Hello, My App!" from the seeded row -- adding a greeting in
the form should show up instantly (open a second tab to watch it sync).
`neon realtime subscribe --branch dev/<you> "SELECT * FROM greetings"`
shows the same live query from the terminal.
<!-- able:end -->

### Tests

```bash
npm test --workspace=shared        # pure-function unit tests # able:only backend
npm test --workspace=backend       # HTTP integration tests # able:only backend
cd frontend && npm test            # currently no frontend tests; add as components appear
```

<!-- able:begin postgres -->
The backend's tests need Postgres: `docker compose up`.

<!-- able:end -->
## Deploy setup

All non-secret deploy config lives in `.github/deploy.env`: the Cloudflare
account and Pages project, the prod frontend origin, and the IDs of each
other service the app uses. Every workflow loads it first. The only GitHub
secrets are a few API tokens, the CI Tokens:

- `CLOUDFLARE_API_TOKEN` (an account API token: Account → Cloudflare
  Pages → Edit)
<!-- able:begin backend -->
- `FLY_API_TOKEN` (org token, since Previews create apps)
<!-- able:end -->
<!-- able:begin postgres -->
- `NEON_API_KEY` (project-scoped)
<!-- able:end -->
<!-- able:begin observability -->
- `GRAFANA_OTLP_TOKEN` (write-only telemetry) <!-- able:only backend -->
<!-- able:end -->

**[`SECRETS.md`](SECRETS.md)** covers what each token is, where it lives,
and how to rotate it.

<!-- able:begin backend -->
Nothing else is copied by hand. On every deploy,
`.github/actions/deploy-backend` runs one step per feature, then deploys,
passing the non-secret runtime config (such as `ALLOWED_ORIGIN`) as
`--env`.
<!-- able:end -->
<!-- able:begin postgres -->
Its `postgres-stage` step pulls the target Neon branch's pooled
`DATABASE_URL` and its `NEON_REALTIME_URL`/`NEON_REALTIME_SECRET` with
`neon env pull` and stages them as Fly secrets. Rotating the Neon password
or Realtime secret therefore needs only a redeploy.
<!-- able:end -->

One-time state outside the repo (set up when the app was created):

- **Cloudflare Pages** -- a direct-upload project, `CLOUDFLARE_PAGES_PROJECT`,
  with production branch `main`.
<!-- able:begin backend -->
- **Fly** -- nothing. The deploy action creates apps on demand in `FLY_ORG`.
  The region is `primary_region` in `fly.backend.toml`.
<!-- able:end -->
<!-- able:begin postgres -->
- **Neon** -- a project in a
  [Realtime region](https://neon.com/docs/realtime/overview#which-regions-is-it-enabled-in),
  next to the Fly region (`aws-us-east-1` sits next to Fly's `iad`).
  Realtime is enabled on the
  default branch, with allowed origin `PROD_FRONTEND_ORIGIN`. Preview
  branches inherit Realtime, and `preview.yml` widens their origins to `*`.
<!-- able:end -->
<!-- able:begin auth -->
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
<!-- able:end -->

Prod is served at `PROD_FRONTEND_ORIGIN`. To move it (e.g. to a custom
domain), attach the domain to the Pages project and update
`PROD_FRONTEND_ORIGIN`.
<!-- able:begin postgres -->
Then re-run
`neon realtime enable --branch <default branch> --allowed-origin <origin>`.
<!-- able:end -->
<!-- able:begin auth -->
Add it to the WorkOS Redirect URIs and Sign-out URIs (as the default in
both) and CORS origins.
<!-- able:end -->
<!-- able:begin backend -->
API calls work only from `PROD_FRONTEND_ORIGIN`.
<!-- able:end -->

Every pull request gets an isolated Preview: a Pages preview,
a dedicated backend Fly app, <!-- able:only backend -->
a Realtime-enabled Neon branch, <!-- able:only postgres -->
torn down when the PR closes.

<!-- able:begin observability -->
## Observability

The app sends its telemetry to a **Grafana Stack** (Grafana
Cloud; the free tier is enough to start). One stack can serve all your
apps: each app's telemetry is labelled with its App Handle
(`service.namespace`). Development and tests send nothing.

| Source | What | How it gets there |
|---|---|---|
| Frontend | page loads, Web Vitals, JS errors, fetch spans | Grafana Faro → Frontend Observability (`frontend/src/telemetry.ts`) |
| Backend | traces: HTTP (named by route), outgoing fetch; metrics: HTTP rate/errors/latency, Node runtime, the app's own counters; logs: every line, with its trace id. Plain OpenTelemetry, and the frontend's fetch spans join its traces | OTel Node SDK → the Grafana Stack's OTLP gateway (`backend/src/telemetry.ts`) | <!-- able:only backend -->
| Sign-in | the WorkOS `user.id` on every signed-in request's trace | set by `authenticate()` | <!-- able:only auth -->
| Database | `pg` query spans inside each request's trace, and pg pool metrics | the OTel `pg` instrumentation | <!-- able:only postgres -->
| Fly (optional) | machine CPU/memory/restarts, Fly edge requests and latency | Fly's built-in Prometheus, as a Grafana data source (below) | <!-- able:only backend -->

Everything is labelled `deployment.environment.name=myapp` for Production,
or `myapp-pr<n>` for a Preview, plus `service.version=<commit sha>`, so each
deploy of each app is easy to pick out, even on a shared stack. Claude Code sessions query it with
`scripts/gcx` (Grafana's CLI) through the `observability` skill, using a
read-only Claude Code Token; `AGENTS.md` "Observability" has the details.

Set up when the app was created: the Grafana Stack (an existing
one, or a new one), the Faro app
(`observability/faro-app.yaml`), the Grafana values in `deploy.env`,
the `GRAFANA_OTLP_TOKEN` CI Token <!-- able:only backend -->
and Claude's read-only service account.

<!-- able:begin backend -->
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
<!-- able:end -->
<!-- able:end -->
