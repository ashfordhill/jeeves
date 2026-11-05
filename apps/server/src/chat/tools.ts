/**
 * The design chat agent's tools (PLAN §7). They act on a working copy of the design: edits are
 * checked with the same `applyOperations` the API uses and collected, and the whole turn is
 * committed as one operation at the end, so one chat turn is one undo step.
 */
import type { ToolDefinition } from "@jeeves/providers";
import {
  applyOperations,
  architecturePatterns,
  architectureProofOperations,
  architectureReview,
  backendPolicyConsumers,
  componentCompatible,
  contractCanonical,
  contractSources,
  type DesignDocument,
  describeArchitecturePattern,
  type FindingCode,
  findingCatalog,
  findingCodes,
  idSchema,
  libraryInsertSchema,
  noTemplates,
  type OperationInput,
  operationSchema,
  patternConfigSchema,
  patternRequestSchema,
  plannedCapabilities,
  plannedCapability,
  plannedConfigSchema,
  previewArchitecturePattern,
  previewArchitectureTemplate,
  proofSteps,
  resolveContractSource,
  reviewArchitecture,
  reviewTemplateUpgrade,
  scenarioReview,
  subtypeDiscards,
  suggestArchitectureAnnotations,
  templateRefSchema,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import type { ArchitectureLibrary } from "../architecture/library.ts";
import type { ChatActivity, ChatQuestion } from "../db/schema.ts";
import { runStudioTool, studioToolDefinitions } from "./studio.ts";

const argsSchemas = {
  listPlannedCapabilities: z.strictObject({
    scope: z.enum(["container", "component"]).optional(),
  }),
  describePlannedCapability: z.strictObject({
    id: z.string().describe("Capability ID from listPlannedCapabilities"),
  }),
  listArchitectureLibrary: z.strictObject({ query: z.string().max(200).optional() }),
  describeArchitectureLibrary: z.strictObject({
    id: idSchema,
    version: templateRefSchema.shape.version,
  }),
  previewArchitectureLibrary: libraryInsertSchema,
  applyArchitectureLibrary: libraryInsertSchema,
  listArchitecturePatterns: z.strictObject({}),
  listArchitectureStudies: z.strictObject({}),
  previewArchitectureStudyStage: z.strictObject({
    product: z.enum(["qrwty", "inventory"]),
    stage: z.enum(["start", "tenant", "delivery", "billing", "lookup", "behavior"]),
    baseRevision: z.int().nonnegative(),
  }),
  applyArchitectureStudyStage: z.strictObject({
    product: z.enum(["qrwty", "inventory"]),
    stage: z.enum(["start", "tenant", "delivery", "billing", "lookup", "behavior"]),
    baseRevision: z.int().nonnegative(),
  }),
  describeArchitecturePattern: z.strictObject({
    id: idSchema,
    version: z.literal("1.0.0").default("1.0.0"),
    variant: z.enum(["standard", "best-effort", "transactional-outbox"]).default("standard"),
    config: patternConfigSchema.optional(),
  }),
  previewArchitecturePattern: patternRequestSchema,
  applyArchitecturePattern: patternRequestSchema,
  getDesign: z.strictObject({}),
  getArchitectureContracts: z.strictObject({}),
  getArchitectureReview: z.strictObject({}),
  getArchitectureAnnotationDraft: z.strictObject({}),
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
  listPlannedCapabilities:
    "List design-only C2 container and C3 component families. These are planned, have no runtime, and block generation. Filter by scope if needed.",
  describePlannedCapability:
    "Read a planned family's options, defaults, config JSON Schema and compatible component host roles. Container IDs go in element.planned with template:null; component IDs go in architecture.components[].capability, never in template IDs.",
  reviewSubtype:
    "Request a revision-bound subtype change review. Lists all discarded configuration/components/connections with human Confirm/Cancel buttons. End your turn and wait; never supply confirmation yourself.",
  getArchitectureContracts:
    "Inspect project-local contracts/local types, backend entities/aggregates/queries/accessPolicies/accessBindings and exact affected query/byte/output/operation/capability paths, provided/required interfaces, relationship bindings, dataset authority/access/lifecycle, scoped unverified objectives, separate design review findings and authoritative REST/resource/durable-event sources with exact saved snapshots. Use these stable ownership references in setArchitecture; never duplicate or edit source shapes. Referenced versions are immutable except name/description; create an explicit version and review instances to update.",
  getArchitectureAnnotationDraft:
    "Suggest editable context and responsibility annotations from explicit saved auth/resource/extension bindings. Returns an architecture draft with revision and source references. Review and edit names/responsibilities, then apply using setArchitecture. Operation names do not prove behavior. Preserve provenance and existing architecture.",
  getArchitectureReview:
    "Read requirement-based architecture review with concern groups, assumptions, linked inputs, fingerprints, completion and decisions. Save reviewRequirements and decisions using setArchitecture; preserve other metadata. Accepted decisions need context, decision/reason, consequence, linked identities and exact finding/fingerprint acknowledgements. Contradictions cannot be acknowledged away. Changed relevant inputs expire acceptance; no review supplies runtime evidence or changes Generate. Ordinary planning edits need no additional approval.",
  listArchitectureLibrary:
    "Search the local published architecture-only library. Returns exact immutable versions and content hashes; runtime availability is separate.",
  describeArchitectureLibrary:
    "Read an exact local architecture version, required roles, interfaces, guarantees, exposed finite options and extension points. Retired entries remain describable but cannot be inserted.",
  previewArchitectureLibrary:
    "Preview the exact published local version using the same fragment binding rules as mouse insertion. Keep contentHash and getDesign.patternBaseRevision. Required roles cannot be created implicitly; incompatible exact contracts/guarantees block insertion.",
  applyArchitectureLibrary:
    "Apply the previewed local version as editable instances in one undoable chat turn. Preserve pinned version/content hash. Ordinary supplied planning edits need no separate approval. Never replay on a concurrent revision.",
  listArchitecturePatterns:
    "List four versioned architecture patterns and their variants. Design intent only; no runtime adoption.",
  listArchitectureStudies:
    "List bounded QRWTY and Inventory architecture composition exercises and their ordered stages. Start only in an empty project. Numerical policies are illustrative examples; production objectives remain unresolved. No live adoption or runtime implementation.",
  previewArchitectureStudyStage:
    "Preview a supplied study stage using the same operation builder and validators as the mouse workshop. Use getDesign.patternBaseRevision, including pending edits. Inspect exact contracts, policies, scenario paths and open decisions; prose cannot replace semantic fields or dismiss findings.",
  applyArchitectureStudyStage:
    "Apply a supplied QRWTY or Inventory study stage as editable architecture intent. Use the listed stage order and saved baseRevision. Ordinary supplied study choices need no separate approval. Whole chat turn is one undo step; stale revisions refuse all edits. No generation or verification is performed.",
  describeArchitecturePattern:
    "Read a pinned declarative fragment, required host/boundary roles, exact contracts, policies, invariants and extension points. Asynchronous delivery requires best-effort or transactional-outbox explicitly.",
  previewArchitecturePattern:
    "Preview additions and candidate role/relationship bindings at getDesign.patternBaseRevision (the saved base, including pending edits), using the same expansion as the editor. Unique compatible host roles resolve automatically; ambiguous stores/hosts require a choice. Non-host reuse requires explicit matching ownership, tenant scope, exact contracts and guarantees. No change is made.",
  applyArchitecturePattern:
    "Apply a versioned architecture pattern with fresh instanceId and explicit role choices in one validated edit. Use preview for ambiguity. Unfilled or incompatible roles and stale revisions change nothing. Ordinary unambiguous/provided choices need no extra approval. Expansion is editable intent, never runtime implementation or proof of outbox atomicity.",
  getDesign:
    "The current design document (with your pending edits applied) and its findings. architecture.deployments contains planned alternative environments: nested deployment/infrastructure nodes, instances referencing logical C2 identities (replicas 1–32), external references and interactions tracing exact logical relationships. Named channels remain separate on broker infrastructure. Legacy infrastructure mappings require source identity and review reason. No provisioning, generated wiring or observed health follows. Preserve all other architecture entries when editing deployments via setArchitecture. Scenarios use optional actor, startCondition, mainOutcomes, outcomes (text, invariants, requirements, decisions), alternatives (name, kind, condition, afterStep, steps, outcomes), and expectation review fingerprint. Steps reference connection, componentRelationship or contextRelationship; optional binding must match that relationship. Optional phase request/response/continuation preserves static direction; client component must be a screen-group coupled by the binding interface with an operation, and state is loading/success/denied/failed. Main and alternatives are bounded ordered paths, never loops or executable simulation. Keep legacy fields lossless; missing new fields remain incomplete. Read getArchitectureReview for scenario fingerprints/status and record review only when asked; this never records a test result.",
  applyOperations:
    "Edit the design. Ops: addElement, upgradeTemplate (only reviewed compatible same-template paths, exact from/to and current revision; preserves configuration and wiring), changeSubtype (use reviewSubtype for destructive changes), updateElement, removeElement, addAttachment, updateAttachment, removeAttachment, connect, disconnect, setNotes, addAnnotation, updateAnnotation, removeAnnotation, updateConnection (C4 label/protocol/interaction), setArchitecture (replaces the whole C1 context and C3 components/relationships; read getDesign and preserve existing entries). Element classification:{kind,ownership,operation} describes architectural intent independently of runtime host roles; system context has independent businessTenancy, authorization, dataIsolation and deliveryModel choices. Read their schemas from applyOperations. Planned containers use template:null, planned:<catalog ID>, config, description and technology; planned connections use planned:{label,protocol,interaction,security}. The batch applies all-or-nothing; a refusal returns errors and changes nothing. Returns the findings after the edit.",
  validateDesign: "The current findings (readiness problems) of the design, with pending edits.",
  explainFinding: "What a finding code means and how to resolve it.",
  askUser:
    "Ask the person a question with clickable choices. Use only when the answer changes the design materially. End your turn after calling it.",
};

export function toolDefinitions(profile?: "studio"): ToolDefinition[] {
  if (profile === "studio") return studioToolDefinitions();
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
    'Runtime templates are no longer available. Use listPlannedCapabilities for design intent; planned containers need a known planned ID and "template": null.',
  TEMPLATE_KIND_MISMATCH: "An element template was used as an attachment or the other way round.",
  CONFIG_INVALID:
    "A config value is malformed or the key doesn't exist. Read the config schema with describePlannedCapability.",
  ATTACHMENT_INCOMPATIBLE:
    "The element's template has no slot for this attachment, or the slot is full.",
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
  /** Pattern expansion cannot be replayed over a concurrent revision. */
  patternRevisionBound = false;
  reviewRevisionBound = false;
  annotationRevisionBound = false;
  deploymentRevisionBound = false;
  scenarioRevisionBound = false;
  question: ChatQuestion | undefined;
  activity: ChatActivity[] = [];

  constructor(
    /** The committed design the pending edits apply to. */
    public base: DesignDocument,
    public working: DesignDocument = base,
    private readonly projectName = "Application",
    private readonly library?: ArchitectureLibrary,
    public readonly profile?: "studio",
  ) {}

  /** Starts over from a newer committed design, dropping pending edits. */
  reset(base: DesignDocument) {
    this.base = base;
    this.working = base;
    this.pending = [];
    this.patternRevisionBound = false;
    this.reviewRevisionBound = false;
    this.annotationRevisionBound = false;
    this.deploymentRevisionBound = false;
    this.scenarioRevisionBound = false;
  }

  /** Runs one tool call and returns its JSON result for the model. */
  run(name: string, rawArgs: string): string {
    const result =
      this.profile === "studio" ? runStudioTool(this, name, rawArgs) : this.dispatch(name, rawArgs);
    return JSON.stringify(result);
  }

  private dispatch(name: string, rawArgs: string): unknown {
    if (!Object.hasOwn(argsSchemas, name)) {
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
      case "listPlannedCapabilities": {
        const { scope } = args as z.infer<typeof argsSchemas.listPlannedCapabilities>;
        this.log(tool, true, "Listed planned capabilities");
        return {
          availability: "planned; no runtime; blocks generation",
          capabilities: plannedCapabilities
            .filter((entry) => !scope || entry.scope === scope)
            .map(({ id, name, scope, role, architectureKind, description }) => ({
              id,
              name,
              scope,
              role,
              architectureKind,
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
      case "listArchitectureLibrary": {
        const entries =
          this.library?.list((args as z.infer<typeof argsSchemas.listArchitectureLibrary>).query) ??
          [];
        this.log(tool, true, "Listed local published architecture templates");
        return {
          entries: entries.map((entry) => ({
            id: entry.id,
            version: entry.version,
            name: entry.metadata.name,
            purpose: entry.metadata.purpose,
            contentHash: entry.contentHash,
            availability: entry.availability,
          })),
          availability: "architecture only",
        };
      }
      case "describeArchitectureLibrary": {
        const req = args as z.infer<typeof argsSchemas.describeArchitectureLibrary>;
        try {
          if (!this.library)
            return { ok: false, error: "Local architecture library is unavailable." };
          const entry = this.library.get(req.id, req.version);
          this.log(tool, true, "Read exact local architecture version");
          return { entry };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      }
      case "previewArchitectureLibrary":
      case "applyArchitectureLibrary": {
        const req = args as z.infer<typeof libraryInsertSchema>;
        try {
          if (!this.library)
            return { ok: false, error: "Local architecture library is unavailable." };
          const preview = previewArchitectureTemplate(
            { ...this.working, revision: this.base.revision },
            this.library.get(req.id, req.version),
            req,
            noTemplates,
          );
          this.log(tool, preview.ok, "Previewed exact local architecture version");
          if (tool === "previewArchitectureLibrary" || !preview.ok) return preview;
          return {
            ...this.applyOperations({ ops: preview.ops }),
            additions: preview.additions,
            patternBaseRevision: this.base.revision,
          };
        } catch (e) {
          this.log(tool, false, "Local architecture insertion refused");
          return { ok: false, error: (e as Error).message };
        }
      }
      case "listArchitecturePatterns":
        this.log(tool, true, "Listed architecture patterns");
        return {
          patterns: architecturePatterns.map((p) => ({ ...p, version: "1.0.0" })),
          availability: "Editable design intent; runtime support and verification are separate.",
        };
      case "listArchitectureStudies":
        this.log(tool, true, "Listed architecture studies");
        return {
          studies: (["qrwty", "inventory"] as const).map((product) => ({
            product,
            stages: proofSteps(product),
          })),
          availability: "Architecture intent only; production objectives require owner decisions.",
        };
      case "previewArchitectureStudyStage":
      case "applyArchitectureStudyStage": {
        const request = args as z.infer<typeof argsSchemas.applyArchitectureStudyStage>;
        if (request.baseRevision !== this.base.revision)
          return {
            ok: false,
            error: "Study base revision changed; read the design and preview again.",
          };
        try {
          const base = { ...this.working, revision: this.base.revision };
          const ops = architectureProofOperations(
            base,
            request.product,
            request.stage,
            noTemplates,
          );
          const result = applyOperations(base, ops, noTemplates);
          if (!result.ok) return result;
          if (tool === "previewArchitectureStudyStage")
            return { ok: true, ops, review: reviewArchitecture(result.design) };
          this.log(tool, true, "Applied editable architecture study stage");
          return this.applyOperations({ ops });
        } catch (e) {
          this.log(tool, false, "Architecture study stage refused");
          return { ok: false, error: (e as Error).message };
        }
      }
      case "describeArchitecturePattern": {
        const { id, variant, config } = args as z.infer<
          typeof argsSchemas.describeArchitecturePattern
        >;
        try {
          const entry = architecturePatterns.find((p) => p.id === id);
          const fragment = describeArchitecturePattern(
            id,
            variant,
            config ?? { name: entry?.name ?? id },
          );
          this.log(tool, true, "Read architecture pattern");
          return { fragment, configSchema: z.toJSONSchema(patternConfigSchema, { io: "input" }) };
        } catch (error) {
          this.log(tool, false, "Unknown pattern or variant");
          return { ok: false, error: (error as Error).message };
        }
      }
      case "previewArchitecturePattern":
      case "applyArchitecturePattern": {
        const preview = previewArchitecturePattern(
          { ...this.working, revision: this.base.revision },
          args,
          noTemplates,
        );
        this.log(
          tool,
          preview.ok,
          preview.ok ? "Expanded architecture pattern" : "Pattern needs compatible role choices",
        );
        if (tool === "previewArchitecturePattern" || !preview.ok) return preview;
        return {
          ...this.applyOperations({ ops: preview.ops }),
          additions: preview.additions,
          review: preview.review,
          revision: this.working.revision,
          patternBaseRevision: this.base.revision,
        };
      }
      case "getArchitectureAnnotationDraft":
        if (this.pending.length)
          return {
            ok: false,
            error:
              "Save pending edits before requesting an annotation draft with saved source provenance.",
          };
        this.annotationRevisionBound = true;
        this.log(tool, true, "Read editable annotation suggestions with explicit sources");
        return {
          architecture: suggestArchitectureAnnotations(this.working, this.projectName),
          sourceRevision: this.base.revision,
        };
      case "getArchitectureReview":
        this.log(tool, true, "Read architecture review and decisions");
        return {
          ...reviewArchitecture(this.working),
          scenarios: (this.working.architecture?.scenarios ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            ...scenarioReview(this.working, s),
          })),
          requirements: this.working.architecture?.reviewRequirements ?? [],
          decisions: this.working.architecture?.decisions ?? [],
        };
      case "getArchitectureContracts":
        this.log(tool, true, "Read architecture contracts and sources");
        return {
          contracts: this.working.architecture?.contracts ?? [],
          backend: this.working.architecture?.backend ?? null,
          policyConsumers: (this.working.architecture?.backend?.accessPolicies ?? []).map(
            (policy) => ({
              policy: { id: policy.id, version: policy.version },
              consumers: backendPolicyConsumers(this.working, policy),
            }),
          ),
          backendAuthoring:
            "Use the shared setArchitecture schema from applyOperations. Preserve all existing entries. Contracts supply logical/local types; datasets supply authority; entities annotate those exact fields. Policies are finite trusted-context declarations, default deny/deny wins, with separate read/write projections and current-state recheck sites. Edit operations, lifecycles, effects, hooks and existing scenario outcomes together in one atomic turn. Effects select exact source/target versions, typed payload mappings, commit boundary, delivery identity and recovery refs. Pure hooks use ordered source actions; effectful hooks use after-commit effects with separate delivery failure operations. Missing hooks require unchanged 501/503 and no writes; malformed, failed, timed-out or cancelled hooks cannot claim success. Hook contracts/dependencies/acceptance refs are declarations, never implementations. Dangling targets and unknown options reject the whole batch; incomplete recovery remains specific findings. Referenced exact versions require explicit successors and consumer review. Local illustrative fixtures are design previews only, never runtime evidence.",
          interfaces: this.working.architecture?.interfaces ?? [],
          bindings: this.working.architecture?.bindings ?? [],
          datasets: this.working.architecture?.datasets ?? [],
          objectives: this.working.architecture?.objectives ?? [],
          review: architectureReview(this.working),
          sources: contractSources(this.working).map((item) => ({
            ...item,
            sourceSnapshot: contractCanonical(resolveContractSource(this.working, item.source)),
            sourceDesignRevision: this.base.revision,
          })),
        };
      case "getDesign":
        this.log(tool, true, "Read the design");
        return {
          design: this.working,
          patternBaseRevision: this.base.revision,
          findings: validateDesign(this.working, noTemplates),
        };
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
          const upgrade = reviewTemplateUpgrade(this.working, id, template, noTemplates);
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
          subtypeReview: {
            id,
            template,
            revision: this.working.revision,
            discarded,
          },
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
        const findings = validateDesign(this.working, noTemplates);
        this.log(tool, true, `Checked the design: ${plural(findings.length, "finding")}`);
        return { findings };
      }
      case "explainFinding":
        return this.explainFinding(args);
      case "askUser":
        return this.askUser(args);
    }
  }

  private applyOperations({ ops }: { ops: OperationInput[] }) {
    const result = applyOperations(this.working, ops, noTemplates, {
      allowSubtypeConfirmation: false,
    });
    if (!result.ok) {
      this.log("applyOperations", false, `Edit refused: ${result.errors[0]?.message ?? "invalid"}`);
      return { ok: false, errors: result.errors, note: "Nothing was changed." };
    }
    const priorPatterns = new Set(
      this.working.architecture?.patternInstances?.map((item) => item.id),
    );
    if (result.design.architecture?.patternInstances?.some((item) => !priorPatterns.has(item.id)))
      this.patternRevisionBound = true;
    if (
      ops.some((op) => op.op === "setArchitecture") &&
      (this.working.architecture?.decisions ||
        this.working.architecture?.reviewRequirements ||
        result.design.architecture?.decisions ||
        result.design.architecture?.reviewRequirements)
    )
      this.reviewRevisionBound = true;
    if (
      ops.some(
        (op) =>
          op.op === "setArchitecture" &&
          (op.architecture?.nodes?.some((n) => n.annotationOrigin) ||
            op.architecture?.components?.some((c) => c.annotationOrigin)),
      )
    )
      this.annotationRevisionBound = true;
    if (
      ops.some((op) => op.op === "setArchitecture") &&
      (this.working.architecture?.deployments || result.design.architecture?.deployments)
    )
      this.deploymentRevisionBound = true;
    if (
      ops.some((op) => op.op === "setArchitecture") &&
      (this.working.architecture?.scenarios || result.design.architecture?.scenarios)
    )
      this.scenarioRevisionBound = true;
    this.working = result.design;
    this.pending.push(...ops);
    this.log("applyOperations", true, `Prepared ${plural(ops.length, "change")}`);
    return { ok: true, applied: ops.length, findings: result.findings };
  }

  private explainFinding({ code, element }: z.infer<(typeof argsSchemas)["explainFinding"]>) {
    this.log("explainFinding", true, `Looked up ${code}`);
    const findings = validateDesign(this.working, noTemplates).filter(
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
