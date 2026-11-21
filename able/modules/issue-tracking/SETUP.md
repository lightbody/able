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
that has `.mcp.json`, has them. Do everything below through the proxy, and
tell the user about the new session at the end ("Done").

**Adding the Module to an existing app** (the `able` skill): do steps 2, 4,
5, 7 and 8 only, and "Done". Fill in `deploy.env` in the same pull request
as the Module's files, or deploys skip themselves while the values are
empty. The new session can start from the pull request's branch, or from
`main` once it's merged.

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
the workspace: its name becomes the address `https://linear.app/<slug>`.

Then the app's team. The user can create one for this app (**Settings →
Teams**) or choose an existing one. Ask for two values, in chat, since
neither is a secret:

1. **`LINEAR_WORKSPACE_URL`**: `https://linear.app/<slug>`.
2. **`LINEAR_TEAM_KEY`**: the team's identifier, the short uppercase prefix
   of its issues (`TODO` for `TODO-12`). It's shown when creating or editing
   the team.

Linear's free plan limits how many issues a workspace can hold. Say so in
one line, without going into detail: if a project reaches it, the
`issue-tracking` skill reports it and stops.

## Step 4: Claude Code Token

If `get_environment` shows a credential for `mcp.linear.app`, check it with
`.claude/skills/issue-tracking/check-connection.sh`: if it lists the app's
team, it's usable, and there's no new card.

**Linear key** (Read, Write, Create issues, Create comments; one team)

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

3. Under permissions, choose only what Claude needs: **Read**, **Write**,
   **Create issues** and **Create comments**. **Not Admin.** Linear's labels
   may differ a little: match them to this list rather than choosing full
   access.
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
Run `.claude/skills/issue-tracking/check-connection.sh`. It must say Linear
answered and that the app's team is there. If it reports 401 or no route,
wait about a minute and run it once more before asking the user to check
the key.

A key limited to one team lists only that team. If the script notes that
more teams are visible, the key wasn't limited to the app's team: have the
user make the key again with **Team access** set to the app's team, and
show a new card.

**Don't expect the Linear tools here**, as above. Nothing else needs
checking until a new session.

## Step 7: Dashboard setup

In Linear, with the user:

1. **Connect GitHub.** **Settings → Integrations → GitHub** → **Connect**,
   authorize it, and select this app's repo. This is what links a branch or
   pull request to the issue named by the key in its branch name, and moves
   the issue as work progresses.
2. **Automations.** In the same integration's settings, or the team's
   **Workflow** settings, turn on moving issues when a pull request opens and
   merges (to *In Progress* or *In Review*, then *Done*), and closing the
   issue on merge. The names vary: match them to what Linear shows.

There is no API for this, so the user does it. The first real check is the
first branch named after an issue: see "Done".

## Step 8: Make the code the user's app

1. Put the two Linear values in `.github/deploy.env`:
   `LINEAR_WORKSPACE_URL` and `LINEAR_TEAM_KEY`.
2. `.github/ISSUE_TEMPLATE/config.yml` links to `https://linear.app/<App
   Handle>` (the rename of `myapp`). If the workspace's slug differs from
   the App Handle, set it to `LINEAR_WORKSPACE_URL`.
3. `.mcp.json` and the `issue-tracking` skill stay as they are.

Checks: `node -e 'JSON.parse(require("fs").readFileSync(".mcp.json","utf8"))'`
succeeds, and `git grep -n -i "linear"` finds only what you expect.

## Step 12: Check the key's Baseline

The Linear key is already at its Baseline (Read, Write, Create issues and
Create comments, one team), so there's nothing to narrow. Run
`.claude/skills/issue-tracking/check-connection.sh` once more: it should list
only the app's team. If the user widened the key for a task, bring it back
to the Baseline the same way.

## Done

Tell the user, briefly:

- **The Linear tools arrive in their next session.** Start a new session on
  the Agent Environment with the app's repo selected, from `main` (or from the
  branch that has `.mcp.json`). This session can't have them. If a session
  ever says it has no Linear tools, the usual cause is that it started
  before the key was saved.
- Give them a first prompt for that session, filled in for the app, for
  example: "Check you have the Linear tools (the `issue-tracking` skill says
  how). Then create issues in the `<LINEAR_TEAM_KEY>` team for the first three
  things I want to build: …"
- Claude's issues and comments show as them in Linear, signed `Claude Code`.
- Each pull request should start from a Linear issue and use its branch
  name, which Linear's GitHub integration needs to link them. A new session
  starts on a `claude/...` branch, so `AGENTS.md` has Claude rename it to the
  issue's branch before the first push.
- GitHub Issues stay available but point to Linear.

## Limited network access

Nothing to add: saving the key through `request_credential` allows
`mcp.linear.app` on a Limited Agent Environment. The Linear website itself
(for the user's own steps) isn't reached by Claude.
