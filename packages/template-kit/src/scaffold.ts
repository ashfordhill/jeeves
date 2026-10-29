import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import type { OutputFile } from "./contract.ts";

/**
 * Renders a template's scaffold directory into project-owned files under `targetDir`. Every
 * `{{name}}` in a file is replaced from `vars`; an unknown name throws, so typos can't ship.
 * Files are returned sorted by path.
 */
export function renderScaffold(
  sourceDir: string,
  targetDir: string,
  vars: Record<string, string> = {},
): OutputFile[] {
  return listFiles(sourceDir).map((file) => ({
    path: posix.join(targetDir, relative(sourceDir, file).split(sep).join("/")),
    contents: renderText(readFileSync(file, "utf8"), vars, file),
    ownership: "scaffold" as const,
  }));
}

export function renderText(text: string, vars: Record<string, string>, label = "text"): string {
  return text.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`${label}: no value for {{${name}}}`);
    return value;
  });
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    })
    .sort();
}
