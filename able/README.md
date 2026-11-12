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

Each module has a folder here, `able/modules/<name>/`, with two files:

- `MODULE.md` lists the files the module owns and what else it brings.
- `SETUP.md` is the module's part of `PLAYBOOK.md`: one section per
  playbook step, which the playbook runs only for an app that has the
  module.

On the files: A file needs every
module that lists it or a folder containing it: `backend/src/telemetry.ts`
is listed by `observability` and sits in `backend/`, so it's kept only in
an app with both.

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
- A marker can name several modules, separated by commas
  (`able:only backend,observability`): the line needs all of them.
- Inside a fenced code block in Markdown, use the code's own comment
  syntax (`# able:only auth` in a shell block), since an HTML comment would
  show up in the rendered page.

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
- **Docs are marked too.** `README.md`, `AGENTS.md`, `SECRETS.md` and the
  skills carry markers, so an app's guidance never describes a service it
  doesn't have. `MODULE.md`'s `mentions:` line is a pattern for words that
  name the module's service; `able/check.sh` fails if an app without the
  module still contains one.
- **Setup steps for a service go in its module's `SETUP.md`,** not in
  `PLAYBOOK.md`, which holds only the core steps (GitHub, the Agent
  Environment, Cloudflare Pages).
- **Every combination has to build.** `able/check.sh <modules>` configures
  a copy of the repo as an app with those modules (`none` for a static
  site, nothing for the full app), then installs, builds, tests and lints
  it. CI runs it for all eight valid combinations. Removing lines can leave
  an import or a variable unused, which fails the build: when it does, move
  the code into a file the module owns.

## The scripts

- `able/configure.mjs` turns the template into an app's repo: it removes
  the modules the app doesn't want, strips the markers, edits the JSON
  files markers can't reach, and renames `My App` and `myapp`.
  `PLAYBOOK.md` step 8 runs it.
- `able/lint.mjs` checks the manifests and markers.
- `able/check.sh` proves one combination.
