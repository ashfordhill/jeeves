# Eight Vendure project-hook acceptance contracts

These are independent decisions for V13–V20, completing the P60 seams before implementation.
[Strict schemas](hooks.contracts.json) and [fixed input/result examples](hooks.examples.json)
come from acceptance-side types, without runtime evaluators. [Scenario requests](fixtures.json)
provide reference results, rejection, repeat/recovery and unavailable/timeout/invalid-result paths
for every seam. The reference control supplies fixed seam outputs in a future harness. It does
not implement production hooks or earn completed behavior. All eight hooks are currently absent.

The host authenticates and builds trusted snapshots. Hooks cannot establish membership, ownership,
stock, prices, money currency or authority from client fields. The host validates bounded results,
checks versions/expiry and commits authorized local commands/receipts/intent atomically. An output
may propose an effect; the hook cannot directly write a foreign aggregate or call arbitrary URLs.
Network adapters use declared providers outside SQL transactions, durable identities and explicit
unknown outcomes. Precommit missing/timeout/invalid hooks return 503 HOOK_UNAVAILABLE, zero domain
writes; a dependency failure after an external send records unknown/reconciliation instead of
pretending rollback. Default seam timeout is 5 seconds, result size 64 KiB, no unbounded recursion,
finite cancellation; project code retains its owned implementation paths in the later brief.
No fallback free shipping/tax, automatic payout or success from an unavailable seam is allowed.
P72b owns final design binding, dependency/owned-path briefs and safe scaffolds.

## V13 — JH-promotion

Input: trusted line IDs/gross USD amounts/eligibility, selected promotion references, policy version,
cap and current actor/shop. Output: one nonnegative discount per line, exact summed discount and
policy version. The selected `promotion-v1` is a single 10% merchandise promotion, floor aggregate
basis-point discount capped at 3 minor units. Exclude the configured ineligible variant 209 before
allocation. No stacking: more than one distinct promotion or unknown/ineligible promotion 62
rejects 422. Duplicate promotion references reject. The host supplies eligibility and cap; clients
can request references only. Reject negative/excess output, discount greater than line gross,
unbalanced totals or an attempt to discount shipping/tax.

Allocate the capped discount proportionally to eligible gross amounts using integer floors;
distribute remaining minor units by descending fractional remainder, then ascending line UUID.
The fixed input has two eligible lines of 1001 and one excluded line of 1001. Ten percent exceeds
the cap; eligible gross 2002 receives **2 and 1**, excluded line **0**, total **3**. Recalculate from
the original immutable gross each time, never apply to the previous discounted result. This is
pure: repeated different keys return the same values, with no accumulated discount or stock write.
Unavailable/timeout/invalid result leaves the cart untouched. This policy is a fixture project
choice; arbitrary promotion DSLs, loyalty systems and vendor promotion parity remain outside it.

## V14 — JH-tax

Input: cart identity, trusted taxable merchandise subtotal/currency/address, canonical input hash,
policy version and clock. Output: immutable quote identity, USD amount, `project-tax-v1` provider,
`tax-policy-v1`, US-IL jurisdiction, original input hash and expiry. This is a named project-owned
production-tax quotation boundary; it is distinct from core `fixture-tax-750bps-v1`. A future
implementation can supply the reviewed policy or an external adapter behind this exact contract;
no tax engine, legal correctness or vendor certification is supplied by fixture values.

Only US/IL fixture addresses and USD are supported. The host derives jurisdiction from the trusted
address, not a client override. Hash canonical sorted-key JSON of `{address,cartId,currency,
priceVersion,taxableMinor}`; the fixed input hash is
`67fdf67ad28492155d2861b9305aefcdd21c9ffc75d9a05cdacc89822d12d518`.
The selected quote over **10997** is **825**, expiring **12:05:00Z**. Returned hash, jurisdiction,
provider/policy version and currency must match. An expiry at/before now, unsupported jurisdiction,
forged tax field or mismatch cannot enter checkout. Same-key quote replay is authorized but does
not extend its expiry; checkout always rechecks. Timeout/unavailable/invalid (including stale)
result is 503 with zero writes; never synthesize a tax success. Provider calls may be repeated only
as quote reads, never by mutating an already completed order's tax snapshot.

## V15 — JH-shipping

Input: trusted cart, US address, package version, positive weight 1..30000 grams, selected ground/
express service and clock. Output: 1..10 immutable `project-carrier-v1` rate quotes with amount,
service, package version and expiry. The selected `shipping-v1` strategy uses a versioned project
rate table: ground up to 30000 grams costs 500; express up to 5000 grams costs 1000. Both support
continental fixture US postal prefixes except 999; incompatible weight/service/destination rejects
422. The fixture input is 1000 grams, package v1 and Chicago 60601: **ground 500**, expires 12:05.

The host owns line weights, packing version and address hash; packageVersion is an assertion to
check, not client permission to alter mass/price. Reject forged amounts, unknown services,
unmatched package version and expired quotes; an invalid hook result cannot create a quote or
checkout. Repeat immutable inputs yields the same eligible selection; stored-order shipping is
never rewritten. Missing/timeout/invalid provider result returns 503 without a free-shipping
fallback. Actual carrier booking, labels and external shipment uncertainty require a separate
adapter/brief; core V09 is paid-quantity fulfillment, not carrier execution.

## V16 — JH-returns

Input: authorized order/line, paid/fulfilled/refunded snapshots, requested quantity, per-unit
refundable snapshot, fulfillment time/clock, policy version and durable request identity. Output:
authorized quantity/amount, **after-inspection** restock policy and the same request key. Eligibility
window is 30 × 86400 seconds after shipment, inclusive at start/exclusive at end. Only fulfilled
units can return; damaged/unwanted is bounded input, no amount override. Shipping 500 is excluded.
Order 603 has quantity 3, merchandise **5997**, tax **450**, total charged **6947**. Tax allocation
is ascending line/unit ordinal, remainder first; here each unit has 150 tax. Refund per unit is
**2149**, total maximum **6447**. One return refunds **2149**; remaining two refund **4298**.
Cumulative settled **and pending/unknown** refunds consume quantity/amount ceilings immediately.

Host CAS/unique line/request checks prevent over-return or concurrent refund overrun. Same key
returns the original 202/body even when its asynchronous outcome later changes. After provider
acceptance/timeout, refund 1151 stays unknown with key `refund:1151`; reconciliation looks up that
identity and settles once, with one dispatch call. Never send a new refund key to resolve doubt.
Order versions 6→7→8 reserve the first/remainder quantities. Receipt replay precedes stale-version
checks. Unavailable hooks have zero writes. Return inspection, physical restock, provider dispute
rules and tax adjustments remain explicit project responsibilities; a financial refund alone
never makes inventory sellable.

## V17 — JH-marketplace

Input: trusted seller membership, attributed immutable order lines, half-open UTC settlement
window, paid merchandise gross, fee basis points/version and payout identity. Output: same seller,
exact gross/fee/net and stable payout key; the host schedules the approved plan. One seller cannot
read another's plan, entitlement or payout. Amounts exclude shipping/tax and are USD. Round fee
half-up once per seller/order/window, no fee-on-fee or cross-seller remainder sharing.

Seller 41 owns order line 1603: gross **5997**, fee **10% → 600**, net **5397**, key `payout:1161`.
This is distinct from customer charge **6947**. Entitlement is unique per seller/order/window and
snapshot policy; returns reserve a negative adjustment for the next open window, never rewrite a
settled entitlement. No chargeback or negative balance is automatically charged to a customer.
Windows include payments confirmed by the selected clock; the fixture window ends 13:00 and may
produce a provisional plan at noon. A payout worker may dispatch the explicitly approved plan;
closing the window later must preserve its identity rather than pay it again.

Interrupted dispatch after acceptance becomes unknown. Same command replays the original plan;
a read-only provider reconciliation settles the original payout once, with no direct cross-seller
writes/new payout identity. Unknown cannot be assumed failed. Unavailable/timeout/invalid hook
results leave entitlements/payouts unchanged. Legal seller onboarding, payout rails/credentials
and negative-balance recovery are separate project work, not supplied by this fixed fee policy.

## V18 — JH-currency

Input: original USD minor units, requested EUR, trusted immutable positive rational rate/version,
source time/expiry, actor/shop and clock. Output: pure converted amount with original amount,
rate/provenance and **half-even** rounding. Both currencies have two minor decimal places.
`fixture-rate-v1` is a named project rate snapshot, not a live exchange-rate recommendation.
Rate UUID 51 v1 is **92/100**, asOf noon, expires 13:00. **1999 × 92/100 = 1839.08 → 1839 EUR**.
Integer numerator/denominator are bounded 1..1000000. Use exact integer intermediates, reject
out-of-range final values before persistence; rate zero/unknown/stale and non-USD/EUR reject.

The conversion is a quote only. A completed cart/order cannot be reinterpreted; base USD/order
snapshots remain immutable. Every retry starts from the original source and same rate, never an
already converted value. Half-even ties are independently tested: **5 × 1/2 → 2**, **7 × 1/2 → 4**.
An unavailable/invalid/timeout rate result returns 503 and zero writes. A production rate source,
settlement currency/FX gains and repricing policy require a project adapter, not core arithmetic.

## V19 — JH-provider

Input: trusted durable payment request identity, amount/currency, action dispatch/reconcile/callback,
provider ID and configured credential reference; callback digest only after original-byte verification.
Output: named `stripe-2025-03-31.basil`, provider reference, submitted/settled/failed/unknown and the
unchanged request key. See [provider protocol decisions](providers.md) for exact endpoints,
account/mode/version/signature mapping, status bounds and uncertain-create recovery.

The fixed **2649 USD** accepted-but-timed-out PaymentIntent stays unknown, review and stock held.
One signed `payment_intent.succeeded` for `pi_fixture_809`, same account, amount_received and trusted
mapping settles once. Bad signatures, foreign scope/amount and type/status mismatch do not apply.
Duplicate event and old failure never reverse settlement. Read-only pending lookup returns 503
DEPENDENCY_UNAVAILABLE while preserving unknown; a real adapter cannot replace uncertainty with
success. Missing/timeout/invalid required hook before dispatch is 503 HOOK_UNAVAILABLE / zero writes.
Independent pinned Stripe fixtures may later verify a concrete adapter offline; V08 reference
provider evidence cannot satisfy this seam. No Stripe adapter or certification exists in P61c.

## V20 — JH-inventory-sync

Input: authenticated `warehouse-v1` absolute-on-hand revision, persisted shop/SKU mapping/version,
local committed quantity (active + held + outstanding consumed), last source revision and clock.
Output: mapped local stock command, duplicate/stale result, or explicit reconciliation item.
`ERP-BLUE` maps only to variant 205 in shop A. Source `absoluteOnHand` is authoritative for physical
count, while local reservations/paid allocations remain authoritative commitments. Never apply a
source count below committed units; leave stock unchanged and create one reconciliation item.
No arbitrary delta, foreign SKU/shop, signature bypass or client authority is supported.

In V-expire, outstanding commitments are **4**, including **1 held**. Revision **11 → 30 onHand**
applies; duplicate 11 has one receipt/effect; old 9 is stale and does not advance the watermark.
Revision 12 reporting 0 conflicts, leaves onHand 30 and opens reconciliation 1201; it records its
source receipt/revision without silently resolving the discrepancy. Revision 13 reporting 31 fails
before local stock/receipt commit, then resumes once. Final onHand **31**, held **1**, availability
**27**, three source receipts (11/12/13), one reconciliation retained for operator review.

Warehouse event identity is `(source, shop, externalSku, revision)`; conflicting content at the same
revision rejects 409, not duplicate success. Old revisions have no effect/receipt; an interrupted
uncommitted revision is retryable with the same identity. No deletion/tombstone is inferred from
absence in a batch; an explicit zero count still obeys commitment safety. Missing/timeout/invalid
hook has zero writes. The named connector protocol is test data; no live ERP integration is supplied.
