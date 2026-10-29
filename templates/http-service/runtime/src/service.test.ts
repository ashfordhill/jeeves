import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ServiceConfigError, serviceConfigFromEnv } from "./config.ts";
import { defineFeature, loadFeatures } from "./feature.ts";
import {
  createService,
  type Dependency,
  defineService,
  type ReadyResult,
  runService,
  type Service,
} from "./service.ts";

const FIXTURES = new URL("../test-fixtures/", import.meta.url);

function fakeDependency(name: string, overrides: Partial<Dependency> = {}) {
  const calls: string[] = [];
  let state: ReadyResult = { ok: true };
  const dependency: Dependency = {
    name,
    async start() {
      calls.push("start");
    },
    async ready() {
      return state;
    },
    async close() {
      calls.push("close");
    },
    ...overrides,
  };
  return {
    dependency,
    calls,
    set: (next: ReadyResult) => {
      state = next;
    },
  };
}

const services: Service[] = [];
async function build(...args: Parameters<typeof createService>) {
  const service = await createService(args[0], { logger: false, env: {}, ...args[1] });
  services.push(service);
  return service;
}
afterEach(async () => {
  await Promise.all(services.splice(0).map((s) => s.stop()));
});

describe("serviceConfigFromEnv", () => {
  it("uses the design's defaults when variables aren't set", () => {
    expect(serviceConfigFromEnv({}, { port: 9000, logLevel: "warn" })).toEqual({
      ok: true,
      value: {
        port: 9000,
        host: "0.0.0.0",
        logLevel: "warn",
        shutdownTimeoutMs: 10_000,
        readyTimeoutMs: 2_000,
      },
    });
  });

  it("reports every bad variable readably", () => {
    expect(serviceConfigFromEnv({ PORT: "eighty", LOG_LEVEL: "loud" })).toEqual({
      ok: false,
      problems: [
        'PORT: must be a whole number from 1 to 65535 (got "eighty")',
        'LOG_LEVEL: must be one of fatal, error, warn, info, debug, trace, silent (got "loud")',
      ],
    });
  });
});

describe("createService", () => {
  it("answers /health, and /ready with each dependency's state", async () => {
    const db = fakeDependency("main-db");
    const service = await build(defineService({ name: "links", dependencies: [db.dependency] }));
    expect((await service.app.inject("/health")).json()).toEqual({ status: "ok" });

    const ready = await service.app.inject("/ready");
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready", dependencies: { "main-db": { ok: true } } });

    db.set({ ok: false, error: "connection refused" });
    const notReady = await service.app.inject("/ready");
    expect(notReady.statusCode).toBe(503);
    expect(notReady.json()).toEqual({
      status: "not-ready",
      dependencies: { "main-db": { ok: false, error: "connection refused" } },
    });
  });

  it("treats a dependency that doesn't answer in time as not ready", async () => {
    const slow = fakeDependency("slow", { ready: () => new Promise(() => {}) });
    const service = await build(defineService({ name: "s", dependencies: [slow.dependency] }), {
      env: { READY_TIMEOUT_MS: "50" },
    });
    const response = await service.app.inject("/ready");
    expect(response.statusCode).toBe(503);
    expect(response.json().dependencies.slow.error).toBe("no answer within 50 ms");
  });

  it("validates the service's, dependencies', and features' environment together", async () => {
    const db = fakeDependency("main-db", {
      configure: (env) => (env.DATABASE_URL ? [] : ["DATABASE_URL is required"]),
    });
    const features = await loadFeatures(new URL("features/", FIXTURES));
    const error = await createService(
      defineService({ name: "links", dependencies: [db.dependency] }),
      { logger: false, features, env: { PORT: "0", BETA_LIMIT: "many" } },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceConfigError);
    expect((error as Error).message).toBe(
      [
        'Service "links" can\'t start: invalid environment',
        '  - PORT: must be a whole number from 1 to 65535 (got "0")',
        "  - DATABASE_URL is required",
        '  - BETA_LIMIT: Invalid input: expected number, received NaN (feature "beta")',
      ].join("\n"),
    );
    expect(db.calls).toEqual([]);
  });

  it("starts dependencies before features and closes them in reverse after", async () => {
    const order: string[] = [];
    const dep = (name: string) =>
      fakeDependency(name, {
        start: async () => void order.push(`start ${name}`),
        close: async () => void order.push(`close ${name}`),
      }).dependency;
    const feature = defineFeature({
      name: "worker",
      start: () => void order.push("start feature"),
      stop: () => void order.push("stop feature"),
    });
    const service = await build(defineService({ name: "s", dependencies: [dep("a"), dep("b")] }), {
      features: [feature],
    });
    await service.stop();
    expect(order).toEqual([
      "start a",
      "start b",
      "start feature",
      "stop feature",
      "close b",
      "close a",
    ]);
  });

  it("names the dependency that failed to start and closes the ones already started", async () => {
    const first = fakeDependency("cache");
    const broken = fakeDependency("main-db", {
      start: () => Promise.reject(new Error("ECONNREFUSED 10.0.0.2:5432")),
    });
    const error = await createService(
      defineService({ name: "s", dependencies: [first.dependency, broken.dependency] }),
      { logger: false, env: {} },
    ).catch((e: unknown) => e);
    expect((error as Error).message).toBe(
      'Dependency "main-db" failed to start: ECONNREFUSED 10.0.0.2:5432',
    );
    expect(first.calls).toEqual(["start", "close"]);
  });

  it("refuses operations nothing serves, and operations two features both handle", async () => {
    const handler = () => ({ status: 200 });
    const a = defineFeature({ name: "a", operations: { ping: handler } });
    const b = defineFeature({ name: "b", operations: { ping: handler } });
    await expect(build(defineService({ name: "s" }), { features: [a] })).rejects.toThrow(
      'Feature "a" declares operations, but service "s" has no API to serve them',
    );
    const plugin = { name: "api", servesOperations: true, register: () => {} };
    await expect(
      build(defineService({ name: "s", plugins: [plugin] }), { features: [a, b] }),
    ).rejects.toThrow('Operation "ping" is handled by both "a" and "b"');
  });

  it("gives plugins the operations features declare", async () => {
    const seen: string[] = [];
    const plugin = {
      name: "api",
      servesOperations: true,
      register: (_app: unknown, ctx: { operations: ReadonlyMap<string, unknown> }) => {
        seen.push(...ctx.operations.keys());
      },
    };
    const feature = defineFeature({ name: "a", operations: { ping: () => ({ status: 200 }) } });
    await build(defineService({ name: "s", plugins: [plugin] }), { features: [feature] });
    expect(seen).toEqual(["ping"]);
  });

  it("finishes in-flight requests during a graceful shutdown", async () => {
    const db = fakeDependency("main-db");
    const slow = defineFeature({
      name: "slow",
      register(app) {
        app.get("/slow", async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { done: true };
        });
      },
    });
    const service = await runService(defineService({ name: "s", dependencies: [db.dependency] }), {
      logger: false,
      features: [slow],
      env: { PORT: String(await freePort()), HOST: "127.0.0.1" },
    });
    const pending = fetch(`${service.address}/slow`).then((r) => r.json());
    await new Promise((resolve) => setTimeout(resolve, 50));
    await service.stop();
    expect(await pending).toEqual({ done: true });
    expect(db.calls).toEqual(["start", "close"]);
    await expect(fetch(`${service.address}/health`)).rejects.toThrow();
  });
});

describe("loadFeatures", () => {
  it("imports each feature folder in name order, skipping _shared", async () => {
    const features = await loadFeatures(new URL("features/", FIXTURES));
    expect(features.map((f) => f.name)).toEqual(["alpha", "beta"]);
    const service = await build(defineService({ name: "s" }), { features });
    expect((await service.app.inject("/alpha")).json()).toEqual({ message: "hello from alpha" });
    expect((await service.app.inject("/beta")).json()).toEqual({ limit: 3 });
  });

  it("says which folder doesn't export a feature", async () => {
    await expect(loadFeatures(new URL("bad-features/", FIXTURES))).rejects.toThrow(
      "src/features/broken/index.ts must default-export defineFeature({ ... })",
    );
  });

  it("treats a missing folder as no features", async () => {
    expect(await loadFeatures(new URL("nowhere/", FIXTURES))).toEqual([]);
  });
});

describe("startService (as a process)", () => {
  const main = fileURLToPath(new URL("main.ts", FIXTURES));
  const spawnMain = (env: Record<string, string>) =>
    spawn(process.execPath, [main], {
      env: { PATH: process.env.PATH ?? "", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
  const collect = (child: ReturnType<typeof spawnMain>) => {
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    return () => output;
  };

  it("exits 1 with a readable message, and no stack trace, on a bad environment", async () => {
    const child = spawnMain({ PORT: "eighty", BETA_LIMIT: "x" });
    const output = collect(child);
    const [code] = await once(child, "exit");
    expect(code).toBe(1);
    expect(output()).toContain('Service "fixture" can\'t start: invalid environment');
    expect(output()).toContain('PORT: must be a whole number from 1 to 65535 (got "eighty")');
    expect(output()).not.toMatch(/\n\s+at /);
  });

  it("shuts down cleanly with exit code 0 on SIGTERM", async () => {
    const child = spawnMain({ PORT: String(await freePort()), HOST: "127.0.0.1" });
    const output = collect(child);
    await until(() => output().includes("listening on"));
    const started = Date.now();
    child.kill("SIGTERM");
    const [code] = await once(child, "exit");
    expect(code).toBe(0);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(output()).toContain("SIGTERM received, shutting down");
  });
});

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  if (address === null || typeof address === "string") throw new Error("no port");
  return address.port;
}

async function until(condition: () => boolean, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
