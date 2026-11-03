/** Complete pure compiler plan. No emitter, filesystem, clock, provider or runtime execution. */
import {
  backendImplementationRequirements,
  contractCanonical,
  contractKey,
  contractOwnerElement,
  type DesignDocument,
  type ImplementationObligation,
  isExternalResponsibility,
  type TemplateLookup,
} from "@jeeves/spec";
import type {
  BackendDiagnostic,
  BackendIR,
  BackendPlan,
  BackendPlanMode,
  BackendReadonly,
  BackendResponsibility,
  BackendSource,
} from "./backend-ir.ts";
import { backendIdentity, backendName, lowerBackendData } from "./backend-plan.ts";

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = <T extends { id: string; version?: string }>(values: readonly T[]) =>
  [...values].sort((a, b) =>
    compare(JSON.stringify([a.id, a.version]), JSON.stringify([b.id, b.version])),
  );
const ref = ({ id, version }: { id: string; version: string }) => ({ id, version });
const equal = (a: { id: string; version?: string }, b: { id: string; version?: string }) =>
  a.id === b.id && a.version === b.version;
const obligationEqual = (a: ImplementationObligation, b: ImplementationObligation) =>
  a.kind === b.kind && equal(a, b);
function immutable<T>(value: T): BackendReadonly<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value as BackendReadonly<T>;
}
const intent = <T extends { id: string; name?: string; version?: string }>(value: T) => {
  const { id: _id, name: _name, version: _version, ...rest } = value;
  return rest;
};

/** Sort only declared sets/maps. Action order, field paths, key tuples and routing rules
 * remain ordered. Wire parameter/header names and registered strategy names are semantic.
 */
function semanticIntent<T>(value: T, kind: BackendSource["kind"]): T {
  const sets = new Set([
    "guards",
    "writes",
    "outcomes",
    "participants",
    "queryInputs",
    "records",
    "queries",
    "inputs",
    "outputs",
    "hookInputs",
    "versionChecks",
    "hashInputs",
    "values",
    "dependencies",
    "repositories",
    "services",
    "allowedWrites",
    "allowedEffects",
    "context",
    "acceptance",
    "recovery",
    "after",
    "members",
    "usesResources",
    "usesConnections",
    "owners",
    "readers",
    "writers",
    "states",
    "transitions",
    "obligations",
    "hooks",
  ]);
  const contractSets = new Set([
    "payload",
    "fields",
    "input",
    "output",
    "operations",
    "types",
    "outcomes",
    "parameters",
    "responses",
    "headers",
    "variants",
    "enumValues",
  ]);
  const visit = (v: unknown, key = ""): unknown => {
    if (key === "config" || kind === "capabilityConfigs") return v;
    if (Array.isArray(v)) {
      const items = v.map((child) => visit(child));
      return (
        kind === "contract"
          ? contractSets.has(key)
          : sets.has(key) ||
            (key === "input" && items.every((v) => v !== null && typeof v === "object"))
      )
        ? items.sort((x, y) => compare(contractCanonical(x), contractCanonical(y)))
        : items;
    }
    if (!v || typeof v !== "object") return v;
    const record = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record)
        .filter(
          ([k]) =>
            !("id" in record && ["name", "description"].includes(k)) &&
            !(kind === "component" && ["responsibility", "technology"].includes(k)) &&
            !(kind === "connection" && k === "label"),
        )
        .map(([k, child]) => [k, visit(child, k)]),
    );
  };
  return visit(value) as T;
}

/** Analysis always returns all intent. Foundation/complete evaluate their own explicit mode.
 * `ready` means a fully accounted plan, not a runnable or verified application.
 */
export function planBackend(
  design: DesignDocument,
  lookup: TemplateLookup,
  options: { mode: BackendPlanMode },
): BackendPlan {
  if (!["analysis", "foundation", "complete"].includes(options.mode))
    throw new Error("Select an explicit backend plan mode.");
  const data = lowerBackendData(design, lookup);
  const model = design.architecture?.backend,
    a = design.architecture;
  const diagnostics: BackendDiagnostic[] = structuredClone(data.diagnostics) as BackendDiagnostic[];
  const sourceMap = structuredClone(data.sourceMap) as { output: string; source: BackendSource }[];
  const ir: BackendIR | undefined = data.ir
    ? {
        ...(structuredClone(data.ir) as BackendIR),
        intents: [],
        operationAdapters: [],
        transactions: [],
        effects: [],
        runtimeDependencies: [],
        hookObligations: [],
      }
    : undefined;
  const add = (code: string, message: string, source: BackendSource) =>
    diagnostics.push({ code, message, source });
  const source = (
    kind: BackendSource["kind"],
    id: string,
    path: (string | number)[],
    version?: string,
  ): BackendSource => ({ kind, id, path, ...(version ? { version } : {}) });
  const atBackend = (
    kind: BackendSource["kind"],
    value: { id: string; version: string },
    collection: string = kind,
  ) =>
    source(
      kind,
      value.id,
      ["architecture", "backend", collection, contractKey(value)],
      value.version,
    );
  const ids = new Set(sourceMap.map((s) => s.output));
  const names = new Set<string>();
  const make = (kind: string, at: BackendSource): BackendResponsibility => {
    const parts = [at.id, ...(at.version ? [at.version] : [])];
    const id = backendIdentity(kind, ...parts),
      name = backendName(kind, ...parts);
    if (ids.has(id)) add("IDENTITY_COLLISION", `Compiler responsibility ${id} is repeated.`, at);
    if (names.has(name)) add("NAME_COLLISION", `Compiler symbol ${name} is repeated.`, at);
    ids.add(id);
    names.add(name);
    sourceMap.push({ output: id, source: at });
    return { id, name, source: at };
  };
  const host = (id: string | undefined) => ir?.hosts.find((h) => h.element === id)?.id;
  const ownerHost = (owner: Parameters<typeof contractOwnerElement>[1]) =>
    host(contractOwnerElement(design, owner));
  const link = (r: { id: string; version: string }) => ({
    reference: ref(r),
    ...(ir?.entities.some((e) => equal(e.reference, r))
      ? { entity: backendIdentity("entity", r.id, r.version) }
      : {}),
  });
  if (ir && model && a) {
    // Preserve all original executable graph identities, even those with no planned family.
    const declaration = (
      kind: BackendSource["kind"],
      values: readonly { id: string; version?: string }[],
      path: string[],
      hostFor?: (id: string) => string | undefined,
    ) => {
      for (const value of sorted(values))
        ir.intents.push({
          ...make(
            `intent-${kind}`,
            source(
              kind,
              value.id,
              [
                ...path,
                value.version ? contractKey({ id: value.id, version: value.version }) : value.id,
              ],
              value.version,
            ),
          ),
          host: hostFor?.(value.id),
          intent: semanticIntent(intent(value), kind),
        });
    };
    declaration("component", a.components ?? [], ["architecture", "components"], (id) =>
      host(a.components?.find((c) => c.id === id)?.element),
    );
    declaration("connection", design.connections, ["connections"]);
    declaration("component-relationship", a.componentRelationships ?? [], [
      "architecture",
      "componentRelationships",
    ]);
    declaration("binding", a.bindings ?? [], ["architecture", "bindings"]);
    declaration("interface", a.interfaces ?? [], ["architecture", "interfaces"]);
    declaration("dataset", a.datasets ?? [], ["architecture", "datasets"]);
    declaration("contract", a.contracts ?? [], ["architecture", "contracts"]);
    declaration("lifecycles", model.lifecycles ?? [], ["architecture", "backend", "lifecycles"]);
    declaration("capabilityConfigs", model.capabilityConfigs ?? [], [
      "architecture",
      "backend",
      "capabilityConfigs",
    ]);
    for (const e of sorted(design.elements))
      for (const attachment of sorted(e.attachments)) {
        const at = source("attachment", attachment.id, [
          "elements",
          e.id,
          "attachments",
          attachment.id,
        ]);
        // Attachment identity is local to its host; no global aliasing across applications.
        const output = {
          ...make(`attachment-${e.id}`, at),
          host: host(e.id),
          intent: intent(attachment),
        };
        ir.intents.push(output);
      }
    for (const component of a.components ?? [])
      if (!host(component.element))
        add(
          "OWNER_UNRESOLVED",
          "Original component has no application host.",
          source("component", component.id, ["architecture", "components", component.id]),
        );
    for (const provided of sorted((a.interfaces ?? []).filter((i) => i.direction === "provided"))) {
      const h = contractOwnerElement(design, provided.owner);
      const contract = a.contracts?.find((c) => equal(c, provided.contract));
      if (contract?.kind !== "api") continue;
      for (const operation of sorted(contract.shape?.operations ?? []))
        if (
          !model.implementations?.some(
            (s) =>
              s.target.kind === "container" &&
              s.target.id === h &&
              s.environment &&
              design.elements.some((e) => e.id === h && isExternalResponsibility(e)) &&
              a.bindings?.some(
                (b) =>
                  b.id === s.environment?.adapterBinding &&
                  b.provided === provided.id &&
                  (!b.operation || b.operation === operation.id) &&
                  s.obligations.some((o) => o.kind === "binding" && o.id === b.id),
              ),
          ) &&
          !model.operations?.some(
            (o) =>
              equal(o.target.contract, contract) &&
              o.target.operation === operation.id &&
              o.target.owner.kind === provided.owner.kind &&
              o.target.owner.id === provided.owner.id,
          )
        )
          add(
            "OPERATION_UNACCOUNTED",
            "A provided API operation needs exact backend behavior or an explicit external implementation.",
            source("interface", provided.id, [
              "architecture",
              "interfaces",
              provided.id,
              "operations",
              operation.id,
            ]),
          );
    }
    const routes = new Map<string, string>();
    for (const o of sorted(model.operations ?? [])) {
      const at = atBackend("operation", o, "operations"),
        h = ownerHost(o.target.owner);
      const wire = a.contracts
        ?.find((c) => equal(c, o.target.contract))
        ?.shape?.operations.find((v) => v.id === o.target.operation);
      const aggregate = ir.aggregates.find((g) => equal(g.reference, o.aggregate));
      const store = host(o.transaction.store);
      if (
        !h ||
        !aggregate ||
        (o.protocol?.execution !== "authorized-worker" && aggregate.host !== h) ||
        aggregate.store !== store
      )
        add(
          "OPERATION_BOUNDARY",
          "Operation requires its exact aggregate host and authoritative store.",
          at,
        );
      for (const participant of o.transaction.participants) {
        const entity = ir.entities.find((e) => equal(e.reference, participant));
        if (
          !entity ||
          (o.protocol?.execution !== "authorized-worker" && entity.host !== h) ||
          entity.store !== store
        )
          add(
            "TRANSACTION_BOUNDARY",
            "Every transaction participant must resolve in the same host/store.",
            at,
          );
      }
      const transaction = make("transaction", at);
      ir.transactions.push({
        ...transaction,
        operation: backendIdentity("operation", o.id, o.version),
        host: h,
        store,
        participants: sorted(o.transaction.participants).map(link),
        intent: { ...o.transaction, participants: sorted(o.transaction.participants) },
      });
      ir.operationAdapters.push({
        ...make("operation", at),
        reference: ref(o),
        host: h,
        aggregate: aggregate?.id,
        transaction: transaction.id,
        policy: {
          selection: o.access.policy,
          ...(o.access.policy.kind === "policy" &&
          ir.policies.some(
            (p) => o.access.policy.reference && equal(p.reference, o.access.policy.reference),
          )
            ? {
                policy: backendIdentity(
                  "policy",
                  o.access.policy.reference.id,
                  o.access.policy.reference.version,
                ),
              }
            : {}),
          ...(o.access.readProjection ? { projection: o.access.readProjection } : {}),
        },
        ...(wire?.transport ? { transport: semanticIntent(wire.transport, "contract") } : {}),
        intent: semanticIntent(intent(o), "operation"),
      });
      if (wire?.transport && h) {
        const route = backendIdentity(
          "route",
          h,
          wire.transport.method,
          wire.transport.path.replace(/\{[^}]+\}/g, "{}").replace(/\/$/, "") || "/",
        );
        if (routes.has(route))
          add(
            "ROUTE_COLLISION",
            `Route conflicts with ${routes.get(route)} in the same application.`,
            at,
          );
        routes.set(route, contractKey(o));
      }
    }
    for (const e of sorted(model.effects ?? []))
      ir.effects.push({
        ...make("effect", atBackend("effects", e)),
        reference: ref(e),
        operation: ir.operationAdapters.find((o) => equal(o.reference, e.source))?.id,
        predecessors: sorted(e.after).map((p) => backendIdentity("effect", p.id, p.version)),
        intent: semanticIntent(intent(e), "effects"),
      });
    const paths = new Map<string, string>();
    for (const hook of sorted(model.hooks ?? [])) {
      const at = atBackend("hooks", hook),
        h = ownerHost(hook.owner);
      const path = backendIdentity("hook-path", h ?? "unresolved", hook.seam.file);
      if (paths.has(path))
        add("HOOK_PATH_COLLISION", `Project hook path conflicts with ${paths.get(path)}.`, at);
      paths.set(path, contractKey(hook));
      ir.hookObligations.push({
        ...make("hook", at),
        reference: ref(hook),
        host: h,
        operation: ir.operationAdapters.find((o) => equal(o.reference, hook.operation))?.id,
        intent: semanticIntent(intent(hook), "hooks"),
      });
    }
    const selections = model.implementations ?? [];
    const requirements = backendImplementationRequirements(design);
    for (const selected of sorted(selections)) {
      const at = atBackend("implementation", selected, "implementations");
      const descriptor = lookup
        .get(selected.template)
        ?.capabilities?.find((c) => equal(c, selected.capability));
      const h = host(requirements.find((r) => obligationEqual(r.ref, selected.target))?.host);
      const dependencies: string[] = [];
      for (const dep of descriptor?.dependencies ?? []) {
        const matches = selections.filter(
          (s) =>
            equal(s.template, dep.template) &&
            equal(s.capability, dep.capability) &&
            host(requirements.find((r) => obligationEqual(r.ref, s.target))?.host) === h,
        );
        if (!matches.length)
          add(
            "DEPENDENCY_UNRESOLVED",
            "A runtime dependency requires an exact compatible same-host selection.",
            at,
          );
        for (const match of sorted(matches))
          dependencies.push(backendIdentity("runtime", match.id, match.version));
      }
      ir.runtimeDependencies.push({
        ...make("runtime", at),
        implementation: ref(selected),
        host: h,
        template: ref(selected.template),
        capability: ref(selected.capability),
        selection: semanticIntent(intent(selected), "implementation"),
        ...(descriptor ? { origin: descriptor.origin } : {}),
        dependencies: dependencies.sort(compare),
        ...(selected.environment ? { environment: selected.environment } : {}),
        evidencePackIds: [...(descriptor?.evidencePackIds ?? [])].sort(compare),
      });
    }
    // Dependencies are finite; ordinary C2 call cycles are legal, execution dependency cycles are not.
    const cycles = (
      rows: { id: string; source: BackendSource }[],
      next: (id: string) => readonly string[],
      code: string,
    ) => {
      const done = new Set<string>(),
        active = new Set<string>();
      const visit = (row: { id: string; source: BackendSource }) => {
        if (active.has(row.id)) {
          add(code, "Execution dependencies contain a cycle.", row.source);
          return;
        }
        if (done.has(row.id)) return;
        active.add(row.id);
        for (const id of next(row.id)) {
          const child = rows.find((r) => r.id === id);
          if (child) visit(child);
        }
        active.delete(row.id);
        done.add(row.id);
      };
      for (const row of rows) visit(row);
    };
    cycles(
      ir.runtimeDependencies,
      (id) => ir.runtimeDependencies.find((r) => r.id === id)?.dependencies ?? [],
      "DEPENDENCY_CYCLE",
    );
    cycles(
      ir.effects,
      (id) => ir.effects.find((e) => e.id === id)?.predecessors ?? [],
      "EFFECT_CYCLE",
    );
    cycles(
      ir.hookObligations,
      (id) =>
        ir.hookObligations
          .find((h) => h.id === id)
          ?.intent.dependencies.map((d) => backendIdentity("hook", d.id, d.version)) ?? [],
      "HOOK_CYCLE",
    );
  }
  const accounting: BackendReadonly<BackendPlan>["accounting"] = data.support.obligations.map(
    (row) => {
      const outputs = sourceMap
        .filter((s) => s.source.kind === row.obligation.kind && equal(s.source, row.obligation))
        .map((s) => s.output)
        .sort(compare);
      const selected = model?.implementations?.find((b) => contractKey(b) === row.binding);
      const hookReady =
        row.hooks.length > 0 &&
        row.hooks.every(
          (h) =>
            h.ready &&
            h.hook &&
            ir?.hookObligations.some((v) => contractKey(v.reference) === h.hook),
        );
      const accounted = outputs.length > 0;
      if (!accounted)
        add(
          "UNACCOUNTED_INTENT",
          "Exact original obligation has no compiler responsibility.",
          source(
            row.obligation.kind,
            row.obligation.id,
            ["architecture", "backend"],
            row.obligation.version,
          ),
        );
      return {
        obligation: row.obligation,
        outputs,
        binding: row.binding,
        status: !accounted
          ? "unsupported"
          : row.status === "supported"
            ? selected?.environment
              ? "external"
              : "supported"
            : row.status === "needs-explicit-hook" && hookReady
              ? "hooked"
              : "unsupported",
      };
    },
  );
  const allowed = (o: ImplementationObligation) =>
    accounting.some(
      (r) =>
        obligationEqual(r.obligation, o) &&
        r.status !== "unsupported" &&
        (r.status !== "hooked" || options.mode === "foundation"),
    );
  const availability = data.rawFindings
    .filter((f) => f.code === "NEEDS_TEMPLATE")
    .map((f) => {
      const t = f.target,
        p = t.path;
      let obligations: ImplementationObligation[] = [];
      if (p?.length === 2 && p[0] === "architecture" && p[1] === "backend")
        obligations = data.support.obligations
          .filter(
            (r) =>
              ![
                "container",
                "component",
                "connection",
                "component-relationship",
                "binding",
                "dataset",
                "contract",
              ].includes(r.obligation.kind),
          )
          .map((r) => r.obligation);
      else if (p?.length === 4 && p[0] === "architecture" && p[1] === "backend" && p[2] === "hooks")
        obligations =
          options.mode === "foundation"
            ? data.support.obligations
                .filter(
                  (r) =>
                    r.obligation.kind === "hooks" &&
                    contractKey({ id: r.obligation.id, version: r.obligation.version ?? "" }) ===
                      p[3],
                )
                .map((r) => r.obligation)
            : [];
      else if (p?.length === 3 && p[0] === "architecture" && p[1] === "components")
        obligations = [{ kind: "component", id: String(p[2]) }];
      else if (
        !p &&
        t.connection &&
        design.connections.some((c) => c.id === t.connection && c.planned)
      )
        obligations = [{ kind: "connection", id: t.connection }];
      else if (
        !p &&
        t.element &&
        !t.attachment &&
        design.elements.some((e) => e.id === t.element && e.planned)
      )
        obligations = [{ kind: "container", id: t.element }];
      return {
        finding: f,
        obligations,
        discharged: obligations.length > 0 && obligations.every(allowed),
      };
    });
  const blockingFindings = data.rawFindings.filter(
    (f) =>
      f.severity === "error" &&
      (f.code !== "NEEDS_TEMPLATE" || !availability.find((v) => v.finding === f)?.discharged),
  );
  const pendingHooks = ir?.hookObligations.map((h) => h.id) ?? [];
  if (options.mode === "complete")
    for (const h of ir?.hookObligations ?? [])
      add(
        "HOOK_IMPLEMENTATION_PENDING",
        "Project-owned hook implementation and application acceptance remain pending.",
        h.source,
      );
  const blockingDiagnostics = diagnostics.filter(
    (d) =>
      !(
        options.mode === "foundation" &&
        d.code === "SUPPORT_HOOK_PENDING" &&
        accounting.some(
          (r) =>
            r.status === "hooked" &&
            r.obligation.kind === d.source.kind &&
            equal(r.obligation, d.source),
        )
      ),
  );
  const diagnosticOrder = (x: BackendDiagnostic, y: BackendDiagnostic) =>
    compare(contractCanonical(x), contractCanonical(y));
  diagnostics.sort(diagnosticOrder);
  blockingDiagnostics.sort(diagnosticOrder);
  sourceMap.sort((x, y) => compare(x.output, y.output));
  return immutable(
    structuredClone({
      schemaVersion: 1 as const,
      stage: "complete-plan" as const,
      enabled: data.enabled,
      mode: options.mode,
      ready:
        options.mode !== "analysis" &&
        !!ir &&
        accounting.length > 0 &&
        !blockingFindings.length &&
        !blockingDiagnostics.length &&
        accounting.every(
          (r) =>
            r.status !== "unsupported" && (r.status !== "hooked" || options.mode === "foundation"),
        ),
      runtimeOutputAvailable: false as const,
      snapshot: {
        schemaVersion: 1 as const,
        compilerVersion: "1" as const,
        mode: options.mode,
        design,
      },
      ...(ir ? { ir: JSON.parse(contractCanonical(ir)) as BackendIR } : {}),
      sourceMap,
      diagnostics,
      blockingDiagnostics,
      rawFindings: data.rawFindings,
      blockingFindings,
      availability,
      accounting,
      pendingHooks,
      support: data.support,
    }),
  );
}

export class BackendCompilationError extends Error {
  constructor(public readonly plan: BackendPlan) {
    super(
      [
        ...plan.blockingFindings.map((f) => f.message),
        ...plan.blockingDiagnostics.map((d) => d.message),
        "Backend plan is not ready for the selected mode.",
      ].join("\n"),
    );
  }
}
/** Strict pure boundary: unsupported intent stops here before any future output writer. */
export function compileBackendPlan(
  design: DesignDocument,
  lookup: TemplateLookup,
  options: { mode: "foundation" | "complete" },
): BackendPlan {
  const plan = planBackend(design, lookup, options);
  if (!plan.ready) throw new BackendCompilationError(plan);
  return plan;
}

/** Complete JSON includes authored snapshot, raw diagnostics, plan, accounting and source map. */
export const backendPlanJson = (plan: BackendPlan): string => `${contractCanonical(plan)}\n`;
/** Text is lossless and deterministic: the inspectable JSON envelope follows the concise status. */
export const backendPlanText = (plan: BackendPlan): string =>
  [
    `Backend plan v1 · ${plan.mode} · ${plan.ready ? "plan ready" : "blocked/analysis"}`,
    "Runtime output: unavailable; verification: unobserved",
    `Pending project hooks: ${plan.pendingHooks.length}; blocking findings: ${plan.blockingFindings.length}; blocking diagnostics: ${plan.blockingDiagnostics.length}`,
    ...Object.entries(plan.ir ?? {})
      .filter(([, value]) => Array.isArray(value))
      .map(([collection, value]) => `${collection}: ${(value as readonly unknown[]).length}`),
    ...plan.accounting.map(
      (row) =>
        `${JSON.stringify(row.obligation)}: ${row.status}; outputs ${row.outputs.length}; implementation ${row.binding ?? "unbound"}`,
    ),
    `Source map: ${plan.sourceMap.length} responsibilities. Complete snapshot, intent, raw findings and mappings follow.`,
    "",
    JSON.stringify(JSON.parse(backendPlanJson(plan)), null, 2),
    "",
  ].join("\n");
