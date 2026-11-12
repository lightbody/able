#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: gets the container ready
# to build and test the app. Idempotent.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install --no-audit --no-fund
# able:begin backend
# backend consumes shared's compiled dist/.
npm run build --workspace=shared
# able:end

# able:begin postgres
# A throwaway local Postgres, so `npm test --workspace=backend` works. The
# cloud containers have Postgres binaries but no running Docker daemon, so
# docker-compose isn't an option there.
# --- Postgres, matching backend/test/postgres.test.ts's default DATABASE_URL ---
PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n1 || true)"
if [ -z "$PG_BIN" ]; then
  echo "session-start: no Postgres binaries found; backend tests will need a DATABASE_URL" >&2
  exit 0
fi

if ! "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p 5432; then
  id postgres >/dev/null 2>&1 || useradd --system --create-home postgres
  PGDATA="$(getent passwd postgres | cut -d: -f6)/app-pgdata"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    su postgres -c "'$PG_BIN/initdb' -D '$PGDATA' -U postgres --auth=trust" >/dev/null
  fi
  su postgres -c "'$PG_BIN/pg_ctl' -D '$PGDATA' -l '$PGDATA/server.log' -o \"-k /tmp -c listen_addresses=127.0.0.1\" start" >/dev/null
  for _ in $(seq 1 30); do
    "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p 5432 && break
    sleep 1
  done
fi

psql -h 127.0.0.1 -U postgres -qtAc "ALTER USER postgres PASSWORD 'password'"
if [ "$(psql -h 127.0.0.1 -U postgres -qtAc "SELECT 1 FROM pg_database WHERE datname = 'app_test'")" != "1" ]; then
  psql -h 127.0.0.1 -U postgres -qc "CREATE DATABASE app_test"
fi
# able:end
