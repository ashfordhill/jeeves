# Exact studio implementation assignments

Read the [parent plan](../../build-plan-studio-ux.md) and its linked contracts. This is an ordered
queue of **25 work units**, not an instruction to execute them all. All are unstarted when this
plan is written. A parent with suffixes is a milestone, not one assignment. If assigned UX02,
implement its first unfinished child only and report the parent incomplete.

```text
UX01
UX02a UX02b UX02c
UX03
UX04a UX04b
UX05
UX06a UX06b
UX07a UX07b
UX08a UX08b
UX09 UX10
UX11a UX11b
UX12 UX13
UX14a UX14b UX14c UX14d
UX15
```

Each unit depends on all earlier units being committed complete unless the owner explicitly assigns
a different order. Specific dependencies below explain the contract it consumes; they do not permit
parallel work. Never finish one unit and silently start the next.

## Shared execution protocol

Before editing, read AGENTS.md, PLAN §15, the latest handoff, the assigned section here and its
specific contracts. Inspect current source names; listed new files are proposed deliverables, not
claims that they exist. Capture `git status` and preserve unrelated changes. Use primary `main`.
Do not delegate, create a branch/worktree, install unnecessary dependencies or touch sibling repos.

For every code unit run `pnpm lint`, `pnpm typecheck`, `pnpm --filter @jeeves/web build`, and direct
browser inspection relevant to the change. Save command outcomes, not a claim of checks you meant
to run. Unit/E2E/template suites and maintenance are deferred by the owner. For a model-only unit,
inspect existing UI compatibility and use small one-off schema/API/round-trip observations to prove
the new contract. Do not run the whole historical suite. Follow the parent plan's desktop sizes.

Append `docs/handoff.md`, write concise evidence under `docs/evidence/studio-ux/<unit>/`, update
CATALOG/current guidance when implemented boundaries change, and commit only that unit's files
with `<unit>: <concrete change>`. Report exactly what is complete, any remaining limitation and
the next assigned-unit boundary. A checkpoint for unfinished work is not a completed unit.

If existing code makes a requirement impossible, state the exact conflict and evidence. Do not
invent another UX, replace a provider with one you prefer, weaken validation, discard old data,
quietly split a package across commits without documenting it, or expand runtime scope. A technical
refactor inside the stated boundary is allowed; a new product decision goes back to the owner.

## UX01 — Baseline, action inventory and public inspection fixtures

**Read:** source review/decisions, interaction action table, coverage §3; existing
`ArchitectureWorkspace.tsx`, `ArchitectureGraph.tsx`, `layout.ts`, `layout-client.ts`, toolbar,
`draw/store.ts`, Generate/Runs and the current source of each example.

**Deliver:** a finite inventory of every current header/menu/toolbar action with its new destination;
baseline screenshots at both desktop sizes; public small fixture data for single service, package,
shared channel, shared data, dense graph and legacy preservation. Record raw source hashes and
the known incomplete P73a boundary. Fixtures may describe the future studio shape as plain tracked
input until UX02 provides its parser; do not register them as working runtime templates.

**Do:** inspect the drag code and record node/edge/layout-request behavior during a representative
move. Distinguish observed flicker from the candidate all-edge label-relocation cause. Keep the
last valid graph visible in evidence; no performance fix in this unit. Inspect existing user projects
read-only, blocking mutation requests before page load; use owned disposable copies for gestures.

**Done:** every current action is accounted for; all nine shipped examples and five additional
references are in the coverage inventory; fixture IDs/provenance and before hashes exist. No live
project was rewritten and no provider/generation task ran. Capture actual baseline warnings/errors.

**Not here:** UI redesign, model implementation, new backend tests or benchmark repair.

## UX02a — Strict studio data and definition reference schemas

**Read:** model §§1–4, configuration §§1–4; `design.ts`, `architecture.ts`, `ids.ts`,
`architecture-choices.ts`, `planned-capabilities.ts`, spec exports.

**Deliver:** strict `StudioModel`, closed settings unions, immutable definition refs, package/resource
ownership schemas and exported types. Define the finite enums/ranges once, for later catalog/forms
to consume. Keep missing studio metadata optional; no default-on-read migration. Use existing slug
IDs and exact semantic versions, not ad hoc strings. New fields live where the model contract says.

**Do:** add structural/reference validation hooks without changing legacy meaning. Resolve duplicate
IDs/bindings, impossible package/resource targets, engine/provider mismatch and channel roles.
Validate the public input fixtures through the new schema using one-off inspection. Capture at least
one rejected malformed case per invariant family and unchanged legacy parsing/serialization.

**Done:** valid finite designs parse; bad refs/types/bounds reject with precise paths; old documents
round-trip without added studio defaults. Explicitly show Docker default versus unspecified language
and managed execution. No new template is registered or declared runnable.

**Not here:** forms, rich catalog UI, new runtime types or API/data-business authoring.

## UX02b — Atomic edits, cleanup and generation guard

**Read:** model §§2/6/7; `operations.ts`, `apply.ts`, `validate.ts`, server project operations,
existing generation/readiness entry points and `draw/api.ts`.

**Deliver:** `setStudio`, `updatePlannedConnection` and shared command helpers for create/edit/connect/
group/ungroup/delete, with server-side all-or-nothing validation. Add a generation support guard
for the new design-only studio bindings before any new UI is exposed. Preserve old generator paths.

**Do:** build mutations against the accepted base revision; leave unrelated architecture fields
intact. Remove dangling studio bindings when explicit deletion removes their targets; shared owner
deletion must reassign or reject. Package ungroup preserves children; partial membership removal
must not leave invalid one-member packages. Use existing history; one command batch is one step.

**Done:** direct API observations show create+binding atomicity, conflict rejection with no partial
mutation, invalid shared-resource deletion rejected, explicit ungroup preserved, undo/redo/reload
restored values. An unsupported studio document cannot start application generation through a direct
API request. An existing supported legacy document retains its prior eligibility. Do not actually
launch external agents/provider work to verify these gates.

**Not here:** output-code implementation, loosened backend validation or a new operation transport.

## UX02c — Copy, reusable insertion, portable preservation and legacy adapter

**Read:** model §§5–7; `architecture-library.ts`, `architecture-patterns.ts`, handoff model/export,
`layout.ts`, existing ID/reference remappers and project-copy paths.

**Deliver:** complete studio reference remapping, portable export/source inclusion and layout key
pruning; explicit legacy-to-studio display mappings with no semantic migration. Extend exact-ID
enumeration wherever packages/resources/connections now participate.

**Do:** exercise a copy containing two services, shared queue, selected lookup connections, package
owner and frontend serving reference. Reuse an external resource by an explicit mapping, then reject
an unresolved external mapping. Resolve studio definitions by exact ref; unknown versions remain
unsupported rather than replaced by the latest version. Preserve backend declarations and old views.

**Done:** original/new copies have disjoint internal IDs and correct reused external IDs; no dangling
refs remain. Export/reimport preserves every studio setting plus old backend/annotation data. A
layout-only save neither adds studio metadata nor changes semantic revision/hash. Read-only legacy
projection needs no forced upgrade. Combined UX02 schema/edit/round-trip evidence is recorded.

**Not here:** rewriting historical factories or completing the paused Zammad model.

## UX03 — Finite catalog definitions and provider compatibility

**Read:** configuration matrix in full; current planning catalog, registry availability contracts
and CATALOG. Consume UX02 schemas; do not re-declare a competing set of field values.

**Deliver:** all 14 `studio-<kind>@1.0.0` definitions, exact field descriptors, provider identity/
compatibility metadata, role icons/colors and classification defaults. Provide base creation names
and named service presets. Include one small service+worker package preset for the generic fixture.

**Do:** keep definitions versioned and deterministic; their settings are design-only. Exclude empty
field groups, invalid provider/engine combinations and legacy business controls from the new
creation catalog. Keep old definitions loadable for old documents. Provide an explicit mapping
table for known legacy families; unknown families use a neutral display fallback.

**Done:** every matrix field belongs to one schema/descriptor, all definitions have appropriate
creation scopes, provider changes introduce no hidden graph nodes, and definition refs never count
as executable templates. Inspect a catalog preview and its serialized typed defaults. CATALOG
describes the new design vocabulary without upgrading availability.

**Not here:** provider API calls, cloud configuration wizards, logo scraping, runtime adapters.

## UX04a — C1/C2/C3 nodes, package scopes and navigation identities

**Read:** model §§3–5, interaction §§1/4; existing `architecture-view.ts`, container display,
`focused-views.ts` and layout pruning. Consume UX02/UX03 exact identities.

**Deliver:** pure studio node/scope projection with deterministic view keys, original semantic refs,
package summaries, C3 owner anchors, shared resource references and legacy projection. No input
mutation or view-authored duplicate element graph.

**Do:** render one C2 card for a package; keep real deployable members; show only useful children/
dependencies; omit unconfigurable library/adapter/business decomposition. Preserve meaningful
source requirements in Generate/export data. C3 queues refer to the same resources across scopes.
Model a browser served by an application without inventing a second Docker deployment.

**Done:** inspect projected IDs/counts for single service, package, shared data and legacy fixtures;
no empty scope, duplicate resource or false package runtime. Deleting/reloading prunes only dead
layout keys. Existing read-only diagrams still open. No queue box appears in C2 projection.

**Not here:** shell removal, label routing, automatic structural zoom or new custom-view concepts.

## UX04b — Relationship aggregation and queued communication provenance

**Read:** model §§4–5, interaction §5; current connection/binding display and component dependencies.

**Deliver:** C2 application/package aggregates and C3 scope relationships with complete semantic
member IDs. Derive queued producer→consumer summaries from explicit roles, retaining queue and both
connection refs. Prepare trunk grouping data; geometry/rendering comes later.

**Do:** distinguish different directions and mixed protocols. Keep internal package relations in its
C3, retain all branch identities, and avoid self-arrows for collapsed internal communication.
Do not synthesize a consumer for a producer-only queue or infer roles from labels. Legacy ambiguous
roles remain unresolved source. Repeated DB dependencies become one displayed group, not deletions.

**Done:** capture exact aggregate→member maps for fan-out, shared store, two protocols, reverse edge,
cycle, same-package queue and incomplete channel. Each source connection is either visible in its
proper scope or accounted for in an aggregate/explicit unresolved result; none silently vanishes.
Combined UX04 projection remains deterministic after reorder/rename/round-trip.

**Not here:** merging semantic connections or applying a trunk-wide configuration edit.

## UX05 — Reduced shell and depth navigation behind the temporary flag

**Read:** interaction §§1–2, UX01 action map; `ArchitectureWorkspace.tsx`, app shell/ViewTabs,
existing chat and inspector containers. Consume UX04 scopes.

**Deliver:** temporary `studio=next` opt-in route, shared slim shell, chat/inspector rails, breadcrumb,
click-inspect/double-click navigation and explicit action destinations. Compose existing app/store
primitives; do not fork the whole application. The normal default remains unchanged until UX15.

**Do:** remove the redundant second toolbar, Explorer, parent dropdown, top-left/top-right ellipses,
visible Review/Patterns/Data/Saved and Deployment controls from the new surface. Preserve all data.
Remember panel state/cameras per project. Keep the new surface usable for navigation and selection;
forms/creation are completed in later assigned units, not replaced by old report panels.

**Done:** mouse-only C1→C2→package/service C3→back works at both desktop sizes and restores cameras.
Chat starts open, collapses independently, and selection never forces a new diagram. There is no
map, structural zoom or empty detail navigation. Compare the action inventory; record transitional
incomplete new-surface controls accurately. No default rollout yet.

**Not here:** implementing the excluded editors under another menu.

## UX06a — Shared autosave controller and conflict handling

**Read:** interaction §3, `draw/store.ts` serialized chain/adopt/settle and existing draft patterns.

**Deliver:** target-keyed form draft controller with 500ms valid debounce, blur flush, change-path
tracking, project-aware completion and concise pending/failure state. Wire one representative service
form to prove the controller before building all forms.

**Do:** flush valid drafts on navigation, discard only invalid unsent drafts, preserve in-flight
saves, and keep failed intents retryable. Rebuild operations on the accepted revision without
overwriting changed fields. Handle a late old response after a newer edit/project switch correctly.
Use existing request serialization; do not create an unrelated second queue.

**Done:** direct browser/network evidence covers ordinary save, quick type-and-switch, two rapid
field edits, invalid leave, delayed response, network failure/retry and a real revision conflict in
owned disposable projects. Reload acknowledged values. No persistent Saved badge or modal discard
prompt. State what a browser unload cannot guarantee.

**Not here:** broad chat UI work, provider setup or silent automatic conflict overwrite.

## UX06b — One chronological history for design and architecture layout

**Read:** interaction §3, existing `Step`, semantic history and architecture layout history paths.

**Deliver:** architecture layout steps in the existing chronological undo/redo mechanism; visible
mouse buttons with correct enabled state. Pending valid form saves coordinate with history actions.

**Do:** one step per saved batch/move/Tidy/AI turn, none for camera/selection/pointer movement. Wait
for in-flight saves before undo; failed requests add no step. Prune dead targets safely and clear
redo on a new semantic/layout edit. Retire the new surface's separate layout undo path.

**Done:** perform edit→move→edit→Tidy then undo/redo each in order, checking values, coordinates,
semantic revisions and network requests. Repeat with a pending edit, failed edit and project switch.
Panning/zooming never consumes undo. Reload does not falsely promise persistent local layout history.
Combined UX06 behavior has evidence; do not change the server's old history contract unnecessarily.

## UX07a — Application, package and provider inspector

**Read:** configuration §§1–2/5, interaction §§3/4; current ComponentEditor/ContainerEditor/
CapabilityFields and new definitions. Consume UX06 controller.

**Deliver:** compact General/Options/Connections forms for service/browser/worker/Billing/Redirect/
Notifications/Identity and packages, including applicable provider/execution fields. Inspect C1 names/
purpose through the same controller. Show no empty tabs or raw support/backend reports.

**Do:** display only allowed fields; conditional switches remove newly inapplicable values atomically.
Provider choice remains a setting, not an automatically inserted adapter box. Package settings
stay on members. Data/Access/Behavior/Effects/hooks/settings business editors have no route from
this new inspector. Legacy safe fields preserve unrelated rich declarations.

**Done:** each application row/conditional branch of the matrix has a recorded save/reload example.
Billing is one C2 card; browser delivery is not mislabeled Docker; member languages are independent.
Inspect empty/single/multiple tab states and long names at both desktop sizes. Source hashes confirm
hidden backend data was not stripped.

**Not here:** configurable routes/entities/business logic or arbitrary JSON controls.

## UX07b — Resource and individual-connection inspector

**Read:** configuration §§3–4, model ownership rules, UX04 aggregate provenance.

**Deliver:** database/cache/queue/object storage/search/CDN/external API forms; compatible existing
resource selectors; individual relationship options and compact aggregate member selection.

**Do:** queue options appear at C3 and edit the one shared identity. Enforce engine/provider rules,
owner targets and optional numeric ranges. Store queue retention separately from business retention;
keep timeout/retry off the diagram. Select a trunk member before editing; no implicit multi-edit.
Unknown legacy relation settings produce no empty form or fabricated defaults.

**Done:** cover every resource field plus inapplicable tabs, invalid provider/range, clear value,
shared-queue edit from two scopes, mixed-protocol member chooser, timeout protocol change and retry
visibility. A provider switch has no external request or graph mutation. Reload/export values match.
Combined UX07 field coverage accounts for the entire allowlist.

## UX08a — Base palette, library and explicit package creation

**Read:** interaction §2, configuration §6; old `draw/Toolbar.tsx`, CapabilityCatalog,
ArchitectureLibrary/PatternComposer and the shared commands.

**Deliver:** floating scope-aware palette and unified Library categories. Base placement uses finite
defaults and a grid landing position; preset insertion uses a compact preview. Grouping selected
applications creates a package atomically. Keep current runtime-template availability accessible
without displaying all legacy planned families as new studio choices.

**Do:** hide queues at C2 and generic components everywhere. Package-scope additions join its members;
service-scope resources get explicit ownership. Use an existing resource by ID. No text/note/frame
tools, semantic drag-insertion or ad hoc family designer. New object gets selected after a successful
commit; failed/cancelled creation leaves no orphan position or partial graph.

**Done:** create each base type by mouse, insert a named service preset and the package fixture,
cancel creation, force one invalid batch, undo/reload, and verify no dead tool/button at any scope.
Creating a browser app never silently adds an API or database. There is one Library entry.

## UX08b — Connector, dependency shortcuts and membership actions

**Read:** interaction §2, model §6 and Redirect/CDN reference rules; consume UX07 forms/UX08 palette.

**Deliver:** click-source/click-target connection creation, explicit role/protocol form, dependency
shortcuts tied to real relationships, resource reuse, package member removal and Ungroup actions.

**Do:** validate compatibility before committing; let invalid drafts be corrected or dismissed.
Use one atomic batch for a referenced dependency and its setting. Shared ownership changes require
explicit reassignment; never delete other consumers' resources. Offer Delete members separately
from safe Ungroup, following the existing destructive-action convention.

**Done:** create HTTP, DB and queue publish/consume relationships; inspect/reload/undo each. Reject a
wrong queue direction, duplicate invalid binding and dangling target. Verify shared-resource reuse,
explicit disconnection, shortcut cleanup and ungroup preservation. A dragged card crossing an edge
still changes no semantics. Combined UX08 creation is fully mouse operable.

## UX09 — Compact symbols, selection and zoom-dependent text

**Read:** interaction §4; `ArchitectureGraph.tsx`, `type-style.tsx`, relationship labels and CSS.

**Deliver:** fixed-size role shapes/icons, capability colors, optional provider marks, solid box
outlines, strong selection and prescribed text thresholds. Remove repeated component labels, long
inline responsibility lists and full label panels on the new surface.

**Do:** preserve unrelated opacity, meaningful icon visibility and accessibility names. Use existing
assets/dependencies; unknown vendor falls back to a capability symbol. No remote logo fetch or
generation-support color masquerading as capability. Selection and zoom do not request layout.

**Done:** screenshots at 0.45, 0.75 and 1.15 zoom include long names, person, service/package,
Postgres/database, cache, queue and external provider. No dotted status boxes or empty explanatory
text. Capture stable node coordinates/geometry across zoom and no layout-worker invocation from
selection. Inspector still shows the full stored values.

## UX10 — Compact edge routing and shared trunks

**Read:** interaction §5, UX04b provenance; current layout label sizing/routing and ReactFlow edges.

**Deliver:** compact single-line label geometry and compatible shared trunks/branches with correct
direction, hit regions and member selection. Remove per-edge large label-card reservation from
the new projection path. Keep stable keys and provenance throughout.

**Do:** reserve actual compact label bounds, retain cycle/reverse paths, and distinguish crossings
from intentional branch junctions. If a label cannot fit, suppress that label only. Aggregate DB
connections per application/group. Trunks receive no invented semantic fields or bulk settings.

**Done:** inspect fan-out, fan-in, shared DB, opposite arrows, cycle and mixed protocols in the dense
fixture; match displayed paths back to exact semantic members. No edge disappears to achieve
compactness. Click branches/trunk at low and high zoom and confirm the correct target. Record before/
after canvas readability, not merely a smaller bounding rectangle.

## UX11a — Stable geometry during movement and asynchronous layout

**Read:** interaction §6, UX01 observations; `positionedArchitectureGeometry`, layout client/worker
and graph node-change handlers. Reuse cache/coalescing principles from automation-pitch.

**Deliver:** capture stable drag geometry, cheap incident-edge updates, no pointer-move worker calls,
stable unrelated paths and stale-result protection. Keep old valid geometry while a request runs.

**Do:** partition affected and unaffected routes; do not re-reserve every unrelated label on every
pointer tick. Scope/generation IDs guard results after switching, deleting or dragging again. A
failed/aborted layout keeps visible fallback routes; avoid clearing/remounting the graph.

**Done:** record a continuous dense-fixture drag and measure worker-request count (zero while
moving), unchanged unrelated node/path values and constant visible-edge identity set. Throttle a
worker response, change scope, then return; the stale result cannot replace newer geometry.
Cancel/failure leaves a usable graph. Report exact observations; no arbitrary FPS boast.

**Not here:** automatic semantic insertion, global repacking during drag or fade effects.

## UX11b — Grid landing preview, drop persistence and Tidy and fit

**Read:** interaction §6 and automation-pitch preview references; consume stable UX11a geometry and
UX06b history.

**Deliver:** whole-card drag threshold, nearest collision-free 24-unit landing preview, group move,
one settle on drop, reduced-motion handling and one Tidy and fit control.

**Do:** preserve unaffected node positions on normal drop, resolve grid collisions deterministically,
persist scope layout once settled, and ignore late obsolete results. Tidy clears current-scope
manual positions, arranges and fits as one undo step. Mouse pan/zoom stay available without extra
Fit/Focus/Arrange menus. Card movement never changes connections or package membership.

**Done:** drag single/multiple cards to occupied and empty regions; cancel, undo/redo and reload.
Compare semantic revision/hash before/after each layout action. Tidy at two scopes affects only
the chosen scope, has correct fit padding and restores through Undo. No unrelated fading or path
flicker. Combined UX11 recording demonstrates readability and stability at both desktop sizes.

## UX12 — Unified Generate review, activity and outputs

**Read:** interaction §7, model availability boundary; `GenerateDrawer.tsx`, generate/store,
`RunsView.tsx`, ViewTabs/App, current readiness/portable handoff routes.

**Deliver:** Generate as one destination with Review/Activity/conditional Outputs; integrate existing
generation and orchestration data through their real APIs. Preserve object/operation identities;
opening the destination has no execution side effects.

**Do:** show concise actionable review with exact details on demand, explicit C4b work and actual
support/verification. Revision/fingerprint changes stale the review. Deep links select the right
diagram scope without reopening removed editors. Flush relevant autosaves before snapshot/start.
Remove the duplicate generation drawer entry from the new studio.

**Done:** inspect empty history, existing progress/error/cancel/completed records, outputs and source
export; verify new unsupported studio starts are blocked server-side. Inspect an existing supported
legacy project's start controls and exact request payload. For execution-state UI simulation use
owned local records/interception and label it as simulated; do not claim a new runtime passed or
launch external agents/providers just to exercise a screen. Opening/returning changes no design.

## UX13 — Assistant vocabulary and truthful existing usage display

**Read:** new definitions/commands, current server chat context/tools and web ChatPanel; final scope
decisions. Do not begin a broader chat redesign.

**Deliver:** a studio editing profile with finite catalog/design summaries and shared studio command
tools. The new studio passes that profile to chat; legacy low-level tools remain for compatibility
outside it but are not advertised/invocable through this profile. Commands use the same validation,
revision and history paths as manual edits. Expose existing usage data only when available.

**Do:** prevent the studio tool profile from using raw setArchitecture/backend edits to bypass the
no-route/no-schema/no-business-editor boundary. Preserve old declarations when modifying allowed
fields. Keep project-specific requested behavior in goal context/explicit C4b obligations, not a
made-up configurable module or executable promise. Provider names cannot select runtime templates.

**Done:** exercise deterministic tool calls for an initial service graph, provider change, shared
queue, package, manual-then-chat edit and rejected business-schema edit. Inspect one history step
per accepted turn and conflict behavior with an inspector draft. No live paid model call is needed
for this tool contract check. Missing usage is omitted; available counters have correct units.
Record remaining conversation-quality evaluation as later work, not a fabricated result.

## UX14a — Fresh Mattermost, Enterprise and Streamly studies

**Read:** coverage procedure and E01–E03 source goals/factories. Consume the complete studio surface.

**Deliver:** three separately versioned studio example factories/goal manifests, Library entries and
portable source/C4b maps, using finite definitions. Original factories remain byte-identical.

**Do:** preserve meaningful documented deployment boundaries, browser execution and external
providers; simplify unconfigurable internals. Streamly exercises CDN choice, storage, queued
processing and real independent services without inventing video/business configuration forms.
Mattermost is a fidelity check against automatically splitting every internal responsibility.

**Done:** record source hashes, per-row requirement mappings, C1/C2/C3 inspection, representative
configuration/reload/export and current unsupported runtime status. No fake Kubernetes editor,
old focused-view menu or new service solely to wrap a library. Register only these completed studies.

## UX14b — Fresh QRWTY target, Links, Community and Social studies

**Read:** coverage E04–E07 and their source briefs. Apply the same reconstruction procedure.

**Deliver:** four studio examples with fresh layouts and requirement/C4b maps. QRWTY has one
Billing C2 card, clear Redirect, recognizable data/cache and C3 queue/worker relationships.

**Do:** use base services for project responsibilities while leaving business behavior custom.
Keep the smaller Links reference useful without copying QRWTY's entire requirements. Do not
repair the live application or create an elaborate QRWTY-only configuration taxonomy.

**Done:** the four sources/exports remain traceable, their useful detail scopes work, repeated
API/DB labels are gone, branching remains selectable, and their unknown/template/custom status is
honest. Record evidence across the examples, not only QRWTY. Original source designs stay intact.

## UX14c — Backend benchmark foundations without resuming the backend batch

**Read:** E08–E10, frozen benchmark ledgers, prior P71/P72 design evidence and P73a checkpoint handoff.

**Deliver:** distinct studio foundation/reference examples for Discourse, Vendure and Zammad with
source/obligation maps. These are high-level studio examples, not replacement benchmark inputs.

**Do:** map every fixed ledger obligation to preserved source and future C4a/C4b work. Do not change
ledger rows, expected observations, implementation support descriptors or zero/absent runtime
status. Zammad's new small reference must say the detailed P73a/P73b work is still incomplete.

**Done:** before/after hashes for frozen inputs and old factories match, source maps account for
all obligations, and Generate does not convert the new tidy diagrams into completed implementations.
Inspect each new example's actual configurable foundation and portable export. Stop at UX design
coverage; do not complete any old contracts, hooks or partial backend code opportunistically.

## UX14d — Dropshipping and remaining documented field-study goals

**Read:** E11–E14, particularly the actual dropshipping GOAL/build plan/handoff and the source
qualification in the final decisions.

**Deliver:** separate studio references for original QRWTY goal, dropshipping, inventory and grocery,
each with an explicit coverage limit and source manifest. Use only public/synthetic demo data.

**Do:** represent dropshipping's actual single Worker boundary, bundled browser/admin assets, D1,
R2 and hosted payments; keep order/vendor/workflow/compliance logic as future custom work. Do not
invent customer accounts or equate Cloudflare Workflows to a queue. Model external device/recognition
boundaries for the incomplete concepts and retain their unresolved product questions.

**Done:** the four maps have no silently invented device, vendor API access or full-product claims.
Configurable software foundations can be assembled and exported; incomplete source goals are
explicitly limited. No sibling repo or live QRWTY project changed. Combined UX14 accounts for all
14 coverage rows and does not claim any newly generated application passed its runtime tests.

## UX15 — Combined review, default rollout and documentation

**Read:** every contract's acceptance, all prior UX evidence/handoffs and the UX01 action inventory.

**Deliver:** combined acceptance record, new studio as default, temporary flag removal and current
user/agent/catalog documentation. Keep historical review/evidence and original source bytes.

**Do:** complete one real end-to-end design session in an owned disposable project: create services,
choose providers, connect, add a shared C3 queue, group services, change configuration, move/Tidy,
undo/redo, reload, review and export. Exercise error paths already required by the relevant units
only where integration changed them; do not rerun unrelated old suites. Compare legacy hashes and
availability, and ensure removed surfaces have not returned through another menu.

**Done:** all 25 units have complete evidence; every field/visibility condition and all 14 source
rows are accounted for; dense drag has stable paths; both desktop sizes work by mouse; no empty
tabs/large reports/status borders/unrelated fading; no silent save failures or semantic layout
edits; Generate is unified and honest. Normal navigation contains no feature flag, old Explorer,
focused views, deep business editors or duplicate Generate drawer. Preserve pending paused work.

Update README, CATALOG, modeling/studio guides and the visual-improvement index to distinguish the
now-implemented UX from still-future C4a runtime work. Append handoff and commit `UX15: ...`.
Report the later runtime field-test questions without starting that work. If any completion gate is
unmet, leave this milestone incomplete with precise evidence; do not declare success on screenshots
alone or ask the owner to accept an undisclosed partial rollout.
