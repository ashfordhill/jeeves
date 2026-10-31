import { z } from "zod";

const id = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
  .max(63);
const name = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]{0,47}$/)
  .refine(
    (value) =>
      !["id", "ownerid", "createdat", "constructor", "prototype", "__proto__"].includes(
        value.toLowerCase(),
      ),
    "Reserved field name",
  );
const label = z.string().trim().min(1).max(80);
const base = { id, name, label };
export const workspaceFieldSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...base,
    type: z.literal("text"),
    required: z.boolean(),
    maxLength: z.int().min(1).max(10000),
  }),
  z.strictObject({ ...base, type: z.literal("http-url"), required: z.boolean() }),
  z
    .strictObject({
      ...base,
      type: z.literal("integer"),
      required: z.boolean(),
      minimum: z.int().min(-2147483648).max(2147483647),
      maximum: z.int().min(-2147483648).max(2147483647),
    })
    .refine((field) => field.minimum <= field.maximum, "Minimum must not exceed maximum"),
  z.strictObject({
    ...base,
    type: z.literal("enum"),
    required: z.boolean(),
    values: z
      .array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/))
      .min(1)
      .max(64)
      .refine((values) => new Set(values).size === values.length, "Duplicate choices"),
  }),
  z.strictObject({ ...base, type: z.literal("timestamp"), generated: z.literal("created-at") }),
]);
export const workspaceCollectionSchema = z.strictObject({
  id,
  name,
  label,
  singularLabel: label,
  description: z.string().max(240).optional(),
  fields: z.array(workspaceFieldSchema).max(100),
  relationships: z.array(z.strictObject({ id, name, label, target: id })).max(20),
  operations: z
    .array(z.enum(["create", "read", "list", "update"]))
    .min(2)
    .max(4),
  primaryField: z.string().min(1).max(48),
  columns: z.array(z.string().min(1).max(48)).min(1).max(6),
});
export const workspaceDefinitionSchema = z
  .strictObject({
    version: z.literal(1),
    title: label,
    tagline: z.string().max(140).optional(),
    preset: z.enum(["midnight", "paper"]).default("midnight"),
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(25),
    collections: z.array(workspaceCollectionSchema).min(1).max(20),
  })
  .superRefine((definition, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const unique = (values: string[], what: string) => {
      if (new Set(values).size !== values.length) issue(`Duplicate ${what}`);
    };
    unique(
      definition.collections.map((collection) => collection.id),
      "collection ID",
    );
    unique(
      definition.collections.map((collection) => collection.name.toLowerCase()),
      "collection name",
    );
    for (const collection of definition.collections) {
      const parts = [...collection.fields, ...collection.relationships];
      unique(
        parts.map((field) => field.id),
        `field/relationship ID in ${collection.id}`,
      );
      unique(
        parts.map((field) => field.name.toLowerCase()),
        `field/relationship name in ${collection.id}`,
      );
      unique(collection.operations, `operation in ${collection.id}`);
      unique(collection.columns, `column in ${collection.id}`);
      if (!collection.operations.includes("list") || !collection.operations.includes("read"))
        issue(`${collection.id} requires list and read capabilities`);
      const properties = new Set([
        "id",
        "createdAt",
        ...collection.fields.map((field) => field.name),
      ]);
      for (const column of [collection.primaryField, ...collection.columns])
        if (!properties.has(column)) issue(`${collection.id} has unknown display field ${column}`);
      for (const relation of collection.relationships) {
        const parent = definition.collections.find((candidate) => candidate.id === relation.target);
        if (!parent || parent.id === collection.id)
          issue(`${collection.id} has an unavailable relationship target ${relation.target}`);
        else if (relation.name !== `${parent.name}Id`)
          issue(
            `${collection.id}.${relation.name} must match its parent's API field ${parent.name}Id`,
          );
      }
    }
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (collection: WorkspaceCollection) => {
      if (visiting.has(collection.id)) {
        issue(`Required relationship cycle at ${collection.id}`);
        return;
      }
      if (visited.has(collection.id)) return;
      visiting.add(collection.id);
      for (const relation of collection.relationships) {
        const parent = definition.collections.find((item) => item.id === relation.target);
        if (parent) visit(parent);
      }
      visiting.delete(collection.id);
      visited.add(collection.id);
    };
    for (const collection of definition.collections) visit(collection);
  });
export type WorkspaceField = z.output<typeof workspaceFieldSchema>;
export type WorkspaceCollection = z.output<typeof workspaceCollectionSchema>;
export type WorkspaceDefinition = z.output<typeof workspaceDefinitionSchema>;
export type ResourceRecord = {
  id: string;
  createdAt: string;
  [field: string]: string | number | null;
};
export type RecordInput = Record<string, string | number | null>;

export function fieldValueSchema(field: WorkspaceField): z.ZodType {
  if (field.type === "timestamp") return z.iso.datetime({ offset: true });
  let schema: z.ZodType;
  if (field.type === "text") schema = z.string().max(field.maxLength);
  else if (field.type === "integer") schema = z.int().min(field.minimum).max(field.maximum);
  else if (field.type === "enum") schema = z.enum(field.values);
  else
    schema = z
      .string()
      .max(8192)
      .url()
      .regex(/^[hH][tT][tT][pP][sS]?:\/\/(?![^/?#]*@)/)
      .refine((value) => {
        try {
          const url = new URL(value);
          return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Use an HTTP/HTTPS URL without credentials");
  return field.required ? schema : schema.nullable();
}
export function recordSchema(collection: WorkspaceCollection) {
  return z.strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
    ...Object.fromEntries(collection.fields.map((field) => [field.name, fieldValueSchema(field)])),
    ...Object.fromEntries(collection.relationships.map((relation) => [relation.name, z.uuid()])),
  });
}
export function inputSchema(collection: WorkspaceCollection) {
  const schema = z.strictObject({
    ...Object.fromEntries(
      collection.fields
        .filter((field) => field.type !== "timestamp")
        .map((field) => [
          field.name,
          !field.required ? fieldValueSchema(field).optional() : fieldValueSchema(field),
        ]),
    ),
    ...Object.fromEntries(collection.relationships.map((relation) => [relation.name, z.uuid()])),
  });
  return schema;
}

/** DOM strings become only declared editable fields; identity and generated values never leak in. */
export function formInput(
  collection: WorkspaceCollection,
  values: Record<string, string>,
  previous?: ResourceRecord,
): { data?: RecordInput; errors: Record<string, string>; changed: boolean } {
  const input: RecordInput = {},
    errors: Record<string, string> = {};
  let changed = !previous;
  for (const field of collection.fields) {
    if (field.type === "timestamp") continue;
    const value = values[field.name] ?? "";
    if (previous && !field.required && value === String(previous[field.name] ?? "")) continue;
    const parsed = fieldValueSchema(field).safeParse(
      value === "" && !field.required
        ? null
        : field.type === "integer"
          ? value.trim() === ""
            ? NaN
            : Number(value)
          : value,
    );
    if (!parsed.success)
      errors[field.name] =
        field.type === "integer"
          ? `Enter a whole number from ${field.minimum} to ${field.maximum}.`
          : field.type === "text"
            ? `Use at most ${field.maxLength} characters.`
            : field.type === "enum"
              ? "Choose an available value."
              : "Enter an HTTP/HTTPS URL without credentials.";
    else {
      if (!previous || previous[field.name] !== parsed.data) changed = true;
      if (!previous || field.required || previous[field.name] !== parsed.data)
        input[field.name] = parsed.data as string | number | null;
    }
  }
  for (const relation of collection.relationships) {
    const value = values[relation.name] ?? "";
    if (!z.uuid().safeParse(value).success)
      errors[relation.name] = `Choose ${relation.label.toLowerCase()}.`;
    else {
      if (!previous || previous[relation.name] !== value) changed = true;
      input[relation.name] = value;
    }
  }
  return Object.keys(errors).length ? { errors, changed } : { data: input, errors, changed };
}
export function fieldLabel(collection: WorkspaceCollection, property: string): string {
  return property === "id"
    ? "Record ID"
    : property === "createdAt"
      ? "Created"
      : ([...collection.fields, ...collection.relationships].find(
          (field) => field.name === property,
        )?.label ?? property);
}
export function recordLabel(collection: WorkspaceCollection, record: ResourceRecord): string {
  return String(record[collection.primaryField] ?? record.id) || record.id;
}
