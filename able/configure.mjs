#!/usr/bin/env node
// Turns the Able template into an app's own repo: removes the modules the
// app doesn't want (and always Able's own files, the `template` module),
// and strips every module marker from what's left. PLAYBOOK.md step 8 runs
// it. See able/README.md for the convention.
//
//   node able/configure.mjs                      # the full app
//   node able/configure.mjs --modules backend    # only these modules
//
// It edits the working tree and commits nothing. It deletes able/, itself
// included, so it runs once.

import { readdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BEGIN, END, ONLY, isText, loadModules, ownerOf, root, trackedFiles } from "./lib.mjs";

const modules = loadModules();
const optional = Object.keys(modules).filter((name) => name !== "template");

const args = process.argv.slice(2);
const flag = args.indexOf("--modules");
if (args.length > 0 && (flag !== 0 || args.length !== 2)) {
  console.error(`usage: node able/configure.mjs [--modules ${optional.join(",")}]`);
  process.exit(2);
}
const keep = new Set(flag === 0 ? args[1].split(",").map((s) => s.trim()).filter(Boolean) : optional);

for (const name of keep) {
  if (!optional.includes(name)) {
    console.error(`Unknown module "${name}". Modules: ${optional.join(", ")}.`);
    process.exit(2);
  }
  for (const dep of modules[name].requires) {
    if (!keep.has(dep)) {
      console.error(`Module "${name}" requires "${dep}". Add it, or leave "${name}" out.`);
      process.exit(2);
    }
  }
}
const kept = (name) => keep.has(name);

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
  const owner = ownerOf(file, modules);
  const full = path.join(root, file);
  if (owner && !kept(owner)) {
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

console.log(`Modules: ${[...keep].join(", ") || "(none: a static site)"}.`);
console.log(`Deleted ${deleted} files and edited ${edited}. No module markers are left.`);
