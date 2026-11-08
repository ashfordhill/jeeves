/** Narrow declaration-only foundation. The extended TinyURL study remains separately versioned. */
import { designSchema } from "../design.ts";
import { tinyurlDesignScope } from "../design-scope.ts";
import {
  createLinkSignature,
  positiveCachePolicy,
  resolveLinkSignature,
} from "../operation-records.ts";
import type { StudioConnectionCreation } from "../studio-operations.ts";
import { createStudioStudy } from "./study.ts";

const description =
  "One Links owner: authenticated Create commits immutable destinations to PostgreSQL; public Follow resolves from a positive cache or the authoritative primary. Optional expiry. Excludes analytics, destination changes, disable management, reputation, quotas and custom slugs.";

export const TINYURL_FOUNDATION_STUDIO_EXAMPLE = {
  id: "studio-tinyurl-foundation",
  version: "1.0.0",
  name: "TinyURL · foundation study",
  description,
  goalManifestSha256: "aee038eef733d00c58513c298d9bc9078f7887e75318531ca9f8a1b3fbafd713",
} as const;

const dependency = (
  id: string,
  from: string,
  to: string,
  label: string,
  protocol: "SQL" | "Redis",
): StudioConnectionCreation => ({
  id,
  from,
  to,
  kind: "depends-on" as const,
  settings: {},
  planned: { label, protocol, interaction: "Request / response", security: "Service identity" },
});

export function tinyurlFoundationStudioExample() {
  const study = createStudioStudy(
    TINYURL_FOUNDATION_STUDIO_EXAMPLE,
    [
      {
        id: "create-api",
        name: "Create link",
        description: "Authenticated create; durable commit and retained-result reconciliation.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          requestTimeoutMs: 10000,
        },
      },
      {
        id: "resolve-api",
        name: "Resolve link",
        description: "Public lookup; primary fallback, expiry checks and no-store redirects.",
        settings: {
          kind: "service",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          requestTimeoutMs: 1200,
        },
      },
      {
        id: "links-db",
        name: "Links database",
        description: "Links owns the authoritative immutable records and retained create results.",
        settings: {
          kind: "database",
          engine: "postgresql",
          provider: "self-hosted",
          readReplicas: 0,
        },
      },
      {
        id: "links-cache",
        name: "Links cache",
        description:
          "Links-owned positive projection; 300s cap clamped to remaining expiry. No negative entries.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
          ttlSeconds: 300,
        },
      },
    ],
    [
      dependency("create-store", "create-api", "links-db", "Create and reconcile", "SQL"),
      dependency(
        "resolve-store",
        "resolve-api",
        "links-db",
        "Read primary on miss or outage",
        "SQL",
      ),
      dependency(
        "resolve-cache",
        "resolve-api",
        "links-cache",
        "Read and fill positive records",
        "Redis",
      ),
    ],
    {
      system: { name: "TinyURL foundation", description },
      nodes: [],
      relationships: [],
    },
    {
      actions: [
        { lane: "download", name: "Follow" },
        { lane: "upload", name: "Create" },
      ],
      entries: [
        { id: "resolve-entry", lane: "download", element: "resolve-api" },
        { id: "create-entry", lane: "upload", element: "create-api" },
      ],
    },
  );
  return {
    ...study,
    design: designSchema.parse({
      ...study.design,
      schemaVersion: 3,
      scope: tinyurlDesignScope(),
      ownership: {
        owners: [{ id: "links", name: "Links" }],
        roles: [
          { element: "create-api", owner: "links", kind: "api", deployable: "links-runtime" },
          { element: "resolve-api", owner: "links", kind: "api", deployable: "links-runtime" },
        ],
        resources: [
          { element: "links-db", authority: "links", kind: "source" },
          { element: "links-cache", authority: "links", kind: "projection", source: "links-db" },
        ],
        grants: [
          { role: "create-api", resource: "links-db", access: "read-write" },
          { role: "resolve-api", resource: "links-db", access: "read" },
          { role: "resolve-api", resource: "links-cache", access: "read-write" },
        ],
        dependencies: [
          { connection: "create-store", access: "read-write" },
          { connection: "resolve-store", access: "read" },
          { connection: "resolve-cache", access: "read-write" },
        ],
      },
      operations: {
        receivers: [
          {
            id: "create-link",
            role: "create-api",
            implementation: createLinkSignature(),
            binding: {
              kind: "create-link",
              storeConnection: "create-store",
              successRetentionHours: 24,
              authVerifier: null,
            },
          },
          {
            id: "resolve-link",
            role: "resolve-api",
            implementation: resolveLinkSignature(),
            binding: {
              kind: "resolve-link",
              storeConnection: "resolve-store",
              cacheConnection: "resolve-cache",
              cachePolicy: positiveCachePolicy.ref,
            },
          },
        ],
        calls: [
          {
            id: "create-call",
            caller: { kind: "entry", entry: "create-entry", lane: "upload", element: "create-api" },
            receiverBinding: "create-link",
            receiverRole: "create-api",
            expects: createLinkSignature(),
          },
          {
            id: "resolve-call",
            caller: {
              kind: "entry",
              entry: "resolve-entry",
              lane: "download",
              element: "resolve-api",
            },
            receiverBinding: "resolve-link",
            receiverRole: "resolve-api",
            expects: resolveLinkSignature(),
          },
        ],
      },
    }),
  };
}
