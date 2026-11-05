import { addAfter } from "@jeeves/board/graph";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { isStructural } from "./findings.ts";
import { designBlueprint, designBlueprintSchema } from "./studio-blueprint.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { LANE_ACTOR, laneFindings, laneGraph, laneRules } from "./studio-lanes.ts";
import { type StudioLinkMode, studioEntryKinds, studioLinkDefaults } from "./studio-links.ts";
import { type StudioKind, type StudioModel, studioKinds } from "./studio-model.ts";
import { defaultKind, studioTileDefinitions, studioTileTypes, tileTypeOf } from "./studio-tiles.ts";
import { validateDesign } from "./validate.ts";

const studioOf = (design: DesignDocument): StudioModel => {
  const studio = design.architecture?.studio;
  if (!studio) throw new Error("No studio model.");
  return studio;
};
const edit = (design: DesignDocument, change: (draft: DesignDocument) => void) => {
  const draft = structuredClone(design);
  change(draft);
  return draft;
};
const applied = (result: ReturnType<typeof applyOperations>) => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
const connection = (id: string, from: string, to: string): DesignDocument["connections"][0] => ({
  id,
  kind: "calls",
  from: { element: from },
  to: { element: to },
  planned: {
    label: "Calls",
    protocol: "HTTPS",
    interaction: "Request / response",
    security: "Service identity",
  },
});

/** The TinyURL study: the user enters at the CDN (download) and the Shorten API (upload). */
const tinyurl = (): DesignDocument => studioArchitectureExample("studio-tinyurl").design;
const messages = (design: DesignDocument) =>
  laneFindings(design).map((item) => {
    expect(item.code).toBe("LANE_INVALID");
    return item.message;
  });

describe("link rules", () => {
  it("allow exactly the plan's pairs in each mode", () => {
    const apps = [
      "service",
      "worker",
      "billing",
      "redirect",
      "notification",
      "identity",
      "gateway",
    ];
    const expected = new Set<string>();
    const allow = (sources: string[], targets: string[], mode: StudioLinkMode) => {
      for (const source of sources)
        for (const target of targets) expected.add(`${source}>${target}:${mode}`);
    };
    allow(apps, [...apps, "database", "cache", "object-store", "search", "cdn"], "sync");
    allow(apps, [...apps, "external-api", "queue"], "async");
    allow(apps, ["external-api"], "sync");
    allow(["queue"], apps, "async");
    allow(["external-api"], apps, "sync");
    allow(["external-api"], apps, "async");
    allow(["cdn"], [...apps, "object-store"], "sync");

    const actual = new Set<string>();
    for (const source of studioKinds)
      for (const target of studioKinds)
        for (const mode of ["sync", "async"] as const) {
          const link = studioLinkDefaults(source, target, mode);
          if (link.ok) actual.add(`${source}>${target}:${mode}`);
          else expect(link.message).toMatch(/^[A-Z].*\.$/);
        }
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it("give each link its connection and name refusals in plain words", () => {
    const link = (source: StudioKind, target: StudioKind, mode: StudioLinkMode) => {
      const result = studioLinkDefaults(source, target, mode);
      return result.ok ? result.value : result.message;
    };
    expect(link("redirect", "database", "sync")).toEqual({
      kind: "uses-database",
      planned: {
        label: "Reads & writes",
        protocol: "SQL",
        interaction: "Request / response",
        security: "Service identity",
      },
      settings: {},
    });
    expect(link("redirect", "cache", "sync")).toMatchObject({ planned: { protocol: "Redis" } });
    expect(link("service", "search", "sync")).toMatchObject({ kind: "depends-on" });
    expect(link("cdn", "redirect", "sync")).toMatchObject({ kind: "calls" });
    expect(link("service", "worker", "async")).toMatchObject({
      kind: "calls",
      planned: { interaction: "Asynchronous", protocol: "HTTPS" },
    });
    expect(link("redirect", "queue", "async")).toMatchObject({
      planned: { label: "Publishes", protocol: "Messaging", interaction: "Asynchronous" },
      settings: { channelUse: "publish" },
    });
    expect(link("queue", "worker", "async")).toMatchObject({ settings: { channelUse: "consume" } });
    expect(link("cache", "service", "sync")).toBe("A cache can't link onward.");
    expect(link("service", "queue", "sync")).toMatch(/queue is asynchronous/);
    expect(link("service", "database", "async")).toMatch(/request/);
    expect(link("external-api", "queue", "async")).toMatch(/Only an application publishes/);
  });
});

describe("tile types and entries", () => {
  it("cover every kind but the browser once, with distinct kind icons", () => {
    for (const kind of studioKinds)
      expect(
        studioTileTypes.filter((type) => studioTileDefinitions[type].kinds.includes(kind)),
      ).toHaveLength(kind === "browser" ? 0 : 1);
    expect(tileTypeOf("search")).toBe("database");
    expect(tileTypeOf("browser")).toBeUndefined();
    const icons = studioKinds.map((kind) => studioDefinitions[kind].visual.icon);
    expect(new Set(icons).size).toBe(icons.length);
    expect(studioDefinitions.cache.visual.icon).toBe("bolt");

    expect(defaultKind("service")).toBe("service");
    expect(defaultKind("service", { after: "queue" })).toBe("worker");
    expect(defaultKind("service", { after: "redirect" })).toBe("service");
    expect(defaultKind("api")).toBe("gateway");
    expect(defaultKind("storage")).toBe("object-store");

    expect([...studioEntryKinds].sort()).toEqual(
      [
        "billing",
        "cdn",
        "external-api",
        "gateway",
        "identity",
        "notification",
        "object-store",
        "redirect",
        "service",
      ].sort(),
    );
  });

  it("are part of the model: unique IDs, live references, removed with their tile, in the blueprint", () => {
    const design = tinyurl();
    expect(validateDesign(design).filter(isStructural)).toEqual([]);

    const clash = edit(design, (draft) => {
      const entry = studioOf(draft).entries?.[0];
      if (entry) entry.id = "redirect";
    });
    expect(validateDesign(clash).map((item) => item.code)).toContain("DUPLICATE_ID");
    const dangling = structuredClone(studioOf(design));
    dangling.entries?.push({ id: "download-x", lane: "download", element: "nowhere" });
    expect(applyOperations(design, [{ op: "setStudio", studio: dangling }])).toMatchObject({
      ok: false,
      errors: [{ code: "UNKNOWN_REFERENCE" }],
    });

    // Redirect also starts the download lane, so removing the CDN strands nothing.
    const twoDoors = edit(design, (draft) => {
      studioOf(draft).entries?.push({
        id: "download-redirect",
        lane: "download",
        element: "redirect",
      });
    });
    const withoutCdn = applied(applyOperations(twoDoors, [{ op: "removeElement", id: "cdn" }]));
    expect(studioOf(withoutCdn).entries).toEqual([
      { id: "upload-shorten-api", lane: "upload", element: "shorten-api" },
      { id: "download-redirect", lane: "download", element: "redirect" },
    ]);
    // Validation enforces the lane rules: a batch that strands tiles is rejected.
    const stranding = applyOperations(design, [{ op: "removeElement", id: "cdn" }]);
    expect(stranding.ok ? [] : stranding.errors.map((item) => item.code)).toEqual(
      Array(4).fill("LANE_INVALID"),
    );

    const blueprint = designBlueprint(
      edit(design, (draft) => studioOf(draft).entries?.reverse()),
      "TinyURL",
    );
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "cdn" },
      { lane: "upload", element: "shorten-api" },
    ]);
    expect(blueprint.omitted).toEqual([]);
  });
});

describe("laneGraph", () => {
  it("orders download before upload and dashes async links and what follows them", () => {
    const graph = laneGraph(tinyurl());
    expect(graph.nodes.map((node) => node.id)).toEqual([
      LANE_ACTOR,
      "cdn",
      "redirect",
      "link-cache",
      "links-db",
      "click-events",
      "analytics",
      "analytics-store",
      "shorten-api",
      "reputation",
    ]);
    expect(graph.nodes[0]).toEqual({ id: LANE_ACTOR });
    expect(graph.nodes[1]).toEqual({ id: "cdn", kind: "cdn" });
    expect(graph.edges).toHaveLength(11);
    expect(graph.edges.slice(0, 2)).toEqual([
      {
        id: "download-cdn",
        source: LANE_ACTOR,
        target: "cdn",
        async: false,
        dashed: false,
        lane: "download",
      },
      {
        id: "upload-shorten-api",
        source: LANE_ACTOR,
        target: "shorten-api",
        async: false,
        dashed: false,
        lane: "upload",
      },
    ]);
    const ids = (pick: (edge: (typeof graph.edges)[0]) => boolean) =>
      graph.edges.filter(pick).map((edge) => edge.id);
    // Publish and consume are async; the analytics write continues after them.
    expect(ids((edge) => edge.async)).toEqual(["redirect-clicks", "click-events-analytics"]);
    expect(ids((edge) => edge.dashed)).toEqual([
      "redirect-clicks",
      "click-events-analytics",
      "analytics-write",
    ]);

    // Once the worker is also reached by a request, what follows it is solid again.
    const merged = laneGraph(
      edit(tinyurl(), (draft) => {
        draft.connections.push(connection("redirect-analytics", "redirect", "analytics"));
      }),
    );
    expect(merged.edges.filter((edge) => edge.dashed).map((edge) => edge.id)).toEqual([
      "redirect-clicks",
      "click-events-analytics",
    ]);
  });

  it("puts a both-lane entry between the download-only and upload-only entries", () => {
    // Stored upload first: the order comes from the lanes, not the list.
    const design = edit(tinyurl(), (draft) => {
      studioOf(draft).entries = [
        { id: "upload-shorten-api", lane: "upload", element: "shorten-api" },
        { id: "both-cdn", lane: "both", element: "cdn" },
        { id: "download-reputation", lane: "download", element: "reputation" },
      ];
    });
    const graph = laneGraph(design);
    expect(graph.nodes.map((node) => node.id)).toEqual([
      LANE_ACTOR,
      "reputation",
      "cdn",
      "redirect",
      "link-cache",
      "links-db",
      "click-events",
      "analytics",
      "analytics-store",
      "shorten-api",
    ]);
    expect(graph.edges.slice(0, 3).map((edge) => [edge.id, edge.lane])).toEqual([
      ["download-reputation", "download"],
      ["both-cdn", "both"],
      ["upload-shorten-api", "upload"],
    ]);
    expect(laneFindings(design)).toEqual([]);

    // A both-lane entry counts in each lane's cap; a tile still has one entry.
    const crowded = edit(design, (draft) => {
      studioOf(draft).entries?.push(
        { id: "download-redirect", lane: "download", element: "redirect" },
        { id: "download-shorten", lane: "download", element: "shorten-api" },
      );
    });
    expect(messages(crowded)).toEqual([
      "The download lane has 4 entries; the most is 3.",
      "Shorten API is already a lane entry.",
    ]);
  });
});

describe("laneFindings", () => {
  it("reports unreachable tiles, cycles, refused links and entries, and both caps", () => {
    const design = tinyurl();
    expect(laneFindings(design)).toEqual([]);

    const noUpload = edit(design, (draft) => {
      studioOf(draft).entries = studioOf(draft).entries?.filter((item) => item.lane !== "upload");
    });
    expect(messages(noUpload)).toEqual([
      "Shorten API can't be reached from the user; every tile hangs off a lane.",
      "URL reputation API can't be reached from the user; every tile hangs off a lane.",
    ]);

    const loop = edit(design, (draft) => {
      draft.connections.push(connection("analytics-redirect", "analytics", "redirect"));
    });
    expect(messages(loop)).toEqual([expect.stringMatching(/leads back to itself/)]);
    expect(laneFindings(loop)[0]?.target.element).toBeDefined();

    const refused = edit(design, (draft) => {
      draft.connections.push(connection("store-reputation", "analytics-store", "reputation"));
      studioOf(draft).entries?.push({ id: "download-db", lane: "download", element: "links-db" });
    });
    expect(messages(refused)).toEqual([
      "Links database can't start the download lane. A lane starts at a service (not a worker), an API, storage or an external API.",
      "Analytics store → URL reputation API: A database can't link onward.",
    ]);
    expect(laneFindings(refused).map((item) => item.target)).toEqual([
      { path: ["architecture", "studio", "entries", 2] },
      { connection: "store-reputation" },
    ]);

    const crowded = edit(design, (draft) => {
      studioOf(draft).entries = ["cdn", "redirect", "reputation", "shorten-api"].map((element) => ({
        id: `entry-${element}`,
        lane: "download" as const,
        element,
      }));
      draft.connections.push(
        connection("redirect-reputation", "redirect", "reputation"),
        connection("redirect-shorten", "redirect", "shorten-api"),
      );
    });
    expect(messages(crowded)).toEqual([
      "The download lane has 4 entries; the most is 3.",
      "Redirect service has 5 links; the most is 4.",
    ]);
  });
});

describe("laneRules", () => {
  it("drive board edits, checking a tile an edit adds against the link table", () => {
    const graph = laneGraph(tinyurl());
    const kinds = new Map(graph.nodes.map((node) => [node.id, node.kind]));
    const rules = (added: StudioKind) => laneRules((id) => (id === "new" ? added : kinds.get(id)));
    expect(addAfter(graph, "redirect", { id: "new" }, { id: "to-new" }, rules("search")).ok).toBe(
      true,
    );
    expect(
      addAfter(graph, "link-cache", { id: "new" }, { id: "to-new" }, rules("service")),
    ).toMatchObject({ ok: false, code: "refused-link" });
    expect(rules("service").refusal("link-cache", "new", false)).toBe("A cache can't link onward.");
    expect(rules("worker").refusal(LANE_ACTOR, "new", false)).toMatch(/^A lane starts at/);
  });
});
