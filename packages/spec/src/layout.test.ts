import { expect, it } from "vitest";
import { legacyArchitectureExample as architectureExample } from "./architecture-examples.ts";
import { architectureViews } from "./architecture-view.ts";
import { focusedArchitectureView } from "./focused-views.ts";
import { layoutSchema, pruneArchitectureLayout, pruneLayout } from "./layout.ts";

const lookup = { get: () => undefined, versions: () => [] };
it("keeps legacy layout documents lossless; views contain geometry/filtering only", () => {
  const legacy = {
    schemaVersion: 1,
    items: { web: { x: 4, y: 8, width: 200 } },
    viewport: { x: 2, y: 3, zoom: 0.8 },
  };
  expect(layoutSchema.parse(legacy)).toEqual(legacy);
  expect(
    layoutSchema.safeParse({
      ...legacy,
      architecture: { "focus-a": { positions: {}, workflow: "execute" } },
    }).success,
  ).toBe(false);
  expect(
    layoutSchema.safeParse({ ...legacy, architecture: { "focus-a": { name: " ", positions: {} } } })
      .success,
  ).toBe(false);
});

it("focuses a 15+ element target by stable identity, expands one hop and accounts for every hidden relationship", () => {
  const { design, layout } = architectureExample("qrwty-target");
  const store = design.elements.find((element) => element.id === "db")!;
  design.elements.push(
    { ...structuredClone(store), id: "archive", name: "Archive" },
    { ...structuredClone(store), id: "audit-data", name: "Audit data" },
  );
  expect(design.elements.length).toBeGreaterThanOrEqual(15);
  const before = structuredClone(design);
  const source = architectureViews(design, lookup, "Target").containers;
  for (const view of Object.values(layout.architecture!))
    expect(view.members?.every((id) => source.nodes.some((node) => node.id === id))).toBe(true);
  const view = layout.architecture!["focus-redirect"]!;
  const { projection, hidden } = focusedArchitectureView(source, view);
  expect(projection.nodes.some((node) => node.id === "container:redirect")).toBe(true);
  expect(projection.nodes.some((node) => node.id === "container:cache")).toBe(true);
  expect(projection.nodes.some((node) => node.id === "container:worker")).toBe(false);
  expect(new Set([...projection.edges, ...hidden].map((edge) => edge.id)).size).toBe(
    source.edges.length,
  );
  expect(hidden.length).toBeGreaterThan(0);
  const selectedOnly = focusedArchitectureView(source, { ...view, includeDependencies: false });
  expect(selectedOnly.projection.nodes.map((node) => node.id)).toEqual(["container:redirect"]);
  expect(design).toEqual(before);
});

it("prunes removed identities only, retaining view identity, cameras and renamed/configured elements", () => {
  const { design, layout } = architectureExample("qrwty-target");
  const view = layout.architecture!["focus-management"]!;
  view.positions = {
    "container:api": { x: 1, y: 2 },
    "container:gone": { x: 2, y: 8 },
    "responsibility:accounts": { x: 4, y: 6 },
  };
  view.members!.push("container:gone");
  view.viewport = { x: 10, y: 20, zoom: 0.7 };
  layout.architecture!["components:gone"] = { positions: {} };
  const api = design.elements.find((element) => element.id === "api")!;
  api.name = "Renamed API";
  api.config.description = "Changed configuration";
  const result = pruneLayout(layout, design);
  expect(result.architecture!["focus-management"]).toEqual({
    ...view,
    members: [
      "container:web",
      "container:api",
      "container:db",
      "container:assets",
      "context:member",
    ],
    positions: { "container:api": { x: 1, y: 2 }, "responsibility:accounts": { x: 4, y: 6 } },
  });
  expect(result.architecture!["components:gone"]).toBeUndefined();
  expect(layout.architecture!["components:gone"]).toBeDefined();
});

it("architecture-only pruning preserves a board placement whose semantic request is pending", () => {
  const { design, layout } = architectureExample("qrwty-target");
  layout.items.pending = { x: 450, y: 220 };
  expect(pruneArchitectureLayout(layout, design).items.pending).toEqual({ x: 450, y: 220 });
});
