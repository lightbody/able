# Setting up `postgres`

**For Claude Code.** This is the `postgres` Module's part of `PLAYBOOK.md`. Each
heading below names the playbook step it belongs to: when the playbook
reaches that step, and the app has this Module, do that section. The
playbook's ground rules, Terms and "How `request_credential` works" apply
here too.

The database is **Neon** Postgres, with **Neon Realtime** for live queries
and a Neon branch for each Preview.

## Step 1: Region

Neon Realtime is in beta and available only in the Neon regions in the
playbook's Region Trio table, so with this Module the Neon region comes
first and the Fly region follows it.

## Step 2: Account

| Service | What it's for | Sign up |
|---|---|---|
| Neon | Postgres + Realtime | https://console.neon.tech/signup |

**New Neon accounts: don't create a project.** Neon's sign-up usually goes
on to a create-project form. Tell the user, before they sign up, to skip
that form or close it: you create the project yourself in step 5, in the
region from step 1, with Postgres and Realtime set up. If the form can't be
skipped, have them create it with the App Name as the project name and
the Neon region from step 1, and close any connection string without
copying it. You adopt that project in step 5 instead of creating one.

## Step 4: Claude Code Token

If the Agent Environment already has a credential for `console.neon.tech`,
check it: `GET https://console.neon.tech/api/v2/projects` must succeed. A
project-scoped key fails with "not allowed outside the project". It can't
create the new project, so it must be replaced with an organization key.

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

## Step 5: Provision

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
   still writes what `.github/actions/postgres-stage` reads, without
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

Record `NEON_PROJECT_ID`, `NEON_PROD_BRANCH`, `NEON_DB_NAME`,
`NEON_DB_ROLE` and `NEON_CLI` (`neon@$V`) for `.github/deploy.env`.

**Restrict Realtime to the Production Origin.** Do this once the playbook's
core step 5 has created the Pages project, so `PROD_FRONTEND_ORIGIN` is
known:

```bash
NEON_API_KEY=proxy-injected npx -y neon@$V realtime enable --project-id $P \
  --branch <default branch> --allowed-origin "$PROD_FRONTEND_ORIGIN"
```

`realtime enable` only answers "Realtime enable requested for branch
…", and neither the CLI nor the branch API reads the setting back, so
you can't confirm the allowed origin here. The scratch-branch test in
step 5 proves Realtime itself works; the origin is proven only
by the browser two-tab test in step 9 (and step 11 for a Custom Domain).
If the server checks pass but the page signs in and then shows no
greetings or doesn't sync, suspect the allowed origin first: re-run this
command with the exact origin, no trailing slash, and retry.

## Step 6: CI Token

**`NEON_API_KEY`**: the same place as Claude's Neon key in step 4.
That's the **organization's** Settings with the project's organization
active, **not** the profile menu's Settings. Then **API keys → Create
new**, choose **Project-scoped**, and select the new project. Name: type
`<App Handle>-ci`. It's shown only once, so copy it straight away. Repeat
the navigation steps from step 4; don't assume the user remembers them.

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

## Step 8: Code

The backend's tests now need Postgres on 127.0.0.1:5432 with database
`app_test`. `.claude/hooks/session-start.sh` starts one, so run it with
`CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD` if it hasn't run. Leave
`app_test` alone: it's the local test database, named so it never needs
renaming.

## Step 9: Check Production

The backend deploys against the default Neon branch and runs its
migrations on boot. A failure at a Neon step of the deploy usually means
`NEON_API_KEY` was pasted into the wrong secret or isn't scoped to this
project.

- `/live/config` without a token returns 401.
- The `greetings` table exists on the default branch, checked over HTTPS
  SQL.

**What the user sees:** have them open `PROD_FRONTEND_ORIGIN` in **two
tabs** and sign in. Both show "Hello, <App Name>!" in a list. They add a
greeting in one tab and watch it appear in the other.

## Step 10: Check a Preview

`preview.yml` creates the Neon branch `preview/pr-<n>` and enables Realtime
on it with origin `*`, before the backend deploys against it. Have the user
do the two-tab test on the Preview URL from the PR comment. Closing the PR
deletes the branch.

## Step 11: Custom Domain

After `PROD_FRONTEND_ORIGIN` changes to the Custom Domain, re-run
`neon realtime enable --branch <default> --allowed-origin https://<domain>`.

## Limited network access

- Allowlist: `console.neon.tech` (the Claude Code Token's API) and
  `neon.com` (docs; step 1 reads it).
- Wildcard, added by the user: `*.<region>.aws.neon.tech`, e.g.
  `*.us-east-1.aws.neon.tech` (the Neon region without its `aws-` prefix).
  Every Neon branch has its own database host: step 5 runs SQL and a
  Realtime test on a scratch branch, and each Preview gets its own branch.
