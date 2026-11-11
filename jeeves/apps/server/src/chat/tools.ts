/**
 * The design chat agent's tools: a finite studio vocabulary on the lane canvas, and tools that
 * carry the design knowledge so a modest model can build and review correct diagrams (V3-09, D6).
 * They act on a working copy of the design: edits are checked with the same command builder and
 * `applyOperations` the canvas uses and collected, and the whole turn is committed as one
 * operation at the end, so one chat turn is one undo step. Tiles and links change only through
 * the lane commands, so chat keeps every tile on a lane, as the canvas does. Every accepted
 * change returns an automatic review of what is left (`designReview`).
 */
import type { ToolDefinition } from "@jeeves/providers";
import {
  applyOperations,
  buildDesignScopeCommand,
  buildModulePattern,
  buildOperationsCommand,
  buildOwnershipCommand,
  buildSupportedAuthoringCommand,
  contractRecords,
  type DesignDocument,
  type DesignScope,
  designGeneration,
  designOperations,
  designOwnership,
  designReadiness,
  designReview,
  designScope,
  designScopeCommandSchema,
  emptyReviewScope,
  exactContractRefSchema,
  type Finding,
  type GenerationInstalledSupport,
  type GenerationSettingDecision,
  generationFindings,
  isDesignWarning,
  LANE_ACTOR,
  type LaneGraph,
  laneGraph,
  laneLimits,
  listModulePatterns,
  listStudioPatterns,
  type ModulePattern,
  ModulePatternRefusal,
  moduleGeneration,
  moduleGenerationLabels,
  moduleLinkSlot,
  modulePatternSchema,
  moduleStatuses,
  moduleTemplateNames,
  normalGenerationControls,
  type OperationInput,
  operationContractFindings,
  operationRecords,
  operationsCommandSchema,
  ownershipCommandSchema,
  ownershipFindings,
  previewDesignScope,
  previewOperations,
  previewOwnership,
  profileStatus,
  type Rekey,
  renamedIds,
  reviewScopeProblem,
  reviewStudioDesign,
  type StudioCommand,
  type StudioKind,
  type StudioLane,
  type StudioLinkRole,
  type StudioLinkRule,
  type StudioReviewScope,
  sameContractRef,
  selectedLogicalOwners,
  selectedOperationBindings,
  studioActionDefaults,
  studioActions,
  studioChanges,
  studioCommandSchema,
  studioComponentDefinitions,
  studioComponentKinds,
  studioDefinitions,
  studioKindLabel,
  studioKindLanguages,
  studioKindSchema,
  studioLimits,
  studioLinkFan,
  studioLinkFanGroups,
  studioLinkFanKinds,
  studioLinkRules,
  studioPatternCatalogVersion,
  studioPatternIdSchema,
  studioPatterns,
  studioReviewScopeSchema,
  studioStoreAccess,
  studioTileDefinitions,
  studioTileTypes,
  studioWarningSentence,
  supportedAuthoringCommandSchema,
  tileTypeOf,
  tinyurlDesignScope,
  unresolvedDesignScope,
  validateDesign,
} from "@jeeves/spec";
import { z } from "zod";
import type { ChatActivity, ChatQuestion } from "../db/schema.ts";
import { installedGenerationSupport } from "../generation/support.ts";

const roleWords: Record<StudioLinkRole, string> = {
  user: "user",
  action: "action",
  application: "application",
  cdn: "CDN",
  external: "external API",
  queue: "queue",
  store: "store",
};
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** One row of the link table in words: "Application -> queue: async (Publishes)." */
export function linkRuleText(rule: StudioLinkRule): string {
  const targets = rule.targets ? rule.targets.join(", ") : roleWords[rule.target];
  const modes =
    rule.modes.length > 1
      ? `${rule.modes.join(" or ")}, default ${rule.defaultMode}`
      : rule.defaultMode;
  const what = rule.source === "action" ? "a lane entry" : rule.connection?.label;
  return `${sentenceCase(roleWords[rule.source])} -> ${targets}: ${modes}${what ? ` (${what})` : ""}.`;
}
/** The link table, generated from `studioLinkRules` so the two can't drift. */
const linkTable = [
  "Source -> target: modes. A pair not listed is refused. An application is a Service or API kind other than the CDN; a store is a database, search index, cache or object storage. Sync is a direct call where the caller waits (solid); async is sent without waiting (dashed): through a queue or topic, or a direct async call between applications where the table allows it.",
  ...studioLinkRules.map(linkRuleText),
];
const actionWords = `${studioActionDefaults.download} (download) or ${studioActionDefaults.upload} (upload)`;
const legacyKinds = (Object.keys(studioDefinitions) as StudioKind[]).filter(
  (kind) => kind !== "browser" && !studioLinkFanKinds.includes(kind),
);

/**
 * A short prompt: the working loop and the few rules that hold everywhere. The rest of the
 * knowledge (the canvas, the link table, the catalogs, the patterns and what to fix) is in the
 * tools' descriptions and results.
 */
export const INSTRUCTIONS = `You are Jeeves's architecture studio assistant. You edit one design on the lane canvas with the same commands the mouse sends. You design; you do not implement software or claim runtime behavior.

Work in a loop: plan, preview, apply, review, fix.
- Plan: getDesign shows the design as the canvas draws it, with each module's status. listStudioDefinitions says what a new tile and a module can be, the link table and the caps. listStudioPatterns lists curated patterns (an upload pipeline, a cached read path, counting from events, search fed by events, sign-in, favorites, a store with one writer) with their arguments.
- Preview: previewCommands dry-runs a pattern or a batch of commands and returns the statuses and findings it would leave. Nothing is saved.
- Apply: applyPattern applies a pattern as one validated batch; applyStudioCommands applies commands. A refused call changes nothing and says why.
- Review: every accepted change returns an automatic review of what is left; reviewDesign gives the whole review. Each finding names its tile or module and a fix, often as commands.
- Fix: apply the fixes for findings marked fix, or say why one stays. Findings marked check are advice to confirm.

Rules:
- You can do exactly what the mouse can, and no more: new tiles are the link fan's kinds, modules come from the module catalog, and templates come only from modules. Never work around a refusal or invent a tile to get past a rule.
- Every tile hangs off a lane, with no cycles; stores never link onward; the user reaches a store only through a service.
- Only getDesign.editableSettings are normal settings, sent as complete values. Behavior the design can't represent stays an explicit unresolved requirement: a name, label or module never implements it.
- All edits in a turn commit together as one Undo step. Use the IDs the results give you; a rename re-keys IDs that follow names.
- Keep designs small and readable. Ask one focused askUser question only when the answer changes the architecture. Reply briefly with what changed and what is left. Messages beginning [Jeeves] are caller context; "this" or "the selected" means its selected identities.`;

/**
 * What `previewCommands` dry-runs: the commands that change the lanes, the modules and their
 * statuses (and an Auth guard's Sign-in). Tile settings, link labels and the retained source
 * commands have nothing to preview, and leaving them out keeps the strict tool schema small.
 */
const previewTypes: readonly string[] = [
  "addAction",
  "renameAction",
  "removeAction",
  "addTile",
  "linkTiles",
  "removeTile",
  "removeLink",
  "setEntryLane",
  "editSystem",
  "addModule",
  "connectModule",
  "disconnectModule",
  "removeModule",
  "editComponent",
  "setRunnableProcesses",
];
const previewCommandSchema = z.discriminatedUnion(
  "type",
  studioCommandSchema.options.filter((option) =>
    previewTypes.includes(option.shape.type.value),
  ) as unknown as typeof studioCommandSchema.options,
);

const schemas = {
  describeOperation: z.strictObject({ ref: exactContractRefSchema }),
  configureOperations: z.strictObject({
    baseRevision: z.int().nonnegative(),
    action: z.enum(["preview", "apply"]),
    ...operationsCommandSchema.shape,
  }),
  listStudioDefinitions: z.strictObject({}),
  describeStudioDefinition: z.strictObject({ kind: studioKindSchema }),
  listStudioPatterns: z.strictObject({}),
  describeStudioPattern: z.strictObject({ id: studioPatternIdSchema }),
  getDesign: z.strictObject({}),
  configureDesignScope: z.strictObject({
    baseRevision: z.int().nonnegative(),
    action: z.enum(["preview", "apply"]),
    ...designScopeCommandSchema.shape,
  }),
  configureOwnership: z.strictObject({
    baseRevision: z.int().nonnegative(),
    action: z.enum(["preview", "apply"]),
    ...ownershipCommandSchema.shape,
  }),
  applyStudioCommands: z.strictObject({
    baseRevision: z.int().nonnegative(),
    commands: z.array(supportedAuthoringCommandSchema).min(1).max(50),
  }),
  applyPattern: z.strictObject({
    baseRevision: z.int().nonnegative(),
    pattern: modulePatternSchema,
  }),
  previewCommands: z.strictObject({
    baseRevision: z.int().nonnegative(),
    commands: z.array(previewCommandSchema).min(1).max(50).optional(),
    pattern: modulePatternSchema.optional(),
  }),
  validateDesign: z.strictObject({}),
  readReadiness: z.strictObject({}),
  declareReviewScope: studioReviewScopeSchema,
  reviewDesign: z.strictObject({}),
  askUser: z.strictObject({
    question: z.string().min(1).max(500),
    choices: z.array(z.string().min(1).max(120)).min(1).max(6),
    allowFreeText: z.boolean().default(true),
  }),
};
type ToolName = keyof typeof schemas;
const descriptions: Record<ToolName, string> = {
  describeOperation:
    "Read an exact immutable Create/Resolve operation or positive-cache policy with schema/behavior hashes, outcomes and fixed bounds. Use an exact ref from getDesign.availableOperations or availableCachePolicies before binding one with configureOperations. Unknown exact refs remain unresolved, with no substitution. No HTTP runtime or verifier is supplied.",
  configureOperations:
    "Preview then stage a complete bounded replacement of exact API receiver implementations and entry/service-call expectations. Read describeOperation first. Preserve unrelated rows and unknown refs. Apply must match the latest preview; explicit v3 upgrade for legacy designs. Bind canonical element/lane/connection IDs and real role/edge endpoints, refine source read/write and cache read-and-fill grants, and retain unknown refs as unresolved. Never infer capabilities from tile names or modules, or treat raw headers as verified principals; operations belong to the same role/owner and add no service. Known auth/idempotency/schema/timeout contradictions refuse. Templates/runtime evidence remain none; Create verifier availability is separate.",
  listStudioDefinitions:
    "List what a new tile can be (the link fan's eleven kinds, each with its label), the tile types with their kinds and defaults, the module catalog (each kind's slots, the tiles that hold it, what it becomes there: Template, Part of a template or Stub, and its one-line description), the link table, the caps, the design warnings and notes on preconfigured kinds. Design only; none supplies a runtime or verification.",
  describeStudioDefinition:
    "Read a kind's diagnostic source schema and historical defaults. These are preserved design intent, not editable choices; getDesign.editableSettings supplies actual normal controls.",
  listStudioPatterns:
    "List the curated patterns applyPattern builds (what each makes, the templates it yields and each argument with its default) and the four reviewed guidance records (cache-aside lookup, durable background job, publication-to-search, pending-order/payment). Use them before building or substantially restructuring a design; a trivial rename does not need retrieval. Retrieval alone does not establish that a pattern applies: state the scope and assumptions you chose.",
  describeStudioPattern:
    "Read one reviewed guidance record: roles, required relationships, variants, invariant/failure checklist, sources, topology-only example and precise unsupported implementation obligations. Read its support limitations and obligations before proposing commands. Examples marked commands are topology-only starting points; examples marked obligation describe unsupported lifecycle contracts and must not become fake solution tiles. Never split an owner or invent a service to bypass a callback/cycle, ownership or lane restriction. No runtime template or verification is supplied.",
  getDesign:
    "Read the design compactly, as the canvas draws it: baseRevision; the system; the actions (lane, name, entries and the tiles each lane reaches); every tile in lane order with its kind and label, settings, links (sync or async, and whether a link into a store writes or reads) and modules (kind, slots' links, and status: template, stub, custom or refused, with why); whether Runnable processes is on; editableSettings, the only normal settings; findings and warnings; and the persistent scope, ownership and operation declarations the configure tools edit.",
  configureDesignScope:
    "Preview or stage persistent profile and included/excluded/custom requirements using the mouse form's command. For schema v2 first preview this exact scope, then apply with upgrade:true; omission never upgrades. Preserve unknown profile versions and existing custom requirements unless asked to replace them. Required custom slugs, mutable destinations, disable/management, reputation, quotas or exact analytics block tinyurl-create-resolve@1.0.0: retain the requirement instead of erasing it or claiming support. No owner/API/runtime contracts are implemented by selection; unknown profiles and unsupported required behavior remain unresolved. All accepted turn edits commit once.",
  configureOwnership:
    "Preview then stage exact logical owners, canonical API/worker roles, resource authority/source-projection intent, role grants and store dependency access. Use a complete ownership replacement, preserving unrelated declarations. Preview exact dependent removals/transfers first; apply must match the latest preview. Explicit v3 upgrade required for legacy designs. Existing element IDs identify roles; co-deployment grants nothing; no owners or grants follow from names, modules or packages. Cache read and fill needs read-write. Foreign writes refuse; foreign reads need a deliberate published-read contract or an owned projection. Module commands derive the ownership their templates need. Declarations only: operation bindings are separate and runtime authorization is unavailable.",
  applyStudioCommands:
    'Apply commands against getDesign.baseRevision with the canvas\'s own command builder and validation. Actions, tiles and links: addAction, renameAction, removeAction (by lane); addTile (a tile of one of listStudioDefinitions.tileKinds after a tile, or from {"lane": "download"} or {"lane": "upload"}; side is "after"; leave link out for the pair\'s default mode); linkTiles; setEntryLane; removeTile (alsoRemove only the tiles the person wants removed); removeLink. Names and values: edit (a tile\'s name, description, editable settings as complete values, or owner), editSystem, editConnection (label only). Modules: addModule (host, kind; optional id, name, description), connectModule (module, slot, target {"tile": id}, or {"module": id} for an in-process slot such as a Cache reader\'s loader or Favorites\' items), disconnectModule (link), removeModule (module), editComponent (name, description, editable settings such as an Auth guard\'s signIn); each module command derives every module\'s generation and the ownership it needs in the same step. setRunnableProcesses (on: true or false) turns Runnable processes on or off for export, as Generate project\'s checkbox does; only a design built from modules can turn it on. A design with no system starts with addAction or addTile passing system {name}. IDs are lowercase slugs; name a new link "source-target" and a new entry "lane-target". Refused: new tiles of the legacy kinds (Gateway, Redirect, Notifications, Billing), changeKind, createComponent/connectComponent (use addModule/connectModule), and removeComponent/disconnectComponent once modules generate code. All accepted changes in a turn commit once; concurrent edits stop the turn. The result lists renamed IDs and an automatic review of what is left.',
  applyPattern:
    "Apply one curated pattern from listStudioPatterns as one validated batch: pattern {id, ...its arguments}. A tile argument reuses an existing tile named so (by ID or name), or names a new one; defaults are reused the same way, so patterns applied in turn share tiles. Every step is a command the mouse could send, checked with the same builder; one refused step refuses the whole pattern and nothing changes. The result lists the tiles and modules added and an automatic review of what is left.",
  previewCommands:
    "Dry-run either one pattern (as applyPattern takes it) or commands that change the lanes and modules (as applyStudioCommands takes them: the lane commands, editSystem, the module commands, editComponent and setRunnableProcesses) on the working design. Returns what would change, every module's resulting status with why, and the review findings it would leave. Nothing is prepared or saved; the working design is unchanged.",
  validateDesign: "Read current readiness findings. Findings do not establish runtime support.",
  readReadiness:
    "Read the same snapshot compatibility report as the mouse and blueprint v3: design validity, exact contract completeness, implementation availability and exact-output runtime evidence are separate stages. Generation eligibility needs the first three, never future output evidence; eligible does not mean verified. Read-only; supplies no registry, generator or runtime proof and does not replace staged review.",
  declareReviewScope:
    "Explicitly replace this turn's review scope: selected guidance pattern/checklist IDs, assumptions and custom unsupported obligations. Retrieval does not select scope; select variant checks (such as finite stock) only when they apply, and use an empty checklist for topology-only scope. Never a persistent design setting or capability contract. Retrieve the guidance record before selecting its IDs.",
  reviewDesign:
    "Review all staged changes without saving: what changed, every module's status with why, what is left (each finding names its tile or module, says fix or check, and gives a concrete fix, often as commands: modules that still need something, needed slots left unconnected, generation findings, a store with no writer, a worker writing stores for more than one concern, the user reaching a store, a long line to a far store, line styles that contradict their channel, and the design warnings), the readiness findings, declared assumptions and unsupported obligations, which stay not specified. Later edits or scope changes make it stale. A fresh review is sent back before edits commit; you may repair at most two response batches after receiving one.",
  askUser: "Ask a focused question with clickable choices, then end the turn.",
};

export function toolDefinitions(): ToolDefinition[] {
  return (Object.keys(schemas) as ToolName[]).map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(schemas[name], { io: "input" }) as Record<string, unknown>,
  }));
}

/** Shared by the real loop and evaluation observer; previews spend no repair pass. */
export function isWorkspaceMutation(name: string, rawArguments: string): boolean {
  if (name === "applyStudioCommands" || name === "applyPattern" || name === "declareReviewScope")
    return true;
  if (
    name !== "configureDesignScope" &&
    name !== "configureOwnership" &&
    name !== "configureOperations"
  )
    return false;
  try {
    return JSON.parse(rawArguments)?.action !== "preview";
  } catch {
    return true;
  }
}

const caps = {
  linksPerTile: laneLimits.outgoingLinks,
  entriesPerLane: laneLimits.entriesPerLane,
};

/** A coded kind's two languages, default first; nothing for a product kind (Gateway, CDN). */
function languagesOf(kind: StudioKind) {
  return Object.hasOwn(studioKindLanguages, kind)
    ? { languages: studioKindLanguages[kind as keyof typeof studioKindLanguages] }
    : {};
}

/** The lane canvas in a few sentences, for `listStudioDefinitions`. */
const canvasNotes = [
  "One actor, the user (a mobile and desktop user), is always there. It is not a tile; never add, edit or remove it. It starts two lanes: download (receive, view, consume) and upload (create, post).",
  `An action is what the user does in a lane, a tile with one short word for a name (Watch, Publish): at most one per lane, named ${actionWords} unless you name it (at most ${studioLimits.actionName} characters). The user links only to its actions, and each action's lane entries link it to the services that handle it.`,
  "A tile has at most one entry, in one lane. Every tile hangs off a lane: the design is one graph rooted at the user, with no islands and no cycles. Add a tile only after a tile or a lane, never on its own.",
  "Whatever follows an async link happens later, so slow side work forks off through a queue or topic. Resources (database, cache, object storage, search index) are end tiles: fork at the service instead.",
  "A message channel is a Queue (each message to one consumer) or a Topic (a copy to every subscriber); templates derive the mode.",
];
/** What new tiles start with and what they mean, for `listStudioDefinitions`. */
const kindNotes = [
  "Kinds come preconfigured: a new tile starts with its kind's defaults (Identity with OpenID Connect, Uploads with signed URLs, CDN with Cloudflare); the other choices stay selectable where editableSettings offer them.",
  "Large uploads go through an Uploads service that writes the storage; how bytes travel is a choice on that service, never a line from an action to storage.",
  "Each coded kind offers two languages, its default first; any other is refused. A CDN is a product, not code. External API tiles are for third parties no kind covers. Provider choices are intent: nothing is deployed, provisioned or verified because one was chosen.",
  "Never offer Go, cloud tus, custom FFmpeg, L1 or negative caching, or internal policies as supported choices. Existing source values are preserved intent, not availability.",
  `New tiles of the legacy kinds (${legacyKinds.map((kind) => studioDefinitions[kind].name).join(", ")}) are refused; existing ones keep working and keep their modules.`,
];

/**
 * The catalogs: what a new tile can be (the link fan's kinds with their labels), the tile types
 * with their kinds and preset defaults, and the module catalog with what each kind becomes in
 * the tiles that hold it, as the + menu groups it.
 */
function catalogSummary() {
  return {
    tileKinds: studioLinkFanGroups.flatMap((group) =>
      studioLinkFan[group].map((kind) => ({
        kind,
        name: studioDefinitions[kind].name,
        label: studioKindLabel(studioDefinitions[kind].defaults as never),
        group,
        description: studioDefinitions[kind].description,
      })),
    ),
    linkFan: studioLinkFanGroups.map((group) => ({ group, kinds: studioLinkFan[group] })),
    legacyKinds,
    tileTypes: studioTileTypes.map((type) => ({
      type,
      name: studioTileDefinitions[type].name,
      kinds: studioTileDefinitions[type].kinds.map((kind) => ({
        kind,
        name: studioDefinitions[kind].name,
        ...languagesOf(kind),
        defaults: studioDefinitions[kind].defaults,
      })),
    })),
    modules: studioComponentKinds.map((kind) => {
      const { name, description, hosts, slots, generation } = studioComponentDefinitions[kind];
      const templates =
        generation.kind === "lead"
          ? [generation.template]
          : generation.kind === "part"
            ? generation.templates
            : [];
      return {
        kind,
        name,
        description,
        hosts,
        // What it becomes in each tile kind that holds it, as the + menu groups it.
        as: Object.fromEntries(
          hosts.map((host) => [host, moduleGenerationLabels[moduleGeneration(kind, host)]]),
        ),
        generation,
        ...(templates.length && {
          templateNames: templates.map((template) => moduleTemplateNames[template]),
        }),
        slots,
      };
    }),
    linkRules: linkTable,
    caps,
    canvas: canvasNotes,
    kindNotes,
    warnings: studioWarningSentence,
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

/** A normal control as chat edits it: the tile or module, the setting, its value and range. */
function editableSetting(design: DesignDocument, control: GenerationSettingDecision) {
  const [, , list, index, , key] = control.sourcePaths[0] ?? [];
  const studio = design.architecture?.studio;
  const target =
    list === "elements"
      ? { element: studio?.elements[index as number]?.element }
      : list === "components"
        ? { component: studio?.components?.[index as number]?.id }
        : {};
  return {
    ...(control.selection && { selection: control.selection }),
    ...(control.process && { process: control.process }),
    input: control.input,
    ...target,
    setting: key,
    value: control.value,
    supported: control.supported,
    ...(control.userNeed && { userNeed: control.userNeed }),
  };
}

/**
 * The design as chat sees it, compactly: the actions with their lanes, entries and tiles, then
 * every tile in lane order with its kind and label, settings, outgoing links (sync or async) and
 * modules with their statuses, then the declarations the configure tools edit.
 */
function designSummary(
  design: DesignDocument,
  findings: readonly Finding[],
  installed: GenerationInstalledSupport = installedGenerationSupport(),
) {
  const studio = design.architecture?.studio;
  const graph = laneGraph(design);
  const elements = new Map(design.elements.map((item) => [item.id, item]));
  const bindings = new Map(studio?.elements.map((item) => [item.element, item]));
  const connections = new Map(design.connections.map((item) => [item.id, item]));
  const readiness = designReadiness(design);
  const declared = designOwnership(design).dependencies;
  /** A link into a store: `write` from its owner, `read` otherwise (one writer per store). */
  const accessOf = (id: string) => {
    const access = studioStoreAccess(design, id);
    const explicit = declared.find((item) => item.connection === id);
    return {
      ...(access && { access }),
      ...(explicit && { declaredAccess: explicit.access }),
    };
  };
  const statuses = new Map(moduleStatuses(design).map((item) => [item.module, item]));
  const modules = (host: string) =>
    (studio?.components ?? [])
      .filter((item) => item.host === host)
      .map((item) => {
        const status = statuses.get(item.id);
        return {
          id: item.id,
          name: item.name,
          kind: item.settings.kind,
          ...(item.description && { description: item.description }),
          settings: item.settings,
          links: (studio?.componentConnections ?? [])
            .filter((link) => link.from === item.id)
            .map((link) => ({
              id: link.id,
              ...(moduleLinkSlot(design, link) && { slot: moduleLinkSlot(design, link)?.id }),
              to: link.to.kind === "component" ? { module: link.to.id } : { tile: link.to.id },
            })),
          ...(status && {
            status: status.status,
            ...(status.template && { template: status.template }),
            ...(status.reason && { reason: status.reason }),
            ...(status.unconnected.length && { unconnected: status.unconnected }),
          }),
        };
      });
  const generation = designGeneration(design);
  // Module-level selections read as module statuses; only historical tile-level selections and
  // presets are shown as declarations.
  const tileLevel =
    !!generation?.preset || !!generation?.selections.some((item) => item.target.kind === "element");
  const counts = [...statuses.values()].reduce<Record<string, number>>((all, item) => {
    all[item.status] = (all[item.status] ?? 0) + 1;
    return all;
  }, {});
  return {
    baseRevision: design.revision,
    schemaVersion: design.schemaVersion,
    system: design.architecture
      ? {
          name: design.architecture.system.name,
          description: design.architecture.system.description,
        }
      : null,
    actions: studioActions(studio).map(({ lane, name }) => ({
      lane,
      name,
      entries: graph.edges
        .filter((edge) => edge.lane === lane)
        .map((edge) => ({ id: edge.id, tile: edge.target })),
      tiles: laneTiles(graph, lane),
    })),
    tiles: graph.nodes
      .filter((node) => node.id !== LANE_ACTOR && !node.action)
      .map((node) => {
        const element = elements.get(node.id);
        const binding = bindings.get(node.id);
        const hosted = modules(node.id);
        return {
          id: node.id,
          name: element?.name,
          ...(element?.description && { description: element.description }),
          ...(node.kind && {
            type: tileTypeOf(node.kind),
            kind: node.kind,
            ...(binding && { label: studioKindLabel(binding.settings) }),
            ...languagesOf(node.kind),
          }),
          ...(binding?.owner && { owner: binding.owner }),
          settings: binding?.settings,
          links: graph.edges
            .filter((edge) => edge.source === node.id)
            .map((edge) => ({
              id: edge.id,
              to: edge.target,
              mode: edge.async ? "async" : "sync",
              ...accessOf(edge.id),
              label: connections.get(edge.id)?.planned.label,
            })),
          ...(hosted.length && { modules: hosted }),
        };
      }),
    ...(statuses.size && { moduleStatuses: counts }),
    accessNote:
      "access on a link into a store is inferred from the store's owner (the owner writes, others read); declaredAccess is an explicit grant. Neither proves runtime access.",
    /** Runnable processes for export (Generate project's checkbox, setRunnableProcesses). */
    processes: !!generation?.processes,
    caps,
    editableSettings: normalGenerationControls(design, installed).map((control) =>
      editableSetting(design, control),
    ),
    findings: findings.filter((item) => !isDesignWarning(item)),
    /** Designs that look wrong but are allowed; resolve the ones this turn caused. */
    warnings: findings.filter(isDesignWarning).map((item) => item.message),
    readiness: {
      compositionSha256: readiness.composition.sha256,
      generationEligible: readiness.generationEligible,
      ...Object.fromEntries(
        (
          [
            "designValidity",
            "contractCompleteness",
            "implementationAvailability",
            "runtimeEvidence",
          ] as const
        ).map((stage) => [
          stage,
          { status: readiness[stage].status, blockers: readiness[stage].blockers.length },
        ]),
      ),
      detailTool: "readReadiness",
    },
    persistentScope: {
      ...designScope(design),
      profileStatus: profileStatus(designScope(design)),
      unresolved: unresolvedDesignScope(design),
    },
    availableProfileDefault: tinyurlDesignScope(),
    declaredOperations: designOperations(design),
    ...(tileLevel && generation
      ? { declaredGeneration: generation, generationFindings: generationFindings(design) }
      : {}),
    operationFindings: operationContractFindings(design),
    availableOperations: operationRecords.map((x) => ({ ...x.ref, name: x.definition.name })),
    availableCachePolicies: contractRecords
      .filter((x) => !operationRecords.some((record) => sameContractRef(record.ref, x.ref)))
      .map((x) => ({ ...x.ref, name: x.definition.name })),
    declaredOwnership: designOwnership(design),
    ownershipFindings: ownershipFindings(design),
    ownershipMeaning:
      "Logical owners, canonical roles, authority and explicit grants are declarations only. Legacy store owner/access remains separate and inferred; operation bindings are declared separately. Co-deployment grants nothing.",
    availability:
      "Only editableSettings are normal controls. Other source settings are preserved intent; exact-output runtime verification remains separate.",
  };
}

/** The design summary sent as caller context at the start of each turn. */
export function turnContext(
  design: DesignDocument,
  findings: readonly Finding[],
  selection: readonly string[],
) {
  return `[Jeeves] Studio context.\nCurrent design:\n${JSON.stringify(designSummary(design, findings))}\nSelected identities: ${JSON.stringify(selection)}\nSelected logical owners (owner:<id> names one logical owner, distinct from element/connection IDs and from its roles; preserve its ID on rename): ${JSON.stringify(selectedLogicalOwners(design, selection))}\nSelected operation bindings (operation:<id> names one exact receiver binding, distinct from role/owner IDs; a parent selection selects no operation): ${JSON.stringify(selectedOperationBindings(design, selection))}`;
}

/**
 * What is left after a change, compactly: how many modules are in each status, the ones that
 * aren't templates with why, and every review finding with its fix.
 */
export function leftover(design: DesignDocument, installed: GenerationInstalledSupport) {
  const review = designReview(design, installed);
  const counts = review.modules.reduce<Record<string, number>>((all, item) => {
    all[item.status] = (all[item.status] ?? 0) + 1;
    return all;
  }, {});
  return {
    modules: counts,
    notTemplates: review.modules
      .filter((item) => item.status !== "template")
      .map(({ module, name, host, status, reason }) => ({ module, name, host, status, reason })),
    left: review.findings,
    note: review.findings.some((item) => item.severity === "fix")
      ? "Fix each finding marked fix (its commands are checked against this design), or say why it stays; findings marked check are advice."
      : review.findings.length
        ? "Nothing to fix; the findings marked check are advice to confirm."
        : "Nothing left to fix.",
  };
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
      return `There is no "${type}" command. The commands are ${commandTypes.join(", ")}. Actions, tiles and links are added and removed only with addAction, removeAction, addTile, linkTiles, removeTile and removeLink, which keep every tile on a lane.`;
  }
  return undefined;
}

/** The working copy one turn edits, plus what the turn has done so far. */
export class Workspace {
  /** Edits not committed yet, in order. */
  pending: OperationInput[] = [];
  question: ChatQuestion | undefined;
  activity: ChatActivity[] = [];
  scope: StudioReviewScope = emptyReviewScope();
  /** Changes to commands or scope invalidate an earlier review, including within one response. */
  generation = 0;
  reviewedGeneration = -1;
  private operationsPreview: { generation: number; operations: string } | undefined;
  private ownershipPreview: { generation: number; ownership: string } | undefined;
  private scopePreview: { generation: number; scope: string } | undefined;

  review() {
    this.reviewedGeneration = this.generation;
    const review = reviewWithModules(this.base, this.working, this.scope, this.installed);
    this.log(
      "reviewDesign",
      true,
      `Reviewed staged design: ${review.changes.length} changes, ${review.left.length} left to fix or check, ${review.findings.length} findings, ${review.obligations.length} not specified obligations`,
    );
    return review;
  }

  constructor(
    /** The committed design the pending edits apply to. */
    public base: DesignDocument,
    public working: DesignDocument = base,
    public installed: GenerationInstalledSupport = installedGenerationSupport(),
  ) {}

  /** Starts over from a newer committed design, dropping pending edits. */
  reset(base: DesignDocument) {
    this.base = base;
    this.working = base;
    this.pending = [];
    this.generation++;
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
        this.log(tool, true, "Listed the tile kinds, module catalog and link table");
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
          ...designSummary(this.working, validateDesign(this.working), this.installed),
          baseRevision: this.base.revision,
        };
      case "describeOperation": {
        const { ref } = parsed.data as z.infer<typeof schemas.describeOperation>;
        this.log(tool, true, "Read exact operation catalog reference");
        const record = contractRecords.find((x) => sameContractRef(ref, x.ref));
        return record
          ? {
              status: "known",
              record,
              templateAvailability: "none",
              runtimeVerification: "none",
            }
          : {
              status: "unresolved",
              ref,
              note: "No exact local operation or cache policy record; no substitution.",
            };
      }
      case "configureOperations":
        return this.configureOperations(parsed.data as z.infer<typeof schemas.configureOperations>);
      case "configureOwnership":
        return this.configureOwnership(parsed.data as z.infer<typeof schemas.configureOwnership>);
      case "configureDesignScope":
        return this.configureScope(parsed.data as z.infer<typeof schemas.configureDesignScope>);
      case "listStudioPatterns":
        this.log(tool, true, "Listed the curated patterns and reviewed guidance");
        return {
          ...listModulePatterns(),
          apply:
            "applyPattern {baseRevision, pattern: {id, ...arguments}} applies one as a single batch; previewCommands {baseRevision, pattern} shows what it would leave first.",
          guidance: listStudioPatterns(),
        };
      case "describeStudioPattern": {
        const { id } = parsed.data as z.infer<typeof schemas.describeStudioPattern>;
        const pattern = studioPatterns[id];
        this.log(tool, true, `Read design pattern ${pattern.name} (${pattern.version})`);
        return { catalogVersion: studioPatternCatalogVersion, pattern };
      }
      case "declareReviewScope": {
        const scope = parsed.data as StudioReviewScope;
        const problem = reviewScopeProblem(scope, this.working);
        if (problem) {
          this.log(tool, false, problem);
          return { ok: false, error: problem, note: "Review scope unchanged." };
        }
        if (JSON.stringify(scope) !== JSON.stringify(this.scope)) this.generation++;
        this.scope = scope;
        this.log(
          tool,
          true,
          `Declared turn-only review scope: ${scope.patterns.length} patterns, ${scope.obligations.length} custom obligations`,
        );
        return {
          ok: true,
          scope,
          note: "This turn only; not saved as design settings or implementation contracts.",
        };
      }
      case "reviewDesign":
        return this.review();
      case "validateDesign":
        this.log(tool, true, "Checked design readiness");
        return { findings: validateDesign(this.working) };
      case "readReadiness":
        this.log(tool, true, "Read exact composition compatibility and evidence gaps");
        return designReadiness(this.working);
      case "askUser":
        this.question = parsed.data as z.infer<typeof schemas.askUser>;
        this.log(tool, true, "Asked a question");
        return { ok: true, note: "End this turn; the answer comes as a new message." };
      case "applyStudioCommands":
        return this.applyCommands(parsed.data as z.infer<typeof schemas.applyStudioCommands>);
      case "applyPattern":
        return this.applyPattern(parsed.data as z.infer<typeof schemas.applyPattern>);
      case "previewCommands":
        return this.preview(parsed.data as z.infer<typeof schemas.previewCommands>);
    }
  }

  private configureOperations(input: z.infer<typeof schemas.configureOperations>): unknown {
    const tool = "configureOperations";
    const refuse = (error: string) => {
      this.log(tool, false, error);
      return { ok: false, error, note: "Nothing changed for this call." };
    };
    if (input.baseRevision !== this.base.revision)
      return refuse("Revision conflict. Read getDesign before preparing operations.");
    try {
      const preview = previewOperations(this.working, input.operations);
      if (input.action === "preview") {
        this.operationsPreview = {
          generation: this.generation,
          operations: JSON.stringify(input.operations),
        };
        this.log(
          tool,
          true,
          "Previewed exact operation implementations and caller expectations; nothing saved",
        );
        return { ok: true, ...preview };
      }
      if (
        this.operationsPreview?.generation !== this.generation ||
        this.operationsPreview.operations !== JSON.stringify(input.operations)
      )
        return refuse(
          "Preview these exact operations declarations and affected bindings against the current working design before applying.",
        );
      if (!preview.canApply)
        return refuse(
          preview.findings
            .filter((item) => item.code !== "CONFIG_REQUIRED")
            .map((item) => item.message)
            .join(" "),
        );
      const batch = buildOperationsCommand(this.working, {
        operations: input.operations,
        upgrade: input.upgrade,
      });
      if (!batch.ops.length) return { ok: true, note: "Operations unchanged; no edit prepared." };
      const result = applyOperations(this.working, batch.ops);
      if (!result.ok) return refuse(result.errors.map((item) => item.message).join(" "));
      this.working = result.design;
      this.pending.push(...batch.ops);
      this.generation++;
      this.log(tool, true, "Prepared exact operation bindings as part of one turn commit");
      return {
        ok: true,
        ...preview,
        note: "Prepared declarations, not saved. Known operation intent is declared. Auth verifier, template and runtime verification remain unavailable.",
      };
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    }
  }

  private configureOwnership(input: z.infer<typeof schemas.configureOwnership>): unknown {
    const tool = "configureOwnership";
    const refuse = (error: string) => {
      this.log(tool, false, error);
      return { ok: false, error, note: "Nothing changed for this call." };
    };
    if (input.baseRevision !== this.base.revision)
      return refuse("Revision conflict. Read getDesign before preparing ownership.");
    try {
      const preview = previewOwnership(this.working, input.ownership);
      if (input.action === "preview") {
        this.ownershipPreview = {
          generation: this.generation,
          ownership: JSON.stringify(input.ownership),
        };
        this.log(
          tool,
          true,
          "Previewed logical owners, roles, grants and dependent changes; nothing saved",
        );
        return { ok: true, ...preview };
      }
      if (
        this.ownershipPreview?.generation !== this.generation ||
        this.ownershipPreview.ownership !== JSON.stringify(input.ownership)
      )
        return refuse(
          "Preview these exact ownership declarations and affected bindings against the current working design before applying.",
        );
      if (!preview.canApply)
        return refuse(
          preview.findings
            .filter((item) => item.code !== "CONFIG_REQUIRED")
            .map((item) => item.message)
            .join(" "),
        );
      const batch = buildOwnershipCommand(this.working, {
        ownership: input.ownership,
        upgrade: input.upgrade,
      });
      if (!batch.ops.length) return { ok: true, note: "Ownership unchanged; no edit prepared." };
      const result = applyOperations(this.working, batch.ops);
      if (!result.ok) return refuse(result.errors.map((item) => item.message).join(" "));
      this.working = result.design;
      this.pending.push(...batch.ops);
      this.generation++;
      this.log(tool, true, "Prepared explicit ownership and access as part of one turn commit");
      return {
        ok: true,
        ...preview,
        note: "Prepared declarations, not saved. No operation binding, template or runtime authorization is supplied.",
      };
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    }
  }

  private configureScope({
    baseRevision,
    action,
    scope,
    upgrade,
  }: {
    baseRevision: number;
    action: "preview" | "apply";
    scope: DesignScope;
    upgrade: boolean;
  }): unknown {
    const tool = "configureDesignScope";
    const refuse = (error: string) => {
      this.log(tool, false, error);
      return { ok: false, error, note: "Nothing changed for this call." };
    };
    if (baseRevision !== this.base.revision)
      return refuse("Revision conflict. Read getDesign before preparing requirements.");
    if (action === "preview") {
      this.scopePreview = { generation: this.generation, scope: JSON.stringify(scope) };
      this.log(tool, true, "Previewed persistent profile and requirements; nothing saved");
      return { ok: true, ...previewDesignScope(this.working, scope) };
    }
    if (
      this.working.schemaVersion === 2 &&
      (this.scopePreview?.generation !== this.generation ||
        this.scopePreview.scope !== JSON.stringify(scope))
    )
      return refuse(
        "Preview this exact scope against the current working design before explicitly upgrading it.",
      );
    try {
      const batch = buildDesignScopeCommand(this.working, { scope, upgrade });
      if (!batch.ops.length)
        return { ok: true, note: "Persistent scope unchanged; no edit prepared." };
      const result = applyOperations(this.working, batch.ops);
      if (!result.ok) return refuse(result.errors.map((item) => item.message).join(" "));
      this.working = result.design;
      this.pending.push(...batch.ops);
      this.generation++;
      this.log(
        tool,
        true,
        "Prepared persistent profile and requirements as part of one turn commit",
      );
      return {
        ok: true,
        ...previewDesignScope(this.working, scope),
        note: "Prepared, not saved. Profile selection supplies no capability contracts, templates or runtime verification.",
      };
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Runs commands one by one on `from` with the canvas's builder: the design they make, their
   * operations and the IDs they re-keyed, or the first refusal in plain words.
   */
  private runBatch(
    from: DesignDocument,
    commands: readonly StudioCommand[],
  ):
    | { ok: true; working: DesignDocument; ops: OperationInput[]; renamed: Rekey[] }
    | { ok: false; error: string } {
    let working = from;
    const ops: OperationInput[] = [];
    const renamed: Rekey[] = [];
    for (const [index, command] of commands.entries()) {
      // In a call with several commands, say which one was refused.
      const which = commands.length > 1 ? `Command ${index + 1} (${command.type}): ` : "";
      try {
        const batch = buildSupportedAuthoringCommand(working, command, this.installed);
        const result = applyOperations(working, batch.ops);
        if (!result.ok)
          return { ok: false, error: which + result.errors.map((item) => item.message).join(" ") };
        working = result.design;
        ops.push(...batch.ops);
        renamed.push(...renamedIds(batch.ops));
      } catch (error) {
        return {
          ok: false,
          error: which + (error instanceof Error ? error.message : String(error)),
        };
      }
    }
    return { ok: true, working, ops, renamed };
  }

  /** Keeps an accepted batch on the working copy and answers with what is left. */
  private accept(
    tool: string,
    run: { working: DesignDocument; ops: OperationInput[]; renamed: Rekey[] },
    summary: string,
    extra: Record<string, unknown> = {},
  ) {
    this.working = run.working;
    this.pending.push(...run.ops);
    if (run.ops.length) this.generation++;
    const review = leftover(run.working, this.installed);
    this.log(tool, true, `${summary}; ${review.left.length} left to fix or check`);
    const findings = validateDesign(run.working);
    return {
      ok: true,
      ...extra,
      // A rename re-keys IDs that follow their names: later commands use the new IDs.
      ...(run.renamed.length && { renamed: run.renamed }),
      findings: findings.filter((item) => !isDesignWarning(item)),
      warnings: findings.filter(isDesignWarning).map((item) => item.message),
      review,
      note: "Prepared for one atomic turn commit, not saved yet.",
    };
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
    const run = this.runBatch(this.working, commands);
    if (!run.ok) {
      this.log(tool, false, `Refused: ${run.error}`);
      return { ok: false, error: run.error, note: "Nothing changed for this call." };
    }
    return this.accept(
      tool,
      run,
      `Prepared ${commands.length} studio command${commands.length === 1 ? "" : "s"}`,
      { commands: commands.length },
    );
  }

  /** A pattern's commands on the working copy, checked step by step, or why it is refused. */
  private patternCommands(
    pattern: ModulePattern,
  ): { ok: true; commands: StudioCommand[] } | { ok: false; error: string } {
    try {
      return {
        ok: true,
        commands: buildModulePattern(this.working, pattern, this.installed).commands,
      };
    } catch (error) {
      if (error instanceof ModulePatternRefusal) return { ok: false, error: error.message };
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private applyPattern({ baseRevision, pattern }: z.infer<typeof schemas.applyPattern>): unknown {
    const tool = "applyPattern";
    const refused = (error: string) => {
      this.log(tool, false, `Refused: ${error}`);
      return { ok: false, error, note: "Nothing changed for this call." };
    };
    if (baseRevision !== this.base.revision)
      return refused("Revision conflict. Read getDesign before applying a pattern.");
    const built = this.patternCommands(pattern);
    if (!built.ok) return refused(built.error);
    if (!built.commands.length) {
      this.log(tool, true, `Pattern ${pattern.id} is already in the design; nothing added`);
      return {
        ok: true,
        pattern: pattern.id,
        commands: 0,
        review: leftover(this.working, this.installed),
        note: "Everything this pattern adds is already in the design; nothing changed.",
      };
    }
    // The same commands, as one batch through the same path as applyStudioCommands.
    const before = this.working;
    const run = this.runBatch(before, built.commands);
    if (!run.ok) return refused(run.error);
    return this.accept(
      tool,
      run,
      `Applied pattern ${pattern.id} as ${built.commands.length} commands`,
      { pattern: pattern.id, commands: built.commands.length, added: added(before, run.working) },
    );
  }

  /** A dry run of commands or a pattern: what they would change and leave; nothing kept. */
  private preview({ baseRevision, commands, pattern }: z.infer<typeof schemas.previewCommands>) {
    const tool = "previewCommands";
    const refused = (error: string) => {
      this.log(tool, false, `Preview refused: ${error}`);
      return { ok: false, error, note: "Nothing changed; nothing was prepared." };
    };
    if (baseRevision !== this.base.revision)
      return refused("Revision conflict. Read getDesign before previewing.");
    if (!commands === !pattern) return refused("Preview either commands or one pattern.");
    let batch: readonly StudioCommand[] = commands ?? [];
    if (pattern) {
      const built = this.patternCommands(pattern);
      if (!built.ok) return refused(built.error);
      batch = built.commands;
    }
    const run = this.runBatch(this.working, batch);
    if (!run.ok) return refused(run.error);
    const review = leftover(run.working, this.installed);
    this.log(
      tool,
      true,
      `Previewed ${pattern ? `pattern ${pattern.id}` : `${batch.length} commands`}: ${review.left.length} would be left; nothing prepared`,
    );
    const findings = validateDesign(run.working);
    return {
      ok: true,
      ...(pattern && { pattern: pattern.id, commands: batch.length }),
      changes: studioChanges(this.working, run.working),
      added: added(this.working, run.working),
      ...(run.renamed.length && { renamed: run.renamed }),
      statuses: moduleStatuses(run.working),
      findings: findings.filter((item) => !isDesignWarning(item)),
      warnings: findings.filter(isDesignWarning).map((item) => item.message),
      review,
      note: "Preview only: nothing is prepared or saved. Apply the same commands or pattern to keep it.",
    };
  }
}

/** The tiles and modules `after` has that `before` hasn't. */
function added(before: DesignDocument, after: DesignDocument) {
  const tiles = new Set(before.elements.map((item) => item.id));
  const modules = new Set((before.architecture?.studio?.components ?? []).map((item) => item.id));
  const kinds = new Map(
    after.architecture?.studio?.elements.map((item) => [item.element, item.settings.kind]),
  );
  return {
    tiles: after.elements
      .filter((item) => !tiles.has(item.id))
      .map((item) => ({ id: item.id, name: item.name, kind: kinds.get(item.id) })),
    modules: (after.architecture?.studio?.components ?? [])
      .filter((item) => !modules.has(item.id))
      .map((item) => ({ id: item.id, name: item.name, host: item.host, kind: item.settings.kind })),
  };
}

/**
 * The staged review (`reviewStudioDesign`) with every module's status and what is left to fix or
 * check, as reviewDesign, the pre-save review and the final review return it.
 */
export function reviewWithModules(
  base: DesignDocument,
  working: DesignDocument,
  scope: StudioReviewScope,
  installed: GenerationInstalledSupport,
) {
  const review = reviewStudioDesign(base, working, scope);
  const left = designReview(working, installed);
  return { ...review, moduleStatuses: left.modules, left: left.findings };
}
