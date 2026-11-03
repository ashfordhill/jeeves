/** Portable review evidence, never a generated design, executable lock or task plan. */
import { z } from "zod";
import { type ArchitectureComponent, architectureSchema } from "./architecture.ts";
import { containerClassification } from "./architecture-choices.ts";
import {
  contractCanonical,
  contractKey,
  contractSourceSchema,
  resolveContractSource,
} from "./architecture-contracts.ts";
import { handoffScopeSchema } from "./architecture-handoff-model.ts";
import type { ArchitectureLibraryEntry } from "./architecture-library.ts";
import { describeArchitecturePattern } from "./architecture-patterns.ts";
import { reviewArchitecture } from "./architecture-review.ts";
import { type ArchitectureProvision, architectureViews } from "./architecture-view.ts";
import { backendCapabilityDescriptorSchema } from "./backend-implementation-model.ts";
import { implementationKey } from "./backend-implementations.ts";
import {
  backendImplementationReportSchema,
  matchBackendImplementations,
} from "./backend-support.ts";
import { exportContractJsonSchema } from "./contract-json-schema.ts";
import type { DesignDocument } from "./design.ts";
import type { ArchitectureEvidence } from "./evidence.ts";
import { isStructural } from "./findings.ts";
import { templateRefSchema } from "./ids.ts";
import type { TemplateLookup } from "./manifest.ts";
import { plannedCapability } from "./planned-capabilities.ts";
import { connectionPresentation } from "./relationship-display.ts";
import { scenarioPaths, scenarioReview } from "./scenarios.ts";
import { validateDesign } from "./validate.ts";

const json = z.json();
const boxSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export const handoffDiagramSchema = z.strictObject({
  view: z.string(),
  title: z.string(),
  scenario: z.strictObject({ id: z.string(), name: z.string(), path: z.string() }).optional(),
  layoutFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  nodes: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      technology: z.string(),
      support: z.string(),
      responsibilities: z.array(z.strictObject({ id: z.string(), name: z.string() })).optional(),
      box: boxSchema,
    }),
  ),
  edges: z.array(
    z.strictObject({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      description: z.string(),
      protocol: z.string().optional(),
      planned: z.boolean(),
      line: z.enum(["solid", "dashed", "dotted"]),
      dash: z.array(z.number().nonnegative()).max(10),
      steps: z.array(z.int().positive()).optional(),
      path: z.string().regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/),
      label: boxSchema.optional(),
      bounds: boxSchema.optional(),
    }),
  ),
  groups: z.array(z.strictObject({ name: z.string(), box: boxSchema })),
});
export type HandoffDiagram = z.output<typeof handoffDiagramSchema>;
const openItemSchema = z.strictObject({
  kind: z.enum(["decision", "objective", "finding", "scenario", "structure", "scope"]),
  id: z.string(),
  message: z.string(),
  critical: z.boolean(),
  owner: z.string().optional(),
  blocks: z.string().optional(),
});
const coverageSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  category: z.enum(["executable", "recipe", "planned", "custom", "external"]),
  version: z.string().optional(),
  available: z.boolean(),
  boundary: z.string(),
  behavior: z.array(z.string()),
});
export const architectureHandoffSchema = z
  .strictObject({
    schema: z.literal("jeeves.architecture-handoff"),
    schemaVersion: z.literal(1),
    project: z.strictObject({ id: z.string(), name: z.string(), revision: z.int().nonnegative() }),
    designFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    scope: handoffScopeSchema.optional(),
    provenance: json.optional(),
    status: z.enum(["Needs review", "Blocked", "Stale", "Ready for implementation review"]),
    limitation: z.string(),
    containers: z.array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        classification: z.string(),
        description: z.string(),
        technology: z.string(),
        planning: z.record(z.string(), json),
        planned: z.string().optional(),
        template: z.strictObject({ id: z.string(), version: z.string() }).optional(),
        attachments: z.array(
          z.strictObject({
            id: z.string(),
            template: z.strictObject({ id: z.string(), version: z.string() }),
          }),
        ),
      }),
    ),
    connections: z.array(
      z.strictObject({
        id: z.string(),
        from: z.string(),
        to: z.string(),
        description: z.string(),
        protocol: z.string().optional(),
        planned: z.boolean(),
      }),
    ),
    intent: architectureSchema.omit({ contracts: true, implementationHandoff: true }),
    contracts: z.array(
      z.strictObject({
        id: z.string(),
        version: z.string(),
        name: z.string(),
        kind: z.enum(["api", "in-process", "event", "data"]),
        description: z.string(),
        source: contractSourceSchema.optional(),
        coverage: z.enum(["Unspecified", "Partial", "Complete"]).optional(),
        sourceRevision: z.number().optional(),
        status: z.enum(["resolved", "unavailable", "stale"]),
        definition: json.optional(),
        jsonSchema: json.optional(),
        schemaIssues: z
          .array(
            z.strictObject({
              code: z.string(),
              path: z.array(z.union([z.string(), z.number()])),
              message: z.string(),
            }),
          )
          .optional(),
      }),
    ),
    implementationSupport: backendImplementationReportSchema.optional(),
    implementationDescriptors: z
      .array(
        z.strictObject({
          template: templateRefSchema,
          descriptor: backendCapabilityDescriptorSchema,
        }),
      )
      .optional(),
    manifests: z.array(
      z.strictObject({
        instance: z.string(),
        id: z.string(),
        version: z.string(),
        contentHash: z.string().optional(),
        status: z.enum(["resolved", "unavailable"]),
        definition: json.optional(),
      }),
    ),
    coverage: z.array(coverageSchema),
    openItems: z.array(openItemSchema),
    obligations: z.array(
      z.strictObject({
        id: z.string(),
        responsibility: z.string(),
        container: z.string(),
        contracts: z.array(z.string()),
        bindings: z.array(z.string()),
        expectations: z.array(
          z.strictObject({
            kind: z.enum(["scenario", "pattern"]),
            source: z.string(),
            id: z.string(),
            text: z.string(),
            invariants: z.array(z.string()),
          }),
        ),
        acceptanceIds: z.array(z.string()),
        gaps: z.array(z.string()),
      }),
    ),
    completeness: z.strictObject({
      interfaces: z.number(),
      boundRequired: z.number(),
      required: z.number(),
      scenarios: z.array(
        z.strictObject({ id: z.string(), status: z.string(), incomplete: z.array(z.string()) }),
      ),
    }),
    evidence: z.strictObject({
      projectId: z.string(),
      revision: z.number(),
      environment: z.enum(["recorded local output", "unrecorded"]),
      environmentFingerprint: z.string().optional(),
      generation: json.nullable(),
      run: json.nullable(),
      applicability: z.literal(
        "Only the recorded project, revision and environment; no inherited passes or production certification.",
      ),
    }),
    diagram: handoffDiagramSchema.optional(),
  })
  .superRefine((snapshot, ctx) => {
    if (
      snapshot.status === "Ready for implementation review" &&
      (!snapshot.scope?.review ||
        snapshot.scope.review.fingerprint !== snapshot.designFingerprint ||
        snapshot.openItems.some(
          (i) => i.critical || (!i.owner && ["decision", "objective"].includes(i.kind)),
        ))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Ready status needs current approval and no critical or unassigned open decisions.",
      });
  });
export type ArchitectureHandoff = z.output<typeof architectureHandoffSchema>;

export async function handoffHash(value: unknown) {
  const bytes = new TextEncoder().encode(contractCanonical(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Full semantic inputs invalidate review; revision, approval and all layout/cameras do not. */
export async function handoffFingerprint(
  design: DesignDocument,
  project: { id: string; name: string },
) {
  const { revision: _revision, ...semantic } = design;
  const copy = structuredClone(semantic);
  if (copy.architecture?.implementationHandoff)
    delete copy.architecture.implementationHandoff.review;
  return handoffHash({ project: { id: project.id, name: project.name }, design: copy });
}
/** Bounded snapshots omit opaque config, example values, credentials and local output locations. */
export function sanitizeHandoff(value: unknown): z.infer<typeof json> {
  return JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (
        /^(config|notes|sourceSnapshot|outputDir|pathOnDisk|env|examples?|default|exampleValue)$/i.test(
          key,
        )
      )
        return undefined;
      if (
        /^(password|secret|token|apiKey|credentials)$/i.test(key) &&
        (!item || typeof item !== "object" || !("type" in item))
      )
        return undefined;
      if (
        typeof item === "string" &&
        /^(?:\/home\/|\/Users\/|\/tmp\/|\/var\/|file:\/\/|[A-Za-z]:\\)/.test(item)
      )
        return "[local path omitted]";
      return item;
    }),
  );
}
const portablePlanning = (capability: string | undefined, config: Record<string, unknown>) =>
  sanitizeHandoff(
    Object.fromEntries(
      (plannedCapability(capability)?.fields ?? []).flatMap((f) => {
        const value = config[f.key];
        return value !== undefined &&
          (f.options ? f.options.includes(String(value)) : typeof f.default === typeof value)
          ? [[f.key, value]]
          : [];
      }),
    ),
  ) as Record<string, z.infer<typeof json>>;
const portableComponent = (c: ArchitectureComponent) => ({
  ...c,
  config: portablePlanning(c.capability, c.config),
});

export async function buildArchitectureHandoff(input: {
  design: DesignDocument;
  project: { id: string; name: string };
  lookup: TemplateLookup;
  evidence?: ArchitectureEvidence;
  provision?: ArchitectureProvision;
  library?: ArchitectureLibraryEntry[];
  origin?: { sourceProjectId: string; sourceRevision: number; recipeMode: string };
}): Promise<ArchitectureHandoff> {
  const { design, project, lookup, provision } = input;
  const a =
    design.architecture ??
    architectureSchema.parse({ system: { name: project.name, description: "" } });
  const report = reviewArchitecture(design);
  const fingerprint = await handoffFingerprint(design, project);
  const scope = a.implementationHandoff;
  const openItems: z.infer<typeof openItemSchema>[] = [];
  const open = (
    kind: z.infer<typeof openItemSchema>["kind"],
    id: string,
    message: string,
    critical: boolean,
  ) => {
    const assignment = scope?.assignments.find((r) => r.kind === kind && r.id === id);
    openItems.push({
      kind,
      id,
      message,
      critical,
      ...(assignment && { owner: assignment.owner, blocks: assignment.blocks }),
    });
  };
  for (const f of validateDesign(design, lookup).filter(isStructural))
    open(
      "structure",
      `${f.code}:${f.target.path?.join("/") ?? f.target.element ?? "system"}`,
      f.message,
      true,
    );
  if (!design.architecture || !a.system.description.trim() || !design.elements.length)
    open("scope", "system", "Describe the system and its responsibilities.", true);
  if (!scope) open("scope", "scope", "Define the implementation review scope.", true);
  for (const f of report.findings.filter((f) => f.code !== "UNDECIDED_OBJECTIVE"))
    open(
      "finding",
      f.id,
      `${f.code}: ${f.message}`,
      f.concern !== "Objectives" || f.severity === "conflict",
    );
  for (const d of a.decisions?.filter((d) => d.status === "Unresolved") ?? [])
    open(
      "decision",
      d.id,
      `${d.name}: ${d.context} ${d.consequence}`,
      d.links.some((r) => !["system", "objective"].includes(r.kind)),
    );
  for (const o of a.objectives ?? [])
    if (o.value === undefined || !o.unit || !o.boundary || !o.window)
      open("objective", o.id, `${o.name}: incomplete unverified runtime target.`, false);
  // Open capacity/commercial choices can be assigned outside an explicitly approved partial scope.
  for (const item of openItems)
    if (!item.critical && item.kind !== "scenario") {
      if (!item.owner || !item.blocks || !scope?.partial || !scope.excludedScope.trim())
        item.critical = true;
    }
  const scenarios = (a.scenarios ?? []).map((s) => ({ id: s.id, ...scenarioReview(design, s) }));
  for (const s of scenarios)
    if (s.incomplete.length) open("scenario", s.id, s.incomplete.join(" "), true);
  const contracts = (a.contracts ?? []).map((c) => {
    const definition = c.source ? resolveContractSource(design, c.source) : c.shape;
    const exported = c.shape ? exportContractJsonSchema(c) : undefined;
    return {
      id: c.id,
      version: c.version,
      name: c.name,
      kind: c.kind,
      description: c.description,
      ...(c.coverage && { coverage: c.coverage }),
      ...(c.source && { source: c.source, sourceRevision: c.sourceDesignRevision }),
      status:
        definition === undefined
          ? ("unavailable" as const)
          : c.source && contractCanonical(definition) !== c.sourceSnapshot
            ? ("stale" as const)
            : ("resolved" as const),
      // Typed planned shapes contain no opaque runtime config. Preserve semantic field names,
      // route paths and literal values, including names that a generic config scrubber redacts.
      ...(definition !== undefined && {
        definition: c.shape
          ? json.parse(JSON.parse(JSON.stringify(definition)))
          : sanitizeHandoff(definition),
      }),
      ...(exported?.ok
        ? { jsonSchema: json.parse(exported.schema) }
        : exported
          ? { schemaIssues: exported.issues }
          : {}),
    };
  });
  const manifests = (a.patternInstances ?? []).map((p) => {
    let definition: unknown;
    if (p.libraryContentHash) {
      const entry = input.library?.find(
        (e) =>
          e.id === p.pattern && e.version === p.version && e.contentHash === p.libraryContentHash,
      );
      if (entry)
        definition = {
          fragment: entry.fragment,
          metadata: entry.metadata,
          availability: entry.availability,
        };
    } else {
      try {
        const f = describeArchitecturePattern(p.pattern, p.variant, p.config);
        if (f.version === p.version) definition = f;
      } catch {
        /* Unavailable is explicit; no remote lookup. */
      }
    }
    return {
      instance: p.id,
      id: p.pattern,
      version: p.version,
      ...(p.libraryContentHash && { contentHash: p.libraryContentHash }),
      status: definition ? ("resolved" as const) : ("unavailable" as const),
      ...(definition !== undefined && { definition: sanitizeHandoff(definition) }),
    };
  });
  const coverage: z.infer<typeof coverageSchema>[] = [];
  for (const e of design.elements) {
    for (const member of [e, ...e.attachments])
      if (member.template)
        coverage.push({
          id: member.id,
          name: "name" in member ? member.name : member.template.id,
          category: "executable",
          version: member.template.version,
          available: !!lookup.get(member.template),
          boundary: `${member.template.id}@${member.template.version}`,
          behavior: [
            lookup.get(member.template)?.description ??
              "Definition unavailable; no supplied behavior claimed.",
          ],
        });
    if (e.planned)
      coverage.push({
        id: e.id,
        name: e.name,
        category: containerClassification(e).kind === "External system" ? "external" : "planned",
        available: false,
        boundary: e.planned,
        behavior: [plannedCapability(e.planned)?.description ?? "Definition unavailable"],
      });
  }
  for (const c of a.components ?? [])
    if (c.capability)
      coverage.push({
        id: c.id,
        name: c.name,
        category: "planned",
        available: false,
        boundary: c.capability,
        behavior: [c.responsibility],
      });
  if (provision)
    coverage.push({
      id: provision.id,
      name: provision.id,
      category: "recipe",
      version: provision.version,
      available: true,
      boundary: "Validated recipe provision only",
      behavior: [
        ...Object.entries(provision.operations).flatMap(([owner, ops]) =>
          ops.map((op) => `${owner}:${op}`),
        ),
        ...provision.frontends.map((id) => `frontend:${id}`),
      ],
    });
  const views = architectureViews(design, lookup, project.name, provision);
  const obligations: ArchitectureHandoff["obligations"] = [];
  const responsibilities = [
    ...views.containers.nodes,
    ...views.components.flatMap((view) =>
      view.nodes.flatMap((n) => (n.members?.length ? [n, ...n.members] : [n])),
    ),
  ];
  const seenResponsibilities = new Set<string>();
  for (const n of responsibilities) {
    const host = design.elements.find((e) => e.id === n.binding?.element);
    if (
      seenResponsibilities.has(n.id) ||
      !["planned", "extension", "intent", "mixed"].includes(n.support) ||
      !n.binding ||
      !host ||
      containerClassification(host).kind === "External system"
    )
      continue;
    seenResponsibilities.add(n.id);
    const owner = n.binding.component ?? n.binding.element;
    const owners = new Set([
      owner,
      ...(n.kind === "container"
        ? (a.components ?? []).filter((c) => c.element === host.id).map((c) => c.id)
        : []),
    ]);
    const interfaces = (a.interfaces ?? []).filter((i) => owners.has(i.owner.id));
    const bindings = (a.bindings ?? []).filter((b) =>
      interfaces.some((i) => i.id === b.provided || i.id === b.required),
    );
    const expectations: ArchitectureHandoff["obligations"][number]["expectations"] = [];
    const touches = (r: { kind: string; id: string }) =>
      owners.has(r.id) ||
      bindings.some((b) => b.id === r.id) ||
      interfaces.some((i) => i.id === r.id || contractKey(i.contract) === r.id);
    for (const scenario of a.scenarios ?? []) {
      const direct = scenarioPaths(scenario).some((path) =>
        path.steps.some(
          (step) =>
            (step.binding && bindings.some((b) => b.id === step.binding)) ||
            bindings.some((b) => b.relationship.id === step.relationship.id) ||
            (step.client && owners.has(step.client.component)),
        ),
      );
      for (const outcome of scenario.outcomes ?? []) {
        const linked =
          outcome.decisions.some((id) =>
            a.decisions?.find((d) => d.id === id)?.links.some(touches),
          ) ||
          outcome.requirements.some((id) => {
            const requirement = a.reviewRequirements?.find((r) => r.id === id);
            return (
              requirement &&
              ((requirement.binding && bindings.some((b) => b.id === requirement.binding)) ||
                (requirement.kind === "delivery" &&
                  requirement.responsible &&
                  owners.has(requirement.responsible.id)))
            );
          });
        if (direct || linked)
          expectations.push({
            kind: "scenario",
            source: scenario.id,
            id: outcome.id,
            text: outcome.text,
            invariants: outcome.invariants,
          });
      }
    }
    if (!expectations.length)
      for (const pattern of a.patternInstances ?? []) {
        if (!Object.values(pattern.identities).some((id) => owners.has(id))) continue;
        pattern.invariants.forEach((text, index) => {
          expectations.push({
            kind: "pattern",
            source: pattern.id,
            id: `invariant-${index + 1}`,
            text,
            invariants: [text],
          });
        });
      }
    obligations.push({
      id: n.id,
      responsibility: n.description || n.name,
      container: n.binding.element,
      contracts: [...new Set(interfaces.map((i) => contractKey(i.contract)))],
      bindings: bindings.map((b) => b.id),
      expectations,
      acceptanceIds: n.acceptance,
      gaps: [
        ...(!interfaces.length
          ? ["No authored contract boundary; define before implementation."]
          : []),
        ...(!expectations.length && !n.acceptance.length
          ? ["No linked acceptance expectations; define before implementation."]
          : []),
      ],
    });
    coverage.push({
      id: n.id,
      name: n.name,
      category: "custom",
      available: false,
      boundary:
        interfaces.map((i) => contractKey(i.contract)).join(", ") || "Unassigned contract boundary",
      behavior: [n.description || n.name],
    });
  }
  for (const obligation of obligations)
    for (const gap of obligation.gaps)
      open(
        "finding",
        `obligation:${obligation.id}:${gap.startsWith("No authored") ? "contract" : "acceptance"}`,
        gap,
        true,
      );
  const { contracts: _contracts, implementationHandoff: _handoff, ...intent } = a;
  const evidence = input.evidence;
  const required =
    a.interfaces?.filter((i) => i.direction === "required" && i.necessity === "required") ?? [];
  const blocked = openItems.some((i) => i.critical);
  const stale = !!scope?.review && scope.review.fingerprint !== fingerprint;
  return architectureHandoffSchema.parse({
    schema: "jeeves.architecture-handoff",
    schemaVersion: 1,
    project: { id: project.id, name: project.name, revision: design.revision },
    designFingerprint: fingerprint,
    scope,
    provenance: sanitizeHandoff({
      ...(input.origin && { target: input.origin }),
      ...(design.startedFrom && { starter: design.startedFrom }),
      ...(design.recipe && { recipe: { id: design.recipe.id, version: design.recipe.version } }),
    }),
    status: stale
      ? "Stale"
      : blocked
        ? "Blocked"
        : scope?.review
          ? "Ready for implementation review"
          : "Needs review",
    limitation:
      "Architecture intent and implementation review only. Objectives are unverified targets. Approval of partial scope never activates partial generation. No runtime verification is inherited from patterns, templates or source projects.",
    containers: design.elements.map((e) => ({
      id: e.id,
      name: e.name,
      classification: containerClassification(e).kind,
      description: e.description ?? "",
      technology: e.technology ?? "",
      planning: portablePlanning(e.planned, e.config),
      planned: e.planned,
      template: e.template ?? undefined,
      attachments: e.attachments.map((m) => ({ id: m.id, template: m.template })),
    })),
    connections: design.connections.map((c) => ({
      id: c.id,
      from: c.from.element,
      to: c.to.element,
      description: connectionPresentation(c, design).description,
      protocol: connectionPresentation(c, design).protocol,
      planned: !!c.planned,
    })),
    intent: { ...intent, components: intent.components?.map(portableComponent) },
    contracts,
    manifests,
    ...(a.backend
      ? {
          implementationSupport: matchBackendImplementations(design, lookup),
          implementationDescriptors: (a.backend.implementations ?? []).flatMap((b) => {
            const descriptor = lookup
              .get(b.template)
              ?.capabilities?.find((c) => contractKey(c) === contractKey(b.capability));
            return descriptor ? [{ template: b.template, descriptor }] : [];
          }),
        }
      : {}),
    coverage,
    openItems,
    obligations,
    completeness: {
      interfaces: a.interfaces?.length ?? 0,
      required: required.length,
      boundRequired: required.filter((i) => a.bindings?.some((b) => b.required === i.id)).length,
      scenarios: scenarios.map(({ fingerprint: _fingerprint, ...s }) => s),
    },
    evidence: {
      projectId: evidence?.projectId ?? project.id,
      revision: evidence?.revision ?? design.revision,
      environment: evidence?.outputDir ? "recorded local output" : "unrecorded",
      ...(evidence?.outputDir && {
        environmentFingerprint: await handoffHash({
          project: evidence.projectId,
          output: evidence.outputDir,
        }),
      }),
      generation: evidence?.generation
        ? {
            ...(sanitizeHandoff(evidence.generation) as Record<string, z.infer<typeof json>>),
            environmentFingerprint: await handoffHash({
              project: evidence.projectId,
              output: evidence.generation.outputDir,
            }),
          }
        : null,
      run: evidence?.run
        ? {
            ...(sanitizeHandoff(evidence.run) as Record<string, z.infer<typeof json>>),
            environmentFingerprint: await handoffHash({
              project: evidence.projectId,
              output: evidence.run.outputDir,
            }),
          }
        : null,
      applicability:
        "Only the recorded project, revision and environment; no inherited passes or production certification.",
    },
  });
}

export const handoffJson = (snapshot: ArchitectureHandoff) =>
  `${JSON.stringify(architectureHandoffSchema.parse(snapshot), null, 2)}\n`;
const mdEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("[", "&#91;")
    .replaceAll("]", "&#93;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;")
    .replaceAll("\n", " ");
export function handoffMarkdown(snapshot: ArchitectureHandoff) {
  const s = architectureHandoffSchema.parse(snapshot);
  const lines = [
    `# ${mdEscape(s.intent.system.name)} — implementation brief`,
    "",
    `Schema: ${s.schema} v${s.schemaVersion}. Project: ${s.project.id}. Revision: ${s.project.revision}.`,
    "",
    `Design fingerprint: ${s.designFingerprint}`,
    "",
    `**${s.status}**`,
    "",
    mdEscape(s.limitation),
    "Portable definitions omit opaque runtime configuration, local output paths and source example/default values. Typed contract fields, literals and HTTP routes stay exact. Pinned source hashes identify the original manifests, before sanitization.",
    "",
    "[Portable definitions and exact identities](./architecture-handoff.json)",
    ...(s.diagram
      ? [
          "",
          "[Selected diagram](./architecture-diagram.svg)",
          "",
          `View: ${mdEscape(s.diagram.title)}. Layout fingerprint: ${s.diagram.layoutFingerprint}.`,
        ]
      : []),
  ];
  const section = (id: string, title: string, body: string[]) =>
    lines.push("", `<a id="${id}"></a>`, `## ${title}`, "", ...body);
  section("scope", "Scope and actors", [
    mdEscape(s.scope?.description ?? "Unassigned scope"),
    mdEscape(s.intent.system.description),
    ...s.intent.nodes.map(
      (n) => `- ${mdEscape(n.id)}: ${mdEscape(n.name)} — ${mdEscape(n.description)}`,
    ),
    ...(s.scope?.partial
      ? [
          `Excluded scope: ${mdEscape(s.scope.excludedScope)}`,
          `Explicit approval: ${mdEscape(s.scope.review?.approval ?? "Not approved")}`,
        ]
      : []),
  ]);
  section("coverage", "Implementation coverage", [
    "| Identity | Category | Version | Available | Boundary | Behavior |",
    "| --- | --- | --- | --- | --- | --- |",
    ...s.coverage.map(
      (r) =>
        `| ${mdEscape(r.id)} | ${r.category} | ${r.version ?? "—"} | ${r.available ? "yes" : "no"} | ${mdEscape(r.boundary)} | ${mdEscape(r.behavior.join("; "))} |`,
    ),
  ]);
  section("responsibilities", "C2 and C3 responsibilities", [
    ...s.containers.map(
      (c) =>
        `- ${mdEscape(c.id)}: ${mdEscape(c.name)} (${mdEscape(c.classification)}) — ${mdEscape(c.description)}`,
    ),
    ...(s.intent.components ?? []).map(
      (c) =>
        `- ${mdEscape(c.id)} inside ${mdEscape(c.element)}: ${mdEscape(c.name)} — ${mdEscape(c.responsibility)}`,
    ),
  ]);
  section("relationships", "Authored relationships", [
    ...s.intent.relationships.map(
      (r) =>
        `- C1 ${mdEscape(r.id)}: ${mdEscape(r.from)} → ${mdEscape(r.to)} — ${mdEscape(r.description)}; container ${r.container ?? "unbound context"}.`,
    ),
    ...s.connections.map(
      (r) =>
        `- C2 ${mdEscape(r.id)}: ${mdEscape(r.from)} → ${mdEscape(r.to)} — ${mdEscape(r.description)}; ${mdEscape(r.protocol ?? "protocol unspecified")}${r.planned ? "; planned" : ""}.`,
    ),
    ...(s.intent.componentRelationships ?? []).map(
      (r) =>
        `- C3 ${mdEscape(r.id)}: ${mdEscape(r.from)} → ${mdEscape(r.to)} — ${mdEscape(r.description)}; ${r.protocol ?? "protocol unspecified"}.`,
    ),
  ]);
  section("contracts", "Contracts, interfaces and bindings", [
    ...s.contracts.map(
      (c) =>
        `- ${mdEscape(contractKey(c))}: ${mdEscape(c.name)} (${c.kind}, ${c.status}; coverage ${c.coverage ?? "Unspecified"}); definition, behavior and outcomes in [JSON](./architecture-handoff.json).`,
    ),
    ...(s.intent.interfaces ?? []).map(
      (i) =>
        `- ${mdEscape(i.id)}: ${i.direction}/${i.necessity}, owner ${mdEscape(i.owner.id)}, ${mdEscape(contractKey(i.contract))}`,
    ),
    ...(s.intent.bindings ?? []).map(
      (b) =>
        `- ${mdEscape(b.id)}: ${mdEscape(b.name)}, ${mdEscape(b.provided)} → ${mdEscape(b.required)}, ${mdEscape(contractKey(b.contract))}, ${mdEscape(b.relationship.id)}; ${b.role}/${b.businessSynchrony}; operation ${b.operation ?? "whole contract"}; transport ${mdEscape(b.transport ?? "unspecified")}. Policies: ${mdEscape(contractCanonical(b.policies ?? {}))}`,
    ),
  ]);
  section("data", "Data ownership, policies and unverified objectives", [
    ...(s.intent.reviewRequirements ?? []).map(
      (r) => `- Requirement ${mdEscape(r.id)}: ${mdEscape(contractCanonical(r))}`,
    ),
    ...(s.intent.datasets ?? []).map(
      (d) =>
        `- ${mdEscape(d.id)}: ${mdEscape(d.name)}, authority ${mdEscape(d.owners.map((o) => o.id).join(", "))}, store ${d.store ?? "unassigned"}, ${mdEscape(contractKey(d.contract))}; ${mdEscape(contractCanonical(d))}`,
    ),
    ...(s.intent.objectives ?? []).map(
      (o) =>
        `- ${mdEscape(o.id)}: ${mdEscape(o.name)} — UNVERIFIED TARGET ${o.value ?? "undecided"} ${o.unit ?? ""}; ${mdEscape(o.boundary)}; ${mdEscape(o.window)}`,
    ),
  ]);
  section(
    "scenarios",
    "Scenarios and acceptance expectations",
    (s.intent.scenarios ?? []).flatMap((scenario) => [
      `### ${mdEscape(scenario.id)}: ${mdEscape(scenario.name)}`,
      "",
      `Actor: ${scenario.actor ?? "unassigned"}. Start: ${mdEscape(scenario.startCondition ?? "unassigned")}. Review: ${s.completeness.scenarios.find((r) => r.id === scenario.id)?.status}.`,
      ...scenarioPaths(scenario).flatMap((path) => [
        `- ${mdEscape(path.name)}`,
        ...path.steps.map(
          (step) =>
            `  - ${mdEscape(step.id)}: ${mdEscape(step.text)} (${mdEscape(step.relationship.id)}, binding ${step.binding ?? "not specified"})`,
        ),
      ]),
      ...(scenario.outcomes ?? []).map(
        (o) =>
          `- Expected ${mdEscape(o.id)}: ${mdEscape(o.text)}; invariants: ${mdEscape(o.invariants.join("; "))}; decisions ${o.decisions.join(", ")}; requirements ${o.requirements.join(", ")}`,
      ),
    ]),
  );
  section("decisions", "Decisions and unresolved work", [
    ...(s.intent.decisions ?? []).map(
      (d) =>
        `- ${mdEscape(d.id)} (${d.status}): ${mdEscape(d.name)} — ${mdEscape(d.context)} Decision: ${mdEscape(d.decision)} Consequence: ${mdEscape(d.consequence)} Links: ${mdEscape(d.links.map((r) => `${r.kind}:${r.id}`).join(", "))}`,
    ),
    ...s.openItems.map(
      (i) =>
        `- ${mdEscape(i.kind)}:${mdEscape(i.id)} — ${i.critical ? "BLOCKS REVIEW" : "outside approved scope"}: ${mdEscape(i.message)} Owner: ${mdEscape(i.owner ?? "unassigned")}. Blocks: ${mdEscape(i.blocks ?? "unassigned scope")}.`,
    ),
  ]);
  section(
    "obligations",
    "Missing implementation responsibilities",
    s.obligations.flatMap((o) => [
      `- ${mdEscape(o.id)} inside ${mdEscape(o.container)}: ${mdEscape(o.responsibility)}`,
      `  - Contract boundaries: ${mdEscape(o.contracts.join(", ") || "unassigned")}; bindings: ${mdEscape(o.bindings.join(", ") || "unassigned")}.`,
      `  - Acceptance IDs: ${mdEscape(o.acceptanceIds.join(", ") || "none")}; expectations: ${mdEscape(o.expectations.map((e) => `${e.kind}:${e.source}/${e.id}: ${e.text}`).join("; ") || "missing")}.`,
      ...o.gaps.map((g) => `  - OPEN: ${mdEscape(g)}`),
    ]),
  );
  if (s.implementationSupport)
    section("implementation-support", "Declared implementation support", [
      s.implementationSupport.limitation,
      `Foundation: ${s.implementationSupport.foundationReady ? "ready" : "blocked"}; full support: ${s.implementationSupport.fullReady ? "declared" : "blocked"}. No observed evidence is inferred.`,
      ...s.implementationSupport.obligations.map(
        (o) =>
          `${implementationKey(o.obligation)}: ${o.status}; ${o.template ?? "unselected"}/${o.capability ?? "unselected"}. ${o.reasons.map((r) => r.message).join(" ")} Expected evidence packs: ${o.evidencePackIds.join(", ") || "none"}.`,
      ),
    ]);
  if (s.intent.backend)
    section("backend", "Backend data and consistency intent", [
      "These are versioned design declarations; storage, locking and invariants have no supplied runtime or observed verification.",
      ...s.intent.backend.entities.map(
        (e) =>
          `- Entity ${mdEscape(contractKey(e))}: ${mdEscape(e.name)}; dataset ${mdEscape(e.dataset)}, exact contract ${mdEscape(contractKey(e.contract))}; ${mdEscape(contractCanonical(e))}`,
      ),
      ...s.intent.backend.aggregates.map(
        (a) =>
          `- Aggregate ${mdEscape(contractKey(a))}: ${mdEscape(a.name)}; owner ${mdEscape(a.owner.id)}, store ${mdEscape(a.store)}; ${mdEscape(contractCanonical(a))}`,
      ),
      ...(s.intent.backend.queries ?? []).map(
        (q) =>
          `- Query ${mdEscape(contractKey(q))}: ${mdEscape(q.name)}; root ${mdEscape(contractKey(q.root))}; ${mdEscape(contractCanonical(q))}`,
      ),
      ...(s.intent.backend.accessPolicies ?? []).map(
        (p) =>
          `- Access policy ${mdEscape(contractKey(p))}: ${mdEscape(p.name)}; ${mdEscape(contractCanonical(p))}`,
      ),
      ...(s.intent.backend.lifecycles ?? []).map(
        (l) =>
          `- Lifecycle ${mdEscape(contractKey(l))}: ${mdEscape(l.name)}; ${mdEscape(contractCanonical(l))}`,
      ),
      ...(s.intent.backend.operations ?? []).map(
        (o) =>
          `- Operation behavior ${mdEscape(contractKey(o))}: ${mdEscape(o.name)}; ${mdEscape(contractCanonical(o))}`,
      ),
      ...(s.intent.backend.effects ?? []).map(
        (e) =>
          `- Effect ${mdEscape(contractKey(e))}: ${mdEscape(e.name)}; ${mdEscape(contractCanonical(e))}`,
      ),
      ...(s.intent.backend.capabilityConfigs ?? []).map(
        (v) => `Capability configuration ${v.id}@${v.version}: ${contractCanonical(v)}`,
      ),
      ...(s.intent.backend.hooks ?? []).map(
        (h) =>
          `- Hook ${mdEscape(contractKey(h))}: ${mdEscape(h.name)}; ${mdEscape(contractCanonical(h))}`,
      ),
      ...(s.intent.backend.accessBindings ?? []).map(
        (b) =>
          `- Access binding ${mdEscape(contractKey(b))}: ${mdEscape(b.name)}; ${mdEscape(contractCanonical(b))}`,
      ),
    ]);
  section("deployment", "Deployment intent and reusable provenance", [
    ...(s.intent.deployments ?? []).map(
      (d) =>
        `- ${mdEscape(d.id)}: ${mdEscape(d.name)} (${d.kind}) — ${mdEscape(d.description)}. Exact placement: [JSON](./architecture-handoff.json).`,
    ),
    ...s.manifests.map(
      (m) =>
        `- ${mdEscape(m.instance)}: ${mdEscape(m.id)}@${m.version} (${m.status})${m.contentHash ? ` content ${m.contentHash}` : ""}; editable architecture only, no inherited passes.`,
    ),
  ]);
  section("evidence", "Recorded evidence", [
    mdEscape(s.evidence.applicability),
    `Project ${s.evidence.projectId}; revision ${s.evidence.revision}; environment ${s.evidence.environment}${s.evidence.environmentFingerprint ? ` ${s.evidence.environmentFingerprint}` : ""}.`,
    "Infrastructure, template and application check results retain their recorded identities in [JSON](./architecture-handoff.json).",
    `Required interfaces: ${s.completeness.boundRequired}/${s.completeness.required} bound.`,
  ]);
  return `${lines.join("\n")}\n`;
}
