import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import {
  applyOperations,
  buildStudioCommand,
  buildSupportedAuthoringCommand,
  callableContractRefusal,
  generationCallableContracts,
  moduleConnectOptions,
  resolveGeneration,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { callableDesign } from "../../../field-projects/generator-system/fixtures/rg05/design.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const design = callableDesign();
const bundle = assembleV2({ designJson: canonicalJson(design) }, registry);
const text = (path: string) => {
  const found = bundle.files.find((item) => item.path === path);
  if (!found) throw Error(path);
  return Buffer.from(found.bytes).toString();
};
const urls = new Map<string, string>();
function load(path: string): string {
  if (urls.has(path)) return urls.get(path) as string;
  let source = text(path);
  // The actual application-owned fixture body uses the emitted slots, no private implementation.
  if (path === "src/modules/account-api/favorite-summary.ts")
    source = readFileSync(
      new URL(
        "../../../field-projects/generator-system/fixtures/rg05/favorite-summary.ts",
        import.meta.url,
      ),
      "utf8",
    );
  const js = stripTypeScriptTypes(source).replace(
    /from "(\.\.?\/[^"]+)"/g,
    (_match, relative: string) => `from "${load(posix.join(posix.dirname(path), relative))}"`,
  );
  const linked = js.replace('from "zod"', `from "${import.meta.resolve("zod")}"`);
  const url = `data:text/javascript;base64,${Buffer.from(linked).toString("base64")}`;
  urls.set(path, url);
  return url;
}
const runtime = await import(load("src/runtime/favorites.ts"));
const operations = await import(load("src/runtime/operation.ts"));
const caller = await import(load("src/modules/account-api/favorite-summary.ts"));
const favorite = { itemId: "item", addedAt: "2026-11-16T00:00:00.000000Z" };
const core = {
  add: async () => favorite,
  remove: async () => {},
  check: async () => favorite,
  list: async () => ({ items: [favorite], next: null }),
};
const context = (subject?: string) =>
  operations.operation({ maximumMs: 1000, caller: subject ? { subject } : undefined });
const withCaller = async (subject: string | undefined, action: () => Promise<unknown>) => {
  const op = context(subject);
  try {
    return await operations.withOperation(op.context, action);
  } finally {
    op.close();
  }
};

describe("RG05 checked callable bindings", () => {
  it("emits typed declared targets and calls the one core from actual handwritten caller without HTTP", async () => {
    const slots = text("src/modules/account-api/favorite-summary.slots.ts");
    expect(slots).toContain("favoriteItems: FavoritesCapability;");
    const process = text("src/processes/account-api.ts");
    expect(process).toContain(
      'favoriteItems: favoritesCapability(() => favoriteItems.favorites, "favorite-items")',
    );
    expect(process.match(/createFavorites\(/g)).toHaveLength(1);
    expect(process.indexOf("createFavorites(")).toBeLessThan(
      process.indexOf("await service.start("),
    );
    for (const contract of generationCallableContracts) {
      expect(Object.keys(runtime.favoritesDtoContracts)).toContain(contract.input);
      expect(Object.keys(runtime.favoritesDtoContracts)).toContain(contract.output);
    }
    expect(process.match(/mountFavorites\(/g)).toHaveLength(1);
    // Execute the real emitted dependency assignment, including its lazy reference to the core.
    const assignment = /dependencies\["favorite-summary"\] = \{[\s\S]*?\n\s*\};/.exec(process)?.[0];
    if (!assignment) throw Error("Missing generated callable assignment");
    const dependencies = new Function(
      "favoritesCapability",
      "favoriteItems",
      "readSettings",
      "declared",
      `const dependencies = {}; ${stripTypeScriptTypes(assignment)}; return dependencies["favorite-summary"];`,
    )(runtime.favoritesCapability, { favorites: core }, () => ({}), {});
    const handle = dependencies.favoriteItems;
    const result = await withCaller("alice", () => caller.favoriteSummary(dependencies, {}));
    expect(result).toEqual({
      status: 200,
      body: { count: 1, target: "favorite-items.favorites.list@1" },
    });
    expect(Object.isFrozen(handle.targets)).toBe(true);
    const tile = bundle.report.processes?.tiles.find((item) => item.tile === "account-api");
    expect(
      tile?.routes.filter((route) => route.path.startsWith("/modules/favorite-items")),
    ).toHaveLength(4);
    expect(tile?.routes.some((route) => route.path.includes("favorites.list"))).toBe(false);
  });
  it("shares input/auth/effect refusals and verifies output before returning", async () => {
    const handle = runtime.favoritesCapability(() => core, "favorite-items");
    await expect(handle.list({})).rejects.toMatchObject({
      statusCode: 401,
      code: "SIGN_IN_REQUIRED",
    });
    await expect(withCaller(undefined, () => handle.list({}))).rejects.toMatchObject({
      statusCode: 401,
      code: "SIGN_IN_REQUIRED",
    });
    await expect(runtime.invokeFavorites(core, "list", undefined, {})).rejects.toMatchObject({
      statusCode: 401,
      code: "SIGN_IN_REQUIRED",
    });
    for (const input of [null, [], { extra: true }]) {
      await expect(withCaller("alice", () => handle.list(input))).rejects.toMatchObject({
        statusCode: 400,
        code: "CALLABLE_INPUT",
      });
      await expect(
        runtime.invokeFavorites(core, "list", { subject: "alice" }, input),
      ).rejects.toMatchObject({ statusCode: 400, code: "CALLABLE_INPUT" });
    }
    await expect(
      withCaller("alice", () =>
        operations.withEffect("read", () => handle.add({ itemId: "item" })),
      ),
    ).rejects.toMatchObject({ outcome: "refused", code: "EFFECT_NOT_ALLOWED" });
    const result = await withCaller("alice", () =>
      operations.withEffect("read", () => handle.check({ itemId: "item" })),
    );
    expect(result).toEqual(favorite);
    expect(result).not.toBe(favorite);
    expect(Object.isFrozen(result)).toBe(true);
    for (const list of [
      async () => ({ items: [{ ...favorite, secret: "private" }], next: null }),
      async () => ({ items: [favorite], next: null, secret: "private" }),
    ]) {
      const invalid = runtime.favoritesCapability(() => ({ ...core, list }), "favorite-items");
      await expect(withCaller("alice", () => invalid.list({}))).rejects.toThrow(
        "Invalid Favorites output contract",
      );
    }
    const bad = runtime.favoritesCapability(
      () => ({ ...core, list: async () => ({ items: ["wrong"], next: null }) }),
      "favorite-items",
    );
    await expect(withCaller("alice", () => bad.list({}))).rejects.toThrow(
      "Invalid Favorites output contract",
    );
    const expired = context("alice");
    expired.close();
    const aborted = operations.operation({
      maximumMs: 1000,
      caller: { subject: "alice" },
      signals: [AbortSignal.abort()],
    });
    await expect(async () =>
      operations.withOperation(aborted.context, () => handle.list({})),
    ).rejects.toMatchObject({ outcome: "refused", code: "CONTEXT_EXPIRED" });
    aborted.close();
  });
  it("refuses unavailable and incompatible contracts and exposes the same mouse/chat connection", () => {
    const required = generationCallableContracts[0];
    for (const key of ["input", "output", "effect"] as const) {
      const actual = { ...required, [key]: key === "effect" ? "read" : "other.contract" };
      expect(callableContractRefusal(required, actual)).toContain(`requires ${key}`);
      const changed = {
        ...registry.installed,
        callables: registry.installed.callables?.map((row) =>
          row.contract.id === required.id ? { ...row, contract: actual } : row,
        ),
      };
      expect(() =>
        buildSupportedAuthoringCommand(
          design,
          {
            type: "connectModule",
            module: "favorite-summary",
            slot: "call",
            target: { module: "favorite-items" },
          },
          changed,
        ),
      ).toThrow(`requires ${key}`);
      const result = resolveGeneration(design, changed);
      expect(result.complete).toBe(false);
      expect(result.findings.some((finding) => finding.message.includes(`requires ${key}`))).toBe(
        true,
      );
    }
    const disconnected = runStudioCommands(design, [
      {
        type: "disconnectModule",
        link:
          design.architecture?.studio?.componentConnections?.find(
            (item) => item.from === "favorite-summary",
          )?.id ?? "",
      },
    ]);
    const beforeLink = assembleV2({ designJson: canonicalJson(disconnected) }, registry);
    const routes = (output: typeof bundle) =>
      output.report.processes?.tiles.flatMap((tile) =>
        tile.routes.map((route) => `${tile.tile}:${route.method}:${route.path}`),
      );
    expect(routes(beforeLink)).toEqual(routes(bundle));
    const mouse = moduleConnectOptions(disconnected, "favorite-summary").find(
      (item) => "module" in item.target && item.target.module === "favorite-items",
    );
    expect(mouse).toHaveProperty("command");
    if (!mouse || !("command" in mouse)) throw Error("Missing mouse choice");
    const batch = buildStudioCommand(disconnected, mouse.command);
    const connected = applyOperations(disconnected, batch.ops);
    expect(connected.ok).toBe(true);
    expect(() =>
      runStudioCommands(disconnected, [
        {
          type: "connectModule",
          module: "favorite-summary",
          slot: "call",
          target: { module: "item-reader" },
        },
      ]),
    ).toThrow("must be a Favorites");
  });
  it("preserves targets, durable namespaces and handwritten paths across tile and module label edits", () => {
    const renamed = runStudioCommands(design, [
      { type: "edit", element: "account-api", name: "Renamed API" },
      { type: "editComponent", component: "favorite-items", name: "Renamed favorites" },
    ]);
    const after = assembleV2({ designJson: canonicalJson(renamed) }, registry);
    expect(after.report.capabilities).toEqual(bundle.report.capabilities);
    expect(after.files.map((file) => file.path)).toEqual(bundle.files.map((file) => file.path));
    const migration = "infra/postgres/favorites/100-favorite-items.sql";
    expect(after.files.find((file) => file.path === migration)?.bytes).toEqual(
      bundle.files.find((file) => file.path === migration)?.bytes,
    );
    const original = design.architecture?.studio?.components?.map((item) => item.id);
    expect(renamed.architecture?.studio?.components?.map((item) => item.id)).toEqual(original);
  });
});
