/**
 * The design chat agent's tools: a finite studio vocabulary on the lane canvas. They act on a
 * working copy of the design: edits are checked with the same `buildStudioCommand` and
 * `applyOperations` the canvas uses and collected, and the whole turn is committed as one
 * operation at the end, so one chat turn is one undo step. Tiles and links change only through
 * the lane commands, so chat keeps every tile on a lane, as the canvas does.
 */
import type { ToolDefinition } from "@jeeves/providers";
import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  type Finding,
  LANE_ACTOR,
  type LaneGraph,
  laneGraph,
  laneLimits,
  type OperationInput,
  type StudioLane,
  studioCommandSchema,
  studioComponentDefinitions,
  studioComponentKinds,
  studioDefinitions,
  studioKindSchema,
  studioLanes,
  studioTileDefinitions,
  studioTileTypes,
  tileTypeOf,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import type { ChatActivity, ChatQuestion } from "../db/schema.ts";

export const INSTRUCTIONS = `You are Jeeves's architecture studio assistant. You edit one design on the lane canvas with a finite vocabulary of design-only building blocks. You do not implement software.

The lane canvas:
- One actor, the user (a mobile and desktop user), is always there. It is not a tile; you never add, edit or remove it. It starts two lanes: download (receive, view, consume) and upload (create, post). A lane entry links the user to the first tile of that path.
- A tile has at most one entry, in one lane.
- Every tile hangs off a lane: the design is one graph rooted at the user, with no islands and no cycles. Add a tile only next to a tile or a lane, never on its own.
- A link is sync (a request, drawn solid) or async (doesn't wait, drawn dashed). Whatever follows an async link happens later, so slow side work forks off asynchronously, for example Redirect service --async--> Click events (queue) --async--> Analytics worker.
- Resources are end tiles: a database, cache, storage or search index never links onward. Fork at the service instead: it links to its cache and to its database.
- Link table (source -> target: modes). User -> a service (not a worker), API, storage or external API: sync (a lane entry). Application (a Service or API kind other than the CDN) -> database, cache, storage, search, CDN: sync. Application -> application or external API: sync or async. Application -> queue: async (publish). Queue -> application: async (consume). External API -> application: sync or async. CDN -> application or storage: sync.
- Caps: at most ${laneLimits.outgoingLinks} outgoing links per tile and ${laneLimits.entriesPerLane} entries per lane.

Tools: listStudioDefinitions lists the tile types, their kinds and the module kinds; describeStudioDefinition gives a kind's exact settings. getDesign returns baseRevision, the lanes (each with its entries), every tile in lane order (kind, settings, links with their modes, modules) and the findings.

Commands (applyStudioCommands, with getDesign's baseRevision):
- addTile: a new tile after a tile, after a lane (from {"lane": "download"} or {"lane": "upload"}, side "after", link "sync"), or before a tile (it takes over every link into that tile). It starts with its kind's default settings; follow with edit to change them. A new database, cache, storage or queue is owned by the application it is added next to. A design with no system starts with an addTile from a lane that passes system {name}.
- linkTiles: links a lane or a tile to a tile already on the canvas (a merge).
- setEntryLane: moves an entry to the other lane ("download" or "upload"), within that lane's cap.
- removeTile: removes a tile and links its predecessors to its successors where the table allows. If that would cut tiles off, the refusal names them; list them in alsoRemove only when the person wants them removed too.
- removeLink: removes a link or a lane entry, unless that cuts a tile off.
- changeKind: switches a tile to another kind of its tile type, as the inspector's kind row does; its settings start from that kind's defaults.
- edit (a tile's name, purpose, settings or owner), editSystem (the system name and goal), editConnection (a link's label, protocol, interaction, access and settings). Settings are complete values, not patches.
- createComponent, editComponent, connectComponent, disconnectComponent, removeComponent: modules inside an application tile. A module reaches other tiles only through its tile's own links.
IDs are lowercase slugs, unique across the design. Name a new link "source-target" and a new entry "lane-target", as the canvas does.

Several commands and calls in one turn commit together as one undo step. A refused call changes nothing and says why in plain words: fix the command, or explain the rule to the person; never work around a lane rule. A revision conflict stops the turn without overwriting the person's edit; ask them to send again.

Only names and purposes, the system goal, finite settings, ownership, links and modules are editable. There are no route, schema, entity, business-policy or free-form config editors, and no module stands in for business behavior: keep that behavior in the goal and name it as an implementation obligation. Provider choices are intent; nothing is deployed, provisioned or verified because a tile or provider was chosen.

Keep designs small and readable: a few tiles per lane (at most 15 to start), short names, useful purposes. Docker is the default intent for a new service. No provider setup or credentials. Ask one focused askUser question only when the answer changes the architecture, then end the turn. Reply briefly with what changed and what remains open. Messages beginning [Jeeves] are caller context; "this" or "the selected" means its selected identities (a tile, link or entry on the canvas).`;

const schemas = {
  listStudioDefinitions: z.strictObject({}),
  describeStudioDefinition: z.strictObject({ kind: studioKindSchema }),
  getDesign: z.strictObject({}),
  applyStudioCommands: z.strictObject({
    baseRevision: z.int().nonnegative(),
    commands: z.array(studioCommandSchema).min(1).max(50),
  }),
  validateDesign: z.strictObject({}),
  askUser: z.strictObject({
    question: z.string().min(1).max(500),
    choices: z.array(z.string().min(1).max(120)).min(1).max(6),
    allowFreeText: z.boolean().default(true),
  }),
};
type ToolName = keyof typeof schemas;
const descriptions: Record<ToolName, string> = {
  listStudioDefinitions:
    "List the tile types with their kinds, the module kinds and the lane caps. Design only; none supplies a runtime or verification.",
  describeStudioDefinition:
    "Read a kind's exact settings JSON Schema, defaults, inspector fields and implementation obligations.",
  getDesign:
    "Read the saved baseRevision, the system, both lanes, every tile in lane order with its kind, settings, links (sync or async) and modules, and the current findings.",
  applyStudioCommands:
    "Prepare commands against getDesign.baseRevision with the canvas's own command builder and validation. Tiles and links change only through addTile, linkTiles, removeTile, removeLink, changeKind and setEntryLane. All accepted changes in this turn commit once; concurrent edits stop the turn. Settings are complete values, not patches.",
  validateDesign: "Read current readiness findings. Findings do not establish runtime support.",
  askUser: "Ask a focused question with clickable choices, then end the turn.",
};

export function toolDefinitions(): ToolDefinition[] {
  return (Object.keys(schemas) as ToolName[]).map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(schemas[name], { io: "input" }) as Record<string, unknown>,
  }));
}

const caps = {
  linksPerTile: laneLimits.outgoingLinks,
  entriesPerLane: laneLimits.entriesPerLane,
};

/** The tile types the canvas offers, each with its kinds (the first is the default). */
function catalogSummary() {
  return {
    tileTypes: studioTileTypes.map((type) => ({
      type,
      name: studioTileDefinitions[type].name,
      kinds: studioTileDefinitions[type].kinds.map((kind) => ({
        kind,
        name: studioDefinitions[kind].name,
        description: studioDefinitions[kind].description,
      })),
    })),
    modules: studioComponentKinds.map((kind) => {
      const { name, description, targets } = studioComponentDefinitions[kind];
      return { kind, name, description, uses: targets };
    }),
    caps,
  };
}

/** The tiles one lane reaches, breadth-first from its entries: the canvas's lane order. */
function laneTiles(graph: LaneGraph, lane: StudioLane): string[] {
  const order: string[] = [];
  const visit = (id: string) => {
    if (!order.includes(id)) order.push(id);
  };
  for (const edge of graph.edges) if (edge.lane === lane) visit(edge.target);
  for (let index = 0; index < order.length; index += 1)
    for (const edge of graph.edges)
      if (!edge.lane && edge.source === order[index]) visit(edge.target);
  return order;
}

/**
 * The design as chat sees it: the lanes with their entries and tiles, then every tile in lane
 * order with its kind, settings, outgoing links (sync or async) and modules.
 */
function designSummary(design: DesignDocument, findings: readonly Finding[]) {
  const studio = design.architecture?.studio;
  const graph = laneGraph(design);
  const elements = new Map(design.elements.map((item) => [item.id, item]));
  const bindings = new Map(studio?.elements.map((item) => [item.element, item]));
  const connections = new Map(design.connections.map((item) => [item.id, item]));
  const linkSettings = new Map(studio?.connections.map((item) => [item.connection, item.settings]));
  const modules = (host: string) =>
    (studio?.components ?? [])
      .filter((item) => item.host === host)
      .map((item) => ({
        id: item.id,
        name: item.name,
        ...(item.description && { description: item.description }),
        settings: item.settings,
        links: (studio?.componentConnections ?? [])
          .filter((link) => link.from === item.id)
          .map(({ id, to }) => ({ id, to })),
      }));
  return {
    baseRevision: design.revision,
    system: design.architecture
      ? {
          name: design.architecture.system.name,
          description: design.architecture.system.description,
        }
      : null,
    lanes: studioLanes.map((lane) => ({
      lane,
      entries: graph.edges
        .filter((edge) => edge.lane === lane)
        .map((edge) => ({ id: edge.id, tile: edge.target })),
      tiles: laneTiles(graph, lane),
    })),
    tiles: graph.nodes
      .filter((node) => node.id !== LANE_ACTOR)
      .map((node) => {
        const element = elements.get(node.id);
        const binding = bindings.get(node.id);
        const hosted = modules(node.id);
        return {
          id: node.id,
          name: element?.name,
          ...(element?.description && { description: element.description }),
          ...(node.kind && { type: tileTypeOf(node.kind), kind: node.kind }),
          ...(binding?.owner && { owner: binding.owner }),
          settings: binding?.settings,
          links: graph.edges
            .filter((edge) => edge.source === node.id)
            .map((edge) => ({
              id: edge.id,
              to: edge.target,
              mode: edge.async ? "async" : "sync",
              planned: connections.get(edge.id)?.planned,
              settings: linkSettings.get(edge.id),
            })),
          ...(hosted.length && { modules: hosted }),
        };
      }),
    caps,
    findings,
    availability: "Studio definitions describe design intent only.",
  };
}

/** The design summary sent as caller context at the start of each turn. */
export function turnContext(
  design: DesignDocument,
  findings: readonly Finding[],
  selection: readonly string[],
) {
  return `[Jeeves] Studio context.\nTile types (finite, design only):\n${JSON.stringify(catalogSummary())}\nCurrent design:\n${JSON.stringify(designSummary(design, findings))}\nSelected identities: ${JSON.stringify(selection)}`;
}

const commandTypes: readonly string[] = studioCommandSchema.options.map(
  (option) => option.shape.type.value,
);

/** A command type outside the vocabulary, refused in plain words. */
function unknownCommand(args: unknown): string | undefined {
  const commands = args && typeof args === "object" && "commands" in args ? args.commands : [];
  for (const command of Array.isArray(commands) ? commands : []) {
    const type = command && typeof command === "object" && "type" in command && command.type;
    if (typeof type === "string" && !commandTypes.includes(type))
      return `There is no "${type}" command. The commands are ${commandTypes.join(", ")}. Tiles and links are added and removed only with addTile, linkTiles, removeTile and removeLink, which keep every tile on a lane.`;
  }
  return undefined;
}

/** The working copy one turn edits, plus what the turn has done so far. */
export class Workspace {
  /** Edits not committed yet, in order. */
  pending: OperationInput[] = [];
  question: ChatQuestion | undefined;
  activity: ChatActivity[] = [];

  constructor(
    /** The committed design the pending edits apply to. */
    public base: DesignDocument,
    public working: DesignDocument = base,
  ) {}

  /** Starts over from a newer committed design, dropping pending edits. */
  reset(base: DesignDocument) {
    this.base = base;
    this.working = base;
    this.pending = [];
  }

  /** Runs one tool call and returns its JSON result for the model. */
  run(name: string, rawArgs: string): string {
    return JSON.stringify(this.dispatch(name, rawArgs));
  }

  log(tool: string, ok: boolean, summary: string) {
    this.activity.push({ tool, ok, summary });
  }

  private dispatch(name: string, raw: string): unknown {
    if (!Object.hasOwn(schemas, name)) {
      this.log(name, false, `Unknown tool ${name}`);
      return {
        ok: false,
        error: `There is no tool named "${name}". Use finite studio commands; business, schema and route edits are not supported.`,
      };
    }
    const tool = name as ToolName;
    let json: unknown;
    try {
      json = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      this.log(tool, false, "Malformed arguments");
      return { ok: false, error: "Arguments must be valid JSON." };
    }
    const parsed = schemas[tool].safeParse(json);
    if (!parsed.success) {
      const unknown = unknownCommand(json);
      this.log(tool, false, unknown ?? "Arguments refused; nothing changed");
      return {
        ok: false,
        error: unknown ?? z.prettifyError(parsed.error),
        note: "Nothing changed for this call. Business/schema/route inputs are unavailable.",
      };
    }
    switch (tool) {
      case "listStudioDefinitions":
        this.log(tool, true, "Listed the tile types and kinds");
        return {
          ...catalogSummary(),
          availability: "Design only; no runtime or verification supplied.",
        };
      case "describeStudioDefinition": {
        const { kind } = parsed.data as z.infer<typeof schemas.describeStudioDefinition>;
        const { settingsSchema, ...definition } = studioDefinitions[kind];
        this.log(tool, true, `Read studio ${kind} settings`);
        return {
          ...definition,
          settingsSchema: z.toJSONSchema(settingsSchema, { io: "input" }),
          availability: "Design only; no runtime or verification supplied.",
        };
      }
      case "getDesign":
        this.log(tool, true, "Read the studio design");
        return {
          ...designSummary(this.working, validateDesign(this.working)),
          baseRevision: this.base.revision,
        };
      case "validateDesign":
        this.log(tool, true, "Checked design readiness");
        return { findings: validateDesign(this.working) };
      case "askUser":
        this.question = parsed.data as z.infer<typeof schemas.askUser>;
        this.log(tool, true, "Asked a question");
        return { ok: true, note: "End this turn; the answer comes as a new message." };
      case "applyStudioCommands":
        return this.applyCommands(parsed.data as z.infer<typeof schemas.applyStudioCommands>);
    }
  }

  private applyCommands({
    baseRevision,
    commands,
  }: z.infer<typeof schemas.applyStudioCommands>): unknown {
    const tool = "applyStudioCommands";
    if (baseRevision !== this.base.revision) {
      this.log(tool, false, "Base revision mismatch; nothing prepared");
      return {
        ok: false,
        error: "Revision conflict. Read getDesign before preparing commands.",
        baseRevision: this.base.revision,
      };
    }
    let working = this.working;
    const ops: OperationInput[] = [];
    const refused = (message: string) => {
      this.log(tool, false, `Refused: ${message}`);
      return { ok: false, error: message, note: "Nothing changed for this call." };
    };
    for (const [index, command] of commands.entries()) {
      // In a call with several commands, say which one was refused.
      const which = commands.length > 1 ? `Command ${index + 1} (${command.type}): ` : "";
      try {
        const batch = buildStudioCommand(working, command);
        const result = applyOperations(working, batch.ops);
        if (!result.ok) return refused(which + result.errors.map((item) => item.message).join(" "));
        working = result.design;
        ops.push(...batch.ops);
      } catch (error) {
        return refused(which + (error instanceof Error ? error.message : String(error)));
      }
    }
    this.working = working;
    this.pending.push(...ops);
    this.log(
      tool,
      true,
      `Prepared ${commands.length} studio command${commands.length === 1 ? "" : "s"}`,
    );
    return {
      ok: true,
      commands: commands.length,
      findings: validateDesign(working),
      note: "Prepared for one atomic turn commit, not saved yet.",
    };
  }
}
