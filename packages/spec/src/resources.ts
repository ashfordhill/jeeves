import { z } from "zod";
import { idSchema } from "./ids.ts";

// Names become SQL identifiers, JSON properties and operation IDs. IDs remain storage identity.
const nameSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]{0,47}$/, "Use a lower camel case identifier");
export const resourceFieldSchema = z.discriminatedUnion("type", [
  z.strictObject({
    id: idSchema,
    name: nameSchema,
    type: z.literal("text"),
    required: z.boolean(),
    maxLength: z.int().min(1).max(10000),
  }),
  z.strictObject({
    id: idSchema,
    name: nameSchema,
    type: z.literal("http-url"),
    required: z.boolean(),
  }),
  z.strictObject({
    id: idSchema,
    name: nameSchema,
    type: z.literal("timestamp"),
    generated: z.literal("created-at"),
  }),
]);
export const resourceSchema = z.strictObject({
  id: idSchema,
  name: nameSchema,
  access: z.enum(["owner", "internal"]),
  fields: z.array(resourceFieldSchema).max(100),
  belongsTo: z
    .array(z.strictObject({ id: idSchema, resource: idSchema, required: z.literal(true) }))
    .max(20),
  operations: z.array(z.enum(["create", "read", "list", "update"])).max(4),
});
const jsonSchema = z.record(z.string(), z.json());
const parameterSchema = z.strictObject({
  name: z.string().min(1),
  in: z.enum(["path", "query", "header"]),
  required: z.boolean(),
  schema: jsonSchema,
  example: z.json().optional(),
});
const responseSchema = z.strictObject({
  description: z.string().min(1),
  content: z
    .record(z.string(), z.strictObject({ schema: jsonSchema, example: z.json().optional() }))
    .optional(),
  headers: z
    .record(z.string(), z.strictObject({ required: z.boolean().optional(), schema: jsonSchema }))
    .optional(),
});
/** An extension's exact production dependency, added to the owning service's package.json. */
export const extensionDependencySchema = z.strictObject({
  name: z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
});
export const resourceConfigSchema = z
  .strictObject({
    storeConnection: idSchema
      .optional()
      .meta({ description: "The owning service's selected uses-database connection" }),
    resources: z.array(resourceSchema).max(50),
    acceptanceCases: z.array(z.string().min(1)).default([]),
    extensions: z
      .array(
        z.strictObject({
          id: idSchema,
          operationId: nameSchema,
          method: z.literal("GET"),
          path: z
            .string()
            .regex(
              /^\/(?:[a-zA-Z0-9_-]+|\{[a-zA-Z][a-zA-Z0-9]*\})(?:\/(?:[a-zA-Z0-9_-]+|\{[a-zA-Z][a-zA-Z0-9]*\}))*$/,
            ),
          access: z.enum(["public", "owner"]),
          acceptance: z.array(z.string().min(1)).min(1),
          notes: z.string().min(1).max(20000),
          dependencies: z.array(extensionDependencySchema).optional(),
          contract: z.strictObject({
            parameters: z.array(parameterSchema).default([]),
            responses: z.record(z.string().regex(/^[1-5][0-9]{2}$/), responseSchema),
          }),
        }),
      )
      .max(50),
  })
  .superRefine((model, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const unique = (values: string[], what: string) => {
      if (new Set(values).size !== values.length) issue(`Duplicate ${what}`);
    };
    unique(
      model.resources.map((r) => r.id),
      "resource ID",
    );
    unique(
      model.resources.map((r) => r.name.toLowerCase()),
      "resource name",
    );
    unique(
      model.extensions.map((e) => e.id),
      "extension ID",
    );
    const ids = model.resources.map((r) => r.id);
    const operationIds: string[] = ["registerAccount", "login", "logout", "readSession"];
    const routes: string[] = [];
    for (const r of model.resources) {
      unique(
        [...r.fields.map((f) => f.id), ...r.belongsTo.map((b) => b.id)],
        `field/relationship ID in ${r.id}`,
      );
      unique(
        r.fields.map((f) => f.name.toLowerCase()),
        `field name in ${r.id}`,
      );
      unique(
        r.belongsTo.map((b) => b.resource),
        `relationship target in ${r.id}`,
      );
      unique(r.operations, `operation in ${r.id}`);
      const reserved = [
        "id",
        "ownerid",
        "createdat",
        "owner_id",
        "created_at",
        "__proto__",
        "constructor",
        "prototype",
        ...r.belongsTo.map((b) =>
          `${model.resources.find((t) => t.id === b.resource)?.name}id`.toLowerCase(),
        ),
      ];
      for (const f of r.fields)
        if (reserved.includes(f.name.toLowerCase())) issue(`${r.id}.${f.name} is reserved`);
      if (["appuser", "appsession", "jeevesmigrations"].includes(r.name.toLowerCase()))
        issue(`${r.name} is reserved`);
      if (r.access === "internal" && r.operations.length)
        issue(`Internal resource ${r.id} cannot expose CRUD`);
      for (const b of r.belongsTo)
        if (!ids.includes(b.resource)) issue(`${r.id}.${b.id} has unknown target ${b.resource}`);
      for (const op of r.operations) {
        operationIds.push(`${op}${r.name[0]?.toUpperCase()}${r.name.slice(1)}`);
        routes.push(
          `${{ create: "POST", list: "GET", read: "GET", update: "PATCH" }[op]} /api/${r.name}${op === "read" || op === "update" ? "/{}" : ""}`,
        );
      }
    }
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) {
        issue(`Required relationship cycle at ${id}`);
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      for (const b of model.resources.find((r) => r.id === id)?.belongsTo ?? []) visit(b.resource);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of ids) visit(id);
    for (const e of model.extensions) {
      if (
        ["/auth", "/health", "/ready", "/openapi.json", "/_jeeves"].some(
          (path) => e.path === path || e.path.startsWith(path + "/"),
        )
      )
        issue(`${e.id} collides with a runtime route`);
      unique(
        [...e.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1] ?? ""),
        `path parameter in ${e.id}`,
      );
      unique(
        e.contract.parameters.map((p) => `${p.in}:${p.name.toLowerCase()}`),
        `parameter in ${e.id}`,
      );
      for (const p of e.contract.parameters)
        if (p.in === "path" && !e.path.includes(`{${p.name}}`))
          issue(`${e.id} has a path parameter absent from its route: ${p.name}`);
      operationIds.push(e.operationId);
      routes.push(`${e.method} ${e.path.replace(/\{[^}]+\}/g, "{}")}`);
      if (!Object.keys(e.contract.responses).some((s) => /^[23]/.test(s)))
        issue(`${e.id} needs a success response contract`);
      for (const ref of e.acceptance)
        if (!model.acceptanceCases.includes(ref))
          issue(`${e.id} has unknown acceptance reference ${ref}`);
      for (const match of e.path.matchAll(/\{([^}]+)\}/g))
        if (
          !e.contract.parameters.some((p) => p.in === "path" && p.name === match[1] && p.required)
        )
          issue(`${e.id} needs required path parameter ${match[1]}`);
    }
    unique(operationIds, "operation ID");
    unique(routes, "operation route");
  });
export type ResourceConfig = z.output<typeof resourceConfigSchema>;
export type Resource = z.output<typeof resourceSchema>;
export type ResourceField = z.output<typeof resourceFieldSchema>;

export function resourceConfigJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(resourceConfigSchema, { io: "input" });
}

/** Input validation compiled into the generated contract; the runtime consumes JSON Schema. */
export function resourceInputSchema(resource: Resource, model: ResourceConfig): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const field of resource.fields) {
    if (field.type === "timestamp") continue;
    let schema: z.ZodType =
      field.type === "text"
        ? z.string().max(field.maxLength)
        : z
            .string()
            .max(8192)
            .url()
            .regex(
              /^[hH][tT][tT][pP][sS]?:\/\/(?![^/?#]*@)/,
              "Use an absolute HTTP/HTTPS URL without credentials",
            );
    if (!field.required) schema = schema.nullable().optional();
    shape[field.name] = schema;
  }
  for (const relation of resource.belongsTo)
    shape[`${model.resources.find((r) => r.id === relation.resource)?.name}Id`] = z.uuid();
  return z.strictObject(shape);
}

/** Fixed account contract for the selected server-session implementation. */
export const sessionCredentialsSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export const sessionIdentitySchema = z.strictObject({
  id: z.uuid(),
  csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
});
