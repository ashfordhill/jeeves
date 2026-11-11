import { PGlite } from "@electric-sql/pglite";
import type { DesignDocument, StudioCommand } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";
import { migrateWithProducts } from "./local.ts";

const registry = loadLocalV2Registry();
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
const assemble = (design: DesignDocument) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
type Bundle = ReturnType<typeof assemble>;
const file = (bundle: Bundle, path: string) => bundle.files.find((item) => item.path === path);
const text = (bundle: Bundle, path: string) => {
  const found = file(bundle, path);
  if (!found) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(found.bytes);
};
const json = (bundle: Bundle, path: string) => JSON.parse(text(bundle, path));
const asset = (path: string) =>
  registry.asset(`jeeves-generator/templates/local-v2/assets/${path}`);
type ModuleRow = { module: string; sql?: { database: string; file: string; schema: string }[] };
const modules = (bundle: Bundle) =>
  (bundle.report as unknown as { modules: ModuleRow[] }).modules.filter((row) => row.sql);

/** The product step (v3 contract, section 1), on the export's own `products.mjs`. */
const products = (await import(
  new URL("../../templates/local-v2/assets/scripts/products.mjs", import.meta.url).href
)) as {
  applyProductSql(
    owner: Client,
    db: Db,
    quote: (name: string) => string,
    read?: (path: string) => string,
  ): Promise<void>;
  grantProductSql(
    owner: Client,
    db: Db,
    runtime: { user: string; host: string; provider?: string }[],
    quote: (name: string) => string,
  ): Promise<void>;
};
type Client = { query(sql: string): Promise<unknown> };
type Db = {
  database: string;
  modules?: { module: string; host: string; schema: string; file: string }[];
};
/** `common.mjs`'s rule, without its side effects. */
const quote = (name: string) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("Invalid bounded SQL identity");
  return `"${name}"`;
};

describe("product tables and published views (v3 contract, section 1)", () => {
  const v2 = assemble(runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on]));
  const v2Off = assemble(moduleAuthored(tileLevelTwin(), registry.installed));
  const stack = assemble(runStudioCommands(stubStackDesign(), [on]));

  it("gives each module that writes a database its own SQL file, a header only", () => {
    const sql = (bundle: Bundle) =>
      bundle.files.map((item) => item.path).filter((path) => path.includes("/modules/"));
    expect(sql(v2).filter((path) => path.endsWith(".sql"))).toEqual([
      "infra/postgres/metadata-db/modules/handler-writer.sql",
      "infra/postgres/metadata-db/modules/upload-state-writer.sql",
      "infra/postgres/view-counts/modules/counter-writer.sql",
    ]);
    expect(sql(stack).filter((path) => path.endsWith(".sql"))).toEqual([
      "infra/postgres/links-db/modules/link-reader.sql",
    ]);
    // Yours to write, like a hooks file: the manifest says so.
    for (const path of sql(v2).filter((item) => item.endsWith(".sql")))
      expect(v2.manifest.files.find((record) => record.path === path)?.ownership).toBe(
        "generated-extension",
      );
    const header = text(v2, "infra/postgres/metadata-db/modules/handler-writer.sql");
    expect(header.split("\n").every((line) => line === "" || line.startsWith("--"))).toBe(true);
    for (const words of [
      "-- Lifecycle writer in Video lifecycle worker writes Metadata database",
      "the setup-only owner o_metadata_db of d_metadata_db",
      "search_path m_handler_writer",
      "Keep it re-runnable (IF NOT EXISTS, CREATE OR",
      "only r_metadata_db__completion_handler (Video lifecycle worker) selects, inserts",
      "CREATE OR REPLACE VIEW published.<name>",
      "--   r_metadata_db__watch (Watch API)",
      "--   upload_multipart.assets",
    ])
      expect(header).toContain(words);
    expect(text(v2, "infra/postgres/view-counts/modules/counter-writer.sql")).toContain(
      "-- Template views:\n--   counter_sum_public.totals\n",
    );
    expect(text(stack, "infra/postgres/links-db/modules/link-reader.sql")).toContain(
      "-- Link reader, a Data access, in Links API writes Links database",
    );
  });

  it("lists each database's writers in infra/local.json and the report, only with processes on", () => {
    const plan = json(v2, "infra/local.json");
    expect(
      plan.databases.map((db: { resource: string; modules?: unknown }) => [
        db.resource,
        db.modules,
      ]),
    ).toEqual([
      [
        "metadata-db",
        [
          {
            module: "handler-writer",
            host: "completion-handler",
            schema: "m_handler_writer",
            file: "infra/postgres/metadata-db/modules/handler-writer.sql",
          },
          {
            module: "upload-state-writer",
            host: "upload",
            schema: "m_upload_state_writer",
            file: "infra/postgres/metadata-db/modules/upload-state-writer.sql",
          },
        ],
      ],
      [
        "view-counts",
        [
          {
            module: "counter-writer",
            host: "view-counter",
            schema: "m_counter_writer",
            file: "infra/postgres/view-counts/modules/counter-writer.sql",
          },
        ],
      ],
      // The identity's database has no product step.
      ["identity", undefined],
    ]);
    expect(modules(v2).map((row) => [row.module, row.sql])).toEqual([
      [
        "counter-writer",
        [
          {
            database: "view-counts",
            file: "infra/postgres/view-counts/modules/counter-writer.sql",
            schema: "m_counter_writer",
          },
        ],
      ],
      [
        "upload-state-writer",
        [
          {
            database: "metadata-db",
            file: "infra/postgres/metadata-db/modules/upload-state-writer.sql",
            schema: "m_upload_state_writer",
          },
        ],
      ],
      [
        "handler-writer",
        [
          {
            database: "metadata-db",
            file: "infra/postgres/metadata-db/modules/handler-writer.sql",
            schema: "m_handler_writer",
          },
        ],
      ],
    ]);
    // Off: no file, no list, no product step, and the export keeps migrate.mjs's bytes.
    expect(
      v2Off.files.some((item) => item.path.includes("/modules/") && item.path.endsWith(".sql")),
    ).toBe(false);
    expect(file(v2Off, "scripts/products.mjs")).toBeUndefined();
    expect(json(v2Off, "infra/local.json").databases.some((db: object) => "modules" in db)).toBe(
      false,
    );
    expect(file(v2Off, "scripts/migrate.mjs")?.bytes).toEqual(asset("scripts/migrate.mjs"));
    expect(modules(v2Off)).toEqual([]);
  });

  it("runs the product step from migrate.mjs, substituted exactly once", () => {
    const original = new TextDecoder().decode(asset("scripts/migrate.mjs"));
    const migrate = text(v2, "scripts/migrate.mjs");
    expect(text(v2, "scripts/products.mjs")).toBe(
      new TextDecoder().decode(asset("scripts/products.mjs")),
    );
    const added = migrate.split("\n").filter((line) => !original.split("\n").includes(line));
    expect(added).toEqual([
      'import { applyProductSql, grantProductSql } from "./products.mjs";',
      "      // Product tables: each writer module's own SQL file, re-run every time in its schema.",
      "      await applyProductSql(owner, db, quote);",
      "      await grantProductSql(owner, db, runtime, quote);",
    ]);
    // After the views, before the template grants; its grants just before COMMIT.
    const at = (words: string) => migrate.indexOf(words);
    expect(at("CREATE OR REPLACE VIEW")).toBeLessThan(at("await applyProductSql"));
    expect(at("await applyProductSql")).toBeLessThan(at("for (const login of runtime) {"));
    expect(at("GRANT ${grant.privileges")).toBeLessThan(at("await grantProductSql"));
    expect(at("await grantProductSql")).toBeLessThan(at('owner.query("COMMIT")'));
    // An asset whose anchor is missing or doubled is refused, never half-substituted.
    const bytes = (value: string) => new TextEncoder().encode(value);
    expect(() =>
      migrateWithProducts(bytes(original.replace('await owner.query("COMMIT");', ""))),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ASSET" }));
    expect(() =>
      migrateWithProducts(bytes(`${original}\n      await owner.query("COMMIT");\n`)),
    ).toThrowError(expect.objectContaining({ code: "INVALID_ASSET" }));
  });

  it("says in each process's stores what its database login reads", () => {
    type Store = { store: string; provisioned?: string };
    const rows = (bundle: Bundle, tile: string) =>
      (
        bundle.report as unknown as { processes: { tiles: { tile: string; stores: Store[] }[] } }
      ).processes.tiles.find((row) => row.tile === tile)?.stores ?? [];
    expect(rows(stack, "links-api").find((row) => row.store === "links-db")?.provisioned).toBe(
      "PostgreSQL database d_links_db, login r_links_db__links_api (CONNECT, USAGE on public; SELECT on published; its own tables in m_link_reader)",
    );
    expect(rows(stack, "visit-worker").find((row) => row.store === "links-db")?.provisioned).toBe(
      "PostgreSQL database d_links_db, login r_links_db__visit_worker (CONNECT, USAGE on public; SELECT on published)",
    );
  });
});

describe("products.mjs on PostgreSQL (PGlite)", () => {
  const file = "infra/postgres/items/modules/item-writer.sql";
  const db: Db = {
    database: "d_items",
    modules: [{ module: "item-writer", host: "item-counter", schema: "m_item_writer", file }],
  };
  const runtime = [
    { user: "r_items__item_counter", host: "item-counter" },
    { user: "r_items__reader_api", host: "reader-api" },
  ];
  const first = `-- header
CREATE TABLE IF NOT EXISTS items (id text PRIMARY KEY, title text NOT NULL, visible boolean NOT NULL);
INSERT INTO items VALUES ('a', 'Apple', true), ('b', 'Hidden', false) ON CONFLICT DO NOTHING;
CREATE OR REPLACE VIEW published.items AS SELECT id, title FROM items WHERE visible;
`;
  /** The owner's one migration transaction, as migrate.mjs runs it. */
  const migrate = async (pg: PGlite, sql: string) => {
    const owner = { query: (statement: string) => pg.exec(statement) };
    await pg.exec("SET ROLE o_items; BEGIN");
    try {
      await products.applyProductSql(owner, db, quote, () => sql);
      await products.grantProductSql(owner, db, runtime, quote);
      await pg.exec("COMMIT");
    } catch (error) {
      await pg.exec("ROLLBACK");
      throw error;
    } finally {
      await pg.exec("RESET ROLE");
    }
  };
  const as = async (pg: PGlite, user: string, sql: string) => {
    await pg.exec(`SET ROLE ${user}`);
    try {
      return (await pg.query<Record<string, unknown>>(sql)).rows;
    } finally {
      await pg.exec("RESET ROLE");
    }
  };
  const denied = async (pg: PGlite, user: string, sql: string) => {
    try {
      await as(pg, user, sql);
    } catch (error) {
      return (error as Error).message;
    }
    return "allowed";
  };
  const database = async () => {
    const pg = new PGlite();
    await pg.exec(`CREATE ROLE o_items; CREATE ROLE r_items__item_counter; CREATE ROLE r_items__reader_api;
      GRANT CREATE ON DATABASE postgres TO o_items;
      SET ROLE o_items; CREATE SCHEMA item_count; CREATE TABLE item_count.totals (id text PRIMARY KEY, n int); RESET ROLE;`);
    return pg;
  };

  it("lets every login read published views, and only the writer's tile its own tables", async () => {
    const pg = await database();
    await migrate(pg, first);
    expect(await as(pg, "r_items__reader_api", "SELECT * FROM published.items")).toEqual([
      { id: "a", title: "Apple" },
    ]);
    expect(await denied(pg, "r_items__reader_api", "SELECT * FROM m_item_writer.items")).toBe(
      "permission denied for schema m_item_writer",
    );
    expect(
      await denied(pg, "r_items__reader_api", "INSERT INTO published.items VALUES ('c', 'C')"),
    ).toMatch(/permission denied/);
    // The writer's tile uses its tables, and reads published too; nobody reads public's.
    await as(
      pg,
      "r_items__item_counter",
      "INSERT INTO m_item_writer.items VALUES ('c', 'Cherry', true)",
    );
    expect(
      await as(pg, "r_items__item_counter", "SELECT count(*)::int AS n FROM m_item_writer.items"),
    ).toEqual([{ n: 3 }]);
    expect(
      await as(pg, "r_items__item_counter", "SELECT id FROM published.items ORDER BY id"),
    ).toEqual([{ id: "a" }, { id: "c" }]);
    // Unqualified names landed in the module's schema, and search_path was reset after.
    expect(
      (
        await pg.query(
          "SELECT table_schema FROM information_schema.tables WHERE table_name = 'items' ORDER BY 1",
        )
      ).rows,
    ).toEqual([{ table_schema: "m_item_writer" }, { table_schema: "published" }]);
    // A view the owner adds later is covered by the default privileges.
    await pg.exec(
      "SET ROLE o_items; CREATE VIEW published.titles AS SELECT title FROM m_item_writer.items; RESET ROLE",
    );
    expect(
      await as(pg, "r_items__reader_api", "SELECT count(*)::int AS n FROM published.titles"),
    ).toEqual([{ n: 3 }]);
    await pg.close();
  });

  it("re-runs at every start: an edited file applies and data is kept; a failing one changes nothing", async () => {
    const pg = await database();
    await migrate(pg, first);
    await as(
      pg,
      "r_items__item_counter",
      "INSERT INTO m_item_writer.items VALUES ('c', 'Cherry', true)",
    );
    // The same file again is a no-op.
    await migrate(pg, first);
    // The next start's edited file: a new column and a wider view.
    const edited = `${first}ALTER TABLE items ADD COLUMN IF NOT EXISTS price int NOT NULL DEFAULT 0;
UPDATE items SET price = 3 WHERE id = 'c';
CREATE OR REPLACE VIEW published.items AS SELECT id, title, price FROM items WHERE visible;
`;
    await migrate(pg, edited);
    expect(
      await as(pg, "r_items__reader_api", "SELECT * FROM published.items ORDER BY id"),
    ).toEqual([
      { id: "a", title: "Apple", price: 0 },
      { id: "c", title: "Cherry", price: 3 },
    ]);
    // A failing file names itself and rolls the whole database back.
    await expect(migrate(pg, `${edited}CREATE TABLE broken (;`)).rejects.toThrow(
      `Product SQL ${file} failed`,
    );
    expect(
      await as(pg, "r_items__reader_api", "SELECT count(*)::int AS n FROM published.items"),
    ).toEqual([{ n: 2 }]);
    expect((await pg.query("SELECT to_regclass('m_item_writer.broken') AS t")).rows).toEqual([
      { t: null },
    ]);
    // A database without a product step (an identity's) is left alone.
    await products.applyProductSql(
      { query: () => Promise.reject(new Error("no")) },
      { database: "i_x" },
      quote,
    );
    await pg.close();
  });
});
