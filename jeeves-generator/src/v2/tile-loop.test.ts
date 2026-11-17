import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withStubWorkloads } from "../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

// The exact emitted loop scaffold, on the real delivery runner. Only `createConsumer` (amqplib)
// is replaced: by the runner over an in-memory transport that records what the broker would see.
const urls = new Map<string, string>();
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
function moduleUrl(name: string): string {
  const old = urls.get(name);
  if (old) return old;
  if (name === "amqp") {
    const url = dataUrl(`
      import { createDeliveryRunner } from "${moduleUrl("delivery")}";
      export async function createConsumer(binding, options) {
        const events = [];
        const runner = createDeliveryRunner({
          ...options,
          transport: {
            async cancel() { events.push("cancel"); },
            async republish(destination, message, headers) {
              events.push({ republish: destination, receipt: message.receipt, headers });
            },
            ack(receipt) { events.push({ ack: receipt }); },
            async close() { events.push("close"); },
          },
        });
        const consumer = {
          binding, options, events, close: runner.close, closed: runner.closed,
          deliver: (receipt, headers = {}, messageId = receipt) =>
            runner.accept({ body: Buffer.from(receipt), messageId, headers, redelivered: false, receipt }),
        };
        globalThis.tileLoopConsumers.push(consumer);
        return consumer;
      }`);
    urls.set(name, url);
    return url;
  }
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const source = readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8");
  const js = stripTypeScriptTypes(source).replace(
    /from "\.\/(.+)\.ts"/g,
    (_match, dependency: string) => `from "${moduleUrl(dependency)}"`,
  );
  const url = dataUrl(js);
  urls.set(name, url);
  return url;
}
type Event =
  | "cancel"
  | "close"
  | { republish: string; receipt: string; headers: Record<string, unknown> }
  | { ack: string };
type Consumer = {
  binding: { hostname: string; passwordSecret: string };
  options: { queue: string; failedQueue: string; concurrency: number; retryLimit: number };
  events: Event[];
  close(): Promise<void>;
  closed: Promise<{ fatal: boolean }>;
  deliver(receipt: string, headers?: Record<string, unknown>, messageId?: string): void;
};
const consumers: Consumer[] = [];
(globalThis as { tileLoopConsumers?: Consumer[] }).tileLoopConsumers = consumers;
const loop = await import(moduleUrl("tile-loop"));
const { NonRetryable } = await import(moduleUrl("delivery"));
const { NotImplemented, createFailureLog, logStarted } = await import(moduleUrl("tile-process"));

/** What a process passes each RabbitMQ loop: `brokerBinding()` read from Compose's endpoint. */
const broker = {
  hostname: "local-broker",
  port: 5672,
  username: "runtime",
  passwordSecret: "broker-password",
  heartbeatSeconds: 10,
  confirmTimeoutMs: 5000,
};
const visits = {
  module: "visit-consumer",
  queue: "visits--visit-worker",
  failedQueue: "visits--visit-worker.failed",
  retryLimit: 5,
  concurrency: 1,
};
type Drain = () => void | Promise<void>;
function testScope() {
  const owned: Drain[] = [];
  return {
    owned,
    signal: new AbortController().signal,
    own: (drain: Drain) => owned.push(drain),
    transport: vi.fn(),
    fail: vi.fn(),
    ready: vi.fn(),
    /** What runProcess does on SIGTERM: each drain in reverse order. */
    stop: async () => {
      for (const drain of [...owned].reverse()) await drain();
    },
  };
}
let lines: Record<string, unknown>[] = [];
beforeEach(() => {
  consumers.length = 0;
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(JSON.parse(line));
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const settled = (consumer: Consumer, receipt: string) =>
  vi.waitFor(() => {
    if (
      !consumer.events.some(
        (event) => typeof event === "object" && "ack" in event && event.ack === receipt,
      )
    )
      throw new Error(`${receipt} not acked yet`);
  });
async function started(entry: (message: unknown) => Promise<void>, bounds = visits) {
  const scope = testScope();
  const log = loop.createLoopLog("visit-worker");
  await loop.startModuleLoop(scope, log, bounds, entry, undefined, broker);
  const consumer = consumers.at(-1);
  if (!consumer) throw new Error("No consumer");
  return { scope, consumer };
}

describe("emitted stub loops (tile process contract, section 5)", () => {
  it("subscribes on the local broker with the loop's queue, .failed and bounds", async () => {
    const { scope, consumer } = await started(async () => {});
    expect(consumer.binding).toMatchObject({
      hostname: "local-broker",
      passwordSecret: "broker-password",
    });
    expect(consumer.options).toMatchObject({
      queue: "visits--visit-worker",
      failedQueue: "visits--visit-worker.failed",
      concurrency: 1,
      retryLimit: 5,
    });
    expect(scope.owned).toHaveLength(1);
    expect(scope.transport).toHaveBeenCalledWith(
      expect.objectContaining({ closed: consumer.closed }),
    );
    await scope.stop();
    await expect(consumer.closed).resolves.toEqual({ fatal: false });
  });

  it("compiles no broker endpoint: each loop consumes on the binding its process passes (QG27)", async () => {
    expect(loop).not.toHaveProperty("loopBroker");
    const template = readFileSync(
      new URL("../../templates/local-v2/assets/src/runtime/tile-loop.ts.template", import.meta.url),
      "utf8",
    );
    expect(template).not.toContain("local-broker");
    // A deployment's broker, as `brokerBinding()` reads it from the environment.
    const deployed = { ...broker, hostname: "broker.internal", port: 5673 };
    const log = loop.createLoopLog("visit-worker");
    const scope = testScope();
    await loop.startModuleLoop(scope, log, visits, async () => {}, undefined, deployed);
    expect(consumers.at(-1)?.binding).toBe(deployed);
    await loop.startModuleLoop(
      scope,
      log,
      visits,
      async () => {},
      undefined,
      loop.amqpLoop(deployed),
    );
    expect(consumers.at(-1)?.binding).toBe(deployed);
    const consumer: Consumer = await loop.loopConsumer(
      visits,
      loop.templateHandler(log, visits, async () => {}),
      {},
      deployed,
    );
    expect(consumer.binding).toBe(deployed);
    expect(consumers).toHaveLength(3);
    await scope.stop();
    await consumer.close();
  });

  it('sends "Not implemented" to .failed at once with one rate-limited log line, and keeps going', async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const received: unknown[] = [];
    const { scope, consumer } = await started(async (message) => {
      received.push(message);
      throw new Error("Not implemented: Visit consumer");
    });
    consumer.deliver("m1", { trace: "t" });
    await settled(consumer, "m1");
    expect(
      received.map((value: unknown) => {
        const { context, ...message } = value as { context: unknown };
        expect(context).toMatchObject({
          signal: expect.any(AbortSignal),
          remainingMs: expect.any(Function),
        });
        return message;
      }),
    ).toEqual([
      {
        body: Buffer.from("m1"),
        messageId: "m1",
        headers: { trace: "t" },
        attempt: 1,
        source: "visits--visit-worker",
      },
    ]);
    expect(consumer.events).toEqual([
      {
        republish: "visits--visit-worker.failed",
        receipt: "m1",
        headers: { trace: "t", "x-delivery-attempt": 1, "x-terminal-code": "NOT_IMPLEMENTED" },
      },
      { ack: "m1" },
    ]);
    expect(lines).toEqual([
      {
        level: "warn",
        event: "not-implemented",
        tile: "visit-worker",
        module: "visit-consumer",
        what: "Visit consumer",
        queue: "visits--visit-worker",
        messageId: "m1",
        action: "sent to visits--visit-worker.failed (NOT_IMPLEMENTED)",
      },
    ]);
    // Within the second: still terminal, but no second line. The next line counts it.
    consumer.deliver("m2");
    await settled(consumer, "m2");
    expect(lines).toHaveLength(1);
    vi.setSystemTime(1000);
    consumer.deliver("m3");
    await settled(consumer, "m3");
    expect(lines.at(-1)).toMatchObject({ messageId: "m3", suppressed: 1 });
    // A NotImplemented (as a generated hook throws) is terminal too; nothing fails the process.
    expect(scope.fail).not.toHaveBeenCalled();
    await scope.stop();
  });

  it("retries other errors 5 times, waiting 250 ms doubling up to 10 s, then RETRY_EXHAUSTED", async () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => loop.retryDelay(attempt))).toEqual([
      250, 500, 1000, 2000, 4000, 8000, 10000, 10000,
    ]);
    // The five waits a stub's message can take: about 8 s in all.
    expect([1, 2, 3, 4, 5].reduce((sum, attempt) => sum + loop.retryDelay(attempt), 0)).toBe(7750);
    vi.useFakeTimers();
    const { scope, consumer } = await started(async () => {
      throw new TypeError("boom");
    });
    consumer.deliver("first");
    await vi.advanceTimersByTimeAsync(249);
    expect(consumer.events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(consumer.events).toEqual([
      { republish: "visits--visit-worker", receipt: "first", headers: { "x-delivery-attempt": 1 } },
      { ack: "first" },
    ]);
    expect(lines[0]).toEqual({
      level: "error",
      event: "loop-error",
      tile: "visit-worker",
      module: "visit-consumer",
      queue: "visits--visit-worker",
      messageId: "first",
      attempt: 1,
      error: "TypeError: boom",
      action: "retry 1 of 5 in 250 ms",
    });
    // The fifth delivery (four retries so far) waits 4 s before its last retry.
    consumer.events.length = 0;
    consumer.deliver("fifth", { "x-delivery-attempt": 4 });
    await vi.advanceTimersByTimeAsync(3999);
    expect(consumer.events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(consumer.events[0]).toEqual({
      republish: "visits--visit-worker",
      receipt: "fifth",
      headers: { "x-delivery-attempt": 5 },
    });
    // The sixth delivery has no retry left: no wait, straight to .failed.
    consumer.events.length = 0;
    consumer.deliver("sixth", { "x-delivery-attempt": 5 });
    await vi.advanceTimersByTimeAsync(0);
    expect(consumer.events).toEqual([
      {
        republish: "visits--visit-worker.failed",
        receipt: "sixth",
        headers: { "x-delivery-attempt": 6, "x-terminal-code": "RETRY_EXHAUSTED" },
      },
      { ack: "sixth" },
    ]);
    expect(scope.fail).not.toHaveBeenCalled();
    await scope.stop();
  });

  it("leaves an unreachable store to the runner: one 5 s wait, the attempt not counted", async () => {
    vi.useFakeTimers();
    const { scope, consumer } = await started(async () => {
      throw new Error("Connection terminated unexpectedly");
    });
    // The fifth delivery of another error waits 4 s (retryDelay) before its retry; this one
    // waits only the runner's 5 s and goes back with the same attempt.
    consumer.deliver("lost", { "x-delivery-attempt": 4 });
    await vi.advanceTimersByTimeAsync(4999);
    expect(consumer.events).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(consumer.events).toEqual([
      { republish: "visits--visit-worker", receipt: "lost", headers: { "x-delivery-attempt": 4 } },
      { ack: "lost" },
    ]);
    expect(lines).toEqual([
      {
        level: "error",
        event: "loop-error",
        tile: "visit-worker",
        module: "visit-consumer",
        queue: "visits--visit-worker",
        messageId: "lost",
        attempt: 5,
        error: "Error: Connection terminated unexpectedly",
        action: "store unreachable, retry in 5000 ms (attempt not counted)",
      },
    ]);
    expect(scope.fail).not.toHaveBeenCalled();
    await scope.stop();
  });

  it("drains on stop: cancels, cuts a retry wait short, settles the message in hand, then closes", async () => {
    vi.useFakeTimers();
    const { scope, consumer } = await started(async () => {
      throw new Error("boom");
    });
    consumer.deliver("waiting", { "x-delivery-attempt": 4 });
    await vi.advanceTimersByTimeAsync(10);
    expect(consumer.events).toEqual([]);
    // No timer advances: stopping alone ends the 4 s wait.
    await scope.stop();
    expect(consumer.events).toEqual([
      "cancel",
      {
        republish: "visits--visit-worker",
        receipt: "waiting",
        headers: { "x-delivery-attempt": 5 },
      },
      { ack: "waiting" },
      "close",
    ]);
    await expect(consumer.closed).resolves.toEqual({ fatal: false });
    // After the drain began, a delivery is never handled or acked: it returns to its queue.
    consumer.deliver("late");
    await vi.advanceTimersByTimeAsync(1000);
    expect(consumer.events.at(-1)).toBe("close");
  });

  it("waits for a message in hand before closing the channel", async () => {
    let finish!: () => void;
    const { scope, consumer } = await started(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    consumer.deliver("slow");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    let stopped = false;
    const stopping = scope.stop().then(() => {
      stopped = true;
    });
    await vi.waitFor(() => expect(consumer.events).toEqual(["cancel"]));
    expect(stopped).toBe(false);
    finish();
    await stopping;
    expect(consumer.events).toEqual(["cancel", { ack: "slow" }, "close"]);
  });
});

describe("emitted template loops", () => {
  const lifecycle = {
    module: "handler-writer",
    queue: "completion-events--completion-handler",
    failedQueue: "completion-events--completion-handler.failed",
    retryLimit: 10,
  };
  const delivery = (deliveryCount: number) => ({
    messageId: "e1",
    headers: {},
    deliveryCount,
    redelivered: false,
  });
  /** A template's own handling: a parse hook that fails makes the message malformed. */
  const template = (hooks: { event(input: unknown): unknown }) => async (body: Buffer) => {
    try {
      hooks.event(JSON.parse(body.toString()));
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
  };

  it("names the hook a message reached, and sends it to .failed as NOT_IMPLEMENTED", async () => {
    const log = loop.createLoopLog("completion-handler");
    const hooks = loop.watchHooks(
      {
        event() {
          throw new NotImplemented("event for Lifecycle writer");
        },
        job: {
          async construct() {
            throw new NotImplemented("job.construct for Lifecycle writer");
          },
          destination: "jobs",
        },
      },
      log,
      "handler-writer",
    );
    const handle = loop.templateHandler(log, lifecycle, template(hooks));
    // The template's own answer to a failed parse is MALFORMED_MESSAGE; the codec isn't written.
    await expect(handle(Buffer.from("{}"), delivery(1))).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
    });
    expect(lines).toEqual([
      {
        level: "warn",
        event: "not-implemented",
        tile: "completion-handler",
        module: "handler-writer",
        what: "event for Lifecycle writer",
        queue: "completion-events--completion-handler",
        messageId: "e1",
        action: "sent to completion-events--completion-handler.failed (NOT_IMPLEMENTED)",
      },
    ]);
    // Values pass through; an async hook outside a message logs at once.
    expect(hooks.job.destination).toBe("jobs");
    await expect(hooks.job.construct()).rejects.toThrow("Not implemented: job.construct");
    expect(lines.at(-1)).toMatchObject({
      what: "job.construct for Lifecycle writer",
      action: "thrown",
    });
  });

  it("dead-letters an unwritten codec as NOT_IMPLEMENTED on the real runner, bad input as MALFORMED_MESSAGE", async () => {
    const { createConsumer } = await import(moduleUrl("amqp"));
    const log = loop.createLoopLog("completion-handler");
    const hooks = loop.watchHooks(
      {
        event(input: unknown) {
          if (input === "bad") throw new Error("not an event");
          throw new NotImplemented("event for Lifecycle writer");
        },
      },
      log,
      "handler-writer",
    );
    const consumer: Consumer = await createConsumer(
      {},
      {
        ...lifecycle,
        concurrency: 1,
        handle: loop.templateHandler(log, lifecycle, async (body: Buffer) => {
          try {
            hooks.event(body.toString());
          } catch {
            throw new NonRetryable("MALFORMED_MESSAGE");
          }
        }),
      },
    );
    consumer.deliver("good");
    await settled(consumer, "good");
    consumer.deliver("bad");
    await settled(consumer, "bad");
    const dead = (receipt: string, code: string) => ({
      republish: lifecycle.failedQueue,
      receipt,
      headers: { "x-delivery-attempt": 1, "x-terminal-code": code },
    });
    expect(consumer.events).toEqual([
      dead("good", "NOT_IMPLEMENTED"),
      { ack: "good" },
      dead("bad", "MALFORMED_MESSAGE"),
      { ack: "bad" },
    ]);
    expect(lines.map((line) => [line.event, line.action])).toEqual([
      ["not-implemented", `sent to ${lifecycle.failedQueue} (NOT_IMPLEMENTED)`],
      ["loop-error", `sent to ${lifecycle.failedQueue} (MALFORMED_MESSAGE)`],
    ]);
  });

  it("keeps a template's own code; an unwritten effect hook is terminal at once (review row 7)", async () => {
    const log = loop.createLoopLog("transcoder");
    const unwritten = loop.watchHooks(
      {
        async owns() {
          throw new NotImplemented("source.owns for Video encoder");
        },
      },
      log,
      "transcoder-encoder",
    );
    // A specific code (the media worker's INVALID_MEDIA) is the template's decision.
    const media = loop.templateHandler(log, lifecycle, async () => {
      await unwritten.owns().catch(() => {});
      throw new NonRetryable("INVALID_MEDIA");
    });
    await expect(media(Buffer.from("{}"), delivery(1))).rejects.toMatchObject({
      code: "INVALID_MEDIA",
    });
    // An effect hook's failure would retry within the template's limit; unwritten, a retry can't
    // write it, so it is NOT_IMPLEMENTED on its first delivery.
    const effect = loop.templateHandler(log, { ...lifecycle, module: "effect" }, async () => {
      await unwritten.owns();
    });
    await expect(effect(Buffer.from("{}"), delivery(1))).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
    });
    expect(lines.map((line) => [line.module, line.action])).toEqual([
      ["handler-writer", `sent to ${lifecycle.failedQueue} (INVALID_MEDIA)`],
      ["effect", `sent to ${lifecycle.failedQueue} (NOT_IMPLEMENTED)`],
    ]);
    // Any other failure still retries within the template's limit.
    const down = loop.templateHandler(log, { ...lifecycle, module: "down" }, async () => {
      throw new Error("database down");
    });
    await expect(down(Buffer.from("{}"), delivery(1))).rejects.toThrow("database down");
    expect(lines.at(-1)).toMatchObject({ module: "down", action: "retry 1 of 10" });
  });

  it("dead-letters an unwritten effect hook on its first delivery on the real runner", async () => {
    const log = loop.createLoopLog("completion-handler");
    const hooks = loop.watchHooks(
      {
        async construct() {
          throw new NotImplemented("job.construct for Lifecycle writer");
        },
      },
      log,
      "handler-writer",
    );
    const scope = testScope();
    // A template's consumer on its loop row (the queue its process config names).
    const consumer: Consumer = await loop.loopConsumer(
      { ...lifecycle, queue: "completion-events--handler-writer", concurrency: 2 },
      loop.templateHandler(log, lifecycle, async () => {
        await hooks.construct();
      }),
      { onFatal: scope.fail },
      broker,
    );
    expect(consumer.binding).toMatchObject({ hostname: "local-broker" });
    expect(consumer.options).toMatchObject({
      queue: "completion-events--handler-writer",
      failedQueue: lifecycle.failedQueue,
      concurrency: 2,
      retryLimit: 10,
      onFatal: scope.fail,
    });
    consumer.deliver("job-1");
    await settled(consumer, "job-1");
    expect(consumer.events).toEqual([
      {
        republish: lifecycle.failedQueue,
        receipt: "job-1",
        headers: { "x-delivery-attempt": 1, "x-terminal-code": "NOT_IMPLEMENTED" },
      },
      { ack: "job-1" },
    ]);
    await consumer.close();
  });

  it("logs an unreachable store as a wait that keeps the attempt, past the template's limit", async () => {
    const log = loop.createLoopLog("completion-handler");
    const lost = Object.assign(new Error("terminating connection due to administrator command"), {
      code: "57P01",
    });
    const handle = loop.templateHandler(log, lifecycle, async () => {
      throw lost;
    });
    // Rethrown unchanged, so the runner sees it and waits.
    await expect(handle(Buffer.from("{}"), delivery(11))).rejects.toBe(lost);
    expect(lines).toEqual([
      {
        level: "error",
        event: "loop-error",
        tile: "completion-handler",
        module: "handler-writer",
        queue: lifecycle.queue,
        messageId: "e1",
        attempt: 11,
        error: "Error: terminating connection due to administrator command",
        action: "store unreachable, retry in 5000 ms (attempt not counted)",
      },
    ]);
  });

  it("logs another failure with what the template's limit does next", async () => {
    const log = loop.createLoopLog("completion-handler");
    const handle = loop.templateHandler(log, lifecycle, async () => {
      throw new Error("database down");
    });
    await expect(handle(Buffer.from("{}"), delivery(3))).rejects.toThrow("database down");
    await expect(handle(Buffer.from("{}"), delivery(11))).rejects.toThrow("database down");
    expect(lines.map((line) => [line.event, line.attempt, line.action])).toEqual([
      ["loop-error", 3, "retry 3 of 10"],
    ]);
    // Rate-limited per module and queue: the exhausted one, a moment later, was held back.
    expect(lines).toHaveLength(1);
  });
});

describe("emitted started line", () => {
  it("logs one info line per template, never rate limited", () => {
    const entry = {
      module: "counter-sum",
      template: "event-counter",
      wiring: "mounted",
      checks: ["SELECT 1 on its state login", "subscribed view-events--view-counter"],
    };
    logStarted("view-counter", entry);
    logStarted("view-counter", entry);
    expect(lines).toEqual([
      ...Array(2).fill({
        level: "info",
        event: "started",
        tile: "view-counter",
        module: "counter-sum",
        template: "event-counter",
        wiring: "mounted",
        checks: ["SELECT 1 on its state login", "subscribed view-events--view-counter"],
      }),
    ]);
  });
});

describe("emitted failure line", () => {
  it("logs what failed and why, once a second for each", () => {
    const failure = createFailureLog("t");
    failure("x", new Error("y"));
    failure("x", new Error("y"));
    failure("multipart start upload-multipart", new TypeError("z".repeat(400)), { upload: "u-1" });
    expect(lines).toEqual([
      { level: "error", event: "failure", tile: "t", what: "x", error: "Error: y" },
      {
        level: "error",
        event: "failure",
        tile: "t",
        what: "multipart start upload-multipart",
        error: `TypeError: ${"z".repeat(289)}`,
        upload: "u-1",
      },
    ]);
  });
});

// QG08: the stub stack with Visits on Google Cloud, so Visit consumer's loop consumes its tile's
// Pub/Sub subscription. The exact emitted module-clients.ts runs on the real tile-loop.ts and
// delivery.ts above, with a fake official client: each subscription is an event emitter the test
// drives, and every call the client is asked for is recorded in order.
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
type FakeSubscription = import("node:events").EventEmitter & {
  name: string;
  options: unknown;
};
type PubsubFake = {
  calls: unknown[][];
  subscriptions: FakeSubscription[];
  exists: () => Promise<[boolean]>;
  metadata?: () => Promise<unknown>;
  publish: (message: { data: Buffer; attributes: Record<string, string> }) => Promise<string>;
};
const pubsubFake: PubsubFake = {
  calls: [],
  subscriptions: [],
  exists: async () => [true],
  publish: async () => "copy-1",
};
(globalThis as { pubsubLoopFake?: PubsubFake }).pubsubLoopFake = pubsubFake;
const fakeSdk = `import { EventEmitter } from "node:events";
  const fake = globalThis.pubsubLoopFake;
  // The client's Duration (temporal.ts in 6.3.2): milliseconds, read back in a unit.
  export class Duration {
    constructor(millis) { this.millis = millis; }
    static from(like) { return new Duration((like.seconds ?? 0) * 1000 + (like.milliseconds ?? 0)); }
    totalOf(unit) {
      if (unit !== "second") throw new Error("Unit not faked: " + unit);
      return this.millis / 1000;
    }
  }
  export class PubSub {
    constructor(options) { fake.calls.push(["PubSub", options]); }
    subscription(name, options) {
      const subscription = Object.assign(new EventEmitter(), {
        name,
        options,
        isOpen: true,
        getMetadata: () => { fake.calls.push(["metadata", name]); return fake.metadata?.() ?? Promise.resolve([{}]); },
        exists: () => (fake.calls.push(["exists", name]), fake.exists()),
        close: async () => {
          fake.calls.push(["close subscription", name]);
          subscription.emit("close");
        },
      });
      subscription.on("newListener", (event) => {
        if (event === "message") fake.calls.push(["stream", name]);
      });
      fake.subscriptions.push(subscription);
      return subscription;
    }
    topic(name, options) {
      fake.calls.push(["topic", name, options]);
      return {
        publishMessage: (message) => {
          fake.calls.push(["publish", name, message.data.toString(), message.attributes]);
          return fake.publish(message);
        },
      };
    }
    async close() { fake.calls.push(["close client"]); }
  }`;
const emittedClients = stripTypeScriptTypes(
  new TextDecoder().decode(
    pubsubBundle.files.find((file) => file.path === "src/runtime/module-clients.ts")?.bytes,
  ),
);
// The runtime files it shares with the loop are the real ones; every other import (the other
// stores' libraries, unused here) is a stand-in that only exports its names.
const pubsubClients = await import(
  dataUrl(
    emittedClients.replace(
      /import\s*\{([^}]*)\}\s*from\s*"([^"]+)";/g,
      (statement, names: string, from: string) => {
        const runtime = /^\.\/(delivery|tile-loop|tile-process|operation|process)\.ts$/.exec(
          from,
        )?.[1];
        if (runtime) return statement.replace(`"${from}"`, `"${moduleUrl(runtime)}"`);
        if (from === "@google-cloud/pubsub")
          return statement.replace(`"${from}"`, `"${dataUrl(fakeSdk)}"`);
        if (from.startsWith("node:")) return statement;
        const exported = names
          .split(",")
          .map((name) => name.trim().split(/\s+as\s+/)[0])
          .filter(Boolean)
          .map((name) => `export const ${name} = () => { throw new Error("unused"); };`);
        return statement.replace(`"${from}"`, `"${dataUrl(exported.join("\n"))}"`);
      },
    ),
  )
);
const { brokerState } = await import(moduleUrl("tile-process"));
const { Duration: FakeDuration } = await import(dataUrl(fakeSdk));

describe("emitted Pub/Sub stub loops (QG08)", () => {
  const visitsLoop = { ...visits, concurrency: 3 };
  let project: string | undefined;
  beforeEach(() => {
    project = process.env.JEEVES_PUBSUB_PROJECT;
    process.env.JEEVES_PUBSUB_PROJECT = "local";
    pubsubFake.calls.length = 0;
    pubsubFake.subscriptions.length = 0;
    pubsubFake.exists = async () => [true];
    pubsubFake.metadata = undefined;
    pubsubFake.publish = async () => "copy-1";
  });
  afterEach(() => {
    if (project === undefined) delete process.env.JEEVES_PUBSUB_PROJECT;
    else process.env.JEEVES_PUBSUB_PROJECT = project;
  });
  const probes: Record<string, unknown>[] = [];
  const probe = Object.assign((entry: Record<string, unknown>) => probes.push(entry), {
    tile: "visit-worker",
  });
  /** A message as the official client hands it over; ack and nack are recorded in order. */
  function message(
    id: string,
    options: { attributes?: Record<string, string>; deliveryAttempt?: number } = {},
  ) {
    const { attributes = { messageId: id }, deliveryAttempt = 1 } = options;
    return {
      id: `server-${id}`,
      data: Buffer.from(`body of ${id}`),
      attributes,
      deliveryAttempt,
      ack: () => pubsubFake.calls.push(["ack", id]),
      nack: () => pubsubFake.calls.push(["nack", id]),
    };
  }
  /** Visit consumer's loop as its process starts it, with the process's own state hook. */
  async function pubsubStarted(entry: (message: unknown) => Promise<void>, bounds = visitsLoop) {
    probes.length = 0;
    const scope = testScope();
    const log = loop.createLoopLog("visit-worker");
    const failure = createFailureLog("visit-worker");
    const consumer = await loop.startModuleLoop(
      scope,
      log,
      bounds,
      entry,
      brokerState("visit-worker", failure, `broker consume ${bounds.queue}`),
      pubsubClients.pubsubLoop(probe),
    );
    const subscription = () => {
      const current = pubsubFake.subscriptions.at(-1);
      if (!current) throw new Error("No subscription");
      return current;
    };
    const deliver = (item: ReturnType<typeof message>) => subscription().emit("message", item);
    return { scope, consumer, subscription, deliver };
  }
  const handled = (id: string) =>
    vi.waitFor(() => {
      if (
        !pubsubFake.calls.some(
          (call) => (call[0] === "ack" || call[0] === "nack") && call[1] === id,
        )
      )
        throw new Error(`${id} not settled yet`);
    });
  const after = (index: number) => pubsubFake.calls.slice(index);

  it("RG14 uses actual metadata reads and stream state to clear required Pub/Sub loss without message traffic", async () => {
    vi.useFakeTimers();
    const operation = await import(moduleUrl("operation"));
    const unavailable = new Set<object>();
    const stops: (() => void)[] = [];
    const scope = {
      signal: new AbortController().signal,
      admission: (stop: () => void) => stops.push(stop),
      dependencyReady(resource: object, ready: boolean) {
        if (ready) unavailable.delete(resource);
        else unavailable.add(resource);
      },
    };
    const transport = pubsubClients.pubsubLoop(probe);
    const consumer = await operation.withProcess(scope, () =>
      transport.open({ ...visitsLoop, handle: async () => {} }),
    );
    const current = pubsubFake.subscriptions.at(-1);
    if (!current) throw Error("Missing subscription");
    current.emit("error", Error("Transient stream unavailable"));
    expect(unavailable.size).toBe(1);
    pubsubFake.metadata = async () => {
      throw Error("Provider down");
    };
    await vi.advanceTimersByTimeAsync(5000);
    expect(unavailable.size).toBe(2);
    pubsubFake.metadata = async () => [{}];
    await vi.advanceTimersByTimeAsync(5000);
    expect(unavailable.size).toBe(0);
    expect(pubsubFake.calls.filter((call) => call[0] === "metadata")).toHaveLength(2);
    for (const stop of stops) stop();
    await consumer.close();
    await vi.advanceTimersByTimeAsync(10000);
    expect(pubsubFake.calls.filter((call) => call[0] === "metadata")).toHaveLength(2);
  });

  it("streams its tile's subscription once it exists, holding at most its Concurrency in hand", async () => {
    const { scope, consumer } = await pubsubStarted(async () => {});
    expect(pubsubFake.calls).toEqual([
      [
        "PubSub",
        {
          projectId: "local",
          "grpc.initial_reconnect_backoff_ms": 500,
          "grpc.max_reconnect_backoff_ms": 2000,
        },
      ],
      [
        "topic",
        "visits--visit-worker.failed",
        { gaxOpts: { timeout: 2000, retry: null, maxRetries: 0 } },
      ],
      ["exists", "visits--visit-worker"],
      ["stream", "visits--visit-worker"],
    ]);
    expect(pubsubFake.subscriptions).toHaveLength(1);
    // QG27: the client's lease is at least the subscription's own 60 s ack deadline.
    const options = pubsubFake.subscriptions[0]?.options as { minAckDeadline?: unknown };
    expect(options).toEqual({
      flowControl: { maxMessages: 3, allowExcessMessages: false },
      minAckDeadline: FakeDuration.from({ seconds: 60 }),
    });
    expect(options.minAckDeadline).toBeInstanceOf(FakeDuration);
    expect((options.minAckDeadline as { totalOf(unit: string): number }).totalOf("second")).toBe(
      60,
    );
    expect(probes).toEqual([
      {
        level: "info",
        client: "visits--visit-worker",
        kind: "queue",
        check: "the Pub/Sub subscription exists",
        result: "ok",
      },
    ]);
    // Startup reports the consumer available once, as a broker consumer does.
    expect(lines).toEqual([
      {
        level: "info",
        event: "broker",
        tile: "visit-worker",
        what: "broker consume visits--visit-worker",
        state: "available",
      },
    ]);
    expect(scope.owned).toHaveLength(1);
    expect(scope.transport).toHaveBeenCalledWith(
      expect.objectContaining({ closed: consumer.closed }),
    );
    await scope.stop();
    await expect(consumer.closed).resolves.toEqual({ fatal: false });
  });

  it("gives the module each message's bytes, ID, attributes, attempt and subscription, and acks only after it resolves", async () => {
    const received: unknown[] = [];
    let finish!: () => void;
    const { scope, deliver } = await pubsubStarted(async (item) => {
      received.push(item);
      if (received.length === 1)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
    });
    const start = pubsubFake.calls.length;
    deliver(message("a", { attributes: { messageId: "a", trace: "t" }, deliveryAttempt: 2 }));
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(after(start)).toEqual([]);
    finish();
    await handled("a");
    expect(after(start)).toEqual([["ack", "a"]]);
    // With no messageId attribute, the message's ID is Pub/Sub's own.
    deliver(message("b", { attributes: {} }));
    await handled("b");
    expect(
      received.map((value: unknown) => {
        const { context, ...message } = value as { context: unknown };
        expect(context).toMatchObject({
          signal: expect.any(AbortSignal),
          remainingMs: expect.any(Function),
        });
        return message;
      }),
    ).toEqual([
      {
        body: Buffer.from("body of a"),
        messageId: "a",
        headers: { messageId: "a", trace: "t" },
        attempt: 2,
        source: "visits--visit-worker",
      },
      {
        body: Buffer.from("body of b"),
        messageId: "server-b",
        headers: {},
        attempt: 1,
        source: "visits--visit-worker",
      },
    ]);
    expect(lines.filter((line) => line.event !== "broker")).toEqual([]);
    await scope.stop();
  });

  it("nacks another error at once, for the subscription to space, until a failure on attempt 6 ends in .failed as RETRY_EXHAUSTED", async () => {
    vi.useFakeTimers();
    const { scope, deliver } = await pubsubStarted(async () => {
      throw new TypeError("boom");
    });
    const start = pubsubFake.calls.length;
    deliver(message("first"));
    await vi.advanceTimersByTimeAsync(0);
    // No retryDelay wait: the subscription's retry policy spaces the redelivery.
    expect(after(start)).toEqual([["nack", "first"]]);
    expect(lines.at(-1)).toEqual({
      level: "error",
      event: "loop-error",
      tile: "visit-worker",
      module: "visit-consumer",
      queue: "visits--visit-worker",
      messageId: "first",
      attempt: 1,
      error: "TypeError: boom",
      action: "retry 1 of 5",
    });
    // Delivery attempt 5 is the last retry, as a RabbitMQ loop's fifth delivery is.
    deliver(message("fifth", { deliveryAttempt: 5 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(after(start).at(-1)).toEqual(["nack", "fifth"]);
    const sixth = pubsubFake.calls.length;
    deliver(
      message("sixth", { attributes: { messageId: "sixth", trace: "t" }, deliveryAttempt: 6 }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(after(sixth)).toEqual([
      [
        "publish",
        "visits--visit-worker.failed",
        "body of sixth",
        { messageId: "sixth", trace: "t", "x-terminal-code": "RETRY_EXHAUSTED" },
      ],
      ["ack", "sixth"],
    ]);
    expect(scope.fail).not.toHaveBeenCalled();
    await scope.stop();
  });

  it('sends "Not implemented" and a NonRetryable to .failed with their attributes, acking each once Pub/Sub has the copy', async () => {
    const { scope, deliver } = await pubsubStarted(async (item) => {
      if ((item as { messageId: string }).messageId === "bad")
        throw new NonRetryable("MALFORMED_MESSAGE");
      throw new Error("Not implemented: Visit consumer");
    });
    let publish!: (id: string) => void;
    pubsubFake.publish = () =>
      new Promise<string>((resolve) => {
        publish = resolve;
      });
    const start = pubsubFake.calls.length;
    deliver(message("m1", { attributes: { messageId: "m1", trace: "t" } }));
    await vi.waitFor(() => expect(publish).toBeTypeOf("function"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Not acknowledged before the copy is.
    expect(after(start)).toEqual([
      [
        "publish",
        "visits--visit-worker.failed",
        "body of m1",
        { messageId: "m1", trace: "t", "x-terminal-code": "NOT_IMPLEMENTED" },
      ],
    ]);
    publish("copy-1");
    await handled("m1");
    expect(after(start).at(-1)).toEqual(["ack", "m1"]);
    expect(lines.at(-1)).toMatchObject({
      event: "not-implemented",
      action: "sent to visits--visit-worker.failed (NOT_IMPLEMENTED)",
    });
    pubsubFake.publish = async () => "copy-2";
    const bad = pubsubFake.calls.length;
    deliver(message("bad"));
    await handled("bad");
    expect(after(bad)).toEqual([
      [
        "publish",
        "visits--visit-worker.failed",
        "body of bad",
        { messageId: "bad", "x-terminal-code": "MALFORMED_MESSAGE" },
      ],
      ["ack", "bad"],
    ]);
    await scope.stop();
  });

  it("nacks a terminal message whose .failed copy fails or misses its 2000 ms deadline, telling the state hook", async () => {
    vi.useFakeTimers();
    const { scope, deliver } = await pubsubStarted(async () => {
      throw new Error("Not implemented: Visit consumer");
    });
    pubsubFake.publish = () => Promise.reject(new Error("14 UNAVAILABLE"));
    const start = pubsubFake.calls.length;
    deliver(message("m1"));
    await vi.advanceTimersByTimeAsync(0);
    expect(after(start).map((call) => call[0])).toEqual(["publish", "nack"]);
    expect(lines.at(-1)).toEqual({
      level: "error",
      event: "failure",
      tile: "visit-worker",
      what: "broker consume visits--visit-worker",
      error: "Error: 14 UNAVAILABLE",
    });
    // A copy Pub/Sub never answers is given up after 2000 ms, and the message is nacked.
    pubsubFake.publish = () => new Promise<string>(() => {});
    const hung = pubsubFake.calls.length;
    deliver(message("m2"));
    await vi.advanceTimersByTimeAsync(1999);
    expect(after(hung).map((call) => call[0])).toEqual(["publish"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(after(hung)).toEqual([
      ["publish", "visits--visit-worker.failed", "body of m2", expect.any(Object)],
      ["nack", "m2"],
    ]);
    expect(pubsubFake.calls.some((call) => call[0] === "ack")).toBe(false);
    expect(scope.fail).not.toHaveBeenCalled();
    await scope.stop();
  });

  it("keeps a message whose store is unreachable and runs it again 5 s later with the same attempt", async () => {
    vi.useFakeTimers();
    const received: unknown[] = [];
    const { scope, deliver } = await pubsubStarted(async (item) => {
      received.push(item);
      if (received.length < 3)
        throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    });
    const start = pubsubFake.calls.length;
    deliver(message("lost", { deliveryAttempt: 4 }));
    await vi.advanceTimersByTimeAsync(4999);
    expect(received).toHaveLength(1);
    expect(after(start)).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(received).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(5000);
    // The third run resolves: one ack, never a nack, and the attempt never moved.
    expect(after(start)).toEqual([["ack", "lost"]]);
    expect(received).toEqual(
      Array(3).fill(expect.objectContaining({ messageId: "lost", attempt: 4 })),
    );
    expect(lines.filter((line) => line.event === "loop-error")).toEqual([
      {
        level: "error",
        event: "loop-error",
        tile: "visit-worker",
        module: "visit-consumer",
        queue: "visits--visit-worker",
        messageId: "lost",
        attempt: 4,
        error: "Error: connect ECONNREFUSED",
        action: "store unreachable, retry in 5000 ms (attempt not counted)",
      },
      expect.objectContaining({
        attempt: 4,
        action: "store unreachable, retry in 5000 ms (attempt not counted)",
      }),
    ]);
    await scope.stop();
  });

  it("nacks a message waiting on its store when the loop closes, then closes the subscription and the client", async () => {
    vi.useFakeTimers();
    const { scope, consumer, deliver } = await pubsubStarted(async () => {
      throw new Error("Connection terminated unexpectedly");
    });
    const start = pubsubFake.calls.length;
    deliver(message("waiting"));
    await vi.advanceTimersByTimeAsync(10);
    expect(after(start)).toEqual([]);
    // No timer advances: stopping alone ends the 5 s wait.
    await scope.stop();
    expect(after(start)).toEqual([
      ["nack", "waiting"],
      ["close subscription", "visits--visit-worker"],
      ["close client"],
    ]);
    await expect(consumer.closed).resolves.toEqual({ fatal: false });
  });

  it("drains: takes no new message, lets the one in hand settle, then closes the subscription and the client", async () => {
    let finish!: () => void;
    const received: string[] = [];
    const { scope, deliver } = await pubsubStarted(async (item) => {
      received.push((item as { messageId: string }).messageId);
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    const start = pubsubFake.calls.length;
    deliver(message("slow"));
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    let stopped = false;
    const stopping = scope.stop().then(() => {
      stopped = true;
    });
    // Arriving while it drains, a message is left to the client, which nacks it as it closes.
    deliver(message("late"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    expect(after(start)).toEqual([]);
    finish();
    await stopping;
    expect(received).toEqual(["slow"]);
    expect(after(start)).toEqual([
      ["ack", "slow"],
      ["close subscription", "visits--visit-worker"],
      ["close client"],
    ]);
  });

  it("reports a subscriber error once and opens a subscriber that closed on one again 5 s later; the process never stops for it", async () => {
    vi.useFakeTimers();
    const { scope, subscription, deliver } = await pubsubStarted(async () => {});
    const first = subscription();
    first.emit("error", new Error("13 INTERNAL: stream reset"));
    first.emit("error", new Error("13 INTERNAL: stream reset"));
    expect(lines.filter((line) => line.event === "failure")).toEqual([
      {
        level: "error",
        event: "failure",
        tile: "visit-worker",
        what: "broker consume visits--visit-worker",
        error: "Error: 13 INTERNAL: stream reset",
      },
    ]);
    // It streams again: one available line. (A second later, so the failure log's once-a-second
    // limit holds back nothing below.)
    deliver(message("m1"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(lines.at(-1)).toMatchObject({ event: "broker", state: "available" });
    // A subscriber that closes on an error (here NOT_FOUND, while setup creates it again).
    pubsubFake.exists = async () => [false];
    const start = pubsubFake.calls.length;
    first.emit("error", new Error("5 NOT_FOUND: Subscription does not exist"));
    first.emit("close");
    expect(lines.at(-1)).toMatchObject({
      event: "failure",
      error: "Error: 5 NOT_FOUND: Subscription does not exist",
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(after(start)).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    // Its check fails, so it tries again 5 s later, and then streams.
    expect(after(start)).toEqual([["exists", "visits--visit-worker"]]);
    pubsubFake.exists = async () => [true];
    await vi.advanceTimersByTimeAsync(5000);
    expect(after(start)).toEqual([
      ["exists", "visits--visit-worker"],
      ["exists", "visits--visit-worker"],
      ["stream", "visits--visit-worker"],
    ]);
    expect(lines.at(-1)).toMatchObject({ event: "broker", state: "available" });
    // The lost subscriber takes no message; the new one does.
    first.emit("message", message("old"));
    deliver(message("new"));
    await vi.advanceTimersByTimeAsync(0);
    expect(after(start).filter((call) => call[0] === "ack")).toEqual([["ack", "new"]]);
    expect(subscription()).not.toBe(first);
    expect(subscription().options).toEqual(first.options);
    expect(scope.fail).not.toHaveBeenCalled();
    await scope.stop();
  });

  it("fails startup when its subscription is missing or its project invalid, closing its client", async () => {
    pubsubFake.exists = async () => [false];
    await expect(pubsubStarted(async () => {})).rejects.toThrow(
      "Startup probe failed: queue visits--visit-worker",
    );
    expect(probes).toEqual([
      {
        level: "error",
        client: "visits--visit-worker",
        kind: "queue",
        check: "the Pub/Sub subscription exists",
        result: "failed",
        error: "Error: Pub/Sub subscription visits--visit-worker not found",
      },
    ]);
    expect(pubsubFake.calls.at(-1)).toEqual(["close client"]);
    expect(pubsubFake.calls.some((call) => call[0] === "stream")).toBe(false);
    process.env.JEEVES_PUBSUB_PROJECT = "Not a project";
    pubsubFake.calls.length = 0;
    await expect(pubsubStarted(async () => {})).rejects.toThrow(
      "Invalid endpoint JEEVES_PUBSUB_PROJECT",
    );
    expect(pubsubFake.calls).toEqual([]);
  });

  it("with JEEVES_REQUIRE_TLS=true refuses a Pub/Sub emulator before any client (QG10)", async () => {
    const saved = ["JEEVES_REQUIRE_TLS", "PUBSUB_EMULATOR_HOST"].map(
      (name) => [name, process.env[name]] as const,
    );
    try {
      process.env.JEEVES_REQUIRE_TLS = "true";
      for (const emulator of ["local-pubsub:8085", ""]) {
        process.env.PUBSUB_EMULATOR_HOST = emulator;
        pubsubFake.calls.length = 0;
        await expect(pubsubStarted(async () => {})).rejects.toThrow(
          /^Insecure endpoint PUBSUB_EMULATOR_HOST$/,
        );
        expect(pubsubFake.calls).toEqual([]);
      }
      process.env.JEEVES_REQUIRE_TLS = "on";
      await expect(pubsubStarted(async () => {})).rejects.toThrow(
        /^Invalid endpoint JEEVES_REQUIRE_TLS$/,
      );
      expect(pubsubFake.calls).toEqual([]);
    } finally {
      for (const [name, value] of saved)
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
  });
});

const operationRuntime = await import(moduleUrl("operation"));
describe("RG03 delivery budgets and unknown outcomes", () => {
  it("gives queued work a fresh execution budget after its originating request has expired", async () => {
    vi.useFakeTimers();
    const originating = operationRuntime.operation({ maximumMs: 1000, correlationId: "origin-1" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(originating.context.remainingMs()).toBe(0);
    let received:
      | { context: { remainingMs(): number; correlationId: string; requestId: string } }
      | undefined;
    const handler = loop.moduleHandler(
      loop.createLoopLog("worker"),
      visits,
      async (message: typeof received) => {
        received = message;
      },
      new AbortController().signal,
    );
    await handler(Buffer.from("work"), {
      messageId: "event-1",
      deliveryCount: 1,
      redelivered: false,
      headers: { correlationId: "origin-1", remainingMs: 0 },
    });
    expect(received?.context.remainingMs()).toBeGreaterThan(29900);
    expect(received?.context.correlationId).toBe("origin-1");
    expect(received?.context.requestId).not.toBe(originating.context.requestId);
    originating.close();
  });

  it("routes uncertain publish/commit effects to terminal OUTCOME_UNKNOWN without blind retry or store wait", async () => {
    const unknown = new operationRuntime.OperationError("unknown", "COMMIT_RESPONSE_LOST", {
      cause: Object.assign(new Error("socket lost"), { code: "ECONNRESET" }),
    });
    const entry = vi.fn(async () => {
      throw unknown;
    });
    const { scope, consumer } = await started(entry);
    consumer.deliver("uncertain");
    await settled(consumer, "uncertain");
    expect(entry).toHaveBeenCalledOnce();
    expect(consumer.events).toEqual([
      {
        republish: visits.failedQueue,
        receipt: "uncertain",
        headers: { "x-terminal-code": "OUTCOME_UNKNOWN", "x-delivery-attempt": 1 },
      },
      { ack: "uncertain" },
    ]);
    expect(loop.failureStep(unknown, 1, 5)).toEqual({ step: "terminal", code: "OUTCOME_UNKNOWN" });
    const template = loop.templateHandler(loop.createLoopLog("worker"), visits, async () => {
      throw unknown;
    });
    await expect(
      template(Buffer.from("work"), {
        messageId: "x",
        deliveryCount: 1,
        redelivered: false,
        headers: {},
      }),
    ).rejects.toMatchObject({ code: "OUTCOME_UNKNOWN" });
    await scope.stop();
  });
});
