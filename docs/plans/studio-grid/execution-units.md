# Studio grid execution units

Read the [parent plan](../../build-plan-studio-grid.md) first. Ten sequential units, SG01–SG10.
Proposed 2026-11-04; none is started. Execute only the unit the owner assigns, one at a time,
on primary `main`, then append `docs/handoff.md` and commit as `SGnn: <change>`.

```text
SG01 → SG02 → SG03 → SG04 → SG05 → SG06 → SG07 → SG08 → SG09 → SG10
```

Every unit: lint, typecheck, web build, browser inspection at both desktop sizes, evidence under
`docs/evidence/studio-grid/<unit>/`. Tests stay deferred. Do not touch code generation or runtime.

## SG01 — Baseline and reference capture

Screenshot the current C1/C2/C3 of Mattermost and Streamly at both sizes. Record the
automation-illustrator ELK options, grid constants and spawn/dock helpers you will adapt
(`src/board/layout/elkGraph.ts`, `tileMetrics.ts`, `store.ts` `spawnBranch`). No product change.

## SG02 — Component catalog and service performance settings (spec only)

In `packages/spec`: add the C3 component kinds and settings of plan §5 as strict Zod unions, a
binding that places each component inside exactly one application element, and validation
(component host must be an application; connections from a component trace to a C2 connection or
resource). Add service-level and resource performance settings. Keep studio version compatibility:
old documents read unchanged. Add the operations to create, configure, connect and remove a
component. Model-only: prove with one-off round-trip observations.

## SG03 — Blueprint API

Add the `blueprint: 1` schema and its JSON Schema export in `packages/spec`, a pure
`designBlueprint(design)` function, and `GET /projects/:id/blueprint` on the server. Document it in
`docs/` as the code-generation boundary. No generator.

## SG04 — TinyURL study, remove the old studies

Build the TinyURL study of plan §7 with its components. Make it the fresh-install default and the
only study in the chooser. Remove the fourteen studies, their goal/layout JSON, and registry and
library references. Leave existing database projects untouched. Apply decision D2.

## SG05 — C1/C2/C3 tabs and whole-system C3 projection

Replace the per-service detail scopes with one C3 projection: every application as a frame
containing its components, queues, and resources/externals around them. Show packages as open
group frames at C2. Add the C3 tab, remove double-click drill, breadcrumb and back. Keep
selection by identity across tabs.

## SG06 — Automatic ELK grid layout

Replace `studio/layout.ts` arrangement and the custom router with ELK layered in the existing
worker, using plan §4 options and compound nodes at C3. Snap results to the 32px grid. Pack islands.
Remove Tidy, free drag, landing search and saved positions. Keep optional row-order hints, changed
by dragging a box within its column, as one undoable layout action.

## SG07 — Merged lines and short labels

One line per ordered box pair; count label; click opens the existing member chooser. Stroke 2px,
3px selected. Derive the short label (verb plus protocol, about 24 characters). Feed label sizes
to ELK so labels never overlap boxes.

## SG08 — Handle drag-to-create and islands

Port automation-illustrator's `+` handle spawn: drag out, pick a kind valid for the level, create
box plus connection in one undoable batch, open the connection form. Drop on an existing box to
connect. Add New island and the empty-canvas first box. Remove placement tools and click-to-place.

## SG09 — Component and performance inspector

Inspector forms for every component and new service/resource setting from SG02, using the
existing compact autosave pattern. Add components to a service from its C3 frame `+` handle.
Show the custom component's stub purpose field.

## SG10 — Acceptance and documentation

Compare SG01 baseline with the final TinyURL C1/C2/C3. Update the studio guide, C4 modeling
guidance, CATALOG, README and AGENTS to describe the shipped behaviour. Record known limits.
