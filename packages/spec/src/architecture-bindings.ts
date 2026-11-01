/** Relationship and data intent. These declarations never implement executable policies. */
import { z } from "zod";
import { containerClassification } from "./architecture-choices.ts";
import {
  architectureContractReview,
  architectureContractSchema,
  type ContractOwner,
  contractKey,
  contractOwnerElement,
  contractOwnerSchema,
  sameContractOwner,
} from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { idSchema } from "./ids.ts";

const note = z.string().trim().max(1200);
const exactContract = z.strictObject({
  id: idSchema,
  version: architectureContractSchema.shape.version,
});
export const bindingRelationshipSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("connection"), id: idSchema }),
  z.strictObject({ kind: z.literal("component-relationship"), id: idSchema }),
]);
export const tenantScopeSchema = z.enum(["Unknown", "Public", "Tenant scoped", "Cross tenant"]);
export const relationshipPoliciesSchema = z.strictObject({
  access: z
    .strictObject({
      identity: z.enum(["Unknown", "Public", "User", "Service", "API key", "Signed callback"]),
      tenant: tenantScopeSchema,
      network: z.enum(["Unknown", "Public", "Private"]),
    })
    .optional(),
  failure: z
    .strictObject({
      timeoutMs: z.number().positive().max(86_400_000).optional(),
      outcome: z.enum([
        "Unknown",
        "Fail request",
        "Source fallback",
        "Serve stale",
        "Buffer",
        "Bounded loss",
      ]),
      detail: note,
    })
    .optional(),
  retry: z
    .strictObject({
      maxAttempts: z.int().min(1).max(1000).optional(),
      idempotency: z.enum(["Unknown", "Required", "Not required"]),
      key: note,
    })
    .optional(),
  delivery: z
    .strictObject({
      guarantee: z.enum(["Unknown", "At most once", "At least once"]),
      ordering: z.enum(["Unknown", "Unordered", "Per key", "Total"]),
      acknowledgement: z.enum(["Unknown", "None", "Accepted", "Persisted", "Processed"]),
      lossWindowSeconds: z.number().nonnegative().max(31_536_000).optional(),
    })
    .optional(),
  freshness: z
    .strictObject({
      maxAgeSeconds: z.number().nonnegative().max(31_536_000).optional(),
      invalidation: z.enum(["Unknown", "TTL", "On write", "Event driven", "No cache"]),
      detail: note,
    })
    .optional(),
});
export const architectureBindingSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  relationship: bindingRelationshipSchema,
  provided: idSchema,
  required: idSchema,
  contract: exactContract,
  operation: idSchema.optional(),
  role: z.enum(["request", "publish", "consume", "callback", "read", "write"]),
  transport: z.string().trim().min(1).max(80).optional(),
  businessSynchrony: z.enum(["Unknown", "Synchronous", "Asynchronous"]),
  policies: relationshipPoliciesSchema.optional(),
});
export const architectureDatasetSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  contract: exactContract,
  owners: z.array(contractOwnerSchema).max(10),
  ownershipDecision: note,
  store: idSchema.optional(),
  readers: z.array(contractOwnerSchema).max(100),
  writers: z.array(contractOwnerSchema).max(100),
  tenant: tenantScopeSchema,
  retentionDays: z.number().positive().max(36500).optional(),
  deletion: z.enum(["Unknown", "Delete", "Anonymize", "Retain"]),
  exportAccess: z.enum(["Unknown", "None", "Owner", "Tenant admin", "Authorized staff"]),
});
export const architectureObjectiveSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
  scope: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("system") }),
    ...(["element", "component", "binding", "dataset"] as const).map((kind) =>
      z.strictObject({ kind: z.literal(kind), id: idSchema }),
    ),
  ]),
  metric: z.enum([
    "response-time",
    "analytics-lag",
    "job-completion",
    "throughput",
    "availability",
    "recovery-time",
    "recovery-point",
  ]),
  value: z.number().positive().max(1e12).optional(),
  unit: z
    .enum([
      "milliseconds",
      "seconds",
      "minutes",
      "requests/second",
      "events/second",
      "percent",
      "days",
    ])
    .optional(),
  boundary: z.string().trim().max(240),
  window: z.string().trim().max(240),
});
export type RelationshipBinding = z.output<typeof architectureBindingSchema>;
export type BindingRelationship = RelationshipBinding["relationship"];
export type RelationshipPolicies = z.output<typeof relationshipPoliciesSchema>;
export type ArchitectureDataset = z.output<typeof architectureDatasetSchema>;
export type ArchitectureObjective = z.output<typeof architectureObjectiveSchema>;

export const sameBindingRelationship = (a: BindingRelationship, b: BindingRelationship) =>
  a.kind === b.kind && a.id === b.id;
export function ownerExists(design: DesignDocument, owner: ContractOwner): boolean {
  return owner.kind === "external-system"
    ? !!design.architecture?.nodes.some(
        (item) => item.id === owner.id && item.kind === "external-system",
      )
    : !!contractOwnerElement(design, owner);
}

export function validateRelationshipBindings(design: DesignDocument): Finding[] {
  const model = design.architecture;
  if (!model) return [];
  const result: Finding[] = [];
  const ids = new Set([
    "system",
    ...design.elements.flatMap((item) => [item.id, ...item.attachments.map((a) => a.id)]),
    ...design.connections.map((item) => item.id),
    ...design.annotations.map((item) => item.id),
    ...[
      model.nodes,
      model.patternInstances,
      model.relationships,
      model.components,
      model.componentRelationships,
      model.scenarios,
      model.contracts,
      model.interfaces,
    ].flatMap((items) => items?.map((item) => item.id) ?? []),
  ]);
  const checkId = (id: string, path: string[]) => {
    if (ids.has(id))
      result.push(
        finding("DUPLICATE_ID", `Architecture identity ${id} is already used.`, { path }),
      );
    ids.add(id);
  };
  for (const binding of model.bindings ?? []) {
    const path = ["architecture", "bindings", binding.id];
    checkId(binding.id, path);
    const invalid = (message: string) =>
      result.push(
        finding(
          "UNKNOWN_REFERENCE",
          `${binding.name}: ${message} Remove or update its binding before removing a reference.`,
          { path },
        ),
      );
    const provided = model.interfaces?.find((item) => item.id === binding.provided);
    const required = model.interfaces?.find((item) => item.id === binding.required);
    const contract = model.contracts?.find(
      (item) => contractKey(item) === contractKey(binding.contract),
    );
    if (!contract) invalid("select an existing exact contract version.");
    if (
      !provided ||
      provided.direction !== "provided" ||
      !required ||
      required.direction !== "required"
    ) {
      invalid("select provided and required interfaces.");
      continue;
    }
    if (binding.operation && !contract?.shape?.operations.some((op) => op.id === binding.operation))
      invalid("select an operation from the exact planned contract.");
    if (binding.relationship.kind === "connection") {
      const connection = design.connections.find((item) => item.id === binding.relationship.id);
      const endpoints = [
        contractOwnerElement(design, provided.owner),
        contractOwnerElement(design, required.owner),
      ];
      if (
        !connection ||
        !endpoints.includes(connection.from.element) ||
        !endpoints.includes(connection.to.element) ||
        endpoints[0] === endpoints[1]
      )
        invalid("interface owners must belong to the two endpoints of the same C2 connection.");
    } else {
      const relation = model.componentRelationships?.find(
        (item) => item.id === binding.relationship.id,
      );
      const endpoints = [provided.owner, required.owner];
      if (
        !relation ||
        !endpoints.every((owner) => owner.kind === "component") ||
        !endpoints.some((owner) => owner.id === relation.from) ||
        !endpoints.some((owner) => owner.id === relation.to)
      )
        invalid(
          "in-process interfaces must belong to the components of the same local C3 relationship.",
        );
    }
  }
  for (const dataset of model.datasets ?? []) {
    const path = ["architecture", "datasets", dataset.id];
    checkId(dataset.id, path);
    const invalid = (message: string) =>
      result.push(finding("CONFIG_INVALID", `${dataset.name}: ${message}`, { path }));
    const contract = model.contracts?.find(
      (item) => contractKey(item) === contractKey(dataset.contract),
    );
    if (!contract || contract.kind !== "data")
      invalid("select an existing exact data contract; reuse a resource source where available.");
    for (const [group, owners] of Object.entries({
      owners: dataset.owners,
      readers: dataset.readers,
      writers: dataset.writers,
    })) {
      if (new Set(owners.map((owner) => `${owner.kind}:${owner.id}`)).size !== owners.length)
        invalid(`duplicate ${group}.`);
      for (const owner of owners)
        if (!ownerExists(design, owner))
          invalid(`${group} must reference existing responsibilities.`);
    }
    if (dataset.owners.length > 1 && !dataset.ownershipDecision.trim())
      invalid("shared authority needs an explicit ownership decision.");
    if (
      dataset.store &&
      !design.elements.some(
        (item) => item.id === dataset.store && containerClassification(item).kind === "Data store",
      )
    )
      invalid("select an existing logical data store.");
    if (
      contract?.source &&
      dataset.owners.some(
        (owner) => contractOwnerElement(design, owner) !== contract.source?.element,
      )
    )
      invalid("resource authority must remain in its authoritative application.");
  }
  for (const objective of model.objectives ?? []) {
    const path = ["architecture", "objectives", objective.id];
    checkId(objective.id, path);
    const scope = objective.scope;
    const exists =
      scope.kind === "system" ||
      (scope.kind === "element"
        ? design.elements
        : scope.kind === "component"
          ? model.components
          : scope.kind === "binding"
            ? model.bindings
            : model.datasets
      )?.some((item) => item.id === scope.id);
    if (!exists)
      result.push(
        finding(
          "UNKNOWN_REFERENCE",
          `${objective.name}: objective scope was removed; update the objective first.`,
          { path },
        ),
      );
  }
  return result;
}

export interface ArchitectureReviewFinding {
  code: string;
  message: string;
  contract?: string;
  interface?: string;
  binding?: string;
  dataset?: string;
  objective?: string;
}
/** A separate review gate: selected contradictions never enter blocksGenerate. */
export function architectureReview(design: DesignDocument): ArchitectureReviewFinding[] {
  const model = design.architecture;
  const result: ArchitectureReviewFinding[] = architectureContractReview(design);
  if (!model) return result;
  for (const binding of model.bindings ?? []) {
    const add = (code: string, message: string) =>
      result.push({ code, message: `${binding.name}: ${message}`, binding: binding.id });
    const provided = model.interfaces?.find((item) => item.id === binding.provided);
    const required = model.interfaces?.find((item) => item.id === binding.required);
    const contract = model.contracts?.find(
      (item) => contractKey(item) === contractKey(binding.contract),
    );
    if (contract?.kind === "event" && !["publish", "consume"].includes(binding.role))
      add("INTERACTION_CONFLICT", "an event contract needs a publish or consume role.");
    if (contract?.kind === "data" && !["read", "write"].includes(binding.role))
      add("INTERACTION_CONFLICT", "a data contract needs an explicit read or write role.");
    if (contract?.kind === "in-process" && binding.relationship.kind === "connection")
      add(
        "INTERACTION_CONFLICT",
        "an in-process contract cannot describe cross-container communication; select a remote contract or an explicit adapter.",
      );
    const relation =
      binding.relationship.kind === "connection"
        ? design.connections.find((item) => item.id === binding.relationship.id)
        : model.componentRelationships?.find((item) => item.id === binding.relationship.id);
    const sourceOwner = binding.role === "publish" ? provided?.owner : required?.owner;
    const sourceId =
      sourceOwner &&
      (binding.relationship.kind === "connection"
        ? contractOwnerElement(design, sourceOwner)
        : sourceOwner.id);
    const from = relation && ("kind" in relation ? relation.from.element : relation.from);
    if (from && sourceId && from !== sourceId)
      add(
        "DIRECTION_CONFLICT",
        "the arrow must originate at the publisher for publish, or the caller/reader/writer/consumer for other roles. Update the authored direction or role explicitly.",
      );
    if (
      [provided, required].some(
        (item) => !item || contractKey(item.contract) !== contractKey(binding.contract),
      )
    )
      add(
        "CONTRACT_MISMATCH",
        `binding selects ${contractKey(binding.contract)}; provided ${provided ? contractKey(provided.contract) : "missing"}, required ${required ? contractKey(required.contract) : "missing"}. Exact versions must agree; use an explicit adapter for different contracts.`,
      );
    if (binding.businessSynchrony === "Unknown")
      add("UNDECIDED_POLICY", "business synchrony is unknown.");
    const p = binding.policies;
    if (p?.access) {
      if (p.access.identity === "Unknown")
        add(
          "UNDECIDED_POLICY",
          "identity is unknown. Private-network reachability does not authenticate a caller.",
        );
      if (p.access.tenant === "Tenant scoped" && p.access.identity === "Public")
        add(
          "TENANT_CONFLICT",
          "tenant-scoped access requires an authenticated tenant identity; public identity cannot establish it.",
        );
      if (
        p.access.tenant === "Tenant scoped" &&
        (!model.system.businessTenancy || model.system.businessTenancy === "Unspecified")
      )
        add("UNDECIDED_POLICY", "tenant access is selected but business tenancy is unspecified.");
    }
    if (p?.failure?.outcome === "Bounded loss" && p.delivery?.lossWindowSeconds === undefined)
      add("UNDECIDED_POLICY", "bounded loss needs an explicit maximum loss window in seconds.");
    if (p?.failure && p.failure.timeoutMs === undefined)
      add("UNDECIDED_POLICY", "the selected failure policy has no timeout bound in milliseconds.");
    if (
      p?.retry &&
      (p.retry.maxAttempts === undefined ||
        p.retry.idempotency === "Unknown" ||
        (p.retry.idempotency === "Required" && !p.retry.key))
    )
      add("UNDECIDED_POLICY", "select a retry attempt bound and the idempotency requirement/key.");
    if (p?.delivery?.guarantee === "At most once" && (p.retry?.maxAttempts ?? 1) > 1)
      add("DELIVERY_CONFLICT", "at-most-once delivery conflicts with retry attempts above one.");
    if (
      p?.freshness &&
      p.freshness.invalidation !== "No cache" &&
      p.freshness.maxAgeSeconds === undefined
    )
      add("UNDECIDED_POLICY", "cache freshness needs a maximum age in seconds.");
    for (const [group, values] of Object.entries(p ?? {}))
      if (Object.values(values).includes("Unknown"))
        add("UNDECIDED_POLICY", `${group} has unknown choices; only complete applicable policies.`);
  }
  for (const dataset of model.datasets ?? []) {
    const add = (code: string, message: string) =>
      result.push({ code, message: `${dataset.name}: ${message}`, dataset: dataset.id });
    if (
      !dataset.owners.length ||
      !dataset.store ||
      dataset.tenant === "Unknown" ||
      dataset.retentionDays === undefined ||
      dataset.deletion === "Unknown" ||
      dataset.exportAccess === "Unknown"
    )
      add("UNDECIDED_DATA", "authority, store, tenancy or lifecycle/export policy is undecided.");
    for (const binding of model.bindings ?? []) {
      if (contractKey(binding.contract) !== contractKey(dataset.contract)) continue;
      const access = binding.policies?.access;
      if (
        dataset.tenant === "Tenant scoped" &&
        access &&
        ["Public", "Cross tenant"].includes(access.tenant)
      )
        result.push({
          code: "TENANT_CONFLICT",
          message: `${binding.name}: ${access.tenant} access conflicts with tenant-scoped dataset ${dataset.name}.`,
          binding: binding.id,
          dataset: dataset.id,
        });
      const consumer = model.interfaces?.find((item) => item.id === binding.required)?.owner;
      if (
        consumer &&
        ["read", "write"].includes(binding.role) &&
        !(binding.role === "read" ? dataset.readers : dataset.writers).some((owner) =>
          sameContractOwner(owner, consumer),
        )
      )
        result.push({
          code: "DATA_ACCESS_MISSING",
          message: `${binding.name}: ${binding.role} access is not assigned on ${dataset.name}.`,
          binding: binding.id,
          dataset: dataset.id,
        });
    }
  }
  for (const objective of model.objectives ?? []) {
    const temporal = !["throughput", "availability"].includes(objective.metric);
    if (
      objective.value === undefined ||
      !objective.unit ||
      !objective.boundary ||
      !objective.window
    )
      result.push({
        code: "UNDECIDED_OBJECTIVE",
        message: `${objective.name}: supply a value, unit, measurement boundary and window. This remains an unverified design target.`,
        objective: objective.id,
      });
    else if (
      (temporal && !["milliseconds", "seconds", "minutes", "days"].includes(objective.unit)) ||
      (objective.metric === "throughput" &&
        !["requests/second", "events/second"].includes(objective.unit)) ||
      (objective.metric === "availability" &&
        (objective.unit !== "percent" || objective.value > 100))
    )
      result.push({
        code: "OBJECTIVE_UNIT_CONFLICT",
        message: `${objective.name}: ${objective.metric} is incompatible with ${objective.value} ${objective.unit}.`,
        objective: objective.id,
      });
  }
  return result;
}
