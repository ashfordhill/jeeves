// The Detailed view's projection on the three module studies and the frozen YouTube v2 design,
// then each one laid out with real ELK (the bundled build) through the board's layout engine.
import {
  type BoardLayout,
  createLayoutEngine,
  GRID,
  type LayoutInput,
  type LineSpec,
  type Point,
  portOffset,
} from "@jeeves/board";
import {
  type DesignDocument,
  designSchema,
  type LaneGraph,
  laneGraph,
  studioArchitectureExample,
} from "@jeeves/spec";
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import v2 from "../../../../../field-projects/youtube/v2/inputs/design.json" with { type: "json" };
import {
  CONTAINER,
  type DetailedView,
  detailedView,
  HEADER_IN,
  HEADER_OUT,
  rowPort,
} from "./detailedView.ts";
import { laneNodeName } from "./LaneCanvas.tsx";
import { laneLayoutInput } from "./laneLayout.ts";

const designs: [string, () => DesignDocument][] = [
  ["TinyURL extended", () => studioArchitectureExample("studio-tinyurl").design],
  ["Marketplace", () => studioArchitectureExample("studio-marketplace").design],
  ["YouTube", () => studioArchitectureExample("studio-youtube").design],
  ["YouTube v2", () => designSchema.parse(structuredClone(v2))],
];

function project(design: DesignDocument): { graph: LaneGraph; view: DetailedView } {
  const graph = laneGraph(design);
  return { graph, view: detailedView(design, graph, (id) => laneNodeName(design, graph, id)) };
}

describe("detailed view projection", () => {
  for (const [name, load] of designs) {
    it(`${name}: rows, ports and lines follow the modules and the lane graph`, () => {
      const design = load();
      const { graph, view } = project(design);
      const studio = design.architecture?.studio;
      const components = studio?.components ?? [];
      const overview = laneLayoutInput(graph);

      // Every module is a row of its host exactly once, in module order.
      const rows = [...view.containers.values()].flatMap((c) => c.rows);
      expect(rows.map((r) => r.module).sort()).toEqual(components.map((c) => c.id).sort());
      for (const item of components) {
        const row = view.rowOf(item.id);
        expect(row?.host, item.id).toBe(item.host);
        const own = components.filter((c) => c.host === item.host).map((c) => c.id);
        expect(view.containers.get(item.host)?.rows.map((r) => r.module)).toEqual(own);
        expect(row?.y).toBe(CONTAINER.header + CONTAINER.row * own.indexOf(item.id) + 16);
      }

      // Tiles in node order; containers resized with their ports on grid lines inside them; every
      // other tile exactly as in the Overview.
      expect(view.tiles.map((t) => t.id)).toEqual(overview.tiles.map((t) => t.id));
      for (const [i, tile] of view.tiles.entries()) {
        const container = view.containers.get(tile.id);
        if (!container) {
          expect(tile, tile.id).toEqual(overview.tiles[i]);
          continue;
        }
        expect(tile.band).toBe(overview.tiles[i]?.band);
        expect(tile.w).toBe(CONTAINER.w);
        expect(tile.h % GRID).toBe(0);
        expect(tile.h).toBeGreaterThanOrEqual(
          CONTAINER.header + CONTAINER.row * container.rows.length + CONTAINER.padding,
        );
        for (const port of tile.ports ?? []) {
          expect(port.y % GRID, `${tile.id} ${port.id}`).toBe(0);
          expect(port.y > 0 && port.y < tile.h, `${tile.id} ${port.id}`).toBe(true);
        }
        const ids = (tile.ports ?? []).map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
      }

      // Every lane edge draws at least one line, in edge order; every line has its edge, whose
      // dashes and band it copies.
      expect([...new Set(view.lines.map((l) => view.connectionOf(l.id)))]).toEqual(
        graph.edges.map((e) => e.id),
      );
      for (const [i, edge] of graph.edges.entries()) {
        const drawn = view.lines.filter((l) => l.connection === edge.id);
        expect(drawn.length, edge.id).toBeGreaterThan(0);
        expect(view.linesOf(edge.id)).toEqual(drawn.map((l) => l.id));
        for (const line of drawn) {
          expect(line.source).toBe(edge.source);
          expect(line.target).toBe(edge.target);
          expect(line.dashed).toBe(edge.dashed);
          expect(line.directed).toBe(true);
          expect(line.band).toBe(overview.lines[i]?.band);
          expect(view.connectionOf(line.id)).toBe(edge.id);
        }
      }
      // Line ends: a container's ports only (never its default port), each port its tile has.
      const tiles = new Map(view.tiles.map((t) => [t.id, t]));
      for (const line of view.lines) {
        for (const [tile, port, side] of [
          [line.source, line.sourcePort, "out"],
          [line.target, line.targetPort, "in"],
        ] as const) {
          if (!view.containers.has(tile)) expect(port, line.id).toBeUndefined();
          else expect(tiles.get(tile)?.ports?.find((p) => p.id === port)?.side, line.id).toBe(side);
        }
      }

      // Every module link to a tile is exactly one line end at its row; a row has a port only for
      // the lines drawn at it.
      for (const link of studio?.componentConnections ?? []) {
        if (link.to.kind !== "element") continue;
        const row = view.rowOf(link.from);
        const ends = view.linesOf(link.to.via).flatMap((id) => {
          const l = view.lines.find((x) => x.id === id);
          return [
            l?.sourceModule === link.from && l.sourcePort === row?.out,
            l?.targetModule === link.from && l.targetPort === row?.in,
          ].filter(Boolean);
        });
        expect(ends.length, link.id).toBe(1);
      }
      for (const row of rows) {
        const lines = view.lines.filter(
          (l) => l.sourceModule === row.module || l.targetModule === row.module,
        );
        expect(row.out === undefined, row.module).toBe(
          !lines.some((l) => l.sourceModule === row.module),
        );
        expect(row.in === undefined, row.module).toBe(
          !lines.some((l) => l.targetModule === row.module),
        );
      }

      // The board takes the lines as they are.
      const specs: readonly LineSpec[] = view.lines;
      expect(specs).toBe(view.lines);

      // Unique IDs, the same on every run.
      const ids = view.lines.map((l) => l.id);
      expect(new Set(ids).size).toBe(ids.length);
      const again = project(load()).view;
      expect(again.lines).toEqual(view.lines);
      expect(again.tiles).toEqual(view.tiles);
    });
  }

  it("draws the owner's sketch for the v2 Video lifecycle worker", () => {
    const { view } = project(designSchema.parse(structuredClone(v2)));
    const worker = "completion-handler";
    expect(view.containers.get(worker)?.rows.map((r) => [r.name, r.y])).toEqual([
      ["Processing consumer", 64],
      ["Lifecycle writer", 96],
      ["Publication outbox publisher", 128],
    ]);
    expect(view.tiles.find((t) => t.id === worker)).toMatchObject({ w: 256, h: 160 });
    const drawn = view.lines
      .filter((l) => l.source === worker || l.target === worker)
      .map(({ id, source, sourcePort, target, targetPort, dashed, label }) => ({
        id,
        source,
        sourcePort,
        target,
        targetPort,
        dashed,
        label,
      }));
    expect(drawn).toEqual([
      {
        id: "completions-handler/handler-consumer",
        source: "completion-events",
        sourcePort: undefined,
        target: worker,
        targetPort: rowPort("handler-consumer", "in"),
        dashed: true,
        label: "Processing events to Processing consumer (Video lifecycle worker)",
      },
      {
        id: "handler-metadata/handler-writer",
        source: worker,
        sourcePort: rowPort("handler-writer", "out"),
        target: "metadata-db",
        targetPort: undefined,
        dashed: false,
        label: "Lifecycle writer (Video lifecycle worker) to Metadata database",
      },
      {
        id: "handler-metadata/handler-publications",
        source: worker,
        sourcePort: rowPort("handler-publications", "out"),
        target: "metadata-db",
        targetPort: undefined,
        dashed: false,
        label: "Publication outbox publisher (Video lifecycle worker) to Metadata database",
      },
      {
        id: "handler-publication/handler-publications",
        source: worker,
        sourcePort: rowPort("handler-publications", "out"),
        target: "publication-events",
        targetPort: undefined,
        dashed: true,
        label: "Publication outbox publisher (Video lifecycle worker) to Publication events",
      },
    ]);
    expect(view.tiles.find((t) => t.id === worker)?.ports).toEqual([
      { id: "handler-consumer:in", side: "in", y: 64 },
      { id: "handler-writer:out", side: "out", y: 96 },
      { id: "handler-publications:out", side: "out", y: 128 },
    ]);
  });

  it("attaches entries and unused links at the header, pairs both anchors, lists partners", () => {
    const design = studioArchitectureExample("studio-tinyurl").design;
    const studio = design.architecture?.studio;
    const template = design.connections.find((c) => c.id === "redirect-db");
    if (!studio?.components || !studio.componentConnections || !template) throw new Error("study");
    // A call between two module hosts, used by two modules on one side and one on the other, and
    // the Shorten service's database link with no module on it.
    design.connections.push({
      ...template,
      id: "shorten-call",
      from: { element: "shorten" },
      to: { element: "redirect" },
    });
    const custom = (id: string, host: string) => ({
      id,
      host,
      name: id,
      settings: { kind: "custom" as const },
    });
    studio.components.push(
      custom("shorten-caller", "shorten"),
      custom("redirect-callee", "redirect"),
      custom("shorten-caller-two", "shorten"),
    );
    const via = (id: string, from: string, to: string) => ({
      id,
      from,
      to: { kind: "element" as const, id: to, via: "shorten-call" },
    });
    studio.componentConnections = [
      ...studio.componentConnections.filter((l) => l.id !== "shorten-data-writes"),
      via("callee-link", "redirect-callee", "shorten"),
      via("caller-two-link", "shorten-caller-two", "redirect"),
      via("caller-link", "shorten-caller", "redirect"),
    ];
    const { view } = project(design);

    const line = (id: string) => view.lines.find((l) => l.id === id);
    expect(view.linesOf("shorten-call")).toEqual([
      "shorten-call/shorten-caller/redirect-callee",
      "shorten-call/shorten-caller-two/redirect-callee",
    ]);
    expect(line("shorten-call/shorten-caller/redirect-callee")).toMatchObject({
      sourcePort: rowPort("shorten-caller", "out"),
      targetPort: rowPort("redirect-callee", "in"),
      label: "shorten-caller (Shorten service) to redirect-callee (Redirect service)",
    });
    // An entry, and a link no module uses, attach at the header.
    expect(line("upload-shorten")).toMatchObject({
      targetPort: HEADER_IN,
      label: expect.any(String),
    });
    expect(line("shorten-db")).toMatchObject({ sourcePort: HEADER_OUT, connection: "shorten-db" });
    expect(view.tiles.find((t) => t.id === "shorten")?.ports).toEqual([
      { id: HEADER_IN, side: "in", y: 32 },
      { id: HEADER_OUT, side: "out", y: 32 },
      { id: "shorten-caller:out", side: "out", y: 96 },
      { id: "shorten-caller-two:out", side: "out", y: 128 },
    ]);
    // The data module lost its only link: a row with no port.
    expect(view.rowOf("shorten-data")).toMatchObject({ index: 0, y: 64 });
    expect(view.rowOf("shorten-data")?.in).toBeUndefined();
    expect(view.rowOf("shorten-data")?.out).toBeUndefined();
    // The user's line keeps no X; in-process links are partners, not lines.
    expect(line("@actor-download")).toMatchObject({
      removable: false,
      connection: "@actor-download",
    });
    expect(view.lines.some((l) => l.id.includes("responder"))).toBe(false);
    expect(view.partners("redirect-responder")).toEqual([
      "redirect-cache-reader",
      "redirect-click-publisher",
    ]);
    expect(view.partners("redirect-cache-reader")).toEqual(["redirect-data", "redirect-responder"]);
    expect(view.partners("redirect-callee")).toEqual([]);
  });
});

// Layout smoke: each Detailed input with real ELK, as the canvas lays it out.
const elk = new ELK();
const layoutOf = (input: LayoutInput, previous?: Record<string, Point>) =>
  createLayoutEngine(elk, { debounceMs: 0 }).request(input, previous);

function checkLayout(input: LayoutInput, layout: BoardLayout): string[] {
  const out: string[] = [];
  const tiles = new Map(input.tiles.map((t) => [t.id, t]));
  const box = (id: string) => {
    const tile = tiles.get(id);
    const at = layout.positions[id];
    if (!tile || !at) throw new Error(`no tile ${id}`);
    return { ...at, w: tile.w, h: tile.h };
  };
  for (const t of input.tiles) if (box(t.id).x % GRID) out.push(`${t.id} x off the grid`);
  for (const line of input.lines) {
    const route = layout.routes[line.id] ?? [];
    const [s, t] = [box(line.source), box(line.target)];
    const start = { x: s.x + s.w, y: s.y + portOffset(tiles.get(line.source), line.sourcePort) };
    const end = { x: t.x, y: t.y + portOffset(tiles.get(line.target), line.targetPort) };
    if (JSON.stringify(route.at(0)) !== JSON.stringify(start)) out.push(`${line.id} start`);
    if (JSON.stringify(route.at(-1)) !== JSON.stringify(end)) out.push(`${line.id} end`);
    if (start.y % GRID || end.y % GRID) out.push(`${line.id} port off the grid`);
    for (const [a, b] of route.slice(0, -1).map((p, i) => [p, route[i + 1] as Point])) {
      if (!a || !b) continue;
      if (a.x !== b.x && a.y !== b.y) out.push(`${line.id} diagonal`);
      for (const tile of input.tiles) {
        const r = box(tile.id);
        const [x0, x1, y0, y1] = [
          Math.min(a.x, b.x),
          Math.max(a.x, b.x),
          Math.min(a.y, b.y),
          Math.max(a.y, b.y),
        ];
        if (x0 < r.x + r.w && x1 > r.x && y0 < r.y + r.h && y1 > r.y)
          out.push(`${line.id} through ${tile.id}`);
      }
    }
  }
  return out;
}

describe("detailed view layout", () => {
  for (const [name, load] of designs) {
    it(`${name}: ports on the grid, no line through a tile, a relayout unchanged`, async () => {
      const { view } = project(load());
      const input: LayoutInput = { tiles: view.tiles, lines: view.lines };
      const layout = await layoutOf(input);
      expect(checkLayout(input, layout)).toEqual([]);
      expect(await layoutOf(input, layout.positions)).toEqual(layout);
    });
  }
});
