# Shared implementation contract and execution rules

Read with the [roadmap](../../build-plan-backend-benchmarks.md) and the assigned package.
Everything described as new below is a specification, not an existing implementation.

## 1. Inspected baseline and gaps

The inspection was read-only against application code at `3ae6aff`, 1 November 2026. It did not
run the deferred unit/E2E suites, generate a new application, or measure current performance.

| Area | What exists | What this roadmap must add | Starting files |
| --- | --- | --- | --- |
| Design editing | Shared Zod schemas, atomic operation batches, revision conflicts, separate layout history | New backend declarations through these same paths | `packages/spec/src/{design,architecture,operations,apply}.ts`; `apps/server/src/design/service.ts` |
| C2/C3 | Logical containers, cohesive components, families/options, exact interface bindings, scenarios, data responsibility | Explicit implementation selection for a C3 capability without turning every component into a process | `packages/spec/src/{architecture,planned-capabilities,architecture-bindings}.ts` |
| Contract shapes | Nested fixed objects/arrays, scalar constraints, nullable fields; five-level nesting and forty fields/object | Local reusable types, maps, discriminated unions, transport mappings; finite bounds stay enforced | `packages/spec/src/{contract-shapes,architecture-contracts}.ts` |
| Behavior | UX5 prose fields for authorization, preconditions, transaction, effects, outcomes and hooks | Machine-checkable references and finite semantics; prose remains explanatory | `contract-shapes.ts`; `apps/web/src/architecture/OperationBehaviorFields.tsx` |
| Data generation | Stable storage IDs; owner/internal resources; text, URL, integer, enum and generated creation timestamp; required belongs-to; create/read/list/update | Richer entity/aggregate schemas, reusable scoped policy, unique/index constraints, revision/CAS and bounded queries | `packages/spec/src/resources.ts`; `templates/rest-api-server/{resources,generate}.ts`; its `runtime/src/resources.ts` |
| Sessions | Server-established principal, opaque hashed sessions, origin-specific cookies, Origin/CSRF checks | Reuse principal/session boundary with policy-based authorization; no new password implementation | `templates/rest-api-server/runtime/src/sessions.ts`; `session-transition.md` |
| Durable events | Experimental frozen runtime; transactional enqueue, leases, retries, database-effect receipts | Separate worker composition, scheduled work, explicit finite fan-out and application adapters | `packages/durable-events/`; `templates/durable-events/`; `artifacts/durable-events/0.1.0/` |
| Runtime availability | Registered exact template versions; every planned C3 capability currently produces NEEDS_TEMPLATE | Supported-shape matching and explicit safe hook mode; no blanket exemption for planned components | `packages/spec/src/{manifest,validate,architecture}.ts`; `packages/registry/src/builtin.ts` |
| Generation | Pure project planning, generated/scaffold ownership, immutable migrations, frozen runtime archives, protected acceptance files | Compile the new declarations; preserve the existing legacy generation path | `packages/generator/src/{plan,generate,lock,modules}.ts`; `packages/template-kit/src/contract.ts` |
| Verification | Infrastructure/template/application layers; fixed acceptance; current revision/output checks | Behavior-ledger scoring, foundation versus completed-application verdicts, richer environment fingerprints | `packages/generator/src/{acceptance,baseline/behavior}.ts`; `packages/spec/src/evidence.ts` |
| Finishing tasks | Deterministic resource-extension/event tasks; owned-path enforcement and protected acceptance | Small hook tasks with contract preconditions, allowed effects and exact dependencies | `packages/orchestrator/src/{seed,brief,checks,execute}.ts` |
| Portability | Revision-bound architecture handoff with exact definitions and unresolved obligations | Runtime lock, behavior evidence and typed remaining-work bundle | `packages/spec/src/architecture-handoff*.ts`; `apps/server/src/routes/architecture-handoff.ts` |

Existing reviewed mechanisms are valuable. Extend them through versioned seams; do not replace
the editor, generator, session system, durable-event runtime, or orchestration engine wholesale.
The existing [reference cache](../../developer-workflow.md#architecture-reference-cache) already
pins Medusa, Payload, Umami, Zulip and Backstage source excerpts. Reuse its machinery in P60.

## 2. Scope and product decisions

1. **Backend first.** Generate TypeScript APIs, workers, persistence, contracts, adapters and
   acceptance harnesses. A thin client can consume them. No page builder, theme work or cloned UI.
   Client applications are explicitly external consumers of this backend scope, or explicitly
   external implementations bound to its contracts. Do not leave a required planned frontend in
   the generated scope and silently omit it. P103's small client is verification support.
2. **Three separate applications.** Each gets its own project, database credentials, migrations,
   output directory, runtime lock, fixture dataset and evidence. Shared libraries do not mean
   shared customer data or one giant application containing all three domains.
3. **Small topology first.** One modular API and one independently runnable worker per benchmark;
   PostgreSQL is the authority. An object-store adapter and external delivery providers are
   explicit. Named job channels can use PostgreSQL delivery tables initially. Do not add Redis,
   Elasticsearch, Kafka, Kubernetes or a service per C3 responsibility merely to look scalable.
4. **Functional adaptation.** Use REST/JSON and OpenAPI for the three initial cores. Vendure's
   actual GraphQL API is an upstream fact, but API compatibility is excluded here and tracked in
   X1. Record each adaptation in the benchmark provenance. Do not imply official upstream parity.
5. **Local execution.** Docker Compose and existing local execution/pool capabilities are the
   initial verification target. All exposed fixture services bind to loopback; never claim cloud
   failover from a two-process local test.
6. **Libraries behind responsibilities.** Use established protocol, database, date/time and mail
   libraries where appropriate. Select exact versions when implementing, after checking current
   official documentation and the repository's dependency-age rule. Do not adopt entire upstream
   products and count their supplied behavior as Jeeves-generated logic.
7. **No universal programming language.** The model has finite typed predicates, transitions,
   actions, queries and reviewed strategy choices. No JavaScript/SQL snippets, eval, unrestricted
   expression strings, recursive workflow graphs or arbitrary network instructions in a sidebar.
8. **No automatic source port.** Upstream code informs behavior. No application or license text
   is copied into a runtime without explicit provenance and applicable license treatment.
9. **Preserve old applications.** Existing resource projects, recipes, frozen artifacts, saved
   designs and Mattermost remain compatible. No silent saved-project migration or live adoption.

## 3. One authoritative model

Extend the existing optional `architecture` section with an optional, versioned `backend` object.
This is part of the existing DesignDocument, not a second application specification. These are
the proposed collection names; use them consistently unless a package records a justified change:

| Collection | Required meaning |
| --- | --- |
| `entities` | A logical persisted entity bound to one existing dataset and exact data contract; stable field identities select storage annotations |
| `aggregates` | An owned consistency boundary: root entity, child entities, store, local invariant strategy and concurrency policy |
| `queries` | Named bounded reads with declared filters/order/projection/pagination and a mandatory policy reference |
| `accessPolicies` | Finite authorization rules over trusted principal context, persisted membership and selected entity fields |
| `lifecycles` | Exact versioned states/transitions bound to an enum field on an aggregate; no hidden state or implicit transition |
| `operations` | Executable intent for an exact contract operation, component owner, action/strategy, access, transaction and outcomes |
| `effects` | Exact operation-to-event/delivery/audit/projection references, including ordering and commit boundary |
| `hooks` | Typed project-owned extension seams with inputs/results, allowed dependencies/effects and fixed acceptance references |
| `capabilityConfigs` | Exact versioned, typed domain/mechanism settings for files, notifications, search, delivery, calendars, routing and commerce; references point to the existing entities/policies/contracts |
| `implementations` | Exact template/capability/version selection per C2 host, C3 responsibility, operation or relationship, with explicit hook/external alternatives |

Contracts remain the authority for wire/logical types. Dataset records remain the authority for
ownership and stores. Entity records add persistence constraints; they do not copy a mutable field
schema. Point to exact contract version and field IDs. Legacy resource descriptors remain
authoritative for legacy projects; expose a read-only adapter into the compiler where needed.
Converting a legacy resource to the new model requires an explicit preview and stable-ID mapping;
automatic dual-writing of two schema representations is forbidden in the core roadmap.

Suggested limits for v1: 100 entities, 50 aggregates, 100 policies, 100 queries, 200 operations,
100 effects, 100 hooks, 100 capability configurations; at most 20 predicate clauses, 30 transitions per lifecycle, 20 actions per
operation, 100 fields per entity, and 3 explicitly joined relations per query. Existing document
limits still apply. These limits protect authoring and compilation; they are not workload limits.
If a fixture exceeds one, first reduce accidental duplication. A necessary limit change needs a
documented bound and a test; never silently truncate saved data or generated output.

References use `{id, version}` and stable operation/field IDs. Names are presentation; changing a
name does not change storage identity or silently retarget an event. Required unresolved references
are saveable design findings where appropriate, but are not executable. Duplicate IDs, dangling
references, incompatible ownership, malformed types and contradictory bindings are structural errors.

All reference collectors must understand new declarations: validation, removal preview, contract
immutability, fragment extraction/insertion, pattern role remapping, target diffs, handoff,
fingerprints, chat JSON Schema and source traceability. A schema change is incomplete if one of
these paths silently drops its information. Keep helpers shared rather than reimplementing maps
in each UI component. The existing exact-version immutability policy also applies to lifecycle,
policy and hook definitions once an executable snapshot references them.

### Bridging planned C2/C3 to the existing executable graph

The current code has three independent availability barriers: a planned container has no runtime
template; a planned relationship produces NEEDS_TEMPLATE; a C3 family also produces NEEDS_TEMPLATE.
In addition, `validateElement` rejects an element carrying both `planned` and `template`. Selecting
a C3 runtime alone cannot make the new designs generate. P69/P70/P74 must handle all three barriers.

Preserve the saved planning identities/configuration. Exact implementation bindings may refer to
containers, components, operations and relationships. For a relationship, bind the transport/store/
provider adapter and participating interfaces; a drawn protocol label alone never supplies wiring.
External stores/providers require configured adapter contracts and explicit fixture/production
environment bindings. They are not silently dropped because they are external.

Use a new opt-in backend compiler path selected by the versioned backend model. It evaluates the
full original design, preserves structural errors, and derives a readiness report showing how
**each exact availability obligation** is supplied, explicitly hooked, externally bound or unsupported.
Only a compatible registered implementation can discharge its own obligations. Never suppress all
NEEDS_TEMPLATE findings, let one component binding cover its whole container, or change the global
legacy `blocksGenerate` predicate. Keep raw design diagnostics available for inspection.

The resulting immutable IR can materialize a transient executable projection for compatible legacy
emitters, or use new emitters returning the same ProjectPlan. This is derived compilation data,
not a second editable design. Save the original design snapshot and full source map. Do not edit
stored `planned`/`template` flags, delete relationships or run `changeSubtype` with destructive
defaults to satisfy old validators. New-path checks must prove every required original identity,
operation, policy, dataset and effect is represented; unaccounted intent blocks before filesystem I/O.

Session tables/migrations retain one owner in the selected session implementation. Backend entity
definitions refer to its principal identity and do not generate a competing app_user/app_session
schema. Production privilege bootstrap is an explicit operator command; public account creation
never accepts an administrator role. Test-role seeding is fixture-only.

### Minimum useful component configuration

P66b/P66c define these strict, versioned settings before the full examples are authored; P68c
exposes them through component configuration. A typed setting may be designed before its runtime
exists. Unsupported choices remain visible through the P69 matcher. Do not store structured settings
as JSON strings in the existing flat planned-capability fields or add another code-expression editor.

| Responsibility | Required bounded options and references |
| --- | --- |
| Request handling | Exact transport/operation, content limits, identity policy, declared outcomes |
| Data/transaction | Entity/aggregate/query refs, constraints, expected-version/lock strategy, write participants |
| Access | Policy ref, membership/role source, field projection, all revocation recheck sites |
| Lifecycle | State/transition/guard refs, action bindings, cancellation and conflict outcome |
| Jobs/delivery | Queue/event refs, due time source, attempts/backoff/lease/deadline, acknowledgement and unknown outcome |
| Files | Store adapter, maximum bytes, accepted types, required inspection, parent policy, lifecycle and cleanup policy |
| Notifications | Recipient query/cutoff, preferences, projection/redaction, channels and per-recipient identity |
| Search | Source entity/fields, language, projection version, current policy, query bounds and rebuild/freshness |
| Business time | Immutable calendar version, IANA zone, weekly intervals/holidays, duration and start/stop events |
| Routing/review | Predicate/action refs, priority, first/all match, maximum actions, deduplication and audit |
| Money/cart | Currency/amount/quantity/line bounds, exact quote strategy, expiry and pricing-hook refs |
| Inventory | Stock authority/location, count semantics, reservation lifetime, held-payment/expiry and lock strategy |
| Orders/payments/fulfillment | Snapshot fields, lifecycle/guard refs, provider adapter, uncertainty/reconciliation and quantity constraints |
| Implementation | Exact template/capability version, unsupported-option explanation, typed hook obligations and current evidence |

These settings are validated descriptors, not a new guarantee that a template supports every
combination. They reference common predicates/lifecycles instead of re-encoding their semantics.

## 4. Finite behavior semantics

### Data, queries and money

- Scalar storage v1: UUID, bounded text, boolean, bounded signed integer, enum, UTC timestamp,
  nullable scalar and exact money. Money is integer minor units plus a currency code. Validate
  bounds before arithmetic and prevent overflow; no floating-point arithmetic for prices.
- Maps/tagged unions are supported in transport and event contracts. They are not automatically
  normalized into relational tables. Explicit JSON storage is allowed only with a bounded schema
  and a stated query limitation; no arbitrary JSON filter language.
- Relations identify source and target fields, cardinality, ownership and delete behavior. Use
  explicit join entities for many-to-many membership. Unique keys identify their scope and null
  semantics. Only one application owns a mutable aggregate; a worker can execute its module.
- Query filters and sort keys are allowlisted. Limit defaults to 25, maximum 100 unless a specific
  bulk operation declares another bound. Use stable keyset cursors and a unique tie-breaker.
  Cursors are validated data, not authority. Access predicates must apply before pagination,
  counts, snippets and aggregations. Never fetch an unbounded collection and filter it in Node.
- Optimistic commands require an expected version; stale versions produce a declared conflict.
  Pessimistic commands lock a documented row set in stable order. Multi-store atomicity is not
  supported. Unsupported cross-store transactions become explicit orchestration/hooks.

### Access and context

Trusted context contains principal identity, authentication kind, selected workspace/organization
scope established by server checks, correlation ID, and optional service-purpose identity. Body
fields, raw headers, queue payloads and client-provided roles cannot establish authority.

Finite rule vocabulary: authenticated, named role, owner, organization membership, resource/group
membership, public visibility, allowed action, allowed field projection, and conjunction/disjunction
over at most 20 named clauses. No recursive relationship traversal. Default deny; explicit public
access is a choice. A deny wins when rules conflict. Field visibility and read/write authorization
are distinct. Reject unknown writes rather than ignoring them.

Enforce the same meaning in detail/list/mutation, search, attachments, job execution, notification
materialization and export. Revocation is rechecked at the point of sensitive observation or
effect. Authorize idempotent replay before returning the stored response. A service job uses an
explicit purpose and bounded scope; it does not impersonate a forever-authorized former user.
Avoid caching authorization initially. Later caches require a stated revocation bound and proof.

### Commands and local transactions

The intended pipeline is: authenticate; validate transport; establish trusted context; resolve
policy and command identity; begin transaction; lock/check idempotency and aggregate rows in the
declared order; recheck relevant access/state; run finite guards; perform the selected action;
append audit/event intent and command receipt; commit; serialize the declared outcome. Queries
use the same policy/context with a read-only path.

Action vocabulary starts with create entity/children, patch allowlisted fields, transition state,
add/remove relation, append immutable revision, and call a registered domain capability. Dynamic
values come only from typed input/context, current entity fields, server clock/ID factories or
named strategy results. No arbitrary loops or arithmetic expression editor. Commerce's inventory
and money algorithms are reviewed domain capabilities, not dozens of user-authored expressions.

Keep external I/O outside database transactions. A timeout after commit means the caller may
not know the result; it does not imply rollback. Required hook readiness is checked before any
mutation. Hook return values are validated against exact contracts before committing.

Idempotency identity includes operation version, authenticated scope/principal and client command
key. Persist a canonical normalized-input hash and terminal result with the mutation. Same key and
same input replays the permitted result; changed input conflicts; concurrent identical calls cannot
both mutate. Failed transactions leave no successful receipt. The default core retention is seven
days, with the replay window published in the API; expired keys cannot be advertised as eternal
deduplication. Deletion of receipts is a separate controlled cleanup policy.

### Events, jobs and external effects

Reuse the existing at-least-once durable delivery semantics. Command idempotency and worker-effect
deduplication are different responsibilities. Database changes and outbox rows share one connection
and commit; an after-commit callback is not an outbox. Each declared recipient/handler gets its
own delivery identity. No unbounded recipient expansion inside a request transaction.

Persist schedule time, policy version, attempts, lease/token and terminal outcome. Claiming is
atomic and fenced. Expired claims can be retried within the finite budget; stale workers cannot
acknowledge another worker's claim. Stop claiming during shutdown. Cancellation and deadlines are
cooperative; uncooperative handlers are not magically terminated. Retain an operator-visible
exhausted/reconcile state.

External delivery has a stable attempt/deduplication identity. A destination that does not support
deduplication may receive duplicates after ambiguous outcomes. SMTP Message-ID is not an exactly-once
guarantee. Callback verification checks the original bytes, configured credential reference,
timestamp/replay policy and provider identity before mapping to a domain event. Limits, timeouts,
retry budget and reconciliation outcome are part of the adapter contract.

## 5. Generation and ownership contract

The compiler produces a normalized intermediate plan (IR) in memory from the design and selected
exact manifests. The IR is a derived artifact with a schema version and origin map; it is never
another editable source of truth. It resolves data ownership, operation bindings, query plans,
effects, provider configuration references, required hooks and supported options before writing.

Template capability declarations list supported shapes/options, dependencies, conflicts, hook
seams, transport/storage versions and acceptance packs. Matching is deterministic. Neither a
component family name nor UX5's `implementation: Template configuration` text proves support.

Two generation modes are necessary:

| Mode | Preconditions | Meaning |
| --- | --- | --- |
| Complete application | All required behavior has compatible implementations and required provider configuration; all full-application acceptance passes before completion is shown | The selected benchmark scope works within the measured envelope |
| Foundation with explicit hooks | Every required item is either supported, a fully specified hook with safe unavailable behavior, or an explicit external contract; no anonymous unsupported requirement | The supported foundation can run; listed application behavior remains unfinished |

Foundation generation is an explicit action with a concrete preview. It must not silently select
a subset, remove planned nodes, rewrite contracts to omit requirements, or globally weaken
`blocksGenerate`. Preserve legacy behavior. Unclassified/unsupported requirements still block;
only validated hook obligations receive the foundation-mode treatment. A hook default returns
the declared unavailable result (HTTP 501 or 503 chosen in its contract), makes no domain changes,
and cannot report success. The negative readiness check itself is not functional coverage.

Generated ownership extends the existing lock, rather than adding a second ownership mechanism:

- Protected: compiled descriptors/adapters, immutable SQL migrations, runtime tarballs and hashes,
  public contracts, source map, fixed acceptance files, capability manifest and benchmark ledger.
- Scaffold once/project-owned: named hook implementation files and supplemental tests. Preserve
  them byte-for-byte on regeneration; create missing files without overwriting existing content.
- Private deployment inputs: environment files/secrets. Never serialize secrets into design,
  fixtures, logs, exported briefs, source maps or checked-in output.

Same semantic design plus lock, toolchain and template artifacts produces byte-identical protected
outputs. Generation timestamps and random IDs must not leak into deterministic files. Runtime IDs
and timestamps are naturally variable; tests inject or observe them appropriately. A display-only
rename must not produce a destructive migration. Removed fields/components are reported and retained
until an explicit migration/adoption decision; no automatic live deletion.

## 6. Coverage and evidence

Each ledger row is a user-observable capability, with named positive, rejection and material
failure cases. Weights total 100 per application and are fixed before templates are built.
Weight is evaluation importance, not a claim about time saved. Never split easy CRUD into dozens
of extra rows or move a failing case outside the denominator.

Record each case's state separately: designed, supported by exact template, generated, verified,
custom required, custom verified, unsupported, failed, or not run. Record implementation origin:
shared template, domain template, product recipe, integrated upstream engine, project hook.

The template percentage is the sum of row weights for which **every mandatory case passes from
fresh generation without project implementation code** and whose origin is shared/domain template,
divided by 100. Partial rows get zero until split by a reviewed new benchmark version. A fixture
provider can verify the explicitly named provider-protocol cases only; it cannot verify a real
provider integration. Custom verified rows increase application completion, not template coverage.
Recipe-only behavior and a wrapped upstream application are reported separately.

Critical checks are vetoes: authorization isolation, transaction/stock integrity, idempotent command
effects, private-data redaction and hook fail-closed behavior cannot be traded away for points.
No foundation verdict if a critical supported-path check fails, even at 90 points. Incomplete hook
features remain visibly incomplete and do not imply the application is production ready.
Every path advertised as supplied must pass its mandatory checks, including noncritical ones.
The numerical threshold never permits shipping a known failing generated path as verified. Keep a
G target's original label/weight when reporting an actual unsupported or custom implementation;
any deviation needs an explicit gap/decision record, not a convenient ledger rewrite.

Evidence binds design fingerprint, ledger/contract hashes, template/runtime/archive hashes, generated
source hash, dependency lock, test-pack version, fixture seed, database/image versions, command,
environment profile, timestamps and actual result. Record skipped/not-run separately. Changing a
relevant input invalidates the corresponding verdict. Raw observations are kept; a summary cannot
overwrite an earlier failure to create a pass.

## 7. Verification profiles and the existing UI-test deferral

This plan does not revoke the user's deferral of UI unit/E2E maintenance or authorize a broad
test campaign now. New backend semantics need focused behavioral verification; clicking a normal
button does not need a new unit test. P58 records the exact applicable commands and known baseline
failures before implementation. Use these profiles in package instructions:

| Profile | Required checks |
| --- | --- |
| D — documentation/data | Scoped Markdown links/anchors, manifest parsing where applicable, arithmetic/identity checks, `git diff --check`; lint when repository-supported files change |
| A — authoring/UI | `pnpm lint`, `pnpm typecheck`, `pnpm --filter @jeeves/web build`; direct browser inspection of changed mouse workflows, reload/undo/conflict, light desktop and dark 390px view; no deferred UI suite maintenance |
| S — semantic/compiler | Lint/types, focused offline tests for the new semantic boundary, old-design compatibility and deterministic output; build/browser when production UI is touched |
| R — runtime | S plus the package's real dependency conformance in disposable Compose/Testcontainers; generated consumer acceptance; exact artifact and ownership checks |
| P — composition/proof | R's relevant integration checks plus the named benchmark/recovery/load/upgrade profile; do not rerun unrelated campaigns |

Use the existing runner, for example `pnpm work run unit <actual .test.ts paths>` and
`pnpm work run templates <actual .conformance.ts paths>`. Commands with placeholder paths are
instructions to substitute real files, not runnable scripts. P58 adds named selectors for later
profiles only when those checks exist; zero matched tests must fail. Offline tests need no Docker,
Postgres, network or paid model. Runtime/benchmark profiles may use disposable local services.

The repository's general `pnpm check` rule still governs non-UI implementation packages. Its scope
must not be weakened or its failure hidden. If a full check hits legacy UX assertions whose
maintenance is explicitly deferred, record that blocker separately from new-package results and
resolve the policy when that execution package is assigned; this planning document does not grant
permission to rewrite those tests. Do not claim a full check passed after running only a subset.
P58 must make this situation concrete early, rather than surprising a runtime agent at release.

## 8. How an implementation agent completes one work unit

The [assignment queue](execution-units.md) splits large packages into mandatory children. Assign
and commit one child at a time. The parent is complete only after every child and its combined
acceptance are complete. The word package below also applies to an assigned unsplit work unit.

1. Verify `main`, inspect status, read the latest handoff and the assigned work unit. Preserve
   unrelated edits and staged content. Do not create another branch/worktree or delegate.
2. Verify dependencies from recorded artifacts/results. A checked-off plan paragraph alone is
   insufficient. Read only the shared contract, benchmark rows and code named by the package.
3. Write a short checklist of its required changes and exclusions. Implement the smallest
   complete change. New paths named in phase files are proposed, not files assumed to exist.
4. Preserve immutable old versions. Add a new runtime/template version when behavior changes;
   register it in both the registry and generator module set. Update exact dependency pins.
5. Run the package's profile and concrete acceptance. Diagnose failures; do not alter fixed
   expected behavior to match incorrect output. Keep environment failures distinct from passes.
6. Update conceptual CATALOG only when actual offerings/availability change. Update template
   docs with supported options, hooks, limitations and evidence. No status change from prose alone.
7. Append handoff: package ID, dependency evidence, changed paths, commands/results, artifact
   hashes where relevant, limitations, deviations, and exact next package. Never edit old entries.
8. Stage only scoped changes, create a local `P<n>[suffix]: <concrete outcome>` commit, and stop
   after this work unit. Do not push, publish or start the next unit without an execution request.

If the work exceeds one clean session, make a bounded continuation handoff with what is incomplete.
Do not mark the package complete or combine unrelated work to save a commit. If a requirement is
impossible under this contract, report the precise conflict and proposed smallest amendment;
do not silently create a general workflow language, replace a provider, reduce scope, or weaken
authorization. Routine internal choices consistent with the plan do not require user approval.

Suggested task prompt:

> Implement work unit PXX from docs/build-plan-backend-benchmarks.md. Read AGENTS.md, PLAN §15,
> the latest handoff, the shared contract, assignment queue, relevant benchmark cases and PXX only. Verify prerequisites;
> execute the numbered scope and its checks; preserve unrelated work; append handoff and make
> one local PXX commit. Do not start another package. Report exact remaining blockers.
