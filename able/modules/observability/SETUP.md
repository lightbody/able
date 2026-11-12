# Setting up `observability`

**For Claude Code.** This is the `observability` Module's part of `PLAYBOOK.md`. Each
heading below names the playbook step it belongs to: when the playbook
reaches that step, and the app has this Module, do that section. The
playbook's ground rules, Terms and "How `request_credential` works" apply
here too.

Telemetry goes to a **Grafana Stack** on Grafana Cloud: Faro from the
frontend, and OpenTelemetry from the backend when the app has `backend`.

## Step 1: Region

A Grafana Cloud region matters only if the user creates a new Grafana
Stack: suggest the one from the playbook's Region Trio table. An existing
stack is fine wherever it is.

## Step 2: Account and Grafana Stack

| Service | What it's for | Sign up |
|---|---|---|
| Grafana Cloud | Observability: traces, logs and metrics | https://grafana.com (**Create free account**) |

**Grafana Cloud: one Grafana Stack for all of the user's apps is the
norm.** Each app's telemetry is labelled with its App Handle, so apps
sharing a stack stay apart. If the user already has a stack, use it. If
they're new to Grafana Cloud, sign-up creates their first stack: any name
they like works (it becomes `<name>.grafana.net`, so something general,
such as their own name, suits a stack they'll reuse), and they pick the
Grafana Cloud region from the Region Trio rather than the default. Either
way, ask for the stack's URL, `https://<stack slug>.grafana.net`: it's
`GRAFANA_STACK_URL`, and isn't a secret, so chat is fine. Check that
`GET <url>/api/health` answers. **Limited network only:** add the stack's
host to the allowlist first.

## Step 4: Claude Code Token

If the Agent Environment already has a credential for the Grafana Stack's
host, check it: `GET <stack>/api/user` shows a service-account login
(`sa-…`), `GET <stack>/api/datasources` lists `grafanacloud-logs`,
`grafanacloud-traces` and `grafanacloud-prom`, **and**
`GET <stack>/api/access-control/user/permissions` includes
`grafana-kowalski-app.apps:write` (the Frontend Observability role step 5
needs). A 403 on `/api/datasources`, with `folders:read` as the only
permission, means the role is still **None**: the role change wasn't saved
with **Update**. Either way the token is fine: have the user fix the roles
(step 3 of the steps below) and tap **Update**, no new card.

**Grafana token** (Viewer, plus one setup role until step 5)

A service account on the Grafana Stack from step 2. Its Baseline is
**Viewer**: Claude can read the app's telemetry but change nothing. Step 5
also creates the app's Faro app, which needs **Frontend Observability →
Editor**, so add that now too; step 5 removes it as soon as the app
exists. Tell the user that in one line, then give these steps:

1. Open `https://<stack slug>.grafana.net/org/serviceaccounts`
   (**Administration → Users and access → Service accounts**) and tap
   **Add service account**. You're creating it; it doesn't exist yet.
2. **Display name:** type `<App Handle>-claude-code`, and tap **Create**.
3. On its page, set the roles. Grafana starts it at **None**, which can't
   read anything:
   1. Change **None** to **Viewer**.
   2. In the same **Role** picker, also add **Frontend Observability →
      Editor**. (The basic **Editor** role isn't enough.)
   3. Tap **Update**. This is easy to miss: Grafana doesn't save a role change until you tap **Update**.
      Check the page now shows **Viewer** plus the Frontend
      Observability role.
4. Still on its page, tap **Add service account token**. Name: type
   `<App Handle>-claude-code`. **No expiration** is fine: after step 5 it
   only reads. Tap **Generate token**.
5. It's shown **only once**. Copy the `glsa_…` value and tell Claude it's
   copied.

**After the user confirms:** call `request_credential` with the stack's
host (`<stack slug>.grafana.net`). They paste the token into the card.

## Step 5: Provision

Do this after the playbook's core step 5 has created the Pages project:
the Faro app needs the Pages Subdomain.

**Grafana: the OTLP endpoint and instance ID.** Derive them; don't ask
the user. Both come from the Grafana Stack, through Claude's token:

```bash
STACK=https://<stack slug>.grafana.net
curl -s $STACK/bootdata -H "Authorization: Bearer x" | jq -r '.settings.openFeatureContext.stackId'   # GRAFANA_OTLP_INSTANCE_ID
curl -s $STACK/api/datasources/uid/grafanacloud-prom -H "Authorization: Bearer x" | jq -r .url
#   e.g. https://prometheus-prod-67-prod-us-east-0-…  ->  the region is prod-us-east-0
#   GRAFANA_OTLP_ENDPOINT=https://otlp-gateway-<region>.grafana.net/otlp
```

**Grafana: the Faro app** (frontend telemetry). Create it now that the
Pages Subdomain is known, with the Frontend Observability role step 4
added. Set `corsOrigins` in `observability/faro-app.yaml` to the Production
Origin and `https://*.<Pages Subdomain>`. Add the Custom Domain too, if
the user chose one; allowing it early is harmless. Run
`scripts/gcx frontend apps create -f observability/faro-app.yaml` (step 8
commits the file). `scripts/gcx frontend apps get <App Handle>-frontend -o json`
returns a **list** with the one app: `GRAFANA_FARO_URL` is
`<.[0].spec.collectEndpointURL>/<.[0].spec.appKey>`, and `.[0].metadata.name`
is the app's **slug-id**, `<App Handle>-frontend-<id>` (e.g.
`myapp-frontend-6445`). Updates need the slug-id, not the plain name, so
note it. The key isn't a secret: it ships in the
bundle.

Then narrow the Grafana token to its Baseline straight away, with nothing
to copy: have the user open `<App Handle>-claude-code` on the Grafana
Stack's **Service accounts** page, remove **Frontend Observability →
Editor** in its **Role** picker, leaving **Viewer**, and tap **Update**
(the change isn't saved otherwise). Check:
`scripts/gcx frontend apps update <slug-id> -f observability/faro-app.yaml`
(the whole, unchanged spec, so it changes nothing even if allowed) must now
fail with `missing grafana-kowalski-app.apps:write`. Don't test with any
other update.

Record `GRAFANA_STACK_URL`, `GRAFANA_OTLP_ENDPOINT`,
`GRAFANA_OTLP_INSTANCE_ID` and `GRAFANA_FARO_URL` for
`.github/deploy.env`.

## Step 6: CI Token

Only with `backend`: this token lets the backend send its telemetry. A
static site's telemetry comes from the browser, which needs no token.

**`GRAFANA_OTLP_TOKEN`**: write-only, so the backend can send telemetry
to the Grafana Stack. Give the user the direct link: build it from
`GET <stack>/bootdata` → `.settings.openFeatureContext` (`gcomOrgSlug`
and `stackId`).
1. Open `https://grafana.com/orgs/<gcomOrgSlug>/stacks/<stackId>/otlp-info`,
   filled in. (By menu: grafana.com → **My Account** → the stack's
   **OpenTelemetry** tile → **Configure**.)
2. Under **Password / API Token**, tap **Generate now**. Name: type
   `<App Handle>-ci`. Leave the scopes as they are: they're preset and
   write-only.
3. Copy the token (it starts with `glc_`). Ignore any ready-made
   `Authorization: Basic …` or `OTEL_…` snippets on that page: the
   deploy builds the header itself.

## Step 9: Check Production

Check with the `observability` skill, after the user has used the page:

- **Frontend:** Faro events (`session_start`, page load, Web Vitals) under
  `service_name="<App Handle>-frontend"`.

With `backend`, also:

- **Logs:** backend lines for those requests, with
  `deployment_environment_name="<App Handle>"` (Production's label), each with a
  `trace_id` (the first lines can take a few seconds). If there are none,
  look for a "Telemetry is off" warning in the backend deploy's log: it
  means `GRAFANA_OTLP_TOKEN` is missing or wrong.
- **Traces:** `scripts/gcx traces get <trace_id>` for the
  `POST /greetings` request shows the browser's `POST`, the backend's
  `POST /greetings` and its Postgres `INSERT`, in one trace.
- **Metrics,** after up to a minute (they're exported every 60s):
  `http_server_request_duration_seconds_count` for that route.
- **Frontend:** Faro events (`session_start`, page load, Web Vitals) under
  `service_name="<App Handle>-frontend"`.

Without `postgres` there's no `POST /greetings`: use the `GET /hello`
request instead, whose trace shows the browser's `GET` and the backend's
`GET /hello`.

## Step 10: Check a Preview

The Preview's telemetry arrives labelled
`deployment_environment_name="<App Handle>-pr<n>"`. With `backend`, the PR
comment's Telemetry row links to the Grafana Stack.

## Step 11: Custom Domain

The Custom Domain should already be in `observability/faro-app.yaml`'s
`corsOrigins` (step 5). If it isn't, add it and update the Faro app,
widening for that task as step 5 did (Frontend Observability → Editor, then
back to the Baseline and check). Until then, the browser's telemetry from
the Custom Domain is refused; the app itself is unaffected.

## Done

Tell the user where to see the app's telemetry (the Grafana Stack's URL),
and that later sessions read it through the `observability` skill to build
features and fix bugs. With `backend`, offer, in one line, Fly's own
metrics (machine CPU, memory and restarts, and Fly's edge view of
requests) in Grafana as well. If the user wants them, follow README
"Observability" ("Fly's metrics"): it needs the **Data sources → Writer**
role for the task, and a Fly org token that the user pastes into Grafana,
never into a card.

## Limited network access

- Allowlist: the Grafana Stack's host (`<stack slug>.grafana.net`), added
  in step 2, before the first call to it. Also `github.com` and
  `release-assets.githubusercontent.com`: `scripts/gcx` downloads
  Grafana's CLI from GitHub releases on first use.
