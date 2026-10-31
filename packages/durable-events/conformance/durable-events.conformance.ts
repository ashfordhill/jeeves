import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type StartedProject, startProject } from "@jeeves/template-kit/harness";
import pg from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  DeliveryConflict,
  type DeliveryLease,
  DeliveryWorker,
  defineEvent,
  defineHandler,
  deliveryMigration,
  Outbox,
  PermanentDeliveryFailure,
} from "../src/index.ts";

const inventoryChanged = defineEvent({
  type: "inventory.changed",
  version: 1,
  parse(value: unknown) {
    const payload = value as { sku?: unknown; delta?: unknown } | null;
    if (
      !payload ||
      typeof payload.sku !== "string" ||
      !/^[a-z0-9-]{1,30}$/.test(payload.sku) ||
      !Number.isInteger(payload.delta) ||
      Math.abs(Number(payload.delta)) > 1000
    )
      throw new Error("Invalid inventory change");
    return { sku: payload.sku, delta: Number(payload.delta) };
  },
});
const dir = mkdtempSync(join(tmpdir(), "jeeves-durable-events-"));
const password = randomUUID();
let project: StartedProject;
let pool: pg.Pool;
const box = (queue: string) =>
  new Outbox(pool, { queue, events: [inventoryChanged], preset: "responsive" });
async function reconnect() {
  const endpoint = await project.service("db").endpoint(5432);
  pool = new pg.Pool({
    host: endpoint.host,
    port: endpoint.port,
    user: "postgres",
    password,
    database: "events",
    max: 6,
    connectionTimeoutMillis: 5000,
  });
}
beforeAll(async () => {
  writeFileSync(
    join(dir, "docker-compose.yml"),
    JSON.stringify({
      services: {
        db: {
          image: "postgres:17-alpine",
          environment: { POSTGRES_PASSWORD: password, POSTGRES_DB: "events" },
          ports: ["127.0.0.1::5432"],
          volumes: ["events-data:/var/lib/postgresql/data"],
          healthcheck: {
            test: ["CMD-SHELL", "pg_isready -U postgres -d events"],
            interval: "1s",
            timeout: "3s",
            retries: 30,
          },
        },
      },
      volumes: { "events-data": {} },
    }),
    { mode: 0o600 },
  );
  project = await startProject(dir, { projectName: `jeeves-events-${process.pid}` });
  await reconnect();
  await pool.query(deliveryMigration.sql);
  await pool.query(
    "CREATE TABLE inventory (tenant text,sku text,quantity int NOT NULL,PRIMARY KEY(tenant,sku)); CREATE TABLE notifications (tenant text,sku text,total int NOT NULL,PRIMARY KEY(tenant,sku))",
  );
});
afterAll(async () => {
  try {
    await pool?.end();
  } finally {
    try {
      await project?.down({ volumes: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});
const emit = (outbox: Outbox, key: string, tenant = "tenant-a", delta = 2) =>
  outbox.transaction(tenant, (tx) => tx.emit(inventoryChanged, key, { sku: "widget", delta }));
async function claim(outbox: Outbox): Promise<DeliveryLease> {
  const result = await outbox.claim();
  expect(result?.kind).toBe("claimed");
  if (result?.kind !== "claimed") throw new Error("Expected a live lease");
  return result.delivery;
}
const expire = (id: string) =>
  pool.query(
    "UPDATE public.jeeves_event_delivery_v1 SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [id],
  );
const due = (id: string) =>
  pool.query(
    "UPDATE public.jeeves_event_delivery_v1 SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [id],
  );

it("commits business writes and delivery together, with normalized tenant-scoped keys and rollback on conflict", async () => {
  const outbox = box("atomic");
  await expect(
    outbox.transaction("tenant-a", async (tx) => {
      await tx.query("INSERT INTO inventory VALUES ($1,$2,$3)", ["tenant-a", "rollback", 10]);
      await tx.emit(inventoryChanged, "rollback", { sku: "rollback", delta: 10 });
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect((await pool.query("SELECT * FROM inventory WHERE sku='rollback'")).rowCount).toBe(0);
  expect(await outbox.list("tenant-a")).toEqual([]);
  const first = await outbox.transaction("tenant-a", async (tx) => {
    await tx.query("INSERT INTO inventory VALUES ($1,$2,$3)", ["tenant-a", "widget", 2]);
    return tx.emit(inventoryChanged, "stock-change-1", { delta: 2, sku: "widget" });
  });
  expect(await emit(outbox, "stock-change-1")).toEqual({ id: first.id, created: false });
  await expect(
    outbox.transaction("tenant-a", async (tx) => {
      await tx.query("UPDATE inventory SET quantity=99 WHERE tenant='tenant-a' AND sku='widget'");
      await tx.emit(inventoryChanged, "stock-change-1", { sku: "widget", delta: 99 });
    }),
  ).rejects.toBeInstanceOf(DeliveryConflict);
  expect(
    (await pool.query("SELECT quantity FROM inventory WHERE tenant='tenant-a' AND sku='widget'"))
      .rows[0].quantity,
  ).toBe(2);
  expect((await emit(outbox, "stock-change-1", "tenant-b")).id).not.toBe(first.id);
  expect(await outbox.status("tenant-b", first.id)).toBeUndefined();
  expect((await outbox.list("tenant-a"))[0]).not.toHaveProperty("payload");
  await expect(
    outbox.transaction("tenant-a", async (tx) => {
      await tx.query("UPDATE inventory SET quantity=99 WHERE tenant='tenant-a' AND sku='widget'");
      await tx.query("COMMIT");
    }),
  ).rejects.toThrow("component owns transaction control");
  expect(
    (await pool.query("SELECT quantity FROM inventory WHERE tenant='tenant-a' AND sku='widget'"))
      .rows[0].quantity,
  ).toBe(2);
  await expect(outbox.list("tenant-a", { limit: 101 })).rejects.toThrow();
});

it("gives competing workers distinct leases and fences an expired worker's acknowledgements/effects", async () => {
  const first = box("competing"),
    second = box("competing");
  await emit(first, "one");
  await emit(first, "two");
  const [a, b] = await Promise.all([claim(first), claim(second)]);
  expect(a.id).not.toBe(b.id);
  expect(await first.claim()).toBeNull();
  await expire(a.id);
  const next = await claim(second);
  expect(next.id).toBe(a.id);
  expect(next.attempts).toBe(2);
  expect(next.token).not.toBe(a.token);
  expect(await first.acknowledge(a)).toBe(false);
  expect(await first.fail(a, "handler-failed")).toBe(false);
  await expect(
    first.effect(a, async () => {
      throw new Error("must not run");
    }),
  ).rejects.toThrow("no longer current");
  expect(await second.acknowledge(next)).toBe(true);
  expect(await first.acknowledge(b)).toBe(true);
});

it("retries with durable due times, exhausts finite failures, and makes a crashed final attempt visible", async () => {
  const outbox = box("retries");
  const event = await emit(outbox, "retry");
  const worker = new DeliveryWorker(outbox, [
    defineHandler(inventoryChanged, async () => {
      throw new Error("do not persist this private message");
    }),
  ]);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const outcome = await worker.once();
    expect(outcome).toMatchObject({
      state: attempt === 3 ? "exhausted" : "pending",
      attempt,
      error: "handler-failed",
    });
    if (attempt < 3) {
      expect(await outbox.claim()).toBeNull();
      await due(event.id);
    }
  }
  const stored = await outbox.status("tenant-a", event.id);
  expect(stored).toMatchObject({ state: "exhausted", attempts: 3, lastError: "handler-failed" });
  expect(JSON.stringify(stored)).not.toContain("private message");
  expect(await outbox.claim()).toBeNull();
  const crashed = await emit(outbox, "crashed");
  for (let attempt = 1; attempt <= 3; attempt++) {
    expect((await claim(outbox)).attempts).toBe(attempt);
    await expire(crashed.id);
  }
  expect(await outbox.claim()).toMatchObject({
    kind: "exhausted",
    delivery: { id: crashed.id, attempts: 3, lastError: "lease-expired" },
  });
  const permanent = await emit(outbox, "permanent");
  const rejecting = new DeliveryWorker(outbox, [
    defineHandler(inventoryChanged, async () => {
      throw new PermanentDeliveryFailure();
    }),
  ]);
  expect(await rejecting.once()).toMatchObject({
    state: "exhausted",
    id: permanent.id,
    attempt: 1,
  });
});

it("preserves committed database effects across restart/redelivery and rolls back a failed receipt/effect", async () => {
  let outbox = box("restart");
  const event = await emit(outbox, "committed-effect");
  const leased = await claim(outbox);
  expect(
    await outbox.effect(leased, async (tx) => {
      await tx.query("INSERT INTO notifications VALUES ($1,$2,$3)", ["tenant-a", "widget", 2]);
    }),
  ).toBe(true);
  // Simulate a lost worker after effect commit and before delivery acknowledgement, then restart PG.
  await expire(event.id);
  await pool.end();
  await project.service("db").restart();
  await reconnect();
  outbox = box("restart");
  let applied: boolean | undefined;
  const worker = new DeliveryWorker(outbox, [
    defineHandler(inventoryChanged, async (payload, context) => {
      applied = await context.effect(async (tx) => {
        await tx.query("UPDATE notifications SET total=total+$3 WHERE tenant=$1 AND sku=$2", [
          context.tenantId,
          payload.sku,
          payload.delta,
        ]);
      });
    }),
  ]);
  expect(await worker.once()).toMatchObject({ state: "succeeded", id: event.id, attempt: 2 });
  expect(applied).toBe(false);
  expect(await outbox.status("tenant-a", event.id)).toMatchObject({
    state: "succeeded",
    effectCommitted: true,
  });
  expect(
    (await pool.query("SELECT total FROM notifications WHERE tenant='tenant-a' AND sku='widget'"))
      .rows[0].total,
  ).toBe(2);
  const rollback = await emit(outbox, "rollback-effect");
  const another = await claim(outbox);
  await expect(
    outbox.effect(another, async (tx) => {
      await tx.query("UPDATE notifications SET total=99 WHERE tenant='tenant-a' AND sku='widget'");
      throw new Error("effect failed");
    }),
  ).rejects.toThrow("effect failed");
  expect(
    (
      await pool.query("SELECT * FROM public.jeeves_event_receipt_v1 WHERE delivery_id=$1", [
        rollback.id,
      ])
    ).rowCount,
  ).toBe(0);
  expect(
    (await pool.query("SELECT total FROM notifications WHERE tenant='tenant-a' AND sku='widget'"))
      .rows[0].total,
  ).toBe(2);
  await outbox.fail(another, "handler-failed");
  await due(rollback.id);
  expect(await worker.once()).toMatchObject({ state: "succeeded", id: rollback.id, attempt: 2 });
  expect(applied).toBe(true);
  expect(
    (await pool.query("SELECT total FROM notifications WHERE tenant='tenant-a' AND sku='widget'"))
      .rows[0].total,
  ).toBe(4);
});
