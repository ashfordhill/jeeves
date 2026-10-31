import { validateArchitecture } from "./architecture.ts";
import { checkConfig } from "./config.ts";
import { deliveryStore } from "./delivery.ts";
import {
  type Attachment,
  type Connection,
  type ConnectionKind,
  capabilityEndpoint,
  type DesignDocument,
  designIds,
  type Element,
  type Endpoint,
} from "./design.ts";
import { type Finding, type FindingTarget, finding } from "./findings.ts";
import { formatTemplateRef, type TemplateRef } from "./ids.ts";
import {
  type ElementManifest,
  findPort,
  type Port,
  type TemplateLookup,
  type TemplateManifest,
} from "./manifest.ts";

/** An endpoint with its element, attachment, and their templates looked up. */
export interface ResolvedEndpoint {
  element: Element;
  attachment?: Attachment;
  /** Template of the element. `undefined` if it has none or it's unknown. */
  elementManifest?: ElementManifest;
  /** Template of the attachment if there is one, else of the element. */
  manifest?: TemplateManifest;
  /** `false` when the template is unknown or of the wrong kind, so port checks are skipped. */
  checkable: boolean;
  label: string;
}

export function resolveEndpoint(
  design: DesignDocument,
  endpoint: Endpoint,
  lookup: TemplateLookup,
): ResolvedEndpoint | undefined {
  const element = design.elements.find((e) => e.id === endpoint.element);
  if (!element) return undefined;
  const elementTemplate = element.template ? lookup.get(element.template) : undefined;
  const elementManifest = elementTemplate?.kind === "element" ? elementTemplate : undefined;
  const elementCheckable = element.template === null || elementManifest !== undefined;
  if (endpoint.attachment === undefined) {
    return {
      element,
      elementManifest,
      manifest: elementManifest,
      checkable: elementCheckable,
      label: `"${element.name}"`,
    };
  }
  const attachment = element.attachments.find((a) => a.id === endpoint.attachment);
  if (!attachment) return undefined;
  const template = lookup.get(attachment.template);
  const manifest = template?.kind === "attachment" ? template : undefined;
  return {
    element,
    attachment,
    elementManifest,
    manifest,
    checkable: manifest !== undefined,
    label: `the ${manifest?.displayName ?? attachment.id} on "${element.name}"`,
  };
}

/**
 * Why a `kind` connection from `from` to `to` isn't allowed, or `undefined` if it is (or can't
 * be judged because a template is unknown, which is reported separately).
 */
export function portIncompatibility(
  from: ResolvedEndpoint,
  to: ResolvedEndpoint,
  kind: ConnectionKind,
): string | undefined {
  if (!from.checkable || !to.checkable) return undefined;
  if (from.element.id === to.element.id && from.attachment?.id === to.attachment?.id) {
    return `${capitalize(from.label)} can't connect to itself.`;
  }
  for (const end of [from, to]) {
    if (!end.manifest) return `${capitalize(end.label)} needs a template before it can connect.`;
  }
  const outPort = findPort(from.manifest as TemplateManifest, kind, "out");
  if (!outPort) return `${capitalize(from.label)} has no outgoing "${kind}" connection.`;
  const inPort = findPort(to.manifest as TemplateManifest, kind, "in");
  if (!inPort) return `${capitalize(to.label)} can't be the target of a "${kind}" connection.`;
  if (!accepts(outPort, to)) {
    return `${capitalize(from.label)} can only ${describeKind(kind)} ${describeAccepts(outPort)}.`;
  }
  if (!accepts(inPort, from)) {
    return `${capitalize(to.label)} only accepts "${kind}" from ${describeAccepts(inPort)}.`;
  }
  return undefined;
}

function accepts(port: Port, end: ResolvedEndpoint): boolean {
  const rule = port.accepts;
  if (!rule) return true;
  if (rule.templates && !(end.manifest && rule.templates.includes(end.manifest.id))) return false;
  if (
    rule.elementKinds &&
    !(end.elementManifest && rule.elementKinds.includes(end.elementManifest.elementKind))
  ) {
    return false;
  }
  return true;
}

function describeAccepts(port: Port): string {
  const parts = [
    ...(port.accepts?.templates ?? []),
    ...(port.accepts?.elementKinds ?? []).map((k) => `${k} elements`),
  ];
  return parts.join(" or ");
}

function describeKind(kind: ConnectionKind): string {
  return { "uses-database": "use", calls: "call", "depends-on": "depend on" }[kind];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function endpointKey(endpoint: Endpoint): string {
  return endpoint.attachment === undefined
    ? endpoint.element
    : `${endpoint.element}/${endpoint.attachment}`;
}

function endpointTarget(endpoint: Endpoint): FindingTarget {
  return endpoint.attachment === undefined
    ? { element: endpoint.element }
    : { element: endpoint.element, attachment: endpoint.attachment };
}

/**
 * Every structural problem and readiness finding in a design, in document order. A design with
 * no findings can be generated.
 */
export function validateDesign(design: DesignDocument, lookup: TemplateLookup): Finding[] {
  const findings: Finding[] = validateArchitecture(design);

  const seen = new Map<string, string>();
  for (const { id, type } of designIds(design)) {
    const previous = seen.get(id);
    if (previous) {
      findings.push(
        finding("DUPLICATE_ID", `ID "${id}" is used by a ${previous} and a ${type}.`, {
          [type]: id,
        }),
      );
    } else {
      seen.set(id, type);
    }
  }

  for (const element of design.elements) {
    validateElement(element, lookup, findings);
    for (const attachment of element.attachments) {
      const model = attachment.config.model as
        | { storeConnection?: string; resources?: unknown[] }
        | undefined;
      if (attachment.template.id !== "rest-api-server") continue;
      if (attachment.config.auth === "session" && !model)
        findings.push(
          finding(
            "CONFIG_REQUIRED",
            "Session authentication requires a structured resource model.",
            { element: element.id, attachment: attachment.id, path: ["model"] },
          ),
        );
      if (!model) continue;
      if (attachment.config.basePath !== undefined && attachment.config.basePath !== "/api")
        findings.push(
          finding(
            "CONFIG_INVALID",
            "Structured resource CRUD uses the fixed /api base path; extension paths are absolute.",
            { element: element.id, attachment: attachment.id, path: ["basePath"] },
          ),
        );
      const target = { element: element.id, attachment: attachment.id };
      const store = design.connections.find(
        (c) =>
          c.id === model.storeConnection &&
          c.kind === "uses-database" &&
          c.from.element === element.id,
      );
      if (
        !store ||
        design.elements.find((e) => e.id === store.to.element)?.template?.id !== "postgres"
      )
        findings.push(
          finding(
            "CONFIG_REQUIRED",
            "Resources need an explicitly selected Postgres storeConnection.",
            { ...target, path: ["model", "storeConnection"] },
          ),
        );
      if (attachment.config.auth !== "session")
        findings.push(
          finding("CONFIG_REQUIRED", "Resource services require session authentication.", {
            ...target,
            path: ["auth"],
          }),
        );
    }
  }

  for (const element of design.elements) {
    const attachment = element.attachments.find((a) => a.template.id === "durable-events");
    if (attachment && !deliveryStore(design, element.id))
      findings.push(
        finding(
          "CONFIG_REQUIRED",
          "Durable events require one Postgres connection from this service.",
          { element: element.id, attachment: attachment.id },
        ),
      );
  }

  const resolved = new Map<string, ResolvedEndpoint>();
  const connected = new Set<string>();
  const portUse = new Map<string, number>();
  for (const connection of design.connections) {
    validateConnection(design, connection, lookup, resolved, findings);
    const fromKey = `${endpointKey(capabilityEndpoint(connection, "from"))}|${connection.kind}|out`;
    const toKey = `${endpointKey(capabilityEndpoint(connection, "to"))}|${connection.kind}|in`;
    for (const [key, endpoint, direction] of [
      [fromKey, capabilityEndpoint(connection, "from"), "out"],
      [toKey, capabilityEndpoint(connection, "to"), "in"],
    ] as const) {
      connected.add(key);
      const count = (portUse.get(key) ?? 0) + 1;
      portUse.set(key, count);
      const end = resolved.get(endpointKey(endpoint));
      const port = end?.manifest && findPort(end.manifest, connection.kind, direction);
      if (end && port && !port.multiple && count > 1) {
        findings.push(
          finding(
            "PORT_MULTIPLICITY",
            `${capitalize(end.label)} already has a "${connection.kind}" connection; it allows only one.`,
            { connection: connection.id },
          ),
        );
      }
    }
  }

  const annotationTargets = new Set(seen.keys());
  for (const annotation of design.annotations) {
    if (annotation.kind !== "arrow") continue;
    for (const ref of [annotation.from, annotation.to]) {
      if (ref !== undefined && !annotationTargets.has(ref)) {
        findings.push(
          finding(
            "UNKNOWN_REFERENCE",
            `Arrow "${annotation.id}" points at missing item "${ref}".`,
            {
              annotation: annotation.id,
            },
          ),
        );
      }
    }
  }

  for (const element of design.elements) {
    const owners: [Endpoint, TemplateManifest | undefined][] = [
      [{ element: element.id }, element.template ? lookup.get(element.template) : undefined],
      ...element.attachments.map((a): [Endpoint, TemplateManifest | undefined] => [
        { element: element.id, attachment: a.id },
        lookup.get(a.template),
      ]),
    ];
    for (const [endpoint, manifest] of owners) {
      for (const port of manifest?.ports ?? []) {
        if (!port.required) continue;
        if (connected.has(`${endpointKey(endpoint)}|${port.kind}|${port.direction}`)) continue;
        const what = endpoint.attachment
          ? `The ${manifest?.displayName} on "${element.name}"`
          : `"${element.name}"`;
        findings.push(
          finding(
            "UNCONNECTED_REQUIRED_PORT",
            `${what} needs a "${port.kind}" connection (${port.label}).`,
            endpointTarget(endpoint),
          ),
        );
      }
    }
  }

  return findings;
}

function validateElement(element: Element, lookup: TemplateLookup, findings: Finding[]): void {
  const target = { element: element.id };
  let manifest: ElementManifest | undefined;
  if (element.template === null) {
    findings.push(
      finding(
        "NEEDS_TEMPLATE",
        `"${element.name}" needs a template before it can be generated.`,
        target,
      ),
    );
    if (Object.keys(element.config).length > 0) {
      findings.push(
        finding(
          "CONFIG_INVALID",
          `"${element.name}" has no template, so it can't have config.`,
          target,
        ),
      );
    }
  } else {
    const template = lookupTemplate(element.template, lookup, target, findings);
    if (template?.kind === "attachment") {
      findings.push(
        finding(
          "TEMPLATE_KIND_MISMATCH",
          `"${template.displayName}" is an attachment template; "${element.name}" needs an element template.`,
          target,
        ),
      );
    } else if (template) {
      manifest = template;
      checkTemplateConfig(template, element.config, `"${element.name}"`, target, findings);
    }
  }

  const slotCounts = new Map<string, number>();
  for (const attachment of element.attachments) {
    const aTarget = { element: element.id, attachment: attachment.id };
    const template = lookupTemplate(attachment.template, lookup, aTarget, findings);
    if (!template) continue;
    if (template.kind === "element") {
      findings.push(
        finding(
          "TEMPLATE_KIND_MISMATCH",
          `"${template.displayName}" is an element template, not an attachment.`,
          aTarget,
        ),
      );
      continue;
    }
    checkTemplateConfig(
      template,
      attachment.config,
      `The ${template.displayName} on "${element.name}"`,
      aTarget,
      findings,
    );
    if (element.template === null) {
      findings.push(
        finding(
          "ATTACHMENT_INCOMPATIBLE",
          `"${element.name}" needs a template before it can take a ${template.displayName}.`,
          aTarget,
        ),
      );
      continue;
    }
    if (!manifest) continue;
    const slot = manifest.attachmentSlots.find((s) => s.template === template.id);
    if (!slot) {
      findings.push(
        finding(
          "ATTACHMENT_INCOMPATIBLE",
          `A ${manifest.displayName} can't take a ${template.displayName}.`,
          aTarget,
        ),
      );
      continue;
    }
    const count = (slotCounts.get(template.id) ?? 0) + 1;
    slotCounts.set(template.id, count);
    if (slot.max !== undefined && count > slot.max) {
      findings.push(
        finding(
          "ATTACHMENT_INCOMPATIBLE",
          `"${element.name}" can have at most ${slot.max} ${template.displayName}.`,
          aTarget,
        ),
      );
    }
  }
}

function lookupTemplate(
  ref: TemplateRef,
  lookup: TemplateLookup,
  target: FindingTarget,
  findings: Finding[],
): TemplateManifest | undefined {
  const manifest = lookup.get(ref);
  if (manifest) return manifest;
  const versions = lookup.versions(ref.id);
  findings.push(
    finding(
      "UNKNOWN_TEMPLATE",
      versions.length > 0
        ? `Template ${formatTemplateRef(ref)} isn't installed; known versions: ${versions.join(", ")}.`
        : `There is no "${ref.id}" template.`,
      target,
    ),
  );
  return undefined;
}

function checkTemplateConfig(
  manifest: TemplateManifest,
  config: Record<string, unknown>,
  what: string,
  target: FindingTarget,
  findings: Finding[],
): void {
  const { invalid, missing } = checkConfig(manifest.config, config);
  for (const problem of invalid) {
    findings.push(
      finding("CONFIG_INVALID", `${what}: ${problem.path.join(".")}: ${problem.message}`, {
        ...target,
        path: problem.path,
      }),
    );
  }
  for (const key of missing) {
    findings.push(
      finding("CONFIG_REQUIRED", `${what} needs a value for "${key}".`, { ...target, path: [key] }),
    );
  }
}

function validateConnection(
  design: DesignDocument,
  connection: Connection,
  lookup: TemplateLookup,
  resolved: Map<string, ResolvedEndpoint>,
  findings: Finding[],
): void {
  const target = { connection: connection.id };
  if (design.schemaVersion === 2 && (connection.from.attachment || connection.to.attachment))
    findings.push(
      finding(
        "PORT_INCOMPATIBLE",
        "Version 2 endpoints must name outer elements; select components in connection config.",
        target,
      ),
    );
  const ends: (ResolvedEndpoint | undefined)[] = [];
  for (const endpoint of [
    capabilityEndpoint(connection, "from"),
    capabilityEndpoint(connection, "to"),
  ]) {
    const key = endpointKey(endpoint);
    const end = resolved.get(key) ?? resolveEndpoint(design, endpoint, lookup);
    if (end) {
      resolved.set(key, end);
    } else {
      findings.push(
        finding(
          "UNKNOWN_REFERENCE",
          `Connection "${connection.id}" refers to missing ${endpoint.attachment ? "attachment" : "element"} "${endpoint.attachment ?? endpoint.element}".`,
          target,
        ),
      );
    }
    ends.push(end);
  }
  const [from, to] = ends;
  if (!from || !to) return;

  const duplicate = design.connections.find(
    (other) =>
      other.kind === connection.kind &&
      endpointKey(capabilityEndpoint(other, "from")) ===
        endpointKey(capabilityEndpoint(connection, "from")) &&
      endpointKey(capabilityEndpoint(other, "to")) ===
        endpointKey(capabilityEndpoint(connection, "to")),
  );
  if (duplicate && duplicate !== connection) {
    findings.push(
      finding(
        "DUPLICATE_CONNECTION",
        `${capitalize(from.label)} is already connected to ${to.label} by "${duplicate.id}".`,
        target,
      ),
    );
    return;
  }

  const reason = portIncompatibility(from, to, connection.kind);
  if (reason) findings.push(finding("PORT_INCOMPATIBLE", reason, target));
}
