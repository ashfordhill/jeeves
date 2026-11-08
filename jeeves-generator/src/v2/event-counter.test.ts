import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import {
  counterSchema,
  counterTotalsSelect,
  eventCounterPersistence,
  eventCounterReadAccess,
} from "./event-counter.ts";
import type { V2Emitter } from "./registry.ts";

const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const cached = urls.get(name);
  if (cached) return cached;
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const code = stripTypeScriptTypes(
    readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8"),
  ).replace(
    /from "\.\/(.+)\.ts"/g,
    (_match, dependency: string) => `from "${moduleUrl(dependency)}"`,
  );
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { createEventCounter, createTotalReader } = await import(moduleUrl("event-counter"));
const { transaction } = await import(moduleUrl("transaction"));
const { startCounterWorker } = await import(moduleUrl("counter-worker"));
const { createDeliveryRunner } = await import(moduleUrl("delivery"));
const tables = {
  receipts: { schema: "activity_private", table: "receipts" },
  totals: { schema: "activity_private", table: "totals" },
};
const publicView = { schema: "activity_public", table: "totals" };
type Notice = { notice: { number: number; topic: string }; received: string };
let decodes = 0;
const adapter = {
  event(input: unknown, messageId?: string): Notice {
    decodes++;
    const event = input as Notice;
    if (
      !event?.notice ||
      !Number.isSafeInteger(event.notice.number) ||
      typeof event.notice.topic !== "string" ||
      !Number.isFinite(Date.parse(event.received)) ||
      (messageId !== undefined && messageId !== `notice:${event.notice.number}`)
    )
      throw new Error("Invalid notice wire");
    // Deliberately different normalized shape proves it is never sent to this wire codec again.
    return { notice: { ...event.notice }, received: event.received };
  },
  aggregateKey: (event: Notice) => event.notice.topic,
  eventId: (event: Notice) => `notice:${event.notice.number}`,
  identity: (event: Notice) => ({ number: event.notice.number, topic: event.notice.topic }),
};
const notice = (number = 1, topic = "Manual:A", received = "2026-11-08T12:00:00Z"): Notice => ({
  notice: { number, topic },
  received,
});
async function database() {
  const db = new PGlite();
  await db.exec(
    counterSchema(tables, publicView) +
      `CREATE VIEW activity_public.totals AS ${counterTotalsSelect(tables)};`,
  );
  const query = async (sql: string, values?: unknown[]) => {
    const result = await db.query(sql, values);
    return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
  };
  const pool = {
    async connect() {
      return { query, release() {} };
    },
  };
  return { db, pool, query };
}
describe("emitted receipt counter", () => {
  it("commits one increment per aggregate/event, ignores transport time and preserves case-sensitive non-video keys", async () => {
    const { db, pool, query } = await database();
    const counter = createEventCounter(tables, adapter);
    const read = createTotalReader({
      pool: { query },
      view: publicView,
      key: (key: string) => key,
    });
    const apply = (event: Notice) =>
      transaction(pool, (tx: unknown) => counter.record(tx, counter.parse(event)));
    decodes = 0;
    try {
      expect(await read("Manual:A")).toBe("0");
      expect(await apply(notice())).toBe(true);
      expect(await apply(notice(1, "Manual:A", "2026-11-08T13:00:00Z"))).toBe(false);
      expect(await apply(notice(2))).toBe(true);
      expect(await apply(notice(1, "Manual:B"))).toBe(true); // Event identity is scoped to aggregate.
      expect(await apply(notice(1, "manual:a"))).toBe(true);
      expect(decodes).toBe(5);
      expect(await read("Manual:A")).toBe("2");
      expect(await read("Manual:B")).toBe("1");
      expect(await read("manual:a")).toBe("1");
      await expect(
        transaction(pool, async (tx: unknown) => {
          await counter.record(tx, counter.parse(notice(3)));
          throw new Error("rollback both");
        }),
      ).rejects.toThrow("rollback both");
      expect(await read("Manual:A")).toBe("2");
      expect(
        (await db.query("SELECT event_id FROM activity_private.receipts WHERE event_id='notice:3'"))
          .rows,
      ).toEqual([]);
      const conflicting = createEventCounter(tables, {
        ...adapter,
        identity: (e: Notice) => ({ ...e.notice, changed: true }),
      });
      await expect(
        transaction(pool, (tx: unknown) => conflicting.record(tx, conflicting.parse(notice()))),
      ).rejects.toThrow("Conflicting or incomplete receipt");
      expect(() => counter.parse(notice(1, "bad\nkey"))).toThrow("Invalid durable identity");
      const unbound = createEventCounter(tables, { ...adapter, event: () => notice() });
      expect(() => unbound.parse(notice(), "notice:other")).toThrow("Counter event mismatch");
    } finally {
      await db.close();
    }
  });
  it("awaits commit before delivery ack, drains once and uses finite malformed handling", async () => {
    const { db, pool } = await database();
    const counter = createEventCounter(tables, adapter);
    const events: string[] = [];
    let commit!: () => void, started!: () => void;
    const gate = new Promise<void>((resolve) => {
      commit = resolve;
    });
    const admitted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gatedPool = {
      async connect() {
        const client = await pool.connect();
        return {
          ...client,
          async query(sql: string, values?: unknown[]) {
            if (sql === "COMMIT") {
              started();
              await gate;
            }
            return client.query(sql, values);
          },
        };
      },
    };
    let runner!: ReturnType<typeof createDeliveryRunner>;
    const worker = await startCounterWorker({
      pool: gatedPool,
      counter,
      openConsumer: async (handle: unknown) => {
        runner = createDeliveryRunner({
          queue: "notices",
          failedQueue: "notices.failed",
          retryLimit: 1,
          handle,
          transport: {
            async cancel() {
              events.push("cancel");
            },
            async close() {
              events.push("close");
            },
            async republish(queue: string, _message: unknown, headers: Record<string, unknown>) {
              events.push(`${queue}:${headers["x-terminal-code"]}`);
            },
            ack() {
              events.push("ack");
            },
          },
        });
        return runner;
      },
    });
    try {
      runner.accept({
        body: Buffer.from(JSON.stringify(notice())),
        messageId: "notice:1",
        headers: {},
        redelivered: false,
        receipt: 1,
      });
      await admitted;
      expect(events).toEqual([]);
      const closing = worker.close();
      expect(worker.close()).toBe(closing);
      commit();
      await closing;
      expect(events).toEqual(["cancel", "ack", "close"]);
      expect(await worker.closed).toEqual({ fatal: false });
      const malformed = await startCounterWorker({
        pool,
        counter,
        openConsumer: async (handle: unknown) => {
          runner = createDeliveryRunner({
            queue: "notices",
            failedQueue: "notices.failed",
            retryLimit: 1,
            handle,
            transport: {
              async cancel() {},
              async close() {},
              async republish(queue: string, _message: unknown, headers: Record<string, unknown>) {
                events.push(`${queue}:${headers["x-terminal-code"]}`);
              },
              ack() {
                events.push("malformed-ack");
              },
            },
          });
          return runner;
        },
      });
      runner.accept({
        body: Buffer.from("{}"),
        messageId: "notice:9",
        headers: {},
        redelivered: false,
        receipt: 2,
      });
      await malformed.close();
      expect(events.slice(-2)).toEqual(["notices.failed:MALFORMED_MESSAGE", "malformed-ack"]);
      expect(
        (await db.query("SELECT total::text AS total FROM activity_public.totals")).rows,
      ).toEqual([{ total: "1" }]);
    } finally {
      commit();
      await worker.close();
      await db.close();
    }
  });
  it("contributes explicit private persistence/public view grants and no installed application", () => {
    const generation = generationSelectionsFixture();
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: {
        ...generation,
        preset: undefined,
        selections: generation.selections.filter((s) =>
          ["event-counter", "positive-cache-read", "youtube-watch"].includes(s.binding.kind),
        ),
      },
    });
    const persistence = eventCounterPersistence({
      resource: "view-counts",
      writerHost: "view-counter",
      tables,
      publicView,
      migrationId: "001-counter.sql",
      sourcePaths: ["/generation"],
    });
    const reader = eventCounterReadAccess({
      resource: "view-counts",
      host: "watch",
      publicView,
      sourcePaths: ["/generation"],
    });
    const feature: V2Emitter = {
      id: "probe.counts",
      version: "0.1.0",
      status: "diagnostic",
      description: "Explicit generic counter persistence probe",
      sourcePaths: ["jeeves-generator/src/v2/event-counter.ts"],
      render: () => ({ files: [] }),
      local: () => ({
        ...persistence,
        logins: [...(persistence.logins ?? []), ...(reader.logins ?? [])],
        grants: [...(persistence.grants ?? []), ...(reader.grants ?? [])],
      }),
    };
    const bundle = assembleV2(
      { designJson: JSON.stringify(design) },
      loadLocalV2Registry([feature]),
    );
    const plan = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(plan.grants.filter((g: { host: string }) => g.host === "watch")).toEqual([
      {
        resource: "view-counts",
        host: "watch",
        schema: "activity_public",
        relation: "totals",
        kind: "view",
        privileges: ["SELECT"],
      },
    ]);
    expect(plan.views).toEqual([
      {
        resource: "view-counts",
        schema: "activity_public",
        name: "totals",
        selectSql: counterTotalsSelect(tables),
      },
    ]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(
      bundle.report.gaps.some((g) => g.id === "event-counter-application-bindings" && g.required),
    ).toBe(true);
    expect(loadLocalV2Registry().installed.templates).toEqual([]);
    expect(() => counterSchema(tables, tables.receipts)).toThrow("Counter public view must differ");
  });
});
