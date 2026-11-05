/** Pure presentation over canonical identities. No migration, runtime resolution or layout. */
import { containerContext } from "./architecture.ts";
import { containerClassification, isExternalResponsibility } from "./architecture-choices.ts";
import type { DesignDocument, Element } from "./design.ts";
import { type StudioComponentKind, studioComponentDefinitions } from "./studio-components.ts";
import { type StudioDefinition, type StudioVisual, studioVisual } from "./studio-definitions.ts";
import type {
  DefinitionRef,
  StudioElementBinding,
  StudioKind,
  StudioOwner,
} from "./studio-model.ts";
import {
  type StudioRelationship,
  type StudioRelationshipSource,
  type StudioTrunk,
  withStudioRelationships,
} from "./studio-relationships.ts";

export type StudioSemanticRef =
  | { kind: "system" }
  | { kind: "context" | "element" | "package" | "component"; id: string };
/** Three equal levels (SG05). C3 is one whole-system projection, never a per-service scope. */
export const studioViewKeys = {
  context: "studio:context",
  containers: "studio:containers",
  components: "studio:components",
} as const;
export const studioNodeKeys = {
  system: "studio:context:system",
  context: (id: string) => `studio:context:${id}`,
  element: (id: string) => `studio:element:${id}`,
  package: (id: string) => `studio:package:${id}`,
  component: (id: string) => `studio:component:${id}`,
} as const;

/** A browser is an application boundary, with no invented Docker deployment. */
export type StudioExecutionIntent =
  | { kind: "docker" }
  | { kind: "managed"; host: string }
  | { kind: "browser"; delivery: "standalone"; provider: string }
  | { kind: "browser"; delivery: "bundled"; servedBy?: StudioSemanticRef };
export interface StudioViewNode {
  id: string;
  refs: StudioSemanticRef[];
  kind: StudioKind | "generic" | "package" | "component" | "person" | "system" | "external-system";
  name: string;
  description: string;
  /** `unbound` marks an element without studio settings, which validation reports. */
  source: "studio" | "unbound" | "context";
  role: "primary" | "member" | "owner" | "reference";
  visual: Readonly<StudioVisual>;
  definition?: DefinitionRef;
  definitionStatus?: "known" | "unresolved";
  owner?: StudioOwner;
  execution?: StudioExecutionIntent;
  /** C3 component kind, from the finite SG02 catalog. */
  componentKind?: StudioComponentKind;
  /** An open labelled group: a package at C2, an application holding components at C3. */
  frame?: true;
  /** The frame node this node is drawn inside. Presentation only; never ownership or wiring. */
  parent?: string;
  /** Summary of real applications; a package has no execution/settings of its own. */
  members?: { ref: StudioSemanticRef; name: string; execution?: StudioExecutionIntent }[];
}
export interface StudioScopeProjection {
  key: string;
  level: "context" | "containers" | "components";
  scope: StudioSemanticRef;
  name: string;
  description: string;
  nodes: StudioViewNode[];
  edges: StudioRelationship[];
  trunks: StudioTrunk[];
}
export interface StudioViews {
  context: StudioScopeProjection;
  containers: StudioScopeProjection;
  components: StudioScopeProjection;
  source: {
    omittedElements: { ref: StudioSemanticRef; reason: "deployment-infrastructure" }[];
    /** Queues missing from C3 (none today; kept so source accounting stays explicit). */
    unscopedQueues: StudioSemanticRef[];
    relationships: StudioRelationshipSource;
  };
}
export type StudioViewDefinitions = Readonly<
  Record<string, Pick<StudioDefinition, "id" | "version" | "kind" | "visual">>
>;
const byId = <T extends { id: string }>(items: readonly T[]) =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const elementRef = (id: string): StudioSemanticRef => ({ kind: "element", id });
/** C1, C2 and C3 in tab order. */
export const studioScopes = (views: StudioViews): StudioScopeProjection[] => [
  views.context,
  views.containers,
  views.components,
];
/** Per-kind C3 component card visual; also used by the studio `+` picker (SG09). */
export const studioComponentVisuals: Readonly<Record<StudioComponentKind, Readonly<StudioVisual>>> =
  {
    "rate-limiter": { icon: "shield", color: "generic", shape: "box" },
    "cache-reader": { icon: "bolt", color: "data", shape: "box" },
    "id-generator": { icon: "repeat", color: "generic", shape: "box" },
    "redirect-responder": { icon: "route", color: "api", shape: "box" },
    "event-publisher": { icon: "plug-connected", color: "messaging", shape: "box" },
    "event-consumer": { icon: "plug", color: "messaging", shape: "box" },
    "data-access": { icon: "database", color: "data", shape: "box" },
    "auth-guard": { icon: "lock", color: "generic", shape: "box" },
    "external-call": { icon: "world", color: "external", shape: "box" },
    custom: { icon: "puzzle", color: "generic", shape: "box" },
  };

function executionIntent(binding?: StudioElementBinding): StudioExecutionIntent | undefined {
  const settings = binding?.settings;
  if (!settings) return undefined;
  if (settings.kind === "browser")
    return settings.delivery === "bundled"
      ? {
          kind: "browser",
          delivery: "bundled",
          ...(settings.servedBy && { servedBy: elementRef(settings.servedBy) }),
        }
      : { kind: "browser", delivery: "standalone", provider: settings.provider };
  if ("execution" in settings)
    return settings.execution === "managed"
      ? { kind: "managed", host: settings.host }
      : { kind: "docker" };
  return undefined;
}

/**
 * C1, C2 and the whole-system C3 with relationship provenance, under stable keys. This projection
 * never authors wiring, runtime settings or layout.
 */
export function studioViews(
  design: DesignDocument,
  definitions: StudioViewDefinitions,
  projectName: string,
): StudioViews {
  const architecture = design.architecture;
  const studio = architecture?.studio;
  const bindings = new Map(studio?.elements.map((binding) => [binding.element, binding]));
  const elements = new Map(design.elements.map((element) => [element.id, element]));
  const packages = byId(studio?.packages ?? []);
  const membership = new Map(
    packages.flatMap((pkg) => pkg.members.map((id) => [id, pkg] as const)),
  );
  const kindFor = (element: Element) => bindings.get(element.id)?.settings.kind;
  const omittedElements: StudioViews["source"]["omittedElements"] = [];
  const visible = byId(design.elements).filter((element) => {
    if (bindings.has(element.id)) return true;
    const reason =
      containerClassification(element).kind === "Deployment infrastructure"
        ? "deployment-infrastructure"
        : undefined;
    if (reason) omittedElements.push({ ref: elementRef(element.id), reason });
    return !reason;
  });
  const nodeFor = (element: Element, role: StudioViewNode["role"]): StudioViewNode => {
    const binding = bindings.get(element.id);
    const kind = kindFor(element);
    const definition =
      binding &&
      Object.values(definitions).find(
        (item) =>
          item.id === binding.definition.id &&
          item.version === binding.definition.version &&
          item.kind === binding.settings.kind,
      );
    return {
      id: studioNodeKeys.element(element.id),
      refs: [elementRef(element.id)],
      kind: kind ?? "generic",
      name: element.name,
      description: element.description ?? "",
      source: binding ? "studio" : "unbound",
      role,
      visual: { ...(definition?.visual ?? studioVisual()) },
      ...(binding && {
        definition: { ...binding.definition },
        definitionStatus: definition ? ("known" as const) : ("unresolved" as const),
        ...(binding.owner && { owner: { ...binding.owner } }),
      }),
      ...(executionIntent(binding) && { execution: executionIntent(binding) }),
    };
  };
  const contextNode = (node: NonNullable<typeof architecture>["nodes"][number]): StudioViewNode => {
    const linked = node.container ? elements.get(node.container) : undefined;
    return {
      id: studioNodeKeys.context(node.id),
      refs: [
        { kind: "context", id: node.id },
        ...(linked && isExternalResponsibility(linked) ? [elementRef(linked.id)] : []),
      ],
      kind: node.kind,
      name: node.name,
      description: node.description,
      source: "context",
      role: "primary",
      visual: {
        icon: node.kind === "person" ? "user" : "world",
        color: "external",
        shape: "box",
      },
    };
  };
  const system: StudioViewNode = {
    id: studioNodeKeys.system,
    refs: [{ kind: "system" }],
    kind: "system",
    name: architecture?.system.name ?? projectName,
    description: architecture?.system.description ?? "",
    source: "context",
    role: "primary",
    visual: { ...studioVisual() },
  };
  const context: StudioScopeProjection = {
    key: studioViewKeys.context,
    level: "context",
    scope: { kind: "system" },
    name: system.name,
    description: system.description,
    nodes: [system, ...byId(architecture?.nodes ?? []).map(contextNode)],
    edges: [],
    trunks: [],
  };
  const c2Context = containerContext(design);
  // C2: one card per deployable or resource. A package is an open, labelled frame around its
  // member applications and the resources it owns; it has no execution or settings of its own.
  const packageNodes = packages.map(
    (pkg): StudioViewNode => ({
      id: studioNodeKeys.package(pkg.id),
      refs: [{ kind: "package", id: pkg.id }],
      kind: "package",
      name: pkg.name,
      description: pkg.description,
      source: "studio",
      role: "primary",
      visual: { icon: "building", color: "api", shape: "box" },
      frame: true,
      members: [...pkg.members].sort().flatMap((id) => {
        const element = elements.get(id);
        return element
          ? [
              {
                ref: elementRef(id),
                name: element.name,
                ...(executionIntent(bindings.get(id)) && {
                  execution: executionIntent(bindings.get(id)),
                }),
              },
            ]
          : [];
      }),
    }),
  );
  const packageFor = (element: Element) => {
    const owner = bindings.get(element.id)?.owner;
    return (
      membership.get(element.id) ??
      (owner?.kind === "package" ? packages.find((item) => item.id === owner.id) : undefined)
    );
  };
  const containers: StudioScopeProjection = {
    key: studioViewKeys.containers,
    level: "containers",
    scope: { kind: "system" },
    name: system.name,
    description: system.description,
    edges: [],
    trunks: [],
    nodes: [
      ...visible
        .filter((element) => kindFor(element) !== "queue")
        .map((element) => {
          const node = nodeFor(element, membership.has(element.id) ? "member" : "primary");
          const pkg = packageFor(element);
          return pkg ? { ...node, parent: studioNodeKeys.package(pkg.id) } : node;
        }),
      ...packageNodes,
    ],
  };
  containers.nodes.push(...c2Context.nodes.filter((node) => !node.container).map(contextNode));
  if (
    c2Context.relationships.some(
      (relation) => relation.source === "context:system" || relation.target === "context:system",
    )
  )
    containers.nodes.push({ ...system });
  // C3: the whole system at once. Each application that has components is a frame containing
  // them; queues, resources and external systems sit around the frames.
  const visibleIds = new Set(visible.map((element) => element.id));
  const components = byId(studio?.components ?? []).filter((item) => visibleIds.has(item.host));
  const hosts = new Set(components.map((item) => item.host));
  const componentScope: StudioScopeProjection = {
    key: studioViewKeys.components,
    level: "components",
    scope: { kind: "system" },
    name: system.name,
    description: system.description,
    edges: [],
    trunks: [],
    nodes: [
      ...visible.map((element) => {
        const node = nodeFor(element, hosts.has(element.id) ? "owner" : "primary");
        return hosts.has(element.id) ? { ...node, frame: true as const } : node;
      }),
      ...components.map(
        (item): StudioViewNode => ({
          id: studioNodeKeys.component(item.id),
          refs: [{ kind: "component", id: item.id }],
          kind: "component",
          componentKind: item.settings.kind,
          name: item.name,
          description:
            item.description ?? studioComponentDefinitions[item.settings.kind].description,
          source: "studio",
          role: "member",
          visual: { ...studioComponentVisuals[item.settings.kind] },
          parent: studioNodeKeys.element(item.host),
        }),
      ),
    ],
  };
  for (const view of [containers, componentScope]) view.nodes = byId(view.nodes);
  return withStudioRelationships(design, {
    context,
    containers,
    components: componentScope,
    source: {
      omittedElements,
      unscopedQueues: visible
        .filter(
          (element) =>
            kindFor(element) === "queue" &&
            !componentScope.nodes.some((node) => node.id === studioNodeKeys.element(element.id)),
        )
        .map((element) => elementRef(element.id)),
      relationships: { accounting: [], unresolved: [], suppressed: [] },
    },
  });
}
