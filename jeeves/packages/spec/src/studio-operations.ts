/** Shared studio commands build one batch against the caller's latest accepted revision. */
import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { connectionSchema, type DesignDocument } from "./design.ts";
import { emptyDesignScope } from "./design-scope.ts";
import { designGeneration } from "./generation.ts";
import { generationRuntime } from "./generation-catalog.ts";
import { idSchema } from "./ids.ts";
import { deriveModuleGeneration, hasModuleSelections } from "./module-generation.ts";
import { sameContractRef } from "./operation-records.ts";
import {
  type OperationBatchInput,
  type OperationInput,
  operationBatchSchema,
} from "./operations.ts";
import {
  createStudioComponentSettings,
  type StudioComponent,
  type StudioComponentTargetKind,
  type StudioModuleSlotId,
  studioComponentConnectionSchema,
  studioComponentDefinitions,
  studioComponentKindSchema,
  studioComponentLimits,
  studioComponentSchema,
  studioComponentSettingsSchema,
  studioModuleSlotIdSchema,
} from "./studio-components.ts";
import { freshId, usedIds } from "./studio-ids.ts";
import { buildLaneCommand, laneCommandSchemas, newLinkId } from "./studio-lane-commands.ts";
import { laneGraph } from "./studio-lanes.ts";
import { studioKindNoun } from "./studio-links.ts";
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
import {
  moduleKinds,
  moduleSlots,
  newModuleIdentity,
  studioComponentTargetKind,
} from "./studio-modules.ts";
import { idsPinned, planRename, rekeyDesign, rekeyLeftovers } from "./studio-rekey.ts";

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
 * Module commands. Each derives the module-level generation, fixed and initial values and
 * ownership in the same batch (one Undo step), or refuses in plain words.
 * - `addModule`: a module of `kind` in `host`, with a fresh name and ID unless given. On a schema-2
 *   design it also upgrades to schema 3 with an empty generation for the local runtime.
 * - `connectModule`: fills `slot` with a tile (through the host's link, added by the lane rules
 *   when there is none) or, for the Cache reader's loader, a Data access in the same tile.
 * - `disconnectModule`: removes one module link; the host's link stays.
 * - `removeModule`: removes the module and its links.
 */
function moduleCommandSchemas() {
  return [
    z.strictObject({
      type: z.literal("addModule"),
      host: idSchema,
      kind: studioComponentKindSchema,
      id: idSchema.optional(),
      name: studioComponentSchema.shape.name.optional(),
      description: studioComponentSchema.shape.description,
    }),
    z.strictObject({
      type: z.literal("connectModule"),
      module: idSchema,
      slot: studioModuleSlotIdSchema,
      target: z.union([z.strictObject({ tile: idSchema }), z.strictObject({ module: idSchema })]),
    }),
    z.strictObject({ type: z.literal("disconnectModule"), link: idSchema }),
    z.strictObject({ type: z.literal("removeModule"), module: idSchema }),
  ] as const;
}

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
  ...moduleCommandSchemas(),
  /**
   * Runnable processes for export (tile process contract, section 1): on saves
   * `generation.processes: true`, off removes it. Only a design built from modules can turn it on.
   */
  z.strictObject({ type: z.literal("setRunnableProcesses"), on: z.boolean() }),
]);
export type StudioCommand = z.infer<typeof studioCommandSchema>;
/** The module authoring commands (contract section 5), part of `studioCommandSchema`. */
export type ModuleCommand = Extract<
  StudioCommand,
  { type: "addModule" | "connectModule" | "disconnectModule" | "removeModule" }
>;
export type ConnectModuleCommand = Extract<StudioCommand, { type: "connectModule" }>;

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
  if (input.type === "setRunnableProcesses") return runnableProcessesBatch(design, input.on);
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
    const system =
      input.type === "addTile" || input.type === "addAction" ? input.system : undefined;
    if (!system)
      throw new Error(
        "This design has no system yet. Start it with addAction, or addTile from the download or upload lane, giving the system a name.",
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
  // A rename re-keys the IDs that still follow their names, with every reference, before the
  // command itself runs (tile processes contract, section 7); later steps use the new IDs.
  const renames =
    (input.type === "edit" || input.type === "editComponent") && input.name !== undefined
      ? planRename(
          design,
          input.type === "edit" ? { element: input.element } : { component: input.component },
          input.name,
        )
      : [];
  const moved = (id: string) => renames.find((item) => item.from === id)?.to ?? id;
  for (const item of renames) {
    rekeyDesign(draft, item.from, item.to);
    ops.push({ op: "rekey", ...item });
  }
  // Module commands derive the module-level generation; removing a tile or a link, or re-keying
  // IDs, re-derives it once it exists. The older component commands never do.
  const moduleCommand =
    input.type === "addModule" ||
    input.type === "connectModule" ||
    input.type === "disconnectModule" ||
    input.type === "removeModule";
  const derive =
    moduleCommand ||
    ((input.type === "removeTile" || input.type === "removeLink" || renames.length > 0) &&
      hasModuleSelections(design));
  if (moduleCommand) upgradeForModules(draft, ops);
  switch (input.type) {
    case "edit": {
      const id = moved(input.element);
      const item = binding(id);
      if (input.name !== undefined || input.description !== undefined)
        ops.push({
          op: "updateElement",
          id,
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
      const item = component(moved(input.component));
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
    case "addAction":
    case "renameAction":
    case "removeAction":
    case "addTile":
    case "linkTiles":
    case "removeTile":
    case "removeLink":
    case "changeKind":
    case "setEntryLane":
      ops.push(...buildLaneCommand(draft, studio, input));
      break;
    case "addModule":
    case "connectModule":
    case "disconnectModule":
    case "removeModule":
      ops.push(...buildModuleCommand(design, draft, studio, input));
      break;
  }
  // A re-key derives from the design as its rekey operations leave it, so the facts the previous
  // selections needed are found under their new IDs.
  const before = renames.length ? structuredClone(design) : design;
  for (const item of before === design ? [] : renames) rekeyDesign(before, item.from, item.to);
  const derived = derive ? deriveModuleGeneration(before, draft) : [];
  ops.push({ op: "setStudio", studio: draft.architecture.studio });
  ops.push(...derived);
  const [left] = rekeyLeftovers(
    draft,
    renames.map((item) => item.from),
  );
  if (left)
    throw new Error(
      `Renaming can't update every use of its old ID (${left}), so nothing was changed.`,
    );
  return operationBatchSchema.parse({ baseRevision: design.revision, ops });
}

/**
 * One `setGeneration` that turns Runnable processes on or off. It never derives, so it never
 * changes a module. Studies, frozen v2 and tile-level or preset designs refuse (`idsPinned`).
 */
function runnableProcessesBatch(design: DesignDocument, on: boolean): OperationBatchInput {
  if (on && idsPinned(design))
    throw new Error("Runnable processes needs a design built from modules.");
  if (on && !hasModuleSelections(design)) throw new Error("Add a module first.");
  const generation = designGeneration(design);
  if (!generation || !!generation.processes === on)
    throw new Error(`Runnable processes are already ${on ? "on" : "off"}.`);
  const next = structuredClone(generation);
  if (on) next.processes = true;
  else delete next.processes;
  return operationBatchSchema.parse({
    baseRevision: design.revision,
    ops: [{ op: "setGeneration", generation: next }],
  });
}

/**
 * A module command needs schema 3 and a generation for the local runtime: a schema-2 design is
 * upgraded with an empty scope, and a design without a generation gets an empty one.
 */
function upgradeForModules(draft: DesignDocument, ops: OperationInput[]) {
  if (draft.schemaVersion === 2) {
    const scope = emptyDesignScope();
    ops.push({ op: "upgradeDesign", scope: structuredClone(scope) });
    Object.assign(draft, { schemaVersion: 3, scope });
  }
  if (draft.schemaVersion !== 3) return;
  const generation = designGeneration(draft);
  if (!generation)
    draft.generation = {
      version: 1,
      runtime: structuredClone(generationRuntime.ref),
      selections: [],
    };
  else if (!sameContractRef(generation.runtime, generationRuntime.ref))
    throw new Error(
      "This design generates for another runtime; modules generate code only for the local runtime.",
    );
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: readonly string[], last = "and") =>
  items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
const targetNouns: Record<StudioComponentTargetKind, string> = {
  application: "an application",
  identity: "an identity service",
  database: "a database",
  cache: "a cache",
  queue: "a queue",
  search: "a search index",
  "object-store": "object storage",
  cdn: "a CDN",
  "external-api": "an external API",
};
const article = (text: string) => (/^[AEIOU]/i.test(text) ? `an ${text}` : `a ${text}`);

/** Applies a module command to the draft (its studio is `studio`) and returns any lane operations. */
function buildModuleCommand(
  design: DesignDocument,
  draft: DesignDocument,
  studio: StudioModel,
  input: ModuleCommand,
): OperationInput[] {
  const ops: OperationInput[] = [];
  const name = (id: string) => draft.elements.find((item) => item.id === id)?.name ?? id;
  const tileKind = (id: string) => {
    const kind = studio.elements.find((item) => item.element === id)?.settings.kind;
    if (!kind) throw new Error(`There is no tile "${id}".`);
    return kind;
  };
  const component = (id: string): StudioComponent => {
    const item = studio.components?.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`There is no module "${id}".`);
    return item;
  };
  const links = () => studio.componentConnections ?? [];
  switch (input.type) {
    case "addModule": {
      tileKind(input.host);
      const kinds = moduleKinds(draft, input.host);
      const definition = studioComponentDefinitions[input.kind];
      if (!kinds.includes(input.kind))
        throw new Error(
          kinds.length
            ? `${definition.name} can't go in ${name(input.host)}; it goes in ${list(definition.hosts.map(studioKindNoun), "or")}.`
            : `${sentence(name(input.host))} takes no modules.`,
        );
      const fresh = newModuleIdentity(draft, input.host, input.kind, input.name);
      if (input.id !== undefined && usedIds(draft).has(input.id))
        throw new Error(`The ID "${input.id}" is already in use.`);
      const settings = createStudioComponentSettings(input.kind);
      // The value its template fixes; everything else starts from the kind's defaults.
      if (settings.kind === "cache-reader") settings.stampede = "single-flight";
      studio.components = [
        ...(studio.components ?? []),
        {
          id: input.id ?? fresh.id,
          host: input.host,
          name: input.name ?? fresh.name,
          ...(input.description !== undefined && { description: input.description }),
          settings,
        },
      ];
      break;
    }
    case "connectModule": {
      const module = component(input.module);
      const definition = studioComponentDefinitions[module.settings.kind];
      const who = sentence(module.name);
      const host = name(module.host);
      const slot = definition.slots.find((item) => item.id === input.slot);
      if (!definition.slots.length)
        throw new Error(`${who} can't connect; ${article(definition.name)} takes no connections.`);
      if (!slot)
        throw new Error(
          `${who} has no ${input.slot} connection; ${article(definition.name)} connects its ${list(
            definition.slots.map((item) => item.id),
            "or",
          )}.`,
        );
      const filled = moduleSlots(draft, module.id).find((item) => item.slot.id === slot.id);
      const taken = usedIds(draft);
      if ("module" in input.target) {
        const wanted = slot.module;
        if (!wanted)
          throw new Error(`${who}'s ${slot.id} connects to a tile, not to another module.`);
        const target = component(input.target.module);
        if (
          target.id === module.id ||
          target.host !== module.host ||
          target.settings.kind !== wanted
        )
          throw new Error(
            `${who}'s ${slot.id} must be ${article(studioComponentDefinitions[wanted].name)} in ${host}.`,
          );
        if (filled?.links.length)
          throw new Error(`${who} already has a ${slot.id}; disconnect it first.`);
        studio.componentConnections = [
          ...links(),
          {
            id: freshId(`${module.id}-${target.id}`, (id) => taken.has(id)),
            from: module.id,
            to: { kind: "component", id: target.id },
          },
        ];
        break;
      }
      const tile = input.target.tile;
      const kind = tileKind(tile);
      if (slot.module)
        throw new Error(
          `${who}'s ${slot.id} is ${article(studioComponentDefinitions[slot.module].name)} in ${host}, not a tile.`,
        );
      if (tile === module.host) throw new Error(`${who} can't connect to its own tile.`);
      if (!slot.targets.includes(studioComponentTargetKind(kind)))
        throw new Error(
          `${who}'s ${slot.id} connects to ${list(
            slot.targets.map((item) => targetNouns[item]),
            "or",
          )}, not ${name(tile)}.`,
        );
      const used = filled?.links.find((item) => "tile" in item.target && item.target.tile === tile);
      if (used) throw new Error(`${who} already uses ${name(tile)}.`);
      const other = filled?.links[0]?.target;
      if (other && !slot.many)
        throw new Error(
          `${who}'s ${slot.id} already uses ${"tile" in other ? name(other.tile) : other.module}; disconnect it first.`,
        );
      // The host's own link to the tile, in the slot's direction; the lane rules add one if none.
      const consume = slot.use === "consume";
      const channel = (id: string) =>
        studio.connections.find((item) => item.connection === id)?.settings.channelUse;
      const hostLink = draft.connections.find((item) => {
        const out = item.from.element === module.host && item.to.element === tile;
        const back = item.from.element === tile && item.to.element === module.host;
        if (slot.use === "publish") return out && channel(item.id) === "publish";
        if (consume) return back && channel(item.id) === "consume";
        return out || (back && (slot.use === "uses" || kind !== "queue"));
      });
      let via = hostLink?.id;
      if (!via) {
        const [from, to] = consume ? [tile, module.host] : [module.host, tile];
        via = newLinkId(draft, { tile: from }, to);
        ops.push(
          ...buildLaneCommand(draft, studio, {
            type: "linkTiles",
            from: { tile: from },
            to,
            linkId: via,
          }),
        );
      }
      const free = usedIds(draft);
      studio.componentConnections = [
        ...links(),
        {
          id: freshId(`${module.id}-${tile}`, (id) => free.has(id)),
          from: module.id,
          to: { kind: "element", id: tile, via },
        },
      ];
      break;
    }
    case "disconnectModule": {
      if (!links().some((item) => item.id === input.link))
        throw new Error(`There is no module link "${input.link}".`);
      // The host's link stays; removing it is a separate removeLink.
      studio.componentConnections = links().filter((item) => item.id !== input.link);
      break;
    }
    case "removeModule": {
      const module = component(input.module);
      const guarded = designGeneration(design)?.selections.find(
        (item) =>
          item.target.kind === "element" &&
          item.binding.kind === "owned-multipart" &&
          item.binding.identity.guard === module.id,
      );
      if (guarded)
        throw new Error(
          `${sentence(module.name)} guards ${name(module.host)}'s tile-level upload template; it can't be removed.`,
        );
      studio.components = (studio.components ?? []).filter((item) => item.id !== module.id);
      studio.componentConnections = links().filter(
        (item) =>
          item.from !== module.id && !(item.to.kind === "component" && item.to.id === module.id),
      );
      break;
    }
  }
  return ops;
}

/**
 * Where a link dragged from a module may end (Connect mode and chat): every tile on the board, in
 * lane order, then every other module in its tile, each with the `connectModule` it would run
 * (the slot that accepts it) or why not, in plain words. Pure; it changes nothing.
 */
export type ModuleConnectOption = { target: { tile: string } | { module: string } } & (
  | { command: ConnectModuleCommand }
  | { refusal: string }
);
export function moduleConnectOptions(
  design: DesignDocument,
  module: string,
): ModuleConnectOption[] {
  const studio = design.architecture?.studio;
  const item = studio?.components?.find((candidate) => candidate.id === module);
  if (!studio || !item) return [];
  const definition = studioComponentDefinitions[item.settings.kind];
  const kinds = new Map(studio.elements.map((binding) => [binding.element, binding.settings.kind]));
  const names = new Map(design.elements.map((element) => [element.id, element.name]));
  const attempt = (
    target: ModuleConnectOption["target"],
    slot: StudioModuleSlotId | undefined,
    refusal: string,
  ): ModuleConnectOption => {
    if (!slot) return { target, refusal };
    const command: ConnectModuleCommand = { type: "connectModule", module, slot, target };
    try {
      buildStudioCommand(design, command);
      return { target, command };
    } catch (error) {
      return { target, refusal: error instanceof Error ? error.message : String(error) };
    }
  };
  const who = sentence(item.name);
  const tiles = laneGraph(design).nodes.flatMap((node) => {
    const kind = kinds.get(node.id);
    if (!kind) return [];
    const target = studioComponentTargetKind(kind);
    const slot = definition.slots.find((each) => !each.module && each.targets.includes(target));
    return [
      attempt(
        { tile: node.id },
        slot?.id,
        definition.slots.length
          ? `${who} can't use ${names.get(node.id) ?? node.id}; ${article(definition.name)} connects to ${
              list(
                [...new Set(definition.slots.flatMap((each) => each.targets))].map(
                  (each) => targetNouns[each],
                ),
                "or",
              ) || "another module"
            }.`
          : `${who} can't connect; ${article(definition.name)} takes no connections.`,
      ),
    ];
  });
  const loader = definition.slots.find((each) => each.module);
  const modules = (studio.components ?? [])
    .filter((other) => other.host === item.host && other.id !== module)
    .map((other) =>
      attempt(
        { module: other.id },
        loader && other.settings.kind === loader.module ? loader.id : undefined,
        loader?.module
          ? `${who}'s ${loader.id} must be ${article(studioComponentDefinitions[loader.module].name)}.`
          : `${who} connects to tiles, not to other modules.`,
      ),
    );
  return [...tiles, ...modules];
}
