# My App

My App is a new web app. Currently a skeleton -- no domain features exist
yet, just the plumbing (Postgres -> Neon Realtime -> React, a REST write
path, and WorkOS auth gating all of it), generated from the
[Able](https://github.com/lightbody/able) template.

<!-- able:template-start -- PLAYBOOK.md removes this block in new apps -->
## Able's landing page (template repo only)

`site/` is Able's own marketing page, served at https://able.lightbody.net
from the Cloudflare Pages project `able-site`. It's plain static HTML/CSS
(`site/index.html`, `site/styles.css`): no build step, and not an npm
workspace. `.github/workflows/site.yml` deploys it: a push to `main` goes to
production, and a PR that touches `site/` gets a preview at
`<branch>.able-site.pages.dev`, linked from a PR comment and deleted when
the PR closes. It uses the `SITE_CLOUDFLARE_API_TOKEN` secret (Pages Edit
only), and only runs on `lightbody/able`. PLAYBOOK.md step 8 deletes
`site/`, `site.yml` and `.github/scripts/site-comment.js` from new apps, so
nothing else may depend on them. Keep the page's claims in step with what
the template and playbook actually do.
The `lightbody.net` zone makes browsers cache static files for a day
(`index.html` is always revalidated), so `site.yml` appends `?v=<commit>` to
the `styles.css` and `favicon.svg` links at deploy time. Add any new asset
file to that step's `sed` pattern, or it can go stale after a deploy.

## Terms (template repo only)

The "Terms" table in `PLAYBOOK.md` is Able's glossary: App Name, App
Handle, the App Environments (Development, Preview, Production), Agent
Environment, Claude Code Tokens, CI Tokens, Baseline and the rest. Use
those terms, capitalized as proper nouns, in the playbook, `README.md`,
`SECRETS.md`, this file and `site/`. If you add or rename one, update the
table and every file that uses it in the same change. The "Terms" section
below is the subset that stays in new apps, so keep it in step too.

<!-- able:template-end -->

## Terms

- **App Environments** -- where the app runs: **Development** (`npm run
  dev` against your own Neon branch, see README "Local development"),
  **Preview** (one per open PR, deleted when it closes) and **Production**
  (deployed from `main`). There's no shared staging environment: Previews
  take its place. Production and every Preview sign in against the
  **WorkOS Production environment**; WorkOS's own Staging and Development
  environments aren't used.
- **Agent Environment** -- the Claude Code cloud environment for this app,
  named "My App" and used for nothing else. It holds the Claude Code Tokens.
- **Claude Code Tokens** (`myapp-claude-code`) and **CI Tokens**
  (`myapp-ci`) -- Claude's and GitHub Actions' separate API tokens for
  Neon, Fly, Cloudflare and Grafana Cloud. **Baseline** -- the
  permissions the Claude Code Tokens keep between tasks. See `SECRETS.md`.
- **Grafana Stack** -- the Grafana Cloud instance the app sends its
  telemetry to, `GRAFANA_STACK_URL`. One stack usually serves several
  apps; each app's telemetry carries its own `service.namespace` (the App
  Handle).

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
- Observability -- OpenTelemetry from the backend and Grafana Faro
  from the frontend, to the Grafana Stack. See "Observability" below.

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
  account/project, prod origin, WorkOS client ID, Grafana Stack) lives in
  `.github/deploy.env`. Change it there, not in workflow files. Deploy jobs
  skip themselves while any value in it is empty
  (`.github/workflows/deploy-config.yml`).
- The only GitHub secrets are a few API tokens, this app's narrowly scoped
  CI Tokens (`NEON_API_KEY`, `FLY_API_TOKEN`, `CLOUDFLARE_API_TOKEN` and
  `GRAFANA_OTLP_TOKEN`). See
  `SECRETS.md` for scopes and rotation. `.github/actions/deploy-backend` pulls the DB URL
  and Realtime credentials from Neon on every deploy, so never set those on
  Fly by hand.
- Cloud sessions on the Agent Environment (Full or Limited network
  access: see `SECRETS.md`) have the `myapp-claude-code` Claude Code
  Tokens, injected by the network proxy and separate from the CI Tokens:
  `console.neon.tech` (project-scoped), `api.fly.io` and `api.machines.dev`
  (an org deploy token for `FLY_ORG`, so Production and every Preview app),
  `api.cloudflare.com` (Pages Edit, Account Settings and Account Analytics
  Read, plus DNS and Zone Read for a custom domain), and the Grafana
  Stack's host (a Viewer service account: see "Observability"). They may
  be missing or revoked, so check with a read-only call first. If a host is refused on a
  Limited Agent Environment, propose adding that exact host rather than working
  around it. To use the CLIs, set
  the key variable to the placeholder `proxy-injected`, e.g.
  `NEON_API_KEY=proxy-injected npx neon@<NEON_CLI version> ...`,
  `FLY_API_TOKEN=proxy-injected flyctl ...`. Direct Postgres connections
  (port 5432) are blocked from these containers, so use Neon's HTTPS SQL
  endpoint (`@neondatabase/serverless`) if you need to query a branch.
- **Claude Code Tokens stay at their Baseline** (the table in `SECRETS.md`,
  "The baseline"). If a task needs more than that, such as creating or
  updating a Cloudflare Worker, say so before starting, name the exact
  permission, and guide the user through widening only that, following
  `SECRETS.md`, "Widening a token for a task". When the task is done, guide
  them back to the Baseline and check the narrowing took (a read the
  removed permission allowed should now fail; for Grafana, where reads stay
  allowed, a write aimed at something that doesn't exist should be
  refused). Never work around a missing permission, for example with a CI
  token or a broader key, and don't treat a temporary widening as the new
  Baseline: if the app needs it permanently, update the Baseline table in
  the same change, and say so.
- Never print connection strings or Realtime secrets. When checking
  `neon env pull` output, match on shape (as `deploy-backend` does)
  instead of echoing values.

## Observability (Grafana Cloud)

Telemetry is the fifth column next to frontend, backend, database and auth,
sending everything to the **Grafana Stack**. It's standard
OpenTelemetry, and it's **off wherever its config is missing**: tests and
Development export nothing.

- **Backend** (`backend/src/telemetry.ts`, preloaded with `node --import`):
  traces (incoming HTTP, `pg` queries, outgoing `fetch`), metrics (HTTP
  RED, pg pool, Node runtime, plus the app's own counters in
  `backend/src/observability.ts`) and logs (every pino line, carrying
  `trace_id`/`span_id`). These go over OTLP to the stack's gateway, so they
  land in Tempo, Mimir and Loki. Turned on by `OTEL_EXPORTER_OTLP_ENDPOINT`,
  which `deploy-backend` sets when `deploy.env`'s Grafana values and the
  `GRAFANA_OTLP_TOKEN` CI Token are all there (otherwise it warns).
- **Frontend** (`frontend/src/telemetry.ts`): Grafana Faro sends page
  loads, Web Vitals, JS errors and `fetch` spans. It adds a `traceparent`
  header to calls to our own backend, so one trace runs from the browser
  through Fastify into Postgres. On only when built with
  `VITE_GRAFANA_FARO_URL`.
- **Shared resource attributes**, used to filter everything:
  `service.namespace=<APP_HANDLE>`; `service.name=<APP_HANDLE>-backend` /
  `<APP_HANDLE>-frontend`; `deployment.environment.name=production` or
  `pr-<n>` for a Preview; `service.version=<commit sha>`. Spans for
  signed-in requests carry `user.id` (the opaque WorkOS id).

### Querying it from a session

Use the **`observability` skill** (`.claude/skills/observability/SKILL.md`)
whenever production or preview behavior matters: bugs, error reports,
latency, checking your own PR preview, or real usage before a feature. It
runs Grafana's CLI through `scripts/gcx`, which installs gcx just in time
and reads the stack from `deploy.env`. The proxy supplies the
`myapp-claude-code` service account's token (Viewer, its Baseline), so no
setup is needed and no key appears anywhere. If a query fails or comes back
empty, say so rather than guessing at Production behavior.

### Adding telemetry

- Logs: use `req.log` in handlers (keeps the request's trace id) or the
  pino logger in `main.ts`. Never log tokens, sealed queries, request bodies or
  emails.
- Metrics: add instruments to `appMetrics` in `backend/src/observability.ts`.
  Attribute values must come from small fixed sets (a view name, an
  outcome), never ids or user input. The free tier caps active series at
  ~10k for the whole Grafana Stack, across every app that uses it.
- Spans: auto-instrumentation covers HTTP, pg and fetch. For a meaningful
  in-process step, use `trace.getTracer("myapp-backend").startActiveSpan(...)`.
- Infra polled by machines (like `/health`) stays out of traces and logs. Add new
  paths of that kind to `UNTRACED_PATHS` in `telemetry.ts`.

## Verifying UI changes in this sandbox

No harness exists yet -- the app is small enough that `npm run dev` in both
`backend/` and `frontend/` and opening the page directly is enough. If the UI
grows complex enough to need auth/routing to reach the screen under test,
add a harness page (`frontend/<name>-harness.html` + a matching `.tsx`
that renders the component with stubbed data, added to Vite's
`build.rollupOptions.input`) rather than wiring real auth into the test.
