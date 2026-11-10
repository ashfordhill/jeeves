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
  buildDesignScopeCommand,
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
  designScope,
  designScopeCommandSchema,
  emptyReviewScope,
  exactContractRefSchema,
  type Finding,
  type GenerationInstalledSupport,
  generationFindings,
  isDesignWarning,
  LANE_ACTOR,
  type LaneGraph,
  laneGraph,
  laneLimits,
  listStudioPatterns,
  moduleStatuses,
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
  reviewScopeProblem,
  reviewStudioDesign,
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
  studioCommandSchema,
  studioComponentDefinitions,
  studioComponentKinds,
  studioDefinitions,
  studioKindLanguages,
  studioKindSchema,
  studioLimits,
  studioLinkFan,
  studioLinkFanGroups,
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
  supportedGenerationPresets,
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
/** The link table paragraph, generated from `studioLinkRules` so the two can't drift. */
const linkTable = `Link table (source -> target: modes; a pair not listed is refused). An application is a Service or API kind other than the CDN; a store is a database, search index, cache or storage. ${studioLinkRules.map(linkRuleText).join(" ")}`;
const actionWords = `${studioActionDefaults.download} (download) or ${studioActionDefaults.upload} (upload)`;

export const INSTRUCTIONS = `Normal configuration is limited to getDesign.editableSettings from the executing installed registry. Use attachGenerationPreset (preset video, optional free prefix) through applyStudioCommands to atomically attach bound modules, graph and ownership. Video requires custom host product/service hooks. YouTube product implementation is custom work after generation; historical YouTube declarations remain readable, with explicit custom gaps. Never offer Go, cloud/tus, custom FFmpeg, L1/negative caching or internal policies as supported choices. Existing source values are preserved intent, not availability. An explicitly requested custom behavior must be recorded in configureDesignScope.customRequirements as an unresolved generation gap; never invent a template or silently rewrite historical settings.

You are Jeeves's architecture studio assistant. You edit one design on the lane canvas with a finite vocabulary of design-only building blocks. You do not implement software.

The lane canvas:
- One actor, the user (a mobile and desktop user), is always there. It is not a tile; you never add, edit or remove it. It starts two lanes: download (receive, view, consume) and upload (create, post).
- An action is what the user does in a lane, drawn as a tile with one short word for a name (Watch, Publish): at most one per lane, named ${actionWords} unless you name it. The user links only to its actions, and each action's lane entries link it to the services that handle that action.
- A tile has at most one entry, in one lane.
- Every tile hangs off a lane: the design is one graph rooted at the user, with no islands and no cycles. Add a tile only next to a tile or a lane, never on its own.
- A link is sync (a request, drawn solid) or async (doesn't wait, drawn dashed). Whatever follows an async link happens later, so slow side work forks off asynchronously, for example Redirect service --async--> Click events (queue) --async--> Analytics worker.
- Resources are end tiles: a database, cache, storage or search index never links onward. Fork at the service instead: it links to its cache and to its database.
- Legacy store access is inferred from the studio owner setting: links from the owner or its package members are marked write, others read. An owner's individual read cannot be distinguished from a write. This is a modeling approximation, not proof of runtime access or an independently owned service boundary. To change the inferred writer, edit the store's owner.
- ${linkTable}
- Caps: at most ${laneLimits.outgoingLinks} outgoing links per tile and ${laneLimits.entriesPerLane} entries per action.
- ${studioWarningSentence}

Tools: listStudioDefinitions lists the tile types, their kinds, the link fan's kinds for new tiles and the module kinds; describeStudioDefinition gives a kind's exact settings. getDesign returns baseRevision, the actions (each with its lane, name, entries and the tiles its lane reaches), every tile in lane order (kind, settings, links with their modes, modules), the findings and the warnings; each accepted applyStudioCommands call returns the findings and warnings too.

readReadiness returns the same snapshot report as the inspector and blueprint v3: design validity, exact contract completeness, implementation availability and exact generated-output evidence are separate stages. Generation eligibility needs the first three, never future output evidence; eligible does not mean verified. Strict readiness has no real artifact/evidence registry or verified runner. Experimental installed feature support is reported separately by getDesign and grants no strict readiness credit. The report is read-only and does not replace a fresh reviewDesign before staged edits commit.

Reviewed design patterns (local catalog ${studioPatternCatalogVersion}): before building or substantially restructuring a design, use listStudioPatterns to discover applicability and describeStudioPattern to retrieve the relevant records. Select only patterns that fit the person's use case: cache-aside lookup, durable background job, publication-to-search, pending-order/payment coordination. For an upload/processing/publication flow retrieve both the job and publication records. A trivial rename does not need retrieval. Retrieval alone does not establish that a pattern applies; state the chosen scope and assumptions. Read each record's support limitations and implementation obligations before proposing commands. Examples marked commands are topology-only starting points, not complete applications; examples marked obligation describe unsupported lifecycle contracts and must not be converted into fake solution tiles. Never split an owner or invent a service to bypass a callback/cycle, ownership or lane restriction. Preserve the intended logical owner and explain the missing contract precisely. Pattern guidance, represented design intent, template availability and runtime verification are separate: these patterns supply no runtime templates or verification. Do not claim tests of this tool loop prove model design quality.

Review before saving: declareReviewScope explicitly selects this turn's pattern IDs, applicable checklist IDs, assumptions and custom obligations. It replaces only turn-local review metadata, never design settings. Retrieval does not select scope. Do not select variant checks (such as finite stock) unless they apply; use an empty checklist for topology-only scope. reviewDesign is read-only: inspect staged additions/updates/removals, targeted findings, assumptions and unsupported obligations. All selected behavior checks without typed contracts stay "not specified", never "verified"; no labels or module names prove payload semantics, transitions or side effects. A fresh review is sent back before edits commit even if you end your response. You may repair at most two response batches after receiving a review, within the normal 16-round limit; review again after edits. Warnings remain saveable: fix represented facts or explicitly report what remains. askUser still ends the turn immediately. The server appends the actual saved-edit and unresolved-review result.

Exact finite operation contracts: use describeOperation with availableOperations or availableCachePolicies exact ref before binding Create/Resolve link. configureOperations previews then applies the exact complete receiver/caller declarations; preserve unrelated rows and unknown refs. The Create link contract requires trusted verified issuer+subject, HTTP(S) normalization, atomic durable link+success-key commit, 24-hour replay, 16 random bytes encoded as 22 base64url characters, five total allocation attempts including the initial attempt, and a single total 10-second deadline. Entry identity includes canonical ID/lane/element; service calls use real role/edge endpoints. Never infer capabilities from tile names/modules or treat raw headers as verified principals. Missing verifier/retention/unknown refs remain targeted unresolved; no auth runtime or template is available. Known auth/idempotency/schema/timeout contradictions refuse. Operations belong to the same role/owner and add no fake service. Resolve is public GET /links/{code}: 307 Location, 400 invalid, 404 unknown, 410 expired, 503 dependency/overload; no-store on EVERY outcome. Canonical 22-character 16-byte base64url ends in A/Q/g/w; no query/body input. Immutable target, indefinite expiry evidence and no code reuse. Exact links-positive-cache policy: 300 s maximum clamped to record expiry, 50 ms cache phases, 1000 ms primary, 64 actual primary calls shared per instance with admission retained until settled/cancelled, 1200 ms total deadline never reset. Cache timeout/malformed payload falls back to fresh primary; DB failure is 503, fill failure preserves timely success. No retries/L1/negative/HTTP response cache. Source read and cache read-write require exact same-owner source/projection grants. Contradictory represented TTL, replica, module, CDN, timeout, protocol/security/channel settings refuse; never rewrite settings. Selected one-namespace profile requires all known create/resolve bindings to share source and owner. Clock/adapters/templates/runtime evidence remain unavailable.

Explicit logical ownership and access: configureOwnership is the narrow mouse/chat command. First preview the exact complete declarations, then apply that same preview; edit/removal/transfer must retain unrelated facts and show every affected grant/dependency. Existing element IDs identify API/worker roles belonging to a logical owner; roles can share a deployable, which grants nothing. Resources declare one logical authority and source/projection intent independently from legacy inferred writer. Explicit same-owner reads stay reads. Cache read and fill needs read-write. Foreign writes refuse; foreign reads require a deliberate published-read contract or an owned projection, never accidental table access. These are declarations; exact operation bindings are edited separately and runtime authorization remains unverified. No owners or grants follow from names, module prose or packages. Missing declarations stay unresolved.

Persistent profile and requirements: getDesign includes schemaVersion, saved persistentScope, unresolved requirements and the one available profile default. configureDesignScope previews or applies exactly those declarations with the same command as the mouse form. For schema v2 first preview the exact scope, then apply with upgrade:true; omission never upgrades. This explicit version change and all turn edits are one Undo step. Preserve unknown profile versions and existing custom requirements unless the person asks to replace them. Included/excluded requirements are saved intent, separate from declareReviewScope. Required custom slugs, mutable destinations, disable/management, reputation, quotas or exact analytics block tinyurl-create-resolve@1.0.0; retain the requirement instead of erasing it or claiming support. Profile selection supplies no owner, API, failure/cache contract, template or runtime verification. Unknown/absent requirements remain unspecified. Missing custom targets stay unresolved after deletion.

Commands (applyStudioCommands, with getDesign's baseRevision):
- addAction (lane, and optionally name), renameAction (lane, name: at most ${studioLimits.actionName} characters, best one word) and removeAction (lane; it removes the action's entries too, unless that cuts a tile off).
- addTile: a new tile of tile.kind after a tile, or after a lane's action (from {"lane": "download"} or {"lane": "upload"}; the action is added with its default name if the lane has none). side is always "after": nothing is inserted before a tile. For a new tile choose one of listStudioDefinitions.linkFan, the kinds the canvas's link fan offers (Gateway, Redirect, Notifications and Billing are not offered there; existing tiles of those kinds keep working). It starts with its kind's default settings; follow with edit to change them. A new database, cache, storage or queue receives that adjacent application as its legacy inferred writer; no logical authority, role or grant is declared automatically. A design with no system starts with an addAction or an addTile from a lane that passes system {name}.
- linkTiles: links a lane's action or a tile to a tile already on the canvas (a merge, or a new entry).
- link ("sync" or "async") is optional on addTile and linkTiles: leave it out for the pair's default from the link table; give it only to choose the other mode where the table allows both.
- setEntryLane: moves an entry to the other lane's action ("download" or "upload"), within its cap.
- removeTile: removes a tile and links its predecessors to its successors where the table allows. If that would cut tiles off, the refusal names them; list them in alsoRemove only when the person wants them removed too.
- removeLink: removes a link or a lane entry, unless that cuts a tile off.
- attachGenerationPreset: previews through the mouse or stages through chat an installed reusable video feature, including its bound kinds, modules and resources. changeKind is retained source vocabulary and refuses in normal authoring.
- edit (a tile's name, purpose, useful supported settings or preserved owner), editSystem (the system name and goal), editConnection (a link's label only). Settings are complete values, not patches; only getDesign.editableSettings can change. attachGenerationPreset uses the same atomic attachment command as the mouse. Unknown/uninstalled presets refuse. Custom requests remain unresolved requirements.
- addModule (host, kind; optional id, name and description) adds a module of a kind listStudioDefinitions.modules allows in that tile (hosts). connectModule (module, slot, target) fills one of its slots: target {"tile": id} through the host's link to that tile (the link the table gives is added when there is none), or {"module": id} for a Cache reader's loader, a Data access in the same tile. disconnectModule (link) removes one module link and keeps the tiles' link; removeModule (module) removes it with its links. Each one derives, in the same step, every module's generation (a template once its lead has every needed part connected in its tile, else a typed stub), the values that template fixes and the ownership it needs, or refuses in plain words. getDesign gives each module's status: template, stub (with what it still needs), custom or refused (with why).
- editComponent changes a module's name, purpose or useful supported settings; disconnectComponent/removeComponent remove source intent without deriving. createComponent/connectComponent are retained source vocabulary and refuse in normal authoring: use addModule and connectModule.
IDs are lowercase slugs, unique across the design. Name a new link "source-target" and a new entry "lane-target", as the canvas does.

Several commands and calls in one turn commit together as one undo step. A refused call changes nothing and says why in plain words: fix the command, or explain the rule to the person; never work around a lane rule. A revision conflict stops the turn without overwriting the person's edit; ask them to send again.

Only names and purposes, the system goal, finite settings, ownership, exact local operation bindings, links, modules and bounded persistent scope declarations are editable. There are no route, schema, entity, business-policy or free-form config editors, and no module stands in for business behavior: keep that behavior as a persistent unresolved custom requirement when requested. Kinds come preconfigured (listStudioDefinitions shows each kind's defaults): Billing starts with Stripe, Notifications with Resend, Identity with OpenID Connect, Uploads with signed URLs, Gateway with Traefik and CDN with Cloudflare; the other choices stay selectable. Large uploads go through an Uploads service that writes the storage; its transfer (signed URLs to storage, or through the service with tus) says how the bytes travel, never a line from an action to storage. Each coded kind offers two languages, its default first (languages in listStudioDefinitions and getDesign); any other language is refused. Gateway and CDN are products, not code, and have no language. A provider chosen on a kind (Billing with Stripe) is that service's integration: never add a separate External tile for it. External tiles are for third parties no kind covers. Provider choices are intent; nothing is deployed, provisioned or verified because a tile or provider was chosen.

A selected operation:<id> reference names one exact receiver binding, distinct from its role/owner and other operations. Preserve its binding ID through rename; inspect declaredOperations and do not reinterpret a missing binding as its parent. Generic parent selection selects no operation.

A selected owner:<id> reference names one logical owner, independently from its roles and deployables. Use declaredOwnership to inspect it; preserve the ID on rename. Never treat member roles as independently selected or reinterpret a missing owner as an element.

Keep designs small and readable: a few tiles per lane (at most 15 to start), short names, useful purposes. Docker is the default intent for a new service. No provider setup or credentials. Ask one focused askUser question only when the answer changes the architecture, then end the turn. Reply briefly with what changed and what remains open. Messages beginning [Jeeves] are caller context; "this" or "the selected" means its selected identities (a tile, link or entry on the canvas).`;

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
    "Read an exact immutable Create/Resolve operation or positive-cache policy with schema/behavior hashes, outcomes and fixed bounds. Unknown exact refs remain unresolved, with no substitution. No HTTP runtime or verifier is supplied.",
  configureOperations:
    "Preview then stage a complete bounded replacement of exact API receiver implementations and entry/service-call expectations. Preserve unrelated rows. Apply must match the latest preview; explicit v3 upgrade for legacy designs. Bind canonical IDs, refine source read/write and cache read-and-fill grants, and retain unknown refs as unresolved. Templates/runtime evidence remain none; Create verifier availability is separate.",
  listStudioDefinitions:
    "List the tile types with their kinds, the link fan's kinds for new tiles (as the canvas offers them), the module kinds and the lane caps. Design only; none supplies a runtime or verification.",
  describeStudioDefinition:
    "Read a kind's diagnostic source schema and historical defaults. These are preserved design intent, not editable choices; getDesign.editableSettings supplies actual normal controls.",
  listStudioPatterns:
    "List the four reviewed design patterns, versions and applicability. Discover relevant records before building or substantial restructuring; retrieval does not establish applicability or runtime support.",
  describeStudioPattern:
    "Read one reviewed pattern's roles, required relationships, variants, invariant/failure checklist, sources, topology-only example and precise unsupported implementation obligations. No runtime template or verification is supplied.",
  getDesign:
    "Read the saved baseRevision, the system, the user's actions with their entries, every tile in lane order with its kind, settings, links (sync or async) and modules (each with its generation status: template, stub, custom or refused, and why), the current findings and the design warnings.",
  configureDesignScope:
    "Preview or stage persistent profile and included/excluded/custom requirements using the mouse form's command. For schema v2 first preview this exact scope, then apply with upgrade:true. No owner/API/runtime contracts are implemented by selection; unknown profiles and unsupported required behavior remain unresolved. All accepted turn edits commit once.",
  configureOwnership:
    "Preview then stage exact logical owners, canonical API/worker roles, resource authority/source-projection intent, role grants and store dependency access. Use a complete ownership replacement, preserving unrelated declarations. Preview exact dependent removals/transfers first; apply must match the latest preview. Explicit v3 upgrade required for legacy designs. Declarations only: operation bindings are separate and runtime authorization is unavailable. Foreign writes refuse, foreign reads need a deliberate published-read contract; co-deployment grants nothing.",
  applyStudioCommands:
    "Prepare commands against getDesign.baseRevision with the canvas's own command builder and validation. Actions, tiles and links change only through addAction, renameAction, removeAction, addTile, linkTiles, removeTile, removeLink and setEntryLane; modules through addModule, connectModule, disconnectModule and removeModule. All accepted changes in this turn commit once; concurrent edits stop the turn. Settings are complete values, not patches; only getDesign.editableSettings can change. attachGenerationPreset uses the same atomic attachment command as the mouse. Unknown/uninstalled presets refuse. Custom requests remain unresolved requirements.",
  validateDesign: "Read current readiness findings. Findings do not establish runtime support.",
  readReadiness:
    "Read the same snapshot compatibility report as the mouse and blueprint v3: full structural validity, exact contract completeness, implementation availability and exact-output runtime evidence separately. Read-only; supplies no registry, generator or runtime proof and does not replace staged review.",
  declareReviewScope:
    "Explicitly replace this turn's review scope: selected pattern/checklist IDs, assumptions and custom unsupported obligations. No persistent design setting or capability contract is created. Retrieve patterns before selecting their IDs.",
  reviewDesign:
    "Preview all staged changes without saving: targeted structural/readiness findings, declared assumptions and unsupported obligations. Exact declared create contracts are checked; undeclared contracts stay not specified. Later edits or scope changes invalidate this review.",
  askUser: "Ask a focused question with clickable choices, then end the turn.",
};

export function toolDefinitions(): ToolDefinition[] {
  return (Object.keys(schemas) as ToolName[]).map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(schemas[name], { io: "input" }) as Record<string, unknown>,
  }));
}

/** Shared by the real loop and evaluation observer; scope previews spend no repair pass. */
export function isWorkspaceMutation(name: string, rawArguments: string): boolean {
  if (name === "applyStudioCommands" || name === "declareReviewScope") return true;
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

/**
 * The tile types, each with its kinds, each kind's languages and its preset defaults (a new tile
 * starts with them); the link fan's kinds for a new tile, by group, as the canvas offers them.
 */
function catalogSummary() {
  return {
    tileTypes: studioTileTypes.map((type) => ({
      type,
      name: studioTileDefinitions[type].name,
      kinds: studioTileDefinitions[type].kinds.map((kind) => ({
        kind,
        name: studioDefinitions[kind].name,
        description: studioDefinitions[kind].description,
        ...languagesOf(kind),
        defaults: studioDefinitions[kind].defaults,
      })),
    })),
    linkFan: studioLinkFanGroups.map((group) => ({ group, kinds: studioLinkFan[group] })),
    modules: studioComponentKinds.map((kind) => {
      const { name, description, targets, hosts, slots, generation } =
        studioComponentDefinitions[kind];
      return { kind, name, description, uses: targets, hosts, slots, generation };
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
 * The design as chat sees it: the actions with their lanes, entries and tiles, then every tile in
 * lane order with its kind, settings, outgoing links (sync or async) and modules.
 */
function designSummary(design: DesignDocument, findings: readonly Finding[]) {
  const studio = design.architecture?.studio;
  const graph = laneGraph(design);
  const elements = new Map(design.elements.map((item) => [item.id, item]));
  const bindings = new Map(studio?.elements.map((item) => [item.element, item]));
  const connections = new Map(design.connections.map((item) => [item.id, item]));
  const linkSettings = new Map(studio?.connections.map((item) => [item.connection, item.settings]));
  const readiness = designReadiness(design);
  /** A link into a store: `write` from its owner, `read` otherwise (one writer per store). */
  const accessOf = (id: string) => {
    const access = studioStoreAccess(design, id);
    const explicit = designOwnership(design).dependencies.find((item) => item.connection === id);
    return {
      ...(access ? { access, accessBasis: "legacy-inferred; not a declared grant" } : {}),
      ...(explicit ? { declaredAccess: explicit.access } : {}),
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
          ...(item.description && { description: item.description }),
          settings: item.settings,
          links: (studio?.componentConnections ?? [])
            .filter((link) => link.from === item.id)
            .map(({ id, to }) => ({ id, to })),
          ...(status && {
            status: status.status,
            ...(status.template && { template: status.template }),
            ...(status.reason && { reason: status.reason }),
            ...(status.unconnected.length && { unconnected: status.unconnected }),
          }),
        };
      });
  return {
    baseRevision: design.revision,
    schemaVersion: design.schemaVersion,
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
    ...(designGeneration(design)
      ? {
          declaredGeneration: designGeneration(design),
          generationFindings: generationFindings(design),
        }
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
              planned: connections.get(edge.id)?.planned,
              settings: linkSettings.get(edge.id),
            })),
          ...(hosted.length && { modules: hosted }),
        };
      }),
    caps,
    findings: findings.filter((item) => !isDesignWarning(item)),
    /** Designs that look wrong but are allowed; resolve the ones this turn caused. */
    warnings: findings.filter(isDesignWarning).map((item) => item.message),
    installedPresets: supportedGenerationPresets(installedGenerationSupport()),
    editableSettings: normalGenerationControls(design, installedGenerationSupport()),
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
  return `[Jeeves] Studio context.\nTile types (finite, design only):\n${JSON.stringify(catalogSummary())}\nCurrent design:\n${JSON.stringify(designSummary(design, findings))}\nSelected identities: ${JSON.stringify(selection)}\nSelected logical owners (owner:<id>, distinct from element/connection IDs; roles are not independently selected): ${JSON.stringify(selectedLogicalOwners(design, selection))}\nSelected operation bindings (operation:<id>, distinct from role/owner IDs; parent selection does not select operations): ${JSON.stringify(selectedOperationBindings(design, selection))}`;
}

const commandTypes: readonly string[] = studioCommandSchema.options.map(
  (option) => option.shape.type.value,
);

/** A command type outside the vocabulary, refused in plain words. */
function unknownCommand(args: unknown): string | undefined {
  const commands = args && typeof args === "object" && "commands" in args ? args.commands : [];
  for (const command of Array.isArray(commands) ? commands : []) {
    const type = command && typeof command === "object" && "type" in command && command.type;
    if (
      typeof type === "string" &&
      !commandTypes.includes(type) &&
      type !== "attachGenerationPreset"
    )
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
    const review = reviewStudioDesign(this.base, this.working, this.scope);
    this.log(
      "reviewDesign",
      true,
      `Reviewed staged design: ${review.changes.length} changes, ${review.findings.length} findings, ${review.obligations.length} not specified obligations`,
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
          installedPresets: supportedGenerationPresets(this.installed),
          editableSettings: normalGenerationControls(this.working, this.installed),
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
        this.log(tool, true, "Listed reviewed design patterns");
        return listStudioPatterns();
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
        const batch = buildSupportedAuthoringCommand(working, command, this.installed);
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
    if (ops.length) this.generation++;
    this.log(
      tool,
      true,
      `Prepared ${commands.length} studio command${commands.length === 1 ? "" : "s"}`,
    );
    const findings = validateDesign(working);
    return {
      ok: true,
      commands: commands.length,
      findings: findings.filter((item) => !isDesignWarning(item)),
      warnings: findings.filter(isDesignWarning).map((item) => item.message),
      note: "Prepared for one atomic turn commit, not saved yet.",
    };
  }
}
