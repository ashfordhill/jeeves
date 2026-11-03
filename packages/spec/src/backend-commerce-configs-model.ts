/** Finite commerce design settings. These do not calculate money or execute transactions. */
import { z } from "zod";
import { contractTypeReferenceSchema as exact } from "./contract-shapes.ts";
import { idSchema } from "./ids.ts";

const named = {
  ...exact.shape,
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1).max(120),
  owner: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("element"), id: idSchema }),
    z.strictObject({ kind: z.literal("component"), id: idSchema }),
  ]),
};
const field = z.strictObject({ entity: exact, field: idSchema });
const fields = z.array(field).min(1).max(100);
const seconds = z.int().min(1).max(31_536_000);
const guarded = z.strictObject({ operation: exact, guards: z.array(idSchema).min(1).max(20) });
const lifecycle = z.strictObject({ reference: exact, guards: z.array(idSchema).max(20) });
export const backendMoneyConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("money"),
  fields,
  currencies: z
    .array(z.string().regex(/^[A-Z]{3}$/))
    .min(1)
    .max(20),
  minimumMinorUnits: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  maximumMinorUnits: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  maximumTotalMinorUnits: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
  maximumQuantity: z.int().min(1).max(1_000_000),
  maximumLines: z.int().min(1).max(1000),
  arithmetic: z.literal("checked-integer-minor-units"),
  overflow: z.literal("reject-before-write"),
  currency: z.literal("single-currency-per-quote"),
});
export const backendCartConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("cart"),
  aggregate: exact,
  line: exact,
  relation: idSchema,
  quantity: field,
  variant: field,
  money: exact,
  quote: z.strictObject({
    strategy: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("fixed-price"), version: z.literal("v1"), price: field }),
      z.strictObject({ kind: z.literal("hook"), hook: exact }),
    ]),
    shipping: z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("flat"),
        minorUnits: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
      }),
      z.strictObject({ kind: z.literal("hook"), hook: exact }),
    ]),
    tax: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("fixture-zero"), production: z.literal("unsupported") }),
      z.strictObject({
        kind: z.literal("fixture-rate"),
        version: z.literal("v1"),
        basisPoints: z.int().min(0).max(10000),
        rounding: z.literal("half-up-on-subtotal"),
        production: z.literal("unsupported"),
      }),
      z.strictObject({ kind: z.literal("hook"), hook: exact }),
    ]),
    pricingHooks: z
      .array(z.strictObject({ purpose: z.enum(["promotion", "currency"]), hook: exact }))
      .max(2),
    expiresAfterSeconds: seconds,
    expiresAt: field,
    snapshot: fields,
    provenance: fields,
    inputAuthority: z.literal("server-catalog-and-validated-hooks"),
    stale: z.literal("reject-before-write"),
  }),
  mutations: z.strictObject({ add: exact, change: exact, remove: exact }),
  concurrency: z.literal("expected-version-and-command-receipt"),
});
export const backendInventoryConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("inventory"),
  aggregate: exact,
  stock: exact,
  reservation: exact,
  relation: idSchema,
  location: field,
  variant: field,
  onHand: field,
  reserved: field,
  quantity: field,
  countMeaning: z.literal("on-hand-includes-reserved"),
  available: z.literal("on-hand-minus-active-and-held-reservations"),
  concurrency: z.literal("stable-stock-and-reservation-row-locks"),
  lifecycle,
  states: z.strictObject({
    active: idSchema,
    held: idSchema,
    consumed: idSchema,
    released: idSchema,
    expired: idSchema,
  }),
  expiry: z.strictObject({
    lifetimeSeconds: seconds,
    expiresAt: field,
    delivery: exact,
    operation: guarded,
    eligible: z.literal("active-only-before-payment"),
    race: z.literal("same-lock-recheck-state-version-and-due"),
  }),
  heldPayment: z.strictObject({
    payment: exact,
    expiry: z.literal("never-automatically-release"),
    resolution: z.literal("confirmed-terminal-payment-or-explicit-reconciliation"),
  }),
});
export const backendOrderConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("order"),
  concurrency: z.literal("stable-aggregate-entity-primary-key"),
  aggregate: exact,
  cart: exact,
  inventory: exact,
  money: exact,
  checkout: guarded,
  cancellation: guarded,
  lifecycle,
  snapshots: z
    .array(
      z.strictObject({
        purpose: z.enum([
          "variant",
          "quantity",
          "unit-price",
          "line-total",
          "address",
          "order-total",
          "quote-provenance",
        ]),
        source: field,
        target: field,
      }),
    )
    .min(7)
    .max(100),
  snapshotMutation: z.literal("immutable-after-checkout"),
  checkoutBoundary: z.literal("order-lines-reservations-and-receipt-one-store-transaction"),
  quote: z.literal("recheck-version-expiry-currency-and-total-before-write"),
  paymentReview: idSchema,
  cancellationWhileUncertain: z.literal("reconcile-before-release"),
});
// Provider schema is injected here to avoid a circular schema dependency.
export const createBackendPaymentConfigSchema = <T extends z.ZodType>(provider: T) =>
  z.strictObject({
    ...named,
    kind: z.literal("payment"),
    concurrency: z.literal("stable-aggregate-entity-primary-key"),
    entity: exact,
    order: exact,
    inventory: exact,
    money: exact,
    amount: field,
    lifecycle,
    states: z.strictObject({
      created: idSchema,
      submitted: idSchema,
      settled: idSchema,
      failed: idSchema,
      unknown: idSchema,
    }),
    provider,
    dispatch: exact,
    providerIdentity: field,
    identity: z.literal("persisted-attempt-key-reused-after-uncertainty"),
    callback: z.strictObject({
      operation: guarded,
      verification: z.literal("original-bytes-provider-credential-timestamp-replay"),
      replayWindowSeconds: z.int().min(1).max(86400),
      receipt: z.literal("durable-provider-event-before-ack"),
    }),
    reconciliation: z.strictObject({ operation: exact, delivery: exact, outcome: idSchema }),
    uncertainty: z.literal("unknown-order-review-stock-held"),
    terminal: z.literal("monotone-settlement-no-older-failure-regression"),
    paymentsPerOrder: z.literal(1),
  });
export const backendFulfillmentConfigSchema = z.strictObject({
  ...named,
  kind: z.literal("fulfillment"),
  concurrency: z.literal("stable-aggregate-entity-primary-key"),
  aggregate: exact,
  order: exact,
  payment: exact,
  inventory: exact,
  lifecycle,
  shipment: guarded,
  identity: field,
  ordered: field,
  paid: field,
  reserved: field,
  fulfilled: field,
  quantity: field,
  maximumQuantity: z.int().min(1).max(1_000_000),
  constraint: z.literal("positive-at-most-paid-reserved-and-unfulfilled"),
  partial: z.literal("sum-committed-shipments-under-order-line-lock"),
  retry: z.literal("same-command-returns-same-shipment"),
});
