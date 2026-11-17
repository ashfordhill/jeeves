import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { expect, it, vi } from "vitest";
import { cacheReaderDesign } from "../../../field-projects/generator-system/fixtures/rg-cache-reader/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";
import { productContractUrl } from "./product-sql.test.helpers.ts";

const url = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(operationImports(stripTypeScriptTypes(source))).toString("base64")}`;

it("RG13 emitted source helper validates before opening, selects the product credential and dispatches BEGIN READ ONLY", async () => {
  const bundle = assembleV2(
    { designJson: JSON.stringify(cacheReaderDesign("versioned")) },
    loadLocalV2Registry(),
  );
  const text = (path: string) =>
    new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
  const fixture = (name: string) =>
    readFileSync(
      new URL(
        `../../../field-projects/generator-system/fixtures/rg-cache-reader/${name}`,
        import.meta.url,
      ),
      "utf8",
    );
  let declaration = fixture("products.json");
  const pg = new PGlite(),
    sql: string[] = [],
    configurations: { login: { user: string; secret: string } }[] = [],
    secrets: string[] = [];
  const fsUrl = url("export const readFileSync = path => globalThis.__rg13Read(path);");
  const operationsUrl = url(
    text("src/runtime/product-operations.ts")
      .replace('from "node:fs"', `from "${fsUrl}"`)
      .replace('from "./product-contract.ts"', `from "${productContractUrl}"`)
      .replace('from "./hook-boundary.ts"', `from "${url(text("src/runtime/hook-boundary.ts"))}"`),
  );
  const query = async (statement: string, values?: unknown[]) => {
    sql.push(statement);
    const result = await pg.query(statement, values);
    return { rows: result.rows, rowCount: result.rows.length };
  };
  const closes: (() => Promise<void>)[] = [],
    instances = new Map<string, unknown>();
  const scope = {
    signal: new AbortController().signal,
    own: (close: () => Promise<void>) => closes.push(close),
    once: (key: string, build: () => unknown) => {
      if (!instances.has(key)) instances.set(key, build());
      return instances.get(key);
    },
  };
  vi.stubGlobal("__rg13Read", (path: string) =>
    path.endsWith("products.json") ? declaration : fixture("read.sql"),
  );
  vi.stubGlobal("__rg13Secret", (name: string) => {
    secrets.push(name);
    return "fixture-only";
  });
  vi.stubGlobal("__rg13Postgres", (configuration: { login: { user: string; secret: string } }) => {
    configurations.push(configuration);
    return {
      on: () => {},
      query,
      connect: async () => ({ query, release: () => {} }),
      end: async () => {},
    };
  });
  vi.stubEnv("JEEVES_DATABASE_PREVIEWS_DB_HOST", "fixture");
  vi.stubEnv("JEEVES_DATABASE_PREVIEWS_DB_PORT", "5432");
  vi.stubEnv("JEEVES_DATABASE_PREVIEWS_DB_TLS", "disable");
  const fakes: Record<string, string> = {
    "./application-bindings.ts": text("src/features/application-bindings.ts"),
    "./local-bindings.ts": text("src/features/local-bindings.ts"),
    "../runtime/local.ts": "export const readSecret = name => globalThis.__rg13Secret(name);",
    "../runtime/postgres.ts":
      "export const createPostgres = config => globalThis.__rg13Postgres(config);",
    "../runtime/process.ts": text("src/runtime/process.ts"),
    "../runtime/valkey.ts": "export const cacheEndpoint = () => ({});",
    "../runtime/positive-cache.ts":
      'export const createCacheReader = () => {}, cacheReaderNamespace = () => "fixture";',
  };
  let helper = operationImports(stripTypeScriptTypes(text("src/features/service-resources.ts")));
  helper = helper
    .replace('from "../runtime/product-operations.ts"', `from "${operationsUrl}"`)
    .replace(
      'from "../runtime/transaction.ts"',
      `from "${url(text("src/runtime/transaction.ts"))}"`,
    );
  for (const [path, source] of Object.entries(fakes))
    helper = helper.replaceAll(`from "${path}"`, `from "${url(source)}"`);
  const emitted = await import(url(helper));
  const op = await import(operationUrl);
  try {
    await pg.exec(`CREATE SCHEMA p_preview_api_owner;${fixture("0001-initial.sql")}`);
    await pg.query("INSERT INTO p_preview_api_owner.records VALUES ($1,$2)", [
      "guide",
      JSON.stringify({ key: "guide", public: true }),
    ]);
    const selected = emitted.selected("positive-cache-read", "preview-reader");
    const original = declaration,
      invalid = JSON.parse(declaration);
    invalid.operations[0].kind = "command";
    declaration = JSON.stringify(invalid);
    expect(() => emitted.prepareCacheSource(selected, "preview-reader")).toThrow(
      /exceeds module link access/,
    );
    expect(configurations).toHaveLength(0);
    declaration = original;
    const prepared = emitted.prepareCacheSource(selected, "preview-reader");
    expect(configurations).toHaveLength(0);
    const source = emitted.cacheSource(scope, prepared),
      shared = emitted.cacheSource(scope, prepared);
    expect(configurations).toHaveLength(1);
    expect(configurations[0]?.login).toMatchObject({
      user: "pr_previews_db__preview_api",
      secret: "product-previews-db--preview-api",
    });
    expect(secrets).toContain("product-previews-db--preview-api");
    await source.probe();
    expect(await source.queries.call("read_record", ["guide"])).toMatchObject({
      rows: [{ payload: { key: "guide", public: true } }],
    });
    expect(sql).toEqual(["SELECT 1", "BEGIN READ ONLY", fixture("read.sql"), "COMMIT"]);
    const count = sql.length;
    await expect(
      op.withLocalPolicy(() => shared.queries.call("read_record", ["guide"])),
    ).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
    await expect(source.queries.call("unknown", [])).rejects.toThrow(/Unregistered/);
    expect(sql).toHaveLength(count);
    expect(Object.keys(source.queries)).toEqual(["call"]);
  } finally {
    for (const close of closes.reverse()) await close();
    await pg.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
