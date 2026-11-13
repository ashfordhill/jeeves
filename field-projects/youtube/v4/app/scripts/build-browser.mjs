// The browser (V3-16), from v2's build-browser.mjs: compiles browser/ and copies public/ and hls.js
// into dist-public/, which the edge serves at its origin, then writes the sign-in binding for this
// run's ports. `pnpm first-run` and `pnpm start` run it first. The folder itself is kept, because
// the edge mounts it; only its contents are replaced.
import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { writeBrowserConfiguration } from "./browser-config.mjs";
import { plan } from "./common.mjs";

await mkdir("dist-public", { recursive: true });
for (const name of await readdir("dist-public"))
  await rm(`dist-public/${name}`, { recursive: true, force: true });
execFileSync("node_modules/.bin/tsc", ["-p", "tsconfig.browser.json"], { stdio: "inherit" });
await cp("public", "dist-public", { recursive: true });
await cp("node_modules/hls.js/dist/hls.min.js", "dist-public/hls.min.js");
writeBrowserConfiguration(plan, process.env);
console.log("Browser built into dist-public/.");
