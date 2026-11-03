/** Pure policy/reference checks only. No credentials, policy execution, SQL or runtime grants. */
import { contractCanonical, contractKey, contractOwnerElement } from "./architecture-contracts.ts";
import { backendCapabilityExactReferences } from "./backend-capability-configs.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import { inspectGroupGrant } from "./backend-group-grant.ts";
import type { BackendEntity, BackendReference } from "./backend-model.ts";
import type { BackendAccessPolicy, BackendRecheckSite } from "./backend-policy-model.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

export function backendAccessPolicy(design: DesignDocument, reference: BackendReference) {
  return design.architecture?.backend?.accessPolicies?.find(
    (p) => contractKey(p) === contractKey(reference),
  );
}
type Selection =
  | { kind: "unresolved"; reference?: BackendReference }
  | { kind: "policy"; reference: BackendReference };
export interface BackendPolicyUse {
  resource: BackendReference;
  selection: Selection;
  action: string;
  site: BackendRecheckSite;
  projection?: string;
  fields?: string[];
  path: (string | number)[];
}
/** The same exact policy and projection checks serve queries and sensitive observation/effect sites. */
export function validateBackendPolicyUse(design: DesignDocument, use: BackendPolicyUse): Finding[] {
  const result: Finding[] = [];
  const add = (
    code: "CONFIG_REQUIRED" | "CONFIG_INVALID" | "UNKNOWN_REFERENCE",
    message: string,
    suffix: string[] = [],
  ) => result.push(finding(code, message, { path: [...use.path, ...suffix] }));
  if (use.selection.kind === "unresolved") {
    add(
      "CONFIG_REQUIRED",
      "Select/resolve an exact access policy before compilation. Access applies before detail/list/search filtering, pagination, counts and projection; cursors and initiating actors are not authority.",
    );
    return result;
  }
  const policy = backendAccessPolicy(design, use.selection.reference);
  if (!policy) {
    add(
      "UNKNOWN_REFERENCE",
      `Exact access policy ${contractKey(use.selection.reference)} does not exist; select an unresolved draft to defer the decision.`,
    );
    return result;
  }
  if (contractKey(policy.resource) !== contractKey(use.resource))
    add(
      "CONFIG_INVALID",
      "Selected policy protects a different exact resource; select the policy for this entity.",
    );
  if (use.site === "job" && policy.context.identity !== "verified-service")
    add(
      "CONFIG_INVALID",
      "Background job execution requires a verified bounded service purpose; an initiating user's session or former membership is provenance only.",
    );
  if (!policy.rules.some((r) => r.effect === "allow" && r.actions.includes(use.action)))
    add(
      "CONFIG_REQUIRED",
      `Policy has no explicit allow rule for action ${use.action}; default deny remains in force.`,
    );
  if (!policy.revocation.recheck.includes(use.site))
    add(
      "CONFIG_REQUIRED",
      `Add the ${use.site} current-state revocation recheck to policy ${contractKey(policy)}.`,
      ["revocation"],
    );
  const projection = policy.projections.find((p) => p.id === use.projection);
  if (!use.projection)
    add(
      "CONFIG_REQUIRED",
      `Select an explicit ${use.site === "write" ? "write" : "read"} field projection for ${use.site} (including detail/list/search observations).`,
      ["projection"],
    );
  else if (!projection)
    add("UNKNOWN_REFERENCE", `Policy projection ${use.projection} does not exist.`, ["projection"]);
  else {
    if (projection.mode !== (use.site === "write" ? "write" : "read"))
      add(
        "CONFIG_INVALID",
        "Read visibility and allowed writes require separate projection modes.",
        ["projection"],
      );
    if (use.fields?.some((f) => !projection.fields.includes(f)))
      add(
        "CONFIG_INVALID",
        "Observed/filtered/ordered or written fields exceed the selected policy projection. Unknown writes must be rejected.",
        ["projection"],
      );
  }
  return result;
}

export function validateBackendPolicies(design: DesignDocument): Finding[] {
  const model = design.architecture?.backend;
  if (!model) return [];
  const result: Finding[] = [];
  const resolvedFields = new Map<string, ReturnType<typeof backendEntityFields>>();
  const fieldsFor = (entity: BackendEntity) => {
    const key = contractKey(entity);
    let fields = resolvedFields.get(key);
    if (!fields) {
      fields = backendEntityFields(design, entity);
      resolvedFields.set(key, fields);
    }
    return fields;
  };
  const dataset = (e: BackendEntity) =>
    design.architecture?.datasets?.find((d) => d.id === e.dataset);
  const authority = (e: BackendEntity) => {
    const d = dataset(e);
    return [d?.store, d?.owners[0] && contractOwnerElement(design, d.owners[0])];
  };
  for (const p of model.accessPolicies ?? []) {
    const path = ["architecture", "backend", "accessPolicies", contractKey(p)];
    const add = (
      code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "CONFIG_REQUIRED",
      at: (string | number)[],
      message: string,
    ) => result.push(finding(code, `${p.name}: ${message}`, { path: [...path, ...at] }));
    const invalid = (at: (string | number)[], message: string) =>
      add("CONFIG_INVALID", at, message);
    const missing = (at: (string | number)[], message: string) =>
      add("UNKNOWN_REFERENCE", at, message);
    const resource = backendEntity(design, p.resource);
    if (!resource) missing(["resource"], "select an existing exact protected entity.");
    const distinct = (values: string[], at: (string | number)[]) => {
      if (new Set(values).size !== values.length)
        invalid(at, "identities/choices must be distinct.");
    };
    const field = (
      entity: BackendEntity | undefined,
      id: string,
      at: (string | number)[],
      type?: string,
    ) => {
      const f = entity && fieldsFor(entity).find((f) => f.id === id);
      if (!entity?.fields.some((f) => f.field === id) || !f)
        missing(at, `persisted exact field ${id} is missing.`);
      else if (f.type === "unresolved") {
        add("CONFIG_REQUIRED", at, `resolve field ${id} before compilation.`);
        return undefined;
      } else if (
        type &&
        (f.type !== type ||
          !f.required ||
          f.nullable ||
          entity.fields.find((a) => a.field === id)?.storage.kind !== "scalar")
      )
        invalid(at, `field ${id} must be a required nonnullable scalar ${type}.`);
      return f;
    };
    if (resource && (p.context.scope === "authorized-scope") !== (resource.scope.kind === "field"))
      invalid(
        ["context", "scope"],
        "trusted authorized scope must match the protected entity's persisted scope; global scope cannot bypass a scoped entity.",
      );
    if ((p.context.identity === "verified-service") !== !!p.context.service)
      invalid(
        ["context", "service"],
        "only a verified service identity supplies an explicit bounded service purpose; initiating actors are provenance only.",
      );
    if (p.context.service?.scope === "authorized-scope" && p.context.scope !== "authorized-scope")
      invalid(["context", "service"], "service scope must match the authorized persisted scope.");
    distinct(
      p.clauses.map((c) => c.id),
      ["clauses"],
    );
    distinct(
      p.rules.map((r) => r.id),
      ["rules"],
    );
    distinct(
      p.projections.map((r) => r.id),
      ["projections"],
    );
    distinct(p.revocation.recheck, ["revocation"]);
    const condition = (
      when: { operator: "all" | "any"; clauses: string[] },
      at: (string | number)[],
    ) => {
      distinct(when.clauses, at);
      for (const id of when.clauses)
        if (!p.clauses.some((c) => c.id === id))
          missing(
            at,
            `named clause ${id} does not exist; recursive rule references are unsupported.`,
          );
    };
    for (const c of p.clauses) {
      const at = ["clauses", c.id];
      if (c.kind === "group-grant")
        for (const message of inspectGroupGrant(design, p, c)) invalid(at, message);
      if (c.kind === "authenticated" && p.context.identity === "public")
        invalid(at, "authenticated requires a server-established principal or service context.");
      if (c.kind === "owner") {
        const relation = c.via && resource?.relations.find((r) => r.id === c.via);
        if (c.via && !relation) missing(at, "owner via must select one direct forward relation.");
        if (relation && relation.scope !== "same-scope")
          invalid(at, "parent owner requires a same-scope relation.");
        field(relation ? backendEntity(design, relation.target) : resource, c.field, at, "uuid");
        if (p.context.identity !== "session-principal")
          invalid(
            at,
            "owner comparison uses the existing session principal ID, never an initiating actor or body field.",
          );
      }
      if (c.kind === "visibility") {
        const relation = c.via && resource?.relations.find((r) => r.id === c.via);
        if (c.via && !relation)
          missing(at, "visibility via must select one direct forward relation.");
        const target = relation ? backendEntity(design, relation.target) : resource;
        if (
          relation &&
          (relation.scope !== "same-scope" ||
            relation.fields.some((k) => !field(resource, k.source, at)?.required))
        )
          invalid(
            at,
            "parent visibility requires a required same-scope relation; an absent nullable parent never matches.",
          );
        const f = field(target, c.field, at);
        if (f && target?.fields.find((a) => a.field === c.field)?.storage.kind !== "scalar")
          invalid(
            at,
            "visibility requires scalar storage; opaque JSON cannot supply a policy predicate.",
          );
        if (
          f &&
          (c.value === null
            ? !f.nullable
            : typeof c.value === "boolean"
              ? f.type !== "boolean"
              : f.type !== "text" || !f.enumValues?.includes(c.value))
        )
          invalid(
            at,
            "visibility matches a boolean, declared enum or explicitly nullable scalar null.",
          );
      }
      if (c.kind === "service-purpose" && c.purpose !== p.context.service?.purpose)
        invalid(at, "purpose must match this policy's verified service identity.");
      if (c.kind === "action") distinct(c.actions, at);
      if (c.kind === "role" || c.kind === "membership") {
        const membership = backendEntity(design, c.entity);
        if (!membership) missing(at, "persisted role/membership entity does not exist.");
        field(membership, c.principal, at, "uuid");
        if (p.context.identity !== "session-principal")
          invalid(
            at,
            "persisted user roles/membership require the session principal; service work uses purpose and current resource scope.",
          );
        if (resource && membership) {
          if (contractCanonical(authority(resource)) !== contractCanonical(authority(membership)))
            invalid(
              at,
              "membership/role authority must share the protected resource's store and application.",
            );
          if (resource.scope.kind !== membership.scope.kind)
            invalid(
              at,
              "membership/role scope must match the protected resource; a global role cannot authorize a tenant.",
            );
        }
        if (c.kind === "role") {
          const f = field(membership, c.field, at, "text");
          distinct(c.values, at);
          if (f && (!f.enumValues?.length || c.values.some((v) => !f.enumValues?.includes(v))))
            invalid(at, "named roles must select values from the exact persisted role enum.");
        } else {
          field(membership, c.active.field, at, "boolean");
          const via = c.via && resource?.relations.find((r) => r.id === c.via);
          if (c.via && !via)
            missing(
              at,
              "membership via must name one direct forward resource relation; recursive traversal is unsupported.",
            );
          const target = via ? backendEntity(design, via.target) : resource;
          const relation = membership?.relations.find((r) => r.id === c.relation);
          if (!relation)
            missing(at, "membership must name its direct resource/group/organization relation.");
          else if (target && contractKey(relation.target) !== contractKey(target))
            invalid(
              at,
              "membership relation must target the protected entity or its selected direct scope relation.",
            );
          if (c.scope === "organization" && target?.scope.kind !== "field")
            invalid(at, "organization membership requires a persisted authorized scope.");
        }
      }
    }
    for (const r of p.rules) {
      condition(r.when, ["rules", r.id]);
      distinct(r.actions, ["rules", r.id, "actions"]);
    }
    if (!p.rules.some((r) => r.effect === "allow"))
      add(
        "CONFIG_REQUIRED",
        ["rules"],
        "add an explicit allow rule; empty/deny-only drafts remain default deny.",
      );
    for (const projection of p.projections) {
      const conditional = projection.conditional ?? [];
      distinct(
        conditional.map((c) => c.field),
        ["projections", projection.id, "conditional"],
      );
      if (conditional.length && projection.mode !== "read")
        invalid(
          ["projections", projection.id],
          "conditional fields apply only to read projections.",
        );
      for (const item of conditional) {
        const at = ["projections", projection.id, "conditional", item.field];
        const f = field(resource, item.field, at);
        if (!projection.fields.includes(item.field))
          invalid(at, "conditional field must belong to its selected projection.");
        if (f && (item.otherwise === "null" ? !f.nullable : f.required))
          invalid(
            at,
            "redaction must fit the logical nullable/optional output; persisted authority is not relaxed.",
          );
        for (const allow of item.allow) condition(allow, at);
      }
      const at = ["projections", projection.id];
      condition(projection.when, at);
      distinct(projection.fields, at);
      for (const id of projection.fields) {
        field(resource, id, at);
        if (
          projection.mode === "write" &&
          resource?.fields.find((f) => f.field === id)?.serverOwned
        )
          invalid(
            at,
            "write projections cannot accept server-owned identity, scope, clock or version fields.",
          );
      }
    }
    if (!p.projections.length)
      add(
        "CONFIG_REQUIRED",
        ["projections"],
        "declare read/list/search and write projections separately; prose does not establish field visibility.",
      );
  }
  const targets = new Set<string>();
  for (const b of model.accessBindings ?? []) {
    const path = ["architecture", "backend", "accessBindings", contractKey(b)];
    const add = (code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE", message: string) =>
      result.push(finding(code, message, { path }));
    const resource = backendEntity(design, b.resource);
    if (!resource) add("UNKNOWN_REFERENCE", "Access binding protected entity does not exist.");
    const key = contractCanonical({
      target:
        b.target.kind === "projection"
          ? { ...b.target, fields: [...b.target.fields].sort() }
          : b.target,
      site: b.site,
      action: b.action,
    });
    if (targets.has(key))
      add(
        "CONFIG_INVALID",
        "This exact target/site/action already has an access binding; select one policy.",
      );
    targets.add(key);
    if (
      b.relationshipBinding &&
      !design.architecture?.bindings?.some((r) => r.id === b.relationshipBinding)
    )
      add("UNKNOWN_REFERENCE", "Selected relationship access intent does not exist.");
    if (b.target.kind === "projection") {
      if (contractKey(b.target.entity) !== contractKey(b.resource))
        add(
          "CONFIG_INVALID",
          "Sensitive projection must use the policy's exact protected resource.",
        );
      if (new Set(b.target.fields).size !== b.target.fields.length)
        add("CONFIG_INVALID", "Sensitive projection fields must be distinct.");
      for (const f of b.target.fields)
        if (!resource?.fields.some((v) => v.field === f))
          add("UNKNOWN_REFERENCE", `Sensitive projection field ${f} does not exist.`);
    } else {
      const target = b.target;
      const contract = design.architecture?.contracts?.find(
        (c) => contractKey(c) === contractKey(target.contract),
      );
      if (!contract?.shape?.operations.some((o) => o.id === target.operation))
        add(
          "UNKNOWN_REFERENCE",
          "Access binding must select an existing exact contract operation.",
        );
      const owner = contractOwnerElement(design, target.owner);
      if (!owner) add("UNKNOWN_REFERENCE", "Access binding operation owner does not exist.");
      if (resource && authority(resource)[1] !== owner)
        add(
          "CONFIG_INVALID",
          "Operation policy must share the protected entity's authoritative application.",
        );
      if (
        !design.architecture?.interfaces?.some(
          (i) =>
            i.direction === "provided" &&
            i.owner.kind === target.owner.kind &&
            i.owner.id === target.owner.id &&
            contractKey(i.contract) === contractKey(target.contract),
        )
      )
        add(
          "UNKNOWN_REFERENCE",
          "Select a provided exact interface belonging to this operation owner.",
        );
      if (b.relationshipBinding) {
        const relationship = design.architecture?.bindings?.find(
          (r) => r.id === b.relationshipBinding,
        );
        const provided = design.architecture?.interfaces?.find(
          (i) => i.id === relationship?.provided,
        );
        if (
          relationship &&
          (contractKey(relationship.contract) !== contractKey(target.contract) ||
            (relationship.operation && relationship.operation !== target.operation) ||
            provided?.owner.kind !== target.owner.kind ||
            provided?.owner.id !== target.owner.id)
        )
          add(
            "CONFIG_INVALID",
            "Relationship intent must reference the same exact operation contract and provided owner.",
          );
      }
    }
    result.push(
      ...validateBackendPolicyUse(design, {
        resource: b.resource,
        selection: b.policy,
        action: b.action,
        site: b.site,
        projection: b.projection,
        ...(b.target.kind === "projection" ? { fields: b.target.fields } : {}),
        path: [...path, "policy"],
      }),
    );
  }
  return result;
}

/** Referenced exact versions remain immutable even when the same batch migrates consumers. */
export function validateBackendPolicyTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const model = before.architecture?.backend;
  const references = [
    ...(model?.capabilityConfigs ?? [])
      .flatMap(backendCapabilityExactReferences)
      .filter((r) => r.collection === "accessPolicies")
      .map((r) => ({ kind: "policy" as const, reference: r.reference })),
    ...(model?.queries ?? []).flatMap((q) => [
      q.accessPolicy,
      ...(q.sourcePolicies ?? []).map((s) => s.policy),
    ]),
    ...(model?.accessBindings ?? []).map((b) => b.policy),
    ...(model?.operations ?? []).flatMap((o) => [
      ...(o.protocol?.records.map((r) => ({ kind: "policy" as const, reference: r.policy })) ?? []),
      o.access.policy,
      ...(o.access.participants ?? []).map((p) => p.policy),
    ]),
  ];
  return (model?.accessPolicies ?? []).flatMap((p) => {
    if (!references.some((s) => s.kind === "policy" && contractKey(s.reference) === contractKey(p)))
      return [];
    const next = after.architecture?.backend?.accessPolicies?.find(
      (n) => contractKey(n) === contractKey(p),
    );
    const semantics = (p: BackendAccessPolicy) => {
      const { name: _name, ...value } = p;
      return value;
    };
    return !next || contractCanonical(semantics(p)) !== contractCanonical(semantics(next))
      ? [
          finding(
            "CONFIG_INVALID",
            `Referenced policy ${contractKey(p)} is immutable. Preserve it and create a successor version, then review consumers.`,
            { path: ["architecture", "backend", "accessPolicies", contractKey(p)] },
          ),
        ]
      : [];
  });
}

/** Relationship declarations are intent, never an alternate source of executable authority. */
export function backendPolicyIntentConflicts(design: DesignDocument) {
  return (design.architecture?.backend?.accessBindings ?? []).flatMap((b) => {
    const intent = design.architecture?.bindings?.find((r) => r.id === b.relationshipBinding)
      ?.policies?.access;
    const policy = b.policy.kind === "policy" && backendAccessPolicy(design, b.policy.reference);
    if (!intent || !policy) return [];
    const identity = {
      public: "Public",
      "session-principal": "User",
      "verified-service": "Service",
    }[policy.context.identity];
    const conflict =
      (intent.identity !== "Unknown" && intent.identity !== identity) ||
      (intent.tenant === "Tenant scoped" && policy.context.scope !== "authorized-scope") ||
      (intent.tenant === "Public" && policy.context.scope !== "global");
    return conflict
      ? [
          {
            binding: b,
            relationshipBinding: b.relationshipBinding ?? "",
            policy,
            message: `${b.name}: selected policy ${contractKey(policy)} (${identity}, ${policy.context.scope}) conflicts with relationship ${b.relationshipBinding} access intent (${intent.identity}, ${intent.tenant}). Review the explicit policy or relationship intent; network privacy grants no access.`,
          },
        ]
      : [];
  });
}
