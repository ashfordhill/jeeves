import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  designSchema,
  emptyLayout,
  type LayoutDocument,
  layoutSchema,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import linkShortener from "../../../../fixtures/designs/link-shortener.json";
import linkShortenerLayout from "../../../../fixtures/designs/link-shortener.layout.json";
import {
  attachmentFromHandle,
  buildEdges,
  buildNodes,
  type ElementNode,
  fallbackPosition,
  templateKey,
} from "./flow.ts";
import { cardChips } from "./nodes/ElementNode.tsx";
import { deleteOps } from "./ops.ts";

const registry = builtinRegistry();
const templates = new Map(
  registry
    .list()
    .map((m) => [
      templateKey(m),
      registry.describe(m) as NonNullable<ReturnType<typeof registry.describe>>,
    ]),
);
const design: DesignDocument = designSchema.parse(linkShortener);
const layout: LayoutDocument = layoutSchema.parse(linkShortenerLayout);

describe("buildNodes", () => {
  it("places elements and annotations from the layout", () => {
    const nodes = buildNodes(design, layout, templates);
    expect(nodes.map((n) => [n.id, n.type, n.position])).toEqual([
      ["note-analytics", "note", { x: 360, y: 240 }],
      ["links", "element", { x: 360, y: 0 }],
      ["links-db", "element", { x: 720, y: 0 }],
      ["web", "element", { x: 0, y: 0 }],
    ]);
    const links = nodes.find((n) => n.id === "links") as ElementNode;
    expect(links.data.template?.displayName).toBe("HTTP service");
    expect(links.data.attachments.map((a) => a.template?.displayName)).toEqual(["REST API server"]);
  });

  it("falls back to a grid for items with no layout and keeps measurements and selection", () => {
    const first = buildNodes(design, emptyLayout(), templates);
    expect(first.map((n) => n.position)).toEqual([0, 1, 2, 3].map(fallbackPosition));
    const measured = first.map((n) =>
      n.id === "links" ? { ...n, measured: { width: 240, height: 120 }, selected: true } : n,
    );
    const again = buildNodes(design, emptyLayout(), templates, measured);
    expect(again.find((n) => n.id === "links")).toMatchObject({
      measured: { width: 240, height: 120 },
      selected: true,
    });
  });
});

describe("buildEdges", () => {
  it("routes attachment connections through the mini-box handles", () => {
    const edges = buildEdges(design);
    expect(edges.map((e) => [e.id, e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual([
      ["links-uses-db", "links", "out", "links-db", "in"],
      ["web-calls-links", "web", "out:web-links-client", "links", "in:links-api"],
    ]);
    expect(attachmentFromHandle("in:links-api")).toBe("links-api");
    expect(attachmentFromHandle("out")).toBeUndefined();
  });

  it("draws bound arrows as edges", () => {
    const result = applyOperations(
      design,
      [
        {
          op: "addAnnotation",
          annotation: { id: "a1", kind: "arrow", from: "note-analytics", to: "links-api" },
        },
      ],
      registry,
    );
    if (!result.ok) throw new Error("fixture edit failed");
    const arrow = buildEdges(result.design).find((e) => e.id === "a1");
    expect(arrow).toMatchObject({
      type: "arrow",
      source: "note-analytics",
      target: "links",
      targetHandle: "in:links-api",
    });
  });
});

describe("cardChips", () => {
  it("shows stored values, defaults, and unset required values", () => {
    const service = templates.get("http-service@0.1.0");
    const web = templates.get("web-app@0.1.0");
    expect(cardChips(service, {})).toEqual([{ key: "port", label: "Port", value: "8080" }]);
    expect(cardChips(service, { port: 9000 })[0]?.value).toBe("9000");
    expect(cardChips(web, {})[0]?.value).toBe("not set");
  });
});

describe("deleteOps", () => {
  it("removes elements without disconnecting their cascaded connections twice", () => {
    const ops = deleteOps(
      design,
      ["links-db", "note-analytics"],
      ["links-uses-db", "web-calls-links"],
    );
    expect(ops).toEqual([
      { op: "removeElement", id: "links-db" },
      { op: "removeAnnotation", id: "note-analytics" },
      { op: "disconnect", id: "web-calls-links" },
    ]);
    expect(applyOperations(design, ops, registry).ok).toBe(true);
  });
});
