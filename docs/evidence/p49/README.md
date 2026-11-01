# P49 — Focused views and stable layout

Named C2 views select responsibilities or a flow from the same architecture, optionally adding
one hop of immediate dependencies. The whole-system board stays editable. Focused diagrams
retain the system boundary and actor/external-system meanings; their hidden-relationship count
opens a list with mouse navigation back to the actual whole-system relationship. Filtering is
presentation, never a change to dependency semantics or runtime wiring.

View name, membership/filter, positions, direction and camera live in optional `layout.architecture`
entries, keyed by stable view and projection identities. Existing layout documents round-trip
without migration. Board positions/camera remain separate. C1 and each container's C3 scope use
the same persistence; technical-component visibility does not delete hidden positions.
Renames and ordinary configuration edits retain positions. Pruning removes deleted architecture
identities and retains board placements whose semantic requests may still be pending.

New/Edit view uses Save/Cancel. Mouse drag handles and four nudge actions rearrange cards;
Fit selected supports boxes or relationship endpoints; Reset layout restores deterministic worker
layout and fits it. Undo/Redo layout is available from Diagram options and Editor actions, with
its own local history. Semantic edits never enter that history. Layout history is session-local;
view definitions, geometry and cameras survive reload. The existing board's history is retained.

Default QRWTY management and analytics views select compact flows; public redirect includes its
immediate dependencies. All omitted dependencies remain counted and linked. Contract-bearing
labels show a concise count; selecting a relationship expands exact contract names and versions
at a readable screen size, alongside the existing policy inspector. Declarations remain intent.

## Inspected captures

Actual production Chromium views at **1440 × 900 light** and **390 × 844 dark**. The 16-container
browser fixture extends the separate 14-container target study with two independent stores;
it does not change the example's topology or any live design. Narrow fitted diagrams are
overviews; the selection inspector and fixed dialog actions provide readable mouse editing.

- [Management flow](p49-management-light.png)
- [Selected redirect relationship at readable scale](p49-redirect-light.png)
- [Analytics flow](p49-analytics-light.png)
- [Exact contract summary on selection](p49-contract-light.png)
- [Narrow dark view editor with fixed Save/Cancel](p49-view-dark.png)
- [Narrow dark analytics overview](p49-analytics-dark.png)
- [Narrow dark relationship inspection](p49-selection-dark.png)

## Verification and limits

Focused spec/store/geometry tests cover legacy layout compatibility, one-hop filtering, complete
hidden relationship accounting, rename/configuration continuity, removed identities, pending
board placements, independent layout history, saved geometry and label clearance after moves.
Existing generator compatibility checks retain executable output and ownership. No golden
refresh, new runtime, generator behavior, dependencies, deployment or live QRWTY changes.

Production browser journeys cover the 16-container target, mouse creation/cancel, drag/nudge,
layout undo/redo, reset, scope navigation, C2/C3 cameras and reload; exact contract selection,
worker failure/retry, existing Draw drag/drop and architecture Save/Cancel/conflicts are exercised.
Strict diagnostics, axe and narrow overflow checks remain enabled. Manual moves retain directed
orthogonal routes and reserve label space; Reset returns the deterministic worker arrangement.
The proof covers these representative views, not arbitrary manually overlapping cards.

Exact commands, final counts, timings and fingerprinted run IDs are in [the handoff](../../handoff.md).
P50 contract-aware pattern composition is next, only when requested.
