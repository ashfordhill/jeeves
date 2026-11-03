# Finite backend commands and lifecycles

P65 adds optional `lifecycles` and `operations` to the existing versioned backend design model.
These are checked declarations of local behavior. They supply no command engine, SQL, execution,
application generation or observed benchmark evidence. [Data/aggregate authority](backend-data.md),
[policies and trusted context](backend-access.md), and exact [wire contracts](contract-types.md)
remain the source of truth. See the [P65 specification](plans/backend-benchmarks/phase-2-design.md#p65)
and [shared command contract](plans/backend-benchmarks/contract.md#commands-and-local-transactions).

## Exact bindings and values

An operation version selects one exact API operation, its provided interface owner, aggregate,
policy/action, projections and local transaction. The operation and aggregate share one owner.
Existing operation access bindings must agree with that selection. UX5 behavior/outcome prose
explains the decision; it is never parsed as code. An explicit UX5 Command/Query kind must agree.

Existing-row commands bind `identity` to every root primary-key field in order. Scope comes from
server-authorized context, never an input override. Child mutations and child transitions bind their
own exact `key`; root actions reuse the operation identity. Inserts instead get identity through
explicit field bindings. A missing selector is an editable readiness gap; a contradictory selector
is a structural error. The finite action model addresses at most one record per entity in a command.
It does not imply an unbounded update, row loop or bulk recipient expansion.

Bindings use stable field IDs, including nested input/result paths, rather than wire display names.
Values come from typed input, trusted principal/scope/correlation, current aggregate fields,
server UUID/UTC clock/version factories, bounded scalar literals, earlier action results or the
selected bounded query result. Types, requiredness, nullability, enum values and numeric/text/list
bounds must fit the target without coercion. Composite object/array mappings retain their exact
field IDs and bounds. Bounded whole maps and compatible tagged-union arms can pass through;
structural transformations need a separately supported strategy.

Queries select an exact P63 query with the same root/policy/read projection. Optional `queryInputs`
select allowlisted filters and comparisons with typed input/context/literal values. `in` retains
its list bound; only `is-null` omits a value. `query-result` is a bounded array of that query's
projected rows, including left-join nullability. A read-only operation cannot add actions, writes,
command receipts, work-start effects or a detached current-entity output that bypasses the query.
Cursor encoding/execution and SQL are deferred; P63 retains pagination and unique tie-break rules.

## Lifecycle tables, guards and actions

Each lifecycle owns one aggregate enum field at an exact version. Its states must equal the
required nonnullable field's enum. Initial state, unique transition IDs/pairs, exact from/to states,
guard references and reachability are checked. Successor versions may share the same field;
a second lifecycle identity cannot claim it. Referenced exact lifecycle semantics remain immutable
through consumer removal/migration. Names remain editable; explicit successors preserve history.

Guards are bounded, flat, named comparisons or presence checks over typed input, trusted context,
current fields and literals. Operation guards all run before writes. Lifecycle guards have no wire
input or action-result context. Transitions require the declared current from-state and all selected
guards; mismatches use the unchanged conflict/rejection outcome. Ordered guards require required,
nonnullable integers or UTC timestamps. Guards contain no expression strings or recursive graph.

| Action | Meaning and constraints |
| --- | --- |
| `create` | Insert one aggregate root; bind all required fields and lifecycle initial state |
| `create-child` | Insert one declared owned aggregate child with explicit values |
| `patch` | Update only named fields on the addressed row |
| `transition` | Apply one exact lifecycle transition; only this action can change existing state |
| `add-relation` / `remove-relation` | Set exactly the non-scope relation keys; removal requires explicit null and nullable keys |
| `append-revision` | Insert a new immutable revision child; it is never an update of an old revision |
| `capability` | Invoke a finite named domain strategy with typed inputs and an exact result contract |

Each field has exactly one writer. `writes` must equal all action writes, including transition
state and version writes. Cross-aggregate/store writes, missing fields, duplicate writers and
undeclared writes reject atomically. Server identity/scope/principal fields use their matching
factory/context on insertion. Clocks use the server clock. Revisions use initial version 1 on
insertion and a checked increment on update; overflow fails before writing. Client values, literals
and strategy results cannot replace protected values. Newly inserted rows have no pre-insert
current snapshot; later actions use their typed result.

Capability actions produce validated results; subsequent explicit actions perform any proposed
writes. They cannot hide database writes or external I/O. The initial registered design signature
`checkout-order@v1` accepts stable input `cart-id: UUID`, bounded `maximumLines` options and an exact
data result containing required `order-id: UUID`. This signature supplies no checkout algorithm,
pricing, stock mutation or runtime availability. Adding other domain strategies requires a named,
reviewed schema. An unknown choice uses explicit `unsupported` identity and typed result contract;
it emits a source-addressed blocker, never an inferred application hook or executable text.

Bounds: 100 lifecycle versions, 40 states, 30 transitions per lifecycle, 200 operation versions,
20 guards/actions/filter bindings, 100 declared field writes, 20 outcomes and five field-path levels.
These are authoring/compiler bounds, not workload or performance promises.

## Local consistency, identity and outcomes

The intended command pipeline is fixed: validate strict transport/input and establish trusted
context; check required implementation readiness before mutation; begin one transaction; resolve
command identity and lock/CAS addressed aggregate rows; recheck current access/state; run guards;
perform the ordered finite actions/strategies; persist terminal receipt with state; commit;
serialize the selected outcome. No external calls run inside that transaction. P66a will separately
bind audit/event intent and hooks; those declarations must share the promised commit boundary.

A transaction lists exactly its aggregate participants and authoritative store, uses one connection,
current-state access checks, aggregate concurrency, confirmed rollback on local failure and unknown
commit on ambiguous disconnect. Optimistic commands require a typed expected version and exactly
one root-version writer; insertion bootstraps version 1 with expected initial version 0. Row-lock
commands inherit the aggregate's stable entity-ID/primary-key order and addressed row set.
This describes required CAS/locking behavior; it does not implement a transaction or simulate races.

Command identity is operation version + authenticated scope + principal/service identity + key.
The key is required, nonempty bounded text, at most 200 characters. The canonical normalized-input
SHA-256 hash includes every top-level wire input except that distinct key, once. Same-key/same-input
calls have one writer with bounded wait/retry; changed input conflicts. A successful terminal result
and receipt commit with the mutation; rollback leaves no successful receipt. Current policy and
read projections are rechecked before replay, including private child outputs. The published default
window is seven days; expired keys are new commands, and cleanup is a separate controlled policy.
No descriptor promises eternal deduplication or exactly-once external delivery.

Commands select exact UX5 outcome IDs for success, conflict, rejection, confirmed failure,
unavailable implementation, cancellation and uncertain commit. Missing decisions are readiness
gaps; nonexistent or contradictory outcomes are structural errors. Success is Committed, an optional
no-op success is Unchanged, conflict/rejection/failure/unavailable/pre-commit cancellation are
Unchanged, and uncertain commit is Failure + Unknown + Reconcile first. Non-success outcomes cannot
return mutation action results. Every required output field has a checked mapping. Cancellation is
cooperative with a bounded deadline: before commit it rolls back, after commit it preserves the
committed or unknown result. `startsWork` explicitly records commands that initiate work; it does
not implement a worker, timer, forced interruption, external cancellation or saga.

The selected root policy protects root writes/results. Each child with written or observed fields
needs its own exact participant policy/projections; root permission cannot expose a private article.
Read and idempotent-replay checks cover current/create-result output fields. Existing policy
immutability and single session authority remain intact.

## Editing, portability and limits

Shared collectors preserve declarations through atomic saves, removal preview, exact contract/policy
protection, extraction/insertion, whole-boundary reuse, target diffs, chat JSON Schema, Review,
deterministic JSON/Markdown handoff and fingerprints. Outer owners/contracts/entities/aggregates/
policies/queries/lifecycles/store identities remap. Field paths, action/guard/transition IDs, outcome
IDs, state values, physical storage IDs and external strategy registry identities remain stable.
Missing behavior decisions and unsupported choices appear as `BACKEND_BEHAVIOR_GAP` in Review with
the exact source path; availability blockers stay visible. Legacy saved models acquire no empty
collections, new resource schema, command engine or implicit migration.

Synthetic offline tests express separate edit/close, checkout/order transition and assign/resolve
bindings, bounded query results, root/child/revision insertion, direct relation changes, protected
values, negative matrices and portable compositions. They are not the three complete application
designs or runtime/benchmark evidence. No CATALOG change is required: offerings, reusable C1/C2/C3
boundaries and implementation availability are unchanged.

P66a is next: exact effects, typed hooks and recovery dependencies. P67/P68 own mouse authoring,
P69/P70 matching/pure compilation, and later separately assigned packages own runtime enforcement,
SQL, money/inventory algorithms, receipt concurrency, cancellation and observed application checks.
