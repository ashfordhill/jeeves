import { addAfter } from "@jeeves/board/graph";
import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema } from "./design.ts";
import { isStructural } from "./findings.ts";
import { designBlueprint, designBlueprintSchema } from "./studio-blueprint.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { LANE_ACTOR, laneFindings, laneGraph, laneRules } from "./studio-lanes.ts";
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
import { type StudioKind, type StudioModel, studioKinds } from "./studio-model.ts";
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
 * The TinyURL study: the user enters at the Stats API and the Redirect service (download) and the
 * Shorten service (upload).
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
      "user>service,redirect,identity,notification,billing,gateway: sync (sync)",
      "user>cdn: sync (sync)",
      "user>object-store: sync (sync)",
      "user>external: sync (sync)",
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
      expect(rule.connection === undefined).toBe(rule.source === "user");
    }
    const pairs = studioLinkRules.flatMap((rule) =>
      studioLinkRuleTargets(rule).map((kind) => `${rule.source}>${kind}`),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
    // Stores are end tiles; queue rows join only applications.
    expect(studioLinkRules.some((rule) => rule.source === "store")).toBe(false);
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
    for (const source of [...studioKinds, "user" as const])
      for (const target of studioKinds) {
        // A refused pair defaults to sync; the refusal is what matters there.
        const queue = source === "queue" || target === "queue";
        const mode = studioDefaultLinkMode(source, target);
        expect(mode).toBe(queue && studioLinkRule(source, target) ? "async" : "sync");
        if (source === "user") continue;
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
    expect(studioLinkRefusal("user", "worker")).toBe(
      "A lane starts at a service (not a worker), an API, storage or an external API.",
    );
    expect(studioLinkRefusal("user", "gateway", "async")).toBe(
      "A lane entry is a request; it can't be asynchronous.",
    );
    expect(studioLinkRefusal("user", "gateway")).toBeUndefined();
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
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "redirect" },
      { lane: "download", element: "stats-api" },
      { lane: "upload", element: "shorten" },
    ]);
    expect(blueprint.omitted).toEqual([]);
  });
});

describe("laneGraph", () => {
  it("orders download before upload and dashes async links and what follows them", () => {
    const graph = laneGraph(tinyurl());
    expect(graph.nodes.map((node) => node.id)).toEqual([
      LANE_ACTOR,
      "stats-api",
      "redirect",
      "analytics-store",
      "url-cache",
      "url-db",
      "click-events",
      "analytics",
      "shorten",
    ]);
    expect(graph.nodes[0]).toEqual({ id: LANE_ACTOR });
    expect(graph.nodes[1]).toEqual({ id: "stats-api", kind: "service" });
    expect(graph.edges).toHaveLength(10);
    const entry = (id: string, target: string, lane: string) => ({
      id,
      source: LANE_ACTOR,
      target,
      async: false,
      dashed: false,
      lane,
    });
    expect(graph.edges.slice(0, 3)).toEqual([
      entry("download-stats-api", "stats-api", "download"),
      entry("download-redirect", "redirect", "download"),
      entry("upload-shorten", "shorten", "upload"),
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
      "URL database can't start the download lane. A lane starts at a service (not a worker), an API, storage or an external API.",
      "Analytics store → Shorten service: A database can't link onward.",
    ]);
    expect(laneFindings(refused).map((item) => item.target)).toEqual([
      { path: ["architecture", "studio", "entries", 3] },
      { connection: "store-shorten" },
    ]);

    // A fourth service, after the Shorten service, gives the download lane a fourth entry.
    const batch = buildStudioCommand(design, {
      type: "addTile",
      from: { tile: "shorten" },
      side: "after",
      tile: { id: "admin", name: "Admin API", kind: "service" },
      linkId: "shorten-admin",
    });
    const fourth = applied(applyOperations(design, batch.ops));
    const crowded = edit(fourth, (draft) => {
      studioOf(draft).entries = ["redirect", "stats-api", "shorten", "admin"].map((element) => ({
        id: `entry-${element}`,
        lane: "download" as const,
        element,
      }));
      draft.connections.push(
        connection("redirect-stats", "redirect", "stats-api"),
        connection("redirect-shorten", "redirect", "shorten"),
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
      addAfter(graph, "url-cache", { id: "new" }, { id: "to-new" }, rules("service")),
    ).toMatchObject({ ok: false, code: "refused-link" });
    expect(rules("service").refusal("url-cache", "new", false)).toBe("A cache can't link onward.");
    expect(rules("worker").refusal(LANE_ACTOR, "new", false)).toMatch(/^A lane starts at/);
  });
});
