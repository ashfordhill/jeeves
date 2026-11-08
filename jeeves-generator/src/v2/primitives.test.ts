import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it, vi } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
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
