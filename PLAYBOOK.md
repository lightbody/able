# Able playbook: set up a new app

**For Claude Code.** You are setting up a new app from the Able template
(https://github.com/lightbody/able) for the user, end to end: a private
GitHub repo, a production environment, per-PR preview environments, and a
verified sign-in plus live-data round trip in both. Follow this file in
order. Do as much of the work as possible yourself. The user's part is
creating accounts and API tokens and a few dashboard settings that have no
API.

The user may be on a phone or tablet: no terminal, no clipboard manager,
one clipboard item at a time, but as many browser tabs as they like. Every
instruction you give must work with that.

## Ground rules

1. **One step at a time.** Give the user one numbered step list for one
   service, then wait. Don't front-load the whole playbook.
2. **One clipboard item at a time.** Whenever the user copies a value, tell
   them every place it goes *before* they copy anything else. When a form
   asks for a secret's **name**, tell them to *type* it, because copying the
   name would replace the token on their clipboard.
3. **Deep links.** Use the links given here. Don't invent URLs. Where this
   playbook gives a menu path instead of a link, give the menu path.
4. **Secrets never go through chat.** Never ask for a token in chat.
   Non-secret IDs (Cloudflare account ID, Neon org ID, WorkOS client ID) are
   fine in chat.
5. **Never print a secret.** You will handle connection strings and Realtime
   secrets in shell variables and files. Never `echo`, `cat` or log them.
   Check them by shape (`case "$v" in postgresql://*-pooler.*) …`). Watch out
   for values wrapped in quotes in `.env` files: a redaction regex that
   ignores the quotes leaks the value. If a secret ever lands in your
   output, say so at once and have it rotated.
6. **Verify, don't assume.** After each provisioning step, check it worked
   with a read-only call before moving on.

## Two kinds of tokens

Read `SECRETS.md` in the template. It is the user-facing version of this
section and stays in the new app.

| | **Setup tokens** (`able-setup`) | **CI tokens** (`<slug>-ci`) |
|---|---|---|
| For | you, Claude: creating and debugging infrastructure | GitHub Actions: every deploy |
| Saved via | the `request_credential` card, onto this cloud environment | GitHub Actions secrets, pasted by the user |
| Neon | **organization-wide** key, so you can create the project | **project-scoped** key for this app's project |
| Fly | org token | org token (previews create apps) |
| Cloudflare | Pages Edit + Account Settings Read (+ Zone DNS Edit and Zone Read for custom domains) | Pages Edit only |
| Reused across apps | yes | no, one set per app |

Never put a CI token into a card or a setup token into GitHub. The point
of the split is that each app's CI holds only what that app needs, while
the broad setup tokens live only in the Claude environment. The user can
expire or revoke them without affecting any deploy.

On a second or later app, the setup tokens are usually already saved, so
the user creates only the three CI tokens.

## How `request_credential` works

- Call it with the API **host**, a short `display_name` and a `reason`. Tell
  the user in your message which token to paste, *before* calling it.
- The value is saved on this session's cloud environment, and every session
  that uses the environment can use it. The network proxy injects it as
  `Authorization: Bearer <value>` on requests to that host, and you never
  see it. CLIs and SDKs still want a key variable, so set it to the
  placeholder `proxy-injected`, for example
  `NEON_API_KEY=proxy-injected npx neon …` or
  `FLY_API_TOKEN=proxy-injected flyctl …`. For raw HTTP, send any dummy
  bearer token; the proxy overwrites it.
- The card **rejects values that look like they include a header scheme.**
  Fly tokens start with `FlyV1 `, so tell the user to delete the leading
  `FlyV1 ` in the card before saving. Fly accepts `Bearer fm2_…`.
- If the user declines a card, don't re-ask unless they say so, for example
  "I submitted it wrong, ask again". If they say that, ask again.
- After `saved`, retry right away. Wait about a minute only if you get a
  401/403 or a "no rule allows host" refusal.

## Values you will collect

Track these as you go. Every one ends up in `.github/deploy.env`:

| Key | Source |
|---|---|
| `NEON_PROJECT_ID` | returned when you create the Neon project |
| `NEON_PROD_BRANCH` | the project's default branch (`main` for API-created projects; check it) |
| `NEON_DB_NAME`, `NEON_DB_ROLE` | Neon API (`neondb` / `neondb_owner` by default) |
| `NEON_CLI` | `neon@<npm view neon version>` |
| `FLY_ORG` | Fly GraphQL (`personal` for most users) |
| `FLY_BACKEND_APP` | `<github-user>-<slug>-backend`, checked for availability |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare API |
| `CLOUDFLARE_PAGES_PROJECT` | `<slug>-frontend` |
| `PROD_FRONTEND_ORIGIN` | `https://<pages subdomain>`, returned when the Pages project is created |
| `WORKOS_CLIENT_ID` | pasted by the user in chat |

---

## Step 1: Name the app

Ask the user:

1. **What's the app called?** This is the display name, e.g. "Chore Chart".
2. **One sentence on what it's for.** This goes into the README and
   `CLAUDE.md`.

Derive the **slug**: lowercase, hyphens only, e.g. `chore-chart`. Confirm
the name and slug with the user in one line, then continue.

## Step 2: Accounts

Ask which of these the user already has. For the rest, give the sign-up
links and wait. Signing in with GitHub is fine wherever it's offered.

| Service | What it's for | Sign up |
|---|---|---|
| GitHub | code + CI | https://github.com/signup |
| Neon | Postgres + Realtime | https://console.neon.tech/signup |
| Fly.io | backend hosting (asks for a payment method) | https://fly.io/app/sign-up |
| Cloudflare | frontend hosting (Pages) | https://dash.cloudflare.com/sign-up |
| WorkOS | sign-in (AuthKit) | https://dashboard.workos.com |

## Step 3: Create the repo from the template

Have the user:

1. Open **https://github.com/lightbody/able/generate**.
2. Owner: their account. Repository name: the slug. Choose **Private**.
3. Tap **Create repository**, then tell you their GitHub username and the
   repo name, if they differ from what you expect.

Then attach it with push access: call `add_repo` with `access: "push"`.
If it's refused because the Claude GitHub App can't see the new repo (the
app is installed on selected repos only), have the user add the repo at
**https://github.com/apps/claude/installations/select_target**, then retry.
Once attached, clone it to the path the result gives you, and work on
`main`. The user's request to set up this app authorizes pushing the setup
commit to `main` of this new repo. If the session refuses, push a branch
and open a PR instead.

Creating the repo triggers CI on its first commit. The deploy jobs skip
themselves while `.github/deploy.env` is empty, so the run is harmless.

## Step 4: Setup tokens (only the missing ones)

First call `get_environment`. Its `network_secrets` lists the hosts that
already have a saved credential (never the values). Check each service:

| Service | Saved if these hosts are listed | Check it's a usable setup token |
|---|---|---|
| Neon | `console.neon.tech` | `GET https://console.neon.tech/api/v2/projects` succeeds. A project-scoped key fails with "not allowed outside the project", and must be replaced with an org-wide one. |
| Fly | `api.fly.io` **and** `api.machines.dev` | the GraphQL `{ organizations { nodes { slug type } } }` returns the org |
| Cloudflare | `api.cloudflare.com` | `GET /client/v4/user/tokens/verify` is `active`, **and** `GET /client/v4/accounts` lists the account |

Tell the user which setup tokens are already in place, and walk them through
creating only the missing or unusable ones. Each one goes **only** into a
card, never into GitHub.

**Neon setup token**
1. Neon Console → **Organization settings → API keys → Create API key**.
   Choose the **organization** key type, not project-scoped. Name it
   `able-setup`. Copy it.
2. Paste it into the card. Call `request_credential` with host
   `console.neon.tech`.

**Fly setup token**
1. Open **https://fly.io/dashboard**, go to the org's **Tokens** page, and
   create an **organization** token named `able-setup`. If an expiry is
   offered, pick whatever the user is comfortable with. When it lapses,
   the next setup simply asks again. Copy the whole value.
2. It goes into **two** cards. Delete the leading `FlyV1 ` in each one.
   Call `request_credential` with host `api.fly.io`, then with host
   `api.machines.dev`.

**Cloudflare setup token**
1. Open **https://dash.cloudflare.com/profile/api-tokens**, then **Create
   Token** → (scroll down) **Custom token** → **Get started**.
   - **Name:** `able-setup`
   - **Permissions:**
     - `Account` → `Cloudflare Pages` → `Edit`
     - `Account` → `Account Settings` → `Read`
     - Optional, so Claude can set up custom domains:
       - `Zone` → `DNS` → `Edit`
       - `Zone` → `Zone` → `Read`
   - **Account Resources:** `Include` → their account. If zone permissions
     were added, **Zone Resources:** `Include` → `All zones from an
     account` → their account.
   - Leave **TTL** empty, or set an end date if the user prefers.
   - Tap **Continue to summary**, then **Create Token**, then **Copy**.
2. Paste it into the card. Call `request_credential` with host
   `api.cloudflare.com`.

Re-run the checks in the table for each new token.

## Step 5: Provision (you)

Install flyctl once with
`curl -fsSL https://fly.io/install.sh | FLYCTL_INSTALL=<scratch dir>/fly sh`.

**Neon: create the project.**

1. Find the org ID. Org keys can list projects, so read it from any
   project's `org_id`. If there are no projects yet, try
   `GET /api/v2/users/me/organizations`. As a last resort, ask the user: it's
   on Neon Console → **Organization settings → General**, it starts with
   `org-`, and it isn't secret.
2. Create the project:
   ```bash
   curl -s -X POST https://console.neon.tech/api/v2/projects -H "Authorization: Bearer x" \
     -H "Content-Type: application/json" \
     -d '{"project":{"name":"<Display Name>","region_id":"aws-us-east-1","org_id":"<org id>"}}'
   ```
   Realtime is beta and available only in `aws-us-east-1`, `aws-us-east-2`,
   `aws-eu-central-1` and `aws-ap-southeast-1`. Use `aws-us-east-1` (next
   to Fly's `iad`) unless the user asks otherwise.
3. From the response and from
   `npx -y neon@latest databases list --project-id $P --branch <default>`,
   record `NEON_PROJECT_ID`, the default branch, the database name and the
   owner role. **Never print** the `connection_uris` the create call
   returns.
4. Enable Realtime on the default branch:
   `NEON_API_KEY=proxy-injected npx -y neon@latest realtime enable --project-id $P --branch <default>`.
5. Verify Realtime on a throwaway branch, never the default:
   - `neon branches create --name scratch/rt-test --parent <default>`.
   - Create a table with a primary key and insert a row.
   - Run `neon realtime subscribe --output json "SELECT * FROM items ORDER BY id"`
     in the background, insert another row, and check that a second
     snapshot arrives.
   - `neon branches delete scratch/rt-test`.

   Two catches. **Port 5432 is blocked** from cloud containers, so
   `neon psql` fails. Run SQL over HTTPS with `@neondatabase/serverless`:
   get a connection string with `neon connection-string` into a variable
   (never print it), then `neon(url).query(sql)`. And a live query must read
   a table: `SELECT 1` is rejected ("upstream rejected").

**Fly: reserve the app name.**

```bash
curl -s https://api.fly.io/graphql -H "Authorization: Bearer x" -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { nodes { slug type } } }"}'          # FLY_ORG
curl -s -o /dev/null -w "%{http_code}\n" https://<github-user>-<slug>-backend.fly.dev/   # 000 = name looks free
FLY_API_TOKEN=proxy-injected flyctl apps create <github-user>-<slug>-backend --org <FLY_ORG>
```

Fly's logs API rejects bearer-injected tokens (401). Use the Machines API
(`GET https://api.machines.dev/v1/apps/<app>/machines`) for machine state
and exit codes when debugging.

**Cloudflare: create the Pages project.**

```bash
curl -s https://api.cloudflare.com/client/v4/accounts -H "Authorization: Bearer x"   # CLOUDFLARE_ACCOUNT_ID
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$A/pages/projects" -H "Authorization: Bearer x" \
  -H "Content-Type: application/json" -d '{"name":"<slug>-frontend","production_branch":"main"}'
```

Use the returned `result.subdomain`. If the name was taken, Cloudflare adds
a suffix. `PROD_FRONTEND_ORIGIN` is `https://<subdomain>`. Then restrict
Realtime on the default branch:

```bash
NEON_API_KEY=proxy-injected npx -y neon@latest realtime enable --project-id $P \
  --branch <default branch> --allowed-origin "$PROD_FRONTEND_ORIGIN"
```

## Step 6: CI tokens (GitHub secrets only)

The project now exists, so the user can create its narrowly scoped CI
tokens. Every one goes **only** into GitHub, at:
`https://github.com/<owner>/<repo>/settings/secrets/actions/new`

Do one service at a time. For each: create the token and copy it, then in
GitHub type the **Name** (don't copy it), paste the **Secret**, and tap
**Add secret**. These tokens never go into a card.

1. **`NEON_API_KEY`**: Neon Console → **Organization settings → API keys →
   Create API key** → **project-scoped** → select the new project. Name it
   `<slug>-ci`.
2. **`FLY_API_TOKEN`**: https://fly.io/dashboard → the org's **Tokens** →
   create an **organization** token named `<slug>-ci`, with no short expiry,
   since CI needs it long-term. Paste the **whole** value, including
   `FlyV1 `.
3. **`CLOUDFLARE_API_TOKEN`**: https://dash.cloudflare.com/profile/api-tokens
   → **Create Token** → **Custom token**. Name `<slug>-ci`, **only**
   `Account` → `Cloudflare Pages` → `Edit`, Account Resources → their
   account.

You can't read GitHub secrets. The first deploy in step 9 verifies them.

## Step 7: WorkOS (sign-in)

WorkOS has no step you can automate here. Have the user, in
**https://dashboard.workos.com** with the **Production** environment
selected (environment switcher, top left):

1. **Redirects** (under **Applications** → their app, or in the sidebar).
   Add, one at a time, copied from your message, with **no trailing slash**:
   - `<PROD_FRONTEND_ORIGIN>`
   - `https://*.<pages subdomain>`, for example
     `https://*.chore-chart-frontend.pages.dev`, which covers every PR
     preview
2. **Authentication → Sessions → Cross-Origin Resource Sharing (CORS)**,
   which some dashboards call "Allowed origins". Add the same two values.
3. **API Keys**: copy the **Client ID** (`client_…`) last, and paste it in
   chat.

**Verify** each redirect without signing in. Probe both the prod origin
and an invented preview origin such as `https://pr-test.<pages subdomain>`:

```bash
curl -s -o /dev/null -w "%{redirect_url}\n" "https://api.workos.com/user_management/authorize?client_id=$CID&redirect_uri=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$ORIGIN")&response_type=code&provider=authkit"
```

A redirect to `error.workos.com/redirect-uri-invalid` means the origin isn't
registered. The usual culprit is a trailing `/` on the wildcard entry:
WorkOS matches wildcards exactly, and the app sends the bare origin. If
`https://pr-test.<sub>/` passes but the version without the slash fails,
that's the cause. Also check the client is real:
`curl -s https://api.workos.com/sso/jwks/$CID` should list at least one
key.

## Step 8: Make the code the user's app

In the cloned repo:

1. **Rename the placeholders** in every tracked file, including
   `package-lock.json`:
   - `My App` → display name
   - `myapp` → slug. This covers the package names, `@myapp/shared` → `@<slug>/shared`,
     the Pages project and the Fly app placeholder.
   - In `fly.backend.toml`, set `app = "<FLY_BACKEND_APP>"`.

   Leave `app_test` alone. It's the local test database, named so it never
   needs renaming.
2. **Fill in `.github/deploy.env`.** Every value from the table above. Set
   `NEON_CLI` to the current `neon` version.
3. **Docs:**
   - `README.md`: delete everything from `<!-- able:template-start` through
     `<!-- able:template-end -->`. Under the title, put the user's
     one-sentence description in place of the template text.
   - `CLAUDE.md`: replace "My App is a new web app." with the description.
   - **Keep `SECRETS.md`.** It's the app's guide to its tokens and to
     rotating them.
4. **Delete `PLAYBOOK.md`.** The new app doesn't need it.
5. Run `npm install`, which regenerates the lockfile for the new names.
   Then run the same checks CI runs:
   - `npm run build --workspace=shared && npm test --workspace=shared`
   - `npm run build --workspace=backend && npm test --workspace=backend`.
     This needs Postgres on 127.0.0.1:5432 with database `app_test`.
     `.claude/hooks/session-start.sh` starts one, so run it with
     `CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD` if it hasn't run.
   - `npm run build --workspace=frontend`
6. `git grep -n -i -E "myapp|my app"` must find nothing except `@<slug>/`
   lookalikes you've checked. Then commit everything as one commit,
   "Set up <Name>", and push to `main`.

## Step 9: Production comes up

The push to `main` runs `backend.yml`, which tests and then deploys to Fly
against the default Neon branch, running migrations on boot. It also runs
`frontend.yml`, which deploys Pages production. **This is the first use of
the CI tokens.** A failure at a Neon, Fly or Cloudflare step usually means
a CI token was pasted into the wrong secret or has the wrong scope, so
check the job log for which call failed.

Watch the runs with the GitHub tools, read failed job logs, fix, and push.
Then verify:

- `curl https://<FLY_BACKEND_APP>.fly.dev/health` returns `{"status":"ok"}`.
- `/live/config` without a token returns 401.
- A CORS preflight from `PROD_FRONTEND_ORIGIN` returns 204 with
  `access-control-allow-origin: <origin>`.
- The page at `PROD_FRONTEND_ORIGIN` serves the app's `<title>`.
- The `greetings` table exists on the default branch, checked over HTTPS
  SQL.

Then ask the user to open `PROD_FRONTEND_ORIGIN` in **two tabs**, sign in,
see "Hello, <Name>!", add a greeting in one tab, and watch it appear in the
other.

## Step 10: Previews come up

Open a small real PR, such as a README tweak on a new branch, and subscribe
to its activity. `preview.yml` creates Neon branch `preview/pr-<n>`, enables
Realtime on it with origin `*`, deploys `<FLY_BACKEND_APP>-pr-<n>`, and
comments the URLs. `frontend.yml` deploys a Pages preview at
`https://<branch-alias>.<pages subdomain>`.

Run the same server-side checks against the preview, then have the user do
the two-tab test on the preview URL from the PR comment. Then merge or
close the PR. Closing tears the preview down.

## Step 11 (optional): Custom domain

Only if the user wants one, for example `chore-chart.example.com`:

1. **Attach the domain.**
   - If the Cloudflare setup token has the zone permissions and the
     domain's DNS is on Cloudflare in the same account, do it yourself:
     - `POST /accounts/$A/pages/projects/<project>/domains` with
       `{"name":"<domain>"}`
     - find the zone with `GET /zones?name=<apex>`
     - create a proxied CNAME, `<domain>` → `<pages subdomain>`, with
       `POST /zones/<zone id>/dns_records`
   - Otherwise the user does it: **Workers & Pages → `<slug>-frontend` →
     Custom domains → Set up a custom domain**, types the domain, and taps
     **Activate**. If the DNS isn't on Cloudflare, they add the CNAME it
     shows at their DNS host.
   - Either way, check status with
     `GET /accounts/$A/pages/projects/<project>/domains`.
2. **You:** set `PROD_FRONTEND_ORIGIN=https://<domain>` in
   `.github/deploy.env` and push, which redeploys with the new CORS origin.
   Then re-run `neon realtime enable --branch <default> --allowed-origin https://<domain>`.
3. **User:** add `https://<domain>` to the WorkOS Redirects and CORS lists.
   You verify it with the authorize probe.
4. Sign-in now works only at the custom domain. The `pages.dev` address
   still serves the page, but the backend rejects its API calls.

## Done

Tell the user, briefly:

- the prod URL, the repo, and how previews work
- that deploys use only the three `<slug>-ci` tokens in GitHub, and that
  `SECRETS.md` explains how to rotate them
- that the `able-setup` tokens stay on this cloud environment for the next
  app and for debugging. They can revoke them at any time without
  affecting deploys, by removing them under the environment name in the
  session title bar → **Edit** → **Network secrets**, and revoking them in
  each service's dashboard.
