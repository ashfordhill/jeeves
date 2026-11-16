import { execFileSync } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withStubWorkloads } from "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-workload/design.ts";
import { stubStackDesign } from "/home/ash/github/jeeves/jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "/home/ash/github/jeeves/jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { exportNewDirectory } from "/home/ash/github/jeeves/jeeves-generator/src/export.ts";
import { assembleV2 } from "/home/ash/github/jeeves/jeeves-generator/src/v2/assemble.ts";
import {
  offDesigns,
  offPin,
} from "/home/ash/github/jeeves/jeeves-generator/src/v2/fixtures/processes-off.ts";
import { loadLocalV2Registry } from "/home/ash/github/jeeves/jeeves-generator/templates/local-v2/index.ts";

(async () => {
  const registry = loadLocalV2Registry();
  const designs = {
    video: JSON.stringify(
      runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [
        { type: "setRunnableProcesses", on: true },
      ]),
    ),
    stubs: JSON.stringify(
      runStudioCommands(withStubWorkloads(stubStackDesign()), [
        { type: "setRunnableProcesses", on: true },
      ]),
    ),
    ...offDesigns(registry),
  };
  const root = await mkdtemp("/tmp/jeeves-rg11-emitted-");
  try {
    for (const [name, designJson] of Object.entries(designs)) {
      const bundle = assembleV2({ designJson }, registry),
        app = join(root, name);
      await exportNewDirectory(bundle.files, app);
      await symlink("/home/ash/github/qrwty/app/node_modules", join(app, "node_modules"));
      const check = () =>
        execFileSync(process.execPath, [join(app, "scripts/check-extensions.mjs"), app], {
          cwd: app,
          encoding: "utf8",
          stdio: "pipe",
        });
      const tsc = () =>
        execFileSync(
          process.execPath,
          [join(app, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", app],
          { cwd: app, encoding: "utf8", stdio: "pipe" },
        );
      try {
        console.log(name, bundle.files.length, "files");
        console.log(check());
        console.log(tsc());
      } catch (cause) {
        const e = cause as { stdout?: unknown; stderr?: unknown };
        console.log(e.stdout, e.stderr);
        process.exitCode = 1;
      }
      if (name === "stubs" && !process.exitCode) {
        const negative = join(app, "src/modules/links-api/negative.ts");
        await writeFile(
          negative,
          'import {createValkeyCache,ADMIT_WINDOW,SET_IF_NEWER} from "../../extension-api/index.ts";\nimport type {CacheClient} from "../../extension-api/index.ts";\nexport function bad(c:CacheClient){c.admit("key",{limit:1,windowMs:1});c.setIfNewer("key",{version:"1",value:"x",validUntil:1});c.getVersioned("key");c.eval("code");c.sendCommand([]);c.socket;c.client;}\n',
        );
        try {
          tsc();
          throw Error("Negative cache API compiled");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout);
          console.log("Negative public API:", out);
          for (const word of [
            "createValkeyCache",
            "ADMIT_WINDOW",
            "SET_IF_NEWER",
            "admit",
            "setIfNewer",
            "getVersioned",
            "eval",
            "sendCommand",
            "socket",
            "client",
          ])
            if (!out.includes(word)) process.exitCode = 1;
        }
        await writeFile(
          negative,
          'import {createValkeyCache} from "../../runtime/valkey.ts"; export const bad=createValkeyCache;\n',
        );
        try {
          check();
          throw Error("Private cache import passed");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout) + String(e.stderr);
          console.log("Private boundary:", out);
          if (!out.includes("valkey.ts")) process.exitCode = 1;
        }
        await rm(negative);
      }
    }
    const previous = JSON.parse(
      execFileSync("git", ["show", "HEAD:jeeves-generator/src/v2/fixtures/processes-off.json"], {
        encoding: "utf8",
      }),
    );
    const next = Object.fromEntries(
      Object.entries(offDesigns(registry)).map(([name, design]) => [
        name,
        offPin(design, registry),
      ]),
    );
    const review = Object.fromEntries(
      Object.entries(next).map(([name, pin]) => [
        name,
        {
          before: previous[name].files,
          after: pin.files,
          added: Object.keys(pin.sha256).filter((p) => !previous[name].sha256[p]),
          removed: Object.keys(previous[name].sha256).filter((p) => !pin.sha256[p]),
          changed: Object.keys(pin.sha256).filter(
            (p) => previous[name].sha256[p] && pin.sha256[p] !== previous[name].sha256[p],
          ),
        },
      ]),
    );
    await writeFile("/tmp/jeeves-rg11-pins-review.json", `${JSON.stringify(review, null, 2)}\n`);
    console.log("Pin review", review);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
})();
