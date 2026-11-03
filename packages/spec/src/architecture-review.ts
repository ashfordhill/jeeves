/** Requirement-based advice. Never pass these findings to blocksGenerate. */

import { validateArchitecture } from "./architecture.ts";
import { architectureReview, type RelationshipBinding } from "./architecture-bindings.ts";
import {
  contractCanonical,
  contractKey,
  contractOwnerElement,
  resolveContractSource,
  sameContractOwner,
} from "./architecture-contracts.ts";
import { architectureReviewReferences, type ReviewReference } from "./architecture-review-model.ts";
import { validateBackendBehavior } from "./backend-behavior.ts";
import { validateBackendEffects } from "./backend-effects.ts";
import { backendPolicyIntentConflicts, validateBackendPolicies } from "./backend-policy.ts";
import { backendQuerySources, validateBackendQueries } from "./backend-queries.ts";
import type { DesignDocument } from "./design.ts";
import { isStructural } from "./findings.ts";

export type ReviewConcern =
  | "Contracts"
  | "Access and authority"
  | "Cache behavior"
  | "Delivery and failure"
  | "Objectives";
export interface ReviewFinding {
  id: string;
  code: string;
  concern: ReviewConcern;
  severity: "conflict" | "unresolved";
  message: string;
  assumption: string;
  inputs: ReviewReference[];
  fingerprint: string;
  acceptedBy?: string;
  expiredDecisions: string[];
  editor: "contracts" | "binding" | "data" | "requirements";
  pattern?: "cached-public-lookup" | "asynchronous-work-delivery";
}

/** Deterministic non-security digest of canonical, explicitly scoped inputs. */
function digest(value: unknown): string {
  const text = contractCanonical(value);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length.toString(16)}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
const ref = (kind: ReviewReference["kind"], id: string): ReviewReference => ({ kind, id });

/** Includes transitive policy/contract/owner inputs, but never decisions, layout or revision. */
function relevantInputs(design: DesignDocument, references: ReviewReference[]): unknown[] {
  const m = design.architecture!;
  const seen = new Set<string>();
  const values: unknown[] = [];
  const visit = (r: ReviewReference) => {
    const key = `${r.kind}:${r.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const group = {
      element: design.elements,
      connection: design.connections,
      component: m.components,
      "component-relationship": m.componentRelationships,
      interface: m.interfaces,
      binding: m.bindings,
      dataset: m.datasets,
      objective: m.objectives,
      requirement: m.reviewRequirements,
      contract: m.contracts,
      "external-system": m.nodes,
    };
    if (r.kind === "system") {
      values.push({
        key,
        businessTenancy: m.system.businessTenancy,
        authorization: m.system.authorization,
        dataIsolation: m.system.dataIsolation,
      });
      return;
    }
    const value = group[r.kind]?.find(
      (v) =>
        (r.kind === "contract"
          ? contractKey(v as NonNullable<typeof m.contracts>[number])
          : v.id) === r.id,
    );
    values.push({
      key,
      value:
        r.kind === "element" && value
          ? (() => {
              const e = design.elements.find((e) => e.id === r.id)!;
              return {
                id: e.id,
                template: e.template,
                planned: e.planned,
                classification: e.classification,
              };
            })()
          : r.kind === "component" && value
            ? { id: value.id, element: m.components!.find((c) => c.id === r.id)!.element }
            : value,
    });
    if (!value) return;
    if (r.kind === "binding") {
      const b = value as RelationshipBinding;
      visit(ref("interface", b.provided));
      visit(ref("interface", b.required));
      visit(ref("contract", contractKey(b.contract)));
      visit(ref(b.relationship.kind, b.relationship.id));
      if (b.policies?.access?.tenant === "Tenant scoped") visit(ref("system", "system"));
    } else if (r.kind === "interface") {
      const use = m.interfaces!.find((i) => i.id === r.id)!;
      visit(ref("contract", contractKey(use.contract)));
      visit(ref(use.owner.kind, use.owner.id));
      for (const b of m.bindings ?? []) if (b.required === use.id) visit(ref("binding", b.id));
    } else if (r.kind === "contract") {
      const c = m.contracts!.find((c) => contractKey(c) === r.id)!;
      if (c.source) values.push({ source: resolveContractSource(design, c.source) });
    } else if (r.kind === "dataset") {
      const d = m.datasets!.find((d) => d.id === r.id)!;
      const entities = m.backend?.entities.filter((e) => e.dataset === d.id) ?? [];
      const aggregates =
        m.backend?.aggregates.filter((a) =>
          [a.root, ...a.children].some((r) =>
            entities.some((e) => contractKey(e) === contractKey(r)),
          ),
        ) ?? [];
      const queries =
        m.backend?.queries?.filter((q) =>
          [...backendQuerySources(design, q).values()].some(
            (source) => source.entity.dataset === d.id,
          ),
        ) ?? [];
      const hasEffect = m.backend?.effects?.some(
        (e) => "dataset" in e.target && e.target.dataset === d.id,
      );
      if (entities.length || aggregates.length || queries.length || hasEffect) {
        // The exact selected policy graph participates in review acknowledgements.
        values.push({
          backend: {
            entities,
            aggregates,
            queries,
            accessPolicies: m.backend?.accessPolicies,
            accessBindings: m.backend?.accessBindings,
            lifecycles: m.backend?.lifecycles,
            operations: m.backend?.operations,
            effects: m.backend?.effects,
            hooks: m.backend?.hooks,
          },
        });
        for (const q of queries) {
          if (q.freshness.kind === "bounded-staleness") visit(ref("binding", q.freshness.binding));
          for (const source of backendQuerySources(design, q).values())
            visit(ref("dataset", source.entity.dataset));
        }
        for (const a of aggregates)
          for (const participant of [a.root, ...a.children]) {
            const e = m.backend?.entities.find((e) => contractKey(e) === contractKey(participant));
            if (e) visit(ref("dataset", e.dataset));
          }
      }
      visit(ref("contract", contractKey(d.contract)));
      for (const b of m.bindings ?? [])
        if (contractKey(b.contract) === contractKey(d.contract)) visit(ref("binding", b.id));
    } else if (r.kind === "objective") {
      const o = m.objectives!.find((o) => o.id === r.id)!;
      visit(o.scope.kind === "system" ? ref("system", "system") : o.scope);
    } else if (r.kind === "component") {
      const c = m.components!.find((c) => c.id === r.id)!;
      visit(ref("element", c.element));
    }
  };
  references.forEach(visit);
  return values;
}

export function reviewArchitecture(design: DesignDocument) {
  const m = design.architecture;
  const findings: ReviewFinding[] = [];
  const add = (
    code: string,
    concern: ReviewConcern,
    severity: ReviewFinding["severity"],
    message: string,
    assumption: string,
    inputs: ReviewReference[],
    editor: ReviewFinding["editor"],
    pattern?: ReviewFinding["pattern"],
  ) => {
    const id = `review-${digest({ code, inputs, message })}`;
    const fingerprint = `v1-${digest({ code, inputs: relevantInputs(design, inputs) })}`;
    const decisions =
      m?.decisions?.filter(
        (d) => d.status === "Accepted" && d.acknowledgements.some((a) => a.finding === id),
      ) ?? [];
    const acceptedBy =
      severity === "conflict"
        ? undefined
        : decisions.find(
            (d) =>
              inputs.every((r) =>
                d.links.some((link) => link.kind === r.kind && link.id === r.id),
              ) &&
              d.acknowledgements.some((a) => a.finding === id && a.fingerprint === fingerprint),
          )?.id;
    findings.push({
      id,
      code,
      concern,
      severity,
      message,
      assumption,
      inputs,
      fingerprint,
      acceptedBy,
      expiredDecisions: decisions
        .filter((d) =>
          d.acknowledgements.some((a) => a.finding === id && a.fingerprint !== fingerprint),
        )
        .map((d) => d.id),
      editor,
      pattern,
    });
  };
  for (const f of architectureReview(design)) {
    const inputs = (["binding", "dataset", "objective", "interface", "contract"] as const).flatMap(
      (kind) => (f[kind] ? [ref(kind, f[kind]!)] : []),
    );
    const concern: ReviewConcern =
      f.contract ||
      f.interface ||
      ["CONTRACT_MISMATCH", "INTERACTION_CONFLICT", "DIRECTION_CONFLICT"].includes(f.code)
        ? "Contracts"
        : f.objective
          ? "Objectives"
          : f.dataset ||
              ["TENANT_CONFLICT", "DATA_ACCESS_MISSING"].includes(f.code) ||
              /identity|tenant|authenticate/i.test(f.message)
            ? "Access and authority"
            : /cache|freshness/i.test(f.message)
              ? "Cache behavior"
              : "Delivery and failure";
    add(
      f.code,
      concern,
      /CONFLICT|MISMATCH/.test(f.code) ? "conflict" : "unresolved",
      f.message,
      "This check applies to the authored contract, required interface or selected policy only. Undeclared topology preferences are not requirements; intent supplies no runtime verification.",
      inputs,
      f.binding ? "binding" : f.dataset || f.objective ? "data" : "contracts",
    );
  }
  for (const f of [
    ...validateBackendPolicies(design),
    ...validateBackendQueries(design).filter((f) =>
      f.target.path?.some((part) => ["accessPolicy", "sourcePolicies"].includes(String(part))),
    ),
  ].filter((f) => !isStructural(f))) {
    const inputs = (m?.datasets ?? [])
      .filter((d) => m?.backend?.entities.some((e) => e.dataset === d.id))
      .map((d) => ref("dataset", d.id));
    add(
      "BACKEND_ACCESS_GAP",
      "Access and authority",
      "unresolved",
      `${f.target.path?.join("/")}: ${f.message}`,
      `Complete the exact finite policy at ${f.target.path?.join("/")}; a detached description is not authority or runtime evidence.`,
      inputs,
      "data",
    );
  }
  for (const f of validateBackendBehavior(design).filter((f) => !isStructural(f)))
    add(
      "BACKEND_BEHAVIOR_GAP",
      "Delivery and failure",
      "unresolved",
      `${f.target.path?.join("/")}: ${f.message}`,
      "Complete the exact command/lifecycle declaration. Registered strategies are design vocabulary, not implementation evidence; unsupported choices remain blockers.",
      (m?.datasets ?? [])
        .filter((d) => m?.backend?.entities.some((e) => e.dataset === d.id))
        .map((d) => ref("dataset", d.id)),
      "contracts",
    );
  for (const f of validateBackendEffects(design).filter((f) => !isStructural(f)))
    add(
      "BACKEND_EFFECT_GAP",
      "Delivery and failure",
      "unresolved",
      `${f.target.path?.join("/")}: ${f.message}`,
      "Complete the exact effect/hook recovery declaration; design readiness and observed implementation evidence remain separate.",
      (m?.datasets ?? [])
        .filter((d) => m?.backend?.entities.some((e) => e.dataset === d.id))
        .map((d) => ref("dataset", d.id)),
      "contracts",
    );
  for (const conflict of backendPolicyIntentConflicts(design)) {
    add(
      "BACKEND_ACCESS_CONFLICT",
      "Access and authority",
      "conflict",
      conflict.message,
      "Relationship access intent and exact policy selection must agree; deny precedence and current-state checks remain required.",
      [
        ref("binding", conflict.relationshipBinding),
        ...(m?.backend?.entities ?? [])
          .filter((e) => contractKey(e) === contractKey(conflict.policy.resource))
          .map((e) => ref("dataset", e.dataset)),
      ],
      "binding",
    );
  }
  const binding = (id?: string) => m?.bindings?.find((b) => b.id === id);
  const owner = (b: RelationshipBinding | undefined, side: "provided" | "required") =>
    m?.interfaces?.find((i) => i.id === b?.[side])?.owner;
  for (const r of m?.reviewRequirements ?? []) {
    const inputs = [ref("requirement", r.id)];
    for (const key of ["binding", "fallback", "update"] as const) {
      if (key in r) {
        const id = (r as Record<string, unknown>)[key];
        if (typeof id === "string") inputs.push(ref("binding", id));
      }
    }
    if (r.kind === "delivery") {
      if (r.channel) inputs.push(ref("element", r.channel));
      if (r.responsible) inputs.push(ref(r.responsible.kind, r.responsible.id));
    }
    const report = (
      code: string,
      concern: ReviewConcern,
      message: string,
      assumption: string,
      conflict = false,
      pattern?: ReviewFinding["pattern"],
    ) =>
      add(
        code,
        concern,
        conflict ? "conflict" : "unresolved",
        `${r.name}: ${message}`,
        assumption,
        inputs,
        "requirements",
        pattern,
      );
    const b = "binding" in r ? binding(r.binding) : undefined;
    if (r.kind === "access") {
      const a = b?.policies?.access;
      const assumption =
        "The selected interaction requires the declared identity and tenant boundary; private reachability alone provides neither.";
      if (
        r.identity === "Unknown" ||
        r.tenant === "Unknown" ||
        !a ||
        a.identity === "Unknown" ||
        a.tenant === "Unknown"
      )
        report(
          "ACCESS_POLICY_MISSING",
          "Access and authority",
          "resolve the selected identity and tenant access policy.",
          assumption,
        );
      else if (a.identity !== r.identity || a.tenant !== r.tenant)
        report(
          "ACCESS_REQUIREMENT_CONFLICT",
          "Access and authority",
          "the interaction access policy contradicts the selected requirement.",
          assumption,
          true,
        );
    } else if (r.kind === "failure") {
      const f = b?.policies?.failure;
      const assumption =
        "The selected interaction must declare a bounded failure outcome. Business asynchrony does not remove a transport acknowledgement.";
      if (
        r.outcome === "Unknown" ||
        !f ||
        f.outcome === "Unknown" ||
        f.timeoutMs === undefined ||
        !f.detail
      )
        report(
          "FAILURE_OUTCOME_MISSING",
          "Delivery and failure",
          "record the required outcome, timeout and observable failure detail.",
          assumption,
        );
      else if (r.outcome !== f.outcome)
        report(
          "FAILURE_REQUIREMENT_CONFLICT",
          "Delivery and failure",
          "the failure outcome contradicts the selected requirement.",
          assumption,
          true,
        );
    } else if (r.kind === "cache") {
      const assumption =
        "Cache-aside was explicitly selected: the application reads the source on cache failure, and changes/disables propagate within a stated freshness bound. No cache-to-store arrow is required.";
      const fallback = binding(r.fallback),
        update = binding(r.update);
      const caller = owner(b, "required"),
        fallbackCaller = owner(fallback, "required");
      const cache = owner(b, "provided"),
        updateCache = owner(update, "provided"),
        source = owner(fallback, "provided");
      if (
        !b?.policies?.freshness ||
        b.policies.freshness.invalidation === "Unknown" ||
        b.policies.freshness.invalidation === "No cache" ||
        b.policies.freshness.maxAgeSeconds === undefined
      )
        report(
          "CACHE_FRESHNESS_MISSING",
          "Cache behavior",
          "declare the maximum stale age and cache update strategy.",
          assumption,
          false,
          "cached-public-lookup",
        );
      if (
        !fallback ||
        b?.role !== "read" ||
        fallback.role !== "read" ||
        !caller ||
        !fallbackCaller ||
        !sameContractOwner(caller, fallbackCaller) ||
        !source ||
        !cache ||
        contractOwnerElement(design, source) === contractOwnerElement(design, cache) ||
        b.policies?.failure?.outcome !== "Source fallback"
      )
        report(
          "CACHE_FALLBACK_MISSING",
          "Cache behavior",
          "link the same application's source read and select Source fallback on the cache read. Source and cache may use separate explicit contracts.",
          assumption,
          false,
          "cached-public-lookup",
        );
      if (
        !update ||
        update.role !== "write" ||
        !cache ||
        !updateCache ||
        !sameContractOwner(cache, updateCache) ||
        contractKey(update.contract) !== contractKey(b!.contract) ||
        !["On write", "Event driven"].includes(update.policies?.freshness?.invalidation ?? "") ||
        update.policies?.freshness?.maxAgeSeconds === undefined ||
        (b?.policies?.freshness?.maxAgeSeconds !== undefined &&
          update.policies.freshness.maxAgeSeconds > b.policies.freshness.maxAgeSeconds)
      )
        report(
          "CACHE_UPDATE_MISSING",
          "Cache behavior",
          "link a bounded change/disable update to the same cache contract; its delay must fit the lookup freshness bound.",
          assumption,
          false,
          "cached-public-lookup",
        );
    } else {
      const assumption =
        "Only the explicitly selected delivery trigger needs a responsibility. Schedule/request triggers need no queue; a named external consumer can satisfy channel delivery.";
      if (r.trigger === "Unknown" || !r.responsible)
        report(
          "DELIVERY_RESPONSIBILITY_MISSING",
          "Delivery and failure",
          "select a trigger and the responsible internal or external owner.",
          assumption,
          false,
          "asynchronous-work-delivery",
        );
      else if (r.trigger === "Channel") {
        const consumer = owner(b, "required"),
          provider = owner(b, "provided");
        if (
          !r.channel ||
          !b ||
          b.role !== "consume" ||
          !consumer ||
          !sameContractOwner(consumer, r.responsible) ||
          !provider ||
          contractOwnerElement(design, provider) !== r.channel
        )
          report(
            "CHANNEL_CONSUMER_MISSING",
            "Delivery and failure",
            "link a consume binding from the selected channel to its declared delivery responsibility.",
            assumption,
            false,
            "asynchronous-work-delivery",
          );
      }
    }
  }
  const unresolvedDecisions =
    m?.decisions?.filter((d) => d.status === "Unresolved").map((d) => d.id) ?? [];
  const blocking = findings.filter((f) => f.severity === "conflict" || !f.acceptedBy);
  const structuralFindings = validateArchitecture(design).filter(isStructural);
  return {
    revision: design.revision,
    findings,
    unresolvedDecisions,
    structuralFindings,
    complete:
      structuralFindings.length === 0 && blocking.length === 0 && unresolvedDecisions.length === 0,
    references: architectureReviewReferences(design),
    limitation:
      "Design review only. Structural validity, generation readiness, template availability and runtime verification remain separate.",
  };
}
export type ArchitectureReviewReport = ReturnType<typeof reviewArchitecture>;
