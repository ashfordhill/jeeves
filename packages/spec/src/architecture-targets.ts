/** Planning copies retain a frozen source, never runtime ownership or verification. */
import { z } from "zod";
import { type Architecture, type ArchitectureMember, architectureSchema } from "./architecture.ts";
import { backendCollections, backendDeclarations } from "./backend-model.ts";
import { type DesignDocument, designIds, designSchema, upgradeDesign } from "./design.ts";
import { resourceConfigSchema } from "./resources.ts";

export const targetOriginSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sourceProjectId: z.uuid(),
  sourceProjectName: z.string(),
  sourceRevision: z.int().nonnegative(),
  capturedAt: z.iso.datetime(),
  baseline: designSchema,
  recipeMode: z.enum(["protected-copy", "conceptual-replacement"]),
  reason: z.string().trim().min(1).max(1200).optional(),
});
export type TargetOrigin = z.infer<typeof targetOriginSchema>;
export const createTargetSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    baseRevision: z.int().nonnegative(),
    recipeMode: z.enum(["protected-copy", "conceptual-replacement"]).default("protected-copy"),
    reason: z.string().trim().min(1).max(1200).optional(),
  })
  .refine((v) => v.recipeMode !== "conceptual-replacement" || !!v.reason, {
    message: "Record why this conceptual replacement is needed.",
    path: ["reason"],
  });
export type CreateTarget = z.infer<typeof createTargetSchema>;
export type TargetChange = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
};
const canonical = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
/** Object identities survive the copy. Revisions, ordering and layout are not semantic changes. */
export function targetChanges(baseline: DesignDocument, target: DesignDocument): TargetChange[] {
  const a = upgradeDesign(baseline),
    b = upgradeDesign(target);
  const changes: TargetChange[] = [];
  const compare = (path: string, before: unknown, after: unknown) => {
    if (canonical(before) !== canonical(after))
      changes.push({
        path,
        kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
        ...(before !== undefined && { before }),
        ...(after !== undefined && { after }),
      });
  };
  const identities = (
    path: string,
    before: { id: string }[] = [],
    after: { id: string }[] = [],
  ) => {
    const identity = (v: { id: string }) =>
      path === "architecture/contracts" || path.startsWith("architecture/backend/")
        ? `${v.id}@${(v as { id: string; version: string }).version}`
        : v.id;
    const left = new Map(before.map((v) => [identity(v), v])),
      right = new Map(after.map((v) => [identity(v), v]));
    for (const id of [...new Set([...left.keys(), ...right.keys()])].sort())
      compare(`${path}/${id}`, left.get(id), right.get(id));
  };
  for (const key of ["recipe", "startedFrom"] as const) compare(key, a[key], b[key]);
  for (const key of ["elements", "connections", "annotations"] as const)
    identities(key, a[key], b[key]);
  compare("architecture/system", a.architecture?.system, b.architecture?.system);
  compare(
    "architecture/backend/schemaVersion",
    a.architecture?.backend?.schemaVersion,
    b.architecture?.backend?.schemaVersion,
  );
  for (const key of backendCollections)
    identities(
      `architecture/backend/${key}`,
      a.architecture?.backend?.[key],
      b.architecture?.backend?.[key],
    );
  for (const key of [
    "nodes",
    "relationships",
    "components",
    "componentRelationships",
    "scenarios",
    "contracts",
    "interfaces",
    "bindings",
    "datasets",
    "objectives",
    "patternInstances",
    "reviewRequirements",
    "decisions",
  ] as const)
    identities(`architecture/${key}`, a.architecture?.[key], b.architecture?.[key]);
  return changes;
}

/** Drafts derive only from explicit bindings, not inferred business meaning in names/paths. */
export function suggestArchitectureAnnotations(
  design: DesignDocument,
  name = "Application",
): Architecture {
  const model = architectureSchema.parse(
    structuredClone(
      design.architecture ?? { system: { name, description: "" }, nodes: [], relationships: [] },
    ),
  );
  model.components ??= [];
  const ids = new Set([
    ...backendDeclarations(model.backend).map((v) => v.id),
    ...[...designIds(design)].map((v) => v.id),
    ...Object.values(model).flatMap((v) =>
      Array.isArray(v)
        ? v.flatMap((item) =>
            item && typeof item === "object" && "id" in item ? [String(item.id)] : [],
          )
        : [],
    ),
    "system",
    ...design.elements.map((v) => v.id),
    ...model.nodes.map((v) => v.id),
    ...model.relationships.map((v) => v.id),
    ...model.components.map((v) => v.id),
    ...(model.componentRelationships?.map((v) => v.id) ?? []),
  ]);
  const fresh = (base: string) => {
    let id = base,
      n = 1;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    return id;
  };
  for (const element of design.elements)
    for (const attachment of element.attachments) {
      if (attachment.template.id !== "rest-api-server") continue;
      if (attachment.config.auth === "session" && !model.nodes.some((n) => n.kind === "person")) {
        const id = fresh("suggested-user");
        const annotationOrigin = {
          revision: design.revision,
          bindings: [{ element: element.id, attachment: attachment.id, kind: "accounts" as const }],
          basis:
            "Explicit saved session authentication configuration; editable actor draft, not proof of business roles or runtime behavior.",
        };
        model.nodes.push({
          id,
          kind: "person",
          name: "Application user",
          description: "Draft actor from session authentication; review the actual user roles.",
          annotationOrigin,
        });
        model.relationships.push({
          id: fresh("suggested-access"),
          from: id,
          to: "system",
          container: element.id,
          description: "Uses session-authenticated application",
        });
      }
      const parsed = resourceConfigSchema.safeParse(attachment.config.model);
      if (!parsed.success) continue;
      const groups: { name: string; responsibility: string; members: ArchitectureMember[] }[] = [
        {
          name: "Accounts and sessions",
          responsibility:
            "Declared session authentication binding; authorization policy still needs review.",
          members:
            attachment.config.auth === "session"
              ? [{ attachment: attachment.id, kind: "accounts" }]
              : [],
        },
        {
          name: "Stored records",
          responsibility:
            "Declared resource bindings; review and name the cohesive business responsibility.",
          members: parsed.data.resources.map((r) => ({
            attachment: attachment.id,
            kind: "resource",
            ref: r.id,
          })),
        },
        {
          name: "Extension operations",
          responsibility:
            "Declared project extension points; operation names do not establish implemented business behavior.",
          members: parsed.data.extensions.map((e) => ({
            attachment: attachment.id,
            kind: "extension",
            ref: e.id,
          })),
        },
      ];
      for (const group of groups) {
        const members = group.members.filter(
          (m) =>
            !model.components!.some(
              (c) =>
                c.element === element.id &&
                c.members.some(
                  (v) => v.attachment === m.attachment && v.kind === m.kind && v.ref === m.ref,
                ),
            ),
        );
        if (!members.length) continue;
        const origin = {
          revision: design.revision,
          bindings: members.map((m) => ({ element: element.id, ...m })),
          basis:
            "Explicit saved auth/resource/extension configuration; editable architecture draft, not runtime evidence.",
        };
        model.components.push({
          id: fresh(`suggested-${element.id}-${members[0]!.kind}`.slice(0, 90)),
          element: element.id,
          name: group.name,
          responsibility: group.responsibility,
          config: {},
          members,
          usesResources: [],
          usesConnections: [],
          annotationOrigin: origin,
        });
      }
    }
  return model;
}
