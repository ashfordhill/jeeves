/** Independent Vendure acceptance contracts. No application, provider or money evaluator. */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { BenchmarkFixtureContract, BenchmarkProtocolOperation } from "./benchmark-fixtures.ts";
import {
  benchmarkCredentialsSchema,
  benchmarkErrorSchema,
  benchmarkPageQuerySchema,
  benchmarkPageSchema,
  benchmarkProtocolComponents,
  benchmarkSessionIdentitySchema,
  benchmarkSessionSecurityScheme,
  benchmarkExpectedVersionSchema as version,
} from "./benchmark-protocol.ts";

const id = z.uuid();
const name = z.string().min(1).max(200);
const time = z.iso.datetime();
const count = z.int().min(0).max(1000000);
const minor = z.int().min(0).max(9007199254740991);
const quantity = z.int().min(1).max(1000);
const refs = z.array(id).max(100);
const empty = z.strictObject({});
const scoped = z.strictObject({ scopeId: id });
const expected = { expectedVersion: version };
export const vendureMoneySchema = z.strictObject({ minor, currency: z.literal("USD") });
const money = vendureMoneySchema;
const address = z.strictObject({
  name,
  line1: name,
  city: name,
  region: name,
  postalCode: name,
  country: z.literal("US"),
});
const line = z.strictObject({ id, variantId: id, quantity, unitPrice: money });
const quote = z.strictObject({
  id,
  cartId: id,
  cartVersion: version,
  priceVersion: version,
  lines: z.array(line).min(1).max(100),
  subtotal: money,
  tax: money,
  shipping: money,
  total: money,
  taxPolicy: z.literal("fixture-tax-750bps-v1"),
  shippingPolicy: z.literal("fixture-flat-500-v1"),
  expiresAt: time,
});
const cart = z.strictObject({
  id,
  ownerId: id,
  state: z.enum(["active", "converted", "abandoned"]),
  version,
  lines: z.array(line).max(100),
});
const product = z.strictObject({
  id,
  name,
  published: z.boolean(),
  version,
  variantIds: refs,
  assetIds: refs,
});
const variant = z.strictObject({
  id,
  productId: id,
  sku: name,
  published: z.boolean(),
  price: money,
  version,
});
const catalogItem = z.strictObject({
  productId: id,
  variantId: id,
  name,
  price: money,
  assetIds: refs,
});
const orderState = z.enum([
  "awaiting-payment",
  "paid",
  "partially-fulfilled",
  "fulfilled",
  "cancelled",
  "payment-review",
]);
const order = z.strictObject({
  id,
  ownerId: id,
  state: orderState,
  version,
  lines: z.array(line).min(1).max(100),
  address,
  quoteId: id,
  subtotal: money,
  tax: money,
  shipping: money,
  total: money,
});
const reservation = z.strictObject({
  id,
  orderId: id,
  variantId: id,
  quantity,
  state: z.enum(["active", "held-for-payment", "consumed", "released", "expired"]),
  expiresAt: time,
  version,
});
const payment = z.strictObject({
  id,
  orderId: id,
  provider: z.enum(["reference-v1", "stripe-2025-03-31.basil"]),
  requestKey: name,
  amount: money,
  state: z.enum(["created", "submitted", "settled", "failed", "unknown"]),
  providerId: name.nullable(),
  version,
});
const shipment = z.strictObject({
  id,
  orderId: id,
  lines: z
    .array(z.strictObject({ orderLineId: id, quantity }))
    .min(1)
    .max(100),
  state: z.enum(["pending", "shipped", "cancelled"]),
  orderVersion: version,
  version,
});
const historyItem = z.strictObject({ id, orderId: id, action: name, actorId: id, at: time });
const notification = z.strictObject({ id, orderId: id, recipientId: id, action: name });
const bytes = z.strictObject({
  fixtureFile: name,
  size: z.int().min(1).max(10485760),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.literal("text/plain"),
});
const promotion = z.strictObject({
  allocations: z.array(z.strictObject({ lineId: id, discount: money })).max(100),
  discount: money,
  policyVersion: z.literal("promotion-v1"),
});
const taxQuote = z.strictObject({
  id,
  amount: money,
  provider: z.literal("project-tax-v1"),
  policyVersion: z.literal("tax-policy-v1"),
  jurisdiction: z.literal("US-IL"),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: time,
});
const rate = z.strictObject({
  id,
  carrier: z.literal("project-carrier-v1"),
  service: z.enum(["ground", "express"]),
  amount: money,
  packageVersion: version,
  expiresAt: time,
});
const refund = z.strictObject({
  id,
  orderId: id,
  orderLineId: id,
  quantity,
  amount: money,
  requestKey: name,
  state: z.enum(["submitted", "settled", "unknown"]),
  version,
});
const settlement = z.strictObject({
  id,
  sellerId: id,
  orderId: id,
  gross: money,
  fee: money,
  net: money,
  payoutKey: name,
  state: z.enum(["planned", "settled", "unknown"]),
  version,
});
const conversion = z.strictObject({
  sourceMinor: minor,
  sourceCurrency: z.literal("USD"),
  targetMinor: minor,
  targetCurrency: z.literal("EUR"),
  numerator: z.int().min(1).max(1000000),
  denominator: z.int().min(1).max(1000000),
  rateId: id,
  rateVersion: version,
  asOf: time,
  expiresAt: time,
  rounding: z.literal("half-even"),
});
const syncResult = z.strictObject({
  source: z.literal("warehouse-v1"),
  externalSku: name,
  revision: version,
  variantId: id,
  onHand: count,
  state: z.enum(["applied", "duplicate", "stale", "reconcile"]),
  reconciliationId: id.nullable(),
});
const callbackResult = z.strictObject({
  eventId: name,
  paymentId: id,
  state: payment.shape.state,
  applied: z.boolean(),
});
const rawBody = z.string().min(1).max(65536);
const operations: BenchmarkProtocolOperation[] = [];
function op(
  operationId: string,
  method: BenchmarkProtocolOperation["method"],
  path: string,
  body: z.ZodType,
  response: z.ZodType,
  options: {
    params?: z.ZodType;
    query?: z.ZodType;
    status?: number;
    auth?: BenchmarkProtocolOperation["authentication"];
    errors?: BenchmarkProtocolOperation["errors"];
    headers?: z.ZodType;
  } = {},
) {
  const auth = options.auth ?? "session";
  operations.push({
    id: operationId,
    method,
    path,
    authentication: auth,
    idempotency:
      method === "GET" || auth === "public"
        ? "none"
        : auth === "provider"
          ? "provider"
          : "required",
    input: { params: options.params ?? scoped, query: options.query ?? empty, body },
    responses: { [options.status ?? 200]: response },
    errors:
      options.errors ??
      (method === "GET" ? [400, 401, 403, 404, 503] : [400, 401, 403, 404, 409, 422, 503]),
    ...(options.headers ? { responseHeaders: { [options.status ?? 200]: options.headers } } : {}),
  });
}
const route = "/api/shops/{scopeId}";
const params = (key: string) => z.strictObject({ scopeId: id, [key]: id });
const jsonHeaders = z.object({ "content-type": z.literal("application/json") });
op(
  "register",
  "POST",
  "/api/accounts",
  benchmarkCredentialsSchema,
  benchmarkSessionIdentitySchema,
  {
    params: empty,
    status: 201,
    auth: "public",
    errors: [400, 403, 409, 503],
    headers: jsonHeaders.extend({ "set-cookie": name }),
  },
);
op("login", "POST", "/api/session", benchmarkCredentialsSchema, benchmarkSessionIdentitySchema, {
  params: empty,
  auth: "public",
  errors: [400, 401, 403, 503],
  headers: jsonHeaders.extend({ "set-cookie": name }),
});
op("getSession", "GET", "/api/session", z.null(), benchmarkSessionIdentitySchema, {
  params: empty,
  errors: [401],
});
op("logout", "DELETE", "/api/session", empty, z.null(), {
  params: empty,
  status: 204,
  headers: z.object({ "set-cookie": name }).refine((h) => !("content-type" in h)),
});
op(
  "putProduct",
  "PUT",
  `${route}/admin/products/{productId}`,
  z.strictObject({ name, ...expected }),
  product,
  { params: params("productId") },
);
op(
  "putVariant",
  "PUT",
  `${route}/admin/products/{productId}/variants/{variantId}`,
  z.strictObject({ sku: name, price: money, published: z.boolean(), ...expected }),
  variant,
  { params: z.strictObject({ scopeId: id, productId: id, variantId: id }) },
);
op(
  "publish",
  "POST",
  `${route}/admin/products/{productId}/publication`,
  z.strictObject({ published: z.boolean(), ...expected }),
  product,
  { params: params("productId") },
);
op(
  "setPrice",
  "PUT",
  `${route}/admin/variants/{variantId}/price`,
  z.strictObject({ price: money, ...expected }),
  variant,
  { params: params("variantId") },
);
op("listCatalog", "GET", `${route}/catalog`, z.null(), benchmarkPageSchema(catalogItem), {
  auth: "public",
  query: benchmarkPageQuerySchema,
});
op("getProduct", "GET", `${route}/catalog/products/{productId}`, z.null(), product, {
  auth: "public",
  params: params("productId"),
});
const byteHeaders = z.object({
  "content-type": z.literal("text/plain"),
  "content-disposition": z.literal('attachment; filename="receipt.txt"'),
});
op("getAsset", "GET", `${route}/catalog/assets/{assetId}`, z.null(), bytes, {
  auth: "public",
  params: params("assetId"),
  headers: byteHeaders,
});
op("search", "GET", `${route}/search`, z.null(), benchmarkPageSchema(catalogItem), {
  auth: "public",
  query: benchmarkPageQuerySchema.extend({ q: z.string().min(1).max(100) }),
});
op("createCart", "POST", `${route}/carts`, empty, cart, { status: 201 });
op("getCart", "GET", `${route}/carts/{cartId}`, z.null(), cart, { params: params("cartId") });
op(
  "addLine",
  "POST",
  `${route}/carts/{cartId}/lines`,
  z.strictObject({ variantId: id, quantity, ...expected }),
  cart,
  { params: params("cartId") },
);
op(
  "changeLine",
  "PATCH",
  `${route}/carts/{cartId}/lines/{lineId}`,
  z.strictObject({ quantity, ...expected }),
  cart,
  { params: z.strictObject({ scopeId: id, cartId: id, lineId: id }) },
);
op(
  "removeLine",
  "DELETE",
  `${route}/carts/{cartId}/lines/{lineId}`,
  z.strictObject(expected),
  cart,
  { params: z.strictObject({ scopeId: id, cartId: id, lineId: id }) },
);
op(
  "quote",
  "POST",
  `${route}/carts/{cartId}/quote`,
  z.strictObject({ address, ...expected }),
  quote,
  { params: params("cartId") },
);
op(
  "checkout",
  "POST",
  `${route}/carts/{cartId}/checkout`,
  z.strictObject({
    quoteId: id,
    address,
    quantities: z
      .array(z.strictObject({ variantId: id, quantity }))
      .min(1)
      .max(100),
    ...expected,
  }),
  order,
  { params: params("cartId"), status: 201 },
);
op(
  "releaseReservation",
  "POST",
  `${route}/reservations/{reservationId}/release`,
  z.strictObject(expected),
  reservation,
  { params: params("reservationId") },
);
op(
  "transitionOrder",
  "POST",
  `${route}/orders/{orderId}/transitions`,
  z.strictObject({ to: orderState, ...expected }),
  order,
  { params: params("orderId") },
);
op(
  "startPayment",
  "POST",
  `${route}/orders/{orderId}/payments`,
  z.strictObject(expected),
  payment,
  { params: params("orderId"), status: 202 },
);
op("getPayment", "GET", `${route}/payments/{paymentId}`, z.null(), payment, {
  params: params("paymentId"),
});
op(
  "reconcilePayment",
  "POST",
  `${route}/admin/payments/{paymentId}/reconciliation`,
  z.strictObject(expected),
  payment,
  { params: params("paymentId") },
);
op("referenceCallback", "POST", "/api/providers/reference/events", rawBody, callbackResult, {
  params: empty,
  auth: "provider",
});
op("getOrder", "GET", `${route}/orders/{orderId}`, z.null(), order, { params: params("orderId") });
op("listOrders", "GET", `${route}/orders`, z.null(), benchmarkPageSchema(order), {
  query: benchmarkPageQuerySchema,
});
op(
  "orderHistory",
  "GET",
  `${route}/orders/{orderId}/history`,
  z.null(),
  benchmarkPageSchema(historyItem),
  { params: params("orderId"), query: benchmarkPageQuerySchema },
);
op("downloadOrder", "GET", `${route}/orders/{orderId}/receipt`, z.null(), bytes, {
  params: params("orderId"),
  headers: byteHeaders,
});
op(
  "createShipment",
  "POST",
  `${route}/orders/{orderId}/shipments`,
  z.strictObject({ lines: shipment.shape.lines, ...expected }),
  shipment,
  { params: params("orderId"), status: 201 },
);
op(
  "listShipments",
  "GET",
  `${route}/orders/{orderId}/shipments`,
  z.null(),
  benchmarkPageSchema(shipment),
  { params: params("orderId"), query: benchmarkPageQuerySchema },
);
op("audit", "GET", `${route}/admin/audit`, z.null(), benchmarkPageSchema(historyItem), {
  query: benchmarkPageQuerySchema,
});
op("inbox", "GET", `${route}/inbox`, z.null(), benchmarkPageSchema(notification), {
  query: benchmarkPageQuerySchema,
});
op(
  "promotions",
  "POST",
  `${route}/hooks/carts/{cartId}/promotions`,
  z.strictObject({ promotionIds: refs.max(10), ...expected }),
  promotion,
  { params: params("cartId") },
);
op(
  "taxQuote",
  "POST",
  `${route}/hooks/carts/{cartId}/tax`,
  z.strictObject({ address, ...expected }),
  taxQuote,
  { params: params("cartId") },
);
op(
  "shippingRates",
  "POST",
  `${route}/hooks/carts/{cartId}/shipping`,
  z.strictObject({ address, service: rate.shape.service, packageVersion: version, ...expected }),
  z.strictObject({ rates: z.array(rate).min(1).max(10) }),
  { params: params("cartId") },
);
op(
  "returnRefund",
  "POST",
  `${route}/hooks/orders/{orderId}/returns`,
  z.strictObject({
    orderLineId: id,
    quantity,
    reason: z.enum(["damaged", "unwanted"]),
    ...expected,
  }),
  refund,
  { params: params("orderId"), status: 202 },
);
op(
  "sellerSettlement",
  "POST",
  `${route}/hooks/sellers/{sellerId}/settlements`,
  z.strictObject({ orderId: id, windowStart: time, windowEnd: time, ...expected }),
  settlement,
  { params: params("sellerId") },
);
op(
  "convertCurrency",
  "POST",
  `${route}/hooks/carts/{cartId}/currency`,
  z.strictObject({ targetCurrency: z.literal("EUR"), rateId: id, ...expected }),
  conversion,
  { params: params("cartId") },
);
op(
  "stripePayment",
  "POST",
  `${route}/hooks/orders/{orderId}/stripe`,
  z.strictObject(expected),
  payment,
  { params: params("orderId"), status: 202 },
);
op("stripeCallback", "POST", "/api/providers/stripe/events", rawBody, callbackResult, {
  params: empty,
  auth: "provider",
});
op("syncInventory", "POST", "/api/providers/warehouse/events", rawBody, syncResult, {
  params: empty,
  auth: "provider",
});

const hookIds = z.enum([
  "JH-promotion",
  "JH-tax",
  "JH-shipping",
  "JH-returns",
  "JH-marketplace",
  "JH-currency",
  "JH-provider",
  "JH-inventory-sync",
]);
const snapshot = z
  .strictObject({
    orders: count.optional(),
    orderLines: count.optional(),
    reservations: count.optional(),
    receipts: count.optional(),
    intents: count.optional(),
    audits: count.optional(),
    notifications: count.optional(),
    effectReceipts: count.optional(),
    eventReceipts: count.optional(),
    providerCalls: count.optional(),
    providerCharges: count.optional(),
    paidTransitions: count.optional(),
    paymentAttempts: count.optional(),
    available: count.optional(),
    onHand: count.optional(),
    held: count.optional(),
    allocated: count.optional(),
    shipped: count.optional(),
    mutationWinners: count.optional(),
    versionConflicts: count.optional(),
    forbiddenOccurrences: count.optional(),
    hookWrites: count.optional(),
    refunds: count.optional(),
    payouts: count.optional(),
    sourceReceipts: count.optional(),
    reconciliations: count.optional(),
    versions: z.array(version).max(100).optional(),
    states: z.array(name).max(100).optional(),
    requestKeys: z.array(name).max(100).optional(),
    amounts: z.array(minor).max(100).optional(),
    ids: refs.optional(),
  })
  .refine((s) => Object.keys(s).length > 0);
export const vendureFixtureContract: BenchmarkFixtureContract = {
  operations,
  datasets: {
    principals: z.strictObject({
      id,
      scopeId: id,
      email: z.email(),
      role: z.enum(["customer", "administrator", "fulfillment", "seller"]),
      active: z.boolean(),
      version,
    }),
    products: product.extend({ scopeId: id, createdAt: time }),
    variants: variant.extend({ scopeId: id, costMinor: minor, stockLocationId: id }),
    stock: z.strictObject({
      scopeId: id,
      variantId: id,
      locationId: id,
      onHand: count,
      allocated: count,
      version,
    }),
    carts: cart.extend({ scopeId: id, createdAt: time }),
    quotes: quote.extend({ scopeId: id, address }),
    orders: order.extend({ scopeId: id, createdAt: time }),
    reservations: reservation.extend({ scopeId: id }),
    payments: payment.extend({ scopeId: id }),
    shipments: shipment.extend({ scopeId: id }),
    assets: bytes.extend({
      id,
      scopeId: id,
      productId: id.nullable(),
      variantId: id.nullable(),
      orderId: id.nullable(),
    }),
    history: historyItem.extend({ scopeId: id }),
    notifications: notification.extend({
      scopeId: id,
      eventId: id,
      state: z.enum(["pending", "delivered", "suppressed"]),
    }),
    sellers: z.strictObject({
      id,
      scopeId: id,
      principalId: id,
      orderLineIds: refs,
      feeBps: z.int().min(0).max(10000),
      version,
    }),
    rates: conversion,
    inventoryMappings: z.strictObject({
      source: z.literal("warehouse-v1"),
      scopeId: id,
      externalSku: name,
      variantId: id,
      lastRevision: version,
      authority: z.literal("absolute-on-hand"),
      version,
    }),
  },
  controls: {
    inspect: {
      kind: "inspection",
      input: z.strictObject({ scopeId: id, selector: name, ids: refs }),
      output: snapshot,
    },
    clock: {
      kind: "clock",
      input: z.strictObject({ now: time }),
      output: z.strictObject({ now: time }),
    },
    fault: {
      kind: "fault",
      input: z.strictObject({
        point: z.enum([
          "checkout-before-commit",
          "response-after-commit",
          "expiry-before-commit",
          "notification-after-commit",
          "provider-after-accept",
          "refund-after-accept",
          "payout-after-accept",
          "sync-before-commit",
          "hook-timeout",
          "hook-invalid-output",
        ]),
        operationId: name,
        action: z.enum(["arm", "clear"]),
      }),
      output: z.strictObject({ armed: z.boolean() }),
    },
    barrier: {
      kind: "fault",
      input: z.strictObject({
        requestIds: z.array(name).min(2).max(25),
        winnerRequestId: name,
        phase: z.enum([
          "before-stock-lock",
          "before-cas",
          "after-receipt-lock",
          "expiry-versus-payment",
        ]),
      }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    restart: {
      kind: "worker",
      input: z.strictObject({ process: z.enum(["api", "worker"]), clock: time }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    drain: {
      kind: "worker",
      input: z.strictObject({
        channel: z.enum([
          "payments",
          "expiry",
          "notifications",
          "projection",
          "refunds",
          "payouts",
          "inventory",
        ]),
        ids: refs,
        maxJobs: z.int().min(1).max(100),
        now: time,
      }),
      output: z.strictObject({
        completed: count,
        suppressed: count,
        crashed: count,
        unknown: count,
      }),
    },
    rebuild: {
      kind: "worker",
      input: z.strictObject({ scopeId: id, projectionVersion: version }),
      output: z.strictObject({ queued: z.literal(true) }),
    },
    hook: {
      kind: "provider",
      input: z.strictObject({
        hookId: hookIds,
        mode: z.enum(["reference", "unavailable", "timeout", "invalid-result"]),
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
    provider: {
      kind: "provider",
      input: z.strictObject({
        provider: payment.shape.provider,
        paymentId: id,
        mode: z.enum([
          "settle",
          "accept-lose-response",
          "reject-before-accept",
          "reconcile-settled",
          "reconcile-pending",
          "reconcile-failed",
          "unknown-id",
        ]),
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
    financial: {
      kind: "provider",
      input: z.strictObject({
        kind: z.enum(["refund", "payout"]),
        id,
        mode: z.enum(["reconcile-settled", "reconcile-pending", "reconcile-failed"]),
      }),
      output: z.strictObject({ configured: z.literal(true) }),
    },
    expiryRace: {
      kind: "worker",
      input: z.strictObject({
        orderId: id,
        winner: z.enum(["expiry", "payment"]),
        requestId: name,
        now: time,
      }),
      output: z.strictObject({ ready: z.literal(true) }),
    },
    revoke: {
      kind: "inspection",
      input: z.strictObject({ scopeId: id, principalId: id }),
      output: z.strictObject({ active: z.literal(false) }),
    },
  },
};

/** Descriptions for reviewers, never executable authorization predicates. */
export const vendureOperationPolicies: Record<string, string> = {
  register: "Public exact Origin; credentials only; no role/shop bootstrap.",
  login: "Public exact Origin; credential verification; no shop grants.",
  getSession: "Current durable application-specific session.",
  logout: "Current session, Origin/CSRF; durable invalidation.",
  putProduct: "Current same-shop administrator; no customer or foreign-shop writes.",
  putVariant: "Current same-shop administrator; same-shop product and variant.",
  publish:
    "Current same-shop administrator; product CAS; variants/assets obey current publication.",
  setPrice: "Current same-shop administrator; checked USD amount; affects future quotes only.",
  listCatalog: "Explicit public shop catalog; publication before keyset/limit; public fields only.",
  getProduct:
    "Explicit public shop catalog; current product/variant publication; inaccessible 404.",
  getAsset: "Current public product publication and same-shop association on every byte read.",
  search:
    "Explicit public shop; current source publication before snippets/pages; no cost/stock fields.",
  createCart: "Active customer in trusted shop; owner comes from session.",
  getCart: "Active same-shop owner; other/foreign/revoked 404.",
  addLine: "Active same-shop cart owner; server price; cart CAS and unique variant.",
  changeLine: "Active same-shop owner; line belongs to cart; cart CAS.",
  removeLine: "Active same-shop owner; line belongs to cart; cart CAS.",
  quote: "Active same-shop owner; immutable trusted prices; checked arithmetic; bounded address.",
  checkout:
    "Active same-shop owner; quote/cart/price/address/expiry recheck; lock stock; authorize replay.",
  releaseReservation:
    "Current same-shop owner or administrator; active only; cancel awaiting order atomically.",
  transitionOrder:
    "Owner/admin may cancel awaiting-payment only; paid/shipped transitions are internal verified capabilities.",
  startPayment:
    "Active same-shop owner; active unexpired reservation; one durable payment; atomic hold before dispatch.",
  getPayment: "Active same-shop owner or payment administrator; no secrets.",
  reconcilePayment:
    "Current same-shop administrator; durable identity; no new charge or key on uncertainty.",
  referenceCallback:
    "Original raw bytes authenticated by reference-v1 timestamp/HMAC; persisted provider/payment/shop/amount binding, never body authority.",
  getOrder: "Active same-shop owner or scoped order staff; inaccessible 404.",
  listOrders: "Active same-shop owner subset or scoped staff; policy before keyset/counts.",
  orderHistory:
    "Active same-shop owner or scoped order staff; safe metadata; current authorization.",
  downloadOrder: "Active same-shop owner or order staff; current check before proxy bytes.",
  createShipment:
    "Current same-shop fulfillment operator/admin; paid and allocated quantity ceiling; order CAS.",
  listShipments: "Active same-shop owner or scoped order staff.",
  audit: "Current same-shop administrator; immutable safe metadata only.",
  inbox: "Active current recipient only; recheck order scope/ownership before every read/effect.",
  promotions:
    "Active cart owner; trusted eligible promotion/line snapshot; client supplies references only.",
  taxQuote: "Active cart owner; server builds taxable lines/jurisdiction; no client tax authority.",
  shippingRates:
    "Active cart owner; trusted cart/package and verified service/address constraints.",
  returnRefund:
    "Active order owner or admin; fulfilled/paid/returned snapshot and CAS; no client amount.",
  sellerSettlement:
    "Current same-shop seller membership or administrator; seller line subset only.",
  convertCurrency:
    "Active cart owner; allowlisted snapshotted rate; completed orders never reinterpreted.",
  stripePayment:
    "Active order owner; named Stripe adapter; same hold/attempt rules as startPayment; separate concrete-adapter evidence.",
  stripeCallback:
    "Original Stripe bytes/signature/account/mode/API version; persisted PaymentIntent binding; amount/status verification.",
  syncInventory:
    "Authenticated warehouse original bytes; persisted source/shop/SKU mapping and monotone revisions; preserve commitments.",
};

const hookContext = { scopeId: id, principalId: id, policyVersion: name };
export const vendureHookContracts = {
  "JH-promotion": {
    input: z.strictObject({
      ...hookContext,
      lines: z
        .array(z.strictObject({ lineId: id, grossMinor: minor, eligible: z.boolean() }))
        .min(1)
        .max(100),
      promotionIds: refs.max(10),
      capMinor: minor,
    }),
    result: promotion,
  },
  "JH-tax": {
    input: z.strictObject({
      ...hookContext,
      cartId: id,
      address,
      taxableMinor: minor,
      currency: z.literal("USD"),
      inputHash: z.string().regex(/^[a-f0-9]{64}$/),
      now: time,
    }),
    result: taxQuote,
  },
  "JH-shipping": {
    input: z.strictObject({
      ...hookContext,
      cartId: id,
      address,
      weightGrams: z.int().min(1).max(30000),
      packageVersion: version,
      service: rate.shape.service,
      now: time,
    }),
    result: z.strictObject({ rates: z.array(rate).min(1).max(10) }),
  },
  "JH-returns": {
    input: z.strictObject({
      ...hookContext,
      orderId: id,
      orderLineId: id,
      paidMinor: minor,
      fulfilledQuantity: count,
      refundedQuantity: count,
      refundedMinor: minor,
      requestedQuantity: quantity,
      unitRefundMinor: minor,
      fulfilledAt: time,
      now: time,
      requestKey: name,
    }),
    result: z.strictObject({
      quantity,
      amount: money,
      restock: z.literal("after-inspection"),
      requestKey: name,
    }),
  },
  "JH-marketplace": {
    input: z.strictObject({
      ...hookContext,
      sellerId: id,
      orderId: id,
      attributedLineIds: refs.min(1),
      grossMinor: minor,
      feeBps: z.int().min(0).max(10000),
      windowStart: time,
      windowEnd: time,
      payoutKey: name,
    }),
    result: z.strictObject({ sellerId: id, gross: money, fee: money, net: money, payoutKey: name }),
  },
  "JH-currency": {
    input: z.strictObject({
      ...hookContext,
      sourceMinor: minor,
      sourceCurrency: z.literal("USD"),
      targetCurrency: z.literal("EUR"),
      numerator: z.int().min(1).max(1000000),
      denominator: z.int().min(1).max(1000000),
      rateId: id,
      rateVersion: version,
      asOf: time,
      expiresAt: time,
      now: time,
    }),
    result: conversion,
  },
  "JH-provider": {
    input: z.strictObject({
      ...hookContext,
      action: z.enum(["dispatch", "reconcile", "callback"]),
      paymentId: id,
      requestKey: name,
      amount: money,
      providerId: name.nullable(),
      apiVersion: z.literal("2025-03-31.basil"),
      verifiedBodySha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
    }),
    result: z.strictObject({
      provider: z.literal("stripe-2025-03-31.basil"),
      providerId: name.nullable(),
      state: z.enum(["submitted", "settled", "failed", "unknown"]),
      requestKey: name,
    }),
  },
  "JH-inventory-sync": {
    input: z.strictObject({
      ...hookContext,
      source: z.literal("warehouse-v1"),
      externalSku: name,
      variantId: id,
      revision: version,
      lastRevision: version,
      absoluteOnHand: count,
      committedQuantity: count,
      mappingVersion: version,
    }),
    result: syncResult,
  },
};
export function vendureHookSchemas() {
  return Object.fromEntries(
    Object.entries(vendureHookContracts).map(([key, contract]) => [
      key,
      Object.fromEntries(
        Object.entries(contract).map(([part, value]) => {
          const { $schema: _, ...result } = z.toJSONSchema(value);
          return [part, result];
        }),
      ),
    ]),
  );
}

export const VENDURE_FIXTURE_ORIGIN = "http://127.0.0.1:4322";
export const VENDURE_FIXTURE_COOKIE = `jeeves_session_${createHash("sha256").update(VENDURE_FIXTURE_ORIGIN).digest("hex").slice(0, 32)}`;
/** JSON-compatible OpenAPI 3.1 document exported solely from acceptance-side schemas. */
export function vendureOpenApi() {
  const providerBodies: Record<string, z.ZodType> = {
    referenceCallback: vendureReferenceEventSchema,
    stripeCallback: vendureStripeEventSchema,
    syncInventory: vendureWarehouseEventSchema,
  };
  const schema = (value: z.ZodType) => {
    const { $schema: _, ...result } = z.toJSONSchema(value);
    return result;
  };
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    const parameters: unknown[] = [];
    for (const part of ["params", "query"] as const) {
      const object = schema(operation.input[part]) as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      for (const [name, property] of Object.entries(object.properties ?? {}))
        parameters.push({
          name,
          in: part === "params" ? "path" : "query",
          required: part === "params" || !!object.required?.includes(name),
          schema: property,
        });
    }
    if (operation.idempotency === "required")
      parameters.push({ $ref: "#/components/parameters/IdempotencyKey" });
    if (operation.method !== "GET" && operation.authentication !== "provider") {
      parameters.push({ $ref: "#/components/parameters/Origin" });
      if (operation.authentication === "session")
        parameters.push({ $ref: "#/components/parameters/CsrfToken" });
    }
    if (operation.authentication === "provider")
      for (const name of operation.id === "stripeCallback"
        ? ["Stripe-Signature"]
        : ["X-Provider-Timestamp", "X-Provider-Signature"])
        parameters.push({
          name,
          in: "header",
          required: true,
          schema: { type: "string", minLength: 1, maxLength: 256 },
        });
    const responses: Record<string, unknown> = {};
    const commonHeaders = {
      "Cache-Control": { $ref: "#/components/headers/CacheControl" },
      "X-Correlation-Id": { $ref: "#/components/headers/CorrelationId" },
    };
    for (const [status, response] of Object.entries(operation.responses)) {
      const headers: Record<string, unknown> = { ...commonHeaders };
      const extra = operation.responseHeaders?.[+status];
      if (extra)
        for (const [name, property] of Object.entries(schema(extra).properties ?? {}))
          headers[name] = { schema: property };
      responses[status] = {
        description: "Fixed success contract; subject to current authorization",
        headers,
        ...(+status === 204
          ? {}
          : ["getAsset", "downloadOrder"].includes(operation.id)
            ? {
                content: { "text/plain": { schema: { type: "string", format: "binary" } } },
                "x-fixture-descriptor": schema(response),
              }
            : { content: { "application/json": { schema: schema(response) } } }),
      };
    }
    for (const status of operation.errors)
      responses[status] = {
        description: "Shared safe error; see protocol v1",
        headers: {
          ...commonHeaders,
          ...(status === 409 && operation.idempotency === "required"
            ? {
                "Retry-After": {
                  schema: { type: "string", const: "1" },
                  description: "Required only for COMMAND_IN_PROGRESS",
                },
              }
            : {}),
        },
        content: { "application/json": { schema: schema(benchmarkErrorSchema) } },
      };
    const pathItem = paths[operation.path] ?? {};
    paths[operation.path] = pathItem;
    pathItem[operation.method.toLowerCase()] = {
      operationId: operation.id,
      "x-access-policy": vendureOperationPolicies[operation.id],
      security:
        operation.authentication === "public"
          ? []
          : operation.authentication === "provider"
            ? [
                {
                  [operation.id === "stripeCallback" ? "StripeSignature" : "ProviderSignature"]: [],
                },
              ]
            : [{ Session: [] }],
      parameters,
      ...(operation.method === "GET"
        ? {}
        : {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema:
                    operation.authentication === "provider"
                      ? schema(providerBodies[operation.id] ?? operation.input.body)
                      : schema(operation.input.body),
                },
              },
              ...(operation.authentication === "provider"
                ? {
                    "x-fixture-raw-utf8": schema(operation.input.body),
                    description:
                      "Original UTF-8 JSON bytes, sent verbatim; strict decoded envelope and authentication in hooks.md and callback contracts. Never JSON-encode this fixture string again.",
                  }
                : {}),
            },
          }),
      responses,
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Independent Jeeves Vendure-core v1 acceptance contract",
      version: "v1",
      description:
        "P61c contract only. Application absent/not run. No upstream API compatibility claim. Scope/access/hook policy is in README.md and hooks.md.",
    },
    servers: [{ url: VENDURE_FIXTURE_ORIGIN }],
    paths,
    components: {
      ...benchmarkProtocolComponents(),
      securitySchemes: {
        Session: benchmarkSessionSecurityScheme(VENDURE_FIXTURE_COOKIE),
        StripeSignature: {
          type: "apiKey",
          in: "header",
          name: "Stripe-Signature",
          description:
            "Stripe t/v1 HMAC over timestamp dot original body; 300-second tolerance; see hooks.md",
        },
        ProviderSignature: {
          type: "apiKey",
          in: "header",
          name: "X-Provider-Signature",
          description:
            "HMAC-SHA256 over timestamp dot original body; 300-second tolerance; persisted provider/shop/payment binding; fixture-only test secret",
        },
      },
    },
  };
}

/** Strict decoded callback envelopes, validated only after authenticating the original bytes. */
export const vendureReferenceEventSchema = z.strictObject({
  eventId: name,
  requestKey: name,
  scopeId: id,
  paymentId: id,
  orderId: id,
  providerId: name,
  amount: minor,
  currency: z.literal("USD"),
  state: z.enum(["settled", "failed", "submitted"]),
  sequence: version,
  occurredAt: time,
});
export const vendureStripeEventSchema = z.strictObject({
  id: name,
  object: z.literal("event"),
  api_version: z.literal("2025-03-31.basil"),
  created: z.int().positive(),
  livemode: z.literal(false),
  account: z.literal("acct_fixture_shop_a"),
  type: z.enum([
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.processing",
  ]),
  data: z.strictObject({
    object: z.strictObject({
      id: name,
      object: z.literal("payment_intent"),
      amount: minor.max(99999999),
      amount_received: minor.max(99999999),
      currency: z.literal("usd"),
      status: z.enum(["succeeded", "requires_payment_method", "processing"]),
      metadata: z.strictObject({ paymentId: id, scopeId: id, orderId: id }),
    }),
  }),
});
export const vendureWarehouseEventSchema = z.strictObject({
  source: z.literal("warehouse-v1"),
  scopeId: id,
  eventId: name,
  externalSku: name,
  revision: version,
  absoluteOnHand: count,
  mappingVersion: version,
});
export function vendureCallbackSchemas() {
  return Object.fromEntries(
    Object.entries({
      reference: vendureReferenceEventSchema,
      stripe: vendureStripeEventSchema,
      warehouse: vendureWarehouseEventSchema,
    }).map(([key, value]) => {
      const { $schema: _, ...result } = z.toJSONSchema(value);
      return [key, result];
    }),
  );
}

/** Selected outbound provider wire contracts; fixture-only requests, never a network client. */
export const vendureProviderContracts = {
  referenceDispatch: z.strictObject({
    requestKey: name,
    scopeId: id,
    paymentId: id,
    orderId: id,
    amount: minor,
    currency: z.literal("USD"),
  }),
  referenceResult: z.strictObject({
    requestKey: name,
    providerId: name,
    amount: minor,
    currency: z.literal("USD"),
    state: z.enum(["submitted", "settled", "failed"]),
  }),
  stripeCreate: z.strictObject({
    amount: z.int().min(50).max(99999999),
    currency: z.literal("usd"),
    confirm: z.literal(true),
    payment_method: z.literal("pm_card_visa"),
    payment_method_types: z.tuple([z.literal("card")]),
    metadata: z.strictObject({ paymentId: id, scopeId: id, orderId: id }),
  }),
  stripeResult: z.strictObject({
    id: name,
    object: z.literal("payment_intent"),
    amount: z.int().min(50).max(99999999),
    amount_received: minor.max(99999999),
    currency: z.literal("usd"),
    status: z.enum([
      "succeeded",
      "processing",
      "requires_payment_method",
      "canceled",
      "requires_action",
      "requires_confirmation",
      "requires_capture",
    ]),
  }),
};
export function vendureProviderSchemas() {
  return Object.fromEntries(
    Object.entries(vendureProviderContracts).map(([key, value]) => {
      const { $schema: _, ...result } = z.toJSONSchema(value);
      return [key, result];
    }),
  );
}
