/** Pure support report; separate from schema/binding validation to keep browser imports acyclic. */
import { z } from "zod";
import { contractKey, contractOwnerElement } from "./architecture-contracts.ts";
import type {
  BackendImplementation,
  ImplementationObligation,
} from "./backend-implementation-model.ts";
import { implementationObligationSchema } from "./backend-implementation-model.ts";
import {
  backendImplementationRequirements,
  capabilityOptionDemands,
  implementationKey,
} from "./backend-implementations.ts";
import { contractValueTypes } from "./contract-shapes.ts";
import type { DesignDocument } from "./design.ts";
import { findingSchema, isStructural } from "./findings.ts";
import type { TemplateLookup } from "./manifest.ts";
import { componentHostRole } from "./planned-capabilities.ts";
import { validateDesign } from "./validate.ts";

const selected = (design: DesignDocument) => design.architecture?.backend?.implementations ?? [];
const same = (a: ImplementationObligation, b: ImplementationObligation) =>
  implementationKey(a) === implementationKey(b);
const claims = (b: BackendImplementation) => [b.target, ...b.obligations];
function shapes(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(shapes);
  if (!value || typeof value !== "object") return [];
  const v = value as Record<string, unknown>;
  return [
    ...(typeof v.type === "string" &&
    contractValueTypes.includes(v.type as (typeof contractValueTypes)[number])
      ? [v.type]
      : []),
    ...Object.values(v).flatMap(shapes),
  ];
}
export const implementationReasonSchema = z.strictObject({
  code: z.string(),
  path: z.string().optional(),
  message: z.string(),
});
export const implementationMatchSchema = z.strictObject({
  obligation: implementationObligationSchema,
  name: z.string(),
  status: z.enum(["supported", "needs-explicit-hook", "unsupported", "incompatible"]),
  reasons: z.array(implementationReasonSchema),
  binding: z.string().optional(),
  template: z.string().optional(),
  capability: z.string().optional(),
  hooks: z.array(
    z.strictObject({ slot: z.string(), hook: z.string().optional(), ready: z.boolean() }),
  ),
  evidencePackIds: z.array(z.string()),
});
export const backendImplementationReportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  foundationReady: z.boolean(),
  fullReady: z.boolean(),
  obligations: z.array(implementationMatchSchema),
  structuralFindings: z.array(findingSchema),
  rawFindings: z.array(findingSchema),
  limitation: z.string(),
});
export type BackendImplementationReport = z.output<typeof backendImplementationReportSchema>;
/** Support is a manifest claim. Evidence packs are expected checks, never passed checks. */
export function matchBackendImplementations(
  design: DesignDocument,
  lookup: TemplateLookup,
): BackendImplementationReport {
  const requirements = backendImplementationRequirements(design),
    bindings = selected(design);
  const descriptor = (b: BackendImplementation) =>
    lookup.get(b.template)?.capabilities?.find((c) => contractKey(c) === contractKey(b.capability));
  const obligations: BackendImplementationReport["obligations"] = requirements.map((r) => {
    const candidates = bindings.filter((b) => claims(b).some((c) => same(c, r.ref)));
    const row: BackendImplementationReport["obligations"][number] = {
      obligation: r.ref,
      name: r.name,
      status: "supported",
      reasons: [],
      hooks: [],
      evidencePackIds: [],
    };
    const reject = (status: typeof row.status, code: string, message: string, path?: string) => {
      if (
        { supported: 0, "needs-explicit-hook": 1, unsupported: 2, incompatible: 3 }[status] >
        { supported: 0, "needs-explicit-hook": 1, unsupported: 2, incompatible: 3 }[row.status]
      )
        row.status = status;
      row.reasons.push({ code, message, ...(path ? { path } : {}) });
    };
    if (!candidates.length) {
      reject("unsupported", "UNBOUND", "No exact implementation is selected for this obligation.");
      return row;
    }
    if (candidates.length !== 1) {
      reject(
        "incompatible",
        "AMBIGUOUS",
        "Multiple selections claim this exact obligation; choose one.",
      );
      return row;
    }
    const b = requiredValue(candidates[0]),
      d = descriptor(b);
    row.binding = contractKey(b);
    row.template = contractKey(b.template);
    row.capability = contractKey(b.capability);
    if (!lookup.get(b.template)) {
      reject(
        "unsupported",
        "TEMPLATE_UNAVAILABLE",
        "The exact template version is not registered.",
      );
      return row;
    }
    if (!d) {
      reject(
        "unsupported",
        "CAPABILITY_UNAVAILABLE",
        "The exact registered template has no matching versioned capability descriptor.",
      );
      return row;
    }
    row.evidencePackIds = d.evidencePackIds;
    for (const h of b.hooks)
      if (!d.hooks.some((slot) => slot.id === h.slot))
        reject("incompatible", "HOOK_SLOT", `The descriptor has no typed hook slot ${h.slot}.`);
    const manifest = lookup.get(b.template);
    if (b.target.kind === "container" && !r.external && manifest?.kind !== "element")
      reject(
        "incompatible",
        "HOST_IMPLEMENTATION",
        "An application/store host requires a registered element implementation; selecting an attachment cannot create its host.",
      );
    if (!d.targets.includes(b.target.kind as (typeof d.targets)[number]))
      reject(
        "incompatible",
        "TARGET_KIND",
        "The descriptor cannot be selected for this target kind.",
      );
    if (
      ["container", "component", "connection", "component-relationship"].includes(r.ref.kind) &&
      !same(r.ref, b.target)
    )
      reject(
        "incompatible",
        "PRIMARY_TARGET",
        "A C2/C3/relationship selection cannot supply a different primary availability barrier.",
      );
    const target = requirements.find((r) => same(r.ref, b.target));
    if (
      !target ||
      (!["connection", "component-relationship"].includes(b.target.kind) &&
        r.host &&
        target.host &&
        r.host !== target.host)
    )
      reject(
        "incompatible",
        "OWNER",
        "This selection belongs to a different host or a missing target.",
      );
    const host = design.elements.find((e) => e.id === r.host),
      role = host && componentHostRole(host, lookup);
    if (
      d.requires.hostRoles.length &&
      (!role || !d.requires.hostRoles.includes(role as (typeof d.requires.hostRoles)[number]))
    )
      reject("incompatible", "HOST_ROLE", "The responsibility's host role is unsupported.");
    const templateFor = (id: string | undefined) => {
      const e = design.elements.find((e) => e.id === id);
      return (
        e?.template ??
        bindings.find((v) => v.target.kind === "container" && v.target.id === id)?.template
      );
    };
    if (
      d.requires.hostTemplates.length &&
      !d.requires.hostTemplates.some(
        (t) =>
          contractKey(t) ===
          (templateFor(r.host) && contractKey(requiredValue(templateFor(r.host)))),
      )
    )
      reject(
        "incompatible",
        "HOST_TEMPLATE",
        "The exact host template is unsupported or unselected.",
      );
    if (r.stores.length > 1)
      reject(
        "incompatible",
        "CROSS_STORE",
        "Multiple transaction stores cannot be supplied as one local transaction.",
      );
    if (r.stores.length && (!b.store || !r.stores.includes(b.store)))
      reject(
        "incompatible",
        "TRANSACTION_STORE",
        "The selected store must equal the declaration's exact authoritative transaction store.",
      );
    if (d.requires.storeTemplates.length && !b.store)
      reject(
        "incompatible",
        "STORE_REQUIRED",
        "The descriptor requires an explicit authoritative store selection.",
      );
    if (
      b.store &&
      d.requires.storeTemplates.length &&
      !d.requires.storeTemplates.some(
        (t) =>
          contractKey(t) ===
          (templateFor(b.store) && contractKey(requiredValue(templateFor(b.store)))),
      )
    )
      reject(
        "incompatible",
        "STORE_TEMPLATE",
        "The exact store template is unsupported or unselected.",
      );
    if (r.stores.length && !d.requires.storeTemplates.length)
      reject("unsupported", "STORE_SUPPORT", "No store support is declared.");
    const relationship =
      b.target.kind === "connection" || b.target.kind === "component-relationship"
        ? b.target
        : undefined;
    if (
      relationship &&
      r.ref.kind === b.target.kind &&
      !(design.architecture?.bindings ?? []).some(
        (v) =>
          v.relationship.kind === b.target.kind &&
          v.relationship.id === b.target.id &&
          b.obligations.some((o) => o.kind === "binding" && o.id === v.id),
      )
    )
      reject(
        "incompatible",
        "WIRING",
        "A relationship needs its exact participating interface binding; a protocol label supplies no wiring.",
      );
    if (r.ref.kind === "binding" && !r.transport)
      reject(
        "unsupported",
        "TRANSPORT_REQUIRED",
        "Select the exact adapter transport on the interface binding.",
      );
    if (r.transport && !d.requires.transports.includes(r.transport))
      reject("unsupported", "TRANSPORT", "The exact adapter transport is unsupported.");
    for (const c of r.context)
      if (!d.requires.context.includes(c as (typeof d.requires.context)[number]))
        reject("unsupported", "CONTEXT", `Missing trusted context support: ${c}.`);
    for (const c of r.revocation)
      if (!d.requires.revocation.includes(c as (typeof d.requires.revocation)[number]))
        reject("unsupported", "REVOCATION", `Missing current-state revocation recheck: ${c}.`);
    if (
      (r.external || b.environment) &&
      (!b.environment ||
        !design.architecture?.bindings?.some(
          (v) =>
            v.id === b.environment?.adapterBinding &&
            claims(b).some((o) => o.kind === "binding" && o.id === v.id),
        ))
    )
      reject(
        "incompatible",
        "EXTERNAL_BINDING",
        "An external adapter needs exact participating interfaces and an explicit fixture/production environment registry binding.",
      );
    if (r.external && b.environment) {
      const adapter = design.architecture?.bindings?.find(
        (v) => v.id === b.environment?.adapterBinding,
      );
      const endpoints = adapter
        ? [adapter.provided, adapter.required]
            .map((id) => design.architecture?.interfaces?.find((i) => i.id === id))
            .filter((i) => i !== undefined)
        : [];
      if (!endpoints.some((i) => contractOwnerElement(design, i.owner) === r.host))
        reject(
          "incompatible",
          "EXTERNAL_OWNER",
          "The external adapter interfaces must include this exact external container.",
        );
    }
    for (const dep of d.dependencies)
      if (
        !bindings.some(
          (v) =>
            contractKey(v.template) === contractKey(dep.template) &&
            contractKey(v.capability) === contractKey(dep.capability) &&
            descriptor(v) &&
            requirements.find((r) => same(r.ref, v.target))?.host === target?.host,
        )
      )
        reject(
          "unsupported",
          "DEPENDENCY",
          `Missing same-host exact dependency ${contractKey(dep.template)}/${contractKey(dep.capability)}.`,
        );
    for (const dep of d.conflicts)
      if (
        bindings.some(
          (v) =>
            contractKey(v.template) === contractKey(dep.template) &&
            contractKey(v.capability) === contractKey(dep.capability) &&
            requirements.find((r) => same(r.ref, v.target))?.host === target?.host,
        )
      )
        reject(
          "incompatible",
          "CONFLICT",
          `Conflicting exact selection ${contractKey(dep.template)}/${contractKey(dep.capability)}.`,
        );
    const provided = d.provides.find((p) => p.kind === r.ref.kind);
    if (!provided) {
      reject(
        "unsupported",
        "OBLIGATION_KIND",
        "The descriptor supplies no support for this obligation kind.",
      );
      return row;
    }
    const contracts =
      design.architecture?.contracts?.filter((c) => r.contracts.includes(contractKey(c))) ?? [];
    for (const type of new Set(shapes([r.value, ...contracts.map((c) => c.shape)])))
      if (
        !provided.shapes.includes(type as (typeof provided.shapes)[number]) ||
        type === "unresolved"
      )
        reject("unsupported", "SHAPE", `Unsupported typed shape: ${type}.`);
    if (
      r.ref.kind === "contract" &&
      !design.architecture?.contracts?.find((c) => c.id === r.ref.id && c.version === r.ref.version)
        ?.shape
    )
      reject(
        "unsupported",
        "SHAPE_UNRESOLVED",
        "The source-backed contract requires an explicit compiler adapter; no shape is inferred.",
      );
    for (const demand of capabilityOptionDemands(r.value)) {
      const option = provided.options.find((o) => o.path === demand.path),
        s = option?.support;
      if (
        !s ||
        (s.kind === "values" && !s.values.includes(demand.value)) ||
        (s.kind === "scalar" &&
          !(s.type === "text"
            ? typeof demand.value === "string" && demand.value.length <= (s.maximumLength ?? 2000)
            : s.type === "integer"
              ? typeof demand.value === "number" && Number.isSafeInteger(demand.value)
              : s.type === "boolean"
                ? typeof demand.value === "boolean"
                : demand.value === null)) ||
        (s.kind === "range" &&
          (typeof demand.value !== "number" ||
            demand.value < s.minimum ||
            demand.value > s.maximum))
      )
        reject(
          "unsupported",
          "OPTION",
          `Unsupported option ${demand.path} = ${JSON.stringify(demand.value)}.`,
          demand.path,
        );
      else if (s.kind === "hook") {
        const seam = requiredValue(d.hooks.find((h) => h.id === s.hook)),
          selectedHook = b.hooks.find((h) => h.slot === s.hook),
          hook = design.architecture?.backend?.hooks?.find(
            (h) => selectedHook && contractKey(h) === contractKey(selectedHook.hook),
          );
        const ready =
          !!hook &&
          contractOwnerElement(design, hook.owner) === target?.host &&
          (b.target.kind !== "component" ||
            (hook.owner.kind === "component" && hook.owner.id === b.target.id)) &&
          (b.target.kind !== "operation" ||
            (hook.operation.id === b.target.id && hook.operation.version === b.target.version)) &&
          hook.kind === seam.execution &&
          contractKey(hook.contracts.input) === contractKey(seam.input) &&
          contractKey(hook.contracts.output) === contractKey(seam.output) &&
          contractKey(hook.contracts.error) === contractKey(seam.error);
        if (!row.hooks.some((h) => h.slot === s.hook))
          row.hooks.push({
            slot: s.hook,
            ...(selectedHook ? { hook: contractKey(selectedHook.hook) } : {}),
            ready,
          });
        reject(
          ready ? "needs-explicit-hook" : selectedHook ? "incompatible" : "needs-explicit-hook",
          ready ? "HOOK_PENDING" : selectedHook ? "HOOK_SIGNATURE" : "HOOK_REQUIRED",
          ready
            ? "Explicit typed hook is selected; project implementation and acceptance remain pending."
            : "Select an exact typed hook matching the descriptor input/output/error and execution kind.",
          demand.path,
        );
      }
    }
    if (!row.reasons.length)
      row.reasons.push({
        code: "EXACT_SUPPORT",
        message:
          "The registered descriptor supplies this exact obligation and its declared options. Evidence remains unobserved.",
      });
    return row;
  });
  // A dependency must itself be compatible. Cycles cannot bootstrap support from mere presence.
  const visiting = new Set<string>(),
    resolved = new Map<string, boolean>();
  const valid = (b: BackendImplementation): boolean => {
    const key = contractKey(b),
      previous = resolved.get(key);
    if (previous !== undefined) return previous;
    if (visiting.has(key)) return false;
    visiting.add(key);
    const d = descriptor(b),
      own = obligations.filter((o) => o.binding === key);
    const ok =
      !!d &&
      own.length > 0 &&
      own.every(
        (o) =>
          o.status === "supported" ||
          (o.status === "needs-explicit-hook" && o.hooks.every((h) => h.ready)),
      ) &&
      d.dependencies.every((dep) =>
        bindings.some(
          (v) =>
            contractKey(v.template) === contractKey(dep.template) &&
            contractKey(v.capability) === contractKey(dep.capability) &&
            valid(v),
        ),
      );
    visiting.delete(key);
    resolved.set(key, ok);
    return ok;
  };
  for (const b of bindings) valid(b);
  for (const row of obligations) {
    const b = bindings.find((b) => contractKey(b) === row.binding),
      d = b && descriptor(b);
    if (d?.dependencies.length && b && !resolved.get(contractKey(b))) {
      row.status = row.status === "incompatible" ? "incompatible" : "unsupported";
      row.reasons.push({
        code: "DEPENDENCY_BLOCKED",
        message: "A required exact dependency is incompatible, unsupported or cyclic.",
      });
    }
  }
  const rawFindings = validateDesign(design, lookup);
  const structuralFindings = rawFindings.filter(isStructural);
  const designBlocked = rawFindings.some(
    (f) => f.severity === "error" && f.code !== "NEEDS_TEMPLATE",
  );
  const enabled = !!design.architecture?.backend;
  return {
    schemaVersion: 1,
    enabled,
    foundationReady:
      enabled &&
      obligations.length > 0 &&
      !designBlocked &&
      obligations.every(
        (o) =>
          o.status === "supported" ||
          (o.status === "needs-explicit-hook" && o.hooks.every((h) => h.ready)),
      ),
    fullReady:
      enabled &&
      obligations.length > 0 &&
      !designBlocked &&
      obligations.every((o) => o.status === "supported"),
    obligations,
    structuralFindings,
    rawFindings,
    limitation:
      "Manifest support is declared availability, separate from design-review completeness and observed verification. Foundation permits explicit typed hooks with pending implementation; full readiness requires supplied obligations. Raw design findings and the global legacy generation gate are unchanged. No application runtime or generation is supplied.",
  };
}

function requiredValue<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Expected a validated model member.");
  return value;
}
