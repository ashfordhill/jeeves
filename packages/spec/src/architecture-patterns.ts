/** Versioned editable fragments using the existing contract/relationship model. No runtime adoption. */
import { z } from "zod";
import { applyOperations } from "./apply.ts";
import {
  type Architecture,
  type ArchitectureComponent,
  architectureSchema,
} from "./architecture.ts";
import { architectureReview, type RelationshipPolicies } from "./architecture-bindings.ts";
import { containerClassification } from "./architecture-choices.ts";
import {
  type ArchitectureContract,
  contractCanonical,
  contractShapeSemantics,
  inspectContractShape,
  inspectContractTransport,
} from "./architecture-contracts.ts";
import { type PatternInstance, patternConfigSchema } from "./architecture-pattern-provenance.ts";
import { backendCollections, backendDeclarations, mapBackendModel } from "./backend-model.ts";
import {
  type Connection,
  connectionSchema,
  type DesignDocument,
  type Element,
  elementSchema,
} from "./design.ts";
import { idSchema, versionSchema } from "./ids.ts";
import type { TemplateLookup } from "./manifest.ts";
import type { OperationInput } from "./operations.ts";
import { componentHostRole, plannedCapability } from "./planned-capabilities.ts";

const roleSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1).max(120),
  purpose: z.string().min(1).max(500),
  kind: z.enum(["host", "boundary", "component", "context"]),
  /** Required dependencies are bound explicitly and never copied. */
  required: z.boolean().optional(),
  contextKind: z.enum(["person", "external-system"]).optional(),
  ownership: z.enum(["System responsibility", "External responsibility", "Unspecified"]).optional(),
  host: idSchema.optional(),
  classification: z.enum(["Application", "Data store", "External system"]).optional(),
  hostRoles: z.array(z.enum(["frontend", "service", "worker", "database", "external"])),
  storeKind: z.literal("relational-records").optional(),
  create: elementSchema.optional(),
});
export const architectureFragmentSchema = z.strictObject({
  formatVersion: z.literal(1),
  id: idSchema,
  version: versionSchema,
  name: z.string(),
  description: z.string(),
  roles: z.array(roleSchema).max(32),
  /** P47/P48 declarations use local IDs until expansion. */
  architecture: architectureSchema,
  connections: z.array(connectionSchema).max(40),
  invariants: z.array(z.string().min(1).max(1200)).max(20),
  extensionPoints: z
    .array(z.strictObject({ role: idSchema, description: z.string().max(500) }))
    .max(20),
});
export type ArchitectureFragment = z.output<typeof architectureFragmentSchema>;
export const patternChoiceSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("reuse"), id: idSchema }),
  z.strictObject({ mode: z.literal("create") }),
  z.strictObject({ mode: z.literal("unfilled") }),
]);
export const patternRequestSchema = z.strictObject({
  pattern: idSchema,
  version: versionSchema,
  variant: z.enum(["standard", "best-effort", "transactional-outbox"]).default("standard"),
  instanceId: idSchema.max(22),
  baseRevision: z.int().nonnegative(),
  config: patternConfigSchema,
  roles: z.record(idSchema, patternChoiceSchema).default({}),
  /** Optional explicit reuse of an existing C2 relationship. */
  relationships: z.record(idSchema, idSchema).default({}),
  definitions: z.record(idSchema, idSchema).optional(),
});
export type PatternRequest = z.output<typeof patternRequestSchema>;
export type PatternRequestInput = z.input<typeof patternRequestSchema>;
export const architecturePatterns = [
  {
    id: "tenant-workspace-access",
    name: "Tenant workspace and access",
    description: "Workspace membership, access checks and scoped authoritative records.",
    variants: ["standard"],
  },
  {
    id: "billing-entitlements",
    name: "Billing and entitlements",
    description:
      "Signed callbacks, deduplication, entitlement decisions and deliberate downgrade policy.",
    variants: ["standard"],
  },
  {
    id: "cached-public-lookup",
    name: "Cached public lookup",
    description: "Public lookup with source fallback and bounded update/disable propagation.",
    variants: ["standard"],
  },
  {
    id: "asynchronous-work-delivery",
    name: "Asynchronous work delivery",
    description:
      "Separate best-effort and transactional-outbox intent, with named logical channels.",
    variants: ["best-effort", "transactional-outbox"],
  },
] as const;

export function describeArchitecturePattern(
  pattern: string,
  variant: string,
  config: z.input<typeof patternConfigSchema>,
): ArchitectureFragment {
  const entry = architecturePatterns.find((item) => item.id === pattern);
  if (!entry || !(entry.variants as readonly string[]).includes(variant))
    throw new Error("Choose a listed pattern and an explicit supported variant.");
  const cfg = patternConfigSchema.parse(config);
  const a: Architecture = {
    system: { name: "Fragment", description: "" },
    nodes: [],
    relationships: [],
    components: [],
    contracts: [],
    interfaces: [],
    bindings: [],
    datasets: [],
    componentRelationships: [],
  };
  const fragment: ArchitectureFragment = {
    formatVersion: 1,
    id: entry.id,
    version: "1.0.0",
    name: entry.name,
    description: entry.description,
    roles: [],
    architecture: a,
    connections: [],
    invariants: [],
    extensionPoints: [],
  };
  const host = (
    id: string,
    name: string,
    classification: "Application" | "Data store",
    hostRoles: ArchitectureFragment["roles"][number]["hostRoles"],
  ) =>
    fragment.roles.push({
      id,
      name,
      purpose:
        classification === "Data store"
          ? "Relational hosting for these SQL relationships only; dataset authority, exact contracts and access are declared separately."
          : "Host these planned responsibilities; existing configuration and runtime remain intact.",
      kind: "host",
      ...(classification === "Data store" ? { storeKind: "relational-records" as const } : {}),
      classification,
      hostRoles,
    });
  const boundary = (
    id: string,
    name: string,
    planned: string,
    classification: "Data store" | "External system",
  ) =>
    fragment.roles.push({
      id,
      name,
      purpose:
        "Reuse requires explicit matching pattern role, ownership, exact contract and policies; family/name alone is insufficient.",
      kind: "boundary",
      classification,
      hostRoles: [],
      create: elementSchema.parse({ id, name, planned, template: null }),
    });
  const component = (
    id: string,
    name: string,
    element: string,
    capability = "domain-module",
    responsibility = name,
  ) => {
    fragment.roles.push({
      id,
      name,
      kind: "component",
      host: element,
      purpose: responsibility,
      hostRoles: [],
    });
    a.components!.push({
      id,
      element,
      name,
      responsibility,
      capability,
      config: {},
      members: [],
      usesResources: [],
      usesConnections: [],
    });
    fragment.extensionPoints.push({
      role: id,
      description:
        "Extend the responsibility through explicit contracts while preserving the declared invariants.",
    });
  };
  const field = (
    name: string,
    type:
      | "uuid"
      | "text"
      | "boolean"
      | "timestamp"
      | "integer"
      | "http-url"
      | "unresolved" = "uuid",
  ) => ({
    id: name.toLowerCase(),
    name,
    type,
    required: true,
    description: "",
  });
  const contract = (
    id: string,
    name: string,
    kind: ArchitectureContract["kind"],
    operation?: string,
  ) => {
    const payload = [
      field("tenantId"),
      field("recordId"),
      ...(kind === "event" ? [field("eventId"), field("occurredAt", "timestamp")] : []),
    ];
    const input =
      operation === "resolve-public"
        ? [field("recordId")]
        : operation === "check-access"
          ? [field("tenantId"), field("principalId"), field("permission", "text")]
          : operation === "commit-domain-event"
            ? [
                field("tenantId"),
                field("recordId"),
                field("eventId"),
                field("domainChange", "unresolved"),
                field("eventPayload", "unresolved"),
              ]
            : operation === "accept-callback"
              ? [
                  field("tenantId"),
                  field("eventId"),
                  field("signature", "text"),
                  field("payload", "unresolved"),
                ]
              : operation === "apply-billing"
                ? [field("tenantId"), field("eventId"), field("change", "unresolved")]
                : [field("tenantId"), field("recordId"), field("entitlement", "unresolved")];
    if (id === "workspace-records") payload.push(field("principalId"), field("role", "text"));
    if (id === "billing-records")
      payload.push(field("eventId"), field("entitlement", "unresolved"));
    if (kind === "event") payload.push(field("payload", "unresolved"));
    if (id === "lookup-records" || id === "cache-records")
      payload.push(
        field("enabled", "boolean"),
        field("destination", "http-url"),
        field("revision", "integer"),
      );
    if (id === "outbox-records")
      payload.push(field("eventId"), field("payload", "unresolved"), field("delivered", "boolean"));
    a.contracts!.push({
      id,
      name,
      version: "v1",
      kind,
      description: "Planned contract; no runtime implementation or inferred compatibility.",
      shape: {
        payload: operation ? [] : payload,
        operations: operation
          ? [
              {
                id: operation,
                name,
                description: "",
                input,
                output:
                  operation === "resolve-public"
                    ? [field("enabled", "boolean"), field("destination", "http-url")]
                    : [
                        field(
                          operation === "check-access"
                            ? "allowed"
                            : operation === "commit-domain-event"
                              ? "committed"
                              : "accepted",
                          "boolean",
                        ),
                      ],
              },
            ]
          : [],
      },
    });
  };
  const owner = (id: string) => ({
    kind: a.components!.some((item) => item.id === id)
      ? ("component" as const)
      : ("element" as const),
    id,
  });
  const hostOf = (id: string) => a.components!.find((item) => item.id === id)?.element ?? id;
  const connect = (
    id: string,
    from: string,
    to: string,
    label: string,
    protocol: string,
    async = false,
  ) => {
    const source = hostOf(from),
      target = hostOf(to);
    if (source === target) {
      a.componentRelationships!.push({
        id,
        from,
        to,
        description: label,
        protocol: "In process",
        interaction: "Request / response",
      });
      return { kind: "component-relationship" as const, id };
    }
    fragment.connections.push({
      id,
      kind: "depends-on",
      from: { element: source },
      to: { element: target },
      planned: {
        label,
        protocol,
        interaction: async ? "Asynchronous" : "Request / response",
        security: from === "provider" ? "Public" : "Private network",
      },
    });
    for (const endpoint of [from, to]) {
      const c = a.components!.find((item) => item.id === endpoint);
      if (c && !c.usesConnections.includes(id)) c.usesConnections.push(id);
    }
    return { kind: "connection" as const, id };
  };
  const access: RelationshipPolicies = {
    access: { identity: "Service", tenant: cfg.tenant, network: "Private" },
  };
  const bind = (
    id: string,
    from: string,
    to: string,
    ref: string,
    role: "request" | "read" | "write" | "callback" | "publish" | "consume",
    label: string,
    protocol: string,
    policies: RelationshipPolicies = access,
    async = false,
  ) => {
    const relationship = connect(id, from, to, label, protocol, async);
    const provided = role === "publish" ? from : to,
      required = role === "publish" ? to : from;
    const exact = { id: ref, version: "v1" };
    a.interfaces!.push(
      ...(["provided", "required"] as const).map((direction) => ({
        id: `${id}-${direction}`,
        name: label,
        owner: owner(direction === "provided" ? provided : required),
        direction,
        necessity: "required" as const,
        contract: exact,
      })),
    );
    a.bindings!.push({
      id: `${id}-binding`,
      name: label,
      relationship,
      provided: `${id}-provided`,
      required: `${id}-required`,
      contract: exact,
      role,
      transport: relationship.kind === "component-relationship" ? "In process" : protocol,
      businessSynchrony: async ? "Asynchronous" : "Synchronous",
      policies,
    });
  };
  const dataset = (
    id: string,
    name: string,
    ref: string,
    responsibility: string,
    store: string,
    readers: string[] = [responsibility],
    writers: string[] = [responsibility],
  ) =>
    a.datasets!.push({
      id,
      name,
      contract: { id: ref, version: "v1" },
      owners: [owner(responsibility)],
      ownershipDecision: "",
      store,
      readers: readers.map(owner),
      writers: writers.map(owner),
      tenant: cfg.tenant,
      deletion: "Unknown",
      exportAccess: "Unknown",
    });
  host("api", "Application API", "Application", ["service", "worker"]);
  host("store", "Authoritative store", "Data store", ["database"]);
  if (pattern === "tenant-workspace-access") {
    component("workspace", "Workspace membership", "api", "organizations-module");
    component("access", "Tenant access checks", "api");
    contract("access-contract", "Check workspace access", "in-process", "check-access");
    contract("workspace-records", "Workspace membership records", "data");
    bind(
      "check-access",
      "workspace",
      "access",
      "access-contract",
      "request",
      "Checks tenant and principal access",
      "In process",
    );
    bind(
      "save-membership",
      "workspace",
      "store",
      "workspace-records",
      "write",
      "Persists workspace membership",
      "SQL",
    );
    dataset("workspaces", "Workspace authority", "workspace-records", "workspace", "store");
    fragment.invariants.push(
      "Every membership operation checks principal and tenant, including API keys, jobs and exports. Storage isolation does not establish authorization.",
    );
  } else if (pattern === "billing-entitlements") {
    boundary("provider", "Payment provider", "billing-provider", "External system");
    component("billing", "Billing policy", "api", "billing-module");
    component("adapter", "Payment callback adapter", "api", "integration-adapter");
    component("entitlements", "Entitlement decisions", "api", "entitlements-module");
    contract("callback-contract", "Accept billing callback", "api", "accept-callback");
    contract(
      "entitlement-contract",
      "Update entitlement decisions",
      "in-process",
      "update-entitlements",
    );
    contract("billing-records", "Billing and deduplication state", "data");
    bind(
      "receive-callback",
      "provider",
      "adapter",
      "callback-contract",
      "callback",
      "Delivers signed billing callback",
      "HTTPS",
      {
        access: { identity: "Signed callback", tenant: cfg.tenant, network: "Public" },
        retry: { maxAttempts: 5, idempotency: "Required", key: "provider eventId and tenantId" },
        delivery: {
          guarantee: "At least once",
          ordering: "Unordered",
          acknowledgement: "Persisted",
        },
      },
      true,
    );
    contract("billing-policy", "Apply verified billing change", "in-process", "apply-billing");
    bind(
      "apply-billing",
      "adapter",
      "billing",
      "billing-policy",
      "request",
      "Applies verified idempotent billing change",
      "In process",
    );
    bind(
      "update-entitlements",
      "billing",
      "entitlements",
      "entitlement-contract",
      "request",
      "Updates entitlement decisions",
      "In process",
    );
    bind(
      "persist-billing",
      "billing",
      "store",
      "billing-records",
      "write",
      "Persists billing and deduplication state",
      "SQL",
    );
    dataset("billing-state", "Billing authority", "billing-records", "billing", "store", [
      "billing",
      "entitlements",
    ]);
    fragment.invariants.push(
      "Verify callback signature before durable acceptance. Deduplicate by provider eventId and tenantId before side effects.",
      "Entitlement policy owns downgrade behavior; decide existing-resource access explicitly. Billing does not require organization tenancy.",
    );
  } else if (pattern === "cached-public-lookup") {
    boundary("cache", "Lookup cache", "distributed-cache", "Data store");
    component("lookup", "Public lookup", "api");
    component("updates", "Lookup update and disable propagation", "api");
    contract("public-lookup", "Resolve public lookup", "api", "resolve-public");
    a.interfaces!.push({
      id: "public-lookup-entry",
      name: "Public opaque-key lookup",
      owner: { kind: "component", id: "lookup" },
      direction: "provided",
      necessity: "required",
      contract: { id: "public-lookup", version: "v1" },
    });
    contract("lookup-records", "Lookup source records", "data");
    contract("cache-records", "Cached lookup records", "data");
    bind(
      "read-cache",
      "lookup",
      "cache",
      "cache-records",
      "read",
      "Reads cached public lookup",
      "Cache protocol",
      {
        ...access,
        failure: {
          timeoutMs: 25,
          outcome: "Source fallback",
          detail: "Application reads authoritative source on cache miss or failure.",
        },
        freshness: {
          maxAgeSeconds: cfg.maxAgeSeconds,
          invalidation: "On write",
          detail:
            "Update and disable propagation invalidates or replaces cached values within the maximum age.",
        },
      },
    );
    bind(
      "read-source",
      "lookup",
      "store",
      "lookup-records",
      "read",
      "Falls back to authoritative lookup",
      "SQL",
      {
        ...access,
        failure: {
          timeoutMs: 250,
          outcome: "Fail request",
          detail:
            "Fail closed for missing/disabled records; do not serve an unbounded stale destination.",
        },
      },
    );
    bind(
      "update-source",
      "updates",
      "store",
      "lookup-records",
      "write",
      "Updates or disables authoritative records",
      "SQL",
    );
    bind(
      "invalidate-cache",
      "updates",
      "cache",
      "cache-records",
      "write",
      "Invalidates changed and disabled lookups",
      "Cache protocol",
      {
        ...access,
        freshness: {
          maxAgeSeconds: cfg.maxAgeSeconds,
          invalidation: "On write",
          detail: "Updates owns propagation; failed invalidation remains bounded by cache age.",
        },
      },
    );
    dataset("lookup-authority", "Lookup authority", "lookup-records", "updates", "store", [
      "updates",
      "lookup",
    ]);
    fragment.invariants.push(
      "Application → cache and application → store implement cache-aside intent. No cache → store dependency is required.",
      `Public lookup uses an opaque record key; mutation stays authenticated. Update/disable propagation must bound stale results to ${cfg.maxAgeSeconds} seconds. Availability and freshness remain unverified targets.`,
    );
  } else {
    host("worker", "Delivery host", "Application", ["service", "worker"]);
    boundary("channel", cfg.channel, "job-queue", "Data store");
    component("producer", "Domain change", "api");
    component("handler", "Idempotent work handler", "worker", "event-handlers-module");
    contract("work-event", `${cfg.channel} event`, "event");
    contract("domain-records", "Domain state", "data");
    const outbox = variant === "transactional-outbox";
    const delivery: RelationshipPolicies = outbox
      ? {
          ...access,
          retry: { maxAttempts: 5, idempotency: "Required", key: "tenantId + eventId" },
          delivery: {
            guarantee: "At least once",
            ordering: "Per key",
            acknowledgement: "Persisted",
          },
          failure: {
            timeoutMs: 5000,
            outcome: "Buffer",
            detail:
              "Retain undelivered intent for explicit retry/recovery; no atomicity is inferred from the queue.",
          },
        }
      : {
          ...access,
          retry: { maxAttempts: 1, idempotency: "Not required", key: "" },
          delivery: {
            guarantee: "At most once",
            ordering: "Unordered",
            acknowledgement: "None",
            lossWindowSeconds: cfg.lossWindowSeconds,
          },
          failure: {
            timeoutMs: 25,
            outcome: "Bounded loss",
            detail: "Continue the initiating request; lost work is an explicit tradeoff.",
          },
        };
    if (outbox) {
      component("atomic-writer", "Atomic domain and event writer", "api");
      component("delivery", "Outbox delivery responsibility", "worker");
      contract(
        "atomic-commit",
        "Commit domain change and event intent atomically",
        "in-process",
        "commit-domain-event",
      );
      contract("outbox-records", "Durable event intent", "data");
      bind(
        "commit-domain-event",
        "producer",
        "atomic-writer",
        "atomic-commit",
        "request",
        "Commits domain change and event intent atomically",
        "In process",
      );
      bind(
        "persist-domain",
        "atomic-writer",
        "store",
        "domain-records",
        "write",
        "Writes domain state in shared transaction",
        "SQL",
      );
      bind(
        "persist-intent",
        "atomic-writer",
        "store",
        "outbox-records",
        "write",
        "Writes event intent in same transaction",
        "SQL",
      );
      bind(
        "read-intent",
        "delivery",
        "store",
        "outbox-records",
        "read",
        "Reads undelivered event intent",
        "SQL",
      );
      bind(
        "record-progress",
        "delivery",
        "store",
        "outbox-records",
        "write",
        "Records delivery progress after acknowledgement",
        "SQL",
      );
      dataset("domain-state", "Domain authority", "domain-records", "atomic-writer", "store");
      dataset(
        "event-intent",
        "Outbox event intent",
        "outbox-records",
        "atomic-writer",
        "store",
        ["atomic-writer", "delivery"],
        ["atomic-writer", "delivery"],
      );
      bind(
        "publish-work",
        "delivery",
        "channel",
        "work-event",
        "publish",
        "Publishes durable event intent",
        "Channel protocol",
        delivery,
        true,
      );
      fragment.invariants.push(
        "REQUIRED: one atomic transaction persists domain-state and event-intent in the selected store through atomic-writer. Neither may commit alone.",
        "REQUIRED: delivery reads retained intent, publishes with retry, and records delivery progress safely. Handler deduplicates tenantId + eventId. A queue plus handler cannot satisfy transactional outbox intent.",
      );
    } else {
      bind(
        "persist-domain",
        "producer",
        "store",
        "domain-records",
        "write",
        "Persists domain state independently of delivery",
        "SQL",
      );
      dataset("domain-state", "Domain authority", "domain-records", "producer", "store");
      bind(
        "publish-work",
        "producer",
        "channel",
        "work-event",
        "publish",
        "Publishes best-effort work",
        "Channel protocol",
        delivery,
        true,
      );
      fragment.invariants.push(
        `Best effort permits work loss within ${cfg.lossWindowSeconds} seconds; domain persistence and publication are independent. No atomic domain/event guarantee.`,
      );
    }
    bind(
      "consume-work",
      "handler",
      "channel",
      "work-event",
      "consume",
      "Consumes named work channel",
      "Channel protocol",
      delivery,
      true,
    );
    fragment.invariants.push(
      `Logical channel “${cfg.channel}” is distinct from other business channels even when a later deployment shares a broker. Carry tenant context into background work.`,
    );
  }
  fragment.invariants.push(
    "Design intent only: no runtime is attached, atomicity verified or delivery measured. Resolve lifecycle and domain payload decisions before implementation.",
  );
  if (fragment.connections.length)
    a.scenarios = [
      {
        id: "pattern-journey",
        name: entry.name,
        scope: { level: "containers" },
        steps: fragment.connections.map((c, index) => ({
          id: `step-${index + 1}`,
          relationship: { kind: "connection" as const, id: c.id },
          text: c.planned!.label,
        })),
      },
    ];
  return architectureFragmentSchema.parse(fragment);
}

export function mappedArchitecture(
  fragment: ArchitectureFragment,
  ids: Record<string, string>,
): Architecture {
  const ref = (id: string) => ids[id] ?? id;
  const exact = (contract: { id: string; version: string }) => ({
    ...contract,
    id: ref(contract.id),
  });
  const owner = <T extends { id: string }>(value: T): T => ({ ...value, id: ref(value.id) });
  const a = fragment.architecture;
  return {
    ...a,
    ...(a.backend ? { backend: mapBackendModel(a.backend, ids) } : {}),
    nodes: a.nodes.map((n) => ({
      ...n,
      id: ref(n.id),
      ...(n.container ? { container: ref(n.container) } : {}),
    })),
    relationships: a.relationships.map((r) => ({
      ...r,
      id: ref(r.id),
      from: ref(r.from),
      to: ref(r.to),
      ...(r.container ? { container: ref(r.container) } : {}),
    })),
    objectives: a.objectives?.map((o) => ({
      ...o,
      id: ref(o.id),
      scope: o.scope.kind === "system" ? o.scope : { ...o.scope, id: ref(o.scope.id) },
    })),
    reviewRequirements: a.reviewRequirements?.map((r) => ({
      ...r,
      id: ref(r.id),
      ...("binding" in r && r.binding ? { binding: ref(r.binding) } : {}),
      ...(r.kind === "cache"
        ? {
            ...(r.fallback ? { fallback: ref(r.fallback) } : {}),
            ...(r.update ? { update: ref(r.update) } : {}),
          }
        : {}),
      ...(r.kind === "delivery"
        ? {
            ...(r.channel ? { channel: ref(r.channel) } : {}),
            ...(r.responsible ? { responsible: owner(r.responsible) } : {}),
          }
        : {}),
    })),
    decisions: a.decisions?.map((d) => ({
      ...d,
      id: ref(d.id),
      acknowledgements: [],
      links: d.links.map((l) => ({
        ...l,
        id: l.kind === "contract" ? `${ref(l.id.split("@")[0]!)}@${l.id.split("@")[1]}` : ref(l.id),
      })),
    })),
    components: a.components?.map((c) => ({
      ...c,
      id: ref(c.id),
      element: ref(c.element),
      usesConnections: c.usesConnections.map(ref),
    })),
    contracts: a.contracts?.map((c) => ({ ...c, id: ref(c.id) })),
    interfaces: a.interfaces?.map((i) => ({
      ...i,
      id: ref(i.id),
      owner: owner(i.owner),
      contract: exact(i.contract),
    })),
    bindings: a.bindings?.map((b) => ({
      ...b,
      id: ref(b.id),
      relationship: owner(b.relationship),
      provided: ref(b.provided),
      required: ref(b.required),
      contract: exact(b.contract),
    })),
    datasets: a.datasets?.map((d) => ({
      ...d,
      id: ref(d.id),
      contract: exact(d.contract),
      owners: d.owners.map(owner),
      readers: d.readers.map(owner),
      writers: d.writers.map(owner),
      store: d.store && ref(d.store),
    })),
    componentRelationships: a.componentRelationships?.map((r) => ({
      ...r,
      id: ref(r.id),
      from: ref(r.from),
      to: ref(r.to),
    })),
    scenarios: a.scenarios?.map((s) => ({
      ...s,
      id: ref(s.id),
      scope:
        s.scope.level === "components"
          ? { ...s.scope, container: ref(s.scope.container) }
          : s.scope,
      ...(s.actor ? { actor: ref(s.actor) } : {}),
      review: undefined,
      outcomes: s.outcomes?.map((o) => ({
        ...o,
        requirements: o.requirements.map(ref),
        decisions: o.decisions.map(ref),
      })),
      steps: s.steps.map((step) => ({
        ...step,
        relationship: owner(step.relationship),
        ...(step.binding ? { binding: ref(step.binding) } : {}),
        ...(step.client
          ? { client: { ...step.client, component: ref(step.client.component) } }
          : {}),
      })),
      alternatives: s.alternatives?.map((alt) => ({
        ...alt,
        steps: alt.steps.map((step) => ({
          ...step,
          relationship: owner(step.relationship),
          ...(step.binding ? { binding: ref(step.binding) } : {}),
          ...(step.client
            ? { client: { ...step.client, component: ref(step.client.component) } }
            : {}),
        })),
      })),
    })),
  };
}
const mappedConnection = (c: Connection, ids: Record<string, string>): Connection => ({
  ...c,
  id: ids[c.id]!,
  from: { element: ids[c.from.element]! },
  to: { element: ids[c.to.element]! },
});
const contractSemantics = (value: unknown) => {
  if (!value || typeof value !== "object") return value;
  const { name: _name, description: _description, ...rest } = value as ArchitectureContract;
  return { ...rest, ...(rest.shape ? { shape: contractShapeSemantics(rest.shape) } : {}) };
};
const semantic = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(semantic);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["name", "description", "responsibility", "technology"].includes(key))
        .map(([key, item]) => [key, semantic(item)]),
    );
  return value;
};
/** Expected semantic subsets permit extra interfaces/dependencies and preserve display customizations. */
function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      expected.every((item) => actual.some((other) => contains(other, item)))
    );
  if (expected && typeof expected === "object")
    return (
      !!actual &&
      typeof actual === "object" &&
      Object.entries(expected).every(([key, item]) =>
        contains((actual as Record<string, unknown>)[key], item),
      )
    );
  return actual === expected;
}
export const fragmentCollections = [
  "nodes",
  "relationships",
  "objectives",
  "reviewRequirements",
  "decisions",
  "components",
  "contracts",
  "interfaces",
  "bindings",
  "datasets",
  "componentRelationships",
  "scenarios",
] as const;
function occupiedIds(design: DesignDocument): Set<string> {
  return new Set([
    "system",
    ...design.elements.flatMap((e) => [e.id, ...e.attachments.map((a) => a.id)]),
    ...design.connections.map((c) => c.id),
    ...design.annotations.map((a) => a.id),
    ...backendDeclarations(design.architecture?.backend).map((v) => v.id),
    ...["nodes", "relationships", "patternInstances", ...fragmentCollections].flatMap((key) =>
      (
        (design.architecture as unknown as Record<string, { id: string }[]> | undefined)?.[key] ??
        []
      ).map((item) => item.id),
    ),
  ]);
}
export function fragmentIds(fragment: ArchitectureFragment) {
  return [
    ...new Set([
      ...fragment.roles.map((r) => r.id),
      ...fragment.connections.map((c) => c.id),
      ...backendDeclarations(fragment.architecture.backend).map((v) => v.id),
      ...fragmentCollections.flatMap(
        (key) => fragment.architecture[key]?.map((item) => item.id) ?? [],
      ),
    ]),
  ];
}
function sourceMatches(
  design: DesignDocument,
  instance: PatternInstance,
  fragment: ArchitectureFragment,
  lookup: TemplateLookup,
): boolean {
  if (instance.pattern !== fragment.id || instance.version !== fragment.version) return false;
  if (contractCanonical(instance.invariants) !== contractCanonical(fragment.invariants))
    return false;
  const ids = instance.identities;
  if (fragmentIds(fragment).some((id) => !ids[id])) return false;
  const expected = mappedArchitecture(fragment, ids);
  for (const key of backendCollections)
    for (const item of expected.backend?.[key] ?? []) {
      const actual = design.architecture?.backend?.[key]?.find(
        (v) => v.id === item.id && v.version === item.version,
      );
      if (contractCanonical(semantic(actual)) !== contractCanonical(semantic(item))) return false;
    }
  for (const role of fragment.roles.filter((r) => r.kind !== "component")) {
    if (role.kind === "context") {
      const node = design.architecture?.nodes.find((n) => n.id === ids[role.id]);
      if (
        !node ||
        node.kind !== role.contextKind ||
        (role.host && node.container !== ids[role.host])
      )
        return false;
      continue;
    }
    const element = design.elements.find((e) => e.id === ids[role.id]);
    if (!element || !hostMatches(element, role, lookup)) return false;
    if (
      role.kind === "boundary" &&
      role.create &&
      (element.template || element.planned !== role.create.planned)
    )
      return false;
  }
  for (const key of fragmentCollections) {
    for (const item of expected[key] ?? []) {
      const actual = design.architecture?.[key]?.find(
        (v) =>
          v.id === item.id &&
          (key !== "contracts" ||
            (v as ArchitectureContract).version === (item as ArchitectureContract).version),
      );
      if (key === "contracts") {
        // Exact version/identity and shape; subset/schema inference is not compatibility.
        if (
          contractCanonical(contractSemantics(actual)) !==
          contractCanonical(contractSemantics(item))
        )
          return false;
      } else if (!contains(semantic(actual), semantic(item))) return false;
    }
  }
  for (const c of fragment.connections) {
    const expectedConnection = mappedConnection(c, ids);
    const actual = design.connections.find((item) => item.id === expectedConnection.id);
    if (
      !actual ||
      actual.from.element !== expectedConnection.from.element ||
      actual.to.element !== expectedConnection.to.element ||
      connectionProtocol(actual) !== connectionProtocol(expectedConnection) ||
      connectionInteraction(actual) !== connectionInteraction(expectedConnection)
    )
      return false;
  }
  return true;
}
function hostMatches(
  element: Element,
  role: ArchitectureFragment["roles"][number],
  lookup: TemplateLookup,
) {
  const classification = containerClassification(element);
  return (
    (!role.storeKind ||
      element.planned === "relational-store" ||
      element.template?.id === "postgres") &&
    classification.kind === role.classification &&
    classification.ownership ===
      (role.ownership ??
        (role.classification === "External system"
          ? "External responsibility"
          : "System responsibility")) &&
    (!role.required ||
      !role.create ||
      ((element.planned ??
        {
          "http-service": "application-api",
          "web-app": "browser-client",
          postgres: "relational-store",
        }[element.template?.id ?? ""]) === role.create.planned &&
        contains(
          {
            ...Object.fromEntries(
              (plannedCapability(element.planned)?.fields ?? []).map((f) => [f.key, f.default]),
            ),
            ...element.config,
          },
          role.create.config,
        ))) &&
    (!role.hostRoles.length ||
      role.hostRoles.includes(componentHostRole(element, lookup) as "service"))
  );
}

/** Match an external role without inferring schema compatibility or adopting another owner. */
function sameDefinition(a: ArchitectureContract, b: ArchitectureContract) {
  return (
    a.version === b.version &&
    a.kind === b.kind &&
    !!a.shape &&
    !!b.shape &&
    inspectContractShape(a.shape).ok &&
    inspectContractShape(b.shape).ok &&
    inspectContractTransport(a.shape).ok &&
    inspectContractTransport(b.shape).ok &&
    contractCanonical(contractShapeSemantics(a.shape)) ===
      contractCanonical(contractShapeSemantics(b.shape))
  );
}
function matchRequiredInterfaces(
  design: DesignDocument,
  fragment: ArchitectureFragment,
  local: string,
  target: string,
): Record<string, string> | undefined {
  const mappings: Record<string, string> = {};
  for (const expected of fragment.architecture.interfaces?.filter((i) => i.owner.id === local) ??
    []) {
    const definition = fragment.architecture.contracts?.find(
      (c) => c.id === expected.contract.id && c.version === expected.contract.version,
    );
    const matches = (design.architecture?.interfaces ?? []).filter(
      (i) =>
        i.owner.id === target &&
        i.owner.kind === expected.owner.kind &&
        i.direction === expected.direction &&
        i.necessity === expected.necessity &&
        design.architecture?.contracts?.some(
          (c) =>
            c.id === i.contract.id &&
            c.version === i.contract.version &&
            definition &&
            sameDefinition(definition, c),
        ),
    );
    if (matches.length !== 1) return undefined;
    const match = matches[0]!;
    for (const guarantee of fragment.architecture.bindings?.filter(
      (b) => b.provided === expected.id || b.required === expected.id,
    ) ?? []) {
      if (
        guarantee.policies &&
        !design.architecture?.bindings?.some(
          (binding) =>
            (binding.provided === match.id || binding.required === match.id) &&
            binding.role === guarantee.role &&
            binding.operation === guarantee.operation &&
            contains(binding.policies, guarantee.policies),
        )
      )
        return undefined;
    }
    if (mappings[expected.contract.id] && mappings[expected.contract.id] !== match.contract.id)
      return undefined;
    mappings[expected.id] = match.id;
    mappings[expected.contract.id] = match.contract.id;
  }
  return mappings;
}

const connectionProtocol = (c: Connection) => c.planned?.protocol ?? c.protocol;
const connectionInteraction = (c: Connection) => c.planned?.interaction ?? c.interaction;
export interface PatternPreview {
  ok: boolean;
  errors: string[];
  unfilled: string[];
  fragment?: ArchitectureFragment;
  roles: {
    id: string;
    name: string;
    purpose: string;
    create: boolean;
    selected?: string;
    candidates: { id: string; name: string; reason: string }[];
  }[];
  relationships: { id: string; name: string; candidates: { id: string; name: string }[] }[];
  additions: { kind: string; id: string; name: string }[];
  ops: OperationInput[];
  review: ReturnType<typeof architectureReview>;
}

/** Pure preview and expansion shared by mouse and chat; requests bind to their opening revision. */
export function previewArchitecturePattern(
  design: DesignDocument,
  input: PatternRequestInput,
  lookup: TemplateLookup,
  source?: {
    fragment: ArchitectureFragment;
    contentHash: string;
    options?: Record<string, string>;
  },
): PatternPreview {
  const result: PatternPreview = {
    ok: false,
    errors: [],
    unfilled: [],
    roles: [],
    relationships: [],
    additions: [],
    ops: [],
    review: [],
  };
  const parsed = patternRequestSchema.safeParse(input);
  if (!parsed.success) {
    result.errors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return result;
  }
  const req = parsed.data;
  if (design.revision !== req.baseRevision)
    result.errors.push(
      "The design changed. Your draft has been retained. Cancel and reopen to review the current revision.",
    );
  let fragment: ArchitectureFragment;
  try {
    fragment =
      source?.fragment ?? describeArchitecturePattern(req.pattern, req.variant, req.config);
    if (fragment.id !== req.pattern || fragment.version !== req.version)
      throw new Error("Choose the exact published architecture version.");
  } catch (error) {
    result.errors.push((error as Error).message);
    return result;
  }
  result.fragment = fragment;
  for (const key of Object.keys(req.roles))
    if (!fragment.roles.some((r) => r.id === key)) result.errors.push(`Unknown role ${key}.`);
  for (const key of Object.keys(req.relationships))
    if (!fragment.connections.some((c) => c.id === key))
      result.errors.push(`Unknown relationship ${key}.`);
  const used = occupiedIds(design);
  if (used.has(req.instanceId)) result.errors.push("Choose a fresh pattern instance identity.");
  const ids: Record<string, string> = Object.fromEntries(
    fragmentIds(fragment).map((id) => [id, `${req.instanceId}-${id}`]),
  );
  const reused = new Set<string>();
  const contracts = new Map<string, string>();
  // Only pinned expansions whose current declarations still satisfy all guarantees are candidates.
  const sources = (design.architecture?.patternInstances ?? []).filter((instance) => {
    const { name: _name, ...config } = instance.config;
    const { name: _newName, ...newConfig } = req.config;
    return (
      instance.libraryContentHash === source?.contentHash &&
      contractCanonical(instance.libraryOptions ?? {}) ===
        contractCanonical(source?.options ?? {}) &&
      instance.variant === req.variant &&
      contractCanonical(config) === contractCanonical(newConfig) &&
      sourceMatches(design, instance, fragment, lookup)
    );
  });
  for (const role of fragment.roles) {
    const candidates: PatternPreview["roles"][number]["candidates"] = [];
    if (role.kind === "context") {
      for (const node of design.architecture?.nodes ?? [])
        if (
          node.kind === role.contextKind &&
          (!role.host || node.container === ids[role.host]) &&
          matchRequiredInterfaces(design, fragment, role.id, node.id)
        )
          candidates.push({
            id: node.id,
            name: node.name,
            reason: "Explicit context role and exact interfaces; existing identity is retained.",
          });
    } else if (role.required && role.kind !== "host") {
      for (const component of design.architecture?.components ?? []) {
        if (component.element !== ids[role.host!]) continue;
        const expected = fragment.architecture.components?.find((c) => c.id === role.id);
        if (
          !expected ||
          component.capability !== expected.capability ||
          !contains(component.config, expected.config)
        )
          continue;
        const matches = matchRequiredInterfaces(design, fragment, role.id, component.id);
        if (matches)
          candidates.push({
            id: component.id,
            name: component.name,
            reason:
              "Explicit required role, compatible host, exact interface shape/version and declared configuration.",
          });
      }
    } else if (role.kind === "host") {
      for (const e of design.elements.filter((e) => hostMatches(e, role, lookup)))
        candidates.push({
          id: e.id,
          name: e.name,
          reason:
            "Compatible host role and ownership. Existing configuration is retained; this does not assert runtime support.",
        });
    } else {
      for (const source of sources) {
        const id = source.identities[role.id]!;
        if (role.host && source.identities[role.host] !== ids[role.host]) continue;
        const name =
          role.kind === "component"
            ? design.architecture?.components?.find((c) => c.id === id)?.name
            : design.elements.find((e) => e.id === id)?.name;
        if (name && !candidates.some((c) => c.id === id))
          candidates.push({
            id,
            name,
            reason:
              "Explicit pinned role, ownership, exact contract versions and current policies match. Customizations are retained.",
          });
      }
    }
    const choice =
      req.roles[role.id] ??
      (role.kind === "host" || role.required
        ? candidates.length === 1
          ? { mode: "reuse" as const, id: candidates[0]!.id }
          : { mode: "unfilled" as const }
        : { mode: "create" as const });
    result.roles.push({
      id: role.id,
      name: role.name,
      purpose: role.purpose,
      create: role.kind !== "host" && !role.required,
      selected: choice.mode === "reuse" ? choice.id : choice.mode,
      candidates,
    });
    if (choice.mode === "unfilled")
      result.unfilled.push(`${role.name}: choose a compatible role binding.`);
    else if (choice.mode === "create") {
      if (role.kind === "host" || role.required)
        result.errors.push(`${role.name}: select an existing host explicitly.`);
    } else if (!candidates.some((c) => c.id === choice.id))
      result.errors.push(
        `${role.name}: refused role, ownership, tenant, exact contract or guarantee mismatch. Family/name alone cannot establish compatibility.`,
      );
    else {
      ids[role.id] = choice.id;
      reused.add(role.id);
      if (role.required) {
        const matches = matchRequiredInterfaces(design, fragment, role.id, choice.id);
        if (!matches)
          result.errors.push(`${role.name}: exact required interfaces are missing or ambiguous.`);
        else
          for (const [local, target] of Object.entries(matches)) {
            if (contracts.has(local) && contracts.get(local) !== target)
              result.errors.push(
                "Required roles use different shared definition identities. Bind an explicit adapter instead.",
              );
            contracts.set(local, target);
          }
      } else if (role.kind !== "host") {
        const source = sources.find((s) => s.identities[role.id] === choice.id)!;
        for (const c of fragment.architecture.contracts ?? []) {
          const existing = contracts.get(c.id);
          const target = source.identities[c.id]!;
          if (existing && existing !== target)
            result.errors.push(
              "Selected roles use different exact contract identities; choose a single compatible composition or declare an explicit adapter.",
            );
          contracts.set(c.id, target);
        }
      }
    }
  }
  // An already composed backend boundary can be reused as a whole. Partial role reuse must
  // still validate authority/table conflicts; it never silently creates a second schema.
  if (fragment.architecture.backend) {
    const source = sources.find((s) =>
      fragment.roles.every((r) => reused.has(r.id) && ids[r.id] === s.identities[r.id]),
    );
    if (source) {
      // Every role and current semantic declaration matched this exact pinned expansion.
      // Preserve the whole graph, including historical/session/provider interfaces, rather
      // than duplicating interfaces that have no backend operation or access binding.
      for (const local of fragmentIds(fragment)) {
        const target = source.identities[local];
        if (!target)
          result.errors.push(`Pinned backend graph dependency ${local} has no identity mapping.`);
        else {
          ids[local] = target;
          reused.add(local);
        }
      }
    }
  }
  for (const [local, target] of Object.entries(req.definitions ?? {})) {
    const expected = fragment.architecture.contracts?.filter((c) => c.id === local) ?? [];
    if (
      !expected.length ||
      !expected.every((definition) =>
        design.architecture?.contracts?.some(
          (actual) => actual.id === target && sameDefinition(definition, actual),
        ),
      )
    )
      result.errors.push(`Definition ${local}: every exact version and shape must match.`);
    else if (contracts.has(local) && contracts.get(local) !== target)
      result.errors.push(`Definition ${local}: conflicts with a required interface identity.`);
    else contracts.set(local, target);
  }
  for (const [local, id] of contracts) {
    ids[local] = id;
    reused.add(local);
  }
  for (const c of fragment.connections) {
    const mapped = mappedConnection(c, ids);
    const candidates = design.connections
      .filter(
        (item) =>
          item.from.element === mapped.from.element &&
          item.to.element === mapped.to.element &&
          connectionProtocol(item) === connectionProtocol(c) &&
          connectionInteraction(item) === connectionInteraction(c),
      )
      .map((item) => ({ id: item.id, name: item.planned?.label ?? item.label ?? item.id }));
    result.relationships.push({ id: c.id, name: c.planned?.label ?? c.label ?? c.id, candidates });
    const selected = req.relationships[c.id];
    if (selected) {
      if (reused.has(c.id) && selected !== ids[c.id])
        result.errors.push(
          "A reused exact backend boundary must retain its pinned relationship; create a separate boundary to select another one.",
        );
      else if (!candidates.some((item) => item.id === selected))
        result.errors.push(
          `${c.planned?.label ?? c.label ?? c.id}: existing relationship endpoints, protocol and interaction must match.`,
        );
      else {
        ids[c.id] = selected;
        reused.add(c.id);
      }
    }
  }
  // Resolve connection IDs after explicit relationship selection.
  for (const local of fragmentIds(fragment).filter((id) => !reused.has(id))) {
    if (!idSchema.safeParse(ids[local]).success || used.has(ids[local]!))
      result.errors.push(`Expanded identity ${ids[local]} is invalid or already used.`);
  }
  if (result.errors.length || result.unfilled.length) return result;
  const architecture = structuredClone(
    design.architecture ?? {
      system: { name: "System", description: "" },
      nodes: [],
      relationships: [],
    },
  );
  const expanded = mappedArchitecture(fragment, ids);
  if (expanded.backend) {
    architecture.backend ??= { schemaVersion: 1, entities: [], aggregates: [] };
    for (const key of backendCollections) {
      for (const item of expanded.backend[key] ?? []) {
        architecture.backend[key] ??= [];
        const current = architecture.backend[key] as { id: string; version: string }[];
        const existing = current.find((v) => v.id === item.id && v.version === item.version);
        if (existing && contractCanonical(semantic(existing)) !== contractCanonical(semantic(item)))
          result.errors.push(
            `Backend ${item.id}@${item.version} conflicts with an existing exact definition.`,
          );
        else if (!existing) {
          current.push(item);
          result.additions.push({ kind: key, id: item.id, name: item.name });
        }
      }
    }
    if (result.errors.length) return result;
  }
  const ops: OperationInput[] = [];
  const title = (name: string) => `${req.config.name}: ${name}`.slice(0, 120);
  for (const role of fragment.roles) {
    if (role.create && role.kind !== "host" && !reused.has(role.id)) {
      const element = { ...role.create, id: ids[role.id]!, name: title(role.create.name) };
      ops.push({ op: "addElement", element });
      result.additions.push({ kind: "container", id: element.id, name: element.name });
    }
  }
  for (const c of fragment.connections.filter((c) => !reused.has(c.id)))
    ops.push({ op: "connect", connection: mappedConnection(c, ids) });
  for (const key of fragmentCollections) {
    if (!expanded[key]?.length && !architecture[key]) continue;
    const current = (architecture[key] ?? []) as { id: string; name?: string }[];
    for (const item of expanded[key] ?? []) {
      const local = Object.keys(ids).find((local) => ids[local] === item.id) ?? "";
      if (
        reused.has(local) &&
        (key !== "components" || fragment.roles.find((r) => r.id === local)?.required)
      )
        continue;
      const existing = current.find(
        (v) =>
          v.id === item.id &&
          (key !== "contracts" ||
            (v as ArchitectureContract).version === (item as ArchitectureContract).version),
      );
      if (existing && key === "components") {
        const component = existing as ArchitectureComponent;
        component.usesConnections = [
          ...new Set([
            ...component.usesConnections,
            ...(item as ArchitectureComponent).usesConnections,
          ]),
        ];
      } else if (!existing) {
        const value = { ...item, ...("name" in item ? { name: title(item.name as string) } : {}) };
        current.push(value);
        result.additions.push({
          kind: key,
          id: item.id,
          name: "name" in value ? String(value.name) : item.id,
        });
      }
    }
    Object.assign(architecture, { [key]: current });
  }
  architecture.patternInstances = [
    ...(architecture.patternInstances ?? []),
    {
      id: req.instanceId,
      pattern: req.pattern,
      version: req.version,
      variant: req.variant,
      baseRevision: req.baseRevision,
      config: req.config,
      identities: ids,
      invariants: fragment.invariants,
      ...(source
        ? { libraryContentHash: source.contentHash, libraryOptions: source.options ?? {} }
        : {}),
    },
  ];
  ops.push({ op: "setArchitecture", architecture });
  const checked = applyOperations(design, ops, lookup, { baseRevision: req.baseRevision });
  if (!checked.ok) {
    result.errors.push(...checked.errors.map((e) => e.message));
    return result;
  }
  result.ok = true;
  result.ops = ops;
  result.review = architectureReview(checked.design);
  return result;
}
