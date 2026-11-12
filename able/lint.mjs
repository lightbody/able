#!/usr/bin/env node
// Checks Able's module manifests and markers. Run from anywhere:
//   node able/lint.mjs
// See able/README.md for the convention it enforces.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ANY, BEGIN, END, ONLY, describesMarkers, isText, loadModules, ownerOf, root, trackedFiles } from "./lib.mjs";

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const modules = loadModules();
const names = Object.keys(modules);

// --- Manifests ---
const claimed = new Map();
for (const [name, mod] of Object.entries(modules)) {
  const manifest = `able/modules/${name}/MODULE.md`;
  if (mod.declaredName !== name) fail(manifest, `front matter says "module: ${mod.declaredName}", expected "${name}"`);
  for (const dep of mod.requires) {
    if (!names.includes(dep)) fail(manifest, `requires unknown module "${dep}"`);
  }
  for (const entry of mod.files) {
    if (!existsSync(path.join(root, entry))) fail(manifest, `lists ${entry}, which doesn't exist`);
    if (claimed.has(entry)) fail(manifest, `lists ${entry}, which ${claimed.get(entry)} also lists`);
    claimed.set(entry, name);
  }
}

// A module's dependencies, followed all the way down.
function allRequired(name, seen = new Set()) {
  for (const dep of modules[name]?.requires ?? []) {
    if (!seen.has(dep)) {
      seen.add(dep);
      allRequired(dep, seen);
    }
  }
  return seen;
}

// --- Markers ---
let markerCount = 0;
for (const file of trackedFiles()) {
  if (!isText(file) || describesMarkers(file)) continue;
  const owner = ownerOf(file, modules);
  const implied = owner ? new Set([owner, ...allRequired(owner)]) : new Set();
  const open = [];
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    if (!ANY.test(line)) return;
    markerCount += 1;
    const begin = BEGIN.exec(line);
    const only = ONLY.exec(line);
    const name = begin?.[1] ?? only?.[1];
    if (begin) {
      open.push({ name, where });
    } else if (END.test(line)) {
      if (!open.pop()) fail(where, "able:end without a matching able:begin");
    } else if (!only) {
      fail(where, "looks like a marker but isn't well formed (see able/README.md)");
      return;
    }
    if (name === undefined) return;
    if (!names.includes(name)) fail(where, `unknown module "${name}"`);
    else if (implied.has(name)) {
      fail(where, `redundant: this file belongs to ${owner}, which already needs ${name}`);
    } else if (open.slice(0, begin ? -1 : undefined).some((b) => b.name === name || allRequired(b.name).has(name))) {
      fail(where, `redundant: already inside a block that needs ${name}`);
    }
  });
  for (const block of open) fail(block.where, `able:begin ${block.name} is never closed`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s). See able/README.md.`);
  process.exit(1);
}
console.log(`able lint: ${names.length} modules, ${markerCount} markers, no problems.`);
