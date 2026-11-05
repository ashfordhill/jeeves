/** Shared studio commands build one batch against the caller's latest accepted revision. */
import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { connectionSchema, type DesignDocument } from "./design.ts";
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
import { buildLaneCommand, laneCommandSchemas } from "./studio-lane-commands.ts";
import {
  definitionRefSchema,
  type StudioElementBinding,
  type StudioModel,
  studioAccessSchema,
  studioActionSchema,
  studioConnectionSettingsSchema,
  studioInteractionSchema,
  studioLimits,
  studioOwnerSchema,
  studioProtocolSchema,
  studioSettingsSchema,
} from "./studio-model.ts";

const studioName = z.string().trim().min(1).max(studioLimits.name);
const studioDescription = z.string().trim().max(studioLimits.description);
/** A tile as a study declares it; the canvas and chat add tiles with `addTile`. */
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
/**
 * A component link, optionally creating the C2 connection it traces in the same batch. When
 * `connection` is given, `link.to` must be an element target whose `via` is that new connection.
 */
const studioComponentLinkCreationSchema = z.strictObject({
  link: studioComponentConnectionSchema,
  connection: studioConnectionCreationSchema.optional(),
});
export type StudioComponentLinkCreation = z.infer<typeof studioComponentLinkCreationSchema>;
/**
 * The same strict, finite command inputs serve the canvas, the inspector and chat. Tiles and links
 * are added and removed only through the lane commands, which keep every tile on a lane.
 */
export const studioCommandSchema = z.discriminatedUnion("type", [
  ...laneCommandSchemas,
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
    type: z.literal("editConnection"),
    connection: idSchema,
    planned: studioPlannedConnectionSchema.partial().optional(),
    settings: studioConnectionSettingsSchema.optional(),
  }),
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
    const system = input.type === "addTile" ? input.system : undefined;
    if (!system)
      throw new Error(
        "This design has no system yet. Start it with addTile from the download or upload lane, giving the system a name.",
      );
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
    if (!item) throw new Error(`There is no tile "${id}".`);
    return item;
  };
  const bindings = new Set(studio.elements.map((item) => item.element));
  const component = (id: string): StudioComponent => {
    const item = studio.components?.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`There is no module "${id}".`);
    return item;
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
        throw new Error("A module link that adds a connection must go through that connection.");
      connect(item.connection);
    }
    studio.componentConnections = [...(studio.componentConnections ?? []), item.link];
  };
  switch (input.type) {
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
      if (input.owner === null) delete item.owner;
      else if (input.owner) item.owner = input.owner;
      break;
    }
    case "editConnection": {
      const connection = draft.connections.find((item) => item.id === input.connection);
      const item = studio.connections.find((item) => item.connection === input.connection);
      if (!connection?.planned || !item)
        throw new Error(
          design.architecture?.studio?.entries?.some((entry) => entry.id === input.connection)
            ? `"${input.connection}" is a lane entry; entries have no settings.`
            : `There is no link "${input.connection}".`,
        );
      if (input.planned)
        ops.push({ op: "updatePlannedConnection", id: input.connection, ...input.planned });
      if (input.settings) item.settings = input.settings;
      break;
    }
    case "createComponent": {
      if (!bindings.has(input.component.host))
        throw new Error(`There is no tile "${input.component.host}" to hold the module.`);
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
          throw new Error("A module's kind can't change; remove it and add another.");
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
          throw new Error(`There is no module link "${id}".`);
      // The traced C2 connection stays; removing it is a separate removeLink.
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
  }
  ops.push({ op: "setStudio", studio: draft.architecture.studio });
  return operationBatchSchema.parse({ baseRevision: design.revision, ops });
}
