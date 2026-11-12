/**
 * Chat's command vocabulary (V3-19): the studio's supported authoring commands in a smaller,
 * flatter form a modest model can write. Tiles are named `tile` and modules `module` everywhere;
 * IDs follow names unless given; a setting is one `setSetting`; and only the commands chat may
 * send are listed (no legacy kinds, no raw component commands). Each chat command compiles to
 * exactly one studio command against the design it runs on, checked with the same builder the
 * mouse uses, so nothing chat saves is something the canvas couldn't make (D6).
 *
 * Every command is checked on its own: a refusal names the command, what is wrong with it and the
 * shape it takes, so a model can correct it and send the batch again. A batch is all or nothing.
 */
import {
  type DesignDocument,
  type GenerationInstalledSupport,
  idSchema,
  laneFromSchema,
  newLinkId,
  newNamedTileId,
  normalSettingFields,
  type StudioCommand,
  type StudioComponent,
  studioActionSchema,
  studioCommandSchema,
  studioComponentKindSchema,
  studioComponentLimits,
  studioDefinitions,
  studioKindSchema,
  studioLaneActionNameSchema,
  studioLaneSchema,
  studioLimits,
  studioLinkFanKinds,
  studioModuleSlotIdSchema,
  studioOwnerSchema,
} from "@jeeves/spec";
import { z } from "zod";

const id = idSchema;
const tileName = z.string().trim().min(1).max(studioLimits.name);
const tileDescription = z.string().trim().max(studioLimits.description);
const moduleName = z.string().trim().min(1).max(studioComponentLimits.name);
const moduleDescription = z.string().trim().max(studioComponentLimits.description);
const system = z.strictObject({ name: tileName, description: tileDescription.optional() });
const link = z.enum(["sync", "async"]);
const target = z.union([z.strictObject({ tile: id }), z.strictObject({ module: id })]);
/** A setting's value; each branch is described, so the JSON Schema keeps them as branches. */
const settingValue = z.union([
  z.string().describe("A choice, such as optional"),
  z.number().describe("A number, such as 5000"),
  z.boolean().describe("On or off"),
  z.null().describe("Clears a process setting"),
]);
const [firstKind, ...otherKinds] = studioLinkFanKinds;
const newTileKind = z.enum([firstKind as string, ...otherKinds] as [string, ...string[]]);

/** The commands as the tool schema lists them: one shape each, no aliases. */
const advertised = {
  addAction: z.strictObject({
    type: z.literal("addAction"),
    lane: studioLaneSchema,
    name: studioLaneActionNameSchema.optional(),
    system: system.optional(),
  }),
  renameAction: z.strictObject({
    type: z.literal("renameAction"),
    lane: studioLaneSchema,
    name: studioLaneActionNameSchema,
  }),
  removeAction: z.strictObject({ type: z.literal("removeAction"), lane: studioLaneSchema }),
  addTile: z.strictObject({
    type: z.literal("addTile"),
    from: laneFromSchema,
    tile: z.strictObject({
      name: tileName,
      kind: newTileKind,
      id: id.optional(),
      description: tileDescription.optional(),
    }),
    link: link.optional(),
    linkId: id.optional(),
    system: system.optional(),
  }),
  linkTiles: z.strictObject({
    type: z.literal("linkTiles"),
    from: laneFromSchema,
    to: id,
    link: link.optional(),
    linkId: id.optional(),
  }),
  removeTile: z.strictObject({
    type: z.literal("removeTile"),
    tile: id,
    alsoRemove: z.array(id).max(studioLimits.elements).optional(),
  }),
  removeLink: z.strictObject({ type: z.literal("removeLink"), link: id }),
  setEntryLane: z.strictObject({
    type: z.literal("setEntryLane"),
    entry: id,
    lane: studioLaneSchema,
  }),
  editTile: z.strictObject({
    type: z.literal("editTile"),
    tile: id,
    name: tileName.optional(),
    description: tileDescription.optional(),
    owner: id.nullable().optional(),
  }),
  setSetting: z.strictObject({
    type: z.literal("setSetting"),
    tile: id.optional(),
    module: id.optional(),
    setting: z.string().min(1).max(64),
    value: settingValue,
  }),
  editSystem: z.strictObject({
    type: z.literal("editSystem"),
    name: tileName.optional(),
    description: tileDescription.optional(),
  }),
  editConnection: z.strictObject({
    type: z.literal("editConnection"),
    connection: id,
    label: studioActionSchema,
  }),
  addModule: z.strictObject({
    type: z.literal("addModule"),
    host: id,
    kind: studioComponentKindSchema,
    name: moduleName.optional(),
    description: moduleDescription.optional(),
    id: id.optional(),
  }),
  connectModule: z.strictObject({
    type: z.literal("connectModule"),
    module: id,
    slot: studioModuleSlotIdSchema,
    target,
  }),
  disconnectModule: z.strictObject({ type: z.literal("disconnectModule"), link: id }),
  removeModule: z.strictObject({ type: z.literal("removeModule"), module: id }),
  editModule: z.strictObject({
    type: z.literal("editModule"),
    module: id,
    name: moduleName.optional(),
    description: moduleDescription.optional(),
  }),
  setRunnableProcesses: z.strictObject({
    type: z.literal("setRunnableProcesses"),
    on: z.boolean(),
  }),
};
export type ChatCommandType = keyof typeof advertised;
export const chatCommandTypes = Object.keys(advertised) as ChatCommandType[];

/** The command union the tool schema lists. */
export const chatCommandSchema = z.discriminatedUnion(
  "type",
  Object.values(advertised) as unknown as [
    (typeof advertised)[ChatCommandType],
    ...(typeof advertised)[ChatCommandType][],
  ],
);
export type ChatCommand = z.infer<typeof chatCommandSchema>;

/**
 * What the parser also accepts, so a model that writes the studio's own shape (or a review's fix
 * as the spec states it) isn't refused for it: a settings object on an edit, `side`, a full owner,
 * `edit`/`editComponent` for editTile/editModule, `planned.label` on a connection, any tile kind
 * (the builder then refuses a legacy kind in plain words), and the legacy component commands.
 */
const settingsPatch = z.record(z.string(), settingValue);
const owner = z.union([id, studioOwnerSchema]).nullable();
const lenient: Record<string, z.ZodType> = {
  ...advertised,
  addTile: advertised.addTile.extend({
    side: z.literal("after").optional(),
    tile: z.strictObject({
      name: tileName,
      kind: studioKindSchema,
      id: id.optional(),
      description: tileDescription.optional(),
    }),
  }),
  editTile: advertised.editTile.extend({
    owner: owner.optional(),
    settings: settingsPatch.optional(),
  }),
  edit: z.strictObject({
    type: z.literal("edit"),
    element: id,
    name: tileName.optional(),
    description: tileDescription.optional(),
    owner: owner.optional(),
    settings: settingsPatch.optional(),
  }),
  editModule: advertised.editModule.extend({ settings: settingsPatch.optional() }),
  editComponent: z.strictObject({
    type: z.literal("editComponent"),
    component: id,
    name: moduleName.optional(),
    description: moduleDescription.optional(),
    settings: settingsPatch.optional(),
  }),
  editConnection: z.strictObject({
    type: z.literal("editConnection"),
    connection: id,
    label: studioActionSchema.optional(),
    planned: z.strictObject({ label: studioActionSchema }).optional(),
  }),
  removeComponent: studioCommandSchema.options.find(
    (option) => option.shape.type.value === "removeComponent",
  ) as z.ZodType,
  disconnectComponent: studioCommandSchema.options.find(
    (option) => option.shape.type.value === "disconnectComponent",
  ) as z.ZodType,
};

/** Each command's shape in one line, for the tool description and every refusal. */
export const chatCommandShapes: Record<ChatCommandType, string> = {
  addAction: 'addAction {lane: "download"|"upload", name?, system?: {name}}',
  renameAction: "renameAction {lane, name}",
  removeAction: "removeAction {lane}",
  addTile:
    'addTile {from: {lane: "download"|"upload"} or {tile: id}, tile: {name, kind, id?, description?}, link?: "sync"|"async", linkId?, system?: {name}}',
  linkTiles: 'linkTiles {from: {lane} or {tile: id}, to: tile id, link?: "sync"|"async", linkId?}',
  removeTile: "removeTile {tile, alsoRemove?: [tile ids]}",
  removeLink: "removeLink {link: link or entry id}",
  setEntryLane: "setEntryLane {entry, lane}",
  editTile: "editTile {tile, name?, description?, owner?: tile id that writes this store, or null}",
  setSetting:
    "setSetting {tile or module, setting, value}: one row of getDesign.editableSettings; value null clears a process setting",
  editSystem: "editSystem {name?, description?}",
  editConnection: "editConnection {connection, label}",
  addModule: "addModule {host: tile id, kind: module kind, name?, description?, id?}",
  connectModule: "connectModule {module, slot, target: {tile: id} or {module: id}}",
  disconnectModule: "disconnectModule {link: module link id}",
  removeModule: "removeModule {module}",
  editModule: "editModule {module, name?, description?}",
  setRunnableProcesses: "setRunnableProcesses {on: true|false}",
};

/** Command names a model reaches for, and the command that does it. */
const insteadOf: Record<string, string> = {
  edit: "editTile",
  editElement: "editTile",
  updateTile: "editTile",
  renameTile: "editTile",
  setOwner: "editTile",
  setTileOwner: "editTile",
  setStoreOwner: "editTile",
  editSettings: "setSetting",
  setSettings: "setSetting",
  updateSettings: "setSetting",
  editSetting: "setSetting",
  updateSetting: "setSetting",
  setTileSetting: "setSetting",
  setModuleSetting: "setSetting",
  setSignIn: "setSetting",
  addLink: "linkTiles",
  connectTiles: "linkTiles",
  connect: "linkTiles",
  link: "linkTiles",
  addConnection: "linkTiles",
  addEntry: "linkTiles",
  deleteTile: "removeTile",
  deleteLink: "removeLink",
  removeConnection: "removeLink",
  removeEntry: "removeLink",
  editComponent: "editModule",
  renameModule: "editModule",
  updateModule: "editModule",
  deleteModule: "removeModule",
  addComponent: "addModule",
  createModule: "addModule",
  connectSlot: "connectModule",
  connectComponent: "connectModule",
  createComponent: "addModule",
  setSystem: "editSystem",
  renameSystem: "editSystem",
  addSystem: "editSystem",
  enableRunnableProcesses: "setRunnableProcesses",
  setProcesses: "setRunnableProcesses",
  runnableProcesses: "setRunnableProcesses",
};
/** Studio commands chat never sends, with why. */
const refusedTypes: Record<string, string> = {
  changeKind:
    "A tile's kind can't be changed: remove the tile and add one of the right kind (the fan's kinds), or keep it.",
  createComponent:
    "Add a module with addModule and connect it with connectModule; its generation and ownership are derived in the same step.",
  connectComponent:
    "Connect a module with connectModule; its generation and ownership are derived in the same step.",
};

export type CommandProblem = {
  /** 1-based position in the batch. */
  command: number;
  type?: string;
  problem: string;
  /** The shape the command takes, when it has a known type. */
  takes?: string;
};

const shapeOf = (type: string | undefined) =>
  type && Object.hasOwn(chatCommandShapes, type)
    ? chatCommandShapes[type as ChatCommandType]
    : type && Object.hasOwn(insteadOf, type)
      ? chatCommandShapes[insteadOf[type] as ChatCommandType]
      : undefined;

/** One command checked against its shape: the parsed command, or what is wrong with it. */
export function parseChatCommand(
  raw: unknown,
  index: number,
): { ok: true; command: ParsedCommand } | { ok: false; problem: CommandProblem } {
  const command = index + 1;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return {
      ok: false,
      problem: {
        command,
        problem: 'A command is an object with a type, such as {type: "addTile", …}.',
      },
    };
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== "string")
    return {
      ok: false,
      problem: {
        command,
        problem: `It has no type. The commands are ${chatCommandTypes.join(", ")}.`,
      },
    };
  if (Object.hasOwn(refusedTypes, type))
    return { ok: false, problem: { command, type, problem: refusedTypes[type] as string } };
  const parser = Object.hasOwn(lenient, type) ? lenient[type] : undefined;
  if (!parser) {
    const instead = insteadOf[type];
    return {
      ok: false,
      problem: {
        command,
        type,
        problem: instead
          ? `There is no "${type}" command; use ${instead}.`
          : `There is no "${type}" command. The commands are ${chatCommandTypes.join(", ")}.`,
        ...(instead && { takes: chatCommandShapes[instead as ChatCommandType] }),
      },
    };
  }
  const parsed = parser.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      problem: {
        command,
        type,
        problem: z
          .prettifyError(parsed.error)
          .replaceAll("\n  → at ", " (at ")
          .replace(/✖ /g, "")
          .split("\n")
          .map((line) => (line.includes(" (at ") ? `${line})` : line))
          .join("; "),
        ...(shapeOf(type) && { takes: shapeOf(type) }),
      },
    };
  return { ok: true, command: parsed.data as ParsedCommand };
}

/** A parsed command: an advertised one, or one of the accepted studio shapes. */
export type ParsedCommand =
  | ChatCommand
  | {
      type: "edit";
      element: string;
      name?: string;
      description?: string;
      owner?: string | { kind: "element" | "package"; id: string } | null;
      settings?: Record<string, string | number | boolean | null>;
    }
  | {
      type: "editComponent";
      component: string;
      name?: string;
      description?: string;
      settings?: Record<string, string | number | boolean | null>;
    }
  | Extract<StudioCommand, { type: "removeComponent" | "disconnectComponent" }>;

type Patch = Record<string, string | number | boolean | null>;
const tileOf = (design: DesignDocument, tile: string) =>
  design.architecture?.studio?.elements.find((item) => item.element === tile);
const moduleOf = (design: DesignDocument, module: string) =>
  design.architecture?.studio?.components?.find((item) => item.id === module);
const label = (design: DesignDocument, target: { element: string } | { component: string }) =>
  "element" in target
    ? (design.elements.find((item) => item.id === target.element)?.name ?? target.element)
    : (moduleOf(design, target.component)?.name ?? target.component);

/** A control's values in words: "an integer 1–300000" or "one of required, optional". */
function supportedText(
  supported: { values: readonly (string | number)[] } | { integer: { min: number; max: number } },
) {
  return "values" in supported
    ? `one of ${supported.values.join(", ")}`
    : `an integer ${supported.integer.min}–${supported.integer.max}`;
}

/**
 * Settings merged into a tile's or module's own, checked against its normal controls first, so a
 * refusal says which settings it has and what each takes. A value is matched leniently: a number
 * written as text, or a choice in another case.
 */
function mergeSettings(
  design: DesignDocument,
  installed: GenerationInstalledSupport,
  target: { element: string } | { component: string },
  patch: Patch,
): Record<string, unknown> {
  const current =
    "element" in target
      ? tileOf(design, target.element)?.settings
      : moduleOf(design, target.component)?.settings;
  if (!current)
    throw new Error(
      "element" in target
        ? `There is no tile "${target.element}".`
        : `There is no module "${target.component}".`,
    );
  const controls = normalSettingFields(design, installed, target);
  const next: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  const name = label(design, target);
  const available = () =>
    controls.length
      ? `${name}'s editable settings: ${controls
          .map(
            (control) =>
              `${String(control.sourcePaths[0]?.at(-1))} (${supportedText(control.supported)}, now ${JSON.stringify(control.value ?? null)})`,
          )
          .join("; ")}.`
      : `${name} has no editable settings now; getDesign.editableSettings lists every one.`;
  for (const [key, raw] of Object.entries(patch)) {
    if (raw !== null && Object.is(next[key], raw)) continue;
    const control = controls.find((item) => item.sourcePaths[0]?.at(-1) === key);
    if (!control) {
      // The same value it already has, such as a full settings object sent back, is no change.
      if (key in next && JSON.stringify(next[key]) === JSON.stringify(raw)) continue;
      throw new Error(`${name} has no editable setting "${key}". ${available()}`);
    }
    if (raw === null) {
      if (!control.process)
        throw new Error(
          `${key} can't be cleared on ${name}; give it ${supportedText(control.supported)}.`,
        );
      delete next[key];
      continue;
    }
    let value: string | number | boolean = raw;
    if ("integer" in control.supported) {
      if (typeof value === "string" && /^-?\d+$/.test(value.trim())) value = Number(value.trim());
      const { min, max } = control.supported.integer;
      if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
        throw new Error(
          `${key} on ${name} takes ${supportedText(control.supported)}, not ${JSON.stringify(raw)}.`,
        );
    } else {
      const wanted = String(value).toLowerCase();
      const match = control.supported.values.find((item) => String(item).toLowerCase() === wanted);
      if (match === undefined)
        throw new Error(
          `${key} on ${name} takes ${supportedText(control.supported)}, not ${JSON.stringify(raw)}.`,
        );
      value = match;
    }
    next[key] = value;
  }
  return next;
}

const ownerOf = (value: string | { kind: "element" | "package"; id: string } | null | undefined) =>
  value === undefined
    ? {}
    : { owner: typeof value === "string" ? { kind: "element" as const, id: value } : value };

/**
 * The one studio command a chat command sends on `design`: IDs filled in from names, a setting
 * merged into the target's own settings (as the inspector field sends them).
 */
export function compileChatCommand(
  design: DesignDocument,
  command: ParsedCommand,
  installed: GenerationInstalledSupport,
): StudioCommand {
  switch (command.type) {
    case "addTile": {
      const { tile, linkId, from, link: mode, system: named } = command;
      const tileId = tile.id ?? newNamedTileId(design, tile.name, tile.kind as never);
      return {
        type: "addTile",
        from,
        side: "after",
        tile: {
          id: tileId,
          name: tile.name,
          kind: tile.kind as never,
          ...(tile.description !== undefined && { description: tile.description }),
        },
        linkId: linkId ?? newLinkId(design, from, tileId, [tileId]),
        ...(mode && { link: mode }),
        ...(named && { system: named }),
      };
    }
    case "linkTiles":
      return {
        type: "linkTiles",
        from: command.from,
        to: command.to,
        linkId: command.linkId ?? newLinkId(design, command.from, command.to),
        ...(command.link && { link: command.link }),
      };
    case "editTile":
    case "edit": {
      const element = command.type === "edit" ? command.element : command.tile;
      const settings =
        "settings" in command && command.settings
          ? mergeSettings(design, installed, { element }, command.settings)
          : undefined;
      return {
        type: "edit",
        element,
        ...(command.name !== undefined && { name: command.name }),
        ...(command.description !== undefined && { description: command.description }),
        ...ownerOf(command.owner),
        ...(settings && { settings: settings as never }),
      };
    }
    case "setSetting": {
      if (!command.tile === !command.module)
        throw new Error("Name either the tile or the module whose setting this is.");
      const target: { element: string } | { component: string } = command.tile
        ? { element: command.tile }
        : { component: command.module as string };
      const settings = mergeSettings(design, installed, target, {
        [command.setting]: command.value,
      });
      return "element" in target
        ? { type: "edit", element: target.element, settings: settings as never }
        : { type: "editComponent", component: target.component, settings: settings as never };
    }
    case "editModule":
    case "editComponent": {
      const component = command.type === "editComponent" ? command.component : command.module;
      const settings =
        "settings" in command && command.settings
          ? mergeSettings(design, installed, { component }, command.settings)
          : undefined;
      return {
        type: "editComponent",
        component,
        ...(command.name !== undefined && { name: command.name }),
        ...(command.description !== undefined && { description: command.description }),
        ...(settings && { settings: settings as StudioComponent["settings"] }),
      };
    }
    case "editConnection": {
      const planned = (command as { planned?: { label?: string } }).planned;
      const text = command.label ?? planned?.label;
      if (!text) throw new Error("Give the connection's new label.");
      return { type: "editConnection", connection: command.connection, planned: { label: text } };
    }
    default:
      return command as StudioCommand;
  }
}

/**
 * A studio command (a review's fix, a pattern's step) in chat's own form, so what chat is told to
 * send is what its schema lists. An edit with settings becomes one setSetting per changed setting.
 */
export function toChatCommands(design: DesignDocument, command: StudioCommand): ChatCommand[] {
  switch (command.type) {
    case "addTile": {
      const { side: _side, tile, ...rest } = command;
      return [
        {
          ...rest,
          tile: {
            name: tile.name,
            kind: tile.kind,
            id: tile.id,
            ...(tile.description !== undefined && { description: tile.description }),
          },
        } as ChatCommand,
      ];
    }
    case "edit": {
      const out: ChatCommand[] = [];
      const { element, name, description, owner, settings } = command;
      if (name !== undefined || description !== undefined || owner !== undefined)
        out.push({
          type: "editTile",
          tile: element,
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(owner !== undefined && { owner: owner?.kind === "element" ? owner.id : null }),
        });
      if (settings)
        out.push(...settingChanges(tileOf(design, element)?.settings, settings, { tile: element }));
      return out;
    }
    case "editComponent": {
      const out: ChatCommand[] = [];
      const { component, name, description, settings } = command;
      if (name !== undefined || description !== undefined)
        out.push({
          type: "editModule",
          module: component,
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
        });
      if (settings)
        out.push(
          ...settingChanges(moduleOf(design, component)?.settings, settings, { module: component }),
        );
      return out;
    }
    case "editConnection":
      return command.planned?.label
        ? [{ type: "editConnection", connection: command.connection, label: command.planned.label }]
        : [];
    case "changeKind":
    case "createComponent":
    case "connectComponent":
    case "removeComponent":
    case "disconnectComponent":
      return [];
    default:
      return [command as ChatCommand];
  }
}

function settingChanges(
  before: object | undefined,
  after: object,
  target: { tile: string } | { module: string },
): ChatCommand[] {
  const old = (before ?? {}) as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(old), ...Object.keys(next)])].filter(
    (key) => JSON.stringify(old[key]) !== JSON.stringify(next[key]),
  );
  return keys.map((setting) => ({
    type: "setSetting" as const,
    ...target,
    setting,
    value: (next[setting] ?? null) as string | number | boolean | null,
  }));
}

/** The kinds a new tile can be, by the names the fan shows, for refusals. */
export const newTileKinds = studioLinkFanKinds.map(
  (kind) => `${kind} (${studioDefinitions[kind].name})`,
);
