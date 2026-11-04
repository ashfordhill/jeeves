/** Pure presentation over canonical identities. No migration, runtime resolution or layout. */
import { containerContext } from "./architecture.ts";
import { containerClassification, isExternalResponsibility } from "./architecture-choices.ts";
import type { DesignDocument, Element } from "./design.ts";
import { type StudioDefinition, type StudioVisual, studioVisual } from "./studio-definitions.ts";
import { legacyStudioKind } from "./studio-legacy.ts";
import type {
  DefinitionRef,
  StudioElementBinding,
  StudioKind,
  StudioOwner,
} from "./studio-model.ts";
import { studioApplicationKinds } from "./studio-model.ts";
import {
  type StudioRelationship,
  type StudioRelationshipSource,
  type StudioTrunk,
  withStudioRelationships,
} from "./studio-relationships.ts";

export type StudioSemanticRef =
  | { kind: "system" }
  | { kind: "context" | "element" | "package"; id: string };
export const studioViewKeys = {
  context: "studio:context",
  containers: "studio:containers",
  service: (id: string) => `studio:service:${id}`,
  package: (id: string) => `studio:package:${id}`,
} as const;
export const studioNodeKeys = {
  system: "studio:context:system",
  context: (id: string) => `studio:context:${id}`,
  element: (id: string) => `studio:element:${id}`,
  package: (id: string) => `studio:package:${id}`,
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
  kind: StudioKind | "generic" | "package" | "person" | "system" | "external-system";
  name: string;
  description: string;
  source: "studio" | "legacy" | "context";
  role: "primary" | "member" | "owner" | "reference";
  visual: Readonly<StudioVisual>;
  definition?: DefinitionRef;
  definitionStatus?: "known" | "unresolved";
  owner?: StudioOwner;
  execution?: StudioExecutionIntent;
  drillKey?: string;
  /** Summary of real applications; a package has no execution/settings of its own. */
  members?: { ref: StudioSemanticRef; name: string; execution?: StudioExecutionIntent }[];
}
export interface StudioBreadcrumb {
  key: string;
  name: string;
}
export interface StudioScopeProjection {
  key: string;
  level: "context" | "containers" | "detail";
  scope: StudioSemanticRef;
  name: string;
  description: string;
  parentKey?: string;
  breadcrumb: StudioBreadcrumb[];
  nodes: StudioViewNode[];
  edges: StudioRelationship[];
  trunks: StudioTrunk[];
}
export interface StudioViews {
  context: StudioScopeProjection;
  containers: StudioScopeProjection;
  details: StudioScopeProjection[];
  /** Source stays in the design for Generate/export; omitted internals never become fake children. */
  source: {
    summarizedComponents: { id: string; owner: StudioSemanticRef }[];
    omittedElements: { ref: StudioSemanticRef; reason: "deployment-infrastructure" }[];
    /** An unowned, disconnected legacy queue cannot acquire an invented service scope. */
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
 * All useful detail scopes and relationship provenance are returned, with stable keys for explicit
 * navigation. This projection never authors wiring, runtime settings or layout.
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
  const kindFor = (element: Element) =>
    bindings.get(element.id)?.settings.kind ?? legacyStudioKind(element);
  const application = (element: Element) => {
    const binding = bindings.get(element.id);
    // A legacy external identity provider is not a new independently authored Identity service.
    return binding
      ? studioApplicationKinds.some((value) => value === binding.settings.kind)
      : containerClassification(element).kind === "Application";
  };
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
      source: binding ? "studio" : "legacy",
      role,
      visual: { ...(definition?.visual ?? studioVisual(binding ? undefined : kind)) },
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
    drillKey: studioViewKeys.containers,
  };
  const context: StudioScopeProjection = {
    key: studioViewKeys.context,
    level: "context",
    scope: { kind: "system" },
    name: system.name,
    description: system.description,
    breadcrumb: [{ key: studioViewKeys.context, name: "C1" }],
    nodes: [system, ...byId(architecture?.nodes ?? []).map(contextNode)],
    edges: [],
    trunks: [],
  };
  const c2Breadcrumb = [{ key: studioViewKeys.containers, name: "C2" }];
  const c2Context = containerContext(design);
  const containers: StudioScopeProjection = {
    key: studioViewKeys.containers,
    level: "containers",
    scope: { kind: "system" },
    name: system.name,
    description: system.description,
    parentKey: studioViewKeys.context,
    breadcrumb: c2Breadcrumb,
    edges: [],
    trunks: [],
    nodes: visible
      .filter((element) => {
        if (membership.has(element.id) || kindFor(element) === "queue") return false;
        const owner = bindings.get(element.id)?.owner;
        if (owner?.kind !== "package") return true;
        const pkg = packages.find((item) => item.id === owner.id);
        if (!pkg) return true;
        // Only package-owned resources whose every connection stays inside can collapse with it.
        return design.connections.some(
          (connection) =>
            (connection.from.element === element.id &&
              !pkg.members.includes(connection.to.element)) ||
            (connection.to.element === element.id &&
              !pkg.members.includes(connection.from.element)),
        );
      })
      .map((element) => nodeFor(element, "primary")),
  };
  containers.nodes.push(...c2Context.nodes.filter((node) => !node.container).map(contextNode));
  if (
    c2Context.relationships.some(
      (relation) => relation.source === "context:system" || relation.target === "context:system",
    )
  )
    containers.nodes.push({ ...system, drillKey: undefined });
  const details: StudioScopeProjection[] = [];
  // One-hop only: ownership and actual incident connections; never remote internals or scalar boxes.
  const relevant = (owners: Set<string>, packageId?: string) => {
    const ids = new Set(owners);
    for (const binding of studio?.elements ?? [])
      if (
        (binding.owner?.kind === "element" && owners.has(binding.owner.id)) ||
        (packageId && binding.owner?.kind === "package" && binding.owner.id === packageId)
      )
        ids.add(binding.element);
    for (const connection of design.connections) {
      if (owners.has(connection.from.element)) ids.add(connection.to.element);
      if (owners.has(connection.to.element)) ids.add(connection.from.element);
    }
    return visible.filter((element) => ids.has(element.id));
  };
  for (const pkg of packages) {
    const key = studioViewKeys.package(pkg.id);
    const members = new Set(pkg.members);
    const summary: StudioViewNode = {
      id: studioNodeKeys.package(pkg.id),
      refs: [{ kind: "package", id: pkg.id }],
      kind: "package",
      name: pkg.name,
      description: pkg.description,
      source: "studio",
      role: "primary",
      visual: { icon: "building", color: "api", shape: "box" },
      drillKey: key,
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
    };
    containers.nodes.push(summary);
    details.push({
      key,
      level: "detail",
      scope: { kind: "package", id: pkg.id },
      name: pkg.name,
      description: pkg.description,
      parentKey: containers.key,
      breadcrumb: [...c2Breadcrumb, { key, name: pkg.name }],
      edges: [],
      trunks: [],
      nodes: relevant(members, pkg.id).map((element) =>
        nodeFor(element, members.has(element.id) ? "member" : "reference"),
      ),
    });
  }
  for (const element of visible.filter(application)) {
    const dependencies = relevant(new Set([element.id]));
    if (!dependencies.some((item) => item.id !== element.id)) continue;
    const pkg = membership.get(element.id);
    const key = studioViewKeys.service(element.id);
    details.push({
      key,
      level: "detail",
      scope: elementRef(element.id),
      name: element.name,
      description: element.description ?? "",
      parentKey: pkg ? studioViewKeys.package(pkg.id) : containers.key,
      edges: [],
      trunks: [],
      breadcrumb: [
        ...c2Breadcrumb,
        ...(pkg ? [{ key: studioViewKeys.package(pkg.id), name: pkg.name }] : []),
        { key, name: element.name },
      ],
      nodes: dependencies.map((item) =>
        nodeFor(item, item.id === element.id ? "owner" : "reference"),
      ),
    });
  }
  const detailKeys = new Set(details.map((view) => view.key));
  for (const view of [containers, ...details]) {
    for (const node of view.nodes) {
      const ref = node.refs.find((ref) => ref.kind === "element");
      if (
        ref &&
        "id" in ref &&
        node.role !== "owner" &&
        detailKeys.has(studioViewKeys.service(ref.id))
      )
        node.drillKey = studioViewKeys.service(ref.id);
    }
    view.nodes = byId(view.nodes);
  }
  return withStudioRelationships(design, {
    context,
    containers,
    details: [...details].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    source: {
      summarizedComponents: byId(architecture?.components ?? []).map((component) => ({
        id: component.id,
        owner: elementRef(component.element),
      })),
      omittedElements,
      unscopedQueues: visible
        .filter(
          (element) =>
            kindFor(element) === "queue" &&
            !details.some((view) =>
              view.nodes.some((node) => node.id === studioNodeKeys.element(element.id)),
            ),
        )
        .map((element) => elementRef(element.id)),
      relationships: { accounting: [], unresolved: [], suppressed: [], componentRelationships: [] },
    },
  });
}
