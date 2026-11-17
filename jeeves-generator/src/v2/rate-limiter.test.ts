import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import {
  applyOperations,
  buildStudioCommand,
  buildSupportedAuthoringCommand,
  designSchema,
  moduleConnectOptions,
  normalSettingFields,
  planModules,
  resolveGeneration,
} from "@jeeves/spec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimiterDesign } from "../../../field-projects/generator-system/fixtures/rg-rate-limiter/design.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import {
  databases,
  fixture,
  load,
  operation,
  withEffect,
  withOperation,
} from "./local-operation.test.helpers.ts";
import { operationImports } from "./operation.test.helpers.ts";

const limiter = await import(load("rate-limiter"));
const errors = await import(load("admission"));
const op = await import(load("operation"));
const data = (source: string) =>
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(operationImports(source))).toString("base64")}`;
const redis = data(
  "export class ErrorReply extends Error {} export const createClient = () => globalThis.rg12Open();",
);
const { ErrorReply } = await import(redis);
const valkey = await import(
  data(
    readFileSync(
      new URL("../../templates/local-v2/assets/src/runtime/valkey.ts.template", import.meta.url),
      "utf8",
    )
      .replace('from "redis"', `from "${redis}"`)
      .replace('import { readSecret } from "./local.ts";', 'const readSecret=()=>"unit-password";'),
  )
);
const caches: { close(): void }[] = [];
const initialTime = 1700000000000;
function store() {
  let now = initialTime;
  let mode: "healthy" | "down" | "saturated" | "unknown" = "healthy";
  const logs = new Map<string, number[]>();
  const evalCommand = vi.fn(
    async (_script: string, args: { keys: string[]; arguments: string[] }) => {
      if (mode === "saturated") throw Error("The queue is full");
      if (mode === "down") throw Error("disconnected");
      if (mode === "unknown") throw new ErrorReply("script failed after dispatch");
      const windowMs = Number(args.arguments[0]),
        limit = Number(args.arguments[1]);
      const key = args.keys[0];
      if (!key || !Number.isSafeInteger(windowMs) || !Number.isSafeInteger(limit))
        throw Error("Invalid private dispatch");
      // Independent rolling-window oracle. Native script/transport proof remains RG14.
      const rows = (logs.get(key) ?? []).filter((stamp) => stamp > now - windowMs);
      const admitted = rows.length < limit;
      if (admitted) rows.push(now);
      logs.set(key, rows);
      const oldest = rows[0];
      if (oldest === undefined) throw Error("Missing admission log");
      return [Number(admitted), rows.length, now, oldest + windowMs];
    },
  );
  vi.stubGlobal("rg12Open", () => ({
    on() {},
    connect: async () => {},
    destroy() {},
    eval: evalCommand,
    ping: async () => "PONG",
  }));
  return {
    evalCommand,
    logs,
    advance: (ms: number) => {
      now += ms;
    },
    mode: (m: typeof mode) => {
      mode = m;
    },
  };
}
async function core(
  module = "create-limit",
  limit = 2,
  windowSeconds = 60,
  hooks = { key: (caller: { subject: string }) => caller.subject },
) {
  const cache = await valkey.createValkeyCache({
    binding: { hostname: "cache-unit", port: 6379, secret: "unit", tls: { mode: "disable" } },
  });
  caches.push(cache);
  return {
    cache,
    core: limiter.createRateLimiter({
      process: "items-api",
      module,
      limit,
      windowSeconds,
      cache,
      hooks,
    }),
  };
}
async function within(action: () => Promise<unknown>, subject?: string) {
  const context = operation({
    maximumMs: 10000,
    caller: subject === undefined ? undefined : { subject },
  });
  try {
    return await withOperation(context.context, action);
  } finally {
    context.close();
  }
}
afterEach(async () => {
  for (const cache of caches.splice(0)) cache.close();
  for (const database of databases.splice(0)) await database.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("RG12 atomic callable limiter", () => {
  it("uses two independent clients with one shared log; denied calls retain an absolute retry bound and expiry admits again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(initialTime);
    const s = store();
    const a = await core();
    const b = await core();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => within(() => (i % 2 ? a : b).core.admit({}), "alice")),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(s.evalCommand).toHaveBeenCalledTimes(10);
    for (const result of results.filter((r) => r.status === "rejected")) {
      if (result.status !== "rejected") throw Error();
      expect(result.reason).toMatchObject({
        statusCode: 429,
        code: "RATE_LIMITED",
        outcome: "refused",
        retryAfterMs: 60000,
      });
      expect(errors.classifyHttpError(result.reason)).toMatchObject({
        status: 429,
        retryable: true,
        headers: { "Retry-After": "60" },
      });
    }
    s.advance(30000);
    vi.setSystemTime(initialTime + 30000);
    await expect(within(() => a.core.admit({}), "alice")).rejects.toMatchObject({
      retryAfterMs: 30000,
      decision: { count: 2, remaining: 0 },
    });
    s.advance(30000);
    vi.setSystemTime(initialTime + 60000);
    expect(await within(() => b.core.admit({}), "alice")).toMatchObject({
      admitted: true,
      count: 1,
      remaining: 1,
      retryAfterMs: 0,
    });
    const c = await core("other-policy");
    expect(await within(() => c.core.admit({}), "alice")).toMatchObject({ count: 1 });
    const d = await core("create-limit", 1);
    expect(await within(() => d.core.admit({}), "alice")).toMatchObject({ count: 1 });
    expect(s.logs.size).toBe(3);
  });
  it("never dispatches missing identity, forged input, bad keys or captured capability calls from pure/local effects", async () => {
    const s = store();
    const a = await core();
    for (const subject of [undefined, "\ud800", "a\u0000b"])
      await expect(within(() => a.core.admit({}), subject)).rejects.toMatchObject({
        statusCode: 401,
      });
    for (const input of [
      undefined,
      null,
      [],
      { key: "attacker" },
      { headers: { "x-forwarded-for": "127.0.0.1" } },
    ])
      await expect(within(() => a.core.admit(input), "alice")).rejects.toMatchObject({
        statusCode: 400,
      });
    for (const key of ["", "é".repeat(129), "\ud800", "x\n", Promise.resolve("key")]) {
      const bad = limiter.createRateLimiter({
        process: "items-api",
        module: "bad-policy",
        limit: 2,
        windowSeconds: 60,
        cache: a.cache,
        hooks: { key: () => key },
      });
      await expect(within(() => bad.admit({}), "alice")).rejects.toMatchObject({
        code: "RATE_LIMIT_KEY",
      });
    }
    for (const scope of [op.withLocalPolicy, op.withLocalMutation])
      await expect(within(() => scope(() => a.core.admit({})), "alice")).rejects.toMatchObject({
        code: "EFFECT_NOT_ALLOWED",
      });
    const captured = limiter.createRateLimiter({
      process: "items-api",
      module: "captured",
      limit: 2,
      windowSeconds: 60,
      cache: a.cache,
      hooks: {
        key: () => {
          op.assertNetworkAllowed();
          return "no";
        },
      },
    });
    await expect(within(() => captured.admit({}), "alice")).rejects.toMatchObject({
      code: "EFFECT_NOT_ALLOWED",
    });
    expect(() =>
      limiter.createRateLimiter({
        process: "items-api",
        module: "accessor",
        limit: 2,
        windowSeconds: 60,
        cache: a.cache,
        hooks: {
          get key() {
            op.assertNetworkAllowed();
            return () => "bad";
          },
        },
      }),
    ).toThrow("EFFECT_NOT_ALLOWED");
    expect(s.evalCommand).not.toHaveBeenCalled();
    expect(await within(() => withEffect("read", () => a.core.admit({})), "😀alice")).toMatchObject(
      { admitted: true },
    );
    expect(s.evalCommand).toHaveBeenCalledTimes(1);
  });
  it("fails closed for saturation, disconnect and unknown replies; healthy saturation and unknown preserve the client", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(initialTime);
    const s = store();
    const a = await core();
    for (const [mode, code, outcome] of [
      ["saturated", "RATE_LIMIT_SATURATED", "refused"],
      ["unknown", "RATE_LIMIT_UNKNOWN", "unknown"],
    ] as const) {
      s.mode(mode);
      const error = await within(() => a.core.admit({}), "alice").catch((e) => e);
      expect(error).toMatchObject({ statusCode: 503, code, outcome });
      expect(errors.classifyHttpError(error)).toMatchObject({ status: 503, retryable: false });
      if (outcome === "unknown")
        expect(errors.classifyHttpError(error).headers).toHaveProperty(
          "X-Jeeves-Outcome",
          "unknown",
        );
      s.mode("healthy");
      expect(await within(() => a.core.admit({}), "alice")).toMatchObject({ admitted: true });
    }
    s.mode("down");
    await expect(within(() => a.core.admit({}), "bob")).rejects.toMatchObject({
      code: "RATE_LIMIT_UNKNOWN",
      outcome: "unknown",
    });
    await expect(within(() => a.core.admit({}), "bob")).rejects.toMatchObject({
      code: "RATE_LIMIT_UNAVAILABLE",
      outcome: "refused",
    });
    expect(s.logs.size).toBe(1);
    s.mode("healthy");
    s.advance(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await within(() => a.core.admit({}), "bob")).toMatchObject({ admitted: true, count: 1 });
  });
  it("executes actual limiter from RG10 admission; committed replay bypasses exhausted/unavailable admission and unknown stays unknown after rollback", async () => {
    const s = store();
    const f = await fixture();
    const a = await core("create-limit", 1);
    const handle = limiter.rateLimiterCapability(() => a.core, "create-limit");
    const local = f.define({
      admit: async () => {
        await handle.admit({});
      },
    });
    const result = await f.run(local);
    expect(result.status).toBe(201);
    expect(s.evalCommand).toHaveBeenCalledTimes(1);
    await expect(f.run(local, "second", { id: "two" })).rejects.toMatchObject({
      statusCode: 429,
      code: "RATE_LIMITED",
      outcome: "refused",
    });
    s.mode("unknown");
    expect(await f.run(local)).toEqual(result);
    expect(s.evalCommand).toHaveBeenCalledTimes(2);
    await expect(f.run(local, "third", { id: "three" })).rejects.toMatchObject({
      statusCode: 503,
      code: "RATE_LIMIT_UNKNOWN",
      outcome: "unknown",
    });
    expect((await f.pg.query("SELECT id FROM p_app.items")).rows).toEqual([{ id: "one" }]);
    expect(s.evalCommand).toHaveBeenCalledTimes(3);
  });
});

const registry = loadLocalV2Registry();
describe("RG12 authoring and binding contracts", () => {
  it("emits actual guarded callable assignment, required non-evicting durable cache and only limit/window normal settings", async () => {
    const design = rateLimiterDesign();
    const result = resolveGeneration(design, registry.installed);
    expect(result.findings).toEqual([]);
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const text = (path: string) =>
      Buffer.from(bundle.files.find((f) => f.path === path)?.bytes ?? []).toString();
    const process = text("src/processes/items-api.ts");
    expect(process).toContain(
      'createLimit: rateLimiterCapability(() => createLimit.limiter, "create-limit")',
    );
    expect(process).toContain("await createLimit.cache.ping()");
    expect(process).toContain("accountGuard.caller");
    expect(text("compose.yaml")).toContain(
      "--maxmemory-policy noeviction --appendonly yes --appendfsync always",
    );
    expect(text("src/modules/items-api/create-item.slots.ts")).toContain(
      "createLimit: RateLimiterCapability",
    );
    const assignment = /dependencies\["create-item"\] = \{[\s\S]*?\n\s*\};/.exec(process)?.[0];
    if (!assignment) throw Error("Missing generated assignment");
    const admit = vi.fn(async () => ({ admitted: true }));
    const dependencies = new Function(
      "rateLimiterCapability",
      "createLimit",
      "clients",
      "configuredSettings",
      `const dependencies={}; ${stripTypeScriptTypes(assignment)}; return dependencies["create-item"];`,
    )(
      limiter.rateLimiterCapability,
      { limiter: { admit } },
      { "product:items-db:create-item": {} },
      { "create-item": {} },
    );
    await dependencies.createLimit.admit({});
    expect(admit).toHaveBeenCalledTimes(1);
    expect(
      normalSettingFields(design, registry.installed, { component: "create-limit" })
        .map((c) => c.input)
        .sort(),
    ).toEqual(["limiter.limit", "limiter.windowSeconds"]);
    expect(
      result.model?.capabilities.find((c) => c.contract.id === "rate-limiter.admit"),
    ).toMatchObject({
      transport: "in-process",
      contract: { effect: "read" },
      dependencies: ["account-guard"],
    });
  });
  it("mouse/chat commands agree; unsupported values/providers/trust and missing guard refuse without changing saved source", () => {
    const design = rateLimiterDesign();
    const settings = {
      kind: "rate-limiter",
      algorithm: "sliding-window",
      key: "policy",
      store: "redis",
      limit: 3,
      windowSeconds: 120,
    } as const;
    const command = { type: "editComponent", component: "create-limit", settings } as const;
    expect(buildSupportedAuthoringCommand(design, command, registry.installed)).toEqual(
      buildStudioCommand(design, command),
    );
    for (const limit of [0, 10001])
      expect(() =>
        buildSupportedAuthoringCommand(
          design,
          { ...command, settings: { ...settings, limit } },
          registry.installed,
        ),
      ).toThrow();
    const custom = runStudioCommands(design, [
      { type: "addModule", host: "items-api", id: "custom-caller", kind: "custom" },
    ]);
    const customOption = moduleConnectOptions(custom, "custom-caller").find(
      (c) => "module" in c.target && c.target.module === "create-limit",
    );
    expect(customOption).toHaveProperty("command.slot", "admission");
    const disconnected = runStudioCommands(design, [
      {
        type: "disconnectModule",
        link:
          design.architecture?.studio?.componentConnections?.find(
            (c) => c.from === "create-item" && c.to.kind === "component",
          )?.id ?? "",
      },
    ]);
    const mouse = moduleConnectOptions(disconnected, "create-item").find(
      (c) => "module" in c.target && c.target.module === "create-limit",
    );
    if (!mouse || !("command" in mouse)) throw Error("Missing mouse callable option");
    expect(buildSupportedAuthoringCommand(disconnected, mouse.command, registry.installed)).toEqual(
      buildStudioCommand(disconnected, mouse.command),
    );
    for (const [key, value] of [
      ["algorithm", "token-bucket"],
      ["store", "memory"],
      ["key", "ip"],
      ["key", "api-key"],
      ["key", "user"],
    ] as const) {
      const saved = structuredClone(design);
      const component = saved.architecture?.studio?.components?.find(
        (c) => c.id === "create-limit",
      );
      Object.assign(component?.settings ?? {}, { [key]: value });
      expect(() => designSchema.parse(saved)).not.toThrow();
      const bytes = JSON.stringify(saved);
      const resolved = resolveGeneration(saved, registry.installed);
      expect(resolved.complete).toBe(false);
      expect(resolved.findings.some((f) => f.message.includes(`limiter.${key}`))).toBe(true);
      expect(planModules(saved).refusals.join(" ")).toMatch(/shared-cache|trusted-address/);
      expect(JSON.stringify(saved)).toBe(bytes);
    }
    const bad = structuredClone(design);
    const cache = bad.architecture?.studio?.elements.find((e) => e.element === "admission-cache");
    Object.assign(cache?.settings ?? {}, { provider: "managed" });
    expect(resolveGeneration(bad, registry.installed).complete).toBe(false);
    const guard = design.architecture?.studio?.components?.find((c) => c.id === "account-guard");
    if (guard?.settings.kind !== "auth-guard") throw Error();
    const optionalGuard = { ...guard.settings, signIn: "optional" } as const;
    expect(() =>
      runStudioCommands(design, [
        {
          type: "editComponent",
          component: guard.id,
          settings: optionalGuard,
        },
      ]),
    ).toThrow("requires a complete callable");
    const separate = runStudioCommands(design, [
      { type: "disconnectModule", link: "create-item-create-limit" },
      {
        type: "addTile",
        from: { tile: "items-api" },
        side: "after",
        tile: { id: "positive-cache", name: "Positive cache", kind: "cache" },
        linkId: "api-positive",
      },
      {
        type: "connectModule",
        module: "item-caller",
        slot: "cache",
        target: { tile: "positive-cache" },
      },
    ]);
    expect(resolveGeneration(separate, registry.installed).findings).toEqual([]);
    expect(resolveGeneration(separate, registry.installed).complete).toBe(true);
    const partCommand = {
      type: "connectModule",
      module: "create-item",
      slot: "admission",
      target: { module: "create-limit" },
    } as const;
    expect(() => buildSupportedAuthoringCommand(separate, partCommand, registry.installed)).toThrow(
      "has no standalone product operation for admission",
    );
    const rawPart = structuredClone(separate);
    rawPart.architecture?.studio?.componentConnections?.push({
      id: "create-item-create-limit",
      from: "create-item",
      to: { kind: "component", id: "create-limit" },
    });
    const partResolution = resolveGeneration(rawPart, registry.installed);
    expect(partResolution.complete).toBe(false);
    expect(
      partResolution.findings.some((finding) =>
        finding.message.includes("has no standalone product operation for admission"),
      ),
    ).toBe(true);
    const beforeShared = runStudioCommands(separate, [
      { type: "disconnectModule", link: "item-caller-positive-cache" },
    ]);
    expect(() =>
      buildSupportedAuthoringCommand(
        beforeShared,
        {
          type: "connectModule",
          module: "item-caller",
          slot: "cache",
          target: { tile: "admission-cache" },
        },
        registry.installed,
      ),
    ).toThrow("LRU eviction; admission requires no eviction");
    const result = applyOperations(design, buildStudioCommand(design, command).ops);
    expect(result.ok).toBe(true);
  });
});
