import { withStubWorkloads } from "../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";

const stripTypeScriptTypes = (source: string) => operationImports(stripTypes(source));

import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes as stripTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkServerIdentity, type PeerCertificate } from "node:tls";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { favoritesStackDesign } from "../../../jeeves/packages/spec/src/fixtures/favorites-stack.ts";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

// The exact emitted module-clients.ts of the stub stack (every section a stub can use), with its
// providers' libraries replaced by in-memory fakes that record what each client asks of them.
const bundle = assembleV2(
  {
    designJson: canonicalJson(
      runStudioCommands(withStubWorkloads(stubStackDesign()), [
        { type: "setRunnableProcesses", on: true },
      ]),
    ),
  },
  loadLocalV2Registry(),
);
const emitted = new TextDecoder().decode(
  bundle.files.find((file) => file.path === "src/runtime/module-clients.ts")?.bytes,
);
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
/** Each fake records what it is asked for in `calls`; the database and broker fakes also record
 * the endpoint they were given in `endpoints`, and the database fake its transport in
 * `transports`. The Pub/Sub client's topic exists unless `pubsub` says not, and `pubsub.publish`
 * answers its publishes when it is set. Each connection a database pool reserves records its
 * statements in `connections`, ending with `release` (or `release discard`); `answer` can fail a
 * statement on the nth connection, or answer it, and is given its values. */
type Calls = {
  calls: unknown[][];
  endpoints: unknown[][];
  transports: unknown[];
  connections: string[][];
  answer?: (sql: string, connection: number, values?: unknown[]) => unknown;
  fail?: string;
  hang?: boolean;
  pubsub?: { exists?: boolean; publish?: () => Promise<string> };
  cacheCommand?: (name: string, args: unknown[]) => unknown;
};
const fake: Calls = { calls: [], endpoints: [], transports: [], connections: [] };
(globalThis as { moduleClientsFake?: Calls }).moduleClientsFake = fake;
const check = `
  const fake = globalThis.moduleClientsFake;
  const record = (...call) => fake.calls.push(call);
  const outcome = async (what, value) => {
    record(what);
    if (fake.hang && fake.fail === what) return new Promise(() => {});
    if (fake.fail === what) throw new Error(what + " refused");
    return value;
  };`;
const fakes: Record<string, string> = {
  "../features/local-bindings.ts": `export const localLogins = [{ resource: "links-db", host: "links-api", database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db--links-api" }, { resource: "links-db", host: "reader", database: "d_links_db", user: "r_reader", secret: "sql-reader" }]; export const productLogins = []; export const productDatabases = [];`,
  "./postgres.ts": `${check}
    export function createPostgres(options) {
      fake.endpoints.push(["postgres", options.hostname, options.port]);
      fake.transports.push(options.tls);
      record("createPostgres", options.login.user, options.poolSize, options.statementTimeoutMs);
      return {
        on: (event) => record("on", event),
        end: async () => record("end"),
        query: (sql, values) => outcome(sql, { rows: [{ sql, values }], rowCount: 3 }),
        connect: async () => {
          const statements = [];
          fake.connections.push(statements);
          const connection = fake.connections.length;
          return {
            query: async (sql, values) => {
              statements.push(sql);
              const answer = await fake.answer?.(sql, connection, values);
              return answer ?? { rows: [{ sql, values }], rowCount: sql.startsWith("INSERT") ? 1 : null };
            },
            release: (discard) => statements.push(discard ? "release discard" : "release"),
          };
        },
      };
    }`,
  "./amqp.ts": `${check}
    export async function createPublisher(binding, destination, hooks) {
      fake.endpoints.push(["broker", binding.hostname, binding.port]);
      await outcome("open", undefined);
      record("createPublisher", binding.passwordSecret, destination, hooks.onState);
      return {
        closed: new Promise(() => {}),
        close: async () => record("close"),
        publish: async (body, messageId) => record("publish", Buffer.from(body).toString(), messageId),
      };
    }`,
  redis: `${check}
    export class ErrorReply extends Error {}
    export function createClient(options) {
      record("createClient", options);
      let cancelConnect;
      // A command records its arguments, then answers, fails or (with hang) never answers.
      const reply = (name, value) => (...args) => {
        record(name, ...args);
        if (fake.hang && fake.fail === name) return new Promise(() => {});
        if (fake.fail === name) return Promise.reject(new Error(name + " refused"));
        return Promise.resolve(fake.cacheCommand ? fake.cacheCommand(name, args) : typeof value === "function" ? value(...args) : value);
      };
      return {
        on: (event) => record("on", event),
        connect: () => {
          if (fake.hang && fake.fail === "connect") {
            record("connect");
            return new Promise((_, reject) => { cancelConnect = reject; });
          }
          return outcome("connect", undefined);
        },
        ping: () => outcome("PING", "PONG"),
        destroy: () => { record("destroy"); cancelConnect?.(new Error("Client destroyed")); },
        get: reply("get", (key) => (key === "missing" ? null : "value")),
        set: reply("set", "OK"),
        del: reply("del", 1),
        eval: reply("eval", undefined),
      };
    }`,
  "./local.ts":
    'export const readSecret = (name) => "secret of " + name; export const quoteSqlIdentifier = name => String.fromCharCode(34) + name + String.fromCharCode(34);',
  "@google-cloud/pubsub": `${check}
    // A loop's subscriber (tile-loop.test.ts runs it) imports Duration too.
    export class Duration { static from(like) { return { like }; } }
    export class PubSub {
      constructor(options) { record("PubSub", options); }
      topic(name, options) {
        record("topic", name, options);
        return {
          exists: () => outcome("exists", [fake.pubsub?.exists ?? true]),
          getMetadata: () => outcome("topic metadata", [{}]),
          publishMessage: (message) => {
            record("publishMessage", Buffer.from(message.data).toString(), message.attributes);
            return fake.pubsub?.publish ? fake.pubsub.publish() : Promise.resolve("1");
          },
        };
      }
      async close() { record("close"); }
    }`,
  "@aws-sdk/client-s3": [
    "AbortMultipartUpload",
    "CreateMultipartUpload",
    "GetObject",
    "HeadBucket",
    "PutObject",
  ]
    .map(
      (name) =>
        `export class ${name}Command { constructor(input) { this.name = "${name}"; this.input = input; } }`,
    )
    .join("\n"),
  "./objects.ts": `${check}
    export function createObjects(options) {
      record("createObjects", options.credentialSecret, options.endpoint);
      return {
        destroy: () => record("destroy"),
        send: async (command) => {
          await outcome(command.name, undefined);
          fake.calls.at(-1).push(command.input);
          if (command.name === "CreateMultipartUpload") return { UploadId: "u1" };
          if (command.name === "GetObject" && command.input.Key === "missing")
            throw Object.assign(new Error("gone"), { name: "NoSuchKey" });
          if (command.name === "GetObject")
            return { Body: { transformToByteArray: async () => new TextEncoder().encode("bytes") } };
          return {};
        },
      };
    }`,
  "./search.ts": `${check}
    export function createSearch(options) {
      record("createSearch", options.endpoint);
      return {
        close: async () => record("close"),
        cluster: { health: () => outcome("health", {}) },
        search: async (request) => (record("search", request), { body: { hits: { hits: [{ _source: { id: 1 } }] } } }),
        index: async (request) => record("index", request),
        delete: async (request) => record("delete", request),
      };
    }`,
};
// The stub cache's bounded client: the exact emitted valkey.ts, on the same fake redis.
fakes["./valkey.ts"] = stripTypeScriptTypes(
  new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/runtime/valkey.ts")?.bytes,
  ),
).replace(/from "([^"]+)"/g, (match, from: string) =>
  fakes[from] ? `from "${dataUrl(fakes[from])}"` : match,
);
// A stub's transaction (QL03) runs on the exact emitted transaction.ts, over the fake pool, and
// its idempotent call (QL04) on the exact idempotency.ts, swept by process.ts's `periodic`.
for (const name of ["transaction", "idempotency", "process"])
  fakes[`./${name}.ts`] = stripTypeScriptTypes(
    new TextDecoder().decode(
      bundle.files.find((file) => file.path === `src/runtime/${name}.ts`)?.bytes,
    ),
  );
// Load the exact emitted registered SQL helpers, retaining their real shared operation context.
for (const name of [
  "product-contract",
  "hook-boundary",
  "product-operations",
  "keys",
  "settings",
  "product-mutation",
  "work-integration",
  "local-operation",
  "durable-work",
]) {
  fakes[`./${name}.ts`] = stripTypeScriptTypes(
    new TextDecoder().decode(
      bundle.files.find((file) => file.path === `src/runtime/${name}.ts`)?.bytes,
    ),
  ).replace(/from "([^"]+)"/g, (match, from: string) =>
    fakes[from] ? `from "${dataUrl(fakes[from])}"` : match,
  );
}
// A stub loop's Pub/Sub subscriber (QG08) shares the loop's runtime: the exact delivery.ts, and a
// stand-in for tile-loop.ts, whose subscriber tile-loop.test.ts runs.
fakes["./delivery.ts"] = stripTypeScriptTypes(
  readFileSync(
    new URL("../../templates/local-v2/assets/src/runtime/delivery.ts.template", import.meta.url),
    "utf8",
  ),
);
for (const name of ["durable-sql", "receipts", "receipt-consumer"]) {
  fakes[`./${name}.ts`] = stripTypeScriptTypes(
    new TextDecoder().decode(
      bundle.files.find((file) => file.path === `src/runtime/${name}.ts`)?.bytes,
    ),
  ).replace(/from "([^"]+)"/g, (match, from: string) =>
    fakes[from] ? `from "${dataUrl(fakes[from])}"` : match,
  );
}
fakes["./tile-loop.ts"] =
  'export const failureStep = () => { throw new Error("Not used by these tests"); };';
const tileProcess = dataUrl(
  stripTypeScriptTypes(
    readFileSync(
      new URL(
        "../../templates/local-v2/assets/src/runtime/tile-process.ts.template",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const js = stripTypeScriptTypes(emitted).replace(/from "([^"]+)"/g, (match, from: string) =>
  from === "./tile-process.ts"
    ? `from "${tileProcess}"`
    : fakes[from]
      ? `from "${dataUrl(fakes[from])}"`
      : match,
);
const clients = await import(dataUrl(js));
// The same module instance the clients import, for `IdempotencyConflict` and `requestHash`.
const idempotency = await import(dataUrl(String(fakes["./idempotency.ts"])));
const { NotImplemented } = await import(tileProcess);
const valkey = await import(dataUrl(String(fakes["./valkey.ts"])));

// The endpoints each process reads, as the stub stack's emitted compose.yaml sets them (QG06):
// every client here is built with exactly those, so a variable Compose doesn't set fails.
const compose = JSON.parse(
  new TextDecoder().decode(bundle.files.find((file) => file.path === "compose.yaml")?.bytes),
) as { services: Record<string, { environment?: Record<string, string> }> };
const localEnvironment: Record<string, string> = Object.assign(
  {},
  ...Object.entries(compose.services)
    .filter(([name]) => name.startsWith("app-"))
    .map(([, service]) =>
      Object.fromEntries(
        Object.entries(service.environment ?? {}).filter(([name]) => name.startsWith("JEEVES_")),
      ),
    ),
);
const touched = new Map<string, string | undefined>();
/** Sets (or, with undefined, unsets) environment variables until the test ends. */
function environment(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (!touched.has(name)) touched.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
function restoreEnvironment() {
  for (const [name, value] of touched)
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  touched.clear();
}

function testScope() {
  const owned: (() => unknown)[] = [];
  const transports: unknown[] = [];
  return {
    owned,
    signal: new AbortController().signal,
    transports,
    own: (drain: () => unknown) => owned.push(drain),
    transport: (value: unknown) => transports.push(value),
    fail: () => {},
    ready: () => {},
  };
}
const lines: Record<string, unknown>[] = [];
const probe = Object.assign((entry: Record<string, unknown>) => lines.push(entry), {
  tile: "links-api",
});
/** What a client wrote to stdout itself (its failure and state lines), parsed. */
function stdout() {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return {
    lines: () => spy.mock.calls.map(([line]) => JSON.parse(String(line))),
    restore: () => spy.mockRestore(),
  };
}

describe("emitted module-clients.ts (tile process contract, sections 4 and 6)", () => {
  beforeEach(() => environment(localEnvironment));
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.connections.length = 0;
    fake.fail = undefined;
    fake.hang = undefined;
    fake.cacheCommand = undefined;
    lines.length = 0;
    vi.useRealTimers();
    restoreEnvironment();
  });

  it("answers Not implemented for what isn't provisioned, called or through a member", async () => {
    const target = clients.unavailable(
      "Partner API for Partner caller (an External API isn't provisioned locally)",
    );
    await expect(target()).rejects.toBeInstanceOf(NotImplemented);
    await expect(target.request("/x")).rejects.toThrow(
      "Not implemented: Partner API for Partner caller (an External API isn't provisioned locally)",
    );
    // It isn't a thenable, so awaiting it doesn't hang.
    expect(target.then).toBeUndefined();
  });

  it("reads and writes a database through the tile's login, after SELECT 1", async () => {
    const scope = testScope();
    const db = await clients.databaseClient(scope, probe, {
      tile: "links-api",
      resource: "links-db",
    });
    expect(fake.calls.slice(0, 3)).toEqual([
      ["createPostgres", "r_links_db__links_api", 10, 2000],
      ["on", "error"],
      ["SELECT 1"],
    ]);
    expect(lines).toEqual([
      { level: "info", client: "links-db", kind: "database", check: "SELECT 1", result: "ok" },
    ]);
    expect(await db.query("SELECT $1", [1])).toEqual([{ sql: "SELECT $1", values: [1] }]);
    expect(await db.execute("DELETE FROM t")).toEqual({ rowCount: 3 });
    expect(scope.owned).toHaveLength(2);
    // The handle's stop flag drains before its underlying pooled client.
    await scope.owned[1]?.();
    await scope.owned[0]?.();
    expect(fake.calls.filter(([call]) => call === "end")).toHaveLength(1);
    await expect(
      clients.databaseClient(scope, probe, { tile: "visit-worker", resource: "links-db" }),
    ).rejects.toThrow("No runtime login for links-db");
    // A failed probe logs why and fails startup.
    fake.fail = "SELECT 1";
    await expect(
      clients.databaseClient(scope, probe, { tile: "links-api", resource: "links-db" }),
    ).rejects.toThrow("Startup probe failed: database links-db");
    expect(lines.at(-1)).toEqual({
      level: "error",
      client: "links-db",
      kind: "database",
      check: "SELECT 1",
      result: "failed",
      error: "Error: SELECT 1 refused",
    });
  });

  it("shares physical pools across emitted template/stub consumers, isolating credentials, configuration and processes", async () => {
    const generated = assembleV2(
      { designJson: canonicalJson(favoritesStackDesign()) },
      loadLocalV2Registry(),
    );
    const source = new TextDecoder().decode(
      generated.files.find((f) => f.path === "src/features/service-resources.ts")?.bytes,
    );
    const fakeSource = (path: string) => {
      const source = fakes[path];
      if (!source) throw Error(`Missing fake ${path}`);
      return source;
    };
    const dependencies: Record<string, string> = {
      "./application-bindings.ts": "export const selections = [];",
      "./local-bindings.ts": fakeSource("../features/local-bindings.ts"),
      "../runtime/local.ts": "export const readSecret = () => 'secret';",
      "../runtime/postgres.ts": fakeSource("./postgres.ts"),
      "../runtime/process.ts": fakeSource("./process.ts"),
    };
    const resources = await import(
      dataUrl(
        stripTypeScriptTypes(source).replace(/from "([^"]+)"/g, (match, from: string) =>
          dependencies[from] ? `from "${dataUrl(dependencies[from])}"` : match,
        ),
      )
    );
    const { createProcessLifecycle } = await import(dataUrl(fakeSource("./process.ts")));
    const a = createProcessLifecycle({ mark: () => {} }),
      b = createProcessLifecycle({ mark: () => {} });
    const selection = {
      host: "links-api",
      resources: { state: "links-db" },
      inputs: { "state.poolSize": 10, "state.statementTimeoutMs": 2000 },
    };
    try {
      const template = resources.pool(a.scope, selection, "state");
      expect(resources.pool(a.scope, selection, "state")).toBe(template);
      await clients.databaseClient(a.scope, probe, { tile: "links-api", resource: "links-db" });
      expect(fake.calls.filter(([kind]) => kind === "createPostgres")).toHaveLength(1);
      expect(
        resources.pool(
          a.scope,
          { ...selection, inputs: { ...selection.inputs, "state.poolSize": 4 } },
          "state",
        ),
      ).not.toBe(template);
      await clients.databaseClient(a.scope, probe, { tile: "reader", resource: "links-db" });
      expect(resources.pool(b.scope, selection, "state")).not.toBe(template);
      expect(fake.calls.filter(([kind]) => kind === "createPostgres")).toHaveLength(4);
      expect(
        fake.calls.filter(([kind, user]) => kind === "createPostgres" && user === "r_reader"),
      ).toHaveLength(1);
      // Registered product execution must never reuse the broader template/stub pool.
      const prepared = {
        configuration: {
          ...clients.databaseEndpoint("links-db"),
          login: {
            resource: "links-db",
            host: "links-api",
            database: "d_links_db",
            user: "pr_links_db__links_api",
            secret: "product-links-db--links-api",
            product: true,
          },
          poolSize: 10,
          statementTimeoutMs: 2000,
          connectionTimeoutMs: 2000,
        },
        binding: { tile: "links-api", resource: "links-db", module: "link-reader" },
        operations: (
          execute: (sql: string, values: unknown[], readOnly: boolean) => Promise<unknown>,
        ) => ({ call: () => execute("SELECT $1", [3], true) }),
      };
      const registered = await clients.productDatabaseClient(a.scope, probe, prepared);
      await clients.productDatabaseClient(a.scope, probe, {
        ...prepared,
        binding: { ...prepared.binding, module: "second-product" },
      });
      expect(fake.calls.filter(([kind]) => kind === "createPostgres")).toHaveLength(5);
      expect(
        fake.calls.filter(
          ([kind, user]) => kind === "createPostgres" && user === "pr_links_db__links_api",
        ),
      ).toHaveLength(1);
      await registered.call();
      expect(fake.connections.at(-1)).toEqual([
        "BEGIN READ ONLY",
        "SELECT $1",
        "COMMIT",
        "release",
      ]);
    } finally {
      await a.close();
      await b.close();
    }
    expect(fake.calls.filter(([kind]) => kind === "end")).toHaveLength(5);
  });

  it("closes opened emitted clients when initialization fails or a probe is cancelled", async () => {
    const { createProcessLifecycle } = await import(dataUrl(fakes["./process.ts"] ?? ""));
    const exitCode = process.exitCode;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failed = createProcessLifecycle({ mark: () => {} });
      await failed.start(async (scope: unknown) => {
        await clients.databaseClient(scope, probe, { tile: "links-api", resource: "links-db" });
        fake.fail = "SELECT 1";
        await clients.databaseClient(scope, probe, { tile: "reader", resource: "links-db" });
      });
      expect(process.exitCode).toBe(1);
      expect(fake.calls.filter(([kind]) => kind === "end")).toHaveLength(2);
      expect(lines.at(-1)).toMatchObject({ result: "failed", error: "Error: SELECT 1 refused" });
      const waiting = createProcessLifecycle({ mark: () => {} });
      fake.hang = true;
      const start = waiting.start(async (scope: unknown) => {
        await clients.databaseClient(scope, probe, { tile: "links-api", resource: "links-db" });
      });
      await Promise.resolve();
      await waiting.close();
      await start;
      expect(waiting.scope.signal.aborted).toBe(true);
      expect(fake.calls.filter(([kind]) => kind === "end")).toHaveLength(3);
      expect(lines.at(-1)).toMatchObject({ result: "failed", error: "Error: Process stopping" });
    } finally {
      errors.mockRestore();
      process.exitCode = exitCode;
    }
  });

  it("publishes to a topic's exchange or a work queue, with confirms and a fresh message ID", async () => {
    const scope = testScope();
    const onState = () => {};
    const topic = await clients.queuePublisher(
      scope,
      probe,
      { queue: "visits", mode: "topic" },
      onState,
    );
    const work = await clients.queuePublisher(
      scope,
      probe,
      { queue: "uploaded", mode: "work-queue" },
      onState,
    );
    await topic.publish(new TextEncoder().encode("a"), { key: "ignored" });
    await work.publish(new TextEncoder().encode("b"));
    const calls = fake.calls.filter((call) => call[0] !== "open");
    expect(calls.slice(0, 2)).toEqual([
      ["createPublisher", "broker-password", { exchange: "visits", routingKey: "" }, onState],
      ["createPublisher", "broker-password", { exchange: "", routingKey: "uploaded" }, onState],
    ]);
    expect(calls[2]?.slice(0, 2)).toEqual(["publish", "a"]);
    expect(calls[3]?.slice(0, 2)).toEqual(["publish", "b"]);
    expect(calls[2]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[2]?.[2]).not.toBe(calls[3]?.[2]);
    // The publisher drains with the process; a lost broker is told to its state hook.
    expect(scope.owned).toHaveLength(2);
    expect(scope.transports).toHaveLength(2);
    expect(lines.map((line) => [line.client, line.check, line.result])).toEqual([
      ["visits", "open the broker and a confirm channel", "ok"],
      ["uploaded", "open the broker and a confirm channel", "ok"],
    ]);
  });

  it("sends the module's own message ID when it names one, so a repeat is the same message", async () => {
    // YouTube v3 template gap 6: an event counter's receipt is keyed on the message ID, so a
    // retried play must go out as the same message.
    const views = await clients.queuePublisher(testScope(), probe, {
      queue: "view-events",
      mode: "topic",
    });
    const play = new TextEncoder().encode("play");
    await views.publish(play, { messageId: "event-1" });
    await views.publish(play, { messageId: "event-1" });
    await views.publish(play, { key: "ignored" });
    const sent = fake.calls.filter((call) => call[0] === "publish");
    expect(sent.slice(0, 2)).toEqual([
      ["publish", "play", "event-1"],
      ["publish", "play", "event-1"],
    ]);
    expect(sent[2]?.[2]).toMatch(/^[0-9a-f-]{36}$/);
    const dependencies = new TextDecoder().decode(
      bundle.files.find((file) => file.path === "src/modules/dependencies.ts")?.bytes,
    );
    expect(dependencies).toContain(
      "publish(message: Uint8Array, options?: PublisherOptions): Promise<void>;",
    );
  });

  it("RG12 protects generated admission state from actual public cache handles sharing one generated client", async () => {
    const op = await import(operationUrl);
    const processRuntime = await import(dataUrl(fakes["./process.ts"] ?? ""));
    const readTemplate = (name: string) =>
      stripTypeScriptTypes(
        readFileSync(
          new URL(
            `../../templates/local-v2/assets/src/runtime/${name}.ts.template`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
    const admissionUrl = dataUrl(readTemplate("admission"));
    const limiterUrl = dataUrl(
      readTemplate("rate-limiter")
        .replace('from "./admission.ts"', `from "${admissionUrl}"`)
        .replace(
          'from "./hook-boundary.ts"',
          `from "${dataUrl(fakes["./hook-boundary.ts"] ?? "")}"`,
        ),
    );
    const { createRateLimiter } = await import(limiterUrl);
    const { createCacheReader } = await import(
      dataUrl(
        readTemplate("positive-cache").replace(
          'from "./hook-boundary.ts"',
          `from "${dataUrl(fakes["./hook-boundary.ts"] ?? "")}"`,
        ),
      )
    );
    const instances = new Map<string, unknown>();
    const scope = {
      ...testScope(),
      once<T>(key: string, construct: () => T): T {
        if (!instances.has(key)) instances.set(key, construct());
        return instances.get(key) as T;
      },
    };
    let key = "",
      count = 0;
    const readerValues = new Map<string, string>();
    fake.cacheCommand = (name, args) => {
      if (typeof args[0] === "string" && args[0].startsWith("jeeves:reader:")) {
        if (name === "get") return readerValues.get(args[0]) ?? null;
        if (name === "set") {
          readerValues.set(args[0], String(args[1]));
          return "OK";
        }
      }
      if (name === "eval") {
        const input = args[1] as { keys: string[] };
        key = input.keys[0] ?? "";
        const admitted = count < 1;
        if (admitted) count += 1;
        const now = Date.now();
        return [Number(admitted), count, now, now + 60000];
      }
      if (args[0] === key && ["set", "del"].includes(name)) count = 0;
      return name === "get" ? "product-value" : name === "del" ? 1 : "OK";
    };
    const out = stdout();
    const context = op.operation({ maximumMs: 10000, caller: { subject: "alice" } });
    try {
      const product = await clients.cacheClient(scope, probe, { cache: "links-cache" });
      const binding = {
        ...clients.cacheClientEndpoint("links-cache"),
        secret: "cache-links-cache",
      };
      const privateCache = await processRuntime.processClient(scope, "valkey", binding, () => {
        throw Error("Generated client was not shared");
      });
      let accessorRead: Promise<unknown> | undefined;
      const beforeAccessor = fake.calls.length;
      createRateLimiter({
        process: "links-api",
        module: "accessor",
        limit: 1,
        windowSeconds: 60,
        cache: privateCache,
        hooks: {
          get key() {
            accessorRead = product.get("product:ordinary");
            return (caller: { subject: string }) => caller.subject;
          },
        },
      });
      expect(accessorRead).toBeDefined();
      await expect(accessorRead).rejects.toMatchObject({
        outcome: "refused",
        code: "EFFECT_NOT_ALLOWED",
      });
      expect(fake.calls).toHaveLength(beforeAccessor);
      const limiter = createRateLimiter({
        process: "links-api",
        module: "limit",
        limit: 1,
        windowSeconds: 60,
        cache: privateCache,
        hooks: { key: (caller: { subject: string }) => caller.subject },
      });
      const admit = () => op.withOperation(context.context, () => limiter.admit({}));
      expect(await admit()).toMatchObject({ admitted: true, count: 1 });
      expect(key).toMatch(/^jeeves:admission:/);
      expect(fake.calls.filter((call) => call[0] === "createClient")).toHaveLength(1);
      const before = fake.calls.length;
      for (const reserved of ["jeeves:", "jeeves:admission:guess", key]) {
        for (const call of [
          () => product.get(reserved),
          () => product.set(reserved, "reset"),
          () => product.delete(reserved),
        ])
          await expect(call()).rejects.toMatchObject({
            outcome: "refused",
            code: "RESERVED_CACHE_KEY",
          });
      }
      expect(fake.calls).toHaveLength(before);
      expect(await product.get("product:ordinary")).toBe("product-value");
      await product.set("product:ordinary", "value", 60);
      await product.delete("product:ordinary");
      await expect(admit()).rejects.toMatchObject({
        statusCode: 429,
        code: "RATE_LIMITED",
        decision: { count: 1, remaining: 0 },
      });
      expect(count).toBe(1);
      const callsBeforeReadWrite = fake.calls.length;
      await expect(
        op.withEffect("read", () => product.set("product:ordinary", "bad")),
      ).rejects.toMatchObject({ code: "EFFECT_NOT_ALLOWED" });
      expect(fake.calls).toHaveLength(callsBeforeReadWrite);
      const load = vi.fn(async (input: { key: string }) => ({ key: input.key, public: true }));
      const reader = createCacheReader({
        cache: privateCache,
        freshness: "immutable-positive",
        ttlSeconds: 60,
        namespace: "fixture",
        adapter: {
          key: (input: { key: string }) => `product:${input.key}`,
          codec: { parse: (value: unknown) => value },
          eligible: (value: { key: string; public: boolean }, input: { key: string }) =>
            value.public && value.key === input.key,
          load,
        },
      });
      expect(await op.withOperation(context.context, () => reader({ key: "guide" }))).toMatchObject(
        { source: "authoritative", record: { key: "guide", public: true } },
      );
      expect(await op.withOperation(context.context, () => reader({ key: "guide" }))).toMatchObject(
        { source: "cache" },
      );
      expect(load).toHaveBeenCalledTimes(1);
      const readerKey = [...readerValues.keys()][0];
      expect(readerKey).toMatch(/^jeeves:reader:/);
      const beforeProtectedReader = fake.calls.length;
      for (const action of [
        () => product.get(readerKey),
        () => product.set(readerKey, "private"),
        () => product.delete(readerKey),
      ])
        await expect(action()).rejects.toMatchObject({ code: "RESERVED_CACHE_KEY" });
      expect(fake.calls).toHaveLength(beforeProtectedReader);
      expect(count).toBe(1);
    } finally {
      context.close();
      for (const close of scope.owned.reverse()) await close();
      out.restore();
    }
  });

  it("uses a cache with its password, after PING", async () => {
    const out = stdout();
    try {
      const cache = await clients.cacheClient(testScope(), probe, { cache: "links-cache" });
      // The cache read's bounded client: no offline queue or client reconnect, 32 queued at
      // most, a 500 ms connect.
      expect(fake.calls.slice(0, 5)).toEqual([
        [
          "createClient",
          {
            password: "secret of cache-links-cache",
            disableOfflineQueue: true,
            commandsQueueMaxLength: 32,
            socket: {
              host: "cache-links-cache",
              port: 6379,
              connectTimeout: 500,
              reconnectStrategy: false,
            },
          },
        ],
        ["on", "error"],
        ["on", "end"],
        ["connect"],
        ["PING"],
      ]);
      expect(lines).toEqual([
        { level: "info", client: "links-cache", kind: "cache", check: "PING", result: "ok" },
      ]);
      expect(out.lines()).toEqual([
        {
          level: "info",
          event: "cache",
          tile: "links-api",
          cache: "links-cache",
          state: "available",
        },
      ]);
      expect(await cache.get("key")).toBe("value");
      expect(await cache.get("missing")).toBeUndefined();
      await cache.set("key", "value", 60);
      await cache.set("key", "value");
      await cache.delete("key");
      expect(fake.calls.slice(5)).toEqual([
        ["get", "key"],
        ["get", "missing"],
        ["set", "key", "value", { EX: 60 }],
        ["set", "key", "value", undefined],
        ["del", "key"],
      ]);
    } finally {
      out.restore();
    }
  });

  it("settles a stalled cache command at 150 ms, then fails at once until a new client connects 5 s later", async () => {
    vi.useFakeTimers();
    const out = stdout();
    try {
      const cache = await clients.cacheClient(testScope(), probe, { cache: "links-cache" });
      const created = () => fake.calls.filter((call) => call[0] === "createClient").length;
      const destroyed = () => fake.calls.filter((call) => call[0] === "destroy").length;
      // Each of get, set and delete: a command that never answers rejects at its deadline and
      // destroys the client; until the next one connects, every call fails at once.
      const stalls = [
        ["get", () => cache.get("key")],
        ["set", () => cache.set("key", "value", 30)],
        ["del", () => cache.delete("key")],
      ] as const;
      for (const [index, [name, call]] of stalls.entries()) {
        fake.fail = name;
        fake.hang = true;
        let settled: unknown;
        const pending = call().catch((error: Error) => {
          settled = error.message;
        });
        await vi.advanceTimersByTimeAsync(149);
        expect(settled).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(settled).toBe("Cache deadline");
        expect(destroyed()).toBe(index + 1);
        fake.fail = undefined;
        fake.hang = undefined;
        await expect(cache.get("key")).rejects.toThrow("Cache unavailable");
        await expect(cache.set("key", "value")).rejects.toThrow("Cache unavailable");
        await expect(cache.delete("key")).rejects.toThrow("Cache unavailable");
        await vi.advanceTimersByTimeAsync(4999);
        expect(created()).toBe(index + 1);
        await vi.advanceTimersByTimeAsync(1);
        expect(created()).toBe(index + 2);
        expect(await cache.get("key")).toBe("value");
      }
      // Each loss is one failure line through the failure log, each return one info line.
      const lost = {
        level: "error",
        event: "failure",
        tile: "links-api",
        what: "cache links-cache",
        error: "OperationError: Cache deadline",
      };
      const back = {
        level: "info",
        event: "cache",
        tile: "links-api",
        cache: "links-cache",
        state: "available",
      };
      expect(out.lines()).toEqual([back, lost, back, lost, back, lost, back]);
    } finally {
      out.restore();
    }
  });

  it("starts without a cache that is down at startup, logs unavailable and connects 5 s later", async () => {
    vi.useFakeTimers();
    const out = stdout();
    try {
      // Refused: the first connect fails at once. Stalled (a paused cache): at its 500 ms bound.
      for (const hang of [false, true]) {
        fake.calls.length = 0;
        lines.length = 0;
        fake.fail = "connect";
        fake.hang = hang;
        let started: { get(key: string): Promise<string | undefined> } | undefined;
        const starting = clients
          .cacheClient(testScope(), probe, { cache: "links-cache" })
          .then((cache: typeof started) => {
            started = cache;
          });
        await vi.advanceTimersByTimeAsync(hang ? 499 : 0);
        if (hang) expect(started).toBeUndefined();
        await vi.advanceTimersByTimeAsync(hang ? 1 : 0);
        await starting;
        if (!started) throw new Error("cacheClient did not start");
        expect(lines).toEqual([
          {
            level: "warn",
            client: "links-cache",
            kind: "cache",
            check: "PING",
            result: "unavailable",
          },
        ]);
        expect(fake.calls.filter((call) => call[0] === "PING")).toEqual([]);
        expect(fake.calls.filter((call) => call[0] === "destroy")).toHaveLength(1);
        await expect(started.get("key")).rejects.toThrow("Cache unavailable");
        fake.fail = undefined;
        fake.hang = undefined;
        await vi.advanceTimersByTimeAsync(5000);
        expect(fake.calls.filter((call) => call[0] === "createClient")).toHaveLength(2);
        expect(await started.get("key")).toBe("value");
      }
      const back = {
        level: "info",
        event: "cache",
        tile: "links-api",
        cache: "links-cache",
        state: "available",
      };
      expect(out.lines()).toEqual([
        {
          level: "error",
          event: "failure",
          tile: "links-api",
          what: "cache links-cache",
          error: "OperationError: Operation definite-failure: DEPENDENCY_FAILED",
        },
        back,
        {
          level: "error",
          event: "failure",
          tile: "links-api",
          what: "cache links-cache",
          error: "OperationError: Cache deadline",
        },
        back,
      ]);
    } finally {
      out.restore();
    }
  });

  it("destroys the cache client when the process drains, and tries no new one", async () => {
    vi.useFakeTimers();
    const out = stdout();
    try {
      const scope = testScope();
      await clients.cacheClient(scope, probe, { cache: "links-cache" });
      expect(scope.owned).toHaveLength(1);
      await scope.owned[0]?.();
      expect(fake.calls.at(-1)).toEqual(["destroy"]);
      // Closed while lost: the retry is cancelled.
      fake.calls.length = 0;
      fake.fail = "connect";
      const down = testScope();
      await clients.cacheClient(down, probe, { cache: "links-cache" });
      fake.fail = undefined;
      await down.owned[0]?.();
      await vi.advanceTimersByTimeAsync(20000);
      expect(fake.calls.filter((call) => call[0] === "createClient")).toHaveLength(1);
    } finally {
      out.restore();
    }
  });

  it("checks a bucket with what its key allows, and reads and writes objects", async () => {
    const store = await clients.objectClient(testScope(), probe, {
      tile: "upload-api",
      bucket: "archive",
      access: "read-write",
    });
    expect(fake.calls.slice(0, 2)).toEqual([
      ["createObjects", "s3-upload-api", "http://local-objects:3900"],
      ["HeadBucket", { Bucket: "archive" }],
    ]);
    expect(new TextDecoder().decode(await store.get("k"))).toBe("bytes");
    expect(await store.get("missing")).toBeUndefined();
    await store.put("k", new Uint8Array([1]), "text/plain");
    expect(fake.calls.at(-1)).toEqual([
      "PutObject",
      { Bucket: "archive", Key: "k", Body: new Uint8Array([1]), ContentType: "text/plain" },
    ]);
    // A write-only key can't HeadBucket: it opens and aborts a multipart upload instead.
    fake.calls.length = 0;
    await clients.objectClient(testScope(), probe, {
      tile: "visit-worker",
      bucket: "exports",
      access: "write",
    });
    expect(fake.calls.slice(1)).toEqual([
      ["CreateMultipartUpload", { Bucket: "exports", Key: ".probe/visit-worker" }],
      ["AbortMultipartUpload", { Bucket: "exports", Key: ".probe/visit-worker", UploadId: "u1" }],
    ]);
    expect(lines.at(-1)).toMatchObject({
      check: "open and abort a multipart upload",
      result: "ok",
    });
  });

  it("queries and writes a search index after cluster health, and reaches another tile", async () => {
    const index = await clients.searchClient(testScope(), probe, { index: "stats-index" });
    expect(fake.calls.slice(0, 2)).toEqual([
      ["createSearch", "http://search-stats-index:9200"],
      ["health"],
    ]);
    expect(await index.search({ query: { match_all: {} } })).toEqual([{ id: 1 }]);
    await index.index("1", { id: 1 });
    await index.remove("1");
    expect(fake.calls.slice(2)).toEqual([
      ["search", { index: "stats-index", body: { query: { match_all: {} } } }],
      ["index", { index: "stats-index", id: "1", body: { id: 1 } }],
      ["delete", { index: "stats-index", id: "1" }],
    ]);
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    try {
      const target = clients.externalTarget("JEEVES_TILE_STATS_API_URL");
      await target.request("/modules/stats-search", { method: "POST" });
      expect(fetch).toHaveBeenCalledWith(
        new URL("http://app-stats-api:3000/modules/stats-search"),
        expect.objectContaining({
          method: "POST",
          redirect: "manual",
          credentials: "omit",
          signal: expect.any(AbortSignal),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("bounds legacy external transport failures without adding automatic retries", async () => {
    const internalCall = Symbol.for("jeeves.internal-call");
    const response = new Response("ok");
    const refused = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.3:3000"), {
        code: "ECONNREFUSED",
      }),
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(refused)
      .mockRejectedValueOnce("not an object");
    vi.stubGlobal("fetch", fetch);
    try {
      const target = clients.externalTarget("JEEVES_TILE_STATS_API_URL");
      expect(await target.request("/modules/stats-search")).toMatchObject({
        status: response.status,
      });
      expect(Reflect.get(refused, internalCall)).toBeUndefined();
      await expect(target.request("/modules/stats-search")).rejects.toMatchObject({
        outcome: "definite-failure",
        cause: refused,
      });
      expect(Reflect.get(refused, internalCall)).toBeUndefined();
      // Only an object can carry the mark; anything else is rethrown as it was.
      await expect(target.request("/modules/stats-search")).rejects.toMatchObject({
        outcome: "definite-failure",
        cause: "not an object",
      });
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("bounds each probe to 5 s", async () => {
    vi.useFakeTimers();
    fake.fail = "health";
    fake.hang = true;
    const started = clients.searchClient(testScope(), probe, { index: "stats-index" });
    const failed = expect(started).rejects.toThrow("Startup probe failed: search stats-index");
    await vi.advanceTimersByTimeAsync(5000);
    await failed;
    expect(lines.at(-1)).toMatchObject({ result: "failed", error: "Error: Probe deadline (5 s)" });
  });
});

describe("a stub's database transaction (QL03)", () => {
  type Tx = {
    query(sql: string, values?: unknown[]): Promise<unknown[]>;
    execute(sql: string, values?: unknown[]): Promise<{ rowCount: number }>;
  };
  type Database = Tx & {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  };
  beforeEach(() => environment(localEnvironment));
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.connections.length = 0;
    fake.answer = undefined;
    lines.length = 0;
    vi.useRealTimers();
    restoreEnvironment();
  });
  /** The stub stack's Links database client, after its probe. */
  async function database(): Promise<Database> {
    const db = await clients.databaseClient(testScope(), probe, {
      tile: "links-api",
      resource: "links-db",
    });
    fake.calls.length = 0;
    return db;
  }
  /** A PostgreSQL error as pg gives it: its SQLSTATE is `code`. */
  const sqlError = (message: string, code?: string) =>
    Object.assign(new Error(message), code === undefined ? {} : { code });
  const control = "Transaction control is owned by transaction()";

  it("runs BEGIN, its statements and COMMIT on one reserved connection while a query uses the pool", async () => {
    const db = await database();
    const result = await db.transaction(async (tx) => {
      const [rows, elsewhere] = await Promise.all([
        tx.query("SELECT $1", [1]),
        db.query("SELECT 2"),
      ]);
      const inserted = await tx.execute("INSERT INTO t VALUES ($1)", ["a"]);
      return { rows, elsewhere, inserted, updated: await tx.execute("UPDATE t SET x = 1") };
    });
    expect(result).toEqual({
      rows: [{ sql: "SELECT $1", values: [1] }],
      elsewhere: [{ sql: "SELECT 2" }],
      inserted: { rowCount: 1 },
      // pg gives a null rowCount here.
      updated: { rowCount: 0 },
    });
    expect(fake.connections).toEqual([
      [
        "BEGIN",
        "SELECT $1",
        "INSERT INTO t VALUES ($1)",
        "UPDATE t SET x = 1",
        "COMMIT",
        "release",
      ],
    ]);
    expect(fake.calls).toEqual([["SELECT 2"]]);
  });

  it("rolls back when fn throws or a statement fails, and a Tx used after its transaction rejects", async () => {
    const db = await database();
    let kept: Tx | undefined;
    await expect(
      db.transaction(async (tx) => {
        kept = tx;
        await tx.execute("INSERT INTO t VALUES (1)");
        throw new Error("Stop");
      }),
    ).rejects.toThrow("Stop");
    await expect(kept?.query("SELECT 1")).rejects.toThrow("SQL transaction is not active");
    // A failed statement fails its transaction when fn catches it, or never awaits it.
    const duplicate = sqlError("duplicate key value", "23505");
    fake.answer = (sql) => {
      if (sql.startsWith("INSERT")) throw duplicate;
    };
    await expect(
      db.transaction(async (tx) => {
        await tx.execute("INSERT INTO t VALUES (2)").catch(() => {});
        return "done";
      }),
    ).rejects.toBe(duplicate);
    await expect(
      db.transaction(async (tx) => {
        void tx.execute("INSERT INTO t VALUES (3)");
        return "done";
      }),
    ).rejects.toBe(duplicate);
    expect(fake.connections).toEqual(
      [1, 2, 3].map((n) => ["BEGIN", `INSERT INTO t VALUES (${n})`, "ROLLBACK", "release"]),
    );
    expect(fake.calls).toEqual([]);
  });

  it("refuses transaction control before sending it", async () => {
    const db = await database();
    await db.transaction(async (tx) => {
      for (const sql of [
        "BEGIN",
        "  begin;",
        "\n\tSTART  TRANSACTION",
        "COMMIT",
        "end",
        "Rollback to savepoint a",
        "ABORT",
        "SAVEPOINT a",
        "RELEASE SAVEPOINT a",
        "PREPARE TRANSACTION 'x'",
      ]) {
        await expect(tx.execute(sql)).rejects.toThrow(control);
        await expect(tx.query(sql)).rejects.toThrow(control);
      }
      // The transaction's own isolation level and a prepared statement are not control.
      await tx.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      await tx.execute("PREPARE q AS SELECT 1");
    });
    expect(fake.connections).toEqual([
      [
        "BEGIN",
        "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE",
        "PREPARE q AS SELECT 1",
        "COMMIT",
        "release",
      ],
    ]);
  });

  it("reruns fn on a new transaction 20 ms after a serialization failure", async () => {
    const db = await database();
    vi.useFakeTimers();
    fake.answer = (sql, connection) => {
      if (sql.startsWith("UPDATE") && connection === 1)
        throw sqlError("could not serialize access", "40001");
    };
    let runs = 0;
    const settled = db.transaction(async (tx) => {
      runs += 1;
      await tx.execute("UPDATE t SET x = 1");
      return runs;
    });
    await vi.advanceTimersByTimeAsync(19);
    expect(fake.connections).toEqual([["BEGIN", "UPDATE t SET x = 1", "ROLLBACK", "release"]]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toBe(2);
    expect(fake.connections).toEqual([
      ["BEGIN", "UPDATE t SET x = 1", "ROLLBACK", "release"],
      ["BEGIN", "UPDATE t SET x = 1", "COMMIT", "release"],
    ]);
  });

  it("rethrows the third serialization failure or deadlock, rerun after 20 ms and then 40 ms", async () => {
    const db = await database();
    vi.useFakeTimers();
    const failures = [
      sqlError("could not serialize access 1", "40001"),
      sqlError("deadlock detected 2", "40P01"),
      sqlError("could not serialize access 3", "40001"),
    ];
    fake.answer = (sql, connection) => {
      if (sql.startsWith("UPDATE")) throw failures[connection - 1];
    };
    const settled = db
      .transaction(async (tx) => tx.execute("UPDATE t SET x = 1"))
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20);
    expect(fake.connections).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(39);
    expect(fake.connections).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toBe(failures[2]);
    expect(fake.connections).toEqual(
      [1, 2, 3].map(() => ["BEGIN", "UPDATE t SET x = 1", "ROLLBACK", "release"]),
    );
  });

  it("rejects TransactionOutcomeUnknown, never the result, when the COMMIT loses its connection", async () => {
    const db = await database();
    const lost = [
      sqlError("connection failure", "08006"),
      sqlError("terminating connection due to administrator command", "57P01"),
      sqlError("the database system is shutting down", "57P02"),
      sqlError("Connection terminated unexpectedly"),
      sqlError("Query read timeout"),
      sqlError("write EPIPE", "EPIPE"),
    ];
    for (const error of lost) {
      fake.answer = (sql) => {
        if (sql === "COMMIT" || sql === "ROLLBACK") throw error;
      };
      const outcome = await db
        .transaction(async (tx) => {
          await tx.execute("INSERT INTO t VALUES (1)");
          return "committed";
        })
        .catch((caught: unknown) => caught);
      expect(outcome).toBeInstanceOf(Error);
      expect(outcome).toMatchObject({
        name: "TransactionOutcomeUnknown",
        message: "Transaction outcome unknown",
        cause: error,
      });
    }
    // Never rerun: one connection each, discarded when its ROLLBACK fails too.
    expect(fake.connections).toEqual(
      lost.map(() => [
        "BEGIN",
        "INSERT INTO t VALUES (1)",
        "COMMIT",
        "ROLLBACK",
        "release discard",
      ]),
    );
    // A COMMIT the server answered with another SQLSTATE rolled back: its own error.
    const deferred = sqlError("duplicate key value", "23505");
    fake.answer = (sql) => {
      if (sql === "COMMIT") throw deferred;
    };
    await expect(db.transaction(async () => "committed")).rejects.toBe(deferred);
    // A lost connection before fn resolved is that statement's error.
    const before = sqlError("connection failure", "08006");
    fake.answer = (sql) => {
      if (sql.startsWith("INSERT")) throw before;
    };
    await expect(db.transaction(async (tx) => tx.execute("INSERT INTO t VALUES (2)"))).rejects.toBe(
      before,
    );
  });

  it("reruns a COMMIT's serialization failure, and rethrows it on the third attempt", async () => {
    const db = await database();
    vi.useFakeTimers();
    const failures = [1, 2, 3].map((n) => sqlError(`could not serialize access ${n}`, "40001"));
    fake.answer = (sql, connection) => {
      if (sql === "COMMIT") throw failures[connection - 1];
    };
    let runs = 0;
    const settled = db
      .transaction(async () => {
        runs += 1;
        return runs;
      })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(60);
    expect(await settled).toBe(failures[2]);
    expect(runs).toBe(3);
    expect(fake.connections).toEqual(
      [1, 2, 3].map(() => ["BEGIN", "COMMIT", "ROLLBACK", "release"]),
    );
  });
});

describe("a stub's idempotency records (QL04)", () => {
  type Tx = {
    execute(sql: string, values?: unknown[]): Promise<{ rowCount: number }>;
  };
  type Answer = { status: number; body: unknown };
  type Database = {
    idempotent(
      request: {
        scope: { kind: string; id: string };
        key: string;
        hash: string;
      },
      fn: (tx: Tx) => Promise<Answer>,
    ): Promise<Answer & { replayed: boolean }>;
  };
  const hash = idempotency.requestHash({ method: "POST", route: "POST /links", body: { a: 1 } });
  const request = { scope: { kind: "account", id: "acct-1" }, key: "key-1", hash };
  const key = ["links-api", "account", "acct-1", "key-1"];
  const lock = "SELECT pg_try_advisory_lock(hashtext('jeeves.idempotency')) AS locked";
  const unlock = "SELECT pg_advisory_unlock(hashtext('jeeves.idempotency'))";
  /** Each statement a reserved connection sent, with its values. */
  const sent: { sql: string; values?: unknown[] }[] = [];
  const scopes: ReturnType<typeof testScope>[] = [];
  beforeEach(() => environment(localEnvironment));
  afterEach(async () => {
    // Drain each client: its sweep stops, then its pool ends.
    for (const scope of scopes.splice(0))
      for (const drain of [...scope.owned].reverse()) await drain();
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.connections.length = 0;
    fake.answer = undefined;
    sent.length = 0;
    lines.length = 0;
    vi.useRealTimers();
    restoreEnvironment();
  });
  /** The stub stack's Links database client, after its probe. Unless `answer` says otherwise, the
   * sweep doesn't get its lock, an UPDATE changes one row and the rest as the fake pool answers. */
  async function database(answer?: (sql: string) => unknown): Promise<Database> {
    const scope = testScope();
    scopes.push(scope);
    const db = await clients.databaseClient(scope, probe, {
      tile: "links-api",
      resource: "links-db",
    });
    fake.answer = (sql, _connection, values) => {
      sent.push({ sql, values });
      const given = answer?.(sql);
      if (given !== undefined) return given;
      if (sql === lock) return { rows: [{ locked: false }], rowCount: 1 };
      if (sql.startsWith("UPDATE jeeves")) return { rows: [], rowCount: 1 };
    };
    fake.calls.length = 0;
    return db;
  }
  /** The transactions' connections, without the sweep's. */
  const transactions = () => fake.connections.filter((statements) => statements[0] === "BEGIN");
  const sweeps = () => fake.connections.filter((statements) => statements[0] === lock);
  const short = (sql: string) =>
    sql.startsWith("INSERT INTO links") ? sql : sql.split(" ").slice(0, 2).join(" ");

  it("runs BEGIN, DELETE, INSERT, fn, UPDATE and COMMIT for a new key, and stores a 2xx answer", async () => {
    const db = await database();
    const result = await db.idempotent(request, async (tx) => {
      await tx.execute("INSERT INTO links VALUES ($1)", ["a"]);
      return { status: 201, body: { id: "a" } };
    });
    expect(result).toEqual({ status: 201, body: { id: "a" }, replayed: false });
    expect(transactions().map((statements) => statements.map(short))).toEqual([
      [
        "BEGIN",
        "DELETE FROM",
        "INSERT INTO",
        "INSERT INTO links VALUES ($1)",
        "UPDATE jeeves.idempotency_records",
        "COMMIT",
        "release",
      ],
    ]);
    const [statements] = transactions();
    expect(statements?.[1]).toBe(
      "DELETE FROM jeeves.idempotency_records WHERE tile = $1 AND scope_kind = $2 AND scope_id = $3 AND idem_key = $4 AND expires_at <= now()",
    );
    expect(statements?.[2]).toBe(
      "INSERT INTO jeeves.idempotency_records (tile, scope_kind, scope_id, idem_key, request_hash, status, response, created_at, expires_at) VALUES ($1, $2, $3, $4, decode($5, 'hex'), 0, '{}', now(), now() + interval '86400 seconds') ON CONFLICT DO NOTHING",
    );
    expect(statements?.[4]).toBe(
      "UPDATE jeeves.idempotency_records SET status = $5, response = $6::jsonb WHERE tile = $1 AND scope_kind = $2 AND scope_id = $3 AND idem_key = $4",
    );
  });

  it("passes the record's tile, scope, key and hash, and the answer as JSON", async () => {
    const db = await database();
    await db.idempotent(request, async () => ({ status: 200, body: { list: [1, 2] } }));
    const values = (start: string) => sent.find((row) => row.sql.startsWith(start))?.values;
    expect(values("DELETE FROM jeeves")).toEqual(key);
    expect(values("INSERT INTO jeeves")).toEqual([...key, hash]);
    expect(values("UPDATE jeeves")).toEqual([...key, 200, '{"list":[1,2]}']);
    // No body is stored as JSON null.
    sent.length = 0;
    await db.idempotent(request, async () => ({ status: 204, body: undefined }));
    expect(values("UPDATE jeeves")).toEqual([...key, 204, "null"]);
  });

  it("replays a stored answer without running fn", async () => {
    const db = await database((sql) => {
      if (sql.startsWith("INSERT INTO jeeves")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("SELECT encode"))
        return { rows: [{ hash, status: 201, response: { id: "a" } }], rowCount: 1 };
    });
    const fn = vi.fn(async () => ({ status: 201, body: "again" }));
    expect(await db.idempotent(request, fn)).toEqual({
      status: 201,
      body: { id: "a" },
      replayed: true,
    });
    expect(fn).not.toHaveBeenCalled();
    expect(transactions().map((statements) => statements.map(short))).toEqual([
      ["BEGIN", "DELETE FROM", "INSERT INTO", "SELECT encode(request_hash,", "COMMIT", "release"],
    ]);
  });

  it("throws IdempotencyConflict after ROLLBACK for a different request under the key", async () => {
    const db = await database((sql) => {
      if (sql.startsWith("INSERT INTO jeeves")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("SELECT encode"))
        return { rows: [{ hash: "0".repeat(64), status: 201, response: {} }], rowCount: 1 };
    });
    const fn = vi.fn(async () => ({ status: 201, body: {} }));
    const conflict = await db.idempotent(request, fn).catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(idempotency.IdempotencyConflict);
    expect(conflict).toMatchObject({ name: "IdempotencyConflict" });
    expect(fn).not.toHaveBeenCalled();
    expect(transactions().map((statements) => statements.map(short))).toEqual([
      ["BEGIN", "DELETE FROM", "INSERT INTO", "SELECT encode(request_hash,", "ROLLBACK", "release"],
    ]);
    // A record that went between the INSERT and the SELECT: try again.
    const gone = await database((sql) => {
      if (sql.startsWith("INSERT INTO jeeves")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("SELECT encode")) return { rows: [], rowCount: 0 };
    });
    await expect(gone.idempotent(request, fn)).rejects.toThrow(
      /^Idempotency record changed; retry$/,
    );
  });

  it("rolls back a non-2xx answer with fn's writes and returns it, not stored", async () => {
    const db = await database();
    const result = await db.idempotent(request, async (tx) => {
      await tx.execute("INSERT INTO links VALUES ($1)", ["a"]);
      return { status: 403, body: { error: "FORBIDDEN" } };
    });
    expect(result).toEqual({ status: 403, body: { error: "FORBIDDEN" }, replayed: false });
    expect(transactions().map((statements) => statements.map(short))).toEqual([
      [
        "BEGIN",
        "DELETE FROM",
        "INSERT INTO",
        "INSERT INTO links VALUES ($1)",
        "ROLLBACK",
        "release",
      ],
    ]);
    // fn's own error rolls back too, and rejects with it.
    await expect(
      db.idempotent(request, async () => {
        throw new Error("Stop");
      }),
    ).rejects.toThrow("Stop");
  });

  it("refuses an invalid key before BEGIN, and starts no sweep", async () => {
    const db = await database();
    for (const bad of [
      { ...request, key: "" },
      { ...request, key: "with space" },
      { ...request, key: "k".repeat(256) },
      { ...request, scope: { kind: "Account", id: "1" } },
      { ...request, scope: { kind: "account", id: "" } },
    ])
      await expect(db.idempotent(bad, async () => ({ status: 200, body: {} }))).rejects.toThrow(
        /^Invalid idempotency key$/,
      );
    await expect(
      db.idempotent({ ...request, hash: "nope" }, async () => ({ status: 200, body: {} })),
    ).rejects.toThrow(/^Invalid request hash$/);
    expect(fake.connections).toEqual([]);
  });

  it("sweeps from the first call and every 60 s with the advisory lock, and stops at drain", async () => {
    vi.useFakeTimers();
    const db = await database((sql) => {
      if (sql === lock) return { rows: [{ locked: true }], rowCount: 1 };
      if (sql.startsWith("DELETE FROM jeeves.idempotency_records WHERE (tile"))
        return { rows: [], rowCount: 2 };
    });
    await db.idempotent(request, async () => ({ status: 200, body: {} }));
    await vi.advanceTimersByTimeAsync(0);
    const sweep = [
      lock,
      "DELETE FROM jeeves.idempotency_records WHERE (tile, scope_kind, scope_id, idem_key) IN (SELECT tile, scope_kind, scope_id, idem_key FROM jeeves.idempotency_records WHERE status BETWEEN 200 AND 299 AND expires_at <= now() ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)",
      unlock,
      "release",
    ];
    expect(sweeps()).toEqual([sweep]);
    // One sweep per client: a second call starts none.
    await db.idempotent(request, async () => ({ status: 200, body: {} }));
    await vi.advanceTimersByTimeAsync(59_999);
    expect(sweeps()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sweeps()).toEqual([sweep, sweep]);
    // Drain: the sweep stops before the pool ends, and no timer is left.
    for (const scope of scopes.splice(0))
      for (const drain of [...scope.owned].reverse()) await drain();
    expect(fake.calls).toEqual([["end"]]);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(sweeps()).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing without the lock, and logs a failed sweep's failure line, discarding its connection", async () => {
    vi.useFakeTimers();
    const db = await database();
    await db.idempotent(request, async () => ({ status: 200, body: {} }));
    await vi.advanceTimersByTimeAsync(0);
    expect(sweeps()).toEqual([[lock, "release"]]);
    const out = stdout();
    try {
      fake.answer = (sql) => {
        if (sql === lock) return { rows: [{ locked: true }], rowCount: 1 };
        if (sql.startsWith("DELETE FROM jeeves.idempotency_records WHERE (tile"))
          throw new Error("canceling statement due to statement timeout");
      };
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sweeps()[1]).toEqual([
        lock,
        "DELETE FROM jeeves.idempotency_records WHERE (tile, scope_kind, scope_id, idem_key) IN (SELECT tile, scope_kind, scope_id, idem_key FROM jeeves.idempotency_records WHERE status BETWEEN 200 AND 299 AND expires_at <= now() ORDER BY expires_at LIMIT $1 FOR UPDATE SKIP LOCKED)",
        "release discard",
      ]);
      expect(out.lines()).toEqual([
        {
          level: "error",
          event: "failure",
          tile: "links-api",
          what: "idempotency sweep links-api",
          error: "Error: canceling statement due to statement timeout",
        },
      ]);
    } finally {
      out.restore();
    }
  });
});

describe("store and tile endpoints come from the environment (QG06)", () => {
  beforeEach(() => environment(localEnvironment));
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.fail = undefined;
    lines.length = 0;
    restoreEnvironment();
    vi.unstubAllGlobals();
  });
  const links = { tile: "links-api", resource: "links-db" };
  /** What a client's construction rejects or throws with, for each case's `values` over `base`. */
  async function refusals(
    build: () => unknown,
    cases: readonly [Record<string, string | undefined>, string][],
    base: Record<string, string> = localEnvironment,
  ) {
    const seen: [string, string][] = [];
    for (const [values, variable] of cases) {
      environment(base);
      environment(values);
      const error = await Promise.resolve()
        .then(build)
        .then(
          () => new Error("built"),
          (thrown: Error) => thrown,
        );
      seen.push([error.message, variable]);
      // The message names the variable, never its value.
      for (const value of Object.values(values))
        if (value) expect(error.message).not.toContain(value);
    }
    return seen;
  }
  const expected = (cases: readonly [unknown, string][]) =>
    cases.map(([, variable]) => [`Invalid endpoint ${variable}`, variable]);

  it("passes a database's host and port from its environment to its pool, a Unix socket directory too", async () => {
    environment({
      JEEVES_DATABASE_LINKS_DB_HOST: "db.internal",
      JEEVES_DATABASE_LINKS_DB_PORT: "6432",
    });
    await clients.databaseClient(testScope(), probe, links);
    // A Cloud SQL socket directory, as `pg` reads a host that is an absolute path.
    environment({ JEEVES_DATABASE_LINKS_DB_HOST: "/cloudsql/p:r:i" });
    await clients.databaseClient(testScope(), probe, links);
    environment({
      JEEVES_DATABASE_LINKS_DB_HOST: "a".repeat(253),
      JEEVES_DATABASE_LINKS_DB_PORT: "65535",
    });
    await clients.databaseClient(testScope(), probe, links);
    expect(fake.endpoints).toEqual([
      ["postgres", "db.internal", 6432],
      ["postgres", "/cloudsql/p:r:i", 6432],
      ["postgres", "a".repeat(253), 65535],
    ]);
    expect(lines.map((line) => line.result)).toEqual(["ok", "ok", "ok"]);
  });

  it("fails a database client naming its missing or invalid variable, before any probe", async () => {
    const host = "JEEVES_DATABASE_LINKS_DB_HOST";
    const port = "JEEVES_DATABASE_LINKS_DB_PORT";
    const cases: [Record<string, string | undefined>, string][] = [
      [{ [host]: undefined }, host],
      [{ [host]: "" }, host],
      [{ [host]: "db internal" }, host],
      [{ [host]: "db_internal" }, host],
      [{ [host]: "a".repeat(254) }, host],
      [{ [host]: "cloudsql/p:r:i" }, host],
      [{ [port]: undefined }, port],
      [{ [port]: "0" }, port],
      [{ [port]: "65536" }, port],
      [{ [port]: "05432" }, port],
      [{ [port]: "5432x" }, port],
      [{ [port]: "-1" }, port],
    ];
    expect(await refusals(() => clients.databaseClient(testScope(), probe, links), cases)).toEqual(
      expected(cases),
    );
    // No pool was created and no probe ran or logged.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("connects a cache at its environment's host and port; a cache's host is never a path", async () => {
    const out = stdout();
    try {
      environment({
        JEEVES_CACHE_LINKS_CACHE_HOST: "10.1.2.3",
        JEEVES_CACHE_LINKS_CACHE_PORT: "6380",
      });
      const scope = testScope();
      await clients.cacheClient(scope, probe, { cache: "links-cache" });
      expect(fake.calls[0]).toEqual([
        "createClient",
        expect.objectContaining({
          password: "secret of cache-links-cache",
          socket: expect.objectContaining({ host: "10.1.2.3", port: 6380 }),
        }),
      ]);
      await scope.owned[0]?.();
      fake.calls.length = 0;
      lines.length = 0;
      const host = "JEEVES_CACHE_LINKS_CACHE_HOST";
      const port = "JEEVES_CACHE_LINKS_CACHE_PORT";
      const cases: [Record<string, string | undefined>, string][] = [
        [{ [host]: undefined }, host],
        [{ [host]: "/run/valkey" }, host],
        [{ [host]: "cache-links-cache:6379" }, host],
        [{ [port]: undefined }, port],
        [{ [port]: "70000" }, port],
      ];
      expect(
        await refusals(
          () => clients.cacheClient(testScope(), probe, { cache: "links-cache" }),
          cases,
        ),
      ).toEqual(expected(cases));
      expect(fake.calls).toEqual([]);
      expect(lines).toEqual([]);
    } finally {
      out.restore();
    }
  });

  it("opens the broker at its environment's host and port, for a publisher and a stub's loop", async () => {
    environment({ JEEVES_BROKER_HOST: "mq.internal", JEEVES_BROKER_PORT: "5673" });
    // What a stub's loop passes to startModuleLoop.
    expect(clients.brokerBinding()).toEqual({
      hostname: "mq.internal",
      port: 5673,
      username: "runtime",
      passwordSecret: "broker-password",
      heartbeatSeconds: 10,
      confirmTimeoutMs: 5000,
    });
    await clients.queuePublisher(testScope(), probe, { queue: "visits", mode: "topic" });
    expect(fake.endpoints).toEqual([["broker", "mq.internal", 5673]]);
    fake.calls.length = 0;
    lines.length = 0;
    const cases: [Record<string, string | undefined>, string][] = [
      [{ JEEVES_BROKER_HOST: undefined }, "JEEVES_BROKER_HOST"],
      [{ JEEVES_BROKER_HOST: "amqp://mq.internal" }, "JEEVES_BROKER_HOST"],
      [{ JEEVES_BROKER_PORT: "" }, "JEEVES_BROKER_PORT"],
    ];
    expect(
      await refusals(
        () => clients.queuePublisher(testScope(), probe, { queue: "visits", mode: "topic" }),
        cases,
      ),
    ).toEqual(expected(cases));
    expect(await refusals(() => clients.brokerBinding(), cases)).toEqual(expected(cases));
    // Refused before the probe: no broker opened and no probe line.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("calls another tile at its environment's URL: absolute http or https, no credentials, query or fragment", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    environment({ JEEVES_TILE_STATS_API_URL: "https://stats.internal:8443" });
    await clients.externalTarget("JEEVES_TILE_STATS_API_URL").request("/modules/stats-search");
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://stats.internal:8443/modules/stats-search"),
      expect.objectContaining({
        redirect: "manual",
        credentials: "omit",
        signal: expect.any(AbortSignal),
      }),
    );
    const name = "JEEVES_TILE_STATS_API_URL";
    const credentials = ["http://", ["user", "pass"].join(":"), "@stats.internal"].join("");
    const cases: [Record<string, string | undefined>, string][] = [
      [{ [name]: undefined }, name],
      [{ [name]: "" }, name],
      [{ [name]: "/modules" }, name],
      [{ [name]: "stats.internal:8443" }, name],
      [{ [name]: "ftp://stats.internal" }, name],
      [{ [name]: credentials }, name],
      [{ [name]: "http://user@stats.internal" }, name],
      [{ [name]: "http://stats.internal/?a=1" }, name],
      [{ [name]: "http://stats.internal/?" }, name],
      [{ [name]: "http://stats.internal/#top" }, name],
    ];
    expect(await refusals(() => clients.httpTarget({ tile: "stats-api" }), cases)).toEqual(
      expected(cases),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("checks a cache endpoint by the same host rule in createValkeyCache, and reads a cache read's by name", async () => {
    const binding = (hostname: string) => ({ hostname, port: 6379, secret: "cache-hot-routes" });
    // R3: an address, upper case and the longest name pass the bounded client's own check.
    for (const hostname of ["10.1.2.3", "Cache-1.Internal", "a".repeat(253)]) {
      const cache = await valkey.createValkeyCache({ binding: binding(hostname) });
      cache.close();
    }
    expect(
      fake.calls
        .filter((call) => call[0] === "createClient")
        .map((call) => (call[1] as { socket: { host: string } }).socket.host),
    ).toEqual(["10.1.2.3", "Cache-1.Internal", "a".repeat(253)]);
    for (const hostname of ["", "a".repeat(254), "cache_hot", "/run/valkey"])
      await expect(valkey.createValkeyCache({ binding: binding(hostname) })).rejects.toThrow(
        /^Invalid cache endpoint$/,
      );
    // A cache read's process reads its cache's endpoint by the cache's ID (`hot-routes` is
    // HOT_ROUTES).
    const hotRoutes = {
      JEEVES_CACHE_HOT_ROUTES_HOST: "cache.internal",
      JEEVES_CACHE_HOT_ROUTES_PORT: "6380",
      JEEVES_CACHE_HOT_ROUTES_TLS: "disable",
    };
    environment(hotRoutes);
    expect(valkey.cacheEndpoint("hot-routes")).toEqual({
      hostname: "cache.internal",
      port: 6380,
      tls: { mode: "disable" },
    });
    const cases: [Record<string, string | undefined>, string][] = [
      [{ JEEVES_CACHE_HOT_ROUTES_HOST: undefined }, "JEEVES_CACHE_HOT_ROUTES_HOST"],
      [{ JEEVES_CACHE_HOT_ROUTES_HOST: "/run/valkey" }, "JEEVES_CACHE_HOT_ROUTES_HOST"],
      [{ JEEVES_CACHE_HOT_ROUTES_PORT: "6380.5" }, "JEEVES_CACHE_HOT_ROUTES_PORT"],
    ];
    expect(await refusals(() => valkey.cacheEndpoint("hot-routes"), cases, hotRoutes)).toEqual(
      expected(cases),
    );
  });
});

// The loops' own test for an unreachable store (delivery.ts, as emitted).
const delivery = await import(dataUrl(String(fakes["./delivery.ts"])));

describe("an External API's and the Identity's HTTP clients (QG20)", () => {
  afterEach(() => {
    restoreEnvironment();
    vi.unstubAllGlobals();
  });
  const internalCall = Symbol.for("jeeves.internal-call");
  const external = "JEEVES_EXTERNAL_PARTNER_URL";
  const identity = "JEEVES_IDENTITY_IDENTITY_URL";
  /** A `fetch` that lost its connection, as undici rejects it. */
  const lost = () =>
    new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.9:443"), {
        code: "ECONNREFUSED",
      }),
    });
  /** What building a client throws, or "built". */
  const outcome = (build: () => unknown) => {
    try {
      build();
      return "built";
    } catch (error) {
      return (error as Error).message;
    }
  };
  it("bounds an External API at its declared URL and refuses product credential overrides", async () => {
    const response = new Response(null, { status: 402 });
    const fetch = vi.fn(async () => response.clone());
    vi.stubGlobal("fetch", fetch);
    environment({ [external]: "https://api.partner.example/v1/" });
    const target = clients.externalTarget(external);
    // The stub's own init: its signal bounds the call and its header carries its own credential.
    const init = {
      method: "POST",
      headers: { authorization: ["Bearer", randomUUID()].join(" ") },
      signal: AbortSignal.timeout(1000),
    };
    await expect(target.request("charges", init)).rejects.toMatchObject({
      outcome: "refused",
      code: "PROTECTED_HEADER",
    });
    expect(fetch).not.toHaveBeenCalled();
    delete (init.headers as { authorization?: string }).authorization;
    expect(await target.request("charges", init)).toMatchObject({ status: response.status });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      new URL("https://api.partner.example/v1/charges"),
      expect.objectContaining({
        redirect: "manual",
        credentials: "omit",
        headers: expect.any(Headers),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(((fetch.mock.calls[0] as unknown[])[1] as RequestInit).headers).toBeInstanceOf(Headers);
    // Without one the client adds nothing: it reads no credential.
    await target.request("/status");
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      new URL("https://api.partner.example/status"),
      expect.objectContaining({
        redirect: "manual",
        credentials: "omit",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("never marks an External API's failed call, so a loop keeps the normal retries; the Identity's is marked", async () => {
    const refused = lost();
    const fetch = vi.fn().mockRejectedValueOnce(refused).mockRejectedValueOnce("not an object");
    vi.stubGlobal("fetch", fetch);
    environment({ [external]: "https://api.partner.example" });
    const target = clients.externalTarget(external);
    await expect(target.request("/v1/x")).rejects.toMatchObject({
      outcome: "definite-failure",
      cause: refused,
    });
    expect(Reflect.get(refused, internalCall)).toBeUndefined();
    expect(delivery.unreachable(refused)).toBe(false);
    await expect(target.request("/v1/x")).rejects.toMatchObject({
      outcome: "definite-failure",
      cause: "not an object",
    });
    // The Identity is a provisioned service: its lost connection waits as a store's does.
    const away = lost();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(away));
    environment({ [identity]: "https://issuer.example" });
    await expect(
      clients.identityTarget({ identity: "identity" }).request("/realms/identity"),
    ).rejects.toMatchObject({ outcome: "definite-failure", cause: away });
    expect(Reflect.get(away, internalCall)).toBeUndefined();
    expect(delivery.unreachable(away)).toBe(false);
  });

  it("calls the Identity at JEEVES_IDENTITY_<ID>_URL, where the process reaches it, never at OIDC_ISSUER (QGR2)", async () => {
    const response = new Response("{}");
    const fetch = vi.fn(async () => response.clone());
    vi.stubGlobal("fetch", fetch);
    // A sign-in's issuer is the browser's address, which a container can't reach (QG20's proof);
    // the client's base is Keycloak inside the network, as compose.yaml sets it.
    environment({
      OIDC_ISSUER: "http://127.0.0.1:47922/realms/identity",
      [identity]: "http://identity-identity:8080",
    });
    const init = { headers: { accept: "application/json" } };
    expect(
      await clients
        .identityTarget({ identity: "identity" })
        .request("/realms/identity/.well-known/openid-configuration", init),
    ).toMatchObject({ status: response.status });
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://identity-identity:8080/realms/identity/.well-known/openid-configuration"),
      expect.objectContaining({
        redirect: "manual",
        credentials: "omit",
        headers: expect.any(Headers),
        signal: expect.any(AbortSignal),
      }),
    );
    // The variable is the Identity's own, by its local ID.
    environment({ [identity]: undefined, JEEVES_IDENTITY_SIGN_IN_URL: "https://id.example" });
    await clients.identityTarget({ identity: "sign-in" }).request("/realms/sign-in");
    expect(fetch).toHaveBeenLastCalledWith(
      new URL("https://id.example/realms/sign-in"),
      expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }),
    );
    expect(outcome(() => clients.identityTarget({ identity: "identity" }))).toBe(
      `Invalid endpoint ${identity}`,
    );
  });

  it("fails naming JEEVES_EXTERNAL_<ID>_URL or JEEVES_IDENTITY_<ID>_URL when unset or invalid, never its value", () => {
    const credentials = ["https://", ["user", "pass"].join(":"), "@api.partner.example"].join("");
    const invalid = [
      undefined,
      "",
      "/v1",
      "api.partner.example",
      "ftp://api.partner.example",
      credentials,
      "https://api.partner.example/?key=1",
      "https://api.partner.example/#top",
    ];
    for (const [name, build] of [
      [external, () => clients.externalTarget(external)],
      [identity, () => clients.identityTarget({ identity: "identity" })],
    ] as const)
      for (const value of invalid) {
        environment({ [name]: value });
        const message = outcome(build);
        expect(message, `${name} ${value}`).toBe(`Invalid endpoint ${name}`);
        if (value) expect(message).not.toContain(value);
      }
  });

  it("refuses a URL with whitespace, a trailing newline too, naming the variable (QG26)", () => {
    // `new URL` would trim, drop or encode each, so the value checked wouldn't be the one set.
    const tile = "JEEVES_TILE_STATS_API_URL";
    const base = "https://api.partner.example";
    const spaced = [
      `${base}\n`,
      `${base}\r\n`,
      ` ${base}`,
      `${base}\t`,
      `${base}/v1 x`,
      "https://api.\npartner.example",
    ];
    for (const [name, build] of [
      [tile, () => clients.httpTarget({ tile: "stats-api" })],
      [external, () => clients.externalTarget(external)],
      [identity, () => clients.identityTarget({ identity: "identity" })],
    ] as const) {
      for (const value of spaced) {
        environment({ [name]: value });
        expect(outcome(build), `${name} ${JSON.stringify(value)}`).toBe(`Invalid endpoint ${name}`);
      }
      // The same URL without it is built.
      environment({ [name]: base });
      expect(outcome(build), name).toBe("built");
    }
  });

  it("with JEEVES_REQUIRE_TLS=true needs an https: External API and Identity, naming the variable", () => {
    environment({
      JEEVES_REQUIRE_TLS: "true",
      [external]: "http://api.partner.example",
      [identity]: "http://identity-identity:8080",
    });
    expect(outcome(() => clients.externalTarget(external))).toBe(`Insecure endpoint ${external}`);
    expect(outcome(() => clients.identityTarget({ identity: "identity" }))).toBe(
      `Insecure endpoint ${identity}`,
    );
    environment({
      [external]: "https://api.partner.example",
      [identity]: "https://issuer.example",
    });
    expect(outcome(() => clients.externalTarget(external))).toBe("built");
    expect(outcome(() => clients.identityTarget({ identity: "identity" }))).toBe("built");
    // Without the switch, http: passes as before; another switch value fails naming it.
    environment({ JEEVES_REQUIRE_TLS: undefined, [external]: "http://api.partner.example" });
    expect(outcome(() => clients.externalTarget(external))).toBe("built");
    environment({ JEEVES_REQUIRE_TLS: "1" });
    expect(outcome(() => clients.externalTarget(external))).toBe(
      "Invalid endpoint JEEVES_REQUIRE_TLS",
    );
  });
});

// The exact emitted postgres.ts, which both pools (a stub's `databaseClient` and a template's
// `pool`) are built through, with a fake `pg.Pool` constructor that records its options.
// QG07: the stub stack with Visits on Google Cloud, so its module-clients.ts has the Pub/Sub
// publisher beside RabbitMQ's (Uploaded's), on the same fakes and a fake official client.
const pubsubBundle = assembleV2(
  {
    designJson: canonicalJson(
      runStudioCommands(withStubWorkloads(stubStackDesign()), [
        { type: "setRunnableProcesses", on: true },
        {
          type: "edit",
          element: "visits",
          settings: { kind: "queue", mode: "topic", provider: "google-cloud" },
        },
      ]),
    ),
  },
  loadLocalV2Registry(),
);
const pubsubClients = await import(
  dataUrl(
    stripTypeScriptTypes(
      new TextDecoder().decode(
        pubsubBundle.files.find((file) => file.path === "src/runtime/module-clients.ts")?.bytes,
      ),
    ).replace(/from "([^"]+)"/g, (match, from: string) =>
      from === "./tile-process.ts"
        ? `from "${tileProcess}"`
        : fakes[from]
          ? `from "${dataUrl(fakes[from])}"`
          : match,
    ),
  )
);

describe("emitted pubsubPublisher: a stub's Pub/Sub topic (QG07)", () => {
  beforeEach(() => environment({ ...localEnvironment, JEEVES_PUBSUB_PROJECT: "local" }));
  afterEach(() => {
    fake.calls.length = 0;
    fake.fail = undefined;
    fake.pubsub = undefined;
    lines.length = 0;
    vi.useRealTimers();
    restoreEnvironment();
  });
  const visits = { topic: "visits" };
  const payload = new TextEncoder().encode("visit");
  /** Publishes that Pub/Sub acknowledges only when the test calls their `ack`. */
  function held() {
    const acks: ((id: string) => void)[] = [];
    fake.pubsub = { publish: () => new Promise<string>((resolve) => acks.push(resolve)) };
    return acks;
  }

  it("resolves only once Pub/Sub acknowledges, with the module's messageId as its attribute", async () => {
    const scope = testScope();
    const publisher = await pubsubClients.pubsubPublisher(scope, probe, visits);
    expect(fake.calls).toEqual([
      [
        "PubSub",
        {
          projectId: "local",
          "grpc.initial_reconnect_backoff_ms": 500,
          "grpc.max_reconnect_backoff_ms": 2000,
        },
      ],
      ["topic", "visits", { gaxOpts: { timeout: 2000, retry: null, maxRetries: 0 } }],
      ["exists"],
    ]);
    expect(lines).toEqual([
      {
        level: "info",
        client: "visits",
        kind: "queue",
        check: "the Pub/Sub topic exists",
        result: "ok",
      },
    ]);
    const acks = held();
    let settled = false;
    const sent = publisher
      .publish(payload, { messageId: "a", key: "ignored" })
      .then((value: unknown) => {
        settled = true;
        return value;
      });
    expect(fake.calls.at(-1)).toEqual(["publishMessage", "visit", { messageId: "a" }]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    acks[0]?.("server-1");
    await expect(sent).resolves.toBeUndefined();
    // Without one, each message gets a fresh ID.
    fake.pubsub = undefined;
    await publisher.publish(payload);
    await publisher.publish(payload);
    const ids = fake.calls.slice(-2).map((call) => (call[2] as { messageId: string }).messageId);
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids[0]).not.toBe(ids[1]);
    // It drains with the process; it is no broker transport.
    expect(scope.owned).toHaveLength(1);
    expect(scope.transports).toHaveLength(0);
    // RabbitMQ's publisher is emitted beside it, for Uploaded.
    expect(pubsubClients.queuePublisher).toBeTypeOf("function");
  });

  it("rejects a publish at 2000 ms, and the next at once while 1000 are outstanding", async () => {
    vi.useFakeTimers();
    const publisher = await pubsubClients.pubsubPublisher(testScope(), probe, visits);
    const acks = held();
    let settled = false;
    const late = publisher.publish(payload).finally(() => {
      settled = true;
    });
    const rejected = expect(late).rejects.toThrow("Publish deadline (2000 ms)");
    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    const outstanding = Array.from({ length: 999 }, () =>
      publisher.publish(payload).catch((error: Error) => error.message),
    );
    await expect(publisher.publish(payload)).rejects.toMatchObject({
      outcome: "refused",
      code: "PUBLISHER_FULL",
    });
    // The refused one never reached Pub/Sub.
    expect(fake.calls.filter((call) => call[0] === "publishMessage")).toHaveLength(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(new Set(await Promise.all(outstanding))).toEqual(
      new Set(["Publish deadline (2000 ms)"]),
    );
    // Caller timeout does not free a still-unsettled driver operation's place.
    await expect(publisher.publish(payload)).rejects.toMatchObject({
      outcome: "refused",
      code: "PUBLISHER_FULL",
    });
    for (const ack of acks) ack("late-confirm");
    await vi.advanceTimersByTimeAsync(0);
    // Only actual driver settlement frees the bounded places.
    fake.pubsub = undefined;
    await expect(publisher.publish(payload)).resolves.toBeUndefined();
  });

  it("waits for outstanding publishes when the process drains, then closes the client", async () => {
    const scope = testScope();
    const publisher = await pubsubClients.pubsubPublisher(scope, probe, visits);
    const acks = held();
    const sent = publisher.publish(payload, { messageId: "b" });
    let drained = false;
    const drain = Promise.resolve(scope.owned[0]?.()).then(() => {
      drained = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(drained).toBe(false);
    expect(fake.calls.map((call) => call[0])).not.toContain("close");
    // Draining, it takes no new publish.
    await expect(publisher.publish(payload)).rejects.toMatchObject({
      outcome: "refused",
      code: "PUBLISHER_CLOSED",
    });
    acks[0]?.("server-2");
    await sent;
    await drain;
    expect(fake.calls.at(-1)).toEqual(["close"]);
  });

  it("fails startup when its topic is missing or can't be checked, and reads its project from the environment", async () => {
    fake.pubsub = { exists: false };
    await expect(pubsubClients.pubsubPublisher(testScope(), probe, visits)).rejects.toThrow(
      "Startup probe failed: queue visits",
    );
    expect(lines.at(-1)).toEqual({
      level: "error",
      client: "visits",
      kind: "queue",
      check: "the Pub/Sub topic exists",
      result: "failed",
      error: "Error: Pub/Sub topic visits not found",
    });
    fake.pubsub = undefined;
    fake.fail = "exists";
    await expect(pubsubClients.pubsubPublisher(testScope(), probe, visits)).rejects.toThrow(
      "Startup probe failed: queue visits",
    );
    expect(lines.at(-1)).toMatchObject({ result: "failed", error: "Error: exists refused" });
    fake.fail = undefined;
    // A project ID, optionally domain-scoped; anything else fails by name before any client.
    for (const value of ["local", "my-project-123", "example.com:my-project"]) {
      environment({ JEEVES_PUBSUB_PROJECT: value });
      fake.calls.length = 0;
      await pubsubClients.pubsubPublisher(testScope(), probe, visits);
      expect(fake.calls[0]).toEqual([
        "PubSub",
        {
          projectId: value,
          "grpc.initial_reconnect_backoff_ms": 500,
          "grpc.max_reconnect_backoff_ms": 2000,
        },
      ]);
    }
    for (const value of [
      undefined,
      "",
      "Local",
      "1project",
      "my_project",
      "a b",
      `p${"x".repeat(30)}`,
    ]) {
      environment({ JEEVES_PUBSUB_PROJECT: value });
      fake.calls.length = 0;
      const error = await pubsubClients.pubsubPublisher(testScope(), probe, visits).then(
        () => new Error("built"),
        (thrown: Error) => thrown,
      );
      expect(error.message).toBe("Invalid endpoint JEEVES_PUBSUB_PROJECT");
      expect(fake.calls).toEqual([]);
    }
  });
});

describe("verified TLS bindings and an insecure-endpoint refusal (QG10)", () => {
  // A CA file is a PEM file the process reads as it builds the client; these tests check only that
  // its exact bytes reach the client, so its content is a marker made at run time.
  const directory = mkdtempSync(join(tmpdir(), "jeeves-qg10-"));
  const caFile = join(directory, "ca.pem");
  const caText = `test CA ${randomUUID()}\n`;
  writeFileSync(caFile, caText);
  mkdirSync(join(directory, "folder"));
  afterAll(() => rmSync(directory, { recursive: true, force: true }));
  beforeEach(() => {
    fake.calls.length = 0;
    fake.transports.length = 0;
    environment({ ...localEnvironment, JEEVES_REQUIRE_TLS: undefined });
  });
  afterEach(() => {
    fake.calls.length = 0;
    fake.endpoints.length = 0;
    fake.transports.length = 0;
    lines.length = 0;
    restoreEnvironment();
    vi.unstubAllGlobals();
  });
  const links = { tile: "links-api", resource: "links-db" };
  const db = (part: string) => `JEEVES_DATABASE_LINKS_DB_${part}`;
  const cache = (part: string) => `JEEVES_CACHE_LINKS_CACHE_${part}`;
  const tcp = {
    host: "cache-links-cache",
    port: 6379,
    connectTimeout: 500,
    reconnectStrategy: false,
  };
  /** The socket the cache's client was created with, after the client is closed. */
  async function cacheSocket() {
    const scope = testScope();
    await clients.cacheClient(scope, probe, { cache: "links-cache" });
    for (const drain of scope.owned) await drain();
    const created = fake.calls.filter((call) => call[0] === "createClient");
    const options = created.at(-1)?.[1] as { socket: unknown } | undefined;
    if (!options) throw new Error("No cache client was created");
    return options.socket;
  }
  /** What building a client rejects or throws with, or "built". */
  const outcome = (build: () => unknown) =>
    Promise.resolve()
      .then(build)
      .then(
        () => "built",
        (thrown: Error) => thrown.message,
      );

  it("passes a database's and a cache's transport to its client: disable, verify-full, a CA file and a certificate name", async () => {
    // Compose's local value.
    await clients.databaseClient(testScope(), probe, links);
    environment({ [db("TLS")]: "verify-full" });
    await clients.databaseClient(testScope(), probe, links);
    environment({ [db("CA_FILE")]: caFile, [db("TLS_SERVERNAME")]: "links-db.example" });
    await clients.databaseClient(testScope(), probe, links);
    // With disable, a CA file and a name are not read.
    environment({ [db("TLS")]: "disable", [db("CA_FILE")]: join(directory, "missing.pem") });
    await clients.databaseClient(testScope(), probe, links);
    expect(fake.transports).toEqual([
      { mode: "disable" },
      { mode: "verify-full" },
      { mode: "verify-full", ca: caText, servername: "links-db.example" },
      { mode: "disable" },
    ]);
    // A cache: plain TCP as before for disable; TLS that rejects an unverified certificate, with
    // the CA's PEM and the certificate's name, for verify-full.
    expect(await cacheSocket()).toEqual(tcp);
    environment({ [cache("TLS")]: "verify-full" });
    expect(await cacheSocket()).toEqual({ ...tcp, tls: true, rejectUnauthorized: true });
    environment({ [cache("CA_FILE")]: caFile, [cache("TLS_SERVERNAME")]: "cache.example" });
    expect(await cacheSocket()).toEqual({
      ...tcp,
      tls: true,
      rejectUnauthorized: true,
      ca: caText,
      servername: "cache.example",
    });
    environment({ [cache("TLS")]: "disable" });
    expect(await cacheSocket()).toEqual(tcp);
  });

  it("fails a database or cache naming a missing or invalid transport, name or switch, before any client", async () => {
    const cases: [Record<string, string | undefined>, string][] = [];
    for (const [kind, name] of [
      ["database", db],
      ["cache", cache],
    ] as const) {
      for (const value of [undefined, "", "require", "verify-ca", "VERIFY-FULL", "verify-full "])
        cases.push([{ [name("TLS")]: value, kind }, name("TLS")]);
      // A name by the host rule: Node's own check refuses others, `project:instance` included.
      for (const value of ["", "db example", "db_example", "p:i", "a".repeat(254)])
        cases.push([
          { [name("TLS")]: "verify-full", [name("TLS_SERVERNAME")]: value, kind },
          name("TLS_SERVERNAME"),
        ]);
      for (const value of ["", "1", "TRUE", "false", "yes"])
        cases.push([{ JEEVES_REQUIRE_TLS: value, kind }, "JEEVES_REQUIRE_TLS"]);
    }
    const seen: string[][] = [];
    for (const [{ kind, ...values }, variable] of cases) {
      environment(localEnvironment);
      environment(values);
      const message = await outcome(() =>
        kind === "database"
          ? clients.databaseClient(testScope(), probe, links)
          : clients.cacheClient(testScope(), probe, { cache: "links-cache" }),
      );
      seen.push([message, variable]);
      for (const value of Object.values(values)) if (value) expect(message).not.toContain(value);
      environment({
        JEEVES_REQUIRE_TLS: undefined,
        [db("TLS_SERVERNAME")]: undefined,
        [cache("TLS_SERVERNAME")]: undefined,
      });
    }
    expect(seen).toEqual(cases.map(([, variable]) => [`Invalid endpoint ${variable}`, variable]));
    // No pool or cache client was created and no probe ran or logged.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("fails startup naming a CA file that can't be read, and its error code, never its path", async () => {
    const seen: string[] = [];
    for (const name of [db, cache])
      for (const path of [join(directory, "missing.pem"), join(directory, "folder"), ""]) {
        environment({ [name("TLS")]: "verify-full", [name("CA_FILE")]: path });
        const message = await outcome(() =>
          name === db
            ? clients.databaseClient(testScope(), probe, links)
            : clients.cacheClient(testScope(), probe, { cache: "links-cache" }),
        );
        seen.push(message);
        if (path) expect(message).not.toContain(path);
        environment(localEnvironment);
      }
    expect(seen).toEqual([
      `Unreadable CA file ${db("CA_FILE")} (ENOENT)`,
      `Unreadable CA file ${db("CA_FILE")} (EISDIR)`,
      `Unreadable CA file ${db("CA_FILE")} (ENOENT)`,
      `Unreadable CA file ${cache("CA_FILE")} (ENOENT)`,
      `Unreadable CA file ${cache("CA_FILE")} (EISDIR)`,
      `Unreadable CA file ${cache("CA_FILE")} (ENOENT)`,
    ]);
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });

  it("with JEEVES_REQUIRE_TLS=true refuses a plain-text database, cache or tile and a Pub/Sub emulator, by name", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    const tile = "JEEVES_TILE_STATS_API_URL";
    environment({ JEEVES_REQUIRE_TLS: "true", [tile]: "http://stats.internal:3000" });
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe(
      `Insecure endpoint ${db("TLS")}`,
    );
    expect(
      await outcome(() => clients.cacheClient(testScope(), probe, { cache: "links-cache" })),
    ).toBe(`Insecure endpoint ${cache("TLS")}`);
    expect(await outcome(() => clients.httpTarget({ tile: "stats-api" }))).toBe(
      `Insecure endpoint ${tile}`,
    );
    // Refused before any client: no pool, cache client or probe.
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
    // Pub/Sub's emulator is plain text: any PUBSUB_EMULATOR_HOST is refused before a client.
    environment({ JEEVES_PUBSUB_PROJECT: "local" });
    for (const emulator of ["local-pubsub:8085", ""]) {
      environment({ PUBSUB_EMULATOR_HOST: emulator });
      expect(
        await outcome(() => pubsubClients.pubsubPublisher(testScope(), probe, { topic: "visits" })),
      ).toBe("Insecure endpoint PUBSUB_EMULATOR_HOST");
    }
    expect(fake.calls).toEqual([]);
    // Verified TLS, https: and no emulator pass; so does a database's Unix socket directory,
    // which is local transport.
    environment({
      PUBSUB_EMULATOR_HOST: undefined,
      [db("TLS")]: "verify-full",
      [cache("TLS")]: "verify-full",
      [tile]: "https://stats.internal:8443",
    });
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe("built");
    expect(await cacheSocket()).toEqual({ ...tcp, tls: true, rejectUnauthorized: true });
    await clients.externalTarget("JEEVES_TILE_STATS_API_URL").request("/x");
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://stats.internal:8443/x"),
      expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }),
    );
    expect(
      await outcome(() => pubsubClients.pubsubPublisher(testScope(), probe, { topic: "visits" })),
    ).toBe("built");
    environment({ [db("HOST")]: "/cloudsql/p:r:i", [db("TLS")]: "disable" });
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe("built");
    expect(fake.transports).toEqual([{ mode: "verify-full" }, { mode: "disable" }]);
  });

  it("without JEEVES_REQUIRE_TLS refuses nothing: Compose's local values pass as before", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    expect(localEnvironment).toMatchObject({ [db("TLS")]: "disable", [cache("TLS")]: "disable" });
    expect(Object.keys(localEnvironment)).not.toContain("JEEVES_REQUIRE_TLS");
    expect(await outcome(() => clients.databaseClient(testScope(), probe, links))).toBe("built");
    expect(await cacheSocket()).toEqual(tcp);
    await clients.externalTarget("JEEVES_TILE_STATS_API_URL").request("/x");
    expect(fetch).toHaveBeenCalledWith(
      new URL("http://app-stats-api:3000/x"),
      expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }),
    );
    environment({ JEEVES_PUBSUB_PROJECT: "local", PUBSUB_EMULATOR_HOST: "local-pubsub:8085" });
    expect(
      await outcome(() => pubsubClients.pubsubPublisher(testScope(), probe, { topic: "visits" })),
    ).toBe("built");
  });

  it("with JEEVES_REQUIRE_TLS=true refuses NODE_TLS_REJECT_UNAUTHORIZED unless unset or 1, by name, before any client (QG30)", async () => {
    const tile = "JEEVES_TILE_STATS_API_URL";
    const external = "JEEVES_EXTERNAL_PARTNER_URL";
    const identity = "JEEVES_IDENTITY_IDENTITY_URL";
    // Every other value is verified, so only Node's override can be refused.
    const verified = {
      JEEVES_REQUIRE_TLS: "true",
      [db("TLS")]: "verify-full",
      [cache("TLS")]: "verify-full",
      [tile]: "https://stats.internal:8443",
      [external]: "https://api.partner.example",
      [identity]: "https://issuer.example",
      PUBSUB_EMULATOR_HOST: undefined,
      JEEVES_PUBSUB_PROJECT: "local",
    };
    const scope = testScope();
    const builds: [string, () => unknown][] = [
      ["databaseClient", () => clients.databaseClient(scope, probe, links)],
      ["cacheClient", () => clients.cacheClient(scope, probe, { cache: "links-cache" })],
      ["httpTarget", () => clients.httpTarget({ tile: "stats-api" })],
      ["externalTarget", () => clients.externalTarget(external)],
      ["identityTarget", () => clients.identityTarget({ identity: "identity" })],
      ["pubsubPublisher", () => pubsubClients.pubsubPublisher(scope, probe, { topic: "visits" })],
      ["cacheEndpoint", () => valkey.cacheEndpoint("links-cache")],
    ];
    /** What building each client gives with these values. */
    const built = async (values: Record<string, string | undefined>) => {
      const seen: string[][] = [];
      for (const [name, build] of builds) {
        environment(values);
        seen.push([name, await outcome(build)]);
      }
      return seen;
    };
    const each = (result: string) => builds.map(([name]) => [name, result]);
    try {
      // Node turns verification off for exactly 0; every value but 1 is refused, naming the
      // variable, never its value.
      for (const value of ["0", "", "false", "true"]) {
        expect(await built({ ...verified, NODE_TLS_REJECT_UNAUTHORIZED: value }), value).toEqual(
          each("Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED"),
        );
        // Refused before any client: no pool, cache client, Pub/Sub client or probe.
        expect(fake.calls).toEqual([]);
        expect(lines).toEqual([]);
      }
      // An invalid switch still fails naming the switch first.
      expect(
        await built({ ...verified, JEEVES_REQUIRE_TLS: "TRUE", NODE_TLS_REJECT_UNAUTHORIZED: "0" }),
      ).toEqual(each("Invalid endpoint JEEVES_REQUIRE_TLS"));
      expect(fake.calls).toEqual([]);
      // Unset or 1 passes: each is built.
      for (const value of [undefined, "1"])
        expect(
          await built({ ...verified, NODE_TLS_REJECT_UNAUTHORIZED: value }),
          `${value}`,
        ).toEqual(each("built"));
      // Without the switch nothing checks Node's override: 0 builds each, as before.
      expect(
        await built({
          ...verified,
          JEEVES_REQUIRE_TLS: undefined,
          NODE_TLS_REJECT_UNAUTHORIZED: "0",
        }),
      ).toEqual(each("built"));
    } finally {
      for (const drain of scope.owned) await drain();
    }
  });

  it("reads a cache read's transport in cacheEndpoint, and createValkeyCache connects verify-full with TLS", async () => {
    const name = (part: string) => `JEEVES_CACHE_HOT_ROUTES_${part}`;
    const hotRoutes = {
      [name("HOST")]: "10.1.2.3",
      [name("PORT")]: "6378",
      [name("TLS")]: "verify-full",
      [name("CA_FILE")]: caFile,
      [name("TLS_SERVERNAME")]: "cache.example",
    };
    environment(hotRoutes);
    const endpoint = valkey.cacheEndpoint("hot-routes");
    expect(endpoint).toEqual({
      hostname: "10.1.2.3",
      port: 6378,
      tls: { mode: "verify-full", ca: caText, servername: "cache.example" },
    });
    const opened = await valkey.createValkeyCache({
      binding: { ...endpoint, secret: "cache-hot-routes" },
    });
    opened.close();
    expect(fake.calls[0]).toEqual([
      "createClient",
      {
        password: "secret of cache-hot-routes",
        disableOfflineQueue: true,
        commandsQueueMaxLength: 32,
        socket: {
          host: "10.1.2.3",
          port: 6378,
          connectTimeout: 500,
          reconnectStrategy: false,
          tls: true,
          rejectUnauthorized: true,
          ca: caText,
          servername: "cache.example",
        },
      },
    ]);
    const cases: [Record<string, string | undefined>, string][] = [
      [{ [name("TLS")]: undefined }, `Invalid endpoint ${name("TLS")}`],
      [{ [name("TLS")]: "no-verify" }, `Invalid endpoint ${name("TLS")}`],
      [{ [name("TLS_SERVERNAME")]: "cache example" }, `Invalid endpoint ${name("TLS_SERVERNAME")}`],
      [
        { [name("CA_FILE")]: join(directory, "missing.pem") },
        `Unreadable CA file ${name("CA_FILE")} (ENOENT)`,
      ],
      [{ JEEVES_REQUIRE_TLS: "1" }, "Invalid endpoint JEEVES_REQUIRE_TLS"],
      [
        { JEEVES_REQUIRE_TLS: "true", [name("TLS")]: "disable" },
        `Insecure endpoint ${name("TLS")}`,
      ],
    ];
    const seen: string[][] = [];
    for (const [values, message] of cases) {
      environment({ ...hotRoutes, JEEVES_REQUIRE_TLS: undefined });
      environment(values);
      seen.push([await outcome(() => valkey.cacheEndpoint("hot-routes")), message]);
    }
    expect(seen).toEqual(cases.map(([, message]) => [message, message]));
    // Verified TLS passes the switch; without it, disable gives plain TCP as before.
    environment({ ...hotRoutes, JEEVES_REQUIRE_TLS: "true" });
    expect(valkey.cacheEndpoint("hot-routes").tls.mode).toBe("verify-full");
    environment({ JEEVES_REQUIRE_TLS: undefined, [name("TLS")]: "disable" });
    expect(valkey.cacheEndpoint("hot-routes").tls).toEqual({ mode: "disable" });
  });
});

describe("configuration is checked before the first probe (QG31)", () => {
  beforeEach(() => environment(localEnvironment));
  afterEach(() => {
    fake.calls.length = 0;
    lines.length = 0;
    restoreEnvironment();
  });
  /** What the pass throws, or "passed". */
  const thrown = (checks: (() => unknown)[]) => {
    try {
      clients.checkConfiguration(checks);
      return "passed";
    } catch (error) {
      return error;
    }
  };

  it("runs every check; one failure is its own error, several are named together, each once", () => {
    const ran: string[] = [];
    const check = (name: string, error?: Error) => () => {
      ran.push(name);
      if (error) throw error;
    };
    expect(thrown([check("a"), check("b")])).toBe("passed");
    // A lone failure rethrows that error object, so its message is exactly today's.
    const alone = new Error("Invalid endpoint JEEVES_DATABASE_LINKS_DB_HOST");
    expect(thrown([check("c"), check("d", alone), check("e")])).toBe(alone);
    expect(ran).toEqual(["a", "b", "c", "d", "e"]);
    // Three failing readers, two with one message: each message once, in the order given, and
    // never a value.
    const wrong = { tls: `tls-${randomUUID()}`, port: `9${randomUUID()}` };
    environment({
      JEEVES_DATABASE_LINKS_DB_TLS: wrong.tls,
      JEEVES_CACHE_LINKS_CACHE_PORT: wrong.port,
    });
    const several = thrown([
      () => clients.databaseEndpoint("links-db"),
      () => clients.httpTarget({ tile: "stats-api" }),
      () => clients.cacheClientEndpoint("links-cache"),
      () => clients.databaseEndpoint("links-db"),
    ]) as Error;
    expect(several.message).toBe(
      "Invalid configuration: Invalid endpoint JEEVES_DATABASE_LINKS_DB_TLS; Invalid endpoint JEEVES_CACHE_LINKS_CACHE_PORT",
    );
    for (const value of Object.values(wrong)) expect(several.message).not.toContain(value);
    expect(fake.calls).toEqual([]);
  });

  it("names a database's and a cache's wrong settings together, before any client is built", () => {
    environment({
      JEEVES_DATABASE_LINKS_DB_TLS: "require",
      JEEVES_CACHE_LINKS_CACHE_HOST: undefined,
    });
    expect(() =>
      clients.checkConfiguration([
        () => clients.databaseEndpoint("links-db"),
        () => clients.cacheClientEndpoint("links-cache"),
      ]),
    ).toThrow(
      new Error(
        "Invalid configuration: Invalid endpoint JEEVES_DATABASE_LINKS_DB_TLS; Invalid endpoint JEEVES_CACHE_LINKS_CACHE_HOST",
      ),
    );
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
    // Each reader returns what its client is built with, so the pass and the build read alike.
    environment(localEnvironment);
    for (const [read, name] of [
      [() => clients.databaseEndpoint("links-db"), "DATABASE_LINKS_DB"],
      [() => clients.cacheClientEndpoint("links-cache"), "CACHE_LINKS_CACHE"],
    ] as const)
      expect(read()).toEqual({
        hostname: localEnvironment[`JEEVES_${name}_HOST`],
        port: Number(localEnvironment[`JEEVES_${name}_PORT`]),
        tls: { mode: "disable" },
      });
    // Pub/Sub's project, after the emulator refusal, as both Pub/Sub clients read it.
    environment({ JEEVES_PUBSUB_PROJECT: undefined, JEEVES_REQUIRE_TLS: "true" });
    environment({ PUBSUB_EMULATOR_HOST: "local-pubsub:8085" });
    expect(thrown([() => pubsubClients.pubsubProjectId()])).toEqual(
      new Error("Insecure endpoint PUBSUB_EMULATOR_HOST"),
    );
    environment({ JEEVES_REQUIRE_TLS: undefined });
    expect(thrown([() => pubsubClients.pubsubProjectId()])).toEqual(
      new Error("Invalid endpoint JEEVES_PUBSUB_PROJECT"),
    );
    environment({ JEEVES_PUBSUB_PROJECT: "local" });
    expect(pubsubClients.pubsubProjectId()).toBe("local");
    expect(fake.calls).toEqual([]);
  });

  it("names a credential file that can't be read and a wrong _TLS together (QG35)", async () => {
    // `readSecret`, from the emitted `src/runtime/local.ts`, type-stripped: the pass reads each
    // credential as its client will, and discards the value.
    const { readSecret } = await import(
      dataUrl(
        stripTypeScriptTypes(
          new TextDecoder().decode(
            bundle.files.find((file) => file.path === "src/runtime/local.ts")?.bytes,
          ),
        ),
      )
    );
    const variable = "JEEVES_SECRET_SQL_LINKS_DB__LINKS_API_FILE";
    const dir = mkdtempSync(join(tmpdir(), "jeeves-qg35-"));
    const wrong = `tls-${randomUUID()}`;
    const pass = [
      () => clients.databaseEndpoint("links-db"),
      () => readSecret("sql-links-db--links-api"),
    ];
    try {
      environment({
        [variable]: join(dir, "missing", "value"),
        JEEVES_DATABASE_LINKS_DB_TLS: wrong,
      });
      const both = thrown(pass) as Error;
      expect(both.message).toBe(
        `Invalid configuration: Invalid endpoint JEEVES_DATABASE_LINKS_DB_TLS; Unreadable secret file ${variable} (ENOENT)`,
      );
      for (const hidden of [wrong, dir]) expect(both.message).not.toContain(hidden);
      // Alone, the credential's own error, as its client would throw it.
      environment({ JEEVES_DATABASE_LINKS_DB_TLS: "disable" });
      expect(thrown(pass)).toEqual(new Error(`Unreadable secret file ${variable} (ENOENT)`));
      // With the file there, the pass passes.
      const value = randomUUID();
      mkdirSync(join(dir, "mounted"));
      writeFileSync(join(dir, "mounted", "value"), `${value}\n`);
      environment({ [variable]: join(dir, "mounted", "value") });
      expect(thrown(pass)).toBe("passed");
      expect(readSecret("sql-links-db--links-api")).toBe(value);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(fake.calls).toEqual([]);
    expect(lines).toEqual([]);
  });
});

describe("emitted postgres.ts: a query settles while PostgreSQL stalls", () => {
  const source = new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/runtime/postgres.ts")?.bytes,
  );
  const pools: Record<string, unknown>[] = [];
  (globalThis as { postgresPoolsFake?: unknown[] }).postgresPoolsFake = pools;
  const pgFake = `export default { Pool: class { constructor(options) { globalThis.postgresPoolsFake.push(options); } on() {return this;} } };`;
  const loaded = import(
    dataUrl(
      stripTypeScriptTypes(source).replace(/from "([^"]+)"/g, (match, from: string) =>
        from === "pg"
          ? `from "${dataUrl(pgFake)}"`
          : from === "./local.ts"
            ? `from "${dataUrl(String(fakes["./local.ts"]))}"`
            : match,
      ),
    )
  );
  afterEach(() => {
    pools.length = 0;
  });

  it("passes the client a query timeout 500 ms past the statement timeout", () => {
    expect(source).toContain("statement_timeout: options.statementTimeoutMs,");
    expect(source).toContain("query_timeout: options.statementTimeoutMs + 500,");
  });

  it("gives pg.Pool a 2500 ms query timeout for a 2000 ms statement timeout, and changes nothing else", async () => {
    const { createPostgres } = await loaded;
    createPostgres({
      hostname: "local-postgres",
      port: 5432,
      tls: { mode: "disable" },
      login: { database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db" },
      poolSize: 10,
      statementTimeoutMs: 2000,
      connectionTimeoutMs: 2000,
    });
    expect(pools).toEqual([
      {
        host: "local-postgres",
        port: 5432,
        // QG10: Compose's transport, which PGSSLMODE can't change.
        ssl: false,
        database: "d_links_db",
        user: "r_links_db__links_api",
        password: "secret of sql-links-db",
        max: 10,
        statement_timeout: 2000,
        query_timeout: 2500,
        connectionTimeoutMillis: 2000,
      },
    ]);
  });
});

// QG10: the exact emitted postgres.ts on the pg the Jeeves server pins, which is the version the
// export pins: what `ssl` each transport gives the pool, and what pg then does with it. Nothing
// connects.
describe("emitted postgres.ts: a database's transport (QG10)", () => {
  const serverRequire = createRequire(
    new URL("../../../jeeves/apps/server/package.json", import.meta.url),
  );
  const pgEntry = serverRequire.resolve("pg");
  const pools: Record<string, unknown>[] = [];
  (globalThis as { qg10PoolsFake?: unknown[] }).qg10PoolsFake = pools;
  const realPg = `import pg from ${JSON.stringify(pathToFileURL(pgEntry).href)};
    export default { Pool: class extends pg.Pool { constructor(options) { super(options); globalThis.qg10PoolsFake.push(this); } } };`;
  const source = new TextDecoder().decode(
    bundle.files.find((file) => file.path === "src/runtime/postgres.ts")?.bytes,
  );
  const loaded = import(
    dataUrl(
      stripTypeScriptTypes(source).replace(/from "([^"]+)"/g, (match, from: string) =>
        from === "pg"
          ? `from "${dataUrl(realPg)}"`
          : from === "./local.ts"
            ? `from "${dataUrl(String(fakes["./local.ts"]))}"`
            : match,
      ),
    )
  );
  const options = (tls: unknown) => ({
    hostname: "db.internal",
    port: 5432,
    tls,
    login: { database: "d_links_db", user: "r_links_db__links_api", secret: "sql-links-db" },
    poolSize: 10,
    statementTimeoutMs: 2000,
    connectionTimeoutMs: 2000,
  });
  let mode: string | undefined;
  beforeEach(() => {
    mode = process.env.PGSSLMODE;
  });
  afterEach(async () => {
    if (mode === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = mode;
    for (const pool of pools.splice(0)) await (pool as { end(): Promise<void> }).end();
  });
  /** The `ssl` a pool's clients connect with, as pg works it out from the pool's options. */
  const clientSsl = (pool: Record<string, unknown>) => {
    const pg = serverRequire("pg");
    return new pg.Client((pool as { options: unknown }).options).connectionParameters.ssl;
  };

  it("uses the pg version the export pins", () => {
    const manifest = JSON.parse(
      readFileSync(join(pgEntry.slice(0, pgEntry.lastIndexOf("/lib/")), "package.json"), "utf8"),
    ) as { version: string };
    const pins = JSON.parse(
      readFileSync(
        new URL("../../templates/local-v2/assets/package.json", import.meta.url),
        "utf8",
      ),
    ) as { dependencies: Record<string, string> };
    expect(manifest.version).toBe(pins.dependencies.pg);
  });

  it("gives disable ssl: false, so PGSSLMODE can't turn TLS on or off", async () => {
    const { createPostgres } = await loaded;
    process.env.PGSSLMODE = "verify-full";
    const pool = createPostgres(options({ mode: "disable" }));
    expect(pool.options.ssl).toBe(false);
    expect(clientSsl(pool)).toBe(false);
    // Without an ssl option (before QG10), pg followed the environment.
    const pg = serverRequire("pg");
    const { ssl: _, ...unset } = pool.options;
    expect(new pg.Client(unset).connectionParameters.ssl).toBe(true);
  });

  it("gives verify-full verified TLS whatever PGSSLMODE says, with its CA and its certificate's name", async () => {
    const { createPostgres } = await loaded;
    for (const environment of ["disable", "no-verify", undefined]) {
      if (environment === undefined) delete process.env.PGSSLMODE;
      else process.env.PGSSLMODE = environment;
      const pool = createPostgres(options({ mode: "verify-full" }));
      expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });
      expect(clientSsl(pool)).toEqual({ rejectUnauthorized: true });
    }
    const ca = `test CA ${randomUUID()}`;
    expect(createPostgres(options({ mode: "verify-full", ca })).options.ssl).toEqual({
      rejectUnauthorized: true,
      ca,
    });
    const named = createPostgres(
      options({ mode: "verify-full", ca, servername: "links-db.example" }),
    ).options.ssl;
    expect(named).toEqual({
      rejectUnauthorized: true,
      ca,
      servername: "links-db.example",
      checkServerIdentity: expect.any(Function),
    });
    // pg puts a host name in place of `servername`, so the given name is checked here instead:
    // a certificate for that name passes whatever the host, and one for the host does not.
    const certificate = (name: string, altNames?: string) =>
      ({ subject: { CN: name }, ...(altNames && { subjectaltname: altNames }) }) as PeerCertificate;
    expect(named.checkServerIdentity("db.internal", certificate("links-db.example"))).toBe(
      undefined,
    );
    expect(named.checkServerIdentity("10.1.2.3", certificate("links-db.example"))).toBe(undefined);
    expect(named.checkServerIdentity("db.internal", certificate("db.internal"))).toBeInstanceOf(
      Error,
    );
    const dns = createPostgres(options({ mode: "verify-full", servername: "db.example" })).options
      .ssl;
    expect(dns.checkServerIdentity("10.1.2.3", certificate("x", "DNS:db.example"))).toBe(
      checkServerIdentity("db.example", certificate("x", "DNS:db.example")),
    );
    expect(
      dns.checkServerIdentity("db.example", certificate("x", "DNS:other.example")),
    ).toBeInstanceOf(Error);
  });

  it("has no option that turns verification off", async () => {
    const { createPostgres } = await loaded;
    expect(source).not.toMatch(/rejectUnauthorized:\s*false/);
    // Anything but verify-full is plain text, never unverified TLS.
    for (const mode of ["disable", "no-verify", "require", "prefer"])
      expect(createPostgres(options({ mode })).options.ssl).toBe(false);
  });
});

const operationRuntime = await import((await import("./operation.test.helpers.ts")).operationUrl);
const processRuntime = await import(dataUrl(String(fakes["./process.ts"])));

describe("RG03 emitted dependency contexts and uncertain effects", () => {
  const previousExit = process.exitCode;
  beforeEach(() => {
    environment({
      ...localEnvironment,
      JEEVES_PUBSUB_PROJECT: "rg03-test",
      JEEVES_EXTERNAL_PARTNER_URL: "https://partner.example/v1/",
    });
    fake.calls.length = 0;
    fake.connections.length = 0;
    fake.answer = undefined;
    fake.pubsub = undefined;
  });
  afterEach(() => {
    restoreEnvironment();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fake.answer = undefined;
    fake.pubsub = undefined;
    process.exitCode = previousExit;
  });

  it("refuses a fresh database/cache/publish/module operation after the one-second context expires", async () => {
    vi.useFakeTimers();
    const scope = testScope();
    const db = await clients.databaseClient(scope, probe, {
      tile: "links-api",
      resource: "links-db",
    });
    const cache = await clients.cacheClient(scope, probe, { cache: "links-cache" });
    const publisher = await clients.queuePublisher(scope, probe, {
      queue: "visits",
      mode: "topic",
    });
    const request = operationRuntime.operation({ maximumMs: 1000, remainingMs: 2000 });
    await operationRuntime.withOperation(request.context, async () => {
      await db.query("SELECT 1");
      await vi.advanceTimersByTimeAsync(1000);
      const before = fake.calls.length;
      await expect(db.execute("UPDATE product SET value = 1")).rejects.toMatchObject({
        outcome: "refused",
        code: "CONTEXT_EXPIRED",
      });
      await expect(cache.set("key", "value")).rejects.toMatchObject({ outcome: "refused" });
      await expect(publisher.publish(Buffer.from("late"))).rejects.toMatchObject({
        outcome: "refused",
      });
      const entry = vi.fn(async () => 1);
      await expect(operationRuntime.moduleCall(entry)).rejects.toMatchObject({
        outcome: "refused",
      });
      expect(entry).not.toHaveBeenCalled();
      expect(fake.calls).toHaveLength(before);
    });
    request.close();
    await expect(cache.get("healthy")).resolves.toBe("value");
    expect(fake.calls.filter(([name]) => name === "createClient")).toHaveLength(1);
    expect(fake.calls.filter(([name]) => name === "destroy")).toHaveLength(0);
    for (const close of scope.owned.reverse()) await close();
  });

  it("RG14 required Pub/Sub publishers recover through bounded metadata reads without publishing business messages", async () => {
    vi.useFakeTimers();
    const app = processRuntime.createProcessLifecycle({ mark() {}, terminate() {} });
    await app.start(async (scope: unknown) => {
      await pubsubClients.pubsubPublisher(scope, probe, { topic: "visits" });
    });
    fake.fail = "topic metadata";
    await vi.advanceTimersByTimeAsync(5000);
    expect(app.scope.dependenciesReady()).toBe(false);
    fake.fail = undefined;
    await vi.advanceTimersByTimeAsync(5000);
    expect(app.scope.dependenciesReady()).toBe(true);
    expect(fake.calls.filter(([name]) => name === "topic metadata")).toHaveLength(2);
    expect(fake.calls.filter(([name]) => name === "publishMessage")).toHaveLength(0);
    await app.close();
  });

  it("keeps a late Pub/Sub publish tracked through process drain, preserving stable identity and attributes", async () => {
    vi.useFakeTimers();
    let settle!: (id: string) => void;
    fake.pubsub = {
      publish: () =>
        new Promise<string>((resolve) => {
          settle = resolve;
        }),
    };
    const lifecycle = processRuntime.createProcessLifecycle({ mark() {}, terminate: vi.fn() });
    let publisher: { publish: (...args: unknown[]) => Promise<void> };
    await lifecycle.start(async (scope: unknown) => {
      publisher = await pubsubClients.pubsubPublisher(scope, probe, { topic: "visits" });
    });
    const request = operationRuntime.operation({ maximumMs: 10, correlationId: "correlation-1" });
    const sent = operationRuntime
      .withProcess(lifecycle.scope, () =>
        operationRuntime.withOperation(request.context, () =>
          publisher.publish(Buffer.from("event"), {
            messageId: "event-1",
            attributes: { purpose: "receipt" },
          }),
        ),
      )
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(await sent).toMatchObject({ outcome: "unknown" });
    expect(fake.calls.filter(([name]) => name === "publishMessage")).toEqual([
      [
        "publishMessage",
        "event",
        { purpose: "receipt", correlationId: "correlation-1", messageId: "event-1" },
      ],
    ]);
    let drained = false;
    const closing = lifecycle.close().then(() => {
      drained = true;
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(drained).toBe(false);
    expect(fake.calls.filter(([name]) => name === "close")).toHaveLength(0);
    settle("acknowledged-late");
    await closing;
    expect(drained).toBe(true);
    expect(fake.calls.filter(([name]) => name === "publishMessage")).toHaveLength(1);
    expect(fake.calls.filter(([name]) => name === "close")).toHaveLength(1);
    request.close();
  });

  it("refuses malformed/oversized/reserved publisher attributes before either transport sends", async () => {
    const scope = testScope();
    const rabbit = await clients.queuePublisher(scope, probe, { queue: "visits", mode: "topic" });
    const google = await pubsubClients.pubsubPublisher(scope, probe, { topic: "visits" });
    for (const publisher of [rabbit, google]) {
      for (const options of [
        { messageId: "invalid identity" },
        { attributes: { messageId: "spoof" } },
        { attributes: { key: "x".repeat(1025) } },
        { attributes: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`a${i}`, "v"])) },
        {
          attributes: Object.fromEntries(
            Array.from({ length: 9 }, (_, i) => [`a${i}`, "x".repeat(1024)]),
          ),
        },
      ])
        expect(() => publisher.publish(Buffer.from("bad"), options)).toThrow(
          expect.objectContaining({ outcome: "refused" }),
        );
    }
    expect(
      fake.calls.filter(([name]) => name === "publish" || name === "publishMessage"),
    ).toHaveLength(0);
    for (const close of scope.owned.reverse()) await close();
  });

  it("preserves native lost-COMMIT uncertainty despite a successful rollback response, with no retry", async () => {
    const scope = testScope();
    const db = await clients.databaseClient(scope, probe, {
      tile: "links-api",
      resource: "links-db",
    });
    const failure = Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
    fake.answer = (sql) => {
      if (sql === "COMMIT") throw failure;
    };
    const product = vi.fn(async (tx) => {
      await tx.execute("INSERT INTO product VALUES (1)");
      return "must not return";
    });
    await expect(db.transaction(product)).rejects.toMatchObject({
      name: "TransactionOutcomeUnknown",
      outcome: "unknown",
      cause: failure,
    });
    expect(product).toHaveBeenCalledOnce();
    expect(fake.connections).toEqual([
      ["BEGIN", "INSERT INTO product VALUES (1)", "COMMIT", "ROLLBACK", "release discard"],
    ]);
    for (const close of scope.owned.reverse()) await close();
  });

  it("does not release a transaction's connection while its timed-out COMMIT is unsettled", async () => {
    vi.useFakeTimers();
    const lifecycle = processRuntime.createProcessLifecycle({ mark() {}, terminate: vi.fn() });
    let db: {
      transaction: (
        fn: (tx: { execute(sql: string): Promise<void> }) => Promise<string>,
      ) => Promise<string>;
    };
    await lifecycle.start(async (scope: unknown) => {
      db = await clients.databaseClient(scope, probe, { tile: "links-api", resource: "links-db" });
    });
    let finish!: () => void;
    fake.answer = (sql) =>
      sql === "COMMIT"
        ? new Promise<void>((resolve) => {
            finish = resolve;
          })
        : undefined;
    const request = operationRuntime.operation({ maximumMs: 20 });
    const product = vi.fn(async (tx) => {
      await tx.execute("INSERT INTO product VALUES (1)");
      return "done";
    });
    const pending = operationRuntime
      .withProcess(lifecycle.scope, () =>
        operationRuntime.withOperation(request.context, () => db.transaction(product)),
      )
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toMatchObject({ outcome: "unknown" });
    expect(fake.connections).toEqual([["BEGIN", "INSERT INTO product VALUES (1)", "COMMIT"]]);
    let drained = false;
    const close = lifecycle.close().then(() => {
      drained = true;
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(drained).toBe(false);
    finish();
    await close;
    expect(product).toHaveBeenCalledOnce();
    expect(fake.connections).toEqual([
      ["BEGIN", "INSERT INTO product VALUES (1)", "COMMIT", "release"],
    ]);
    request.close();
  });

  it("bounds declared-target responses, blocks destination/header overrides and never follows redirects or retries a mutation", async () => {
    const target = clients.externalTarget("JEEVES_EXTERNAL_PARTNER_URL");
    const fetch = vi.fn(
      async (_url: unknown, _init?: RequestInit) => new Response("x".repeat(65537)),
    );
    vi.stubGlobal("fetch", fetch);
    for (const path of [
      "https://elsewhere.example",
      "//elsewhere.example",
      "https://user:pass@partner.example/v1/x",
    ])
      await expect(target.request(path)).rejects.toMatchObject({
        outcome: "refused",
        code: "UNDECLARED_DESTINATION",
      });
    await expect(
      target.request("x", { headers: { authorization: "spoof" } }),
    ).rejects.toMatchObject({ outcome: "refused", code: "PROTECTED_HEADER" });
    expect(fetch).not.toHaveBeenCalled();
    await expect(target.request("x", { method: "POST" })).rejects.toMatchObject({
      outcome: "unknown",
      code: "RESPONSE_TOO_LARGE",
    });
    expect(fetch).toHaveBeenCalledOnce();
    fetch.mockImplementation(
      async () =>
        new Response(null, { status: 302, headers: { Location: "https://elsewhere.example" } }),
    );
    const response = await target.request("x", { method: "POST", redirect: "follow" });
    expect(response.status).toBe(302);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ redirect: "manual", credentials: "omit" });
  });
});

it("RG03 rechecks the context after a template pool's delayed connection acquisition before sending SQL", async () => {
  vi.useFakeTimers();
  const state = {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    release: vi.fn(),
    acquire: undefined as unknown as () => Promise<unknown>,
  };
  (globalThis as { rg03Pool?: unknown }).rg03Pool = state;
  const fakePg = dataUrl(
    "export default { Pool: class { on() {return this;} connect() { return globalThis.rg03Pool.acquire(); } } };",
  );
  const source = stripTypeScriptTypes(
    new TextDecoder().decode(
      bundle.files.find((file) => file.path === "src/runtime/postgres.ts")?.bytes,
    ),
  )
    .replace('from "pg"', `from "${fakePg}"`)
    .replace('from "./local.ts"', `from "${dataUrl('export const readSecret = () => "unused";')}"`);
  const { createPostgres } = await import(dataUrl(source));
  let acquired!: (value: unknown) => void;
  state.acquire = () =>
    new Promise((resolve) => {
      acquired = resolve;
    });
  const pool = createPostgres({
    hostname: "localhost",
    port: 5432,
    tls: { mode: "disable" },
    login: { database: "db", user: "writer", secret: "unused" },
    poolSize: 1,
    statementTimeoutMs: 2000,
    connectionTimeoutMs: 2000,
  });
  const request = operationRuntime.operation({ maximumMs: 10 });
  try {
    const pending = operationRuntime
      .withOperation(request.context, () => pool.query("INSERT INTO product VALUES (1)"))
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toMatchObject({ outcome: "unknown" });
    acquired({ query: state.query, release: state.release });
    await vi.advanceTimersByTimeAsync(0);
    expect(state.query).not.toHaveBeenCalled();
    expect(state.release).toHaveBeenCalledWith(false);
    state.acquire = async () => ({ query: state.query, release: state.release });
    state.query.mockRejectedValueOnce(Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
    const next = operationRuntime.operation({ maximumMs: 1000 });
    try {
      await expect(
        operationRuntime.withOperation(next.context, () =>
          pool.query("UPDATE product SET value = 2"),
        ),
      ).rejects.toMatchObject({ outcome: "unknown" });
      expect(state.release).toHaveBeenLastCalledWith(true);
    } finally {
      next.close();
    }
  } finally {
    request.close();
    vi.useRealTimers();
    delete (globalThis as { rg03Pool?: unknown }).rg03Pool;
  }
});

it("RG03 bounds mounted identity verification without cancelling another caller's shared JWKS work", async () => {
  vi.useFakeTimers();
  const state = {
    calls: 0,
    keySets: [] as unknown[],
    pending: undefined as unknown as Promise<{ payload: { sub: string } }>,
  };
  (globalThis as { rg03Identity?: unknown }).rg03Identity = state;
  const jose = dataUrl(
    "export function createRemoteJWKSet(_url, options) { globalThis.rg03Identity.keySets.push(options); return {}; } export function jwtVerify() { globalThis.rg03Identity.calls++; return globalThis.rg03Identity.pending; }",
  );
  const source = stripTypeScriptTypes(
    readFileSync(
      new URL("../../templates/local-v2/assets/src/runtime/identity.ts.template", import.meta.url),
      "utf8",
    ),
  ).replace('from "jose"', `from "${jose}"`);
  const { createPrincipalVerifier } = await import(dataUrl(source));
  let finish!: (value: { payload: { sub: string } }) => void;
  state.pending = new Promise((resolve) => {
    finish = resolve;
  });
  const lifecycle = processRuntime.createProcessLifecycle({ mark() {}, terminate: vi.fn() });
  const verify = operationRuntime.withProcess(lifecycle.scope, () =>
    createPrincipalVerifier({
      issuer: "https://issuer.example",
      audience: "api",
      jwksUrl: "https://issuer.example/jwks",
      algorithms: ["RS256"],
      jwksTimeoutMs: 2000,
    }),
  );
  const short = operationRuntime.operation({ maximumMs: 10 }),
    long = operationRuntime.operation({ maximumMs: 1000 });
  try {
    const early = operationRuntime
      .withOperation(short.context, () => verify("token"))
      .catch((error: unknown) => error);
    const later = operationRuntime.withOperation(long.context, () => verify("token"));
    await vi.advanceTimersByTimeAsync(10);
    expect(await early).toMatchObject({ outcome: "definite-failure", code: "INTERRUPTED" });
    expect(long.context.signal.aborted).toBe(false);
    expect(state.keySets).toEqual([{ timeoutDuration: 2000 }]);
    await expect(async () =>
      operationRuntime.withOperation(short.context, () => verify("token")),
    ).rejects.toMatchObject({ outcome: "refused" });
    expect(state.calls).toBe(2);
    finish({ payload: { sub: "account" } });
    await expect(later).resolves.toEqual({ subject: "account", claims: { sub: "account" } });
    await lifecycle.close();
  } finally {
    short.close();
    long.close();
    vi.useRealTimers();
    delete (globalThis as { rg03Identity?: unknown }).rg03Identity;
  }
});

describe("RG10 captured capability isolation and independent cleanup", () => {
  beforeEach(() =>
    environment({
      ...localEnvironment,
      JEEVES_PUBSUB_PROJECT: "local",
      JEEVES_EXTERNAL_TEST_URL: "https://example.test",
    }),
  );
  afterEach(() => {
    restoreEnvironment();
    vi.useRealTimers();
    fake.calls.length = 0;
    fake.connections.length = 0;
    fake.answer = undefined;
    fake.pubsub = undefined;
  });
  it("refuses every captured public network adapter through nested reads before driver dispatch", async () => {
    const { withLocalMutation, withEffect } = await import(
      (await import("./operation.test.helpers.ts")).operationUrl
    );
    const scope = testScope();
    const queue = await clients.queuePublisher(scope, probe, {
      queue: "visits",
      mode: "work-queue",
    });
    const pubsub = await pubsubClients.pubsubPublisher(scope, probe, { topic: "visits" });
    const cache = await clients.cacheClient(scope, probe, { cache: "links-cache" });
    const objects = await clients.objectClient(scope, probe, {
      tile: "upload-api",
      bucket: "archive",
      access: "read-write",
    });
    const search = await clients.searchClient(scope, probe, { index: "stats-index" });
    const http = clients.externalTarget("JEEVES_EXTERNAL_TEST_URL");
    const before = fake.calls.length;
    try {
      for (const call of [
        () => queue.publish(new Uint8Array()),
        () => pubsub.publish(new Uint8Array()),
        () => cache.get("key"),
        () => cache.set("key", "value"),
        () => cache.delete("key"),
        () => objects.get("key"),
        () => objects.put("key", new Uint8Array()),
        () => search.search({}),
        () => search.index("key", {}),
        () => search.remove("key"),
        () => http.request("/"),
      ])
        await expect(async () =>
          withLocalMutation(() => withEffect("read", call)),
        ).rejects.toMatchObject({ outcome: "refused", code: "EFFECT_NOT_ALLOWED" });
      // RG21's retryable GET contract uses pure read authority, independently of a local tx.
      for (const call of [
        () => queue.publish(new Uint8Array()),
        () => pubsub.publish(new Uint8Array()),
        () => cache.set("key", "value"),
        () => cache.delete("key"),
        () => objects.put("key", new Uint8Array()),
        () => search.index("key", {}),
        () => search.remove("key"),
        () => http.request("/", { method: "POST", body: "{}" }),
      ])
        await expect(async () => withEffect("read", call)).rejects.toMatchObject({
          outcome: "refused",
          code: "EFFECT_NOT_ALLOWED",
        });
      expect(fake.calls).toHaveLength(before);
    } finally {
      for (const close of scope.owned.reverse()) await close();
    }
  });
  it("starts bounded expiry cleanup at configured startup without any operation call and stops on drain", async () => {
    vi.useFakeTimers();
    const localRuntime = await import(dataUrl(String(fakes["./local-operation.ts"])));
    const local = localRuntime.defineLocalOperation({
      database: "db",
      id: "create",
      version: 1,
      retentionSeconds: 60,
      secret: false,
      validate: (input: unknown) => input,
      admit: async () => {},
      mutate: async () => ({ status: 201, body: null }),
    });
    const scope = testScope();
    fake.answer = (sql: string) =>
      sql.startsWith("SELECT pg_try_advisory_lock") ? { rows: [{ locked: true }] } : undefined;
    const prepared = {
      configuration: {
        ...clients.databaseEndpoint("links-db"),
        login: { user: "product", secret: "product", database: "db" },
        poolSize: 10,
        statementTimeoutMs: 2000,
        connectionTimeoutMs: 2000,
      },
      operations: () => Object.freeze({ call: async () => ({ rows: [], rowCount: 0 }) }),
      binding: { tile: "links-api", resource: "links-db", module: "create" },
      local: localRuntime.localOperationDefinition(local, "db", true),
      runtimeLogin: {
        resource: "links-db",
        host: "links-api",
        database: "db",
        user: "runtime",
        secret: "runtime",
      },
    };
    await clients.productDatabaseClient(scope, probe, prepared);
    const sweeps = () =>
      fake.connections
        .flat()
        .filter((sql) => sql.startsWith("DELETE FROM jeeves.idempotency_records WHERE (tile"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sweeps()).toHaveLength(1);
    expect(sweeps()[0]).toContain("status BETWEEN 200 AND 299");
    expect(sweeps()[0]).toContain("FOR UPDATE SKIP LOCKED");
    await vi.advanceTimersByTimeAsync(60000);
    expect(sweeps()).toHaveLength(2);
    for (const close of scope.owned.reverse()) await close();
    await vi.advanceTimersByTimeAsync(60000);
    expect(sweeps()).toHaveLength(2);
  });
});
