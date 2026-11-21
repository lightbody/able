# Setting up `issue-tracking`

**For Claude Code.** This is the `issue-tracking` Module's part of
`PLAYBOOK.md`. Each heading below names the playbook step it belongs to:
when the playbook reaches that step, and the app has this Module, do that
section. The playbook's ground rules, Terms and "How `request_credential`
works" apply here too.

Work is tracked in **Linear**, and Claude Code sessions reach it through
Linear's MCP server, registered in the repo's `.mcp.json`. The server's
API key is a Claude Code Token saved on the Agent Environment: no secret
is ever in the repo, and there is no CI Token.

**Know this before you start: the Linear tools won't appear in this
session.** MCP servers load when a session starts. This session started
before the key was saved, so it can reach Linear only through the proxy
(`.claude/skills/issue-tracking/check-connection.sh`), never with the
`mcp__linear__*` tools. Every session started afterwards, from a branch
that has `.mcp.json`, has them. Do everything below through the proxy. "Done"
starts one such session, so the user sees the tools at work.

**Adding the Module to an existing app** (the `able` skill): do steps 2, 4,
5, 7 and 8 only, then offer "Done". Fill in `deploy.env` in the same pull
request as the Module's files, or deploys skip themselves while the values
are empty. A session sees the tools if it starts from the pull request's
branch, or from `main` once it's merged.

## Step 1: Offer it

Offer issue tracking as a default, in plain words: "track the app's work in
Linear, which Claude can read and update (Linear's free plan is enough)".
It applies to any starting point, with or without a backend. If the user
declines, the app doesn't get the Module.

## Step 2: Account, workspace and team

| Service | What it's for | Sign up |
|---|---|---|
| Linear | issue tracking | https://linear.app/signup |

Ask whether the user already has a Linear workspace. One workspace can hold
many apps, each with its own **team**. If they're new, signing up creates
the workspace.

Then the app's team: the user can create one for this app (**Settings →
Teams**) or choose an existing one.

Get both values from **one pasted link**, so nobody has to find them
separately. Ask the user to open the team's **Home** in Linear (in the
sidebar, **Your teams → the team → Home**) and paste the address from the
browser's address bar. It looks like
`https://linear.app/lightbody/team/TES/overview`. From it:

1. **`LINEAR_WORKSPACE_URL`** is `https://linear.app/<slug>`, here
   `https://linear.app/lightbody`.
2. **`LINEAR_TEAM_KEY`** is the part after `/team/`, here `TES`: the
   short uppercase prefix of the team's issues (`TES-12`).

Neither is a secret, so chat is fine. Say both back in one line.

On a phone, where the address bar may not show the full link: the slug is
under **Settings → Administration → Workspace**, and the key is under
**Settings → Your teams → the team → General → Identifier**.

Linear's free plan limits how many issues a workspace can hold. Say so in
one line, without going into detail: if a project reaches it, the
`issue-tracking` skill reports it and stops.

## Step 4: Claude Code Token

If `get_environment` shows a credential for `mcp.linear.app`, check it with
`.claude/skills/issue-tracking/check-connection.sh <LINEAR_TEAM_KEY>`: if it
lists the app's team, it's usable, and there's no new card.

**Linear key** (Read + Write; one team)

A personal API key for the user's Linear account. Tell the user, in a line,
that what Claude writes in Linear will show as them, and that Claude signs
it `Claude Code`. Then give these steps:

1. Open https://linear.app/settings/account/security and find **Personal
   API keys** (by menu: **Settings → Security & access**). Tap **New API
   key**.
2. **Name** it:

   ```
   <App Handle>-claude-code
   ```

3. Under permissions, tick **Read** and **Write**. Linear ticks the create
   permissions along with **Write**, and they can't be unticked: that's
   expected. **Not Admin**, and not full access.
4. Under **Team access**, choose only the app's team (`<LINEAR_TEAM_KEY>`),
   not all teams.
5. Create it. Linear shows the key **only once**: copy it, and tell Claude
   it's copied.

**After the user confirms:** call `request_credential` with the host
`mcp.linear.app` and `display_name` `<App Handle>-claude-code (Linear)`.
Linear accepts the key as `Authorization: Bearer <key>`, which is what the
proxy sends, so the default card settings are right.

## Step 5: Verify

The key reaches Linear through the proxy a few seconds after it's saved.
`deploy.env` is still empty, so pass the team key explicitly: run
`.claude/skills/issue-tracking/check-connection.sh <LINEAR_TEAM_KEY>`. It
must say that Linear answered and that the app's team is there. If it
reports 401 or no route, wait about a minute and run it once more before
asking the user to check the key.

A key limited to one team lists only that team. If the script notes that
more teams are visible, the key wasn't limited to the app's team: have the
user make the key again with **Team access** set to the app's team, and
show a new card.

**Don't expect the Linear tools here**, as above. Nothing else needs
checking until a new session.

## Step 7: Dashboard setup

In Linear, with the user. Give them these as plain links, filled in from
`LINEAR_WORKSPACE_URL` and `LINEAR_TEAM_KEY`:

1. **Connect GitHub:** `<LINEAR_WORKSPACE_URL>/settings/integrations/github`.
   **Connect**, authorize it, and select this app's repo. This is what links
   a branch or pull request to the issue named by the key in its branch name.
2. **Review the team's workflow:**
   `<LINEAR_WORKSPACE_URL>/settings/teams/<LINEAR_TEAM_KEY>/workflow`.
   Linear's defaults already move issues as pull requests open and merge, so
   there's nothing to turn on: review the settings and change them as they
   see fit.

There is no API for this, so the user does it. The first real check is the
demo session in "Done".

## Step 8: Make the code the user's app

1. Put the two Linear values in `.github/deploy.env`:
   `LINEAR_WORKSPACE_URL` and `LINEAR_TEAM_KEY`.
2. **Always** point the GitHub Issues link at the workspace (the template's
   default is Linear's home page, which is valid but generic):

   ```bash
   sed -i "s#^\(    url: \).*#\1<LINEAR_WORKSPACE_URL>#" .github/ISSUE_TEMPLATE/config.yml
   grep -n "url:" .github/ISSUE_TEMPLATE/config.yml
   ```

   The `grep` must show the workspace address.
3. `.mcp.json` and the `issue-tracking` skill stay as they are.

Checks: `node -e 'JSON.parse(require("fs").readFileSync(".mcp.json","utf8"))'`
succeeds, and `git grep -n -i "linear"` finds only what you expect.

## Step 12: Check the key's Baseline

The Linear key is already at its Baseline (Read + Write, one team), so
there's nothing to narrow. Run
`.claude/skills/issue-tracking/check-connection.sh <LINEAR_TEAM_KEY>` once
more: it should list only the app's team. If the user widened the key for a
task, bring it back to the Baseline the same way.

## Done

This is the moment the user sees the whole loop, from a Linear issue to
Production, work once. You do it by starting a **demo session**, which has
the Linear tools because it starts after the key was saved, from `main`,
which has `.mcp.json`. Do this before the playbook's other closing points,
since it takes a few minutes.

### 1. Start the demo session

Call `create_session` with:

- `source_url`: the app's repo (`https://github.com/<owner>/<repo>`), and
  `source_revision`: `main`.
- the Agent Environment: leave `environment_id` out, so it inherits this
  session's.
- `title`: `First change: dark theme (Linear to PR)`.
- `extra_allowed_tools`: `mcp__linear__save_issue`, `mcp__linear__get_issue`,
  `mcp__linear__list_issues` and `mcp__linear__list_teams`, so the session
  isn't held up by prompts nobody is watching for.
- `prompt`, exactly:

  ```
  Create a new Linear issue with the title "Change to dark theme" and a description of "Let's change the app from black text on white background to a smooth dark theme with a dark grey background and very light (but not white) text." Once the issue is created, spin up a PR that resolves that issue and report back to the user the preview URL when it is ready.
  ```

Check that it started: `list_events` for the new session, with `kinds` of
`user` and `assistant`, should show the prompt and then work. A session whose
prompt wasn't delivered shows neither after about half a minute: send the
same prompt with `send_message` and `priority` `now`.

If you have no `create_session` (another coding agent, or not a cloud
session), skip the monitoring below, give the user the prompt above in a code
block, and have them start a new session on the Agent Environment with the
app's repo selected and paste it.

### 2. Tell the user, and ask

Say, briefly, as the last thing in your turn (ground rule 8):

- A second session has started (give its title), and it's an example of how
  the Linear integration works: it will create an issue in Linear, then a
  pull request for it, and report back a Preview link.
- That's how they'll work from now on: describe the work as an issue, then
  ask a session to take it. To work on an existing issue, start a session on
  the Agent Environment and say, for example, "Spin up a PR to address
  `<LINEAR_TEAM_KEY>`-123". They can also ask a session to file issues, or to
  say what's in the backlog.
- **Ask them to open that session, look at what it did, and tell you when
  they have.**

### 3. Until they confirm, keep watching

Don't wait in silence: the demo session reports nothing back by itself when
it succeeds. Where you have `send_later`, schedule a check a minute or two
out (and again after each check, until they confirm), then end your turn with
the question. At each check, `get_session` and `list_events` (`assistant`
and `result`) for the demo session, and look for the issue, the pull request
and the Preview URL (also in the PR's comment: use the GitHub tools).

- **They've confirmed:** stop checking, and delete any check you still have
  scheduled (`delete_trigger`). Go on to the playbook's closing points.
- **The demo session finished before they confirmed:** say so in this
  session, and explain how the first change went. State it as the flow:
  1. a **Linear** issue was created in their team (link it);
  2. a Claude session took it, worked on a **branch named by Linear**, and
     opened a **GitHub pull request** (link it);
  3. the pull request got a **Preview**: a live copy of the app with the
     change (share the Preview URL here too);
  4. when they **merge** the pull request, **Production** deploys from
     `main`, and Linear moves the issue along and closes it.

  Then keep waiting for their confirmation, without more checks.
- **It's stuck or failed** (waiting on a permission, an error, no PR): say
  what you see and that they can open the session to continue it. Don't
  start another or retry it silently.

Never merge the demo pull request yourself. It changes the app's look in
Production, so merging it, or closing it unmerged, is the user's choice. Say
so.

### 4. The rest

Then add to the playbook's closing points:

- Claude's issues and comments show as the user in Linear, signed `Claude
  Code`.
- Each pull request starts from a Linear issue and uses its branch name,
  which Linear's GitHub integration needs to link them. A new session starts
  on a `claude/...` branch, so `AGENTS.md` has Claude rename it to the
  issue's branch before the first push.
- GitHub Issues stay available but point to Linear.
- Any session started before the key was saved won't have the Linear tools:
  a new session fixes that.

## Limited network access

Nothing to add: saving the key through `request_credential` allows
`mcp.linear.app` on a Limited Agent Environment. The Linear website itself
(for the user's own steps) isn't reached by Claude.
