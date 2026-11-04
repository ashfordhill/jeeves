/** Frozen ledger trace: design obligations, never test results. */
export const vendureCoreTrace = [
  {
    id: "V01",
    weight: 5,
    target: "G",
    source: "vd-auth",
    supportingSources: ["vd-shop-order", "vd-admin-order"],
    decisions: ["JV-protocol", "JV-scope"],
    adaptation:
      "Existing Jeeves authenticated sessions/role separation and restart-safe revocation replace upstream anonymous-owner sessions and configurable auth shortcuts. The guard is context, not a complete credential/session protocol audit.",
    observations: [
      {
        id: "V01-customer-admin-sessions",
        caseId: "V01",
        category: "success",
        expected:
          "Customer and administrator sessions allow their declared shop actions and survive the specified session lifecycle.",
        critical: false,
        operations: ["getSession", "login", "logout", "register"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-register-customer",
              "step-login-customer",
              "step-login-admin",
              "step-session-before-restart",
              "step-logout",
              "step-login-again",
            ],
          },
        ],
      },
      {
        id: "V01-role-shop-forgery",
        caseId: "V01",
        category: "rejection",
        expected: "A customer cannot invoke catalog/admin mutations or forge a trusted shop scope.",
        critical: false,
        operations: ["putProduct", "register"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-register-forged-role",
              "step-customer-admin-write",
              "step-foreign-shop-write",
            ],
          },
        ],
      },
      {
        id: "V01-session-restart",
        caseId: "V01",
        category: "failure",
        expected:
          "Restart/replay preserves valid sessions without resurrecting logged-out sessions or sharing another application's authority.",
        critical: false,
        operations: ["getSession"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-session-after-restart", "step-logged-out", "step-foreign-app-cookie"],
          },
        ],
      },
    ],
  },
  {
    id: "V02",
    weight: 5,
    target: "G",
    source: "vd-catalog",
    supportingSources: ["vd-auth", "vd-search"],
    decisions: ["JV-scope", "JV-query", "JV-command"],
    adaptation:
      "Keep enabled product inspiration while specifying bounded queries and authoritative product/variant/asset publication on all reads and delayed projections. Asset-byte/publication-command internals were not audited.",
    observations: [
      {
        id: "V02-published-catalog",
        caseId: "V02",
        category: "success",
        expected:
          "Published products/variants are available through bounded catalog queries with their allowed assets.",
        critical: false,
        operations: ["getAsset", "getProduct", "listCatalog", "putProduct", "putVariant"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-catalog-page-one",
              "step-public-product",
              "step-public-asset",
              "step-rename-product",
              "step-update-variant",
            ],
          },
        ],
      },
      {
        id: "V02-unpublished-assets",
        caseId: "V02",
        category: "rejection",
        expected:
          "Unpublished products, variants and related assets remain absent from public detail/list responses.",
        critical: false,
        operations: ["getAsset", "getProduct", "listCatalog"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-catalog-page-two",
              "step-hidden-product",
              "step-hidden-asset",
              "step-visible-product-hidden-variant",
              "step-hidden-variant-asset",
            ],
          },
        ],
      },
      {
        id: "V02-publication-retry",
        caseId: "V02",
        category: "failure",
        expected:
          "Stale/repeated publication commands and delayed projections cannot duplicate variants or disclose unpublished data.",
        critical: false,
        operations: ["getAsset", "publish", "putVariant"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-unpublish",
              "step-unpublish-replay",
              "step-publication-stale",
              "step-unpublished-old-asset",
              "step-republish",
              "step-variant-publication",
              "step-variant-publication-replay",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V03",
    weight: 6,
    target: "G",
    source: "vd-calculator",
    supportingSources: ["vd-round", "vd-payment-handler"],
    decisions: ["JV-money"],
    adaptation:
      "Upstream sequences taxes/promotions/shipping and delegates rounding; it does not establish checked safe-integer arithmetic, immutable inputs, fixed USD fixture bounds or overflow rejection. Implement and verify those independently.",
    observations: [
      {
        id: "V03-exact-arithmetic",
        caseId: "V03",
        category: "success",
        expected:
          "Fixed-price quote calculation uses exact integer minor units, immutable inputs and consistent currency with exact inspected totals.",
        critical: true,
        operations: ["quote", "setPrice"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-exact-quote"],
          },
          {
            id: "V-repeat",
            steps: ["step-change-price", "step-refresh-quote"],
          },
        ],
      },
      {
        id: "V03-money-bounds",
        caseId: "V03",
        category: "rejection",
        expected:
          "Mixed currency, invalid quantities and overflow are rejected before any inexact arithmetic or state mutation.",
        critical: true,
        operations: ["addLine", "quote", "setPrice"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-quote-overflow",
              "step-mixed-currency",
              "step-fractional-minor",
              "step-unsafe-minor",
              "step-zero-quantity",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V04",
    weight: 7,
    target: "G",
    source: "vd-order",
    supportingSources: ["vd-shop-order"],
    decisions: ["JV-money", "JV-scope", "JV-command"],
    adaptation:
      "Cart add/change/remove use server-authoritative prices and finite line/quantity limits. Add atomic expectedVersion and scoped canonical replay receipts; upstream partial quantity correction/error results are not the frozen all-or-conflict protocol.",
    observations: [
      {
        id: "V04-cart-mutations",
        caseId: "V04",
        category: "success",
        expected:
          "Add/change/remove commands maintain bounded cart lines and the declared versioned quote.",
        critical: false,
        operations: ["addLine", "createCart", "removeLine"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-create-cart", "step-add-cart-line", "step-remove-line"],
          },
        ],
      },
      {
        id: "V04-cart-authority",
        caseId: "V04",
        category: "rejection",
        expected:
          "Client-supplied prices have no authority; foreign carts, invalid quantities and excessive lines are rejected.",
        critical: false,
        operations: ["addLine", "getCart"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-zero-quantity",
              "step-forged-price",
              "step-foreign-cart",
              "step-too-many-lines",
            ],
          },
        ],
      },
      {
        id: "V04-cart-retry-version",
        caseId: "V04",
        category: "failure",
        expected:
          "Duplicate keys do not double quantity; stale concurrent cart updates conflict without partial changes.",
        critical: false,
        operations: ["addLine", "changeLine"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-add-line-replay", "parallel-cart-edit-winner"],
          },
        ],
      },
    ],
  },
  {
    id: "V05",
    weight: 6,
    target: "G",
    source: "vd-order",
    supportingSources: ["vd-order-process", "vd-allocation"],
    decisions: ["JV-checkout", "JV-command", "JV-money", "JV-inventory"],
    adaptation:
      "Convert cart to one immutable line/address/price snapshot plus reservations in one transaction. Upstream creates an Order before payment and recalculates prices; no same-key checkout or failure-injection atomicity is inferred.",
    observations: [
      {
        id: "V05-checkout-snapshot",
        caseId: "V05",
        category: "success",
        expected:
          "Checkout creates one immutable line/address/price snapshot order and corresponding reservations.",
        critical: false,
        operations: ["checkout", "getOrder"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["parallel-last-item-alice"],
          },
          {
            id: "V-repeat",
            steps: ["step-checkout-replay", "step-immutable-order"],
          },
        ],
      },
      {
        id: "V05-changed-quote-version",
        caseId: "V05",
        category: "rejection",
        expected:
          "Changed quote/version or unauthorized checkout conflicts/rejects without a partial order or reservation.",
        critical: false,
        operations: ["checkout"],
        scenarios: [
          {
            id: "V-repeat",
            steps: [
              "step-checkout-changed-quantity",
              "step-quote-changed-price",
              "step-checkout-stale-cart",
              "step-checkout-foreign",
            ],
          },
        ],
      },
      {
        id: "V05-checkout-atomicity",
        caseId: "V05",
        category: "failure",
        expected:
          "Injected failure between order/line/reservation writes rolls all participants back; committed response-loss retry returns one order.",
        critical: true,
        operations: ["checkout"],
        scenarios: [
          {
            id: "V-repeat",
            steps: [
              "step-checkout-rollback",
              "control-8",
              "step-checkout-lost",
              "step-checkout-replay",
              "control-10",
              "parallel-checkout-owner",
              "step-checkout-follower-retry",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V06",
    weight: 6,
    target: "G",
    source: "vd-allocation",
    supportingSources: [
      "vd-order-process",
      "vd-stock-movement",
      "vd-stock-level",
      "vd-sql-job",
      "vd-polling",
    ],
    decisions: ["JV-inventory", "JV-command", "JV-payment", "JV-effects"],
    adaptation:
      "Default upstream allocation occurs after payment authorization/settlement, not a benchmark checkout reservation with expiry. Prove last-item locking, held-payment protection and expiration/start-payment restart race independently; read/update stock excerpts do not establish no-oversell.",
    observations: [
      {
        id: "V06-reservation-release-expire",
        caseId: "V06",
        category: "success",
        expected:
          "Active reservations reduce sellable stock and authorized release/expiration restores it once.",
        critical: false,
        operations: ["releaseReservation"],
        scenarios: [
          {
            id: "V-expire",
            steps: ["step-release-active", "step-release-replay", "control-37", "control-41"],
          },
        ],
      },
      {
        id: "V06-held-payment-expiry",
        caseId: "V06",
        category: "rejection",
        expected:
          "Held-for-payment stock cannot be blindly expired/released or used for another checkout.",
        critical: false,
        operations: ["checkout", "releaseReservation", "transitionOrder"],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-cancel-unknown",
              "step-release-held",
              "control-23",
              "step-checkout-held-unit",
              "control-25",
            ],
          },
        ],
      },
      {
        id: "V06-last-item-race",
        caseId: "V06",
        category: "failure",
        expected:
          "Concurrent last-item checkouts produce at most one successful order/reservation, no negative availability and no orphan successful order.",
        critical: true,
        operations: ["checkout"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["parallel-last-item-alice", "control-6"],
          },
        ],
      },
      {
        id: "V06-expiration-payment-race",
        caseId: "V06",
        category: "failure",
        expected:
          "Restarted expiration and concurrent start-payment choose one valid state transition without charging against expired stock.",
        critical: false,
        operations: ["startPayment"],
        scenarios: [
          {
            id: "V-expire",
            steps: [
              "step-payment-wins",
              "step-expiry-wins",
              "step-expired-current-version",
              "control-45",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V07",
    weight: 5,
    target: "G",
    source: "vd-order-process",
    supportingSources: ["vd-order", "vd-payment-process"],
    decisions: ["JV-command", "JV-payment", "JV-fulfillment"],
    adaptation:
      "Adopt explicit transition/guard responsibility but freeze the smaller benchmark state graph with expected versions. Payment state/fulfillment cannot be forged; repeated/stale commands and cancellation recheck guards and change no contradictory terminal state.",
    observations: [
      {
        id: "V07-order-lifecycle",
        caseId: "V07",
        category: "success",
        expected:
          "Paid/cancelled/fulfillment lifecycle actions follow the declared allowed transitions and guards.",
        critical: false,
        operations: ["getOrder", "transitionOrder"],
        scenarios: [
          {
            id: "V-expire",
            steps: ["step-cancel-awaiting"],
          },
          {
            id: "V-ship",
            steps: ["step-partial-order", "step-fulfilled-order"],
          },
        ],
      },
      {
        id: "V07-transition-guards",
        caseId: "V07",
        category: "rejection",
        expected:
          "Invalid/stale actions cannot mark an unpaid order paid or shipped, or bypass cancellation guards.",
        critical: true,
        operations: ["createShipment", "transitionOrder"],
        scenarios: [
          {
            id: "V-unknown",
            steps: ["step-cancel-unknown"],
          },
          {
            id: "V-expire",
            steps: ["step-forge-paid", "step-forge-shipped", "step-ship-unpaid"],
          },
          {
            id: "V-ship",
            steps: ["step-cancel-fulfilled"],
          },
        ],
      },
      {
        id: "V07-order-transition-retry",
        caseId: "V07",
        category: "failure",
        expected:
          "Repeated/racing lifecycle commands do not apply contradictory terminal states or duplicate effects.",
        critical: false,
        operations: ["transitionOrder"],
        scenarios: [
          {
            id: "V-expire",
            steps: ["step-cancel-replay", "step-cancel-stale"],
          },
        ],
      },
    ],
  },
  {
    id: "V08",
    weight: 6,
    target: "G",
    source: "vd-payment",
    supportingSources: ["vd-shop-order", "vd-payment-process", "vd-payment-handler", "vd-event"],
    decisions: ["JV-payment", "JV-command", "JV-inventory", "JV-effects"],
    adaptation:
      "Use a durable reference-provider protocol and authenticated raw-byte callbacks with event receipts. The handler is awaited before payment persistence; this does not supply unknown outcome/reconciliation or cross-network atomicity. Hold stock and prevent stale failure from reversing settlement.",
    observations: [
      {
        id: "V08-reference-payment",
        caseId: "V08",
        category: "success",
        expected:
          "The local reference provider protocol settles a valid payment with its durable request identity and typed amount.",
        critical: false,
        operations: ["reconcilePayment", "referenceCallback", "startPayment"],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-start-unknown",
              "step-signed-settlement",
              "step-start-reconcile",
              "step-reconcile-settled",
            ],
          },
        ],
      },
      {
        id: "V08-callback-authentication",
        caseId: "V08",
        category: "rejection",
        expected: "Unsigned, invalid-signature or foreign callbacks change no payment/order state.",
        critical: true,
        operations: ["referenceCallback"],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-unsigned-callback",
              "step-invalid-callback",
              "step-modified-callback",
              "step-expired-callback",
              "step-foreign-scope-callback",
              "step-wrong-amount-callback",
              "step-wrong-provider-callback",
              "control-26",
            ],
          },
        ],
      },
      {
        id: "V08-unknown-outcome",
        caseId: "V08",
        category: "failure",
        expected:
          "Accepted-but-timed-out charge remains unknown with order payment-review and stock held until signed settlement/reconciliation resolves it once.",
        critical: true,
        operations: [
          "getOrder",
          "getPayment",
          "reconcilePayment",
          "referenceCallback",
          "startPayment",
        ],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-observe-unknown",
              "step-review-order",
              "control-21",
              "step-unknown-new-key",
              "step-signed-settlement",
              "control-27",
              "step-reconcile-pending",
              "step-reconcile-settled",
            ],
          },
        ],
      },
      {
        id: "V08-callback-order-deduplication",
        caseId: "V08",
        category: "failure",
        expected:
          "Duplicate/out-of-order callbacks cannot duplicate settlement or let an older failure undo a settled payment.",
        critical: false,
        operations: ["reconcilePayment", "referenceCallback"],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-signed-settlement",
              "step-duplicate-settlement",
              "step-older-failure",
              "control-27",
              "step-reconcile-replay",
              "step-callback-after-reconciliation",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V09",
    weight: 5,
    target: "G",
    source: "vd-order",
    supportingSources: ["vd-fulfillment", "vd-admin-order", "vd-stock-movement"],
    decisions: ["JV-fulfillment", "JV-command", "JV-scope"],
    adaptation:
      "Jeeves must sum every active shipment and serialize competing changes under paid/reserved ceilings. The inspected upstream helper finds a matching fulfillment line; this is not a cumulative concurrent-ceiling proof or a shipment retry receipt.",
    observations: [
      {
        id: "V09-partial-shipment",
        caseId: "V09",
        category: "success",
        expected:
          "An authorized paid order can ship a partial quantity and then the remainder to reach fulfilled.",
        critical: false,
        operations: ["createShipment", "getOrder"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["parallel-ship-two", "step-ship-one", "step-fulfilled-order"],
          },
        ],
      },
      {
        id: "V09-quantity-ceiling",
        caseId: "V09",
        category: "rejection",
        expected:
          "No shipment exceeds paid, reserved and remaining unfulfilled quantities, including competing shipments.",
        critical: true,
        operations: ["createShipment"],
        scenarios: [
          {
            id: "V-expire",
            steps: ["step-ship-unpaid"],
          },
          {
            id: "V-ship",
            steps: ["parallel-ship-two", "step-ship-two-over-ceiling", "control-53"],
          },
        ],
      },
      {
        id: "V09-shipment-retry",
        caseId: "V09",
        category: "failure",
        expected:
          "Same-key shipment retry returns the original shipment and does not duplicate quantity or effects.",
        critical: false,
        operations: ["createShipment", "listShipments"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-ship-two-replay", "step-shipment-list", "control-53"],
          },
        ],
      },
    ],
  },
  {
    id: "V10",
    weight: 5,
    target: "G",
    source: "vd-search",
    supportingSources: ["vd-search-index", "vd-catalog"],
    decisions: ["JV-query", "JV-effects"],
    adaptation:
      "Use published-only scoped public projections and stable bounded keyset pages. Upstream has offset/limit, a deterministic variant-ID tie-break and queued rebuilds; optional enabled filtering and projections alone do not establish immediate hiding or private-field exclusion.",
    observations: [
      {
        id: "V10-catalog-search-pages",
        caseId: "V10",
        category: "success",
        expected:
          "Published catalog search uses stable bounded pages and returns only its declared public projection.",
        critical: false,
        operations: ["search"],
        scenarios: [
          {
            id: "V-repeat",
            steps: ["step-search-page-one", "step-search-page-two"],
          },
        ],
      },
      {
        id: "V10-search-private-fields",
        caseId: "V10",
        category: "rejection",
        expected:
          "Hidden prices, unpublished data and stock internals are absent from results/snippets/counts.",
        critical: false,
        operations: ["search"],
        scenarios: [
          {
            id: "V-repeat",
            steps: [
              "step-search-page-two",
              "step-search-tampered",
              "step-search-query-changed",
              "step-search-foreign-cursor",
              "control-18",
            ],
          },
        ],
      },
      {
        id: "V10-search-rebuild",
        caseId: "V10",
        category: "failure",
        expected:
          "Projection rebuild/retry retains stable identities and current publication filtering without resurrecting hidden records.",
        critical: false,
        operations: ["search"],
        scenarios: [
          {
            id: "V-repeat",
            steps: ["step-search-after-rebuild", "step-search-rebuilt-again"],
          },
        ],
      },
    ],
  },
  {
    id: "V11",
    weight: 5,
    target: "G",
    source: "vd-shop-order",
    supportingSources: ["vd-auth", "vd-admin-order"],
    decisions: ["JV-scope", "JV-query", "JV-payment"],
    adaptation:
      "Unify customer ownership/scoped staff policy across direct IDs, list/count/history, downloads and callbacks. Owner comparisons and staff permissions are inspected; order-code strategy, download bytes, full history and provider routes are not audited or inherited.",
    observations: [
      {
        id: "V11-order-owner-staff",
        caseId: "V11",
        category: "success",
        expected:
          "Order owners and appropriately scoped staff can observe the declared order/history/download surfaces.",
        critical: false,
        operations: ["downloadOrder", "getOrder", "orderHistory"],
        scenarios: [
          {
            id: "V-repeat",
            steps: [
              "step-immutable-order",
              "step-staff-order",
              "step-owner-history",
              "step-owner-receipt",
            ],
          },
        ],
      },
      {
        id: "V11-direct-isolation",
        caseId: "V11",
        category: "rejection",
        expected:
          "Another customer or scope cannot observe a direct order/history identity or privileged staff action.",
        critical: true,
        operations: ["checkout", "createShipment", "getOrder", "orderHistory"],
        scenarios: [
          {
            id: "V-repeat",
            steps: [
              "step-other-order",
              "step-foreign-order",
              "step-revoked-order",
              "step-anonymous-order",
              "step-other-history",
              "step-revoked-checkout-replay",
            ],
          },
          {
            id: "V-ship",
            steps: ["step-customer-shipping"],
          },
        ],
      },
      {
        id: "V11-list-isolation",
        caseId: "V11",
        category: "rejection",
        expected: "Lists/pages/counts contain no other customer's order or private history.",
        critical: true,
        operations: ["listOrders"],
        scenarios: [
          {
            id: "V-repeat",
            steps: [
              "step-orders-first-page",
              "step-orders-next-page",
              "step-orders-foreign-cursor",
            ],
          },
        ],
      },
      {
        id: "V11-download-isolation",
        caseId: "V11",
        category: "rejection",
        expected: "Downloads and related assets enforce the same order ownership boundary.",
        critical: true,
        operations: ["downloadOrder"],
        scenarios: [
          {
            id: "V-repeat",
            steps: ["step-other-receipt", "step-foreign-receipt", "step-revoked-receipt"],
          },
        ],
      },
      {
        id: "V11-callback-isolation",
        caseId: "V11",
        category: "failure",
        expected:
          "Delayed/foreign callbacks cannot mutate or disclose another customer's order under a forged ownership/scope reference.",
        critical: true,
        operations: ["referenceCallback"],
        scenarios: [
          {
            id: "V-unknown",
            steps: ["step-foreign-scope-callback", "step-wrong-order-callback", "control-26"],
          },
        ],
      },
    ],
  },
  {
    id: "V12",
    weight: 5,
    target: "G",
    source: "vd-order-process",
    supportingSources: [
      "vd-payment-process",
      "vd-fulfillment",
      "vd-event",
      "vd-mail",
      "vd-sql-job",
      "vd-polling",
    ],
    decisions: ["JV-effects", "JV-command", "JV-scope"],
    adaptation:
      "Keep attributed transition audit and eligible notifications atomic/durable in Jeeves. Upstream has history calls, commit-aware in-memory events and queued email with five requested retries; none establishes crash-safe materialization, current redaction or internal deduplication.",
    observations: [
      {
        id: "V12-transition-audit-notification",
        caseId: "V12",
        category: "success",
        expected:
          "Order/payment/fulfillment transitions produce immutable actor audit and durable eligible notifications.",
        critical: false,
        operations: ["audit", "inbox"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-transition-audit", "step-owner-inbox"],
          },
        ],
      },
      {
        id: "V12-notification-redaction",
        caseId: "V12",
        category: "rejection",
        expected:
          "Another customer's details and unauthorized projections never appear in audit reads or notifications.",
        critical: false,
        operations: ["audit", "inbox"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-customer-audit", "step-other-inbox", "step-revoked-inbox", "control-62"],
          },
        ],
      },
      {
        id: "V12-internal-effect-retry",
        caseId: "V12",
        category: "failure",
        expected:
          "Worker crash/retry preserves one logical internal effect and rechecks eligibility before sensitive materialization.",
        critical: false,
        operations: ["inbox"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["control-56", "control-59", "step-owner-inbox"],
          },
        ],
      },
    ],
  },
  {
    id: "V13",
    weight: 4,
    target: "H",
    source: "JH-promotion",
    supportingSources: ["vd-calculator"],
    decisions: ["JV-money", "JV-command"],
    adaptation:
      "Calculator reset/reapplication informs the seam, not promotion eligibility/stacking/remainder policy. No upstream promotion algorithm was audited; H remains a pure explicit project hook.",
    observations: [
      {
        id: "V13-promotion-allocation",
        caseId: "V13",
        category: "success",
        expected:
          "The selected strategy applies eligibility, exclusions, caps and deterministic rounded allocations in the declared order.",
        critical: false,
        operations: ["promotions"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-promotion-allocate"],
          },
        ],
      },
      {
        id: "V13-promotion-bounds",
        caseId: "V13",
        category: "rejection",
        expected:
          "Ineligible/unauthorized promotion input, excessive adjustments and totals violating invariants are rejected.",
        critical: false,
        operations: ["promotions"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-promotion-ineligible", "step-promotion-forged"],
          },
        ],
      },
      {
        id: "V13-promotion-recalculation",
        caseId: "V13",
        category: "failure",
        expected:
          "Repeated recalculation over the same immutable inputs returns the same allocated adjustments without accumulation.",
        critical: false,
        operations: ["promotions"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-promotion-recalculate",
              "step-JH-promotion-unavailable",
              "step-JH-promotion-timeout",
              "step-JH-promotion-invalid-result",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V14",
    weight: 5,
    target: "H",
    source: "JH-tax",
    supportingSources: ["vd-calculator"],
    decisions: ["JV-money", "JV-payment"],
    adaptation:
      "Tax-zone and configured tax-line calculation are context only. A production tax provider with immutable provenance/expiry/unavailable behavior is a separate hook; fixture tax does not earn V14.",
    observations: [
      {
        id: "V14-tax-quote-provenance",
        caseId: "V14",
        category: "success",
        expected:
          "Production tax adapter returns an immutable typed quote with amount, policy/provider provenance and expiry.",
        critical: false,
        operations: ["taxQuote"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-production-tax-quote", "step-tax-repeat"],
          },
        ],
      },
      {
        id: "V14-tax-input-authority",
        caseId: "V14",
        category: "rejection",
        expected:
          "Forged jurisdiction, currency, expired quote or unauthorized override cannot become an authoritative tax amount.",
        critical: false,
        operations: ["taxQuote"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-tax-forged-jurisdiction"],
          },
        ],
      },
      {
        id: "V14-tax-unavailable",
        caseId: "V14",
        category: "failure",
        expected:
          "Timeout/unavailable provider returns an explicit outcome and cannot create a checkout using invented tax success.",
        critical: false,
        operations: ["taxQuote"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-JH-tax-unavailable", "step-JH-tax-timeout", "step-JH-tax-invalid-result"],
          },
        ],
      },
    ],
  },
  {
    id: "V15",
    weight: 5,
    target: "H",
    source: "JH-shipping",
    supportingSources: ["vd-calculator"],
    decisions: ["JV-money", "JV-checkout"],
    adaptation:
      "Configured shipping calculation informs the responsibility. Carrier/rate/package strategy, trusted quote identity/expiry and unavailable-provider decisions remain explicit; flat fixture shipping does not supply them.",
    observations: [
      {
        id: "V15-shipping-selection",
        caseId: "V15",
        category: "success",
        expected:
          "Declared package/address/cart inputs yield bounded eligible carrier/service quotes with expiry.",
        critical: false,
        operations: ["shippingRates"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-shipping-select"],
          },
        ],
      },
      {
        id: "V15-shipping-authority",
        caseId: "V15",
        category: "rejection",
        expected:
          "Untrusted price overrides, incompatible services and expired quotes are rejected.",
        critical: false,
        operations: ["shippingRates"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-shipping-incompatible", "step-shipping-price-forgery"],
          },
        ],
      },
      {
        id: "V15-shipping-unavailable",
        caseId: "V15",
        category: "failure",
        expected:
          "Unavailable carrier/rate provider is explicit and cannot silently complete checkout with an invented quote.",
        critical: false,
        operations: ["shippingRates"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-JH-shipping-unavailable",
              "step-JH-shipping-timeout",
              "step-JH-shipping-invalid-result",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V16",
    weight: 4,
    target: "H",
    source: "JH-returns",
    supportingSources: ["vd-payment", "vd-admin-order"],
    decisions: ["JV-command", "JV-payment", "JV-fulfillment"],
    adaptation:
      "Upstream refund amount constraints are context; return eligibility, cumulative quantities, stable refund identities and ambiguous provider recovery remain project policy. No complete upstream returns/refund concurrency audit.",
    observations: [
      {
        id: "V16-partial-return-refund",
        caseId: "V16",
        category: "success",
        expected:
          "Authorized return/refund follows policy over paid, fulfilled and already-refunded quantities/amounts.",
        critical: false,
        operations: ["returnRefund"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-return-one", "step-return-remainder"],
          },
        ],
      },
      {
        id: "V16-refund-ceilings",
        caseId: "V16",
        category: "rejection",
        expected:
          "Excess quantity/amount, foreign orders and forbidden state transitions are rejected.",
        critical: false,
        operations: ["returnRefund"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-refund-while-uncertain", "step-return-excess", "step-return-foreign"],
          },
        ],
      },
      {
        id: "V16-refund-uncertainty",
        caseId: "V16",
        category: "failure",
        expected:
          "Duplicate request and uncertain provider result preserve one durable refund identity and explicit reconciliation.",
        critical: false,
        operations: ["returnRefund"],
        scenarios: [
          {
            id: "V-ship",
            steps: [
              "step-return-one-replay",
              "control-106",
              "control-109",
              "step-JH-returns-unavailable",
              "step-JH-returns-timeout",
              "step-JH-returns-invalid-result",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V17",
    weight: 4,
    target: "H",
    source: "JH-marketplace",
    supportingSources: ["vd-order-process"],
    decisions: ["JV-scope", "JV-money", "JV-payment"],
    adaptation:
      "Seller-order splitting is visible as a call, not an inspected marketplace settlement engine. Attribution/access/fees/payout reconciliation remain project policy; do not infer missing or separately licensed upstream functionality.",
    observations: [
      {
        id: "V17-seller-settlement",
        caseId: "V17",
        category: "success",
        expected:
          "Attribution produces the declared seller entitlement/settlement plan distinct from customer payment.",
        critical: false,
        operations: ["sellerSettlement"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-seller-plan"],
          },
        ],
      },
      {
        id: "V17-seller-isolation",
        caseId: "V17",
        category: "rejection",
        expected:
          "One seller cannot read or mutate another seller's attribution, payout or ledger scope.",
        critical: false,
        operations: ["sellerSettlement"],
        scenarios: [
          {
            id: "V-ship",
            steps: ["step-seller-foreign"],
          },
        ],
      },
      {
        id: "V17-settlement-recovery",
        caseId: "V17",
        category: "failure",
        expected:
          "Repeated/interrupted settlement uses stable identities and reconciliation without double entitlement or direct cross-seller mutation.",
        critical: false,
        operations: ["sellerSettlement"],
        scenarios: [
          {
            id: "V-ship",
            steps: [
              "step-seller-replay",
              "control-113",
              "control-116",
              "step-JH-marketplace-unavailable",
              "step-JH-marketplace-timeout",
              "step-JH-marketplace-invalid-result",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V18",
    weight: 4,
    target: "H",
    source: "JH-currency",
    supportingSources: ["vd-order", "vd-round"],
    decisions: ["JV-money", "JV-checkout"],
    adaptation:
      "Upstream can recalculate order currency from context; this is not snapshotted conversion. Jeeves never reinterprets completed money; rate provenance, exact conversion/rounding and unavailability remain a separate hook.",
    observations: [
      {
        id: "V18-currency-snapshot",
        caseId: "V18",
        category: "success",
        expected:
          "Conversion uses snapshotted rates/provenance and deterministic rounding into the requested currency.",
        critical: false,
        operations: ["convertCurrency"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-currency-convert"],
          },
        ],
      },
      {
        id: "V18-currency-reinterpretation",
        caseId: "V18",
        category: "rejection",
        expected:
          "Unknown currency, stale/invalid rates and attempts to reinterpret completed order money are rejected.",
        critical: false,
        operations: ["convertCurrency"],
        scenarios: [
          {
            id: "V-last-item",
            steps: ["step-currency-unknown", "step-currency-completed"],
          },
        ],
      },
      {
        id: "V18-rate-unavailable-retry",
        caseId: "V18",
        category: "failure",
        expected:
          "Unavailable rates remain explicit; retry cannot rewrite a completed snapshot or apply conversion twice.",
        critical: false,
        operations: ["convertCurrency"],
        scenarios: [
          {
            id: "V-last-item",
            steps: [
              "step-currency-repeat",
              "step-JH-currency-unavailable",
              "step-JH-currency-timeout",
              "step-JH-currency-invalid-result",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V19",
    weight: 4,
    target: "H",
    source: "JH-provider",
    supportingSources: ["vd-payment-handler", "vd-payment", "vd-payment-process"],
    decisions: ["JV-payment", "JV-scope", "JV-effects"],
    adaptation:
      "Generic provider methods inform adapter separation only. No concrete provider signature/idempotency/reconciliation implementation was inspected; V08 reference-protocol evidence cannot satisfy V19.",
    observations: [
      {
        id: "V19-real-provider-adapter",
        caseId: "V19",
        category: "success",
        expected:
          "A named concrete payment provider adapter verifies signature, amount/status and durable idempotency mapping with provider provenance.",
        critical: false,
        operations: ["stripeCallback", "stripePayment"],
        scenarios: [
          {
            id: "V-unknown",
            steps: ["step-stripe-start", "step-stripe-settled"],
          },
        ],
      },
      {
        id: "V19-real-provider-authentication",
        caseId: "V19",
        category: "rejection",
        expected:
          "Invalid real-provider signatures, foreign events and amount/status mismatches cannot settle an order.",
        critical: false,
        operations: ["stripeCallback"],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-stripe-bad-signature",
              "step-stripe-foreign",
              "step-stripe-amount-mismatch",
              "step-stripe-status-mismatch",
            ],
          },
        ],
      },
      {
        id: "V19-real-provider-reconciliation",
        caseId: "V19",
        category: "failure",
        expected:
          "Concrete provider timeout/duplicates/reordering map to pending/unknown and reconciliation without invented success or duplicate charge.",
        critical: false,
        operations: ["getPayment", "reconcilePayment", "stripeCallback", "stripePayment"],
        scenarios: [
          {
            id: "V-unknown",
            steps: [
              "step-stripe-observe-unknown",
              "control-98",
              "step-stripe-still-pending",
              "step-stripe-settled",
              "step-stripe-duplicate",
              "step-stripe-old-failure",
              "step-stripe-hook-unavailable",
              "step-stripe-hook-timeout",
              "step-stripe-hook-invalid-result",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "V20",
    weight: 4,
    target: "H",
    source: "JH-inventory-sync",
    supportingSources: ["vd-stock-movement", "vd-stock-level"],
    decisions: ["JV-inventory", "JV-command", "JV-effects"],
    adaptation:
      "Stock adjustment context is not an inspected ERP connector. Source authentication/revision ordering/absolute-versus-delta authority, conflicts with reservations and recoverable receipts remain explicit project policy.",
    observations: [
      {
        id: "V20-inventory-source-mapping",
        caseId: "V20",
        category: "success",
        expected:
          "A validated inventory/ERP source revision maps to the declared local command with explicit authority.",
        critical: false,
        operations: ["syncInventory"],
        scenarios: [
          {
            id: "V-expire",
            steps: ["step-erp-rev11"],
          },
        ],
      },
      {
        id: "V20-connector-authority",
        caseId: "V20",
        category: "rejection",
        expected:
          "Unauthenticated source, foreign stock identity and conflicting authority are rejected or explicitly reconciled.",
        critical: false,
        operations: ["syncInventory"],
        scenarios: [
          {
            id: "V-expire",
            steps: ["step-erp-unsigned", "step-erp-foreign", "step-erp-held-conflict"],
          },
        ],
      },
      {
        id: "V20-connector-revision-recovery",
        caseId: "V20",
        category: "failure",
        expected:
          "Duplicate/out-of-order source revisions and interrupted sync preserve one effect and an inspectable recovery item.",
        critical: false,
        operations: ["syncInventory"],
        scenarios: [
          {
            id: "V-expire",
            steps: [
              "step-erp-duplicate",
              "step-erp-old",
              "step-erp-interrupted",
              "step-erp-resume",
              "step-erp-unavailable",
              "step-erp-timeout",
              "step-erp-invalid-result",
            ],
          },
        ],
      },
    ],
  },
];

import { contractKey } from "./architecture-contracts.ts";
import type { DesignDocument } from "./design.ts";
/** Derived linkage report, never a second editable model or an acceptance/scoring result. */
export function vendureCoreDesignTrace(design: DesignDocument) {
  const a = design.architecture,
    m = a?.backend;
  const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return vendureCoreTrace.map((row) => {
    const names = new Set(row.observations.flatMap((o) => o.operations.map(kebab)));
    const wire =
      a?.contracts
        ?.filter((c) => c.kind === "api" && c.version === "v2")
        .flatMap(
          (c) =>
            c.shape?.operations
              .filter((o) => names.has(o.id))
              .map((o) => ({
                contract: { id: c.id, version: c.version },
                operation: o.id,
                ...(o.behavior?.session ? { session: o.behavior.session } : {}),
              })) ?? [],
        ) ?? [];
    const operations = m?.operations?.filter((o) => names.has(o.target.operation)) ?? [];
    const effects =
      m?.effects?.filter((e) => operations.some((o) => contractKey(o) === contractKey(e.source))) ??
      [];
    return {
      id: row.id,
      target: row.target,
      weight: row.weight,
      source: row.source,
      supportingSources: row.supportingSources,
      adaptation: row.adaptation,
      wire,
      operations: operations.map((o) => ({ id: o.id, version: o.version })),
      data: [
        ...new Map(
          operations.flatMap((o) => o.transaction.participants).map((r) => [contractKey(r), r]),
        ).values(),
      ],
      policies: [
        ...new Map(
          operations
            .flatMap((o) => o.protocol?.records.map((r) => r.policy) ?? [])
            .map((r) => [contractKey(r), r]),
        ).values(),
      ],
      queries: [
        ...new Map(
          operations.flatMap((o) => o.protocol?.queries ?? []).map((r) => [contractKey(r), r]),
        ).values(),
      ],
      hooks:
        m?.hooks
          ?.filter((h) => operations.some((o) => contractKey(o) === contractKey(h.operation)))
          .map((h) => ({ id: h.id, version: h.version })) ?? [],
      effects: effects.map((e) => ({ id: e.id, version: e.version })),
      observations: row.observations.map((o) => ({ ...o, observed: "not-run" as const })),
      scenarios: [
        ...new Set(row.observations.flatMap((o) => o.scenarios.map((s) => s.id.toLowerCase()))),
      ],
      runtime: "unsupported" as const,
      observedPoints: 0 as const,
    };
  });
}
