/** Pure checks and shared reference handling. Descriptors never perform I/O or run hooks. */

import type { Architecture } from "./architecture.ts";
import {
  contractCanonical,
  contractKey,
  contractOwnerElement,
  resolveContractValue,
} from "./architecture-contracts.ts";
import { backendValueChecks, backendValueFits } from "./backend-behavior.ts";
import { backendCapabilityExactReferences } from "./backend-capability-configs.ts";
import type { BackendEffect, BackendHook, BackendRecovery } from "./backend-effects-model.ts";
import type { BackendModel, BackendReference } from "./backend-model.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

const same = (a: BackendReference, b: BackendReference) => contractKey(a) === contractKey(b);
type Declaration = BackendEffect | BackendHook;
/** All outer dependencies in one place; field/outcome/invariant/acceptance/file IDs stay local. */
export function backendEffectReferences(v: Declaration): string[] {
  const recovery = v.recovery.flatMap((r) => [
    r.operation.id,
    r.scenario.id,
    ...r.invariants.map((i) => i.aggregate.id),
    ...(r.reconcileOperation ? [r.reconcileOperation.id] : []),
  ]);
  if ("source" in v) {
    const t = v.target;
    return [
      v.source.id,
      v.payload.id,
      ...v.after.map((r) => r.id),
      ...(v.relationshipBinding ? [v.relationshipBinding] : []),
      ...("contract" in t ? [t.contract.id] : []),
      ...("dataset" in t ? [t.dataset] : []),
      ...("operation" in t ? [t.operation.id] : []),
      ...(t.kind === "event" && t.consumer ? [t.consumer.id] : []),
      ...(t.kind === "projection" ? [t.query.id] : []),
      ...(t.kind === "notification" ? [t.recipients.id] : []),
      ...(t.kind === "hook" ? [t.hook.id] : []),
      ...v.values.flatMap((m) => (m.value.kind === "current" ? [m.value.entity.id] : [])),
      ...recovery,
    ];
  }
  return [
    v.operation.id,
    v.owner.id,
    ...Object.values(v.contracts).map((r) => r.id),
    ...v.dependencies.map((r) => r.id),
    ...v.repositories.map((r) => r.id),
    ...v.services.map((r) => r.id),
    v.failure.operation.id,
    ...v.allowedWrites.map((w) => w.entity.id),
    ...v.allowedEffects.map((r) => r.id),
    ...recovery,
  ];
}
/** Supporting scenario/C2 graph identities must stay pinned with reused exact declarations. */
export function backendEffectContextReferences(architecture: Architecture): string[] {
  const keep = new Set(
    [...(architecture.backend?.effects ?? []), ...(architecture.backend?.hooks ?? [])]
      .flatMap(backendEffectReferences)
      .concat(
        (architecture.backend?.operations ?? []).flatMap((o) =>
          o.protocol?.provider ? [o.protocol.provider.binding, o.protocol.provider.interface] : [],
        ),
      ),
  );
  let count = -1;
  while (count !== keep.size) {
    count = keep.size;
    for (const scenario of architecture.scenarios ?? []) {
      if (!keep.has(scenario.id)) continue;
      if (scenario.actor) keep.add(scenario.actor);
      if (scenario.scope.level === "components") keep.add(scenario.scope.container);
      for (const steps of [
        scenario.steps,
        ...(scenario.alternatives ?? []).map((path) => path.steps),
      ])
        for (const step of steps) {
          keep.add(step.relationship.id);
          if (step.binding) keep.add(step.binding);
          if (step.client) keep.add(step.client.component);
        }
      for (const outcome of scenario.outcomes ?? [])
        for (const id of [...outcome.requirements, ...outcome.decisions]) keep.add(id);
    }
    for (const binding of architecture.bindings ?? [])
      if (keep.has(binding.id)) {
        keep.add(binding.provided);
        keep.add(binding.required);
        keep.add(binding.relationship.id);
        keep.add(binding.contract.id);
      }
  }
  return [...keep];
}
/** Exact contract versions consumed by effects/hooks, including otherwise unattached signatures. */
export function backendEffectContracts(model: BackendModel | undefined): BackendReference[] {
  return [
    ...(model?.effects ?? []).flatMap((e) => [
      e.payload,
      ...("contract" in e.target ? [e.target.contract] : []),
    ]),
    ...(model?.hooks ?? []).flatMap((h) => Object.values(h.contracts)),
  ];
}
export function collectBackendEffectDependencies(model: BackendModel, keep: Set<string>): void {
  for (const e of model.effects ?? []) {
    if (keep.has(e.source.id)) keep.add(e.id);
    if (keep.has(e.id)) for (const id of backendEffectReferences(e)) keep.add(id);
  }
  for (const h of model.hooks ?? []) {
    if (keep.has(h.operation.id) || keep.has(h.owner.id)) keep.add(h.id);
    if (keep.has(h.id)) for (const id of backendEffectReferences(h)) keep.add(id);
  }
}
export function mapBackendEffects(
  model: BackendModel,
  ids: Record<string, string>,
): Pick<BackendModel, "effects" | "hooks"> {
  const id = (v: string) => ids[v] ?? v;
  const exact = <T extends BackendReference>(v: T): T => ({ ...v, id: id(v.id) });
  const recovery = (r: BackendRecovery): BackendRecovery => ({
    ...r,
    operation: exact(r.operation),
    scenario: { ...r.scenario, id: id(r.scenario.id) },
    invariants: r.invariants.map((i) => ({ ...i, aggregate: exact(i.aggregate) })),
    ...(r.reconcileOperation ? { reconcileOperation: exact(r.reconcileOperation) } : {}),
  });
  return {
    ...(model.effects
      ? {
          effects: model.effects.map((e): BackendEffect => {
            const t = e.target;
            const target: BackendEffect["target"] =
              t.kind === "event"
                ? {
                    ...t,
                    contract: exact(t.contract),
                    ...(t.consumer ? { consumer: exact(t.consumer) } : {}),
                  }
                : t.kind === "operation"
                  ? { ...t, operation: exact(t.operation) }
                  : t.kind === "notification"
                    ? { ...t, operation: exact(t.operation), recipients: exact(t.recipients) }
                    : t.kind === "projection"
                      ? { ...t, dataset: id(t.dataset), query: exact(t.query) }
                      : t.kind === "hook"
                        ? { ...t, hook: exact(t.hook) }
                        : { ...t, dataset: id(t.dataset), contract: exact(t.contract) };
            return {
              ...e,
              id: id(e.id),
              source: exact(e.source),
              target,
              payload: exact(e.payload),
              values: e.values.map((m) => ({
                ...m,
                value:
                  m.value.kind === "current"
                    ? { ...m.value, entity: exact(m.value.entity) }
                    : m.value,
              })),
              after: e.after.map(exact),
              recovery: e.recovery.map(recovery),
              ...(e.relationshipBinding ? { relationshipBinding: id(e.relationshipBinding) } : {}),
            };
          }),
        }
      : {}),
    ...(model.hooks
      ? {
          hooks: model.hooks.map((h) => ({
            ...h,
            id: id(h.id),
            operation: exact(h.operation),
            owner: { ...h.owner, id: id(h.owner.id) },
            contracts: {
              input: exact(h.contracts.input),
              output: exact(h.contracts.output),
              error: exact(h.contracts.error),
            },
            dependencies: h.dependencies.map(exact),
            repositories: h.repositories.map(exact),
            services: h.services.map(exact),
            failure: { ...h.failure, operation: exact(h.failure.operation) },
            allowedWrites: h.allowedWrites.map((w) => ({ ...w, entity: exact(w.entity) })),
            allowedEffects: h.allowedEffects.map(exact),
            recovery: h.recovery.map(recovery),
          })),
        }
      : {}),
  };
}

export function validateBackendEffects(design: DesignDocument): Finding[] {
  const a = design.architecture,
    m = a?.backend;
  if (!a || !m) return [];
  const result: Finding[] = [];
  const add = (
    code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "CONFIG_REQUIRED" | "NEEDS_TEMPLATE",
    path: (string | number)[],
    message: string,
  ) => result.push(finding(code, message, { path }));
  const operation = (r: BackendReference) => m.operations?.find((v) => same(v, r));
  const effect = (r: BackendReference) => m.effects?.find((v) => same(v, r));
  const hook = (r: BackendReference) => m.hooks?.find((v) => same(v, r));
  const contract = (r: BackendReference) => a.contracts?.find((v) => same(v, r));
  const query = (r: BackendReference) => m.queries?.find((v) => same(v, r));
  const wire = (r: BackendReference) => {
    const o = operation(r);
    return (
      o && contract(o.target.contract)?.shape?.operations.find((w) => w.id === o.target.operation)
    );
  };
  const unique = (vs: string[], path: (string | number)[], label: string) => {
    if (new Set(vs).size !== vs.length) add("CONFIG_INVALID", path, `${label} must be distinct.`);
  };
  const typed = (
    r: BackendReference,
    path: (string | number)[],
    kind: "data" | "event" = "data",
  ) => {
    const c = contract(r);
    if (!c || c.kind !== kind || !c.shape)
      add("UNKNOWN_REFERENCE", path, `Select an exact typed ${kind} contract.`);
    else if (c.coverage !== "Complete" || !c.shape.payload.length)
      add("CONFIG_REQUIRED", path, "Complete the typed signature before implementation.");
    return c;
  };
  const recovery = (v: Declaration, path: (string | number)[]) => {
    unique(
      v.recovery.map((r) => r.trigger),
      path,
      "Recovery triggers",
    );
    for (const r of v.recovery) {
      const at = [...path, "recovery", r.trigger],
        o = operation(r.operation),
        outcome = o?.outcomes.find((b) => b.outcome === r.outcome);
      if (!o || !outcome)
        add("UNKNOWN_REFERENCE", at, "Recovery requires an exact operation outcome.");
      else if (outcome.trigger === "success" || outcome.trigger === "unchanged")
        add(
          "CONFIG_INVALID",
          at,
          "Recovery cannot substitute a success for an unresolved failure.",
        );
      if (
        ["uncertain-commit", "lost-acknowledgement", "external-timeout"].includes(r.trigger) &&
        outcome?.trigger !== "uncertain"
      )
        add(
          "CONFIG_INVALID",
          at,
          "Uncertain commit, lost acknowledgement and external timeout must retain an Unknown/Reconcile first outcome.",
        );
      if (
        !a.scenarios
          ?.find((s) => s.id === r.scenario.id)
          ?.outcomes?.some((s) => s.id === r.scenario.outcome)
      )
        add(
          "UNKNOWN_REFERENCE",
          at,
          "Recovery must reference an existing scenario outcome; it does not define a second scenario graph.",
        );
      if (
        r.trigger === "uncertain-commit" &&
        !same(r.operation, "source" in v ? v.source : v.operation)
      )
        add(
          "CONFIG_INVALID",
          at,
          "Uncertain source commit must reference its own exact command outcome.",
        );
      if (r.trigger === "hook-failure" && "failure" in v && !same(r.operation, v.failure.operation))
        add(
          "CONFIG_INVALID",
          at,
          "Hook failure recovery must reference its declared failure transaction, preserving the source commit boundary.",
        );
      if (
        r.strategy === "same-delivery-identity" &&
        (("source" in v && v.execution === "local") || ("kind" in v && v.kind === "pure"))
      )
        add(
          "CONFIG_INVALID",
          at,
          "Only a separate delivery attempt can reuse a delivery identity.",
        );
      for (const i of r.invariants)
        if (
          !m.aggregates
            .find((g) => same(g, i.aggregate))
            ?.invariants.some((v) => v.id === i.invariant)
        )
          add(
            "UNKNOWN_REFERENCE",
            at,
            "Recovery must select an exact aggregate invariant identity.",
          );
      unique(
        r.invariants.map((i) => `${contractKey(i.aggregate)}/${i.invariant}`),
        at,
        "Recovery invariants",
      );
      if (r.reconcileOperation && !operation(r.reconcileOperation))
        add("UNKNOWN_REFERENCE", at, "Reconciliation operation is missing.");
      if ((r.strategy === "reconcile-before-retry") !== !!r.reconcileOperation)
        add(
          "CONFIG_INVALID",
          at,
          "Reconcile-before-retry needs an exact reconciliation operation; other strategies cannot hide one.",
        );
      if (
        (r.trigger === "partial-bytes" && r.strategy !== "cleanup-unattached-bytes") ||
        (r.trigger === "external-timeout" && r.strategy !== "reconcile-before-retry") ||
        (r.trigger === "uncertain-commit" &&
          !["same-command-key", "reconcile-before-retry"].includes(r.strategy)) ||
        (r.trigger === "lost-acknowledgement" &&
          !["same-command-key", "same-delivery-identity", "reconcile-before-retry"].includes(
            r.strategy,
          )) ||
        (r.trigger === "hook-failure" && r.strategy !== "confirmed-rollback")
      )
        add(
          "CONFIG_INVALID",
          at,
          "Recovery strategy contradicts the known failure/uncertainty boundary.",
        );
      if (
        r.strategy === "same-command-key" &&
        !["command-key", "source-message"].includes(o?.idempotency.kind ?? "")
      )
        add("CONFIG_INVALID", at, "Same-command recovery requires a declared command identity.");
    }
  };
  const { checkValue } = backendValueChecks(design, add);
  for (const e of m.effects ?? []) {
    const path = ["architecture", "backend", "effects", contractKey(e)],
      o = operation(e.source),
      t = e.target;
    const invalid = (message: string) => add("CONFIG_INVALID", path, message);
    if (o?.protocol && !e.when)
      add(
        "CONFIG_REQUIRED",
        path,
        "Bounded protocol effects require an explicit committed outcome gate.",
      );
    if (e.when) {
      unique(e.when, path, "Effect outcome gates");
      for (const id of e.when)
        if (!o?.outcomes.some((v) => v.outcome === id && v.trigger === "success"))
          invalid(
            "Effect gates must select exact committed success outcomes; unchanged/rejected/replayed results cannot publish another effect.",
          );
    }
    if (!o) add("UNKNOWN_REFERENCE", path, "Effect source operation/version is missing.");
    else if (o.kind !== "command" || o.transaction.kind !== "local")
      invalid("Effects require a mutating local source command, never a read-only query.");
    const pc = typed(
      e.payload,
      [...path, "payload"],
      t.kind === "event" || (e.execution !== "local" && contract(e.payload)?.kind === "event")
        ? "event"
        : "data",
    );
    unique(
      e.values.map((v) => v.field),
      path,
      "Effect payload mappings",
    );
    for (const v of e.values) {
      const f = pc?.shape?.payload.find((f) => f.id === v.field);
      if (!f)
        add("UNKNOWN_REFERENCE", [...path, "values", v.field], "Effect payload field is missing.");
      else if (o) {
        const expanded = resolveContractValue(f, pc?.shape?.types ?? []).value;
        if (expanded)
          checkValue(
            v.value,
            { ...f, ...expanded },
            [...path, "values", v.field],
            o,
            o.actions.length,
          );
      }
    }
    if (pc?.shape?.payload.some((f) => f.required && !e.values.some((v) => v.field === f.id)))
      invalid("Bind every required effect payload field exactly once.");
    if (e.required !== (e.loss.kind === "forbidden"))
      invalid("Required effects forbid loss; optional effects require a stated loss policy.");
    if (
      e.execution === "external"
        ? e.boundary !== "after-commit"
        : e.execution === "durable-intent"
          ? e.boundary !== "atomic-intent"
          : e.boundary !== "before-commit"
    )
      invalid(
        "External I/O is after commit; durable intent is atomic with state/receipt; local work is before commit on the same connection.",
      );
    if (
      e.execution === "local"
        ? e.delivery.context !== "source-transaction-context"
        : e.delivery.context !== "verified-service-actor-provenance-only"
    )
      invalid(
        "Local intent inherits its source context; background/external delivery requires verified service authority and treats the actor as provenance only.",
      );
    if (e.execution === "local") {
      if (!["audit", "dataset"].includes(t.kind))
        invalid(
          "Local effects can append only declared dataset/audit intent, not invoke another operation, notification, hook or external call.",
        );
      if (
        e.delivery.guarantee !== "local-atomic" ||
        e.delivery.acknowledgement !== "same-commit" ||
        e.delivery.attempts !== 1 ||
        e.delivery.duplicates !== "deduplicated-local-effect" ||
        e.delivery.recipient !== "single-target"
      )
        invalid(
          "Local effects share one source commit and have no independent retry/recipient expansion.",
        );
    } else {
      if (e.delivery.guarantee === "local-atomic" || e.delivery.acknowledgement === "same-commit")
        invalid(
          "After-commit delivery cannot claim SQL atomicity or a same-commit external acknowledgement.",
        );
      if (e.execution === "durable-intent" && e.delivery.guarantee !== "at-least-once")
        invalid("Atomic durable intent uses at-least-once delivery.");
      if (e.execution === "external" && e.delivery.acknowledgement !== "unknown-is-reconcile")
        invalid("External delivery must retain ambiguous acknowledgements for reconciliation.");
      if (e.required && e.delivery.guarantee === "best-effort")
        invalid("Required effects cannot be best effort.");
    }
    if (e.execution === "durable-intent" && t.kind === "hook")
      invalid("Persist a typed event intent first; effectful hooks run after commit.");
    if ("dataset" in t) {
      const d = a.datasets?.find((d) => d.id === t.dataset);
      if (!d) add("UNKNOWN_REFERENCE", path, "Effect dataset is missing.");
      if ("contract" in t && d && !same(d.contract, t.contract))
        invalid("Dataset/audit effect must retain the dataset’s exact contract.");
      if ("contract" in t && !same(e.payload, t.contract))
        invalid("Dataset/audit payload must match its exact definition.");
      if (
        e.execution === "local" &&
        o &&
        d &&
        (d.store !== o.transaction.store ||
          !d.owners.some(
            (owner) =>
              contractOwnerElement(design, owner) === contractOwnerElement(design, o.target.owner),
          ))
      )
        invalid(
          "Local audit/dataset append must use the source authority, owner and single transaction store.",
        );
    }
    if (t.kind === "event" && !same(t.contract, e.payload))
      invalid("Event payload must reference the exact event contract.");
    if (t.kind === "event") typed(t.contract, path, "event");
    const targetRef = "operation" in t ? t.operation : t.kind === "event" ? t.consumer : undefined;
    const targetOp = targetRef && operation(targetRef);
    if (targetRef && !targetOp)
      add("UNKNOWN_REFERENCE", path, "Target/consumer operation version is missing.");
    if (targetOp && e.execution !== "local") {
      const policyRef = targetOp.access.policy.reference;
      const policy = policyRef && m.accessPolicies?.find((p) => same(p, policyRef));
      if (
        policy?.context.identity !== "verified-service" ||
        !policy.context.service ||
        !policy.revocation.recheck.includes("job")
      )
        add(
          "CONFIG_REQUIRED",
          path,
          "Delivery consumers require a verified bounded service purpose and current job policy; event actor fields are provenance only.",
        );
    }
    if (targetOp && pc?.shape) {
      const targetWire = wire(targetOp);
      if (targetWire) {
        const fields = targetWire.input.map((f) => {
          const v = resolveContractValue(
            f,
            contract(targetOp.target.contract)?.shape?.types ?? [],
          ).value;
          return { ...f, ...v };
        });
        const sourceFields = pc.shape.payload.map((f) => {
          const v = resolveContractValue(f, pc.shape?.types ?? []).value;
          return { ...f, ...v };
        });
        if (!backendValueFits({ type: "object", fields: sourceFields }, { type: "object", fields }))
          invalid(
            "Effect payload must fit the exact target/consumer input, including bounds and required fields.",
          );
      }
    }
    if (t.kind === "projection" && !query(t.query))
      add("UNKNOWN_REFERENCE", path, "Projection requires an exact bounded query definition.");
    if (t.kind === "projection") {
      const q = query(t.query),
        root = q && m.entities.find((v) => same(v, q.root));
      if (root && root.dataset !== t.dataset)
        invalid("Projection query must select the declared dataset.");
    }
    if (t.kind === "notification") {
      const q = query(t.recipients),
        policyRef = q?.accessPolicy.reference;
      const p = policyRef && m.accessPolicies?.find((p) => same(p, policyRef));
      if (!q)
        add("UNKNOWN_REFERENCE", path, "Notification requires an exact bounded recipient query.");
      if (e.delivery.recipient !== "each-eligible-recipient" || e.boundary === "before-commit")
        invalid(
          "Notifications expand bounded eligible recipients after source commit, with separate delivery identities.",
        );
      if (
        p?.context.identity !== "verified-service" ||
        !p.context.service ||
        !p.revocation.recheck.includes("job") ||
        !p.revocation.recheck.includes("materialization") ||
        !p.revocation.recheck.includes("delivery")
      )
        add(
          "CONFIG_REQUIRED",
          path,
          "Recipient policy must recheck current authority at materialization and delivery.",
        );
    }
    let targetHost = targetOp && contractOwnerElement(design, targetOp.target.owner);
    if ("dataset" in t) {
      const dataset = a.datasets?.find((d) => d.id === t.dataset);
      if (dataset?.owners.length === 1 && dataset.owners[0])
        targetHost = contractOwnerElement(design, dataset.owners[0]);
    }
    if (t.kind === "hook") {
      const h = hook(t.hook);
      if (!h) add("UNKNOWN_REFERENCE", path, "Effect hook/version is missing.");
      else {
        targetHost = contractOwnerElement(design, h.owner);
        if (h.kind !== "effectful" || e.execution !== "external" || !same(h.operation, e.source))
          invalid("Effect target must be this source operation’s effectful after-commit hook.");
        if (!same(e.payload, h.contracts.input))
          invalid("Effect payload must match the hook’s exact input contract.");
      }
    }
    const sourceHost = o && contractOwnerElement(design, o.target.owner);
    const binding =
      e.relationshipBinding && a.bindings?.find((b) => b.id === e.relationshipBinding);
    if (e.relationshipBinding && !binding)
      add("UNKNOWN_REFERENCE", path, "Effect C2 relationship binding is missing.");
    if (targetHost && sourceHost && targetHost !== sourceHost && !binding)
      invalid("Cross-container effects must retain an exact C2 interface relationship binding.");
    if (binding) {
      const provided = a.interfaces?.find((i) => i.id === binding.provided),
        required = a.interfaces?.find((i) => i.id === binding.required);
      const ownerIs = (
        x: { owner: { kind: string; id: string } } | undefined,
        y: { owner: { kind: string; id: string } } | undefined,
      ) => !!x && !!y && x.owner.kind === y.owner.kind && x.owner.id === y.owner.id;
      if (targetOp && o) {
        const sourceInterface = { owner: o.target.owner };
        const targetInterface = { owner: targetOp.target.owner };
        if (
          t.kind === "event"
            ? !ownerIs(provided, sourceInterface) ||
              !ownerIs(required, targetInterface) ||
              (binding.role !== "publish" && binding.role !== "consume")
            : !ownerIs(required, sourceInterface) ||
              !ownerIs(provided, targetInterface) ||
              binding.operation !== targetOp.target.operation
        )
          invalid(
            "Effect binding must retain exact source/target component owners, direction and target operation; another interface on the same host is insufficient.",
          );
      }
      const hosts = [provided, required].map((i) => i && contractOwnerElement(design, i.owner));
      if (
        !sourceHost ||
        !targetHost ||
        !hosts.includes(sourceHost) ||
        !hosts.includes(targetHost) ||
        !same(
          binding.contract,
          t.kind === "event" ? t.contract : (targetOp?.target.contract ?? e.payload),
        )
      )
        invalid(
          "Effect C2 binding must connect its actual source/target hosts and exact communication contract.",
        );
    }
    if (e.execution === "external" && e.required) {
      const visited = new Set<string>();
      const hasIntent = (r: BackendReference): boolean => {
        const key = contractKey(r);
        if (visited.has(key)) return false;
        visited.add(key);
        const previous = effect(r);
        return (
          !!previous &&
          same(previous.source, e.source) &&
          (previous.execution === "durable-intent" || previous.after.some(hasIntent))
        );
      };
      if (!e.after.some(hasIntent))
        add(
          "CONFIG_REQUIRED",
          [...path, "after"],
          "A required external effect needs durable intent in the source commit; a later callback alone cannot promise delivery after a crash.",
        );
    }
    unique(e.after.map(contractKey), path, "Effect ordering dependencies");
    const phase = { "before-commit": 0, "atomic-intent": 1, "after-commit": 2 };
    for (const r of e.after) {
      const predecessor = effect(r);
      if (!predecessor)
        add("UNKNOWN_REFERENCE", path, "Ordered predecessor effect/version is missing.");
      else if (
        !same(predecessor.source, e.source) ||
        phase[predecessor.boundary] > phase[e.boundary]
      )
        invalid(
          "Required order must belong to the same source command and cannot reverse the commit boundary.",
        );
    }
    recovery(e, path);
    const requiredRecoveries =
      e.execution === "local"
        ? ["uncertain-commit"]
        : e.execution === "external"
          ? ["uncertain-commit", "lost-acknowledgement", "external-timeout"]
          : ["uncertain-commit", "lost-acknowledgement"];
    for (const trigger of requiredRecoveries)
      if (!e.recovery.some((r) => r.trigger === trigger))
        add(
          "CONFIG_REQUIRED",
          [...path, "recovery", trigger],
          `Declare the ${trigger} recovery outcome/scenario/invariant.`,
        );
  }
  const seamFiles = new Set<string>();
  for (const h of m.hooks ?? []) {
    const path = ["architecture", "backend", "hooks", contractKey(h)],
      o = operation(h.operation),
      w = wire(h.operation);
    const invalid = (message: string) => add("CONFIG_INVALID", path, message);
    if (!o) add("UNKNOWN_REFERENCE", path, "Hook source operation/version is missing.");
    if (
      !contractOwnerElement(design, h.owner) ||
      (o && (h.owner.kind !== o.target.owner.kind || h.owner.id !== o.target.owner.id))
    )
      invalid("Hook seam must have the exact operation owner.");
    for (const [name, r] of Object.entries(h.contracts)) typed(r, [...path, "contracts", name]);
    for (const [ids, label] of [
      [h.context, "Hook context"],
      [h.acceptance, "Acceptance identities"],
      [h.dependencies.map(contractKey), "Hook dependencies"],
      [h.repositories.map(contractKey), "Repository dependencies"],
      [h.services.map(contractKey), "Service dependencies"],
      [h.allowedEffects.map(contractKey), "Allowed effects"],
      [h.allowedWrites.map((v) => `${contractKey(v.entity)}/${v.field}`), "Allowed writes"],
    ] as const)
      unique([...ids], path, label);
    const seam = `${h.owner.kind}/${h.owner.id}/${h.seam.file}`;
    if (seamFiles.has(seam))
      invalid("Hook seam file must be unique per owner, including exact versions.");
    seamFiles.add(seam);
    if (
      h.kind === "pure"
        ? h.boundary !== "before-commit" ||
          h.repositories.length ||
          h.services.length ||
          h.allowedEffects.length
        : h.boundary !== "after-commit"
    )
      invalid(
        "Pure hooks use only supplied snapshots before commit; effectful hooks and service/repository I/O run after commit.",
      );
    for (const r of h.repositories) {
      const q = query(r),
        policyRef = q?.accessPolicy.reference;
      const policy = policyRef && m.accessPolicies?.find((p) => same(p, policyRef));
      if (!q)
        add(
          "UNKNOWN_REFERENCE",
          path,
          "Hook repository needs an exact bounded query/version, never unrestricted entity access.",
        );
      else if (
        policy?.context.identity !== "verified-service" ||
        !policy.context.service ||
        !policy.revocation.recheck.includes("job") ||
        !q.accessProjection
      )
        add(
          "CONFIG_REQUIRED",
          path,
          "Hook repository queries need a projected, current-policy verified service read.",
        );
    }
    if (h.repositories.length && h.privateData !== "current-policy-recheck")
      invalid(
        "Repository observation requires current-policy rechecks, never actor provenance as authority.",
      );
    for (const r of h.services)
      if (!operation(r))
        add("UNKNOWN_REFERENCE", path, "Hook service operation/version is missing.");
    for (const r of h.dependencies) {
      const dep = hook(r);
      if (!dep) add("UNKNOWN_REFERENCE", path, "Hook dependency/version is missing.");
      else if (!same(dep.operation, h.operation) || (h.kind === "pure" && dep.kind !== "pure"))
        invalid(
          "Hook dependencies must share the source operation; pure hooks cannot depend on effectful hooks.",
        );
    }
    for (const v of h.allowedWrites) {
      const entity = m.entities.find((e) => same(e, v.entity)),
        f = entity?.fields.find((f) => f.field === v.field);
      if (!entity || !f)
        add("UNKNOWN_REFERENCE", path, "Hook proposed write field/version is missing.");
      else if (
        f.serverOwned ||
        m.lifecycles?.some((l) => same(l.state.entity, v.entity) && l.state.field === v.field)
      )
        invalid(
          "Hook output cannot override protected identity/scope/role authority, clocks, versions or lifecycle transitions.",
        );
      if (!o?.writes.some((w) => same(w.entity, v.entity) && w.field === v.field))
        invalid(
          "Hook proposals must be applied by explicit source command field writers; hooks cannot mutate directly.",
        );
    }
    for (const r of h.allowedEffects) {
      const e = effect(r);
      if (!e) add("UNKNOWN_REFERENCE", path, "Allowed effect/version is missing.");
      else if (
        !same(e.source, h.operation) ||
        e.boundary !== "after-commit" ||
        (e.target.kind === "hook" && same(e.target.hook, h))
      )
        invalid(
          "Allowed effects must be separate after-commit effects of the same source, without self invocation.",
        );
    }
    const failure = (id: string, trigger: string, status?: number) => {
      const failureOperation = status ? o : operation(h.failure.operation),
        failureWire = status ? w : wire(h.failure.operation);
      const selected = failureOperation?.outcomes.find((v) => v.outcome === id),
        actual = failureWire?.outcomes?.find((v) => v.id === id);
      if (!selected || !actual)
        add(
          "UNKNOWN_REFERENCE",
          path,
          "Hook failure must reference an existing exact operation outcome.",
        );
      else if (
        selected.trigger !== trigger ||
        actual.kind !== "Failure" ||
        actual.state !== "Unchanged" ||
        (status && actual.status !== status)
      )
        invalid(
          "Missing/invalid/timed-out/cancelled hooks must fail closed with their declared unchanged failure outcome; absence cannot report success.",
        );
    };
    if (
      h.kind === "pure"
        ? h.failure.scope !== "source-transaction" || !same(h.failure.operation, h.operation)
        : h.failure.scope !== "separate-delivery-attempt" || same(h.failure.operation, h.operation)
    )
      invalid(
        "Pure failure rolls back its source; effectful failure belongs to a separate delivery operation and must preserve the committed source result.",
      );
    if (!operation(h.failure.operation))
      add("UNKNOWN_REFERENCE", path, "Hook failure operation/version is missing.");
    failure(h.unavailable.outcome, "unavailable", h.unavailable.status);
    failure(h.failure.error, "failed");
    failure(h.failure.invalidResult, "failed");
    failure(h.failure.timeout, "failed");
    failure(h.failure.cancelled, "cancelled");
    if (h.kind === "effectful" && !h.context.includes("service-purpose"))
      invalid(
        "Effectful hooks require a verified service purpose; initiating principal context is provenance only.",
      );
    if (!h.required && h.allowedWrites.length)
      invalid(
        "A hook proposing source writes is required; an optional missing implementation cannot supply values.",
      );
    if (h.boundary === "after-commit" && h.allowedWrites.length)
      invalid(
        "After-commit hooks cannot write the already committed source transaction; invoke an explicit subsequent command instead.",
      );
    if (o)
      for (const action of o.actions) {
        if (action.kind !== "hook" || !same(action.hook, h)) continue;
        for (const binding of action.input) {
          let resource: BackendReference | undefined, field: string | undefined;
          if (binding.value.kind === "current") {
            resource = binding.value.entity;
            field = binding.value.field;
          } else if (binding.value.kind === "result") {
            const source = binding.value;
            const producer = o.actions.find((v) => v.id === source.action);
            if (producer && "entity" in producer) {
              resource = producer.entity;
              field = source.path[0];
            }
          }
          if (!resource || !field) continue;
          const aggregate = m.aggregates.find((v) => same(v, o.aggregate));
          const selectedResource = resource,
            selectedField = field;
          const selection =
            aggregate && same(aggregate.root, selectedResource)
              ? o.access
              : o.access.participants?.find((p) => same(p.entity, selectedResource));
          const policyRef = selection?.policy.reference;
          const policy = policyRef && m.accessPolicies?.find((p) => same(p, policyRef));
          if (
            !policy?.projections.some(
              (p) =>
                p.id === selection?.readProjection &&
                p.mode === "read" &&
                p.fields.includes(selectedField),
            )
          )
            invalid(
              "Hook inputs exposing entity fields require that entity’s exact read projection; mutation permission alone cannot disclose a snapshot.",
            );
        }
      }
    if (h.kind === "pure" && o && h.timeoutSeconds > o.cancellation.deadlineSeconds)
      invalid("A pure hook timeout must fit the source command’s cooperative deadline.");
    if (h.kind === "pure" && o) {
      const index = o.actions.findIndex((v) => v.kind === "hook" && same(v.hook, h));
      if (o.actions.filter((v) => v.kind === "hook" && same(v.hook, h)).length > 1)
        invalid("Invoke each exact pure hook once per source command; no implicit loops.");
      for (const dependency of h.dependencies)
        if (!o.actions.slice(0, index).some((v) => v.kind === "hook" && same(v.hook, dependency)))
          invalid("Pure hook dependencies must be earlier explicit actions.");
    }
    if (h.kind === "effectful") {
      for (const dependency of h.dependencies) {
        const dep = hook(dependency);
        if (dep?.kind !== "effectful") continue;
        const predecessor = m.effects?.find(
          (e) => e.target.kind === "hook" && same(e.target.hook, dependency),
        );
        const invocations =
          m.effects?.filter((e) => e.target.kind === "hook" && same(e.target.hook, h)) ?? [];
        if (!predecessor || invocations.some((e) => !e.after.some((r) => same(r, predecessor))))
          invalid("Effectful hook dependencies require explicit after-commit effect ordering.");
      }
    }
    if (
      h.kind === "pure" &&
      !(
        (o?.protocol?.hook && same(o.protocol.hook, h)) ||
        o?.actions.some((v) => v.kind === "hook" && same(v.hook, h))
      )
    )
      add("CONFIG_REQUIRED", path, "Bind the pure hook as an ordered typed source action.");
    if (
      h.kind === "effectful" &&
      !m.effects?.some((e) => e.target.kind === "hook" && same(e.target.hook, h))
    )
      add(
        "CONFIG_REQUIRED",
        path,
        "Bind the effectful hook through an explicit after-commit effect.",
      );
    recovery(h, path);
    if (h.kind === "pure" && !h.recovery.some((r) => r.trigger === "hook-failure"))
      add("CONFIG_REQUIRED", path, "Declare confirmed rollback on hook failure.");
    add(
      "NEEDS_TEMPLATE",
      path,
      `${h.required ? "Required" : "Optional"} typed hook ${contractKey(h)} has no implementation evidence; required readiness is checked before any source mutation.`,
    );
  }
  const cycles = (
    vs: Declaration[],
    refs: (v: Declaration) => BackendReference[],
    label: string,
  ) => {
    const active = new Set<string>(),
      done = new Set<string>();
    const visit = (v: Declaration) => {
      const key = contractKey(v);
      if (active.has(key)) {
        add(
          "CONFIG_INVALID",
          ["architecture", "backend", "source" in v ? "effects" : "hooks", key],
          `${label} dependency cycle is forbidden.`,
        );
        return;
      }
      if (done.has(key)) return;
      active.add(key);
      for (const r of refs(v)) {
        const n = vs.find((n) => same(n, r));
        if (n) visit(n);
      }
      active.delete(key);
      done.add(key);
    };
    for (const v of vs) visit(v);
  };
  cycles(m.effects ?? [], (v) => ("source" in v ? v.after : []), "effects");
  cycles(m.hooks ?? [], (v) => ("dependencies" in v ? v.dependencies : []), "hooks");
  cycles(
    [...(m.effects ?? []), ...(m.hooks ?? [])],
    (v) =>
      "source" in v
        ? [...v.after, ...(v.target.kind === "hook" ? [v.target.hook] : [])]
        : [...v.dependencies, ...v.allowedEffects],
    "effects-and-hooks",
  );
  const activeOperations = new Set<string>(),
    finishedOperations = new Set<string>();
  const visitOperation = (r: BackendReference) => {
    const key = contractKey(r);
    if (activeOperations.has(key)) {
      add(
        "CONFIG_INVALID",
        ["architecture", "backend", "operations", key],
        "Effect operation invocation cycle is forbidden; use a separately bounded strategy rather than recursive workflows.",
      );
      return;
    }
    if (finishedOperations.has(key)) return;
    activeOperations.add(key);
    for (const e of m.effects ?? []) {
      if (!same(e.source, r)) continue;
      const t = e.target,
        target = "operation" in t ? t.operation : t.kind === "event" ? t.consumer : undefined;
      if (target) visitOperation(target);
    }
    activeOperations.delete(key);
    finishedOperations.add(key);
  };
  for (const o of m.operations ?? []) visitOperation(o);
  return result;
}
/** Referenced exact hook semantics remain protected even through simultaneous consumer removal. */
export function validateBackendEffectsTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const b = before.architecture?.backend;
  return (b?.hooks ?? []).flatMap((h) => {
    const used =
      (b?.capabilityConfigs ?? [])
        .flatMap(backendCapabilityExactReferences)
        .some((r) => r.collection === "hooks" && same(r.reference, h)) ||
      b?.operations?.some(
        (o) =>
          (o.protocol?.hook && same(o.protocol.hook, h)) ||
          o.actions.some((a) => a.kind === "hook" && same(a.hook, h)),
      ) ||
      b?.effects?.some((e) => e.target.kind === "hook" && same(e.target.hook, h)) ||
      b?.hooks?.some((v) => v.dependencies.some((r) => same(r, h)));
    const next = after.architecture?.backend?.hooks?.find((v) => same(v, h));
    const semantics = (v: BackendHook) => {
      const { name: _name, ...rest } = v;
      return rest;
    };
    return used && (!next || contractCanonical(semantics(next)) !== contractCanonical(semantics(h)))
      ? [
          finding(
            "CONFIG_INVALID",
            `Referenced hook ${contractKey(h)} is immutable; preserve it and create an explicit successor.`,
            { path: ["architecture", "backend", "hooks", contractKey(h)] },
          ),
        ]
      : [];
  });
}
