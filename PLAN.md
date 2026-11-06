# Jeeves architecture

Jeeves is a local, single-user web app for designing a software system on a lane canvas and
exposing the result as a versioned blueprint. This page describes how it is built. What the studio does
for a user is in the [studio guide](docs/studio.md); field values are in
[studio settings](docs/studio-settings.md).

```text
apps/web (React studio) ──/api──▶ apps/server (Fastify) ──▶ Postgres
        │                              │
        └──── @jeeves/spec ◀───────────┤   (schemas, operations, validation, lanes, blueprint)
                                       └──▶ @jeeves/providers ──▶ OpenAI API / Codex (chat only)

GET /projects/:id/blueprint ──▶ future code generator (separate service, not in this repo)
```

## Repository layout

| Path | Holds |
| --- | --- |
| `apps/web` | Vite + React 19 + Mantine. `App.tsx` is the shell (Design and Settings tabs, `#/design` and `#/settings`; project menu; status bar). `project/` holds the project store (`useProject`, zustand), API client, form drafts, project menu, chooser and browser. `canvas/` holds the lane canvas: `Workspace.tsx` (the Design tab: header actions, chat rail, canvas toolbar, inspector rail), `LaneCanvas.tsx` (the design's lane graph on the board; `laneLayout.ts` gives each tile its size and lane band), `creation.tsx` (the selected tile's pull tabs from the lane rules: the user's one `+`, whose fan of its two actions comes from `laneActionOptions` and runs `addAction`; a `+` per side of a tile or action whose fan of seven types, greyed where refused, comes from `laneOptions` and runs `addTile`; and a link tab whose targets come from `attachOptions` and run `linkTiles`), `removal.tsx` (the red X on the selected tile, action and line and the removal's confirmation, running `removeTile`, `removeAction` and `removeLink`), `TileInspector.tsx` (a tile's inspector: the Type list running `changeKind`, and the Modules tab, which adds, opens and removes modules; an action's inspector, with its Name running `renameAction` (`studio/ActionForm.tsx`), and an entry's, with its lane row running `setEntryLane`, are in `Workspace.tsx`), the tile, action and actor faces, the ELK worker client and the app's one layout engine (`elk.ts`), and `canvas.css` (the board's colours from the theme). `studio/` holds the inspector forms and their drafts (tile, connection and module forms), the rail preferences, `StudioIcon` and `studio.css` (the workspace chrome). `chat/` the chat rail and its store; `settings/` the Settings view; `shell/` and `theme/` the chrome. |
| `apps/server` | Fastify 5 with Zod type providers, Drizzle ORM on `pg`, migrations in `drizzle/`. `routes/` (projects, chat, settings), `design/service.ts` (projects, revisions, history, layout, blueprint), `chat/` (turn loop, tools, files, model wiring), `settings.ts` (provider keys and the chosen model). |
| `packages/spec` | The design format and every pure function over it (no I/O). |
| `packages/board` | The lane-grid board, ported from automation-illustrator; it imports no Jeeves code (Biome enforces this). `@jeeves/board/graph` is pure: graph rules (rooted reachability, cycles, link rules and a fan-out cap, one for every tile or per tile) and edits (add after, insert before, link, plan and apply a removal with restitching, remove a link, the tile to select after a removal). The root export adds the layout core: ELK layered left to right with stability hints, in horizontal bands when tiles carry one (`layoutBands`: each band alone, stacked, then routed in one pass with the bands' lines kept apart, `meetAtPorts`), then put on the 32px grid (`alignLayout`), a cached and debounced layout engine, dock hints for new tiles, line polylines with world-locked dashes, and layout interpolation, plus the React layer: `Board` (React Flow with no dragging or connecting; tiles and lines from props, each tile face and line chip the caller's content; pan by drag, wheel zoom, a one-time fit and `fit()` through a ref; a fitted camera refits when the board changes size, a user's pan or zoom is kept, and a picked tile that lands out of view is panned in; select and hand modes), `BoardLine` (ELK routes, solid or dashed, 44px hit band; the selected line and the selected tile's lines in the selection colour, drawn on top; a selected line's red X, on a stretch no other line shares when it has one, and none on a line the caller marks not removable), `TileChrome` (the selected tile's pull tabs and their rubber band: a create tab (`+`) opens an icon fan kept on the board (`placeFan`), whose items keep their slots and may be disabled with a reason, and a picked tile docks at the next slot; an attach tab (a link icon) has no fan and dims the board around its drop targets; the red X), a caller's panel at the board's bottom centre (`hud`, with marked tiles), `useBoardLayout`, `useAnimatedLayout` and `board.css` (`--board-*` theme variables). React, React DOM and React Flow are peer dependencies. The web app's lane canvas mounts it. |
| `packages/providers` | A provider-neutral model interface with OpenAI Responses and Codex adapters and a scripted fake. |
| `apps/web/e2e`, `fixtures/chat` | The Playwright smoke set and its scripted chat model. |
| `docker/`, `Dockerfile`, `compose.yaml` | The single-container image (nginx, API, Postgres 17) and the dev/E2E Postgres. |

Internal packages export TypeScript source directly; nothing is built except the web bundle.

## Data model (`packages/spec`)

A **design document** is `{schemaVersion: 2, revision, architecture?, elements, connections}`
(`design.ts`), parsed strictly; any other shape is rejected.

- `elements`: C2 boxes `{id, name, classification?, description?}`.
- `connections`: `{id, kind, from: {element}, to: {element}, planned: {label, protocol,
  interaction, security}}`.
- `architecture` (`architecture.ts`): the C1 `system`, `nodes` (people, external systems) and
  `relationships`, plus `studio` (`studio-model.ts`): a binding per element (definition ref,
  typed settings, optional owner; a store's owner is its only writer), packages, per-connection settings, C3 `components` and
  `componentConnections`, lane `actions` (`{lane, name}`: what the user does, at most one per lane;
  the user links only to them; a lane stored with entries but no action loads with its default,
  Consume or Produce), lane `entries` (`{id, lane, element}`: each action's links to tiles, `lane`
  being `download` or `upload`; a tile has at most one; a stored `both` loads as `download`) and an
  optional study origin.

The vocabulary is finite: fifteen kinds with immutable definitions (`studio-definitions.ts`), ten
component kinds (`studio-components.ts`; their icons, and the helpers that add and link a tile's
modules, are in `studio-modules.ts`). The studies, TinyURL v3 (the default), the marketplace and
YouTube, are built in lanes from published designs (`studio-examples/`).

`validateDesign` (`validate.ts`, `studio-validation.ts`) returns findings: structural errors
reject a batch; readiness gaps (`CONFIG_REQUIRED`) are saved and reported; design warnings
(`DESIGN_WARNING`, from `studio-warnings.ts`: a store with no writer, a worker's output nobody
reads, a queue with no publisher or consumer, an action with no entries) are reported and never
reject anything. `studio-blueprint.ts`
projects the design into the blueprint.

The lane model: `studio-tiles.ts` groups kinds into seven tile types; `studio-links.ts` is the
link table (`studioLinkRules`: rows by source and target role, with each row's modes, default mode
and the connection a link gets) with the caps;
`studio-lanes.ts` projects a design into the board graph (`laneGraph`: the `@actor` root, the
action nodes `@download` and `@upload`, lane order, async and dashed links) and checks it with `@jeeves/board/graph` (`laneRules` for
`checkGraph` and the board edits; `laneFindings`, `LANE_INVALID`, which `validateStudio` includes,
so a batch that breaks a lane rule is rejected). The spec imports only `@jeeves/board/graph`, never
the board's React root (Biome enforces this).

## Operations and history

Every change, from the canvas, chat or API, is an **operation batch** posted to
`POST /projects/:id/operations` with a `baseRevision` (`operations.ts`): `setArchitecture`,
`updateArchitectureSystem`, `setStudio`, `addElement`, `updateElement`, `removeElement`,
`connect`, `updatePlannedConnection`, `disconnect`. The UI and chat build batches from
higher-level **studio commands** (`buildStudioCommand` in `studio-operations.ts`), so both share
one rule set. Actions, tiles and links are added and removed only by the **lane commands**
(`studio-lane-commands.ts`: `addAction`, `renameAction`, `removeAction`, `addTile`, `linkTiles`,
`removeTile`, `removeLink`, `changeKind`, `setEntryLane`): each is checked with the board edits
under the lane rules and refused in plain words with tile and action names. The other studio commands edit in place: `edit`, `editSystem`, `editConnection` and the
module commands (`createComponent`, `editComponent`, `connectComponent`, `disconnectComponent`,
`removeComponent`). A link's mode is optional and defaults to its pair's. Pure helpers answer
the canvas and chat: `laneActionOptions` (the user's two actions, or why not), `laneOptions`
(all seven tile types per side, each with its kind or the reason), `attachOptions` (the link tool's targets, either direction), `laneLinkRefusal`,
`laneEntryRefusal`, `laneRemoveActionRefusal`, `planRemoveTile`, and `newTileIdentity` and `newLinkId` for fresh names and
IDs.

`applyOperations` applies a batch all-or-nothing and bumps `revision` once. The server runs each
change in one transaction that locks the project row: a stale `baseRevision` is a 409 with the
current state, an invalid batch a 422 with findings. Each applied batch is a row in `operations`
with before/after snapshots and a source (`canvas`, `chat`, `api`). Undo and redo
(`POST /projects/:id/undo|redo`) restore a snapshot as a new revision; a new edit ends the redo
chain. The web store's Undo and Redo follow that server history; it keeps no history of its own.

Tables: `projects`, `design_revisions`, `operations`, `layouts`, `files`, `chat_turns`. The server
applies migrations on start.

## Layout

Positions are never stored. The lane canvas projects the design with `laneGraph` and lays it out
with the board's ELK engine (layered, left to right, automation-illustrator's options),
running ELK in a Web Worker with a main-thread fallback (`canvas/elk.ts`). Every tile and line
carries its lane band (`laneBands`: download, shared or upload; `canvas/laneLayout.ts`), and the
engine lays a banded board out in strips (`layoutBands`): each band alone with the board's
columns, stacked download, shared, upload, then one ELK pass that routes every line with a port
per band on a shared tile, so lines of different lanes meet only in the last 32px before it
(`meetAtPorts`). The engine puts every result on the 32px grid before caching it (`alignLayout`:
ports on grid lines, near-straight lines straight, columns keep their order and gaps; lines that
turn in one gap run 32px apart). The positions on screen
are the stability hints for the next layout (the first layout already uses the same layering and
row order); a tile added by mouse is hinted at the next slot beside its source. The **layout document** (`layout.ts`,
`GET/PUT /projects/:id/layout`) holds a per-view row `order` and an optional `viewport` and never
changes the design revision. The server keeps the route (a new project starts with an empty
layout), but the web app neither reads nor writes it.

## Chat

`POST /projects/:id/chat` streams a turn as NDJSON. The server loop (`chat/service.ts`) calls the
chosen model with a finite toolset (`chat/tools.ts`): `listStudioDefinitions` (the tile types
with their kinds, the module kinds and the caps), `describeStudioDefinition` (one kind's
settings), `getDesign` (the actions, each with its lane, name, entries and the tiles its lane
reaches, then each tile's kind, settings, links with their modes and modules, the caps,
the findings and the design warnings; an accepted command returns both too), `applyStudioCommands`, `validateDesign` and `askUser`. The instructions
(`INSTRUCTIONS`) describe the actor, the two lanes, what an action is (two sentences; a tile has
one entry), the link table (generated from
`studioLinkRules`),
async forks, end tiles, the caps and the warnings (`studioWarningSentence`: resolve the ones
the turn caused). The same summary and the selection go with each message as `[Jeeves]` context. `applyStudioCommands` takes the
studio commands, so tiles and links change only through the lane commands, as on the canvas;
commands run against a working copy with the same builder and validation, and a refusal returns
its plain-words reason (naming the command when a call has several) and changes nothing for that
call. An unknown command type (such as the retired `create`) is refused with the list of
commands. The whole turn commits as one operation, so it is one undo step. A concurrent edit
stops the turn rather than overwriting it. Attached files (Markdown, text, PNG, JPEG, WebP; SVG rasterized with resvg)
are stored in `files`. Turns, replies, questions, activity and token usage are kept in
`chat_turns`; turns interrupted by a restart are marked failed on start.

Providers (`packages/providers`): the OpenAI Responses API with an API key, and Codex through its
own CLI login. Settings (`GET /settings`, `PUT /settings/roles`) choose one design-chat provider
and model, stored in `~/.jeeves/config.json`. E2E tests set `JEEVES_FAKE_MODEL_SCRIPT` to replay a
scripted model.

## Blueprint

`GET /projects/:id/blueprint` returns `designBlueprint(design, projectName)`: services with
settings and components, resources, externals, groups, resolved connections, component links,
omissions and findings, at `blueprint: 2`. Each connection into a store says whether it writes
(from the store's owner) or reads (one writer per store, derived from the owner). It is derived
per request, `no-store`, and is the only
interface a future code generator should read. See [studio blueprint](docs/studio-blueprint.md).

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | Server and database status |
| `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` | Projects |
| `GET /projects/:id/design`, `/findings`, `/blueprint` | Design state, findings, blueprint |
| `POST /projects/:id/operations`, `/undo`, `/redo` | Changes and history |
| `GET/PUT /projects/:id/layout` | Row order and viewport hints (unused by the canvas) |
| `GET/POST /projects/:id/chat`, `POST /projects/:id/files`, `GET /projects/:id/files/:fileId` | Chat and attachments |
| `GET /settings`, `PUT /settings/roles` | Providers and the chat model |

The web app reaches these under `/api` (Vite proxy in development, nginx in the image).

## Next

The lane grid ([build plan](docs/build-plan-lane-grid.md), units LG01–LG13 in
[execution units](docs/plans/lane-grid/execution-units.md), then
[polish units](docs/plans/lane-grid/polish-units.md) PL01–PL02) is complete; the build plan's §7
lists what was left for later. Code generation will be
a separate service that reads the blueprint.

The [design polish units](docs/plans/design-polish/units.md) DP01–DP10 are done:

- lines aligned on the grid
- no both-lane entries
- link rules as one table
- `+` creates and a link tool attaches
- a labelled Type list with preconfigured kinds and two languages each
- TinyURL v3 from published designs, with one writer per store
- an acceptance walkthrough and docs sweep
- a marketplace study, with a CDN image-resizing setting and four entries per lane
- a YouTube study, built from the existing options
- a review of DP01–DP09, which fixed what it could show and left questions for the owner

The [lane actions units](docs/plans/lane-actions/units.md) LA01–LA05 answer three of DP10's
questions. LA01 (action tiles: the user links only to its Consume and Produce actions, which reach
the services), LA02 (design warnings) and LA03 (lane bands: download above shared above upload,
lanes' lines apart) and LA04 (an acceptance walkthrough, a docs sweep and fresh copies of the
marketplace and YouTube studies in the owner's database) are done; LA05 (a review of LA01–LA04)
remains.
