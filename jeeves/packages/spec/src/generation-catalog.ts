/** Declarative identities only. Catalog presence never installs executable template code. */
import { freezeRecord, jsonSha256 } from "./content-hash.ts";
import { type ExactContractRef, sameContractRef } from "./operation-records.ts";

const record = <T>(id: string, definition: T) =>
  freezeRecord({ ref: { id, version: "0.1.0", sha256: jsonSha256(definition) }, definition });

/** Fixed internal policies, not editable settings or defaults applied by parsing a document. */
export const generationPolicies = freezeRecord({
  ownedMultipart: record("owned-multipart-policy", {
    partBytes: 5 * 1024 * 1024,
    maxBytes: 256 * 1024 * 1024,
    signedUrlSeconds: 900,
    resumeSeconds: 86400,
    ownership: "verified-principal-and-durable-record",
    completion: "list-parts-and-head-fingerprint",
  }),
  assetLifecycle: record("asset-lifecycle-policy", {
    queuedDeadlineSeconds: 600,
    processingDeadlineSeconds: 1800,
    result: "matching-job-attempt-before-db-deadline",
    publication: "committed-eligible-result-only",
    durability: "state-receipt-and-outbox-one-transaction",
  }),
  videoHls: record("video-hls-policy", {
    input: {
      container: "mp4",
      video: "h264",
      audio: "aac",
      minSeconds: 1,
      maxSeconds: 600,
      minHeight: 720,
      maxHeight: 1080,
      orientation: "landscape",
    },
    renditions: [
      { width: 640, height: 360, videoKbps: 1000 },
      { width: 1280, height: 720, videoKbps: 3000 },
    ],
    segmentSeconds: 4,
    concurrency: 1,
    subprocessTimeoutMs: 1200000,
    probeTimeoutMs: 30000,
    result: "immutable-fingerprint-marker-and-inventory",
    cleanup: "local-temp-always",
  }),
  positiveCache: record("positive-cache-policy", {
    misses: "not-cached",
    fill: "single-flight",
    fallback: "authoritative-loader",
    ttl: "existing-cache-setting",
    eligibility: "adapter-validated-positive-record",
  }),
  eventCounter: record("event-counter-policy", {
    effect: "receipt-and-increment-one-transaction",
    identity: "aggregate-and-event-id",
  }),
  publicVideo: record("public-video-policy", {
    visibility: "committed-ready-only",
    publicationVersion: 1,
    search: {
      fields: ["title^3", "description", "channel^2"],
      type: "best_fields",
      maxQueryCharacters: 200,
      maxPage: 100,
      pageSize: 20,
      timeoutMs: 750,
      sort: ["score-desc", "published-at-desc", "asset-id-asc"],
    },
    playback: "two-cumulative-qualifying-seconds-per-page-session",
    totals: "outside-immutable-metadata-cache",
  }),
  /** Favorites' bounds (v3 contract, section 3): the item ID, per account and to a page. */
  favorites: record("favorites-policy", {
    account: { source: "verified-principal-subject", maxCharacters: 255 },
    item: { minCharacters: 1, maxCharacters: 200, characters: "A-Za-z0-9._:-" },
    perAccount: 1000,
    pageSize: 50,
    order: "newest-first",
    add: "idempotent-eligible-only",
  }),
});

export const generationRuntime = record("local-runtime", {
  execution: "docker",
  language: "typescript",
  generation: "local-v2",
  maturity: "experimental",
  supportedResources: [
    "postgresql",
    "garage",
    "rabbitmq",
    "valkey",
    "opensearch",
    "keycloak",
    "nginx",
  ],
});

const template = <K extends string>(kind: K, policies: ExactContractRef[]) =>
  record(kind, { binding: kind, policies, maturity: "experimental" });
export const generationTemplates = freezeRecord({
  "owned-multipart": template("owned-multipart", [generationPolicies.ownedMultipart.ref]),
  "asset-lifecycle": template("asset-lifecycle", [generationPolicies.assetLifecycle.ref]),
  "video-hls": template("video-hls", [generationPolicies.videoHls.ref]),
  "positive-cache-read": template("positive-cache-read", [generationPolicies.positiveCache.ref]),
  "event-counter": template("event-counter", [generationPolicies.eventCounter.ref]),
  "search-projection": template("search-projection", []),
  "search-query": template("search-query", []),
  /** An Auth guard's sign-in (v3 contract, section 2): Required or Optional, against its Identity. */
  "verified-identity": template("verified-identity", []),
  /** An account's favorite items behind a Required sign-in (v3 contract, section 3). */
  favorites: template("favorites", [generationPolicies.favorites.ref]),
  "youtube-upload": template("youtube-upload", [generationPolicies.publicVideo.ref]),
  "youtube-watch": template("youtube-watch", [generationPolicies.publicVideo.ref]),
  "youtube-search": template("youtube-search", [generationPolicies.publicVideo.ref]),
  /** A module's typed stub (module authoring contract, section 6); no role, resources or policy. */
  "module-stub": template("module-stub", []),
});
export type GenerationBindingKind = keyof typeof generationTemplates;
export const generationTemplateCatalog = freezeRecord(Object.values(generationTemplates));
export const generationPresets = freezeRecord({
  video: record("video-feature", {
    templates: [
      generationTemplates["owned-multipart"].ref,
      generationTemplates["asset-lifecycle"].ref,
      generationTemplates["video-hls"].ref,
    ],
    policies: [
      generationPolicies.ownedMultipart.ref,
      generationPolicies.assetLifecycle.ref,
      generationPolicies.videoHls.ref,
    ],
  }),
  /** Pinned to the ten templates and six policies it was recorded with (sha256 `d4c66f03…`), so a
   * policy or template added later never changes it. */
  youtube: record("youtube-core", {
    templates: (
      [
        "owned-multipart",
        "asset-lifecycle",
        "video-hls",
        "positive-cache-read",
        "event-counter",
        "search-projection",
        "search-query",
        "youtube-upload",
        "youtube-watch",
        "youtube-search",
      ] as const
    ).map((kind) => generationTemplates[kind].ref),
    policies: (
      [
        "ownedMultipart",
        "assetLifecycle",
        "videoHls",
        "positiveCache",
        "eventCounter",
        "publicVideo",
      ] as const
    ).map((key) => generationPolicies[key].ref),
  }),
});
export const generationPresetCatalog = freezeRecord(Object.values(generationPresets));
export function knownGenerationTemplate(ref: ExactContractRef) {
  return generationTemplateCatalog.find((entry) => sameContractRef(entry.ref, ref));
}
export function knownGenerationPreset(ref: ExactContractRef) {
  return generationPresetCatalog.find((entry) => sameContractRef(entry.ref, ref));
}
