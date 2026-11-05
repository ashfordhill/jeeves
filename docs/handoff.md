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
