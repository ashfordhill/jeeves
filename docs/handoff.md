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

## 2026-11-06 — LA04: lane actions acceptance and documentation (complete)

A mouse walkthrough of LA01–LA03, the owner's study copies replaced, and a docs sweep. No code
changed: the walkthrough found no defect, only rough edges (below).

Browser: Playwright Chromium by mouse (names typed; the native Study select with
`selectOption`), my API on 4312 (scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on
4302. Each script waited for its new project's URL and deleted only its projects (four per run,
all 204; earlier runs that stopped on my script's own timing were cleaned up the same way);
`jeeves_e2e` again holds just "TinyURL · studio study". No page errors, console errors or
warnings in any run.

- **A small YouTube-like design from Blank** at 1440×900, both rails open: **11 drags and 17
  clicks**: 13 tile selections (several re-select the tile just added), the CDN Type button and
  Fit 3 times; plus 9 names typed. Drags: User `+` → Consume; Watch
  `+` → API (Watch API); Watch API `+` → Database (Video database); User `+` → Produce; Publish
  `+` → Service (Upload service); Upload service `+` → Storage (Original videos) and → Queue
  (Upload events); Upload events `+` → Service (Video processor, a worker); Video processor's link
  tab → Video database; Watch `+` → API (Video CDN, then **CDN** in its Type list); Video CDN's
  link tab → Original videos (its drop targets: Watch API, Upload service, Original videos, Video
  processor). Result: 10 tiles, 11 lines, actions Watch and Publish, entries Watch API, Upload
  service, Video CDN; Original videos and Video database sit in the shared band; blueprint
  findings `[]`; fit 0.46, and 0.36 at 1280×800 in dark mode.
- **The greyed second action:** with Watch present, the User's `+` fan shows Consume greyed,
  tip "This design already has a Consume action; each lane has one."; Produce added. With both
  actions the User shows no tabs.
- **Warnings appearing and clearing:** a new Watch carries the mark "Watch has no entries: …"
  until Watch API is added; Publish's mark until the Upload service; Upload events "has no
  consumer: … Add a worker after it." until the Video processor. Then the Upload service →
  Original videos line by its X: Original videos marked, its inspector's yellow row "Original
  videos has no writer: its owner Upload service doesn't link to it. Link Upload service to it,
  or choose another owner."; Undo: no marks, 11 lines.
- **The three studies in bands**, new projects, 1440×900 and 1280×800, light and dark (the app's
  toggle), chat open: TinyURL 11 tiles / 12 lines (Open link, Shorten), fit 0.65 / 0.56;
  marketplace 20 / 23 (Browse, Buy & sell), 0.33 / 0.29; YouTube 17 / 21 (Watch, Publish), 0.39 /
  0.35. No marks, no findings. Download on top, shared stores between, upload below, the user at
  the left between its actions; dark mode reads clearly.
- **Readability of the fitted view** (fit padding not changed, an open owner question): at
  YouTube's 0.39 and the marketplace's 0.33 the bands, the line structure and the action words
  (about 9px) read; tile names are about 5px and need the wheel. The YouTube fit is
  height-bound and leaves wide empty margins left and right at 1440×900.

**The owner's `jeeves` database** (my API on 4313 against `jeeves`, scratch `JEEVES_HOME`, web
on 4303; both stopped by PID; 4300, 4304 and 4310 untouched):

- TinyURL `41bbd268-9244-47cc-be63-66c5e61d116c` opened read-only: 12 tiles, 13 lines, action
  tiles **Consume** and **Produce** (added by normalisation; entries CDN and Shorten API), no
  marks, blueprint findings `[]`, fit 0.55. Its design JSON before and after the session is
  identical (revision 39, `updatedAt` 2026-11-05T23:25:51Z). No clicks on its canvas.
- Deleted through Project → All projects → trash → Delete: "Marketplace · studio study"
  `4222440b-cdad-47f4-897b-f36136cd452e` and "YouTube · studio study"
  `7eef33c4-b6a5-4e80-8bd7-72cbf7e78b1b`.
- Created through Project → New project → Architecture study (default names):
  - **Marketplace · studio study `81571ba1-c2da-4896-a79c-c31557f164ca`**: 20 tiles, 23 lines,
    Browse and Buy & sell, no marks, findings `[]`, fit 0.33.
  - **YouTube · studio study `7ec5980c-6191-40a4-8688-fa2dd8821d54`**: 17 tiles, 21 lines, Watch
    and Publish, no marks, findings `[]`, fit 0.39.
- The database now holds exactly those two and TinyURL.

Docs: studio guide Limits (the fitted view's readability in numbers; attaching to a tile out of
view needs Fit first); PLAN Next (LA04 done, LA05 remains); this plan's Progress line (LA01–LA04
done, LA05 remains). Checked and already current: the guide's lanes, creating and connecting
(the User's `+` gone with both actions), inspector, warnings, layout and fit table (matches the
zooms above), the three studies' sections and versions (3.1.0, 1.2.0, 1.2.0); CATALOG (link table,
caps per action, warnings, bands, study versions); studio settings (Actions, Lane entries);
blueprint doc (`actions`, entries' `action`, `DESIGN_WARNING`); README.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 205 files; type checks; 24 files / 162 tests).
- `pnpm test:e2e`: 17 passed.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Rough edges (not fixed; for LA05 or the owner):

- An attach target out of view can't be dropped on: two of my attaches silently did nothing
  until I pressed Fit (the board doesn't zoom as a chain grows). Documented in Limits.
- The User's fan opens over the existing action tile, so the greyed Consume icon sits on top of
  Watch (DP04's fan placement, still open).
- A CDN entry is made as an API and then switched to CDN in the Type list; the action's fan has
  no CDN item. Matches the guide (API: Gateway or CDN) but takes a second click.
- Fit padding (owner question): see readability above.

## 2026-11-06 — LA05: review of the lane actions units (complete)

A review of what LA01–LA04 left between them, not a second acceptance pass. `/code-review` ran at
`high` on `2d50749..HEAD` (ten candidates); I kept only what I could show. Code changed: one
guard (finding 1) with an E2E test that failed before it. Docs changed: one sentence each in the
guide's Limits and CATALOG (findings 2 and 3), the plan's status and PLAN's Next.

### Ledger

How checked: "open" and "still applies" items re-read in the current code and docs; "fixed" items
in the unit and test named; scratch scripts (the spec's commands and `applyOperations`, real ELK
through the board's engine) where a number is quoted. Owner decisions are under Questions.

| From | Item | Status |
| --- | --- | --- |
| LA01 | Refusal says "a service (not a worker), an API or the CDN" (plan had no "(not a worker)") | Stands (recorded deviation) |
| LA01 | `linkTiles` from a lane with no action is refused, not auto-adding the action | Stands (recorded decision; chat text and refusal say so) |
| LA01 | Selecting an action sends chat no identity | Open, documented (guide Limits) |
| LA01 | A design broken by a stored entry into storage takes no edit but that entry's removal | Still applies, and worse in two cases: findings 2 and 3 |
| LA01 | Owner's YouTube copy `7eef33c4…` had `upload-parts` | No longer applies (LA04 replaced it) |
| LA01 | Owner's TinyURL `41bbd268…` should load with Consume and Produce, no finding | Fixed/checked by LA04 (findings `[]`) |
| LA01 | An action with no entries had no finding | Fixed by LA02 (`action-without-entries`) |
| LA01 | Board `maxOut` per tile is the action's entry cap | Stands, unit-tested |
| LA01 | YouTube CDN/Upload bus, marketplace buses; entry orders chosen before the action column | Fixed by LA03 across lanes (CDN test); same-lane buses stand by design |
| LA01 | `LineSpec.chip` stays in the board, unused by Jeeves | Still applies (board fixture only) |
| LA02 | Mark about 10–11px at TinyURL's both-rails fit | Open, documented (guide Limits) |
| LA02 | `queue-without-publisher` only fires on a design that already has a lane error | Still applies |
| LA02 | `output-unread` counts a legacy entry into a store as a reader | Still applies |
| LA02 | Whether a live model resolves warnings is untested | Open (guide Limits) |
| LA03 | Bands make studies taller, so the fit padding costs more | Open (question 2) |
| LA03 | Same-lane buses remain | Stands, documented (guide Limits) |
| LA03 | `meetAtPorts` is best effort | Open, documented (guide Limits) |
| LA03 | 32px bus spacing for every layout | Stands |
| LA03 | Chips or a loop fall back to one pass; a tile with no band must have no lines in | Stands: Jeeves passes no chips; a loop only on a broken stored design (guide Limits) |
| LA03 | One ELK run per band plus one to route, in the worker | Stands |
| LA03 | Owner's TinyURL lays out in bands | Checked by LA04 (fit 0.55) |
| LA04 | An attach target out of view can't be dropped on | Open, documented (question 8) |
| LA04 | The User's fan opens over the existing action | Open (question 4) |
| LA04 | A CDN entry takes API then the Type list | Open (question 7) |
| LA04 | Fit padding | Open (question 2) |

### Findings

| # | Severity | Where | What goes wrong | Reproduce | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Low | `apps/web/src/canvas/Workspace.tsx:170` → `removal.tsx:112` | The user's line to an action has no X, but Delete/Backspace on it sent `removeLink` with `@actor-download`; `idSchema` threw and the notice showed a raw Zod JSON dump | TinyURL: click the User → Open link line, press Delete: "Change not saved: [ { "origin": "string", … } ]" | **Fixed**: `onRemoveLine` ignores the user's lines. E2E `remove.spec.ts` "the user's line to an action has no X, and Delete leaves it" failed before, passes after |
| 2 | Medium | `packages/spec/src/apply.ts:78`; `studio-lane-commands.ts:553,677` | LA01's repair (`removeLink` of a refused entry) "may leave the design's other findings", but `applyOperations` rejects any result with a studio structural finding. A design with two refused legacy entries can't remove either, and every other command says "Fix the lanes first." | YouTube with actions deleted plus stored entries `upload → originals` and `download → encoded`: removing either is rejected with the other's message (scratch script) | Follow-up (question 1); guide Limits and CATALOG now say so |
| 3 | Medium | `studio-lane-commands.ts:641` | The repair still refuses to strand tiles, and `removeTile`/`removeAction` are gated, so a legacy entry that is its tile's only way in can't be removed by any command | YouTube plus an External API "Maps API" whose only link in is a stored `download` entry: `removeLink` "would cut off Maps API"; `removeTile`, with `alsoRemove`, and `removeAction`: "Fix the lanes first." | Follow-up (question 1); same doc sentences |
| 4 | Low | `studio-lane-commands.ts:617` | `linkTiles` from a lane takes its default mode from `LANE_ACTOR` (no `user → kind` row, so "sync") instead of the action node; right today only because every action row is sync | — (no divergence to show) | Follow-up |
| 5 | Low | `apps/web/src/canvas/creation.tsx:182` | The User's `+` tooltip names Consume and Produce by hand, not from `studioActionDefaults` | — (agrees with the spec today) | Follow-up |

Code-review candidates dropped: `meetAtPorts` cost and serial per-band ELK runs (LA03 measured
30–100ms per study, off the main thread in the worker; no slow case shown), repeated `laneGraph`
builds per command and unmemoised `studioWarnings` in the inspectors (efficiency, not defects),
the inspectors calling a renamed action "Consume action" (the action's kind, as LA01 recorded:
"Consume action: what the user does in the download lane"), and chat's `validateDesign` tool
returning `DESIGN_WARNING` among its findings (its code and severity say what it is; the plan asks
for warnings in `getDesign` and after each command, which both split).

Seams checked:

- **Rules in the spec:** the link table, the action defaults and name limit, one action per lane,
  the caps per action, the warnings and their chat sentence, and the bands all live in
  `packages/spec`; the canvas, chat and blueprint read them (chat's link paragraph and warning
  sentence are generated). Exceptions: finding 5, and DP10's finding 3 (still open). The chat
  instructions' two sentences on actions are the plan's and take their names and limit from the
  spec.
- **Warnings versus errors:** `DESIGN_WARNING` is category `warning`, so `isStructural` is false
  and `applyOperations` never rejects on it; the "Fix the lanes first." gate, `laneOptions`,
  `laneActionOptions` and `attachOptions` read `laneFindings` only; chat's `getDesign` and each
  accepted `applyStudioCommands` split `findings` and `warnings`; the blueprint's `findings`
  carry them (documented).
- **Action nodes:** removal (an action's X pre-checks `laneRemoveActionRefusal`; its line has no
  X, and now no Delete either), undo (actions change through `setStudio`), chat selection (sends
  nothing, documented), the blueprint (`actions` from `studioActions`, so an entry's `action` is
  never empty).
- **Normalisation composes:** TinyURL stored with every entry `both`, no actions and a service in
  `csharp` parses to download entries, one Consume action and TypeScript, with no findings; a
  second parse of the result is identical; the blueprint agrees. An unparsed draft reads both
  default actions through `studioActions`.
- **No stale references:** no code, CSS, test, chat text or current doc still mentions entry
  chips, the User's attach tab or the old user rows (the board's generic `chip` stays, as LA01
  noted).
- **Studies:** all three validate with no findings and no warnings after a JSON round trip.
- **Edit stability under bands:** adding a Service after every tile that can take one (26 edits
  over the three studies, real ELK, previous positions as hints) moved 155 existing tiles in all
  with bands against 227 for the same edits laid out without bands; every band move is vertical.
  Edits at a band's end move nothing (TinyURL after Shorten, marketplace after Orders), but an
  edit that grows a band upward shifts the bands below, and some shift the whole board 32–160px
  (question 9).

### Questions for the owner

1. A design stored before actions with an entry the table now refuses can be stuck (findings 2
   and 3). Should load drop such entries (listed in the blueprint's `omitted`), should
   `applyOperations` accept a batch that only removes studio errors and the repair also remove
   what it strands, or leave it? No stored design has one today (LA04: the owner's three projects
   load with findings `[]`; `jeeves_e2e` holds only TinyURL).
2. The fit's 28% padding: the studies fit at 0.33–0.39 at 1440×900. Keep, or a fixed margin?
3. DP01's dot offset (dots on the grid crossings): keep?
4. DP04's fan latch, and its placement: the User's fan opens over the existing action, so the
   greyed Consume sits on Watch. Keep?
5. Should a notice clear on the next successful edit, or when a pull starts?
6. Blueprint 2 reuses `access` for read/write: keep, or rename (for example `storeAccess`)?
7. Should an action's fan offer a CDN item directly, rather than API then the Type list?
8. Should the board zoom out as a chain grows, so attach targets stay on screen?
9. Bands keep "an edit moves only what it changes" no worse than the single pass, but an edit
   that grows a band can shift everything below it. Accept, or anchor the board?

Noticed, outside this plan: Undo on a study project before any edit undoes the study's creation
and empties the board (it is revision 1 of the project's history).

### Checks (Node 24.21.0 first in PATH), on the final tree

- `pnpm check`: exit 0 (Biome 205 files; type checks; 24 files / 162 tests).
- `pnpm test:e2e`: 18 passed (+1, the new removal test, which failed before the fix: the notice
  was present).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse at 1440×900, my API on 4312 (scratch `JEEVES_HOME`,
scripted model, `jeeves_e2e`) and web on 4302, both stopped by PID afterwards. A new TinyURL
project (URL awaited): clicking the User → Open link line selects it with no X and the inspector
says "The line goes with the action."; Delete changes nothing (12 lines, no notice, revision 1).
The Shorten service → URL database line's X still removes it (11 lines, URL database marked);
Undo restores it (12 lines, no marks). In dark mode, Backspace on the User → Shorten line does
nothing. Two projects created and deleted (204); `jeeves_e2e` again holds just "TinyURL · studio
study". No console errors or warnings. I did not touch 4300, 4304, 4310 or the `jeeves` database.

Docs: guide Limits and CATALOG (a legacy entry's removal is saved only when it leaves no lane
error), the plan's status (complete) and PLAN's Next.

## 2026-11-06 — SD01: design playbook (complete)

What changed (docs only, no code):

- **`docs/design-playbook.md`** (new), the design knowledge agents read before designing a study:
  the canvas rules every pattern depends on; a table of real-world boxes to Jeeves tiles and
  kinds; seven **patterns** (large uploads through an upload service; a media pipeline with a
  completion event and a completion handler; search fed by events through an indexer; the read
  path and who writes the cache; counting from events; a CDN pulling from object storage; one
  writer per store), each with problem, shape, Jeeves tiles/kinds/settings/modules, the template
  it implies, where sources differ, and sources; eight **smells** with fixes and the study that
  showed each (the plan's seven plus "an entry its action's word doesn't cover"); a **gaps** table
  with the ladder step each would need; a hand-off checklist; the sources.
- The coordinator's two notes: the upload pattern keeps Publish → Upload service → Original
  videos, with proxied (tus/tusd) or signed URL (multipart, trust but verify) as the service's
  choice and the reason the two imply different templates. Pattern 7 turns Xu's two metadata
  writers (API servers during the upload, completion handler after) into one: the title rides in
  the upload job and the completion event, the completion handler writes the DB and cache once,
  and upload progress is either the multipart upload itself or the Upload service's own store.
- AGENTS.md: "(once it exists)" dropped. The plan's Progress line (SD01 done), PLAN's Next (one
  paragraph), HUMAN_FEEDBACK's last Resolution (one bullet).

Sources read (cited in the playbook): ByteByteGo *Design YouTube*; HelloInterview *YouTube* and
*Dropbox*; AWS presigned uploads and S3 event notifications; tus, tusd and its hooks; Kleppmann's
"why dual writes are a bad idea"; InfoQ on Netflix Studio Search; Debezium on the outbox;
microservices.io (transactional outbox, database per service, API gateway); AWS ElastiCache
caching strategies; System Design Primer (CDN push/pull, cache); Reddit's view counting (through
search summaries: redditinc.com and reddit.com refuse automated fetches); CloudFront origin
access control; Cloudflare R2 public buckets. Plus the three studies' own sources. Not used:
DoorDash's search indexing post (its site blocks fetches, so it isn't cited).

Checks (Node 24.21.0 first in PATH): `pnpm check` exit 0 (Biome 205 files; type checks; 24 files
/ 162 tests). E2E, build and the browser check are not needed for a docs-only unit (the plan).

Follow-ups: the studies checked against the smells (nothing changed):

- **TinyURL.** No user → store, no unrelated writes, no unread store, no second writer, no
  gateway. Smells: *long line*: Stats API → Analytics store runs the top row to the last column
  (DP06 chose the entry order for it; SD03's layout should shorten it). *Fork*: the Redirect
  service forks to URL cache, URL database and Click events; measure under SD03. *Action word*:
  "Open link" also reaches the Stats API, which serves link creators their counts (owner question:
  rename, e.g. "Open & track", or accept). Note: the URL cache is reader-owned cache-aside, right
  while links never change; if editing or expiry is added, invalidation needs pattern 7 (an event
  to the Redirect service), not Shorten writing the cache.
- **Marketplace.** No user → store, no unrelated writes, no unread store (Payments database and
  Cart store are their owners' own state), no second writer, no gateway (recorded). Smells:
  *long lines and shared buses*: Image CDN and Shop service into Product images, Shop service and
  Payments into the Catalog database, and the Orders service's read crossing the Search indexer's
  write (guide Limits); SD03 should measure them. *Fork*: the Shop service forks to Catalog
  database, Product images and Listing events, and Payments to Catalog database, Payments database
  and Order events, the same shape as YouTube's Upload service. *Cross-service read*: Payments
  reads the Shop service's Catalog database to price the cart; microservices.io's database per
  service would call the Shop service instead (owner question: keep the read, recorded as the
  same-feature read side, or a Payments → Shop service call). *Upload transfer*: the Shop
  service's photo upload is implicitly proxied (its Photo uploader module); once SD02 settles the
  transfer choice, the marketplace should state it.

Notes for SD02:

- Patterns 1, 2, 3, 4, 5 and 7 are the YouTube v2 building blocks; pattern 7's table is Xu's
  two-writer case. The plan's starting point (Completion events ⇢ Completion handler and ⇢ Search
  indexer) is the playbook's "sibling consumer" shape; it holds if the completion event carries the
  title and description the indexer needs.
- **The metadata cache:** choose one shape (pattern 4) and record it. Xu's is write-through by the
  completion handler; the Watch API then reads the cache and the DB without filling. If the Watch
  API should fill on a miss, it must own the cache (TinyURL's shape) and the handler doesn't write
  it. The `cache-reader` module has no "read only" pattern (gaps, step 3 if needed).
- **The transfer choice** (step 2 Uploads kind vs step 3 setting): tusd is the ready-made
  resumable server (S3/GCS/Azure/disk; `pre-create` hook for auth, `post-finish` to publish the
  job); signed URLs are a generated skeleton with multipart calls. Update the playbook's gaps row
  and pattern 1 with the decision.
- The Transcoder needs 3 of its 4 links (Original read, Transcoded write, Completion events);
  Upload jobs is a `work-queue`, Completion events a `topic`.
- A completion can't return to the Upload service (no loops); that is one more reason for the
  completion handler.

## 2026-11-06 — SD02: YouTube v2 from Xu's design (complete)

What changed:

- **YouTube study 2.0.0** (`studio-youtube@2.0.0`, `studio-examples/youtube.ts`), rebuilt from
  Alex Xu's "Design YouTube" and the playbook (patterns 1–7), mapped to tiles and templates: 18
  tiles, 25 links (the user's two lines, five entries, 18 connections; 12 dashed), 20 modules, 30
  component links. Validates with no findings and no warnings; blueprint 2 has 8 services, 10
  resources, no externals, 18 connections, nothing omitted. Every service TypeScript on Docker.
  ```text
  DOWNLOAD  Watch ⇣ Watch API → Metadata cache (owner: cache-aside, fills on a miss)
                              → Metadata database, View counts (reads)
                              ⇢ View events ⇢ View counter → View counts
            Watch ⇣ Search API → Search index (reads)
            Watch ⇣ Video CDN → Transcoded videos (reads; origin pull; resizes thumbnails)
  UPLOAD    Publish ⇡ Identity
            Publish ⇡ Upload service (Uploads, signed URLs) → Original videos
                                     ⇢ Upload jobs ⇢ Transcoder → Original videos (reads)
                                                                → Transcoded videos
                                                                ⇢ Completion events
                                                                    ⇢ Completion handler → Metadata database
                                                                    ⇢ Search indexer → Search index
  ```
- **Owners (one writer each):** Upload service: Original videos, Upload jobs. Transcoder:
  Transcoded videos, Completion events. Completion handler: Metadata database. Search indexer:
  Search index. Watch API: Metadata cache, View events. View counter: View counts. Shared band:
  Transcoded videos, Metadata database, Search index; the Metadata cache sits in the download band.
- **Templates:** Watch API and Search API generated services (cache-reader, data-access, publisher;
  a query module); Upload service the Uploads kind's signed-URL skeleton; Transcoder a generated
  media worker (ffmpeg stages); Completion handler and Search indexer generated consumers (like
  TinyURL's analytics worker and the marketplace's indexer); Identity OIDC; stores, topics and the
  CDN ready-made (MySQL, Redis-compatible, OpenSearch, R2, Cloudflare CDN).
- **Where it differs from Xu, and why** (each in the doc comment and the guide's "Xu's boxes"
  table): the client never uploads straight to storage (Uploads service with signed URLs, owner
  2026-11-06); Xu's API-server metadata write rides in the job and the completion event (one
  writer); the completion queue is a topic so the Search indexer is a sibling consumer (the event
  carries title, description and channel, so the indexer reads no database); **the metadata cache
  is the Watch API's own, cache-aside, an hour** (SD01's "choose one shape"): a video's record is
  written once and never edited, so Xu's write-through by the completion handler would never
  refill an evicted video, and a filling reader beside it would be a second writer; the CDN pulls;
  no load balancer or gateway (recorded: a gateway would be each action's only entry); the DAG
  is the Transcoder's modules; Xu's "notify the client" isn't drawn (no line to the user). Not in
  Xu: search, view counts, Identity (crash course, Reddit, the earlier study).
- **Extension ladder.** Step 2: a new **Uploads** kind (`uploads`), a Service kind after Billing:
  TypeScript or Go, exposure public by default, icon `cloud-upload`, and a required
  **Transfer** (`transfer: "signed-url" | "tus"`, Options; labels "Signed URLs to storage" and
  "Through the service (tus)"; new tiles start `signed-url`). Need: the owner's upload rule keeps
  Publish → Upload service → Original videos, and how the bytes travel decides the template.
  Templates: `signed-url` a generated skeleton with the storage SDK's multipart calls; `tus` a
  ready-made tus server (tusd in Go, `@tus/server` in TypeScript) with pre-create and post-finish
  hooks. Why not step 3: a setting on `service` would show on every microservice (the Search API,
  the Watch API) and map to no template there. Wired: schema, `createStudioSettings`, definition
  and form field, labels, performance fields, the Service tile's kinds, the action → application
  row and `studioEntryKinds`, the noun, blueprint (`kind` enum and settings, additive within
  `blueprint: 2`), the chat preset sentence, `StudioIcon`. Steps 3–5: nothing. Caps unchanged: the
  Watch API uses 4 links (the cap), the Transcoder 3, three entries per action.
- **Orders, with real ELK** (a scratch vitest file, deleted): all 6,912 entry × link orders
  (entries; the Watch API's, Transcoder's, Upload service's and Completion events' links). 3,456
  leave a vertical run under 32px (in the Watch API's reads or the Video CDN's) and fail DP01's check; of the rest the
  shipped order (the same entry order as 1.2) has the fewest crossings, **1** (the Completion
  handler's write rising past the Search API's read into the Search index; 1.2 had 3), 44 bends
  and the shortest total among those. Completion events must feed the handler first (the other
  way adds a crossing); the Transcoder's and the Upload service's link orders don't change the
  drawing. Recorded in the study's `entries` comment.
- **Under today's layout** (for SD03; my metric: Manhattan length of each route): 1,632×1,440px
  (1.2: 1,248×1,376), total line length 9,120px (1.2: 8,736), longest Watch API → Metadata database
  1,472px then Search API → Search index 1,408 (1.2's longest 1,024). Video CDN → Transcoded videos
  736px (1.2: 1,024); Upload service → Original videos 576px (1.2: 640), still running under Upload
  jobs and the Transcoder and joining the Transcoder's read 64px before the store.

Tests (164; +2): `studio-operations.test.ts` (the Uploads kind: Service kind, required Transfer in
Options with both labels, accepted and refused values, only on `uploads`; `changeKind` presets,
still the Shorten action's entry, edit to `tus`; defaults and `studioKindLanguages`);
`studio-blueprint.test.ts` (YouTube 2.0: services and kinds incl. `uploads`, resources, entries, 30
component links, every connection's access or channel use, the Upload service's `transfer`, the
CDN's origin); `studio-lanes.test.ts` (kinds, the action row, entry kinds, shared stores);
`laneLayout.test.ts` (YouTube crossings 1; the CDN test on `cdn-transcoded`/`transcoder-write`).
E2E (18): the YouTube test now checks 21 tiles, 25 lines, 12 dashed, no marks, four stores'
writer and readers (Original videos, Metadata database, Search index, Metadata cache), Uploads
pressed and Transfer `signed-url`; the Type list test includes Uploads.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 205 files; type checks; 24 files / 164 tests).
- `pnpm test:e2e`: 18 passed (twice, the second on the final tree).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse (the native Study and Transfer selects with
`selectOption`), my API on 4312 (scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on
4302, both stopped by PID afterwards (tsx 2406836/2406876, vite 2406837 and their shells). Four
YouTube projects created, each URL awaited, all deleted (204; one by ID after my script's output
pipe cut it short); `jeeves_e2e` again holds just "TinyURL · studio study". No console errors or
warnings. I did not touch 4300, 4304, 4310 or the `jeeves` database.

- New project lists the study with its new description; it renders in bands: 21 tiles, 25 lines,
  12 dashed, no warning marks. Fit zooms (closed / chat / inspector / both): 0.38 / 0.38 / 0.38 /
  0.33 at 1440×900, 0.33 / 0.33 / 0.33 / 0.27 at 1280×800 (1.2: 0.39 and 0.35 in every state).
- Every tile's inspector: services TypeScript, Docker, public; the Upload service's Type list has
  seven kinds with **Uploads** pressed, Options Transfer "Signed URLs to storage" (choices: that and
  "Through the service (tus)"); Identity OpenID Connect; workers on queue lag (Transcoder
  concurrency 1, up to 50; handler and indexer 4); Metadata cache Redis-compatible, self-hosted,
  TTL 3600, cluster, LRU; MySQL with `video_id` and replicas 3 / 2; topics 12 and 6 partitions;
  R2 public / private; CDN Cloudflare, Image resizing On request. Store lists: Original videos
  "Upload service · Transcoder", Transcoded videos "Transcoder · Video CDN", Metadata database
  "Completion handler · Watch API", Search index "Search indexer · Search API", View counts "View
  counter · Watch API", Metadata cache "Watch API · nobody else". Modules and Connections lists
  as designed (the Watch API's cache link "Writes (owner)", its database link "Reads").
- Transfer → tus autosaved (revision 2); the toolbar's Undo restored `signed-url` (revision 3).
- Selecting the Upload service, the Watch API, the Video CDN and Completion events colours their
  lines; dark mode (the app's toggle) reads clearly, including the Uploads icon and Type button.
- The stable `jeeves_e2e` TinyURL project renders (it is a stored TinyURL 2.0.0, 12 tiles, with
  its own Analytics-store warning; not changed).

Docs: studio guide (YouTube section rewritten: flows, sources, the playbook, a "Xu's boxes" table,
lanes, owners, counts, tiles and modules, decisions, the Uploads kind; Inspector's Type list and
presets; Layout's crossing example, sizes and fits; Limits), studio settings (Common and Exposure
rows, Transfer row, the Service-kinds sentence, Languages and Defaults tables, a new Uploads
section), CATALOG (sixteen kinds, the `uploads` row, languages, tile types, the action row,
provider choices, YouTube in Studies), blueprint doc (services' kinds), the playbook (boxes table,
pattern 1's decision and templates, pattern 3's sibling timing, pattern 4's "how to pick", gaps
row removed, the smells' YouTube 2.0 notes, the hand-off checklist), PLAN (sixteen kinds, Next),
the plan's Progress (SD01–SD02), HUMAN_FEEDBACK's Resolution (an SD02 bullet).

Notes for SD03:

- The owner's layout complaints are still visible on 2.0 (the design part is done): the Upload
  service's write runs under Upload jobs and the Transcoder (y 1,344); the Watch API forks four
  ways; the Watch API's and the Search API's reads run to the last column, where the Metadata
  database and the Search index land because their writers (Completion handler, Search indexer)
  are the pipeline's last column. The Video CDN's line already spans less (Transcoded videos sits
  in the Transcoder's next column).
- A store with one user already lands in the next column when nothing else precedes it (the
  Metadata cache sits right after the Watch API, above View events); the long lines are shared
  stores whose writer comes late.
- Keep Completion events' order (handler, then indexer) or re-score: it decides the one crossing.
  Half of all orders leave a short jog (the Watch API's reads, or the Video CDN's) under today's
  layout.
- `laneLayout.test.ts`'s relayout check still adds a tile after View counts (download band).

Rough edges and questions (not fixed):

- Owner question: Identity is Publish's entry, but viewers sign in too ("an entry its action's word
  doesn't cover"); unchanged from 1.2.
- The chat instructions' preset sentence is still hand-written (DP10 finding 3); I added Uploads
  and one sentence on the transfer to it.
- The marketplace's Shop service uploads photos (proxied, in a module's purpose). It is not an
  Uploads service (it also owns listings); whether its photo transfer should be stated is a
  follow-up for the owner, not changed here.
- SD04: the owner's YouTube copy (`7ec5980c…`) is still 1.2; the walkthrough should include the
  Transfer choice and the Uploads Type button.

## 2026-11-06 — SD03: stores beside their users (complete)

What changed:

- **Board** (generic; `packages/board` still imports no Jeeves code). `endColumns(input, column)`
  in `layout/bands.ts`: an end tile (lines in, none out) that several tiles use takes the first
  column, from `max(earliest user + 1, last user − 1)` to `last user + 1`, where its band has fewer
  tiles than in its tallest column (else the one with the fewest); end tiles with one possible
  column are counted first. Every other tile keeps its longest-path column, so a store with one
  user sits right after it. New `layout/returns.ts`: `comesBack(line, column)`, `widenAt` and
  `routeReturns`: each line whose target is in its source's column or before it is routed after
  ELK as a U (east port, right 32px or more, a free row at least 16px from the tiles it passes, the
  gap before the target, west port). Slots on the grid; no shared run except the source's own lines
  as it leaves and lines into the target on the last stretch (another band's only in the last
  32px); no touch elsewhere; fewest crossings, then shortest, counting what widening a gap (a grid
  step, at most two per side) adds; a non-strict fallback so every line gets a route. `layoutBands`
  uses `endColumns`, keeps lines that come back out of the band layouts and the ELK routing pass,
  and routes them after `meetAtPorts`. `index.ts` exports `returns.ts`.
- **Studies** (orders re-chosen, versions bumped as LA03 did; doc comments say how):
  TinyURL 3.2.0 (the Redirect service links to Click events first), marketplace 1.3.0 (Payments
  links to Order events before its Payments database), YouTube 2.1.0 (the Upload service links to
  Upload jobs before Original videos). Entries unchanged.

Why this approach, by measurement (real ELK through the engine, scratch scripts not committed;
lengths are Manhattan lengths of the routes, SD02's metric). Baselines, measured on HEAD: LA03 for
TinyURL and the marketplace (their layout code and orders are unchanged since 6419be9) and SD02 for
YouTube, matching the coordinator's numbers.

| Variant | TinyURL total / longest | Marketplace | YouTube |
| --- | --- | --- | --- |
| Before (HEAD) | 2,848 / 608, 0 crossings | 7,712 / 1,024, 1 | 9,120 / 1,472, 1 |
| ELK draws the lines that come back (interactive cycle breaking), right after the earliest user | 3,168 / 928 | 9,312 / 1,376 | 12,384 / 1,792 (staircases) |
| The plan's literal rule (right after the earliest user) with the U router | 2,912 / 768 | 8,800 / 1,312 | 10,656 / 1,536 |
| Final rule, current orders | 2,848 / 544 | 7,072 / 896 | 9,184 / 1,056 |
| Final rule, re-chosen orders (shipped) | 2,752 / 416, 0 | 6,912 / 896, 1 | 8,864 / 1,056, 1 |

- ELK with bend points does follow a U, but widened the gap before the stores to 192px and ended
  some lines with 160px runs into the port, so the U's are routed by our own step.
- **The plan's literal rule can't meet its own acceptance.** A line that comes back one column is
  at least 448px across (32 out, back past both columns, 32 in) plus 160px up or down (adjacent
  rows), so at least 608px, exactly TinyURL's LA03 longest: TinyURL can only tie. In YouTube the
  Completion handler and the Search indexer came back three columns (1,472px and 1,536px) and the
  three shared stores stacked in one column. The two limits come from an exhaustive search (every
  multi-user store's column from its earliest user's next to its last user's next, all LA03/DP01
  checks): with Transcoded videos and Original videos at column 3 (the acceptance), YouTube's best
  needs the Metadata database at 5 and the Search index at 6, one column before or at their
  writers and never stacked; TinyURL's store right after the Stats API never beats 608px.
- Orders: TinyURL's 12 (six without a crossing; the Click events link first is shortest), the
  marketplace's 5,184 (all keep the rules, every one crosses at least once), YouTube's 6,912 (half
  leave a jog under 32px; every other one crosses at least once). Each study keeps LA03's crossing
  count: TinyURL 0, marketplace 1 (now the Storefront API's read passing the Orders service's),
  YouTube 1 (the Watch API's read of the Metadata database passing the Search API's).

Measurements, before → after:

| Study | Board | Total | Longest | Crossings | Bends | Fit 1440×900 (closed / chat / inspector / both) | Fit 1280×800 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TinyURL | 1,184×800 → 1,024×832 | 2,848 → 2,752 | 608 Stats API → 416 Analytics worker | 0 → 0 | 20 → 20 | 0.70/0.65/0.64/0.46 → 0.67/0.67/0.67/0.56 | 0.62/0.56/0.55/0.37 → 0.59/0.59/0.59/0.45 |
| Marketplace | 1,248×1,632 → 1,280×1,472 | 7,712 → 6,912 | 1,024 → 896 Orders service | 1 → 1 | 34 → 36 | 0.33 → 0.37 | 0.29 → 0.32 |
| YouTube | 1,632×1,440 → 1,504×1,376 | 9,120 → 8,864 | 1,472 Watch API → 1,056 Search API | 1 → 1 | 44 → 54 | 0.38/0.38/0.38/0.33 → 0.39/0.39/0.39/0.38 | 0.33/0.33/0.33/0.27 → 0.35/0.35/0.35/0.30 |

YouTube's lines: Video CDN → Transcoded videos 736 → 256px (one column gap); Upload service →
Original videos 576 → 192px (stays in the gap before them); Watch API → Metadata database 1,472 →
1,024px; Search API → Search index 1,408 → 1,056px. The boards got smaller except TinyURL's height
(+32px; it is 160px narrower), so the fits are larger except TinyURL with both rails closed (0.70 →
0.67). Layout time, warm, in Node: 21 / 25 / 26ms (U routing 0.5 / 0.3 / 4ms, after skipping
widenings that can't win; 25ms for YouTube before that, same drawings).

Tests (170; +6 in board and web, and expectations of TinyURL's lane order):

- Board (`layout.test.ts`, +2): `endColumns` (one user right after it; two users right after the
  earliest; a crowded column moves the store to the first that doesn't grow the band; a user
  three columns later keeps it one column before); a fixture whose worker's lines to a store of
  its own band and a shared store come back: `expectClean`, no cross-band shared run, `bandClashes`
  0 and 0 crossings, each U's shape (32px out, a level run 16px or more from every tile it passes,
  32px in), the two bands meeting only in the last 32px, and relayout identical.
- Web (`laneLayout.test.ts`, +4): per study, a store with one user right after it and the total
  and longest line shorter than LA03's (constants: 2,848/608, 7,712/1,024, 9,120/1,472); YouTube's
  CDN line within one column gap, the Upload service's line staying in the gap before Original
  videos (Upload jobs in the same column), and the Transcoder's two lines coming back. LA03's
  per-study checks (bands, no cross-band shared runs, grid, no jog under 32px, no line through a
  tile, crossings 0/1/1) pass unchanged. **One fixture changed:** the YouTube edit test now adds
  its tile after the View counter instead of after View counts. A link out of a store can't be
  made in Jeeves; under the new rule it turns View counts into an ordinary tile, which moves back
  to its longest-path column. The assertions (relayout identical, nothing else moves, the new tile
  takes its source's row) are the same.
- Spec and server: the TinyURL lane order now lists Click events before the URL cache
  (`studio-lanes.test.ts`, `studio-lane-commands.test.ts` ×3, `chat/tools.test.ts` ×3): the same
  assertions on the new link order.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 206 files; type checks; 24 files / 170 tests).
- `pnpm test:e2e`: 18 passed (three times; the last on the final tree).
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse (the native Study select with `selectOption`), my API on 4312
(scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on 4302, stopped by PID after each
round. The before screenshot ran HEAD's layout and YouTube study (my versions copied aside in the
scratchpad, HEAD's written in place, then restored; no stash). Thirteen projects created, each URL
awaited, all deleted (204); `jeeves_e2e` again holds just "TinyURL · studio study". No console
errors or warnings. I did not touch 4300, 4304, 4310 or the `jeeves` database.

- The three studies render with no warning marks (21/25/12, 20/23/6, 11/12/3 tiles/lines/dashed)
  and fit at the zooms above at both window sizes, in every rail state.
- `docs/human-feedback/2026-11-06-youtube-sd03-before.png` and `-after.png` (1440×900, fitted).
  After: the Upload service's fork is Upload jobs and Original videos side by side; Transcoded
  videos sit right after the Video CDN; the Watch API's cache, View counts and View events right
  after it. Zoomed with the wheel, the U's draw cleanly, dashed where they follow an async link.
- Selecting the Transcoder colours its three lines, the U's included.
- By mouse, `+` → Database: after the Transcoder (YouTube), the store lands right after it, and the
  Transcoder, now a fork, is recentred with the upload chain (as any new fork does); after the
  Stats API (TinyURL), right after it, the download band growing a row; after the Orders service
  (marketplace) and the View counter (YouTube, final code), nothing else moves. Undo restored
  every position exactly each time. Dark mode reads clearly.

Docs: studio guide (Layout: the store rule, lines that come back, why the two limits, sizes and
fits; the three studies' versions, lane diagrams and orders; Limits: fits, the remaining long
lines, U routing's limits, what moves a shared store, a U joining a store's other lines), CATALOG
(study versions; stores in the lane bands paragraph), PLAN (Layout, the board row, Next), the
playbook (the fork and long-line smells, now describing YouTube 2.1), the plan's Progress (SD01–
SD03), HUMAN_FEEDBACK's Resolution (an SD03 bullet and the two images).

Notes for SD04:

- **A deviation from the plan to confirm with the owner:** the plan says a store with several
  users sits right after the earliest one unless lines are shorter elsewhere; the shipped rule
  adds "no more than one column before its last user" and "where its band doesn't grow", because
  the literal rule measured longer in every study (table above). YouTube's Metadata database and
  Search index therefore sit one column before (or at) their writers, and the Watch API's and the
  Search API's reads still cross the board (1,024px and 1,056px), the first past View events and
  the View counter. That part of the owner's Watch API complaint is only partly resolved.
- The walkthrough should click the U's (their X sits on their own stretch) and try an edit plus
  Undo next to one (the Transcoder, the View counter).
- The owner's YouTube copy (`7ec5980c…`) is still 1.2; a new copy from New project is 2.1.0.

Rough edges (not fixed):

- Between two bands there is one free row (32px), so when two lines come back across the same band
  gap the second goes round: YouTube's Search indexer's write rises past the Completion handler and
  over the Search index to come down into it (800px).
- A store in its writer's own column (TinyURL's Analytics store, the marketplace's Search index)
  gets a U that hooks round its corner.
- U's add bends (YouTube 44 → 54, the marketplace 34 → 36) and are routed one at a time, greedily.
  `meetAtPorts` doesn't see them (they come after it); the router keeps the cross-band rule itself.
- A shared store's column depends on its band's tiles per column, so an edit that crowds a column
  can move it; a store that gains a link out (not possible in Jeeves) goes back to its longest-path
  column.

## 2026-11-06 — SD04: system design acceptance and documentation (complete)

A mouse walkthrough of SD02–SD03, the owner's YouTube copy replaced, an honest readability check
at 100%, and a docs sweep. No code changed: the walkthrough found no defect, only the rough edges
below.

Browser: Playwright Chromium by mouse (the native Study and Transfer selects with
`selectOption`), my API on 4312 (scratch `JEEVES_HOME`, scripted model, `jeeves_e2e`) and web on
4302, stopped by PID afterwards. Eight projects created, each URL awaited, all deleted (204);
`jeeves_e2e` again holds just "TinyURL · studio study". No page errors, console errors or
warnings. I did not touch 4300, 4304 or 4310.

- **The three studies from New project**, no warning marks, fits matching the guide: 1440×900
  light, chat open: TinyURL 11 tiles / 12 lines / 3 dashed at 0.67, marketplace 20 / 23 / 6 at
  0.37, YouTube 21 / 25 / 12 at 0.39; 1280×800 dark (the app's toggle): 0.59, 0.32, 0.35. Dark mode
  reads clearly, the U's included.
- **An edit plus Undo on each** (click the tile, pull its `+` "Add after" onto Database): after the
  Stats API (TinyURL), the Orders service (marketplace) and the Transcoder (YouTube). Each added
  one tile and line (revision 2), the YouTube one with its expected mark ("Nothing reads Database:
  only its owner Transcoder links to it …"); the toolbar's Undo (revision 3) restored the counts and
  every tile position exactly. The camera keeps the both-rails fit after Undo because the inspector
  stays open (not a defect).
- **YouTube's inspectors**, all 18 tiles clicked: services Microservice / Worker service with the
  seven-kind Type list, TypeScript or Go, Docker; Identity pressed Identity; the Upload service
  **Uploads**; the Video CDN CDN; stores show one writer each (Original videos Upload service ·
  Transcoder; Transcoded videos Transcoder · Video CDN; Metadata database Completion handler · Watch
  API; Search index Search indexer · Search API; View counts View counter · Watch API; Metadata
  cache Watch API · nobody else).
- **The upload transfer choice:** Options → Transfer lists "Signed URLs to storage" (set) and
  "Through the service (tus)"; choosing tus autosaved `transfer: "tus"` (revision 4); Undo
  restored `signed-url` (revision 5).
- **The U's by mouse** (a click at each line's midpoint): `counter-write`, `transcoder-read`,
  `handler-metadata`, `indexer-write`, and the long reads `watch-metadata` and `search-read`;
  each selected the right line, coloured it and showed its X and its Connection inspector.
- **Readability at 100%** (wheel-zoomed to 0.99, rails closed; images
  `docs/human-feedback/2026-11-06-youtube-sd04-views.png` and `-pipeline.png`). Honest judgement:
  the U's are not yet readable to a first-time reader. They are dashed (everything after a queue
  is), have no arrowheads, and wrap the tiles they pass, so they read as group outlines: the View
  counter's write round View events and the View counter (traceable at 100%, since it is alone);
  the Transcoder's read and write round Upload jobs and the Transcoder, joining the Upload
  service's lines at both stores (you can't tell the Transcoder, not Upload jobs, reads Original
  videos without selecting it); the Completion handler's and the Search indexer's writes nested
  round the Search index. The Watch API's and the Search API's reads are plain long lines that
  read as lines but still cross the board, and the Watch API's four links are one bus. Recorded in
  HUMAN_FEEDBACK as better but still odd, and not resolved.

**The owner's `jeeves` database** (my API on 4313 against `jeeves`, scratch `JEEVES_HOME`, web on
4303; both stopped by PID; 4300, 4304 and 4310 untouched): opened "YouTube · studio study"
`7ec5980c-6191-40a4-8688-fa2dd8821d54` (1.2: 17 tiles, 21 lines), then Project → All projects →
its trash → Delete (204). Project → New project → Architecture study → YouTube (default name) →
Create: **"YouTube · studio study" `0a12f132-b0f4-400d-9b94-51546911bb6b`**, version 2.1.0, 21
tiles, 25 lines, 12 dashed, no marks, blueprint findings `[]`, fit 0.39. The Marketplace copy
`81571ba1…` and TinyURL `41bbd268…` (revision 39) were never opened; their design JSON is
byte-identical before and after. The database holds exactly those three.

Docs: HUMAN_FEEDBACK (an SD04 Resolution bullet: fixed, better but still odd, still open, for the
owner; two close-ups), the playbook (a new smell, "A line that comes back reads as a box"), the
studio guide's Limits (the same, and TinyURL's both-rails fit 0.46/0.37 → 0.56/0.45 and the tab
sizes, stale since SD03), PLAN Next, this plan's Progress (SD01–SD04 done, SD05 remains). Checked
and current: the guide's Layout and fit table, the YouTube section (2.1.0), CATALOG (2.1.0,
Uploads), studio settings (Uploads, Transfer), blueprint doc, README, AGENTS.md.

Checks (Node 24.21.0 first in PATH), on the final tree:

- `pnpm check`: exit 0 (Biome 206 files; type checks; 24 files / 170 tests).
- `pnpm test:e2e`: 18 passed.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Notes for SD05:

- The plan's literal store rule vs SD03's shipped rule (SD03's deviation) is unconfirmed by the
  owner; HUMAN_FEEDBACK now says so in plain terms.
- How lines that come back should look is a new owner question (arrowheads, a solid U for a
  request after a queue, or a store after its writer when its reader is in the other lane).

Owner questions already raised (not acted on):

- TinyURL's "Open link" action also reaches the Stats API.
- The marketplace's Payments reads the Catalog database directly.
- Identity sits under Publish though viewers sign in too.
- The chat preset sentence is written by hand.
- The fit's padding (studies fit at about 0.35–0.39).

## 2026-11-06 — SD05: review of the system design units (complete)

A review of what SD01–SD04 left between them, on `6616c74..HEAD`, not a second acceptance pass.
`/code-review` ran at `high` (ten candidates); I kept only what I could show. Code changed: one
guard in `packages/board/src/layout/returns.ts` (finding 1) with a board test that failed before
it. Docs changed: the playbook's notation (finding 2), two sentences in the guide's Limits
(findings 3 and 4) and one in its Layout (finding 1), the plan's status (complete), PLAN's Next,
and an SD05 line in the last HUMAN_FEEDBACK entry's Resolution (not marked resolved).

### Ledger

How checked: the current code and docs re-read; real ELK through the board's engine in scratch
vitest files (deleted) where a number is quoted; the canvas by mouse where named.

| From | Item | Status |
| --- | --- | --- |
| SD01 | TinyURL's Stats API → Analytics store ran the top row | Fixed by SD03 (288px; the longest is now the Analytics worker's U, 416px) |
| SD01 | TinyURL's Redirect service forks three ways; measure under SD03 | Fixed by SD03 (Click events first; 0 crossings) |
| SD01 | TinyURL's "Open link" also reaches the Stats API | Open (owner question, SD04's list) |
| SD01 | The URL cache needs pattern 7 if links ever change | Stands (note; nothing edits a link) |
| SD01 | Marketplace long lines and shared buses | Partly fixed by SD03 (7,712 → 6,912px, longest 1,024 → 896); the Orders service's and the Storefront API's reads remain (guide Limits) |
| SD01 | Marketplace forks (Shop service, Payments) | Fixed by SD03 (stores and topics right after them, column 3) |
| SD01 | Payments reads the Shop service's Catalog database | Open (owner question, SD04's list) |
| SD01 | The marketplace's photo upload transfer isn't stated | Open (follow-up for the owner; SD02 kept it) |
| SD01→SD02 | Choose one metadata cache shape; the transfer choice; update the playbook's gaps and pattern 1; the Transcoder's 3 links; no loops | Done by SD02 (the Watch API's own cache-aside; Uploads kind; playbook matches the study, checked below) |
| SD02 | Uploads kind at ladder step 2 | Done; complete per AGENTS.md (seam below) |
| SD02 | Orders measured under 2.0's layout | Superseded by SD03's re-chosen orders (YouTube 2.1.0) |
| SD02→SD03 | The orange fork; the CDN's line; the long reads; the Watch API's four-way fork | Fork and CDN fixed by SD03 (192px, 256px); the long reads partly (1,024 and 1,056px); the four-way fork open (SD04, HUMAN_FEEDBACK) |
| SD02→SD03 | Keep Completion events' order (handler first) | Kept (`completions-handler` before `completions-indexer`; 1 crossing) |
| SD02→SD03 | The relayout check adds a tile after View counts | Changed by SD03; checked below (seam) |
| SD02 | Identity sits under Publish though viewers sign in | Open (owner question, SD04's list) |
| SD02 | The chat's preset sentence is hand-written (DP10 finding 3) | Open (SD04's list) |
| SD02→SD04 | The owner's YouTube copy was 1.2 | Fixed by SD04 (`0a12f132…`, 2.1.0) |
| SD03 | Store rule differs from the plan's literal one | Stands, recorded and measured; owner confirmation open (HUMAN_FEEDBACK) |
| SD03 | Two U's across one band gap: the second goes round (Search indexer 800px) | Still applies (800px measured) |
| SD03 | A store in its writer's column gets a U round its corner (TinyURL, marketplace) | Still applies (guide Limits) |
| SD03 | U's add bends, are routed greedily and after `meetAtPorts` | Still applies; widening after `meetAtPorts` broke the 32px meeting: finding 1, fixed |
| SD03 | A shared store's column depends on its band's tiles per column | Still applies (guide Limits) |
| SD03 | Non-strict fallback so every U gets a route | Still applies; the guide said a U never shares a run: finding 3, doc fixed |
| SD03→SD04 | Click the U's; edit plus Undo next to one | Done by SD04 |
| SD04 | U's read as boxes (dashed, no arrowheads) | Open (owner question, SD04 and HUMAN_FEEDBACK) |
| SD04 | The camera keeps the both-rails fit after Undo | Stands (not a defect) |
| SD04 | Guide Limits' fit numbers refreshed | Missed one: finding 4, fixed |

### Findings

| # | Severity | Where | What goes wrong | Reproduce | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `packages/board/src/layout/returns.ts:269` (`routeReturns`) | A U that finds no free slot widens the gap before its store's column after `meetAtPorts` has run. Every tile right of the cut moves, but a bus 32px before a shared tile in that column doesn't, so two lanes' lines into it now run together for 64px, against LA03's rule. 30 of 250 random banded boards gained such a run from the U router | TinyURL, by commands or mouse: Shorten service `+` → Queue, its `+` → Service, attach that Service to the URL database (no lane findings). Redirect's read and Shorten's write share y 576 from x 608 to 672 (`bandClashes` 1) | **Fixed**: a widening that adds a band clash is skipped. Board test "widen a gap for a line that comes back only where the bands stay apart" failed before (`r-s and w-s at y 608`), passes after. The three studies lay out byte-identically; random boards with a cross-band shared run 46 → 25 (the rest are LA03's documented `meetAtPorts` limit or finding 3); YouTube layout 25 → 31ms warm. In the canvas the two lines now meet at 608–640 only |
| 2 | Low | `docs/design-playbook.md:33` | The notation said `→` is "a request (solid line)", but every link after an asynchronous one is dashed (`studio-lanes.ts:113`; the guide and CATALOG say so): the Transcoder's request to Original videos is dashed | YouTube: 12 dashed lines, including `transcoder-read`, `transcoder-write`, `handler-metadata`, `indexer-write`, `counter-write` | **Fixed** (docs): the notation says what the canvas draws |
| 3 | Low | `docs/studio.md` (Layout: a U "touches no other line") vs `returns.ts` `bestU(..., strict = false)` | When no route keeps all its rules, a U takes the one that breaks the fewest, and can touch or run along another lane's line | 7 of 250 random banded boards (three or more shared stores), for example tiles `u d@0 p@2 a00–a03@0 a20–a23@2 s0@1 s1@2 s2@1 s3@1`, lines `u>d u>p d>a00 a00>a01 d>a02 a02>a03 p>a20 a20>a21 a20>a22 a22>a23 a03>s0 a20>s0 a21>s0 a21>s1 a00>s2 a21>s2 a02>s3 a22>s3 a20>s3`: `a21-s2` and `a02-s3` share x 576 for 160px | **Fixed** (docs, guide Limits); the routing itself is a follow-up (none of the studies does it) |
| 4 | Low | `docs/studio.md` Limits | "at TinyURL's both-rails fit (0.46) it is about 10px": the fit is 0.56 since SD03 (the guide's own table), so the 22px mark is about 12px | Guide's fit table vs Limits | **Fixed** (docs) |

Code-review candidates dropped:

- `endColumns` takes the first link's user as the earliest, not the leftmost (`bands.ts:137`). The
  guide documents it ("its first link in, so a download user comes before an upload one") and
  the plan asked for lane order; listed as owner question 2.
- The non-strict fallback tries only the unwidened layout and could leave a U unrouted when a gap
  has no slot: gaps are at least 64px (`TILE_GAP`), so there is always a slot; no route was
  missing on 250 random boards.
- `routeReturns`' cost, duplicated length/segment helpers, the inline cut, a dead guard
  (`x2 >= x1 && cs === ct` can't hold): efficiency or refactors, not defects (layout 22–31ms).
- Studies reordered to tune the layout: a recorded decision (LA03 did the same).
- The guide's "Added to the canvas for this study" paragraph is history: the marketplace section
  has the same record of the ladder step, which the design-polish rules ask for.
- An Uploads service with no object storage gets no finding: nothing in the plan asks for one;
  owner question 1.

Seams checked:

- **The playbook against YouTube v2 and the guide.** Every pattern's Jeeves mapping matches the
  study's tiles, settings and modules (dumped from `studioArchitectureExample`): the Upload
  service's creator check, multipart module and job publisher; the Transcoder's one-job
  concurrency and five modules; Completion events a topic with two consumers; the Watch API's
  cache-aside module (an hour, single-flight) and replica reads; View counts MySQL; Transcoded
  videos public R2 behind the CDN's origin; the Search API's query module. Caps are `laneLimits`
  (4 and 4). The fork, long-line and U smells quote the layout's numbers, which I measured again
  (8,864px, 1,056 and 1,024px, CDN 256px, Upload service 192px, Search indexer 800px). Only the
  notation disagreed (finding 2).
- **The Uploads kind** is complete per AGENTS.md: schema (`studioUploadsSettingsSchema`, in the
  discriminated union and `studioApplicationKinds`), defaults (`createStudioSettings`: public,
  `signed-url`), form (definition with the Transfer select, labels, performance fields), the
  Service tile's kinds, the link table's action row and `studioEntryKinds`, the noun, the icon,
  blueprint (`kind` from `studioApplicationKinds`, settings carried), chat (the preset sentence and
  `studioKindSchema`), docs (settings, CATALOG, blueprint doc, guide) and tests (operations,
  blueprint, lanes, E2E).
- **The layout tests are not loosened.** LA03's per-study checks (bands, no cross-band shared run,
  grid, no jog under 32px, no line through a tile) are unchanged; YouTube's crossings went 3 → 1,
  stricter. The TinyURL order changes in spec and server tests only follow its new link order.
  The one changed fixture: the old edit (a tile after View counts) is a link out of a store,
  which Jeeves refuses; at HEAD it turns View counts into an ordinary tile and moves 20 tiles,
  while the new edit (after the View counter) moves none and keeps the same three assertions.
  Edits after the Search indexer or the Completion handler move nothing; after the Transcoder or
  Upload jobs (a new fork) four tiles move down, as any new fork does.
- **Line style.** Code (`laneGraph`: dashed when async or not reachable from the user by
  requests), the guide ("so is every link that continues after one") and CATALOG agree; the
  playbook didn't (finding 2). Whether a request after a queue should be solid is SD04's owner
  question, carried below.
- **HUMAN_FEEDBACK's Resolution** matches the commits: SD01 `1331f58`, SD02 `122ef82`, SD03
  `413b96b`, SD04 `e0c02d5`, with the numbers the handoff entries measured (9,120 → 8,864px,
  576 → 192px, 736 → 256px, 1,632×1,440 → 1,504×1,376px, the owner's copy `0a12f132…`).

### Questions for the owner

New:

1. An Uploads service with no object storage link has no finding or warning, though its
   Transfer says how bytes reach storage. Add a design warning (like "a store with no writer"), or
   leave it to the reader?
2. A store several tiles use takes its column from its first link in (lane order), not its
   leftmost user, so when a download tile further right links first, an upload tile further
   left keeps a long line to it. Keep lane order, or prefer the leftmost user?

Carried (not repeated in full): SD04's list (TinyURL's "Open link" reaching the Stats API;
Payments reading the Catalog database; Identity under Publish; the hand-written chat preset
sentence; the fit's padding), SD04's Notes (the plan's literal store rule vs SD03's; how lines
that come back should look: arrowheads, a solid U for a request after a queue, or a store after
its writer), the marketplace's unstated photo transfer (SD01, SD02), and LA05's nine questions.

### Checks (Node 24.21.0 first in PATH), on the final tree

- `pnpm check`: exit 0 (Biome 206 files; type checks; 24 files / 171 tests, +1).
- `pnpm test:e2e`: 18 passed.
- `pnpm --filter @jeeves/web build`: exit 0 (the existing chunk-size advisory).

Browser: Playwright Chromium by mouse at 1440×900, my API on 4312 (scratch `JEEVES_HOME`,
scripted model, `jeeves_e2e`) and web on 4302, both stopped by PID afterwards. A new TinyURL
project (URL awaited): Shorten service `+` → Queue, Queue `+` → Service, that Service's attach tab
onto the URL database: 13 tiles, 15 lines, 6 dashed, no marks, revision 4; Redirect's and
Shorten's lines into the URL database meet only from x 608 to 640, and the new worker's U goes
over the store and down into it (zoomed with the wheel, it reads cleanly). Three Undos restored
11 / 12 / 3. New YouTube (21 / 25 / 12) and marketplace (20 / 23 / 6) projects render with no
marks. Six projects created over two runs, all deleted (204); `jeeves_e2e` again holds just
"TinyURL · studio study". No page errors, console errors or warnings. I did not touch 4300, 4304,
4310 or the `jeeves` database.

## 2026-11-06 — RF00: architecture review and reliable foundations plan (complete)

Review/planning only, on `5caefc2`; no application, preset, schema or generator changes.
Preserved the owner's three screenshots byte-for-byte in
`docs/human-feedback/2026-11-06-foundations-review-{youtube,marketplace,tinyurl}.png` and appended
the owner's points, review answers, decisions and open implementation work to HUMAN_FEEDBACK.
Earlier feedback and handoff entries were not edited.

Added `docs/plans/reliable-foundations/review.md`: source-backed review of all three diagrams,
primary architecture/OpenAI references, why routing and model constraints obscure behavior,
recommendations for the in-app agent, and the separate generator's contract/evidence boundary.
Added `units.md`: proposed RF01–RF07 for relationship clarity, path tracing, curated pattern
tools, deterministic preview/review, strict tool schemas, actual model evaluations and a final
review. Later contract and generator milestones are explicitly not yet dispatchable coding
units; refine those interfaces using the first milestone's evidence. The suggested execution
model is the owner's Sol xhigh, one unit per fresh agent, sequentially on primary main.
No subagents were launched.

Appended qualifications to the design playbook rather than erasing earlier lessons: work queues
do not imply once-only execution; an outbox does not atomically commit storage/provider effects;
multipart progress is not video lifecycle state; a business owner can include API and consumer
roles; asynchronous completion can return to its initiator; access intent differs from ownership;
and tested bricks do not establish tested compositions. README and PLAN link the review/plan.

Key findings for the next unit:

- `transcoder-read` exists in source and the saved YouTube project. Original videos should stay;
  the owner could not recognize its reader from the drawing.
- YouTube records metadata only after processing, with sibling metadata/search projections;
  recommend durable pre-publication state and explicit publication/recovery contracts.
- Marketplace records orders only after payment and directly reads Catalog from Payments;
  recommend a narrow pending-order/finite-stock checkout profile with deliberate ownership.
- Saved TinyURL is 2.0.0 revision 41; its CDN has `cacheRedirects: enabled` and only forwards
  cache misses, bypassing the click publisher on hits. Current preset 3.2.0 already removes
  CDN and adds Stats API. Do not replace the owner's custom project.
- Saved Marketplace is 1.2.0, source is 1.3.0; YouTube is 2.1.0 in both. Owner projects were
  read through GET only; this unit sent no semantic edits to them. A final read observed the
  owner's TinyURL had advanced to revision 53 during the review; findings above refer to the
  earlier revision 41 snapshot. Do not overwrite those intervening edits. The isolated E2E API
  was checked separately and held only its own default project after cleanup.
- Chat currently receives no playbook/pattern tool; OpenAI tool serialization is explicitly
  non-strict. Existing server validation, working copy, revision protection and undo are valuable
  and should be extended.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: pass, 206 Biome files, type checks, 24 test files / 171 tests.
- `pnpm test:e2e`: 18 passed.
- `pnpm --filter @jeeves/web build`: pass, existing chunk-size advisory.
- Local doc link targets exist; feedback/playbook/PLAN edits are append-only; image hashes match
  the attachments; `git diff --check` passes.

Browser: the owner's already-running 4300 session returned an empty page and a missing export
error for `studioStoreAccessLabels` from the Vite-served spec module. It was left running; this
was not reproduced by the fresh E2E servers. Used isolated 4302/4312 servers, scripted chat,
scratch JEEVES_HOME and `jeeves_e2e` for the visual review. Fresh TinyURL (11 tiles / 12 lines),
YouTube (21 / 25) and Marketplace (20 / 23) rendered at 1440×900. Selected Redirect service,
Transcoder and Payments by mouse, inspected screenshots and their inspectors. No page errors
on these successful checks. The first scratch walkthrough used an incomplete study option
label; corrected it to the full label and completed the remaining studies. All three created
projects were deleted (204). Screenshots are in
`/tmp/jeeves-foundations-review-g2gut0rt/`. Only the isolated review servers were stopped.

Local commit: **RF00: review architecture and plan reliable foundations**. Implementation and
owner discussion of the proposed semantic changes remain open. Keep the generator outside Jeeves.

## 2026-11-07 — RF01: clarify relationship styles and direction (complete)

Worked RF01 only, sequentially on primary `main`, from RF00 `4e2cd15`. The owner authorized the
plan on 2026-11-07 (“goahead and kick it off”); the plan is now in progress and records RF01 as
complete. No branches, worktrees, stashes, delegation or pushes. Preserved `.jeeves-feedback/`
and owner projects; no owner server was stopped.

Relationships now draw their own interaction: requests stay solid after queues, while async
publication/consumption stays dashed. TinyURL has 2 dashed lines (was 3), Marketplace 4 (was 6),
YouTube 7 (was 12); no relationships were added or removed. The generic board accepts an optional
target arrowhead, follows the last nonzero routed segment (including vertical returns and short
animated routes), and keeps the 44px line hit band and X. It imports no Jeeves code. Jeeves uses
the arrowheads on all lines. A screen-size Request/Async legend opens by mouse and explains
caller → target, including reads, and publisher → channel → consumer. Selected connections show
the existing saved label, interaction, arrow convention and inferred access. Store/line inspectors
state the current ownership-based inference and its inability to distinguish an owner's read
from a write. No settings/schema additions, store relocation, ownership/domain changes, access
inference changes, study revisions, blueprint version changes or generator work.

Current studio/catalog/settings/blueprint docs describe the notation. Appended feedback
Resolution and playbook lessons; earlier entries were preserved. Tests cover worker requests
after async links (including a restitched async call), named YouTube dependencies, generic arrow
geometry, unchanged hit/removal behavior, the legend, mouse route selection/removal/Undo, and
unchanged blueprint during selection. One old restitch test explicitly expected the inherited
dash; it now asserts both the restitched call's async/dashed style and its downstream store
request's sync/solid style. Topology/layout assertions were not loosened.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: pass, Biome 209 files; all type checks; 25 test files / 178 tests.
- `pnpm test:e2e`: 18 passed, native Chromium; no Docker-browser fallback needed.
- `pnpm --filter @jeeves/web build`: pass, existing chunk-size advisory.
- Exact JSON snapshots of all three study blueprints, captured before the implementation,
  match the final projection byte-for-byte. `git diff --check` passes.

Browser: isolated web/API on 4302/4312, scratch JEEVES_HOME, scripted chat and `jeeves_e2e`, using
Playwright Chromium by mouse. Created fresh TinyURL (11/12), Marketplace (20/23) and YouTube
(21/25), checked both 1440×900 and 1280×800 fitted views and 0.95 zoom, expanded/collapsed the
legend, selected actual routes, removed each study's selected return with its on-screen X at
zoom, and used Undo. These were Analytics worker → Analytics store, Search indexer → Search
index, and Transcoder → Original videos. Each return's X stayed visible and clickable at both
sizes. Also selected Upload jobs → Transcoder (dashed, Channel → consumer) and View counter →
View counts (solid, inferred write). Transcoder's line visibly points into Original videos and
its inspector says Reads originals, Request / response (solid), Reads. Read/selection and the
remove/Undo round trip preserved semantic blueprint content (only revision advanced for edits).
No page/console errors or warnings. All three scratch projects deleted (204); only the isolated
servers were stopped. Owner 4300/4310 and the `jeeves` database were untouched.

Screenshots inspected under `/tmp/jeeves-rf01-browser-SamcIy/` (16 images plus `results.json`):
`youtube-1440-zoomed.png` shows the selected Transcoder read; `youtube-1280-fitted.png` the small
overview and expanded legend; `youtube-1280-view-count-write.png` and
`youtube-1440-job-consume.png` show the other named relationships. The coordinator also inspected
the first two images. Both-rails fitted zooms remain TinyURL 0.560/0.449, Marketplace 0.368/0.322,
YouTube 0.377/0.303 (1440/1280).

Next unit: RF02's focus and route identity remain necessary. Target arrows and selected-line
explanations make requests recognizable at zoom, but overview names are still tiny, shared
trunks/crossings remain ambiguous, and U's still wrap intervening tiles. Arrowheads on a shared
target segment cannot identify which upstream route owns it. This unit does not claim to solve
those problems or the review's architectural questions. RF02 was not started.

Local commit: **RF01: clarify relationship styles and direction**.

## 2026-11-07 — RF02: focus and trace individual relationships (complete)

Worked RF02 only, sequentially on primary `main` after RF01 `30f1c9b`, under the owner's plan
authorization. No delegation, branches, worktrees, stash or push. Preserved `.jeeves-feedback/`,
owner projects and owner 4300/4310. No pattern/chat/provider/generator work.

**Focus relationships** keeps a tile anchor and incoming/outgoing endpoint, saved-verb and
Request/Async lists. A row selects its exact saved edge ID and isolates that route while keeping
the list open; **All for this tile** restores its immediate relationships. Other tiles stay
dimmed and clickable; selecting another changes the anchor. A screen-size strip counts shown/
hidden relationships and offers **Fit focus** (the complete route plus endpoints) and **Show
all**. Selection keeps the camera stable. The return X remains, with **Remove relationship** in
the list calling the same removal/Undo. Removed anchors follow a surviving selection or fall
back to the full view. All focus/fitting is local view state, with no revision or blueprint edit.

The generic board resolves line hits by distance to visible centrelines; equally close routes
open a clamped, scrollable chooser with endpoint names and labels. SVG stacking cannot silently
select a different overlapping route. The chooser wheel scrolls without zooming the canvas
(covered by E2E). Proper crossings have a visual gap; shared port stems stay connected. A bounded
post-routing pass separates vertical stems in free grid slots, rejecting more crossings/band
clashes, short jogs, through-tile/chip routes, column changes or moves outside existing bounds.
It skips chipped routes, moves no tiles and widens no gaps. Only YouTube's Watch → View counts
and Watch → View events stems move x 576 → 608. Return geometry is unchanged. The board imports
no Jeeves code; all previous topology/layout assertions remain intact.

Diagnostics, before → after:

| Study | Total line length | Longest | Crossings | Pairwise shared vertical length |
| --- | --- | --- | --- | --- |
| TinyURL | 2,752 → 2,752px | 416 → 416px | 0 → 0 | 64 → 64px |
| Marketplace | 6,912 → 6,912px | 896 → 896px | 1 → 1 | 160 → 160px |
| YouTube | 8,864 → 8,864px | 1,056 → 1,056px | 1 → 1 | 160 → 80px |

All tile positions/bounds stay unchanged (1,024×832, 1,280×1,472 and 1,504×1,376px). No service
identities, dependencies, ownership/access inference, settings, presets or blueprint semantics
changed. Updated studio/blueprint docs and appended feedback Resolution, playbook and plan progress.

Checks (Node 24.21.0 first in PATH), on the final implementation:

- `pnpm check`: pass; Biome 215 files, all type checks, 27 test files / 182 tests.
- `pnpm test:e2e`: 21 passed, native Chromium.
- `pnpm --filter @jeeves/web build`: pass, existing chunk-size advisory.
- `git diff --check`: pass. Added route-identity/crossing/bounds/Watch-stem tests and E2E for
  focus, unchanged blueprints/positions, chooser scrolling, return removal/Undo and anchor removal.
  Corrected a deletion assertion to await that exact route's disappearance before reading storage.

Browser: isolated 4302/4312, scratch JEEVES_HOME, scripted chat and `jeeves_e2e`, Chromium by
mouse. All three studies at 1440×900 and 1280×800: fitted, tile focus, single route, Fit focus,
0.95 zoom, return X removal/Undo, anchor changes and Show all. All six return Xs stayed fully
visible. Traced Transcoder reads Originals/writes Transcoded, Watch reads metadata, and Completion
handler/Search indexer writes independently; TinyURL's analytics and Marketplace's indexing
returns also work. Hidden counts remain explicit (Transcoder 4 shown/21 hidden; selected route
1/24). Selection/focus/fitting preserve the exact blueprint; remove/Undo restores its semantics
apart from revision, and tile positions restore after animation. Actual overlapping mouse choice
and zoomed crossing checked at both sizes. Successful runs had no page/console errors or warnings.
All scratch projects deleted (204); E2E DB again holds only default TinyURL. Only my servers stopped.

Evidence: `/tmp/jeeves-rf02-browser-UlF3da/` (50 PNGs, results.json and two scripts), including
`youtube-1440-zoomed.png`, `youtube-1280-{transcoder-write,watch-metadata,handler-metadata,indexer-write,overlap-chooser,crossing}.png`,
`tinyurl-1280-fit-focus.png` and `marketplace-1280-zoomed.png`; images inspected by me and several
by the coordinator. Shortened the header to **All for this tile** after a tight long anchor name
at 1280. Both-rails fits remain TinyURL 0.560/0.449, Marketplace 0.368/0.322, YouTube 0.377/0.303
(1440/1280); the checked study returns Fit focus at 1.0. Watch's longer metadata route fits
smaller, with screen-size endpoint/verb text in the list.

Remaining: full-overview names need zoom, crowded same-band stems remain, and long U returns can
still resemble frames. Focus makes individual routes traceable, not the whole overview instantly
readable. Logical ownership, asynchronous lifecycle/return semantics, architecture completeness
and generator contracts remain open. RF03 should expose those limits in its reviewed patterns;
no schema migration is needed here. RF03 was not started.

Local commit: **RF02: focus and trace individual relationships**.

## 2026-11-07 — RF03: give chat reviewed design patterns (complete)

Worked RF03 only on primary `main` after RF02 `251ef15`, under the owner's sequential unit
authorization. No delegation, branches, worktrees, stash or push. Preserved `.jeeves-feedback/`,
owner projects, owner 4300/4310 and the `jeeves` database. RF04 was not started.

Added typed local catalog/record version **1.0.0** in `studio-patterns.ts`: cache-aside lookup,
durable background jobs, committed publication to search and pending-order/payment coordination.
Each record declares applicability, roles, required relationships, variants/tradeoffs, stable
checklist/obligation IDs, primary references, represented topology and explicit unsupported
implementation obligations. Three topology-only examples use current validated commands/defaults;
payment returns a conceptual obligation sequence because the same-owner outcome cannot be
represented. No workaround completion service, new schema/settings, ownership model, lane-rule
change, study edit, provider change, template, generator or evaluation harness was introduced.

`listStudioPatterns` and `describeStudioPattern` run in Workspace and the real ChatService tool
loop with finite strict inputs, bounded results and mouse-visible activity. Instructions call for
relevant retrieval before building/substantial restructuring, allow trivial renames directly,
and say retrieval does not establish applicability. Store-access instructions now accurately
describe the existing ownership inference and its inability to distinguish an owner's read.
Defaults/link rules still come from the existing catalogs. Lookup is read-only; command edits
retain the existing whole-turn commit/Undo and revision checks.

Reviewed against RF00 and primary documentation: outbox atomicity is one database state/intent
transaction, not storage/payment atomicity; job delivery/execution can duplicate; processing
success differs from committed publication; search-after-commit still needs cache/replica
read-after-publish; finite stock requires concurrency/expiry/compensation scope; redirect cache
hits can bypass analytics. The coordinator corrected an overly media-specific generic
publication obligation; the final record puts Ready/Failed/Cancelled/current-attempt behavior
in a media variant, while the core requires authoritative publish/update/unpublish. Coordinator
review found no remaining blocking issue in the final catalog, chat/docs/tests and screenshot.

Checks (Node 24.21.0 first in PATH):

- `pnpm check`: pass, Biome 217 files, all type checks, 28 test files / 191 tests.
- `pnpm test:e2e`: 22 passed in native Chromium.
- `pnpm --filter @jeeves/web build`: pass, existing chunk-size advisory.
- `git diff --check`: pass. Command examples execute through `buildStudioCommand` and
  `applyOperations`; four fake-provider transcripts through ChatService receive the requested
  pattern/support limits, three examples commit and undo once, unsupported checkout emits the
  received obligation without any design/revision change. Invalid/extra lookup arguments refuse
  without workspace mutations. E2E checks visible lookup activities and unchanged blueprint.

Browser: isolated 4302/4312, scratch JEEVES_HOME, scripted chat, `jeeves_e2e`; no owner server or
owner DB use. By mouse, created TinyURL (11 tiles/12 lines) and YouTube (21/25), checked fitted
and focused/zoomed views at 1440×900 and 1280×800. On YouTube sent **Review the processing
lifecycle**, observed job + publication lookup activity/version and a precise same-owner
return obligation. The turn has no operation ID; full blueprint/revision remained identical.
Selection/focus also preserved blueprint content. No page/console errors or warnings. Both
scratch projects deleted (204); E2E DB again contains only the default TinyURL. Only isolated
servers were stopped; owner listeners remained unchanged.

Evidence: `/tmp/jeeves-rf03-browser-VSb9ga/` contains eight screenshots, `walkthrough.mjs` and
`results.json`. Inspected `youtube-1280-fitted.png`, `youtube-1440-focused.png` and
`tinyurl-1280-fitted.png`; the coordinator also inspected the small YouTube fitted screenshot.
Current studio/catalog/tool docs live in `docs/studio-patterns.md`, with feedback Resolution,
playbook lessons and plan progress appended/updated.

Remaining: retrieval is model guidance, not a server-enforced gate or deterministic reviewer.
All records explicitly report no runtime template and no runtime verification. Scripted
transcripts prove plumbing and command validation, not live-model design quality. Same-owner
callbacks, lifecycle/ownership/access contracts and the previously recorded overview limitations
remain open; no fake tile repairs them. RF04 should reuse pattern/version/checklist/obligation
IDs while keeping applicability and represented facts separate from unmodeled requirements.

Local commit: **RF03: give chat reviewed design patterns**.


## 2026-11-07 — RF04: review proposed chat designs before saving (complete)

Worked RF04 only after RF03 `317ae6c`, on primary `main`, under the owner's sequential unit
authorization. No delegation, branches, worktrees, stash or push. Preserved `.jeeves-feedback/`,
owner projects, owner 4300/4310 and the `jeeves` database. RF05 was not started.

Added pure `reviewStudioDesign` and read-only `reviewDesign`: staged identity additions/updates/
removals include settings/ownership, modules and actions; existing validation findings retain
node/connection/path targets and introduced flags. `declareReviewScope` explicitly selects up
to four patterns with applicable checklist IDs, eight assumptions and eight custom obligations
for this turn only. Unknown/duplicate IDs or missing targets refuse without mutation. Retrieval
alone selects nothing. Selected checks/unsupported obligations retain pattern/version/stable IDs
and say **not specified**; no contract/side-effect inference from names, labels or modules.
No persisted settings, contracts, blueprint version, pattern records or ownership rules changed.

Reused warning paths; added Uploads without an object-storage dependency and workers with zero
outgoing relationships. Calls/publications count as represented outgoing relationships, without
claiming business outputs. Warning marks, inspectors and blueprint findings remain saveable;
structural invalidity still refuses the whole batch.

Chat now sends a fresh staged review through an actual tool-call/result continuation before
staged commands or meaningful scope finish. Edits invalidate it; at most two response batches
repair commands/scope within the original 16 rounds. Questions still end immediately with
review/summary; pure conversational replies need no extra call. Edited turns commit/undo once;
review-only and semantic no-op turns write no design revision. Final compact text and mouse
**Review details** separate the exact chat snapshot from current saved-state findings and precise
unsupported requirements. Conflicts/provider failure review storage without claiming proposals
were saved. Post-commit mouse edits are not attributed to chat. Deletion yields a failed turn
with `done.state: null`; client skips adopting missing state.

Checks (Node 24.21.0 first in PATH): `pnpm check` passes (Biome 218 files, all type checks,
28 files / 203 tests); `pnpm test:e2e` passes (23, native Chromium);
`pnpm --filter @jeeves/web build` passes (existing chunk-size advisory); `git diff --check` passes.
Real ChatService/fake-provider tests cover nonpersistent multi-command preview, repair from
received findings, forced/stale review, atomic rejected batch, concurrent canvas conflict,
post-commit canvas interleaving, deletion, two-repair/original round limits, same-owner obligation,
question behavior, no-op/review-only and one Undo. Unit tests remain network-free/PGlite.

Browser evidence: `/tmp/jeeves-rf04-browser-lJqWut/` (14 PNGs, walkthrough.mjs, results.json).
Isolated 4302/4312, scratch JEEVES_HOME, scripted model and `jeeves_e2e`. At 1440×900 and
1280×800, TinyURL renders (11 tiles/12 lines); adding Uploads saves a visible storage warning
and precise lifecycle obligation, opens Review details by mouse, and keeps warning/blueprint
stable during focus/Fit focus. One mouse Undo restores prior blueprint semantics (revision 3).
YouTube's explicitly scoped processing/publication review reports seven **not specified**
requirements, no operation ID and an identical full blueprint/revision (21/25). Fit and focused
views pass at both sizes. No page/console errors or warnings. Images inspected by me; coordinator
also inspected the small TinyURL disclosure and YouTube summary. Both scratch projects deleted
(204); E2E DB again holds only default TinyURL. Only isolated servers stopped.

Remaining: model/user scope selection is not a server completeness gate; undeclared requirements
remain outside review. Unknown payloads, lifecycle, ownership/access and runtime behavior are not
verified. Pattern/template/evidence distinctions remain; live-model design quality, strict wire
schemas (RF05), evaluations (RF06), contract/generator milestones and previous overview limits
remain open. No fake solution tiles or general requirements editor were added.

Local commit: **RF04: review staged designs before saving chat**.

## 2026-11-07 — RF05: preserve command semantics with strict OpenAI tools (complete)

Worked RF05 only after RF04 `8887b75`, on primary `main`, under the owner's sequential unit
set authorization. No delegation, branches, worktrees, stash or push. Preserved
`.jeeves-feedback/`, owner projects/settings, owner 4300/4310 and the `jeeves` database.
RF06 was not started.

Added finite provider-local `openai-schema.ts`: strict Responses function tools require all
properties and closed objects; ordinary optional nulls represent omission. Already-nullable
optionals use null for absence or `{value: ...}` for presence, including `{value: null}` to
clear `edit.owner`. Defaults remain server behavior (`askUser.allowFreeText` remains true).
Whole-value canonical/wire validation precedes normalization; no unknown keys are stripped.
Returned ToolCall/ModelItem arguments are canonical and are deterministically re-encoded on
history replay, preserving omitted versus cleared ownership and synthesized review calls.
No domain schema/settings, canonical command meanings, provider-neutral shape or Codex behavior
changed. Codex docs/comments/tests accurately say its outer structured answer contains argument
JSON strings whose inner values are not constrained.

Audited every current tool, including RF04 scope: canonical schemas contain 18 oneOf, 3 anyOf
and no references. Only provably disjoint oneOf becomes anyOf; references and every unaudited
keyword refuse with a schema path before transport. Bounds/enums/patterns remain explicit;
const becomes a singleton enum and default/dialect annotations do not become command mutations.
Emitted applyStudioCommands has 427 properties, 538 enum values, conservative nesting nine.
Budget guards cover documented schema limits. The adapter's audited subset is intentionally
narrower than OpenAI's full support; new constructs require deliberate codec coverage.
Server Zod refinements, command builder, graph validation, atomic turns and Undo remain final.
Current docs: `docs/chat-tool-schemas.md`, studio, README, CATALOG; playbook/feedback/progress updated.

Checks (Node 24.21.0 first in PATH): `pnpm check` passes (Biome 221 files, all type checks,
30 test files / 225 tests); `pnpm test:e2e` passes (23, native Chromium);
`pnpm --filter @jeeves/web build` passes (existing chunk-size advisory); `git diff --check` passes.
Mock fetch captures actual transmitted strict schemas for all ten tools, decodes nested
add/edit/module/settings/from/connection/retry/scope calls, executes representative commands
through Workspace and compares direct canonical results. Three request continuations preserve
owner omission/clear/set exactly. Tests refuse malformed/extra nested input, unknown tools and
unsupported constructs, while wire-valid Zod-refinement/lane-invalid calls still fail in
Workspace without mutation. Unit tests need no key/network/Docker/Postgres.

Browser evidence: `/tmp/jeeves-rf05-browser-o5PFdc/` (eight PNGs, `walkthrough.mjs`, `mock.mjs`,
`requests.json`, `results.json`). Isolated 4302/4312, scratch JEEVES_HOME and `jeeves_e2e`; the actual
OpenAI adapter used a loopback-only scripted Responses endpoint on 4313 with a fake credential.
No external model/API calls. At 1440×900 and 1280×800 TinyURL renders (11 tiles/12 lines), fitted
and focused; a mouse chat store rename preserves owner/purpose/settings, explicit-null clearing
changes only owner, and one mouse Undo restores it. Question omission shows free-text entry;
clicking Small works and changes no design. All eight captured strict requests pass mock
assertions, including actual review continuations and strict history replay. No page/console
errors or warnings. Inspected small owner/question and large focused screenshots. First script
attempt checked Undo before its request finished; corrected it to await the new revision, then
reran successfully. Both scratch projects deleted (204); E2E DB holds only default TinyURL.
Only isolated servers/mock stopped; owner listeners remain.

Remaining: no live API schema acceptance or model design quality evidence. Model variants may
have narrower schema support and explicit API rejections are not silently downgraded. Codex's
inner argument values are unconstrained until server validation. Strict shape cannot establish
unmodeled lifecycle/ownership/access/business semantics, runtime templates or verification.
RF06 may now exercise the intended model; RF07 still reviews the milestone. Prior overview and
semantic-model limitations remain open. No generator work was introduced.

Local commit: **RF05: preserve command semantics with strict OpenAI tools**.

## 2026-11-07 — RF06: reproducible chat design evaluations (tooling complete; Mini evidence blocked)

Worked RF06 only after RF05 `f5a9aa1`, on primary `main`, under the owner's sequential-unit
and bounded live-run authorization. No delegation, branches, worktrees, stash or push. Preserved
`.jeeves-feedback/`, owner 4300/4310, owner settings/projects and the `jeeves` database. RF07,
semantic contracts and generator work were not started.

Added eval 1.0.0: six compact synthetic cases cover video build/publication repair, finite-stock
checkout build/late-notification edit, TinyURL response-cache repair/unsupported edit, including
held-out variations. Versioned RF00 instructions/six tools retain source/capture provenance.
The baseline is deliberately a guidance/tools/no-review ablation sharing current context,
Workspace/provider transport/atomic save, with unavailable-tool refusal/continuation. Current
uses production ChatService. It never swaps baseline tools under the current review gate.
External checks inspect represented dependencies, ownership/settings and protected edits;
status-bearing obligations or plain-language unresolved requirements receive equal treatment.
Prose/claim signals require independent adjudication, and modules/names prove no implementation.

`pnpm eval:chat` replays hand-authored canonical fixtures twice in disposable PGlite, with fetch
forbidden. `--report=<absolute JSON>` replays recorded responses and verifies context hashes,
final design, before state, activity, questions, tool results, obligations, refusals, attempted
mutation batches after review and checks. Explicit `--live --allow-paid-api` opts in; default
Mini is pinned to `gpt-5.4-mini-2026-03-17`, with omitted reasoning (documented default none),
16 responses/4,096 output tokens/180 seconds per case and maxRetries 0. Provider-required opaque
state stays in memory; artifacts omit credentials, headers and opaque/encrypted reasoning.

Actual Mini access attempt: twelve first requests returned **no credits**, zero model responses,
unknown usage/cost and untouched designs. The initial stop matcher missed that wording; fixed
with regression, retained all failures and made no further Mini calls. Access rows and sections
say not evaluated; they prove neither model quality nor live strict-schema acceptance.

Coordinator authorized a separate fallback after CLI smoke succeeded (3.59s): existing Codex
SDK 0.162.1 / CLI 0.165.0, requested `gpt-6.1-sol` alias, existing medium effort, ChatGPT login,
API-key variables unset only in the owned subprocess. No owner login/settings changes. Same
16-response/180-second limits both arms; output cap is unsupported by that adapter, and SDK
retry behavior uncontrolled. All six pairs finished, no questions/timeouts/provider failures:

- RF00: 14 responses, 255.4s case latency, 372,310 input / 34,432 cached / 8,199 output tokens,
  three refused calls repaired, zero mutation batches after review.
- Current: 29 responses, 298.9s, 909,034 input / 96,000 cached / 9,352 output tokens, four refused
  calls repaired, three attempted mutation response batches after review (two checkout build,
  one late-notification edit; includes scope). Monetary cost/billing unknown; Mini rates do not
  apply to the CLI login. Largest observed output response: 1,495 tokens, not an enforced cap.

Implementation and independent coordinator **AGENT** review credit both arms' honest unresolved
requirements across all six cases. Baseline's five lexical misses are semantically credited;
its preserved-original owner move is a tradeoff, not confirmed deletion (the prompt froze exact
export details). Current retains original initiation ownership but leaves callbacks unmodeled.
Current analytics review emits broader job lifecycle noise; scope precision remains limited.
No confirmed critical destructive/domain/support claim was found in this small sample. No Mini
improvement, population-quality gain, runtime/template/deployment or human-acceptance claim.

Owner-readable artifacts: `docs/chat-evals.md`, `docs/evals/rf06/README.md`, `codex-live.md/.json`,
`access-blocked.md/.json`, `codex-smoke.json`, `reviewer-notes.md` and `browser.json`. Full public
canonical outputs/graphs are retained. Raw candidate flags remain, separately adjudicated.
As-run prompt/tools/pattern/case/rubric/source hashes are recorded. Later changes only clarify
one baseline comment and runner portability/reporting/access/replay; no proposal/case tuning.
Feedback Resolution, playbook lessons, plan progress and README usage are current.

Final checks with Node 24.21.0 first in PATH: `pnpm check` passes (Biome 234 files, all typechecks,
31 files / 239 tests, including 14 RF06 tests); `pnpm test:e2e` passes (23, native Chromium);
`pnpm --filter @jeeves/web build` passes (existing chunk-size advisory); `git diff --check` passes.
Offline CLI passed all twelve hand-authored outcomes (six pairs) twice, and replayed all 12 fallback outcomes
and all 12 access failures identically with no network. Tests include destructive/original
loss, publication bypass, unrelated edits, unsupported claims, missing domain obligations,
response caching, plain-language alternatives, strict review replay, unavailable baseline tools,
no-credits fail-fast, zero-response report suppression and response-batch repair counting.
A final-check lint pass initially caught formatting in new browser metadata; formatted and reran.

Browser evidence: `/tmp/jeeves-rf06-browser-fQmy3H/` (32 PNGs, walkthrough.mts, three results
JSONs; screenshot hashes/counts in committed `browser.json`). Isolated 4302/4312, scratch
JEEVES_HOME, scripted provider and `jeeves_e2e`. By mouse at 1440×900 and 1280×800, default
TinyURL renders (11 tiles/12 lines), plus current video build, both publication repairs, both
checkout builds and both TinyURL cache repairs. Fit, tile selection, Focus relationships,
Fit focus and Show all work; all design/blueprint values stay identical. No page/console errors
or warnings. All eight scratch projects deleted (204); E2E DB retains only default TinyURL.
Only owned servers stopped; owner listeners unchanged. Scratch settings directory was never
created. Agent image review finds baseline publication overview unreadable at 0.22 zoom with
both panels; focus/endpoint lists help, while other overviews still need zoom. Human review
remains pending.

Remaining release-claim blockers/limits: intended Mini quality and live strict API acceptance
blocked by credits; owner/human review pending; six paired samples are not a general benchmark;
scope completeness/precision, ownership/access, same-owner lifecycle, publication/cache visibility,
finite-stock/payment/analytics contracts, runtime templates/evidence and overview readability
remain open. RF07 must review the milestone without treating these gaps as implemented.

Local commit: **RF06: add reproducible chat design evaluations**.

## 2026-11-07 — RF07: Milestone 1 review and next contract plan (review complete)

Worked RF07 only after RF06 `fab3d59`, on primary `main`, as the fresh sequential review agent.
No branch, worktree, stash, push or further delegation. Preserved `.jeeves-feedback/`, owner
settings and saved documents. No Milestone 2 schema/study implementation or generator started.

Independently reviewed RF00→RF06 diffs and seams: local pattern content through actual chat
continuations; staging/review-generation/repair/commit, atomic refusal, revision conflict,
post-commit attribution, deletion/no-op/question/Undo; strict schema omission/null/default and
canonical-history replay; lane arrows/styles, branch geometry, route selection/focus/removal;
eval policy/cases/rubric/raw public outputs and representative tool/graph sequences. No confirmed
production regression justified code changes. Corrected PLAN's stale six-tool/pre-RF04 warnings
and loop/provider prose. Added `milestone1-review.md`, six retained saved-copy images and browser
metadata; appended feedback/playbook lessons without rewriting prior entries.

The ledger distinguishes bounded fixes (notation, exact identity/focus, chat review and mocked
strict transport) from partial overview readability and open/model-blocked architecture. Durable
Original videos has a reader. YouTube pending/failed/current-attempt lifecycle and committed
publication order, Marketplace pending/finite-stock/payment recovery and TinyURL legacy-CDN
analytics bypass/missing reader remain unresolved. Typed ownership/access/API/message/state/
failure contracts, persistent requirements, templates and exact runtime evidence remain absent.
RF06 Mini still has zero responses/no credits, so no Mini quality/live strict API acceptance.
Both fallback arms retain honest unresolved-obligation credit; raw lexical/owner flags do not
prove semantic failures. Current's broad click-job scope emits unrelated lifecycle obligations;
scope precision and 2.44× input / 2.07× response overhead remain disclosed, not “fixed” by docs.
No live/paid model calls were made in RF07 or old as-run records altered.

`next-contract-plan.md` proposes NC01–NC06 plus independent NC14 review of the small TinyURL
subset, followed by a separate backend proof once its repository/conventions are known. NC07–13
are deferred expansions, not first-proof prerequisites. Chosen proposed defaults/gates cover
immutable create/resolve scope, one Links owner with API roles, explicit dependency intent/role
grants and later operation bindings within them, finite exact version/schema refs, persistent
critical requirements, explicit design/blueprint v3 and v2 refusal for unsupported content.
Cache policy checks validate clamp-to-record-expiry declarations, not unknown runtime timestamps;
checkout checks require a concurrency contract, not claim real stock safety. Compatibility,
availability and artifact verification stay separate; unknown critical requirements block
readiness. Every vertical unit includes migration/mouse/chat/export/Undo and strict-tool-budget/
request-effort audits. One acceptance can authorize the first phase; routine choices do not add
repeated owner-permission gates. All semantics remain proposals, not current capabilities.

Checks with Node 24.21.0 first in PATH: `pnpm check` passed (239 unit tests / 31 files, typechecks
and Biome); `pnpm test:e2e` passed (23 native Chromium); `pnpm --filter @jeeves/web build` passed
(existing chunk-size advisory). Synthetic eval replay passed twice, all twelve recorded Codex
outcomes and all twelve failed Mini first requests replayed identically with fetch forbidden.
Final document/JSON lint and `git diff --check` passed. No implementation-mirroring tests added
for this documentation review.

Browser evidence: `/tmp/jeeves-rf07-browser-b4rY6k/`, 43 isolated-acceptance PNGs plus owner
before/after screenshots, source captures/hashes, `walkthrough.mts`, results/check/eval logs.
Six useful images and `evidence/rf07/browser.json` are retained beside the review. API/web
4312/4302, scratch JEEVES_HOME, scripted provider and `jeeves_e2e`; no owner project replacements.
Latest owner GETs at 16:51:33 UTC were TinyURL rev53 (9 elements/9 saved links), YouTube rev1
(18/18), Marketplace rev1 (17/14). New blank copies preserve full design identities/settings/
architecture excluding revision. At 1440×900 and 1280×800, default TinyURL renders (11/12), and
saved copies render (12/13, 21/25, 20/23 including actor/action/entry edges). Mouse traces identify
all requested Originals/output/Watch/handler/indexer, CDN/reputation/custom, Catalog/payment/order
paths; solid versus dashed styles/target arrows/verbs match saved edge identity. Watch overlap
chooser selects the requested metadata route. Fit/focus/Fit focus/Show all preserve the entire
design and blueprint including revision. Exact edge removal on each copy (`redirect-db`,
`indexer-write`, `payments-prices`) and one mouse Undo restore complete semantics/export with
the expected new revision. No isolated page/console warnings/errors. Images inspected directly;
coordinator independently inspected small Originals/Catalog focus and YouTube overview.
Overview names remain small at YouTube 0.35 / Marketplace 0.32 even with rails closed; focus
helps inspection but does not close that concern. Owner/human readability acceptance is pending.

Read-only owner 4300 initially reproduced the stale Vite missing `studioStoreAccessLabels`
transform and blank page. Coordinator refreshed source/config mtimes only; normal API/Vite
watchers reloaded with no content changes/process kill/settings/design mutation. A second fresh
browser loaded YouTube's 21 tiles without page errors or write requests. All three owner saved
hashes/revisions remained identical. Listener PIDs need not be unchanged after normal watchers.
All four owned scratch projects deleted (204); E2E DB retains only its default TinyURL. Stopped
only own 4302/4312 listener processes; scratch settings directory was never created.

Next: owner can assess the ledger/diagrams and proposed first-phase defaults. Intended Mini/live
strict evidence and owner review remain open; no contract/generator unit was started. Review
and record scope before dispatching implementation; backend repository/conventions are still
an actual dependency for its separate proof.

Local commit: **RF07: review milestone one and plan typed contracts**.

Coordinator review also aligned the future generator briefs with the narrow first-phase scope:
core auth/create/resolve/expiry/cache/idempotency and real-adapter recovery first; disabled links,
messaging/analytics/Stats and queue redelivery need separately accepted profile extensions. Source
hashes/determinism, custom extension preservation and generated-file conflict checks stay in core.

## 2026-11-07 — NC01: persistent profile scope and explicit v3 boundary

Worked NC01 only after RF07 `886eb77`, sequentially on primary main. Recorded the owner's
existing first-phase authorization and G1/G4 decisions in `next-contract-plan.md`; the prior
milestone stop was a coordination error, not a missing owner permission. No branch, worktree,
stash, push, delegation, owner project/preset migration, generator or runtime implementation.
Preserved `.jeeves-feedback/` and owner settings/designs.

Added explicit strict `designV2Schema` / `designV3Schema` readers. Reads never upgrade; v3 adds
bounded top-level `scope`: exact nullable profile ref, ten finite included/excluded behavior
rows with required/advisory criticality and up to eight targeted unresolved custom requirements.
`tinyurl-create-resolve@1.0.0` defaults to immutable HTTP(S) targets, authenticated create,
public resolve and optional expiry in one public namespace; custom slugs, destination mutation,
disable/management, reputation, quotas and exact analytics are excluded. Required conflicts stay
saveable and block this scope instead of disappearing. Unknown well-formed profiles remain
unresolved; malformed refs/duplicate declarations refuse atomically. Missing targets retain the
original requirement and add a namespaced diagnostic. Profile selection reports owner/access,
create, resolve and expiry/cache contracts as not specified, never a capability or ready result.

Shared `previewDesignScope` / `buildDesignScopeCommand` back the header mouse form and narrow
chat `configureDesignScope` tool. Schema2 requires a pure preview then explicit upgrade; saves
use normal revisions, conflicts, complete history and one Undo (including back to schema2).
Scope-only changes enter staged change review and invalidate it. A shared mutation classifier
also covers the real chat repair limit and RF06 observer: two repair batches, third apply
refused, read-only previews still allowed. RF04 turn-only scope stays distinct. Strict omission,
nullable profile and canonical historical replay are preserved. No tile-command union expansion.

Default `/blueprint` remains v2; `?version=2|3` selects explicitly, other versions refuse 400.
Legacy-only v2 meaning remains identical, including an empty-scope schema3 boundary. Content
v2 would lose returns 422 `UNSUPPORTED_BLUEPRINT_CONTENT` with every exact scope path/reason.
V3 retains all declarations/unknown refs, source schema and unresolved requirements; inferred
legacy access is explicitly labeled, template availability/runtime verification both `none`.
The form saves through design operations and never calls the old blueprint for persistence.
Docs/settings/catalog/PLAN and append-only feedback/playbook records match these boundaries.

Checks, Node 24.21.0 first in PATH: `pnpm check` passed (248 tests / 33 files, Biome and all
workspace typechecks); `pnpm test:e2e` passed (24 native Chromium); web production build passed
(existing chunk-size advisory); `git diff --check` passed. The frozen schema2 fixture's v2 export
was also compared independently against the original HEAD blueprint source and matched exactly.
Tests cover unknown/malformed refs, pure previews, save/edit/PGlite close-and-reopen, stale
conflicts, atomic refusal, missing targets, mouse/chat canonical equality, strict transport and
one-step cross-version Undo/Redo. A local 15s timeout bounds the test with two actual PGlite
starts/migrations/disk reloads (5s was exceeded under concurrent browser load). The existing
warned-chat E2E now waits for streaming completion before opening final Review details; clicking
the transient live disclosure could lose open state when replaced. This is a test timing repair,
not a new production UI behavior. Heavy final suites ran sequentially.

Strict emitted schema audit: new tool 17 properties / 18 enum values / nesting five (2,497 UTF-8
bytes with metadata). `applyStudioCommands` unchanged at 427 / 538 / nine. On the same default
schema2 TinyURL: rendered instructions 10,161→11,237 bytes, caller context 13,549→15,147,
strict tools array 55,397→57,895. These are bytes, not model tokens, costs or quality evidence.
The new versioned scripted scope fixture exercises five responses with repair/refusal/preview;
no live/paid model calls. RF06's historical 2.44× input / 2.07× responses remain disclosed.

RF06 raw as-run Codex/Mini records are unchanged. Old Codex replay intentionally stops before
its first response: `video-build/rf00-ablation` round1 expected request hash `77669bb5…`, now
`05ea669f…`, because shared caller context explicitly adds schemaVersion, persistent scope and
unknown requirements plus profile defaults. Current arm additionally changes instructions/tools.
The replay CLI subsequently reports a design mismatch because the seed was not edited after
context refusal. Full exact hashes/reason are retained in `evidence/nc01/replay-drift.json`.
The current network-forbidden synthetic RF06 suite still replays all twelve cases deterministically.
No old outputs were rewritten to appear compatible; Mini/live strict acceptance remains blocked.

Browser evidence: `/tmp/jeeves-nc01-browser-GrWanS/` (walkthrough.mts, 12 PNGs, API refusal,
check/E2E/build/replay logs), with three directly inspected useful PNGs and audit/results/drift JSON
retained in `docs/plans/reliable-foundations/evidence/nc01/`. Own API4312/web4302 used scratch
JEEVES_HOME, scripted provider, `jeeves_e2e`; owner 4300/4310 untouched. At 1440×900 and 1280×800,
default TinyURL renders 11 tiles / 12 lines; mouse preview is pure, required custom slugs blocks narrow
scope, targeted custom behavior persists through save/reload/edit, and default v2 refuses all 12
unsupported paths. Focus/Fit focus/Show all/Fit preserve the full v3 export including revision.
Mouse target removal retains the original scope and shows both missing tile/relationship; one
Undo restores removal, one restores the scope edit, and one restores schema2 meaning. No page or
console errors/warnings. Both scratch copies deleted (204); E2E DB retains only its default TinyURL.
Coordinator independently inspected both small form evidence images and accepted the seams.
Stopped only the owned 4302/4312 servers and removed the scratch settings directory.

Remaining: NC02 ownership/roles/access, NC03/04 operation/policy contracts, NC05 compatibility
and evidence report, NC06 new explicit narrow study, NC14 independent review. Generic tiles and
legacy names still supply no contracts. Owner/human overview readability and Mini/live strict
model acceptance remain open; backend location/conventions and real templates/runtime evidence
are still absent. NC02 can proceed within the recorded first-phase authorization.

Local commit: **NC01: persist profile scope with explicit v3 boundary**.

## 2026-11-07 — NC02: logical owners, canonical roles and declared store access

Worked NC02 only after NC01 `8ee2027`, sequentially on primary main. Coordinator accepted G2's
small collapsed/expanded sketch before presentation code and reviewed actual 1280 images plus
identity/validation/history seams. No branch, worktree, stash, push, delegation, preset rewrite,
owner-project migration, generator or runtime. Preserved `.jeeves-feedback/` and owner settings.
The owner explicitly clarified “Keep backend implementation for later”: NC03–NC06/NC14 Jeeves
work remains authorized, while the separate backend stays a concrete future plan.

Optional schema-v3 `ownership` records logical owners, canonical API/worker element roles,
optional deployable assignments, source/projection authority, role grants and actual store-edge
access intent. Absence stays unspecified on read. Same-owner read remains read; cache read/fill
needs read-write. Explicit incompatible grants and foreign writes refuse atomically; co-deploying
roles grants nothing. Foreign read requires deliberate published-read intent or an owned
projection; published contracts and projection population/freshness/failure remain targeted
unresolved requirements. Source-only projection refs rule out self/chains/cycles. No label,
module paragraph, package or legacy inferred writer becomes a declared permission.

The inspector's bounded form and narrow `configureOwnership` tool share preview/commands.
Preview shows named add/change/revoke/clear rows with optional raw details, before one save;
stale previews refuse. Canonical tile/edge removal and authority/role/owner transfer expose exact
affected bindings, clean or refuse them atomically, retain unrelated/missing-target requirements
and undo once. Chat's fresh staged review contains exact rows and saved details are attributed to
the committed chat snapshot. Optional/default/null and canonical strict history behavior remains.

One collapsed owner card expands by mouse to original role IDs; resources remain separate and
all relationship IDs/endpoint names survive. Exact edge selection expands endpoints; resource
focus maps emphasis to collapsed owners; attach onto a collapsed owner expands it with guidance.
Unsafe projections fall back to readable canonical roles without weakening semantic validation.
Owner selection travels as `owner:<slug>` (69 chars maximum) through actual chat context/history,
independent from role IDs, survives rename and refuses malformed/missing/removed references.
View changes preserve complete exported contracts/revision. Legacy unowned diagrams remain as
before, with a compact configuration entry and explicitly qualified inferred-access metadata.

Default v2 refuses every new nonempty row with its exact source path, even empty-scope ownership;
empty declarations add no meaning. V3 retains complete sorted declarations, targeted findings and
explicit legacy-owner/role meaning. Profile ownership completeness now uses exact declaration
findings; create/resolve/cache operations remain unspecified. Template/runtime evidence stays
none. Generic services remain design-only. Docs/allowlist/catalog/plan match this boundary.

Checks with Node 24.21.0 first in PATH: `pnpm check` passed **262 tests / 36 files**, Biome and all
workspace typechecks; `pnpm test:e2e` passed **25 native Chromium** (35.3s); web production build
passed (existing chunk advisory); `git diff --check` passed. Focused tests cover authority/grants,
same-owner read/cache fill, foreign write/read boundaries, missing declarations, projection refs,
transfer/deletion, atomic refusal, PGlite disk reload, conflicts, cross-version history/one Undo,
mouse/chat command equality, exact v2/v3 semantics, strict omissions/history and actual repair
loop plus owner selection. Tests prove declarations only, never runtime ACLs or concurrency.

Strict wire audit: `configureOwnership` **28 properties / 13 enum values / depth five**, 3,600
UTF-8 bytes including metadata. Giant tile union unchanged **427 / 538 / nine**. Retained NC01
same-default-schema2 audit → current: instructions 11,237→12,512 bytes, caller context
15,147→15,928, strict tools 57,895→61,496. Five scripted ownership responses exercise two repair
passes, refused third apply and allowed previews. No live/paid calls, token/cost/quality win or
Mini acceptance. Current offline synthetic cases replay deterministically. Old RF06 raw records
are unchanged; first old Codex request intentionally drifts `77669bb5…`→`43bf9c36…` before any
response because shared ownership/selection context changed (exact hashes in retained evidence).

Browser: `/tmp/jeeves-nc02-browser/` holds scripts/logs and both-size mouse images; six inspected
PNGs plus audit/results/drift are retained in `docs/plans/reliable-foundations/evidence/nc02/`.
Isolated API4312/web4302, scratch JEEVES_HOME, scripted provider and `jeeves_e2e`; owner4300/4310
listeners/designs/settings untouched. At 1440×900 and 1280×800 default TinyURL renders 11/12;
mouse declares core Links roles without changing IDs, collapses/expands, traces a collapsed
resource's exact read, previews/removes/undoes it, rejects cache read-only permission visibly,
transfers role/authority and removes owner with exact cleanup/Undo, refuses stale previews,
retains custom requirements after canonical role removal and restores role/cache removals in one
Undo, refuses removal of a projection's source, reloads exactly and preserves full exports for
view actions. Owner-card selection reaches the actual chat payload. Zero unexpected page/console
errors; two HTTP409 console messages are the deliberate stale-preview refusals, separately
recorded. Every owned scratch project was deleted; fitted full legacy overviews still need zoom.

New owner screenshots received during final review are archived byte-for-byte as
`docs/human-feedback/2026-11-07-api-action-sketch.png` and `2026-11-07-watch-counts-crop.png`.
Appended a new HUMAN_FEEDBACK entry and playbook lesson: expandable Read counts/Publish view
responsibilities of the same API, distinct from user lanes/services/deployments; sketch data-return
arrows differ from current caller→target requests and need an explicit view convention. This is
NC03+ design input for coordinator review, not an NC02 operation model or YouTube rewrite.

Next: NC03 exact create operation/caller/receiver bindings must refine these role grants, then
NC04 lookup/cache policies, NC05 report, NC06 new narrow study and NC14 review. Published-read
markers/projections still require contracts; owner human overview acceptance, intended Mini/live
strict evidence, real templates/runtime tests and backend dependencies remain open.

Local commit: **NC02: declare logical owners, roles and store access**.

Final cleanup: stopped only owned 4302/4312 servers and removed own empty scratch settings directories.
Read-only final owner GETs remain TinyURL rev53 / YouTube rev1 / Marketplace rev1; `jeeves_e2e`
contains only its default TinyURL. Owner4300/4310 listeners remain running. New feedback image
hashes are `b29baa7c…` (sketch) and `2cf541ca…` (crop); original files were not altered.

## 2026-11-07 — NC03: finite Create link contract and exact operation bindings

Worked NC03 only after NC02 `db9af1c`, sequentially on primary main. Coordinator reviewed G3,
revised binding identities/concurrency and the concrete small-view sketch before material work,
then inspected actual 1280 operation/detail/transfer/move images and semantic seams. No branch,
worktree, stash, delegation, push, backend, generator, preset rewrite or owner-project migration.
Preserved `.jeeves-feedback/`, archived owner screenshots and owner settings/designs. Owner's
“Keep backend implementation for later” remains the boundary; NC04 is the next assigned unit.

Added immutable local `links-create@1.0.0`, SHA256 over the full actual schema/behavior definition
(`bac402c1…`) plus individual request/success/error hashes. Bounded exact refs have no ranges,
latest substitution or leading-zero versions. Contract declares verified issuer+subject with
trusted authenticity/issuer/audience/time checks; normalized HTTP(S) URL, optional supported
future RFC3339 expiry; 16 random bytes /22 unpadded base64url chars; **five total allocation
attempts including the initial attempt**; atomic durable link+successful-key commit before 201.
Principal+operation+opaque case-sensitive key replays the original result for 24 hours from commit,
even after link expiry. Authentication/parsing/fingerprint lookup precedes new-request expiry
freshness; post-retention requests are revalidated and may allocate anew. Concurrent attempts
serialize until prior fingerprint/outcome is observable or return dependency failure/same-key
retry under **one total 10s deadline**. Unknown commit outcome never guesses success/new allocation;
proven rollback releases claim. No hidden pending/lease machine. Explicit 400/401/409/503 schemas
cover invalid/auth/conflict/allocation/dependency outcomes. No extra 365-day business expiry ceiling.

Optional v3 `operations` holds stable receiver/call binding IDs separate from graph IDs, exact
signatures and tagged create-link config. Entry caller retains canonical ID+lane+element; service
caller retains actual connection+role, receiver binding+canonical receiver role. Several different
operations can share an API/edge. Duplicate IDs/known routes/caller pairs and known schema/auth/
idempotency/deadline contradictions refuse atomically; unknown exact refs remain saveable and
unresolved, even reusing known payload schemas in other positions, without Create semantics.
Known create writes refine NC02 source authority + explicit write request/grant; reads stay reads,
foreign writes refuse and co-deployment grants nothing. Existing API/connection timeout, protocol,
interaction/channel and retry/principal propagation intents are checked or precisely unresolved.
Legacy TinyURL's 1s API setting is visibly refused until explicitly edited by mouse; never migrated.

Shared preview/commands back the bounded inspector form and narrow describe/configure tools.
Advanced verifier ID/version/hash can be inspected/edited/cleared and reloaded; missing or unknown
runtime verifier is targeted unavailable intent, separate from the known verification requirement.
In-card Create link label and expandable inspector responsibility remain the same API/owner with
original relationship IDs/arrows. Explicit `operation:<binding-id>` selection reaches actual chat
context/history, survives API rename, refuses malformed/removed bindings and selects no sibling
operations. Generic configuration selects none. Named ownership/role/authority/edge/removal and
entry-move previews expose exact operation clears, revision conflicts refuse and one Undo restores
the whole change. Unrelated custom scope survives. V3 exports every declaration/ref/finding sorted
by stable binding ID; default v2 refuses every nonempty receiver/call row with exact source paths,
even empty scope/ownership. Old schema2 fixture/v2 meaning remains exact; reads never upgrade.

Create presence clears only the old blanket create-unspecified finding when exact caller/receiver
signatures exist; verifier/access gaps and resolve/expiry/cache requirements remain. A required
one-public-namespace composition obligation is explicitly unresolved: **NC04/NC05 must ensure all
selected-profile create/resolve bindings share one authoritative source and compatible logical
owner**. Per-operation declarations do not prove this. Arbitrary independent-source designs are
not blanket structural errors. Availability belongs outside immutable contract identity; product
templates/runtime evidence remain none. Read counts/Publish view ports, returned-data arrows,
YouTube semantics, owner usability acceptance and the backend remain open. Docs/settings/catalog,
G3 plan, feedback Resolution and playbook describe these actual limits.

Checks with Node 24.21.0 first in PATH, heavy suites sequential: `pnpm check` passed **274 tests /
38 files**, Biome and all typechecks; `pnpm test:e2e` passed **27 native Chromium** (43.6s); web
production build passed (existing chunk-size advisory); final lint/diff checks passed. Focused
network-free spec/PGlite disk-reload, real ChatService and strict mocked transport cover immutable
hashes, unknown/refusal/category boundaries, exact mouse/chat command parity, staged review,
actual two-repair budget, permitted lookup/preview afterward, conflicts/atomicity, history/Undo,
selection/rename/removal, multiple operations, same-owner read/write and timeout/retry gaps. Two
mouse E2Es cover verifier roundtrip/clear and exact entry-move preview+Undo. These prove contract
validation/plumbing, never runtime URL/idempotency/concurrency/auth implementation.

Actual strict wire audit: `configureOperations` **67 properties / 16 enum / depth 7**,6,726 UTF-8 bytes;
`describeOperation` **4 / 0 / 3**, 754 bytes. Giant tile union stays **427 / 538 / 9**. An unnecessary one-branch
union was rejected by the existing audited codec and removed; stored tagged object remains, with
no adapter loosening. Same default schema2 TinyURL against retained NC02: instructions
12,512→13,886 bytes, context 15,928→16,293, strict tools 61,496→**69,051**. Five scripted real-chat
responses cover two repairs, third-apply refusal and readonly lookup/preview; no paid/live calls,
model quality/cost/latency win or Mini acceptance. Current fetch-forbidden RF06 synthetic suite
replays all 12 pairs deterministically. Old as-run records remain untouched: first old Codex request
intentionally drifts `77669bb5…`→`cf667290…` before any response, because shared operation/catalog/
selection context changed; exact hashes/reason retained. RF06's historical 2.44× input / 2.07× responses
and intended Mini/live strict acceptance gap remain disclosed.

Both-size mouse evidence: `/tmp/jeeves-nc03-browser/` holds walkthrough/scripts/check/E2E/build/
replay logs; seven inspected PNGs, results, browser metadata, audit and drift retained in
`docs/plans/reliable-foundations/evidence/nc03/`. Own 4302/4312 used scratch JEEVES_HOME, scripted
provider and jeeves_e2e; default TinyURL rendered11 tiles / 12 lines. Mouse timeout refusal/explicit
edit, pure upgrade/Undo back to schema2, create/edit/reload, exact refs/expanded contract,
operation-specific chat selection, full-export equality under focus/Fit/Show all/collapse,
retention/verifier edit/clear, owner transfer and store-edge/role removal previews/Undo, stale
refusal preserving custom scope and entry-move preview/Undo passed at 1440×900 and 1280×800.
Zero unexpected console/page errors; two deliberate HTTP409 stale refusals recorded separately.
Owned scratch projects deleted (204); e2e DB contains only its default TinyURL. Only owned 4302/4312
listeners and scratch settings directory were stopped/removed; owner 4300/4310 untouched.

Local commit: **NC03: bind the finite Create link contract**.

## 2026-11-07 — NC04: public Resolve and compatible positive-cache contracts

Worked NC04 only after `1823124`, sequentially on primary main. Coordinator reviewed the concrete
G5 record/binding/outcome/bounds proposal before material implementation, then inspected actual
1280 form/fields/ref, shared-role/unknown-sibling and transfer/removal images. No delegation,
branch, worktree, stash, push, backend, generator, live/paid model call, preset or owner-project
rewrite. Owner's “Keep backend implementation for later” remains the boundary; NC05 is next.
Preserved `.jeeves-feedback/`, owner settings/projects and all five archived owner images. The
append-only feedback Resolution confirms the owner's archive question and coordinator's matching
SHA256 verification; newest two images remain the original `db9af1c` artifacts.

Added immutable `links-resolve@1.0.0` (`d819c8a2…`) and `links-positive-cache@1.0.0` (`968a31ff…`)
with actual request/success/error/positive-record schema hashes and full-definition hashes. The
NC03 Create JSON is byte-for-byte unchanged (`bac402c1…`), including its broader frozen code
schema and all behavior. Shared pure record/ref/signature helpers avoid schema import cycles;
records and exported catalog indexes are frozen. Exact wrong categories refuse, including the
cache-record schema used as operation/policy. Unknown exact operation/schema/policy refs remain
retained/unresolved without gaining known behavior; unknown operations may reuse known schemas.

Resolve is public GET `/links/{code}`, one raw canonical 22-character unpadded base64url code for
16 bytes (last character A/Q/g/w). Reject nonempty query/body, percent aliases, extra segments,
padding or malformed code. The normalized operation envelope excludes ordinary HTTP headers.
307 supplies Location and zero response bytes; explicit JSON errors are 400 invalid input,
404 confirmed primary absence, 410 expired, 503 dependency failure and 503 overload. Every outcome
has no-store, including errors; closed response headers describe only contract-owned headers,
not the whole wire header set. Immutable destination/expiry and no code reuse; stable 410 needs
indefinite minimal durable code+expiry evidence after physical cleanup. A durable Create success
is visible to fresh primary Resolve immediately, yielding 410 if expiry has already passed.

Pinned positive policy: maximum 300s clamped at actual write to record expiry; validate cached
code, normalized immutable destination and expiry, and recheck wall-clock expiry on hit and
before response, including after fill. Cache read/fill cap at 50ms, primary at 1000ms, one total
1200ms monotonic deadline covering validation/phases/response decision without resetting. At most
64 actual primary resolve calls shared across bindings in one runtime instance, immediate 503
when full, no queue/retries. Hold admission until actual completion or confirmed cancellation;
a request timeout cannot release an unbounded trail of orphaned queries. Cache miss/outage/
timeout/malformed payload falls back once to primary within budget; primary failure is never
404. Optional skipped/failed fill preserves timely authoritative success; exhausted overall
deadline returns 503. No negative cache, L1, stale-on-error, single-flight wait or response cache.
Trusted cache isolation, clocks/skew, cancellation, absolute-expiry precision and actual primary
visibility remain future backend/adapter evidence, never simulated runtime verification.

The new tagged resolve binding stores primary/cache connections and nullable exact policy ref;
null stays unspecified. NC03 bindings need no migration. Source read and cache read-and-fill
stay within explicit grants/dependencies, same logical owner and exact source projection. Only
an exact compatible binding refines that cache's blanket population/freshness/failure warning;
other projections and published reads remain unresolved. Resource inspector now reflects this
qualified declaration. Selected one-public-namespace scope checks all known create/resolve source
and owner agreement; arbitrary independent-source designs remain legal. Namespace obligations
appear once; operation-neutral unresolved IDs replace misleading Create-only report IDs without
changing stored requirements/history. Unknown/incomplete contracts remain blockers.

Known receiver/caller deadline, protocol/security/channel, retries, cache TTL, Redirect lookup
shortcut, primary routing and attached CDN contradictions refuse atomically. Generic SQL/Redis
connection timeout/retry controls were not broadened; the policy carries those phase caps and
existing data-access statement timeouts may be shorter. Applicable typed modules are traced
through real component links via the bound source/cache dependency and upstream chain; unrelated
same-host modules and paragraphs gain no operation applicability. Legacy TinyURL's represented
replica/L1/L2/negative/single-flight/302/TTL intents are diagnosed, never rewritten.

The existing sticky Operation contracts form and chat describe/configure tools share all finite
fields, preview/commands, unknown ref roundtrip and review details. Multiple operations share an
API/edge; an optional unspecified global API timeout permits Create 10000ms and Resolve 1200ms
on the same canonical role. Explicit global timeout conflicts refuse. A compact plural count
retains known/unknown siblings; inspector details select each exact `operation:<binding-id>`
for actual chat/history. Canonical roles/edges/arrows stay unchanged. Role/authority/cache/source/
grant removal or transfer and entry moves preview exact affected clears, clean/refuse atomically,
retain unrelated custom requirements, refuse stale previews and restore in one Undo. V3 remains
complete/pure; default v2 refuses every receiver/call row at its exact path. Template/runtime
availability stays none. Read/publish ports, returned-data arrows, YouTube semantics and owner
usability acceptance remain open. README/PLAN/catalog/studio/settings/blueprint/contracts,
G5/NC04 plan, playbook and append-only feedback Resolution match this scope.

Final required checks with Node 24.21.0 first in PATH, suites sequential and source held steady:
`pnpm check` passed **284 tests / 40 files**, Biome and every typecheck; `pnpm test:e2e` passed
**28 native Chromium** (44.6s); web production build passed (existing chunk advisory); final
lint/diff checks passed. Focused tests cover immutable identities/categories, unknown refs,
settings/access/namespace contradictions, unrelated modules, shared API operations, source/cache
edge and authority cleanup, entry moves, atomic refusal, exact v2/v3 semantics, disk PGlite reload,
one Undo, mouse/chat parity, strict nullable union/history and actual ChatService repair bounds.
Both Create and Resolve scripted conversations exercise two repairs, refused third apply and
permitted readonly preview/lookup afterward. No unit test needs Docker, Postgres or network.

Actual final strict wire audit: configureOperations **74 properties / 17 enum values / depth 7**,
7557 UTF-8 bytes including metadata; describeOperation **4 / 0 / 3**, 745 bytes. Giant studio union
unchanged **427 / 538 / 9**. Same default schema2 TinyURL versus retained NC03: instructions
13886→**14941** bytes, context 16293→**16633**, strict tools 69051→**69873** (+822). Codec strictness,
omitted/null/default semantics and canonical history remain intact. These are bytes, not tokens,
cost or model-quality claims. Current fetch-forbidden synthetic suite replays all 12 case/arm
pairs deterministically (standalone eval file 14 tests). Old RF06 as-run records stay untouched;
first old request intentionally drifts `77669bb5…`→`b5a04c34…` before response replay because
shared context changed; exact hashes/reason retained. Historical RF06 overhead and intended
Mini/live acceptance remain open; no credits/access or paid run was invented.

Mouse at both 1440×900 and 1280×800: default TinyURL renders 11 tiles / 12 lines; explicit
settings edits permit Resolve, exact outcomes/refs inspect and unknown policy reload/clear work;
operation selection reaches actual chat, full export is equal after focus/Fit/Show all/collapse,
cache read-only fill refuses, source/owner transfers and role/cache/isolated-edge removals show
exact clears, entry move clears its one caller, stale preview preserves custom scope and one
Undo/reload restores complete state. Shared-role Create+Resolve shows two operations; retained
unknown sibling shows three, with independent selections. Zero unexpected browser errors; two
intentional stale HTTP409 messages are recorded separately. The first walkthrough's one-shot
owner visibility race and a scratch-script owner-ID assumption were fixed in acceptance helpers,
with failed attempts retained separately. First E2E overlapped source edits and had three setup/
detached timeouts (25/28); clean runs passed 28 without unrelated test changes. Its exact leaked
setup project was identified and deleted 204. These observations do not prove runtime behavior.

Fourteen inspected PNGs, browser/result/audit/drift metadata and failed-attempt evidence are in
`docs/plans/reliable-foundations/evidence/nc04/`; full scripts/logs stay in
`/tmp/jeeves-nc04-browser/`. Retained raw check/failure logs use lossless gzip with byte hashes;
original raw files remain there. Isolated API 4312 / web 4302 used scratch settings, scripted provider and
jeeves_e2e; every owned scratch project was deleted. Database contains only its default TinyURL.
Stopped only owned 4312/4302 processes and removed own scratch settings. Read-only owner GETs
remain TinyURL rev 53 / YouTube rev 1 / Marketplace rev 1; owner 4300/4310 listeners remain running.
Existing fitted-overview labels still need zoom; coordinator acceptance is not owner usability
or runtime acceptance.

Next: NC05 must separate design validity, exact contract completeness, template availability and
runtime evidence over this finite boundary. There are no product manifests/templates/runtime
artifacts to certify. Preserve NC03 Create identity, unknown refs, current declaration semantics
and old owner projects. NC06 owns the new narrow study; the separate backend remains a plan.

Local commit: **NC04: bind public Resolve and positive cache contracts**.

## 2026-11-07 — NC05: exact snapshot compatibility and evidence report

NC05 only after `7b789a7`, primary main, one writer. Coordinator reviewed the model before coding
and accepted final both-size report/target views. No branch/delegation/push/backend/generator/
live call or owner-project/preset migration; frozen NC03/04 JSON and `.jeeves-feedback/` preserved.

One read-only report serves inspector, blueprint v3 and `readReadiness {}`; chat context carries
compact statuses/counts/hash. Full validity, exact contracts, implementation availability and
exact-output evidence stay separate; first generation does not require future output evidence.
Whole-design coverage blocks generic/unknown/custom/extra behavior. Concrete verifier availability
is separate from known auth intent. Create retained-result reads now require explicit read-write
source intent/grant; old write-only declarations remain saveable targeted gaps. V2/read purity
remain exact. Fixed profile digest `40130ff2…441985`; trusted positive fixtures test trust plumbing
only. Product has no registry/manifests/output/evidence. [Report/hash/trust details](studio-readiness.md);
README/PLAN/catalog/studio docs, G6/NC05, playbook and append-only feedback are current.

Frozen Node 24.21.0 checks: **344 tests / 42 files**, lint/all typechecks; **29 native E2Es**
(47.7s); web build (existing chunk advisory), final lint/diff pass. First PGlite integration timeout
7.38s was aligned from default 5s to existing 15s; full sequence reran. Actual ChatService preserves
two-repair/fresh-review gates and report parity; strict codec unchanged. New tool 0/0/depth 1,
462 bytes; giant union 427/538/depth 9 unchanged. Actual byte deltas/audit, twelve offline replay
pairs, old RF06 drift and open Mini/live acceptance are in [evidence](plans/reliable-foundations/evidence/nc05/README.md).

Mouse 1440×900 / 1280×800: default 11 tiles / 12 lines; narrow valid/complete/unavailable/none;
operation/role/edge/owner targets reach actual chat/history. Required custom/unknown profile/extra
owner stay blocked; Undo/reload restore; report/focus/Fit/selection preserve full export. Zero
browser errors. Fourteen PNGs, exact audits/results and retained failed helper/history-race logs
are linked above. All own scratch projects deleted 204; e2e DB retains only default TinyURL. Only
own 4312/4302 listeners/settings removed; owner 4300/4310 remain and revisions stay 53/1/1.

Next NC06 adds the narrow study. Legacy topology warnings can contradict explicit authority/grants;
prefer explicit-access warnings with legacy fallback, not copying fixture legacy writers to hide
warnings. Read/publish ports, returned-data arrows, YouTube semantics, overview readability and
owner usability remain open. Real runtime/adapters/clocks/concurrency proof stays in the separate
backend later; NC14 independently reviews the small subset.

Local commit: **NC05: report exact snapshot compatibility and evidence gaps**.

## 2026-11-07 — NC06: separate narrow TinyURL foundation and complete creation

NC06 only after `4ada4c2`, primary main, one writer. New distinct
`studio-tinyurl-foundation@1.0.0` is chooser/fresh-install default: Create/Follow, one collapsed
Links owner/two API roles/shared deployable intent, PostgreSQL source and exact owned positive
cache projection. Create source read-write, Resolve source read/cache read-write; verifier null.
Report valid/complete/unavailable/none, generation no. Frozen records/profile and old extended
study source/goal/schema2 semantics unchanged; saved owner projects/selections preserved.

Shared complete version-aware seed fixes chooser/eval scope/ownership/operation loss, including
scope-only v3. One atomic edit, disk reload, exact v2 loss refusal/v3 export, failed-seed isolation,
one Undo/Redo checked. Declared writer facts now drive warnings where present, with legacy
fallback; missing/invalid write permission still warns, no fake legacy owners. Actual blank mouse
build rev31 and six-response scripted ChatService build rev1 match full canonical semantic
blueprint/contracts/report after revision only. Inputs are deliberately chosen from the mouse
snapshot: plumbing proof, not independent model quality/runtime proof. Full current docs,
[review ledger](plans/reliable-foundations/nc06-review.md), append-only feedback/playbook updated.

Frozen Node24.21.0 required checks: **370 tests / 46 files**, lint/all typechecks; **31 native
E2Es** (47.9s); web build (existing chunk advisory); final lint/diff pass. Heavy suites sequential,
source steady during E2E. Both-size actual mouse:6collapsed/7expanded tiles,7lines; exact both
operation/role/owner chat/history, source/cache authority, pure fit/focus/collapse, required
excluded/custom blockers and mouse Undo/reload. Fresh-install empty-list simulation uses actual
application writes; no API seeding is labeled mouse construction. Zero final browser errors.
Twenty-three inspected PNGs, raw scripts/logs/failures/hashes and byte audit are in
[evidence](plans/reliable-foundations/evidence/nc06/README.md). Strict tools unchanged; instructions
−7UTF-8bytes, retained schema2 context unchanged; no token/cost/quality claim or paid/live call.

All own projects deleted204; e2e DB only its original default. Only own4312/4302 listeners/settings
removed; owner4300/4310 remain, saved revisions53/1/1 unchanged. `.jeeves-feedback/` preserved.
Next **NC14** independently reviews this subset. Coordinator accepts the small views, not owner
usability. Carry forward inspector legacy no-owner/readers/inference under explicit authority and
“Microservice” under API role for labeled-disclosure review. Read/publish ports, return arrows,
YouTube/Marketplace gaps, extended overview/readability, Mini/live evidence and backend proof
remain open. NC07–NC13 stay deferred; backend remains later.

Local commit: **NC06: add the narrow TinyURL foundation study**.

## 2026-11-07 — NC14: independent small-contract review and deferred backend plan

NC14 only after NC06 `888c1bc`, primary main, one writer/no delegation. Independently inspected
NC01–NC06 diffs/source and storage/export/validation/cleanup/chat/wire/study seams. Four confirmed
repairs: explicit inspector authority/access stays primary over a collapsed preserved legacy
inference+writer editor; declared API/worker role meaning is qualified; Create validates its
actual synchronous SQL/native internal source dependency; v3 ownership exports detach row
objects; trusted suite format v2 pins hash-resolved execution-bundle content rather than only case
IDs (the two inspector items are one presentation correction). Meaningful unit and mouse E2E
regressions cover these. Frozen operation/cache/profile JSON, old schema2 fixture/TinyURL source,
RF06 as-run records and five original feedback images remain intact. Profile digest unchanged
`40130ff2…441985`. No backend/generator/runtime/registry/runner/paid call or saved-project migration.

[Review ledger](plans/reliable-foundations/nc14-review.md) states what is declared and what remains
unknown. [Future backend plan only](plans/reliable-foundations/backend-first-proof-plan.md) scopes
HTTP/auth/PostgreSQL/Redis first, reviewed pinned templates/manifests, deterministic assembly,
exact output/independent evidence protocol, executable suite closure and real adapter/fault cases.
It includes generated/custom file ownership, edited-generated refusal, custom preservation and
regenerate/reverify acceptance; unreviewed custom runtime behavior blocks. Repository/conventions,
auth/runtime/adapter versions are future kickoff dependencies. NC07–NC13 stay deferred. Current
studio/catalog/contracts/settings/blueprint/readiness docs, playbook and append-only feedback match.

Frozen Node 24.21.0 required checks passed sequentially: **380 tests / 46 files**, lint/all typechecks;
**32 native Chromium E2Es (50.3s)**; web production build 843ms (existing chunk advisory). No source
edits during E2E. Both 1440×900 / 1280×800 mouse: foundation 6/7 tiles, 7 lines, source/cache/connection
selection and fit/focus pure; legacy disclosure edit preserves explicit declarations, one Undo
and reload restore; role explanation readable after mouse collapsing details. Extended schema2
11 tiles / 12 lines retains original Owner/access/kind/v2 export. Zero final browser errors; 33 inspected
PNGs, exact audits, initial test-authoring failures and all cleanup statuses are retained in
[evidence](plans/reliable-foundations/evidence/nc14/README.md). Coordinator acceptance is bounded,
not owner usability or runtime acceptance.

Strict tools/instructions/legacy context remain 70,336 / 15,427 / 17,016 UTF-8 bytes; foundation 17,019
separately. Giant union 427 properties / 538 enum values / depth 9; no codec/history semantics or tool budget
change. Full unit suite covers twelve fetch-forbidden synthetic pairs; old RF06 request drift
remains 77669bb5… → 80781cbc… before response replay, with exact reason/hash retained. Intended
Mini/live strict acceptance and model quality are open; historical fallback 2.44× input / 2.07× responses
is no general quality win. Bytes are not token/cost evidence.

All own projects deleted 204; e2e DB equals its original default-only listing. Only own 4312/4302
listeners stopped; isolated settings path was never created; owner 4300/4310 and saved 53/1/1
revisions unchanged. `.jeeves-feedback/` preserved. Separate Read counts/Publish view ports,
returned-data arrows, YouTube/Marketplace semantic gaps, extended overview/readability, intended
model evidence and backend proof remain open. Next is future backend kickoff under its own repo
rules and accepted scope, not another automatic domain expansion.

Local commit: **NC14: review the TinyURL contract boundary and defer backend proof**.

## 2026-11-07 — YouTube field-project plan and benchmark boundaries

Planning-only unit on main after `450ed3e`; no delegation, runtime changes, generator or field
application. The owner's new direction supersedes separate-repo/TinyURL-first/certification-first
sequencing: current YouTube diagram → actual generated baseline commit → custom completion plan
and implementation → working v1 → owner/fresh-agent review → improved Jeeves and fresh v2.

Added [the active plan](plans/reliable-foundations/youtube-field-project-plan.md), updated current
README/PLAN/agent guidance and superseding notices, and appended feedback/playbook decisions.
Defined partial experimental export without weakening strict readiness, generated/custom/repair/
reuse provenance, stable-feature effort comparisons, reuse hypotheses and later curated chat
guidance/evaluations. Heavy generated-template certification is deferred; lightweight build/
determinism/working-flow checks remain. No benchmark measurements are claimed.

Required existing Jeeves checks passed on Node 24.21.0: `pnpm check` (380 tests / 46 files,
lint/typechecks), 32 native E2Es (59.8s), web build (881ms; existing chunk advisory).
Running owner app checked by mouse at 1280×800: existing TinyURL rev53 renders 12 tiles; Fit
and legend work; zero page/console errors, saved design and project listing unchanged.
Logs, browser result and inspected screenshot: /tmp/jeeves-youtube-field-plan/. No owned server
or project was created for that browser check. Existing E2Es clean their own projects.

Next: FP01 records the saved YouTube baseline and explicit local bindings. Minimal UI versus
API-only and PostgreSQL versus drawn MySQL remain unanswered; preserve the drawing's database
unless changed deliberately. Do not front-load all video abstractions or auto-start v2 before
the owner's requested review. Keep .jeeves-feedback/ untouched.

Local commit: **Plan iterative YouTube field projects and generation benchmarks**.

## 2026-11-07 — Diagram snapshot plan and settled YouTube v1 choices

Planning unit on main after `f04f88b`; no runtime, diagram or generator changes. The owner asks
for diagram images inside every field version, new images when its diagram changes, and the
same-repository backend under `jeeves-generator/`. Follow-up answers settle a minimal functional
browser UI and PostgreSQL; changing the saved YouTube's drawn MySQL before v1 is authorized.

Updated the [active plan](plans/reliable-foundations/youtube-field-project-plan.md), current
repository pointers and the stale blueprint introduction. Appended feedback/playbook decisions.
FP00 now adds mouse PNG export of the real full canvas; FP01 archives original source/image,
updates PostgreSQL, archives again and makes a named v1 copy. Numbered snapshots retain hashes,
source revision, renderer identity, resolved layout/view context and reasons; UI changes also
retain studio screenshots. No existing diagram-image export was found; resvg is currently used
only for chat attachments. Heavy template certification stays deferred.

Required checks passed on Node 24.21.0: `pnpm check` (380 tests / 46 files, lint/typechecks),
32 native E2Es (1.0m), and web production build (existing chunk advisory). Running owner app
checked by mouse at 1280×800: TinyURL rev53 renders 12 tiles, Fit and line guide work, no browser
errors; complete design/history response and project listing unchanged. Logs, inspected PNG and
browser result are in /tmp/jeeves-diagram-snapshot-plan/. No owned server or project was created.

Next: dispatch only FP00 to a fresh Sol/xhigh agent, then coordinate subsequent units sequentially.
There are no unanswered product choices. Agents may choose bounded local implementation details;
ask only if new evidence changes the agreed scope. Preserve the original before the authorized
database update. Keep `.jeeves-feedback/` untouched; do not push. Record actual implementation
and export limits rather than presenting this plan as completed functionality.

Local commit: **Plan diagram snapshots and settle YouTube v1 choices**.

## 2026-11-07 — FP00: real full-diagram PNG export

FP00 only after `4669546`, primary main, one writer/no delegation. Added mouse **Export diagram →
PNG** and exact-image capture-details JSON. Board snapshot/view reuses the existing tile and SVG
line renderers with detached settled layout; no ELK rerun or interactive camera mutation. Export
retains current owner expansion, draws every projected relationship despite focus, removes
selection/editing controls and uses embedded Nunito/light paper at 2× scale. Saved source is
checked before/after; pending layout waits, stale source/font/render/timeout/oversize failures
refuse clearly. Closing/switching disposes capture. No settings/schema/readiness, generator,
field folders or owner YouTube database changes. Studio guide/active plan and append-only
feedback/playbook now describe FP00 implementation and FP01's remaining archive work.

Required Node 24.21.0 checks passed sequentially: `pnpm check` **385 tests / 47 files**, lint/all
typechecks; **34 native E2Es (1.1m)**; web build **906ms** (existing chunk advisory). First full
check hit existing server hook/restart timeouts; unchanged rerun passed. Missing-Git production
build also passed with explicit null renderer identity. Five bounded unit additions and two
export E2Es cover bounds/routes, settled snapshot, PNG ink/hash/dimensions, owner projection,
source mismatch, font failure and cancelled stalled capture/project switch. Source steady
during full E2E; final lint/diff pass. Failed raster/theme and test-script attempts with their
corrections are retained in [evidence](plans/reliable-foundations/evidence/fp00/README.md).

Actual 1280×800 owner mouse: YouTube r1 **21 tiles/25 lines, 3008×2752 PNG**; TinyURL r53
**12/13, 2752×1472**. Both downloaded PNGs inspected with labels/icons/routes/arrowheads/full
bounds; hashes identical after mouse focus/Fit-focus/pan/zoom/dark mode. Every export preserves
exact camera/selection/focus/layout; full saved design/history/blueprint responses and owner
listing remain unchanged (53/1/1), zero final browser errors. Temporary chooser-created
foundation exports **6 collapsed/7 expanded tiles, 7 lines**, explicit metadata; deleted 204.
E2E DB returns to its original default-only listing. No own listeners/settings or paid/live chat;
owner 4300/4310 remain. `.jeeves-feedback/` preserved.

FP01 next: archive original source/blueprint/PNG before the approved PostgreSQL edit, capture
again, then make the named v1 copy. Use `*-capture.json` for resolved layout/view and sorted-JSON
source/image SHA256; retain an external renderer Git/tree audit. Dev identity is sampled at
startup and cannot attest later HMR changes; current evidence explicitly records dirty parent
4669546 plus file hashes. Missing Git yields null, never a false clean identity. PNG is checked
in Chromium, bounded at 40MP/16,384px; existing two-line labels stay as drawn, current owner
projection is deliberate. Vector export, automatic archive, generator and field-app work remain
open. These are export checks, not acceptance of underlying YouTube architecture/runtime.

Local commit: **FP00: export the full diagram as PNG**.

## 2026-11-07 — FP01: frozen YouTube v1 source and local mappings

FP01 only after `a98bf70`, primary main, one writer/no delegation. Archived actual owner YouTube
r1 before mutation, then one revision-checked atomic `setStudio` operation 6466 changed only
`metadata-db`/`view-counts` MySQL→PostgreSQL (owner r2); source schema2/origin and every other
field remain. Retained named **YouTube · field v1 · local Docker** project
`293b4a2d-e25b-4a5b-83da-b27de7876f02`, copied with full `studioStudySeedOperations`, then two
local batches through r3: explicit single-node/self-hosted/primary-read settings, followed by
two stale replica descriptions and the Local video edge name/prose correction. No topology
rewrite, shipped-study/default change, new contract/schema, generator, template or app code.

[V1 archive](../field-projects/youtube/v1/README.md) has five immutable real mouse PNG/source/
blueprint/capture snapshots, 1280×800 studio/engine screenshots and a clean `a98bf70` renderer
file audit. 001–004 clean PNGs are byte-identical because the changed settings are not tile
faces; 005 changes the local-edge label. Final canonical source `7d1874a1…7979cc93`, image
`23c06f6d…dc5bdb9`; 18 canonical elements/18 connections, 20 components/30 component links,
21 rendered tiles/25 lines. Inputs point to 005, blueprint3 over unchanged schema2. Narrow
Biome exclusions preserve exact immutable v1 JSON bytes; future app code is not excluded.

Finite proposed 18/20/18 ID/definition/settings mappings, exact local image/npm/native pins and
primary availability/digest evidence are frozen. Twenty-five exact TypeScript identity /
HTTPS / service-identity source paths have explicit unsupported local overrides; no vendor,
TLS or production-security equivalence is claimed. Original scale/cloud intent stays archived.
S01–S08 freeze independent setup/sign-in, real signed multipart+resume/abort, real HLS encoding/
playback, public-only search, two-second playback-event counts and clear failures. Fixture recipe,
G01–G08 actual gaps, decisions, reuse hypotheses and provenance/effort fields remain explicit;
all field smoke/coverage/effort-saving results remain unmeasured. FFmpeg transitive OS package
closure is a named FP03 build detail. Strict readiness remains false/none; no certification.

Required Node24.21.0 checks passed sequentially: `pnpm check` **385 tests / 47 files**, lint/all
typechecks; **34 native E2Es (1.1m)** with source steady; web build **1.02s** (existing advisory).
Final 1280×800 mouse checks TinyURL12/13, project-menu v1 selection, both PostgreSQL inspectors,
self-hosted originals, external edge/disabled resizing and export dialog; zero errors and exact
view-independent source/history/listing preservation. Full hash/mapping/renderer audit passed.
[Evidence](../field-projects/youtube/v1/notes/evidence/README.md) retains logs/scripts/results.
TinyURL53/Marketplace1 complete responses unchanged; E2E DB returns to its original default-only
listing. Only own web4302 stopped; owner4300/4310 remain. No scratch/settings/live-paid calls;
`.jeeves-feedback/` and all five original owner images preserved. Feedback/playbook appended.

Next **FP02 only**, after coordinator review: record this containing commit in a later work-log
entry, preserve frozen inputs and implement the finite experimental generator without weakening
strict readiness. FP03 adds actual templates/export, FP04 commits **real untouched output** before
FP05 plans custom completion. Keep lifecycle ownership, independent completion/search ordering,
idempotence and browser-interface gaps visible; original-storage reader already exists. Review
working v1 with owner before deciding on v2; NC07–NC13/heavy certification stay deferred.

Local commit: **FP01: freeze YouTube v1 source and local mappings**.

## 2026-11-07 — FP02: finite experimental generator foundation

FP02 only after FP01 **`acbc716c90245aeb398391f30f7800f988294cb4`**, now recorded in a new
[field work-log entry](../field-projects/youtube/v1/notes/work-log.md). Primary main, one writer,
no subdelegation. Frozen inputs/images/history untouched. Added explicit
[`@jeeves/generator`](../jeeves-generator/README.md) workspace **0.1.0-experimental.1**, no new
resolved dependency versions. Single reviewed frozen local-v1 profile checks strict schema and
structural validity, source/blueprint projection/hash, exact ID/definition/settings/owner/host/link
mappings, pins and optional real source-linked image. No name/prose behavior inference.

Deterministic in-memory bundles include frozen inputs, per-file hash/ownership/source/template
provenance and separate partial setting/gap/unsupported reports. Every declared setting/local
policy gets a path/status; 25 frozen overrides, seven extensions and G01–G08 stay visible.
Strict readiness/spec/API/UI untouched. Trusted local template hooks support one shared project
owner plus finite selector families; **default registry empty, no application templates/app output**.
Portable paths and collisions refuse; pure write preflight creates or retains exact bytes and
refuses differing destinations. No physical writer/archive/browser generation or merge engine.

Required Node24.21.0 checks passed sequentially: `pnpm check` **393 tests / 48 files** (eight new
network-free generator boundary tests), **34 native E2Es (1.1m)** with source steady, web build
**959ms** (existing advisory). Frozen-lockfile install passes; lockfile adds only the new importer.
[Evidence](../field-projects/youtube/v1/notes/evidence/fp02/README.md) includes logs, failed focused
fixture/type corrections and inspected 1280×800 mouse screenshot. Owner4300 TinyURL12/13,
Fit/legend, zero errors; all four design/history responses and listing unchanged. E2E DB equals
its original default-only state. No own servers/projects/field containers/secrets/live chat;
owner4300/4310, other Compose projects and `.jeeves-feedback/` preserved.

Next FP03 adds actual reusable templates/registry and mouse archive export, includes exact image
bytes and independently builds output. Root hooks do not implicitly register proposed family
availability. Physical writers need exclusive creation/symlink refusal; no runtime credit from
configuration, emitted-byte decisions or the diagnostic JSON test renderer. FFmpeg apt closure
remains open. FP04 then commits untouched output before FP05 custom planning; S01–S08 all unrun,
no coverage/effort saving claim, no automatic v2. No schema constraint changed the agreed scope.

Local commit: **FP02: add the finite experimental generator foundation**.

## 2026-11-07 — FP03a: real local templates and independent output build

FP03a only after **`e68627afa718e9c6e9aad63d44f6fcb73e338e5d`**, primary main/sole writer,
no subdelegation/branch/worktree/stash/push. Generator **0.1.0-experimental.2** adds trusted frozen
input/PNG loader, explicit **19-family** real local registry and exclusive new-directory CLI.
Templates **0.1.0-experimental.1** hash actual source/assets/standalone locks. Shared project owns
build/Compose/setup; families own selected shells/clients/resources/seven failing generated
extensions. [API](../jeeves-generator/README.md), [evidence](../field-projects/youtube/v1/notes/evidence/fp03a/README.md).
Frozen inputs/images/history/spec/readiness unchanged; no field `app/`, UI/API export or custom
algorithms. Report242 paths:20 emitted/169 configuration-only/28 custom/25 unsupported/0 untreated.

Actual scratch output **108 files**, repeated bytes equal; independent frozen install/TS/Docker
build/config pass. Exact FFmpeg deb +288 OS package versions close deferred apt snapshot detail
at 20261024T000000Z; pins unchanged, no bit-identical image claim. All 14 containers healthy;
bounded real browser S3/CORS and OIDC PKCE/JWT, PG reader grants, cache, broker terminal failure,
empty search index and edge/range probes pass. Business HTTP501/workers fail explicitly; no
S01–S08 credit or G01–G08 completion. No upload/transcoder metadata grants or publication-order fix.
Exact-v1 `app` now outside root Biome/workspaces; later app handoffs require its own frozen install/
TS build and field checks. This later choice is appended to the ledger, preserving FP01 history.

Final required checks sequential: **pnpm check395 tests/49 files**, **34 E2Es1.2m** source steady,
web build **891ms** (existing advisory). Two earlier existing5s PGlite timeout runs and isolated
pass retained, no timeout/test change. Final owner 4300 TinyURL mouse12/13, Fit/legend/zero errors;
all 4 saved designs/history/listing unchanged, E2E DB restored. All owned containers/6 volumes/network/
3 named images/runtime secrets removed; other4Compose projects, owner 4300/4310 and `.jeeves-feedback/`
preserved. No secret/token/capability in retained evidence; no paid/live calls.

Next **FP03b** uses `loadYoutubeLocalInput()`, `localV1Templates`, `assembleExperimental` for
mouse archive/download; package generator source/assets and exact inputs/005PNG in Jeeves Docker
and exclude future runtime secrets from outer build context. **FP04** commits actual untouched
output before **FP05** plans custom work. Full provenance/investment/failed attempts in appended
[field work log](../field-projects/youtube/v1/notes/work-log.md); no savings claim or automatic v2.

Local commit: **FP03a: add real local templates and independent build**.

## 2026-11-07 — FP03b: guarded Jeeves preview and deterministic project ZIP

FP03b only after **`5c79e4efe932b6ae138d966e2373f89216d8dd0c`**, primary main/sole writer,
no delegation/branch/worktree/stash/push. Added read-only-to-project POST experimental preview/
download and mouse **Generate project → Preview scaffold → Download project ZIP**. Only exact
saved snapshot005 source/revision 3 matching the trusted local-v1 profile exports; other studies,
changed/stale sources and unknown profiles refuse clearly. Exact copies show selected-project
versus frozen-origin provenance. Server rechecks source and preview archive identity; browser
checks drafts/history/current project, cancellation, saved source and actual ZIP hash. No arbitrary
paths/assets/code or server output writes. Partial foundations, G01–G08/seven extensions, 25
unsupported paths and local substitutions remain explicit. Strict calculators/blueprints/raw
report, generationEligible and profile/input/template bytes unchanged. Generator stays
0.1.0-experimental.2; no field app/custom code or functional-coverage claim.

Bounded stable stored ZIP **108 files, 946,247 bytes**. Python `zipfile` independently verifies
every actual assembler payload/hash/CRC, dotfiles and exact PNG for actual mouse and packaged API
downloads. ZIP SHA **`c885dd34e323c1102447587db25d68d273c5897826c240db31a9c222b8269c86`**;
manifest unchanged **`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`**.
All files total 931,999 bytes including 80,362-byte final manifest; 107 hashed payloads remain 851,637.
[API/docs](../jeeves-generator/README.md), [evidence](../field-projects/youtube/v1/notes/evidence/fp03b/README.md).
Production image builds and actual isolated API preview/download pass. Final image uid 1000 loads
all real assets and matches hashes. Docker COPY ownership fixes private template-asset mode;
outer hierarchical context rules admit exactly five input JSONs + 005 PNG, excluding future apps/
history/runtime secrets. Workspace resolution and existing independent-app boundaries preserved.

Required final checks sequential: **pnpm check 398 tests / 50 files**, all lint/typechecks;
**36 native E2Es 1.2m** with source steady; web build **922ms** (existing advisory). Retained first
existing 5s PGlite restart timeout, isolated 12-test pass and later full passes; no timeout weakened.
First E2E 35/36 caught invalid fields excluded by the inherited toolbar flag: generation alone now
uses every dirty/pending draft, preserving existing history/diagram-export semantics. Final mouse
cases cover actual preview/download,503/retry, unsupported/stale source, cancellation/switch and
invalid drafts. No tests removed. Reverted unrelated lock pruning; only workspace importer added.

Real immutable [006 UI](../field-projects/youtube/v1/diagrams/006-generation-ui/snapshot.json) and
[007 guard](../field-projects/youtube/v1/diagrams/007-generation-draft-guard/snapshot.json) retain
source/blueprint/native PNG, 1280×800 studio/dialog/invalid-name screenshots and fresh dirty-parent
renderer audits; 007 final audit checks 293 recorded files; only the later generator README wording differs. Both PNGs byte-identical to 005
(`23c06f6d…dc5bdb9`, 3008×2752, 21/25);005 remains authoritative. No source/topology/profile change
or historical rewrite. Complete four owner project/design/history/layout/blueprint/listing
responses unchanged; TinyURL 53 mouse 12/13, Fit/refusal work. No page errors; expected unsupported
HTTP 422 console entry recorded. E2E DB restored. Own 4302/4312, container/anonymous volume/named
images removed; owner 4300/4310, other Compose projects and `.jeeves-feedback/` preserved. No new
owner images, runtime secrets, paid/live/cloud/model calls or global prune.

Next **FP04** commits real untouched output before **FP05** custom planning. Record this containing
commit in the next work-log entry; retain exact profile/source 7d1874a1…7979cc93 and manifest above.
All G01–G08/S01–S08 remain open/unrun; no template certification or working YouTube app claim.

Local commit: **FP03b: add guarded experimental project download**.


FP03b operational follow-up before commit: the coordinator found owner API 4310 unavailable while
its original tsx watcher remained. Initial app.ts HMR preceded workspace-link installation and
failed ERR_MODULE_NOT_FOUND. A byte-preserving touch of watched main.ts restarted that existing
watcher's child; no watcher was killed/replaced. Owner 4310/4300 health and actual proxy preview/
download are restored and full four-project state equality is rechecked. Capture 4302/4312 remain
stopped. Docs distinguish eager template-file startup failures from in-request input/PNG/assembly 503.

## 2026-11-07 — FP04: actual untouched YouTube v1 baseline

FP04 only after **`aedbd606342c5a369142b10cf127fc7130d50671`** (FP03b/006/007), primary main/sole
writer, no delegation/branch/worktree/stash/push. Actual owner4300 mouse **Generate project →
Preview scaffold → Download project ZIP**, retained local-v1 saved revision3. Repeated actual
ZIPs and current assembler bytes match. Independently check108 safe regular paths/all CRCs/exact
bytes, manifest/inputs/005PNG, then exclusively extract NEW [app](../field-projects/youtube/v1/app/)
and fresh independent `/tmp` copy; dirs0755/files0644. No generated edit/format/repair or lock regen.

ZIP946,247 bytes SHA`c885dd34e323c1102447587db25d68d273c5897826c240db31a9c222b8269c86`;
108files/931,999 payload bytes; manifest80,362 bytes SHA`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
107 manifest payloads851,637 bytes. Generator.2 /19 families.1 /profile1.0.0 unchanged; source
7d1874a1…7979cc93 and005PNG23c06f6d…dc5bdb9 unchanged. [Provenance/scenario baseline](../field-projects/youtube/v1/notes/baseline.md),
[evidence](../field-projects/youtube/v1/notes/evidence/fp04/README.md). No architecture/view change,
new snapshot, custom code/FP05 plan or repeated provider campaign. Seven compiled extensions
reject501; all G01–G08/S01–S08 remain open/unrun, strict false/none/none, no feature/savings claim.

Own frozen installs + TS7 builds pass in BOTH repo app and independent extraction (109 packages
each); all108 generated bytes/locks and root lock unchanged, no Jeeves/workspace/parent compiler.
Required sequential checks pass first try: **pnpm check398 tests/50 files**, lint/typechecks;
**36 native E2Es1.2m**, source steady/scripted model; **web build990ms**, existing chunk advisory.
Final actual mouse preview/two equal downloads; TinyURL53 Fit12/13 and YouTube21/25, zero errors.
All4 complete owner project/design/history/layout/blueprint responses/listing unchanged across
unit; E2E DB restored to original default-only. Owner4300/4310 existing watchers healthy, no new
servers/field containers/secrets; other Compose projects/`.jeeves-feedback/` preserved. No
ZIP/dependencies/dist/media/runtime data staged, paid/live/cloud calls or global prune.

Next **FP05** records this unit's containing commit and writes custom plan against the untouched
baseline/G01–G08; keep `.jeeves`/historical artifacts immutable and classify later generated-file
repairs/custom/reused work. No automatic v2 before working-v1 owner review.

Local commit: **FP04: commit untouched generated YouTube v1 baseline**.

## 2026-11-07 — FP05: concrete custom YouTube v1 completion plan

FP05 only on main/primary checkout after actual baseline **`02ac280da62616e9c7aad7f88457dcb72084cb25`**;
preceding export/UI **`aedbd606342c5a369142b10cf127fc7130d50671`** recorded in appended provenance.
No delegation/branch/worktree/stash/push. [Implementation plan](../field-projects/youtube/v1/notes/implementation-plan.md)
names actual generated hooks/files, routes/messages/state/data/storage/publication, precise
role/credential boundaries, source corrections and sequential acceptance. Video owns Upload +
lifecycle with explicit grants; Transcoder no-SQL, Watch ready-view-only, private uploads/inbox/
outbox and separate count receipts. Processing events feed lifecycle; committed ready/publication
outbox feeds new Publication events/indexer. Stable IDs/finite failures, actual multipart/media/
played counts, plain pinned-TS browser and safe first-run/restart are specified. No generic DSL,
new contract framework, renderer redesign or certification prerequisite. Root reviewed decisions.

Next **FP06a** applies/snapshots schema3 authority + event/outbox/batch/prose corrections and
implements SQL/migrations/contracts/helpers; unique synthetic probes must be rolled back/cleaned.
Then FP06b creator/multipart/uploader, FP06c actual FFmpeg/lifecycle/Watch/HLS, FP07a search/counts,
FP07b independent S01–S08/provenance/review pack. No product choices remain or repeated milestone
approval; owner/fresh-agent review precedes v2. Custom source naturally leaves frozen-profile
eligibility; normal app commands continue, original005 CLI generation stays reproducible.

Planning only: all108 app bytes/manifest/locks, `.jeeves`, inputs, diagrams and generator unchanged;
manifest SHA50987079…764e21f. G01–G08 open/S01–S08 incomplete, no feature/savings/template credit.
[Evidence](../field-projects/youtube/v1/notes/evidence/fp05/README.md): **pnpm check398/50**,
**36 native E2Es1.3m**, **web build1.06s**, unchanged app own frozen install/TS7 build, all first
try. Actual mouse local-v1 Fit21/25 and TinyURL53 Fit12/13, zero errors; four complete owner
responses/listing preserved, E2E DB matches prior default-only state. No new source snapshot or
field stack/provider campaign. Owner4300/4310 watchers/other Compose projects/`.jeeves-feedback/`
preserved. No paid/live/cloud calls or secrets/media/dependencies/build/runtime data staged.

Local commit: **FP05: plan custom YouTube v1 completion from generated baseline**.

## 2026-11-07 — FP06a: custom YouTube authority and durable state foundation

Only FP06a after **`aed1d1d29c2e41f3173d3d11fd771e8519e0a838`**, main/primary sole writer, no
branch/worktree/stash/delegation/push. Retained v1 copy now schema3/r6 through ordinary operations
6470–6472 and actual native [008–010](../field-projects/youtube/v1/diagrams/index.md): shared Video
Upload/lifecycle authority, explicit grants/upload-state, Processing→lifecycle and committed
Publication→indexer, enabled SQL outboxes, batch1/immediate count/fixed-CPU prose.008 retains two
missing direct module→DB findings;009 fixes them;010 shortens a clipped Upload title. Expanded-role
owner-cycle fallback/small overview and eight unresolved executable-contract findings stay honest.
Original YouTube2/TinyURL53/Marketplace1 and histories preserved. Frozen005/001–007/inputs/generator/
templates/`.jeeves` unchanged; current source intentionally refuses frozen-profile export.

[State/client handoff](../field-projects/youtube/v1/notes/fp06a-foundation.md) names strict bounded
v1 contracts, stable IDs, typed transaction functions, private metadata/upload/inbox/outbox and count
receipts/totals, ready/totals public views, versioned repeatable migrations, migration-only owners
and metadata_upload/metadata_lifecycle/counts_writer. Legacy reader grants revoked before private
creation/on upgrades; Transcoder remains broker+S3/no SQL. Confirmed destination relays/backoff,
pre-listen HTTP/awaited-handler budgets and AMQP terminal metadata/fatal closed signal implemented;
unfinished shells refuse before consumption/listen. No FP06b browser/upload routes or FP06c processing.

[Evidence/provenance](../field-projects/youtube/v1/notes/evidence/fp06a/README.md): app own frozen
install/TS7 build +2 network-free checks; isolated real SQL/broker migration/grant/atomic rollback/
duplicate/confirm/backoff/terminal-close/binding probes pass. Synthetic SQL rows/outbox/counts0 and
all queues0/consumers0 before owned jeeves-fp06a containers/two volumes/network/image/secrets removed.
No prepared field runtime; next FP06b creates final jeeves-youtube-v1 with safe first-run/restart
and starts only its implemented Upload/browser subset. G01–G08/S01–S08 remain incomplete; no feature/
template/effort-saving claim.83 baseline payloads+manifest unchanged,24 planned integration edits,
17 new custom app files; seven business extensions/pins/locks unchanged. Active effort/cost unknown.

Required checks sequential/source steady/no Docker build-cleanup overlap: first known PGlite5s
restart timeout397/398 retained, isolated12/12 then unchanged full **398/50** pass21.25s;
**36 native E2Es1.2m**, **web build975ms** (existing advisory). Final actual owner4300 mouse
Resources/Access/focus/custom-profile refusal/TinyURL12/13 pass; zero page errors/one expected422.
E2E DB matches prior default-only state. Owned capture4302 stopped; original4300/4310 watchers,
four other Compose projects and `.jeeves-feedback/` preserved. No live/paid/cloud calls or media/
credentials/runtime/dependencies/build data staged. No automatic v2 before working-v1 owner review.

Local commit: **FP06a: add custom YouTube ownership and durable state foundation**.

## 2026-11-07 — FP06b: creator, real multipart and minimal browser uploader

Only FP06b after **65f3a33b5a16418f8ae414628def67c7da8bab77**, primary main sole writer, no
branch/worktree/stash/delegation/push. [Next-unit/runtime interfaces](../field-projects/youtube/v1/notes/fp06b-upload.md)
and [evidence/provenance](../field-projects/youtube/v1/notes/evidence/fp06b/README.md). Verified creator
JWT inside awaited route budgets; scoped real multipart/ListParts/exact sizes/complete+Head,
SQL pending/job/outbox/stable repeats, dedicated confirmed relay, resume/abort/status/cleanup.
Plain own-TS DOM browser adds PKCE S256/one-use state+nonce/trusted /me/session tokens/provider
logout, real uploader/progress/recent/resume/abort; baked exact-nginx edge assets. Tracked first-run
versus restart preserves credentials/project/volume identities, refuses ambiguous bootstrap replay.
Scoped helper repairs drain late admitted HTTP work/default503 and expose fatal publisher closure.
No processing/lifecycle/Watch/search/count consumer or premature lifecycle sweep starts.

Actual frozen-recipe pinned-FFmpeg fixture **15,584,953B/SHA16587281…68aebf9** retained ignored at
`app/.runtime/media/youtube-v1-fixture.mp4`; version/config/ffprobe/log and3realPUT sizes/ETags/ListParts
retained. S02 upload + S03 bounded first-part pause/refresh/reselect/same-ID missing2,3 resume and
separate partial abort/complete410 pass. Anonymous401/foreign404, finite invalid JWT/oversize/non-MP4,
actual streamed completed originals hash/size and private-original403 pass. Staged S01 is in-repo
subset startup/identity/provider logout, with separate outside-copy own frozen build/4checks/Docker
edge build; final independent runtime/all-service S01 and S04–S08 remain later work. Normal stop/
start retains two pending/one aborted. **Both queued job deadlines05:49:08.889/05:49:10.392 UTCNov8
elapsed during intentional staging**; preserve queue/IDs, use fresh FP06c uploads, never weaken10min.

Final **jeeves-youtube-v1** seven-container stack stays healthy **http://127.0.0.1:4400/** (Identity4401,
S3 signing4402), five volumes, runtime/fixture/FFmpeg image retained. Read creator password locally
from `app/.runtime/secrets/creator_password` (`creator`); other creator password separate. Start/
stop instructions in [app README](../field-projects/youtube/v1/app/README.md). Only independent
scratch build image removed; no scratch runtime started. Other four Compose projects, owner4300/
4310/4304 watchers and `.jeeves-feedback/` preserved. All current config/implementation-source,
`.jeeves`, inputs,001–010 native snapshots, pins/locks/generator/templates unchanged; saved local
v1 remains schema3/r6/native010 and frozen005 profile deliberately refuses it. No new source/
presentation decision or011, generic framework, provider campaign or feature/savings certificate.
Cumulative74 baseline payloads+manifest unchanged,33 planned integration mods,23 new custom files;
custom business extension work and helper repairs are distinct. Active effort/tokens/cost unknown.

Required checks after Docker build/cleanup/source steady: evidence JSON lint-format failure fixed,
full **398/50 in22.87s** plus types/lint. First E2E35/36 existing project-menu setup timeout30s;
unchanged exact test alone3.4s/6.4s and full **36/36 in1.4m**; no root/test/timeout edits. **Web build
971ms**, existing advisory. Actual mouse current-v1 Fit22/27 + Upload focus and TinyURL53 Fit12/13,
all four complete owner responses/listing preserved, zero page errors; E2E DB default-only. Final
screenshot review caught pending selection showing0/3 after multipart closure; initial image kept,
state-aware100% completion/explicit abort display fixed, own/independent4checks/browser+edge builds
and scoped selection/refresh/reload/abort mouse recapture pass. Root sources/tests remain unchanged.
No paid/live/cloud calls or credentials/media/auth traces/deps/build/runtime data staged.

Next **FP06c only**: real FFmpeg worker/extensions, lifecycle/inbox/publication relay/fixed deadlines,
ready-only Watch/cache and browser HLS; Search/indexer/count remain stopped until FP07a. Fixture and
actual foundation/client interfaces are ready. No automatic v2 before working-v1 owner/fresh review.

Local commit: **FP06b: implement creator multipart uploads and browser subset**.

## 2026-11-08 — FP06c: real media processing and public playback

Only FP06c after **384ff5172f3bfc735c82c00a22c9c04acb840b5b**, primary main/sequential sole writer;
no branches/worktrees/stash/subdelegation/push. [Exact next interfaces/runtime/IDs](../field-projects/youtube/v1/notes/fp06c-playback.md),
[evidence/provenance](../field-projects/youtube/v1/notes/evidence/fp06c/README.md). Real bounded CPU
FFmpeg extensions/Transcoder (broker+S3/no SQL), validated immutable inventory/marker, confirmed
results; lifecycle inbox/CAS/fixed deadlines/publication relay; ready-only Watch positive cache
with fresh separate totals; plain browser public HLS/details/thumbnail/status/errors and media
MIME/range/cache. Scoped AMQP helper repair shares idempotent admitted-work drain, graceful ack
and fatal shutdown without self-await. Three owned-queue probes pass; only scratch queues removed.

Fresh actual fixture video **fdbbc43f-78a0-4be2-9910-a383de70acf6** reaches ready with real H264/AAC
360/720 HLS/JPEG; original/output hashes and duplicate job/result preserve outputs/one publication.
Invalid media **c922e399-2095-4253-a109-cf4950d1c76c** visibly fails/public404. Signed-out mouse
play5s/124 decoded frames/seek/edge206 pass; unmuted decoded PCM440.085Hz measured, **no human
listening**. Two deliberately staged FP06b jobs fail elapsed queue deadlines and ignore late results.
Local temps always clean; **remote partial/orphan outputs retained**, no S3 cleanup/atomic ACL claim.

Own frozen install/server+browser builds/7 network-free checks pass. Required first known PGlite5s
restart timeout397/398 retained; unchanged isolated12/12 then full **398/50 in22.56s**, **36 native
E2Es in1.4m** first try, **web build976ms** pass. Final owner4300 mouse current-v1 Fit22/27/Upload
focus and TinyURL53 Fit12/13, all four complete responses/listing preserved, zero page errors;
E2E DB original default-only. No root/test/timeout/source/config/diagram/pin/lock/generator/template/
`.jeeves`/input changes. Native010/schema3/r6/frozen-profile refusal remain; no011 needed. Harness
failed attempts and capture timing limitations are retained in evidence. Active time/cost unknown.

Final **jeeves-youtube-v1**11 containers/6 volumes remain healthy4400–4402; runtime/fixture at
`field-projects/youtube/v1/app/.runtime/`, creator password file `.runtime/secrets/creator_password`
(username`creator`), unchanged actual fixture SHA16587281…68aebf9/mtime. Other Compose projects,
owner4300/4310/4304 watchers and `.jeeves-feedback` preserved. No media/secrets/auth traces/deps/
dist/runtime/paid-cloud calls staged. Next **FP07a only**: Search/indexer/Counter remain stopped;
one committed VideoPublished waits in search-indexer, count totals empty0, view POST explicit503.
Implement strict existing publication/search and ViewPlayed/receipt+increment interfaces, real
2s cumulative-play browser policy and search/count UI. FP07b independent integrated S01/S08 remains;
no automatic v2 before working-v1 owner/fresh review.

Local commit: **FP06c: implement real media processing and public playback**.

## 2026-11-08 — FP07a: committed public search and playback counts

Only FP07a after **75d6275c38eeb114f74de524759cac5d341abf55**, primary main/fresh sequential sole
writer; no branches/worktrees/stash/subdelegation/push. [Exact next interfaces/runtime/IDs](../field-projects/youtube/v1/notes/fp07a-search-counts.md),
[evidence/provenance](../field-projects/youtube/v1/notes/evidence/fp07a/README.md). Strict explicit
public OpenSearch mapping/query, publication-only indexer/versioned upsert, ready-validated confirmed
ViewPlayed202, receipt+increment Counter and minimal mouse search/cumulative2s playback/count UI
now run. Original request budgets, positive ready reader and scoped SQL/AMQP APIs reused; Counter
has no metadata CONNECT, indexer no SQL/raw processing input. Small generated HTTP helper repair
replaces inherited unknown-route501 with finite404 while unused shell startup still refuses.

Fresh ready **fdd51924-5a94-4e45-be02-a77b3c82d1a7** (`marigoldquartz`/`saffroncobalt`/`creator`)
searchable1.156s after ready; mouse queries/Watch, pending/invalid0 and publication repeat1doc/version1
pass S06. S07 lost-response same-ID retry adds1/visible1.023s, same-page pause/seek/resume/explicit
retry add0, new session adds1. Final3views honestly includes prior legitimate1 from a retained failed
CDP freeze harness assumption; no receipt/total reset. Measured callback block with advancing media,
controlled hidden signal and2x playback add0; controlled signal is not OS tab-hide evidence. Fresh
invalid **023291a9-47ba-4955-ba42-7e9787a63baa** fails/public404/search0. Original ready demo remains
ready/searchable/count0; old invalid/elapsed jobs/orphans retained. No S3 cleanup/human listening claim.

Own frozen install/server+browser builds/10focused checks pass. Mandatory checks sequential/source
steady after Docker: **398tests/50files23.74s**, **36native E2Es1.4m**, **web build1.00s**, all first
try (existing build advisory). Actual4300 mouse current-v1 Fit22/27/Upload focus and TinyURL53 Fit12/13;
all four full owner responses/listing unchanged, zero page errors. Final field mouse search/Watch/
thumbnail/polling/safe error recovery passes without a count event; E2E DB default-only preserved.
No root implementation/test/timeout/config/diagram/generator/template/pin changes. No011 needed.

Final **jeeves-youtube-v1**14containers/6volumes healthy4400–4402; `.runtime`/fixture/credentials
preserved. Creator password file `field-projects/youtube/v1/app/.runtime/secrets/creator_password`
(username`creator`), other creator separate. Exact fixture15,584,953B/SHA16587281…68aebf9/mtime
unchanged. Owner4300/4310/4304 watchers, other Compose projects and `.jeeves-feedback` preserved.
Cumulative61baseline payloads+manifest unchanged/46modified-generated/29new custom files; extensions/
integration/helper repair distinct. Effort/cost unknown; no secrets/auth traces/media/deps/dist/runtime
or paid/cloud calls staged. Next **FP07b only** independent outside-checkout all-service S01–S08,
normal restart/restore and owner review pack; precise copy/stop/scratch-cleanup/restore instructions
in linked handoff. Preserve no-human-audio and remote-orphan limitations. No automatic v2.

Local commit: **FP07a: implement committed public search and playback counts**.

## 2026-11-08 — FP07b: independent v1 walkthrough and owner review pack

Only FP07b after **9cd622f3bf1db14d8687b0ab88a0da6afb7c0ebe**, main, sequential sole Sol/xhigh
writer. No branch/worktree/stash/delegation/push. [Integrated results/replay](../field-projects/youtube/v1/notes/evidence/fp07b/README.md),
[owner walkthrough/fresh-agent checklist](../field-projects/youtube/v1/notes/review-pack.md),
[137-file provenance](../field-projects/youtube/v1/notes/evidence/fp07b/provenance.json).
Current READMEs/plan/status updated; H01–H09 observations, playbook lessons and gap review appended.
No executable app/root/generator/template/config/source/diagram/pin/lock changes. App README only:
results/demo/limits and all-profile retained `down` correction. Native010/schema3/r6 remains;
frozen005 cannot emit customr6. Safe custom preservation/regeneration remains a review proposal.

Outside tracked copy passed own frozen install/build/10 network-free checks and fresh Docker
first-run with all14 services in **jeeves-fp07b-review**. Bounded S01–S04/S06–S08 pass: creator/logout,
3 real parts/streamed original SHA/private ownership, part1 pause/refresh/same-ID resume of2,3,
separate abort410, actual360/720 H264/AAC HLS/JPEG, search676ms after ready, cumulative2s play event
+1 visible5.348s after confirm/same-page and same-ID repeat0/new session+1, finite errors/original403.
**S05 partial: no human listening**, despite signed-out8.009s/219 decoded frames/unmuted440.085Hz
PCM/mouse seek. Normal restart preserved count2/Watch/search/login and6 volume/credential identities.
Wrong-wording search harness failure retained; corrected continuation reused rows without product
repair. Default-profile cleanup left app resources; scoped all-profile cleanup removed all scratch
containers/volumes/network and3 owned image tags. No global prune/reset; pinned FFmpeg retained.

Owner **jeeves-youtube-v1 all14 healthy/same6 volumes** restored **http://127.0.0.1:4400/**.
Normal `pnpm start`/`pnpm stop` in app; creator password locally
`field-projects/youtube/v1/app/.runtime/secrets/creator_password` (username `creator`). Same secrets/
setup/fixture SHA16587281…68aebf9/15,584,953B/mtime and identical ready/search/counts**3/0** before/after.
FP07a demo **fdd51924-5a94-4e45-be02-a77b3c82d1a7** (`marigoldquartz`), older FP06c ready
**fdbbc43f-78a0-4be2-9910-a383de70acf6**; invalid/elapsed jobs/orphans preserved. Scratch IDs removed.
Other Compose projects, owner4300/4310/4304 watchers and `.jeeves-feedback` preserved. No secrets,
media, auth traces, signed URLs, deps/dist/runtime data staged. Root Playwright was operator only.

Required sequential checks after Docker, first try: **398 tests/50 files22.74s +lint/types**,
**36 native E2Es1.4m**, **web build999ms** (existing advisory). Actual4300 mouse current v1 Fit22/27,
Upload focus and TinyURL53 Fit12/13; all four complete project responses/listing preserved,0 page
errors. E2E DB matches prior default-only. Final field mouse search/Watch/thumbnail/polling/count3,
0 events; screenshots/native010 inspected. All137 current hashes match final provenance. No timeout
or test edits.61 unchanged payloads+manifest/46 modified-generated/29 new custom is byte accounting,
not coverage/savings. Business implementations, helper repairs/reuse and studio/generator investment
are separate; active effort/tokens/cost/savings unknown.

Next **FP08 owner/fresh-agent review**, no automatic v2. Human listening/direct OS background-tab
proof remain open; remote orphans/public guessed partial keys remain; Watch/search ready is boundary.
Review fitted text/shared trunks/read-write/long returns and focused flow/relationship label candidates.
No renderer redesign/011, generic DSL/tile/template adoption, certification/enterprise/capacity or60%
savings claim.

Local commit: **FP07b: verify independent v1 and prepare owner review**.


## 2026-11-08 — Workspace cleanup and source benchmark

Moved the studio into `jeeves/` and shared configs into `tooling/`; root pnpm commands,
Docker/CI and fixture paths follow the move. [Layout](repository-layout.md).
Added the committed-source LOC benchmark: v1 **159 retained template / 2,715 post-template
LOC (5.53%)**. Tests/configuration and code outside `src/` are excluded. [Method/report](field-projects/source-loc.md).
Restored the root README from remote `3ae6aff` and recovered 43 historical files with original
hashes. Subsequent owner README/media edits remain unstaged. Feedback shrank from 695 to 70
lines; its complete archive is preserved. AGENTS protects the README and requires concise feedback.

Checks: frozen install; `pnpm check` **402 tests/51 files**; **36 E2Es**; web build; Docker
build/start/restart and 108-file generator assembly; mouse YouTube Fit/focus and TinyURL Fit.
Initial parallel runs hit startup/browser timeouts; capped Vitest at four workers and Playwright
at three, retaining all assertions/timeouts. Final suites pass. Failed-run traces/logs remain in
`/tmp/jeeves-workspace-update/`; three leftover test projects were removed from `jeeves_e2e` only.
Restored originals retain their historical whitespace; other staged files pass the whitespace check.

Studio 4300/4304 and API 4310 run from the new paths. All owner project responses are unchanged;
YouTube 4400 remains healthy (14 services). `.jeeves-feedback/` and owner edits are untouched.
Next remains FP08 owner review; this unit starts no v2 work.

Local commit: **Organize workspace and record source LOC baseline**.


## 2026-11-08 — Backend scope for LOC benchmarks

The owner clarified that UI must be excluded until Jeeves has a UI builder. Method
`source-loc-v2` requires reviewed backend/UI paths, gives UI exclusions precedence and refuses
unclassified eligible source. Reports embed the scope and hash. The v1 backend scope and new
report preserve the original report; all 45 included files and totals remain identical:
**159 template / 2,715 post-template LOC (5.53%)**. Updated the method, plan and agent guidance.

Checks: actual CLI/report comparison; scope/hash validation; offline cases for UI inside `src/`,
UI overriding a backend directory, and missing/invalid/unclassified scope; `pnpm check`
**402 tests**, **36 E2Es**, web build and studio mouse check. Owner designs/README/media and
`.jeeves-feedback/` are unchanged. Future versions must review their backend/UI scope explicitly.

Local commit: **Scope LOC benchmarks to backend code**.

## 2026-11-08 — YouTube v2 extraction and studio review

Reviewed all 45 benchmarked backend files, generator/profile/export, current diagram and studio
controls against the owner's latest README/feedback. [Review and questions](plans/reliable-foundations/youtube-v2-review.md)
records exact LOC groups, reusable candidates, UI issues and a provisional sequential unit order;
two live inspector screenshots retained. Added concise feedback/playbook lessons. No v2 code,
templates, saved designs, root README or runtime changes; no delegation or push.

Benchmark rerun matches the complete committed JSON: 159/2,715 LOC, 5.53%. Checks: `pnpm check`
402 tests/51 files in 22.08s plus lint/types; 36 native E2Es in 1.3m; web build 915ms (size advisory).
Mouse YouTube Fit/Upload/options/modules/ownership/operations/collapse and TinyURL Fit pass;
0 page errors, all 5 complete owner design responses unchanged; v1's 14 services healthy. Logs in
`/tmp/jeeves-youtube-v2-review/`. Existing `.jeeves-feedback/` edits and e2e-docker mode preserved.
Next: owner answers template breadth, 60% target versus gate, and template-backed normal UI policy;
then finalize bounded sequential assignments. No automatic v2 execution from this review.

Local commit: **Review YouTube v2 extraction and studio controls**.

## 2026-11-08 — YouTube v2 sequential build plan

Owner settled reusable video/generic templates, v2 share above 5.53% with 60% an eventual
cross-project target, and only necessary template-backed configuration. [Plan](plans/reliable-foundations/youtube-v2-plan.md),
[shared contract](plans/reliable-foundations/youtube-v2/contracts-and-controls.md) and
[23 assignments](plans/reliable-foundations/youtube-v2/assignments.md) give each fresh sequential
agent its own reads/work/checks/exclusions/commit. Require product-attachment reuse without
YouTube search/counts, hidden internal metadata, unchanged v1 functionality and an untouched
generated baseline before completion. Recorded decisions in feedback/playbook/AGENTS and linked
the active field plan. No implementation, saved-source/runtime changes, delegation or push.

Checks: plan links/23 ordered and fully structured assignments; `pnpm check` 402 tests/51 files
in 21.23s plus lint/types; 36 native E2Es in 1.3m; web build 1.19s (existing size advisory).
Mouse YouTube Fit/Upload and TinyURL Fit, no page errors; all 5 owner design responses unchanged.
Logs `/tmp/jeeves-youtube-v2-plan-*.log`. Root README and unrelated feedback/e2e-docker changes
preserved. Next assigned implementation unit: **YV2-01 only**; this planning unit starts none.

Local commit: **Plan reusable YouTube v2 templates and sequential execution**.

## 2026-11-08 — YV2-01: typed generation source and blueprint boundary

Optional strict schema3 `generation` now carries exact runtime/preset/template refs, stable
selection IDs, canonical targets and ten finite tagged bindings. Immutable semantic catalogs/
internal policies install no implementation. [Actual interfaces](plans/reliable-foundations/youtube-v2/interfaces.md)
records symbols and native010-compatible queue direction, auth-guard identity and cross-role
same-authority lifecycle bindings. Atomic `buildGenerationCommand`/`previewGeneration` includes
explicit ownership changes; target cleanup, surviving-reference refusal and complete snapshot
Undo/Redo share existing history. V3/chat retain declarations; v2 refuses exact unsupported paths.
Present generation changes strict TinyURL's subject/hash and blocks that finite composition;
absent-generation documents/subjects stay unchanged. Blueprint/settings docs updated.

Five focused offline cases cover strict round-trip/refusal, actual native010 topology, target/
component cleanup and PGlite schema2 upgrade+ownership+generation Undo/Redo. Final required checks:
`pnpm check` **407 tests/53 files, 23.24s**, **36 native E2Es, 1.4m**, web build **1.00s**
(existing size advisory). Logs `/tmp/jeeves-yv2-01-{check-final,e2e,build}.log`. Frozen assembler
still emits **108 identical files**, including unchanged manifest. No normal UI/rendering change;
E2Es retain TinyURL/mouse coverage; no separate manual mouse check needed for this source unit.

Next **YV2-02 only**: pure normalization, full role/grant/provider/setting/policy requirements
and host-supplied installed support. No v2 renderer, forms, executable templates, field snapshot
or app yet. No v1/generator/root README/runtime/input changes. Owner `.jeeves-feedback` edits,
e2e-docker mode and services/resources preserved. Sequential main; no delegation/branch/stash/push.

Local commit: **YV2-01: add typed template selections to design source**.

## 2026-11-08 — YV2-02: binding normalization and supported controls

Added pure `resolveGeneration` and finite immutable `generationCapabilities` in spec.
The model validates canonical bindings, host definitions/roles, source/projection authority,
explicit grants/dependency access, queue direction/mode and related selection consistency.
Cache tile TTL and worker concurrency are authoritative; contradictory component mirrors refuse.
Supported values/defaults, exact setting/permission source paths, typed fixed policies and actual
consumer/output responsibility share one model. Normal controls need both necessary user choice
and a host-installed real consumer. Catalog presence installs nothing. [APIs](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-02--semantic-normalization-and-installed-control-support).

Native010 topology is preserved. Local transport mismatches remain precise unsupported findings;
Identity's required service-language metadata becomes an explicit nonfatal unsupported-intent →
Keycloak record, never a claimed TS/Go implementation. Identity vendor settings are checked.
One direct source-validation amendment refuses a YouTube upload/lifecycle pairing referencing
another owned-upload. No binding schema/ref changes, executable templates, forms, field output or
v1/runtime/input changes. Safe local/SQL identity derivation is injective; future SQL emitters quote
validated identifiers and validate any composed names separately.

Four offline boundary cases; final `pnpm check` **411 tests/54 files, 23.12s** plus lint/types;
**36 native E2Es, 1.4m**; web build **1.09s** (existing chunk-size advisory). Frozen assembler still
emits **108 files** with byte-identical manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Logs `/tmp/jeeves-yv2-02-{check-final,e2e,build,v1}.log`. Pure spec changes add no normal UI;
existing browser E2Es cover TinyURL lane rendering/mouse actions; no separate manual check needed.

Next **YV2-03 only**: separate assembler/registry/manifest/export. No runtime implementation is
installed yet; `complete` means semantic/installed support, not emitted build/hook/runtime evidence
or strict readiness. Preserve owner services/resources, root README, `.jeeves-feedback` dirt and
existing e2e-docker mode. Sequential main; no delegation/branch/worktree/stash/push.

Local commit: **YV2-02: resolve template bindings and supported controls**.

## 2026-11-08 — YV2-03: separate deterministic assembler and safe export

Added `validateV2Input`, `captureV2Sources`, `createV2Registry`, `assembleV2`,
`loadLocalV2Registry` and `export:v2`; [actual interfaces](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-03--registry-assembly-provenance-and-fresh-export)
record the contracts. Exact saved/canonical/normalized input identities stay separate from
semantic descriptor refs and actual executable/source/asset fingerprints. Render uses frozen
normalized input and copied captured assets. Files have one owner, exact original-source pointers
and explicit contributors; actual emitted ownership is required for every selected consumer path.
Shared writers/collisions/default-created source pointers refuse. Reports retain unsupported intent,
missing consumers and required custom/unfinished hooks. Diagnostic/partial emitters install no
complete support. Existing safe export and edit/custom-path preservation helpers are reused.

The real local registry currently emits **only** `diagnostics/generation.json` plus four provenance
files: no runtime/preset/feature implementation, app envelope, UI or server preview. Two actual CLI
exports match byte-for-byte; existing destination refuses while preserving edited/custom files.
Five offline checks plus final `pnpm check` **416 tests/55 files, 29.60s**, lint/types; **36 native
E2Es, 1.8m**; web build **1.31s** (existing chunk advisory). Logs in
`/tmp/jeeves-yv2-03/{check-final,e2e,build,cli,cli-existing,v1}.log`.
Browser E2Es retain TinyURL lane/mouse and legacy preview/download checks; this infrastructure
unit changes no normal UI, so no separate manual mouse check was needed.

Frozen v1's complete **108-path/hash list is identical**, including manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-04 only**: real standalone project/provider/access foundation; refine the broad diagnostic
gap when that foundation exists, preserving missing feature/hook findings. No v2 field app or
prefilled baseline. Root README, local-v1 assets, v1 inputs/app/runtime, owner services/resources,
`.jeeves-feedback` dirt and e2e-docker mode are unchanged. Sequential main, no delegation/push.

Local commit: **YV2-03: assemble and export versioned v2 templates**.

## 2026-11-08 — YV2-04: standalone local project/provider/access foundation

`local.foundation` now installs only the real runtime envelope through the existing registry/
assembler/resolver. Captured local-v2 assets emit exact standalone package/lock/build/Docker,
selected provider/setup Compose, private setup/restart scripts and hash-checked migrations.
`V2Emitter.local` / `V2LocalContribution` provide finite migration/login/schema-qualified view/
relation-grant, broker/storage/search and service hooks, with one shared-file writer and actual
contributors. Composed SQL/provider names validate without truncation; store access aggregates
per host. Migration owners stay setup-only, including separate Keycloak owner/vendor logins.
Required feature/service/mapping gaps remain explicit; no domain tables/handlers, field app,
forms, preview or v2 snapshot. [Interfaces](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-04--standalone-local-foundation).

Final `pnpm check`: **419 tests/56 files, 38.61s**, plus lint/types; native **36 E2Es, 1.8m**;
web build **1.12s** (existing size advisory). TinyURL/mouse browser coverage retained; no normal
studio UI changed. Two final deterministic 27-file scratch exports pass own frozen install/build
and all emitted script syntax checks. Real six-provider startup, retained-identity restart,
applied migration-hash refusal, separate vendor-role SQL probe and no-secret unlabeled-volume
namespace refusal passed. [Sanitized evidence/resources/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-04-foundation.md);
logs `/tmp/jeeves-yv2-04/`. Scoped cleanup removed all three scratch stacks, ten volumes, three
networks/image tags, private runtimes and the single separately owned preflight-probe volume.
All fourteen v1 services remain healthy; no owner state was reset.

Frozen v1 still emits 108 identical paths, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-05 only**: real HTTP/identity/AMQP primitives. Feature mappings/CORS/handlers remain
unobserved and unfinished. YV2-16 must add the finite nginx edge for three internal APIs/static/
public media; current direct HTTP slot permits one service. Preserve root README, local-v1,
v1 app/inputs/runtime, owner resources, `.jeeves-feedback` dirt and e2e-docker mode. No push.

Local commit: **YV2-04: emit standalone local runtime and access foundation**.

## 2026-11-08 — YV2-05: reusable HTTP, identity and messaging runtime

`local.primitives` emits eight selected dependency libraries from captured `.ts.template` assets:
HTTP/admission, explicit verified principal, confirmed AMQP/delivery and SQL/object/search clients.
[Actual APIs/paths](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-05--reusable-http-identity-and-transport-clients).
Route-only configure keeps awaited auth/JWKS/effects inside admission/deadline; timed-out work
retains its slot until settlement and close drains before dependencies. Messaging preserves
metadata, awaited effect/terminal+confirm-before-ack, bounded retry, fatal notification and ordered
idempotent close without self-await. Invalid consumer bindings refuse before network/credentials.
Clients reuse actual foundation secret/SQL utilities and accept explicit endpoints/bindings/adapters.
No YouTube constants/contracts, guessed login/audience, feature attestations, services or shells.

Final `pnpm check`: **423 tests/57 files, 44.94s** plus lint/types; **36 native E2Es, 2.3m**;
web build **1.28s** (existing chunk advisory). Four small offline boundary cases; two deterministic
35-file fresh exports pass own frozen install/build. Actual loopback HTTP/JWKS timeout/admission/
drain and isolated pinned RabbitMQ publish/retry/terminal/fatal probes passed. [Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-05-primitives.md),
logs `/tmp/jeeves-yv2-05/{check-final,e2e,web-build,export-verified,install-verified,build-verified,http-verified,broker,cleanup}.log`.
Scoped all-profile cleanup removed `jeeves-yv2-05-primitives` container/volume/network and private
runtime; no scratch image existed, ports45230–33 released. All fourteen v1 services remain healthy.
No normal studio UI changed; native browser tests retain TinyURL lane/mouse/generation coverage.

Frozen v1's 108-path/hash list remains identical, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-06 only**: generic SQL outbox/inbox/receipts. Required business/template/service/mapping
hooks remain unfinished; issuer/JWKS use foundation wiring, API audience/creator policy belong to
later adapters/composition. Keep YV2-16's finite edge boundary. No v2 field app, v1/runtime/input,
root README, pins/locks, owner resources, `.jeeves-feedback` or e2e-docker mode changes. No push.

Local commit: **YV2-05: extract reusable HTTP and messaging runtime**.

## 2026-11-08 — YV2-06: transactional delivery and receipt dependencies

`local.durability` emits typed transaction scopes, bound generic outbox schema/enqueue/relay and
receipt-with-effect APIs. [Actual interfaces](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-06--transactional-delivery-and-receipt-dependencies).
State/intent/receipt effects share one SQL transaction; caught SQL/enqueue/receipt failures still
refuse commit. Stable receipt identity projection permits validated transport-timestamp drift.
Relay reuses the YV2-05 confirmed publisher, locks bounded due batches, defers with capped backoff,
and drains on close. Confirm-before-mark is at least once: post-confirm SQL rollback can duplicate
the same event ID. No network/SQL atomicity or exactly-once claim. Shared dependency-free
local/durable-sql sources reuse actual foundation quoting/migration/grant hooks; no implicit
logins/grants, business templates, services, forms or product transitions are installed.

Final `pnpm check`: **426 tests/58 files, 40.37s**, lint/types (existing Biome style info);
**36 native E2Es, 2.3m**; web build **4.60s** (existing chunk advisory). Three focused offline
PGlite cases; generator-only dev dependency reuses existing pin **0.5.9**, no runtime app pin
change. Two final deterministic **40-file** scratch exports pass own frozen install/build;
a typed non-video adapter compiles. Actual PostgreSQL/RabbitMQ rollback/dedup, exact runtime
grants, concurrent SKIP LOCKED, confirm/retry/post-confirm rollback duplicate IDs and one receipt
effect passed. [Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-06-durability.md).
Logs `/tmp/jeeves-yv2-06/{check-final,e2e,web-build,export-verified,install-verified,build-verified,migrate,probe,cleanup}.log`.
Scoped cleanup removed two containers/two volumes/network, no image; private runtime removed,
ports **45240–45244** free and all fourteen v1 services healthy. No normal UI change; native
browser coverage retains TinyURL lane rendering and mouse/generation behavior.

Frozen v1's **108-path/hash list** is identical, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-07 only**: owned-upload persistence/hooks. Required business/application/mapping gaps
remain unfinished. Preserve YV2-16 edge boundary, root README, local-v1/v1 source/input/runtime,
owner resources, `.jeeves-feedback` dirt and e2e-docker mode. No field v2 app or push.

Local commit: **YV2-06: extract transactional delivery and receipt modules**.

## 2026-11-08 — YV2-07: owned upload persistence and hooks

`local.upload-state` emits generic `owned-upload.ts` / `upload-sql.ts` dependencies with
server-generated asset/upload UUIDs, exact verified-owner queries, file fingerprint/provider
phases, DB-clock 24-hour expiry, bounded reconciliation/cleanup and stable completion replay.
`ownedUploadSchema` / `ownedUploadPersistence` provide video-independent migration and explicit
runtime login/SELECT/INSERT/UPDATE grants through the existing foundation. No application FK,
title/channel, S3 operation, route, service or installed multipart support is assumed.
[Actual API](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-07--owned-upload-persistence-and-application-hooks)
records the typed metadata/reservation/completion/terminal callbacks on YV2-06's caller Tx.
Caught hook/codec failures still poison the transaction; pending state+intent or terminal
lifecycle updates can commit with upload state in YV2-09. Hooks see detached pretransition
snapshots under the row lock. `assetId` maps to `videoId` only in the later product adapter.

Four focused offline PGlite cases; final `pnpm check` **430 tests/59 files, 40.08s** plus
lint/types; **36 native E2Es, 2.7m**; web build **5.36s** (existing chunk advisory).
Initial overlapping check/E2E work caused one existing undo/redo 5-second timeout; the isolated
final check passes unchanged assertions/timeouts. Two deterministic **43-file** scratch exports
pass own frozen install/untouched build and a typed PDF/document metadata/job adapter build.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-07-upload-state.md),
logs `/tmp/jeeves-yv2-07/{check-final,e2e,web-build,export-verified,install-verified,build-verified,build-adapter-verified}.log`.
No provider scratch stack/runtime/secret/port/volume was created; all fourteen v1 services remain
healthy. No normal UI changed; browser E2Es retain TinyURL lane/mouse/generation coverage.

Frozen v1's **108-path/hash list** is identical, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-08 only**: actual signed multipart engine/HTTP factory and provider smoke using this
repository; `VerifiedOriginal` must come from real provider inventory/Head identity validation.
Provider/SQL uncertainty is preserved; no new idempotent-start or atomic network claim exists.
YV2-09 uses required complete/closed hooks for application lifecycle, without editing upload core.
Preserve YV2-16 edge boundary, root README, local-v1/v1 source/input/runtime/fixtures, owner
resources, `.jeeves-feedback` dirt and e2e-docker mode. No v2 field app or push.

Local commit: **YV2-07: extract owned upload persistence and hooks**.

## 2026-11-08 — YV2-08: owned signed multipart transfers

`local.multipart` emits real generic `multipart.ts`, `multipart-objects.ts` and
`multipart-http.ts` dependencies: create/sign/ListParts/complete/Head/abort, exact owner/part/
fingerprint checks, resume/status, stable completion replay and bounded single-flight cleanup.
[Actual factories, mounts and fixed limits](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-08--owned-signed-multipart-transport-and-http-mounts).
Uses YV2-07 repository/hooks on the caller's YV2-06 Tx. Content/metadata/verified principal,
namespace/identity metadata and HTTP paths/status/body/error mapping are explicit adapters.
Cleanup scans only a trusted prefix/key recognizer; Head validates declared fingerprint metadata,
not object-byte hashing. SQL/provider uncertainty remains visible. Selected storage key/CORS is
contributed through the foundation with bootstrap-only owner access, no extra application login.
No lifecycle/service/complete source-bound multipart template or normal control is installed;
required compiled recipe/principal/content/completion/service gaps stay honest until YV2-15/16.

Three new focused offline cases; final isolated `pnpm check` **433 tests/60 files, 45.87s** plus
lint/types; **36 native E2Es, 2.2m**; web build **1.58s** (existing chunk advisory). Initial root
check under four live scratch providers put new PGlite startup over its existing 5-second budget;
scoped provider shutdown yields a full pass with unchanged tests/assertions/timeouts/fixtures.
Two deterministic **44-file** fresh exports pass own frozen install/untouched build and typed
PDF/document adapter build. Real isolated HTTP/Postgres/Garage probe passes 5,242,997 exact bytes+
downloaded SHA, real Head identity/fingerprint, signed PUT+CORS, resume/incomplete, uncertain
completion reconciliation, stable replay/+1 intent, abort and five foreign-owner operations.
Verified principal awaits inside admission; runtime SQL lacks CREATE and S3 lacks CORS owner.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-08-multipart.md); logs
`/tmp/jeeves-yv2-08/{check-final,e2e,web-build,export-verified,install-verified,build-verified,build-adapter-verified,first-run,probe,cleanup}.log`.
Scratch project **jeeves-yv2-08-multipart**: four containers, three volumes, one network/app image
and private runtime removed with exact-project cleanup; ports **45250–45252** free and all
fourteen v1 services healthy. Probe harness-only bodyless JSON/CORS-read assumptions were fixed;
its exact earlier sessions were aborted without resetting SQL/provider data. No secrets/URLs logged.
No normal UI changed; browser coverage retains TinyURL lane/mouse/history/generation behavior.

Frozen v1's **108-path/hash list** is identical, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-09 only**: asset lifecycle with required complete/closed hooks; keep transport state
separate and compose pending/job intent in the hook transaction. YV2-16 owns actual installed
consumer/service bindings, scheduling/draining sweep work and the finite HTTP edge. Preserve
root README, local-v1/v1 source/input/runtime/fixture, pins/locks, owner resources,
`.jeeves-feedback` dirt and e2e-docker mode. No field v2 app or push.

Local commit: **YV2-08: generate owned signed multipart transfers**.

## 2026-11-08 — YV2-09: fixed asset lifecycle and committed publication hooks

`local.asset-lifecycle` emits `asset-sql.ts`, `asset-lifecycle.ts` and `asset-worker.ts` generic
runtime dependencies. [Actual APIs and hookup gaps](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-09--fixed-asset-lifecycle-and-committed-publication-hooks).
`createAssetLifecycle` composes YV2-07 reserve/complete/closed hooks with YV2-06 branded Tx,
outbox and receipt effects: pending+one job intent, ready+optional publication intent+receipt,
version CAS, stale/terminal refusal and fixed DB deadlines. Queue10m/processing30m, sweep50/30s;
repeated start never extends a running job, and matching pending success remains accepted.
Wire adapters retain original envelopes; receipt identity omits only occurredAt. Typed metadata/
job/result/failure/publication codecs contain product policy. SQL-only processing/deadline failure
callback is optional; upload terminal failures synchronize through closed hooks. No search/count
requirement, YouTube metadata/namespace, media SQL secret or new editor control was added.
`assetLifecyclePersistence` contributes explicit same-authority migration/logins/grants; private
`assetReadySelect` defines the committed source contract, leaving actual public fields/grants to
YV2-15/16. No installed application/feature/service is claimed; required recipe gaps stay visible.

Five focused offline PGlite cases pass against actual emitted modules. Final `pnpm check`:
**438 tests/61 files, 32.71s**, lint/types (existing Biome info); **36 native E2Es, 1.6m**; web
build **1.30s** (existing chunk advisory). Two final deterministic **47-file** scratch exports
pass own frozen install/untouched build and typed non-YouTube PDF/document adapter build, with
and without publication. No assertion/timeout/pin changed. [Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-09-lifecycle.md);
logs `/tmp/jeeves-yv2-09/{check-final,e2e,web-build,focused-final,export-final,install-final,build-final,build-adapter-final}.log`.
No provider stack/runtime secret/media/port/volume was created; scratch source/build artifacts
remain under that /tmp directory. All fourteen retained v1 services are healthy. No UI changed;
E2Es retain TinyURL lane/mouse/history/generation coverage.

Frozen v1's **108-path/hash list** is unchanged, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Next **YV2-10 only**: fixed reusable media engine. Keep actual application codecs/public views/
HTTP and service composition for YV2-15/16, including finite nginx edge and scheduled/drained
sweep work. Preserve root README, local-v1/v1 app/input/runtime/fixture, owner resources,
`.jeeves-feedback` dirt and e2e-docker mode. No field v2 app, branches/worktrees/stash or push.

Local commit: **YV2-09: generate asset lifecycle and committed publication hooks**.

## 2026-11-08 — YV2-10: fixed reusable video-to-HLS engine

`local.video-hls` emits `media-process.ts`, `video-result.ts` and `video-hls.ts`; shared
`local.asset-identity` emits `asset-identity.ts` under `src/runtime/`. Existing lifecycle
`assetUuid`/`AssetJobIdentity` reexports remain compatible, with no SQL/SDK dependency in the
engine. [Actual APIs and cleanup contract](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-10--fixed-reusable-video-to-hls-engine).
`encodeVideoHls({input,output,job,signal})` accepts existing asset/job/attempt IDs, explicit
source key/size/SHA and immutable resultPrefix. It creates output exclusively, returns a bound
strict marker and removes its own output on failure; caller must finally remove the whole
workspace, including input and successful output. Fixed MP4/H264/AAC landscape bounds,
360p/720p CPU ladder, full-size thumbnail, subprocess/deadline bounds and byte inventory remain.
No product schemas/namespaces, SQL, search/count, encoder controls or installed service claim.
Required `video-hls-worker-bindings` stays honest; engine files alone install no source template.

Three new focused offline cases; `pnpm check` **441 tests/62 files,29.42s**, lint/types;
**36 native E2Es,1.3m**; web build **988ms** (existing chunk advisory). TinyURL lane/mouse/
generation checks pass; no UI changed. Two deterministic **31-file** fresh engine-only exports;
own frozen install/untouched build and typed course-video adapter build pass. Real pinned
FFmpeg on retained read-only fixture passes both H264/AAC renditions,20.000s,full-size MJPEG,
14-file exact inventory/bound generic attachment marker, invalid-media failure/local cleanup,
preabort and existing-output refusal. FFmpeg **7:5.1.9-0+deb12u1** and all288 OS package versions
match frozen lock; executable/configuration hashes recorded. [Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-10-video-engine.md);
logs `/tmp/jeeves-yv2-10/{check,e2e,web-build,export-final,install-final,build-final,build-adapter-final,media-smoke-final,cleanup}.log`,
`media-evidence/{runtime,probes,marker,result,cleanup}.json` and `export-summary.json`.
Own network-none/read-only scratch container auto-removed; scratch exports/deps/build/media
work removed, useful sanitized logs/harness retained. No ports,volumes or images created;
retained exact FFmpeg image untouched and all fourteen v1 services healthy.

Frozen v1 **108-path/hash list** is identical, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Retained fixture stays15584953 bytes, SHA
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`;
no v1 source/input/runtime/fixture/pin edits. Next **YV2-11 only** owns source download/byte-hash
verification, queue/storage runner, immutable marker/inventory reuse, ordered uploads and
confirmed callbacks; create only parent workspace, then finally remove input/success output.
YV2-15/16 retain product adapters and installed pinned image/service composition. Preserve root
README, owner dirt/e2e-docker mode and all owner resources. No v2 field app, branch/worktree/
stash/push. Local commit: **YV2-10: generate reusable fixed video processing**.

## 2026-11-08 — YV2-11: storage-backed media worker runner

`local.media-worker` emits `src/runtime/{media-worker,media-objects}.ts` and contributes explicit
selected original-read/output-read-write storage and job-consumer wiring through the foundation.
[Actual APIs/ownership and remaining bindings](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-11--storage-backed-media-worker-runner).
`startMediaWorker<J,R>` injects distinct raw job/result/event codecs, authoritative namespaces,
object clients/buckets and confirmed YV2-05 transports; default engine remains fixed YV2-10.
64KiB job/event bounds, actual downloaded-byte size/SHA, exclusive parent workspace/engine output,
20-minute execution, predownload marker+inventory reuse, ordered segments→playlists→thumbnail/
master→marker uploads, remote revalidation and confirmed callbacks remain. Malformed jobs invent
no failure identity; invalid media is finite/nonretryable. Normal close drains; fatal aborts and
schedules all owned drains without self-await. No product schemas, SQL credential/mount, remote
cleanup, new provider policy/ACL/atomic-publication claim, installed service or normal control.

Three focused offline cases; final `pnpm check` **444 tests/63 files,28.59s**, lint/types;
**36 native E2Es,1.3m**; web build **880ms** (existing advisory). Initial full run exposed the
multipart emission test selecting all features while expecting upload-only storage; scoped that
fixture to multipart, preserving its exact assertion. No assertion/timeout/pin weakened. Two
final deterministic **33-file** exports pass own frozen install/untouched build and a typed
non-YouTube lesson worker adapter build without SQL/search/count. Real generated first-run,
Garage/RabbitMQ and pinned FFmpeg probe passes14 inventory objects+marker/15 ordered PUTs,
confirmed start/success, exact duplicate bytes/ETags/mtime/versions with no download/encode/PUT,
actual invalid-media confirmed failure+failed queue and empty local workspace. Inspected exact
read-only fixture/image mounts and no SQL service/login/mount; worker source PUT actually403.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-11-media-worker.md); logs
`/tmp/jeeves-yv2-11/{focused-final,export-verified,install-verified,build-verified,build-adapter-verified,first-run-final,probe-final,mount-check,check-final,e2e,web-build,cleanup-final,cleanup-files}.log`,
`media-evidence/{summary,marker,mounts,snapshot-before,snapshot-after}.json` and `cleanup-summary.json`.

Scratch **jeeves-yv2-11-media** providers/probe,2 volumes,network and own app image removed;
**45260–45263** free (only Garage45262 was published). Owned exports/deps/build/runtime/work
removed; sanitized logs/harness/evidence retained. Exact FFmpeg image and all14 healthy v1
services untouched. Frozen v1 **108-path/hash list** unchanged, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`;
fixture15584953 bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
Root README including owner Future Benchmarks,feedback dirt/e2e-docker mode and v1 assets intact.
No field v2 app,branch,worktree,stash or push. No UI changed; TinyURL lane/mouse coverage passes.

Next **YV2-12 only**: positive-cache module. Required video recipe remains unfinished;
YV2-15/16 must bind actual codecs/transports/source namespaces and the one media service, install
exact pinned FFmpeg and verify ffmpeg/ffprobe before readiness, and wire signals/drain. Do not
contribute these media storage bindings twice. Remote reuse checks SHA metadata; only the probe
independently hashes remote outputs. Preserve owner resources/frozen v1. Local commit:
**YV2-11: generate storage-backed media job runner**.

## 2026-11-08 — YV2-12: immutable positive-cache read dependency

`local.positive-cache` emits `src/runtime/{positive-cache,valkey}.ts` and
`src/features/positive-cache-bindings.ts`; generator `positiveCacheReadAccess` contributes only
an exact runtime login and SELECT on a trusted explicitly contributed view. Default output
grants no SQL access. [Actual interfaces/gaps](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-12--immutable-positive-cache-read-dependency).
`createPositiveReader` takes key/codec/identity+eligibility/authoritative loader, required emitted
TTL and optional expiry/cache. Per-key single-flight, cache fallback, no negative/L1/totals,
150ms phases, absolute atomic PXAT clamp, subsecond fill skip and post-fill expiry recheck.
`createValkeyCache` uses normalized endpoint/secret, connect500ms/command150ms, queue32,
no offline queue/reconnect and destructive timeout/owned close. Cache tile TTL remains the sole
authority; unequal reader mirror refuses. No normal controls, pins, product SQL or HTTP added.

Seven focused offline cases pass; `pnpm check` **451 tests/64 files,29.20s**, lint/types;
**36 native E2Es,1.3m**; web build **1.52s** (existing advisory). Two final deterministic
**31-file** exports with renamed manual-api/manual-db/manual-cache and TTL7200 pass own frozen
install/untouched build, then typed PDF/manual adapter compile and offline execution using
the same emitted reader/client interfaces and actual normalized TTL. No assertion/timeout
weakened. No real provider matrix needed/run; no strict TinyURL Resolve completeness claimed.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-12-positive-cache.md);
logs/harness `/tmp/jeeves-yv2-12/{focused,check,e2e,web-build,export-final,install-final,build-final,build-adapter-final,manual-smoke-final,cleanup}.log`
and `export-summary.json`/`cleanup-summary.json`. Owned scratch exports/deps/builds removed;
no provider/port/volume/image/secret created. All14 retained v1 services healthy; no UI changed
and TinyURL lane/mouse/history/generation coverage passes.

Frozen v1 **108 paths/hashes** unchanged, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`;
fixture15584953 bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
Root README including owner Future Benchmarks, feedback dirt/e2e-docker mode and v1 assets
preserved. No field v2 app, branch/worktree/stash or push.

Next **YV2-13 only**: reusable receipt counter. The cache remains a dependency, with explicit
`positive-cache-application-bindings`; YV2-15/16 must supply actual immutable ready-only view,
identity/codec/key/loader and Watch service using emitted TTL/cache client, plus client close.
No source-bound cache consumer is installed yet. Preserve owner/frozen resources. Local commit:
**YV2-12: extract positive cache read template**.

## 2026-11-08 — YV2-13: generic receipt-based event counts

`local.event-counter` emits `src/runtime/{counter-sql,event-counter,counter-worker}.ts`; explicit
`eventCounterPersistence`/`eventCounterReadAccess` contribute actual private tables, public totals
view and narrow runtime grants through the foundation. [Actual APIs/ownership/gaps](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-13--receipt-based-event-counts).
Receipt+one increment share YV2-06 transaction; per aggregate+event dedup, stable meaningful
identity without regenerated timestamps, case-sensitive text keys and exact transport-ID binding.
Wire decoder runs once; receipts revalidate a separate internal envelope. Consumer awaits commit
before ack, delegates finite malformed/retry/fatal/drain behavior to YV2-05, owns its consumer;
caller owns SQL pool. Fresh string totals remain outside metadata cache. No qualifier/product
schema/service, arbitrary amount/analytics/score policy, normal field or provider/pin change.

Three focused offline cases; `pnpm check` **454 tests/65 files,29.93s**, lint/types;
**36 native E2Es,1.3m**; web build **1.57s** (existing advisory). Two deterministic **42-file**
renamed exports pass own frozen install/untouched build, then typed nested non-video notice
adapter build through identical emitted interfaces. Real scoped generated migrations/runtime
logins and RabbitMQ consumer confirm duplicate/timestamp drift once, another event again,
same ID in another aggregate, case-sensitive keys, public view totals while private reads/
view writes/CREATE denied, malformed finite failed queue and normal drain. No checks weakened.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-13-event-counter.md); logs/harness
`/tmp/jeeves-yv2-13/{focused-final,check,e2e,web-build,export,install,build,build-adapter,migrate,probe,cleanup,cleanup-files}.log`,
`{export-summary,probe-summary,resources,cleanup-summary}.json`.

Scratch **jeeves-yv2-13-counts** PostgreSQL/broker,2 volumes and network removed by scoped
`down --volumes --remove-orphans`; **45270–45274** free. No image created/removed; retained
FFmpeg and all14 healthy v1 services preserved. Own exports/dependencies/builds/private runtime
removed before root checks. Frozen v1 **108 paths/hashes** unchanged, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`;
fixture15584953 bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
Root README/owner Future Benchmarks,feedback dirt/Zone.Identifier variants and e2e-docker mode
preserved. No v2 field app,branch,worktree,stash or push; no UI changed/TinyURL mouse checks pass.

Next **YV2-14 only** owns search projection/query. Required `event-counter-application-bindings`
remains: YV2-15/16 must install actual ViewPlayed qualifier/codec, Watch fresh-count mapping,
SQL/service/runtime/readiness/signals. **Canonicalize video UUID aggregate/event and transport
IDs at that adapter boundary** before generic case-sensitive text keys. Supply exact explicit
counter tables/view/grants and bound YV2-05 consumer; keep public reader away from receipts/
private login, and end caller pool after consumer drain. Local commit:
**YV2-13: generate generic receipt-based event counts**.

## 2026-11-08 — YV2-14: public search projection and bounded query

`local.search-projection-query` emits generic `search-{contract,schema,projection,indexer,query}`
runtime modules and normalized search bindings. `searchProjectionMapping` contributes actual
version/properties through YV2-04; selected projection contributes its actual topic subscriber.
Separate `features/public-video{,-search}.ts` holds shared public record/document schema+mapping
and unchanged finite query preset. [Actual APIs/ownership/gaps](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-14--public-search-projection-and-bounded-query).
Public exact fields/ID/version validated, raw wire decoded once, separate internal envelope,
external_gte/3s upsert before ack, consumer drain once/caller closes client. Explicit mapping
version/properties/settings assertion refuses incompatible data without repair/reset. Trimmed
q1–200,page1–100,size20,exact totals,750ms,ready/public filters,best_fields title^3/description/
channel^2,default OR (no AND/prefix),score/publishedAt/ID sort retained. No SQL credential,
normal field/provider/pin or prior algorithm change; actual application support stays unfinished.

Three focused offline cases; `pnpm check` **457 tests/66 files,29.78s**, lint/types;
**36 native E2Es,1.3m**; web build **1.67s** (existing advisory). Two final deterministic
**51-file** renamed exports pass own frozen install/untouched build, then typed non-video
catalog adapter build+offline round trip through the same generic factories. Real disk-backed
PGlite metadata/outbox commit survives reopen before confirmed RabbitMQ relay and separate
read-only indexer makes it queryable in OpenSearch. Rollback publishes nothing; repeat retains
count1/external version1; pending/private fails finitely; full-word/default OR/page2 and
incompatible-version refusal observed. Indexer has code/deps/broker secret only, no SQL mount/
login, and drains exit0. Probe nested publicNotice wire is not YV2-15's application codec.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-14-search.md);
logs/harness `/tmp/jeeves-yv2-14/{focused-final,export-final,install-final,build-final,
build-adapter-final,catalog-smoke-final,setup-search,setup-broker,probe,cleanup,check,e2e,
web-build}.log` and `{export-summary,probe-summary,cleanup-summary,indexer-mounts}.json`.

Scratch **jeeves-yv2-14-search** broker/search/indexer,2 volumes/network removed by exact-project
`down --volumes --remove-orphans`; **45280–45284** free. No image built/removed; exports/deps/
builds/private runtime and producer DB removed before root checks. Frozen v1 **108 paths/hashes**
unchanged, manifest `5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`;
fixture15584953 bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
All14 retained v1 services healthy. Root README/owner Future Benchmarks,feedback dirt/Unicode
Zone.Identifier/colon variants and e2e-docker mode preserved. No v2 app,branch/worktree/stash/push.
No UI changed; native TinyURL lane/mouse coverage passes. Local commit:
**YV2-14: generate search projection and bounded query modules**.

Next **YV2-15 only**: actual YouTube HTTP/event/metadata adapters. Reuse `public-video.ts`
record/schema/mapping rather than duplicate validators; map generic lifecycle assetId→videoId
and canonicalize UUID document/event/transport IDs consistently. Wire VideoPublished stable
identity and authoritative namespace/path checks, exact HTTP/media URLs remain15; bounded
manifest/thumbnail strings alone do not establish ownership. Required `search-application-bindings`
remains until actual compiled consumers/mappings/services15/16 install; default emission grants
no SQL or product mapping, and no template attestation is claimed.16 still owns complete pack/
service/runtime readiness, finite edge and pinned FFmpeg/ffprobe readiness before process ready.

## 2026-11-08 — YV2-15: YouTube product contracts and existing browser API

`local.youtube-adapters` emits strict metadata/creator/upload/processing/publication/ViewPlayed
codecs, authoritative original/result paths and stable v1 wire IDs; canonical UUIDs bridge generic
asset IDs to product video IDs before case-sensitive counter/search keys. Actual prior factories
compose Upload lifecycle/status mapping, ready-only public SQL/cache, fresh totals, confirm-gated
view acceptance and unchanged Upload/Watch/Search route/status/response shapes/media URLs.
Shared public-video validators/mapping are reused, strengthened for paired asset/job/attempt
paths and owned once by the adapter emitter. No UI/control/provider/pin or lifecycle algorithm
change. [Actual APIs/seams/gaps](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-15--youtube-contracts-and-browser-api-adapters).

Three focused offline cases; final `pnpm check` **460 tests/67 files, 30.43s**, lint/types;
**36 native E2Es, 1.3m**; web build **888ms** (existing advisory). Two final deterministic
**80-file** fresh exports pass own frozen install/untouched build. Compiled HTTP + pinned scratch
RabbitMQ confirms RS256 creator/ownership errors, stable upload replay, pending404/ready public
reads, actual confirms before view202, duplicate count1, fresh totals outside cache, failed
publisher503 and Search/browser shapes. PGlite public role reads the nine-column view; private
SELECT42501 and explicitly false INSERT privilege verified (view writes separately fail55000).
Object/media/Search probe doubles are explicit; runtime probe precedes final title-codec reuse,
which received focused tests and final untouched build. Backend adapter inventory: **785 LOC/10
files**, shared public features **95 LOC/3 files**; no final template-share claim.
[Evidence/LOC/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-15-adapters.md).
Logs/scripts: `/tmp/jeeves-yv2-15/{focused-final,check-final,e2e,web-build,export,install,build,
probe,cleanup}.log`, `{export-summary,probe-summary,adapter-loc,resources,cleanup-summary}.json`.

Exact scratch **jeeves-yv2-15-contract** broker/one volume/network removed; ports **45290–45293**
free. Own exports/dependencies/builds/producer DB/secrets removed before root checks; no image
built/removed. All 14 retained v1 services healthy; retained FFmpeg unchanged. Frozen v1 **108
paths/hashes** unchanged, manifest5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f;
fixture15584953 bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9.
Root README/owner Future Benchmarks, feedback dirt/Unicode deletion/colon variants and e2e-docker
mode preserved. No v2 field app, branch/worktree/stash/push. No studio UI changed; native TinyURL
lane/mouse/history/generation checks pass.

Next **YV2-16 only**: install source-bound video feature/YouTube preset and complete services,
actual SQL/views/grants/resource/settings/client bindings, finite nginx/static/media routes,
pinned FFmpeg+ffprobe readiness before ready, signals and ordered drain. Required application
and `youtube-service-composition` gaps remain honest; no selected template/preset support is
attested yet. Use `youtubeReadySelect` for foundation-owned CREATE VIEW, not both that and the
standalone `youtubeReadyView`. Generic `assetEventId` and public `createTotalReader` were moved
without algorithm changes and retain their old reexports; lifecycle raw-wire validation/API is
unchanged. Local commit: **YV2-15: bind YouTube behavior to reusable feature modules**.

## 2026-11-08 — YV2-16: reusable video attachment and complete YouTube backend

`buildGenerationPresetCommand` explicitly materializes graph/modules/generation/ownership in one
batch; prefixed base video preserves existing design intent and selects only upload/lifecycle/HLS.
Default `loadLocalV2Registry()` installs `local.video-composition`: exact connected refs/authority,
SQL/migrations/public views/grants, actual seven business processes and finite three-API/static/
media edge. Generic bound constructors and video-only FFmpeg/ffprobe readiness stay separate from
YouTube adapters; creator roles come only from the trusted YouTube recipe. Base exports keep
required product/service hooks, zero SQL logins/app services and no search/count resources.
[Actual APIs/settings/output/support](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-16--video-attachment-and-complete-youtube-local-recipe).

Final deterministic **93-file** exports pass own frozen install/untouched build; default-registry
prefixed base does too. Exact final manifest017f246b54abc21b05cc8fc7e9a14dea6604594f75af7bf96dcee442b258fcd7
clean first-run/real Keycloak PKCE + signed multipart + CPU360p/720p + committed-ready Watch/search1/
duplicate count1 pass with all14 generated containers healthy. Media/indexer have no SQL mount;
Watch private SELECT42501/public view/pool50/timeout500ms and confirmed outboxes observed. Normal
restart preserves credentials/volumes/composition/video/search/count; all app drains exit0.
Necessary setup fix excludes provider-generated keys from placeholders/initial hashes, then hashes
their real values after bootstrap/owner revocation. Existing algorithms/providers/pins unchanged.
[Evidence/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-16-composition.md),
[sanitized results](plans/reliable-foundations/evidence/youtube-v2/yv2-16-summary.json).

Post-cleanup `pnpm check`: lint/types, **463 tests/68 files,40.55s**; **36 native E2Es,1.4m**;
web build **1.02s** (existing advisory). TinyURL lane/mouse/history/generation coverage passes;
no studio UI changed. Logs/harness `/tmp/jeeves-yv2-16/` (`check-final.log`, `e2e-final.log`,
`web-build.log`, `*-proven-final.log`, `restart-final.log`, `*-summary.json`). No weakened checks.
Exact scratch jeeves-yv2-16-compose containers/5volumes/network/2labelled images and all owned
exports/runtime/secrets/deps/builds removed; ports45300–45304 free. Fresh frozen-v1 export matches
108 hashes; historical manifest5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f,
fixture15584953/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9 and retained
FFmpeg unchanged; all14 v1 services healthy. Owner README/Future Benchmarks, feedback/Unicode
Zone.Identifier deletions/colon variants and e2e-docker mode preserved. No branch/worktree/stash/
push or final v2 app. Commit: **YV2-16: compose video feature and YouTube local preset**.

Next **YV2-17 only** wires supported source choices/controls to mouse and chat using the actual
constructors/commands above. Base product hooks remain custom; YV2-20 owns alternate consumer
proof,21 the untouched field baseline,22 the existing browser. Static notice is an explicit browser
slot, not that browser; deterministic report runtimeVerification stays none/strict readiness separate.

## 2026-11-08 — YV2-17: installed feature configuration through mouse and chat

Normal authoring now shares `buildSupportedAuthoringCommand` and actual installed support from
`GET /generation-support`. System General previews video/YouTube attachment, graph/modules/
ownership/generation and explicit upgrade in one Undo step. Forms show useful installed HTTP,
worker, cache TTL and SQL controls only; authoritative TTL/concurrency mirrors update atomically.
Hidden alternatives/raw module creation refuse in chat; legacy source remains readable, renameable
and exportable. New links explicitly use local HTTP/Private network; historical intent is retained.
[APIs/gaps](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-17--installed-feature-authoring-through-mouse-and-chat).

Final `pnpm check`: lint/types, **465tests/69files,31.20s**; then **36native E2Es,1.3m**;
web build **1.68s** (existing advisories). Historical nested source, exact contracts and Undo tests
remain; unsupported fixture setup uses explicit source commands. Live4300 Chromium1440×900 mouse
TinyURL selection, preset attach19tiles, native TTL spinner3600→3601/mirror3601, Undo/reload3600,
zeroerrors; ownprojects deleted. [Evidence/snapshots](plans/reliable-foundations/evidence/youtube-v2/yv2-17-authoring.md).

Final deterministic **93-file** complete export passes own frozen install/untouched build; TTL420
reaches actual Watch constructor. Manifest2193f1dc7ffa1b3038d46a2817f2bf413880c0a7e42599a2ce1598bfb9a7648f.
All108frozen v1 hashes/manifest and15584953-byte fixture match; retained FFmpeg unchanged/all14v1
containers healthy, v1app clean. Own export/deps/build removed before root checks; no Docker/port
allocation. Logs/harnesses `/tmp/jeeves-yv2-17/{check-final,e2e-final,web-build,browser,export-final,
install-final,build-final}.log` and summary JSONs. Owner README/feedback dirt/Unicode deletions/colon
variants/e2e-docker mode preserved. No branch/worktree/stash/push/finalv2app. Local commit:
**YV2-17: align editor and chat with installed template support**.

Next **YV2-18 only** owns remaining owner/role/operation/requirements/presentation clutter and
normal viewport review. This unit hides unsupported configuration/type/module alternatives; existing
ownership/strict-operation diagnostic authoring remains for18. YV2-19 still owns saved-source v2
preview/ZIP dispatch. Base video product/service hooks remain custom; no new runtime/strict proof.

## 2026-11-08 — YV2-18: process tiles and useful settings first

Normal canvas renders canonical process/resource tiles; name/kind/useful settings precede focus.
Owner cards, role/deployable/operation subtitles, fallback banner, collapse actions and manual
ownership/operation/requirements forms removed from normal authoring. **Export diagram → Source &
diagnostics** retains exact JSON, read-only declarations, unchanged strict report and exact chat
targets. Source/commands/validators/history, logical ownership and lane layout rules unchanged.
[Interfaces](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-18--canonical-process-presentation-and-read-only-diagnostics).

Post-cleanup `pnpm check` explicitly exited0: lint/types, **465tests/69files,30.88s**; then
**36 native E2Es,1.3m**; web build **919ms** (existing generator/build advisories). Historical form
E2Es now seed full canonical source with exact save/reload assertions, inspect diagnostics and
retain excess-access refusal, exact refs, chat/history, precise clears, mouse removal/move/Undo,
PNG stale/font/cancel/route checks. Live4300 mouse TinyURL+YouTube at **1280×800 and1440×900**:
selection/focus/PNG/source, name edit, TTL mirror and HTTP/SQL/worker native spinners all pass;
whole semantic data preserved after each Undo/reload, zero pageerrors. [Before/after normal and
native/source/studio snapshots, hashes/checks/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-18-clarity.md).

Fresh frozen-v1 assembly matches all108path hashes/manifest5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f;
fixture15584953bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9,
retainedFFmpeg unchanged/all14v1 healthy; app/inputs/assets/generator Git-clean. Two own live review
projects deleted before root checks; no Docker/ports/export/deps/app builds allocated. Owner
README/FutureBenchmarks, feedback dirt/Unicode deletions/colon variants/e2e-docker mode preserved.
No branch/worktree/stash/push/finalv2app. Logs/harnesses `/tmp/jeeves-yv2-18/`. Local commit:
**YV2-18: simplify diagram and inspector authoring**.

Next **YV2-19 only** owns selected saved-source v2 preview/ZIP dispatch. `ExportDiagram` now takes
`onDiagnostics`; native captures record canonical process view. Complete YouTube backend unchanged;
base video custom hooks remain required, deterministic runtimeVerification:none and strict TinyURL
blockers remain honest. No standalone app build required for this presentation-only unit.

## 2026-11-08 — YV2-19: selected saved-source preview and ZIP

Generate explicitly dispatches canonical saved v2 source through the same cached actual registry
as authoring, or exact frozen-v1 assembly; no name/preset/source substitution. Unsupported refs,
bindings/settings refuse. V2 preview shows actual consumers/custom gaps and source/registry/ZIP
identities; required base-video hooks stay partial. Existing draft/history/source/archive/cancel/
browser-hash guards remain; strict TinyURL readiness/runtime evidence stay separate. Docker keeps
trusted generator source/assets plus production workspace links and readable fingerprinted root
lock; no field app/runtime. [Interfaces](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-19--selected-saved-source-preview-and-deterministic-zip).

Final post-cleanup `pnpm check` explicitly exited0: lint/types, **466 tests/70 files,32.03s**;
then **37 native E2Es,1.4m**; web build **871ms** (existing advisories). New browser case waits for
saved attachment before its source snapshot; no assertion/pin/timeout weakening. Live own Jeeves
45310/45311 mouse TinyURL, supported YouTube attachment, native TTL3600→3601, preview/download,
repeat-identical ZIP, stale/actually saved unknown refusal pass; final1280/1440 dialogs, errors0.
Actual93-file mouse ZIP extracted outside checkout passes own frozen install/untouched build;
all emitted bytes remain unchanged, canonical input and all payload hashes match, real Watch TTL
consumer receives3601. Manifest4819963221d7fef684bf7f949000f971e0fc993762345e1b185d17e4fd4ab305.
Normal production image/start/API smoke reproduces the same v2 ZIP and exact108-file v1 ZIP,
actual installed support/real v2 assets, with only six approved field inputs/PNG.
[Evidence/screenshots/sanitized hashes/limits](plans/reliable-foundations/evidence/youtube-v2/yv2-19-generation.md).

Before root checks, exact own image/container/volume/database/settings/exports/deps/build removed;
ports45310–45314 free. Fresh frozen-v1 all108 path hashes and historical manifest5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f match;
fixture15584953bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9,
retained FFmpeg/all14 healthy v1 services/six volumes preserved. Root README/owner FutureBenchmarks,
feedback/Unicode deletions/colon variants and e2e-docker mode preserved. V1 app/inputs/local-v1
assets clean. No provider/pin change, branch/worktree/stash/push or finalv2app. Logs/harnesses:
`/tmp/jeeves-yv2-19/{check-final,e2e-final,web-build,browser,package-smoke,install,extracted-build}.log`.
Local commit: **YV2-19: generate v2 projects from selected saved source**.

Next **YV2-20 only**: alternate reuse proof/final preflight and diagram/input snapshot. Existing
base video required product/service hooks, browser slot, runtimeVerification:none and strict
TinyURL gaps remain honest; no backend provider/fault matrix or work20–23 executed here.

## 2026-11-08 — YV2-20: reusable attachment proof and frozen v2 inputs

Default-registry trusted product example binds the same owned-upload/lifecycle/media/durability
engines to fitting-* authority/resources/services, attachment-private SQL and productId/caption.
One real3-part retained fixture transfer/CPU360p+720p/result path commits ready:1 sent job intent,
2 receipts, stable completion replay. Final example node:http read passes against retained media
after Node fetch ignored Host; no second encode/provider run. Final62-file deterministic exports
pass own frozen install/untouched build;28 runtime files identical to full YouTube. No emitted
YouTube/search/count imports/resources/services/credentials; base hooks remain honest. Necessary
foundation fix omits unselected search-init; example target literal fixed under root TypeScript.
[Interfaces](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-20--product-attachment-consumer-and-frozen-field-input).

One final93-file frozen-source YouTube backend preflight passes realPKCE/3PUT/replay/pending404/
CPUHLS/readyWatch/manifest+thumb200/search1/duplicatecount1;all14healthy. Deterministic repeat and
post-typefix fresh export match exact93 pins. Kept separate studio project
**2c7c8b08-4633-4a97-8794-672a777f1d3a**,r2,4300/?project=thatID; native/source/1280+1440 studio
snapshots and exactcanonical input archived under `field-projects/youtube/v2/`. SourceSHA
**e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b**, registry
**6d0a8916c90be61c10736dc58cac91a0f9deaabeefeadc5ec077b7d997b4086f**, manifest
**1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc**. Concrete21 command and
all input/template/registry/output hashes: `v2/inputs/freeze.json`. No `v2/app` exists.

Reviewed backend/UI scope excludes all browser UI and only4 exact pure-data binding files via
optional configurationPaths. Same source-loc-v2/parser/LCS; absent-option v1 CLI bytes identical,
historical report content/files unchanged. No numericalv2share claim before23. Root discovery
already omits fieldapps; Biome now excludes v2app/input/diagramJSON. [Evidence/sanitized results](plans/reliable-foundations/evidence/youtube-v2/yv2-20-reuse-and-freeze.md).

Final post-cleanup `pnpm check` explicitly awaited exit0:lint/types,**467tests/70files31.41s**;
then **37native E2Es1.3m**, webbuild **847ms** (existing advisory). TinyURL lane/mouse and installed
attachment/TTL3601/native-source snapshots pass,errors0, prior ownerprojects unchanged. Own exact
7+14containers/3+5volumes/2networks/4imagetags and exports/deps/build/runtime/secrets removed before
checks; originalimages+volumes unchanged,14v1healthy,FFmpeg1792f4e…/fixture15584953/SHA1658728…
preserved. Fresh v1 all108pathhashes/manifest50987079… unchanged. OwnerREADME/feedbackdirt/Unicode
deletions/colonvariants/e2e-docker mode preserved. No push/branch/worktree/stash. Logs `/tmp/jeeves-yv2-20/`.
Local commit: **YV2-20: verify template reuse and freeze v2 inputs**.

Next **YV2-21 only**: run the exact frozen-input CLI in `v2/notes/README.md` into the new `v2/app`,
verify all93 pins and own frozen install/untouched build, commit generated baseline before custom
work. No further template implementation or provider loops. Final runtime reservedonly:
**jeeves-youtube-v2 /45400,45401,45402 /v2/app/.runtime**, neverstarted; recheck availability before22.
Keep this v2 studio project. Browser/S01–S08 mouse completion belongs22; independent restart and
final backend retained-template report strictly>5.53% belong23. Runtime:none/strict:not-assessed
and local public-output limitations remain explicit.

## 2026-11-08 — YV2-21: untouched generated YouTube v2 baseline

Confirmed `v2/app` absent, then ran the exact frozen-input `export:v2` command from YV2-20
`13bc6f83737253998fb224472d0590c39d05eb23`. Actual **93 files / 4,243,495 bytes** match every
frozen path/hash/byte count, including manifest **1f49c9301fec3122671190269681adf9423b0d6e6f871873c5f8f6afbf21e9cc**
and inventory **ed6eab9609fd59b4148b72ddd25e4481770ab88bff826eebaf7cdbc93195c938**.
Exact canonical embedded source, all92 manifest payloads,156 registry sources,10 templates/
15 implementations and locks verified. No emitted file edited/formatted/repaired or browser added.
Own `pnpm install --frozen-lockfile --ignore-scripts` and untouched `pnpm build` exit0 with own
TypeScript7.0.2;13 exact pins/229 imports have no checkout/workspace dependency. Only ignored
node_modules/dist created, then removed before checks; all93 hashes still match.
[Command, full identities, checks/build logs and limits](plans/reliable-foundations/evidence/youtube-v2/yv2-21-untouched-baseline.md).

Final post-cleanup `pnpm check` explicitly awaited exit0:lint/types,**467tests/70files31.17s**;
then **37native E2Es1.3m**, webbuild **979ms** (existing advisories). TinyURL lane/mouse and
saved-source generation browser coverage pass; no studio UI change or weakened checks.
Optional diff-check flags only frozen generated Dockerfile31 blank EOF; pinned bytes retained.
All748 protected file hashes/modes match; v1 historical manifest50987079…/fixture15584953bytes
SHA1658728…/retainedFFmpeg1792f4e…/14healthy services/sixvolumes preserved. Root README/owner
FutureBenchmarks, feedbackdirt/Unicode deletions/colonvariants/e2e-docker mode unchanged.
No provider/runtime/media run or new Docker resources; no branch/worktree/stash/push.
Logs/verifier `/tmp/jeeves-yv2-21/`. Local commit:
**YV2-21: commit untouched generated YouTube v2**.

Stop here. Next **YV2-22 only** records this actual baseline commit hash and reuses the existing
browser/custom completion separately. Keep v2 studio project2c7c8b08-4633-4a97-8794-672a777f1d3a r2.
Final runtime still unstarted/reservedjeeves-youtube-v2 HTTP45400/identity45401/objects45402/private
app/.runtime; recheck before first start. Prior exact-byte20 backend/alternate proof is retained,
not repeated. Report runtime:none/strict:not-assessed; browser/S01–S08 remain22, independent
restart/final backend retained-template report remain23. No v2 percentage or new certification.

## 2026-11-08 — YV2-22: reused browser on the generated YouTube backend

Prior untouched baseline **695addeb3ac4a77c3a6fbfd2f68d901fced3619f**: all 93 Git blobs independently
match frozen pins. Reused v1's five browser files/presentation as **custom UI**, plus own DOM build,
public runtime identity binding and edge integration. No backend `src/` edit/custom adapter/repair,
no template/frozen input/studio project change. Four `.jeeves` files remain exact, manifest
1f49c930…/inventory ed6eab96…; runtime:none/strict:not-assessed kept as historical generation facts.
[Per-file categories, origins, actual comparisons and evidence](plans/reliable-foundations/evidence/youtube-v2/yv2-22-completion.md).

Retained **jeeves-youtube-v2**, HTTP45400/identity45401/objects45402, private `v2/app/.runtime`0700,
14 healthy services / five volumes. Browser issuer/client/callback derive from the same allocation
and generated identity binding (identity / identity-web); fresh runs can select other ports without
app source edits. Own frozen install/actual backend+frontend build and Docker first-run pass; eight
compiled/presentation/HLS assets match host and Docker by hash. Account passwords only private0600;
[owner access and normal start/stop](../field-projects/youtube/v2/notes/runtime.md).

One exact retained 15,584,953 B fixture flow: mouse signin/out, part1 pause, refresh/reselect/resume
only2/3, stable completion, pending→processing→ready, separate abort410, anonymous401/foreign404,
invalid-media failure/no public hit. Read-only original checksum matches, actual 15 output objects /
14 inventory hashes, 20 s H264/AAC360p+720p/JPEG. Signed-out title/description/channel search1423ms,
Watch219 decoded/0 dropped frames, mouse seek; count0→1 visible1764ms, duplicate/same-page remains1,
new session2; actual two receipts and uncached fresh totals. Normal stop/start preserves credentials,
all five volume identities/media/database/index/count2; mouse retained Watch/search/login pass.
S01 outside-checkout copy remains23; **S05 human listening unobserved**. S04 successful live FFmpeg
argv/stderr were not retained by generated process; exact source argv and actual output proof are
separate. No unnecessary encoding/provider repeat. Operator note-write cwd error and auxiliary image
ID equality assumption are recorded honestly; no product/backend failure resulted.

After temporary failure-file/config/TinyURL-project/browser cleanup, final stack **kept**:
`pnpm check` explicitly awaited exit0, **467 tests /70 files,34.91s**; then **37 native E2Es,1.5m**;
web build **875ms** (existing advisory). Actual TinyURL lane/Fit/select mouse pass. All748 protected
owner/v1 file hashes/modes match;108 frozen v1 hashes/historical manifest50987079…/fixture/mtime/
FFmpeg1792f4e…/14 healthy services/six volumes preserved. Root owner README/feedback/Unicode deletions/
colon variants/e2e-docker mode unchanged. No branch/worktree/stash/push. Sources/docs/evidence only;
ignored runtime/dependencies/serving assets remain for owner restart. Logs `/tmp/jeeves-yv2-22/`.
Local commit: **YV2-22: complete YouTube v2 with reused browser**.

Stop after22. Next **YV2-23 only** independently copies/builds/runs/restarts on its own project/ports,
reviews unchanged backend/UI scope and pins this completion commit in source-loc-v2. No numerical
v2 share claimed here; strictly>5.53 acceptance and eventual60 target unchanged. Keep final45400–02
stack, credentials, five volumes, ready demo9abde227-6abb-4ee0-817e-3d94d90911ea/count2, and frozen
studio project2c7c8b08-4633-4a97-8794-672a777f1d3a/r2. No later unit executed.

## 2026-11-08 — YV2-23: independent actual v2 and fair backend comparison

Actual completion **08699b2dc631709bff12fb25914e0d2681b6b535** independently copied from all 102 tracked
Git blobs outside the checkout. Own frozen install/build and fresh first-run passed on new
**jeeves-yv2-23-independent /45410–45412**, with 14 healthy services and fresh private credentials.
One exact fixture flow observed real PKCE, multipart pause/refresh/resume only parts 2+3, stable
completion, anonymous401/foreign404, abort410, invalid media, CPU HLS360p+720p/JPEG, automatic ready
publication, public search953ms, decoded playback/mouse seek and duplicate-safe counts0→1→2.
One normal stop/start retained credentials, all five volume identities/data/media/index/count2,
14 healthy services and mouse search/Watch/login. No product repair. **Human listening unobserved**;
successful live FFmpeg argv/stderr absent; source argv and actual output evidence remain distinct.
[Actual evidence, operator sources and limits](plans/reliable-foundations/evidence/youtube-v2/yv2-23-independent.md).

Unchanged source-loc-v2 compares baseline **695addeb3ac4a77c3a6fbfd2f68d901fced3619f** to actual086:
**5,456 retained /5,456 final backend LOC =100%; 0 post-template, 0 removed/replaced, 56 files**.
Strictly>5.53 passes; 60 remains the eventual target. Scope unchanged; all UI/four pure-data files
excluded from both totals. Three counted SQL constructors are generator-used rather than runtime
imports, disclosed without changing scope. Per-feature attribution and reused custom UI/integration:
[benchmark](../field-projects/youtube/v2/notes/benchmarks/README.md),
[owner pack with access/commands](../field-projects/youtube/v2/notes/review-pack.md).
Report SHA **fd18d44fdd4a8fabaccb346fdf22d17e3cde6d00bb677bf73c6fbfb83e2f2de4**; raw CLI5dc3ca62…
differs only in JSON whitespace. Current156-source closure/default registry/frozen93 pins match;
all60 backend files/four.jeeves files/locks unchanged; historical v1 reports preserved. Share is not
reliability or effort savings; effort remains unknown.

Before checks, exact all-profile down--volumes--remove-orphans/two own image tags removed. No own
containers/volumes/network/tags remain; ports free; copied runtime/secrets/media/dependencies/build
removed after102 source hash checks. Owner v1/v2 retained **14 healthy each /6+5 same volumes**,
credentials/fixtures/mtime/FFmpeg1792f4e…; all22 pre-existing tag→ID mappings and748 protected file
hashes/modes/original dirty statuses match. Actual102 completion app bytes and studio project
2c7c8b08-4633-4a97-8794-672a777f1d3a/r2/exacte118… preserved. Owner45400–02 runtime/demo retained.

Initial lint found eight pre-existing22 evidence JSON formatting errors. Whitespace-only fixes
preserve parsed content and original086 bytes in an archive with old/new hashes. No app/template/
input/scope/parser/history change or weakened check. Final `pnpm check` explicitly awaited exit0:
**467 tests/70 files,33.45s**; then **37 native E2Es,1.4m**, web build **1.24s** (existing advisory).
TinyURL lane/Fit/select mouse check passed,0 page errors, own project deleted; TinyURL/restart Watch
images visually inspected. Final evidence Biome check31 files passed without fixes. Logs:
`/tmp/jeeves-yv2-23/` and committed sanitized gzip evidence. Root README/owner FutureBenchmarks,
feedback/Unicode deletions/colon variants/e2e-docker mode untouched. No branch/worktree/stash/
delegation/push/global prune. Local commit: **YV2-23: verify independent v2 and compare backend template share**.

Stop after23. No automatic further field version or certification. Owner usability review and
human listening remain owner observations; no further runtime/provider campaign is pending.

## 2026-11-08 — owner review: v2 provenance, reuse and developer visibility

[Review](plans/reliable-foundations/youtube-v2-provenance-review.md) reproduces the actual
5,456/5,456 retained backend LOC report, all 93 fresh export/baseline/frozen pins and all 60
unchanged current backend source files. Fresh alternate export shares 28 identical runtime
files and contains no YouTube/search/count modules. Separates 880 adapter + 259 YouTube service
LOC from reusable mechanisms, and custom browser/startup/Nginx integration from the metric.
Documents the generated wiring and limited current observability; proposes reusable diagnostics
and an off-by-default field-app developer view. No app/template/input/benchmark change or
developer-mode implementation. Added a review-pack link and design lessons.

`pnpm check` exited 0: lint/types, **467 tests/70 files, 36.58s**; then **37 native E2Es, 1.5m**;
web build **1.03s** (existing chunk-size advisory). Live 1440×900 mouse search/Watch and TinyURL
lane/Fit/select pass, zero page errors, six pre-existing project designs unchanged and own
TinyURL project deleted. First browser harness stopped on an overly exact required-label match;
using the existing helper's label matcher passed without app changes. Screenshots inspected.
No upload/encode/playback event or owner-stack restart; retained v1/v2 services remain healthy.
Protected tracked bytes/modes, including root README, feedback dirt and e2e-docker mode, match
the pre-review inventory. Fresh scratch exports removed; logs/harness/screenshots under
`/tmp/jeeves-yv2-audit.9cIc07/`; [committed summary](plans/reliable-foundations/evidence/youtube-v2/provenance-review.json).
Local commit: **Review YouTube v2 provenance, reuse and developer visibility**. No push.

Next work is an owner-selected implementation unit; this review does not start a new field
version, change the historical scope, or claim broader reuse, effort savings or certification.

## 2026-11-08 — owner correction: reusable baseline before YouTube implementation

Removed the active local-v2 YouTube adapter/schema assets, service entry point, emitter and
product recipe (SQL/grants/roles/search/edge wiring). Seven generic/video capabilities remain;
normal mouse/chat attachment offers video only. Historical product declarations stay readable
and export as explicit missing implementations/custom gaps. Unknown refs, missing runtime,
invalid bindings and unsupported settings still block studio export. Product behavior regressions
now consume the retained field-app adapters against current generic engines; no field app edits.

Re-exported the exact frozen e118… design twice: all **72 files** matched. Recorded the full
export and per-file count in [new artifacts](../field-projects/youtube/v2/notes/benchmarks/README.md).
**4,325 backend LOC /42 files**, with the original scope/parser/exclusions unchanged. Retrospective
overlap with existing086 completion is **4,317 /5,456 =79.12%**; **1,139** product lines are outside
the new export. Eight new lines provide a generic TTL-consuming cache constructor after removal
of the product entry point. This is not a newly observed agent-completion experiment. The prior
100% report, original pins/baseline, inputs, app and legacy v1 exporter remain intact.
[Cause, current boundary and reproduction](plans/reliable-foundations/youtube-v2-generic-baseline.md).

`pnpm check` exited0: lint/types and **468 tests/70 files,34.56s**; **37 native E2Es,1.5m**;
web build **1.03s** (existing size advisory). Generic and alternate attachment exports passed
frozen install and build; all final emitted source/package/build bytes match that checked payload.
An unrelated compiled cache adapter exercised TTL3601, one loader call and cache hit. Live studio
preview/download matched the recorded manifest, showed9 custom gaps/3 unfinished product
selections, and preserved all6 existing designs. TinyURL lane/Fit/select passed, no page errors;
own project deleted, screenshots inspected. Protected tracked bytes/modes checked with no mismatch,
including owner README/feedback dirt and e2e-docker mode. Logs/harness/images:
`/tmp/jeeves-yv2-generic.kLxRTO/`; [sanitized verification](../field-projects/youtube/v2/notes/benchmarks/generic-verification.json).

Studio/catalog/method guidance and design lesson updated. Local commit:
**Separate reusable v2 generation from YouTube product code and recount baseline**. No push.
Future completed-app measurement must freeze generic output first and record product work after;
developer mode remains a separate proposed unit. No app rebuild or provider/media campaign here.

## 2026-11-08 — UI overhaul plan from owner feedback

This was planning only; no code changed. I saved the owner's three images in
`docs/human-feedback/`, added the HUMAN_FEEDBACK entry and a playbook lesson, and wrote the
[UI overhaul plan](plans/ui-overhaul/units.md). It has ten sequential units, each for one fresh
agent:

- UI01–UI03: remove focus; build the one-page inspector with Description; add module cards with
  Back.
- UI04–UI05: add board ports at fixed heights, keeping existing layouts byte-identical.
- UI06–UI08: add the Detailed projection, then the toggle and container tiles, then interactive
  modules.
- UI09: readability measurements.
- UI10: independent review.

The plan's Decisions table lists the defaults the owner can change before UI01.

The plan is based on the current inspector, workspace, focus, board and module-link code, and on
the module data. The TinyURL extended, Marketplace and YouTube studies have 9, 16 and 20 modules.
The v2 design has 22, and its Video lifecycle worker links match the owner's sketch exactly. For
those counts I ran a scratch script outside the repo.

The checks were not run. Only docs and images changed, and another session was committing
generator work (`8813523`) during planning. Next: UI01 only.

## 2026-11-09 — UI01: remove relationship focus

Removed Focus relationships per the [UI overhaul plan](plans/ui-overhaul/units.md) (R6). Deleted
`RelationshipFocus.tsx` (its list and `relationshipVerb`, which nothing else used), the focus
state and canvas strip in `Workspace.tsx`, and the `.lane-focus-*`/`.lane-relationship-focus` CSS.
No caller was left for the board's `visibleLines`/`emphasizedTiles`, so they went too, with
`.is-muted` and `fit()`'s line argument (only Fit focus used it). Without a filter, `lineEdges`
draws exactly the old unfiltered output, so the canvas and export are unchanged. The line guide
now says "Select a tile to highlight its lines…". The export dialog says "Selection is omitted",
and the capture details' `view.relationships` lost its "; focus omitted" suffix; PNG bytes are
unaffected.

Tests: `relationship-focus.spec.ts` became `relationship-tracing.spec.ts`. It checks that a
Transcoder selection highlights exactly its 4 lines, drawn last, with all 25 still drawn; that
clicked lines show their saved labels; that paper clears every highlight; and that the X plus
Undo restore the line, the blueprint and the tile positions. It keeps the shared-stem chooser
test and the tile-removal-then-Undo test. The ownership, operations, foundation and export specs
now click the line (`clickLine`) instead of a focus row; each keeps its purpose. The board test
lost its two focus props. Docs: `studio.md` (tracing paragraph, limits, export, report and chat
mentions), `studio-blueprint.md`, and the playbook (a superseded note on the RF02 section and a
2026-11-09 lesson). The plan's status line now says UI01 is done.

Checks: `pnpm check` exited 0: lint/types, **468 tests/70 files**. **37 native E2Es passed
(1.5m)**. Web build passed (existing chunk-size advisory). Mouse check on the running dev app at
1440×900 and 1280×800, using my own TinyURL extended project:

- 11 tiles and 12 lines render, with no focus controls.
- Selecting Redirect service highlights its 4 lines; paper clears them and opens the System
  inspector.
- A click on `redirect-db` opened Choose relationship; choosing it showed its label and X. The X
  removed it, and Undo restored it.
- No page errors.

I deleted the project afterwards; the owner's project revisions are unchanged. Three
screenshots are in `plans/ui-overhaul/evidence/ui01/`. A source search finds no "Focus
relationships", "Fit focus", "Show all" or focus board props.

For UI02: the inspector rail now ends with the operation/owner chat status. I kept the RF02 rule
`.studio-inspector > .studio-selection-summary { flex: 1; min-height: 0 }` (canvas.css), which
lets the page scroll; UI02 may revisit it. The tile Connections tab and ActionInspector's
Entries list are untouched, and `studio.md` still describes the Connections list; both are
UI02's to remove. Historical evidence and capture JSONs that mention focus are left as history.

## 2026-11-09 — UI02: one-page inspector with Description

Per the [UI overhaul plan](plans/ui-overhaul/units.md) (R2, R3, R5), `TargetForm` lost its tab
strip, tab panel and Connections list. A tile or the system is now one page: a header (kind icon,
the Name input styled as the title, kind, the tile's warnings), Description, Options only when it
has fields, then the Modules slot only when the tile has modules. The Name keeps its
`-element.name` id suffix, so new-tile focus still works, and the name is printed once. The system
page is Name, Description, its warnings with their select buttons, then **Add a supported
feature**. `ActionInspector` lost its Entries list (and its `graph`/`onSelect` props).
`TargetInspector` lost `onConnection`, `tab` and `onTab`, and `InspectorTab` is gone. Options is
built from the same `normalSettingFields`, `studioPerformanceFields` and editable filter. A scratch
scan of the four studies and the v2 design found editable settings only in Options and performance,
so the fields shown are exactly today's.

"Goal" and "Purpose" now read **Description** in the web only. Chat's `describeStudioDefinition`
returns the definitions' `fields` verbatim, and the plan forbids changing chat tool text, so the
spec labels stay "Purpose". The blueprint and `__snapshots__` don't contain these labels. The relabel
and the growing box live in the shared `DraftField`, so module descriptions get both too.
`DescriptionBox` starts at 6 rows, grows with its text to half the `.studio-rail` height, then
scrolls. Once the corner is dragged, the box stops growing until it is reopened. Limits,
validation and the 500ms autosave are unchanged. RF02's `.studio-inspector >
.studio-selection-summary` rule still scrolls the page; nothing needed changing there.

Tests: a new `inspector.spec.ts` checks the following:

- there is no tablist;
- the name appears once;
- Description is used, and Purpose and Goal are not;
- the page order for a tile, a bare tile and the system (with a warning);
- there are no connection rows and no Entries;
- the description grows, stops at half the rail, scrolls and shrinks back on Undo;
- the description and title autosave, and Undo restores them.

`edit-history.spec.ts` checks the order Name, Description, Options, Modules on Watch API instead of
clicking tabs. `canvas.spec.ts` selects `redirect-db` by its line, and
`relationship-tracing.spec.ts` reads the title from the Name field. Docs: `studio.md` (Inspector,
History, Limits), `studio-settings.md`, and a playbook lesson. Evidence: four screenshots in
`plans/ui-overhaul/evidence/ui02/`. The before/after Watch API shots come from an own project
with the historical YouTube preset, because study tiles have no Options.

Checks: `pnpm check` exited 0: lint/types and **468 tests/70 files**. **39 native E2Es passed
(1.5m)**. The web build passed (existing chunk-size advisory). For the mouse check I ran the dev
app at 1440×900 and 1280×800 with my own TinyURL extended project (11 tiles, 12 lines) and my own
preset project:

- There was no tablist on any tile or on the system.
- The description autosaved, grew from 137 to 177px, and Undo restored it.
- A corner drag resized the box from 137 to 260px, and it held while I typed.
- The title rename and the Request timeout field (1500) autosaved, and Undo restored both.
- Hover, invalid and dark-mode states looked right.
- There were no page errors.

I deleted both projects, and the owner's six project revisions are unchanged.

Deviation: on the coordinator's instruction, the module form keeps its tabs until UI03, so the
plan's "module inspector has no tablist" check is UI03's to add.

For UI03:

- The Modules slot is `ModuleList` (`ul.lane-module-list`, labelled Modules). `TileInspector`
  passes it, and `TargetForm` wraps it in a section with an `h3.lane-inspector-section`.
- `ComponentForm` is untouched: tabs, Connections, Unlink, the retry note, and
  `onConnection`/`onComponent`.
- `ModuleInspector` still has its own h2. UI03 can reuse `.lane-inspector-header`,
  `.lane-inspector-title`, `.lane-inspector-icon` and `DraftField`'s `className` with
  `lane-inspector-name`.
- The open module is still `useState` in `TileInspector`. Back remounts the tile page at its top.
- Leftovers:
  - the `created`/`focusName` new-module focus effect;
  - unreferenced `.lane-module-add/-menu/-kind/-icon` and `.lane-store-access` CSS;
  - `.studio-dependencies`/`.studio-dependency-row`, used only by `ComponentForm`. Keep
    `.studio-inspector-tabs`, because the Operations and Ownership forms use it.
- `studio.md` Limits still mentions linking modules.
- For UI09: the system's "Add a supported feature" fieldset still uses browser-default styling.

## 2026-11-09 — UI03: module cards with drill-in and Back

Per the [UI overhaul plan](plans/ui-overhaul/units.md) (R4, R5), a tile's Modules section is a
stack of cards (`ModuleCards` in `TileInspector.tsx`, `ul.lane-module-list` labelled Modules). Each
card is one button named "Open <module>" with the module's icon in its family colour, its name,
its kind and its description clamped to two lines. A card replaces the tile page with the module
page: a **Back to <tile>** row (arrow, the tile's icon and name), a header (icon, Name as the
title, kind, readiness findings), Description (UI02's growing box), Options with the same fields
and filter as before, then **Remove module**. `ComponentForm` lost its tabs, its Connections list,
Unlink, the external-call retry note, `retryText` and its `onConnection`/`onComponent` props. No
inspector has a tablist now; the Operations and Ownership forms still use `.studio-inspector-tabs`.
Each page is keyed, so a module opens at its top; Back scrolls the Modules section into view and,
when focus left with the module page, focuses the card just left.

The open module moved from `TileInspector`'s `useState` to the workspace selection
(`canvas/selection.ts`): `WorkspaceSelection = BoardSelection & { module?: string }`, and
`liveSelection(design, graph, pick)` keeps `module` only while it exists in `pick.tile` (else the
tile; a gone tile or line gives `{}`). `Workspace`'s `select(next)` flushes drafts when the tile,
line or module changes. Canvas clicks, diagnostics and warnings call `select({ tile })` or
`select({ line })`, so any other selection, a click on the host tile and empty paper close the
module. Remove module calls `select({ tile })`. A history step that removes the open module shows
the tile page through `liveSelection`. Undoing that step reopens the module, because `pick` still
names it; a selected tile already comes back on Redo in the same way. Chat's
`architectureSelection` is `[module]` while one is open. `chatSelectionReferenceSchema` accepts any
string up to 63 characters that is not `owner:`/`operation:`, component IDs are design-unique slugs,
and the server passes the selection into the turn context next to `designSummary`'s modules with
their IDs. No canvas change; LaneCanvas still gets the selection as a `BoardSelection`.

Removed leftovers: the new-module name-focus effect (no flow creates modules), the unused
`.lane-module-add/-menu/-kind/-icon` and `.lane-store-access` CSS, and `.studio-dependencies`/
`.studio-dependency-row`. Docs: `studio.md` (lane canvas modules line, Inspector, History, Limits)
and a playbook lesson. Evidence: four rail screenshots in `plans/ui-overhaul/evidence/ui03/`.

Tests: `selection.test.ts` (2 unit tests). New `modules.spec.ts` on the YouTube study at
1280×640 covers:

- the Transcoder's 5 cards, their names, kinds and the two-line clamp;
- opening Segmenter and encoder: page order, no tablist or tab, no Unlink or link rows, scrollTop 0;
- name and description autosave, and Undo restores both;
- Back with Modules in view and the card focused;
- closing by another tile, a line or empty paper;
- Remove module, Undo, then Redo removing the open module and Undo reopening it;
- the design and blueprint unchanged by opening or closing;
- chat's selection `["transcoder-encoder"]` in the request and history, and `["transcoder"]` after
  Back.

`edit-history.spec.ts` opens Details reader by its card, checks the page order (Back, Name,
Description, Options, Pool size, Statement timeout, Remove module), autosaves and undoes the pool
size, then goes Back. It opens Link writer by its card and checks it has no Options.

Checks: `pnpm check` exited 0: lint/types and **470 tests/71 files**. **41 native E2Es passed
(1.6m)**. The web build passed (existing chunk-size advisory). The mouse check used scripted
Chromium on the running dev app at 1440×900 and 1280×800, with my own TinyURL extended and YouTube
projects:

- TinyURL rendered 11 tiles and 12 lines.
- Redirect service showed 4 cards and no tablist. Cache reader opened, and Back focused its card
  with Modules in view.
- Remove module on Click publisher returned to the tile (3 cards), and Undo restored it (4).
- Empty paper showed the System page, and another tile closed the module.
- Both blueprints were unchanged after the Undo steps. Dark mode and hover looked right.
- There were no page or console errors.

I deleted all my projects, and the owner's six project revisions are unchanged. Compared with the
owner's inspector sketch, the page reads Name/detail, Description, Options (when present), then
module cards stacked at the bottom.

For UI04: nothing here touches the board or layout. For UI07/UI08:

- Read the open module as `selection.module` (`WorkspaceSelection` in `canvas/selection.ts`). It
  is set only together with its host `selection.tile`.
- To open a module from a canvas row, call `Workspace`'s `select({ tile: host, module })`. That
  flushes drafts, opens the inspector rail and sets chat's selection.
- To close it, call `select({ tile: host })`. `TileInspector` then shows the tile page with
  Modules in view.
- LaneCanvas still receives `selected={selection}` (structurally a `BoardSelection`). UI08's row
  highlight can read `selection.module` from the same object.
- Cards carry `data-module=<id>`.

## 2026-11-09 — UI04: board ports at fixed heights

Per the [UI overhaul plan](plans/ui-overhaul/units.md), the board can now attach a line to a
named port at a fixed height on a tile. No caller uses ports yet, so Jeeves looks the same.

The API is documented in the file headers of `layout/elkGraph.ts`, `align.ts`, `bands.ts`,
`engine.ts` and `react/Board.tsx`:

- `TilePort = { id; side: "in" | "out"; y }`, where `y` is measured from the tile's top. It must
  be a multiple of 32 strictly between 0 and `h`, and the ID must be unique on its tile.
- `LayoutTile.ports` and `TileSpec.ports` list a tile's named ports.
- `LayoutLine` and `LineSpec` take `sourcePort` (an `out` port of the source) and `targetPort` (an
  `in` port of the target). A line without one uses the default mid-height port.
- Helpers: `namedPortId` (`<tile>__port:<id>`), `lineSourcePortId`, `lineTargetPortId`,
  `portOffset`, `usesNamedPorts` and `checkPorts`.

**Invalid ports throw.** An unknown, wrong-side or duplicate port, or one off the grid, makes
`checkPorts` throw. A silent fallback would draw the line at the wrong row. The engine rejects
that request like an ELK error (logged once), so the board keeps its previous layout and sets
`data-layout-error`.

Other changes:

- `elkTile` emits the tile's named ports after its default ones. `buildElkGraph` checks the ports
  and wires each edge to its own port.
- `graphKey` appends ports only when a tile or line has some, so keys without ports are unchanged.
- `alignLayout` anchors a tile with named ports at its top rather than its centre, so those ports
  sit on grid lines even when `h / 2` is off the grid (a 160px tile, for example). Straightening
  compares each line's actual ports, and routes end at them.
- `Board.tsx` adds one React Flow handle per named port (`id` = the port ID, `top` = `y`) after
  the default handles, in `Tile` and in `BoardSnapshotView`. Edges get `sourceHandle` and
  `targetHandle`. `snapshot()` carries the ports.
- `BoardLine` and the arrowheads needed no change, because they already follow the routed ends.
- **Banded pipeline:** `layoutBands` rejects any named port with "A banded layout does not take
  named ports yet."

**Identity gate.** Before editing, at `e72c293`, I recorded the full results for the four studies
and `field-projects/youtube/v2/inputs/design.json`, using real ELK through `createLayoutEngine`
and `laneLayoutInput(laneGraph(design))`. For each input I recorded:

- the banded `BoardLayout`;
- a relayout using the shown positions as hints;
- a flat layout and a flat relayout without bands;
- `graphKey`;
- three `buildElkGraph` outputs (banded, stable and flat);
- every ELK input graph.

After the changes, all five files were **byte-identical**. The scratch files are outside the
repository. `elkGraph.golden.json`, generated at `e72c293`, pins `buildElkGraph` and `graphKey`
for a port-free input.

**Tests.** Four new tests:

- `layout.test.ts` "named ports":
  - the golden;
  - an empty port list gives the same key, and a moved port changes the key;
  - a real-ELK flat board: a 256×160 hub whose out ports at 64/96/128 lead to three tiles, and a
    sink with named in ports at 32/160 plus a default line. Every line starts and ends at its
    port, on the grid, orthogonal and through no tile, and its last run enters level. Default
    lines stay at mid-height, and a relayout is unchanged;
  - unknown, wrong-side, off-grid and banded inputs are rejected.
- `board.test.tsx`: with real ELK, the drawn paths and arrow tips are at the ports, the handles
  are at their heights, and the snapshot carries the ports.

**Checks.**

- `pnpm check` exited 0: **474 tests in 71 files**.
- **41 native E2E tests passed (1.6m).**
- The web build passed, with the existing chunk-size advisory.
- I ran a scripted Chromium mouse check at 1440×900 on the running dev app, using my own TinyURL
  extended (11 tiles, 12 lines) and YouTube (21 tiles, 25 lines) projects:
  - every drawn tile transform and line path matched the `e72c293` layout exactly;
  - clicking a tile and a line selected them;
  - Fit gave 0.56 and 0.38 with both rails open;
  - there were no page or console errors.

  I deleted both projects, and the owner's six project revisions are unchanged.

**For UI05.** Remove the guard in `layoutBands` (`bands.ts` 395–397). These places still assume
the mid-height or default port:

- `bands.ts`:
  - `layoutBand`, lines 248–259:
    - `elkTile(t)` now also emits a tile's named ports;
    - the edges use `outPortId(l.source)` and `inPortId(end(l))`.
  - `port()` at line 268: track wants and per-column tile keys use `h / 2`.
  - `placeLoose`, lines 348–363: centres on `h / 2`.
  - `portIds`, line 378: per-band IDs are derived from the default IDs. Keep them for default
    ports only.
  - `layoutBands`:
    - line 436: `elkTile(t, ins.all, outs.all)`;
    - line 440: `portY` at `h / 2` for the track section's start and end;
    - lines 444–445: the edge ports.
- `junctions.ts`:
  - `sharedPort`, line 32: `mid()` uses `h / 2`.
  - `meetAtPorts`, lines 187–191: `entering` groups lines by target tile, not by port.
- `returns.ts`:
  - `bestU`, line 98: `ys` and `yt` use `h / 2`.
  - `routeReturns`, lines 291–300: the `shortest` estimate uses `h / 2`.
  - `judge`, lines 194–195: `fromSource` and `intoTarget` compare tiles, not ports.
- `branches.ts` has no direct assumption, but it scores with `bandClashes`.

`alignLayout` already handles named ports in both of the band pipeline's align passes. A tile
with named ports keeps its default port on the grid only when `h / 2` is a multiple of 32. UI06's
containers should therefore use their header port, not the default port, as the plan already says.

## 2026-11-09 — UI05: board ports through bands and returns

Per the [UI overhaul plan](plans/ui-overhaul/units.md), named ports (UI04) now work in the banded
pipeline the lane canvas always uses. No caller uses them yet, so Jeeves looks the same. The rules
are in the file headers of `layout/bands.ts`, `junctions.ts`, `returns.ts`, `branches.ts` and
`elkGraph.ts`.

- `layoutBands` no longer refuses named ports. It runs `checkPorts`, so a bad port throws as in the
  flat layout. A named port is used at its own height everywhere: the band's ELK pass, long-line
  tracks, the routing pass's edges and track sections, `meetAtPorts` and `routeReturns`.
- **Split ELK ports are default ports only.** Out of a tile they stay per band. Into a tile they
  are per band *and* per named source port (`bundleOf` in `bands.ts`). This was not in the plan's
  wording, and I added it for the plan's own test: without it, ELK bundles two rows' lines into one
  store as one hyperedge and they share a stem whenever the store sits above or below both rows. A
  named port is never split, whichever bands use it.
- **Junctions** (`sharedPort`, `meetAtPorts`) group lines by the port they actually use, so a
  junction is a port, not a tile. Two lines into different named ports of one tile get no shared
  window. The junction rule itself stays per band. I tried making it "per band and named source
  port", but then three or more such lines into one port cannot all meet within 32px (v2's
  metadata database takes five module lines), and returns fell back to rule-breaking routes.
- **Returns** (`bestU`, the `shortest` estimate, `judge`) leave and enter at the ports' heights.
  `judge` exempts lines from the same *source port* and into the same *target port*, not the same
  tile.
- **`separateBranches`** needed no code change: its first and last points never move, and its
  clash score is now port-aware through `bandClashes`.
- `placeLoose` centres a tile without a band on the ports its lines enter, and snaps it by
  `gridAnchor` (exported from `align.ts`; it was `anchorOf`). `endColumns` and the
  stores-beside-their-users rules are unchanged.

**Identity gate.** Before editing, at `55a8c9b`, I recorded every layout with real ELK through
`createLayoutEngine` and `laneLayoutInput(laneGraph(design))`. The inputs were the four studies,
`field-projects/youtube/v2/inputs/design.json`, and the `lanes`, `back` and `widen` band fixtures
from `layout.test.ts`. For each input I recorded:

- the banded layout and a relayout from the shown positions;
- a flat layout and a flat relayout;
- `graphKey`;
- three `buildElkGraph` outputs;
- every ELK input graph.

After the changes, all 8 files were **byte-identical**. UI04's own gate script also gave
byte-identical output for its 5 inputs, and the HEAD files matched UI04's "after" files.
`elkGraph.golden.json` still passes. The scratch files are outside the repository.

**Fixture** (`layout.test.ts`, "named ports in bands"): a detailed-shaped board.

- The upload band's 256×160 `hub` has in ports at 32 (header) and 64 (consumer), and out ports
  at 32, 96 and 128.
- The writer and outbox rows both write `meta`.
- The header's line comes back to the shared `db`.
- The download band's `watch` enters the header.

The fixture has 11 lines, **2,560px** of line, **1 crossing** (the U's level run crosses `watch`'s
entry), 0 clashes, and draws 1,312×704. The tests check that:

- every line starts and ends at its port, orthogonal and through no tile;
- the bends are on the grid. The one exception is the U's level run, which crosses the 32px gap
  between the shared and upload bands half a step off the grid, by the existing rule (the YouTube
  study already has 10 such bends). The test asserts that exactly;
- the U leaves level at the header's height;
- lines into one port from different ports meet only in the last 32px;
- `u` is centred between the ports it enters;
- a relayout is unchanged.

Two cheap extra cases are also tested:

- **Two bands into one named port.** The hub is a row lower, so `meta` is above both of its rows.
  The two rows' lines turn in separate slots and meet only in the last 32px: 12 lines, 3,200px,
  1 crossing.
- **Two returns from different rows into one store.** 12 lines, 3,648px, 4 crossings. They share
  no run and meet by the port, but **they cross each other twice**: the first U takes the gap's
  only slot, and widening for the second adds the new slot on the source side. The test asserts
  this limit precisely. Fixing it needs a new widening rule, so I left the existing rule alone.
  v2 has this shape twice: the completion handler's writer and publications rows into the
  metadata database, and the transcoder's packager and thumbnails rows into transcoded videos.

The old test expecting a banded rejection now checks that a banded input with an unknown port
rejects.

**Checks.**

- `pnpm check` exited 0: **477 tests in 71 files**.
- **41 native E2E tests passed (1.6m).**
- The web build passed, with the existing chunk-size advisory.
- I ran a scripted Chromium mouse check on the running dev app at 1440×900 and 1280×800, using my
  own TinyURL extended (11 tiles, 12 lines) and YouTube (21 tiles, 25 lines) projects:
  - every drawn tile transform and line path matched the `55a8c9b` layout;
  - clicking a tile and a line selected them;
  - Fit gave 0.56/0.38 and 0.45/0.30;
  - there were no page or console errors.

  I deleted my projects, and the owner's six project revisions are unchanged. One setup problem:
  the running Vite dev server had cached an empty `bands.ts`, because it read the file while a
  script was rewriting it. Touching the file fixed it.

**For UI06.**

- **Give each container named header ports** for tile-level lines (entries, the user's lines,
  relationships no module uses). Port IDs are unique across both sides of a tile, so use, for
  example, `header-in` and `header-out`. A 160px container has its default port at 80, off the
  grid, so no line should use a container's default port.
- Header 48 with rows 32px apart puts the row ports at 64, 96, 128 and so on. Put the header
  port at 32.
- Several rows writing one store draw as separate lines into its port. Each extra slot widens the
  gap by 32px, so expect Detailed to be wider than Overview.
- Lines of one band may still share runs, as in Overview.
- Measure the two-returns crossing on v2 in your layout smoke. Nothing throws for valid ports.

## 2026-11-09 — UI06: detailed view projection

Per the [UI overhaul plan](plans/ui-overhaul/units.md), `jeeves/apps/web/src/canvas/detailedView.ts`
is a pure projection of the Detailed view. Nothing uses it yet, so Jeeves looks the same, and the
Overview path (`LaneCanvas`, `laneLayoutInput`) is untouched. The rules are in the file header.

**API for UI07/UI08.** `detailedView(design, graph, name)` with `graph = laneGraph(design)` and
`name = (id) => laneNodeName(design, graph, id)` (labels use it; passing it in avoids importing
`LaneCanvas.tsx`). It returns:

- `tiles: LayoutTile[]`: `tiles[i]` is `graph.nodes[i]`, as in `laneLayoutInput`. A container is
  `CONTAINER.w` 256 × `64 + 32·rows` with its band and `ports`; every other tile is exactly its
  Overview tile (no ports).
- `lines: DetailedLine[]`: edge order, an edge's lines together. Each is a `LayoutLine` and a
  `LineSpec` as is (test-checked): `id`, `source`, `target`, `sourcePort?`, `targetPort?`, `band?`,
  `dashed`, `directed: true`, `label`, `connection` (the lane edge), `sourceModule?`,
  `targetModule?`, and `removable: false` on the user's lines. Add only `detail` (the connection's
  planned label), as Overview does.
- `containers: Map<tile, { tile, rows }>`, with `DetailedRow = { module, host, name, kind, index,
  y, in?, out? }`: `y` is the row's centre below the container's top (64, 96, …); `in`/`out` are
  its port IDs, absent when no line is drawn there.
- `connectionOf(line)`, `linesOf(connection)`, `rowOf(module)` and `partners(module)` (same-tile
  module links, both directions, in module order).
- Constants: `CONTAINER` `{ w: 256, header: 48, row: 32, padding: 16 }`, `HEADER_PORT_Y` 32,
  `HEADER_IN` `header-in`, `HEADER_OUT` `header-out`, `rowPort(module, side)` `<module>:in|out`,
  `LINE_SEPARATOR` `/`.

Line IDs: an edge without anchors draws one line whose ID **is the edge ID**, as in Overview. An
anchored line is `edge/module` or, with anchors on both sides, `edge/sourceModule/targetModule`.
Header ports exist only when a line uses them, and no line uses a container's default port.

**Tests** (`detailedView.test.ts`, 10). On TinyURL extended, Marketplace, YouTube and the frozen
v2 `design.json` (imported with `with { type: "json" }` and parsed by `designSchema`, as
`yv2-selections.ts` does; no copy), they check:

- every module is a row of its host once, in module order, at `64 + 32i`;
- containers have grid ports inside them with unique IDs, and other tiles equal Overview's;
- every edge draws ≥1 line in edge order with its dashes and band, and every line maps back;
- line ends use only container ports of the right side;
- every module link to a tile is exactly one line end at its row, and rows have ports only for
  drawn lines;
- IDs are unique and identical on a second run.

The v2 Video lifecycle worker draws exactly the sketch: 3 rows (256×160) and 4 lines.
`completions-handler/handler-consumer` runs Processing events → `handler-consumer:in` (dashed).
`handler-metadata/handler-writer` and `handler-metadata/handler-publications` run from their
`:out` rows to Metadata database. `handler-publication/handler-publications` runs to Publication
events. A synthetic TinyURL case checks pairs (two callers × one callee gives 2 lines),
header ports for an entry and an unused link, a portless row, the user's line and `partners`.
**Layout smoke:** all four Detailed inputs with real ELK finish with every line end at its port on
the grid, orthogonal runs, no line through any tile (its own ends included), and an unchanged
relayout from their own positions.

**Metrics** (real ELK, fresh layout; size is `layout.bounds` with padding; length is `pathLength`;
crossings are `bandClashes`, which found 0 clashes everywhere):

| Design | View | Lines | Drawn size | Line length | Crossings |
| --- | --- | ---: | --- | ---: | ---: |
| TinyURL extended | Overview | 12 | 1024×832 | 2,752 | 0 |
| | Detailed | 12 | 1280×800 | 3,008 | 1 |
| Marketplace | Overview | 23 | 1280×1472 | 6,912 | 1 |
| | Detailed | 25 | 1568×1536 | 8,576 | 4 |
| YouTube | Overview | 25 | 1504×1376 | 8,864 | 1 |
| | Detailed | 26 | 1920×1600 | 12,608 | 4 |
| YouTube v2 | Overview | 27 | 1920×1297 | 10,080 | 3 |
| | Detailed | 30 | 2528×1441 | 17,536 | 12 |

**Routing limits seen.** UI05's two-returns limit: the transcoder's packager and thumbnails
rows into Transcoded videos cross each other **twice in v2** and once in the YouTube study. The
Video lifecycle worker's two Metadata database lines don't cross (one U runs over, one under).
Upload's two and Marketplace's shop/payments pairs don't cross either. Returns from lower rows
make long loops round the worker (v2's lifecycle writer U runs above the database row). Readability
is UI09's to judge. Nothing threw, and no projection change was needed.

**Checks.** `pnpm check` exited 0: **487 tests in 72 files**. **41 native E2Es passed (1.6m).**
The web build passed with the existing chunk-size advisory. Scripted Chromium on the running dev
app at 1440×900, with my own TinyURL extended project:

- 11 tiles and 12 lines rendered;
- clicking Redirect service selected it (inspector title, its lines blue);
- clicking `redirect-db` selected it;
- there were no page or console errors.

I deleted the project (204), and the owner's six project revisions are unchanged.

**For UI07.**

- Selection: map a clicked drawn line with `connectionOf` before `onSelectLine`/removal, and
  highlight `linesOf(selection.line)`. Unanchored lines keep the edge ID, so many IDs need no
  mapping, but anchored ones do.
- **Toggling and hints.** The board relays out from the shown positions. Detailed laid out from
  Overview's positions equals a fresh Detailed for TinyURL, YouTube and v2 but not Marketplace.
  Overview laid out from Detailed's positions **differs from a fresh Overview for all four**.
  Switching back normally hits the engine's 32-key cache, but after an edit in Detailed the new
  Overview key is laid out from Detailed positions. "Same tile positions after switching back"
  therefore needs per-view hints (or none) on a toggle.
- Containers use shape `rect`; a row's centre is `row.y`, 32px tall, below a 48px header.

## 2026-11-09 — UI07: detailed view on the canvas

Per the [UI overhaul plan](plans/ui-overhaul/units.md) (R1), **Overview | Detailed** in the canvas
toolbar (`fieldset.studio-view-toggle`, two `aria-pressed` buttons) switches the whole canvas.
The choice is `view` in `useStudioPreferences` (per project, browser only); nothing reaches the
design, history, blueprint or chat. Docs: `studio.md` (new Detailed view section; Lane canvas,
Layout and navigation, Diagram PNG export, History, Limits) and a playbook lesson.

- **Canvas.** In Detailed, `LaneCanvas` swaps each container's `TileSpec` for the projection's
  size, ports and `tiles/ContainerTile.tsx` face, and feeds `detailedView`'s lines (plus `detail`,
  the planned label). The Overview memo is unchanged. The face: a 45px header (kind icon in the
  family colour, one-line name, `WarningMark`), then `ol > li.lane-container-row[data-module]`
  boxes 24px tall centred on `row.y` (minus the 3px board frame), icon in the module's family
  colour, ellipsised name, full name as `title`.
- **Selection** (`selection.ts`): `canonicalLine(connectionOf, drawn)` maps a clicked or removed
  drawn line to its relationship; `drawnSelection(linesOf, selection, clicked?)` gives the board
  one selected drawn line (the clicked one, else the first) and the rest as `highlighted`. The
  workspace only ever holds canonical IDs, so the inspector, chat, removal, diagnostics and Undo
  are unchanged; the selection, including `selection.module`, survives a switch.
- **Board** (generic, documented in `Board.tsx`, `useBoardLayout.ts`, `useAnimatedLayout.ts`):
  - `view?: string`: `useBoardLayout` keeps each view's last shown layout and hints a request only
    with the same view's positions (one view behaves exactly as before), and reports which view
    its layout belongs to. Until the new view is laid out the board keeps drawing the previous
    view's tiles and lines; the move then animates however far tiles go (`MODEST_MAX_PX` is
    skipped across views), lines new to the view follow their tiles via the fallback route until
    the move ends, and the camera fits once it has settled.
  - `highlighted?: readonly string[]`: lines drawn in the selection colour over the rest, like a
    selected tile's own lines; selects nothing, no X.
  - The previous tiles' ports stay as invisible handles until the tiles change again: React Flow
    takes new nodes before new edges, and without this a switch back to the Overview logged dev
    warnings (#008, handle not found) for every module line.
  - No layout file changed; `elkGraph.golden.json` passes.
- **Export** follows the view (`ExportDiagram`'s `view`). Detailed: filenames end `-detailed` and
  the details' `view` gains `canvas: "detailed"` and a `modules` note. Overview: no new fields.
  The e2e export helper moved to `e2e/export.ts`.

**Overview identity.** Before editing, at `d9b8cae`, a scripted export of a fresh YouTube study
(1440×900, dev app) gave, twice, PNG
`472a4c8cf3f8eadf8f7c9f2dc79e20f37b19a3656abcb4587dda9b3f6d33dc9f` and details (without
`capturedAt`, `renderer` and the project ID) hashing
`7cf77b11a98b71a98cefe2ec237fbfa5ac229a1563f672e7fcc1858fafbfd8b9`. After the change the same
script gave the identical PNG, details and tile positions.

**Tests.** `board.test.tsx` +1: a first switch requests no hints, the old view stays drawn until
the new one lands, an edit in the detailed view is hinted with its own positions and the next
Overview edit with exactly the Overview's, and `highlighted` inks a line without selecting it.
`selection.test.ts` +3: canonical mapping, drawn selection (elsewhere/clicked/other line/tile),
and a round trip of every YouTube drawn line (25 relationships, 26 lines, pinned for the e2e).
New `detailed-view.spec.ts` (4 tests):

- YouTube by mouse: the toggle, Transcoder's 5 rows (256×224), 26 lines, all tiles inside the
  canvas after the fit, `transcoder-write/transcoder-thumbnails` opening "Stores segments,
  playlists and thumbnails" with both drawn lines blue, chat selection `["transcoder-write"]`,
  the selection across both switches, X removing both drawn lines and Undo, the cut-off refusal
  on a module line, the container's X panel (Cancel) and an Add after → Cache plus Undo, an open
  module surviving a switch, then the Overview's exact tiles and line paths, and Detailed
  surviving a reload; design and blueprint equal apart from the revision.
- TinyURL extended with declared ownership: a module line's X opens "Remove relationship
  declarations"; Remove and Undo.
- TinyURL foundation: identical tiles, line paths and camera in both views, no containers.
- Export: Overview, Detailed (`-detailed` names, `canvas`, 21 tiles, 26 lines, different PNG),
  Overview again with identical PNG bytes and details.

**Checks.** `pnpm check` exited 0: **491 tests in 72 files**. **45 native E2Es passed (1.8m).**
The web build passed with the existing chunk-size advisory. Scripted Chromium mouse checks on the
running dev app at 1440×900 and 1280×800 with my own projects (TinyURL foundation, YouTube and a
project seeded from `field-projects/youtube/v2/inputs/design.json` through `/operations`):
TinyURL rendered 7 tiles and 7 lines in both views; on YouTube a container and a module line
selected, the line's X removed it (26 → 25 lines) and Undo restored it; the chooser listed
"Packager (Transcoder) to Transcoded videos" and "Thumbnailer (Transcoder) …" next to the CDN's
line; dark mode read correctly; no page errors and no console errors or warnings. All my
projects were deleted (204). Evidence: `plans/ui-overhaul/evidence/ui07/` (YouTube Overview and
Detailed, a selected module line, v2's Video lifecycle worker).

Fit zooms (rails: none / chat / inspector / both):

| Design, view | 1440×900 | 1280×800 |
| --- | --- | --- |
| YouTube Overview | 0.39 / 0.39 / 0.39 / 0.38 | 0.35 / 0.35 / 0.35 / 0.30 |
| YouTube Detailed | 0.34 / 0.34 / 0.34 / 0.29 | 0.30 / 0.30 / 0.30 / 0.23 |
| v2 Overview | 0.43 / 0.40 / 0.39 / 0.28 | 0.37 / 0.34 / 0.34 / 0.23 |
| v2 Detailed | 0.38 / 0.30 / 0.29 / 0.21 | 0.33 / 0.26 / 0.25 / 0.20 (floor, not whole) |

**v2 against the sketch.** The Video lifecycle worker is a 256×160 container with Processing
consumer, Lifecycle writer and Publication outbox publisher. Processing events → the consumer row
(dashed) and the outbox row → Publication events (dashed) match the sketch. Both rows' lines to
the Metadata database differ: the database is upstream (top left), so the writer's line runs up
and over the worker and the outbox's runs under it and back, instead of the sketch's two short
lines into a database to the right.

**For UI08.**

- Row hook: `li.lane-container-row[data-module]` in `ContainerTile`, built inside `LaneCanvas`'s
  `detailed` memo, which has the projection (`rowOf`, `partners`). Rows are inert now; a click
  falls through to the container (`onSelectTile`). Add `onOpenModule(host, module)` to
  `LaneCanvas` and call `Workspace`'s `select({ tile: host, module })`. In Hand mode nodes already
  take `pointer-events: none`.
- Module selection meets the canvas in `LaneCanvas`: `selected` is the `WorkspaceSelection`, so
  `selected.module` is there; `drawnSelection` currently drops it. Passing the open module to
  `ContainerTile` changes the tiles' identity but not the layout key, so no relayout.
- Highlight: `Board`'s `highlighted` takes any drawn line IDs (filter `projection.lines` by
  `sourceModule`/`targetModule`). Note the board also inks every line of `selected.tile`, so with
  a host selected all its lines are already blue; showing only the module's lines needs either
  another generic prop or a different board selection while a module is open.

**For UI09 (readability seen).**

- At the fit nothing in a container is readable (row text about 4px at 0.34); Detailed is for
  zooming in. v2 at 1280×800 with both rails stops at the 0.20 floor and is cut off.
- Rows returning to an upstream store loop round their container (v2's lifecycle worker above;
  the Transcoder's encoder, packager and thumbnailer lines come back up and left to Original and
  Transcoded videos), and the two Transcoder rows into Transcoded videos cross (UI05's limit).
- Choose relationship lists both drawn lines of one relationship (both select the same thing).
- The header's family-colour rule (45%) is faint; row boxes leave 10px between the frame and the
  row, so a line's arrowhead stops at the frame, not at the row box.
- During the 200ms switch, lines new to the view are drawn as right-angle fallbacks between their
  moving tiles; they snap to their routes at the end.

## 2026-11-09 — UI08: interactive modules on the canvas

Per the [UI overhaul plan](plans/ui-overhaul/units.md) (R4), a container's row is its module.
Docs: `studio.md` (Lane canvas, Detailed view, Inspector, Limits) and a playbook lesson.

- **Rows** (`tiles/ContainerTile.tsx`): each `li.lane-container-row[data-module]` holds a
  `button.lane-container-row-button` named "Open <module> in <host>" (`aria-current` while open,
  a 3px `--board-select` outline on `:focus-visible`, the family colour on hover). A click stops
  at the row, as the board's own tile buttons do, and calls `LaneCanvas`'s new `onOpenModule`,
  which `Workspace` maps to `select({ tile: host, module })`. In Hand mode the board's
  `pointer-events: none` on tiles lets the pointer through, so a drag pans and nothing opens.
- **Marks** come from a React context, `ModuleRows` (open module, partners, `onOpen`), provided
  around the board by `LaneCanvas`. The tile specs don't change when a module opens, and a diagram
  export (`BoardSnapshotView` in its own root) gets no context, so it shows no marks: the e2e
  checks the Detailed PNG is byte-identical with and without an open module. `data-mark="open"`
  fills the row in the selection colour (32%), rings it 2px and bolds the name; `"partner"` is a
  blue border only.
- **Highlight sets** (`selection.ts`): `drawnSelection(projection, selection, clicked?)` now
  takes the projection and the `WorkspaceSelection` and returns `{ selected, highlighted,
  selectedTileLines, rows? }`. With a module open: the host stays the board's selected tile,
  `highlighted` is the lines whose `sourceModule`/`targetModule` is the module,
  `selectedTileLines: false`, and `rows = { open, partners: partners(module) }`. Lines and plain
  tiles are as in UI07. In the Overview nothing changes: an open module keeps its host selected
  with all its lines blue.
- **Board** (generic, documented in `Board.tsx`): `selectedTileLines?: boolean` (default true).
  False keeps the selected tile, its pull tabs and X, but leaves its own lines plain, so
  `highlighted` alone colours (and raises) lines. `lineEdges` takes it as a last parameter; the
  snapshot path uses the default. No layout file changed; `elkGraph.golden.json` passes.

**Tests.** `board.test.tsx` +1: a selected tile's lines are blue by default; with
`selectedTileLines={false}` only `highlighted` ones are, the tile keeps its `selected` class and
its X, and no line is selected. `selection.test.ts` +2 (the UI07 cases now also pin
`selectedTileLines: true`): YouTube's Packager highlights only
`transcoder-write/transcoder-packager` (not the Thumbnailer's line of that relationship) with
partners encoder and done; View summer (no drawn line) highlights nothing but marks its two
partners; another tile's module is not open; v2's Publication outbox publisher highlights both of
its lines and the Lifecycle writer only `handler-metadata/handler-writer`. `detailed-view.spec.ts`
+1 test on YouTube, by mouse: a Packager row opens its page (Name, Back, host selected with its X),
only its line blue, its row `open` and encoder/done `partner`, `aria-current`; chat's selection
`["transcoder-packager"]`; another row moves the marks; Back clears them and all five Transcoder
lines turn blue; the Thumbnailer card marks its row and line; the Overview keeps the host's four
lines blue and switching back restores the marks; another tile and empty paper close the module
(also on the Completion handler's Video writer); in Hand mode a row click opens nothing and a drag
from it pans; design, revision and blueprint unchanged; no page errors. The UI07 export test now
also exports Detailed with a module open and gets identical PNG bytes and details.

**Checks.** `pnpm check` exited 0: **494 tests in 72 files** (lint: only the existing info in
`local-v2/assets/scripts/local.mjs`). **46 native E2Es passed (1.8m).** The first full run had one
failure in `operations.spec.ts` (`clickLine` on `upload-shorten` right after a tile removal landed
on paper under load, in the Overview); it passed 3/3 alone and in the full rerun. The web build
passed with the existing chunk-size advisory.

Mouse check: scripted Chromium at 1440×900 and 1280×800 with my own TinyURL extended, YouTube and
v2 (`field-projects/youtube/v2/inputs/design.json` through `/operations`) projects, all deleted
afterwards (204). The owner's six project revisions are unchanged.

- TinyURL rendered 11 tiles and 12 lines in both views (4 containers). Cache reader's row opened it
  with only `redirect-cache/redirect-cache-reader` blue and its two partners marked.
- YouTube: as in the e2e, plus dark mode (Segmenter and encoder: the row is filled, only
  `transcoder-read/transcoder-encoder` is blue, three partners).
- v2: Lifecycle writer → only `handler-metadata/handler-writer`; outbox publisher → its two
  lines; no partners (v2 has no in-process links).
- A Tab from a clicked row focuses the next row with the outline.
- No page errors, console errors or warnings.

Evidence: `plans/ui-overhaul/evidence/ui08/` (v2 Lifecycle writer open, YouTube Packager open with
partners, dark mode at 1280, the focus outline).

**Environment notes.**

- A stray `biome format` run from `jeeves/` (no config there) briefly reformatted about 70 files.
  I restored every file outside this unit with `git checkout` (none had other edits) and reapplied
  my edits to HEAD copies.
- The running `pnpm dev` web server on 4300 lost its file watch on `Board.tsx` when the checkout
  replaced it, and kept serving the HEAD board (all host lines blue with a module open). I checked
  on my own Vite (port 4320, same API, started with `--force`, which rebuilt the shared
  `apps/web/node_modules/.vite` deps cache) and stopped it. Restart `pnpm dev` to see UI08 on 4300.
- Pre-existing, for UI10: after a pan drag in **Hand** mode, the next click is sometimes swallowed
  (stopped in the window's capture phase, as d3 does after a drag). Clicking Select needed a second
  click. I reproduced it in the Overview on TinyURL on both servers; a Select-mode pan didn't do it.

**For UI09 (readability seen).**

- At the fit a row is about 66×6px (Segmenter and encoder, 1440×900, both rails). It can be
  clicked but is a small target; zoom in to use rows.
- The selected container's pull tabs (+ and attach) sit over the right end of its middle rows
  (Transcoder's Segmenter and Packager; v2's Lifecycle writer and outbox publisher) and over the
  start of their lines. The red X sits on the header text.
- The partner mark (blue border) is quiet in both themes. The open row's fill is clear in light
  mode and weaker in dark mode, where it relies on the ring and bold name.
- An open module's line can be a long loop. The Packager's runs up and round to Transcoded videos,
  and the Lifecycle writer's runs up over the worker to Metadata database. Arrowheads still stop
  at the frame, 10px from the row box.

## 2026-11-09 — UI09: tune detailed view readability

Per the [UI overhaul plan](plans/ui-overhaul/units.md), a readability pass on the Detailed view and
the inspector: faces and CSS only, no behaviour, layout, schema, blueprint, chat or generation
change. Before/after values, images and the ranked open issues are in
[evidence/ui09](plans/ui-overhaul/evidence/ui09/README.md).

- **Containers** (`tiles/ContainerTile.tsx`, `canvas.css`): row frames at 50% line colour (was
  30%); row boxes 26px (was 24) with 14px names (was 13); header name 15px (was 14) above a 2px
  divider in the line colour at 40% (was 1.5px family colour at 45%). **Port marks**: a row with a
  drawn line carries `data-ports="in|out|in out"`, drawn as a 2.75px stub (the line width) from the
  frame to the row's box, so a line that ends at the frame visibly reaches its module. They turn
  blue for the open row, and for a selected container without an open module (`data-open` on the
  container says one of its rows is open). Partner rows: full selection-colour border, inner ring,
  10% tint (18% dark); open row fill 55% in dark (32% light). A container's pull tabs use
  `--board-tab-peek: 36px` (app CSS on container nodes only), so they sit outside the frame
  instead of over the rows' right ends.
- **Inspector**: module cards tighter (padding 8/10, gap 6) with a line-colour border that shows
  on the dark rail; the section rules likewise. The system page's **Add a supported feature**
  (`PresetAttachment`) is a section like Options/Modules (`.studio-feature`: rule, 13px legend,
  `studio-form-field` select, full-width `.studio-feature-action` buttons); same elements, labels
  and order.
- **Kept**: width 256, header 48, pitch 32. A 64px pitch made YouTube 1,920×1,984 (from 1,600
  tall) and v2 2,528×1,824; 224px containers saved 96px of YouTube's width and cut "Publication
  outbox publisher" short. All Overview and Detailed layouts of the four designs are byte-identical
  to `6bf1fda`, so UI06's metrics stand (now in `studio.md`, Size and fit).
- **Overview identity**: a mouse export of my YouTube study at 1440×900 gave PNG
  `472a4c8c…dc9f` (UI07's hash) before and after, with identical details and tile positions. No
  board file changed; `elkGraph.golden.json` passes, and a scratch dump of the Overview and
  Detailed layouts of the four designs (real ELK) is byte-identical to the parent's.
- Tests: `tiles/ContainerTile.test.tsx` (1): port marks follow `in`/`out`, the open/partner marks
  and `data-open` come only from the live context, an export face has marks for ports only.
- Docs: `studio.md` (Detailed view, new Size and fit tables, Limits), playbook lesson,
  HUMAN_FEEDBACK resolution update, plan status line.

**Fit zooms (Detailed; rails closed / both open, 1440×900 then 1280×800):** TinyURL extended
0.70/0.44, 0.62/0.35; Marketplace 0.35/0.35, 0.31/0.28; YouTube 0.34/0.29, 0.30/0.23; v2
0.38/0.21, 0.33/0.20 (floor; every tile and line still inside the canvas, so not cut off as UI07
reported). Overview: 0.67/0.56, 0.59/0.45; 0.37/0.37, 0.32/0.32; 0.39/0.38, 0.35/0.30; 0.43/0.28,
0.37/0.23. Unchanged by this unit.

**v2 against the sketch at 100%:** the container, its three rows, Processing events → consumer and
outbox → Publication events match, and each line now reaches its row. The two Metadata database
lines do not: the database is upstream, so they loop over (1,280px) and under (1,312px) the worker
instead of the sketch's two short lines to the right (stores-beside-their-users rule; documented).

**Checks.** `pnpm check` exited 0: **495 tests in 73 files** (lint: only the existing info). An
earlier run had 3 generator tests (`jeeves-generator/src/v2`) time out at 5s under a load average
of about 14 from other sessions; they passed alone and in the full rerun. **46 native E2Es passed
(2.5m).** The web build passed with the existing chunk-size advisory. Mouse check: scripted
Chromium on my own Vite (port 4320, the owner's API) at 1440×900 and 1280×800 with my own projects
(all five deleted, 204; the owner's six revisions unchanged):

- TinyURL extended rendered 11 tiles and 12 lines in both views (4 containers, 7 rows with ports).
- YouTube: clicking the Transcoder's header selected it; its Add after and Attach tabs sit at
  -4..36px from the frame and overlap no row; its port marks were blue. The Packager row opened
  Packager (open mark, encoder and completion publisher partners; only Packager's mark blue). Dark
  mode by its button filled the open row. A pulled Add after tab opened the fan; Escape cancelled.
- Empty paper showed the system page; Preview attachment showed its summary and Attach feature in
  the new section style (not attached). Design and blueprint unchanged; no page or console errors.

**For UI10.**

- Behaviour issues left for the review: **Choose relationship** lists both drawn lines of one
  relationship (both select it); after a Hand-mode pan the next click is sometimes swallowed.
- Check by eye: port marks at 100% on all three studies and v2, light and dark; the container tab
  peek (`canvas.css`, `:has(> .board-tile-host .lane-container)`) with a pull and a drop; the
  system page's feature section through Preview and Attach feature on a throwaway project.
- Known and documented, not changed: upstream-store loops (v2 worker, 1,280/1,312px), the two-row
  crossing into Transcoded videos, the red X over a long container name, port marks that stay
  dark when a line is blue only because another tile or the relationship is selected.

## 2026-11-09 — UI10: review UI overhaul

I did an independent review of UI01–UI09 against the owner's images, by mouse at 1440×900 and
1280×800. I used my own API (4331, scratch database `jeeves_ui10`, now dropped) and Vite (4321) on
TinyURL extended, Marketplace, YouTube and a v2 `design.json` project. Dropping the database
removed every project; the owner's `jeeves` database was not used.
The full write-up is [review.md](plans/ui-overhaul/review.md): R1–R6 are all delivered. In R1 the
Metadata database lines loop round v2's worker instead of the sketch's short lines.

**Invariants.**

- The YouTube Overview PNG is `472a4c8c…dc9f` at HEAD. It is byte-identical to an export from a
  `git archive` copy of `091488e` run by its own Vite in scratch. The details differ only by UI01's
  "; focus omitted".
- A real-ELK dump of five designs (banded, relayout, flat, `graphKey`, `buildElkGraph`) is
  byte-identical at `091488e` and HEAD.
- Design, revision and blueprint are unchanged by views, selection and modules on 4 designs × 2
  sizes.

**Fixes.**

- `LineSpec.group` (board, generic): the chooser offers each group once, and a click on one group
  selects without asking. Detailed lines set `group: connection`; Detailed capture details carry it
  too.
- `DrawnSelection.lit` and `data-lit` on rows: port marks are blue whenever their line is. This
  replaced `data-open` and its CSS.
- `.studio-tools { width: max-content }`: the toolbar no longer wraps at 1280×800, nor at 1440×900
  with both rails open.
- `clickLine` (e2e) waits for the route and camera to stop. The `operations.spec.ts` flake was the
  200ms animation after `ready`: with 80ms between reading and clicking, the old helper missed 6/6
  and the new one hit 6/6.
- Docs wording: `studio.md`, `studio-settings.md`, `CATALOG.md`.
- Playbook lesson; plan status; HUMAN_FEEDBACK resolution.

Kept, with reasons in the review: the 36px container tab peek (real pull and drop checked) and
solid port marks on dashed lines. The Hand-pan click is lost only within 50ms of release, in both
modes, and also at `091488e`.

**Checks.**

- `pnpm check` exited 0: **497 tests in 73 files**. New: a board chooser test, which fails without
  the fix, and a `selection.test.ts` case.
- **47 native E2Es passed (1.9m)**, including the new `detailed-view.spec.ts` chooser/port-mark/
  toolbar test. `operations.spec.ts --repeat-each 3` passed 6/6. An earlier run under synthetic
  load (10 busy loops, load average 27) failed every test on timeouts. It was not a valid
  reproduction, and the loops were stopped.
- The web build passed, with the existing chunk-size advisory.
- No page or console errors in any mouse run.

**Not mine, left untouched:** the owner edited the root `README.md` and added `.docs/ui-v2/` during
this unit. Neither is staged.

**Next (owner).** These are ranked follow-ups in the review:

1. upstream-store loops (layout rule);
2. rows read only from about 0.6 zoom;
3. two-row crossings (layout rule);
4. where a container's X goes;
5. the generator test timeout;
6. pre-plan dead `OperationsForm`/`OwnershipForm` and nine unused CSS classes;
7. the Generate project button font.

The plan is complete.

## 2026-11-09 — Module authoring plan from owner feedback

This entry is planning only; no code changed. After the UI overhaul (UI01–UI10), the owner
decided modules are the unit of generated code, and that YouTube v2 must be buildable from
scratch by mouse.

I wrote the [module authoring plan](plans/module-authoring/units.md) (MA01–MA10). It records the
owner's decisions and the v2 rebuild's names and descriptions. It also maps what is missing
today:

- **Tile kinds:** the fan can't create Search index, CDN, Identity or Uploads, and Worker appears
  only automatically.
- **Modules:** there is no module creation UI.
- **Generation:** it is tile-level only, with no stubs.
- **Declarations:** generation needs ownership declarations that only the preset writes.
- **Templates:** each of the 7 installed templates spans several modules.

MA01 is a contract-only unit, and the owner must approve it before MA05. I also added a
HUMAN_FEEDBACK entry.

I ran no checks: only docs changed. The owner's uncommitted `README.md` and `.docs/ui-v2/` are
untouched. I restarted the owner's dev servers on 4300/4310 at the owner's request.

Next: MA01 only.

## 2026-11-09 — MA01: module and generation contract

This unit is docs only; no code changed. I wrote the
[contract](plans/module-authoring/contract.md) for owner approval, and revised MA05–MA08 and the
status line in [units.md](plans/module-authoring/units.md).

- **Recommendation:** responsibility modules, with one lead kind per template. A template is
  selected only by its lead; generic Data access, Event consumer, Event publisher and Auth guard
  fill its other slots. Everything else is a stub.
- **Catalog:** 18 kinds (8 new; Video encoder, packager and thumbnailer are video-specific).
- **v2:** all 22 modules map (20 template, 2 stub). The rebuild needs Upload API → Identity and
  one in-process link, Cache reader → Data access.
- **Fan:** 11 kinds; Gateway is not offered.
- **Open questions:** six, each with a default.

**Unit changes**

- **MA05:** gains the derivation (selections, fixed values, initial values, ownership), the
  `module-stub` record and pinning `youtube-core`.
- **MA06:** gains the loader drag and its gutter arrow.
- **MA07:** stub files, and `modules` in the report only for module-level designs.
- **MA08:** lead targets, an equivalence test against v2's seven selections, and retiring "Add a
  supported feature" if the owner agrees.

**Findings for the next units**

- **v2 export:** a fresh v2 export's `.jeeves/manifest.json` and `report.json` hash every file in
  `packages/spec/src`, `jeeves-generator/src/v2` and `templates/local-v2`
  (`templates/local-v2/index.ts:52-63`).
  - MA02's description edit will change those two files. The other 70 stay identical (contract
    §8, question 1).
  - Today's export matches `generic-export.tar.gz` byte for byte, because spec src is unchanged
    since `8813523`.
- **`youtube-core`:** it is computed from the whole template catalog
  (`generation-catalog.ts:120-123`). Adding any template or policy before pinning it blocks v2's
  export.
- **v1 export:** v1's input check rebuilds blueprint v3 (`jeeves-generator/src/input.ts:170`).
  Don't change existing kinds' targets, `thirdParty`, `requires` reasons or settings schemas.
- **For MA04:** `CATALOG.md`'s link table says HTTPS and Service identity, but the code gives HTTP
  and Private network (`studio-links.ts:88-89, 292`). Correct it when MA04 edits `CATALOG.md`.
- **For MA09** (section not revised): the contract's §3 differences list the extra tile link and
  module links.
- **For MA02:** MA02 may drop `partners`. MA06 draws only the loader link.

**Checks**

- The generation, resolver, operations, modules, ownership, generator v2, supported-authoring
  and generation-v2 route tests: 21 files, 88 tests passed.
- `pnpm check` exited 0: 497 tests in 73 files, lint showing only the existing info.
- A scratch export of the frozen v2 design gave 72 files, identical to the recorded archive.
- No e2e or browser checks were run, since this unit is docs only.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

Next: owner approval of the contract before MA05. MA02–MA04 may run meanwhile.

## 2026-11-09 — MA02: drop partner marks and tighten kind descriptions

Per the [module authoring plan](plans/module-authoring/units.md) (Owner decisions 8 and 9).

- **Partner marks removed.** Opening a module marks only its own row (`data-mark="open"`) and its
  own drawn lines. Gone: `DetailedView.partners` and its in-tile link scan (`detailedView.ts`),
  `DrawnSelection.rows` (now `open?: string`, `selection.ts`), `ModuleRowsState.partners` and the
  `"partner"` mark (`ContainerTile.tsx`, `LaneCanvas.tsx`), and both `data-mark="partner"` CSS
  rules. Component-to-component links are still skipped by the projection and stay saved.
- **`partners` data not kept.** The MA01 draft contract does not need it. Its one in-process link,
  the Cache reader's loader (§4, question 3), is a directed, slot-specific gutter arrow that MA06
  will project from the saved component-target link. `partners` was undirected and covered every
  in-tile link, which §4 says must not be drawn or decide generation. The contract itself says
  "MA02 may drop `partners`".
- **Kind descriptions** (`studio-components.ts`): Cache reader "Reads from a cache before the
  database.", Data access "Reads and writes one database.", External call "Calls another service
  or external API.", Custom "Your own logic, generated as a stub." No test, fixture, snapshot,
  chat prompt or doc quoted the old text. They reach only chat's catalog summary (`tools.ts:284`),
  not the blueprint (which carries a module's own `description` as `purpose`) and not the UI.
- **Docs:** `studio.md` (Detailed view, Limits), a playbook lesson, a HUMAN_FEEDBACK resolution
  update and the plan's status line. `CATALOG.md` and `studio-settings.md` quote no kind
  descriptions, so they are unchanged.

**Frozen v2 export (interim rule, contract question 1).**

- Before editing, a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` matched
  all 72 files of `generic-export.tar.gz`.
- After the edit, 70 payload files are byte-identical. `.jeeves/manifest.json` and
  `.jeeves/report.json` differ only in source-inventory values for
  `jeeves/packages/spec/src/studio-components.ts` (21,728 → 21,623 bytes, its sha256), plus values
  derived from them:
  - the emitters' and implementations' `sourceSha256`;
  - `registry.sha256`, which hashes the sources plus unchanged emitter descriptors;
  - the manifest's sha256 of `report.json`.

  Nothing else in the export changed. I edited nothing under `field-projects/youtube/v2/`.

**Checks.**

- `pnpm check` exited 0: **497 tests in 73 files**. Lint showed only the existing info in
  `local-v2/assets/scripts/local.mjs`. The test count is unchanged; the partner assertions were
  rewritten, not added.
- **47 native E2Es passed (1.9m)**, including the updated `detailed-view.spec.ts`. Every mark
  check there now expects only `{ <module>: "open" }`.
- The web build passed, with the existing chunk-size advisory.

**Mouse check.** I ran scripted Chromium on my own Vite (port 4320) against the owner's API, at
1440×900 and 1280×800, with my own projects. All six were deleted (204), and the owner's six
project revisions are unchanged.

- TinyURL foundation: 7 tiles and 7 lines.
- TinyURL extended: 11 tiles, 12 lines and 4 containers. Its Cache reader, which links in-process
  with two modules, marked only itself and `redirect-cache/redirect-cache-reader`.
- YouTube Detailed: 21 tiles, 26 lines and 7 containers.
  - Segmenter and encoder: only its row was marked, with `aria-current`, plus only
    `transcoder-read/transcoder-encoder` and its own port mark.
  - Packager: the mark moved to its row alone.
  - Back cleared the mark and lit the Transcoder's 5 lines.
  - The design was unchanged.
- The YouTube Overview PNG at 1440×900 was `472a4c8c…dc9f`, unchanged.
- There were no page errors and no console errors or warnings.

Evidence: [ma02](plans/module-authoring/evidence/ma02/) has Segmenter and encoder open, at 1440
zoomed in and at 1280 at the fit.

**For MA03.**

- `DrawnSelection` now has `open` where it had `rows`, and `ModuleRows` takes `{ open?, lit,
  onOpen }`.
- The contract's §4 still cites `canvas/selection.ts:60, 117` for `partners`. I left that draft
  untouched.
- The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
  `e2e-docker.sh` are untouched and unstaged.

## 2026-11-09 — MA03: connect mode

Per the [module authoring plan](plans/module-authoring/units.md) (Owner decision 3), linking and
unlinking leave the tiles' tabs for **Connect** mode. Docs: `studio.md` (toolbar, Creating and
connecting with a new Connect mode subsection, Removing, Detailed view, Warnings, Limits),
`CATALOG.md`, `PLAN.md`, a playbook lesson, the HUMAN_FEEDBACK resolution and the plan's status.

- **Toolbar** (`Workspace.tsx`): Select (V), Hand (H), **Connect** (C; Tabler link icon,
  `aria-pressed`, title "Connect (C)"), then Fit. Clicking Connect while it is on returns to
  Select; V or Escape does too (Escape is skipped when a drag or a dialog, such as the removal
  confirmation, took it). The mode stays component state: never saved, no history.
- **Board** (generic, `ConnectDrag.tsx`, documented in `Board.tsx`): `BoardMode` gains
  `"connect"`; `BoardProps` gains `ConnectRules`: `canConnect(from, to)`,
  `connectRefusal(from, to)`, `onConnect(from, to)`, `onConnectRefused(from, to)`.
  `useConnectDrag` listens in the capture phase on the board host, so a press anywhere on a node
  (a container's row included) counts; past 6px it is a drag, otherwise a click (it selects). It
  draws the attach tab's scrim (moved here) with holes for the source and the allowed ends, a
  line from the tile's edge to the pointer with the arrowhead at the pointer, red with a tip over
  a refused tile. A release on an allowed tile calls `onConnect`, on a refused one
  `onConnectRefused`; the click that ends a drag is swallowed; Escape cancels. Tile chrome (tabs,
  tile X) shows in select mode only. In connect mode a line under the pointer (`onEdgeMouseEnter`)
  is inked blue, raised, and shows its X where a selected line's X sits; a 150ms grace and the
  X's own pointer enter/leave (`holdHover`/`releaseHover` in the context) keep it while the
  pointer moves onto the X. Fixed lines (the user's) have none.
- **Attach tab removed** everywhere: `creation.tsx`, and in the board `AttachTab`, `canDrop`,
  `onDrop`, `onDropRefused`, `PullState` and the pull's scrim. `CreateTab.glyph?: "plus" | "link"`
  keeps the link glyph and band for MA04's link tab. `overlay.ts` gained `holeRect`, `TARGET_PAD`
  and `rectExit`.
- **Spec**: `attachOptions` (tried both directions) became `connectOptions(design, node)`: every
  other node (user, actions, tiles) with the forward `linkTiles` in the pair's default mode, or the
  refusal; never reversed. The refusal for a link onto an action no longer names the attach tab:
  "Only the user links to Shorten; link Shorten to a tile to give it an entry." `laneLinkRefusal`
  is kept (exported and tested) but no longer used by the app. Chat's `linkTiles` is unchanged.
- **App**: `canvas/connect.ts` (`useLaneConnect`) caches `connectOptions` per source per design;
  a release runs `linkTiles` with a fresh `newLinkId` on the latest design; a refusal goes to the
  studio notice. The notice now has `z-index: 6`: the line legend covered the start of every
  notice, hiding a short refusal ("Links don't lead back to the user.") and its dismiss button.

**Tests.** `board.test.tsx` +2: the drag's callbacks (allowed, refused with its tip, the direction
not reversed, paper, self, Escape, the swallowed click, a short press selects, nothing in select
or hand mode, no chrome in connect mode) and the hover X (only in connect mode, kept on the X,
gone after leaving it, none on a fixed line). `studio-lane-commands.test.ts`: the two attach tests
rewritten for `connectOptions`. New `e2e/connect.spec.ts` (6, TinyURL extended): the keys and
toolbar with design and blueprint unchanged; a drag adds exactly Shorten service → Click events
(async) and Redirect service → Analytics store, two Undo steps; refusals (store onto a service,
onto the user) show the tip and notice and change nothing, as do paper and Escape; a hover X
removes `redirect-db`, Undo restores the design, the user's line has no X, a cutting removal is
refused; a click selects tiles and lines and Hand still pans; Detailed connects from a row and a
row click still opens its module. `spawn.spec.ts`: tab counts updated, the two attach tests moved
into the connect spec, and the action-entry test now drags from Shorten. New e2e helpers
`linePoint` and `dragOnto`.

**Checks.**

- `pnpm check` exited 0: **499 tests in 73 files** (lint: only the existing info).
- **E2E (51 tests):** the first full run had 50 passed and 1 failed:
  `inspector.spec.ts:77` (the system page's outline missed "Warnings"; the test reads it right
  after a line's X without waiting for the save). Alone it passed 3/3, and the second full run
  passed **51/51 (2.0m)**.
- The web build passed with the existing chunk-size advisory.
- YouTube Overview PNG at 1440×900 on my Vite: `472a4c8c…dc9f`, the same with Connect on.
- Frozen v2: a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72 files;
  70 are byte-identical to `generic-export.tar.gz`. `.jeeves/manifest.json` and `report.json`
  differ only in the source inventory of `spec/src/studio-components.ts` (MA02) and
  `spec/src/studio-lane-commands.ts` (this unit), and the hashes derived from them.

**Mouse check** (scripted Chromium on my own API 4332 with scratch database `jeeves_ma03`, now
dropped, and Vite 4322), at 1440×900 and 1280×800, Overview and Detailed: TinyURL foundation 7
tiles and 7 lines; TinyURL extended 11 tiles and 12 lines. In each: C, V, C+Escape, H and the
button behaved; a drag (in Detailed from the Shorten service's Link writer row) added exactly
Shorten service → Click events, async, and Undo removed it; Analytics store → Redirect service
showed "Analytics store can't link to Redirect service. A database can't link onward." as the tip
and the notice and changed nothing; the hover X removed `redirect-db` (Detailed: "Remove Link
reader (Redirect service) to URL database") and Undo restored the connections exactly; a click
selected with no tabs shown; Hand panned. Dark mode read correctly. No page errors, console
errors or warnings. Evidence: [ma03](plans/module-authoring/evidence/ma03/).

**For MA04.** The board has no attach or drop API now. Set `glyph: "link"` on a `CreateTab` for
the link icon (teal band). Connect mode hides all tile chrome. `connectOptions` is the
forward-only per-node helper; `laneOptions` is unchanged.

**For MA06.**

- The source is found by `tileOf` in `ConnectDrag.tsx` (the closest `.react-flow__node`), and
  the line starts at `tileScreenRect(drag.from)`. A row-dot source needs its own end there (an
  element marked inside the node, with its id as `from` and its rect as the start). Ends are
  tiles (`others` in `Board.tsx`), outlined by `tileClass`; a row→row loader needs row ends,
  hit-testing and marks too.
- In Detailed, a module line's hover X still removes the whole relationship (the canonical link,
  as the selected line's X does since UI07). MA06 must send it to `disconnectModule` instead.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-09 — MA04: link fan with every tile kind

Per the [module authoring plan](plans/module-authoring/units.md) (Owner decisions 2 and 4) and
contract §7. Docs: `studio.md` (Creating and connecting, Detailed view, Warnings, Chat, Limits),
`CATALOG.md` (Tile types and the link fan, `addTile`, `linkFanOptions`; the link table now says
HTTP and Private network, as MA01 found the code does), `studio-settings.md`, `PLAN.md`, a
playbook lesson, the HUMAN_FEEDBACK resolution and the plan's status.

- **Link tab** (`creation.tsx`): a selected tile or action has one tab on its right, glyph
  `link`, when at least one kind fits after it. Its fan is a grid of the contract's 11 kinds, a row
  per group (application: Microservice, Worker service, Uploads, Identity; data: Database, Search
  index, Cache, Object storage; messaging: Queue or topic; edge: CDN, External API), each with its
  kind's icon, colour and name (`studioDefinitions[kind]`), greyed with the `addTile` reason where
  refused. A pick runs `addTile` with that kind; the new tile is named after the kind ("Worker
  service", ID `worker-service`). The user keeps its `+` action fan (arc). Stores have no tab.
- **Removed:** the left `+`, `addTile`'s `side: "before"` (now `z.literal("after")`; callers
  unchanged), `insertBefore` and `retargetIncoming` in `@jeeves/board/graph`, `laneOptions`,
  `LaneOption`, `LaneSide`/`laneSideSchema`, `defaultKind`, the tile types' picker icons and the
  unused `api` icon. Kept: the board's `DockSide` and before-side tabs and docking, generic, for
  MA06's module `+`.
- **Board** (generic): `CreateTab.layout: "grid"` and `FanItem.group`; `fanGrid` puts each group
  in a row beside the tab (`FAN_CELL` 104×92, 40px from the tab), `placeGrid` keeps the block on
  the board, and the overlay draws one panel under the cells (`gridBounds`) and a caption under
  each item. Without the panel the translucent items let the tiles show through. In a narrow
  canvas the block moves aside and can cover its own tile; every item stays reachable.
- **Spec** (`studio-tiles.ts`, `studio-lane-commands.ts`): `studioLinkFan` / `studioLinkFanKinds`
  and `linkFanOptions(design, from)` → `{ kind, group, refusal? }` in fan order, using the same
  `addTileRefusal` as the command; `newTileIdentity(design, kind)`.
- **Queue → Worker default removed.** It lived only in the fan's type → kind choice
  (`laneOption` via `defaultKind`); every `addTile` caller already passes an explicit `tile.kind`,
  so no caller's behaviour changes. After a queue the fan now offers both Microservice and Worker
  service.
- **Deviation: `addTile` keeps accepting every tile kind.** It already took an explicit
  `tile.kind`; there was no `type` input, only the fan's types. The contract's 11 kinds are what
  the mouse offers (`linkFanOptions`) and what chat is told (`listStudioDefinitions.linkFan`, the
  addTile instruction). Chat is not refused Gateway, Billing, Redirect or Notifications: the frozen
  chat eval builds and scores a Billing tile (`eval/score.ts:139-143`, `fixtures/synthetic.json`),
  and tests and chat history add Gateway. Refusing them in `buildSupportedAuthoringCommand` is an
  owner call.
- **E2E race fixed** (`inspector.spec.ts`, the system page): it now polls the saved design until
  `stats-read` is gone at `revision + 1`, waits for the line to leave the canvas, and polls the
  outline for the exact list.

**Tests.** Spec: `linkFanOptions` (order, groups, reasons after a service, a store, a queue and
an action, a lane with no action, the cap), every offered kind added by `addTile` with the same
reason when refused, legacy kinds still accepted, `browser` and `side: "before"` refused; the
restitch test now builds its CDN entry with `addTile` + `linkTiles` + `removeLink`; the warnings
test drops its Add-before half. Board: `fanGrid`/`placeGrid` and a grid fan in `Board`
(slots, captions, panel, disabled item, pick); `insertBefore`'s test removed. Chat: the catalog's
`linkFan`, a Worker after a queue by its kind, `before` refused. E2E (`spawn.spec.ts`, 6): the link
tab and its 11 captioned items in 4 rows with no left tab; greyed kinds after a queue with the
reason; a release on a tile changes nothing; an action's link tab adds an Identity entry, Undo,
then the Connect-mode entry; the blank-design actions; and **all 11 kinds built by mouse in a
blank design**, each checked for kind, icon (`svg.tabler-icon-*`), link and selection, then Undo.
`detailed-view.spec.ts` uses the link tab.

**Checks.**

- `pnpm check` exited 0: **504 tests in 73 files** (lint: only the existing info).
- **E2E: 52 passed (2.2m)** on the first full run, no failures.
- The web build passed with the existing chunk-size advisory.
- Frozen v2: a fresh `export:v2` gives 72 files; 70 are byte-identical to
  `generic-export.tar.gz`. `.jeeves/manifest.json` and `report.json` differ only in the source
  inventory of `spec/src/studio-components.ts` (MA02), `studio-lane-commands.ts` and
  `studio-tiles.ts`, and the hashes derived from them (`sourceSha256`s, `registry.sha256`, the
  manifest's hash of `report.json`).

**Mouse check** (scripted Chromium on my own API 4334 with scratch database `jeeves_ma04`, now
dropped, and Vite 4324), at 1440×900 and 1280×800 with both rails open: TinyURL foundation 7 tiles
and 7 lines, extended 11 and 12. On every extended tile with a tab (7) the open fan had 11 items,
each wholly on the board, uncovered, no overlaps, captions unclipped; stores and the user (both
actions present) had none. A Worker service after Redirect service got the CPU icon and the link,
and Undo restored the design exactly; Open link's tab added an Identity entry. No left tab
anywhere. A blank design took all 11 kinds by mouse. YouTube Overview PNG at 1440×900:
`472a4c8c…dc9f`, unchanged; the Transcoder's fan fit too. Dark mode read correctly. No page
errors, console errors or warnings. Evidence: [ma04](plans/module-authoring/evidence/ma04/).

**For MA05.** Spec exports `studioLinkFan`, `studioLinkFanKinds`, `linkFanOptions`; chat's
catalog has `linkFan`. Whether chat should refuse the four kinds the fan omits is open (above).

**For MA06.**

- The left side is free: no tile shows a before-side tab. `CreateTab` with `side: "before"`,
  `layout: "grid"` and `glyph: "plus"` gives a grid ending left of the tab, read left to right,
  with `FanItem.group` rows. An `onPick` returning `undefined` docks nothing.
- A grid item shows only its label as a caption; the description and Template / Part / Stub need
  more (a richer `FanItem` or the tip). 18 kinds in rows of up to 4 make a tall panel
  (`FAN_CELL.h` per row); check it at 1280×800.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — MA05: module catalog and authoring commands

Per the [module authoring plan](plans/module-authoring/units.md) and the approved
[contract](plans/module-authoring/contract.md) §2, §4, §5 and §8. Spec and chat only; no canvas
controls. Docs: `CATALOG.md` (Components), `studio-settings.md` (new kinds, fixed and initial
values), `studio-blueprint.md`, `chat-tool-schemas.md`, `studio.md` (Chat), the generator README,
the plan's status and the HUMAN_FEEDBACK resolution.

**Catalog** (`studio-components.ts`, `studio-modules.ts`):

- There are 18 kinds; the 8 new ones are Multipart uploads, Lifecycle writer, Video encoder, Video
  packager, Video thumbnailer, Event counter, Index writer and Search query.
- Each definition gains `hosts`, `scope`, `slots` (`{ id, targets, module?, use, need, many? }`)
  and `generation` (`lead` with a template, `part` with templates, or `stub`).
- The older ten keep their targets, `thirdParty`, `requires` and settings schemas. Only the
  Lifecycle writer has settings (`poolSize?`, `statementTimeoutMs?`).
- `moduleKinds` follows `hosts`. A Service takes 12 kinds, a Worker 16, Uploads 11, and
  Redirect, Notifications and Billing 10. Identity, Gateway, Browser and resources take none.
- `StudioIcon` gains `progress-check`, `movie`, `stack-2`, `photo`, `sum` and `list-search`.

**Records:**

- `module-stub@0.1.0` and its binding `{kind: "module-stub"}` are added. Its capability has no
  role, resources or settings, the module-capable hosts and every kind as `componentTargets`.
- `youtube-core` is pinned to its 10 templates and 6 policies; its sha256 stays `d4c66f03…`. No
  existing record changed.
- Each of the 7 templates' `componentTargets` is now its lead kind; youtube-* keep `custom`.

**Commands** (`studio-operations.ts`): `addModule`, `connectModule`, `disconnectModule` and
`removeModule`.

- They are in `studioCommandSchema`, so chat uses them through `buildSupportedAuthoringCommand`.
- A module command on a schema-2 design adds `upgradeDesign`, plus an empty generation for the
  local runtime when there is none.
- `removeTile` and `removeLink` re-derive once module-level selections exist.

**Derivation** (`module-generation.ts`): `planModules` is pure; `deriveModuleGeneration` runs
inside the command's batch and returns `setOwnership` and `setGeneration` after `setStudio`.

- **Selections:** a lead with every needed part gets a template selection with the lead's ID.
  Parts get none; every other module gets a stub.
- **Values:** it writes the fixed values only over creation defaults or `unspecified`, and adds
  the initial values.
- **Ownership:** writers of a store share an owner, and a read-only projection host joins it.
  Each owner is named after its group's first host in lane order (`<host>-owner`). It also writes
  authority (cache from loader, index from outbox), widest grants with `published-read`, and
  dependencies.
- **Clean-up:** it removes facts only the previous module-level selections needed, by key.
- **Refusals:** every refusal in contract §5 is in plain words. A kept value it may not overwrite
  leaves the module Refused.

**Status** (`module-status.ts`): `moduleStatuses(design)` and `moduleStatus(design, id)` return
`{ module, host, kind, status, template?, selection?, reason?, unconnected }`.

- **Template** and **Refused** come from the resolver's findings inside the selection's scope; the
  template's not-installed finding is ignored.
- **Stub** says what is missing.
- **Custom** is a module no selection covers.
- Chat's `getDesign` shows each module's status; `listStudioDefinitions.modules` adds `hosts`,
  `slots` and `generation`.

**Deviations, all to keep the result correct:**

1. Stub selections skip the role check and the host-setting audit (contract §6, listed for MA07).
   Otherwise each Watch API stub's audit was blamed on the Cache reader's template.
2. A module a tile-level selection traces gets no stub of its own (mixed designs: the preset's
   modules stay Template).
3. The older component commands (`removeComponent`, `disconnectComponent`) don't derive. The
   inspector's Remove module still sends `removeComponent`; MA06 should send `removeModule`.
4. Clean-up is by key. A hand-made fact that a module-level selection once needed is replaced on
   the next derivation. Contradictions refuse only against facts no module-level selection
   needed, or that tile-level selections need. Facts named by a kept grant or projection stay.
5. A search index is a projection only when its outbox database is written by a template, or
   declared as a source. Otherwise its Index writer stays a stub with the reason, which keeps the
   ownership valid.
6. Effect on older studies: a module command on TinyURL extended or the YouTube study derives
   its Cache reader's cache read, because its loader link exists. Its status is Refused, because
   the study's links keep Service identity.

**Tests:**

- `module-generation.test.ts` (29 tests):
  - It builds v2's tiles with the lane commands and its 22 modules with the new commands.
  - The result is exactly v2's seven bindings and two stubs (View count reader, View publisher).
  - Its ownership is v2's minus youtube-watch's grant and dependency (owners compared by members).
  - 20 modules are Template.
  - The order of connections doesn't matter.
  - It covers the fixed and initial values, every refusal, clean-up and re-derivation,
    `removeTile` and `removeLink`, the guard removal refusal, `moduleConnectOptions` and the
    stub reasons.
  - Reads write nothing, a mixed design keeps its tile-level facts, and the youtube-core sha256 is
    pinned.
  - Frozen v2 resolves to `inputs/normalized.json`.
- `tools.test.ts` +1: chat sends the canvas's batches, getDesign shows the status, and the
  catalog lists all 18 kinds.
- `StudioIcon.test.tsx`: every module icon is drawn.

**Checks:**

- `pnpm check` exited 0: **535 tests in 75 files** (lint: only the existing info).
- **E2E: 52 passed (2.2m)** on the first run.
- The web build passed with the existing chunk-size advisory.

**Gates:**

- **Frozen v2:** a fresh `export:v2` gives 72 files; 70 are byte-identical to
  `generic-export.tar.gz`. `.jeeves/manifest.json` and `report.json` equal it apart from the
  source inventory and the values derived from it:
  - 13 spec sources changed since the archive; two of them, `module-generation.ts` and
    `module-status.ts`, are new;
  - the `sourceSha256`s and `registry.sha256`;
  - the manifest's sha256 **and byte size** of `report.json`, which grew by the two new entries.
- **v1:** byte-identical; `assemble.test.ts` pins its manifest.
- **YouTube Overview PNG** at 1440×900: `472a4c8c…dc9f`.

**Browser check.** I ran scripted Chromium against my own API on port 4335 (scratch database
`jeeves_ma05`, now dropped) and Vite on port 4325, at 1440×900 and 1280×800:

- TinyURL foundation: 7 tiles and 7 lines.
- TinyURL extended: 11 tiles and 12 lines. A card opened Cache reader's page, and Back worked.
  In Detailed, 9 rows; a row opened Stats reader with one open mark. The design was unchanged
  (revision 1).
- YouTube: 21 tiles, 25 lines in the Overview and 26 in Detailed.
- There were no page errors and no console errors or warnings.
- All six projects were deleted (204).

**For MA06:**

- Fan items come from `moduleKinds(design, host)`. The label comes from the definition's
  `generation.kind`: lead → Template, part → Part of a template, stub → Stub. Each item also has
  its icon, name and description.
- Dots come from `moduleSlots(design, module)`: no slots means can't connect, and an empty
  `links` is a hollow dot. `moduleLinkSlot` gives the slot a link fills.
- A drag uses `moduleConnectOptions(design, module)`: each tile, and each other module in its
  tile, comes with a `connectModule` command or a refusal. The loader is
  `{ module: <data access> }`, saved as a component-target link.
- The module page uses `moduleStatus` (`reason` for Stub and Refused).
- An X uses `disconnectModule({link})`. A new module's ID comes from `newModuleIdentity`, or the
  command picks it.

**For MA07:**

- Every module outside a complete template, and not traced by a tile-level selection, has
  `{id: <module>, target: {kind: "component", component, host}, template: module-stub@0.1.0,
  binding: {kind: "module-stub"}}`.
- No emitter provides it yet, so its template reads as not installed.
- Report rows can come from `moduleStatuses` (status, template, reason, `unconnected`).

**For MA08:**

- Module-level template selections already resolve through the existing path, with no
  attributed finding in the v2 rebuild.
- The resolver still reads `state` SQL settings from a `data-access`. Make the Lifecycle writer
  the source; it already gets Pool size 10 and Statement timeout 2000.
- `v2Tiles()` and `v2Modules` in `module-generation.test.ts` build the equivalence twin.

Chat's addable tile kinds are unchanged (the Billing eval decision is still pending). The owner's
uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of `e2e-docker.sh` are
untouched and unstaged.

## 2026-11-10 — MA06: add and connect modules by mouse

Per the [module authoring plan](plans/module-authoring/units.md) (Owner decisions 4 and 5) and
contract §2, §4 and §5, on MA05's commands. Docs: `studio.md` (Creating and connecting with a new
Adding a module subsection, Connect mode, Detailed view, Removing, Inspector, History, Chat,
Limits), `CATALOG.md` (Components), a playbook lesson, the plan's status and the HUMAN_FEEDBACK
resolution.

- **Module `+`** (`creation.tsx`): a tile with `moduleKinds` has a `+` tab on its left (grid fan,
  five to a row). Rows are what each kind can generate **in that tile** (`studio/module-status.ts`
  `moduleGeneration`, from the template capabilities' hosts): Template, Part of a template, Stub.
  Each item shows its icon, name and that word; its tip adds the one-line description. A pick runs
  `addModule` (identity from `newModuleIdentity` on the latest design), selects `{tile, module}` and
  focuses the module's Name. Overview and Detailed.
- **Module page** (`ComponentForm`): a status line under the kind from `moduleStatus`:
  "Template · Cache read", Stub/Custom/Refused with the reason (yellow pill for Refused). Options
  are unchanged (`normalSettingFields`): a Data access in a template shows Pool size and Statement
  timeout. Remove module now sends `removeModule`.
- **Detailed** (`detailedView.ts`, `ContainerTile.tsx`): rows carry `connects`/`connected`; a row
  with slots has a dot on its right edge (hollow, filled once connected); none for Redirect
  responder and Event counter. Each row is a board end (`data-board-end`), its dot the handle.
  The Cache reader's loader is projected as `DetailedLoader` and drawn as a gutter arrow (rows'
  left inset widens to 22px in that container). Anchored lines name the module link they show
  (`disconnect`).
- **Connect mode** (`connect.ts`, `LaneCanvas.tsx`): a source that is a module uses
  `moduleConnectOptions` (cached per source per design); a release runs its `connectModule`, a
  refusal goes to the notice. In Connect mode a module line's X ("Disconnect Data access from
  Database") and the loader arrow's X run `disconnectModule`; tile-level lines keep `removeLink`,
  and Select mode's X still removes the whole relationship.
- **Board** (generic): ends inside tiles (`data-board-end` / `data-board-end-handle`): a press on a
  handle drags from the end; the line leaves the handle; the tile holding it counts as the source;
  a drag ends on an end only when the rules know it, else on its tile; allowed ends get a dashed
  outline on the overlay (`endScreenRect`). `FanItem.detail`/`description`, `CreateTab.columns`,
  `FAN_CELL_DETAIL` (120×108) and a `cell` parameter for `fanGrid`/`gridBounds`/`placeGrid`;
  `LineSpec.removeLabel`; `RemoveButton` exported.

**Deviations.** (1) The `+` also shows on older Redirect, Notifications and Billing tiles, because
`moduleKinds` (contract §2) offers them the generic kinds and chat can add them. (2) Fan captions
are per host, not the kind's static label: a Cache reader in a Worker, an Event consumer in a
Service and an Auth guard in a Worker are **Stub** (their templates don't allow that host;
MA05's status says the same). (3) The page also shows **Custom** (a study's modules before any
module command). (4) A line anchored at both ends: its X disconnects the source module's link.

**Refused on studies.** A module command on the YouTube study (or TinyURL extended) turns Details
cache and its Data access to Refused: "Local preset supports Private network; declared Service
identity remains unsupported and is preserved." Derivation kept. Presentation: a yellow Refused
pill plus that sentence on the module page; rows don't change; Undo returns the study. For MA10
and the owner: the sentence is the resolver's; a plainer one naming the link needs `ModuleStatus`
to carry the finding's link (spec and chat).

**Tests.** Board: fan wrap/cell test, ends-in-tiles drag test, grid detail/description test, X
label. Web: `detailedView` dots/loaders/disconnect, `ContainerTile` dots/arrow/X,
`module-status.test.ts`, `creation.test.tsx`. New `e2e/module-authoring.spec.ts` (5): every fan
kind added to a Service (Overview, 12) and a Worker (Detailed, 16) with Undo; a dot drag (refused
Cache with reason, then Database), its line X and two Undo steps; the loader drag, arrow, status
and arrow X with Undo; view-only actions leave design and blueprint unchanged (no dot on Redirect
responder); a study tile's Refused. `spawn.spec.ts` expects the left `+`.

**Checks.** `pnpm check` exited 0: **543 tests in 77 files** (lint: only the existing info).
**E2E: 57 passed (2.6m)**, twice. While writing the new spec it failed twice on test bugs
(a hovered fan item at viewport ratio 0.9999; an Escape-cancelled pull released on paper clears
the selection, as before); fixed, it passed alone and in both full runs. The web build passed with
the existing chunk-size advisory.

**Gates.** Frozen v2: 70 of 72 files byte-identical; `manifest.json`/`report.json` differ only in
the source inventory (the same 13 spec sources as MA05, `registry.sha256`, the manifest's hash and
size of `report.json`); no file of this unit is in it. v1: byte-identical (`assemble.test.ts`).
YouTube Overview PNG at 1440×900: `472a4c8c…dc9f`, also with Connect on.

**Mouse check** (scripted Chromium, my API 4336 with scratch DB `jeeves_ma06`, now dropped, and
Vite 4326; 1440×900 and 1280×800): TinyURL foundation 7/7, extended 11/12. Blank project: the
Service's fan had 12 items, none off-screen (panel 612×444 inside a 650×708 board at 1280 with
both rails); a pick focused the module's Name; dot drags to Cache and Database, the loader drag
(outlined row), "Template · Cache read"; arrow X → Stub "Needs its loader connected to a Data access
in Microservice.", Undo; line X kept the tile link, Undo. YouTube: Watch API `+` → Custom, Details
cache Refused. Dark mode read correctly. No page or console errors. All projects deleted (204);
one leftover from a timed-out dev run was removed from `jeeves_e2e`. Evidence:
[ma06](plans/module-authoring/evidence/ma06/).

**For MA07.** `studio/module-status.ts` has `moduleStatusLine` and `moduleTemplateNames` for the
Generate dialog. Some MA05 stub reasons read oddly ("Needs its cache connected to a cache.").

**For MA08.** The Lifecycle writer's page shows no settings until the resolver reads its `state`
SQL settings from it (the page follows `normalSettingFields`). Fan captions follow
`generationCapabilities[...].hosts`. After a Cache read derives, the Database shows the existing
"has no declared writer" warning (it is only read).

**For MA09.** By mouse: pull the tile's left `+` about 60px left; connect only in Detailed +
Connect, from a row's dot (pressing elsewhere on a row links the tile); the loader is the Cache
reader's dot onto the Data access row; X names are "Disconnect <module> from <tile>". A new module
is named after its kind and its Name is focused, ready to rename. `module-authoring.spec.ts` has
`build`, `addModule` and `arrowPoint` helpers.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — MA07: generated module stubs

Per the [module authoring plan](plans/module-authoring/units.md) (Owner decision 5) and contract
§6 and §8. Docs: the generator README (Module stubs, report `modules`), `studio.md` (Experimental
project export), the plan's status and the HUMAN_FEEDBACK resolution. Evidence:
[ma07](plans/module-authoring/evidence/ma07/).

- **Resolver** (`generation-resolver.ts`): a `module-stub` row gains `module` (name, kind, tile
  name, own description, each slot with its links: target tile or module, host link, store
  access from `studioStoreAccess`, queue channel). A stub that doesn't target a module is
  `CONFIG_INVALID`. The role check and host-setting audit skips (MA05) were checked; nothing else
  blocks a stub-only design (no findings).
- **Emitter** `local.module-stubs` (`src/v2/module-stubs.ts`), installed beside the composition
  (not in `loadLocalV2Dependencies`), provides `module-stub@0.1.0` (consumer output
  `src/modules/dependencies.ts`). Per stub: `src/modules/<host>/<module>.slots.ts` (scaffold:
  `Dependencies` with a property per connected slot named after its target, a comment per
  unconnected slot, and a `slots` descriptor) and `<module>.ts` (extension: an entry point named
  after the module that throws `Not implemented: <name>`). The shared `dependencies.ts` is an asset
  (`templates/local-v2/assets/src/modules/dependencies.ts.template`). A read-write slot through a
  link that only reads gets the reader type. No dependencies, no `local` contribution, no runtime
  imports; each stub is a required `custom` gap.
- **Report:** `assembleV2` adds `modules` only when a selection targets a component: module,
  name, host, kind, status, template, selection, files (payload files citing its selection, minus
  the foundation's and diagnostics'), unconnected and reason.
- **Preview and dialog:** both preview modes return `modules: moduleStatuses(design)`. The
  Generate dialog's **Modules** list (`GenerationModules.tsx`, `moduleStatusLine`) shows every
  module before and after preview, so a refused source still lists them.
- **Status** (`module-status.ts`): `ModuleStatus` gains `name`. Reasons are plain sentences: "Needs
  a connection to a cache.", "Needs a Data access as its loader.", "Needs a Data access connected
  to a database.", "Needs to be in a worker.", "Rate limiter has no template.", "Your own logic,
  with no template.", "Needs Multipart uploads or Cache reader in its tile." (only leads its tile
  could hold), "No template covers it."

**Deviation:** the frozen v2's `manifest.json`/`report.json` list one more emitter
(`local.module-stubs`, no dependencies) in `implementations`. Contract §8 allows the emitter
inventory to differ; everything else in them matches apart from the source inventory.

**Tests:** `module-stubs.test.ts` (4): typed and commented slots, names, loader `ModuleCall`, exact
extension text; determinism, one owner per file, nothing provisioned; report `modules` present
(stubs, and a completed cache read as Template with its files) and absent (frozen v2, video
preset); an edited `<module>.ts` refused by `planFileWrites`, kept on disk, and unchanged by a
new connection (only `.slots.ts` changes). Server: preview `modules` for a preset and a stub-only
design. E2E: `module-authoring.spec.ts` "Generate project lists each module's status and previews
its stubs". Updated reason strings in spec, chat and e2e tests; composition's template count is 8.

**Checks:** `pnpm check` exited 0: **548 tests in 78 files** (lint: only the existing info).
**E2E: 58 passed (2.6m)** first run; the new test also passed alone. Web build passed with the
existing chunk-size advisory.

**Gates:**

- **v1:** byte-identical (`assemble.test.ts` manifest pin).
- **Frozen v2:** fresh `export:v2`, 72 files; 70 byte-identical to `generic-export.tar.gz`. The
  two provenance files equal it apart from the source inventory, `registry.sha256`, the report's
  hash/size in the manifest and the added emitter.
- **Stub-only design** (one Service with a connected Data access, an Event publisher with its
  channel connected and outbox not, an unconnected Rate limiter; MA05 commands): 32 files, no
  findings, no providers in `compose.yaml`; `pnpm install --frozen-lockfile --ignore-scripts` and
  `pnpm build` exited 0 (9 JS files); a built stub threw `Not implemented: Data access`.
- **YouTube Overview PNG** at 1440×900: `472a4c8c…dc9f`.

**Mouse check** (scripted Chromium; my API 4337 with scratch DB `jeeves_ma07`, now dropped, and
Vite 4327; 1440×900 and 1280×800): TinyURL 7 tiles, 7 lines. Blank project: Consume →
Microservice, then Rate limiter, Data access and Custom from the `+` fan; Generate project listed
all three as Stub with their reasons; Preview gave "Ready: 32 files" and the four required gaps;
the footer stayed reachable at 1280. No page errors or app console warnings. All projects deleted
(204).

**For MA08:** template rows already get files (those citing the selection). Leads and parts of a
module-level template use the composition's existing consumers; stubs never mix with them. The
`modules` report rows are built from `moduleStatuses`, so MA08's statuses flow through. A
module's stub files disappear once it joins a template.

**For MA09:** View count reader and View publisher are the rebuild's two stubs; Preview lists
them under Modules with their reasons, and their files are under `src/modules/<Watch API's ID>/`.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — MA08: template-backed modules

Per the [module authoring plan](plans/module-authoring/units.md) and the approved
[contract](plans/module-authoring/contract.md) §3, §5 and §8, with question 5 (retire the preset's
entry points). Docs: the generator README, `studio.md` (system page, module page, Experimental
project export), `studio-settings.md`, `studio-blueprint.md`, `CATALOG.md` (Installed features and
controls), the plan's status and the HUMAN_FEEDBACK resolution.

- **Resolver** (`generation-resolver.ts`): a module-level selection's lead is the module source of
  a field it fills itself, so the Lifecycle writer's Pool size and Statement timeout feed its
  lifecycle's `state.poolSize`/`state.statementTimeoutMs` (before, they were read only from a Data
  access, and dropped). Its other fields read the parts their links trace, as before. A module
  with a module-level selection of its own is never another selection's part (a stub Data access
  beside the Lifecycle writer on the same link is neither read nor audited). Tile-level designs are
  unaffected: they have no module-level selections. The Lifecycle writer's page now shows both
  settings (`normalSettingFields` follows the decisions).
- **Lead target and binding** already worked from MA05 (`componentTargets`, derivation); no
  assembler change was needed.
- **Fixture** `spec/src/fixtures/v2-modules.ts` (excluded from the source inventory):
  `v2TileCommands`, `v2Tiles`, `v2Modules`, `v2ModuleDesign`, `frozenV2Design`, `addV2Module`,
  `connectModule`, `runStudioCommand(s)`. `module-generation.test.ts` now imports them.
- **Retired:** the system page's "Add a supported feature" (`PresetAttachment.tsx`, its use in
  `InspectorForm.tsx`, the `.studio-feature*` CSS); chat's `attachGenerationPreset`
  (`supportedAuthoringCommandSchema` is now `studioCommandSchema`; gone from
  `buildSupportedAuthoringCommand`, the instructions, the `applyStudioCommands` description and
  `unknownCommand`'s exception); `supportedGenerationPresets` and getDesign's `installedPresets`,
  which only served those entry points. Kept: `buildGenerationPresetCommand` (product-attachment
  example, tests), the installed video preset, and historical designs (they open, edit and
  export). The changeKind refusal no longer says "Attach a supported feature".

**Equivalence test** (`jeeves-generator/src/v2/module-templates.test.ts`, 3 tests):

- Twin: frozen v2 without its three `youtube-*` selections and preset. Mapped as the contract
  defines: each selection renamed to its lead (`owned-upload` → `upload-multipart`, `lifecycle` →
  `handler-writer`, `hls` → `transcoder-encoder`, `ready-reader` → `watch-cache-reader`, `counter`
  → `counter-sum`, `projection` → `indexer-writer`, `query` → `search-query`, and the lifecycle's
  `upload`), in the module design's order.
- Module design: `v2ModuleDesign()` plus v2's useful values (7 edits) through
  `buildSupportedAuthoringCommand`, as the inspector would.
- Result: both export with no findings; the same 7 templates, hosts and bindings; every file
  outside `.jeeves/` and `diagnostics/` byte-identical except:
  - **explained:** 5 extra files for the two stubs (`src/modules/dependencies.ts`,
    `src/modules/watch/watch-{counts,views}{.ts,.slots.ts}`);
  - **explained:** `application-bindings.ts` inputs lack the fixed values v2 declares explicitly
    and new tiles leave to the descriptor (contract §3): `host.minReplicas/maxReplicas`,
    `*.readReplicas`, `cache.eviction/topology`, and the lifecycle's `state.readRouting` (a
    Lifecycle writer has no read routing). The test checks each is a `fixed` decision.
  - Nothing else. Without the resolver change the test fails (`handler-writer/state.poolSize`).
- Report: 22 module rows, 20 Template, the two stubs; a part lists its lead's template files.

**Checks**

- `pnpm check` exited 0: **553 tests in 79 files** (lint: only the existing info).
- **E2E: 59 passed (2.7m)** on the first full run. New: `module-authoring.spec.ts` "a cache read
  built by mouse previews its template for the lead and its part". Updated: `inspector.spec.ts`
  (system outline is Name, Description, Warnings) and `edit-history.spec.ts` (the historical
  preset design's TTL/pool controls, set up by source; no mouse attach).
- The web build passed with the existing chunk-size advisory.

**Gates**

- **v1:** byte-identical (`assemble.test.ts` manifest pin passed).
- **Frozen v2:** fresh `export:v2`, 72 files; 70 byte-identical to `generic-export.tar.gz`.
  `manifest.json`/`report.json` equal it once each emitter identity's sources and
  `sourceSha256`, `registry`, `dependencies` and the report's hash/size are set aside; the only
  other difference is the added `local.module-stubs` emitter (MA07). This unit's sources in the
  inventory: `generation-resolver.ts`, `supported-authoring.ts`.
- **Generator tests** pass (in `pnpm check`).
- **YouTube Overview PNG** at 1440×900: `472a4c8c…dc9f`.

**Mouse check** (scripted Chromium; my API 4338 with scratch database `jeeves_ma08`, now dropped, and
Vite 4328; 1440×900 and 1280×800). Evidence: [ma08](plans/module-authoring/evidence/ma08/).

- **TinyURL:** 7 tiles and 7 lines at both sizes. The system page reads Name and Description
  (with Warnings when there are any), with no "Add a supported feature" and no Feature preset.
- **Blank project, by mouse:** Consume → Microservice → Cache and Database; Cache reader and Data
  access from the `+` fan; Detailed + Connect: the two dots, then the loader drag. The Data access
  page reads "Template · Cache read" with Pool size 10. Generate project lists both modules as
  Template · Cache read, before and after Preview. Preview gave "Ready: 35 files", no findings, and
  both report rows `template`/`positive-cache-read`. The footer stays reachable at 1280.
- **v2 from modules** (sent as commands through the API; the by-mouse rebuild is MA09's): the
  Lifecycle writer's page reads "Template · Upload lifecycle", then Options with Pool size 10 and
  Statement timeout 2000. Pool size 12 typed into it saved; Undo returned 10. Preview gave "Ready:
  77 files", no findings, 20 Template, and View count reader and View publisher as Stub.
- There were no page errors and no app console errors or warnings. The export check's own canvas
  readback warning comes from `e2e/export.ts` sampling the PNG; I filtered it.
- My first two scripted runs failed on my script's own helpers (the fan and toolbar button names),
  not the app. Their 5 leftover projects were in the scratch database, which I dropped.
  `jeeves_e2e` has no leftover E2E projects. I didn't use the owner's database.

**For MA09**

- The Lifecycle writer now shows Pool size and Statement timeout; v2's are 10 and 2000 (the
  initial values), so nothing needs setting there. v2's other useful values differ from the
  initial ones: Upload API Request timeout 5000 and Concurrency limit 500, Watch API Concurrency
  limit 2000, Details reader Pool size 50 and Statement timeout 500, Metadata cache TTL 3601,
  View counter Concurrency 8.
- `fixtures/v2-modules.ts` has v2's commands; the by-mouse spec can compare its saved design
  with `v2ModuleDesign()` plus those values. The equivalence test shows what Preview must give.
- This unit found no missing UI step for the rebuild. "Add a supported feature" is gone, so
  modules are now the only way to attach a template.
- Preview's stub reasons for v2 read "View count reader: Details cache doesn't use it." and
  "View publisher: Needs Multipart uploads in its tile." (MA07's wording). The second one misleads:
  MA10 should reword it.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — MA09: rebuild YouTube v2 by mouse

Per the [module authoring plan](plans/module-authoring/units.md) (MA09) and the approved
[contract](plans/module-authoring/contract.md) (§3, questions 2 and 3, §8). Docs: the
[evidence note](plans/module-authoring/evidence/ma09/README.md), a playbook lesson, the plan's
status and the HUMAN_FEEDBACK resolution. `studio.md` is unchanged (the fix restores what it
already says).

**Result: v2 was fully rebuilt by mouse.** From a blank project: the system name, Watch and
Publish, 19 tiles from link fans, 7 Connect drags (Upload API → Identity included), 22 modules from
the `+` fans with the plan's names and descriptions, 24 dot drags in Detailed + Connect (the loader
among them) and v2's 7 useful values: 262 gestures (114 clicks, 74 drags, 74 typed fields), built
in about 96 s by the scripted mouse.

- **Spec** `e2e/v2-rebuild.spec.ts`, steps and helpers in `e2e/v2-rebuild.ts` (`V2_TILES`,
  `V2_MODULES`, `V2_CONNECTIONS`, `V2_VALUES`, `createBlank`, `buildV2Tiles`, `buildV2Modules`).
  Only pointer and UI writes; API reads wait for saves. It checks the plan's names and
  descriptions, the loader arrow, the diff, then Generate project → Preview by mouse: 22 modules
  listed (20 Template, View count reader and View publisher Stub), HTTP 200, no findings, the
  same seven template refs as v2's installed selections, "Ready: 77 files". It deletes its
  project; `JEEVES_V2_REBUILD_KEEP=<name>` keeps it under that name.
- **Diff** `spec/src/fixtures/v2-diff.ts` (excluded from the source inventory): `v2Diff(frozen,
  rebuilt, installed?)` compares by tile, link and module name (system, actions, entries, tile
  kinds and settings, links with kind/interaction/protocol/security/channel use, module kinds,
  module links with their `via`, the resolver's selections, inputs and resources, ownership with
  owners by members). `v2IntendedDifferences` lists the contract's intended ones with reasons,
  most restricted to the side that has a value; `v2DiffReport` returns `unexpected` and `unused`.
  Result: 163 rows, 0 unexpected, 0 unused. Tests (3): frozen vs itself is empty; the command-built
  twin's only unexpected rows are the 7 useful values it lacks; a changed interaction, module kind
  and module link are reported.
- **Kept project** "YouTube v2 rebuild (MA09)", `9dcb10a3-bb0b-4a5b-b055-b7610ddc1e1a`, revision
  142, in the owner's `jeeves` database. Built by the same spec through my own API (4340) and Vite
  (4330) on that database, then stopped; no chat turn was running. The owner's other six projects
  kept their revisions and `updatedAt` (the frozen v2 project, `2c7c8b08…`, is at revision 4, as
  before this unit; the spec's helper viewed it read-only before opening New project).

**Bug fix (one).** A greyed kind's tip hung over the kind below it and took the pointer, so a
pull from an action straight down from Queue or topic onto CDN picked nothing (the rebuild's Local
video edge). `.board-fan-tip` now has `pointer-events: none` (`board.css`). Test:
`spawn.spec.ts` "a greyed kind's tip never hides the kind below it" (fails without the fix at the
hover assertion; passes with it).

**Awkward, worst first** (details in the evidence): (1) connection dots are 2.5px at v2's Detailed
fit with both rails (0.21), 4.5px with rails closed (0.37), and a connect drag doesn't pan; (2) the
fan tip (fixed); (3) generated names follow the creation kind (`microservice-2`,
`worker-service-3`; stubs under `src/modules/microservice/`); (4) 74 of 262 gestures are typing;
(5) Options appear only after templates derive, so values come after connecting; (6) View
publisher's stub reason "Needs Multipart uploads in its tile." misleads (MA08 flagged it).

**Checks**

- `pnpm check` exited 0: **556 tests in 80 files** (lint: only the existing info). A first rerun
  after my last edit failed typecheck (an `only` widened to `string` in `v2-diff.ts`); fixed, it
  passed.
- **E2E: 61 passed (4.1m)** on the first full run. Rerun alone with the final files,
  `v2-rebuild.spec.ts` and `spawn.spec.ts`: 8 passed (1.8m). The rebuild takes about 1.5 min.
- The web build passed with the existing chunk-size advisory.
- `jeeves_e2e` has no leftover E2E projects; my scratch database `jeeves_ma09` is dropped.

**Gates**

- **Frozen v2:** a fresh `export:v2`: 72 files, 70 byte-identical to `generic-export.tar.gz`;
  `report.json` equals it once emitter `sources`, `sourceSha256`, `registry`, `dependencies` and
  the `local.module-stubs` emitter are set aside; `manifest.json` then differs only in
  `report.json`'s hash and size. No file of this unit is in the inventory.
- **v1:** byte-identical (`assemble.test.ts` manifest pin, in `pnpm check`).
- **YouTube Overview PNG** at 1440×900: `472a4c8c…dc9f`, twice.
- I did not edit `field-projects/youtube/v2/` or the frozen studio project.

**Browser check** (scripted Chromium; my API 4339 with scratch database `jeeves_ma09` and Vite
4329, at 1440×900 and 1280×800): TinyURL foundation 7 tiles and 7 lines; an action's fan, over
the greyed queue and down onto CDN, added the CDN (8 and 8). The kept project at both sizes: 22
tiles, 28 lines in the Overview, 31 in Detailed, 22 rows (21 dots filled), one loader arrow. No
page errors or console errors or warnings.

**For MA10:** check the rebuild against decisions 1–9 in the kept project. The dot size at the
fit, generated names from creation kinds and View publisher's reason are the open findings.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — MA10: review module authoring

I did an independent review of the [module authoring plan](plans/module-authoring/units.md)
(`18cda98`–`63022ff`), by mouse at 1440×900 and 1280×800. I used my own API (4351, scratch
database `jeeves_ma10`, now dropped) and Vite (4350). The write-up is
[review.md](plans/module-authoring/review.md).

**Decisions 1–9** are all delivered.

**Kept rebuild.** I opened "YouTube v2 rebuild (MA09)" read-only: API reads, plus the owner's app
with only Overview | Detailed clicked. It matches the MA09 evidence:

- revision 142;
- the diff: 163 rows, 0 unexpected and 0 unused;
- 22 tiles, with 28 lines in the Overview and 31 in Detailed;
- 21 filled dots and one loader arrow.

All seven owner projects kept their revision and `updatedAt`.

**Gates.**

- **v1:** byte-identical (the `assemble.test.ts` pin).
- **Frozen v2:** 70 of 72 files are byte-identical. The provenance files differ only in the source
  and emitter inventory: 4 sources added, 13 changed, the `local.module-stubs` emitter and
  `registry.sha256`.
- **Overview PNG:** `472a4c8c…dc9f`.
- **View-only actions** change neither the design nor the blueprint.
- **Mouse and chat** send the same batches for the four module commands.

**Fixes.**

1. **Stub reasons** (`module-status.ts`): a part with no lead beside it reads "No template in
   <tile> uses it." It used to read "Needs Multipart uploads in its tile." / "Needs to be in a
   worker.".
2. **Refused reasons** name the kept value and how many more there are: "The link from Watch API to
   Metadata database uses Service identity, which its template can't use; 9 other saved values
   can't be used either." This is status text only; the resolver is unchanged.
3. **Chat's older removals** (`supported-authoring.ts`): `removeComponent` and
   `disconnectComponent` never derive, so chat could leave a stale template. Removing the Count
   writer kept the event counter selected. Normal authoring now refuses both once module-level
   selections exist, naming `removeModule` / `disconnectModule`.
   - I first made them derive. That broke `generation.test.ts`, which relies on the source-level
     prune, so I chose the refusal instead.
   - The new test fails without the fix.
4. **Dead code:** `laneLinkRefusal` (unused since MA03) is removed; its tests now run on
   `connectOptions`.
5. **Docs:** chat's `addTile` no longer says "or before a tile"; the module page's reason
   examples are current; `CATALOG.md`, `PLAN.md` and chat's instructions are updated; a playbook
   lesson is added.

**Checks.**

- `pnpm check` exited 0: **557 tests in 80 files** (lint: only the existing info). An earlier run
  failed on a type narrowing in my rewritten test and on the derive attempt above. Both were fixed
  before this run.
- **E2E: 61 passed (4.1m)** on the first full run.
- The web build passed with the existing chunk-size advisory.
- My review spec passed 8/8 at both sizes, and the kept-project check 2/2, with no page or console
  errors.
- `jeeves_e2e` has no leftover projects.
- Evidence: 3 screenshots in [ma10](plans/module-authoring/evidence/ma10/).

**For the owner.** These follow-ups are ranked in the review; five need a decision:

- IDs taken from the creation kind;
- the studies' Refused state;
- Options appearing only after templates derive;
- chat's legacy kinds;
- two pre-plan tiles in the frozen v2 project.

The frozen v2 project is at revision 4. It has extra API and Service tiles, added 2026-11-09 21:05
CST, before the plan began.

**Next:** the owner's per-tile process plan. The review's "Next" section lists what matters for it.
The plan is complete.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — Tile processes plan from owner decisions

This entry is planning only; no code changed. After MA10, the owner approved four defaults for
contract question 6 (a runnable process per tile):

- IDs follow typed names first;
- an export option, off by default;
- provisioning for stubs;
- consume loops that survive "Not implemented".

The owner also approved the connection-dot fix, and said their own edits in the running UI are
play.

I wrote the [tile processes plan](plans/tile-processes/units.md) (TP01–TP09). It starts with
TP01, a contract unit. The coordinator pauses only if TP01's open questions go beyond these
decisions. I also added a HUMAN_FEEDBACK entry.

I ran no checks: only docs changed. The owner's uncommitted `README.md` and `.docs/` are
untouched.

Next: TP01 only.

## 2026-11-10 — TP01: tile process contract

This unit is docs only; no code changed. I wrote the
[tile process contract](plans/tile-processes/contract.md), and revised TP03–TP08 and the status
line in [units.md](plans/tile-processes/units.md). All eight open questions stay within owner
decisions 1–6.

- **Option:** saved in the design as `generation.processes: true` (absent means off), through one
  `setRunnableProcesses` command for the dialog and chat. Only designs built from modules can turn
  it on.
- **Shape:**
  - Service and Uploads tiles are HTTP processes, Workers run loops, and the mixed case does both.
  - Each is `app-<id>` from `src/processes/<id>.ts`, healthy on the ready marker, with no restart
    policy.
  - One nginx edge exposes `/api/<id>/` for public tiles.
- **Wiring:**
  - Five templates are mounted with generated `<lead>.hooks.ts` files; the two search templates
    are placeholders.
  - Stubs are loop, route (`/modules/<module id>`, any method) or library stubs.
  - "Not implemented" gives 501, or a terminal `NOT_IMPLEMENTED` dead letter with a log line.
- **Provisioning:** stub stores get the link's access, worked out at read time. Nothing is written
  to ownership, and Identity isn't provisioned.
- **IDs:** a rename re-keys IDs that still follow their name or kind, and a clash refuses. Designs
  with a study origin, a tile-level selection or a preset keep their IDs.

**Unit changes:**

- **TP03:** the "follows" rule, the cascade, a completeness walk, and pinned designs rename without
  re-keying. This replaces "refuse where pinned".
- **TP04:**
  - the stub stack fixture, and pinning off output first;
  - the schema, command and support flag;
  - `model.processes`, `report.processes`/`runnable`, and the `local.mjs` gate;
  - empty tiles also get processes.
- **TP05:** the edge, multipart and cache read mounted, search query as a placeholder, the hooks
  files and stub routes.
- **TP06:** stub and template loops, plus the queues those loops consume.
- **TP07:** the rest of stub provisioning, `module-clients.ts` and the startup probes.
- **TP08:** the exact designs and requests from contract §8; the MA09 graph comes from the fixture,
  not the owner's database.

**Findings for the next units**

- `scripts/local.mjs:7-15` refuses to start any `app-*` while `applicationComplete` is false. With
  processes on, the gate must read `runnable` instead.
- No template contributes SQL logins today, so no host can connect to Postgres. The asset lifecycle
  has no `completion-events` subscriber queue.
- `process.ts` and `http.ts` are emitted only beside templates.
- `http.ts`'s error handler turns unknown errors into 503, so "Not implemented" must be mapped to
  501 before it.
- `youtube-core` hashes every `generationPolicies` record (`generation-catalog.ts:138`), so don't
  add one.
- Lane rules refuse a consumer link that loops back up the lane. The stub stack therefore feeds
  Links API's consumer from the Upload lane.

**Checks:**

- The generator v2 and related spec tests passed: 22 files, 124 tests.
- `pnpm check` exited 0: 557 tests in 80 files (lint: only the existing info).
- I confirmed the cited export behaviour with in-memory `assembleV2` runs of a stub-only design,
  `v2ModuleDesign()`, frozen v2 and the proposed stub stack (13 stubs, no findings, 52 files).
  Nothing was exported to disk, and no Docker ran.
- No e2e or browser checks were run, since this unit is docs only.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

Next: TP02.

## 2026-11-10 — TP02: usable connection dots

Per the [tile processes plan](plans/tile-processes/units.md) (Owner decision 5; module authoring
review follow-up 1). Docs: `studio.md` (Detailed view, Connect mode, the camera list, Limits), a
playbook lesson, the plan's status and the HUMAN_FEEDBACK resolution. UI only: no spec, layout,
export or Overview change.

- **Board** (generic):
  - The host carries the camera's zoom as `--board-zoom` (a small `ZoomVariable` on React Flow's
    store), and `board.css` gives `--board-handle-hit: 16px`, the smallest on-screen hit area an
    end's handle should keep.
  - **Edge pan:** `camera.ts` `edgePanStep(pointer, pane, dt, content)`. Within 40px of the
    board's edge, or past it, a held connect drag pans towards that edge, linearly up to 480px/s
    (8px a frame). It pans only while the tiles reach past that edge, and stops with their far
    edge 48px inside, so at the fit nothing pans. A late frame counts as at most 50ms.
  - `useConnectDrag` takes an optional `EdgePanCamera` (`frame`, `pan`) and runs one step per
    animation frame. Each frame first redraws the drag against the last step, so the line's end
    stays at the pointer, and the scrim, outlines and end under the pointer follow the canvas.
    A release after a pan lands on what is under the pointer. A pan makes the camera the user's.
    It applies to tile and dot drags alike.
- **App** (`canvas.css`, no TSX change):
  - In Connect mode a dot's `::before` hit area is `max(28px, 16px / zoom)` wide. Its right edge
    stops at the frame (the tile clips its face), so it reaches further into its row. Its height
    is capped at the 32px row pitch, so neighbours meet halfway.
  - The drawn dot stays 12px (`--dot`). In Connect mode the hovered container's dots grow to 16px
    (120ms; none with reduced motion).
  - Select mode keeps the old 28px area. Exports are unchanged.

**Measured** (elementFromPoint, the YouTube study in Detailed at its fit, chat rail open):

| Window | Zoom | Dot drawn | Hit area | Before |
| --- | ---: | ---: | --- | --- |
| 1440×900 | 0.337 | 4.0px | 16.5×11.5px | 8×9.4px |
| 1280×800 | 0.295 | 3.5px | 16.75×10px | about 7×8px |

Pixel snapping makes neighbouring areas overlap by under 1px; there the lower row wins. The
boundary is within 1px of the midpoint.

**Tests.**

- `camera.test.ts` +2: edge-pan speed, ramp, sides and corner, dt cap; the content bound, the fit
  and no tiles.
- `board.test.tsx` +1: at the fit a held drag doesn't pan. Zoomed in, it pans left at the same
  zoom with the line's end at the pointer, stops 48px inside, and the release connects.
  `--board-zoom` follows the camera. The test fails with the camera not passed.
- New `e2e/connection-dots.spec.ts` (3):
  - At the YouTube Detailed fit, the hit area is ≥15.5px wide and about the pitch tall, meets the
    row above halfway, and is the tile below. A press 7px left of the dot connects View publisher
    to View counts as a module link: one revision, no tile link, Undo. Hover grows the dots. With
    the CSS rule disabled, the width measured 8 and the test failed.
  - A dot drag (Job publisher → Metadata database, zoomed in, inspector open) held past the
    canvas edge pans, keeps the zoom and the line's end at the pointer, then connects.
  - The same for a tile drag on TinyURL extended (Shorten service → Click events, async).
- `v2-rebuild.spec.ts` is unchanged: it drags from dots at the Fit and never zoomed in to hit
  them.

**Checks.**

- `pnpm check` exited 0: **560 tests in 80 files** (lint: only the existing info).
- **E2E: 64 passed (4.2m)** on the first full run. The new spec alone passed 3/3 earlier; its
  first run had failed my own hold helper (it waited for clearance on an axis that wasn't
  panning), which I fixed.
- The web build passed with the existing chunk-size advisory.

**Gates.**

- YouTube Overview PNG at 1440×900: `472a4c8c…dc9f`, also with Connect on.
- v1: byte-identical (`assemble.test.ts`).
- Frozen v2: a fresh `export:v2` gives 72 files, 70 byte-identical to `generic-export.tar.gz`.
  `report.json` and `manifest.json` are equal once the emitter sources, hashes, dependencies,
  `local.module-stubs`, the registry and the report's hash are set aside. None of this unit's
  files is among the 145 inventory paths.

**Mouse check** (scripted Chromium; my API 4372 with scratch database `jeeves_tp02`, now dropped,
and Vite 4362; toolbar, rails and drags by mouse):

- At both sizes, TinyURL 7 tiles and 7 lines.
- YouTube Detailed + Connect at the fit: a press 7px off View publisher's dot, released on View
  counts, connected the module. Hover grew the dots (4.0→5.4px at 1440).
- Zoomed in to 0.73 / 0.59 with the inspector open: a drag from Job publisher held past the right
  edge panned 128 / 105px in 254 / 200ms at the same zoom. The line's end stayed at the pointer,
  and the release on Metadata database connected.
- No page or console errors or warnings. All my projects were deleted (204), and `jeeves_e2e` has
  no leftovers.
- Evidence: [tp02](plans/tile-processes/evidence/tp02/), with the hit areas tinted for the shot at
  3×, and an edge-pan hold.

**For TP03.** Nothing here touches IDs, the spec or the generator. `ContainerTile.tsx` is
unchanged. Rows are still found by `data-module` (the module ID), so a re-key changes those
selectors in e2e helpers. The edge pan is generic, so any future board drag can reuse
`edgePanStep` and `EdgePanCamera`.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP03: ids follow names

Per the [tile processes plan](plans/tile-processes/units.md) (Owner decision 1) and
[contract](plans/tile-processes/contract.md) §7. Docs: `studio.md` (Inspector: Names and IDs,
History, Chat), `studio-blueprint.md`, `chat-tool-schemas.md`, `CATALOG.md`, a playbook lesson,
the plan's status and the HUMAN_FEEDBACK resolution.

- **Spec** (`studio-rekey.ts`): `idsPinned` (study origin, a tile-level selection or a preset),
  `tileIdFollows`/`moduleIdFollows` (creation form or the current name's slug, each with an
  optional `-n`, cut like `freshId`), `planRename` (the tile, then its following modules as
  `<new tile>-<slug(module name)>`; throws "<name> would take the ID <id>, which <user> already
  uses. Choose another name."), `renameRefusal`, `rekeyDesign` (every reference: endpoints, C1
  containers, bindings, element owners, `servedBy`/`origin`, group members, entries, modules and
  their dead-letter queue, module links, scope, ownership, operations, generation targets, bindings
  and selection IDs; never link IDs) and `rekeyLeftovers` (the completeness walk: every string
  equal to an old ID outside free text, owner/binding IDs and record refs; a leftover counts when
  the schema would still parse with another ID in its place, so `settings.kind: "cache"` is not
  one). An unchanged name, a slug that is no ID, or a non-following ID re-keys nothing.
- **Operation** `rekey {from, to}` (`operations.ts`, `apply.ts`): refuses an unknown ID or a used
  one. `buildStudioCommand` plans the rename for `edit`/`editComponent` with `name`, emits one
  `rekey` per ID before `updateElement`/`setStudio`, re-derives (when module selections exist) from
  the re-keyed `before`, and refuses if the walk finds a leftover: one batch, one revision.
- **Also:** `addModule` with a `name` and no `id` takes `<host>-<slug(name)>` (`newModuleIdentity`
  gained an optional name), so a design built with final names from the start equals a re-keyed
  one.
- **Server:** an edit, undo (reversed) or redo answer carries `renamed: [{from, to}]` from the
  stored ops (`DesignState.renamed`; never on a read). Chat's `applyStudioCommands` result lists
  `renamed`; its instructions gained one line.
- **Web:** the store moves form drafts to the new IDs (`formDrafts.follow`, `DraftSpec.follow`)
  before it adopts the design; timers and re-flushes hold the draft, not its key. The workspace
  follows the selection (`followSelection`) during render and keeps the inspector's and module
  page's React keys (`followKeys`), so the page doesn't remount. The re-key happens when the
  debounced (500ms) or blur commit lands, not per keystroke; a clash is a field error from
  `renameRefusal` in the draft's `validate`, so autosave waits (no sticky "failed" draft) and
  continues once the name is free.

**Updated tests (rename now re-keys):** three `chat.test.ts` turns use the new IDs afterwards
(`video-uploads`, `still-missing-storage`, `repair-n`); the eval seeds' renamed tiles are
protected under their new IDs (`owner-export-bucket`, `owner-stock-ledger`).

**Tests.** `studio-rekey.test.ts` (11): cascade with links/selections/a hand-chosen module; owner,
grants, entry and loader follow; equal to the final-ID build (links aside); v2 rebuilt renaming as
it goes deep-equals v2 built with those final IDs, and `v2Diff` gives the twin's 14 rows; every
reference kind, checked against the walk on 4 studies, frozen v2, the module design and a
synthetic design (45 shapes); walk ignores vocabularies, free text and owners and finds a missed
`relationships.to`; the command refuses it; refusals (tile, link, cascaded module, module);
pinned (4 studies, frozen v2, selections only, preset only) and non-following v2 IDs; unchanged,
no-ID and long names; the op's refusals. Server: edit/undo/redo `renamed` and Undo restoring the
design. Web: `followSelection`/`followKeys`; a draft that re-keys mid-flight keeps the
description typed meanwhile and moves back on Undo; a clash as a field error. E2E
`ids-follow-names.spec.ts` (2): a Worker renamed "Video lifecycle worker" becomes
`video-lifecycle-worker` while the Description keeps focus; clash error; its Data access renamed
→ `video-lifecycle-worker-state-writer`, row and page follow, Undo restores; tile rename cascades
and Undoes; a YouTube study tile keeps `transcoder`.

**Checks.** `pnpm check` exited 0: **576 tests in 81 files** (lint: only the existing info).
**E2E: 66 passed (4.3m)** on the first full run and **66 passed (4.2m)** on a final run after
formatting and two type fixes in tests (`v2-rebuild.spec.ts` included, now re-keying as it
renames). The web build passed with the existing chunk-size advisory.

**Gates.** YouTube Overview PNG at 1440×900: `472a4c8c…dc9f`. v1: byte-identical
(`assemble.test.ts`). Frozen v2: fresh `export:v2`, 72 files, 70 byte-identical to
`generic-export.tar.gz`; `manifest.json`/`report.json` differ only in emitter sources and hashes,
`implementations` (`local.module-stubs`), the registry and the report's hash/size. This unit adds
`studio-rekey.ts` to the inventory and changes `apply.ts`, `operations.ts`, `studio-modules.ts`,
`studio-operations.ts` and `index.ts`. Processes-off: in-memory exports of frozen v2, the v2
module design and a stub-only design before and after this unit differ only in those two
provenance files.

**Mouse check** (scripted Chromium; my API 4373 with scratch DB `jeeves_tp03`, now dropped, and
Vite 4363): TinyURL 7 tiles and 7 lines at 1440×900 and 1280×800. Blank project at 1440×900:
Consume → Microservice → Queue or topic → Worker service from fans; the Worker renamed by typing
→ `video-lifecycle-worker` (still selected); Event consumer and Data access from its `+`, the
latter renamed "State writer" → `video-lifecycle-worker-state-writer` with its page open; Undo
→ `…-data-access`, page shows "Data access"; tile renamed "Video worker" → both modules
`video-worker-…`, Undo restores all; "Microservice" shows the clash error and saves nothing.
YouTube study: Transcoder renamed "Video transcoder", every tile and module ID unchanged. No page
errors or console errors or warnings. All five projects deleted (204); `jeeves_e2e` has no
leftovers. My script's first run typed before the new tile's Name took focus and renamed the
Queue (a script race, fixed by waiting for focus).

**For TP04:** process and file names can rely on IDs following typed names in module-built
designs (`app-<id>`, `src/processes/<id>.ts`); pinned designs (frozen v2, studies) keep theirs.
The stub stack fixture can name tiles directly (addTile needs an explicit id) and modules by name
alone (`addModule` with `name`). A rename re-derives, so owner IDs follow too (`<host>-owner`).

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP04: process option and skeleton

Per the [tile processes plan](plans/tile-processes/units.md) (Owner decisions 2 and 6) and
[contract](plans/tile-processes/contract.md) §1, §2 and §8. Docs: the generator README (Runnable
processes), `studio.md` (Experimental project export, Chat), `studio-settings.md`,
`studio-blueprint.md`, `chat-tool-schemas.md`, `CATALOG.md`, the plan's status and the
HUMAN_FEEDBACK resolution. Evidence: [tp04](plans/tile-processes/evidence/tp04/README.md).

- **Pinned off first.** New fixture `spec/src/fixtures/stub-stack.ts` (contract §8: 4 tiles, 13
  stubs; module IDs are the names' slugs, so routes read `/modules/redirector`).
  `moduleAuthored(twin, installed)` and `tileLevelTwin()` moved into `fixtures/v2-modules.ts`.
  `jeeves-generator/src/v2/processes-off.test.ts` compares frozen v2, the v2 module design with
  its values and the stub stack against `fixtures/processes-off.json`, written on the unchanged
  generator: every payload byte, and the two provenance files with their inventory set aside
  (`fixtures/processes-off.ts`). Both fixture folders are outside the source inventory.
- **The option.** `generation.processes: z.literal(true).optional()`. `setRunnableProcesses {on}`
  is one `setGeneration` (never derives). It refuses on `idsPinned` designs ("Runnable processes
  needs a design built from modules."), without module selections ("Add a module first."), when
  already in that state, and in `buildSupportedAuthoringCommand` when `installed.processes` is
  absent (off always allowed). `GenerationInstalledSupport.processes`; the resolver adds
  `model.processes` only when on (`NormalizedProcess`: tile, name, kind, shape, exposure, HTTP
  limits with origin, template selections, stub roles loop/route/library), a `NEEDS_TEMPLATE` at
  `/generation/processes` when not installed and a `CONFIG_INVALID` there on a raw tile-level or
  preset design. `generationProcessShapes` gives the six kinds (legacy kinds per question 6).
  Chat's getDesign has `processes`, plus one instruction line; blueprint v2 refuses the path.
  No `generationPolicies` record.
- **Emitter** `local.tile-processes` (`src/v2/tile-processes.ts`, in `loadLocalV2Registry`'s
  application features; `provides.processes`): `src/processes/<id>.ts` with a compiled `config`
  (HTTP: `createHttpService` on 0.0.0.0:3000, `/healthz` only; worker: idle timer), the ready
  marker through `runProcess`, drain on SIGTERM; a `local.services` row per tile (`http: false`,
  `dependsOn: []`, readiness). Its `render` returns `processes` report rows (`V2ProcessReport`).
- **Foundation/assembler.** Process hosts need no selection; `application-services` counts them;
  `scripts/local.mjs`'s gate expression and message are substituted exactly once (else refuse) to
  read `report.processes?.runnable`; README gains a paragraph; composition emits `process.ts`,
  primitives `http.ts`/`admission.ts` for HTTP processes. The manifest gets `processes: true`
  beside `runtime`; the report gets `processes: {runnable, tiles}` (runnable = no findings, no
  unsupported gap, no `application-services` gap, a verified row per tile). All only when on.
- **Web.** Generate project: an unticked "Runnable processes" checkbox (one help line); a refusal
  shows under it and nothing is saved; Preview's **Processes · n · runnable** list.

**Deviation:** the refusal covers every `idsPinned` design, so a study (origin) reads "needs a
design built from modules" rather than "Add a module first."; the contract named only tile-level
and preset designs. Turning it on twice refuses ("already on").

**Tests.** Spec `runnable-processes.test.ts` (7), generator `tile-processes.test.ts` (8) and
`processes-off.test.ts` (4), chat `tools.test.ts` +1, preview route +1 case, e2e
`module-authoring.spec.ts` +1 (tick, Preview lists the process, Undo unticks, study refuses).

**Checks.** `pnpm check` exited 0: **596 tests in 84 files** (lint: only the existing info).
**E2E: 67 passed (4.3m)** on the first full run (the new test also passed alone, 6.4s). Web build
passed (1.58s, the existing chunk-size advisory).

**Gates.** Off pin passes. Frozen v2: fresh `export:v2` 72 files, 70 byte-identical to
`generic-export.tar.gz`; manifest/report equal without their source and emitter inventory. v1
byte-identical. YouTube Overview PNG `472a4c8c…dc9f`. **Docker:** stub stack with processes on,
own project `jeeves-tp04-stub`, ports 45440–45442: install 0.5s, build 0.7s, `first-run` 24.5s,
4/4 `app-*` healthy, `/healthz` 200 on the three HTTP ones (inside the network), `stop` 0.9s (all
exit 0), `start` 12.1s, 4/4 healthy, 0 restarts. Cleanup: `down --volumes --remove-orphans` and
the image tag removed; the owner's volumes, networks, tag→ID mappings, container IDs and 28
healthy v1/v2 containers match the record.

**Mouse check** (scripted Chromium; my API 4374 with scratch DB `jeeves_tp04`, now dropped, and
Vite 4364): TinyURL 7 tiles and 7 lines at 1440×900 and 1280×800; blank → Consume →
Microservice → Rate limiter, tick, Preview lists `app-microservice · HTTP, public · GET /healthz`;
Undo unticks; the TinyURL study refuses with the reason, revision unchanged. No page or console
errors (the PNG export's own canvas readback warning aside). My first scripted run used a wrong
fan locator (script bug). All projects deleted; `jeeves_e2e` has no leftovers.

**For TP05/TP06.** Mount in `tile-processes.ts`: add routes/loops to `configure` and the report
rows (`routes`, `loops`, each with `answers`); `model.processes[].templates` and `.stubs[].role`
say what to mount. `dependsOn` is empty: add each provider a wired module uses. The transcoder
still runs the `app` target; switch to `media` when Video HLS is mounted. HTTP processes publish
no port: TP05's edge owns `LOCAL_HTTP_PORT`. `NotImplemented`/`tile-process.ts` and
`src/modules/entry.ts` don't exist yet. Stub files are unchanged with the option on.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP05: http wiring

Per the [tile processes plan](plans/tile-processes/units.md) and [contract](plans/tile-processes/contract.md)
§2–4. Docs: the generator README (Runnable processes: the edge, module routes, hooks files, 501),
`studio.md` (Experimental project export), the plan's status and the HUMAN_FEEDBACK resolution.
Evidence: [tp05](plans/tile-processes/evidence/tp05/README.md).

- **Edge:** `edge` contribution in `local-contract.ts`; the foundation writes `app-edge` (pinned
  nginx, `127.0.0.1:${LOCAL_HTTP_PORT}:8080`, `depends_on` each public process healthy, own
  `/healthz` JSON) and `infra/edge/nginx.conf` (`/api/<id>/` → `app-<id>:3000/`, 404 JSON
  otherwise), adds it to `plan.application`, and refuses beside an `http: true` service or a tile
  with the ID `edge`.
- **Wiring** (`src/v2/http-wiring.ts`, used by `tile-processes.ts`): an `HttpMount` per template
  or route stub (imports, setup/configure/initialize/started lines, config row, routes, hooks
  file, service needs, local SQL). Multipart is mounted on its schema (named from the selection
  ID) with `ownedUploadPersistence` plus a `jobs` outbox (`100-<selection>.sql`, grants to its
  host), S3 control/signing clients, transaction, jobs publisher and relay, a sweep at start and
  every 30 s, six routes under `/modules/<lead>/uploads`. Cache read: source login (no grants),
  Valkey, `createPositiveReader` at `GET /modules/<lead>/:key` (null → 404). Search query:
  placeholder `GET /modules/<lead>` (client built, cluster health checked at start).
- **Hooks files** `src/modules/<host>/<lead>.hooks.ts` (`generated-extension`); every hook
  throws `NotImplemented("<hook> for <lead name>")`. `mountedHooksGap` (in `module-stubs.ts`) turns
  the multipart and cache read `*-application-bindings` gaps `custom`, naming the file.
- **Stubs:** route stubs' `<module>.ts` take `(dependencies, request: ModuleRequest):
  Promise<ModuleResponse>` with processes on; `.slots.ts`, loop and library stubs are unchanged.
  New scaffolds `src/modules/entry.ts` and `src/runtime/tile-process.ts` (`NotImplemented`,
  501 wrapper `notImplementedRoutes`, `stubRoutes` for any method on `/modules/<id>` and `/*`,
  rate-limited log, `unprovisioned<T>()` dependencies).
- **Report rows** gain `edge`, `templates` (`mounted`/`placeholder`) and `hooks`; the resolver's
  `model.processes[].templates[]` gain `lead {module, name, kind}`. The web preview shows
  "Edge app-edge: …" and each process's edge path.

**Deviations:** the multipart hooks add `job` (the outbox relay's payload codec; the contract
listed eight hooks). The search placeholder has no hooks file, so `search-application-bindings`
stays `unfinished`. `entry.ts` and `tile-process.ts` are written by the processes owner whenever
an HTTP process exists (not by `local.module-stubs`), so a template-only design compiles. An extra
Docker smoke of the v2 module design was run (not required; see evidence).

**Tests.** New `http-wiring.test.ts` (6): route table (stub stack + cache read, v2), edge config
and compose service, no edge when internal and the `edge` ID refusal, hooks files and gaps (on
and off), provisioning, route stub files on/off. `tile-processes.test.ts` updated for the edge
and route stubs. E2E `module-authoring.spec.ts` checks the edge line and the stub routes.
Fixture `stubStackWithCacheRead()` in `spec/src/fixtures/stub-stack.ts`.

**Checks.** `pnpm check` exited 0: **602 tests in 85 files** (lint: only the existing info).
**E2E: 67 passed (4.3m)** on the first full run. Web build passed (1.2s, the existing chunk-size
advisory). Both exports (stub stack + cache read, v2 module design) install and build.

**Gates.** Off pin passes. Frozen v2: fresh `export:v2`, 72 files, 70 byte-identical to
`generic-export.tar.gz`; manifest/report equal without their inventory. v1 byte-identical.
YouTube Overview PNG `472a4c8c…dc9f`. **Docker** (`jeeves-tp05-http`, 45450–45452): first-run
48.1s, edge and 5 `app-*` healthy (60 s after the last request too, 0 restarts, only the edge
publishes a port); every stub route 501 "Not implemented: <name>" for any method and subpath,
cache route 501 naming `key`, unknown and internal routes 404 at the edge, Stats search 501
inside the network; stop 2.3s, start 31.0s, same answers. Cleanup verified against the owner's
recorded Docker state.

**Mouse check** (scripted Chromium; my API 4375 with scratch DB `jeeves_tp05`, now dropped, and
Vite 4365): TinyURL 7 tiles and 7 lines at both sizes; blank → Consume → Microservice → Rate
limiter and Data access, tick, Preview lists the edge and both stubs' routes. No page or console
errors. My first script run used a wrong fan locator (script bug). All projects deleted;
`jeeves_e2e` has no leftovers.

**For TP06.** Loop stubs and worker processes are untouched: give loop stubs `ModuleMessage`
(already in `entry.ts`) and add loops to `HttpMount`-like wiring and report `loops`.
`tile-process.ts` imports `admission.ts`/`http.ts`, which exist only beside an HTTP process; a
worker-only design needs them emitted or the loop helpers split out. The asset lifecycle shares
the multipart's schema (`upload_multipart` in v2), where multipart already creates
`uploads` and `outbox` (destinations `["jobs"]`) in `100-upload-multipart.sql`; its persistence
also creates `outbox`, so merge them (one outbox with `jobs` and `publication`). Use
`mountedHooksGap` for the remaining gaps. The transcoder still runs the `app` target.

**For TP07.** Route stubs get `unprovisioned<Deps>(name)`; replace that in the process file with
`module-clients.ts`. Stub `depends_on` stays empty until then.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP06: consume loops

Per the [tile processes plan](plans/tile-processes/units.md) (Owner decision 4) and
[contract](plans/tile-processes/contract.md) §3–5. Docs: the generator README (consume loops,
failed queues, retry policy, provisioning), `studio.md` (Experimental project export), a playbook
lesson, the plan's status and the HUMAN_FEEDBACK resolution. Evidence:
[tp06](plans/tile-processes/evidence/tp06/README.md).

- **Resolver:** a loop stub's row in `model.processes[].stubs` gains `consumes` (`NormalizedLoopQueue`:
  queue element, name, saved mode and provider, link, source path). Only with the option on.
- **Runtime scaffolds:** `tile-process.ts` is now dependency-free (`NotImplemented`, the generic
  rate-limited `createProcessLog`, `createNotImplementedLog`, `unprovisioned`); the 501 wrapper and
  `stubRoutes` moved to `tile-http.ts` (HTTP processes only); new `tile-loop.ts` (any loop):
  `startModuleLoop` on `createConsumer` and the delivery runner, `moduleHandler` ("Not implemented"
  → `NonRetryable("NOT_IMPLEMENTED")` with one log line; other errors wait
  `retryDelay(n) = min(250 ms × 2^(n−1), 10 s)` then rethrow, 5 retries, then `RETRY_EXHAUSTED`;
  stopping aborts the wait), `createLoopLog` (`not-implemented` and `loop-error` lines),
  `watchHooks`/`templateHandler` (an AsyncLocalStorage note of the hook a message reached, so a
  template loop's line names it while the template keeps its own decision).
- **Wiring** (`src/v2/loop-wiring.ts`, used by `tile-processes.ts` beside `http-wiring.ts`; the
  mount type is now `ProcessMount` with `loops` rows): loop stubs (one loop per consumed queue,
  concurrency 1, before the HTTP service so they drain after it); asset lifecycle
  (`startAssetLifecycleWorker` on the new `<results>--<tile>` subscriber, publication relay, its
  `assets`/`receipts` in the upload selection's schema, one shared outbox `jobs`+`publication`
  created by the multipart migration, logins and grants); Video HLS (`startMediaWorker` after
  `verifyVideoRuntime()`, `target: media`); event counter (`startCounterWorker`, `receipts`,
  `totals`, view `<schema>_public.totals`); search projection placeholder loop. Hooks files for
  the three mounted leads; their gaps become `custom` (`mountedHooksGap` takes the answer wording).
- **Stubs:** a loop stub's `<module>.ts` takes `(dependencies, message: ModuleMessage)`; its
  `.slots.ts` turns the consumed property into a comment (descriptor kept, `QueueConsumer` import
  dropped). Off: unchanged bytes.
- **Provisioning:** the foundation adds each queue a loop stub consumes (provider unspecified or
  self-hosted, `stubProvisioned` in `local-contract.ts`) as a resource with a consume user for the
  stub's tile; the processes owner contributes its `broker` subscriber rows (and the lifecycle's).
  Other providers: required `unsupported` gap `provider-<module>-<queue>`, not runnable.
  Primitives emit `amqp.ts`/`delivery.ts` for a loop stub. Report rows list `loops`.

**Deviations / clarifications:** (1) Contract §5 says a waiting message "is left unacked"; the
unchanged delivery runner republishes a failed message even while closing, so a stop that cuts a
retry wait short republishes it for its next attempt (attempt count +1) before closing;
undelivered prefetched messages stay unacked. (2) The template hook "logs" through the process's
`watchHooks` wrapper, not inside the hooks file. (3) A failed message that reached no
unimplemented hook logs a `loop-error` line (not in the contract). (4) `ModuleMessage.source` is
the consumed queue's name. (5) Template loops keep their envelope rule: a message without a
`messageId` is `MALFORMED_MESSAGE` before any hook (logged as `loop-error`). (6) Two loops in one
tile on one topic share `<topic>--<tile>`, so each message reaches one of them (README limit).

**Tests.** New `tile-loop.test.ts` (7: emitted scaffold on the real delivery runner — terminal,
rate limit, retry/backoff timings, drain cutting a wait, drain waiting for the message in hand,
template hook naming) and `loop-wiring.test.ts` (7). Updated `tile-processes.test.ts`,
`http-wiring.test.ts`, spec `runnable-processes.test.ts` (consumes), e2e `module-authoring.spec.ts`
(the processes test now connects a Worker's Event consumer by mouse and checks "loop on
queue-or-topic"; alone: passed, 10.1 s).

**Checks.** `pnpm check` exited 0: **616 tests in 87 files** (lint: only the existing info).
**E2E: 67 passed (4.3m)** on the first full run. Web build passed (996ms, the existing
chunk-size advisory). `jeeves_e2e` has no leftover projects.

**Gates.** Off pin passes. Frozen v2: fresh `export:v2` 72 files, 70 byte-identical to
`generic-export.tar.gz`; manifest/report equal without inventory. v1 byte-identical. YouTube
Overview PNG `472a4c8c…dc9f`. **Docker** (`jeeves-tp06-loops`, 45460–45462): first-run 47.2 s;
`visits--visit-worker` and `uploaded` 1 consumer each; one message to Visits and one to Uploaded
each logged one `not-implemented` line and landed in its `.failed` with `x-terminal-code:
NOT_IMPLEMENTED`, attempt 1; all healthy 95 s later, 0 restarts, no restart policy; stop 2.1 s
(all exit 0), start 26.1 s, both dead letters kept and loops resubscribed; a burst after restart
logged once then `suppressed: 4`. **Optional v2 smoke done** (`jeeves-tp06-v2`, 45463–45465):
first-run 129.1 s, all 8 `app-*` healthy (transcoder on the media image), each worker queue 1
consumer; one message each reached `.failed` with the hook named. Cleanup verified against the
owner's recorded Docker state (volumes, networks, image tags, ports, container IDs; 42 healthy).

**Mouse check** (scripted Chromium; my API 4376 with scratch DB `jeeves_tp06`, now dropped, and
Vite 4366): TinyURL 7 tiles and 7 lines at both sizes; blank → Consume → Microservice → Queue or
topic → Worker service, an Event consumer connected to the queue with the Connect tool, Generate
project, tick, Preview: "Processes · 2 · runnable", "loop on queue-or-topic". No page errors (the
PNG export's canvas readback warning aside). All projects deleted.

**For TP07.** Route and loop stubs still get `unprovisioned<Deps>(name)` (`routeStub` in
`http-wiring.ts`, `stubLoops` in `loop-wiring.ts`); replace both with `module-clients.ts`. The
foundation's stub-queue block in `local.ts` (after the selection loop) and `stubProvisioned` are
the place to generalize stub provisioning; the resolver's `consumes` covers only consumed queues,
so publishers (Visit/Upload publisher) and other stores need their own facts. `tile-loop.ts`'s
`loopBroker` duplicates `service-resources`' `broker` for stub-only designs.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP07: provisioning for stubs

Per the [tile processes plan](plans/tile-processes/units.md) (Owner decision 3) and
[contract](plans/tile-processes/contract.md) §6. Docs: the generator README (provisioning for
stubs, module clients, credentials), `studio.md` (Experimental project export), a playbook
lesson, the plan's status and the HUMAN_FEEDBACK resolution. Evidence:
[tp07](plans/tile-processes/evidence/tp07/README.md).

- **Resolver:** each stub row gains `stores` (`NormalizedStubStore`: element, kind, the link's
  access by the new shared `stubLinkUse`, saved provider, engine, queue mode, object access) for
  every store link and every queue it publishes to; consumed queues stay in `consumes`. MA05's
  ownership is only read: another owner's database, bucket or index is `read` with
  `boundary: "published-read"`. Only with the option on; nothing is written.
- **Foundation** (`local.ts`; `stubStores`, `stubUnsupported`, `localLogin` in
  `local-contract.ts`, replacing TP06's queue block and `stubProvisioned`): each tile's stub
  stores, merged with the widest access, become resource users beside the templates', then
  rows: a login per database (CONNECT and USAGE on `public`; SELECT on every contributed view of
  another owner's database), a subscriber per consumed topic, a key per bucket with read/write.
  Caches and search services come from the resources. Another provider or engine is a required
  `unsupported` gap `provider-<module>-<tile>`.
- **Clients:** new scaffold `src/runtime/module-clients.ts` (sections kept per use, like
  `service-resources`): `databaseClient`, `queuePublisher`, `cacheClient`, `objectClient`,
  `searchClient`, `httpTarget`, `unavailable`, `createProbeLog`; one 5 s probe each, logged as
  `{"event":"probe",…,"result":"ok"}`, a failure fails startup. `client-wiring.ts` builds the
  process's `clients` and `dependencies["<module>"]` for every stub (library ones too) before
  loops and HTTP; route and loop stubs use them (`unprovisioned` is gone from
  `tile-process.ts`). Module links call the target stub's entry point. Primitives emit the
  needed libraries. Report rows gain `stores` (`provisioned` or `unsupported`); Preview shows
  "Provisioned: …" per process. A worker with no loop keeps its idle timer even with clients.

**Deviation:** Identity is never a real client for stubs. The contract's exception (a template on
the same tile binds that Identity) can't arise: that template's Auth guard is the tile's only
one, and the derivation refuses a second, so the verifier code was left out.

**Tests.** New `client-wiring.test.ts` (6) and `module-clients.test.ts` (7, the emitted scaffold on
in-memory fakes); spec `runnable-processes.test.ts` +1; updated `tile-processes`, `http-wiring`,
`loop-wiring` tests and the e2e processes test (Preview's `stores` and "Provisioned:" line).

**Checks.** `pnpm check` exited 0: **630 tests in 89 files** (lint: only the existing info).
**E2E: 67 passed (4.3m)** on the first full run. Web build passed (956 ms, the existing
chunk-size advisory).

**Gates.** Off pin passes. Frozen v2: fresh `export:v2` 72 files, 70 byte-identical to
`generic-export.tar.gz`; manifest/report equal without inventory. v1 byte-identical. YouTube
Overview PNG `472a4c8c…dc9f`. **Docker** (`jeeves-tp07-stubs`, 45470–45472): first-run 67.7 s;
`d_links_db` with logins for Links API and Visit worker (CONNECT, USAGE, no CREATE, no table
grants), `visits` exchange + `visits--visit-worker`, `uploaded`, both `.failed`, bucket `archive`
with `s3-upload-api` RW and `s3-visit-worker` R, `cache-links-cache` (password) and
`search-stats-index` (no index); all 8 probes ok; 10 containers healthy, 0 restarts (also 60 s
later); stub routes 501, unknown 404, one message each to Visits and Uploaded in `.failed` with
`NOT_IMPLEMENTED`; stop 3.0 s, start 42.9 s, same 10 secret hashes, same 5 volumes, probes ok
again. **Optional v2 smoke** (`jeeves-tp07-v2`, 45473–45475, 121.8 s): Watch's login reads only
`counter_sum_public.totals`. Cleanup verified against the owner's recorded Docker state.

**Mouse check** (scripted Chromium; my API 4377 with scratch DB `jeeves_tp07`, now dropped, and
Vite 4367): TinyURL 7 tiles and 7 lines at both sizes; blank → Microservice with Database and
Cache, a Data access and a Rate limiter connected by the Connect tool, tick, Preview:
"Provisioned: Cache (cache, read-write), Database (database, read-write)". No page or console
errors. My first script run timed out on a click I had left in by mistake; two of its projects
were deleted afterwards. All projects deleted.

**For TP08.** Run the stub stack as in this evidence; the v2 module design already comes up with
every probe passing. `report.processes.tiles[].stores` lists what each stub tile got. A stub
client's probe line is in each `app-*` log. OpenSearch's container exits 143 on `pnpm stop` (its
JVM); every `app-*` exits 0.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP08: run the rebuild

Per the [tile processes plan](plans/tile-processes/units.md) and [contract](plans/tile-processes/contract.md)
§8. Acceptance only: no code changed and no defect needed fixing. Docs: the evidence, a playbook
lesson, the plan's status and the HUMAN_FEEDBACK resolution. Evidence:
[tp08](plans/tile-processes/evidence/tp08/README.md).

- **Stub stack** (`jeeves-tp08-stub`, 45480–45482): exported with processes on (71 files,
  runnable); install 0.3 s, build 0.4 s, first-run 63.8 s; edge and 4 `app-*` healthy (also 66 s
  after the last request), 0 restarts. 43 requests: 34 stub 501s naming the stub (any method and
  subpath, Stats search inside the network), 404 for internal, unknown and loop paths. One message
  each to Visits and Uploaded: one `not-implemented` line each, both in `.failed` with
  `NOT_IMPLEMENTED`, attempt 1. Every resource and all 8 probes as in TP07. Stop 2.9 s, start
  42.5 s: same 10 secret hashes, 5 volumes, dead letters, answers; a second pair after the restart
  went the same way.
- **v2 module design** (`moduleAuthored(tileLevelTwin(), installed)`, `jeeves-tp08-v2`,
  45483–45485): 98 files, runnable; first-run 113.7 s; 8 `app-*` and 6 providers healthy, 0
  restarts. Migrations in `d_metadata_db` (3) and `d_view_counts` (2), 1 consumer per queue,
  FFmpeg verified before ready, sweep and relay seen in Postgres statistics. Upload's six routes
  501 `principal`, cache read 501 `key`, search query 501 (placeholder), Watch's two stubs 501.
  Messages to the four worker queues each reached `.failed` with the hook logged
  (`MALFORMED_MESSAGE` for the three codecs, `NOT_IMPLEMENTED` for the search placeholder). Stop
  4.5 s, start 62.8 s: same 19 secrets, volumes, dead letters and answers. Per-tile table in the
  evidence. By mouse, ticking Runnable processes on the replayed design and downloading the ZIP
  gave the same 98 files, byte for byte.
- **Off:** the pre-TP04 generator (`git archive 55bf76c` into scratch) and today's both export
  frozen v2, the v2 module design and the stub stack with processes off alike (72/77/52 files;
  every payload byte; provenance equal without inventory), and match TP04's off pin. Frozen v2
  70 of 72 byte-identical to `generic-export.tar.gz`. v1 byte-identical. YouTube Overview PNG
  `472a4c8c…dc9f`.

**Findings** (none blocks the goal; ranked): (1) a run reaches only the first unwritten hook on
each path, 5 of 37; (2) template processes log only "Application ready", so their startup work is
invisible in logs; (3) template dead letters say `MALFORMED_MESSAGE` for an unwritten codec;
(4) the cache read's source login and stub logins have no table grants, so a written `load` needs
a scaffold edit; (5) search stays placeholders, and the indexer probes no search client; (6) not
exercised: broker loss, stub retries in Docker, Identity for stubs; (7) the v2 stack is about
2.3 GiB at rest.

**Checks.** `pnpm check` exited 0: **630 tests in 89 files** (lint: only the existing info).
**E2E: 66 passed, 1 failed (4.4 m)** on the full run: `module-authoring.spec.ts:497` timed out in
its `build` helper waiting for Microservice's "Add linked tile"; **rerun alone it passed (9.1 s)**.
Its leaked project was deleted from `jeeves_e2e`. Web build passed (1.04 s, the existing
chunk-size advisory). **Mouse check** (scripted Chromium; my API 4378 with scratch DB
`jeeves_tp08`, now dropped, and Vite 4368): TinyURL 7 tiles and 7 lines at 1440×900 and
1280×800; no page or console errors; all projects deleted.

**Cleanup.** Both projects down with volumes, three image tags removed, scratch exports and
runtime secrets deleted. The owner's container IDs, volumes, networks and image tag/digest lists
match the record; 42 healthy, both edges 200, only 45400–45402 listen in 454xx.

**For TP09.** Check the hooks past the first one by writing one in a scratch copy (not in the
generator), and decide with the owner whether template dead letters should say
`NOT_IMPLEMENTED` and whether template startup should log its checks. TP06's scratch exports
with runtime secrets were still in the shared scratchpad (`out-stub`, `out-v2`); I left them.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — TP09: review tile processes

Per the [tile processes plan](plans/tile-processes/units.md); the last unit. I wrote the
[review](plans/tile-processes/review.md), updated the plan's status and the HUMAN_FEEDBACK entry,
and fixed what was small. Evidence: [tp09](plans/tile-processes/evidence/tp09/) (2 screenshots).

- **Decisions 1–6:** all delivered (3 with the contract's stated limits). Checked by mouse at
  1440×900 and 1280×800 (dot hit area 16.5×11.5 / 16.75×10 px at the fit; edge pan 406 / 335 px,
  then connects; a renamed Worker and its module re-key, Undo, clash; processes named by the typed
  names) and in my own Docker run of the stub stack (`jeeves-tp09-stub`, 45490–45492): first-run
  65.8 s, 10 containers healthy, 8 probes ok; stubs 501, unknown 404; a Visits message in
  `.failed` as `NOT_IMPLEMENTED`; stop 3.1 s / start 42.4 s kept 10 secrets, 5 volumes, the dead
  letter.
- **Invariants:** the off pin passes; frozen v2 72 files, 70 byte-identical, provenance equal
  without inventory; v1 byte-identical; PNG `472a4c8c…dc9f`; mouse and chat give the same batch or
  refusal in 12 `setRunnableProcesses` and rename/re-key cases.
- **Fixes:**
  - The TP08 e2e failure was a test race: `module-authoring.spec.ts`'s `build` clicked the next
    tile before the previous commit landed and selected the new tile. Reproduced by holding the
    commit's response until after the click (old helper: the same timeout; fixed: passes). It now
    waits for each new tile to be selected. No assertion changed.
  - `templateHandler` (`tile-loop.ts`) dead-letters a message that reached an unwritten hook as
    `NOT_IMPLEMENTED` instead of `MALFORMED_MESSAGE`/`RETRY_EXHAUSTED`; a template's own code
    (`INVALID_MEDIA`) and its retries are kept.
  - Each mounted or placeholder template logs one `started` line with its checks just before
    ready (`logStarted` in `tile-process.ts`, `ProcessMount.startup`).
  - Docs: the generator README (both fixes; the 501 wrapper lives in `tile-http.ts`),
    `studio-settings.md`, contract §3 notes.
  - A short v2 smoke (`jeeves-tp09-v2`, 45493–45495) showed all 7 `started` lines and four
    `NOT_IMPLEMENTED` dead letters; writing the counter's hooks in that scratch export counted
    views (dedup held) with no scaffold edit.

**Checks.** `pnpm check` exited 0: **634 tests in 89 files** (lint: only the existing info).
**E2E: 67 passed (4.4 m)** on the first full run. Web build passed (1.43 s, the existing chunk-size
advisory). Mouse check on my API 4379 (scratch DB `jeeves_tp09`, dropped) and Vite 4369: 9/9,
TinyURL 7 tiles and 7 lines at both sizes, no page or console errors; all projects deleted. The
race reproduction leaked one `jeeves_e2e` project, which I deleted.

**Cleanup.** Both projects down with volumes, three image tags removed, scratch exports and
`.runtime/secrets` deleted. The owner's container IDs, 18 volumes, 9 networks, 31 image rows and
454xx ports match the record; 42 healthy; both edges 200. No runtime secrets in the repo; every
export's `.gitignore` and `.dockerignore` cover `.runtime`.

**Next** (ranked in the review): fill hooks past the first in a field project; owner decisions on
product table grants, starting YouTube v3, HTTP settings on stub-only tiles, and the
TinyURL/Marketplace rebuild. This plan is finished.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — YouTube v3 plan from owner feedback

This entry is planning only; no code changed. I saved the owner's module add button sketch, added
the HUMAN_FEEDBACK entry, and wrote the [YouTube v3 plan](plans/youtube-v3/units.md):
V3-01–V3-17, in five phases.

| Phase | Units | Covers |
| --- | --- | --- |
| A — Studio feedback | V3-01 to V3-03 | Undo keys, two tools, Simple and Detailed, kind labels, queue or topic, the legend, the module + in the tile and the inspector |
| B — Generation gaps | V3-04 to V3-07 | The v3 contract, product tables and published views, the Auth guard template, process settings and robustness |
| C — Chat | V3-08 and V3-09 | Module-aware tools, patterns and review; design evals |
| D — YouTube v3 | V3-10 to V3-16 | Design by mouse, the `generated/` output, completion in `app/`, acceptance and benchmark |
| E — Review | V3-17 | Independent review |

Decisions D1–D8 await the owner's confirmation before V3-01.

I ran no checks: only docs changed. The owner's uncommitted `README.md` and `.docs/` are
untouched.

## 2026-11-10 — YouTube v3 decisions confirmed

The owner confirmed D1–D8 and added two directions:

- **Favorites** becomes a generic account template (V3-07, added).
- **Chat** gets tools that carry the knowledge: `applyPattern`, `previewCommands` and automatic
  review. It has exactly the mouse's surface, and evals compare a cheap model with a stronger one.
  Live paid runs need the owner's go-ahead at the time (V3-09, V3-10).

The units are renumbered to V3-01–V3-18. Docs only, so no checks were run. Next: V3-01.

## 2026-11-10 — V3-01: undo keys, two tools, simple and detailed

Per the [YouTube v3 plan](plans/youtube-v3/units.md) (owner feedback 1, 6 and 7). Docs:
`studio.md` (Lane canvas, Detailed view, Size and fit, PNG export, Layout and navigation,
Creating and connecting, Removing, History), `PLAN.md`, a playbook lesson, the HUMAN_FEEDBACK
resolution and the plan's status. Evidence: [v3-01](plans/youtube-v3/evidence/v3-01/) (2 shots).

- **Keys** (`canvas/shortcuts.ts`, in `Workspace.tsx`'s key handler): Ctrl/Cmd+Z calls the
  header's Undo; Ctrl/Cmd+Shift+Z and Ctrl+Y its Redo (not Cmd+Y, Chrome's History on a Mac). One
  `history` object gives the buttons' `disabled` and the keys' guard (history busy, failed
  drafts; Undo runs with a pending draft, Redo doesn't). Nothing happens, and the default is kept,
  with focus in an input, textarea, select or contenteditable, while any `[role="dialog"]` or open
  `<dialog>` exists (modals, the removal panel, Choose relationship), or with the button disabled.
- **Tools:** Pointer (V; the old Select button renamed, the board mode is still `"select"`) and
  Connect (C); Escape returns to Pointer. Gone: the Hand button, H, `BoardMode`'s `"hand"`, the
  tiles' inline `pointer-events: none`, the `data-mode="hand"` CSS, `elementsSelectable={!hand}`
  and every `!hand` guard in `Board.tsx`. Paper drag, wheel zoom and Fit are unchanged.
- **Views:** **Detailed | Simple**, Detailed first and the default. Stored as `"simple"`
  (`canvasViews = ["detailed", "simple"]`, same `jeeves.studio.ui.v1:<project>` key); a saved
  `"overview"` reads as Simple and is written back as `"simple"`. `LaneCanvas` and `ExportDiagram`
  now require `view`. Code and docs say Simple; dated playbook lessons keep "Overview".

**Tests.** `shortcuts.test.ts` (4: the key map, fields, dialogs) and `preferences.test.ts` (2:
order, default, old value). `board.test.tsx`: the Hand step is gone; the view test says
`"simple"`. E2E: a key test in `edit-history.spec.ts` (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Z, Ctrl+Y each
one request; disabled Redo's keys send none; none from the Name field; the Description box's
Ctrl+Z undoes only its typing; none under Export diagram or the removal panel; works again after);
`detailed-view.spec.ts` +1 (toggle order, Detailed pressed, old "overview" opens Simple and is
rewritten). `connect.spec.ts` checks exactly two tools and that H does nothing; its Hand pan is now
a paper drag in both modes, as is the PNG export spec's pan and the module-row spec's Hand step.
New helpers `showView`, `paperPoint`, `dragPaper`; `createStudy(…, "Simple")`. The specs whose steps
assumed one plain tile per element (19 failed on the first full run: centre clicks hit module rows,
Detailed draws more lines) now open Simple by mouse first; no assertion changed.

**Checks.**

- `pnpm check` exited 0: **640 tests in 91 files** (lint: only the existing info).
- **E2E:** the first full run, before those spec updates, had 49 passed and 19 failed (all the
  view default). Rerunning the affected specs: 38 passed, 3 failed (my key test assumed one Ctrl+Z
  undoes a typed word, Chrome undid one letter; two tracing specs read the canvas mid-fit, so
  `showView` now waits for it to settle). Those alone, twice each: 12/12. Final full run:
  **69 passed (4.7m)**. Two projects leaked by the first run were deleted; `jeeves_e2e` has none.
- Web build passed (2.4 s, the existing chunk-size advisory).
- **Mouse check** (scripted Chromium; my API 4381 with scratch DB `jeeves_v301`, now dropped, and
  Vite 4371), at 1440×900 and 1280×800: TinyURL foundation 7 tiles and 7 lines; tools "Pointer (V)",
  "Connect (C)"; Detailed pressed and left of Simple; a paper drag panned; Ctrl+Z, Ctrl+Shift+Z,
  Ctrl+Z, Ctrl+Y each stepped the saved design; Connect and Pointer by mouse; YouTube opened in
  Detailed (7 containers, 26 lines). No page errors, console errors or warnings; all deleted.

**Gates (D2).** The Simple PNG gate is retired. New reference: a fresh YouTube study's **Simple**
export, `472a4c8cf3f8eadf8f7c9f2dc79e20f37b19a3656abcb4587dda9b3f6d33dc9f` (3008×2752, 21
tiles, 25 lines, no `canvas`), twice at 1440×900 and once at 1280×800: unchanged from the old
Overview hash. Processes-off pin passes; v1 byte-identical (`assemble.test.ts`). Frozen v2: fresh
`export:v2`, 72 files, 70 byte-identical to `generic-export.tar.gz`; `manifest.json` and
`report.json` differ only in the source inventory as before (it lists only `jeeves/packages/spec`
and generator paths, none of this unit's).

**For V3-02.** Specs written for one plain tile per element start with `createStudy(…, "Simple")`
or `showView(page, "Simple")`; a new project otherwise opens in Detailed, where a tile's centre
may be a module row. Kind labels change faces in both views, so the Simple PNG reference above
will change; record the new one. Chrome keeps one text-undo stack per page: Ctrl+Z in an untouched
Name field undid the Description just typed (no design Undo was sent), which then autosaved.

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — V3-02: kind labels, queue or topic, legend

Per the [YouTube v3 plan](plans/youtube-v3/units.md) (owner feedback 2, 3 and 5; D2, D7). Docs:
`studio.md` (Lane canvas, Detailed view, PNG export, the fan table, the YouTube study, Layout and
Limits), `CATALOG.md` (kinds table with a Label column, link rules, YouTube), `studio-settings.md`
(queue row), playbook (notation fixed, a lesson), HUMAN_FEEDBACK resolution, plan status.
Evidence: [v3-02](plans/youtube-v3/evidence/v3-02/) (4 shots at 100%, 1440×900).

- **Kind labels.** `StudioDefinition.label` (short: Service, Worker, Uploads, Identity, Database,
  Search index, Cache, Object storage, CDN, External API, plus Gateway, Redirect, Notifications,
  Billing, Browser app) and `studioKindLabel(settings)` in `studio-definitions.ts`. **Rule:** a
  message channel is **Queue** when `settings.mode === "work-queue"` and **Topic** otherwise
  (`label: "Topic"`, the generation contract's `r.mode ?? "topic"`). The mode is required in the
  schema, so in practice the label is the saved mode; a new channel is a work queue (Queue) until
  a template derives topic. `LaneCanvas` passes the label to `Tile` (12px/700, pinned to the
  bottom; the face's top padding 22 → 14px, gap 8 → 6) and `ContainerTile` (under the name in the
  48px header; no layout change). Colour: ink mixed 62% toward the tile, 4.9:1 light, 5.5:1 dark.
  Actions and the user have none. Layouts are unchanged (sizes didn't change).
- **Queue or topic.** Kind name "Queue or topic" → **"Message channel"** (fan item, default tile
  name and ID `message-channel`, inspector kind line, chat catalog). Event publisher/consumer
  descriptions → "Publishes events." / "Consumes events.". Docs explain queue vs topic.
- **Legend (D7).** Collapsed: only the dashed sample, "Async" (the box shrinks to fit). Open:
  "Solid: a direct call; the caller waits (HTTP, a database, storage or cache read or write).",
  "Dashed: sent through a queue or topic; nobody waits.", one direction line, two trimmed help
  lines. "Request", "inferred access" (not shown in the inspector) and "shared stems" are gone.

**Line audit.** No line changed: every line already matched (new test in `studio-lanes.test.ts`:
dashed ⇔ a queue end, for all four studies). Frozen v2's 27 lines match too.

| Study | Lines | Dashed (all queue publish/consume) | Wrong |
| --- | ---: | ---: | ---: |
| TinyURL foundation | 7 | 0 | 0 |
| TinyURL extended | 12 | 2 | 0 |
| Marketplace | 23 | 4 | 0 |
| YouTube | 25 (26 Detailed) | 7 | 0 |

Not fixed (a rules question, not a study line): the link table still allows async on application
→ application, application → external API and external API → application, drawn dashed with no
channel, which the new legend doesn't describe. No study uses it. Documented in CATALOG/studio.md.

**Renames (YouTube 2.1.0 → 2.2.0; IDs kept).** Metadata database → **Metadata**; Metadata cache →
**Hot metadata** (names stay unique); Search index → **Videos**; Video CDN → **Video delivery**.
Upload service, Original/Transcoded videos and the rest read well and stay. Other studies not
renamed: TinyURL's URL cache/URL database and Marketplace's Orders service/Orders database would
collide, and many specs use them (not trivial). No `field-projects/` file or v2 fixture name
changed; v2-rebuild only picks the fan's "Message channel".

**Tests.** Spec: label rule (+1), study lines (+1); `studio-rekey.test.ts` IDs `message-channel`.
Web: `ContainerTile.test.tsx` (+1, header and face labels). Generator: `loop-wiring` header text.
E2E: `canvas.spec` (legend: only Async, the two D7 lines, no "Request"; YouTube labels incl.
Queue/Topic, none on Watch/User; renamed tiles), `spawn.spec` (each of the 11 kinds' label),
`connection-dots`, `relationship-tracing`, `ids-follow-names`, `module-authoring`, `v2-rebuild`
(kind name and renamed tiles).

**Checks.** `pnpm check` exited 0: **643 tests in 91 files** (lint: only the existing info).
**E2E: 69 passed (4.7m)**, first full run, no failures. Web build passed (1.1 s, the existing
chunk-size advisory). **Mouse check** (scripted Chromium; my API 4382 with scratch DB
`jeeves_v302`, now dropped, and Vite 4372) at 1440×900 and 1280×800: TinyURL foundation 7 tiles,
7 lines, both views (Links database "Database"); extended 11/12, 2 dashed (Click events
"Topic"); YouTube Detailed 21/26, 7 containers with header labels, Simple 21/25, 18 face labels;
Upload jobs "Queue", View and Completion events "Topic"; legend collapsed "Async" (one dashed
sample), opened by click; light and dark checked by the button. No page errors, console errors or
warnings. All my projects deleted (204).

**Gates (D2).**
- **New YouTube Simple reference:** `9332ea16be9913598eab3b53829a7bfac8052f9ccc918c27214df9172cb589bd`
  (3008×2752, 21 tiles, 25 lines), twice at 1440×900 and once at 1280×800. Detailed:
  `92359674…a9518` (3840×3200, 26 lines). The old `472a4c8c…dc9f` is retired by the labels and
  renames.
- **Processes-off pin** passes after an intended update (`fixtures/processes-off.json`, 12
  lines): frozen-v2 unchanged; v2-module-design `watch-views.ts`/`.slots.ts` and the manifest;
  stub-stack the 8 publisher/consumer stub files and the manifest. Replacing the new wording with
  the old reproduces every old hash, so the only change is the stubs' header comment ("Consumes
  events.") and slot comment ("(Message channel)").
- **v1** byte-identical (`assemble.test.ts`). **Frozen v2:** fresh `export:v2`, 72 files, 70
  byte-identical to `generic-export.tar.gz`; `manifest.json`/`report.json` equal without
  inventory (sources now include this unit's two spec files). Scratch exports removed.

**For V3-03.**
- The Simple face's kind label sits at the bottom (face y ≈ 99–114 of 122): an in-tile `+` must
  not cover it. The container header is now two lines (name, label) in the same 48px.
- A new channel is "Message channel" (`message-channel`) with label Queue; specs pick the fan's
  "Message channel".
- Generated code still says "a queue or topic" in template comments (`dependencies.ts.template`
  and others): accurate code wording, left alone to avoid churn.
- The line inspector still shows the saved interaction "Request / response (solid)".

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.

## 2026-11-10 — V3-03: module + in the tile and inspector

Per the [YouTube v3 plan](plans/youtube-v3/units.md) (owner feedback 4 and 9, D3; the
[sketch](human-feedback/2026-11-10-module-add-button.png)). Docs: `studio.md` (Lane canvas, Detailed
view, Size and fit, PNG export, Creating and connecting, Adding a module, Connect mode, Inspector,
History, Limits), `CATALOG.md`, `PLAN.md`, a playbook lesson, the HUMAN_FEEDBACK resolution and the
plan's status. Evidence: [v3-03](plans/youtube-v3/evidence/v3-03/) (4 shots).

- **One menu, one command** (`canvas/ModuleMenu.tsx`): `ModuleAddButton` (a 28px blue `+`, dark
  glyph) toggles `ModuleMenu`, a popover on <body> at screen size: "Add module to <tile>", then
  groups Template / Part of a template / Stub (fieldset + legend pill), two kinds to a row, each
  with icon, name and full one-line description; the status is the group (also in each item's
  accessible description). A click on the `+` again, a press elsewhere, the wheel, a resize or
  Escape closes it; a pick runs `addModule(projectId, host, kind)` and the workspace opens the
  module with its Name focused. Keyboard activation focuses the first item. `moduleMenuGroups`
  replaces `creation.tsx`'s `moduleItems`; the module tab is gone from `creation.tsx`.
- **Where the `+` is:** Detailed: every container's footer, centred, selected or not.
  `detailedView.ts`: every tile with `moduleKinds` (Service, Worker, Uploads, Redirect,
  Notifications, Billing) is a container, so an empty one is 256×96 (header + footer);
  `CONTAINER.footer` 48 (padding 16 stays for a container that can't take modules);
  `DetailedContainer.addable`. Heights are 96 + 32·rows; row and header ports unchanged (all on the
  grid). Simple: the selected tile's top-left corner (8px in), clear of icon, name, kind label and
  the top-right warning mark. Inspector: under the Modules cards; the section now shows for any
  tile that can hold modules. None in Connect mode or exports (`BoardModuleAdding` context, given
  only by the live canvas in Pointer mode).
- **Placement:** board menu beside the tile (below, right, left, above; `placeBeside`) inside the
  canvas, else beside it in the window (over a rail), else least cover. Inspector menu: left of the
  rail, top level with the `+`, slid into the window.
- **Board (generic):** a tab opens its fan by a **click** (toggle; click-away, wheel, resize and
  Escape close; items are clickable, tips on hover); a pull still works (kept, it cost nothing).
  `placeGrid(centers, board, avoid)` puts a grid fan that would cover its tile beside it instead
  (left at the tab's height, below, above; its panel kept 2px clear), else least cover;
  `placeBeside` is exported for any box. **Removed (dead):** before-side tabs (`CreateTab.side`),
  `badge`, `columns`, `FAN_CELL_DETAIL`/`FanCell`, `FanItem.detail`/`description`, `fanCenters`'
  and `fanGrid`'s `before`, `underTileOrigin`'s side and their CSS. Layout's `DockSide` is kept.

**Tests.** Board: `fan.test.ts` (grid beside its tile: left, below, above, squeezed;
`placeBeside`), `board.test.tsx` (the detail-caption test became the click test: toggle, press on
fan/panel keeps it, click-away, Escape, wheel, keyboard, pick). Web: `ModuleMenu.test.tsx`
(groups; toggle/close/pick; which tiles show the `+`), `detailedView.test.ts` (every host a
container, exact heights, an empty Service 96px with header ports; v2 worker 192). New
`e2e/module-menu.spec.ts` (5): empty Service container with its `+` (centred at the bottom inside
the frame), toggle, click-away, Escape, pick, Connect hides it; Simple `+` clear of the label;
inspector `+` left of the rail, same kinds; link fan by click; narrow canvas (1280×800, both
rails) fan beside its tile. Updated to clicks: `spawn` (one pull test kept), `module-authoring`
(menu kinds and statuses), `ids-follow-names`, `v2-rebuild.ts` (tabs and `+` by click, in
Detailed). Header clicks instead of centre clicks (a taller container's middle is a row):
`detailed-view`, `ids-follow-names`, `edit-history`, `modules`; `detailed-view` Transcoder
256×256 and the foundation's two Services now containers.

**Checks.**
- `pnpm check` exited 0: **647 tests in 91 files** (lint: only the existing info). The board's
  edge-pan test ("pans while a connect drag is held…") failed once in four isolated runs while I
  worked (timing; this unit doesn't touch it); it passed in `pnpm check`.
- **E2E:** first full run 72 passed, 2 failed (`edit-history.spec.ts:96`, `modules.spec.ts:187`:
  centre clicks now landing on a module row); fixed to header clicks, alone 2/2 passed; final full
  run **74 passed (4.3m)**. The v2 rebuild passes by mouse (1.4m alone). A project leaked by the
  failed run was deleted from `jeeves_e2e`; none remain.
- Web build passed (1.0 s, the existing chunk-size advisory).
- **Mouse check** (scripted Chromium; my API 4393, scratch DB `jeeves_v303`, now dropped, Vite
  4383) at 1440×900 and 1280×800: TinyURL foundation 7 tiles, 7 lines, 2 containers with a `+`;
  extended 11/12; container menu (10 kinds) beside Redirect service, not over it; click-away and
  a second click close it; Simple `+` only on the selected tile, a pick focused "Rate limiter";
  inspector menu's right edge 12px left of the rail; link fan 11 items by click, second click
  closes, a pick added a tile; dark mode menu beside its tile; Escape closes. Worker menu (16
  kinds) 468×713, on screen at 1280×800. No page errors. All my projects deleted (204).

**Gates (D2).** YouTube **Simple** export unchanged: `9332ea16…89bd` (3008×2752), twice at
1440×900, once at 1280×800. Detailed changed (containers +32px):
`21fe8400b200a4f0a3bb010e45038f8fd49420b16a23daaf071a1e7ce0219ae1` (3840×3392; was
`92359674…a9518`, 3840×3200). Processes-off pin passes; v1 byte-identical (`assemble.test.ts`).
Frozen v2: fresh `export:v2`, 72 files, 70 byte-identical to `generic-export.tar.gz`;
`manifest.json`/`report.json` differ only in emitter sources/hashes and the added
`local.module-stubs`/`local.tile-processes` implementations (155 inventory paths, none of this
unit's). Scratch exports removed.

**For V3-04 (docs only).**
- V3-11 builds v3 by mouse with: link tab click → kind click; container `+` click → kind click
  (Detailed, no selection needed); Connect drags unchanged. `e2e/studio.ts` has `openFan`,
  `pickFrom`, `addModuleFrom`, `moduleMenu`, `settledBox`.
- In Detailed every Service/Worker/Uploads is a container even when empty, so a centre click on a
  container may open a module row: click its header (`{ position: { x: 20, y: 12 } }`).
- The `+` is small at the fit (about 8–9px at YouTube's Detailed fit); the menu itself is screen-size.
- Not done: the menu doesn't follow a camera that moves while it is open (the wheel closes it).

The owner's uncommitted `README.md`, `.docs/`, `.jeeves-feedback/` and the mode of
`e2e-docker.sh` are untouched and unstaged.
