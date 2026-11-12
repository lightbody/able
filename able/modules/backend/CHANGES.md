# Changes to `backend`

Notes for apps that have this Module, newest first. `able/CHANGES.md`
says how to write an entry.

## 2026-11-12: One deploy step per feature

`deploy-backend` no longer knows about each service. It creates the Fly
app, runs one step per feature, then deploys. Each step stages its own Fly
secrets and appends its runtime settings to `$RUNNER_TEMP/backend.env`.

- **Why:** a feature that needs a secret or a setting at runtime adds one
  step, without editing the deploy command.
- **Touches:** `.github/actions/deploy-backend/`, and the calls to it in
  `backend.yml` and `preview.yml`.
- **Needs from you:** nothing. Check the first deploy after taking it.

## 2026-11-12: A hello route, and boot split by feature

`GET /hello` returns a greeting the page shows. `main.ts` and `server.ts`
now have one line per feature, with the details in each feature's own
file. Tests are split the same way.

- **Why:** proves the page can reach the API, and makes a feature easy to
  find, add or remove.
- **Touches:** `backend/src/main.ts`, `server.ts`, `routes/hello.ts`,
  `backend/test/`, `frontend/src/Hello.tsx`.
- **Needs from you:** nothing.
