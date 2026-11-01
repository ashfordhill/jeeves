import type { ArchitectureProjection, ArchitectureViewNode } from "@jeeves/spec";
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import {
  architectureBounds,
  architectureGeometry,
  architectureLayoutInput,
  type Box,
} from "./layout.ts";

const card = (
  id: string,
  kind: ArchitectureViewNode["kind"] = "container",
): ArchitectureViewNode => ({
  id,
  kind,
  name: id,
  description: id,
  technology: "HTTP",
  support: "template",
  acceptance: [],
  ...(kind === "container" ? { binding: { element: id } } : {}),
});
const projection: ArchitectureProjection = {
  level: "containers",
  name: "Inventory",
  description: "A real scoped chain",
  resources: [],
  nodes: [card("person", "person"), card("api"), card("db"), card("web")],
  edges: [
    { id: "use", from: "person", to: "web", description: "Uses workspace", context: "use" },
    { id: "calls", from: "web", to: "api", description: "Calls owner-scoped resources" },
    { id: "store", from: "api", to: "db", description: "Stores resource records" },
  ],
};
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const onBoundary = (p: { x: number; y: number }, b: Box) =>
  ((p.x === b.x || p.x === b.x + b.width) && p.y >= b.y && p.y <= b.y + b.height) ||
  ((p.y === b.y || p.y === b.y + b.height) && p.x >= b.x && p.x <= b.x + b.width);
async function checkView(view: ArchitectureProjection, down = false) {
  const input = architectureLayoutInput(view, down);
  const before = JSON.stringify(view);
  const geometry = architectureGeometry(await new ELK().layout(input));
  expect(JSON.stringify(view)).toBe(before);
  expect(Object.keys(geometry.nodes).sort()).toEqual(view.nodes.map((n) => n.id).sort());
  expect(Object.keys(geometry.edges).sort()).toEqual(view.edges.map((e) => e.id).sort());
  for (const edge of view.edges) {
    const route = geometry.edges[edge.id];
    const source = geometry.nodes[edge.from],
      target = geometry.nodes[edge.to];
    if (!route || !source || !target) throw new Error("missing geometry");
    expect(onBoundary(route.points[0]!, source)).toBe(true);
    expect(onBoundary(route.points.at(-1)!, target)).toBe(true);
    for (const [id, node] of Object.entries(geometry.nodes)) {
      expect(overlaps(route.label, node), `label ${edge.id} overlaps ${id}`).toBe(false);
      if (id === edge.from || id === edge.to) continue;
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1]!,
          b = route.points[i]!;
        expect(a.x === b.x || a.y === b.y).toBe(true);
        const crosses =
          a.x === b.x
            ? a.x > node.x &&
              a.x < node.x + node.width &&
              Math.max(a.y, b.y) > node.y &&
              Math.min(a.y, b.y) < node.y + node.height
            : a.y > node.y &&
              a.y < node.y + node.height &&
              Math.max(a.x, b.x) > node.x &&
              Math.min(a.x, b.x) < node.x + node.width;
        expect(crosses, `${edge.id} crosses unrelated ${id}`).toBe(false);
      }
    }
  }
  return geometry;
}
describe("derived architecture layout", () => {
  it("keeps a compound scope, global coordinates and deterministic directed routes in both orientations", async () => {
    for (const down of [false, true]) {
      const geometry = await checkView(projection, down);
      const reversed = {
        ...projection,
        nodes: [...projection.nodes].reverse(),
        edges: [...projection.edges].reverse(),
      };
      expect(await checkView(reversed, down)).toEqual(geometry);
      const scope = geometry.scope!;
      for (const id of ["web", "api", "db"]) {
        const node = geometry.nodes[id]!;
        expect(
          node.x >= scope.x &&
            node.y >= scope.y + 40 &&
            node.x + node.width <= scope.x + scope.width &&
            node.y + node.height <= scope.y + scope.height,
        ).toBe(true);
      }
      expect(overlaps(geometry.nodes.person!, scope)).toBe(false);
    }
  });
  it("keeps cycle, parallel and self relationships separate around unrelated cards", async () => {
    const geometry = await checkView({
      ...projection,
      edges: [
        ...projection.edges,
        {
          id: "parallel",
          from: "web",
          to: "api",
          description: "Refreshes session and current records",
        },
        { id: "reverse", from: "api", to: "web", description: "Delivers a declared update" },
        { id: "self", from: "api", to: "api", description: "A declared self interaction" },
      ],
    });
    expect(geometry.edges.calls?.points).not.toEqual(geometry.edges.parallel?.points);
  });
  it("lays out sparse component scopes without inventing dependencies for isolated responsibilities", async () => {
    const inner = Array.from({ length: 11 }, (_, index) => ({
      ...card(`component:${index}`, "component"),
      binding: { element: "api" },
    }));
    const view: ArchitectureProjection = {
      ...projection,
      level: "components",
      container: "api",
      nodes: [...inner, card("web"), card("db")],
      edges: [
        { id: "calls", from: "web", to: "component:0", description: "Calls API" },
        { id: "store", from: "component:0", to: "db", description: "Uses database" },
      ],
    };
    const geometry = await checkView(view);
    expect(Object.keys(geometry.nodes)).toHaveLength(13);
    expect(Object.keys(geometry.edges)).toHaveLength(2);
    expect(new Set(inner.slice(1).map((node) => geometry.nodes[node.id]?.x)).size).toBeGreaterThan(
      2,
    );
    expect(await checkView({ ...view, nodes: [...view.nodes].reverse() })).toEqual(geometry);
  });
  it("handles an empty scope and refuses missing endpoints or incomplete engine output", async () => {
    expect(await checkView({ ...projection, nodes: [], edges: [] })).toEqual({
      nodes: {},
      edges: {},
    });
    expect(() => architectureLayoutInput({ ...projection, nodes: [] }, false)).toThrow(
      "unavailable",
    );
    expect(() => architectureGeometry({ id: "root", children: [{ id: "missing" }] })).toThrow(
      "incomplete",
    );
    expect(() =>
      architectureGeometry({ id: "root", edges: [{ id: "bad", sources: ["a"], targets: ["b"] }] }),
    ).toThrow("incomplete");
  });
});

it("fits labels and routed bends beyond card/scope bounds without changing layout geometry", () => {
  const geometry = {
    nodes: { api: { x: 0, y: 0, width: 252, height: 188 } },
    scope: { x: -10, y: -10, width: 280, height: 220 },
    edges: {
      use: {
        points: [
          { x: 0, y: 20 },
          { x: -90, y: 220 },
        ],
        label: { x: 270, y: -80, width: 240, height: 80 },
      },
    },
  };
  const before = structuredClone(geometry);
  expect(architectureBounds(geometry)).toEqual({ x: -90, y: -80, width: 600, height: 300 });
  expect(geometry).toEqual(before);
  expect(architectureBounds({ nodes: {}, edges: {} })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
});

it("manual positions preserve identities and keep re-routed labels clear of all cards", async () => {
  const { positionedArchitectureGeometry } = await import("./layout.ts");
  const geometry = await checkView(projection);
  const before = structuredClone(geometry);
  const point = geometry.nodes.api!;
  const positions = { api: { x: point.x + 180, y: point.y + 160 } };
  const result = positionedArchitectureGeometry(geometry, projection, positions);
  expect(result.nodes.api).toMatchObject(positions.api);
  expect(result.edges.calls?.points).not.toEqual(geometry.edges.calls?.points);
  for (const edge of Object.values(result.edges))
    for (const box of Object.values(result.nodes)) expect(overlaps(edge.label, box)).toBe(false);
  expect(geometry).toEqual(before);
  expect(
    positionedArchitectureGeometry(
      geometry,
      projection,
      Object.fromEntries(
        Object.entries(geometry.nodes).map(([id, box]) => [id, { x: box.x, y: box.y }]),
      ),
    ),
  ).toBe(geometry);
});

it("lays out nested deployment boundaries and keeps manual placement inside the updated boundaries", async () => {
  const { default: deploymentFixture } = await import(
    "../../../../fixtures/designs/architecture-deployments.json"
  );
  const { designSchema, deploymentProjection } = await import("@jeeves/spec");
  const { positionedArchitectureGeometry } = await import("./layout.ts");
  const design = designSchema.parse(deploymentFixture);
  const view = deploymentProjection(design, design.architecture!.deployments![0]!);
  const geometry = await checkView(view);
  for (const node of view.nodes.filter((n) => n.parent)) {
    const point = geometry.nodes[node.id]!,
      boundary = geometry.groups![node.parent!]!;
    expect(
      point.x >= boundary.x &&
        point.y >= boundary.y &&
        point.x + point.width <= boundary.x + boundary.width &&
        point.y + point.height <= boundary.y + boundary.height,
    ).toBe(true);
  }
  const id = view.nodes.find((n) => n.binding?.element === "redirect")!.id;
  const moved = positionedArchitectureGeometry(geometry, view, { [id]: { x: -200, y: -300 } });
  expect(moved.nodes[id]).toMatchObject({ x: -200, y: -300 });
  expect(moved.groups!["deployment-group:hosted-plan:hosting"]!.x).toBeLessThan(-200);
});
