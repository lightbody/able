# Setting up `custom-domain`

**For Claude Code.** This is the `custom-domain` Module's part of `PLAYBOOK.md`. Each
heading below names the playbook step it belongs to: when the playbook
reaches that step, and the app has this Module, do that section. The
playbook's ground rules, Terms and "How `request_credential` works" apply
here too.

Production on a domain of the user's own. This Module has no code: it's
these steps, and extra permissions on the Cloudflare Claude Code Token
while setup needs them.

## Step 1: Ask

Ask now, not later: the answer decides which permissions the Cloudflare
token needs in step 4, and creating it with the right ones the first time
saves the user a second trip to Cloudflare. Ask which domain, e.g.
`todoable.example.com`, and whether its DNS is on Cloudflare, in the
account they'll use for this app. Only then can Claude set it up;
otherwise the user attaches it by hand in step 11.

Tell them in a sentence or two how it goes, so they aren't left wondering
when it'll come up: the app first goes live on its `pages.dev` address, and
the domain is switched on **last** (step 11), once Production and Previews
are tested, so a domain problem can't be mistaken for anything else.

## Step 4: Claude Code Token

The Cloudflare token gets a **Zone policy** for the domain's zone, as the
playbook's Cloudflare token steps describe. Check it after the card:
`GET /client/v4/zones?name=<apex>` lists the zone, in the same account.

## Step 9: Check Production

Remind the user in one line that the Custom Domain isn't forgotten: it's
switched on in step 11, after Previews.

## Step 11: Switch it on

Use the domain from step 1. Before starting, remind the user in one line
what changes: the app moves to the domain, and with `backend` the
`pages.dev` address stops working for API calls and sign-in.

1. **Attach the domain.**
   - **Limited network only:** first add `<domain>` to the allowlist
     ("Limited network access", at the end of the playbook).
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
   With `postgres`, also do that Module's "Step 11" section.
3. **With `auth`, the user:** in WorkOS (**Production** environment → **Applications** →
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
4. With `backend`, the app now works only at the Custom Domain. The
   `pages.dev` address still serves the page, but the backend rejects its
   API calls, so sign-in fails there too.

With `observability`, also do that Module's "Step 11" section.

## Step 12: Narrow the Cloudflare token

In the token's **Zone** policy, change **DNS** from **Edit** to **Read**,
and keep **Zone → Read**, as the playbook's step 12 describes.

## Limited network access

- Allowlist: the Custom Domain itself, added at the start of step 11.
