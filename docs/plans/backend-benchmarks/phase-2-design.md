# Phase 2 — Designs precise enough to compile

Read the [shared contract](contract.md), [benchmark ledgers](benchmarks.md) and your package.
P62–P73 add design semantics, authoring and a pure compilation plan. They do not implement new
application runtimes. All collection names and bounds below follow the shared contract.

## P62

**Outcome:** contracts can express the benchmark payloads without opaque JSON/text substitutes.
**Depends on:** P61. **Profile:** S.

**Read/change:** `packages/spec/src/{contract-shapes,architecture-contracts,architecture-library,
architecture-handoff}.ts`; shared reference collectors; chat schema conversion. Add focused type
resolution helpers rather than growing one recursive UI function.

1. Add exact local type references, bounded string-keyed maps and tagged unions with a required
   discriminator and disjoint literal tags. Preserve optional/nullable distinction. Allow structured
   unresolved drafts without treating them as compatible or executable.
2. Add explicit transport mapping for operation method/path, input locations, JSON request/response,
   declared status, content type and headers. File bytes use a distinct bounded binary descriptor;
   do not represent them as unbounded JSON strings. Avoid a full OpenAPI interpreter.
3. Resolve references with cycle detection, total-node and depth budgets. Reject ambiguous unions,
   duplicate tags, unresolved required runtime types, invalid path parameters and conflicting
   transport names. Stored reference graphs may share types; runtime recursion is unsupported v1.
4. Include referenced definitions in contract immutability checks, extraction/insertion, handoff,
   exact-version fingerprints and JSON Schema export. Protect source-referenced legacy contracts.

**Done when:** fixtures cover a history dictionary, tagged payment outcome, nullable address field,
reused money type and binary download contract. Old nested contracts round-trip unchanged. Cycles,
budget overflow, stale references, changed referenced types and invalid transport mappings fail
without partially saving. Definition rename preserves identity; explicit new version preserves old
consumers. No runtime availability changes.

**Not here:** remote schema fetch, unrestricted OpenAPI import, automatic recursive SQL storage,
GraphQL, new serializer runtime or wholesale contract-editor redesign.

## P63

**Outcome:** the model identifies authoritative entities, consistency boundaries and bounded reads.
**Depends on:** P62. **Profile:** S.

**Read/change:** `packages/spec/src/{architecture,architecture-bindings,resources,apply}.ts`;
new `backend-model.ts` and `backend-data.ts`; existing dataset/contract helpers.

1. Add `architecture.backend` with schemaVersion and the entity/aggregate/query collections.
   Entities reference dataset + exact data contract; field storage annotations refer to stable IDs.
   Add required/nullable mapping, server-owned fields, scope key, PK, relations, unique keys and indexes.
2. Aggregates name root/children, one owner/store, and optimistic or explicit row-lock concurrency.
   Record local invariants through named finite strategies; keep unimplemented strategies visible.
3. Add query definitions: allowed comparisons, projection, declared joins, ordering, limit, cursor,
   required access-policy reference and read freshness. A query cannot select arbitrary SQL.
4. Validate same-store ownership, relation type compatibility, scope consistency, unique/index
   references, nullable/delete conflicts, stable cursor order and bounded joins. Add a read-only
   legacy-resource adapter; do not migrate legacy resources or write duplicate schemas.

**Done when:** model the discussion topic/first-post aggregate, stock/reservation aggregate and
ticket/article aggregate. A cross-store atomic aggregate is rejected; an unresolved policy is
saveable but cannot compile. Old designs remain valid. Rename changes labels without storage IDs.
All new references survive library extraction and handoff; missing refs are reported at source.

**Not here:** SQL generation, migrations, arbitrary ORM support, editable duplicated field schemas,
or relational interpretation of every contract map/union.

## P64

**Outcome:** resource and organization authorization is explicit and finitely configurable.
**Depends on:** P63. **Profile:** S.

**Read/change:** `backend-model.ts`; new `backend-policy.ts`; existing relationship policy and
architecture review modules; session principal contract for context compatibility.

1. Implement the finite vocabulary in contract.md: authenticated, role, owner, membership,
   resource/group grant, visibility, action and field projection. Require explicit trusted context
   sources. Rule composition is bounded conjunction/disjunction, with default deny and deny precedence.
2. Bind policies to operations, queries and sensitive data projections. Define service-purpose
   policy for background work. An initiating actor is provenance, not a permanent access grant.
3. Model revocation policy and required recheck sites: read, write, search, bytes, materialization,
   delivery and export. Reference the same policy identity instead of duplicating free-text rules.
4. Validate membership relation paths, entity/field types, scope compatibility and unsupported
   recursive traversal. Preserve existing relationship-level access intent as broader context;
   an explicit conflicting selected policy creates an actionable review finding.

**Done when:** represent private category membership, shop-admin versus customer and internal
agent-only article access. Reject policies using request body roles as authority. Missing read/list/
search projections appear as gaps. A detached text description never satisfies policy requirements.
Structural reference errors reject atomically; unfinished policy selection remains editable.

**Not here:** an authorization runtime, external policy engine, SSO implementation, role inference
from names, or migration of existing owner CRUD semantics.

## P65

**Outcome:** commands and state transitions specify actual local business behavior.
**Depends on:** P64. **Profile:** S.

**Read/change:** new `backend-behavior.ts`; `backend-model.ts`; UX5 operation behavior/outcomes;
architecture contract review and validators.

1. Add exact operation references bound to an owner, aggregate, policy, query/action strategy and
   transaction policy. Map wire inputs/results using stable field IDs and allowlisted value sources.
2. Define lifecycle state/transition tables, command identity, expected version, typed guards,
   declared writes and outcomes. Implement finite actions listed in contract.md; domain strategies
   are registered names with schemas, not arbitrary code text.
3. Represent idempotency scope/hash inputs/replay window; errors and uncertain outcomes are distinct
   from successful state transitions. Represent cancellation behavior where a command starts work.
4. Check state-field enum agreement, unreachable/duplicate transitions, wrong guard types, disallowed
   writes to server fields, undeclared writes and cross-store atomicity. Link prose as explanation;
   never parse it into executable semantics.

**Done when:** express post edit/close, checkout/order transition and ticket assignment/resolve.
Each command has exact success and unchanged/conflict outcomes. A transition to a nonexistent state,
two writers for one field, or a read-only operation with mutation effects is rejected. Designs with
unknown strategy implementations remain explicitly unsupported, not silently treated as hooks.

**Not here:** saga execution, expression parsing, complex pricing algorithms, or generating code.

## P66

**Outcome:** effects and finishing work are traceable and safe to implement independently.
**Depends on:** P65. **Profile:** S.

**Read/change:** new `backend-effects.ts`; shared backend model; contract/binding/scenario validators;
`architecture-handoff.ts` and library reference utilities.

1. Add effects linking exact source operation to exact event/target operation, dataset, projection,
   notification or audit definition. Record before-commit/atomic-intent/after-commit boundaries,
   delivery identity, retry/reconcile policy and required order. Cross-container uses retain C2 links.
2. Add hook definitions: exact input/output/error contracts, pure or effectful kind, context,
   dependency references, allowed writes/effects, timeout/cancellation, unavailable behavior,
   acceptance IDs and ownership seam. Required hooks block mutation when absent.
3. Add recovery paths for uncertain commit, lost acknowledgement, partial bytes and external timeout.
   Reference scenario outcomes and invariant identities; avoid a second independently editable graph.
4. Validate incompatible transaction boundaries, dangling effects, hook dependency cycles, forbidden
   outputs and omitted failure outcomes. Optional effects need a stated loss policy.
5. Add strict versioned `capabilityConfigs` and schemas in `backend-capability-configs.ts` for the
   settings matrix in contract.md. P66b owns delivery/files/notifications/search/calendars/routing;
   P66c owns money/cart/inventory/order/payment/fulfillment configuration. These are design schemas,
   not runtime implementations. Reuse existing policy/lifecycle/event definitions by reference.
   Validate interval overlap/timezone identifiers, positive bounds, exact strategy/config shape,
   provider references, count meanings and incompatible uncertainty/expiry choices.

**Done when:** trace create-post -> outbox -> eligible notification, checkout -> payment attempt ->
callback/reconcile, and deadline -> escalation. Every H row can reference a typed hook. Invalid
cycles and an external HTTP call claimed as part of a SQL transaction are rejected. Extraction,
target copy and export retain exact references and remap local IDs correctly.
All settings needed by the three examples have typed fields before P71; raw configuration strings
and prose cannot stand in for calendars, recipient queries or stock/payment policies.

**Not here:** running hooks, automatic compensation, external network fetching or task execution.

## P67

**Outcome:** people can author data/query/access decisions by mouse from a component.
**Depends on:** P66. **Profile:** A; semantic changes also use S.

**Read/change:** `apps/web/src/architecture/{ComponentEditor,ComponentDetails,ArchitectureData,
InterfaceEditor,ContractFields,ArchitectureReview,editor-drafts}.tsx`; shared schemas; chat tools.

1. Extend existing component configuration with Data and Access sections. Choose existing data
   contracts/datasets; add entity annotations, relations/unique keys, aggregate ownership and queries.
   Use dedicated bounded subeditors rather than a giant JSON textarea.
2. Add the P62 type/reference/map/union controls. Show unresolved values and offer navigation to
   the exact definition. Reuse version guards and consumer-impact preview.
3. Add finite policy builder controls with trusted-context explanation, affected query/byte/output
   paths and policy reuse. Show an illustrative evaluation against a local fixture as a preview,
   labeled design preview, never runtime evidence.
4. Use existing validated operation batches, Save/Cancel, revision conflict handling and one undo
   step. Preserve invalid drafts. Extend chat discovery/description using the same schemas.

**Done when:** by mouse configure a private category query and an internal-note policy; cancel,
save, reload, undo/redo and concurrent revision conflict all preserve correct data. Protected
referenced definitions require a successor version. At 390px controls fit and remain usable;
desktop/narrow browser diagnostics and accessibility inspection show no new violations.

**Not here:** bespoke application admin screens, canvas endpoint clutter, new UI unit/E2E suites,
or evaluating production authorization in the browser.

## P68

**Outcome:** component options capture commands, state transitions, effects and custom seams.
**Depends on:** P67. **Profile:** A; S for semantic additions.

**Read/change:** `OperationBehaviorFields.tsx`, `InterfaceEditor.tsx`, `Scenarios.tsx`,
`RelationshipBindings.tsx`, `ComponentDetails.tsx`, shared backend helpers and chat tools.

1. Add Behavior/Effects/Implementation sections in the existing configuration surface. Offer state
   table, finite guard/action selectors, expected-version/idempotency choices and exact target pickers.
   Keep overview cards focused on responsibility and relationships.
2. Add hook contract editor with pure/effectful choice, safe unavailable outcome, allowed dependencies
   and acceptance references. Display dependencies as links, not a code editor.
3. Link named failure paths to scenarios and show unresolved decisions in Review. Navigation from
   a finding opens the specific operation/field. Distinguish design preview from verification.
4. Allow scripted design chat to perform the same edits in one atomic turn; unknown options stay
   rejected. Add mouse-accessible actions for every required operation.
5. In P68c, add reusable bounded row/reference editors for the P66 capability settings. Expose
   file limits, recipient/projection choices, job policy, calendar intervals/holidays, finite rules
   and commerce strategy settings through the component's existing configuration dialog. Use
   strict schema-backed fields, not JSON/code textareas. Reference selectors navigate to definitions.

**Done when:** configure topic-close, order-payment-review and ticket-first-response flows with
typed hooks, including conflict and retry outcomes. Save/Cancel/undo/reload/conflict work. Dangling
effect targets cannot be saved as apparently complete. Incomplete designs remain editable and show
specific findings. Browser inspection covers narrow layout and exact-version protection.

**Not here:** visual programming language, runtime deployment, or accepting a prose rule as a tested
implementation. Do not reopen the deferred UI test maintenance campaign.

## P69

**Outcome:** Jeeves can explain why an exact template supports or rejects a declared capability.
**Depends on:** P68. **Profile:** S; A for selection UI.

**Read/change:** `packages/spec/src/{manifest,architecture,validate,findings}.ts`, registry,
template-kit contract; `CapabilityCatalog.tsx`, `ComponentDetails.tsx`, Review/handoff/evidence.

1. Add versioned capability descriptors to manifests: supported typed shapes/options, required
   host/store/transport, dependencies, conflicts, hooks, evidence pack IDs and implementation origin.
   Preserve legacy manifest parsing and exact registered versions.
2. Add implementation bindings referencing the exact descriptor and model obligations for C2 hosts,
   C3 components/operations and planned relationships. Keep architecture family selection distinct
   from executable attachment/module selection. Follow contract.md's planned-to-executable bridge;
   do not put both planned and template on an existing element to evade its validator.
3. Implement a pure matcher returning supported, needs explicit hook, unsupported or incompatible,
   with per-obligation reasons. Test using isolated fake manifests; do not advertise nonexistent
   production modules. UX5 prose claims cannot satisfy the matcher.
4. Expose selected implementation, unsupported options and pending hooks in technical details and
   handoff. Foundation versus full readiness is separate from design-review completeness.

**Done when:** the same component with two option combinations can be accepted/rejected correctly;
missing revocation support or wrong transaction store stays blocking. All legacy NEEDS_TEMPLATE
behavior remains until a real matching implementation exists. No `if implementation exists then
ignore errors` shortcut. Manifest serialization and export remain browser-safe and deterministic.

**Not here:** implementing any advertised capability, modifying frozen versions or relaxing the
global generation gate. Runtime support is introduced only by later packages with evidence.

## P70

**Outcome:** a deterministic, inspectable backend IR resolves all design obligations before output.
**Depends on:** P69. **Profile:** S.

**Read/change:** `packages/generator/src/{plan,modules,documents,lock}.ts`, template-kit context;
new `backend-plan.ts` and compiler helpers; backend model validators.

1. Define the versioned IR for hosts, entities/queries, policies, operation adapters, transaction
   participants, effects, runtime dependencies and hook obligations. Include a source identity/path
   on each generated responsibility. No filesystem, randomness, clock or provider calls in lowering.
2. Resolve exact bindings and option support across containers, components and relationships;
   deterministic naming derives from stable IDs. Check
   name/path/route collisions and forbidden host/store boundaries. Preserve useful unresolved
   diagnostics in analysis mode; executable mode requires resolved supported obligations.
3. Define foundation-mode handling for explicit safe hooks without changing legacy readiness.
   Route opted-in backend designs to the new readiness/compiler path; discharge each exact planned
   obligation only with its matching descriptor. Structural errors and unaccounted intent persist.
   Anonymous unsupported behavior remains blocked. Make mode part of the generation snapshot.
4. Produce a text/JSON plan preview and source map. Keep legacy resource generation on its existing
   path; shared primitives may be adapted through a deliberate pure adapter.

**Done when:** permutations of irrelevant display ordering do not change semantic output; stable
names survive presentation renames; incompatible options/cycles/unsupported requirements stop before
any output. Old generator fixtures retain existing executable outputs. Isolated compiler fixtures
prove each IR shape without registering fake production templates.
Cover a fully planned C2 host + C3 + connection graph, a partially mapped relationship, an external
adapter, and one supported component alongside an unsupported sibling. Only the fully accounted
supported/hooked graph can compile; saved planning identities/configurations remain unchanged.

**Not here:** rendering new runtime files, inserting stubs into existing apps, or changing the
physical resource migration model in order to make a test pass.

## P71

**Outcome:** a complete, editable Discourse-core design covering all D01–D20 obligations.
**Depends on:** P70. **Profile:** S + A.

**Read/change:** benchmark D scope/P60 source map; `mattermost-example.ts` as an authoring pattern;
new `packages/spec/src/discourse-core-example.ts`; example registry, docs and CATALOG.

1. Assemble the specified C1/C2/C3, entities, access, contracts and operation lifecycles using the
   shared model. Mark proposed TypeScript implementation separately from upstream facts.
2. Fully specify G rows and create narrow typed H hooks using the seam table. Default unsupported
   runtimes remain planned. Include all five D scenarios with exact outcome observations.
3. Add focused views for content mutation, permission/revocation and async delivery; deployment
   intent for one API/worker and the later two-API target. Enter unverified workload objectives.
4. Walk each row from input -> policy -> authoritative state -> effects -> output/failure. Resolve
   product decisions from benchmarks.md; do not leave ambiguous free text where a finite rule exists.

**Done when:** all rows have exact source/operation/data/scenario mappings, H hooks have pre/post
conditions, and Review explains only actual unsupported runtime/remaining hook implementation.
Mouse creation/export/reload and library fragment reuse preserve the design. No generic 'domain
module handles everything' component. Existing saved Mattermost projects remain unchanged.

**Not here:** backend implementation, UI layout, full Discourse compatibility, or hiding unresolved
model limitations to mark the design complete. Missing vocabulary becomes a scoped prerequisite fix.

## P72

**Outcome:** a complete, editable Vendure-core design covering V01–V20.
**Depends on:** P71. **Profile:** S + A.

**Read/change:** benchmark V scope/P60 map; new `vendure-core-example.ts`; example registry/docs.

1. Model catalog/cart, inventory, orders, payment attempts and fulfillment as cohesive components
   inside the specified hosts. Use exact money types and immutable quote/order snapshots.
2. Specify stock locking/order, reservation expiration/held state, callback authentication,
   idempotency, ambiguous payment and reconciliation outcomes. Identify every local atomic write set.
3. Model real provider, tax, shipping, promotion and other H work as bounded hooks with contracts.
   The reference provider's protocol evidence is separate from a live adapter's availability.
4. Add the five V scenarios and focused views for checkout, uncertain payment and fulfillment.
   Record REST adaptation explicitly and keep GraphQL parity outside this benchmark.

**Done when:** no rule allows paid/shipped state without its declared prerequisites; there is no
fictional cross-network transaction or automatic rollback of an external charge. Every V row and
critical case traces through the model and exports. A reviewer can explain last-item contention
and late settlement without inventing a rule. Mouse/history/serialization checks pass.

**Not here:** implementing money/stock/payment runtimes, production tax policy, marketplace logic,
GraphQL, or live transactions.

## P73

**Outcome:** a complete, editable Zammad-core design covering Z01–Z20 and a consolidated design gate.
**Depends on:** P72. **Profile:** S + A.

**Read/change:** benchmark Z scope/P60 map; new `zammad-core-example.ts`; example registry/docs.

1. Model organizations/groups, ticket/article ownership, internal-note projections, assignment,
   finite routing, calendar/SLA versions, deadlines and escalation dependencies.
2. Specify clock start/stop/cancel semantics exactly as the benchmark; separate more complex Z15
   behavior. Effects reference current ticket/deadline versions and cannot escalate a satisfied clock.
3. Add all H hook briefs, five scenarios, focused views and unverified workload objectives. Mark
   inbound email and external connectors explicitly unfinished rather than silently omitting them.
4. Run a design-only cross-check of all three examples: shared policies, lifecycle and delivery
   concepts use the same schemas; unsupported vocabulary is listed; all 60 rows are traceable.

**Done when:** internal notes are excluded from every customer observation path; first-response
calendar cases and reassignment races have exact outcomes. All examples export exact portable
definitions and remain editable. The P73 evidence report lists readiness per case and implementation
gap, with zero invented runtime passes. Resolve design contradictions before P74.

**Not here:** generating applications, adding an SLA-specific programming language, resetting existing
examples or marking all three designs implemented because they parse.
