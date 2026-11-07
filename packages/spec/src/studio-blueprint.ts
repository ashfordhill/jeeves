/**
 * The read-only code-generation boundary. A blueprint is a versioned projection of the
 * studio model holding only generation-relevant parts. It omits layout, presentation, history and
 * studio UI state. It states design intent only: it never claims a template, runtime or evidence.
 */
import { z } from "zod";
import { containerContext } from "./architecture.ts";
import type { DesignDocument } from "./design.ts";
import {
  designScope,
  designScopeFindings,
  designScopeSchema,
  profileStatus,
  unresolvedDesignScope,
} from "./design-scope.ts";
import { findingSchema } from "./findings.ts";
import { idSchema } from "./ids.ts";
import {
  createLinkOperation,
  designOperations,
  exactContractRefSchema,
  operationContractFindings,
  operationContractsSchema,
} from "./operation-contracts.ts";
import { designOwnership, ownershipFindings, ownershipSchema } from "./ownership.ts";
import { connectionPresentation, relationshipInteractionSchema } from "./relationship-display.ts";
import {
  type StudioComponentTargetKind,
  studioComponentDefinitions,
  studioComponentKindSchema,
  studioComponentRequirements,
  studioComponentSettingsSchema,
} from "./studio-components.ts";
import { studioStoreAccess, studioStoreAccessValues } from "./studio-links.ts";
import {
  definitionRefSchema,
  type StudioElementBinding,
  studioActions,
  studioApplicationKinds,
  studioChannelUseSchema,
  studioDefinitionStatus,
  studioExternalCategorySchema,
  studioExternalProviderSchema,
  studioLaneSchema,
  studioOwnerSchema,
  studioRetrySchema,
  studioSettingsSchema,
} from "./studio-model.ts";
import { validateStudio } from "./studio-validation.ts";

export const blueprintVersion = 2 as const;
const text = z.string();
const definition = z.strictObject({
  ...definitionRefSchema.shape,
  /** `unresolved` keeps an unknown definition version explicit; it is never substituted. */
  status: z.enum(["known", "unresolved"]),
});
const elementBase = {
  id: idSchema,
  name: text,
  description: text.optional(),
  definition,
  /** The C1 node (external system) that reuses this element at C1, if any. */
  context: idSchema.optional(),
};

const componentTargetKindSchema = z.enum([
  "application",
  "identity",
  "database",
  "cache",
  "queue",
  "search",
  "object-store",
  "cdn",
  "external-api",
] satisfies StudioComponentTargetKind[]);
/** One C3 module inside its service. `thirdParty` is typical implementation intent only. */
export const blueprintComponentSchema = z.strictObject({
  id: idSchema,
  name: text,
  purpose: text.optional(),
  kind: studioComponentKindSchema,
  settings: studioComponentSettingsSchema,
  thirdParty: z.array(text),
  /** Element kinds the settings need a link to before the component is ready. */
  requires: z.array(z.strictObject({ kinds: z.array(componentTargetKindSchema), reason: text })),
});
/** One C2 deployable: one future generated service. */
export const blueprintServiceSchema = z.strictObject({
  ...elementBase,
  kind: z.enum(studioApplicationKinds),
  settings: studioSettingsSchema,
  /** The group frame (studio package) this deployable belongs to, if any. */
  group: idSchema.optional(),
  components: z.array(blueprintComponentSchema),
});
export const blueprintResourceSchema = z.strictObject({
  ...elementBase,
  kind: z.enum(["database", "cache", "queue", "object-store", "search", "cdn"]),
  settings: studioSettingsSchema,
  owner: studioOwnerSchema.optional(),
});
/** A studio External API element, or a C1 external system without a C2 element. */
export const blueprintExternalSchema = z.discriminatedUnion("source", [
  z.strictObject({
    source: z.literal("element"),
    ...elementBase,
    category: studioExternalCategorySchema,
    provider: studioExternalProviderSchema,
  }),
  z.strictObject({ source: z.literal("context"), id: idSchema, name: text, description: text }),
]);
export const blueprintGroupSchema = z.strictObject({
  id: idSchema,
  name: text,
  description: text,
  members: z.array(idSchema),
});
export const blueprintEndpointSchema = z.strictObject({
  kind: z.enum(["service", "resource", "external", "system"]),
  id: idSchema,
});
/** A resolved C2 connection: identity, intent and the studio binding's request policies. */
export const blueprintConnectionSchema = z.strictObject({
  id: idSchema,
  source: z.enum(["design", "context"]),
  from: blueprintEndpointSchema,
  to: blueprintEndpointSchema,
  action: text,
  protocol: text,
  interaction: relationshipInteractionSchema.optional(),
  /** The planned security of the call (for example "Service identity"). */
  security: text.optional(),
  /** A link into a store: `write` from the store's owner, `read` from any other tile. */
  access: z.enum(studioStoreAccessValues).optional(),
  channelUse: studioChannelUseSchema.optional(),
  timeoutMs: z.int().optional(),
  retry: studioRetrySchema.optional(),
});
/** A component's use of a sibling component or, through a traced C2 connection, an element. */
export const blueprintComponentLinkSchema = z.strictObject({
  id: idSchema,
  service: idSchema,
  from: idSchema,
  to: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("component"), id: idSchema }),
    z.strictObject({ kind: z.literal("element"), id: idSchema, via: idSchema }),
  ]),
  label: text.optional(),
});
/** What the user does in a lane (at most one action per lane): the word on its action tile. */
export const blueprintActionSchema = z.strictObject({ lane: studioLaneSchema, name: text });
/** A tile a lane's action reaches directly: the lane, its action's name and the tile. */
export const blueprintEntrySchema = z.strictObject({
  lane: studioLaneSchema,
  action: text,
  element: idSchema,
});
export const blueprintOmissionSchema = z.strictObject({
  kind: z.enum(["element", "connection", "component", "component-link", "entry"]),
  id: idSchema,
  reason: z.enum(["no-studio-binding", "endpoint-outside-blueprint", "host-not-a-service"]),
});
export const designBlueprintSchema = z.strictObject({
  blueprint: z.literal(blueprintVersion),
  /** Semantic design revision the blueprint was read from. */
  revision: z.int().nonnegative(),
  system: z.strictObject({ name: text, description: text }),
  /** The user's actions, in lane order (download, then upload). */
  actions: z.array(blueprintActionSchema),
  /** The actions' lane entries, sorted by lane then element. */
  entries: z.array(blueprintEntrySchema),
  services: z.array(blueprintServiceSchema),
  resources: z.array(blueprintResourceSchema),
  externals: z.array(blueprintExternalSchema),
  groups: z.array(blueprintGroupSchema),
  connections: z.array(blueprintConnectionSchema),
  componentLinks: z.array(blueprintComponentLinkSchema),
  /** Design parts that exist but are outside the finite studio model, so nothing vanishes silently. */
  omitted: z.array(blueprintOmissionSchema),
  /**
   * Studio findings at this revision; readiness gaps are `CONFIG_REQUIRED`, and design warnings
   * (allowed, never refusals) are `DESIGN_WARNING` with severity `warning`.
   */
  findings: z.array(findingSchema),
});
export type DesignBlueprint = z.output<typeof designBlueprintSchema>;
export type BlueprintEndpoint = z.output<typeof blueprintEndpointSchema>;

/** JSON Schema (draft 2020-12) of the blueprint, for a generator outside this repository. */
export function designBlueprintJsonSchema() {
  return z.toJSONSchema(designBlueprintSchema, { target: "draft-2020-12", io: "output" });
}

const byId = <T extends { id: string }>(items: readonly T[]) =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const resourceKinds = new Set<string>(blueprintResourceSchema.shape.kind.options);
const applicationKinds = new Set<string>(studioApplicationKinds);
const clone = <T>(value: T): T => structuredClone(value);

/**
 * Pure and deterministic: the same design always gives the same blueprint, sorted by identity.
 * Only studio-bound elements become services, resources or externals; everything else is listed
 * in `omitted`. The design is never changed.
 */
export function designBlueprint(design: DesignDocument, projectName = ""): DesignBlueprint {
  const unsupported = unsupportedBlueprintV2(design);
  if (unsupported.length) throw new UnsupportedBlueprintContentError(unsupported);
  return projectLegacyBlueprint(design, projectName);
}

export type UnsupportedBlueprintContent = { path: (string | number)[]; reason: string };
export function unsupportedBlueprintV2(design: DesignDocument): UnsupportedBlueprintContent[] {
  if (design.schemaVersion === 2) return [];
  return [
    ...(design.scope.profile
      ? [
          {
            path: ["scope", "profile"],
            reason: "Exact behavior profile is unsupported by blueprint v2.",
          },
        ]
      : []),
    ...design.scope.requirements.map((item, index) => ({
      path: ["scope", "requirements", index],
      reason: `Persistent ${item.disposition} ${item.feature} (${item.criticality}) is unsupported by blueprint v2.`,
    })),
    ...Object.entries(designOwnership(design)).flatMap(([field, rows]) =>
      rows.map((_, index) => ({
        path: ["ownership", field, index],
        reason: `Explicit ${field} declaration is unsupported by blueprint v2.`,
      })),
    ),
    ...Object.entries(designOperations(design)).flatMap(([field, rows]) =>
      rows.map((_, index) => ({
        path: ["operations", field, index],
        reason: `Exact operation ${field} binding is unsupported by blueprint v2.`,
      })),
    ),
    ...design.scope.customRequirements.map((item, index) => ({
      path: ["scope", "customRequirements", index],
      reason: `Unresolved custom requirement ${item.id} (${item.criticality}) is unsupported by blueprint v2.`,
    })),
  ];
}
export class UnsupportedBlueprintContentError extends Error {
  readonly code = "UNSUPPORTED_BLUEPRINT_CONTENT";
  constructor(readonly unsupported: UnsupportedBlueprintContent[]) {
    super("Blueprint v2 cannot represent this design's explicit declarations. Request ?version=3.");
  }
}

export const designBlueprintV3Schema = designBlueprintSchema.extend({
  blueprint: z.literal(3),
  sourceSchemaVersion: z.union([z.literal(2), z.literal(3)]),
  scope: designScopeSchema,
  profileStatus: z.enum(["known", "unresolved", "unspecified"]),
  ownership: ownershipSchema,
  ownershipStatus: z.enum(["declared", "unspecified"]),
  ownershipFindings: z.array(findingSchema),
  operations: operationContractsSchema,
  operationFindings: z.array(findingSchema),
  operationCatalog: z.array(exactContractRefSchema),
  unresolvedRequirements: z.array(
    z.strictObject({
      source: z.enum(["profile", "requirement", "contract", "custom"]),
      id: idSchema,
      requirement: z.string(),
      criticality: z.enum(["required", "advisory"]),
      element: idSchema.optional(),
      connection: idSchema.optional(),
    }),
  ),
  legacyOwnership: z.literal(
    "resources[].owner is the legacy inferred writer; ownership.resources[].authority is explicit logical authority",
  ),
  roleMeaning: z.literal(
    "services contain canonical application tiles; declared roles are not independent logical owners or necessarily separate processes",
  ),
  legacyAccess: z.literal("inferred-from-ownership; not a declared operation grant"),
  templateAvailability: z.literal("none"),
  runtimeVerification: z.literal("none"),
});
export type DesignBlueprintV3 = z.output<typeof designBlueprintV3Schema>;
export function designBlueprintV3JsonSchema() {
  return z.toJSONSchema(designBlueprintV3Schema, { target: "draft-2020-12", io: "output" });
}
export function designBlueprintV3(design: DesignDocument, projectName = ""): DesignBlueprintV3 {
  const scope = clone(designScope(design));
  scope.requirements.sort((a, b) => (a.feature < b.feature ? -1 : a.feature > b.feature ? 1 : 0));
  scope.customRequirements = byId(scope.customRequirements);
  return {
    ...projectLegacyBlueprint(design, projectName),
    blueprint: 3,
    sourceSchemaVersion: design.schemaVersion,
    findings: [
      ...validateStudio(design),
      ...designScopeFindings(design),
      ...ownershipFindings(design),
      ...operationContractFindings(design),
    ],
    ownership: Object.fromEntries(
      Object.entries(designOwnership(design)).map(([key, rows]) => [
        key,
        [...rows].sort((a, b) =>
          JSON.stringify(a) < JSON.stringify(b)
            ? -1
            : JSON.stringify(a) > JSON.stringify(b)
              ? 1
              : 0,
        ),
      ]),
    ) as ReturnType<typeof designOwnership>,
    ownershipStatus: Object.values(designOwnership(design)).some((rows) => rows.length)
      ? "declared"
      : "unspecified",
    ownershipFindings: ownershipFindings(design),
    operations: {
      receivers: byId(designOperations(design).receivers).map(clone),
      calls: byId(designOperations(design).calls).map(clone),
    },
    operationFindings: operationContractFindings(design),
    operationCatalog: [{ ...createLinkOperation.ref }],
    scope,
    profileStatus: profileStatus(scope),
    unresolvedRequirements: [...unresolvedDesignScope(design)]
      .sort((a, b) =>
        a.source < b.source ? -1 : a.source > b.source ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      )
      .map(clone),
    legacyOwnership:
      "resources[].owner is the legacy inferred writer; ownership.resources[].authority is explicit logical authority",
    roleMeaning:
      "services contain canonical application tiles; declared roles are not independent logical owners or necessarily separate processes",
    legacyAccess: "inferred-from-ownership; not a declared operation grant",
    templateAvailability: "none",
    runtimeVerification: "none",
  };
}

function projectLegacyBlueprint(design: DesignDocument, projectName: string): DesignBlueprint {
  const architecture = design.architecture;
  const studio = architecture?.studio;
  const bindings = new Map<string, StudioElementBinding>(
    (studio?.elements ?? []).map((binding) => [binding.element, binding]),
  );
  const groupOf = new Map(
    (studio?.packages ?? []).flatMap((pkg) => pkg.members.map((id) => [id, pkg.id] as const)),
  );
  const contextFor = new Map(
    (architecture?.nodes ?? []).flatMap((node) =>
      node.kind === "external-system" && node.container ? [[node.container, node.id] as const] : [],
    ),
  );
  const endpointKind = new Map<string, BlueprintEndpoint["kind"]>();
  const omitted: DesignBlueprint["omitted"] = [];
  const services: DesignBlueprint["services"] = [];
  const resources: DesignBlueprint["resources"] = [];
  const externals: DesignBlueprint["externals"] = [];

  for (const element of byId(design.elements)) {
    const binding = bindings.get(element.id);
    if (!binding) {
      omitted.push({ kind: "element", id: element.id, reason: "no-studio-binding" });
      continue;
    }
    const settings = binding.settings;
    const status = studioDefinitionStatus(binding.definition, settings.kind);
    const base = {
      id: element.id,
      name: element.name,
      ...(element.description && { description: element.description }),
      definition: { ...binding.definition, status: status === "known" ? "known" : "unresolved" },
      ...(contextFor.has(element.id) && { context: contextFor.get(element.id) }),
    } as const;
    if (applicationKinds.has(settings.kind)) {
      endpointKind.set(element.id, "service");
      const group = groupOf.get(element.id);
      services.push({
        ...base,
        kind: settings.kind as DesignBlueprint["services"][number]["kind"],
        settings: clone(settings),
        ...(group && { group }),
        components: [],
      });
    } else if (resourceKinds.has(settings.kind)) {
      endpointKind.set(element.id, "resource");
      resources.push({
        ...base,
        kind: settings.kind as DesignBlueprint["resources"][number]["kind"],
        settings: clone(settings),
        ...(binding.owner && { owner: { ...binding.owner } }),
      });
    } else if (settings.kind === "external-api") {
      endpointKind.set(element.id, "external");
      externals.push({
        source: "element",
        ...base,
        category: settings.category,
        provider: settings.provider,
      });
    }
  }
  const contextExternals = new Set<string>();
  for (const node of byId(architecture?.nodes ?? []))
    if (node.kind === "external-system" && !(node.container && endpointKind.has(node.container))) {
      contextExternals.add(node.id);
      externals.push({
        source: "context",
        id: node.id,
        name: node.name,
        description: node.description,
      });
    }

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const components = byId(studio?.components ?? []);
  const componentHost = new Map<string, string>();
  for (const item of components) {
    const service = serviceById.get(item.host);
    if (!service) {
      omitted.push({ kind: "component", id: item.id, reason: "host-not-a-service" });
      continue;
    }
    componentHost.set(item.id, item.host);
    const definitionFor = studioComponentDefinitions[item.settings.kind];
    service.components.push({
      id: item.id,
      name: item.name,
      ...(item.description && { purpose: item.description }),
      kind: item.settings.kind,
      settings: clone(item.settings),
      thirdParty: [...definitionFor.thirdParty],
      requires: studioComponentRequirements(item.settings).map((need) => ({
        kinds: [...need.kinds],
        reason: need.reason,
      })),
    });
  }

  const connectionSettings = new Map(
    (studio?.connections ?? []).map((item) => [item.connection, item.settings]),
  );
  const connections: DesignBlueprint["connections"] = [];
  for (const connection of byId(design.connections)) {
    const from = endpointKind.get(connection.from.element);
    const to = endpointKind.get(connection.to.element);
    if (!from || !to) {
      omitted.push({ kind: "connection", id: connection.id, reason: "endpoint-outside-blueprint" });
      continue;
    }
    const shown = connectionPresentation(connection);
    const settings = connectionSettings.get(connection.id);
    const access = studioStoreAccess(design, connection.id);
    connections.push({
      id: connection.id,
      source: "design",
      from: { kind: from, id: connection.from.element },
      to: { kind: to, id: connection.to.element },
      action: shown.description,
      protocol: shown.protocol,
      interaction: shown.interaction,
      security: connection.planned.security,
      ...(access && { access }),
      ...(settings?.channelUse && { channelUse: settings.channelUse }),
      ...(settings?.timeoutMs !== undefined && { timeoutMs: settings.timeoutMs }),
      ...(settings?.retry && { retry: { ...settings.retry } }),
    });
  }
  // C1 integrations with external systems that have no C2 element. People are not generated.
  const contextEnd = (id: string): BlueprintEndpoint | undefined => {
    if (id === "context:system") return { kind: "system", id: "system" };
    if (id.startsWith("context:")) {
      const node = id.slice("context:".length);
      return contextExternals.has(node) ? { kind: "external", id: node } : undefined;
    }
    const kind = endpointKind.get(id);
    return kind ? { kind, id } : undefined;
  };
  for (const relation of byId(containerContext(design).relationships)) {
    const from = contextEnd(relation.source);
    const to = contextEnd(relation.target);
    if (!from || !to || (from.kind !== "external" && to.kind !== "external")) continue;
    connections.push({
      id: relation.id,
      source: "context",
      from,
      to,
      action: relation.description,
      protocol: relation.protocol,
    });
  }

  const actions = studioActions(studio);
  const actionName = new Map(actions.map((action) => [action.lane, action.name]));
  const entries: DesignBlueprint["entries"] = [];
  for (const entry of byId(studio?.entries ?? [])) {
    if (!endpointKind.has(entry.element)) {
      omitted.push({ kind: "entry", id: entry.id, reason: "endpoint-outside-blueprint" });
      continue;
    }
    entries.push({
      lane: entry.lane,
      action: actionName.get(entry.lane) ?? "",
      element: entry.element,
    });
  }
  const order = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);
  entries.sort((a, b) => order(a.lane, b.lane) || order(a.element, b.element));

  const componentLinks: DesignBlueprint["componentLinks"] = [];
  for (const link of byId(studio?.componentConnections ?? [])) {
    const service = componentHost.get(link.from);
    const reachable =
      service &&
      (link.to.kind === "component"
        ? componentHost.get(link.to.id) === service
        : endpointKind.has(link.to.id));
    if (!service || !reachable) {
      omitted.push({ kind: "component-link", id: link.id, reason: "endpoint-outside-blueprint" });
      continue;
    }
    componentLinks.push({
      id: link.id,
      service,
      from: link.from,
      to: { ...link.to },
      ...(link.label && { label: link.label }),
    });
  }

  return {
    blueprint: blueprintVersion,
    revision: design.revision,
    system: {
      name: architecture?.system.name ?? projectName,
      description: architecture?.system.description ?? "",
    },
    actions: actions.map((action) => ({ lane: action.lane, name: action.name })),
    entries,
    services,
    resources,
    externals,
    groups: byId(studio?.packages ?? []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      members: [...pkg.members].sort(),
    })),
    connections,
    componentLinks,
    omitted,
    findings: validateStudio(design).map((item) => clone(item)),
  };
}
