# Benchmark scope, behavior ledgers and fixtures

This is the product specification for the three core experiments. Read the
[shared contract](contract.md) for generation, ownership and scoring rules.

The scopes and choices below are **Jeeves benchmark adaptations**. They are not assertions that
upstream products use these exact tables, policies or state machines. P60 pins inspected source
and labels facts, interpretation and proposed adaptations separately. P59 turns these ledgers
into validated data before runtime work begins; P61 fixes protocol fixtures independently of
the implementation. A later correction creates a reviewed benchmark version with a visible diff.

## 1. Reference material and rationale

| Reference | Primary material | What it informs |
| --- | --- | --- |
| Discourse | [Source](https://github.com/discourse/discourse), [API reference](https://docs.discourse.org/), [trust levels](https://meta.discourse.org/t/understanding-discourse-trust-levels/90752), [operating PostgreSQL](https://blog.discourse.org/2021/04/standing-on-the-shoulders-of-a-giant-elephant/) | Community access, discussion lifecycle, moderation and operational separation; trust/ranking rules remain explicit application work |
| Vendure | [Source](https://github.com/vendurehq/vendure), [architecture](https://docs.vendure.io/current/framework/developer-guide/overview), [orders](https://docs.vendure.io/current/framework/core-concepts/orders), [inventory](https://docs.vendure.io/current/core/core-concepts/stock-control), [workers](https://docs.vendure.io/current/framework/developer-guide/worker-job-queue) | Headless commerce, explicit order lifecycle, strategy seams, stock/payment boundaries and independent background work |
| Zammad | [Source](https://github.com/zammad/zammad), [system/API documentation](https://docs.zammad.org/en/latest/), [SLA specification](https://admin-docs.zammad.org/en/7.0/manage/slas.html), [calendars](https://admin-docs.zammad.org/en/latest/manage/calendars.html) | Enterprise access, ticket conversation, business-time deadlines and configurable escalation |

Upstream docs can move. P60 records the version/date and relevant immutable source files rather
than treating moving documentation URLs as frozen acceptance. Existing adoption evidence supports
choosing these references; it does not prove that our generated versions inherit their capacity.

## 2. Common protocol and fixture rules

- Separate `discourse-core/v1`, `vendure-core/v1`, `zammad-core/v1` profiles; each ledger totals 100.
  Prefix case identities with D, V or Z. Suffixes identify observations, for example D06-denied-search.
- G means **candidate generated behavior**; H means **explicit application hook target**. These
  labels are planning targets. The evaluator derives actual implementation origin and status.
- Every row includes a successful observation, rejection/access observation and applicable retry,
  concurrency or recovery observation. Its weight is earned only when all required observations
  pass. All first twelve rows total 66; all remaining rows total 34. Do not award points to stubs.
- Two isolated scopes per application, at least two ordinary principals, a privileged principal,
  a revoked principal and an unauthenticated client. Reuse stable fixture UUIDs within that
  application's fixture only. Never bootstrap roles through a public user-supplied admin field.
- An authenticated server selects scope from a validated route/session context. The scope is
  included in database keys, memberships, uniqueness, idempotency, cursors and delivery identities
  wherever necessary. A group/category scope is not automatically a customer tenant.
- REST JSON requests have explicit schemas. Shared errors: malformed input 400; missing session
  401; known readable object/action forbidden 403; inaccessible or absent object lookup 404;
  stale version or conflicting idempotency key 409; domain invariant rejection 422; an unimplemented
  required hook 503. Each operation declares only its applicable outcomes. No success with a
  string saying that the work is unimplemented.
- Error shape: `code`, safe `message`, `correlationId`, optional bounded field errors. Success
  shape and response headers are fixed by P61. Tests compare meaningful fields, not random IDs
  or incidental JSON property order. Unknown writable fields are rejected.
- Mutating commands accept an Idempotency-Key header and an expected aggregate version where
  relevant. Store canonical input hashes. All body IDs are references to authorize, never proof
  of ownership. Server time, IDs, stock totals, role assignments and audit actors are protected.
- Paginated reads use an opaque validated keyset cursor, limit 25 by default and at most 100.
  Stable ordering includes ID. Test inaccessible records interleaved across pages and search hits.
- Default text is plain text. Rich-text interpretation is a named hook; do not execute embedded
  HTML. Core uploads allow a finite inspected MIME list, limit 10 MiB, and authorize both metadata
  and bytes. Quarantined or incomplete uploads are not downloadable.
- Provider fixtures are executable local HTTP/object/mail services with deliberate timeout,
  duplicate, invalid-signature, failure and delayed-response modes. Their control endpoints never
  appear in the production contract. A fake provider's success is not a real provider certification.

## 3. Discourse-core

### Architecture and data

C1 actors: visitor, member, moderator, administrator. External systems: email delivery and object
storage. C2: thin client boundary, modular discussion API, background worker, authoritative
PostgreSQL, private object storage and external email provider. Search uses a PostgreSQL projection
initially. Jobs are named logical database-backed channels. The thin client is a contract consumer,
not a generated page layout.

C3 in the API: account/session adapter; membership and access; categories; topics/posts and
revisions; moderation; subscriptions/preferences; attachment lifecycle; scoped search; audit.
C3 in the worker: notification materialization/delivery, projection updates, bounded cleanup and
explicit digest/mail-in hooks. Reuse families; do not add a container for each responsibility.

Authoritative entities: workspace, group, membership, category, categoryGroupGrant, topic, post,
postRevision, subscription, notification, moderationFlag, attachment, attachmentLink and auditEntry.
An API command owns a topic and its initial post atomically. A post belongs to exactly one topic;
permissions derive from its current category. Revisions are append-only, but removal policy must
also prevent unauthorized access to old revision text. A subscription has a unique
`(scope, principal, topic)` key; a flag has a unique `(scope, reporter, post, active-review)` identity.

Core states: topic open/closed/archived; post visible/hidden/removed; flag pending/dismissed/upheld;
membership active/revoked. Moderator actions require policy and audit. A closed topic rejects new
ordinary replies. Editing requires author/moderator permission and expectedVersion. Revocation
affects future reads, downloads, search and pending sensitive notifications immediately on their
next authorization check. Already delivered information cannot be recalled.

| ID | Weight | Target | Observable capability and mandatory boundary |
| --- | ---: | --- | --- |
| D01 | 5 | G | Register/login/logout/session; protect credentials and mutations; sessions survive API restart and stay isolated from the other applications |
| D02 | 5 | G | Group membership and public/private category grants; a member cannot grant themselves moderator access; cross-scope references fail |
| D03 | 6 | G | Create topic with initial post atomically; rejected post leaves no topic; a lost response and retry create one topic |
| D04 | 7 | G | Reply and edit with immutable revision history; concurrent stale edits conflict; an unauthorized author cannot mutate another post |
| D05 | 6 | G | Close/reopen/archive topic and hide/restore/remove post with allowed transitions; rejected commands leave state unchanged |
| D06 | 6 | G | Apply revocation across detail, list, search, attachment bytes and pending notifications; no title/snippet/count leak through another read path |
| D07 | 5 | G | Watch/mute a topic and set channel preferences; duplicate requests preserve one subscription; another user cannot change it |
| D08 | 6 | G | Durable notification inbox with eligibility recheck and per-recipient deduplication; worker crash/retry cannot duplicate inbox entries |
| D09 | 5 | G | Stage, validate, attach and download files; failed SQL association leaves a recoverable orphan; foreign/private files cannot be attached or fetched |
| D10 | 5 | G | Submit a flag and process its review queue through audited moderator actions; duplicate flags and stale review claims cannot apply an action twice |
| D11 | 5 | G | Bounded topic/post listing and scoped full-text search; stable cursors, authoritative access filtering, projection rebuild and deletion visibility |
| D12 | 5 | G | Content removal/tombstones and audit history; removed text stays absent from ordinary history/search; repeated removal is safe |
| D13 | 4 | H | Trust-level progression from recorded activity; fixture defines promote/demote thresholds and privileged overrides without trusting client activity counters |
| D14 | 5 | H | Abuse/spam adjudication policy; false-positive appeal and moderator override are explicit, while generic request limits remain infrastructure |
| D15 | 5 | H | Digest selection and scheduling; exclude muted/inaccessible content and define timezone/window behavior and duplicate delivery policy |
| D16 | 4 | H | Rich-text rendering and mention extraction; sanitize output, bound parsing and suppress inaccessible-recipient notifications |
| D17 | 4 | H | Topic split/merge; preserve post identity/history, access decisions, subscription behavior and failure recovery |
| D18 | 4 | H | Account export/erasure policy; define retained audit, removed identity/content, queued delivery cancellation and legal-hold exceptions |
| D19 | 4 | H | Inbound email-to-reply integration; authenticate source, identify topic, deduplicate message IDs and reject unauthorized posting |
| D20 | 4 | H | Discovery/ranking strategy; deterministic tie-breaks, visibility enforcement and explicit freshness/rebuild semantics |

Critical foundation observations: D03 atomicity/retry; D04 stale writes; every D06 route; D08 crash
deduplication; D09 foreign-byte access; D12 removal visibility. Missing any one vetoes a foundation pass.

### Fixed end-to-end scenarios

1. **D-create:** Alice belongs to group red; Bob does not. Alice creates a private topic and first
   post under category engineering. Bob's lookup returns 404 and search has no title/count leak.
   Retry Alice's command with the same key after dropping the HTTP response; one topic/post exists.
2. **D-revoke:** Bob is granted red membership, watches the topic and becomes eligible for a queued
   notification. Revoke him before worker execution. He loses reads/search/file access and the
   pending notification contains no private content. A previously issued byte URL must not bypass
   this rule; proxy authorized bytes in v1 rather than promising instant revocation of long-lived URLs.
3. **D-edit:** Two edits use post version 3. Exactly one produces version 4 and one new revision;
   the other returns 409. Closing the topic rejects a new ordinary reply without changing the topic.
4. **D-failure:** Crash the worker after committing an inbox item and before acknowledgement.
   Restart it; inbox count remains one. Fail object storage after staging and before association;
   incomplete bytes never appear as an available attachment and cleanup can reclaim the orphan.
5. **D-moderate:** Two moderators act on the same pending flag. Only the current version can move
   it to upheld and hide the post. Audit identifies the successful actor; search and normal history
   stop disclosing hidden text according to the selected moderator-only policy.

## 4. Vendure-core

### Architecture and data

C1 actors: customer, shop administrator, fulfillment operator. External systems: payment provider,
mail delivery and object storage. C2: thin storefront/admin consumers, modular commerce API,
commerce worker, PostgreSQL and named external adapters. The two clients consume separate access
surfaces on one API; they do not imply separate domain services. Initial protocol is REST, not
Vendure's GraphQL. Marketplace payouts and multi-currency conversion are application hooks.

C3: identity/access; catalog; money/pricing; cart; inventory reservation; orders/checkout;
payment coordination; fulfillment; notifications; audit; search. Worker: payment dispatch and
reconciliation, reservation expiration, notification delivery and projection updates.

Entities: shop/channel, product, variant, price, inventoryItem, stockLocation, stockLevel, cart,
cartLine, order, orderLine, reservation, paymentAttempt, providerEvent, fulfillment,
fulfillmentLine, notification, attachment and auditEntry. Use immutable order-line price snapshots.
Core benchmark: authenticated checkout, one currency USD, one stock location, one payment per
order, explicit flat shipping and fixture tax quote. This does not implement production tax law.
Line quantities are positive integers <=1000; at most 100 lines/order. Prices and totals are safe
integer minor units with declared upper bounds; reject overflow instead of rounding floats.

States: cart active/converted/abandoned; reservation active/held-for-payment/consumed/released/expired;
order awaiting-payment/paid/partially-fulfilled/fulfilled/cancelled/payment-review;
payment created/submitted/settled/failed/unknown; fulfillment pending/shipped/cancelled.
An uncertain external payment keeps an explicit review state and its reservation held; do not
release it and sell the stock again while treating late settlement as ordinary success. Reservation
expiry applies to active reservations that have not entered payment processing. Cancellation
and late settlement require an explicit reconciliation decision. No generic distributed rollback.

| ID | Weight | Target | Observable capability and mandatory boundary |
| --- | ---: | --- | --- |
| V01 | 5 | G | Customer/admin sessions and role separation; a customer cannot invoke catalog/admin operations or forge a shop scope |
| V02 | 5 | G | Products/variants and published catalog with bounded queries; unpublished records stay absent from public results and related assets |
| V03 | 6 | G | Fixed-price money calculation in integer minor units; immutable quote inputs, consistent currency, quantity bounds and overflow rejection |
| V04 | 7 | G | Cart add/change/remove with version checks and bounded lines; duplicate commands do not double quantity and invalid prices are ignored as authority |
| V05 | 6 | G | Checkout creates one order with line/address/price snapshot and reservations atomically; changed quote/version conflicts without partial order |
| V06 | 6 | G | Stock reservation, release and expiration; concurrent last-item checkouts cannot oversell; held payment stock is not blindly expired |
| V07 | 5 | G | Order lifecycle and cancellation guards; invalid transitions and stale actions cannot mark unpaid orders paid or shipped |
| V08 | 6 | G | Payment protocol against a local reference provider: authenticated callbacks, duplicate/out-of-order events, ambiguous timeout and reconciliation |
| V09 | 5 | G | Fulfillment records and partial shipment quantities; cannot ship more than paid, reserved, unfulfilled quantities; retries preserve one shipment |
| V10 | 5 | G | Published catalog search with stable paging and rebuildable projections; hidden prices/stock internals are not returned |
| V11 | 5 | G | Customer order/history visibility and staff capabilities; direct IDs, lists, downloads and callbacks respect the same ownership boundaries |
| V12 | 5 | G | Audited order/payment/fulfillment transitions and durable notifications; retries do not duplicate internal effects or expose another customer's details |
| V13 | 4 | H | Promotion eligibility and allocation; deterministic rounding order, exclusions, caps and repeated recalculation |
| V14 | 5 | H | Production tax quotation adapter/policy; immutable quote provenance and a clear outcome when the provider cannot quote |
| V15 | 5 | H | Shipping-rate and carrier selection strategy; declared package/address inputs and unavailable-provider behavior |
| V16 | 4 | H | Returns and partial-refund policy; maximum refundable quantity/amount, duplicate request and uncertain provider result |
| V17 | 4 | H | Marketplace seller attribution and settlement policy; isolate seller access and do not conflate customer payment with seller payout |
| V18 | 4 | H | Multiple currencies and conversion policy; snapshot rates/rounding and never silently reinterpret stored money |
| V19 | 4 | H | A real payment-provider adapter; map its signature, status, idempotency and reconciliation semantics to the already verified protocol |
| V20 | 4 | H | Inventory/ERP synchronization adapter; deduplicate source revisions and define conflict authority and recovery |

Critical foundation observations: V03 exact arithmetic; V05 atomicity; V06 last-item race; V07
transition guards; V08 callback authentication/unknown outcomes; V09 quantity ceiling; V11 isolation.
V08 earns protocol points only. V19 remains unearned until a concrete provider adapter is verified.

### Fixed end-to-end scenarios

1. **V-last-item:** SKU red has one sellable unit at 1999 USD minor units. Two independent customers
   checkout concurrently with distinct keys. At most one gets a reservation/order; loser receives
   declared stock rejection. No negative availability and no orphan successful order.
2. **V-repeat:** Drop the response after checkout commits. Same key/body returns the original order;
   same key/changed quantity returns 409. Changing catalog price afterward does not rewrite the order.
3. **V-unknown:** Reference provider accepts a charge but the response times out. Payment becomes
   unknown, order payment-review and stock held. A later signed settlement or reconciliation produces
   one paid transition. Duplicate or older failure events do not undo it; unsigned events change nothing.
4. **V-expire:** Worker dies before an active reservation expiry transaction. Restart, claim and expire
   once; availability recovers. A concurrent start-payment command either wins the valid transition
   and holds stock or loses and cannot charge against an expired reservation.
5. **V-ship:** Paid order quantity is 3. Shipment of 2 succeeds; repeat key returns the same shipment;
   a concurrent attempt to ship 2 more fails. The remaining shipment of 1 produces fulfilled state.

## 5. Zammad-core

### Architecture and data

C1 actors: customer, support agent, supervisor, administrator. External systems: email delivery,
object storage, and explicitly unfinished inbound-email/integration adapters. C2: thin portal and
agent consumers, help-desk API, worker, PostgreSQL, object storage and email provider. Timers and
notification channels use durable database-backed delivery initially.

C3: identity/access; organizations/groups; ticket lifecycle; articles/internal notes; assignment;
finite routing rules; SLA/deadline policy; calendars; attachments; search; notifications; audit.
Worker: deadline scheduling/escalation, outbound delivery, projections and adapter hooks.

Entities: organization, group, agentMembership, customerMembership, ticket, article, assignment,
calendarVersion, slaPolicyVersion, deadline, escalation, routingRuleVersion, attachment,
notification and auditEntry. A customer sees only their own tickets by default; organization-wide
visibility is a separate explicit policy choice. An internal note is agent-only everywhere,
including search snippets, exports, attachment bytes and email payloads. Customer-supplied fields
cannot select internal visibility, assignee, agent role or SLA override.

Ticket states: new/open/pending/resolved/closed. Reopen resolved->open is explicit. Closed->open
is unavailable in the core. First-response clock starts at creation, counts configured business
time, stops when a permitted agent publishes a customer-visible reply, and is unaffected by an
internal note or pending status. Closing cancels an unmet clock without marking it met. Reopening
does not silently create a new first-response clock; richer clocks are Z15.

Each deadline snapshots calendar and SLA versions. Baseline calendar: America/Chicago, Monday–Friday
09:00–17:00, explicit holiday dates, no remote calendar fetch. Duration is actual elapsed time whose
local wall time falls in a working interval: repeated fall-back time counts twice; missing spring
time contributes nothing. P87 implements this with a maintained timezone library and fixed fixtures.
Old deadlines do not silently change when an administrator edits a calendar; recalculation is a
separate versioned operation, not a side effect of editing a label.

| ID | Weight | Target | Observable capability and mandatory boundary |
| --- | ---: | --- | --- |
| Z01 | 5 | G | Customer/agent/admin sessions and capabilities; customer cannot self-promote or submit privileged ticket fields |
| Z02 | 5 | G | Organizations/groups and agent membership; direct/list access and assignment reject cross-scope or unauthorized users |
| Z03 | 6 | G | Create a ticket with initial public article atomically; retry after response loss returns one ticket/conversation entry |
| Z04 | 7 | G | Public replies and internal notes with immutable author/time; customer cannot read internal text or its attachment/search/notification projections |
| Z05 | 6 | G | Assign/reassign ticket to eligible agents with expectedVersion; stale concurrent assignment and revoked membership are rejected |
| Z06 | 6 | G | Ticket transitions and resolution/reopen behavior; failed transitions leave article, deadline and audit state consistent |
| Z07 | 5 | G | First-response SLA using snapshotted business calendar; weekends, holidays and timezone boundaries calculate correctly |
| Z08 | 6 | G | Durable escalation with cancellation/version checks; worker restart, overdue catch-up and duplicate claim cause one logical escalation |
| Z09 | 5 | G | Finite routing conditions/actions with explicit priority and loop prevention; rule matches cannot grant access or create unbounded cascades |
| Z10 | 5 | G | Ticket/article attachment lifecycle; inherit article visibility and handle partial bytes/metadata failures without disclosure |
| Z11 | 5 | G | Scoped ticket search, cursor pages and audit reads; internal notes remain hidden and stale projections cannot leak a group after revocation |
| Z12 | 5 | G | Customer/agent notification preferences, redaction and durable inbox/delivery intent; duplicates/revocation handled consistently |
| Z13 | 4 | H | Inbound email channel: authenticated ingest, MIME parsing, bounded attachments, deduplicated source message and sender identity mapping |
| Z14 | 5 | H | Conversation threading, ticket merge/split policy and preserved history/visibility; ambiguous message references require an explicit decision |
| Z15 | 5 | H | Additional response/resolution clocks, pause/reopen policy and controlled recalculation of existing deadlines |
| Z16 | 4 | H | External customer-system connector; field mapping, source authority, retry and reconciliation |
| Z17 | 4 | H | Knowledge-base publication and access policy; draft/public separation and article search contracts |
| Z18 | 4 | H | Domain-specific custom fields and conditional workflows; typed extension definitions without arbitrary script execution |
| Z19 | 4 | H | Customer export/erasure/retention policy with internal-note exclusion and audit/hold decisions |
| Z20 | 4 | H | Operational reporting definitions; business-time metrics, scoped aggregates and consistent counting of reopened tickets |

Critical foundation observations: Z02 cross-scope access; every Z04 disclosure path; Z05 assignment
race; Z07 calendar correctness; Z08 one logical escalation; Z10 bytes authorization; Z11 revocation.

### Fixed end-to-end scenarios

1. **Z-create:** Customer Alice submits a ticket. Inject failure before the initial article insert;
   neither record remains. Retry a committed request with lost response; exactly one ticket exists.
2. **Z-private:** Agent writes an internal note and attaches a file. Alice cannot see note text,
   attachment bytes, search snippets or email excerpts. Move the ticket to a group the agent cannot
   access; their future reads and queued sensitive effects are denied.
3. **Z-clock:** A 120-business-minute first-response ticket opens Friday at 16:00 local time.
   Deadline is Monday 10:00; with Monday a holiday it is Tuesday 10:00. An internal note does not
   stop it; a public authorized agent reply does. Assert exact UTC instants for the frozen calendar.
4. **Z-race:** Two assignments use ticket version 8. One wins version 9. A stale deadline handler
   races with a public response; its transaction rechecks current ticket/deadline version and cannot
   create an escalation for a clock already satisfied before its commit.
5. **Z-recover:** Worker is unavailable across several due deadlines. Restart and process bounded
   batches. One logical escalation per deadline version, an operator-visible backlog and no endless
   rule loop. Do not claim deadlines were met while the worker was down.

## 6. Required hook brief contents

P71–P73 must give **each H row** a typed hook contract, not just the table description. Use these
minimum seam groups; split a group into small tasks when it contains more than one independently
testable hook. No finishing task should require replacing an aggregate's entire implementation.

| Hook group | Minimum input | Required result and constraints |
| --- | --- | --- |
| D13 trust | Principal/activity snapshot, policy version | Proposed level + reasons; privileged change through the existing authorized command |
| D14 abuse | Content metadata/text, bounded history, rule version | allow/review/reject with safe reason; no direct database writes |
| D15 digest | Principal, window, eligible item references | Bounded selection + deduplication identity; access rechecked before materialization |
| D16 rendering | Plain source, format version, resource context | Sanitized representation + mention IDs; no network or permission grants |
| D17 merge/split | Source/target IDs and expected versions, selected post IDs | Validated command plan + affected identities; atomicity or explicit recovery required |
| D18/Z19 privacy | Subject, request kind, authority, retention/hold policy | Bounded export/erase plan, retained reasons, progress identity; no immediate unreviewed bulk wipe |
| D19/Z13 email | Verified source envelope, bytes reference, message ID | Normalized sender/thread/body/attachment candidates or rejection; normal API policy still applies |
| D20 ranking | Authorized candidate IDs/features, algorithm version | Ordered IDs and freshness; cannot add an unauthorized candidate |
| V13 promotion | Cart/quote snapshot and promotion set | Exact allocated adjustments or rejection; deterministic rounding and total invariants |
| V14 tax | Address/items/currency and request identity | Versioned quote with amounts/expiry/provider provenance or unavailable |
| V15 shipping | Address/package/cart snapshot | Bounded eligible service quotes + expiry; no untrusted price override |
| V16 returns | Paid/fulfilled/refunded snapshot, request and reason | Allowed quantities/amounts and next command; external uncertainty stays explicit |
| V17 marketplace | Seller attribution, settlement window, order/payment references | Entitlement/settlement plan; no direct cross-seller ledger mutation |
| V18 currency | Original exact amounts, rate snapshot, requested currency | Rounded converted quote + provenance; no rewrite of completed orders |
| V19 payment adapter | Durable provider request identity and typed amount; verified callback bytes separately | settled/failed/pending/unknown + provider references, or typed event; do not invent success on timeout |
| V20/Z16 connector | Source event/version and mapping configuration | Validated local command or reconciliation item with stable external identity |
| Z14 conversation | Message references, authorized ticket set, operation/version | Attach/create/merge/split decision with access checks and preserved provenance |
| Z15 SLA | Ticket timeline, selected policy/calendar version | Explicit clock create/pause/resume/recalculate decisions; no silent change to elapsed facts |
| Z17 knowledge | Publication request, content revision, audience policy | Validated publication/search plan; public and private outputs distinguished |
| Z18 custom workflow | Versioned custom schema, typed values, current lifecycle | Finite validated actions or rejected configuration; no eval/executable strings |
| Z20 reporting | Authorized scope, bounded time window, metric definition | Typed aggregate result and counting definition; no free-form SQL |

Every brief lists pure versus effectful execution, timeout/cancellation, errors, transaction boundary,
allowed services/repositories, private-data handling, acceptance IDs and allowed output files.
Development examples must not accidentally satisfy unimplemented H cases in production generation.

## 7. Workload profiles for P107

These are **proposed local engineering targets**, not upstream benchmarks or measured promises.
P59 freezes their first version; P107 records actual host CPU/RAM/disk, container limits, database
version, fixture seed and achieved results. If the host cannot run this reference profile, report
an untested target and separately label a smaller profile. Do not lower a target after a failure.

| Profile | Data cardinality | Sustained offered load for 10 minutes after warm-up | Target observations |
| --- | --- | --- | --- |
| D-core | 10k principals, 100k topics, 1m posts, mixed private/public groups | 50 requests/s: 70% reads, 20% search, 10% writes; at least 20 active clients | Read/search p95 <=500ms; command p95 <=1000ms; notification/projection lag p95 <=10s |
| V-core | 50k products, 200k variants, 100k historical orders | 20 requests/s: 70% reads, 20% cart commands, 10% checkout/payment fixture flow | Read p95 <=500ms; local command p95 <=1000ms; no stock/total invariant violations |
| Z-core | 20k customers, 1k agents, 100k tickets, 1m articles | 25 requests/s: 70% reads, 20% ticket/article changes, 10% search; simultaneous due timers | Read/search p95 <=500ms; command p95 <=1000ms; escalation lateness p95 <=60s while worker healthy |

Suggested reference host allocation: 8 logical CPUs, 16 GiB RAM, local SSD; record actual limits
instead of assuming them. Exercise one and two API instances with shared authoritative state.
Use open-loop offered load and report scheduled versus achieved rate, latency including failures,
error rate, queue growth, DB connections and resource use. Expected policy/conflict rejections are
counted separately, never erased from the report. Unexpected server failures target <0.1%.

Run separate contention tests with barriers: 25 simultaneous attempts for one stock item, 25 stale
updates to one revision, two deadline workers claiming the same batch. These are correctness tests,
not capacity estimates. Restart one API and one worker during a separately labeled recovery run;
record unavailable time, eventual backlog recovery and all invariant checks. No infinite stress,
multi-region benchmark, production credentials or live user data is required by this roadmap.
