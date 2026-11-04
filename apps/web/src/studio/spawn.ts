/**
 * SG08: `+` handle creation, adapted from automation-illustrator's `spawnBranch`. A drag from a
 * box's east (out) or west (in) handle creates one new box plus the one relationship that joins it
 * to that box, in a single operation batch (one undo step). Positions stay derived (SG06); nothing
 * here stores layout. Unlike the reference, an inbound spawn never retargets existing lines.
 */
import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  architectureSchema,
  buildStudioCommand,
  createStudioComponentSettings,
  type DesignDocument,
  type OperationInput,
  type StudioComponentKind,
  type StudioConnectionCreation,
  type StudioKind,
  type StudioScopeProjection,
  type StudioViewNode,
  studioComponentDefinitions,
  studioComponentKinds,
  studioComponentVisuals,
  studioDefinitions,
  studioResourceKinds,
} from "@jeeves/spec";
import {
  applicationKind,
  type ConnectionDraft,
  connectionDefaults,
  endpointKind,
  kindConnectionDefaults,
} from "./actions.ts";
import { c2Kinds, c3Kinds, designNames, id, uniqueName } from "./creation.ts";

/** East handles create targets of the box (out); west handles create sources (in). */
export type SpawnSide = "in" | "out";
export type SpawnChoice =
  | { type: "context"; kind: "person" | "external-system" }
  | { type: "element"; kind: StudioKind }
  | { type: "component"; kind: StudioComponentKind };
export type SpawnEndpoint =
  | { type: "context"; id: string }
  | { type: "element"; id: string; kind: StudioKind }
  | {
      type: "component";
      id: string;
      host: string;
      hostKind: StudioKind;
      kind: StudioComponentKind;
    };

export const spawnChoiceLabel = (choice: SpawnChoice) =>
  choice.type === "context"
    ? choice.kind === "person"
      ? "Person"
      : "External system"
    : choice.type === "element"
      ? studioDefinitions[choice.kind].creationName
      : studioComponentDefinitions[choice.kind].name;
export const spawnChoiceIcon = (choice: SpawnChoice) =>
  choice.type === "context"
    ? choice.kind === "person"
      ? "user"
      : "world"
    : choice.type === "element"
      ? studioDefinitions[choice.kind].visual.icon
      : studioComponentVisuals[choice.kind].icon;

/** The semantic endpoint a handle on this box stands for, or none (packages, legacy cards). */
export function spawnEndpoint(
  design: DesignDocument,
  scope: StudioScopeProjection,
  node: StudioViewNode | undefined,
): SpawnEndpoint | undefined {
  const ref = node?.refs[0];
  if (!node || !ref) return undefined;
  if (scope.level === "context") {
    if (ref.kind === "system") return { type: "context", id: "system" };
    return ref.kind === "context" ? { type: "context", id: ref.id } : undefined;
  }
  if (ref.kind === "element") {
    const kind = endpointKind(design, ref.id);
    return kind ? { type: "element", id: ref.id, kind } : undefined;
  }
  if (ref.kind === "component" && scope.level === "components") {
    const component = design.architecture?.studio?.components?.find((item) => item.id === ref.id);
    const hostKind = component && endpointKind(design, component.host);
    return component && hostKind
      ? {
          type: "component",
          id: component.id,
          host: component.host,
          hostKind,
          kind: component.settings.kind,
        }
      : undefined;
  }
  return undefined;
}

const defaultsFor = (source: StudioKind, target: StudioKind) => {
  try {
    return kindConnectionDefaults(source, target);
  } catch {
    return undefined;
  }
};
/** The C2 connection a component link traces, from the host's point of view. */
function viaDefaults(
  component: Extract<SpawnEndpoint, { type: "component" }>,
  element: StudioKind,
  side: SpawnSide,
) {
  const definition = studioComponentDefinitions[component.kind];
  if (!definition.targets.some((target) => target === element)) return undefined;
  const defaults =
    side === "out"
      ? defaultsFor(component.hostKind, element)
      : defaultsFor(element, component.hostKind);
  const role = defaults?.settings.channelUse;
  if (role && definition.channelUse && role !== definition.channelUse) return undefined;
  return defaults;
}

/** Kinds valid for this level and side; only kinds whose relationship the model accepts. */
export function spawnChoices(endpoint: SpawnEndpoint, side: SpawnSide): SpawnChoice[] {
  if (endpoint.type === "context")
    return [
      { type: "context", kind: side === "in" ? "person" : "external-system" },
      { type: "context", kind: side === "in" ? "external-system" : "person" },
    ];
  if (endpoint.type === "element") {
    return c2Kinds
      .filter((kind) =>
        side === "out" ? defaultsFor(endpoint.kind, kind) : defaultsFor(kind, endpoint.kind),
      )
      .map((kind) => ({ type: "element", kind }));
  }
  return [];
}
/** Component kinds an application of this kind may host (browser apps: client-safe only). */
const hostedComponents = (hostKind: StudioKind) =>
  studioComponentKinds
    .filter((kind) => hostKind !== "browser" || studioComponentDefinitions[kind].browserHost)
    .map((kind): SpawnChoice => ({ type: "component", kind }));
/** C3: components inside the same application, plus resources and queues it can use. */
export function c3SpawnChoices(endpoint: SpawnEndpoint, side: SpawnSide): SpawnChoice[] {
  if (endpoint.type === "context") return [];
  if (endpoint.type === "element") {
    const elements = c3Kinds
      .filter((kind) => {
        const defaults =
          side === "out" ? defaultsFor(endpoint.kind, kind) : defaultsFor(kind, endpoint.kind);
        // A new queue needs an owning application at this box's end.
        return defaults && (kind !== "queue" || applicationKind(endpoint.kind));
      })
      .map((kind): SpawnChoice => ({ type: "element", kind }));
    // SG09: an application (card or frame) gains a component inside it, with no link yet.
    return [
      ...(applicationKind(endpoint.kind) ? hostedComponents(endpoint.kind) : []),
      ...elements,
    ];
  }
  const components = hostedComponents(endpoint.hostKind);
  const elements = c3Kinds
    .filter((kind) => viaDefaults(endpoint, kind, side))
    .map((kind): SpawnChoice => ({ type: "element", kind }));
  return [...components, ...elements];
}
export const choicesFor = (
  scope: StudioScopeProjection,
  endpoint: SpawnEndpoint,
  side: SpawnSide,
) => (scope.level === "components" ? c3SpawnChoices(endpoint, side) : spawnChoices(endpoint, side));

export type SpawnResult = {
  ops: OperationInput[];
  /** The view node key of the new box. */
  node: string;
  /** A connection, context relationship or component link id carried by the new line. */
  relation: string;
};

const applied = (design: DesignDocument, ops: OperationInput[]) => {
  const result = applyOperations(design, ops, builtinRegistry(), { baseRevision: design.revision });
  if (!result.ok) throw new Error(result.errors[0]?.message ?? "This creation is invalid.");
  return result.design;
};
const resourceOwner = (kind: StudioKind, application?: string) =>
  application && studioResourceKinds.some((resource) => resource === kind)
    ? { owner: { kind: "element" as const, id: application } }
    : {};

/** Build one batch: the new box, its one relationship and (C3) the component link. */
export function spawnOps(
  design: DesignDocument,
  level: StudioScopeProjection["level"],
  systemName: string,
  endpoint: SpawnEndpoint,
  side: SpawnSide,
  choice: SpawnChoice,
): SpawnResult {
  const names = designNames(design);
  const system = { name: systemName, description: "" };
  const created = id();
  const relation = id();
  if (endpoint.type === "context") {
    if (choice.type !== "context" || level !== "context")
      throw new Error("Add people and external systems at C1.");
    const architecture = structuredClone(
      design.architecture ?? architectureSchema.parse({ system }),
    );
    architecture.nodes.push({
      id: created,
      kind: choice.kind,
      name: uniqueName(spawnChoiceLabel(choice), names),
      description: "",
    });
    architecture.relationships.push({
      id: relation,
      from: side === "out" ? endpoint.id : created,
      to: side === "out" ? created : endpoint.id,
      description: "Uses",
    });
    const ops: OperationInput[] = [{ op: "setArchitecture", architecture }];
    applied(design, ops);
    return { ops, node: `studio:context:${created}`, relation };
  }
  if (choice.type === "context") throw new Error("Add people and external systems at C1.");
  if (choice.type === "component") {
    if (level !== "components") throw new Error("Add components at C3.");
    const definition = studioComponentDefinitions[choice.kind];
    if (endpoint.type === "element") {
      // SG09: a first (or further) component inside this application, not linked to anything.
      if (!applicationKind(endpoint.kind))
        throw new Error("Components live inside an application.");
      if (endpoint.kind === "browser" && !definition.browserHost)
        throw new Error(`A browser app cannot host a ${definition.name}.`);
      const ops = buildStudioCommand(design, {
        type: "createComponent",
        component: {
          id: created,
          host: endpoint.id,
          name: uniqueName(definition.name, names),
          settings: createStudioComponentSettings(choice.kind),
        },
      }).ops;
      applied(design, ops);
      return { ops, node: `studio:component:${created}`, relation: "" };
    }
    const ops = buildStudioCommand(design, {
      type: "createComponent",
      component: {
        id: created,
        host: endpoint.host,
        name: uniqueName(definition.name, names),
        settings: createStudioComponentSettings(choice.kind),
      },
      links: [
        {
          link: {
            id: relation,
            from: side === "out" ? endpoint.id : created,
            to: { kind: "component", id: side === "out" ? created : endpoint.id },
          },
        },
      ],
    }).ops;
    applied(design, ops);
    return { ops, node: `studio:component:${created}`, relation };
  }
  const kind = choice.kind;
  const definition = studioDefinitions[kind];
  const host = endpoint.type === "component" ? endpoint.host : endpoint.id;
  const hostKind = endpoint.type === "component" ? endpoint.hostKind : endpoint.kind;
  if (level === "context") throw new Error("Add services and resources at C2 or C3.");
  if (level === "containers" && kind === "queue") throw new Error("Queues are added at C3.");
  const defaults =
    endpoint.type === "component"
      ? viaDefaults(endpoint, kind, side)
      : side === "out"
        ? defaultsFor(hostKind, kind)
        : defaultsFor(kind, hostKind);
  if (!defaults) throw new Error(`A ${definition.name} cannot connect on this side.`);
  const connectionId = endpoint.type === "component" ? id() : relation;
  const connection: StudioConnectionCreation = {
    id: connectionId,
    from: side === "out" ? host : created,
    to: side === "out" ? created : host,
    ...defaults,
  };
  // Queue (and C3 resource) ownership comes from the application at the source box's end.
  const owner = level === "components" && applicationKind(hostKind) ? host : undefined;
  if (kind === "queue" && !owner) throw new Error("A queue needs an owning application.");
  const ops = buildStudioCommand(design, {
    type: "create",
    system,
    elements: [
      {
        id: created,
        name: uniqueName(definition.creationName, names),
        settings: structuredClone(definition.defaults),
        ...resourceOwner(kind, owner),
      },
    ],
    connections: [connection],
  }).ops;
  if (endpoint.type !== "component") {
    applied(design, ops);
    return { ops, node: `studio:element:${created}`, relation };
  }
  // The component link traces the new connection; built against the first command's result so
  // both commands still apply as one batch.
  const next = applied(design, ops);
  const link = buildStudioCommand(next, {
    type: "connectComponent",
    links: [
      {
        link: {
          id: relation,
          from: endpoint.id,
          to: { kind: "element", id: created, via: connectionId },
        },
      },
    ],
  }).ops;
  const all = [...ops, ...link];
  applied(design, all);
  return { ops: all, node: `studio:element:${created}`, relation };
}

/**
 * Dropping a handle on another box. Element and context pairs open the existing connection form
 * prefilled; a pair involving a component links them directly (with its traced C2 connection).
 */
export type DropResult =
  | { type: "draft"; draft: ConnectionDraft }
  | { type: "commit"; rebuild: (design: DesignDocument) => OperationInput[]; relation: string };
export function dropConnect(
  level: StudioScopeProjection["level"],
  source: SpawnEndpoint,
  side: SpawnSide,
  target: SpawnEndpoint,
): DropResult {
  const [from, to] = side === "out" ? [source, target] : [target, source];
  if (from.id === to.id) throw new Error("Drop the handle on a different box.");
  if (from.type === "context" || to.type === "context") {
    if (from.type !== "context" || to.type !== "context" || level !== "context")
      throw new Error("Connect people and external systems at C1.");
    return { type: "draft", draft: { from: from.id, to: to.id, context: true } };
  }
  if (from.type === "element" && to.type === "element")
    return { type: "draft", draft: { from: from.id, to: to.id } };
  const relation = id();
  if (from.type === "component" && to.type === "component") {
    if (from.host !== to.host)
      throw new Error(
        "Components connect only inside one application; connect the applications for cross-service use.",
      );
    return {
      type: "commit",
      relation,
      rebuild: (current) =>
        buildStudioCommand(current, {
          type: "connectComponent",
          links: [{ link: { id: relation, from: from.id, to: { kind: "component", id: to.id } } }],
        }).ops,
    };
  }
  // One component and one element: the arrow follows the traced C2 connection's direction.
  const component = (from.type === "component" ? from : to) as Extract<
    SpawnEndpoint,
    { type: "component" }
  >;
  const element = (from.type === "component" ? to : from) as Extract<
    SpawnEndpoint,
    { type: "element" }
  >;
  if (element.id === component.host)
    throw new Error("A component already lives inside this application.");
  const outward = from.type === "component";
  const [viaFrom, viaTo] = outward ? [component.host, element.id] : [element.id, component.host];
  return {
    type: "commit",
    relation,
    rebuild: (current) => {
      const existing = current.connections.find(
        (item) =>
          item.from.element === viaFrom &&
          item.to.element === viaTo &&
          !item.from.attachment &&
          !item.to.attachment,
      );
      const connectionId = existing?.id ?? id();
      const traced: StudioConnectionCreation | undefined = existing
        ? undefined
        : {
            id: connectionId,
            from: viaFrom,
            to: viaTo,
            ...connectionDefaults(current, viaFrom, viaTo),
          };
      return buildStudioCommand(current, {
        type: "connectComponent",
        links: [
          {
            link: {
              id: relation,
              from: component.id,
              to: { kind: "element", id: element.id, via: connectionId },
            },
            ...(traced && { connection: traced }),
          },
        ],
      }).ops;
    },
  };
}
