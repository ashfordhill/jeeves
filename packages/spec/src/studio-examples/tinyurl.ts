/**
 * The TinyURL study, the single studio study and fresh-install default. A
 * read-heavy, low-latency URL shortener: about 100 reads per write, cache-aside with an
 * in-process L1 plus Redis and single-flight, range-allocated base62 IDs, 302 redirects with a
 * short edge max-age, and batched asynchronous click tracking. Design intent only.
 */
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import type { StudioConnectionCreation } from "../studio-operations.ts";
import { createStudioStudy } from "./study.ts";

export const TINYURL_STUDIO_EXAMPLE = {
  id: "studio-tinyurl",
  version: "1.0.0",
  name: "TinyURL · studio study",
  description:
    "A read-heavy URL shortener: cache-aside redirects behind a CDN, range-allocated short codes and asynchronous click analytics.",
  goalManifestSha256: "4a808cc6cd4557815b283543a896ee22dbaa56370c909da81144f0fe5b2a6d33",
} as const;

const https = (
  label: string,
  security: StudioConnectionCreation["planned"]["security"] = "Service identity",
): StudioConnectionCreation["planned"] => ({
  label,
  protocol: "HTTPS",
  interaction: "Request / response",
  security,
});
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
  // Shorten API: writes are rare, so correctness and abuse protection come first.
  {
    id: "shorten-rate-limiter",
    host: "shorten-api",
    name: "Rate limiter",
    description: "Limits link creation per API key with shared Redis counters.",
    settings: {
      kind: "rate-limiter",
      algorithm: "token-bucket",
      limit: 100,
      windowSeconds: 60,
      key: "api-key",
      store: "redis",
    },
  },
  {
    id: "shorten-reputation-check",
    host: "shorten-api",
    name: "Reputation check",
    description: "Rejects malicious destinations; fails fast when the provider is down.",
    settings: { kind: "external-call", circuitBreaker: "enabled" },
  },
  {
    id: "shorten-id-generator",
    host: "shorten-api",
    name: "ID generator",
    description: "Leases blocks of 1,000 IDs from the database and encodes them as base62.",
    settings: {
      kind: "id-generator",
      strategy: "range-allocation",
      blockSize: 1000,
      encoding: "base62",
      minLength: 7,
    },
  },
  {
    id: "shorten-data",
    host: "shorten-api",
    name: "Link writer",
    description: "Inserts links on the primary.",
    settings: {
      kind: "data-access",
      poolSize: 20,
      readRouting: "primary",
      statementTimeoutMs: 2000,
    },
  },
  // Redirect service: the hot read path.
  {
    id: "redirect-cache-reader",
    host: "redirect",
    name: "Link cache reader",
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
    description: "Answers 302 so every click still reaches analytics after the edge expires.",
    settings: { kind: "redirect-responder", status: "302", edgeMaxAgeSeconds: 60 },
  },
  {
    id: "redirect-click-publisher",
    host: "redirect",
    name: "Click publisher",
    description: "Publishes click events in batches off the request path.",
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
];

const uses = (
  id: string,
  from: string,
  to: string,
  via: string,
  label?: string,
): StudioComponentConnection => ({
  id,
  from,
  to: { kind: "element", id: to, via },
  ...(label && { label }),
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
  uses("rate-limiter-counters", "shorten-rate-limiter", "link-cache", "shorten-cache"),
  uses("reputation-check-call", "shorten-reputation-check", "reputation", "shorten-reputation"),
  uses("id-generator-ranges", "shorten-id-generator", "links-db", "shorten-db"),
  uses("shorten-data-writes", "shorten-data", "links-db", "shorten-db"),
  inside("shorten-id-to-writer", "shorten-id-generator", "shorten-data", "Supplies code"),
  uses("cache-reader-redis", "redirect-cache-reader", "link-cache", "redirect-cache"),
  inside("cache-reader-miss", "redirect-cache-reader", "redirect-data", "Loads on miss"),
  uses("redirect-data-reads", "redirect-data", "links-db", "redirect-db"),
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
];

export function tinyurlStudioExample() {
  return createStudioStudy(
    TINYURL_STUDIO_EXAMPLE,
    [
      {
        id: "web",
        name: "Web app",
        description: "Browser client where link creators shorten, list and manage their links.",
        settings: { kind: "browser", delivery: "standalone", provider: "unspecified" },
      },
      {
        id: "shorten-api",
        name: "Shorten API",
        description: "Validates destinations, allocates short codes and stores new links.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          minReplicas: 2,
          maxReplicas: 6,
          autoscaleOn: "cpu",
          requestTimeoutMs: 3000,
          concurrencyLimit: 200,
        },
      },
      {
        id: "redirect",
        name: "Redirect service",
        description:
          "Resolves short codes on the hot path, cache first, and answers with a redirect.",
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
        id: "analytics",
        name: "Analytics worker",
        description: "Consumes click events and writes hourly aggregates.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "go",
          concurrency: 8,
          minReplicas: 1,
          maxReplicas: 6,
          autoscaleOn: "queue-lag",
        },
      },
      {
        id: "cdn",
        name: "CDN",
        description: "Terminates visitor traffic and caches redirects for a short edge max-age.",
        settings: {
          kind: "cdn",
          provider: "unspecified",
          origin: "redirect",
          cacheRedirects: "enabled",
        },
      },
      {
        id: "links-db",
        name: "Links database",
        description: "Authoritative short code to destination mapping, read from replicas.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
          readReplicas: 2,
          partitionKey: "short_code",
        },
        owner: { kind: "element", id: "shorten-api" },
      },
      {
        id: "link-cache",
        name: "Link cache",
        description: "Redis cache of hot short codes and the shared rate-limit counters.",
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
        id: "analytics-store",
        name: "Analytics store",
        description: "ClickHouse column store for click aggregates.",
        settings: { kind: "database", engine: "clickhouse", provider: "self-hosted" },
        owner: { kind: "element", id: "analytics" },
      },
      {
        id: "reputation",
        name: "URL reputation API",
        description: "External check that a destination is not phishing or malware.",
        settings: { kind: "external-api", category: "generic", provider: "external" },
      },
    ],
    [
      {
        id: "web-shorten",
        from: "web",
        to: "shorten-api",
        kind: "calls",
        planned: https("Creates and lists links", "User identity"),
        settings: { timeoutMs: 3000, retry: { mode: "none" } },
      },
      {
        id: "cdn-redirect",
        from: "cdn",
        to: "redirect",
        kind: "calls",
        planned: https("Forwards cache misses"),
        settings: { timeoutMs: 500, retry: { mode: "fixed", attempts: 1, delayMs: 50 } },
      },
      {
        id: "shorten-db",
        from: "shorten-api",
        to: "links-db",
        kind: "uses-database",
        planned: call("Writes links", "SQL"),
        settings: {},
      },
      {
        id: "shorten-cache",
        from: "shorten-api",
        to: "link-cache",
        kind: "depends-on",
        planned: call("Counts requests", "Redis"),
        settings: {},
      },
      {
        id: "shorten-reputation",
        from: "shorten-api",
        to: "reputation",
        kind: "calls",
        planned: https("Checks destinations"),
        settings: { timeoutMs: 800, retry: { mode: "fixed", attempts: 1, delayMs: 100 } },
      },
      {
        id: "redirect-cache",
        from: "redirect",
        to: "link-cache",
        kind: "depends-on",
        planned: call("Reads hot links", "Redis"),
        settings: {},
      },
      {
        id: "redirect-db",
        from: "redirect",
        to: "links-db",
        kind: "uses-database",
        planned: call("Reads links on miss", "SQL"),
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
    ],
    {
      system: {
        name: "TinyURL",
        description:
          "Shortens long URLs and redirects visitors quickly, with asynchronous click analytics.",
      },
      nodes: [
        {
          id: "link-creator",
          kind: "person",
          name: "Link creator",
          description: "Shortens URLs and manages their links.",
        },
        {
          id: "visitor",
          kind: "person",
          name: "Visitor",
          description: "Follows a short link.",
        },
        {
          id: "url-reputation",
          kind: "external-system",
          name: "URL reputation API",
          description: "Classifies destinations as safe or malicious.",
          container: "reputation",
        },
      ],
      relationships: [
        {
          id: "link-creator-system",
          from: "link-creator",
          to: "system",
          description: "Shortens and manages links",
          container: "web",
        },
        {
          id: "visitor-system",
          from: "visitor",
          to: "system",
          description: "Follows a short link",
          container: "cdn",
        },
        {
          id: "system-reputation",
          from: "system",
          to: "url-reputation",
          description: "Checks destination reputation",
          container: "shorten-api",
        },
      ],
    },
    {
      packages: [
        {
          id: "link-platform",
          name: "Link platform",
          description: "The public link services: creation and the hot redirect path.",
          members: ["shorten-api", "redirect"],
        },
      ],
      components,
      componentConnections,
    },
  );
}
