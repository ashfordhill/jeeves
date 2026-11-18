import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DesignDocument } from "@jeeves/spec";
import { expect, test } from "vitest";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { rekeyDesign } from "../../../jeeves/packages/spec/src/studio-rekey.ts";
import { healthyCopies, serviceContainers } from "../harness/activity.ts";
import { createApplication, withApplication } from "../harness/application.ts";
import { faultContainer } from "../harness/faults.ts";
import { IdentityClient } from "../harness/identity.ts";
import { command, hash, json, poll, repository } from "../harness/process.ts";
import { diskHashes } from "../harness/regeneration.ts";
import { catalogUpdateTools } from "../harness/rg-catalog.ts";
import {
  finish,
  foundationForward,
  foundationTemplates,
  native,
} from "../harness/rg-foundations.ts";
import { browserLogin, prepareLinkFlow } from "../harness/rg-mechanisms.ts";
import {
  adoptFresh,
  adoptionFixture,
  attachFrom,
  historicalExport,
  inspectStoppedData,
  maintenanceReport,
  oldFixture,
  publicUpdate,
  repeatUpdate,
  retainedRuntime,
  stopForUpdate,
} from "../harness/rg-regeneration.ts";

test("RG24: unchanged-namespace legacy API migration succeeds in place only after handwritten repair", async () => {
  const app = await createApplication("rg-regeneration");
  let failed: unknown;
  try {
    const source = join(adoptionFixture, "legacy-hook-design.json");
    await historicalExport(app, source);
    const destination = "src/modules/echo-api/echo.ts",
      hook = join(app.directory, destination);
    await writeFile(hook, await readFile(join(adoptionFixture, "owned/echo-legacy.ts")));
    await app.execute(
      "legacy-install",
      "pnpm",
      ["install", "--frozen-lockfile", "--ignore-scripts"],
      180000,
    );
    await app.execute("legacy-types", "pnpm", ["exec", "tsc", "--noEmit"], 120000);
    const old = await diskHashes(app);
    for (const check of [true, false]) {
      const result = await publicUpdate(app, source, `incompatible-${check ? "check" : "apply"}`, {
        check,
        refused: /Extension API 1 -> 8 requires migration/,
      });
      expect(result.refused.join("\n")).toContain(destination);
      expect(await diskHashes(app)).toEqual(old);
    }
    const rejected = await publicUpdate(app, source, "ack-cannot-skip-immutable-input", {
      acknowledge: true,
      refused: /Extension migration build failed/,
    });
    expect(rejected.refused.join("\n")).toMatch(/only permits reading|read.only/);
    expect(await diskHashes(app)).toEqual(old);
    const body = await readFile(join(adoptionFixture, "owned/echo.ts"), "utf8");
    await writeFile(hook, body);
    const repaired = await diskHashes(app);
    const plan = await publicUpdate(app, source, "migrated-check", {
      check: true,
      acknowledge: true,
    });
    expect(await diskHashes(app)).toEqual(repaired);
    const applied = await publicUpdate(app, source, "migrated-apply", { acknowledge: true });
    expect({ ...applied, check: true }).toEqual(plan);
    expect(await readFile(hook, "utf8")).toBe(body);
    const fresh = join(dirname(app.directory), "tiny-current-fresh");
    await app.execute("fresh-export", "pnpm", [
      "--dir",
      repository,
      "--filter",
      "@jeeves/generator",
      "export:v2",
      source,
      fresh,
    ]);
    const manifest = await json<{
      extensionApi: { version: number };
      files: { path: string; ownership: string; sha256: string }[];
    }>(join(fresh, ".jeeves/manifest.json"));
    expect(manifest.extensionApi.version).toBe(8);
    expect(hash(await readFile(join(app.directory, ".jeeves/manifest.json")))).toBe(
      hash(await readFile(join(fresh, ".jeeves/manifest.json"))),
    );
    const after = await diskHashes(app);
    for (const row of manifest.files.filter((row) => row.ownership === "generated-scaffold"))
      expect(after[row.path]).toBe(row.sha256);
    app.attachments = [{ source: "owned/echo.ts", destination, role: "stub", module: "echo" }];
    await app.execute(
      "migrated-checker",
      "node",
      ["scripts/check-extensions.mjs", app.directory],
      120000,
    );
    await app.execute("migrated-types", "pnpm", ["exec", "tsc", "--noEmit"], 120000);
    await app.execute("compiler-version", "pnpm", ["exec", "tsc", "--version"]);
    await repeatUpdate(app, source);
    await maintenanceReport(app, fresh, "in-place-hook");
    await app.save("migration-preservation.json", {
      legacyApi: 1,
      currentApi: 8,
      unchangedNamespaces: true,
      acknowledgedInPlaceSuccess: true,
      manuallyRepairedFiles: [destination],
      hookBeforeMigration: old[destination],
      hookAfterRepair: hash(body),
      hookAfterUpdates: hash(await readFile(hook)),
      noGeneratedFilesManuallyEdited: true,
      oldManifest: old[".jeeves/manifest.json"],
      newManifest: after[".jeeves/manifest.json"],
      generatedScaffoldMatchesFresh: true,
      applicationConfigurationKept: ["package.json", "pnpm-lock.yaml"],
    });
  } catch (error) {
    failed = error;
    throw error;
  } finally {
    await app.save("result.json", {
      outcome: failed ? "failed" : "passed",
      error: failed ? String(failed) : undefined,
    });
  }
});

test("RG24: genuine legacy hooks refuse, migrate explicitly and survive consecutive public updates", async () => {
  const app = await createApplication("rg-regeneration");
  let failed: unknown;
  try {
    await historicalExport(app);
    await attachFrom(app, oldFixture);
    await app.execute(
      "legacy-install",
      "pnpm",
      ["install", "--frozen-lockfile", "--ignore-scripts"],
      180000,
    );
    await app.execute("legacy-build", "pnpm", ["build"], 120000);
    const oldSource = join(oldFixture, "design.json"),
      source = join(adoptionFixture, "design.json");
    const original = await diskHashes(app);
    for (const check of [true, false]) {
      const result = await publicUpdate(app, oldSource, `unmigrated-${check ? "check" : "apply"}`, {
        check,
        refused: /Extension API 1 -> 8 requires migration/,
      });
      expect(result.refused.join("\n")).toContain("catalog-read.hooks.ts");
      expect(result.refused.join("\n")).toContain("catalog-writer.ts");
      expect(result.refused.join("\n")).toContain("Product SQL baseline/migration required");
      expect(await diskHashes(app)).toEqual(original);
    }
    await publicUpdate(app, oldSource, "ack-cannot-skip-sql-baseline", {
      acknowledge: true,
      refused: /Product SQL baseline\/migration required/,
    });
    expect(await diskHashes(app)).toEqual(original);
    const oldSql = "infra/postgres/catalog/modules/catalog-writer.sql";
    // Reviewer-supplied receipt and a minimal declaration let the updater reach its type/checker
    // gates. They do not establish usable product SQL or authorize moving legacy data.
    const minimal = {
      version: 1,
      namespaces: [
        {
          schema: "m_catalog_writer",
          migrations: [
            {
              version: "0001",
              file: "infra/postgres/catalog/products/migrations/m_catalog_writer/0001-initial.sql",
            },
          ],
        },
      ],
      tables: [],
      views: [],
      operations: [],
    };
    await mkdir(
      join(app.directory, "infra/postgres/catalog/products/migrations/m_catalog_writer"),
      { recursive: true },
    );
    await writeFile(
      join(
        app.directory,
        "infra/postgres/catalog/products/migrations/m_catalog_writer/0001-initial.sql",
      ),
      "SELECT 1;\n",
    );
    await writeFile(
      join(app.directory, "infra/postgres/catalog/products.json"),
      JSON.stringify(minimal),
    );
    await writeFile(
      join(app.directory, ".jeeves/product-sql-migration.json"),
      JSON.stringify({
        version: 1,
        mode: "external-reviewed",
        legacy: [{ file: oldSql, sha256: original[oldSql] }],
      }),
    );
    const baselineReviewed = await diskHashes(app);
    await publicUpdate(app, oldSource, "ack-cannot-skip-types", {
      acknowledge: true,
      refused: /Extension migration build failed/,
    });
    expect(await diskHashes(app)).toEqual(baselineReviewed);
    // Explicitly migrated hook bodies use named queries; all actual product declarations are
    // installed only in the fresh supported export below.
    const migrated = await json<typeof app.attachments>(join(adoptionFixture, "attachments.json"));
    for (const row of migrated.filter((row) => row.destination.endsWith(".ts")))
      await writeFile(
        join(app.directory, row.destination),
        await readFile(join(adoptionFixture, row.source)),
      );
    const hook = join(app.directory, "src/modules/catalog-api/catalog-read.hooks.ts"),
      kept = await readFile(hook, "utf8");
    await writeFile(hook, `import type pg from "pg";\n${kept}`);
    const checkerInvalid = await diskHashes(app);
    const rejected = await publicUpdate(app, oldSource, "ack-cannot-skip-checker", {
      acknowledge: true,
      refused: /Extension migration build failed/,
    });
    expect(rejected.refused.join("\n")).toMatch(/provider|driver|import.*pg|pg.*import/i);
    expect(await diskHashes(app)).toEqual(checkerInvalid);
    await writeFile(hook, kept);
    const identityBefore = await diskHashes(app);
    for (const check of [true, false]) {
      await publicUpdate(app, source, `namespace-${check ? "check" : "apply"}`, {
        check,
        acknowledge: true,
        refused: /Runtime identity\/namespace migration required/,
      });
      expect(await diskHashes(app)).toEqual(identityBefore);
    }
    await app.save("old-export-preserved.json", {
      originalManifest: original[".jeeves/manifest.json"],
      finalManifest: (await diskHashes(app))[".jeeves/manifest.json"],
      legacySql: original[oldSql],
      finalLegacySql: (await diskHashes(app))[oldSql],
      allRefusalsReadOnly: true,
      explicitHandwrittenEditsOnly: [
        "two hook bodies",
        "minimal SQL receipt/declaration for refusal probes",
      ],
      originalApplicationNotOverwritten: true,
      liveLegacyDatabaseConversionClaimed: false,
    });
    // The guarded refusal explicitly requires fresh export plus reviewed application/data migration.
    // This is cold adoption: no existing database is copied or claimed to be converted.
    const adopted = await createApplication("rg-regeneration");
    let adoptionFailed: unknown;
    try {
      const exported = await command("pnpm", [
        "--filter",
        "@jeeves/generator",
        "export:v2",
        source,
        adopted.directory,
      ]);
      await writeFile(join(adopted.stack.artifacts, "export.log"), exported);
      adopted.manifest = await json(join(adopted.directory, ".jeeves/manifest.json"));
      adopted.manifestHash = hash(await readFile(join(adopted.directory, ".jeeves/manifest.json")));
      adopted.report = await json(join(adopted.directory, ".jeeves/report.json"));
      await attachFrom(adopted, adoptionFixture);
      const fresh = await adoptFresh(adopted, source, "adopted");
      await adopted.execute(
        "install",
        "pnpm",
        ["install", "--frozen-lockfile", "--ignore-scripts"],
        180000,
      );
      await adopted.execute("build", "pnpm", ["build"], 120000);
      await adopted.execute("compiler-version", "pnpm", ["exec", "tsc", "--version"]);
      const bodiesBefore = await diskHashes(adopted);
      await repeatUpdate(adopted, source);
      const bodiesAfter = await diskHashes(adopted);
      expect(bodiesAfter).toEqual(bodiesBefore);
      for (const row of adopted.manifest.files.filter((row) => row.path.startsWith("src/runtime/")))
        expect(bodiesAfter[row.path]).toBe(row.sha256);
      await maintenanceReport(adopted, fresh, "migrated-catalog");
      await adopted.save("migration-preservation.json", {
        coldExportOnly: true,
        sourceDiagramRequiresPreciseProductGrant: true,
        namespace: "p_catalog_api_owner",
        manualHookFiles: migrated
          .filter((row) => row.destination.endsWith(".ts"))
          .map((row) => row.destination),
        bodyHashesBefore: bodiesBefore,
        bodyHashesAfter: bodiesAfter,
        currentRuntimeMatchesFresh: true,
        oldExportManifestUnchanged: true,
        noCompatibilityRuntime: true,
        liveLegacyDatabaseConversionClaimed: false,
      });
      await adopted.scaffoldCheck("final");
    } catch (error) {
      adoptionFailed = error;
      throw error;
    } finally {
      await adopted.save("result.json", {
        outcome: adoptionFailed ? "failed" : "passed",
        error: adoptionFailed ? String(adoptionFailed) : undefined,
      });
    }
  } catch (error) {
    failed = error;
    throw error;
  } finally {
    await app.save("result.json", {
      outcome: failed ? "failed" : "passed",
      error: failed ? String(failed) : undefined,
    });
  }
});

test("RG24: link/account public setting update preserves policy bodies, rows and session expiry promises", async () => {
  await withApplication(
    "rg-link-flow",
    [...foundationTemplates, "module-stub", "browser-session"],
    async (app) => {
      const policy = "src/modules/items-api/create-limit.hooks.ts";
      const originalPolicy = await readFile(join(app.directory, policy), "utf8");
      await writeFile(
        join(app.directory, policy),
        originalPolicy.replace("caller.subject", '"account:" + caller.subject'),
      );
      // Product decision changed in one handwritten policy; rebuild through the public lifecycle.
      await app.execute("policy-build", "pnpm", ["build"], 120000);
      await app.execute("policy-start", "pnpm", ["start"], 600000);
      const identity = new IdentityClient(app),
        accounts = await identity.provision("rg24");
      assert(accounts[0] && accounts[1]);
      const userA = await identity.signIn(accounts[0]),
        userB = await identity.signIn(accounts[1]);
      const session = await browserLogin(app, accounts[0].username, accounts[0].password);
      const statusesA = [];
      for (let i = 0; i < 3; i++)
        statusesA.push((await foundationForward(app, userA, `before-${i}`)).status);
      expect(statusesA).toEqual([201, 201, 429]);
      await app.sql(
        "INSERT INTO p_items_api_owner.items(id,marked) VALUES ('retained-rg24',true)",
        "d_items_db",
      );
      const product = () =>
        app.sql(
          `SELECT json_build_object('db',(SELECT oid FROM pg_database WHERE datname=current_database()),'rel','p_items_api_owner.items'::regclass::oid,'rows',(SELECT json_agg(json_build_object('id',id,'marked',marked,'xmin',xmin::text) ORDER BY id) FROM p_items_api_owner.items))`,
          "d_items_db",
        );
      const sessions = () =>
        app.sql(
          "SELECT json_agg(json_build_object('row',md5(row_to_json(s)::text),'absolute',absolute_expires_at,'idle',idle_seconds,'lastSeen',last_seen_at)) FROM jeeves.browser_sessions s",
          "d_sessions",
        );
      const dataBefore = await product(),
        sessionBefore = await sessions(),
        runtimeBefore = await retainedRuntime(app);
      await stopForUpdate(app);
      const source = await json<DesignDocument>(
        join(repository, "field-projects/generator-system/fixtures/rg-link-flow/design.json"),
      );
      const variant = join(dirname(app.directory), "link-setting.json");
      const limiter = source.architecture?.studio?.components?.find(
        (row) => row.id === "create-limit",
      );
      assert(limiter?.settings.kind === "rate-limiter");
      const changed = runStudioCommands(source, [
        {
          type: "editComponent",
          component: "create-limit",
          settings: { ...limiter.settings, limit: 3 },
        },
      ]);
      await writeFile(variant, JSON.stringify(changed));
      const stopped = await diskHashes(app);
      await publicUpdate(app, variant, "setting-check", { check: true });
      expect(await diskHashes(app)).toEqual(stopped);
      await publicUpdate(app, variant, "setting-apply");
      await adoptFresh(app, variant, "setting");
      expect(await retainedRuntime(app)).toEqual(runtimeBefore);
      expect(
        await inspectStoppedData(app, async () => ({
          product: await product(),
          sessions: await sessions(),
        })),
      ).toEqual({ product: dataBefore, sessions: sessionBefore });
      await repeatUpdate(app, variant);
      const label = runStudioCommands(changed, [
        { type: "edit", element: "items-api", name: "Links API renamed" },
        { type: "editComponent", component: "create-limit", name: "Account create budget" },
      ]);
      const labels = join(dirname(app.directory), "link-label.json");
      await writeFile(labels, JSON.stringify(label));
      const normalizedBefore = await json<{ capabilities: unknown }>(
        join(app.directory, ".jeeves/normalized.json"),
      );
      await publicUpdate(app, labels, "label-only-apply");
      const fresh = await adoptFresh(app, labels, "label");
      const normalizedAfter = await json<{ capabilities: unknown }>(
        join(app.directory, ".jeeves/normalized.json"),
      );
      expect(normalizedAfter.capabilities).toEqual(normalizedBefore.capabilities);
      expect(await retainedRuntime(app)).toEqual(runtimeBefore);
      const rekey = structuredClone(label);
      rekeyDesign(rekey, "create", "create-next");
      const identities = join(dirname(app.directory), "link-identity.json");
      await writeFile(identities, JSON.stringify(rekey));
      const refusedBefore = await diskHashes(app);
      for (const check of [true, false]) {
        const result = await publicUpdate(
          app,
          identities,
          `identity-${check ? "check" : "apply"}`,
          { check, acknowledge: true, refused: /Runtime identity\/namespace migration required/ },
        );
        expect(result.refused.join("\n")).toContain("selection:create");
        expect(await diskHashes(app)).toEqual(refusedBefore);
      }
      await maintenanceReport(app, fresh, "link-account");
      await app.execute("updated-build", "pnpm", ["build"], 120000);
      await app.execute("updated-start", "pnpm", ["start"], 600000);
      await healthyCopies(app, "app-items-api", 1);
      expect(await product()).toBe(dataBefore);
      expect(await sessions()).toBe(sessionBefore);
      const sessionStatus = await native<{ status: number }>(
        app,
        "app-browser",
        `const r=await fetch('http://127.0.0.1:3000/modules/session/session',{headers:{cookie:${JSON.stringify(session.cookie)}}});await r.arrayBuffer();${finish("{status:r.status}")}`,
      );
      expect(sessionStatus.status).toBe(200);
      const statusesB = [];
      for (let i = 0; i < 4; i++)
        statusesB.push((await foundationForward(app, userB, `after-${i}`)).status);
      expect(statusesB).toEqual([201, 201, 201, 429]);
      await app.save("update-preservation.json", {
        dataBefore,
        dataAfter: await product(),
        sessionBefore,
        sessionAfterRestartBeforeRequest: sessionBefore,
        sessionStatus,
        policyPath: policy,
        policySha256: hash(await readFile(join(app.directory, policy))),
        runtimeBefore,
        runtimeAfter: await retainedRuntime(app),
        beforeLimit: 2,
        afterLimit: 3,
        statusesA,
        statusesB,
        labelsPreserveCapabilities: true,
        identityChangeRefused: true,
      });
    },
    "design.json",
    { beforeStart: prepareLinkFlow },
  );
});

test("RG24: catalog update retains accepted remote work and product data before process resumption", async () => {
  await withApplication(
    "rg-catalog-flow",
    ["module-stub", "module-stub", "webhook-receiver", "module-stub"],
    async (app) => {
      const contract = "src/contracts/catalog.ts";
      await writeFile(
        join(app.directory, contract),
        (await readFile(join(app.directory, contract), "utf8")).replace(
          "title: value.title };",
          "title: value.title.trim() };",
        ),
      );
      await app.execute("product-policy-build", "pnpm", ["build"], 120000);
      await app.execute("product-policy-start", "pnpm", ["start"], 600000);
      expect(await catalogUpdateTools.webhook(app, "durable-before")).toEqual({ status: 202 });
      await poll(
        "seeded durable catalog product",
        () =>
          app.sql(
            "SELECT effects FROM p_caller_owner.inbox WHERE id='durable-before'",
            "d_caller_db",
          ),
        (v) => v === "1",
        15000,
      );
      const body = new TextEncoder().encode(
        JSON.stringify({
          id: "size-before",
          type: "catalog.changed",
          payload: { id: "size-before", title: "Size before" },
        }) + " ".repeat(5000),
      );
      // Invalid signature is downstream of the body limit: 401 before update, 413 after.
      const bodyProbe = () =>
        native<{ status: number }>(
          app,
          "app-callee",
          `const r=await fetch('http://app-caller:3000/modules/catalog-events',{method:'POST',headers:{'content-type':'application/json'},body:${JSON.stringify(new TextDecoder().decode(body))}});await r.arrayBuffer();${finish("{status:r.status}")}`,
        );
      const beforeStatus = await bodyProbe();
      expect(beforeStatus.status).toBe(401);
      await catalogUpdateTools.control(app, { holdExecute: true });
      expect(await catalogUpdateTools.send(app, "pending-update", "  Pending catalog  ")).toEqual({
        status: 202,
      });
      await poll(
        "remote effect completed but response withheld",
        () => catalogUpdateTools.stats(app),
        (s) => s.events.some((e) => e.phase === "execute" && e.status === 200),
        15000,
      );
      const caller = (await serviceContainers(app, "app-caller"))[0];
      assert(caller);
      await faultContainer(app, "app-caller", caller.Id, "kill");
      const pending = () =>
        app.sql(
          "SELECT json_agg(json_build_object('id',work_id,'namespace',namespace,'scope',scope_key,'key',work_key,'state',state,'input',input,'inputHash',input_hash,'fence',fence,'created',created_at,'ticketHash',md5(remote_ticket),'remoteState',external_state,'rowHash',md5(row_to_json(w)::text))) FROM jeeves.work_records w WHERE work_key='pending-update'",
          "d_caller_db",
        );
      const products = () =>
        app.sql(
          "SELECT json_build_object('db',(SELECT oid FROM pg_database WHERE datname=current_database()),'rel','p_caller_owner.inbox'::regclass::oid,'rows',(SELECT json_agg(json_build_object('id',id,'title',title,'effects',effects,'xmin',xmin::text) ORDER BY id) FROM p_caller_owner.inbox))",
          "d_caller_db",
        );
      const pendingBefore = await pending(),
        productsBefore = await products(),
        runtimeBefore = await retainedRuntime(app);
      expect(JSON.parse(pendingBefore)[0].state).toBe("running");
      expect(JSON.parse(pendingBefore)[0].ticketHash).toBeTruthy();
      expect(
        await app.sql(
          "SELECT effects FROM p_callee_owner.items WHERE id='pending-update'",
          "d_callee_db",
        ),
      ).toBe("1");
      await stopForUpdate(app);
      const source = await json<DesignDocument>(
        join(repository, "field-projects/generator-system/fixtures/rg-catalog-flow/design.json"),
      );
      const receiver = source.architecture?.studio?.components?.find(
        (row) => row.id === "catalog-events",
      );
      assert(receiver?.settings.kind === "webhook-receiver");
      const changed = runStudioCommands(source, [
        {
          type: "editComponent",
          component: "catalog-events",
          settings: { ...receiver.settings, bodyLimitBytes: "1024" },
        },
      ]);
      const variant = join(dirname(app.directory), "catalog-setting.json");
      await writeFile(variant, JSON.stringify(changed));
      const stopped = await diskHashes(app);
      await publicUpdate(app, variant, "setting-check", { check: true });
      expect(await diskHashes(app)).toEqual(stopped);
      await publicUpdate(app, variant, "setting-apply");
      const fresh = await adoptFresh(app, variant, "setting");
      expect(await retainedRuntime(app)).toEqual(runtimeBefore);
      const whileStopped = await inspectStoppedData(app, async () => ({
        pending: await pending(),
        products: await products(),
      }));
      expect(whileStopped).toEqual({ pending: pendingBefore, products: productsBefore });
      await repeatUpdate(app, variant);
      await maintenanceReport(app, fresh, "catalog-event");
      await catalogUpdateTools.control(app, { holdExecute: false });
      await app.execute("updated-build", "pnpm", ["build"], 120000);
      await app.execute("updated-start", "pnpm", ["start"], 600000);
      expect(await products()).toBe(productsBefore);
      const afterStatus = await bodyProbe();
      expect(afterStatus.status).toBe(413);
      await poll(
        "accepted pending work completes after update",
        () =>
          app.sql(
            "SELECT state FROM jeeves.work_records WHERE work_key='pending-update'",
            "d_caller_db",
          ),
        (v) => v === "completed",
        45000,
      );
      expect(
        await app.sql(
          "SELECT effects||'|'||title FROM p_caller_owner.items WHERE id='pending-update'",
          "d_caller_db",
        ),
      ).toBe("1|Pending catalog");
      expect(
        await app.sql(
          "SELECT effects FROM p_callee_owner.items WHERE id='pending-update'",
          "d_callee_db",
        ),
      ).toBe("1");
      expect(JSON.parse(await pending())[0].id).toBe(JSON.parse(pendingBefore)[0].id);
      expect(JSON.parse(await pending())[0].ticketHash).toBe(
        JSON.parse(pendingBefore)[0].ticketHash,
      );
      await app.save("update-preservation.json", {
        pendingBefore,
        pendingWhileStopped: whileStopped.pending,
        pendingAfter: await pending(),
        productsBefore,
        productsAfter: await products(),
        runtimeBefore,
        runtimeAfter: await retainedRuntime(app),
        bodyLimitBefore: 65536,
        bodyLimitAfter: 1024,
        beforeStatus,
        afterStatus,
        localEffects: 1,
        remoteEffects: 1,
        stableChosenTicket: true,
      });
    },
    "design.json",
    { beforeStart: catalogUpdateTools.prepare },
  );
});
