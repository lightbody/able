#!/bin/bash
# Checks that Linear's MCP server answers through the network proxy, without
# using the MCP tools. A session that started before the Linear key was saved
# doesn't have the tools (MCP servers load when a session starts), but the
# proxy picks the key up within seconds, so this works in any session.
#
# Prints the teams the key can see. The Authorization header below is a
# placeholder: the proxy replaces it with the key saved for mcp.linear.app,
# so no secret is read, sent or printed here.
#
#   .claude/skills/issue-tracking/check-connection.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
want="$(sed -n 's/^LINEAR_TEAM_KEY=//p' "$root/.github/deploy.env" 2>/dev/null | head -1 | tr -d '[:space:]')"

url=https://mcp.linear.app/mcp
curl_args=(-sS -m 30
  -H "content-type: application/json"
  -H "accept: application/json, text/event-stream"
  -H "Authorization: Bearer proxy-injected")
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

code="$(curl "${curl_args[@]}" -D "$tmp/headers" -o "$tmp/body" -w '%{http_code}' "$url" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"check-connection","version":"1"}}}' \
  2>"$tmp/err" || true)"
case "$code" in
  200) ;;
  401)
    echo "Linear refused the request (401): no valid key for mcp.linear.app is saved on this Agent Environment, or it was revoked." >&2
    exit 1 ;;
  *)
    echo "Couldn't reach Linear's MCP server (HTTP ${code:-none}). $(head -c 200 "$tmp/err")" >&2
    echo "On a Limited Agent Environment, saving the key allows mcp.linear.app; check the environment's network secrets." >&2
    exit 1 ;;
esac

session="$(awk 'tolower($1)=="mcp-session-id:"{print $2}' "$tmp/headers" | tr -d '\r')"
session_args=()
[ -n "$session" ] && session_args=(-H "mcp-session-id: $session")

curl "${curl_args[@]}" "${session_args[@]}" -o /dev/null "$url" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
curl "${curl_args[@]}" "${session_args[@]}" -o "$tmp/teams" "$url" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_teams","arguments":{}}}'

# The reply is a server-sent event whose JSON carries the teams as an
# escaped string: pull out the team keys without printing anything else.
keys="$(grep -o '\\"key\\":\\"[A-Za-z0-9]*' "$tmp/teams" | sed 's/.*\\"//' | sort -u || true)"
if [ -z "$keys" ]; then
  echo "Linear answered, but no teams came back. Check the key can see the app's team." >&2
  exit 1
fi

echo "Linear answered. Teams this key can see: $(echo "$keys" | tr '\n' ' ')"
if [ -n "$want" ]; then
  if echo "$keys" | grep -qx "$want"; then
    echo "The app's team ($want) is there."
  else
    echo "The app's team ($want, from .github/deploy.env) is NOT among them." >&2
    exit 1
  fi
fi
if [ "$(echo "$keys" | wc -l)" -gt 1 ]; then
  echo "Note: more than one team is visible. A key limited to the app's team lists only that one."
fi
