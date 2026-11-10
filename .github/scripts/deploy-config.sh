#!/bin/bash
# Reads .github/deploy.env, whose values are grouped into modules:
#
#   # @module neon required
#   NEON_PROJECT_ID=...
#   # @module grafana optional
#   GRAFANA_STACK_URL=...
#
# Every KEY=VALUE line belongs to the module declared above it. A module is
# "on" when all of its values are filled in, and "off" otherwise.
#
# - A **required** module that's off means the app isn't set up yet (the
#   empty template, or a new app mid-setup): deploys skip themselves.
# - An **optional** module (observability today; billing and others later)
#   that's off is simply not used. If it's only partly filled in, it still
#   counts as off -- with a warning -- so nothing ever runs half-configured.
#
# Usage:
#   deploy-config.sh check   GitHub Actions outputs: configured=true|false,
#                            modules=<space-separated optional modules that are on>
#   deploy-config.sh load    KEY=VALUE lines for $GITHUB_ENV: every value of
#                            every module that's on, plus DEPLOY_MODULES. Values
#                            of modules that are off aren't loaded, so a
#                            workflow can test a module's key to see if it's on.
#
# DEPLOY_ENV_FILE overrides the file (for testing).
set -euo pipefail

mode="${1:-}"
file="${DEPLOY_ENV_FILE:-$(dirname "${BASH_SOURCE[0]}")/../deploy.env}"
[ -f "$file" ] || { echo "deploy-config: no $file" >&2; exit 1; }

declare -a order=()
declare -A kind=() filled=() empty=() lines=()
current=""
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1))
  if [[ "$line" =~ ^#[[:space:]]*@module[[:space:]]+([a-z0-9_-]+)[[:space:]]+(required|optional)[[:space:]]*$ ]]; then
    current="${BASH_REMATCH[1]}"
    [ -z "${kind[$current]:-}" ] || { echo "deploy-config: module '$current' declared twice ($file:$lineno)" >&2; exit 1; }
    kind[$current]="${BASH_REMATCH[2]}"
    order+=("$current")
    filled[$current]=""; empty[$current]=""; lines[$current]=""
    continue
  fi
  [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
  [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || { echo "deploy-config: not KEY=VALUE ($file:$lineno): $line" >&2; exit 1; }
  [ -n "$current" ] || { echo "deploy-config: ${BASH_REMATCH[1]} is outside any '# @module' block ($file:$lineno)" >&2; exit 1; }
  key="${BASH_REMATCH[1]}"
  value="$(sed -e 's/[[:space:]]*$//' <<<"${BASH_REMATCH[2]}")"
  if [ -n "$value" ]; then
    filled[$current]+="$key "
    lines[$current]+="$key=$value"$'\n'
  else
    empty[$current]+="$key "
  fi
done < "$file"

configured=true
on_modules=()
for m in "${order[@]}"; do
  missing="${empty[$m]% }"
  if [ -z "$missing" ]; then
    [ "${kind[$m]}" = optional ] && on_modules+=("$m")
    continue
  fi
  if [ "${kind[$m]}" = required ]; then
    configured=false
    [ "$mode" = check ] && echo "::notice::Skipping deploys: required module '$m' has no value for: $missing"
  elif [ -n "${filled[$m]}" ] && [ "$mode" = check ]; then
    echo "::warning::Optional module '$m' is only partly filled in, so it's off. No value for: $missing"
  fi
done

case "$mode" in
  check)
    echo "configured=$configured" >> "${GITHUB_OUTPUT:-/dev/stdout}"
    echo "modules=${on_modules[*]}" >> "${GITHUB_OUTPUT:-/dev/stdout}"
    ;;
  load)
    for m in "${order[@]}"; do
      if [ -z "${empty[$m]}" ] || [ "${kind[$m]}" = required ]; then
        printf '%s' "${lines[$m]}"
      fi
    done
    echo "DEPLOY_MODULES=${on_modules[*]}"
    ;;
  *)
    echo "usage: deploy-config.sh check|load" >&2
    exit 2
    ;;
esac
