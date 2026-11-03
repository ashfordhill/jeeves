/** Bounded read intent only. No SQL, policy evaluator or cursor execution is supplied. */
import { contractCanonical, contractKey } from "./architecture-contracts.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import type { BackendEntity, BackendQuery } from "./backend-model.ts";
import { validateBackendPolicyUse } from "./backend-policy.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

type QueryField = BackendQuery["projection"][number]["field"];
const fieldKey = (f: QueryField) => `${f.source}/${f.field}`;

/** Joins follow declared forward to-one relations; each root row remains at most one row. */
export function backendQuerySources(design: DesignDocument, query: BackendQuery) {
  const sources = new Map<string, { entity: BackendEntity; nullable: boolean }>();
  const root = backendEntity(design, query.root);
  if (root) sources.set("root", { entity: root, nullable: false });
  for (const join of query.joins) {
    if (sources.has(join.id)) continue;
    const from = sources.get(join.from);
    const relation = from?.entity.relations.find((r) => r.id === join.relation);
    const target = relation && backendEntity(design, relation.target);
    if (target)
      sources.set(join.id, { entity: target, nullable: !!from?.nullable || join.kind === "left" });
  }
  return sources;
}

export function validateBackendQueries(design: DesignDocument): Finding[] {
  const model = design.architecture;
  const result: Finding[] = [];
  const resolved = new Map<string, ReturnType<typeof backendEntityFields>>();
  const fieldsFor = (entity: BackendEntity) => {
    const key = contractKey(entity);
    let fields = resolved.get(key);
    if (!fields) {
      fields = backendEntityFields(design, entity);
      resolved.set(key, fields);
    }
    return fields;
  };
  for (const q of model?.backend?.queries ?? []) {
    const path = ["architecture", "backend", "queries", contractKey(q)];
    const add = (
      code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "CONFIG_REQUIRED",
      at: (string | number)[],
      message: string,
    ) => result.push(finding(code, `${q.name}: ${message}`, { path: [...path, ...at] }));
    const invalid = (at: (string | number)[], message: string) =>
      add("CONFIG_INVALID", at, message);
    const missing = (at: (string | number)[], message: string) =>
      add("UNKNOWN_REFERENCE", at, message);
    const root = backendEntity(design, q.root);
    if (!root) missing(["root"], `exact root entity ${contractKey(q.root)} does not exist.`);
    const sources = backendQuerySources(design, q);
    const seen = new Set(["root"]);
    const reachable = new Set(["root"]);
    const traversals = new Set<string>();
    for (const join of q.joins) {
      const at = ["joins", join.id];
      if (seen.has(join.id))
        invalid(at, "join aliases must be distinct and cannot use reserved root.");
      seen.add(join.id);
      if (!reachable.has(join.from))
        missing(
          at,
          "join source must be root or an earlier declared join; cycles/forward paths are unsupported.",
        );
      const from = sources.get(join.from);
      const relation = from?.entity.relations.find((r) => r.id === join.relation);
      if (!relation)
        missing(at, `relation ${join.relation} does not exist on the selected source.`);
      if (relation && !backendEntity(design, relation.target))
        missing(at, `exact relation target ${contractKey(relation.target)} is missing.`);
      const traversal = `${join.from}/${join.relation}`;
      if (traversals.has(traversal)) invalid(at, "the same relation path cannot be joined twice.");
      traversals.add(traversal);
      // Relation authority/scope/key validation is shared with validateBackendData.
      reachable.add(join.id);
    }
    const resolve = (ref: QueryField, at: (string | number)[], scalar = false) => {
      const source = sources.get(ref.source);
      const annotation = source?.entity.fields.find((f) => f.field === ref.field);
      const contract = model?.contracts?.find(
        (c) => source && contractKey(c) === contractKey(source.entity.contract),
      );
      if (!source || !annotation || !contract?.shape?.payload.some((f) => f.id === ref.field)) {
        missing(
          at,
          `query field ${fieldKey(ref)} must select a declared source and exact contract field.`,
        );
        return undefined;
      }
      const field = fieldsFor(source.entity).find((f) => f.id === ref.field);
      if (!field || field.type === "unresolved") {
        add("CONFIG_REQUIRED", at, `resolve query field ${fieldKey(ref)} before compilation.`);
        return undefined;
      }
      if (scalar && annotation.storage.kind !== "scalar")
        invalid(
          at,
          "filters and sort/cursor keys require scalar storage; opaque JSON and compound money are not query languages.",
        );
      return { field, nullable: source.nullable || !field.required || !!field.nullable };
    };
    const distinct = (ids: string[], at: string) => {
      if (new Set(ids).size !== ids.length) invalid([at], `${at} identities must be distinct.`);
    };
    distinct(
      q.filters.map((f) => f.id),
      "filters",
    );
    distinct(
      q.filters.map((f) => fieldKey(f.field)),
      "filters",
    );
    distinct(
      q.projection.map((f) => f.id),
      "projection",
    );
    for (const p of q.projection) resolve(p.field, ["projection", p.id]);
    for (const f of q.filters) {
      const at = ["filters", f.id];
      const value = resolve(f.field, at, true);
      if (new Set(f.comparisons).size !== f.comparisons.length)
        invalid(at, "comparison choices cannot repeat.");
      if (f.comparisons.includes("in") !== (f.maxValues !== undefined))
        invalid(
          at,
          "in requires a bounded maxValues; other comparisons cannot carry a list bound.",
        );
      if (!value) continue;
      for (const comparison of f.comparisons) {
        if (
          ["lt", "lte", "gt", "gte"].includes(comparison) &&
          !["integer", "timestamp"].includes(value.field.type)
        )
          invalid(at, "ordered comparisons support bounded integers and UTC timestamps only.");
        if (
          comparison === "prefix" &&
          (value.field.type !== "text" || value.field.enumValues?.length)
        )
          invalid(at, "prefix requires bounded non-enum text; SQL patterns are unsupported.");
        if (comparison === "is-null" && !value.nullable)
          invalid(at, "is-null requires nullable/optional data or a left-joined source.");
      }
    }
    if (q.limit.default > q.limit.maximum)
      invalid(["limit"], "default limit must not exceed the maximum.");
    distinct(
      q.order.map((o) => fieldKey(o.field)),
      "order",
    );
    const stable = (ref: QueryField, at: (string | number)[]) => {
      const value = resolve(ref, at, true);
      if (value?.nullable)
        invalid(at, "keyset order/cursor fields must be required and nonnullable.");
      return value?.field;
    };
    for (const [index, o] of q.order.entries()) stable(o.field, ["order", index]);
    for (const [index, f] of q.cursor.fields.entries()) stable(f, ["cursor", "fields", index]);
    if (contractCanonical(q.cursor.fields) !== contractCanonical(q.order.map((o) => o.field)))
      invalid(
        ["cursor"],
        "cursor fields must exactly match the full declared order, including its unique tie-breaker.",
      );
    if (root) {
      const keys = [
        root.primaryKey,
        ...root.uniqueKeys.map((k) =>
          k.scope === "entity-scope" && root.scope.kind === "field"
            ? [
                root.scope.field,
                ...k.fields.filter((f) => root.scope.kind === "field" && f !== root.scope.field),
              ]
            : k.fields,
        ),
      ];
      const fields = fieldsFor(root);
      const order = q.order.map((o) => o.field);
      const required = (id: string) => fields.some((f) => f.id === id && f.required && !f.nullable);
      if (
        !keys.some(
          (key) =>
            key.every(required) &&
            contractCanonical(order.slice(-key.length)) ===
              contractCanonical(key.map((field) => ({ source: "root", field }))),
        )
      )
        invalid(
          ["order"],
          "stable ordering must end in a complete required nonnullable primary/unique key; a scoped key includes its scope field.",
        );
    }
    const observed = [
      ...q.projection.map((p) => p.field),
      ...q.filters.map((f) => f.field),
      ...q.order.map((o) => o.field),
      ...q.cursor.fields,
    ];
    const site = q.accessSite ?? "read";
    const action = site === "read" ? "list" : site;
    result.push(
      ...validateBackendPolicyUse(design, {
        resource: q.root,
        selection: q.accessPolicy,
        action,
        site,
        projection: q.accessProjection,
        fields: observed.filter((f) => f.source === "root").map((f) => f.field),
        path: [...path, "accessPolicy"],
      }),
    );
    const selectedSources = new Set<string>();
    for (const selection of q.sourcePolicies ?? []) {
      if (selectedSources.has(selection.source))
        invalid(
          ["sourcePolicies", selection.source],
          "joined source has more than one selected policy.",
        );
      selectedSources.add(selection.source);
      if (selection.source === "root" || !sources.has(selection.source))
        missing(
          ["sourcePolicies", selection.source],
          "select an existing joined source; root policy is selected through accessPolicy.",
        );
    }
    for (const [alias, source] of sources) {
      if (alias === "root") continue;
      const selection = q.sourcePolicies?.find((s) => s.source === alias);
      // Old unresolved query drafts retain their single existing unresolved-selection finding.
      if (!selection && q.accessPolicy.kind === "unresolved") continue;
      result.push(
        ...validateBackendPolicyUse(design, {
          resource: source.entity,
          selection: selection?.policy ?? { kind: "unresolved" },
          action,
          site,
          projection: selection?.projection,
          fields: observed.filter((f) => f.source === alias).map((f) => f.field),
          path: [...path, "sourcePolicies", alias],
        }),
      );
    }
    if (q.freshness.kind === "bounded-staleness") {
      const freshness = q.freshness;
      const b = model?.bindings?.find((b) => b.id === freshness.binding);
      if (!b)
        missing(["freshness", "binding"], `read binding ${q.freshness.binding} does not exist.`);
      else {
        if (b.role !== "read" || (root && contractKey(b.contract) !== contractKey(root.contract)))
          invalid(
            ["freshness"],
            "freshness must reference a read binding for the root's exact data contract.",
          );
        const policy = b.policies?.freshness;
        if (!policy || policy.invalidation === "Unknown" || policy.maxAgeSeconds === undefined)
          add(
            "CONFIG_REQUIRED",
            ["freshness"],
            "finish the referenced read binding freshness policy before compilation.",
          );
        else if (
          policy.invalidation === "No cache" ||
          policy.maxAgeSeconds > q.freshness.maxAgeSeconds
        )
          invalid(
            ["freshness"],
            "the selected read binding must declare bounded staleness within this query's maximum age.",
          );
      }
    }
  }
  return result;
}
