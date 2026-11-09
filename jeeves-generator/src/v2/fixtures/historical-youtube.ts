import { existsSync, readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";

// Regression consumer only: product policy lives in the retained field application, never
// in the active template registry. Exercise it against the current generic mechanisms.
const requireServer = createRequire(
  new URL("../../../../jeeves/apps/server/package.json", import.meta.url),
);
const urls = new Map<string, string>();
export function historicalYouTubeModule(name: string): string {
  const cached = urls.get(name);
  if (cached) return cached;
  const base = name.startsWith("runtime/")
    ? new URL(`../../../templates/local-v2/assets/src/${name}.ts`, import.meta.url)
    : new URL(`../../../../field-projects/youtube/v2/app/src/${name}.ts`, import.meta.url);
  const code = stripTypeScriptTypes(
    readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8"),
  )
    .replace(
      /from "(\.\.?\/.+)\.ts"/g,
      (_match, dep: string) =>
        `from "${historicalYouTubeModule(posix.normalize(`${posix.dirname(name)}/${dep}`))}"`,
    )
    .replace('from "zod"', `from "${import.meta.resolve("zod")}"`)
    .replace('from "fastify"', `from "${pathToFileURL(requireServer.resolve("fastify")).href}"`);
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  urls.set(name, url);
  return url;
}
