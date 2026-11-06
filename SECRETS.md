# Secrets: what exists, where it lives, how to rotate it

This app uses two kinds of API token for each of Neon, Fly and Cloudflare:

| | **CI tokens** (`<project>-ci`) | **Setup tokens** (`able-setup`) |
|---|---|---|
| Used by | GitHub Actions, on every deploy | Claude Code, when setting up or debugging an app |
| Stored in | this repo's GitHub Actions secrets | the Claude Code cloud environment's **network secrets** |
| Scope | as narrow as each service allows, for this one app | broad enough to set up *any* new app |
| Lifetime | long-lived; rotate occasionally | optional; can expire or be revoked any time |
| If removed | deploys stop | Claude can't create or debug infrastructure; deploys keep working |

Deploys need **only** the three CI tokens. Everything else is either
fetched from Neon at deploy time or committed in `.github/deploy.env`:

- On every backend deploy, `.github/actions/deploy-backend` uses
  `NEON_API_KEY` to fetch the target branch's `DATABASE_URL`,
  `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET`. It then uses
  `FLY_API_TOKEN` to store them as Fly secrets on that app.
- The same applies to production (the default Neon branch) and to each PR
  preview (its own `preview/pr-<n>` branch).
- `.github/deploy.env` holds only non-secret IDs and names.

## The CI tokens (GitHub secrets)

Manage them at `https://github.com/<owner>/<repo>/settings/secrets/actions`.

| Secret | What it is | Minimum scope | Why it needs that |
|---|---|---|---|
| `NEON_API_KEY` | Neon API key | **project-scoped** to this app's project | creates and deletes preview branches, enables Realtime on them, reads their credentials |
| `FLY_API_TOKEN` | Fly **organization** token (starts with `FlyV1 `) | this app's own Fly org (`FLY_ORG`) | creates and destroys a Fly app per PR preview. An app-scoped deploy token can't create apps. Because of that, each app gets **its own Fly org**: a linked org billed to your main org if Fly approves it (it reviews these manually), otherwise an org with its own billing. Sharing an org lets this token touch your other apps. |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | `Account` → `Cloudflare Pages` → `Edit`, for one account | uploads deployments and deletes preview deployments. Cloudflare can't narrow this to a single project. |

## The setup tokens (Claude Code environment)

Find them in the Claude app or on claude.ai. In a Claude Code session, tap
the **environment name** in the title bar, then **Edit** next to it, then
**Network secrets**. Older app versions call that section **API
credentials**. Each entry is a host. The value is never shown, and the
network proxy adds it to Claude's requests to that host.

| Host(s) | Token | Scope |
|---|---|---|
| `console.neon.tech` | Neon API key `able-setup` | an **organization** key, so Claude can create and manage each new app's project. A project-scoped key can't create projects. A personal key also works, but it reaches every Neon org you belong to. |
| `api.fly.io` and `api.machines.dev` | Fly **personal access token** `able-setup`, saved without any `FlyV1 ` prefix | all your Fly orgs, so it works for every app's own org |
| `api.cloudflare.com` | Cloudflare token `able-setup` | `Cloudflare Pages` → `Edit` and `Account Settings` → `Read`. Add `Zone` → `DNS` → `Edit` plus `Zone` → `Zone` → `Read` only if Claude should set up custom domains. |

These are shared by every session and every app that uses this
environment. Removing them doesn't affect any deploy.

## Rotating a CI token

This is safe at any time and causes no downtime. Do one service at a time,
and copy only one thing at a time.

1. **Create the new token** with the same scope (table above), named
   `<project>-ci`. Copy it.
   - **Neon:** https://console.neon.tech → in the profile menu (top
     right), use the organization switcher to pick this app's
     organization → the organization's **Settings** in the left sidebar
     (not the profile menu's Settings, which makes personal keys) →
     **API keys → Create new** → **Project-scoped** → pick the project.
     It's shown only once.
   - **Fly:** https://fly.io/dashboard → in the organization dropdown,
     pick this app's org → that org's **Tokens** (not an app's Tokens,
     and not the account menu's Access Tokens) → create an
     **organization** token. Copy the whole value, including `FlyV1 `.
   - **Cloudflare:** https://dash.cloudflare.com/profile/api-tokens (My
     Profile → API Tokens; never the Global API Key). Either **⋯ → Roll**
     on the existing `<project>-ci` token (same permissions, new value),
     or **Create Token → Create Custom Token** with only `Account` ·
     `Cloudflare Pages` · `Edit`.
2. **Update the GitHub secret.** In the repo's secrets page, tap the
   secret's ✏️ (**Update**), paste, and tap **Update secret**.
3. **Prove it works.** Re-run the latest **Backend** workflow on `main`
   (Actions → the run → **Re-run all jobs**), and for Cloudflare the
   latest **Frontend** run. A green deploy means the new token works.
4. **Revoke the old token** in the service's dashboard: the Neon API keys
   page, the Fly Tokens page, or Cloudflare API Tokens → **⋯ → Delete**.
   Cloudflare's **Roll** already invalidated the old value, so there's
   nothing to revoke after a roll.

## Rotating a setup token

1. Create the new token with the setup scope above, named `able-setup`.
2. In the environment's **Network secrets**, replace the value for that
   host. For Fly, update both hosts and delete `FlyV1 ` from the start.
   Alternatively, ask Claude to show the secure card for the host and paste
   it there.
3. Revoke the old token in the service's dashboard.

To remove Claude's infrastructure access entirely, delete the entries from
**Network secrets** and revoke the tokens. Deploys don't use them.

## Rotating the values CI fetches from Neon

These need no GitHub or Fly edits, because each deploy fetches the current
values.

- **Database password:** Neon Console → the project → **Branches** → the
  branch → **Roles** → **⋯ → Reset password**.
- **Realtime secret:** `neon realtime rotate-secret --project-id <id> --branch <branch>`.
  The old secret keeps working until the rotation finishes.

Then redeploy so Fly picks up the new value. For production, re-run the
latest **Backend** workflow on `main`. For an open PR, push any commit to
it. Until the redeploy, the backend keeps the old value. After a password
reset, the old password stops working immediately, so redeploy straight
away.
