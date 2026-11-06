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
| Fly | **org deploy token** for **this app's own org** (personal access tokens no longer work) | a second org deploy token for the same org (previews create apps) |
| Cloudflare | Pages Edit + Account Settings Read (+ Zone DNS Edit and Zone Read for custom domains) | Pages Edit only |
| Reused across apps | Neon and Cloudflare: yes. Fly: no, each app's org needs its own | no, one set per app |

Never put a CI token into a card or a setup token into GitHub. The point
of the split is that each app's CI holds only what that app needs, while
the broad setup tokens live only in the Claude environment. The user can
expire or revoke them without affecting any deploy.

On a second or later app, the Neon and Cloudflare setup tokens are usually
already saved. Fly's isn't reusable: the user creates the new app's Fly org
and a Fly setup token for it, which replaces the previous app's token in the
card, and then the three CI tokens.

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
- **Known card bug: Fly tokens are rejected as pasted.** Fly tokens start
  with `FlyV1 ` (6 characters: `FlyV1` plus one space). The card treats a
  value that starts with a word and a space as a pasted header scheme: it
  shows an error and greys out **Save**. Fly's API works fine without the
  prefix (it accepts `Bearer fm2_…`), so the fix is to cut it in the card.
  The card can cover your message, so give this warning in the **guide
  turn**, before the user copies the token, not only in the card turn.
  See the Fly setup token steps in step 4. (Hopefully the card is fixed
  some day; if a pasted `FlyV1 …` value saves as is, that's fine too.)
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
| `NEON_CLI` | `neon@<version>`: the version you pick and check in step 5 |
| `FLY_ORG` | the slug, as Fly's GraphQL API lists it, of the org the user chose in step 4 (new, linked or reused; step 5) |
| `FLY_BACKEND_APP` | `<github-user>-<slug>-backend`, checked for availability |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare API |
| `CLOUDFLARE_PAGES_PROJECT` | `<slug>-frontend` |
| `PROD_FRONTEND_ORIGIN` | `https://<pages subdomain>`, returned when the Pages project is created |
| `WORKOS_CLIENT_ID` | pasted by the user in chat |

Also record the **custom domain** from step 1, if any. It isn't in
`deploy.env` until step 11, when it replaces `PROD_FRONTEND_ORIGIN`.

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
4. **Do you want a custom domain, and if so, which one?** For example
   `chore-chart.example.com`. Ask now, not later: the answer decides which
   permissions the Cloudflare setup token needs in step 4, and creating it
   with the right ones the first time saves the user a second trip to
   Cloudflare. If they want one, also ask whether the domain's DNS is on
   Cloudflare, in the account they'll use for this app. Only then can
   Claude set it up; otherwise the user attaches it by hand in step 11.

   If they want one, tell them in a sentence or two how it goes, so they
   aren't left wondering when it'll come up: the app first goes live on
   its `pages.dev` address, and the domain is switched on **last** (step
   11), once production and previews are tested, so a domain problem
   can't be mistaken for anything else. At that point Claude attaches the
   domain and its DNS record in Cloudflare, points the app and the
   database's live-updates setting at it, and the user adds it to WorkOS
   (one more value, the same two lists as step 7).

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
them. Confirm the name, slug, region pair and custom domain (or "none")
with the user in one line, then continue.

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
| Fly | `api.fly.io` **and** `api.machines.dev` | the GraphQL `{ organizations { nodes { slug name type } } }` lists **the org the user chose for this app**. A saved Fly token from an earlier app reaches only that app's org, so on every new app it must be replaced with one for this app's org, unless the user is deliberately reusing that same org. |
| Cloudflare | `api.cloudflare.com` | `GET /client/v4/user/tokens/verify` is `active`, **and** `GET /client/v4/accounts` lists the account |

Tell the user which setup tokens are already in place, and walk them through
creating only the missing or unusable ones. The Fly one is always needed for a
new app, and its org has to exist first, so the Fly part starts by creating
the org. Each one goes **only** into a
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

**Fly: the app's own org, then its setup token**

Fly personal access tokens no longer work for this, so the setup token is an
**org deploy token**, and an org token can only be made for an org that
already exists. So the user creates this app's own Fly org first, then its
token. Give every app its own Fly org, so its CI token (also an org token,
which previews need in order to create apps) can't reach the user's other
apps. Creating an org needs billing, so the user does it in the dashboard,
at **https://fly.io/organizations/new** (Fly's new organization page).

First, offer the org options in this order and wait for the user's pick:

1. **Linked organization**, billed to an existing org. This is the best of
   both, but Fly reviews these requests manually, so it may be slow or
   refused for hobby projects.
2. **A new organization with its own billing.** The user adds a payment
   method for it. This is the usual choice.
3. **Reuse an existing org.** Zero setup, but this app's CI token can then
   create, deploy and destroy the user's other apps in that org. Say so
   plainly if they pick it, and skip to the token steps.

Steps for the user to create the org (nothing to copy):

1. Open **https://fly.io/organizations/new**.
2. Name: type the slug, e.g. `chore-chart`.
3. For a linked organization, choose the existing organization to bill
   it to. Otherwise add a payment method for the new org when asked.
4. Create it, then tell Claude it's done.

Then, as a separate guide turn, the token. Tell the user it must be an
**org** token for the new org: not a personal access token from the account
menu, and not an app's **Tokens** page, which makes app deploy tokens that
can't create apps.

1. Open **https://fly.io/dashboard**.
2. In the **organization dropdown**, choose the app's own org. Check it's
   the right one before going on.
3. Tap **Tokens** in that org's menu (not an app's **Tokens**, and not
   the account menu's **Access Tokens**).
4. Create a token of type **Org Deploy Token**. Name: type `able-setup`. Leave the expiry at
   the default, or pick an end date if they prefer.
5. The token is shown **only once**. Copy the **whole** value; it's long,
   so use the page's copy button if there is one rather than selecting it.
   It goes into **two** cards, so don't copy anything else until both
   are saved.
6. **Heads-up for the cards, before you copy.** The token starts with
   `FlyV1 `. The card currently mistakes that for a pasted header: it
   shows an error and the **Save** button stays greyed out. That's a known
   bug, not a bad token. If it happens, in **each** card:
   1. Tap just after the space that follows `FlyV1` (the token itself
      starts with `fm2_`).
   2. Delete back to the start: **6 characters**, `F`, `l`, `y`, `V`, `1`
      and the space. The value should now start with `fm2_`.
   3. **Save** turns on. Tap it.

   Don't edit the copied value anywhere else first: the second card needs
   it too, and GitHub (step 6) needs the full `FlyV1 …` form.
7. Tell Claude it's copied.

Always include that heads-up in this guide turn. It's the user's only
chance to read it, because the card can cover the next message.

**After the user confirms:** say in one line that there are two cards and
that each may need `FlyV1 ` (6 characters) cut from the start, as above.
Then call `request_credential` with host
`api.fly.io`, and after it's saved, with host `api.machines.dev`. If a Fly
token from an earlier app is already saved, these cards replace it; say
that Claude then reaches only the new app's Fly org.

**Cloudflare setup token**

This is a **user API token** made from a custom template. Warn about two
traps on that page: the **Global API Key** further down is all-powerful
and must not be used, and the ready-made templates (such as "Edit
Cloudflare Workers") grant the wrong permissions. Use the custom-domain
answer from step 1, and don't ask again: include the zone permissions
only if the user wants a custom domain whose DNS is on Cloudflare. Give
the user these steps, in your own words:

1. Open **https://dash.cloudflare.com/profile/api-tokens** and sign in.
   This is **My Profile → API Tokens** (user tokens). Don't use
   **Manage Account → API Tokens** (account tokens), and don't touch the
   **Global API Key** section.
2. Tap **Create Token**, then **Start from scratch** (older dashboards:
   scroll to the bottom, **Create Custom Token** → **Get started**).
3. **Token name:** type `able-setup`.
4. Cloudflare groups permissions into **policies**. Each policy has a
   scope (an account or a zone) and a list of permission groups with
   **Read** and **Edit** checkboxes. Search the list, or open the
   category, to find each one.
   1. **Add new Account policy.** Scope: `Include` · their account.
      Tick **Cloudflare Pages → Edit** and **Account Settings → Read**.
      Nothing else.
   2. Only if they chose a custom domain on Cloudflare DNS in step 1:
      **Add new Zone policy.** Scope: `Include` · `Specific zone` · the
      domain's zone (for `chore-chart.example.com`, that's
      `example.com`). Under **DNS & Zones**, tick **DNS → Edit** and
      **Zone → Read**. Nothing else. A specific zone is narrower than
      "All zones from an account", so prefer it.
   3. Close each policy editor so it shows as a summary card.
5. Leave **Client IP Address Filtering** empty. Leave **TTL** empty, or
   set an end date if they prefer.
6. Check the summary: one Account policy (Pages, Account Settings) and,
   if added, one Zone policy for that zone (DNS, Zone). The summary may
   say "Write" where the checkbox said "Edit". Then tap **Create
   Token**.
7. The token is shown **only once**. Tap **Copy**. Don't copy the
   example `curl` command on that page.
8. Tell Claude it's copied.

If the user already made the token without the zone policy, they don't
need a new one: **⋯ → Edit** on the token, add the Zone policy, and save.
The value doesn't change, but they need it on the clipboard for the
card; if they no longer have it, **Roll** gives a new value to copy.

Check the zone with `GET /client/v4/zones?name=<apex>`: it must list the
zone, in the same account.

**After the user confirms:** call `request_credential` with host
`api.cloudflare.com`. They paste the token into the card.

Re-run the checks in the table for each new token.

## Step 5: Provision (you)

You don't need flyctl for setup: everything below uses Fly's HTTP APIs.
(Piping Fly's install script into `sh` can be refused by the session's
safety checks anyway.) CI installs its own flyctl.

**Neon: pick the CLI version.** Realtime is in beta and the `neon` CLI's
surface still moves, so use one exact version for every command here and
in CI. Take the newer of the template's pin (`NEON_CLI` in
`.github/deploy.env`) and `npm view neon version`, as `V`. If it's newer
than the pin, the check in item 7 below is what proves CI can use it; if
that check fails, fall back to the pin.

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
   and `npx -y neon@$V databases list --project-id $P --branch <default>`,
   record the default branch, the database name and the owner role.
   **Never print** connection strings.
5. Enable Realtime on the default branch, even if it's already on. The
   command is idempotent, and the next steps need it on:
   `NEON_API_KEY=proxy-injected npx -y neon@$V realtime enable --project-id $P --branch <default>`.
6. Verify Realtime on a throwaway branch, never the default:
   - `neon branches create --name scratch/rt-test --parent <default>`.
   - Create a table with a primary key and insert a row.
   - Run `neon realtime subscribe --output json "SELECT * FROM items ORDER BY id"`
     in the background, insert another row, and check that a second
     snapshot arrives.
   - `neon branches delete scratch/rt-test`.
7. Check that `neon@$V env pull --service postgres --service realtime`
   still writes what `.github/actions/deploy-backend` reads, without
   printing values: pull the default branch into a file in your scratch
   directory, check `DATABASE_URL` has the `postgresql://*-pooler.*`
   shape and `NEON_REALTIME_URL` and `NEON_REALTIME_SECRET` are
   non-empty (strip surrounding quotes as the action does), list only the
   key names, then delete the file.

   Two catches. **Port 5432 is blocked** from cloud containers, so
   `neon psql` fails. Run SQL over HTTPS with `@neondatabase/serverless`:
   get a connection string with `neon connection-string` into a variable
   (never print it), then `neon(url).query(sql)`. And a live query must read
   a table: `SELECT 1` is rejected ("upstream rejected").

**Fly: the app's org.** In step 4 the user either created a new org,
created a linked org, or chose an existing org to reuse. Whichever it
was, find it yourself in the GraphQL org list below and record its
`slug`, exactly as GraphQL prints it, as `FLY_ORG`:

- An org deploy token normally sees only its own org, so expect one
  entry. If several are listed, match the org the user picked by its
  `name`, and confirm it with them in one line rather than guessing.
- Don't derive the slug from the name. Fly may add a suffix to a new
  org's slug, and some orgs answer to more than one slug: the Machines
  API's app record can show a different slug for the same org than
  GraphQL does. Record the GraphQL one; it's what `flyctl --org` in CI
  is known to accept.
- After reserving the app (below), check that the app's
  `organization.name` is the org the user picked. A different `slug`
  there for the same org name is fine.

**Fly: reserve the app name.**

```bash
curl -s https://api.fly.io/graphql -H "Authorization: Bearer x" -H "Content-Type: application/json" \
  -d '{"query":"{ organizations { nodes { slug name type } } }"}'     # find the app's org -> FLY_ORG
curl -s -X POST https://api.machines.dev/v1/apps -H "Authorization: Bearer x" \
  -H "Content-Type: application/json" \
  -d '{"app_name":"<github-user>-<slug>-backend","org_slug":"<FLY_ORG>"}'
curl -s https://api.machines.dev/v1/apps/<github-user>-<slug>-backend -H "Authorization: Bearer x" \
  | jq '{name, organization}'                                         # check it landed in the right org
```

Creating the app is how you check the name is free: a `201` reserves it,
and `422` with `"status":"name_taken"` means someone already has it, so
add a suffix and try again.

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
NEON_API_KEY=proxy-injected npx -y neon@$V realtime enable --project-id $P \
  --branch <default branch> --allowed-origin "$PROD_FRONTEND_ORIGIN"
```

`realtime enable` only answers "Realtime enable requested for branch
…", and neither the CLI nor the branch API reads the setting back, so
you can't confirm the allowed origin here. The scratch-branch test in
the Neon section proves Realtime itself works; the origin is proven only
by the browser two-tab test in step 9 (and step 11 for a custom domain).
If the server checks pass but the page signs in and then shows no
greetings or doesn't sync, suspect the allowed origin first: re-run this
command with the exact origin, no trailing slash, and retry.

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
2. **`FLY_API_TOKEN`**: a second **org deploy token** for **the app's own
   org**, made the same way as the setup token in step 4 but kept
   separate, so either can be revoked without breaking the other.
   1. Open **https://fly.io/dashboard**.
   2. In the **organization dropdown**, choose the app's own org (step 5).
      Check that it's the right one before going on: a token for the
      wrong org breaks previews or reaches other apps.
   3. Tap **Tokens** in that org's menu (not an app's **Tokens**, which
      makes deploy tokens that can't create preview apps).
   4. Create a token of type **Org Deploy Token**, the same type as the
      `able-setup` token in step 4. Name: type `<slug>-ci`. Choose a long
      expiry, or none if offered, since CI needs it long-term.
   5. Copy the **whole** value. In GitHub, paste it **as is**, including
      `FlyV1 ` at the start. Unlike the card, GitHub needs the prefix.
3. **`CLOUDFLARE_API_TOKEN`**: the same page as the setup token in step 4,
   with fewer permissions.
   1. Open **https://dash.cloudflare.com/profile/api-tokens** (My Profile
      → API Tokens, not the Global API Key).
   2. **Create Token** → **Start from scratch** (older dashboards:
      bottom of the page, **Create Custom Token** → **Get started**).
   3. **Token name:** type `<slug>-ci`.
   4. **Add new Account policy.** Scope: `Include` · their account. Tick
      **only Cloudflare Pages → Edit**. No Account Settings and no Zone
      policy.
   5. **Create Token** → **Copy**.

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

   Don't add the custom domain here yet, even if the user chose one. It's
   added in step 11, and only works once the app has moved to it.
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
   `NEON_CLI` to `neon@$V`, the version you checked in step 5.
3. **Docs:**
   - `README.md`: delete everything from `<!-- able:template-start` through
     `<!-- able:template-end -->`, and the blank line after it, so the
     file starts with `# <Name>`. Under the title, put the user's
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

If the user chose a custom domain, remind them in one line that it's not
forgotten: it's switched on in step 11, after previews.

## Step 10: Previews come up

Open a small real PR, such as a README tweak on a new branch, and subscribe
to its activity.

- `gh pr create` fails in Claude Code sessions, because it uses GitHub's
  GraphQL API, which they block. Use the REST API instead:
  `gh api repos/<owner>/<repo>/pulls -f title=… -f head=<branch> -f base=main -f body=…`.
  Close it later with `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f state=closed`.
- The clone from step 3 is shallow and tracks only `main`. Push the new
  branch with `git push -u origin <branch>`. If a hook still says the
  branch has no remote, add a fetch refspec for it
  (`git config --add remote.origin.fetch +refs/heads/<branch>:refs/remotes/origin/<branch>`)
  and fetch it.
- Keep the tweak clean: it's merged or closed at the end of this step,
  and the user may choose either. `preview.yml` creates Neon branch `preview/pr-<n>`, enables
Realtime on it with origin `*`, deploys `<FLY_BACKEND_APP>-pr-<n>`, and
comments the URLs. `frontend.yml` deploys a Pages preview at
`https://<branch-alias>.<pages subdomain>`.

Run the same server-side checks against the preview, then have the user do
the two-tab test on the preview URL from the PR comment. Then merge or
close the PR. Closing tears the preview down.

## Step 11: Custom domain (if chosen in step 1)

Use the domain from step 1. If the user didn't want one, skip to "Done".
Before starting, remind them in one line what changes: sign-in moves to
the domain, and the `pages.dev` address stops working for sign-in.

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
3. **User:** add `https://<domain>` to the WorkOS Redirects and CORS lists,
   the same way as step 7. Tell them to leave the `pages.dev` entries in
   place: the wildcard one still serves every PR preview. You verify it
   with the authorize probe, and wait for the redeploy from item 2 before
   checking CORS from the new origin.
4. Sign-in now works only at the custom domain. The `pages.dev` address
   still serves the page, but the backend rejects its API calls.

## Done

Tell the user, briefly:

- the prod URL, the repo, and how previews work
- that deploys use only the three `<slug>-ci` tokens in GitHub, and that
  `SECRETS.md` explains how to rotate them
- that the `able-setup` tokens stay on this cloud environment for
  debugging, and the Neon and Cloudflare ones for the next app too. The Fly
  one reaches only this app's org; the next app replaces it. They can revoke them at any time without
  affecting deploys, by removing them under the environment name in the
  session title bar → **Edit** → **Network secrets**, and revoking them in
  each service's dashboard.
