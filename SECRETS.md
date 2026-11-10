# Secrets: what exists, where it lives, how to rotate it

This app uses two kinds of API token for each of Neon, Fly and Cloudflare:

| | **CI Tokens** (`myapp-ci`) | **Claude Code Tokens** (`myapp-claude-code`) |
|---|---|---|
| Used by | GitHub Actions, on every deploy | Claude Code sessions on this app: setting it up, then building and debugging it, including Production and Previews |
| Stored in | this repo's GitHub Actions secrets | the **network secrets** of this app's **Agent Environment** (its own Claude Code cloud environment, named with the App Name) |
| Scope | as narrow as each service allows, for this one app | this app's Neon project, its own Fly org, and its Cloudflare account, with only the permissions Claude needs |
| Lifetime | long-lived; rotate occasionally | optional; can expire or be revoked any time |
| If removed | deploys stop | Claude can't look into this app's infrastructure; deploys keep working |

**One Agent Environment per app.** Every Claude Code session on this app,
including the one that set it up, runs on its Agent Environment: the
Claude Code cloud environment named with the App Name ("My App"), which
is used for nothing else. Its tokens never reach another app.
**Full** network access is recommended: nothing gets blocked, and the
tokens are still sent only to their own hosts (Claude never sees their
values). What Full gives up is a limit on where data a session reads, such
as database rows or logs, could be sent. If you want that limit, use
**Limited** access: its allowlist holds the token hosts, this app's
Production addresses and the services' docs, plus three wildcards you add
yourself so Claude can reach Previews: `*.<region>.aws.neon.tech` (each
Neon branch's database), `*.fly.dev` (Production and Preview backends) and
`*.<Pages Subdomain>` (Preview frontends).

Deploys need **only** the three CI Tokens. Everything else is either
fetched from Neon at deploy time or committed in `.github/deploy.env`:

- On every backend deploy, `.github/actions/deploy-backend` uses
  `NEON_API_KEY` to fetch the target branch's `DATABASE_URL`,
  `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET`. It then uses
  `FLY_API_TOKEN` to store them as Fly secrets on that app.
- The same applies to Production (the default Neon branch) and to each
  Preview (its own `preview/pr-<n>` branch).
- `.github/deploy.env` holds only non-secret IDs and names.

## The CI Tokens (GitHub secrets)

Manage them at `https://github.com/<owner>/<repo>/settings/secrets/actions`.

| Secret | What it is | Minimum scope | Why it needs that |
|---|---|---|---|
| `NEON_API_KEY` | Neon API key | **project-scoped** to this app's project | creates and deletes Preview branches, enables Realtime on them, reads their credentials |
| `FLY_API_TOKEN` | Fly **organization** token (starts with `FlyV1 `) | this app's own Fly org (`FLY_ORG`) | creates and destroys a Fly app per Preview. An app-scoped deploy token can't create apps. Because of that, each app gets **its own Fly org**: a linked org billed to your main org if Fly approves it (it reviews these manually), otherwise an org with its own billing. Sharing an org lets this token touch your other apps. |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | `Account` → `Cloudflare Pages` → `Edit`, for one account | uploads deployments and deletes Preview deployments. Cloudflare can't narrow this to a single project. |

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
| Neon | `console.neon.tech` | API key, **Project-scoped** to this app's project | full access to that one project. Neon has no finer-grained or read-only keys. | inspect and manage branches (including Preview branches), Realtime settings, and connection details for HTTPS SQL |
| Fly | `api.fly.io` and `api.machines.dev` (the same token in both, saved without any `FlyV1 ` prefix) | **Org Deploy Token** for this app's own Fly org (`FLY_ORG`) | deploy and manage apps in that org only. Fly personal access tokens no longer work. | inspect and restart Production and every Preview app |
| Cloudflare | `api.cloudflare.com` | User API token | **Account** policy for your account: `Cloudflare Pages` → `Edit`, `Account Settings` → `Read`, `Account Analytics` → `Read` | inspect and retry Pages deployments and build logs, read account analytics. Cloudflare can't narrow a token to one project. |
| Cloudflare, custom domain only | same token | same token | **Zone** policy for that zone only: `DNS` → `Read`, `Zone` → `Read` | inspect the domain's DNS records and zone |

During setup two of them start wider: Neon as an **organization** key, to
create the project, and Cloudflare with `DNS` → `Edit`, to create the
Custom Domain's record. Setup narrows both to the Baseline before it
finishes.

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
| Neon | Only for work outside this project, such as creating another project. Create an **Organization** key named `myapp-claude-code` (the organization's **Settings → API keys**, not the profile menu's), copy it, and paste it into the card Claude shows for `console.neon.tech`. | Create a **Project-scoped** key for this project with the same name, paste it into a new card, then revoke the Organization key on the same page. | Claude checks this project is still readable, and that listing all projects now fails ("not allowed outside the project"). |
| Fly | Rarely needed: the Baseline already covers every app in this app's org. Anything outside the org belongs to another app's Agent Environment. | — | — |

### Adding a service

When Claude should be able to inspect a new service (observability, say,
or billing), it gets its own `myapp-claude-code` token on the
Agent Environment, with the narrowest Baseline that service allows (read-only
where it offers that), and a row in the Baseline table above. On a
**Limited** Agent Environment, its hosts go on the allowlist too.

## Rotating a CI Token

This is safe at any time and causes no downtime. Do one service at a time,
and copy only one thing at a time.

1. **Create the new token** with the same scope (table above), named
   `myapp-ci`. Copy it.
   - **Neon:** https://console.neon.tech → in the profile menu (top
     right), use the organization switcher to pick this app's
     organization → the organization's **Settings** in the left sidebar
     (not the profile menu's Settings, which makes personal keys) →
     **API keys → Create new** → **Project-scoped** → pick the project.
     It's shown only once.
   - **Fly:** https://fly.io/dashboard → in the organization dropdown,
     pick this app's org → that org's **Tokens** (not an app's Tokens,
     and not the account menu's Access Tokens) → create an **Org Deploy
     Token**. Copy the whole value, including `FlyV1 `.
   - **Cloudflare:** https://dash.cloudflare.com/profile/api-tokens (My
     Profile → API Tokens; never the Global API Key). Either **⋯ → Roll**
     on the existing `myapp-ci` token (same permissions, new value),
     or **Create Token → Start from scratch** with one Account policy
     (your account) that ticks only **Cloudflare Pages → Edit**.
2. **Update the GitHub secret.** In the repo's secrets page, tap the
   secret's ✏️ (**Update**), paste, and tap **Update secret**.
3. **Prove it works.** Re-run the latest **Backend** workflow on `main`
   (Actions → the run → **Re-run all jobs**), and for Cloudflare the
   latest **Frontend** run. A green deploy means the new token works.
4. **Revoke the old token** in the service's dashboard: the Neon API keys
   page, the Fly Tokens page, or Cloudflare API Tokens → **⋯ → Delete**.
   Cloudflare's **Roll** already invalidated the old value, so there's
   nothing to revoke after a roll.

## Rotating a Claude Code Token

1. Create the new token in the same place as its CI counterpart (step 1
   of "Rotating a CI Token"), named `myapp-claude-code` and with the
   scope from the table above. For Fly that's an org deploy token from
   the org's **Tokens** page. For Cloudflare, **⋯ → Roll** on the existing
   token gives a new value with the same permissions.
2. In the Agent Environment, open **Network secrets** and replace the
   value for that host. For Fly, update both hosts and delete `FlyV1 ` (6
   characters, including the space) from the start of the value: the form
   treats it as a pasted header, shows an error and keeps **Save** greyed
   out until it's gone. Fly accepts the token without it.
   Alternatively, ask Claude to show the secure card for the host and paste
   it there.
3. Revoke the old token in the service's dashboard (nothing to revoke
   after a Cloudflare roll).

To remove Claude's infrastructure access entirely, delete the entries from
**Network secrets** and revoke the tokens. Deploys don't use them.

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
