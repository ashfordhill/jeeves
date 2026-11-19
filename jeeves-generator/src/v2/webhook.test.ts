import { createHmac, hkdfSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import {
  applyOperations,
  buildSupportedAuthoringCommand,
  createStudioComponentSettings,
  designGeneration,
  normalGenerationControls,
  resolveGeneration,
} from "@jeeves/spec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { webhookDesign } from "../../../field-projects/generator-system/fixtures/rg-webhook/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { durableWorkMigration } from "./client-wiring.ts";
import {
  databases,
  fixture,
  load,
  operation,
  withOperation,
} from "./local-operation.test.helpers.ts";

const webhooks = await import(load("webhook"));
const durable = await import(load("durable-work"));
const { createWebhookVerifier } = await import(load("keys"));
const { keyRing } = await import(load("settings"));
const require = createRequire(new URL("../../../jeeves/apps/server/package.json", import.meta.url));
const httpSource = stripTypeScriptTypes(
  readFileSync(
    new URL("../../templates/local-v2/assets/src/runtime/http.ts.template", import.meta.url),
    "utf8",
  ),
)
  .replace(/from "\.\/([a-z-]+)\.ts"/g, (_m, name: string) => `from "${load(name)}"`)
  .replace('from "fastify"', `from "${pathToFileURL(require.resolve("fastify")).href}"`);
const { createHttpService } = await import(
  `data:text/javascript;base64,${Buffer.from(httpSource).toString("base64")}`
);
const vector = JSON.parse(
  readFileSync(
    new URL(
      "../../../field-projects/generator-system/fixtures/rg-webhook/signed-vector.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const rawKey = Buffer.from(vector.keyHex, "hex");
const ring = (keys: Buffer[] = [rawKey]) =>
  keyRing().parse(
    Buffer.from(
      JSON.stringify(keys.map((key, i) => ({ id: `k${i}`, key: key.toString("base64url") }))),
    ),
  );
const sign = (
  bytes: Buffer,
  timestamp = String(Math.floor(Date.now() / 1000)),
  key = rawKey,
  receiver = "receive-events",
) => ({
  "x-jeeves-timestamp": timestamp,
  "x-jeeves-signature": `v1=${createHmac(
    "sha256",
    Buffer.from(hkdfSync("sha256", key, "jeeves.keys.v1", '["sign","jeeves.webhook.v1"]', 32)),
  )
    .update(`jeeves-webhook-v1\n${receiver}\n${timestamp}\n`)
    .update(bytes)
    .digest("hex")}`,
  "content-type": "application/json",
});
const apps: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  await Promise.all(databases.splice(0).map((d) => d.close()));
  vi.restoreAllMocks();
});
async function setup(
  options: {
    map?: (input: unknown) => unknown;
    complete?: (
      event: { id: string; type: string; payload: unknown },
      commands: { call(name: string, values: unknown[]): Promise<unknown> },
    ) => Promise<void>;
    keys?: Buffer[];
  } = {},
) {
  const f = await fixture();
  await f.pg.exec(
    `${durableWorkMigration.sql} GRANT SELECT,INSERT,UPDATE,DELETE ON jeeves.work_records TO runtime`,
  );
  const work = webhooks.defineWebhookWork({
    database: "db",
    id: "receive-events",
    version: 1,
    integration: null,
    complete:
      options.complete ??
      (async (
        e: { id: string; type: string },
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        await commands.call("insert", [e.id, e.type]);
      }),
  });
  const prepared = durable.durableWorkDefinition(webhooks.webhookWorkEngine(work), "db", true);
  const storeOptions = {
    namespace: durable.durableWorkNamespace(
      "db",
      "owner",
      webhooks.webhookWorkEngine(work),
      "receive-events",
    ),
    process: "api",
    pool: f.pool,
    productRole: "product",
    commands: f.commands,
  };
  const store = durable.bindDurableWork(f.dependencies.db, prepared, storeOptions);
  const second = durable.createWorkStore({ ...storeOptions, definition: prepared.definition });
  const mapper = vi.fn(options.map ?? ((input) => input));
  const app = await createHttpService({
    id: "webhook",
    settings: { requestTimeoutMs: 10000, concurrencyLimit: 4 },
    initialize: async () => {},
    configure: (routes: unknown) =>
      webhooks.webhookRoutes({
        routes,
        module: "receive-events",
        dependencies: f.dependencies,
        work,
        map: mapper,
        verify: createWebhookVerifier(ring(options.keys), "receive-events"),
        bodyLimitBytes: 1024,
        replayWindowSeconds: 300,
      }),
  });
  apps.push(app);
  await app.start({ host: "127.0.0.1", port: 0 });
  const run = async <T>(effect: () => Promise<T>) => {
    const r = operation({ maximumMs: 10000 });
    try {
      return await withOperation(r.context, effect);
    } finally {
      r.close();
    }
  };
  const send = (body: Buffer, headers = sign(body)) =>
    app.inject({ method: "POST", url: "/modules/receive-events", payload: body, headers });
  const rows = async () =>
    (
      await f.pg.query<{ state: string; attempts: number; error: string }>(
        "SELECT * FROM jeeves.work_records",
      )
    ).rows;
  return { ...f, app, mapper, work, store, second, run, send, rows };
}
const bytes = (id = "evt-1") =>
  Buffer.from(JSON.stringify({ id, type: "item.changed", payload: { value: 7 } }));

describe("RG17 generic verified webhook inbox", () => {
  it("matches independently computed Python HKDF/HMAC bytes; timestamps, canonical headers, receiver and retained keys are enforced", () => {
    const raw = Buffer.from(vector.raw);
    const verify = createWebhookVerifier(ring(), vector.receiver);
    expect(sign(raw, vector.timestamp)["x-jeeves-signature"]).toBe(vector.signature);
    expect(verify(vector.timestamp, vector.signature, raw, 300, 1800000000)).toBe(true);
    for (const [ts, signature, body, now] of [
      [
        vector.timestamp,
        vector.signature,
        Buffer.from(JSON.stringify(JSON.parse(vector.raw))),
        1800000000,
      ],
      ["01800000000", vector.signature, raw, 1800000000],
      [vector.timestamp, vector.signature.toUpperCase(), raw, 1800000000],
      [vector.timestamp, vector.signature, raw, 1800000301],
      [vector.timestamp, vector.signature, raw, 1799999699],
      [[vector.timestamp], vector.signature, raw, 1800000000],
      [vector.timestamp, [vector.signature], raw, 1800000000],
      [vector.timestamp, `${vector.signature},${vector.signature}`, raw, 1800000000],
    ])
      expect(verify(ts, signature, body, 300, now)).toBe(false);
    const next = Buffer.alloc(32, 99);
    expect(
      createWebhookVerifier(ring([next, rawKey]), vector.receiver)(
        vector.timestamp,
        vector.signature,
        raw,
        300,
        1800000000,
      ),
    ).toBe(true);
    expect(
      createWebhookVerifier(ring([next]), vector.receiver)(
        vector.timestamp,
        vector.signature,
        raw,
        300,
        1800000000,
      ),
    ).toBe(false);
    expect(
      createWebhookVerifier(ring(), "other-receiver")(
        vector.timestamp,
        vector.signature,
        raw,
        300,
        1800000000,
      ),
    ).toBe(false);
  });

  it("generic unsigned work with the same chosen id cannot insert or claim a protected webhook inbox", async () => {
    const f = await setup();
    await f.send(bytes());
    const generic = durable.defineDurableWork({
      database: "db",
      id: "receive-events",
      version: 1,
      retentionSeconds: 604800,
      maxAttempts: 4,
      integration: null,
      validate: (input: unknown) => input,
      complete: async () => {},
    });
    const genericHandle = {};
    const genericNamespace = durable.durableWorkNamespace("db", "owner", generic, "copied-module");
    expect(genericNamespace).toBe('["db","owner","receive-events"]');
    const inboxNamespace = durable.durableWorkNamespace(
      "db",
      "owner",
      webhooks.webhookWorkEngine(f.work),
      "receive-events",
    );
    expect(inboxNamespace).toBe('["db","owner","webhook-v1","receive-events","receive-events"]');
    const genericStore = durable.bindDurableWork(
      genericHandle,
      durable.durableWorkDefinition(generic, "db", true),
      {
        namespace: genericNamespace,
        process: "api",
        pool: f.pool,
        productRole: "product",
        commands: f.commands,
      },
    );
    await f.run(async () => {
      expect(await genericStore.claim(1)).toEqual([]);
      await generic.accept(
        { db: genericHandle },
        {
          key: "evt-1",
          input: { id: "evt-1", type: "forged", payload: null, contentHash: "a".repeat(64) },
        },
      );
      await genericStore.runBatch(() => {});
      expect(await f.store.status("{}", "evt-1")).toMatchObject({ state: "accepted", attempts: 0 });
    });
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toEqual([]);
    await f.run(() => f.store.runBatch(() => {}));
    expect((await f.pg.query("SELECT id,account FROM p_app.items")).rows).toEqual([
      { id: "evt-1", account: "item.changed" },
    ]);
  });
  it("two compiled receivers remain distinct even when their application-chosen work ids are copied", async () => {
    const f = await setup();
    const secondWork = webhooks.defineWebhookWork({
      database: "db",
      id: "receive-events",
      version: 1,
      integration: null,
      complete: async (
        e: { id: string; type: string },
        commands: { call(name: string, values: unknown[]): Promise<unknown> },
      ) => {
        await commands.call("insert", [`other:${e.id}`, e.type]);
      },
    });
    const secondHandle = {};
    const namespace = durable.durableWorkNamespace(
      "db",
      "owner",
      webhooks.webhookWorkEngine(secondWork),
      "other-receiver",
    );
    expect(namespace).toBe('["db","owner","webhook-v1","other-receiver","receive-events"]');
    const store = durable.bindDurableWork(
      secondHandle,
      durable.durableWorkDefinition(webhooks.webhookWorkEngine(secondWork), "db", true),
      { namespace, process: "api", pool: f.pool, productRole: "product", commands: f.commands },
    );
    const app = await createHttpService({
      id: "other",
      settings: { requestTimeoutMs: 10000, concurrencyLimit: 1 },
      initialize: async () => {},
      configure: (routes: unknown) =>
        webhooks.webhookRoutes({
          routes,
          module: "other-receiver",
          dependencies: { db: secondHandle },
          work: secondWork,
          map: (input: unknown) => input,
          verify: createWebhookVerifier(ring(), "other-receiver"),
          bodyLimitBytes: 1024,
          replayWindowSeconds: 300,
        }),
    });
    apps.push(app);
    await app.start({ host: "127.0.0.1", port: 0 });
    await f.send(bytes());
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/modules/other-receiver",
          payload: bytes(),
          headers: sign(bytes()),
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/modules/other-receiver",
          payload: bytes(),
          headers: sign(bytes(), String(Math.floor(Date.now() / 1000)), rawKey, "other-receiver"),
        })
      ).statusCode,
    ).toBe(202);
    await f.run(async () => {
      await store.runBatch(() => {});
      expect(await f.store.status("{}", "evt-1")).toMatchObject({ state: "accepted", attempts: 0 });
      await f.store.runBatch(() => {});
    });
    expect((await f.pg.query("SELECT id FROM p_app.items ORDER BY id")).rows).toEqual([
      { id: "evt-1" },
      { id: "other:evt-1" },
    ]);
  });
  it("authenticates before decoding or mapper invocation; malformed, tampered, stale and streamed over-limit input never enter inbox", async () => {
    const f = await setup();
    expect(Object.keys(f.work)).toEqual([]);
    expect(f.work.accept).toBeUndefined();
    const body = bytes();
    for (const [payload, headers] of [
      [Buffer.from("{malformed"), sign(body)],
      [Buffer.from(body.toString().replace("7", "8")), sign(body)],
      [body, sign(body, String(Math.floor(Date.now() / 1000) - 301))],
      [body, { "content-type": "application/json" }],
    ]) {
      const result = await f.app.inject({
        method: "POST",
        url: "/modules/receive-events",
        payload,
        headers,
      });
      expect(result.statusCode).toBe(401);
      expect(result.headers["www-authenticate"]).toBe("Jeeves-HMAC");
    }
    expect(f.mapper).not.toHaveBeenCalled();
    for (const payload of [
      Buffer.alloc(1025),
      Readable.from([Buffer.alloc(700), Buffer.alloc(325)]),
    ]) {
      expect(
        (
          await f.app.inject({
            method: "POST",
            url: "/modules/receive-events",
            payload,
            headers: sign(body),
          })
        ).statusCode,
      ).toBe(413);
    }
    expect(f.mapper).not.toHaveBeenCalled();
    expect(await f.rows()).toEqual([]);
    for (const body of [
      Buffer.from("{malformed"),
      Buffer.from([0xff]),
      Buffer.from('{"id":"bad id","type":"test","payload":{}}'),
    ])
      expect((await f.send(body)).statusCode).toBe(400);
    expect(await f.rows()).toEqual([]);
  });
  it("durably stores original byte identity; lost 2xx, completion, changed content and distinct product mapping have fixed acceptance semantics", async () => {
    const f = await setup({
      map: (input) => {
        const e = input as { delivery: string; kind: string; data: unknown };
        return { id: e.delivery, type: e.kind, payload: e.data };
      },
    });
    const body = Buffer.from('{ "delivery":"evt-map", "kind":"item.changed", "data":{"n":1.0} }');
    const first = await f.send(body); // Response deliberately discarded: sender redelivers.
    expect(first.statusCode).toBe(202);
    expect(await f.rows()).toHaveLength(1);
    expect((await f.send(body)).body).toBe(first.body);
    await f.run(() => f.second.runBatch(() => {})); // Another process/copy resumes accepted work.
    expect((await f.send(body)).body).toBe(first.body);
    expect((await f.rows())[0]).toMatchObject({ state: "completed", attempts: 1 });
    expect((await f.pg.query("SELECT id,account FROM p_app.items")).rows).toEqual([
      { id: "evt-map", account: "item.changed" },
    ]);
    const changed = Buffer.from(JSON.stringify(JSON.parse(body.toString())));
    const conflict = await f.send(changed);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toBe("WORK_IDENTITY_CONFLICT");
    expect(await f.rows()).toHaveLength(1);
  });
  it("an unknown acceptance COMMIT never yields 2xx; retry finds the committed acceptance, then restart processes once", async () => {
    const f = await setup();
    f.lose();
    expect((await f.send(bytes())).statusCode).toBe(503);
    expect(await f.rows()).toHaveLength(1);
    expect((await f.send(bytes())).statusCode).toBe(202);
    await f.run(() => f.second.runBatch(() => {}));
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toHaveLength(1);
    expect((await f.rows())[0]?.state).toBe("completed");
  });
  it("expired holders cannot commit webhook effects; transient processing retries and terminal failure stays visible and uncleaned", async () => {
    let attempts = 0;
    const f = await setup({
      complete: async (e, commands) => {
        if (++attempts === 1) throw Error("sensitive failure");
        await commands.call("insert", [e.id, e.type]);
      },
    });
    await f.send(bytes());
    await f.run(async () => {
      const [old] = await f.store.claim(1);
      expect(await f.second.claim(1)).toEqual([]);
      await f.pg.exec(
        "UPDATE jeeves.work_records SET lease_until=clock_timestamp()-interval '1 second'",
      );
      const [next] = await f.second.claim(1);
      await expect(f.store.complete(old)).rejects.toMatchObject({ code: "WORK_LEASE_LOST" });
      await f.second.runBatch(() => {}); // no extra available claim
      await expect(f.second.complete(next)).rejects.toThrow("sensitive failure");
      await f.second.fail(next);
    });
    expect((await f.rows())[0]).toMatchObject({ state: "retry" });
    await f.pg.exec(
      "UPDATE jeeves.work_records SET next_attempt_at=clock_timestamp()-interval '1 second'",
    );
    await f.run(() => f.store.runBatch(() => {}));
    expect((await f.rows())[0]?.state).toBe("completed");
    expect((await f.pg.query("SELECT * FROM p_app.items")).rows).toHaveLength(1);
    const g = await setup({
      complete: async () => {
        throw Error("secret body");
      },
    });
    await g.send(bytes("terminal"));
    const logs: string[] = [];
    for (let i = 0; i < 4; i++) {
      await g.pg.exec(
        "UPDATE jeeves.work_records SET next_attempt_at=clock_timestamp()-interval '1 second'",
      );
      await g.run(() => g.store.runBatch((event: string) => logs.push(event)));
    }
    expect((await g.rows())[0]).toMatchObject({
      state: "failed",
      error: "WORK_ATTEMPTS_EXHAUSTED",
      attempts: 4,
    });
    expect(logs.join()).not.toContain("secret");
    await g.pg.exec("UPDATE jeeves.work_records SET expires_at=clock_timestamp()-interval '1 day'");
    await g.run(() => g.store.sweep());
    expect(await g.rows()).toHaveLength(1);
  });
});

describe("RG17 installed authoring and emitted boundaries", () => {
  it("keeps 35-day retention private to the selected webhook work engine", () => {
    expect(() =>
      durable.defineDurableWork({
        database: "db",
        id: "ordinary-work",
        version: 1,
        retentionSeconds: 3024000,
        maxAttempts: 4,
        integration: null,
        validate: (input: unknown) => input,
        async complete() {},
      }),
    ).toThrow("Invalid durable work declaration");
  });

  it("refuses Required-user composition through normal authoring and raw source before clients open", () => {
    const design = webhookDesign();
    const registry = loadLocalV2Registry();
    expect(() =>
      buildSupportedAuthoringCommand(
        design,
        { type: "addModule", host: "events-api", kind: "auth-guard", id: "required-guard" },
        registry.installed,
      ),
    ).toThrow(/Required user Auth guard/);
    const studio = design.architecture?.studio;
    const component = studio?.components?.[0];
    if (!studio?.components || !component) throw Error("Missing module fixture");
    studio.components.push({
      ...component,
      id: "required-guard",
      name: "Required guard",
      settings: createStudioComponentSettings("auth-guard"),
    });
    const resolved = resolveGeneration(design, registry.installed);
    expect(resolved.model).toBeUndefined();
    expect(resolved.findings.some((f) => f.message.includes("Required user Auth guard"))).toBe(
      true,
    );
  });

  it("defaults a missing format and keeps the generic verifier, package files and private processor", () => {
    const design = webhookDesign();
    const selection = designGeneration(design)?.selections.find((s) => s.id === "receive-events");
    if (!selection) throw Error("Missing receiver");
    selection.id = "aliased-selection";
    const registry = loadLocalV2Registry();
    const resolved = resolveGeneration(design, registry.installed);
    expect(resolved.findings).toEqual([]);
    expect(normalGenerationControls(design, registry.installed).map((r) => r.input)).toEqual(
      expect.arrayContaining([
        "webhook.bodyLimitBytes",
        "webhook.replayWindowSeconds",
        "webhook.signatureFormat",
      ]),
    );
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    const source = (path: string) =>
      new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
    expect(bundle.report.settings).toContainEqual(
      expect.objectContaining({
        input: "webhook.signatureFormat",
        value: "jeeves",
        origin: "descriptor-default",
      }),
    );
    expect(source("package.json")).not.toContain('"stripe"');
    expect(source("src/runtime/stripe-webhook.ts")).toBe("");
    expect(source("src/processes/events-api.ts")).toContain("privateWebhookVerifier");
    expect(source("src/processes/events-api.ts")).toContain('module: "receive-events"');
    expect(source("src/processes/events-api.ts")).toContain("startDurableWork");
    expect(source("src/processes/events-api.ts")).not.toContain("stubRoutes");
    expect(source("src/modules/events-api/receive-events.mapping.hooks.ts")).toContain(
      "@jeeves-extension: policy",
    );
    expect(source("src/extension-api/index.ts")).not.toContain("privateWebhookVerifier");
    expect(source("src/extension-api/index.ts")).not.toContain("webhookWorkEngine");
    expect(source("src/extension-api/index.ts")).not.toContain("protectWebhookInbox");
    expect(source("src/runtime/module-clients.ts")).toContain(
      "durableWorkNamespace(binding.resource, binding.owner ?? binding.tile, work.work, binding.module)",
    );
    expect(source("infra/postgres/event-state/052-jeeves-durable-work.sql")).toContain(
      "work_records",
    );
    expect(source("infra/local.json")).toContain("product-event-state--events-api");
  });

  it("emits Stripe only for its selection and binds signed ingress by stable module ID", () => {
    const source = webhookDesign();
    const registry = loadLocalV2Registry();
    const edited = applyOperations(
      source,
      buildSupportedAuthoringCommand(
        source,
        {
          type: "editComponent",
          component: "receive-events",
          settings: {
            kind: "webhook-receiver",
            signatureFormat: "stripe",
            bodyLimitBytes: "262144",
            replayWindowSeconds: 30,
          },
        },
        registry.installed,
      ).ops,
    );
    if (!edited.ok) throw Error("Stripe authoring refused");
    const selection = designGeneration(edited.design)?.selections.find(
      (s) => s.id === "receive-events",
    );
    if (!selection) throw Error("Missing receiver");
    selection.id = "aliased-selection";
    const bundle = assembleV2({ designJson: JSON.stringify(edited.design) }, registry);
    const file = (path: string) =>
      new TextDecoder().decode(bundle.files.find((row) => row.path === path)?.bytes);
    expect(bundle.report.findings).toEqual([]);
    expect(JSON.parse(file("package.json")).dependencies.stripe).toBe("23.1.0");
    expect(file("pnpm-lock.yaml")).toContain("stripe@23.1.0");
    expect(file("src/runtime/stripe-webhook.ts")).toContain("Stripe.webhooks.constructEvent");
    expect(file("infra/postgres/event-state/056-jeeves-stripe-retention.sql")).toContain(
      "retention_seconds = 3024000",
    );
    expect(file("src/processes/events-api.ts")).toContain(
      'privateStripeWebhookVerifier("receive-events")',
    );
    expect(file("src/processes/events-api.ts")).toContain('webhookReceivers["aliased-selection"]');
    expect(file("src/extension-api/index.ts")).not.toContain("privateStripeWebhook");
    expect(JSON.parse(file("deploy/contract.json")).processes[0].stripeWebhooks).toEqual([
      {
        method: "POST",
        path: "/modules/receive-events",
        edgePath: "/api/events-api/modules/receive-events",
        secretFileEnv: "JEEVES_SECRET_JEEVES_WEBHOOK_RECEIVE_EVENTS_STRIPE_SECRET_FILE",
        secretFileName: "jeeves-webhook-receive-events-stripe-secret",
        bodyLimitBytes: 262144,
        replayWindowSeconds: 30,
        completedRetentionDays: 35,
      },
    ]);
  });
});
