import { z } from "zod";
import { capabilityEndpoint, type DesignDocument } from "./design.ts";
import { idSchema } from "./ids.ts";
import { type ResourceConfig, resourceConfigSchema } from "./resources.ts";

const label = z.string().trim().min(1).max(80);
/** Stable field identities; implicit identity/timestamp have unambiguous reserved references. */
export const workspaceDisplayFieldSchema = z.union([idSchema, z.enum(["$id", "$createdAt"])]);
export const workspaceSelectionSchema = z.strictObject({
  resource: idSchema,
  label,
  singularLabel: label,
  primaryField: workspaceDisplayFieldSchema,
  columns: z
    .array(workspaceDisplayFieldSchema)
    .min(1)
    .max(6)
    .refine((values) => new Set(values).size === values.length, "Display columns must be unique"),
});
export const workspaceConfigSchema = z.strictObject({
  connection: idSchema,
  tagline: z.string().max(140).default(""),
  preset: z.enum(["midnight", "paper"]).default("midnight"),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(25),
  collections: z
    .array(workspaceSelectionSchema)
    .min(1)
    .max(20)
    .refine(
      (values) => new Set(values.map((value) => value.resource)).size === values.length,
      "Select each resource only once",
    ),
});
export type WorkspaceConfig = z.output<typeof workspaceConfigSchema>;
export type WorkspaceSelection = WorkspaceConfig["collections"][number];
export const workspaceBindingSchema = z.strictObject({
  attachment: idSchema,
  connection: idSchema,
  client: idSchema,
  service: idSchema,
  server: idSchema,
});
export type WorkspaceBinding = z.output<typeof workspaceBindingSchema>;
export const resourceDisplayLabel = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

/** Resolve the real executable calls edge. The UI cannot supply its own API or access schema. */
export function workspaceSource(design: DesignDocument, frontend: string, connectionId: string) {
  const connection = design.connections.find((item) => item.id === connectionId);
  if (!connection || connection.kind !== "calls" || connection.from.element !== frontend)
    throw new Error("Choose an outgoing REST API connection from this web app.");
  const from = capabilityEndpoint(connection, "from"),
    to = capabilityEndpoint(connection, "to");
  const element = design.elements.find((item) => item.id === frontend);
  const client = element?.attachments.find((item) => item.id === from.attachment);
  const service = design.elements.find((item) => item.id === to.element);
  const server = service?.attachments.find((item) => item.id === to.attachment);
  if (
    client?.template.id !== "rest-api-client" ||
    server?.template.id !== "rest-api-server" ||
    !service
  )
    throw new Error("The connection must bind an actual REST client and REST server.");
  if (server.config.auth !== "session" || (server.config.basePath ?? "/api") !== "/api")
    throw new Error(
      "Resource workspaces require the session-authenticated /api resource contract.",
    );
  const parsed = resourceConfigSchema.safeParse(server.config.model);
  if (!parsed.success)
    throw new Error("The connected API needs a valid structured resource model.");
  return {
    connection: connection.id,
    client: client.id,
    service: service.id,
    server: server.id,
    model: parsed.data,
  };
}

export function workspaceResources(model: ResourceConfig, config: WorkspaceConfig) {
  const selected = config.collections.map((selection) => {
    const resource = model.resources.find((item) => item.id === selection.resource);
    if (
      !resource ||
      resource.access !== "owner" ||
      !resource.operations.includes("read") ||
      !resource.operations.includes("list")
    )
      throw new Error(
        `${selection.resource}: select an owner resource with list and read capabilities.`,
      );
    for (const reference of [selection.primaryField, ...selection.columns])
      if (
        !["$id", "$createdAt"].includes(reference) &&
        !resource.fields.some((field) => field.id === reference)
      )
        throw new Error(
          `${selection.resource}: display field ${reference} is no longer in the API contract.`,
        );
    return { selection, resource };
  });
  for (const { resource } of selected)
    for (const relation of resource.belongsTo)
      if (!selected.some((item) => item.resource.id === relation.resource))
        throw new Error(
          `${resource.id}: also select its required parent ${relation.resource} with owner list/read access.`,
        );
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new Error(`${id}: required relationship cycles are unsupported by the workspace.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const relation of selected.find((item) => item.resource.id === id)!.resource.belongsTo)
      visit(relation.resource);
    visiting.delete(id);
    visited.add(id);
  };
  for (const { resource } of selected) visit(resource.id);
  return selected;
}

export function workspaceModel(design: DesignDocument, frontend: string, attachmentId: string) {
  const element = design.elements.find((item) => item.id === frontend);
  const attachment = element?.attachments.find((item) => item.id === attachmentId);
  if (attachment?.template.id !== "resource-workspace")
    throw new Error("Resource workspace attachment is missing.");
  const config = workspaceConfigSchema.parse(attachment.config);
  const source = workspaceSource(design, frontend, config.connection);
  const collections = workspaceResources(source.model, config);
  const { model, ...binding } = source;
  return { binding: { attachment: attachmentId, ...binding }, config, collections, model };
}

export function workspaceBindings(design: DesignDocument): Record<string, WorkspaceBinding> {
  return Object.fromEntries(
    design.elements.flatMap((element) =>
      element.attachments
        .filter((attachment) => attachment.template.id === "resource-workspace")
        .map((attachment) => [
          element.id,
          workspaceModel(design, element.id, attachment.id).binding,
        ]),
    ),
  );
}
