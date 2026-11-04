/** Five expected C4 journeys over existing relationships; no execution evidence. */
import type { ArchitectureScenario } from "./scenarios.ts";
export const vendureCoreScenarios: ArchitectureScenario[] = [
  {
    id: "v-last-item",
    name: "V-last-item",
    scope: {
      level: "containers",
    },
    actor: "vc-customer",
    startCondition:
      "Reset common seed. Authenticate, enforce catalog/quote/cart authority, then serialize two last-item checkouts. Hook examples are independent contracts, never observed runtime success.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "vc-client-api",
        },
        text: "Authenticate current shop, restrict catalog/assets and validate cart CAS. Quote from trusted price/address snapshots.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Lock cart/order/reservations then stock UUID ascending. Recheck quote versions/expiry and availability; one last-item winner.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Commit cart conversion/order/lines/reservations/history/audit/receipt/event intent together. Failure rolls back the whole local set.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "vc-client-api",
        },
        text: "Same key replays original result before stale-version checks. Changed input conflicts. H promotion/tax/shipping retain exact bounded snapshots.",
      },
    ],
    mainOutcomes: [
      "v01-customer-admin-sessions",
      "v01-session-restart",
      "v01-role-shop-forgery",
      "v02-published-catalog",
      "v02-unpublished-assets",
      "v02-publication-retry",
      "v03-exact-arithmetic",
      "v03-money-bounds",
      "v04-cart-authority",
      "v04-cart-mutations",
      "v04-cart-retry-version",
      "v06-last-item-race",
      "v05-checkout-snapshot",
      "v13-promotion-allocation",
      "v13-promotion-recalculation",
      "v13-promotion-bounds",
      "v14-tax-quote-provenance",
      "v14-tax-input-authority",
      "v15-shipping-selection",
      "v15-shipping-authority",
      "v18-currency-snapshot",
      "v18-rate-unavailable-retry",
      "v18-currency-reinterpretation",
      "v14-tax-unavailable",
      "v15-shipping-unavailable",
    ],
    outcomes: [
      {
        id: "v01-customer-admin-sessions",
        text: "Customer and administrator sessions allow their declared shop actions and survive the specified session lifecycle.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v01-session-restart",
        text: "Restart/replay preserves valid sessions without resurrecting logged-out sessions or sharing another application's authority.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v01-role-shop-forgery",
        text: "A customer cannot invoke catalog/admin mutations or forge a trusted shop scope.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v02-published-catalog",
        text: "Published products/variants are available through bounded catalog queries with their allowed assets.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v02-unpublished-assets",
        text: "Unpublished products, variants and related assets remain absent from public detail/list responses.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v02-publication-retry",
        text: "Stale/repeated publication commands and delayed projections cannot duplicate variants or disclose unpublished data.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v03-exact-arithmetic",
        text: "Fixed-price quote calculation uses exact integer minor units, immutable inputs and consistent currency with exact inspected totals.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v03-money-bounds",
        text: "Mixed currency, invalid quantities and overflow are rejected before any inexact arithmetic or state mutation.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v04-cart-authority",
        text: "Client-supplied prices have no authority; foreign carts, invalid quantities and excessive lines are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v04-cart-mutations",
        text: "Add/change/remove commands maintain bounded cart lines and the declared versioned quote.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v04-cart-retry-version",
        text: "Duplicate keys do not double quantity; stale concurrent cart updates conflict without partial changes.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v06-last-item-race",
        text: "Concurrent last-item checkouts produce at most one successful order/reservation, no negative availability and no orphan successful order.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v05-checkout-snapshot",
        text: "Checkout creates one immutable line/address/price snapshot order and corresponding reservations.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v13-promotion-allocation",
        text: "The selected strategy applies eligibility, exclusions, caps and deterministic rounded allocations in the declared order.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v13-promotion-recalculation",
        text: "Repeated recalculation over the same immutable inputs returns the same allocated adjustments without accumulation.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v13-promotion-bounds",
        text: "Ineligible/unauthorized promotion input, excessive adjustments and totals violating invariants are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v14-tax-quote-provenance",
        text: "Production tax adapter returns an immutable typed quote with amount, policy/provider provenance and expiry.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v14-tax-input-authority",
        text: "Forged jurisdiction, currency, expired quote or unauthorized override cannot become an authoritative tax amount.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v15-shipping-selection",
        text: "Declared package/address/cart inputs yield bounded eligible carrier/service quotes with expiry.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v15-shipping-authority",
        text: "Untrusted price overrides, incompatible services and expired quotes are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v18-currency-snapshot",
        text: "Conversion uses snapshotted rates/provenance and deterministic rounding into the requested currency.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v18-rate-unavailable-retry",
        text: "Unavailable rates remain explicit; retry cannot rewrite a completed snapshot or apply conversion twice.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v18-currency-reinterpretation",
        text: "Unknown currency, stale/invalid rates and attempts to reinterpret completed order money are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v14-tax-unavailable",
        text: "Timeout/unavailable provider returns an explicit outcome and cannot create a checkout using invented tax success.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v15-shipping-unavailable",
        text: "Unavailable carrier/rate provider is explicit and cannot silently complete checkout with an invented quote.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "v-repeat",
    name: "V-repeat",
    scope: {
      level: "containers",
    },
    actor: "vc-customer",
    startCondition:
      "Reset seed. Checkout rollback and response loss, canonical replay/current authorization, immutable prices/addresses, private order surfaces and current publication across cursors/rebuild.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "vc-client-api",
        },
        text: "Same SQL checkout rollback leaves cart/order/lines/reservations/receipt/intent unchanged. Lost committed response replays original identity before stale-version checks.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "vc-worker-db",
        },
        text: "Current publication overrides stale search projection. Rebuild bounded exact sources without leaking cost/stock/address.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Revoked recipient gets redacted empty inbox; metadata-only history/audit retains current owner/staff and administrator boundaries.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "vc-api-payment",
        },
        text: "H Stripe status/account/mode/version/amount guards preserve unknown and holds; V08 reference evidence cannot satisfy H19.",
      },
      {
        id: "step-5",
        relationship: {
          kind: "connection",
          id: "vc-client-api",
        },
        text: "H currency starts from immutable USD and exact rational version, half-even rounding; completed order amounts never reinterpret.",
      },
    ],
    mainOutcomes: [
      "v05-checkout-atomicity",
      "v05-checkout-snapshot",
      "v05-changed-quote-version",
      "v03-exact-arithmetic",
      "v11-order-owner-staff",
      "v11-direct-isolation",
      "v11-download-isolation",
      "v11-list-isolation",
      "v10-catalog-search-pages",
      "v10-search-private-fields",
      "v10-search-rebuild",
    ],
    outcomes: [
      {
        id: "v05-checkout-atomicity",
        text: "Injected failure between order/line/reservation writes rolls all participants back; committed response-loss retry returns one order.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v05-checkout-snapshot",
        text: "Checkout creates one immutable line/address/price snapshot order and corresponding reservations.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v05-changed-quote-version",
        text: "Changed quote/version or unauthorized checkout conflicts/rejects without a partial order or reservation.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v03-exact-arithmetic",
        text: "Fixed-price quote calculation uses exact integer minor units, immutable inputs and consistent currency with exact inspected totals.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v11-order-owner-staff",
        text: "Order owners and appropriately scoped staff can observe the declared order/history/download surfaces.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v11-direct-isolation",
        text: "Another customer or scope cannot observe a direct order/history identity or privileged staff action.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v11-download-isolation",
        text: "Downloads and related assets enforce the same order ownership boundary.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v11-list-isolation",
        text: "Lists/pages/counts contain no other customer's order or private history.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v10-catalog-search-pages",
        text: "Published catalog search uses stable bounded pages and returns only its declared public projection.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v10-search-private-fields",
        text: "Hidden prices, unpublished data and stock internals are absent from results/snippets/counts.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v10-search-rebuild",
        text: "Projection rebuild/retry retains stable identities and current publication filtering without resurrecting hidden records.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "v-unknown",
    name: "V-unknown",
    scope: {
      level: "containers",
    },
    actor: "vc-customer",
    startCondition:
      "Reset seed. Reference provider accepts then loses response. Hold stock and reconcile one durable attempt; callbacks authenticate original bytes and reject foreign bindings. Stripe adapter examples remain independent unrun concrete-provider contracts.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Persist attempt v1, order v2 and held reservation v2 before any dispatch. Submit v2; lost response records unknown v3 and review v3.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "vc-api-payment",
        },
        text: "Use persisted provider/request identity outside SQL; no received provider ID is invented after response loss.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "vc-payment-api",
        },
        text: "Authenticate original bytes before parse, bind persisted amount/scope/order/attempt and authoritative lookup when provider ID is absent.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Settle payment/order v4, consume reservation v3, allocate stock and write event receipt/history/audit/intent once. Old failure is a no-op receipt.",
      },
    ],
    mainOutcomes: [
      "v08-reference-payment",
      "v08-unknown-outcome",
      "v07-transition-guards",
      "v06-held-payment-expiry",
      "v08-callback-authentication",
      "v11-callback-isolation",
      "v08-callback-order-deduplication",
      "v19-real-provider-adapter",
      "v19-real-provider-reconciliation",
      "v19-real-provider-authentication",
    ],
    outcomes: [
      {
        id: "v08-reference-payment",
        text: "The local reference provider protocol settles a valid payment with its durable request identity and typed amount.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v08-unknown-outcome",
        text: "Accepted-but-timed-out charge remains unknown with order payment-review and stock held until signed settlement/reconciliation resolves it once.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v07-transition-guards",
        text: "Invalid/stale actions cannot mark an unpaid order paid or shipped, or bypass cancellation guards.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v06-held-payment-expiry",
        text: "Held-for-payment stock cannot be blindly expired/released or used for another checkout.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v08-callback-authentication",
        text: "Unsigned, invalid-signature or foreign callbacks change no payment/order state.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v11-callback-isolation",
        text: "Delayed/foreign callbacks cannot mutate or disclose another customer's order under a forged ownership/scope reference.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v08-callback-order-deduplication",
        text: "Duplicate/out-of-order callbacks cannot duplicate settlement or let an older failure undo a settled payment.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v19-real-provider-adapter",
        text: "A named concrete payment provider adapter verifies signature, amount/status and durable idempotency mapping with provider provenance.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v19-real-provider-reconciliation",
        text: "Concrete provider timeout/duplicates/reordering map to pending/unknown and reconciliation without invented success or duplicate charge.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v19-real-provider-authentication",
        text: "Invalid real-provider signatures, foreign events and amount/status mismatches cannot settle an order.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "v-expire",
    name: "V-expire",
    scope: {
      level: "containers",
    },
    actor: "vc-customer",
    startCondition:
      "Reset seed. Explicit active release/cancellation; payment obtains the stock lock before deadline, expiry wins the other aggregate after deadline. Crash/restart expires once. ERP sync preserves outstanding stock commitments.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "vc-worker-db",
        },
        text: "Claim due reservation with fencing token; lock current order/reservations then stock UUID ascending and recheck state/version/deadline.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Only active awaiting-payment reservations expire/release. Held/consumed are never released by a clock; race with start-payment has one serialized winner.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "vc-warehouse-api",
        },
        text: "Authenticate warehouse original bytes and exact persisted mapping; monotone revision/receipt applies absolute onHand only above active+held+allocated.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Conflicting revision leaves stock unchanged and records one reconciliation. Interruption retries the same source revision; stale versions have no receipt.",
      },
    ],
    mainOutcomes: [
      "v06-reservation-release-expire",
      "v07-order-lifecycle",
      "v07-order-transition-retry",
      "v07-transition-guards",
      "v09-quantity-ceiling",
      "v06-expiration-payment-race",
      "v20-inventory-source-mapping",
      "v20-connector-revision-recovery",
      "v20-connector-authority",
    ],
    outcomes: [
      {
        id: "v06-reservation-release-expire",
        text: "Active reservations reduce sellable stock and authorized release/expiration restores it once.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v07-order-lifecycle",
        text: "Paid/cancelled/fulfillment lifecycle actions follow the declared allowed transitions and guards.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v07-order-transition-retry",
        text: "Repeated/racing lifecycle commands do not apply contradictory terminal states or duplicate effects.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v07-transition-guards",
        text: "Invalid/stale actions cannot mark an unpaid order paid or shipped, or bypass cancellation guards.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v09-quantity-ceiling",
        text: "No shipment exceeds paid, reserved and remaining unfulfilled quantities, including competing shipments.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v06-expiration-payment-race",
        text: "Restarted expiration and concurrent start-payment choose one valid state transition without charging against expired stock.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v20-inventory-source-mapping",
        text: "A validated inventory/ERP source revision maps to the declared local command with explicit authority.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v20-connector-revision-recovery",
        text: "Duplicate/out-of-order source revisions and interrupted sync preserve one effect and an inspectable recovery item.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v20-connector-authority",
        text: "Unauthenticated source, foreign stock identity and conflicting authority are rejected or explicitly reconciled.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
    ],
    alternatives: [],
  },
  {
    id: "v-ship",
    name: "V-ship",
    scope: {
      level: "containers",
    },
    actor: "vc-customer",
    startCondition:
      "Reset seed. Ship paid quantity 3 as 2 then 1 with cumulative quantity/CAS guards and replay. Recover one internal notification; inspect returns/refund and seller payout uncertainty independently.",
    steps: [
      {
        id: "step-1",
        relationship: {
          kind: "connection",
          id: "vc-client-api",
        },
        text: "Require current fulfillment/admin, order CAS and settled payment. Sum every committed shipment under the same locks.",
      },
      {
        id: "step-2",
        relationship: {
          kind: "connection",
          id: "vc-api-db",
        },
        text: "Ship positive quantities bounded by purchased/paid/allocated/unshipped units. Decrement onHand and allocated together, retain purchased snapshot.",
      },
      {
        id: "step-3",
        relationship: {
          kind: "connection",
          id: "vc-worker-db",
        },
        text: "Materialize eligible owner notification and worker receipt together, crash before ack, reclaim/fence and deduplicate.",
      },
      {
        id: "step-4",
        relationship: {
          kind: "connection",
          id: "vc-worker-email",
        },
        text: "Recheck persisted recipient membership and ownership before send; external delivery uncertainty never rolls back shipment.",
      },
      {
        id: "step-5",
        relationship: {
          kind: "connection",
          id: "vc-api-payment",
        },
        text: "H refund/payout reserve cumulative ceilings and durable identity before dispatch. Unknown reconciles original identity, no duplicate financial request.",
      },
    ],
    mainOutcomes: [
      "v09-partial-shipment",
      "v09-quantity-ceiling",
      "v09-shipment-retry",
      "v11-direct-isolation",
      "v07-order-lifecycle",
      "v07-transition-guards",
      "v12-transition-audit-notification",
      "v12-notification-redaction",
      "v12-internal-effect-retry",
      "v16-partial-return-refund",
      "v16-refund-uncertainty",
      "v16-refund-ceilings",
      "v17-seller-settlement",
      "v17-seller-isolation",
      "v17-settlement-recovery",
    ],
    outcomes: [
      {
        id: "v09-partial-shipment",
        text: "An authorized paid order can ship a partial quantity and then the remainder to reach fulfilled.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v09-quantity-ceiling",
        text: "No shipment exceeds paid, reserved and remaining unfulfilled quantities, including competing shipments.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v09-shipment-retry",
        text: "Same-key shipment retry returns the original shipment and does not duplicate quantity or effects.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v11-direct-isolation",
        text: "Another customer or scope cannot observe a direct order/history identity or privileged staff action.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v07-order-lifecycle",
        text: "Paid/cancelled/fulfillment lifecycle actions follow the declared allowed transitions and guards.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v07-transition-guards",
        text: "Invalid/stale actions cannot mark an unpaid order paid or shipped, or bypass cancellation guards.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v12-transition-audit-notification",
        text: "Order/payment/fulfillment transitions produce immutable actor audit and durable eligible notifications.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v12-notification-redaction",
        text: "Another customer's details and unauthorized projections never appear in audit reads or notifications.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v12-internal-effect-retry",
        text: "Worker crash/retry preserves one logical internal effect and rechecks eligibility before sensitive materialization.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v16-partial-return-refund",
        text: "Authorized return/refund follows policy over paid, fulfilled and already-refunded quantities/amounts.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v16-refund-uncertainty",
        text: "Duplicate request and uncertain provider result preserve one durable refund identity and explicit reconciliation.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v16-refund-ceilings",
        text: "Excess quantity/amount, foreign orders and forbidden state transitions are rejected.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v17-seller-settlement",
        text: "Attribution produces the declared seller entitlement/settlement plan distinct from customer payment.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v17-seller-isolation",
        text: "One seller cannot read or mutate another seller's attribution, payout or ledger scope.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
      {
        id: "v17-settlement-recovery",
        text: "Repeated/interrupted settlement uses stable identities and reconciliation without double entitlement or direct cross-seller mutation.",
        invariants: [
          "Expected observation only; application absent/not run. Fixed oracle: benchmarks/vendure-core/v1/fixtures.json.",
        ],
        requirements: [],
        decisions: ["vc-design-gate"],
      },
    ],
    alternatives: [],
  },
];
