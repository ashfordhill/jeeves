/** Explicit logical authority and bounded store access. These are declarations, never runtime ACLs. */
import { z } from "zod";
import type { DesignDocument } from "./design.ts";
import { emptyDesignScope } from "./design-scope.ts";
import { type Finding, finding, isStructural } from "./findings.ts";
import { idSchema } from "./ids.ts";
import {
  designOperations,
  operationChanges,
  operationContractFindings,
  operationsAfterOwnership,
} from "./operation-contracts.ts";
import type { OperationInput } from "./operations.ts";
import { studioApplicationKinds } from "./studio-model.ts";

export const declaredAccessSchema = z.enum(["read", "write", "read-write"]);
export type DeclaredAccess = z.infer<typeof declaredAccessSchema>;
export const declaredAccessLabels: Record<DeclaredAccess, string> = {
  read: "Read",
  write: "Write",
  "read-write": "Read & write",
};
export const logicalOwnerSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(120),
});
export const ownerRoleSchema = z.strictObject({
  /** The original element is the role identity, even when its owner is collapsed in a view. */
  element: idSchema,
  owner: idSchema,
  kind: z.enum(["api", "worker"]),
  /** Optional assignment intent only. Equal IDs grant nothing and imply no running process. */
  deployable: idSchema.optional(),
});
export const resourceAuthoritySchema = z.discriminatedUnion("kind", [
  z.strictObject({ element: idSchema, authority: idSchema, kind: z.literal("source") }),
  z.strictObject({
    element: idSchema,
    authority: idSchema,
    kind: z.literal("projection"),
    source: idSchema,
  }),
]);
export const roleGrantSchema = z.strictObject({
  role: idSchema,
  resource: idSchema,
  access: declaredAccessSchema,
  /** An authority's deliberate published read boundary, never an implicit table permission. */
  boundary: z.literal("published-read").optional(),
});
export const dependencyAccessSchema = z.strictObject({
  connection: idSchema,
  access: declaredAccessSchema,
});
export const ownershipSchema = z.strictObject({
  owners: z.array(logicalOwnerSchema).max(50),
  roles: z.array(ownerRoleSchema).max(500),
  resources: z.array(resourceAuthoritySchema).max(500),
  grants: z.array(roleGrantSchema).max(500),
  dependencies: z.array(dependencyAccessSchema).max(500),
});
export type Ownership = z.infer<typeof ownershipSchema>;
export const emptyOwnership = (): Ownership => ({
  owners: [],
  roles: [],
  resources: [],
  grants: [],
  dependencies: [],
});
export function designOwnership(design: DesignDocument): Ownership {
  return design.schemaVersion === 3 ? (design.ownership ?? emptyOwnership()) : emptyOwnership();
}
export const accessAllows = (grant: DeclaredAccess, request: DeclaredAccess) =>
  grant === "read-write" || grant === request;
const stores = new Set(["database", "cache", "object-store", "search"]);
const applications = new Set<string>(studioApplicationKinds);

/** Missing declarations stay saveable; contradictory declared facts refuse atomically. */
export function ownershipFindings(design: DesignDocument): Finding[] {
  if (design.schemaVersion !== 3) return [];
  const model = designOwnership(design);
  const findings: Finding[] = [];
  const report = (
    code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "CONFIG_REQUIRED",
    path: (string | number)[],
    message: string,
    target: { element?: string; connection?: string } = {},
  ) => findings.push(finding(code, message, { ...target, path: ["ownership", ...path] }));
  const unique = <T>(items: T[], key: (item: T) => string, field: keyof Ownership) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const id = key(item);
      if (seen.has(id))
        report("CONFIG_INVALID", [field, index], `Declare ${field} identity ${id} once.`);
      seen.add(id);
    });
  };
  unique(model.owners, (x) => x.id, "owners");
  unique(model.roles, (x) => x.element, "roles");
  unique(model.resources, (x) => x.element, "resources");
  unique(model.grants, (x) => `${x.role}/${x.resource}`, "grants");
  unique(model.dependencies, (x) => x.connection, "dependencies");
  const owners = new Set(model.owners.map((x) => x.id));
  const roles = new Map(model.roles.map((x) => [x.element, x]));
  const resources = new Map(model.resources.map((x) => [x.element, x]));
  const kinds = new Map(
    design.architecture?.studio?.elements.map((x) => [x.element, x.settings.kind]),
  );
  const links = new Map(design.connections.map((x) => [x.id, x]));
  const exists = new Set(design.elements.map((x) => x.id));
  model.roles.forEach((role, index) => {
    if (!exists.has(role.element))
      report(
        "UNKNOWN_REFERENCE",
        ["roles", index, "element"],
        `Role element ${role.element} is missing.`,
      );
    else if (!applications.has(kinds.get(role.element) ?? ""))
      report(
        "CONFIG_INVALID",
        ["roles", index, "element"],
        `Role ${role.element} must be an application tile.`,
      );
    if (!owners.has(role.owner))
      report(
        "UNKNOWN_REFERENCE",
        ["roles", index, "owner"],
        `Logical owner ${role.owner} is missing.`,
      );
  });
  model.resources.forEach((resource, index) => {
    if (!exists.has(resource.element))
      report(
        "UNKNOWN_REFERENCE",
        ["resources", index, "element"],
        `Resource ${resource.element} is missing.`,
      );
    else if (!stores.has(kinds.get(resource.element) ?? ""))
      report(
        "CONFIG_INVALID",
        ["resources", index, "element"],
        `Authority is supported only for databases, caches, storage and search.`,
      );
    if (!owners.has(resource.authority))
      report(
        "UNKNOWN_REFERENCE",
        ["resources", index, "authority"],
        `Resource authority ${resource.authority} is missing.`,
      );
    if (resource.kind === "projection") {
      const source = resources.get(resource.source);
      if (!source)
        report(
          "UNKNOWN_REFERENCE",
          ["resources", index, "source"],
          `Projection source ${resource.source} needs an explicit resource declaration.`,
        );
      else if (source.kind !== "source" || source.element === resource.element)
        report(
          "CONFIG_INVALID",
          ["resources", index, "source"],
          "A projection must name a different declared source resource; projection chains are not supported.",
        );
      report(
        "CONFIG_REQUIRED",
        ["resources", index],
        `Projection ${resource.element} records source intent only; population, freshness and failure contracts are not specified.`,
        { element: resource.element },
      );
    }
  });
  model.grants.forEach((grant, index) => {
    const role = roles.get(grant.role),
      resource = resources.get(grant.resource);
    if (!role)
      report(
        "UNKNOWN_REFERENCE",
        ["grants", index, "role"],
        `Grant role ${grant.role} needs an explicit role declaration.`,
      );
    if (!resource)
      report(
        "UNKNOWN_REFERENCE",
        ["grants", index, "resource"],
        `Grant resource ${grant.resource} needs an explicit authority declaration.`,
      );
    if (role && resource && role.owner !== resource.authority) {
      if (grant.access !== "read")
        report(
          "CONFIG_INVALID",
          ["grants", index, "access"],
          `Foreign-owner direct write from ${grant.role} to ${grant.resource} is refused. Co-deployment grants nothing.`,
        );
      else if (grant.boundary !== "published-read")
        report(
          "CONFIG_INVALID",
          ["grants", index, "boundary"],
          `Cross-owner read of ${grant.resource} requires a deliberate published-read boundary or an owned projection.`,
        );
    }
    if (grant.boundary)
      report(
        "CONFIG_REQUIRED",
        ["grants", index, "boundary"],
        `Published-read boundary ${grant.role} → ${grant.resource} has no pinned published contract, freshness or failure behavior; runtime authorization is unspecified.`,
        { element: grant.role },
      );
    if (grant.boundary && grant.access !== "read")
      report(
        "CONFIG_INVALID",
        ["grants", index, "boundary"],
        "A published-read boundary grants read only.",
      );
  });
  model.dependencies.forEach((dependency, index) => {
    const link = links.get(dependency.connection);
    if (!link) {
      report(
        "UNKNOWN_REFERENCE",
        ["dependencies", index, "connection"],
        `Dependency connection ${dependency.connection} is missing.`,
      );
      return;
    }
    if (
      !stores.has(kinds.get(link.to.element) ?? "") ||
      !applications.has(kinds.get(link.from.element) ?? "")
    ) {
      report(
        "CONFIG_INVALID",
        ["dependencies", index],
        "Explicit dependency access requires an application → store connection.",
      );
      return;
    }
    const target = { connection: link.id };
    const role = roles.get(link.from.element),
      resource = resources.get(link.to.element);
    if (!role)
      report(
        "CONFIG_REQUIRED",
        ["dependencies", index],
        `Dependency ${link.id}: source role and logical owner are unspecified.`,
        target,
      );
    if (!resource)
      report(
        "CONFIG_REQUIRED",
        ["dependencies", index],
        `Dependency ${link.id}: resource authority is unspecified.`,
        target,
      );
    const grant = model.grants.find(
      (x) => x.role === link.from.element && x.resource === link.to.element,
    );
    if (!grant)
      report(
        "CONFIG_REQUIRED",
        ["dependencies", index],
        `Dependency ${link.id}: explicit ${dependency.access} role grant is unspecified.`,
        target,
      );
    else if (!accessAllows(grant.access, dependency.access))
      report(
        "CONFIG_INVALID",
        ["dependencies", index, "access"],
        `Dependency ${link.id} requests ${dependency.access}, outside its ${grant.access} role grant. Cache read and fill requires both read and write.`,
        target,
      );
    if (role && resource && role.owner !== resource.authority && dependency.access !== "read")
      report(
        "CONFIG_INVALID",
        ["dependencies", index, "access"],
        `Dependency ${link.id} declares a foreign-owner direct write.`,
        target,
      );
  });
  for (const [element, kind] of kinds) {
    if (applications.has(kind) && !roles.has(element))
      report(
        "CONFIG_REQUIRED",
        ["roles", element],
        `Logical owner and role for ${element} are unspecified; legacy ownership supplies no declaration.`,
        { element },
      );
    if (stores.has(kind) && !resources.has(element))
      report(
        "CONFIG_REQUIRED",
        ["resources", element],
        `Resource authority for ${element} is unspecified; its legacy inferred writer is separate.`,
        { element },
      );
  }
  for (const link of design.connections)
    if (
      stores.has(kinds.get(link.to.element) ?? "") &&
      applications.has(kinds.get(link.from.element) ?? "") &&
      !model.dependencies.some((x) => x.connection === link.id)
    )
      report(
        "CONFIG_REQUIRED",
        ["dependencies", link.id],
        `Dependency ${link.id} has unspecified access intent; its legacy inferred access is not a grant.`,
        { connection: link.id },
      );
  return findings;
}

/** Only explicit deletion cleans references. It never invents an authority or preserves a stale grant. */
export function pruneOwnership(
  design: DesignDocument,
  elements: readonly string[],
  connections: readonly string[],
) {
  if (design.schemaVersion !== 3 || !design.ownership) return;
  const removed = new Set(elements),
    links = new Set(connections),
    model = design.ownership;
  model.roles = model.roles.filter((x) => !removed.has(x.element));
  model.resources = model.resources.filter((x) => !removed.has(x.element));
  // Surviving projections with a removed source are refused rather than reclassified.
  model.grants = model.grants.filter((x) => !removed.has(x.role) && !removed.has(x.resource));
  model.dependencies = model.dependencies.filter((x) => !links.has(x.connection));
}

/** Form convenience: explicit owner/role/authority removals or transfers drop the old dependent declarations. */
export function cleanOwnershipChange(design: DesignDocument, next: Ownership): Ownership {
  const before = designOwnership(design),
    model = structuredClone(next);
  const changedRoles = new Set(
    before.roles
      .filter((old) => !model.roles.some((x) => x.element === old.element && x.owner === old.owner))
      .map((x) => x.element),
  );
  const changedResources = new Set(
    before.resources
      .filter(
        (old) =>
          !model.resources.some(
            (x) =>
              x.element === old.element &&
              x.authority === old.authority &&
              x.kind === old.kind &&
              (x.kind !== "projection" || old.kind !== "projection" || x.source === old.source),
          ),
      )
      .map((x) => x.element),
  );
  const owners = new Set(model.owners.map((x) => x.id));
  model.roles = model.roles.filter((x) => owners.has(x.owner));
  model.resources = model.resources.filter((x) => owners.has(x.authority));
  for (const old of before.roles)
    if (!model.roles.some((x) => x.element === old.element)) changedRoles.add(old.element);
  for (const old of before.resources)
    if (!model.resources.some((x) => x.element === old.element)) changedResources.add(old.element);
  model.grants = model.grants.filter(
    (x) => !changedRoles.has(x.role) && !changedResources.has(x.resource),
  );
  const removedGrant = new Set(
    before.grants
      .filter(
        (old) => !model.grants.some((x) => x.role === old.role && x.resource === old.resource),
      )
      .map((x) => `${x.role}/${x.resource}`),
  );
  model.dependencies = model.dependencies.filter((x) => {
    const link = design.connections.find((link) => link.id === x.connection);
    return (
      !link ||
      (!changedRoles.has(link.from.element) &&
        !changedResources.has(link.to.element) &&
        !removedGrant.has(`${link.from.element}/${link.to.element}`))
    );
  });
  return model;
}

export const ownershipCommandSchema = z.strictObject({
  ownership: ownershipSchema,
  upgrade: z.boolean().default(false),
});
export type OwnershipCommandInput = z.input<typeof ownershipCommandSchema>;
export function buildOwnershipCommand(
  design: DesignDocument,
  input: OwnershipCommandInput,
): { ops: OperationInput[] } {
  const command = ownershipCommandSchema.parse(input);
  if (design.schemaVersion === 2 && !command.upgrade)
    throw new Error(
      "Preview and explicitly upgrade to schema v3 before saving ownership and access.",
    );
  if (JSON.stringify(designOwnership(design)) === JSON.stringify(command.ownership))
    return { ops: [] };
  return {
    ops: [
      ...(design.schemaVersion === 2
        ? [{ op: "upgradeDesign" as const, scope: emptyDesignScope() }]
        : []),
      { op: "setOwnership", ownership: command.ownership },
    ],
  };
}
export function previewOwnership(design: DesignDocument, ownership: Ownership) {
  const model = ownershipSchema.parse(ownership);
  const candidate: DesignDocument = {
    ...design,
    schemaVersion: 3,
    scope: design.schemaVersion === 3 ? design.scope : emptyDesignScope(),
    ownership: model,
    ...(design.schemaVersion === 3 && design.operations
      ? { operations: operationsAfterOwnership(design, model) }
      : {}),
  };
  const before = designOwnership(design);
  const changes = (Object.keys(model) as (keyof Ownership)[]).flatMap((field) => {
    const key = (row: Ownership[typeof field][number]) =>
      "id" in row
        ? row.id
        : "element" in row
          ? row.element
          : "connection" in row
            ? row.connection
            : `${row.role}/${row.resource}`;
    const oldRows = new Map(before[field].map((x) => [key(x), x])),
      newRows = new Map(model[field].map((x) => [key(x), x]));
    return [
      ...[...newRows]
        .filter(([id, row]) => JSON.stringify(oldRows.get(id)) !== JSON.stringify(row))
        .map(([id, row]) => ({
          field,
          id,
          change: oldRows.has(id) ? "updated" : "added",
          before: oldRows.get(id) ?? null,
          after: row,
        })),
      ...[...oldRows]
        .filter(([id]) => !newRows.has(id))
        .map(([id, row]) => ({ field, id, change: "removed", before: row, after: null })),
    ];
  });
  const findings = [...ownershipFindings(candidate), ...operationContractFindings(candidate)];
  return {
    fromSchema: design.schemaVersion,
    toSchema: 3,
    ownership: model,
    changes,
    operationChanges: operationChanges(designOperations(design), designOperations(candidate)),
    findings,
    canApply: !findings.some(isStructural),
    note: "Design declarations only. Legacy inferred writers are unchanged. Roles may share a deployable; co-deployment grants nothing. This ownership edit adds no operation contract, template or runtime authorization. Saving is one Undo step.",
  };
}

export type OwnershipChange = ReturnType<typeof previewOwnership>["changes"][number];
/** Human review describes the exact rows; names never supply semantics or change their identities. */
export function ownershipChangeSummary(
  design: DesignDocument,
  row: OwnershipChange,
  changes: readonly OwnershipChange[] = [],
) {
  const model = designOwnership(design),
    owners = new Map(model.owners.map((x) => [x.id, x.name]));
  for (const change of changes)
    if (change.field === "owners" && change.after && "id" in change.after)
      owners.set(change.after.id, change.after.name);
  const owner = (id: string) => owners.get(id) ?? id;
  const name = (id: string) => design.elements.find((x) => x.id === id)?.name ?? id;
  const before = row.before,
    after = row.after,
    value = after ?? before;
  if (!value) return row.id;
  if (row.field === "owners" && "name" in value)
    return before && after && "name" in before && "name" in after
      ? `Rename logical owner ${before.name} → ${after.name}`
      : `${after ? "Add" : "Remove"} logical owner ${value.name}`;
  if (row.field === "roles" && "owner" in value) {
    if (before && after && "owner" in before && "owner" in after)
      return `${name(value.element)}: ${owner(before.owner)} → ${owner(after.owner)} · ${before.kind} → ${after.kind}${before.deployable !== after.deployable ? ` · deployable ${before.deployable ?? "unspecified"} → ${after.deployable ?? "unspecified"}` : ""}`;
    return `${after ? "Assign" : "Remove"} ${value.kind} role ${name(value.element)} ${after ? "to" : "from"} ${owner(value.owner)}`;
  }
  if (row.field === "resources" && "authority" in value) {
    const classification =
      value.kind === "projection" ? `projection of ${name(value.source)}` : "source of truth";
    return `${name(value.element)} authority: ${before && "authority" in before ? owner(before.authority) : "unspecified"} → ${after && "authority" in after ? owner(after.authority) : "unspecified"} · ${classification}`;
  }
  if (row.field === "grants" && "role" in value)
    return after && "role" in after
      ? `${name(value.role)} → ${name(value.resource)} grant: ${before && "access" in before ? declaredAccessLabels[before.access] : "unspecified"} → ${declaredAccessLabels[after.access]}${after.boundary ? " · published read contract intent" : ""}`
      : `Revoke ${declaredAccessLabels[value.access]} to ${name(value.resource)} from ${name(value.role)}`;
  if ("connection" in value) {
    const link = design.connections.find((x) => x.id === value.connection),
      ends = link ? `${name(link.from.element)} → ${name(link.to.element)}` : value.connection;
    return after && "connection" in after
      ? `${ends} request: ${before && "access" in before ? declaredAccessLabels[before.access] : "unspecified"} → ${declaredAccessLabels[after.access]}`
      : `Clear ${value.connection} access (${ends}, ${declaredAccessLabels[value.access]})`;
  }
  return row.id;
}
