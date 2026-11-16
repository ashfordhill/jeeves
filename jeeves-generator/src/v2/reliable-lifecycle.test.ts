import { operationImports } from "./operation.test.helpers.ts";

const stripTypeScriptTypes = (source: string) => operationImports(stripTypes(source));

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes as stripTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { favoritesStackDesign } from "../../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { exportNewDirectory } from "../export.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const bundle = assembleV2({ designJson: canonicalJson(favoritesStackDesign()) }, registry);
const video = assembleV2(
  {
    designJson: canonicalJson(
      runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [
        { type: "setRunnableProcesses", on: true },
      ]),
    ),
  },
  registry,
);
const text = (b: typeof bundle, path: string) => {
  const file = b.files.find((file) => file.path === path);
  if (!file) throw Error(`Missing ${path}`);
  return Buffer.from(file.bytes).toString();
};
const data = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`;
const processSource = text(bundle, "src/runtime/process.ts");
const runtime = await import(data(processSource));
const boundary = await import(data(text(video, "src/runtime/hook-boundary.ts")));
const directories: string[] = [];
const exitCode = process.exitCode;
afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = exitCode;
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
const lifecycle = () => runtime.createProcessLifecycle({ mark: () => {}, terminate: () => {} });

describe("RG02 process ownership and public boundary", () => {
  it("constructs two modules once before readiness, sharing only compatible credential/access scopes", async () => {
    const first = lifecycle(),
      second = lifecycle();
    const order: string[] = [];
    let built = 0;
    const construct = () => {
      built += 1;
      return { id: built };
    };
    await first.start(async (scope: typeof first.scope) => {
      const configuration = {
        resource: "db",
        credential: "writer",
        access: "write",
        timeout: 2000,
      };
      const a = scope.once("module:a", () => {
        order.push("a");
        return runtime.processClient(scope, "sql", configuration, construct);
      });
      const b = scope.once("module:b", () => {
        order.push("b");
        return runtime.processClient(
          scope,
          "sql",
          { timeout: 2000, access: "write", credential: "writer", resource: "db" },
          construct,
        );
      });
      expect(a).toBe(b);
      expect(scope.once("module:a", construct)).toBe(a);
      expect(
        runtime.processClient(
          scope,
          "sql",
          { ...configuration, credential: "reader", access: "read" },
          construct,
        ),
      ).not.toBe(a);
      expect(runtime.processClient(second.scope, "sql", configuration, construct)).not.toBe(a);
      order.push("ready");
      scope.ready();
    });
    expect(order).toEqual(["a", "b", "ready"]);
    expect(built).toBe(3);
    await first.close();
    await second.close();
  });

  it("cleans partial startup and repeated shutdown in dependency order after admission/cancellation", async () => {
    const app = lifecycle();
    const order: string[] = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    await app.start(async (scope: typeof app.scope) => {
      scope.admission(() => order.push("stop"));
      scope.signal.addEventListener("abort", () => order.push("cancel"));
      scope.own(() => order.push("client"));
      scope.own(() => order.push("module"));
      throw Error("Initializer failed");
    });
    expect(order).toEqual(["stop", "cancel", "module", "client"]);
    const close = app.close();
    expect(app.close()).toBe(close);
    await close;
    expect(order).toEqual(["stop", "cancel", "module", "client"]);
    expect(process.exitCode).toBe(1);
  });

  it("cancels a dependency wait during startup and closes the already opened client", async () => {
    const app = lifecycle();
    const closed = vi.fn();
    const start = app.start(async (scope: typeof app.scope) => {
      scope.own(closed);
      await new Promise<void>((resolve) =>
        scope.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
    });
    await Promise.resolve();
    await app.close();
    await start;
    expect(app.scope.signal.aborted).toBe(true);
    expect(closed).toHaveBeenCalledOnce();
  });

  it("stops admission registered by unfinished startup after cancellation", async () => {
    const app = lifecycle();
    const stopped = vi.fn();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const start = app.start(async (scope: typeof app.scope) => {
      await pending;
      expect(scope.signal.aborted).toBe(true);
      scope.admission(stopped);
      expect(stopped).toHaveBeenCalledOnce();
      expect(() => scope.once("late-client", () => ({}))).toThrow("Process stopping");
    });
    await Promise.resolve();
    const close = app.close();
    await Promise.resolve();
    finish();
    await start;
    await close;
    expect(stopped).toHaveBeenCalledOnce();
  });

  it("actually terminates a child with a hung hook at the final bound", async () => {
    const script = `${stripTypeScriptTypes(processSource)}\nconst app = createProcessLifecycle({ budgetMs: 30, mark: () => {} });\nawait app.start(async (scope) => { scope.own(() => new Promise(() => {})); setInterval(() => {}, 1000); });\nawait app.close();`;
    const started = Date.now();
    try {
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        timeout: 3000,
        encoding: "utf8",
        stdio: "pipe",
      });
      throw Error("Child did not fail");
    } catch (error) {
      const result = error as { status: number; stderr: string };
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("shutdown-deadline");
      expect(Date.now() - started).toBeLessThan(2000);
    }
  });

  it("uses the emitted callback adapters: no transaction/credentials, immutable DTOs, synchronous policy", async () => {
    const tx = { query: vi.fn(), commit: vi.fn() };
    const record = { id: "one", nested: { value: 1 } };
    let received: unknown[] = [];
    const bound = boundary.bindUploadHooks({
      upload: {
        reserve(...args: unknown[]) {
          received = args;
        },
        complete() {
          return { ok: true };
        },
        closed() {},
      },
    });
    await bound.upload.reserve(tx, record);
    expect(received).toEqual([record]);
    expect(received[0]).not.toBe(record);
    expect(Object.isFrozen(received[0])).toBe(true);
    expect(Object.isFrozen((received[0] as typeof record).nested)).toBe(true);
    const asset = boundary.bindAssetHooks({
      job: {
        construct(...args: unknown[]) {
          received = args;
          return { ok: true };
        },
      },
      publication: {
        construct(...args: unknown[]) {
          received = args;
          return { ok: true };
        },
      },
    });
    expect(asset.job.construct(tx, record)).toEqual({ ok: true });
    expect(received).toEqual([record]);
    expect(asset.publication.construct(tx, record, "event")).toEqual({ ok: true });
    expect(received).toEqual([record, "event"]);
    expect(tx.query).not.toHaveBeenCalled();
    expect(await boundary.bindFavoritesHooks({ eligible: () => true }).eligible("item")).toBe(true);
    await expect(
      boundary.bindFavoritesHooks({ eligible: async () => true }).eligible("item"),
    ).rejects.toThrow("must return synchronously");
    await expect(
      boundary.bindFavoritesHooks({ eligible: () => "yes" }).eligible("item"),
    ).rejects.toThrow("must return boolean");
  });

  it("distinguishes public contracts/helpers from forbidden imports/effects and names the file/API", async () => {
    const root = await mkdtemp(join(tmpdir(), "jeeves-rg02-boundary-"));
    directories.push(root);
    const app = join(root, "app");
    await exportNewDirectory(bundle.files, app);
    await mkdir(join(app, "node_modules"));
    await symlink(
      fileURLToPath(new URL("../../../node_modules/typescript", import.meta.url)),
      join(app, "node_modules/typescript"),
    );
    await writeFile(join(app, "src/contracts/pure.ts"), "export const yes = () => true;\n");
    const hook = "src/modules/account-api/favorite-items.hooks.ts";
    await writeFile(
      join(app, hook),
      'import { yes } from "../../contracts/pure.ts";\nimport "../../contracts/index.ts";\nexport const favoriteItemsHooks = () => ({ eligible: yes });\n',
    );
    const check = async () => {
      try {
        return {
          stdout: execFileSync(process.execPath, [join(app, "scripts/check-extensions.mjs"), app], {
            encoding: "utf8",
            stdio: "pipe",
          }),
          stderr: "",
        };
      } catch (error) {
        return error as { stderr: string; stdout: string };
      }
    };
    const initial = await check();
    expect(initial.stderr).toBe("");
    expect(initial.stdout).toContain("Extension boundaries passed");
    for (const [source, api] of [
      ['import pg from "pg";', "pg"],
      ['import "../../runtime/local.ts";', "private runtime import"],
      ['import "../other/private.ts";', "private cross-service import"],
      ['export const effect = () => fetch("https://example.test");', "fetch"],
      ['export const effect = (db: any) => db.query("COMMIT");', "policy effect API query"],
    ] as const) {
      await writeFile(join(app, hook), source);
      const result = await check();
      expect(result.stderr).toContain(hook);
      expect(result.stderr).toContain(api);
    }
    await writeFile(
      join(app, "src/contracts/index.ts"),
      'import "../modules/account-api/private.ts"; export {};',
    );
    await writeFile(
      join(app, "src/modules/account-api/private.ts"),
      "export const privateValue = 1;",
    );
    await writeFile(
      join(app, hook),
      'import "../../contracts/index.ts"; export const policy = () => true;',
    );
    expect((await check()).stderr).toContain(
      "src/contracts/index.ts: forbidden private cross-service import",
    );
    await writeFile(
      join(app, "src/contracts/index.ts"),
      "export interface Item { readonly id: string; }",
    );
    // A shared helper cannot hide a forbidden effect from a policy importer.
    await writeFile(
      join(app, hook),
      'import { effect } from "../../contracts/pure.ts"; export const x = effect;',
    );
    await writeFile(
      join(app, "src/contracts/pure.ts"),
      'export const effect = () => fetch("https://example.test");',
    );
    expect((await check()).stderr).toContain("src/contracts/pure.ts: forbidden fetch");
    // A globally shared formatter is still pure policy, including transitive helpers.
    await writeFile(join(app, hook), "export const hook = () => true;");
    await writeFile(
      join(app, "src/contracts/pure.ts"),
      'export const effect = (db: any) => db.query("SELECT 1");',
    );
    await writeFile(
      join(app, "src/http-errors.hooks.ts"),
      'import { effect } from "./helpers/pure.ts"; export const formatHttpError = effect;',
    );
    expect((await check()).stderr).toContain(
      "src/contracts/pure.ts: forbidden policy effect API query",
    );
    await writeFile(
      join(app, "src/http-errors.hooks.ts"),
      'import "./runtime/local.ts"; export const formatHttpError = () => ({});',
    );
    expect((await check()).stderr).toContain(
      "src/http-errors.hooks.ts: forbidden private runtime import",
    );
    const generated = join(app, "src/runtime/process.ts");
    await writeFile(generated, `${await readFile(generated, "utf8")}\n// manual edit\n`);
    expect((await check()).stderr).toContain("write to template-owned file");
  });
});

it("RG03 terminates at the final drain bound with an underlying dependency still unsettled", () => {
  const operation = data(text(bundle, "src/runtime/operation.ts"));
  const child = `${stripTypeScriptTypes(processSource)}\nimport { dependency } from ${JSON.stringify(operation)};\nconst app = createProcessLifecycle({ budgetMs: 30, mark: () => {} });\nawait app.start(async () => { const result = await dependency({ maximumMs: 5, mutation: true }, () => new Promise(() => {})).catch(e => e); if(result.outcome !== 'unknown') throw Error('Lost unknown outcome'); setInterval(() => {}, 1000); });\nawait app.close();`;

  try {
    execFileSync(process.execPath, ["--input-type=module", "-e", child], {
      timeout: 3000,
      encoding: "utf8",
      stdio: "pipe",
    });
    throw Error("Child did not fail");
  } catch (error) {
    const result = error as { status: number; stderr: string };
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("shutdown-deadline");
  }
});
