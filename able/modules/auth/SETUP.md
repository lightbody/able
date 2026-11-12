# Setting up `auth`

**For Claude Code.** This is the `auth` Module's part of `PLAYBOOK.md`. Each
heading below names the playbook step it belongs to: when the playbook
reaches that step, and the app has this Module, do that section. The
playbook's ground rules, Terms and "How `request_credential` works" apply
here too.

Sign-in runs on **WorkOS AuthKit**. It has no API tokens: everything is set
up by the user in the WorkOS dashboard, in step 7.

## Step 2: Account

| Service | What it's for | Sign up |
|---|---|---|
| WorkOS | sign-in (AuthKit) | https://dashboard.workos.com |

## Step 7: WorkOS dashboard

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

3. Only with `custom-domain`: `https://<Custom Domain>`, into **Redirect
   URIs** and **Session → Manage** only, added last so it isn't the
   default. Adding it now saves the user a trip in step 11, which then
   only adds the Sign-out URI and makes the domain the default. Sign-in
   at the domain still only works once the app has moved to it.

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

Record the Client ID as `WORKOS_CLIENT_ID` for `.github/deploy.env`.

## Step 9: Check Production

- `/hello` and `/me` on the backend, without a token, return 401.
- Re-run step 7's authorize probe for the Production Origin.

**What the user sees:** the page at `PROD_FRONTEND_ORIGIN` asks them to
sign in. After signing in, it shows the App Name, "Hello from the API!" and
a **Sign out** link. Have them tap **Sign out**: it should land back on the
app's sign-in page.

## Step 10: Check a Preview

Signing in on the Preview's URL works through the wildcard Redirect URI
from step 7. Signing out of a Preview lands on Production, because the
default Sign-out URI is Production's. That's expected.

## Limited network access

- Allowlist: `api.workos.com` (step 7's checks) and `workos.com` (docs).
