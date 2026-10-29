import type { DesignDocument, LayoutDocument } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { placeNewItems } from "./place.ts";

const element = (id: string) => ({
  id,
  name: id,
  template: { id: "http-service", version: "0.1.0" },
  config: {},
  attachments: [],
  notes: "",
});
const design = (ids: string[], connections: [string, string][] = []): DesignDocument => ({
  schemaVersion: 1,
  revision: 1,
  elements: ids.map(element),
  connections: connections.map(([from, to]) => ({
    id: `${from}-${to}`,
    kind: "depends-on",
    from: { element: from },
    to: { element: to },
  })),
  annotations: [],
});
const layout = (items: LayoutDocument["items"]): LayoutDocument => ({ schemaVersion: 1, items });

describe("placeNewItems", () => {
  it("places only items without a layout entry, left to right along connections", async () => {
    const placed = await placeNewItems(design(["a", "b"], [["a", "b"]]), layout({}));
    expect(Object.keys(placed).sort()).toEqual(["a", "b"]);
    expect(placed.a?.x).toBeLessThan(placed.b?.x ?? 0);
    expect(await placeNewItems(design(["a"]), layout({ a: { x: 0, y: 0 } }))).toEqual({});
  });

  it("puts new items beside the selection without overlapping anything", async () => {
    const existing = layout({ old: { x: 0, y: 0 }, right: { x: 380, y: 0 } });
    const placed = await placeNewItems(design(["old", "right", "new"]), existing, ["old"]);
    const item = placed.new;
    if (!item) throw new Error("not placed");
    // Beside the selection, but moved down past the card that's already there.
    expect(item.x).toBe(380);
    expect(item.y).toBeGreaterThanOrEqual(110 + 40);
  });

  it("goes beside everything when nothing is selected", async () => {
    const existing = layout({ a: { x: 0, y: 0 }, b: { x: 1000, y: 400 } });
    const placed = await placeNewItems(design(["a", "b", "c"]), existing);
    expect(placed.c).toEqual({ x: 1000 + 260 + 120, y: 0 });
  });
});
