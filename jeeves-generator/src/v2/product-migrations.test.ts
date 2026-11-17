import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import type { NormalizedGeneration } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { productSqlDesign } from "../../../field-projects/generator-system/fixtures/rg07/design.ts";
import {
  checkedProductSql,
  type ProductDeclaration,
  validateProductDeclaration,
} from "../../templates/local-v2/assets/src/runtime/product-contract.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { stubClients } from "./client-wiring.ts";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";
import {
  dataUrl,
  declarationFor,
  loadProducts,
  productContractUrl,
} from "./product-sql.test.helpers.ts";

const bundle = assembleV2(
  { designJson: JSON.stringify(productSqlDesign()) },
  loadLocalV2Registry(),
);
const text = (path: string) =>
  new TextDecoder().decode(bundle.files.find((row) => row.path === path)?.bytes);
const plan = JSON.parse(text("infra/local.json"));
const maximum = plan.databases.find((row: { resource: string }) => row.resource === "links-db");
const products = await loadProducts(text("scripts/products.mjs"));
const runtime = (file: string) =>
  operationImports(stripTypeScriptTypes(text(`src/runtime/${file}.ts`)));
const immutableUrl = dataUrl(runtime("hook-boundary"));
const { registeredProductOperations } = await import(
  dataUrl(
    runtime("product-operations")
      .replace('from "./product-contract.ts"', `from "${productContractUrl}"`)
      .replace('from "./hook-boundary.ts"', `from "${immutableUrl}"`),
  )
);
const { transaction } = await import(dataUrl(runtime("transaction")));
const { operation, withOperation, withEffect } = await import(operationUrl);
const quote = (name: string) => `"${name}"`;
const source = readFileSync(
  new URL(
    "../../../field-projects/generator-system/fixtures/rg07/migrations/0001-initial.sql",
    import.meta.url,
  ),
  "utf8",
);
async function fixture() {
  const pg = new PGlite();
  const declaration: ProductDeclaration = JSON.parse(
    readFileSync(
      new URL(
        "../../../field-projects/generator-system/fixtures/rg07/products.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const files = new Map<string, string>([
    [declaration.namespaces[0]?.migrations[0]?.file ?? "", source],
  ]);
  const read = (path: string) => {
    if (path === maximum.productSql.file) return JSON.stringify(declaration);
    const value = files.get(path);
    if (value === undefined) throw new Error(`Missing fixture ${path}`);
    return value;
  };
  const sql = async (statement: string, values?: unknown[]) =>
    values ? pg.query(statement, values) : (await pg.exec(statement)).at(-1);
  const owner = { query: sql };
  const ddlRole = maximum.productSql.namespaces[0].role;
  await pg.exec(`CREATE ROLE ${maximum.owner}; CREATE ROLE ${ddlRole} NOINHERIT; GRANT ${ddlRole} TO ${maximum.owner} WITH INHERIT FALSE, SET TRUE;
    REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE, CREATE ON SCHEMA public TO ${maximum.owner}; GRANT CREATE ON DATABASE postgres TO ${maximum.owner};
    ${[...plan.logins, ...plan.productLogins].map((row: { user: string }) => `CREATE ROLE ${row.user};`).join(" ")}
    SET ROLE ${maximum.owner}; CREATE SCHEMA jeeves; CREATE TABLE jeeves.protected(id int); INSERT INTO jeeves.protected VALUES (7);
    CREATE SCHEMA p_foreign; CREATE TABLE p_foreign.secrets(id int); RESET ROLE;
    GRANT USAGE ON SCHEMA jeeves TO r_links_db__links_api; GRANT SELECT,INSERT ON jeeves.protected TO r_links_db__links_api;`);
  const migrate = async () => {
    await pg.exec(`SET SESSION AUTHORIZATION ${maximum.owner}; BEGIN`);
    try {
      await products.applyProductSql(owner, maximum, quote, read);
      await products.grantProductSql(
        owner,
        maximum,
        [...plan.logins, ...plan.productLogins],
        quote,
        read,
      );
      await pg.exec("COMMIT");
    } catch (error) {
      await pg.exec("ROLLBACK");
      throw error;
    } finally {
      await pg.exec("SET SESSION AUTHORIZATION postgres");
    }
  };
  const as = async (role: string, statement: string) => {
    await pg.exec(`SET SESSION AUTHORIZATION ${role}`);
    try {
      return (await pg.query(statement)).rows;
    } finally {
      await pg.exec("SET SESSION AUTHORIZATION postgres");
    }
  };
  return { pg, declaration, files, read, migrate, as, ddlRole };
}

describe("RG07 versioned migrations and product-only SQL", () => {
  it("applies once, shares one owner ledger, appends versions, and refuses changed/missing applied content", async () => {
    const f = await fixture();
    try {
      await f.migrate();
      const namespace = f.declaration.namespaces[0];
      if (!namespace?.migrations[0]) throw new Error("missing namespace");
      // The SQL deliberately contains CREATE without IF NOT EXISTS on second version.
      const next = `infra/postgres/links-db/products/migrations/${namespace.schema}/0002-next.sql`;
      namespace.migrations.push({ version: "0002", file: next });
      f.files.set(next, "CREATE TABLE applied_once(id int); INSERT INTO applied_once VALUES (1);");
      await f.migrate();
      await f.migrate();
      expect(
        (
          await f.pg.query(
            "SELECT namespace,version FROM public.jeeves_product_migrations ORDER BY version",
          )
        ).rows,
      ).toEqual([
        { namespace: "p_links_api_owner", version: "0001" },
        { namespace: "p_links_api_owner", version: "0002" },
      ]);
      expect(
        (await f.pg.query("SELECT count(*)::int AS n FROM p_links_api_owner.applied_once")).rows,
      ).toEqual([{ n: 1 }]);
      f.files.set(next, "CREATE TABLE applied_once(id text);");
      await expect(f.migrate()).rejects.toThrow(/differs or is missing/);
      namespace.migrations.pop();
      await expect(f.migrate()).rejects.toThrow(/differs or is missing/);
      expect(
        (await f.pg.query("SELECT count(*)::int AS n FROM public.jeeves_product_migrations")).rows,
      ).toEqual([{ n: 2 }]);
      expect(new Set(maximum.modules.map((row: { schema: string }) => row.schema))).toEqual(
        new Set([namespace.schema]),
      );
    } finally {
      await f.pg.close();
    }
  });

  it("rolls back both partial schema and ledger and actually denies product DDL on protected/foreign state", async () => {
    const f = await fixture();
    try {
      await f.migrate();
      const namespace = f.declaration.namespaces[0];
      if (!namespace) throw new Error("missing namespace");
      const next = `infra/postgres/links-db/products/migrations/${namespace.schema}/0002-fail.sql`;
      namespace.migrations.push({ version: "0002", file: next });
      for (const forbidden of [
        "ALTER TABLE jeeves.protected ADD COLUMN wrong int",
        "DROP TABLE p_foreign.secrets",
        "CREATE TABLE published.wrong(id int)",
        "DELETE FROM public.jeeves_product_migrations",
      ]) {
        f.files.set(next, `CREATE TABLE partial(id int); ${forbidden};`);
        let failure: unknown;
        try {
          await f.migrate();
        } catch (error) {
          failure = error;
        }
        expect((failure as Error).message).toContain("Product migration");
        // This is the database's actual authorization error, not the declaration/token check.
        expect(((failure as Error).cause as Error).message).toMatch(
          /permission denied|must be owner/,
        );
        expect(
          (await f.pg.query("SELECT to_regclass('p_links_api_owner.partial') AS partial")).rows,
        ).toEqual([{ partial: null }]);
        expect(
          (await f.pg.query("SELECT count(*)::int AS n FROM public.jeeves_product_migrations"))
            .rows,
        ).toEqual([{ n: 1 }]);
      }
      f.files.set(next, "CREATE TABLE partial(id int); SELECT 1/0;");
      await expect(f.migrate()).rejects.toThrow(/will roll back/);
      expect(
        (await f.pg.query("SELECT to_regclass('p_links_api_owner.partial') AS partial")).rows,
      ).toEqual([{ partial: null }]);
    } finally {
      await f.pg.close();
    }
  });

  it("registered scoped handles bind parameters, reject foreign/protected operations, and make reads database READ ONLY", async () => {
    const f = await fixture();
    try {
      const queryFile = "infra/postgres/links-db/products/queries/item.sql";
      const commandFile = "infra/postgres/links-db/products/commands/item.sql";
      const relations = [{ schema: "p_links_api_owner", name: "items", operations: ["select"] }];
      f.declaration.operations.push({
        name: "item",
        host: "links-api",
        module: "link-reader",
        kind: "query",
        parameters: 1,
        file: queryFile,
        relations,
      });
      f.declaration.operations.push({
        name: "add",
        host: "links-api",
        module: "link-reader",
        kind: "command",
        parameters: 2,
        file: commandFile,
        relations: [
          { ...relations[0], schema: "p_links_api_owner", name: "items", operations: ["insert"] },
        ],
      });
      f.files.set(queryFile, "SELECT title FROM p_links_api_owner.items WHERE id=$1");
      f.files.set(commandFile, "INSERT INTO p_links_api_owner.items VALUES($1,$2)");
      await f.migrate();
      const product = plan.productLogins.find((row: { host: string }) => row.host === "links-api");
      let executed = 0;
      const executeFor =
        (user: string) => async (sql: string, values: unknown[], readOnly: boolean) => {
          executed++;
          await f.pg.exec(`SET SESSION AUTHORIZATION ${user}`);
          const pool = {
            connect: async () => ({
              query: (statement: string, params?: unknown[]) => f.pg.query(statement, params),
              release() {},
            }),
          };
          try {
            return await transaction(
              pool,
              (tx: { query(sql: string, values: unknown[]): Promise<unknown> }) =>
                tx.query(sql, values),
              { readOnly },
            );
          } finally {
            await f.pg.exec("SET SESSION AUTHORIZATION postgres");
          }
        };
      const execute = executeFor(product.user);
      const client = () =>
        registeredProductOperations(
          maximum,
          { tile: "links-api", module: "link-reader" },
          execute,
          f.read,
        );
      const call = (name: string, values: unknown[]) =>
        withOperation(operation({ maximumMs: 5000 }).context, () => client().call(name, values));
      expect(Object.keys(client())).toEqual(["call"]);
      expect(await call("item", ["a"])).toEqual({ rows: [{ title: "Apple" }], rowCount: 1 });
      await call("add", ["b", "Banana"]);
      const before = executed;
      await expect(
        withEffect("read", () => call("add", ["refused", "no widening"])),
      ).rejects.toThrow(/EFFECT_NOT_ALLOWED/);
      expect(executed).toBe(before);
      expect(await withEffect("read", () => call("item", ["a"]))).toEqual({
        rows: [{ title: "Apple" }],
        rowCount: 1,
      });
      const workerFile = "infra/postgres/links-db/products/commands/update.sql";
      f.declaration.operations.push({
        name: "rename",
        host: "visit-worker",
        module: "visit-writer",
        kind: "command",
        parameters: 2,
        file: workerFile,
        relations: [
          { schema: "p_links_api_owner", name: "items", operations: ["update", "select"] },
        ],
      });
      f.files.set(workerFile, "UPDATE p_links_api_owner.items SET title=$2 WHERE id=$1");
      const worker = plan.productLogins.find(
        (row: { host: string }) => row.host === "visit-worker",
      );
      const workerClient = registeredProductOperations(
        maximum,
        { tile: "visit-worker", module: "visit-writer" },
        executeFor(worker.user),
        f.read,
      );
      await withOperation(operation({ maximumMs: 5000 }).context, () =>
        workerClient.call("rename", ["b", "Berry"]),
      );
      const result = await call("item", ["b"]);
      expect(result).toEqual({ rows: [{ title: "Berry" }], rowCount: 1 });
      expect(Object.isFrozen(result.rows[0])).toBe(true);
      await expect(call("SELECT * FROM jeeves.protected", [])).rejects.toThrow(/Unregistered/);
      await expect(call("item", [])).rejects.toThrow(/parameters/);
      const foreign = registeredProductOperations(
        maximum,
        { tile: "stats-api", module: "published-reader" },
        execute,
        f.read,
      );
      await expect(foreign.call("item", ["a"])).rejects.toThrow(/Unregistered/);
      // Template credentials can read protected state; the actual product credential cannot.
      expect(await f.as("r_links_db__links_api", "SELECT * FROM jeeves.protected")).toEqual([
        { id: 7 },
      ]);
      for (const sql of [
        "SELECT * FROM jeeves.protected",
        "SELECT * FROM p_foreign.secrets",
        "DELETE FROM public.jeeves_product_migrations",
        "CREATE TABLE p_links_api_owner.forbidden(id int)",
      ])
        await expect(f.as(product.user, sql)).rejects.toThrow(/permission denied|must be owner/);
      // setval is a SELECT with a write effect: SQL-prefix checks alone would accept it.
      await f.pg.exec(
        `SET ROLE ${f.ddlRole}; CREATE SEQUENCE p_links_api_owner.write_effect; GRANT USAGE, UPDATE ON SEQUENCE p_links_api_owner.write_effect TO ${product.user}; RESET ROLE`,
      );
      f.files.set(queryFile, "SELECT setval('p_links_api_owner.write_effect', $1)");
      await expect(call("item", [5])).rejects.toThrow(/read-only transaction/);
      expect(
        (await f.pg.query("SELECT last_value,is_called FROM p_links_api_owner.write_effect")).rows,
      ).toEqual([{ last_value: 1, is_called: false }]);
    } finally {
      await f.pg.close();
    }
  });

  it("rejects ungranted declaration targets and transaction/lifecycle SQL without claiming a full parser", () => {
    for (const schema of ["jeeves", "public", "pg_catalog", "p_foreign"]) {
      const declaration = declarationFor(maximum);
      declaration.tables[0] = { schema, name: "items" };
      expect(() => validateProductDeclaration(declaration, maximum)).toThrow(/reserved or foreign/);
    }
    for (const sql of [
      "COMMIT",
      "RESET ROLE",
      "SELECT set_config('role','owner',true)",
      "ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC",
      "BEGIN; SELECT 1",
      "SET search_path TO jeeves",
      "DO $$ BEGIN END $$",
      "SELECT '--'; COMMIT;",
      "/* outer /* nested */ still comment */ RESET ROLE;",
      "GRANT ALL ON items TO PUBLIC",
      "CREATE FUNCTION wrong() RETURNS int AS 'x' LANGUAGE SQL",
    ])
      expect(() => checkedProductSql(sql)).toThrow(/lifecycle|dollar quoting/);
    for (const sql of [
      "SELECT '--; COMMIT' AS example",
      "/* COMMIT; SET ROLE */ SELECT 'it''s safe'",
      "UPDATE items SET title='RESET ROLE'",
      "ALTER TABLE items ALTER COLUMN title SET DEFAULT 'a'",
    ])
      expect(checkedProductSql(sql)).toBe(sql);
    const declaration = declarationFor(maximum);
    declaration.namespaces[0]?.migrations.push({ version: "0000", file: "../../bad.sql" });
    expect(() => validateProductDeclaration(declaration, maximum)).toThrow();
    declaration.tables.push({ schema: "p_links_api_owner", name: "undeclared" });
    expect(() => validateProductDeclaration(declaration, maximum)).toThrow();
  });
});

it("RG07 validates a later module's SQL and all credentials before opening or probing any client", async () => {
  const model = JSON.parse(text(".jeeves/normalized.json")) as NormalizedGeneration;
  const process = model.processes?.find((row) => row.tile === "links-api");
  if (!process) throw new Error("missing process");
  const mount = stubClients(process, model.selections, model.processes ?? []).mount;
  if (!mount) throw new Error("missing mount");
  const source = text("src/runtime/module-clients.ts");
  const prepareSource = stripTypeScriptTypes(
    source.slice(
      source.indexOf("export function prepareProductDatabase("),
      source.indexOf("export async function productDatabaseClient("),
    ),
  ).replace("export function", "function");
  const checkSource = stripTypeScriptTypes(
    source.slice(
      source.indexOf("export function checkConfiguration("),
      source.indexOf("/** The probe log"),
    ),
  ).replace("export function", "function");
  const { prepareProductOperations } = await import(
    dataUrl(
      runtime("product-operations")
        .replace('from "./product-contract.ts"', `from "${productContractUrl}"`)
        .replace('from "./hook-boundary.ts"', `from "${immutableUrl}"`),
    )
  );
  const f = await fixture();
  try {
    const query = "infra/postgres/links-db/products/queries/later.sql";
    f.declaration.operations.push({
      name: "later",
      host: "links-api",
      module: "second-product",
      kind: "query",
      parameters: 0,
      file: query,
      relations: [{ schema: "p_links_api_owner", name: "items", operations: ["select"] }],
    });
    f.files.set(query, "SELECT 1; COMMIT");
    let opened = 0,
      probes = 0;
    let missingCredential = false;
    let missingRuntimeCredential = false;
    let localOperation = false;
    const readSecret = (name: string) => {
      if (missingCredential && name === "product-links-db--links-api")
        throw new Error("Missing product credential");
      if (missingRuntimeCredential && name === "sql-links-db--links-api")
        throw new Error("Missing private replay credential");
      return "fixture-only";
    };
    const prepare = new Function(
      "productDatabases",
      "productLogins",
      "databaseEndpoint",
      "readSecret",
      "prepareProductOperations",
      "localOperationDefinition",
      "durableWorkDefinition",
      "localLogins",
      `${prepareSource}; return prepareProductDatabase;`,
    )(
      [maximum],
      plan.productLogins,
      () => ({}),
      readSecret,
      (maximum: unknown, binding: unknown) => prepareProductOperations(maximum, binding, f.read),
      () => (localOperation ? { definition: { secret: false } } : undefined),
      () => undefined,
      plan.logins,
    );
    const check = new Function(`${checkSource}; return checkConfiguration;`)();
    const names = [
      ...new Set(
        mount.imports
          .filter((row) => !row.type)
          .map((row) => row.name.split(" as ").at(-1) ?? row.name),
      ),
    ];
    const values = names.map((name) =>
      name === "prepareProductDatabase"
        ? prepare
        : name === "readSecret"
          ? readSecret
          : name === "checkConfiguration"
            ? check
            : name.endsWith("Module")
              ? {}
              : name === "createProbeLog"
                ? () => {
                    probes++;
                  }
                : /Client$|Publisher$|Target$/.test(name)
                  ? () => {
                      opened++;
                      return {};
                    }
                  : () => ({}),
    );
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    const initialize = new AsyncFunction(
      ...names,
      "config",
      "scope",
      stripTypeScriptTypes([...(mount.validation ?? []), ...(mount.setup ?? [])].join("\n")),
    );
    await expect(initialize(...values, { tile: "links-api" }, {})).rejects.toThrow(/lifecycle/);
    expect({ opened, probes }).toEqual({ opened: 0, probes: 0 });
    f.files.set(query, "SELECT title FROM p_links_api_owner.items");
    missingCredential = true;
    await expect(initialize(...values, { tile: "links-api" }, {})).rejects.toThrow(
      /Missing product credential/,
    );
    expect({ opened, probes }).toEqual({ opened: 0, probes: 0 });
    missingCredential = false;
    missingRuntimeCredential = true;
    localOperation = true;
    await expect(initialize(...values, { tile: "links-api" }, {})).rejects.toThrow(
      /Missing private replay credential/,
    );
    expect({ opened, probes }).toEqual({ opened: 0, probes: 0 });
  } finally {
    await f.pg.close();
  }
});
