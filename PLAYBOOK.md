# Able playbook: set up a new app

**For Claude Code.** You are setting up a new app from the Able template
(https://github.com/lightbody/able) for the user, end to end: a private
GitHub repo, a Production environment, a Preview for every PR, and a
verified sign-in plus live-data round trip in both. Follow this file in
order. Do as much of the work as possible yourself. The user's part is
creating accounts and API tokens and a few dashboard settings that have no
API.

The user has already done a few things before this session, because a
Claude Code cloud session can't start without them: see "Before the
session" below. Step 0 checks they're done right.

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
7. **Use the terms below.** Write them as proper nouns, and use them the
   same way in everything you tell the user.

## Terms

| Term | Meaning | Where it's used |
|---|---|---|
| **App Name** | The app's human-readable name, chosen by the user before the session (it names the Agent Environment) and confirmed in step 0, e.g. "Todoable". Spaces and capitals are fine. | the Agent Environment's name; the Fly org (step 4); the Neon project (step 5); the WorkOS project (step 7); the README and `CLAUDE.md` titles and the page itself, in place of `My App` (step 8) |
| **App Handle** | The app's technical name: lowercase letters, digits and hyphens, derived from the App Name, e.g. `todoable`. Wherever a service wants a name without spaces, it's this. | token names (`<App Handle>-claude-code`, `<App Handle>-ci`); the GitHub repo (made before the session; step 3); the Fly backend app (`<github-user>-<App Handle>-backend`) and the Pages project (`<App Handle>-frontend`) (step 5); the npm scope and other code names, in place of `myapp` (step 8) |
| **App Environments** | The places the app itself runs: **Development**, **Preview** and **Production**, described below. | throughout |
| **Development** | A developer's own copy of the app: `npm run dev` against a personal Neon branch (`dev/<you>`), as the README's "Local development" describes. | after setup |
| **Preview** | The app deployed for one pull request: Neon branch `preview/pr-<n>`, Fly app `<FLY_BACKEND_APP>-pr-<n>`, and a Pages preview. Created when the PR opens, deleted when it closes. Previews take the place of a shared staging environment. | step 10 |
| **Production** | The app deployed from `main`: the default Neon branch, `FLY_BACKEND_APP`, and the Pages production deployment at the **Production Origin**. | step 9 |
| **Production Origin** | Production's frontend address, `PROD_FRONTEND_ORIGIN`: `https://<Pages Subdomain>` until step 11, then `https://<Custom Domain>`. | steps 5, 7, 9, 11 |
| **Pages Subdomain** | The `<name>.pages.dev` host Cloudflare gives the Pages project, usually `<App Handle>-frontend.pages.dev`. Each Preview's frontend is a subdomain of it. | steps 5, 7, 10 |
| **Custom Domain** | An optional domain of the user's for Production, e.g. `todoable.example.com`. Asked about in step 1, switched on in step 11. | steps 1, 4, 11 |
| **Region Trio** | The Neon region, the Fly region next to it, and the Grafana Cloud region next to those (used only if the user creates a new Grafana Stack), chosen in step 1. | steps 1, 2, 5, 8 |
| **Agent Environment** | The Claude Code cloud environment for this app, named with the App Name and used for nothing else. This setup session and every later Claude Code session on the app run on it, and it holds the Claude Code Tokens. | "Before the session", step 0, step 4, and "Limited network access" |
| **Claude Code Tokens** | Claude's own API tokens for Neon, Fly, Cloudflare and Grafana, each named `<App Handle>-claude-code` and saved on the Agent Environment. | steps 4, 5, 6, 12 |
| **CI Tokens** | GitHub Actions' API tokens for the same services, each named `<App Handle>-ci` and saved as GitHub secrets. | step 6 |
| **Observability** | The app's telemetry (traces, metrics and logs from the backend, real-user data from the frontend) in a **Grafana Stack**: a Grafana Cloud instance, `GRAFANA_STACK_URL`, usually shared by all of the user's apps. Each app's telemetry is labelled with its App Handle. | steps 2, 4, 5, 6, 9, 10 |
| **Baseline** | The permissions the Claude Code Tokens keep between tasks, listed in `SECRETS.md`. | step 12 |

Two words from the services mean something else, so always qualify them:

- **WorkOS environments** (WorkOS's own Production, Staging and
  Development) aren't App Environments. Production and every Preview
  sign in against the **WorkOS Production environment** (step 7). Write "WorkOS
  Production environment", never just "Production", when you mean it.
- **Fly's org slug** is the identifier Fly gives an org, recorded as
  `FLY_ORG`. It's derived by Fly, not by you, and isn't the App Handle.

## One Agent Environment, two kinds of tokens

Read `SECRETS.md` in the template. It is the user-facing version of this
section and stays in the new app.

**One Agent Environment per app, from the start.** This setup session, and
every later Claude Code session on the app, runs on the Agent Environment,
named with the App Name and used for nothing else. Step 0 makes sure of
that before anything else happens. Its tokens reach only this app, and
setup never changes Agent Environment partway through.

**Full network access is strongly recommended.** Setup and later debugging
reach many hosts, some of them new with every Preview, and with Full
nothing is ever blocked. The tokens stay safe either way: the proxy adds
each one only to requests to its own host, and you never see the values.
What Full gives up is a limit on where *data* can go: anything a session
reads (database rows, logs) could in principle be sent to any host, if
the session were misled by something it read. Users who want that limit
can use **Limited** network access instead; "Limited network access" at
the end of this file covers it, and the steps that need extra work for it
point there.

| | **Claude Code Tokens** (`<App Handle>-claude-code`) | **CI Tokens** (`<App Handle>-ci`) |
|---|---|---|
| For | you, Claude: setting the app up now, then building and debugging it (Production and Previews) in later sessions | GitHub Actions: every deploy |
| Saved via | `request_credential` cards, onto the Agent Environment | GitHub Actions secrets, pasted by the user (step 6) |
| Neon | an **organization** key while it creates the project (step 4), then a **project-scoped** key (step 6) | **project-scoped** key for this app's project |
| Fly | **org deploy token** for **this app's own org** (personal access tokens no longer work) | a second org deploy token for the same org (Previews create apps) |
| Cloudflare | Pages Edit + Account Settings Read (+ DNS Edit and Zone Read on the Custom Domain's zone) during setup; narrowed in step 12 to Pages Edit, Account Settings Read and Account Analytics Read (+ DNS Read and Zone Read) | Pages Edit only |
| Grafana | a service account `<App Handle>-claude-code` on the Grafana Stack: **Viewer** plus **Frontend Observability → Editor** while it creates the Faro app (step 4), narrowed to Viewer in step 5 | `GRAFANA_OTLP_TOKEN`, write-only telemetry ingest |

**Least privilege as you go.** Ask for each token with the permissions the
coming steps need, no more, and narrow it as soon as they're done: the
Neon key goes from organization to project-scoped in step 6, the Grafana
service account drops its Frontend Observability role in step 5, and the
Cloudflare token drops its setup-only permissions in step 12. Narrowing a
Cloudflare token or a Grafana service account edits it in place, so its
value doesn't change and no new card is needed. Replacing the Neon key means a new key, a new card, and
revoking the old one.

Setup ends with every Claude Code Token at the **Baseline** in
`SECRETS.md` ("The baseline"). That table, and the rule in the app's
`CLAUDE.md` to widen a token only for the task that needs it and then
return to the Baseline, are what carry this approach into every later
session, since this file is deleted from the app in step 8. If you change
a token's scope here, change that table to match.

Never put a CI Token into a card, or a Claude Code Token into GitHub. The
user can revoke either set without touching the other; revoking the
Claude Code Tokens never affects a deploy.

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
- The value is saved on the Agent Environment, and every session
  that uses it can use it. The network proxy injects it as
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
  See the Fly token steps in step 4. (Hopefully the card is fixed
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
| `FLY_ORG` | Fly's org slug, as its GraphQL API lists it, for the org the user chose in step 4 (new, linked or reused; step 5) |
| `FLY_BACKEND_APP` | `<github-user>-<App Handle>-backend`, checked for availability |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare API |
| `CLOUDFLARE_PAGES_PROJECT` | `<App Handle>-frontend` |
| `PROD_FRONTEND_ORIGIN` | the Production Origin: `https://<Pages Subdomain>`, returned when the Pages project is created |
| `WORKOS_CLIENT_ID` | pasted by the user in chat |
| `APP_HANDLE` | the App Handle (step 8's rename sets it) |
| `GRAFANA_STACK_URL` | `https://<stack slug>.grafana.net`, from the user in chat (step 2) |
| `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_OTLP_ENDPOINT` | derived from the Grafana Stack (step 5) |
| `GRAFANA_FARO_URL` | the Faro app you create in step 5 |

Also record the **Custom Domain** from step 1, if any. It isn't in
`deploy.env` until step 11, when it replaces `PROD_FRONTEND_ORIGIN`.

You also pick a **Region Trio** in step 1. The Neon region is the project's
`region_id`. The Fly region goes into `primary_region` in
`fly.backend.toml`, not `deploy.env`. The Grafana Cloud region matters only
if the user creates a new Grafana Stack in step 2; whichever stack the app
uses, its region shows up in `GRAFANA_OTLP_ENDPOINT`.

---

## Before the session: the user's part

A Claude Code cloud session starts from a repository and runs on an
environment, both chosen on the new-session screen. So the user does
these before pasting the prompt, as Able's landing page and README tell
them. You need them again only to explain a step that step 0 finds
missing, so reuse the wording:

1. **Name the app**, e.g. "Todoable". Able's landing page is a short
   wizard: it derives the App Handle from the name (`todoable`), uses
   both in the steps below, and puts them in the prompt.
2. **Make the app's repo from the template.** The landing page links to
   `https://github.com/new?template_owner=lightbody&template_name=able&owner=@me&visibility=private&name=<App Handle>`,
   which fills in the form: the user's own account, Private, and the App
   Handle as the repository name. They can change any of it; public or
   private is up to them, but the name must stay the App Handle. When you
   give this step, build the same link with their App Handle.
3. **Connect GitHub to Claude Code.** This comes after the repo exists,
   so the new repo is in the list Claude Code offers.
4. **Create the Agent Environment**: a cloud environment named with the
   App Name, with **Full** network access. (Users who want Limited can
   instead start on any environment and ask you for one: "Limited network
   access" at the end of this file.)
5. **Start the session** on the Agent Environment, with the app's new
   repo selected, and paste the prompt.

Where you give these steps yourself (step 0), add the detail: GitHub is
connected at https://claude.ai/connect-github, and if the Claude GitHub
App is installed on selected repos only, the new repo is added at
**https://github.com/apps/claude/installations/select_target**. A new
environment is made on the new-session screen: tap the environment
selector (the first control in the row under the message box), then
**New environment**, type the App Name, set **Network access** to
**Full**, and tap **Add environment**.

With another coding agent, the user makes the repo the same way and runs
the agent in a clone of it.

## Step 0: Check the repo and the Agent Environment

Do this first, before anything else. Check both, then tell the user what
you found in one message. Fix what you can here; the Agent Environment
can only be fixed with a new session.

**The repo.** Look at the working directory's git repo:
`git remote get-url origin` ends in `<owner>/<repo>` (in a cloud session
the URL may point at a local proxy, but the path still ends that way). It's
the app's repo when it has `PLAYBOOK.md` and `.github/deploy.env` still has `APP_HANDLE=myapp` and empty Neon,
Fly and Cloudflare values (a fresh copy of the template). Then the repo
name is the App Handle. Work in this clone from here on.

If there's no repo, or it's some other repo, don't set up there. If its `deploy.env` is already filled in, it's an app that's
already set up: ask what they want. Otherwise give the user "Before the
session" step 2 (and step 3 if GitHub isn't connected), wait until
they've made the repo, then call `add_repo` for it with
`access: "push"`. If that's refused because the Claude GitHub App can't
see the new repo, have them add it at
**https://github.com/apps/claude/installations/select_target**, then
retry. Clone it to the path the result gives you, and work in that clone
from here on. Tell them that later sessions on the app should start with
this repo selected.

**The App Name and App Handle.** The prompt from Able's landing page
states both ("App Name: …. App Handle: …."); the page derives the handle
from the name as step 1 describes. If the prompt has neither, take the
App Name from the Agent Environment's name, or ask, and derive the App
Handle. If the repo's name differs from the App Handle but is a valid
handle, the repo name wins. Confirm both in one line.

**The Agent Environment.** (If you have no `get_environment` tool, you
aren't in a Claude Code cloud session: skip this part.) Call
`get_environment`. It describes the environment this session runs in.

**This session's environment is named with the App Name** (ignore case;
an environment named with the App Handle, as older versions of this
playbook said, counts too), or the user confirms it's a new environment
made just for this app under another name (offer to rename it to the App
Name with `update_environment` `new_name`): this is the Agent
Environment. Look at its
`network_secrets`. A new environment has none. If it has some for
`console.neon.tech`, `api.fly.io`, `api.machines.dev` or
`api.cloudflare.com`, ask whether they're this app's; if not, say step 4's
cards will replace them. Then check its network:

- **`unrestricted` (Full):** go to step 1.
- **Limited:** say in one line that Full is recommended and why (nothing
  gets blocked, during setup or later), and that Limited works too with a
  little more setup. If they'd rather switch, they change **Network
  access** to **Full** in the environment's settings (the environment
  name in the title bar → **Edit**); a new session isn't needed. If they
  keep Limited, do "Setting up the allowlist" under "Limited network
  access" at the end of this file now, then go to step 1.

**Anything else** (`Default`, another app's Agent Environment, or one
shared by several projects): don't set up here. Explain briefly why the
app gets an Agent Environment of its own: its tokens reach only this app; this session and
every later session on the app use it, so setup and later debugging see
the same access; and nothing changes Agent Environment partway through.
The user creates it, because a session can't create an environment with
Full network access or move onto one. Give them "Before the session"
steps 4 and 5: create the Agent Environment, then start a new session on
it with the app's repo selected (if the repo was missing too, sort that
out first, as above, so the new session can select it), and paste the
same prompt they used here.

Add one line: if they'd rather limit where the app's sessions can connect,
you can create a Limited Agent Environment for them instead, and move this
session onto it ("Limited network access" at the end of this file). If
they ask for that, do it; otherwise stop here.

## Step 1: About the app

Step 0 settled the App Name and App Handle. Ask the user:

1. **One sentence on what it's for.** This goes into the README and
   `CLAUDE.md`.
2. **Roughly where are you and your users?** A continent or country is
   enough. This picks where the database and backend run.
3. **Do you want a Custom Domain, and if so, which one?** For example
   `todoable.example.com`. Ask now, not later: the answer decides which
   permissions the Cloudflare token needs in step 4, and creating it
   with the right ones the first time saves the user a second trip to
   Cloudflare. If they want one, also ask whether the domain's DNS is on
   Cloudflare, in the account they'll use for this app. Only then can
   Claude set it up; otherwise the user attaches it by hand in step 11.

   If they want one, tell them in a sentence or two how it goes, so they
   aren't left wondering when it'll come up: the app first goes live on
   its `pages.dev` address, and the domain is switched on **last** (step
   11), once Production and Previews are tested, so a domain problem
   can't be mistaken for anything else. At that point Claude attaches the
   domain and its DNS record in Cloudflare, points the app and the
   database's live-updates setting at it, and the user adds it to WorkOS
   (one more value, the same two lists as step 7).

The **App Handle** is derived from the App Name: lowercase letters,
digits and hyphens only, e.g. `todoable`. It should be short, since
longer names are built from it (`<github-user>-<App Handle>-backend`).
Normally it's the repo's name.

Suggest a **Region Trio** from the table below. The backend talks to the
database on every request, so the Fly region must sit next to the Neon
region. If the user will create a new Grafana Stack, suggest the Grafana
Cloud region next to them; an existing stack is fine wherever it is,
since telemetry is sent in the background and distance doesn't slow the
app. Neon Realtime is in beta and available only in the four Neon
regions below, so the Neon region comes first and the Fly region follows
it. Before you suggest one, check the current list at
https://neon.com/docs/realtime/overview#which-regions-is-it-enabled-in. If
it has changed, pair any new region with the nearest Fly region.

| Users mostly in | Neon region | Fly region | Grafana Cloud region |
|---|---|---|---|
| North or South America (default) | `aws-us-east-1` (N. Virginia) | `iad` (Ashburn, Virginia) | a US **East** region |
| US Midwest, if they prefer it | `aws-us-east-2` (Ohio) | `ord` (Chicago) | a US **East** region |
| Europe, the Middle East or Africa | `aws-eu-central-1` (Frankfurt) | `fra` (Frankfurt) | an EU region |
| Asia or Oceania | `aws-ap-southeast-1` (Singapore) | `sin` (Singapore) | an Asia-Pacific region, Singapore if offered |

For a new stack, Grafana's region picker lists its regions by name: pick
the one in that area rather than leaving the default.

No Realtime region is in the western Americas yet. Users there still get
`aws-us-east-1` + `iad`, so say that pages will be a little slower for
them. Confirm the App Name, App Handle, Region Trio and Custom Domain (or
"none") with the user in one line, then continue.

**Limited network only:** now that the App Handle and region are known, do
"Wildcard hosts" under "Limited network access" at the end of this file.

## Step 2: Accounts

GitHub is done already ("Before the session"). Ask which of these the
user already has. For the rest, give the sign-up links and wait. Signing
in with GitHub is fine wherever it's offered.

| Service | What it's for | Sign up |
|---|---|---|
| Neon | Postgres + Realtime | https://console.neon.tech/signup |
| Fly.io | backend hosting (asks for a payment method) | https://fly.io/app/sign-up |
| Cloudflare | frontend hosting (Pages) | https://dash.cloudflare.com/sign-up |
| WorkOS | sign-in (AuthKit) | https://dashboard.workos.com |
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

**New Neon accounts: don't create a project.** Neon's sign-up usually goes
on to a create-project form. Tell the user, before they sign up, to skip
that form or close it: you create the project yourself in step 5, in the
region from step 1, with Postgres and Realtime set up. If the form can't be
skipped, have them create it with the App Name as the project name and
the Neon region from step 1, and close any connection string without
copying it. You adopt that project in step 5 instead of creating one.

## Step 3: The app's repo

The repo already exists: the user made it before the session, or step 0
did. Work in its clone, on `main`: if the session checked out another
branch, `git fetch origin main && git checkout main`. The user's request
to set up this app authorizes pushing the setup commit to `main` of this
new repo. If the session refuses, push a branch and open a PR instead.

Creating the repo triggered CI on its first commit. The deploy jobs skip
themselves while `.github/deploy.env` is empty, so the run was harmless.

## Step 4: Claude Code Tokens

First call `get_environment`. Its `network_secrets` lists the hosts that
already have a saved credential (never the values). On a new Agent
Environment there are none. If some are saved, check each:

| Service | Saved if these hosts are listed | Check it's usable for setup |
|---|---|---|
| Neon | `console.neon.tech` | `GET https://console.neon.tech/api/v2/projects` succeeds. A project-scoped key fails with "not allowed outside the project". It can't create the new project, so it must be replaced with an organization key. |
| Fly | `api.fly.io` **and** `api.machines.dev` | the GraphQL `{ organizations { nodes { slug name type } } }` lists **the org the user chose for this app**. A token for any other org must be replaced. |
| Cloudflare | `api.cloudflare.com` | `GET /client/v4/user/tokens/verify` is `active`, **and** `GET /client/v4/accounts` lists the account |
| Grafana | the Grafana Stack's host from step 2 | `GET <stack>/api/user` shows a service-account login (`sa-…`), `GET <stack>/api/datasources` lists `grafanacloud-logs`, `grafanacloud-traces` and `grafanacloud-prom`, **and** `GET <stack>/api/access-control/user/permissions` includes `grafana-kowalski-app.apps:write` (the Frontend Observability role step 5 needs). A 403 on `/api/datasources`, with `folders:read` as the only permission, means the role is still **None**: the role change wasn't saved with **Update**. Either way the token is fine: have the user fix the roles (step 3 of the Grafana steps below) and tap **Update**, no new card. |

Walk the user through creating the missing or unusable ones, each named
`<App Handle>-claude-code`. Say once that they're for Claude on this app only:
for setting it up now and for building and debugging it later, saved on
the Agent Environment, and that some get narrowed once setup no longer
needs their extra permissions. The Fly org has to exist before its token,
so the Fly part starts by creating the org. Each token goes **only** into
a card, never into GitHub.

Do one token at a time, in the two turns described in "How
`request_credential` works". First send the creation steps below and end
your turn with "copy it, then tell me when you have it copied". Only after
the user confirms, call `request_credential`. Never show a card in the same
turn as the creation steps.

**Neon token (organization, for now)**

This key creates the app's project in step 5, so it has to be an
**organization** key. A project-scoped key can't create projects. Tell the
user that, because the key-type choice is easy to miss, and that in step 6,
once the project exists, it's replaced by a project-scoped key and
revoked.

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
6. Name: type `<App Handle>-claude-code`. Create the key.
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

**Fly: the app's own org, then its token**

Fly personal access tokens no longer work for this, so Claude's token is an
**org deploy token**, and an org token can only be made for an org that
already exists. So the user creates this app's own Fly org first, then its
token. Give every app its own Fly org, so its CI Token (also an org token,
which Previews need in order to create apps) can't reach the user's other
apps. Creating an org needs billing, so the user does it in the dashboard,
at **https://fly.io/organizations/new** (Fly's new organization page).

First, offer the org options in this order and wait for the user's pick:

1. **Linked organization**, billed to an existing org. This is the best of
   both, but Fly reviews these requests manually, so it may be slow or
   refused for hobby projects.
2. **A new organization with its own billing.** The user adds a payment
   method for it. This is the usual choice.
3. **Reuse an existing org.** Zero setup, but this app's CI Token can then
   create, deploy and destroy the user's other apps in that org. Say so
   plainly if they pick it, and skip to the token steps.

Steps for the user to create the org (nothing to copy):

1. Open **https://fly.io/organizations/new**.
2. Name: type the App Name, e.g. `Todoable`.
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
4. Create a token of type **Org Deploy Token**. Name: type `<App Handle>-claude-code`. Leave the expiry at
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
`api.fly.io`, and after it's saved, with host `api.machines.dev`.

**Cloudflare token**

This is a **user API token** made from a custom template. Warn about two
traps on that page: the **Global API Key** further down is all-powerful
and must not be used, and the ready-made templates (such as "Edit
Cloudflare Workers") grant the wrong permissions. Use the custom-domain
answer from step 1, and don't ask again: include the zone permissions
only if the user wants a Custom Domain whose DNS is on Cloudflare. Give
the user these steps, in your own words:

1. Open **https://dash.cloudflare.com/profile/api-tokens** and sign in.
   This is **My Profile → API Tokens** (user tokens): Claude's token acts
   for you, one person. Don't use **Manage account → Account API tokens**
   (that's for the CI Token in step 6, which acts for the account), and
   don't touch the **Global API Key** section.
2. Tap **Create Token**, then **Start from scratch** (older dashboards:
   scroll to the bottom, **Create Custom Token** → **Get started**).
3. **Token name:** type `<App Handle>-claude-code`.
4. Cloudflare groups permissions into **policies**. Each policy has a
   scope (an account or a zone) and a list of permission groups with
   **Read** and **Edit** checkboxes. Search the list, or open the
   category, to find each one.
   1. **Add new Account policy.** Scope: `Include` · their account.
      Tick **Cloudflare Pages → Edit** and **Account Settings → Read**.
      Nothing else.
   2. Only if they chose a Custom Domain on Cloudflare DNS in step 1:
      **Add new Zone policy.** Scope: `Include` · `Specific zone` · the
      domain's zone (for `todoable.example.com`, that's
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

**After the user confirms:** call `request_credential` with host
`api.cloudflare.com`. They paste the token into the card.
If the token has a Zone policy, also check
`GET /client/v4/zones?name=<apex>` lists the zone, in the same account.

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

1. Check whether a project with the App Name already exists, for
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
     -d '{"project":{"name":"<App Name>","region_id":"<neon region>"}}' \
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
`slug` (Fly's org slug), exactly as GraphQL prints it, as `FLY_ORG`:

- An org deploy token normally sees only its own org, so expect one
  entry. If several are listed, match the org the user picked by its
  `name` (the App Name, unless they reused an org), and confirm it with
  them in one line rather than guessing.
- Don't derive the org slug from the name, and don't assume it's the App
  Handle. Fly may add a suffix to a new
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
  -d '{"app_name":"<github-user>-<App Handle>-backend","org_slug":"<FLY_ORG>"}'
curl -s https://api.machines.dev/v1/apps/<github-user>-<App Handle>-backend -H "Authorization: Bearer x" \
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
  -H "Content-Type: application/json" -d '{"name":"<App Handle>-frontend","production_branch":"main"}'
```

Use the returned `result.subdomain`. If the name was taken, Cloudflare adds
a suffix. `PROD_FRONTEND_ORIGIN` is `https://<subdomain>`.

**Limited network only:** add `<subdomain>` to the allowlist now, as
"Limited network access" at the end of this file describes. Then restrict
Realtime on the default branch:

```bash
NEON_API_KEY=proxy-injected npx -y neon@$V realtime enable --project-id $P \
  --branch <default branch> --allowed-origin "$PROD_FRONTEND_ORIGIN"
```

`realtime enable` only answers "Realtime enable requested for branch
…", and neither the CLI nor the branch API reads the setting back, so
you can't confirm the allowed origin here. The scratch-branch test in
the Neon section proves Realtime itself works; the origin is proven only
by the browser two-tab test in step 9 (and step 11 for a Custom Domain).
If the server checks pass but the page signs in and then shows no
greetings or doesn't sync, suspect the allowed origin first: re-run this
command with the exact origin, no trailing slash, and retry.

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

## Step 6: CI Tokens (GitHub secrets only)

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

1. **`NEON_API_KEY`**: the same place as Claude's Neon key in step 4.
   That's the **organization's** Settings with the project's organization
   active, **not** the profile menu's Settings. Then **API keys → Create
   new**, choose **Project-scoped**, and select the new project. Name: type
   `<App Handle>-ci`. It's shown only once, so copy it straight away. Repeat
   the navigation steps from step 4; don't assume the user remembers them.
2. **`FLY_API_TOKEN`**: a second **org deploy token** for **the app's own
   org**, made the same way as Claude's token in step 4 but kept
   separate, so either can be revoked without breaking the other.
   1. Open **https://fly.io/dashboard**.
   2. In the **organization dropdown**, choose the app's own org (step 5).
      Check that it's the right one before going on: a token for the
      wrong org breaks Previews or reaches other apps.
   3. Tap **Tokens** in that org's menu (not an app's **Tokens**, which
      makes deploy tokens that can't create Preview apps).
   4. Create a token of type **Org Deploy Token**, the same type as the
      `<App Handle>-claude-code` token in step 4. Name: type `<App Handle>-ci`. Choose a long
      expiry, or none if offered, since CI needs it long-term.
   5. Copy the **whole** value. In GitHub, paste it **as is**, including
      `FlyV1 ` at the start. Unlike the card, GitHub needs the prefix.
3. **`CLOUDFLARE_API_TOKEN`**: an **account API token**, not a user token
   like Claude's in step 4. CI acts for the account rather than for one
   person, and Cloudflare recommends account tokens for CI/CD.
   1. Open **https://dash.cloudflare.com**, choose the account, then
      **Manage account → Account API tokens** (not **My Profile → API
      Tokens**, and not the Global API Key).
   2. Tap **Create Token**, and start from a custom token (no template).
   3. **Token name:** type `<App Handle>-ci`.
   4. Permissions: **Account → Cloudflare Pages → Edit**, and nothing
      else. No Zone permissions.
   5. **Create Token** → **Copy**. The token starts with `cfat_`; if it
      doesn't, it was made on the user-token page, so make it again here.
4. **`GRAFANA_OTLP_TOKEN`**: write-only, so the backend can send telemetry
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

You can't read GitHub secrets. The first deploy in step 9 verifies them.

**Then narrow Claude's Neon key.** The project exists, so Claude no longer
needs an organization key. Replace it with a project-scoped one, the same
kind as `NEON_API_KEY` but a separate key, in two turns as in step 4:

1. Same place as the CI key: **https://console.neon.tech** → the
   organization's **Settings** (with the project's organization active in
   the profile menu's switcher; not the profile menu's own Settings) →
   **API keys** → **Create new** → **Project-scoped** → the app's project.
2. Name: type `<App Handle>-claude-code`. Create it, copy it (it's shown only
   once), and tell Claude it's copied.

**After the user confirms:** call `request_credential` with host
`console.neon.tech`; the new key replaces the organization key in the
card. Check `GET /api/v2/projects/<NEON_PROJECT_ID>` succeeds. Then have
the user revoke the old key: on the same **API keys** page, the
`<App Handle>-claude-code` key whose type is **Organization** (not the new
project-scoped one), and revoke it. Everything after this step works with
the project-scoped key.

## Step 7: WorkOS (sign-in)

WorkOS has no step you can automate here. The user does it in
**https://dashboard.workos.com**. Give them these steps, in your own
words, in three short parts: find the application, add the addresses,
send the Client ID.

**Only the WorkOS Production environment.** Tell the user that the app
uses WorkOS's **Production** environment for everything: Production and
every Preview sign in against it, sharing one user pool (`WORKOS_CLIENT_ID`
is the Production client ID). WorkOS's Staging and Development
environments aren't used, so nothing needs setting up there, and a Client ID from
them won't work.

**Part 1: find the application.**

1. Open **https://dashboard.workos.com** and sign in.
2. Make sure there's a **Project** for this app. If the dashboard asks
   to create one, name it with the App Name. The
   application lives inside the project.
3. Switch to the **Production** environment with the environment
   switcher at the top left.
4. Open **Applications**, then the app's application, to reach its
   **Application details** page. If there's no application yet, create
   one first. The page has tabs, including **Redirects** and, just to
   its right, **Session**.

**Part 2: add the addresses.** They go into these places on that same
page:

- **Redirects** tab → **Redirect URIs**: both addresses below.
- **Redirects** tab → **Sign-out URIs**: the Production Origin only.
  The app's **Sign out** button doesn't name a return address, so WorkOS
  sends the user to the default sign-out URI. With none set, signing out
  ends on WorkOS's `app-homepage-url-not-found` error page.
- **Session** tab → **Manage** (the CORS allowed origins): both
  addresses below.

The Redirects tab has six address settings: Redirect URIs, Initiate
login URI, Sign-out URIs, Sign-up URL, User invitation URL and Password
reset URL. Tell the user only the first and third are needed, and to
leave the other four empty, so they aren't left wondering.

Then, one address at a time, copied from your message, with **no
trailing slash**: copy it, add it everywhere it goes and save each, and
only then copy the next one. After saving, have the user look at each
saved entry: if it ends in `/`, edit it and delete the slash. This
applies to **every** entry, the Production Origin as much as the
wildcard: WorkOS compares the redirect URI as an exact string, the app
sends the bare origin (`window.location.origin`, which has no trailing
slash), and an entry ending in `/` fails sign-in with
`redirect-uri-invalid`. A slash can creep in from the paste or the form,
so check rather than assume.

1. `<PROD_FRONTEND_ORIGIN>`: into **Redirect URIs**, **Sign-out URIs**
   and **Session → Manage**. Add it to Redirect URIs **first**: WorkOS
   makes the first one the **default**, and the default must be the
   Production Origin, never the Preview wildcard. If another entry is
   marked default, in either list, tell the user to make this one the
   default.
2. Into **Redirect URIs** and **Session → Manage** only:
   `https://*.<Pages Subdomain>`, for example
   `https://*.todoable-frontend.pages.dev`, which covers every PR
   Preview. Signing out of a Preview lands on Production,
   because the default sign-out URI is Production's. That's expected.

   Don't add the Custom Domain here yet, even if the user chose one. It's
   added in step 11, and only works once the app has moved to it.

**Part 3: the Client ID.** Last, because it's another copy: on the same
Application details page, near the top, the Client ID (`client_…`) is
shown in grey text. Tapping it copies it. Have the user paste it in
chat. It isn't a secret.

**Verify** each redirect without signing in. Probe both the Production Origin
and an invented Preview origin such as `https://pr-test.<Pages Subdomain>`:

```bash
curl -s -o /dev/null -w "%{redirect_url}\n" "https://api.workos.com/user_management/authorize?client_id=$CID&redirect_uri=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=""))' "$ORIGIN")&response_type=code&provider=authkit"
```

A redirect to `error.workos.com/redirect-uri-invalid` means the origin isn't
registered. The usual culprit is a trailing `/` on that entry, Production or
wildcard alike: WorkOS matches exactly, and the app sends the bare
origin. If the origin with a trailing `/` (`$ORIGIN/`) passes but the
version without it fails, that's the cause: have the user edit that
Redirect URI and delete the slash (and check the Sign-out URI and
Session entries for the same address while they're there), then probe
again. Also check the client is real:
`curl -s https://api.workos.com/sso/jwks/$CID` should list at least one
key.

## Step 8: Make the code the user's app

In the cloned repo:

1. **Rename the placeholders** in every tracked file, including
   `package-lock.json`:
   - `My App` → App Name
   - `myapp` → App Handle. This covers the package names, `@myapp/shared` → `@<App Handle>/shared`,
     the token names in `SECRETS.md` and `CLAUDE.md` (`myapp-ci`, `myapp-claude-code`),
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
     file starts with `# <App Name>`. Under the title, put the user's
     one-sentence description in place of the template text.
   - `CLAUDE.md`: delete everything from `<!-- able:template-start` through
     `<!-- able:template-end -->`, and the blank line after it, the same as
     in `README.md`. Then replace "My App is a new web app." with the
     description.
   - **Keep `SECRETS.md`.** It's the app's guide to its tokens and to
     rotating them.
4. **Delete `PLAYBOOK.md`, and Able's own landing page:** `site/`,
   `.github/workflows/site.yml` and `.github/scripts/site-comment.js`. The
   new app needs none of them. (The workflow checks the repo name and never
   deploys outside `lightbody/able`, but the files are clutter.)
5. Run `npm install`, which regenerates the lockfile for the new names.
   Then run the same checks CI runs:
   - `npm run build --workspace=shared && npm test --workspace=shared`
   - `npm run build --workspace=backend && npm test --workspace=backend`.
     This needs Postgres on 127.0.0.1:5432 with database `app_test`.
     `.claude/hooks/session-start.sh` starts one, so run it with
     `CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD` if it hasn't run.
   - `npm run build --workspace=frontend`
6. `git grep -n -i -E "myapp|my app"` must find nothing except `@<App Handle>/`
   lookalikes you've checked. Then commit everything as one commit,
   "Set up <App Name>", and push to `main`.

## Step 9: Production comes up

The push to `main` runs `backend.yml`, which tests and then deploys to Fly
against the default Neon branch, running migrations on boot. It also runs
`frontend.yml`, which deploys Pages production. **This is the first use of
the CI Tokens.** A failure at a Neon, Fly or Cloudflare step usually means
a CI Token was pasted into the wrong secret or has the wrong scope, so
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
see "Hello, <App Name>!", add a greeting in one tab, and watch it appear in the
other.

Then check Observability, with the `observability` skill:

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

If the user chose a Custom Domain, remind them in one line that it's not
forgotten: it's switched on in step 11, after Previews.

## Step 10: Previews come up

Open a small real PR, such as a README tweak on a new branch, and subscribe
to its activity.

- `gh pr create` fails in Claude Code sessions, because it uses GitHub's
  GraphQL API, which they block. Use the REST API instead:
  `gh api repos/<owner>/<repo>/pulls -f title=… -f head=<branch> -f base=main -f body=…`.
  Close it later with `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f state=closed`.
- The session's clone may be shallow and track only `main`. Push the new
  branch with `git push -u origin <branch>`. If a hook still says the
  branch has no remote, add a fetch refspec for it
  (`git config --add remote.origin.fetch +refs/heads/<branch>:refs/remotes/origin/<branch>`)
  and fetch it.
- Keep the tweak clean: it's merged or closed at the end of this step,
  and the user may choose either. `preview.yml` creates Neon branch `preview/pr-<n>`, enables
Realtime on it with origin `*`, deploys `<FLY_BACKEND_APP>-pr-<n>`, and
comments the URLs. `frontend.yml` deploys a Pages preview at
`https://<branch-alias>.<Pages Subdomain>`.

Run the same server-side checks against the Preview, then have the user do
the two-tab test on the Preview URL from the PR comment. Check that its
telemetry arrives too, labelled `deployment_environment_name="<App Handle>-pr<n>"`
(the PR comment's Telemetry row links to the Grafana Stack). Then merge or
close the PR. Closing tears the Preview down.

## Step 11: Custom Domain (if chosen in step 1)

Use the domain from step 1. If the user didn't want one, skip to step 12.
Before starting, remind them in one line what changes: sign-in moves to
the domain, and the `pages.dev` address stops working for sign-in.

1. **Attach the domain.**
   - **Limited network only:** first add `<domain>` to the allowlist
     ("Limited network access", at the end of this file).
   - If Claude's Cloudflare token has the zone permissions and the
     domain's DNS is on Cloudflare in the same account, do it yourself:
     - `POST /accounts/$A/pages/projects/<project>/domains` with
       `{"name":"<domain>"}`
     - find the zone with `GET /zones?name=<apex>`
     - create a proxied CNAME, `<domain>` → `<Pages Subdomain>`, with
       `POST /zones/<zone id>/dns_records`
   - Otherwise the user does it: **Workers & Pages → `<App Handle>-frontend` →
     Custom domains → Set up a custom domain**, types the domain, and taps
     **Activate**. If the DNS isn't on Cloudflare, they add the CNAME it
     shows at their DNS host.
   - Either way, check status with
     `GET /accounts/$A/pages/projects/<project>/domains`.
2. **You:** set `PROD_FRONTEND_ORIGIN=https://<domain>` in
   `.github/deploy.env` and push, which redeploys with the new CORS origin.
   Then re-run `neon realtime enable --branch <default> --allowed-origin https://<domain>`.
3. **User:** in WorkOS (**Production** environment → **Applications** →
   the app's **Application details**), add `https://<domain>`, as in step
   7: under **Redirects → Redirect URIs**, **Redirects → Sign-out URIs**
   and **Session → Manage**. Have them make it the **default** in both
   Redirect URIs and Sign-out URIs, since it's now the Production
   Origin. As in step 7, it goes in with no trailing slash, and they
   check each saved entry for one. Then have them sign in at the domain and tap **Sign out**:
   it should land back on the app. Tell them to leave the `pages.dev` entries in
   place: the wildcard one still serves every Preview. You verify it
   with the authorize probe, and wait for the redeploy from item 2 before
   checking CORS from the new origin.
4. Sign-in now works only at the Custom Domain. The `pages.dev` address
   still serves the page, but the backend rejects its API calls.

The Custom Domain should already be in
`observability/faro-app.yaml`'s `corsOrigins` (step 5). If it isn't, add it
and update the Faro app, widening for that task as step 5 did (Frontend
Observability → Editor, then back to the Baseline and check). Until then,
the browser's telemetry from the Custom Domain is refused; the app itself
is unaffected.

## Step 12: Narrow the Cloudflare token, and wrap up

Setup no longer needs the Cloudflare token's write access to DNS, and
later debugging wants read access to analytics. Cloudflare edits a token
in place, so its value doesn't change and there's no card. Give the user
these steps:

1. Open **https://dash.cloudflare.com/profile/api-tokens**.
2. On the `<App Handle>-claude-code` token, tap **⋯ → Edit**.
3. In the **Account** policy, keep **Cloudflare Pages → Edit** and
   **Account Settings → Read**, and add **Account Analytics → Read**.
4. If there's a **Zone** policy (Custom Domain): change **DNS** from
   **Edit** to **Read**, and keep **Zone → Read**.
5. Go on to the summary and save the change. Don't **Roll** the token:
   that would change its value and need a new card.

Check: `GET /client/v4/user/tokens/verify` is still `active`, and
`GET /client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/pages/projects/<CLOUDFLARE_PAGES_PROJECT>`
still succeeds.

These are the dashboard names from Cloudflare's list at
https://developers.cloudflare.com/fundamentals/api/reference/permissions/
(the API calls the Edit ones "Write"). If the dashboard shows a name
differently, check that page rather than guessing.

## Done

Tell the user, briefly:

- the Production Origin, the repo, and how Previews work
- that this Agent Environment, named with the App Name, is where to start
  every future session on it. Its `<App Handle>-claude-code` tokens let Claude build
  and debug the app, including looking into Production and Previews
  in Neon, Fly, Cloudflare and Grafana. They can add the app's repo to the
  Agent Environment's **Repositories** in its settings, so it's selected by
  default.
- where to see the app's telemetry (the Grafana Stack's URL), and that
  later sessions read it through the `observability` skill to build
  features and fix bugs. Offer, in one line, Fly's own metrics (machine
  CPU, memory and restarts, and Fly's edge view of requests) in Grafana as
  well. If the user wants them, follow README "Observability" ("Fly's
  metrics"): it needs the **Data sources → Writer** role for the task, and
  a Fly org token that the user pastes into Grafana, never into a card.
- that Claude's tokens are now at their Baseline (the table in
  `SECRETS.md`). When a later task needs more, such as working with
  Cloudflare Workers, Claude will say so, guide them through widening only
  what that task needs, and then back to the Baseline when it's done.
- that deploys use only the `<App Handle>-ci` tokens in GitHub, and that
  `SECRETS.md` lists both kinds of token and how to rotate or revoke each.
  Revoking the Claude Code Tokens never affects deploys.
- **Limited network only:** if any of the three wildcard hosts are still
  missing (check with `get_environment`), strongly recommend adding them
  now, with the steps under "Limited network access", so Claude can reach
  Previews. Setting **Network access** to **Full** is the simpler
  alternative.

## An existing app without its own Agent Environment

If the user asks to move an app set up by an older version of this
playbook onto an Agent Environment of its own, attach its repo, read
`.github/deploy.env`, `CLAUDE.md` and `SECRETS.md`, then:

1. Do step 0's Agent Environment check with the app's App Name. Its App Handle is the repo name. If the user keeps Limited network
   access, also do everything under "Limited network access" now: the
   app's hosts all exist already. The Pages subdomain comes from
   `GET /accounts/<CLOUDFLARE_ACCOUNT_ID>/pages/projects/<CLOUDFLARE_PAGES_PROJECT>`.
2. Collect the `<App Handle>-claude-code` tokens (Neon, Fly, Cloudflare,
   and Grafana if the app has Observability) at the Baseline in the
   template's `SECRETS.md`, so nothing needs narrowing later: Neon
   **project-scoped** (as in step 6's "narrow Claude's Neon key"), Fly
   **org deploy token** for `FLY_ORG` (as in step 4), and Cloudflare with
   the permissions step 12 ends with (as in step 4, but ticking those
   instead). Check each as those steps do.
3. Bring the app's docs up to date, since an older app won't have the
   Baseline or the rule for widening a token: from the template's
   versions, update `SECRETS.md`'s Claude Code Token sections, and in
   `CLAUDE.md` the "Terms" section and the matching token bullets under
   "Deploys" (with `My App` replaced by the App Name and `myapp` by the
   App Handle), and open a PR.
4. Tell the user which older tokens on other environments (for example
   `able-setup` ones on their Default environment) they can now remove and
   revoke.


## Adding Observability to an existing app

If the user asks to add Observability to an app set up before it was part
of Able, attach its repo and read `.github/deploy.env`, `CLAUDE.md` and
`SECRETS.md`. First bring in the template's observability code and docs as
a PR (`git diff` the app against Able's `main` for
`backend/src/telemetry.ts`, `frontend/src/telemetry.ts`, the workflows and
`deploy-backend`, `scripts/gcx`, `.claude/skills/observability/` and
`observability/`, plus the Grafana values in `deploy.env`). Then do the
Grafana parts of this playbook in order: the Grafana Stack (step 2), Claude's
Grafana token (step 4), "Grafana" in step 5, `GRAFANA_OTLP_TOKEN` (step 6),
and the telemetry checks in step 9. Use the user's existing Grafana Stack if
they have one.

## Limited network access

Full network access is the recommendation (see the top of this file).
This section is for users who choose Limited instead: the Agent
Environment then reaches only package registries, MCP servers, and the
hosts on its allowlist. You can add exact hosts yourself, with
`update_environment` (the user approves a card each time, and it takes
effect within seconds). Only the user can add wildcards.

**Creating it for the user.** If step 0 found the session on another
environment and the user asked for Limited, create it and move this
session onto it, so this conversation carries on. Say in one or two
sentences what you're creating (its name, Limited access, the hosts below,
and that this session moves onto it), then call `create_environment` with
`name`: the App Name, `scope: "personal"`, `allowed_hosts`: the list below,
`allow_package_managers: true`, `allow_mcp_servers: true`,
`switch_session: "network_only"`, and `leave_statement` copied exactly from
`get_environment` if it returned one, and `repositories`: the app's repo
(`<owner>/<repo>`). No variables or setup script.

- **Approved and moved:** call `get_environment` again to check this
  session is on the new Agent Environment, then go to step 1.
- **Created, but this session didn't move:** have the user start a new
  session on it, with the app's repo selected, and paste the same prompt.
  Then stop.
- **Declined:** don't propose it again. Give "Before the session" steps
  4 and 5 instead (Full network access), and stop.

**Setting up the allowlist.** On an existing Limited Agent Environment, add
whichever of these are missing with one `update_environment` call
(`add_allowed_hosts`, with `environment_name` and `applies_to` copied
from `get_environment`), saying first in one line what you're adding and
why:

| Hosts | Why |
|---|---|
| `console.neon.tech`, `api.fly.io`, `api.machines.dev`, `api.cloudflare.com` | the Claude Code Tokens' APIs (a card also allows its host, but list them anyway) |
| `api.workos.com` | step 7's sign-in checks |
| `neon.com`, `fly.io`, `developers.cloudflare.com`, `workos.com` | each service's docs; step 1 reads `neon.com` |
| `github.com`, `release-assets.githubusercontent.com` | `scripts/gcx` downloads Grafana's CLI from GitHub releases on first use |

**Wildcard hosts** (after step 1, once the App Handle and region are known).
Have the user add three, and explain in a line each what they unblock:

- `*.<region>.aws.neon.tech`, e.g. `*.us-east-1.aws.neon.tech` (the Neon
  region without its `aws-` prefix): every Neon branch has its own
  database host. Step 5 runs SQL and a Realtime test on a scratch branch,
  and each Preview gets its own branch.
- `*.fly.dev`: the Production backend (step 9) and each Preview's
  backend, `<app>-pr-<n>.fly.dev` (step 10).
- `*.<Pages Subdomain>`, usually `*.<App Handle>-frontend.pages.dev`: each Preview's frontend (step 10).

Steps: tap the **environment name** in the session's title bar, then
**Edit**, then **Network access**. Under **Allowed domains**, add the
three, one per line, filled in for this app, and save. (If the app shows
**Custom** rather than **Limited**, use that, and keep its box for the
default package managers ticked.) Check with `get_environment` that all
three are listed before going on. If they'd rather not add them, say that
you'll ask to add each exact host as it appears instead (a card each
time), and that Previews can't be checked until their hosts are added.

**Exact hosts as they appear.** Add each with `update_environment`:

- **Step 5:** the Pages Subdomain (a wildcard doesn't match the bare
  name). If it isn't `<App Handle>-frontend.pages.dev`, also ask the
  user to change the Pages wildcard to `*.<subdomain>`.
- **Step 2:** the Grafana Stack's host (`<stack slug>.grafana.net`).
- **Step 11:** the Custom Domain.
- **Any time** a request is refused with "no rule allows host": that
  exact host, rather than stopping or working around it.
