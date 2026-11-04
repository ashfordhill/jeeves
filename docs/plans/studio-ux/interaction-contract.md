# Studio interaction contract

Part of the [build plan](../../build-plan-studio-ux.md). Constants below are explicit initial
implementation choices, not individually elicited aesthetic preferences. Change them only with
recorded evidence within the same interaction, or an owner decision when behavior would change.

## 1. Shell, navigation and action destinations

Use the current application shell. Rename Runs to **Generate** and make it the one destination for
review/execution/output. The studio has one slim header with project selection, C1/C2/current C3
navigation, undo/redo and panel toggles. Use a short breadcrumb/back action for C3. C3 is available
only for the selected expandable scope; there is no flat dropdown listing every parent.

Chat is a left rail, open by default in a fresh session. The inspector is the right rail and opens
when a configurable object is selected. Both collapse independently; keep width/collapse state per
project in local UI preferences. Fresh-project defaults are chat open, inspector closed until
selection. Use initial widths 300px and 320px, independently scrollable contents, a center canvas
with `min-width: 0`, and no automatic mobile-style drawer conversion at the accepted desktop sizes.

Do not add a second left map, Explorer, minimap, focused-view selector or independent-diagram list.
One project contains one architecture; C1/C2/C3 are views into it. Changing zoom never changes
scope. Breadcrumb/back restores that scope's saved camera. Double-clicking a non-expandable card
does nothing beyond normal selection. C1's system opens C2; other C1 objects do not acquire invented
children. No route leads from C3 into a code editor.

| Existing surface/action | Destination after cleanup |
| --- | --- |
| Add container/component, Connect | Scope-aware floating toolbar and contextual creation forms. |
| Library, Patterns, saved architectures | One Library entry; compatible presets and reusable compositions inside it. No separate top-level Patterns action. |
| Edit context | Click system/person/external C1 object; compact inspector. |
| C2 child responsibility lists, flat parent selector | Removed; explicit double-click and breadcrumb. |
| Review, findings, Data & objectives reports, implementation/support reports | Relevant read-only readiness/source details in Generate; excluded deep editors are not relocated as hidden normal editing tabs. |
| Deployment, Kubernetes/Helm controls | Removed from the normal studio; stored declarations preserved in source export. Execution intent is the small application setting. |
| Scenarios and scenario playback controls | No extra studio toolbar/view; retain existing data and inspectable source/obligations in Generate. No new scenario editor in this scope. |
| Editor actions/freeform board, text, note, frame | Removed from normal navigation/palette; old data remains exportable. |
| Fit, Focus selection, Auto-arrange, flow-direction/nudge menus | One visible **Tidy and fit**. Mouse wheel/pan remain. No arrangement ellipsis menu. |
| Separate architecture layout undo | One chronological undo/redo pair with semantic edits. |
| Saved indicator | No persistent success chrome. Pending/error feedback only as needed. |
| Generate drawer + Runs | One Generate view; all existing reachable generation/run data retained. |

Inventory every actual menu item in UX01. If an essential action lacks a destination in this table,
record the exact action and resolve its placement against the accepted scope; do not quietly retain
the entire old menu or delete the action without accounting for it.

## 2. Toolbar and creation

Reuse the older toolbar's visual pattern and relevant interaction primitives, not its unsupported
annotation tools or freeform model. Every action works with a mouse. Icon tools have accessible
names/tooltips; the visible labels remain concise. No keyboard-only delete/connect/undo.

| Scope | Creation tools |
| --- | --- |
| C1 | Person, External system, Connection, Library; system is already present. |
| C2 | Microservice, Browser app, Database, Cache, External API, Connection, Library. Worker and named service/resource/integration presets are in Library. |
| Package C3 | Microservice, Database, Cache, Queue, Connection, Library. A new application joins the active package atomically. |
| Service C3 | Database, Cache, Queue, Connection, Library. Library can select an existing dependency/service; independent new services are created at C2 or package scope. |

Select and Hand are always present. Queue is never offered at C2. There is no generic “Component”
tool, arbitrary shape/text tool or unconstrained new family editor. Package creation is a Library
preset or explicit grouping of two or more selected application cards; it is not another runtime.

For a base tool, click the canvas to place a new object at the nearest valid grid position. Use a
clear default name (Microservice, Microservice 2, etc.), the finite definition defaults and one
atomic semantic action; select the result and open its inspector. Escape/right-click cancels the
tool if supported, and a visible Select tool provides the mouse-only exit. Failed creation leaves
no ghost semantic object or layout record. Library insertion has a compact preview and **Add**
action; closing an uncommitted preview silently discards it. Do not require a permanent Save button
for existing-object edits. Creation confirmation is distinct from an edit autosave.

Connector: select the tool → click source → click compatible target → small form showing Action,
Protocol and applicable interaction/access → **Connect**. Selecting an invalid endpoint explains
the incompatibility in one concise line and leaves the draft available for correction/cancellation.
Closing it discards it silently. Blank-canvas click does not create a dangling persisted edge.
The helper sets queue role/direction explicitly. Dragging a card over an edge never inserts it.

Reuse resources through an explicit existing-resource picker. It shows name, kind and owner only
where needed to distinguish duplicates. Never reuse by a matching name alone. A package/member
change is a deliberate inspector action; movement never changes ownership or membership.

Ungrouping a package with package-owned resources presents compact owner selectors for those
resources before committing. Queues need an actual replacement service/package owner; optional
owners on other resources can be cleared explicitly. Do not guess the first member as owner or
leave a dangling reference. With no such ownership changes, Ungroup needs no extra configuration.

## 3. Inspector autosave and chronological undo

Implement one reusable draft controller integrated with `draw/store.ts`'s serialized mutation
chain. Do not make each editor invent its own save queue. Draft identity is project ID + semantic
target + definition/version. Drafts hold a baseline, changed field paths and local values.

1. Typing updates the local form immediately. Validate the complete pending object. Debounce a
   valid changed draft for **500ms**; blur commits sooner. Select/toggle changes commit after the
   current event completes, coalescing dependent fields into one atomic edit.
2. Before selection/scope/project navigation, undo/redo, deletion or starting an AI edit, flush a
   valid pending edit into the shared queue. Navigation may render its destination while that save
   finishes. It must not cancel a started valid save or attach it to the newly selected object.
3. An incomplete/invalid unsent draft is discarded silently when leaving that object. While editing,
   show only the relevant field error. Do not save half a dependent edit or show a discard modal.
4. Enqueued edits carry changed paths and expected baseline values. Rebuild their operation batch
   against the latest accepted revision, preserving unrelated fields. If a changed field was changed
   by another edit since the baseline, do not replay it blindly. A server conflict adopts the fresh
   document and produces a concise “Changed elsewhere; reopen to edit” indication.
5. A transport/server failure is not an abandoned invalid draft. Keep the failed intent available
   for Retry or Discard in a small error notice. Retry compares its baseline again; it cannot
   overwrite another change. Never mark a rejected request saved, loop retries or show a modal wall.
6. Completion callbacks are target/project/revision aware. A late response cannot overwrite a
   newer accepted state, show errors on a different object or restore the previous selection.
   Keep per-project pending state when switching projects. Do not cancel writes on unmount.
7. Reload verification happens after acknowledged saves. Before a deliberate in-app reload/export/
   Generate action, await the valid queue. A browser unload can only attempt to flush; do not claim
   guaranteed persistence if the browser terminates an unacknowledged request. No unsaved-draft
   confirmation dialog is required by this plan.

Keep success quiet. Show a small pending indicator only if a save remains pending for 800ms;
remove it when acknowledged. Errors remain actionable until dismissed/resolved. Do not add a
permanent Saved badge or a success toast for each field.

Extend the existing chronological history to include architecture layout steps (`scope`, before,
after). Each committed inspector batch, card move, group move, Tidy or AI turn is one step. Pointer
moves, selection, pan/zoom, debounce resets and no-op saves create none. Undo first flushes pending
valid input, then undoes the most recent completed action in order. Undo of an in-flight save waits
for its result. Failed saves create no history entry. A new semantic/layout edit clears its redo
branch; camera changes do not. Reload may reset local layout history as today; do not invent durable
cross-session layout history in this scope. No separate hidden layout-undo stack remains in the UI.

## 4. Card appearance, selection and text density

Use solid outlines on boxes regardless of planned/implemented state. Readiness is in Generate.
Preserve the rest of the diagram's colors and opacity when selecting. Selection adds a clear
3px outline/halo and appropriate edge emphasis; it does not dim unrelated objects. Hover is weaker
than selection. Do not introduce constant pulsing, glowing or animated backgrounds.

Use capability shapes/icons plus optional provider mark: person figure, service/browser symbol,
database cylinder, distinct cache stack, queue/channel and external integration symbol. A role icon
must remain visible even when the repeated kind caption is removed. Never repeat “Component” on
every card. A package uses a small stack/group mark so it is not mistaken for one runtime.

Initial fixed world sizes: applications/packages 216×96, resources 168×96, people 144×96. Reserve
text regions within these boxes; zoom never changes their geometry or triggers layout. Support long
names with at most two lines and ellipsis, full accessible name/hover text, no box-width explosion.

| Camera zoom | Card content | Relationship content |
| --- | --- | --- |
| Below 0.55 | Name and icon only | Arrow/line only; no label or label hit-target plate. |
| 0.55–1.09 | Name and icon only | One short action, at most 36 visible characters. |
| 1.10 and above | Name/icon; optional one-line purpose and concise language/provider only if actual values exist and fit | Short action plus protocol when useful, at most 56 visible characters total. |

Text thresholds are presentation only. No unknown placeholders, missing-config prose, numbered
scenario overlays, child lists or repeated class captions appear inside cards. Long purpose/details
remain in the inspector. Source values are never truncated in storage. Respect reduced motion.

## 5. Connections and shared geometry

Use short inline labels with a small legibility halo if needed, not large rectangular label buttons.
No blanket reservation of the current 160px-wide, multi-line label panels. Reserve space for the
actual bounded high-detail label when arranging; zoom does not trigger a new route/layout.

Bundle per the model contract before routing. Compatible fan-out paths share a trunk then branch;
each actual branch retains its arrowhead and selection provenance. Store/read labels appear once
per visible application/group relationship. Do not erase arrows to save space, merge opposite
directions, claim mixed protocols share one setting or create a “special DB behavior” layer.

Trunks are not semantic objects. Clicking a single-member path opens its eligible settings.
Clicking a multi-member trunk/aggregate opens a short member chooser in the right inspector;
choosing a member selects/edits that relationship. No bulk edits. A non-configurable legacy
relationship only highlights; no empty inspector or huge interface dump. Use a 12px transparent
hit stroke for mouse selection. Edge crossing without a branch is not a junction; routes/markers
must distinguish those cases without new user controls.

Keep routing deterministic by ID and graph topology. Cycle/feedback paths use stable outside lanes,
not disappearing edges or semantic suppression. Labels must not collide with cards. When a dense
spot cannot fit a label, omit that visual label and retain the selectable line plus inspector text;
never omit the underlying edge or insert a giant floating panel.

## 6. Layout and drag behavior

Borrow automation-pitch's preview/settle behavior, not its workflow DAG insertion semantics.
Relevant references: [drag preview](../../../../automation-pitch/.docs/improve-10-drag-preview.plan.md),
[insert preview](../../../../automation-pitch/.docs/improve-04-insert-preview.plan.md),
[layout engine](../../../../automation-pitch/src/board/layout/layoutEngine.ts),
[layout animation](../../../../automation-pitch/src/board/layout/useAnimatedLayout.ts).

Fresh scopes use deterministic left-to-right automatic layout with initial 48px node/layer gaps,
orthogonal routing, real compact label bounds and a **24-world-unit** grid. Snap arranged positions
to grid and resolve any resulting collision deterministically. Readability outranks compactness,
which outranks fewer crossings. Do not force all cards into a screen-sized rectangle.

Drag begins after 5 screen pixels of movement. The whole card surface is draggable except actual
controls; a special tiny grip is not required. Click remains inspect; double-click remains drill.
For multi-selection, preserve relative offsets and treat the selected cards as a moving group.

On pointer down, capture the stable node positions, routes, labels and active layout generation.
During movement, move only the dragged selection/preview. Find the nearest non-overlapping grid
landing position using deterministic distance order and an ID tie-breaker, with 16px obstacle
clearance. Search outward as needed; do not reject a valid move just because the current viewport
is full. Show a thin landing outline; keep the main diagram at full opacity. No topology mutation.

**No ELK/worker request on pointer move.** Keep every unrelated edge/path and node position at
its captured geometry. Redraw incident paths cheaply to the moving anchor; defer expensive label
collision/routing decisions. Do not clear the edge array, replace keys, remount ReactFlow or wait
for a worker before showing existing paths. Selection/zoom must not invalidate topology layout.

On drop, commit one layout step at the preview position, then settle incident routing/labels once.
Do not globally repack unaffected nodes after an ordinary move. Coalesce duplicate layout requests
by scope + semantic topology + sizing version. Ignore stale worker results after a newer drop,
scope switch or delete. Abort computation only; never erase the last valid graph while awaiting it.
If routing fails, keep the last valid node positions and visible fallback incident paths with a
concise error; Tidy can retry. Persist the settled layout and restore it on reload.

Animate modest final path/node changes over 180ms when motion is allowed. Snap very large changes
and reduced-motion sessions. Do not fade nodes or edges during transitions. A cancelled drag
restores the snapshot with no semantic revision, layout write or undo entry.

**Tidy and fit** clears manual positions for the current scope, computes one fresh deterministic
layout, then fits its bounds with 48px padding and maximum zoom 1.0. It changes neither other scopes
nor semantics. It is one undoable layout step, including its camera. A manual wheel/pan camera
save alone is not an undo step. There is no second Fit/Arrange/Focus menu.

## 7. Generate and available usage

Generate is a project-scoped destination with compact **Review**, **Activity** and **Outputs** tabs;
omit Outputs when none exist. Opening it performs no write/generation/provider call. Flush relevant
pending valid edits before creating a review snapshot or starting an existing supported generation.

Review distinguishes structurally invalid design, unresolved choices, available implementations,
C4b obligations and actual verification evidence. Start with the actionable short list; reveal
exact source/contract details on request. A C4b extension is an expected boundary, not automatically
an architectural error; it still must not be mislabeled implemented. Existing benchmark requirements
and compiler blockers retain their force. Bind review data to the design revision/fingerprint;
edits make prior review stale, never silently “still approved.”

Activity combines the existing generation progress/logs and orchestration run history without
conflating their IDs/statuses. Preserve start/cancel/log/output flows and any existing restrictions.
Outputs links to existing artifacts and portable design/handoff export. Do not emit application
code or a new fake success artifact for a studio-only definition. The server-side support gate
is required even when the UI disables Start. Existing supported legacy designs remain runnable.

No provider setup wizard, cloud credential collection, giant source report in the normal inspector
or hidden automatic start on tab navigation. Deep-linking a relevant review item back to a card
selects that card and restores the correct scope; it does not open the removed backend editors.

Chat remains open by default and uses the same operations. Show existing tokens/cost/context data
only where actually returned, with accurate units and known pricing. Omit unavailable numbers
rather than showing zero or inventing an estimate. This is a small existing-data display, not a
new observability/billing/chat redesign.
