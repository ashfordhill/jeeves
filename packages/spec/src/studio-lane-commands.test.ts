import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema, emptyDesign } from "./design.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import {
  attachOptions,
  laneActionOptions,
  laneEntryRefusal,
  laneLinkRefusal,
  laneOptions,
  laneRemoveActionRefusal,
  newLinkId,
  newTileIdentity,
  planRemoveTile,
} from "./studio-lane-commands.ts";
import {
  LANE_ACTOR,
  laneActionLine,
  laneActionNode,
  laneFindings,
  laneGraph,
} from "./studio-lanes.ts";
import { createStudioSettings, type StudioModel } from "./studio-model.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";
import { studioTileTypes } from "./studio-tiles.ts";

const studioOf = (design: DesignDocument): StudioModel => {
  const studio = design.architecture?.studio;
  if (!studio) throw new Error("No studio model.");
  return studio;
};
const applied = (result: ReturnType<typeof applyOperations>) => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
};
/**
 * The TinyURL study: the user's Open link action enters at the Stats API and the Redirect service
 * (download), its Shorten action at the Shorten service (upload). Every tile that could start a
 * lane already does.
 */
const tinyurl = (): DesignDocument => studioArchitectureExample("studio-tinyurl").design;
/** Builds the command and applies its batch; the result keeps every lane rule. */
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  const next = applied(applyOperations(design, batch.ops, { baseRevision: batch.baseRevision }));
  expect(laneFindings(next)).toEqual([]);
  return { ops: batch.ops.map((op) => op.op), design: next };
}
/** TinyURL with a Geo lookup service after the Shorten service: a tile with no entry yet. */
const withGeo = () =>
  run(tinyurl(), {
    type: "addTile",
    from: { tile: "shorten" },
    side: "after",
    tile: { id: "geo", name: "Geo lookup", kind: "service" },
    linkId: "shorten-geo",
  }).design;
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

describe("actions", () => {
  it("add one action per lane, rename it and remove it with its entries", () => {
    const design = tinyurl();
    expect(laneActionOptions(design)).toEqual([
      {
        lane: "download",
        name: "Consume",
        refusal: "This design already has a Consume action; each lane has one.",
      },
      {
        lane: "upload",
        name: "Produce",
        refusal: "This design already has a Produce action; each lane has one.",
      },
    ]);
    expect(refusal(design, { type: "addAction", lane: "upload" })).toBe(
      "This design already has a Produce action; each lane has one.",
    );

    // A blank design starts with an action, which names the system.
    const blank = emptyDesign();
    expect(laneActionOptions(blank)).toEqual([
      { lane: "download", name: "Consume" },
      { lane: "upload", name: "Produce" },
    ]);
    const watch = run(blank, {
      type: "addAction",
      lane: "download",
      name: "Watch",
      system: { name: "Videos" },
    });
    expect(watch.ops).toEqual(["setArchitecture", "setStudio"]);
    expect(studioOf(watch.design).actions).toEqual([{ lane: "download", name: "Watch" }]);
    expect(laneGraph(watch.design)).toMatchObject({
      nodes: [{ id: LANE_ACTOR }, { id: laneActionNode("download"), action: "download" }],
      edges: [{ id: laneActionLine("download"), source: LANE_ACTOR }],
    });
    const both = run(watch.design, { type: "addAction", lane: "upload" }).design;
    expect(studioOf(both).actions).toEqual([
      { lane: "download", name: "Watch" },
      { lane: "upload", name: "Produce" },
    ]);
    const renamed = run(both, { type: "renameAction", lane: "upload", name: "Publish" }).design;
    expect(studioOf(renamed).actions?.[1]).toEqual({ lane: "upload", name: "Publish" });
    expect(refusal(watch.design, { type: "renameAction", lane: "upload", name: "Publish" })).toBe(
      "This design has no Produce action.",
    );
    // An action with no entries goes alone.
    const removed = run(renamed, { type: "removeAction", lane: "upload" });
    expect(removed.ops).toEqual(["setStudio"]);
    expect(studioOf(removed.design).actions).toEqual([{ lane: "download", name: "Watch" }]);

    // Removing an action takes its entries, and is refused when that cuts tiles off.
    expect(laneRemoveActionRefusal(design, "upload")).toBe(
      "Removing Shorten would cut off Shorten service.",
    );
    expect(refusal(design, { type: "removeAction", lane: "download" })).toBe(
      "Removing Open link would cut off Stats API, Redirect service, Analytics store, Click events, URL cache and Analytics worker.",
    );
    const linked = run(design, {
      type: "linkTiles",
      from: { tile: "redirect" },
      to: "shorten",
      linkId: "redirect-shorten",
    }).design;
    expect(laneRemoveActionRefusal(linked, "upload")).toBeUndefined();
    const downloadOnly = run(linked, { type: "removeAction", lane: "upload" }).design;
    expect(studioOf(downloadOnly).actions).toEqual([{ lane: "download", name: "Open link" }]);
    expect(studioOf(downloadOnly).entries?.map((entry) => entry.id)).toEqual([
      "download-stats-api",
      "download-redirect",
    ]);
    expect(planRemoveTile(design, laneActionNode("upload"))).toEqual({
      ok: false,
      message: 'There is no tile "@upload".',
    });
  });

  it("load a stored entry into storage, refuse new ones and let the old one be removed", () => {
    const youtube = () => studioArchitectureExample("studio-youtube").design;
    // An action never reaches storage: the Upload service writes Original videos.
    expect(
      refusal(youtube(), {
        type: "linkTiles",
        from: { lane: "upload" },
        to: "originals",
        linkId: "upload-parts",
      }),
    ).toBe(
      "Publish can't link to Original videos. An action reaches a service (not a worker), an API or the CDN.",
    );
    // YouTube 1.0.0 stored the user's upload entry into Original videos.
    const stored = JSON.parse(JSON.stringify(youtube()));
    delete stored.architecture.studio.actions;
    stored.architecture.studio.entries.push({
      id: "upload-parts",
      lane: "upload",
      element: "originals",
    });
    const legacy = designSchema.parse(stored);
    const broken =
      "Fix the lanes first. Produce can't link to Original videos; an action reaches a service (not a worker), an API or the CDN.";
    expect(
      refusal(legacy, {
        type: "addTile",
        from: { tile: "upload" },
        side: "after",
        tile: tile("notify", "Notify", "notification"),
        linkId: "upload-notify",
      }),
    ).toBe(broken);
    expect(laneActionOptions(legacy)[1]).toMatchObject({ refusal: broken });
    expect(refusal(legacy, { type: "renameAction", lane: "upload", name: "Publish" })).toBe(broken);
    // Removing the refused entry is what fixes it.
    const fixed = run(legacy, { type: "removeLink", link: "upload-parts" }).design;
    expect(studioOf(fixed).entries?.map((entry) => entry.id)).not.toContain("upload-parts");
    expect(laneFindings(fixed)).toEqual([]);
    // A repair still refuses to cut tiles off.
    expect(refusal(legacy, { type: "removeLink", link: "upload-service" })).toBe(broken);
  });
});

describe("addTile", () => {
  it("adds after a tile, before a tile and from a lane, with owners and link defaults", () => {
    const design = tinyurl();
    const queue = run(design, {
      type: "addTile",
      from: { tile: "shorten" },
      side: "after",
      link: "async",
      tile: tile("link-events", "Link events", "queue"),
      linkId: "shorten-events",
    });
    expect(queue.ops).toEqual(["addElement", "connect", "setStudio"]);
    expect(binding(queue.design, "link-events")).toMatchObject({
      definition: { id: "studio-queue" },
      settings: createStudioSettings("queue"),
      owner: { kind: "element", id: "shorten" },
    });
    expect(connection(queue.design, "shorten-events")).toMatchObject({
      from: { element: "shorten" },
      to: { element: "link-events" },
      planned: { label: "Publishes", interaction: "Asynchronous" },
    });

    // Before an entry tile: the entry moves to the new tile and keeps its ID and lane.
    const gateway = run(design, {
      type: "addTile",
      from: { tile: "shorten" },
      side: "before",
      link: "sync",
      tile: tile("edge", "API gateway", "gateway"),
      linkId: "edge-shorten",
    }).design;
    expect(studioOf(gateway).entries).toEqual([
      { id: "download-stats-api", lane: "download", element: "stats-api" },
      { id: "download-redirect", lane: "download", element: "redirect" },
      { id: "upload-shorten", lane: "upload", element: "edge" },
    ]);
    expect(connection(gateway, "edge-shorten")).toMatchObject({ kind: "calls" });

    // Before a tile with two incoming links: both move, keep their IDs and modes, and take the
    // link table's defaults. Redirect's lookup no longer reaches a database, so it is cleared.
    const reader = run(design, {
      type: "addTile",
      from: { tile: "url-db" },
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
      tile: tile("media", "Media CDN", "cdn"),
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
    // From a lane with no action, the action comes first, with its default name.
    expect(studioOf(first.design).actions).toEqual([{ lane: "upload", name: "Produce" }]);
    expect(laneGraph(first.design).edges).toMatchObject([
      { source: LANE_ACTOR, target: laneActionNode("upload") },
      { source: laneActionNode("upload"), target: "notes-api", lane: "upload" },
    ]);
    const second = run(first.design, {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: tile("notes-cdn", "Notes CDN", "cdn"),
      linkId: "download-notes-cdn",
    }).design;
    expect(studioOf(second).actions).toEqual([
      { lane: "download", name: "Consume" },
      { lane: "upload", name: "Produce" },
    ]);
  });

  it("refuses in plain words with tile names", () => {
    const design = tinyurl();
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
    expect(add({ from: { tile: "url-cache" } })).toBe(
      "URL cache can't link to Geo lookup. A cache can't link onward.",
    );
    expect(add({ from: { lane: "download" }, side: "before" })).toBe(
      "Nothing goes before an action; the user links only to it.",
    );
    expect(add({ from: { lane: "download" }, tile: tile("geo", "Geo worker", "worker") })).toBe(
      "Open link can't link to Geo worker. An action reaches a service (not a worker), an API or the CDN.",
    );
    // A new entry into storage or an external API is refused.
    expect(add({ from: { lane: "upload" }, tile: tile("media", "Media", "object-store") })).toBe(
      "Shorten can't link to Media. An action reaches a service (not a worker), an API or the CDN.",
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

    // The download lane has two entries; a third and a fourth fill it.
    const full = ["one", "two"].reduce(
      (current, id) =>
        run(current, {
          type: "addTile",
          from: { lane: "download" },
          side: "after",
          link: "sync",
          tile: tile(id, `Service ${id}`, "service"),
          linkId: `download-${id}`,
        }).design,
      design,
    );
    expect(
      refusal(full, {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        link: "sync",
        tile: tile("three", "Service three", "service"),
        linkId: "download-three",
      }),
    ).toBe("Open link already has 4 entries; the most is 4.");
  });
});

describe("linkTiles", () => {
  it("merges into a tile and refuses a loop, a second link and a second entry in a lane", () => {
    const design = tinyurl();
    const merged = run(design, {
      type: "linkTiles",
      from: { tile: "analytics" },
      to: "url-cache",
      link: "sync",
      linkId: "analytics-cache",
    }).design;
    expect(connection(merged, "analytics-cache")).toMatchObject({
      kind: "uses-database",
      planned: { protocol: "Redis" },
    });
    const entered = run(withGeo(), {
      type: "linkTiles",
      from: { lane: "upload" },
      to: "geo",
      link: "sync",
      linkId: "upload-geo",
    }).design;
    expect(studioOf(entered).entries?.at(-1)).toMatchObject({ element: "geo" });

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
    expect(link("redirect", "url-cache")).toBe("Redirect service already links to URL cache.");
    expect(link("analytics", "url-db", "async")).toBe(
      "Analytics worker can't link to URL database. A link to a database is a request; it can't be asynchronous.",
    );
    expect(
      refusal(design, {
        type: "linkTiles",
        from: { lane: "download" },
        to: "redirect",
        link: "sync",
        linkId: "download-redirect-2",
      }),
    ).toBe("Redirect service already starts the download lane; a tile has one entry.");
    // A lane's action reaches tiles; with no action there, there is nothing to link from.
    const noUpload = run(withGeo(), {
      type: "linkTiles",
      from: { tile: "redirect" },
      to: "shorten",
      linkId: "redirect-shorten",
    }).design;
    const downloadOnly = run(noUpload, { type: "removeAction", lane: "upload" }).design;
    expect(
      refusal(downloadOnly, {
        type: "linkTiles",
        from: { lane: "upload" },
        to: "geo",
        linkId: "upload-geo",
      }),
    ).toBe("The upload lane has no action yet; add its Produce action first.");
  });
});

describe("setEntryLane", () => {
  it("moves an entry to the other lane, within that lane's cap", () => {
    const design = tinyurl();
    const moved = run(design, {
      type: "setEntryLane",
      entry: "upload-shorten",
      lane: "download",
    });
    expect(moved.ops).toEqual(["setStudio"]);
    expect(studioOf(moved.design).entries?.map((entry) => entry.lane)).toEqual([
      "download",
      "download",
      "download",
    ]);

    // Four download entries fill the lane: the upload entry can't move there.
    const full = ["one", "two"].reduce(
      (current, id) =>
        run(current, {
          type: "addTile",
          from: { lane: "download" },
          side: "after",
          tile: tile(id, `Service ${id}`, "service"),
          linkId: `download-${id}`,
        }).design,
      design,
    );
    const cap = "Open link already has 4 entries; the most is 4.";
    expect(laneEntryRefusal(full, "upload-shorten", "download")).toBe(cap);
    expect(laneEntryRefusal(full, "download-redirect", "upload")).toBeUndefined();
    // The full action offers nothing to add or attach (every tile that could start a lane
    // already has an entry); the other action still adds.
    expect(laneOptions(full, { lane: "download" }, "after")[0]).toEqual({
      type: "service",
      refusal: cap,
    });
    expect(laneOptions(full, { lane: "download" }, "after").some((o) => "kind" in o)).toBe(false);
    expect(laneOptions(full, { lane: "upload" }, "after").some((o) => "kind" in o)).toBe(true);
    expect(attachOptions(full, laneActionNode("download")).some((o) => "link" in o)).toBe(false);
    // The other lane needs an action to move to.
    const linked = run(design, {
      type: "linkTiles",
      from: { tile: "redirect" },
      to: "shorten",
      linkId: "redirect-shorten",
    }).design;
    const downloadOnly = run(linked, { type: "removeAction", lane: "upload" }).design;
    expect(laneEntryRefusal(downloadOnly, "download-redirect", "upload")).toBe(
      "The upload lane has no action yet; add its Produce action first.",
    );
    expect(
      refusal(design, { type: "setEntryLane", entry: "download-redirect", lane: "download" }),
    ).toBe("Redirect service already starts the download lane.");
    expect(refusal(design, { type: "setEntryLane", entry: "redirect", lane: "upload" })).toBe(
      'There is no lane entry "redirect".',
    );
  });
});

describe("removeTile and removeLink", () => {
  it("restitch: removing a CDN in front of Redirect moves the download entry back to it", () => {
    const design = tinyurl();
    const fronted = run(design, {
      type: "addTile",
      from: { tile: "redirect" },
      side: "before",
      tile: tile("cdn", "CDN", "cdn"),
      linkId: "cdn-redirect",
    }).design;
    expect(studioOf(fronted).entries?.[1]).toEqual({
      id: "download-redirect",
      lane: "download",
      element: "cdn",
    });
    const removed = run(fronted, { type: "removeTile", tile: "cdn" });
    expect(removed.ops).toEqual(["removeElement", "setStudio"]);
    // The restitched entry gets a free ID: "download-redirect" was the CDN's entry until now.
    expect(studioOf(removed.design).entries).toEqual([
      { id: "download-stats-api", lane: "download", element: "stats-api" },
      { id: "download-redirect-2", lane: "download", element: "redirect" },
      { id: "upload-shorten", lane: "upload", element: "shorten" },
    ]);
    expect(connection(removed.design, "cdn-redirect")).toBeUndefined();

    // A queue's removal joins publisher and consumer with an asynchronous call.
    const direct = run(design, { type: "removeTile", tile: "click-events" }).design;
    expect(connection(direct, "redirect-analytics")).toMatchObject({
      kind: "calls",
      planned: { interaction: "Asynchronous" },
    });
    const directGraph = laneGraph(direct);
    expect(directGraph.edges.find((edge) => edge.id === "redirect-analytics")).toMatchObject({
      async: true,
      dashed: true,
    });
    // Restitching preserves the store request's own interaction, even after an async call.
    expect(directGraph.edges.find((edge) => edge.id === "analytics-write")).toMatchObject({
      async: false,
      dashed: false,
    });

    // The URL database stays reachable through the Shorten service.
    const unlinked = run(design, { type: "removeLink", link: "redirect-db" }).design;
    expect(connection(unlinked, "redirect-db")).toBeUndefined();
    expect(refusal(design, { type: "removeLink", link: "upload-shorten" })).toBe(
      "Removing the upload entry to Shorten service would cut off Shorten service.",
    );
  });

  it("names every stranded tile, and needs them in alsoRemove", () => {
    const design = tinyurl();
    const strands = ["click-events", "url-cache", "analytics"];
    expect(planRemoveTile(design, "redirect")).toEqual({ ok: true, value: { strands } });
    expect(refusal(design, { type: "removeTile", tile: "redirect" })).toBe(
      "Removing Redirect service would cut off Click events, URL cache and Analytics worker; list them in alsoRemove to remove them too.",
    );
    expect(
      refusal(design, {
        type: "removeTile",
        tile: "redirect",
        alsoRemove: [...strands, "url-db"],
      }),
    ).toBe("Removing Redirect service doesn't cut off URL database; remove it separately.");

    const removed = run(design, {
      type: "removeTile",
      tile: "redirect",
      alsoRemove: strands,
    }).design;
    expect(removed.elements.map((element) => element.id).sort()).toEqual(
      ["analytics-store", "shorten", "stats-api", "url-db"].sort(),
    );
    // The store the Analytics worker owned passes to the application still using it, which now
    // writes it; modules that named the removed tiles go with them.
    expect(binding(removed, "analytics-store")?.owner).toEqual({
      kind: "element",
      id: "stats-api",
    });
    expect(studioOf(removed).components?.map((item) => item.host)).not.toContain("redirect");
    expect(studioOf(removed).components?.map((item) => item.host)).not.toContain("analytics");
  });
});

describe("changeKind", () => {
  it("switches within the tile type with fresh settings, and refuses a kind that breaks a link", () => {
    const design = tinyurl();
    const switched = run(design, { type: "changeKind", element: "redirect", kind: "service" });
    expect(switched.ops).toEqual(["setStudio"]);
    expect(binding(switched.design, "redirect")).toMatchObject({
      definition: { id: "studio-service" },
      settings: createStudioSettings("service"),
    });

    const change = (element: string, kind: StudioModel["elements"][0]["settings"]["kind"]) =>
      refusal(design, { type: "changeKind", element, kind });
    expect(change("shorten", "worker")).toBe(
      "Shorten service can't become a worker. An action reaches a service (not a worker), an API or the CDN.",
    );
    expect(change("url-db", "cache")).toBe(
      "URL database can switch only to another Database kind: a search index.",
    );
    expect(change("url-db", "search")).toBe(
      "Link reader in Redirect service can't use a search index; remove its link to URL database first.",
    );
    expect(change("redirect", "redirect")).toBe("Redirect service is already a redirect service.");
  });
});

describe("modes from the pair", () => {
  it("give addTile and linkTiles without a link the pair's default mode", () => {
    const design = tinyurl();
    // After a service, a queue is published to asynchronously; a cache is a request.
    const queue = run(design, {
      type: "addTile",
      from: { tile: "shorten" },
      side: "after",
      tile: tile("link-events", "Link events", "queue"),
      linkId: "shorten-events",
    }).design;
    expect(connection(queue, "shorten-events")).toMatchObject({
      planned: { label: "Publishes", interaction: "Asynchronous" },
    });
    // After that queue, a worker consumes asynchronously.
    const worker = run(queue, {
      type: "addTile",
      from: { tile: "link-events" },
      side: "after",
      tile: tile("indexer", "Indexer", "worker"),
      linkId: "events-indexer",
    }).design;
    expect(connection(worker, "events-indexer")).toMatchObject({
      planned: { label: "Consumes", interaction: "Asynchronous" },
    });
    // Before the queue, a new service publishes to it; the Shorten service's publish moves to it.
    const before = run(queue, {
      type: "addTile",
      from: { tile: "link-events" },
      side: "before",
      tile: tile("relay", "Relay", "service"),
      linkId: "relay-events",
    }).design;
    expect(connection(before, "relay-events")).toMatchObject({
      planned: { label: "Publishes", interaction: "Asynchronous" },
    });
    expect(connection(before, "shorten-events")).toMatchObject({
      to: { element: "relay" },
      planned: { label: "Calls", interaction: "Asynchronous" },
    });
    // Between applications the default is a request; a lane entry is always one.
    const service = run(design, {
      type: "addTile",
      from: { tile: "redirect" },
      side: "after",
      tile: tile("geo", "Geo lookup", "service"),
      linkId: "redirect-geo",
    }).design;
    expect(connection(service, "redirect-geo")).toMatchObject({
      planned: { label: "Calls", interaction: "Request / response" },
    });
    const entry = run(design, {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: tile("media", "Media CDN", "cdn"),
      linkId: "download-media",
    }).design;
    expect(studioOf(entry).entries?.at(-1)).toMatchObject({ lane: "download", element: "media" });

    // linkTiles: the Shorten service publishes to Click events; the user enters at Geo lookup.
    const merged = run(design, {
      type: "linkTiles",
      from: { tile: "shorten" },
      to: "click-events",
      linkId: "shorten-clicks",
    }).design;
    expect(connection(merged, "shorten-clicks")).toMatchObject({
      planned: { label: "Publishes", interaction: "Asynchronous" },
      kind: "depends-on",
    });
    expect(
      studioOf(
        run(withGeo(), {
          type: "linkTiles",
          from: { lane: "upload" },
          to: "geo",
          linkId: "upload-geo",
        }).design,
      ).entries?.at(-1),
    ).toEqual({ id: "upload-geo", lane: "upload", element: "geo" });
    // A mode given explicitly still wins, and is still checked.
    expect(
      refusal(design, {
        type: "linkTiles",
        from: { tile: "shorten" },
        to: "click-events",
        link: "sync",
        linkId: "shorten-clicks",
      }),
    ).toBe(
      "Shorten service can't link to Click events. Publishing to a queue is asynchronous, not a request.",
    );
    expect(laneLinkRefusal(design, { tile: "shorten" }, "click-events")).toBeUndefined();
  });
});

describe("lane options", () => {
  it("always list the seven tile types in order, each with a kind or a reason", () => {
    const design = tinyurl();
    const sides = [
      [{ tile: "redirect" }, "after"],
      [{ tile: "redirect" }, "before"],
      [{ tile: "url-db" }, "after"],
      [{ tile: "url-db" }, "before"],
      [{ tile: "click-events" }, "after"],
      [{ lane: "download" }, "after"],
      [{ lane: "upload" }, "before"],
    ] as const;
    for (const [from, side] of sides) {
      const options = laneOptions(design, from, side);
      expect(options.map((option) => option.type)).toEqual([...studioTileTypes]);
      for (const option of options)
        if ("refusal" in option) expect(option.refusal).toMatch(/^[A-Z].*\.$/);
    }
    // After Redirect service, everything fits.
    expect(laneOptions(design, { tile: "redirect" }, "after")).toEqual([
      { type: "service", kind: "service" },
      { type: "api", kind: "gateway" },
      { type: "database", kind: "database" },
      { type: "cache", kind: "cache" },
      { type: "queue", kind: "queue" },
      { type: "storage", kind: "object-store" },
      { type: "external", kind: "external-api" },
    ]);
    // Before a database, only applications fit; the reasons name the preferred kind.
    expect(laneOptions(design, { tile: "url-db" }, "before")).toEqual([
      { type: "service", kind: "service" },
      { type: "api", kind: "gateway" },
      {
        type: "database",
        refusal: "A database can't link to URL database. A database can't link onward.",
      },
      {
        type: "cache",
        refusal: "A cache can't link to URL database. A cache can't link onward.",
      },
      {
        type: "queue",
        refusal:
          "A queue can't link to URL database. A queue feeds only an application, not a database.",
      },
      {
        type: "storage",
        refusal: "Object storage can't link to URL database. Object storage can't link onward.",
      },
      {
        type: "external",
        refusal:
          "An external API can't link to URL database. An external API can only call an application, not a database.",
      },
    ]);
    // After a queue: a Service is a worker, consuming asynchronously.
    expect(laneOptions(design, { tile: "click-events" }, "after").slice(0, 3)).toEqual([
      { type: "service", kind: "worker" },
      { type: "api", kind: "gateway" },
      {
        type: "database",
        refusal:
          "Click events can't link to a database. A queue feeds only an application, not a database.",
      },
    ]);
    expect(laneOptions(design, { lane: "upload" }, "after")[2]).toEqual({
      type: "database",
      refusal:
        "Shorten can't link to a database. An action reaches a service (not a worker), an API or the CDN.",
    });
    // An action adds a service or an API, never a store, a queue or an external API.
    expect(
      laneOptions(design, { lane: "upload" }, "after").map((o) => ("kind" in o ? o.kind : "-")),
    ).toEqual(["service", "gateway", "-", "-", "-", "-", "-"]);
    expect(laneOptions(design, { lane: "upload" }, "before")[0]).toEqual({
      type: "service",
      refusal: "Nothing goes before an action; the user links only to it.",
    });
    // From a lane with no action, the options are those of its new action.
    expect(
      laneOptions(emptyDesign(), { lane: "download" }, "after").map((o) =>
        "kind" in o ? o.kind : "-",
      ),
    ).toEqual(["service", "gateway", "-", "-", "-", "-", "-"]);
  });
});

describe("attach options", () => {
  it("attach a tile either way: forward when allowed, else backward, else the forward reason", () => {
    const design = tinyurl();
    const options = attachOptions(design, "url-db");
    expect(options.map((option) => option.tile)).toEqual([
      "stats-api",
      "redirect",
      "analytics-store",
      "click-events",
      "url-cache",
      "analytics",
      "shorten",
    ]);
    // URL database dropped on Analytics worker: Analytics worker → URL database.
    expect(options.find((option) => option.tile === "analytics")).toEqual({
      tile: "analytics",
      link: { from: { tile: "analytics" }, to: "url-db", mode: "sync" },
    });
    // Redirect already reads it, so neither way works: the forward reason.
    expect(options.find((option) => option.tile === "redirect")).toEqual({
      tile: "redirect",
      refusal: "URL database can't link to Redirect service. A database can't link onward.",
    });
    // Forward from Redirect service: a merge into Analytics worker; a second link is refused.
    const redirect = attachOptions(design, "redirect");
    expect(redirect.find((option) => option.tile === "analytics")).toEqual({
      tile: "analytics",
      link: { from: { tile: "redirect" }, to: "analytics", mode: "sync" },
    });
    expect(redirect.find((option) => option.tile === "url-cache")).toEqual({
      tile: "url-cache",
      refusal: "Redirect service already links to URL cache.",
    });
    // A queue link takes the async default.
    expect(attachOptions(design, "click-events").find((o) => o.tile === "shorten")).toEqual({
      tile: "shorten",
      link: { from: { tile: "click-events" }, to: "shorten", mode: "async" },
    });
    // Accepted options run as given.
    const link = options.find((option) => option.tile === "analytics");
    if (!link || !("link" in link)) throw new Error("No link.");
    const next = run(design, {
      type: "linkTiles",
      from: link.link.from,
      to: link.link.to,
      link: link.link.mode,
      linkId: "analytics-url-db",
    }).design;
    expect(connection(next, "analytics-url-db")).toMatchObject({ kind: "uses-database" });
    expect(attachOptions(design, "nope")).toEqual([]);
  });

  it("attach an action: the tiles its lane could take as an entry; nothing onto the user", () => {
    // In TinyURL every tile that could start a lane already does.
    for (const lane of ["download", "upload"] as const)
      expect(
        attachOptions(tinyurl(), laneActionNode(lane)).some((option) => "link" in option),
      ).toBe(false);
    const design = withGeo();
    expect(attachOptions(design, LANE_ACTOR)).toEqual([]);
    const download = attachOptions(design, laneActionNode("download"));
    expect(download).toHaveLength(9);
    expect(download.filter((option) => "link" in option)).toEqual([
      {
        tile: "geo",
        lane: "download",
        link: { from: { lane: "download" }, to: "geo", mode: "sync" },
      },
    ]);
    expect(download.find((option) => option.tile === "shorten")).toEqual({
      tile: "shorten",
      lane: "download",
      refusal: "Shorten service already starts the upload lane; a tile has one entry.",
    });
    expect(
      attachOptions(design, laneActionNode("upload")).find((option) => option.tile === "url-db"),
    ).toEqual({
      tile: "url-db",
      lane: "upload",
      refusal:
        "Shorten can't link to URL database. An action reaches a service (not a worker), an API or the CDN.",
    });
  });
});

describe("canvas helpers", () => {
  it("say which drops link and why the others don't", () => {
    const design = tinyurl();
    // A merge the canvas offers: Shorten service publishes to Click events.
    expect(laneLinkRefusal(design, { tile: "shorten" }, "click-events", "async")).toBe(undefined);
    // A tile has one entry: a lane tab onto the other lane's entry tile is refused too.
    expect(laneLinkRefusal(design, { lane: "download" }, "shorten", "sync")).toBe(
      "Shorten service already starts the upload lane; a tile has one entry.",
    );
    expect(laneLinkRefusal(design, { lane: "upload" }, "redirect", "sync")).toBe(
      "Redirect service already starts the download lane; a tile has one entry.",
    );
    expect(laneLinkRefusal(design, { tile: "analytics" }, "redirect", "sync")).toMatch(/loop/);
    // The user links only to its actions, and nothing links back to it or into an action.
    expect(laneLinkRefusal(design, { tile: "redirect" }, LANE_ACTOR, "sync")).toBe(
      "Links don't lead back to the user.",
    );
    expect(laneLinkRefusal(design, { tile: LANE_ACTOR }, "redirect", "sync")).toBe(
      "The user links only to its actions; add one with the user's +.",
    );
    expect(laneLinkRefusal(design, { tile: "redirect" }, laneActionNode("upload"))).toBe(
      "Only the user links to Shorten; pull from its attach tab to give it an entry.",
    );
  });

  it("name a new tile after its type and give it and its link free IDs", () => {
    const design = emptyDesign();
    expect(newTileIdentity(design, "cache")).toEqual({ id: "cache", name: "Cache" });
    const next = run(design, {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      link: "sync",
      tile: { ...newTileIdentity(design, "service"), kind: "service" },
      linkId: newLinkId(design, { lane: "download" }, "service"),
      system: { name: "Shop" },
    }).design;
    expect(studioOf(next).entries).toEqual([
      { id: "download-service", lane: "download", element: "service" },
    ]);
    expect(newTileIdentity(next, "service")).toEqual({ id: "service-2", name: "Service 2" });
    expect(newLinkId(next, { lane: "download" }, "service")).toBe("download-service-2");
    expect(
      newLinkId(tinyurl(), { tile: "redirect" }, "click-events", ["redirect-click-events"]),
    ).toBe("redirect-click-events-2");
  });
});
