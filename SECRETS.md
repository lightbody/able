# Secrets: what exists, where it lives, how to rotate it

This app uses three kinds of API token for each of Neon, Fly and Cloudflare:

| | **CI tokens** (`<project>-ci`) | **Dev tokens** (`<project>-dev`) | **Setup tokens** (`able-setup`) |
|---|---|---|---|
| Used by | GitHub Actions, on every deploy | Claude Code sessions on this app: building and debugging production and PR previews | Claude Code, when setting up a new app |
| Stored in | this repo's GitHub Actions secrets | the **network secrets** of this app's own Claude Code cloud environment, named after the app | the **network secrets** of the **Able Setup** Claude Code cloud environment |
| Scope | as narrow as each service allows, for this one app | this app's Neon project, Fly org and Cloudflare account | Neon and Cloudflare: broad enough to set up *any* new app. Fly: the newest app's own org |
| Lifetime | long-lived; rotate occasionally | optional; can expire or be revoked any time | optional; can expire or be revoked any time |
| If removed | deploys stop | Claude can't look into this app's infrastructure; deploys keep working | Claude can't set up new apps; deploys keep working |

**Able Setup** has **Full** network access, so setup can reach every
service and each new app's addresses. This app's own environment has
**limited** access: the token hosts, this app's production addresses and
the services' docs, plus any wildcards you add for PR previews (see below).
Either way, a token is sent only to the host it's saved for.

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

## Finding the Claude Code tokens

The dev and setup tokens are network secrets on a Claude Code cloud
environment. Find them in the Claude app or on claude.ai: in a Claude Code
session on that environment, tap the **environment name** in the title bar,
then **Edit** next to it, then **Network secrets**. Older app versions call
that section **API credentials**. Each entry is a host. The value is never
shown, and the network proxy adds it to Claude's requests to that host.

## The dev tokens (this app's Claude Code environment)

They live on the cloud environment named after this app, which Claude
creates at the end of setup. Start sessions on this app there, so Claude
can look into production. To let it reach PR previews too, add these under
the environment's **Edit** → **Network access** → **Allowed domains**:
`*.<pages subdomain>` (frontend previews), `*.fly.dev` (preview backends)
and `*.<region>.aws.neon.tech` (each preview's database endpoint), or set
**Network access** to **Full**.

| Host(s) | Token | Scope |
|---|---|---|
| `console.neon.tech` | Neon API key `<project>-dev` | **project-scoped** to this app's project. Neon has no read-only keys, so this matches the CI key's scope, as a separate key. |
| `api.fly.io` and `api.machines.dev` | Fly **org deploy token** `<project>-dev`, saved without any `FlyV1 ` prefix | this app's own Fly org (`FLY_ORG`): production and every PR preview app |
| `api.cloudflare.com` | Cloudflare token `<project>-dev` | an Account policy with `Cloudflare Pages` → `Edit`, `Workers Scripts` → `Edit`, `Workers Tail` → `Read`, `Account Analytics` → `Read` and `Account Settings` → `Read`. Cloudflare can't narrow it to one project. Expect this list to grow as the app does, for example with KV, D1 or R2. |

Only sessions on this app's environment use them. Removing them doesn't
affect any deploy.

## The setup tokens (the Able Setup environment)

| Host(s) | Token | Scope |
|---|---|---|
| `console.neon.tech` | Neon API key `able-setup` | an **organization** key, so Claude can create and manage each new app's project. A project-scoped key can't create projects. A personal key also works, but it reaches every Neon org you belong to. |
| `api.fly.io` and `api.machines.dev` | Fly **org deploy token** `able-setup`, saved without any `FlyV1 ` prefix | the app's own Fly org only. Fly personal access tokens no longer work, so each new app replaces this with a token for its own org, and Claude then reaches only that org. |
| `api.cloudflare.com` | Cloudflare token `able-setup` | an Account policy with `Cloudflare Pages` → `Edit` and `Account Settings` → `Read`. Only if Claude should set up a custom domain, add a Zone policy for that specific zone with `DNS` → `Edit` and `Zone` → `Read`. |

These are shared by every session that uses the Able Setup environment,
and by every app set up there. Removing them doesn't affect any deploy.

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
     and not the account menu's Access Tokens) → create an **Org Deploy
     Token**. Copy the whole value, including `FlyV1 `.
   - **Cloudflare:** https://dash.cloudflare.com/profile/api-tokens (My
     Profile → API Tokens; never the Global API Key). Either **⋯ → Roll**
     on the existing `<project>-ci` token (same permissions, new value),
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

## Rotating a dev or setup token

1. Create the new token in the same place as its CI counterpart (step 1
   of "Rotating a CI token"), but named `<project>-dev` or `able-setup`
   and with the scope from its table above. For Fly that's an org deploy
   token from the org's **Tokens** page.
2. On the environment that holds it (this app's for a dev token, Able
   Setup for a setup token), open **Network secrets**, replace the value for that
   host. For Fly, update both hosts and delete `FlyV1 ` (6 characters,
   including the space) from the start of the value: the form treats it
   as a pasted header, shows an error and keeps **Save** greyed out until
   it's gone. Fly accepts the token without it.
   Alternatively, ask Claude to show the secure card for the host and paste
   it there.
3. Revoke the old token in the service's dashboard.

To remove Claude's infrastructure access entirely, delete the entries from
**Network secrets** on both environments and revoke the tokens. Deploys
don't use them.

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
