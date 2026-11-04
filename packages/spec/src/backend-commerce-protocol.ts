/** Safety checks for finite commerce intent; no monetary calculation or command is executed. */
import { contractKey } from "./architecture-contracts.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding } from "./findings.ts";

const protectedFields = ["id", "scope-id", "created-at", "version"];
const allowed: Record<string, string[]> = {
  "catalog-write": ["name", "sku", "published", "price", "price-version"],
  "cart-mutate": ["owner-id", "state", "cart-id", "variant-id", "quantity"],
  "quote-exact": [
    "cart-id",
    "owner-id",
    "cart-version",
    "price-version",
    "address",
    "subtotal",
    "tax",
    "shipping",
    "total",
    "tax-policy",
    "shipping-policy",
    "expires-at",
    "quote-id",
    "variant-id",
    "quantity",
    "unit-price",
  ],
  "checkout-reserve": [
    "state",
    "owner-id",
    "cart-id",
    "quote-id",
    "address",
    "subtotal",
    "tax",
    "shipping",
    "total",
    "tax-policy",
    "shipping-policy",
    "source-cart-version",
    "source-price-version",
    "order-id",
    "variant-id",
    "quantity",
    "unit-price",
    "price-version",
    "location-id",
    "expires-at",
  ],
  "reservation-release": ["state"],
  "reservation-expire": ["state"],
  "order-cancel": ["state"],
  "payment-submit": ["state"],
  "financial-submit": ["state"],
  "payment-start": ["order-id", "provider", "request-key", "amount", "state", "provider-id"],
  "payment-callback": [
    "state",
    "provider-id",
    "allocated",
    "payment-id",
    "provider",
    "event-id",
    "original-sha256",
    "at",
  ],
  "payment-reconcile": ["state", "provider-id", "allocated"],
  "payment-dispatch": ["state", "provider-id", "allocated"],
  "shipment-create": [
    "state",
    "allocated",
    "on-hand",
    "order-id",
    "at",
    "order-version",
    "shipment-id",
    "line-id",
    "quantity",
  ],
  "return-plan": ["order-id", "request-key", "amount", "lines", "state"],
  "settlement-plan": ["seller-id", "request-key", "amount", "fee", "state"],
  "financial-dispatch": ["state"],
  "warehouse-apply": [
    "on-hand",
    "last-revision",
    "mapping-id",
    "event-id",
    "revision",
    "state",
    "target-id",
    "identity",
    "kind",
    "content-hash",
  ],
  "commerce-notify": [
    "order-id",
    "recipient-id",
    "event-id",
    "action",
    "state",
    "at",
    "notification-id",
    "request-key",
  ],
  "commerce-delivery": ["state"],
  "commerce-projection": ["variant-id", "product-id", "text", "projection-version"],
  "promotion-quote": [],
  "tax-quote": [],
  "shipping-quote": [],
  "currency-quote": [],
};
const transitions: Record<string, string[]> = {
  "checkout-reserve": ["active/converted"],
  "reservation-release": ["active/released"],
  "reservation-expire": ["active/expired"],
  "order-cancel": ["awaiting-payment/cancelled", "active/released"],
  "payment-submit": ["created/submitted"],
  "financial-submit": ["planned/submitted"],
  "payment-start": ["active/held-for-payment"],
  "payment-callback": [
    "submitted/settled",
    "unknown/settled",
    "awaiting-payment/paid",
    "payment-review/paid",
    "held-for-payment/consumed",
    "submitted/failed",
    "unknown/failed",
    "held-for-payment/released",
  ],
  "payment-reconcile": [
    "submitted/settled",
    "unknown/settled",
    "awaiting-payment/paid",
    "payment-review/paid",
    "held-for-payment/consumed",
    "submitted/failed",
    "unknown/failed",
    "held-for-payment/released",
  ],
  "payment-dispatch": [
    "submitted/unknown",
    "awaiting-payment/payment-review",
    "submitted/settled",
    "unknown/settled",
    "awaiting-payment/paid",
    "payment-review/paid",
    "held-for-payment/consumed",
    "created/failed",
    "submitted/failed",
  ],
  "shipment-create": [
    "paid/partially-fulfilled",
    "paid/fulfilled",
    "partially-fulfilled/fulfilled",
    "pending/shipped",
  ],
  "return-plan": ["planned/submitted"],
  "financial-dispatch": [
    "planned/submitted",
    "submitted/unknown",
    "submitted/settled",
    "unknown/settled",
    "unknown/reconcile",
  ],
  "commerce-notify": ["pending/materialized", "pending/suppressed"],
  "commerce-delivery": [
    "pending/sent",
    "pending/unknown",
    "pending/suppressed",
    "unknown/sent",
    "unknown/suppressed",
  ],
};
export function validateCommerceProtocol(d: DesignDocument, o: BackendOperation) {
  const p = o.protocol!,
    m = d.architecture!.backend!,
    out: Finding[] = [];
  const bad = (message: string) =>
    out.push(
      finding("CONFIG_INVALID", message, {
        path: ["architecture", "backend", "operations", contractKey(o), "protocol"],
      }),
    );
  if (!p.commerce) return [];
  const requiredHook: Record<string, string> = {
    "promotion-quote": "promotion",
    "tax-quote": "tax",
    "shipping-quote": "shipping",
    "return-plan": "returns",
    "settlement-plan": "marketplace",
    "currency-quote": "currency",
    "warehouse-apply": "inventory-sync",
  };
  if (requiredHook[p.procedure] && p.hookSettings?.kind !== requiredHook[p.procedure])
    bad("Commerce hook policy must retain its exact typed settings.");
  if (
    p.hookSettings &&
    !requiredHook[p.procedure] &&
    !(p.procedure === "payment-start" && p.hookSettings.kind === "provider")
  )
    bad("Project hook settings cannot substitute for an unrelated procedure.");
  const permitted = [
    ...protectedFields,
    ...(allowed[p.procedure] ?? []),
    ...(p.execution === "authorized-worker" ? ["order-id", "actor-id", "action", "at"] : []),
  ];
  for (const r of p.records) {
    const e = m.entities.find((e) => contractKey(e) === contractKey(r.entity))!;
    for (const w of r.writes) {
      if (!permitted.includes(w.field))
        bad("Commerce procedure cannot write outside its reviewed finite field set.");
      const fs = e.fields.map((f) => f.field);
      const snapshot =
        fs.includes("unit-price") || (fs.includes("cart-version") && fs.includes("expires-at"));
      const commercial =
        fs.includes("source-cart-version") &&
        [
          "owner-id",
          "cart-id",
          "quote-id",
          "address",
          "subtotal",
          "tax",
          "shipping",
          "total",
          "tax-policy",
          "shipping-policy",
          "source-cart-version",
          "source-price-version",
        ].includes(w.field);
      if ((snapshot || commercial) && r.selection !== "server-created")
        bad(
          "Immutable commercial snapshots may only be inserted from their authoritative original snapshot.",
        );
    }
  }
  for (const t of p.transitions) {
    const l = m.lifecycles!.find((l) => contractKey(l) === contractKey(t.lifecycle)),
      tr = l?.transitions.find((v) => v.id === t.transition);
    if (tr && !transitions[p.procedure]?.includes(`${tr.from}/${tr.to}`))
      bad(
        "Commerce procedure cannot dispatch a lifecycle transition outside its guarded state graph.",
      );
  }
  if (
    ["promotion-quote", "tax-quote", "shipping-quote", "currency-quote"].includes(p.procedure) &&
    (o.kind !== "query" || o.writes.length)
  )
    bad("Pure quote hooks cannot mutate domain state or publish work.");
  if (p.procedure === "payment-start" && p.externalIO !== "none")
    bad(
      "Persist the attempt and holds before dispatch; the start command cannot send a provider request.",
    );
  return out;
}
