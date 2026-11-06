# Handoff log

Append-only. Each agent adds one short entry when its unit is done: what changed, how it was
checked, and notes for the next unit. Never edit earlier entries. History before
2026-11-04 is in Git (tag `pre-cleanup-2026-11-04`).

## 2026-11-04 — Repository cleanup (CL1–CL4), summary

The owner asked for a large cleanup: remove all unused, old and outdated code, tests and docs.
Four phases ran one at a time, each by a fresh agent and in its own commit, under four owner
decisions:

| # | Decision |
| --- | --- |
| K1 | Remove the original code-generation stack (generator, template kit, templates, recipes, starters, orchestrator, registry, runtime packages, Generate and Runs, QR Studio and Resource workspace starters). Future code generation is a separate service reading the blueprint API. |
| K2 | Keep only the studio design format. The pre-studio format and the backend, contract, deployment, pattern, library, handoff and proof models are gone, with no compatibility layer. |
| K3 | Remove the backend benchmark material (`benchmarks/`, the Discourse, Vendure and Zammad models, P73a and the benchmark queue). |
| K4 | Keep only current docs; rewrite README, AGENTS, PLAN and CATALOG; restart this log. |

Outcome: 3,190 tracked files became 189. CL1 removed the generation stack and unreached web UI,
CL2 reduced the spec, server and chat to the studio format (migration `0008` rewrote stored
documents), CL3 replaced the tests with 15 unit test files (93 tests) and a five-test E2E smoke
set, and CL4 removed historical docs and stale tooling.

- Everything removed is recoverable at Git tag `pre-cleanup-2026-11-04`.
- The owner's four pre-cleanup projects were exported to `~/jeeves-legacy-exports/2026-11-04/`
  (JSON per project plus a full database dump) and deleted from the database. The owner's
  "TinyURL · studio study" (`7d19609c…`) was created afterwards and is untouched.
- `~/.jeeves/architecture-library.json` (27 MB, saved library entries no longer used) was left on
  disk for the owner.

What remains: the studio (C1/C2/C3 tabs, ELK layout, `+` spawning, merged lines, inspector,
Library with the TinyURL study and Blank architecture), chat with the finite studio commands and
the OpenAI and Codex providers, Settings, the server's project, design, operations, history,
layout, chat, settings and blueprint routes, Postgres, and `@jeeves/spec`. See
[README](../README.md), [PLAN](../PLAN.md) and the [studio guide](studio.md).

## 2026-11-04 — CL4: current docs only, repository hygiene (complete)

Removed (2,043 tracked files; about 404,000 lines including the old 11,700-line log):

- **Docs:** `docs/evidence/` (1,884 files), `.docs/` (README images and the UX review sources),
  `docs/reviews/`, `docs/plans/`, `docs/examples/`, `docs/templates/`, `docs/reference/`, every
  `docs/build-plan*.md`, `improvements.md`, the `backend-*`, `architecture-*` (except the studio
  guide), `contract-types`, `runtime-workflows`, `sources`, `editor-provider-review`,
  `qrwty-authoring-review`, `developer-workflow` and `docs/README.md` pages, and
  `docs/cleanup-plan.md` (summarized above). Tracked `.jeeves-work/` content: none existed.
- **Tooling:** `scripts/work.ts` and `scripts/lib/work.ts` (the `pnpm work` evidence runner; its
  profiles duplicated the package scripts and one pointed at a deleted config),
  `scripts/references.ts`, `scripts/lib/references.ts` (only read `docs/reference`) and
  `scripts/tsconfig.json`; the `work` and `references` scripts and the scripts type check. The
  `render-excalidraw` workflow (no `.excalidraw` files remain).
- **Dead code:** `studioCreationCatalog`, `studioProviders`, `studioProviderCompatibility`,
  `changeStudioSetting`, `createStudioConnectionSettings`, `studioPackageFields`,
  `studioContextFields` and `studioContextRelationshipFields` in `studio-definitions.ts`
  (182 lines, referenced nowhere); four unused icons. Reachability from the web, worker and
  server entry points plus the tests leaves only `vite-env.d.ts` unreached (ambient types).
  Remaining exports used only in their own file, and schema-derived type aliases, were left.
- **Comments:** references to deleted plans (`PLAN §n`, `SGnn`, `UXnn`, `Sn`) were removed from
  code comments; one inspector help text no longer mentions Generate.

Kept and rewritten: [README](../README.md) (what Jeeves is, run, test, ports; the owner's
"Notes" sections are kept verbatim), [AGENTS](../AGENTS.md), [PLAN](../PLAN.md) (current
architecture), [CATALOG](../CATALOG.md), [studio guide](studio.md) (renamed from
`architecture-studio.md`, with the TinyURL study folded in), [studio settings](studio-settings.md)
(moved from `plans/studio-ux/configuration-matrix.md`, trimmed to current fields),
[blueprint](studio-blueprint.md), [Docker](docker.md), and [C4 notes](c4-modeling.md), now a
short background note (C4 is inspiration; the canvas will next be rebuilt on a locked lane grid).

Renamed: `apps/web/src/draw/` → `apps/web/src/project/` (store, API client, form drafts, project
menu, chooser, browser, `create-example.ts` from the old `architecture/`), `DrawView` →
`DesignView`, `draw.css` → `design-view.css`, `TemplateIcon` → `studio/StudioIcon.tsx`. The
store hook is still `useDraw` and the view hash is still `#/draw` (kept for links and tests).

Hygiene: CI workflow [`ci.yml`](../.github/workflows/ci.yml) runs `pnpm check`, the web build
and `pnpm test:e2e` (Postgres via compose, Chromium installed) on pushes to `main` and pull
requests. Playwright keeps traces on failure (`retain-on-failure`). Biome no longer ignores
`.docs`; `.dockerignore` excludes `.claude` and `.jeeves-feedback` (untracked, otherwise part of
the build context); compose and nginx comments updated; `patches/README.md` no longer cites
deleted tests (the React Flow patch is still needed). No dependency was unused, so none was
removed and the lockfile is unchanged.

Database: the `jeeves_e2e` test database (714 junk projects from the old suite) was dropped; the
E2E server recreates it. A fresh `jeeves_e2e` gets one or two auto-created TinyURL projects on the
first run (the app's fresh-install default); later runs add none. The owner's `jeeves` database
was not changed.

Checks (Node 24.21.0):

- `pnpm install --frozen-lockfile`: up to date.
- `pnpm check`: exit 0 (Biome 153 files, all type checks, 15 test files / 93 tests passed).
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- `pnpm test:e2e`: 5 passed.
- Markdown links: every relative link and anchor in tracked Markdown resolves.
- Browser (Playwright on the running Vite 4300 and API 4310, which already served the new code;
  neither restarted): a new TinyURL project showed C1 4/3, C2 12/11, C3 21/17 boxes/lines;
  blueprint 200, `no-store`, `blueprint: 1`, 4 services, 5 resources, 10 connections, no findings
  or omissions; Settings showed both providers; no page or console errors; writes went only to
  that project, which was then deleted (204).

Notes for the next unit:

- The owner's next direction is a canvas rebuilt on an automation-illustrator-style locked lane
  grid (actor root, lanes, tiles, no islands). The studio guide's Layout section describes the
  current ELK canvas and will need rewriting with it.
- `useDraw`, the `draw` view ID and some `draw-*` CSS class names remain; rename them with the
  canvas rebuild if wanted.

## 2026-11-04 — Lane-grid build plan (LG01–LG13), proposed

Planning only; no code changed. The owner's brief (`~/jeeves-planning/2026-11-04/BRIEF.md`) became
[the lane-grid build plan](build-plan-lane-grid.md) and its
[execution units](plans/lane-grid/execution-units.md), after a full read of this repository and of
automation-illustrator's `src/board/`, `src/state/store.ts` and `src/workflow/` (commit `0803c4a`).
PLAN.md's "Next" section links them.

Owner answers on 2026-11-04:

- The `+` picker shows seven tile types as icons (Service, API, Database, Cache, Queue, Storage,
  External). The exact kind is an icon row in the inspector. Browser app is not creatable.
- Projects made before the lane canvas are deleted, not migrated. There is no backwards
  compatibility. LG06 does this as a one-time, owner-authorized exception to "never touch the
  owner's projects".

Checked: every relative link in the two new docs resolves. The automation-illustrator file paths
and line ranges cited in the units were read in this session.

Notes for LG01: start with `packages/board/src/graph/` only. automation-illustrator's "lane" means
Before/After, not a row; Jeeves lanes are the actor's tagged entry links. Nothing in the app
changes until LG07.

## 2026-11-04 — LG01: `@jeeves/board` package and graph rules (complete)

New workspace package `packages/board` (`@jeeves/board`, private, ESM, no dependencies; exports
`.` and `./graph`; `typecheck` script; Vitest project `board`). Root Vitest and
`pnpm -r typecheck` pick it up. Its `tsconfig.json` sets `"types": []`, so no Node or DOM globals
yet. `src/graph/` is ported from automation-illustrator `src/workflow/graph.ts` and
`commands.ts` (0803c4a):

- `types.ts`: `BoardNode`, `BoardEdge` (`async?`), `BoardGraph`, `NewLink { id, async? }`, `Rules
  { root, canLink?, maxOut? }`, `GraphViolation { code, message, node?, edge? }`, `Result<T>` /
  `Refusal` (a refusal has the same fields as a violation).
- `reach.ts`: `reachableFrom`, `wouldCreateCycle`, `unreachableFrom`, `dropRedundantNew`,
  `retargetIncoming`.
- `check.ts`: `checkGraph` (duplicate id across tiles and links, missing reference or root,
  self-link, duplicate pair, refused link, too many links, cycle, unreachable from the root).
- `edit.ts`: `addAfter`, `insertBefore`, `link`, `planRemoval`, `applyRemoval`, `removeEdge`,
  `uniqueEdgeId`. Every edit refuses an invalid input graph and checks its result with
  `checkGraph`.

Import guard: two Biome overrides with `noRestrictedImports` patterns. All of `packages/board`
may not import `@jeeves/**` or any path through `apps/`. `src/graph/**` (except tests) may also
import nothing but `./` files. Both were checked with throwaway probe files. AGENTS.md
Conventions gained "`packages/board` imports no Jeeves code."; PLAN.md's repository layout has a
`packages/board` row; the parent plan's status now says "in progress".

Departures from the unit text, all small:

- `insertBefore(graph, host, node, edge, rules)` takes a `NewLink` like `addAfter`, not a bare
  `edgeId`, because the new → host link needs a mode.
- `applyRemoval(graph, plan, alsoRemove, rules)` takes `rules` so it can run `checkGraph`.
  `alsoRemove` must name exactly the strands; extra IDs are refused too.
- `planRemoval(graph, node, rules, edgeId?)`: optional namer for restitched links (default
  `source->target`, made unique). It is refused when the restitched graph without its strands
  would still break a rule (for example a predecessor going over `maxOut`), so a plan that
  returns ok always applies.
- `maxOut` does not apply to the root: the actor's entries are capped per lane by the spec.
- A restitched pair that already exists or is already reachable is dropped. automation-illustrator
  merged it into the existing link (labels, dash); Jeeves connections keep their own settings.
- M:N removals use fan pairings (as the plan says), not automation-illustrator's nearest pairs.

Checks (Node 24.21.0 from `~/.nvm/versions/node/v24.21.0/bin`; the default `node` on PATH is 18):

- `pnpm check`: exit 0 (Biome 163 files, all type checks including `packages/board`, 16 test
  files / 101 tests passed; the board adds 8).
- `pnpm test:e2e`: 5 passed.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- No browser check: nothing visible changed. The owner's dev servers on 4300/4310 were left
  running and untouched.

Notes for LG02:

- `src/layout/` falls under the package-wide guard only, so it may import `elkjs`. Keep
  `src/graph/` free of imports from outside the folder; the spec will import `@jeeves/board/graph`.
- pnpm 12 writes no lockfile importer for a package without dependencies. Adding `elkjs` will
  create the `packages/board` entry.
- If the ELK tests need Node globals, add `"node"` to `types` in `packages/board/tsconfig.json`.
  LG03 will need the DOM lib and JSX settings there.
- For LG04/LG05: refusal messages name IDs (`"a" cannot link to "b".`). The spec should map
  `code` with `node`/`edge` to its own plain-words messages with tile names. TinyURL in lanes
  peaks at 3 outgoing links (Redirect, Shorten API), so no cap needed raising.

## 2026-11-04 — LG02: board layout core (complete)

`@jeeves/board` now depends on `elkjs` 0.12.0 (the web app's version) and its `tsconfig.json`
adds the DOM lib (the engine uses `setTimeout`, `queueMicrotask` and `console`; still no Node
types). New `packages/board/src/layout/`, exported from the package root (`@jeeves/board`), not
from `./graph`. Ported from automation-illustrator 0803c4a:

- `metrics.ts` (`tileMetrics.ts`): `Point`, `Size`, `Rect`, `GRID` 32, `TILE_GAP` 64,
  `BRANCH_GAP` 32, `snapToGrid`, `rectsOverlap`, and `dockHint(source, size, portIndex, others,
  side)`: the horizontal branch of `clearDockPosition`. `side` is `"after" | "before"` (out/in).
- `elkGraph.ts`: `LayoutInput { tiles: {id, w, h}[], lines: {id, source, target, chip?: {w, h}}[] }`,
  `buildElkGraph(input, previous?)` with `ROOT_OPTIONS` verbatim, `STABILITY_OPTIONS` and hint
  ordering when any tile has a previous position, FIXED_POS west/east ports at mid-height, inline
  chip labels; `graphKey(input)` (JSON of ids, sizes, endpoints and chip sizes in input order).
- `elkLayout.ts` (`elkLayout.ts`, `laneLayout.ts`): `BoardLayout { key, positions, routes, chips,
  bounds }`, `LayoutPhase`, `toBoardLayout`, `emptyLayout`.
- `engine.ts` (`layoutEngine.ts`): `createLayoutEngine(elk: ElkLike, { cacheSize, debounceMs })`
  with `get`, `keyFor` and `request(input, previous?)`; one request channel; `LayoutSuperseded`.
- `polyline.ts` (`routing/polyline.ts`, horizontal only, no restitch dash): SVG path,
  orthogonal fallback, resample/lerp, `polylineDrawSegments`, `DASH_LENGTH` 8 / `DASH_GAP` 7 /
  `DASH_PERIOD`.
- `animate.ts` (pure half of `useAnimatedLayout.ts`): `lerpLayouts`, `layoutDelta`, `SNAP_PX`,
  `MODEST_MAX_PX` 280, `ANIMATE_MS` 200.

Departures from automation-illustrator and the unit text, all small:

- ELK ignores a label whose text is empty, so a chip label's text is its id (never drawn). With
  empty text every chip came back at 0,0; the tests now check each chip's centre is on its line.
- There are no stored positions to fall back on. In stable mode a tile without a previous
  position is hinted with `dockHint` (port 0) beside its first placed source, so a tile added by
  chat sorts into its source's row instead of the top.
- Ties in hint order compare ids by code unit, not `localeCompare`.
- A superseded request that was queued for the next microtask (cold start) no longer runs ELK.

Tests (`src/layout/layout.test.ts`, 6, `elk.bundled.js`): option ids known and identical output
for the same input (TinyURL in lanes: 10 tiles, 11 lines, chips; plus overlap, port, orthogonal
and chip invariants); a chain stays on one row; a two-way fork is centred within 1px and keeps a
swapped row order when shown that way; Cache and Links database land one column after Redirect;
the engine serves a cached layout synchronously and rejects a superseded request; `dockHint`.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 171 files, all type checks, 17 test files / 107 tests passed; the
  board adds 6).
- `pnpm test:e2e`: the first run had 3 failures, all the 5s `expect.poll` for the new project's
  URL in `createTinyUrl` on a cold start (the e2e server was seeding its two default
  "TinyURL · studio study" projects). No app code changed. The next two runs: 5 passed each.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- No browser check: nothing visible changed. The owner's dev servers on 4300/4310 were left alone.

PLAN.md's `packages/board` row describes the layout core.

Notes for LG03:

- TinyURL first layout (128×128 tiles, a 128×160 actor, 32×32 entry chips): bounds 1248×672;
  download above upload; Shorten API lands in Redirect's column (network simplex shortens edges).
- The first stable relayout (`LONGEST_PATH_SOURCE`) is not a fixed point: on TinyURL it moves
  Shorten API and URL reputation API one column left and moves rows off the 32px grid (CDN and
  Redirect y 192 → 184, the actor 256 → 296). automation-illustrator behaves the same and does not snap ELK
  output. The engine caches by key, so an unchanged graph never relays out.
- `useBoardLayout` should pass the shown layout's positions plus `hints` as `previous`; new tiles
  without either are docked by `buildElkGraph`. The React hook can use `layoutDelta`,
  `SNAP_PX`, `MODEST_MAX_PX` and `ANIMATE_MS` from `animate.ts`.
- `packages/board/tsconfig.json` has the DOM lib already; LG03 adds JSX (and `.test.tsx` to
  `vitest.config.ts` includes).

## 2026-11-04 — LG03: board React layer (complete)

`@jeeves/board` has React 19.2.8, React DOM 19.2.8 and `@xyflow/react` 12.11.6 as peer and dev
dependencies, plus dev `@types/react` 19.2.18, `@types/react-dom` 19.2.7,
`@testing-library/react` 16.3.3 and `jsdom` 29.1.1 (the web app's versions). React, React DOM
and the patched React Flow in `packages/board/node_modules` have the same real paths as the web
app's, so there is one copy of each. `tsconfig.json` adds `DOM.Iterable` and `jsx: react-jsx`;
`src/react/css.d.ts` declares `*.css` because TypeScript 7 checks side-effect imports.
`vitest.config.ts` includes `.test.tsx`; the React test opts into jsdom with a
`@vitest-environment` comment, and the other board tests stay in node.

New `src/react/`, exported from the package root (`@jeeves/board`). Ported from
automation-illustrator 0803c4a:

- `Board.tsx` (`Board.tsx`, `controls/PathHostFrame.tsx`). Props as in the unit text plus
  `ref` (`BoardHandle { fit() }`, React 19 ref prop). Exported types: `TileSpec`, `LineSpec`
  (with an optional `label`, the line's accessible name, never drawn), `BoardSelection`,
  `BoardMode`, `TileShape`. React Flow has no dragging, connecting or deleting. Dragging the
  paper pans, and the wheel uses automation-illustrator's handler: 1.08 per notch, stops at
  0.72 × fit, and zooming in on empty paper aims at the graph. Pinch zoom-out has the same floor.
  It also has `snapGrid` [32, 32], zoom 0.2–2.5 and 32px dots. The first non-empty layout gets
  one camera: a fit, or a sole tile centred at the current zoom. The board stays covered until
  then. The root is `.board` with
  `data-layout="initial|updating|ready"`, `data-board="loading|ready"`, `data-mode` and
  `data-layout-error`. Each tile is a `.board-tile` frame (`data-shape` rect radius 14, pill
  radius 32, a 4px selection ring) holding the caller's `content`. Tiles are React Flow nodes
  with role `group` and `aria-label` = `label`. Lines are role `group` too, named by `label` or
  by React Flow's default "Edge from a to b". In hand mode, tiles and lines let the pointer
  through, so every drag pans and clicks select or clear nothing.
- `BoardLine.tsx` (`routing/FlowArrow.tsx`): ELK route or the orthogonal fallback, 2.75px
  (4px selected), dashed as world-locked `polylineDrawSegments` over a transparent hit path,
  44px hit band, chip `<button class="board-chip">` at its ELK rect; clicking the line or chip
  selects it.
- `useBoardLayout.ts` (`useLaneLayout.ts`): the stability hints are the last layout's positions
  plus `hints` for tiles that have none. Shown positions win.
- `useAnimatedLayout.ts`, `camera.ts` (`firstLayoutCamera.ts`, `zoom.ts`) and `context.ts`
  (`LaneLayoutContext.ts`).
- `board.css`: `--board-line`, `--board-ink`, `--board-tile`, `--board-select`, `--board-plus`,
  `--board-dash`, plus `--board-paper`, `--board-dot`, `--board-shadow` and the custom grab
  cursors, all with automation-illustrator's light values. They are defined on `:where(.board)`
  (zero specificity).

Departures, all small:

- A fit never zooms in past 100% (`FIT_MAX_ZOOM` 1). automation-illustrator allows 2.5.
- The wheel and pinch floor uses the board's own fit zoom (`viewportToFitRect`), not React
  Flow's `getViewportForBounds`.
- The React Flow attribution stays visible, as in the current studio. Hiding it logs a dev warning.
- Each node declares static `handles` (west and east, mid-height) next to hidden `<Handle>`s, so
  lines draw before React Flow measures a tile (and in jsdom, where it never does).
- A tile with no shown position is drawn at its `hints` position. Without a hint, it and its
  lines stay hidden until ELK places it.
- Selection is controlled through the callbacks only; React Flow's own selection state is unused.

Test (`src/react/board.test.tsx`, 1, jsdom, fake `ElkLike` with fixed geometry): 3 tiles at
their ELK positions, the solid line follows its ELK route with no dashes, the dashed line draws
dash segments, the board leaves the cover after the first camera, clicking a tile calls
`onSelectTile` and clicking a chip calls `onSelectLine`.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 181 files, all type checks, 18 test files / 108 tests passed; the
  board adds 1).
- `pnpm test:e2e`: the first run had 1 failure, the same cold-start 5s `expect.poll` for the new
  project's URL as in LG02 (`edit-history`). The next two runs: 5 passed each. The likely cause:
  LG02 and LG03 both changed `pnpm-lock.yaml`, which invalidates Vite's dependency cache, so the
  first page load after the change waits for Vite to re-optimize.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- The app shows nothing new. As an extra check I loaded the board in a throwaway Vite page (not
  committed; removed, and its server on 4399 stopped) in Chromium with bundled ELK and TinyURL's lane
  geometry (10 tiles, 11 lines, 3 dashed, 2 chips). It renders. Tile, line, chip and paper clicks
  select or clear. Drag pans. The wheel zooms by 1.08 a notch and stops at 0.72 × fit. Fit
  refits. Hand mode pans from a tile without selecting. Adding a tile relays out and animates.
  No console errors or warnings. Fit zoom with the board at full window width: 0.78 at 1440×900,
  0.69 at 1280×800. The owner's dev servers on 4300/4310 were left alone.

PLAN.md's `packages/board` row describes the React layer.

Notes for LG04:

- `@jeeves/spec` must import only `@jeeves/board/graph`; the package root now pulls in React,
  React Flow and CSS.

Notes for LG07:

- Create one engine (`createLayoutEngine(elk, …)`) per app, not per render, or the cache is lost.
  The Fit button calls `boardRef.current?.fit()`. `.board` fills its parent, which needs a height.
- Map `--board-*` in `canvas.css` on `.board` (light and dark); the defaults have zero specificity.
- Tile `content` is the face inside the frame (the frame draws border, radius, background, shadow
  and the selection ring). Chip `content` sits inside a `<button>`, so keep it phrasing content (an
  icon). Board.tsx imports `@xyflow/react/dist/base.css` itself.
- E2E: query tiles with `getByRole("group", { name, exact: true })`. Line names that contain tile
  names match without `exact`.
- Fit uses automation-illustrator's padding (`FIT_PADDING` 0.28 per side), the main lever on the
  ≥ 0.75 target. With the rails open the zoom will be below the full-width figures above.
- Look: Redirect's dashed line to Click events shares its first trunk segment with Redirect's
  solid fan (one east port, `mergeEdges`), so it looks solid there. A new tile appears at its
  final slot at once while the others animate. LG09's dock hint draws it at its slot before ELK
  lands.

## 2026-11-04 — LG04: lane model in the spec (complete)

`@jeeves/spec` depends on `@jeeves/board` (`workspace:*`) and imports only `@jeeves/board/graph`.
A Biome override on `packages/spec/**` (`noRestrictedImports`, `paths`) rejects the bare
`@jeeves/board` import; I checked that it fires on the root and not on `/graph`.

- Model (`studio-model.ts`): `studioLanes`, `studioLaneSchema`, `studioEntrySchema` and the
  optional `architecture.studio.entries: [{id, lane, element}]` (unique IDs). `designIds` yields
  entries (type `entry`), so they share the design's ID space; DUPLICATE_ID messages use
  `designIdNouns` ("a lane entry"). `validateStudio` reports an entry to a missing element
  (UNKNOWN_REFERENCE), and `pruneStudioAfterDelete` (so `removeElement` and `delete`) removes
  the entries of a removed element.
- `studio-tiles.ts`: `studioTileTypes`, `studioTileDefinitions` (name, picker icon, shape
  `rect|pill`, kinds with the default first), `tileTypeOf(kind)` (browser: none) and
  `defaultKind(type, { after })` (Service after a queue → worker). The cache icon is `bolt`;
  every kind's icon is now distinct.
- `studio-links.ts`: `studioLinkDefaults(source, target, "sync" | "async")` returns
  `{ ok: true, value }` (the old `kindConnectionDefaults` output, plus calls/Asynchronous for the
  async column) or `{ ok: false, message }` in plain words ("A cache can't link onward.").
  "Application" is the Service and API kinds except cdn, so `browser` takes no links at all.
  Also `studioEntryKinds` and `laneLimits = { entriesPerLane: 3, outgoingLinks: 4 }`.
- `studio-lanes.ts`: `LANE_ACTOR = "@actor"`; `laneGraph(design)` → `{ nodes: {id, kind?}[],
  edges: {id, source, target, async, dashed, lane?}[] }` (actor, download BFS, upload BFS, then
  unreachable tiles; edges: entries, then each node's connections in node order; links to missing
  elements are dropped). `laneRules(kindOf)` is the board `Rules` (root, `canLink` from the
  entry kinds and link table, `maxOut` 4) plus `refusal()` for the message. `laneFindings(design)`
  runs `checkGraph` with it and adds the per-lane entry cap. It reports unreachable tiles, cycles,
  refused links and entries, a pair linked twice (including an element entered twice, in either
  lane), and both caps, all as `LANE_INVALID` (new, structural error). Duplicate IDs, missing
  references and self-links are left to the existing validation. Not called from
  `validateStudio` (LG06).
- Blueprint: `entries: [{lane, element}]`, sorted by lane then element. An entry whose element is
  outside the blueprint is `omitted` (kind `entry`). Still `blueprint: 1`.
- Web: `kindConnectionDefaults` is gone. `connectionDefaults` and spawn's `defaultsFor` call
  `studioLinkDefaults` with `canvasLinkMode` (async when a queue is involved, as before).

Departure: on the current C1/C2/C3 canvas the TinyURL Web app (browser) now offers no spawn
choices ("No new box fits on this side"), and connecting to or from it is refused, because the
plan's link table has no browser. Every other pair builds the same connection as before. LG06
removes the Web app from the study.

Tests (`studio-lanes.test.ts`, 7): the whole 15×15×2 link table against the plan; link defaults
and refusal wording; tile types (every kind but browser once, distinct icons, defaults) and entry
kinds; entries in the model (DUPLICATE_ID, UNKNOWN_REFERENCE, pruned on delete, blueprint);
`laneGraph` order and dashing on TinyURL in lanes (3 dashed, solid again once the worker is also
reached by a request); `laneFindings` (unreachable, cycle, refused link and entry, both caps);
`laneRules` with the board's `addAfter`. The fixture is TinyURL with the Web app deleted and
entries download → CDN, upload → Shorten API.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 185 files, all type checks, 19 test files / 115 tests passed).
- `pnpm test:e2e`: the first run had 2 failures, the known cold start (the 5s project-URL poll,
  and the Create project button detaching during the first load) after this unit's lockfile
  change. The next two runs: 5 passed each.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser (own server and web on 4311/4301 against `jeeves_e2e`, stopped afterwards; the owner's
  4300/4310 left alone): TinyURL renders at C1 (4 nodes, 3 lines), C2 (12, 11) and C3 (21, 17).
  The spawn picker shows Cache with the bolt icon; the Link cache card keeps its shape icon
  (`stack-2`). Spawning a Cache from Shorten API by mouse gives revision 2 and a uses-database,
  Redis, Request / response connection. The Web app picker is empty as described above. No page
  errors.

Docs: CATALOG (tile types; lanes and the link table with the caps), the blueprint doc
(`entries`, `entry` omissions), studio settings (lane entries), PLAN (data model).

Notes for LG05:

- Use `laneRules(kindOf)` with the board edits. For a tile an edit adds, `kindOf` must answer
  for its new ID, e.g. `(id) => (id === newId ? kind : kinds.get(id))`, with `kinds` taken from
  `laneGraph(design).nodes`. `refusal(source, target, async)` gives the plain-words reason for a
  refused-link result. `checkGraph`'s `maxOut` skips the root, so check `entriesPerLane` yourself
  (or run `laneFindings` on the result).
- `applyOperations` does not reject lane violations until LG06 wires `laneFindings` into
  `validateStudio`. Lane commands should check (`laneFindings` on the dry-run result, or the
  board edit results) and throw with the message themselves.
- `studioLinkDefaults(...).value` is ready to spread into a `StudioConnectionCreation`
  (`{ id, from, to, ...value }`). A replaced link keeps its mode: read it from
  `planned.interaction === "Asynchronous"`.
- `laneGraph` edges carry `lane` only on entries. Entry IDs share the design's ID space, so a new
  entry's ID must be free like any other.
- An element can be an entry only once (a second entry, even in the other lane, is a duplicate
  pair on the board). If the owner wants one tile in both lanes, that is a later decision.
- An existing connection whose interaction is edited to Asynchronous where the table has no async
  mode (for example application → database) will be `LANE_INVALID` once LG06 enforces the rules.

## 2026-11-04 — LG05: lane commands in the spec (complete)

New `packages/spec/src/studio-lane-commands.ts`; its five schemas join `studioCommandSchema`, and
`buildStudioCommand` hands them to `buildLaneCommand(draft, studio, input)`. Each command checks
the board edit (`addAfter`, `insertBefore`, `link`, `planRemoval`/`applyRemoval`, `removeEdge`)
under `laneRules`, with its own plain-words checks first so a refusal names tiles, not IDs. A
refusal is thrown as an `Error` (as the other commands do). A command first refuses a design that
already breaks a lane rule ("Fix the lanes first. …"), and finally runs `laneFindings` on the
result, which also covers the entry cap.

- `addTile { from: {lane}|{tile}, side, link, tile: {id, name, kind, description?}, linkId,
  system? }`. A lane is `after` and `sync` only and makes an entry. A new resource is owned by
  the `from` tile when that is an application (a queue without one is refused). `before` moves
  every entry and connection into the host to the new tile: an entry keeps its ID, lane and
  place; a connection is a `disconnect` plus a `connect` with the same ID, its mode and the link
  table's defaults for the new target (it moves to the end of `connections`). Module links and
  Redirect lookups that traced the moved connection are pruned, as for any removed connection.
- `linkTiles { from, to, link, linkId }`. A second entry for a tile, even in the other lane, is
  refused: "CDN already starts the download lane; a tile can start only one lane."
- `removeTile { tile, alsoRemove? }`. `alsoRemove` must equal the strands exactly. Restitched
  connections get `source-target` IDs and restitched entries `lane-target` (`-2`, `-3`… if taken,
  shortened to 63 characters); an entry restitch takes the removed entry's place and lane. The
  tile and its strands are `removeElement` ops; `pruneStudioAfterDelete` clears modules, links,
  entries, package memberships, CDN origin, servedBy and lookups. A surviving resource whose
  owner went (or whose owner package dissolved) passes to the first application that links to
  it; a queue falls back to its first consumer.
- `removeLink { link }`: a connection or an entry; refused, naming the tiles, if that strands any.
- `changeKind { element, kind }`: same tile type only. Fresh `createStudioSettings` and definition
  ref, `updateElement` when the classification changes (gateway ↔ CDN). Refused when a link or
  entry no longer fits, when a non-application would keep modules, or when another module's link
  to the tile no longer fits its targets (Links database → search: "ID generator in Shorten API
  can't use a search index; …"). Cleared: a CDN origin or servedBy that needs an application, a
  Redirect lookup that needs the old kind; a non-application leaves its packages.
- Helpers: `laneChoices(design, from, side, mode)` → `{type, kind}[]` (the default kind, else the
  type's first kind the rules accept; Service after a queue → worker); `laneTabs(design, nodeKey)`
  → `{from, side, mode}[]` with at least one choice (the actor gets one `after`/`sync` tab per
  lane); `planRemoveTile(design, id)` → `{ok, value: {strands}}` or `{ok: false, message}`.
- Moved, unchanged: `pruneStudioAfterDelete` to `studio-prune.ts` (so the lane module can use it
  without an import cycle; `apply.ts` imports it from there, the package index exports it).
  `studioKindNoun` is now exported from `studio-links.ts`.

Departures: `addTile` takes an optional `system`, like `create`, so a new project's first tile
can create the system. `laneChoices` takes `from: {lane}|{tile}` instead of a node key, because
the actor's choices depend on the lane's cap; `laneTabs` returns tabs in that shape, so a tab can
be passed straight on. No cap was raised.

Tests (`studio-lane-commands.test.ts`, 7; each accepted command is applied with
`applyOperations` and leaves no `laneFindings`): add after (a queue, owned, publish), before an
entry tile and before a tile with two incoming links, from a lane, and the first tile of an empty
project; refusals for add (cache onward, before the user, worker entry, taken ID, 4 links,
3 entries); a merge, an entry merge, and refused loop, duplicate, async-to-database and
second-lane links; removing the CDN restitches `download-redirect`, removing the queue gives an
async call, `removeLink` and its strand refusal; removing Redirect needs exactly its three strands
and hands Link cache to Shorten API; `changeKind` accepted (redirect → service) and refused
(entry → worker, other type, module link, same kind); `laneChoices` and `laneTabs` after a
queue, on a cache, for a lane and the actor.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 188 files, all type checks, 20 test files / 122 tests passed).
- `pnpm test:e2e`: 5 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- No browser check: nothing in the app uses the lane commands yet. The chat tool schema now lists
  them (it is built from `studioCommandSchema`), but the instructions don't mention them (LG12).

Docs: CATALOG (lane commands table), PLAN (studio commands).

Notes for LG06:

- Lane commands refuse any design with a `LANE_INVALID` finding, so they only work on TinyURL
  once it is in lanes. The fixture `tinyurlInLanes()` is in both `studio-lanes.test.ts` and
  `studio-lane-commands.test.ts`; replace both with the rewritten study.
- Once `validateStudio` reports `laneFindings`, the final `laneFindings` check in
  `buildLaneCommand` is redundant with `applyOperations` but still gives the plain message before
  the batch is sent; keep it.
- Removing the Web app is a plain `delete`; the restitch logic is only in `removeTile`.

Notes for LG09–LG12:

- `laneTabs(design, LANE_ACTOR)` gives `{ from: { lane } }` tabs; pass a tab's `from`, `side`
  and `mode` to `laneChoices`, then `addTile` with the chosen `kind`. A drop on a tile is
  `linkTiles`; on the left side the canvas must decide the direction (tile → host).
- `planRemoveTile` gives the strands for the confirmation; send them as `alsoRemove`.
- Inserting before a tile resets the moved connections' labels and settings to the defaults and
  drops module links that traced them (readiness gaps, not errors).

## 2026-11-04 — LG06: TinyURL in lanes, lane rules enforced, pre-lane projects deleted (complete)

Study (`studio-examples/tinyurl.ts`, now `studio-tinyurl@2.0.0`; nothing pinned `1.0.0`): the Web
app element and its `web-shorten` connection, every C1 node and relationship (Link creator,
Visitor and `url-reputation`, the C1 mirror of the URL reputation API element) and the Link
platform package are gone; `system` stays. New entries `download-cdn` (download → CDN) and
`upload-shorten-api` (upload → Shorten API), named like LG05's `lane-target` restitches. The
nine elements, nine connections, eleven modules and fifteen module links are unchanged.
`createStudioStudy` takes `entries`, and C1 nodes and relationships are optional. Lane graph:
10 nodes, 11 edges, 3 dashed. No cap was hit or raised.

Validation: `validateStudio` ends with `laneFindings(design)`, so `applyOperations` rejects any
batch that leaves a lane rule broken, from the canvas, chat or the API. One refinement in
`laneFindings`: an element with no studio settings is no longer also reported as unreachable
(`applyOperations` returns studio errors first, which hid validateDesign's clearer
`CONFIG_INVALID` "has no studio settings").

On the old canvas (accepted by the plan): New island, the first-box panel, Library Add and the
Service and worker preset at C2/C3 are refused with the notice "Change not saved: Microservice
can't be reached from the user; every tile hangs off a lane." So is a west `+` that makes a box
nothing reaches; east `+` spawns that keep the rules still work, and C1 people and external
systems are still added. A Blank architecture project can't get its first box on the old canvas.
Chat could only start one with `addTile` (its schema lists it; the instructions don't until LG12).
The `create` command still builds the island batch; apply refuses it.

Tests: both `tinyurlInLanes()` fixtures are now the study itself (`upload-shorten` became
`upload-shorten-api`). Tests that used the Web app, `web-shorten`, the package, C1 people or
`create` islands now use live IDs, build their own package, link new boxes to an existing tile,
or start from the upload lane with `addTile` (`serviceOps` in `apps/web/src/test-api.ts`,
`service()` in `projects.test.ts`, the chat test's commands). New assertions: removing the CDN
with no other download entry is rejected (4 × `LANE_INVALID`); removing Redirect also strands the
click path; a `create` first box is refused while `addTile` starts a design through chat. The web
studio test's "packages carry no handles" check now builds a package (it would have passed
vacuously).

Deleted (owner decision L12, one-time exception): through the owner's running API on 4310 (the
`jeeves` database), `GET /projects` listed one project, "TinyURL · studio study"
`7d19609c-7824-484e-b184-f34b2ccdf01a` (revision 1); `DELETE /projects/7d19609c-…` returned 204.
Nothing else in `jeeves` or `~/.jeeves/` was touched, and the owner's 4300/4310 servers were left
running (tsx watch had already reloaded the API with this unit's code). `jeeves_e2e` (2
auto-created projects) was dropped with `docker compose exec -T postgres psql -U jeeves -d
postgres -c "DROP DATABASE jeeves_e2e"`; the E2E server recreated it. Fresh-install check: a
fresh headless browser on 4300 created "TinyURL · studio study"
`41bbd268-9244-47cc-be63-66c5e61d116c` in `jeeves` (9 elements, entries download → `cdn` and
upload → `shorten-api`, origin `studio-tinyurl@2.0.0`, no C1 nodes, no packages; blueprint with
3 services, no findings, nothing omitted; no page errors). It is the owner's default project now
and was left in place, at revision 1.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 188 files, all type checks, 20 test files / 122 tests passed).
- `pnpm test:e2e`: first run 4 passed, 1 failed: `spawn` released its drag on Link cache (the C2
  layout moved), which opened Connect instead of the picker. The release point moved to
  handle +170/−200 (empty canvas above Link cache); the next run passed 5/5. Level counts are now
  C1 1/0, C2 8/8, C3 20/16; the blueprint services are `analytics, redirect, shorten-api`; spawn
  expects 9 boxes and 9 lines.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser: on the owner's 4300 (read-only after the auto-create), TinyURL renders at C1 (1 node),
  C2 (8, 8 lines) and C3 (20, 16); Fit zoom at 1440×900 is C2 0.89 with chat open, C3 0.43 open
  and 0.55 closed. On my own servers (4311/4301 against `jeeves_e2e`, stopped afterwards): a new
  study made through the project menu by mouse, then New island → Microservice gave the error
  notice above, the revision stayed 1 and the box count 8; no page errors; that project was
  deleted.

Docs: the studio guide (TinyURL section in lanes, the lane rules under Creating and connecting,
New island and Library refusals, C3 fit zoom, Limits), the blueprint doc (new Example section
with the TinyURL head, entries and two connections), CATALOG (lane rules enforced, the preset is
refused, study `2.0.0`), studio settings (entries, preset), PLAN (validation includes the lane
rules).

Notes for LG07:

- `laneGraph(tinyurl)` nodes in order: `@actor`, `cdn`, `redirect`, `link-cache`, `links-db`,
  `click-events`, `analytics`, `analytics-store`, `shorten-api`, `reputation`. Edges: the two
  entries, then each node's connections; dashed: `redirect-clicks`, `click-events-analytics`,
  `analytics-write`. That is the canvas spec's 10 tiles, 11 lines, 3 dashed.
- Every project in `jeeves` and `jeeves_e2e` is lane-valid now, and every accepted edit keeps it
  so. Expect most old-canvas creation paths to be refused until the lane canvas replaces them;
  inspector edits, renames, module edits and chat renames work as before.
- `jeeves_e2e` holds one auto-created lane-form TinyURL from the first E2E run; the E2E helpers
  still create their own project per test.
- The study's C1 is just the system and the canvas will not show C1, so nothing on the lane
  canvas needs C1 context. Packages remain in the format; the study has none.

## 2026-11-04 — LG07: the lane canvas replaces the studio canvas (complete)

The Design tab now shows the lane canvas, read-only. `@jeeves/web` depends on `@jeeves/board`
(`workspace:*`). New `apps/web/src/canvas/`:

- `elk.ts` (ported `elkClient.ts`): the resilient ELK (elkjs Web Worker through `?url`, falling
  back to `elk.bundled.js` on the main thread, which is what jsdom unit tests get) behind the app's
  one `layoutEngine`. No export engine.
- `tiles/human-figure.svg`, `svgInner.ts`, `HumanFigure.tsx` (ported; no head crop or
  accessories). `tiles/ActorTile.tsx`: 128×160, the figure on automation-illustrator's empty-actor
  pastel with a "User" name plate (ActorColumn proportions). `tiles/Tile.tsx`: 128×128, the kind's
  icon (40px, `StudioIcon`) in its `data-family` colour and the name in up to two lines (StepTile
  task-card proportions: icon pinned 22px from the top); `tileShape(kind)` from the tile types.
- `LaneCanvas.tsx`: `laneGraph` → `<Board>`: actor and tiles; entries and connections as lines,
  dashed per `edge.dashed`; entry chips 32×32 with `IconDownload`/`IconUpload`. Accessible names:
  tiles by name (the actor is "User"); lines "Redirect service to Link cache", entries "Download
  lane: User to CDN".
- `canvas.css`: `--board-*` mapped to the theme tokens on `.board` (they follow `data-theme`, so
  light and dark come from the tokens), the actor pastel and figure ink per theme, the tile and
  actor faces, the inspector heading, and a transparent React Flow attribution (it was a light box
  on dark paper).
- `Workspace.tsx` (mounted by `DesignView` instead of `StudioWorkspace`; no outer
  `ReactFlowProvider`, the board has its own): Undo, Redo and the chat and inspector toggles in the
  header; Select, Hand and Fit (`IconFocusCentered`, name "Fit") on the canvas toolbar; V/H
  shortcuts; the chat rail; notices and draft feedback. Selection is `{tile}` or `{line}`; a
  selection that no longer exists falls back to none. Selecting a tile or line opens the
  inspector. The inspector shows a tile (icon, name, kind name, then `TargetInspector`), a
  connection ("A → B" and `ConnectionForm`), an entry (lane icon and name, then "User → target" as
  buttons that select those tiles), or for the actor and no selection the system's Name and Goal.
  `architectureSelection` (sent with chat) is the selected element, connection or entry ID.
- `RailResize.tsx`: moved out of `StudioWorkspace.tsx` (which now imports it).

`studio/InspectorForm.tsx`: `TargetForm` takes `target: StudioSemanticRef` and optional `actions`
(node, `onElement`, `onCreate`). The old node-based `InspectorForm` passes `actions`, so the old
canvas keeps its package, membership, dependency and Disconnect actions. The new
`TargetInspector({ projectId, element?, label, design, onConnection })` passes none: General,
Options and Connections only, Connections rows select the line, no Disconnect, and no Connections
tab for an application without links. The system's description is labelled **Goal**.

E2E: `studio.ts` helpers are `ready` (`.board[data-layout="ready"][data-board="ready"]`), `tiles`,
`lines`, `dashedLines` (`.react-flow__edge-path.is-dashed`) and `tile(page, name)`
(`getByRole("group", { name, exact: true })` inside `.board`); `design()` types the element
settings. `canvas.spec.ts` replaces `studio-levels` (10 tiles, 11 lines, 3 dashed, the User tile,
2 chips). `edit-history` edits Shorten API's request timeout 3000 → 4500 (autosave, undo, redo,
reload). `blueprint-chat` uses `tile`. `spawn.spec.ts` is removed (LG09 brings it back).

Departures, all small: the human figure's port comment sits inside `<svg>` and the source SVG has
`aria-hidden="true"` (Biome's `noSvgWithoutTitle`; `svgInner` drops the outer tag and a `<title>`
would become a tooltip). `ready` also waits for `data-board="ready"` (the camera has landed). The
selection is not kept in the URL; the old `studioScope`/`studioTarget` parameters are ignored. No
cap was hit or raised; `FIT_PADDING` is unchanged.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 197 files, all type checks, 20 test files / 122 tests passed;
  `App.test` mounts the new workspace on an empty design).
- `pnpm test:e2e`: 4 passed, first run, despite this unit's lockfile change; 4 passed again after
  the last CSS and doc edits.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory; the old layout worker
  is no longer in the bundle).
- Browser (Playwright Chromium by mouse, my own API on 4312 and web on 4302 against `jeeves_e2e`,
  both stopped afterwards; the owner's 4300/4310 and the `jeeves` database untouched): a TinyURL
  study made through the project menu shows 10 tiles, 11 lines, 3 dashed and 2 chips, with no
  console errors or warnings. Fit zoom: **0.78** at 1440×900 with the chat rail closed (target
  ≥ 0.75 met), 0.61 with it open; 0.69 closed and 0.53 open at 1280×800. Clicking Redirect
  service, an entry chip, the User, the Click events → Analytics worker line and empty paper
  selects each and shows the matching inspector. Switching Shorten API → URL reputation API to
  Asynchronous in its form saves revision 2 and dashes that line (4 dashed); Undo restores 3. Hand
  mode pans from a tile and selects nothing. A Blank architecture project shows only the User,
  centred. Both throwaway projects were deleted.
- What I saw (1440×900 and 1280×800, light and dark): the board reads cleanly. The user sits left
  with the two entry chips on its fork, download above and upload below; CDN → Redirect service on
  the download row, Shorten API below; the click path runs dashed along the top row. Redirect's
  dashed line to Click events shares Redirect's first short stretch with its solid lines, and the
  solid lines cover it there, so the dash starts exactly where it forks upward; it reads well, so I
  left it. The weak spot is the bus: Redirect service and Shorten API both reach Link cache and
  Links database, so ELK merges both fans into one vertical bus, and the lines alone don't show
  that only Redirect reaches Click events and only Shorten API reaches the URL reputation API
  (selecting a line shows it). That is the ported layout's merge behaviour (`mergeEdges`); I
  recorded it in the studio guide's Limits rather than change board options. With the chat rail
  open, names are small (0.61 zoom) but legible; at 1280 with chat open (0.53) they are hard to
  read. Opening the inspector does not refit.

Docs: the studio guide (new The lane canvas, Layout and navigation, Creating and connecting
(read-only plus the lane rules), Inspector, History, the TinyURL table as tiles and modules,
Limits), PLAN (intro, `apps/web` and `packages/board` rows, Layout), README (first paragraph and
the studio link), AGENTS (verification step 4), CATALOG (C1 context is not shown, tile types not
yet creatable by mouse, the preset is offered to chat).

Notes for LG08:

- Unreachable now: `studio/StudioWorkspace.tsx` and what only it uses (`StudioGraph`, layout,
  worker, client, `use-layout`, `use-settle`, routing, spawn, creation, Library,
  `ConnectionCreator`, `MembershipActions`, `DependencyActions`, `card-appearance`). Remove
  `TargetForm`'s `actions` prop and the node-based `InspectorForm` wrapper with them.
- **Keep `ComponentForm`/`ComponentDraftForm`** in `InspectorForm.tsx`: only the old wrapper
  reaches them now, but LG11's Modules list opens them.
- `TargetInspector`, `inspectorSpec` and `ConnectionForm`'s `RelationshipTarget` use
  `StudioSemanticRef` from `studio-view.ts`. When that file goes, move the ref type (or a narrower
  `{kind: "system"} | {kind: "element", id}`) next to `inspectorSpec`. The new canvas only uses
  `{kind: "connection"}` targets.
- `studio.css` rules the workspace still uses: `.studio-app-header`, `#studio-header-controls`,
  `.studio-header-actions`, `.studio-workspace`, `.studio-rail*`, `.studio-center`,
  `.studio-tools`, `.studio-notice`, `.studio-draft-feedback`, `.studio-selection-summary`,
  `.studio-inspector-tabs`, `.studio-inspector-form`, `.studio-form-field`, `.studio-field-error`,
  `.studio-field-help`, `.studio-dependencies`, `.studio-dependency-row` and the focus rule; LG11
  needs `.studio-component-meta`, `.studio-readiness`, `.studio-membership` and `.studio-danger`.
- `preferences.ts` still carries `scope` and `cameras` (unused); `DesignView` still calls
  `flushLayout` on `pagehide`.

Notes for LG09:

- Plan §4's empty project has the actor selected with its two lane tabs; today it is only centred.
- `Workspace.select({ tile })` is where `onPick` should land the new tile; `LaneCanvas` passes no
  `hints` yet. The chat rail's suggestion "Add a web app that calls the selected service" is stale
  (no browser tile); that is LG12's.

## 2026-11-04 — LG08: the old studio canvas removed (complete)

Removal and rename only; the app looks and behaves as after LG07. About 7,000 lines went
(60 files, +243/−7,287 before this entry).

Deleted (about 5,850 lines in 20 files): `apps/web/src/studio/` `StudioWorkspace`, `StudioGraph`,
`layout`, `layout.worker`, `layout-client`, `use-layout`, `use-settle`, `routing`, `spawn`,
`creation`, `StudioLibrary`, `ConnectionCreator`, `MembershipActions`, `DependencyActions`,
`card-appearance`, `text` (only routing and card-appearance used it) and `studio.test.ts` (all of
it tested the old layout, routing and spawn); `packages/spec/src/` `studio-view.ts`,
`studio-relationships.ts` and `studio-view.test.ts`. Its two `designBlueprint` tests were not
canvas tests, so they moved unchanged to `studio-blueprint.test.ts`. Also gone: `pruneLayout` and
the `StudioLayoutView` type (`layout.ts` keeps `layoutSchema`, `LayoutDocument` and `emptyLayout`
for the server), `studioVisual`/`studioNeutralVisual`, `instantiateStudioPackagePreset` and
`StudioServiceWorkerIds` (chat only lists and resolves the preset), the study's `layout` result,
`TargetForm`'s `actions` prop and the node-based `InspectorForm` wrapper, `actions.ts`'s
connection defaults and `ConnectionDraft`, the eight `StudioIcon` names only the old canvas drew
(`shield`, `repeat`, `plug-connected`, `puzzle`, `user`, `building`, `settings`, `activity`),
about 500 lines of `studio.css` and the dead rules at the top of `design-view.css`.

Store (`project/store.ts`, 585 → 314 lines): no layout read on open, no layout PUTs (nor from
`createExampleProject`), no row-order steps. With only design steps left, the local
chronological stack shadowed the server's history, so it went too: `canUndo`/`canRedo` read
`loaded.history`, and Undo/Redo/`undoEdit` call the server. The one behaviour that changes is a
multi-tab edge: after an edit here, a redo chain made by another tab is no longer blocked.
`open` sets `loading` synchronously (it used to await `flushLayout` first), so StrictMode's second
effect sees `loading` and does not open twice. `createPlaced` is now `commit(projectId, rebuild)`
("placement" is gone). The API client lost `getLayout`/`putLayout`; the fake API lost its layout
routes and call log.

Narrowed: the tile inspector's target is `InspectorTarget = {kind: "system"} | {kind: "element",
id}` in `inspector-drafts.ts` (no context or package branches; `StudioSemanticRef` is gone), and
`ConnectionForm` takes `connection: string` (no C1 relationship branch). `preferences.ts` keeps
only the rails' open state and widths (same `jeeves.studio.ui.v1:<project>` key).

Renamed: `useDraw` → `useProject` (`DrawState` → `ProjectState`), the `draw` view → `design`
(`#/design`; an old `#/draw` link falls back to Design), `.draw-loading` → `.view-loading` (moved
to `tokens.css`, since Settings uses it too).

Reachability pass (my script over `git ls-files`: web, server and test entry points, then every
`export` searched across the repo): no unreached source files except `vite-env.d.ts` and the
board's `css.d.ts` (ambient types); no unused CSS classes in `apps/web` or `packages/board`.
Removed while at it, unreferenced before this unit: the board's `polylineKey` and `svgDashPhase`
(automation-illustrator's FlowArrow used them; BoardLine doesn't) and `formDrafts.get`. Left, as
CL4 did: schema-derived type aliases (`Endpoint`, `RelationshipInteraction`, `ConnectionKind`,
`DesignDocumentInput`, `StudioComponentTarget`, `StudioConnectionBinding`, `OperationKind`,
`EditState`, `ScriptByMessage`) and exports used only in their own file. The one deliberate
exception: `ComponentForm` (with `ComponentDraftForm`, `component-drafts.ts`, `commitAction` and
`store.commit`) is exported but not mounted, for LG11. The server's layout route, service and
table stay; PLAN says the canvas does not use them.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 178 files, all type checks, 19 test files / 109 tests passed;
  −13 tests: 5 in `studio.test.ts`, 6 view and layout tests, 2 store layout tests).
- `pnpm test:e2e`: 4 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser (Playwright Chromium by mouse; my own API on 4312 and web on 4302 against `jeeves_e2e`,
  both stopped afterwards; the owner's 4300/4310 and `jeeves` untouched, though tsx watch reloaded
  the owner's API with this code and it reports healthy): a TinyURL study made through the project
  menu shows 10 tiles, 11 lines, 3 dashed and 2 chips. Settings and back gives `#/design`.
  Redirect service opens its inspector with 4 Connections rows (one button each); a row selects
  "CDN → Redirect service" (General, Options); the download chip shows "Download lane"; the User
  shows Name and Goal. Shorten API's request timeout 3000 → 4500 saves revision 2; Undo restores
  3000 (rev 3, Redo enabled); Redo gives 4500 (rev 4, Redo disabled). Switching Shorten API → URL
  reputation API to Asynchronous dashes 4 lines; Undo gives 3. Empty paper shows the system. Fit:
  0.78 with chat and inspector closed, 0.61 with chat open (as LG07). No `/layout` request, no
  console errors or warnings. Light and dark screenshots match LG07's look. The throwaway projects
  were deleted (one from an aborted first run of my script, 204).

Docs: PLAN (diagram, `apps/web` row, data model, history, Layout, API table), studio guide
(History), studio settings (lookup shortcuts: the inspector picks an existing connection; chat's
`connect` with `lookup` creates one; the "creates one if none exists" UI went with
`DependencyActions` in LG07), CATALOG (packages are not shown), `patches/README.md` (the React
Flow patch reason and manual pass now name the lane canvas; the patch is still applied).

Notes for LG09:

- Write through `commitAction(projectId, (design) => buildStudioCommand(design, {type: "addTile",
  …}).ops)` (`studio/actions.ts`): it rebuilds against the latest design inside the store's
  request chain, dry-runs `applyOperations`, and a refusal becomes the error notice ("Change not
  saved: …"). Each accepted batch is one server undo step; there is no local history to update.
- `StudioIcon` knows the seven tile-type icons (`server`, `api`, `database`, `bolt`, `list`,
  `archive`, `plug`).
- The E2E smoke set is `canvas`, `edit-history` and `blueprint-chat` (4 tests); `spawn.spec.ts`
  comes back with LG09.

Notes for LG11: the C3 component icons were `studioComponentVisuals` in
`git show 9850e30:packages/spec/src/studio-view.ts` (lines 100–112); their `shield`, `repeat`,
`plug-connected` and `puzzle` icons were dropped from `StudioIcon` and need adding back with them.

## 2026-11-04 — LG09: spawn and link by mouse (complete)

The selected tile now shows automation-illustrator's pull tabs, and a pull adds or links a tile.

Board (`packages/board`, still no Jeeves imports):

- `react/TileChrome.tsx` (ported `TileChrome.tsx`, without tile pickup, insert silhouette or X):
  tabs per side from props (`TabSpec`: `side` after/before, `glyph` plus/dash, label, title,
  optional `badge` and `order`, fan `items`). A pull uses pointer capture; past 36px the taffy band
  (ported `taffyRibbon`, `+` green with a solid outline, `---` teal with a dashed outline), a scrim
  with a hole for the tile and the fan open; the tab ghost follows the pointer. Release on an item →
  `onPick`; on a tile `canDrop` allows → `onDrop`; on a refused tile → `onDropRefused` and spring
  back; elsewhere or Escape → a 200ms spring back to the resting tab (reduced motion: none).
  Tiles the tab may drop on are holes in the scrim (clipped to the board, so rails stay covered)
  with a faint dashed outline (`is-drop-target`); the one under the pointer gets
  automation-illustrator's 4px dashed ring (`is-drop-over`). The pull layer is portalled to
  `<body>` with class `board-overlay`, so apps theme it with the same `--board-*` variables.
- `react/fan.ts` (ported `plusPreviewLayout.ts`): `fanCenters` — N items on an arc around the
  resting tab, radius 104 + 24 per item beyond two, spread 56° per gap up to 150°.
- `react/overlay.ts` (ported `tileOverlay.ts` plus TileChrome's geometry), `react/DashGlyph.tsx`
  (ported `PathKnotIcon`, ink `currentColor`). Chrome CSS ported into `board.css` (tab size 40,
  peek 18, `--board-scrim`, `--board-plus-ink`, `--board-dash-ink`, `--board-refuse`).
- `Board.tsx`: new props `tabs`, `canDrop`, `onPick`, `onDrop`, `onDropRefused`. The chrome renders
  inside the selected tile's node (select mode, once laid out). `onPick` returns (or resolves to)
  the new tile ID; the board records a dock (source, side, port index, `order`) and, when the
  tile first appears in `tiles`, computes `newTileHint` against the positions shown at that
  moment: the hint orders it for ELK and shows it at the slot until the layout lands and animates.
- `layout/metrics.ts`: `newTileHint` — `dockHint` beside the source, or, with an `order`
  neighbour, the slot right below/above that tile; when that slot is taken the hint only orders the
  tile (half a pixel past the neighbour) and the tile waits unseen for ELK.
- `layout/elkGraph.ts`: **the first layout now uses `STABILITY_OPTIONS` too** (LONGEST_PATH_SOURCE
  layering, forced model order). Before, the first NETWORK_SIMPLEX layout put Shorten API in
  column 2 and the first add re-layered it to column 1, moving half the board.
  automation-illustrator always has stored positions, so its boards are always laid out this way.
  TinyURL now has both entries (CDN, Shorten API) in column 1; fit zooms are unchanged (0.78 / 0.61
  with chat at 1440×900, 0.69 / 0.53 at 1280×800).

Spec (`studio-lane-commands.ts`): `laneLinkRefusal(design, from, to, mode)` (the `linkTiles`
check as a pure helper, now shared with the command), `newTileIdentity(design, type)` ("Cache",
"Cache 2"… with IDs `cache`, `cache-2`, free as name and ID), `newLinkId(design, from, to,
reserved)` (`source-target`, `lane-target` for entries, as the study names them). `linkTiles`
refuses in plain words a link to the user ("Links don't lead back to the user; …") and a tile
link from the user without a lane.

Web:

- `canvas/creation.tsx`: `useLaneCreation` builds the tabs from `laneTabs` and the fan from
  `laneChoices` (tile-type icon in the resolved kind's family colour; data types round; type name
  as label and hover tip). Tab IDs `lane-download`, `after-sync`, …; labels "Download lane",
  "Upload lane", "Request after", "Async after", "Request before", "Async before". The user's tabs
  carry `LaneIcon` badges and an `order` (after the lane's last entry; a first download entry
  before the first upload entry), so download stays above upload. `onPick` picks the identity
  now, commits `addTile` through `commitAction` (with `system` when the design has no
  architecture), returns the ID, and on success selects the tile. `onDrop` commits `linkTiles`
  (left side: target → tile; lane tab: an entry) and selects the target, as automation-illustrator
  does. `onDropRefused` puts `laneLinkRefusal`'s words in the error notice.
- `Workspace.tsx`: an empty design starts with the user selected (`startsSelected`); a new tile's
  Name field is focused with its text selected; tabs only in select mode.
- `canvas.css`: `.board-overlay` gets the theme mapping; dark scrim; `.lane-fan-icon`.

Deviation (mine, for the plan's one-tab-fans-and-drops design): the fan is screen-space around
the resting tab, so it often covers the next column's tiles. Once the pointer is on a tile it
stays "on the tile" until it leaves that tile, and the fan fades and stops taking the pointer
(`data-on-tile`), so an icon over a tile can't steal a drop; on an icon, the icon wins. A drop on
the user from a tile tab is refused (it has no lane); use the user's lane tabs.

E2E: `spawn.spec.ts` is back (2 tests): Redirect's `Request after` onto the Cache icon → 11 tiles,
12 lines, Cache selected, Name focused, revision 2, `redirect → cache`; Shorten API's `Async
after` onto Click events (after Fit, since the inspector opened) → the target shows
`is-drop-over`, 4 dashed lines, a `Publishes`/Asynchronous connection. `studio.ts` gained `pull`,
`moveOnto` (both wait for a settled box) and connections in `design()`.

Tests: `fan.test.ts` (two-item arc, seven-item radius and 150° spread, left fan), `newTileHint`
(lane order with a free and a taken slot), spec helpers (one-lane rule, loop, user as target or
source, fresh names and IDs).

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 185 files, all type checks, 20 test files / 113 tests passed).
- `pnpm test:e2e`: 6 passed, first run (twice: before and after the docs and last tidy-up).
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser (Playwright Chromium driven by mouse, my own API on 4312 and web on 4302 against
  `jeeves_e2e`, both stopped afterwards; the owner's 4300/4310 and `jeeves` untouched, though tsx
  watch and Vite reloaded them with this code; every throwaway project deleted): on TinyURL,
  Redirect's right `+` → Cache (docked on Redirect's row, then the fork re-centred), Redirect's
  left `+` → Service (inserted between CDN and Redirect), Link cache's left `+` → Service (Link
  cache moved right; Undo → 10 tiles, Redo → 11), Shorten API's `---` onto Click events (4 dashed,
  publish), the user's download tab onto Shorten API (refused: "Shorten API already starts the
  upload lane; a tile can start only one lane.", revision unchanged), Escape mid-pull on CDN
  (springs back, no overlay left, revision unchanged). From **Blank architecture**: the user opens
  selected with both lane tabs; download → API, upload → Service, API `+` → Service 2, Service 2
  `+` → Cache, Service `---` → Queue, Queue `---` → Service 3 (a worker), Service `+` → Database,
  then Service 2's `+` dropped on Database (merge): two lanes, entries `download-api` and
  `upload-service`, 2 dashed lines. Light and dark; no console errors or warnings.
- Feel against the automation-illustrator frames: the tabs (green `+`, teal `---`, 40px, peeking
  18px), the thick band from under the tile, the dimmed board with the tile's hole and the dashed
  ring on a target match closely. The fan differs by design (icons only, 2–7 of them), and with 4–6
  icons at 0.4–0.8 zoom it is busier than automation-illustrator's two big previews and covers
  neighbouring tiles; the on-tile fade keeps drops reliable. The new tile shows at its dock slot
  at once (the commit is ~30ms locally) and jumps to its ELK slot while the rest animates, as in
  automation-illustrator (new tiles don't tween there either).

Docs: studio guide (Creating and connecting rewritten; Layout: column rule and first layout; the
lane canvas; Limits: removal not by mouse yet, fan and tab size at low zoom, bus note), CATALOG
(tile types offered in the fan; canvas → `addTile`/`linkTiles`, naming), PLAN (`creation.tsx`,
`TileChrome`, new helpers, layout hints).

Notes for LG10:

- The X belongs in `TileChrome` (`.board-chrome`); automation-illustrator's `.node-remove-x-btn`
  and `.tile-remove-x` rules are not ported yet. Hide it while pulling (`.board-chrome[data-pulling]`
  already hides every tab). Board renders the chrome only when `tabs?.length` (`chromeTile` in
  `Board.tsx`); widen that to "tabs or removable", or a tab-less tile gets no X.
- Lines: `BoardLine` has no X yet; a selected line's midpoint is `pointAtLength(points, length/2)`
  (used for chip fallback).
- `canvas/creation.tsx` is the place for the Jeeves side (it already has the notice and
  `commitAction` pattern); `Workspace.select` re-selects, and `liveSelection` drops a selection
  whose tile is gone.
- E2E helpers: `pull(page, tile, tab)` and `moveOnto(page, locator)`; after selecting a tile the
  inspector opens and nothing refits, so click Fit before acting on tiles at the right edge. At
  Fit with both rails open the zoom is ~0.44 and tabs are ~17px.

## 2026-11-04 — LG10: delete tiles and lines (complete)

The selected tile and the selected line now have automation-illustrator's red X.

Board (`packages/board`, still no Jeeves imports):

- `react/RemoveButton.tsx` (ported from `TileChrome.tsx`'s X button): a 40px round red button,
  45% opacity until hover or focus, Tabler's X path drawn inline. CSS ported from
  `.node-remove-x-btn`/`.tile-remove-x` into `board.css` with `--board-remove`,
  `--board-remove-active`, `--board-remove-ink`.
- `TileChrome` takes `remove?: {label, onRemove}` and draws the X centred on the tile's top edge
  (`top: -20px`, not automation-illustrator's −14px, so it clears the face's icon); it hides while
  a tab is pulled (`.board-chrome[data-pulling]`).
- `Board`: new props `removable(tile)`, `onRemoveTile`, `onRemoveLine` and `hud: {tile, content,
  marked?}`. The chrome now renders for "tabs or removable" (a tab-less tile still gets its X).
  `hud` is drawn under its tile at screen size through React Flow's `NodeToolbar` (class
  `board-hud nopan nowheel`, 18px below, ported `.remove-picker-hud` look); while it shows, that
  tile has no chrome and the `marked` tiles get a red dashed ring (`is-marked`). `pullClass` is
  now `tileClass`.
- `BoardLine`: a selected line shows the X at its midpoint (`pointAtLength(points, length/2)`), or
  for a line with a chip, 8px above the chip; the board context carries `removeLine` (select mode
  only). Its accessible name is `Remove <line label>`.
- `graph/edit.ts`: `nextTileAfterRemoval(remaining, predecessorIds, successorIds)` (ported).

Web: new `canvas/removal.tsx` (`useLaneRemoval`), next to `creation.tsx` rather than inside it; the
two hooks share nothing but `commitAction`. The X runs `planRemoveTile`; no strands →
`removeTile` at once; strands → the HUD ("Removing Redirect service also removes", each strand's
icon and name, **Cancel** and **Remove N tiles**, N = strands + 1, the confirm focused with
`preventScroll` so Enter confirms). Cancel, Escape, clicking paper or selecting anything else, or
Hand drops it. Confirm sends `removeTile` with `alsoRemove: strands` (a design that changed
meanwhile is refused by the command, not silently widened). After a tile removal
`nextTileAfterRemoval` on the new lane graph picks the selection (the first predecessor in lane
order, so the User after CDN); after a line removal nothing is selected (as automation-
illustrator's `removePath`). A line X runs `removeLink`; a refusal reaches the notice through
`commitAction` ("Change not saved: Removing the link from CDN to Redirect service would cut off
…"). `planRemoveTile` refusals go to the notice as they are. Optional Delete/Backspace in
`Workspace.tsx` does the selected tile's or line's X (ignored in inputs, selects, text areas and
contenteditable). `LaneCanvas` takes a `removal` prop beside `creation`. `canvas.css` maps the
remove colours to `--minus` and styles the HUD content.

E2E: new `remove.spec.ts` (1 test): CDN's X → 9 tiles, 10 lines, the User selected, revision 2,
CDN gone and entry `download-redirect` → `redirect`; Undo → 10 tiles, 11 lines, revision 3, the
download entry back on `cdn`. `studio.ts`'s `design()` type gained `entries`.

Tests: `nextTileAfterRemoval` (parent, then a remaining child, else none) in `graph.test.ts`.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 188 files, all type checks, 20 test files / 114 tests passed).
- `pnpm test:e2e`: 7 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser (Playwright Chromium driven by mouse at 1440×900, light and dark; my own API on 4312 and
  web on 4302 against `jeeves_e2e`, both stopped afterwards; the owner's 4300/4310 and `jeeves`
  untouched; every throwaway project deleted, one left by an aborted first run removed by
  `DELETE` → 204): TinyURL renders 10 tiles and 11 lines. The User has no X. CDN's X → 9 tiles,
  10 lines, entries `download-redirect` and `upload-shorten-api`, User selected; Undo → 10/11.
  Redirect's X → the HUD lists Click events, Analytics worker and Analytics store, 4 tiles ringed,
  no chrome, "Remove 4 tiles" focused; Cancel → nothing changed (revision unchanged), chrome back;
  Escape and a paper click also cancel; Remove 4 tiles → 6 tiles, 5 lines, CDN selected; Undo →
  10/11. Redirect → Link cache, selected from Redirect's Connections list (it shares a bus), X at
  its midpoint → 10 lines; Undo → 11. CDN → Redirect's X → refused with the notice above, revision
  unchanged. The download chip's X (above the chip) → refused ("Removing the download entry to CDN
  would cut off CDN, …"). Delete on Analytics store removes it. Hand mode shows no X. No console
  errors or warnings.
- Look: the X sits centred on the top edge, faint, full red on hover, as in automation-
  illustrator; at Fit with the inspector open (~0.5 zoom) it is about 20px. The HUD sits under the
  tile at screen size and covers the tiles below it (Shorten API and Links database under
  Redirect); the ringed tiles stay visible. On a shared bus a click picks one of the lines on it,
  so a particular bus line is best selected from its tile's Connections list (in Limits).

Docs: studio guide (new Removing section, the canvas and creating intros, Limits: X size at low
zoom, the HUD covering tiles below, selecting a bus line), CATALOG (canvas → `removeTile` /
`removeLink`), PLAN (`removal.tsx`, the board's X, `hud` and `nextTileAfterRemoval`). No cap was
hit or raised.

Notes for LG11:

- The inspector is untouched; `Workspace.Inspector` still renders `TargetInspector` for a tile.
  A type-variant row and Modules list go above/below it there.
- Removing a tile prunes its modules (`pruneStudioAfterDelete`), so Undo is the only way back to
  them; worth knowing when testing the Modules list.
- The HUD's buttons are styled in `canvas.css` (`.lane-remove-actions`); `ComponentForm`'s own
  remove button already uses `.studio-danger`.

## 2026-11-04 — LG11: inspector kind row and modules list (complete)

A tile's inspector now switches its kind and lists its modules. Modules stay off the canvas.

Spec:

- New `studio-modules.ts` (exported): `studioComponentVisuals` (each module kind's icon and colour,
  restored from `9850e30`'s `studio-view.ts`), `studioComponentTargetKind` (moved out of the lane
  commands, where it was `componentTarget`), `moduleKinds(design, host)` (the ten kinds for an
  application, the client-safe ones for a browser app, none otherwise), `newModuleIdentity(design,
  host, kind)` ("Data access", then "Data access 2" within the host; ID `shorten-api-data-access`,
  free across the design) and `moduleLinkChoices(design, component)` → `{element, via, id}[]`:
  each tile the host links to or from whose kind the module may use, through that connection
  (publisher/consumer only through a publish/consume link), minus links it already has.
- New internal `studio-ids.ts` (not in the index): `usedIds`, `freshId` and `slug`, moved out of
  `studio-lane-commands.ts` unchanged so the module helpers share them.

Web:

- New `canvas/TileInspector.tsx`, mounted by `Workspace.Inspector` for a tile. Header as before,
  then the **kind row** (`<fieldset aria-label="Kind">`): one icon button per kind of the tile
  type, `aria-label` the kind name, `aria-pressed` on the current one (yellow, as
  automation-illustrator's `.inspector-type.is-on`). Each other kind is dry-run on render
  (`buildStudioCommand` changeKind, then `applyOperations`); a refusal disables the button and
  becomes its `title`. A click runs `changeKind` through `commitAction`.
- `TargetInspector`/`TargetForm` take `modules` (a **Modules** tab, last) and an optional
  controlled `tab`/`onTab`, so coming back from a module lands on Modules. The tab's `ModuleList`:
  one button per module (kind icon, name; kind name as tooltip), "No modules yet." when empty, and
  a dashed `+` (`aria-label="Add module"`) opening a Mantine `Menu` of the ten kinds as icons in a
  5×2 grid (`menuitem`s named by kind). A pick runs `createComponent` with
  `createStudioComponentSettings(kind)`, opens the new module and selects its Name.
- An open module (`ModuleInspector`): "← Shorten API" (`aria-label="Back to Shorten API"`), its
  icon, name and kind, then `ComponentForm` (now mounted). `ComponentForm` changes: the
  Component/Inside facts went (the header shows them; Typical stays), "Remove component" is
  **Remove module** and calls `onRemoved` (back to the list), the stale "Drag this component's +
  handle" help is now "No links yet.", and Connections gained a **Link to** select over
  `moduleLinkChoices` (runs `connectComponent`). A module that disappears (undo, chat) closes.
- `StudioIcon` regained `shield`, `repeat`, `plug-connected`, `puzzle`. CSS in `canvas.css`
  (`.lane-kinds`, `.lane-kind`, `.lane-inspector-back`, `.lane-module*`; Mantine's autofocus holder
  is taken out of the menu grid). `.studio-inspector-tabs` buttons size to their labels and don't
  wrap (four tabs at the default 320px rail; at the 240px minimum the labels ellipsize).

Departures (mine, small): the kind row is hidden for tile types with one kind (cache, queue,
storage, external), where it would be a single pressed button; the header already shows the kind.
**Link to** is not in LG11's list: without it a new module's readiness gap ("A cache reader needs
a cache connection.") could only be fixed through chat, since the old canvas's module handles are
gone. It links to tiles only; module-to-module links stay chat-only (in Limits).

E2E: `edit-history` edits Link writer's pool size 20 → 32 via Shorten API → Modules → Link writer
→ Options (autosave, undo, redo, reload). Still 7 tests.

Tests: `studio-modules.test.ts` (2): kinds per host, numbered names and IDs; a new data access in
Shorten API links only to Links database via `shorten-db` and its readiness gap clears; a consumer
in Redirect gets no choice (only a publish link to the queue); the click publisher is offered only
Links database.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 192 files, all type checks, 21 test files / 116 tests passed).
- `pnpm test:e2e`: 7 passed, first run; 7 passed again after the last edits.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser (Playwright Chromium by mouse at 1440×900, light and dark; my own API on 4312 and web on
  4302 against `jeeves_e2e`, both stopped afterwards; the owner's 4300/4310 and `jeeves`
  untouched, though tsx watch reloaded the owner's API with this code and it reports healthy;
  every throwaway project deleted, 204): TinyURL shows 10 tiles and 11 lines. Redirect service's
  row: Microservice, Worker service, Redirect (pressed), Identity, Notifications, Billing; Worker
  → revision +1, header "Worker service"; Redirect → back; Undo twice → worker, redirect. Analytics
  worker → Microservice → Worker service, Undo twice. Shorten API's Worker service is disabled,
  title "Shorten API can't become a worker. A lane starts at a service (not a worker), an API,
  storage or an external API."; Links database's Search index is disabled ("ID generator in
  Shorten API can't use a search index; remove its link to Links database first."); Link cache has
  no row. CDN → Gateway (classification Application, Modules tab appears) → CDN (tab gone), Undo
  twice. Shorten API → Modules lists its four; `+` → Cache reader → `shorten-api-cache-reader`
  opens with its Name selected and the gap "A cache reader needs a cache connection."; Pattern →
  read-through, Shared cache TTL 600, Link to → "Link cache · Counts requests" (gap met), Remove
  module → back to the four; Undo five times restores the module, then unlinks it, clears the TTL,
  resets the pattern and removes it. Link writer opens; "← Shorten API" returns to the Modules tab.
  No console errors or warnings. Native tooltips don't show in headless screenshots; the titles
  were read from the DOM.

Docs: studio guide (the canvas note, Inspector rewritten with the kind row, Modules and the module
form, History, Limits), CATALOG (kind row → `changeKind`, component icons, module helpers and
commands), studio settings (Components: edited in the tile's inspector), PLAN (`TileInspector.tsx`,
`studio-modules.ts`). No cap was hit or raised.

Notes for LG12:

- Chat can keep the component commands as they are; the canvas uses `createComponent`,
  `connectComponent`, `disconnectComponent`, `removeComponent` and `editComponent`.
  `newModuleIdentity`, `moduleLinkChoices` and `studioComponentVisuals` are available if
  `getDesign` or `listStudioDefinitions` want module names, link choices or icons.
- `architectureSelection` (sent with chat) is still the tile, line or entry; an open module is not
  added. If "change this module" should work, `TileInspector`'s `open` state is where to report it.
- `changeKind` is a mouse action now; the chat's instructions should mention it next to the other
  lane commands.

## 2026-11-04 — LG12: chat on the lane commands (complete)

Chat now edits the lane canvas through the same lane commands as the mouse.

Spec:

- `studioCommandSchema` is the lane commands first (`addTile`, `linkTiles`, `removeTile`,
  `removeLink`, `changeKind`), then `edit`, `editSystem`, `editConnection` and the five component
  commands, unchanged. **Removed** from the spec (nothing but chat and tests used them): `create`,
  `connect` (and its `lookup` shortcut), `group`, `removeMembers`, `ungroup`, `delete`, with
  `reassignOwners`/`StudioOwnerReassignment`. `edit` sets or clears `owner` directly. Only
  `addTile` can now create the system of an empty design ("This design has no system yet. Start it
  with addTile from the download or upload lane, giving the system a name."; `editSystem` still
  creates one too). `studioElementCreationSchema` stays as the study's tile type.
- The builder's own refusals are in plain words: `There is no tile "ghost".`, `There is no
  module …`, `There is no link …` (or "… is a lane entry; entries have no settings."), "A module's
  kind can't change; remove it and add another."
- `studio-presets.ts` is deleted, with the package `preset` field (`studioPackageSchema`) and its
  `NEEDS_TEMPLATE` check. Before dropping the field I read the owner's projects through the running
  API on 4310 (GET only): one project, TinyURL `41bbd268-…`, revision 1, no packages, so nothing
  stored used it.

Server (`chat/tools.ts`):

- `INSTRUCTIONS` rewritten around the lane canvas: one actor (the user, never a tile), the
  download and upload lanes, every tile hangs off a lane (no islands, no cycles), sync and async
  links and async forks, resources as end tiles, the link table in one line per rule, the caps
  (from `laneLimits`), each command including `changeKind` ("as the inspector's kind row does"),
  canvas-style IDs (`source-target`, `lane-target`), and "never work around a lane rule".
- `listStudioDefinitions` → `{tileTypes: [{type, name, kinds: [{kind, name, description}]}],
  modules: [{kind, name, description, uses}], caps}`; no presets, definition refs or creation
  scopes. `describeStudioDefinition` is unchanged.
- `getDesign` (and the `[Jeeves]` turn context) → `{baseRevision, system, lanes: [{lane, entries:
  [{id, tile}], tiles}] (each lane's tiles breadth-first from its entries), tiles (lane order:
  id, name, description, type, kind, owner, settings, links [{id, to, mode sync|async, planned,
  settings}], modules [{id, name, description, settings, links}]), caps, findings}`. C1 context and
  packages are no longer sent.
- Refusals: an `applyOperations` failure returns `error` as the findings' messages joined (was an
  `errors` array); with several commands in a call the error starts "Command 2 (removeTile): ";
  an unknown command type (`create`, `addRoute`…) gets `There is no "create" command. The commands
  are addTile, linkTiles, …`. The activity line is `Refused: <reason>`, so the person sees it too.

Web: the chat rail's stale suggestion is now "Add a cache after the selected service".

Fixture: `e2e-script.json` gained "Add a cache after the redirect service": `getDesign`, then
`addTile` after `redirect` (tile `cache` "Cache", link `redirect-cache-2`, exactly what Redirect's
`+` → Cache makes; `redirect-cache` is taken), then a reply. Both scripted turns expect a fresh
TinyURL at revision 1.

Tests: `tools.test.ts` (7): the tile types, caps and `getDesign` lanes in lane order (Redirect's
links `sync, sync, async`, 4 modules); **`addTile` through chat equals the canvas batch** (built
from `laneChoices`, `newTileIdentity` and `newLinkId` as `creation.tsx` does; `pending` equals
`buildStudioCommand(…).ops`); plain-words refusals (unknown `addRoute` and `create`, a ghost tile,
command 2 of a call stranding the click path and the new cache, a loop, a cache linking onward);
an empty design refused without `system`, accepted with it. `studio-operations.test.ts` lost the
create, package, group and delete tests (6 left; editConnection now runs on TinyURL's own links;
the retired types are refused). E2E: `blueprint-chat` gained "adds a tile through chat with the
lane commands": 11 tiles, 12 lines, revision 2, `redirect → cache`, the header's Undo → 10 tiles.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 191 files, all type checks, 21 test files / 114 tests passed;
  −3 spec command tests, +1 tools test).
- `pnpm test:e2e`: 8 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser (Playwright Chromium by mouse at 1440×900; my own API on 4312 with
  `JEEVES_FAKE_MODEL_SCRIPT` and web on 4302 against `jeeves_e2e`, both stopped afterwards; the
  owner's 4300/4310 and `jeeves` untouched apart from the read-only GETs above, though tsx watch
  reloaded the owner's API with this code and it reports healthy): a TinyURL study made through
  the project menu shows 10 tiles and 11 lines and the three suggestions. Redirect service
  selected, then "Add a cache after the redirect service" sent: the reply, activity "Read the
  studio design / Prepared 1 studio command / Applied 3 changes as one undo step", Changed: Cache
  and Redirect service → Cache; 11 tiles, 12 lines, revision 2, link `redirect-cache-2`, the
  turn's selection `["redirect"]`. Header Undo → 10 tiles, 11 lines (revision 3); Redo → 11, 12
  (revision 4). Sending it again at revision 4 is refused as a revision conflict and changes
  nothing. No console errors or warnings. The throwaway project was deleted (204).

Docs: studio guide (Chat rewritten), PLAN (data model without presets, studio commands, Chat
toolset and refusals), CATALOG (new resources' owner, chat uses the lane commands, packages are
neither shown nor changed), studio settings (lookup shortcut through `edit`, packages),
`fixtures/chat/README.md` (both turns). No cap was hit or raised.

Not done (optional per LG11): an open module is still not part of the selection chat receives.

Notes for LG13:

- Live chat quality on the new instructions is unevaluated (no provider calls); "Repeat one edit
  through chat" in LG13 needs a real provider and the owner's say-so, or the scripted turn.
- Stale definition metadata the canvas and chat no longer use: CATALOG's "Library group" and
  "Created at" columns (`libraryGroup`, `creationScopes` in `studio-definitions.ts`; "C3 only,
  owner required" for queues) and studio settings' "Queues are created at C3 only." and
  "Presets" group wording. `describeStudioDefinition` still returns those fields.
- The scripted turns hard-code `baseRevision: 1`; a new scripted turn should too, on its own
  fresh project.

## 2026-11-05 — LG13: lane-grid acceptance and documentation (complete)

The lane-grid plan and its execution units are marked complete. This unit checked plan §2 in the
running app by mouse, built TinyURL from Blank architecture, measured Fit and finished the docs.
No cap was hit or raised, and no app behaviour changed.

Code (small cleanup): `libraryGroup`, `creationScopes`, `studioLibraryGroups`,
`StudioLibraryGroup` and `StudioCreationScope` are gone from `studio-definitions.ts` (43 lines).
Only `describeStudioDefinition` returned them, so chat's kind description no longer has them. The
queue definition's description no longer says "shown at C3" (chat lists it). A comment's
`TemplateIcon` is now `StudioIcon`. `creationName` is also read only by `describeStudioDefinition`;
I left it, since LG12 did not list it.

Docs: CATALOG (the kinds table has a Tile type column instead of Library group and Created at,
and the queue row is rewritten), studio settings (no creation scopes, Presets or "C3 only"; queue
ownership; Asynchronous only where the link table allows), the studio guide (a Fit table, the
selection after a merge, Limits rewritten with this unit's findings and the open question), C4
notes (how the lane canvas uses C1/C2/C3), PLAN (Next), README (link blurbs), AGENTS (lane rules
in the docs rule), and both plans' status lines. The blueprint doc was already accurate: its
example matches a fresh study's blueprint field for field. Every relative link and anchor in the
16 tracked Markdown files resolves.

Acceptance (Playwright Chromium driven by mouse, 1440×900 unless noted; my own API on 4312 with
`JEEVES_FAKE_MODEL_SCRIPT` and web on 4302 against `jeeves_e2e`, both stopped afterwards; every
throwaway project was deleted (204), leaving the one auto-created study; no console errors or
warnings in any run):

| # | Result | Reason |
| --- | --- | --- |
| L1 | pass | There are no C1/C2/C3 tabs. The User is a stick-figure tile with no X, Delete does nothing on it, and selecting it shows only the system's Name and Goal. |
| L2 | pass | The download chip and CDN sit above the upload chip and Shorten API. |
| L3 | pass | Analytics worker `+` dropped on Redirect is refused ("…would make a loop."; the target is not lit, the revision is unchanged). An API `disconnect` of `cdn-redirect` is 422 `LANE_INVALID`. |
| L4 | pass | Lines have no text. Exactly the click path is dashed (3 lines). The two entry chips are icons only. |
| L5 | pass | Across the user's, Redirect's and the queue's fans: Service, API, Database, Cache, Queue, Storage and External, icons only (no Browser app). Redirect's kind row has 6 kinds; Link cache has none. |
| L6 | pass | Tabs show only on the selected tile (Redirect: request and async on both sides; a queue: async only; a cache: Request before only; the user: one per lane). A pull draws the band and the scrim. Request before Redirect inserted CDN → Service → Redirect (then undone). |
| L7 | pass | CDN's X restitched the download entry to Redirect (9 tiles). Redirect's X opens one panel listing Click events, Analytics worker and Analytics store ("Remove 4 tiles", 4 rings). Cancel changes nothing. |
| L8 | pass | At 4 links Redirect keeps only its left tabs. At 3 download entries the user keeps only the upload tab. There is no `/layout` request and no position in the design. |
| L9 | pass | Shorten API's Modules tab lists its 4 modules with a `+`. Modules are not drawn (10 tiles). |
| L10 | pass | The Biome overrides are in place, and there are 0 `@jeeves`/`apps` imports in `packages/board/src` (a code check, not a mouse check). |
| L11 | pass | The toolbar is Select, Hand and Fit. There is no Library, New island, Connection tool, preset or package frame. The inspector, chat rail, Settings and blueprint (200) remain. |
| L12 | pass | Read-only GETs on the owner's 4310: one project, the lane-form TinyURL `41bbd268…` at revision 1, with 2 entries and no findings. The pre-lane project went in LG06. |
| L13 | pass (scripted) | "Add a cache after the redirect service" by chat and Redirect's `+` → Cache by mouse give byte-identical designs (revision 2, `cache`, `redirect-cache-2`). Live chat with the new instructions is **untested**: no real provider was called. |

TinyURL from **Blank architecture** (1440×900, chat open, as a fresh project opens): **11 drags
and 9 clicks** to the study's lane graph (10 tiles, 11 lines, 3 dashed, 2 chips; entries
download → CDN and upload → Shorten API; the same 9 links, in the same order per tile). The 9 clicks are 2
kind-row clicks (API → CDN, Service → Redirect), 5 tile selections (Redirect twice before its
second and third forks, the User before the upload lane, Shorten API twice after merges) and 2
Fit clicks. Nine names were typed, each into the Name field that opens focused and selected.
Creating the project took 4 more clicks (menu, New project, Blank architecture, Create). Refit
with both rails closed, the result is laid out exactly like the study. Nothing blocked. What was
awkward:

- Fit was needed twice: the first tile opens the inspector, which narrows the board without a
  refit (the new CDN was partly off the edge), and the chain later grew past the right edge at
  zoom 1.
- After a pick or a merge the new or target tile is selected, so every second fork from a tile,
  and every merge, costs a click back on the source.
- CDN and Redirect take a kind-row click each, because the fan's defaults are Gateway and
  Microservice.
- Links database ends up owned by Redirect (the first link) and the links carry default actions
  ("Reads & writes", "Calls"). In the study, Shorten API owns it, with specific actions. Both are
  inspector edits, not lane structure.

Fit zoom (TinyURL; rails toggled from the header, then Fit):

| Window | Both rails closed | Chat open | Inspector open | Both open |
| --- | --- | --- | --- | --- |
| 1440×900 | 0.78 | 0.61 | 0.60 | 0.44 |
| 1280×800 | 0.69 | 0.53 | 0.52 | 0.35 |

The ≥ 0.75 target (1440×900, chat closed) is met. Toggling a rail does not refit (0.614 stayed
0.614).

What the screenshots show. At 0.78, light and dark, the board reads cleanly: the User on the
left, the two chips on its fork, CDN → Redirect on the download row, Shorten API below, URL
reputation API in Redirect's column between the rows, and the dashed click path along the top.
What still looks messy or hard to read:

1. **The shared bus.** Redirect's and Shorten API's links to Link cache and Links database merge
   into one vertical bus at the third column, and Redirect's dashed branch to Click events leaves
   from its top. The lines alone don't say who reaches what (it could read as Shorten API
   publishing clicks). Shorten API's line to the bus also runs just under the URL reputation API
   tile.
2. **Lines on a bus are hard to pick.** A click on the bus between Link cache and Links database
   selected "Shorten API to Link cache". On the bus its 4px stroke barely differs from the others,
   and its X sits at that line's own middle, next to Links database. Selecting it also opened the
   inspector, which cut Analytics store off at the right edge.
3. **The fan at low zoom.** With both rails open (0.44, or 0.35 at 1280) the tiles shrink to 56px
   (45px at 1280) and their names are unreadable, while the fan icons stay about 56px. One fan icon sat squarely on
   the Analytics store tile, a lit drop target. With the inspector open the fan spills over the
   inspector's fields, because the overlay isn't clipped to the board. Tabs are 18px at 0.44 and
   14px at 0.35.
4. **The removal panel** under Redirect covers Shorten API, URL reputation API and Links database
   at 0.44; the ringed tiles above it stay visible.
5. **Selecting opens the inspector without a refit**, so right-edge tiles leave the view (above,
   and during the Blank build).
6. With 3 download entries (the L8 check) the user's fork has four lines, and Shorten API's links
   to Link cache and Links database wrap around the URL reputation API. It is busy, but traceable.

These are in the studio guide's Limits.

Open question for the owner: **should one tile be able to start both lanes?** Today a tile starts
at most one lane ("… already starts the upload lane; a tile can start only one lane."). The rule
was not changed; it is in the guide's Limits and PLAN's Next.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 191 files, all type checks, 21 test files / 114 tests passed).
- `pnpm test:e2e`: 8 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- The owner's 4300/4310 and `jeeves` database were untouched apart from the read-only GETs above.
  The owner's `tsx watch` API reloaded with this unit's code and listens again. `~/.jeeves/` was
  not touched.

Notes for whoever picks up the canvas next:

- The cheapest wins on the messy list are probably: refit (or keep the selection in view) when the
  inspector opens, clip the fan and the HUD to the board, and keep the source selected after a
  merge. All three are board or Workspace changes; none touches the lane rules.
- Breaking the bus apart (no `mergeEdges` for some fans, or a per-source port offset) is an ELK
  options change in `packages/board/src/layout/elkGraph.ts`. It moves every layout, so the layout
  tests' expectations would change with it.
- `creationName` in the definitions is the last metadata nothing but `describeStudioDefinition`
  reads.

## 2026-11-05 — PL01: canvas polish (complete)

The five canvas problems in the studio guide's Limits are fixed, without layout options or data
model changes, and the one-lane-per-tile rule is unchanged.

Board (`packages/board`, still no Jeeves imports):

- `camera.ts`: `CameraOrigin` ("fit" or "user"), `cameraOriginAfterMove`, `viewportOnResize` and
  `viewportToReveal` (`REVEAL_MARGIN` 48px, for the tabs and X). `Board.tsx` keeps the origin: the
  first-layout camera and Fit set "fit"; a wheel zoom, or a React Flow move with an event that
  changed the view (drag, Hand, pinch), sets "user". A `ResizeObserver` on the board refits a
  fitted camera at once (duration 0) on any size change, against the ELK target layout; the user's
  camera stays. A picked tile's ID is remembered and, when ELK has placed it, the camera pans just
  enough to show it (200ms, same zoom). No reference mechanism exists for this in
  automation-illustrator (its cameras are stored), so it is new.
- `Board.tsx`/`BoardLine.tsx`: the selected tile's lines (in and out) get `linked` and are drawn
  in `--board-select` at the normal width, over the rest; the selected line on top, 4px, same
  colour. Its X goes to `ownStretchMidpoint` (new in `layout/polyline.ts`): the middle of the
  longest straight run of at least 8px that no other route runs along, else the midpoint. An
  entry line's X stays above its chip.
- `fan.ts`: `placeFan` clamps every item 16px inside the board's screen rect (`FAN_ITEM_SIZE` 60,
  `FAN_EDGE_MARGIN` 16), pushes clamped items apart where they would stack, and nudges any item
  whose centre is on a drop target's hole just off it (preferring spots clear of targets and other
  items). `TileChrome` passes the board rect and the target holes.
- `TileChrome.tsx`: only a tile the tab may drop on is "sticky" and makes the fan step back
  (`data-on-tile`); over a refused tile a fan item under the pointer wins.
- `hud` is no longer a `NodeToolbar` under the tile: it is a `.board-hud` at the board's bottom
  centre (ported `.remove-picker-hud`: bottom 16px, centred, `min(420px, 100% - 32px)`, z-index
  10), outside React Flow, so clicks on it never reach the paper; the wheel over it doesn't zoom.
  The chrome-less tile and the `marked` rings are unchanged.
- `board.css`: the HUD rule, the hovered fan item on top (its name was covered by a clamped
  neighbour).

Web: `creation.tsx` has no `onLinked`; a drop on a tile commits `linkTiles` and leaves the
selection alone, so the source stays selected (a pick still selects the new tile and focuses its
Name). `canvas.css`: the board's dark-theme `--board-select` is `#3d9cf0` (the theme's dark
`--blue` #7eb6e0 is almost the dark `--line` #7eabc0, so highlighted lines didn't show); the
removal list is a row of icon pills.

Deviations from the plan, all found in the walkthrough:

- The nudge applies to every fan item centred on a drop target, not only clamped ones, and the
  sticky rule is limited to drop targets. Building TinyURL from Blank at 100% (which the new camera
  keeps longer), Redirect's `---` fan put the Queue icon entirely inside Links database (not a
  target); the pointer had to cross the tile, which then stuck, so the icon couldn't be picked at
  all. LG13 escaped this only because its Fit clicks changed the zoom.
- The dark-mode selection colour and the hovered-item z-index (above).
- Tests: besides the camera test, one `placeFan` test in `fan.test.ts` (clamp, no stacking,
  nudge). In `spawn.spec.ts` the second test no longer clicks Fit (the fitted camera refits when
  the inspector opens) and asserts that Shorten API stays selected after the merge and Click
  events is not selected.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 192 files, all type checks, 22 test files / 116 tests passed).
- `pnpm test:e2e`: 8 passed, first run, twice (before and after the docs and the last fixes).
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Browser: Playwright Chromium driven by mouse. My own API on 4312 (`JEEVES_FAKE_MODEL_SCRIPT`, a
  scratch `JEEVES_HOME`) and web on 4302 against `jeeves_e2e`, both stopped afterwards. Every
  throwaway project was deleted (204), leaving the one study already there. The owner's 4300/4310,
  the `jeeves` database and `~/.jeeves/` were not touched. No console errors or warnings.

TinyURL from **Blank architecture**: **11 drags and 6 clicks** (LG13: 11 and 9) at 1440×900 with
chat open, 1440×900 with chat closed first, and 1280×800 with chat open. The 6 clicks are 2
kind-row clicks (API → CDN, Service → Redirect), 3 selections (Redirect twice before its second
and third forks, the User before the upload lane) and 1 Fit. The Fit is needed because the User has
scrolled off the left by then: each new tile was panned into view at 100%, and the chain is wider
than the board. Every new tile was in view when it landed. Both merges left Shorten API selected.
The result has the study's entries and 9 links in the same order per tile, and identical tile
positions (relative to the user). Note: the worker → store link is a `+` (a request drawn dashed),
not a `---`.

The five items:

| # | Item | Result |
| --- | --- | --- |
| 1 | Camera follows the canvas | Fixed. Toggling rails on a fitted TinyURL refits to the guide's table at both sizes (1440: 0.78 / 0.61 / 0.60 / 0.44; 1280: 0.69 / 0.53 / 0.52 / 0.35). Selecting with the inspector closed refits, with all tiles in view. After a paper drag, a wheel zoom or a Hand drag, a rail toggle leaves the camera exactly as it was; Fit makes it follow again. |
| 2 | A merge keeps the source | Fixed. Shorten API stayed selected after both merges in all three builds (E2E asserts it). |
| 3 | Selection shows who reaches what | Fixed, with a caveat. Selecting Redirect turns exactly its 4 lines blue (rgb 26,143,212 at 2.75px), and the other 7 stay navy. In the screenshots its bus branches to Link cache and Links database and its dashed branch to Click events now read as Redirect's, light and dark. The X goes to the line's own stretch where one exists (Redirect → Click events, Shorten API → URL reputation API). TinyURL's three bus lines (Redirect → Link cache / Links database, Shorten API → Link cache) share every stretch, so their X falls back to the midpoint on the bus. The highlight makes clear which line it belongs to. |
| 4 | The fan stays inside the canvas | Fixed. Both rails open, at 0.44 and 0.35: for Analytics worker `+` (6 items), CDN `+` before, the User's upload tab, Shorten API `+` (6) and URL reputation API `+`, 0 items left the board's 16px margin and 0 sat centred on a drop target. At the right edge the items line up along it without overlapping. |
| 5 | Removal panel as a HUD | Fixed. Redirect's X: the panel is centred on the board (offset 0px), 16px from its bottom, 420px wide, "Remove 4 tiles" focused, 4 rings. Cancel, Escape and a paper click each close it with nothing changed. Confirm → 6 tiles and 5 lines; Undo → 10. |

What the screenshots show (light and dark, both sizes): the canvas now keeps itself framed when
rails change. During a build at 100% the newest tile always sits in view near the edge it grew
towards. A selected tile's reach is visible at a glance, which fixes LG13's "who reaches what" on
the bus. The fan never covers a rail. Still rough:

- At 0.35–0.44 the clamped fan is a tidy column at the board's edge, but its 60px icons still
  cover the tiles near that edge (non-targets), and the source tile's right edge when the tile
  sits near the board edge.
- With a user camera, the bottom HUD can cover the bottom row of tiles (it covered part of
  Shorten API once). Fitted, it sat over empty paper.
- Building at 100% pans the start of the chain out of view (the remaining Fit click).

The guide's Limits now hold the fan at low zoom, the panning at 100% and the bus click (rewritten).
The one-lane rule and the other limits are unchanged.

Docs: studio guide (the lane canvas: selection colour; layout and navigation: how the camera
follows; creating: fan placement, the source staying selected, the pan to a new tile; removing:
the bottom-centre panel and the X on its own stretch; Limits), PLAN (`packages/board` row), the
polish plan's status line. CATALOG, the settings and blueprint docs needed no change.

Notes for PL02:

- After a drop the selection doesn't change. A user's lane-tab drop onto the other lane's entry
  tile (the `both` upgrade) will leave the User selected with its tabs. `canDrop` (via
  `laneLinkRefusal`) must allow that drop. Otherwise the tile stays dimmed and refused, and since
  only drop targets are sticky, a fan icon over it still wins.
- Entry lines highlight when the User or their target is selected. The entry chip is
  `CHIP = 32×32` in `LaneCanvas.tsx`, and the line's X sits above the chip using the chip's ELK
  height. A wider two-icon chip only needs its `w` changed there.
- `ownStretchMidpoint` treats any shared collinear run as shared, so two entry lines leaving the
  User's port share their first stub, as before.

## 2026-11-05 — PL02: one entry tile can start both lanes (complete)

Owner, 2026-11-05: when one API is where both the user's reads and writes first land, one line
goes from the user to it and both lanes branch from it. Read/write tags on the links after it are
out of scope; they stay ordinary forks. The polish units, and the open question in the guide's
Limits and PLAN's Next, are closed. No cap was raised.

Spec:

- `studio-model.ts`: `studioEntryLanes` (`download`, `both`, `upload`, in layout order),
  `studioEntryLaneSchema`, `StudioEntryLane` and `entryLanes(lane)` (`both` → both lanes). An
  entry's `lane` takes the new schema. `studioLanes`/`studioLaneSchema` are still the two lanes
  (tabs, `addTile` from a lane, the blueprint).
- `studio-lanes.ts`: `laneGraph` visits and orders entries download-only, then both, then
  upload-only, draining breadth-first after each group. `LaneEdge.lane` is a `StudioEntryLane`.
  `laneFindings` counts a both-lane entry in each lane's cap. A tile still has one entry (a second
  one is "… is already a lane entry."). New `laneWords` ("the download lane", "both lanes").
- `studio-lane-commands.ts`: `linkTiles` from a lane onto the other lane's entry tile sets that
  entry to `both` (same ID; `linkId` must still be free but is unused; the ops are just
  `setStudio`). A drop onto a tile already in that lane is refused ("CDN already starts the
  download lane." / "… both lanes."); the old "a tile can start only one lane" refusal is gone.
  New `setEntryLane { entry, lane }`, refused for an unknown entry, the same lane, or a lane it
  joins that already has 3 entries. `removeLink` on a both-lane entry removes the whole entry
  ("Removing the download and upload entry to API would cut off …"). `removeTile` and `addTile`
  before an entry tile keep `both` and check both caps. New pure helper `laneEntryRefusal(design,
  entry, lane)` beside `laneLinkRefusal`.
- `studio-blueprint.ts`: a both-lane entry is two rows (`download` and `upload`); the schema is
  unchanged.

Web: `LaneCanvas.tsx` gives a both-lane entry a 52×32 chip (ELK keeps it clear) with the download
and upload icons side by side (`LaneIcon` takes `both`; `.lane-icon-both`); `laneNames` are now
full names ("Download lane", "Download and upload lanes"), so labels are unchanged for one lane.
`creation.tsx`: `canDrop` allows the upgrade through `laneLinkRefusal`; `laneOrder` places a new
download-only entry above the first both-lane entry and a new upload-only entry below the last.
`Workspace.tsx`: the entry inspector has a lane row (download, upload, both as `.lane-kind` icon
buttons, current one yellow); a choice `laneEntryRefusal` refuses is disabled with the reason as
its title; a click commits `setEntryLane`.

Chat (`tools.ts`): `setEntryLane` is in the schema (it is a lane command). The instructions
describe shared entries (one line, both lanes branch from the tile; `linkTiles` from the other lane
or `setEntryLane`; it counts toward both caps) and `removeLink` on one. `getDesign` lists a shared
entry in both lanes, marked `lane: "both"`, and both lanes' tile lists start from it. The fixture is
unchanged.

Tests (120, +4): `linkTiles` upgrade (ops, entries, refusal from the same lane, `removeLink`
refused when it strands and accepted once Shorten API also reaches the CDN); `setEntryLane` and the
caps (both ways, a full download lane disables `both` and `download` for the upload entry and
removes the user's download tab, two shared entries fill the upload lane); lane order with a
shared entry stored out of order, and the cap counting it; two blueprint rows. `tools.test.ts`
extends the empty-design test with `setEntryLane` and the shared entry in `getDesign`. E2E:
`spawn.spec.ts` drags the user's upload `+` onto CDN: still 11 lines, the CDN chip "Download and
upload lanes: User to CDN" with 2 icons, the User still selected, `download-cdn` now `both`; Undo
restores "Download lane: User to CDN" and "Upload lane: User to Shorten API".

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 192 files, all type checks, 22 test files / 120 tests passed).
- `pnpm test:e2e`: 9 passed, first run, twice (before and after the docs).
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Scripted chat: both `blueprint-chat` chat tests pass; no real provider was called.
- Browser: Playwright Chromium driven by mouse at 1440×900 with chat open, light and the app's
  dark mode. My own API on 4312 (`JEEVES_FAKE_MODEL_SCRIPT`, a scratch `JEEVES_HOME`) and web on
  4302 against `jeeves_e2e`, both stopped afterwards; all 6 throwaway projects deleted (204),
  leaving the one study already there. The owner's 4300/4310, the `jeeves` database and
  `~/.jeeves/` were not touched (one GET `/health` on 4310). No console errors or warnings.

Walkthrough from **Blank architecture**: download `+` → API, then the User and the upload `+`
dropped on the API (drop ring shown): one line, a 52×32 chip with both icons, the User still
selected. API `+` → Service and → Database, download `+` → Storage, upload `+` → Service 2, Fit:
row centres Storage 328, Service 394, API 460, Database 526, Service 2 592, so the download-only
entry is on top, the API in the middle with its forks between the lanes, and the upload-only entry
below. The shared chip's inspector: "Download and upload lanes", row download / upload / both
(both pressed); Download → the entry is `download`, the chip one icon, the line still selected.
With External added (download lane full), the upload entry's row has Download and Both disabled,
titled "The download lane already has 3 entries; the most is 3."; a forced click changed nothing.
The API's entry back to Both (allowed: it already counts in download), then its X: refused, notice
"Change not saved: Removing the download and upload entry to API would cut off API, Service and
Database."; after Service 2 `+` dropped on the API, the same X removed the entry (API stays via
Service 2). Then 11 Undo clicks back to the empty project, the entries matching every earlier step.
TinyURL study: 10 tiles, 11 lines, two one-icon chips (32px at 0.61 zoom), entries
`download-cdn`/`upload-shorten-api`, the familiar layout (ELK gets the same input as before for
one-lane entries); upload `+` onto CDN → one two-icon chip, Undo → back.

What the screenshots show: the two-icon chip reads at a glance as "both", the same box style as the
one-icon chips, and fits the user's fork at every zoom tried. With a download-only and an
upload-only entry around it, the shared API sits on the middle row and its forks fan out between
the lanes, which is what the owner asked for. The lane row matches the kind row's look. Rough
edges: the inspector title "Download and upload lanes" wraps to two lines at the default inspector
width; the user keeps both lane tabs after the upgrade (a drop of the other tab on the shared tile
is refused, the tile dimmed); an entry switched from both back to one lane keeps its row until the
layout's stability hints let it go (it stays in its lane group, as the screenshot shows).

Docs: studio guide (lines, layout order, creating and the refusal example, the rule paragraph,
removing, the entry inspector's lane row, history, chat; Limits: the open question replaced by
"links after a shared tile are ordinary forks"), CATALOG (entries, caps, `linkTiles`,
`removeTile`, `removeLink`, new `setEntryLane` row, the lane row), studio settings (lane entries),
blueprint doc (two rows), PLAN (data model, commands, `laneEntryRefusal`, chat, Next), polish
plan and build plan status lines. `fixtures/chat/README.md` needed no change.

Notes for whoever picks up lanes next:

- Removing a tile restitches through the board's plan, which drops a pair already reachable. So if
  a shared tile A forks to B and B already starts one lane, removing A leaves B in its one lane
  (the other lane loses that path) rather than making B shared. Nothing is stranded, and
  `setEntryLane` fixes it by hand.
- `addTile` from a lane still takes `download` or `upload`; a new shared entry is an `addTile`
  plus `setEntryLane` (chat) or a pick plus a drop (mouse).
- Read/write tags on the links after a shared tile are the owner's later decision.

## 2026-11-05 — DP01: lines line up on the grid (complete)

New pure step `alignLayout(layout, input)` (`packages/board/src/layout/align.ts`, exported from
the layout index). The engine runs it on every ELK result before caching, so the shown positions,
and therefore the next stability hints, are already aligned. No ELK option changed.

- **Ports on grid lines.** Every tile's centre (its ports' y) snaps to the 32px grid, so 128px
  tiles have their top-left on it and the 160px user has its centre on it. x snaps too (ELK's x
  was already on the grid).
- **Near-straight lines become straight.** Columns are processed left to right. A tile whose ELK
  input port is within 16px (`STRAIGHTEN_PX`) of a placed predecessor's ELK output port takes
  that predecessor's final row. Ties go to a line ELK drew straight, then input order.
- **Columns keep order and gaps.** Tiles with overlapping x spans form a column and keep ELK's
  top-to-bottom order with at least `BRANCH_GAP`. A tile that would come closer is pushed down
  (whole grid steps), which pushes the ones below. One refinement beyond the plan's wording: if
  the tile above is "free" (it only snapped, following no predecessor) and the grid line above is
  still within 16px of its ELK row, that tile moves up instead. Without it, forking Analytics
  worker in TinyURL put Click events on a half step (5.5 grid) that rounded down onto Link cache
  and pushed it off Redirect's row (a 32px jog). It is unit-tested and was seen in the browser.
- **Routes follow the tiles.** The first horizontal run takes the source port's y, the last run
  the target's. Middle points keep ELK's x and y; the route is then de-duplicated and collinear
  points dropped. A straight route whose ends now differ gets a bend on the grid column nearest
  the middle that is clear of its chip. A chip moves with the horizontal run it sits on. Bounds
  only grow.
- **Dots on the crossings.** `Board`'s `Background` now passes
  `offset={DOT_SIZE / 2 - GRID / 2}`. React Flow draws each dot at its cell's corner plus the
  radius, shifted half a cell, so the dots used to sit about 17px off the grid. Now tile corners
  and lines visibly sit on the dots. This is a one-line visual change beyond the plan's list; I
  made it because "on the grid" is otherwise invisible. Revert that line if the owner prefers the
  old dot phase.

Real-ELK TinyURL (current input), aligned: User 32,304 (centre 384); CDN and Redirect y 192
(centre 256); Link cache 192 (256); Links database 416 (480); Shorten API 416 (480); URL
reputation API 352 (416); the click path on y 32. Redirect → Link cache is `640,256 → 704,256`,
and Shorten API → Links database is `448,480 → 704,480`. Bounds are unchanged (1248×592), so the
guide's fit table is unchanged (measured: 1440 0.78/0.61/0.60/0.44, 1280 0.69/0.53/0.52/0.35).

Tests (124, +4 in `layout.test.ts`; `layoutOf` now runs `alignLayout` like the engine):

- `expectClean` now also checks grid x, ports on grid lines, and tops on the grid where the
  half-height allows.
- TinyURL: no vertical segment shorter than 32px, the user's top 16px off the grid, both merges
  are 2-point straight routes.
- Re-laying out with its own positions gives the identical layout. Adding a tile after Analytics
  store moves no existing tile, and the new tile takes the store's row.
- Forking Analytics worker keeps both merges straight (the lift).
- A hand-made case: a 160px tile pushes the tile below, which bends a straight line at x 192 and
  grows the bounds.
- The fork test's centring tolerance went from 1px to 16px (a fork's middle is often half a
  step).
- `board.test.tsx`: the fake ELK's rows were off the grid; Redirect now follows the User's
  aligned port (y 64, path `M 160 128 L 224 128`).

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 124 tests).
- `pnpm test:e2e`: 9 passed on 3 of 5 runs, including the last two on the final code. The other
  two runs each failed one different spec at the fixture's first page load (`Project:` menu not
  visible in 5s, load average about 10). Neither failure reached the canvas, so I take them as
  load flakes, not this change.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium driven by mouse at 1440×900 and 1280×800. I used my own API on 4312
(scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, and stopped both
afterwards. All 10 throwaway projects were deleted (204); only the study that was already there
remains. The owner's 4300/4310 and the `jeeves` database were not touched. There were no console
errors or warnings.

- TinyURL fitted (0.61, chat open) and at about 155% (wheel steps; 1.547): both circled places,
  Redirect → Link cache and Shorten API → Links database, are straight. Tile edges and lines run
  through the dots.
- Rail toggles at both sizes refit to the zooms above.
- Blank: download `+` → Service, Service `+` → Database, upload `+` → Service 2, then Service 2's
  `Request after` dropped on Database. The merge drew Service (centre 96) and Service 2 (256) into
  Database (192). Its lines bend by 96 and 64 on bus x 480. This is the expected case: ELK's
  centre (176) falls on a half step, so the merge takes the nearer grid line and neither line is
  near-straight.
- Analytics worker `+` → Database on TinyURL: the board shifts as before (ELK's layering moves
  everything 64–96px), the merges stay straight, and Undo restores the exact earlier positions.
  Dark mode renders the same.

Docs: the studio guide's Layout section (the grid rules, what is straight, the dots); PLAN (the
Layout paragraph and the `packages/board` row). CATALOG, the settings and blueprint docs needed no
change.

Notes for the next units:

- automation-illustrator has the same gap: no post-ELK alignment, and React Flow's default dot
  phase. When the board is shared, port `align.ts` and the dot offset there.
- What is still not perfectly tidy: a line passing a column (a long edge through ELK dummies)
  keeps ELK's middle row, which may be off the grid. TinyURL has none. Free tiles snap to the
  nearest grid line, so a fork's parent can sit 16px off its children's midpoint.
- `alignLayout` runs inside the engine, so anything calling `toBoardLayout` directly (only the
  tests) must add it.

## 2026-11-05 — DP02: remove both-lane entries (complete)

Owner, 2026-11-05: "both" goes. Each entry is in the download or the upload lane, and a tile has at
most one entry. PL02's additions were removed by hand (no `git revert`); `setEntryLane` stays for
download ↔ upload.

Spec:

- `studio-model.ts`: `studioEntryLanes`, `studioEntryLaneSchema`, `StudioEntryLane` and
  `entryLanes` are gone; an entry's `lane` is `studioLaneSchema` again. **Normalisation:** the one
  place designs are parsed is `studioEntrySchema` (inside `designSchema`, which the server uses for
  every stored revision and undo snapshot); its `lane` is a `z.preprocess` that reads a stored
  `both` as `download`. Anything written back is then `download`. A `setEntryLane` with `both` is
  rejected by the command schema.
- `studio-lanes.ts`: `laneGraph` orders download entries, then upload; `LaneEdge.lane` is a
  `StudioLane`; `laneWords` is gone; caps count one lane per entry.
- `studio-lane-commands.ts`: a lane tab onto a tile that already has an entry, in either lane, is
  refused again: "CDN already starts the download lane; a tile has one entry." (same wording for a
  drop from the same lane). `linkTiles` from a lane always adds an entry. `setEntryLane` takes
  `download`/`upload` and is refused for an unknown entry, the same lane, or a full target lane
  (`laneFull`, kept, now one lane per entry). `laneEntryRefusal` takes a `StudioLane`. `removeLink`
  and `removeTile` lost their both-lane branches.
- `studio-blueprint.ts`: one row per entry again.

Web: `LaneCanvas.tsx` back to one 32×32 chip and `laneNames` = "Download"/"Upload" (labels add
" lane"); `BOTH_CHIP`, `.lane-icon-both` and `LaneIcon`'s `both` are gone. `creation.tsx`: the
middle lane-order group is gone. `Workspace.tsx`: the entry inspector's lane row is the two icons
(`studioLanes`), title "Download lane"/"Upload lane", a full lane disabled with the cap reason.

Chat (`tools.ts`): the instructions say a tile has at most one entry, in one lane; `setEntryLane`
"moves an entry to the other lane"; `getDesign` lists each entry in its one lane with no `lane`
marker.

Tests (122; −3 both-lane tests, +1): dropped the laneGraph both-lane order test, the blueprint
two-rows test and the `linkTiles` upgrade test. `setEntryLane` now moves upload → download, keeps
the cap tests (a full download lane refuses the move and removes the user's download tab). The
canvas helper test checks both refusals in plain words. New: a stored `both` entry parses as
`download` with no findings. `tools.test.ts`: `setEntryLane` with `both` is refused, `download`
moves the entry. E2E `spawn.spec.ts`: the user's upload `+` over the CDN leaves it without the drop
outline (dimmed; Redirect service has it), and after release still 11 lines, the two one-lane
chips, revision 1.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 122 tests).
- `pnpm test:e2e`: 9 passed, first run (load average about 3). No `Project:` menu flake seen.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium driven by mouse at 1440×900, my own API on 4312 (scratch
`JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, both stopped afterwards; the one
throwaway project deleted (204), leaving the study already there. The owner's 4300/4310 and the
`jeeves` database were not touched. No console errors or warnings.

- TinyURL: 10 tiles, 11 lines, two one-icon chips.
- User selected, upload `+` pulled over the CDN: the CDN has no drop outline (Redirect service
  does); released: nothing changed (revision 1) and the notice reads "CDN already starts the
  download lane; a tile has one entry."
- The CDN's chip: inspector "Download lane", lane row of two icons (download pressed). Upload →
  revision 2, the CDN entry in upload, title "Upload lane", chip icon switched; Undo → back.
- Normalisation: I set that project's current revision's Shorten API entry to `"both"` directly in
  `jeeves_e2e` (psql). `GET /projects/:id/design` returned it as `download` with no findings; the
  page loaded with chips "Download lane: User to CDN" and "Download lane: User to Shorten API" and
  the inspector showed "Download lane".

Docs: studio guide (lines, layout order, the drop refusal and its example, the rule paragraph,
removing, the entry inspector's lane row, chat; the Limits note about links after a shared tile is
gone), CATALOG (entries, caps, `linkTiles` refusal, `removeTile`, `removeLink`, `setEntryLane`, the
lane row), studio settings (lane entries, with the `both` → `download` note), blueprint doc (one row
per entry), PLAN (data model, chat; the read/write-tags note removed from Next).

Notes for the next unit:

- The normalisation lives in the stored schema, so it also applies to `setStudio` operations; it
  can be dropped once no stored design has `both` (the owner's `jeeves` database was not scanned).
- `studioEntrySchema`'s input type for `lane` is now `unknown` (preprocess); nothing relies on it.
- A full lane's tooltip in the lane row was checked by unit test, not in the browser.

## 2026-11-05 — DP03: link rules as one table, with reasons; mode from the pair (complete)

Spec:

- `studio-links.ts`: the link rules are data. `studioLinkRules` (exported, for a later blueprint
  version) has 15 rows by source role and target role (`studioLinkRoles`: user, application, cdn,
  external, queue, store; `studioLinkRole(kind)`, `undefined` for `browser`). Each row has
  `modes` (default first), `defaultMode`, optional `targets` (a subset of the target role's kinds)
  and `connection` (kind, label, protocol, settings; entries have none). The interaction follows
  the mode, security is Service identity. `studioEntryKinds` is now derived from the user rows
  (same nine kinds; its type is `readonly StudioKind[]`). New: `studioLinkRule`,
  `studioLinkRuleTargets`, `studioDefaultLinkMode`, `studioLinkRefusal(source | "user", target,
  mode?)`. `studioLinkDefaults(source, target, mode?)`: no mode → the pair's default (async for
  queue links, sync otherwise). Refusal words are today's; the actor's two refusals moved here
  from `laneRules`, which now just calls `studioLinkRefusal`. One order change: a user → non-entry
  kind is refused with "A lane starts at…" even when async (was the async reason).
- `studio-lane-commands.ts`: `addTile.link` and `linkTiles.link` are optional (pair default;
  before a tile, the default of new → host). New `laneOptions(design, from, side)` (seven
  `{type, kind}` / `{type, refusal}`; probe tiles are named by their kind noun, so a reason reads
  "A queue can't link to Links database. A queue feeds only an application, not a database.") and
  `attachOptions(design, node)` (`{tile, lane?, link: {from, to, mode}}` or `{tile, lane?,
  refusal}`; tiles in lane order; the user gets each lane in turn, 2 × tiles). `laneChoices` and
  `laneTabs` keep their signatures and results, built on the same `laneOption` core with a fixed
  mode. `laneLinkRefusal`'s mode is optional.
- Two refusal-order changes so the reasons name the rule rather than the board: `linkRefusal`
  checks the link table before the loop check (Links database → CDN now says "A database can't
  link onward.", not "would make a loop"); `addTile` before a tile checks the new tile's own link
  to the host before the moved incoming links.

Chat (`tools.ts`): the link-table paragraph is generated from `studioLinkRules` (`linkRuleText`,
one sentence per row, e.g. "Application -> queue: async (Publishes)."). The instructions say
`link` is optional; the tool schema already follows `studioCommandSchema`.

Tests (130; +5): `studio-lanes.test.ts` "link table" (the 15 rows with modes and defaults, one row
per pair, no store sources, queue rows only with applications; every pair's default mode and
`studioLinkDefaults` without a mode; every refusal sentence). `studio-lane-commands.test.ts`:
"modes from the pair" (addTile after/before/lane and linkTiles without `link`; an explicit `sync`
to a queue still refused), "lane options" (seven types in order on seven sides, exact options
after Redirect and before Links database, after a queue, from a lane), "attach options" (Links
database → Analytics worker becomes Analytics worker → Links database; forward reason when both
are refused; Redirect's second link; a queue's async default; running an option; the user per
lane). `tools.test.ts`: every row's sentence is in `INSTRUCTIONS`; a chat turn without `link`
publishes and consumes asynchronously. The existing 15×15×2 table test still passes unchanged.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 130 tests).
- `pnpm test:e2e`: 9 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium driven by mouse at 1440×900, my own API on 4312 (scratch
`JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, both stopped afterwards. The canvas
looks and behaves as before, as intended until DP04: TinyURL 10 tiles / 11 lines; tabs User
(Download, Upload lane), Redirect (four), Links database and Link cache (Request before), Click
events (Async before/after); Redirect's Request-after fan shows six types (no Queue) and its
Async-after fan Service, API, Queue, External. Async after → Queue added a Publishes /
Asynchronous link; Undo removed it. Shorten API's Async after onto Click events made a Publishes
link. Links database's Request before onto Analytics worker made a `uses-database` link; onto the
CDN it was dimmed and the notice read "CDN can't link to Links database. A CDN fronts only an
application or object storage, not a database." No console errors or warnings. Housekeeping: my
first script runs read the project ID before the new project's URL had loaded, so they edited and
then deleted the previously open project in `jeeves_e2e` (the auto-created default study) and left
two of mine; I deleted mine (204), and the next page load recreated the default study, so
`jeeves_e2e` again holds just "TinyURL · studio study". The owner's 4300/4310 and the `jeeves`
database were not touched.

Docs: CATALOG "Lanes and links" (roles, the table with modes, defaults and connections, the
default-mode rule, `studioLinkRefusal`, the future generator's badge-and-finding note, `link`
optional on `addTile`/`linkTiles`, `laneOptions` and `attachOptions`); PLAN (the lane model, the
helpers, generated chat table); the studio guide's Chat (optional mode).

Notes for DP04:

- `laneOptions` and `attachOptions` are ready to drive the `+` fan (disabled items with reasons)
  and the link tool; `attachOptions(design, LANE_ACTOR)` filtered by `lane` gives each lane's
  attach tab. Run an accepted option as `linkTiles` with `link: option.link.mode` (or omit it).
- DP04's E2E expectation "A database's left `+` greys Database, Cache, Storage and Queue" is
  incomplete: External is greyed too (an external API can only call an application).
- The web's `connection-drafts.ts` still has its own "Queue connections require Asynchronous"
  check for the line inspector; it agrees with the table but isn't derived from it.

## 2026-11-05 — DP04: + creates, the link tool attaches (complete)

Owner: "+ is for create. The --- is for attaching 2 tiles together", in either direction, with a
link icon.

Board (`packages/board`):

- `TabSpec` is `CreateTab | AttachTab` (`kind: "create" | "attach"`); `tabGlyph(tab)` gives
  `plus` or `link`. A create tab has `items` (and `order`); an attach tab has neither. A create
  pull opens its fan and never drops on a tile: no targets, no scrim (the plan's "no dimming"
  taken literally; the band and fan only), and its ghost never shows "refused". An attach pull
  opens no fan: past 36px the scrim dims the board with holes for the tile and its `canDrop`
  targets (dashed outline, thicker under the pointer); a release on a target is `onDrop`, on any
  other tile `onDropRefused`, elsewhere or Escape springs back. `canDrop` is only asked for attach
  tabs. Gone: the fan "stepping back" on a target (`data-on-tile`), `placeFan`'s `avoid` (no fan
  shares the board with drop targets any more), the dashed band, `DashGlyph` (replaced by
  `LinkGlyph`, Tabler's IconLink paths inline) and `--board-dash`/`--board-dash-ink` (now
  `--board-link`/`--board-link-ink`, same teal).
- `FanItem.disabled` (a reason): drawn in its usual slot with a faded border and a greyed icon,
  `aria-disabled="true"`; its tip shows the name, then the reason (wraps at 240px). A release on
  it springs back and calls nothing. Slots depend only on index and count (`fanCenters`), so a
  caller passing the same items always gets the same places.
- One change beyond the plan: **once past 36px, a pull stays open until it ends** (`Drag.opened`).
  Before, the fan closed whenever the pointer came back within 36px of the tab. With seven items
  always (radius 224px) a tile near the board's edge gets its fan clamped into a column along the
  edge, and one item can land on the tab's own spot; in Blank that made Cache unpickable after
  Redirect service (seen in the browser). Releasing near the tab on nothing still springs back.
- More than two tabs on a side (`data-many`) sit 14px apart instead of 24px, so the user's four
  fit (they reach ~24px past the 160px tile's top and bottom).

Web (`creation.tsx`, rewritten): per tile, `Add before` (left) and `Add after` (right) when
`laneOptions` has a kind on that side; the fan is all seven types from `laneOptions`, refused ones
disabled with the refusal. `Attach` (right, below `Add after`) when `attachOptions` has a link;
`canDrop` is "the option has a link", a drop runs that option's `linkTiles` (from/to as given,
`link` left out, so the pair's default), a refused release shows the option's refusal, or
`laneLinkRefusal`'s for the user ("Links don't lead back to the user; …"), which is not an option.
The user: per lane `Add to download lane` / `Attach to download lane` (and upload), each with the
lane badge; the `+` keeps `laneOrder`. Picks run `addTile` without `link`. Tab titles say what to
pull onto.

Spec: `laneChoices`, `laneTabs`, `LaneTab` and `LaneChoice` (inlined into `LaneOption`) are gone,
and `laneOption` lost its fixed `mode`. `laneLinkRefusal`'s doc now says the canvas uses it for an
attach released on the user.

Tests (130; board +1, spec −1):

- `board.test.tsx`: a create tab's fan keeps every item's slot when one is disabled (positions
  equal `fanCenters`), the disabled item's tip has the reason, releasing on it picks nothing and
  closes the fan, and an enabled item released 10px from the tab after the pull went past the
  threshold is picked (the latch).
- `fan.test.ts`: the drop-target nudge case removed with `avoid`.
- Spec: the "lane choices" test removed (DP03's lane-options tests cover it); the full-lane case
  now asserts `laneOptions`/`attachOptions` instead of `laneTabs`.
- `tools.test.ts`: the canvas-equivalence test uses `laneOptions`, and `addCache` (canvas and
  chat) leaves out `link`.
- E2E `spawn.spec.ts` (6 tests): Redirect has three tabs and its `Add after` fan shows seven
  enabled icons, Cache adds a tile; Links database has two tabs and its `Add before` greys
  Database, Cache, Queue, Storage **and External** (DP03 was right: an external API can only call
  an application, so the plan's list of four was incomplete), Queue's tip gives "A queue can't
  link to Links database. A queue feeds only an application, not a database.", release changes
  nothing; Redirect's `Add before` released on Analytics worker: no outline, no scrim, no notice,
  revision 1; Analytics store's `Attach` onto Redirect service makes `redirect → analytics-store`
  (`uses-database`), Undo removes it; Shorten API's `Attach` onto Click events publishes
  asynchronously; the user's four tabs, and `Attach to upload lane` on the CDN refused with the
  notice.

Checks (Node 24.21.0 first in PATH), on the final code:

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 130 tests).
- `pnpm test:e2e`: 12 passed, on both runs (before and after the latch and docs).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium at 1440×900 driven by mouse (names typed), my own API on 4312
(scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, both stopped afterwards.
The script waited for each new project's URL before acting, and deleted only the projects it
created (all 204); `jeeves_e2e` again holds just "TinyURL · studio study". The owner's 4300/4310
and the `jeeves` database were not touched. No console errors or warnings.

- Tabs on TinyURL: User — right: Add to download lane, Attach to download lane, Add to upload
  lane, Attach to upload lane. CDN, Redirect service, Click events, Analytics worker, Shorten API,
  URL reputation API — left: Add before; right: Add after, Attach. Link cache, Links database,
  Analytics store — left: Add before; right: Attach.
- Redirect's `Add after`: seven icons, none greyed, no scrim; Escape: revision unchanged. Links
  database's `Add before`: Service, API, then five greyed; the Queue tip as above; release: nothing.
  Redirect's `Add before` on Analytics worker: nothing, no notice.
- Analytics store's `Attach`: targets Redirect service and Shorten API; onto Redirect →
  `redirect → analytics-store` sync; Undo removed it. Redirect's `Attach` onto the CDN: dimmed,
  notice "CDN already leads to Redirect service; linking them would make a loop."; onto Analytics
  worker: `redirect → analytics` sync (then Undo); onto the user: the "Links don't lead back to the
  user" notice; Escape mid-attach: nothing. Dark mode: greyed fan and attach scrim read clearly.
- Rebuilding TinyURL from Blank: **11 drags and 6 clicks**, plus 9 names typed. Drags: User
  download `+` → API, CDN `+` → Service, Redirect `+` → Cache, Database, Queue, Click events `+`
  → Service (a worker), Analytics worker `+` → Database, User upload `+` → Service, Shorten API
  `Attach` → Links database and → Link cache, Shorten API `+` → External. Clicks: kind CDN, kind
  Redirect, Redirect reselected twice (after Cache and Database), Fit (the camera had followed the
  new tiles and the user was under the chat rail), the user. The result matched TinyURL: 9 tiles,
  the same kinds, entries, 9 connections and modes (IDs follow the type names).

Docs: studio guide "Creating and connecting" rewritten (two tab kinds, where they show, the
pair's default mode, the greyed fan, the link tool both ways, the user's tabs), "Attaches and
chat edits don't move the camera", and the Limits fan bullet; CATALOG (the canvas paragraph:
`laneOptions` drives the `+` and its greyed fan, `attachOptions` the link tool, both with the
pair's default; the `laneTabs`/`laneChoices` note removed); PLAN (`creation.tsx`, `TileChrome`,
the helper list).

Notes for the next units:

- Rough: near the canvas's edge the seven-icon fan collapses into a column along the edge and can
  sit over the tab and the tile's right side (Blank, Redirect next to the inspector rail). It works
  (the latch), but a fan that flips to the open side would look better; DP07 may want it.
- Rough: with no scrim on a create pull, the fan's icons sit straight on the busy board; readable in
  both themes, but the scrim could come back (uniform, no holes) if the owner prefers.
- The spec's refusals still say "pull from the user's download or upload tab"; still true with the
  user's lane tabs, so left as is.
- DP03's note stands: `connection-drafts.ts` has its own "Queue connections require Asynchronous"
  check.

## DP05 — Inspector: type list, preconfigured kinds, two languages (2026-11-05)

What changed:

- **Type list.** `TileInspector.tsx`'s icon-only kind row is now a labelled **Type** list
  (`KindRow` → `TypeList`; a fieldset with legend "Type"): each kind's icon and name in two
  columns, the current one yellow and `aria-pressed`, a refused one disabled with the reason as
  its title; an enabled kind's title is its one-line description. Shown for Service, API and
  Database. `canvas.css` restyles `.lane-kind` (`.lane-kind-icon`, `.lane-kind-name`).
- **Presets.** `createStudioSettings` (so new tiles and `changeKind`) starts Billing with
  `stripe`, Notifications with `resend`, Identity with `oidc`, Gateway with `traefik` and CDN with
  `cloudflare`. Other choices stay selectable.
- **Two languages per kind.** `studioLanguageSchema` is `typescript | go` (no `unspecified`);
  `studioKindLanguages` holds each coded kind's pair, default first (Redirect `go, typescript`,
  the rest `typescript, go`). Each coded kind's schema takes `z.enum(pair)` with the message
  "Choose TypeScript or Go; this kind offers no other language." Gateway's schema has no
  `language` any more (nor its form field); CDN never had one; browser unchanged. The definition
  fields build the Language select from the kind's pair (`codedApplication(kind)`).
- **Normalising stored designs.** `normalizeStoredStudioSettings`, run as a `z.preprocess` on
  `studioElementBindingSchema.settings` (the model schema, where DP02 normalises `both`): a coded
  kind's language outside its pair, or missing, reads as the kind's default; a gateway's
  `language` is dropped. Commands (`edit`, `addTile`, …) parse settings with the strict
  `studioSettingsSchema`, so an out-of-pair language is refused, not normalised. Values that load
  changed: `unspecified`, `javascript`, `python`, `java`, `csharp`, `rust` on service, worker,
  redirect, identity, notification and billing (→ that kind's default), and any language on a
  gateway (→ removed). Stored providers are not touched (an `unspecified` Billing stays so).
- **Chat.** `catalogSummary` (listStudioDefinitions and the turn context) gives each kind
  `languages` (coded kinds) and `defaults`; `getDesign` gives each coded tile its `languages`. The
  settings JSON Schema in the tool and `describeStudioDefinition` now enumerate each kind's pair.
  The instructions name the presets, the two-language rule, that Gateway/CDN have no language, and
  that a provider on a kind is that service's integration (no separate External tile; External is
  for third parties no kind covers). "kind row" → "Type list" in the `changeKind` line.

Tests (134; spec +4): presets and the `studioKindLanguages` table; `changeKind` to Billing gives
the preset settings; language refusals per kind (Billing, Redirect's own wording, a gateway with a
language, an `edit` command refused); stored `csharp`/`unspecified` normalised to the default and a
gateway's language dropped through `designSchema`. E2E (`edit-history.spec.ts`, 1 new): Shorten
API's Type list names all six kinds with Microservice pressed; Billing → stored `stripe`/
`typescript`, Language offers TypeScript and Go only, Payment provider shows Stripe; CDN →
Gateway: stored `traefik`, no `language`, no Language field.

Checks (Node 24.21.0 first in PATH), on the final code:

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 134 tests).
- `pnpm test:e2e`: 13 passed.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium at 1440×900 by mouse (project names typed), my own API on 4312
(scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, both stopped afterwards.
Each script waited for the new project's URL, and deleted only its projects (three, all 204);
`jeeves_e2e` again holds just "TinyURL · studio study". 4300/4310 and the `jeeves` database were
not touched. No console errors or warnings.

- Shorten API: Type list "Microservice (pressed), Worker service (disabled: Shorten API can't
  become a worker. A lane starts at …), Redirect, Identity, Notifications, Billing".
- Billing: Payment provider Stripe (choices Unspecified, Stripe, External); Language TypeScript,
  Go only, TypeScript selected.
- CDN → Gateway: no Language field, Gateway product Traefik; back to CDN: provider Cloudflare.
- Links database: Database (pressed), Search index disabled ("ID generator in Shorten API can't use
  a search index; …"). Redirect service: Language Go, TypeScript.
- Dark mode (the app's toggle): the list reads clearly; the pressed kind is yellow with dark text.

Docs: studio settings (Language row, new Languages and Defaults sections, the preset providers
first in their rows, the "never filled on read" exception, the External rule), studio guide
(Inspector: the Type list, presets, Language, the External rule), CATALOG (kind table presets,
languages paragraph, the External rule, "Type list"), PLAN (`TileInspector.tsx` line).

Notes for the next units:

- TinyURL (v2) still has its CDN with `provider: "unspecified"` and the URL reputation API as an
  External tile; DP06 replaces the study anyway. DP06's v3 languages (Redirect Go, the rest
  TypeScript) all fit their pairs.
- Rough: the Type list's two columns truncate long names with an ellipsis if the inspector rail
  is dragged narrow; at the default width every name fits.
- `studioLanguageSchema` is now just the union of the pairs; a study needing another language for
  a new kind (DP08/DP09) adds it there and to `studioKindLanguages` together.

## 2026-11-05 — DP06: TinyURL v3 from published designs; one writer per store (complete)

What changed:

- **TinyURL v3** (`studio-tinyurl@3.0.0`, `studio-examples/tinyurl.ts`), exactly the plan's
  design: Stats API, Redirect service, URL cache, URL database, Click events, Analytics worker,
  Analytics store, Shorten service; owners URL database → Shorten, URL cache and Click events →
  Redirect, Analytics store → Analytics worker; 8 tiles, 10 links (3 entries, 7 connections), 9
  modules (Redirect 4, worker 3, Stats API 1, Shorten 1). Removed: CDN, URL reputation API, rate
  limiter, ID generator, reputation check. The doc comment cites the four designs and Dub. IDs:
  `redirect` and the click path keep theirs (so the chat fixture is unchanged); new ones are
  `stats-api`, `shorten`, `url-cache`, `url-db`, `stats-read`, `stats-data`, entries
  `download-stats-api`, `download-redirect`, `upload-shorten`. The analytics worker is now
  TypeScript; the redirect responder has `edgeMaxAgeSeconds: 0` ("no edge caching").
  `goalManifestSha256` is now the SHA-256 of the study's description (the manifest files it once
  hashed are long gone; nothing reads it but the schema's hex check).
- **Entry order (a decision):** the Stats API's entry comes before the Redirect service's. With
  Redirect first, ELK routed Stats API → Analytics store below every tile, along the URL
  database's bottom edge (20 bends in all); with Stats first it runs along the top row and the
  user → Redirect line and the click path are straight (12 bends). All 12 orderings of entries
  and Redirect's links were compared with real ELK; Redirect's links stay in the plan's order
  (cache, database, click events).
- **One writer per store** (`studioStoreAccess(design, connection)` in `studio-links.ts`):
  `"write"` from the store's owner (or a member of the owning package), `"read"` otherwise, a store
  with no owner only read, `undefined` for links that don't end at a database, search index,
  cache or object storage (queues keep publish/consume). Derived, never stored.
  `studioStoreAccessLabels` give "Writes (owner)" / "Reads". Shown in: the line inspector (under
  the two tiles), the store's tile inspector (a "Writes (owner) / Reads" list under the Type list,
  `.lane-store-access`), each store link's row in the Connections tab, chat's `getDesign` links
  (`access`) and the instructions (one line), and the blueprint.
- **Blueprint is now `blueprint: 2`.** Version 1 already had `access` on connections holding the
  planned security ("Service identity"). The plan's `access: "write" | "read"` changes that
  field's meaning, which the blueprint doc calls breaking, so: the old value moved to `security`,
  `access` is the read/write enum, and `blueprintVersion` is 2. To match, the line inspector's
  "Access" field (`planned.security`) is now labelled **Security**, and chat's `editConnection`
  line says "security".
- E2E fixture (`e2e/studio.ts`): it now opens a project no test deletes (the first one not named
  "E2E TinyURL") before New project. With v3's faster tests, `/` sometimes opened another test's
  most recent project as it was being deleted ("Couldn't load the design", no Project menu). Before
  the change: 2 of 3 full runs had one failure (one confirmed as this; the other, in the queue
  attach test, wasn't captured) and a 3× spawn run had one (this). After: 4 full runs, no failure.

Tests (135; spec +1): blueprint counts, IDs, entries and every connection's access/channel use;
`studioStoreAccess` owner writes, others read, `edit` owner → Redirect flips both, owner `null` →
read. Every TinyURL-based unit test moved to v3 (apply, operations, modules, lanes, lane commands,
chat tools, projects route, board layout). Where v2 had what a test needed and v3 doesn't, the test
builds it: a CDN inserted before Redirect for the restitch case, an External after Shorten for a
tile with no entry (in v3 every tile that could start a lane already does), a fourth service for
the entry cap, a Shorten → Stats API link for HTTPS request policies. The board layout fixture is
v3 in canvas order: straight `actor-redirect`, `redirect-events`, `events-worker`, `shorten-db`;
the Analytics store one layer after the worker. E2E (14, +1): counts 9 tiles / 10 lines / 3
chips, no CDN; a new canvas test reads URL database's writer and readers, the "Reads" line, then
changes the owner and checks both the list and the blueprint; remove now removes Click events
(restitched as Redirect → Analytics worker, async) and undoes; the user's tabs test shows no
attach tabs until an External is added after Shorten, then refuses Redirect service in the upload
lane; the Type list test makes its API tile from the user's upload `+` (Gateway → CDN → Gateway).
The chat fixture is unchanged: `redirect` and `redirect-cache-2` still fit.

Checks (Node 24.21.0 first in PATH), on the final code:

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 135 tests).
- `pnpm test:e2e`: 14 passed (and 14 passed on three more full runs after the fixture change).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse, my own API on 4312 (scratch `JEEVES_HOME`, scripted model,
`jeeves_e2e`) and web on 4302, both stopped afterwards. Each script waited for its new project's
URL and deleted only its projects (three, all 204); `jeeves_e2e` again holds just "TinyURL ·
studio study" (still v2: it predates this change). 4300/4310 and the `jeeves` database were not
touched. No console errors or warnings.

- v3 renders as planned: Stats API top row, Redirect service on the user's row with the click path
  straight after it, URL cache above and URL database below, Shorten service bottom. No vertical
  segment under 32px. Straight: user → Redirect, Redirect → Click events → Analytics worker,
  Shorten → URL database. Bent by whole steps: the other two entries, Redirect → cache and → database
  (a fork), Stats API → Analytics store and the worker's write (a merge).
- Fit zoom 1440×900: 0.93 rails closed, 0.73 chat, 0.72 inspector, 0.52 both; 1280×800: 0.83,
  0.63, 0.62, 0.42 (the studio guide's table).
- Stores: URL database "Writes (owner) Shorten service · Reads Redirect service"; URL cache
  "Redirect service · nobody else"; Analytics store "Analytics worker · Stats API". Click events has
  no list. Connections rows end "· Reads" / "· Writes (owner)"; the lines say "Reads" and
  "Writes (owner)", and a click on the Stats API → Analytics store line on the canvas says "Reads".
  Owner → Redirect service (the native select, set with `selectOption`): the list flips to
  "Redirect service · Shorten service"; Undo flips it back. Dark mode (the app's toggle) reads
  clearly.

Docs: studio guide (TinyURL section rewritten with sources, the lane diagram, owners and "Why there
is no CDN"; layout, fit zooms, removal, notices, Inspector store list and line, chat, Limits),
studio settings (Security row, one-writer paragraph, owner note), blueprint doc (`blueprint: 2`,
`security`/`access`, regenerated example, versioning note), CATALOG (one-writer paragraph, v3
examples, Study), PLAN (blueprint 2, owner as writer, v3).

Notes for the next units:

- Rough: a new link into a store still gets the action "Reads & writes" from the link table even
  when its source isn't the owner (so it reads). The label is free text and the derived access is
  right; changing the table's default by ownership would need the owner in `studioLinkDefaults`.
  Noted in Limits.
- Rough: removing a tile restitches its lane entry under a new free ID when the old ID was the
  removed tile's (a CDN inserted before Redirect and removed again gives `download-redirect-2`).
  Pre-existing; the unit test records it.
- The owner's existing projects (and `jeeves_e2e`'s default) stay v2: designs are stored, not
  regenerated. Only new copies are v3.
- DP08/DP09: `studioStoreAccess` covers object storage and search too, so a marketplace's catalog
  owner writes and search readers read; the CDN → object storage link reads.

## 2026-11-05 — DP07: design polish acceptance and documentation (complete)

A mouse walkthrough of DP01–DP06 and a docs sweep. No code changed: the walkthrough found no
defect small enough to fix here, only rough edges (below).

Browser: Playwright Chromium driven by mouse (names typed), my own API on 4312 (scratch
`JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, both stopped afterwards. Each
script waited for its new project's URL and deleted only its projects (seven: TinyURL v3 copies and
two Blank rebuilds, all 204); `jeeves_e2e` again holds just "TinyURL · studio study" (v2). I did not
touch 4300/4310 or the `jeeves` database. No console errors or warnings in any run.

- **TinyURL v3** (new copy): 8 tiles + user, 10 lines, 3 chips; entries download Stats API,
  download Redirect, upload Shorten (Stats API's entry first, as DP06 decided; the blueprint sorts
  entries by lane then element). Fit zooms match the guide's table exactly: 1440×900 0.93 / 0.73 /
  0.72 / 0.52, 1280×800 0.83 / 0.63 / 0.62 / 0.42 (closed / chat / inspector / both). Straight:
  user → Redirect, Redirect → Click events → Analytics worker, Shorten → URL database.
- **Tabs per tile**: User: Add to download lane, Add to upload lane (no attach tabs: every tile
  that could start a lane already does). Stats API, Redirect service, Click events, Analytics
  worker, Shorten service: Add before, Add after, Attach. URL cache, URL database, Analytics
  store: Add before, Attach.
- **Store access**: URL database "Writes (owner) Shorten service · Reads Redirect service"; URL
  cache "Redirect service · nobody else"; Analytics store "Analytics worker · Stats API"; Click
  events none.
- **Attach both ways**: Analytics store's Attach targets Redirect service and Shorten service;
  onto Redirect → `redirect → analytics-store` (request); Undo. Shorten's Attach onto Click events
  → Publishes / Asynchronous; Undo. URL cache's Attach targets Stats API, Analytics worker, Shorten
  service; released on Click events (dimmed): "URL cache can't link to Click events. A cache can't
  link onward.", nothing changed.
- **Greyed fan**: URL database's Add before: Service, API, then Database, Cache, Queue, Storage,
  External greyed; Queue's tip "A queue can't link to URL database. A queue feeds only an
  application, not a database."; release: nothing. Analytics worker's Add after: seven, none grey.
- **Type list and presets**: Shorten service lists Microservice (pressed), Worker service
  (disabled, reason in the title), Redirect, Identity, Notifications, Billing. Billing: Payment
  provider Stripe (Unspecified, Stripe, External), Language TypeScript (TypeScript, Go). A new API
  from the user's download `+` is a Gateway with `traefik` and no Language; CDN → `cloudflare`.
- **Lane entries**: that API's chip → lane row Download (pressed), Upload; Upload moved it
  (entries download Stats API, Redirect; upload Shorten, API), chips relabelled.
- Both sizes, rails open and closed (selecting opens the inspector, as documented), light and dark
  (the app's toggle): everything reads; the dimmed attach board and the greyed fan are clear in
  dark mode.
- **Rebuilding TinyURL v3 from Blank** (1440×900 and 1280×800, both rails open, the same count at
  both): **10 drags and 9 clicks**, plus 8 names typed. Drags: user download `+` → Service (Stats
  API) and → Service (Redirect service); Redirect `+` → Cache, → Database, → Queue; Click events `+`
  → Service (a worker); Analytics worker `+` → Database; user upload `+` → Service (Shorten);
  Shorten `Attach` → URL database; Stats API `Attach` → Analytics store. Clicks: Fit (the user had
  left the view once the chain grew), the user twice, kind Redirect, Redirect reselected twice,
  Stats API, URL database, and its Owner select → Shorten service (it starts as Redirect's,
  added next to it). The result matches the study: same kinds (Redirect Go, the rest TypeScript,
  the worker a worker), entries in the same order, the same 7 connections and modes, and an
  identical layout. Blueprint 2, no findings, access `write` for Redirect → cache, Shorten → URL
  database and worker → Analytics store, `read` for Redirect → URL database and Stats API →
  Analytics store, publish/consume on the queue.

Docs:

- Studio guide, Limits: the both-rails zooms were v2's (0.44/0.35); now TinyURL v3's 0.52/0.42
  with the tab sizes they give (about 21px/17px), the edge fan can sit over the tile's own tabs,
  and a new bullet: a notice stays until dismissed, Undo/Redo or another project, so a fan opened
  near the bottom after a refusal can sit over it.
- CATALOG: the tile-type intro said the fan shows "only the types the link table accepts" (now all
  seven, refused ones greyed); Settings said connections carry "access" (now security, with the
  derived read/write access on store links).
- PLAN Next: DP01–DP07 done; DP08–DP10 next. Plan status: a Progress line (DP01–DP07 done,
  DP08–DP10 remain).
- Checked and already right: blueprint doc (`blueprint: 2`, `security`/`access`, example), studio
  settings (Security row, one-writer paragraph, languages, defaults, `both` note), the guide's
  TinyURL section (Stats API first, why no CDN), README, docker and C4 notes.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 193 files; type checks; 22 files / 135 tests).
- `pnpm test:e2e`: 14 passed (also 14 passed before the walkthrough).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Follow-ups (not fixed here):

- Rough: a refusal's notice stays across later successful edits and pulls; near the bottom edge
  the fan and its tip overlap it (1280×800, URL database's Add before right after a refused
  attach). Clearing the notice when a pull starts, or on the next successful edit, would fix it;
  that is a behaviour choice for the owner.
- Rough (DP04's, still true): near the canvas's edge the seven-icon fan lines up in a column,
  sometimes over the tile's own tabs; a fan that flips to the open side would look better.
- Rough (DP06's, still true): a new link into a store says "Reads & writes" even when it reads
  (Redirect → URL database in the rebuild).
- Rebuilding needs the URL database's owner changed by hand: a store belongs to the application
  it was first added next to. Adding it from the Shorten service instead would fix the owner but
  not the order of Redirect's links.
- The owner's API on 4310 was listening when this unit started and was not by the end; I did not
  stop it (I stopped only my own two PIDs) and did not restart it.

## 2026-11-05 — DP08: marketplace study (complete)

What changed:

- **Marketplace study** (`studio-marketplace@1.0.0`, `studio-examples/marketplace.ts`), offered by
  New project after TinyURL (the default). A multi-seller marketplace with Etsy's core flows as
  clean microservices: 17 tiles, 21 links (7 entries: download Orders service, Storefront API,
  Image CDN; upload Shop service, Identity, Payments, Cart service; 14 connections, 6 dashed),
  16 modules. Every service TypeScript on Docker. Validates with no findings; blueprint 2 has 8
  services, 9 resources, no externals, 14 connections, 23 component links, nothing omitted.
  ```text
  DOWNLOAD  User ⇣ Orders service → Orders database                  (reads)
            User ⇣ Storefront API → Search index                     (reads)
            User ⇣ Image CDN → Product images                        (reads; resizes on request)
  UPLOAD    User ⇡ Shop service → Product images, Catalog database   (only writer of both)
                                ⇢ Listing events ⇢ Search indexer → Search index
            User ⇡ Identity
            User ⇡ Payments → Catalog database (reads prices), Payments database
                            ⇢ Order events ⇢ Order recorder → Orders database
            User ⇡ Cart service → Cart store
  ```
- **Research** (cited in the factory's doc comment and the guide): Educative and System Design
  Handbook (e-commerce write-ups), ByteByteGo's payment system, Google's Online Boutique, Microsoft's
  eShop (its AppHost wiring read with `gh`: Basket.API on Redis, Catalog/Ordering/Identity on their
  own Postgres databases, RabbitMQ events, an OrderProcessor worker on the ordering database), Stripe
  Connect's separate charges and transfers, Cloudflare's and AWS's image-delivery reference
  architectures, and for where Etsy differs High Scalability and Code as Craft (2010). HelloInterview
  has no written e-commerce breakdown (only a video), and DesignGurus' e-commerce pages are
  paywalled, so neither is cited. The plan's open questions, settled from the sources: search is an
  index fed through listing events (Educative, Handbook); thumbnails are resized on request at the
  edge (Cloudflare, AWS: originals only), so no thumbnail worker; the cart is its own service with
  a Redis store (all four).
- **Design decisions** (each in the guide): browsing and selling are separate services (the
  Storefront API reads only the index; the Handbook keeps catalog data for reading in search
  indexes); checkout is Payments' job (Stripe Checkout; the designs' separate checkout also
  orchestrates stock, shipping and email, all left out); orders are recorded once paid, by an Order
  recorder, and read by the Orders service (TinyURL's analytics pattern; links can't loop back from
  Payments); Stripe holds seller balances; no line to Identity (tokens verified locally); left out:
  stock, shipping, emails, a gateway (every design has one; on the lanes it would be a lane's only
  entry and hide what buyer and seller reach), recommendations, ads, currencies. One project:
  splitting selling from buying would cut the catalog read and the payouts in two.
- **How the layout was chosen.** A first design with a separate Checkout service, Checkout → Cart
  service, Shop → Payments (payout setup) and Storefront → Catalog database drew one bus from
  Product images down to Payments shared by four services (the TinyURL v2 complaint). The final
  design leaves each service at most one shared target. I then scored all 144 entry orders with
  real ELK plus `alignLayout` (a scratch script; crossings, bends, length): 48 of them put a
  download entry among the upload entries; of the rest, the shipped order has the fewest crossings
  (2, both where the Order recorder's line rises past the Search index's input), then bends (26).
- **Extension ladder.** Step 2: nothing. Step 3: a CDN setting, **Image resizing**
  (`imageResizing?: "disabled" | "on-request"`, absent = unspecified) — schema
  (`studioCdnImageResizingSchema` on `studioCdnSettingsSchema`), form (an optional select in the
  CDN definition's Options, labels Disabled / On request), validation (the enum, strict), blueprint
  (resource `settings`, additive within `blueprint: 2`), chat (the settings JSON Schema and
  `describeStudioDefinition` pick it up), docs. Need: a product grid wants every photo at several
  sizes, and the existing options could only say so in a purpose. Template: the CDN product's own
  resizing, configured (Cloudflare image transformations; AWS's Dynamic Image Transformation stack
  in front of CloudFront). Step 4: `laneLimits.entriesPerLane` 3 → 4. Need: the upload lane has
  sign-in, the shop, Payments (the checkout) and the cart; a gateway would hide them. Template:
  none (a canvas rule). Step 5: nothing.
- **New project**: the study card says "Start from a design study built from published designs.";
  the Study list has both; the project name follows the chosen study until typed over
  (`ProjectChooser.tsx`).
- E2E helper: `createTinyUrl` is now `createStudy(page, name?, study?)` (exported); its "stable
  project" is the first one whose name doesn't start with "E2E " (was: not the test's own name).

Tests (138; +3): the marketplace validates and its blueprint counts, kinds, entries and every
connection's access/channel use (`studio-blueprint.test.ts`); the CDN field (Options, optional,
choices), accepted and refused values, set and cleared with an `edit` (`studio-operations.test.ts`).
The cap tests now add two download entries to TinyURL (cap 4, messages "4 entries; the most is
4", "5 entries; the most is 4"); chat's `caps` is `{4, 4}`. E2E (15, +1, `canvas.spec.ts`): New
project → Study Marketplace → 18 tiles, 21 lines, 6 dashed, 7 chips; the Image CDN's Image resizing
reads `on-request`; Catalog database "Writes (owner) Shop service · Reads Payments"; deletes its
project in `finally`.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 194 files; type checks; 22 files / 138 tests).
- `pnpm test:e2e`: 15 passed (twice).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse (project names and the native Study select set with
`selectOption`), my API on 4312 (scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on
4302, both stopped by PID afterwards. Five marketplace projects created and deleted (all 204; one
script crashed on a selector and I deleted its project by ID); `jeeves_e2e` again holds just
"TinyURL · studio study". No console errors or warnings.

- The chooser lists "TinyURL · studio study" and "Marketplace · studio study"; choosing the
  marketplace renames the project and shows its description.
- Renders as designed, lanes in order, no vertical segment under 32px. Fit zoom is height-bound
  (1,088 × 1,312px): 0.415 at 1440×900 and 0.364 at 1280×800 in every rail state.
- Every tile's inspector: services TypeScript (TypeScript|Go), Docker, public; Payments Billing
  with Payment provider Stripe; Identity with OpenID Connect; Image CDN Cloudflare, Image resizing
  On request, Cache redirects Unspecified; Product images Cloudflare R2, public; Search index
  OpenSearch; databases PostgreSQL (Catalog partitioned by `shop_id`); topics with retention and 6
  partitions; Cart store Redis-compatible, TTL 604800, No eviction; workers concurrency 4 on queue
  lag. Store lists: Orders database "Order recorder · Orders service", Search index "Search indexer
  · Storefront API", Product images "Shop service · Image CDN", Catalog database "Shop service ·
  Payments", Payments database and Cart store "· nobody else". Modules as listed in the guide.
  Payments → Catalog database line: "Reads". Dark mode (the app's toggle) reads clearly.

Delivery: the owner's API on 4310 was not running, so I started one on 4313 against the `jeeves`
database (scratch `JEEVES_HOME`, no model) and a web on 4303, created the study through New
project by mouse, reloaded it (18 tiles; blueprint 2, no findings) and stopped both by PID. The
project: **`4222440b-cdad-47f4-897b-f36136cd452e`, "Marketplace · studio study"** (revision 1).
The owner's other project (`41bbd268-…`, "TinyURL · studio study", revision 39) is unchanged. I did
not touch 4300 or 4310.

Docs: studio guide (Projects, the marketplace fit zooms, the 4-entry cap and its tooltip, the
CDN's Image resizing in the Inspector, "The default study" for TinyURL, a new "The marketplace
study" section with flows, sources, the settled questions, lanes, owners, tiles and modules,
decisions, where Etsy differs, the two canvas additions and an "On Cloudflare" mapping; Limits:
tall designs fit small, the marketplace's shared buses), CATALOG (CDN row, caps, `setEntryLane`,
"Studies"), studio settings (CDN row and an Image resizing paragraph), PLAN (studies; DP01–DP08
done; next DP09–DP10), README, the plan's Progress line (DP01–DP08 done).

Notes for the next units:

- Rough: at fit the marketplace's tile names are too small to read (0.42/0.36). `FIT_PADDING`
  (0.28 of the design's size on each side, `packages/board/src/react/camera.ts`) costs a tall design
  36% of its zoom; a fixed 64px margin would fit it at about 0.59 at 1440×900. An owner decision.
- For DP10: the guide says download entries are drawn above upload entries, but ELK doesn't always
  keep that. Reproduce: reorder the marketplace's entries to Storefront, Image CDN, Orders | Shop,
  Payments, Cart, Identity; the Orders service is drawn between Payments and the Cart service (48
  of the 144 orders interleave). The shipped order doesn't.
- Rough: two shared buses remain (Image CDN and Shop service into Product images; Shop service
  and Payments into the Catalog database) and two crossings at the Search index's input.
- DP09: the cap is now 4 entries per lane; the CDN has `imageResizing` (thumbnails could use it;
  video segments don't need it); `createStudy(page, name, study)` makes a study project in E2E.
  Scoring entry orders with real ELK before fixing a study's entry order paid off here.

## 2026-11-05 — DP09: YouTube study (complete)

What changed:

- **YouTube study** (`studio-youtube@1.0.0`, `studio-examples/youtube.ts`), offered by New project
  after TinyURL and the marketplace. A video-sharing site with YouTube's core flows as clean
  microservices: 14 tiles, 20 links (6 entries: download Search API, Watch API, Video CDN; upload
  Upload service, Original videos, Identity; 14 connections, 9 dashed), 16 modules. Every service
  TypeScript on Docker. Validates with no findings; blueprint 2 has 6 services, 8 resources, no
  externals, 14 connections, 23 component links, nothing omitted.
  ```text
  DOWNLOAD  User ⇣ Search API → Search index                         (reads)
            User ⇣ Watch API → View counts, Metadata database        (reads)
                             ⇢ View events ⇢ View counter → View counts
            User ⇣ Video CDN → Encoded videos                        (reads; resizes thumbnails)
  UPLOAD    User ⇡ Upload service → Original videos                  (starts, signs, completes)
                                  ⇢ Upload jobs ⇢ Video processor → Original videos (reads),
                                    Encoded videos, Metadata database, Search index (writes)
            User ⇡ Original videos                                   (the parts, signed URLs)
            User ⇡ Identity
  ```
- **Research** (cited in the factory's doc comment and the guide): ByteByteGo *Design YouTube*,
  HelloInterview *YouTube*, DesignGurus' Grokking *Designing YouTube or Netflix* and its crash
  course *Design YouTube*, Vitess history, AWS's multipart-upload docs and its presigned
  multipart blog, Cloudflare R2 pricing and the CDN's service terms. Educative's YouTube lesson
  shows only its intro and AlgoMaster's is paywalled, so neither is cited. ByteByteGo and
  HelloInterview leave search and view counts out; the crash course covers both (a search service
  over Elasticsearch filled when a video becomes playable; view counts in their own store).
- **Design decisions** (each in the guide): one writer per store, so the Video processor writes
  a video's metadata once, when playable, from the title and description the upload job carries,
  and indexes it (the sources write metadata from both the API and the pipeline; HelloInterview's
  processing service writes it back, which this follows); the Upload service keeps no database
  (the multipart upload is the state); one Video processor with modules instead of ByteByteGo's
  DAG workers and completion queue and handler; views summed per video and added in batches;
  thumbnails stored once and resized on request by the Video CDN; Cloudflare R2 behind the
  Cloudflare CDN (no egress fees; the CDN terms want video through the developer platform);
  MySQL with `video_id` as partition key (Grokking, the crash course, Vitess); no line to
  Identity; left out: comments, likes, recommendations, subscriptions, monetisation, live
  streaming, editing after upload, custom thumbnails, a metadata cache and a gateway.
- **How the layout was chosen.** A first design followed ByteByteGo closely (a Ready videos
  completion queue and a Catalog writer worker after the transcoder, 16 tiles): with real ELK
  plus `alignLayout` it drew 1,376px wide, with the Watch API's line looping round the far right
  to the Metadata database and every line into storage sharing one bus. Folding the catalog write
  into the Video processor (HelloInterview's shape) took it to 992px. I then scored the 36 entry
  orders that keep download above upload, crossed with every order of the Video processor's,
  Watch API's and Upload service's links (10,368 layouts; a scratch script, not committed):
  crossings, stretches shared by unrelated lines, height. The shipped order draws no crossing and
  is the shortest (992×800); six orders also avoid its one shared stretch (the Video CDN's and
  the Upload service's lines run together into the store column) but are 1,024px tall and put
  two pairs of unrelated lines 7px apart, which reads the same at fit. Dropping the user's entry
  into Original videos made it worse (2–7 crossings), so it stays.
- **Extension ladder.** Nothing added (steps 2–5 all unused). Existing options covered it: the
  user → object-store entry (the link table already allows it) for presigned part uploads, the
  CDN's Image resizing (DP08) for thumbnails, work-queue and topic modes, MySQL with partition key
  and read replicas, the auth-guard module for Identity's token. Three entries per lane, within
  the cap of four.

Tests (139; +1): the YouTube study validates with no findings, its blueprint's services, kinds,
module counts, resources, entries, component-link count, every connection's access or channel
use, and the CDN's settings (`studio-blueprint.test.ts`). E2E (16, +1, `canvas.spec.ts`): New
project → Study YouTube → 15 tiles, 20 lines, 9 dashed, 6 chips; Original videos "Writes (owner)
Upload service · Reads Video processor"; Metadata database "Writes (owner) Video processor ·
Reads Watch API"; deletes its project in `finally`.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 195 files; type checks; 22 files / 139 tests).
- `pnpm test:e2e`: 16 passed (three runs; the first failed on my own wrong tile count, 17 for 15,
  which I fixed in the test).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse (the native Study select set with `selectOption`), my API on
4312 (scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, both stopped by PID
afterwards. Two YouTube projects created and deleted (both 204); `jeeves_e2e` again holds just
"TinyURL · studio study". No console errors or warnings.

- The chooser lists TinyURL, Marketplace and YouTube; choosing YouTube renames the project and
  shows its description.
- Renders as designed, no crossings; readable at fit. Fit zooms: 1440×900 0.65 (closed, chat or
  inspector) / 0.52 (both); 1280×800 0.57 / 0.42.
- Every tile's inspector: services TypeScript (TypeScript|Go), Docker, public; Identity OpenID
  Connect; workers on queue lag (Video processor concurrency 1, up to 50 replicas); Video CDN
  Cloudflare, Image resizing On request; Encoded videos R2 public, Original videos R2 private;
  Search index OpenSearch; Metadata database and View counts MySQL, partition key `video_id`,
  read replicas 3 and 2; View events a topic (12 partitions, retention 86400), Upload jobs a work
  queue (604800). Store lists: Search index, Metadata database and Encoded videos "Video processor
  · …", View counts "View counter · Watch API", Original videos "Upload service · Video
  processor". Modules as listed in the guide. The Video processor's Connections list says Reads
  for Original videos and Writes (owner) for the other three. Dark mode reads clearly.

Delivery: the owner's API on 4310 was not running, so I started one on 4313 against the `jeeves`
database (scratch `JEEVES_HOME`, no model) and a web on 4303, created the study through New
project by mouse, reloaded it (15 tiles, 20 lines; blueprint 2, revision 1, no findings) and
stopped both by PID. The project: **`7eef33c4-b6a5-4e80-8bd7-72cbf7e78b1b`, "YouTube · studio
study"** (revision 1). The owner's other projects (`4222440b-…` Marketplace revision 1,
`41bbd268-…` TinyURL revision 39) are unchanged. I did not touch 4300 or 4310.

Docs: studio guide (Projects, the YouTube fit zooms, a new "The YouTube study" section with flows,
sources, what they agree on, lanes, owners, tiles and modules, decisions, where YouTube differs
and "nothing added"; Limits: YouTube's store-column bus), CATALOG (three studies, YouTube),
studio settings (Image resizing also for thumbnails), PLAN (studies; DP01–DP09 done; next DP10),
README, the plan's Progress line (DP01–DP09 done).

Notes for the next unit (DP10):

- Rough: every store sits in the last column, so all lines into the five stores share one
  vertical bus, and the Video CDN's line runs with the Upload service's for 384px before it.
  Selecting a tile colours its lines; the Connections list is exact. A layout question for the
  owner, as DP08's buses were.
- The Video processor is at the 4-link cap, so its right `+` is hidden; adding (say) a
  notifications step after it means another worker behind a queue, or dropping a link.
- The guide's claim that download entries draw above upload entries held for all 36 YouTube
  orders I scored with download entries first (DP08 found it doesn't always hold).

## 2026-11-05 — DP10: review of the design polish units (complete)

A review of what DP01–DP09 left between them, not a second acceptance pass. `/code-review` ran at
`high` on `2b9eff5..HEAD` (ten candidates); I kept only what I could show. Code changed: two stale
comments. Docs changed: one false sentence (twice in the guide, once in a doc comment), the plan's
status and PLAN's Next.

### Ledger

How checked: "open" items were re-read in the current code or docs; "fixed" items in the unit and
test named; scratch scripts (real ELK plus `alignLayout`, the spec's commands) where a number is
quoted. Owner decisions are listed under Questions, not here.

| From | Item | Status |
| --- | --- | --- |
| DP01 | automation-illustrator lacks `align.ts` and the dot offset | Open (port when the board is shared) |
| DP01 | A line passing a column keeps ELK's middle row; a fork's parent can sit 16px off centre | Open, documented (guide, Layout). No route crosses a tile in 182 study layouts checked |
| DP01 | Callers of `toBoardLayout` outside the engine must add `alignLayout` | Still applies (tests only) |
| DP01 | The "lift" refinement beyond the plan | Stands, unit-tested |
| DP01 | E2E load flake at the first page load | Fixed by DP06 (the fixture opens a stable project) |
| DP02 | `both` normalisation can go once no stored design has it; `jeeves` not scanned | Open (I did not touch `jeeves`) |
| DP02 | A full lane's tooltip in the lane row was unit-tested only | Open |
| DP03 | `connection-drafts.ts` restates queue ⇒ Asynchronous | Open: agrees with the table and validation, not derived (finding 3) |
| DP03 | DP04's greyed list missed External | Fixed by DP04 (E2E checks five) |
| DP03 | Two refusal-order changes; user → non-entry gives "A lane starts at…" | Stand (recorded deviations) |
| DP04 | Edge fan lines up in a column over the tile's own tabs | Open (DP07 confirmed; guide Limits) |
| DP04 | Refusals say "pull from the user's download or upload tab" | Still true |
| DP04 | `data-many` tabs 14px apart | Stands |
| DP05 | TinyURL v2's unspecified CDN and External reputation API | No longer applies (v3) |
| DP05 | Type list truncates in a narrow inspector rail | Open |
| DP05 | Stored providers are not normalised (an `unspecified` Billing stays) | Stands, documented |
| DP06 | A new link into a store says "Reads & writes" even when it reads | Open (guide Limits) |
| DP06 | Removing a tile restitches its entry under a new free ID | Open (pre-existing, unit test records it) |
| DP06 | The owner's existing projects stay v2 | Still applies |
| DP06 | Blueprint 2 renamed `access` → `security` and reused `access` for read/write | Stands (question 7) |
| DP07 | A notice stays across later edits; a fan near the bottom can cover it | Open (question 5) |
| DP07 | Rebuilding TinyURL needs the URL database's owner set by hand | Open |
| DP07 | The owner's API on 4310 stopped during DP07 | Not a code item; not checked |
| DP08 | Guide: download entries are drawn above upload entries | **Fixed here** (finding 1) |
| DP08 | `FIT_PADDING` 28% makes tall studies fit at ~0.4 | Open (question 1) |
| DP08 | Marketplace shared buses and two crossings at the Search index | Open (question 2) |
| DP08 | Cap 4 entries per lane; CDN `imageResizing` | Complete: schema, form, validation, blueprint, chat, docs, tests |
| DP09 | YouTube store-column bus | Open (question 2) |
| DP09 | The Video processor is at the 4-link cap (no right `+`) | Open, by design |

### Findings

| # | Severity | Where | What goes wrong | Reproduce | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Low (docs) | `docs/studio.md:25,46`, `packages/spec/src/studio-lanes.ts:29` | Said download entries are drawn above upload entries; ELK can interleave them | Marketplace entries ordered Storefront, Image CDN, Orders \| Shop, Payments, Cart, Identity: Orders service y 928, between Payments (672) and Cart (1,088); 48 of 144 orders interleave (real ELK + `alignLayout`) | Fixed: "usually", with the count |
| 2 | Low | `apps/web/e2e/studio.ts:65`, `apps/web/src/canvas/canvas.css:265` | Comments still named the removed `Request after` tab and the icon-only kind row | Read them; no such tab or row exists | Fixed |
| 3 | Low | `apps/web/src/studio/connection-drafts.ts:109-115`; `apps/server/src/chat/tools.ts:90` | Rules restated by hand: queue ⇒ Asynchronous/publish/consume in the line form; the five presets in the chat instructions. Both agree with the spec today | — (no divergence to show) | Follow-up |
| 4 | Medium | `packages/spec/src/studio-lane-commands.ts` (`addTile` before a store, `removeLink`; `adoptOrphans`) | When the owner's link into a store is moved or removed, the store keeps its owner, so no link writes it and no finding says so; the store inspector still says "Writes (owner) Shorten service" | TinyURL: URL database `Add before` → Service: `svc → url-db` reads, owner still `shorten`, blueprint has no `write` into `url-db`. Or remove `shorten-db`: same | Follow-up (question 6) |

Code-review candidates dropped: route middle runs crossing pushed tiles (none in 182 study layouts;
ELK's x is already on the grid), language normalisation hiding intent (the plan's instruction),
dark-mode attach-tab ink (contrast about 4.3:1, unchanged since before DP04), repeated lane checks
per selection, unused `studioEntryKinds` (CATALOG documents it) and a duplicated coded-kind
narrowing (refactors, not defects).

Seams checked and clean: the `both` and language normalisations compose in the one stored schema
(`studioEntrySchema`, `studioElementBindingSchema`) and both are in studio settings; commands parse
settings strictly (`edit` with `csharp` refused; DP05's tests); raw `setStudio` operations do
normalise (DP02 noted it). No code, export, CSS, test, chat text or doc outside history still
uses `laneChoices`, `laneTabs`, `DashGlyph`, `entryLanes`, a `both` lane or an `unspecified`
language. All three studies validate with no findings after a JSON round trip through
`designSchema`; the blueprint doc's TinyURL example matches `designBlueprint` exactly.

### Questions for the owner

1. The fit's 28% padding: tall studies fit at about 0.4 (marketplace 0.42/0.36). Keep, or a
   fixed margin (~0.59 at 1440×900)?
2. Shared buses into stores (marketplace: two; YouTube: one column bus for all five stores).
   Accept, or a layout change?
3. DP01's dot offset (dots on the grid crossings): keep?
4. DP04's fan latch (stays open past 36px) and no dimming on a `+` pull: keep?
5. Should a notice clear on the next successful edit, or when a pull starts?
6. When the owner's link into a store is moved (`Add before` the store) or removed, should the
   ownership move, the owner be cleared, or validation report a store with no writer? Today
   nothing changes (finding 4).
7. Blueprint 2 reuses the name `access` with a new meaning (read/write); a v1 reader gets no
   error. Keep, or rename (for example `storeAccess`)?
8. Should the layout keep download entries above upload entries always (an alignment rule),
   rather than usually (finding 1)?

### Checks (Node 24.21.0 first in PATH), on the final tree

- `pnpm check`: exit 0 (Biome 195 files; type checks; 22 files / 139 tests).
- `pnpm test:e2e`: 16 passed, first run.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse at 1440×900, my API on 4312 (scratch `JEEVES_HOME`,
scripted model, `jeeves_e2e`) and web on 4302, both stopped by PID afterwards. A new TinyURL
project renders (9 tiles with the user, 10 lines); selecting Shorten service by mouse shows the
Type list with names (the CSS file I touched); dark mode shows Redirect's tabs and the Attach glyph
legibly. Two projects created, waited for by URL and deleted (204); `jeeves_e2e` again holds just
"TinyURL · studio study". No console errors or warnings. 4300/4310 and the `jeeves` database were
not touched.

Docs: the guide's lane intro and Layout paragraph, `laneGraph`'s doc comment, the plan's status
(complete) and PLAN's Next.

## 2026-11-06 — LA01: action tiles (complete)

What changed:

- **Model** (`studio-model.ts`): `studio.actions` (optional), each `{ lane, name }`
  (`studioLaneActionSchema`; `name` 1–24 characters, `studioLimits.actionName`, messages "Name the
  action with a word." / "Use 24 characters or fewer."). Two in one lane are invalid ("Each lane has
  one action; the upload lane has 2."). `studioActionDefaults` (Consume, Produce) and
  `studioActions(studio)`: the stored actions in lane order plus a default one for each lane that
  has entries but no action. The model schema's parse stores that (a `.transform` after the
  `superRefine`), so it sits with the `both` and language normalisation; laneGraph, the blueprint
  and chat read through `studioActions` too, so an in-memory draft behaves the same. The name
  `studioActionSchema` was taken (a connection's action label), hence `studioLaneAction*`.
- **Link table** (`studio-links.ts`): new `action` role; rows `user → action` and `action →`
  today's entry kinds and `cdn` (all sync). `user → object-store`, `user → external` and the old
  user rows are gone; `studioEntryKinds` are now the action rows' targets (no `object-store` or
  `external-api`). Refusals: "The user links only to its actions; each lane starts at one.", "Only
  the user links to an action.", "An action reaches a service (not a worker), an API or the CDN."
  The chat link paragraph is generated, so it now has "User -> action: sync." and "Action -> CDN:
  sync (a lane entry)."
- **Lane graph** (`studio-lanes.ts`): action nodes `@download` / `@upload` (`laneActionNode`,
  `laneActionOf`; `LaneNode.action`) after the actor, the user's lines `@actor-download` /
  `@actor-upload` (`laneActionLine`; no design ID), and entries now run from their action node.
  `laneRules` maps the actor to `user` and action nodes to `action`, and caps an action at
  `entriesPerLane` through the board (below). `laneFindings`: a refused entry reads "Open link can't
  link to URL database; an action reaches …" (the plan's form); a tile with two entries (now two
  different source nodes) is checked explicitly; an action's cap is "Open link has 5 entries; the
  most is 4." (path to the action). `laneActionName(design, lane)`.
- **Commands** (`studio-lane-commands.ts`, wired in `buildStudioCommand`): `addAction { lane, name?,
  system? }` (refused "This design already has a Produce action; each lane has one."; `system`
  starts a blank project, like `addTile`), `renameAction { lane, name }`, `removeAction { lane }`
  (removes the action and its entries; refused "Removing Shorten would cut off Shorten service.").
  `addTile` from a lane stores that lane's action with its default name first. `linkTiles` from a
  lane with no action and `setEntryLane` to a lane with no action are refused ("The upload lane has
  no action yet; add its Produce action first."); a full action: "Open link already has 4 entries;
  the most is 4." Before-insert, removal restitching and `changeKind` name the action as the source
  ("Shorten service can't become a worker. An action reaches …"). Helpers: `laneActionOptions`,
  `laneRemoveActionRefusal`; `attachOptions(design, laneActionNode(lane))` lists one action's
  candidates and returns `[]` for the user; `laneOptions` from a lane with no action answers as if
  the action existed.
- **Stored entries into storage/external** (YouTube 1.0.0's `upload-parts`): they load unchanged
  and are a `LANE_INVALID` finding ("Produce can't link to Original videos; an action reaches a
  service (not a worker), an API or the CDN."), and commands refuse new ones. Because
  `applyOperations` rejects any batch whose result still has a studio structural finding, such a
  design takes no other edit until that entry goes; so `removeLink` of a link the rules refuse is
  accepted on a broken design (a repair: it skips the board edit, still refuses to strand tiles,
  and adds no new finding). Every other lane command says "Fix the lanes first. …".
- **Board** (generic, no Jeeves code): `Rules.maxOut` may be a function per tile (`maxOutOf`);
  `LineSpec.removable: false` hides a selected line's X (`BoardLineData.fixed`).
- **Canvas**: `tiles/ActionTile.tsx` (128×128, the user's pastel, the lane icon in a round badge,
  the name at 22px, 18px over 9 characters, 15px over 14); `LaneIcon`/`laneNames` moved to
  `canvas/LaneIcon.tsx`; `LaneCanvas.tsx` draws action tiles, plain user→action lines with no X,
  no entry chips, and labels lines "Open link to Redirect service" (`laneNodeName`).
  `creation.tsx`: the user has one `+` ("Add action") whose fan is Consume and Produce (greyed with
  the reason when present; gone when both exist) and no attach tab; an action has "Add after" (the
  seven-type fan, only Service and API enabled) and "Attach", no left `+`. A new action is selected
  with its Name focused. `removal.tsx`: an action's X pre-checks `laneRemoveActionRefusal`, then
  runs `removeAction` and selects the user. `Workspace.tsx`: `ActionInspector` (heading, Name via
  `studio/ActionForm.tsx` — a form-drafts spec, so it autosaves after 500ms or on blur through
  `renameAction` — Lane read-only, Entries as buttons), the entry summary shows the action and its
  lane row (`setEntryLane`), and the user→action line has a short summary. Chat selection sends no
  ID for the user, an action or the user's line (IDs starting with `@`). CSS: `.lane-action*`,
  `.lane-facts`, `.lane-action-entries`, `.lane-fan-action`; the unused `.board-chip svg` rule went.
- **Chat** (`tools.ts`): the commands come with `studioCommandSchema`; `getDesign` has `actions`
  (each `{ lane, name, entries, tiles }`) in place of `lanes`; the instructions say what an action
  is in two sentences (defaults and the name limit from the spec), list the three action commands,
  and update addTile, linkTiles, setEntryLane and the caps line ("entries per action").
- **Blueprint** (still `blueprint: 2`): top-level `actions` (`{lane, name}`, lane order) and each
  entry `{ lane, action, element }`.
- **Studies**: TinyURL 3.1.0 (Open link, Shorten), marketplace 1.1.0 (Browse, Buy & sell), YouTube
  1.1.0 (Watch, Publish; `upload-parts` removed; doc comment, the Upload service's purpose and the
  goal text now say the Upload service writes Original videos, so its `goalManifestSha256` is the
  new text's). `createStudioStudy` takes `actions`. Layout tuning left for LA03.

Tests (144; +5): link rows (user → action only, action → store/external/queue/worker refused,
modes); `studioEntryKinds`; laneGraph nodes and edges with actions; a design stored with entries and
no actions (both defaults; composed with `both`; a stored name kept; two in one lane; a long name);
a stored entry into Original videos (loads, one finding); actions (`laneActionOptions`, addAction on
blank with `system`, rename, remove alone, remove refused and allowed, `planRemoveTile` on an
action); the legacy design (new entry refused, other commands "Fix the lanes first", `removeLink`
repairs it); `addTile` from a lane creating Produce then Consume; linkTiles/setEntryLane without an
action; blueprint actions and entries for all three studies; chat addAction/rename/remove and
getDesign `actions`. E2E (17; +1): counts with actions and no chips in the three studies; the user's
`+` gone in TinyURL, Open link's fan greys stores ("Open link can't link to object storage. …"),
Shorten's Attach refuses Redirect service and makes a new Service its entry; a new test builds
Watch → API → Produce from Blank (Name focused, Consume greyed with its reason); the blueprint test
reads `actions`; edit-history adds its API from Shorten's `+`. `createStudy(page, name, "blank")`
makes a blank project. The chat fixture needed no change (it edits `redirect`).

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 198 files; type checks; 22 files / 144 tests).
- `pnpm test:e2e`: 17 passed (twice, the second on the final code).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse, my API on 4312 (scratch `JEEVES_HOME`, scripted model,
`jeeves_e2e`) and web on 4302, stopped by PID afterwards (the API was restarted once to run the
final code). Every script waited for its new project's URL and deleted only its projects (all
204); `jeeves_e2e` again holds just "TinyURL · studio study". I did not touch 4300, 4304, 4310 or
the `jeeves` database. No console errors or warnings in any run.

- Blank: the user's only tab is "Add action"; its fan is Consume, Produce. Consume → an action tile
  named Consume, selected, Name focused; typing "Watch" renamed it (autosave). Watch's tabs: "Add
  after" only (nothing to attach yet); its fan: Service and API, the other five greyed. API added.
  The user's `+` again: Consume greyed, tip "This design already has a Consume action; each lane has
  one."; Produce added. Watch's inspector: "Consume action: what the user does in the download
  lane", Name, Lane Download, Entries API. Watch's X: notice "Removing Watch would cut off API."
  The User → Watch line: no X; its inspector names the action. The Watch → API entry: lane row,
  Upload moved it to Produce (stored `upload`); Watch's X then removed it and selected the user;
  Undo brought it back. Dark mode (the app's toggle): the action tiles read clearly.
- Studies at 1440×900 and 1280×800: TinyURL 11 tiles / 12 lines (Open link, Shorten), marketplace
  20 / 23 (Browse, Buy & sell), YouTube 17 / 21 (Watch, Publish); no chips; blueprints list the
  actions with no findings.
- Fit zooms now (closed / chat / inspector / both): TinyURL 0.85 / 0.67 / 0.66 / 0.48 at 1440×900,
  0.75 / 0.57 / 0.56 / 0.38 at 1280×800; marketplace 0.42 and 0.36 whatever the rails; YouTube 0.60
  (one rail at most) / 0.48 (both) and 0.53 / 0.38.

Docs: studio guide (lane canvas: actions and the action tile; Layout and the fit table; Creating and
connecting: the user's `+`, an action's tabs; Removing: an action's X, the user's line; Inspector:
action and entry; History; Chat; the three studies' lane diagrams, counts and versions; Limits:
both-rails zooms, chat selection, legacy entries), CATALOG (lanes and links, the table, the legacy
finding, caps, the three action commands, helpers, canvas wiring, studies), studio settings (new
Actions section, Lane entries), blueprint doc (`actions`, entries' `action`, the example, additive
within v2; the example matches `designBlueprint` at revision 1), PLAN (web files, board, data model,
lane model, commands, helpers, chat, Next: LA01 done, LA02–LA05 remain).

Notes for the next units:

- Deviation: the refusal says "a service (not a worker), an API or the CDN" (the plan's example has
  no "(not a worker)"); a worker can't be an entry, and the old wording said so too.
- Decision: `linkTiles` from a lane with no action is refused rather than creating the action (the
  plan names only `addTile`); chat's instructions and the refusal say to add it first.
- Rough: selecting an action sends chat no identity (actions have no design ID); "rename this" with
  an action selected needs words. Noted in Limits.
- Rough: a design broken only by a stored entry into storage takes no edit but that entry's
  removal. LA04: the owner's YouTube copy (`7eef33c4…`) has one (`upload-parts`), as its plan
  replaces it anyway. The owner's TinyURL (`41bbd268…`) is v2, whose factory entered at a CDN and
  a service, so it should load with Consume and Produce and no finding; I did not open the `jeeves`
  database to check (its revision 39 may differ), which LA04 does.
- LA02: an action with no entries is allowed and has no finding yet (Blank's Produce above). The
  board's per-tile `maxOut` makes the action's entry cap a board rule, so "too-many-links" on an
  action node is that cap.
- LA03: the graph order is actor, `@download`, `@upload`, then tiles; band membership can come from
  which action reaches a tile. Action tiles are 128×128 like other tiles. The YouTube Video CDN /
  Upload service bus and the marketplace's buses remain; the studies' entry orders were chosen
  before the action column existed.
- `LineSpec.chip` stays in the board (generic) but Jeeves no longer uses it; board layout tests
  still use chips in their own fixture.

## 2026-11-06 — LA02: design warnings (complete)

What changed:

- **Spec** (`packages/spec/src/studio-warnings.ts`, new): `studioWarnings(design)` returns
  `{ rule, node, message }`, `node` being the tile's ID or the action's `laneActionNode`. Rules
  (`studioWarningRules`): `store-without-writer` (no owner, or no link into the store has
  `studioStoreAccess` `write`; package owners included), `output-unread` (a store, not a cache,
  whose every lane-graph line in comes from its owner, and the owner is a worker),
  `queue-without-publisher`, `queue-without-consumer`, `action-without-entries`. Messages name
  the tiles and say what to do ("URL database has no writer: its owner Shorten service doesn't
  link to it. Link Shorten service to it, or choose another owner."). `studioWarningSummaries`
  and `studioWarningSentence` (the chat sentence, generated from the list).
- **How warnings are kept apart from errors:** a new finding code `DESIGN_WARNING` in a new
  catalog category `warning` (severity `warning`), with `isDesignWarning`. `validateStudio`
  appends `studioWarningFindings` last. `isStructural` is false for it, so `applyOperations`
  (which rejects on structural studio findings) ignores it. The lane commands' gate ("Fix the
  lanes first.", `requireLanes`, `laneOptions`, `laneActionOptions`, `attachOptions`) reads
  `laneFindings` only, which never includes warnings. Errors are unchanged. A target is
  `{ element }` for a store or queue and `{ path: [architecture, studio, actions, i] }` for an
  action.
- **Canvas:** `canvas/Warnings.tsx`: `WarningMark` (a 22px yellow circle with a triangle in the
  tile's top-right corner, inside a pill's curve; its `title` is the message) on `Tile` and
  `ActionTile` (LaneCanvas maps warnings by node); `WarningList` (yellow rows) in the tile
  inspector below its kind, in the action inspector, and in the system inspector (no selection),
  which lists every warning with a button that selects its tile or action. CSS `.lane-warning-mark`,
  `.lane-warnings`. The canvas showed no studio findings before (only a module's Readiness list),
  so this is the new place.
- **Chat** (`tools.ts`): `getDesign` and every accepted `applyStudioCommands` return `findings`
  (warnings filtered out) and `warnings` (messages). The instructions gain one bullet,
  `studioWarningSentence`: the four warnings in words, "They never block a command; before you
  finish, resolve the warnings your edits caused, or say why one stays."
- **Blueprint:** shape unchanged (still `blueprint: 2`); `findings` may now hold
  `DESIGN_WARNING`. Doc comment updated.

Tests (151; +7 in `studio-warnings.test.ts`): the three studies have no warnings and no findings;
DP10's reproduction both ways (Add before URL database; remove `shorten-db`) gives warning 1, it is
non-structural, and relinking clears it; a store with no owner; `output-unread` firing (remove
`stats-read`) and not firing for a worker's own cache or a service's own database; a queue added
after Shorten (no consumer, still accepted, the worker still offered after it) and cleared by a
worker; a queue with no publisher; an action with no entries (blank + addAction) and its path
target, cleared by an entry; the chat sentence contains every summary. Chat test: two empty
actions come back as `warnings` with `findings: []`, and `INSTRUCTIONS` contains the sentence.
E2E: the Blank test checks the mark and inspector text on a new action, its clearing after an
API, the Produce mark and the system list's button selecting Produce; the three study tests check
no marks.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 201 files; type checks; 23 files / 151 tests).
- `pnpm test:e2e`: 17 passed (twice; the second on the final code).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse at 1440×900, my API on 4312 (scratch `JEEVES_HOME`,
scripted model, `jeeves_e2e`) and web on 4302, both stopped by PID afterwards. Each project's URL
was awaited before acting; I deleted only mine (all 204; two from a first run that timed out
were deleted through the API); `jeeves_e2e` again holds just "TinyURL · studio study". I did not
touch 4300, 4304, 4310 or the `jeeves` database. No console errors or warnings.

- Blank: User `+` → Consume: the action shows the mark and its inspector the yellow row
  ("Consume has no entries: …"). Consume `+` → Service: mark gone. User `+` → Produce: Produce
  marked; clicking empty paper lists it in the system inspector; its "Produce" button selects the
  action. Produce `+` → Service: no marks.
- TinyURL (no marks): clicking the Shorten service → URL database line and its X leaves URL
  database marked; its inspector shows "URL database has no writer: its owner Shorten service
  doesn't link to it. …" above Writes (owner) Shorten service. Undo: no marks, 12 lines.
- Dark mode (the app's toggle), TinyURL with the Stats API → Analytics store line removed:
  Analytics store marked; "Nothing reads Analytics store: only its owner Analytics worker links to
  it. …"; the yellow rows and the link-styled tile button read clearly.

Docs: studio guide (new Warnings section; inspector: tile, action and system lists; Chat; Limits:
the mark's size at fit), CATALOG (design warnings table under Lanes and links), blueprint doc
(`findings` and `DESIGN_WARNING`), PLAN (validation, chat, Next: LA02 done).

Notes for the next units:

- Rough: at TinyURL's both-rails fit (0.48) the mark is about 11px; the system inspector is the
  readable place.
- Rough: `queue-without-publisher` can only appear on a design that already has a lane error (a
  queue with no link in is unreachable); it is there for stored designs and for completeness.
- `output-unread` counts every line into the store, entries included, so a legacy entry into a
  store counts as a reader.
- Chat sees warnings, but whether a live model resolves them is untested (only the scripted model
  ran), as for the rest of the chat instructions.
- LA04: "a warning appearing and clearing" is quickest from Blank (a new action) or by removing
  the Shorten service → URL database line in TinyURL.

## 2026-11-06 — LA03: lane bands (complete)

What changed:

- **Spec** (`studio-lanes.ts`): `laneBandOrder` (`download`, `shared`, `upload`), `LaneBand` and
  `laneBands(graph)`: `nodes` (a tile only Consume reaches is `download`, only Produce `upload`,
  both `shared`; an action is in its own lane's band; the actor and unreachable tiles have none)
  and `edges` (each line in its source's band; the user's lines none). `laneGraph`'s doc comment
  no longer says "usually above".
- **Board** (generic; `packages/board` still imports no Jeeves code): `LayoutTile.band` and
  `LayoutLine.band` (`TileSpec.band`, `LineSpec.band` pass them), included in `graphKey`. New
  `layout/bands.ts`: `usesBands(input)` (some tile has a band, every tile without one has no
  lines in, no chips, no loop; otherwise the old single pass), `bandColumns`, and
  `layoutBands(elk, key, input, previous)`: (1) columns by longest path, as ELK's
  LONGEST_PATH_SOURCE; (2) each band laid out alone by ELK with those columns (INTERACTIVE
  layering from x hints, BK as before, rows in model order or the shown order) and put through
  `alignLayout`; a long line leaving its band ends at a zero-size stub in its target's column, so
  the band keeps a track for it; (3) bands stacked on the grid `BAND_GAP` (32px) apart, tracks kept
  16px clear of the aligned tiles (and following their source onto the grid when level); a tile
  without a band (the user) centred on the tiles it links to; (4) one routing pass over the whole
  board with INTERACTIVE crossing minimisation and node placement and zero in-layer spacing
  (`ROUTE_OPTIONS`), every track given as bend points, and one input port per band on a tile
  several bands enter (and one output port per band, for generic callers); (5) `alignLayout`,
  then `meetAtPorts` (new `layout/junctions.ts`): where two bands' lines into a shared tile run
  together for more than `JUNCTION_PX` (32), it moves a bus onto the slot 32px left of the tile or
  swaps it with the bus there, keeping a move only when `bandClashes` (cross-band collinear runs
  that overlap or meet end to end, outside the 32px window; and crossings) gets better. The engine
  calls `layoutBands` for banded input. `ROOT_OPTIONS`' `edgeEdgeBetweenLayers` is now 32 (was
  16) for every layout, so every gap is a multiple of 32 and every column and vertical run sits on
  a grid line. `elkTile`, `stabilityHints` and `byHint` are exported from `elkGraph.ts`.
- **Canvas**: `canvas/laneLayout.ts` `laneLayoutInput(graph)` gives each node its size and band
  index (`laneBandOrder`) and each line its band; `LaneCanvas` builds its tiles and lines from it.
- **Studies** (entry orders re-chosen with real ELK under the bands; doc comments say how):
  TinyURL unchanged (3.1.0, already best); marketplace 1.2.0: Storefront API, Orders service,
  Image CDN | Shop service, Identity, Payments, Cart service; YouTube 1.2.0: Watch API, Search API,
  Video CDN | Identity, Upload service. Connection orders unchanged (none changed the drawing).

Why this approach, by measurement (real ELK plus `alignLayout`, scratch scripts not committed;
sizes include the 32px padding; "row violations" are pairs of tiles of a lower band not above a
higher band's):

| Variant | TinyURL | Marketplace | YouTube |
| --- | --- | --- | --- |
| Before (LA02 tree) | 1152×608, 0 crossings, 18 bends, 2 row violations | 1184×1312, 2, 30, 6 rows, 48px shared across lanes | 1152×928, 2, 30, 11 rows, 480px shared (the CDN line on the processor's bus) |
| One pass, bands in model order | same | same | 1 crossing, 9 rows, 320px shared |
| One pass, plus a port per band | same | 6 rows, 64px shared | 5 crossings, 12 rows, 48px shared |
| That result shifted apart by band, re-routed by ELK | 0 rows | 1824 tall | 1984 tall, 10 crossings |
| Per-band ELK stacked, routed by ELK without tracks | 0 rows | 2 crossings | 1376 tall, 5–7 crossings, lines meander |
| Final (tracks, 32px slots, `meetAtPorts`, re-chosen orders) | 1184×800, 0, 20 | 1248×1632, 1, 34 | 1248×1376, 3, 42 |

BK aligns tiles across bands, so ordering or splitting ports in one pass can't give strips;
shifting one pass apart keeps its spread. Per-band layouts keep BK's look inside a band and the
stacking guarantees the rows; ELK's interactive routing kept every requested position (zero
moved in all studies) once the long lines' tracks went in as bend points. Two things were left:
with 16px slots a gap of four buses is 112px, so `alignLayout` snapped the next column 16px right
and every bus ended at least 48px before the port (fixed by 32px slots); and in YouTube ELK put
the Search API's bus next to the store column and the Video processor's further left (a tie in
its slot order), so the CDN's and the Watch API's reads ran 64px with the processor's lines
(fixed by `meetAtPorts`, which swaps the two). The orders: all 12 TinyURL, 5,184 marketplace and
3,456 YouTube entry × link orders were laid out; none breaks the bands; the chosen ones have the
fewest crossings, then bends. YouTube's three crossings are where the Search API's and the Video
CDN's reads cross the processor's bus to the stores above theirs: with three stores fed from both
lanes, every order has them. The marketplace's one is the Orders service's read crossing the
Search indexer's write into the Search index above.

Tests (162; +11):

- Board (`layout.test.ts`, +4): `usesBands` cases; a two-lane fixture with two shared stores
  (every lower band above every higher one, no cross-band shared run by an independent checker,
  `bandClashes` 0, each shared store's lines meeting exactly 32px before its port, the user
  centred between its actions, `expectClean`); relayout with its own positions identical and a
  tile added after the chain's end moving nothing; `meetAtPorts` on a hand-made layout (moves the
  upload bus to 32px before the tile). The known-options check covers `BAND_OPTIONS` and
  `ROUTE_OPTIONS`.
- Web (`canvas/laneLayout.test.ts`, +5, real ELK through `createLayoutEngine` and
  `laneLayoutInput`): for each study every tile in its band's rows, Consume above the user's
  centre and Produce below, no two lines of different bands sharing or touching a run outside
  the 32px before a shared tile, tiles and ports on the grid, routes orthogonal from port to port,
  no jog under 32px, no line through a tile, crossings 0 / 1 / 3; YouTube's Video CDN → Encoded
  videos shares nothing with the Upload service's two lines and meets the processor's write only
  in the last 32px; YouTube relayout identical and a tile after View counts moving nothing.
- Spec (`studio-lanes.test.ts`, +2): TinyURL's bands node by node, the lines' bands, the shared
  stores of the marketplace and YouTube, a store becoming shared when the Shorten service links
  to it, no bands without actions.
- With `meetAtPorts` disabled for a run, four of these fail (the board fixture, the hand-made
  case, YouTube's study test and its CDN test), so they catch the junction step.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 205 files; type checks; 24 files / 162 tests).
- `pnpm test:e2e`: 17 passed (twice; the second on the final code). No E2E change was needed.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse (the native Study select with `selectOption`), my API on
4312 (scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, stopped by PID
afterwards (tsx 1620927 and its node child 1620984, vite 1614677). Three projects (LA03 tinyurl,
marketplace, youtube) created, each URL awaited, all deleted (204); `jeeves_e2e` again holds just
"TinyURL · studio study". I did not touch 4300, 4304, 4310 or the `jeeves` database. No console
errors or warnings.

- The three studies render in bands at the fitted zoom at 1440×900 and 1280×800: download on top,
  the shared stores between, upload below; the user at the left between its two actions.
- Fit zooms (closed / chat / inspector / both): TinyURL 0.70 / 0.65 / 0.64 / 0.46 at 1440×900 and
  0.62 / 0.56 / 0.55 / 0.37 at 1280×800 (was 0.85 / 0.67 / 0.66 / 0.48 and 0.75 / 0.57 / 0.56 /
  0.38); the marketplace 0.33 and 0.29 in every rail state (was 0.42 and 0.36); YouTube 0.39 and
  0.35 in every rail state (was 0.60 / 0.48 and 0.53 / 0.38).
- YouTube where the owner circled, zoomed with the wheel: the Video CDN's solid line runs right
  on its own row and comes down its own column, meeting the Video processor's dashed bus only in
  the last 32px before Encoded videos; the Upload service's lines run along the bottom of the
  upload band. Clicking Video CDN colours only its entry and its read; clicking the Upload
  service only its three lines.
- TinyURL: Redirect service → its `+` → Database by mouse: the new store (owned by the Redirect
  service) sits in the download band above the URL database; Undo returns to 11 tiles.

Docs: studio guide (lane intro: drawn above and below, the shared band; Layout: the bands, how
they are drawn, 32px bus spacing, the merge example, the fit table and the studies' sizes and
zooms; the three studies' lane diagrams, versions, shared tiles and how their orders were chosen;
Limits: fit zooms, the bands' height cost, buses now within one lane, the junction step's limit
and loops), CATALOG (lane bands paragraph, study versions), PLAN (Layout paragraph, web and board
rows, Next: LA03 done).

Notes for the next units:

- Owner question (open, out of scope): the bands make the studies taller (YouTube 928 → 1,376px,
  marketplace 1,312 → 1,632px), so the 28% fit padding costs more: YouTube now fits at 0.39 at
  1440×900. DP08's fixed-margin idea would give back much of that (YouTube roughly 0.5).
- Same-lane buses remain by design (the plan's rule is about different bands): the marketplace's
  Shop service and Payments into the Catalog database; YouTube's Upload service's write joins the
  processor's bus into Original videos. DP10's Q2 is answered for buses across lanes only.
- `meetAtPorts` is best effort: one move or swap at a time, kept only when clashes drop. Checked
  on the three studies and the board fixtures; an unusual design could still leave two lanes'
  lines together for more than 32px (guide, Limits).
- 32px bus spacing applies to every layout; gaps with several buses are wider (the studies grew
  32–96px wider). Revert `edgeEdgeBetweenLayers` only together with a fix for the column snap.
- A banded board with chips falls back to the single pass (Jeeves uses no chips). A tile without
  a band must have no lines in; its lines get no track, which is fine for the user (its lines are
  one column long).
- Each layout is now one ELK run per band plus one to route (30–100ms per study in Node); the
  worker keeps it off the main thread.
- LA04: the owner's TinyURL (`41bbd268…`, v2) will lay out in bands too; its stored entries decide
  which stores are shared. The new marketplace and YouTube copies get the 1.2.0 orders.
