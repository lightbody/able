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
| Neon | **organization** key (a personal key also works, but reaches every org the user belongs to) | **project-scoped** key for this app's project |
| Fly | **personal access token** (acts as the user across all their orgs) | org token for **this app's own org** (previews create apps) |
| Cloudflare | Pages Edit + Account Settings Read (+ Zone DNS Edit and Zone Read for custom domains) | Pages Edit only |
| Reused across apps | yes | no, one set per app |

Never put a CI token into a card or a setup token into GitHub. The point
of the split is that each app's CI holds only what that app needs, while
the broad setup tokens live only in the Claude environment. The user can
expire or revoke them without affecting any deploy.

On a second or later app, the setup tokens are usually already saved, so
the user creates only the three CI tokens.

## How `request_credential` works

- **Two turns, never one.** The card can cover your message, and the user
  can't create a token while it is open. So:
  1. **Guide turn.** Send only the steps for creating that one token, ending
     with "copy it, then tell me when you have it copied". Don't call
     `request_credential` in this turn. End the turn and wait.
  2. **Card turn.** Only after the user confirms they have the token
     copied, say in one line which token the card is for, then call
     `request_credential`. If they report a problem instead, help with
     that, and don't show the card yet.
- Call it with the API **host**, a short `display_name` and a `reason`.
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
| `NEON_PROJECT_ID` | the project you create with the Neon API in step 5 |
| `NEON_PROD_BRANCH` | the project's default branch (API-created projects call it `main`, console-created ones may call it `production`; check it) |
| `NEON_DB_NAME`, `NEON_DB_ROLE` | Neon API (`neondb` / `neondb_owner` by default) |
| `NEON_CLI` | `neon@<npm view neon version>` |
| `FLY_ORG` | the slug of the app's own Fly org (step 5) |
| `FLY_BACKEND_APP` | `<github-user>-<slug>-backend`, checked for availability |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare API |
| `CLOUDFLARE_PAGES_PROJECT` | `<slug>-frontend` |
| `PROD_FRONTEND_ORIGIN` | `https://<pages subdomain>`, returned when the Pages project is created |
| `WORKOS_CLIENT_ID` | pasted by the user in chat |

You also pick a **region pair** in step 1. The Neon region is the project's
`region_id`. The Fly region goes into `primary_region` in
`fly.backend.toml`, not `deploy.env`.

---

## Step 1: Name the app

Ask the user:

1. **What's the app called?** This is the display name, e.g. "Chore Chart".
2. **One sentence on what it's for.** This goes into the README and
   `CLAUDE.md`.
3. **Roughly where are you and your users?** A continent or country is
   enough. This picks where the database and backend run.

Derive the **slug**: lowercase, hyphens only, e.g. `chore-chart`.

Suggest a **region pair** from the table below. The backend talks to the
database on every request, so the Fly region must sit next to the Neon
region. Neon Realtime is in beta and available only in the four Neon
regions below, so the Neon region comes first and the Fly region follows
it. Before you suggest one, check the current list at
https://neon.com/docs/realtime/overview#which-regions-is-it-enabled-in. If
it has changed, pair any new region with the nearest Fly region.

| Users mostly in | Neon region | Fly region |
|---|---|---|
| North or South America (default) | `aws-us-east-1` (N. Virginia) | `iad` (Ashburn, Virginia) |
| US Midwest, if they prefer it | `aws-us-east-2` (Ohio) | `ord` (Chicago) |
| Europe, the Middle East or Africa | `aws-eu-central-1` (Frankfurt) | `fra` (Frankfurt) |
| Asia or Oceania | `aws-ap-southeast-1` (Singapore) | `sin` (Singapore) |

No Realtime region is in the western Americas yet. Users there still get
`aws-us-east-1` + `iad`, so say that pages will be a little slower for
them. Confirm the name, slug and region pair with the user in one line,
then continue.

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

**New Neon accounts: don't create a project.** Neon's sign-up usually goes
on to a create-project form. Tell the user, before they sign up, to skip
that form or close it: you create the project yourself in step 5, in the
region from step 1, with Postgres and Realtime set up. If the form can't be
skipped, have them create it with the display name as the project name and
the Neon region from step 1, and close any connection string without
copying it. You adopt that project in step 5 instead of creating one.

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
| Neon | `console.neon.tech` | `GET https://console.neon.tech/api/v2/projects` succeeds. A project-scoped key fails with "not allowed outside the project". It can't create the new project, so it must be replaced with an organization key. |
| Fly | `api.fly.io` **and** `api.machines.dev` | the GraphQL `{ organizations { nodes { slug type } } }` lists **all** the user's orgs. If it lists only one org while the user has more, it's an org token: ask for a personal access token instead. |
| Cloudflare | `api.cloudflare.com` | `GET /client/v4/user/tokens/verify` is `active`, **and** `GET /client/v4/accounts` lists the account |

Tell the user which setup tokens are already in place, and walk them through
creating only the missing or unusable ones. Each one goes **only** into a
card, never into GitHub.

Do one token at a time, in the two turns described in "How
`request_credential` works". First send the creation steps below and end
your turn with "copy it, then tell me when you have it copied". Only after
the user confirms, call `request_credential`. Never show a card in the same
turn as the creation steps.

**Neon setup token**

This key creates the app's project in step 5, so it has to be an
**organization** key. A project-scoped key can't create projects. Tell the
user that, because the key-type choice is easy to miss.

There's no deep link, because the settings URL contains the organization's
ID. Spell out the navigation, and warn about the trap: the profile menu
also has a **Settings → API keys** page, but that one makes **personal**
keys. The key has to come from the **organization's** Settings. Give the
user these steps, in your own words:

1. Open **https://console.neon.tech** and sign in.
2. Make sure the right organization is active. Tap your name or avatar
   in the **top-right** to open the profile menu, and use the
   **organization switcher** there to choose the organization this app
   should live in. Then close the menu. **Don't** use the profile menu's
   own **Settings**: that's your personal account, and its API keys are
   personal keys.
3. With the organization active, open **Settings** in the organization's
   navigation (the left sidebar; on a narrow screen it may be behind a ☰
   menu button). The page is the organization's settings: it shows the
   organization's name and ID, alongside tabs for things like people and
   billing.
4. Open the **API keys** tab and tap **Create new**.
5. Choose the **Organization** key type, not **Project-scoped**. Don't
   pick a project.
6. Name: type `able-setup`. Create the key.
7. The key is shown **only once**. Copy it now, and don't copy anything
   else until it's saved in the card. If the dialog closes before you
   copy it, revoke that key and create another.
8. Tell Claude it's copied.

Only organization **Admins** can create organization keys. If the user
doesn't see **Create new** or the **Organization** option, they aren't an
Admin of that organization: have them pick an organization they administer
(their own default one is fine).

**After the user confirms:** call `request_credential` with host
`console.neon.tech`. They paste the key into the card.

If the user belongs to more than one Neon organization, ask which one the
app's project belongs in before giving the steps, and have them create the
key there. The key's organization is where you create the project.

**Fly setup token**

This has to be a **personal access token**, not an org token, because
each app gets its own Fly org and the setup token has to reach all of
them. Tell the user that, because the dashboard also offers **Tokens**
pages for each org and each app, and those make org or app tokens. Give
the user these steps, in your own words:

1. Open **https://fly.io/dashboard** and sign in.
2. Open the **account menu**: tap your avatar or email address. Don't use
   the organization dropdown or an app's **Tokens** page; those make org
   and app tokens.
3. Choose **Access Tokens** and create a token. Name: type `able-setup`.
   Leave the expiry at the default, or pick an end date if you prefer.
4. The token is shown **only once**. Copy the **whole** value; it's long,
   so use the page's copy button if there is one rather than selecting it.
   It goes into **two** cards, so don't copy anything else until both
   are saved.
5. Tell Claude it's copied.

**After the user confirms:** say there are two cards, and that if the
token starts with `FlyV1 ` they delete that prefix (including the space)
in **each** card before saving. Then call `request_credential` with host
`api.fly.io`, and after it's saved, with host `api.machines.dev`.

**Cloudflare setup token**

This is a **user API token** made from a custom template. Warn about two
traps on that page: the **Global API Key** further down is all-powerful
and must not be used, and the ready-made templates (such as "Edit
Cloudflare Workers") grant the wrong permissions. Ask first whether the
user wants Claude to be able to set up custom domains later (step 11);
that adds two optional permissions. Give the user these steps, in your
own words:

1. Open **https://dash.cloudflare.com/profile/api-tokens** and sign in.
   This is **My Profile → API Tokens** (user tokens). Don't use
   **Manage Account → API Tokens** (account tokens), and don't touch the
   **Global API Key** section.
2. Tap **Create Token**. Scroll to the bottom, to **Create Custom
   Token**, and tap **Get started**.
3. **Token name:** type `able-setup`.
4. **Permissions:** one row per permission. Pick the three dropdowns left
   to right, and tap **+ Add more** for the next row:
   - `Account` · `Cloudflare Pages` · `Edit`
   - `Account` · `Account Settings` · `Read`
   - Only if they want custom domains:
     - `Zone` · `DNS` · `Edit`
     - `Zone` · `Zone` · `Read`
5. **Account Resources:** `Include` · their account.
   If they added the zone rows, **Zone Resources:** `Include` ·
   `All zones from an account` · their account.
6. Leave **Client IP Address Filtering** empty. Leave **TTL** empty, or
   set an end date if they prefer.
7. Tap **Continue to summary**, check it lists exactly the rows above,
   then tap **Create Token**.
8. The token is shown **only once**. Tap **Copy**. Don't copy the
   example `curl` command on that page.
9. Tell Claude it's copied.

**After the user confirms:** call `request_credential` with host
`api.cloudflare.com`. They paste the token into the card.

Re-run the checks in the table for each new token.

## Step 5: Provision (you)

Install flyctl once with
`curl -fsSL https://fly.io/install.sh | FLYCTL_INSTALL=<scratch dir>/fly sh`.

**Neon: create the project.**

1. Check whether a project with the display name already exists, for
   example one the user couldn't skip creating at sign-up. Print only
   non-secret fields:
   ```bash
   curl -s https://console.neon.tech/api/v2/projects -H "Authorization: Bearer x" \
     | jq '.projects[] | {id, name, region_id, org_id}'
   ```
   If exactly one matches, adopt it and go on to item 3 below. If more
   than one matches, ask the user which one to use.
2. Otherwise create it in the Neon region from step 1. The response
   includes connection URIs with the password, so **never print it raw**.
   Keep only the project fields:
   ```bash
   curl -s -X POST https://console.neon.tech/api/v2/projects -H "Authorization: Bearer x" \
     -H "Content-Type: application/json" \
     -d '{"project":{"name":"<display name>","region_id":"<neon region>"}}' \
     | jq '.project | {id, name, region_id, org_id}, (.message // empty)'
   ```
   The org key puts the project in its own organization. Its `id` is
   `NEON_PROJECT_ID`. Leave the Postgres version at Neon's default.
3. **Check `region_id`** with a read-only `GET /api/v2/projects/$P`. It
   must be the Neon region from step 1, and a Realtime region. The region
   can't be changed. If you just created the project in the wrong region,
   delete it (`DELETE /api/v2/projects/$P`) and create it again. If it's a
   project you adopted, ask the user before deleting it. Don't carry on in
   the wrong region.
4. From `GET /api/v2/projects/$P/branches` (the one with `"default": true`)
   and `npx -y neon@latest databases list --project-id $P --branch <default>`,
   record the default branch, the database name and the owner role.
   **Never print** connection strings.
5. Enable Realtime on the default branch, even if it's already on. The
   command is idempotent, and the next steps need it on:
   `NEON_API_KEY=proxy-injected npx -y neon@latest realtime enable --project-id $P --branch <default>`.
6. Verify Realtime on a throwaway branch, never the default:
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

**Fly: the app's own org.** Give every app its own Fly org, so its CI token
(an org token, which previews need in order to create apps) can't reach the
user's other apps. Creating an org needs billing, so the user does it in
the dashboard, at **https://fly.io/organizations/new** (Fly's new
organization page). Offer the options in this order, then give the steps
for the one they pick:

1. **Linked organization**, billed to an existing org. This is the best of
   both, but Fly reviews these requests manually, so it may be slow or
   refused for hobby projects.
2. **A new organization with its own billing.** The user adds a payment
   method for it. This is the usual choice.
3. **Reuse an existing org.** Zero setup, but this app's CI token can then
   create, deploy and destroy the user's other apps in that org. Say so
   plainly if they pick it.

Steps for the user:

1. Open **https://fly.io/organizations/new**.
2. Name: type the slug, e.g. `chore-chart`.
3. For a linked organization, choose the existing organization to bill
   it to. Otherwise add a payment method for the new org when asked.
4. Create it, then tell Claude it's done.

The user doesn't need to copy anything here. Find the new org's slug
yourself in the GraphQL org list below. It may differ from the name, for
example with a suffix. If it isn't listed yet, ask the user to check
that it finished creating.

**Fly: reserve the app name.**

```bash
curl -s https://api.fly.io/graphql -H "Authorization: Bearer x" -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { nodes { slug name type } } }"}'     # find the app's org -> FLY_ORG
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

Do one token at a time, and give the steps in full each time; don't
assume the user remembers them from step 4. For each:

1. Before they create anything, have the user open the GitHub page above
   in its own tab, ready. Give the full URL, filled in.
2. In another tab, they create the token, as below, and copy it. Each
   token is shown only once.
3. Back in the GitHub tab: **Name**: *type* it, don't copy it, because
   copying the name would replace the token on the clipboard.
   **Secret**: paste. Tap **Add secret**.
4. They tell you it's added, and only then do you give the next token.

These tokens never go into a card.

1. **`NEON_API_KEY`**: the same place as the Neon setup token in step 4.
   That's the **organization's** Settings with the project's organization
   active, **not** the profile menu's Settings. Then **API keys → Create
   new**, choose **Project-scoped**, and select the new project. Name: type
   `<slug>-ci`. It's shown only once, so copy it straight away. Repeat
   the navigation steps from step 4; don't assume the user remembers them.
2. **`FLY_API_TOKEN`**: an **organization** token for **the app's own
   org**, not a personal token like the setup token.
   1. Open **https://fly.io/dashboard**.
   2. In the **organization dropdown**, choose the app's own org (step 5).
      Check that it's the right one before going on: a token for the
      wrong org breaks previews or reaches other apps.
   3. Tap **Tokens** in that org's menu (not an app's **Tokens**, which
      makes deploy tokens that can't create preview apps).
   4. Create a token. Name: type `<slug>-ci`. Choose a long expiry, or
      none if offered, since CI needs it long-term.
   5. Copy the **whole** value. In GitHub, paste it **as is**, including
      `FlyV1 ` at the start. Unlike the card, GitHub needs the prefix.
3. **`CLOUDFLARE_API_TOKEN`**: the same page as the setup token in step 4,
   with fewer permissions.
   1. Open **https://dash.cloudflare.com/profile/api-tokens** (My Profile
      → API Tokens, not the Global API Key).
   2. **Create Token** → bottom of the page, **Create Custom Token** →
      **Get started**.
   3. **Token name:** type `<slug>-ci`.
   4. **Permissions:** exactly **one** row: `Account` · `Cloudflare
      Pages` · `Edit`. Nothing else.
   5. **Account Resources:** `Include` · their account.
   6. **Continue to summary** → **Create Token** → **Copy**.

You can't read GitHub secrets. The first deploy in step 9 verifies them.

## Step 7: WorkOS (sign-in)

WorkOS has no step you can automate here. Have the user, in
**https://dashboard.workos.com** with the **Production** environment
selected (environment switcher, top left):

Each of the two values below goes into **two** places, so have the user
open both pages first, in separate tabs:

- **Redirects**: under **Applications** → their app, or in the sidebar.
- **CORS**: **Authentication → Sessions → Cross-Origin Resource Sharing
  (CORS)**. Some dashboards call it "Allowed origins".

Then, one value at a time, copied from your message, with **no trailing
slash**: copy it, paste it into Redirects, paste it into CORS, save both,
and only then copy the next one.

1. `<PROD_FRONTEND_ORIGIN>`
2. `https://*.<pages subdomain>`, for example
   `https://*.chore-chart-frontend.pages.dev`, which covers every PR
   preview.
3. Last, **API Keys**: copy the **Client ID** (`client_…`) and paste it in
   chat. It isn't a secret.

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
   - In `fly.backend.toml`, set `app = "<FLY_BACKEND_APP>"` and
     `primary_region = "<Fly region from step 1>"`. Previews deploy from
     the same file, so they land in the same region.

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
