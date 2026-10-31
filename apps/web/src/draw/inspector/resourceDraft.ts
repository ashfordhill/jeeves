import {
  type Resource,
  type ResourceConfig,
  type ResourceField,
  resourceConfigSchema,
} from "@jeeves/spec";

/** Keep extension contracts as supplied; validation defaults must not rewrite untouched JSON. */
export function resourceDraft(value: unknown): ResourceConfig | undefined {
  if (value === undefined) return { resources: [], extensions: [], acceptanceCases: [] };
  if (!resourceConfigSchema.safeParse(value).success) return undefined;
  const model = structuredClone(value) as ResourceConfig;
  return { ...model, acceptanceCases: model.acceptanceCases ?? [] };
}
export function draftId(prefix: string, used: string[]): string {
  let n = 1;
  while (used.includes(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
export function addResource(model: ResourceConfig, reserved: string[] = []): Resource {
  const id = draftId("resource", [...reserved, ...model.resources.map((r) => r.id)]);
  let n = 1;
  while (model.resources.some((r) => r.name.toLowerCase() === `resource${n}`)) n++;
  return {
    id,
    name: `resource${n}`,
    access: "owner",
    fields: [],
    belongsTo: [],
    operations: ["create", "read", "list", "update"],
  };
}
export function fieldKind(
  field: Pick<ResourceField, "id" | "name"> & { required?: boolean },
  type: ResourceField["type"],
): ResourceField {
  const base = { id: field.id, name: field.name, required: field.required ?? false };
  if (type === "text") return { ...base, type, maxLength: 120 };
  if (type === "http-url") return { ...base, type };
  if (type === "integer") return { ...base, type, minimum: 0, maximum: 1000000 };
  if (type === "enum") return { ...base, type, values: ["pending", "complete"] };
  return { id: field.id, name: field.name, type, generated: "created-at" };
}
export function addField(resource: Resource, reserved: string[] = []): ResourceField {
  const id = draftId("field", [
    ...reserved,
    ...[...resource.fields, ...resource.belongsTo].map((f) => f.id),
  ]);
  let n = 1;
  while (resource.fields.some((f) => f.name.toLowerCase() === `field${n}`)) n++;
  return fieldKind({ id, name: `field${n}` }, "text");
}
export function resourceEndpoints(resource: Resource): string[] {
  return resource.operations.map(
    (op) =>
      `${{ create: "POST", read: "GET", list: "GET", update: "PATCH" }[op]} /api/${resource.name}${op === "read" || op === "update" ? "/{id}" : ""}`,
  );
}
