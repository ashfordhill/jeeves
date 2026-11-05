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
