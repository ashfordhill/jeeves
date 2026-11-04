# UX05 action comparison

Compared with the [complete UX01 inventory](../UX01/action-inventory.md) and interaction contract
§§1–2. This unit supplies navigation and selection only; later units retain their assignments.

| Action family | Actual UX05 destination/state in `studio=next` |
| --- | --- |
| Design / Runs / Settings | Same application views and hash routes. Runs is labeled Generate in the opt-in shell. It currently contains existing Runs content; UX12 owns unified Review/Activity/Outputs and supported generation. Opening it executes nothing. |
| Project open/recent/browser/search/rename/delete/target/new/recipe | Existing shared project selector and dialogs in the same header, preserving their restrictions. New finite creation/Library flow remains UX08; legacy project lifecycle is transitional. |
| C1/C2/C3, parent selector, child lists | Header C1/C2; C3 only for a selected node with a real UX04 drill key. Double-click drills; breadcrumb/back returns. No flat parent selector, child rows, or empty C3. |
| Card inspect / relationship inspect | Click selects in the current scope. Configurable nodes show name/purpose and package count in the right rail. Relationships show action/protocol; aggregates offer exact members. Read-only summaries precede UX06/UX07 fields. Unknown objects and source-only legacy relations highlight without an empty inspector. |
| Open/collapse chat and inspector | Independent header toggles and rail close buttons. Mouse resize separators; 300/320px fresh widths. Width/collapse preferences and scope cameras are per-project local UI data. |
| Select / Hand / pan / wheel | Working floating two-tool toolbar. Neither zoom nor selection changes depth. No map/minimap, structural zoom or extra diagram list. |
| Undo / Redo / separate layout undo | One shared semantic Undo/Redo pair in the slim header. No separate layout pair. UX06b owns chronological architecture layout integration; no new graph layout edits exist in UX05. |
| Editor actions; diagram options; top corner ellipses | No entry in the new surface. No substitute menu wrapping the old editor. |
| Explorer / Find / focused views | Absent. Exact existing data remains preserved. |
| Review / Findings / Data & objectives / evidence / handoff / API reports | Removed from Design. Their accepted Generate/source/export destination remains UX12; no report panels are placed in this inspector. Existing default still retains them until rollout. |
| Patterns / Library / Add / Connection / resource reuse / package lifecycle / delete | Accepted finite toolbar, Library and inspector destinations remain UX07/UX08. No placeholder/disabled creation actions or old generic editor is inserted here. |
| Deployment / scenario editing/playback / type legend | Absent from the new surface. Historical declarations remain intact for later Generate/source inspection. |
| Business/route/schema/policy/effect/hook editors | Absent. No renamed tab/menu restores them. |
| Freeform/text/note/frame/attachment palette | Absent from the new surface; old source survives. |
| Fit / Focus / Arrange / direction/nudge menus / Tidy | Old menus and fit controls are absent. The final Tidy and fit action belongs to UX11; this unit uses an initial bounded fit plus hand/wheel. |
| Saved / support badges / implementation lists | No persistent success badge, readiness chrome, child lists or status borders. Relevant existing errors remain dismissible. |
| Chat controls, Settings and theme | Shared existing components. No model/provider call was executed. UX13 owns finite studio tools/profile and real usage display. |

The graph is a navigation scaffold with deterministic grid placement and ordinary React Flow
edges; UX09–UX11 own final card density, relationship/trunk geometry and drag/Tidy. It consumes
the actual projected edges/members, never copies a separate semantic graph. No new runtime,
template or application generation is provided. The default remains unchanged through UX14.
