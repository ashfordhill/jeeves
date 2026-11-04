/** P72b composes the complete editable design, preserving every P72a exact definition. */
import type { ArchitectureContract, OperationOutcome } from "./architecture-contracts.ts";
import { contractKey } from "./architecture-contracts.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import {
  commerceProcedureRules,
  commerceProtocolDefaults,
} from "./backend-commerce-protocol-model.ts";
import type { BackendHook } from "./backend-effects-model.ts";
import type { BackendProtocolPlan } from "./backend-protocol-model.ts";
import type { DesignDocument } from "./design.ts";
import { vcEntity as entity, vcRef as ref } from "./vendure-core-data.ts";
import { vendureCoreExample as partial } from "./vendure-core-example.ts";
import { vendureCoreHookSettings } from "./vendure-core-hook-settings.ts";
import { vendureCoreHookContracts } from "./vendure-core-hooks-contracts.ts";
import { vendureCoreJourneys } from "./vendure-core-journeys.ts";
import { vendureCoreMechanisms } from "./vendure-core-mechanisms.ts";
import { type VendureRecipe, vendureCoreRecipes } from "./vendure-core-recipes.ts";
import { vendureCoreRecoveryData } from "./vendure-core-recovery-data.ts";
import { vendureCoreTrace } from "./vendure-core-trace.ts";

export const VENDURE_CORE_COMPLETE_EXAMPLE = {
  id: "vendure-core",
  name: "Vendure core · complete backend design",
  description:
    "Exact REST/data/access, local atomic commands, payment/stock recovery, eight typed H seams and five expected journeys. No runtime or observed acceptance.",
  useCases: "Complete design · V01–V20 · zero observed points",
  accent: "orange",
} as const;
export const vendureObservationIds = (operation: string) =>
  vendureCoreTrace.flatMap((row) =>
    row.observations
      .filter((ob) =>
        ob.operations.some(
          (id) => id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`) === operation,
        ),
      )
      .map((ob) => ob.id),
  );
function outcomes(
  wire: NonNullable<ArchitectureContract["shape"]>["operations"][number],
  pure: boolean,
) {
  const success = wire.transport!.responses.find((r) => r.status < 400)!;
  wire.outcomes = wire.outcomes!.map((o) => ({
    ...o,
    state: "Unchanged",
    retry: o.status === 503 ? "Safe" : "Unsafe",
  }));
  wire.outcomes.push({
    id: "success",
    name: "Accepted exact result",
    kind: "Success",
    status: success.status,
    condition: "All current policies, finite protocol checks and exact result schemas pass.",
    state: pure ? "Unchanged" : "Committed",
    retry: "Unsafe",
    payload: structuredClone(wire.output),
  });
  success.outcome = "success";
  const error = wire.outcomes.find((o) => o.status === 503)?.payload;
  const add = (id: string, state: OperationOutcome["state"], status = 503) =>
    wire.outcomes!.push({
      id,
      name: id,
      kind: "Failure",
      status,
      condition:
        id === "uncertain"
          ? "Commit/provider acknowledgement is unknown; inspect durable original identity before retry."
          : "Required hook failure, timeout, cancellation or invalid output; no domain writes.",
      state,
      retry: state === "Unknown" ? "Reconcile first" : "Unsafe",
      ...(error ? { payload: structuredClone(error) } : {}),
    });
  if (!pure)
    wire.outcomes.push({
      id: "uncertain",
      name: "Lost commit acknowledgement",
      kind: "Failure",
      condition: "Reconcile the original durable identity; no observed HTTP response.",
      state: "Unknown",
      retry: "Reconcile first",
      noResponse: true,
    });
  if (error) {
    add("hook-failed", "Unchanged");
    add("hook-cancelled", "Unchanged");
    wire.transport!.responses.find((r) => r.status === 503)!.outcomeAliases = [
      "hook-failed",
      "hook-cancelled",
    ];
  }
}
export function vendureCoreExampleComplete() {
  const result = structuredClone(partial()),
    d = result.design,
    a = d.architecture!,
    m = a.backend!;
  result.name = VENDURE_CORE_COMPLETE_EXAMPLE.name;
  a.system!.name = result.name;
  a.system!.description = VENDURE_CORE_COMPLETE_EXAMPLE.description;
  for (const el of d.elements)
    el.notes =
      "Complete P72 design intent only; no runtime/generation/benchmark execution. docs/examples/vendure-core.md";
  a.contracts!.push(...structuredClone(vendureCoreHookContracts));
  for (const old of a.contracts!.filter((c) => c.kind === "api" && c.version === "v1")) {
    const c = structuredClone(old);
    c.version = "v2";
    c.coverage = "Complete";
    c.description =
      "P72 complete behavioral successor; frozen v1 wire projection preserved. Runtime unavailable.";
    for (const w of c.shape!.operations) {
      const recipe = vendureCoreRecipes[w.id],
        pure =
          w.transport!.method === "GET" ||
          ["promotions", "tax-quote", "shipping-rates", "convert-currency"].includes(w.id);
      outcomes(w, pure);
      w.behavior = {
        kind: pure ? "Query" : "Command",
        authorization: w.description,
        preconditions:
          recipe?.pre.join(" ").slice(0, 1200) ??
          "Existing session owner alone: durable opaque hashed session, Origin/CSRF, application-specific cookie and restart/logout revocation.",
        stateChanges:
          recipe?.post.join(" ").slice(0, 1200) ??
          "Public registration grants no shop membership/admin role; no competing user/session tables.",
        transaction: recipe
          ? "Exact protocol local SQL participant set; external I/O outside SQL."
          : "Existing session owner only",
        idempotency: pure ? "Read only" : recipe ? "Deduplication key" : "Not guaranteed",
        implementation: recipe?.hook ? "Application hook" : "Composition",
        acceptance: vendureObservationIds(w.id).join(", ").slice(0, 1200),
        ...(!recipe
          ? {
              session: {
                operation: (
                  {
                    register: "registerAccount",
                    login: "login",
                    logout: "logout",
                    "get-session": "readSession",
                  } as const
                )[w.id as "register" | "login" | "logout" | "get-session"],
                authority: "existing-session-owner",
                publicGrants: "none",
                mutationProtection: "origin-csrf",
                durability: "opaque-stored-hash",
                applicationIsolation: "cookie-origin-and-project",
              },
            }
          : {}),
      };
    }
    a.contracts!.push(c);
    for (const i of [...a.interfaces!].filter((i) => contractKey(i.contract) === contractKey(old)))
      a.interfaces!.push({ ...structuredClone(i), id: i.id + "-v2", contract: ref(c.id, "v2") });
    for (const b of [...a.bindings!].filter((b) => contractKey(b.contract) === contractKey(old)))
      a.bindings!.push({
        ...structuredClone(b),
        id: b.id + "-v2",
        provided: b.provided + "-v2",
        required: b.required + "-v2",
        contract: ref(c.id, "v2"),
      });
  }
  vendureCoreRecoveryData(a);
  // New aggregate versions add explicit version fencing without rewriting protected P72a definitions.
  for (const old of [...m.aggregates]) {
    const g = structuredClone(old);
    g.version = "v2";
    g.invariants.push({
      id: "version-fence",
      strategy: "nonnegative",
      value: { entity: g.root, field: "version" },
    });
    g.concurrency = {
      kind: "row-lock",
      entities: [g.root, ...g.children].sort((x, y) =>
        contractKey(x).localeCompare(contractKey(y)),
      ),
      order: "entity-id-primary-key",
    };
    m.aggregates.push(g);
  }
  m.operations = [];
  m.lifecycles = [];
  m.hooks = [];
  m.effects = [];
  addLifecycles(d);
  // Dedicated composition policies never bind public data/bytes/list endpoints. They allow only
  // declared owner-module writes after the exact root command authorizes its current actor.
  const written = new Set(
    Object.values(vendureCoreRecipes).flatMap((r) => Object.keys(r.writes ?? {})),
  );
  for (const name of written) {
    const base = m.accessPolicies!.find(
      (p) => p.id === `vc-${name}${["product", "variant"].includes(name) ? "-admin" : ""}-policy`,
    )!;
    const p = structuredClone(base);
    p.id = `vc-${name}-command-policy`;
    p.name = `${name} source-authorized local composition`;
    const fields = m.entities
      .find((e) => e.id === entity(name).id)!
      .fields.filter((f) => !f.serverOwned)
      .map((f) => f.field);
    const when = structuredClone(
      p.projections.find((p) => p.mode === "write")?.when ?? p.rules[0]!.when,
    );
    p.rules.push({
      id: "source-authorized-composition",
      effect: "allow",
      actions: ["read", "write", "idempotent-replay"],
      when,
    });
    p.projections = p.projections.filter((p) => p.id !== "write");
    p.projections.push({ id: "write", mode: "write", fields, when, unknownFields: "reject" });
    // Scope/module reads are internal snapshots, not public responses.
    p.projections.find((p) => p.id === "read")!.fields = m.entities
      .find((e) => e.id === entity(name).id)!
      .fields.map((f) => f.field);
    m.accessPolicies!.push(p);
  }
  {
    const p = structuredClone(m.accessPolicies!.find((p) => p.id === "vc-order-command-policy")!);
    p.id = "vc-order-fulfillment-policy";
    p.rules = [
      {
        id: "staff",
        effect: "allow",
        actions: ["read", "write", "idempotent-replay"],
        when: { operator: "all", clauses: ["member", "staff"] },
      },
    ];
    p.projections = p.projections.map((p) => ({
      ...p,
      when: { operator: "all", clauses: ["member", "staff"] },
    }));
    m.accessPolicies!.push(p);
  }
  for (const id of ["reference-callback", "stripe-callback", "sync-inventory", "payment-admin"]) {
    const p = structuredClone(m.accessPolicies!.find((p) => p.id === `vc-${id}-policy`)!);
    p.version = "v2";
    const fields = m.entities.find((e) => e.id === p.resource.id)!.fields;
    const when = {
      operator: "all" as const,
      clauses: id === "payment-admin" ? ["member", "admin"] : ["provider"],
    };
    p.projections = [
      {
        id: "read",
        mode: "read",
        unknownFields: "reject",
        fields: fields.map((f) => f.field),
        when,
      },
      {
        id: "write",
        mode: "write",
        unknownFields: "reject",
        fields: fields.filter((f) => !f.serverOwned).map((f) => f.field),
        when,
      },
    ];
    p.rules[0]!.actions = [...new Set([...p.rules[0]!.actions, "read", "idempotent-replay"])];
    m.accessPolicies!.push(p);
  }
  for (const c of a.contracts!.filter((c) => c.kind === "api" && c.version === "v2"))
    for (const w of c.shape!.operations) {
      const recipe = vendureCoreRecipes[w.id];
      if (recipe) buildOperation(d, c, w, recipe);
    }
  addHooks(d);
  vendureCoreMechanisms(d, buildOperation);
  vendureCoreJourneys(result);
  return result;
}
function addLifecycles(d: DesignDocument) {
  const a = d.architecture!,
    m = a.backend!;
  const tables: Record<string, [string, string, string][]> = {
    cart: [["convert", "active", "converted"]],
    order: [
      ["review", "awaiting-payment", "payment-review"],
      ["settle-awaiting", "awaiting-payment", "paid"],
      ["settle-review", "payment-review", "paid"],
      ["cancel", "awaiting-payment", "cancelled"],
      ["partial", "paid", "partially-fulfilled"],
      ["ship-full", "paid", "fulfilled"],
      ["finish", "partially-fulfilled", "fulfilled"],
    ],
    reservation: [
      ["hold", "active", "held-for-payment"],
      ["consume", "held-for-payment", "consumed"],
      ["release", "active", "released"],
      ["expire", "active", "expired"],
      ["confirmed-failure-release", "held-for-payment", "released"],
    ],
    payment: [
      ["submit", "created", "submitted"],
      ["unknown", "submitted", "unknown"],
      ["settle-submitted", "submitted", "settled"],
      ["settle-unknown", "unknown", "settled"],
      ["fail-created", "created", "failed"],
      ["fail-submitted", "submitted", "failed"],
      ["confirmed-failure", "unknown", "failed"],
    ],
    shipment: [
      ["ship", "pending", "shipped"],
      ["cancel", "pending", "cancelled"],
    ],
    delivery: [
      ["sent", "pending", "sent"],
      ["unknown", "pending", "unknown"],
      ["suppress", "pending", "suppressed"],
      ["settle-unknown", "unknown", "sent"],
      ["suppress-unknown", "unknown", "suppressed"],
    ],
    notification: [
      ["materialize", "pending", "materialized"],
      ["suppress", "pending", "suppressed"],
    ],
    refund: [
      ["submit", "planned", "submitted"],
      ["unknown", "submitted", "unknown"],
      ["settle", "submitted", "settled"],
      ["settle-unknown", "unknown", "settled"],
      ["review", "unknown", "reconcile"],
    ],
    settlement: [
      ["submit", "planned", "submitted"],
      ["unknown", "submitted", "unknown"],
      ["settle", "submitted", "settled"],
      ["settle-unknown", "unknown", "settled"],
      ["review", "unknown", "reconcile"],
    ],
  };
  for (const [name, ts] of Object.entries(tables)) {
    const e = m.entities.find((e) => e.id === entity(name).id)!,
      c = a.contracts!.find((c) => contractKey(c) === contractKey(e.contract))!,
      g = m.aggregates.find((g) => g.version === "v2" && g.root.id === e.id)!;
    m.lifecycles!.push({
      id: `vc-${name}-lifecycle`,
      version: "v1",
      name: `${name} finite state table`,
      aggregate: ref(g.id, "v2"),
      state: { entity: entity(name), field: "state" },
      states: c.shape!.payload.find((f) => f.id === "state")!.enumValues!,
      initial: (
        {
          cart: "active",
          order: "awaiting-payment",
          reservation: "active",
          payment: "created",
          shipment: "pending",
          notification: "pending",
          delivery: "pending",
          refund: "planned",
          settlement: "planned",
        } as Record<string, string>
      )[name]!,
      guards: [],
      transitions: ts.map(([id, from, to]) => ({ id, from, to, guards: [] })),
    });
  }
}
function buildOperation(
  d: DesignDocument,
  c: ArchitectureContract,
  w: NonNullable<ArchitectureContract["shape"]>["operations"][number],
  r: VendureRecipe,
) {
  const a = d.architecture!,
    m = a.backend!,
    pure = w.behavior!.kind === "Query",
    source = ["reference-callback", "stripe-callback", "sync-inventory"].includes(w.id),
    g = m.aggregates.find(
      (g) => g.version === "v2" && [g.root, ...g.children].some((e) => e.id === entity(r.root).id),
    )!;
  const owner = a.interfaces!.find(
    (i) => i.direction === "provided" && contractKey(i.contract) === contractKey(c),
  )!.owner;
  if (owner.kind === "external-system") throw Error("External command owner");
  const names = [
    ...new Set([r.root, g.root.id.slice(3, -7), ...r.records, ...Object.keys(r.writes ?? {})]),
  ];
  const records: BackendProtocolPlan["records"] = names.map((name) => {
    const e = m.entities.find((e) => e.id === entity(name).id)!,
      created = r.creates?.includes(name),
      writes = (r.writes?.[name] ?? []).map((field) => {
        const server = e.fields.find((f) => f.field === field)?.serverOwned;
        const source: BackendProtocolPlan["records"][number]["writes"][number]["source"] =
          server === "id"
            ? { kind: "server", factory: "uuid" }
            : server === "scope"
              ? { kind: "context", value: "scope" }
              : server === "clock"
                ? { kind: "server", factory: "clock" }
                : server === "version"
                  ? { kind: "server", factory: created ? "initial-version" : "next-version" }
                  : field === "state" && m.lifecycles!.some((l) => l.state.entity.id === e.id)
                    ? created && !["shipment", "refund"].includes(name)
                      ? {
                          kind: "literal",
                          value: m.lifecycles!.find((l) => l.state.entity.id === e.id)!.initial,
                        }
                      : { kind: "derived", rule: "selected-lifecycle-transition" }
                    : field === "owner-id"
                      ? { kind: "context", value: "principal" }
                      : { kind: "derived", rule: "commerce-validated-plan" };
        return { field, source };
      });
    const isRoot = name === r.root,
      bind = m.accessBindings!.find(
        (b) => b.target.kind === "operation" && b.target.operation === w.id,
      ),
      rootPolicy = bind?.policy.kind === "policy" ? bind.policy.reference : undefined;
    const policy =
      isRoot &&
      rootPolicy &&
      m.accessPolicies!.find((p) => contractKey(p) === contractKey(rootPolicy))?.resource.id ===
        e.id
        ? rootPolicy
        : ref(`vc-${name}${writes.length ? "-command" : ""}-policy`);
    // Exact root policy remains user/service-specific. Writable root policies are explicit successors below.
    const chosen =
      isRoot && w.id === "reconcile-payment"
        ? ref("vc-payment-admin-policy", "v2")
        : isRoot && w.id === "create-shipment"
          ? ref("vc-order-fulfillment-policy")
          : r.procedure === "catalog-write" && name === "product"
            ? ref("vc-product-admin-policy")
            : writes.length || (w.id === "remove-line" && name === "cart-line")
              ? source && isRoot
                ? ref(`vc-${w.id}-policy`, "v2")
                : ref(`vc-${name}-command-policy`)
              : policy;
    const selector = w.input.find((f) => f.id === `${name}-id`),
      inputKey = selector && e.primaryKey.length === 1 && e.primaryKey[0] === "id";
    return {
      entity: entity(name),
      policy: chosen,
      action: writes.length || (w.id === "remove-line" && name === "cart-line") ? "write" : "read",
      readProjection: "read",
      ...(writes.length || (w.id === "remove-line" && name === "cart-line")
        ? { writeProjection: "write" }
        : {}),
      ...(w.id === "remove-line" && name === "cart-line" ? { delete: true } : {}),
      selection: created ? "server-created" : inputKey ? "input-key" : "bounded-plan",
      keys: inputKey ? [{ field: "id", input: [selector.id] }] : [],
      writes,
    };
  });
  const transitions: BackendProtocolPlan["transitions"] = [];
  const allowed: Record<string, string[]> = {
    "checkout-reserve": ["convert"],
    "reservation-release": ["release"],
    "order-cancel": ["cancel", "release"],
    "payment-start": ["hold"],
    "payment-callback": [
      "settle-submitted",
      "settle-unknown",
      "settle-awaiting",
      "settle-review",
      "consume",
      "fail-submitted",
      "confirmed-failure",
      "confirmed-failure-release",
    ],
    "payment-reconcile": [
      "settle-submitted",
      "settle-unknown",
      "settle-awaiting",
      "settle-review",
      "consume",
      "fail-submitted",
      "confirmed-failure",
      "confirmed-failure-release",
    ],
    "shipment-create": ["partial", "ship-full", "finish", "ship"],
    "return-plan": ["submit"],
    "reservation-expire": ["expire"],
    "payment-submit": ["submit"],
    "financial-submit": ["submit"],
    "payment-dispatch": [
      "unknown",
      "review",
      "settle-submitted",
      "settle-unknown",
      "settle-awaiting",
      "settle-review",
      "consume",
      "fail-created",
      "fail-submitted",
    ],
    "financial-dispatch": ["submit", "unknown", "settle", "settle-unknown", "review"],
    "commerce-notify": ["materialize", "suppress"],
    "commerce-delivery": ["sent", "unknown", "suppress", "settle-unknown", "suppress-unknown"],
  };
  for (const record of records.filter((r) =>
    r.writes.some((w) => w.field === "state" && w.source.kind === "derived"),
  ))
    for (const l of m.lifecycles!.filter((l) => l.state.entity.id === record.entity.id))
      for (const t of l.transitions)
        if (allowed[r.procedure]?.includes(t.id))
          transitions.push({ lifecycle: ref(l.id), transition: t.id, action: t.id });
  const commerce =
    r.procedure in commerceProcedureRules
      ? {
          ...structuredClone(commerceProtocolDefaults),
          rules: [...commerceProcedureRules[r.procedure as keyof typeof commerceProcedureRules]],
        }
      : undefined;
  const expected = w.input.find((f) => f.id === "expected-version"),
    versionEntity =
      ({ checkout: "cart", "seller-settlement": "seller" } as Record<string, string>)[w.id] ??
      r.root;
  const query = r.query ? ref(`vc-${r.query}-query`) : undefined;
  const protocol: BackendProtocolPlan = {
    schemaVersion: 1,
    procedure: r.procedure,
    locking: "all-selected-existing-rows-stable-order-then-recheck",
    ...(commerce ? { commerce } : {}),
    records,
    inputs: w.input.map((f) => ({
      path: [f.id],
      use:
        f.id === "scope-id"
          ? "scope"
          : f.id === "header-idempotency-key"
            ? pure
              ? "accepted-value"
              : "command-key"
            : f.id === "expected-version"
              ? "expected-version"
              : f.id.endsWith("-id")
                ? "selector"
                : ["cursor", "limit", "q"].includes(f.id)
                  ? "bounded-query"
                  : "accepted-value",
    })),
    queries: query
      ? [
          query,
          ...(["list-catalog", "search"].includes(w.id) ? [ref("vc-public-assets-query")] : []),
        ]
      : [],
    hookInputs: [],
    transitions,
    versionChecks: expected
      ? [{ entity: entity(versionEntity), field: "version", input: [expected.id] }]
      : [],
    outputs: w.output.map((f): BackendProtocolPlan["outputs"][number] => {
      if (f.id !== "items" || !query)
        return {
          path: [f.id],
          source: "owner-result",
          derivation: f.id === "next-cursor" ? "query-cursor" : "commerce-operation-result",
          ...(f.id === "next-cursor" && query ? { query } : {}),
          fields: [],
        };
      const projection = m.queries!.find((q) => q.id === query.id)!.projection;
      const page = (
        derivation: BackendProtocolPlan["outputs"][number]["derivation"],
        fields: string[],
        renames?: { field: string; source: string }[],
      ): BackendProtocolPlan["outputs"][number] => ({
        path: [f.id],
        source: "owner-result",
        derivation,
        query,
        fields,
        ...(renames ? { renames } : {}),
      });
      if (w.id === "list-catalog")
        return page(
          "catalog-assets-page",
          ["product-id", "id", "name", "price"],
          [{ field: "variant-id", source: "id" }],
        );
      if (w.id === "search")
        return page("catalog-search-page", ["product-id", "variant-id", "name", "price"]);
      const fields = (f.items?.fields ?? [])
        .filter((f) => projection.some((p) => p.id === f.id))
        .map((f) => f.id);
      if (w.id === "list-shipments") return page("shipment-quantity-page", fields);
      if (w.id === "list-orders") return page("order-snapshot-page", fields);
      return { path: [f.id], source: "query-page", query, fields };
    }),
    limits: { batch: 100, deadlineSeconds: 30 },
    replay: pure
      ? "read-current-policy"
      : source
        ? "source-message-current-policy"
        : "current-policy-before-receipt-before-version",
    failure: "no-partial-domain-writes",
    externalIO: r.external ?? "none",
    receipt: pure
      ? "none"
      : source
        ? "atomic-source-message-and-command"
        : "atomic-terminal-command",
    preconditions: [...r.pre],
    postconditions: [...r.post],
    acceptance: vendureObservationIds(w.id),
  };
  if (["list-catalog", "search"].includes(w.id))
    protocol.postconditions.push(
      "Return only productId/variantId/name/price/assetIds. Catalog query id maps to variantId; search uses variant-id. For each current page product/variant, the exact selected public-assets query/asset records supply at most100 currently published matching product-only or matching-variant asset IDs. Never expose object keys, sku, price-version or projection text. Current publication applies before paging and associations.",
    );
  if (w.id === "list-orders")
    protocol.postconditions.push(
      "Serialize exact immutable order snapshots and at most100 owned purchased lines per selected order. Never fetch unbounded children or expose fields outside the frozen order DTO.",
    );
  if (w.id === "list-shipments")
    protocol.postconditions.push(
      "Serialize exact shipment DTO and at most100 same-order owned shipment-line lineId/quantity pairs for each selected shipment. Omit internal at/created-at fields outside the declared wire response.",
    );
  const root = records.find((v) => v.entity.id === g.root.id)!,
    key = w.input.find((f) => ["header-idempotency-key", "command-key"].includes(f.id));
  const o: BackendOperation = {
    id: `vc-${w.id}-operation`,
    version: "v1",
    name: w.name,
    target: { contract: ref(c.id, c.version), operation: w.id, owner },
    kind: pure ? "query" : "command",
    aggregate: ref(g.id, g.version),
    access: {
      policy: { kind: "policy", reference: root.policy },
      action: root.action,
      readProjection: "read",
      ...(root.writes.length ? { writeProjection: "write" } : {}),
      participants: records
        .filter((v) => v !== root)
        .map((v) => ({
          entity: v.entity,
          policy: { kind: "policy", reference: v.policy },
          action: v.action,
          readProjection: v.readProjection,
          ...(v.writeProjection ? { writeProjection: v.writeProjection } : {}),
        })),
    },
    ...(query ? { query } : {}),
    guards: [],
    actions: [],
    writes: records.flatMap((v) => v.writes.map((w) => ({ entity: v.entity, field: w.field }))),
    expectedVersion: expected ? { kind: "input", path: [expected.id] } : { kind: "none" },
    transaction: {
      kind: pure ? "read-only" : "local",
      store: "vc-db",
      participants: records.map((r) => r.entity),
      connection: "single",
      externalIO: "forbidden",
      access: "current-state-in-transaction",
      concurrency: "aggregate-policy",
      failure: "rollback",
      commit: "disconnect-is-unknown",
    },
    idempotency: pure
      ? { kind: "read-only" }
      : source
        ? {
            kind: "source-message",
            message: [w.id === "stripe-callback" ? "id" : "event-id"],
            identity: "source-scope-message",
            hash: "canonical-normalized-source-content-sha256",
            replay: "current-policy-before-result",
          }
        : {
            kind: "command-key",
            key: [key!.id],
            identity: "operation-version-scope-principal-key",
            hash: "canonical-normalized-input-sha256",
            hashInputs: w.input.filter((f) => f.id !== key!.id).map((f) => [f.id]),
            retentionSeconds: 604800,
            publishedWindow: true,
            expired: "new-command",
            receipt: "terminal-result-in-same-transaction",
            concurrent: "one-writer-bounded-wait-or-retry",
            replay: "current-policy-before-result",
            cleanup: "separate-controlled-policy",
          },
    cancellation: {
      kind: "cooperative",
      startsWork: !pure,
      deadlineSeconds: 30,
      beforeCommit: "rollback",
      afterCommit: "committed-or-unknown",
    },
    protocol,
    outcomes: w.outcomes!.map((x) => ({
      outcome: x.id,
      trigger:
        x.id === "success"
          ? "success"
          : x.id === "uncertain"
            ? "uncertain"
            : x.id === "hook-failed"
              ? "failed"
              : x.id === "hook-cancelled"
                ? "cancelled"
                : x.status === 409
                  ? "conflict"
                  : x.status === 503
                    ? "unavailable"
                    : "rejected",
      values: [],
    })),
  };
  if (["checkout", "start-payment", "stripe-payment", "transition-order"].includes(w.id))
    o.guards.push({
      id: "current-state",
      kind: "compare",
      left: {
        kind: "current",
        entity: entity(w.id === "checkout" ? "cart" : "order"),
        field: "state",
      },
      operator: "eq",
      right: {
        kind: "literal",
        value:
          w.id === "checkout" ? "active" : w.id === "create-shipment" ? "paid" : "awaiting-payment",
      },
    });
  m.operations!.push(o);
  return o;
}
function addHooks(d: DesignDocument) {
  const a = d.architecture!,
    m = a.backend!;
  for (const [name, wireId] of [
    ["promotion", "promotions"],
    ["tax", "tax-quote"],
    ["shipping", "shipping-rates"],
    ["returns", "return-refund"],
    ["marketplace", "seller-settlement"],
    ["currency", "convert-currency"],
    ["provider", "stripe-payment"],
    ["inventory-sync", "sync-inventory"],
  ]) {
    const o = m.operations!.find((o) => o.target.operation === wireId)!,
      p = o.protocol!,
      id = `vc-jh-${name}`,
      signature = a.contracts!.find((c) => c.id === `${id}-input`)!;
    const wire = a
      .contracts!.find((c) => contractKey(c) === contractKey(o.target.contract))!
      .shape!.operations.find((w) => w.id === wireId)!;
    a.contracts!.push({
      id: `${id}-error`,
      version: "v1",
      name: `JH-${name} safe error`,
      kind: "data",
      coverage: "Complete",
      description: "Safe bounded error, no private snapshot or provider credential.",
      shape: {
        operations: [],
        payload: structuredClone(wire.outcomes!.find((w) => w.status === 503)!.payload!).filter(
          (f) => !f.id.startsWith("header-"),
        ),
      },
    });
    p.hookSettings = structuredClone(vendureCoreHookSettings[name!]!);
    p.hook = ref(id);
    p.hookInputs = signature.shape!.payload.map((f) => ({
      field: f.id,
      source: ["scope-id", "principal-id"].includes(f.id) ? "trusted-context" : "owner-derived",
      fields: [],
      ...(!["scope-id", "principal-id"].includes(f.id)
        ? { derivation: "commerce-authorized-snapshot" as const }
        : {}),
    }));
    const row = vendureCoreTrace.find((r) => r.source === `JH-${name}`)!,
      ob = row.observations.find((o) => o.category === "failure")!,
      sc = ob.scenarios[0]!;
    const h: BackendHook = {
      id,
      version: "v1",
      name: `JH-${name} · ${row.id}`,
      operation: ref(o.id),
      owner: o.target.owner,
      kind: "pure",
      boundary: "before-commit",
      contracts: {
        input: ref(`${id}-input`),
        output: ref(`${id}-output`),
        error: ref(`${id}-error`),
      },
      context: [
        "principal-provenance",
        "authorized-scope",
        "correlation",
        "cancellation",
        "deadline",
      ],
      authority: "current-policy-at-observation",
      dependencies: [],
      repositories: [],
      services: [],
      allowedWrites: [],
      writeMode: "validated-proposals-only",
      allowedEffects: [],
      result: "validate-exact-contract-before-use",
      privateData: "authorized-input-only",
      required: true,
      readiness: "before-mutation",
      timeoutSeconds: 5,
      cancellation: "cooperative-no-forced-termination",
      unavailable: { outcome: "status-503", status: 503, writes: "none" },
      failure: {
        operation: ref(o.id),
        scope: "source-transaction",
        error: "hook-failed",
        invalidResult: "hook-failed",
        timeout: "hook-failed",
        cancelled: "hook-cancelled",
      },
      acceptance: row.observations.map((o) => o.id),
      seam: { file: `src/hooks/${name}.ts`, ownership: "scaffold-once-project-owned" },
      recovery: [
        {
          trigger: "hook-failure",
          strategy: "confirmed-rollback",
          operation: ref(o.id),
          outcome: "hook-failed",
          scenario: { id: sc.id.toLowerCase(), outcome: ob.id.toLowerCase() },
          invariants: [{ aggregate: o.aggregate, invariant: "version-fence" }],
        },
      ],
    };
    m.hooks!.push(h);
  }
}
