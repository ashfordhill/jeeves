# SG01 — Baseline and reference capture

Captured 2026-11-04 on primary `main` at `95e70e8`, before any studio-grid product change.
No product code changed in this unit.

## Baseline screenshots

`screenshots/` holds 52 PNGs of the current default studio, at 1440×900 and 1280×800, for the two
studies the owner reviewed:

| Study (live project) | Views |
| --- | --- |
| Mattermost · backend design review (`9928f0b6…`, revision 6) | C1, C2, C3 of Job server, Mattermost server, Web client |
| Streamly · video platform (`a6eeb601…`, revision 2) | C1, C2, C3 of Activity worker, Platform API, Trust & safety console, Playback API, Media processor, Viewer & creator web |

File names are `<study>-<size>-<level>[-<service>]-<variant>.png`:

- `opened`: the camera the studio chooses when the scope opens in a fresh browser.
- `fit`: the same scope zoomed out with the mouse wheel and centred with a middle-button pan
  until every card, path and label is inside the canvas. This is not Tidy and fit, which saves
  layout and was not used.

C3 scopes were reached the only way the current studio allows: select the service on C2, then the
header `C3` button. The script detected which services open a detail scope (title `Open <name>`
matching the selected card). Resources and externals have no C3 scope.

The capture is `capture.mjs` (Playwright 1.63.0, Chromium, Node 24.21.0) against the already
running dev servers (web 4300, API 4310). `capture-log.json` records every shot, detected scopes
and blocked requests.

### Read-only guard and its visible effect

Every page had a route guard installed before navigation that aborted all non-GET/HEAD/OPTIONS
requests. It blocked 26 `PUT /api/projects/:id/layout` requests (16 Streamly, 10 Mattermost):
**opening scopes and selecting cards makes the current studio write layout**, even with no user
edit. Aborting them makes the studio show "Layout not saved: Failed to fetch"; the script dismisses
that notice before each screenshot. Some `opened` frames may differ slightly from what a saved
settle would show afterwards.

Preservation: the project list (ids, revisions, `updatedAt`) and full `GET /projects/:id` bodies of
both studies were identical before and after (sha256 `803a4f2d…` Mattermost, `2e9bad45…` Streamly).
No project was created, changed or deleted.

### What the baseline shows (problems SG05–SG08 address)

- **C2 is wide and thin.** Streamly C2 fits only at a zoom where card text is unreadable at both
  sizes (`streamly-*-C2-fit.png`). Cards sit in long SCC layers with large empty gaps.
- **Detour lanes.** Paths that cannot route directly run in bands above or below the whole
  diagram (Mattermost C2 and the Mattermost server C3 frame; Streamly C2 `opened`).
- **Stacked parallel lines.** Several relationships between the same pair are separate, closely
  spaced lines with separate labels (Mattermost server → Application database; Streamly Platform
  API fan-out).
- **Truncated sentence labels.** Labels are full sentences cut with an ellipsis
  ("Commits posts & metadata / Reads ch…", "Reviews reports and restricts conte…").
- **C3 is per service and not components-first.** The Mattermost server C3 shows the server and its
  neighbouring containers/resources rather than modules inside one frame. A breadcrumb and back
  button are the only way out.
- **Live-project drift.** The Mattermost project has a stray unconnected "Microservice" card on C2
  and a disconnected "Team member" person on C1 (the `member-system` relationship removed in the
  concurrent edit recorded in UX15). These are owner data, not study defects, and were left as is.
- Edges already declare `strokeWidth` 2 (3 selected) in `StudioGraph.tsx`; they look like
  hairlines because most fitted scopes render well below zoom 1. SG07 should check stroke at the
  effective zoom (for example `vector-effect: non-scaling-stroke` or a zoom-aware width).

## Reference: automation-illustrator (read-only)

Source: `~/github/automation-pitch` at `0803c4a` (elkjs `^0.12.0`; Jeeves pins `elkjs` 0.12.0 in
`apps/web` and `apps/server`). Nothing there was modified.

### ELK options (`src/board/layout/elkGraph.ts`)

Root `ROOT_OPTIONS`:

| Option | Value |
| --- | --- |
| `elk.algorithm` | `layered` |
| `elk.direction` | `RIGHT` (from the flow profile; `DOWN` when vertical) |
| `elk.edgeRouting` | `ORTHOGONAL` |
| `elk.padding` | `[top=32,left=32,bottom=32,right=32]` (GRID) |
| `elk.spacing.nodeNode` | `32` (BRANCH_GAP) |
| `elk.layered.spacing.nodeNodeBetweenLayers` | `64` (TILE_GAP) |
| `elk.layered.spacing.edgeNodeBetweenLayers` | `32` |
| `elk.layered.spacing.edgeEdgeBetweenLayers` | `16` |
| `elk.spacing.edgeNode` / `elk.spacing.edgeEdge` | `16` / `16` |
| `elk.spacing.edgeLabel` | `8` |
| `elk.edgeLabels.placement` | `CENTER` |
| `elk.layered.layering.strategy` | `NETWORK_SIMPLEX` |
| `elk.layered.nodePlacement.strategy` | `BRANDES_KOEPF` |
| `elk.layered.nodePlacement.bk.fixedAlignment` | `BALANCED` (centres a fan-out parent on its children) |
| `elk.layered.crossingMinimization.strategy` | `LAYER_SWEEP` |
| `elk.layered.considerModelOrder.strategy` | `NODES_AND_EDGES` |
| `elk.layered.thoroughness` | `10` |
| `elk.layered.mergeEdges` | `true` |
| `elk.separateConnectedComponents` | `false` |
| `elk.layered.wrapping.strategy` | `OFF` |
| `elk.aspectRatio` | `1.6` (`0.625` vertical) |

Other option sets:

- `STABILITY_OPTIONS`, added once a previous layout exists: `layering.strategy`
  `LONGEST_PATH_SOURCE` and `crossingMinimization.forceNodeModelOrder` `true`. Nodes and edges are
  first sorted by their previous across-flow coordinate (`byHint`), so forks keep their rows. This
  is the mechanism SG06's row-order hints can reuse: sort children by the hint, then force model
  order.
- `NODE_OPTIONS`: `elk.portConstraints` `FIXED_POS`.
- Ports: each node gets exactly two zero-size ports, `<id>__in` on `WEST` at `(0, h/2)` and
  `<id>__out` on `EAST` at `(w, h/2)`. Every edge goes `out` port → `in` port, so with
  `mergeEdges` all edges leaving a node share one point.
- Labels: one inline label per labelled edge (`elk.edgeLabels.inline` `true`, set on the label
  itself because ELK ignores it on the root), sized by `labelBox.ts`: max width `GRID * 6` = 192px,
  max 3 lines, 12px font, ~0.62em per character, padding 10/6, border 3.
- `laneGraphKey` caches by orientation, node ids/types/sizes, edge endpoints and label boxes.
- `elkLayout.ts` reads child x/y and the single edge section as absolute coordinates (flat root)
  and rounds to integers; it throws if an edge has other than one section. It does **not** snap to
  the grid: alignment comes from 32-multiple sizes, gaps and padding.

Adaptation notes for SG06:

- Plan §4 needs compound nodes at C3 (`elk.hierarchyHandling` `INCLUDE_CHILDREN`); the reference
  graph is flat. With compound nodes, set `elk.json.edgeCoords`/`shapeCoords` `ROOT` (as Jeeves'
  retired `apps/web/src/architecture/layout.ts` already does) or convert parent-relative coordinates.
- Plan §4 wants islands packed; the reference keeps `separateConnectedComponents` `false`. Turn it
  on (with `elk.spacing.componentComponent`, default packing) or pack islands after layout.
- Jeeves cards are not 32-multiples today (current studio grid is 24px, `studio/layout.ts`
  `GRID = 24`). Choose 32-multiple card sizes or snap ELK output explicitly.
- Worker: the reference runs `elkjs/lib/elk-worker.min.js` via a Vite `?url` import with a
  main-thread `elk.bundled.js` fallback (`elkClient.ts`) plus a debounced, cached, coalescing
  engine (`layoutEngine.ts`, superseded requests reject with `LayoutSuperseded`). Jeeves already
  has the same `?url` worker pattern in `apps/web/src/architecture/layout-client.ts` (one worker per
  uncached request, 15s timeout, abort signal) and a separate module worker
  `apps/web/src/studio/routing.worker.ts` for the current router.

### Grid constants (`src/board/layout/tileMetrics.ts`)

`GRID` 32, `TILE_GAP` 64 (between layers), `BRANCH_GAP` 32 (siblings). Step tile 256×160 (radius
14, actor column 96); data tile 128×96 (radius 32). `snapToGrid(n) = round(n / 32) * 32`.
`rectsOverlap` uses a one-grid gutter. Word-web mode widens gaps to 160/80.

### Spawn and dock helpers

- `dockPosition(source, targetType, portIndex, side, orientation)`: places a new tile one
  `TILE_GAP` past the source along the flow (`side` `out` → right, `in` → left), centred on the
  source's across-flow axis, offset by `portIndex × stride` where stride is the taller tile plus
  `BRANCH_GAP`; snapped.
- `clearDockPosition(…, others, …)`: same row first, walking further along the flow until free;
  then stacks across the flow from `portIndex`; final fallback past the furthest tile.
- `vacantSpot(nodes, type, orientation)`: first free slot past all tiles along the flow; empty board
  → `(32, 160)`. This maps to plan §4 "New island" / empty canvas.
- `withDisplayedPositions` overlays the displayed (ELK) positions on document positions before
  docking, so new tiles dock against what the user sees.
- `store.ts` `spawnBranch(sourceId, type, side)`: picks the next port index, computes
  `clearDockPosition` against displayed positions, then calls `addConnectedNode` (create node plus
  edge in one validated document change; `inbound` inserts a parent by retargeting the source's
  incoming edges) and commits once (one undo step), then selects and focuses the new node.
- `TileChrome.tsx` `+` tabs: pointer-down captures the pointer and calls `beginPlusPull`; once the
  drag passes `PULL_THRESHOLD` (36px) a fan of kinds (step / data) appears; releasing on a kind
  calls `spawnBranch`; `beginPathPull`/`completePathPull` handle drop-on-existing-tile connects.

Adaptation notes for SG08: in Jeeves, positions are derived (O2), so the dock position is only a
transient preview; the stored result is the element, the relationship and at most a row-order
hint. Jeeves must not copy the inbound "retarget all incoming edges" behaviour, which is a
workflow-specific insert-parent rule; plan §4 only creates one box plus one connection. The kind
fan must list kinds valid for the current level (plan §4).

## Checks

Node 24.21.0, pnpm 12.16.1. Tails are in `checks/`.

- `pnpm lint`: exit 0, 2,797 warnings / 88 infos (unchanged), no errors.
- `pnpm typecheck`: exit 0.
- `pnpm --filter @jeeves/web build`: exit 0, existing large-chunk advisory.

Unit/E2E suites and `pnpm check` are owner-deferred and were not run.
