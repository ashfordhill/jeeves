# Independent Vendure-core v1 acceptance pack

**P61c supplies contracts and fixed expectations only. All applications and hooks remain absent /
not run, with zero observed implementation points.** Parent P61 remains partial until P61d.
No application evaluator, provider implementation, runner command or pass record is added.

Read the [frozen 20-row / 63-observation ledger](requirements.json), [source map](source-map.json),
[P60 review](../../../docs/reference/backend-benchmarks.md#vendure-core-p60b),
[shared protocol](../../protocol/v1/README.md) and [hook decisions](hooks.md).
The upstream GraphQL API is deliberately adapted to REST/JSON; upstream API parity is excluded.

| Artifact | Meaning |
| --- | --- |
| [contracts.openapi.yaml](contracts.openapi.yaml) | OpenAPI 3.1, in JSON syntax (valid YAML 1.2), exported from acceptance schemas only |
| [fixtures.json](fixtures.json), [typed entry](fixtures.ts) | Two isolated shops, ten actors, 16 strict datasets, 42 operations, all 63 observations, five scenarios and fixed requests/controls |
| [hooks.contracts.json](hooks.contracts.json), [examples](hooks.examples.json) | Eight strict input/result seams, independently authored values |
| [callbacks.contracts.json](callbacks.contracts.json), [examples](callbacks.examples.json) | Strict selected provider envelopes, original-byte hashes, valid and rejected authentication examples |
| [receipt.txt](receipt.txt) | Intentional 16-byte asset/receipt fixture; exact bytes/hash, never real customer data |
| [providers.md](providers.md) | Reference protocol versus pinned Stripe adapter protocol, transport/authentication/uncertainty decisions |

The schemas live in [vendure-benchmark.ts](../../../packages/spec/src/vendure-benchmark.ts).
`vendureFixtures(ledger)` uses P61a's strict parser and revalidates both canonical ledger pins.
Every operation has observation ownership. `backendAcceptanceCatalog` registers exact future
`backend:vendure-core:v1:<operationId>` behaviors; no new identity handling or runner is necessary.

## Authority and wire semantics

Use `http://127.0.0.1:4322` and its isolated cookie
`jeeves_session_862891429e2ae87d2b60eaa3d9dbf112`. Reuse seven-day durable sessions and exact
Origin/CSRF checks from the shared protocol. Registration uses a fresh fixture email; the seeded
Alice/admin accounts log in separately. Roles and shop membership come from fixture-only seeding,
never a public body. A still-authenticated revoked shop member cannot read private shop objects.
Inbox reads for that principal produce an empty redacted page. Foreign application cookies fail.

Catalog/search/assets are explicitly public, scoped by the selected shop. Customer carts,
checkout, order/history/receipt and payment reads require current ownership and shop access.
Scoped administrators edit catalog, reconcile payments and read safe audit metadata. Fulfillment
operators ship only paid allocations; customers cannot ship. Sellers see only their attributed
lines/entitlements. Inaccessible object references return 404, forbidden known actions 403.
Every route declares its access policy in OpenAPI; all successful session commands require
Idempotency-Key, Origin and CSRF. Provider routes require original-byte authentication instead.

All writable first-party objects are strict. A client price, role, owner, tax amount or shipping
amount is rejected with 400; it cannot become authority. Bounds violations in transport are 400;
valid data rejected by stock/state/overflow rules are 422. Stale versions and stale price/quote
bindings are 409 VERSION_CONFLICT; expired quotes are 422 DOMAIN_REJECTED. Safe errors have no
private order/address, cost, stock totals or stack trace. All responses are no-store and correlated.
The raw provider string in JSON fixtures is sent **verbatim** as application/json bytes, never
JSON-stringified a second time. OpenAPI declares the decoded JSON envelope plus its fixture UTF-8 descriptor;
[decoded callback schemas](callbacks.contracts.json) are separate from original-byte verification.
No fixture control appears in application `paths`.

## Exact money, snapshots and stock

All core money is USD integer minor units in **0..9007199254740991**, quantities **1..1000** and
at most **100 distinct variant lines**. Validate before multiplication/addition, using checked
integer operations; reject overflow before any persistence. No binary floating-point prices.
A price at the maximum is legal input, but two units overflow and quotation rejects. Seed cart
308 references that genuinely server-priced boundary variant; its extreme price is not client input.
Core line price is immutable in each quote. A changed catalog price invalidates unconverted quotes
and never alters an order. Price versions are per variant; v1 fixtures use a common version across
a quote and the changed-price example only touches one variant. Mixed versions require a fresh
quote rather than treating one maximum version as sufficient authority.

Fixture tax is **750 basis points on the summed merchandise subtotal**, half-up to the nearest
minor unit; no tax on shipping. Core shipping is **500**, nonrefundable. Those choices are explicit
fixtures, with no production tax/carrier claim. These literal examples are independent oracles:

| Inputs | Subtotal | Tax | Shipping | Total |
| --- | ---: | ---: | ---: | ---: |
| 1 × 1999 | 1999 | 150 | 500 | 2649 |
| 3 × 1999 | 5997 | 450 | 500 | 6947 |
| 3 × 1999 + 2 × 2500 | 10997 | 825 | 500 | 12322 |
| 1 × 2299 after price change | 2299 | 172 | 500 | 2971 |

A quote is valid for five minutes, bound to cart/version, exact quantities, address and trusted
price inputs. It does not increment cart version. `checkout.quantities` asserts the referenced
quote's quantities; it cannot override them or inject price authority. Checkout snapshots lines,
address, tax/shipping provenance and total, converts cart v3→v4, and creates order v1 plus active
reservations v1, one audit, receipt and original event intent in a single transaction. Snapshot
line identities persist from the source cart into quote/order; their owning root disambiguates
historical representations. A precommit fault rolls back all participants. After commit/response
loss, same key/input returns the original 201, even with old expectedVersion. Changed quantity
under that key returns 409 IDEMPOTENCY_CONFLICT. Authorize before replay; a revoked owner gets 404.
An in-flight same-key follower gets 409 COMMAND_IN_PROGRESS / Retry-After 1, then retries that key.
Canonical input/replay retention follow P61a, including the seven-day receipt window.

One stock location per shop. `onHand` includes unshipped physical units; active/held reservations
and consumed-but-unshipped allocations all reduce availability. Never subtract a consumed
reservation twice: its outstanding quantity is represented by `allocated`. Availability is
onHand minus active minus held minus allocated. Shipment decrements onHand and allocated together.
Seed allocation for paid order 603 is three units of variant 203; onHand 10 becomes 7 after shipping.
Unknown-payment order 601 has its own one-unit variant 211: availability stays zero while held.
A second checkout of that variant rejects; there is no stock release merely because time passed.

Active reservation expiry is 15 minutes for the selected expiry cases; other seeded reservations
have the explicit 13:00 deadline in their rows. Releasing active stock atomically cancels its
awaiting order; cancellation releases all active reservations. Both are CAS/replay-safe. Expiry
cancels an unpaid awaiting order and records one worker effect. Held/consumed stock is ineligible.
Lock/check order and reservation together, then stock in UUID order, and recheck current deadline.
The payment winner in V-expire obtains the lock at 12:14:59 before the deadline; the expiry
transaction contends at 12:15:00. The other order's expiry commits first at 12:15:31, so its old
payment version conflicts and its current cancelled version rejects. No new charge may dispatch.
`expiryRace` arranges that exact lock schedule; it does not override a domain guard.

## Five executable descriptions

Each scenario resets the **entire declared seed**, sessions, IDs, fault controls and clock to
2026-10-30T12:00:00Z. Seeded converted carts/historical quotes explain every existing order;
Bob/foreign addresses are deliberately distinguishable private data. All timestamps tie for
paging. Fixture IDs begin `e2000000`; no Discourse/application data is reused.

| Scenario | Fixed oracle and boundaries |
| --- | --- |
| V-last-item | Customer/admin sessions and restart/logout isolation; publication/asset guards; exact quote/overflow/cart CAS; Alice wins the stock lock for red's single 1999 unit, Bob gets 422, exactly one order/reservation and zero availability. Promotions/tax/shipping/currency contracts include strict rejection and zero-write unavailable/timeout/invalid-result paths. |
| V-repeat | Failure between checkout writes leaves zero rows/receipt/intent; response-loss replay leaves one order, one line/reservation/receipt/intent; changed quantity/price/version conflicts; one simultaneous command owner. Price 2299 leaves prior order 2649 intact. Owner/staff reads, interleaved Bob order 604 exclusion, foreign/tampered cursors, current-authorized replay and search rebuild. |
| V-unknown | Reference accepted charge → unknown/payment-review/held; unsigned, changed-byte, stale, foreign, wrong-order/provider/amount callbacks make zero changes. Signed settlement plus duplicate/older failure gives one paid transition. A second unknown resolves by lookup, never another charge. Separate Stripe pinned protocol covers uncertainty/signature/status/amount/isolation/replay; absent hooks remain 503. |
| V-expire | Release/cancel once; worker dies before expiry commit, then restarts after lease expiry and expires once. Both valid payment/expiry lock orders are described. ERP revisions 11/9/12/13 demonstrate apply/duplicate/stale/commitment conflict/rollback/resume; held quantity is preserved. |
| V-ship | Paid quantity 3: ship 2, same-key replay, competing version conflict, current-version over-ceiling 422, then ship 1 → fulfilled v6. One inbox/worker receipt survives crash after commit. Revoke before another pending notification; suppress its payload. Returns cap at 6447 refundable merchandise/tax; seller payout 5397 remains distinct from the 6947 customer charge. |

Public catalog/search order is `(product.createdAt ASC, productId ASC, variantId ASC)`. Order lists
use `(createdAt ASC, orderId ASC)`; history/audit/inbox/shipments use `(at-or-createdAt ASC, id ASC)`.
Publication/ownership applies before keyset/limit and before bytes, including old cursors and
stale projections. Hidden product 102 lies between 101/103; Bob order 604 lies between 603/605.
No implicit total or private cost/stock field is returned. Cursor strings are deterministic,
authenticated test-adapter tokens bound to operation/shop/query/order/last tuple. A changed query,
shop or token rejects with 400 INVALID_CURSOR. Rebuild v2/v3 reads authoritative visibility and
keeps stable product/variant identities. No exact capacity/freshness measurement is implied.

## Test-support boundary and offline checks

The future adapter supplies reset/seeding, deterministic UUID/time/correlation factories, disposable
credentials/session jars, finite barriers, one-shot faults, provider stubs, fenced workers and
privileged inspections. Header cookies refer to the actor's current jar; seeded actors start with
the declared fixture session aliases, and login replaces that jar. Anonymous public requests use
no session. Each sample's expected body/status/headers is a literal, or records connection loss
without claiming a commit. Assertions are exact equality or absence, never SQL/expressions.

`inspect.selector` names bounded adapter queries: `command:*` selects only that command's effects;
`last-item`, `unknown-payment`, `held-stock-unavailable`, `settled-once`, `reconciled-once`,
`stripe-*`, `expiry-*`, `shipment-ceiling`, `inventory-*`, `refund-*`, `payout-*`, `notification-*`,
`revoked-pending-notification`, `cart-race`, `public-surfaces` and `hook:*` select the named entities,
barrier group or causation. Arrays of versions follow input ID order. In `expired-once` availability
is the joined variant 205's actual shop stock (15 after release/cancel/expiry), not a global sum.
`providerCharges` counts accepted logical charges; `providerCalls` counts dispatch/financial sends,
not read-only reconciliation lookups. `receipts` are terminal HTTP command receipts;
`eventReceipts` are authenticated provider events, `effectReceipts` worker materialization/expiry
identities, `sourceReceipts` warehouse revisions, and `intents` original transition events.
Failed precommit transactions and rejected authentication create no successful receipts.
`forbiddenOccurrences: 0` scans the selected ordinary public/private-response and pending payload
surfaces for unauthorized order/address/cost/stock content, excluding protected operator storage.

Faults act at exact named boundaries: checkout before commit, response after commit, expiry before
commit, notification after inbox/receipt commit before ack, provider/refund/payout after acceptance,
sync before receipt/stock commit, hook timeout/invalid output. `drain.ids` selects logical subjects
in that channel (payment, reservation, notification, refund or payout IDs); no empty production
queue is silently treated as proof. Projection drains select one queued rebuild. Shipment 1002's
pending notification has fixture identity 9202 and is suppressed after revocation. All jobs have
30-second fenced leases, at most three attempts (1/5/30-second delays) and inspectable exhaustion
or reconciliation. Drain maxJobs is bounded; it never loops until success. Clock values advance
monotonically within each scenario; restart preserves persistent rows and expires leases by time.
`completed` counts handled jobs, `suppressed` is ineligible/no-op work, `crashed` controlled death,
and `unknown` an ambiguous provider outcome. Readiness is checked after authentication/policy and
before domain mutation/invariants for hook operations; missing/timeout/invalid required hooks
produce 503 HOOK_UNAVAILABLE and zero domain writes. A later implementation brief owns binding.

```bash
pnpm work run unit packages/spec/src/vendure-benchmark.test.ts packages/spec/src/discourse-benchmark.test.ts packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/delivery.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
```

Use Node 24 via PATH, lint and typecheck. Contract checks validate payloads/negative samples,
snapshots, exact identities and independent invariant values. `benchmarkFixtureUnavailable` returns
63 not-run/blocked observations with a reason, without points or a pass option. These tests do
not execute database transactions, cryptographic production verification, worker recovery or
application behavior. P74/P79 supplies execution; P72a/b supplies the design/hook briefs.
