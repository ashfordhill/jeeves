import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema, emptyDesign } from "./design.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import {
  connectOptions,
  laneActionOptions,
  laneEntryRefusal,
  laneLinkRefusal,
  laneRemoveActionRefusal,
  linkFanOptions,
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
import { studioLinkFanKinds } from "./studio-tiles.ts";

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
  it("adds after a tile and from a lane, with owners and link defaults", () => {
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
    // Nothing is inserted before a tile or an action any more.
    for (const from of [{ tile: "url-db" }, { lane: "download" as const }])
      expect(add({ from, side: "before" as never })).toMatch(/after/);
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
    // The full action offers nothing to add or connect (every tile that could start a lane
    // already has an entry); the other action still adds.
    expect(linkFanOptions(full, { lane: "download" })[0]).toEqual({
      kind: "service",
      group: "application",
      refusal: cap,
    });
    expect(linkFanOptions(full, { lane: "download" }).some((o) => !o.refusal)).toBe(false);
    expect(linkFanOptions(full, { lane: "upload" }).some((o) => !o.refusal)).toBe(true);
    expect(connectOptions(full, laneActionNode("download")).some((o) => "link" in o)).toBe(false);
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
    // A CDN entry in front of Redirect: added from the lane, linked on, and Redirect's own entry
    // removed.
    const fronted = [
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: tile("cdn", "CDN", "cdn"),
        linkId: "download-cdn",
      },
      { type: "linkTiles", from: { tile: "cdn" }, to: "redirect", linkId: "cdn-redirect" },
      { type: "removeLink", link: "download-redirect" },
    ].reduce((current, command) => run(current, command as StudioCommand).design, design);
    expect(studioOf(fronted).entries?.map((entry) => entry.element)).toEqual([
      "stats-api",
      "shorten",
      "cdn",
    ]);
    const removed = run(fronted, { type: "removeTile", tile: "cdn" });
    expect(removed.ops).toEqual(["removeElement", "setStudio"]);
    // The restitched entry takes the CDN's entry's place, with a free ID.
    expect(studioOf(removed.design).entries).toEqual([
      { id: "download-stats-api", lane: "download", element: "stats-api" },
      { id: "upload-shorten", lane: "upload", element: "shorten" },
      { id: "download-redirect", lane: "download", element: "redirect" },
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

describe("link fan options", () => {
  const kinds = (options: ReturnType<typeof linkFanOptions>) =>
    options.map((option) => (option.refusal ? "-" : option.kind));

  it("always list the fan's eleven kinds in their groups, each allowed or with a reason", () => {
    const design = tinyurl();
    const froms = [
      { tile: "redirect" },
      { tile: "url-db" },
      { tile: "click-events" },
      { lane: "download" },
      { lane: "upload" },
    ] as const;
    for (const from of froms) {
      const options = linkFanOptions(design, from);
      expect(options.map((option) => option.kind)).toEqual([...studioLinkFanKinds]);
      for (const option of options)
        if (option.refusal) expect(option.refusal).toMatch(/^[A-Z].*\.$/);
    }
    expect(linkFanOptions(design, { tile: "redirect" }).map((o) => `${o.group} ${o.kind}`)).toEqual(
      [
        "application service",
        "application worker",
        "application uploads",
        "application identity",
        "data database",
        "data search",
        "data cache",
        "data object-store",
        "messaging queue",
        "edge cdn",
        "edge external-api",
      ],
    );
    // After a service every kind fits; after a store nothing does.
    expect(kinds(linkFanOptions(design, { tile: "redirect" }))).toEqual([...studioLinkFanKinds]);
    expect(linkFanOptions(design, { tile: "url-db" })[0]).toEqual({
      kind: "service",
      group: "application",
      refusal: "URL database can't link to a service. A database can't link onward.",
    });
    expect(kinds(linkFanOptions(design, { tile: "url-db" })).every((k) => k === "-")).toBe(true);
    // After a queue: a Service and a Worker both consume; stores, the CDN and External don't.
    const queue = linkFanOptions(design, { tile: "click-events" });
    expect(kinds(queue)).toEqual([
      "service",
      "worker",
      "uploads",
      "identity",
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
      "-",
    ]);
    expect(queue.find((o) => o.kind === "search")?.refusal).toBe(
      "Click events can't link to a search index. A queue feeds only an application, not a search index.",
    );
    // An action's entry is a service (not a worker), Uploads, Identity or the CDN.
    const entries = linkFanOptions(design, { lane: "upload" });
    expect(kinds(entries)).toEqual([
      "service",
      "-",
      "uploads",
      "identity",
      "-",
      "-",
      "-",
      "-",
      "-",
      "cdn",
      "-",
    ]);
    expect(entries.find((o) => o.kind === "worker")?.refusal).toBe(
      "Shorten can't link to a worker. An action reaches a service (not a worker), an API or the CDN.",
    );
    // From a lane with no action, the options are those of its new action.
    expect(kinds(linkFanOptions(emptyDesign(), { lane: "download" }))).toEqual(kinds(entries));
    // A full tile refuses every kind with the cap.
    const busy = run(design, {
      type: "addTile",
      from: { tile: "redirect" },
      side: "after",
      tile: tile("geo", "Geo lookup", "service"),
      linkId: "redirect-geo",
    }).design;
    expect(new Set(linkFanOptions(busy, { tile: "redirect" }).map((o) => o.refusal))).toEqual(
      new Set(["Redirect service already has 4 links; the most is 4."]),
    );
  });

  it("each offered kind is what addTile adds, and a refused one is refused with the same reason", () => {
    const design = tinyurl();
    for (const from of [
      { tile: "redirect" },
      { tile: "click-events" },
      { lane: "upload" },
    ] as const)
      for (const option of linkFanOptions(design, from)) {
        const identity = newTileIdentity(design, option.kind);
        const command: StudioCommand = {
          type: "addTile",
          from,
          side: "after",
          tile: { ...identity, kind: option.kind },
          linkId: newLinkId(design, from, identity.id, [identity.id]),
        };
        if (option.refusal) {
          // The reason names the new tile by its kind; addTile names it by its name.
          expect(refusal(design, command)).toBe(
            option.refusal.replace(
              /^(.*?can't link to )[^.]*\./,
              (_, head: string) => `${head}${identity.name}.`,
            ),
          );
          continue;
        }
        const added = run(design, command).design;
        expect(binding(added, identity.id)?.settings.kind).toBe(option.kind);
        expect(added.elements.find((e) => e.id === identity.id)?.name).toBe(identity.name);
      }
  });

  it("keep the fan's list for the canvas: addTile still takes every tile kind", () => {
    const design = tinyurl();
    // Gateway and the legacy kinds aren't offered, yet existing callers and chat history add them.
    for (const kind of ["gateway", "billing", "redirect", "notification"] as const) {
      expect(studioLinkFanKinds).not.toContain(kind);
      const added = run(design, {
        type: "addTile",
        from: { tile: "shorten" },
        side: "after",
        tile: tile(`new-${kind}`, `New ${kind}`, kind),
        linkId: `shorten-new-${kind}`,
      }).design;
      expect(binding(added, `new-${kind}`)?.settings.kind).toBe(kind);
    }
    expect(
      refusal(design, {
        type: "addTile",
        from: { tile: "shorten" },
        side: "after",
        tile: tile("app", "App", "browser"),
        linkId: "shorten-app",
      }),
    ).toBe("Browser apps aren't tiles; the user is the client.");
  });
});

describe("connect options", () => {
  it("link from the node, never reversed: the forward link, else its reason", () => {
    const design = tinyurl();
    const options = connectOptions(design, "url-db");
    // Every other node, in lane order: the user, both actions, then the tiles.
    expect(options.map((option) => option.tile)).toEqual([
      LANE_ACTOR,
      laneActionNode("download"),
      laneActionNode("upload"),
      "stats-api",
      "redirect",
      "analytics-store",
      "click-events",
      "url-cache",
      "analytics",
      "shorten",
    ]);
    // A store links onward to nothing, so nothing from URL database is offered, not even the
    // reverse of a link the rules would allow (Analytics worker → URL database).
    expect(options.some((option) => "link" in option)).toBe(false);
    expect(options.find((option) => option.tile === "analytics")).toEqual({
      tile: "analytics",
      refusal: "URL database can't link to Analytics worker. A database can't link onward.",
    });
    expect(options.find((option) => option.tile === LANE_ACTOR)).toEqual({
      tile: LANE_ACTOR,
      refusal: "Links don't lead back to the user.",
    });
    expect(options.find((option) => option.tile === laneActionNode("upload"))).toEqual({
      tile: laneActionNode("upload"),
      refusal: "Only the user links to Shorten; link Shorten to a tile to give it an entry.",
    });
    // Forward from Redirect service: a merge into Analytics worker; a second link is refused.
    const redirect = connectOptions(design, "redirect");
    expect(redirect.find((option) => option.tile === "analytics")).toEqual({
      tile: "analytics",
      link: { from: { tile: "redirect" }, to: "analytics", mode: "sync" },
    });
    expect(redirect.find((option) => option.tile === "url-cache")).toEqual({
      tile: "url-cache",
      refusal: "Redirect service already links to URL cache.",
    });
    // A queue link takes the async default.
    expect(connectOptions(design, "click-events").find((o) => o.tile === "shorten")).toEqual({
      tile: "shorten",
      link: { from: { tile: "click-events" }, to: "shorten", mode: "async" },
    });
    // Accepted options run as given.
    const link = connectOptions(design, "analytics").find((option) => option.tile === "url-db");
    if (!link || !("link" in link)) throw new Error("No link.");
    const next = run(design, {
      type: "linkTiles",
      from: link.link.from,
      to: link.link.to,
      link: link.link.mode,
      linkId: "analytics-url-db",
    }).design;
    expect(connection(next, "analytics-url-db")).toMatchObject({ kind: "uses-database" });
    expect(connectOptions(design, "nope")).toEqual([]);
  });

  it("link from an action as an entry; the user links to nothing here", () => {
    // In TinyURL every tile that could start a lane already does.
    for (const lane of ["download", "upload"] as const)
      expect(
        connectOptions(tinyurl(), laneActionNode(lane)).some((option) => "link" in option),
      ).toBe(false);
    const design = withGeo();
    const user = connectOptions(design, LANE_ACTOR);
    expect(user).toHaveLength(11);
    expect(new Set(user.map((option) => ("refusal" in option ? option.refusal : "")))).toEqual(
      new Set(["The user links only to its actions; add one with the user's +."]),
    );
    const download = connectOptions(design, laneActionNode("download"));
    expect(download).toHaveLength(11);
    expect(download.filter((option) => "link" in option)).toEqual([
      { tile: "geo", link: { from: { lane: "download" }, to: "geo", mode: "sync" } },
    ]);
    expect(download.find((option) => option.tile === "shorten")).toEqual({
      tile: "shorten",
      refusal: "Shorten service already starts the upload lane; a tile has one entry.",
    });
    expect(
      connectOptions(design, laneActionNode("upload")).find((option) => option.tile === "url-db"),
    ).toEqual({
      tile: "url-db",
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
      "Only the user links to Shorten; link Shorten to a tile to give it an entry.",
    );
  });

  it("name a new tile after its kind and give it and its link free IDs", () => {
    const design = emptyDesign();
    expect(newTileIdentity(design, "cache")).toEqual({ id: "cache", name: "Cache" });
    expect(newTileIdentity(design, "worker")).toEqual({
      id: "worker-service",
      name: "Worker service",
    });
    const next = run(design, {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      link: "sync",
      tile: { ...newTileIdentity(design, "service"), kind: "service" },
      linkId: newLinkId(design, { lane: "download" }, "microservice"),
      system: { name: "Shop" },
    }).design;
    expect(studioOf(next).entries).toEqual([
      { id: "download-microservice", lane: "download", element: "microservice" },
    ]);
    expect(newTileIdentity(next, "service")).toEqual({
      id: "microservice-2",
      name: "Microservice 2",
    });
    expect(newLinkId(next, { lane: "download" }, "microservice")).toBe("download-microservice-2");
    expect(
      newLinkId(tinyurl(), { tile: "redirect" }, "click-events", ["redirect-click-events"]),
    ).toBe("redirect-click-events-2");
  });
});
