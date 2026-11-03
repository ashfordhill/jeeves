/** Cross-reference checks for commerce declarations; never performs arithmetic or provider I/O. */
import { contractCanonical, contractKey, contractOwnerElement } from "./architecture-contracts.ts";
import type {
  BackendCapabilityConfig,
  BackendProviderReference,
} from "./backend-capability-configs-model.ts";
import { backendEntity, backendEntityFields } from "./backend-entity.ts";
import type { BackendReference } from "./backend-model.ts";
import type { ContractField } from "./contract-shapes.ts";
import type { DesignDocument } from "./design.ts";

type Kind = "money" | "cart" | "inventory" | "order" | "payment" | "fulfillment";
type Commerce = Extract<BackendCapabilityConfig, { kind: Kind }>;
type Field = { entity: BackendReference; field: string };
const same = (a: BackendReference, b: BackendReference) => contractKey(a) === contractKey(b);
export function validateBackendCommerceConfig(
  design: DesignDocument,
  c: Commerce,
  helpers: {
    add: (
      message: string,
      suffix?: (string | number)[],
      code?: "CONFIG_INVALID" | "UNKNOWN_REFERENCE" | "CONFIG_REQUIRED",
    ) => unknown;
    provider: (p: BackendProviderReference, roles: string[]) => void;
  },
): void {
  const a = design.architecture,
    m = a?.backend;
  if (!a || !m) return;
  const { add } = helpers;
  const owner = contractOwnerElement(design, c.owner);
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) add(`${label} must be distinct.`);
  };
  const entity = (r: BackendReference) => {
    const e = backendEntity(design, r),
      ds = a.datasets?.find((d) => d.id === e?.dataset);
    if (ds && !ds.owners.some((o) => contractOwnerElement(design, o) === owner))
      add("Commerce entity must belong to its owning application.");
    return e;
  };
  const field = (r: Field, type?: string): ContractField | undefined => {
    const e = entity(r.entity),
      f = e && backendEntityFields(design, e).find((v) => v.id === r.field);
    if (!f)
      add(
        `Entity field ${contractKey(r.entity)}/${r.field} does not exist.`,
        [],
        "UNKNOWN_REFERENCE",
      );
    else if ((type && f.type !== type) || !f.required || f.nullable)
      add(`Commerce field ${r.field} requires a nonnullable required ${type ?? "value"}.`);
    return f;
  };
  const count = (r: Field, minimum = 0, maximum?: number) => {
    const f = field(r, "integer");
    if (
      f &&
      (f.minimum === undefined ||
        f.maximum === undefined ||
        f.minimum < minimum ||
        (maximum !== undefined && f.maximum < maximum))
    )
      add(`Count ${r.field} needs finite integer bounds containing the configured quantity range.`);
  };
  const config = <K extends BackendCapabilityConfig["kind"]>(
    r: BackendReference,
    kind: K,
  ): Extract<BackendCapabilityConfig, { kind: K }> | undefined => {
    const v = m.capabilityConfigs?.find((v) => same(v, r));
    if (v && (v.kind !== kind || contractOwnerElement(design, v.owner) !== owner))
      add(`Expected a ${kind} configuration in the same owning application.`);
    return v?.kind === kind ? (v as Extract<BackendCapabilityConfig, { kind: K }>) : undefined;
  };
  const aggregate = (r: BackendReference) => {
    const v = m.aggregates.find((v) => same(v, r));
    if (v && contractOwnerElement(design, v.owner) !== owner)
      add("Commerce aggregate must belong to its owning application.");
    return v;
  };
  const contains = (r: BackendReference, target: BackendReference) => {
    const g = aggregate(r);
    return g && [g.root, ...g.children].some((e) => same(e, target));
  };
  const operation = (r: BackendReference) => {
    const o = m.operations?.find((v) => same(v, r));
    if (
      o &&
      (o.kind !== "command" ||
        contractOwnerElement(design, o.target.owner) !== owner ||
        o.idempotency.kind !== "command-key")
    )
      add("Commerce mutation requires an owned command and a durable command receipt.");
    return o;
  };
  const guarded = (g: { operation: BackendReference; guards: string[] }) => {
    const o = operation(g.operation);
    unique(g.guards, "Operation guard references");
    if (o && g.guards.some((id) => !o.guards.some((v) => v.id === id)))
      add("Commerce guards must reference their exact operation.", [], "UNKNOWN_REFERENCE");
    return o;
  };
  const lifecycle = (
    l: { reference: BackendReference; guards: string[] },
    target?: BackendReference,
    states?: string[],
  ) => {
    const v = m.lifecycles?.find((v) => same(v, l.reference));
    unique(l.guards, "Lifecycle guards");
    if (
      v &&
      ((target && !same(v.state.entity, target)) ||
        l.guards.some((id) => !v.guards.some((g) => g.id === id)) ||
        states?.some((s) => !v.states.includes(s)))
    )
      add("Commerce lifecycle must retain its exact entity, states and guard references.");
    if (states) unique(states, "Lifecycle state roles");
    return v;
  };
  const relation = (child: BackendReference, parent: BackendReference, id: string) => {
    const e = entity(child);
    if (
      e &&
      !e.relations.some(
        (r) =>
          r.id === id &&
          same(r.target, parent) &&
          r.ownership === "owned" &&
          r.scope === "same-scope",
      )
    )
      add("Commerce child needs its exact owned same-scope parent relation.");
  };
  const moneyField = (
    r: Field,
    money: Extract<BackendCapabilityConfig, { kind: "money" }> | undefined,
  ) => {
    field(r, "object");
    const storage = entity(r.entity)?.fields.find((v) => v.field === r.field)?.storage;
    if (storage && storage.kind !== "money")
      add("Price/amount fields require exact money storage, never floating point or opaque JSON.");
    if (money && !money.fields.some((v) => same(v.entity, r.entity) && v.field === r.field))
      add("Money configuration must explicitly include the selected amount field.");
  };
  const delivery = (r: BackendReference, target: BackendReference) => {
    const d = config(r, "delivery"),
      e = m.effects?.find((e) => d && same(e, d.effect));
    if (e) {
      const t = e.target,
        consumer = "operation" in t ? t.operation : t.kind === "event" ? t.consumer : undefined;
      if (!consumer || !same(consumer, target))
        add(
          "Scheduled commerce work requires a delivery effect targeting its exact consumer operation.",
        );
    }
    return d;
  };
  const stableIdentity = (r: Field) => {
    const f = field(r),
      e = entity(r.entity);
    if (
      f &&
      (!["uuid", "text"].includes(f.type) ||
        !e ||
        (!e.primaryKey.includes(r.field) &&
          !e.uniqueKeys.some(
            (k) =>
              k.fields.includes(r.field) &&
              k.fields.every(
                (id) => id === r.field || (e.scope.kind === "field" && id === e.scope.field),
              ),
          )))
    )
      add(
        "Durable provider/shipment identity needs a UUID or bounded text primary/unique key within its scope.",
      );
  };
  const requiredHook = (r: BackendReference, pure = false) => {
    const h = m.hooks?.find((h) => same(h, r));
    if (
      h &&
      (!h.required ||
        contractOwnerElement(design, h.owner) !== owner ||
        (pure && (h.kind !== "pure" || h.boundary !== "before-commit")))
    )
      add(
        "Pricing hooks must be required, owned and typed; local pricing requires a pure before-commit hook.",
      );
  };
  switch (c.kind) {
    case "money": {
      unique(c.currencies, "Currencies");
      unique(
        c.fields.map((f) => `${contractKey(f.entity)}/${f.field}`),
        "Money fields",
      );
      if (
        c.minimumMinorUnits > c.maximumMinorUnits ||
        c.maximumMinorUnits > c.maximumTotalMinorUnits
      )
        add("Money minimum, unit maximum and total maximum must be ordered.");
      for (const r of c.fields) {
        moneyField(r, undefined);
        const f = field(r),
          storage = entity(r.entity)?.fields.find((v) => v.field === r.field)?.storage;
        if (storage?.kind !== "money") continue;
        const amount = f?.fields?.find((v) => v.id === storage.minorUnits),
          currency = f?.fields?.find((v) => v.id === storage.currency);
        if (
          amount?.type !== "integer" ||
          amount.minimum === undefined ||
          amount.minimum > c.minimumMinorUnits ||
          amount.maximum === undefined ||
          amount.maximum < c.maximumTotalMinorUnits ||
          !currency?.enumValues ||
          c.currencies.some((v) => !currency.enumValues?.includes(v))
        )
          add("Exact money fields must represent all configured minor-unit bounds and currencies.");
      }
      break;
    }
    case "cart": {
      const g = aggregate(c.aggregate),
        money = config(c.money, "money");
      if (g) {
        if (!g.children.some((v) => same(v, c.line)))
          add("Cart lines must belong to its aggregate.");
        relation(c.line, g.root, c.relation);
        if (g.concurrency.kind !== "optimistic")
          add("Cart mutations require an expected-version aggregate.");
      }
      count(c.quantity, 1, money?.maximumQuantity);
      field(c.variant, "uuid");
      if (!same(c.quantity.entity, c.line) || !same(c.variant.entity, c.line))
        add("Cart quantity and variant belong to its line entity.");
      field(c.quote.expiresAt, "timestamp");
      if (!contains(c.aggregate, c.quote.expiresAt.entity))
        add("Quote expiry belongs to the cart aggregate.");
      if (c.quote.strategy.kind === "fixed-price") moneyField(c.quote.strategy.price, money);
      else requiredHook(c.quote.strategy.hook, true);
      if (c.quote.shipping.kind === "flat") {
        if (money && c.quote.shipping.minorUnits > money.maximumTotalMinorUnits)
          add("Flat shipping must fit the exact total bound.");
      } else requiredHook(c.quote.shipping.hook);
      if (c.quote.tax.kind === "hook") requiredHook(c.quote.tax.hook);
      unique(
        c.quote.pricingHooks.map((h) => h.purpose),
        "Pricing hook purposes",
      );
      for (const h of c.quote.pricingHooks) requiredHook(h.hook, true);
      for (const r of [...c.quote.snapshot, ...c.quote.provenance]) {
        field(r);
        if (!contains(c.aggregate, r.entity))
          add("Quote snapshots and provenance belong to the cart aggregate.");
      }
      for (const r of Object.values(c.mutations)) {
        const o = operation(r);
        if (o && (!same(o.aggregate, c.aggregate) || o.expectedVersion.kind !== "input"))
          add("Cart commands retain their exact aggregate and expected version.");
      }
      break;
    }
    case "inventory": {
      const g = aggregate(c.aggregate);
      if (
        g &&
        (!same(g.root, c.stock) ||
          !g.children.some((v) => same(v, c.reservation)) ||
          g.concurrency.kind !== "row-lock" ||
          ![c.stock, c.reservation].every(
            (r) =>
              g.concurrency.kind === "row-lock" && g.concurrency.entities.some((e) => same(e, r)),
          ))
      )
        add(
          "Inventory requires its authoritative stock root, owned reservation child and stable row locks over both.",
        );
      relation(c.reservation, c.stock, c.relation);
      for (const r of [c.onHand, c.reserved, c.quantity]) count(r);
      field(c.location, "uuid");
      field(c.variant, "uuid");
      if (
        ![c.location, c.variant, c.onHand, c.reserved].every((f) => same(f.entity, c.stock)) ||
        !same(c.quantity.entity, c.reservation)
      )
        add(
          "Stock/location/count fields and reservation quantity must retain their authoritative entities.",
        );
      if (c.onHand.field === c.reserved.field) add("On-hand and reserved counts must be distinct.");
      lifecycle(c.lifecycle, c.reservation, Object.values(c.states));
      field(c.expiry.expiresAt, "timestamp");
      if (!same(c.expiry.expiresAt.entity, c.reservation))
        add("Reservation expiry belongs to the reservation entity.");
      const o = guarded(c.expiry.operation);
      if (
        o &&
        (!same(o.aggregate, c.aggregate) ||
          !o.transaction.participants.some((e) => same(e, c.reservation)))
      )
        add("Expiry must recheck reservation and stock in its inventory transaction.");
      const scheduled = delivery(c.expiry.delivery, c.expiry.operation.operation);
      if (scheduled && scheduled.due.kind !== "event-time")
        add("Reservation expiry delivery requires an explicit persisted event-time due source.");
      const p = config(c.heldPayment.payment, "payment");
      if (p && !same(p.inventory, c))
        add("Held payments must reference this exact inventory configuration.");
      break;
    }
    case "order": {
      const g = aggregate(c.aggregate),
        cart = config(c.cart, "cart"),
        inventory = config(c.inventory, "inventory"),
        money = config(c.money, "money");
      if (cart && !same(cart.money, c.money))
        add("Order and cart require the same exact money rules.");
      const checkout = guarded(c.checkout);
      const cancellation = guarded(c.cancellation);
      if (cancellation && !same(cancellation.aggregate, c.aggregate))
        add("Order cancellation must retain the exact order aggregate.");
      if (checkout) {
        const groups = [
          g,
          cart && aggregate(cart.aggregate),
          inventory && aggregate(inventory.aggregate),
        ].filter((v) => v !== undefined);
        if (
          !same(checkout.aggregate, c.aggregate) ||
          groups.some(
            (group) =>
              group.store !== checkout.transaction.store ||
              [group.root, ...group.children].some(
                (e) => !checkout.transaction.participants.some((p) => same(e, p)),
              ),
          )
        )
          add(
            "Checkout requires all cart, order and stock participants in one local store transaction.",
          );
      }
      lifecycle(c.lifecycle, g?.root, [c.paymentReview]);
      unique(
        c.snapshots.map((s) => `${contractKey(s.target.entity)}/${s.target.field}`),
        "Snapshot targets",
      );
      for (const purpose of [
        "variant",
        "quantity",
        "unit-price",
        "line-total",
        "address",
        "order-total",
        "quote-provenance",
      ])
        if (!c.snapshots.some((s) => s.purpose === purpose))
          add(`Order snapshot is missing ${purpose}.`);
      for (const s of c.snapshots) {
        const source = field(s.source),
          target = field(s.target);
        if (
          !contains(c.aggregate, s.target.entity) ||
          (cart && !contains(cart.aggregate, s.source.entity))
        )
          add("Order snapshots copy cart authority into the order aggregate.");
        const shape = (f: ContractField) => {
          const { id: _id, name: _name, description: _description, ...value } = f;
          return value;
        };
        if (
          source &&
          target &&
          contractCanonical(shape(source)) !== contractCanonical(shape(target))
        )
          add("Snapshot source and target must preserve the same exact value shape and bounds.");
        if (["unit-price", "line-total", "order-total"].includes(s.purpose)) {
          moneyField(s.source, money);
          moneyField(s.target, money);
        }
        if (s.purpose === "quantity") {
          count(s.source, 1, money?.maximumQuantity);
          count(s.target, 1, money?.maximumQuantity);
        }
        if (s.purpose === "variant") {
          field(s.source, "uuid");
          field(s.target, "uuid");
        }
      }
      break;
    }
    case "payment": {
      entity(c.entity);
      const order = config(c.order, "order"),
        inventory = config(c.inventory, "inventory"),
        money = config(c.money, "money");
      if (order && (!same(order.inventory, c.inventory) || !same(order.money, c.money)))
        add("Payment order, stock and money must use the same exact configurations.");
      if (inventory && !same(inventory.heldPayment.payment, c))
        add("Payment uncertainty must retain the same inventory hold policy.");
      moneyField(c.amount, money);
      if (!same(c.amount.entity, c.entity) || !same(c.providerIdentity.entity, c.entity))
        add("Payment amount and stable provider identity belong to its durable attempt entity.");
      stableIdentity(c.providerIdentity);
      const identity = field(c.providerIdentity);
      if (identity && !["uuid", "text"].includes(identity.type))
        add("Provider identity requires a durable UUID or bounded text field.");
      const l = lifecycle(c.lifecycle, c.entity, Object.values(c.states));
      if (l?.transitions.some((t) => t.from === c.states.settled && t.to !== c.states.settled))
        add("Settled payments cannot regress on older callback/failure transitions.");
      helpers.provider(c.provider, ["request"]);
      if (c.provider.deduplication !== "destination-key")
        add("Payments require destination deduplication using the persisted attempt key.");
      const callback = guarded(c.callback.operation);
      if (callback && !contains(callback.aggregate, c.entity))
        add("Payment callback must retain the durable attempt authority.");
      const reconcile = operation(c.reconciliation.operation);
      if (reconcile) {
        if (!contains(reconcile.aggregate, c.entity))
          add("Payment reconciliation must retain the durable attempt authority.");
        const wire = a.contracts
          ?.find((v) => same(v, reconcile.target.contract))
          ?.shape?.operations.find((v) => v.id === reconcile.target.operation);
        if (
          !reconcile.outcomes.some(
            (o) => o.outcome === c.reconciliation.outcome && o.trigger === "uncertain",
          ) ||
          !wire?.outcomes?.some(
            (o) =>
              o.id === c.reconciliation.outcome &&
              o.state === "Unknown" &&
              o.retry === "Reconcile first",
          )
        )
          add("Payment reconciliation requires an explicit Unknown/Reconcile first outcome.");
      }
      const d = delivery(c.reconciliation.delivery, c.reconciliation.operation);
      if (
        d &&
        (d.unknown.kind !== "reconcile" ||
          !same(d.unknown.operation, c.reconciliation.operation) ||
          d.unknown.outcome !== c.reconciliation.outcome)
      )
        add("Payment delivery and reconciliation must retain the same uncertain outcome.");
      const e = m.effects?.find((e) => same(e, c.dispatch));
      if (
        e &&
        (e.execution !== "external" ||
          e.boundary !== "after-commit" ||
          e.delivery.duplicates !== "destination-key" ||
          (e.target.kind !== "hook" && e.relationshipBinding !== c.provider.binding) ||
          !e.recovery.some(
            (r) =>
              r.trigger === "external-timeout" &&
              r.strategy === "reconcile-before-retry" &&
              r.reconcileOperation &&
              same(r.reconcileOperation, c.reconciliation.operation),
          ))
      )
        add(
          "Payment dispatch requires exact after-commit provider binding and timeout recovery through reconciliation.",
        );
      break;
    }
    case "fulfillment": {
      const g = aggregate(c.aggregate),
        order = config(c.order, "order"),
        payment = config(c.payment, "payment"),
        inventory = config(c.inventory, "inventory");
      if (
        (order && !same(order.inventory, c.inventory)) ||
        (payment && (!same(payment.order, c.order) || !same(payment.inventory, c.inventory)))
      )
        add("Fulfillment must retain the order's exact payment and stock configurations.");
      const money = order && config(order.money, "money");
      if (money && c.maximumQuantity > money.maximumQuantity)
        add("Shipment quantity cannot exceed the configured order quantity bound.");
      for (const r of [c.ordered, c.paid, c.reserved, c.fulfilled]) count(r);
      count(c.quantity, 1, c.maximumQuantity);
      stableIdentity(c.identity);
      if (
        ![c.ordered, c.paid, c.fulfilled].every(
          (r) => order && contains(order.aggregate, r.entity),
        ) ||
        (inventory && !same(c.reserved.entity, inventory.reservation)) ||
        !contains(c.aggregate, c.quantity.entity) ||
        !contains(c.aggregate, c.identity.entity)
      )
        add(
          "Shipment count and identity fields must retain their order, reservation and fulfillment authorities.",
        );
      unique(
        [c.ordered, c.paid, c.fulfilled].map((r) => `${contractKey(r.entity)}/${r.field}`),
        "Order quantity roles",
      );
      lifecycle(c.lifecycle, g?.root);
      const shipment = guarded(c.shipment);
      if (shipment && order) {
        const og = aggregate(order.aggregate);
        if (
          og &&
          (og.store !== shipment.transaction.store ||
            !shipment.transaction.participants.some((p) => same(p, og.root)))
        )
          add("Shipment requires the order line authority in its local transaction.");
      }
      break;
    }
  }
}
