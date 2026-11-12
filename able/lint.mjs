#!/usr/bin/env node
// Checks Able's module manifests and markers. Run from anywhere:
//   node able/lint.mjs
// See able/README.md for the convention it enforces.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ANY, BEGIN, END, ONLY, describesMarkers, isText, loadModules, ownersOf, root, trackedFiles } from "./lib.mjs";

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const modules = loadModules();
const names = Object.keys(modules);

// --- Manifests ---
for (const [name, mod] of Object.entries(modules)) {
  const manifest = `able/modules/${name}/MODULE.md`;
  if (mod.declaredName !== name) fail(manifest, `front matter says "module: ${mod.declaredName}", expected "${name}"`);
  for (const dep of mod.requires) {
    if (!names.includes(dep)) fail(manifest, `requires unknown module "${dep}"`);
  }
  for (const entry of mod.files) {
    if (!existsSync(path.join(root, entry))) fail(manifest, `lists ${entry}, which doesn't exist`);
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
  const owners = ownersOf(file, modules);
  const implied = new Set(owners.flatMap((owner) => [owner, ...allRequired(owner)]));
  const open = [];
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    if (!ANY.test(line)) return;
    markerCount += 1;
    const begin = BEGIN.exec(line);
    const only = ONLY.exec(line);
    const named = begin?.[1] ?? only?.[1];
    if (begin) {
      open.push({ names: named.split(","), where });
    } else if (END.test(line)) {
      if (!open.pop()) fail(where, "able:end without a matching able:begin");
    } else if (!only) {
      fail(where, "looks like a marker but isn't well formed (see able/README.md)");
      return;
    }
    for (const name of named?.split(",") ?? []) {
      const enclosing = open.slice(0, begin ? -1 : undefined).flatMap((b) => b.names);
      if (!names.includes(name)) fail(where, `unknown module "${name}"`);
      else if (implied.has(name)) {
        fail(where, `redundant: this file belongs to ${owners.join(" and ")}, which already needs ${name}`);
      } else if (enclosing.some((outer) => outer === name || allRequired(outer).has(name))) {
        fail(where, `redundant: already inside a block that needs ${name}`);
      }
    }
  });
  for (const block of open) fail(block.where, `able:begin ${block.names.join(",")} is never closed`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s). See able/README.md.`);
  process.exit(1);
}
console.log(`able lint: ${names.length} modules, ${markerCount} markers, no problems.`);
