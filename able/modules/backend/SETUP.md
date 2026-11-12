# Setting up `backend`

**For Claude Code.** This is the `backend` Module's part of `PLAYBOOK.md`. Each
heading below names the playbook step it belongs to: when the playbook
reaches that step, and the app has this Module, do that section. The
playbook's ground rules, Terms and "How `request_credential` works" apply
here too.

The backend runs on **Fly.io**: the Production app, plus one Fly app for
each Preview.

## Step 1: Region

The app needs a Fly region. With `postgres`, it's the one next to the Neon
region in the playbook's Region Trio table. Without `postgres`, any Fly
region works: suggest the one nearest the users (`iad` for the Americas,
`fra` for Europe, the Middle East and Africa, `sin` for Asia and Oceania).

## Step 2: Account

| Service | What it's for | Sign up |
|---|---|---|
| Fly.io | backend hosting (asks for a payment method) | https://fly.io/app/sign-up |

## Step 4: Claude Code Token

If the Agent Environment already has a credential for `api.fly.io` **and**
`api.machines.dev`, check it: the GraphQL
`{ organizations { nodes { slug name type } } }` must list **the org the
user chose for this app**. A token for any other org must be replaced.

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
3. **Reuse an existing org.** Zero setup, but this app's CI Token and
   Claude Code Token can then create, deploy and destroy every other app
   in that org. Say so plainly, before they choose. Their personal org is
   the broadest case, since it usually holds everything else they run on
   Fly: recommend against it for anything but a throwaway. If they pick
   it anyway, skip to the token steps.

Steps for the user to create the org (nothing to copy):

1. Open **https://fly.io/organizations/new**.
2. Name: the App Name, e.g. `Todoable`.
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
4. Create a token of type **Org Deploy Token**. Name: `<App Handle>-claude-code`. Leave the expiry at
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

## Step 5: Provision

You don't need flyctl for setup: everything below uses Fly's HTTP APIs.
(Piping Fly's install script into `sh` can be refused by the session's
safety checks anyway.) CI installs its own flyctl.

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

Record `FLY_ORG` and `FLY_BACKEND_APP` for `.github/deploy.env`.

## Step 6: CI Token

**`FLY_API_TOKEN`**: a second **org deploy token** for **the app's own
org**, made the same way as Claude's token in step 4 but kept
separate, so either can be revoked without breaking the other.
1. Open `https://fly.io/dashboard/<org slug>/tokens`, filled in: the
   org's **Tokens** page. For this link, take the org slug from the
   Machines API's record of the app you reserved in step 5
   (`GET https://api.machines.dev/v1/apps/<FLY_BACKEND_APP>` →
   `.organization.slug`), not from `FLY_ORG`: for a personal org the
   two differ, and the dashboard uses the first.
2. Check the page is for the app's own org before going on: a token
   for the wrong org breaks Previews or reaches other apps.
3. If the link didn't land there: **https://fly.io/dashboard**, choose
   the org in the **organization dropdown**, then **Tokens** in that
   org's menu (not an app's **Tokens**, which makes deploy tokens that
   can't create Preview apps).
4. Create a token of type **Org Deploy Token**, the same type as the
   `<App Handle>-claude-code` token in step 4. Name: `<App Handle>-ci`. Choose a long
   expiry, or none if offered, since CI needs it long-term.
5. Copy the **whole** value. In GitHub, paste it **as is**, including
   `FlyV1 ` at the start. Unlike the card, GitHub needs the prefix.

## Step 8: Code

In `fly.backend.toml`, set `app = "<FLY_BACKEND_APP>"` and
`primary_region = "<the Fly region from step 1>"`. Previews deploy from the
same file, so they land in the same region.

The checks to run before committing include
`npm run build --workspace=shared && npm test --workspace=shared` and
`npm run build --workspace=backend && npm test --workspace=backend`.

## Step 9: Check Production

The push to `main` also runs `backend.yml`, which tests and then deploys to
Fly. A failure at a Fly step usually means `FLY_API_TOKEN` was pasted into
the wrong secret or is for the wrong org.

- `curl https://<FLY_BACKEND_APP>.fly.dev/health` returns `{"status":"ok"}`.
- A CORS preflight from `PROD_FRONTEND_ORIGIN` returns 204 with
  `access-control-allow-origin: <origin>`.
- Without `auth`: `curl https://<FLY_BACKEND_APP>.fly.dev/hello` returns
  `{"message":"Hello from the API!"}`. (With `auth` it needs a token, and
  that Module's section checks it.)

**What the user sees** (without `auth`; with it, that Module's section
covers this): the page at `PROD_FRONTEND_ORIGIN` shows "Hello from the
API!" under the title. If it says "Couldn't reach the API", check the CORS
preflight above first.

## Step 10: Check a Preview

`preview.yml` deploys the PR's own backend, `<FLY_BACKEND_APP>-pr-<n>`, and
comments its URL on the PR. Run the step 9 checks against
`https://<FLY_BACKEND_APP>-pr-<n>.fly.dev`. A Preview's backend accepts any
origin, so its CORS preflight answers `*`. Closing the PR destroys the app.

## Limited network access

- Allowlist: `api.fly.io` and `api.machines.dev` (the Claude Code Token's
  APIs), and `fly.io` (docs).
- Wildcard, added by the user: `*.fly.dev`, for the Production backend
  (step 9) and each Preview's, `<app>-pr-<n>.fly.dev` (step 10).
