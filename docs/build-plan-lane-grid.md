# Lane grid and creation system: build plan (first version)

**Status: proposed 2026-11-04. Not started.** The owner assigns units one at a time. Execution
queue: [lane-grid execution units](plans/lane-grid/execution-units.md) (LG01–LG13).

This plan replaces the studio canvas (C1/C2/C3 tabs, ELK compound layout, merged lines, row-order
drag, Library) with a locked lane grid ported from automation-illustrator
(`~/github/automation-pitch`, commit `0803c4a`). It covers the grid and the creation system only.
Anything else is added later, when the owner asks for it.

## 1. Why

The owner still finds the studio grid messy and wants automation-illustrator's control. The old
studio already used ELK with automation-illustrator's layout options (SG06). The mess came from
what it laid out: three levels, compound frames, islands, 20+ boxes and a text label on every
line. automation-illustrator stays clean because of its **rules**: one root, a connected acyclic
graph, forks centred on the parent, merges through one bus, few big tiles, almost no words, and
creation only from a selected tile. This plan ports those rules as well as the layout. Since the
grid is rule-managed, chat edits go through the same rules ("add a cache after Redirect on the
download lane").

## 2. Decisions

| # | Decision |
| --- | --- |
| L1 | One canvas. No C1/C2/C3 tabs and no overview above it. It always starts from one **actor** tile: a "mobile and desktop user" drawn with automation-illustrator's human figure. The actor has no settings and cannot be deleted. |
| L2 | The actor starts two **lanes**: **download** (receive, view, consume) above and **upload** (create, post) below. A lane is the actor's outgoing links that carry that lane. |
| L3 | Every tile hangs off the actor: the design is a connected acyclic graph rooted at the actor. **No islands, no cycles.** Validation enforces this, so the canvas, chat and API share one rule. |
| L4 | Lines carry no words. **Solid** = synchronous request. **Dashed** = asynchronous link, plus every link that continues after one (a fork that "continues later"). Lane entry lines carry a download or upload icon chip. Words stay in the inspector. |
| L5 | The `+` picker shows **seven tile types as icons**: Service, API, Database, Cache, Queue, Storage, External. Each type maps to existing kinds; the exact kind is an icon row in the inspector (owner, 2026-11-04). Browser app is not creatable: the actor is the client. |
| L6 | Creation as in automation-illustrator: only the selected tile shows controls. Each side has `+` (synchronous link) and `---` (asynchronous link). Dragging a tab stretches a thick rubber band. Releasing over the icon fan creates a tile at the next slot; releasing on another tile links to it (a merge). The right side adds after the tile, the left side inserts before it. The actor shows one `+` per lane. |
| L7 | Delete as in automation-illustrator: a red X on the selected tile removes it and restitches its predecessors to its successors wherever the link rules allow. If that would strand tiles, one confirmation lists them and removes them too. |
| L8 | Layout is automatic: ELK layered, left to right, 32px grid, automation-illustrator's options and stability hints. No positions are stored. Branching is bounded: at most 4 outgoing links per tile and 3 entries per lane. |
| L9 | **Modules** (the old C3 components) are a list in the right-side inspector of a service tile: add, remove, configure. They are not drawn. |
| L10 | Grid code lives in its own package, `packages/board` (`@jeeves/board`), ported from automation-illustrator, with **no Jeeves imports** (lint-enforced). Jeeves tiles, rules and the actor are built on top of it. |
| L11 | Kept: the studio data model (plus one `entries` list), the blueprint API, operations and history, inspector forms, the chat rail and Settings. Removed: ELK compound layout, C1/C2/C3 tabs and projections, merged lines and their chooser, row-order drag, Library and presets, New island, the Connection tool and package frames. |
| L12 | No backwards compatibility. Projects made before the lane canvas are deleted (owner, 2026-11-04). |
| L13 | Chat edits through the same lane commands as the mouse. |

Mouse first. Optional shortcuts: V (select), H (pan), Escape (cancel a pull or picker).

## 3. Model (`packages/spec`)

### Entries

`architecture.studio.entries`: `[{ id, lane: "download" | "upload", element }]`. Each entry is a
link from the actor to a tile. The actor itself is not stored; it is always there. Its graph key
is `@actor`, which `idSchema` can never produce. Ordinary links stay design `connections`.

### Tile types

| Tile type | Picker icon | Kinds (first is the default) |
| --- | --- | --- |
| Service | `server` | service, worker, redirect, identity, notification, billing |
| API | `api` | gateway, cdn |
| Database | `database` | database, search |
| Cache | `bolt` | cache |
| Queue | `list` | queue |
| Storage | `archive` | object-store |
| External | `plug` | external-api |

A Service spawned after a queue defaults to worker. The tile face shows the kind's own icon
(`studioDefinitions[kind].visual.icon`). The cache icon changes from `archive` to `bolt` so every
kind's icon is distinct. `browser` stays in the schema but is not offered.

### Link rules

Today's `kindConnectionDefaults` (`apps/web/src/studio/actions.ts`) moves into the spec unchanged
and gains a mode (`sync` or `async`):

| Source → target | Sync (`+`) | Async (`---`) |
| --- | --- | --- |
| actor → any Service kind except worker; gateway, cdn, object-store, external-api (an entry) | yes | no |
| application → database, cache | yes (uses-database) | no |
| application → object-store, search, cdn | yes (depends-on) | no |
| application → application, external-api | yes (calls) | yes (calls, Asynchronous) |
| application → queue | no | yes (publish) |
| queue → application | no | yes (consume) |
| external-api → application | yes | yes |
| cdn → application, object-store | yes | no |
| database, cache, object-store, search → anything | no (end tiles) | no |

"Application" means the Service and API kinds except cdn. Resources stay end tiles, as the
current model already requires. So the brief's "Link cache → Links database" is drawn as Redirect
forking to both, and the blueprint's meaning does not change. A new database, cache, storage or
queue is owned by the application on the other end of its first link. A queue with no application
next to it is refused.

### Lane graph and rules

`laneGraph(design)` projects the design into a board graph: the actor, then tiles breadth-first
from the download entries, then from the upload entries (children in connection order). This order
puts download above upload. A link is `async` when its interaction is `Asynchronous`. It is
`dashed` when it is async or when its source can only be reached through an async link.

A new structural finding, `LANE_INVALID`, rejects any batch that leaves a tile unreachable from the
actor, closes a cycle, links kinds the table above forbids, uses an entry kind the table forbids,
or exceeds the caps (4 outgoing links per tile, 3 entries per lane).

### Lane commands

These are new `buildStudioCommand` types, shared by the canvas, chat and API:

- `addTile`: after a tile or from a lane (an entry), or before a tile. Before means every incoming
  link (or entry) of the host moves to the new tile, and then the new tile links to the host.
  `sync` or `async`.
- `linkTiles`: links an existing tile or a lane to an existing tile (merge).
- `removeTile`: removes a tile and restitches it. It must name every tile it strands in
  `alsoRemove`, otherwise it is refused.
- `removeLink`: removes a connection or entry. Refused if anything would be stranded.
- `changeKind`: switches to another kind of the same tile type. Settings reset to that kind's
  defaults; refused if any link becomes invalid.

The existing `edit`, `editSystem`, `editConnection` and component commands stay.

### Blueprint

`blueprint: 1` gains `entries: [{ lane, element }]`, which records which tiles the user reaches
directly. That fact used to be carried by the Web app's links. Nothing else changes.

## 4. Canvas behaviour

- **Tiles.** 128×128, with the kind icon (40px) and a short name of up to two lines. Database,
  Cache, Queue and Storage tiles are pills (radius 32); others are rounded rectangles (radius 14),
  like automation-illustrator's Data and Step tiles. The actor tile is 128×160 with the human
  figure.
- **Lines.** ELK orthogonal routes, edge to edge: 2.75px, 4px when selected; dashes 8/7 with the
  phase locked to world coordinates (automation-illustrator `polylineDrawSegments`). Lines are
  clickable (44px hit band).
- **Layout.** Automation-illustrator's `ROOT_OPTIONS` (layered, RIGHT, orthogonal, BRANDES_KOEPF
  BALANCED, mergeEdges, model order, 32px grid, node gap 32, layer gap 64) and FIXED_POS west/east
  ports. The previously displayed positions are passed as stability hints, so forks keep their
  rows. A new tile gets a dock hint at the next slot beside its source. Changes animate for 200ms.
  The canvas fits once on the first layout; **Fit** refits.
- **Selection and inspector.** Selecting a tile opens its inspector: a type-variant row, General,
  Options, Connections, and Modules for services. Selecting a line opens its connection form, and
  changing Interaction changes its dash. Selecting an entry line shows its lane and target.
  Selecting the actor (or nothing) shows the system name and goal.
- **Creation and delete.** As in L6 and L7. Tabs appear only on sides and modes with at least one
  valid choice. The fan offers only tile types whose link is valid. Invalid drop targets dim
  during a pull. Each action is one batch and one undo step.
- **Empty project.** Only the actor, selected, with its two lane tabs.

TinyURL in lanes, the only study:

- Download lane: User ⬇ CDN → Redirect service → Link cache and Links database. Redirect service ⇢
  Click events ⇢ Analytics worker ⇢ Analytics store (all dashed).
- Upload lane: User ⬆ Shorten API → Links database, Link cache and URL reputation API.
- Links database and Link cache are merges reached from both lanes. In total: 10 tiles (actor plus
  9), 11 lines, 3 dashed. The Web app, the C1 people and the Link platform package go. The eleven
  modules stay.

## 5. `packages/board`

`@jeeves/board` exports `.` (React layer and layout) and `./graph` (pure, dependency-free).
`@jeeves/spec` imports only `@jeeves/board/graph`. React, React DOM and React Flow are peer
dependencies (same exact versions as the web app), so the bundle keeps one copy of each. Every
ported file starts with `// Ported from automation-illustrator <path> (0803c4a).`

| automation-illustrator | `packages/board/src/` | Drop |
| --- | --- | --- |
| `workflow/graph.ts` | `graph/reach.ts`, `graph/check.ts` | Before/After overlay, Split, assignments, positions |
| `workflow/commands.ts` | `graph/edit.ts` | insert-on-path/bundle, overlay pruning, labels (M:N removal uses fan pairings) |
| `board/layout/tileMetrics.ts` | `layout/metrics.ts` | Step/Data sizes (sizes are passed in), vertical branch |
| `board/layout/elkGraph.ts` | `layout/elkGraph.ts` | word-web mode, vertical profile |
| `board/layout/elkLayout.ts`, `laneLayout.ts` | `layout/elkLayout.ts` | |
| `board/layout/layoutEngine.ts` | `layout/engine.ts` | per-lane channels (one channel) |
| `board/routing/polyline.ts` | `layout/polyline.ts` | restitch dash |
| `board/layout/useAnimatedLayout.ts` | `layout/animate.ts`, `react/useAnimatedLayout.ts` | |
| `board/layout/useLaneLayout.ts` | `react/useBoardLayout.ts` | store coupling |
| `board/firstLayoutCamera.ts`, `zoom.ts` | `react/camera.ts` | compare/present cameras |
| `board/routing/FlowArrow.tsx` | `react/BoardLine.tsx` | restitch, stretch, insert hover, label editor, menu |
| `board/Board.tsx`, `controls/PathHostFrame.tsx` | `react/Board.tsx` | lanes, simplify, present, departing |
| `board/controls/TileChrome.tsx` | `react/TileChrome.tsx` | tile pickup/insert drag |
| `board/controls/plusPreviewLayout.ts` | `react/fan.ts` | fixed Step/Data pair (N items) |
| `board/controls/tileOverlay.ts`, `PathKnotIcon.tsx` | `react/overlay.ts`, `react/DashGlyph.tsx` | |
| `app/styles/tokens.css` (chrome rules, about lines 1169–1480) | `react/board.css` | theme tokens become `--board-*` variables |

The ELK worker client (`board/layout/elkClient.ts`) and the human figure (`board/tiles/human-figure.svg`,
`HumanFigure.tsx`, `svgInner.ts`) are app concerns. They go to `apps/web/src/canvas/`.

## 6. Verification

Every unit runs `pnpm check`, `pnpm test:e2e` and `pnpm --filter @jeeves/web build`, and does a
browser check when it changes anything visible (AGENTS.md). Unit tests stay few and focused on rules
that are costly to get wrong: graph edits, link rules, layout determinism and lane commands. There
are no click-a-button tests. The E2E smoke set changes with the canvas:

| After | Specs |
| --- | --- |
| LG01–LG05 | unchanged (5 tests) |
| LG06 | levels counts and blueprint service list updated for the lane-form study |
| LG07–LG08 | `canvas` (10 tiles, 11 lines, 3 dashed), `edit-history` (a service setting), `blueprint-chat`; `spawn` paused |
| LG09 | `spawn` back: `+` fan creates a tile, `---` drop links async |
| LG10 | delete with restitch and undo |
| LG11 | `edit-history` edits a module again |
| LG12 | chat scripted turn adds a tile |

## 7. Out of scope (later, when the owner asks)

Device differentiation on the actor, admins and other personas, links back to the user
(notifications) and other cycles, modules drawn on the canvas, dragging a tile onto a line to
insert it (automation-illustrator's tile drag), vertical mode, package UI, removing C1 context and
packages from the format, and a C4 export.

## 8. Assumptions made without asking

- Resources are end tiles (existing rule), so lanes fork at services instead of chaining through
  caches.
- The caps are 4 outgoing links per tile and 3 entries per lane. They are one constant in the spec.
- Picker items are icons only; the name is in the tooltip and accessible label.
- C1 nodes and relationships and packages stay in the format, but the canvas neither shows nor
  creates them. The server's layout route stays but the canvas no longer writes row order.
- Fit target: the whole TinyURL study at 1440×900 with the chat rail closed, at zoom 0.75 or more.
  It is recorded, not forced, by shrinking tiles.
