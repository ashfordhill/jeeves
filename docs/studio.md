# The studio

The studio is the **Design** tab: the lane canvas of one project, a chat rail on the left and an
inspector on the right. Designs describe intent; the studio does not provision or deploy them.
The [experimental generator](../jeeves-generator/README.md) supplies a separate mouse-operated
preview/ZIP export for supported selected local-v2 source, plus unchanged exact frozen YouTube
local-v1 export. It reads saved source and the [blueprint](studio-blueprint.md). Field values are
listed in [studio settings](studio-settings.md).

Normal editor and chat controls share `buildSupportedAuthoringCommand` and the actual default
registry reported by `GET /generation-support`. Catalog membership alone enables no control.
Custom requested behavior can be recorded as an unresolved requirement; it supplies no template.
Generate uses that same executing registry. Attachment does not certify runtime behavior or
strict TinyURL readiness.

## Projects

The project menu (top right) lists recent projects and opens **New project**, the project browser
(search, rename, delete) and rename. New project offers:

- **Architecture study**: a copy of a study, chosen in the **Study** list: the extended
  [TinyURL study](#the-tinyurl-study) (design only; the default, and a fresh installation starts
  with one), the [marketplace study](#the-marketplace-study) or the
  [YouTube study](#the-youtube-study). The project name follows the chosen study until you type
  over it.
- **Blank architecture**: an empty design.

The last opened project reopens on the next visit; its ID is in the URL.

## The lane canvas

There is one canvas, with no levels. It starts from the **user** (the actor, a stick figure), who is
always there and is not stored. The user starts two **lanes**: **download** (following, viewing,
consuming; drawn above) and **upload** (creating, posting; drawn below). Tiles both lanes reach sit
in a band between them ([Layout](#layout-and-navigation)). Every tile hangs off a lane, with no
islands and no cycles.

The user does at most two things, each an **action** tile: it consumes (the download lane's action,
**Consume** unless named otherwise: TinyURL's "Open link", YouTube's "Watch") or produces (the
upload lane's, **Produce** unless named otherwise: "Shorten", "Publish"). There is at most one
action per lane. The user links only to its actions, and each action links to the services that
handle it: its **lane entries**. A user never reaches a store or a third party directly; a service
does that for it. Actions are design intent: they generate no code, and tell the reader (and a
future generator's frontend templates) which user flow each service serves.

- **Tiles** are 128×128: the kind's icon in its family colour, the name in up to two lines and,
  at the bottom in small grey type, the tile's **kind label** (`studioKindLabel`): Service,
  Worker, Uploads, Identity, Database, Search index, Cache, Object storage, Queue or Topic, CDN,
  External API (and Gateway, Redirect, Notifications, Billing on older tiles). So a name needn't
  repeat its kind: YouTube's "Metadata" is labelled Database. Database, cache, queue and storage
  tiles are pills; services, APIs and externals are rounded rectangles. The user tile is 128×160.
  An **action tile** is 128×128 on the user's pastel: its lane icon in a round badge and its name
  in large type (smaller for a long name), so it reads as the start of a flow, not as a service.
  Actions and the user have no kind label.
- **Queue or Topic.** A message channel (the `queue` kind) is labelled by its mode
  (`settings.mode`): **Queue** for a work queue, **Topic** otherwise (the generation contract's
  default). A queue gives each message to one consumer: one transcoder takes each upload job. A
  topic copies each message to every subscriber, like a Kafka topic or a RabbitMQ exchange: the
  Search indexer and the Completion handler both get each completion event. A new channel is a
  work queue until a template derives a topic (or chat or source sets one); the mode has no
  normal form control.
- **Lines** carry target arrowheads. **Solid** is a direct call where the caller waits: HTTP, or
  a database, storage or cache read or write (a worker's store write after a queue included).
  **Dashed** is a message sent through a queue or topic, where nobody waits: publisher → channel
  and channel → consumer. Arrows point caller → target, including reads, rather than showing the
  return of data; messaging arrows follow publisher → channel → consumer. The user's line to an
  action and entry lines are solid. Lines carry no words or chips; select one for its label,
  interaction and direction in the inspector. Access declarations remain in diagnostics. The
  small legend at the lower left shows only the dashed sample, **Async**, with no help text and
  nothing to open (contract question 12); solid is the default reading. It stays at screen size
  and lets the pointer through to the board. Every line of the four studies follows this
  (`studio-lanes.test.ts`). A dashed line always goes through a Queue or Topic tile; a line
  between two services, or between a service and an external API, is always a direct call. A
  Worker is reached only from a Queue or Topic.
- At a crossing, a small gap separates the routes; shared stems meet at a tile's port. Where
  several routes are equally close to a mouse click, **Choose relationship** lists their
  endpoints and labels. Choose the intended relationship explicitly; SVG draw order does not
  decide which one is selected.
- Click a tile or a line to select it and open the inspector; click empty paper to clear.
  In Pointer mode the selected tile shows its tabs
  ([Creating and connecting](#creating-and-connecting)) and a red X, and its own lines (in and out) turn the selection blue, drawn over the rest, so you can
  see which tiles it reaches where lines share a bus. A selected line is drawn on top, thicker, in
  the same blue, with a red X ([Removing](#removing)).
  The [Detailed view](#detailed-view), the default, draws modules (components) inside their
  tiles as rows that open them and, in Connect mode, connect them. In the Simple view they are not
  drawn; they are cards on their tile's inspector page ([Inspector](#inspector)). C1 people,
  external systems and packages are not shown.

To trace relationships, select: a tile's lines turn blue, and a selected line shows its
endpoints, saved label and interaction in the inspector. Every line stays drawn and every tile
stays clickable. The highlight ends when the selection does, so clicking empty paper restores the
plain view; there is no separate mode to leave. Remove a relationship with the selected line's X.
When a removed tile had a neighbour, the selection moves to it. **Fit** frames the whole design.
Selection and Fit change no saved design, revision or blueprint.

## Detailed view

**Detailed | Simple** in the canvas toolbar switches the whole canvas between two views of the
same design. Detailed, on the left, is the default for a project with no saved choice. The choice
is remembered per project in this browser (one saved as "Overview", the Simple view's old name,
opens as Simple); it is never saved to the design, its revision or history, the blueprint or
chat. Switching keeps the
selection, including an open module, animates every tile to its new place and then fits.

In Detailed, every application tile that can hold modules (a Service, Worker or Uploads, and an
older Redirect, Notifications or Billing tile), or that has any, is a **container**
(`detailedView.ts`, `tiles/ContainerTile.tsx`): 256px wide, a 48px header with the kind icon in its
family colour, the name on one line and the kind label in small grey type below it, above a
divider, then one framed row per module, 32px apart, in module order, then a 48px footer with a
small blue **+** centred in it, inside the frame ([Adding a module](#adding-a-module)). A tile with
no modules yet is a container holding just its header and the `+` (96px tall). The `+` shows on
every such container, selected or not, in Pointer mode only; an export draws the footer empty.
A row shows the module's icon in its family colour and its name, cut short with an ellipsis; the
full name is its tooltip. A row whose kind can take a connection has a small **dot** on its right
edge, hollow until one of its slots is connected, then filled; a row that can't connect
(Redirect responder, Event counter) has none. In Connect mode the dot keeps its 12px size but is
easier to grab than it looks, and the dots of the container under the pointer grow a little
([Connect mode](#connect-mode)). Lines end at the container's frame; where a row has
a drawn line, a **port mark** (a short stub in the line's colour) joins the frame to the row on
that side, so the line visibly reaches its module. A warning mark sits in the header's corner.
Every other tile keeps its Simple view size and face.

- Each module link to a tile is drawn from (or into) that module's row, in the relationship's own
  direction, so a consumer's line runs channel → consumer. A relationship two modules use is drawn
  twice (YouTube's Packager and Thumbnailer both write Transcoded videos: 25 relationships, 26
  lines). A relationship no module uses, an entry and the user's line attach at the header.
- Of the links between modules of one tile, only an in-process slot's is drawn, the **Cache
  reader's loader** or **Favorites' items**: a short arrow in the container's left gutter, from
  that module's row to the Data access row it uses (the one a Cache reader loads from on a miss,
  or whose database says which items Favorites may keep; the rows move right to make room). It
  turns blue while either module is open. Every other link between modules of one tile stays saved and is neither drawn nor
  authored, and decides nothing that is generated.
- A drawn line is still its relationship. Clicking one selects that relationship: the inspector,
  chat's selection and removal use its ID, and every line drawn for it turns the selection blue,
  the clicked one thicker with the X. A relationship selected elsewhere (chat, Undo)
  shows its drawn lines the same way. **Choose relationship** names the modules ("Packager
  (Transcoder) to Transcoded videos") and offers each relationship once, by its drawn line under
  the click; where only one relationship's lines run together, a click selects it without asking.
  The X removes the whole relationship, with the same refusals and confirmation as in the
  Simple view; module links that use it go with it.
- Containers are tiles: click one's header to select it, and its link tab and X work as on any
  tile; its `+` works whether it is selected or not. Its link tab sits just outside its frame,
  beside its rows rather than over them. In
  Connect mode a drag from a row's dot connects that module, and a drag from anywhere else on a
  container, a row included, links the container ([Connect mode](#connect-mode)).
  A port mark turns blue whenever its line does: the container, the relationship, the tile at the
  line's other end or the open module selected it. Each row is its module, a button
  named "Open <module> in <tile>": a click selects the tile and opens the module's page in the
  inspector, as its card does. A row and a card are the same module: while one is open, from
  either, its row is filled in the selection colour and ringed, its name bold, and only the lines
  drawn from or into that row (and its port marks) turn blue (not the tile's other lines, nor
  another module's line of the same relationship). No other row is marked. The tile keeps its link
  tab and X. Back, another tile or line, or empty paper clears the marks; the Simple view keeps
  only the tile selected, with all its lines blue. A row reached by keyboard shows a focus
  outline. The marks are view only: an export never shows them.
- Both views are laid out by the rules in [Layout](#layout-and-navigation), each from its own last
  positions: switching back finds the Simple view exactly as it was, and an edit made in Detailed
  lays the Simple view out as if it had been made there.
- Detailed is larger, so it fits smaller ([Size and fit](#size-and-fit)). At the fit the rows'
  names are about 3–5px tall; zoom in to read them (they read from about 0.6, fully at 100%).

### Size and fit

Detailed draws module hosts as containers, wider and taller than a tile (each with the 48px
footer that holds its `+`), and more lines, so it is larger and fits smaller. Drawn size (`layout.bounds`), total line length and line crossings, with real ELK
on a fresh layout:

| Design | View | Lines | Drawn size | Line length | Crossings |
| --- | --- | ---: | --- | ---: | ---: |
| TinyURL extended | Simple | 12 | 1,024×832 | 2,752 | 0 |
| | Detailed | 12 | 1,280×896 | 3,136 | 1 |
| Marketplace | Simple | 23 | 1,280×1,472 | 6,912 | 1 |
| | Detailed | 25 | 1,568×1,632 | 8,896 | 4 |
| YouTube | Simple | 25 | 1,504×1,376 | 8,864 | 1 |
| | Detailed | 26 | 1,920×1,696 | 12,800 | 4 |
| YouTube v2 field design | Simple | 27 | 1,920×1,297 | 10,080 | 3 |
| | Detailed | 30 | 2,528×1,536 | 17,728 | 11 |

Fit zooms, which the canvas takes by itself. With one rail open a design that fits by height keeps
its rails-closed zoom; TinyURL extended's Detailed (0.61 with the chat open at 1440×900) and both of
v2's views fit by width and drop a little (v2's Detailed zooms are worked out from its drawn size,
the others measured in the browser):

| Design | View | 1440×900, rails closed | 1440×900, both open | 1280×800, rails closed | 1280×800, both open |
| --- | --- | ---: | ---: | ---: | ---: |
| TinyURL extended | Simple | 0.67 | 0.56 | 0.59 | 0.45 |
| | Detailed | 0.62 | 0.44 | 0.55 | 0.35 |
| Marketplace | Simple | 0.37 | 0.37 | 0.32 | 0.32 |
| | Detailed | 0.33 | 0.33 | 0.29 | 0.28 |
| YouTube | Simple | 0.39 | 0.38 | 0.35 | 0.30 |
| | Detailed | 0.32 | 0.29 | 0.28 | 0.23 |
| YouTube v2 field design | Simple | 0.43 | 0.28 | 0.37 | 0.23 |
| | Detailed | 0.35 | 0.21 | 0.31 | 0.20 |

v2's Detailed with both rails at 1280×800 stops at the zoom floor, 0.20: the fit's margin no longer
fits, but every tile and line is still inside the canvas. At these zooms a row's 14px name is 3–5px
tall: the fit shows the shape, and reading the rows takes about 0.6.

## Diagram PNG export

Click **Export diagram** in the canvas toolbar, then **PNG**. The download contains the full
saved diagram in the current view, including offscreen tiles, their names, kind labels and icons,
all projected routes, crossing gaps and arrowheads. A fresh YouTube study's Simple export is the
visual reference (D2: a recorded hash, not a gate), `9332ea16…89bd` (3008×2752) since the kind
labels. A Detailed export ends its filenames in `-detailed` and its capture details say `"canvas": "detailed"` under `view`; their tiles carry the containers' ports
and their lines the relationship each drawn line belongs to. No control is drawn: a container's
footer, where the canvas shows its `+`, is empty (YouTube's Detailed export: `21fe8400…9ae1`,
3840×3392). It uses the same HTML faces, SVG
lines and settled layout as the canvas, on light paper at 2× scale with a 32-board-pixel margin. Inspector details and the legend
are not part of the image; existing two-line tile names keep their canvas presentation.

The image shows canonical process and resource tiles, retaining every relationship identity.
Selection, editing controls and the interactive camera are omitted.
Export changes no saved design, revision, history, camera or selection.

**Source & diagnostics** shows, read-only, who owns and may read each store, and the full saved
source. **Download source JSON** preserves the complete document, including historical settings
and custom declarations. Its owner buttons select a logical owner for chat without changing
source. This path supplies no declaration forms or extra settings menu.

Finish saving inspector edits before opening export. Capture checks the complete saved source
before and after rendering, waits for layout animation and bundled fonts, and refuses a stale
project, failed/missing routes or labels, font failure or capture timeout. Closing the dialog or
switching projects cancels the pending download. Images over 40 megapixels or 16,384 pixels on
one side are refused, without shrinking them or silently clipping content. PNG export is checked
in Chromium; different browser/font/renderer versions are not promised identical pixels.

After downloading, **Download capture details** saves JSON for that exact PNG: project/revision,
source hash and its encoding, image hash/dimensions, canonical owner view, tile/line identities and
resolved positions/routes/chip bounds. It includes the renderer version, browser and Git identity
at build/startup when available; unavailable identity is `null`. Development/HMR captures require
an accompanying Git tree/commit audit. The details file is view provenance, not an editable design
or blueprint. Keep those source files separately and verify their source hash, following the
[field-version snapshot convention](plans/reliable-foundations/youtube-field-project-plan.md#diagram-images-and-visual-history).
No automatic version archive or generator is implemented by image export.

## Layout and navigation

The layout is automatic and never stored: ELK layered, left to right, with automation-illustrator's
options, in three bands, then put on the 32px grid. Each tile sits one column right of its furthest
predecessor (the user's actions share the first column after it, and their entries the next),
except a store several tiles use, which sits beside them (below); a fork is centred on its tile
as nearly as the grid allows, and links of one lane that meet at the
same tiles share one bus. The positions on screen are stability hints for the next layout, so
forks keep their rows and columns when the design changes, and changes animate for 200ms. The
first layout already follows these rules, so the first edit moves only what it changes. The canvas
writes no layout.

The **lane bands** (`laneBands` in the spec decides them; `layoutBands` in `jeeves/packages/board` draws
them):

- Every tile is in one band: **download** when only the Consume action reaches it, **upload** when
  only the Produce action does, and **shared** when both do (TinyURL's URL database: the Redirect
  service reads it, the Shorten service writes it). An action is in its own lane's band.
- From top to bottom the bands are download, shared and upload, 32px apart: every download tile
  sits above every shared tile, and every shared tile above every upload tile. Each band keeps its
  own rows, so rows a band leaves empty stay empty. The user sits at the left, centred between its
  actions: Consume above its centre, Produce below.
- A line belongs to its source's band. Lines of different bands share no run (but see
  [Limits](#limits)): they meet only in the last 32px before a shared tile, the download line joining from above and the upload line
  from below. Where one of them joins a bus that goes on past the tile, the meeting is drawn as a
  crossing.
- How: ELK lays out each band alone with the board's columns (forks and chains look as they did),
  the bands are stacked, and one more ELK pass routes every line with the tiles fixed. A shared
  tile gets one input port per band, so ELK never bundles two lanes into one bus, and a last step
  moves a bus in the gap before a shared tile when two lanes' lines would otherwise run together
  for more than 32px.

**Stores beside their users** (`endColumns` and `routeReturns` in `jeeves/packages/board`). A store (on
the board, any tile with links in and none out) sits next to the tiles that use it, so a tile's
links to its stores are short branches, not long lines beside the pipeline it also feeds:

- A store with one user sits in the column right after it.
- A store several tiles use sits in the first column, from right after its earliest user (its
  first link in, so a download user comes before an upload one), that doesn't make its band
  taller: where the band has fewer tiles than in its tallest column. It never sits more than one
  column before its last user, and at most right after it. YouTube: Original videos sit right
  after the Upload service, beside Upload jobs, and Transcoded videos right after Video delivery;
  View counts sit with Hot metadata and View events right after the Watch API.
- A later user's link then **comes back** to the store, drawn as a U like every other line: out of
  the tile's right side, back along a free row between the tiles (at least 16px from them, on the
  grid when it can be) and into the store's left side. Its two upright runs take free slots in
  the gaps it turns in (a gap with none is widened a grid step, moving everything right of it,
  unless that would stretch where two lanes' lines meet before a shared tile). It
  shares no run with another line, except its own tile's lines as it leaves and lines into the
  store on the last stretch (another lane's only in the last 32px), and touches no other line. Of
  those routes it takes the one with the fewest crossings, then the shortest. YouTube: the
  Transcoder's read of Original videos and its write of Transcoded videos come back one column;
  so does the View counter's write of View counts.
- Why the two limits (measured on the studies): a store right after its earliest user every time
  made every study's lines longer, because a U back past several columns is longer than the line
  it saves (YouTube's Search indexer's line came back across four columns, 1,536px, and all its
  lines came to 10,656px against 9,120px with the stores in the last column), and a store that
  adds a row to its band pushes every band below it down.

On the grid (`alignLayout` in `jeeves/packages/board`, run on every layout):

- Every port sits on a grid line, and the paper's dots mark the grid's crossings. A tile's top-left
  corner sits on a dot; the user, 160px tall, has its centre on a grid line instead.
- A line whose ends ELK left within 16px of each other is straight. ELK centres a merge between
  its predecessors, which would leave small jogs; in TinyURL the click path after the Redirect
  service is straight.
- Other lines bend by whole grid steps, so no bend is shorter than 32px. A merge exactly between
  two equally distant tiles takes the nearer grid line, so its two lines bend by different
  amounts (two services of one lane that both link to one database: 96px and 64px).
- Tiles in one column keep their order with at least 32px between them; a tile that moves down
  pushes the tiles below it.
- Lines that turn in the same gap between columns run 32px apart, so every column and every
  vertical run sits on a grid line. A line that passes a column keeps the row ELK gave it there,
  16px from the tiles beside it (between two tiles 32px apart, half a step off the grid).
- Shared vertical stems split into free grid slots in the same gap when that reduces overlap
  without more crossings, cross-band clashes, short jogs or a line through a tile. This pass moves
  no tiles and widens no gaps. Crowded gaps can still retain shared runs.

Drag empty paper to pan, with either tool; the wheel zooms, and zooming out stops a little below
the fit. The toolbar has two tools, **Pointer** (V, an arrow; a click selects) and **Connect** (C,
a link icon; a drag from a tile links it to another, [Connect mode](#connect-mode)), then **Fit**
and **Detailed | Simple** ([Detailed view](#detailed-view)). Escape returns to Pointer. The mode
is view state: it is never saved, has no history and changes no design, revision or blueprint.
The canvas fits when it opens; Fit refits, and never zooms in past 100%. The camera follows the
canvas:

- While the camera is fitted (since the canvas opened, or since Fit), it refits at once whenever
  the canvas changes size: a rail opens or closes (selecting opens the inspector), a rail is
  resized, or the window is.
- Once you pan or zoom, the camera is yours: rails opening and closing leave it alone until you
  click Fit or switch views; a view switch always fits.
- A new tile that lands outside the view is brought in: the canvas pans just enough to show it,
  with room for its tabs, at the same zoom. New links and chat edits don't move the camera.
- A Connect drag held near or past the canvas edge pans towards it
  ([Connect mode](#connect-mode)).

In the Simple view the extended TinyURL study fits at these zooms, which the canvas takes by itself
as the rails open and close ([Size and fit](#size-and-fit) has both views):

| Window | Both rails closed | Chat open | Inspector open | Both open |
| --- | --- | --- | --- | --- |
| 1440×900 | 0.67 | 0.67 | 0.67 | 0.56 |
| 1280×800 | 0.59 | 0.59 | 0.59 | 0.45 |

The extended TinyURL study draws 1,024×832px and fits by height unless both rails are open. The marketplace study
(1,280×1,472px) is taller than it is wide, so it fits by height whichever rails are open: 0.37 at
1440×900 and 0.32 at 1280×800. The YouTube study (1,504×1,376px) fits by height with at most one
rail open, at 0.39 and 0.35, and by width with both open, at 0.38 and 0.30.

## Creating and connecting

In Pointer mode the selected tile shows a tab on its right, for what the lane rules allow there,
and the red X on its top edge ([Removing](#removing)); a tile that holds modules has its module
`+` inside it ([Adding a module](#adding-a-module)). Nothing is inserted before a tile, and no tab
sits on a tile's left.

- **The link tab** (the link icon) adds a new tile after the tile and links the two. A tile has it
  when at least one kind fits after it, so databases, caches, storage and search indexes have none.
- **The user** has one `+`. Its fan offers its two actions, **Consume** (the download icon) and
  **Produce** (the upload icon); one the design already has is greyed ("This design already has a
  Produce action; each lane has one."), and when it has both the `+` is gone. A picked action
  becomes an action tile named Consume or Produce, selected with its Name field ready to type over
  ("Watch"). A project with no tiles opens with the user selected, so its `+` shows.
- **An action** has the same link tab: a new tile that becomes its entry, a Microservice, Uploads,
  Identity or a CDN; the other kinds are greyed ("An action reaches a service (not a worker), an
  API or the CDN.").
- **The module `+`** inside a Microservice, Worker service or Uploads tile (and an older Redirect,
  Notifications or Billing tile) adds a module to it ([Adding a module](#adding-a-module)).

**Click a tab** to open its fan, and click it again to close it; a click anywhere else, the wheel
or Escape closes it too, and picks nothing. The tab stays pressed while its fan is open. (A tab can
still be pulled, as before: past 36px a thick band stretches from under the tile to the pointer,
and releasing on a kind picks it; dragging is never needed.) The link tab opens a grid of the
eleven kinds a new tile can be, on one panel beside the tab, each with its kind's icon and name,
always in the same places, one row per group:

| Row | Kinds |
| --- | --- |
| Application | Microservice, Worker service, Uploads, Identity |
| Data | Database, Search index, Cache, Object storage |
| Messaging | Message channel (labelled Queue or Topic) |
| Edge | CDN, External API |

A kind the rules refuse after that tile is greyed, and its tip (under the pointer) adds why
("Click events can't link to a search index. A queue feeds only an application, not a search
index."). Gateway and the older Redirect, Notifications and Billing kinds are not offered;
existing tiles of those kinds keep working. The panel stays on the canvas, at least 16px inside
its edges, so it never covers a rail or the header. Where the canvas is too narrow for it beside
the tab, it goes beside its own tile instead, as one block: on the tile's left, or below or above
it, never over it; only a canvas too small for it on any side lets it cover part of the tile, as
little as it can. **Click a kind** to add a tile of it. It is named after the kind ("Worker
service", then "Worker service 2"), docks at the next slot beside its source while the layout
animates around it, and is selected with its Name field ready to type over (the canvas pans to it
if it landed out of view). After a queue both a Microservice and a Worker service consume; a new
database, cache, storage or queue belongs to the application it is added next to. A tab never
links to existing tiles: a click on a greyed kind changes nothing, and a pulled tab released on a
tile or anywhere else springs back.

### Adding a module

A tile that can hold modules has a small blue **+** inside it (`ModuleMenu.tsx`), in three
places that share one menu and one command:

- **Detailed:** at the bottom of every such container, centred under its rows, inside the frame,
  whether the tile is selected or not; a Service, Worker or Uploads tile with no modules yet is a
  container holding just the `+` ([Detailed view](#detailed-view)).
- **Simple:** in the top-left corner of the selected tile, clear of its icon, name, kind label and
  warning mark. Other tiles show none.
- **The inspector:** under the cards of the tile page's Modules section, which a tile that can
  hold modules always has ([Inspector](#inspector)).

None shows in Connect mode or in an export. **Click the `+`** to open the module menu, and click it
again to close it; a click anywhere else, the wheel, a resize or Escape closes it too, and adds
nothing. On the board the menu opens beside the tile, never over it: below it when there is room,
else on its right, left or above, inside the canvas, or over a rail when the canvas has no room
beside the tile (only a window too small for it on every side lets it cover part of the tile). From the inspector it pops out to the left of the rail, level with the `+`. It is drawn
at screen size, whatever the zoom, and lists the module kinds that tile allows
([catalog](../jeeves/CATALOG.md#components-c3)) under what each can generate in that tile, two to a
row, each with its icon, its name and its one-line description ("Data access · Reads and writes one
database."):

| Group | Means | A Microservice's | A Worker service's |
| --- | --- | --- | --- |
| **Template** | It leads an installed template once its connections are made | Cache reader, Auth guard, Multipart uploads, Search query, Favorites | Lifecycle writer, Video encoder, Event counter, Index writer |
| **Part of a template** | It fills a connection of a template led by another module in the tile | Event publisher, Data access | Event publisher, Event consumer, Data access, Video packager, Video thumbnailer |
| **Stub** | It is generated as a typed stub there | Rate limiter, ID generator, Redirect responder, Event consumer, External call, Custom | Rate limiter, Cache reader, ID generator, Redirect responder, Auth guard, External call, Custom |

An Uploads tile offers 11 kinds, a Microservice 13 and a Worker service 16; a Worker service's
menu fits on screen at 1280×800. **Click a kind** to add a module of it, named after the kind
("Data access", then "Data access 2"), at the end of the tile's modules (`addModule`). Its page
opens in the inspector with its Name field ready to type over; the tile is selected, and in the
Detailed view the container grows a row, its `+` moving down under it. A new module is
unconnected, which is allowed: it is generated as a stub until its connections are made
([Inspector](#inspector) says what it still needs). On a design saved before schema 3 the first
module also upgrades it. The module, its generation and the ownership it needs are one batch and
one undo step.

### Connect mode

**Connect** (C) in the toolbar, right after Pointer, links tiles already on the canvas. Press on a
tile and drag: a line follows the pointer from the tile, with its arrowhead at the pointer. The
board dims, and the tiles the lane rules allow at its end stay bright with a dashed outline,
which thickens on the one under the pointer. Over a refused tile the line turns red and a tip by
the pointer says why ("Analytics store can't link to Redirect service. A database can't link
onward.").

- **Release on an allowed tile** to link the two. **The drag's direction is the arrow's**: the
  line runs from the tile you pressed to the tile you released on, so a service drags to its
  store, and a store dragged to a service is refused, never reversed. From an action, the tile
  becomes that action's entry ("Redirect service already starts the download lane; a tile has
  one entry." where it can't). Nothing links onto the user or an action, and the user links only
  to its actions (its `+` adds them).
- **Release on a refused tile** and the notice gives the same reason; nothing changes. Release
  on paper or on the tile itself, or press Escape during the drag, and nothing happens.
- A press without a drag is a click: it selects, so the inspector works in Connect mode. Tiles
  show no tabs, `+` or X there, and the paper still pans.
- **A line under the pointer** turns the selection blue, is drawn over the rest, and shows its
  red X where a selected line's X would sit; the pointer can move from the line onto it. The X
  removes the line as in [Removing](#removing), with the same refusals, confirmation and Undo.
  The user's line to an action has no X.
- In the [Detailed view](#detailed-view) a container is linked from anywhere on it, a row
  included: the link is the tile's, as in the Simple view. A click on a row still opens its
  module.
- **A row's dot** connects its module instead (`connectModule`). Drag from the dot to a tile:
  the tiles the module can use stay bright, and a refused one fades with the reason ("Data
  access can't use Cache; a Data access connects to a database."). The connection fills the
  slot that takes that tile's kind, through the tiles' existing link, or through a new one the
  lane rules give when the tiles aren't linked yet. The dot fills.
- **The dot's grab area** is at least 16px wide on screen at any zoom (28px at 100% and above), and
  reaches into its row rather than past the frame. It is as tall as the rows' 32px pitch allows,
  so two rows' areas meet halfway between their dots and never overlap: at the YouTube study's
  Detailed fit (0.34 at 1440×900) a dot drawn 4px wide is grabbed anywhere in about 16×11px. The
  dots of the container under the pointer grow from 12px to 16px, to show where they are.
- **Near the canvas edge a drag pans the canvas.** Hold a drag, from a tile or a dot, within 40px
  of the canvas edge or past it (over a rail or the header) and the canvas moves towards that
  side, faster the nearer the edge, at most 480px a second, until the tiles' far edge is in view.
  The line still ends at the pointer, and a release on an allowed end connects as usual. The zoom
  stays, and the camera is then yours, as after any pan. At the fit everything is in view, so
  nothing pans.
- **The Cache reader's loader**, and **Favorites' items**, are a drag from its dot onto a Data
  access row in the same tile; that row stays bright with a dashed outline. Each is drawn as a
  gutter arrow.
- **A module's line under the pointer** shows an X named "Disconnect <module> from <tile>": it
  removes that module's connection (`disconnectModule`) and leaves the tiles' link and the other
  modules' lines. A gutter arrow under the pointer shows the same X. A line no module draws keeps
  the X that removes the link. In Pointer mode a selected line's X still removes its whole
  relationship.
- Each connection, and each disconnection, derives the module's generation and ownership in the
  same batch: one undo step.

Every new link takes its pair's default mode from the [link table](../jeeves/CATALOG.md#lanes-and-links):
asynchronous (a dashed line) to and from a queue, a request (a solid line) otherwise. Where the
table allows both, the line inspector's Interaction field switches it. Each add or link is one
batch and one undo step.

Every tile must hang off the user through an action, with no cycles, links the
[link table](../jeeves/CATALOG.md#lanes-and-links) allows and at most 5 links out of a tile and 4 entries
per action; a tile has one entry at most, and a lane one action. An edit that breaks one of these
rules is refused with a notice and changes nothing, whether it comes from the canvas, the
inspector, chat or the API.

Optional shortcuts: V picks the Pointer, C connects, Escape closes an open fan or module menu
and cancels a pull or a drag (and otherwise returns to Pointer). Every action works by mouse
alone.

## Removing

The selected tile has a red **X** centred on its top edge (faint until the pointer is on it); the
user has none. The X removes the tile and links each tile before it to each tile after it, wherever
the [link table](../jeeves/CATALOG.md#lanes-and-links) allows, unless the first already reaches the
second another way. A restitched link is asynchronous when either link it replaces was, and a lane
entry passes on to its action.

An action's X removes the action and its entries, unless that would cut tiles off; then nothing
changes and the notice names them ("Removing Watch would cut off API."). An action with no
entries, or whose tiles are also reached another way, goes at once, and the user is selected.

When the restitching can't reach some tiles (a resource doesn't link onward, so nothing replaces
the links through it, or the table refuses the replacement), a panel opens at the bottom centre of
the canvas instead. It lists the tiles that would be cut off, with their icons, and marks them, and
the tile itself, with a red dashed ring on the board. **Remove N tiles** removes them all;
**Cancel**, Escape, clicking empty paper or selecting anything else changes nothing. Removing
Click events in TinyURL takes the Analytics worker with it ("Remove 2 tiles"): a worker takes its
work only from a queue or topic, so the Redirect service can't link to it directly. Removing the
Redirect service takes the URL cache, Click events and the Analytics worker with it ("Remove 4
tiles"), since a lane can't start at a cache or a queue. The URL database stays: the Shorten
service still writes it.

A selected line has a red X on a stretch of it that no other line shares, or at its middle when
every stretch is shared. It removes that connection or entry, unless a tile would be cut off;
then nothing changes and the notice names the tiles ("Removing the link from Redirect service to
Click events would cut off Click events and Analytics worker."). The user's line to an action has
no X: it goes with the action.

After removing a tile, the tile before it is selected (the first one, in lane order; often the
user); after removing a line, nothing is. The modules, module links and settings that named what
went are removed with it; a database, cache, storage or queue whose owner went belongs to the
first application that still links to it. Each removal is one batch and one undo step.

In Connect mode any line under the pointer shows its X ([Connect mode](#connect-mode)); on a
module's line in the Detailed view it disconnects only that module. The tile X stays a Pointer
mode control.

Optional shortcuts: in Pointer mode, Delete or Backspace does what the selected tile's or line's X
does.

## Inspector

The inspector shows the selection. A tile or the system is one scrolling page with no tabs, in
this order:

1. A header: the kind icon, the **Name** (the page's title, edited in place; it is printed only
   there), the kind and the tile's [warnings](#warnings).
2. **Description**, the same word for the system, tiles and modules. The box starts at 6 rows,
   grows with its text to half the rail's height, then scrolls; dragging its corner sets the
   height by hand.
3. **Options**, only when the tile has useful settings with actual installed template consumers:
   HTTP deadline/admission, adjustable worker concurrency, cache TTL, SQL pool size and statement
   timeout when selected by a feature. Fixed local Docker/TypeScript, provider, media and internal
   policies have no controls. Historical unsupported settings remain in source and diagnostics
   unchanged. A saved number outside its bound (an older design) still opens: its own field shows
   the value and the reason, and only that field shows until a value in range is saved
   ([settings](studio-settings.md#normal-feature-configuration)).
4. **Modules**, when the tile has modules or can hold them: a stack of cards, each one button
   ("Open <module>") with the module's icon in its family colour, its name, its kind and the
   first two lines of its Description, then the blue **+** centred under them. The `+` opens the
   same module menu as the board's, out to the left of the rail
   ([Adding a module](#adding-a-module)).

The page lists no connections: the drawn lines are the relationships, and selecting one shows its
details.

- Ownership, grants and legacy inferred writers remain in source and read-only diagnostics.
  Normal forms do not require a permission matrix or duplicate writer edit. See
  [ownership](studio-settings.md#explicit-logical-ownership-and-store-access-schema-v3).
- A module's card, or its row in the [Detailed view](#detailed-view), opens its page in place of
  the tile's, again one page with no tabs: a **Back to <tile>** row (the tile's icon and name), a
  header with the module's icon, Name (the title) and kind, then **what it generates**: Template
  with the template's name ("Template · Cache read"), Stub with what its template still needs
  ("Needs a Data access as its loader.") or why it has none ("No template in Watch API uses
  it."), Refused with the kept value that blocks it, or Custom when no generation declaration
  covers it yet (a study's modules before any module command). Then any readiness findings, Description,
  **Options** only for the settings a template consumes (Pool size and Statement timeout on a
  Data access in a template, and on a Lifecycle writer, its template's SQL settings; **Sign-in**,
  Required or Optional, on an Auth guard once it verifies an Identity, "Template · Sign-in";
  none on Favorites, whose bounds are fixed: "Template · Favorites" beside an Auth guard set to
  Required, else "Needs an Auth guard set to Required in <tile>."), and
  **Remove module** at the bottom (`removeModule`, which
  re-derives the tile's generation). It lists no links: a module's links follow its tile's drawn
  lines and its row's dot; in Detailed its row and its own lines are marked. Back returns to the tile page with Modules in
  view. Selecting another tile or a line, or clicking empty paper, closes the module; so do Remove
  module and a history step that removes it, which show the tile page. Undoing that step
  reopens the module, as a selected tile comes back when Redo restores it. While a module is
  open, chat's selection is the module's ID. The open module is the workspace's selection
  (`selection.ts`), never saved.
- Modules are added with the [module `+`](#adding-a-module) (in the tile or the inspector) and
  connected in
  [Connect mode](#connect-mode); a module's kind can't change, and changing a name does not
  normalize historical settings.
- A module command on a study derives the whole tile's generation. On the TinyURL extended and
  YouTube studies the Cache reader the study already wires then reads **Refused**, as does its
  Data access ("The link from Watch API to Metadata uses Service identity, which its
  template can't use; 9 other saved values can't be used either."): the study keeps values no
  control edits, such as its links' Service identity and its replicas. Nothing else changes,
  and Undo returns the study.
- A line shows endpoints, its saved action and interaction. Only its action label
  is normally editable. Transport/security/retry declarations remain in source; new local links
  use HTTP where applicable and Private network explicitly.
- Select the user (or clear selection) to open the system inspector: its Name, Description, then
  the list of every [warning](#warnings) (each with a button that selects its tile or action).
  Templates are reached only through [modules](#adding-a-module); a design that attached the
  retired video or YouTube feature preset stays readable, editable and exportable.
- An action: its lane icon and name, then its warnings, **Name** (the word on its tile, at most 24
  characters; it autosaves like a tile's name) and its **Lane** (read-only). Its entries are the
  lines drawn from it; an action with none has a warning.
- A lane entry (its line): its action, then the **lane row**: download and upload as icons (the
  name is the tooltip), the current one filled yellow. Clicking the other moves the entry to that
  lane's action; when that lane has no action, or its action already has 4 entries, it is faded
  and its tooltip says why ("The upload lane has no action yet; add its Produce action first.";
  "Watch already has 4 entries; the most is 4."). Below, the action and the tile it reaches, each
  a button that selects it.
- The user's line to an action: the action, and the user and the action as buttons.

A tile or action with a warning lists it, in yellow, below its kind.

**Names and IDs.** A tile's or module's ID follows its name while it still has the form it was
created with (`worker-service`, `worker-service-2`; `<tile>-data-access`) or its current name's
slug. Renaming it re-keys the ID: a tile becomes the new name's slug (`video-lifecycle-worker`),
a module `<tile ID>-<slug>`, and a tile's following modules move to its new ID with it. Every
reference moves in the same step (links, module links, entries, ownership, generation, operations
and scope; derivation re-runs), so it is one Undo step, and Undo moves the IDs back. Link IDs never
change. The re-key happens when the name's autosave commits (after 500ms or on blur), not per
keystroke; the tile or module stays selected under its new ID, and a field being typed in keeps
its focus and text. A name whose new ID something else already has waits in the field with the
reason ("Microservice would take the ID microservice, which Microservice already uses. Choose
another name.") and saves nothing until it is changed. A name whose slug is no ID (empty, or
starting with a digit) keeps the ID; a long one is cut to 63 characters. **Pinned:** the studies,
the frozen v2 project (a study origin), designs with a tile-level template or a feature preset, and
IDs that follow neither form (hand-chosen, imported, or given to chat's `addTile`/`addModule`) keep
their IDs; renaming changes only the name.

Valid text autosaves after 500ms or on blur; selects commit at once. Selecting, opening a module
and navigating flush pending valid edits; invalid unsent drafts are discarded. A rejected write stays
visible with Retry/Discard. A revision conflict adopts the fresh design with "Changed elsewhere;
reopen to edit."

## Warnings

A **warning** is a design that looks wrong but is allowed. A design is built step by step, so a
queue with no consumer yet or a new action with no entries must be accepted while you build it.
Warnings never refuse an edit: no command, fan, menu, connect or chat call is blocked by one, and they
are not "Fix the lanes first" problems (those are lane errors). The rules are:

- **A store with no writer**: where resource access is declared, no valid authority/role/write
  request/matching grant. Otherwise use the legacy inferred owner: no owner, or an owner that
  does not link to it, for example after removing the owner's link ("URL database has no writer: its owner Shorten service doesn't link to it. Link Shorten
  service to it, or choose another owner.").
- **A worker's output nobody reads**: a store whose only links come from its owner, a worker
  ("Nothing reads Analytics store: only its owner Analytics worker links to it. Link the service
  or API that reads it."). A cache only its owner uses is normal and is not flagged.
- **A queue with no publisher, or no consumer** ("Link events has no consumer: nothing takes its
  messages. Add a worker after it.").
- **An action with no entries** ("Watch has no entries: nothing handles it yet. Add the service or
  API that handles it after it, or remove the action.").
- **Uploads with no storage relationship**: an Uploads tile has no outgoing link to object
  storage. Its transfer setting alone does not specify durable storage.
- **A worker with no outgoing relationship**: no output, publication or downstream call is
  represented. Any outgoing relationship clears this narrow check; it does not establish that
  a business side effect is implemented. Names, labels and modules cannot establish one.

On the canvas, a tile or action with a warning has a small yellow mark in its top-right corner;
the pointer on it shows the message. Its inspector lists its warnings, and the system's inspector
(click empty paper) lists them all. The mark goes as soon as the design is fixed, or with Undo.
The blueprint reports warnings as findings (`DESIGN_WARNING`, severity `warning`), and chat sees
them. The three studies have none. The rules live in `studio-warnings.ts`.

## History

**Undo/Redo** in the header step through the server's design history. Each accepted inspector
batch (an autosaved edit, an action's rename, an entry's lane switch, or adding, connecting,
disconnecting or removing a module) or chat turn is one step; a new edit ends the redo chain. A
rename that re-keyed IDs is one step too: Undo and Redo move the IDs back and again, and the
selection (an open module included) follows them; the server's answer lists them as `renamed`. Selecting, opening a module or going Back,
switching between Detailed and Simple, opening a fan or a module menu, hovering, a cancelled drag, panning,
zooming and Fit add none and leave the design and blueprint unchanged. The history survives reloads.

Optional shortcuts: **Ctrl+Z** (**Cmd+Z** on a Mac) presses Undo, and **Ctrl+Shift+Z**
(**Cmd+Shift+Z**) or **Ctrl+Y** presses Redo, only while that button is enabled. In a field (a
name, a setting, the chat box) they are left to the browser's own text undo, and while a dialog is
open (Export diagram, a removal's confirmation, Choose relationship) they do nothing.

## Logical owners, roles and access

Module commands derive who owns each store and who may read it; generation reads that.
**Export diagram → Source & diagnostics** shows it read-only, with the saved source. Removal
previews still name the declarations a removal affects, and one Undo restores them; moving an
entry that would clear operation bindings asks first.

## Chat

Chat (left rail, open by default in a fresh project) edits the design with the canvas's own
commands, validation and history: a chat turn is one undo step, however many commands it ran.
**It can do exactly what the mouse can, and no more** (D6): new tiles are the link fan's eleven
kinds, modules come from the module catalog, templates come only from modules, and the
Runnable processes option is the dialog's. A new tile of a legacy kind (Gateway, Redirect,
Notifications, Billing) is refused with a plain reason ("A new tile can't be Billing: … For
payments, add a Service that owns its payment records and calls the provider as an External
API."); existing tiles of those kinds keep working and keep their modules.

**The prompt is short; the tools carry the knowledge.** The instructions (about 2.8 KB) set one
working loop, **plan → apply → review → fix** (preview when unsure), the turn's budget and the
few rules that hold everywhere. What a modest model needs to get a design right comes back from
the tools, whose schemas total about 37 KB (44 KB as OpenAI's strict tools, down from 86 KB and
113 KB before V3-19), measured with sixteen tools; chat now has eleven:

| Tool | Gives |
| --- | --- |
| `listStudioDefinitions` | The eleven tile kinds a new tile can be, each with its label; the tile types with their kinds and defaults; the module catalog (each kind's slots, the tiles that hold it, what it becomes there, Template, Part of a template or Stub, as the `+` menu groups it, and its one-line description); the link table (generated from `studioLinkRules`); the caps; the lane canvas and kind notes; the warnings sentence. |
| `getDesign` | The design compactly, as the canvas draws it: the actions with their entries and the tiles each lane reaches; each tile in lane order with its kind and label, settings, links (sync or async, and whether a link into a store writes or reads) and modules (kind, each link's slot, status and why); the status counts; Runnable processes; `editableSettings` (the only normal settings, each naming its tile or module and setting); the design's findings and warnings, with readiness findings only counted (notSpecified). |
| `listStudioPatterns` | The seven curated patterns `applyPattern` builds, with what each makes, its templates and each argument with its default ([patterns](studio-patterns.md#curated-module-patterns)); and the four reviewed guidance records. The defaults are neutral placeholders (Records, Login, Jobs), never a study's names, so a design's names come from the person. |
| `applyPattern` | One pattern as one validated batch, names and links filled in from its arguments; `preview: true` dry-runs it (what would change, every module's status with why, what would be left) and keeps nothing. Every step is a command the mouse could send; one refused step refuses the whole pattern. |
| `applyStudioCommands` | Chat's commands, or with `preview: true` a dry run of them: the lane commands (`addAction`, `renameAction`, `removeAction`, `addTile` after a tile or a lane's action, `linkTiles`, `removeTile`, `removeLink`, `setEntryLane`), `editTile`, `setSetting`, `editSystem`, `editConnection` (label only), the module commands (`addModule`, `connectModule`, `disconnectModule`, `removeModule`, `editModule`) and `setRunnableProcesses`. |
| `reviewDesign` | The staged changes, every module's status, and what is left (below), with the design's findings (readiness findings only counted), assumptions and unsupported obligations. |

Every accepted `applyStudioCommands` or `applyPattern` returns an **automatic review**: how many
modules are in each status, the ones that aren't templates with why, and every finding left.
Each finding names its tile or module, says **fix** (unfinished or wrong: fix it or say why it
stays) or **check** (advice to confirm), and gives a concrete fix, as commands where one is
possible; those commands are checked against the design before they are offered
(`designReview`, `studio-design-review.ts`). The checks:

- **module-status:** a lead that is a Stub because its template still needs something ("Needs an
  Auth guard set to Required in Account API.", fixed by setting the guard's Sign-in), a Refused
  module with the saved value its template can't use, a module not declared yet. A stub that is
  normal ("No template in Watch API uses it.") is listed in the statuses, not as a finding;
- **unconnected-slot:** a needed slot with nothing in it, connected through the host's own link
  where it has one, or with a new module or tile for it;
- **generation:** the resolver's findings, as Generate project shows them, except those a Refused
  module already names. A process's own setting saved out of range (an older design) comes with
  the command that clears it, so the process runs its initial value;
- the playbook's smells: **store-without-writer** (the design warning, and a store only modules
  that read reach), **unrelated-store** (a worker writing stores for more than one concern; the
  fix disconnects the extra writes), **user-reaches-store** (an action's line to a store; removed
  when a service already reaches it), **long-line** (a reader's line to a store whose last user
  is far down a pipeline; advice only, never a tile to shorten it);
- **line-style:** a line whose style contradicts its channel, redrawn as the link table makes
  it, with its module links reconnected. A dashed line between two services or to an external
  API is flagged too. A line the lanes can't remove first (it is all that reaches its tile) can't
  be redrawn by mouse or chat, and its fix says so;
- **warning:** the other design warnings, with what to do.

The service keeps the review in the loop: a fresh `reviewDesign` reaches the model before
commands or meaningful declared scope finish, even if the model ends its response; later
commands make it stale; the model may make two response batches of repairs after receiving it,
within the 16-round limit. The prompt states that limit, and from three responses left each tool
round ends with a reminder ("[Jeeves] 3 of 16 responses left in this turn…"): a turn that runs
out still saves nothing. A question still ends the turn immediately. After saving, the final
review of the saved revision lists what is left in **Review details**, and the reply says how
many findings are left to fix and to check. Review/no-op turns create no design revision or
Undo step. Warnings remain saveable; structural errors still refuse a batch.

**Chat's commands** (V3-19) are the canvas's commands in a smaller, flatter form a modest model
can write (`jeeves/apps/server/src/chat/commands.ts`). Each compiles to exactly one studio command
on the design it runs on, through the same builder:

- a tile is always `tile` and a module `module`: `editTile {tile, name?, description?, owner?}`
  (owner is the tile that writes a store) and `editModule {module, name?, description?}` send the
  canvas's `edit` and `editComponent`;
- a setting is one `setSetting {tile or module, setting, value}`, a row of
  `getDesign.editableSettings` with a new value (null clears a process setting). It is merged into
  the target's settings and sent whole, as the inspector field sends it, after a check against
  that target's normal controls; a refusal lists them with what each takes;
- IDs follow names: `addTile` and `linkTiles` need no `id` or `linkId`, and `side` is gone;
- only what chat may send is listed: no legacy tile kinds, `changeKind` or raw component
  commands. The studio's own shapes (a settings object on `edit`, `editComponent`, `side`,
  `planned.label`) are still accepted, so a fix written the spec's way isn't refused for it.

A batch is **all or nothing**. Every command is checked on its own shape first, so a refused
batch names **every** malformed command at once (its number, what is wrong and the shape it
takes, with the right command for a name a model reaches for: "There is no "setOwner" command;
use editTile."); otherwise up to five commands the builder refuses, in the same plain words as
the canvas notice ("URL cache can't link to Shorten service. A cache can't link onward."), each
checked without the refused ones before it and saying so. Nothing of the call is kept, the turn
goes on, and the model sends the corrected call again; the turn's activity list shows it. A
command whose effect is already in the design (a link or entry that exists, a slot already
holding its target, a module or tile already there under that name) is skipped and listed as
`skipped`, not refused, so a resent batch goes through. A call takes at most 50 commands; more is
refused with what to do (two calls in one response, which run in order). The apply tools take no `baseRevision`
(one sent is ignored): a turn edits one working copy, and the commit still refuses a concurrent
edit. Their results count readiness findings (a behavior profile, contracts, ownership
declarations) under `notSpecified` instead of listing them beside design errors, and
`reviewDesign` leads with `left`. Review fixes come back in the same commands. A rename re-keys IDs that
follow their names, as the inspector does ([Names and IDs](#inspector)); results list them as
`renamed: [{from, to}]`. An `addModule` with a name and no ID takes its ID from that name. The selected tile, line or entry is
sent with each message, so "Add a cache after the selected service" works; the user, an action
and the user's line to it have no design ID, so selecting one sends nothing. Chat can ask one
focused question with clickable choices, and accepts Markdown, text and images (PNG, JPEG, WebP,
SVG). Token counts and provider-reported cost appear only when complete. The model and provider
are chosen in **Settings**: OpenAI's API, Codex's own login, or (V3-19) Anthropic's API, with
the key read from `ANTHROPIC_API_KEY` in the environment only and never stored. Chat and the
inspector collapse and resize independently.

OpenAI chat uses strict function schemas with a wire adapter that preserves omitted settings,
defaults and explicit owner clearing. Codex constrains the outer answer only: its inner argument
JSON strings still need server validation. Its preamble tells the model the Jeeves tools are called
through `toolCalls` and are always available that way (V3-19: a smaller model sometimes looked
for them in Codex's own tool list and told the person it couldn't make changes). Anthropic gets
the canonical schemas as they are, with adaptive thinking at medium effort and prompt caching;
nothing constrains its arguments either.
Every provider uses the same canonical commands and validators. See [tool argument schemas](chat-tool-schemas.md) for the audited subset and limits;
strict arguments alone establish no architecture or runtime guarantee.

The four [reviewed guidance records](studio-patterns.md) (cache-aside lookup, durable background
jobs, committed publication to search, pending-order/payment coordination) stay available through
`describeStudioPattern`, and `declareReviewScope` selects their checklist IDs and custom
requirements for **this turn only**. Checks without typed contracts say **not specified**, even
if a name or module describes the behavior. No review claims a runtime template or verification.

## The TinyURL study

The extended design-only study, `studio-tinyurl@3.2.0` ([factory](../jeeves/packages/spec/src/studio-examples/tinyurl.ts)),
is a read-heavy URL shortener built from four published designs and one open-source shortener:

- HelloInterview, [Design Bit.ly](https://www.hellointerview.com/learn/system-design/problem-breakdowns/bitly)
- System Design Primer, [Pastebin / Bit.ly](https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/pastebin)
- DesignGurus (Grokking), [TinyURL](https://www.designgurus.io/course-play/grokking-the-system-design-interview/doc/designing-a-url-shortening-service-like-tinyurl)
- ByteByteGo (Alex Xu), [Design a URL Shortener](https://bytebytego.com/courses/system-design-interview/design-a-url-shortener)
- [Dub](https://github.com/dubinc/dub), an open-source link shortener (AGPL)

All four designs have a create path, a redirect path with a cache in front of the database, and
one URL database written by create and read by redirect. Three of the four split redirect and
create into separate services. DesignGurus reads click analytics through a stats API (queue →
consumers → store → analytics API). ID generation is a module-level detail; the URL safety check
and the expiry cleanup job are left out for the developer to add.

It is laid out in lanes from the user, through its two actions, **Open link** and **Shorten**:

```text
DOWNLOAD (reads)
  User → Open link ⇣ Stats API → Analytics store                     (reads)
                   ⇣ Redirect service ⇢ Click events ⇢ Analytics worker → Analytics store
                                      → URL cache
                                      → URL database                 (reads on a cache miss)
UPLOAD (writes)
  User → Shorten   ⇡ Shorten service → URL database                  (the only writer)
```

Each store has one writer, its owner: the Shorten service writes the URL database, the Redirect
service the URL cache (it fills it on a miss) and Click events, and the Analytics worker the
Analytics store. In all: the user, two actions and eight tiles, and twelve links (the user's two
lines to its actions, three lane entries and seven connections), two of which are asynchronous
(click publication and consumption); the Analytics worker's store write is solid. The URL database, which both lanes reach, sits in
the shared band between them. The Analytics store sits on the top row, right above the Analytics
worker that fills it: the Stats API's read runs straight along that row, and the worker's write
comes back up to it ([Layout](#layout-and-navigation)). Of the twelve entry and link orders, laid
out with real ELK, the six with the Stats API's entry first draw no crossing (20 bends); of those,
the Redirect service's link to Click events first draws the shortest lines (2,752px in all, the
longest the worker's write, 416px). The study has no C1 people or relationships and no package.

| Part | Content |
| --- | --- |
| Tiles | Redirect service (Go, public, Docker), URL cache (Redis cluster, LRU), URL database (PostgreSQL, two read replicas, partitioned by `short_code`), Click events (topic), Analytics worker (TypeScript), Analytics store (ClickHouse), Stats API (TypeScript) and Shorten service (TypeScript). |
| Modules | Redirect service: cache reader (cache-aside, in-process L1 plus Redis, negative caching, single-flight), link reader (replica, on a miss), redirect responder (302, no edge caching) and batched click publisher. Analytics worker: click consumer (batches of 1,000, bounded retries), custom aggregation and aggregate writer. Stats API: stats reader. Shorten service: link writer, which generates the short code. |

**Why there is no CDN.** What is cached is the lookup, not the redirect response. All four
designs put a cache in front of the database. Caching the 302 at a CDN or in the browser stops
clicks reaching the service: ByteByteGo's 301-versus-302 discussion and HelloInterview make that
trade explicitly, and Grokking answers 302 with `Cache-Control: no-store` so every click counts.
Dub shows how it is done in practice: its redirect runs as code on every request (Next.js
Middleware), reads link data from Redis, answers 302 and records the click after responding
(`apps/web/lib/middleware/link.ts` in Dub); only its static pages get CDN cache headers. So Open link
reaches the Redirect service directly. Running the redirect near users is a setting of the
Redirect service (Execution **Managed**, Host **Cloudflare Workers**), not a CDN tile.

The study stores no layout. Its [blueprint](studio-blueprint.md#example) has two actions, three
entries, four services, four resources, no externals, seven connections (each link into a store
marked `write` or `read`) and all nine components, with nothing omitted and no findings. Projects
made from earlier versions keep their own design (a lane with entries reads with its default
action, Consume or Produce); only new copies are v3.2.

## The marketplace study

`studio-marketplace@1.3.0` ([factory](../jeeves/packages/spec/src/studio-examples/marketplace.ts)) is a
multi-seller marketplace with Etsy's core functionality, designed as clean microservices rather
than copied from Etsy. Its core flows, and the tiles that carry them:

- A seller opens a shop and lists products with photos: the Shop service writes the Catalog
  database and Product images, and publishes Listing events.
- A buyer browses and searches listings and opens a product: the Storefront API reads the Search
  index, which the Search indexer keeps in step with Listing events; the Image CDN serves the
  photos at the size each page asks for.
- A buyer keeps a cart and checks out: the Cart service and its Cart store; Payments prices the
  cart from the Catalog database and takes one Stripe payment for it.
- Payment goes through Stripe, sellers get paid and orders are recorded: Payments transfers each
  seller's share to their Stripe connected account and publishes the paid order to Order events,
  from which the Order recorder writes the Orders database.
- Buyers and sellers see their orders: the Orders service reads the Orders database.
- Buyers and sellers sign in through Identity (OpenID Connect).

Sources:

- Educative, [E-Commerce System Design](https://www.educative.io/blog/ecommerce-system-design)
- System Design Handbook, [Design an E-commerce System](https://www.systemdesignhandbook.com/guides/design-e-commerce-system-design/)
- ByteByteGo (Alex Xu), [Payment System](https://bytebytego.com/guides/payment-system/)
- Google, [Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo), a
  microservices demo
- Microsoft, [eShop](https://github.com/dotnet/eShop), a reference application
- Stripe Connect, [separate charges and transfers](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/separate-charges-and-transfers)
- Cloudflare, [Optimizing image delivery with Cloudflare image resizing and R2](https://developers.cloudflare.com/reference-architecture/diagrams/content-delivery/optimizing-image-delivery-with-cloudflare-image-resizing-and-r2/)
- AWS, [Dynamic Image Transformation for Amazon CloudFront](https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/solution-overview.html)
- Etsy: High Scalability, [The Etsy Saga](https://highscalability.com/the-etsy-saga-from-silos-to-happy-to-billions-of-pageviews-a/);
  Code as Craft, [Batch Processing Millions and Millions of Images](https://codeascraft.com/2010/07/09/batch-processing-millions-of-images/)

What the sources agree on: a catalog service with its own database, a cart service with a
key-value store (Online Boutique and eShop keep carts in Redis), a separate payment service and
orders in a relational database. Educative and the System Design Handbook feed a separate search
index asynchronously from the catalog, and the Handbook keeps catalog data for reading in search
indexes "optimized for reads". eShop, Educative and the Handbook pass payment and order changes as
events. ByteByteGo and Educative give the payment service its own database. The three questions
the plan left open, settled from the sources:

- **Search** lives in a search index fed from the catalog through listing events (Educative, the
  Handbook); the Storefront API reads only the index.
- **Thumbnails** are resized on request at the edge: Cloudflare's and AWS's image-delivery
  reference architectures store only originals and let the CDN resize and cache each size. So
  there is no thumbnail worker; the Image CDN has **Image resizing: On request**. (Etsy
  pre-generated fixed sizes in batches, Code as Craft 2010.)
- **The cart** is its own service with a Redis store (all four designs).

It is laid out in lanes from the user, through its two actions, **Browse** and **Buy & sell**:

```text
DOWNLOAD (reads)
  User → Browse     ⇣ Storefront API → Search index                     (reads)
                    ⇣ Orders service → Orders database                  (reads)
                    ⇣ Image CDN → Product images                        (reads; resizes on request)
UPLOAD (writes)
  User → Buy & sell ⇡ Shop service → Product images, Catalog database   (the only writer of both)
                                   ⇢ Listing events ⇢ Search indexer → Search index
                    ⇡ Identity                                          (sign-in)
                    ⇡ Payments → Catalog database                       (reads prices)
                               ⇢ Order events ⇢ Order recorder → Orders database
                               → Payments database
                    ⇡ Cart service → Cart store
```

Each store has one writer, its owner: the Shop service writes the Catalog database (shops and
listings), Product images and Listing events; the Search indexer the Search index; Payments the
Payments database and Order events; the Order recorder the Orders database; the Cart service the
Cart store. Every other link into a store reads. In all: the user, two actions and seventeen
tiles, and 23 links (the user's two lines, seven lane entries, four of them upload, and fourteen
connections), four of which are asynchronous (publication and consumption of listing and
paid-order events); the workers' store writes are solid. Every service is TypeScript on Docker; the study has no C1 people or
relationships and no package. The Search index, the Orders database and Product images, which both
lanes reach, sit in the shared band, one row: Product images right after the Image CDN and the
Shop service, the Search index right above the Search indexer that writes it, and the Orders
database right after the Order recorder ([Layout](#layout-and-navigation)). Every one of its 5,184
entry and link orders, laid out with real ELK, crosses at least once; this entry order crosses
once, where the Storefront API's read passes the Orders service's (36 bends), and Payments' link
to Order events before its Payments database draws the shortest lines (6,912px in all, the longest
the Orders service's read, 896px). The Shop service's link order doesn't change the drawing.

| Part | Content |
| --- | --- |
| Tiles | Orders service, Storefront API, Shop service and Cart service (microservices, public); Identity (OpenID Connect); Payments (Billing, Stripe, public: Stripe calls its webhook); Search indexer and Order recorder (workers, scaled on queue lag); Image CDN (Cloudflare, origin Product images, image resizing on request); Product images (Cloudflare R2, public through the CDN); Search index (OpenSearch); Catalog database (PostgreSQL, partitioned by `shop_id`), Payments database and Orders database (PostgreSQL); Listing events and Order events (topics); Cart store (Redis, a cart expires a week after its last change, no eviction). |
| Modules | Orders service: order reader. Storefront API: listing search. Shop service: listing writer, photo uploader and listing publisher (outbox in the catalog database). Search indexer: listing consumer and index writer. Payments: cart pricer, Stripe checkout (one Checkout Session per order, the order as its transfer group), webhook handler, seller payouts (Stripe Connect onboarding and transfers), payment records and order publisher (outbox in the payments database). Order recorder: paid-order consumer and order writer. Cart service: cart store client. |

Design decisions, where the sources leave a choice:

- **Browsing and selling are separate services**, as TinyURL's redirect and create are: the Shop
  service is the catalog's only writer, and the Storefront API reads the search index.
- **Checkout is Payments' job.** With Stripe Checkout the payment page is Stripe's, so Payments
  prices the cart from the catalog and opens one session for the order. The designs' separate
  checkout service also reserves stock and arranges shipping and emails, which are left out here.
  Sellers set up their payouts through Payments too.
- **Orders are recorded once paid, by one writer.** The payment webhook publishes the order, the
  Order recorder writes it and the Orders service reads it, as TinyURL's analytics worker and
  Stats API do. Links can't form a loop, so nothing runs back from Payments to an earlier tile.
- **Stripe holds the sellers' balances**, which ByteByteGo's payment system keeps in a wallet and
  a ledger.
- **No line to Identity**: the services verify its signed tokens themselves.
- **Left out** for the developer to add: stock reservation (the designs disagree: an inventory
  service, a catalog field, or none), shipping (each seller ships their own orders), order emails,
  a gateway in front of the services (every design has one, but on the lane canvas it would be a
  lane's only entry and hide which services the buyer and the seller reach), recommendations, ads
  and currencies.

**Where Etsy differs.** Etsy runs a largely PHP monolith on sharded MySQL (High Scalability), not
microservices, and it pre-generated fixed image sizes in batches.

**Added to the canvas for this study** (the extension ladder in the
[design-polish plan](plans/design-polish/units.md#rules-for-the-studies-dp08-dp09)):

- A CDN setting, **Image resizing** (`imageResizing`: unspecified, `disabled` or `on-request`;
  [studio settings](studio-settings.md#resources-and-integrations)). A product grid needs every
  photo at several sizes; the existing options could only say so in a purpose. Template: the CDN
  product's own image resizing, configured (Cloudflare Images transformations, or AWS's Dynamic
  Image Transformation stack in front of CloudFront).
- Four entries per lane (per action) instead of three (`laneLimits.entriesPerLane`). Buy & sell
  reaches four separate services: sign in, sell, keep a cart and pay. A gateway would bring it
  back to one entry but hide them.

**On Cloudflare.** Most of the design moves to Cloudflare with settings alone: each service's
Execution **Managed**, Host **Cloudflare Workers**; the Catalog, Payments and Orders databases as
SQLite on **Cloudflare D1**; the topics on **Cloudflare Queues**; the Cart store on **Upstash**;
Product images already on R2 behind the Cloudflare CDN. The Search index stays an OpenSearch (or
Meilisearch) service.

The study stores no layout. Its blueprint has two actions, seven entries, eight services, nine
resources, no externals, fourteen connections (each link into a store marked `write` or `read`) and all sixteen
components, with nothing omitted and no findings.

## The YouTube study

`studio-youtube@2.2.0` ([factory](../jeeves/packages/spec/src/studio-examples/youtube.ts)) is a
video-sharing site with YouTube's core functionality, designed as clean microservices rather than
copied from YouTube. Version 2 follows Alex Xu's "Design YouTube" (ByteByteGo), mapped to Jeeves
tiles and templates, after the owner's review of 1.2 (the
[human feedback](HUMAN_FEEDBACK.md#2026-11-06--youtube-v2-search-feed-upload-forks-layout-xus-design)).
Version 2.2 leaves the kind out of names the tile's kind label shows: Metadata (a database), Hot
metadata (a cache), Videos (a search index), Video delivery (a CDN). Its core flows, and the tiles
that carry them:

- A creator publishes a video: the Upload service (an **Uploads** service, its transfer **signed
  URLs**) starts a multipart upload in Original videos and signs a URL for each part; the
  creator's app sends the parts with those URLs and can resume, and the Upload service completes
  the upload and queues an upload job carrying the title and description. A user reaches storage
  only through a service: the signed URLs only change where the bytes travel.
- The video is transcoded: the Transcoder takes each job from Upload jobs, reads the original,
  encodes it at several resolutions and bitrates in segments of a few seconds, writes the
  segments, HLS playlists and thumbnails to Transcoded videos, and announces the playable video on
  Completion events.
- The video is recorded and indexed: the Completion handler records it in Metadata (a database),
  and the Search indexer adds it to Videos (the search index), each from the same completion event.
- A viewer watches: the Watch API gives the player the video's details (from its own cache, Hot metadata,
  or a database replica on a miss, filling the cache), playlist and view count; Video delivery (the CDN) serves
  the playlists and segments from Transcoded videos, and the player picks each segment's bitrate
  (adaptive bitrate streaming). Thumbnails come through the same CDN, resized on request.
- Views are counted: the Watch API publishes each view the player reports to View events; the
  View counter sums them per video and adds them to View counts in batches.
- A viewer finds videos: the Search API reads Videos.
- Creators and viewers sign in through Identity (OpenID Connect).

Comments, likes, recommendations, subscriptions, monetisation and live streaming are left out:
the plan keeps them out unless every source treats them as core, and none does (Grokking counts
comments, Grokking and the crash course likes; HelloInterview leaves all of them out).

Sources:

- ByteByteGo (Alex Xu), [Design YouTube](https://bytebytego.com/courses/system-design-interview/design-youtube)
- HelloInterview, [YouTube](https://www.hellointerview.com/learn/system-design/problem-breakdowns/youtube)
- DesignGurus (Grokking), [Designing YouTube or Netflix](https://www.designgurus.io/course-play/grokking-the-system-design-interview/doc/designing-youtube-or-netflix)
- DesignGurus, System Design Interview Crash Course, [Design YouTube](https://www.designgurus.io/course-play/system-design-interview-crash-course/doc/design-youtube)
- Vitess, [History](https://vitess.io/docs/overview/history/) (it came from YouTube's MySQL)
- AWS, [Uploading large objects to Amazon S3 using multipart upload and transfer acceleration](https://aws.amazon.com/blogs/compute/uploading-large-objects-to-amazon-s3-using-multipart-upload-and-transfer-acceleration/)
  and [Uploading and copying objects using multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [tus](https://tus.io/) and [tusd](https://tus.github.io/tusd/), the resumable-upload protocol and
  its server (the Uploads kind's other transfer)
- AWS, [ElastiCache caching strategies](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html)
  (lazy loading and write-through)
- Martin Kleppmann, [why dual writes are a bad idea](https://www.confluent.io/blog/using-logs-to-build-a-solid-data-infrastructure-or-why-dual-writes-are-a-bad-idea/)
  (each store fed as its own consumer of one log)
- Reddit, [View counting at Reddit](https://www.redditinc.com/blog/view-counting-at-reddit/)
- Cloudflare, [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and the
  [CDN's service-specific terms](https://www.cloudflare.com/service-specific-terms-application-services/)

The [design playbook](design-playbook.md) has the patterns this study is built from (uploads
through a service, the media pipeline with a completion handler, search fed by events, who writes
a cache, counting from events, a CDN pulling from storage, one writer per store).

What the sources agree on: originals go to object storage in parts that can resume, and
ByteByteGo, HelloInterview and the crash course send them straight from the client with
pre-signed URLs (AWS's pattern: the backend starts the multipart upload, signs a URL per part and
completes it). Processing is asynchronous behind a queue and encodes several resolutions and
bitrates; ByteByteGo, HelloInterview and the crash course split it into segments with HLS or DASH
playlists that a CDN serves while the player picks the bitrate. Grokking and ByteByteGo make
thumbnails in the pipeline. Xu reports the result through a completion queue to a completion
handler that updates the metadata database and cache, which the API servers read. HelloInterview
adds an LRU metadata cache partitioned by video ID. Grokking and the crash course keep metadata in
MySQL sharded by video ID with replicas for reads. The crash course has a separate search service
over an index filled when a video becomes playable, and keeps view counts in their own store,
eventually consistent. HelloInterview leaves search and view counts out; ByteByteGo doesn't design
them.

It is laid out in lanes from the user, through its two actions, **Watch** and **Publish**:

```text
DOWNLOAD (reads)
  User → Watch   ⇣ Watch API → Hot metadata                         (its own: fills on a miss)
                             → Metadata, View counts                (reads)
                             ⇢ View events ⇢ View counter → View counts   (the only writer)
                 ⇣ Search API → Videos                              (reads)
                 ⇣ Video delivery → Transcoded videos               (reads; resizes thumbnails)
UPLOAD (writes)
  User → Publish ⇡ Identity                                         (sign-in)
                 ⇡ Upload service ⇢ Upload jobs ⇢ Transcoder → Original videos     (reads)
                                                             → Transcoded videos   (the only writer)
                                                             ⇢ Completion events
                                                                 ⇢ Completion handler → Metadata
                                                                 ⇢ Search indexer → Videos
                                  → Original videos                 (signed URLs; the only writer)
```

Each store has one writer, its owner: the Upload service writes Original videos and Upload jobs;
the Transcoder writes Transcoded videos and Completion events; the Completion handler writes
Metadata; the Search indexer writes Videos; the Watch API writes its Hot metadata and View
events; the View counter writes View counts. Every other link into a store reads.
In all: the user, two actions and eighteen tiles, and 25 links (the user's two lines, five lane
entries, two of them upload, and eighteen connections), seven of which are asynchronous (the
publish and consume links for views, jobs and completion events). Worker store reads and writes,
including Transcoder → Original videos, are solid directed requests. Every service is
TypeScript on Docker; the study has no C1 people or relationships and no package. The Watch API
has four links out, the most a tile can have; the Transcoder three. Transcoded videos,
Metadata and Videos, which both lanes reach, sit in the shared band, one row; Hot metadata, the
Watch API's own cache, sits in the download band. The stores sit beside their
users ([Layout](#layout-and-navigation)): Original videos right after the Upload service, beside
Upload jobs; Transcoded videos right after Video delivery; Hot metadata, View counts and View
events right after the Watch API. The Transcoder's read and write and the View counter's write come
back to them one column. Metadata and Videos sit one column before their
writers (the Completion handler, the Search indexer), so the Watch API's and the Search API's
reads still cross the board to them. Half of its 6,912 entry and link orders, laid out with real
ELK, leave a bend shorter than the grid; every other one crosses at least once, and this one
crosses once (the Watch API's read of Metadata passing the Search API's), with 54
bends and the shortest lines (8,864px in all, the longest the Search API's read, 1,056px). The
Upload service's link to Upload jobs comes before Original videos.

| Part | Content |
| --- | --- |
| Tiles | Watch API and Search API (microservices, public); Upload service (Uploads, public, transfer signed URLs); Identity (OpenID Connect); View counter, Transcoder, Completion handler and Search indexer (workers, scaled on queue lag; the Transcoder takes one job at a time per replica, up to 50); Video delivery (a CDN: Cloudflare, origin Transcoded videos, image resizing on request); Transcoded videos (Cloudflare R2, public through the CDN) and Original videos (Cloudflare R2, private); Hot metadata (a cache: Redis-compatible cluster, an hour's TTL, least recently used evicted first); Videos (a search index: OpenSearch); Metadata and View counts (databases: MySQL, partitioned by `video_id`, with read replicas); View events (a topic, 12 partitions, a day's retention), Upload jobs (a work queue, a week's retention) and Completion events (a topic, 6 partitions, a week's retention). |
| Modules | Watch API: details cache (cache-aside, an hour, single-flight), details reader (from a replica), view count reader, view publisher (batched). View counter: view consumer, view summer, count writer. Search API: video search. Upload service: creator check (Identity's token), multipart uploads (start, sign each part, list the parts that arrived, complete), job publisher. Transcoder: job consumer, segmenter and encoder (ffmpeg; Xu's task DAG), packager (HLS playlists), thumbnailer, completion publisher. Completion handler: completion consumer, video writer. Search indexer: completion consumer, index writer. |

**Xu's boxes**, and what each became:

| Xu | Here | Why |
| --- | --- | --- |
| Client uploads to original storage with a pre-signed URL | Publish ⇡ Upload service (Uploads, transfer signed URLs) → Original videos | A user never reaches a store; a service checks the request first, and the signed URL only changes where the bytes travel (owner, 2026-11-06). |
| API servers | Watch API, Search API, Upload service | One service per responsibility a reader should see. |
| API servers update metadata while the upload runs | The title and description ride in the upload job and the completion event | One writer per store: the Completion handler writes the record once. |
| Load balancer | none | A service's replicas imply it; no gateway either, since it would be each action's only entry and hide which services a viewer and a creator reach. |
| Original storage, transcoding servers, transcoded storage | Original videos, Transcoder, Transcoded videos | The same. Xu's preprocessor, DAG scheduler, resource manager, task workers and temporary storage are the Transcoder's modules. |
| Completion queue, completion handler | Completion events (a topic), Completion handler | A topic, so the Search indexer consumes the same events. |
| Completion handler updates the metadata cache | The Watch API owns Hot metadata (cache-aside) | A video's record is written once and never edited, so a write-through cache would never refill a video it evicted; a reader filling a cache another tile writes would be a second writer. |
| CDN, transcoded files pushed to it | Video delivery pulling from Transcoded videos | The CDN's origin is the store the pipeline wrote; the pipeline never writes the CDN. |
| The client is told the upload finished | not drawn | No line runs to the user; the creator's app asks the Watch API. |
| (not in Xu) | Search API, Search indexer, Videos; View events, View counter, View counts; Identity | The crash course's search and view counts; sign-in. |

Design decisions, where the sources leave a choice:

- **One writer per store.** Xu writes a video's metadata twice: the API servers while the upload
  runs, the completion handler when it finishes. Here the Upload service puts the title and
  description in the upload job, the Transcoder copies them into the completion event, and the
  Completion handler writes the record once, when the video can be played. The Upload service
  keeps no database: the multipart upload is the upload's state, and resuming asks storage which
  parts arrived.
- **The Transcoder writes only its own output**, and announces each video on Completion events. The
  Completion handler (the record) and the Search indexer (the index) are sibling consumers of that
  topic, so no worker writes a store for another concern. The event carries what both need, so the
  indexer reads no database; for a moment search can find a video whose record isn't written yet.
- **The Watch API owns Hot metadata, its cache** (see Xu's boxes): it reads the cache, reads a replica
  on a miss and fills the cache for an hour.
- **Views are summed before they are written**, so a popular video's count is not written on
  every view (the reason the crash course reaches for a wide-column store).
- **Thumbnails are stored once**, at full size, beside the segments, and Video delivery resizes
  them on request (the CDN's Image resizing).
- **Cloudflare R2 behind the Cloudflare CDN.** R2 charges no egress, and ByteByteGo names CDN
  traffic the largest cost. Cloudflare's terms want video on its CDN served through a paid
  product such as its developer platform, of which R2 is part. Amazon S3 and CloudFront are the
  other choice in the same fields.
- **MySQL with a partition key** for the metadata (Grokking, the crash course; YouTube built
  Vitess to shard its MySQL).
- **No line to Identity**: the Upload service checks Identity's signed token itself. Identity is
  Publish's entry because creators must sign in to upload; viewers sign in through the same
  service.
- **Left out** for the developer to add: editing a video after upload (it would reach the record
  as an event the Completion handler consumes, and the Watch API's cache would need it too),
  custom thumbnails and telling the creator the video is ready.

**Where YouTube differs.** YouTube is far larger (its own pipeline stages, recommendations, ads)
and grew from one MySQL database to replicas, then to shards behind Vitess, which it built.

**Added to the canvas for this study: the Uploads kind** (ladder step 2), a Service kind like
Identity or Billing with TypeScript or Go and a required **Transfer**: signed URLs to storage (the
default; a generated service with the storage SDK's multipart calls) or through the service with
tus (a ready-made tus server: tusd or `@tus/server`). A setting on every microservice (step 3)
would have shown on services that take no uploads. No setting, cap or lane rule was added: the
Watch API's four links are within the cap of four, and three entries per action within four.

The study stores no layout. Its blueprint has two actions, five entries, eight services, ten
resources, no externals, eighteen connections (each link into a store marked `write` or `read`)
and all twenty components, with nothing omitted and no findings.

## Limits

- The fan and the module menu are drawn at screen size beside tiles drawn at the board's zoom,
  while the tabs, the `+` and the X scale with the board. With both rails open (TinyURL fits at
  0.56 at 1440×900, 0.45 at 1280×800) the tabs are about 22px or 18px, a container's `+` about
  16px or 13px (the Detailed fits are smaller still: about 8–9px for YouTube), tile names are small,
  and the link fan's panel (about 430 by 380px) and the module menu (468px wide) cover nearby
  tiles, never their own (a tab never drops on them, so nothing is lost). Only a canvas too small
  for the panel on every side of its tile lets it cover part of that tile. Closing a rail or
  zooming in helps; a fitted camera refits by itself.
- A menu or fan stays where it opened: the wheel and a resize close it rather than move it.
- A tall design fits small. The fit leaves 28% of the design's size free on each side, so the
  marketplace study (seventeen tiles, 1,472px tall) fits at 0.37 at 1440×900 and 0.32 at
  1280×800, and YouTube (1,376px) at 0.39 and 0.35. At those zooms the action words (about 9px)
  and the bands read, but tile names are about 5px and need the wheel to read.
- The lane bands cost height. A band's rows hold only its own tiles, so a column the shared band
  leaves empty stays empty between the lanes (YouTube: the space between Video delivery and
  Identity, beside Transcoded videos). A store with several users goes where its band doesn't grow
  ([Layout](#layout-and-navigation)), which keeps the shared band one row tall in the studies.
- A store read at the start of one lane and written at the end of the other still has one long
  line. It sits no more than one column before its writer, so the reader's line crosses the
  columns between: YouTube's Search API → Videos (1,056px) and Watch API → Metadata
  (1,024px, past View events and the View counter), the marketplace's Orders service → Orders
  database (896px) and Storefront API → Search index (800px). Right after the reader instead, the
  writer's line would come back just as far.
- Lines that come back are routed one at a time, in order, each the best it can be with the ones
  before it. Between two bands there is one free row (they are 32px apart), so when two lines come
  back across the same band gap the second goes round: YouTube's Search indexer's write goes up
  past the Completion handler and over the Search index to come down into it. A line that comes
  back to a store in its own tile's column (TinyURL's Analytics worker into the Analytics store
  above it, the marketplace's Search indexer into the Search index) hooks round the store's corner.
- A line that comes back still wraps intervening tiles and can resemble a frame at fitted zoom:
  YouTube's View counter → View counts, the Transcoder's store read/write, and the Completion
  handler's and Search indexer's nested writes. Their solid request strokes and target arrowheads
  distinguish them from asynchronous links; selecting the worker colours its lines, and selecting
  a line shows its endpoints, label and access. The return geometry still wraps intervening tiles
  in the full overview; selection does not make that overview unambiguous.
- Which column a store with several users takes depends on how many tiles its band has per
  column, so an edit elsewhere in a band can move it, and a store that gains a link out (only a
  board outside Jeeves allows it; Jeeves stores are end tiles) goes back to the column after its
  last user.
- A notice stays at the bottom of the canvas until you dismiss it, Undo or Redo, or open another
  project; a later successful edit leaves it. A fan opened near the bottom edge after a refusal
  can sit over it.
- Adding tiles never zooms. A long chain built at 100% pans the canvas along with it, so the user
  and the first tiles can leave the view; Fit brings everything back. A Connect drag's end must
  be on screen, so linking to a tile that has left the view needs Fit (or a pan) first.
- Where two services of one lane fork to the same tiles, their lines share one bus (the
  marketplace: the Shop service and Payments into the Catalog database). A line that comes back to
  a store joins its other lines just before it (YouTube: the Transcoder's read joins the Upload
  service's write of Original videos). Lines of different lanes meet only in the last 32px before
  a shared tile. Selecting a tile colours its own lines,
  which shows who reaches what. A click on a shared stretch opens a chooser; when every stretch
  of a selected line is shared, its X sits at its middle, on the bus.
- New links get the link table's default action ("Calls", "Reads & writes"), and a new resource
  belongs to the application it was first added next to; both are changed in the inspector. The
  action is a label only: a link from a tile that doesn't own the store still says "Reads &
  writes" until renamed, though it reads.
- The inspector neither lists nor edits module links. The Detailed view draws a module's links
  to other tiles, the Cache reader's loader and Favorites' items; other links between two modules
  of one tile (the studies' "Supplies code") are kept but neither drawn nor authored. Modules connect only in the
  Detailed view, whose rows read from about 0.6 zoom. Below 0.5 zoom a dot's grab area is only as
  tall as the row pitch (about 7–12px at the Detailed fits), though 16px wide. A
  selected container's link tab sits just outside its frame, over the first 36px of the lines
  leaving its middle rows, and its red X sits on the header, over the middle of a long name
  ("Video lifecycle worker").
- In Detailed, two rows of one container that write one store come back to it as separate lines
  and can cross each other (YouTube's Packager and Thumbnailer into Transcoded videos; twice in the
  v2 field design). A row's line to a store upstream of its tile loops round the container (v2's
  Lifecycle writer and Publication outbox publisher to the Metadata database run over and under
  the Video lifecycle worker, 1,280px and 1,312px), unlike the owner's sketch, where the database
  sits after it: a store several tiles use sits beside its earlier users
  ([Layout](#layout-and-navigation)), and the worker is a later one. The same rule loops an open
  module's line a long way round.
- An unload flush is an attempt, not a durability guarantee.
- Live chat quality was measured on four models in V3-19 ([results](evals/v3-19/README.md)).
  Selecting an action sends chat no identity, so "rename this" with an action selected needs the
  lane or the name in words.
- A design stored with an entry straight into storage or an external API (YouTube 1.0.0 had one)
  loads unchanged and reports it ("Produce can't link to Original videos; an action reaches a
  service (not a worker), an API or the CDN."). Until that entry is removed (select its line and
  click its X), every other lane command on the design is refused with "Fix the lanes first."
  Removing it is saved only when that leaves no lane error, so a design with two such entries, or
  one whose entry is its tile's only way in ("would cut off"), can't be edited at all.
- A design stored with a dashed line between applications, or a line straight into a Worker, loads
  and reports it the same way; where removing that line would cut a tile off, no command can repair
  it.
- A warning's mark scales with the board: at TinyURL's both-rails fit (0.56) it is about 12px
  across. The system's inspector lists every warning at full size.
- Keeping the lanes' lines apart is checked on the three studies and the board's own test cases.
  The last step before a shared tile moves or swaps one bus at a time, so an unusual design could
  still leave two lanes' lines running together for more than 32px there. A line that comes back
  takes, when no route keeps all its rules, the one that breaks the fewest, so on a crowded board
  it can touch or run along another lane's line. A design whose links loop (only a broken stored
  one can) is laid out without bands.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).


## Experimental project export

Use **Generate project** in the canvas toolbar, then **Preview scaffold**. Explicit schema3
`generation` selects local-v2 assembly from the current saved source and the actual installed
registry. Unknown refs, invalid bindings and unsupported settings refuse export; names never select
code. Known declarations without implementations export as explicit custom gaps.
The dialog shows support findings before preview, then actual emitted consumer paths, required
custom hooks, settings, source/registry/archive/manifest hashes and strict/runtime limitations.
The full report stays in `.jeeves/report.json`. The default export is partial: reusable modules
are generated before product-specific completion. It has no runtime verification or strict
certification, and no unfinished application processes start unless Runnable processes is on.

The dialog's **Modules** list shows every module of the design, before any preview: its name,
its tile and what it generates, in the module page's words (Template with the template's name,
or Stub, Custom or Refused with the reason). Preview returns the same list. A lead with its
parts connected exports its installed template exactly as the same template selected on its tile
would, and the lead and its parts read Template. A module without a complete template exports as
a typed stub under `src/modules/<tile>/`, which throws "Not implemented" until you write it; each
stub is a required custom gap.

**Runnable processes** is an unticked checkbox in the dialog. Ticking it saves
`generation.processes: true` in the design (one revision and one Undo step; unticking or Undo
removes it), with the same `setRunnableProcesses` command chat sends. Only a design built from
modules can turn it on: a study, frozen v2 or a design with tile-level templates or a preset
refuses with "Runnable processes needs a design built from modules.", and a design with no
module-level selection with "Add a module first."; the reason shows under the checkbox and
nothing is saved. With it on, the export runs every Service, Uploads and Worker tile (and the
older Redirect, Billing and Notifications kinds) as its own Compose service, `app-<tile id>`,
including tiles with no modules: an HTTP process answers `/healthz` and its module routes, a
worker runs its loops (or stays up idle), and both are healthy once ready. One edge, `app-edge`,
publishes each public HTTP tile (a lane entry, or saved public) at `/api/<tile id>/`; internal
tiles are reached only inside the stack, and a process that is down answers 503 JSON there. A CDN
tile in front of one public object storage serves that bucket's objects at `/cdn/<cdn id>/`
through the same edge: read only, typed by extension (any other CDN serves nothing locally, and
the export says why). With the option on, each process tile's Options also show what its process
uses where no template on the tile does: **Request timeout** and **Concurrency limit** on a
Service or Uploads tile, **Concurrency** on a Worker (its stub loops run that many messages at
once). Empty, each shows the value the process runs; typing saves it on the tile (one Undo
step), and Preview lists each process's settings with their origin. In an HTTP tile, each stub that consumes no queue
answers any method on `/modules/<module id>` and below, Multipart uploads, Cache reader and Search
query run their templates with a generated `<lead>.hooks.ts`; each answers 501 "Not implemented"
until written. Search query (`?q=&page=`) reads the mapping and document from its Index writer's
hooks file and its own `preset` and `hit`. An Auth guard connected to an Identity is the tile's
**sign-in**: with Sign-in **Required** every module route of the tile answers 401 without a valid
token; with **Optional** a request without a token is anonymous and one with an invalid token is
401. `GET /modules/<guard>/me` says who is calling, a stub's request carries its caller, and
Multipart uploads (which needs its tile's guard set to Required) takes its caller from it.
**Favorites** (which needs it Required too) keeps each signed-in account's items in its own
table at `/modules/<favorites>/items`: PUT adds one, DELETE removes it, GET checks one, and GET
of the list gives 50 a page, newest first; adding asks its generated `eligible` hook, which
answers 501 until written and reads the database of its items Data access. The
Identity then runs as Keycloak, with one realm and one browser client, and the guarded processes
verify tokens against it. When an asset lifecycle names an upload, that upload's `reserve`,
`complete` and `closed` hooks are the lifecycle's, so only its own hooks are left to write. In any tile, a stub connected to consume a queue
runs a loop on it, and the asset lifecycle, Video HLS, event counter and Index writer run their
workers with a generated `<lead>.hooks.ts` (the Index writer's holds the index's mapping, its
documents and the events that carry them; both search processes create the index at start once
the mapping is written). Two modules in one tile that consume the same topic each get their own
subscriber queue, so each receives every message. A message that reaches "Not implemented" goes
to its queue's `.failed` at once with one log line (a template's too, with no retries), and the
process stays healthy; a stub's own error is retried 5 times with backoff before `.failed`. A
process that loses its broker stops (exit 1, no restart) until `pnpm start`. Every database, cache, queue, object storage and search index a stub links to is
provisioned for its tile with that link's access, and the stub gets real clients, each checked
once at startup; a store on another provider isn't provisioned, and the stack isn't runnable.
Each module that writes a database (a Data access on a link that writes it, a Lifecycle writer,
or a stub with a write link; an Event publisher's outbox doesn't count) gets its own SQL file,
`infra/postgres/<database>/modules/<module>.sql`, a header only for you to write. `first-run`
and every `start` run it in the module's own schema, after the template tables; only its tile
may use its tables, and every tile on that database may read the views it puts in `published`
(keep the file re-runnable). Preview's **Processes** list shows the edge's paths and each CDN's
route, then each
process with its service, shape, edge path, routes and loops ("loop on <queue>"), what is
provisioned for its stubs ("Provisioned: Links database (database, read-write)") or not ("Not
provisioned: …"), each writer's file ("Product SQL: Link reader →
infra/postgres/links-db/modules/link-reader.sql"), and whether the stack is runnable;
`first-run` starts the processes only while it is. With it off, the export is exactly as
before.

Without generation selections, only exact frozen YouTube local-v1 snapshot005 (revision 3) can
export. An exact saved-source copy retains the original frozen archive provenance and bytes:
108 files / 19 experimental families, G01–G08/custom work and 25 unsupported paths. Other studies
or changed legacy designs refuse; the server never substitutes another source or older ZIP.

**Download project ZIP** reassembles and checks the preview identity, rechecks the saved source,
and verifies the actual response hash before the browser saves it. Finish any draft or history
action first. Source changes, stale canvas revisions, failed asset loading and cancelled work
refuse; close/switch disposes pending work. The dialog footer keeps both mouse actions reachable
at 1280×800. Nothing changes the design, revision, history, layout, camera or preferences.
Extract into a new directory and follow README; secrets/data are provisioned later. ZIP details
and API/error limits are documented in the generator guide. The ZIP is for a new directory;
`pnpm --filter @jeeves/generator update:v2` regenerates into an existing export, rewriting its
generated files and keeping the application's own
([updating an existing export](../jeeves-generator/README.md#updating-an-existing-export)).

The local-v2 generator emits reusable mechanisms and the video feature. YouTube-specific
adapters, public schemas, service construction and edge composition are removed from active
generation. The retained v2 design exports generic upload/lifecycle/HLS/cache/search/count
modules with required custom gaps; the historical field application remains independently
runnable. [Corrected baseline and count](plans/reliable-foundations/youtube-v2-generic-baseline.md).
