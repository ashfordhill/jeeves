# P30 · deterministic C4 layout

These are actual disposable starter/QR recipe views from the built Jeeves web app, served locally through Vite preview against the isolated test API. No live application was regenerated and no implementation model was used.

- [Starter containers](containers.png): real person, frontend, API and database; relationship labels have reserved space and correct endpoint direction.
- [QR API components](components.png): independent responsibilities are packed inside their actual application boundary. Only the two existing container dependencies are drawn. The initial component zoom prioritizes readability; outer peers may require pan or Fit View. Focus selects one object at full scale.
- [Narrow view](narrow.png) and [dark view](dark.png): whole-diagram overview with mouse controls and full inspector text. Fitting a long graph necessarily reduces text size; this is not a claim that arbitrarily large diagrams are legible at once.

The second browser journey deliberately makes Worker construction unavailable until Retry, then renders the actual QR graph with the real worker. This controlled negative setup produces no HTTP failure or suppressed browser diagnostic. Normal worker loads, assets, console errors, native error events and uncaught exceptions retain strict checks. Card-button pointer events and selected-tab dark contrast were corrected after browser review.

## Implementation and provenance

Pinned `elkjs@0.12.0` (published 2026-07-17; 0.12.1 was only three days old at review) is already used by Jeeves's server and is within automation-pitch's declared `^0.12.0` range. Reviewed automation-pitch's `elkClient.ts`, `elkGraph.ts`, `labelBox.ts` and layout separation; no application source was copied. Original Jeeves adapter code sorts IDs, supplies a fixed seed, bounded label boxes, orthogonal directed edges and real compound membership. Independent nodes use an invisible packing group with no invented edges or semantic objects. The model-order strategy option failed on sparse compound graphs in this exact ELK release; it is intentionally absent and a regression fixture covers that shape.

ELK's [layered algorithm](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html) supports orthogonal, compound graphs. Its [coordinate documentation](https://eclipse.dev/elk/documentation/tooldevelopers/graphdatastructure/coordinatesystem.html) defines the explicit ROOT coordinates used for shapes/edges/labels. The [box algorithm](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-box.html) packs only unconnected objects. [Release source](https://github.com/kieler/elkjs/tree/0.12.0) and the complete EPL-2.0 license/notice ship in web public assets. The production worker SHA-256 is `e4f5c51c6f2fd564bb64e52e81c4a85a316ef2f24f8b90e1db5eb886c765b030`, equal to the unmodified dependency worker.

Each uncached layout uses a terminated-on-completion/cancellation worker with a 15s deadline; a 16-entry geometry cache avoids work on selection/evidence refresh. Stale results cannot replace a newer view. Failed layouts expose Retry and never silently substitute heuristic routes. Derived positions never enter design/layout storage. Geometry readiness includes the initial camera fit. Layout changes can rearrange cards; custom persisted layouts and exhaustive graph/capacity certification remain deferred.

## Reproduction

```bash
pnpm work run unit apps/web/src/architecture/layout.test.ts
pnpm work run browser-preview apps/web/e2e/architecture-layout.spec.ts
pnpm work run browser-preview apps/web/e2e/architecture.spec.ts apps/web/e2e/architecture-evidence.spec.ts
pnpm work run check
```

The new `browser-preview` profile builds then runs selected existing strict specs against production assets, retaining the ordinary isolated test API/database, cleanup and fingerprint/log recording. Vite [inherits the server proxy for preview](https://vite.dev/config/preview-options.html#preview-proxy); the preview command explicitly binds `127.0.0.1` and the fixed test port.

Final evidence: geometry profile `2026-10-31T10-17-30-854Z-unit-4a706a57` passed four focused cases (1.1s). Production layout/retry/selection/refresh journeys `2026-10-31T10-25-29-263Z-browser-preview-b502bdc4` passed two cases (6.9s including build); existing architecture/evidence journeys `2026-10-31T10-23-46-731Z-browser-preview-baea768e` passed four cases (8.9s including build). Required gate `2026-10-31T10-25-43-590Z-check-95eb907d` passed in 38.2s: lint with no errors (636 files, 387 warnings/70 infos), all types and 633 offline tests/93 files. Passing profiles report `sourceChanged:false`. Vite's existing main-chunk-size warning remains; the separately loaded unmodified ELK worker is 1.60 MB. This focused proof does not certify every graph shape or large-graph performance.
