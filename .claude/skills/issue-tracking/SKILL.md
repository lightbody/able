---
name: issue-tracking
description: Find, create and update this app's Linear issues, and work from an issue's own branch. Use when the user names a Linear issue or key, asks what to work on or to track or file work, or before starting a branch for a change. Also use when the Linear tools are missing from the session.
---

# Issue tracking in Linear

This app's work is tracked in Linear, not GitHub Issues. The workspace and
team are in `.github/deploy.env` (`LINEAR_WORKSPACE_URL`, `LINEAR_TEAM_KEY`).
Claude Code sessions reach Linear through its MCP server, registered in
`.mcp.json`. The server's name is `linear`, so its tools are
`mcp__linear__*`. The API key is the `<App Handle>-claude-code` Claude Code
Token for `mcp.linear.app`: the network proxy adds it, and it's never in the
repo or in your context.

## 1. Check you have the tools

The tools are deferred, so load their schemas before calling them:
`ToolSearch` with `select:mcp__linear__list_issues,mcp__linear__get_issue,mcp__linear__save_issue,mcp__linear__save_comment`,
or a keyword search for "linear". Don't rely on these names: the server's
tool names can change, so use what it lists.

**MCP servers load when a session starts.** A session that began before the
key was saved, or from a branch without `.mcp.json`, has no Linear tools and
never will. Saving the key mid-session doesn't change that. If the tools
aren't there, say so plainly and don't invent issues or results. The likely
causes, in order:

1. The session started before the key was saved on the Agent Environment
   (typical right after setup, or after adding this module). **Ask the user
   to start a new session** on the Agent Environment, from a branch that has
   `.mcp.json`.
2. The session's branch predates `.mcp.json`. The same fix: a new session
   from `main`, or from the branch that added it.
3. The tools exist but fail with 401: the key was revoked or replaced. The
   user rotates it (`SECRETS.md`).

To tell which, run `.claude/skills/issue-tracking/check-connection.sh`. It
reaches Linear through the proxy without the tools and lists the teams the
key can see. It's for diagnosis only: do the actual work with the tools, in
a session that has them.

## 2. Work from an issue

Every change that will become a pull request starts from an issue.

1. **Find it.** If the user gave a key (`ABC-123`), `get_issue`. Otherwise
   search the team's open issues first, so you don't file a duplicate.
2. **Or create it.** `save_issue` without an `id` creates one. Give it the
   team (`LINEAR_TEAM_KEY`), a clear title, and a description with what and
   why. Trivial fixes, like a typo, can skip the issue.
3. **Use Linear's branch name.** The issue's `gitBranchName` comes back from
   `get_issue` and `save_issue` (for example
   `sam/abc-12-add-chore-reminders`). Use it exactly. Don't build a name
   yourself: Linear clips long titles its own way, and its GitHub
   integration links the branch and PR to the issue by the key in the name.
4. **Get onto that branch before the first push.** Sessions start on a
   `claude/...` branch, and a session can't delete a pushed branch. So,
   before pushing anything:

   ```bash
   git branch -m "<gitBranchName>"
   git push -u origin "<gitBranchName>"
   ```

   This repo's guidance is the user's standing permission to push the
   issue's branch instead of the `claude/` one. If the `claude/` branch was
   already pushed, leave it, carry on from the issue's branch, and tell the
   user it's safe to delete.
5. **Open the PR as usual.** Linear's GitHub integration links it, moves the
   issue as the PR opens and merges, and closes it on merge. Don't move the
   issue's status by hand unless asked. In the PR's "Linear issue" line,
   repeat the key if the branch couldn't be renamed.

## 3. Issues and comments

- Search before you create. Keep one issue per change someone could review.
- The key belongs to a person, so what you write shows as them in Linear.
  End anything you create or comment with `Claude Code` so it's clear who
  wrote it.
- Issues and comments are visible to everyone in the workspace. Never put
  tokens, connection strings, or user data in them.
- Ask before changing or closing issues the user didn't mention, and before
  anything destructive.

## 4. Limits

Linear's free plan caps how many issues a workspace can hold. If creating
an issue fails because of a plan limit, show the user Linear's message as it
came back, and stop. Don't delete or archive issues to make room, and don't
look for a workaround.
