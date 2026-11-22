#!/bin/bash
# Proves one combination of modules: copies the repo, configures the copy as
# an app with those modules, then installs, builds, tests and lints it.
# CI runs this for every valid combination (.github/workflows/able.yml).
#
#   able/check.sh backend,auth      # or: none, or nothing for the full app
#
# Backend tests of a combination with postgres need Postgres on
# 127.0.0.1:5432 (database app_test), as `npm test --workspace=backend` does.
set -euo pipefail

modules="${1-}"
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
copy="$(mktemp -d)"
trap 'rm -rf "$copy"' EXIT

cd "$repo"
git ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' f; do
  [ -e "$f" ] || continue
  mkdir -p "$copy/$(dirname "$f")"
  cp -p "$f" "$copy/$f"
done

cd "$copy"
git init -q && git add -A
# Words that name the services of the modules this app won't have.
left_out="$(node -e '
  import("./able/lib.mjs").then(({ loadModules }) => {
    const arg = process.argv[1];
    const all = Object.entries(loadModules()).filter(([name]) => name !== "template");
    const keep = arg === "" ? all.map(([name]) => name) : arg === "none" ? [] : arg.split(",");
    console.log(all.filter(([name, mod]) => !keep.includes(name) && mod.mentions).map(([, mod]) => mod.mentions).join("|"));
  });
' "$modules")"
if [ -n "$modules" ]; then
  node able/configure.mjs --name "Todoable" --handle todoable --able-commit 0123abc --modules "$modules"
else
  node able/configure.mjs --name "Todoable" --handle todoable --able-commit 0123abc
fi

fail() { echo "able/check.sh: $*" >&2; exit 1; }

git add -A
if git grep -n -E "able:(begin|end|only)" -- . > /dev/null; then
  git grep -n -E "able:(begin|end|only)" -- . >&2
  fail "module markers are left"
fi
if git grep -n -i -E "myapp|my app" -- . > /dev/null; then
  git grep -n -i -E "myapp|my app" -- . >&2
  fail "placeholder names are left"
fi
if [ -n "$left_out" ] && git grep -n -i -E "$left_out" -- . ':!package-lock.json' > /dev/null; then
  git grep -n -i -E "$left_out" -- . ':!package-lock.json' >&2
  fail "the app still mentions a module it doesn't have (mark those lines in the template)"
fi
grep -q "Learned up to:\*\* 0123abc" ABLE.md || fail "ABLE.md doesn't record the Able commit"
[ ! -e able ] && [ ! -e PLAYBOOK.md ] && [ ! -e site ] || fail "Able's own files are left"

npm install --no-audit --no-fund > /dev/null
if [ -d shared ]; then
  npm run build --workspace=shared
  npm test --workspace=shared
fi
if [ -d backend ]; then
  npm run build --workspace=backend
  npm test --workspace=backend
fi
npm run build --workspace=frontend

for f in .github/workflows/*.yml .github/actions/*/action.yml; do
  [ -e "$f" ] || continue
  node -e '
    const text = require("fs").readFileSync(process.argv[1], "utf8");
    if (/\t/.test(text)) { console.error(process.argv[1] + ": tab in YAML"); process.exit(1); }
  ' "$f"
done
if command -v actionlint > /dev/null; then
  actionlint
fi
bash -n .claude/hooks/session-start.sh

echo "able/check.sh: ok (${modules:-full app})"
