import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, expect, test, vi } from "vitest";
import { deploymentDesign } from "../../../field-projects/generator-system/fixtures/wd-deployment/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { operationImports, operationUrl, transactionUrl } from "./operation.test.helpers.ts";

const data = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const runtime = (name: string) =>
  operationImports(
    stripTypeScriptTypes(
      readFileSync(
        new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
        "utf8",
      ),
    ),
  );
const { transaction } = await import(transactionUrl);
const { sweepExpired } = await import(data(runtime("idempotency")));
const operation = await import(operationUrl);
let serial = 0;
const options = {
  hostname: "unused",
  port: 1,
  tls: { mode: "disable" },
  login: { database: "fixture", user: "runtime", secret: "fixture" },
  poolSize: 10,
  statementTimeoutMs: 123,
  connectionTimeoutMs: 100,
};
type Client = { query: (sql: string) => Promise<unknown>; release: (discard: boolean) => void };
const state: { configurations: Record<string, unknown>[]; connect?: () => Promise<Client> } = {
  configurations: [],
};
(globalThis as { wd11Pg?: unknown }).wd11Pg = state;
async function postgres() {
  const pg = data(
    `import {EventEmitter} from 'node:events'; export default {Pool:class extends EventEmitter {constructor(options){super();globalThis.wd11Pg.configurations.push(options);}connect(){return globalThis.wd11Pg.connect();}}};`,
  );
  return import(
    data(
      runtime("postgres")
        .replace('from "pg"', `from "${pg}"`)
        .replace('from "./local.ts"', `from "${data('export const readSecret=()=>"fixture";')}"`) +
        `\n// instance ${serial++}`,
    )
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  state.configurations.length = 0;
});

test("WD11: pool maximum is exact, value-free, read once before clients and retains defaults", async () => {
  for (const bad of [
    "",
    "0",
    "101",
    "01",
    "+1",
    "-1",
    "1.0",
    "1e1",
    " 1",
    "1 ",
    "Infinity",
    "secret-invalid",
    "1\n",
  ]) {
    vi.stubEnv("JEEVES_DB_POOL_MAX", bad);
    await expect(postgres()).rejects.toThrow(
      /^Invalid configuration JEEVES_DB_POOL_MAX: expected a whole integer from 1 to 100$/,
    );
    expect(state.configurations).toEqual([]);
  }
  for (const valid of ["1", "27", "100"]) {
    vi.stubEnv("JEEVES_DB_POOL_MAX", valid);
    const { createPostgres } = await postgres();
    vi.stubEnv("JEEVES_DB_POOL_MAX", "invalid-after-start");
    createPostgres(options);
    createPostgres({ ...options, poolSize: 4 });
    expect(state.configurations.splice(0).map((c) => c.max)).toEqual([
      Number(valid),
      Number(valid),
    ]);
  }
  vi.stubEnv("JEEVES_DB_POOL_MAX", undefined);
  const { createPostgres } = await postgres();
  createPostgres(options);
  createPostgres({ ...options, poolSize: 4 });
  expect(state.configurations.map((c) => c.max)).toEqual([10, 4]);
  expect(
    state.configurations.every((c) => !("statement_timeout" in c) && c.query_timeout === 623),
  ).toBe(true);
});

test("WD11: standalone queries and transactions share local timeout; setup failure rolls back before effects", async () => {
  vi.stubEnv("JEEVES_DB_POOL_MAX", undefined);
  const { createPostgres } = await postgres();
  const trace: string[] = [],
    releases: boolean[] = [];
  let fail = false;
  state.connect = async () => ({
    query: async (sql) => {
      trace.push(sql);
      if (fail && sql.startsWith("SET LOCAL"))
        throw Object.assign(Error("timeout"), { code: "57014" });
      return { rows: [{ answer: 42 }], rowCount: 1 };
    },
    release: (discard) => releases.push(discard),
  });
  const pool = createPostgres(options);
  await expect(pool.query("SELECT 42")).resolves.toMatchObject({ rows: [{ answer: 42 }] });
  expect(trace.splice(0)).toEqual([
    "BEGIN",
    "SET LOCAL statement_timeout = '123ms'",
    "SELECT 42",
    "COMMIT",
  ]);
  fail = true;
  const effect = vi.fn();
  await expect(transaction(pool, effect)).rejects.toMatchObject({ outcome: "definite-failure" });
  expect(effect).not.toHaveBeenCalled();
  expect(trace).toEqual(["BEGIN", "SET LOCAL statement_timeout = '123ms'", "ROLLBACK"]);
  expect(releases).toEqual([false, false]);
});

test("WD11: a standalone deadline holds its connection through actual COMMIT settlement and preserves uncertainty", async () => {
  vi.useFakeTimers();
  vi.stubEnv("JEEVES_DB_POOL_MAX", undefined);
  const { createPostgres } = await postgres();
  const releases: boolean[] = [];
  let settle!: () => void;
  state.connect = async () => ({
    query: async (sql) => {
      if (sql === "COMMIT")
        await new Promise<void>((resolve) => {
          settle = resolve;
        });
      return { rows: [], rowCount: 0 };
    },
    release: (discard) => releases.push(discard),
  });
  const pool = createPostgres(options);
  const request = operation.operation({ maximumMs: 10 });
  try {
    const pending = operation
      .withOperation(request.context, () => pool.query("UPDATE product SET n=1"))
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toMatchObject({ outcome: "unknown" });
    expect(releases).toEqual([]);
    settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(releases).toEqual([false]);
  } finally {
    request.close();
  }
});

test("WD11: racing sweepers hold the lock only in their deleting transaction and failed sweeps release it", async () => {
  let locked = false,
    remaining = 3,
    failed = false;
  let enter!: () => void, resume!: () => void;
  const deleting = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const deleted: number[] = [],
    traces: string[][] = [];
  const pool = {
    async connect() {
      let active = false,
        owns = false,
        staged = 0;
      const trace: string[] = [];
      traces.push(trace);
      return {
        async query(sql: string) {
          trace.push(sql);
          if (sql === "BEGIN") active = true;
          if (sql.includes("pg_try_advisory_xact_lock")) {
            expect(active).toBe(true);
            if (!locked) {
              locked = true;
              owns = true;
            }
            return { rows: [{ locked: owns }], rowCount: 1 };
          }
          if (sql.startsWith("DELETE")) {
            expect(active && owns).toBe(true);
            enter();
            await gate;
            if (failed) throw Object.assign(Error("timeout"), { code: "57014" });
            staged = remaining;
            return { rows: [], rowCount: staged };
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") {
            if (sql === "COMMIT" && staged) {
              remaining -= staged;
              deleted.push(staged);
            }
            if (owns) locked = false;
            active = false;
          }
          return { rows: [], rowCount: 0 };
        },
        release(discard: boolean) {
          expect(active).toBe(false);
          expect(discard).toBe(false);
        },
      };
    },
  };
  const first = sweepExpired(pool);
  await deleting;
  expect(await sweepExpired(pool)).toBe(0);
  resume();
  expect(await first).toBe(3);
  expect(deleted).toEqual([3]);
  expect(locked).toBe(false);
  remaining = 1;
  failed = true;
  await expect(sweepExpired(pool)).rejects.toMatchObject({ outcome: "definite-failure" });
  expect(locked).toBe(false);
  expect(remaining).toBe(1);
  failed = false;
  expect(await sweepExpired(pool)).toBe(1);
  for (const trace of traces)
    expect(trace.slice(0, 2)).toEqual(["BEGIN", "SET LOCAL statement_timeout = '2000ms'"]);
});

test("WD11: every emitted database runtime excludes session surfaces", () => {
  const bundle = assembleV2(
    { designJson: JSON.stringify(deploymentDesign()) },
    loadLocalV2Registry(),
  );
  const files = bundle.files.filter((f) => f.path.startsWith("src/runtime/"));
  expect(files.some((f) => f.path === "src/runtime/postgres.ts")).toBe(true);
  for (const file of files)
    expect(new TextDecoder().decode(file.bytes), file.path).not.toMatch(
      /\bpg_(?:try_)?advisory_(?:lock|unlock)\s*\(|\bLISTEN\s|\bstatement_timeout\s*:/i,
    );
});
