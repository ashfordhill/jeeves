# Lane grid execution units

Read the [parent plan](../../build-plan-lane-grid.md) first. Thirteen sequential units, LG01–LG13,
proposed 2026-11-04. A fresh agent runs one unit at a time on primary `main`, only when the owner
assigns it.

```text
LG01 → LG02 → LG03 → LG04 → LG05 → LG06 → LG07 → LG08 → LG09 → LG10 → LG11 → LG12 → LG13
board: graph, layout, React │ spec: model, commands, study │ web: canvas, cleanup, create, delete, inspector │ chat │ acceptance
```

## Rules for every unit

- Read [AGENTS.md](../../../AGENTS.md), the latest [handoff](../../handoff.md) entries and the
  parent plan. Do only your unit.
- automation-illustrator is at `~/github/automation-pitch` (commit `0803c4a`). Read the files named
  under **Read**, then port. Do not invent a different mechanism when one exists there. Start every
  ported file with `// Ported from automation-illustrator <path> (0803c4a).`
- `packages/board` never imports `@jeeves/*` or anything under `apps/`.
- Pin dependency versions exactly, using the versions the web app already has.
- Tests: a few focused unit tests for rules that are costly to get wrong. No click-a-button tests.
  E2E changes only as listed in your unit.
- Checks: `pnpm check`, `pnpm test:e2e` (or `:docker`), `pnpm --filter @jeeves/web build`, plus a
  browser check for anything visible: TinyURL renders, and your change works by mouse alone.
- Keep the docs current with the code (AGENTS.md list), describing what now exists.
- Append a handoff entry (what changed, how it was checked, notes for the next unit), then make one
  commit `LGnn: <summary>` with only your changes. Leave `.jeeves-feedback/` alone.

---

## LG01 — `@jeeves/board` package and graph rules

**Read:** automation-illustrator `src/workflow/graph.ts`, `src/workflow/commands.ts`,
`src/workflow/graph.test.ts`, `src/workflow/commands.test.ts`; Jeeves `packages/spec/package.json`,
`tsconfig.json`, `vitest.config.ts` (to copy their shape), `biome.json`.

**Do:**

1. Create `packages/board`: `package.json` (`@jeeves/board`, private, ESM,
   `"exports": { ".": "./src/index.ts", "./graph": "./src/graph/index.ts" }`, `typecheck` script,
   no dependencies yet), `tsconfig.json`, and `vitest.config.ts` (project `board`, node
   environment). Root Vitest and `pnpm -r typecheck` must pick it up.
2. `src/graph/` (pure TypeScript, imports nothing outside `src/graph`):
   - `types.ts`: `BoardNode { id }`, `BoardEdge { id, source, target, async?: boolean }`,
     `BoardGraph { nodes, edges }`,
     `Rules { root: string; canLink?(source, target, async): boolean; maxOut?: number }`, and
     `Result<T> = { ok: true, value } | { ok: false, code, message }`.
   - `reach.ts`: `reachableFrom`, `wouldCreateCycle`, `unreachableFrom(graph, root)`,
     `dropRedundantNew` (from `dropDirectedRedundantNewPaths`), `retargetIncoming`.
   - `check.ts`: `checkGraph(graph, rules)` returns violations: duplicate id, missing reference,
     self-link, duplicate pair, cycle, unreachable from root, rule-refused link, more than
     `maxOut` outgoing links (from `validateGraphInvariants`).
   - `edit.ts`, each function returning a `Result` checked with `checkGraph`:
     - `addAfter(graph, hostId, node, edge, rules)`: host → new.
     - `insertBefore(graph, hostId, node, edgeId, rules)`: retarget every incoming edge of the host
       to the new node, then new → host (`addConnectedNode` with `inbound`).
     - `link(graph, source, target, edge, rules)` (`connectNodes`).
     - `planRemoval(graph, nodeId, rules)` returns `{ nodeId, removeEdges, addEdges, strands }`:
       fan pairings (every predecessor × every successor), dropping pairs `canLink` refuses and
       pairs already reachable; a restitched edge is async if either replaced edge was (as
       `collapseStroke`); `strands` = nodes no longer reachable from the root.
     - `applyRemoval(graph, plan, alsoRemove)`: refused unless `alsoRemove` covers `strands`.
     - `removeEdge(graph, edgeId, rules)`: refused if anything is stranded (`removePath`).
3. `src/index.ts` re-exports `./graph/index.ts` for now.
4. Import guard: a Biome override for `packages/board/**` using `noRestrictedImports` for
   `@jeeves/*`. If Biome cannot express it, add `src/no-jeeves-imports.test.ts`, which scans
   `src/**` for `@jeeves/` and `apps/` imports. Add one line to AGENTS.md Conventions: "`packages/board`
   imports no Jeeves code."

**Tests (about 8):** fork and merge; insertBefore retargets; cycle, duplicate and `maxOut`
refusals; removal 1:1, 1:N, N:1 and M:N; a rule-refused pairing yields strands; `removeEdge`
refuses a strand.

**Not:** React, ELK, any app change.
**Commit:** `LG01: @jeeves/board package with automation-illustrator graph rules`

## LG02 — Board layout core

**Read:** automation-illustrator `src/board/layout/tileMetrics.ts`, `elkGraph.ts`, `elkLayout.ts`,
`laneLayout.ts`, `layoutEngine.ts`, `useAnimatedLayout.ts` (`lerpLayouts`),
`src/board/routing/polyline.ts`, and their tests (`elkLayout.test.ts` shows `elk.bundled.js` in
node).

**Do:** add `elkjs` 0.12.0 to `@jeeves/board`. In `src/layout/`:

- `metrics.ts`: `GRID` 32, `TILE_GAP` 64, `BRANCH_GAP` 32, `snapToGrid`, `rectsOverlap`, and
  `dockHint(source: Rect, size, portIndex, others: Rect[], side)` (the horizontal branch of
  `clearDockPosition`, with sizes passed in).
- `elkGraph.ts`: `buildElkGraph({ tiles: {id, w, h}[], lines: {id, source, target, chip?: {w, h}}[] },
  previous?)` with `ROOT_OPTIONS` verbatim (horizontal), `STABILITY_OPTIONS` and hint ordering
  when previous positions exist, FIXED_POS west/east ports, and inline chip labels. Also
  `graphKey`.
- `elkLayout.ts`: `BoardLayout { key, positions, routes, chips, bounds }`, `toBoardLayout`,
  `emptyLayout`.
- `engine.ts`: `createLayoutEngine(elk: ElkLike, { cacheSize, debounceMs })` with one request
  channel, plus `LayoutSuperseded`.
- `polyline.ts` (drop the restitch constants) and `animate.ts` (`lerpLayouts`).
- Export everything from `src/index.ts`.

**Tests (about 5, `elkjs/lib/elk.bundled.js`):** the same input gives identical output; a chain
stays on one row; a two-way fork is centred on its parent (within 1px); a merge lands one layer
after its deepest source; the engine returns a cached layout synchronously and rejects a
superseded request with `LayoutSuperseded`.

**Commit:** `LG02: board layout core ported from automation-illustrator`

## LG03 — Board React layer

**Read:** automation-illustrator `src/board/Board.tsx` (lines 1–260 and 440–720),
`routing/FlowArrow.tsx`, `layout/useLaneLayout.ts`, `layout/useAnimatedLayout.ts`,
`firstLayoutCamera.ts`, `zoom.ts`, `controls/PathHostFrame.tsx`, `Board.css`; Jeeves
`patches/README.md`.

**Do:** add React 19.2.8, React DOM 19.2.8 and `@xyflow/react` 12.11.6 as peer and dev
dependencies (the workspace patch applies). Add `@testing-library/react` 16.3.3 and `jsdom` 29.1.1
as dev dependencies. In `src/react/`:

- `Board.tsx`. Props: `tiles: {id, w, h, shape: "rect" | "pill", label, content}[]`,
  `lines: {id, source, target, dashed, chip?: {w, h, content}}[]`, `engine` (a layout engine),
  `selected: {tile?: string; line?: string}`, `onSelectTile`, `onSelectLine`, `onClear`,
  `mode: "select" | "hand"`, `hints?: Record<string, Point>`. It renders React Flow with no
  dragging or connecting, pan on drag, `snapGrid` [32, 32], min and max zoom from `zoom.ts`, a
  32px dot background, a single fit on the first non-empty layout, and a `fit()` exposed through a
  ref. The root has `class="board"` and `data-layout="initial|updating|ready"`.
- `BoardLine.tsx` from `FlowArrow`: the ELK route (orthogonal fallback), solid or dashed using
  `polylineDrawSegments`, 2.75px or 4px when selected, a 44px hit band, the chip at its ELK rect,
  and click to select.
- `useBoardLayout.ts` (from `useLaneLayout`, without the store: previously shown positions plus
  `hints` are the stability hints) and `useAnimatedLayout.ts`.
- `board.css`: `--board-line`, `--board-ink`, `--board-tile`, `--board-select`, `--board-plus`,
  `--board-dash` with automation-illustrator's light values as defaults.

**Test (1):** jsdom render with a fake `ElkLike` that returns fixed geometry: tiles and lines
appear, a dashed line draws segments, and clicking a tile calls `onSelectTile`.

**Not:** mounting it in the app (LG07).
**Commit:** `LG03: board React layer (React Flow host, lines, animated layout, fit)`

## LG04 — Spec: lane model, tile types, link rules

**Read:** plan §3; `packages/spec/src/studio-model.ts`, `studio-validation.ts`, `findings.ts`,
`design.ts` (`designIds`), `studio-definitions.ts` (visuals), `studio-blueprint.ts`;
`apps/web/src/studio/actions.ts` (`kindConnectionDefaults`); `docs/studio-blueprint.md`.

**Do:**

1. `@jeeves/spec` depends on `@jeeves/board` (`workspace:*`) and imports only
   `@jeeves/board/graph`.
2. `studio-model.ts`: an optional `entries: [{ id, lane: "download" | "upload", element }]`.
   `designIds` yields entries (type `entry`) so IDs stay unique.
3. `studio-tiles.ts`: the tile-type table (plan §3), `tileTypeOf(kind)`, and
   `defaultKind(type, context)` (Service after a queue → worker). Change the cache visual icon to
   `bolt`.
4. `studio-links.ts`: move `kindConnectionDefaults` here as
   `studioLinkDefaults(source, target, mode)` with the plan's async column, plus
   `studioEntryKinds` and `laneLimits = { entriesPerLane: 3, outgoingLinks: 4 }`. The web app
   imports it from the spec; delete the web copy.
5. `studio-lanes.ts`: `LANE_ACTOR = "@actor"`, `laneGraph(design)` (lane order, `async`, `dashed`;
   plan §3), and `laneFindings(design)` using `checkGraph` with `canLink` from
   `studioLinkDefaults`. Add `LANE_INVALID` (structural, error) to `findings.ts`. **Do not** call
   `laneFindings` from `validateStudio` yet; the current study has no entries (LG06 wires it).
6. Blueprint: `entries: [{ lane, element }]` (sorted) in the schema and output;
   `docs/studio-blueprint.md`.
7. CATALOG: the tile-type table.

**Tests (about 6):** the link table (allowed and refused pairs, per mode); entry kinds;
`laneGraph` order and dashing (sync chain, publish, the continuation after a queue);
`laneFindings` for unreachable, cycle and both caps.

**Commit:** `LG04: lane model in the spec (entries, tile types, link rules, lane graph)`

## LG05 — Spec: lane commands

**Read:** plan §3 (Lane commands); `studio-operations.ts` (`buildStudioCommand`, how `create`,
`connect`, `delete` and `edit` build operations), `apply.ts`, `studio-components.ts` (host rules);
`@jeeves/board/graph` edit API.

**Do:** add to `studioCommandSchema` and `buildStudioCommand`:

- `addTile { from: {lane} | {tile}, side: "after" | "before", link: "sync" | "async", tile: { id, name, kind, description? }, linkId }`.
  `before` requires `{tile}`; a lane is always `after` and `sync` (it creates an entry). This
  builds the element, its binding (`createStudioSettings`), the link with `studioLinkDefaults`,
  the owner (plan §3), and for `before` the replacement of every incoming link or entry. A
  replaced link keeps its mode and an entry keeps its lane.
- `linkTiles { from: {lane} | {tile}, to, link, linkId }`.
- `removeTile { tile, alsoRemove: string[] }`. Use `planRemoval`. Restitched pairs become
  connections, or entries in the removed entry's lane when the predecessor is the actor. Remove
  the hosted components, links, entries and package memberships (reuse the existing `delete`
  internals), and clear settings references to removed elements or connections (redirect lookups,
  CDN origin, browser `servedBy`).
- `removeLink { link }` (a connection or an entry).
- `changeKind { element, kind }`, restricted to the same tile type: new settings defaults and a new
  definition ref; refused when any link becomes invalid.
- Pure helpers for the canvas and chat: `laneTabs(design, nodeKey)` (which side/mode pairs have a
  valid choice), `laneChoices(design, nodeKey, side, mode)` (tile types with their resolved kind),
  `planRemoveTile(design, id)` (returns the strands).

Every refusal names the rule in plain words ("A cache can't link onward", "Redirect already has 4
links").

**Tests (about 6):** add after, before and from a lane; a merge and a refused cycle; removing CDN
restitches the download entry to Redirect; a removal with strands needs `alsoRemove`; a refused
`changeKind`; `laneChoices` after a queue (async only, Service resolves to worker).

**Commit:** `LG05: lane commands in the spec (add, link, remove, change kind)`

## LG06 — TinyURL in lanes; lane rules enforced; pre-lane projects deleted

**Read:** plan §4 (TinyURL in lanes); `studio-examples/tinyurl.ts`, `study.ts`, `apps/web/e2e/*`,
`docs/studio.md` (TinyURL section).

**Do:**

1. Rewrite the study: drop the Web app element and its connection, the C1 people and
   relationships (keep `system`) and the Link platform package. Add the entries download → CDN and
   upload → Shorten API. Keep all nine other elements, nine connections and the eleven modules.
   Bump to `2.0.0` unless something pins `1.0.0`.
2. Call `laneFindings` from `validateStudio`. From now on, batches that strand, cycle or break a
   cap are rejected.
3. The old canvas is still mounted. **New island** is now refused (an error notice is fine).
   Update the E2E level counts to what the old canvas shows, and the blueprint service list to
   `analytics, redirect, shorten-api`.
4. **Delete the pre-lane projects (owner decision L12, 2026-11-04; an explicit, one-time exception
   to AGENTS.md's "never touch the owner's projects").** With the API on 4310 against `jeeves`,
   `GET /projects`, then `DELETE /projects/:id` for each one. Record the names and IDs in the
   handoff. Drop `jeeves_e2e` as CL4 did. Check that the next app start creates the new TinyURL
   study.
5. Docs: the TinyURL section of the studio guide, the blueprint example, CATALOG.

**Commit:** `LG06: TinyURL study in lanes, lane rules enforced, pre-lane projects deleted`

## LG07 — The lane canvas replaces the studio canvas

**Read:** plan §2 and §4; `apps/web/src/studio/StudioWorkspace.tsx` (keep the header, rails,
ChatPanel, inspector, notices and undo/redo), `project/DesignView.tsx`, `studio/InspectorForm.tsx`,
`studio/ConnectionForm.tsx`, `studio/preferences.ts`, `studio/StudioIcon.tsx`; automation-illustrator
`src/board/layout/elkClient.ts`, `src/board/tiles/HumanFigure.tsx`, `human-figure.svg`,
`svgInner.ts`, `StepTile.tsx` (face proportions).

**Do:**

1. `apps/web/src/canvas/`:
   - `elk.ts`: the resilient worker ELK from `elkClient.ts`, behind one `createLayoutEngine`.
   - `tiles/ActorTile.tsx` with the ported human figure.
   - `tiles/Tile.tsx`: 128×128, kind icon via `StudioIcon`, name in up to two lines; a pill for
     Database, Cache, Queue and Storage.
   - `LaneCanvas.tsx`: `laneGraph` → `<Board>` tiles and lines, entry chips (download and upload
     icons), dashing, selection.
   - `canvas.css`, mapping `--board-*` to Jeeves tokens in light and dark.
2. `Workspace.tsx` replaces `StudioWorkspace` in `DesignView`: Undo, Redo, Fit, V/H buttons and
   shortcuts, the chat rail, the canvas, and the inspector rail. A tile opens `InspectorForm`
   (General, Options, Connections; no package, membership or dependency actions). A line opens
   `ConnectionForm`. An entry shows its lane icon and target. The actor or no selection shows the
   system name and goal (`editSystem`).
3. Leave the old canvas files unmounted; LG08 deletes them.
4. E2E: helpers become `ready` = `.board[data-layout="ready"]` and `tile(page, name)` by accessible
   name. `canvas.spec.ts` replaces `studio-levels` (10 tiles, 11 lines, 3 dashed).
   `edit-history.spec.ts` edits Shorten API's request timeout (autosave, undo, redo, reload).
   `blueprint-chat.spec.ts` uses the new helpers. Remove `spawn.spec.ts` (it returns in LG09).
5. Browser: TinyURL at 1440×900 and 1280×800, light and dark. Record the Fit zoom with the chat rail
   open and closed (target ≥ 0.75 closed; report it, do not shrink tiles to meet it).
6. Docs: replace the studio guide's Levels, Layout, Lines and Creating sections with the canvas as
   it now is (read-only). Update PLAN.md (layout, repository layout), README's first paragraph, and
   AGENTS.md verification step 4 ("the TinyURL study renders on the lane canvas").

**Commit:** `LG07: lane canvas replaces the C1/C2/C3 studio canvas`

## LG08 — Remove the old canvas

**Do:**

- Delete everything the old canvas alone used: `StudioWorkspace.tsx`, `StudioGraph.tsx`,
  `layout.ts`, `layout.worker.ts`, `layout-client.ts`, `use-layout.ts`, `use-settle.ts`,
  `routing.ts`, `spawn.ts`, `creation.ts`, `StudioLibrary.tsx`, `ConnectionCreator.tsx`,
  `MembershipActions.tsx`, `DependencyActions.tsx`, `card-appearance.tsx`, the unused rules in
  `studio.css`, and the obsolete parts of `studio.test.ts`.
- In the spec, delete `studio-view.ts` (and its test) and `studio-relationships.ts`.
  `studio-presets.ts` goes in LG12 if chat still reads it.
- Remove row-order history and layout PUTs from the web store, and update its tests. The server
  layout route stays; document it as unused by the canvas.
- Rename `useDraw` → `useProject`, the `draw` view ID → `design`, and the `draw-*` classes.
- Reachability pass (as CL4): nothing unreferenced remains.

**Checks:** the same four E2E specs; the browser looks unchanged.
**Commit:** `LG08: remove the old studio canvas, C1/C2/C3 projections and row-order history`

## LG09 — Spawn and link by mouse

**Read:** automation-illustrator `src/board/controls/TileChrome.tsx`, `plusPreviewLayout.ts`,
`tileOverlay.ts`, `PathKnotIcon.tsx`, `src/app/styles/tokens.css` (chrome rules, about lines
1169–1480), `src/state/store.ts` (`beginPlusPull`, `completePathPull`, `spawnBranch`: lines
1327–1490) and `src/state/interaction.ts`; look at the `drag-create-*` and `path-add-delete-*`
frames in `~/jeeves-planning/2026-11-04/automation-illustrator-frames/`.

**Do:**

1. Board `react/TileChrome.tsx`, on the selected tile only:
   - Tabs per side come from props: `plus` (`+`) or `dash` (`DashGlyph`).
   - Pull with pointer capture: 36px threshold, the taffy ribbon (dashed for `dash`), and a scrim
     with a hole for the tile.
   - The icon fan (`fan.ts`: N items on an arc, radius 104 plus 24 per item beyond 2, spread up to
     150°).
   - Release over an item calls `onPick(tileId, tabId, itemId)`. Release over another tile calls
     `onDrop(tileId, tabId, targetId)` when `canDrop` allows it; valid targets highlight and
     invalid ones dim during the pull.
   - Anywhere else springs back. Escape cancels.
2. Board dock hint: when `onPick` resolves with the new tile ID, it computes `dockHint` from the
   source's displayed rect and passes it as a layout hint, so the tile appears at the next slot
   and the layout animates.
3. Jeeves wiring:
   - Tabs come from `laneTabs` and items from `laneChoices` (icons; tile-type name as tooltip and
     accessible label).
   - The actor has two `+` tabs on the right with download and upload badges, and no X. Resources
     have no right-side tabs.
   - `onPick` runs `addTile` (name = tile-type label, made unique), selects the new tile and focuses
     its Name field. `onDrop` runs `linkTiles`. Refusals go to the existing notice.
4. E2E `spawn.spec.ts`:
   - Pull Redirect's right `+` and release on the Cache icon: 11 tiles, revision 2, new tile
     selected.
   - Pull Shorten API's right `---` onto Click events: one more dashed line, and a publish
     connection in the design.
5. Docs: the studio guide's creating section.

**Commit:** `LG09: automation-illustrator spawn and link on the lane canvas`

## LG10 — Delete tiles and lines

**Read:** automation-illustrator `TileChrome.tsx` (X button), `src/state/store.ts` `removeTarget`,
`applyPlannedRemoval`, `commitRemovalKeepingNeighbor` (about lines 1589–1700 and 1810–1852),
`src/app/components/RemovePickerHud.tsx` (HUD look).

**Do:**

- The board shows a red X on the selected tile when `removable(tileId)` (never the actor), and on a
  selected line at its midpoint.
- X on a tile runs `planRemoveTile`. With no strands, it applies `removeTile` straight away.
  Otherwise a small HUD by the tile shows the stranded tiles (icon and name) with
  **Remove N tiles** and **Cancel**.
- After a removal the first predecessor is selected (`nextTileAfterRemoval`).
- X on a line runs `removeLink`; a refusal goes to the notice.
- Delete/Backspace do the same as X (optional).

**E2E:** X on CDN → 9 tiles and Redirect becomes the download entry; Undo → 10 tiles.
**Docs:** the studio guide's delete section and Limits.
**Commit:** `LG10: delete tiles and lines with restitching`

## LG11 — Inspector: tile variants and modules list

**Read:** `apps/web/src/studio/InspectorForm.tsx` (`ComponentForm`, `ComponentDraftForm`),
`component-drafts.ts`, `packages/spec/src/studio-components.ts` (definitions, targets,
`browserHost`); automation-illustrator `src/app/inspector/TypeButtons.tsx` and `.css` (the icon row).

**Do:**

- A variant row at the top of a tile's inspector: one icon button per kind of its tile type (kind
  name as tooltip and label), with the current kind pressed. A click runs `changeKind`. If a dry run
  with `applyOperations` refuses it, the button is disabled and its title shows the reason.
- A **Modules** section for application kinds:
  - The list shows the component icon and name.
  - A `+` icon menu offers the component kinds the host allows; picking one runs
    `createComponent` with a default name.
  - Clicking a module opens its existing form (settings, readiness, links); the form has a remove
    button (`removeComponent`).
  - Nothing on the canvas.

**E2E:** `edit-history.spec.ts` goes back to Link writer's pool size, via Shorten API → Modules.
**Docs:** the studio guide's inspector section, and studio settings if any field moved.
**Commit:** `LG11: inspector type variants and modules list`

## LG12 — Chat on the lane commands

**Read:** `apps/server/src/chat/tools.ts`, `chat/service.ts`, `chat/tools.test.ts`,
`chat/chat.test.ts`, `fixtures/chat/`.

**Do:**

- The chat command schema becomes `addTile`, `linkTiles`, `removeTile`, `removeLink`,
  `changeKind`, `edit`, `editSystem`, `editConnection` and the component commands. Remove
  `create`, `connect`, `group`, `removeMembers`, `ungroup` and `delete` from chat. Remove them from
  the spec too, unless something else still uses them.
- `getDesign` describes the actor, both lanes and their tiles in lane order (IDs, kinds, link
  modes) and the caps.
- `listStudioDefinitions` lists the tile types and kinds. Remove presets (and `studio-presets.ts`
  if it becomes unused).
- Rewrite `INSTRUCTIONS` around: one actor, two lanes, tiles hang off lanes, async forks, no
  islands or cycles, resources are end tiles.
- The fixture gains the turn "Add a cache after the redirect service", which runs `addTile`.

**Tests:** one tools test that `addTile` through chat equals the same canvas batch.
**E2E:** `blueprint-chat` also sends the new scripted turn and sees 11 tiles.
**Commit:** `LG12: chat edits the lane canvas through the lane commands`

## LG13 — Acceptance and documentation

**Do:**

- Check plan §2 decision by decision in the running app, by mouse only. Build TinyURL's lanes from
  **Blank architecture** and record the number of drags and clicks. Repeat one edit through chat.
- Record the Fit zoom at 1440×900 and 1280×800 and anything that still looks messy. Describe it
  in the handoff; there is no evidence folder.
- Final pass on README, PLAN, CATALOG, the studio guide (with Limits), studio settings, the
  blueprint doc, AGENTS and the C4 notes.
- Mark this plan and the parent plan complete.

**Commit:** `LG13: lane grid acceptance and documentation`
