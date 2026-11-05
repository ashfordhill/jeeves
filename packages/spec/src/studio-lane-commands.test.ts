import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { laneChoices, laneTabs, planRemoveTile } from "./studio-lane-commands.ts";
import { LANE_ACTOR, laneFindings, laneGraph } from "./studio-lanes.ts";
import { createStudioSettings, type StudioModel } from "./studio-model.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";

const studioOf = (design: DesignDocument): StudioModel => {
  const studio = design.architecture?.studio;
  if (!studio) throw new Error("No studio model.");
  return studio;
};
const applied = (result: ReturnType<typeof applyOperations>) => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
/** TinyURL as plan §4 draws it: no Web app; the user enters at the CDN and the Shorten API. */
function tinyurlInLanes(): DesignDocument {
  const base = studioArchitectureExample("studio-tinyurl").design;
  const design = applied(
    applyOperations(base, buildStudioCommand(base, { type: "delete", elements: ["web"] }).ops),
  );
  const studio = structuredClone(studioOf(design));
  studio.entries = [
    { id: "download-cdn", lane: "download", element: "cdn" },
    { id: "upload-shorten", lane: "upload", element: "shorten-api" },
  ];
  return applied(applyOperations(design, [{ op: "setStudio", studio }]));
}
/** Builds the command and applies its batch; the result keeps every lane rule. */
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  const next = applied(applyOperations(design, batch.ops, { baseRevision: batch.baseRevision }));
  expect(laneFindings(next)).toEqual([]);
  return { ops: batch.ops.map((op) => op.op), design: next };
}
const refusal = (design: DesignDocument, command: StudioCommand) => {
  try {
    buildStudioCommand(design, command);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("The command was accepted.");
};
const connection = (design: DesignDocument, id: string) =>
  design.connections.find((item) => item.id === id);
const binding = (design: DesignDocument, id: string) =>
  studioOf(design).elements.find((item) => item.element === id);
const tile = (id: string, name: string, kind: StudioModel["elements"][0]["settings"]["kind"]) => ({
  id,
  name,
  kind,
});

describe("addTile", () => {
  it("adds after a tile, before a tile and from a lane, with owners and link defaults", () => {
    const design = tinyurlInLanes();
    const queue = run(design, {
      type: "addTile",
      from: { tile: "shorten-api" },
      side: "after",
      link: "async",
      tile: tile("link-events", "Link events", "queue"),
      linkId: "shorten-events",
    });
    expect(queue.ops).toEqual(["addElement", "connect", "setStudio"]);
    expect(binding(queue.design, "link-events")).toMatchObject({
      definition: { id: "studio-queue" },
      settings: createStudioSettings("queue"),
      owner: { kind: "element", id: "shorten-api" },
    });
    expect(connection(queue.design, "shorten-events")).toMatchObject({
      from: { element: "shorten-api" },
      to: { element: "link-events" },
      planned: { label: "Publishes", interaction: "Asynchronous" },
    });

    // Before an entry tile: the entry moves to the new tile and keeps its ID and lane.
    const gateway = run(design, {
      type: "addTile",
      from: { tile: "shorten-api" },
      side: "before",
      link: "sync",
      tile: tile("edge", "API gateway", "gateway"),
      linkId: "edge-shorten",
    }).design;
    expect(studioOf(gateway).entries).toEqual([
      { id: "download-cdn", lane: "download", element: "cdn" },
      { id: "upload-shorten", lane: "upload", element: "edge" },
    ]);
    expect(connection(gateway, "edge-shorten")).toMatchObject({ kind: "calls" });

    // Before a tile with two incoming links: both move, keep their IDs and modes, and take the
    // link table's defaults. Redirect's lookup no longer reaches a database, so it is cleared.
    const reader = run(design, {
      type: "addTile",
      from: { tile: "links-db" },
      side: "before",
      link: "sync",
      tile: tile("link-store", "Link store", "service"),
      linkId: "store-db",
    }).design;
    for (const id of ["shorten-db", "redirect-db"])
      expect(connection(reader, id)).toMatchObject({
        kind: "calls",
        to: { element: "link-store" },
        planned: { interaction: "Request / response" },
      });
    expect(connection(reader, "store-db")).toMatchObject({ kind: "uses-database" });
    expect(binding(reader, "redirect")?.settings).not.toHaveProperty("lookupStoreConnection");

    const media = run(design, {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      link: "sync",
      tile: tile("media", "Media storage", "object-store"),
      linkId: "download-media",
    }).design;
    expect(studioOf(media).entries?.at(-1)).toEqual({
      id: "download-media",
      lane: "download",
      element: "media",
    });

    // The first tile of a new project creates the system too.
    const first = run(emptyDesign(), {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      link: "sync",
      tile: tile("notes-api", "Notes API", "service"),
      linkId: "upload-notes",
      system: { name: "Notes" },
    });
    expect(first.ops).toEqual(["setArchitecture", "addElement", "setStudio"]);
    expect(laneGraph(first.design).edges).toMatchObject([{ source: LANE_ACTOR, lane: "upload" }]);
  });

  it("refuses in plain words with tile names", () => {
    const design = tinyurlInLanes();
    const add = (command: Partial<Extract<StudioCommand, { type: "addTile" }>>) =>
      refusal(design, {
        type: "addTile",
        from: { tile: "redirect" },
        side: "after",
        link: "sync",
        tile: tile("geo", "Geo lookup", "external-api"),
        linkId: "redirect-geo",
        ...command,
      });
    expect(add({ from: { tile: "link-cache" } })).toBe(
      "Link cache can't link to Geo lookup. A cache can't link onward.",
    );
    expect(add({ from: { lane: "download" }, side: "before" })).toBe(
      "Nothing goes before the user.",
    );
    expect(add({ from: { lane: "download" }, tile: tile("geo", "Geo worker", "worker") })).toBe(
      "Geo worker can't start the download lane. A lane starts at a service (not a worker), an API, storage or an external API.",
    );
    expect(add({ tile: tile("redirect", "Geo lookup", "external-api") })).toBe(
      'The ID "redirect" is already in use.',
    );
    const busy = run(design, {
      type: "addTile",
      from: { tile: "redirect" },
      side: "after",
      link: "sync",
      tile: tile("geo", "Geo lookup", "external-api"),
      linkId: "redirect-geo",
    }).design;
    expect(
      refusal(busy, {
        type: "addTile",
        from: { tile: "redirect" },
        side: "after",
        link: "sync",
        tile: tile("cache-2", "Second cache", "cache"),
        linkId: "redirect-cache-2",
      }),
    ).toBe("Redirect service already has 4 links; the most is 4.");

    let full = design;
    for (const id of ["one", "two"])
      full = run(full, {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        link: "sync",
        tile: tile(id, `Service ${id}`, "service"),
        linkId: `download-${id}`,
      }).design;
    expect(
      refusal(full, {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        link: "sync",
        tile: tile("three", "Service three", "service"),
        linkId: "download-three",
      }),
    ).toBe("The download lane already has 3 entries; the most is 3.");
  });
});

describe("linkTiles", () => {
  it("merges into a tile and refuses a loop, a second link and a second lane", () => {
    const design = tinyurlInLanes();
    const merged = run(design, {
      type: "linkTiles",
      from: { tile: "analytics" },
      to: "link-cache",
      link: "sync",
      linkId: "analytics-cache",
    }).design;
    expect(connection(merged, "analytics-cache")).toMatchObject({
      kind: "uses-database",
      planned: { protocol: "Redis" },
    });
    const entered = run(design, {
      type: "linkTiles",
      from: { lane: "upload" },
      to: "reputation",
      link: "sync",
      linkId: "upload-reputation",
    }).design;
    expect(studioOf(entered).entries?.at(-1)).toMatchObject({ element: "reputation" });

    const link = (from: string, to: string, mode: "sync" | "async" = "sync") =>
      refusal(design, {
        type: "linkTiles",
        from: { tile: from },
        to,
        link: mode,
        linkId: "new-link",
      });
    expect(link("analytics", "redirect")).toBe(
      "Redirect service already leads to Analytics worker; linking them would make a loop.",
    );
    expect(link("redirect", "link-cache")).toBe("Redirect service already links to Link cache.");
    expect(link("analytics", "links-db", "async")).toBe(
      "Analytics worker can't link to Links database. A link to a database is a request; it can't be asynchronous.",
    );
    expect(
      refusal(design, {
        type: "linkTiles",
        from: { lane: "upload" },
        to: "cdn",
        link: "sync",
        linkId: "upload-cdn",
      }),
    ).toBe("CDN already starts the download lane; a tile can start only one lane.");
  });
});

describe("removeTile and removeLink", () => {
  it("restitch: removing the CDN moves the download entry to Redirect", () => {
    const design = tinyurlInLanes();
    const removed = run(design, { type: "removeTile", tile: "cdn" });
    expect(removed.ops).toEqual(["removeElement", "setStudio"]);
    expect(studioOf(removed.design).entries).toEqual([
      { id: "download-redirect", lane: "download", element: "redirect" },
      { id: "upload-shorten", lane: "upload", element: "shorten-api" },
    ]);
    expect(connection(removed.design, "cdn-redirect")).toBeUndefined();

    // A queue's removal joins publisher and consumer with an asynchronous call.
    const direct = run(design, { type: "removeTile", tile: "click-events" }).design;
    expect(connection(direct, "redirect-analytics")).toMatchObject({
      kind: "calls",
      planned: { interaction: "Asynchronous" },
    });
    expect(laneGraph(direct).edges.find((edge) => edge.id === "analytics-write")?.dashed).toBe(
      true,
    );

    const unlinked = run(design, { type: "removeLink", link: "shorten-cache" }).design;
    expect(connection(unlinked, "shorten-cache")).toBeUndefined();
    expect(refusal(design, { type: "removeLink", link: "upload-shorten" })).toBe(
      "Removing the upload entry to Shorten API would cut off Shorten API and URL reputation API.",
    );
  });

  it("names every stranded tile, and needs them in alsoRemove", () => {
    const design = tinyurlInLanes();
    const strands = ["click-events", "analytics", "analytics-store"];
    expect(planRemoveTile(design, "redirect")).toEqual({ ok: true, value: { strands } });
    expect(refusal(design, { type: "removeTile", tile: "redirect" })).toBe(
      "Removing Redirect service would cut off Click events, Analytics worker and Analytics store; list them in alsoRemove to remove them too.",
    );
    expect(
      refusal(design, {
        type: "removeTile",
        tile: "redirect",
        alsoRemove: [...strands, "link-cache"],
      }),
    ).toBe("Removing Redirect service doesn't cut off Link cache; remove it separately.");

    const removed = run(design, {
      type: "removeTile",
      tile: "redirect",
      alsoRemove: strands,
    }).design;
    expect(removed.elements.map((element) => element.id).sort()).toEqual(
      ["cdn", "link-cache", "links-db", "reputation", "shorten-api"].sort(),
    );
    // The cache Redirect owned passes to the application still using it; settings and modules
    // that named the removed tiles go with them.
    expect(binding(removed, "link-cache")?.owner).toEqual({ kind: "element", id: "shorten-api" });
    expect(binding(removed, "cdn")?.settings).not.toHaveProperty("origin");
    expect(studioOf(removed).components?.map((item) => item.host)).not.toContain("redirect");
  });
});

describe("changeKind", () => {
  it("switches within the tile type with fresh settings, and refuses a kind that breaks a link", () => {
    const design = tinyurlInLanes();
    const switched = run(design, { type: "changeKind", element: "redirect", kind: "service" });
    expect(switched.ops).toEqual(["setStudio"]);
    expect(binding(switched.design, "redirect")).toMatchObject({
      definition: { id: "studio-service" },
      settings: createStudioSettings("service"),
    });

    const change = (element: string, kind: StudioModel["elements"][0]["settings"]["kind"]) =>
      refusal(design, { type: "changeKind", element, kind });
    expect(change("shorten-api", "worker")).toBe(
      "Shorten API can't become a worker. A lane starts at a service (not a worker), an API, storage or an external API.",
    );
    expect(change("links-db", "cache")).toBe(
      "Links database can switch only to another Database kind: a search index.",
    );
    expect(change("links-db", "search")).toBe(
      "ID generator in Shorten API can't use a search index; remove its link to Links database first.",
    );
    expect(change("redirect", "redirect")).toBe("Redirect service is already a redirect service.");
  });
});

describe("lane choices", () => {
  it("offer only valid tile types: after a queue, async only, and a Service is a worker", () => {
    const design = tinyurlInLanes();
    expect(laneChoices(design, { tile: "click-events" }, "after", "sync")).toEqual([]);
    expect(laneChoices(design, { tile: "click-events" }, "after", "async")).toEqual([
      { type: "service", kind: "worker" },
      { type: "api", kind: "gateway" },
    ]);
    expect(laneChoices(design, { lane: "download" }, "after", "sync")).toEqual([
      { type: "service", kind: "service" },
      { type: "api", kind: "gateway" },
      { type: "storage", kind: "object-store" },
      { type: "external", kind: "external-api" },
    ]);
    expect(laneTabs(design, "click-events")).toEqual([
      { from: { tile: "click-events" }, side: "after", mode: "async" },
      { from: { tile: "click-events" }, side: "before", mode: "async" },
    ]);
    expect(laneTabs(design, "link-cache")).toEqual([
      { from: { tile: "link-cache" }, side: "before", mode: "sync" },
    ]);
    expect(laneTabs(design, LANE_ACTOR).map((tab) => tab.from)).toEqual([
      { lane: "download" },
      { lane: "upload" },
    ]);
  });
});
