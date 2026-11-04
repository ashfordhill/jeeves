/** Structural studio hooks share the existing all-or-nothing semantic validation boundary. */
import { containerClassification } from "./architecture-choices.ts";
import { backendDeclarations } from "./backend-model.ts";
import type { DesignDocument, Element } from "./design.ts";
import { type Finding, type FindingCode, finding } from "./findings.ts";
import { studioDefinitions } from "./studio-definitions.ts";
import { legacyStudioKind } from "./studio-legacy.ts";
import {
  type StudioKind,
  studioAccessSchema,
  studioActionSchema,
  studioAllowsRequestPolicies,
  studioDefinitionStatus,
  studioModelSchema,
  studioProtocolSchema,
} from "./studio-model.ts";
import { resolveStudioPackagePreset } from "./studio-presets.ts";

/** Package identities cannot shadow any existing graph or architecture declaration. */
function occupiedDesignIds(design: DesignDocument): Set<string> {
  const model = design.architecture;
  return new Set([
    "system",
    ...design.elements.flatMap((element) => [element.id, ...element.attachments.map((a) => a.id)]),
    ...design.connections.map((item) => item.id),
    ...design.annotations.map((item) => item.id),
    ...Object.values(model ?? {}).flatMap((value) =>
      Array.isArray(value)
        ? value.flatMap((item) => ("id" in item ? [item.id as string] : []))
        : [],
    ),
    ...backendDeclarations(model?.backend).map((item) => item.id),
    ...(model?.deployments ?? []).flatMap((env) =>
      [...env.nodes, ...env.instances, ...env.externals, ...env.interactions].map(
        (item) => item.id,
      ),
    ),
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
  const kind = (id: string): StudioKind | undefined => {
    const binding = bindings.get(id);
    if (binding) return binding.settings.kind;
    const element = elements.get(id);
    return element ? legacyStudioKind(element) : undefined;
  };
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
    if (item.preset && !resolveStudioPackagePreset(item.preset))
      report(
        "NEEDS_TEMPLATE",
        [...path, "preset"],
        `Package preset ${item.preset.id}@${item.preset.version} has no exact local definition; no version substitution is permitted.`,
      );
  });
  studio.elements.forEach((binding, index) => {
    const path = ["elements", index];
    const element = elements.get(binding.element);
    if (!element)
      missing([...path, "element"], `Studio binding targets missing element ${binding.element}.`);
    else {
      if (
        element.template !== null ||
        element.planned !== undefined ||
        Object.keys(element.config).length ||
        element.attachments.length
      )
        invalid(
          [...path, "element"],
          `Studio element ${element.id} must have template null, empty config/attachments and no legacy planned capability; conversion is unsupported.`,
        );
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
          kind(connection.to.element) !== targetKind ||
          connection.from.attachment ||
          connection.to.attachment ||
          connection.config?.fromCapability ||
          connection.config?.toCapability
        )
          invalid(
            [...path, "settings", field],
            `Lookup dependency must run from this redirect application to a ${targetKind} element.`,
          );
      }
    }
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
    if (!connection.planned) canonicalPath("label/protocol/interaction/security");
    else {
      if (!studioActionSchema.safeParse(connection.planned.label).success) canonicalPath("label");
      if (!studioProtocolSchema.safeParse(connection.planned.protocol).success)
        canonicalPath("protocol");
      if (!studioAccessSchema.safeParse(connection.planned.security).success)
        canonicalPath("security");
    }
    if (
      connection.from.attachment ||
      connection.to.attachment ||
      connection.config?.fromCapability ||
      connection.config?.toCapability
    )
      invalid(
        path,
        "Studio relationships must connect outer elements without legacy capability bindings.",
      );
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
      if (connection.planned?.interaction !== "Asynchronous")
        invalid(
          [...path, "channelUse"],
          "Channel connections require explicit Asynchronous interaction.",
        );
    }
    if (
      (settings?.timeoutMs !== undefined || settings?.retry !== undefined) &&
      !studioAllowsRequestPolicies(
        connection.planned?.protocol ?? "",
        connection.planned?.interaction ?? "",
      )
    ) {
      for (const field of ["timeoutMs", "retry"] as const)
        if (settings?.[field] !== undefined)
          invalid(
            [...path, field],
            "Timeout/retry are permitted only for HTTP/HTTPS/gRPC request/response relationships.",
          );
    }
  });
  if (studio.elements.length || studio.connections.length || studio.packages.length)
    report(
      "NEEDS_TEMPLATE",
      [],
      "Studio settings and packages are design intent; application generation has no studio runtime resolver.",
    );
  return findings;
}
