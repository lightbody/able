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

/** The body of a "## <title>" section of a manifest. */
function sectionOf(text, title) {
  return new RegExp(`^## ${title}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text)?.[1] ?? "";
}

/** { name: { requires, files, npm: { workspace: packages[] } } } for every module. */
export function loadModules() {
  const modules = {};
  const dir = path.join(root, "able/modules");
  for (const name of readdirSync(dir).sort()) {
    const manifest = path.join(dir, name, "MODULE.md");
    if (!existsSync(manifest)) continue;
    const text = readFileSync(manifest, "utf8");
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    const field = (key) => new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(front)?.[1].trim() ?? "";
    const section = sectionOf(text, "Files");
    modules[name] = {
      declaredName: field("module"),
      requires: field("requires").split(",").map((s) => s.trim()).filter(Boolean),
      files: [...section.matchAll(/^- `([^`]+)`/gm)].map((m) => m[1]),
      // "## npm dependencies": one bullet per workspace, its name first, then
      // the packages (a trailing * matches a whole scope).
      npm: Object.fromEntries(
        [...sectionOf(text, "npm dependencies").matchAll(/^- `([^`]+)`:(.*(?:\n  .*)*)/gm)].map((m) => [
          m[1],
          [...m[2].matchAll(/`([^`]+)`/g)].map((p) => p[1]),
        ]),
      ),
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

/**
 * The modules a file needs: every module that lists the file or a folder
 * containing it. Empty for core files.
 */
export function ownersOf(file, modules) {
  const owners = [];
  for (const [name, mod] of Object.entries(modules)) {
    if (mod.files.some((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry))) {
      owners.push(name);
    }
  }
  return owners;
}

export function isText(file) {
  return !/\.(png|jpg|jpeg|gif|ico|woff2?|pdf)$/i.test(file) && file !== "package-lock.json";
}
