# Exact backend effects and typed hooks

P66a extends the optional backend design model with exact `effects` and `hooks`. These are
validated design declarations. They run no handlers, providers, compensation or tasks and add no
runtime/generation availability. [Commands](backend-behavior.md), [policies](backend-access.md),
[data authority](backend-data.md) and [wire contracts](contract-types.md) retain their own authority.
See [P66](plans/backend-benchmarks/phase-2-design.md#p66) and the
[mandatory child boundaries](plans/backend-benchmarks/execution-units.md#mandatory-splits).

## Effects and commit boundaries

Each effect has an exact source backend operation/version, exact payload contract and typed
field bindings. Targets select an event and optional exact consumer, another backend operation,
a dataset, a query-backed projection, a notification operation with bounded recipient query,
an audit dataset/contract, or a typed effectful hook. Names never select behavior. Required
payload fields bind exactly once; nested input/current/prior-action values use the same bounded
assignability checks as P65. Target operation inputs must fit the payload without coercion.

| Execution | Boundary | Meaning |
| --- | --- | --- |
| Local | Before commit | Dataset/audit append intent shares source owner, store, connection and commit; one local attempt |
| Durable intent | Atomic intent | Domain state, receipt and typed event/delivery intent persist together; delivery is at least once |
| External | After commit | External operation/hook uses a stable attempt identity; ambiguous acknowledgement requires reconciliation |

A callback after commit is not an outbox. A required external effect needs a declared preceding
atomic intent before it is ready. External I/O cannot claim local SQL atomicity or a same-commit
acknowledgement. Cross-container operation/event/dataset use retains the exact C2 binding;
operation/event bindings also retain the actual component owners, direction and target operation.
A different interface on the same host cannot substitute for that binding.

Delivery identity includes operation version, trusted scope, source command, effect and recipient.
Notifications explicitly select each eligible recipient, a bounded query and current policy at
materialization/delivery. Background consumers require verified service context and a bounded
purpose; initiating actor fields are provenance only. Local appends use source transaction context.
Attempts, backoff, timeout, terminal acknowledgement, duplicate possibility and operator-visible
exhaustion are finite declarations. A stable identity never promises exactly-once external mail.
Required effects forbid loss; optional effects must give an explicit loss reason.

`after` references order effects of the same exact source and cannot reverse a commit boundary.
Effect order, hook dependencies, mixed hook/effect invocation and operation-effect invocation
cycles reject. This is a finite composition, not a recursive workflow or expression language.

## Hook seams and safe outcomes

A hook version names its source operation, exact owning component/container, exact data input,
output and error contracts, supplied context, private-data policy, dependencies, bounded repository-query/service-operation
references, allowed write proposals/effects, acceptance IDs and project-owned TypeScript file.
Paths are relative, bounded and cannot traverse directories. Seam files are unique per owner.

Pure hooks run as ordered P65 `hook` actions before commit using supplied snapshots. They cannot
access repositories/services or perform external effects. Input mappings and earlier hook results
are typed, and dependency actions must precede their callers. Hook timeouts fit the source deadline.
Current/created entity fields passed to a hook require that entity's read projection. A mutation
permission alone cannot disclose a snapshot. Hook results can propose only named fields through
subsequent explicit finite writers; they cannot overwrite protected IDs, principals, scope, clocks,
versions or lifecycle transitions. Results never write directly. A hook proposing source writes
is required.

Effectful hooks run through explicit after-commit effects and use verified service purpose.
Repository observations select exact bounded queries with a verified service policy and read
projection, and require current-policy rechecks. Cross-container services retain a declared allowed
operation effect and its C2 binding. They cannot write the already committed
source transaction. Named later operations and effects declare those responsibilities separately.
Effectful dependencies retain explicit effect ordering, and allowed effects cannot invoke themselves.

Required readiness is checked before any source mutation. Every hook has an exact unchanged
501/503 unavailable outcome with no writes, exact failure/invalid-result/timeout/cancellation
outcomes, cooperative cancellation and exact result validation before use. Pure failures belong
to the source transaction. Effectful failures belong to a **separate delivery operation** and
preserve the committed source result. A missing or malformed hook cannot claim success.
No implementation selector/evidence is supplied by these declarations; hooks retain NEEDS_TEMPLATE.

## Recovery and portability

Embedded recovery rows reference existing exact operation outcomes, scenario outcome IDs and
aggregate invariant IDs. They create no independently editable recovery graph. Supported triggers
are uncertain commit, lost acknowledgement, partial bytes, external timeout and hook failure.
Unknown commit/acknowledgement/timeout retains an Unknown/Reconcile first outcome. Recovery selects
the original command key, delivery identity, explicit reconciliation operation, unattached-byte
cleanup or confirmed local rollback, as appropriate. External timeout cannot invent a fresh charge
identity or confirmed rollback. Partial bytes explicitly select cleanup; no cleanup executes here.

Missing recovery/readiness decisions remain saveable source-addressed Review gaps. Dangling exact
references, contradictory outcomes/boundaries, invalid mappings and cycles reject atomic saves.
Referenced hook/signature versions remain immutable even through simultaneous consumer removal;
display names and explicit successor versions remain supported.

Shared reference helpers preserve effects/hooks through removal preview, extraction/insertion,
whole-boundary pinned reuse, target copy/diffs, chat JSON Schema, Review fingerprints and deterministic
JSON/Markdown handoff. Outer operation/contract/entity/query/dataset/owner/scenario/binding references
remap. Field/action/outcome/invariant/acceptance IDs, storage IDs and seam paths remain stable.
Legacy documents acquire no empty optional collections or second editable resource schema.

Focused synthetic checks trace create-post → audit/outbox → eligible notification, checkout →
payment attempt → callback/reconciliation, and a version-guarded deadline command → escalation.
They also represent field shapes and exact acceptance references for all 24 frozen H seams;
wire regex constraints remain in their frozen acceptance contracts. These are descriptor checks,
not complete benchmark application designs, provider certification or observed implementation points.

[P66b delivery/file/notification/search/calendar/routing settings](backend-capability-configs.md) are complete; P66c owns commerce settings
and the combined P66 gate. P67/P68 own mouse authoring, P69/P70 matching/pure compilation, and later
separately assigned packages own execution, SQL, file cleanup, providers and application evidence.
No CATALOG change: offerings, reusable C1/C2/C3 boundaries and runtime availability are unchanged.
