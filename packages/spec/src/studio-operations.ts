/** Shared studio commands build one batch against the caller's latest accepted revision. */
import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { connectionSchema, type DesignDocument, type ElementInput } from "./design.ts";
import { idSchema } from "./ids.ts";
import {
  type OperationBatchInput,
  type OperationInput,
  operationBatchSchema,
} from "./operations.ts";
import {
  type StudioComponent,
  studioComponentConnectionSchema,
  studioComponentLimits,
  studioComponentSchema,
  studioComponentSettingsSchema,
} from "./studio-components.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { buildLaneCommand, laneCommandSchemas } from "./studio-lane-commands.ts";
import {
  definitionRefSchema,
  type StudioElementBinding,
  type StudioModel,
  type StudioPackage,
  studioAccessSchema,
  studioActionSchema,
  studioConnectionSettingsSchema,
  studioDefinitionRef,
  studioInteractionSchema,
  studioLimits,
  studioOwnerSchema,
  studioPackageSchema,
  studioProtocolSchema,
  studioSettingsSchema,
} from "./studio-model.ts";
import { pruneStudioAfterDelete } from "./studio-prune.ts";

const studioName = z.string().trim().min(1).max(studioLimits.name);
const studioDescription = z.string().trim().max(studioLimits.description);
const studioSystemSchema = z.strictObject({
  name: studioName,
  description: studioDescription.optional(),
});
export const studioElementCreationSchema = z.strictObject({
  id: idSchema,
  name: studioName,
  description: studioDescription.optional(),
  settings: studioSettingsSchema,
  definition: definitionRefSchema.optional(),
  owner: studioOwnerSchema.optional(),
});
export type StudioElementCreation = z.infer<typeof studioElementCreationSchema>;
const studioPlannedConnectionSchema = z.strictObject({
  label: studioActionSchema,
  protocol: studioProtocolSchema,
  interaction: studioInteractionSchema,
  security: studioAccessSchema,
});
export const studioConnectionCreationSchema = z.strictObject({
  id: idSchema,
  from: idSchema,
  to: idSchema,
  kind: connectionSchema.shape.kind,
  planned: studioPlannedConnectionSchema,
  settings: studioConnectionSettingsSchema,
});
export type StudioConnectionCreation = z.infer<typeof studioConnectionCreationSchema>;
/** An owner change is always explicit, including when dissolving a package. */
const studioOwnerReassignmentSchema = z.strictObject({
  resource: idSchema,
  owner: studioOwnerSchema.nullable(),
});
export type StudioOwnerReassignment = z.infer<typeof studioOwnerReassignmentSchema>;
const reassignOwners = z.array(studioOwnerReassignmentSchema).max(studioLimits.elements).optional();
/**
 * A component link, optionally creating the C2 connection it traces in the same batch. When
 * `connection` is given, `link.to` must be an element target whose `via` is that new connection.
 */
const studioComponentLinkCreationSchema = z.strictObject({
  link: studioComponentConnectionSchema,
  connection: studioConnectionCreationSchema.optional(),
});
export type StudioComponentLinkCreation = z.infer<typeof studioComponentLinkCreationSchema>;
/** The same strict, finite command inputs serve manual editing and assistant tools. */
export const studioCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("create"),
    elements: z.array(studioElementCreationSchema).min(1).max(studioLimits.elements),
    connections: z.array(studioConnectionCreationSchema).max(studioLimits.connections).optional(),
    package: studioPackageSchema.optional(),
    system: studioSystemSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("edit"),
    element: idSchema,
    name: studioName.optional(),
    description: studioDescription.optional(),
    settings: studioSettingsSchema.optional(),
    owner: studioOwnerSchema.nullable().optional(),
  }),
  z.strictObject({
    type: z.literal("editSystem"),
    name: studioName.optional(),
    description: studioDescription.optional(),
  }),
  z.strictObject({
    type: z.literal("connect"),
    connection: studioConnectionCreationSchema,
    lookup: z
      .strictObject({ element: idSchema, resource: z.enum(["database", "cache"]) })
      .optional(),
  }),
  z.strictObject({
    type: z.literal("editConnection"),
    connection: idSchema,
    planned: studioPlannedConnectionSchema.partial().optional(),
    settings: studioConnectionSettingsSchema.optional(),
  }),
  z.strictObject({ type: z.literal("group"), package: studioPackageSchema }),
  z.strictObject({
    type: z.literal("removeMembers"),
    package: idSchema,
    members: z.array(idSchema).min(1).max(studioLimits.members.max),
    reassignOwners,
  }),
  z.strictObject({ type: z.literal("ungroup"), package: idSchema, reassignOwners }),
  z.strictObject({
    type: z.literal("createComponent"),
    component: studioComponentSchema,
    links: z
      .array(studioComponentLinkCreationSchema)
      .max(studioComponentLimits.componentConnections)
      .optional(),
  }),
  z.strictObject({
    type: z.literal("editComponent"),
    component: idSchema,
    name: studioComponentSchema.shape.name.optional(),
    description: studioComponentSchema.shape.description,
    settings: studioComponentSettingsSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("connectComponent"),
    links: z
      .array(studioComponentLinkCreationSchema)
      .min(1)
      .max(studioComponentLimits.componentConnections),
  }),
  z.strictObject({
    type: z.literal("disconnectComponent"),
    links: z.array(idSchema).min(1).max(studioComponentLimits.componentConnections),
  }),
  z.strictObject({
    type: z.literal("removeComponent"),
    components: z.array(idSchema).min(1).max(studioComponentLimits.components),
  }),
  z.strictObject({
    type: z.literal("delete"),
    elements: z.array(idSchema).max(studioLimits.elements).optional(),
    connections: z.array(idSchema).max(studioLimits.connections).optional(),
    package: idSchema.optional(),
    packageAction: z.enum(["ungroup", "delete-members"]).optional(),
    reassignOwners,
  }),
  ...laneCommandSchemas,
]);
export type StudioCommand = z.infer<typeof studioCommandSchema>;

/**
 * No I/O and no cached architecture replacement. Toolbar and assistant callers submit this exact
 * baseRevision/ops through the existing operations transport. The server remains authoritative.
 * Inputs are cloned.
 */
export function buildStudioCommand(
  design: DesignDocument,
  command: StudioCommand,
): OperationBatchInput {
  const draft = structuredClone(design);
  const input = studioCommandSchema.parse(command);
  if (input.type === "editSystem") {
    if (draft.architecture)
      return operationBatchSchema.parse({
        baseRevision: design.revision,
        ops: [
          {
            op: "updateArchitectureSystem",
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
          },
        ],
      });
    const architecture = structuredClone(
      draft.architecture ?? architectureSchema.parse({ system: { name: input.name ?? "System" } }),
    );
    if (input.name !== undefined) architecture.system.name = input.name;
    if (input.description !== undefined) architecture.system.description = input.description;
    return operationBatchSchema.parse({
      baseRevision: design.revision,
      ops: [{ op: "setArchitecture", architecture }],
    });
  }
  const ops: OperationInput[] = [];
  if (!draft.architecture) {
    const system = input.type === "create" || input.type === "addTile" ? input.system : undefined;
    if (!system) throw new Error("Create an architecture system before using studio commands.");
    draft.architecture = architectureSchema.parse({ system });
    ops.push({ op: "setArchitecture", architecture: structuredClone(draft.architecture) });
  }
  const studio: StudioModel = draft.architecture.studio ?? {
    version: 1,
    elements: [],
    packages: [],
    connections: [],
  };
  draft.architecture.studio = studio;
  const binding = (id: string): StudioElementBinding => {
    const item = studio.elements.find((candidate) => candidate.element === id);
    if (!item) throw new Error(`Element ${id} has no editable studio binding.`);
    return item;
  };
  const bindings = new Set(studio.elements.map((item) => item.element));
  const component = (id: string): StudioComponent => {
    const item = studio.components?.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Component ${id} does not exist.`);
    return item;
  };
  const group = (id: string): StudioPackage => {
    const item = studio.packages.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Package ${id} does not exist.`);
    return item;
  };
  const reassign = (changes: StudioOwnerReassignment[] = []) => {
    for (const change of changes) {
      const item = binding(change.resource);
      if (change.owner === null) delete item.owner;
      else item.owner = change.owner;
    }
  };
  const connect = (item: StudioConnectionCreation) => {
    const connection: z.infer<typeof connectionSchema> = {
      id: item.id,
      kind: item.kind,
      from: { element: item.from },
      to: { element: item.to },
      planned: item.planned,
    };
    ops.push({ op: "connect", connection });
    draft.connections.push(connection);
    studio.connections.push({ connection: item.id, settings: item.settings });
  };
  const link = (item: StudioComponentLinkCreation) => {
    if (item.connection) {
      if (item.link.to.kind !== "element" || item.link.to.via !== item.connection.id)
        throw new Error("A new traced connection must be the component link's via connection.");
      connect(item.connection);
    }
    studio.componentConnections = [...(studio.componentConnections ?? []), item.link];
  };
  switch (input.type) {
    case "create": {
      if (!input.elements.length) throw new Error("Create at least one studio element.");
      for (const item of input.elements) {
        const element: ElementInput = {
          id: item.id,
          name: item.name,
          ...(item.description !== undefined && { description: item.description }),
          classification: { ...studioDefinitions[item.settings.kind].classification },
        };
        ops.push({ op: "addElement", element });
        studio.elements.push({
          element: item.id,
          definition: item.definition ?? studioDefinitionRef(item.settings.kind),
          settings: item.settings,
          ...(item.owner && { owner: item.owner }),
        });
      }
      for (const item of input.connections ?? []) connect(item);
      if (input.package) {
        // Package-scope placement creates the application and joins its existing package in one
        // batch. The caller rebuilds this complete membership against the latest accepted design.
        const index = studio.packages.findIndex((item) => item.id === input.package?.id);
        if (index < 0) studio.packages.push(input.package);
        else studio.packages[index] = input.package;
      }
      break;
    }
    case "edit": {
      const item = binding(input.element);
      if (input.name !== undefined || input.description !== undefined)
        ops.push({
          op: "updateElement",
          id: input.element,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
        });
      if (input.settings) item.settings = input.settings;
      if (input.owner !== undefined) reassign([{ resource: input.element, owner: input.owner }]);
      break;
    }
    case "connect":
      connect(input.connection);
      if (input.lookup) {
        const item = binding(input.lookup.element);
        if (item.settings.kind !== "redirect") throw new Error("Select a Redirect application.");
        item.settings[
          input.lookup.resource === "database" ? "lookupStoreConnection" : "lookupCacheConnection"
        ] = input.connection.id;
      }
      break;
    case "editConnection": {
      const connection = draft.connections.find((item) => item.id === input.connection);
      const item = studio.connections.find((item) => item.connection === input.connection);
      if (!connection?.planned || !item)
        throw new Error(`Relationship ${input.connection} has no editable studio binding.`);
      if (input.planned)
        ops.push({ op: "updatePlannedConnection", id: input.connection, ...input.planned });
      if (input.settings) item.settings = input.settings;
      break;
    }
    case "group": {
      const index = studio.packages.findIndex((item) => item.id === input.package.id);
      if (index < 0) studio.packages.push(input.package);
      else studio.packages[index] = input.package;
      break;
    }
    case "removeMembers": {
      const item = group(input.package);
      if (input.members.some((id) => !item.members.includes(id)))
        throw new Error("Remove only members of the selected package.");
      item.members = item.members.filter((id) => !input.members.includes(id));
      if (item.members.length < 2)
        studio.packages = studio.packages.filter((candidate) => candidate.id !== item.id);
      reassign(input.reassignOwners);
      break;
    }
    case "ungroup":
      group(input.package);
      studio.packages = studio.packages.filter((item) => item.id !== input.package);
      reassign(input.reassignOwners);
      break;
    case "createComponent": {
      if (!bindings.has(input.component.host))
        throw new Error(`Element ${input.component.host} has no editable studio binding.`);
      studio.components = [...(studio.components ?? []), input.component];
      for (const item of input.links ?? []) link(item);
      break;
    }
    case "editComponent": {
      const item = component(input.component);
      if (input.name !== undefined) item.name = input.name;
      if (input.description !== undefined) item.description = input.description;
      if (input.settings) {
        if (input.settings.kind !== item.settings.kind)
          throw new Error("A component's kind cannot change; remove it and add another.");
        item.settings = input.settings;
      }
      break;
    }
    case "connectComponent":
      for (const item of input.links) link(item);
      break;
    case "disconnectComponent": {
      const ids = new Set(input.links);
      const current = studio.componentConnections ?? [];
      for (const id of ids)
        if (!current.some((item) => item.id === id))
          throw new Error(`Component connection ${id} does not exist.`);
      // The traced C2 connection stays; removing it is an explicit separate delete.
      studio.componentConnections = current.filter((item) => !ids.has(item.id));
      break;
    }
    case "removeComponent": {
      const ids = new Set(input.components);
      for (const id of ids) component(id);
      studio.components = (studio.components ?? []).filter((item) => !ids.has(item.id));
      studio.componentConnections = (studio.componentConnections ?? []).filter(
        (item) => !ids.has(item.from) && !(item.to.kind === "component" && ids.has(item.to.id)),
      );
      break;
    }
    case "addTile":
    case "linkTiles":
    case "removeTile":
    case "removeLink":
    case "changeKind":
      ops.push(...buildLaneCommand(draft, studio, input));
      break;
    case "delete": {
      const elements = new Set(input.elements ?? []);
      if (input.package) {
        const item = group(input.package);
        if (input.packageAction === "delete-members")
          for (const id of item.members) elements.add(id);
        studio.packages = studio.packages.filter((item) => item.id !== input.package);
      }
      const connections = new Set(input.connections ?? []);
      for (const id of connections) ops.push({ op: "disconnect", id });
      for (const id of elements) ops.push({ op: "removeElement", id });
      const removedConnections = draft.connections.filter(
        (item) =>
          connections.has(item.id) ||
          elements.has(item.from.element) ||
          elements.has(item.to.element),
      );
      pruneStudioAfterDelete(
        draft,
        [...elements],
        removedConnections.map((item) => item.id),
      );
      reassign(input.reassignOwners);
      break;
    }
  }
  ops.push({ op: "setStudio", studio: draft.architecture.studio });
  return operationBatchSchema.parse({ baseRevision: design.revision, ops });
}
