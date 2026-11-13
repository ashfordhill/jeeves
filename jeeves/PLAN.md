# Jeeves architecture

Jeeves is a local, single-user web app for designing a software system on a lane canvas and
exposing the result as a versioned blueprint. This page describes how it is built. What the studio does
for a user is in the [studio guide](../docs/studio.md); field values are in
[studio settings](../docs/studio-settings.md).

```text
apps/web (React studio) ──/api──▶ apps/server (Fastify) ──▶ Postgres
        │                              │
        └──── @jeeves/spec ◀───────────┤   (schemas, operations, validation, lanes, blueprint)
                                       └──▶ @jeeves/providers ──▶ OpenAI API / Codex / Anthropic API / custom endpoint (chat only)

Frozen design/blueprint + local bindings ──▶ jeeves-generator (experimental in-memory assembly)
```

## Repository layout

Studio paths below are relative to `jeeves/`. The generator is the sibling
`../jeeves-generator/`; shared workspace tooling lives in `../tooling/`.

| Path | Holds |
| --- | --- |
| `apps/web` | Vite + React 19 + Mantine. `App.tsx` is the shell (Design and Settings tabs, `#/design` and `#/settings`; project menu; status bar). `project/` holds the project store (`useProject`, zustand), API client, form drafts, project menu, chooser and browser. `canvas/` holds the lane canvas: `Workspace.tsx` (the Design tab: header actions, chat rail, canvas toolbar, inspector rail), `LaneCanvas.tsx` (the design's lane graph on the board; `laneLayout.ts` gives each tile its size and lane band), `creation.tsx` (the selected tile's tabs from the lane rules, opened by a click: the user's one `+`, whose fan of its two actions comes from `laneActionOptions` and runs `addAction`; and a tile's or action's link tab on its right, whose grid fan of the eleven kinds a new tile can be, greyed where refused, comes from `linkFanOptions` and runs `addTile` with that kind), `ModuleMenu.tsx` (the module `+` inside a tile and in the inspector's Modules section, its menu of `moduleKinds` grouped by what each does (`studio/module-groups.ts`), each card with a dot for what it generates there, and the one `addModule` command they share), `connect.ts` (Connect mode: a drag's allowed ends and refusals from `connectOptions`, and a release runs `linkTiles` in the drag's direction), `CanvasMenu.tsx` (the right-click menu of a tile, action, line or loader arrow, at the pointer), `removal.tsx` (removing a tile, action or line from its menu, and the removal's confirmation, running `removeTile`, `removeAction` and `removeLink`), `TileInspector.tsx` (a tile's inspector page: its Connections rows, each selecting the line's other end with a Back to the tile left (the workspace's trail, `selection.ts`), and its Modules cards and `+`, which open and add modules; an action's inspector, with its own Connections rows, with its Name running `renameAction` (`studio/ActionForm.tsx`), and an entry's, with its lane row running `setEntryLane`, are in `Workspace.tsx`), the tile, action and actor faces, the ELK worker client and the app's one layout engine (`elk.ts`), and `canvas.css` (the board's colours from the theme). `studio/` holds the inspector forms and their drafts (tile, connection and module forms), the rail preferences, `StudioIcon` (the studio's glyph set, `studio-glyphs.ts`, styled by `studio-icon.css`) and `studio.css` (the workspace chrome). `chat/` the chat rail and its store; `settings/` the Settings view; `shell/` and `theme/` the chrome. |
| `apps/server` | Fastify 5 with Zod type providers, Drizzle ORM on `pg`, migrations in `drizzle/`. `routes/` (projects, chat, settings), `design/service.ts` (projects, revisions, history, layout, blueprint), `chat/` (turn loop, tools, files, model wiring), `settings.ts` (provider keys, the custom endpoint and the chosen model), `codex-login.ts` (Settings' Sign in with ChatGPT: `codex login` and `codex logout`). |
| `packages/spec` | The design format and every pure function over it (no I/O). |
| `packages/board` | The lane-grid board, ported from automation-illustrator; it imports no Jeeves code (Biome enforces this). `@jeeves/board/graph` is pure: graph rules (rooted reachability, cycles, link rules and a fan-out cap, one for every tile or per tile) and edits (add after, link, plan and apply a removal with restitching, remove a link, the tile to select after a removal). The root export adds the layout core: ELK layered left to right with stability hints, in horizontal bands when tiles carry one (`layoutBands`: an end tile several tiles use beside them, `endColumns`; each band alone, stacked, then routed in one pass with the bands' lines kept apart, `meetAtPorts`; lines that come back routed as U's, `routeReturns`), then put on the 32px grid (`alignLayout`), a cached and debounced layout engine, dock hints for new tiles, line polylines with world-locked dashes, and layout interpolation, plus the React layer: `Board` (React Flow with no dragging or connecting; tiles and lines from props, each tile face and line chip the caller's content; pan by drag, wheel zoom, a one-time fit and `fit()` through a ref; a fitted camera refits when the board changes size, a user's pan or zoom is kept, and a picked tile that lands out of view is panned in; select and connect modes; a right-click on a tile or line goes to the caller, `onTileMenu` and `onLineMenu`), `BoardLine` (ELK routes, solid or dashed, 44px hit band; the selected line and the selected tile's lines in the selection colour, drawn on top), `TileChrome` (the selected tile's tabs on its right: a click toggles a create tab's fan (a `+` or a link glyph), and a pull with its rubber band still works; an icon fan kept on the board (`placeFan`), or a grid fan of captioned rows on one panel (`fanGrid`, `placeGrid`, beside its own tile where the board is narrow, `placeBeside`), whose items keep their slots and may be disabled with a reason, and a picked tile docks at the next slot), connect mode (`ConnectDrag.tsx`: a drag from a tile draws a line to the pointer over a scrim with holes for the ends the caller allows, a tip gives a refused end's reason, and a release connects or reports the refusal; a click still selects; a hovered line takes the selection colour), a caller's panel at the board's bottom centre (`hud`, with marked tiles), `useBoardLayout`, `useAnimatedLayout` and `board.css` (`--board-*` theme variables). React, React DOM and React Flow are peer dependencies. The web app's lane canvas mounts it. |
| `../jeeves-generator` | The `@jeeves/generator` workspace. The `local-v2` registry exports a saved schema-3 design as a standalone project: nine templates, typed module stubs and, with Runnable processes on, one process per application tile. The frozen `local-v1` profile is kept for exact legacy snapshot exports (Generate project offers it only for the exact frozen YouTube v1 source, and `export:new` writes it) and regression checks; new module-authored projects use `local-v2`. See its [README](../jeeves-generator/README.md). |
| `packages/providers` | A provider-neutral model interface with OpenAI Responses, Codex and Anthropic adapters, a custom OpenAI-compatible endpoint (`compatible.ts`, on the Vercel AI SDK's OpenAI-compatible provider) and a scripted fake. |
| `apps/web/e2e`, `fixtures/chat` | The Playwright smoke set and its scripted chat model. |
| `docker/`, `Dockerfile`, `compose.yaml` | The single-container image (nginx, API, Postgres 17) and the dev/E2E Postgres. |

Internal packages export TypeScript source directly; nothing is built except the web bundle.

## Data model (`packages/spec`)

A **design document** has strict explicit v2/v3 readers (`design.ts`). Schema v2 is
`{schemaVersion: 2, revision, architecture?, elements, connections}`; v3 adds required top-level
`scope` and optional explicit `ownership` (logical owners, canonical API/worker roles, resource
authority, role grants and dependency requests), plus optional exact `operations` receiver/caller bindings. Scope holds an exact nullable profile, finite included/excluded requirements and targeted unresolved custom
requirements. Reading never upgrades. `upgradeDesign` explicitly crosses the boundary and
`setDesignScope` requires v3; complete history snapshots support one Undo back to v2.
`design-scope.ts` supplies the finite `tinyurl-create-resolve@1.0.0` intent catalog, shared
preview/commands and unresolved diagnostics. Selecting scope implements no capability contracts.

- `elements`: C2 boxes `{id, name, classification?, description?}`.
- `connections`: `{id, kind, from: {element}, to: {element}, planned: {label, protocol,
  interaction, security}}`.
- `architecture` (`architecture.ts`): the C1 `system`, `nodes` (people, external systems) and
  `relationships`, plus `studio` (`studio-model.ts`): a binding per element (definition ref,
  typed settings, optional legacy inferred writer; explicit logical authority is separate), packages, per-connection settings, C3 `components` and
  `componentConnections`, lane `actions` (`{lane, name}`: what the user does, at most one per lane;
  the user links only to them; a lane stored with entries but no action loads with its default,
  Consume or Produce), lane `entries` (`{id, lane, element}`: each action's links to tiles, `lane`
  being `download` or `upload`; a tile has at most one; a stored `both` loads as `download`) and an
  optional study origin.

The vocabulary is finite: sixteen kinds with immutable definitions (`studio-definitions.ts`), nineteen
module kinds (`studio-components.ts`; their icons, and the helpers that add and link a tile's
modules, are in `studio-modules.ts`). The studies offered, TinyURL v3.3 (the default), the marketplace and
YouTube, are built in lanes from published designs (`studio-examples/`).

`validateDesign` (`validate.ts`, `studio-validation.ts`) returns findings: structural errors
reject a batch; readiness gaps (`CONFIG_REQUIRED`) are saved and reported; design warnings
(`DESIGN_WARNING`, from `studio-warnings.ts`: a store with no writer, a worker's output nobody
reads, a queue with no publisher or consumer, an action with no entries, Uploads without a
storage relationship, a worker without an outgoing relationship) are reported and never
reject anything. `studio-blueprint.ts`
projects the design into the blueprint.

The lane model: `studio-tiles.ts` groups kinds into seven tile types and lists the link fan's
eleven kinds for a new tile (`studioLinkFan`); `studio-links.ts` is the
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
under the lane rules and refused in plain words with tile and action names. The other studio commands edit in place: `edit`, `editSystem`, `editConnection`, the
module commands (`addModule`, `connectModule`, `disconnectModule`, `removeModule`, which derive
each module's generation) and the older component commands (`createComponent`, `editComponent`,
`connectComponent`, `disconnectComponent`, `removeComponent`). A link's mode is optional and defaults to its pair's. Pure helpers answer
the canvas and chat: `laneActionOptions` (the user's two actions, or why not), `linkFanOptions`
(the link fan's eleven kinds after a tile or action, each allowed or with the reason), `connectOptions` (Connect mode's ends from a node, never reversed),
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
(`meetAtPorts`). A store several tiles use sits beside them, from right after its earliest user,
where its band doesn't grow and no more than one column before its last user (`endColumns`); a
later user's line comes back to it, routed as a U after ELK (`routeReturns`). The engine puts every result on the 32px grid before caching it (`alignLayout`:
ports on grid lines, near-straight lines straight, columns keep their order and gaps; lines that
turn in one gap run 32px apart). The positions on screen
are the stability hints for the next layout (the first layout already uses the same layering and
row order); a tile added by mouse is hinted at the next slot beside its source. The **layout document** (`layout.ts`,
`GET/PUT /projects/:id/layout`) holds a per-view row `order` and an optional `viewport` and never
changes the design revision. The server keeps the route (a new project starts with an empty
layout), but the web app neither reads nor writes it.

## Chat

`POST /projects/:id/chat` streams a turn as NDJSON. The server loop (`chat/service.ts`) calls the
chosen model with a finite toolset (`chat/tools.ts`), listed in the
[studio guide](../docs/studio.md#chat). The pattern tools supply four versioned local guidance records, their
applicability and unsupported obligations; retrieval alone selects no scope and supplies no
runtime template. The instructions
(`INSTRUCTIONS`) describe the actor, the two lanes, what an action is (two sentences; a tile has
one entry), the link table (generated from
`studioLinkRules`),
async forks, end tiles, the caps and the warnings (`studioWarningSentence`: resolve the ones
the turn caused). The same summary and the selection go with each message as `[Jeeves]` context. `applyStudioCommands` takes the
studio commands, so tiles and links change only through the lane commands, as on the canvas;
commands run against a working copy with the same builder and validation, and a refusal returns
its plain-words reason (naming the command when a call has several) and changes nothing for that
call. An unknown command type (such as the retired `create`) is refused with the list of
commands. `declareReviewScope` replaces only turn-local assumptions, checklist selection and
custom obligations; these are not saved application requirements. `reviewDesign` previews
staged additions, updates and removals, findings and precise **not specified** obligations.

After commands or scope change, a fresh review must reach a subsequent model request before
commit, even when the model ends its response. Two repair response batches fit inside the
ordinary sixteen-round limit. Questions still end immediately with deterministic review;
pure conversation, review-only and semantic no-op turns need no design revision.
The whole turn commits as one operation, so it is one undo step. A concurrent edit
stops the turn rather than overwriting it. Final text and mouse Review details distinguish the
exact chat snapshot from the current saved-state review; failure/conflict discards proposals,
and deletion supplies no saved state. Scope completeness and typed domain behavior are not
verified. See [patterns](../docs/studio-patterns.md) and [evaluations](../docs/chat-evals.md).
Attached files (Markdown, text, PNG, JPEG, WebP; SVG rasterized with resvg)
are stored in `files`. Turns, replies, questions, activity and token usage are kept in
`chat_turns`; turns interrupted by a restart are marked failed on start.

Providers (`packages/providers`): the OpenAI Responses API with an API key sends strict function
schemas through an audited omission/null codec; server validation remains authoritative.
The Anthropic Messages API gets the canonical schemas as they are, with the key from
`ANTHROPIC_API_KEY` or the config file. Codex through its own CLI login constrains an outer answer containing JSON-string arguments,
whose inner values are validated by the server. The custom endpoint is any OpenAI-compatible
Chat Completions host, through the AI SDK's OpenAI-compatible provider: the canonical schemas as
they are, tools never run by the SDK, no image input, and a host's reasoning text not kept (a host
that needs it sent back with tool results is a known limit). Mock transport checks do not
establish live API acceptance or model quality; see [tool schemas](../docs/chat-tool-schemas.md).
Settings (`GET /settings`, `PUT /settings/roles`, `PUT` and `DELETE /settings/providers/:id/key`,
`PUT` and `DELETE /settings/custom`) choose one design-chat provider and model, save OpenAI's and
Anthropic's API keys, and save the custom endpoint's name, base URL (`https://`, or `http://` on a
loopback host) and key together, all in `~/.jeeves/config.json` (mode 0600; a key in the
environment wins). No answer holds a key.
`POST /settings/codex/login` runs `codex login` and answers with its state (`idle`, `waiting` with
the sign-in URL it printed, or `failed` with its last line), which `GET /settings/codex/login`
repeats; `POST /settings/codex/logout` runs `codex logout`. E2E tests set `JEEVES_FAKE_MODEL_SCRIPT` to replay a
scripted model.

## Blueprint

`GET /projects/:id/blueprint` returns `designBlueprint(design, projectName)`: services with
settings and components, resources, externals, groups, resolved connections, component links,
omissions and findings, at default `blueprint: 2`. Explicit `?version=3` includes persistent scope, ownership/roles/authority/grants/requests, exact finite operation declarations/findings, unresolved requirements, source schema and absent template/runtime evidence. V2 refuses v3-only declarations with 422 `UNSUPPORTED_BLUEPRINT_CONTENT` and exact paths; legacy-only v2 meaning stays identical. Each connection into a store says whether it writes
(from the store's owner) or reads (one writer per store, derived from the owner). It is derived
per request, `no-store`, and is the only
interface a future code generator should read. V3 also includes the shared deterministic
`readiness` report and its complete canonical composition subject/hash. Chat does not read the
report; what chat reads counts readiness findings only (`notSpecified`).
See [studio blueprint](../docs/studio-blueprint.md) and [readiness](../docs/studio-readiness.md).

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | Server and database status |
| `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` | Projects |
| `GET /projects/:id/design`, `/findings`, `/blueprint` | Design state, findings, blueprint |
| `POST /projects/:id/operations`, `/undo`, `/redo` | Changes and history |
| `GET/PUT /projects/:id/layout` | Row order and viewport hints (unused by the canvas) |
| `GET/POST /projects/:id/chat`, `POST /projects/:id/files`, `GET /projects/:id/files/:fileId` | Chat and attachments |
| `GET /settings`, `PUT /settings/roles`, `PUT/DELETE /settings/providers/:id/key` | Providers, their API keys (never returned) and the chat model |
| `PUT/DELETE /settings/custom` | The custom endpoint's name, base URL and key (the key never returned) |
| `POST/GET /settings/codex/login`, `POST /settings/codex/logout` | Codex's sign-in and sign-out (`codex login`, `codex logout`) |

The web app reaches these under `/api` (Vite proxy in development, nginx in the image).

## Status

Completed plans, oldest first: [lane grid](../docs/plans/lane-grid/execution-units.md),
[design polish](../docs/plans/design-polish/units.md),
[lane actions](../docs/plans/lane-actions/units.md),
[system design](../docs/plans/system-design/units.md),
[reliable foundations](../docs/plans/reliable-foundations/units.md),
[UI overhaul](../docs/plans/ui-overhaul/units.md),
[module authoring](../docs/plans/module-authoring/units.md),
[tile processes](../docs/plans/tile-processes/units.md) and
[YouTube v3](../docs/plans/youtube-v3/units.md).

The active plan is [production foundations](../docs/plans/production-foundations/units.md).
What each unit did is in [the handoff](../docs/handoff.md); the owner's decisions are in
[HUMAN_FEEDBACK](../docs/HUMAN_FEEDBACK.md); open template gaps are in
[template gaps](../docs/template-gaps.md).
