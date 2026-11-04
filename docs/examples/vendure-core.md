# Vendure core — complete backend design (P72)

Choose **Library → Examples → Vendure core · complete backend design** to create an independent
editable project. P72a's [partial factory](../../packages/spec/src/vendure-core-example.ts) remains
available unchanged. The [P72b composition](../../packages/spec/src/vendure-core-complete.ts) adds
behavior, recovery, eight project seams, five expected journeys and the final trace.

This is complete **design intent**. Runtime implementations remain unsupported; the application
is absent/not run, with **zero observed implementation points**. No generation, migrations,
scaffold files, provider execution, upstream code port or measured capacity is supplied.
Mattermost remains the default and saved projects do not adopt this example automatically.

## Boundaries and provenance

One proposed TypeScript modular API and one independent worker use PostgreSQL as the single
business authority. Twenty cohesive C3 responsibilities cover access/sessions, catalog/cart,
stock/reservations, orders/payments/fulfillment, history, discovery, eight H policies and worker
maintenance. Thin client, object bytes, mail, payment providers and warehouse are explicit external
boundaries. SQL intent connects API and worker through the shared database, without a direct
network transaction or an additional broker. Session identity remains owned by the existing
session implementation; public registration grants no shop roles or membership.

[P60b's source/adaptation map](../../benchmarks/vendure-core/v1/source-map.json) pins Vendure
v3.3.0 at `a4c56359ec831b0c54dd01eab14fb75455c43ab7`. REST/JSON/OpenAPI replaces upstream GraphQL
for this benchmark; parity remains excluded. Source inspection, design completeness, implementation
availability and observed verification are independent. The frozen [42 wire operations](../../benchmarks/vendure-core/v1/contracts.openapi.yaml),
[63 observations](../../benchmarks/vendure-core/v1/requirements.json), provider/callback contracts,
fixture values and P60 provenance remain unchanged.

The complete design has 30 entities, 48 exact aggregate versions, ten bounded queries, nine
lifecycles, 47 domain/internal operations, 55 effects, eight hooks and eleven capability settings.
Original v1 APIs/data/policies/aggregates remain pinned. Explicit API v2 successors clarify behavior
without changing wire payloads. Worker dataset grants are additive; API ownership/store and physical
storage identities remain fixed. Separate durable reconciliation/delivery records hold recovery
identities; they do not duplicate command, provider-event, source-revision or worker receipts.

## Local atomic behavior

[Finite procedure plans](../../packages/spec/src/vendure-core-recipes.ts) bind every normalized
input, authoritative participant, exact policy, field writer, expected version and result. The
[commerce contract](../../packages/spec/src/backend-commerce-protocol-model.ts) supplies typed
lock/safety rules and eight finite H settings. [Safety validation](../../packages/spec/src/backend-commerce-protocol.ts)
rejects lifecycle bypass, snapshot rewriting and writes outside the reviewed procedure. Explanatory
pre/post text does not execute as SQL, code or expressions.

- Cart add/change/remove require current owner, active state, CAS, 1..1000 quantity and at most 100
  distinct variants. Remove deletes the exact selected line; no invalid zero-quantity counter.
  Price authority stays in the server catalog. All mutations reject atomically rather than silently
  correcting quantities. Current authority precedes receipt replay, which precedes version checks.
  Canonical normalized input and operation version/scope/principal/key bind seven-day receipts.
- Quote uses checked exact safe-integer USD minor units. Tax is fixture 750bps half-up on summed
  merchandise; shipping 500 is untaxed/nonrefundable. Quote/lines/address/cart and per-variant price
  versions expire after 300s and never extend on replay. Quoting leaves cart version unchanged.
  Production tax/shipping remain separate H policies. No floating point or client price fields.
- Checkout locks cart/order/reservations, then existing stock rows in ascending stock UUID order,
  and rechecks current access, versions, address, quantities and quote expiry. Every variant price
  version must match; stale/mixed versions conflict. Availability is **onHand − active − held − allocated**.
  Consumed reservations are not subtracted again. All lines must fit: one last-item winner, loser 409
  without any partial cart/order/reservation/receipt/intent. Cart conversion, immutable order/lines,
  reservations, safe history/audit, terminal receipt and original intent use one SQL connection.
- Reservation expiry is 900s for new checkouts; seeded deadlines retain their exact values. Worker
  selection is bounded/fenced, then rechecks current order/reservation state/version/deadline under
  the same lock order as payment. Only active awaiting-payment reservations release/expire.
  Held or consumed stock never expires by a clock. Payment winning before deadline holds stock;
  expiry winning first makes stale payment 409/current-version 422, with no provider dispatch.
- Public order transition accepts cancellation only from awaiting-payment without an unresolved
  submitted/unknown or settled attempt. Clients cannot request paid/fulfilled. Payment-review
  cannot cancel/release blindly. Shipment requires current fulfillment/admin, settled payment,
  paid/partially-fulfilled order and CAS. Sum **all** shipments per line under locks. Positive
  quantities cannot exceed purchased/paid/allocated/remaining units. Shipment decrements onHand and
  allocated together; immutable purchased quantity/price/address/total never become mutable counters.
  Cumulative quantities select partially-fulfilled/fulfilled; same-key retry returns the same shipment.

These summed quantities and immutable quote/order tables are represented by typed procedure
settings and exact participant references. No synthetic mutable `reserved`, `paidQuantity` or
`fulfilledQuantity` columns are added just to fit an unrelated scalar-counter configuration.
The shared money setting covers every exact monetary field; bounded delivery settings retain
actual source effects/consumers. This assembly introduces no capability descriptor or support exemption.

## Provider uncertainty and recovery

Start-payment commits attempt `created` v1, order v2 and held reservation v2 **before dispatch**. The
separate submit-payment command commits `submitted` v2 and durable dispatch intent before the external call. Accepted response loss leaves payment `unknown` v3,
order `payment-review` v3, reservation `held` v2 and `providerId: null`. An ID from a lost response is never
invented. Fresh application keys cannot replace an unresolved attempt or cure uncertainty.

Reference callbacks verify original UTF-8 bytes (maximum 65,536 bytes), timestamp ±300s, timestamp-dot-body
HMAC-SHA256 and constant-time signature comparison **before parsing**. Authenticated provider/shop/
order/payment/amount/currency must match persisted records. With a null providerId, the verified
requestKey and authoritative same-key lookup must confirm the binding; unavailable lookup returns 503
while preserving unknown/held. Foreign identity 404, mismatched amount/provider 403, malformed 400;
failed authentication creates no event receipt. Duplicate event identity with changed content 409.

Settlement atomically records provider-event receipt, payment/order v4, consumed reservation v3,
allocated stock, safe history/audit and notification intent once. Exact duplicate returns 200
applied:false. A new older failure is a no-op event receipt and cannot regress settled/paid.
Reconciliation performs authoritative lookup outside SQL, then locks/rechecks the original attempt
before applying a result. Pending/missing/unavailable lookup remains explicit 503 unknown/held.
Definitive failed lookup permits a separate guarded release; no network rollback is implied.

Stripe is a distinct effectful **JH-provider** obligation after committed hold/intent, with readiness
required before source mutation. Its signature/result/error contract, separate delivery-failure
operation, five-second timeout and same-identity reconciliation do not claim an installed adapter.
The pin is `2025-03-31.basil`, configured account/test mode and automatic card capture, USD 50..99999999 minor units.
Verify original signature/version/account/mode/intent/status and amount_received before settlement.
Unknown create recovery may repeat only the same key/parameters within 23h; afterward retain unknown/
held and require account-level reconciliation. Reference-v1 seven-day protocol evidence cannot
satisfy Stripe, and Jeeves's seven-day command receipt is a different retention boundary.
See the [independent provider decisions](../../benchmarks/vendure-core/v1/providers.md).

## Eight remaining H implementations

[Exact signatures](../../packages/spec/src/vendure-core-hooks-contracts.ts) and
[finite settings](../../packages/spec/src/vendure-core-hook-settings.ts) preserve the independent
P61c contracts. Each hook has current scope/principal provenance, exact safe error, owned file,
acceptance IDs, five-second cooperative timeout, 64KiB result bound and no unrestricted repository,
network, foreign write or arbitrary effect authority. Required absence/invalid/timeout before
mutation returns 503 unchanged; post-send uncertainty retains the committed source and durable
reconciliation. Every row's three observations remain unrun. No scaffold is written in P72.

| Row / seam / owned path | Trusted snapshot and finite result contract | Policy, failure and recovery |
| --- | --- | --- |
| V13 JH-promotion · `src/hooks/promotion.ts` | Original gross/eligibility, policy, selected references/cap → per-line discounts and summed discount | Pure 10%, floor capped at 3; no stacking, exclude variant 209. Proportional floors, remainder descending then line UUID gives 2/1/0. Repeat original gross; no accumulated discount/writes. |
| V14 JH-tax · `src/hooks/tax.ts` | Trusted address/subtotal/cart/price/hash/time → quote ID/amount/provider/policy/jurisdiction/hash/expiry | Pure named project policy, US-IL/USD only; 10997→825, 300s. Exact canonical hash, reject stale or forged jurisdiction. No unavailable-tax fallback or production certification. |
| V15 JH-shipping · `src/hooks/shipping.ts` | Trusted package/address/service/version/time → 1..10 versioned rate quotes | Pure project rate table: ground ≤30,000g costs 500, express ≤5,000g costs 1000; exclude postal prefix 999, 300s expiry. No free-shipping fallback or carrier booking. |
| V16 JH-returns · `src/hooks/returns.ts` | Paid/fulfilled/refund quantities/amounts, requested units/time/identity → approved quantity/amount/after-inspection restock | Pure plan; 30-day half-open eligibility. Pending/unknown consume ceilings, shipping 500 excluded; 2149/unit, 6447 maximum. Persist refund:1151, reconcile original after uncertainty; no automatic sellable restock. |
| V17 JH-marketplace · `src/hooks/marketplace.ts` | Current seller/attributed lines/window/fee/payout identity → exact gross/fee/net/identity | Pure plan; 5997−600=5397 distinct from charge 6947. Unique seller/order/window/policy; returns adjust next open window. Unknown payout:1161 reconciles, never duplicate at window close. |
| V18 JH-currency · `src/hooks/currency.ts` | Original USD and immutable rate/version/provenance/time → EUR quote with original/rational/rounding | Pure half-even; 1999×92/100→1839, 5/2→2, 7/2→4. Positive bounded rational; reject stale/unsupported. No reinterpretation/double conversion of completed money. |
| V19 JH-provider · `src/hooks/provider.ts` | Committed payment/request/amount, configured pin and verified callback digest → submitted/settled/failed/unknown/provider ID | Effectful after commit, explicit delivery failure/reconciliation. Readiness before hold; original-byte verification, immutable mapping, monotone settlement, 23h same-key bound. No reference-protocol substitution. |
| V20 JH-inventory-sync · `src/hooks/inventory-sync.ts` | Verified warehouse revision/map/local commitments → absolute stock command, stale/duplicate or reconciliation | Pure proposal after authentication; source/shop/SKU/revision authority. Revision 11→30, conflicting 12→0 keeps 30/reconciles, interrupted 13→31; held 1/available 27. Changed same revision 409, stale no receipt, no inferred tombstone. |

Seller settlement fences the current seller/fee snapshot with its expected version; an order
version changed by fulfillment or returns is a separate locked observation.

No H hook has a hook dependency or unrestricted repository. Its supplied immutable snapshots are
assembled by the authorized module; pure hooks return validated proposals only. Provider execution
uses its named service boundary and durable identity, outside SQL. Refund/payout dispatch are
separate bounded worker operations, with ceilings reserved by the originating command.

## Journeys, views and final trace

Five [expected scenarios](../../packages/spec/src/vendure-core-scenarios.ts) preserve every frozen
observation and fixture-step link: **V-last-item**, **V-repeat**, **V-unknown**, **V-expire**, **V-ship**.
They cover the losing checkout, lost response/current-authority replay, unknown/late settlement,
held expiry/start-payment race, cumulative shipment and crash-before-ack notification recovery.
Focused C2 views show checkout, uncertainty and fulfillment. Companion local declarations show
one/two API instances, one worker and PostgreSQL; deployment is unprovisioned.

V-core remains an unmeasured objective: 50,000 products/200,000 variants/100,000 historical orders,
20 requests/s for 600s after warm-up, 70% reads/20% cart commands/10% checkout/reference flow. Target
read p95 ≤500ms and command p95 ≤1000ms with no stock/total violations; actual host/resources, achieved
rate/failures/queue growth and one/two-instance behavior require future measurements.

[The final derived trace](../../packages/spec/src/vendure-core-trace.ts) maps each row's exact
wire operations, current policies, authoritative data, effects, H hook and scenario outcomes,
while retaining P60 source/adaptation and all 63 mandatory observation/fixture-step identity.
The trace is derived from the same model and awards no points.

| Row | Exact design path |
| --- | --- |
| V01 | register/login/get-session/logout → existing session owner; no shop-role bootstrap |
| V02 | put-product/put-variant/publish/get-product/list-catalog/get-asset → current publication and catalog authority |
| V03 | quote → exact minor units, overflow bounds, immutable tax/shipping provenance |
| V04 | create/get-cart/add/change/remove-line → owner/CAS/line bounds/receipt |
| V05 | checkout → quote/version/address/quantity recheck → single local snapshot/reservation/receipt set |
| V06 | release/expire/start-payment → stable current locks/due/hold rules → one last-item/race winner |
| V07 | transition-order → guarded cancellation; settlement/fulfillment use separate source commands |
| V08 | start/dispatch/reference-callback/reconcile/get-payment → original-byte verification, unknown/hold and monotone late settlement |
| V09 | create/list-shipments → settled payment, cumulative quantity ceilings, exact stock decrement |
| V10 | search/list-catalog/rebuild-catalog → current publication before keyset pages/snippets |
| V11 | get/list-order/history/download/payment/callback → exact current owner/staff/service mapping |
| V12 | source transition → safe history/audit + intent → fenced current-recipient inbox/delivery |
| V13 | promotions → exact JH-promotion and original gross allocation |
| V14 | tax-quote → exact JH-tax/hash/expiry; no fallback |
| V15 | shipping-rates → exact JH-shipping/package/service/version/expiry |
| V16 | return-refund → exact JH-returns → durable refund dispatch/reconciliation |
| V17 | seller-settlement → exact JH-marketplace → isolated entitlement/payout identity |
| V18 | convert-currency → exact JH-currency/rational immutable provenance |
| V19 | stripe-payment/stripe-callback → exact effectful JH-provider and independent pinned protocol |
| V20 | sync-inventory → verified original bytes → exact JH-inventory-sync/receipt/reconciliation |

Read result mappings retain exact catalog/search `productId`, `variantId`, `name`, `price` and
bounded currently published `assetIds`. Query `id` explicitly maps to catalog `variantId`; private
SKU/price-version/projection text stays outside the DTO. Shipment/order lists assemble at most 100
same-parent immutable child rows; other pages select only declared wire fields. Alias source types
must fit exact wire item fields. All original query definitions remain protected.

Two complete copies use 158 policies, 110 effects and 198 contracts. Policy/effect bounds are
160/128; the existing 200-contract limit is preserved. Their one-over 161/129/201 values reject. This permits the retained P72a definitions plus explicit successors
and narrow service policies to coexist. It does not change row/page/workload bounds or any frozen
benchmark. Library insertion/remapping and exact pinned reuse retain the complete graph, immutable
storage identities and truthful unsupported availability.
