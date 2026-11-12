# Able playbook: set up a new app

**For Claude Code.** You are setting up a new app from the Able template
(https://github.com/lightbody/able) for the user, end to end: a private
GitHub repo, a Production environment, a Preview for every PR, and every
part of the app the user chose working in both. Follow this file in
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
| **App Name** | The app's human-readable name, chosen by the user before the session (it names the Agent Environment) and confirmed in step 0, e.g. "Todoable". Spaces and capitals are fine. | the Agent Environment's name; the Fly org (step 4); the Neon project (step 5); the WorkOS project (step 7); the README and `AGENTS.md` titles and the page itself, in place of `My App` (step 8) |
| **App Handle** | The app's technical name: lowercase letters, digits and hyphens, derived from the App Name, e.g. `todoable`. Wherever a service wants a name without spaces, it's this. | token names (`<App Handle>-claude-code`, `<App Handle>-ci`); the GitHub repo (made before the session; step 3); the Fly backend app (`<github-user>-<App Handle>-backend`) and the Pages project (`<App Handle>-frontend`) (step 5); the npm scope and other code names, in place of `myapp` (step 8) |
| **App Environments** | The places the app itself runs: **Development**, **Preview** and **Production**, described below. | throughout |
| **Development** | A developer's own copy of the app: `npm run dev` against a personal Neon branch (`dev/<you>`), as the README's "Local development" describes. | after setup |
| **Preview** | The app deployed for one pull request: Neon branch `preview/pr-<n>`, Fly app `<FLY_BACKEND_APP>-pr-<n>`, and a Pages preview. Created when the PR opens, deleted when it closes. Previews take the place of a shared staging environment. | step 10 |
| **Production** | The app deployed from `main`: the default Neon branch, `FLY_BACKEND_APP`, and the Pages production deployment at the **Production Origin**. | step 9 |
| **Production Origin** | Production's frontend address, `PROD_FRONTEND_ORIGIN`: `https://<Pages Subdomain>` until step 11, then `https://<Custom Domain>`. | steps 5, 7, 9, 11 |
| **Pages Subdomain** | The `<name>.pages.dev` host Cloudflare gives the Pages project, usually `<App Handle>-frontend.pages.dev`. Each Preview's frontend is a subdomain of it. | steps 5, 7, 10 |
| **Custom Domain** | An optional domain of the user's for Production, e.g. `todoable.example.com`: the `custom-domain` Module. Asked about in step 1, switched on in step 11. | steps 1, 4, 11 |
| **Region Trio** | The Neon region, the Fly region next to it, and the Grafana Cloud region next to those (used only if the user creates a new Grafana Stack), chosen in step 1. Only the parts the app's Modules use apply. | steps 1, 2, 5, 8 |
| **Agent Environment** | The Claude Code cloud environment for this app, named with the App Name and used for nothing else. This setup session and every later Claude Code session on the app run on it, and it holds the Claude Code Tokens. | "Before the session", step 0, step 4, and "Limited network access" |
| **Claude Code Tokens** | Claude's own API tokens for Neon, Fly, Cloudflare and Grafana, each named `<App Handle>-claude-code` and saved on the Agent Environment. | steps 4, 5, 6, 12 |
| **CI Tokens** | GitHub Actions' API tokens for the same services, each named `<App Handle>-ci` and saved as GitHub secrets. | step 6 |
| **Observability** | The app's telemetry (traces, metrics and logs from the backend, real-user data from the frontend) in a **Grafana Stack**: a Grafana Cloud instance, `GRAFANA_STACK_URL`, usually shared by all of the user's apps. Each app's telemetry is labelled with its App Handle. | steps 2, 4, 5, 6, 9, 10 |
| **Module** | One optional part of an app, with its own files, deploy steps and setup: `backend` (Fly), `auth` (WorkOS), `postgres` (Neon), `observability` (Grafana Cloud) and `custom-domain`. The user chooses them in step 1. See "Modules" below. | throughout |
| **Baseline** | The permissions the Claude Code Tokens keep between tasks, listed in `SECRETS.md`. | step 12 |

Two words from the services mean something else, so always qualify them:

- **WorkOS environments** (WorkOS's own Production, Staging and
  Development) aren't App Environments. Production and every Preview
  sign in against the **WorkOS Production environment** (step 7). Write "WorkOS
  Production environment", never just "Production", when you mean it.
- **Fly's org slug** is the identifier Fly gives an org, recorded as
  `FLY_ORG`. It's derived by Fly, not by you, and isn't the App Handle.

## Modules

An app takes only the parts it needs. The core, which every app has, is a
React frontend on Cloudflare Pages, with a Preview for every pull request.
Everything beyond that is a **Module**:

| Module | What the app gets | Service | Requires |
|---|---|---|---|
| `backend` | an API of its own | Fly.io (asks for a payment method) | |
| `auth` | sign-in | WorkOS | `backend` |
| `postgres` | a database, with live updates in the browser | Neon | `backend`, `auth` |
| `observability` | traces, logs and metrics, which later sessions read to fix bugs | Grafana Cloud | |
| `custom-domain` | Production on the user's own domain | the domain's DNS, ideally on Cloudflare | |

`postgres` requires `auth` so stored data is never reachable without
sign-in. Step 1 settles which Modules this app has.

**Every step has a core part and a part for each Module.** The core part
is in this file. A Module's part is in its setup file,
`able/modules/<name>/SETUP.md`, under a heading that starts with the same
step number. At each step:

1. Do the core part.
2. Then, for each Module the app has, in this order: `backend`, `auth`,
   `postgres`, `observability`, `custom-domain`, do that Module's section
   for the step, if it has one.

Skip every Module the app doesn't have, and don't mention its service to
the user at all: a static site's setup never brings up Fly, Neon or
WorkOS.

The setup files are in the app's repo until step 8 removes `able/`, so
step 0 has you keep a copy.

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

Only the rows for services the app uses apply: Cloudflare always, Fly with
`backend`, Neon with `postgres`, Grafana with `observability`.

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
`AGENTS.md` to widen a token only for the task that needs it and then
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
  See the Fly token steps in the `backend` Module's step 4. (Hopefully the card is fixed
  some day; if a pasted `FlyV1 …` value saves as is, that's fine too.)
- If the user declines a card, don't re-ask unless they say so, for example
  "I submitted it wrong, ask again". If they say that, ask again.
- After `saved`, retry right away. Wait about a minute only if you get a
  401/403 or a "no rule allows host" refusal.

## Values you will collect

Track these as you go. Every one for a Module the app has ends up in
`.github/deploy.env`:

| Key | Module | Source |
|---|---|---|
| `APP_HANDLE` | core | the App Handle (step 8's rename sets it) |
| `CLOUDFLARE_ACCOUNT_ID` | core | Cloudflare API (step 5) |
| `CLOUDFLARE_PAGES_PROJECT` | core | `<App Handle>-frontend` |
| `PROD_FRONTEND_ORIGIN` | core | the Production Origin: `https://<Pages Subdomain>`, returned when the Pages project is created |
| `FLY_ORG` | `backend` | Fly's org slug, as its GraphQL API lists it, for the org the user chose in step 4 (new, linked or reused; step 5) |
| `FLY_BACKEND_APP` | `backend` | `<github-user>-<App Handle>-backend`, checked for availability |
| `WORKOS_CLIENT_ID` | `auth` | pasted by the user in chat (step 7) |
| `NEON_PROJECT_ID` | `postgres` | the project you create with the Neon API in step 5 |
| `NEON_PROD_BRANCH` | `postgres` | the project's default branch (API-created projects call it `main`, console-created ones may call it `production`; check it) |
| `NEON_DB_NAME`, `NEON_DB_ROLE` | `postgres` | Neon API (`neondb` / `neondb_owner` by default) |
| `NEON_CLI` | `postgres` | `neon@<version>`: the version you pick and check in step 5 |
| `GRAFANA_STACK_URL` | `observability` | `https://<stack slug>.grafana.net`, from the user in chat (step 2) |
| `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_OTLP_ENDPOINT` | `observability` | derived from the Grafana Stack (step 5) |
| `GRAFANA_FARO_URL` | `observability` | the Faro app you create in step 5 |

Also record the **Custom Domain** from step 1, if any. It isn't in
`deploy.env` until step 11, when it replaces `PROD_FRONTEND_ORIGIN`.

You may also pick a **Region Trio** in step 1. The Neon region is the
project's `region_id`. The Fly region goes into `primary_region` in
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
**Full**, and tap **Create environment** (**Add environment** in some versions of the app).

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

**Keep a copy of the playbook.** Copy the repo's `PLAYBOOK.md` and its
`able/` folder to your scratch directory, outside the repo, and follow
those copies from here on. They match the code in this repo, and step 8
removes both from it while later steps still need them.

**Note which Able commit the repo was made from.** The app records it, so
it can later ask what's new in Able. A repo made from the template holds
exactly the files of one Able commit, so match its first commit's tree
against Able's history:

```bash
git clone --quiet https://github.com/lightbody/able <scratch>/able-history
tree="$(git rev-parse "$(git rev-list --max-parents=0 HEAD)^{tree}")"
git -C <scratch>/able-history log --format='%H %T' | awk -v t="$tree" '$2 == t { print $1; exit }'
```

That prints the Able commit. If it prints nothing (the repo wasn't made
straight from the template), use
`git -C <scratch>/able-history rev-parse HEAD` and tell the user the
record is approximate. Keep the commit for step 8.

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
`api.cloudflare.com`, `api.fly.io`, `api.machines.dev` or
`console.neon.tech`, ask whether they're this app's; if not, say step 4's
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

Step 0 settled the App Name and App Handle. Ask the user, one question at
a time:

1. **One sentence on what it's for.** This goes into the README and
   `AGENTS.md`.
2. **What does the app need?** This chooses its Modules. Offer three
   starting points in plain words, and say which accounts each one means:
   - **Full app** (the default): a page, an API, sign-in, and a database
     whose changes show up live in the browser. Accounts: Cloudflare,
     Fly, WorkOS and Neon. Modules: `backend`, `auth`, `postgres`.
   - **Site plus API:** a page and an API of its own, with sign-in if they
     want it. Accounts: Cloudflare and Fly, plus WorkOS for sign-in.
     Modules: `backend`, and `auth` if they want sign-in.
   - **Static site:** just the page. Account: Cloudflare only. No Modules.

   Say that it isn't a one-way choice: a Module can be added later, so
   when they're unsure, less is fine. A database needs sign-in (`postgres`
   requires `auth`), so don't offer one without the other.
3. **Do you want Observability?** That's the `observability` Module:
   traces, logs and metrics in Grafana Cloud (the free tier is enough),
   which later sessions read to find bugs and check deploys. Recommend it
   for anything beyond a throwaway.
4. **Do you want a Custom Domain, and if so, which one?** That's the
   `custom-domain` Module. If yes, do its "Step 1" section now.
5. **Roughly where are you and your users?** A continent or country is
   enough. Ask only if the app has `backend`, or `observability` with a
   new Grafana Stack: it picks where the backend and database run. A
   static site has no region to choose.

The **App Handle** is derived from the App Name: lowercase letters,
digits and hyphens only, e.g. `todoable`. It should be short, since
longer names are built from it (`<github-user>-<App Handle>-backend`).
Normally it's the repo's name.

Then do each chosen Module's "Step 1" section, and suggest a **Region
Trio** from the table below, using only the columns the app's Modules
need. With `postgres`, the backend talks to the database on every request,
so the Fly region must sit next to the Neon region, and the Neon region
comes first: Neon Realtime is in beta and available only in the four Neon
regions below. Before you suggest one, check the current list at
https://neon.com/docs/realtime/overview#which-regions-is-it-enabled-in. If
it has changed, pair any new region with the nearest Fly region. If the
user will create a new Grafana Stack, suggest the Grafana Cloud region
next to the others; an existing stack is fine wherever it is, since
telemetry is sent in the background and distance doesn't slow the app.

| Users mostly in | Neon region | Fly region | Grafana Cloud region |
|---|---|---|---|
| North or South America (default) | `aws-us-east-1` (N. Virginia) | `iad` (Ashburn, Virginia) | a US **East** region |
| US Midwest, if they prefer it | `aws-us-east-2` (Ohio) | `ord` (Chicago) | a US **East** region |
| Europe, the Middle East or Africa | `aws-eu-central-1` (Frankfurt) | `fra` (Frankfurt) | an EU region |
| Asia or Oceania | `aws-ap-southeast-1` (Singapore) | `sin` (Singapore) | an Asia-Pacific region, Singapore if offered |

For a new stack, Grafana's region picker lists its regions by name: pick
the one in that area rather than leaving the default.

With `postgres`: no Realtime region is in the western Americas yet. Users
there still get `aws-us-east-1` + `iad`, so say that pages will be a
little slower for them.

Confirm the App Name, App Handle, the Modules (in plain words: "a page, an
API and sign-in, with Observability"), the Region Trio if there is one,
and the Custom Domain (or "none") with the user in one line, then
continue.

**Limited network only:** now that the App Handle and region are known, do
"Wildcard hosts" under "Limited network access" at the end of this file.

## Step 2: Accounts

GitHub is done already ("Before the session"). The core needs one more
account:

| Service | What it's for | Sign up |
|---|---|---|
| Cloudflare | frontend hosting (Pages) | https://dash.cloudflare.com/sign-up |

Add the row from each chosen Module's "Step 2" section, and show the user
one table. Ask which of these they already have. For the rest, give the
sign-up links and wait. Signing in with GitHub is fine wherever it's
offered. Then do the rest of each Module's "Step 2" section.

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
Environment there are none. If `api.cloudflare.com` is saved, check it's
usable for setup: `GET /client/v4/user/tokens/verify` is `active`, **and**
`GET /client/v4/accounts` lists the account. Each Module's "Step 4"
section says how to check its own.

Walk the user through creating the missing or unusable ones, each named
`<App Handle>-claude-code`. Say once that they're for Claude on this app only:
for setting it up now and for building and debugging it later, saved on
the Agent Environment, and that some get narrowed once setup no longer
needs their extra permissions. Each token goes **only** into a card, never
into GitHub.

Do one token at a time, in the two turns described in "How
`request_credential` works". First send the creation steps and end
your turn with "copy it, then tell me when you have it copied". Only after
the user confirms, call `request_credential`. Never show a card in the same
turn as the creation steps.

**Cloudflare token**

This is a **user API token** made from a custom template. Warn about two
traps on that page: the **Global API Key** further down is all-powerful
and must not be used, and the ready-made templates (such as "Edit
Cloudflare Workers") grant the wrong permissions. Use the Custom Domain
answer from step 1, and don't ask again: include the zone permissions
only if the app has `custom-domain` and the domain's DNS is on
Cloudflare. Give
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

Then each chosen Module's "Step 4" section. Re-run the checks for each new
token.

## Step 5: Provision (you)

**Cloudflare: create the Pages project.**

```bash
curl -s https://api.cloudflare.com/client/v4/accounts -H "Authorization: Bearer x"   # CLOUDFLARE_ACCOUNT_ID
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$A/pages/projects" -H "Authorization: Bearer x" \
  -H "Content-Type: application/json" -d '{"name":"<App Handle>-frontend","production_branch":"main"}'
```

Use the returned `result.subdomain`. If the name was taken, Cloudflare adds
a suffix. `PROD_FRONTEND_ORIGIN` is `https://<subdomain>`.

Record `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` and
`PROD_FRONTEND_ORIGIN` for `.github/deploy.env`.

**Limited network only:** add `<subdomain>` to the allowlist now, as
"Limited network access" at the end of this file describes.

Then each chosen Module's "Step 5" section.

## Step 6: CI Tokens (GitHub secrets only)

Everything the tokens are scoped to now exists, so the user can create the
app's narrowly scoped CI Tokens. Every one goes **only** into GitHub, at:
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

The core's token:

**`CLOUDFLARE_API_TOKEN`**: an **account API token**, not a user token
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

Then each chosen Module's "Step 6" section: one more token each for
`backend`, `postgres` and `observability`.

You can't read GitHub secrets. The first deploy in step 9 verifies them.

## Step 7: Dashboard setup

Only `auth` has a part in this step: its "Step 7" section sets up sign-in
in the WorkOS dashboard. Without `auth`, go to step 8.

## Step 8: Make the code the user's app

In the cloned repo:

1. **Make it this app's code.** Check your copy of `PLAYBOOK.md` and
   `able/` is in your scratch directory (step 0), then run:

   ```bash
   node able/configure.mjs --name "<App Name>" --handle <App Handle> \
     --modules <the app's Modules> --able-commit <the Able commit from step 0>
   ```

   `--modules` takes the chosen Modules separated by commas, e.g.
   `backend,auth`, or `none` for a static site. Leave `--modules` out for
   every Module. It does four things:
   - **Removes what the app doesn't have:** the files and marked lines of
     every Module left out, and always Able's own files (`PLAYBOOK.md`,
     `able/`, and Able's landing page and checks: `site/`,
     `.github/workflows/site.yml`, `.github/workflows/able.yml` and
     `.github/scripts/site-comment.js`).
   - **Strips the Module markers** (`able:begin`, `able:end` and
     `able:only` comments) from every file, keeping the code between them.
   - **Renames the placeholders** in every file, including
     `package-lock.json`: `My App` → App Name and `myapp` → App Handle.
     This covers the package names, the token names in `SECRETS.md` and
     `AGENTS.md`, and the Pages project.

   - **Writes `ABLE.md`:** the app's record of the Able commit it was
     made from and the Modules it has. The `able` skill
     (`.claude/skills/able/`), which stays in the app, uses it later to
     bring over what's new in Able.

   Check `git grep -n "able:begin\|able:end\|able:only"` finds nothing.
2. **Fill in `.github/deploy.env`.** Every key it now has, from "Values
   you will collect". A key that's missing belongs to a Module the app
   doesn't have: don't add it.
3. **Each chosen Module's "Step 8" section.**
4. **Docs:**
   - `README.md`: it now starts with `# <App Name>`. Under the title, put
     the user's one-sentence description in place of the template text.
   - `AGENTS.md`: replace its first paragraph with the description.
   - Read `README.md`, `AGENTS.md` and `SECRETS.md` through once. They
     were written for the full app: fix any sentence that still describes
     something this app doesn't have.
   - **Keep `CLAUDE.md`.** It's one line, `@AGENTS.md`, which is how Claude
     Code loads the guidelines. Don't edit it, and don't copy `AGENTS.md`'s
     content into it.
   - **Keep `SECRETS.md`.** It's the app's guide to its tokens and to
     rotating them.
5. Run `npm install`, which brings the lockfile in line with the new
   names and Modules. Then run the same checks CI runs:
   `npm run build --workspace=frontend`, plus the ones in each Module's
   "Step 8" section.
6. `git grep -n -i -E "myapp|my app"` must find nothing except `@<App Handle>/`
   lookalikes you've checked. Then commit everything as one commit,
   "Set up <App Name>", and push to `main`.

## Step 9: Production comes up

The push to `main` runs `frontend.yml`, which deploys Pages production.
**This is the first use of the CI Tokens.** A failure at a Cloudflare step
usually means `CLOUDFLARE_API_TOKEN` was pasted into the wrong secret or
has the wrong scope, so check the job log for which call failed.

Watch the runs with the GitHub tools, read failed job logs, fix, and push.
Then verify:

- The page at `PROD_FRONTEND_ORIGIN` serves the app's `<title>`.

Then each chosen Module's "Step 9" section, which adds its own checks.
Last, the user looks at the page. Each Module's section says **what the
user sees**; ask for the one from the last Module in the order that has
one, since it includes the others. With no Modules, the page shows the App
Name and "A new app, ready for its first feature."

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
  and the user may choose either.

`frontend.yml` deploys a Pages preview at
`https://<branch-alias>.<Pages Subdomain>` and comments its URL on the PR.
Check it serves the app's `<title>`.

Then each chosen Module's "Step 10" section: it says what the Preview adds
for that Module, and you run that Module's step 9 checks against the
Preview. Have the user look at the Preview URL from the PR comment, as in
step 9. Then merge or close the PR. Closing tears the Preview down.

## Step 11: Custom Domain

Only `custom-domain` has a part in this step: its "Step 11" section
switches the domain on. Without it, go to step 12.

## Step 12: Narrow the Cloudflare token, and wrap up

Setup no longer needs the Cloudflare token's write access to DNS, and
later debugging wants read access to analytics. Cloudflare edits a token
in place, so its value doesn't change and there's no card. Give the user
these steps:

1. Open **https://dash.cloudflare.com/profile/api-tokens**.
2. On the `<App Handle>-claude-code` token, tap **⋯ → Edit**.
3. In the **Account** policy, keep **Cloudflare Pages → Edit** and
   **Account Settings → Read**, and add **Account Analytics → Read**.
4. If there's a **Zone** policy (`custom-domain`): change **DNS** from
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
- which Modules the app has, in plain words, and that others can be added
  later by asking, e.g. "add sign-in from Able"
- that Able keeps improving, and the app can learn from it whenever they
  like: "what's new in Able?" or "pull latest Able" makes Claude walk
  them through what changed and open a pull request with what they take.
  Nothing changes unless they ask.
- that this Agent Environment, named with the App Name, is where to start
  every future session on it. Its `<App Handle>-claude-code` tokens let Claude build
  and debug the app, including looking into Production and Previews
  in the services it uses. They can add the app's repo to the
  Agent Environment's **Repositories** in its settings, so it's selected by
  default.
- that Claude's tokens are now at their Baseline (the table in
  `SECRETS.md`). When a later task needs more, such as working with
  Cloudflare Workers, Claude will say so, guide them through widening only
  what that task needs, and then back to the Baseline when it's done.
- that deploys use only the `<App Handle>-ci` tokens in GitHub, and that
  `SECRETS.md` lists both kinds of token and how to rotate or revoke each.
  Revoking the Claude Code Tokens never affects deploys.
- whatever each chosen Module's "Done" section adds.
- **Limited network only:** if any of the wildcard hosts are still
  missing (check with `get_environment`), strongly recommend adding them
  now, with the steps under "Limited network access", so Claude can reach
  Previews. Setting **Network access** to **Full** is the simpler
  alternative.

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
`name`: the App Name, `scope: "personal"`, `allowed_hosts`: the hosts below
that are known so far (the Modules are chosen in step 1, so add theirs then),
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
| `api.cloudflare.com` | the Cloudflare Claude Code Token's API (a card also allows its host, but list it anyway) |
| `developers.cloudflare.com` | Cloudflare's docs |
| `github.com` | step 0 reads Able's history, and the `able` skill fetches Able later |
| each chosen Module's hosts | listed under "Limited network access" in its setup file |

In step 0 the Modules aren't chosen yet, so add the rows above
then, and each Module's hosts right after step 1.

**Wildcard hosts** (after step 1, once the App Handle and region are known).
Have the user add these, and explain in a line each what they unblock:

- `*.<Pages Subdomain>`, usually `*.<App Handle>-frontend.pages.dev`: each Preview's frontend (step 10).
- each chosen Module's wildcard, if its setup file lists one under
  "Limited network access" (`backend` and `postgres` do).

Steps: tap the **environment name** in the session's title bar, then
**Edit**, then **Network access**. Under **Allowed domains**, add the
three, one per line, filled in for this app, and save. (If the app shows
**Custom** rather than **Limited**, use that, and keep its box for the
default package managers ticked.) Check with `get_environment` that all
of them are listed before going on. If they'd rather not add them, say that
you'll ask to add each exact host as it appears instead (a card each
time), and that Previews can't be checked until their hosts are added.

**Exact hosts as they appear.** Add each with `update_environment`:

- **Step 5:** the Pages Subdomain (a wildcard doesn't match the bare
  name). If it isn't `<App Handle>-frontend.pages.dev`, also ask the
  user to change the Pages wildcard to `*.<subdomain>`.
- **Any step** where a Module's setup file says to add a host: the
  Grafana Stack's host in step 2 (`observability`), the Custom Domain in
  step 11 (`custom-domain`).
- **Any time** a request is refused with "no rule allows host": that
  exact host, rather than stopping or working around it.
