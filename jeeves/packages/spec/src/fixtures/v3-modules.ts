/**
 * YouTube v3 as commands (YouTube v3 contract, section 5), as `v2-modules.ts` is for v2: the
 * contract's 31 steps from a blank design, its 26 modules with their names and descriptions, its 30
 * module connections and its 8 useful values, then Runnable processes on. The steps are data in
 * the contract's own format (V2_TILES's, V2_MODULES's, V2_CONNECTIONS's and V2_VALUES's), named
 * as the canvas shows them, so a mouse build (V3-11) can follow the same rows. Every step is a
 * command the mouse could send, checked with the supported builder; IDs follow names (TP03), as
 * the canvas makes them.
 */
import { applyOperations } from "../apply.ts";
import { type DesignDocument, emptyDesign } from "../design.ts";
import type { GenerationInstalledSupport } from "../generation-support.ts";
import type {
  StudioComponent,
  StudioComponentKind,
  StudioModuleSlotId,
} from "../studio-components.ts";
import { slug } from "../studio-ids.ts";
import { newLinkId } from "../studio-lane-commands.ts";
import type { StudioKind } from "../studio-model.ts";
import type { ModulePattern } from "../studio-module-patterns.ts";
import { newModuleIdentity } from "../studio-modules.ts";
import type { StudioCommand } from "../studio-operations.ts";
import { buildSupportedAuthoringCommand } from "../supported-authoring.ts";
import {
  type DesignDiffRow,
  designDiff,
  designDiffReport,
  type IntendedDifference,
} from "./design-diff.ts";
import { testInstalledSupport } from "./installed-support.ts";

/** A tile from an action's or tile's link fan, or a Connect drag between two tiles. */
export type V3Step = { from: string; kind: StudioKind; tile: string } | { link: [string, string] };

/** The system and its two actions (lane, name). */
export const V3_SYSTEM = "YouTube";
export const V3_ACTIONS = [
  ["download", "Watch"],
  ["upload", "Publish"],
] as const;

/** Contract section 5, "Tiles and links, in build order": 21 tiles and 33 lines in Simple. */
export const V3_TILES: readonly V3Step[] = [
  { from: "Watch", kind: "service", tile: "Watch API" },
  { from: "Watch API", kind: "cache", tile: "Hot metadata" },
  { from: "Watch API", kind: "database", tile: "Metadata" },
  { from: "Watch API", kind: "database", tile: "View counts" },
  { from: "Watch API", kind: "queue", tile: "View events" },
  { from: "View events", kind: "worker", tile: "View counter" },
  { link: ["View counter", "View counts"] },
  { from: "Watch", kind: "service", tile: "Search API" },
  { from: "Search API", kind: "search", tile: "Videos" },
  { from: "Watch", kind: "cdn", tile: "Video delivery" },
  { from: "Watch", kind: "service", tile: "Account API" },
  { from: "Account API", kind: "database", tile: "Favorites" },
  { link: ["Account API", "Metadata"] },
  { from: "Publish", kind: "identity", tile: "Sign-in" },
  { link: ["Watch API", "Sign-in"] },
  { link: ["Account API", "Sign-in"] },
  { from: "Publish", kind: "uploads", tile: "Upload API" },
  { link: ["Upload API", "Metadata"] },
  { from: "Upload API", kind: "object-store", tile: "Original videos" },
  { from: "Upload API", kind: "queue", tile: "Upload jobs" },
  { from: "Upload jobs", kind: "worker", tile: "Transcoder" },
  { link: ["Transcoder", "Original videos"] },
  { from: "Transcoder", kind: "object-store", tile: "Transcoded videos" },
  { link: ["Video delivery", "Transcoded videos"] },
  { from: "Transcoder", kind: "queue", tile: "Processing events" },
  { from: "Processing events", kind: "worker", tile: "Video lifecycle" },
  { link: ["Video lifecycle", "Metadata"] },
  { from: "Video lifecycle", kind: "queue", tile: "Publication events" },
  { from: "Publication events", kind: "worker", tile: "Search indexer" },
  { link: ["Search indexer", "Videos"] },
  { link: ["Upload API", "Sign-in"] },
];

export type V3Module = { kind: StudioComponentKind; name: string; description: string };
const module = (kind: StudioComponentKind, name: string, description: string): V3Module => ({
  kind,
  name,
  description,
});
/** Contract section 5, "Modules": 26, by tile, each with its name and description. */
export const V3_MODULES: Readonly<Record<string, readonly V3Module[]>> = {
  "Watch API": [
    module("auth-guard", "Viewer check", "Lets watchers sign in; others watch anonymously."),
    module("cache-reader", "Video details cache", "Serves video details from the cache."),
    module("data-access", "Video details reader", "Reads public video details."),
    module("data-access", "View count reader", "Reads a video's view count."),
    module(
      "custom",
      "View publisher",
      "Reports each play of a ready video as an event, with the viewer when signed in.",
    ),
  ],
  "View counter": [
    module("event-consumer", "View consumer", "Receives view events."),
    module("event-counter", "Receipt and increment", "Counts each view event once."),
    module("data-access", "Count writer", "Stores view totals."),
  ],
  "Search API": [module("search-query", "Video search", "Searches published videos.")],
  "Account API": [
    module("auth-guard", "Account check", "Allows only signed-in accounts."),
    module("favorites", "Favorite videos", "Keeps each account's favorite videos."),
    module("data-access", "Video reader", "Reads which videos are public."),
  ],
  "Upload API": [
    module("auth-guard", "Creator check", "Allows only signed-in creators."),
    module("multipart-uploads", "Multipart uploads", "Uploads large videos in resumable parts."),
    module(
      "event-publisher",
      "Job outbox publisher",
      "Queues a processing job once an upload completes.",
    ),
    module("data-access", "Upload state writer", "Records each upload's progress."),
  ],
  Transcoder: [
    module("event-consumer", "Job consumer", "Takes the next processing job."),
    module(
      "video-encoder",
      "Segmenter and encoder",
      "Encodes the video into streamable renditions.",
    ),
    module("video-packager", "Packager", "Stores the stream's segments and playlists."),
    module("video-thumbnailer", "Thumbnailer", "Creates the video's thumbnails."),
    module(
      "event-publisher",
      "Processing result publisher",
      "Announces whether processing succeeded.",
    ),
  ],
  "Video lifecycle": [
    module("event-consumer", "Processing consumer", "Receives processing results."),
    module("lifecycle-writer", "Lifecycle writer", "Updates each video's processing state."),
    module(
      "event-publisher",
      "Video publication publisher",
      "Announces videos that are ready to watch.",
    ),
  ],
  "Search indexer": [
    module("event-consumer", "Video publication consumer", "Receives newly published videos."),
    module("index-writer", "Index writer", "Adds published videos to the search index."),
  ],
};

/** A module's slot connected to a tile, or (an in-process slot) to another module's row. */
export type V3Connection = { host: string; module: string; slot: StudioModuleSlotId } & (
  | { tile: string }
  | { row: string }
);
const to = (host: string, name: string, slot: StudioModuleSlotId, tile: string): V3Connection => ({
  host,
  module: name,
  slot,
  tile,
});
/** Contract section 5, "Module connections": 30, the loader and Favorites' items in-process. */
export const V3_CONNECTIONS: readonly V3Connection[] = [
  to("Watch API", "Viewer check", "identity", "Sign-in"),
  to("Watch API", "Video details cache", "cache", "Hot metadata"),
  to("Watch API", "Video details reader", "database", "Metadata"),
  { host: "Watch API", module: "Video details cache", slot: "loader", row: "Video details reader" },
  to("Watch API", "View count reader", "database", "View counts"),
  to("Watch API", "View publisher", "uses", "View events"),
  to("Watch API", "View publisher", "uses", "Metadata"),
  to("View counter", "View consumer", "channel", "View events"),
  to("View counter", "Count writer", "database", "View counts"),
  to("Search API", "Video search", "index", "Videos"),
  to("Account API", "Account check", "identity", "Sign-in"),
  to("Account API", "Favorite videos", "state", "Favorites"),
  { host: "Account API", module: "Favorite videos", slot: "items", row: "Video reader" },
  to("Account API", "Video reader", "database", "Metadata"),
  to("Upload API", "Creator check", "identity", "Sign-in"),
  to("Upload API", "Multipart uploads", "objects", "Original videos"),
  to("Upload API", "Job outbox publisher", "channel", "Upload jobs"),
  to("Upload API", "Job outbox publisher", "outbox", "Metadata"),
  to("Upload API", "Upload state writer", "database", "Metadata"),
  to("Transcoder", "Job consumer", "channel", "Upload jobs"),
  to("Transcoder", "Segmenter and encoder", "originals", "Original videos"),
  to("Transcoder", "Packager", "outputs", "Transcoded videos"),
  to("Transcoder", "Thumbnailer", "outputs", "Transcoded videos"),
  to("Transcoder", "Processing result publisher", "channel", "Processing events"),
  to("Video lifecycle", "Processing consumer", "channel", "Processing events"),
  to("Video lifecycle", "Lifecycle writer", "state", "Metadata"),
  to("Video lifecycle", "Video publication publisher", "channel", "Publication events"),
  to("Video lifecycle", "Video publication publisher", "outbox", "Metadata"),
  to("Search indexer", "Video publication consumer", "channel", "Publication events"),
  to("Search indexer", "Index writer", "index", "Videos"),
];

/** A useful value: on a tile, or on one of its modules; `label` is the inspector's field. */
export type V3Value = {
  tile: string;
  module?: string;
  key: string;
  label: string;
  value: number | string;
};
/** Contract section 5, "Useful values": v2's seven, plus the Viewer check's Optional sign-in. */
export const V3_VALUES: readonly V3Value[] = [
  { tile: "Upload API", key: "requestTimeoutMs", label: "Request timeout", value: 5000 },
  { tile: "Upload API", key: "concurrencyLimit", label: "Concurrency limit", value: 500 },
  { tile: "Watch API", key: "concurrencyLimit", label: "Concurrency limit", value: 2000 },
  {
    tile: "Watch API",
    module: "Video details reader",
    key: "poolSize",
    label: "Pool size",
    value: 50,
  },
  {
    tile: "Watch API",
    module: "Video details reader",
    key: "statementTimeoutMs",
    label: "Statement timeout",
    value: 500,
  },
  { tile: "Hot metadata", key: "ttlSeconds", label: "TTL", value: 3601 },
  { tile: "View counter", key: "concurrency", label: "Concurrency", value: 8 },
  { tile: "Watch API", module: "Viewer check", key: "signIn", label: "Sign-in", value: "optional" },
];

/** The 11 template selections and 2 stubs Generate project resolves (contract section 5). */
export const V3_TEMPLATES: readonly { template: string; tile: string; module?: string }[] = [
  { template: "verified-identity", tile: "Watch API" },
  { template: "verified-identity", tile: "Account API" },
  { template: "verified-identity", tile: "Upload API" },
  { template: "positive-cache-read", tile: "Watch API" },
  { template: "favorites", tile: "Account API" },
  { template: "owned-multipart", tile: "Upload API" },
  { template: "video-hls", tile: "Transcoder" },
  { template: "asset-lifecycle", tile: "Video lifecycle" },
  { template: "event-counter", tile: "View counter" },
  { template: "search-projection", tile: "Search indexer" },
  { template: "search-query", tile: "Search API" },
  { template: "module-stub", tile: "Watch API", module: "View count reader" },
  { template: "module-stub", tile: "Watch API", module: "View publisher" },
];

/**
 * The six curated patterns with v3's names as their arguments, in the order a model following the
 * v3 brief would send them (V3-19: the patterns' own defaults are neutral, so the names come from
 * the brief). They make v3's 21 tiles; what they leave against the reference (module names the
 * patterns don't take, View publisher's kind, Sign-in's Publish entry, the values and Runnable
 * processes) is the brief's to fix.
 */
export const V3_PATTERN_STEPS: readonly ModulePattern[] = [
  {
    id: "cache-read",
    system: V3_SYSTEM,
    action: "Watch",
    service: "Watch API",
    cache: "Hot metadata",
    database: "Metadata",
    reader: "Video details cache",
    loader: "Video details reader",
  },
  {
    id: "counting",
    source: "Watch API",
    events: "View events",
    counter: "View counter",
    counts: "View counts",
    publisher: "View publisher",
    reader: "View count reader",
  },
  {
    id: "upload-pipeline",
    action: "Publish",
    service: "Upload API",
    identity: "Sign-in",
    metadata: "Metadata",
    originals: "Original videos",
    jobs: "Upload jobs",
    processor: "Transcoder",
    outputs: "Transcoded videos",
    results: "Processing events",
    lifecycle: "Video lifecycle",
    publication: "Publication events",
    delivery: "Video delivery",
  },
  {
    id: "search",
    events: "Publication events",
    indexer: "Search indexer",
    index: "Videos",
    service: "Search API",
    query: "Video search",
  },
  {
    id: "sign-in",
    tile: "Watch API",
    signIn: "optional",
    identity: "Sign-in",
    guard: "Viewer check",
  },
  {
    id: "favorites",
    service: "Account API",
    database: "Favorites",
    identity: "Sign-in",
    items: "Metadata",
    favorites: "Favorite videos",
    reader: "Video reader",
    guard: "Account check",
  },
];

/**
 * A pattern step with v3's tile and module names filled in where it gives none: what the
 * patterns' defaults were before V3-19, for checks and seeds that read as v3 (each still adds
 * only the optional tiles it asks for).
 */
export function withV3Names(step: ModulePattern): ModulePattern {
  const named = V3_PATTERN_STEPS.find((item) => item.id === step.id) ?? { id: step.id };
  const {
    system: _system,
    action: _action,
    publication: _publication,
    delivery: _delivery,
    items: _items,
    tile: _tile,
    signIn: _signIn,
    guard,
    ...names
  } = named as Record<string, unknown>;
  const required = step.id === "sign-in" && step.signIn !== "optional";
  return {
    ...names,
    ...(guard !== undefined && { guard: required ? "Account check" : guard }),
    ...step,
  } as ModulePattern;
}

/** Builds `design` up one command at a time, each checked with the supported builder. */
class V3Build {
  constructor(
    public design: DesignDocument,
    private readonly installed: GenerationInstalledSupport,
  ) {}
  readonly commands: StudioCommand[] = [];

  run(command: StudioCommand) {
    const batch = buildSupportedAuthoringCommand(this.design, command, this.installed);
    const result = applyOperations(this.design, batch.ops);
    if (!result.ok) throw new Error(`${command.type}: ${JSON.stringify(result.errors)}`);
    this.design = result.design;
    this.commands.push(command);
  }
  tile(name: string): string {
    const found = this.design.elements.find((item) => item.name === name);
    if (!found) throw new Error(`No tile named ${name}`);
    return found.id;
  }
  module(host: string, name: string): StudioComponent {
    const tile = this.tile(host);
    const found = this.design.architecture?.studio?.components?.find(
      (item) => item.host === tile && item.name === name,
    );
    if (!found) throw new Error(`No module ${name} in ${host}`);
    return found;
  }
  lane(name: string) {
    return V3_ACTIONS.find(([, action]) => action === name)?.[0];
  }
}

/** Every command of the v3 reference, from a blank design, and the design they make. */
export function buildV3Reference(installed: GenerationInstalledSupport = testInstalledSupport) {
  const build = new V3Build(emptyDesign(), installed);
  for (const [index, [lane, name]] of V3_ACTIONS.entries())
    build.run({
      type: "addAction",
      lane,
      name,
      ...(index === 0 && { system: { name: V3_SYSTEM } }),
    });
  for (const step of V3_TILES) {
    if ("link" in step) {
      const [from, target] = step.link.map((name) => build.tile(name)) as [string, string];
      build.run({
        type: "linkTiles",
        from: { tile: from },
        to: target,
        linkId: newLinkId(build.design, { tile: from }, target),
      });
      continue;
    }
    const lane = build.lane(step.from);
    const from = lane ? { lane } : { tile: build.tile(step.from) };
    const id = slug(step.tile);
    build.run({
      type: "addTile",
      from,
      side: "after",
      tile: { id, name: step.tile, kind: step.kind },
      linkId: newLinkId(build.design, from, id),
    });
  }
  for (const [host, modules] of Object.entries(V3_MODULES))
    for (const item of modules) {
      const tile = build.tile(host);
      const { id, name } = newModuleIdentity(build.design, tile, item.kind, item.name);
      build.run({
        type: "addModule",
        host: tile,
        kind: item.kind,
        id,
        name,
        description: item.description,
      });
    }
  for (const connection of V3_CONNECTIONS)
    build.run({
      type: "connectModule",
      module: build.module(connection.host, connection.module).id,
      slot: connection.slot,
      target:
        "tile" in connection
          ? { tile: build.tile(connection.tile) }
          : { module: build.module(connection.host, connection.row).id },
    });
  for (const value of V3_VALUES) {
    const studio = build.design.architecture?.studio;
    if (value.module) {
      const target = build.module(value.tile, value.module);
      build.run({
        type: "editComponent",
        component: target.id,
        settings: { ...target.settings, [value.key]: value.value } as StudioComponent["settings"],
      });
      continue;
    }
    const element = build.tile(value.tile);
    const row = studio?.elements.find((item) => item.element === element);
    if (!row) throw new Error(`No settings for ${value.tile}`);
    build.run({
      type: "edit",
      element,
      settings: { ...row.settings, [value.key]: value.value } as typeof row.settings,
    });
  }
  build.run({ type: "setRunnableProcesses", on: true });
  return { commands: build.commands, design: build.design };
}

/** The v3 reference design (contract section 5, Runnable processes on). */
export const v3ModuleDesign = (installed?: GenerationInstalledSupport): DesignDocument =>
  buildV3Reference(installed).design;

/**
 * The differences a v3 build may have from the reference, each with its reason. None yet: a mouse
 * build sends the same commands (V3-11 adds any its build needs, with the reason).
 */
export const v3IntendedDifferences: readonly IntendedDifference[] = [];

/** Every difference between the v3 reference and a build of it, by area and name. */
export const v3Diff = (candidate: DesignDocument, installed?: GenerationInstalledSupport) =>
  designDiff(v3ModuleDesign(installed), candidate, { installed });

/** The v3 diff sorted against the intended differences (`unexpected` rows are failures). */
export const v3DiffReport = (
  rows: readonly DesignDiffRow[],
  intended: readonly IntendedDifference[] = v3IntendedDifferences,
) => designDiffReport(rows, intended);
