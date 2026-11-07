/** Isolated readiness test fixture. Not a product preset or saved-project upgrade. */
import { designSchema } from "../design.ts";
import { tinyurlDesignScope } from "../design-scope.ts";
import {
  createLinkSignature,
  positiveCachePolicy,
  resolveLinkSignature,
} from "../operation-records.ts";
import type { OperationInput } from "../operations.ts";
import { studioDefinitions } from "../studio-definitions.ts";
import { createStudioSettings, type StudioKind, studioDefinitionRef } from "../studio-model.ts";

export function narrowReadinessDesign() {
  const definitions: [string, StudioKind][] = [
    ["create-api", "service"],
    ["resolve-api", "service"],
    ["links-db", "database"],
    ["links-cache", "cache"],
  ];
  return designSchema.parse({
    schemaVersion: 3,
    revision: 0,
    scope: tinyurlDesignScope(),
    elements: definitions.map(([id, kind]) => ({
      id,
      name: id,
      classification: studioDefinitions[kind].classification,
    })),
    connections: [
      ["create-store", "create-api", "links-db", "SQL"],
      ["resolve-store", "resolve-api", "links-db", "SQL"],
      ["resolve-cache", "resolve-api", "links-cache", "Redis"],
    ].map(([id, from, to, protocol]) => ({
      id,
      kind: "depends-on",
      from: { element: from },
      to: { element: to },
      planned: {
        label: "Dependency",
        protocol,
        interaction: "Request / response",
        security: "Private network",
      },
    })),
    architecture: {
      system: { name: "Readiness fixture" },
      nodes: [],
      relationships: [],
      studio: {
        version: 1,
        packages: [],
        connections: [],
        elements: definitions.map(([element, kind]) => ({
          element,
          definition: studioDefinitionRef(kind),
          ...(kind === "database"
            ? { owner: { kind: "element", id: "create-api" } }
            : kind === "cache"
              ? { owner: { kind: "element", id: "resolve-api" } }
              : {}),
          settings:
            kind === "database"
              ? { kind, engine: "postgresql", provider: "self-hosted", readReplicas: 0 }
              : kind === "cache"
                ? { kind, engine: "redis-compatible", provider: "self-hosted", ttlSeconds: 300 }
                : { ...createStudioSettings("service"), exposure: "public" },
        })),
        entries: [
          { id: "create-entry", lane: "upload", element: "create-api" },
          { id: "resolve-entry", lane: "download", element: "resolve-api" },
        ],
      },
    },
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
  });
}

export function narrowReadinessSeedOps(): OperationInput[] {
  const design = narrowReadinessDesign();
  if (design.schemaVersion !== 3 || !design.ownership || !design.operations || !design.architecture)
    throw new Error();
  return [
    ...design.elements.map((element) => ({ op: "addElement" as const, element })),
    ...design.connections.map((connection) => ({ op: "connect" as const, connection })),
    { op: "setArchitecture", architecture: design.architecture },
    { op: "upgradeDesign", scope: design.scope },
    { op: "setOwnership", ownership: design.ownership },
    { op: "setOperations", operations: design.operations },
  ];
}
