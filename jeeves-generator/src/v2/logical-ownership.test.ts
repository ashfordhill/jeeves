import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  applyOperations,
  buildStudioCommand,
  designBlueprintV3,
  designOwnership,
  resolveGeneration,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { ownershipDesign } from "../../../field-projects/generator-system/fixtures/rg-ownership/design.ts";
import { favoritesStackDesign } from "../../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { rekeyDesign } from "../../../jeeves/packages/spec/src/studio-rekey.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const generate = (design = ownershipDesign()) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
const text = (bundle: ReturnType<typeof generate>, path: string) =>
  new TextDecoder().decode(bundle.files.find((file) => file.path === path)?.bytes);
const quote = (name: string) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("bad SQL identity");
  return `"${name}"`;
};

describe("RG06 explicit logical ownership and emitted SQL", () => {
  it("offers the same implemented API owner targets to mouse and commands", () => {
    const source = runStudioCommands(favoritesStackDesign(), [
      {
        type: "addTile",
        from: { tile: "account-api" },
        side: "after",
        tile: { id: "owner-jobs", name: "Owner jobs", kind: "queue" },
        linkId: "owner-jobs-link",
      },
      {
        type: "addTile",
        from: { tile: "owner-jobs" },
        side: "after",
        tile: { id: "owner-worker", name: "Owner worker", kind: "worker" },
        linkId: "owner-worker-link",
      },
      { type: "addModule", host: "owner-worker", kind: "custom", id: "owner-operation" },
    ]);
    const before = canonicalJson(source);
    for (const api of ["sign-in", "no-such-api", "owner-jobs", "owner-worker"])
      expect(() =>
        buildStudioCommand(source, { type: "shareOwner", worker: "owner-worker", api }),
      ).toThrow("Choose a Worker and an API tile");
    expect(canonicalJson(source)).toBe(before);
    const accepted = buildStudioCommand(source, {
      type: "shareOwner",
      worker: "owner-worker",
      api: "account-api",
    });
    expect(applyOperations(source, accepted.ops, { baseRevision: source.revision }).ok).toBe(true);
  });

  it("preserves declared permission identities on rename and on later module authoring", () => {
    const before = ownershipDesign();
    const after = runStudioCommands(before, [
      { type: "edit", element: "links-api", name: "Items API" },
      { type: "edit", element: "visit-worker", name: "Items worker" },
      {
        type: "addModule",
        host: "visit-worker",
        kind: "custom",
        id: "product-helper",
      },
    ]);
    expect(designOwnership(after)).toEqual(designOwnership(before));
    expect(designBlueprintV3(after).ownership).toEqual(designBlueprintV3(before).ownership);
    const plan = (bundle: ReturnType<typeof generate>) =>
      JSON.parse(text(bundle, "infra/local.json"));
    expect(plan(generate(after)).logins).toEqual(plan(generate(before)).logins);
    expect(
      plan(generate(after)).databases.find((db: { resource: string }) => db.resource === "links-db")
        .productState,
    ).toEqual(
      plan(generate(before)).databases.find(
        (db: { resource: string }) => db.resource === "links-db",
      ).productState,
    );
  });

  it("refuses a conflicting owner atomically, and never grants private tables to a foreign reader", () => {
    const design = ownershipDesign();
    const bytes = canonicalJson(design);
    expect(() =>
      buildStudioCommand(design, {
        type: "shareOwner",
        worker: "visit-worker",
        api: "stats-api",
      }),
    ).toThrow(/conflicting owners/);
    expect(() =>
      buildStudioCommand(design, {
        type: "setDatabaseAccess",
        role: "stats-api",
        database: "links-db",
        product: {
          tables: [{ name: "items", operations: ["UPDATE"] }],
          views: [],
        },
      }),
    ).toThrow(/Another logical owner/);
    const invalid = structuredClone(designOwnership(design));
    const reader = invalid.grants.find(
      (grant) => grant.role === "stats-api" && grant.resource === "links-db",
    );
    if (!reader) throw new Error("reader missing");
    reader.product = {
      tables: [{ name: "items", operations: ["SELECT"] }],
      views: [],
    };
    expect(
      applyOperations(design, [{ op: "setOwnership", ownership: invalid }], {
        baseRevision: design.revision,
      }).ok,
    ).toBe(false);
    expect(canonicalJson(design)).toBe(bytes);
  });

  it("refuses a conflicting owned-state connection with no partial host/module links", () => {
    const design = runStudioCommands(ownershipDesign(), [
      {
        type: "addTile",
        from: { tile: "stats-api" },
        side: "after",
        tile: { id: "private-db", name: "Private DB", kind: "database" },
        linkId: "stats-private",
      },
      { type: "addModule", host: "stats-api", kind: "data-access", id: "private-writer" },
      {
        type: "connectModule",
        module: "private-writer",
        slot: "database",
        target: { tile: "private-db" },
      },
      {
        type: "setDatabaseAccess",
        role: "stats-api",
        database: "private-db",
        product: { tables: [{ name: "items", operations: ["INSERT"] }], views: [] },
      },
      { type: "addModule", host: "visit-worker", kind: "data-access", id: "conflicting-writer" },
    ]);
    const before = canonicalJson(design);
    expect(() =>
      buildStudioCommand(design, {
        type: "connectModule",
        module: "conflicting-writer",
        slot: "database",
        target: { tile: "private-db" },
      }),
    ).toThrow(/explicit API owner conflicts/);
    expect(canonicalJson(design)).toBe(before);
  });

  it("refuses a composed owner namespace over 63 bytes even with no writer files", () => {
    const design = runStudioCommands(ownershipDesign(), [
      {
        type: "setDatabaseAccess",
        role: "links-api",
        database: "links-db",
        product: { tables: [], views: [] },
      },
      {
        type: "setDatabaseAccess",
        role: "visit-worker",
        database: "links-db",
        product: { tables: [], views: [] },
      },
    ]);
    if (design.schemaVersion !== 3 || !design.ownership) throw new Error("ownership missing");
    const old = "links-api-owner",
      long = "a".repeat(63);
    for (const owner of design.ownership.owners) if (owner.id === old) owner.id = long;
    for (const role of design.ownership.roles) if (role.owner === old) role.owner = long;
    for (const resource of design.ownership.resources)
      if (resource.authority === old) resource.authority = long;
    const result = resolveGeneration(design, registry.installed);
    expect(result.model).toBeUndefined();
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "CONFIG_INVALID",
        message: expect.stringContaining("63-byte"),
        target: expect.objectContaining({ path: ["ownership", "resources", 0, "authority"] }),
      }),
    );
    expect(() => generate(design)).toThrow();
  });

  it("refuses owner/template schema collisions even without any product SQL writer files", () => {
    const source = favoritesStackDesign();
    if (source.schemaVersion !== 3 || !source.ownership) throw new Error("ownership missing");
    const state = source.ownership.resources.find((resource) => resource.element === "favorites");
    if (state?.kind !== "source") throw new Error("state missing");
    state.productNamespace = "owner";
    rekeyDesign(source, "favorite-items", `p-${state.authority}`);
    const resolved = resolveGeneration(source, registry.installed);
    if (!resolved.model) throw new Error(JSON.stringify(resolved.findings));
    const model = structuredClone(resolved.model);
    for (const process of model.processes ?? []) delete process.writers;
    expect(model.processes?.flatMap((process) => process.writers ?? [])).toEqual([]);
    const foundation = registry.emitters.find((emitter) => emitter.id === "local.foundation");
    if (!foundation) throw new Error("foundation missing");
    expect(() =>
      foundation.render({ model, settings: resolved.settings, asset: registry.asset }),
    ).toThrow(/conflicts with a private template namespace/);
    expect(() => generate(source)).toThrow(/conflicts with a private template namespace/);
  });

  it("clears and regrants permissions without moving an API-only product namespace or SQL file", () => {
    const source = runStudioCommands(ownershipDesign(), [
      {
        type: "setDatabaseAccess",
        role: "links-api",
        database: "links-db",
        product: { tables: [], views: [] },
      },
    ]);
    const plan = (design: typeof source) =>
      JSON.parse(text(generate(design), "infra/local.json")).databases.find(
        (db: { resource: string }) => db.resource === "links-db",
      );
    const shared = plan(source);
    expect(shared.productState.schema).toBe("p_links_api_owner");
    expect(shared.modules).toHaveLength(2);
    // The API-only case has no sharedWith membership to accidentally mask allowlist coupling.
    const initial = runStudioCommands(stubStackDesign(), [
      {
        type: "setDatabaseAccess",
        role: "links-api",
        database: "links-db",
        product: { tables: [{ name: "items", operations: ["INSERT"] }], views: [] },
      },
      { type: "setRunnableProcesses", on: true },
    ]);
    const clear = runStudioCommands(initial, [
      {
        type: "setDatabaseAccess",
        role: "links-api",
        database: "links-db",
        product: { tables: [], views: [] },
      },
    ]);
    const again = runStudioCommands(clear, [
      {
        type: "setDatabaseAccess",
        role: "links-api",
        database: "links-db",
        product: { tables: [{ name: "items", operations: ["SELECT"] }], views: [] },
      },
    ]);
    for (const design of [clear, again]) {
      expect(plan(design).productState.schema).toBe(plan(initial).productState.schema);
      expect(plan(design).modules).toEqual(plan(initial).modules);
    }
  });

  it("executes the actual emitted grants: exact API/worker operations, named reader and no DDL", async () => {
    const bundle = generate();
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    const db = plan.databases.find((item: { resource: string }) => item.resource === "links-db");
    const logins = plan.logins.filter((item: { resource: string }) => item.resource === "links-db");
    expect(new Set(logins.map((item: { user: string }) => item.user)).size).toBe(3);
    expect(new Set(logins.map((item: { secret: string }) => item.secret)).size).toBe(3);
    expect(db.modules.map((item: { schema: string }) => item.schema)).toEqual([
      "p_links_api_owner",
      "p_links_api_owner",
    ]);
    const services = JSON.parse(text(bundle, "compose.yaml")).services;
    for (const login of logins) {
      expect(services[`app-${login.host}`]).toBeDefined();
      expect(JSON.stringify(services[`app-${login.host}`])).not.toContain(db.secret);
      expect(login.secret).not.toBe(db.secret);
    }
    const productScript = text(bundle, "scripts/products.mjs");
    const products = await import(
      `data:text/javascript;base64,${Buffer.from(productScript).toString("base64")}`
    );
    const pg = new PGlite();
    const emitted: string[] = [];
    const owner = {
      query: async (sql: string, parameters?: unknown[]) => {
        emitted.push(sql);
        return parameters ? pg.query(sql, parameters) : pg.exec(sql);
      },
    };
    const as = async (role: string, sql: string) => {
      await pg.exec(`SET ROLE ${quote(role)}`);
      try {
        return (await pg.query(sql)).rows;
      } finally {
        await pg.exec("RESET ROLE");
      }
    };
    try {
      await pg.exec(
        `CREATE ROLE ${db.owner}; GRANT CREATE ON DATABASE postgres TO ${db.owner}; REVOKE CREATE ON SCHEMA public FROM PUBLIC; ${logins.map((login: { user: string }) => `CREATE ROLE ${quote(login.user)} LOGIN;`).join(" ")}`,
      );
      await pg.exec(
        `SET ROLE ${db.owner}; CREATE SCHEMA jeeves; CREATE TABLE jeeves.internal (id int); BEGIN`,
      );
      await products.applyProductSql(owner, db, quote, (path: string) =>
        readFileSync(
          new URL(
            `../../../field-projects/generator-system/fixtures/rg-ownership/${path.endsWith("link-reader.sql") ? "items.sql" : "worker.sql"}`,
            import.meta.url,
          ),
          "utf8",
        ),
      );

      // Old blanket/default and schema CREATE privileges are removed before exact grants.
      await pg.exec(
        `GRANT USAGE ON SCHEMA published TO r_links_db__stats_api; GRANT SELECT ON ALL TABLES IN SCHEMA published TO r_links_db__stats_api; ALTER DEFAULT PRIVILEGES IN SCHEMA published GRANT SELECT ON TABLES TO r_links_db__stats_api; GRANT CREATE ON SCHEMA p_links_api_owner TO r_links_db__visit_worker`,
      );
      await products.grantProductSql(owner, db, logins, quote);
      await pg.exec("COMMIT; RESET ROLE");
      const api = "r_links_db__links_api",
        worker = "r_links_db__visit_worker",
        reader = "r_links_db__stats_api";
      await as(api, "INSERT INTO p_links_api_owner.items VALUES ('b','Banana')");
      await as(worker, "UPDATE p_links_api_owner.items SET title='Berry' WHERE id='b'");
      expect(await as(reader, "SELECT title FROM published.visible_items ORDER BY id")).toEqual([
        { title: "Apple" },
        { title: "Berry" },
      ]);
      for (const [role, sql] of [
        [api, "UPDATE p_links_api_owner.items SET title='wrong'"],
        [worker, "INSERT INTO p_links_api_owner.items VALUES ('c','wrong')"],
        [reader, "SELECT * FROM published.other_items"],
        [reader, "SELECT * FROM p_links_api_owner.items"],
        [reader, "UPDATE p_links_api_owner.items SET title='wrong'"],
        [reader, "SELECT * FROM jeeves.internal"],
        [api, "SELECT * FROM jeeves.internal"],
        [worker, "SELECT * FROM jeeves.internal"],
        [api, "CREATE TABLE p_links_api_owner.forbidden (id int)"],
        [worker, "ALTER TABLE p_links_api_owner.items ADD COLUMN forbidden int"],
        [reader, "CREATE VIEW published.forbidden AS SELECT 1"],
      ])
        await expect(as(role as string, sql as string)).rejects.toThrow(
          /permission denied|must be owner/,
        );
      await pg.exec(
        `SET ROLE ${db.owner}; CREATE VIEW published.later AS SELECT 1 AS n; RESET ROLE`,
      );
      await expect(as(reader, "SELECT * FROM published.later")).rejects.toThrow(
        /permission denied/,
      );
      expect(
        emitted.some((sql) => /GRANT SELECT ON ALL TABLES|DEFAULT PRIVILEGES.*GRANT/.test(sql)),
      ).toBe(false);
      const allowed = structuredClone(db.productState.access);
      db.productState.access = allowed.map((entry: { host: string }) => ({
        ...entry,
        product: { tables: [], views: [] },
      }));
      await pg.exec(`SET ROLE ${db.owner}; BEGIN`);
      await products.grantProductSql(owner, db, logins, quote);
      await pg.exec("COMMIT; RESET ROLE");
      await expect(as(api, "SELECT * FROM p_links_api_owner.items")).rejects.toThrow(
        /permission denied/,
      );
      await expect(as(reader, "SELECT * FROM published.visible_items")).rejects.toThrow(
        /permission denied/,
      );
      db.productState.access = allowed;
      await pg.exec(`SET ROLE ${db.owner}; BEGIN`);
      await products.grantProductSql(owner, db, logins, quote);
      await pg.exec("COMMIT; RESET ROLE");
      expect(await as(reader, "SELECT count(*)::int AS n FROM published.visible_items")).toEqual([
        { n: 2 },
      ]);
      // Missing/mistyped declarations fail setup rather than broadening permissions.
      db.productState.access[0].product.tables[0].name = "missing";
      await pg.exec(`SET ROLE ${db.owner}; BEGIN`);
      await expect(products.grantProductSql(owner, db, logins, quote)).rejects.toThrow(
        /missing or has the wrong kind/,
      );
      await pg.exec("ROLLBACK; RESET ROLE");
    } finally {
      await pg.close();
    }
  });
});
