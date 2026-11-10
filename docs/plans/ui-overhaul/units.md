# UI overhaul: modules on the canvas and a one-page inspector

**Status:** planned 2026-11-08 from owner feedback. UI01–UI09 done 2026-11-09; UI10 is next.
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-08 — Modules on the canvas and a one-page inspector](../../HUMAN_FEEDBACK.md)
· [module sketch](../../human-feedback/2026-11-08-module-detail-sketch.png)
· [current inspector](../../human-feedback/2026-11-08-inspector-current.png)
· [inspector sketch](../../human-feedback/2026-11-08-inspector-sketch.png)

There are ten units, run in order: UI01 → UI10. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.

## What the owner asked for

| # | Request | Units |
| --- | --- | --- |
| R1 | A toggle that flips the canvas to a **Detailed** view. Each service, worker and API tile shows its modules, and each module's own relationships attach to that module, as in the module sketch. | UI04–UI09 |
| R2 | Remove the inspector's tabs (General / Options / Connections / Modules) and use the empty rail for one page: name and details, then Description, then Options, then Modules. | UI02, UI03 |
| R3 | Rename **Goal** to Description (or Purpose), and make its box taller by default. | UI02 |
| R4 | Show modules as icon cards at the bottom of the page. Clicking one opens it, and **Back** returns to the tile. | UI03, UI08 |
| R5 | Don't describe connections in words. The arrows on the diagram already show them. | UI02, UI03 |
| R6 | Remove **Focus relationships**. It is hard to turn off. | UI01 |

## Decisions

These are the planning defaults. The owner may change any of them before UI01 starts. After that,
a unit changes one only when the owner says so.

| Topic | Decision | Why |
| --- | --- | --- |
| Focus | Remove Focus relationships completely: the inspector button and list, and the canvas strip with its counts, Fit focus and Show all. Tracing uses selection: a selected tile's lines turn blue and are drawn on top (this already works). A selected line works the same way, and **Choose relationship** still handles overlapping lines. There is no separate dimming mode. | The highlight ends when the selection ends, so there is no mode to remember to leave. |
| Label | Use **Description** for the system, tiles and modules, replacing both "Goal" and "Purpose". The stored field (`description`) and the blueprint stay the same. | It matches the owner's sketch and the data field, and gives one word everywhere. |
| Inspector | One scrolling page with no tabs. A header block holds the kind icon, the editable name, the kind and any warnings, so the name appears only once. Then Description, Options (only when there are options) and Modules (only when there are modules). | Owner sketch. |
| Connection lists | Remove them from the tile, module and action inspectors, including the module **Unlink** button. Line inspectors stay, because they describe the selected arrow itself. Unlink goes because normal authoring already can't create module links; the operation stays available in source and chat. | R5. The arrows are the source of truth. |
| Description box | The box grows with its text. It starts at 6 rows and grows to about half the rail's height before it scrolls. Manual resize still works. | R3 |
| Detailed toggle | One switch for the whole canvas: **Overview \| Detailed** in the canvas toolbar. Overview is the default. The choice is remembered per project in this browser (`useStudioPreferences`). It is never saved to the design, revision, history, blueprint or chat. | R1. It is a view, not a design change. |
| Containers | In Detailed, an application tile with at least one module becomes a container: a header with its icon and name, then one row per module. Other tiles keep their Overview size and face. | Module sketch |
| Module lines | Each module link to a tile is drawn from (or into) that module's row. A relationship that no module uses is drawn at the container's header row. Arrow direction and dashes keep the current convention, so a consumer's line runs channel → consumer. The sketch's arrow from the consumer to the channel is not adopted. | The model already says a module's line follows its host connection's direction. |
| In-process links | Module-to-module links inside one tile are not drawn. When a module is open, the rows it uses are marked (UI08). | They stay discoverable without arrows inside a 32px row or a text list. |
| Editing in Detailed | Selection, the inspector, pull tabs and the tile X work in both views. A drawn line's X removes the whole relationship, the same as in Overview, with the same confirmation. Module links that use it go with it, as they do today. | One meaning for removal in both views. |
| Export | The PNG/JSON export captures the current view. Overview output stays byte-identical to today's. | Field-project diagram snapshots depend on Overview bytes. |

## Fixed constraints

- **View only.** No change to the design schema, blueprint, chat tools, generation, settings
  allowlist or template support. No new kinds, settings or module-creation UI.
- `jeeves/packages/board` stays generic and imports no Jeeves code.
- Every action works by mouse alone; keyboard shortcuts are optional.
- Selecting, toggling views, opening modules, panning and Fit add no history step and do not change
  the saved design, revision or blueprint. User-visible units assert this in e2e, comparing the
  blueprint before and after, as `relationship-focus.spec.ts` does today.
- Layouts that don't use the new ports stay **byte-identical** (UI04/UI05 gate). Overview stays what
  it is today.
- Less is more. Add no explanatory paragraphs, Advanced sections or new menus. When something goes
  away, delete its code, CSS and tests instead of hiding it.

## Code map (commit `8813523`)

**Inspector**

- `jeeves/apps/web/src/studio/InspectorForm.tsx`:
  - `TargetForm` builds the tile and system tabs (General, Options, Connections, Modules).
  - `ComponentForm` builds the module tabs and contains Unlink and the external-call retry note.
  - `DraftField` renders the description as a `<textarea rows={3}>`.
  - `systemFields` relabels the system's description as "Goal".
- `jeeves/apps/web/src/canvas/TileInspector.tsx`: the tile header, `ModuleList`, and
  `ModuleInspector` with its Back button. The open module is local `useState`.
- `jeeves/apps/web/src/canvas/Workspace.tsx`: the rails and selection. It also contains:
  - the system `Inspector`, `ActionInspector` (with its Entries list) and `EntrySummary`;
  - the focus state (`focusTile`, `anchor`, `visibleLines`, `emphasizedTiles`) and the canvas
    "Relationship focus" strip;
  - the toolbar: Select, Hand, Fit, Export diagram, Generate project.
- `jeeves/apps/web/src/canvas/RelationshipFocus.tsx`: the focus list. Its CSS is
  `.lane-focus-*` and `.lane-relationship-focus` in `canvas.css`.
- Labels: `packages/spec/src/studio-definitions.ts` (the element description is "Purpose") and
  `studio-components.ts` (the component description is "Purpose").

**Canvas**

- `LaneCanvas.tsx` turns the lane graph into board tiles and lines.
- `laneLayout.ts` sets sizes and bands.
- `tiles/Tile.tsx` draws the 128×128 face.
- `elk.ts` is the one layout engine.
- `laneLayout.test.ts` lays out the studies with real ELK.

**Board**

- `packages/board/src/react/Board.tsx`:
  - `TileSpec` / `LineSpec`;
  - React Flow handles at `h / 2`;
  - `visibleLines` / `emphasizedTiles`, which only focus uses.
- `layout/elkGraph.ts` gives each tile one west port and one east port at mid-height.
- `bands.ts` adds one input port per band.
- `junctions.ts`, `returns.ts` (which builds U routes from `h / 2`), `align.ts`, `branches.ts`.

**Module data**

- `studio.components[]` holds the modules; each has a `host`.
- `studio.componentConnections[]` holds the module links. A link reaches another tile only `via` an
  existing connection of its host, and its arrow follows that connection.
- `studio-modules.ts` has the module icons and colours.

**Test data**

| Design | Modules | Notes |
| --- | --- | --- |
| TinyURL extended study | 9 | |
| Marketplace study | 16 | |
| YouTube study | 20 | Transcoder has 5. |
| TinyURL foundation study | 0 | |
| `field-projects/youtube/v2/inputs/design.json` | 22 | Holds the owner's example: Video lifecycle worker (see below). |

The Video lifecycle worker's modules and links:

- Processing consumer ← Processing events
- Lifecycle writer → Metadata database
- Publication outbox publisher → Metadata database and Publication events

In every one of these designs, each connection that touches a module host is used by some module.
No module link targets another module host. Some connections are used by two modules: one in
YouTube, two in Marketplace.

**Tests that change**

- Focus: `relationship-focus.spec.ts`, `ownership.spec.ts`, `operations.spec.ts`,
  `foundation.spec.ts`, `diagram-export.spec.ts`.
- Inspector tabs: `edit-history.spec.ts` (the Options and Modules tabs) and `canvas.spec.ts` (the
  Connections tab).

## Rules for every unit

- Read `AGENTS.md`, the latest entries in `docs/handoff.md`, this plan, the HUMAN_FEEDBACK entry
  and its three images. Do only your unit and stop at its end. Don't start the next one.
- Before editing, run `git status`. If a file your unit must change already has uncommitted
  changes you did not make, **stop and report**. Another session may be working on it. When you
  commit, stage only your own paths. Never touch the root `README.md` or `.jeeves-feedback/`.
- Use Node 24: put `~/.nvm/versions/node/v24.21.0/bin` first in `PATH`.
- Checks: `pnpm check`; `pnpm test:e2e` (or `pnpm test:e2e:docker`); `pnpm --filter @jeeves/web
  build`; and a mouse check in the browser at 1440×900 and 1280×800. In the browser, the TinyURL
  study must render, the changed behaviour must work, and no page errors may appear. Don't run e2e
  while another session is running it: they share ports 4301/4311 and the `jeeves_e2e` database.
- Tests: a few focused tests for the rules that are costly to get wrong. Rewrite an affected e2e
  spec so it keeps its real purpose (operations, ownership, export invariance and so on). Don't
  just delete it.
- Docs: keep `docs/studio.md` (Lane canvas, Layout, Inspector, History, Diagram PNG export) and any
  `docs/studio-blueprint.md` / `docs/studio-settings.md` mentions current. When a unit learns how
  the canvas should look, add a dated lesson to `docs/design-playbook.md`.
- Evidence: units with visible changes save at most four small screenshots under
  `docs/plans/ui-overhaul/evidence/<unit>/`.
- Finish by appending a short handoff entry (what changed, how it was checked, notes for the next
  unit). Then make one local commit named `UInn: <summary>`. Don't push.

---

## UI01 — Remove Focus relationships

**Goal:** you trace a relationship by selecting it, and there is no mode to turn off (R6).

**Change**

- Delete `RelationshipFocus.tsx` and everything that uses it in `Workspace.tsx`:
  - the inspector's Focus relationships button and list;
  - the canvas "Relationship focus" strip with its counts, Fit focus and Show all;
  - the `focusTile`/`anchor`/`visibleLines`/`emphasizedTiles` state and the `setFocusTile`
    calls;
  - the focus CSS.
- Move `relationshipVerb` if anything else still uses it; otherwise delete it.
- Keep:
  - a selected tile's lines turning the selection blue and being drawn on top;
  - a selected line drawn on top with its X;
  - Choose relationship;
  - Fit.
  To remove a relationship, use the selected line's X. It goes through the same removal and
  ownership confirmation.
- Remove the board's `visibleLines` / `emphasizedTiles` props and their tests if no caller is
  left. Check export and `ownerProjection` first.

**Tests**

- Replace `relationship-focus.spec.ts` with a tracing spec that covers:
  - selecting a tile highlights its lines;
  - clicking a line shows its saved label;
  - Choose relationship on a shared stem;
  - removal by X, then Undo;
  - unchanged blueprint and tile positions.
- In the other four specs, select the line by clicking its edge, using the existing e2e helpers or
  `.react-flow__edge[data-id=…]`, instead of the focus list. Keep what each spec tests:
  - the operation selection;
  - the entry-move dialog;
  - the ownership "Remove relationship declarations" dialog;
  - PNG invariance after selection, pan, zoom and dark mode.

**Docs:** in `studio.md`, replace the focus paragraphs. Update the focus mention in
`studio-blueprint.md`. Add a playbook addendum saying focus was removed at the owner's request and
tracing now uses selection, which ends when you clear it.

**Accept**

- Searching the source finds no "Focus relationships", "Fit focus" or "Show all".
- Clicking empty paper restores the plain view.
- Checks pass.

**Commit:** `UI01: remove relationship focus`

## UI02 — One-page tile and system inspector

**Goal:** a tile or the system opens as one page laid out as in the sketch (R2, R3, R5).

**Change**

- `TargetForm`: remove the tab strip and tab panel. Render these in order:
  1. a header block with the kind icon, the **Name** field, the kind and any warnings;
  2. **Description**;
  3. **Options**, with a heading, only when there are fields;
  4. the Modules slot, only when it has modules (UI03 fills it).

  Add no Connections section.
- The Name stays a draft field of the same form, with the same input `id` suffix, so a new tile
  still opens with its name focused. Style it as the title and give it the accessible name "Name".
  The tile name is not printed a second time.
- **Description:**
  - The label replaces "Goal" for the system and "Purpose" for tiles. Before changing the spec
    labels, check whether anything serializes them (blueprint, chat tool text, `__snapshots__`).
    If something does, change only the label the web shows, and record why.
  - The box grows as the Decisions table says. Limits, validation and the 500ms autosave stay the
    same.
- Options shows exactly the fields the Options tab shows today. Don't change `normalSettingFields`,
  `studioPerformanceFields` or the editable filter.
- System inspector order: Name, Description, warnings (each with its select button), then **Add a
  supported feature** (`PresetAttachment`).
- Action inspector: remove the Entries list. Keep the Name, the Lane and the warnings; an action
  with no entries is already flagged by a warning.
- Leave the line inspectors (connection, lane entry, user line) as they are.

**Tests**

- Update `edit-history.spec.ts` and `canvas.spec.ts` to the new page, keeping their autosave and
  Undo coverage.
- Add a check that tile, system and module inspectors have no tablist.
- Add a check that the Description label is used.
- Add a check that the description box gets taller as text is typed.

**Docs:** `studio.md` Inspector. In History, "switching tabs" becomes "opening a module". Update
`studio-settings.md` if it names the old labels or tabs.

**Commit:** `UI02: one-page inspector with Description`

## UI03 — Module cards, drill-in and Back

**Goal:** modules sit at the bottom as cards. One click opens a module and Back returns (R4, R5).

**Change**

- **Modules section:** a vertical stack of cards. Each card shows the module's icon in its family
  colour, its name and its kind, plus its description clamped to two lines when it has one. The
  whole card is one button named "Open <module>".
- **Module page:** it replaces the tile page in the rail and contains, in order:
  1. a Back row: the host's icon and name, with the accessible name "Back to <host>";
  2. a header block with the module's icon, its editable Name and its kind;
  3. Description, using the same growing box as UI02;
  4. Options, the same fields as today;
  5. **Remove module** at the bottom.

  Remove the tabs, the Connections list, Unlink and the external-call retry note.
- **Move the open module into `Workspace`'s selection:** `{ tile, line, module? }`, where a module
  is only set together with its host tile. Today it lives in `TileInspector`'s `useState`.
  - Selecting another tile or line, or clicking paper, closes the module.
  - Back returns to the tile with the Modules section in view.
  - Removing the module, or an Undo that removes it, returns to its tile.
  - While a module is open, chat's `architectureSelection` carries the module's ID. Plain IDs are
    valid chat references; check this, and if they aren't, keep the host's ID and record why.
- No canvas change in this unit.

**Tests**

- E2E on the YouTube study:
  - open a Transcoder module from its card;
  - edit its name and description; they autosave and Undo works;
  - Back;
  - selecting another tile closes the module;
  - Remove module, then Undo;
  - the chat selection carries the module ID.
- Update the module flows in `edit-history.spec.ts`.

**Docs:** `studio.md` Inspector (Modules) and History.

**Commit:** `UI03: module cards with drill-in and Back`

**Owner checkpoint A (recommended):** the inspector work is complete here. The coordinator pauses
for owner review if the owner asked for it.

## UI04 — Board: ports at fixed heights

**Goal:** generic board support for several ports on one side of a tile, each at a set height, so
a line can leave or enter at a given row. Jeeves looks the same afterwards.

**API (suggested; refine it and document what you choose in the board file headers)**

- `TileSpec.ports?: readonly { id: string; side: "in" | "out"; y: number }[]`. `y` is measured
  from the tile's top and must be a multiple of the 32px grid.
- `LineSpec.sourcePort?: string` and `targetPort?: string` each name a port of the right side on
  the right tile.
- Add the same fields to `LayoutTile` / `LayoutLine`. A line with no named port keeps today's
  default port at mid-height. Decide whether an unknown port name throws or falls back, and test
  that choice.

**Change (flat layout and drawing)**

- `elkTile` and `buildElkGraph` emit the named ports, and `graphKey` includes them.
- `alignLayout` keeps named ports on the grid and treats them like default ports when it
  straightens lines and snaps bends.
- The React Flow handles, `BoardLine` and the arrowheads follow the routed end at the port.
- `snapshot()` carries the ports, so export can use them.

**Gate**

- Before editing, use the parent commit to record the layout JSON for the four studies plus the v2
  design. Use real ELK through `createLayoutEngine` and `laneLayoutInput`, and save it to your
  scratchpad.
- After your changes, it must be byte-identical.
- Also keep a committed test showing that inputs with no named ports produce the same ELK graph as
  before.

**Tests:** one tile with three out ports at y = 64/96/128 to three targets. Check that:

- each line starts at its port's height;
- the ports are on the grid;
- the routing is orthogonal;
- no line passes through a tile;
- each arrowhead sits at its target port.

**Out of scope:** bands, junctions and returns (UI05).

**Commit:** `UI04: board ports at fixed heights`

## UI05 — Board: ports through bands, shared stems and returns

**Goal:** named ports work in the banded pipeline the lane canvas always uses.

**Change**

- `layoutBands` adds per-band input ports only for default ports; a named port keeps its own.
- `meetAtPorts` and the junctions group lines by their actual port.
- `separateBranches` respects named ports.
- `routeReturns` leaves and enters U routes at the port's height, not at `h / 2`.
- `endColumns` and "stores beside their users" stay as they are.

**Fixture:** a synthetic banded board shaped like the Detailed view. It has:

- a 256×160 tile with three out ports;
- two lines from different ports to one store;
- one line that comes back to an earlier column;
- one entry from another band.

**Gate:** the UI04 byte-identity check, run again.

**Tests:** on the fixture, check that:

- bends are on the grid;
- no line passes through a tile;
- a return starts at its port;
- lines from different ports meet only in the last 32px before their shared target port;
- the existing band, store and return tests still pass.

Report the fixture's line length and crossings in the handoff.

**Commit:** `UI05: board ports through bands and returns`

## UI06 — Detailed view projection

**Goal:** a pure, tested function that gives the Detailed view's tiles, ports and lines. No UI yet.

**Where:** `jeeves/apps/web/src/canvas/detailedView.ts` with tests. It is web view code.

**Rules**

- **Container size:** start with these values; UI09 may tune them.
  - width: 256;
  - header: 48 (icon and a one-line name);
  - module rows: 32px apart, in `studio.components` order for that host;
  - bottom padding: 16, then round the height up to a multiple of 32.

  Each row's port sits on a grid line.
- Other tiles keep their Overview size and default ports. The user and the actions don't change.
- **Line anchors:** for each lane-graph edge from A to B:
  - the source anchors are A's modules that link to B through this connection;
  - the target anchors are B's modules that link to A through it.
- **Lines per edge:**
  - with no anchors on either side, draw one line at the default port, or the header port for a
    container;
  - with anchors on one side, draw one line per anchor;
  - with anchors on both sides, draw one line per pair.

  Order them deterministically by module order.
- Entry lines and the user's lines attach at the tile level: the header port for a container.
- In-process links are not drawn. Return them as `partners(module)` for UI08.
- **Each drawn line has:**
  - a unique ID built from the edge ID, a separator that design IDs can't contain, and the
    module(s);
  - its canonical `connection`;
  - its `dashed`, `band` and `directed` values, copied from the edge;
  - an accessible label that names the modules, for example "Lifecycle writer (Video lifecycle
    worker) to Metadata database".
- Also return the maps `connectionOf(line)`, `linesOf(connection)` and `rowOf(module)`.
- A module with no links gets a row with no port.

**Tests:** run on the TinyURL extended, Marketplace and YouTube studies and on
`field-projects/youtube/v2/inputs/design.json`. Check that:

- every module is a row in its host exactly once;
- every module link to a tile ends at exactly one line end on its row;
- every canonical edge has at least one line, and no line lacks a canonical edge;
- the IDs are unique and the same on every run;
- the ports are on the grid;
- the v2 Video lifecycle worker draws exactly the owner's sketch.

**Layout smoke:** lay out all four Detailed inputs with real ELK. Each layout must finish with the
ports on the grid and no line through a tile. Record drawn size, total line length and crossings
for Overview and Detailed in the handoff; UI09 uses them.

**Stop condition:** if a layout fails, stop and report before UI07 starts.

**Commit:** `UI06: detailed view projection`

## UI07 — Detailed view on the canvas

**Goal:** the toggle works and Detailed shows containers and module-anchored lines (R1).

**Change**

- **Toggle:**
  - **Overview | Detailed** in the canvas toolbar, built as a group of two `aria-pressed` buttons;
  - remembered as the Decisions table says;
  - switching views animates the layout (200ms, as today) and then fits.
- **Container face:** `tiles/ContainerTile.tsx`.
  - The header shows the kind icon and the name in the family colour.
  - Each row shows the module's icon in its family colour and its name, cut short with an ellipsis
    and with the full name as its title.
  - The frame is a rectangle, and the warning mark works as it does on `Tile`.
- **Canvas:** in Detailed, `LaneCanvas` uses the projection's tiles, ports and lines. Overview
  output does not change.
- **Selection:**
  - Clicking a drawn line selects its canonical connection. The inspector, chat and removal use the
    canonical ID.
  - Every drawn line of that connection takes the selection colour. Add a generic, view-only
    highlight prop to the board if needed.
  - A selection made elsewhere (diagnostics, chat, Undo) maps back to the drawn lines.
  - Switching views keeps the selection.
- **Removal and creation:** a drawn line's X removes the canonical relationship through the
  existing confirmation. Check pull tabs and the tile X on containers by mouse.
- **Choose relationship:** its entries name the modules.
- **Export:**
  - It follows the current view.
  - Overview JSON/PNG for the YouTube study must hash the same as at the parent commit.
  - A Detailed export says `detailed` in its filename and details.
- Module rows are not interactive yet (UI08).

**Tests:** `detailed-view.spec.ts` on the YouTube study. Check that:

- the toggle works by mouse;
- Transcoder shows five rows;
- the drawn line count matches the projection;
- clicking a module-anchored line opens the connection's inspector;
- X, confirmation and Undo work;
- switching back to Overview gives 25 lines and the same tile positions;
- toggling leaves the design, revision and blueprint unchanged;
- the choice survives a reload;
- the TinyURL foundation study (no modules) looks the same in both views;
- Detailed export works.

**Docs:** add a "Detailed view" section to `studio.md` and update Layout and Diagram PNG export.

**Commit:** `UI07: detailed view on the canvas`

## UI08 — Interactive modules on the canvas

**Goal:** a module on the canvas and a module in the inspector are the same thing (R4).

**Change**

- In Select mode, clicking a module row selects its host and opens that module in the inspector,
  using the UI03 state. In Hand mode the rows let the pointer through.
- **While a module is open:**
  - its row is highlighted;
  - its drawn lines take the selection colour;
  - the rows of its in-process partners get a lighter mark.
- Opening a module from its inspector card marks its row in Detailed; Back clears the mark. In
  Overview, an open module keeps only its host tile selected.
- Each row is a button named "Open <module> in <host>" with a visible focus outline.

**Tests**

- Unit tests for the highlight sets.
- E2E on the YouTube study:
  - clicking a Transcoder row opens that module;
  - its lines and partner rows are marked;
  - Back clears the marks;
  - clicking another tile closes the module;
  - Hand mode doesn't open modules;
  - the design and blueprint don't change.

**Commit:** `UI08: interactive modules on the canvas`

## UI09 — Readability pass and measurements

**Goal:** make Detailed and the new inspector read well. Change no behaviour.

**Change**

- **Screenshots:** take them at 1440×900 and 1280×800 with the rails open and closed. Cover the
  three module studies, plus a project created from the v2 `design.json` (delete it afterwards).
  Compare the v2 Video lifecycle worker with the owner's sketch.
- **Tune only these:**
  - container width, header and row pitch (32 or 64);
  - fonts;
  - row frames and port marks;
  - inspector spacing and card density.

  Add no features.
- **Record in `studio.md`:** a fit-zoom table for each study, view and window, like the current one,
  plus the drawn size, line length and crossings for Overview and Detailed.
- **Evidence:** at most 8 PNGs and a short note under `evidence/ui09/`.
- **Playbook:** a lesson on what made modules readable and what still isn't.
- **HUMAN_FEEDBACK:** append a resolution that names the UI01–UI09 commits and the open issues.

**Commit:** `UI09: tune detailed view readability`

**Owner checkpoint B (recommended):** review the result before UI10.

## UI10 — Independent review

**Goal:** a fresh agent checks the result against the owner's images. It adds no features.

**Check**

- Check R1–R6 by mouse in the running app at both window sizes.
- **Invariants:**
  - layouts with no named ports are unchanged since before UI04;
  - the Overview export hash for the YouTube study matches the commit before UI01;
  - views, selection and modules never change the design or blueprint;
  - mouse-only use works.
- Search for leftover tab, focus and Unlink code and CSS, and for dead board props.
- Check that the docs match the app.
- Fix small defects with tests. List bigger ones in `docs/plans/ui-overhaul/review.md`.

**Commit:** `UI10: review UI overhaul`

## Risks and stop conditions

- **Ports break existing layouts** (UI04/UI05): stop and report. Don't change an existing layout
  rule to make ports fit.
- **Detailed is large:** Detailed draws bigger tiles and more lines, so YouTube will fit at a lower
  zoom. That is expected: you zoom in to read modules. UI09 measures it and the owner judges it.
  Don't hide modules or lines to make it smaller.
- **Removal of a module-anchored line:** X removes the whole relationship (see Decisions). If the
  owner instead wants it to remove only that module's link, that is a new owner decision. It would
  bring back a module-level operation in the UI.
- **Concurrent sessions:** see "Rules for every unit". While this plan was being written, another
  session's generator and docs work landed as `8813523`. Check `git status` before each unit
  anyway.

## Coordinator prompt

> You are a fresh agent in `/home/ash/github/jeeves`. Do unit **UInn** of
> `docs/plans/ui-overhaul/units.md`, and only that unit. First read `AGENTS.md`, the latest
> `docs/handoff.md` entries, the plan's Decisions and Rules, the HUMAN_FEEDBACK entry and its
> images. Follow the unit's Change/Tests/Docs, run every check, append a handoff entry, make one
> local commit named as the unit says, and stop. If a stop condition applies, or a file you must
> change has someone else's uncommitted edits, report and stop without committing.
