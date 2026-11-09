import { cp, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await rm("dist-public", { recursive: true, force: true });
await mkdir("dist-public", { recursive: true });
execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.browser.json"], { stdio: "inherit" });
await cp("public", "dist-public", { recursive: true });
await cp("node_modules/hls.js/dist/hls.min.js", "dist-public/hls.min.js");
