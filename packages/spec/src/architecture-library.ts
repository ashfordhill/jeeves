/** Portable, declarative selections. No project identity, executable code or verification. */
import { z } from "zod";
import { architectureSchema } from "./architecture.ts";
import { containerClassification } from "./architecture-choices.ts";
import { contractCanonical } from "./architecture-contracts.ts";
import {
  type ArchitectureFragment,
  architectureFragmentSchema,
  fragmentCollections,
  fragmentIds,
  mappedArchitecture,
  type PatternPreview,
  type PatternRequestInput,
  previewArchitecturePattern,
} from "./architecture-patterns.ts";
import { collectBackendDependencies } from "./backend-model.ts";
import { type DesignDocument, elementSchema } from "./design.ts";
import { idSchema, versionSchema } from "./ids.ts";
import type { TemplateLookup } from "./manifest.ts";
import { componentHostRole, plannedCapability } from "./planned-capabilities.ts";
import { scenarioPaths } from "./scenarios.ts";
import { mapStudioSettings, studioSettingReferences } from "./studio-references.ts";

export const architectureSelectionSchema = z
  .strictObject({
    elements: z.array(idSchema).max(20).default([]),
    components: z.array(idSchema).max(20).default([]),
    packages: z.array(idSchema).max(20).default([]),
  })
  .refine(
    (s) => s.elements.length + s.components.length + s.packages.length > 0,
    "Select at least one container or component.",
  );
export const libraryMetadataSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(1200),
  invariants: z.array(z.string().trim().min(1).max(1200)).max(20),
  extensionPoints: z
    .array(z.strictObject({ role: idSchema, description: z.string().trim().min(1).max(500) }))
    .max(32),
  /** Finite existing component options only; no arbitrary config/code upload. */
  exposedOptions: z
    .array(z.strictObject({ role: idSchema, field: z.string().min(1).max(80) }))
    .max(20),
});
export type LibraryMetadata = z.output<typeof libraryMetadataSchema>;
export const architectureLibraryEntrySchema = z.strictObject({
  id: idSchema,
  version: versionSchema,
  state: z.enum(["draft", "published", "retired"]),
  draftRevision: z.int().nonnegative(),
  fragment: architectureFragmentSchema,
  metadata: libraryMetadataSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  availability: z.literal("architecture only"),
});
export type ArchitectureLibraryEntry = z.output<typeof architectureLibraryEntrySchema>;
export const libraryInsertSchema = z.strictObject({
  id: idSchema,
  version: versionSchema,
  contentHash: architectureLibraryEntrySchema.shape.contentHash,
  instanceId: idSchema.max(22),
  baseRevision: z.int().nonnegative(),
  name: z.string().trim().min(1).max(80),
  roles: z
    .record(
      idSchema,
      z.discriminatedUnion("mode", [
        z.strictObject({ mode: z.literal("reuse"), id: idSchema }),
        z.strictObject({ mode: z.literal("create") }),
        z.strictObject({ mode: z.literal("unfilled") }),
      ]),
    )
    .default({}),
  relationships: z.record(idSchema, idSchema).default({}),
  definitions: z.record(idSchema, idSchema).default({}),
  options: z.record(z.string(), z.string()).default({}),
});
export type LibraryInsert = z.output<typeof libraryInsertSchema>;
export type LibraryInsertInput = z.input<typeof libraryInsertSchema>;

/** Only declared finite choices, booleans and numbers are portable configuration. */
function portableConfig(capability: string | undefined, config: Record<string, unknown>) {
  const fields = plannedCapability(capability)?.fields ?? [];
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = config[field.key];
      return value !== undefined &&
        ((field.options && field.options.includes(String(value))) ||
          (typeof field.default !== "string" && typeof value === typeof field.default))
        ? [[field.key, value]]
        : [];
    }),
  );
}
const plannedFamily = (element: DesignDocument["elements"][number]) =>
  element.planned ??
  { "http-service": "application-api", postgres: "relational-store", "web-app": "browser-client" }[
    element.template?.id ?? ""
  ];

export function extractArchitectureTemplate(
  design: DesignDocument,
  input: z.input<typeof architectureSelectionSchema>,
  identity: { id: string; version: string; name: string; purpose: string },
  lookup: TemplateLookup,
): { fragment: ArchitectureFragment; metadata: LibraryMetadata } {
  const selection = architectureSelectionSchema.parse(input);
  const a =
    design.architecture ??
    architectureSchema.parse({ system: { name: "System", description: "" } });
  const copiedElements = new Set(selection.elements);
  const copiedPackages = new Set(selection.packages);
  const studio = a.studio;
  for (const id of copiedPackages) {
    const item = studio?.packages.find((item) => item.id === id);
    if (!item) throw new Error(`Selected package ${id} no longer exists.`);
    for (const member of item.members) copiedElements.add(member);
  }
  // Complete selected packages and their owned resources; never persist a partial package.
  let copiedCount = -1;
  while (copiedCount !== copiedElements.size + copiedPackages.size) {
    copiedCount = copiedElements.size + copiedPackages.size;
    for (const item of studio?.packages ?? [])
      if (item.members.every((id) => copiedElements.has(id))) copiedPackages.add(item.id);
    for (const binding of studio?.elements ?? []) {
      if (
        binding.owner &&
        (binding.owner.kind === "package" ? copiedPackages : copiedElements).has(binding.owner.id)
      )
        copiedElements.add(binding.element);
      if (copiedElements.has(binding.element) && binding.owner?.kind === "package") {
        const ownerId = binding.owner.id;
        const item = studio?.packages.find((item) => item.id === ownerId);
        if (!item)
          throw new Error(`Resource ${binding.element} has unresolved package owner ${ownerId}.`);
        copiedPackages.add(item.id);
        for (const member of item.members) copiedElements.add(member);
      }
    }
  }
  const copiedComponents = new Set([
    ...selection.components,
    ...(a.components ?? []).filter((c) => copiedElements.has(c.element)).map((c) => c.id),
  ]);
  for (const id of copiedElements)
    if (!design.elements.some((e) => e.id === id))
      throw new Error(`Selected container ${id} no longer exists.`);
  for (const id of copiedComponents)
    if (!a.components?.some((c) => c.id === id))
      throw new Error(`Selected component ${id} no longer exists.`);
  const keep = new Set([...copiedElements, ...copiedComponents, ...copiedPackages]);
  for (const c of a.components ?? [])
    if (copiedComponents.has(c.id)) for (const id of c.usesConnections) keep.add(id);
  for (const c of design.connections)
    if (copiedElements.has(c.from.element) || copiedElements.has(c.to.element)) keep.add(c.id);
  for (const r of a.componentRelationships ?? [])
    if (copiedComponents.has(r.from) || copiedComponents.has(r.to)) keep.add(r.id);
  for (const i of a.interfaces ?? []) if (keep.has(i.owner.id)) keep.add(i.id);
  for (const d of a.datasets ?? [])
    if ([...d.owners, ...d.readers, ...d.writers].some((o) => keep.has(o.id))) keep.add(d.id);
  for (const s of a.scenarios ?? [])
    if (scenarioPaths(s).some((p) => p.steps.some((step) => keep.has(step.relationship.id))))
      keep.add(s.id);
  // Follow explicit declarations, never the entire graph of a required dependency.
  let previous = -1;
  while (previous !== keep.size) {
    previous = keep.size;
    collectBackendDependencies(a.backend, keep);
    for (const binding of studio?.elements ?? [])
      if (keep.has(binding.element)) {
        for (const id of studioSettingReferences(binding.settings)) keep.add(id);
        // Reused resource bindings retain their destination owner instead of adopting source ownership.
        if (copiedElements.has(binding.element) && binding.owner) keep.add(binding.owner.id);
      }
    for (const item of studio?.packages ?? [])
      if (copiedPackages.has(item.id)) for (const id of item.members) keep.add(id);
    for (const decision of a.decisions ?? [])
      if (decision.id.startsWith("studio-c4b-") && decision.links.some((link) => keep.has(link.id)))
        keep.add(decision.id);
    for (const b of a.bindings ?? [])
      if (
        keep.has(b.id) ||
        keep.has(b.relationship.id) ||
        keep.has(b.provided) ||
        keep.has(b.required)
      ) {
        keep.add(b.id);
        keep.add(b.provided);
        keep.add(b.required);
        keep.add(b.relationship.id);
        keep.add(b.contract.id);
      }
    for (const c of design.connections)
      if (keep.has(c.id)) {
        keep.add(c.from.element);
        keep.add(c.to.element);
      }
    for (const r of a.componentRelationships ?? [])
      if (keep.has(r.id)) {
        keep.add(r.from);
        keep.add(r.to);
      }
    for (const c of a.components ?? []) if (keep.has(c.id)) keep.add(c.element);
    for (const i of a.interfaces ?? [])
      if (keep.has(i.id)) {
        keep.add(i.owner.id);
        keep.add(i.contract.id);
      }
    for (const d of a.datasets ?? [])
      if (keep.has(d.id)) {
        keep.add(d.contract.id);
        if (d.store) keep.add(d.store);
        for (const o of [...d.owners, ...d.readers, ...d.writers]) keep.add(o.id);
      }
    for (const s of a.scenarios ?? [])
      if (keep.has(s.id)) {
        if (s.actor) keep.add(s.actor);
        if (s.scope.level === "components") keep.add(s.scope.container);
        for (const path of scenarioPaths(s))
          for (const step of path.steps) {
            keep.add(step.relationship.id);
            if (step.binding) keep.add(step.binding);
            if (step.client) keep.add(step.client.component);
          }
        for (const outcome of s.outcomes ?? [])
          for (const id of [...outcome.requirements, ...outcome.decisions]) keep.add(id);
      }
    for (const r of a.relationships)
      if (keep.has(r.id)) {
        keep.add(r.from);
        keep.add(r.to);
        if (r.container) keep.add(r.container);
      }
    for (const n of a.nodes) if (keep.has(n.id) && n.container) keep.add(n.container);
    for (const r of a.reviewRequirements ?? [])
      if (keep.has(r.id)) {
        for (const key of ["binding", "fallback", "update", "channel"] as const)
          if (key in r) {
            const value = (r as Record<string, unknown>)[key];
            if (typeof value === "string") keep.add(value);
          }
        if (r.kind === "delivery" && r.responsible) keep.add(r.responsible.id);
      }
    for (const d of a.decisions ?? [])
      if (keep.has(d.id))
        for (const l of d.links) keep.add(l.kind === "contract" ? l.id.split("@")[0]! : l.id);
    for (const o of a.objectives ?? [])
      if (keep.has(o.id) && o.scope.kind !== "system") keep.add(o.scope.id);
  }
  const fragment: ArchitectureFragment = {
    formatVersion: 1,
    id: identity.id,
    version: identity.version,
    name: identity.name,
    description: identity.purpose,
    roles: [],
    architecture: architectureSchema.parse({
      system: { name: "Reusable architecture", description: "" },
    }),
    connections: [],
    invariants: [],
    extensionPoints: [],
  };
  // The artifact holds new planned boundaries, never executable templates, attachments or notes.
  for (const e of design.elements.filter((e) => keep.has(e.id))) {
    const binding = studio?.elements.find((binding) => binding.element === e.id);
    const family = plannedFamily(e);
    const classification = containerClassification(e).kind;
    if (
      (!family && !binding) ||
      ["Deployment infrastructure", "Unspecified"].includes(classification)
    )
      throw new Error(`Choose an explicit portable planned family for ${e.name} before saving it.`);
    const create = elementSchema.parse({
      id: e.id,
      name: e.name,
      ...(binding && e.description !== undefined ? { description: e.description } : {}),
      template: null,
      ...(!binding && { planned: family, config: portableConfig(family, e.config) }),
      ...(e.classification ? { classification: e.classification } : {}),
    });
    const copied =
      copiedElements.has(e.id) &&
      (binding || containerClassification(e).ownership !== "External responsibility");
    fragment.roles.push({
      id: e.id,
      name: e.name,
      purpose: copied
        ? "Independent planned boundary."
        : "Required dependency; select an existing compatible boundary.",
      kind: copied ? "boundary" : "host",
      ownership: containerClassification(e).ownership,
      classification: classification as "Application" | "Data store" | "External system",
      hostRoles: binding ? [] : [componentHostRole(e, lookup) as "service"],
      required: !copied,
      create,
      ...(binding &&
        !copied && {
          studio: {
            definition: structuredClone(binding.definition),
            settings: structuredClone(binding.settings),
          },
        }),
      ...(classification === "Data store" && family === "relational-store"
        ? { storeKind: "relational-records" }
        : {}),
    });
  }
  if (studio)
    fragment.architecture.studio = {
      version: 1,
      // Seed origin describes the source project, not a combined destination composition.
      elements: structuredClone(
        studio.elements.filter((binding) => copiedElements.has(binding.element)),
      ),
      packages: structuredClone(studio.packages.filter((item) => copiedPackages.has(item.id))),
      connections: structuredClone(
        studio.connections.filter((binding) => keep.has(binding.connection)),
      ),
    };
  for (const c of a.components?.filter((c) => keep.has(c.id)) ?? []) {
    if (copiedComponents.has(c.id) && (c.members.length || c.usesResources.length))
      throw new Error(
        `Component ${c.name} has runtime-owned members. Create a portable planned responsibility with explicit contracts first.`,
      );
    fragment.roles.push({
      id: c.id,
      name: c.name,
      purpose: c.responsibility || "Required architectural responsibility.",
      kind: "component",
      host: c.element,
      hostRoles: [],
      required: !copiedComponents.has(c.id),
    });
  }
  for (const n of a.nodes.filter((n) => keep.has(n.id)))
    fragment.roles.push({
      id: n.id,
      name: n.name,
      purpose: n.description || "Required context role.",
      kind: "context",
      contextKind: n.kind,
      host: n.container,
      hostRoles: [],
      required: true,
    });
  for (const key of fragmentCollections)
    Object.assign(fragment.architecture, {
      [key]: (a[key] ?? [])
        .filter((item) => keep.has(item.id))
        .map((item) => structuredClone(item)),
    });
  if (a.backend)
    fragment.architecture.backend = {
      schemaVersion: a.backend.schemaVersion,
      ...(a.backend.implementations
        ? {
            implementations: a.backend.implementations
              .filter((v) => keep.has(v.id))
              .map((v) => structuredClone(v)),
          }
        : {}),
      entities: a.backend.entities.filter((e) => keep.has(e.id)).map((e) => structuredClone(e)),
      aggregates: a.backend.aggregates.filter((e) => keep.has(e.id)).map((e) => structuredClone(e)),
      ...(a.backend.effects
        ? {
            effects: a.backend.effects.filter((e) => keep.has(e.id)).map((e) => structuredClone(e)),
          }
        : {}),
      ...(a.backend.capabilityConfigs
        ? {
            capabilityConfigs: a.backend.capabilityConfigs
              .filter((c) => keep.has(c.id))
              .map((c) => structuredClone(c)),
          }
        : {}),
      ...(a.backend.hooks
        ? { hooks: a.backend.hooks.filter((h) => keep.has(h.id)).map((h) => structuredClone(h)) }
        : {}),
      ...(a.backend.lifecycles
        ? {
            lifecycles: a.backend.lifecycles
              .filter((l) => keep.has(l.id))
              .map((l) => structuredClone(l)),
          }
        : {}),
      ...(a.backend.operations
        ? {
            operations: a.backend.operations
              .filter((o) => keep.has(o.id))
              .map((o) => structuredClone(o)),
          }
        : {}),
      ...(a.backend.queries
        ? {
            queries: a.backend.queries.filter((q) => keep.has(q.id)).map((q) => structuredClone(q)),
          }
        : {}),
      ...(a.backend.accessPolicies
        ? {
            accessPolicies: a.backend.accessPolicies
              .filter((p) => keep.has(p.id))
              .map((p) => structuredClone(p)),
          }
        : {}),
      ...(a.backend.accessBindings
        ? {
            accessBindings: a.backend.accessBindings
              .filter((b) => keep.has(b.id))
              .map((b) => structuredClone(b)),
          }
        : {}),
    };
  fragment.architecture.components = fragment.architecture.components?.map((c) => ({
    id: c.id,
    name: c.name,
    element: c.element,
    responsibility: c.responsibility,
    capability: c.capability,
    config: portableConfig(c.capability, c.config),
    members: [],
    usesResources: [],
    usesConnections: copiedComponents.has(c.id)
      ? c.usesConnections.filter((id) => keep.has(id))
      : [],
  }));
  fragment.architecture.nodes = fragment.architecture.nodes.map(
    ({ id, kind, name, description, container }) => ({
      id,
      kind,
      name,
      description,
      ...(container ? { container } : {}),
    }),
  );
  fragment.architecture.decisions = fragment.architecture.decisions?.map((d) => ({
    ...d,
    acknowledgements: [],
  }));
  for (const c of fragment.architecture.contracts ?? [])
    if (c.source)
      throw new Error(
        `Contract ${c.name} references project-owned runtime configuration. Supply an explicit portable planned contract before extraction.`,
      );
  fragment.connections = design.connections
    .filter((c) => keep.has(c.id))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      from: { element: c.from.element },
      to: { element: c.to.element },
      planned: {
        label: c.planned?.label ?? c.label ?? "Uses dependency",
        protocol: c.planned?.protocol ?? c.protocol ?? "Unspecified",
        interaction: c.planned?.interaction ?? c.interaction ?? "Request / response",
        security: c.planned?.security ?? "Private network",
      },
    }));
  fragment.invariants = [
    ...new Set(
      (a.patternInstances ?? [])
        .filter((p) =>
          Object.values(p.identities).some(
            (id) => copiedComponents.has(id) || copiedElements.has(id),
          ),
        )
        .flatMap((p) => p.invariants),
    ),
  ];
  fragment.extensionPoints = fragment.roles
    .filter((r) => !r.required)
    .map((r) => ({
      role: r.id,
      description: "Extend through explicit contracts while preserving the published invariants.",
    }));
  const ids = Object.fromEntries(
    fragmentIds(fragment).map((id, i) => [
      id,
      `${id.startsWith("studio-c4b-") ? "studio-c4b-" : ""}r${i + 1}`,
    ]),
  );
  const portable: ArchitectureFragment = {
    ...fragment,
    roles: fragment.roles.map((r) => ({
      ...r,
      id: ids[r.id]!,
      ...(r.host ? { host: ids[r.host]! } : {}),
      ...(r.create ? { create: { ...r.create, id: ids[r.id]! } } : {}),
      ...(r.studio
        ? { studio: { ...r.studio, settings: mapStudioSettings(r.studio.settings, ids) } }
        : {}),
    })),
    architecture: mappedArchitecture(fragment, ids),
    connections: fragment.connections.map((c) => ({
      ...c,
      id: ids[c.id]!,
      from: { element: ids[c.from.element]! },
      to: { element: ids[c.to.element]! },
    })),
    extensionPoints: fragment.extensionPoints.map((p) => ({ ...p, role: ids[p.role]! })),
  };
  const parsed = architectureFragmentSchema.parse(portable);
  return {
    fragment: parsed,
    metadata: libraryMetadataSchema.parse({
      name: identity.name,
      purpose: identity.purpose,
      invariants: parsed.invariants,
      extensionPoints: parsed.extensionPoints,
      exposedOptions: [],
    }),
  };
}

export function libraryOptionChoices(
  entry: Pick<ArchitectureLibraryEntry, "fragment">,
  role: string,
  field: string,
): readonly string[] | undefined {
  const c = entry.fragment.architecture.components?.find((c) => c.id === role);
  if (!c || entry.fragment.roles.find((r) => r.id === role)?.required) return undefined;
  return plannedCapability(c.capability)?.fields.find((f) => f.key === field)?.options;
}
export function previewArchitectureTemplate(
  design: DesignDocument,
  entry: ArchitectureLibraryEntry,
  input: LibraryInsertInput,
  lookup: TemplateLookup,
): PatternPreview {
  const parsed = libraryInsertSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      unfilled: [],
      roles: [],
      relationships: [],
      additions: [],
      ops: [],
      review: [],
      fragment: entry.fragment,
    };
  const req = parsed.data;
  const fragment = structuredClone(entry.fragment);
  if (
    entry.state !== "published" ||
    req.contentHash !== entry.contentHash ||
    req.id !== entry.id ||
    req.version !== entry.version
  )
    throw new Error("Select an available published version with its exact content hash.");
  for (const [key, value] of Object.entries(req.options)) {
    const option = entry.metadata.exposedOptions.find((o) => `${o.role}.${o.field}` === key);
    if (!option || !libraryOptionChoices(entry, option.role, option.field)?.includes(value))
      throw new Error(`Option ${key} is not an exposed finite choice.`);
    fragment.architecture.components!.find((c) => c.id === option.role)!.config[option.field] =
      value;
  }
  const request: PatternRequestInput = {
    pattern: entry.id,
    version: entry.version,
    instanceId: req.instanceId,
    baseRevision: req.baseRevision,
    config: { name: req.name },
    roles: req.roles,
    relationships: req.relationships,
    definitions: req.definitions,
  };
  return previewArchitecturePattern(design, request, lookup, {
    fragment,
    contentHash: entry.contentHash,
    options: req.options,
  });
}
export function libraryContent(entry: Pick<ArchitectureLibraryEntry, "fragment" | "metadata">) {
  return contractCanonical({ fragment: entry.fragment, metadata: entry.metadata });
}
