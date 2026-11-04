/** Reviewed, finite local participant/write plans. Keys are stable logical names, not SQL/code. */
import type { BackendProtocolPlan } from "./backend-protocol-model.ts";
export type VendureRecipe = {
  procedure: BackendProtocolPlan["procedure"];
  root: string;
  records: string[];
  writes?: Record<string, string[]>;
  creates?: string[];
  hook?: string;
  query?: string;
  external?: BackendProtocolPlan["externalIO"];
  pre: string[];
  post: string[];
};
const commerce = (
  procedure: VendureRecipe["procedure"],
  root: string,
  records: string[],
  writes: Record<string, string[]>,
  pre: string[],
  post: string[],
  extras: Partial<VendureRecipe> = {},
): VendureRecipe => ({ procedure, root, records, writes, pre, post, ...extras });
const read = (
  root: string,
  records: string[] = [],
  query?: string,
  external?: VendureRecipe["external"],
): VendureRecipe => ({
  procedure: external ? "private-download" : "bounded-read",
  root,
  records,
  query,
  external,
  pre: [
    "Current exact shop policy before observation, matching, pagination, snippets or byte streaming. Cursor/body IDs establish no authority.",
  ],
  post: [
    "Only the selected current projection; default25/max100 authenticated scope/query/order-bound keyset cursor. Foreign/inaccessible IDs use safe404, invalid cursor400. No hidden cost, stock or private address.",
  ],
});
const checkoutFields = [
  "id",
  "scope-id",
  "version",
  "created-at",
  "owner-id",
  "cart-id",
  "quote-id",
  "state",
  "address",
  "subtotal",
  "tax",
  "shipping",
  "total",
  "tax-policy",
  "shipping-policy",
  "source-cart-version",
  "source-price-version",
];
const lineFields = [
  "scope-id",
  "version",
  "created-at",
  "id",
  "order-id",
  "variant-id",
  "quantity",
  "unit-price",
  "price-version",
];
const holdPre = [
  "Current owner and order expectedVersion; awaiting-payment with every active reservation unexpired. Lock current order/reservations then stock UUID ascending and recheck. Expiry/start-payment share this order and current deadline check.",
];
const holdPost = [
  "One payment created v1 with immutable amount/provider/request key, all reservations held v2 and order v2 commit before dispatch. Event intent/command receipt share SQL. Existing unknown/settled attempt cannot be replaced under a fresh key.",
];
const settlePre = [
  "Verify original bytes <=65536, timestamp±300s and HMAC-SHA256 constant-time before parsing. Current service-purpose and persisted provider/shop/order/payment/amount/currency must match; body scope is never authority.",
  "When providerId is null, authenticated callback requestKey plus authoritative same-key lookup must confirm providerId/amount/order/shop/payment. Unavailable lookup returns503 unknown/held with no event receipt. Duplicate event with changed normalized content409; signatures may be refreshed.",
];
const settlePost = [
  "Event receipt and current payment/order/reservation/stock/history/audit/intent commit together. Settlement is monotone: unknown v3→settled v4 and review v3→paid v4; held v2→consumed v3; increment allocated once. Original totals/lines remain unchanged.",
  "Duplicate exact event returns200 applied:false; a new older failure records a no-op receipt, never reverses paid/settled. Definitive failed reconciliation can release holds through a guarded terminal command; pending/missing/unavailable preserves unknown and held. No cross-network rollback.",
];
export const vendureCoreRecipes: Record<string, VendureRecipe> = {
  "put-product": commerce(
    "catalog-write",
    "product",
    [],
    { product: ["name", "version"] },
    ["Current administrator, same-shop product ID; expected version fences insert/update."],
    [
      "One product identity; new product remains unpublished, initial virtual v1 CAS returnsv2. Same-key replay precedes CAS.",
    ],
  ),
  "put-variant": commerce(
    "catalog-write",
    "variant",
    ["product"],
    { variant: ["sku", "price", "published", "version", "price-version"] },
    [
      "Current administrator and same-shop product/variant association; expectedVersion fences current variant.",
    ],
    [
      "Unique SKU and exact USD price; independently version price once; catalog changes never rewrite quote/order snapshots.",
    ],
  ),
  publish: commerce(
    "catalog-write",
    "product",
    ["variant", "asset", "search-projection"],
    { product: ["published", "version"] },
    ["Current administrator and expected product version."],
    [
      "Current publication is immediate public read/search/asset authority even if projection is stale; retry creates no duplicate intent.",
    ],
  ),
  "set-price": commerce(
    "catalog-write",
    "variant",
    ["product"],
    { variant: ["price", "price-version", "version"] },
    ["Current administrator; safe USD minor units, variant CAS."],
    [
      "Increment exact independent price version; every unconverted quote must recheck each variant, completed snapshots remain immutable.",
    ],
  ),
  "list-catalog": read("product", ["variant", "asset"], "catalog"),
  "get-product": read("product", ["variant", "asset"]),
  "get-asset": read("asset", ["product", "variant"], undefined, "authorized-proxy-after-read"),
  search: read("search-projection", ["product", "variant", "asset"], "search"),
  "create-cart": commerce(
    "cart-mutate",
    "cart",
    [],
    { cart: ["id", "scope-id", "created-at", "version", "owner-id", "state"] },
    ["Server current principal and authorized shop; no client owner or role."],
    ["Create one active v1 empty cart and receipt."],
    { creates: ["cart"] },
  ),
  "get-cart": read("cart", ["cart-line"]),
  "add-line": commerce(
    "cart-mutate",
    "cart",
    ["cart-line", "variant", "product"],
    {
      cart: ["version"],
      "cart-line": ["id", "scope-id", "created-at", "version", "cart-id", "variant-id", "quantity"],
    },
    [
      "Active owner cart CAS; current published same-shop variant; quantity1..1000, maximum100 distinct variants.",
    ],
    [
      "Add to existing distinct variant or create one line; reject overflow/invalid full mutation without partial correction; receipt replay before version.",
    ],
  ),
  "change-line": commerce(
    "cart-mutate",
    "cart",
    ["cart-line"],
    { cart: ["version"], "cart-line": ["quantity", "version"] },
    ["Active owner cart CAS; line belongs to cart, quantity1..1000."],
    ["One cart revision for accepted line change; stale409 or malformed mutation unchanged."],
  ),
  "remove-line": commerce(
    "cart-mutate",
    "cart",
    ["cart-line"],
    { cart: ["version"], "cart-line": [] },
    ["Active owner cart CAS; selected line belongs to this cart."],
    [
      "Delete exact selected relation row, never set quantity0. Removed lines cannot be borrowed across carts; repeated key replays original cart.",
    ],
  ),
  quote: commerce(
    "quote-exact",
    "cart",
    ["cart-line", "variant", "product", "quote", "quote-line"],
    {
      quote: [
        "id",
        "scope-id",
        "created-at",
        "version",
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
      ],
      "quote-line": [
        "id",
        "scope-id",
        "created-at",
        "version",
        "quote-id",
        "variant-id",
        "quantity",
        "unit-price",
        "price-version",
      ],
    },
    [
      "Current owner, active cart CAS; server variants and exact quantities/address; reject empty or invalid/overflow.",
    ],
    [
      "Checked exact integer products/sums, tax750bps half-up on merchandise only, shipping500 untaxed/nonrefundable. Append immutable five-minute quote/lines without changing cart version; same-key replay never extends expiry.",
    ],
    { creates: ["quote", "quote-line"] },
  ),
  checkout: commerce(
    "checkout-reserve",
    "order",
    ["cart", "cart-line", "quote", "quote-line", "variant", "product", "reservation", "stock"],
    {
      cart: ["state", "version"],
      order: checkoutFields,
      "order-line": lineFields,
      reservation: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "order-id",
        "variant-id",
        "location-id",
        "quantity",
        "state",
        "expires-at",
      ],
    },
    [
      "Current cart owner; lock cart, selected order/reservations then existing stock rows by UUID ascending. Recheck cart CAS, quote owner/cart/version/expiry/address/quantities and EACH variant price version; mixed/stale versions409.",
      "Availability=onHand-active-held-allocated; consumed reservations never subtract twice. All lines must fit; one last-item winner, loser409 with no partial state/receipt/effect.",
    ],
    [
      "One SQL connection commits cart activev3→convertedv4, order/immutable lines/reservations, history/audit, terminal receipt and original intent. One order per cart. Precommit failure leaves all absent/unchanged; lost commit acknowledgement uses same key. Reservation lifetime900s, seeded deadlines unchanged.",
    ],
    { creates: ["order", "order-line", "reservation"] },
  ),
  "release-reservation": commerce(
    "reservation-release",
    "reservation",
    ["order", "payment", "stock"],
    { reservation: ["state", "version"] },
    [
      "Current authorized owner/admin, reservation CAS and locked awaiting-payment order; active only.",
    ],
    [
      "Release active reservation once; held or consumed rejects422 unchanged. Never release unknown-payment stock.",
    ],
  ),
  "transition-order": commerce(
    "order-cancel",
    "order",
    ["payment", "reservation", "stock"],
    { order: ["state", "version"], reservation: ["state", "version"] },
    [
      "Current owner/admin, exact order CAS. Public to accepts only cancelled from awaiting-payment and no submitted/unknown/settled attempt; direct paid/fulfilled requests reject422.",
    ],
    [
      "Cancel releases only active unpaid reservations in one local set; payment-review/paid/partially-fulfilled/fulfilled cannot cancel blindly. Repeated key has no second audit/notification.",
    ],
  ),
  "start-payment": commerce(
    "payment-start",
    "order",
    ["payment", "reservation", "stock"],
    {
      payment: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "order-id",
        "provider",
        "request-key",
        "amount",
        "state",
        "provider-id",
      ],
      order: ["version"],
      reservation: ["state", "version"],
    },
    holdPre,
    holdPost,
    { creates: ["payment"] },
  ),
  "get-payment": read("payment", ["order"]),
  "reconcile-payment": commerce(
    "payment-reconcile",
    "payment",
    ["order", "reservation", "stock", "provider-event"],
    {
      payment: ["state", "provider-id", "version"],
      order: ["state", "version"],
      reservation: ["state", "version"],
      stock: ["allocated", "version"],
    },
    [
      "Current administrator and payment CAS. Authoritative lookup outside SQL uses immutable provider/request identity; reacquire locks and recheck versions before apply.",
    ],
    settlePost,
    { external: "committed-intent-provider-call" },
  ),
  "reference-callback": commerce(
    "payment-callback",
    "payment",
    ["order", "reservation", "stock", "provider-event"],
    {
      payment: ["state", "provider-id", "version"],
      order: ["state", "version"],
      reservation: ["state", "version"],
      stock: ["allocated", "version"],
      "provider-event": [
        "id",
        "scope-id",
        "created-at",
        "version",
        "payment-id",
        "provider",
        "event-id",
        "original-sha256",
        "at",
      ],
    },
    settlePre,
    settlePost,
    { creates: ["provider-event"], external: "verified-source-before-sql" },
  ),
  "get-order": read("order", ["order-line"]),
  "list-orders": read("order", ["order-line"], "orders"),
  "order-history": read("history", ["order"], "history"),
  "download-order": read("order", ["order-line"], undefined, "authorized-proxy-after-read"),
  "create-shipment": commerce(
    "shipment-create",
    "order",
    ["order-line", "payment", "reservation", "stock", "shipment", "shipment-line"],
    {
      order: ["state", "version"],
      stock: ["on-hand", "allocated", "version"],
      shipment: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "order-id",
        "at",
        "state",
        "order-version",
      ],
      "shipment-line": [
        "id",
        "scope-id",
        "created-at",
        "version",
        "shipment-id",
        "order-id",
        "line-id",
        "quantity",
      ],
    },
    [
      "Current fulfillment/admin and order CAS; settled payment and paid/partially-fulfilled order only. Lock order/lines/reservations/stock and sum ALL active shipments per line.",
      "Positive quantities<=purchased, paid, allocated and remaining unshipped. Reject duplicate/foreign lines and entire overrun, including two concurrent fresh keys.",
    ],
    [
      "Create shipped shipment and line quantities once; decrement stock onHand and allocated together, never purchased line quantity. Set partially-fulfilled or fulfilled only from cumulative quantities. Receipt/history/audit/notification intent share commit; lost response replays same shipment.",
    ],
    { creates: ["shipment", "shipment-line"] },
  ),
  "list-shipments": read("shipment", ["order", "shipment-line"], "shipment"),
  audit: read("audit", [], "audit"),
  inbox: read("notification", ["order", "membership"], "inbox"),
  promotions: commerce(
    "promotion-quote",
    "cart",
    ["cart-line", "variant"],
    {},
    [
      "Current owner/cart CAS; trusted original gross and eligibility, one distinct known promotion only, no stacking/duplicates.",
    ],
    [
      "10% floor capped3; proportional floors then descending remainder/ascending lineUUID gives2/1/0 for eligible1001/1001 and excluded209. Sum/line ceilings validate before use; pure repeated originals, no writes.",
    ],
    { hook: "promotion" },
  ),
  "tax-quote": commerce(
    "tax-quote",
    "cart",
    ["cart-line", "variant"],
    {},
    [
      "Current owner/cart CAS; trusted US-IL address, USD subtotal and canonical sorted-key input hash, no forged tax/jurisdiction.",
    ],
    [
      "Project tax quote10997→825 with exact provider/policy/hash and expiry12:05. Recheck expiry; no unavailable/invalid fallback, no rewriting completed tax.",
    ],
    { hook: "tax" },
  ),
  "shipping-rates": commerce(
    "shipping-quote",
    "cart",
    ["cart-line", "variant"],
    {},
    [
      "Current owner/cart CAS; trusted package weights/address, service ground/express and matching package version; no price authority.",
    ],
    [
      "Versioned project rate table: ground<=30000g500; express<=5000g1000; reject prefix999/unsupported destinations. Bounded1..10 rates, expiry/provenance exact; no free-shipping fallback or carrier execution.",
    ],
    { hook: "shipping" },
  ),
  "return-refund": commerce(
    "return-plan",
    "order",
    ["order-line", "shipment", "shipment-line", "refund", "payment"],
    {
      order: ["version"],
      refund: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "order-id",
        "request-key",
        "amount",
        "lines",
        "state",
      ],
    },
    [
      "Authorized order/line CAS; fulfilled units only within shipment+[0,30days). Sum settled plus pending/unknown refunds immediately under locks; no client amount.",
    ],
    [
      "Per-unit merchandise+allocated tax2149; cumulative6447 maximum excludes shipping500. Reserve quantities with orderv6→v7→v8; inspection required before restock. Persist refund:1151 before external dispatch; unknown lookup settles once, never new key. Same command always replays original202 even after async changes.",
    ],
    { creates: ["refund"], hook: "returns" },
  ),
  "seller-settlement": commerce(
    "settlement-plan",
    "settlement",
    ["seller", "seller-line", "order", "payment"],
    {
      settlement: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "seller-id",
        "request-key",
        "amount",
        "fee",
        "state",
      ],
    },
    [
      "Current same-shop seller; only attributed immutable lines, selected half-open UTC window and seller expectedVersion fences the current seller/fee snapshot; read the paid order and attribution under their current locks.",
    ],
    [
      "Gross5997, fee10% half-up600, net5397 distinct from charge6947. Unique seller/order/window/policy entitlement; returns adjust next open window. Provisional plan/closing preserves payout:1161; unknown reconciliation cannot issue another payout or expose another seller/address.",
    ],
    { creates: ["settlement"], hook: "marketplace" },
  ),
  "convert-currency": commerce(
    "currency-quote",
    "cart",
    ["cart-line", "rate"],
    {},
    [
      "Current owner/cart CAS; trusted original USD, immutable positive rational version/expiry and EUR selection only.",
    ],
    [
      "Exact intermediates with final safe bound;1999*92/100→1839; half-even5/2→2,7/2→4. Never convert already converted inputs or reinterpret completed order; pure no writes.",
    ],
    { hook: "currency" },
  ),
  "stripe-payment": commerce(
    "payment-start",
    "order",
    ["payment", "reservation", "stock"],
    {
      payment: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "order-id",
        "provider",
        "request-key",
        "amount",
        "state",
        "provider-id",
      ],
      order: ["version"],
      reservation: ["state", "version"],
    },
    holdPre,
    [
      ...holdPost,
      "Required JH-provider readiness before hold; pinned Stripe2025-03-31.basil automatic card capture, configured account/test mode, USD50..99999999. Reference-v1 evidence cannot satisfy this seam.",
    ],
    { creates: ["payment"], hook: "provider" },
  ),
  "stripe-callback": commerce(
    "payment-callback",
    "payment",
    ["order", "reservation", "stock", "provider-event"],
    {
      payment: ["state", "provider-id", "version"],
      order: ["state", "version"],
      reservation: ["state", "version"],
      stock: ["allocated", "version"],
      "provider-event": [
        "id",
        "scope-id",
        "created-at",
        "version",
        "payment-id",
        "provider",
        "event-id",
        "original-sha256",
        "at",
      ],
    },
    [
      ...settlePre,
      "Stripe signature t/v1 original-byte framing; pinned API version/account/livemode:false and intent metadata binding; succeeded requires matching amount_received. Type/status mismatch403, unknown type400. Current intent lookup before releasing any failure.",
    ],
    settlePost,
    { creates: ["provider-event"], external: "verified-source-before-sql" },
  ),
  "sync-inventory": commerce(
    "warehouse-apply",
    "inventory-mapping",
    ["stock", "reservation", "order", "source-receipt"],
    {
      reconciliation: [
        "id",
        "scope-id",
        "created-at",
        "version",
        "target-id",
        "identity",
        "kind",
        "state",
        "content-hash",
      ],
      stock: ["on-hand", "version"],
      "inventory-mapping": ["last-revision", "version"],
      "source-receipt": [
        "id",
        "scope-id",
        "created-at",
        "version",
        "mapping-id",
        "event-id",
        "revision",
        "state",
      ],
    },
    [
      "Authenticate original warehouse bytes/signature/timestamp before parsing and hook; configured warehouse-v1 source/shop/SKU/mappingVersion only. ERP-BLUE maps variant205, never arbitrary delta.",
    ],
    [
      "Absolute onHand >=active+held+allocated only; conflict leaves stock unchanged with one reconciliation/receipt and advances watermark. Revision11→30; old9 no receipt; conflicting12→0 reconciles; interrupted13 retries→31 with held1/availability27, receipts11/12/13. Same revision changed content409. No tombstone inferred.",
    ],
    {
      creates: ["source-receipt", "reconciliation"],
      hook: "inventory-sync",
      external: "verified-source-before-sql",
    },
  ),
};
// The order-line root is an explicit checkout participant even though it is never selected by body identity.
vendureCoreRecipes.checkout!.records.push("order-line");
