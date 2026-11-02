# Phase 3 — Reusable executable backend capabilities

Read the [shared contract](contract.md), relevant [benchmark rows](benchmarks.md), P58 verification
baseline and your package. This phase starts only when a runtime execution package is requested.
P73's completed design gate is required. Do not mutate existing frozen runtime/template versions.

The proposed new implementation home is `packages/backend-runtime/`, with small modules for data,
policy, commands and related mechanisms, and `templates/backend-core/` for generation/wiring.
It consumes serialized runtime descriptors, not Jeeves's editable DesignDocument or UI modules.
Separate packages are justified when dependencies or release boundaries require them; a C3 box
does not automatically require a new npm package. Each changed published contract gets a new exact
version. P89 freezes a supported release set; it cannot rewrite any earlier issued artifact.

## P74

**Outcome:** the new compiler path can produce a runnable backend host, contracts and safe hook
skeletons, without pretending data behavior already exists. **Depends on:** P73. **Profile:** R + A
for the minimal generation-mode preview.

**Read/change:** generator plan/generate/lock/modules; template-kit contract; registry; HTTP and REST
template version patterns; generation service/drawer; proposed backend-core template/runtime.

1. Add runtime descriptor validation, module registration, startup readiness and graceful shutdown.
   Reuse Fastify bootstrap, sessions and existing environmental validation through versioned adapters.
   New code must not silently alter legacy `rest-api-server` owner-resource semantics.
2. Render declared REST contracts, input/output adapters, typed hook interfaces and scaffold-once
   hook files. Missing required hooks return the exact unavailable result before writes. Keep a
   ready host distinct from an available business operation. Do not expose fixture control routes.
3. Connect P70's executable plan to the existing writer/lock. Add exact provenance, mode and source
   maps; vendor runtimes; register manifests/modules together. Check unsupported capabilities before
   touching output. Materialize only a transient executable projection if reusing legacy emitters;
   the saved design keeps its planning data and every original obligation remains traceable. C2,
   C3 and relationship bindings must all resolve. Pure analysis remains usable when generation blocks.
4. Implement explicit foundation generation preview with unsupported/pending/supplied counts.
   Preserve complete-application and legacy gates. Record foundation status separately in evidence;
   pending application cases must not make the result appear fully accepted.

**Done when:** a tiny supported contract + unavailable hook generates twice identically, installs,
typechecks, starts, serves a validated unavailable response and shuts down. Hand-edited protected
files stop regeneration; hook edits survive it. Unimplemented persistence/authorization capabilities
remain blockers until their packages complete. Existing generator output/recipe tests remain valid.

**Not here:** granting all benchmark capabilities to the new template, new password crypto,
automatic data migrations, business-state mutation or an arbitrary feature-code generator.

## P75

**Outcome:** declared entities and bounded queries compile to real PostgreSQL persistence.
**Depends on:** P74. **Profile:** R.

**Read/change:** existing stable-ID resource migration generator, backend IR, new data runtime and
template emitter. Keep new-model migrations in a distinct documented namespace.

1. Generate stable physical table/column/index identities, scalar constraints, primary/foreign/
   unique keys and immutable migration files. Support specified nullable relations/join entities,
   boolean/updated timestamps, safe integers and money descriptors. Do not emit destructive changes.
2. Compile parameterized insert/update/read/query primitives with allowlisted fields/projection/
   filters/order and keyset paging. They require trusted scope/policy context; no unauthenticated
   public query route is supplied before P76.
3. Supply a transaction interface with explicit connection ownership, statement/lock timeout,
   cancellation and error propagation. Keep database-clock timestamps and row versions consistent.
4. Add additive migration planning and reject changes requiring backfill/type narrowing/drop/store
   reassignment. Preserve previous migration bytes and hashes; no automatic live adoption.

**Done when:** real PostgreSQL enforces relation/unique constraints, same-scope joins and safe integer
bounds. Paging across equal timestamps is stable. Renames preserve storage IDs; tampered history,
removed fields and incompatible type changes block before writes. Re-running migrations is safe;
failed migration rolls back and is not recorded applied. Two generated apps use separate data.

**Not here:** public policy enforcement (P76), query language expansion, arbitrary joins, production
backfill tooling or rewriting the legacy ORM/resource path.

## P76

**Outcome:** the same declared authorization holds for all generated data access paths.
**Depends on:** P75. **Profile:** R.

**Read/change:** policy model/compiler, new policy/data runtime, existing session principal/CSRF
integration. Use the P64 finite rules without adding a second policy language.

1. Produce scoped SQL predicates and bounded projections from policy descriptors. Bind identity
   from the server-established context; deny unknown actions, fields and missing context.
2. Apply access inside query/mutation boundaries, before pagination/counts. Recheck membership
   with the write's consistency boundary when authorization can change concurrently.
3. Implement service-purpose contexts for workers and strict separation of actor provenance from
   current eligibility. Define reusable access checks for later search/file/notification adapters.
4. Add least-privilege repository interfaces for hooks. Explain that interfaces constrain the
   supported integration contract, not sandbox arbitrary Node.js code.

**Done when:** two scopes/users/groups exercise every allowed/denied matrix cell against real SQL.
Forged body role/scope, cross-parent relation, list cursor reuse and alternate field projection
cannot bypass authorization. Revoking membership changes subsequent reads and mutations. Existing
session Origin/CSRF/logout behavior stays intact. No raw client filter becomes a SQL fragment.

**Not here:** SSO, generic ABAC engine, authorization caches, exposing privileged query methods to
ordinary generated routes or declaring all application hooks safe merely because they typecheck.

## P77

**Outcome:** finite actions and lifecycle transitions run with explicit local transaction semantics.
**Depends on:** P76. **Profile:** R.

**Read/change:** P65 behavior model/IR, transaction API, new command/lifecycle runtime and test pack.

1. Implement the common action primitives: create root/children, patch declared fields, relation
   add/remove, transition and append revision. Domain capability calls use exact registered handlers.
2. Run readiness/access/guard checks before mutation; hold the declared transaction for local state.
   Enforce expectedVersion or deterministic lock order. Increment aggregate version once per command.
3. Validate action and hook outputs before commit. Unknown result variants fail safely. Pure hooks
   cannot return undeclared effects; effectful hooks use explicit boundaries and are never advertised
   as sandboxed. External calls are forbidden in the supported transactional action contract.
4. Map domain rejection, stale version, database timeout and uncertain commit to the declared output.
   Preserve rollback when a nested operation fails, even if a custom callback catches an error.

**Done when:** topic+first-post and ticket+article commit atomically; injected child-write failure
leaves neither record. Competing versioned edits have exactly one winner; invalid transitions and
missing hooks perform zero writes. Transaction tests use real connections, not a mocked success
path. The generator emits traceable action registrations without application-name conditionals.

**Not here:** durable command deduplication (P78), external compensation, distributed transactions
or stock-specific behavior.

## P78

**Outcome:** retrying a committed command cannot duplicate its local effect or durable event intent.
**Depends on:** P77. **Profile:** R.

**Read/change:** `packages/durable-events/` transaction/enqueue implementation, new command runtime,
existing generated delivery attachment. A new version is required for any changed delivery contract.

1. Add command receipt storage keyed by exact operation/scope/principal/key, normalized input hash,
   terminal result and documented expiry. Authenticate replay before disclosing the stored result.
2. Coordinate concurrent same-key attempts in the database. Same input returns one committed result;
   conflicting input returns 409. Rollback must not leave a successful receipt. Distinguish command
   idempotency from event deduplication and from external provider idempotency.
3. Integrate outbox enqueue on the **same live transaction connection** as the mutation and receipt.
   Resolve ownership between Outbox.transaction and command transactions explicitly: one transaction
   owner, never nested BEGIN or a second pool connection. If a shared transaction-scope API is needed,
   add it as a reviewed new runtime version and preserve all old queue semantics.
4. Compile finite declared delivery targets to stable identities. Bounded recipient expansion may
   defer to a separate materialization job; no unbounded request-time fan-out.

**Done when:** concurrent duplicate commands, lost response after commit, event-insert failure,
changed key payload, expired receipt behavior and revoked replay access all have exact outcomes.
State, audit/event intent and receipt roll back together. Old durable-events conformance still
passes for its documented envelope; no exactly-once external-delivery claim appears.

**Not here:** deleting receipts automatically, unlimited retries, replaying arbitrary HTTP writes,
or adding saga compensation because one local transaction works.

## P79

**Outcome:** early proof that model -> templates -> real behavior works in more than one application.
**Depends on:** P78. **Profile:** P. This is a hard gate before P80.

**Read/change:** fixed benchmark fixtures; proposed generator conformance fixture and runner profile;
current acceptance/evidence layers. No new domain behavior should be added here.

1. Create two tiny independent design fixtures through the same validated authoring operations:
   discussion topic+post and help-desk ticket+article. Reuse the same compiled policies/actions.
2. Generate into fresh temporary directories, install exact dependencies, run independent APIs and
   databases, and execute the corresponding positive/access/atomicity/version/replay observations.
3. Assert there is no project-owned application implementation code for those supported cases.
   Run one explicit unavailable hook case and show it earns zero application points.
4. Register `pnpm work run backend-foundation` with nonempty selectors, isolated Compose identities,
   cleanup and JSON evidence. Record actual generated/runtime/fixture hashes.

**Done when:** both fresh projects pass the named cases, one shared template version supplies them,
and byte-stable regeneration preserves a sample project-owned hook. A compiler/runtime regression
cannot be hidden by hand-editing generated output. Known incomplete ledger cases remain incomplete.

**Not here:** full application assembly, UI pages, benchmark performance, or fixing a failed proof
by copying custom handlers into the fixtures. Repair its owning package and rerun the affected gate.

## P80

**Outcome:** APIs and workers can run independently over durable named job channels.
**Depends on:** P79. **Profile:** R.

**Read/change:** durable-events runtime/template, generator module/Compose wiring, local execution
policy; new worker template and scheduling adapter only where existing code cannot supply them.

1. Generate an independent worker entrypoint sharing exact contracts and database ownership with
   the API's domain module. Define declared queue names and supported handler versions; fail startup
   for missing required registrations rather than dropping jobs.
2. Persist scheduled availability time and cancellation/version reference. Claim due work with
   bounded batches, database time, fenced leases, finite attempts and an exhausted state.
3. Keep one in-flight handler per worker initially; scale by worker processes. Respect shutdown and
   cooperative cancellation. Preserve service-purpose authorization and safe error metadata.
4. Provide health/readiness and operator-readable backlog/terminal status with bounded queries.
   Distinguish liveness from successfully executing every application handler.

**Done when:** two workers cannot acknowledge one another's claims; restart recovers due work;
stale/cancelled jobs cannot commit forbidden effects; a missing handler blocks readiness. API restart
does not erase jobs. No idle polling storm or infinite loop under a permanently failing handler.

**Not here:** workflow engine, cron expression language, fairness guarantees, lease-heartbeat
redesign or broker selection unrelated to the benchmark needs.

## P81

**Outcome:** private attachment metadata and bytes have an explicit recoverable lifecycle.
**Depends on:** P80. **Profile:** R.

**Read/change:** file-lifecycle design family, backend effects, adapter contract and generator;
add a small object-store interface and conformance fixture. Select/pin a maintained local test
provider during implementation; do not assume a particular third-party image remains available.

1. Implement staged/pending/available/quarantined/deleting/deleted states, size/content limits,
   immutable object identity and association commands. Scope attachment ownership to its domain parent.
2. Use streaming byte limits and server-validated metadata. Do not trust declared MIME/size or
   accept arbitrary filesystem paths. Distinguish required scan policy from optional inspection;
   an unavailable required scanner cannot produce an available file.
3. Define object-first/metadata-second write order and durable cleanup for partial success.
   Cleanup rechecks references/version before deleting bytes. SQL and object-store writes are not
   falsely described as one transaction.
4. Authorize metadata and every byte read using the parent's current policy. Core mode proxies
   private downloads through authorization; public or presigned delivery requires a separate
   declared revocation window and is outside the immediate-revocation profile.

**Done when:** D09/Z10 fixtures pass cross-user/group access, oversized input, MIME mismatch,
partial upload, failed association, repeated attach/delete and orphan recovery. API/worker restart
preserves state; another live attachment's bytes are not deleted by stale cleanup. Two instances
see the same storage. Provider-specific behavior is recorded separately from the generic lifecycle.

**Not here:** media transcoding, rich-text rendering, virus-engine development, public CDN setup
or claiming instantaneous revocation for a previously issued long-lived public URL.

## P82

**Outcome:** reusable notification eligibility, preferences and durable inbox materialization.
**Depends on:** P81. **Profile:** R.

**Read/change:** notification family, subscription entities/effects, worker runtime and shared policy
adapter. Add small notification descriptors rather than product-specific handler branches.

1. Configure event kind, recipient query, per-channel preference, safe payload projection and
   stable per-recipient identity. Persist one inbox row per `(source event, recipient, channel)`.
2. Materialize recipients in bounded, restartable pages. Declare the candidate cutoff and cursor
   semantics; subscriptions created after the source event are not retroactively notified. Recheck
   current access/preferences before creating content and again before sensitive delivery.
3. Retain delivery intent in the same transaction as the inbox record. A crash after commit and
   before acknowledgement must reuse the existing item/effect receipt. Record suppressed/ineligible
   outcomes without retaining the private payload in an error or operator log.
4. Generate inbox list/read/mark-read operations with principal scope and bounded paging. Domain
   recipient/rich-content hooks stay typed and unavailable when required but missing.
   Inbox reads also apply the source resource's current visibility policy; recipient ownership alone
   cannot expose a stored private excerpt after that recipient loses access.

**Done when:** D07/D08 and Z12 protocol fixtures pass duplicate source events, crash recovery,
mute/preference changes, membership revocation, internal-note redaction and another user's inbox
ID. Candidate paging resumes without duplicates; an interrupted batch is not marked complete.

**Not here:** digests, push-vendor SDKs, ranking algorithms, universal templating syntax, or claiming
one external email solely because one internal inbox row exists.

## P83

**Outcome:** a bounded adapter boundary for outbound delivery and authenticated inbound callbacks.
**Depends on:** P82. **Profile:** R.

**Read/change:** worker/delivery contracts; existing provider abstractions only for reusable process
patterns, not to mix application mail/payment credentials with Jeeves model-provider settings.

1. Define configured external endpoints/credential references, request/result types, timeouts,
   maximum bytes, retry categories, idempotency capability and reconciliation requirement.
   Destinations come from trusted configuration, not arbitrary user-supplied URLs.
2. Implement one simple outbound mail transport against a local capture server and one generic
   reference HTTP adapter. Select pinned maintained protocol libraries. Escape/header-validate
   addresses/subjects and use whitelisted content fields. Never log credentials or full private body.
3. Add callback envelope validation over original bytes, timestamp window, event identity and
   credential reference. Verification precedes parsing into business commands. Store safe replay
   receipts and return an acknowledgement only for the documented durable acceptance point.
4. Define unknown outcome handling. Retrying a destination without deduplication can duplicate its
   effect; expose that policy. The payment-specific state mapping remains P96/V19.

**Done when:** local fixtures exercise timeout before/after external acceptance, duplicate callback,
wrong signature, replay-window expiry, oversized payload and provider outage. Private fields and
tokens are absent from normal logs. Restart preserves pending/unknown state. No test contacts a
public provider or needs a paid account.

**Not here:** a real payment gateway integration, full inbound MIME/email threading, arbitrary
webhook scripting, production credential setup, or exactly-once SMTP promises.

## P84

**Outcome:** reusable full-text search with authoritative visibility and rebuildable derived state.
**Depends on:** P83. **Profile:** R.

**Read/change:** search family/query definitions, outbox projections, PostgreSQL data runtime.

1. Generate a PostgreSQL full-text projection with named source fields, language choice, document
   ID/version and source ownership. Keep the authoritative entity separate from derived index data.
2. Apply current authorization/visibility and field projection before counts, ranking snippets and
   returned rows. An index carrying stale access flags cannot authorize a read. Hidden/deleted
   authoritative data must disappear immediately even if projection cleanup is delayed.
3. Bound query length, result size, sorting and cursor context. Bind a cursor to query/scope and
   declared projection version. Specify restart behavior when a version cannot be resumed; do not
   promise a stable historical snapshot across arbitrary ongoing edits.
4. Implement idempotent version-aware update and bounded rebuild jobs with visible progress.
   Older events cannot overwrite a newer document. Failures keep a recoverable checkpoint.

**Done when:** D06/D11, V10 and Z04/Z11 fixtures include stale permissions, private snippets,
deleted content, out-of-order updates and rebuild interruption. Neither counts nor snippets leak.
The same search implementation serves differently shaped discussion and ticket entities.

**Not here:** Elasticsearch, vector search, personalization, cross-service joins or capacity claims.

## P85

**Outcome:** meaningful audit and deletion mechanics that preserve the declared ownership policies.
**Depends on:** P84. **Profile:** R.

**Read/change:** audit/lifecycle families, command effect compiler, attachment/projection cleanup,
existing revision/retention intent.

1. Add append-only application audit records in the command transaction: trusted actor/service
   purpose, target identity, action/outcome, correlation ID and allowlisted changed fields. Do not
   capture passwords, tokens, entire documents or secret provider payloads by default.
2. Add configured logical tombstones and visibility guards across normal reads, history, search,
   attachments and queued sensitive work. Retain sufficient identity for idempotency/reconciliation.
3. Add bounded cleanup jobs for proven orphan bytes and explicitly expired non-authoritative data.
   Require reference/version checks and checkpointing; holds or active references prevent deletion.
4. Supply scoped audit reads and operator status. Explain that application append-only behavior
   is not protection against a privileged database administrator or a legal compliance guarantee.

**Done when:** D12 and shared audit cases pass repeated removal, stale cleanup, cross-user audit
lookup, redaction and crash/retry. Failure to write a required audit record rolls back its command.
Cleanup does not remove a live file, active payment evidence or unexpired command receipt.

**Not here:** legal retention policy, full account erasure/export (H rows), destructive live cleanup,
tamper-proof ledger claims or a generalized data-warehouse product.

## P86

**Outcome:** reusable revisions, review queues and small condition/action policies supply common
discussion/help-desk behavior. **Depends on:** P85. **Profile:** R.

**Read/change:** finite action/lifecycle runtime, review/routing design descriptors; existing catalog
families before adding a new family. Extract helpers only for actual shared behavior.

1. Implement append-revision action with current-version guards and scoped history. A revision
   does not bypass the parent entity's current visibility/removal rules.
2. Implement review-item creation, claim/version and terminal transition with stable deduplication
   identity. Domain targets are exact commands; review completion and target action commit together
   when they share the declared store, or remain explicit asynchronous/recovery work otherwise.
3. Implement bounded condition/action rules over declared fields: equality, membership in a finite
   set, null check and numeric comparison. Ordered priority with explicit first-match/all-match
   policy; only allowlisted patch/assign/transition/enqueue actions.
4. Snapshot rule version on execution and prevent recursive action cascades: one bounded evaluation
   pass per originating event and explicit maximum actions. Routing cannot grant privileges.

**Done when:** D04/D10 and Z09 prove shared mechanisms with different domain descriptors. Duplicate
review, concurrent moderator actions, self-triggering rule, unknown field and unauthorized assignment
are rejected or bounded according to contract. No string expression is evaluated as code.

**Not here:** arbitrary scripting, trust/spam algorithms, workflow loops, process-mining UI or
large rules-engine adoption without a demonstrated need.

## P87

**Outcome:** a pure, versioned business-time calculator with exact timezone semantics.
**Depends on:** P86. **Profile:** S; R for packaging/consumer contract, no database required by the
pure calculation tests.

**Read/change:** Z07/Z15 specification, calendar definitions, new calendar runtime module and
manifest options. Check primary documentation for the selected timezone library before pinning it.

1. Consume P66b's calendar descriptor for weekly local intervals, IANA timezone, explicit holidays,
   valid-from/version and a bounded search horizon. Reject overlaps, empty working week, invalid
   zones and unsupported calendars without inventing a second editable calendar schema.
2. Implement add-business-duration and elapsed-business-duration using the chosen library. Count
   actual elapsed instants whose local time is inside an interval; handle ambiguous/missing local
   times deliberately. Inject the clock for tests; production cannot read a test clock from requests.
3. Use immutable calendar versions; return an explicit impossible/horizon-exceeded result instead
   of looping forever. Cache only immutable calculations/versioned inputs.
4. Publish runtime tests with independent fixed expected instants, including Friday/weekend,
   Monday holiday, timezone crossing, overnight interval if supported, spring gap and fall overlap.
   If overnight intervals are not supported, validation must reject them visibly.

**Done when:** the 120-minute Friday 16:00 case yields the exact Monday/Tuesday result; a Sunday
01:00–03:00 DST test counts 60 actual minutes in the spring gap and 180 in the fall overlap for
the selected US timezone. No JavaScript Date arithmetic based on server-local timezone is used.
Pure results are stable for pinned library/tzdata inputs.

**Not here:** a remote holiday/calendar service, recurring calendar invitation protocol, SLA jobs,
or changing existing deadlines in place when a new calendar version is authored.

## P88

**Outcome:** durable versioned deadlines become one logical escalation under races and restarts.
**Depends on:** P87. **Profile:** R.

**Read/change:** worker scheduler, calendars, command transactions, effect/audit infrastructure and
Z07/Z08 declared clock semantics.

1. Persist deadline identity `(aggregate, clock kind, policy/calendar version, lifecycle epoch)`,
   due instant, active/satisfied/cancelled/escalated status and source aggregate version.
2. Create/cancel/satisfy a deadline atomically with the relevant ticket command. Internal notes
   cannot satisfy first response. A newer deadline generation fences stale scheduled jobs.
3. Claim due timers in bounded batches. Lock ticket root then its deadline rows in stable ID order,
   consistently with public reply/resolve commands; recheck current state before creating the
   unique escalation and event intent in the same transaction.
4. Record lateness and backlog without rewriting due times. Restart catches up; explicit business
   policy controls notifications. Changing calendar/policy defaults affects new deadlines only.

**Done when:** reply-versus-deadline, two workers, restart after escalation commit, cancelled job,
holiday version and overdue backlog cases pass. Exactly one logical escalation can exist per
deadline generation, and no stale job revives a satisfied/cancelled clock. Database time governs
claims; pure calculator output governs due instants.

**Not here:** all SLA variants, automatic retroactive recalculation, machine-learning routing or
promising timely escalation during an unavailable worker/database.

## P89

**Outcome:** a frozen, documented release set of the shared backend capabilities with honest limits.
**Depends on:** P88. **Profile:** R, focused on release artifacts and compatibility.

**Read/change:** template manifests/module registration, `artifacts/` release conventions, frozen
runtime validation, template docs, CATALOG and the new capability support matrix.

1. Publish immutable local archives with exact source/archive hashes for the supported modules.
   Register matching manifest/runtime versions and generated dependency pins; preserve every old
   artifact. Do not repack an already-issued version with changed bytes.
2. Document supported option combinations per capability, host/store/transport requirements,
   unavailable strategies, migration impact, hook contracts, verification pack and actual limits.
3. Verify a representative generated consumer from packaged archives, not workspace source imports.
   Include module composition, no duplicate migration ownership, startup failure on incompatible
   descriptors and source/contract traceability.
4. Update conceptual CATALOG only for behavior supplied by these versions. Separate library family,
   selected implementation and measured evidence in the UI/export. Commerce-specific capabilities
   remain planned until P93–P97.

**Done when:** selected archive hashes reproduce the P79 foundation and shared notification/file/
search/deadline cases appropriate to the release; unsupported combinations fail with actionable
messages. An ordinary generated consumer has no dependency on the Jeeves checkout. Documentation
does not imply all planned families or every combination is implemented.

**Not here:** a cloud release, public package publication, all-configuration certification campaign,
full application proof or inventing performance numbers from functional conformance.
