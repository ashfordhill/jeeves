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
import { outboxSchema, receiptSchema } from "./durability.ts";

// Load exact emitted modules without importing their field SDK dependencies. Type-only
// pg/amqp imports disappear. SQL executes in real offline PGlite, not a SQL interpreter mock.
const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const old = urls.get(name);
  if (old) return old;
  const base = new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts`, import.meta.url);
  const source = readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8");
  const js = stripTypeScriptTypes(source).replace(
    /from "\.\/(.+)\.ts"/g,
    (_match, dependency: string) => `from "${moduleUrl(dependency)}"`,
  );
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { transaction } = await import(moduleUrl("transaction"));
const { createOutbox, startRelay } = await import(moduleUrl("outbox"));
const { createReceipts } = await import(moduleUrl("receipts"));
const relation = {
  schema: "ledger_private",
  table: "intents",
  destinations: ["document-jobs", "audit-log"],
};
const receipts = { schema: "ledger_private", table: "receipts" };
const payload = (input: unknown, eventId: string) => {
  const p = input as { id: string; amount: number; receivedAt?: string };
  if (p.id !== eventId || !Number.isSafeInteger(p.amount))
    throw new Error("Invalid document payload");
  if (p.receivedAt !== undefined && !Number.isFinite(Date.parse(p.receivedAt)))
    throw new Error("Invalid transport timestamp");
  return p;
};
const outbox = createOutbox(relation, "document-jobs", payload);
const inbox = createReceipts(receipts, {
  payload,
  identity: (value: ReturnType<typeof payload>) => ({ id: value.id, amount: value.amount }),
  result: (value: unknown) => {
    if (typeof value !== "number") throw new Error("Invalid receipt result");
    return value;
  },
});
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function database() {
  const db = new PGlite();
  await db.exec(
    outboxSchema(relation) +
      receiptSchema(receipts) +
      "CREATE TABLE ledger_private.balance(value integer NOT NULL); INSERT INTO ledger_private.balance VALUES(0);",
  );
  let previous = Promise.resolve();
  const pool = {
    async connect() {
      const free = deferred(),
        pending = previous;
      previous = free.promise;
      await pending;
      return {
        async query(sql: string, values?: unknown[]) {
          const result = await db.query(sql, values);
          return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
        },
        release() {
          free.resolve();
        },
      };
    },
  };
  return { db, pool };
}

describe("emitted transactional durability", () => {
  it("rolls state/intent back, deduplicates receipts with the effect and rejects conflicting stable identities", async () => {
    const { db, pool } = await database();
    const intent = {
      eventId: "doc:1",
      intentKey: "convert:document:1",
      payload: { id: "doc:1", amount: 2 },
    };
    try {
      await expect(
        transaction(pool, async (tx: { query: (sql: string) => Promise<unknown> }) => {
          await tx.query("UPDATE ledger_private.balance SET value=9");
          await outbox.enqueue(tx, intent);
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect((await db.query("SELECT value FROM ledger_private.balance")).rows).toEqual([
        { value: 0 },
      ]);
      expect((await db.query("SELECT * FROM ledger_private.intents")).rows).toEqual([]);
      const apply = (fail = false) =>
        transaction(pool, (tx: unknown) =>
          inbox.withEffect(
            tx,
            { scopeKey: "document:1", eventId: intent.eventId, payload: intent.payload },
            async (sameTx: { query: (sql: string) => Promise<unknown> }) => {
              expect(sameTx).toBe(tx);
              await sameTx.query("UPDATE ledger_private.balance SET value=value+2");
              await outbox.enqueue(sameTx, intent);
              if (fail) throw new Error("effect refused");
              return 2;
            },
          ),
        );
      await expect(apply(true)).rejects.toThrow("effect refused");
      expect((await db.query("SELECT * FROM ledger_private.receipts")).rows).toEqual([]);
      expect((await db.query("SELECT * FROM ledger_private.intents")).rows).toEqual([]);
      expect(await apply()).toEqual({ applied: true, result: 2 });
      expect(await apply()).toEqual({ applied: false, result: 2 });
      expect(
        await transaction(pool, (tx: unknown) =>
          inbox.withEffect(
            tx,
            {
              scopeKey: "document:1",
              eventId: intent.eventId,
              payload: { ...intent.payload, receivedAt: "2026-11-08T15:00:00Z" },
            },
            async () => {
              throw new Error("Duplicate effect must not run");
            },
          ),
        ),
      ).toEqual({ applied: false, result: 2 });
      expect((await db.query("SELECT value FROM ledger_private.balance")).rows).toEqual([
        { value: 2 },
      ]);
      expect(await transaction(pool, (tx: unknown) => outbox.enqueue(tx, intent))).toBe(false);
      await expect(
        transaction(pool, async (tx: unknown) => {
          // A caught atomic-hook failure still refuses the outer commit.
          await inbox
            .withEffect(
              tx,
              { scopeKey: "document:2", eventId: "doc:2", payload: { id: "doc:2", amount: 3 } },
              async (sameTx: { query: (sql: string) => Promise<unknown> }) => {
                await sameTx.query("UPDATE ledger_private.balance SET value=88");
                throw new Error("caught failure");
              },
            )
            .catch(() => {});
        }),
      ).rejects.toThrow("caught failure");
      await expect(
        transaction(pool, async (tx: { query: (sql: string) => Promise<unknown> }) => {
          await tx.query("UPDATE ledger_private.balance SET value=88");
          await tx.query("SELECT missing_column FROM ledger_private.balance").catch(() => {});
        }),
      ).rejects.toThrow("missing_column");
      await expect(
        transaction(pool, async (tx: { query: (sql: string) => Promise<unknown> }) => {
          await tx.query("UPDATE ledger_private.balance SET value=88");
          await outbox.enqueue(tx, { ...intent, intentKey: "other-intent" }).catch(() => {});
        }),
      ).rejects.toThrow("Conflicting durable intent");
      await expect(
        transaction(pool, (tx: unknown) =>
          outbox.enqueue(tx, { ...intent, payload: { id: "doc:1", amount: 8 } }),
        ),
      ).rejects.toThrow("Conflicting durable intent");
      await expect(
        transaction(pool, (tx: unknown) =>
          inbox.withEffect(
            tx,
            {
              scopeKey: "document:1",
              eventId: intent.eventId,
              payload: { id: "doc:1", amount: 8 },
            },
            async () => 8,
          ),
        ),
      ).rejects.toThrow("Conflicting or incomplete receipt");
      expect((await db.query("SELECT value FROM ledger_private.balance")).rows).toEqual([
        { value: 2 },
      ]);
    } finally {
      await db.close();
    }
  });

  it("bounds due batches, retries failed confirms with stable IDs and drains an admitted confirmation before close", async () => {
    const { db, pool } = await database();
    try {
      for (const id of ["a", "b", "c"])
        await transaction(pool, (tx: unknown) =>
          outbox.enqueue(tx, { eventId: id, intentKey: id, payload: { id, amount: 1 } }),
        );
      const ids: string[] = [];
      const failed = {
        publish: async (_bytes: Uint8Array, id: string) => {
          ids.push(id);
          throw new Error("confirm lost");
        },
      };
      expect(await outbox.relayBatch(pool, failed, 1)).toEqual({
        selected: 1,
        sent: 0,
        deferred: 1,
      });
      const row = (
        await db.query(
          "SELECT attempts,sent_at,next_attempt_at>clock_timestamp() AS future FROM ledger_private.intents WHERE event_id='a'",
        )
      ).rows[0];
      expect(row).toEqual({ attempts: 1, sent_at: null, future: true });
      await db.exec(
        "UPDATE ledger_private.intents SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE event_id='a'",
      );
      const started = deferred(),
        confirmed = deferred();
      const runner = startRelay(
        outbox,
        pool,
        {
          async publish(_bytes: Uint8Array, id: string) {
            ids.push(id);
            started.resolve();
            await confirmed.promise;
          },
        },
        { limit: 1 },
      );
      await started.promise;
      expect(
        (await db.query("SELECT sent_at FROM ledger_private.intents WHERE event_id='a'")).rows,
      ).toEqual([{ sent_at: null }]);
      let closed = false;
      const close = runner.close();
      expect(runner.close()).toBe(close);
      void close.then(() => {
        closed = true;
      });
      await Promise.resolve();
      expect(closed).toBe(false);
      confirmed.resolve();
      await close;
      expect(ids).toEqual(["a", "a"]);
      expect(
        (await db.query("SELECT event_id FROM ledger_private.intents WHERE sent_at IS NOT NULL"))
          .rows,
      ).toEqual([{ event_id: "a" }]);
      await expect(outbox.relayBatch(pool, failed, 26)).rejects.toThrow("Invalid outbox batch");
    } finally {
      await db.close();
    }
  });

  it("emits reusable dependency libraries and validates bindings without installing business features or granting access", () => {
    expect(() => outboxSchema({ ...relation, schema: "unsafe.schema" })).toThrow(
      "Invalid SQL identifier",
    );
    expect(() => outboxSchema({ ...relation, destinations: ["x');DROP"] })).toThrow(
      "Invalid outbox destinations",
    );
    expect(() => createOutbox(relation, "unbound", payload)).toThrow("Unbound outbox destination");
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: generationSelectionsFixture(),
    });
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
    const owned = bundle.manifest.files.filter(
      (f) => f.owner !== "assembler" && f.owner.id === "local.durability",
    );
    expect(owned.map((f) => f.path).sort()).toEqual([
      "src/runtime/durable-sql.ts",
      "src/runtime/outbox.ts",
      "src/runtime/receipts.ts",
      "src/runtime/transaction.ts",
    ]);
    for (const file of owned)
      expect(
        new TextDecoder().decode(bundle.files.find((f) => f.path === file.path)?.bytes),
      ).not.toMatch(/video_private|videoId|VideoPublished|upload-jobs|youtube/i);
    const plan = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(plan.logins).toEqual([]);
    expect(plan.grants).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(loadLocalV2Registry().installed.templates).toEqual([]);
  });
});
