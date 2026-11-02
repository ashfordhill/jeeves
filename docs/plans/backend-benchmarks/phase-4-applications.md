# Phase 4 — Assemble and prove the three foundations

Read the [shared contract](contract.md), the relevant [benchmark scope](benchmarks.md), and only
the assigned package. These packages consume the same compiler and shared runtime. Application
factories supply editable design/configuration, not hidden custom handlers. New reusable commerce
behavior is explicitly isolated in P93–P97. No product UI implementation is included.

## P90

**Outcome:** Discourse-core's account, category and content commands run from its actual C2/C3 design.
**Depends on:** P89. **Profile:** R.

**Read/change:** `discourse-core-example.ts`, its fixed fixtures, new backend template selection,
example/starter factory, generated contract comparison. Focus on D01–D06.

1. Bind the design's responsibilities to exact supported template/capability versions. Preserve
   reference provenance. Fill in supported configuration instead of replacing the design with a
   handwritten API or making the compiler recognize `discourse-core` specially.
2. Assemble entities, policies, lifecycle actions and immutable revisions. Configure topic + initial
   post as one local transaction, edit/version rules, group grants and protected server fields.
3. Keep richer text, trust and abuse strategies as explicit H hooks. Plain-text core posting is a
   documented supported path; a requested rich-text operation fails unavailable if its hook is absent.
4. Generate a fresh foundation and run independent D01–D05 observations and available D06 paths.
   Do not award D06's full weight until its file/search/notification paths also pass in P91/P92.

**Done when:** core content is usable through API calls with no project-owned application code;
atomic create, replay, stale edit, private group, close/hide/restore transitions work. Contract
comparison identifies no accidental omissions. Hook files exist and fail closed. Full score and
remaining D06 paths are visibly incomplete.

**Not here:** UI pages, custom trust/ranking/anti-spam algorithms or direct copies of Discourse code.

## P91

**Outcome:** the discussion design composes shared files, moderation, search and notifications.
**Depends on:** P90. **Profile:** R.

**Read/change:** D06–D12 mappings; notification/file/search/review descriptors; example configuration.

1. Bind subscriptions, inbox/delivery, file lifecycle, scoped projection, review queue and audit
   to existing capabilities. Each effect references exact operation/event/data IDs.
2. Configure moderation transitions and revision visibility. Removing/hiding content changes
   every ordinary read path; old revision payloads do not bypass current parent access.
3. Use bounded recipient materialization and declared preferences. Apply current eligibility at
   materialization/delivery and current authorization to byte reads/search results.
4. Run D06–D12's full failure cases, including worker crash after inbox commit, stale flag review,
   failed object association and membership revocation before delivery.

**Done when:** all D01–D12 observations pass from fresh generation using packaged capabilities.
Configuration changes such as category visibility or notification channels flow through the model,
not hand-edited service files. A generic runtime defect is fixed in its owning version/package,
not patched in discussion-only output.

**Not here:** digests/mail ingestion, arbitrary moderation scripting, private pre-signed downloads
with an unstated revocation window, or a single happy-path test standing in for the ledger.

## P92

**Outcome:** a verified Discourse-core foundation with a concrete handoff for D13–D20.
**Depends on:** P91. **Profile:** P.

**Read/change:** fixed D ledger/acceptance, handoff/export, proposed benchmark runner registration.

1. Generate a clean project from the saved design through the ordinary generation service; perform
   install/typecheck/Compose readiness and independent D01–D12 acceptance using packaged artifacts.
2. Calculate coverage from evidence. Target 66/100; require at least 60 and all critical supported
   observations. Do not relabel a failing G row H or reduce its weight to reach the milestone.
3. Export contracts, design, runtime lock, capability/source maps, fixture commands and one small
   task brief per D hook. Include safe defaults, invariant boundaries and protected paths.
4. Preserve a sample project-owned hook across a supported configuration regeneration; prove
   protected generated/acceptance edits are refused. Keep the handoff usable without opening Jeeves.

**Done when:** another agent can start the foundation locally and identify exactly what remains.
The report distinguishes supplied/verified/custom/not-run cases; D13–D20 earn no points from stubs.
If coverage falls short, name the missing capability and propose a narrow corrective package before
moving the milestone. Do not claim the full upstream product is replicated.

**Not here:** implementing all eight H areas, performance certification or external agent spending.

## P93

**Outcome:** reusable exact-money, fixed-price catalog and versioned-cart capabilities.
**Depends on:** P92. **Profile:** R.

**Read/change:** V02–V04 designs/fixtures, common data/commands/policies; proposed
`packages/commerce-runtime/` modules and `templates/commerce-core/` wiring.

1. Add a reviewed money value type: bounded safe integer minor units and explicit currency. Define
   addition/multiplication/rounding entry points; core fixed-price multiplication needs no exchange
   rate. Reject fractional minor units, currency mismatch, negative price and arithmetic overflow.
2. Use entity configuration for products/variants/published visibility. Add finite pricing strategy
   binding and immutable quote result. Only the server-selected strategy is price authority.
3. Implement bounded versioned cart lines, positive quantities, unique variant identity, add/change/
   remove semantics and input normalization. Idempotency comes from shared command infrastructure.
4. Expose promotion/tax/shipping hooks independently. The core explicitly selects fixed fixture
   quoting/flat shipping where declared; it must not fall back to zero tax/free shipping when a
   required real provider is unavailable.

**Done when:** fixed examples including 3 x 1999 = 5997, boundary/overflow/currency cases, repeated
cart commands, stale version and private catalog lookup pass. Runtime has no benchmark-name branch.
Validate the money/cart capability with a second small non-benchmark order fixture.

**Not here:** inventory reservations, checkout, general discount formula editor, currency conversion
or production tax calculations. UI prices supplied by the customer are never trusted.

## P94

**Outcome:** stock reservations cannot oversell and have explicit release/expiry behavior.
**Depends on:** P93. **Profile:** R.

**Read/change:** V06 model, commerce inventory module, shared transaction/worker/receipt APIs.

1. Define authoritative counts: physical `onHand`, unpaid `reserved`, paid-unshipped `allocated`;
   sellable = onHand - reserved - allocated. All are nonnegative and sellable never falls below zero.
   Reservation settlement moves reserved -> allocated; shipment later reduces allocated and onHand.
2. Implement create/hold-for-payment/consume/release/expire with exact quantities, scope and stable
   order-line identity. One stock location is supported initially. Use parameterized conditional
   updates/row locks; do not read availability in one request and decrement in another without a guard.
3. Document one lock order across checkout, expiry, payment and shipment: order root where present,
   stock rows sorted by location/SKU, then reservation IDs. Checkout may first lock its cart, but
   existing-order paths must not subsequently lock a cart. Expiry discovers IDs, locks and rechecks.
4. Expire only active reservations with no started payment; held/unknown payment remains explicit
   review work. Claims and idempotency protect repeated release/expiry.

**Done when:** V-last-item, 25-way contention, repeated release, crash/retry and expire/start-payment
race pass against real PostgreSQL. Quantities reconcile with reservation state. Cross-shop IDs fail.
A small warehouse-reservation fixture proves reuse outside the commerce example.

**Not here:** multiple warehouse allocation, oversell/backorder policies, refund/restock decisions,
or automatic release of stock whose payment outcome is unknown.

## P95

**Outcome:** checkout creates one consistent order and exposes explicit lifecycle decisions.
**Depends on:** P94. **Profile:** R.

**Read/change:** V05/V07 design, cart/money/reservation runtime, finite state/transaction compiler.

1. Implement checkout from a current authenticated cart/version and valid immutable quote. Snapshot
   lines, amounts, currency and address; create order/reservations and mark cart converted atomically.
2. Bind order transitions to finite guards. Paid/shipped states cannot be set by a public arbitrary
   update. A quote/stock/version mismatch returns a declared rejection with no partial order.
3. Cancellation before payment releases stock atomically. An in-flight/unknown payment enters or
   remains payment-review with explicit cancellation intent; do not declare cancelled or refund
   success until the provider outcome is resolved.
4. Emit typed payment-request intent after local checkout via the transactional outbox. Real payment
   execution stays outside this transaction and follows in P96.

**Done when:** V05/V07 fixed cases pass lost response, duplicate key, changed payload, changed catalog
price, stale quote, stock shortage and invalid transitions. Stored order totals do not drift with
later catalog edits. A missing required pricing strategy blocks before mutation.

**Not here:** distributed rollback, pretending a queued payment is paid, marketplace settlement,
guest-cart merging or partial refunds.

## P96

**Outcome:** payment attempts handle authenticated events and uncertain external outcomes correctly.
**Depends on:** P95. **Profile:** R.

**Read/change:** V08/V19 contracts, P83 transport adapter, durable workers and commerce payment module.

1. Persist payment attempt identity and provider request key before dispatch. Dispatch outside SQL
   with bounded timeout. Keep created/submitted/settled/failed/unknown distinctions and provider refs.
2. Map verified callbacks to durable provider-event receipts and guarded domain commands. Deduplicate
   event identity; use the allowed transition table so older failure/pending events cannot regress
   settled state. Callback HTTP acknowledgement means durable receipt, not necessarily completed order.
3. On timeout after possible acceptance, keep unknown/payment-review and held stock. Implement a
   bounded reference-provider reconciliation query, with explicit exhausted/manual-review outcome.
   Never initiate another charge with a different key merely because the first response was lost.
4. On confirmed settlement, atomically move reservation quantities reserved -> allocated and mark
   the order paid once. Late settlement against expired/cancelled/conflicting state stays review
   work; it cannot silently oversell. Real provider mapping remains V19's typed hook.

**Done when:** invalid signature, duplicate/out-of-order events, response loss after provider effect,
worker death before ack, settlement-versus-expiry and unavailable reconciliation pass. One logical
order-paid effect occurs. Tests assert real reference-provider request counts as well as local rows.

**Not here:** real money movement, subscription billing, provider-specific production credentials,
automatic refund policy or a claim that all gateways share the reference provider's guarantees.

## P97

**Outcome:** fulfillment consumes only paid, allocated, unshipped quantities.
**Depends on:** P96. **Profile:** R.

**Read/change:** V09/V12 fixtures, commerce order/inventory modules, shared audit/notification effects.

1. Define fulfillment and line identities, quantity constraints and pending/shipped/cancelled
   transitions. An authorized operator creates a shipment plan referencing exact order lines.
2. Apply shipment atomically under the documented lock order: decrement allocated/onHand, record
   quantities and update partially-fulfilled/fulfilled state. Current paid state and quantity bounds
   are rechecked at commit. Reusing the command key returns the same shipment.
3. Emit audited status/notification intent with no external carrier call inside SQL. Carrier selection
   and labels remain an explicit adapter/strategy seam under V15.
4. Expose safe customer/staff projections; do not leak internal stock counts through customer history.

**Done when:** the 3-unit order/2-unit shipment/retry/over-ship/remainder sequence passes, including
concurrent shipments and interruption after commit. An unpaid or wrong-shop order cannot ship.
Audit/event failure rolls back the required local state changes.

**Not here:** returns/refunds, carrier integration, warehouse robotics, distributed inventory or
restocking a cancelled paid order without an explicit refund/return policy.

## P98

**Outcome:** the actual Vendure-core design generates its verified foundation and remaining-work brief.
**Depends on:** P97. **Profile:** P.

**Read/change:** Vendure-core example, fixed V ledger, frozen shared/commerce releases, generation
and handoff. Register the commerce release in both registry/module sets and preserve old versions.

1. Assemble V01–V12 through exact capability bindings, shared policies/search/files/notifications
   and commerce configuration. No application-specific handler copies in the generated project.
2. Generate fresh, compare public contracts, run all critical and G observations including the real
   reference-provider process. Keep provider protocol versus real-provider coverage separate.
3. Calculate actual coverage, target 66/minimum 60, and export exact V13–V20 hook tasks. Publish local
   immutable artifacts/docs for supported commerce combinations and their non-commerce proof fixture.
4. Verify unavailable H paths and protected-output/regeneration behavior. Ensure no UI is required
   to establish an authoritative price, permission, payment or fulfillment decision.

**Done when:** all foundation-critical checks pass; actual score is reproducible; unknown payments
remain visible and safe; H rows remain unearned. The generated project runs without the Jeeves
checkout. Any missing threshold is a named capability deficit, not grounds to change the denominator.

**Not here:** GraphQL compatibility, a production storefront, real provider certification or a
full commerce feature-parity claim.

## P99

**Outcome:** ticket/article access, assignment and finite routing run from the Zammad-core design.
**Depends on:** P98. **Profile:** R.

**Read/change:** Z01–Z06/Z09 design/fixtures; shared policies, revisions, commands and rule runtime.

1. Bind customer/agent/group/organization entities and exact policies. Customer create cannot set
   internal visibility, assignee, agent role or privileged SLA override.
2. Compose atomic ticket+initial article, public reply/internal note, versioned assignment and
   lifecycle actions. Author/time and current group are server-owned data.
3. Configure first-match routing priorities and eligible-assignee checks using P86 rules. A rule
   version is recorded on execution; action limits prevent loops and privilege changes.
4. Verify every currently available read projection. Track remaining file/search/notification paths
   as incomplete Z04 observations until P101; do not award its weight prematurely.

**Done when:** atomic create/replay, two-agent assignment race, internal-note lookup, role injection,
cross-group access, routing priority and invalid lifecycle cases pass from generated code. No
help-desk-specific runtime fork supplies behavior already covered by generic modules.

**Not here:** inbound email, ticket merge/split, custom conditional workflow language or SLA policy
implementation beyond wiring in P100.

## P100

**Outcome:** the help-desk's first-response SLA and escalation use shared calendar/deadline modules.
**Depends on:** P99. **Profile:** R.

**Read/change:** Z07/Z08 design/fixtures, P87/P88 modules, shared ticket command effects.

1. Bind calendar and SLA versions to ticket creation and first public agent reply. Use the exact
   start/stop/pending/close/reopen semantics in benchmarks.md. Internal notes never stop the clock.
2. Bind deadline jobs to current ticket and clock version, with root-then-deadline lock order.
   Escalation creates one audit/event transition; notification content follows existing policy.
3. Expose scoped deadline status and operator backlog/lateness. Calendar/SLA edits create versions;
   existing deadlines retain snapshots. Advanced recalculation stays Z15 work.
4. Run ordinary calendar cases plus reply-versus-due race, duplicate claim, outage catch-up and
   changed-calendar-version cases through the generated API and real worker.

**Done when:** exact UTC deadlines and one logical escalation are independently verified. A worker
restart does not reset the clock, and downtime is visible as lateness. Unauthorized customers cannot
change deadline policy or read another customer's SLA state.

**Not here:** multiple pause/reopen clocks, retroactive bulk recalculation, integrations or claims
that passing local cases guarantees a contractual service level in production.

## P101

**Outcome:** verified Zammad-core foundation, including every internal-note disclosure boundary.
**Depends on:** P100. **Profile:** P.

**Read/change:** Z04/Z10–Z12 and full Z ledger, shared file/search/notification/audit descriptors,
generation/handoff and fixed acceptance.

1. Assemble attachment inheritance, scoped search, preferences and customer-safe notification
   projections. Do not store internal note text in a customer-visible generic event payload.
2. Run all Z01–Z12 observations on a fresh generated project, including byte/search/email revocation,
   partial storage failure, deadline crash and routing loop rejection.
3. Calculate actual foundation score and critical vetoes; export Z13–Z20 hooks with typed briefs,
   acceptance cases and available runtime interfaces. No missing feature is described as implemented.
4. Prove configuration regeneration retains hook code, calendar snapshots and existing migrations;
   protected artifact edits block generation. Keep instance data separate from discussion/commerce.

**Done when:** at least 60/100 generated points and all supported critical checks pass; target is 66.
The remaining email/threading/advanced SLA/connectors are finite identifiable tasks. Private notes
cannot leak through a route that was omitted from the test matrix.

**Not here:** public help-desk hosting, polished portal screens or finishing every H capability.

## P102

**Outcome:** users can reuse editable compositions and see the real capability/support boundaries.
**Depends on:** P101. **Profile:** A + S; focused generated reuse proof.

**Read/change:** architecture patterns/library/extraction, example and starter registries, CATALOG,
template docs and the three exact design snapshots.

1. Publish editable compositions for authorized conversation, reviewed content, private attachment,
   scoped search, durable notification, business deadline and reserved-order flow. Use role/contract
   bindings and existing library machinery; do not create product-specific copies of generic modules.
2. Give each composition required roles, exact interfaces, configuration defaults, supported envelope,
   known hooks and evidence references. Insertion previews additions/reuse and is one undoable edit.
3. Prove the same policy/revision/delivery/search modules in discussion and help desk, and the same
   core access/commands/delivery in commerce. Use renamed entities and different field mappings so
   hidden application-name dependencies are exposed. Reuse inventory in the warehouse fixture.
4. Update catalog availability and documentation with actual selected versions. Keep examples,
   architecture patterns, runtime templates and product recipes distinct in terminology and UI.

**Done when:** a mouse user can start each core, inspect its configuration, change a supported option
and generate the changed behavior without editing application code. Fresh insertion preserves exact
contracts; incompatible roles/options are rejected. Cross-application proof uses identical frozen
runtime hashes and independent state, with per-application results recorded separately.

**Not here:** another template marketplace, a new page designer, making every library option
generatable, or hiding a complete handwritten application inside a 'generic' template.
