# Backend capability settings

P66b/P66c add optional `architecture.backend.capabilityConfigs`: at most 100 exact `{id, version}`
settings, each with `schemaVersion: 1`, a display name and an existing C2/C3 owner. The strict
schemas and pure validation live in `packages/spec/src/backend-capability-configs-model.ts` and
`backend-capability-configs.ts`. These are design declarations, with no scheduler, provider,
file inspection, search execution, calendar calculation, routing or commerce engine. Existing NEEDS_TEMPLATE
findings remain. All three P66 children and the combined design-settings gate are complete; P68c owns mouse editing.
See the [settings matrix](plans/backend-benchmarks/contract.md#minimum-useful-component-configuration)
and [exact child boundaries](plans/backend-benchmarks/execution-units.md#mandatory-splits).

Definitions reference existing [entities/queries](backend-data.md), [current policies](backend-access.md),
[commands/lifecycles](backend-behavior.md) and [effects/hooks](backend-effects.md). Display strings
never select behavior. Raw JSON, SQL, code strings, unspecified strategy options and arbitrary
provider URLs/credentials have no configuration field.

| Kind | Checked design options |
| --- | --- |
| `delivery` | Exact effect, named queue/event, immediate/event timestamp/business deadline, attempts, fixed or capped exponential backoff, fenced lease, timeout/deadline, persisted terminal acknowledgement, unknown/reconcile outcome and duplicate policy |
| `files` | Exact metadata/parent entities, provider binding, positive maximum bytes, finite MIME list, signature inspection or required inspection hook, parent read/bytes policy, exact lifecycle states, durable bounded orphan cleanup with version/state recheck |
| `notifications` | Exact notification effect and bounded recipient/preference queries, typed event timestamp and subscription cutoff filter, per-recipient preference equality filter, current service policy and projections, bounded paging/per-job recipient count with durable cursor continuation, inbox/external channels and per-recipient/channel identity |
| `search` | Exact source fields, PostgreSQL full-text v1/language choice, projection dataset/version, current policy before counts/snippets/pagination, bounded query length/results, synchronous or bounded-staleness delivery, bounded rebuild and atomic projection version swap |
| `calendar` | Immutable version, IANA timezone, ISO weekdays 1–7, local minute intervals and real ISO holiday dates; holidays override weekly opening intervals and an empty override closes the date |
| `business-time` | Exact calendar/entity/lifecycle, positive working-minute duration, distinct typed start/stop events, restart policy, server-owned due timestamp and bounded revision, running states and stale-job/current-policy recheck |
| `routing` | Exact source operation, existing guard/action IDs, unique rule priorities, first/all match, finite maximum actions, command/rule/action identity, required same-commit audit and no recursive rule execution |
| `money` | Exact money-storage fields, allowlisted three-letter currencies, safe minor-unit/unit-total bounds, positive quantity/line limits, checked integer arithmetic and overflow rejection |
| `cart` | Exact aggregate/line/parent relation, variant/quantity, money settings, versioned fixed-price or required pure hook, flat/hook shipping, explicit fixture/hook tax, promotion/currency hooks, quote expiry/snapshots/provenance and exact add/change/remove commands |
| `inventory` | Exact stock/reservation aggregate and owned relation, location/variant, on-hand/reserved/quantity counts, stable row locks, exact lifecycle states, persisted expiry/delivery/guard references and payment-held stock policy |
| `order` | Exact cart/inventory/money settings, checkout/cancellation guards, immutable typed line/address/price/quantity/total/provenance snapshots, lifecycle/payment-review state and one-store transaction boundary |
| `payment` | Exact durable attempt/amount/unique provider identity, order/inventory/money settings, lifecycle states, provider binding, after-commit dispatch effect, raw-byte callback verification, replay window and exact reconciliation delivery/outcome |
| `fulfillment` | Exact order/payment/inventory settings, aggregate/lifecycle/guard references, unique shipment identity, ordered/paid/reserved/fulfilled/requested quantities, partial-shipment ceiling and stable replay |

All numeric options have explicit upper limits in the schemas; collection limits bound authoring,
not measured workload. Unsupported concrete runtime combinations remain the responsibility of
P69's matcher. No descriptor earns implementation points.

## Delivery, providers and sensitive observations

A queue event selects the exact durable intent payload. For an after-commit external effect, it
selects an explicitly preceding durable intent of the same source operation. Delivery options
agree with the effect's attempts, initial backoff, timeout and duplicate policy. Exponential backoff
means doubling from the initial delay up to its explicit cap. Timeout fits the lease, lease fits
the deadline, and backoff fits the deadline. Claims use fenced tokens; stale acknowledgements reject;
shutdown stops claiming and cooperatively cancels work. A terminal result is persisted before ack.
These are required execution semantics for a future implementation, not an executed lease protocol.

Providers retain exact contracts, provided interfaces, operation IDs and C2 bindings with the
actual consuming C2/C3 owner. Fixture and deployment selections carry external configuration
registry IDs; deployment selection carries a credential reference, never its value. These registry
identities are stable external inputs, not architecture deployment-environment IDs or proof that
credentials/provider access exist. P69 and runtime packages must resolve their actual availability.
A provider without destination deduplication declares possible duplicates and reconciliation
before retrying an ambiguous result. The reconciliation outcome must retain Unknown/Reconcile first;
SMTP-style acknowledgement cannot become exactly-once delivery or confirmed rollback.

File bytes require current parent authorization and attached state. File metadata has an explicit
same-scope parent relation. Required inspection failures quarantine; cleanup has a finite age/batch
and must recheck unattached state/version before deleting bytes. Live attachments are preserved.
Neither inspection nor deletion runs in this package.

Notification cutoffs select a timestamp field on the source event and a timestamp `lte` filter on
the bounded recipient query. Preferences select a UUID principal output, an equality filter on that
same field, and a boolean enabled output. Eligibility/content use current verified service policy
at job, materialization and delivery sites. Joined content retains its own current policy/projection.
Redaction precedes sensitive materialization/delivery. Each recipient/channel has a stable delivery
identity; a bounded batch cannot silently become unbounded expansion inside the request transaction.

Search policy applies before paging, counts and snippets; the query must retain the exact root,
search site and policy projection. An asynchronous projection cannot overwrite its source dataset.
Freshness is a design target; no index lag or rebuild throughput has been measured.

## Calendars, clocks and finite routing

Calendar intervals are local half-open `[startMinute, endMinute)` ranges within one day. They must
have positive length, cannot overlap, and cannot cross midnight; author an overnight opening as
separate daily intervals. Adjacent intervals are allowed. Weekly days and holiday dates are unique;
invalid dates and invalid/offset-only timezone identifiers reject. Working time counts elapsed real
minutes inside local opening intervals, including daylight-saving transitions. No time arithmetic
runs during validation. A clock can explicitly never restart (the core first-response choice), preserve elapsed time or reset on reopen. Calendar successors are explicit choices.
Existing clocks pin their exact immutable calendar version; publishing a successor does not rebase
them. Both start/stop and lifecycle references remain exact.

Routing priority is ascending (smaller number first). `first` stops at the first matching rule;
`all` applies matching rules in that order. Predicates reference the source operation's existing
finite guards, with explicit all/any combination, and actions reference its existing finite patch/transition actions. Rules cannot invoke hooks or mutate persisted role/membership authority.
The declared maximum must fit every possible result; truncating a result is invalid. All-match
rules cannot repeat an action reference. Audit shares the exact source transaction. These settings
introduce neither an expression language nor arbitrary service invocation.

## References, edits and portability

The shared traversal covers exact contract/entity/query/policy/lifecycle/operation/effect/hook/config
references, aggregate references, provider interfaces/bindings, owners and datasets. Validation/removal preview, atomic saves,
contract protection, extraction/insertion, whole-boundary pinned reuse, target diffs, chat JSON Schema,
Review fingerprints and deterministic handoff JSON/Markdown retain settings and supporting C2 graphs.
Outer IDs remap. Local fields, query output/filter/projection IDs, rules/actions/guards/states, queue
channels, timezone/date values and external environment/credential registry IDs stay stable.

A saved calendar version is immutable, including through simultaneous consumer removal. Referenced
configuration versions, policies, lifecycles, inspection hooks and contract signatures likewise keep
their semantic identity; display names can change and explicit successor versions can coexist.
Missing current-policy rechecks remain source-addressed saveable Review gaps. Dangling references,
wrong kinds, contradictory bounds/ownership and malformed choices reject the entire edit.
Legacy designs acquire no optional collection or second editable resource authority.

Focused synthetic tests cover all thirteen kinds, positive/negative bounds and exact references,
calendar successors, provider uncertainty, sensitive observations, remapping, extraction/reuse and
export. Frozen application fixtures and ledgers remain unchanged. Complete application designs,
authoring, matching/compilation and all runtime/provider evidence remain assigned to their later units. CATALOG is unchanged because offerings, reusable C1/C2/C3 boundaries and
runtime availability did not change.


## Commerce meaning and finite composition

Money fields select the existing compound money storage annotations; currencies and safe integer
bounds must fit the exact contract. `maximumMinorUnits <= maximumTotalMinorUnits`; minimum and
maximum are ordered. Quantity is at most 1,000,000 and line count at most 1,000. Bounds are rejection
limits: multiplying allowed quantities/prices/lines can exceed the total bound and must reject
before writing. This package validates descriptors, not a pricing algorithm.

A quote uses server catalog authority and validated required hooks. Fixed pricing is pinned `v1`;
shipping can be an explicit flat minor-unit amount. Tax can be fixture zero or a bounded fixture
basis-point rate with half-up rounding on subtotal; both mark production support unavailable.
The frozen Vendure fixture's 750 basis points and 500-minor-unit flat shipping fit these choices
without changing its 1,999 subtotal / 150 tax / 2,649 total expectations. Production tax/shipping
are required typed hooks. Promotion/currency hooks retain their purpose and exact hook versions;
local pricing hooks are pure before-commit seams. Actual hook signatures, failures and ownership
remain in the common hook definitions. Quote expiry, snapshots and provenance use exact entity
fields. Stale quote/version/currency/total rejects before mutation; client prices supply no authority.

Inventory on-hand includes reserved stock. Available means on-hand minus active and held
reservations. Stock and reservation rows belong to one authoritative aggregate with stable row
locks. Expiration references a persisted event-time delivery and exact guarded consumer, with
state/version/due rechecks under the same lock. Only active reservations before payment can expire.
Held stock never releases automatically; only confirmed terminal payment or explicit reconciliation
can resolve it. The inventory and payment configurations must reference each other's exact version.
This declarative reference cycle does not execute a recursive workflow.

Order snapshots require variant, quantity, unit price, line total, address, order total and quote
provenance. Source and target preserve the same complete value shape and bounds, copying cart
fields into order authority. Snapshot targets are unique. Checkout includes cart, order and stock
participants in one store; no network call is part of it. Cancellation during payment uncertainty
requires reconciliation before release.

Payments require destination deduplication, a persisted UUID/bounded text primary or unique request
identity and the same key after an ambiguous result. Dispatch is after commit, retains an exact
provider adapter (or project-owned effectful hook plus its provider binding), and references timeout
recovery through reconciliation. Callback authentication uses original bytes, provider credentials,
timestamp and replay policy; durable event receipt precedes acknowledgement. Reconciliation and
its delivery share an explicit Unknown/Reconcile first outcome. Settled state cannot transition
back to an older failure. An unknown attempt keeps order review and stock held; it never implies
rollback or a new attempt key. Provider availability and actual authentication remain unverified.

Fulfillment retains distinct ordered, paid and already-fulfilled counts plus reservation and
requested quantities. Its positive bounded quantity is at most paid, reserved and unfulfilled
quantity; committed partial shipments sum under the order-line lock. A scoped unique shipment
identity and command receipt preserve one shipment on replay. No shipment is executed here.

P65's single-aggregate check needed a bounded dependency extension for these descriptors.
`backendTransactionAggregates` derives a finite union only for an exact configured checkout
(cart/order/inventory), cancellation (order/inventory), callback/reconciliation (attempt/order/
inventory), or shipment (fulfillment/order/inventory). Each original entity retains one aggregate
owner; all participating aggregates share an application and authoritative store. The existing
transaction entity list must equal that union exactly; arbitrary extra participants still reject.
Commerce settings declare stable aggregate/entity/primary-key lock ordering, alongside each
aggregate's concurrency checks and explicit cart quote/version rechecks. Additional fields and
transitions retain their own access, selectors and declared writers. No general multi-store
transaction language or second editable transaction graph is introduced. Future compilation must
consume both the exact settings and this derived union.

## Combined P66 representability gate

| Example | Typed settings available before its full design assignment |
| --- | --- |
| Discourse | Delivery and exact event intent, files/current parent policy, recipient/preferences/cutoff notifications, scoped search and finite routing/review |
| Vendure | Money/quote/cart, stock/reservation/expiry/hold, immutable orders, provider callback/uncertainty/reconciliation and bounded partial fulfillment, plus common delivery/search/notifications |
| Zammad | Immutable IANA calendar/weekly/holiday intervals, start/stop/restart business clocks, durable deadlines, files/private parent policy, redacted notifications/search and finite routing |

The synthetic combined gate exports every setting together with unchanged exact operations,
lifecycles, effects, hooks and recovery scenarios/invariants. Extraction/insertion, whole-boundary
reuse, target copy/diffs, chat JSON Schema and deterministic handoff preserve them. Local fields,
state/guard IDs, strategy versions, rate/rounding options and external provider registry identities
survive outer remapping. The P66a selector also retains all 24 H-row typed signatures and the
post -> intent -> notification, checkout -> attempt -> callback/reconcile, and deadline -> escalation
traces. These establish representability and portability, not completed P71–P73 designs, matching,
generation, runtime behavior or observed implementation points. **P67a is next unstarted.**
