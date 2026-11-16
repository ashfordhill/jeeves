import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it, vi } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Dependencies as loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

// Exercise the exact emitted dependency-free cores. Field SDK imports stay outside this
// workspace; Fastify/jose/amqplib adapters are compiled/probed in a standalone export.
async function core(name: string) {
  const bytes = readFileSync(
    new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
    "utf8",
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(bytes)).toString("base64")}`
  );
}
const admissionCore = await core("admission");
const deliveryCore = await core("delivery");
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("emitted runtime primitives", () => {
  it("retains timed-out admission until the effect settles and drains before dependencies close", async () => {
    vi.useFakeTimers();
    try {
      const admission = admissionCore.createAdmission({
        requestTimeoutMs: 10,
        concurrencyLimit: 1,
      });
      admission.open();
      const effect = deferred();
      const timedOut = expect(admission.run(() => effect.promise)).rejects.toMatchObject({
        code: "DEADLINE",
      });
      await vi.advanceTimersByTimeAsync(10);
      await timedOut;
      await expect(admission.run(async () => {})).rejects.toMatchObject({ code: "OVERLOADED" });
      admission.stop();
      await expect(admission.run(async () => {})).rejects.toMatchObject({ code: "UNAVAILABLE" });
      let dependenciesClosed = false;
      const drain = admission.drain().then(() => {
        dependenciesClosed = true;
      });
      await Promise.resolve();
      expect(dependenciesClosed).toBe(false);
      effect.resolve();
      await drain;
      expect(dependenciesClosed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("acks only after awaited effects and terminal confirmation, with ordered idempotent drain", async () => {
    const events: string[] = [];
    const effect = deferred();
    const terminal = deferred();
    const confirm = deferred();
    const runner = deliveryCore.createDeliveryRunner({
      queue: "tasks",
      failedQueue: "tasks.failed",
      retryLimit: 1,
      handle: async (_body: Buffer, delivery: { messageId: string }) => {
        if (delivery.messageId === "success") {
          await effect.promise;
          events.push("effect");
        } else throw new deliveryCore.NonRetryable("INVALID_INPUT");
      },
      onTerminal: async () => {
        await terminal.promise;
        events.push("terminal");
      },
      transport: {
        cancel: async () => {
          events.push("cancel");
        },
        republish: async (queue: string) => {
          events.push(queue);
          await confirm.promise;
          events.push("confirm");
        },
        ack: (receipt: string) => {
          events.push(`ack:${receipt}`);
        },
        close: async () => {
          events.push("channel-close", "connection-close");
        },
      },
    });
    for (const id of ["success", "terminal"])
      runner.accept({
        body: Buffer.from("{}"),
        messageId: id,
        receipt: id,
        headers: {},
        redelivered: false,
      });
    await Promise.resolve();
    const close = runner.close();
    expect(runner.close()).toBe(close);
    expect(events).toEqual(["cancel"]);
    effect.resolve();
    terminal.resolve();
    await vi.waitFor(() => expect(events).toContain("tasks.failed"));
    expect(events).toContain("ack:success");
    expect(events).not.toContain("ack:terminal");
    expect(events).not.toContain("channel-close");
    confirm.resolve();
    await close;
    expect(events.slice(-4)).toEqual([
      "confirm",
      "ack:terminal",
      "channel-close",
      "connection-close",
    ]);
    await expect(runner.closed).resolves.toEqual({ fatal: false });
  });

  it("bounds retries and fatal drain never waits on the delivery that initiated it", async () => {
    for (const binding of [
      { queue: "", failedQueue: "tasks.failed", retryLimit: 2 },
      { queue: "tasks", failedQueue: "tasks", retryLimit: 2 },
      { queue: "tasks", failedQueue: "tasks.failed", retryLimit: -1 },
    ])
      expect(() => deliveryCore.validateDeliveryBinding(binding)).toThrow(
        "Invalid delivery binding",
      );
    const events: string[] = [];
    let republished: { queue: string; headers: Record<string, unknown> } | undefined;
    const runner = deliveryCore.createDeliveryRunner({
      queue: "tasks",
      failedQueue: "tasks.failed",
      retryLimit: 2,
      handle: async () => {
        throw new Error("temporary");
      },
      onFatal: () => {
        events.push("fatal");
      },
      transport: {
        cancel: async () => {
          events.push("cancel");
        },
        republish: async (queue: string, _message: unknown, headers: Record<string, unknown>) => {
          republished = { queue, headers };
          throw new Error("confirm lost");
        },
        ack: () => {
          events.push("ack");
        },
        close: async () => {
          events.push("close");
        },
      },
    });
    runner.accept({
      body: Buffer.from("{}"),
      receipt: 1,
      headers: { "x-delivery-attempt": 2 },
      redelivered: true,
    });
    await expect(runner.closed).resolves.toEqual({ fatal: true });
    expect(republished).toMatchObject({
      queue: "tasks.failed",
      headers: { "x-terminal-code": "RETRY_EXHAUSTED" },
    });
    expect(events).toEqual(["fatal", "cancel", "close"]);
  });

  it("tells an unreachable store from a failed message", () => {
    const coded = (code: string) => Object.assign(new Error(code), { code });
    for (const code of [
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ETIMEDOUT",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "EPIPE",
      "08006",
      "08001",
      "57P01",
      "57P03",
    ])
      expect(deliveryCore.unreachable(coded(code)), code).toBe(true);
    for (const message of [
      "Connection terminated unexpectedly",
      "timeout exceeded when trying to connect",
    ])
      expect(deliveryCore.unreachable(new Error(message)), message).toBe(true);
    const twoDeep = new Error("query failed", {
      cause: new Error("client lost", { cause: coded("ECONNRESET") }),
    });
    expect(deliveryCore.unreachable(twoDeep)).toBe(true);
    expect(
      deliveryCore.unreachable(new AggregateError([new Error("other"), coded("ECONNREFUSED")])),
    ).toBe(true);
    for (const error of [
      coded("57014"),
      coded("23505"),
      new Error("boom"),
      new deliveryCore.NonRetryable("MALFORMED_MESSAGE"),
    ])
      expect(deliveryCore.unreachable(error), String(error)).toBe(false);
  });

  it("counts pg's client-side query timeout, exactly, as unreachable", () => {
    // QG17's bound: a query on a stalled database that gets no reply rejects with this message.
    expect(deliveryCore.unreachable(new Error("Query read timeout"))).toBe(true);
    expect(
      deliveryCore.unreachable(
        new Error("query failed", { cause: new Error("Query read timeout") }),
      ),
    ).toBe(true);
    expect(deliveryCore.unreachable(new Error("Query read timeout exceeded"))).toBe(false);
  });

  it("waits out a stalled database with the same attempt; a NonRetryable wrapping the timeout ends the message", async () => {
    vi.useFakeTimers();
    try {
      const events: unknown[] = [];
      const onTerminal = vi.fn();
      const runner = deliveryCore.createDeliveryRunner({
        queue: "tasks",
        failedQueue: "tasks.failed",
        retryLimit: 2,
        handle: async (_body: Buffer, delivery: { messageId: string }) => {
          if (delivery.messageId === "stalled") throw new Error("Query read timeout");
          throw Object.assign(new deliveryCore.NonRetryable("STORE_STALLED"), {
            cause: new Error("Query read timeout"),
          });
        },
        onTerminal,
        transport: {
          cancel: async () => {},
          republish: async (
            queue: string,
            message: { messageId: string },
            headers: Record<string, unknown>,
          ) => {
            events.push({ id: message.messageId, queue, headers });
          },
          ack: (receipt: string) => {
            events.push(`ack:${receipt}`);
          },
          close: async () => {},
        },
      });
      for (const id of ["stalled", "ended"])
        runner.accept({
          body: Buffer.from("{}"),
          messageId: id,
          receipt: id,
          headers: { "x-delivery-attempt": 1 },
          redelivered: true,
        });
      // The NonRetryable is terminal at once; the stalled one is not retried yet.
      await vi.advanceTimersByTimeAsync(4999);
      expect(events).toEqual([
        {
          id: "ended",
          queue: "tasks.failed",
          headers: { "x-delivery-attempt": 2, "x-terminal-code": "STORE_STALLED" },
        },
        "ack:ended",
      ]);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      // After 5 s the stalled one goes back to its own queue with the same attempt.
      await vi.advanceTimersByTimeAsync(1);
      expect(events.slice(2)).toEqual([
        { id: "stalled", queue: "tasks", headers: { "x-delivery-attempt": 1 } },
        "ack:stalled",
      ]);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      await runner.close();
      await expect(runner.closed).resolves.toEqual({ fatal: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells a failed outside fetch from a call to another tile", () => {
    const refused = () =>
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("x"), { code: "ECONNREFUSED" }),
      });
    // An outside call is not a store: it keeps the normal retries.
    const outside = refused();
    expect(deliveryCore.unreachable(outside)).toBe(false);
    // httpTarget marks a call to another tile; that one is unreachable.
    Reflect.set(outside, Symbol.for("jeeves.internal-call"), true);
    expect(deliveryCore.unreachable(outside)).toBe(true);
    // Two causes deep under a pg error, an unmarked failed fetch is still not a store.
    const pgError = Object.assign(
      new Error("query failed", { cause: new Error("handler failed", { cause: refused() }) }),
      { severity: "ERROR", code: "P0001" },
    );
    expect(deliveryCore.unreachable(pgError)).toBe(false);
  });

  it("waits out an unreachable store, keeping the attempt, and close() ends the wait", async () => {
    vi.useFakeTimers();
    try {
      expect(deliveryCore.UNREACHABLE_WAIT_MS).toBe(5000);
      const events: unknown[] = [];
      const onTerminal = vi.fn();
      const runner = deliveryCore.createDeliveryRunner({
        queue: "tasks",
        failedQueue: "tasks.failed",
        retryLimit: 2,
        handle: async () => {
          throw Object.assign(new Error("connect ECONNREFUSED 10.0.0.2:5432"), {
            code: "ECONNREFUSED",
          });
        },
        onTerminal,
        transport: {
          cancel: async () => {
            events.push("cancel");
          },
          republish: async (queue: string, _message: unknown, headers: Record<string, unknown>) => {
            events.push({ queue, headers });
          },
          ack: (receipt: string) => {
            events.push(`ack:${receipt}`);
          },
          close: async () => {
            events.push("close");
          },
        },
      });
      // At the retry limit, yet back on its own queue with the same attempt after 5 s.
      runner.accept({
        body: Buffer.from("{}"),
        receipt: "last",
        headers: { "x-delivery-attempt": 2, trace: "t" },
        redelivered: true,
      });
      await vi.advanceTimersByTimeAsync(4999);
      expect(events).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(events).toEqual([
        { queue: "tasks", headers: { "x-delivery-attempt": 2, trace: "t" } },
        "ack:last",
      ]);
      expect(onTerminal).not.toHaveBeenCalled();
      // close() during the wait: no timer advances, and nothing is republished or acked.
      events.length = 0;
      runner.accept({
        body: Buffer.from("{}"),
        receipt: "waiting",
        headers: { "x-delivery-attempt": 1 },
        redelivered: false,
      });
      await vi.advanceTimersByTimeAsync(10);
      await runner.close();
      expect(events).toEqual(["cancel", "close"]);
      await expect(runner.closed).resolves.toEqual({ fatal: false });
      expect(onTerminal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits dependencies for selected responsibilities without installing business templates", () => {
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: generationSelectionsFixture(),
    });
    const emit = (source = design) =>
      assembleV2({ designJson: JSON.stringify(source) }, loadLocalV2Registry());
    const all = emit();
    const helpers = all.manifest.files.filter(
      (file) => file.owner !== "assembler" && file.owner.id === "local.primitives",
    );
    expect(helpers.map((file) => file.path).sort()).toEqual([
      "src/runtime/admission.ts",
      "src/runtime/amqp.ts",
      "src/runtime/delivery.ts",
      "src/runtime/http.ts",
      "src/runtime/identity.ts",
      "src/runtime/objects.ts",
      "src/runtime/operation.ts",
      "src/runtime/postgres.ts",
      "src/runtime/search.ts",
    ]);
    for (const helper of helpers) {
      const bytes = all.files.find((file) => file.path === helper.path)?.bytes;
      expect(new TextDecoder().decode(bytes)).not.toMatch(
        /youtube|creator|videoId|upload-jobs|search-index:9200/,
      );
    }
    expect(all.report.applicationComplete).toBe(false);
    expect(loadLocalV2Registry().installed.templates).toEqual([]);
    if (design.schemaVersion !== 3 || !design.generation) throw new Error();
    design.generation.selections = design.generation.selections.filter(
      (selection) => selection.id === "ready-reader",
    );
    const minimal = emit();
    expect(minimal.files.some((file) => file.path === "src/runtime/postgres.ts")).toBe(true);
    for (const omitted of ["amqp", "delivery", "identity", "objects", "search"])
      expect(minimal.files.some((file) => file.path === `src/runtime/${omitted}.ts`)).toBe(false);
  });
});
