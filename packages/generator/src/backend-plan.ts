/** P70a analysis seam. No emitters, filesystem, providers, clocks or generation routing. */
import {
  backendEntityFields,
  backendQuerySources,
  type ContractValue,
  componentHostRole,
  contractCanonical,
  contractKey,
  contractOwnerElement,
  type DesignDocument,
  type Finding,
  type ImplementationObligation,
  matchBackendImplementations,
  type TemplateLookup,
} from "@jeeves/spec";
import type {
  BackendDataIR,
  BackendDataPlan,
  BackendDiagnostic,
  BackendEntityLink,
  BackendLogicalValue,
  BackendPolicyLink,
  BackendReadonly,
  BackendResponsibility,
  BackendSource,
  BackendSourceMapEntry,
} from "./backend-ir.ts";

/** JSON tuples preserve exact identities without ambiguous separators or hash collisions. */
export const backendIdentity = (kind: string, ...parts: string[]): string =>
  JSON.stringify([kind, ...parts]);
/** Escape separators as well as punctuation, so distinct versions cannot share a symbol. */
export const backendName = (kind: string, ...parts: string[]): string =>
  [kind, ...parts]
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`))
    .join("__");
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byId = <T extends { id: string }>(values: T[]): T[] =>
  [...values].sort((a, b) => compare(a.id, b.id));
const byRef = <T extends { id: string; version: string }>(values: T[]): T[] =>
  [...values].sort((a, b) => compare(contractKey(a), contractKey(b)));
const exact = ({ id, version }: { id: string; version: string }) => ({ id, version });

function freeze<T>(value: T): BackendReadonly<T> {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value as BackendReadonly<T>;
}
function logical(value: ContractValue): BackendLogicalValue {
  const { fields, items, values, variants, ...rest } = value;
  return {
    ...rest,
    ...(rest.enumValues ? { enumValues: [...rest.enumValues].sort(compare) } : {}),
    ...(fields
      ? {
          fields: byId(fields).map((f) => ({
            id: f.id,
            required: f.required,
            value: logicalValue(f),
          })),
        }
      : {}),
    ...(items ? { items: logical(items) } : {}),
    ...(values ? { values: logical(values) } : {}),
    ...(variants
      ? {
          variants: variants
            .map(logical)
            .sort((a, b) => compare(contractCanonical(a), contractCanonical(b))),
        }
      : {}),
  };
}
function logicalValue(
  field: ContractValue & { id: string; name: string; description: string; required: boolean },
): BackendLogicalValue {
  const { id: _id, name: _name, description: _description, required: _required, ...value } = field;
  return logical(value);
}

/** Returns partial inspectable data even for unresolved intent. It is never executable readiness.
 * Legacy inputs are explicitly disabled and are not adapted or mutated by this entry point.
 */
export function lowerBackendData(design: DesignDocument, lookup: TemplateLookup): BackendDataPlan {
  const support = matchBackendImplementations(design, lookup);
  const model = design.architecture?.backend;
  const diagnostics: BackendDiagnostic[] = [];
  const sourceMap: BackendSourceMapEntry[] = [];
  const source = (
    kind: BackendSource["kind"],
    id: string,
    path: (string | number)[],
    version?: string,
  ): BackendSource => ({ kind, id, path, ...(version ? { version } : {}) });
  const backendSource = (
    kind: "entities" | "aggregates" | "queries" | "accessPolicies" | "accessBindings",
    ref: { id: string; version: string },
  ) => source(kind, ref.id, ["architecture", "backend", kind, contractKey(ref)], ref.version);
  const obligationSource = (ref: ImplementationObligation): BackendSource => {
    const collections: Partial<Record<ImplementationObligation["kind"], string[]>> = {
      container: ["elements"],
      component: ["architecture", "components"],
      connection: ["connections"],
      "component-relationship": ["architecture", "componentRelationships"],
      binding: ["architecture", "bindings"],
      dataset: ["architecture", "datasets"],
      contract: ["architecture", "contracts"],
      operation: ["architecture", "backend", "operations"],
    };
    const collection = collections[ref.kind] ?? ["architecture", "backend", ref.kind];
    return source(
      ref.kind,
      ref.id,
      [...collection, ref.version ? contractKey({ id: ref.id, version: ref.version }) : ref.id],
      ref.version,
    );
  };
  const add = (code: string, message: string, at: BackendSource) =>
    diagnostics.push({ code, message, source: at });
  const names = new Map<string, BackendSource>();
  const outputs = new Map<string, BackendSource>();
  const responsibility = (
    kind: string,
    parts: string[],
    at: BackendSource,
  ): BackendResponsibility => {
    const id = backendIdentity(kind, ...parts),
      name = backendName(kind, ...parts);
    if (outputs.has(id))
      add("IDENTITY_COLLISION", `Compiler responsibility ${id} is repeated.`, at);
    if (names.has(name)) add("NAME_COLLISION", `Compiler symbol ${name} is repeated.`, at);
    outputs.set(id, at);
    names.set(name, at);
    sourceMap.push({ output: id, source: at });
    return { id, name, source: at };
  };
  if (!model)
    return freeze(
      structuredClone({
        schemaVersion: 1 as const,
        stage: "data" as const,
        enabled: false,
        sourceSnapshot: design,
        sourceMap,
        diagnostics,
        rawFindings: support.rawFindings,
        support,
      }),
    );
  const architecture = design.architecture;
  const ir: BackendDataIR = {
    schemaVersion: 1,
    hosts: [],
    entities: [],
    aggregates: [],
    queries: [],
    policies: [],
    accessBindings: [],
  };
  // Preserve validator paths and exact backend identities in the normalized diagnostic view.
  const findingSource = (f: Finding): BackendSource => {
    const path = f.target.path ?? ["elements", f.target.element ?? "design"];
    const collection = path[0] === "architecture" && path[1] === "backend" ? path[2] : undefined;
    const identity = path[3];
    if (typeof collection === "string" && typeof identity === "string") {
      const key = identity.lastIndexOf("@");
      const declaration = Object.entries(model).find(([name]) => name === collection)?.[1];
      const record = Array.isArray(declaration)
        ? declaration.find((v) => contractKey(v) === identity)
        : undefined;
      if (record && key > 0)
        return source(
          collection === "operations" ? "operation" : (collection as BackendSource["kind"]),
          record.id,
          path,
          record.version,
        );
    }
    return source("container", f.target.element ?? "design", path);
  };
  for (const f of support.structuralFindings) add(f.code, f.message, findingSource(f));
  for (const row of support.obligations)
    if (row.status !== "supported") {
      const at = obligationSource(row.obligation);
      for (const reason of row.reasons.filter((r) => r.code !== "EXACT_SUPPORT"))
        add(`SUPPORT_${reason.code}`, reason.message, {
          ...at,
          path: [...at.path, ...(reason.path ? [reason.path] : [])],
        });
    }
  for (const f of support.rawFindings)
    if (
      f.code === "CONFIG_REQUIRED" &&
      f.target.path?.some((p) =>
        ["entities", "aggregates", "queries", "accessPolicies", "accessBindings"].includes(
          String(p),
        ),
      )
    )
      add(f.code, f.message, findingSource(f));
  const selected = model.implementations ?? [];
  for (const e of byId(design.elements)) {
    const candidates = selected.filter(
      (s) => s.target.kind === "container" && s.target.id === e.id,
    );
    const binding = candidates.length === 1 ? candidates[0] : undefined;
    const template = e.template ?? binding?.template;
    ir.hosts.push({
      ...responsibility("host", [e.id], source("container", e.id, ["elements", e.id])),
      element: e.id,
      role: componentHostRole(e, lookup),
      ...(e.planned ? { planned: e.planned } : {}),
      ...(template ? { template: exact(template) } : {}),
      ...(binding ? { implementation: exact(binding) } : {}),
      configuration: e.config,
    });
  }
  const hostId = (id: string | undefined) => ir.hosts.find((h) => h.element === id)?.id;
  const entityLink = (ref: { id: string; version: string }): BackendEntityLink => ({
    reference: exact(ref),
    ...(model.entities.some((e) => contractKey(e) === contractKey(ref))
      ? { entity: backendIdentity("entity", ref.id, ref.version) }
      : {}),
  });
  const authority = (ref: { id: string; version: string }) => {
    const e = model.entities.find((e) => contractKey(e) === contractKey(ref));
    const d = architecture?.datasets?.find((d) => d.id === e?.dataset);
    const owner = d?.owners.length === 1 ? d.owners[0] : undefined;
    const host = hostId(owner && contractOwnerElement(design, owner));
    const store = hostId(d?.store);
    return { owner, host, store };
  };
  const policyLink = (
    selection: BackendPolicyLink["selection"],
    projection?: string,
  ): BackendPolicyLink => ({
    selection,
    ...(selection.kind === "policy" &&
    model.accessPolicies?.some((p) => contractKey(p) === contractKey(selection.reference))
      ? { policy: backendIdentity("policy", selection.reference.id, selection.reference.version) }
      : {}),
    ...(projection ? { projection } : {}),
  });
  const storage = new Map<string, string>();
  for (const e of byRef(model.entities)) {
    const at = backendSource("entities", e);
    const auth = authority(e);
    if (!auth.host || !auth.store)
      add(
        "AUTHORITY_UNRESOLVED",
        "An entity requires one exact application owner and authoritative store.",
        at,
      );
    const declaredStore = architecture?.datasets?.find((d) => d.id === e.dataset)?.store;
    const physical = backendIdentity("table", declaredStore ?? "unresolved", e.storageId);
    const previous = storage.get(physical);
    if (previous && previous !== e.id)
      add(
        "STORAGE_COLLISION",
        `Table identity ${e.storageId} is claimed by different entities in one store.`,
        at,
      );
    storage.set(physical, e.id);
    const resolved = backendEntityFields(design, e);
    ir.entities.push({
      ...responsibility("entity", [e.id, e.version], at),
      reference: exact(e),
      ...auth,
      dataset: e.dataset,
      contract: exact(e.contract),
      storageId: e.storageId,
      fields: byId(e.fields.map((f) => ({ ...f, id: f.field }))).map(({ id: _id, ...f }) => {
        const field = resolved.find((v) => v.id === f.field);
        const child = source("field", f.field, [...at.path, "fields", f.field], e.version);
        if (!field || field.type === "unresolved")
          add("TYPE_UNRESOLVED", `Resolve exact field ${f.field} before compilation.`, child);
        return {
          ...responsibility("field", [e.id, e.version, f.field], child),
          ...f,
          ...(field ? { value: logicalValue(field) } : {}),
        };
      }),
      primaryKey: e.primaryKey,
      scope: e.scope,
      relations: byId(e.relations).map(({ id, target, ...r }) => ({
        ...responsibility(
          "relation",
          [e.id, e.version, id],
          source("relation", id, [...at.path, "relations", id], e.version),
        ),
        relation: id,
        ...r,
        target: entityLink(target),
      })),
      uniqueKeys: byId(e.uniqueKeys).map(({ id, ...k }) => ({
        ...responsibility(
          "unique",
          [e.id, e.version, id],
          source("constraint", id, [...at.path, "uniqueKeys", id], e.version),
        ),
        ...k,
      })),
      indexes: byId(e.indexes).map(({ id, ...k }) => ({
        ...responsibility(
          "index",
          [e.id, e.version, id],
          source("constraint", id, [...at.path, "indexes", id], e.version),
        ),
        ...k,
      })),
    });
  }
  for (const a of byRef(model.aggregates)) {
    const at = backendSource("aggregates", a),
      host = hostId(contractOwnerElement(design, a.owner)),
      store = hostId(a.store);
    for (const ref of [a.root, ...a.children]) {
      const auth = authority(ref);
      if (auth.host !== host || auth.store !== store || !host || !store)
        add(
          "AGGREGATE_BOUNDARY",
          "Every local aggregate participant requires the same authoritative host and store.",
          at,
        );
    }
    ir.aggregates.push({
      ...responsibility("aggregate", [a.id, a.version], at),
      reference: exact(a),
      owner: a.owner,
      host,
      store,
      root: entityLink(a.root),
      children: byRef(a.children).map(entityLink),
      concurrency:
        a.concurrency.kind === "row-lock"
          ? { ...a.concurrency, entities: byRef(a.concurrency.entities) }
          : a.concurrency,
      invariants: byId(a.invariants),
    });
  }
  for (const p of byRef(model.accessPolicies ?? [])) {
    const at = backendSource("accessPolicies", p),
      { host, store } = authority(p.resource);
    ir.policies.push({
      ...responsibility("policy", [p.id, p.version], at),
      reference: exact(p),
      resource: entityLink(p.resource),
      host,
      store,
      context: p.context,
      default: p.default,
      conflict: p.conflict,
      clauses: byId(p.clauses).map((clause) => ({
        ...responsibility(
          "clause",
          [p.id, p.version, clause.id],
          source("policy-part", clause.id, [...at.path, "clauses", clause.id], p.version),
        ),
        clause: {
          ...clause,
          ...("values" in clause ? { values: [...clause.values].sort(compare) } : {}),
          ...("actions" in clause ? { actions: [...clause.actions].sort(compare) } : {}),
        },
        ...("entity" in clause ? { entity: entityLink(clause.entity).entity } : {}),
      })),
      rules: byId(p.rules).map((rule) => ({
        ...responsibility(
          "rule",
          [p.id, p.version, rule.id],
          source("policy-part", rule.id, [...at.path, "rules", rule.id], p.version),
        ),
        rule: {
          ...rule,
          actions: [...rule.actions].sort(compare),
          when: { ...rule.when, clauses: [...rule.when.clauses].sort(compare) },
        },
      })),
      projections: byId(p.projections).map((projection) => ({
        ...responsibility(
          "projection",
          [p.id, p.version, projection.id],
          source(
            "policy-part",
            projection.id,
            [...at.path, "projections", projection.id],
            p.version,
          ),
        ),
        projection: {
          ...projection,
          fields: [...projection.fields].sort(compare),
          when: { ...projection.when, clauses: [...projection.when.clauses].sort(compare) },
        },
      })),
      revocation: { ...p.revocation, recheck: [...p.revocation.recheck].sort(compare) },
    });
  }
  for (const q of byRef(model.queries ?? [])) {
    const at = backendSource("queries", q),
      { host, store } = authority(q.root);
    const sources = backendQuerySources(design, q);
    ir.queries.push({
      ...responsibility("query", [q.id, q.version], at),
      reference: exact(q),
      host,
      store,
      root: entityLink(q.root),
      sources: ["root", ...q.joins.map((j) => j.id)].sort(compare).map((alias) => {
        const entry = sources.get(alias);
        const join = q.joins.find((j) => j.id === alias),
          access = q.sourcePolicies?.find((p) => p.source === alias);
        const from = join && sources.get(join.from);
        const target =
          entry?.entity ??
          (join ? from?.entity.relations.find((r) => r.id === join.relation)?.target : q.root);
        const atSource = source(
          "query-part",
          alias,
          [...at.path, ...(join ? ["joins", alias] : ["root"])],
          q.version,
        );
        if (!entry)
          add(
            "QUERY_SOURCE_UNRESOLVED",
            `Resolve query source ${alias} before compilation.`,
            atSource,
          );
        if (entry && authority(entry.entity).store !== store)
          add(
            "QUERY_STORE_BOUNDARY",
            "A bounded query cannot join a different authoritative store.",
            atSource,
          );
        return {
          ...responsibility("query-source", [q.id, q.version, alias], atSource),
          alias,
          ...(target ? { target: entityLink(target) } : {}),
          ...(entry ? { nullable: entry.nullable } : {}),
          ...(join ? { join } : {}),
          access:
            alias === "root"
              ? policyLink(q.accessPolicy, q.accessProjection)
              : policyLink(access?.policy ?? { kind: "unresolved" }, access?.projection),
        };
      }),
      filters: byId(q.filters).map((f) => ({
        ...f,
        filter: f.id,
        ...responsibility(
          "query-filter",
          [q.id, q.version, f.id],
          source("query-part", f.id, [...at.path, "filters", f.id], q.version),
        ),
        comparisons: [...f.comparisons].sort(compare),
      })),
      projection: byId(q.projection).map((p) => ({
        ...p,
        output: p.id,
        ...responsibility(
          "query-projection",
          [q.id, q.version, p.id],
          source("query-part", p.id, [...at.path, "projection", p.id], q.version),
        ),
      })),
      order: q.order,
      limit: q.limit,
      cursor: q.cursor,
      freshness: q.freshness,
      accessSite: q.accessSite ?? "read",
      accessBefore: ["filter", "pagination", "count", "projection"],
    });
  }
  for (const b of byRef(model.accessBindings ?? [])) {
    const { id: _id, version: _version, name: _name, resource, policy, ...intent } = b;
    ir.accessBindings.push({
      ...responsibility("access-binding", [b.id, b.version], backendSource("accessBindings", b)),
      reference: exact(b),
      resource: entityLink(resource),
      access: policyLink(policy, b.projection),
      intent,
    });
  }
  sourceMap.sort((a, b) => compare(a.output, b.output));
  diagnostics.sort((a, b) =>
    compare(
      JSON.stringify([a.source.path, a.code, a.message]),
      JSON.stringify([b.source.path, b.code, b.message]),
    ),
  );
  // Detach before freezing: reports may reference registry arrays and IR may reference saved data.
  return freeze(
    structuredClone({
      schemaVersion: 1 as const,
      stage: "data" as const,
      enabled: true,
      sourceSnapshot: design,
      ir: JSON.parse(contractCanonical(ir)) as BackendDataIR,
      sourceMap,
      diagnostics,
      rawFindings: support.rawFindings,
      support,
    }),
  );
}
