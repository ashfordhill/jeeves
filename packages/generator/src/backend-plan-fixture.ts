/** Isolated offline compiler fixture. Never added to the production registry/module set. */
import {
  type BackendCapabilityDescriptor,
  backendCapabilityDescriptorSchema,
  backendImplementationRequirements,
  capabilityOptionDemands,
  type DesignDocument,
  designSchema,
  type TemplateLookup,
  templateManifestSchema,
} from "@jeeves/spec";
import { z } from "zod";

export const irRef = (id: string, version = "v1") => ({ id, version });
export function requiredIR<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing compiler fixture value");
  return value;
}
export const irModel = (d: DesignDocument) => requiredIR(d.architecture?.backend);
export function backendPlanFixture(): DesignDocument {
  const payload = [
    { id: "id", type: "uuid" },
    { id: "revision", type: "ref", ref: irRef("revision-type") },
    { id: "parent", type: "uuid" },
    { id: "title", type: "text", maxLength: 400, nullable: true, required: false },
    {
      id: "metadata",
      type: "map",
      keys: { maxLength: 20 },
      maxEntries: 4,
      values: { type: "boolean" },
    },
    {
      id: "price",
      type: "object",
      fields: [
        {
          id: "amount",
          name: "Amount",
          type: "integer",
          required: true,
          minimum: 0,
          maximum: 1000000,
        },
        {
          id: "currency",
          name: "Currency",
          type: "text",
          required: true,
          enumValues: ["USD", "GBP"],
        },
      ],
    },
  ].map((f) => ({ ...f, name: f.id, required: f.required ?? true }));
  return designSchema.parse({
    schemaVersion: 2,
    revision: 7,
    elements: [
      { id: "api", name: "Application", planned: "application-api", template: null },
      { id: "store", name: "Database", planned: "relational-store", template: null },
    ],
    architecture: {
      system: { name: "Pure IR fixture", description: "No runnable implementation" },
      components: [{ id: "domain", element: "api", name: "Domain", capability: "domain-module" }],
      contracts: ["topic", "post"].map((id) => ({
        ...irRef(`${id}-data`),
        name: `${id} data`,
        kind: "data",
        coverage: "Complete",
        shape: {
          payload,
          operations: [],
          types: [
            {
              ...irRef("revision-type"),
              name: "Revision",
              value: { type: "integer", minimum: 0, maximum: 1000000 },
            },
          ],
        },
      })),
      datasets: ["topic", "post"].map((id) => ({
        id: `${id}-dataset`,
        name: `${id} records`,
        contract: irRef(`${id}-data`),
        owners: [{ kind: "component", id: "domain" }],
        ownershipDecision: "One application authority",
        readers: [],
        writers: [],
        store: "store",
        tenant: "Public",
        deletion: "Retain",
        exportAccess: "None",
      })),
      backend: {
        schemaVersion: 1,
        entities: ["topic", "post"].map((id) => ({
          ...irRef(`${id}-entity`),
          name: id,
          dataset: `${id}-dataset`,
          contract: irRef(`${id}-data`),
          storageId: `${id}-table`,
          fields: payload.map((f) => ({
            field: f.id,
            storageId: `${f.id}-column`,
            required: f.required,
            nullable: !!f.nullable,
            storage:
              f.id === "metadata"
                ? { kind: "json", query: "opaque" }
                : f.id === "price"
                  ? {
                      kind: "money",
                      minorUnits: "amount",
                      currency: "currency",
                      currencyStorageId: "currency-column",
                    }
                  : { kind: "scalar" },
            ...(f.id === "id"
              ? { serverOwned: "id" }
              : f.id === "revision"
                ? { serverOwned: "version" }
                : {}),
          })),
          primaryKey: ["id"],
          scope: { kind: "global" },
          relations:
            id === "post"
              ? [
                  {
                    id: "topic-link",
                    target: irRef("topic-entity"),
                    fields: [{ source: "parent", target: "id" }],
                    cardinality: "many-to-one",
                    ownership: "owned",
                    scope: "same-scope",
                    onDelete: "cascade",
                  },
                ]
              : [],
          uniqueKeys: [
            { id: "parent-title", fields: ["parent", "title"], scope: "global", nulls: "distinct" },
          ],
          indexes: [
            {
              id: "revision-index",
              fields: [
                { field: "revision", direction: "desc" },
                { field: "id", direction: "asc" },
              ],
            },
          ],
        })),
        aggregates: [
          {
            ...irRef("topic-aggregate"),
            name: "Topic and posts",
            root: irRef("topic-entity"),
            children: [irRef("post-entity")],
            owner: { kind: "component", id: "domain" },
            store: "store",
            concurrency: {
              kind: "row-lock",
              entities: [irRef("post-entity"), irRef("topic-entity")],
              order: "entity-id-primary-key",
            },
            invariants: [
              {
                id: "first-post",
                strategy: "required-child",
                child: irRef("post-entity"),
                relation: "topic-link",
                minimum: 1,
                maximum: 100,
              },
            ],
          },
        ],
        accessPolicies: ["topic", "post"].map((id) => ({
          ...irRef(`${id}-policy`),
          name: `${id} policy`,
          resource: irRef(`${id}-entity`),
          context: {
            identity: "session-principal",
            authentication: "server-established",
            scope: "global",
            correlation: "server-established",
          },
          default: "deny",
          conflict: "deny-wins",
          clauses: [
            { id: "signed-in", kind: "authenticated" },
            { id: "read-action", kind: "action", actions: ["read", "list"] },
          ],
          rules: [
            {
              id: "read-rule",
              effect: "allow",
              actions: ["read", "list"],
              when: { operator: "all", clauses: ["signed-in", "read-action"] },
            },
          ],
          projections: [
            {
              id: "visible",
              mode: "read",
              fields: payload.map((f) => f.id),
              when: { operator: "all", clauses: ["signed-in"] },
              unknownFields: "reject",
            },
          ],
          revocation: {
            strategy: "current-state",
            cache: "none",
            recheck: ["read", "search", "export"],
          },
        })),
        queries: [
          {
            ...irRef("post-feed"),
            name: "Post feed",
            root: irRef("post-entity"),
            joins: [{ id: "topic", from: "root", relation: "topic-link", kind: "left" }],
            filters: [
              {
                id: "by-revision",
                field: { source: "root", field: "revision" },
                comparisons: ["eq", "gte", "in"],
                maxValues: 10,
              },
            ],
            projection: [
              { id: "post-id", field: { source: "root", field: "id" } },
              { id: "topic-title", field: { source: "topic", field: "title" } },
            ],
            order: [
              { field: { source: "root", field: "revision" }, direction: "desc" },
              { field: { source: "root", field: "id" }, direction: "asc" },
            ],
            limit: { default: 25, maximum: 100 },
            cursor: {
              kind: "keyset",
              fields: [
                { source: "root", field: "revision" },
                { source: "root", field: "id" },
              ],
            },
            accessPolicy: { kind: "policy", reference: irRef("post-policy") },
            accessProjection: "visible",
            sourcePolicies: [
              {
                source: "topic",
                policy: { kind: "policy", reference: irRef("topic-policy") },
                projection: "visible",
              },
            ],
            freshness: { kind: "authoritative" },
          },
        ],
        accessBindings: [
          {
            ...irRef("post-projection"),
            name: "Post projection",
            target: { kind: "projection", entity: irRef("post-entity"), fields: ["id"] },
            resource: irRef("post-entity"),
            policy: { kind: "policy", reference: irRef("post-policy") },
            action: "read",
            site: "read",
            projection: "visible",
          },
        ],
      },
    },
  });
}

/** Freeze the fixture's exact finite option matrix BEFORE any negative mutation. It describes
 * support claims only, with no generate function, module registration or observed evidence.
 */
export function backendPlanLookup(design: DesignDocument): TemplateLookup {
  const requirements = backendImplementationRequirements(design);
  const options = new Map<string, Map<string, Set<string | number | boolean | null>>>();
  for (const r of requirements) {
    let paths = options.get(r.ref.kind);
    if (!paths) {
      paths = new Map();
      options.set(r.ref.kind, paths);
    }
    for (const demand of capabilityOptionDemands(r.value)) {
      let values = paths.get(demand.path);
      if (!values) {
        values = new Set();
        paths.set(demand.path, values);
      }
      values.add(demand.value);
    }
  }
  const descriptor: BackendCapabilityDescriptor = backendCapabilityDescriptorSchema.parse({
    schemaVersion: 1,
    ...irRef("synthetic-ir"),
    name: "Isolated compiler support claim",
    targets: ["container", "component", "operation", "connection", "component-relationship"],
    provides: [...options].map(([kind, paths]) => ({
      kind,
      shapes: [
        "uuid",
        "integer",
        "boolean",
        "text",
        "ref",
        "object",
        "map",
        "array",
        "tagged-union",
      ],
      options: [...paths].map(([path, values]) => ({
        path,
        support: { kind: "values", values: [...values] },
      })),
    })),
    requires: {
      hostRoles: [],
      hostTemplates: [],
      storeTemplates: [irRef("ir-store", "1.0.0")],
      transports: ["SQL"],
      context: [
        "public",
        "session-principal",
        "verified-service",
        "authorized-scope",
        "correlation",
      ],
      revocation: [
        "read",
        "write",
        "search",
        "export",
        "job",
        "bytes",
        "materialization",
        "delivery",
        "idempotent-replay",
      ],
    },
    dependencies: [],
    conflicts: [],
    hooks: [],
    evidencePackIds: ["unobserved-ir-fixture"],
    origin: { kind: "library", package: "isolated-compiler-fixture", version: "1.0.0" },
  });
  const manifests = ["service", "store", "module"].map((kind) =>
    templateManifestSchema.parse({
      id: `ir-${kind}`,
      version: "1.0.0",
      kind: kind === "module" ? "attachment" : "element",
      ...(kind === "module" ? {} : { elementKind: kind === "store" ? "database" : "service" }),
      displayName: `Test ${kind}`,
      description: "Offline IR fixtures only",
      config: z.object({}),
      card: { icon: "box" },
      capabilities: [descriptor],
    }),
  );
  const model = irModel(design);
  model.implementations = requirements
    .filter((r) =>
      ["container", "component", "connection", "component-relationship"].includes(r.ref.kind),
    )
    .map((r) => ({
      ...irRef(`${r.ref.id}-selection`),
      name: `${r.ref.id} selection`,
      target: r.ref as NonNullable<typeof model.implementations>[number]["target"],
      template: irRef(
        r.ref.kind === "container"
          ? r.ref.id === "store"
            ? "ir-store"
            : "ir-service"
          : "ir-module",
        "1.0.0",
      ),
      capability: irRef("synthetic-ir"),
      store: "store",
      hooks: [],
      obligations:
        r.ref.kind === "component"
          ? requirements
              .filter(
                (q) =>
                  !["container", "component", "connection", "component-relationship"].includes(
                    q.ref.kind,
                  ),
              )
              .map((q) => q.ref)
          : [],
    }));
  return {
    get: (ref) => manifests.find((m) => m.id === ref.id && m.version === ref.version),
    versions: (id) => manifests.filter((m) => m.id === id).map((m) => m.version),
  };
}
