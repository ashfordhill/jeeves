/**
 * The capability rubric (V3-19): scores a design built from a short product brief by what it can
 * do, not by its names. A model that names every tile its own way scores the same as one that
 * uses the patterns' placeholders, as long as the right kinds are wired the right way, the async
 * paths go through channels, the guards protect the right tiles and the templates resolve.
 *
 * Five areas, each 100 × credit ÷ checks; the total is their mean, as the build score's is:
 *
 * - **kinds:** the tiles the brief needs (uploads, the two object storages, a processing worker
 *   fed by a queue, a CDN, the records database, an identity, a search index, a cache, a counts
 *   database);
 * - **wiring:** who links to whom (both lanes used, the read path, the lifecycle after the
 *   processing worker, search fed by events, counting from events, favorites with its own state);
 * - **async:** every link into or out of a channel is dashed and no store link is, the jobs
 *   channel is a Queue, the event channels are Topics, and there are enough channels;
 * - **guards:** Required sign-in on the uploads and on favorites, Optional on the read path, and
 *   every guard connected to an identity;
 * - **templates:** each template the brief calls for resolves, Runnable processes is on and the
 *   review has nothing left to fix.
 *
 * Every check names what it found or missed, so a report says why a design lost credit.
 */
import {
  type DesignDocument,
  designGeneration,
  designReview,
  type GenerationInstalledSupport,
  guardSignIn,
  LANE_ACTOR,
  laneGraph,
  moduleStatuses,
  type StudioKind,
} from "@jeeves/spec";
import type { AreaScore, ScoreItem } from "./design-score.ts";

export const capabilityAreas = ["kinds", "wiring", "async", "guards", "templates"] as const;
export type CapabilityArea = (typeof capabilityAreas)[number];
export type CapabilityScore = {
  total: number;
  /** Which rubric scored it. */
  rubric: string;
  capabilities: Record<CapabilityArea, AreaScore>;
};
/** What the brief asks of the processing step: video encoding, or any working processing. */
export type CapabilityRubric = { id: string; processing: "video-encoding" | "any" };

const round = (value: number) => Math.round(value * 10) / 10;
const area = (items: ScoreItem[]): AreaScore => {
  const credit = items.reduce((sum, item) => sum + item.credit, 0);
  return {
    score: items.length ? round((100 * credit) / items.length) : 100,
    credit,
    reference: items.length,
    candidate: items.length,
    items,
  };
};

/** The design as the rubric reads it: tiles, links, modules and their statuses. */
function facts(design: DesignDocument, installed: GenerationInstalledSupport) {
  const studio = design.architecture?.studio;
  const graph = laneGraph(design);
  const tiles = design.elements.map((element) => {
    const row = studio?.elements.find((item) => item.element === element.id);
    return {
      id: element.id,
      name: element.name,
      kind: row?.settings.kind as StudioKind | undefined,
      settings: (row?.settings ?? {}) as Record<string, unknown>,
    };
  });
  const tile = (id: string | undefined) => tiles.find((item) => item.id === id);
  const kindOf = (id: string | undefined) => tile(id)?.kind;
  const isTile = (id: string) => tiles.some((item) => item.id === id);
  const links = graph.edges.filter((edge) => isTile(edge.source) && isTile(edge.target));
  const entries = (lane: "download" | "upload") =>
    graph.edges.filter((edge) => edge.lane === lane).map((edge) => edge.target);
  const out = (id: string, kind?: StudioKind) =>
    links
      .filter((edge) => edge.source === id && (!kind || kindOf(edge.target) === kind))
      .map((edge) => edge.target);
  const into = (id: string, kind?: StudioKind) =>
    links
      .filter((edge) => edge.target === id && (!kind || kindOf(edge.source) === kind))
      .map((edge) => edge.source);
  const modules = studio?.components ?? [];
  const moduleLinks = studio?.componentConnections ?? [];
  const statuses = moduleStatuses(design);
  const ofKind = (kind: StudioKind) => tiles.filter((item) => item.kind === kind);
  const review = designReview(design, installed).findings;
  return {
    graph,
    tiles,
    tile,
    kindOf,
    links,
    entries,
    out,
    into,
    modules,
    moduleLinks,
    statuses,
    ofKind,
    review,
    userLines: graph.edges.filter((edge) => edge.source === LANE_ACTOR).length,
  };
}
type Facts = ReturnType<typeof facts>;

const check = (key: string, credit: number, note?: string): ScoreItem => ({
  key,
  credit,
  ...(credit < 1 && note ? { note } : {}),
});
const named = (f: Facts, ids: readonly (string | undefined)[]) =>
  ids.flatMap((id) => (id ? [f.tile(id)?.name ?? id] : [])).join(", ");

/** The tiles a rubric's checks are about, found by kind and wiring, never by name. */
function roles(f: Facts) {
  const uploadEntries = f.entries("upload");
  const uploads =
    uploadEntries.find((id) => f.kindOf(id) === "uploads") ??
    f.modules.find((item) => item.settings.kind === "multipart-uploads")?.host ??
    f.ofKind("uploads")[0]?.id;
  const originals = uploads ? f.out(uploads, "object-store") : [];
  const records = uploads ? f.out(uploads, "database") : [];
  const jobs = uploads ? f.out(uploads, "queue") : [];
  const processor = jobs.flatMap((channel) => f.out(channel, "worker"))[0];
  const outputs = processor
    ? f.out(processor, "object-store").filter((id) => !originals.includes(id))
    : [];
  const results = processor ? f.out(processor, "queue") : [];
  const lifecycle = results.flatMap((channel) => f.out(channel, "worker"))[0];
  const publications = lifecycle ? f.out(lifecycle, "queue") : [];
  const indexer = publications.flatMap((channel) => f.out(channel, "worker"))[0];
  const downloadServices = f
    .entries("download")
    .filter((id) => f.kindOf(id) === "service" || f.kindOf(id) === "uploads");
  // The read path: a download-lane service that reads the records (or holds a Cache reader).
  const reader =
    downloadServices.find((id) =>
      f.modules.some((item) => item.host === id && item.settings.kind === "cache-reader"),
    ) ?? downloadServices.find((id) => f.out(id, "database").some((db) => records.includes(db)));
  // Counting: a channel a download-lane service publishes to, consumed by a worker that writes a
  // database a download-lane service reads.
  const counting = downloadServices
    .flatMap((service) => f.out(service, "queue").map((channel) => ({ service, channel })))
    .flatMap(({ service, channel }) =>
      f.out(channel, "worker").map((worker) => ({ service, channel, worker })),
    )
    .map((item) => ({
      ...item,
      counts: f
        .out(item.worker, "database")
        .find((db) => downloadServices.some((service) => f.out(service, "database").includes(db))),
    }))
    .find((item) => item.counts);
  const favorites = f.modules.find((item) => item.settings.kind === "favorites");
  return {
    uploads,
    originals,
    records,
    jobs,
    processor,
    outputs,
    results,
    lifecycle,
    publications,
    indexer,
    downloadServices,
    reader,
    counting,
    favorites,
  };
}

/** The tile's Auth guard: its Sign-in, and whether it verifies an identity. */
function guardOf(f: Facts, host: string | undefined) {
  const guard = f.modules.find((item) => item.host === host && item.settings.kind === "auth-guard");
  if (!guard) return undefined;
  const connected = f.moduleLinks.some(
    (link) =>
      link.from === guard.id && link.to.kind === "element" && f.kindOf(link.to.id) === "identity",
  );
  return { signIn: guardSignIn(guard), connected };
}

/** The capability score of `design` for a short product brief (see the module comment). */
export function scoreCapabilities(
  rubric: CapabilityRubric,
  design: DesignDocument,
  installed: GenerationInstalledSupport,
): CapabilityScore {
  const f = facts(design, installed);
  const r = roles(f);
  const has = (ok: boolean, key: string, note: string) => check(key, ok ? 1 : 0, note);

  // Kinds.
  const uploadsKind = r.uploads ? f.kindOf(r.uploads) : undefined;
  const kinds: ScoreItem[] = [
    check(
      "an Uploads tile on the upload lane",
      r.uploads && uploadsKind === "uploads" && f.entries("upload").includes(r.uploads)
        ? 1
        : r.uploads
          ? 0.5
          : 0,
      r.uploads ? `found ${named(f, [r.uploads])} (${uploadsKind})` : "none",
    ),
    has(r.originals.length > 0, "object storage the uploads write", "the uploads write none"),
    has(!!r.processor, "a processing worker fed through a queue by the uploads", "none"),
    check(
      "separate object storage the processing worker writes",
      r.outputs.length ? 1 : r.processor && f.out(r.processor, "object-store").length ? 0.5 : 0,
      r.processor ? "it writes the originals' storage, or none" : "no processing worker",
    ),
    has(
      f
        .entries("download")
        .some((id) => f.kindOf(id) === "cdn" && f.out(id, "object-store").length),
      "a CDN on the download lane serving object storage",
      "none",
    ),
    has(r.records.length > 0, "a database the uploads record into", "none"),
    has(f.ofKind("identity").length > 0, "an identity provider", "none"),
    has(f.ofKind("search").length > 0, "a search index", "none"),
    has(
      f
        .ofKind("cache")
        .some((cache) => f.into(cache.id).some((id) => r.downloadServices.includes(id))),
      "a cache a download-lane service reads",
      "none",
    ),
    has(!!r.counting, "a counts database written by a worker that consumes events", "none"),
  ];

  // Wiring.
  const writesRecords = (worker: string | undefined) =>
    !!worker && f.out(worker, "database").some((db) => r.records.includes(db));
  const indexReaders = f
    .ofKind("search")
    .flatMap((index) => f.into(index.id).filter((id) => r.downloadServices.includes(id)));
  const favoritesState = r.favorites
    ? f.moduleLinks.find(
        (link) =>
          link.from === r.favorites?.id &&
          link.to.kind === "element" &&
          f.kindOf(link.to.id) === "database",
      )
    : undefined;
  const wiring: ScoreItem[] = [
    has(
      f.entries("download").length > 0 && f.entries("upload").length > 0,
      "both lanes used: watching and publishing",
      "a lane has no entry",
    ),
    has(
      !!r.reader && f.out(r.reader, "database").some((db) => r.records.includes(db)),
      "a download-lane service reads the records the uploads write",
      r.reader ? `${named(f, [r.reader])} doesn't read them` : "no read service",
    ),
    has(
      writesRecords(r.lifecycle),
      "a lifecycle worker after the processing results writes the records",
      r.lifecycle ? "it doesn't write the records" : "no worker consumes the processing results",
    ),
    check(
      "search fed by events: an indexer after the lifecycle writes the index a service reads",
      r.indexer && f.out(r.indexer, "search").length && indexReaders.length
        ? 1
        : f.ofKind("search").length && indexReaders.length
          ? 0.5
          : 0,
      r.indexer ? "the index isn't read from the download lane" : "the index isn't fed by events",
    ),
    has(
      !!r.counting,
      "counting from events: a service publishes plays, a worker counts them",
      "none",
    ),
    check(
      "favorites in a download-lane service, with its own database",
      r.favorites && favoritesState && r.downloadServices.includes(r.favorites.host)
        ? 1
        : r.favorites
          ? 0.5
          : 0,
      r.favorites ? "not on the download lane, or no state database" : "no Favorites module",
    ),
  ];

  // Async.
  const channelLinks = f.links.filter(
    (edge) => f.kindOf(edge.source) === "queue" || f.kindOf(edge.target) === "queue",
  );
  const solidChannel = channelLinks.filter((edge) => !edge.async);
  const lineStyle = f.review.filter((item) => item.check === "line-style");
  const mode = (id: string | undefined) => f.tile(id)?.settings.mode;
  const eventChannels = [r.counting?.channel, ...r.results, ...r.publications].filter(
    (id): id is string => !!id,
  );
  const async: ScoreItem[] = [
    has(
      channelLinks.length > 0 && solidChannel.length === 0,
      "every link into or out of a channel is dashed",
      channelLinks.length
        ? `solid: ${solidChannel.map((edge) => edge.id).join(", ")}`
        : "no channels",
    ),
    has(
      lineStyle.length === 0,
      "no line whose style contradicts its channel",
      "line-style findings",
    ),
    has(
      r.jobs.some((id) => mode(id) === "work-queue"),
      "the jobs channel is a Queue",
      r.jobs.length ? `mode ${String(mode(r.jobs[0]))}` : "no jobs channel",
    ),
    check(
      "the event channels are Topics",
      eventChannels.length && eventChannels.every((id) => mode(id) === "topic")
        ? 1
        : eventChannels.some((id) => mode(id) === "topic")
          ? 0.5
          : 0,
      eventChannels.length ? "some aren't topics" : "no event channels",
    ),
    check(
      "four channels: jobs, results, publications and plays",
      Math.min(1, f.ofKind("queue").length / 4),
      `${f.ofKind("queue").length} channels`,
    ),
  ];

  // Guards.
  const uploadGuard = guardOf(f, r.uploads);
  const readGuard = guardOf(f, r.reader);
  const favoritesGuard = guardOf(f, r.favorites?.host);
  const guards = f.modules.filter((item) => item.settings.kind === "auth-guard");
  const guardItem = (
    key: string,
    found: ReturnType<typeof guardOf>,
    wanted: "required" | "optional",
  ) =>
    check(
      key,
      found?.connected && found.signIn === wanted ? 1 : found ? 0.5 : 0,
      found ? `${found.signIn}${found.connected ? "" : ", not connected"}` : "no Auth guard",
    );
  const guardItems: ScoreItem[] = [
    guardItem("Required sign-in on the uploads", uploadGuard, "required"),
    guardItem("Optional sign-in on the read path", readGuard, "optional"),
    guardItem("Required sign-in on favorites", favoritesGuard, "required"),
    has(
      guards.length > 0 && guards.every((guard) => guardOf(f, guard.host)?.connected),
      "every Auth guard verifies an identity",
      guards.length ? "a guard isn't connected" : "no guards",
    ),
  ];

  // Templates.
  const templates = new Map<string, number>();
  for (const item of f.statuses)
    if (item.status === "template" && item.template)
      templates.set(item.template, (templates.get(item.template) ?? 0) + 1);
  const leads = (template: string) =>
    f.statuses.filter(
      (item) => item.status === "template" && item.template === template && item.selection,
    );
  const template = (id: string, label: string) =>
    has(templates.has(id), `${label} resolves`, "not a template");
  const signIns = new Set(leads("verified-identity").map((item) => item.selection)).size;
  const processingModules = f.statuses.filter((item) => item.host === r.processor);
  const fix = f.review.filter((item) => item.severity === "fix");
  const templateItems: ScoreItem[] = [
    template("owned-multipart", "Multipart upload"),
    rubric.processing === "video-encoding"
      ? template("video-hls", "Video encoding")
      : has(
          processingModules.length > 0 &&
            processingModules.every((item) => item.status === "template" || item.status === "stub"),
          "the processing worker's modules resolve (template or stub)",
          r.processor ? "a module is refused or unfinished" : "no processing worker",
        ),
    template("asset-lifecycle", "Upload lifecycle"),
    check("Sign-in on three tiles resolves", Math.min(1, signIns / 3), `${signIns} resolve`),
    template("positive-cache-read", "Cache read"),
    template("event-counter", "Event counter"),
    template("search-projection", "Search indexing"),
    template("search-query", "Search query"),
    template("favorites", "Favorites"),
    has(!!designGeneration(design)?.processes, "Runnable processes on", "off"),
    has(fix.length === 0, "nothing left to fix in the review", `${fix.length} to fix`),
  ];

  const capabilities: Record<CapabilityArea, AreaScore> = {
    kinds: area(kinds),
    wiring: area(wiring),
    async: area(async),
    guards: area(guardItems),
    templates: area(templateItems),
  };
  return {
    rubric: rubric.id,
    total: round(
      capabilityAreas.reduce((sum, key) => sum + capabilities[key].score, 0) /
        capabilityAreas.length,
    ),
    capabilities,
  };
}
