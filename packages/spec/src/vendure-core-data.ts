/** Vendure authoritative data. Contracts own types; no SQL/session/runtime is supplied. */
import type { Architecture } from "./architecture.ts";
import type { ContractField, ContractValue } from "./architecture-contracts.ts";
import { type BackendEntity, type BackendModel, backendModelSchema } from "./backend-model.ts";
export const vcRef = (id: string, version = "v1") => ({ id, version });
export const vcEntity = (id: string) => vcRef(`vc-${id}-entity`);
const uuid: ContractValue = { type: "uuid" };
const timestamp: ContractValue = { type: "timestamp" };
const text = (maxLength = 200): ContractValue => ({ type: "text", minLength: 1, maxLength });
const integer = (maximum = 9007199254740991, minimum = 0): ContractValue => ({
  type: "integer",
  minimum,
  maximum,
});
const enumeration = (...enumValues: string[]): ContractValue => ({ type: "text", enumValues });
const boolean: ContractValue = { type: "boolean" };
export const vcField = (name: string, value: ContractValue): ContractField => ({
  id: name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
  name,
  required: true,
  description: "",
  ...value,
});
export const vcMoney = (currencies = ["USD"]): ContractValue => ({
  type: "object",
  fields: [vcField("minor", integer()), vcField("currency", enumeration(...currencies))],
});
const address: ContractValue = {
  type: "object",
  fields: Object.entries({
    name: text(200),
    line1: text(200),
    city: text(200),
    region: text(200),
    postalCode: text(200),
    country: enumeration("US"),
  }).map(([name, value]) => vcField(name, value)),
};
export const vcRelation = (
  id: string,
  target: string,
  source: string,
  owned = false,
): BackendEntity["relations"][number] => ({
  id,
  target: vcEntity(target),
  fields:
    target === "shop"
      ? [{ source: "scope-id", target: "scope-id" }]
      : [
          { source: "scope-id", target: "scope-id" },
          { source, target: "id" },
        ],
  cardinality: "many-to-one",
  ownership: owned ? "owned" : "reference",
  scope: "same-scope",
  onDelete: "restrict",
});
export function vendureCoreData(model: Architecture): BackendModel {
  const backend = backendModelSchema.parse({
    schemaVersion: 1,
    entities: [],
    aggregates: [],
    queries: [],
    accessPolicies: [],
    accessBindings: [],
  });
  const add = (
    id: string,
    name: string,
    component: string,
    values: Record<string, ContractValue>,
    relations: BackendEntity["relations"] = [],
    unique: string[][] = [],
    meaning = "",
  ): BackendEntity => {
    const payload = Object.entries({
      id: uuid,
      scopeId: uuid,
      version: integer(9007199254740991, 1),
      createdAt: timestamp,
      ...values,
    }).map(([name, value]) => vcField(name, value));
    const contract = vcRef(`vc-${id}-data`),
      dataset = `vc-${id}-dataset`;
    model.contracts!.push({
      ...contract,
      name: `${name} records`,
      kind: "data",
      coverage: "Complete",
      description: `Authoritative shop-scoped state owned by the Commerce API. Principal IDs reference the existing session owner; no competing account/session table. ${meaning}`,
      shape: { operations: [], payload },
    });
    model.datasets!.push({
      id: dataset,
      name,
      contract,
      owners: [{ kind: "element", id: "vc-api" }],
      ownershipDecision: `Commerce API is the sole application authority. Worker executes explicitly granted modules against the same PostgreSQL store; bytes/providers are outside SQL. ${meaning}`,
      store: "vc-db",
      readers: [
        { kind: "component", id: `vc-${component}` },
        { kind: "element", id: "vc-worker" },
      ],
      writers: [{ kind: "component", id: `vc-${component}` }],
      tenant: "Tenant scoped",
      deletion: "Retain",
      exportAccess: ["audit", "provider-event", "source-receipt", "inventory-mapping"].includes(id)
        ? "Authorized staff"
        : "Owner",
    });
    const e: BackendEntity = {
      id: `vc-${id}-entity`,
      version: "v1",
      name,
      dataset,
      contract,
      storageId: `vc-${id}-table`,
      fields: payload.map((f) => ({
        field: f.id,
        storageId: `${f.id}-column`,
        required: true,
        nullable: !!f.nullable,
        storage:
          f.type === "object" && f.fields?.length === 2 && f.fields.some((x) => x.id === "minor")
            ? {
                kind: "money",
                minorUnits: "minor",
                currency: "currency",
                currencyStorageId: `${f.id}-currency-column`,
              }
            : f.type === "object" || f.type === "array"
              ? { kind: "json", query: "opaque" }
              : { kind: "scalar" },
        ...(["id", "scope-id", "version", "created-at"].includes(f.id)
          ? {
              serverOwned: (
                {
                  id: "id",
                  "scope-id": "scope",
                  version: "version",
                  "created-at": "clock",
                } as const
              )[f.id as "id" | "scope-id" | "version" | "created-at"],
            }
          : f.id === "owner-id"
            ? { serverOwned: "principal" as const }
            : {}),
      })),
      primaryKey: ["id"],
      scope: { kind: "field", field: "scope-id" },
      relations,
      uniqueKeys: [
        { id: "scoped-id", fields: ["id"], scope: "entity-scope", nulls: "forbidden" },
        ...unique.map((fields, i) => ({
          id: `unique-${i + 1}`,
          fields,
          scope: "entity-scope" as const,
          nulls: "forbidden" as const,
        })),
      ],
      indexes: [
        {
          id: "created-order",
          fields: [
            { field: "created-at", direction: "asc" },
            { field: "id", direction: "asc" },
          ],
        },
      ],
    };
    if (id !== "shop") e.relations.push(vcRelation("shop", "shop", "scope-id"));
    else {
      e.primaryKey = ["scope-id"];
      delete e.fields.find((f) => f.field === "id")!.serverOwned;
    }
    backend.entities.push(e);
    return e;
  };
  add("shop", "Shop", "access", { name: text(), active: boolean });
  add(
    "membership",
    "Shop membership",
    "access",
    {
      principalId: uuid,
      active: boolean,
      role: enumeration("customer", "administrator", "fulfillment", "seller"),
    },
    [],
    [["principal-id"]],
    "Current active membership and persisted role are both required. Public registration grants neither role nor shop access.",
  );
  add(
    "product",
    "Catalog product",
    "catalog",
    { name: text(), published: boolean },
    [],
    [],
    "Publication is current authority before catalog/search/assets; hidden rows never survive via a projection or cursor.",
  );
  add(
    "variant",
    "Catalog variant and current price",
    "catalog",
    {
      productId: uuid,
      sku: text(),
      published: boolean,
      price: vcMoney(),
      cost: vcMoney(),
      priceVersion: integer(9007199254740991, 1),
      stockLocationId: uuid,
    },
    [vcRelation("product", "product", "product-id", true)],
    [["sku"]],
    "Price is USD safe-integer minor units, independently versioned per variant. Cost and stock are private. Catalog changes invalidate unconverted quotes, never rewrite an order. Mixed price versions require a new quote.",
  );
  add(
    "asset",
    "Catalog asset association",
    "catalog",
    {
      productId: uuid,
      variantId: { ...uuid, nullable: true },
      objectKey: text(),
      mime: enumeration("text/plain"),
      size: integer(10485760, 1),
      sha256: { type: "text", textConstraint: "sha256", minLength: 64, maxLength: 64 },
    },
    [
      vcRelation("product", "product", "product-id", true),
      vcRelation("variant", "variant", "variant-id"),
    ],
    [],
    "Public bytes require current product and, when associated, variant publication. Bytes remain outside SQL; object keys are not public authority.",
  );
  add(
    "stock",
    "Stock at one shop location",
    "inventory",
    { variantId: uuid, locationId: uuid, onHand: integer(1000000), allocated: integer(1000000) },
    [vcRelation("variant", "variant", "variant-id")],
    [["variant-id", "location-id"]],
    "One location per shop. onHand includes unshipped units. Availability = onHand minus active reservations minus held reservations minus allocated. Consumed reservations are not subtracted again. Shipment decrements onHand and allocated together; no negative availability.",
  );
  add(
    "cart",
    "Customer cart",
    "carts",
    { ownerId: uuid, state: enumeration("active", "converted") },
    [],
    [],
    "At most 100 distinct variants; quantity 1..1000; owner/scope come from the server. Cart CAS covers all line changes. Quoting does not increment cart version; checkout converts v3 to v4.",
  );
  add(
    "cart-line",
    "Mutable cart line",
    "carts",
    { cartId: uuid, variantId: uuid, quantity: integer(1000, 1) },
    [vcRelation("cart", "cart", "cart-id", true), vcRelation("variant", "variant", "variant-id")],
    [["cart-id", "variant-id"]],
    "No client price field. Unit prices are selected from current server variants at quote time.",
  );
  const totals = { subtotal: vcMoney(), tax: vcMoney(), shipping: vcMoney(), total: vcMoney() };
  add(
    "quote",
    "Immutable quote snapshot",
    "carts",
    {
      cartId: uuid,
      ownerId: uuid,
      cartVersion: integer(9007199254740991, 1),
      priceVersion: integer(9007199254740991, 1),
      address,
      ...totals,
      taxPolicy: text(),
      shippingPolicy: text(),
      expiresAt: timestamp,
    },
    [vcRelation("cart", "cart", "cart-id")],
    [],
    "Append-only five-minute quote snapshot: exact cart/version/quantities/address and per-variant price inputs. Fixed tax 750 basis points on summed merchandise, half-up; shipping 500 USD minor units, nonrefundable, untaxed. Checked exact integer multiplication/addition/rounding before writes; reject overflow. These fixture policies do not implement H tax/shipping. Completed snapshots never recalculate.",
  );
  add(
    "quote-line",
    "Immutable quote line",
    "carts",
    {
      quoteId: uuid,
      variantId: uuid,
      quantity: integer(1000, 1),
      unitPrice: vcMoney(),
      priceVersion: integer(9007199254740991, 1),
    },
    [
      vcRelation("quote", "quote", "quote-id", true),
      vcRelation("variant", "variant", "variant-id"),
    ],
    [["quote-id", "variant-id"]],
    "Source cart line identity is retained inside the owning quote. Snapshot unitPrice and exact variant priceVersion never change. Different quote roots may reuse that source identity.",
  );
  add(
    "order",
    "Order and immutable commercial snapshot",
    "orders",
    {
      ownerId: uuid,
      cartId: uuid,
      quoteId: uuid,
      state: enumeration(
        "awaiting-payment",
        "payment-review",
        "paid",
        "partially-fulfilled",
        "fulfilled",
        "cancelled",
      ),
      address,
      ...totals,
      taxPolicy: text(),
      shippingPolicy: text(),
      sourceCartVersion: integer(9007199254740991, 1),
      sourcePriceVersion: integer(9007199254740991, 1),
    },
    [vcRelation("cart", "cart", "cart-id"), vcRelation("quote", "quote", "quote-id")],
    [["cart-id"]],
    "One order per converted cart. Lines/address/tax/shipping provenance and exact total are immutable from quote. Only lifecycle version/state changes; later prices/rates cannot reinterpret completed money. Same SQL checkout must include cart conversion, order/lines/reservations, audit, command receipt and original event intent; P72b binds those operations.",
  );
  add(
    "order-line",
    "Immutable purchased line",
    "orders",
    {
      orderId: uuid,
      variantId: uuid,
      quantity: integer(1000, 1),
      unitPrice: vcMoney(),
      priceVersion: integer(9007199254740991, 1),
    },
    [
      vcRelation("order", "order", "order-id", true),
      vcRelation("variant", "variant", "variant-id"),
    ],
    [["order-id", "variant-id"]],
    "Source cart/quote line identity persists within order root. Purchased quantities/prices never become a shipment counter. Fulfillment/refund ceilings sum their separate rows.",
  );
  // A source line identity can recur under different immutable snapshot roots.
  for (const [id, parent] of [
    ["quote-line", "quote-id"],
    ["order-line", "order-id"],
  ]) {
    const e = backend.entities.find((e) => e.id === `vc-${id}-entity`)!;
    e.primaryKey = [parent!, "id"];
    e.uniqueKeys = e.uniqueKeys.filter((k) => k.id !== "scoped-id");
    e.uniqueKeys.push({
      id: "root-line",
      fields: [parent!, "id"],
      scope: "entity-scope",
      nulls: "forbidden",
    });
    delete e.fields.find((f) => f.field === "id")!.serverOwned;
  }
  add(
    "reservation",
    "Stock reservation",
    "inventory",
    {
      orderId: uuid,
      variantId: uuid,
      locationId: uuid,
      quantity: integer(1000, 1),
      state: enumeration("active", "held-for-payment", "consumed", "released", "expired"),
      expiresAt: timestamp,
    },
    [vcRelation("order", "order", "order-id"), vcRelation("variant", "variant", "variant-id")],
    [["order-id", "variant-id"]],
    "Active expiry is 15 minutes for selected cases; seeded deadlines remain exact. Held/consumed units cannot expire or release blindly. Current order/reservation lock and deadline recheck precede stock UUID-order locking; unknown payment retains held units.",
  );
  add(
    "payment",
    "Durable payment attempt",
    "payments",
    {
      orderId: uuid,
      provider: enumeration("reference-v1", "stripe"),
      requestKey: text(),
      amount: vcMoney(),
      state: enumeration("created", "submitted", "settled", "failed", "unknown"),
      providerId: { ...text(), nullable: true },
    },
    [vcRelation("order", "order", "order-id")],
    [["provider", "request-key"]],
    "Immutable order/amount/currency/provider/request identity is persisted before external dispatch. Unknown is durable, never an implicit failure or new charge key. Provider I/O is outside SQL. P72b owns monotone state/hold/reconciliation guards.",
  );
  add(
    "provider-event",
    "Authenticated provider event receipt",
    "payments",
    {
      paymentId: uuid,
      provider: enumeration("reference-v1", "stripe"),
      eventId: text(),
      originalSha256: { type: "text", textConstraint: "sha256", minLength: 64, maxLength: 64 },
      at: timestamp,
    },
    [vcRelation("payment", "payment", "payment-id")],
    [["provider", "event-id"]],
    "Authenticated original bytes and persisted provider/payment/shop/order/amount mapping precede receipt and state changes. Receipt/event identity differs from command replay. No callback body establishes authority.",
  );
  add(
    "shipment",
    "Shipment",
    "fulfillment",
    {
      orderId: uuid,
      at: timestamp,
      state: enumeration("pending", "shipped", "cancelled"),
      orderVersion: integer(9007199254740991, 1),
    },
    [vcRelation("order", "order", "order-id")],
    [],
    "Only current fulfillment/admin may ship paid allocated units. All shipment quantities are summed under order CAS; customer cannot ship.",
  );
  const shipmentLine = add(
    "shipment-line",
    "Shipment line quantities",
    "fulfillment",
    { shipmentId: uuid, orderId: uuid, lineId: uuid, quantity: integer(1000, 1) },
    [
      vcRelation("shipment", "shipment", "shipment-id", true),
      vcRelation("order", "order", "order-id"),
    ],
    [["shipment-id", "line-id"]],
  );
  shipmentLine.relations.push({
    id: "order-line",
    target: vcEntity("order-line"),
    fields: [
      { source: "scope-id", target: "scope-id" },
      { source: "order-id", target: "order-id" },
      { source: "line-id", target: "id" },
    ],
    cardinality: "many-to-one",
    ownership: "reference",
    scope: "same-scope",
    onDelete: "restrict",
  });
  for (const id of ["history", "audit"])
    add(
      id,
      id === "history" ? "Order history" : "Protected safe audit",
      "audit",
      { orderId: uuid, actorId: uuid, action: text(200), at: timestamp },
      [vcRelation("order", "order", "order-id")],
      [],
      "Append-only actor/action/target/time metadata; no address, private cost, stock or arbitrary provider data. Audit is administrator-only; history uses current order access.",
    );
  const notification = add(
    "notification",
    "Current recipient notification",
    "notifications",
    {
      orderId: uuid,
      recipientId: uuid,
      eventId: uuid,
      action: text(200),
      state: enumeration("pending", "materialized", "suppressed"),
      at: timestamp,
    },
    [vcRelation("order", "order", "order-id")],
    [["event-id", "recipient-id"]],
    "Recheck persisted recipient's current active membership and order ownership before materialization/read/delivery. Initiating actor is provenance only. Revoked inbox is an empty redacted page, never a stale payload.",
  );
  notification.relations.push({
    id: "recipient-membership",
    target: vcEntity("membership"),
    fields: [
      { source: "scope-id", target: "scope-id" },
      { source: "recipient-id", target: "principal-id" },
    ],
    cardinality: "many-to-one",
    ownership: "reference",
    scope: "same-scope",
    onDelete: "restrict",
  });
  // Compound relation independently preserves the recipient-to-order-owner association.
  backend.entities
    .find((e) => e.id === "vc-order-entity")!
    .uniqueKeys.push({
      id: "owner-order",
      fields: ["id", "owner-id"],
      scope: "entity-scope",
      nulls: "forbidden",
    });
  notification.relations
    .find((r) => r.id === "order")!
    .fields.push({ source: "recipient-id", target: "owner-id" });
  add(
    "search-projection",
    "Public catalog search projection",
    "search",
    {
      variantId: uuid,
      productId: uuid,
      text: text(1000),
      projectionVersion: integer(9007199254740991, 1),
    },
    [
      vcRelation("variant", "variant", "variant-id"),
      vcRelation("product", "product", "product-id"),
    ],
    [["variant-id"]],
    "No private cost/stock/address fields. Query current authoritative product and variant publication before matching/snippets/pagination. Rebuild cannot resurrect hidden rows; no measured freshness claim.",
  );
  add(
    "seller",
    "Seller attribution authority",
    "marketplace",
    { principalId: uuid, active: boolean, feeBps: integer(10000) },
    [],
    [["principal-id"]],
    "Current same-shop seller principal, distinct from customer owner. H settlement remains unimplemented.",
  );
  const sellerLine = add(
    "seller-line",
    "Immutable seller line attribution",
    "marketplace",
    { sellerId: uuid, orderId: uuid, lineId: uuid, merchandise: vcMoney(), feePolicy: text() },
    [vcRelation("seller", "seller", "seller-id"), vcRelation("order", "order", "order-id")],
    [["order-id", "line-id"]],
    "Seller gets only attributed line/entitlement metadata, never whole customer order/address, cost or another seller's lines.",
  );
  sellerLine.relations.push({
    ...structuredClone(shipmentLine.relations.find((r) => r.id === "order-line")!),
  });
  add(
    "settlement",
    "Seller settlement identity",
    "marketplace",
    {
      sellerId: uuid,
      requestKey: text(),
      amount: vcMoney(),
      fee: vcMoney(),
      state: enumeration("planned", "submitted", "settled", "unknown", "reconcile"),
    },
    [vcRelation("seller", "seller", "seller-id")],
    [["seller-id", "request-key"]],
    "Seller net payout is distinct from customer charge: fixture payout 5397 versus charge 6947. Immutable attribution/fee policy and one provider request identity; unknown cannot duplicate payout.",
  );
  add(
    "refund",
    "Return and refund request",
    "returns",
    {
      orderId: uuid,
      requestKey: text(),
      amount: vcMoney(),
      lines: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: {
          type: "object",
          fields: [vcField("lineId", uuid), vcField("quantity", integer(1000, 1))],
        },
      },
      state: enumeration("planned", "submitted", "settled", "unknown", "reconcile"),
    },
    [vcRelation("order", "order", "order-id")],
    [["order-id", "request-key"]],
    "Bounded opaque return line snapshot cannot be filtered as JSON. Cumulative return ceilings and exact refundable merchandise/tax exclude nonrefundable shipping; fixture ceiling 6447. Stable refund request identity survives provider uncertainty; P72b binds H behavior.",
  );
  add(
    "rate",
    "Immutable rational conversion snapshot",
    "currency",
    {
      sourceCurrency: enumeration("USD"),
      targetCurrency: enumeration("EUR"),
      numerator: integer(1000000, 1),
      denominator: integer(1000000, 1),
      rateVersion: integer(9007199254740991, 1),
      asOf: timestamp,
      expiresAt: timestamp,
      rounding: enumeration("half-even"),
    },
    [],
    [],
    "H-only USD→EUR 92/100 immutable provenance; 1999→1839 half-even. Core remains USD; no completed order is reinterpreted or converted twice. Rate/provider availability is not supplied.",
  );
  add(
    "inventory-mapping",
    "Verified warehouse mapping",
    "sync",
    {
      source: enumeration("warehouse-v1"),
      externalSku: text(),
      variantId: uuid,
      lastRevision: integer(),
      authority: enumeration("absolute-on-hand"),
      mappingVersion: integer(9007199254740991, 1),
    },
    [vcRelation("variant", "variant", "variant-id")],
    [["source", "external-sku"]],
    "Authenticated source maps exact shop/SKU with monotone revisions. Absolute onHand cannot overwrite active/held/allocated commitments; conflicting revision creates reconciliation. No delta interpretation.",
  );
  add(
    "source-receipt",
    "Warehouse revision receipt",
    "sync",
    {
      mappingId: uuid,
      eventId: text(),
      revision: integer(9007199254740991, 1),
      state: enumeration("applied", "stale", "reconcile"),
    },
    [vcRelation("mapping", "inventory-mapping", "mapping-id")],
    [["mapping-id", "revision"]],
    "Source revision receipt and stock apply commit together; source receipt differs from command/provider/worker receipt. Duplicate or older revision cannot adjust stock twice.",
  );
  const variant = backend.entities.find((e) => e.id === "vc-variant-entity")!;
  variant.uniqueKeys.push({
    id: "product-variant",
    fields: ["product-id", "id"],
    scope: "entity-scope",
    nulls: "forbidden",
  });
  for (const id of ["asset", "search-projection"]) {
    const e = backend.entities.find((e) => e.id === `vc-${id}-entity`)!;
    e.relations.find((r) => r.id === "variant")!.fields = [
      { source: "scope-id", target: "scope-id" },
      { source: "product-id", target: "product-id" },
      { source: "variant-id", target: "id" },
    ];
  }
  const projection = backend.entities.find((e) => e.id === "vc-search-projection-entity")!;
  projection.primaryKey = ["variant-id"];
  delete projection.fields.find((f) => f.field === "id")!.serverOwned;
  const grouped = new Set<string>();
  for (const [id, name, root, children] of [
    ["catalog", "Catalog publication", "product", ["variant", "asset"]],
    ["cart", "Versioned cart", "cart", ["cart-line"]],
    ["quote", "Append-only exact quote", "quote", ["quote-line"]],
    ["order", "Order and immutable purchased lines", "order", ["order-line"]],
    ["shipment", "Shipment and quantities", "shipment", ["shipment-line"]],
  ] as const) {
    const entities = [root, ...children].map(vcEntity);
    for (const e of entities) grouped.add(e.id);
    backend.aggregates.push({
      id: `vc-${id}-aggregate`,
      version: "v1",
      name,
      root: vcEntity(root),
      children: children.map(vcEntity),
      owner: { kind: "element", id: "vc-api" },
      store: "vc-db",
      concurrency: {
        kind: "row-lock",
        entities: [...entities].sort((a, b) => a.id.localeCompare(b.id)),
        order: "entity-id-primary-key",
      },
      invariants: children
        .filter((c) => ["cart-line", "quote-line", "order-line"].includes(c))
        .map((child) => ({
          id: `bounded-${child}`,
          strategy: "required-child" as const,
          child: vcEntity(child),
          relation: root,
          minimum: 1,
          maximum: 100,
        })),
    });
  }
  // Empty carts are legal; their first line is not a creation prerequisite.
  backend.aggregates.find((a) => a.id === "vc-cart-aggregate")!.invariants = [];
  for (const e of backend.entities.filter((e) => !grouped.has(e.id)))
    backend.aggregates.push({
      id: `${e.id}-aggregate`,
      version: "v1",
      name: e.name,
      root: vcRef(e.id),
      children: [],
      owner: { kind: "element", id: "vc-api" },
      store: "vc-db",
      concurrency: { kind: "optimistic", version: { entity: vcRef(e.id), field: "version" } },
      invariants: e.fields
        .filter((f) => ["on-hand", "allocated", "quantity"].includes(f.field))
        .map((f) => ({
          id: `nonnegative-${f.field}`,
          strategy: "nonnegative",
          value: { entity: vcRef(e.id), field: f.field },
        })),
    });
  return backend;
}
