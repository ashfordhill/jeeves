# Exact assignment queue for implementation agents

The [roadmap](../../build-plan-backend-benchmarks.md) has 53 delivery packages. Some contain more
work than one modest implementation agent should attempt. The mandatory splits below produce
**79 sequential work units**. A split parent is a milestone, not a single agent assignment.

Assign one work unit, for example **P61b**, and commit with that exact ID. If asked to implement
a split parent without a suffix, implement its first unfinished child only, report that the parent
is still incomplete, and stop. Do not combine children because they touch nearby files. Each child
inherits the shared contract, its parent's exclusions/profile, and only the applicable steps and
acceptance cases. Later children consume earlier committed interfaces; they do not redo them.

An individual child is complete when its listed boundary, relevant parent checks and handoff pass.
The final child also verifies the parent's combined acceptance. Dependencies on a parent require
all its children. Preserve the full parent specification: splitting never drops a requirement.
Unsplit packages are already individual work units. This file takes precedence over wording in
a phase page that could otherwise be read as assigning a whole split parent to one session.

## Ordered queue

These are identifiers, not a script to execute automatically:

```text
Phase 1
P58 P59 P60a P60b P60c P61a P61b P61c P61d

Phase 2
P62a P62b P63a P63b P64 P65 P66a P66b P66c P67a P67b P68a P68b P68c
P69 P70a P70b P71a P71b P72a P72b P73a P73b

Phase 3
P74a P74b P75a P75b P76 P77 P78 P79 P80 P81a P81b
P82 P83a P83b P84 P85 P86 P87 P88 P89

Phase 4
P90 P91 P92 P93a P93b P94 P95 P96a P96b P97 P98
P99 P100 P101 P102

Phase 5
P103 P104 P105 P106a P106b P106c P107a P107b P108a P108b P109 P110
```

## Mandatory splits

| Parent | Work unit and exact ownership | Child completion evidence |
| --- | --- | --- |
| [P60](phase-1-foundation.md#p60) | **P60a:** Discourse pin, licenses, inspected access/content/async seams and D-row map. **P60b:** same for Vendure and V rows. **P60c:** same for Zammad and Z rows, then cross-reference manifest review. | Each pin is fetchable and hash-verified; inspected guarantee/adaptation map is complete for that application. P60c verifies all three packs coexist without replacing earlier reference pins. |
| [P61](phase-1-foundation.md#p61) | **P61a:** common error/auth/paging/idempotency protocol, fixture/observation schema and identity validation. **P61b:** all D operations, observations and fixed expected fixture values. **P61c:** all V operations/observations and money/stock/provider fixtures. **P61d:** all Z operations/observations and calendar/private-note fixtures. | P61a validates a tiny synthetic protocol fixture. Each application child resolves every ledger row without using runtime-generated expectations. P61d closes the combined 60-row coverage/reference gate. |
| [P62](phase-2-design.md#p62) | **P62a:** local type references, maps/tagged unions, bounded resolution and reference preservation. **P62b:** transport mappings, binary descriptors, source protection and end-to-end schema export. | P62a proves cycles/budgets/version immutability and old nested-shape compatibility. P62b proves method/path/status/content mappings and portable definitions without runtime support claims. |
| [P63](phase-2-design.md#p63) | **P63a:** entity/aggregate schemas and stable dataset/field references. **P63b:** bounded queries, cursor/projection/joins and read-only legacy-resource adapter. | P63a models all three root/child aggregates and rejects conflicting stores. P63b rejects unsafe/unbounded queries and proves no second editable legacy schema was created. |
| [P66](phase-2-design.md#p66) | **P66a:** exact effects, typed hooks, failure/recovery references and dependency validation. **P66b:** typed delivery/file/notification/search/calendar/routing settings and their references. **P66c:** typed money/cart/inventory/order/payment/fulfillment settings and combined export/remapping checks. | Each child validates only its finite vocabulary with negative cases; no runtime is implemented. P66c confirms every setting needed by the three design examples is representable without opaque configuration strings. |
| [P67](phase-2-design.md#p67) | **P67a:** type/data/aggregate/query subeditors and reference navigation. **P67b:** finite access-policy editor, affected-path preview and chat discoverability. | Each child inspects its own Save/Cancel/reload/undo/conflict and narrow-screen workflow. P67b verifies cross-navigation between the editors; no deferred UI suite work. |
| [P68](phase-2-design.md#p68) | **P68a:** command/lifecycle/guard/action editor. **P68b:** effect/hook editor, failure-scenario navigation and combined chat edits. **P68c:** reusable capability-setting editors for P66b/P66c, exact reference selection and schema diagnostics; runtime support matching follows in P69. | Each child proves its domain examples by mouse. P68b checks operation-to-effect and atomic chat/undo. P68c verifies calendars, notifications, files and commerce settings can be saved/reloaded without JSON/code textareas, completing the parent authoring gate. |
| [P70](phase-2-design.md#p70) | **P70a:** IR types, data/query/policy lowering, deterministic IDs/source maps. **P70b:** operation/effect/hook lowering, generation modes, complete plan preview and legacy guard. | P70a has pure isolated fixtures. P70b proves unsupported/cyclic paths block and the old generation fixtures retain their supported output. Neither child renders a new runtime. |
| [P71](phase-2-design.md#p71) | **P71a:** Discourse context, containers, components, contracts, entities and access. **P71b:** operation/effect bindings, all H hook briefs, five scenarios, focused views and final case trace. | P71a's example is explicitly partial. P71b resolves all D design obligations and verifies export/editing, leaving runtime availability honest. |
| [P72](phase-2-design.md#p72) | **P72a:** Vendure boundaries, contracts, money/data ownership and access. **P72b:** state/transaction/payment/recovery behavior, H hooks, scenarios and final trace. | P72a preserves exact monetary/storage meaning. P72b passes the design review for last-item, unknown payment and fulfillment without fictional cross-network atomicity. |
| [P73](phase-2-design.md#p73) | **P73a:** Zammad boundaries, contracts, private articles, organizations and calendar data. **P73b:** commands/deadlines/effects, H hooks, scenarios and combined three-app design gate. | P73a remains explicitly partial. P73b proves all 60 rows have complete design references and no invented runtime evidence. |
| [P74](phase-3-runtime.md#p74) | **P74a:** backend runtime host, serialized descriptor validation, REST adapter and typed safe hook scaffolds. **P74b:** generator writer/lock/mode integration, manifest registration, minimal preview and evidence distinction. | P74a proves a tiny runtime consumer independently. P74b proves actual fresh generation/regeneration, unsupported blockers, protected files and old generation compatibility. |
| [P75](phase-3-runtime.md#p75) | **P75a:** stable relational DDL, constraints and immutable/additive migration planning. **P75b:** parameterized data/query compiler, bounded cursors and transaction interface. | P75a uses real PostgreSQL constraint/migration failures. P75b proves query bounds, two independent applications, version semantics and no unauthenticated exposed route. |
| [P81](phase-3-runtime.md#p81) | **P81a:** byte-store interface, selected local test provider, upload/download streaming limits and safe object identities. **P81b:** attachment association/states, current-policy reads, durable cleanup and generated composition. | P81a tests protocol/size/content/path failures. P81b tests D09/Z10 access and interrupted bytes/SQL boundaries; no stale cleanup can delete a live attachment. |
| [P83](phase-3-runtime.md#p83) | **P83a:** bounded outbound mail/reference-HTTP transport, unknown results and safe logging. **P83b:** raw-byte callback authentication, replay receipts, durable acknowledgement and fixture modes. | Each has independent provider-failure tests. P83b integrates them without treating transport acknowledgement as business completion. |
| [P93](phase-4-applications.md#p93) | **P93a:** exact money, fixed-price quote and catalog visibility capability. **P93b:** cart command semantics, finite pricing/shipping hooks, generation and second-consumer proof. | P93a proves arithmetic/type/visibility bounds. P93b proves stale/repeated cart mutations, no client price authority and explicit fixture-versus-real strategy selection. |
| [P96](phase-4-applications.md#p96) | **P96a:** durable attempts, reference dispatch, verified callback-to-domain mapping and monotone terminal transitions. **P96b:** uncertain outcome/reconciliation, stock holding/settlement integration and race recovery. | P96a keeps unknown states visible, with reconciliation still incomplete. P96b passes the full V08 matrix and never duplicates a charge with a new key after uncertainty. |
| [P106](phase-5-proof.md#p106) | **P106a:** shared fault-controller protocol and discussion campaign. **P106b:** commerce campaign. **P106c:** help-desk campaign and combined result validity/cleanup review. | Each app passes its exact failure observations with recorded injection points; faults are absent from production APIs. P106c verifies all three and interrupted-run handling. |
| [P107](phase-5-proof.md#p107) | **P107a:** deterministic cardinality seeders, open-loop driver, resource/evidence capture and short smoke validation. **P107b:** full three-app one/two-instance runs, contention/restart observations and analysis. | P107a does not claim workload targets met. P107b preserves failed/undersized results, reports achieved rates/latencies/limits and does not change frozen targets. |
| [P108](phase-5-proof.md#p108) | **P108a:** shared upgrade harness plus discussion seeded regeneration/upgrade. **P108b:** commerce/help-desk rehearsals and cross-version compatibility report. | Each app preserves storage/custom hooks and blocks tampered/unsafe changes before writes. P108b verifies old queue/calendar versions and final parent gate. |

## Continuations and defects

A unit should change one new semantic/runtime boundary or one bounded composition. If reality makes
even that too large, record an explicit smaller continuation with unchanged acceptance before
starting a neighboring unit. An incomplete unit does not get a completion claim. Dependency fixes
must be scoped, recorded and reverified; do not bury unrelated cleanup in a benchmark assembly.

The unit's final message should say: what now works, exact checks, any remaining blocker, commit
ID, and the next **unstarted** work-unit ID. The next ID is information for the user, not permission
to keep executing. The project remains sequential and manually assigned.
