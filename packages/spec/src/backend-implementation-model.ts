/** Registered declarations describe availability; they never constitute observed evidence. */
import { z } from "zod";
import { backendRecheckSiteSchema } from "./backend-policy-model.ts";
import { contractTypeReferenceSchema as exact } from "./contract-shapes.ts";
import { idSchema, templateRefSchema } from "./ids.ts";

export const implementationObligationKindSchema = z.enum([
  "container",
  "component",
  "operation",
  "connection",
  "component-relationship",
  "binding",
  "dataset",
  "entities",
  "aggregates",
  "queries",
  "accessPolicies",
  "accessBindings",
  "lifecycles",
  "effects",
  "hooks",
  "capabilityConfigs",
  "contract",
]);
export const implementationObligationSchema = z.strictObject({
  kind: implementationObligationKindSchema,
  id: idSchema,
  version: exact.shape.version.optional(),
});
export type ImplementationObligation = z.output<typeof implementationObligationSchema>;
const scalar = z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]);
/** Literal paths in the documented typed projection. * means one array item; never eval. */
const path = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[a-zA-Z][a-zA-Z0-9-]*(?:\.(?:[a-zA-Z][a-zA-Z0-9-]*|\*|length))*$/);
export const capabilityOptionSchema = z.strictObject({
  path,
  support: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("values"), values: z.array(scalar).min(1).max(100) }),
    z.strictObject({
      kind: z.literal("range"),
      minimum: z.number().finite(),
      maximum: z.number().finite(),
    }),
    z.strictObject({
      kind: z.literal("scalar"),
      type: z.enum(["text", "integer", "boolean", "null"]),
      maximumLength: z.int().min(1).max(16000).optional(),
    }),
    z.strictObject({ kind: z.literal("hook"), hook: idSchema }),
  ]),
});
export const backendCapabilityDescriptorSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    ...exact.shape,
    name: z.string().trim().min(1).max(120),
    targets: z
      .array(
        z.enum(["container", "component", "operation", "connection", "component-relationship"]),
      )
      .min(1)
      .max(5),
    provides: z
      .array(
        z.strictObject({
          kind: implementationObligationKindSchema,
          shapes: z
            .array(
              z.enum([
                "text",
                "integer",
                "boolean",
                "uuid",
                "timestamp",
                "object",
                "array",
                "map",
                "tagged-union",
                "ref",
                "unresolved",
                "number",
                "http-url",
              ]),
            )
            .max(13),
          options: z.array(capabilityOptionSchema).max(500),
        }),
      )
      .min(1)
      .max(18),
    requires: z.strictObject({
      hostRoles: z
        .array(z.enum(["service", "frontend", "library", "database", "worker", "external"]))
        .max(6),
      hostTemplates: z.array(templateRefSchema).max(20),
      storeTemplates: z.array(templateRefSchema).max(20),
      transports: z.array(z.string().trim().min(1).max(80)).max(20),
      context: z
        .array(
          z.enum([
            "public",
            "session-principal",
            "verified-service",
            "authorized-scope",
            "correlation",
          ]),
        )
        .max(5),
      revocation: z.array(backendRecheckSiteSchema).max(9),
    }),
    dependencies: z
      .array(z.strictObject({ template: templateRefSchema, capability: exact }))
      .max(30),
    conflicts: z.array(z.strictObject({ template: templateRefSchema, capability: exact })).max(30),
    hooks: z
      .array(
        z.strictObject({
          id: idSchema,
          input: exact,
          output: exact,
          error: exact,
          execution: z.enum(["pure", "effectful"]),
        }),
      )
      .max(30),
    evidencePackIds: z.array(idSchema).min(1).max(30),
    origin: z.strictObject({
      kind: z.enum(["template", "library", "adapter"]),
      package: z.string().trim().min(1).max(200),
      version: templateRefSchema.shape.version,
    }),
  })
  .superRefine((d, ctx) => {
    const unique = (items: string[], field: string) => {
      if (new Set(items).size !== items.length)
        ctx.addIssue({ code: "custom", path: [field], message: "Descriptor keys must be unique." });
    };
    unique(
      d.provides.map((p) => p.kind),
      "provides",
    );
    unique(
      d.hooks.map((h) => h.id),
      "hooks",
    );
    for (const p of d.provides) {
      unique(
        p.options.map((o) => o.path),
        "provides",
      );
      for (const o of p.options) {
        if (o.support.kind === "range" && o.support.minimum > o.support.maximum)
          ctx.addIssue({
            code: "custom",
            path: ["provides"],
            message: "An option range must be ordered.",
          });
        if (
          o.support.kind === "hook" &&
          !d.hooks.some((h) => o.support.kind === "hook" && h.id === o.support.hook)
        )
          ctx.addIssue({
            code: "custom",
            path: ["provides"],
            message: "Option hook must name an exact descriptor hook.",
          });
      }
    }
  });
export type BackendCapabilityDescriptor = z.output<typeof backendCapabilityDescriptorSchema>;
export const backendImplementationTargetSchema = implementationObligationSchema.extend({
  kind: z.enum(["container", "component", "operation", "connection", "component-relationship"]),
});
export const backendImplementationSchema = z.strictObject({
  ...exact.shape,
  name: z.string().trim().min(1).max(120),
  target: backendImplementationTargetSchema,
  template: templateRefSchema,
  capability: exact,
  store: idSchema.optional(),
  /** Exact model obligations only. One component never implicitly supplies its host. */
  obligations: z.array(implementationObligationSchema).max(200),
  hooks: z.array(z.strictObject({ slot: idSchema, hook: exact })).max(30),
  environment: z
    .strictObject({
      mode: z.enum(["fixture", "production"]),
      adapterBinding: idSchema,
      configurationId: idSchema,
      credentialId: idSchema.optional(),
    })
    .optional(),
});
export type BackendImplementation = z.output<typeof backendImplementationSchema>;
