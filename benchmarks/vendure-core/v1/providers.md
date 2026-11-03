# Independent payment provider protocols

These pinned contract fixtures are **not provider calls, adapter code or evidence of a pass**.
[Outbound schemas](providers.contracts.json), [outbound examples](providers.examples.json),
[callback schemas](callbacks.contracts.json), [original-byte samples](fixtures.json) and
[authentication metadata](callbacks.examples.json) define future offline adapter tests.
All secrets below are public **fixture-only signing strings**, unusable as provider credentials.

## V08 reference-v1

The future loopback reference server accepts `POST /charges` with the strict `referenceDispatch`
JSON body and Idempotency-Key equal to requestKey. Amount/currency/order/shop/payment identity
come from the persisted attempt. Return a strict `referenceResult`; GET `/charges/by-key/{key}`
looks up the same request. Reference deduplication retention is seven days; charge events have
separate provider event IDs and sequence numbers. This is a Jeeves test protocol, not Stripe.

Persist payment created v1 and reservation held v2/order v2 **before** dispatch. Sending records
submitted v2; acceptance with response loss leaves payment unknown v3, order payment-review v3
and held reservation v2. The lost response leaves **providerId null**; the application cannot
learn a charge ID from a response it did not receive. No new requestKey/attempt is allowed to cure uncertainty. Signed settled
callback or authoritative lookup changes payment/order v4 and consumes reservation v3 once.
The fixed requestKey is `pay:801`, amount 2649; providerId is `ref-801`. A second attempt `pay:802`
uses the independent reconciliation path. Dispatch/lookup retries preserve identity. A pending/
unavailable lookup returns 503 DEPENDENCY_UNAVAILABLE and leaves unknown intact; no SQL rollback
claim crosses the network. Operator reconciliation is required beyond provider retention.

`POST /api/providers/reference/events` consumes the exact UTF-8 JSON bytes in request.input.body.
Require X-Provider-Timestamp (decimal Unix seconds), X-Provider-Signature (lowercase hex HMAC-SHA256)
over `timestamp + "." + original bytes`, using `fixture-only-reference-signing-key`. Accept absolute
clock skew at most **300 seconds**; compare signatures in constant time in the later implementation.
Verify before parsing/normalization; size limit 65536 UTF-8 bytes. Invalid/missing/modified/expired
authentication returns 403. Strict malformed envelopes return 400. Bind authenticated provider ID,
shop, order, payment, amount/currency to persisted attempt; foreign identity 404, amount/provider
mismatch 403. When providerId is still null, an authenticated event includes the original requestKey;
the host confirms its providerId/amount/shop/order/payment against an authoritative same-key lookup
before binding the provider ID and committing settlement. A signed wrong providerId cannot bypass
that lookup; unavailable lookup preserves unknown/held and returns 503. Client/body shop references
never establish ownership. A fresh signature is required
on retries outside the window; duplicate event ID with changed content is 409, not accepted replay.

Durably record `(provider, account/shop, eventId)` and normalized event hash together with the
local transition. Same event returns 200 applied:false. A new older failure event is retained as
a no-op receipt; settlement is monotone. The fixture has two distinct accepted event receipts,
one paid transition and one accepted charge. Failed authentication yields zero event receipts.
Callback 200 acknowledges the durable local transaction, not proof of external network atomicity.

## V19 Stripe PaymentIntents, 2025-03-31.basil

Selected protocol: Stripe API v1, automatic capture of card PaymentIntents, pinned
**2025-03-31.basil**, connected test account `acct_fixture_shop_a`, USD 50..99999999 minor units.
The fixture's `pm_card_visa`, IDs and signing key are test-only data. No SDK/dependency is installed.
The production credential is an operator-supplied reference, never fixture contents or a body key.
[Stripe's PaymentIntent reference](https://docs.stripe.com/api/payment_intents/object?api-version=2025-03-31.basil)
defines amount/status fields and an eight-digit amount bound. The pinned subset here is intentional;
it is not full Stripe API coverage.

`POST /v1/payment_intents` uses URL-encoded fields from `stripeCreate`, with Stripe-Version equal
to the pin, Stripe-Account equal to the configured account, and Idempotency-Key `stripe:809`.
The host creates/holds the local attempt before sending, persists the returned PaymentIntent ID,
and checks amount/currency on every response. Never infer authority solely from Stripe metadata;
match the immutable local attempt/provider/account/intent binding. After a lost create response,
providerId is null until same-key recovery or a verified callback plus authoritative intent lookup
checks account/metadata/amount and binds it; the fixture never invents a received intent ID. No raw card data or client secret
is returned in application results. The outbound example is fixed at **2649 usd**, intent
`pi_fixture_809`. GET `/v1/payment_intents/pi_fixture_809` performs read-only reconciliation.

[Stripe API v1 idempotency](https://docs.stripe.com/api/idempotent_requests) can retain both success
and server-error results and allows pruning after 24 hours. This differs from Jeeves's seven-day
command receipts. Unknown creates may retry the **same** provider key and identical parameters
only inside a conservative **23-hour** automatic retry deadline. After that, do not POST a new
charge or reuse a possibly pruned key; retain unknown/held and require account-level reconciliation.
If the response was lost before an intent ID was persisted, same-key create recovery inside the
window may recover it; afterward an operator must identify the accepted intent. An absent lookup
alone does not establish that a charge failed. No blind new-key retry is permitted.

`POST /api/providers/stripe/events` verifies Stripe-Signature `t=<seconds>,v1=<hex>` with the original
body and `fixture-only-stripe-signing-key`, HMAC-SHA256 of timestamp dot bytes; tolerance is the
benchmark's explicit **±300 seconds**. The future adapter should use a maintained provider verifier.
[Stripe webhook documentation](https://docs.stripe.com/webhooks) requires raw bytes, warns about
duplicates and unordered events, and distinguishes destination API versions. We choose snapshot
events at the pinned version, not a claim that the pin is current. Event IDs are receipts; created
seconds are not ordering authority. A wrong version/account/mode/intent binding cannot settle.

The fixture envelopes carry a strict selected field subset: event/object/API-version/created/test
mode/account/type and PaymentIntent id/object/amount/amount_received/currency/status/metadata.
A future real adapter must authenticate complete real bytes first and project the selected fields
without treating harmless provider-added optional fields as caller authority. The snapshots are
not copied complete Stripe responses and no full-payload compatibility claim follows.

| Provider state/event | Local meaning and guard |
| --- | --- |
| succeeded / payment_intent.succeeded | Settled only when intended and received amount/currency, account, mode and persisted intent match; one paid transition |
| processing / payment_intent.processing | Submitted/pending; held stock; unresolved lookup may leave unknown and return 503 |
| requires_payment_method / payment_intent.payment_failed | Failure indication requiring current-intent reconciliation before releasing unknown stock; never reverse settled |
| canceled with verified zero received | Definitive failed attempt after authoritative reconciliation; cancellation/stock release is a guarded local command |
| requires_action / requires_confirmation / requires_capture | Unsupported interaction/capture mode in this subset; explicit dependency outcome/review, no invented settled status |
| timeout, 5xx or unbound/missing intent lookup | Unknown, stock held; preserve durable identity and inspectable reconciliation |

A signed type/status mismatch, wrong amount or received amount rejects 403; foreign ownership/binding
404. Unknown event types/invalid selected envelopes reject 400 without local writes. Stored events
with a duplicate ID but different content conflict. A late older failure has applied:false after
settlement. Separate V19 fixtures cover these mappings and reconciliation. V08 reference-protocol
results cannot satisfy V19. The same rule applies to V14: fixture tax arithmetic is distinct from
an implemented production quotation policy/adapter. A later concrete adapter may be verified using
these independent offline provider fixtures; that would still not certify a live provider account.

## Warehouse and financial controls

Warehouse callbacks use the reference timestamp/HMAC framing with separate key
`fixture-only-warehouse-signing-key` and strict `warehouse-v1` envelopes. The secret's source binding,
persisted SKU/shop map, absolute count and monotone revision rules are in [hooks.md](hooks.md#v20--jh-inventory-sync).
A valid envelope under missing hook still requires valid authentication before 503.

`provider` controls configure settle, acceptance/response loss, definite preaccept rejection or
read-only lookup modes for an exact payment ID. `financial` configures reconciliation for an exact
refund/payout identity. Fault-after-accept modes preserve external uncertainty; `drain` never sends
a second refund/payout under a new key. These are privileged disposable-harness controls, never
production routes. No live credentials, network call or real adapter evidence is present.
