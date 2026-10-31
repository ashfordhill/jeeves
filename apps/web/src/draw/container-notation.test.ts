import { builtinRegistry } from "@jeeves/registry";
import {
  architectureExample,
  architectureViews,
  designSchema,
  emptyLayout,
  plannedCapability,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import qr from "../../../../fixtures/designs/qrwty-architecture.json";
import { SYSTEM_BOUNDARY, withContainerNotation } from "./container-notation.tsx";
import { buildEdges, buildNodes, type ElementNode } from "./flow.ts";

it("derives an enclosing boundary from measured containers while excluding annotations and external blocks", () => {
  const { design, layout } = architectureExample("link-platform");
  design.elements.push({
    id: "identity",
    name: "Identity provider",
    template: null,
    planned: "identity-provider",
    config: {},
    attachments: [],
    notes: "",
  });
  layout.items.identity = { x: 40, y: 40 };
  design.annotations.push({ id: "far-note", kind: "text", text: "Outside annotation" });
  layout.items["far-note"] = { x: -5000, y: -5000 };
  const before = structuredClone({ design, layout });
  const nodes = buildNodes(design, layout, new Map());
  const api = nodes.find((node) => node.type === "element") as ElementNode;
  api.position = { x: -200, y: -100 };
  api.measured = { width: 700, height: 420 };
  const result = withContainerNotation(design, nodes, "Links");
  const boundary = result.find((node) => node.id === SYSTEM_BOUNDARY)!;
  for (const node of result.filter(
    (item) =>
      item.type === "element" && plannedCapability(item.data.element.planned)?.role !== "external",
  )) {
    expect(node.position.x).toBeGreaterThanOrEqual(boundary.position.x);
    expect(node.position.y).toBeGreaterThanOrEqual(boundary.position.y);
  }
  const external = result.find((node) => node.id === "identity")!;
  expect(external.position.x).toBeGreaterThan(boundary.position.x + boundary.width!);
  expect(boundary.position.x).toBe(-240);
  expect(boundary.position.y).toBe(-160);
  expect(boundary.width).toBeGreaterThanOrEqual(780);
  expect(result.filter((node) => node.type === "context").length).toBeGreaterThan(0);
  expect({ design, layout }).toEqual(before);
});

it("shows only system participants and routes bound/unbound relationships without semantic or layout writes", () => {
  const design = designSchema.parse(qr);
  design.architecture!.relationships[0]!.container = undefined;
  design.architecture!.nodes.push({
    id: "unrelated",
    kind: "person",
    name: "Unrelated",
    description: "No system interaction",
  });
  const before = structuredClone(design);
  const nodes = withContainerNotation(design, buildNodes(design, emptyLayout(), new Map()), "QR");
  expect(nodes.some((node) => node.id === "context:unrelated")).toBe(false);
  const relationship = design.architecture!.relationships[0]!;
  const edge = buildEdges(design).find((edge) => edge.id === `context:${relationship.id}`)!;
  expect([edge.source, edge.target]).toContain(SYSTEM_BOUNDARY);
  const projection = architectureViews(design, builtinRegistry(), "QR").containers;
  expect(projection.nodes.some((node) => node.id === SYSTEM_BOUNDARY)).toBe(true);
  expect(projection.edges.find((edge) => edge.id === `context:${relationship.id}`)).toMatchObject({
    to: SYSTEM_BOUNDARY,
  });
  expect(design).toEqual(before);
});
