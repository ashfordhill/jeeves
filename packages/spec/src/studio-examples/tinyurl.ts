/**
 * The TinyURL study, the single studio study and fresh-install default. A read-heavy URL
 * shortener built from the published designs. Design intent only.
 *
 * In lanes: the user opens links (download, the **Open link** action) through the Stats API
 * (which reads the Analytics store) and the Redirect service (its URL cache, the URL database on a
 * cache miss, and the asynchronous click path into the Analytics store), and shortens links
 * (upload, the **Shorten** action) through the Shorten service, the URL database's only writer.
 *
 * What the sources agree on, and what each tile traces to:
 * - All four: a create path, a redirect path with a cache in front of the database, and one URL
 *   database written by create and read by redirect (Shorten service, Redirect service, URL
 *   cache, URL database).
 * - Three of four: separate redirect and create services.
 * - DesignGurus (Grokking): click analytics through a queue, consumers and a store, read through
 *   a stats API (Click events, Analytics worker, Analytics store, Stats API).
 * - No CDN tile: the lookup is cached, not the redirect response. A 302 cached at a CDN or in the
 *   browser stops clicks reaching the service (ByteByteGo's 301 vs 302 discussion, HelloInterview;
 *   Grokking answers 302 with `Cache-Control: no-store`). Dub runs its redirect as code on every
 *   request, reads link data from Redis, answers 302 and records the click after responding
 *   (`apps/web/lib/middleware/link.ts`). Running the redirect near users is a setting
 *   (Execution managed, Host Cloudflare Workers), not a tile.
 * - Owner decisions: ID generation is a module-level detail; the URL safety check and the expiry
 *   cleanup job are left out for the developer to add.
 *
 * Sources:
 * - HelloInterview, Design Bit.ly:
 *   https://www.hellointerview.com/learn/system-design/problem-breakdowns/bitly
 * - System Design Primer, Pastebin / Bit.ly:
 *   https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/pastebin
 * - DesignGurus (Grokking), TinyURL:
 *   https://www.designgurus.io/course-play/grokking-the-system-design-interview/doc/designing-a-url-shortening-service-like-tinyurl
 * - ByteByteGo (Alex Xu), Design a URL Shortener:
 *   https://bytebytego.com/courses/system-design-interview/design-a-url-shortener
 * - Dub, an open-source link shortener (AGPL): https://github.com/dubinc/dub
 */
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import type { StudioEntry, StudioLaneAction } from "../studio-model.ts";
import type { StudioConnectionCreation } from "../studio-operations.ts";
import { createStudioStudy } from "./study.ts";

const description =
  "A read-heavy URL shortener from published designs: a Redirect service reads through a URL cache to one URL database that only the Shorten service writes; clicks flow through a queue to an analytics store read by a Stats API.";

export const TINYURL_STUDIO_EXAMPLE = {
  id: "studio-tinyurl",
  version: "3.1.0",
  name: "TinyURL · studio study",
  description,
  /** SHA-256 of `description`, the study's goal. */
  goalManifestSha256: "07bb550567398a39c201d6e17c580ad9d63612aeaab06c01b3108052f6c25006",
} as const;

const call = (label: string, protocol: "SQL" | "Redis"): StudioConnectionCreation["planned"] => ({
  label,
  protocol,
  interaction: "Request / response",
  security: "Service identity",
});
const messaging = (label: string): StudioConnectionCreation["planned"] => ({
  label,
  protocol: "Messaging",
  interaction: "Asynchronous",
  security: "Service identity",
});

const components: StudioComponent[] = [
  // Redirect service: the hot read path.
  {
    id: "redirect-cache-reader",
    host: "redirect",
    name: "Cache reader",
    description: "Cache-aside: in-process L1, then Redis, one database load per key at a time.",
    settings: {
      kind: "cache-reader",
      pattern: "cache-aside",
      l1MaxEntries: 100000,
      l1TtlSeconds: 60,
      l2TtlSeconds: 86400,
      negativeTtlSeconds: 30,
      stampede: "single-flight",
    },
  },
  {
    id: "redirect-data",
    host: "redirect",
    name: "Link reader",
    description: "Reads links from a replica on a cache miss.",
    settings: {
      kind: "data-access",
      poolSize: 50,
      readRouting: "replica",
      statementTimeoutMs: 200,
    },
  },
  {
    id: "redirect-responder",
    host: "redirect",
    name: "Redirect responder",
    description: "Answers 302 with no edge caching, so every click reaches the service.",
    settings: { kind: "redirect-responder", status: "302", edgeMaxAgeSeconds: 0 },
  },
  {
    id: "redirect-click-publisher",
    host: "redirect",
    name: "Click publisher",
    description: "Publishes click events in batches after responding.",
    settings: { kind: "event-publisher", batchSize: 500, lingerMs: 50, outbox: "disabled" },
  },
  // Analytics worker: throughput over latency.
  {
    id: "analytics-click-consumer",
    host: "analytics",
    name: "Click consumer",
    description: "Consumes click batches with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 8, batchSize: 1000, retryLimit: 5 },
  },
  {
    id: "analytics-aggregation",
    host: "analytics",
    name: "Click aggregation",
    description: "Rolls clicks up per link and hour before writing.",
    settings: { kind: "custom" },
  },
  {
    id: "analytics-data",
    host: "analytics",
    name: "Aggregate writer",
    description: "Bulk-inserts hourly aggregates.",
    settings: {
      kind: "data-access",
      poolSize: 10,
      readRouting: "primary",
      statementTimeoutMs: 30000,
    },
  },
  // Stats API: reads what the worker wrote.
  {
    id: "stats-data",
    host: "stats-api",
    name: "Stats reader",
    description: "Reads click counts per link and period.",
    settings: {
      kind: "data-access",
      poolSize: 10,
      readRouting: "primary",
      statementTimeoutMs: 5000,
    },
  },
  // Shorten service: the only writer of the URL database.
  {
    id: "shorten-data",
    host: "shorten",
    name: "Link writer",
    description: "Inserts new links on the primary; the short code is generated in this module.",
    settings: {
      kind: "data-access",
      poolSize: 20,
      readRouting: "primary",
      statementTimeoutMs: 2000,
    },
  },
];

const uses = (id: string, from: string, to: string, via: string): StudioComponentConnection => ({
  id,
  from,
  to: { kind: "element", id: to, via },
});
const inside = (
  id: string,
  from: string,
  to: string,
  label: string,
): StudioComponentConnection => ({
  id,
  from,
  to: { kind: "component", id: to },
  label,
});
const componentConnections: StudioComponentConnection[] = [
  uses("cache-reader-redis", "redirect-cache-reader", "url-cache", "redirect-cache"),
  inside("cache-reader-miss", "redirect-cache-reader", "redirect-data", "Loads on miss"),
  uses("redirect-data-reads", "redirect-data", "url-db", "redirect-db"),
  inside("responder-lookup", "redirect-responder", "redirect-cache-reader", "Resolves code"),
  inside("responder-click", "redirect-responder", "redirect-click-publisher", "Records click"),
  uses("click-publisher-queue", "redirect-click-publisher", "click-events", "redirect-clicks"),
  uses(
    "click-consumer-queue",
    "analytics-click-consumer",
    "click-events",
    "click-events-analytics",
  ),
  inside(
    "consumer-aggregation",
    "analytics-click-consumer",
    "analytics-aggregation",
    "Hands batch",
  ),
  inside("aggregation-writer", "analytics-aggregation", "analytics-data", "Writes rollups"),
  uses("analytics-data-writes", "analytics-data", "analytics-store", "analytics-write"),
  uses("stats-data-reads", "stats-data", "analytics-store", "stats-read"),
  uses("shorten-data-writes", "shorten-data", "url-db", "shorten-db"),
];

/** The user opens links and their click counts (download) and shortens links (upload). */
const actions: StudioLaneAction[] = [
  { lane: "download", name: "Open link" },
  { lane: "upload", name: "Shorten" },
];
/**
 * Open link reads click counts through the Stats API and follows short links through the
 * Redirect service; Shorten creates links through the Shorten service. The Stats API's entry
 * comes first so the canvas draws it on the top row: its read of the Analytics store then runs
 * along the top. Layout tuning for the action tiles waits for the lane bands (LA03).
 */
const entries: StudioEntry[] = [
  { id: "download-stats-api", lane: "download", element: "stats-api" },
  { id: "download-redirect", lane: "download", element: "redirect" },
  { id: "upload-shorten", lane: "upload", element: "shorten" },
];

const service = (requestTimeoutMs: number) =>
  ({
    kind: "service",
    execution: "docker",
    language: "typescript",
    exposure: "public",
    minReplicas: 2,
    maxReplicas: 6,
    autoscaleOn: "cpu",
    requestTimeoutMs,
    concurrencyLimit: 200,
  }) as const;

export function tinyurlStudioExample() {
  return createStudioStudy(
    TINYURL_STUDIO_EXAMPLE,
    [
      {
        id: "redirect",
        name: "Redirect service",
        description:
          "Resolves short codes on the hot path, cache first, answers 302 and publishes the click.",
        settings: {
          kind: "redirect",
          execution: "docker",
          language: "go",
          exposure: "public",
          minReplicas: 3,
          maxReplicas: 30,
          autoscaleOn: "requests-per-second",
          requestTimeoutMs: 250,
          concurrencyLimit: 5000,
          lookupStoreConnection: "redirect-db",
          lookupCacheConnection: "redirect-cache",
        },
      },
      {
        id: "url-cache",
        name: "URL cache",
        description: "Redis cache of hot short codes, filled by the Redirect service on a miss.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
          ttlSeconds: 86400,
          topology: "cluster",
          eviction: "lru",
        },
        owner: { kind: "element", id: "redirect" },
      },
      {
        id: "url-db",
        name: "URL database",
        description: "Authoritative short code to destination mapping, read from replicas.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
          readReplicas: 2,
          partitionKey: "short_code",
        },
        owner: { kind: "element", id: "shorten" },
      },
      {
        id: "click-events",
        name: "Click events",
        description: "Buffers click events between redirects and analytics.",
        settings: {
          kind: "queue",
          mode: "topic",
          provider: "self-hosted",
          partitions: 12,
          retentionSeconds: 604800,
        },
        owner: { kind: "element", id: "redirect" },
      },
      {
        id: "analytics",
        name: "Analytics worker",
        description: "Consumes click events and writes hourly aggregates.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "typescript",
          concurrency: 8,
          minReplicas: 1,
          maxReplicas: 6,
          autoscaleOn: "queue-lag",
        },
      },
      {
        id: "analytics-store",
        name: "Analytics store",
        description: "ClickHouse column store for click aggregates.",
        settings: { kind: "database", engine: "clickhouse", provider: "self-hosted" },
        owner: { kind: "element", id: "analytics" },
      },
      {
        id: "stats-api",
        name: "Stats API",
        description: "Serves click counts per link to the people who created the links.",
        settings: service(1000),
      },
      {
        id: "shorten",
        name: "Shorten service",
        description: "Validates destinations, generates short codes and stores new links.",
        settings: service(3000),
      },
    ],
    [
      {
        id: "redirect-cache",
        from: "redirect",
        to: "url-cache",
        kind: "depends-on",
        planned: call("Reads hot links, fills on miss", "Redis"),
        settings: {},
      },
      {
        id: "redirect-db",
        from: "redirect",
        to: "url-db",
        kind: "uses-database",
        planned: call("Reads links on a cache miss", "SQL"),
        settings: {},
      },
      {
        id: "redirect-clicks",
        from: "redirect",
        to: "click-events",
        kind: "depends-on",
        planned: messaging("Publishes clicks"),
        settings: { channelUse: "publish" },
      },
      {
        id: "click-events-analytics",
        from: "click-events",
        to: "analytics",
        kind: "depends-on",
        planned: messaging("Delivers clicks"),
        settings: { channelUse: "consume" },
      },
      {
        id: "analytics-write",
        from: "analytics",
        to: "analytics-store",
        kind: "uses-database",
        planned: call("Writes aggregates", "SQL"),
        settings: {},
      },
      {
        id: "stats-read",
        from: "stats-api",
        to: "analytics-store",
        kind: "uses-database",
        planned: call("Reads click counts", "SQL"),
        settings: {},
      },
      {
        id: "shorten-db",
        from: "shorten",
        to: "url-db",
        kind: "uses-database",
        planned: call("Writes links", "SQL"),
        settings: {},
      },
    ],
    {
      system: {
        name: "TinyURL",
        description:
          "Shortens long URLs, redirects visitors quickly and counts their clicks asynchronously.",
      },
    },
    {
      actions,
      entries,
      components,
      componentConnections,
    },
  );
}
