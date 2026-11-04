/** Structural checking of bounded protocol plans. No algorithm or hook is evaluated. */
import {
  type ContractField,
  contractCanonical,
  contractKey,
  contractOwnerElement,
} from "./architecture-contracts.ts";
import { backendValueChecks, backendValueFits } from "./backend-behavior.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import { validateCommerceProtocol } from "./backend-commerce-protocol.ts";
import { commerceProcedureRules } from "./backend-commerce-protocol-model.ts";
import { backendEntityFields } from "./backend-entity.ts";
import { validateBackendPolicyUse } from "./backend-policy.ts";
import { backendQuerySources } from "./backend-queries.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

export function validateBackendProtocol(design: DesignDocument, o: BackendOperation): Finding[] {
  const p = o.protocol;
  if (!p) return [];
  const a = design.architecture!,
    m = a.backend!,
    out: Finding[] = [],
    path = ["architecture", "backend", "operations", contractKey(o), "protocol"];
  const add = (
    code: "CONFIG_INVALID" | "UNKNOWN_REFERENCE",
    at: (string | number)[],
    message: string,
  ) => out.push(finding(code, message, { path: at }));
  const bad = (message: string) => add("CONFIG_INVALID", path, message);
  const same = (x: { id: string; version: string }, y: { id: string; version: string }) =>
    contractKey(x) === contractKey(y);
  const contract = a.contracts?.find((c) => same(c, o.target.contract)),
    wire = contract?.shape?.operations.find((w) => w.id === o.target.operation);
  const aggregate = m.aggregates.find((g) => same(g, o.aggregate));
  const host = contractOwnerElement(design, o.target.owner);
  if (!wire || !aggregate || !host) {
    bad("Protocol requires its exact wire operation, owner and aggregate.");
    return out;
  }
  if (
    !a.interfaces?.some(
      (i) =>
        i.direction === "provided" &&
        same(i.contract, o.target.contract) &&
        i.owner.kind === o.target.owner.kind &&
        i.owner.id === o.target.owner.id,
    )
  )
    bad("Protocol owner must provide the exact wire interface.");
  if (
    aggregate.store !== o.transaction.store ||
    (p.execution !== "authorized-worker" && contractOwnerElement(design, aggregate.owner) !== host)
  )
    bad("Protocol transaction must use its authoritative aggregate host/store.");
  const rootAccess = p.records.find((r) => same(r.entity, aggregate.root));
  if (
    rootAccess &&
    (o.access.policy.kind !== "policy" || !same(o.access.policy.reference, rootAccess.policy))
  )
    bad("Operation root access must agree with its exact protocol record policy.");
  out.push(...validateCommerceProtocol(design, o));
  const commerceRules = commerceProcedureRules[p.procedure as keyof typeof commerceProcedureRules];
  if (commerceRules) {
    if (
      !p.commerce ||
      contractCanonical([...p.commerce.rules].sort()) !==
        contractCanonical([...commerceRules].sort())
    )
      bad("Commerce procedure requires its exact finite safety rules.");
  } else if (p.commerce) bad("Commerce settings require a reviewed commerce procedure.");
  const distinct = (xs: string[], name: string) => {
    if (new Set(xs).size !== xs.length) bad(`${name} must be distinct.`);
  };
  distinct(
    p.records.map((r) => contractKey(r.entity)),
    "Protocol records",
  );
  if (p.progress) {
    const progress = p.progress;
    if (p.procedure !== "privacy-plan" || progress.store !== o.transaction.store)
      bad("Durable progress belongs to the same-store bounded privacy plan.");
    const state = m.entities.find((e) => same(e, progress.state));
    if (
      !state?.fields.some((f) => f.field === progress.key) ||
      !m.operations?.some(
        (v) => same(v, progress.continuation) && v.protocol?.procedure === "privacy-resume",
      )
    )
      bad("Progress needs its exact state key and continuation operation.");
    const h = m.hooks?.find((h) => p.hook && same(h, p.hook));
    if (
      !h ||
      !same(h.contracts.input, progress.input) ||
      !same(h.contracts.output, progress.result)
    )
      bad("Progress persists this exact validated pure-hook input/result, never anonymous JSON.");
    if (
      !o.outcomes.some((v) => v.outcome === progress.checkpoint && v.trigger === "success") ||
      !o.outcomes.some((v) => v.outcome === progress.terminal && v.trigger === "success")
    )
      bad("Progress checkpoints and terminal results must resolve exactly.");
  }
  if (o.actions.length)
    bad("A bounded protocol algorithm cannot also execute a second scalar action plan.");
  const inputFields = wire.input;
  if (
    contractCanonical(p.inputs.map((v) => v.path.join("/")).sort()) !==
    contractCanonical(inputFields.map((v) => v.id).sort())
  )
    bad("Bind every normalized top-level input exactly once.");
  const { checkValue, sourceType } = backendValueChecks(design, add);
  const allFields = (r: { id: string; version: string }) => {
    const e = m.entities.find((e) => same(e, r));
    return e ? backendEntityFields(design, e) : [];
  };
  if (p.provider) {
    const provider = p.provider,
      c = a.contracts?.find((c) => same(c, provider.contract)),
      binding = a.bindings?.find((b) => b.id === provider.binding),
      provided = a.interfaces?.find((i) => i.id === provider.interface),
      required = a.interfaces?.find((i) => i.id === binding?.required);
    if (
      !c?.shape?.operations.some((v) => v.id === provider.operation) ||
      !binding ||
      !provided ||
      !required ||
      !same(provided.contract, provider.contract) ||
      !same(binding.contract, provider.contract) ||
      binding.provided !== provided.id ||
      binding.operation !== provider.operation ||
      required.owner.kind !== o.target.owner.kind ||
      required.owner.id !== o.target.owner.id
    )
      bad("Provider step must retain its exact contract/operation, consumer owner and C2 binding.");
    if (p.externalIO === "none") bad("Provider steps cannot run inside the SQL transaction.");
  }
  if (o.query) {
    const q = m.queries?.find((q) => same(q, o.query!));
    for (const v of o.queryInputs ?? []) {
      const filter = q?.filters.find((f) => f.id === v.filter),
        source = q && filter && backendQuerySources(design, q).get(filter.field.source),
        f = source && allFields(source.entity).find((f) => f.id === filter!.field.field);
      if (!filter || !f || !filter.comparisons.includes(v.operator))
        bad("Query input must select an exact allowlisted filter.");
      else if (v.value) checkValue(v.value, f, path, o);
    }
  }
  const actual: string[] = [];
  for (const r of p.records) {
    const e = m.entities.find((e) => same(e, r.entity)),
      policy = m.accessPolicies?.find((v) => same(v, r.policy));
    if (!e || !policy || !same(policy.resource, r.entity)) {
      bad("Each record requires an exact entity policy.");
      continue;
    }
    if (
      r.authority &&
      (same(r.entity, aggregate.root) ||
        policy.context.identity !== "verified-service" ||
        !policy.context.service ||
        !p.commerce)
    )
      bad(
        "Source-authorized module access must be a scoped service participant of a finite commerce command, never its root authority.",
      );
    const dataset = a.datasets?.find((d) => d.id === e.dataset);
    if (p.execution === "authorized-worker") {
      const worker = design.elements.find((e) => e.id === host);
      const allowed = r.writes.length || r.delete ? dataset?.writers : dataset?.readers;
      if (
        worker?.planned !== "background-worker" ||
        !allowed?.some((v) =>
          r.writes.length || r.delete
            ? v.kind === o.target.owner.kind && v.id === o.target.owner.id
            : contractOwnerElement(design, v) === host,
        )
      )
        bad(
          "Worker access must be declared by the authority dataset for this exact executor and mode.",
        );
    }
    if (dataset?.store !== o.transaction.store)
      bad("Protocol records cannot promise cross-store atomicity.");
    if (!o.transaction.participants.some((v) => same(v, r.entity)))
      bad("Every protocol record must be an explicit transaction participant.");
    const fs = allFields(r.entity);
    distinct(
      r.writes.map((w) => w.field),
      "Protocol field writers",
    );
    for (const k of r.keys) {
      const f = fs.find((f) => f.id === k.field);
      if (!f) bad("Selector field does not exist.");
      else checkValue({ kind: "input", path: k.input }, f, path, o);
    }
    if (
      r.selection === "input-key" &&
      contractCanonical(r.keys.map((k) => k.field)) !== contractCanonical(e.primaryKey)
    )
      bad("Input selectors must bind the full ordered primary key.");
    if (
      r.selection === "scoped-unique-key" &&
      !e.uniqueKeys.some((k) => k.fields.every((f) => r.keys.some((x) => x.field === f)))
    )
      bad("Unique selectors must bind a complete declared key.");
    for (const w of r.writes) {
      const f = fs.find((f) => f.id === w.field),
        storage = e.fields.find((f) => f.field === w.field);
      actual.push(`${contractKey(e)}/${w.field}`);
      if (!f) {
        bad("Written field does not exist.");
        continue;
      }
      if (
        w.source.kind === "input" ||
        w.source.kind === "current" ||
        w.source.kind === "context" ||
        w.source.kind === "server" ||
        w.source.kind === "literal"
      ) {
        if (
          w.source.kind !== "server" ||
          !["next-version", "insert-or-next-version", "upsert-from-one-version"].includes(
            w.source.factory,
          )
        )
          checkValue(w.source, f, [...path, r.entity.id, w.field], o);
      }
      if (
        w.source.kind === "server" &&
        ["next-version", "insert-or-next-version", "upsert-from-one-version"].includes(
          w.source.factory,
        ) &&
        storage?.serverOwned !== "version"
      )
        bad("Checked revision factories may write only protected version fields.");
      if (storage?.serverOwned) {
        const source = w.source,
          owned = storage.serverOwned;
        const valid =
          owned === "id"
            ? source.kind === "server" && source.factory === "uuid"
            : owned === "scope" || owned === "principal"
              ? source.kind === "context" && source.value === owned
              : owned === "clock"
                ? source.kind === "server" && source.factory === "clock"
                : source.kind === "server" &&
                  [
                    "initial-version",
                    "next-version",
                    "insert-or-next-version",
                    "upsert-from-one-version",
                  ].includes(source.factory);
        if (!valid) bad("Protected fields require their exact trusted factory/context.");
      }
      if (
        w.source.kind === "server" &&
        w.source.factory === "insert-or-next-version" &&
        r.onMissing !== "insert-at-one"
      )
        bad("Insert-or-next version requires an explicit insert-at-one branch.");
      if (
        w.source.kind === "server" &&
        w.source.factory === "upsert-from-one-version" &&
        r.onMissing !== "insert-before-cas-from-one"
      )
        bad("Upsert version requires the declared virtual initial-one/CAS branch.");
      if (w.when === "create-only" && !r.onMissing)
        bad("Create-only fields require an explicit upsert branch.");
      const lifecycle = m.lifecycles?.find(
        (l) => same(l.state.entity, e) && l.state.field === w.field,
      );
      if (
        lifecycle &&
        !(
          r.selection === "server-created" &&
          w.source.kind === "literal" &&
          w.source.value === lifecycle.initial
        ) &&
        !(
          w.source.kind === "derived" &&
          w.source.rule === "selected-lifecycle-transition" &&
          p.transitions.some((t) => same(t.lifecycle, lifecycle))
        )
      )
        bad(
          "Lifecycle fields require exact finite transition dispatch, or their initial state on creation.",
        );
      if (w.source.kind === "derived") {
        const rule = w.source.rule;
        const supported: Record<string, { fields: string[]; procedures: string[] }> = {
          "inbox-channel-membership": {
            fields: ["inbox-enabled"],
            procedures: ["subscription-upsert"],
          },
          "email-channel-membership": {
            fields: ["email-enabled"],
            procedures: ["subscription-upsert"],
          },
          "new-object-key": { fields: ["object-key"], procedures: ["file-stage"] },
          "active-review-discriminator": {
            fields: ["active-review"],
            procedures: ["flag-submit", "flag-review"],
          },
          "accepted-adjudication-revision": {
            fields: ["adjudication-id", "decision-version"],
            procedures: ["abuse-adjudicate"],
          },
          "previous-revision": { fields: ["text"], procedures: ["post-revise"] },
          "window-delivery-identity": { fields: ["delivery-id"], procedures: ["digest-schedule"] },
          "verified-message-identity": {
            fields: ["source-identity"],
            procedures: ["inbound-reply"],
          },
          "selected-lifecycle-transition": {
            fields: ["state"],
            procedures: [
              "membership-upsert",
              "lifecycle-dispatch",
              "flag-review",
              "file-inspect",
              "file-associate",
              "topic-restructure",
              "privacy-plan",
              "orphan-cleanup",
              "delivery-reconcile",
              "digest-deliver",
              "external-delivery",
              "privacy-resume",
            ],
          },
          "validated-move-plan": {
            fields: ["topic-id", "post-id", "title", "plain-text", "projection-version", "as-of"],
            procedures: ["topic-restructure", "projection-rebuild"],
          },
          "merged-subscription-preferences": {
            fields: ["mode", "inbox-enabled", "email-enabled"],
            procedures: ["topic-restructure"],
          },
          "privacy-tombstone-plan": {
            fields: ["text"],
            procedures: ["privacy-plan", "lifecycle-dispatch"],
          },
          "privacy-progress-plan": {
            fields: ["progress-id", "text", "legal-hold"],
            procedures: ["privacy-plan", "privacy-resume"],
          },
          "post-created-event": {
            fields: ["principal-id", "post-id", "event-id", "subscription-id", "text"],
            procedures: ["notification-materialize"],
          },
        };
        if (rule === "selected-lifecycle-transition" && commerceRules)
          supported[rule]!.procedures.push(p.procedure);
        const spec =
          rule === "commerce-validated-plan" && commerceRules
            ? {
                fields: [
                  "product-id",
                  "actor-id",
                  "recipient-id",
                  "notification-id",
                  "action",
                  "text",
                  "projection-version",
                  "target-id",
                  "identity",
                  "kind",
                  "content-hash",
                  "state",
                  "name",
                  "sku",
                  "price",
                  "published",
                  "price-version",
                  "id",
                  "cart-id",
                  "variant-id",
                  "quantity",
                  "quote-id",
                  "cart-version",
                  "owner-id",
                  "address",
                  "subtotal",
                  "tax",
                  "shipping",
                  "total",
                  "tax-policy",
                  "shipping-policy",
                  "expires-at",
                  "unit-price",
                  "order-id",
                  "location-id",
                  "source-cart-version",
                  "source-price-version",
                  "provider",
                  "request-key",
                  "amount",
                  "provider-id",
                  "payment-id",
                  "event-id",
                  "original-sha256",
                  "at",
                  "allocated",
                  "on-hand",
                  "shipment-id",
                  "line-id",
                  "order-version",
                  "seller-id",
                  "fee",
                  "lines",
                  "mapping-id",
                  "revision",
                  "last-revision",
                ],
                procedures: Object.keys(commerceProcedureRules),
              }
            : supported[rule];
        if (!spec || !spec.fields.includes(w.field) || !spec.procedures.includes(p.procedure))
          bad(
            "Derived writers must select a reviewed procedure/field rule; no generic result override.",
          );
      }
      if (w.source.kind === "hook") {
        const hook = m.hooks?.find((h) => p.hook && same(h, p.hook));
        if (!hook?.allowedWrites.some((v) => same(v.entity, e) && v.field === w.field))
          bad("Hook proposals require exact allowed writes.");
        const c = hook && a.contracts?.find((c) => same(c, hook.contracts.output));
        let fields = c?.shape?.payload;
        let value: ContractField | undefined;
        for (const id of w.source.path) {
          value = fields?.find((f) => f.id === id);
          fields = value?.fields;
        }
        if (!value) bad("Hook result path must resolve exactly.");
      }
    }
    if (
      r.delete &&
      (p.procedure !== "cart-mutate" || o.target.operation !== "remove-line" || r.writes.length)
    )
      bad("Only remove-line may delete its exact selected cart line, without scalar updates.");
    if (r.selection === "local-effect") {
      if (
        r.writes.length ||
        r.keys.length ||
        !m.effects?.some(
          (e) =>
            same(e.source, o) &&
            e.execution === "local" &&
            "dataset" in e.target &&
            e.target.dataset === dataset?.id,
        )
      )
        bad(
          "Local-effect participants belong only to exact source-authorized appends, with no separate observation/action writes.",
        );
      continue;
    }
    const writable = r.writes
      .filter((w) => !e.fields.find((f) => f.field === w.field)?.serverOwned)
      .map((w) => w.field);
    out.push(
      ...validateBackendPolicyUse(design, {
        resource: r.entity,
        selection: { kind: "policy", reference: r.policy },
        action: r.action,
        site: r.writes.length || r.delete ? "write" : "read",
        projection: r.writes.length || r.delete ? r.writeProjection : r.readProjection,
        fields: writable,
        path,
      }),
    );
  }
  if (
    contractCanonical(actual.sort()) !==
    contractCanonical(o.writes.map((w) => `${contractKey(w.entity)}/${w.field}`).sort())
  )
    bad("Operation writes must exactly equal protocol writers.");
  if (
    contractCanonical(o.transaction.participants.map(contractKey).sort()) !==
    contractCanonical(p.records.map((r) => contractKey(r.entity)).sort())
  )
    bad("Transaction participants must exactly equal protocol records.");
  for (const r of p.queries)
    if (!m.queries?.some((q) => same(q, r))) bad("Query snapshot must resolve exactly.");
  for (const v of p.versionChecks) {
    if (v.kind === "session-subject") {
      if (p.procedure !== "privacy-plan")
        bad(
          "Session-subject fencing belongs only to the explicit identity-owner privacy boundary.",
        );
      checkValue({ kind: "input", path: v.subject }, { type: "uuid", required: true }, path, o);
      checkValue({ kind: "input", path: v.input }, { type: "integer", required: true }, path, o);
      continue;
    }

    if (v.selector)
      checkValue({ kind: "input", path: v.selector }, { type: "uuid", required: true }, path, o);
    const f = allFields(v.entity).find((f) => f.id === v.field);
    if (!f || !p.records.some((r) => same(r.entity, v.entity)))
      bad("Version checks require an exact selected record field.");
    else
      checkValue(
        { kind: "input", path: v.input },
        { type: "integer", required: true },
        [...path, "versionChecks", v.entity.id, v.input[0]!],
        o,
      );
  }
  const expected = inputFields.filter((f) =>
    /expected.*version|source-version|target-version/.test(f.id),
  );
  for (const f of expected)
    if (!p.versionChecks.some((v) => v.input.length === 1 && v.input[0] === f.id))
      bad("Every expected version must fence its exact record.");
  for (const t of p.transitions) {
    const l = m.lifecycles?.find((l) => same(l, t.lifecycle));
    if (
      !l?.transitions.some((v) => v.id === t.transition) ||
      !p.records.some((r) => l && same(r.entity, l.state.entity))
    )
      bad("Dispatch must retain an existing transition and selected record.");
  }
  for (const g of o.guards) {
    for (const v of g.kind === "compare" ? [g.left, g.right] : [g.value]) sourceType(v, path, o);
  }
  const hook = p.hook && m.hooks?.find((h) => same(h, p.hook!));
  if (p.hook && !hook) bad("Pure strategy hook must resolve exactly.");
  if (hook) {
    if (
      hook.kind !== "pure" ||
      !same(hook.operation, o) ||
      hook.timeoutSeconds > p.limits.deadlineSeconds
    )
      bad("Protocol invokes only its own bounded pure hook.");
    const fields = a.contracts?.find((c) => same(c, hook.contracts.input))?.shape?.payload ?? [];
    if (
      contractCanonical(fields.map((f) => f.id).sort()) !==
      contractCanonical(p.hookInputs.map((v) => v.field).sort())
    )
      bad("Bind every exact trusted hook input once.");
    for (const v of p.hookInputs) {
      if (v.source === "owner-derived" && !v.derivation)
        bad("Owner-derived hook snapshots require a finite named derivation.");
      if (v.source === "input" && !v.input) bad("Hook input needs a typed input path.");
      if (v.input) sourceType({ kind: "input", path: v.input }, path, o);
      if (
        v.source === "record" &&
        (!v.entity || !p.records.some((r) => v.entity && same(r.entity, v.entity)))
      )
        bad("Hook record snapshot must be an authorized participant.");
      if (v.source === "query" && (!v.query || !p.queries.some((q) => v.query && same(q, v.query))))
        bad("Hook query snapshot must be bounded and selected.");
      if (v.entity)
        for (const field of v.fields)
          if (!allFields(v.entity).some((f) => f.id === field))
            bad("Snapshot field must resolve exactly.");
    }
  } else if (p.hookInputs.length) bad("Hook snapshots require an exact hook.");
  const command = o.kind === "command";
  if (command) {
    if (
      !["command-key", "source-message"].includes(o.idempotency.kind) ||
      p.receipt === "none" ||
      p.replay === "read-current-policy" ||
      o.transaction.kind !== "local"
    )
      bad(
        "Commands require an atomic terminal receipt and current-policy replay before version fencing.",
      );
    if (o.idempotency.kind === "command-key") {
      checkValue(
        { kind: "input", path: o.idempotency.key },
        { type: "text", required: true, minLength: 1, maxLength: 200 },
        path,
        o,
      );
      if (
        contractCanonical(o.idempotency.hashInputs.map((v) => v.join("/")).sort()) !==
        contractCanonical(
          inputFields
            .filter(
              (f) =>
                f.id !== (o.idempotency.kind === "command-key" ? o.idempotency.key[0] : undefined),
            )
            .map((f) => f.id)
            .sort(),
        )
      )
        bad("Command hash must cover all normalized non-key inputs.");
    }
  } else if (
    o.writes.length ||
    p.records.some((r) => r.delete) ||
    p.receipt !== "none" ||
    o.idempotency.kind !== "read-only" ||
    o.transaction.kind !== "read-only"
  )
    bad("Pure read strategies cannot mutate, publish work or store command receipts.");
  if (
    o.idempotency.kind === "source-message" &&
    (!["inbound-reply", "payment-callback", "warehouse-apply"].includes(p.procedure) ||
      p.receipt !== "atomic-source-message-and-command")
  )
    bad(
      "Source-message identity belongs only to the original-byte authenticated inbound protocol.",
    );
  if (
    p.externalIO !== "none" &&
    ![
      "payment-callback",
      "payment-reconcile",
      "payment-dispatch",
      "financial-dispatch",
      "commerce-delivery",
      "warehouse-apply",
      "file-inspect",
      "private-download",
      "inbound-reply",
      "external-delivery",
      "delivery-reconcile",
      "orphan-cleanup",
    ].includes(p.procedure)
  )
    bad("External boundary is permitted only for explicit byte/provider protocols.");
  if (o.transaction.externalIO !== "forbidden")
    bad("Provider bytes/network cannot join SQL atomicity.");
  const requiredOutputs = wire.output.map((f) => f.id);
  if (
    contractCanonical(requiredOutputs.sort()) !==
    contractCanonical(p.outputs.map((v) => v.path.join("/")).sort())
  )
    bad("Bind every logical output field exactly once, including transport headers.");
  for (const v of p.outputs) {
    if (v.source === "private-stream" && p.procedure !== "private-download")
      bad("Private byte output belongs only to the authorized proxy protocol.");
    if (v.source === "validated-hook" && !hook)
      bad("Validated hook output requires its exact hook.");
  }
  for (const v of p.outputs) {
    if (v.renames) {
      const output = wire.output.find((f) => f.id === v.path[0]);
      const fields = output?.type === "array" ? output.items?.fields : output?.fields;
      distinct(
        v.renames.map((r) => r.field),
        "Output aliases",
      );
      for (const r of v.renames) {
        if (!v.fields.includes(r.source) || !fields?.some((f) => f.id === r.field))
          bad("Output alias must map a selected source field to an exact wire item field.");
        const q = v.query && m.queries?.find((q) => same(q, v.query!)),
          alias = q?.projection.find((p) => p.id === r.source),
          source = q && alias && backendQuerySources(design, q).get(alias.field.source),
          from = source && allFields(source.entity).find((f) => f.id === alias!.field.field),
          to = fields?.find((f) => f.id === r.field);
        if (from && to && !backendValueFits(from, to))
          bad("Output alias source type must fit its exact wire item field.");
      }
    }
    const assetPage = ["catalog-assets-page", "catalog-search-page"].includes(v.derivation ?? "");
    const hasRecord = (fields: string[]) =>
      p.records.some((r) => fields.every((f) => allFields(r.entity).some((v) => v.id === f)));
    if (
      assetPage &&
      (!hasRecord(["object-key", "product-id", "variant-id"]) ||
        !p.queries.some((r) => {
          const q = m.queries?.find((q) => same(q, r));
          return !!q && allFields(q.root).some((f) => f.id === "object-key");
        }))
    )
      bad(
        "Catalog pages require exact bounded current asset selection, never inferred public object keys.",
      );
    if (
      v.derivation === "shipment-quantity-page" &&
      !hasRecord(["shipment-id", "line-id", "quantity"])
    )
      bad("Shipment pages require bounded exact shipment-line participants.");
    if (
      v.derivation === "order-snapshot-page" &&
      !hasRecord(["order-id", "unit-price", "quantity"])
    )
      bad("Order pages require their immutable purchased-line participants.");
  }
  for (const v of p.outputs) {
    if (v.query) {
      const q = m.queries?.find((q) => same(q, v.query!));
      if (!q || !p.queries.some((r) => same(r, v.query!)))
        bad("Output query must be an exact selected bounded strategy.");
      else
        for (const id of v.fields)
          if (!q.projection.some((f) => f.id === id))
            bad("Output field must select the declared query projection alias.");
    }
    if (v.source === "validated-hook" && hook) {
      const result = a.contracts?.find((c) => same(c, hook.contracts.output));
      for (const id of v.fields)
        if (!result?.shape?.payload.some((f) => f.id === id))
          bad("Output hook result field must resolve exactly.");
    }
    if (v.selector)
      checkValue({ kind: "input", path: v.selector }, { type: "uuid", required: true }, path, o);
  }
  for (const v of p.outputs)
    if (v.entity)
      for (const field of v.fields)
        if (!allFields(v.entity).some((f) => f.id === field))
          bad("Output field must resolve in its exact entity.");
  for (const result of o.outcomes) {
    const w = wire.outcomes?.find((v) => v.id === result.outcome);
    if (w?.internal && !p.progress)
      bad("Internal progress checkpoints require the declared bounded privacy progress strategy.");
    if (!w) bad("Outcome must resolve exactly.");
    else if (
      result.trigger === "success"
        ? w.kind !== "Success" || w.state !== (command ? "Committed" : "Unchanged")
        : result.trigger === "uncertain"
          ? w.state !== "Unknown"
          : w.state !== "Unchanged"
    )
      bad("Wire outcomes must preserve committed, unchanged and unknown state independently.");
  }
  if (!o.outcomes.some((v) => v.trigger === "success"))
    bad("Protocol needs its exact success outcome.");
  if (hook && !o.outcomes.some((v) => v.trigger === "unavailable"))
    bad("Pure hook absence must fail closed.");
  return out;
}
