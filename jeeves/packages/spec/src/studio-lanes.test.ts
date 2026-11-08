import { addAfter } from "@jeeves/board/graph";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { isStructural } from "./findings.ts";
import { designBlueprint, designBlueprintSchema } from "./studio-blueprint.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import {
  LANE_ACTOR,
  laneActionLine,
  laneActionNode,
  laneBands,
  laneFindings,
  laneGraph,
  laneRules,
} from "./studio-lanes.ts";
import {
  type StudioLinkMode,
  studioDefaultLinkMode,
  studioEntryKinds,
  studioLinkDefaults,
  studioLinkRefusal,
  studioLinkRole,
  studioLinkRule,
  studioLinkRules,
  studioLinkRuleTargets,
} from "./studio-links.ts";
import {
  type StudioKind,
  type StudioModel,
  studioKinds,
  studioModelSchema,
} from "./studio-model.ts";
import { buildStudioCommand } from "./studio-operations.ts";
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

/**
 * The TinyURL study: the user's Open link action enters at the Stats API and the Redirect service
 * (download), its Shorten action at the Shorten service (upload).
 */
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
      "uploads",
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

describe("link table", () => {
  const rows = studioLinkRules.map(
    (rule) =>
      `${rule.source}>${rule.targets?.join(",") ?? rule.target}: ${rule.modes.join("|")} (${rule.defaultMode})`,
  );

  it("holds the owner's rules as rows with allowed and default modes", () => {
    expect(rows).toEqual([
      "user>action: sync (sync)",
      "action>service,redirect,identity,notification,billing,uploads,gateway: sync (sync)",
      "action>cdn: sync (sync)",
      "application>application: sync|async (sync)",
      "application>external: sync|async (sync)",
      "application>queue: async (async)",
      "application>database: sync (sync)",
      "application>cache: sync (sync)",
      "application>object-store,search: sync (sync)",
      "application>cdn: sync (sync)",
      "queue>application: async (async)",
      "external>application: sync|async (sync)",
      "cdn>application: sync (sync)",
      "cdn>object-store: sync (sync)",
    ]);
    // Each pair has at most one row, and every row's default is one of its modes.
    for (const rule of studioLinkRules) {
      expect(rule.modes).toContain(rule.defaultMode);
      expect(rule.connection === undefined).toBe(["user", "action"].includes(rule.source));
    }
    const pairs = studioLinkRules.flatMap((rule) =>
      studioLinkRuleTargets(rule).map((kind) => `${rule.source}>${kind}`),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
    // Stores are end tiles; queue rows join only applications.
    expect(studioLinkRules.some((rule) => rule.source === "store")).toBe(false);
    // The user links only to an action, and only the user links to one.
    expect(studioLinkRules.filter((rule) => rule.source === "user")).toEqual([
      { source: "user", target: "action", modes: ["sync"], defaultMode: "sync" },
    ]);
    expect(studioLinkRules.filter((rule) => rule.target === "action")).toHaveLength(1);
    for (const rule of studioLinkRules)
      if (rule.source === "queue" || rule.target === "queue")
        expect([rule.source, rule.target].filter((role) => role !== "queue")).toEqual([
          "application",
        ]);
    expect(studioLinkRole("browser")).toBeUndefined();
    expect(studioLinkRole("gateway")).toBe("application");
    expect(studioLinkRole("search")).toBe("store");
  });

  it("give every pair its default mode: async for queue links, sync otherwise", () => {
    for (const source of [...studioKinds, "user" as const, "action" as const])
      for (const target of studioKinds) {
        // A refused pair defaults to sync; the refusal is what matters there.
        const queue = source === "queue" || target === "queue";
        const mode = studioDefaultLinkMode(source, target);
        expect(mode).toBe(queue && studioLinkRule(source, target) ? "async" : "sync");
        if (source === "user" || source === "action") continue;
        // No mode means the pair's default.
        expect(studioLinkDefaults(source, target)).toEqual(
          studioLinkDefaults(source, target, mode),
        );
      }
    expect(studioLinkDefaults("redirect", "queue")).toMatchObject({
      ok: true,
      value: { planned: { interaction: "Asynchronous" }, settings: { channelUse: "publish" } },
    });
    expect(studioLinkDefaults("queue", "worker")).toMatchObject({
      ok: true,
      value: { settings: { channelUse: "consume" } },
    });
    expect(studioLinkDefaults("service", "worker")).toMatchObject({
      ok: true,
      value: { planned: { interaction: "Request / response" } },
    });
  });

  it("refuse each rule in plain words", () => {
    // The user links only to an action; an action reaches an application or the CDN.
    expect(studioLinkRefusal("user", "action")).toBeUndefined();
    expect(studioLinkRefusal("user", "gateway")).toBe(
      "The user links only to its actions; each lane starts at one.",
    );
    expect(studioLinkRefusal("service", "action")).toBe("Only the user links to an action.");
    for (const target of ["worker", "object-store", "external-api", "database", "queue"] as const)
      expect(studioLinkRefusal("action", target)).toBe(
        "An action reaches a service (not a worker), an API or the CDN.",
      );
    expect(studioLinkRefusal("action", "gateway", "async")).toBe(
      "A lane entry is a request; it can't be asynchronous.",
    );
    expect(studioLinkRefusal("action", "gateway")).toBeUndefined();
    expect(studioLinkRefusal("action", "cdn")).toBeUndefined();
    expect(studioLinkRefusal("search", "service")).toBe("A search index can't link onward.");
    expect(studioLinkRefusal("service", "browser")).toBe(
      "Browser apps take no links; the user is the client.",
    );
    expect(studioLinkRefusal("queue", "database")).toBe(
      "A queue feeds only an application, not a database.",
    );
    expect(studioLinkRefusal("queue", "worker", "sync")).toBe(
      "A queue feeds an application asynchronously, not by request.",
    );
    expect(studioLinkRefusal("cdn", "queue")).toBe(
      "Only an application publishes to a queue, not a CDN.",
    );
    expect(studioLinkRefusal("worker", "queue", "sync")).toBe(
      "Publishing to a queue is asynchronous, not a request.",
    );
    expect(studioLinkRefusal("external-api", "cache")).toBe(
      "An external API can only call an application, not a cache.",
    );
    expect(studioLinkRefusal("external-api", "billing", "async")).toBeUndefined();
    expect(studioLinkRefusal("cdn", "database")).toBe(
      "A CDN fronts only an application or object storage, not a database.",
    );
    expect(studioLinkRefusal("cdn", "object-store", "async")).toBe(
      "A link to object storage is a request; it can't be asynchronous.",
    );
    expect(studioLinkRefusal("gateway", "search", "async")).toBe(
      "A link to a search index is a request; it can't be asynchronous.",
    );
    expect(studioLinkRefusal("billing", "external-api", "async")).toBeUndefined();
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
        "gateway",
        "identity",
        "notification",
        "redirect",
        "service",
        "uploads",
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

    // The Analytics store is also reached through the click path, so removing the Stats API (and
    // its entry with it) strands nothing.
    const withoutStats = applied(
      applyOperations(design, [{ op: "removeElement", id: "stats-api" }]),
    );
    expect(studioOf(withoutStats).entries).toEqual([
      { id: "download-redirect", lane: "download", element: "redirect" },
      { id: "upload-shorten", lane: "upload", element: "shorten" },
    ]);
    // Validation enforces the lane rules: a batch that strands tiles is rejected.
    const stranding = applyOperations(design, [{ op: "disconnect", id: "redirect-clicks" }]);
    expect(stranding.ok ? [] : stranding.errors.map((item) => item.code)).toEqual(
      Array(2).fill("LANE_INVALID"),
    );

    const blueprint = designBlueprint(
      edit(design, (draft) => studioOf(draft).entries?.reverse()),
      "TinyURL",
    );
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(blueprint.actions).toEqual([
      { lane: "download", name: "Open link" },
      { lane: "upload", name: "Shorten" },
    ]);
    expect(blueprint.entries).toEqual([
      { lane: "download", action: "Open link", element: "redirect" },
      { lane: "download", action: "Open link", element: "stats-api" },
      { lane: "upload", action: "Shorten", element: "shorten" },
    ]);
    expect(blueprint.omitted).toEqual([]);
  });
});

describe("laneGraph", () => {
  it("orders download before upload and styles each relationship by its own interaction", () => {
    const graph = laneGraph(tinyurl());
    expect(graph.nodes.map((node) => node.id)).toEqual([
      LANE_ACTOR,
      "@download",
      "@upload",
      "stats-api",
      "redirect",
      "analytics-store",
      "click-events",
      "url-cache",
      "url-db",
      "analytics",
      "shorten",
    ]);
    expect(graph.nodes.slice(0, 4)).toEqual([
      { id: LANE_ACTOR },
      { id: laneActionNode("download"), action: "download" },
      { id: laneActionNode("upload"), action: "upload" },
      { id: "stats-api", kind: "service" },
    ]);
    // The user's lines to its two actions, the three entries and seven connections.
    expect(graph.edges).toHaveLength(12);
    const line = (lane: "download" | "upload") => ({
      id: laneActionLine(lane),
      source: LANE_ACTOR,
      target: laneActionNode(lane),
      async: false,
      dashed: false,
    });
    expect(graph.edges.slice(0, 2)).toEqual([line("download"), line("upload")]);
    const entry = (id: string, target: string, lane: "download" | "upload") => ({
      id,
      source: laneActionNode(lane),
      target,
      async: false,
      dashed: false,
      lane,
    });
    expect(graph.edges.slice(2, 5)).toEqual([
      entry("download-stats-api", "stats-api", "download"),
      entry("download-redirect", "redirect", "download"),
      entry("upload-shorten", "shorten", "upload"),
    ]);
    const ids = (pick: (edge: (typeof graph.edges)[0]) => boolean) =>
      graph.edges.filter(pick).map((edge) => edge.id);
    // Publish and consume are async; the analytics store write remains a request.
    expect(ids((edge) => edge.async)).toEqual(["redirect-clicks", "click-events-analytics"]);
    expect(ids((edge) => edge.dashed)).toEqual(["redirect-clicks", "click-events-analytics"]);
    expect(graph.edges.find((edge) => edge.id === "analytics-write")).toMatchObject({
      async: false,
      dashed: false,
    });

    // Adding another path to the caller cannot change its outgoing relationships' style.
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

  it("keeps YouTube worker reads and writes solid without changing the design or blueprint", () => {
    const design = studioArchitectureExample("studio-youtube").design;
    const original = structuredClone(design);
    const blueprint = designBlueprint(design, "YouTube");
    const graph = laneGraph(design);
    for (const id of [
      "transcoder-read",
      "transcoder-write",
      "counter-write",
      "handler-metadata",
      "indexer-write",
    ])
      expect(
        graph.edges.find((edge) => edge.id === id),
        id,
      ).toMatchObject({
        async: false,
        dashed: false,
      });
    expect(graph.edges.find((edge) => edge.id === "jobs-transcoder")).toMatchObject({
      source: "upload-queue",
      target: "transcoder",
      async: true,
      dashed: true,
    });
    for (const connection of design.connections)
      expect(graph.edges.find((edge) => edge.id === connection.id)?.dashed).toBe(
        connection.planned.interaction === "Asynchronous",
      );
    expect(design).toEqual(original);
    expect(designBlueprint(design, "YouTube")).toEqual(blueprint);
  });

  it("reads an entry stored with both lanes as a download entry", () => {
    // Entries could start both lanes for a while; such a design loads with that entry in download.
    const stored = JSON.parse(JSON.stringify(tinyurl()));
    stored.architecture.studio.entries[2].lane = "both";
    const design = designSchema.parse(stored);
    expect(studioOf(design).entries).toEqual([
      { id: "download-stats-api", lane: "download", element: "stats-api" },
      { id: "download-redirect", lane: "download", element: "redirect" },
      { id: "upload-shorten", lane: "download", element: "shorten" },
    ]);
    expect(laneFindings(design)).toEqual([]);
  });

  it("gives a lane stored with entries and no action its default action", () => {
    // Designs stored before actions: each lane with entries reads with Consume or Produce.
    const stored = JSON.parse(JSON.stringify(tinyurl()));
    delete stored.architecture.studio.actions;
    const design = designSchema.parse(stored);
    expect(studioOf(design).actions).toEqual([
      { lane: "download", name: "Consume" },
      { lane: "upload", name: "Produce" },
    ]);
    expect(laneFindings(design)).toEqual([]);
    // The `both` normalisation composes: that entry reads as download, so only download has one.
    stored.architecture.studio.entries[2].lane = "both";
    expect(studioOf(designSchema.parse(stored)).actions).toEqual([
      { lane: "download", name: "Consume" },
    ]);
    // A stored action keeps its name; the other lane gains its default.
    const upload = JSON.parse(JSON.stringify(tinyurl()));
    upload.architecture.studio.actions = [{ lane: "upload", name: "Shorten" }];
    expect(studioOf(designSchema.parse(upload)).actions).toEqual([
      { lane: "download", name: "Consume" },
      { lane: "upload", name: "Shorten" },
    ]);
    expect(laneFindings(designSchema.parse(upload))).toEqual([]);
    // A design with no entries gains none; the actions stay as stored.
    expect(
      studioModelSchema.parse({ version: 1, elements: [], packages: [], connections: [] }),
    ).not.toHaveProperty("actions");
    // One action per lane.
    expect(
      studioModelSchema
        .safeParse({
          ...studioOf(tinyurl()),
          actions: [
            { lane: "upload", name: "Shorten" },
            { lane: "upload", name: "Post" },
          ],
        })
        .error?.issues.map((issue) => issue.message),
    ).toEqual(["Each lane has one action; the upload lane has 2."]);
    expect(
      studioModelSchema
        .safeParse({
          ...studioOf(tinyurl()),
          actions: [{ lane: "upload", name: "A name far longer than one word" }],
        })
        .error?.issues.map((issue) => issue.message),
    ).toEqual(["Use 24 characters or fewer."]);
  });

  it("loads an entry stored into storage unchanged, as a finding", () => {
    // YouTube 1.0.0 stored the user's upload entry into Original videos.
    const stored = JSON.parse(JSON.stringify(studioArchitectureExample("studio-youtube").design));
    delete stored.architecture.studio.actions;
    stored.architecture.studio.entries.push({
      id: "upload-parts",
      lane: "upload",
      element: "originals",
    });
    const design = designSchema.parse(stored);
    expect(studioOf(design).entries?.at(-1)).toEqual({
      id: "upload-parts",
      lane: "upload",
      element: "originals",
    });
    expect(laneFindings(design)).toEqual([
      {
        code: "LANE_INVALID",
        severity: "error",
        message:
          "Produce can't link to Original videos; an action reaches a service (not a worker), an API or the CDN.",
        target: { path: ["architecture", "studio", "entries", 5] },
      },
    ]);
  });
});

describe("laneBands", () => {
  const shared = (id: string) => {
    const { nodes } = laneBands(laneGraph(studioArchitectureExample(id).design));
    return [...nodes].filter(([, band]) => band === "shared").map(([node]) => node);
  };

  it("puts what both actions reach between the lanes, and each line in its source's band", () => {
    const graph = laneGraph(tinyurl());
    const { nodes, edges } = laneBands(graph);
    expect(Object.fromEntries(nodes)).toEqual({
      "@download": "download",
      "@upload": "upload",
      "stats-api": "download",
      redirect: "download",
      "url-cache": "download",
      "click-events": "download",
      analytics: "download",
      "analytics-store": "download",
      "url-db": "shared",
      shorten: "upload",
    });
    expect(nodes.has(LANE_ACTOR)).toBe(false);
    expect(edges.has(laneActionLine("download"))).toBe(false);
    expect(edges.get("redirect-db")).toBe("download");
    expect(edges.get("shorten-db")).toBe("upload");
    expect(shared("studio-marketplace").sort()).toEqual([
      "orders-db",
      "product-images",
      "search-index",
    ]);
    expect(shared("studio-youtube").sort()).toEqual(["metadata-db", "search-index", "transcoded"]);
  });

  it("follow links as they change: a store linked from both lanes becomes shared", () => {
    // The Shorten service now also writes the Analytics store, which Open link's tiles reach.
    const both = edit(tinyurl(), (draft) => {
      draft.connections.push(connection("shorten-analytics", "shorten", "analytics-store"));
    });
    expect(laneBands(laneGraph(both)).nodes.get("analytics-store")).toBe("shared");
    // Without actions there are no bands.
    expect(laneBands({ nodes: [{ id: LANE_ACTOR }], edges: [] }).nodes.size).toBe(0);
  });
});

describe("laneFindings", () => {
  it("reports unreachable tiles, cycles, refused links and entries, and both caps", () => {
    const design = tinyurl();
    expect(laneFindings(design)).toEqual([]);

    const noUpload = edit(design, (draft) => {
      studioOf(draft).entries = studioOf(draft).entries?.filter((item) => item.lane !== "upload");
    });
    // The URL database is still read by the Redirect service; its writer is cut off.
    expect(messages(noUpload)).toEqual([
      "Shorten service can't be reached from the user; every tile hangs off a lane.",
    ]);

    const loop = edit(design, (draft) => {
      draft.connections.push(connection("analytics-redirect", "analytics", "redirect"));
    });
    expect(messages(loop)).toEqual([expect.stringMatching(/leads back to itself/)]);
    expect(laneFindings(loop)[0]?.target.element).toBeDefined();

    const refused = edit(design, (draft) => {
      draft.connections.push(connection("store-shorten", "analytics-store", "shorten"));
      studioOf(draft).entries?.push({ id: "download-db", lane: "download", element: "url-db" });
    });
    expect(messages(refused)).toEqual([
      "Open link can't link to URL database; an action reaches a service (not a worker), an API or the CDN.",
      "Analytics store → Shorten service: A database can't link onward.",
    ]);
    expect(laneFindings(refused).map((item) => item.target)).toEqual([
      { path: ["architecture", "studio", "entries", 3] },
      { connection: "store-shorten" },
    ]);

    // A tile has one entry, in one lane.
    const twice = edit(design, (draft) => {
      studioOf(draft).entries?.push({ id: "upload-redirect", lane: "upload", element: "redirect" });
    });
    expect(messages(twice)).toEqual([
      "Redirect service already starts the download lane; a tile has one entry.",
    ]);

    // Two more services, after the Shorten service, give the download lane a fifth entry.
    const fifth = ["admin", "audit"].reduce((current, id) => {
      const batch = buildStudioCommand(current, {
        type: "addTile",
        from: { tile: "shorten" },
        side: "after",
        tile: { id, name: `${id} API`, kind: "service" },
        linkId: `shorten-${id}`,
      });
      return applied(applyOperations(current, batch.ops));
    }, design);
    const crowded = edit(fifth, (draft) => {
      studioOf(draft).entries = ["redirect", "stats-api", "shorten", "admin", "audit"].map(
        (element) => ({
          id: `entry-${element}`,
          lane: "download" as const,
          element,
        }),
      );
      draft.connections.push(
        connection("redirect-stats", "redirect", "stats-api"),
        connection("redirect-shorten", "redirect", "shorten"),
      );
    });
    expect(messages(crowded)).toEqual([
      "Open link has 5 entries; the most is 4.",
      "Redirect service has 5 links; the most is 4.",
    ]);
    expect(laneFindings(crowded)[0]?.target).toEqual({
      path: ["architecture", "studio", "actions", 0],
    });
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
      addAfter(graph, "url-cache", { id: "new" }, { id: "to-new" }, rules("service")),
    ).toMatchObject({ ok: false, code: "refused-link" });
    expect(rules("service").refusal("url-cache", "new", false)).toBe("A cache can't link onward.");
    expect(rules("worker").refusal(laneActionNode("download"), "new", false)).toMatch(
      /^An action reaches/,
    );
    expect(rules("service").refusal(LANE_ACTOR, "new", false)).toMatch(/^The user links only/);
    expect(rules("service").refusal(LANE_ACTOR, laneActionNode("upload"), false)).toBeUndefined();
  });
});
