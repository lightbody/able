---
module: observability
provider: Grafana Cloud
requires:
---

# observability

Telemetry to a Grafana Stack: Grafana Faro from the frontend, and
OpenTelemetry traces, metrics and logs from the backend when there is one.
It also brings `scripts/gcx` and the `observability` skill, which sessions
use to query it.

## Files

- `backend/src/telemetry.ts`
- `backend/src/observability.ts`
- `frontend/src/telemetry.ts`
- `observability/`
- `scripts/`
- `.claude/skills/observability/`
- `.github/actions/observability-stage/`

## npm dependencies

- `backend`: `@opentelemetry/*`
- `frontend`: `@grafana/faro-web-sdk`, `@grafana/faro-web-tracing`,
  `@opentelemetry/api`

## Edits markers can't express

- `backend/package.json`: the `--import ./dist/telemetry.js` and
  `--import ./src/telemetry.ts` flags in the `start` and `dev` scripts.

## Deploy

- `deploy.env`: `GRAFANA_STACK_URL`, `GRAFANA_OTLP_ENDPOINT`,
  `GRAFANA_OTLP_INSTANCE_ID`, `GRAFANA_FARO_URL`.
- CI Token: `GRAFANA_OTLP_TOKEN`. Claude Code Token host: the Grafana
  Stack's.
- `observability-stage` turns on the backend's export. The frontend build
  reads `GRAFANA_FARO_URL`.
