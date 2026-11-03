import {
  type Architecture,
  type BackendCapabilityConfig,
  type BackendReference,
  backendCapabilityExactReferences,
  backendEntityFields,
  contractKey,
  type DesignDocument,
} from "@jeeves/spec";
import type { BackendArea } from "./BackendEffectFields.tsx";
import type { Option } from "./BackendFields.tsx";

type Item = { id: string; name?: string };
export const row = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const key = (v: unknown) => {
  const r = row(v);
  return r.id && r.version ? contractKey(r as BackendReference) : "";
};
export function settingReferences(c: BackendCapabilityConfig) {
  // This traversal is the same authority used by validation, reuse and export.
  return backendCapabilityExactReferences(c);
}
export function settingLocalOptions({
  design,
  draft,
  config: c,
  parent,
  path,
}: {
  design: DesignDocument;
  draft: Architecture;
  config: BackendCapabilityConfig;
  parent: unknown;
  path: (string | number)[];
}): { options: Option[]; open?: { kind: BackendArea; key: string } } | undefined {
  const m = draft.backend,
    p = row(parent),
    root = row(c),
    last = String(path.at(-1)),
    names = path.filter((v) => typeof v === "string"),
    prop = String(names.at(-1)),
    container = String(names.at(-2));
  const options = (items: (Item | string)[] | undefined) => [
    ...new Map(
      (items ?? [])
        .map((v) =>
          typeof v === "string"
            ? { value: v, label: v }
            : { value: v.id, label: v.name ? `${v.name} · ${v.id}` : v.id },
        )
        .map((v) => [v.value, v]),
    ).values(),
  ];
  const entity = (r: unknown) => m?.entities.find((e) => contractKey(e) === key(r));
  const fields = (r: unknown) => {
    const e = entity(r);
    return e ? backendEntityFields({ ...design, architecture: draft }, e) : [];
  };
  const operation = (r: unknown) => m?.operations?.find((o) => contractKey(o) === key(r));
  const query = (r: unknown) => m?.queries?.find((q) => contractKey(q) === key(r));
  const policy = m?.accessPolicies?.find((v) => contractKey(v) === key(p.policy));
  const lifecycleRef = row(root.lifecycle).reference ?? root.lifecycle;
  const life = m?.lifecycles?.find((v) => contractKey(v) === key(lifecycleRef));
  const opRef = p.operation ?? root.operation;
  const op = operation(opRef);
  if (prop === "field") {
    if (p.entity)
      return { options: options(fields(p.entity)), open: { kind: "entities", key: key(p.entity) } };
    const eventRef = p.event ?? row(root.queue).event;
    const event = draft.contracts?.find((v) => contractKey(v) === key(eventRef));
    return {
      options: options(event?.shape?.payload),
      open: { kind: "contracts", key: key(eventRef) },
    };
  }
  if (prop === "fields") {
    const ref = root.source ?? query(root.recipients)?.root;
    return { options: options(fields(ref)), open: { kind: "entities", key: key(ref) } };
  }
  if (prop === "recipient")
    return {
      options: options(query(root.recipients)?.projection),
      open: { kind: "queries", key: key(root.recipients) },
    };
  if (["principal", "enabled", "principalFilter", "filter"].includes(prop)) {
    const ref = prop === "filter" ? root.recipients : p.query;
    const q = query(ref);
    return {
      options: options(
        prop === "filter" || prop === "principalFilter" ? q?.filters : q?.projection,
      ),
      open: { kind: "queries", key: key(ref) },
    };
  }
  if (prop === "action" || prop === "projection")
    return {
      options: options(
        prop === "projection" ? policy?.projections : policy?.rules.flatMap((r) => r.actions),
      ),
      open: { kind: "policies", key: key(p.policy) },
    };
  if (prop === "dataset")
    return {
      options: options(draft.datasets),
      open: { kind: "datasets", key: String(p.dataset ?? "") },
    };
  if (container === "states" || prop === "runningStates" || prop === "paymentReview")
    return { options: options(life?.states), open: { kind: "lifecycles", key: key(lifecycleRef) } };
  if (prop === "guards" || prop === "predicates" || prop === "actions") {
    const source =
      prop === "guards" && p.reference
        ? m?.operations?.filter((v) =>
            v.actions.some((a) => a.kind === "transition" && key(a.lifecycle) === key(p.reference)),
          )
        : op
          ? [op]
          : [];
    return {
      options:
        source?.flatMap((v) =>
          options(
            prop === "actions"
              ? v.actions.filter((a) => a.kind === "patch" || a.kind === "transition")
              : v.guards,
          ),
        ) ?? [],
      open: op ? { kind: "operations", key: key(op) } : undefined,
    };
  }
  if (prop === "relation") {
    const e = root.line ?? root.reservation;
    return { options: options(entity(e)?.relations), open: { kind: "entities", key: key(e) } };
  }
  if (prop === "outcome")
    return {
      options: options(operation(p.operation)?.outcomes.map((v) => v.outcome)),
      open: { kind: "operations", key: key(p.operation) },
    };
  if (prop === "interface")
    return {
      options: options(
        draft.interfaces?.filter(
          (v) => v.direction === "provided" && key(v.contract) === key(p.contract),
        ),
      ),
      open: { kind: "interfaces", key: String(p.interface ?? "") },
    };
  if (prop === "binding")
    return {
      options: options(draft.bindings?.filter((v) => key(v.contract) === key(p.contract))),
      open: { kind: "bindings", key: String(p.binding ?? "") },
    };
  if (prop === "operation" && p.contract)
    return {
      options: options(
        draft.contracts?.find((v) => contractKey(v) === key(p.contract))?.shape?.operations,
      ),
      open: { kind: "contracts", key: key(p.contract) },
    };
  // Authored identities are bounded strings; the other stable IDs must resolve to declarations.
  if (
    ["channel", "credentialRef"].includes(prop) ||
    (last === "id" && (container === "environment" || container === "rules"))
  )
    return undefined;
  return undefined;
}
