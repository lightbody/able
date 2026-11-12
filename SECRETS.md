# Secrets: what exists, where it lives, how to rotate it

This app uses two kinds of API token for each service it runs on:

| | **CI Tokens** (`myapp-ci`) | **Claude Code Tokens** (`myapp-claude-code`) |
|---|---|---|
| Used by | GitHub Actions, on every deploy | Claude Code sessions on this app: setting it up, then building and debugging it, including Production and Previews |
| Stored in | this repo's GitHub Actions secrets | the **network secrets** of this app's **Agent Environment** (its own Claude Code cloud environment, named with the App Name) |
| Scope | as narrow as each service allows, for this one app | this app's own resources in each service, with only the permissions Claude needs |
| Lifetime | long-lived; rotate occasionally | optional; can expire or be revoked any time |
| If removed | deploys stop | Claude can't look into this app's infrastructure; deploys keep working |

**One Agent Environment per app.** Every Claude Code session on this app,
including the one that set it up, runs on its Agent Environment: the
Claude Code cloud environment named with the App Name ("My App"), which
is used for nothing else. Its tokens never reach another app.
**Full** network access is recommended: nothing gets blocked, and the
tokens are still sent only to their own hosts (Claude never sees their
values). What Full gives up is a limit on where data a session reads, such
as the app's data or logs, could be sent. If you want that limit, use
**Limited** access: its allowlist holds the token hosts, this app's
Production addresses and the services' docs, plus wildcards you add
yourself so Claude can reach Previews:

- `*.<Pages Subdomain>` (Preview frontends)
<!-- able:begin backend -->
- `*.fly.dev` (Production and Preview backends)
<!-- able:end -->
<!-- able:begin postgres -->
- `*.<region>.aws.neon.tech` (each Neon branch's database)
<!-- able:end -->

<!-- able:begin observability -->
For observability it also
needs the Grafana Stack's host, and `github.com` plus
`release-assets.githubusercontent.com`, from which `scripts/gcx` installs
Grafana's CLI the first time a session uses it.

<!-- able:end -->
Deploys need **only** the CI Tokens, one for each service. Everything
else is committed in `.github/deploy.env`, which holds only non-secret IDs
and names.
<!-- able:begin postgres -->
The one exception is fetched at deploy time:

- On every backend deploy, `.github/actions/postgres-stage` (a step of
  `deploy-backend`) uses
  `NEON_API_KEY` to fetch the target branch's `DATABASE_URL`,
  `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET`. It then uses
  `FLY_API_TOKEN` to store them as Fly secrets on that app.
- The same applies to Production (the default Neon branch) and to each
  Preview (its own `preview/pr-<n>` branch).
<!-- able:end -->

## The CI Tokens (GitHub secrets)

Manage them at `https://github.com/<owner>/<repo>/settings/secrets/actions`.

| Secret | What it is | Minimum scope | Why it needs that |
|---|---|---|---|
| `NEON_API_KEY` | Neon API key | **project-scoped** to this app's project | creates and deletes Preview branches, enables Realtime on them, reads their credentials | <!-- able:only postgres -->
| `FLY_API_TOKEN` | Fly **organization** token (starts with `FlyV1 `) | this app's own Fly org (`FLY_ORG`) | creates and destroys a Fly app per Preview. An app-scoped deploy token can't create apps. Because of that, each app gets **its own Fly org**: a linked org billed to your main org if Fly approves it (it reviews these manually), otherwise an org with its own billing. Sharing an org lets this token touch your other apps. | <!-- able:only backend -->
| `CLOUDFLARE_API_TOKEN` | Cloudflare **account API token** (starts with `cfat_`), since CI acts for the account rather than one person | `Account` → `Cloudflare Pages` → `Edit`, for one account | uploads deployments and deletes Preview deployments. Cloudflare can't narrow this to a single project. |
| `GRAFANA_OTLP_TOKEN` | Grafana Cloud access policy token | write-only: `metrics:write`, `logs:write`, `traces:write` (preset; Grafana doesn't let you pick) | `deploy-backend` turns it into the backend's OTLP `Authorization` header (Basic `GRAFANA_OTLP_INSTANCE_ID:token`), stored as the Fly secret `OTEL_EXPORTER_OTLP_HEADERS`, for Production and every Preview. It can't read anything back. Without it, deploys still run, with telemetry off and a warning. | <!-- able:only backend,observability -->

## The Claude Code Tokens (the Agent Environment)

Find them in the Claude app or on claude.ai: in a Claude Code session on
the Agent Environment, tap the **environment name** in the title bar, then
**Edit** next to it, then **Network secrets**. Older app versions call that
section **API credentials**. Each entry is a host. The value is never
shown, and the network proxy adds it to Claude's requests to that host.

### The baseline

Setup ends with these, and every widening below comes back to them. Each
is named `myapp-claude-code`.

| Service | Host(s) | Token | Baseline permissions | What it lets Claude do |
|---|---|---|---|---|
| Neon | `console.neon.tech` | API key, **Project-scoped** to this app's project | full access to that one project. Neon has no finer-grained or read-only keys. | inspect and manage branches (including Preview branches), Realtime settings, and connection details for HTTPS SQL | <!-- able:only postgres -->
| Fly | `api.fly.io` and `api.machines.dev` (the same token in both, saved without any `FlyV1 ` prefix) | **Org Deploy Token** for this app's own Fly org (`FLY_ORG`) | deploy and manage apps in that org only. Fly personal access tokens no longer work. | inspect and restart Production and every Preview app | <!-- able:only backend -->
| Cloudflare | `api.cloudflare.com` | User API token | **Account** policy for your account: `Cloudflare Pages` → `Edit`, `Account Settings` → `Read`, `Account Analytics` → `Read` | inspect and retry Pages deployments and build logs, read account analytics. Cloudflare can't narrow a token to one project. |
| Cloudflare, custom domain only | same token | same token | **Zone** policy for that zone only: `DNS` → `Read`, `Zone` → `Read` | inspect the domain's DNS records and zone |
| Grafana | the Grafana Stack's host (from `GRAFANA_STACK_URL`, `<stack slug>.grafana.net`), saved as `Bearer` | token of the Grafana Stack's **service account** `myapp-claude-code` (**Administration → Users and access → Service accounts**) | basic role **Viewer**, nothing added. Viewer also brings `grafana-kowalski-app.sourcemaps:write` from Frontend Observability's own defaults (uploading source maps; harmless) | query logs, traces and metrics with `scripts/gcx` (the `observability` skill) | <!-- able:only observability -->

During setup some of them start wider, and setup narrows each to the
Baseline as soon as it's done with it, and in any case before it finishes:

- Cloudflare with `DNS` → `Edit`, to create a Custom Domain's record.
<!-- able:begin postgres -->
- Neon as an **organization** key, to create the project.
<!-- able:end -->
<!-- able:begin observability -->
- Grafana with **Frontend Observability → Editor** added, to create the
  Faro app.
<!-- able:end -->

### Widening a token for a task, then back to the baseline

Claude's tokens stay at the Baseline between tasks. When a task needs
more, for example creating or updating a Cloudflare Worker, Claude says so
before starting, names the exact permission it needs, and guides you
through adding only that. When the task is done, it guides you back to the
Baseline and checks the narrowing worked. Widening is for one task, not a
new Baseline: if the app comes to rely on something permanently (it now
runs a Worker that Claude should be able to debug), decide that
deliberately and update the Baseline table above in the same change.

Permission names for Cloudflare are on its list at
https://developers.cloudflare.com/fundamentals/api/reference/permissions/
(the API calls the Edit ones "Write").

| Service | Widen | Back to the Baseline | Check |
|---|---|---|---|
| Cloudflare | https://dash.cloudflare.com/profile/api-tokens → the `myapp-claude-code` token → **⋯ → Edit**. Add the permission to the existing policy (for Workers: `Workers Scripts` → `Edit`, and `Workers Tail` → `Read` for live logs), or add a Zone policy for one specific zone. Save. The value doesn't change, so nothing to paste. Don't **Roll** it. | **⋯ → Edit** again, remove what was added so the token matches the Baseline table, and save. | Claude makes a read-only call that the removed permission allowed (for Workers, listing the account's Workers scripts) and expects it to fail with 403. Where no safe read exists, such as Edit narrowed back to Read, you confirm the token's summary shows only the Baseline. |
| Neon | Only for work outside this project, such as creating another project. Create an **Organization** key named `myapp-claude-code` (the organization's **Settings → API keys**, not the profile menu's), copy it, and paste it into the card Claude shows for `console.neon.tech`. | Create a **Project-scoped** key for this project with the same name, paste it into a new card, then revoke the Organization key on the same page. | Claude checks this project is still readable, and that listing all projects now fails ("not allowed outside the project"). | <!-- able:only postgres -->
| Fly | Rarely needed: the Baseline already covers every app in this app's org. Anything outside the org belongs to another app's Agent Environment. | — | — | <!-- able:only backend -->
| Grafana | The Grafana Stack → **Administration → Users and access → Service accounts** → `myapp-claude-code` → **Role** picker. Keep the basic role **Viewer** and add only the one role the task needs: **Frontend Observability → Editor** to create or update the Faro app (basic **Editor** is refused), **Data sources → Writer** to create or edit a data source. Tap **Update**: Grafana doesn't save a role change until you do. The token doesn't change, so nothing to paste. | Remove the added role in the same picker and tap **Update**. **Also** remove `myapp-claude-code` from the **Permissions** tab of anything it created while widened (a data source, say): Grafana gives the creator admin on what it creates, and dropping the role doesn't take that away. | Grafana's reads stay allowed at Viewer, so the check is a *write* that can't change anything: aim it at something that doesn't exist (e.g. `PUT /api/datasources/uid/<a uid that doesn't exist>`) and expect 403. For the Faro app, the one allowed real update: `scripts/gcx frontend apps update <slug-id> -f observability/faro-app.yaml` (the slug-id is `.[0].metadata.name` from `scripts/gcx frontend apps get myapp-frontend -o json`, e.g. `myapp-frontend-6445`), the whole, unchanged spec, so it changes nothing even if allowed; it must fail with `missing grafana-kowalski-app.apps:write`. `GET /api/access-control/user/permissions` should list no `…:write`/`…:create`/`…:delete` beyond the Baseline's. Never test with any other real update: a data source update, for one, replaces its whole config. | <!-- able:only observability -->

### Adding a service

When Claude should be able to inspect a new service (billing, say),
it gets its own `myapp-claude-code` token on the
Agent Environment, with the narrowest Baseline that service allows (read-only
where it offers that), and a row in the Baseline table above. On a
**Limited** Agent Environment, its hosts go on the allowlist too.

## Tokens held by other services

One service sometimes needs a credential for another, for example a
dashboard reading a host's metrics. Claude can't hand over a Claude Code Token (the
proxy holds the value, and Claude never sees it), so such a token is
either created by Claude through an API straight into the service that
needs it, or pasted there by you. It's neither a CI Token nor a Claude
Code Token, and lives only in that service. List each one here.

| Token | Held by | Scope | Rotate |
|---|---|---|---|
| `myapp-grafana-fly-metrics` (only if the app has Grafana's optional **Fly** data source, README "Observability") | the Grafana Stack's **My App: Fly** data source (`myapp-fly-prometheus`), in its encrypted HTTP header | a Fly **Org Deploy Token** for `FLY_ORG`. Fly's dashboard can't make read-only tokens (only `fly tokens create readonly` with a `fly auth login` session can), so it's wider than it needs to be. Through Grafana it reaches only `api.fly.io/prometheus/<FLY_ORG>/`. | Fly → the org's **Tokens** → new Org Deploy Token → Grafana **Connections → Data sources → My App: Fly** → paste it as the `Authorization` value (`FlyV1 fm2_…`, one `FlyV1`) → **Save & test** → delete the old token in Fly | <!-- able:only backend,observability -->

<!-- able:begin observability -->
The Faro collector URL (`GRAFANA_FARO_URL` in `.github/deploy.env`) isn't a
secret: it ships in the frontend bundle.
<!-- able:end -->

## Rotating a CI Token

This is safe at any time and causes no downtime. Do one service at a time,
and copy only one thing at a time.

1. **Create the new token** with the same scope (table above), named
   `myapp-ci`. Copy it.
<!-- able:begin postgres -->
   - **Neon:** https://console.neon.tech → in the profile menu (top
     right), use the organization switcher to pick this app's
     organization → the organization's **Settings** in the left sidebar
     (not the profile menu's Settings, which makes personal keys) →
     **API keys → Create new** → **Project-scoped** → pick the project.
     It's shown only once.
<!-- able:end -->
<!-- able:begin backend -->
   - **Fly:** https://fly.io/dashboard → in the organization dropdown,
     pick this app's org → that org's **Tokens** (not an app's Tokens,
     and not the account menu's Access Tokens) → create an **Org Deploy
     Token**. Copy the whole value, including `FlyV1 `.
<!-- able:end -->
   - **Cloudflare:** https://dash.cloudflare.com → the account → **Manage
     account → Account API tokens** (account tokens, not My Profile's user
     tokens; never the Global API Key). Either **⋯ → Roll** on the
     existing `myapp-ci` token (same permissions, new value), or
     **Create Token** with only **Account → Cloudflare Pages → Edit**. It
     starts with `cfat_`.
<!-- able:begin backend,observability -->
   - **Grafana (`GRAFANA_OTLP_TOKEN`):**
     `https://grafana.com/orgs/<gcomOrgSlug>/stacks/<stackId>/otlp-info`
     (Claude can fill both in from `GET <stack>/bootdata` →
     `.settings.openFeatureContext`; by menu: grafana.com → **My Account**
     → the stack's **OpenTelemetry** tile → **Configure**) → under
     **Password / API Token**, **Generate now**. Name it `myapp-ci`.
<!-- able:end -->
2. **Update the GitHub secret.** In the repo's secrets page, tap the
   secret's ✏️ (**Update**), paste, and tap **Update secret**.
3. **Prove it works.** Re-run the latest workflow on `main` that uses the
   token (Actions → the run → **Re-run all jobs**): **Frontend** for
   Cloudflare.
<!-- able:begin backend -->
   For any other token, **Backend**.
<!-- able:end -->
   A green deploy means the new token works.
4. **Revoke the old token** in the service's dashboard. For Cloudflare:
   **Account API tokens** → **⋯ → Delete**; its **Roll** already
   invalidated the old value, so there's nothing to revoke after a roll.
<!-- able:begin backend -->
   For Fly: the org's **Tokens** page.
<!-- able:end -->
<!-- able:begin postgres -->
   For Neon: the organization's **API keys** page.
<!-- able:end -->
<!-- able:begin backend,observability -->
   For Grafana, step 3's deploy goes green
   even with a bad token (only the exporter fails), so first check
   telemetry still arrives (the `observability` skill), then delete the
   old token in grafana.com's **Access Policies**.
<!-- able:end -->

## Rotating a Claude Code Token

1. Create the new token in the same place as its CI counterpart (step 1
   of "Rotating a CI Token"), named `myapp-claude-code` and with the
   scope from the table above.
<!-- able:begin backend -->
   For Fly that's an org deploy token from the org's **Tokens** page.
<!-- able:end -->
   For Cloudflare it's a **user** token, unlike
   the CI one: https://dash.cloudflare.com/profile/api-tokens (My Profile →
   API Tokens), where **⋯ → Roll** on the existing token gives a new value
   with the same permissions.
2. In the Agent Environment, open **Network secrets** and replace the
   value for that host.
   Alternatively, ask Claude to show the secure card for the host and paste
   it there.
<!-- able:begin backend -->
   For Fly, update both hosts and delete `FlyV1 ` (6
   characters, including the space) from the start of the value: the form
   treats it as a pasted header, shows an error and keeps **Save** greyed
   out until it's gone. Fly accepts the token without it.
<!-- able:end -->
<!-- able:begin observability -->
   For Grafana, the new token comes from the same service account, not a
   new one: `myapp-claude-code` → **Add service account token**, then
   replace the value for the Grafana Stack's host.
<!-- able:end -->
3. Revoke the old token in the service's dashboard (nothing to revoke
   after a Cloudflare roll).
<!-- able:begin observability -->
   For Grafana, delete the old token on the service account's page.
<!-- able:end -->

To remove Claude's infrastructure access entirely, delete the entries from
**Network secrets** and revoke the tokens. Deploys don't use them.

<!-- able:begin postgres -->
## Rotating the values CI fetches from Neon

These need no GitHub or Fly edits, because each deploy fetches the current
values.

- **Database password:** Neon Console → the project → **Branches** → the
  branch → **Roles** → **⋯ → Reset password**.
- **Realtime secret:** `neon realtime rotate-secret --project-id <id> --branch <branch>`.
  The old secret keeps working until the rotation finishes.

Then redeploy so Fly picks up the new value. For Production, re-run the
latest **Backend** workflow on `main`. For an open PR, push any commit to
it. Until the redeploy, the backend keeps the old value. After a password
reset, the old password stops working immediately, so redeploy straight
away.
<!-- able:end -->
