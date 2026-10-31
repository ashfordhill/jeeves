/** Deterministic C4-informed projections. No view creates a second executable connection. */
import { capabilityEndpoint, type DesignDocument, type Element } from "./design.ts";
import type { TemplateLookup } from "./manifest.ts";
import { resourceConfigSchema } from "./resources.ts";

export type ArchitectureSupport = "template" | "recipe" | "extension" | "intent" | "external";
export interface ArchitectureBinding {
  element: string;
  attachment?: string;
  extension?: string;
  resource?: string;
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
}
export interface ArchitectureViewEdge {
  id: string;
  from: string;
  to: string;
  description: string;
  /** Existing semantic connection, never new wiring inferred from a view. */
  connection?: string;
  context?: string;
}
export interface ArchitectureProjection {
  level: "context" | "containers" | "components";
  name: string;
  description: string;
  container?: string;
  nodes: ArchitectureViewNode[];
  edges: ArchitectureViewEdge[];
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
const connectionDescription = (kind: string) =>
  ({ "uses-database": "Uses database", calls: "Calls API", "depends-on": "Depends on" })[kind] ??
  kind;

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
        description,
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
    const manifest = element.template && lookup.get(element.template);
    if (
      manifest?.kind !== "element" ||
      !["service", "frontend", "worker"].includes(manifest.elementKind)
    )
      return [];
    return [componentView(element, design, lookup, provision)];
  });
  const nodes = design.elements.map((element): ArchitectureViewNode => {
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
    const role = manifest?.kind === "element" ? manifest.elementKind : undefined;
    return {
      id: elementKey(element.id),
      kind: role === "external" ? "external-system" : role === "library" ? "binding" : "container",
      name: element.name,
      description:
        role === "database"
          ? "Persistent data store for connected applications."
          : role === "frontend"
            ? "Browser application and user interactions."
            : role === "library"
              ? "Library binding; not a separately running C4 container."
              : short(element.notes) || "Application runtime and its declared responsibilities.",
      technology: element.template
        ? `${manifest?.displayName ?? element.template.id} · ${element.template.version}`
        : "No implementation binding",
      support: role === "external" ? "external" : support,
      binding: { element: element.id },
      acceptance: [],
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
      description: connectionDescription(connection.kind),
      connection: connection.id,
    })),
    resources: [],
  };
  // A connected container keeps the same role/provision in every scope.
  for (const view of components)
    view.nodes = view.nodes.map((node) => {
      if (!node.binding || node.binding.element === view.container) return node;
      return nodes.find((container) => container.id === node.id) ?? node;
    });
  // Context participants enter the container view only through explicit system-end bindings.
  const participants = new Set<string>();
  for (const relation of intent?.relationships ?? []) {
    if (
      !relation.container ||
      !design.elements.some((element) => element.id === relation.container)
    )
      continue;
    const from =
      relation.from === "system" ? elementKey(relation.container) : `context:${relation.from}`;
    const to = relation.to === "system" ? elementKey(relation.container) : `context:${relation.to}`;
    if (relation.from !== "system") participants.add(from);
    if (relation.to !== "system") participants.add(to);
    containers.edges.push({
      id: `context:${relation.id}`,
      from,
      to,
      description: relation.description,
      context: relation.id,
    });
  }
  containers.nodes.push(...context.nodes.filter((node) => participants.has(node.id)));
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
          short(extension.notes) || `${extension.method} ${extension.path}`,
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
    add(
      "workspace",
      undefined,
      "Application workspace",
      supplied
        ? "Product navigation, user flows and state handling supplied by the pinned recipe."
        : short(element.notes) ||
            "Template shell; product-specific user flows remain project-owned.",
      "React application",
      supplied ? "recipe" : "extension",
      supplied && provision ? { provenance: `${provision.id}@${provision.version}` } : {},
    );
    if (supplied && element.notes.trim() && element.notes !== provision?.frontendNotes[element.id])
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
    const boundAttachment =
      inside.attachment ??
      (connection.kind === "uses-database"
        ? element.attachments.find((attachment) => {
            const model = resourceConfigSchema.safeParse(attachment.config.model);
            return model.success && model.data.storeConnection === connection.id;
          })?.id
        : undefined);
    const component = boundAttachment && attachmentNodes.get(boundAttachment);
    const other = design.elements.find((item) => item.id === outside.element);
    if (!component || !other || other.id === element.id) continue;
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
    edges.push({
      id: `connection:${connection.id}`,
      from: insideSide === "from" ? component : otherId,
      to: insideSide === "from" ? otherId : component,
      description: connectionDescription(connection.kind),
      connection: connection.id,
    });
  }
  return {
    level: "components",
    container: element.id,
    name: element.name,
    description:
      "Cohesive responsibilities within this application. Resource contracts are listed separately; shown dependency edges reference existing container wiring.",
    nodes,
    edges,
    resources,
  };
}
