/**
 * The design chat agent's tools (PLAN §7): a finite studio vocabulary. They act on a working copy
 * of the design: edits are checked with the same `buildStudioCommand` and `applyOperations` the
 * studio uses and collected, and the whole turn is committed as one operation at the end, so one
 * chat turn is one undo step.
 */
import type { ToolDefinition } from "@jeeves/providers";
import {
  applyOperations,
  buildStudioCommand,
  type DesignDocument,
  type Finding,
  type OperationInput,
  resolveStudioDefinition,
  resolveStudioPackagePreset,
  studioCommandSchema,
  studioDefinitions,
  studioKindSchema,
  studioPackagePresets,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import type { ChatActivity, ChatQuestion } from "../db/schema.ts";

export const INSTRUCTIONS = `You are Jeeves's architecture studio assistant. Select, connect and configure a finite vocabulary of design-only building blocks. You do not implement software.
Use listStudioDefinitions and describeStudioDefinition for the exact settings, defaults, scope and implementation obligations. getDesign returns the current studio summary. Provider selections describe intent; they never deploy, provision or verify behavior. A service package groups independent services and is not another runtime. A shared queue has one identity/owner at C3; C2 summarizes its producer/consumer connections.
Use applyStudioCommands with the saved baseRevision from getDesign. It calls the same strict command builder, validation, revision and history transport as manual edits. Several commands/tools in one turn commit atomically as one undo step. An error changes nothing for that call; fix it or explain the gap. A concurrent revision stops the turn without overwriting the person's edit; ask them to send again after inspecting it.
The only editable inputs are names/purposes, the system goal, finite studio settings, logical resource ownership, package membership and typed connections. Use editSystem.description for a concise stated project goal and element.description for purpose. Preserve existing declarations; the shared builder does this.
There are no route, request/response schema, entity/field, access/business policy, lifecycle/effect, arbitrary config JSON or custom module editors. Do not invent a configurable module to satisfy requested business behavior. Keep that behavior in the person's goal context and explain the implementation obligation; never promise it exists because a card or provider was selected.
Start with a small understandable graph (at most 15 initial applications/resources), useful purposes and verb labels. Docker is the default intent for a new managed service. Describe shared resources accurately, and select explicit identities, not reuse by name. No provider setup or credentials. Ask a focused askUser question only if it changes the architecture materially; end after asking. Reply briefly with what changed and what remains unimplemented. Messages beginning [Jeeves] are caller context.`;

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
    "List the finite design-only studio definitions and package presets. None supplies a runtime or verification.",
  describeStudioDefinition:
    "Read exact finite settings JSON Schema, defaults, inspector fields, creation scopes and implementation obligations for a kind.",
  getDesign: "Read the saved baseRevision, the working studio summary and current findings.",
  applyStudioCommands:
    "Prepare finite commands against getDesign.baseRevision. The exact manual builder and semantic validation apply. All accepted changes in this turn commit once; concurrent edits stop the turn. Settings are complete union values, not patches.",
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

function catalogSummary() {
  return Object.values(studioDefinitions).map(
    ({ id, version, kind, name, description, creationScopes }) => ({
      id,
      version,
      kind,
      name,
      description,
      creationScopes,
    }),
  );
}

function designSummary(design: DesignDocument, findings: readonly Finding[]) {
  return {
    baseRevision: design.revision,
    system: design.architecture && {
      name: design.architecture.system.name,
      description: design.architecture.system.description,
    },
    context: design.architecture && {
      nodes: design.architecture.nodes,
      relationships: design.architecture.relationships,
    },
    elements: (design.architecture?.studio?.elements ?? []).map((binding) => {
      const element = design.elements.find((item) => item.id === binding.element);
      return { ...binding, name: element?.name, description: element?.description };
    }),
    packages: design.architecture?.studio?.packages ?? [],
    connections: design.connections.map((item) => ({
      id: item.id,
      from: item.from.element,
      to: item.to.element,
      kind: item.kind,
      display: item.planned,
      settings: design.architecture?.studio?.connections.find(
        (binding) => binding.connection === item.id,
      )?.settings,
    })),
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
  return `[Jeeves] Studio context.\nCatalog (finite, design only):\n${JSON.stringify(catalogSummary())}\nCurrent design:\n${JSON.stringify(designSummary(design, findings))}\nSelected identities: ${JSON.stringify(selection)}`;
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
      this.log(tool, false, "Arguments refused; nothing changed");
      return {
        ok: false,
        error: z.prettifyError(parsed.error),
        note: "Nothing changed for this call. Business/schema/route inputs are unavailable.",
      };
    }
    switch (tool) {
      case "listStudioDefinitions":
        this.log(tool, true, "Listed finite studio definitions");
        return {
          definitions: catalogSummary(),
          packagePresets: studioPackagePresets,
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
    try {
      for (const command of commands) {
        if (command.type === "create") {
          for (const element of command.elements)
            if (element.definition && !resolveStudioDefinition(element.definition))
              throw new Error("Choose a known studio definition and version.");
        }
        const pkg =
          command.type === "create" || command.type === "group" ? command.package : undefined;
        if (pkg?.preset && !resolveStudioPackagePreset(pkg.preset))
          throw new Error("Choose a known studio package preset.");
        const batch = buildStudioCommand(working, command);
        const result = applyOperations(working, batch.ops);
        if (!result.ok) {
          this.log(tool, false, "Studio edit refused; nothing prepared for this call");
          return { ok: false, errors: result.errors, note: "Nothing changed for this call." };
        }
        working = result.design;
        ops.push(...batch.ops);
      }
    } catch (error) {
      this.log(tool, false, "Studio command refused; nothing prepared for this call");
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        note: "Nothing changed for this call.",
      };
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
