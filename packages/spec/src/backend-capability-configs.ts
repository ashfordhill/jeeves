/** Pure option/reference validation and portability. Never runs configured behavior. */
import type { Architecture } from "./architecture.ts";
import {
  contractCanonical,
  contractKey,
  contractOwnerElement,
  resolveContractValue,
} from "./architecture-contracts.ts";
import type {
  BackendCapabilityConfig,
  BackendProviderReference,
} from "./backend-capability-configs-model.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import type { BackendModel, BackendReference } from "./backend-model.ts";
import { validateBackendPolicyUse } from "./backend-policy.ts";
import type { BackendRecheckSite } from "./backend-policy-model.ts";
import { backendQuerySources } from "./backend-queries.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

type Collection =
  | "contracts"
  | "entities"
  | "queries"
  | "accessPolicies"
  | "lifecycles"
  | "operations"
  | "effects"
  | "hooks"
  | "capabilityConfigs";
type Visit = (r: BackendReference, collection: Collection) => BackendReference;
const same = (a: BackendReference, b: BackendReference) => contractKey(a) === contractKey(b);
/** One traversal owns every outer ref. Local fields/rules/actions/states/environment IDs stay stable. */
function mapConfig(
  c: BackendCapabilityConfig,
  visit: Visit,
  id: (v: string) => string,
): BackendCapabilityConfig {
  const provider = (p: BackendProviderReference): BackendProviderReference => ({
    ...p,
    contract: visit(p.contract, "contracts"),
    interface: id(p.interface),
    binding: id(p.binding),
  });
  const access = <T extends { policy: BackendReference }>(v: T): T => ({
    ...v,
    policy: visit(v.policy, "accessPolicies"),
  });
  const base = { id: id(c.id), owner: { ...c.owner, id: id(c.owner.id) } };
  switch (c.kind) {
    case "delivery":
      return {
        ...c,
        id: base.id,
        owner: base.owner,
        effect: visit(c.effect, "effects"),
        queue: { ...c.queue, event: visit(c.queue.event, "contracts") },
        due:
          c.due.kind === "business-deadline"
            ? { ...c.due, config: visit(c.due.config, "capabilityConfigs") }
            : c.due,
        unknown:
          c.unknown.kind === "reconcile"
            ? { ...c.unknown, operation: visit(c.unknown.operation, "operations") }
            : c.unknown,
        ...(c.provider ? { provider: provider(c.provider) } : {}),
      };
    case "files":
      return {
        ...c,
        id: base.id,
        owner: base.owner,
        entity: visit(c.entity, "entities"),
        parent: visit(c.parent, "entities"),
        store: provider(c.store),
        parentAccess: access(c.parentAccess),
        lifecycle: visit(c.lifecycle, "lifecycles"),
        inspection:
          c.inspection.kind === "hook"
            ? { ...c.inspection, hook: visit(c.inspection.hook, "hooks") }
            : c.inspection,
        cleanup: { ...c.cleanup, delivery: visit(c.cleanup.delivery, "capabilityConfigs") },
      };
    case "notifications":
      return {
        ...c,
        id: base.id,
        owner: base.owner,
        effect: visit(c.effect, "effects"),
        recipients: visit(c.recipients, "queries"),
        cutoff: { ...c.cutoff, event: visit(c.cutoff.event, "contracts") },
        preferences: { ...c.preferences, query: visit(c.preferences.query, "queries") },
        access: access(c.access),
        channels: c.channels.map((v) =>
          v.kind === "inbox"
            ? { ...v, operation: visit(v.operation, "operations") }
            : {
                ...v,
                delivery: visit(v.delivery, "capabilityConfigs"),
                provider: provider(v.provider),
              },
        ),
      };
    case "search":
      return {
        ...c,
        id: base.id,
        owner: base.owner,
        source: visit(c.source, "entities"),
        query: visit(c.query, "queries"),
        access: access(c.access),
        projection: { ...c.projection, dataset: id(c.projection.dataset) },
        rebuild: { ...c.rebuild, operation: visit(c.rebuild.operation, "operations") },
        freshness:
          c.freshness.kind === "bounded-staleness"
            ? { ...c.freshness, delivery: visit(c.freshness.delivery, "capabilityConfigs") }
            : c.freshness,
      };
    case "calendar":
      return { ...c, id: base.id, owner: base.owner };
    case "business-time":
      return {
        ...c,
        id: base.id,
        owner: base.owner,
        calendar: visit(c.calendar, "capabilityConfigs"),
        entity: visit(c.entity, "entities"),
        startEvents: c.startEvents.map((v) => visit(v, "contracts")),
        stopEvents: c.stopEvents.map((v) => visit(v, "contracts")),
        lifecycle: visit(c.lifecycle, "lifecycles"),
        due: { ...c.due, entity: visit(c.due.entity, "entities") },
        clockVersion: { ...c.clockVersion, entity: visit(c.clockVersion.entity, "entities") },
      };
    case "routing":
      return {
        ...c,
        id: base.id,
        owner: base.owner,
        operation: visit(c.operation, "operations"),
        audit: visit(c.audit, "effects"),
      };
  }
}
export function backendCapabilityExactReferences(c: BackendCapabilityConfig) {
  const result: { collection: Collection; reference: BackendReference }[] = [];
  mapConfig(
    c,
    (reference, collection) => {
      result.push({ reference, collection });
      return reference;
    },
    (v) => v,
  );
  return result;
}
export function backendCapabilityReferences(c: BackendCapabilityConfig): string[] {
  const ids: string[] = [];
  mapConfig(
    c,
    (r) => {
      ids.push(r.id);
      return r;
    },
    (v) => {
      ids.push(v);
      return v;
    },
  );
  return ids.filter((v) => v !== c.id);
}
export function backendCapabilityContracts(m: BackendModel | undefined): BackendReference[] {
  return (m?.capabilityConfigs ?? []).flatMap((c) =>
    backendCapabilityExactReferences(c)
      .filter((r) => r.collection === "contracts")
      .map((r) => r.reference),
  );
}
export function mapBackendCapabilityConfigs(
  m: BackendModel,
  ids: Record<string, string>,
): Pick<BackendModel, "capabilityConfigs"> {
  const id = (v: string) => ids[v] ?? v;
  return m.capabilityConfigs
    ? {
        capabilityConfigs: m.capabilityConfigs.map((c) =>
          mapConfig(c, (r) => ({ ...r, id: id(r.id) }), id),
        ),
      }
    : {};
}
export function collectBackendCapabilityDependencies(m: BackendModel, keep: Set<string>): void {
  for (const c of m.capabilityConfigs ?? []) {
    if (keep.has(c.owner.id)) keep.add(c.id);
    if (keep.has(c.id)) for (const id of backendCapabilityReferences(c)) keep.add(id);
  }
}
/** Pin supporting interfaces/relationships when reusing an exact backend boundary. */
export function backendCapabilityContextReferences(a: Architecture): string[] {
  const keep = new Set((a.backend?.capabilityConfigs ?? []).flatMap(backendCapabilityReferences));
  for (const b of a.bindings ?? [])
    if (keep.has(b.id)) {
      keep.add(b.provided);
      keep.add(b.required);
      keep.add(b.relationship.id);
      keep.add(b.contract.id);
    }
  return [...keep];
}

export function validateBackendCapabilityConfigs(design: DesignDocument): Finding[] {
  const a = design.architecture,
    m = a?.backend;
  if (!a || !m) return [];
  const result: Finding[] = [];
  for (const c of m.capabilityConfigs ?? []) {
    const path = ["architecture", "backend", "capabilityConfigs", contractKey(c)];
    const add = (
      message: string,
      suffix: (string | number)[] = [],
      code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "CONFIG_REQUIRED" = "CONFIG_INVALID",
    ) => result.push(finding(code, `${c.name}: ${message}`, { path: [...path, ...suffix] }));
    const owner = contractOwnerElement(design, c.owner);
    if (!owner)
      add("Select an existing owning application/component.", ["owner"], "UNKNOWN_REFERENCE");
    for (const r of backendCapabilityExactReferences(c)) {
      const values = r.collection === "contracts" ? a.contracts : m[r.collection];
      if (!values?.some((v) => same(v, r.reference)))
        add(
          `Exact ${r.collection} ${contractKey(r.reference)} does not exist.`,
          [r.collection, contractKey(r.reference)],
          "UNKNOWN_REFERENCE",
        );
    }
    const unique = (vs: string[], label: string) => {
      if (new Set(vs).size !== vs.length) add(`${label} must be distinct.`);
    };
    const contract = (r: BackendReference) => a.contracts?.find((v) => same(v, r));
    const entity = (r: BackendReference) => backendEntity(design, r);
    const ownedEntity = (r: BackendReference) => {
      const e = entity(r),
        ds = a.datasets?.find((d) => d.id === e?.dataset);
      if (ds && !ds.owners.some((o) => contractOwnerElement(design, o) === owner))
        add("Configured entity must belong to its owning application.");
    };
    const query = (r: BackendReference) => m.queries?.find((v) => same(v, r));
    const operation = (r: BackendReference) => m.operations?.find((v) => same(v, r));
    const effect = (r: BackendReference) => m.effects?.find((v) => same(v, r));
    const config = (r: BackendReference, kind: BackendCapabilityConfig["kind"]) => {
      const v = m.capabilityConfigs?.find((v) => same(v, r));
      if (v && v.kind !== kind) add(`Expected a ${kind} configuration, received ${v.kind}.`);
      return v;
    };
    const field = (r: { entity: BackendReference; field: string }, type?: string) => {
      const e = entity(r.entity),
        f = e && backendEntityFields(design, e).find((v) => v.id === r.field);
      if (!f)
        add(
          `Entity field ${contractKey(r.entity)}/${r.field} does not exist.`,
          [],
          "UNKNOWN_REFERENCE",
        );
      else if ((type && f.type !== type) || !f.required || f.nullable)
        add(`Field ${r.field} must be a required nonnullable ${type ?? "value"}.`);
      return f;
    };
    const event = (r: BackendReference, timestamp?: string) => {
      const v = contract(r);
      if (v && (v.kind !== "event" || !v.shape?.payload.length))
        add("Select a typed event contract.");
      if (timestamp && v) {
        const raw = v.shape?.payload.find((v) => v.id === timestamp);
        const value = raw && resolveContractValue(raw, v.shape?.types ?? []).value;
        const f = raw && value ? { ...value, required: raw.required } : undefined;
        if (f?.type !== "timestamp" || !f.required || f.nullable)
          add("Event time must select a required nonnullable timestamp field.");
      }
    };
    const ownedOperation = (r: BackendReference) => {
      const o = operation(r);
      if (o && contractOwnerElement(design, o.target.owner) !== owner)
        add("Configuration operation must belong to its owning application.");
      return o;
    };
    const policy = (
      resource: BackendReference,
      access: { policy: BackendReference; action: string; projection: string },
      sites: BackendRecheckSite[],
      fields?: string[],
    ) => {
      for (const site of sites)
        result.push(
          ...validateBackendPolicyUse(design, {
            resource,
            selection: { kind: "policy", reference: access.policy },
            action: access.action,
            projection: access.projection,
            site,
            fields,
            path: [...path, "access", site],
          }),
        );
    };
    const provider = (p: BackendProviderReference, roles: string[]) => {
      const i = a.interfaces?.find((v) => v.id === p.interface),
        b = a.bindings?.find((v) => v.id === p.binding),
        required = a.interfaces?.find((v) => v.id === b?.required);
      const w = contract(p.contract)?.shape?.operations.find((v) => v.id === p.operation);
      if (!i || !b || !w)
        add(
          "Provider requires an exact interface, binding and contract operation.",
          ["provider"],
          "UNKNOWN_REFERENCE",
        );
      if (
        i &&
        b &&
        (!same(i.contract, p.contract) ||
          !same(b.contract, p.contract) ||
          i.direction !== "provided" ||
          b.provided !== i.id ||
          b.operation !== p.operation ||
          !roles.includes(b.role) ||
          !required ||
          required.direction !== "required" ||
          !same(required.contract, p.contract) ||
          required.owner.kind !== c.owner.kind ||
          required.owner.id !== c.owner.id ||
          contractOwnerElement(design, required.owner) !== owner ||
          b.relationship.kind !== "connection")
      )
        add(
          "Provider must retain its actual provided interface, exact C2 operation binding, consumer owner and direction.",
        );
    };
    switch (c.kind) {
      case "delivery": {
        const e = effect(c.effect);
        event(c.queue.event, c.due.kind === "event-time" ? c.due.field : undefined);
        if (c.due.kind === "business-deadline") config(c.due.config, "business-time");
        if (e) {
          const o = ownedOperation(e.source);
          if (o && e.execution === "local")
            add("Local atomic appends do not use a leased delivery queue.");
          const intent =
            e.execution === "external"
              ? e.after
                  .map((r) => effect(r))
                  .find(
                    (v) =>
                      v?.execution === "durable-intent" &&
                      same(v.source, e.source) &&
                      same(v.payload, c.queue.event),
                  )
              : e;
          if (!intent || !same(c.queue.event, intent.payload))
            add("Queue event must select the exact durable intent payload preceding the effect.");
          if (c.provider && e.execution !== "external")
            add("A provider adapter belongs to an after-commit external effect.");
          if (
            c.attempts !== e.delivery.attempts ||
            c.timeoutSeconds !== e.delivery.timeoutSeconds ||
            c.duplicates !== e.delivery.duplicates
          )
            add(
              "Delivery settings must agree with the referenced effect's attempts, timeout and duplicate policy.",
            );
          if (
            (c.backoff.kind === "fixed" ? c.backoff.seconds : c.backoff.initialSeconds) !==
            e.delivery.backoffSeconds
          )
            add("Initial backoff must agree with the referenced effect.");
          if (e.execution === "external" && !c.provider && e.target.kind !== "hook")
            add(
              "External delivery needs an explicit provider adapter.",
              ["provider"],
              "CONFIG_REQUIRED",
            );
        }
        if (c.timeoutSeconds > c.leaseSeconds || c.leaseSeconds > c.deadlineSeconds)
          add("Timeout must fit the lease, and lease must fit the deadline.");
        if (
          c.backoff.kind === "exponential" &&
          (c.backoff.initialSeconds > c.backoff.maximumSeconds ||
            c.backoff.maximumSeconds >= c.deadlineSeconds)
        )
          add("Exponential backoff bounds must be ordered and fit the deadline.");
        if (c.backoff.kind === "fixed" && c.backoff.seconds >= c.deadlineSeconds)
          add("Backoff must fit the deadline.");
        if (c.provider) {
          provider(c.provider, ["request", "publish"]);
          if (
            (c.provider.deduplication === "none" && c.duplicates !== "possible") ||
            (c.duplicates === "destination-key" &&
              c.provider.deduplication !== "destination-key") ||
            c.duplicates === "deduplicated-local-effect"
          )
            add(
              "External providers without destination deduplication must declare possible duplicates.",
            );
          if (c.provider.deduplication === "none" && c.unknown.kind !== "reconcile")
            add(
              "An ambiguous external result without destination deduplication requires reconciliation before retry.",
            );
        }
        if (c.unknown.kind === "reconcile") {
          const u = c.unknown,
            o = operation(u.operation),
            outcome = o?.outcomes.find((v) => v.outcome === u.outcome);
          if (o && !outcome) add("Reconciliation outcome does not exist.", [], "UNKNOWN_REFERENCE");
          if (
            outcome &&
            (() => {
              const wire =
                o &&
                contract(o.target.contract)
                  ?.shape?.operations.find((w) => w.id === o.target.operation)
                  ?.outcomes?.find((v) => v.id === outcome.outcome);
              return wire?.state !== "Unknown" || wire.retry !== "Reconcile first";
            })()
          )
            add("Unknown delivery must retain an Unknown/Reconcile first outcome.");
        }
        break;
      }
      case "files": {
        ownedEntity(c.entity);
        ownedEntity(c.parent);
        provider(c.store, ["request", "read", "write"]);
        const e = entity(c.entity),
          parent = entity(c.parent);
        if (
          e &&
          parent &&
          (same(c.entity, c.parent) ||
            !e.relations.some((r) => same(r.target, c.parent) && r.scope === "same-scope"))
        )
          add("File metadata must reference its parent through an explicit same-scope relation.");
        unique(c.acceptedTypes, "Accepted MIME types");
        unique(Object.values(c.states), "File lifecycle states");
        const l = m.lifecycles?.find((v) => same(v, c.lifecycle));
        if (
          l &&
          (!same(l.state.entity, c.entity) ||
            Object.values(c.states).some((v) => !l.states.includes(v)))
        )
          add("File states must select the file entity's exact lifecycle states.");
        policy(c.parent, c.parentAccess, ["read", "bytes"]);
        if (c.inspection.kind === "hook") {
          const h = m.hooks?.find((v) =>
            same(v, c.inspection.kind === "hook" ? c.inspection.hook : { id: "", version: "" }),
          );
          if (h && (!h.required || contractOwnerElement(design, h.owner) !== owner))
            add("Inspection hook must be required and owned by the file application.");
        }
        config(c.cleanup.delivery, "delivery");
        break;
      }
      case "notifications": {
        const q = query(c.recipients),
          prefs = query(c.preferences.query),
          e = effect(c.effect);
        event(c.cutoff.event, c.cutoff.field);
        if (e && (e.target.kind !== "notification" || !same(e.target.recipients, c.recipients)))
          add("Notification settings must select the exact effect recipient query.");
        const output = (q: ReturnType<typeof query>, id: string, identity = true) => {
          const p = q?.projection.find((v) => v.id === id);
          if (q && !p) add(`Query output ${id} does not exist.`, [], "UNKNOWN_REFERENCE");
          if (!q || !p) return undefined;
          if (identity && p.field.source !== "root") {
            add("Recipient and preference identities must come from the query root.");
            return undefined;
          }
          const source = backendQuerySources(design, q).get(p.field.source);
          if (!source) {
            add("Query projection source does not exist.", [], "UNKNOWN_REFERENCE");
            return undefined;
          }
          if (identity) return field({ entity: source.entity, field: p.field.field });
          const f = backendEntityFields(design, source.entity).find((f) => f.id === p.field.field);
          if (!f) add("Projected notification field does not exist.", [], "UNKNOWN_REFERENCE");
          return f;
        };
        if (q) {
          const recipient = output(q, c.recipient);
          if (recipient && recipient.type !== "uuid") add("Recipient identity must be a UUID.");
          if (c.pageSize > q.limit.maximum) add("Recipient page size exceeds the bounded query.");
          for (const f of c.fields) output(q, f, false);
          const cutoff = q.filters.find((f) => f.id === c.cutoff.filter);
          const cutoffSource = cutoff && backendQuerySources(design, q).get(cutoff.field.source);
          if (!cutoff || !cutoffSource)
            add(
              "Recipient cutoff must select an existing bounded query filter.",
              [],
              "UNKNOWN_REFERENCE",
            );
          else {
            field({ entity: cutoffSource.entity, field: cutoff.field.field }, "timestamp");
            if (!cutoff.comparisons.includes("lte"))
              add("Subscription cutoff filter must support created-at <= source event time.");
          }
          for (const sourceId of new Set(
            c.fields.flatMap((id) =>
              q.projection
                .filter((p) => p.id === id && p.field.source !== "root")
                .map((p) => p.field.source),
            ),
          )) {
            const source = backendQuerySources(design, q).get(sourceId),
              selection = q.sourcePolicies?.find((p) => p.source === sourceId);
            if (source && selection?.policy.kind === "policy" && selection.projection)
              policy(
                source.entity,
                {
                  ...c.access,
                  policy: selection.policy.reference,
                  projection: selection.projection,
                },
                ["job", "materialization", "delivery"],
                q.projection
                  .filter((p) => c.fields.includes(p.id) && p.field.source === sourceId)
                  .map((p) => p.field.field),
              );
            else
              add(
                "Joined notification content needs its own exact current service policy projection.",
              );
          }
          policy(
            q.root,
            c.access,
            ["job", "materialization", "delivery"],
            c.fields.flatMap((id) =>
              q.projection
                .filter((v) => v.id === id && v.field.source === "root")
                .map((v) => v.field.field),
            ),
          );
          if (
            q.accessPolicy.kind !== "policy" ||
            !same(q.accessPolicy.reference, c.access.policy) ||
            q.accessProjection !== c.access.projection
          )
            add(
              "Recipient query and notification must use the same exact current policy projection.",
            );
        }
        if (prefs) {
          const principalOutput = prefs.projection.find((p) => p.id === c.preferences.principal);
          const principalFilter = prefs.filters.find((f) => f.id === c.preferences.principalFilter);
          if (
            !principalFilter ||
            !principalOutput ||
            principalFilter.field.source !== principalOutput.field.source ||
            principalFilter.field.field !== principalOutput.field.field ||
            !principalFilter.comparisons.includes("eq")
          )
            add("Preferences must bind an exact equality filter to each recipient principal.");
          const principal = output(prefs, c.preferences.principal),
            enabled = output(prefs, c.preferences.enabled);
          if (principal && principal.type !== "uuid") add("Preference principal must be a UUID.");
          if (enabled && enabled.type !== "boolean")
            add("Preference enabled value must be boolean.");
          const p =
            prefs.accessPolicy.kind === "policy" &&
            m.accessPolicies?.find((v) =>
              same(
                v,
                prefs.accessPolicy.kind === "policy"
                  ? prefs.accessPolicy.reference
                  : { id: "", version: "" },
              ),
            );
          if (
            p &&
            (p.context.identity !== "verified-service" ||
              !p.revocation.recheck.includes("materialization") ||
              !p.revocation.recheck.includes("delivery"))
          )
            add(
              "Preference query requires current verified service policy at materialization and delivery.",
            );
        }
        unique(c.fields, "Notification projected outputs");
        unique(
          c.channels.map((v) => (v.kind === "inbox" ? "inbox" : v.channel)),
          "Channels",
        );
        for (const ch of c.channels)
          if (ch.kind === "inbox") ownedOperation(ch.operation);
          else {
            const d = config(ch.delivery, "delivery");
            provider(ch.provider, ["request", "publish"]);
            if (
              d?.kind === "delivery" &&
              (!d.provider || contractCanonical(d.provider) !== contractCanonical(ch.provider))
            )
              add(
                "Notification channel and delivery must select the identical provider configuration.",
              );
          }
        break;
      }
      case "search": {
        ownedEntity(c.source);
        const e = entity(c.source),
          q = query(c.query),
          d = a.datasets?.find((v) => v.id === c.projection.dataset);
        if (!d)
          add("Search projection dataset does not exist.", ["projection"], "UNKNOWN_REFERENCE");
        if (d && !d.owners.some((o) => contractOwnerElement(design, o) === owner))
          add("Search projection must be owned by the configured application.");
        unique(c.fields, "Search source fields");
        for (const f of c.fields) field({ entity: c.source, field: f }, "text");
        policy(c.source, c.access, ["search"], c.fields);
        if (
          q &&
          (!same(q.root, c.source) ||
            q.accessSite !== "search" ||
            q.accessPolicy.kind !== "policy" ||
            !same(q.accessPolicy.reference, c.access.policy) ||
            q.accessProjection !== c.access.projection ||
            c.maximumResults > q.limit.maximum)
        )
          add(
            "Search must use the exact source, current policy, search projection and bounded query.",
          );
        if (e && d?.id === e.dataset && c.freshness.kind !== "synchronous")
          add("An asynchronous search projection cannot overwrite its authoritative dataset.");
        if (c.freshness.kind === "bounded-staleness") config(c.freshness.delivery, "delivery");
        ownedOperation(c.rebuild.operation);
        break;
      }
      case "calendar": {
        try {
          if (/^[+-]/.test(c.timezone)) throw new Error();
          new Intl.DateTimeFormat("en", { timeZone: c.timezone });
        } catch {
          add("Calendar timezone must be an IANA timezone identifier.", ["timezone"]);
        }
        unique(
          c.weekly.map((v) => String(v.day)),
          "Weekly days",
        );
        unique(
          c.holidays.map((v) => v.date),
          "Holiday dates",
        );
        const intervals = (
          vs: { startMinute: number; endMinute: number }[],
          at: (string | number)[],
        ) => {
          for (let i = 0; i < vs.length; i++) {
            const v = vs[i];
            if (!v) continue;
            if (
              v.startMinute >= v.endMinute ||
              vs.some((w, j) => j < i && v.startMinute < w.endMinute && w.startMinute < v.endMinute)
            )
              add(
                "Local half-open intervals must be positive and cannot overlap or cross midnight.",
                at,
              );
          }
        };
        for (const v of c.weekly) intervals(v.intervals, ["weekly", v.day]);
        for (const v of c.holidays) {
          const d = new Date(`${v.date}T00:00:00Z`);
          if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v.date)
            add("Holiday must be a real ISO calendar date.", ["holidays", v.date]);
          intervals(v.intervals, ["holidays", v.date]);
        }
        break;
      }
      case "business-time": {
        ownedEntity(c.entity);
        config(c.calendar, "calendar");
        for (const r of [...c.startEvents, ...c.stopEvents]) event(r);
        unique(c.startEvents.map(contractKey), "Start events");
        unique(c.stopEvents.map(contractKey), "Stop events");
        unique(c.runningStates, "Running states");
        if (c.startEvents.some((r) => c.stopEvents.some((s) => same(r, s))))
          add("The same event cannot both start and stop a business clock.");
        field(c.due, "timestamp");
        const version = field(c.clockVersion, "integer");
        if (
          version &&
          (version.minimum === undefined || version.minimum < 0 || version.maximum === undefined)
        )
          add("Clock version must be a bounded nonnegative integer.");
        if (!same(c.entity, c.due.entity) || !same(c.entity, c.clockVersion.entity))
          add("Due timestamp and clock revision must belong to the configured clock entity.");
        const e = entity(c.entity);
        if (
          e &&
          (!e.fields.find((f) => f.field === c.due.field)?.serverOwned ||
            e.fields.find((f) => f.field === c.clockVersion.field)?.serverOwned !== "version")
        )
          add("Clock due time and revision must be server owned.");
        const l = m.lifecycles?.find((v) => same(v, c.lifecycle));
        if (
          l &&
          (!same(l.state.entity, c.entity) || c.runningStates.some((v) => !l.states.includes(v)))
        )
          add("Business clock states must select its exact entity lifecycle.");
        break;
      }
      case "routing": {
        const o = ownedOperation(c.operation),
          audit = effect(c.audit);
        unique(
          c.rules.map((v) => v.id),
          "Rule identities",
        );
        unique(
          c.rules.map((v) => String(v.priority)),
          "Rule priorities",
        );
        for (const r of c.rules) {
          unique(r.predicates, "Rule predicates");
          unique(r.actions, "Rule actions");
          for (const id of r.actions) {
            const action = o?.actions.find((v) => v.id === id);
            if (!action) continue;
            if (action.kind !== "patch" && action.kind !== "transition")
              add(
                "Routing selects finite patch/transition actions; hooks and other action kinds need their own explicit operation.",
              );
            const target =
              action.kind === "transition"
                ? m.lifecycles?.find((l) => same(l, action.lifecycle))?.state.entity
                : "entity" in action
                  ? action.entity
                  : undefined;
            if (
              target &&
              m.accessPolicies?.some((p) =>
                p.clauses.some((clause) => "entity" in clause && same(clause.entity, target)),
              )
            )
              add("Routing cannot mutate persisted role or membership authority.");
          }
          if (
            o &&
            (r.predicates.some((g) => !o.guards.some((v) => v.id === g)) ||
              r.actions.some((a) => !o.actions.some((v) => v.id === a)))
          )
            add(
              "Rules must reference existing guards and finite actions on their exact source operation.",
              ["rules", r.id],
              "UNKNOWN_REFERENCE",
            );
        }
        const count =
          c.match === "first"
            ? Math.max(...c.rules.map((r) => r.actions.length))
            : c.rules.reduce((n, r) => n + r.actions.length, 0);
        if (count > c.maximumActions)
          add("Maximum actions cannot truncate a possible first/all-match result.");
        if (c.match === "all")
          unique(
            c.rules.flatMap((r) => r.actions),
            "All-match action references",
          );
        if (
          audit &&
          (audit.target.kind !== "audit" ||
            !audit.required ||
            !same(audit.source, c.operation) ||
            audit.boundary !== "before-commit")
        )
          add(
            "Routing requires a required same-commit audit effect of the exact source operation.",
          );
        break;
      }
    }
  }
  return result;
}

/** Calendar versions are immutable once saved; referenced option versions keep the same semantics. */
export function validateBackendCapabilityTransition(
  before: DesignDocument,
  after: DesignDocument,
): Finding[] {
  const m = before.architecture?.backend;
  const references = (m?.capabilityConfigs ?? []).flatMap(backendCapabilityExactReferences);
  return (m?.capabilityConfigs ?? []).flatMap((c) => {
    if (
      c.kind !== "calendar" &&
      !references.some((r) => r.collection === "capabilityConfigs" && same(r.reference, c))
    )
      return [];
    const next = after.architecture?.backend?.capabilityConfigs?.find((v) => same(v, c));
    const semantics = (v: BackendCapabilityConfig) => {
      const { name: _name, ...rest } = v;
      return rest;
    };
    return !next || contractCanonical(semantics(c)) !== contractCanonical(semantics(next))
      ? [
          finding(
            "CONFIG_INVALID",
            `Immutable capability configuration ${contractKey(c)} must be preserved; create an explicit successor version.`,
            { path: ["architecture", "backend", "capabilityConfigs", contractKey(c)] },
          ),
        ]
      : [];
  });
}
