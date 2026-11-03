/** Pure availability accounting over the original design. No projection, I/O or gate exemption. */
import { isExternalResponsibility } from "./architecture-choices.ts";
import {
  type ContractOwner,
  contractCanonical,
  contractKey,
  contractOwnerElement,
} from "./architecture-contracts.ts";
import type {
  BackendImplementation,
  ImplementationObligation,
} from "./backend-implementation-model.ts";
import { backendCollections } from "./backend-model.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";
import { plannedCapability } from "./planned-capabilities.ts";

export const implementationKey = (v: ImplementationObligation) =>
  `${v.kind}:${v.id}${v.version ? `@${v.version}` : ""}`;
type Requirement = {
  ref: ImplementationObligation;
  name: string;
  value: unknown;
  host?: string;
  stores: string[];
  transport?: string;
  context: string[];
  revocation: string[];
  contracts: string[];
  external: boolean;
};
const workload = new Set([
  "workloadShape",
  "peakRate",
  "workloadUnit",
  "workloadBoundary",
  "p95LatencyMs",
]);
const ignored = new Set([
  "id",
  "version",
  "name",
  "description",
  "notes",
  "responsibility",
  "technology",
  "detail",
  "rationale",
  "brief",
  "seamPath",
  "behavior",
  "condition",
  "reason",
]);
export type CapabilityOptionDemand = { path: string; value: string | number | boolean | null };
/** Finite comparison only. Array cardinalities and every non-prose semantic leaf stay visible.
 * Paths come from parsed typed declarations; no submitted paths or executable expressions run.
 */
export function capabilityOptionDemands(value: unknown, prefix = ""): CapabilityOptionDemand[] {
  if (value === undefined) return [];
  if (Array.isArray(value))
    return [
      { path: `${prefix}.length`, value: value.length },
      ...value.flatMap((v) => capabilityOptionDemands(v, `${prefix}.*`)),
    ];
  if (value && typeof value === "object")
    return Object.entries(value)
      .filter(([key]) => !ignored.has(key))
      .flatMap(([key, v]) => capabilityOptionDemands(v, prefix ? `${prefix}.${key}` : key));
  return prefix ? [{ path: prefix, value: value as CapabilityOptionDemand["value"] }] : [];
}
/** All C2/C3 availability barriers and all model declarations are individually accounted for. */
export function backendImplementationRequirements(design: DesignDocument): Requirement[] {
  const a = design.architecture,
    b = a?.backend;
  if (!b) return [];
  const result: Requirement[] = [];
  const ownerHost = (owner: ContractOwner | undefined) =>
    owner ? contractOwnerElement(design, owner) : undefined;
  const add = (
    ref: ImplementationObligation,
    name: string,
    value: unknown,
    extra: Partial<Omit<Requirement, "ref" | "name" | "value">> = {},
  ) =>
    result.push({
      ref,
      name,
      value,
      stores: [],
      context: [],
      revocation: [],
      contracts: [],
      external: false,
      ...extra,
    });
  for (const e of design.elements) {
    if (!e.planned) continue;
    const fields = plannedCapability(e.planned)?.fields ?? [];
    const config = Object.fromEntries(
      fields
        .filter((f) => !workload.has(f.key) && (f.options || typeof f.default !== "string"))
        .map((f) => [f.key, e.config[f.key] ?? f.default]),
    );
    add(
      { kind: "container", id: e.id },
      e.name,
      { family: e.planned, config },
      { host: e.id, external: isExternalResponsibility(e) },
    );
  }
  for (const c of a?.components ?? []) {
    if (!c.capability) continue;
    const fields = plannedCapability(c.capability)?.fields ?? [];
    const config = Object.fromEntries(
      fields
        .filter((f) => !workload.has(f.key) && (f.options || typeof f.default !== "string"))
        .map((f) => [f.key, c.config[f.key] ?? f.default]),
    );
    add(
      { kind: "component", id: c.id },
      c.name,
      { family: c.capability, config },
      { host: c.element },
    );
  }
  for (const c of design.connections.filter((c) => !!c.planned))
    add(
      { kind: "connection", id: c.id },
      c.id,
      {
        kind: c.kind,
        protocol: c.planned?.protocol,
        interaction: c.planned?.interaction,
        security: c.planned?.security,
      },
      { host: c.from.element },
    );
  for (const c of a?.componentRelationships ?? [])
    add(
      { kind: "component-relationship", id: c.id },
      c.id,
      { protocol: c.protocol, interaction: c.interaction },
      { host: a?.components?.find((v) => v.id === c.from)?.element },
    );
  for (const v of a?.bindings ?? []) {
    const provided = a?.interfaces?.find((i) => i.id === v.provided);
    add(
      { kind: "binding", id: v.id },
      v.name,
      { role: v.role, businessSynchrony: v.businessSynchrony, policies: v.policies },
      {
        host: ownerHost(provided?.owner),
        transport: v.transport,
        contracts: [contractKey(v.contract)],
      },
    );
  }
  for (const d of a?.datasets ?? [])
    add(
      { kind: "dataset", id: d.id },
      d.name,
      {
        tenant: d.tenant,
        deletion: d.deletion,
        exportAccess: d.exportAccess,
        retentionDays: d.retentionDays,
      },
      {
        host: ownerHost(d.owners[0]),
        stores: d.store ? [d.store] : [],
        contracts: [contractKey(d.contract)],
      },
    );
  for (const key of backendCollections) {
    if (key === "implementations") continue;
    for (const v of b[key] ?? []) {
      let host: string | undefined;
      let stores: string[] = [],
        context: string[] = [],
        revocation: string[] = [],
        contracts: string[] = [];
      const data = v as unknown as Record<string, unknown>;
      if (key === "operations") {
        const o = requiredValue(b.operations?.find((o) => o === v));
        host = ownerHost(o.target.owner);
        stores = [o.transaction.store];
        contracts = [contractKey(o.target.contract)];
      } else if (key === "entities") {
        const e = requiredValue(b.entities.find((e) => e === v)),
          d = a?.datasets?.find((d) => d.id === e.dataset);
        host = ownerHost(d?.owners[0]);
        stores = d?.store ? [d.store] : [];
        contracts = [contractKey(e.contract)];
      } else if (key === "aggregates") {
        const g = requiredValue(b.aggregates.find((g) => g === v));
        host = ownerHost(g.owner);
        stores = [g.store];
      } else if (key === "effects") {
        const e = requiredValue(b.effects?.find((e) => e === v)),
          o = b.operations?.find((o) => contractKey(o) === contractKey(e.source));
        host = ownerHost(o?.target.owner);
        stores = o ? [o.transaction.store] : [];
        contracts = [contractKey(e.payload)];
      } else if ("owner" in v) host = ownerHost(v.owner as ContractOwner);
      // Resolve exact references conservatively so type/context/recheck requirements cannot be
      // hidden in a dependency or supplied by a prose claim. IDs are retained in source intent.
      const refs = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const i of value) refs(i);
          return;
        }
        if (!value || typeof value !== "object") return;
        const r = value as { id?: string; version?: string };
        if (r.id && r.version) {
          const p = b.accessPolicies?.find(
            (p) => contractKey(p) === contractKey(r as { id: string; version: string }),
          );
          if (p) {
            context.push(
              p.context.identity,
              "correlation",
              ...(p.context.scope === "authorized-scope" ? ["authorized-scope"] : []),
            );
            revocation.push(...p.revocation.recheck);
          }
          const c = a?.contracts?.find((c) => c.id === r.id && c.version === r.version);
          if (c) contracts.push(contractKey(c));
          const e = b.entities.find((e) => e.id === r.id && e.version === r.version);
          if (e) {
            const d = a?.datasets?.find((d) => d.id === e.dataset);
            if (d?.store) stores.push(d.store);
            host ??= ownerHost(d?.owners[0]);
            contracts.push(contractKey(e.contract));
          }
          const g = b.aggregates.find((g) => g.id === r.id && g.version === r.version);
          if (g) {
            stores.push(g.store);
            host ??= ownerHost(g.owner);
          }
        }
        for (const i of Object.values(value)) refs(i);
      };
      refs(v);
      // Follow security semantics through exact queries/commands/hooks/settings. Do not merge
      // their separate transaction stores into the current operation's local transaction.
      const visited = new Set<string>();
      const security = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const item of value) security(item);
          return;
        }
        if (!value || typeof value !== "object") return;
        const r = value as { id?: string; version?: string };
        if (r.id && r.version) {
          const key = contractKey(r as { id: string; version: string });
          if (!visited.has(key)) {
            visited.add(key);
            const p = b.accessPolicies?.find((p) => contractKey(p) === key);
            if (p) {
              context.push(
                p.context.identity,
                "correlation",
                ...(p.context.scope === "authorized-scope" ? ["authorized-scope"] : []),
              );
              revocation.push(...p.revocation.recheck);
            }
            for (const collection of backendCollections)
              if (collection !== "implementations")
                for (const declaration of b[collection] ?? [])
                  if (contractKey(declaration) === key && declaration !== value)
                    security(declaration);
          }
        }
        for (const item of Object.values(value)) security(item);
      };
      security(v);
      if (key === "queries") revocation.push(b.queries?.find((q) => q === v)?.accessSite ?? "read");
      if (key === "operations") {
        const o = b.operations?.find((o) => o === v);
        revocation.push(
          o?.kind === "query" ? "read" : "write",
          ...(o?.idempotency.kind === "command-key" ? ["idempotent-replay"] : []),
        );
      }
      if (key === "effects") revocation.push("delivery");
      if (key === "capabilityConfigs" && "kind" in v) {
        if (v.kind === "files") revocation.push("bytes");
        if (v.kind === "notifications") revocation.push("materialization", "delivery");
        if (v.kind === "search") revocation.push("search");
      }
      if (key === "accessPolicies") {
        const p = requiredValue(b.accessPolicies?.find((p) => p === v));
        context.push(
          p.context.identity,
          "correlation",
          ...(p.context.scope === "authorized-scope" ? ["authorized-scope"] : []),
        );
        revocation.push(...p.revocation.recheck);
      }
      if (key === "accessBindings")
        revocation.push(requiredValue(b.accessBindings?.find((p) => p === v)).site);
      add(
        { kind: key === "operations" ? "operation" : key, id: v.id, version: v.version },
        v.name,
        data,
        {
          host,
          stores: [...new Set(stores)],
          context: [...new Set(context)],
          revocation: [...new Set(revocation)],
          contracts: [...new Set(contracts)],
        },
      );
    }
  }
  for (const c of a?.contracts ?? []) {
    // Shared definitions have no arbitrary first-consumer host. Only a unique host can
    // constrain their implementation; interface ordering must not retarget support.
    const hosts = [
      ...new Set(
        (a?.interfaces ?? [])
          .filter((i) => contractKey(i.contract) === contractKey(c))
          .map((i) => ownerHost(i.owner))
          .filter((h): h is string => !!h),
      ),
    ];
    add(
      { kind: "contract", id: c.id, version: c.version },
      c.name,
      {
        kind: c.kind,
        coverage: c.coverage,
        shape: c.shape,
        source: c.source,
        sourceSnapshot: c.sourceSnapshot,
        sourceDesignRevision: c.sourceDesignRevision,
      },
      {
        host: hosts.length === 1 ? hosts[0] : undefined,
      },
    );
  }
  return result.sort((a, b) =>
    implementationKey(a.ref).localeCompare(implementationKey(b.ref), "en"),
  );
}
const selected = (design: DesignDocument) => design.architecture?.backend?.implementations ?? [];
const same = (a: ImplementationObligation, b: ImplementationObligation) =>
  implementationKey(a) === implementationKey(b);
const claims = (b: BackendImplementation) => [b.target, ...b.obligations];
export function validateBackendImplementations(design: DesignDocument): Finding[] {
  const requirements = backendImplementationRequirements(design),
    result: Finding[] = [];
  for (const b of selected(design)) {
    const add = (message: string) =>
      result.push(
        finding("UNKNOWN_REFERENCE", `${b.name}: ${message}`, {
          path: ["architecture", "backend", "implementations", contractKey(b)],
        }),
      );
    for (const ref of claims(b))
      if (!requirements.some((r) => same(r.ref, ref)))
        add(`exact obligation ${implementationKey(ref)} does not exist.`);
    for (const h of b.hooks)
      if (!design.architecture?.backend?.hooks?.some((v) => contractKey(v) === contractKey(h.hook)))
        add(`hook ${contractKey(h.hook)} does not exist.`);
    if (b.store && !design.elements.some((e) => e.id === b.store))
      add(`store ${b.store} does not exist.`);
    if (
      b.environment &&
      !design.architecture?.bindings?.some((v) => v.id === b.environment?.adapterBinding)
    )
      add("environment adapter binding does not exist.");
    if (new Set(claims(b).map(implementationKey)).size !== claims(b).length)
      result.push(
        finding("CONFIG_INVALID", `${b.name}: an obligation is repeated.`, {
          path: ["architecture", "backend", "implementations", contractKey(b)],
        }),
      );
    if (new Set(b.hooks.map((h) => h.slot)).size !== b.hooks.length)
      result.push(
        finding("CONFIG_INVALID", `${b.name}: a hook slot is repeated.`, {
          path: ["architecture", "backend", "implementations", contractKey(b)],
        }),
      );
  }
  return result;
}
/** Preserve exact definitions already selected by implementation bindings, even if a consumer
 * is removed in the same batch. Binding selection remains deliberately editable.
 */
export function validateBackendImplementationTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const refs = selected(before)
    .flatMap((b) => [
      b.target,
      ...b.obligations,
      ...b.hooks.map((h) => ({ kind: "hooks" as const, ...h.hook })),
    ])
    .filter((r) => r.version);
  const left = backendImplementationRequirements(before),
    right = backendImplementationRequirements(after);
  return refs.flatMap((ref) => {
    const old = left.find((r) => same(r.ref, ref)),
      next = right.find((r) => same(r.ref, ref));
    const semantics = (v: unknown) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== "name"))
        : v;
    if (
      !old ||
      (next && contractCanonical(semantics(old.value)) === contractCanonical(semantics(next.value)))
    )
      return [];
    return [
      finding(
        "CONFIG_INVALID",
        `Implementation-selected definition ${implementationKey(ref)} is immutable; preserve it and create a successor.`,
        { path: ["architecture", "backend", "implementations"] },
      ),
    ];
  });
}

function requiredValue<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Expected a validated model member.");
  return value;
}
