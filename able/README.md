# How Able is put together

This folder exists only in the Able template. Setup removes it from a new
app, along with `PLAYBOOK.md`.

Able is one complete, working app. Everything beyond a static frontend is
grouped into **modules**, so a new app can take only the ones it wants:

| Module | Provider | Requires |
|---|---|---|
| `backend` | Fly.io | |
| `auth` | WorkOS AuthKit | `backend` |
| `postgres` | Neon, with Neon Realtime | `backend`, `auth` |
| `observability` | Grafana Cloud | |
| `custom-domain` | Cloudflare (setup steps only, no code) | |
| `template` | Able's own files, removed from every new app | |

The core, which every app has, is whatever no module claims: the React
frontend on Cloudflare Pages, a Preview for every pull request, and the
agent's guidance files.

## A module is whole files plus a few marked lines

Each module has a folder here, `able/modules/<name>/`, with a `MODULE.md`
that lists the files it owns and what else it brings. A path listed there
belongs to that module; where two modules list overlapping paths, the more
specific one wins (`backend/` is `backend`'s, but `backend/src/auth.ts` is
`auth`'s).

Shared files mark the places a module touches, with comments in the file's
own comment syntax:

```ts
// able:begin postgres
const db = await initDb(path.join(backendRoot, "migrations"));
log.info("migrations applied");
// able:end

registerMeRoutes(app, ctx); // able:only auth
```

- **Block:** a line holding only `able:begin <module>` in a comment, down
  to the next line holding only `able:end`. Blocks can nest.
- **Line:** a comment `able:only <module>` at the end of a line. Use it for
  single lines, and for table rows, where a comment line would break the
  table. In JSX, write `{/* able:only auth */}`.
- A marker inside a file that a module owns needs both: the file's module
  and the marker's.

Removing a module means deleting its files and its marked regions. Keeping
one means deleting only the marker comments. Either way, an app ends up
with no markers at all.

## Rules for changing Able

- **Keep markers few.** Give each module one registration line in a shared
  file, and put the rest in files the module owns. If a file collects many
  markers, split it.
- **A new file belongs to a module unless it's core.** Add it to that
  module's `MODULE.md`.
- **JSON can't hold comments.** `MODULE.md` lists the npm dependencies and
  other JSON edits a module needs.
- **Run `node able/lint.mjs`** before committing. CI runs it too
  (`.github/workflows/able.yml`).
