/** Finite design declarations, never an authorization evaluator or credential source. */
import { z } from "zod";
import { contractTypeReferenceSchema } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

const exact = contractTypeReferenceSchema;
const named = { ...exact.shape, name: z.string().trim().min(1).max(120) };
export const backendPolicySelectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("unresolved"), reference: exact.optional() }),
  z.strictObject({ kind: z.literal("policy"), reference: exact }),
]);
export const backendRecheckSiteSchema = z.enum([
  "read",
  "write",
  "search",
  "bytes",
  "materialization",
  "delivery",
  "export",
  "job",
  "idempotent-replay",
]);
export type BackendRecheckSite = z.output<typeof backendRecheckSiteSchema>;
const condition = z.strictObject({
  operator: z.enum(["all", "any"]),
  clauses: z.array(idSchema).min(1).max(20),
});
export const backendPolicyClauseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: idSchema, kind: z.literal("authenticated") }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("owner"),
    field: idSchema,
    via: idSchema.optional(),
  }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("role"),
    authority: z.literal("persisted-role-store"),
    entity: exact,
    principal: idSchema,
    field: idSchema,
    values: z.array(idSchema).min(1).max(20),
  }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("membership"),
    scope: z.enum(["organization", "resource", "group"]),
    entity: exact,
    principal: idSchema,
    relation: idSchema,
    /** At most one forward to-one relation from the protected resource. */
    via: idSchema.optional(),
    active: z.strictObject({ field: idSchema, value: z.literal(true) }),
  }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("group-grant"),
    /** Bounded forward to-one path to the category; never policy recursion. */
    resourcePath: z.array(idSchema).max(3),
    subject: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("session-principal") }),
      z.strictObject({ kind: z.literal("resource-field"), field: idSchema }),
    ]),
    workspaceMembership: z.strictObject({
      entity: exact,
      principal: idSchema,
      active: z.strictObject({ field: idSchema, value: z.union([z.boolean(), idSchema]) }),
    }),
    grant: z.strictObject({
      entity: exact,
      resourceRelation: idSchema,
      groupRelation: idSchema,
      access: z.strictObject({ field: idSchema, values: z.array(idSchema).min(1).max(20) }),
    }),
    membership: z.strictObject({
      entity: exact,
      groupRelation: idSchema,
      principal: idSchema,
      active: z.strictObject({ field: idSchema, value: z.union([z.boolean(), idSchema]) }),
    }),
    /** Public categories still require current workspace membership. */
    public: z.strictObject({ field: idSchema, value: z.union([z.boolean(), idSchema]) }).optional(),
  }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("visibility"),
    via: idSchema.optional(),
    field: idSchema,
    value: z.union([z.boolean(), z.string().min(1).max(120), z.null()]),
  }),
  z.strictObject({
    id: idSchema,
    kind: z.literal("action"),
    actions: z.array(idSchema).min(1).max(20),
  }),
  z.strictObject({ id: idSchema, kind: z.literal("service-purpose"), purpose: idSchema }),
]);
export const backendAccessPolicySchema = z.strictObject({
  ...named,
  resource: exact,
  context: z.strictObject({
    identity: z.enum(["public", "session-principal", "verified-service"]),
    authentication: z.literal("server-established"),
    scope: z.enum(["global", "authorized-scope"]),
    correlation: z.literal("server-established"),
    service: z
      .strictObject({
        purpose: idSchema,
        authority: z.literal("server-service-identity"),
        scope: z.enum(["selected-resource", "authorized-scope"]),
        initiatingActor: z.literal("provenance-only"),
      })
      .optional(),
  }),
  default: z.literal("deny"),
  conflict: z.literal("deny-wins"),
  clauses: z.array(backendPolicyClauseSchema).max(20),
  rules: z
    .array(
      z.strictObject({
        id: idSchema,
        effect: z.enum(["allow", "deny"]),
        actions: z.array(idSchema).min(1).max(20),
        when: condition,
      }),
    )
    .max(20),
  projections: z
    .array(
      z.strictObject({
        id: idSchema,
        mode: z.enum(["read", "write"]),
        fields: z.array(idSchema).min(1).max(100),
        when: condition,
        unknownFields: z.literal("reject"),
        conditional: z
          .array(
            z.strictObject({
              field: idSchema,
              allow: z.array(condition).min(1).max(20),
              otherwise: z.enum(["null", "omit"]),
            }),
          )
          .max(100)
          .optional(),
      }),
    )
    .max(20),
  revocation: z.strictObject({
    strategy: z.literal("current-state"),
    cache: z.literal("none"),
    recheck: z.array(backendRecheckSiteSchema).max(9),
  }),
});
export type BackendAccessPolicy = z.output<typeof backendAccessPolicySchema>;
export const backendAccessBindingSchema = z.strictObject({
  ...named,
  target: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("operation"),
      contract: exact,
      operation: idSchema,
      owner: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("element"), id: idSchema }),
        z.strictObject({ kind: z.literal("component"), id: idSchema }),
      ]),
    }),
    z.strictObject({
      kind: z.literal("projection"),
      entity: exact,
      fields: z.array(idSchema).min(1).max(100),
    }),
  ]),
  resource: exact,
  policy: backendPolicySelectionSchema,
  action: idSchema,
  site: backendRecheckSiteSchema,
  projection: idSchema.optional(),
  /** Existing relationship access remains broader intent, checked separately in Review. */
  relationshipBinding: idSchema.optional(),
});
export type BackendAccessBinding = z.output<typeof backendAccessBindingSchema>;
