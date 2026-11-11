import { stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { favoritesStackDesign } from "../../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";
import { favoritesBounds } from "./favorites.ts";
import { httpMounts } from "./http-wiring.ts";

// The favorites stack (V3-07, v3 contract section 3) exported with Runnable processes on and off,
// and the exact emitted Favorites engine, routes and hooks file run on PGlite with the emitted
// migration. Only the routes, the replies, the principal and (where written) `eligible` are fakes.
const registry = loadLocalV2Registry();
const assemble = (processes: boolean) =>
  assembleV2({ designJson: canonicalJson(favoritesStackDesign(processes)) }, registry);
const bundle = assemble(true);
type Bundle = typeof bundle;
const text = (from: Bundle, path: string) => {
  const file = from.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const urls = new Map<string, string>();
function load(path: string): string {
  const old = urls.get(path);
  if (old) return old;
  const js = stripTypeScriptTypes(text(bundle, path)).replace(
    /from "(\.\.?\/[^"]+)"/g,
    (_match, relative: string) => `from "${load(posix.join(posix.dirname(path), relative))}"`,
  );
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  urls.set(path, url);
  return url;
}
const { createFavorites, mountFavorites } = await import(load("src/runtime/favorites.ts"));
const { notImplementedRoutes } = await import(load("src/runtime/tile-http.ts"));
const { favoriteItemsHooks } = await import(
  load("src/modules/account-api/favorite-items.hooks.ts")
);

type Report = {
  processes: {
    runnable: boolean;
    tiles: {
      tile: string;
      routes: { method: string; path: string; answers: string }[];
      templates: { selection: string; template: string; level: string }[];
      hooks: { selection: string; file: string; hooks: string[] }[];
    }[];
  };
  gaps: { id: string; status: string; required: boolean; description: string }[];
  modules: { module: string; status: string; template?: string; sql?: unknown[] }[];
};
const report = (from: Bundle) => from.report as unknown as Report;
/** The process config the export compiles: what the runtime reads. */
const config = () => {
  const source = text(bundle, "src/processes/account-api.ts");
  const json = /export const config = (\{[\s\S]*?\n\}) as const;/.exec(source)?.[1];
  if (!json) throw new Error("No config");
  return JSON.parse(json) as {
    templates: Record<string, { table: { schema: string; table: string }; bounds: object }>;
  };
};

/** A fresh PGlite with the emitted favorites migration, as a pool the runtime can use. */
async function database() {
  const db = new PGlite();
  await db.exec(text(bundle, "infra/postgres/favorites/100-favorite-items.sql"));
  const query = async (sql: string, values?: unknown[]) => {
    const result = await db.query(sql, values);
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  return { db, pool: { query, connect: async () => ({ query, release() {} }) } };
}
const alice = { subject: "alice-subject", claims: { sub: "alice-subject" } };
const bob = { subject: "bob-subject", claims: { sub: "bob-subject" } };
async function favorites(eligible: (itemId: string) => Promise<boolean> = async () => true) {
  const { db, pool } = await database();
  const binding = config().templates["favorite-items"];
  const hooks = { eligible: vi.fn(eligible) };
  return {
    db,
    hooks,
    engine: createFavorites({ db: pool, table: binding?.table, bounds: binding?.bounds, hooks }),
  };
}

describe("Favorites with Runnable processes on (v3 contract, section 3)", () => {
  it("mounts four routes behind the tile's Required sign-in, with a hooks file and its table", () => {
    const tile = report(bundle).processes.tiles.find((item) => item.tile === "account-api");
    expect(report(bundle).processes.runnable).toBe(true);
    expect(tile?.templates).toEqual([
      { selection: "account-check", template: "verified-identity", level: "mounted" },
      { selection: "favorite-items", template: "favorites", level: "mounted" },
    ]);
    expect(
      tile?.routes
        .filter((item) => item.path.startsWith("/modules/favorite-items"))
        .map((item) => [item.method, item.path, item.answers]),
    ).toEqual([
      [
        "PUT",
        "/modules/favorite-items/items/:itemId",
        '501 "Not implemented: eligible for Favorite items" until its hooks are written; 200 {itemId, addedAt} once written, or 404 NOT_ELIGIBLE, 409 FAVORITES_FULL at 1000',
      ],
      ["DELETE", "/modules/favorite-items/items/:itemId", "204, also when it isn't a favorite"],
      [
        "GET",
        "/modules/favorite-items/items/:itemId",
        "200 {itemId, addedAt}, or 404 NOT_FAVORITE",
      ],
      ["GET", "/modules/favorite-items/items", "200 {items, next}: newest first, 50 to a page"],
    ]);
    expect(tile?.hooks).toContainEqual({
      selection: "favorite-items",
      file: "src/modules/account-api/favorite-items.hooks.ts",
      hooks: ["eligible"],
    });
    // The process mounts it inside the guard's routes, with the guard's principal.
    const process = text(bundle, "src/processes/account-api.ts");
    expect(process).toContain("const routes = accountCheck.routes(open);");
    expect(process).toContain(
      'mountFavorites(notImplementedRoutes(routes, log, "favorite-items"), {',
    );
    expect(process).toContain("principal: (request) => accountCheck.require(request),");
    expect(process).toContain("hooks: favoriteItemsHooks({ items }),");
    expect(config().templates["favorite-items"]).toEqual({
      template: "favorites",
      lead: "favorite-items",
      table: { schema: "favorite_items", table: "favorites" },
      bounds: {
        itemPattern: "^[A-Za-z0-9._:-]{1,200}$",
        accountCharacters: 255,
        perAccount: 1000,
        pageSize: 50,
      },
      routes: "/modules/favorite-items/items",
    });
    // The hooks file is yours: `eligible` on the items Data access's pool.
    const hooks = text(bundle, "src/modules/account-api/favorite-items.hooks.ts");
    expect(bundle.manifest.files.find((item) => item.path.endsWith(".hooks.ts"))?.ownership).toBe(
      "generated-extension",
    );
    expect(hooks).toContain("export type FavoriteItemsResources = { items: pg.Pool };");
    expect(hooks).toContain('throw new NotImplemented("eligible for Favorite items");');
    // Its gap names the file; Catalog writer stays its own stub.
    expect(report(bundle).gaps.map((item) => [item.id, item.status, item.required])).toEqual([
      ["favorites-application-bindings", "custom", true],
      ["module-catalog-writer", "custom", true],
    ]);
  });

  it("creates the template's own table and grants its tile only select, insert and delete", () => {
    expect(text(bundle, "infra/postgres/favorites/100-favorite-items.sql")).toBe(
      `CREATE SCHEMA IF NOT EXISTS "favorite_items";
REVOKE ALL ON SCHEMA "favorite_items" FROM PUBLIC;
CREATE TABLE "favorite_items"."favorites" (
 account text NOT NULL CHECK(length(account) BETWEEN 1 AND 255),
 item text NOT NULL CHECK(item ~ '^[A-Za-z0-9._:-]{1,200}$'),
 added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(account, item)
);
CREATE INDEX ON "favorite_items"."favorites"(account, added_at DESC, item);
`,
    );
    const local = JSON.parse(text(bundle, "infra/local.json"));
    expect(local.grants).toEqual([
      {
        host: "account-api",
        kind: "table",
        privileges: ["SELECT", "INSERT", "DELETE"],
        relation: "favorites",
        resource: "favorites",
        schema: "favorite_items",
      },
    ]);
    expect(local.logins.map((item: { user: string }) => item.user)).toEqual([
      "r_favorites__account_api",
      "r_catalog__account_api",
    ]);
    // Favorites writes its database, so it has its own product file; it publishes no view.
    expect(report(bundle).modules.find((item) => item.module === "favorite-items")?.sql).toEqual([
      {
        database: "favorites",
        file: "infra/postgres/favorites/modules/favorite-items.sql",
        schema: "m_favorite_items",
      },
    ]);
    expect(local.views).toEqual([]);
    // Only transactions and qualified tables come with it: no outbox or receipts.
    const runtime = bundle.files
      .map((item) => item.path)
      .filter((p) => p.startsWith("src/runtime/"));
    expect(runtime).toContain("src/runtime/favorites.ts");
    expect(runtime).toContain("src/runtime/transaction.ts");
    expect(runtime).not.toContain("src/runtime/outbox.ts");
  });

  it("refuses to mount without its tile's Required sign-in, and takes its bounds from the policy", () => {
    const model = JSON.parse(text(bundle, ".jeeves/normalized.json")) as {
      selections: Parameters<typeof httpMounts>[1];
      processes: Parameters<typeof httpMounts>[0][];
    };
    const process = model.processes.find((item) => item.tile === "account-api");
    if (!process) throw new Error("No process");
    const without = model.selections.filter((item) => item.id !== "account-check");
    expect(() => httpMounts(process, without)).toThrow("Favorites needs its tile's Auth guard.");
    const optional = model.selections.map((item) =>
      item.id === "account-check"
        ? { ...item, inputs: { ...item.inputs, "guard.signIn": "optional" } }
        : item,
    );
    expect(() => httpMounts(process, optional)).toThrow(
      "Favorites needs its tile's Auth guard set to Required.",
    );
    const selection = model.selections.find((item) => item.id === "favorite-items");
    if (!selection) throw new Error("No selection");
    expect(favoritesBounds(selection)).toEqual(config().templates["favorite-items"]?.bounds);
    expect(() => favoritesBounds({ ...selection, policies: [] })).toThrow(
      "Bind the favorites policy.",
    );
  });
});

describe("Favorites with Runnable processes off", () => {
  it("emits the engine and an unfinished gap, and mounts nothing", () => {
    const off = assemble(false);
    const paths = off.files.map((item) => item.path);
    expect(paths).toContain("src/runtime/favorites.ts");
    expect(paths.filter((p) => p.startsWith("src/processes/"))).toEqual([]);
    expect(paths.some((p) => p.endsWith(".hooks.ts"))).toBe(false);
    expect(paths).not.toContain("infra/postgres/favorites/100-favorite-items.sql");
    expect(
      report(off).gaps.find((item) => item.id === "favorites-application-bindings"),
    ).toMatchObject({ status: "unfinished", required: true });
  });
});

describe("the emitted Favorites engine, on PGlite", () => {
  it("adds an eligible item once, checks, lists and removes it, per account", async () => {
    const { engine, hooks } = await favorites();
    const added = await engine.add(alice, "item-1");
    expect(added).toEqual({
      itemId: "item-1",
      addedAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/),
    });
    // Again: the same favorite, and eligibility isn't asked twice.
    expect(await engine.add(alice, "item-1")).toEqual(added);
    expect(hooks.eligible).toHaveBeenCalledTimes(1);
    expect(await engine.check(alice, "item-1")).toEqual(added);
    await expect(engine.check(bob, "item-1")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FAVORITE",
    });
    expect(await engine.list(bob)).toEqual({ items: [], next: null });
    await engine.remove(alice, "item-1");
    await engine.remove(alice, "item-1");
    await expect(engine.check(alice, "item-1")).rejects.toMatchObject({ code: "NOT_FAVORITE" });
    // Checking, listing and removing never ask.
    expect(hooks.eligible).toHaveBeenCalledTimes(1);
  });

  it("refuses an ineligible item (404) and a bad ID (400), and keeps 200 characters", async () => {
    const { engine, hooks } = await favorites(async (itemId) => itemId !== "hidden");
    await expect(engine.add(alice, "hidden")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_ELIGIBLE",
      message: "This item can't be added to favorites.",
    });
    for (const bad of ["", "a/b", "a b", "é", "x".repeat(201), undefined, 7])
      await expect(engine.add(alice, bad)).rejects.toMatchObject({
        statusCode: 400,
        code: "ITEM_ID",
      });
    expect(hooks.eligible).toHaveBeenCalledTimes(1);
    const long = `A-z.0_9:${"x".repeat(192)}`;
    expect(long).toHaveLength(200);
    expect((await engine.add(alice, long)).itemId).toBe(long);
    await expect(engine.add({ subject: "", claims: {} }, "a")).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_ID",
    });
  });

  it("lists newest first, 50 to a page, and refuses the 1,001st with 409", async () => {
    const { engine } = await favorites();
    for (let n = 1; n <= 1000; n += 1) await engine.add(alice, `item-${n}`);
    await engine.add(bob, "item-1");
    await expect(engine.add(alice, "item-1001")).rejects.toMatchObject({
      statusCode: 409,
      code: "FAVORITES_FULL",
    });
    // Re-adding one already there is still 200 at the bound.
    expect((await engine.add(alice, "item-7")).itemId).toBe("item-7");
    const first = await engine.list(alice);
    expect(first.items).toHaveLength(50);
    expect(first.items[0]?.itemId).toBe("item-1000");
    expect(first.items[49]?.itemId).toBe("item-951");
    const seen = [...first.items];
    for (let next = first.next; next; ) {
      const page = await engine.list(alice, next);
      seen.push(...page.items);
      next = page.next;
    }
    expect(seen).toHaveLength(1000);
    expect(new Set(seen.map((item) => item.itemId)).size).toBe(1000);
    expect(seen.at(-1)?.itemId).toBe("item-1");
    for (const bad of ["", "nope", Buffer.from('["x","y"]').toString("base64url"), ["a"]])
      await expect(engine.list(alice, bad)).rejects.toMatchObject({
        statusCode: 400,
        code: "CURSOR",
      });
    // Removing makes room again.
    await engine.remove(alice, "item-1");
    expect((await engine.add(alice, "item-1001")).itemId).toBe("item-1001");
  }, 60_000);
});

describe("the emitted Favorites routes and hooks file", () => {
  type Handler = (request: unknown, reply?: unknown) => Promise<unknown>;
  const routes = () => {
    const mounted = new Map<string, Handler>();
    return {
      mounted,
      route(options: { method: string; url: string; handler: Handler }) {
        mounted.set(`${options.method} ${options.url}`, options.handler);
      },
    };
  };
  const reply = () => {
    const state = { status: 200, sent: false };
    const self = {
      state,
      code(status: number) {
        state.status = status;
        return self;
      },
      send() {
        state.sent = true;
        return self;
      },
    };
    return self;
  };
  const request = (itemId?: string, query: Record<string, unknown> = {}) => ({
    method: "GET",
    params: itemId === undefined ? {} : { "*": itemId },
    query,
    headers: {},
  });

  it("answers 501 naming eligible until it is written, and reaches each operation by route", async () => {
    const { pool } = await database();
    const binding = config().templates["favorite-items"];
    const log = vi.fn();
    const open = routes();
    const principal = vi.fn(async () => alice);
    const mount = (hooks: unknown) =>
      mountFavorites(notImplementedRoutes(open, log, "favorite-items"), {
        base: "/modules/favorite-items/items",
        favorites: createFavorites({
          db: pool,
          table: binding?.table,
          bounds: binding?.bounds,
          hooks,
        }),
        principal,
      });
    mount(favoriteItemsHooks({ items: { query: vi.fn() } }));
    expect([...open.mounted.keys()]).toEqual([
      "PUT /modules/favorite-items/items/*",
      "DELETE /modules/favorite-items/items/*",
      "GET /modules/favorite-items/items/*",
      "GET /modules/favorite-items/items",
    ]);
    const call = (key: string, incoming: unknown, answer: unknown = reply()) => {
      const handler = open.mounted.get(key);
      if (!handler) throw new Error(`Not mounted: ${key}`);
      return handler(incoming, answer);
    };
    await expect(
      call("PUT /modules/favorite-items/items/*", request("item-1")),
    ).rejects.toMatchObject({
      statusCode: 501,
      code: "NOT_IMPLEMENTED",
      message: "Not implemented: eligible for Favorite items",
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ module: "favorite-items", what: "eligible for Favorite items" }),
    );
    // Written (here, a fake): the same routes add, check, list and remove.
    mount({ eligible: async () => true });
    const long = "x".repeat(200);
    const added = await call("PUT /modules/favorite-items/items/*", request(long));
    expect(added).toMatchObject({ itemId: long });
    expect(await call("GET /modules/favorite-items/items/*", request(long))).toEqual(added);
    expect(await call("GET /modules/favorite-items/items", request())).toEqual({
      items: [added],
      next: null,
    });
    const deleted = reply();
    await call("DELETE /modules/favorite-items/items/*", request(long), deleted);
    expect(deleted.state).toEqual({ status: 204, sent: true });
    await expect(call("GET /modules/favorite-items/items/*", request(long))).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FAVORITE",
    });
    await expect(call("PUT /modules/favorite-items/items/*", request(""))).rejects.toMatchObject({
      statusCode: 400,
      code: "ITEM_ID",
    });
    await expect(
      call("GET /modules/favorite-items/items", request(undefined, { after: "bad" })),
    ).rejects.toMatchObject({ statusCode: 400, code: "CURSOR" });
    expect(principal).toHaveBeenCalled();
  });
});
