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
type ModuleRow = {
  module: string;
  sql?: { database: string; file: string; schema: string }[];
};
const modules = (bundle: Bundle) =>
  (bundle.report as unknown as { modules: ModuleRow[] }).modules.filter((row) => row.sql);

describe("product tables and published views (v3 contract, section 1)", () => {
  const v2 = assemble(runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on]));
  const v2Off = assemble(moduleAuthored(tileLevelTwin(), registry.installed));
  const stack = assemble(runStudioCommands(stubStackDesign(), [on]));

  it("emits one application-owned initial migration per namespace and no re-runnable module files", () => {
    const migrations = v2.files.filter((item) => item.path.includes("/products/migrations/"));
    expect(migrations.map((item) => item.path)).toEqual([
      "infra/postgres/metadata-db/products/migrations/p_upload_owner/0001-initial.sql",
      "infra/postgres/view-counts/products/migrations/m_counter_writer/0001-initial.sql",
    ]);
    expect(v2.files.some((item) => /\/modules\/.*\.sql$/.test(item.path))).toBe(false);
    for (const item of migrations) {
      expect(v2.manifest.files.find((record) => record.path === item.path)?.ownership).toBe(
        "generated-extension",
      );
      expect(new TextDecoder().decode(item.bytes)).toContain(
        "Append versions; never change an applied migration",
      );
    }
    const declarations = json(v2, "infra/postgres/metadata-db/products.json");
    expect(declarations.namespaces).toHaveLength(1);
    expect(declarations.namespaces[0].schema).toBe("p_upload_owner");
    expect(declarations.operations).toEqual([]);
    expect(stack.files.some((item) => item.path.endsWith("/products/queries/example.sql"))).toBe(
      true,
    );
    expect(stack.files.some((item) => item.path.endsWith("/products/commands/example.sql"))).toBe(
      true,
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
            schema: "p_upload_owner",
            file: "infra/postgres/metadata-db/products/migrations/p_upload_owner/0001-initial.sql",
          },
          {
            module: "upload-state-writer",
            host: "upload",
            schema: "p_upload_owner",
            file: "infra/postgres/metadata-db/products/migrations/p_upload_owner/0001-initial.sql",
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
            file: "infra/postgres/view-counts/products/migrations/m_counter_writer/0001-initial.sql",
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
            file: "infra/postgres/view-counts/products/migrations/m_counter_writer/0001-initial.sql",
            schema: "m_counter_writer",
          },
        ],
      ],
      [
        "upload-state-writer",
        [
          {
            database: "metadata-db",
            file: "infra/postgres/metadata-db/products/migrations/p_upload_owner/0001-initial.sql",
            schema: "p_upload_owner",
          },
        ],
      ],
      [
        "handler-writer",
        [
          {
            database: "metadata-db",
            file: "infra/postgres/metadata-db/products/migrations/p_upload_owner/0001-initial.sql",
            schema: "p_upload_owner",
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
      "    ...plan.productLogins,",
      "    for (const namespace of db.productSql?.namespaces ?? []) {",
      '      if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [namespace.role])).rowCount)',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: exact emitted script assertion
      "        await admin.query(`CREATE ROLE ${quote(namespace.role)} NOLOGIN NOINHERIT`);",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: exact emitted script assertion
      "      await admin.query(`GRANT ${quote(namespace.role)} TO ${quote(db.owner)} WITH INHERIT FALSE, SET TRUE`);",
      "    const runtime = [...plan.logins, ...plan.providerLogins, ...plan.productLogins].filter(",
      "      // Product migrations: ordered checksums under a restricted namespace role.",
      "      await applyProductSql(owner, db, quote);",
      "        if (login.product) continue;",
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

  it("applies a stub's idempotency records (050-) before template migrations (100-) and product SQL (QL04)", () => {
    const migrations = (bundle: Bundle, resource: string) =>
      json(bundle, "infra/local.json").databases.find(
        (db: { resource: string }) => db.resource === resource,
      )?.migrations as string[];
    expect(migrations(stack, "links-db")).toEqual([
      "infra/postgres/links-db/000-foundation.sql",
      "infra/postgres/links-db/050-jeeves-idempotency.sql",
    ]);
    expect(migrations(v2, "metadata-db")).toEqual([
      "infra/postgres/metadata-db/000-foundation.sql",
      "infra/postgres/metadata-db/100-handler-writer.sql",
      "infra/postgres/metadata-db/100-upload-multipart.sql",
    ]);
    // The plan lists a database's migrations sorted by path, so 050- falls between 000- and 100-.
    const one = ["100-handler-writer", "050-jeeves-idempotency", "000-foundation"].map(
      (name) => `infra/postgres/metadata-db/${name}.sql`,
    );
    expect(one.toSorted()).toEqual([one[2], one[1], one[0]]);
    // setup applies them in that order, each once, and only then the product step.
    const migrate = text(stack, "scripts/migrate.mjs");
    expect(migrate.indexOf("for (const path of db.migrations) {")).toBeGreaterThan(0);
    expect(migrate.indexOf("for (const path of db.migrations) {")).toBeLessThan(
      migrate.indexOf("await applyProductSql"),
    );
  });

  it("says in each process's stores what its database login reads", () => {
    type Store = { store: string; provisioned?: string };
    const rows = (bundle: Bundle, tile: string) =>
      (
        bundle.report as unknown as {
          processes: { tiles: { tile: string; stores: Store[] }[] };
        }
      ).processes.tiles.find((row) => row.tile === tile)?.stores ?? [];
    expect(rows(stack, "links-api").find((row) => row.store === "links-db")?.provisioned).toBe(
      "PostgreSQL database d_links_db, login r_links_db__links_api (CONNECT, USAGE on public; no declared product access; its idempotency records in jeeves.idempotency_records; no product DDL or migration credential)",
    );
    expect(rows(stack, "visit-worker").find((row) => row.store === "links-db")?.provisioned).toBe(
      "PostgreSQL database d_links_db, login r_links_db__visit_worker (CONNECT, USAGE on public; no declared product access; no product DDL or migration credential)",
    );
  });
});
