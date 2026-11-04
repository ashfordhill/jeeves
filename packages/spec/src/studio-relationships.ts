/** Relationship presentation and accounting, never semantic wiring or shared editable settings. */
import { componentConnections } from "./architecture.ts";
import { containerClassification } from "./architecture-choices.ts";
import type { Connection, DesignDocument } from "./design.ts";
import { capabilityEndpoint } from "./design.ts";
import { connectionPresentation, type RelationshipInteraction } from "./relationship-display.ts";
import { legacyStudioKind } from "./studio-legacy.ts";
import { studioApplicationKinds } from "./studio-model.ts";
import type { StudioScopeProjection, StudioSemanticRef, StudioViews } from "./studio-view.ts";

export interface StudioRelationshipProvenance {
  /** Original endpoints. The edge's from/to separately identify the displayed package/card. */
  sourceRefs: StudioSemanticRef[];
  targetRefs: StudioSemanticRef[];
  connectionIds: string[];
  queueIds: string[];
  contextRelationshipIds: string[];
  componentRelationshipIds: string[];
  componentIds: string[];
  bindingIds: string[];
  interfaceIds: string[];
  contractRefs: { id: string; version: string }[];
  capabilityRefs: { element: string; attachment: string }[];
}
export interface StudioRelationshipMember extends StudioRelationshipProvenance {
  id: string;
  kind: "connection" | "queued" | "context" | "component";
  action: string;
  protocols: string[];
  interactions: RelationshipInteraction[];
  /** Both legs remain separately selectable by their canonical connection IDs. */
  channel?: { queueId: string; publishConnectionId: string; consumeConnectionId: string };
}
export interface StudioRelationship extends StudioRelationshipProvenance {
  id: string;
  from: string;
  to: string;
  members: StudioRelationshipMember[];
  actions: string[];
  /** Multiple values describe a bundle, never a single editable protocol/interaction. */
  protocols: string[];
  interactions: RelationshipInteraction[];
}
export interface StudioTrunk extends StudioRelationshipProvenance {
  id: string;
  from: string;
  protocol: string;
  interaction: RelationshipInteraction;
  /** One entry per actual displayed branch, including members of a mixed-protocol aggregate. */
  branches: { edgeId: string; to: string; memberIds: string[]; connectionIds: string[] }[];
}
export interface StudioRelationshipIssue {
  id: string;
  reason:
    | "ambiguous-channel-role"
    | "invalid-channel-direction"
    | "missing-producer"
    | "missing-consumer"
    | "hidden-endpoint"
    | "source-not-projected";
  member: StudioRelationshipMember;
}
export interface StudioRelationshipSource {
  accounting: {
    connectionId: string;
    appearances: { scopeKey: string; edgeId: string; memberIds: string[] }[];
    suppressedIds: string[];
    unresolvedIds: string[];
  }[];
  unresolved: StudioRelationshipIssue[];
  suppressed: {
    id: string;
    reason: "internal-package" | "self-channel";
    scopeKey: string;
    member: StudioRelationshipMember;
  }[];
  /** Unconfigurable internals remain source, rather than fabricated owner-to-owner arrows. */
  componentRelationships: StudioRelationshipMember[];
}

const sorted = (items: readonly string[]) => [...new Set(items)].sort();
const ordered = <T extends { id: string }>(items: readonly T[]) =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const unique = <T>(items: readonly T[]): T[] =>
  [...new Map(items.map((item) => [JSON.stringify(item), item])).entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, item]) => item);
const elementRef = (id: string): StudioSemanticRef => ({ kind: "element", id });
const refKey = (ref: StudioSemanticRef) => ("id" in ref ? `${ref.kind}:${ref.id}` : ref.kind);
function requireEntry<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing projected relationship source: ${String(key)}`);
  return value;
}
const empty = (): StudioRelationshipProvenance => ({
  sourceRefs: [],
  targetRefs: [],
  connectionIds: [],
  queueIds: [],
  contextRelationshipIds: [],
  componentRelationshipIds: [],
  componentIds: [],
  bindingIds: [],
  interfaceIds: [],
  contractRefs: [],
  capabilityRefs: [],
});
function provenance(
  members: readonly StudioRelationshipProvenance[],
): StudioRelationshipProvenance {
  return {
    sourceRefs: unique(members.flatMap((m) => m.sourceRefs)),
    targetRefs: unique(members.flatMap((m) => m.targetRefs)),
    connectionIds: sorted(members.flatMap((m) => m.connectionIds)),
    queueIds: sorted(members.flatMap((m) => m.queueIds)),
    contextRelationshipIds: sorted(members.flatMap((m) => m.contextRelationshipIds)),
    componentRelationshipIds: sorted(members.flatMap((m) => m.componentRelationshipIds)),
    componentIds: sorted(members.flatMap((m) => m.componentIds)),
    bindingIds: sorted(members.flatMap((m) => m.bindingIds)),
    interfaceIds: sorted(members.flatMap((m) => m.interfaceIds)),
    contractRefs: unique(members.flatMap((m) => m.contractRefs)),
    capabilityRefs: unique(members.flatMap((m) => m.capabilityRefs)),
  };
}

/** Called only over freshly projected scopes; both design and supplied projections stay untouched. */
export function withStudioRelationships(design: DesignDocument, views: StudioViews): StudioViews {
  const architecture = design.architecture;
  const studio = architecture?.studio;
  const bindings = new Map(studio?.elements.map((b) => [b.element, b]));
  const connectionSettings = new Map(studio?.connections.map((b) => [b.connection, b.settings]));
  const queues = new Set(
    design.elements
      .filter((e) => (bindings.get(e.id)?.settings.kind ?? legacyStudioKind(e)) === "queue")
      .map((e) => e.id),
  );
  const membership = new Map(studio?.packages.flatMap((p) => p.members.map((id) => [id, p.id])));
  const components = new Map(
    architecture?.components?.map((component) => [component.id, component]),
  );
  const componentUses = new Map(
    architecture?.components?.map((component) => [
      component.id,
      componentConnections(design, component),
    ]),
  );
  const connectionMembers = new Map<string, StudioRelationshipMember>();
  const source: StudioRelationshipSource = {
    accounting: [],
    unresolved: [],
    suppressed: [],
    componentRelationships: [],
  };
  const bindingRefs = (kind: "connection" | "component-relationship", id: string) => {
    const matches = ordered(
      architecture?.bindings?.filter(
        (b) => b.relationship.kind === kind && b.relationship.id === id,
      ) ?? [],
    );
    return {
      bindingIds: matches.map((b) => b.id),
      interfaceIds: sorted(matches.flatMap((b) => [b.provided, b.required])),
      contractRefs: unique(matches.map((b) => ({ ...b.contract }))),
    };
  };
  for (const connection of ordered(design.connections)) {
    const display = connectionPresentation(connection, design);
    connectionMembers.set(connection.id, {
      ...empty(),
      id: `connection:${connection.id}`,
      kind: "connection",
      action: display.description,
      protocols: [display.protocol],
      interactions: [display.interaction],
      sourceRefs: [elementRef(connection.from.element)],
      targetRefs: [elementRef(connection.to.element)],
      connectionIds: [connection.id],
      queueIds: sorted(
        [connection.from.element, connection.to.element].filter((id) => queues.has(id)),
      ),
      componentIds: sorted(
        [...componentUses].filter(([, uses]) => uses.has(connection.id)).map(([id]) => id),
      ),
      capabilityRefs: unique(
        (["from", "to"] as const).flatMap((side) => {
          const endpoint = capabilityEndpoint(connection, side);
          return endpoint.attachment
            ? [{ element: endpoint.element, attachment: endpoint.attachment }]
            : [];
        }),
      ),
      ...bindingRefs("connection", connection.id),
    });
  }
  for (const relation of ordered(architecture?.componentRelationships ?? [])) {
    const from = components.get(relation.from),
      to = components.get(relation.to);
    source.componentRelationships.push({
      ...empty(),
      id: `component:${relation.id}`,
      kind: "component",
      action: relation.description,
      protocols: relation.protocol ? [relation.protocol] : [],
      interactions: relation.interaction ? [relation.interaction] : [],
      sourceRefs: from ? [elementRef(from.element)] : [],
      targetRefs: to ? [elementRef(to.element)] : [],
      componentIds: sorted([relation.from, relation.to]),
      componentRelationshipIds: [relation.id],
      ...bindingRefs("component-relationship", relation.id),
    });
  }
  const issue = (reason: StudioRelationshipIssue["reason"], member: StudioRelationshipMember) => {
    const id = `${reason}:${member.id}`;
    if (!source.unresolved.some((item) => item.id === id))
      source.unresolved.push({ id, reason, member });
  };
  const freshScope = (scope: StudioScopeProjection): StudioScopeProjection => ({
    ...scope,
    edges: [],
    trunks: [],
  });
  const context = freshScope(views.context),
    containers = freshScope(views.containers);
  const scopes = [context, containers, ...views.details.map(freshScope)];
  const nodeFor = (scope: StudioScopeProjection, ref: StudioSemanticRef) =>
    scope.nodes.find((node) => node.refs.some((r) => refKey(r) === refKey(ref)))?.id;
  const c2Node = (ref: StudioSemanticRef): string | undefined => {
    if (ref.kind === "element" && queues.has(ref.id)) return undefined;
    const direct = nodeFor(containers, ref);
    if (direct || ref.kind !== "element") return direct;
    const pkg =
      membership.get(ref.id) ??
      (bindings.get(ref.id)?.owner?.kind === "package"
        ? bindings.get(ref.id)?.owner?.id
        : undefined);
    return pkg ? nodeFor(containers, { kind: "package", id: pkg }) : undefined;
  };
  const edgeIndexes = new Map(
    scopes.map((scope) => [scope.key, new Map<string, StudioRelationship>()]),
  );
  const add = (
    scope: StudioScopeProjection,
    from: string,
    to: string,
    member: StudioRelationshipMember,
  ) => {
    // Endpoint identities, never labels, protocols, member order or an array index.
    const id = `studio:relationship:${from}>${to}`;
    const index = requireEntry(edgeIndexes, scope.key);
    const edge = index.get(id);
    if (edge) edge.members.push(member);
    else {
      const relationship: StudioRelationship = {
        ...empty(),
        id,
        from,
        to,
        members: [member],
        actions: [],
        protocols: [],
        interactions: [],
      };
      scope.edges.push(relationship);
      index.set(id, relationship);
    }
  };
  const c2Add = (member: StudioRelationshipMember) => {
    const from = member.sourceRefs.map(c2Node).find(Boolean),
      to = member.targetRefs.map(c2Node).find(Boolean);
    if (!from || !to) return issue("hidden-endpoint", member);
    const pkg = containers.nodes.find((node) => node.id === from)?.kind === "package";
    if (from === to && (pkg || member.kind === "queued")) {
      source.suppressed.push({
        id: `suppressed:${member.id}`,
        reason: pkg ? "internal-package" : "self-channel",
        scopeKey: containers.key,
        member,
      });
    } else add(containers, from, to, member);
  };
  for (const connection of ordered(design.connections)) {
    const member = requireEntry(connectionMembers, connection.id);
    if (!member.queueIds.length) c2Add(member);
    for (const scope of scopes.slice(2)) {
      const scopeRef = scope.scope;
      const owners =
        scopeRef.kind === "package"
          ? (studio?.packages.find((p) => p.id === scopeRef.id)?.members ?? [])
          : scopeRef.kind === "element"
            ? [scopeRef.id]
            : [];
      if (!owners.includes(connection.from.element) && !owners.includes(connection.to.element))
        continue;
      const from = nodeFor(scope, elementRef(connection.from.element)),
        to = nodeFor(scope, elementRef(connection.to.element));
      if (from && to) add(scope, from, to, member);
    }
  }
  // Roles come only from an explicit studio setting or an unambiguous existing binding.
  // Names, labels, arrow orientation alone and asynchronous intent cannot imply a role.
  const channelRole = (connection: Connection) => {
    const roles = sorted(
      architecture?.bindings
        ?.filter(
          (b) =>
            b.relationship.kind === "connection" &&
            b.relationship.id === connection.id &&
            (b.role === "publish" || b.role === "consume"),
        )
        .map((b) => b.role) ?? [],
    );
    const declared = connectionSettings.get(connection.id)?.channelUse;
    if (declared && roles.some((role) => role !== declared)) return undefined;
    return declared ?? (roles.length === 1 ? roles[0] : undefined);
  };
  for (const queueId of [...queues].sort()) {
    const links = ordered(
      design.connections.filter((c) => c.from.element === queueId || c.to.element === queueId),
    );
    const publishers: { connection: Connection; applicationId: string }[] = [],
      consumers: { connection: Connection; applicationId: string }[] = [];
    for (const connection of links) {
      const member = requireEntry(connectionMembers, connection.id);
      const role = channelRole(connection);
      if (!role) {
        issue("ambiguous-channel-role", member);
        continue;
      }
      // Old bindings can declare consumption on an application→queue dependency. Preserve that
      // original C3 direction; the explicit role determines C2 message flow. New studio roles must
      // follow the studio message-flow convention, enforced independently at the semantic boundary.
      const other =
        connection.from.element === queueId ? connection.to.element : connection.from.element;
      const application = design.elements.find((e) => e.id === other);
      const applicationBinding = bindings.get(other);
      const validApplication =
        application &&
        (applicationBinding
          ? studioApplicationKinds.some((kind) => kind === applicationBinding.settings.kind)
          : containerClassification(application).kind === "Application");
      if (
        !validApplication ||
        queues.has(other) ||
        (connectionSettings.get(connection.id)?.channelUse &&
          (role === "publish"
            ? connection.to.element !== queueId
            : connection.from.element !== queueId))
      ) {
        issue("invalid-channel-direction", member);
        continue;
      }
      (role === "publish" ? publishers : consumers).push({ connection, applicationId: other });
    }
    for (const missing of ["missing-producer", "missing-consumer"] as const) {
      if (missing === "missing-producer" ? publishers.length : consumers.length) continue;
      const members = links.map((c) => requireEntry(connectionMembers, c.id));
      issue(missing, {
        ...provenance(members),
        id: `queue:${queueId}`,
        kind: "queued",
        action: "Queued communication",
        protocols: sorted(members.flatMap((m) => m.protocols)),
        interactions: ["Asynchronous"],
        queueIds: [queueId],
      });
    }
    for (const publish of publishers)
      for (const consume of consumers) {
        const members = [
          requireEntry(connectionMembers, publish.connection.id),
          requireEntry(connectionMembers, consume.connection.id),
        ];
        c2Add({
          ...provenance(members),
          id: `queued:${queueId}:${publish.connection.id}:${consume.connection.id}`,
          kind: "queued",
          action: "Queued communication",
          protocols: sorted(members.flatMap((m) => m.protocols)),
          interactions: ["Asynchronous"],
          sourceRefs: [elementRef(publish.applicationId)],
          targetRefs: [elementRef(consume.applicationId)],
          channel: {
            queueId,
            publishConnectionId: publish.connection.id,
            consumeConnectionId: consume.connection.id,
          },
        });
      }
  }
  for (const relation of ordered(architecture?.relationships ?? [])) {
    const ref = (id: string): StudioSemanticRef =>
      id === "system" ? { kind: "system" } : { kind: "context", id };
    const member: StudioRelationshipMember = {
      ...empty(),
      id: `context:${relation.id}`,
      kind: "context",
      action: relation.description,
      protocols: [],
      interactions: [],
      sourceRefs: [ref(relation.from)],
      targetRefs: [ref(relation.to)],
      contextRelationshipIds: [relation.id],
    };
    const from = nodeFor(context, ref(relation.from)),
      to = nodeFor(context, ref(relation.to));
    if (from && to) add(context, from, to, member);
    if (relation.from !== "system" && relation.to !== "system") continue;
    const bound = (id: string) => {
      const element =
        id === "system"
          ? relation.container
          : architecture?.nodes.find((n) => n.id === id)?.container;
      return element ? elementRef(element) : ref(id);
    };
    const c2Member = {
      ...member,
      sourceRefs: [bound(relation.from)],
      targetRefs: [bound(relation.to)],
    };
    c2Add(c2Member);
  }
  for (const scope of scopes) {
    for (const edge of scope.edges) {
      edge.members = ordered(edge.members);
      Object.assign(edge, provenance(edge.members), {
        actions: sorted(edge.members.map((m) => m.action)),
        protocols: sorted(edge.members.flatMap((m) => m.protocols)),
        interactions: sorted(edge.members.flatMap((m) => m.interactions)),
      });
    }
    scope.edges = ordered(scope.edges);
    scope.trunks = trunks(scope.edges);
  }
  for (const connection of ordered(design.connections)) {
    const appearances = scopes.flatMap((scope) =>
      scope.edges.flatMap((edge) => {
        const memberIds = edge.members
          .filter((m) => m.connectionIds.includes(connection.id))
          .map((m) => m.id);
        return memberIds.length ? [{ scopeKey: scope.key, edgeId: edge.id, memberIds }] : [];
      }),
    );
    const suppressedIds = source.suppressed
      .filter((s) => s.member.connectionIds.includes(connection.id))
      .map((s) => s.id);
    if (
      !appearances.length &&
      !suppressedIds.length &&
      !source.unresolved.some((s) => s.member.connectionIds.includes(connection.id))
    )
      issue("source-not-projected", requireEntry(connectionMembers, connection.id));
    source.accounting.push({
      connectionId: connection.id,
      appearances,
      suppressedIds: sorted(suppressedIds),
      unresolvedIds: sorted(
        source.unresolved
          .filter((s) => s.member.connectionIds.includes(connection.id))
          .map((s) => s.id),
      ),
    });
  }
  source.unresolved = ordered(source.unresolved);
  source.suppressed = ordered(source.suppressed);
  return {
    context,
    containers,
    details: scopes.slice(2),
    source: { ...views.source, relationships: source },
  };
}

function trunks(edges: StudioRelationship[]): StudioTrunk[] {
  const compatible = new Map<
    string,
    { edge: StudioRelationship; member: StudioRelationshipMember }[]
  >();
  for (const edge of edges)
    for (const member of edge.members) {
      if (
        edge.from === edge.to ||
        member.protocols.length !== 1 ||
        member.interactions.length !== 1 ||
        member.protocols[0] === "Undecided"
      )
        continue;
      const key = JSON.stringify([edge.from, member.protocols[0], member.interactions[0]]);
      compatible.set(key, [...(compatible.get(key) ?? []), { edge, member }]);
    }
  const result: StudioTrunk[] = [];
  for (const entries of compatible.values()) {
    const first = entries[0];
    const protocol = first?.member.protocols[0],
      interaction = first?.member.interactions[0];
    if (!first || !protocol || !interaction) continue;
    if (new Set(entries.map(({ edge }) => edge.to)).size < 2) continue;
    const branches = ordered([...new Map(entries.map(({ edge }) => [edge.id, edge])).values()]).map(
      (edge) => {
        const members = entries
          .filter((entry) => entry.edge.id === edge.id)
          .map((entry) => entry.member);
        return {
          edgeId: edge.id,
          to: edge.to,
          memberIds: sorted(members.map((m) => m.id)),
          connectionIds: sorted(members.flatMap((m) => m.connectionIds)),
        };
      },
    );
    const members = entries.map(({ member }) => member);
    result.push({
      ...provenance(members),
      id: `studio:trunk:${first.edge.from}:${sorted(members.map((m) => m.id)).join("|")}`,
      from: first.edge.from,
      protocol,
      interaction,
      branches,
    });
  }
  return ordered(result);
}
