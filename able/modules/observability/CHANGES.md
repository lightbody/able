# Changes to `observability`

Notes for apps that have this Module, newest first. `able/CHANGES.md`
says how to write an entry.

## 2026-11-12: Telemetry preloads through NODE_OPTIONS, with its own deploy step

The backend's Dockerfile sets `NODE_OPTIONS` to preload `telemetry.js`,
where the start command used to carry a flag. `observability-stage` is the
deploy step that turns export on.

- **Why:** the start command is the same with or without telemetry.
- **Touches:** `backend/Dockerfile`,
  `.github/actions/observability-stage/`, `deploy-backend`.
- **Needs from you:** nothing. After the first deploy, check telemetry
  still arrives.
