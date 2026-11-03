/** Versioned persistence intent. Contracts own types; datasets own authority and stores. */
import { z } from "zod";
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
/** Queries are deliberately added by P63b; no permissive placeholder accepts future semantics. */
export const backendModelSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entities: z.array(backendEntitySchema).max(100).default([]),
  aggregates: z.array(backendAggregateSchema).max(50).default([]),
});
export type BackendModel = z.output<typeof backendModelSchema>;

export const backendCollections = ["entities", "aggregates"] as const;
export const backendDeclarations = (
  model: BackendModel | undefined,
): (BackendEntity | BackendAggregate)[] => [
  ...(model?.entities ?? []),
  ...(model?.aggregates ?? []),
];

/** Local field, relation, invariant and storage IDs are never outer graph identities. */
export function mapBackendModel(model: BackendModel, ids: Record<string, string>): BackendModel {
  const id = (value: string) => ids[value] ?? value;
  const exact = <T extends BackendReference>(value: T): T => ({ ...value, id: id(value.id) });
  const field = <T extends { entity: BackendReference }>(value: T): T => ({
    ...value,
    entity: exact(value.entity),
  });
  return {
    ...model,
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
