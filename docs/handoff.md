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
