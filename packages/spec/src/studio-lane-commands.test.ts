import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import {
  attachOptions,
  laneEntryRefusal,
  laneLinkRefusal,
  laneOptions,
  newLinkId,
  newTileIdentity,
  planRemoveTile,
} from "./studio-lane-commands.ts";
import { LANE_ACTOR, laneFindings, laneGraph } from "./studio-lanes.ts";
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
/** The TinyURL study: the user enters at the CDN (download) and the Shorten API (upload). */
const tinyurl = (): DesignDocument => studioArchitectureExample("studio-tinyurl").design;
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
    const design = tinyurl();
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
      { id: "upload-shorten-api", lane: "upload", element: "edge" },
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
  it("merges into a tile and refuses a loop, a second link and a second entry in a lane", () => {
    const design = tinyurl();
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
        from: { lane: "download" },
        to: "cdn",
        link: "sync",
        linkId: "download-cdn-2",
      }),
    ).toBe("CDN already starts the download lane; a tile has one entry.");
  });
});

describe("setEntryLane", () => {
  it("moves an entry to the other lane, within that lane's cap", () => {
    const design = tinyurl();
    const moved = run(design, {
      type: "setEntryLane",
      entry: "upload-shorten-api",
      lane: "download",
    });
    expect(moved.ops).toEqual(["setStudio"]);
    expect(studioOf(moved.design).entries?.map((entry) => entry.lane)).toEqual([
      "download",
      "download",
    ]);

    // Three download entries fill the lane: the upload entry can't move there.
    let full = design;
    for (const tile of ["redirect", "reputation"])
      full = run(full, {
        type: "linkTiles",
        from: { lane: "download" },
        to: tile,
        link: "sync",
        linkId: `download-${tile}`,
      }).design;
    const cap = "The download lane already has 3 entries; the most is 3.";
    expect(laneEntryRefusal(full, "upload-shorten-api", "download")).toBe(cap);
    expect(laneEntryRefusal(full, "download-cdn", "upload")).toBeUndefined();
    // The full lane offers nothing to add or attach, so the user shows only the upload lane's
    // `+` (every tile that could start a lane already has an entry, so there is no attach tab).
    expect(laneOptions(full, { lane: "download" }, "after")[0]).toEqual({
      type: "service",
      refusal: cap,
    });
    expect(laneOptions(full, { lane: "download" }, "after").some((o) => "kind" in o)).toBe(false);
    expect(laneOptions(full, { lane: "upload" }, "after").some((o) => "kind" in o)).toBe(true);
    expect(attachOptions(full, LANE_ACTOR).some((o) => "link" in o)).toBe(false);
    expect(refusal(design, { type: "setEntryLane", entry: "download-cdn", lane: "download" })).toBe(
      "CDN already starts the download lane.",
    );
    expect(refusal(design, { type: "setEntryLane", entry: "cdn", lane: "upload" })).toBe(
      'There is no lane entry "cdn".',
    );
  });
});

describe("removeTile and removeLink", () => {
  it("restitch: removing the CDN moves the download entry to Redirect", () => {
    const design = tinyurl();
    const removed = run(design, { type: "removeTile", tile: "cdn" });
    expect(removed.ops).toEqual(["removeElement", "setStudio"]);
    expect(studioOf(removed.design).entries).toEqual([
      { id: "download-redirect", lane: "download", element: "redirect" },
      { id: "upload-shorten-api", lane: "upload", element: "shorten-api" },
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
    expect(refusal(design, { type: "removeLink", link: "upload-shorten-api" })).toBe(
      "Removing the upload entry to Shorten API would cut off Shorten API and URL reputation API.",
    );
  });

  it("names every stranded tile, and needs them in alsoRemove", () => {
    const design = tinyurl();
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
    const design = tinyurl();
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

describe("modes from the pair", () => {
  it("give addTile and linkTiles without a link the pair's default mode", () => {
    const design = tinyurl();
    // After a service, a queue is published to asynchronously; a cache is a request.
    const queue = run(design, {
      type: "addTile",
      from: { tile: "shorten-api" },
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
    // Before the queue, a new service publishes to it; Shorten API's publish moves to it.
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
      tile: tile("media", "Media storage", "object-store"),
      linkId: "download-media",
    }).design;
    expect(studioOf(entry).entries?.at(-1)).toMatchObject({ lane: "download", element: "media" });

    // linkTiles: Shorten API publishes to Click events; the user enters at the redirect.
    const merged = run(design, {
      type: "linkTiles",
      from: { tile: "shorten-api" },
      to: "click-events",
      linkId: "shorten-clicks",
    }).design;
    expect(connection(merged, "shorten-clicks")).toMatchObject({
      planned: { label: "Publishes", interaction: "Asynchronous" },
      kind: "depends-on",
    });
    expect(
      studioOf(
        run(design, {
          type: "linkTiles",
          from: { lane: "upload" },
          to: "redirect",
          linkId: "upload-redirect",
        }).design,
      ).entries?.at(-1),
    ).toEqual({ id: "upload-redirect", lane: "upload", element: "redirect" });
    // A mode given explicitly still wins, and is still checked.
    expect(
      refusal(design, {
        type: "linkTiles",
        from: { tile: "shorten-api" },
        to: "click-events",
        link: "sync",
        linkId: "shorten-clicks",
      }),
    ).toBe(
      "Shorten API can't link to Click events. Publishing to a queue is asynchronous, not a request.",
    );
    expect(laneLinkRefusal(design, { tile: "shorten-api" }, "click-events")).toBeUndefined();
  });
});

describe("lane options", () => {
  it("always list the seven tile types in order, each with a kind or a reason", () => {
    const design = tinyurl();
    const sides = [
      [{ tile: "redirect" }, "after"],
      [{ tile: "redirect" }, "before"],
      [{ tile: "links-db" }, "after"],
      [{ tile: "links-db" }, "before"],
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
    expect(laneOptions(design, { tile: "links-db" }, "before")).toEqual([
      { type: "service", kind: "service" },
      { type: "api", kind: "gateway" },
      {
        type: "database",
        refusal: "A database can't link to Links database. A database can't link onward.",
      },
      {
        type: "cache",
        refusal: "A cache can't link to Links database. A cache can't link onward.",
      },
      {
        type: "queue",
        refusal:
          "A queue can't link to Links database. A queue feeds only an application, not a database.",
      },
      {
        type: "storage",
        refusal: "Object storage can't link to Links database. Object storage can't link onward.",
      },
      {
        type: "external",
        refusal:
          "An external API can't link to Links database. An external API can only call an application, not a database.",
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
        "A database can't start the upload lane. A lane starts at a service (not a worker), an API, storage or an external API.",
    });
    expect(laneOptions(design, { lane: "upload" }, "before")[0]).toEqual({
      type: "service",
      refusal: "Nothing goes before the user.",
    });
  });
});

describe("attach options", () => {
  it("attach a tile either way: forward when allowed, else backward, else the forward reason", () => {
    const design = tinyurl();
    const options = attachOptions(design, "links-db");
    expect(options.map((option) => option.tile)).toEqual([
      "cdn",
      "redirect",
      "link-cache",
      "click-events",
      "analytics",
      "analytics-store",
      "shorten-api",
      "reputation",
    ]);
    // Links database dropped on Analytics worker: Analytics worker → Links database.
    expect(options.find((option) => option.tile === "analytics")).toEqual({
      tile: "analytics",
      link: { from: { tile: "analytics" }, to: "links-db", mode: "sync" },
    });
    // Redirect already reads it, so neither way works: the forward reason.
    expect(options.find((option) => option.tile === "redirect")).toEqual({
      tile: "redirect",
      refusal: "Links database can't link to Redirect service. A database can't link onward.",
    });
    // Forward from Redirect service: a merge into Analytics worker; a second link is refused.
    const redirect = attachOptions(design, "redirect");
    expect(redirect.find((option) => option.tile === "analytics")).toEqual({
      tile: "analytics",
      link: { from: { tile: "redirect" }, to: "analytics", mode: "sync" },
    });
    expect(redirect.find((option) => option.tile === "link-cache")).toEqual({
      tile: "link-cache",
      refusal: "Redirect service already links to Link cache.",
    });
    // A queue link takes the async default.
    expect(attachOptions(design, "click-events").find((o) => o.tile === "shorten-api")).toEqual({
      tile: "shorten-api",
      link: { from: { tile: "click-events" }, to: "shorten-api", mode: "async" },
    });
    // Accepted options run as given.
    const link = options.find((option) => option.tile === "analytics");
    if (!link || !("link" in link)) throw new Error("No link.");
    const next = run(design, {
      type: "linkTiles",
      from: link.link.from,
      to: link.link.to,
      link: link.link.mode,
      linkId: "analytics-links-db",
    }).design;
    expect(connection(next, "analytics-links-db")).toMatchObject({ kind: "uses-database" });
    expect(attachOptions(design, "nope")).toEqual([]);
  });

  it("attach the user per lane: the tiles each lane could take as an entry", () => {
    const design = tinyurl();
    const options = attachOptions(design, LANE_ACTOR);
    expect(options).toHaveLength(2 * 9);
    const download = options.filter((option) => option.lane === "download");
    expect(download.filter((option) => "link" in option)).toEqual([
      {
        tile: "redirect",
        lane: "download",
        link: { from: { lane: "download" }, to: "redirect", mode: "sync" },
      },
      {
        tile: "reputation",
        lane: "download",
        link: { from: { lane: "download" }, to: "reputation", mode: "sync" },
      },
    ]);
    expect(download.find((option) => option.tile === "shorten-api")).toEqual({
      tile: "shorten-api",
      lane: "download",
      refusal: "Shorten API already starts the upload lane; a tile has one entry.",
    });
    expect(
      options.find((option) => option.lane === "upload" && option.tile === "analytics"),
    ).toEqual({
      tile: "analytics",
      lane: "upload",
      refusal:
        "Analytics worker can't start the upload lane. A lane starts at a service (not a worker), an API, storage or an external API.",
    });
  });
});

describe("canvas helpers", () => {
  it("say which drops link and why the others don't", () => {
    const design = tinyurl();
    // A merge the canvas offers: Shorten API publishes to Click events.
    expect(laneLinkRefusal(design, { tile: "shorten-api" }, "click-events", "async")).toBe(
      undefined,
    );
    // A tile has one entry: a lane tab onto the other lane's entry tile is refused too.
    expect(laneLinkRefusal(design, { lane: "download" }, "shorten-api", "sync")).toBe(
      "Shorten API already starts the upload lane; a tile has one entry.",
    );
    expect(laneLinkRefusal(design, { lane: "upload" }, "cdn", "sync")).toBe(
      "CDN already starts the download lane; a tile has one entry.",
    );
    expect(laneLinkRefusal(design, { tile: "redirect" }, "cdn", "sync")).toMatch(/loop/);
    // The user is reached only through its lane tabs.
    expect(laneLinkRefusal(design, { tile: "redirect" }, LANE_ACTOR, "sync")).toMatch(
      /back to the user/,
    );
    expect(laneLinkRefusal(design, { tile: LANE_ACTOR }, "redirect", "sync")).toMatch(
      /download or upload tab/,
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
