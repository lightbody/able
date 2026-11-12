# Changes to Able's core

Notes for apps made from Able, newest first. The core is everything no
Module owns: the frontend on Cloudflare Pages, Previews, the workflows'
shared parts and the agent's guidance files. Each Module keeps its own
notes in `able/modules/<name>/CHANGES.md`.

An app's agent reads these when its owner asks to "pull latest Able"
(`.claude/skills/able/SKILL.md`). Write each entry for that reader and
the app's owner:

- a dated heading that says what changed
- **Why:** what it's for, and when an app would or wouldn't want it
- **Touches:** the files or areas it changes in an app
- **Needs from you:** anything the owner must do (a token, an account, a
  dashboard setting, a value in `.github/deploy.env`), or "nothing"

## 2026-11-12: Modules, and learning from Able

Able is now built from Modules, and an app can pull in what's new.

- **Why:** an app can take only the parts it needs, add a Module later,
  and keep learning from Able without depending on it.
- **Touches:** `ABLE.md` (new: the app's record of what it has learned),
  `.claude/skills/able/` (new: how to pull in changes and add Modules), a
  "Learning from Able" section in `AGENTS.md`, and a hello-world page
  where each feature adds one line (`frontend/src/App.tsx`).
- **Needs from you:** nothing.

## 2026-11-12: Preview cleanup passes the branch name as data

`preview.yml`'s cleanup step handed the pull request's branch name and the
Cloudflare token to its script by pasting them into the script text. It
now passes both through the environment.

- **Why:** a branch name is text someone chose. Pasted into a script, a
  crafted name could run as code in a job that holds a deploy token.
- **Touches:** `.github/workflows/preview.yml`, the "Delete Cloudflare
  Pages preview deployments" step.
- **Needs from you:** nothing.
