# Backend capability settings

P66b adds optional `architecture.backend.capabilityConfigs`: at most 100 exact `{id, version}`
settings, each with `schemaVersion: 1`, a display name and an existing C2/C3 owner. The strict
schemas and pure validation live in `packages/spec/src/backend-capability-configs-model.ts` and
`backend-capability-configs.ts`. These are design declarations, with no scheduler, provider,
file inspection, search execution, calendar calculation or routing engine. Existing NEEDS_TEMPLATE
findings remain. P66c owns commerce settings and the combined P66 gate; P68c owns mouse editing.
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
references, provider interfaces/bindings, owners and datasets. Validation/removal preview, atomic saves,
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

Focused synthetic tests cover all seven kinds, positive/negative bounds and exact references,
calendar successors, provider uncertainty, sensitive observations, remapping, extraction/reuse and
export. Frozen application fixtures and ledgers remain unchanged. Complete application designs,
commerce options, authoring, matching/compilation and all runtime/provider evidence remain assigned
to their later units. CATALOG is unchanged because offerings, reusable C1/C2/C3 boundaries and
runtime availability did not change.
