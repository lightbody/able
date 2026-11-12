// Shared by Able's own tooling: reads the module manifests
// (able/modules/<name>/MODULE.md) and finds the module markers in files.
// See able/README.md for the convention.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OPEN = String.raw`(?:\/\/|#|<!--|\{\/\*|\/\*)`;
const CLOSE = String.raw`(?:-->|\*\/\}|\*\/)?`;
const NAME = String.raw`([a-z][a-z-]*)`;
export const BEGIN = new RegExp(String.raw`^\s*${OPEN}\s*able:begin ${NAME}\s*${CLOSE}\s*$`);
export const END = new RegExp(String.raw`^\s*${OPEN}\s*able:end\s*${CLOSE}\s*$`);
export const ONLY = new RegExp(String.raw`\s*${OPEN}\s*able:only ${NAME}\s*${CLOSE}\s*$`);
/** Anything that looks like a marker, well formed or not. */
export const ANY = /able:(begin|end|only)\b/;

/** Files that describe the markers rather than use them. */
export function describesMarkers(file) {
  return file === "PLAYBOOK.md" || file.startsWith("able/");
}

/** { name: { requires: string[], files: string[] } } for every module. */
export function loadModules() {
  const modules = {};
  const dir = path.join(root, "able/modules");
  for (const name of readdirSync(dir).sort()) {
    const manifest = path.join(dir, name, "MODULE.md");
    if (!existsSync(manifest)) continue;
    const text = readFileSync(manifest, "utf8");
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    const field = (key) => new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(front)?.[1].trim() ?? "";
    const section = /^## Files\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1] ?? "";
    modules[name] = {
      declaredName: field("module"),
      requires: field("requires").split(",").map((s) => s.trim()).filter(Boolean),
      files: [...section.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]),
    };
  }
  return modules;
}

/** The repo's files (tracked, or new and not ignored), relative to the repo root. */
export function trackedFiles() {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  return [...new Set(listed.split("\0").filter(Boolean))].filter((file) => existsSync(path.join(root, file)));
}

/** The module that owns a file (the most specific path listed wins), or undefined for core. */
export function ownerOf(file, modules) {
  let best;
  for (const [name, mod] of Object.entries(modules)) {
    for (const entry of mod.files) {
      const hit = entry.endsWith("/") ? file.startsWith(entry) : file === entry;
      if (hit && (!best || entry.length > best.entry.length)) best = { name, entry };
    }
  }
  return best?.name;
}

export function isText(file) {
  return !/\.(png|jpg|jpeg|gif|ico|woff2?|pdf)$/i.test(file) && file !== "package-lock.json";
}
