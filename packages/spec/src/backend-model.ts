/** Versioned persistence intent. Contracts own types; datasets own authority and stores. */
import { z } from "zod";
import { backendLifecycleSchema, backendOperationSchema } from "./backend-behavior-model.ts";
import {
  collectBackendCapabilityDependencies,
  mapBackendCapabilityConfigs,
} from "./backend-capability-configs.ts";
import { backendCapabilityConfigSchema } from "./backend-capability-configs-model.ts";
import { collectBackendEffectDependencies, mapBackendEffects } from "./backend-effects.ts";
import { backendEffectSchema, backendHookSchema } from "./backend-effects-model.ts";
import { backendImplementationSchema } from "./backend-implementation-model.ts";
import {
  backendAccessBindingSchema,
  backendAccessPolicySchema,
  backendPolicySelectionSchema,
} from "./backend-policy-model.ts";
import { mapProtocolPlan, protocolReferences } from "./backend-protocol-model.ts";
import { contractTypeReferenceSchema } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

export const backendReferenceSchema = contractTypeReferenceSchema;
export type BackendReference = z.output<typeof backendReferenceSchema>;
const named = {
  ...backendReferenceSchema.shape,
  name: z.string().trim().min(1).max(120),
};
const fields = z.array(idSchema).min(1).max(10);
export const backendFieldReferenceSchema = z.strictObject({
  entity: backendReferenceSchema,
  field: idSchema,
});
export const backendStorageSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("scalar") }),
  z.strictObject({ kind: z.literal("json"), query: z.literal("opaque") }),
  z.strictObject({
    kind: z.literal("money"),
    minorUnits: idSchema,
    currency: idSchema,
    currencyStorageId: idSchema,
  }),
]);
export const backendEntitySchema = z.strictObject({
  ...named,
  dataset: idSchema,
  contract: backendReferenceSchema,
  /** Physical identities survive display renames and outer composition remapping. */
  storageId: idSchema,
  fields: z
    .array(
      z.strictObject({
        field: idSchema,
        storageId: idSchema,
        required: z.boolean(),
        nullable: z.boolean(),
        storage: backendStorageSchema,
        serverOwned: z.enum(["id", "clock", "principal", "scope", "version"]).optional(),
      }),
    )
    .min(1)
    .max(100),
  primaryKey: fields,
  scope: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("global") }),
    z.strictObject({ kind: z.literal("field"), field: idSchema }),
  ]),
  relations: z
    .array(
      z.strictObject({
        id: idSchema,
        target: backendReferenceSchema,
        fields: z
          .array(z.strictObject({ source: idSchema, target: idSchema }))
          .min(1)
          .max(10),
        cardinality: z.enum(["many-to-one", "one-to-one"]),
        ownership: z.enum(["reference", "owned"]),
        scope: z.enum(["same-scope", "global-target"]),
        onDelete: z.enum(["restrict", "cascade", "set-null"]),
      }),
    )
    .max(30)
    .default([]),
  uniqueKeys: z
    .array(
      z.strictObject({
        id: idSchema,
        fields,
        scope: z.enum(["global", "entity-scope"]),
        nulls: z.enum(["distinct", "not-distinct", "forbidden"]),
      }),
    )
    .max(30)
    .default([]),
  indexes: z
    .array(
      z.strictObject({
        id: idSchema,
        fields: z
          .array(z.strictObject({ field: idSchema, direction: z.enum(["asc", "desc"]) }))
          .min(1)
          .max(10),
      }),
    )
    .max(30)
    .default([]),
});
export type BackendEntity = z.output<typeof backendEntitySchema>;
export const backendInvariantSchema = z.discriminatedUnion("strategy", [
  z.strictObject({
    id: idSchema,
    strategy: z.literal("required-child"),
    child: backendReferenceSchema,
    relation: idSchema,
    minimum: z.int().min(1).max(1000),
    maximum: z.int().min(1).max(1000),
  }),
  z.strictObject({
    id: idSchema,
    strategy: z.literal("nonnegative"),
    value: backendFieldReferenceSchema,
  }),
  z.strictObject({
    id: idSchema,
    strategy: z.literal("field-comparison"),
    left: backendFieldReferenceSchema,
    operator: z.enum(["eq", "lte", "gte"]),
    right: backendFieldReferenceSchema,
  }),
  z.strictObject({
    id: idSchema,
    strategy: z.literal("inventory-balance"),
    stock: backendFieldReferenceSchema,
    reserved: backendFieldReferenceSchema,
    relation: idSchema,
  }),
]);
export const backendAggregateSchema = z.strictObject({
  ...named,
  root: backendReferenceSchema,
  children: z.array(backendReferenceSchema).max(30),
  owner: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("element"), id: idSchema }),
    z.strictObject({ kind: z.literal("component"), id: idSchema }),
  ]),
  store: idSchema,
  concurrency: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("optimistic"), version: backendFieldReferenceSchema }),
    z.strictObject({
      kind: z.literal("row-lock"),
      entities: z.array(backendReferenceSchema).min(1).max(31),
      order: z.literal("entity-id-primary-key"),
    }),
  ]),
  invariants: z.array(backendInvariantSchema).max(20),
});
export type BackendAggregate = z.output<typeof backendAggregateSchema>;
/** Query aliases and output/filter IDs are local, never graph identities. */
export const backendQueryFieldSchema = z.strictObject({ source: idSchema, field: idSchema });
export const backendQuerySchema = z.strictObject({
  ...named,
  root: backendReferenceSchema,
  joins: z
    .array(
      z.strictObject({
        id: idSchema,
        from: idSchema,
        relation: idSchema,
        kind: z.enum(["inner", "left"]),
      }),
    )
    .max(3)
    .default([]),
  filters: z
    .array(
      z.strictObject({
        id: idSchema,
        field: backendQueryFieldSchema,
        comparisons: z
          .array(z.enum(["eq", "ne", "lt", "lte", "gt", "gte", "in", "is-null", "prefix"]))
          .min(1)
          .max(9),
        maxValues: z.int().min(1).max(100).optional(),
      }),
    )
    .max(20)
    .default([]),
  projection: z
    .array(z.strictObject({ id: idSchema, field: backendQueryFieldSchema }))
    .min(1)
    .max(100),
  order: z
    .array(
      z.strictObject({
        field: backendQueryFieldSchema,
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .min(1)
    .max(10),
  limit: z.strictObject({
    default: z.int().min(1).max(100).default(25),
    maximum: z.int().min(1).max(100),
  }),
  cursor: z.strictObject({
    kind: z.literal("keyset"),
    fields: z.array(backendQueryFieldSchema).min(1).max(10),
  }),
  accessPolicy: backendPolicySelectionSchema,
  accessProjection: idSchema.optional(),
  accessSite: z.enum(["read", "search", "export"]).optional(),
  /** Joined sources need their own current policy, even when absent from the output. */
  sourcePolicies: z
    .array(
      z.strictObject({
        source: idSchema,
        policy: backendPolicySelectionSchema,
        projection: idSchema.optional(),
      }),
    )
    .max(3)
    .optional(),
  freshness: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("authoritative") }),
    z.strictObject({
      kind: z.literal("bounded-staleness"),
      binding: idSchema,
      maxAgeSeconds: z.int().min(1).max(31_536_000),
    }),
  ]),
});
export type BackendQuery = z.output<typeof backendQuerySchema>;
export const backendModelSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entities: z.array(backendEntitySchema).max(100).default([]),
  aggregates: z.array(backendAggregateSchema).max(100).default([]),
  // Preserve P63a serialized models that predate queries without adding an empty collection.
  queries: z.array(backendQuerySchema).max(100).optional(),
  accessPolicies: z.array(backendAccessPolicySchema).max(100).optional(),
  accessBindings: z.array(backendAccessBindingSchema).max(200).optional(),
  lifecycles: z.array(backendLifecycleSchema).max(100).optional(),
  operations: z.array(backendOperationSchema).max(200).optional(),
  effects: z.array(backendEffectSchema).max(100).optional(),
  hooks: z.array(backendHookSchema).max(100).optional(),
  capabilityConfigs: z.array(backendCapabilityConfigSchema).max(100).optional(),
  implementations: z.array(backendImplementationSchema).max(500).optional(),
});
export type BackendModel = z.output<typeof backendModelSchema>;

export const backendCollections = [
  "entities",
  "aggregates",
  "queries",
  "accessPolicies",
  "accessBindings",
  "lifecycles",
  "operations",
  "effects",
  "hooks",
  "capabilityConfigs",
  "implementations",
] as const;
export const backendDeclarations = (
  model: BackendModel | undefined,
): { id: string; version: string; name: string }[] => [
  ...(model?.entities ?? []),
  ...(model?.aggregates ?? []),
  ...(model?.queries ?? []),
  ...(model?.accessPolicies ?? []),
  ...(model?.accessBindings ?? []),
  ...(model?.lifecycles ?? []),
  ...(model?.operations ?? []),
  ...(model?.effects ?? []),
  ...(model?.hooks ?? []),
  ...(model?.capabilityConfigs ?? []),
  ...(model?.implementations ?? []),
];

/** Local field, relation, invariant and storage IDs are never outer graph identities. */
export function mapBackendModel(model: BackendModel, ids: Record<string, string>): BackendModel {
  const id = (value: string) => ids[value] ?? value;
  const exact = <T extends BackendReference>(value: T): T => ({ ...value, id: id(value.id) });
  const field = <T extends { entity: BackendReference }>(value: T): T => ({
    ...value,
    entity: exact(value.entity),
  });
  const source = (v: import("./backend-behavior-model.ts").BackendValueSource) =>
    v.kind === "current" ? field(v) : v;
  const guard = (g: import("./backend-behavior-model.ts").BackendGuard) =>
    g.kind === "compare"
      ? { ...g, left: source(g.left), right: source(g.right) }
      : { ...g, value: source(g.value) };
  return {
    ...model,
    ...mapBackendEffects(model, ids),
    ...mapBackendCapabilityConfigs(model, ids),
    ...(model.implementations
      ? {
          implementations: model.implementations.map((v) => ({
            ...v,
            id: id(v.id),
            target: { ...v.target, id: id(v.target.id) },
            obligations: v.obligations.map((o) => ({ ...o, id: id(o.id) })),
            hooks: v.hooks.map((h) => ({ ...h, hook: exact(h.hook) })),
            ...(v.store ? { store: id(v.store) } : {}),
            ...(v.environment
              ? {
                  environment: {
                    ...v.environment,
                    adapterBinding: id(v.environment.adapterBinding),
                  },
                }
              : {}),
          })),
        }
      : {}),
    ...(model.lifecycles
      ? {
          lifecycles: model.lifecycles.map((l) => ({
            ...l,
            id: id(l.id),
            aggregate: exact(l.aggregate),
            state: field(l.state),
            guards: l.guards.map(guard),
          })),
        }
      : {}),
    ...(model.operations
      ? {
          operations: model.operations.map((o) => ({
            ...o,
            id: id(o.id),
            ...(o.protocol ? { protocol: mapProtocolPlan(o.protocol, ids) } : {}),
            target: {
              ...o.target,
              contract: exact(o.target.contract),
              owner: exactOwner(o.target.owner),
            },
            aggregate: exact(o.aggregate),
            ...(o.identity
              ? { identity: o.identity.map((v) => ({ ...v, value: source(v.value) })) }
              : {}),
            access: {
              ...o.access,
              policy: o.access.policy.reference
                ? { ...o.access.policy, reference: exact(o.access.policy.reference) }
                : o.access.policy,
              ...(o.access.participants
                ? {
                    participants: o.access.participants.map((p) => ({
                      ...p,
                      entity: exact(p.entity),
                      policy: p.policy.reference
                        ? { ...p.policy, reference: exact(p.policy.reference) }
                        : p.policy,
                    })),
                  }
                : {}),
            },
            ...(o.query ? { query: exact(o.query) } : {}),
            ...(o.queryInputs
              ? {
                  queryInputs: o.queryInputs.map((v) => ({
                    ...v,
                    ...(v.value ? { value: source(v.value) } : {}),
                  })),
                }
              : {}),
            guards: o.guards.map(guard),
            writes: o.writes.map(field),
            transaction: {
              ...o.transaction,
              store: id(o.transaction.store),
              participants: o.transaction.participants.map(exact),
            },
            actions: o.actions.map((a) =>
              a.kind === "transition"
                ? {
                    ...a,
                    lifecycle: exact(a.lifecycle),
                    ...(a.key ? { key: a.key.map((v) => ({ ...v, value: source(v.value) })) } : {}),
                  }
                : a.kind === "hook"
                  ? {
                      ...a,
                      hook: exact(a.hook),
                      input: a.input.map((v) => ({ ...v, value: source(v.value) })),
                    }
                  : a.kind === "capability"
                    ? {
                        ...a,
                        strategy: {
                          ...a.strategy,
                          result: exact(a.strategy.result),
                        },
                        input: a.input.map((v) => ({ ...v, value: source(v.value) })),
                      }
                    : {
                        ...a,
                        entity: exact(a.entity),
                        ...(a.key
                          ? { key: a.key.map((v) => ({ ...v, value: source(v.value) })) }
                          : {}),
                        values: a.values.map((v) => ({ ...v, value: source(v.value) })),
                      },
            ),
            outcomes: o.outcomes.map((v) => ({
              ...v,
              values: v.values.map((m) => ({ ...m, value: source(m.value) })),
            })),
          })),
        }
      : {}),
    ...(model.accessPolicies
      ? {
          accessPolicies: model.accessPolicies.map((p) => ({
            ...p,
            id: id(p.id),
            resource: exact(p.resource),
            clauses: p.clauses.map((c) =>
              c.kind === "group-grant"
                ? {
                    ...c,
                    grant: { ...c.grant, entity: exact(c.grant.entity) },
                    membership: { ...c.membership, entity: exact(c.membership.entity) },
                    workspaceMembership: {
                      ...c.workspaceMembership,
                      entity: exact(c.workspaceMembership.entity),
                    },
                  }
                : "entity" in c
                  ? { ...c, entity: exact(c.entity) }
                  : c,
            ),
          })),
        }
      : {}),
    ...(model.accessBindings
      ? {
          accessBindings: model.accessBindings.map((b) => ({
            ...b,
            id: id(b.id),
            resource: exact(b.resource),
            policy: b.policy.reference
              ? { ...b.policy, reference: exact(b.policy.reference) }
              : b.policy,
            ...(b.relationshipBinding ? { relationshipBinding: id(b.relationshipBinding) } : {}),
            target:
              b.target.kind === "operation"
                ? {
                    ...b.target,
                    contract: exact(b.target.contract),
                    owner: exactOwner(b.target.owner),
                  }
                : { ...b.target, entity: exact(b.target.entity) },
          })),
        }
      : {}),
    ...(model.queries
      ? {
          queries: model.queries.map((q) => ({
            ...q,
            id: id(q.id),
            root: exact(q.root),
            accessPolicy: q.accessPolicy.reference
              ? { ...q.accessPolicy, reference: exact(q.accessPolicy.reference) }
              : q.accessPolicy,
            ...(q.sourcePolicies
              ? {
                  sourcePolicies: q.sourcePolicies.map((s) => ({
                    ...s,
                    policy: s.policy.reference
                      ? { ...s.policy, reference: exact(s.policy.reference) }
                      : s.policy,
                  })),
                }
              : {}),
            freshness:
              q.freshness.kind === "bounded-staleness"
                ? { ...q.freshness, binding: id(q.freshness.binding) }
                : q.freshness,
          })),
        }
      : {}),
    entities: model.entities.map((e) => ({
      ...e,
      id: id(e.id),
      dataset: id(e.dataset),
      contract: exact(e.contract),
      relations: e.relations.map((r) => ({ ...r, target: exact(r.target) })),
    })),
    aggregates: model.aggregates.map((a) => ({
      ...a,
      id: id(a.id),
      root: exact(a.root),
      children: a.children.map(exact),
      owner: exactOwner(a.owner),
      store: id(a.store),
      concurrency:
        a.concurrency.kind === "optimistic"
          ? { ...a.concurrency, version: field(a.concurrency.version) }
          : {
              ...a.concurrency,
              entities: a.concurrency.entities
                .map(exact)
                .sort((a, b) =>
                  `${a.id}@${a.version}` < `${b.id}@${b.version}`
                    ? -1
                    : `${a.id}@${a.version}` > `${b.id}@${b.version}`
                      ? 1
                      : 0,
                ),
            },
      invariants: a.invariants.map((i) => {
        switch (i.strategy) {
          case "required-child":
            return { ...i, child: exact(i.child) };
          case "nonnegative":
            return { ...i, value: field(i.value) };
          case "field-comparison":
            return { ...i, left: field(i.left), right: field(i.right) };
          case "inventory-balance":
            return { ...i, stock: field(i.stock), reserved: field(i.reserved) };
        }
        return i;
      }),
    })),
  };
  function exactOwner<T extends { id: string }>(value: T): T {
    return { ...value, id: id(value.id) };
  }
}

/** Extraction closure follows authority, exact types, relations and aggregate participants. */
export function collectBackendDependencies(
  model: BackendModel | undefined,
  keep: Set<string>,
): void {
  if (!model) return;
  collectBackendEffectDependencies(model, keep);
  collectBackendCapabilityDependencies(model, keep);
  for (const v of model.implementations ?? []) {
    const refs = [v.target.id, ...v.obligations.map((o) => o.id)];
    if (refs.some((id) => keep.has(id))) keep.add(v.id);
    if (keep.has(v.id))
      for (const id of [
        ...refs,
        ...v.hooks.map((h) => h.hook.id),
        ...(v.store ? [v.store] : []),
        ...(v.environment ? [v.environment.adapterBinding] : []),
      ])
        keep.add(id);
  }
  for (const l of model.lifecycles ?? []) {
    if (keep.has(l.aggregate.id) || keep.has(l.state.entity.id)) keep.add(l.id);
    if (keep.has(l.id)) {
      keep.add(l.aggregate.id);
      keep.add(l.state.entity.id);
      for (const g of l.guards)
        for (const v of g.kind === "compare" ? [g.left, g.right] : [g.value])
          if (v.kind === "current") keep.add(v.entity.id);
    }
  }
  for (const o of model.operations ?? []) {
    if (keep.has(o.target.owner.id) || keep.has(o.aggregate.id)) keep.add(o.id);
    if (!keep.has(o.id)) continue;
    if (o.protocol) {
      for (const r of protocolReferences(o.protocol)) keep.add(r.id);
      if (o.protocol.provider) {
        keep.add(o.protocol.provider.binding);
        keep.add(o.protocol.provider.interface);
      }
    }
    for (const v of [
      o.target.owner.id,
      o.target.contract.id,
      o.aggregate.id,
      o.transaction.store,
      ...o.transaction.participants.map((p) => p.id),
      ...(o.query ? [o.query.id] : []),
      ...(o.access.policy.reference ? [o.access.policy.reference.id] : []),
    ])
      keep.add(v);
    for (const p of o.access.participants ?? []) {
      keep.add(p.entity.id);
      if (p.policy.reference) keep.add(p.policy.reference.id);
    }
    const sources = [
      ...(o.identity ?? []).map((v) => v.value),
      ...(o.queryInputs ?? []).flatMap((v) => (v.value ? [v.value] : [])),
      ...o.guards.flatMap((g) => (g.kind === "compare" ? [g.left, g.right] : [g.value])),
      ...o.outcomes.flatMap((o) => o.values.map((v) => v.value)),
    ];
    for (const a of o.actions) {
      if (a.kind === "transition") {
        keep.add(a.lifecycle.id);
        sources.push(...(a.key ?? []).map((v) => v.value));
      } else if (a.kind === "hook") {
        keep.add(a.hook.id);
        sources.push(...a.input.map((v) => v.value));
      } else if (a.kind === "capability") {
        keep.add(a.strategy.result.id);
        sources.push(...a.input.map((v) => v.value));
      } else {
        keep.add(a.entity.id);
        sources.push(...a.values.map((v) => v.value), ...(a.key ?? []).map((v) => v.value));
      }
    }
    for (const v of sources) if (v.kind === "current") keep.add(v.entity.id);
    for (const w of o.writes) keep.add(w.entity.id);
  }
  for (const p of model.accessPolicies ?? []) {
    if (keep.has(p.resource.id)) keep.add(p.id);
    if (!keep.has(p.id)) continue;
    keep.add(p.resource.id);
    for (const c of p.clauses) {
      if ("entity" in c) keep.add(c.entity.id);
      if (c.kind === "group-grant")
        for (const r of [c.grant, c.membership, c.workspaceMembership]) keep.add(r.entity.id);
    }
  }
  for (const b of model.accessBindings ?? []) {
    const targets = [
      b.resource.id,
      b.target.kind === "operation" ? b.target.owner.id : b.target.entity.id,
    ];
    if (targets.some((v) => keep.has(v))) keep.add(b.id);
    if (!keep.has(b.id)) continue;
    for (const target of targets) keep.add(target);
    if (b.target.kind === "operation") keep.add(b.target.contract.id);
    if (b.policy.reference) keep.add(b.policy.reference.id);
    if (b.relationshipBinding) keep.add(b.relationshipBinding);
  }
  for (const q of model.queries ?? []) {
    if (keep.has(q.root.id)) keep.add(q.id);
    if (!keep.has(q.id)) continue;
    keep.add(q.root.id);
    if (q.accessPolicy.reference) keep.add(q.accessPolicy.reference.id);
    for (const s of q.sourcePolicies ?? []) if (s.policy.reference) keep.add(s.policy.reference.id);
    if (q.freshness.kind === "bounded-staleness") keep.add(q.freshness.binding);
  }
  for (const e of model.entities) {
    if (keep.has(e.dataset)) keep.add(e.id);
    if (!keep.has(e.id)) continue;
    keep.add(e.dataset);
    keep.add(e.contract.id);
    for (const r of e.relations) keep.add(r.target.id);
  }
  for (const a of model.aggregates) {
    const participants = [a.root, ...a.children];
    if (keep.has(a.owner.id) || participants.some((e) => keep.has(e.id))) keep.add(a.id);
    if (!keep.has(a.id)) continue;
    keep.add(a.owner.id);
    keep.add(a.store);
    for (const e of participants) keep.add(e.id);
  }
}
