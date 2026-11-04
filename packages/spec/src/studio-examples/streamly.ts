/** Fresh finite studio interpretation; historical factory and source contracts remain unchanged. */
import initialLayout from "./streamly.layout.json" with { type: "json" };
import { createStudioStudy } from "./study.ts";

export const STREAMLY_STUDIO_EXAMPLE = {
  id: "studio-video-platform",
  version: "1.0.0",
  name: "Streamly · studio study",
  description:
    "Separate playback, platform API and media/event workers with private storage, C3 queues, search, cache and optional CDN identity.",
  goalManifestSha256: "820f2050f97a14e6b14ad728f1da1beb858b337aeae1ac597650f0e729c782fd",
} as const;

export function streamlyStudioExample() {
  return createStudioStudy(
    STREAMLY_STUDIO_EXAMPLE,
    [
      {
        id: "web",
        name: "Viewer & creator web",
        description: "Discovery, watch pages, channel management and resumable creator uploads.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "console",
        name: "Trust & safety console",
        description:
          "Staff review reports, suspend content and inspect an audited moderation history.",
        settings: {
          kind: "browser",
          delivery: "standalone",
          provider: "unspecified",
        },
      },
      {
        id: "api",
        name: "Platform API",
        description:
          "A modular application owns channels, video metadata, upload sessions and moderation decisions.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "unspecified",
          exposure: "public",
        },
      },
      {
        id: "playback",
        name: "Playback API",
        description:
          "Independently scaled read path checks video visibility and issues short-lived media access grants.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "go",
          exposure: "public",
        },
      },
      {
        id: "processor",
        name: "Media processor",
        description:
          "Scans originals, creates encoded renditions and records completion before publication.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "unspecified",
        },
      },
      {
        id: "activity",
        name: "Activity worker",
        description:
          "Consumes catalog events to update discovery indexes and deliver creator notifications.",
        settings: {
          kind: "worker",
          execution: "docker",
          language: "unspecified",
        },
      },
      {
        id: "db",
        name: "Catalog database",
        description:
          "Authoritative channels, access policy, video states, upload sessions and transactional outbox.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "cache",
        name: "Playback metadata cache",
        description:
          "Derived visibility and rendition descriptors with bounded age; the catalog remains authoritative.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
          ttlSeconds: 15,
        },
        owner: {
          kind: "element",
          id: "playback",
        },
      },
      {
        id: "originals",
        name: "Original uploads",
        description:
          "Private quarantine for uploaded source files, addressed by upload identity and checksum.",
        settings: {
          kind: "object-store",
          provider: "unspecified",
          access: "private",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "media",
        name: "Published renditions",
        description:
          "Versioned immutable media segments, manifests and thumbnails, restricted to the delivery provider.",
        settings: {
          kind: "object-store",
          provider: "unspecified",
          access: "private",
        },
        owner: {
          kind: "element",
          id: "processor",
        },
      },
      {
        id: "jobs",
        name: "Media processing jobs",
        description:
          "Named work queue for durable, duplicate-safe media processing. Broker placement is a later deployment choice.",
        settings: {
          kind: "queue",
          mode: "work-queue",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "events",
        name: "Catalog change events",
        description:
          "Named channel for publication, visibility changes and removal; retained for consumer replay.",
        settings: {
          kind: "queue",
          mode: "topic",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "api",
        },
      },
      {
        id: "search",
        name: "Discovery index",
        description:
          "Rebuildable public-video and channel search documents. Never the authority for playback permission.",
        settings: {
          kind: "search",
          engine: "opensearch",
          provider: "self-hosted",
        },
        owner: {
          kind: "element",
          id: "activity",
        },
      },
      {
        id: "cdn",
        name: "Media delivery provider",
        description:
          "An external CDN serves immutable segments and enforces short-lived access grants.",
        settings: {
          kind: "cdn",
          provider: "unspecified",
          origin: "media",
        },
      },
      {
        id: "identity",
        name: "Identity provider",
        description: "External login and token issuance for viewers, creators and staff.",
        settings: {
          kind: "external-api",
          category: "identity",
          provider: "external",
        },
      },
      {
        id: "email",
        name: "Email provider",
        description: "Delivers creator processing outcomes and moderation notices.",
        settings: {
          kind: "external-api",
          category: "email",
          provider: "external",
        },
      },
    ],
    [
      {
        id: "web-platform",
        from: "web",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Browses and manages videos",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "web-playback",
        from: "web",
        to: "playback",
        kind: "depends-on",
        planned: {
          label: "Requests playback grant",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "web-delivery",
        from: "web",
        to: "cdn",
        kind: "depends-on",
        planned: {
          label: "Streams granted media",
          protocol: "HTTPS",
          interaction: "Streaming",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "web-upload",
        from: "web",
        to: "originals",
        kind: "depends-on",
        planned: {
          label: "Uploads with scoped grant",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "web-login",
        from: "web",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Authenticates viewer or creator",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "staff-login",
        from: "console",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Authenticates staff",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "staff-moderation",
        from: "console",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Reviews reports and restricts content",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "User identity",
        },
        settings: {},
      },
      {
        id: "api-identity",
        from: "api",
        to: "identity",
        kind: "depends-on",
        planned: {
          label: "Retrieves signing keys",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-db",
        from: "api",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Commits catalog and outbox",
          protocol: "SQL",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-originals",
        from: "api",
        to: "originals",
        kind: "depends-on",
        planned: {
          label: "Verifies uploaded source",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-search",
        from: "api",
        to: "search",
        kind: "depends-on",
        planned: {
          label: "Queries public discovery",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "api-jobs",
        from: "api",
        to: "jobs",
        kind: "depends-on",
        planned: {
          label: "Publishes processing requests",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "api-events",
        from: "api",
        to: "events",
        kind: "depends-on",
        planned: {
          label: "Publishes catalog changes",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "publish",
        },
      },
      {
        id: "playback-cache-read",
        from: "playback",
        to: "cache",
        kind: "depends-on",
        planned: {
          label: "Reads bounded-age descriptors",
          protocol: "Redis",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "playback-source",
        from: "playback",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Loads authoritative visibility",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "process-jobs",
        from: "jobs",
        to: "processor",
        kind: "depends-on",
        planned: {
          label: "Consumes media work",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "consume",
        },
      },
      {
        id: "process-original",
        from: "processor",
        to: "originals",
        kind: "depends-on",
        planned: {
          label: "Reads quarantined source",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "process-media",
        from: "processor",
        to: "media",
        kind: "depends-on",
        planned: {
          label: "Writes versioned renditions",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "process-complete",
        from: "processor",
        to: "api",
        kind: "depends-on",
        planned: {
          label: "Records processing result",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "cdn-origin",
        from: "cdn",
        to: "media",
        kind: "depends-on",
        planned: {
          label: "Fetches private media origin",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "activity-events",
        from: "events",
        to: "activity",
        kind: "depends-on",
        planned: {
          label: "Consumes catalog changes",
          protocol: "Messaging",
          interaction: "Asynchronous",
          security: "Service identity",
        },
        settings: {
          channelUse: "consume",
        },
      },
      {
        id: "activity-search",
        from: "activity",
        to: "search",
        kind: "depends-on",
        planned: {
          label: "Updates public search documents",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "activity-source",
        from: "activity",
        to: "db",
        kind: "depends-on",
        planned: {
          label: "Rebuilds from catalog",
          protocol: "Unspecified",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "activity-cache",
        from: "activity",
        to: "cache",
        kind: "depends-on",
        planned: {
          label: "Invalidates visibility entries",
          protocol: "Redis",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "activity-purge",
        from: "activity",
        to: "cdn",
        kind: "depends-on",
        planned: {
          label: "Purges removed media",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
      {
        id: "activity-email",
        from: "activity",
        to: "email",
        kind: "depends-on",
        planned: {
          label: "Sends creator notices",
          protocol: "HTTPS",
          interaction: "Request / response",
          security: "Service identity",
        },
        settings: {},
      },
    ],
    {
      system: {
        name: "Streamly · studio study",
        description:
          "Separate playback, platform API and media/event workers with private storage, C3 queues, search, cache and optional CDN identity.",
      },
      nodes: [
        {
          id: "viewer",
          kind: "person",
          name: "Viewer",
          description: "Discovers and watches public video; signs in for subscriptions.",
        },
        {
          id: "creator",
          kind: "person",
          name: "Creator",
          description: "Uploads, publishes and manages videos belonging to their channel.",
        },
        {
          id: "reviewer",
          kind: "person",
          name: "Trust & safety staff",
          description: "Reviews reports and records accountable moderation decisions.",
        },
        {
          id: "external-cdn",
          kind: "external-system",
          name: "Media delivery provider",
          description:
            "An external CDN serves immutable segments and enforces short-lived access grants.",
          container: "cdn",
        },
        {
          id: "external-identity",
          kind: "external-system",
          name: "Identity provider",
          description: "External login and token issuance for viewers, creators and staff.",
          container: "identity",
        },
        {
          id: "external-email",
          kind: "external-system",
          name: "Email provider",
          description: "Delivers creator processing outcomes and moderation notices.",
          container: "email",
        },
      ],
      relationships: [
        {
          id: "viewer-system",
          from: "viewer",
          to: "system",
          description: "Discovers and watches video",
          container: "web",
        },
        {
          id: "creator-system",
          from: "creator",
          to: "system",
          description: "Uploads and publishes channel video",
          container: "web",
        },
        {
          id: "reviewer-system",
          from: "reviewer",
          to: "system",
          description: "Reviews reports and restricts content",
          container: "console",
        },
        {
          id: "system-delivery",
          from: "system",
          to: "external-cdn",
          description: "Delivers authorized media to viewers",
          container: "web",
        },
        {
          id: "system-identity",
          from: "system",
          to: "external-identity",
          description: "Authenticates viewers, creators and staff",
          container: "api",
        },
        {
          id: "system-email",
          from: "system",
          to: "external-email",
          description: "Sends creator status updates",
          container: "activity",
        },
      ],
    },
    initialLayout,
  );
}
