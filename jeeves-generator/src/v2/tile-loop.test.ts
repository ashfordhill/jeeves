import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const { NotImplemented } = await import(moduleUrl("tile-process"));

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
  await loop.startModuleLoop(scope, log, bounds, entry);
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
    expect(received).toEqual([
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

  it("names the hook a message reached, and leaves the template's own decision", async () => {
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
    await expect(handle(Buffer.from("{}"), delivery(1))).rejects.toMatchObject({
      code: "MALFORMED_MESSAGE",
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
        action: "sent to completion-events--completion-handler.failed (MALFORMED_MESSAGE)",
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
