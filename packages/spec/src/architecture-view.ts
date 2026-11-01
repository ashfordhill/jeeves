/** Deterministic C4-informed projections. No view creates a second executable connection. */

import { type ArchitectureMember, componentConnections, containerContext } from "./architecture.ts";
import { containerClassification } from "./architecture-choices.ts";
import { containerDescription, containerTechnology } from "./container-display.ts";
import { deliveryConfigSchema, deliveryStore } from "./delivery.ts";
import { capabilityEndpoint, type DesignDocument, type Element } from "./design.ts";
import { localExecutionFor } from "./local-execution.ts";
import { localHttpPoolFor } from "./local-http-pool.ts";
import type { TemplateLookup } from "./manifest.ts";
import { plannedCapability } from "./planned-capabilities.ts";
import { connectionPresentation, type RelationshipInteraction } from "./relationship-display.ts";
import { resourceConfigSchema } from "./resources.ts";
import { workspaceModel } from "./workspace.ts";

export type ArchitectureSupport =
  | "template"
  | "recipe"
  | "extension"
  | "intent"
  | "external"
  | "planned"
  | "mixed";
export interface ArchitectureBinding {
  element: string;
  attachment?: string;
  extension?: string;
  event?: string;
  resource?: string;
  accounts?: boolean;
  component?: string;
}
export interface ArchitectureViewNode {
  id: string;
  kind: "person" | "system" | "external-system" | "container" | "component" | "binding";
  name: string;
  description: string;
  technology: string;
  support: ArchitectureSupport;
  binding?: ArchitectureBinding;
  acceptance: string[];
  provenance?: string;
  execution?: ReturnType<typeof localExecutionFor>;
  pool?: ReturnType<typeof localHttpPoolFor>;
  members?: ArchitectureViewNode[];
  missing?: string[];
  unassigned?: boolean;
  technical?: boolean;
  /** High-level responsibilities shown on a C2 application, using the same C3 identities. */
  responsibilities?: { id: string; name: string; description: string }[];
  /** Deployment placement only; never an additional logical owner. */
  parent?: string;
  deploymentKind?: "Infrastructure" | "Container instance" | "Logical channel";
}
export interface ArchitectureViewEdge {
  id: string;
  from: string;
  to: string;
  description: string;
  protocol?: string;
  interaction?: RelationshipInteraction;
  planned?: boolean;
  /** Existing semantic connection, never new wiring inferred from a view. */
  connection?: string;
  context?: string;
  declared?: boolean;
  componentRelationship?: string;
  /** Presentation summary only; exact identities remain in architecture bindings. */
  contractCount?: number;
}
export interface ArchitectureProjection {
  level: "context" | "containers" | "components" | "deployment";
  name: string;
  description: string;
  container?: string;
  execution?: ReturnType<typeof localExecutionFor>;
  pool?: ReturnType<typeof localHttpPoolFor>;
  nodes: ArchitectureViewNode[];
  edges: ArchitectureViewEdge[];
  groups?: { id: string; name: string; parent?: string }[];
  resources: {
    element: string;
    attachment: string;
    id: string;
    name: string;
    fields: number;
    operations: string[];
  }[];
}
export interface ArchitectureProvision {
  id: string;
  version: string;
  operations: Record<string, string[]>;
  frontends: string[];
  frontendNotes: Record<string, string>;
}
export interface ArchitectureViews {
  context: ArchitectureProjection;
  containers: ArchitectureProjection;
  components: ArchitectureProjection[];
  provision?: ArchitectureProvision;
}

const short = (text: string) => text.trim().split(/\n/)[0]?.slice(0, 300) ?? "";
const label = (text: string) => {
  const words = text.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const elementKey = (id: string) => `container:${id}`;

export function architectureViews(
  design: DesignDocument,
  lookup: TemplateLookup,
  projectName: string,
  provision?: ArchitectureProvision,
): ArchitectureViews {
  const intent = design.architecture;
  const systemName = intent?.system.name ?? projectName;
  const description =
    intent?.system.description ??
    "Add the system's responsibility and its people/external systems in Edit context.";
  const context: ArchitectureProjection = {
    level: "context",
    name: systemName,
    description,
    nodes: [
      {
        id: "context:system",
        kind: "system",
        name: systemName,
        description:
          intent?.system.businessTenancy && intent.system.businessTenancy !== "Unspecified"
            ? `${description} Audience: ${intent.system.businessTenancy}.`
            : description,
        technology: "Software system",
        support: "intent",
        acceptance: [],
      },
      ...(intent?.nodes ?? []).map(
        (node): ArchitectureViewNode => ({
          id: `context:${node.id}`,
          kind: node.kind,
          name: node.name,
          description: node.description,
          technology: node.kind === "person" ? "Person / role" : "External software system",
          support: node.kind === "external-system" ? "external" : "intent",
          acceptance: [],
        }),
      ),
    ],
    edges: (intent?.relationships ?? []).map((relation) => ({
      id: `context:${relation.id}`,
      from: `context:${relation.from}`,
      to: `context:${relation.to}`,
      description: relation.description,
      context: relation.id,
    })),
    resources: [],
  };
  const components = design.elements.flatMap((element) => {
    if (containerClassification(element).kind !== "Application") return [];
    const manifest = element.template && lookup.get(element.template);
    if (
      !element.planned &&
      (manifest?.kind !== "element" ||
        !["service", "frontend", "worker"].includes(manifest.elementKind))
    )
      return [];
    if (
      element.planned &&
      !["service", "frontend", "worker"].includes(plannedCapability(element.planned)?.role ?? "")
    )
      return [];
    return [componentView(element, design, lookup, provision)];
  });
  const nodes = design.elements.map((element): ArchitectureViewNode => {
    const planned = plannedCapability(element.planned);
    const manifest = element.template && lookup.get(element.template);
    const own =
      components
        .find((view) => view.container === element.id)
        ?.nodes.filter((node) => node.binding?.element === element.id) ?? [];
    const support: ArchitectureSupport = !manifest
      ? "intent"
      : own.some((node) => node.support === "extension")
        ? "extension"
        : own.some((node) => node.support === "recipe")
          ? "recipe"
          : "template";
    const role = planned?.role ?? (manifest?.kind === "element" ? manifest.elementKind : undefined);
    return {
      id: elementKey(element.id),
      kind:
        containerClassification(element).kind === "External system"
          ? "external-system"
          : role === "library"
            ? "binding"
            : "container",
      name: element.name,
      description: containerDescription(element),
      technology: containerTechnology(element),
      support: planned ? "planned" : role === "external" ? "external" : support,
      binding: { element: element.id },
      execution: localExecutionFor(element),
      pool: localHttpPoolFor(element),
      acceptance: [],
      responsibilities: (() => {
        const view = components.find((view) => view.container === element.id);
        return view
          ? componentPresentation(view, false)
              .nodes.filter((node) => node.binding?.element === element.id)
              .map(({ id, name, description }) => ({ id, name, description }))
          : undefined;
      })(),
      ...(support === "recipe" && provision
        ? { provenance: `${provision.id}@${provision.version}` }
        : {}),
    };
  });
  const containers: ArchitectureProjection = {
    level: "containers",
    name: systemName,
    description:
      "Applications and data stores, using the diagram's actual executable connections. Deployment instances and replicas are a separate concern.",
    nodes,
    edges: design.connections.map((connection) => ({
      id: `connection:${connection.id}`,
      from: elementKey(connection.from.element),
      to: elementKey(connection.to.element),
      ...connectionPresentation(connection, design),
      connection: connection.id,
      ...(connection.planned && { declared: true }),
    })),
    resources: [],
  };
  // A connected container keeps the same role/provision in every scope.
  for (const view of components)
    view.nodes = view.nodes.map((node) => {
      if (!node.binding || node.binding.element === view.container) return node;
      return nodes.find((container) => container.id === node.id) ?? node;
    });
  const c2Context = containerContext(design);
  for (const relation of c2Context.relationships) {
    const key = (id: string) => (id.startsWith("context:") ? id : elementKey(id));
    containers.edges.push({
      id: `context:${relation.id}`,
      from: key(relation.source),
      to: key(relation.target),
      description: relation.description,
      protocol: relation.protocol,
      context: relation.id,
    });
  }
  containers.nodes.push(
    ...context.nodes.filter((node) =>
      c2Context.nodes.some((item) => node.id === `context:${item.id}`),
    ),
  );
  if (
    containers.edges.some((edge) => edge.from === "context:system" || edge.to === "context:system")
  )
    containers.nodes.push(context.nodes[0]!);
  return { context, containers, components, ...(provision && { provision }) };
}

function componentView(
  element: Element,
  design: DesignDocument,
  lookup: TemplateLookup,
  provision?: ArchitectureProvision,
): ArchitectureProjection {
  const nodes: ArchitectureViewNode[] = [],
    edges: ArchitectureViewEdge[] = [];
  const resources: ArchitectureProjection["resources"] = [];
  const attachmentNodes = new Map<string, string>();
  const add = (
    id: string,
    attachment: string | undefined,
    name: string,
    description: string,
    technology: string,
    support: ArchitectureSupport,
    extra: Partial<ArchitectureViewNode> = {},
  ) => {
    const node: ArchitectureViewNode = {
      id: `component:${element.id}:${id}`,
      kind: "component",
      name,
      description,
      technology,
      support,
      binding: { element: element.id, ...(attachment && { attachment }) },
      acceptance: [],
      ...extra,
    };
    nodes.push(node);
    return node.id;
  };
  for (const attachment of element.attachments) {
    if (["local-execution", "local-http-pool"].includes(attachment.template.id)) continue;
    const template = lookup.get(attachment.template);
    const version = `${attachment.template.id}@${attachment.template.version}`;
    if (template?.kind === "attachment" && attachment.template.id === "rest-api-server") {
      const parsed = resourceConfigSchema.safeParse(attachment.config.model);
      const boundary = add(
        `${attachment.id}:boundary`,
        attachment.id,
        "HTTP resource boundary",
        "Validates request contracts and dispatches declared operations through the generated API boundary.",
        version,
        "template",
        { technical: true },
      );
      attachmentNodes.set(attachment.id, boundary);
      if (!parsed.success) continue;
      if (attachment.config.auth === "session")
        add(
          `${attachment.id}:accounts`,
          attachment.id,
          "Accounts and sessions",
          "Registration, session identity, origin and CSRF guards for protected commands.",
          version,
          "template",
          { binding: { element: element.id, attachment: attachment.id, accounts: true } },
        );
      for (const resource of parsed.data.resources) {
        resources.push({
          element: element.id,
          attachment: attachment.id,
          id: resource.id,
          name: resource.name,
          fields: resource.fields.length,
          operations: resource.operations,
        });
        if (resource.operations.length)
          add(
            `${attachment.id}:resource:${resource.id}`,
            attachment.id,
            `${label(resource.name)} registry`,
            `Generated ${resource.operations.join(", ")} operations with declared ownership and field contracts.`,
            version,
            "template",
            { binding: { element: element.id, attachment: attachment.id, resource: resource.id } },
          );
      }
      for (const extension of parsed.data.extensions) {
        const supplied =
          provision?.operations[element.id]?.includes(extension.operationId) ?? false;
        add(
          `${attachment.id}:extension:${extension.id}`,
          attachment.id,
          label(extension.id),
          `${label(extension.id)} operation with an explicit request and response contract.`,
          `${extension.method} ${extension.path}`,
          supplied ? "recipe" : "extension",
          {
            binding: { element: element.id, attachment: attachment.id, extension: extension.id },
            acceptance: extension.acceptance,
            ...(supplied && provision
              ? { provenance: `${provision.id}@${provision.version}` }
              : {}),
          },
        );
      }
    } else if (template?.kind === "attachment" && attachment.template.id === "durable-events") {
      const parsed = deliveryConfigSchema.safeParse(attachment.config);
      attachmentNodes.set(
        attachment.id,
        add(
          attachment.id,
          attachment.id,
          "Durable event delivery",
          `Transactional outbox, fenced leases and retries. One worker in this service process. Preset: ${parsed.success ? parsed.data.preset : "invalid configuration"}.`,
          version,
          "template",
        ),
      );
      if (parsed.success)
        for (const event of parsed.data.events)
          add(
            `${attachment.id}:event:${event.id}`,
            attachment.id,
            `${label(event.id)} handler`,
            "Handles this event's domain effect within the application.",
            `${event.type}@${event.version}`,
            "extension",
            {
              binding: { element: element.id, attachment: attachment.id, event: event.id },
              acceptance: event.acceptance,
            },
          );
    } else if (template?.kind === "attachment" && attachment.template.id === "resource-workspace") {
      let description: string,
        valid = false;
      try {
        const workspace = workspaceModel(design, element.id, attachment.id);
        description = `Accounts, owner-record forms, details and cursor pages for ${workspace.collections.map((item) => item.selection.label).join(", ")}. ${workspace.config.preset} preset; API ${workspace.binding.service} through ${workspace.binding.connection}.`;
        valid = true;
      } catch {
        description =
          "Complete the actual session API binding and owner-resource selection before generation.";
      }
      attachmentNodes.set(
        attachment.id,
        add(
          attachment.id,
          attachment.id,
          "Resource workspace",
          description,
          version,
          valid ? "template" : "intent",
        ),
      );
      if (attachment.notes.trim())
        add(
          `${attachment.id}:extras`,
          attachment.id,
          "Additional workspace content",
          short(attachment.notes),
          "Project extension",
          "extension",
        );
    } else if (template?.kind === "attachment" && attachment.template.id === "rest-api-client") {
      attachmentNodes.set(
        attachment.id,
        add(
          attachment.id,
          attachment.id,
          "Typed API adapter",
          "Generated request/response types and client transport for the selected API contract.",
          version,
          "template",
          { technical: true },
        ),
      );
    } else {
      attachmentNodes.set(
        attachment.id,
        add(
          attachment.id,
          attachment.id,
          template?.displayName ?? attachment.id,
          "Capability binding. A cohesive component responsibility has not been declared for this template.",
          version,
          "intent",
          { kind: "binding" },
        ),
      );
    }
  }
  const manifest = element.template && lookup.get(element.template);
  if (manifest?.kind === "element" && manifest.elementKind === "frontend") {
    const supplied = provision?.frontends.includes(element.id) ?? false;
    if (!element.attachments.some((attachment) => attachment.template.id === "resource-workspace"))
      add(
        "workspace",
        undefined,
        "Application workspace",
        supplied
          ? "Product navigation, user flows and state handling supplied by the pinned recipe."
          : "Application shell and product-specific user interactions.",
        "React application",
        supplied ? "recipe" : "extension",
        supplied && provision ? { provenance: `${provision.id}@${provision.version}` } : {},
      );
    if (
      (supplied ||
        element.attachments.some(
          (attachment) => attachment.template.id === "resource-workspace",
        )) &&
      element.notes.trim() &&
      element.notes !== provision?.frontendNotes[element.id]
    )
      add(
        "workspace-extension",
        undefined,
        "Additional product work",
        short(element.notes),
        "Project extension",
        "extension",
      );
  }
  // Show only dependencies whose capability mapping is explicit. Do not infer internal calls
  // from prose, or claim that every feature talks to every connected container.
  for (const connection of design.connections) {
    if (connection.from.element !== element.id && connection.to.element !== element.id) continue;
    const insideSide = connection.from.element === element.id ? "from" : "to";
    const inside = capabilityEndpoint(connection, insideSide);
    const outside = capabilityEndpoint(connection, insideSide === "from" ? "to" : "from");
    const boundAttachments = inside.attachment
      ? [inside.attachment]
      : connection.kind === "uses-database"
        ? element.attachments
            .filter((attachment) => {
              if (attachment.template.id === "durable-events")
                return deliveryStore(design, element.id)?.connection === connection.id;
              const model = resourceConfigSchema.safeParse(attachment.config.model);
              return model.success && model.data.storeConnection === connection.id;
            })
            .map((a) => a.id)
        : [];
    for (const attachment of element.attachments.filter(
      (item) => item.template.id === "resource-workspace",
    )) {
      try {
        if (workspaceModel(design, element.id, attachment.id).binding.connection === connection.id)
          boundAttachments.push(attachment.id);
      } catch {
        /* Incomplete configuration remains intent, without an invented dependency. */
      }
    }
    const components = boundAttachments.flatMap((id) => {
      const node = attachmentNodes.get(id);
      return node ? [node] : [];
    });
    const other = design.elements.find((item) => item.id === outside.element);
    if (!components.length || !other || other.id === element.id) continue;
    const otherId = elementKey(other.id);
    if (!nodes.some((node) => node.id === otherId))
      nodes.push({
        id: otherId,
        kind: "container",
        name: other.name,
        description: "Connected container outside this component scope.",
        technology: other.template ? `${other.template.id}@${other.template.version}` : "Unbound",
        support: other.template ? "template" : "intent",
        binding: { element: other.id },
        acceptance: [],
      });
    for (const component of components)
      edges.push({
        id: `connection:${connection.id}:${component}`,
        from: insideSide === "from" ? component : otherId,
        to: insideSide === "from" ? otherId : component,
        ...connectionPresentation(connection, design),
        connection: connection.id,
      });
  }
  const definitions =
    design.architecture?.components?.filter((item) => item.element === element.id) ?? [];
  const grouped = new Set<string>();
  for (const definition of definitions) {
    const members: ArchitectureViewNode[] = [];
    const missing: string[] = [];
    for (const member of definition.members) {
      const match = nodes.find((node) => memberMatches(node, member));
      if (match) {
        members.push(match);
        grouped.add(match.id);
      } else missing.push(`${member.kind}: ${member.ref ?? member.attachment}`);
    }
    const supports = new Set(members.map((member) => member.support));
    const nodeId = `responsibility:${definition.id}`;
    nodes.push({
      id: nodeId,
      kind: "component",
      name: definition.name,
      description:
        definition.responsibility ||
        plannedCapability(definition.capability)?.description ||
        "A cohesive application responsibility.",
      technology:
        (definition.technology?.trim() || plannedCapability(definition.capability)?.name) ??
        `${members.length} bound capabilities`,
      support: definition.capability
        ? "planned"
        : supports.size > 1
          ? "mixed"
          : (members[0]?.support ?? "planned"),
      binding: { element: element.id, component: definition.id },
      members,
      missing,
      acceptance: [...new Set(members.flatMap((member) => member.acceptance))],
    });
    const uses = componentConnections(design, definition);
    for (const [id, use] of uses) {
      const connection = design.connections.find((item) => item.id === id);
      if (!connection) continue;
      const otherId =
        connection.from.element === element.id ? connection.to.element : connection.from.element;
      const other = design.elements.find((item) => item.id === otherId);
      if (!other) continue;
      const outside = elementKey(other.id);
      if (!nodes.some((node) => node.id === outside))
        nodes.push({
          id: outside,
          name: other.name,
          kind: "container",
          description: "Connected dependency",
          technology: "",
          support: other.planned ? "planned" : "template",
          binding: { element: other.id },
          acceptance: [],
        });
      edges.push({
        id: `use:${definition.id}:${id}`,
        from: connection.from.element === element.id ? nodeId : outside,
        to: connection.from.element === element.id ? outside : nodeId,
        ...connectionPresentation(connection, design),
        ...(use.resources.length && {
          description: `Reads and writes ${[...new Set(use.resources)].join(", ")}`,
        }),
        connection: id,
        declared: use.declared || Boolean(connection.planned),
      });
    }
  }
  for (const relation of design.architecture?.componentRelationships ?? []) {
    if (
      !definitions.some((item) => item.id === relation.from) ||
      !definitions.some((item) => item.id === relation.to)
    )
      continue;
    edges.push({
      id: `declared:${relation.id}`,
      from: `responsibility:${relation.from}`,
      to: `responsibility:${relation.to}`,
      description: relation.description,
      protocol: relation.protocol ?? "In process",
      interaction: relation.interaction ?? "Request / response",
      planned: true,
      declared: true,
      componentRelationship: relation.id,
    });
  }
  const visible = nodes.filter((node) => !grouped.has(node.id));
  if (definitions.length)
    for (const node of visible) {
      if (
        node.binding?.element === element.id &&
        !node.binding.component &&
        !node.id.endsWith(":boundary")
      )
        node.unassigned = true;
    }
  return {
    level: "components",
    container: element.id,
    execution: localExecutionFor(element),
    pool: localHttpPoolFor(element),
    name: element.name,
    description:
      "Cohesive responsibilities within this application. Resource contracts are listed separately; shown dependency edges reference existing container wiring.",
    nodes: visible,
    edges: edges.filter((edge) => !grouped.has(edge.from) && !grouped.has(edge.to)),
    resources,
  };
}

function memberMatches(node: ArchitectureViewNode, member: ArchitectureMember) {
  if (node.binding?.attachment !== member.attachment) return false;
  return member.kind === "accounts"
    ? node.binding.accounts === true
    : member.kind === "resource"
      ? node.binding.resource === member.ref
      : node.binding.extension === member.ref;
}

/** Implementation members stay in inspection; an operation or table is not a C4 component. */
export function componentPresentation(view: ArchitectureProjection, showTechnical: boolean) {
  if (view.level !== "components") return view;
  const groups = new Map<string, ArchitectureViewNode[]>();
  const grouped = new Map<string, string>();
  for (const node of view.nodes) {
    const binding = node.binding;
    if (!binding || binding.element !== view.container || binding.component || !binding.attachment)
      continue;
    const kind = binding.resource
      ? "resources"
      : binding.extension
        ? "operations"
        : binding.event
          ? "handlers"
          : undefined;
    if (!kind) continue;
    const id = `component:${view.container}:${binding.attachment}:${kind}`;
    groups.set(id, [...(groups.get(id) ?? []), node]);
    grouped.set(node.id, id);
  }
  const nodes = view.nodes.filter(
    (node) => !grouped.has(node.id) && (showTechnical || !node.technical),
  );
  for (const [id, members] of groups) {
    const kind = id.split(":").at(-1);
    const resource = kind === "resources";
    const supports = new Set(members.map((node) => node.support));
    nodes.push({
      id,
      kind: kind === "operations" ? "binding" : "component",
      name: resource
        ? "Resource management"
        : kind === "handlers"
          ? "Event handling"
          : "Application operations",
      description: resource
        ? "Owns record lifecycle, validation and persistence through the declared resource contracts."
        : kind === "handlers"
          ? "Handles subscribed events and their domain effects within this application. Individual event definitions remain available in inspection."
          : "Implementation capabilities awaiting an explicit responsibility. Group these into named components in the inspector.",
      technology: `${members.length} ${resource ? "resource contracts" : "operations"}`,
      support: supports.size > 1 ? "mixed" : members[0]!.support,
      binding: { element: view.container!, attachment: members[0]!.binding!.attachment },
      members,
      unassigned: kind === "operations" || (resource && members.some((node) => node.unassigned)),
      acceptance: [...new Set(members.flatMap((node) => node.acceptance))],
    });
  }
  const visible = new Set(nodes.map((node) => node.id));
  // Keep explicit adapter connections visible at C3 even when its implementation card is hidden.
  const hiddenAdapters = view.nodes.filter((node) => node.technical && !visible.has(node.id));
  const projected = view.edges.flatMap((edge) => {
    const remap = (id: string): string[] => {
      if (grouped.has(id)) return [grouped.get(id)!];
      const adapter = hiddenAdapters.find((node) => node.id === id);
      if (!adapter) return [id];
      const owners = nodes.filter(
        (node) =>
          node.binding?.element === view.container &&
          (node.binding?.attachment === adapter.binding?.attachment ||
            node.members?.some(
              (member) => member.binding?.attachment === adapter.binding?.attachment,
            )),
      );
      return owners.map((node) => node.id);
    };
    return remap(edge.from).flatMap((from) =>
      remap(edge.to).map((to) => ({
        ...edge,
        from,
        to,
        id: from === edge.from && to === edge.to ? edge.id : `${edge.id}:${from}:${to}`,
      })),
    );
  });
  const edges = projected.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  const connected = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  return {
    ...view,
    nodes: nodes.filter(
      (node) =>
        visible.has(node.id) &&
        (node.binding?.element === view.container || connected.has(node.id)),
    ),
    edges,
  };
}
