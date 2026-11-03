/** Design consumer inventory, shared by authoring and chat. Never evaluates authorization. */
import { contractKey } from "./architecture-contracts.ts";
import { backendCapabilityExactReferences } from "./backend-capability-configs.ts";
import type { BackendReference } from "./backend-model.ts";
import type { BackendPolicyUse } from "./backend-policy.ts";
import type { DesignDocument } from "./design.ts";

export interface BackendPolicyConsumer {
  kind: "query" | "access-binding" | "operation" | "capability";
  reference: BackendReference;
  label: string;
  path: string;
  resolved: boolean;
  site?: string;
  action?: string;
  projection?: string;
  fields: string[];
  outputPaths?: string[];
}
export function backendPolicyConsumers(design: DesignDocument, policy: BackendReference) {
  const model = design.architecture?.backend;
  const result: BackendPolicyConsumer[] = [];
  const exact = ({ id, version }: BackendReference): BackendReference => ({ id, version });
  const matches = (s: BackendPolicyUse["selection"]) =>
    s.reference && contractKey(s.reference) === contractKey(policy);
  for (const q of model?.queries ?? []) {
    for (const source of [
      { source: "root", policy: q.accessPolicy, projection: q.accessProjection },
      ...(q.sourcePolicies ?? []),
    ]) {
      if (!matches(source.policy)) continue;
      const site = q.accessSite ?? "read";
      result.push({
        kind: "query",
        reference: exact(q),
        label: `${q.name} · ${source.source}`,
        path: `queries/${contractKey(q)}/${source.source}`,
        resolved: source.policy.kind === "policy",
        site,
        action: site === "read" ? "list" : site,
        projection: source.projection,
        fields: [
          ...new Set(
            [
              ...q.projection.map((p) => p.field),
              ...q.filters.map((f) => f.field),
              ...q.order.map((o) => o.field),
              ...q.cursor.fields,
            ]
              .filter((f) => f.source === source.source)
              .map((f) => f.field),
          ),
        ],
      });
    }
  }
  for (const b of model?.accessBindings ?? []) {
    if (!matches(b.policy)) continue;
    const target = b.target;
    const output =
      target.kind === "operation"
        ? design.architecture?.contracts
            ?.find((c) => contractKey(c) === contractKey(target.contract))
            ?.shape?.operations.find((o) => o.id === target.operation)?.output
        : undefined;
    result.push({
      kind: "access-binding",
      reference: exact(b),
      label: b.name,
      path: `accessBindings/${contractKey(b)}/${b.target.kind === "operation" ? `${contractKey(b.target.contract)}/${b.target.operation}` : contractKey(b.target.entity)}`,
      resolved: b.policy.kind === "policy",
      site: b.site,
      action: b.action,
      projection: b.projection,
      fields: b.target.kind === "projection" ? b.target.fields : [],
      ...(output ? { outputPaths: output.map((f) => `output/${f.id}`) } : {}),
    });
  }
  for (const o of model?.operations ?? []) {
    for (const [i, use] of [o.access, ...(o.access.participants ?? [])].entries()) {
      if (!matches(use.policy)) continue;
      result.push({
        kind: "operation",
        reference: exact(o),
        label: `${o.name} · ${i ? `participant ${i}` : "root"}`,
        path: `operations/${contractKey(o)}/access/${i}`,
        resolved: use.policy.kind === "policy",
        site: o.kind === "command" ? "write + current output + idempotent-replay" : "read",
        action: use.action,
        projection: [use.readProjection, use.writeProjection].filter(Boolean).join(", "),
        fields: [],
        outputPaths: o.outcomes.flatMap((outcome) =>
          outcome.values.map(
            (v) =>
              `outcomes/${outcome.outcome}/${v.field} ← ${v.value.kind === "current" ? `${contractKey(v.value.entity)}/${v.value.field}` : v.value.kind}`,
          ),
        ),
      });
    }
  }
  for (const c of model?.capabilityConfigs ?? []) {
    if (
      !backendCapabilityExactReferences(c).some(
        (r) =>
          r.collection === "accessPolicies" && contractKey(r.reference) === contractKey(policy),
      )
    )
      continue;
    result.push({
      kind: "capability",
      reference: exact(c),
      label: `${c.name} · ${c.kind}`,
      path: `capabilityConfigs/${contractKey(c)}`,
      resolved: true,
      fields: [],
    });
  }
  return result;
}
