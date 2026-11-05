import {
  applyOperations,
  type StudioScopeProjection,
  studioArchitectureExample,
  studioDefinitions,
  studioViews,
} from "@jeeves/spec";
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { studioCardSize } from "./card-appearance.tsx";
import { layoutStudio, STUDIO_GRID, type StudioLayoutInput } from "./layout.ts";
import { studioPathLabels, studioPaths } from "./routing.ts";
import { choicesFor, spawnEndpoint, spawnOps } from "./spawn.ts";

const design = studioArchitectureExample("studio-tinyurl").design;
const views = studioViews(design, studioDefinitions, "TinyURL");

/** The layout input StudioGraph builds, with label widths estimated instead of measured. */
function layoutInput(scope: StudioScopeProjection, order: string[] = []): StudioLayoutInput {
  const parents = new Set(scope.nodes.flatMap((node) => (node.parent ? [node.parent] : [])));
  const paths = studioPaths(scope);
  return {
    scope: scope.key,
    version: 2,
    nodes: scope.nodes.map((node) => ({
      id: node.id,
      ...studioCardSize(node),
      ...(node.parent && { parent: node.parent }),
      ...((node.frame || parents.has(node.id)) && { frame: true as const }),
    })),
    paths,
    labels: Object.fromEntries(
      Object.entries(studioPathLabels(paths)).map(([id, label]) => [
        id,
        { ...label, shortWidth: label.short.length * 7, detailWidth: label.detail.length * 7 },
      ]),
    ),
    order,
  };
}
const layout = (input: StudioLayoutInput) => layoutStudio(input, new ELK());

describe("studio layout", () => {
  it("is deterministic and snaps every box to the 32px grid", async () => {
    const input = layoutInput(views.containers);
    const first = await layout(input);
    expect(await layout(structuredClone(input))).toEqual(first);
    expect(Object.keys(first.nodes).sort()).toEqual(views.containers.nodes.map((n) => n.id).sort());
    for (const [id, box] of Object.entries(first.nodes)) {
      const frame = input.nodes.find((node) => node.id === id)?.frame;
      expect(box.x % STUDIO_GRID, id).toBe(0);
      // Cards centre on a grid line; frames align their edges.
      expect((frame ? box.y : box.y + box.height / 2) % STUDIO_GRID, id).toBe(0);
    }
    expect(Object.keys(first.routes).sort()).toEqual(input.paths.map((p) => p.id).sort());
  });

  it("follows a saved row order inside a column", async () => {
    const before = await layout(layoutInput(views.containers));
    const column = before.columns.find((ids) => ids.length > 1);
    if (!column) throw new Error("Expected a column with two boxes.");
    const reversed = [...column].reverse();
    const after = await layout(layoutInput(views.containers, reversed));
    expect(after.columns).toContainEqual(reversed);
  });
});

describe("studio + spawn", () => {
  const node = (scope: StudioScopeProjection, id: string) =>
    scope.nodes.find((item) => item.id === id);

  it("offers only kinds the model can connect, per level and side", () => {
    const api = spawnEndpoint(
      design,
      views.containers,
      node(views.containers, "studio:element:shorten-api"),
    );
    if (!api) throw new Error("Shorten API is a spawn endpoint.");
    const out = choicesFor(views.containers, api, "out").map((c) => c.type === "element" && c.kind);
    expect(out).toEqual(expect.arrayContaining(["database", "cache", "service"]));
    const db = spawnEndpoint(
      design,
      views.containers,
      node(views.containers, "studio:element:links-db"),
    );
    if (!db) throw new Error("Links DB is a spawn endpoint.");
    expect(choicesFor(views.containers, db, "out")).toEqual([]);
    // C3: an application can gain components inside it.
    const host = spawnEndpoint(
      design,
      views.components,
      node(views.components, "studio:element:redirect"),
    );
    if (!host) throw new Error("Redirect is a C3 spawn endpoint.");
    expect(choicesFor(views.components, host, "out").some((c) => c.type === "component")).toBe(
      true,
    );
    // Packages carry no handles.
    expect(
      spawnEndpoint(
        design,
        views.containers,
        node(views.containers, "studio:package:link-platform"),
      ),
    ).toBeUndefined();
  });

  it("creates the new box and its one relationship in a single valid batch", () => {
    const api = spawnEndpoint(
      design,
      views.containers,
      node(views.containers, "studio:element:shorten-api"),
    );
    if (!api) throw new Error("Shorten API is a spawn endpoint.");
    const spawned = spawnOps(design, "containers", "TinyURL", api, "out", {
      type: "element",
      kind: "search",
    });
    const result = applyOperations(design, spawned.ops, { baseRevision: design.revision });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.design.elements).toHaveLength(design.elements.length + 1);
    expect(result.design.connections).toHaveLength(design.connections.length + 1);
    const created = result.design.elements.at(-1);
    expect(spawned.node).toBe(`studio:element:${created?.id}`);
    expect(result.design.connections.at(-1)).toMatchObject({
      id: spawned.relation,
      from: { element: "shorten-api" },
      to: { element: created?.id },
    });
  });

  it("adds a person at C1 with a relationship to the system", () => {
    const system = spawnEndpoint(
      design,
      views.context,
      node(views.context, "studio:context:system"),
    );
    if (!system) throw new Error("The system is a C1 spawn endpoint.");
    const spawned = spawnOps(design, "context", "TinyURL", system, "in", {
      type: "context",
      kind: "person",
    });
    const result = applyOperations(design, spawned.ops);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.design.architecture?.relationships.at(-1)).toMatchObject({
      id: spawned.relation,
      to: "system",
    });
  });
});
