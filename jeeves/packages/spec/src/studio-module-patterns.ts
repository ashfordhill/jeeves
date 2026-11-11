/**
 * Curated, module-authored patterns (V3-09, D6): the design playbook's shapes as ordinary studio
 * commands, so chat can build one as a single validated batch with names and links filled in
 * from a few arguments. Each pattern only sends commands the mouse could send (the link fan's
 * tile kinds, the module catalog, the lane commands and the module commands), checked step by
 * step with the same builder, so nothing it saves is something the canvas couldn't make. Its
 * modules resolve to the templates the v3 contract names once everything they need is there.
 *
 * A tile argument names a tile: an existing tile (by ID or by name) is reused, and any other text
 * is a new tile's name. Defaults are the YouTube v3 contract's names, so applying the patterns in
 * turn shares Metadata, Sign-in and the rest.
 */
import { z } from "zod";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import type { GenerationInstalledSupport } from "./generation-support.ts";
import { generationCapabilities } from "./generation-support.ts";
import { guardSignIn } from "./module-generation.ts";
import {
  type StudioComponent,
  type StudioComponentKind,
  type StudioModuleSlotId,
  studioComponentLimits,
} from "./studio-components.ts";
import { freshId, slug, usedIds } from "./studio-ids.ts";
import { newLinkId } from "./studio-lane-commands.ts";
import { studioKindNoun } from "./studio-links.ts";
import {
  type StudioKind,
  type StudioLane,
  studioActions,
  studioLaneActionNameSchema,
  studioLimits,
} from "./studio-model.ts";
import { moduleSlots, newModuleIdentity } from "./studio-modules.ts";
import type { StudioCommand } from "./studio-operations.ts";
import { buildSupportedAuthoringCommand } from "./supported-authoring.ts";

export const modulePatternIds = [
  "upload-pipeline",
  "cache-read",
  "counting",
  "search",
  "sign-in",
  "favorites",
  "owned-store",
] as const;
export type ModulePatternId = (typeof modulePatternIds)[number];

const tile = z.string().trim().min(1).max(studioLimits.name);
const moduleName = z.string().trim().min(1).max(studioComponentLimits.name);
const shared = { system: tile.optional(), action: studioLaneActionNameSchema.optional() };
const signIn = z.enum(["required", "optional"]);

/** A pattern and its arguments, as `applyPattern` and `previewCommands` take them. */
export const modulePatternSchema = z.discriminatedUnion("id", [
  z.strictObject({
    id: z.literal("upload-pipeline"),
    ...shared,
    service: tile.optional(),
    identity: tile.optional(),
    metadata: tile.optional(),
    originals: tile.optional(),
    jobs: tile.optional(),
    processor: tile.optional(),
    outputs: tile.optional(),
    results: tile.optional(),
    lifecycle: tile.optional(),
    publication: tile.optional(),
    delivery: tile.optional(),
  }),
  z.strictObject({
    id: z.literal("cache-read"),
    ...shared,
    service: tile.optional(),
    cache: tile.optional(),
    database: tile.optional(),
    reader: moduleName.optional(),
    loader: moduleName.optional(),
  }),
  z.strictObject({
    id: z.literal("counting"),
    ...shared,
    source: tile.optional(),
    events: tile.optional(),
    counter: tile.optional(),
    counts: tile.optional(),
    publisher: moduleName.optional(),
    reader: moduleName.optional(),
  }),
  z.strictObject({
    id: z.literal("search"),
    ...shared,
    events: tile.optional(),
    indexer: tile.optional(),
    index: tile.optional(),
    service: tile.optional(),
    query: moduleName.optional(),
  }),
  z.strictObject({
    id: z.literal("sign-in"),
    ...shared,
    tile,
    signIn: signIn.optional(),
    identity: tile.optional(),
    guard: moduleName.optional(),
  }),
  z.strictObject({
    id: z.literal("favorites"),
    ...shared,
    service: tile.optional(),
    database: tile.optional(),
    identity: tile.optional(),
    items: tile.optional(),
    favorites: moduleName.optional(),
    reader: moduleName.optional(),
    guard: moduleName.optional(),
  }),
  z.strictObject({
    id: z.literal("owned-store"),
    ...shared,
    writer: tile.optional(),
    database: tile.optional(),
    readers: z.array(tile).max(4).optional(),
    writerModule: moduleName.optional(),
    readerModule: moduleName.optional(),
  }),
]);
export type ModulePattern = z.infer<typeof modulePatternSchema>;

const actionArg = (lane: StudioLane) =>
  `The ${lane} lane's action name, used only when the lane has none yet (default ${lane === "download" ? "Consume" : "Produce"}).`;
const systemArg = "The system's name, used only when the design is empty.";

/** What each pattern builds, which templates it makes, and each argument with its default. */
export const modulePatternGuide: Readonly<
  Record<
    ModulePatternId,
    {
      name: string;
      summary: string;
      templates: readonly string[];
      arguments: Readonly<Record<string, string>>;
    }
  >
> = {
  "upload-pipeline": {
    name: "Upload pipeline",
    summary:
      "Signed-in multipart uploads into object storage, recorded in a database; a job queue to a video encoding worker that writes its own output and announces each result on a topic; a lifecycle worker that records each upload's state (playbook patterns 1, 2 and 7).",
    templates: ["Sign-in", "Multipart upload", "Video encoding", "Upload lifecycle"],
    arguments: {
      service: 'The upload service, an Uploads entry of the upload lane. Default "Upload API".',
      identity: 'The Identity its Required Auth guard verifies. Default "Sign-in".',
      metadata: 'The database for upload state and the lifecycle. Default "Metadata".',
      originals: 'The object storage the uploads write. Default "Original videos".',
      jobs: 'The job queue. Default "Upload jobs".',
      processor: 'The encoding worker. Default "Transcoder".',
      outputs: 'The object storage the encoder writes. Default "Transcoded videos".',
      results: 'The topic the encoder announces results on. Default "Processing events".',
      lifecycle: 'The worker that records each upload\'s state. Default "Video lifecycle".',
      publication:
        "Optional: a topic the lifecycle publishes each committed state to, through an outbox (what search consumes). Omitted: none.",
      delivery:
        "Optional: a CDN entry of the download lane that serves the encoder's output (playbook pattern 6). Omitted: none.",
      action: actionArg("upload"),
      system: systemArg,
    },
  },
  "cache-read": {
    name: "Read path with a cache loader",
    summary:
      "A read API that serves records from its own cache and, on a miss, loads them through a Data access on the database (cache-aside, the reader owns the cache; playbook pattern 4).",
    templates: ["Cache read"],
    arguments: {
      service: 'The read API, a Service entry of the download lane. Default "Watch API".',
      cache: 'Its cache. Default "Hot metadata".',
      database: 'The database it reads; another tile should write it. Default "Metadata".',
      reader: 'The Cache reader module. Default "Video details cache".',
      loader: 'The Data access that loads a miss. Default "Video details reader".',
      action: actionArg("download"),
      system: systemArg,
    },
  },
  counting: {
    name: "Counting from events",
    summary:
      "A tile publishes each event to a topic; a counter worker counts each event once into its own database; the source reads the totals (playbook pattern 5).",
    templates: ["Event counter"],
    arguments: {
      source: 'The tile that publishes events and reads the totals. Default "Watch API".',
      events: 'The topic. Default "View events".',
      counter: 'The counter worker. Default "View counter".',
      counts: 'The totals database, written only by the counter. Default "View counts".',
      publisher: 'The source\'s Event publisher. Default "View publisher".',
      reader: 'The source\'s Data access reading the totals. Default "View count reader".',
      action: actionArg("download"),
      system: systemArg,
    },
  },
  search: {
    name: "Search fed by events",
    summary:
      "An indexer worker consumes an existing topic and is the search index's only writer; a search API only reads it (playbook pattern 3). The Index writer is a template once the topic's publisher has an outbox on a database a template writes (the upload pipeline's publication).",
    templates: ["Search indexing", "Search query"],
    arguments: {
      events: 'An existing topic the indexer consumes. Default "Publication events".',
      indexer: 'The indexer worker. Default "Search indexer".',
      index: 'The search index. Default "Videos".',
      service: 'The search API, a Service entry of the download lane. Default "Search API".',
      query: 'The Search query module. Default "Video search".',
      action: actionArg("download"),
      system: systemArg,
    },
  },
  "sign-in": {
    name: "Required or optional sign-in",
    summary:
      "One Auth guard in a Service or Uploads tile, verifying an Identity. Required: every module route needs a signed-in caller. Optional: anyone may call; a signed-in caller is known. An existing guard is connected and set to the choice.",
    templates: ["Sign-in"],
    arguments: {
      tile: "The Service or Uploads tile to protect (a new name adds a Service entry of the download lane).",
      signIn: 'required or optional. Default "required".',
      identity: 'The Identity tile. Default "Sign-in".',
      guard:
        'The Auth guard\'s name. Default "Viewer check" (optional) or "Account check" (required).',
      action: actionArg("download"),
      system: systemArg,
    },
  },
  favorites: {
    name: "Favorites",
    summary:
      "An account service with a Required Auth guard keeps each signed-in account's favorite items in its own database; optionally a Data access on another database says which items may be kept.",
    templates: ["Favorites", "Sign-in"],
    arguments: {
      service: 'The account service, a Service entry of the download lane. Default "Account API".',
      database: 'Favorites\' own database. Default "Favorites".',
      identity: 'The Identity its Required guard verifies. Default "Sign-in".',
      items:
        "Optional: the database that says which items may be favorited (read through its published views). Omitted: none.",
      favorites: 'The Favorites module. Default "Favorite videos".',
      reader: 'The Data access on items. Default "Video reader".',
      guard: 'The Auth guard, when the service has none. Default "Account check".',
      action: actionArg("download"),
      system: systemArg,
    },
  },
  "owned-store": {
    name: "A store with one writer and published views",
    summary:
      "One tile owns and writes a database through a Data access; readers on other tiles read it through a Data access each. With Runnable processes on, the writer gets its own SQL file and schema, and readers see only the views it publishes (v3 contract section 1). The modules are stubs.",
    templates: [],
    arguments: {
      writer:
        'The tile that owns and writes the database (a new name adds a Service entry of the upload lane). Default "Catalog API".',
      database: 'The database. Default "Catalog".',
      readers:
        "Up to 4 tiles that read it (a new name adds a Service entry of the download lane). Default none.",
      writerModule: 'The writer\'s Data access. Default "<database> writer".',
      readerModule: 'Each reader\'s Data access. Default "<database> reader".',
      action: "The lane's action name, used only when the lane has none yet.",
      system: systemArg,
    },
  },
};

/** The patterns for `listStudioPatterns`: what each builds, its templates and its arguments. */
export function listModulePatterns() {
  return {
    tileArguments:
      "A tile argument names a tile: an existing tile (by ID or name) is reused; any other text is a new tile's name. Omitted, the default name is used the same way, so patterns applied in turn share tiles.",
    patterns: modulePatternIds.map((id) => {
      const { name, summary, templates, arguments: args } = modulePatternGuide[id];
      return {
        id,
        name,
        summary,
        templates,
        arguments: Object.entries(args).map(([arg, description]) => ({ name: arg, description })),
      };
    }),
  };
}

/** A pattern step refused, in plain words; nothing of the pattern is applied. */
export class ModulePatternRefusal extends Error {}

const list = (items: readonly string[], last = "or") =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;

/** The design a pattern grows, one checked command at a time. */
class Build {
  readonly commands: StudioCommand[] = [];
  constructor(
    public design: DesignDocument,
    private readonly installed: GenerationInstalledSupport,
    private readonly label: string,
    private readonly system: string | undefined,
  ) {}

  run(command: StudioCommand) {
    let next = command;
    // The first tile or action of an empty design names the system, as the canvas does.
    if (!this.design.architecture && (next.type === "addTile" || next.type === "addAction"))
      next = { ...next, system: { name: this.system ?? "System" } };
    let design: DesignDocument;
    try {
      const batch = buildSupportedAuthoringCommand(this.design, next, this.installed);
      const result = applyOperations(this.design, batch.ops);
      if (!result.ok) throw new Error(result.errors.map((item) => item.message).join(" "));
      design = result.design;
    } catch (error) {
      throw new ModulePatternRefusal(
        `${this.label}: ${error instanceof Error ? error.message : String(error)} Nothing of the pattern was applied.`,
      );
    }
    this.design = design;
    this.commands.push(next);
  }

  refuse(message: string): never {
    throw new ModulePatternRefusal(`${this.label}: ${message} Nothing of the pattern was applied.`);
  }

  get modules(): StudioComponent[] {
    return this.design.architecture?.studio?.components ?? [];
  }
  kindOf(id: string): StudioKind | undefined {
    return this.design.architecture?.studio?.elements.find((item) => item.element === id)?.settings
      .kind;
  }
  name(id: string) {
    return this.design.elements.find((item) => item.id === id)?.name ?? id;
  }

  /** An existing tile named `value` (by ID or name), checked against the kinds it may be. */
  find(value: string, kinds: readonly StudioKind[], role: string): string | undefined {
    const wanted = value.trim();
    const match =
      this.design.elements.find((item) => item.id === wanted) ??
      this.design.elements.find((item) => item.name.trim().toLowerCase() === wanted.toLowerCase());
    if (!match) return undefined;
    const kind = this.kindOf(match.id);
    if (!kind || !kinds.includes(kind))
      this.refuse(
        `${match.name} is ${kind ? studioKindNoun(kind) : "not a tile"}; the ${role} must be ${list(kinds.map(studioKindNoun))}.`,
      );
    return match.id;
  }

  private newTile(value: string, kind: StudioKind) {
    const used = usedIds(this.design);
    return { id: freshId(slug(value) || kind, (id) => used.has(id)), name: value.trim(), kind };
  }

  /** A tile, or a new entry of the lane's action (named `action` when the lane has none). */
  entry(
    lane: StudioLane,
    value: string,
    kinds: readonly StudioKind[],
    role: string,
    action?: string,
  ): string {
    const found = this.find(value, kinds, role);
    if (found) return found;
    const [kind] = kinds;
    if (!kind) this.refuse(`No kind for the ${role}.`);
    const studio = this.design.architecture?.studio;
    if (action && !studioActions(studio).some((item) => item.lane === lane))
      this.run({ type: "addAction", lane, name: action });
    const created = this.newTile(value, kind);
    this.run({
      type: "addTile",
      from: { lane },
      side: "after",
      tile: created,
      linkId: newLinkId(this.design, { lane }, created.id),
    });
    return created.id;
  }

  /** A tile, or a new tile linked after `from`. */
  after(from: string, value: string, kinds: readonly StudioKind[], role: string): string {
    const found = this.find(value, kinds, role);
    if (found) return found;
    const [kind] = kinds;
    if (!kind) this.refuse(`No kind for the ${role}.`);
    const created = this.newTile(value, kind);
    this.run({
      type: "addTile",
      from: { tile: from },
      side: "after",
      tile: created,
      linkId: newLinkId(this.design, { tile: from }, created.id),
    });
    return created.id;
  }

  /** The host's module of this kind and name, or a new one. */
  module(host: string, kind: StudioComponentKind, name: string): string {
    const existing = this.modules.find(
      (item) =>
        item.host === host &&
        item.settings.kind === kind &&
        item.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (existing) return existing.id;
    const { id } = newModuleIdentity(this.design, host, kind, name);
    this.run({ type: "addModule", host, kind, id, name: name.trim() });
    return id;
  }

  /** Fills a slot, unless it already holds this target. */
  connect(module: string, slot: StudioModuleSlotId, target: { tile: string } | { module: string }) {
    const state = moduleSlots(this.design, module).find((item) => item.slot.id === slot);
    const same = (other: { tile: string } | { module: string }) =>
      "tile" in target
        ? "tile" in other && other.tile === target.tile
        : "module" in other && other.module === target.module;
    if (state?.links.some((link) => same(link.target))) return;
    this.run({ type: "connectModule", module, slot, target });
  }

  /**
   * The tile's one Auth guard, connected to an Identity, with Sign-in `wanted`. An existing guard
   * is kept: connected if it isn't, and set to `wanted` unless the pattern only needs Required
   * (`fixed`), which refuses an Optional guard rather than change it.
   */
  guard(
    host: string,
    identity: string,
    wanted: "required" | "optional",
    name: string,
    fixed: boolean,
  ) {
    const guards = this.modules.filter(
      (item) => item.host === host && item.settings.kind === "auth-guard",
    );
    if (guards.length > 1)
      this.refuse(`${this.name(host)} has ${guards.length} Auth guards; a tile keeps one.`);
    const id = guards[0]?.id ?? this.module(host, "auth-guard", name);
    const linked = moduleSlots(this.design, id).find((item) => item.slot.id === "identity");
    if (!linked?.links.length) this.connect(id, "identity", { tile: identity });
    const module = this.modules.find((item) => item.id === id);
    if (!module) this.refuse(`The Auth guard ${name} wasn't added.`);
    const current = guardSignIn(module);
    if (current === wanted) return id;
    if (fixed)
      this.refuse(
        `${module.name} in ${this.name(host)} is Optional, and this pattern needs it Required. Set its Sign-in to Required first (the sign-in pattern), or use another tile.`,
      );
    this.run({
      type: "editComponent",
      component: id,
      settings: { ...module.settings, signIn: wanted } as StudioComponent["settings"],
    });
    return id;
  }
}

const hosts = (template: keyof typeof generationCapabilities) =>
  generationCapabilities[template].hosts;
const application: readonly StudioKind[] = ["service", "uploads", "worker"];

/**
 * The commands a pattern sends on `design`, each checked with the same builder the mouse and chat
 * use, and the design they make. Refuses the whole pattern in plain words
 * (`ModulePatternRefusal`) when any step is refused; nothing is applied then.
 */
export function buildModulePattern(
  design: DesignDocument,
  raw: ModulePattern,
  installed: GenerationInstalledSupport,
): { commands: StudioCommand[]; design: DesignDocument } {
  const pattern = modulePatternSchema.parse(raw);
  const build = new Build(design, installed, modulePatternGuide[pattern.id].name, pattern.system);
  switch (pattern.id) {
    case "upload-pipeline": {
      const service = build.entry(
        "upload",
        pattern.service ?? "Upload API",
        hosts("owned-multipart"),
        "upload service",
        pattern.action,
      );
      const identity = build.after(
        service,
        pattern.identity ?? "Sign-in",
        ["identity"],
        "identity",
      );
      const metadata = build.after(
        service,
        pattern.metadata ?? "Metadata",
        ["database"],
        "database",
      );
      const originals = build.after(
        service,
        pattern.originals ?? "Original videos",
        ["object-store"],
        "originals storage",
      );
      const jobs = build.after(service, pattern.jobs ?? "Upload jobs", ["queue"], "job queue");
      const processor = build.after(jobs, pattern.processor ?? "Transcoder", ["worker"], "worker");
      const outputs = build.after(
        processor,
        pattern.outputs ?? "Transcoded videos",
        ["object-store"],
        "output storage",
      );
      const results = build.after(
        processor,
        pattern.results ?? "Processing events",
        ["queue"],
        "results topic",
      );
      const lifecycle = build.after(
        results,
        pattern.lifecycle ?? "Video lifecycle",
        ["worker"],
        "lifecycle worker",
      );
      const publication =
        pattern.publication &&
        build.after(lifecycle, pattern.publication, ["queue"], "publication topic");
      if (pattern.delivery) {
        // A CDN pulls from the storage the pipeline wrote; the pipeline never writes the CDN.
        const delivery = build.entry("download", pattern.delivery, ["cdn"], "delivery CDN");
        const linked = build.design.connections.some(
          (item) => item.from.element === delivery && item.to.element === outputs,
        );
        if (!linked)
          build.run({
            type: "linkTiles",
            from: { tile: delivery },
            to: outputs,
            linkId: newLinkId(build.design, { tile: delivery }, outputs),
          });
      }
      build.guard(service, identity, "required", "Creator check", true);
      const uploads = build.module(service, "multipart-uploads", "Multipart uploads");
      build.connect(uploads, "objects", { tile: originals });
      const outbox = build.module(service, "event-publisher", "Job outbox publisher");
      build.connect(outbox, "channel", { tile: jobs });
      build.connect(outbox, "outbox", { tile: metadata });
      const state = build.module(service, "data-access", "Upload state writer");
      build.connect(state, "database", { tile: metadata });
      const consumer = build.module(processor, "event-consumer", "Job consumer");
      build.connect(consumer, "channel", { tile: jobs });
      const encoder = build.module(processor, "video-encoder", "Segmenter and encoder");
      build.connect(encoder, "originals", { tile: originals });
      const packager = build.module(processor, "video-packager", "Packager");
      build.connect(packager, "outputs", { tile: outputs });
      const thumbnailer = build.module(processor, "video-thumbnailer", "Thumbnailer");
      build.connect(thumbnailer, "outputs", { tile: outputs });
      const announce = build.module(processor, "event-publisher", "Processing result publisher");
      build.connect(announce, "channel", { tile: results });
      const processing = build.module(lifecycle, "event-consumer", "Processing consumer");
      build.connect(processing, "channel", { tile: results });
      const writer = build.module(lifecycle, "lifecycle-writer", "Lifecycle writer");
      build.connect(writer, "state", { tile: metadata });
      if (publication) {
        const publisher = build.module(lifecycle, "event-publisher", "Video publication publisher");
        build.connect(publisher, "channel", { tile: publication });
        build.connect(publisher, "outbox", { tile: metadata });
      }
      break;
    }
    case "cache-read": {
      const service = build.entry(
        "download",
        pattern.service ?? "Watch API",
        hosts("positive-cache-read"),
        "read API",
        pattern.action,
      );
      const cache = build.after(service, pattern.cache ?? "Hot metadata", ["cache"], "cache");
      const database = build.after(
        service,
        pattern.database ?? "Metadata",
        ["database"],
        "database",
      );
      const reader = build.module(service, "cache-reader", pattern.reader ?? "Video details cache");
      const loader = build.module(service, "data-access", pattern.loader ?? "Video details reader");
      build.connect(reader, "cache", { tile: cache });
      build.connect(loader, "database", { tile: database });
      build.connect(reader, "loader", { module: loader });
      break;
    }
    case "counting": {
      const source = build.entry(
        "download",
        pattern.source ?? "Watch API",
        application,
        "event source",
        pattern.action,
      );
      const events = build.after(source, pattern.events ?? "View events", ["queue"], "topic");
      const counter = build.after(events, pattern.counter ?? "View counter", ["worker"], "counter");
      const counts = build.after(
        counter,
        pattern.counts ?? "View counts",
        ["database"],
        "database",
      );
      const publisher = build.module(
        source,
        "event-publisher",
        pattern.publisher ?? "View publisher",
      );
      build.connect(publisher, "channel", { tile: events });
      const reader = build.module(source, "data-access", pattern.reader ?? "View count reader");
      build.connect(reader, "database", { tile: counts });
      const consumer = build.module(counter, "event-consumer", "View consumer");
      build.connect(consumer, "channel", { tile: events });
      build.module(counter, "event-counter", "Receipt and increment");
      const writer = build.module(counter, "data-access", "Count writer");
      build.connect(writer, "database", { tile: counts });
      break;
    }
    case "search": {
      const named = pattern.events ?? "Publication events";
      const events =
        build.find(named, ["queue"], "topic") ??
        build.refuse(
          `There is no topic "${named}". Search consumes an existing topic: name one (events), such as the upload pipeline's publication topic.`,
        );
      const indexer = build.after(
        events,
        pattern.indexer ?? "Search indexer",
        ["worker"],
        "indexer",
      );
      const index = build.after(indexer, pattern.index ?? "Videos", ["search"], "search index");
      const service = build.entry(
        "download",
        pattern.service ?? "Search API",
        hosts("search-query"),
        "search API",
        pattern.action,
      );
      const consumer = build.module(
        indexer,
        "event-consumer",
        `${build.name(events).replace(/ events?$/i, "")} consumer`,
      );
      build.connect(consumer, "channel", { tile: events });
      const writer = build.module(indexer, "index-writer", "Index writer");
      build.connect(writer, "index", { tile: index });
      const query = build.module(service, "search-query", pattern.query ?? "Video search");
      build.connect(query, "index", { tile: index });
      break;
    }
    case "sign-in": {
      const wanted = pattern.signIn ?? "required";
      const host = build.entry(
        "download",
        pattern.tile,
        hosts("verified-identity"),
        "tile to protect",
        pattern.action,
      );
      const identity = build.after(host, pattern.identity ?? "Sign-in", ["identity"], "identity");
      build.guard(
        host,
        identity,
        wanted,
        pattern.guard ?? (wanted === "optional" ? "Viewer check" : "Account check"),
        false,
      );
      break;
    }
    case "favorites": {
      const service = build.entry(
        "download",
        pattern.service ?? "Account API",
        hosts("favorites"),
        "account service",
        pattern.action,
      );
      const database = build.after(
        service,
        pattern.database ?? "Favorites",
        ["database"],
        "database",
      );
      const identity = build.after(
        service,
        pattern.identity ?? "Sign-in",
        ["identity"],
        "identity",
      );
      build.guard(service, identity, "required", pattern.guard ?? "Account check", true);
      const favorites = build.module(service, "favorites", pattern.favorites ?? "Favorite videos");
      build.connect(favorites, "state", { tile: database });
      if (pattern.items) {
        const items = build.after(service, pattern.items, ["database"], "items database");
        const reader = build.module(service, "data-access", pattern.reader ?? "Video reader");
        build.connect(reader, "database", { tile: items });
        build.connect(favorites, "items", { module: reader });
      }
      break;
    }
    case "owned-store": {
      const writer = build.entry(
        "upload",
        pattern.writer ?? "Catalog API",
        application,
        "writer",
        pattern.action,
      );
      const named = pattern.database ?? "Catalog";
      const existing = build.find(named, ["database"], "database");
      if (existing) {
        const owner = build.design.architecture?.studio?.elements.find(
          (item) => item.element === existing,
        )?.owner;
        if (owner && !(owner.kind === "element" && owner.id === writer))
          build.refuse(
            `${build.name(existing)} already has its writer${owner.kind === "element" ? `, ${build.name(owner.id)}` : ""}: a store has one writer.`,
          );
        if (!owner)
          build.run({ type: "edit", element: existing, owner: { kind: "element", id: writer } });
      }
      const database = existing ?? build.after(writer, named, ["database"], "database");
      const base = build.name(database);
      const module = build.module(writer, "data-access", pattern.writerModule ?? `${base} writer`);
      build.connect(module, "database", { tile: database });
      for (const value of pattern.readers ?? []) {
        const reader = build.entry("download", value, application, "reader");
        if (reader === writer) build.refuse(`${build.name(reader)} is the writer, not a reader.`);
        const access = build.module(
          reader,
          "data-access",
          pattern.readerModule ?? `${base} reader`,
        );
        build.connect(access, "database", { tile: database });
      }
      break;
    }
  }
  return { commands: build.commands, design: build.design };
}

/** Every argument name a pattern takes besides `id`, in schema order. */
export const modulePatternArguments = (id: ModulePatternId): string[] => {
  const option = modulePatternSchema.options.find((item) => item.shape.id.value === id);
  return option ? Object.keys(option.shape).filter((key) => key !== "id") : [];
};
