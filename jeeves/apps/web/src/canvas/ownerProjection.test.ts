import {
  applyOperations,
  buildOwnershipCommand,
  designBlueprintV3,
  laneGraph,
  ownershipSchema,
  studioArchitectureExample,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import fixture from "../../../../packages/spec/src/fixtures/nc02-ownership-v1.json" with {
  type: "json",
};
import { ownerNodeId, projectOwnerGraph } from "./ownerProjection.ts";

it("projects one selectable owner without losing canonical roles/edges or full exported contracts", () => {
  const old = studioArchitectureExample("studio-tinyurl").design;
  const applied = applyOperations(
    old,
    buildOwnershipCommand(old, { ownership: ownershipSchema.parse(fixture), upgrade: true }).ops,
  );
  if (!applied.ok) throw new Error();
  const design = applied.design,
    graph = laneGraph(design),
    before = structuredClone(design),
    bp = designBlueprintV3(design);
  const collapsed = projectOwnerGraph(design, graph, []);
  expect(collapsed.graph.nodes.filter((x) => x.id === ownerNodeId("links"))).toHaveLength(1);
  expect(collapsed.roleToView.get("shorten")).toBe(ownerNodeId("links"));
  expect(collapsed.graph.edges.map((x) => x.id)).toEqual(graph.edges.map((x) => x.id));
  expect(collapsed.graph.edges.find((x) => x.id === "redirect-db")).toMatchObject({
    source: ownerNodeId("links"),
    target: "url-db",
  });
  expect(projectOwnerGraph(design, graph, ["links"]).graph).toEqual(graph);
  expect(design).toEqual(before);
  expect(designBlueprintV3(design)).toEqual(bp);
});

describe("unsafe collapsed projections use canonical expansion", () => {
  it.each(["self", "cycle"])(
    "retains a single logical owner for %s edges without disabling semantic validation",
    (kind) => {
      const old = studioArchitectureExample("studio-tinyurl").design;
      const applied = applyOperations(
        old,
        buildOwnershipCommand(old, { ownership: ownershipSchema.parse(fixture), upgrade: true })
          .ops,
      );
      if (!applied.ok) throw new Error();
      const graph = {
        nodes: [{ id: "shorten" }, { id: "middle" }, { id: "redirect" }],
        edges:
          kind === "self"
            ? [
                {
                  id: "canonical",
                  source: "shorten",
                  target: "redirect",
                  async: false,
                  dashed: false,
                },
              ]
            : [
                { id: "first", source: "shorten", target: "middle", async: false, dashed: false },
                { id: "second", source: "middle", target: "redirect", async: false, dashed: false },
              ],
      };
      const view = projectOwnerGraph(applied.design, graph, []);
      expect(view.graph).toEqual(graph);
      expect(view.fallbackOwners).toEqual(["links"]);
      expect(view.roleToView.size).toBe(0);
      expect(designBlueprintV3(applied.design).ownership.owners).toHaveLength(1);
    },
  );
});
