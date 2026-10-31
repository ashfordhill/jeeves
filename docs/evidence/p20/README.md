# P20 architecture and configuration evidence

The Architecture workspace reads the same semantic design as the editable board. New QR Studio projects receive explicit people/system context. Existing projects, the live qrwty design and the immutable P19 recipe snapshot are not rewritten.

- [Context, 1440 × 900](context.png): actual product roles, explicit redirect/browser direction, bounded wrapped labels, full relationship inspector and mouse drill-down.
- [API components, 1440 × 900](components.png): one application boundary; accounts, resources and domain modules; external connected containers retain the same provision labels as the container view. Connection routes reference existing capability/storage wiring. The diagram does not infer internal calls from extension notes.
- [Product configuration](configuration.png): finite title/tagline/date-range fields, visible stable-origin constraint, explicit Save/Cancel and no live deployment action. Compound dialog markup supplies a stable accessible name and avoids a duplicate banner landmark.
- [Narrow context, 1000 × 850](narrow.png): a two-column layout contains every context card, retains readable controls and has no page overflow. Larger component scopes can be panned/zoomed or focused using the object selector and **Focus selected object**. No touch/mobile-editor certification is claimed.

[Read-only reference observations](reference-observations.md) compare the actual Excalidraw app, automation-pitch's built-in example and its complete VISUAL_IMPROVEMENTS history. Reference screenshots are included separately. The main lessons applied here are explicit starting actions, quiet stable controls, consistent selection/inspector hierarchy, bounded label wrapping and a responsive context arrangement. Diagram data was not uploaded to Excalidraw; automation-pitch has no tracked changes.

Validation:

- `pnpm work run browser apps/web/e2e/architecture.spec.ts`: two strict Chromium journeys passed. Final log/result `.jeeves-work/runs/2026-10-31T06-15-39-948Z-browser-920c9c55.*`, 8.3 seconds including the runner. Coverage includes context editing, container/component drill-down, object focus, product cancel/save/one-step undo, reload, exact preservation of board layout/camera and semantic state during navigation, visible unbound intent, complete narrow-card containment and axe. Application console errors, broken assets and unexpected HTTP errors remain failures.
- Focused offline architecture/recipe/API tests cover old serialization, structural references, removal/unbinding, real connection bindings, consistent provision across scopes, unknown template versions, extra project notes, an inventory resource consumer, semantic undo and unchanged generated runtime/artifact bytes for architecture-only edits.
- The required check gate passes lint, all types and 589 tests across 82 files. Exact final gate log is recorded in the P20 handoff. No qrwty runtime or archived recipe file changed, so the complete disposable QR product suite was not repeated.

Early browser failures were actionable: the convenience modal lost its accessible dialog label after reopening, then the new modal check exposed its duplicate banner landmark. Both were fixed in UI code. Screenshot review caught clipped narrow context cards; responsive layout plus containment assertions now cover that state. Early lint caught an untyped optional provision variable; the explicit shared type fixes it.

Limits: derived positions are not custom per-view saved layouts; diagrams do not discover arbitrary runtime call graphs or prove current production behavior. Template/recipe labels mean provided implementation, with explicit acceptance references and a reminder to verify the generated revision. Behavior/screen views, deployment topology, scale profiles and broad reliability certification remain separate work. No paid model run, source import from upstream projects or public deployment.
