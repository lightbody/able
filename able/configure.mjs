#!/usr/bin/env node
// Turns the Able template into an app's own repo. PLAYBOOK.md step 8 runs
// it. See able/README.md for the convention.
//
//   node able/configure.mjs --name "Todoable" --handle todoable
//   node able/configure.mjs --name "Todoable" --handle todoable --modules backend,auth
//   node able/configure.mjs ... --able-commit <the Able commit this repo was made from>
//
// It removes the modules the app doesn't want (and always Able's own files,
// the `template` module), strips every module marker from what's left,
// renames the placeholders `My App` and `myapp`, and writes ABLE.md, the
// app's record of what it has learned from Able. Without --modules the app
// keeps every module; `--modules none` makes a static site. Without --name
// and --handle the placeholders stay.
//
// It edits the working tree and commits nothing. Run `npm install` after it,
// to bring the lockfile in line. It deletes able/, itself included, so it
// runs once.

import { existsSync, readdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BEGIN, END, ONLY, isText, loadModules, ownersOf, root, trackedFiles } from "./lib.mjs";

const modules = loadModules();
const optional = Object.keys(modules).filter((name) => name !== "template");

function usage(problem) {
  console.error(problem);
  console.error(
    `usage: node able/configure.mjs [--name "<App Name>" --handle <app-handle>] [--modules ${optional.join(",")} | none] [--able-commit <sha>]`,
  );
  process.exit(2);
}

const options = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const key = /^--(name|handle|modules|able-commit)$/.exec(args[i])?.[1];
  if (!key || args[i + 1] === undefined) usage(`Unexpected argument "${args[i]}".`);
  options[key] = args[i + 1];
}
if ((options.name === undefined) !== (options.handle === undefined)) usage("Give --name and --handle together.");
if (options.handle !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(options.handle)) {
  usage(`The App Handle "${options.handle}" must be lowercase letters, digits and hyphens.`);
}

const keep = new Set(
  options.modules === undefined
    ? optional
    : options.modules === "none"
      ? []
      : options.modules.split(",").map((s) => s.trim()).filter(Boolean),
);
for (const name of keep) {
  if (!optional.includes(name)) usage(`Unknown module "${name}".`);
  for (const dep of modules[name].requires) {
    if (!keep.has(dep)) usage(`Module "${name}" requires "${dep}". Add it, or leave "${name}" out.`);
  }
}
// A marker can name several modules, separated by commas: it needs them all.
const kept = (names) => names.split(",").every((name) => keep.has(name));

/** Drops removed modules' regions and strips the markers of kept ones. */
function strip(text) {
  const out = [];
  const open = []; // one entry per enclosing block: is its module kept?
  let removedSomething = false;
  for (const line of text.split("\n")) {
    const begin = BEGIN.exec(line);
    if (begin) {
      open.push(kept(begin[1]));
      removedSomething = true;
      continue;
    }
    if (END.test(line)) {
      open.pop();
      removedSomething = true;
      continue;
    }
    if (open.includes(false)) continue;
    const only = ONLY.exec(line);
    if (only && !kept(only[1])) {
      removedSomething = true;
      continue;
    }
    const cleaned = only ? line.slice(0, only.index) : line;
    // Don't leave a doubled blank line, or a leading one, where something was removed.
    const previousBlank = out.length === 0 || out[out.length - 1].trim() === "";
    if (cleaned.trim() === "" && previousBlank && removedSomething) continue;
    if (cleaned.trim() !== "") removedSomething = false;
    out.push(cleaned);
  }
  return out.join("\n");
}

let deleted = 0;
let edited = 0;
const emptied = new Set();
for (const file of trackedFiles()) {
  const full = path.join(root, file);
  if (!ownersOf(file, modules).every(kept)) {
    rmSync(full, { force: true });
    emptied.add(path.dirname(full));
    deleted += 1;
    continue;
  }
  if (!isText(file)) continue;
  const before = readFileSync(full, "utf8");
  const after = strip(before);
  if (after !== before) {
    writeFileSync(full, after);
    edited += 1;
  }
}

// Remove folders the deletions left empty.
for (let dir of emptied) {
  while (dir.startsWith(root) && dir !== root) {
    try {
      if (readdirSync(dir).length > 0) break;
      rmdirSync(dir);
    } catch {
      break;
    }
    dir = path.dirname(dir);
  }
}

// --- What markers can't express: JSON has no comments ---
function editJson(file, edit) {
  const full = path.join(root, file);
  if (!existsSync(full)) return;
  const json = JSON.parse(readFileSync(full, "utf8"));
  edit(json);
  writeFileSync(full, `${JSON.stringify(json, null, 2)}\n`);
}

for (const [name, mod] of Object.entries(modules)) {
  if (kept(name)) continue;
  for (const [workspace, packages] of Object.entries(mod.npm)) {
    editJson(`${workspace}/package.json`, (pkg) => {
      for (const group of ["dependencies", "devDependencies"]) {
        for (const dep of Object.keys(pkg[group] ?? {})) {
          if (packages.some((p) => (p.endsWith("*") ? dep.startsWith(p.slice(0, -1)) : dep === p))) {
            delete pkg[group][dep];
          }
        }
      }
    });
  }
}
if (!kept("backend")) {
  editJson("package.json", (pkg) => {
    pkg.workspaces = pkg.workspaces.filter((w) => w !== "shared" && w !== "backend");
  });
  editJson("frontend/tsconfig.json", (tsconfig) => {
    delete tsconfig.compilerOptions.paths;
    delete tsconfig.compilerOptions.baseUrl;
  });
}
if (!kept("observability")) {
  editJson("backend/package.json", (pkg) => {
    for (const script of ["start", "dev"]) {
      pkg.scripts[script] = pkg.scripts[script].replace(/ --import \S*telemetry\.[jt]s/, "");
    }
  });
}

// --- ABLE.md: the app's record of what it has learned from Able ---
const commit = options["able-commit"];
if (commit !== undefined && !/^[0-9a-f]{7,40}$/.test(commit)) usage(`"${commit}" isn't a commit id.`);
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  path.join(root, "ABLE.md"),
  `# Learned from Able

This app was made from Able, a template. Nothing in it depends on Able:
this repo is the source of truth. Able keeps improving, though, and this
file is the app's record of what it has taken from it so far.

To bring over what's new, ask your coding agent to "pull latest Able". It
looks at what changed in Able since the commit below, walks you through
each change, and opens a pull request with the ones you take. The same
goes for adding one of Able's Modules later. The steps it follows are in
\`.claude/skills/able/SKILL.md\`.

- **Source:** https://github.com/lightbody/able
- **Learned up to:** ${commit ?? "unknown (find the Able commit this app was made from, and put it here)"} (${today})
- **Modules:** ${[...keep].join(", ") || "none"}
- **Deferred:** none
`,
);

// --- The app's own names ---
let renamed = 0;
if (options.name !== undefined) {
  for (const file of trackedFiles()) {
    if (!isText(file) && file !== "package-lock.json") continue;
    const full = path.join(root, file);
    const before = readFileSync(full, "utf8");
    const after = before.replaceAll("My App", options.name).replaceAll("myapp", options.handle);
    if (after !== before) {
      writeFileSync(full, after);
      renamed += 1;
    }
  }
}

console.log(`Modules: ${[...keep].join(", ") || "(none: a static site)"}.`);
console.log(`Deleted ${deleted} files and edited ${edited}. No module markers are left.`);
if (options.name !== undefined) {
  console.log(`Renamed the app to "${options.name}" (${options.handle}) in ${renamed} files.`);
}
console.log("Next: npm install, then build and test.");
