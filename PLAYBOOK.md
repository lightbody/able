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
4. **Secrets never go through chat.** API tokens go into GitHub secrets
   (the user pastes them) and into the `request_credential` tool, which
   shows the user a secure card. Never ask for a token in chat. Non-secret
   IDs (Cloudflare account ID, WorkOS client ID) are fine in chat.
5. **Never print a secret.** You will handle connection strings and Realtime
   secrets in shell variables and files. Never `echo`, `cat` or log them.
   Check them by shape (`case "$v" in postgresql://*-pooler.*) …`). Watch out
   for values wrapped in quotes in `.env` files: a redaction regex that
   ignores the quotes leaks the value. If a secret ever lands in your
   output, say so at once and have it rotated.
6. **Verify, don't assume.** After each provisioning step, check it worked
   with a read-only call before moving on.

## How `request_credential` works (read before step 3)

- Call it with the API **host**, a short `display_name` and a `reason`. Tell
  the user in your message which token to paste, *before* calling it.
- The value is saved on this session's cloud environment, and the network
  proxy injects it as `Authorization: Bearer <value>` on every request to
  that host. You never see it. CLIs and SDKs still want a key variable, so
  set it to the placeholder `proxy-injected`, for example
  `NEON_API_KEY=proxy-injected npx neon …` or
  `FLY_API_TOKEN=proxy-injected flyctl …`. For raw HTTP, send any dummy
  bearer token; the proxy overwrites it.
- The card **rejects values that look like they include a header scheme.**
  Fly tokens start with `FlyV1 `. Tell the user to paste the full token into
  GitHub, then delete the leading `FlyV1 ` in the card before saving. Fly
  accepts `Bearer fm2_…`.
- If the user declines a card, don't re-ask unless they say so, for example
  "I submitted it wrong, ask again". If they say that, ask again.
- After `saved`, retry right away. Wait about a minute only if you get a
  401/403 or a "no rule allows host" refusal.

## Values you will collect

Track these as you go. Every one ends up in `.github/deploy.env`:

| Key | Source |
|---|---|
| `NEON_PROJECT_ID` | Neon API, after the user creates the project |
| `NEON_PROD_BRANCH` | the project's default branch (`production` for Console-created projects) |
| `NEON_DB_NAME`, `NEON_DB_ROLE` | Neon API |
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
Once attached, clone it to the path the result gives you, and work on `main`. The user's
request to set up this app authorizes pushing the setup commit to `main`
of this new repo. If the session refuses, push a branch and open a PR
instead.

Creating the repo triggers CI on its first commit. The deploy jobs skip
themselves while `.github/deploy.env` is empty, so the run is harmless.

Each GitHub secret the user adds goes here (fill in owner/repo):
`https://github.com/<owner>/<repo>/settings/secrets/actions/new`

## Step 4: Neon (database + Realtime)

**User:**

1. Go to **https://console.neon.tech/app/projects** and tap **New project**.
   - **Name:** the display name.
   - **Region:** **AWS US East 1 (N. Virginia)**. Realtime is beta and
     available only in `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1`
     and `aws-ap-southeast-1`. Projects can't change region later.
   - Leave the rest at the defaults.
2. Create an API key: **Organization settings → API keys → Create API key**.
   Pick **project-scoped**, select the new project, and name it `<slug>-ci`.
   Copy it.
3. In the GitHub secrets tab: **Name** `NEON_API_KEY` (typed), **Secret**:
   paste. Then **Add secret**.
4. Paste the same key into the card you're about to show.

**You:** `request_credential` with host `console.neon.tech`. Then:

```bash
# A project-scoped key can only see its own project. Listing projects is
# refused, and the error message names the project id.
curl -s https://console.neon.tech/api/v2/projects -H "Authorization: Bearer x"
P=<project id>
curl -s https://console.neon.tech/api/v2/projects/$P -H "Authorization: Bearer x"           # check region_id
curl -s https://console.neon.tech/api/v2/projects/$P/branches -H "Authorization: Bearer x"  # default branch
export NEON_API_KEY=proxy-injected
npx -y neon@latest databases list --project-id $P --branch <default branch>   # db name + owner role
npx -y neon@latest realtime enable --project-id $P --branch <default branch>
```

**Verify that Realtime works.** Use a throwaway branch, never the default
branch:

1. `neon branches create --name scratch/rt-test --parent <default>`.
2. Create a table with a primary key and insert a row.
3. Run `neon realtime subscribe --output json "SELECT * FROM items ORDER BY id"`
   in the background, insert another row, and check that a second snapshot
   arrives.
4. `neon branches delete scratch/rt-test`.

Two catches:

- **Port 5432 is blocked** from cloud containers, so `neon psql` fails. Run
  SQL over HTTPS with `@neondatabase/serverless`: get a connection string
  with `neon connection-string` into a variable (never print it), then
  `neon(url).query(sql)`.
- A live query must read a table. `SELECT 1` is rejected ("upstream
  rejected").

You'll set Realtime's allowed origin on the default branch in step 6, once
the Pages URL exists.

## Step 5: Fly.io (backend)

**User:**

1. Open **https://fly.io/dashboard**, open their organization's **Tokens**
   page, and create an **organization** token named `<slug>-ci`. It must be
   an organization token, not an app deploy token, because PR previews
   create apps. Copy the whole value, including `FlyV1 `.
2. In GitHub: **Name** `FLY_API_TOKEN` (typed), **Secret**: paste the full
   token. Then **Add secret**.
3. Paste it into the two cards you'll show next, **deleting the leading
   `FlyV1 `** in each one.

**You:** call `request_credential` twice with the same token: host
`api.fly.io`, then host `api.machines.dev`. Both are Fly's. Install
flyctl with `curl -fsSL https://fly.io/install.sh | FLYCTL_INSTALL=<scratch dir>/fly sh`.
Then:

```bash
curl -s https://api.fly.io/graphql -H "Authorization: Bearer x" -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { nodes { slug type } } }"}'          # FLY_ORG
curl -s -o /dev/null -w "%{http_code}\n" https://<github-user>-<slug>-backend.fly.dev/   # 000 = name looks free
FLY_API_TOKEN=proxy-injected flyctl apps create <github-user>-<slug>-backend --org <FLY_ORG>  # reserve the name
```

Fly's logs API rejects bearer-injected tokens (401). Use the Machines API
(`GET https://api.machines.dev/v1/apps/<app>/machines`) for machine state
and exit codes when debugging.

## Step 6: Cloudflare (frontend)

**User:**

1. Open **https://dash.cloudflare.com/profile/api-tokens**, tap **Create
   Token**, scroll to **Custom token**, and tap **Get started**.
   - **Name:** `<slug>-ci`
   - **Permissions:** add two rows:
     - `Account` → `Cloudflare Pages` → `Edit`
     - `Account` → `Account Settings` → `Read`, so you can look up the
       account ID
   - **Account Resources:** `Include` → their account.
   - Tap **Continue to summary**, then **Create Token**, then **Copy**. The
     token is shown only once.
2. In GitHub: **Name** `CLOUDFLARE_API_TOKEN` (typed), **Secret**: paste.
   Then **Add secret**.
3. Paste it into the card.

**You:** `request_credential` with host `api.cloudflare.com`. Then:

```bash
curl -s https://api.cloudflare.com/client/v4/accounts -H "Authorization: Bearer x"   # CLOUDFLARE_ACCOUNT_ID
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$A/pages/projects" -H "Authorization: Bearer x" \
  -H "Content-Type: application/json" -d '{"name":"<slug>-frontend","production_branch":"main"}'
```

Use the returned `result.subdomain`. If the name was taken, Cloudflare adds
a suffix. `PROD_FRONTEND_ORIGIN` is `https://<subdomain>`. Now restrict
Realtime on the default branch:

```bash
NEON_API_KEY=proxy-injected npx -y neon@latest realtime enable --project-id $P \
  --branch <default branch> --allowed-origin "$PROD_FRONTEND_ORIGIN"
```

If `/accounts` comes back empty, the token lacks the Account Settings
permission. Ask the user for the Account ID instead. It's on the right of
**Workers & Pages → Overview**, or it's the 32-character segment after
`dash.cloudflare.com/` in the address bar. It isn't secret, so chat is fine.

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
`frontend.yml`, which deploys Pages production. Watch the runs with the
GitHub tools, read failed job logs, fix, and push. Then verify:

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

1. **User:** in Cloudflare, **Workers & Pages → `<slug>-frontend` → Custom
   domains → Set up a custom domain**, then type the domain and **Activate**.
   If the domain's DNS is on Cloudflare, the record is created
   automatically. Otherwise they add the CNAME it shows at their DNS host.
   You can check status with
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
- that the three tokens live in GitHub secrets and on this cloud
  environment, and where to manage them: the environment menu in the session
  title bar → **Edit** → **Network secrets**
- that `CLAUDE.md` tells future sessions how deploys work and how to use
  those keys
