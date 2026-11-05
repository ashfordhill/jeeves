import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { pruneLayout } from "./layout.ts";
import {
  designBlueprint,
  designBlueprintJsonSchema,
  designBlueprintSchema,
} from "./studio-blueprint.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { type StudioScopeProjection, studioViews } from "./studio-view.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;
const views = (design = tinyurl()) => studioViews(design, studioDefinitions, "TinyURL");
const edge = (scope: StudioScopeProjection, from: string, to: string) =>
  scope.edges.find((item) => item.from === `studio:${from}` && item.to === `studio:${to}`);

describe("studioViews", () => {
  it("projects TinyURL into C1, C2 and C3 under stable keys", () => {
    const { context, containers, components } = views();
    expect(
      [context, containers, components].map((s) => [s.key, s.nodes.length, s.edges.length]),
    ).toEqual([
      ["studio:context", 1, 0],
      ["studio:containers", 8, 8],
      ["studio:components", 20, 16],
    ]);
    expect(context.nodes.map((n) => n.id)).toContain("studio:context:system");
  });

  it("draws a package as a C2 frame around its members and hides queues behind their flows", () => {
    const design = tinyurl();
    design.architecture?.studio?.packages.push({
      id: "link-platform",
      name: "Link platform",
      description: "",
      members: ["shorten-api", "redirect"],
    });
    const { containers } = views(design);
    const frame = containers.nodes.find((n) => n.id === "studio:package:link-platform");
    expect(frame?.frame).toBe(true);
    expect(containers.nodes.filter((n) => n.parent === frame?.id).map((n) => n.id)).toEqual([
      "studio:element:redirect",
      "studio:element:shorten-api",
    ]);
    expect(containers.nodes.some((n) => n.id === "studio:element:click-events")).toBe(false);
    // The click queue's producer and consumer read as one C2 relationship.
    expect(edge(containers, "element:redirect", "element:analytics")).toBeDefined();
  });

  it("merges every relationship between the same two boxes into one line", () => {
    const design = tinyurl();
    const check = design.connections.find((item) => item.id === "shorten-reputation");
    if (!check) throw new Error("TinyURL checks destinations.");
    design.connections.push({
      ...check,
      id: "shorten-reputation-report",
      planned: { ...check.planned, label: "Reports abuse" },
    });
    const { containers } = views(design);
    const merged = edge(containers, "element:shorten-api", "element:reputation");
    expect(merged?.members).toHaveLength(2);
    const pairs = containers.edges.map((e) => `${e.from}>${e.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("draws C3 applications as frames holding their components", () => {
    const { components } = views();
    const inside = (host: string) =>
      components.nodes.filter((n) => n.parent === `studio:element:${host}`).length;
    expect([inside("shorten-api"), inside("redirect"), inside("analytics")]).toEqual([4, 4, 3]);
    expect(components.nodes.find((n) => n.id === "studio:element:redirect")?.frame).toBe(true);
    expect(edge(components, "component:redirect-data", "element:links-db")).toBeDefined();
  });

  it("does not depend on document order", () => {
    const shuffled = tinyurl();
    shuffled.elements.reverse();
    shuffled.connections.reverse();
    expect(views(shuffled)).toEqual(views());
  });
});

describe("designBlueprint", () => {
  it("exports TinyURL as a schema-valid, deterministic blueprint", () => {
    const design = tinyurl();
    const before = structuredClone(design);
    const blueprint = designBlueprint(design, "TinyURL");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(design).toEqual(before);
    expect(blueprint).toMatchObject({ blueprint: 1, revision: design.revision, findings: [] });
    expect(blueprint.services.map((s) => s.id)).toEqual(["analytics", "redirect", "shorten-api"]);
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "cdn" },
      { lane: "upload", element: "shorten-api" },
    ]);
    expect(blueprint.connections).toHaveLength(9);
    expect(blueprint.componentLinks).toHaveLength(15);
    expect(blueprint.omitted).toEqual([]);

    const shuffled = tinyurl();
    shuffled.elements.reverse();
    expect(designBlueprint(shuffled, "TinyURL")).toEqual(blueprint);
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

describe("pruneLayout", () => {
  it("keeps live rows in their order and drops removed identities", () => {
    const result = applyOperations(tinyurl(), [{ op: "removeElement", id: "reputation" }]);
    if (!result.ok) throw new Error("rejected");
    const viewport = { x: 1, y: 2, zoom: 1 };
    const layout = {
      schemaVersion: 1 as const,
      architecture: {
        "studio:containers": {
          order: [
            "studio:element:cdn",
            "studio:element:reputation",
            "studio:element:redirect",
            "studio:component:shorten-data",
          ],
          viewport,
        },
      },
    };
    expect(pruneLayout(layout, result.design).architecture?.["studio:containers"]).toEqual({
      order: ["studio:element:cdn", "studio:element:redirect", "studio:component:shorten-data"],
      viewport,
    });
  });
});
