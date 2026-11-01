# C4 authoring roadmap: reusable designs ready for implementation (P46–P57)

**Revised 31 October 2026 at the user's request. P46 and P47 are implemented and verified; P48–P57 remain planned.**
This replaces the original P46–P53 proposal retained in Git at `ee31075`. It incorporates
[the direction review](reviews/c4-direction-review-2026-10-31.md) and
[C4 modeling guidance](c4-modeling.md). P39–P45 remain complete. The next implementation
package, when execution is requested, is **P48 only**. See [P46 evidence](evidence/p46/README.md) and [P47 evidence](evidence/p47/README.md).

The outcome is an engineer using Jeeves to compose, inspect and revise a credible qrwty-sized
SaaS architecture through C2/C3 diagrams and reusable architecture templates. The result
must explain what later implementation agents should build. A plausible picture or a green
Generate button is insufficient.

## Scope and decisions

- Work on Jeeves's design model, editor, local catalog, validation and design exports.
  New application runtimes, runtime templates, generator filtering, generated contracts,
  deployment provisioning and live qrwty adoption remain outside this sequence.
- Keep current executable designs intact. Create a separate linked target workspace when
  exploring structural changes; do not put optionality into Generate by dropping dependencies.
- Use hosted qrwty as the reference. Private delivery is an optional deployment variant;
  no automatic SSO, airgap, Kubernetes or multi-region requirement follows.
- Retain React Flow, stable identities, outer C2 connection endpoints and scoped C3 views.
  Components can bind to a C2 connection through interfaces without becoming C2 wire endpoints.
- Reuse logical responsibilities and contracts. Managed hosting does not determine C-level;
  a queue/topic is a logical channel, and its broker belongs in deployment.
- Preserve the applicable P39–P45 decisions D1–D16. Their presentation conventions remain
  Jeeves conventions. The unapproved D17–D30 questionnaire is superseded by this specification;
  it is not a list of unanswered prerequisites or retrospective user approvals.

The October 31 audit found live qrwty revision 17 had three elements, two connections and
no authored architecture. That is historical evidence, not a revision to hard-code. The
separate target example already supplies broad catalog coverage. This sequence develops
its semantics, readability and reuse; it does not repeat the business research.

## Package order

| Package | Result | Main prerequisite |
| --- | --- | --- |
| P46 | Correct catalog boundaries and independent tenancy choices | P45 |
| P47 | Reusable interface and data-contract definitions | P46 |
| P48 | Bindings, access, ownership and failure policies on relationships | P47 |
| P49 | Readable focused views and persistent layout | P48 |
| P50 | Four insertable, contract-aware architecture patterns | P48–P49 |
| P51 | Requirement-based advice and recorded decisions | P48–P50 |
| P52 | Linked current/target workspaces and evidence-based annotation | P49–P51 |
| P53 | Planning deployment views referencing logical architecture | P46, P49, P52 |
| P54 | Scenarios with alternatives, outcomes and client journeys | P48, P51–P53 |
| P55 | Save and reuse local architecture templates/patterns | P50, P54 |
| P56 | qrwty design proof and a small non-QR reuse proof | P46–P55 |
| P57 | Revision-bound implementation brief and diagram export | P56 |

Execute sequentially in the existing branch, one bounded package per agent session and
commit. Dependencies explain sequencing, not permission to start several packages together.
Chat support follows each package's shared operations and validators; P56 proves the
combined chat workflow with scripted responses, without paid model calls.

The old package names change: horizons become P52's target workspace; patterns move to
P50; advice to P51; live uplift becomes safe annotation/copying in P52/P56; deployment
moves to P53; layout moves forward to P49; decisions and export split into P51/P57.
P47/P48 fill the missing contract layer. P54–P57 complete behavior, user-defined reuse,
product proof and handoff.

## Shared model contract

These rules apply to the whole sequence. Exact TypeScript shapes belong in the owning
package, but agents must preserve these semantics.

| Concept | Required meaning |
| --- | --- |
| Logical element | An application, data store, external system or separately identified deployment concern. Keep architectural classification separate from existing runtime host-role compatibility. |
| Component | One responsibility inside one container, with provided/required interfaces and named invariants. Family selection supplies a starting definition, not behavior. |
| Contract | A stable identity and explicit version describing an API, in-process interface, event payload or logical data shape. Separate reusable definition from provider/consumer instances. |
| Binding | References the exact contract/version, endpoints and existing C2 connection or local C3 relationship. Multiple operations can share a connection; their intent must remain distinguishable. |
| Data responsibility | A logical dataset with an authoritative owner, selected store, readers/writers and tenant/lifecycle policy. It may refer to an existing resource; it is not a second SQL schema. |
| Requirement | A typed policy on the relevant system, component, dataset or interaction. Unknown is explicit; private network is not authentication; a declaration is not runtime evidence. |
| Pattern / architecture template | A versioned declarative fragment with required roles, contracts, configuration and extension points. It expands into editable model instances. It is distinct from an executable runtime template. |
| Target | A separate design with an immutable baseline snapshot and provenance. A diff says what is proposed; it neither updates the source nor proves the source is deployed. |

**Compatibility and incomplete work.** Existing documents load without new fields.
Duplicate identities, dangling references, impossible ownership or invalid field values
are structural errors. Unbound required interfaces and undecided policies are saveable
incomplete design with explicit findings. Contradictory selected policies prevent design
review completion, not a silent rewrite to preferred values. Preserve existing runtime
readiness findings and `NEEDS_TEMPLATE` behavior, including planned C3 components.
Keep review findings/status separate from the generation findings consumed by
`blocksGenerate`, which currently blocks every error-level finding. Do not weaken that
function or pass new review-only conflicts into it as generation errors.

New architecture declarations do not implement behavior or modify executable bindings.
A generatable legacy design still generates its existing supported behavior; display any
additional unimplemented design intent separately. Planned target blocks continue to block
Generate. No package changes the compiler to select a subset, rewrites a lock to hide missing
requirements, or presents architecture review as proof of generated capability.

Reuse existing REST/resource/event schemas and P38 operation references where applicable.
An implemented binding refers to its actual element/attachment/member identity and saved
contract revision; its authoritative shape is read-only here. New planned contracts use
bounded structured payloads with unresolved fields allowed. No arbitrary OpenAPI importer,
remote schema fetching, expression language, schema-subtyping engine or executable policy DSL.
Exact version/identity matching is the first compatibility rule; adapters require an
explicit responsibility and separate contracts.

## Shared delivery and checks

Each package follows AGENTS.md and PLAN §15: read this shared contract, its own section,
the named code and latest handoff. Preserve unrelated work. Add focused tests for the new
semantic boundary and relevant production browser journeys. Do not expand an exhaustive
certification campaign or regenerate/restart live qrwty.

- Use validated operation batches and the existing revision-conflict model. Semantic changes
  have Save/Cancel, one-step undo/redo and reload continuity. Preserve invalid/conflicting
  drafts. Layout-only actions must not change semantic revision; use layout history where
  needed rather than inventing semantic edits for geometry.
- All normal actions work by mouse. Inspect actual 1440 × 900 light and 390 × 844 dark
  captures; narrow fitted diagrams may be overviews, but focused content must be readable.
  Run accessibility and strict browser diagnostics on changed journeys.
- Chat uses the same model, validation and pattern expansion. Keep ordinary edits one undo
  step per turn. Ask only for materially ambiguous choices or existing destructive-change
  reviews; do not create a blanket confirmation step for all planning edits.
- Run focused `pnpm work run unit <existing-or-added-test-paths>` and
  `pnpm work run browser-preview <named-specs>`, then `VITEST_MAX_WORKERS=4 pnpm work run check`.
  Four workers preserve P45's documented test-concurrency mitigation; do not weaken tests.
- Run `packages/generator/src/architecture.test.ts` for model changes. Existing outputs,
  runtime bindings and ownership must remain unchanged; the lossless `jeeves/design.json`
  snapshot and its derived bookkeeping may reflect newly saved metadata. Do not assert that
  a changed input snapshot is byte-identical or refresh generated golden files to hide drift.
- Update CATALOG only for actual authoring availability. Append evidence, limitations and
  exact next work to `docs/handoff.md`; create a scoped local `P<n>:` commit. No new runtime
  capability is marked implemented by completing an authoring package.

## P46 — Catalog semantics and system choices

**Complete.** [Evidence and compatibility limits](evidence/p46/README.md).

**Outcome:** the library helps choose the right abstraction without destructive relabeling.

**Build:**
- Add explicit architectural classification and ownership independent of template host role.
  Explain logical application/store, external system and deployment infrastructure in the
  picker. Managed databases remain stores; a logical gateway or owned collector can remain
  an application. Hosting choice does not determine boundary or hide connections.
- Treat job queue/event stream entries as logical channels. Clarify broker deployment in
  their help. Keep existing IDs/configuration readable; do not merge channels or migrate
  meaning based on names. Existing load-balancer/infrastructure entries remain inspectable
  and labeled for deployment placement until P53, rather than silently disappearing.
- Consolidate only genuinely equivalent external-provider presets. Preserve the difference
  between an internal notification service, a C3 notification module and a third-party
  delivery provider. Old catalog IDs remain compatible aliases where needed.
- Add four planned C3 families: Entitlements & quotas, Abuse & trust/safety, Custom domains,
  and Data lifecycle. Domain ownership/verification is C3; certificate termination/placement
  also references deployment. Use bounded choices with an explicit unspecified value.
- Separate system business tenancy (personal/organization/agency-client/custom), authorization
  intent, data isolation (shared scoped/schema/database/dedicated/undecided), and delivery
  model (hosted/private/both/undecided). Detailed permissions come in P48. C1 shows purpose
  and tenant audience; technical isolation remains in the inspector/C2 details.
- Preserve legacy combined tenancy options as legacy intent until deliberately resolved;
  never translate one old value into several claims it did not establish.

**Acceptance:** old examples and designs retain identities, relationships and generation
behavior. Mouse authoring can express organizations in either shared or dedicated storage,
an externally operated store, an owned collector and two independent queues. New families
have compatibility checks, useful defaults and honest planned labels. Chat discovery matches
the picker. Existing catalog, authoring and example browser suites pass.

**Pointers:** `packages/spec/src/{planned-capabilities,architecture,container-display}.ts`;
`apps/web/src/architecture/{CapabilityCatalog,PlannedInspector,ContextInspector}.tsx`;
`apps/server/src/chat/tools.ts`. Extend `architecture-authoring.spec.ts` and
`architecture-examples.spec.ts`.

**Excluded:** deployment editor, provider runtime changes, automatic migration of live designs.

## P47 — Interface and contract authoring

**Complete.** [Evidence and compatibility limits](evidence/p47/README.md).

**Outcome:** a C3 responsibility says what it provides and requires, with reusable definitions.

**Build:**
- Add project-local contract definitions with stable identity, explicit version, kind,
  description and bounded operation/payload/data shapes. An interface instance names its
  provider or consumer and references a definition; it does not duplicate that definition.
  Containers/external systems can expose interfaces without fabricated internal components.
- Provide an interface editor from component/container inspection. Support planned operations
  and event payloads, required versus optional uses, unresolved drafts, and logical datasets.
  Permit domain-specific interfaces without requiring a new built-in catalog family.
- Reference existing P38 REST operations and durable-event definitions by stable ownership
  references, showing their authoritative shapes read-only. Mark planned schemas distinctly.
  Changing a referenced source contract marks the design reference stale; never preserve a
  stale claim of compatibility or edit generated contracts through this UI.
- Versions are exact identities. Renames preserve references. Changing a referenced shape
  creates a new version and an explicit consumer-update preview; no implicit semver inference.
  Unreferenced drafts remain editable. Do not introduce a remote contract registry.
- Show provided/required interface summaries within C3 inspection; avoid endpoint lists on
  the overview. P48 supplies binding and policy editing.

**Acceptance:** author `UpdateDestination` and `VisitRecorded v1`, reuse their definitions,
rename without breaking references, and introduce v2 while v1 consumers remain visible.
Required-but-unbound is saveable and visible. Invalid ownership/dangling references are
rejected atomically. A legacy REST operation remains protected and generation unchanged.

**Pointers:** `packages/spec/src/{architecture,api-preview,resources,delivery,operations,apply}.ts`;
`apps/web/src/architecture/{ComponentEditor,ComponentDetails}.tsx`; existing API workspace.
Add `architecture-contracts.test.ts` and `architecture-contracts.spec.ts`; retain
`api-contracts.spec.ts` regression coverage.

**Excluded:** runtime ports/adapters, general schema tooling, contract compilation into code.

## P48 — Relationship bindings and architecture policies

**Outcome:** connections express contracts, authority and relevant failure behavior.

**Build:**
- Bind exact provided/required interfaces to existing C2 connections or in-process C3
  relationships. Validate endpoint ownership and containment. Cross-container C3 uses
  project through the same C2 identity; several bindings can share that connection.
- Record interaction role (request, publish, consume, callback, read, write) separately from
  transport and business synchrony. A webhook can be asynchronous business delivery over an
  acknowledged HTTP request. Keep D5's dashed-line convention with a clear legend.
- Add focused, applicable policy groups: identity/tenant scope; timeout and failure outcome;
  retry bound and idempotency requirement; event delivery/ordering/acknowledgement; freshness
  and invalidation. Unknown stays unknown. Do not require every field on every relationship.
- Assign logical datasets an authoritative owner/store and explicit read/write access. Bind
  tenancy, retention/deletion and export access to that identity. Refer to existing resources
  where available; shared ownership requires an explicit decision, not a guessed owner.
- Attach workload/service objectives to the relevant scope: value, unit, boundary and
  measurement window. Distinguish redirect response time, analytics lag and background job
  completion. These are unverified design targets, not benchmarks or automatic topology.
- Keep old executable connections unchanged. Selected contract mismatches are design-review
  findings; malformed references remain structural errors. Missing bindings remain editable.

**Acceptance:** model cache-aside, a signed billing callback and a visit channel with bounded
loss separately. A C3 dependency traces to C2; mismatched versions and conflicting tenant
policies are explained. User identity and private-network reachability are not conflated.
Renaming/removal, mouse editing, history and conflicts preserve reference integrity.

**Pointers:** `packages/spec/src/{architecture,relationship-display,validate,findings}.ts`;
`apps/web/src/architecture/ComponentRelationshipEditor.tsx`; C2 connection inspector.
Add `architecture-bindings.test.ts` / `architecture-bindings.spec.ts`; rerun authoring and
contract suites.

**Excluded:** policy execution, real authentication, queue clients, generation port changes.

## P49 — Focused views and stable layout

**Outcome:** the architecture can be read and edited without zooming every label individually.

**Build:**
- Save named C2 views for a selected responsibility/flow and its immediate dependencies;
  retain a whole-system overview. C3 remains scoped to one container. Show boundary/context
  and a count/link for hidden relationships so filtering cannot imply that dependencies vanish.
- Store view membership/filter choices, positions and camera in the separate layout document,
  keyed by stable view and element identity. Preserve existing layout documents on upgrade.
  Add mouse nudge/drag, Fit selected, Reset layout and scope navigation with retained cameras.
- Keep semantic edits out of layout history. Prune only removed identities; preserve positions
  through rename and ordinary configuration edits. Target comparison later uses the same keys.
- Route labels legibly; concise contract summaries expand on selection. Default qrwty views
  should expose management, public redirect and analytics paths separately.

**Acceptance:** a representative target with 15+ elements remains useful through focused
views; selected labels are legible at the standard desktop viewport. Narrow editing has no
clipped actions. Reload preserves layout; reset returns to deterministic layout; semantic
revision and generated output do not change. Existing C1/C3 navigation remains intact.

**Pointers:** `packages/spec/src/layout.ts`, `apps/web/src/architecture/{ArchitectureWorkspace,
ArchitectureGraph,layout,layout-client}.ts*`, draw layout persistence. Extend
`architecture-layout.spec.ts` and its unit suite; rerun `draw.spec.ts`.

**Excluded:** a new canvas engine, arbitrary nesting or workflow semantics in layout objects.

## P50 — Contract-aware pattern composition

**Outcome:** compose useful architecture in a few edits while preserving its guarantees.

**Build:**
- Introduce a versioned declarative fragment format: required host/boundary roles, contracts,
  responsibilities, relationships, policies, bounded configuration, extension points and
  optional scenario. Use the P47/P48 model; do not create a second connection/schema language.
- Ship four patterns: tenant workspace/access; billing plus entitlements; cached public lookup
  with update/disable propagation; asynchronous work delivery. The delivery pattern offers
  explicitly different best-effort and transactional-outbox variants. Outbox requires atomic
  domain/event persistence and a delivery responsibility; a queue/handler alone cannot match.
- Preview additions and candidate bindings. Reuse only on explicit compatible role, ownership,
  contract and policy matches. Multiple suitable stores/queues require a choice. Several
  different logical queues may share the same later broker deployment.
- Apply one validated operation batch with fresh instance IDs, pinned pattern provenance,
  retained customizations and one undo step. Nothing is added on Cancel or revision conflict.
  Pattern expansion creates design intent; it never attaches a runtime based on a guess.
- Expose list/describe/preview/apply through chat using the same expansion function. Once a
  binding choice is unambiguous or provided, ordinary application needs no extra approval flow.

**Acceptance:** add the four patterns to a three-container fixture, reuse the selected API
and store, and keep visit and billing channels distinct. Wrong tenant/contract/guarantee
matches are refused; unfilled roles remain visible. Undo and a scripted chat application
match mouse output. Prove outbox intent without claiming an unimplemented runtime.

**Pointers:** add `packages/spec/src/architecture-patterns.ts`; existing operation batching,
`CapabilityCatalog.tsx` and `apps/server/src/chat/tools.ts`. Add pattern unit/browser suites;
retain catalog/authoring regressions.

**Excluded:** eleven broad presets at once, runtime attachment adoption, user-published library
storage (P55), automatic topology optimization.

## P51 — Architecture review findings and decisions

**Outcome:** feedback explains unmet selected requirements without enforcing a preferred style.

**Build:**
- Add architecture-review findings distinct from existing structural errors and generation
  readiness. Report missing/contradictory selected contracts, owner/access policy, cache update
  or fallback policy, channel delivery responsibility and required failure outcomes.
  Return/store review findings separately; preserve the existing generation error gate.
- Rules cite their inputs and assumption. A worker can be triggered by a schedule or request;
  an external consumer can satisfy delivery. Cache-aside needs application fallback, not a
  cache→store edge. Synchronous search, personal billing and async-send-then-response are valid.
- No warnings based solely on component count, duplicate family, a visitor-facing service,
  private hosting or a line style. Do not encode an automatic SSO/SCIM requirement.
- Add concise decision records: context, decision, consequence, status and linked identities.
  An acknowledgement includes reason and relevant-input fingerprint; it reappears when those
  inputs change. It cannot suppress structural invalidity or certify missing implementation.
- Group findings by concern, link directly to editors/pattern previews, and distinguish an
  explicit unresolved decision from an accepted, scoped tradeoff.

**Acceptance:** positive and negative fixtures for each rule, including the valid cases above.
A contradictory contract blocks design-review completion; advisory preferences do not block
saving or alter Generate. Changed inputs invalidate acknowledgement; all review actions work
by mouse. The example is not forced to zero findings by hiding unmet requirements.

**Pointers:** `packages/spec/src/{findings,architecture,validate}.ts`, draw findings UI;
add `architecture-review.ts` plus focused unit/browser suites. Preserve tests for
`blocksGenerate`, operation rejection and historical repair.

**Excluded:** capacity/security certification, blanket policy defaults, auto-applying advice.

## P52 — Current and target design workspaces

**Outcome:** evolve an existing design without changing its executable source or losing context.

**Build:**
- Add “Create target from this design”: capture source project/revision, immutable baseline
  semantic snapshot and a separate editable target. Reuse stable identities within the new
  project so the diff explains additions, removals and changes. Source edits later appear as
  baseline drift; never merge or refresh the baseline silently.
- Copy runtime pins, configuration and recipe constraints faithfully. Protected core changes
  remain protected; creating an editable conceptual replacement is an explicit planning action
  with retained baseline/provenance, not detaching a recipe to overwrite its generated output.
- A target has no inherited output-directory ownership or run/generation history. Planning
  workspace actions cannot write to the source output, start runs or invoke generation.
  Enforce that at the project action/API boundary; do not change generator subset semantics.
- Add Current baseline / Proposed target / Changes navigation. No mixed image should imply
  both topologies run together. Display saved-design facts separately from deployment evidence.
- Suggest context and responsibility groups from explicit auth/resource/extension bindings,
  with editable drafts and source references. Naming hints may assist review, but never assert
  that operation names prove business behavior. This works on copies and generic examples.
- Project creation is atomic and permits structurally valid incomplete planning documents.
  Preserve stricter existing executable starter/recipe creation. On failure, leave no orphan
  project or partial baseline. Source deletion later does not destroy the retained snapshot.

**Acceptance:** create a target from a legacy three-container fixture and from a protected
recipe. Edit the target, compare it, change the source and detect drift without touching source
output/history. API-level generation/run attempts against the target are refused. Both
creation failure and revision conflict are covered. Annotations have provenance and remain
editable; no live qrwty mutation is part of this package.

**Pointers:** `apps/server/src/design/service.ts`, project routes/persistence, project chooser,
architecture workspace and evidence presentation. Add `architecture-targets.spec.ts` and
service/unit tests. Current createProject rejects initial readiness errors: add a deliberately
scoped planning path rather than loosening all project creation.

**Excluded:** merge/rebase, automatic source reconciliation, selective generation, live adoption.

## P53 — Logical deployment planning

**Outcome:** explain placement and failure domains separately from logical architecture.

**Build:**
- Add planning environments with nested deployment nodes, container instances referencing
  C2 identities, and infrastructure nodes. Store replica counts, technology, region/zone and
  responsibility for managed services as declarations. Environments are alternatives, not
  duplicate applications in C2; a managed store keeps its C2 logical identity.
- Place named channels on broker infrastructure without merging channel definitions. Place
  CDN/TLS/load-balancing concerns where appropriate; external products retain their boundary.
  Offer a reviewed mapping for legacy infrastructure elements, preserving source identities
  and relationship meaning rather than blanket automatic reclassification.
- Instance interactions trace to logical relationships. Infrastructure wiring has a distinct
  deployment-only identity when no C2 relationship applies; it cannot invent application
  contracts or executable connections.
- Retain P33's derived read-only local view with its documented supported scope. Do not imply
  it describes every arbitrary compose service. Editable hosted/private environments are
  explicitly planned; regions/replicas alone prove no failover or capacity.
- Use P49's view/layout controls. Do not require a private environment in the qrwty reference.

**Acceptance:** show one logical redirect service with multiple instances, two logical queues
on one broker, and an external email provider. Validate references, acyclic nesting and instance
counts. Mouse edits/history persist; source C2 remains unchanged. Local P33 regressions pass;
planned deployment creates no files, credentials, resources or runtime measurements.

**Pointers:** `packages/spec/src/local-deployment.ts`, architecture model, `LocalDeployment.tsx`,
layout/projection code. Add `architecture-deployments.spec.ts`; retain `local-deployment.spec.ts`.

**Excluded:** provisioning, orchestration, costs, autoscaling controllers, measured resilience.

## P54 — Scenarios, outcomes and client journeys

**Outcome:** the diagram explains important behavior and visible product outcomes, not only order.

**Build:**
- Extend P45 scenarios with actor/start condition, explicit alternatives, relevant failure
  cases and expected outcomes/invariants. Use a bounded ordered main path plus named alternative
  paths; no workflow language, loops, arbitrary scripts or executable state machine.
- Reference existing context, C2 and C3 relationships and P47/P48 bindings. A step may identify
  request versus response or asynchronous continuation without reversing the static dependency.
  Add explicit authored context relationship references for actor entry/exit; validate scope.
- Allow steps to reference client feature areas and their visible states (loading, success,
  denied, failed), coupled to actual operations/contracts. This is product journey intent,
  not a React component tree, route generator or page-layout designer.
- Link scenario outcomes to requirements/decisions. Distinguish an authored acceptance
  expectation from a test result. Editing a relevant contract makes its scenario review stale.
- Keep P45 scenarios lossless; missing new fields are incomplete rather than fabricated.

**Acceptance:** model redirect cache hit/miss and queue failure; billing duplicate delivery;
and an owner action ending in a visible success or denial. No rule treats a numbered async
step followed by a response as inherently invalid. Scope/reference checks, rename/removal,
mouse reorder/history/conflicts and P45 regressions pass.

**Pointers:** `packages/spec/src/scenarios.ts`, architecture validation, `Scenarios.tsx`, client
component inspector. Extend `scenarios.test.ts` and `architecture-scenarios.spec.ts`.

**Excluded:** application routing, UI generation, executable simulations, automatic test generation.

## P55 — User-defined reusable architecture library

**Outcome:** reuse a good design without waiting for a built-in family or copying a whole project.

**Build:**
- “Save as architecture template” extracts a C2/C3 selection into P50's declarative format.
  A single component is a valid template; several containers form a pattern. External
  dependencies become named required roles/contracts, not dangling references or auto-inclusions.
- Review name, purpose, compatible hosts, exposed options, required roles, invariants and
  explicit extension points. Preserve bound interfaces and policy guarantees. Exclude project
  identity, output paths, private configuration and run evidence from the reusable artifact.
- Store immutable published versions in a local server-owned catalog; separate drafts from
  published entries. Pin content/version provenance in each insertion. Later publication
  does not update existing instances. Editing an instance does not modify the library source.
- Preview local template insertion through the same binding/matching rules as built-in
  patterns. Copy independent instance IDs; preserve shared definition references deliberately.
  Search/list/describe through UI and chat with “architecture only” availability.
- Support deletion of an unused draft and retirement of a published entry from new selection
  while preserving references. No automatic migration or executable template publishing.

**Acceptance:** save a tenant-access component and a multi-container delivery pattern, reuse
both in another project, customize one instance, and publish v2 without changing v1 consumers.
Missing roles and incompatible guarantees are visible. Restart retains the library. Scripted
chat and mouse insertion use the same version and produce equivalent semantic results.

**Pointers:** P50 fragment format and expansion, catalog UI/chat discovery, server local
persistence conventions. Add `architecture-library.test.ts` / `architecture-library.spec.ts`.

**Excluded:** public marketplace, remote installation, executing uploaded code, runtime artifact
packaging, automatic upgrades, general dependency-resolution machinery.

## P56 — qrwty architecture proof

**Outcome:** demonstrate that the editor and reusable catalog can specify a serious QR SaaS.

**Build:**
- Refresh the separate qrwty target using the model and patterns above, with readable focused
  views. Model owner/staff clients, management API, public redirect, background processing,
  primary data and artwork storage. Add lookup/channel/analytical storage only with stated
  responsibility; keep hosted-first and optional growth choices explicit.
  Show payment/email providers and DNS/TLS responsibilities with their actual boundaries.
- C3 covers tenant access, links/payload/content, artwork, billing/entitlements, custom domains,
  abuse decisions, reporting, audit and data lifecycle, plus corresponding client feature areas.
  A QR URL, encoded payload and hosted landing-page content are distinct responsibilities;
  avoid a separate infrastructure template per QR content type.
- Complete the six scenario families below. Use illustrative design targets only when labeled
  as examples. Unspecified production workload/SLO values remain visible handoff decisions,
  never evidence of scalability. Scenario correctness policies must be explicit.
- Prove a new user can assemble the design by mouse from a small starting model and inspect
  every material decision. Provide a scripted chat journey using the same APIs; agent prose
  cannot supply missing semantic fields or downgrade unresolved findings.
- Reuse tenant access and asynchronous delivery in one small non-QR example (Inventory is
  sufficient). No second large product or new runtime is required.

| Scenario family | Required architecture decisions |
| --- | --- |
| Create/edit link, artwork or hosted content | Stable printed identity; tenant ownership; versioning and cache update propagation. |
| Follow QR during cache/queue failure | Lookup authority/fallback, response boundary, analytics acknowledgement/loss policy. |
| Invite/restrict a member or use an API key | Tenant checks across APIs, data, worker jobs and exports; revocation effect. |
| Duplicate billing webhook / downgrade | Deduplication and entitlement ownership; explicit fate of existing printed links. |
| Domain attach/transfer/removal and abuse shutdown | Ownership verification, TLS responsibility, path preservation, bounded enforcement policy. |
| Analytics query/export/delete and recovery | Event meaning, retention, authorized access, freshness and recovery ownership/objectives. |

**Acceptance:** independent reviewer can trace actors→components→contracts→data and material
failure outcomes without inventing architecture. Expected policy conflicts fail review and
legitimate tradeoffs remain recorded. Every critical scenario references model identities;
architecture review, template availability and runtime evidence remain separate. Save/reload,
undo/conflicts, readable captures and both input paths pass. Live qrwty stays untouched.

**Pointers:** `architecture-examples.ts`, qrwty target study, catalog reuse links and the six
scenario gate in the direction review. Extend example/scenario/chat browser suites and add
`qrwty-design-readiness.spec.ts` for the combined mouse journey.

**Excluded:** a generated enterprise app, load/security certification, sales validation, live uplift.

## P57 — Review snapshot and implementation handoff

**Outcome:** later implementation agents receive precise decisions, contracts and open work.

**Build:**
- Produce a revision-bound review snapshot containing scope, actors, C2/C3 responsibilities,
  exact interfaces/versions, bindings, data ownership, policies/objectives, scenarios, decisions,
  deployment intent and reusable-template provenance. Include completeness and unresolved
  items by identity, not an AI-written assertion that the design is ready.
- Show a coverage table separating available executable templates/versions, supplied recipe
  behavior, planned architecture templates and custom extension obligations. Existing evidence
  keeps its project/revision/environment identity; planned clones inherit no passes.
- “Ready for implementation review” requires structurally sound references and no unassigned
  critical behavior/contract decisions. Unverified runtime objectives remain labeled targets.
  Open capacity or commercial choices are listed with an owner and the scope they block;
  approval of a partial scope is explicit and does not activate partial generation.
- Download deterministic Markdown and JSON with schema/version and design fingerprint. Resolve
  referenced contract shapes and architecture-template manifests into portable sanitized
  snapshots; label unavailable definitions instead of fetching or inventing them. Export
  the selected diagram as SVG from the same view projection/geometry, including title/legend
  and planned status. Repeated export of the same snapshot is stable; relevant semantic changes
  make earlier review status stale. Track layout separately for diagram reproducibility;
  panning does not invalidate architectural decisions. Omit private runtime configuration
  and local output paths.
- Link each missing implementation responsibility to its acceptance expectations and contract
  boundary. Do not generate code, create agent tasks, select models or rewrite generated locks.

**Acceptance:** qrwty and the non-QR example export a complete portable brief; a deliberately
unbound critical interface prevents a ready label. Rename/update makes the old review stale;
missing templates remain explicit. JSON round-trips through its real schema, Markdown links
resolve within the bundle, and the SVG is readable and matches the selected view. No source
app writes or generation calls occur.

**Pointers:** architecture projection/evidence, P51 decisions/review, P55 library provenance,
server read APIs and editor actions. Add `architecture-handoff.test.ts` /
`architecture-handoff.spec.ts` and inspect exported artifacts.

**Excluded:** Structurizr DSL/PNG exporters, runtime generation, implementation orchestration,
automatic test authoring, claims that the design is already production-ready.

## Completion and next phase

The sequence is complete when qrwty can be composed and reviewed through the editor,
important behavior is expressed in the model, another application reuses the same patterns,
and the exported brief leaves implementation agents bounded work rather than architecture
guesswork. Current executable designs retain their behavior and ownership.

The next phase is a separately scoped runtime/template and generation plan. It may implement
contracts, resolve template coverage and eventually offer dependency-complete generation
scopes. It must not reinterpret this roadmap as permission to perform those tasks now.

Reference definitions: [C4 containers](https://c4model.com/diagrams/container),
[components](https://c4model.com/abstractions/component),
[queues/topics](https://c4model.com/abstractions/queues-and-topics),
[deployment](https://c4model.com/diagrams/deployment),
[notation](https://c4model.com/diagrams/notation),
[transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
and [cache-aside](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside).
The linked direction review records the source-based corrections; implementation agents need
not repeat the market or C4 survey.
