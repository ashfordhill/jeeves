import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { keysDesign } from "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-keys/design.ts";
import { localOperationDesign } from "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-local-operation/design.ts";
import {
  withStubWorkloads,
  workloadDesign,
} from "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-workload/design.ts";
import { favoritesStackDesign } from "/home/ash/github/jeeves/jeeves/packages/spec/src/fixtures/favorites-stack.ts";
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
  const zero = runStudioCommands(favoritesStackDesign(), [
    {
      type: "addTile",
      from: { tile: "account-api" },
      side: "after",
      tile: { id: "empty-api", name: "Empty API", kind: "service" },
      linkId: "account-empty",
    },
  ]);
  const designs = {
    localOperation: JSON.stringify(localOperationDesign()),
    keys: JSON.stringify(keysDesign()),
    zero: JSON.stringify(zero),
    favorites: JSON.stringify(favoritesStackDesign()),
    video: JSON.stringify(
      runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [
        { type: "setRunnableProcesses", on: true },
      ]),
    ),
    workload: JSON.stringify(workloadDesign()),
    workloadUser: JSON.stringify(workloadDesign(true)),
    stubs: JSON.stringify(
      runStudioCommands(withStubWorkloads(stubStackDesign()), [
        { type: "setRunnableProcesses", on: true },
      ]),
    ),
    ...offDesigns(registry),
  };
  const root = await mkdtemp("/tmp/jeeves-rg10-emitted-");
  try {
    for (const [name, designJson] of Object.entries(designs)) {
      const b = assembleV2({ designJson }, registry),
        app = join(root, name);
      await exportNewDirectory(b.files, app);
      await symlink("/home/ash/github/qrwty/app/node_modules", join(app, "node_modules"));
      if (name === "workload" || name === "workloadUser")
        for (const file of ["send", "receive"])
          await writeFile(
            join(app, `src/modules/${file === "send" ? "caller" : "callee"}/${file}.ts`),
            await readFile(
              `/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-workload/${file}.ts`,
            ),
          );
      if (name === "keys")
        for (const file of ["cursor", "receipt"])
          await writeFile(
            join(app, `src/modules/items-api/${file}.ts`),
            await readFile(
              `/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-keys/${file}.ts`,
            ),
          );
      if (name === "localOperation") {
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
              "/home/ash/github/jeeves/field-projects/generator-system/fixtures/rg-local-operation/" +
                input,
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
        console.log(name, b.files.length, "files");
        console.log(check());
        console.log(tsc());
      } catch (cause) {
        const e = cause as { stdout?: unknown; stderr?: unknown };
        console.log(e.stdout, e.stderr);
        process.exitCode = 1;
      }
      if (name === "localOperation" && !process.exitCode) {
        const bad = join(app, "src/modules/items-api/negative.ts");
        await writeFile(
          bad,
          'import {bindLocalOperation,privateReplayKeys,createSealingKeys} from "../../extension-api/index.ts";\nimport type {LocalCommands} from "../../extension-api/index.ts";\nimport type {Dependencies} from "./create-item.slots.ts";\nimport {localOperation} from "./create-item.ts";\nexport function bad(commands:LocalCommands,d:Dependencies){commands.query("COMMIT");commands.execute("ROLLBACK");commands.transaction(()=>{});d.itemsDb.pool;d.itemsDb.idempotent({},()=>{});localOperation.call(d,{key:"x",input:{id:"x"},scope:{id:"other"}});localOperation.call(d,{key:"x",input:{id:"x"}},()=>{}); }\n',
        );
        try {
          tsc();
          throw Error("negative local operation API compiled");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout);
          console.log("Negative local operation API proof:", out);
          for (const word of [
            "bindLocalOperation",
            "privateReplayKeys",
            "createSealingKeys",
            "query",
            "execute",
            "transaction",
            "pool",
            "idempotent",
            "scope",
            "Expected 2 arguments",
          ])
            if (!out.includes(word)) process.exitCode = 1;
        }
        await rm(bad);
      }
      if (name === "workload" && !process.exitCode) {
        const bad = join(app, "src/modules/caller/negative.ts");
        await writeFile(
          bad,
          'import {serviceTarget,workloadSettings,verifiedBearer} from "../../extension-api/index.ts";\nimport type {Dependencies} from "./send.slots.ts";\nexport function bad(d:Dependencies){d.callee.credentials;d.callee.audience;d.callee.request("/elsewhere");d.callee.call("receive",{method:"PUT"});d.callee.call("receive",{method:"POST",headers:{authorization:"replacement"}}); }\n',
        );
        try {
          tsc();
          throw Error("negative service API compiled");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout);
          console.log("Negative service API proof:", out);
          for (const word of [
            "serviceTarget",
            "workloadSettings",
            "verifiedBearer",
            "credentials",
            "audience",
            "request",
            "PUT",
            "headers",
          ])
            if (!out.includes(word)) process.exitCode = 1;
        }
        await writeFile(
          bad,
          'import {createWorkload} from "../../runtime/workload.ts";\nexport const bad=createWorkload;\n',
        );
        try {
          check();
          throw Error("private workload import passed");
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout) + String(e.stderr);
          console.log("Private workload boundary proof:", out);
          if (!out.includes("workload.ts")) process.exitCode = 1;
        }
        await rm(bad);
      }
      if (name === "keys" && !process.exitCode) {
        const negative = join(app, "src/modules/items-api/negative.ts");
        await writeFile(
          negative,
          'import {keyRing,secret,readSettings} from "../../extension-api/index.ts";\nimport type {Dependencies} from "./cursor.slots.ts";\nexport function bad(d:Dependencies){d.settings.VALUE_KEYS.current.key;d.settings.VALUE_KEYS.entries;d.settings.VALUE_KEYS.file;d.settings.VALUE_KEYS.sign("x",{scope:"account"});}\n',
        );
        try {
          tsc();
          console.log("ERROR negative compiled");
          process.exitCode = 1;
        } catch (cause) {
          const e = cause as { stdout?: unknown; stderr?: unknown };
          const out = String(e.stdout);
          console.log("Negative public API proof:", out);
          for (const word of [
            "keyRing",
            "secret",
            "readSettings",
            "current",
            "entries",
            "file",
            "context",
          ])
            if (!out.includes(word)) process.exitCode = 1;
        }
        await rm(negative);
      }
    }
    const previous = JSON.parse(
      execFileSync("git", ["show", "HEAD:jeeves-generator/src/v2/fixtures/processes-off.json"], {
        cwd: "/home/ash/github/jeeves",
        encoding: "utf8",
      }),
    );
    const next = Object.fromEntries(
      Object.entries(offDesigns(registry)).map(([name, json]) => [name, offPin(json, registry)]),
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
    await writeFile("/tmp/jeeves-rg10-pins-review.json", `${JSON.stringify(review, null, 2)}\n`);
    console.log("Pin review", review);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
})();
