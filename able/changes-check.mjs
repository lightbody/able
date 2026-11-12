#!/usr/bin/env node
// Checks that a change to files apps receive comes with change notes:
// able/CHANGES.md for the core, able/modules/<name>/CHANGES.md for a
// module. Apps read those notes when they pull in what's new.
//
//   node able/changes-check.mjs <base ref>     e.g. origin/main

import { execFileSync } from "node:child_process";
import { loadModules, ownersOf, root } from "./lib.mjs";

const base = process.argv[2];
if (!base) {
  console.error("usage: node able/changes-check.mjs <base ref>");
  process.exit(2);
}
const changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const modules = loadModules();

const needed = new Set();
for (const file of changed) {
  const owners = ownersOf(file, modules);
  if (owners.includes("template")) continue;
  // A file several modules need is noted under the last one listed.
  needed.add(owners.length === 0 ? "able/CHANGES.md" : `able/modules/${owners[owners.length - 1]}/CHANGES.md`);
}
const missing = [...needed].filter((notes) => !changed.includes(notes));
if (missing.length > 0) {
  console.error("This change touches files that apps receive, without change notes. Add an entry to:");
  for (const notes of missing) console.error(`  ${notes}`);
  console.error("See able/CHANGES.md for how to write one.");
  process.exit(1);
}
console.log(`able changes-check: ${needed.size} set(s) of notes needed, all present.`);
