import { describe, expect, it } from "vitest";
import {
  type AnalyticsConnection,
  type EventCountDefinition,
  ownedEventCounter,
} from "./postgres.ts";
import { dailyCounts, recentRange, safeCount, utcRange } from "./range.ts";

const inventory: EventCountDefinition = {
  parent: {
    id: "item",
    access: "owner",
    table: "inventory_item",
    fields: [{ name: "label", type: "text", column: "item_label" }],
    belongsTo: [],
  },
  events: {
    id: "movement",
    access: "internal",
    table: "inventory_movement",
    fields: [{ name: "occurred", type: "timestamp", column: "moved_at" }],
    belongsTo: [{ resource: "item", column: "item_id" }],
  },
  timestampField: "occurred",
  labelField: "label",
};

describe("bounded event analytics", () => {
  it("uses valid UTC calendar dates, inclusive 90-day bounds and leap days", () => {
    expect(utcRange("2024-02-28", "2024-03-01")).toEqual({
      from: "2024-02-28",
      to: "2024-03-01",
      days: 3,
      start: "2024-02-28T00:00:00.000Z",
      endExclusive: "2024-03-02T00:00:00.000Z",
    });
    for (const pair of [
      ["2025-02-29", "2025-03-01"],
      ["2026-03-02", "2026-03-01"],
      ["2026-01-01", "2026-04-01"],
      ["2026-01-01T00:00:00Z", "2026-01-02"],
      ["0099-01-01", "0099-01-02"],
    ])
      expect(() => utcRange(...(pair as [string, string]))).toThrow();
    expect(utcRange("2026-01-01", "2026-03-31").days).toBe(90);
    expect(recentRange(7, new Date("2026-03-10T01:00:00+02:00"))).toEqual({
      from: "2026-03-03",
      to: "2026-03-09",
    });
  });
  it("zero-fills without rounding counts, accepting neither duplicate nor foreign buckets", () => {
    const range = { from: "2024-02-28", to: "2024-03-01" };
    expect(dailyCounts(range, [{ date: "2024-02-29", count: "3" }])).toEqual([
      { date: "2024-02-28", count: 0 },
      { date: "2024-02-29", count: 3 },
      { date: "2024-03-01", count: 0 },
    ]);
    for (const value of [-1, 1.2, "1e3", "9007199254740992", null])
      expect(() => safeCount(value)).toThrow();
    expect(() => dailyCounts(range, [{ date: "2024-03-02", count: 1 }])).toThrow();
    expect(() =>
      dailyCounts(range, [
        { date: "2024-02-29", count: 1 },
        { date: "2024-02-29", count: 1 },
      ]),
    ).toThrow();
  });
  it("counts a non-QR inventory through a bounded transaction with parameterized owner and dates", async () => {
    const calls: { sql: string; values?: unknown[] }[] = [];
    let released = false;
    const db: AnalyticsConnection = {
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql.startsWith("SELECT count(*)"))
          return { rows: [{ total: "2", active: "1", resources: "3" }] };
        if (sql.startsWith("SELECT to_char")) return { rows: [{ date: "2026-03-01", count: "2" }] };
        if (sql.startsWith("SELECT p.id"))
          return { rows: [{ id: "item-1", label: "Blue fabric", count: "2" }] };
        return { rows: [] };
      },
      release() {
        released = true;
      },
    };
    const owner = "11111111-1111-4111-8111-111111111111";
    const result = await ownedEventCounter(inventory)(
      {
        async connect() {
          return db;
        },
      },
      owner,
      { from: "2026-03-01", to: "2026-03-02" },
    );
    expect(result).toMatchObject({
      total: 2,
      totalResources: 3,
      activeResources: 1,
      days: [
        { date: "2026-03-01", count: 2 },
        { date: "2026-03-02", count: 0 },
      ],
      top: [{ label: "Blue fabric", count: 2 }],
    });
    expect(calls[0]?.sql).toContain("REPEATABLE READ READ ONLY");
    expect(calls[1]?.sql).toContain("statement_timeout = '5s'");
    for (const call of calls.filter((call) => call.sql.startsWith("SELECT"))) {
      expect(call.sql).toContain("p.owner_id=$1");
      expect(call.sql).not.toContain(owner);
      expect(call.values).toEqual([owner, "2026-03-01T00:00:00.000Z", "2026-03-03T00:00:00.000Z"]);
    }
    expect(calls.at(-1)?.sql).toBe("COMMIT");
    expect(released).toBe(true);
  });
  it("rejects untrusted definitions and releases a failed query transaction", async () => {
    expect(() =>
      ownedEventCounter({ ...inventory, parent: { ...inventory.parent, access: "public" } }),
    ).toThrow();
    expect(() =>
      ownedEventCounter({
        ...inventory,
        events: { ...inventory.events, table: 'events"; DROP TABLE users;' },
      }),
    ).toThrow();
    const calls: string[] = [];
    let released = false;
    const connection: AnalyticsConnection = {
      async query(sql) {
        calls.push(sql);
        if (sql.startsWith("SELECT")) throw new Error("timeout");
        return { rows: [] };
      },
      release() {
        released = true;
      },
    };
    await expect(
      ownedEventCounter(inventory)(
        {
          async connect() {
            return connection;
          },
        },
        "11111111-1111-4111-8111-111111111111",
        { from: "2026-03-01", to: "2026-03-01" },
      ),
    ).rejects.toThrow("timeout");
    expect(calls.at(-1)).toBe("ROLLBACK");
    expect(released).toBe(true);
  });
});
