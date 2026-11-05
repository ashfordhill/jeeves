/** Structural studio hooks share the existing all-or-nothing semantic validation boundary. */
import { containerClassification } from "./architecture-choices.ts";
import type { DesignDocument, Element } from "./design.ts";
import { type Finding, type FindingCode, finding } from "./findings.ts";
import {
  type StudioComponentTargetKind,
  studioComponentDefinitions,
  studioComponentRequirements,
} from "./studio-components.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { laneFindings } from "./studio-lanes.ts";
import {
  type StudioKind,
  studioAccessSchema,
  studioActionSchema,
  studioAllowsRequestPolicies,
  studioDefinitionStatus,
  studioModelSchema,
  studioProtocolSchema,
} from "./studio-model.ts";

/** Package identities cannot shadow any existing graph or architecture declaration. */
function occupiedDesignIds(design: DesignDocument): Set<string> {
  const model = design.architecture;
  return new Set([
    "system",
    ...design.elements.map((element) => element.id),
    ...design.connections.map((item) => item.id),
    ...(model?.nodes ?? []).map((item) => item.id),
    ...(model?.relationships ?? []).map((item) => item.id),
    ...(model?.studio?.entries ?? []).map((item) => item.id),
  ]);
}

export function validateStudio(design: DesignDocument): Finding[] {
  const studio = design.architecture?.studio;
  if (!studio) return [];
  const root = ["architecture", "studio"];
  const parsed = studioModelSchema.safeParse(studio);
  if (!parsed.success)
    return parsed.error.issues.map((issue) =>
      finding("CONFIG_INVALID", issue.message, {
        path: [
          ...root,
          ...issue.path.map((part) => (typeof part === "number" ? part : String(part))),
        ],
      }),
    );
  const findings: Finding[] = [];
  const report = (code: FindingCode, path: (string | number)[], message: string) =>
    findings.push(finding(code, message, { path: [...root, ...path] }));
  const invalid = (path: (string | number)[], message: string) =>
    report("CONFIG_INVALID", path, message);
  const missing = (path: (string | number)[], message: string) =>
    report("UNKNOWN_REFERENCE", path, message);
  const elements = new Map(design.elements.map((element) => [element.id, element]));
  const bindings = new Map(studio.elements.map((binding) => [binding.element, binding]));
  const packages = new Map(studio.packages.map((item) => [item.id, item]));
  const connections = new Map(design.connections.map((connection) => [connection.id, connection]));
  const connectionBindings = new Map(
    studio.connections.map((binding, index) => [binding.connection, { ...binding, index }]),
  );
  const application = (element: Element | undefined) =>
    !!element && containerClassification(element).kind === "Application";
  const kind = (id: string): StudioKind | undefined => bindings.get(id)?.settings.kind;
  const occupied = occupiedDesignIds(design);
  studio.packages.forEach((item, index) => {
    const path = ["packages", index];
    if (occupied.has(item.id))
      report(
        "DUPLICATE_ID",
        [...path, "id"],
        `Package identity ${item.id} collides with an existing design identity.`,
      );
    item.members.forEach((id, memberIndex) => {
      if (!elements.has(id))
        missing(
          [...path, "members", memberIndex],
          `Package member ${id} must name an existing application element, not a package.`,
        );
      else if (!application(elements.get(id)))
        invalid(
          [...path, "members", memberIndex],
          `Package member ${id} must be an application; resources are owned separately.`,
        );
    });
  });
  studio.elements.forEach((binding, index) => {
    const path = ["elements", index];
    const element = elements.get(binding.element);
    if (!element)
      missing([...path, "element"], `Studio binding targets missing element ${binding.element}.`);
    else {
      const expected = studioDefinitions[binding.settings.kind].classification.kind;
      if (element.classification?.kind !== expected)
        invalid(
          [...path, "element"],
          `Studio ${binding.settings.kind} requires explicit element.classification.kind ${expected}.`,
        );
    }
    if (studioDefinitionStatus(binding.definition, binding.settings.kind) === "unresolved")
      report(
        "NEEDS_TEMPLATE",
        [...path, "definition"],
        `Unsupported studio definition ${binding.definition.id}@${binding.definition.version}; no version substitution is permitted.`,
      );
    if (binding.owner) {
      const owner = binding.owner;
      if (owner.kind === "package" ? !packages.has(owner.id) : !elements.has(owner.id))
        missing(
          [...path, "owner", "id"],
          `Resource owner ${owner.id} must name an existing ${owner.kind}.`,
        );
      else if (owner.kind === "element" && !application(elements.get(owner.id)))
        invalid(
          [...path, "owner", "id"],
          "A resource owner must be an application element, not a resource or external system.",
        );
    }
    const settings = binding.settings;
    const applicationRef = (id: string, field: string) => {
      if (!elements.has(id))
        missing(
          [...path, "settings", field],
          `Reference ${id} must name an existing application element, not a package.`,
        );
      else if (!application(elements.get(id)) || id === binding.element)
        invalid([...path, "settings", field], "Select another actual application element.");
    };
    if (settings.kind === "browser" && settings.delivery === "bundled") {
      if (settings.servedBy) applicationRef(settings.servedBy, "servedBy");
      else
        report(
          "CONFIG_REQUIRED",
          [...path, "settings", "servedBy"],
          "Bundled browser assets need an explicit serving application.",
        );
    }
    if (settings.kind === "cdn" && settings.origin) {
      if (!elements.has(settings.origin))
        missing(
          [...path, "settings", "origin"],
          "A CDN origin must name an existing application or object store element.",
        );
      else if (
        !application(elements.get(settings.origin)) &&
        kind(settings.origin) !== "object-store"
      )
        invalid(
          [...path, "settings", "origin"],
          "A CDN origin must be an application or object store, not a package or other resource.",
        );
    }
    if (settings.kind === "redirect") {
      for (const [field, targetKind] of [
        ["lookupStoreConnection", "database"],
        ["lookupCacheConnection", "cache"],
      ] as const) {
        const id = settings[field];
        if (!id) continue;
        const connection = connections.get(id);
        if (!connection)
          missing([...path, "settings", field], `Lookup dependency ${id} does not exist.`);
        else if (
          connection.from.element !== binding.element ||
          kind(connection.to.element) !== targetKind
        )
          invalid(
            [...path, "settings", field],
            `Lookup dependency must run from this redirect application to a ${targetKind} element.`,
          );
      }
    }
  });
  // Which kinds may be entries, and how many, are lane rules (`laneFindings`, below).
  studio.entries?.forEach((entry, index) => {
    if (!elements.has(entry.element))
      missing(
        ["entries", index, "element"],
        `Lane entry ${entry.id} targets missing element ${entry.element}.`,
      );
  });
  studio.connections.forEach((binding, index) => {
    if (!connections.has(binding.connection))
      missing(
        ["connections", index, "connection"],
        `Studio binding targets missing connection ${binding.connection}.`,
      );
  });
  design.connections.forEach((connection, index) => {
    const binding = connectionBindings.get(connection.id);
    const fromStudio = bindings.get(connection.from.element);
    const toStudio = bindings.get(connection.to.element);
    if (!binding && !fromStudio && !toStudio) return;
    const path = binding ? ["connections", binding.index, "settings"] : ["connections"];
    const canonicalPath = (field: string) =>
      findings.push(
        finding("CONFIG_INVALID", `Studio relationships require a valid planned ${field}.`, {
          connection: connection.id,
          path: ["connections", index, "planned", field],
        }),
      );
    if (!studioActionSchema.safeParse(connection.planned.label).success) canonicalPath("label");
    if (!studioProtocolSchema.safeParse(connection.planned.protocol).success)
      canonicalPath("protocol");
    if (!studioAccessSchema.safeParse(connection.planned.security).success)
      canonicalPath("security");
    for (const side of ["from", "to"] as const)
      if (!elements.has(connection[side].element))
        missing(path, `Relationship ${connection.id} has a missing ${side} element.`);
    const settings = binding?.settings;
    const touchesQueue =
      kind(connection.from.element) === "queue" || kind(connection.to.element) === "queue";
    if (touchesQueue && !settings?.channelUse)
      invalid(
        [...path, "channelUse"],
        `Connection ${connection.id} to a queue requires an explicit publish/consume role.`,
      );
    if (settings?.channelUse) {
      const publish = settings.channelUse === "publish";
      const channel = publish ? connection.to.element : connection.from.element;
      const service = publish ? connection.from.element : connection.to.element;
      if (kind(channel) !== "queue" || !application(elements.get(service)))
        invalid(
          [...path, "channelUse"],
          `Channel ${settings.channelUse} requires ${publish ? "application → queue" : "queue → application"} endpoints.`,
        );
      if (connection.planned.interaction !== "Asynchronous")
        invalid(
          [...path, "channelUse"],
          "Channel connections require explicit Asynchronous interaction.",
        );
    }
    if (
      (settings?.timeoutMs !== undefined || settings?.retry !== undefined) &&
      !studioAllowsRequestPolicies(connection.planned.protocol, connection.planned.interaction)
    ) {
      for (const field of ["timeoutMs", "retry"] as const)
        if (settings?.[field] !== undefined)
          invalid(
            [...path, field],
            "Timeout/retry are permitted only for HTTP/HTTPS/gRPC request/response relationships.",
          );
    }
  });
  validateStudioComponents(design, report, kind, application);
  // Lane rules: every tile hangs off the actor, no cycles, the link table and the caps.
  findings.push(...laneFindings(design));
  return findings;
}

type Report = (code: FindingCode, path: (string | number)[], message: string) => void;

/**
 * Component rules. Structure (host, targets, traced C2 connection, channel role, identity)
 * is an error; a missing dependency that settings call for is a readiness gap (CONFIG_REQUIRED).
 */
function validateStudioComponents(
  design: DesignDocument,
  report: Report,
  kind: (id: string) => StudioKind | undefined,
  application: (element: Element | undefined) => boolean,
) {
  const studio = design.architecture?.studio;
  if (!studio) return;
  const components = studio.components ?? [];
  const links = studio.componentConnections ?? [];
  if (!components.length && !links.length) return;
  const elements = new Map(design.elements.map((element) => [element.id, element]));
  const bindings = new Map(studio.elements.map((binding) => [binding.element, binding]));
  const connections = new Map(design.connections.map((item) => [item.id, item]));
  const byId = new Map(components.map((item) => [item.id, item]));
  const occupied = occupiedDesignIds(design);
  for (const item of studio.packages) occupied.add(item.id);
  const targetKind = (id: string): StudioComponentTargetKind | undefined => {
    const value = kind(id);
    if (value === "identity") return "identity";
    if (
      value === "database" ||
      value === "cache" ||
      value === "queue" ||
      value === "search" ||
      value === "object-store" ||
      value === "cdn" ||
      value === "external-api"
    )
      return value;
    return application(elements.get(id)) ? "application" : undefined;
  };
  components.forEach((item, index) => {
    const path = ["components", index];
    if (occupied.has(item.id))
      report(
        "DUPLICATE_ID",
        [...path, "id"],
        `Component identity ${item.id} collides with an existing design identity.`,
      );
    const host = bindings.get(item.host);
    if (!elements.has(item.host))
      report("UNKNOWN_REFERENCE", [...path, "host"], `Component host ${item.host} does not exist.`);
    else if (!host || !application(elements.get(item.host)))
      report(
        "CONFIG_INVALID",
        [...path, "host"],
        "A component host must be a studio application element, not a resource, external system, or package.",
      );
    else if (
      host.settings.kind === "browser" &&
      !studioComponentDefinitions[item.settings.kind].browserHost
    )
      report(
        "CONFIG_INVALID",
        [...path, "host"],
        `A ${studioComponentDefinitions[item.settings.kind].name} cannot run inside a browser app.`,
      );
    if (item.settings.kind === "event-consumer" && item.settings.deadLetterQueue) {
      const queue = item.settings.deadLetterQueue;
      if (!elements.has(queue))
        report(
          "UNKNOWN_REFERENCE",
          [...path, "settings", "deadLetterQueue"],
          `Dead-letter queue ${queue} does not exist.`,
        );
      else if (kind(queue) !== "queue")
        report(
          "CONFIG_INVALID",
          [...path, "settings", "deadLetterQueue"],
          "A dead-letter queue must be a queue element.",
        );
    }
    if (item.settings.kind === "custom" && !item.description?.trim())
      report(
        "CONFIG_REQUIRED",
        [...path, "description"],
        "A custom component needs a one-line purpose for its generated stub.",
      );
  });
  const seen = new Set<string>();
  links.forEach((link, index) => {
    const path = ["componentConnections", index];
    if (occupied.has(link.id) || byId.has(link.id))
      report(
        "DUPLICATE_ID",
        [...path, "id"],
        `Component connection identity ${link.id} collides with an existing design identity.`,
      );
    const from = byId.get(link.from);
    if (!from) {
      report("UNKNOWN_REFERENCE", [...path, "from"], `Component ${link.from} does not exist.`);
      return;
    }
    const key = `${link.from}>${link.to.kind}:${link.to.id}${link.to.kind === "element" ? `>${link.to.via}` : ""}`;
    if (seen.has(key))
      report("DUPLICATE_CONNECTION", path, "This component connection already exists.");
    seen.add(key);
    if (link.to.kind === "component") {
      const target = byId.get(link.to.id);
      if (!target)
        report(
          "UNKNOWN_REFERENCE",
          [...path, "to", "id"],
          `Component ${link.to.id} does not exist.`,
        );
      else if (target.id === from.id || target.host !== from.host)
        report(
          "CONFIG_INVALID",
          [...path, "to", "id"],
          "A component may connect only to another component in the same application; cross-service use traces a C2 connection.",
        );
      return;
    }
    const definition = studioComponentDefinitions[from.settings.kind];
    const target = link.to.id;
    const via = connections.get(link.to.via);
    if (!elements.has(target)) {
      report("UNKNOWN_REFERENCE", [...path, "to", "id"], `Element ${target} does not exist.`);
      return;
    }
    const resolved = targetKind(target);
    if (target === from.host || !resolved || !definition.targets.includes(resolved))
      report(
        "CONFIG_INVALID",
        [...path, "to", "id"],
        `A ${definition.name} cannot use ${resolved ?? "that element"}; allowed: ${definition.targets.join(", ") || "none"}.`,
      );
    if (!via) {
      report(
        "UNKNOWN_REFERENCE",
        [...path, "to", "via"],
        `Traced C2 connection ${link.to.via} does not exist.`,
      );
      return;
    }
    const ends = [via.from.element, via.to.element];
    if (!ends.includes(from.host) || !ends.includes(target)) {
      report(
        "CONFIG_INVALID",
        [...path, "to", "via"],
        `Connection ${via.id} must join the host ${from.host} and ${target} directly.`,
      );
      return;
    }
    if (resolved === "queue") {
      const role = studio.connections.find((item) => item.connection === via.id)?.settings
        .channelUse;
      if (definition.channelUse && role !== definition.channelUse)
        report(
          "CONFIG_INVALID",
          [...path, "to", "via"],
          `A ${definition.name} must trace a ${definition.channelUse} connection.`,
        );
    }
  });
  components.forEach((item, index) => {
    const used = new Set(
      links.flatMap((link) =>
        link.from === item.id && link.to.kind === "element" ? [targetKind(link.to.id)] : [],
      ),
    );
    for (const requirement of studioComponentRequirements(item.settings))
      if (!requirement.kinds.some((value) => used.has(value)))
        report("CONFIG_REQUIRED", ["components", index], requirement.reason);
    if (item.settings.kind === "event-consumer" && item.settings.deadLetterQueue)
      if (
        links.some(
          (link) =>
            link.from === item.id &&
            link.to.kind === "element" &&
            link.to.id === (item.settings as { deadLetterQueue?: string }).deadLetterQueue,
        )
      )
        report(
          "CONFIG_INVALID",
          ["components", index, "settings", "deadLetterQueue"],
          "The dead-letter queue must differ from the source queue.",
        );
    if (item.settings.kind === "data-access" && item.settings.readRouting === "replica") {
      const replicas = links.some((link) => {
        if (link.from !== item.id || link.to.kind !== "element") return false;
        const settings = bindings.get(link.to.id)?.settings;
        return settings?.kind === "database" && (settings.readReplicas ?? 0) > 0;
      });
      if (!replicas)
        report(
          "CONFIG_REQUIRED",
          ["components", index, "settings", "readRouting"],
          "Replica read routing needs a connected database with at least one read replica.",
        );
    }
  });
}
