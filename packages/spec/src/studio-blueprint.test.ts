import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import {
  designBlueprint,
  designBlueprintJsonSchema,
  designBlueprintSchema,
} from "./studio-blueprint.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { studioStoreAccess } from "./studio-links.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;

describe("designBlueprint", () => {
  it("exports TinyURL as a schema-valid, deterministic blueprint", () => {
    const design = tinyurl();
    const before = structuredClone(design);
    const blueprint = designBlueprint(design, "TinyURL");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(design).toEqual(before);
    expect(blueprint).toMatchObject({ blueprint: 2, revision: design.revision, findings: [] });
    expect(blueprint.services.map((s) => s.id)).toEqual([
      "analytics",
      "redirect",
      "shorten",
      "stats-api",
    ]);
    expect(blueprint.services.map((s) => s.components.length)).toEqual([3, 4, 1, 1]);
    expect(blueprint.resources.map((r) => r.id)).toEqual([
      "analytics-store",
      "click-events",
      "url-cache",
      "url-db",
    ]);
    expect(blueprint.externals).toEqual([]);
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "redirect" },
      { lane: "download", element: "stats-api" },
      { lane: "upload", element: "shorten" },
    ]);
    expect(blueprint.connections).toHaveLength(7);
    expect(blueprint.componentLinks).toHaveLength(12);
    expect(blueprint.omitted).toEqual([]);
    // One writer per store: each store's owner writes, every other link into it reads.
    expect(
      Object.fromEntries(blueprint.connections.map((c) => [c.id, c.access ?? c.channelUse])),
    ).toEqual({
      "analytics-write": "write",
      "click-events-analytics": "consume",
      "redirect-cache": "write",
      "redirect-clicks": "publish",
      "redirect-db": "read",
      "shorten-db": "write",
      "stats-read": "read",
    });
    expect(blueprint.connections.every((c) => c.security === "Service identity")).toBe(true);

    const shuffled = tinyurl();
    shuffled.elements.reverse();
    expect(designBlueprint(shuffled, "TinyURL")).toEqual(blueprint);
  });

  it("derives one writer per store from its owner; changing the owner changes who writes", () => {
    const design = tinyurl();
    expect(studioStoreAccess(design, "shorten-db")).toBe("write");
    expect(studioStoreAccess(design, "redirect-db")).toBe("read");
    expect(studioStoreAccess(design, "stats-read")).toBe("read");
    // Not a store: a queue keeps publish and consume.
    expect(studioStoreAccess(design, "redirect-clicks")).toBeUndefined();
    expect(studioStoreAccess(design, "click-events-analytics")).toBeUndefined();

    const run = (from: typeof design, command: StudioCommand) => {
      const batch = buildStudioCommand(from, command);
      const result = applyOperations(from, batch.ops, { baseRevision: batch.baseRevision });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return result.design;
    };
    const moved = run(design, {
      type: "edit",
      element: "url-db",
      owner: { kind: "element", id: "redirect" },
    });
    expect(studioStoreAccess(moved, "redirect-db")).toBe("write");
    expect(studioStoreAccess(moved, "shorten-db")).toBe("read");
    const access = (from: typeof design) =>
      designBlueprint(from).connections.find((c) => c.id === "shorten-db")?.access;
    expect(access(moved)).toBe("read");

    // No owner: nobody writes.
    const unowned = run(design, { type: "edit", element: "url-db", owner: null });
    expect(access(unowned)).toBe("read");
  });

  it("follows the design revision and publishes a JSON Schema", () => {
    const result = applyOperations(tinyurl(), [
      { op: "updateElement", id: "redirect", name: "Redirector" },
    ]);
    if (!result.ok) throw new Error("rejected");
    const blueprint = designBlueprint(result.design);
    expect(blueprint.revision).toBe(1);
    expect(blueprint.services.find((s) => s.id === "redirect")?.name).toBe("Redirector");
    expect(designBlueprintJsonSchema()).toMatchObject({ type: "object" });
  });
});
