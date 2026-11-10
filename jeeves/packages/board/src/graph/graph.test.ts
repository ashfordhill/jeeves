// Ported from automation-illustrator src/workflow/graph.test.ts, commands.test.ts (0803c4a).
import { describe, expect, it } from "vitest";
import { checkGraph } from "./check.ts";
import {
  addAfter,
  applyRemoval,
  link,
  nextTileAfterRemoval,
  planRemoval,
  removeEdge,
} from "./edit.ts";
import type { BoardGraph, Result, Rules } from "./types.ts";

const rules: Rules = { root: "r", maxOut: 2 };

/** A graph from tile ids and `[id, source, target, async?]` links. */
function graph(nodes: string[], edges: [string, string, string, boolean?][]): BoardGraph {
  return {
    nodes: nodes.map((id) => ({ id })),
    edges: edges.map(([id, source, target, async]) => ({ id, source, target, async: !!async })),
  };
}
/** `source>target`, with `~` for an async link. */
const links = (g: BoardGraph) => g.edges.map((e) => `${e.source}>${e.target}${e.async ? "~" : ""}`);
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value;
}
const code = (result: Result<unknown>) => (result.ok ? "ok" : result.code);

describe("checkGraph", () => {
  it("reports cycles, tiles the root cannot reach and links the rules refuse", () => {
    const g = graph(
      ["r", "a", "b", "island"],
      [
        ["e1", "r", "a"],
        ["e2", "a", "b"],
        ["e3", "b", "a"],
      ],
    );
    const refuseIsland = { ...rules, canLink: (source: string) => source !== "b" };
    expect(checkGraph(g, refuseIsland).map((v) => [v.code, v.node ?? v.edge])).toEqual([
      ["refused-link", "e3"],
      ["cycle", "a"],
      ["unreachable", "island"],
    ]);
    // Edits refuse an invalid starting graph.
    expect(code(addAfter(g, "r", { id: "c" }, { id: "e4" }, rules))).toBe("cycle");
  });
});

describe("adding and linking", () => {
  it("forks after a tile and merges with link", () => {
    const start = graph(["r", "a"], [["e1", "r", "a"]]);
    const fork = value(addAfter(start, "a", { id: "b" }, { id: "e2" }, rules));
    const forked = value(addAfter(fork, "a", { id: "c" }, { id: "e3", async: true }, rules));
    const merged = value(link(forked, "b", "c", { id: "e4" }, rules));
    expect(links(merged)).toEqual(["r>a", "a>b", "a>c~", "b>c"]);
    expect(checkGraph(merged, rules)).toEqual([]);
  });

  it("refuses cycles, duplicates, self-links, refused links and too many links", () => {
    const g = graph(
      ["r", "a", "b", "c"],
      [
        ["e1", "r", "a"],
        ["e2", "a", "b"],
        ["e3", "a", "c"],
      ],
    );
    expect(code(link(g, "b", "a", { id: "x" }, rules))).toBe("cycle");
    expect(code(link(g, "a", "b", { id: "x" }, rules))).toBe("duplicate-link");
    expect(code(link(g, "b", "b", { id: "x" }, rules))).toBe("self-link");
    expect(code(addAfter(g, "b", { id: "a" }, { id: "x" }, rules))).toBe("duplicate-id");
    const syncOnly = { ...rules, canLink: (_s: string, _t: string, async: boolean) => !async };
    expect(code(addAfter(g, "b", { id: "d" }, { id: "x", async: true }, syncOnly))).toBe(
      "refused-link",
    );
    expect(code(addAfter(g, "b", { id: "d" }, { id: "x" }, syncOnly))).toBe("ok");
    // `a` already has maxOut (2) links; the root has no cap.
    const full = addAfter(g, "a", { id: "d" }, { id: "x" }, rules);
    expect(full).toMatchObject({ ok: false, code: "too-many-links" });
    const fromRoot = value(addAfter(g, "r", { id: "d" }, { id: "x" }, rules));
    expect(code(addAfter(fromRoot, "r", { id: "f" }, { id: "y" }, rules))).toBe("ok");
  });
});

describe("removal", () => {
  it("restitches 1:1 and 1:N, async when a replaced link was", () => {
    const chain = graph(
      ["r", "m", "t"],
      [
        ["e1", "r", "m"],
        ["e2", "m", "t", true],
      ],
    );
    const plan = value(planRemoval(chain, "m", rules));
    expect(plan).toEqual({
      nodeId: "m",
      removeEdges: ["e1", "e2"],
      addEdges: [{ id: "r->t", source: "r", target: "t", async: true }],
      strands: [],
    });
    expect(links(value(applyRemoval(chain, plan, [], rules)))).toEqual(["r>t~"]);

    const fan = graph(
      ["r", "n", "a", "b"],
      [
        ["e1", "r", "n"],
        ["e2", "n", "a"],
        ["e3", "n", "b"],
      ],
    );
    const fanned = value(applyRemoval(fan, value(planRemoval(fan, "n", rules)), [], rules));
    expect(links(fanned)).toEqual(["r>a", "r>b"]);
    expect(code(planRemoval(fan, "r", rules))).toBe("root");
  });

  it("restitches N:1 and M:N with fan pairings and drops pairs already reachable", () => {
    const g = graph(
      ["r", "a", "b", "n", "c"],
      [
        ["e1", "r", "a"],
        ["e2", "r", "b"],
        ["e3", "a", "n"],
        ["e4", "b", "n", true],
        ["e5", "n", "c"],
      ],
    );
    const manyToOne = value(planRemoval(g, "n", rules));
    expect(links({ nodes: [], edges: manyToOne.addEdges })).toEqual(["a>c", "b>c~"]);

    const manyToMany = value(addAfter(g, "n", { id: "d2" }, { id: "e6" }, rules));
    const plan = value(planRemoval(manyToMany, "n", rules));
    expect(links({ nodes: [], edges: plan.addEdges })).toEqual(["a>c", "a>d2", "b>c~", "b>d2~"]);

    // r → m → t and r → d → t: removing m needs no r → t.
    const diamond = graph(
      ["r", "m", "d", "t"],
      [
        ["e1", "r", "m"],
        ["e2", "m", "t"],
        ["e3", "r", "d"],
        ["e4", "d", "t"],
      ],
    );
    expect(value(planRemoval(diamond, "m", rules)).addEdges).toEqual([]);

    // A restitch that would give `p` three links is refused with maxOut 2.
    const crowded = graph(
      ["r", "p", "a", "n", "b", "c"],
      [
        ["e1", "r", "p"],
        ["e2", "p", "a"],
        ["e3", "p", "n"],
        ["e4", "n", "b"],
        ["e5", "n", "c"],
      ],
    );
    expect(code(planRemoval(crowded, "n", rules))).toBe("too-many-links");
  });

  it("strands what a refused pairing cuts off and needs every strand named", () => {
    const g = graph(
      ["r", "s", "db", "x", "t"],
      [
        ["e1", "r", "s"],
        ["e2", "s", "db"],
        ["e3", "s", "t"],
        ["e4", "db", "x"],
      ],
    );
    const noRootToDb = { ...rules, canLink: (s: string, t: string) => !(s === "r" && t === "db") };
    const plan = value(planRemoval(g, "s", noRootToDb));
    expect(plan.strands).toEqual(["db", "x"]);
    expect(links({ nodes: [], edges: plan.addEdges })).toEqual(["r>t"]);

    const unnamed = applyRemoval(g, plan, ["db"], noRootToDb);
    expect(unnamed).toMatchObject({ ok: false, code: "strands" });
    expect(unnamed.ok ? "" : unnamed.message).toContain('"x"');
    expect(code(applyRemoval(g, plan, ["db", "x", "t"], noRootToDb))).toBe("strands");

    const removed = value(applyRemoval(g, plan, ["x", "db"], noRootToDb));
    expect(removed.nodes.map((n) => n.id)).toEqual(["r", "t"]);
    expect(links(removed)).toEqual(["r>t"]);
  });

  it("removes a link only when nothing is cut off", () => {
    const diamond = graph(
      ["r", "m", "d", "t"],
      [
        ["e1", "r", "m"],
        ["e2", "m", "t"],
        ["e3", "r", "d"],
        ["e4", "d", "t"],
      ],
    );
    expect(links(value(removeEdge(diamond, "e2", rules)))).toEqual(["r>m", "r>d", "d>t"]);
    const cut = removeEdge(diamond, "e1", rules);
    expect(cut).toMatchObject({ ok: false, code: "strands" });
    expect(cut.ok ? "" : cut.message).toContain('"m"');
    expect(code(removeEdge(diamond, "nope", rules))).toBe("missing-ref");
  });

  it("selects the parent after a removal, then a remaining child, else none", () => {
    const chain = graph(["r", "a"], [["e1", "r", "a"]]);
    expect(nextTileAfterRemoval(chain, ["r"], [])).toBe("r");
    expect(nextTileAfterRemoval(chain, ["gone"], ["a"])).toBe("a");
    expect(nextTileAfterRemoval(graph([], []), ["r"], ["a"])).toBeNull();
  });
});
