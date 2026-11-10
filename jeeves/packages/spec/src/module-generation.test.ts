import { describe, expect, it } from "vitest";
import frozenV2 from "../../../../field-projects/youtube/v2/inputs/design.json" with {
  type: "json",
};
import { applyOperations } from "./apply.ts";
import { type DesignDocument, designSchema, emptyDesign } from "./design.ts";
import { designGeneration, type GenerationSelection } from "./generation.ts";
import { generationRuntime, generationTemplates } from "./generation-catalog.ts";
import { buildGenerationPresetCommand } from "./generation-presets.ts";
import { planModules } from "./module-generation.ts";
import { moduleStatus, moduleStatuses } from "./module-status.ts";
import { designOwnership, type Ownership } from "./ownership.ts";
import { designBlueprintV3 } from "./studio-blueprint.ts";
import type { StudioComponentKind, StudioModuleSlotId } from "./studio-components.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import type { StudioKind } from "./studio-model.ts";
import {
  buildStudioCommand,
  moduleConnectOptions,
  type StudioCommand,
} from "./studio-operations.ts";
import { buildSupportedAuthoringCommand } from "./supported-authoring.ts";

function run(design: DesignDocument, command: StudioCommand): DesignDocument {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
const runAll = (design: DesignDocument, commands: StudioCommand[]) =>
  commands.reduce((current, command) => run(current, command), design);
const refusal = (design: DesignDocument, command: StudioCommand) => {
  try {
    buildStudioCommand(design, command);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error(`${command.type} was accepted`);
};

const v2 = () => designSchema.parse(structuredClone(frozenV2));
const v2Element = (id: string) => {
  const design = v2();
  const element = design.elements.find((item) => item.id === id);
  const kind = design.architecture?.studio?.elements.find((item) => item.element === id)?.settings
    .kind;
  if (!element || !kind) throw new Error(id);
  return { id, name: element.name, kind: kind as StudioKind };
};
const tile = (from: string, id: string, linkId: string): StudioCommand => ({
  type: "addTile",
  from:
    from === "lane:download" || from === "lane:upload"
      ? { lane: from === "lane:download" ? "download" : "upload" }
      : { tile: from },
  side: "after",
  tile: v2Element(id),
  linkId,
});
const link = (from: string, to: string, linkId: string): StudioCommand => ({
  type: "linkTiles",
  from: { tile: from },
  to,
  linkId,
});
/** A module with v2's name for its ID, or the kind's fresh name. */
const add = (host: string, id: string, kind: StudioComponentKind): StudioCommand => {
  const name = v2().architecture?.studio?.components?.find((item) => item.id === id)?.name;
  return { type: "addModule", host, kind, id, ...(name && { name }) };
};
const connect = (
  module: string,
  slot: StudioModuleSlotId,
  target: { tile: string } | { module: string },
): StudioCommand => ({ type: "connectModule", module, slot, target });

/** v2's tiles and links, built with the lane commands and v2's own IDs. */
function v2Tiles(): DesignDocument {
  return runAll(emptyDesign(), [
    { type: "addAction", lane: "download", name: "Watch", system: { name: "YouTube" } },
    { type: "addAction", lane: "upload", name: "Publish" },
    tile("lane:download", "watch", "download-watch"),
    tile("watch", "metadata-cache", "watch-cache"),
    tile("watch", "metadata-db", "watch-metadata"),
    tile("watch", "view-counts", "watch-counts-read"),
    tile("watch", "view-events", "watch-views-publish"),
    tile("view-events", "view-counter", "views-counter"),
    link("view-counter", "view-counts", "counter-write"),
    tile("lane:download", "search", "download-search"),
    tile("search", "search-index", "search-read"),
    tile("lane:download", "video-cdn", "download-video-cdn"),
    tile("lane:upload", "identity", "upload-identity"),
    tile("lane:upload", "upload", "upload-service"),
    link("upload", "metadata-db", "upload-state"),
    tile("upload", "originals", "upload-originals"),
    tile("upload", "upload-queue", "upload-publish"),
    tile("upload-queue", "transcoder", "jobs-transcoder"),
    link("transcoder", "originals", "transcoder-read"),
    tile("transcoder", "transcoded", "transcoder-write"),
    link("video-cdn", "transcoded", "cdn-transcoded"),
    tile("transcoder", "completion-events", "transcoder-publish"),
    tile("completion-events", "completion-handler", "completions-handler"),
    link("completion-handler", "metadata-db", "handler-metadata"),
    tile("completion-handler", "publication-events", "handler-publication"),
    tile("publication-events", "search-indexer", "publications-indexer"),
    link("search-indexer", "search-index", "indexer-write"),
  ]);
}

/** v2's 22 modules under the contract's kinds (section 3), added and connected by command. */
const v2Modules: StudioCommand[] = [
  add("watch", "watch-cache-reader", "cache-reader"),
  add("watch", "watch-details", "data-access"),
  add("watch", "watch-counts", "data-access"),
  add("watch", "watch-views", "event-publisher"),
  connect("watch-cache-reader", "cache", { tile: "metadata-cache" }),
  connect("watch-details", "database", { tile: "metadata-db" }),
  connect("watch-cache-reader", "loader", { module: "watch-details" }),
  connect("watch-counts", "database", { tile: "view-counts" }),
  connect("watch-views", "channel", { tile: "view-events" }),
  add("view-counter", "counter-consumer", "event-consumer"),
  add("view-counter", "counter-sum", "event-counter"),
  add("view-counter", "counter-writer", "data-access"),
  connect("counter-consumer", "channel", { tile: "view-events" }),
  connect("counter-writer", "database", { tile: "view-counts" }),
  add("search", "search-query", "search-query"),
  connect("search-query", "index", { tile: "search-index" }),
  add("upload", "upload-auth", "auth-guard"),
  add("upload", "upload-multipart", "multipart-uploads"),
  add("upload", "upload-jobs", "event-publisher"),
  add("upload", "upload-state-writer", "data-access"),
  connect("upload-auth", "identity", { tile: "identity" }),
  connect("upload-multipart", "objects", { tile: "originals" }),
  connect("upload-jobs", "channel", { tile: "upload-queue" }),
  connect("upload-jobs", "outbox", { tile: "metadata-db" }),
  connect("upload-state-writer", "database", { tile: "metadata-db" }),
  add("transcoder", "transcoder-consumer", "event-consumer"),
  add("transcoder", "transcoder-encoder", "video-encoder"),
  add("transcoder", "transcoder-packager", "video-packager"),
  add("transcoder", "transcoder-thumbnails", "video-thumbnailer"),
  add("transcoder", "transcoder-done", "event-publisher"),
  connect("transcoder-consumer", "channel", { tile: "upload-queue" }),
  connect("transcoder-encoder", "originals", { tile: "originals" }),
  connect("transcoder-packager", "outputs", { tile: "transcoded" }),
  connect("transcoder-thumbnails", "outputs", { tile: "transcoded" }),
  connect("transcoder-done", "channel", { tile: "completion-events" }),
  add("completion-handler", "handler-consumer", "event-consumer"),
  add("completion-handler", "handler-writer", "lifecycle-writer"),
  add("completion-handler", "handler-publications", "event-publisher"),
  connect("handler-consumer", "channel", { tile: "completion-events" }),
  connect("handler-writer", "state", { tile: "metadata-db" }),
  connect("handler-publications", "channel", { tile: "publication-events" }),
  connect("handler-publications", "outbox", { tile: "metadata-db" }),
  add("search-indexer", "indexer-consumer", "event-consumer"),
  add("search-indexer", "indexer-writer", "index-writer"),
  connect("indexer-consumer", "channel", { tile: "publication-events" }),
  connect("indexer-writer", "index", { tile: "search-index" }),
];

/** v2's seven installed selections, keyed by host, with v2's upload selection named by its lead. */
const v2Templates = () =>
  Object.fromEntries(
    (designGeneration(v2())?.selections ?? [])
      .filter((item) => !item.binding.kind.startsWith("youtube-"))
      .map((item) => {
        const binding = structuredClone(item.binding);
        if (binding.kind === "asset-lifecycle") binding.upload = "upload-multipart";
        return [item.target.kind === "element" ? item.target.element : "", binding];
      }),
  );
const moduleTemplates = (design: DesignDocument) =>
  Object.fromEntries(
    (designGeneration(design)?.selections ?? [])
      .filter((item) => item.binding.kind !== "module-stub")
      .map((item) => [item.target.kind === "component" ? item.target.host : "", item.binding]),
  );
const sortRows = <T>(rows: readonly T[]) => [...rows].map((row) => JSON.stringify(row)).sort();
/** Ownership with owner IDs replaced by the hosts they hold, so owners compare by membership. */
function byMembers(ownership: Ownership) {
  const members = new Map<string, string>();
  for (const role of ownership.roles)
    members.set(role.owner, [members.get(role.owner), role.element].filter(Boolean).join("+"));
  const owner = (id: string) => members.get(id) ?? id;
  return {
    owners: sortRows(ownership.owners.map((item) => owner(item.id))),
    roles: sortRows(ownership.roles.map((item) => ({ ...item, owner: owner(item.owner) }))),
    resources: sortRows(
      ownership.resources.map((item) => ({ ...item, authority: owner(item.authority) })),
    ),
    grants: sortRows(ownership.grants),
    dependencies: sortRows(ownership.dependencies),
  };
}

describe("module authoring rebuilds YouTube v2", () => {
  const built = runAll(v2Tiles(), v2Modules);

  it("derives v2's seven templates with v2's bindings and two stubs", () => {
    expect(moduleTemplates(built)).toEqual(v2Templates());
    const selections = designGeneration(built)?.selections ?? [];
    expect(selections.every((item) => item.target.kind === "component")).toBe(true);
    expect(
      selections.filter((item) => item.binding.kind === "module-stub").map((item) => item.id),
    ).toEqual(["watch-counts", "watch-views"]);
    expect(selections.map((item) => item.id).sort()).toEqual(
      [
        "watch-cache-reader",
        "watch-counts",
        "watch-views",
        "counter-sum",
        "search-query",
        "upload-multipart",
        "transcoder-encoder",
        "handler-writer",
        "indexer-writer",
      ].sort(),
    );
    const leads = new Map(selections.map((item) => [item.id, item]));
    expect(leads.get("upload-multipart")?.template).toEqual(
      generationTemplates["owned-multipart"].ref,
    );
    expect(leads.get("watch-counts")?.template).toEqual(generationTemplates["module-stub"].ref);
    expect(designGeneration(built)?.preset).toBeUndefined();
  });

  it("derives v2's ownership but the two facts youtube-watch needed", () => {
    const expected = structuredClone(designOwnership(v2()));
    expected.grants = expected.grants.filter(
      (item) => !(item.role === "watch" && item.resource === "view-counts"),
    );
    expected.dependencies = expected.dependencies.filter(
      (item) => item.connection !== "watch-counts-read",
    );
    expect(byMembers(designOwnership(built))).toEqual(byMembers(expected));
    // Owners are named after their group's first host in lane order.
    expect(designOwnership(built).owners).toEqual(
      expect.arrayContaining([
        { id: "upload-owner", name: "Upload API" },
        { id: "search-owner", name: "Search API" },
        { id: "identity-owner", name: "Identity" },
      ]),
    );
  });

  it("gives 20 modules Template and the two others Stub", () => {
    const statuses = moduleStatuses(built);
    expect(statuses).toHaveLength(22);
    expect(
      statuses
        .filter((item) => item.status !== "template")
        .map((item) => [item.module, item.status]),
    ).toEqual([
      ["watch-counts", "stub"],
      ["watch-views", "stub"],
    ]);
  });
});

const settingsOf = (design: DesignDocument, id: string) =>
  (design.architecture?.studio?.elements.find((item) => item.element === id)?.settings ??
    design.architecture?.studio?.components?.find((item) => item.id === id)?.settings) as
    | Record<string, unknown>
    | undefined;
const selectionOf = (design: DesignDocument, id: string): GenerationSelection | undefined =>
  designGeneration(design)?.selections.find((item) => item.id === id);
/** v2's tiles with schema 3 and the given hand-made ownership, before any template. */
function withOwnership(ownership: Ownership): DesignDocument {
  const started = run(v2Tiles(), add("search-indexer", "indexer-limit", "rate-limiter"));
  const result = applyOperations(started, [{ op: "setOwnership", ownership }]);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
const owners = (...ids: string[]) => ids.map((id) => ({ id, name: id.toUpperCase() }));
const empty: Ownership = { owners: [], roles: [], resources: [], grants: [], dependencies: [] };
/** The Watch API's cache read template, complete. */
const watchCache: StudioCommand[] = v2Modules.slice(0, 7);
/** The View counter's event counter, complete. */
const viewCounter: StudioCommand[] = v2Modules.slice(9, 14);

describe("module catalog records", () => {
  it("adds module-stub and keeps youtube-core pinned", async () => {
    const { generationPresets } = await import("./generation-catalog.ts");
    expect(generationTemplates["module-stub"].ref).toMatchObject({
      id: "module-stub",
      version: "0.1.0",
    });
    expect(generationPresets.youtube.ref.sha256).toBe(
      "d4c66f03133f8f27de09e94b879b5f731dba42c988ef6dddb04a91da25718ad5",
    );
    // Every record v2 saved is still the catalog's, byte for byte.
    const saved = designGeneration(v2());
    expect(saved?.runtime).toEqual(generationRuntime.ref);
    for (const selection of saved?.selections ?? [])
      expect(selection.template).toEqual(
        generationTemplates[selection.binding.kind as keyof typeof generationTemplates].ref,
      );
  });

  it("names each template's lead as its only component target", async () => {
    const { generationCapabilities } = await import("./generation-support.ts");
    expect(
      Object.fromEntries(
        Object.entries(generationCapabilities).map(([kind, item]) => [
          kind,
          kind === "module-stub" ? item.componentTargets.length : item.componentTargets,
        ]),
      ),
    ).toEqual({
      "owned-multipart": ["multipart-uploads"],
      "asset-lifecycle": ["lifecycle-writer"],
      "video-hls": ["video-encoder"],
      "positive-cache-read": ["cache-reader"],
      "event-counter": ["event-counter"],
      "search-projection": ["index-writer"],
      "search-query": ["search-query"],
      "youtube-upload": ["custom"],
      "youtube-watch": ["custom"],
      "youtube-search": ["custom"],
      "module-stub": 18,
    });
    expect(generationCapabilities["module-stub"].role).toBeUndefined();
    expect(generationCapabilities["module-stub"].resources).toEqual([]);
    expect(generationCapabilities["module-stub"].settings).toEqual([]);
  });
});

describe("module commands", () => {
  it("upgrade a schema-2 design and declare every module in one batch", () => {
    const design = studioArchitectureExample("studio-tinyurl").design;
    expect(design.schemaVersion).toBe(2);
    const command: StudioCommand = { type: "addModule", host: "shorten", kind: "rate-limiter" };
    expect(buildStudioCommand(design, command).ops.map((item) => item.op)).toEqual([
      "upgradeDesign",
      "setStudio",
      "setOwnership",
      "setGeneration",
    ]);
    const next = run(design, command);
    expect(next.revision).toBe(design.revision + 1);
    expect(next.schemaVersion).toBe(3);
    const generation = designGeneration(next);
    expect(generation?.runtime).toEqual(generationRuntime.ref);
    expect(generation?.preset).toBeUndefined();
    // The new module and every older one get a declaration. The Redirect service's cache reader
    // already names its loader, so it leads a cache read; the loader is its part.
    const modules = next.architecture?.studio?.components ?? [];
    expect(modules.find((item) => item.id === "shorten-rate-limiter")?.name).toBe("Rate limiter");
    expect(generation?.selections.map((item) => item.id)).toEqual(
      modules.map((item) => item.id).filter((id) => id !== "redirect-data"),
    );
    expect(
      generation?.selections.filter((item) => item.binding.kind !== "module-stub"),
    ).toMatchObject([{ id: "redirect-cache-reader", binding: { kind: "positive-cache-read" } }]);
    // Its links still hold the study's Service identity, which the command never overwrites.
    expect(moduleStatus(next, "redirect-cache-reader")).toMatchObject({
      status: "refused",
      reason:
        "Local preset supports Private network; declared Service identity remains unsupported and is preserved.",
    });
    // A design whose modules make no template gets no ownership.
    const marketplace = studioArchitectureExample("studio-marketplace").design;
    const host = marketplace.architecture?.studio?.components?.[0]?.host ?? "";
    expect(
      buildStudioCommand(marketplace, { type: "addModule", host, kind: "custom" }).ops.map(
        (item) => item.op,
      ),
    ).toEqual(["upgradeDesign", "setStudio", "setGeneration"]);
  });

  it("refuse a kind the tile can't hold, in plain words, for the mouse and chat alike", () => {
    const design = v2Tiles();
    const encoder: StudioCommand = { type: "addModule", host: "watch", kind: "video-encoder" };
    expect(refusal(design, encoder)).toBe(
      "Video encoder can't go in Watch API; it goes in a worker.",
    );
    expect(() => buildSupportedAuthoringCommand(design, encoder, { templates: [] })).toThrow(
      "Video encoder can't go in Watch API",
    );
    expect(refusal(design, { type: "addModule", host: "identity", kind: "auth-guard" })).toBe(
      "Identity takes no modules.",
    );
    expect(refusal(design, { type: "addModule", host: "metadata-db", kind: "custom" })).toBe(
      "Metadata database takes no modules.",
    );
    expect(refusal(design, { type: "addModule", host: "nowhere", kind: "custom" })).toBe(
      'There is no tile "nowhere".',
    );
    const named = run(design, add("watch", "watch-details", "data-access"));
    expect(refusal(named, add("upload", "watch-details", "data-access"))).toBe(
      'The ID "watch-details" is already in use.',
    );
    const second = run(named, { type: "addModule", host: "watch", kind: "data-access" });
    expect(second.architecture?.studio?.components?.at(-1)).toMatchObject({
      id: "watch-data-access",
      name: "Data access",
    });
  });

  it("connect through the host's link, or add the lane rules' link, in one Undo step", () => {
    const base = runAll(v2Tiles(), [
      add("watch", "watch-details", "data-access"),
      add("upload", "upload-auth", "auth-guard"),
      add("view-counter", "counter-consumer", "event-consumer"),
    ]);
    const reused = run(base, connect("watch-details", "database", { tile: "metadata-db" }));
    expect(reused.revision).toBe(base.revision + 1);
    expect(reused.connections).toHaveLength(base.connections.length);
    expect(reused.architecture?.studio?.componentConnections?.at(-1)).toEqual({
      id: "watch-details-metadata-db",
      from: "watch-details",
      to: { kind: "element", id: "metadata-db", via: "watch-metadata" },
    });
    // No Upload API → Identity link yet: the guard adds the lane rules' one (a sync call).
    const added = run(reused, connect("upload-auth", "identity", { tile: "identity" }));
    expect(added.revision).toBe(reused.revision + 1);
    const call = added.connections.find(
      (item) => item.from.element === "upload" && item.to.element === "identity",
    );
    expect(call).toMatchObject({
      id: "upload-identity-2",
      kind: "calls",
      planned: { protocol: "HTTP", interaction: "Request / response", security: "Private network" },
    });
    // A consumer's link runs from the queue: Upload jobs → View counter, asynchronous.
    const consumed = run(added, connect("counter-consumer", "channel", { tile: "upload-queue" }));
    const delivery = consumed.connections.find(
      (item) => item.from.element === "upload-queue" && item.to.element === "view-counter",
    );
    expect(delivery?.planned.interaction).toBe("Asynchronous");
    expect(
      consumed.architecture?.studio?.connections.find((item) => item.connection === delivery?.id)
        ?.settings.channelUse,
    ).toBe("consume");
  });

  it("refuse a connection the slot or the lane rules don't allow", () => {
    const base = runAll(v2Tiles(), [
      add("watch", "watch-details", "data-access"),
      add("watch", "watch-cache-reader", "cache-reader"),
      add("watch", "watch-views", "event-publisher"),
      add("watch", "watch-redirect", "redirect-responder"),
      add("search-indexer", "indexer-call", "external-call"),
      connect("watch-details", "database", { tile: "metadata-db" }),
    ]);
    const cases: [StudioCommand, string][] = [
      [
        connect("watch-details", "database", { tile: "originals" }),
        "Details reader's database connects to a database, not Original videos.",
      ],
      [
        connect("watch-details", "database", { tile: "watch" }),
        "Details reader can't connect to its own tile.",
      ],
      [
        connect("watch-details", "index", { tile: "search-index" }),
        "Details reader has no index connection; a Data access connects its database.",
      ],
      [
        connect("watch-details", "database", { tile: "metadata-db" }),
        "Details reader already uses Metadata database.",
      ],
      [
        connect("watch-details", "database", { tile: "view-counts" }),
        "Details reader's database already uses Metadata database; disconnect it first.",
      ],
      [
        connect("watch-redirect", "target", { tile: "search" }),
        "Redirect responder can't connect; a Redirect responder takes no connections.",
      ],
      [
        connect("watch-cache-reader", "loader", { module: "watch-views" }),
        "Details cache's loader must be a Data access in Watch API.",
      ],
      [
        connect("watch-cache-reader", "loader", { tile: "metadata-db" }),
        "Details cache's loader is a Data access in Watch API, not a tile.",
      ],
      [
        connect("watch-details", "database", { module: "watch-views" }),
        "Details reader's database connects to a tile, not to another module.",
      ],
      [
        connect("indexer-call", "target", { tile: "upload" }),
        "Upload API already leads to Search indexer; linking them would make a loop.",
      ],
    ];
    for (const [command, message] of cases) expect(refusal(base, command)).toBe(message);
  });

  it("disconnect a module link and keep the host's link; remove a module with its links", () => {
    const complete = runAll(v2Tiles(), watchCache);
    expect(selectionOf(complete, "watch-cache-reader")?.binding.kind).toBe("positive-cache-read");
    const link = complete.architecture?.studio?.componentConnections?.find(
      (item) => item.from === "watch-cache-reader" && item.to.kind === "component",
    );
    if (!link) throw new Error();
    const cut = run(complete, { type: "disconnectModule", link: link.id });
    expect(cut.revision).toBe(complete.revision + 1);
    expect(cut.connections).toEqual(complete.connections);
    expect(selectionOf(cut, "watch-cache-reader")?.binding.kind).toBe("module-stub");
    expect(moduleStatus(cut, "watch-cache-reader")).toMatchObject({
      status: "stub",
      reason: "Needs a Data access as its loader.",
      unconnected: ["loader"],
    });
    expect(refusal(cut, { type: "disconnectModule", link: link.id })).toBe(
      `There is no module link "${link.id}".`,
    );
    // Removing the loader's Data access takes the loader link with it.
    const removed = run(complete, { type: "removeModule", module: "watch-details" });
    expect(removed.architecture?.studio?.components?.map((item) => item.id)).not.toContain(
      "watch-details",
    );
    expect(
      removed.architecture?.studio?.componentConnections?.some(
        (item) => item.from === "watch-details" || item.to.id === "watch-details",
      ),
    ).toBe(false);
    expect(selectionOf(removed, "watch-cache-reader")?.binding.kind).toBe("module-stub");
    expect(designOwnership(removed)).toEqual(empty);
  });

  it("refuse removing a module a tile-level binding names", () => {
    expect(refusal(v2(), { type: "removeModule", module: "upload-auth" })).toBe(
      "Creator check guards Upload API's tile-level upload template; it can't be removed.",
    );
  });

  it("offer where a module's link may end, with the command or the reason", () => {
    const base = runAll(v2Tiles(), [
      add("watch", "watch-details", "data-access"),
      add("watch", "watch-cache-reader", "cache-reader"),
    ]);
    const options = moduleConnectOptions(base, "watch-cache-reader");
    expect(
      options.find((item) => "tile" in item.target && item.target.tile === "metadata-cache"),
    ).toEqual({
      target: { tile: "metadata-cache" },
      command: connect("watch-cache-reader", "cache", { tile: "metadata-cache" }),
    });
    expect(options.find((item) => "module" in item.target)).toEqual({
      target: { module: "watch-details" },
      command: connect("watch-cache-reader", "loader", { module: "watch-details" }),
    });
    expect(
      options.find((item) => "tile" in item.target && item.target.tile === "metadata-db"),
    ).toEqual({
      target: { tile: "metadata-db" },
      refusal: "Details cache can't use Metadata database; a Cache reader connects to a cache.",
    });
    expect(
      moduleConnectOptions(base, "watch-details").find((item) => "module" in item.target),
    ).toEqual({
      target: { module: "watch-cache-reader" },
      refusal: "Details reader connects to tiles, not to other modules.",
    });
  });
});

describe("module derivation", () => {
  const built = runAll(v2Tiles(), v2Modules);

  it("writes the values a template fixes and an initial value for each needed setting", () => {
    const fixed = (id: string) => settingsOf(built, id);
    expect(fixed("metadata-db")).toMatchObject({ engine: "postgresql", provider: "self-hosted" });
    expect(fixed("metadata-cache")).toMatchObject({
      engine: "redis-compatible",
      provider: "self-hosted",
      ttlSeconds: 3600,
    });
    expect(fixed("search-index")).toMatchObject({ engine: "opensearch", provider: "self-hosted" });
    expect(fixed("upload-queue")).toMatchObject({ mode: "work-queue", provider: "self-hosted" });
    for (const id of ["completion-events", "view-events", "publication-events"])
      expect(fixed(id)).toMatchObject({ mode: "topic", provider: "self-hosted" });
    expect(fixed("originals")).toMatchObject({ access: "private", provider: "self-hosted" });
    expect(fixed("transcoded")).toMatchObject({ access: "public", provider: "self-hosted" });
    expect(fixed("identity")).toMatchObject({ exposure: "public" });
    for (const id of ["watch", "search", "upload"])
      expect(fixed(id)).toMatchObject({
        exposure: "public",
        requestTimeoutMs: 1000,
        concurrencyLimit: 1000,
      });
    expect(fixed("transcoder")).toMatchObject({ concurrency: 1 });
    for (const id of ["completion-handler", "view-counter", "search-indexer"])
      expect(fixed(id)).toMatchObject({ concurrency: 4 });
    expect(fixed("upload-jobs")).toMatchObject({ outbox: "enabled" });
    expect(fixed("handler-publications")).toMatchObject({ outbox: "enabled" });
    expect(fixed("transcoder-done")).toMatchObject({ outbox: "disabled" });
    expect(fixed("watch-cache-reader")).toMatchObject({
      pattern: "cache-aside",
      stampede: "single-flight",
    });
    for (const id of ["watch-details", "counter-writer", "upload-state-writer", "handler-writer"])
      expect(fixed(id)).toMatchObject({ poolSize: 10, statementTimeoutMs: 2000 });
    // A stub reads nothing, and a tile no template binds keeps its own settings.
    expect(fixed("watch-counts")).toEqual({ kind: "data-access", readRouting: "primary" });
    expect(fixed("video-cdn")).toEqual(settingsOf(v2Tiles(), "video-cdn"));
  });

  it("gives the same result whatever order the modules were connected in", () => {
    const adds = v2Modules.filter((item) => item.type === "addModule");
    const links = v2Modules.filter((item) => item.type === "connectModule").reverse();
    const other = runAll(v2Tiles(), [...adds, ...links]);
    expect(designGeneration(other)?.selections).toEqual(designGeneration(built)?.selections);
    expect(byMembers(designOwnership(other))).toEqual(byMembers(designOwnership(built)));
  });

  it("cleans up the facts only module-level selections needed, and derives them again", () => {
    const link = built.architecture?.studio?.componentConnections?.find(
      (item) => item.from === "counter-writer",
    );
    if (!link) throw new Error();
    const cut = run(built, { type: "disconnectModule", link: link.id });
    expect(selectionOf(cut, "counter-sum")?.binding.kind).toBe("module-stub");
    expect(selectionOf(cut, "counter-writer")?.binding.kind).toBe("module-stub");
    const ownership = designOwnership(cut);
    expect(ownership.roles.map((item) => item.element)).not.toContain("view-counter");
    expect(ownership.resources.map((item) => item.element)).not.toContain("view-counts");
    expect(ownership.grants.map((item) => item.role)).not.toContain("view-counter");
    expect(ownership.dependencies.map((item) => item.connection)).not.toContain("counter-write");
    expect(ownership.owners.map((item) => item.id)).not.toContain("view-counter-owner");
    expect(moduleStatus(cut, "counter-sum")?.reason).toBe(
      "Needs a Data access connected to a database.",
    );
    expect(moduleStatus(cut, "counter-consumer")?.reason).toBe(
      "Waits for Receipt and increment, which needs a Data access connected to a database.",
    );
    const again = run(cut, connect("counter-writer", "database", { tile: "view-counts" }));
    expect(designGeneration(again)?.selections).toEqual(designGeneration(built)?.selections);
    expect(designOwnership(again)).toEqual(designOwnership(built));
  });

  it("keeps facts no module-level selection needed, and refuses a contradicting one", () => {
    const kept = withOwnership({ ...empty, owners: owners("ops") });
    expect(designOwnership(runAll(kept, viewCounter)).owners).toEqual([
      { id: "ops", name: "OPS" },
      { id: "view-counter-owner", name: "View counter" },
    ]);
    // A hand-made role joins its host's group: the counter's store takes that owner.
    const role = withOwnership({
      ...empty,
      owners: owners("counts"),
      roles: [{ element: "view-counter", owner: "counts", kind: "worker" }],
    });
    expect(designOwnership(runAll(role, viewCounter)).resources).toEqual([
      { element: "view-counts", authority: "counts", kind: "source" },
    ]);
    const cases: [Ownership, StudioCommand[], string][] = [
      [
        {
          ...empty,
          owners: owners("watchers"),
          roles: [{ element: "watch", owner: "watchers", kind: "worker" }],
        },
        watchCache,
        "Watch API is declared a worker role, but its template needs an API role.",
      ],
      [
        {
          ...empty,
          owners: owners("a", "b"),
          roles: [{ element: "watch", owner: "a", kind: "api" }],
          resources: [{ element: "metadata-cache", authority: "b", kind: "source" }],
        },
        watchCache,
        "Watch API would need two owners: A and B.",
      ],
      [
        {
          ...empty,
          owners: owners("watchers"),
          resources: [{ element: "metadata-cache", authority: "watchers", kind: "source" }],
        },
        watchCache,
        "Metadata cache is declared its own source of truth, but Details cache needs it as a copy of Metadata database.",
      ],
    ];
    for (const [ownership, commands, message] of cases) {
      const design = withOwnership(ownership);
      const last = commands.at(-1);
      if (!last) throw new Error();
      const before = runAll(design, commands.slice(0, -1));
      expect(refusal(before, last)).toBe(message);
    }
  });

  it("refuses two writers of one store that already have different owners", () => {
    const design = withOwnership({
      ...empty,
      owners: owners("video", "lifecycle"),
      roles: [
        { element: "upload", owner: "video", kind: "api" },
        { element: "completion-handler", owner: "lifecycle", kind: "worker" },
      ],
    });
    // Both templates complete in the same command: the Upload API's last connection.
    const commands = [...v2Modules.slice(35, 40), ...v2Modules.slice(16, 25)];
    const last = commands.at(-1);
    if (!last) throw new Error();
    expect(refusal(runAll(design, commands.slice(0, -1)), last)).toBe(
      "Upload API and Video lifecycle worker both write Metadata database, but they already have different owners (VIDEO and LIFECYCLE).",
    );
  });

  it("keeps an old value it may not overwrite and reports the module Refused", () => {
    const mysql = run(v2Tiles(), {
      type: "edit",
      element: "view-counts",
      settings: { kind: "database", engine: "mysql", provider: "unspecified" },
    });
    const done = runAll(mysql, viewCounter);
    expect(settingsOf(done, "view-counts")).toMatchObject({
      engine: "mysql",
      provider: "self-hosted",
    });
    expect(selectionOf(done, "counter-sum")?.binding.kind).toBe("event-counter");
    for (const id of ["counter-sum", "counter-consumer", "counter-writer"])
      expect(moduleStatus(done, id)).toMatchObject({
        status: "refused",
        template: "event-counter",
        reason: expect.stringContaining("Unsupported state.engine=mysql"),
      });
  });

  it("keeps a search index a stub until a publisher's outbox feeds it", () => {
    const design = runAll(v2Tiles(), [...v2Modules.slice(14, 16), ...v2Modules.slice(42)]);
    expect(moduleStatus(design, "indexer-writer")).toMatchObject({
      status: "stub",
      reason: "Needs an Event publisher with an outbox feeding Publication events.",
    });
    expect(moduleStatus(design, "search-query")).toMatchObject({
      status: "stub",
      reason: "Needs an Index writer connected to Search index.",
    });
    expect(moduleStatus(design, "watch-views")).toBeUndefined();
  });

  it("re-derives when a tile or link goes; a tile-level store still can't go", () => {
    const unlinked = run(built, { type: "removeLink", link: "search-read" });
    expect(selectionOf(unlinked, "search-query")?.binding.kind).toBe("module-stub");
    expect(designOwnership(unlinked).roles.map((item) => item.element)).not.toContain("search");
    expect(designOwnership(unlinked).dependencies.map((item) => item.connection)).not.toContain(
      "search-read",
    );
    const removed = run(built, { type: "removeTile", tile: "view-counts" });
    expect(selectionOf(removed, "counter-sum")?.binding.kind).toBe("module-stub");
    expect(designOwnership(removed).resources.map((item) => item.element)).not.toContain(
      "view-counts",
    );
    // The frozen v2 binds its stores at tile level: removing one is still refused.
    const frozen = v2();
    const batch = buildStudioCommand(frozen, { type: "removeLink", link: "upload-state" });
    expect(applyOperations(frozen, batch.ops).ok).toBe(false);
  });
});

describe("module refusals", () => {
  const tiles = v2Tiles();
  const refused = (commands: StudioCommand[]) => {
    const last = commands.at(-1);
    if (!last) throw new Error();
    return refusal(runAll(tiles, commands.slice(0, -1)), last);
  };

  it("a part with two candidates", () => {
    expect(
      refused([
        add("upload", "upload-multipart", "multipart-uploads"),
        add("upload", "upload-state-writer", "data-access"),
        add("upload", "upload-state-2", "data-access"),
        connect("upload-state-writer", "database", { tile: "metadata-db" }),
        connect("upload-state-2", "database", { tile: "metadata-db" }),
      ]),
    ).toBe("Upload API has two Data access modules on databases; Multipart uploads needs one.");
  });

  it("a part that already serves another template", () => {
    expect(
      refused([
        add("completion-handler", "handler-writer", "lifecycle-writer"),
        add("completion-handler", "handler-consumer", "event-consumer"),
        add("completion-handler", "handler-data", "data-access"),
        connect("handler-consumer", "channel", { tile: "completion-events" }),
        connect("handler-data", "database", { tile: "metadata-db" }),
        add("completion-handler", "handler-count", "event-counter"),
      ]),
    ).toBe(
      "Processing consumer already serves Lifecycle writer; Event counter needs its own Event consumer.",
    );
  });

  it("two templates of one kind in a tile, or one both ways", () => {
    expect(
      refused([
        ...watchCache,
        connect("watch-counts", "database", { tile: "view-counts" }),
        add("watch", "watch-cache-2", "cache-reader"),
        connect("watch-cache-2", "cache", { tile: "metadata-cache" }),
        connect("watch-cache-2", "loader", { module: "watch-counts" }),
      ]),
    ).toBe(
      "Watch API can hold one cache read template; Details cache and Cache reader would each make one.",
    );
    const tileLevel = run(tiles, add("watch", "watch-details", "data-access"));
    const selected = applyOperations(tileLevel, [
      {
        op: "setGeneration",
        generation: {
          version: 1,
          runtime: generationRuntime.ref,
          selections: [
            {
              id: "ready-reader",
              target: { kind: "element", element: "watch" },
              template: generationTemplates["positive-cache-read"].ref,
              binding: {
                kind: "positive-cache-read",
                source: { resource: "metadata-db", connection: "watch-metadata" },
                cache: { resource: "metadata-cache", connection: "watch-cache" },
              },
            },
          ],
        },
      },
    ]);
    if (!selected.ok) throw new Error(JSON.stringify(selected.errors));
    const commands = watchCache.filter(
      (item) => !(item.type === "addModule" && item.id === "watch-details"),
    );
    const last = commands.at(-1);
    if (!last) throw new Error();
    expect(refusal(runAll(selected.design, commands.slice(0, -1)), last)).toBe(
      "Watch API already generates a cache read template as a tile; Details cache can't make another.",
    );
  });

  it("a packager and a thumbnailer on different storage", () => {
    expect(
      refused([
        add("transcoder", "transcoder-encoder", "video-encoder"),
        add("transcoder", "transcoder-packager", "video-packager"),
        add("transcoder", "transcoder-thumbnails", "video-thumbnailer"),
        connect("transcoder-packager", "outputs", { tile: "transcoded" }),
        connect("transcoder-thumbnails", "outputs", { tile: "originals" }),
      ]),
    ).toBe("Packager and Thumbnailer write different storage; Segmenter and encoder needs one.");
  });
});

describe("module status and older designs", () => {
  it("never writes: statuses, plans and blueprints leave the design as it was", () => {
    for (const design of [v2(), runAll(v2Tiles(), v2Modules)]) {
      const before = structuredClone(design);
      moduleStatuses(design);
      planModules(design);
      designBlueprintV3(design);
      expect(design).toEqual(before);
    }
  });

  it("reads the frozen v2 by its tile-level bindings", () => {
    const statuses = new Map(moduleStatuses(v2()).map((item) => [item.module, item]));
    expect(statuses.get("upload-auth")).toMatchObject({
      status: "template",
      template: "owned-multipart",
    });
    expect(statuses.get("watch-counts")).toMatchObject({
      status: "template",
      template: "youtube-watch",
    });
    expect(statuses.get("counter-sum")).toMatchObject({
      status: "custom",
      reason: "No template covers it.",
    });
  });

  it("explains each stub", () => {
    const design = runAll(v2Tiles(), [
      add("upload", "upload-multipart", "multipart-uploads"),
      add("upload", "upload-limit", "rate-limiter"),
      add("watch", "watch-views", "event-publisher"),
      add("transcoder", "transcoder-cache", "cache-reader"),
    ]);
    const reasons = Object.fromEntries(
      moduleStatuses(design).map((item) => [
        item.module,
        [item.status, item.reason, item.unconnected],
      ]),
    );
    expect(reasons).toEqual({
      "upload-multipart": ["stub", "Needs a connection to object storage.", ["objects"]],
      "upload-limit": ["stub", "Rate limiter has no template.", ["store"]],
      "watch-views": ["stub", "Needs Multipart uploads in its tile.", ["channel", "outbox"]],
      "transcoder-cache": [
        "stub",
        "Needs to be in a service or a redirect service.",
        ["cache", "loader"],
      ],
    });
  });

  it("leaves tile-level selections and their facts alone in a mixed design", () => {
    const attached = buildGenerationPresetCommand(
      studioArchitectureExample("studio-tinyurl").design,
      { preset: "video" },
    );
    const base = applyOperations(studioArchitectureExample("studio-tinyurl").design, attached.ops);
    if (!base.ok) throw new Error(JSON.stringify(base.errors));
    const before = base.design;
    const next = run(before, { type: "addModule", host: "upload", kind: "rate-limiter" });
    const tileLevel = (design: DesignDocument) =>
      designGeneration(design)?.selections.filter((item) => item.target.kind === "element");
    expect(tileLevel(next)).toEqual(tileLevel(before));
    // Every fact the preset declared stays; the study's cache reader adds its own.
    const kept = designOwnership(before);
    const now = designOwnership(next);
    for (const key of Object.keys(kept) as (keyof Ownership)[])
      expect(now[key] as unknown[]).toEqual(expect.arrayContaining(kept[key] as unknown[]));
    // Modules the tile-level templates trace keep no declaration of their own.
    const own = new Set(
      designGeneration(next)
        ?.selections.filter((item) => item.target.kind === "component")
        .map((item) => item.id),
    );
    expect(own.has("upload-rate-limiter")).toBe(true);
    expect(own.has("upload-auth")).toBe(false);
    expect(moduleStatus(next, "upload-auth")).toMatchObject({ status: "template" });
  });

  it("keeps the frozen v2 resolving to its recorded normalized model", async () => {
    const { resolveGeneration } = await import("./generation-resolver.ts");
    const normalized = await import(
      "../../../../field-projects/youtube/v2/inputs/normalized.json",
      {
        with: { type: "json" },
      }
    );
    const { model } = resolveGeneration(v2());
    expect(JSON.parse(JSON.stringify(model))).toEqual(normalized.default);
  });
});
