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
| `packages/board` | The lane-grid board, ported from automation-illustrator; it imports no Jeeves code (Biome enforces this). `@jeeves/board/graph` is pure: graph rules (rooted reachability, cycles, link rules and a fan-out cap, one for every tile or per tile) and edits (add after, insert before, link, plan and apply a removal with restitching, remove a link, the tile to select after a removal). The root export adds the layout core: ELK layered left to right with stability hints, in horizontal bands when tiles carry one (`layoutBands`: an end tile several tiles use beside them, `endColumns`; each band alone, stacked, then routed in one pass with the bands' lines kept apart, `meetAtPorts`; lines that come back routed as U's, `routeReturns`), then put on the 32px grid (`alignLayout`), a cached and debounced layout engine, dock hints for new tiles, line polylines with world-locked dashes, and layout interpolation, plus the React layer: `Board` (React Flow with no dragging or connecting; tiles and lines from props, each tile face and line chip the caller's content; pan by drag, wheel zoom, a one-time fit and `fit()` through a ref; a fitted camera refits when the board changes size, a user's pan or zoom is kept, and a picked tile that lands out of view is panned in; select and hand modes), `BoardLine` (ELK routes, solid or dashed, 44px hit band; the selected line and the selected tile's lines in the selection colour, drawn on top; a selected line's red X, on a stretch no other line shares when it has one, and none on a line the caller marks not removable), `TileChrome` (the selected tile's pull tabs and their rubber band: a create tab (`+`) opens an icon fan kept on the board (`placeFan`), whose items keep their slots and may be disabled with a reason, and a picked tile docks at the next slot; an attach tab (a link icon) has no fan and dims the board around its drop targets; the red X), a caller's panel at the board's bottom centre (`hud`, with marked tiles), `useBoardLayout`, `useAnimatedLayout` and `board.css` (`--board-*` theme variables). React, React DOM and React Flow are peer dependencies. The web app's lane canvas mounts it. |
| `packages/providers` | A provider-neutral model interface with OpenAI Responses and Codex adapters and a scripted fake. |
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

The vocabulary is finite: sixteen kinds with immutable definitions (`studio-definitions.ts`), ten
component kinds (`studio-components.ts`; their icons, and the helpers that add and link a tile's
modules, are in `studio-modules.ts`). The studies, TinyURL foundation v1 (the default), extended TinyURL v3.2, the marketplace and
YouTube, are built in lanes from published designs (`studio-examples/`).

`validateDesign` (`validate.ts`, `studio-validation.ts`) returns findings: structural errors
reject a batch; readiness gaps (`CONFIG_REQUIRED`) are saved and reported; design warnings
(`DESIGN_WARNING`, from `studio-warnings.ts`: a store with no writer, a worker's output nobody
reads, a queue with no publisher or consumer, an action with no entries, Uploads without a
storage relationship, a worker without an outgoing relationship) are reported and never
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
chosen model with a finite toolset (`chat/tools.ts`): `listStudioDefinitions` (the tile types
with their kinds, the module kinds and the caps), `describeStudioDefinition` (one kind's
settings), `getDesign` (the actions, each with its lane, name, entries and the tiles its lane
reaches, then each tile's kind, settings, links with their modes and modules, the caps,
the findings and the design warnings; an accepted command returns both too), `applyStudioCommands`,
`validateDesign`, `askUser`, `listStudioPatterns`, `describeStudioPattern`, `declareReviewScope`
and `reviewDesign`, plus bounded `configureDesignScope`, `configureOwnership`, `describeOperation` and `configureOperations`. The pattern tools supply four versioned local guidance records, their
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
Persistent scope uses a separate bounded `configureDesignScope` tool shared with the mouse form; unknown refs/custom requirements stay unresolved. Schema v2 requires a read-only preview and explicit upgrade.

After commands or scope change, a fresh review must reach a subsequent model request before
commit, even when the model ends its response. Two repair response batches fit inside the
ordinary sixteen-round limit. Questions still end immediately with deterministic review;
pure conversation, review-only and semantic no-op turns need no design revision.
The whole turn commits as one operation, so it is one undo step. A concurrent edit
stops the turn rather than overwriting it. Final text and mouse Review details distinguish the
exact chat snapshot from the current saved-state review; failure/conflict discards proposals,
and deletion supplies no saved state. Scope completeness and typed domain behavior are not
verified. See [patterns](docs/studio-patterns.md) and [evaluations](docs/chat-evals.md).
Attached files (Markdown, text, PNG, JPEG, WebP; SVG rasterized with resvg)
are stored in `files`. Turns, replies, questions, activity and token usage are kept in
`chat_turns`; turns interrupted by a restart are marked failed on start.

Providers (`packages/providers`): the OpenAI Responses API with an API key sends strict function
schemas through an audited omission/null codec; server validation remains authoritative.
Codex through its own CLI login constrains an outer answer containing JSON-string arguments,
whose inner values are validated by the server. Mock transport checks do not establish live
API acceptance or model quality; see [tool schemas](docs/chat-tool-schemas.md).
Settings (`GET /settings`, `PUT /settings/roles`) choose one design-chat provider
and model, stored in `~/.jeeves/config.json`. E2E tests set `JEEVES_FAKE_MODEL_SCRIPT` to replay a
scripted model.

## Blueprint

`GET /projects/:id/blueprint` returns `designBlueprint(design, projectName)`: services with
settings and components, resources, externals, groups, resolved connections, component links,
omissions and findings, at default `blueprint: 2`. Explicit `?version=3` includes persistent scope, ownership/roles/authority/grants/requests, exact finite operation declarations/findings, unresolved requirements, source schema and absent template/runtime evidence. V2 refuses v3-only declarations with 422 `UNSUPPORTED_BLUEPRINT_CONTENT` and exact paths; legacy-only v2 meaning stays identical. Each connection into a store says whether it writes
(from the store's owner) or reads (one writer per store, derived from the owner). It is derived
per request, `no-store`, and is the only
interface a future code generator should read. V3 also includes the shared deterministic
`readiness` report and its complete canonical composition subject/hash. The inspector and
read-only chat tool use the same function; compact chat context contains only statuses/counts/hash.
See [studio blueprint](docs/studio-blueprint.md) and [readiness](docs/studio-readiness.md).

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
the services), LA02 (design warnings), LA03 (lane bands: download above shared above upload,
lanes' lines apart), LA04 (an acceptance walkthrough, a docs sweep and fresh copies of the
marketplace and YouTube studies in the owner's database) and LA05 (a review of LA01–LA04, which
fixed what it could show and left questions for the owner) are done. The next work is the owner's
answers to the LA05 and open DP10 questions in [the handoff](docs/handoff.md).

The [system design units](docs/plans/system-design/units.md) SD01–SD05 answer the owner's
YouTube review: SD01 wrote the [design playbook](docs/design-playbook.md) (patterns, smells and
gaps for designing studies); SD02 rebuilt YouTube as v2 from Xu's design (a Transcoder, a
completion topic feeding a Completion handler and a Search indexer, the Watch API's own metadata
cache) and added the Uploads kind; SD03 put stores beside the tiles that use them (a later user's
line comes back to the store), which made every study's lines shorter; SD04 walked them through
by mouse, replaced the owner's YouTube copy and recorded what still reads oddly (lines that come
back read as boxes; two long reads remain); SD05 reviewed SD01–SD04, fixed what it could show
and left questions for the owner. The next work is the owner's answers to the SD05, LA05 and open
DP10 questions in [the handoff](docs/handoff.md), and to the open points of the last
[human feedback](docs/HUMAN_FEEDBACK.md) entry.

The owner's subsequent three-study review is recorded in the
[reliable foundations review](docs/plans/reliable-foundations/review.md). Its
[build plan](docs/plans/reliable-foundations/units.md) starts with relationship clarity,
traceable paths and a pattern-backed, evaluated design assistant; later milestones define
behavior contracts and a separate generator beginning with TinyURL. The owner authorized
sequential implementation on 2026-11-07. RF01 adds per-relationship solid/dashed strokes, target
arrowheads, a mouse-visible legend and selected-line explanations; it changes no ownership,
access inference or blueprint semantics. Later units and contract/generator milestones remain
open as described in the plan.


NC01–NC05 now implement the accepted first-phase scope/version, ownership/access and report boundaries.
`ownership.ts` validates declarations independently of legacy store inference; the narrow tool and
mouse form share pure preview/commands. Owner collapse/expansion is a web view projection over
canonical role/edge IDs, with safe expansion fallback. Deletion and transfer expose exact affected
rows, preserve unrelated requirements and undo once. NC03 adds immutable finite Create link/schema refs, exact caller/receiver binding IDs, explicit operation selection and the shared bounded mouse/chat editor. [Finite contracts](docs/studio-contracts.md) define the accepted semantics; NC04 adds exact public Resolve/positive-cache records, expiry/primary/permission/settings checks and selected-profile namespace agreement; templates/runtime evidence are unavailable. No generator/runtime exists here. The first-phase continuation and G1/G2/G3/G4 decisions are recorded in the next contract plan.

NC05 separates full design validity, exact contract completeness, exact implementation artifact
availability and exact generated-output evidence. Generation eligibility requires the first three;
future output evidence is separate. Whole-design coverage blocks generic/legacy/unknown extras.
The host-only trusted artifact formats have fixture-only positive tests; product has no registry,
manifest, output or evidence. Existing write-only Create bindings retain a targeted missing-read
gap rather than gaining permission. NC06 adds the distinct `studio-tinyurl-foundation@1.0.0` default,
with complete atomic v3 seeding, one Links owner, two API roles, exact source/cache contracts and
visible exclusions. The old `studio-tinyurl@3.2.0` source and saved projects remain intact.
Actual blank-canvas mouse and scripted ChatService construction agree exactly on the semantic
blueprint/report; this is plumbing evidence, not model quality or runtime proof. The independent review covers this subset.

The [NC14 independent review](docs/plans/reliable-foundations/nc14-review.md) records the bounded
contract milestone and its corrections: secondary legacy inspector facts, exact Create source
compatibility, detached ownership exports and executable-suite content pinning.

The active [YouTube field-project plan](docs/plans/reliable-foundations/youtube-field-project-plan.md)
supersedes the separate-repository, TinyURL-first backend sequence. Keep generation/templates
in `jeeves-generator/`; generate from the existing YouTube design, commit untouched output, plan and implement the
missing custom behavior, then compare fresh versions after owner review. Scope is local Docker
upload/transcode/playback/search/basic counts with automatic public publication and generation
from Jeeves. The owner selected a minimal browser interface and PostgreSQL, approving the diagram
change before v1. First add mouse PNG export, preserve the original and changed diagrams, then
freeze the baseline. Every intentional diagram or presentation change during a field version
retains a new source-linked snapshot; UI changes also retain studio screenshots.

Heavy template certification is deferred while designs iterate. Use lightweight build/start/flow
checks and experimental labels; strict readiness does not certify partial scaffolds. Track reusable
diagram/template/operation/tile candidates, actual custom effort, generated repairs and investment
in Jeeves. No generator or field application exists yet. NC07–NC13 are reference briefs, not
mandatory pre-v1 work; the older [TinyURL proof plan](docs/plans/reliable-foundations/backend-first-proof-plan.md)
remains a later verification reference.
