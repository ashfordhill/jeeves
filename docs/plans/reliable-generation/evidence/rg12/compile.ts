import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { rateLimiterDesign } from "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-rate-limiter/design.ts";
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
    rateLimiter: JSON.stringify(rateLimiterDesign()),
    rateLimiterOff: JSON.stringify(
      runStudioCommands(rateLimiterDesign(), [{ type: "setRunnableProcesses", on: false }]),
    ),
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
  const root = await mkdtemp("/tmp/jeeves-rg12-emitted-");
  try {
    for (const [name, designJson] of Object.entries(designs)) {
      const bundle = assembleV2({ designJson }, registry),
        app = join(root, name);
      await exportNewDirectory(bundle.files, app);
      await symlink("/home/ash/github/qrwty/app/node_modules", join(app, "node_modules"));
      if (name === "rateLimiter") {
        for (const [input, output] of Object.entries({
          "create-item.ts": "src/modules/items-api/create-item.ts",
          "item.ts": "src/contracts/item.ts",
          "products.json": "infra/postgres/items-db/products.json",
          "0001-initial.sql":
            "infra/postgres/items-db/products/migrations/p_items_api_owner/0001-initial.sql",
          "create.sql": "infra/postgres/items-db/products/commands/create.sql",
        }))
          await writeFile(
            join(app, output),
            await readFile(
              "/home/ash/github/jeeves/field-projects/generator-system/fixtures/" +
                (input === "create-item.ts" ? "rg-rate-limiter/" : "rg-local-operation/") +
                input,
            ),
          );
        await writeFile(
          join(app, "src/modules/items-api/create-limit.hooks.ts"),
          await readFile(
            "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-rate-limiter/create-limit.hooks.ts",
          ),
        );
      }
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
      if (name === "rateLimiter" && !process.exitCode) {
        const negative = join(app, "src/modules/items-api/negative.ts");
        await writeFile(
          negative,
          'import {createRateLimiter,rateLimitRefusal,createValkeyCache} from "../../extension-api/index.ts"; import type {RateLimiterHooks,RateLimiterCapability} from "../../extension-api/index.ts"; export function bad(c:RateLimiterCapability,h:RateLimiterHooks){c.admit({key:"attacker"});c.cache;c.close();h.key({subject:"x",address:"spoofed"});}',
        );
        try {
          tsc();
          throw Error("Negative limiter API compiled");
        } catch (cause) {
          const out = String((cause as { stdout?: unknown }).stdout);
          console.log("Negative limiter API:", out);
          for (const word of [
            "createRateLimiter",
            "rateLimitRefusal",
            "createValkeyCache",
            "key",
            "cache",
            "close",
            "address",
          ])
            if (!out.includes(word)) process.exitCode = 1;
        }
        await writeFile(
          negative,
          'import {createRateLimiter} from "../../runtime/rate-limiter.ts";export const bad=createRateLimiter;',
        );
        try {
          check();
          throw Error("Private limiter import passed");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout) + String(e.stderr);
          console.log("Private limiter boundary:", out);
          if (!out.includes("rate-limiter.ts")) process.exitCode = 1;
        }
        await rm(negative);
        const badPolicy = join(app, "src/modules/items-api/negative.hooks.ts");
        await writeFile(
          badPolicy,
          'import type {RateLimiterCapability} from "../../extension-api/index.ts";export function bad(c:RateLimiterCapability){c.admit({});}',
        );
        try {
          check();
          throw Error("Effectful policy passed");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout) + String(e.stderr);
          console.log("Policy boundary:", out);
          if (!out.includes("policy effect API admit")) process.exitCode = 1;
        }
        await rm(badPolicy);
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
    await writeFile("/tmp/jeeves-rg12-pins-review.json", `${JSON.stringify(review, null, 2)}\n`);
    console.log("Pin review", review);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
})();
