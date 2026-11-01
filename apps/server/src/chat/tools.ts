/**
 * The design chat agent's tools (PLAN §7). They act on a working copy of the design: edits are
 * checked with the same `applyOperations` the API uses and collected, and the whole turn is
 * committed as one operation at the end, so one chat turn is one undo step.
 */
import type { ToolDefinition } from "@jeeves/providers";
import type { Registry } from "@jeeves/registry";
import {
  applyOperations,
  componentCompatible,
  type DesignDocument,
  type FindingCode,
  findingCatalog,
  findingCodes,
  idSchema,
  type OperationInput,
  operationSchema,
  plannedCapabilities,
  plannedCapability,
  plannedConfigSchema,
  reviewTemplateUpgrade,
  subtypeDiscards,
  templateRefSchema,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import type { ChatActivity, ChatQuestion } from "../db/schema.ts";

const argsSchemas = {
  listTemplates: z.strictObject({}),
  describeTemplate: z.strictObject({
    id: z.string().describe("Template ID from listTemplates"),
    version: z.string().optional().describe("Exact version; latest if omitted"),
  }),
  listPlannedCapabilities: z.strictObject({
    scope: z.enum(["container", "component"]).optional(),
  }),
  describePlannedCapability: z.strictObject({
    id: z.string().describe("Capability ID from listPlannedCapabilities"),
  }),
  getDesign: z.strictObject({}),
  reviewSubtype: z.strictObject({ id: idSchema, template: templateRefSchema.nullable() }),
  applyOperations: z.strictObject({
    ops: z
      .array(operationSchema)
      .min(1)
      .max(200)
      .describe("Operations, applied in order, all-or-nothing"),
  }),
  validateDesign: z.strictObject({}),
  explainFinding: z.strictObject({
    code: z.enum(findingCodes),
    element: z.string().optional().describe("Element the finding is about, if any"),
  }),
  askUser: z.strictObject({
    question: z.string().min(1).max(500),
    choices: z.array(z.string().min(1).max(120)).min(1).max(6),
    allowFreeText: z.boolean().default(true).describe("Also let the person type their own answer"),
  }),
} as const;

export type ToolName = keyof typeof argsSchemas;

const descriptions: Record<ToolName, string> = {
  listTemplates:
    "List every template in the registry: element templates (with their kind) and attachment templates.",
  describeTemplate:
    "Full details of one template: config JSON Schema with defaults, presets, ports (connection kinds, direction, required), and attachment slots.",
  listPlannedCapabilities:
    "List design-only C2 container and C3 component families. These are planned, have no runtime, and block generation. Filter by scope if needed.",
  describePlannedCapability:
    "Read a planned family's options, defaults, config JSON Schema and compatible component host roles. Container IDs go in element.planned with template:null; component IDs go in architecture.components[].capability, never in template IDs.",
  reviewSubtype:
    "Request a revision-bound subtype change review. Lists all discarded configuration/components/connections with human Confirm/Cancel buttons. End your turn and wait; never supply confirmation yourself.",
  getDesign: "The current design document (with your pending edits applied) and its findings.",
  applyOperations:
    "Edit the design. Ops: addElement, upgradeTemplate (only reviewed compatible same-template paths, exact from/to and current revision; preserves configuration and wiring), changeSubtype (use reviewSubtype for destructive changes), updateElement, removeElement, addAttachment, updateAttachment, removeAttachment, connect, disconnect, setNotes, addAnnotation, updateAnnotation, removeAnnotation, updateConnection (C4 label/protocol/interaction), setArchitecture (replaces the whole C1 context and C3 components/relationships; read getDesign and preserve existing entries). Planned containers use template:null, planned:<catalog ID>, config, description and technology; planned connections use planned:{label,protocol,interaction,security}. The batch applies all-or-nothing; a refusal returns errors and changes nothing. Returns the findings after the edit.",
  validateDesign: "The current findings (readiness problems) of the design, with pending edits.",
  explainFinding: "What a finding code means and how to resolve it.",
  askUser:
    "Ask the person a question with clickable choices. Use only when the answer changes the design materially. End your turn after calling it.",
};

export function toolDefinitions(): ToolDefinition[] {
  return (Object.keys(argsSchemas) as ToolName[]).map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(argsSchemas[name], { io: "input" }) as Record<string, unknown>,
  }));
}

const explanations: Record<FindingCode, string> = {
  ARCHITECTURE_UNBOUND:
    "Choose the existing container that realizes this context interaction, or leave it explicitly as architectural intent. Context edges do not generate network calls.",
  RECIPE_INCOMPATIBLE:
    "Restore the versioned recipe contract or create a separate custom design; recipe-provided implementation cannot be silently redefined.",
  DUPLICATE_ID: "Two items share an ID. IDs must be unique across the whole design; pick another.",
  UNKNOWN_REFERENCE: "Something refers to an ID that doesn't exist. Check the IDs with getDesign.",
  UNKNOWN_TEMPLATE:
    'The template ID or version isn\'t in the registry. Use listTemplates for runtimes or listPlannedCapabilities for design intent; planned containers need a known planned ID and "template": null.',
  TEMPLATE_KIND_MISMATCH:
    "An element template was used as an attachment or the other way round. Check the kind in listTemplates.",
  CONFIG_INVALID:
    "A config value is malformed or the key doesn't exist. Read the config schema with describeTemplate or describePlannedCapability.",
  ATTACHMENT_INCOMPATIBLE:
    "The element's template has no slot for this attachment, or the slot is full. See attachmentSlots in describeTemplate.",
  PORT_INCOMPATIBLE:
    "Neither end has a port for this connection kind and direction, or a port's accepts rule refuses the other end. Connections join outer elements; if several compatible capabilities fit, choose the capability in the inspector (fromCapability/toCapability). Attachments are never connection endpoints.",
  PORT_MULTIPLICITY: "The port allows a single connection and already has one.",
  DUPLICATE_CONNECTION: "The same connection already exists.",
  NEEDS_TEMPLATE:
    "The element has no template yet. It can't be generated until a template exists; planned capabilities describe intent only and block generation too. Keep unsupported requirements in notes.",
  CONFIG_REQUIRED:
    "A required config value has no default. Set it with updateElement or updateAttachment.",
  UNCONNECTED_REQUIRED_PORT:
    "A required port has no connection, e.g. a REST API client must call a REST API server.",
  INVALID_OPERATION:
    "An operation is malformed. Check its fields against the applyOperations schema.",
  REVISION_CONFLICT:
    "The design changed underneath. Read it again with getDesign and redo the edit.",
};

/** The working copy one turn edits, plus what the turn has done so far. */
export class Workspace {
  /** Edits not committed yet, in order. */
  pending: OperationInput[] = [];
  question: ChatQuestion | undefined;
  activity: ChatActivity[] = [];

  constructor(
    private readonly registry: Registry,
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
    const result = this.dispatch(name, rawArgs);
    return JSON.stringify(result);
  }

  private dispatch(name: string, rawArgs: string): unknown {
    if (!(name in argsSchemas)) {
      this.log(name, false, `Unknown tool ${name}`);
      return { ok: false, error: `There is no tool named "${name}".` };
    }
    const tool = name as ToolName;
    let json: unknown;
    try {
      json = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    } catch {
      this.log(tool, false, "Malformed arguments");
      return { ok: false, error: "The arguments aren't valid JSON." };
    }
    const parsed = argsSchemas[tool].safeParse(json);
    if (!parsed.success) {
      // applyOperations reports malformed ops itself, with their index.
      if (tool !== "applyOperations" || !Array.isArray((json as { ops?: unknown })?.ops)) {
        this.log(tool, false, "Malformed arguments");
        return { ok: false, error: z.prettifyError(parsed.error) };
      }
    }
    const args = (parsed.success ? parsed.data : json) as never;
    switch (tool) {
      case "listTemplates":
        return this.listTemplates();
      case "describeTemplate":
        return this.describeTemplate(args);
      case "listPlannedCapabilities": {
        const { scope } = args as z.infer<typeof argsSchemas.listPlannedCapabilities>;
        this.log(tool, true, "Listed planned capabilities");
        return {
          availability: "planned; no runtime; blocks generation",
          capabilities: plannedCapabilities
            .filter((entry) => !scope || entry.scope === scope)
            .map(({ id, name, scope, role, description }) => ({
              id,
              name,
              scope,
              role,
              description,
            })),
        };
      }
      case "describePlannedCapability": {
        const { id } = args as z.infer<typeof argsSchemas.describePlannedCapability>;
        const entry = plannedCapability(id);
        this.log(
          tool,
          !!entry,
          entry ? `Read planned capability ${entry.name}` : `No planned capability ${id}`,
        );
        if (!entry)
          return {
            ok: false,
            error: `There is no planned capability "${id}". Use listPlannedCapabilities; never invent IDs.`,
          };
        return {
          capability: entry,
          availability: "planned; no runtime; blocks generation",
          configSchema: z.toJSONSchema(plannedConfigSchema(id), { io: "input" }),
          ...(entry.scope === "component" && {
            compatibleHostRoles: ["frontend", "service", "worker", "database", "external"].filter(
              (role) => componentCompatible(entry, role),
            ),
          }),
        };
      }
      case "getDesign":
        this.log(tool, true, "Read the design");
        return { design: this.working, findings: validateDesign(this.working, this.registry) };
      case "reviewSubtype": {
        const { id, template } = args as z.infer<typeof argsSchemas.reviewSubtype>;
        const element = this.working.elements.find((e) => e.id === id);
        if (!element) return { ok: false, error: "Unknown element" };
        if (this.pending.length)
          return {
            ok: false,
            error:
              "Finish pending edits before proposing a revision-bound subtype review in a new turn.",
          };
        if (element.template && template?.id === element.template.id) {
          const upgrade = reviewTemplateUpgrade(this.working, id, template, this.registry);
          this.log(
            tool,
            upgrade.ok,
            upgrade.ok ? "Read compatible template upgrade" : "Template upgrade unavailable",
          );
          return {
            ok: upgrade.ok,
            upgrade,
            note: "Same-template versions use upgradeTemplate, preserving the application. Use the returned exact id/from/to/revision in applyOperations when this upgrade is requested; never use destructive subtype confirmation for a version change.",
          };
        }
        const discarded = subtypeDiscards(this.working, element);
        this.question = {
          question: `Change subtype of ${element.name}? Discard: ${discarded.join("; ") || "no customized data"}.`,
          choices: ["Confirm subtype change", "Cancel"],
          allowFreeText: false,
          subtypeReview: { id, template, revision: this.working.revision, discarded },
        };
        this.log(tool, true, "Requested human subtype review");
        return {
          ok: true,
          review: this.question,
          note: "End your turn. The human applies or cancels this review directly in the UI.",
        };
      }
      case "applyOperations":
        return this.applyOperations(args);
      case "validateDesign": {
        const findings = validateDesign(this.working, this.registry);
        this.log(tool, true, `Checked the design: ${plural(findings.length, "finding")}`);
        return { findings };
      }
      case "explainFinding":
        return this.explainFinding(args);
      case "askUser":
        return this.askUser(args);
    }
  }

  private listTemplates() {
    this.log("listTemplates", true, "Listed templates");
    const latest = new Map(this.registry.list().map((m) => [m.id, m]));
    return {
      templates: [...latest.values()].map((m) => ({
        id: m.id,
        version: m.version,
        kind: m.kind,
        elementKind: m.kind === "element" ? m.elementKind : undefined,
        displayName: m.displayName,
        description: m.description,
      })),
    };
  }

  private describeTemplate({ id, version }: z.infer<(typeof argsSchemas)["describeTemplate"]>) {
    const ref = version ? { id, version } : this.registry.latest(id);
    const description = ref && this.registry.describe({ id, version: ref.version });
    if (!description) {
      this.log("describeTemplate", false, `No template ${id}${version ? `@${version}` : ""}`);
      return {
        ok: false,
        error: `There is no template "${id}"${version ? ` at ${version}` : ""}.`,
      };
    }
    this.log("describeTemplate", true, `Read template ${description.displayName}`);
    return { template: description };
  }

  private applyOperations({ ops }: { ops: OperationInput[] }) {
    const result = applyOperations(this.working, ops, this.registry, {
      allowSubtypeConfirmation: false,
    });
    if (!result.ok) {
      this.log("applyOperations", false, `Edit refused: ${result.errors[0]?.message ?? "invalid"}`);
      return { ok: false, errors: result.errors, note: "Nothing was changed." };
    }
    this.working = result.design;
    this.pending.push(...ops);
    this.log("applyOperations", true, `Prepared ${plural(ops.length, "change")}`);
    return { ok: true, applied: ops.length, findings: result.findings };
  }

  private explainFinding({ code, element }: z.infer<(typeof argsSchemas)["explainFinding"]>) {
    this.log("explainFinding", true, `Looked up ${code}`);
    const findings = validateDesign(this.working, this.registry).filter(
      (f) => f.code === code && (!element || f.target.element === element),
    );
    return { code, ...findingCatalog[code], explanation: explanations[code], current: findings };
  }

  private askUser(question: z.infer<(typeof argsSchemas)["askUser"]>) {
    this.question = question;
    this.log("askUser", true, "Asked a question");
    return {
      ok: true,
      note: "The question is shown with your choices. End your turn now; the answer comes as the next message.",
    };
  }

  log(tool: string, ok: boolean, summary: string) {
    this.activity.push({ tool, ok, summary });
  }
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
