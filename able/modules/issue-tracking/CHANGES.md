# Changes to `issue-tracking`

Notes for apps that have this Module, newest first. `able/CHANGES.md`
says how to write an entry.

## 2026-11-21: New Module: issue tracking in Linear

Work is tracked in Linear, and Claude Code sessions can read and update it
through Linear's MCP server.

- **Why:** an app's issues, plans and branches live in one place that
  agents and people both use. Linear's free plan is enough to start, and
  its GitHub integration links branches and pull requests to issues.
- **Touches:** `.mcp.json` (new: registers Linear's MCP server, no secret),
  `.claude/skills/issue-tracking/` (new: how sessions use Linear, and a
  connection check), `.github/pull_request_template.md` and
  `.github/ISSUE_TEMPLATE/config.yml` (new: GitHub Issues point to Linear),
  `.github/deploy.env` (two values), and "Issue tracking" sections in
  `AGENTS.md`, `README.md` and `SECRETS.md`.
- **Needs from you:**
  - A Linear workspace and a team for the app, and their values in
    `.github/deploy.env`: `LINEAR_WORKSPACE_URL` and `LINEAR_TEAM_KEY`.
    Fill both in in the same pull request, or deploys skip themselves.
  - A Linear API key for Claude (Read, Write, Create issues and Create
    comments, no Admin, limited to the app's team), saved on the Agent
    Environment for the host `mcp.linear.app`, through a card. `SETUP.md`
    in Able has the steps. No CI token.
  - In Linear: connect the GitHub integration to the repo.
  - **A new session.** The Linear tools appear only in sessions that start
    after the pull request is merged (or from its branch) and the key is
    saved. The session that does the setup can't use them.
