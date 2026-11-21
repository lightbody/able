---
module: issue-tracking
provider: Linear
requires:
mentions: linear\.app|LINEAR_|issue-tracking|issue tracking
---

# issue-tracking

Work tracked in Linear, which Claude Code sessions can read and update. It
registers Linear's hosted MCP server in `.mcp.json`, authenticated by an API
key saved as a network secret on the Agent Environment (no secret is ever in
the repo). It also brings the `issue-tracking` skill, a Linear-flavoured PR
template, and a GitHub Issues config that points to Linear.

**MCP servers load when a session starts.** The Linear tools exist only in
sessions that start after both `.mcp.json` and the key are in place. The
session that saves the key can reach Linear through the proxy
(`check-connection.sh`) but never gets the tools. Setup and "Adding a Module"
both end by saying so.

## Files

- `.mcp.json`
- `.claude/skills/issue-tracking/`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/`

## npm dependencies

None.

## Edits markers can't express

None. `.mcp.json` is JSON, so it can't carry markers: the module owns the
whole file, and another module that needs an MCP server later will have to
merge its entry into it.

## Deploy

- `deploy.env`: `LINEAR_WORKSPACE_URL`, `LINEAR_TEAM_KEY`. Neither is a secret.
  They must be filled in in the same change that adds the module, or the
  deploy-config check skips deploys while they're empty.
- No CI Token.
- Claude Code Token host: `mcp.linear.app`. Saving the key through
  `request_credential` also allows the host on a Limited Agent Environment.
