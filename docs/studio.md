# The studio

The studio is the **Design** tab: the lane canvas of one project, a chat rail on the left and an
inspector on the right. Everything in it is design intent. Nothing is provisioned, deployed or
generated; a future code generator reads the [blueprint](studio-blueprint.md). Field values are
listed in [studio settings](studio-settings.md).

## Projects

The project menu (top right) lists recent projects and opens **New project**, the project browser
(search, rename, delete) and rename. New project offers:

- **Architecture study**: a copy of the [TinyURL study](#the-tinyurl-study). A fresh installation
  starts with one.
- **Blank architecture**: an empty design.

The last opened project reopens on the next visit; its ID is in the URL.

## The lane canvas

There is one canvas, with no levels. It starts from the **user** (the actor, a stick figure), who is
always there and is not stored. The user starts two **lanes**: **download** (following, viewing,
consuming; drawn above) and **upload** (creating, posting; drawn below). Every tile hangs off a
lane, with no islands and no cycles.

- **Tiles** are 128×128: the kind's icon in its family colour and the name in up to two lines.
  Database, cache, queue and storage tiles are pills; services, APIs and externals are rounded
  rectangles. The user tile is 128×160.
- **Lines** carry no words. A solid line is a request; a dashed line is an asynchronous link, and so
  is every link that continues after one. A lane's entry line carries a download or upload chip.
  Action, protocol and the rest are in the inspector.
- Click a tile, a line or a chip to select it and open the inspector; click empty paper to clear.
  The selected tile shows its pull tabs ([Creating and connecting](#creating-and-connecting)) and
  a red X, and its own lines (in and out) turn the selection blue, drawn over the rest, so you can
  see which tiles it reaches where lines share a bus. A selected line is drawn on top, thicker, in
  the same blue, with a red X ([Removing](#removing)).
  Modules (components) are not drawn; they are listed in their tile's inspector
  ([Inspector](#inspector)). C1 people, external systems and packages are not shown.

## Layout and navigation

The layout is automatic and never stored: ELK layered, left to right, with automation-illustrator's
options, then put on the 32px grid. Each tile sits one column right of its furthest predecessor (the
user's entries share the first column, download entries above upload entries), a fork is centred on its tile as nearly as the
grid allows, and links that meet at the same tiles share one bus. The positions on screen are
stability hints for the next layout, so forks keep their rows and columns when the design changes,
and changes animate for 200ms. The first layout already follows these rules, so the first edit
moves only what it changes. The canvas writes no layout.

On the grid (`alignLayout` in `packages/board`, run on every ELK result):

- Every port sits on a grid line, and the paper's dots mark the grid's crossings. A tile's top-left
  corner sits on a dot; the user, 160px tall, has its centre on a grid line instead.
- A line whose ends ELK left within 16px of each other is straight. ELK centres a merge between
  its predecessors, which would leave small jogs; in TinyURL the Shorten service's line into the
  URL database (a merge) is straight, as are the user's line into the Redirect service and the
  click path after it.
- Other lines bend by whole grid steps, so no bend is shorter than 32px. A merge exactly between
  two equally distant tiles takes the nearer grid line, so its two lines bend by different
  amounts (Blank with two services that both link to one database: 96px and 64px).
- Tiles in one column keep their order with at least 32px between them; a tile that moves down
  pushes the tiles below it.
- A line keeps ELK's bus columns. A line that passes a column keeps the row ELK gave it there.

Drag the paper to pan; the wheel zooms, and zooming out stops a little below the fit. The toolbar
has **Select** (V), **Hand** (H; every drag pans, even from a tile, and nothing is selected) and
**Fit**. The canvas fits when it opens; Fit refits, and never zooms in past 100%. The camera
follows the canvas:

- While the camera is fitted (since the canvas opened, or since Fit), it refits at once whenever
  the canvas changes size: a rail opens or closes (selecting opens the inspector), a rail is
  resized, or the window is.
- Once you pan or zoom, the camera is yours: rails opening and closing leave it alone until you
  click Fit.
- A new tile that lands outside the view is brought in: the canvas pans just enough to show it,
  with room for its tabs, at the same zoom. Attaches and chat edits don't move the camera.

TinyURL fits at these zooms, which the canvas takes by itself as the rails open and close:

| Window | Both rails closed | Chat open | Inspector open | Both open |
| --- | --- | --- | --- | --- |
| 1440×900 | 0.93 | 0.73 | 0.72 | 0.52 |
| 1280×800 | 0.83 | 0.63 | 0.62 | 0.42 |

## Creating and connecting

Only the selected tile shows controls: tabs on its sides, for what the lane rules allow there, and
the red X on its top edge ([Removing](#removing)). There are two kinds of tab:

- **`+`** creates a new tile. The right `+` adds one after the tile. The left `+` inserts one
  before it: the new tile takes over every link into the tile (and its lane entry) and then links
  to it. A side has a `+` when at least one tile type fits there, so databases, caches, storage
  and search indexes have no right `+`.
- **The link tab** (a chain-link icon) attaches the tile to a tile already on the canvas, in either
  direction. It sits on the right, below the `+`, or alone where there is no `+`, and shows
  whenever the tile can attach to at least one other tile.
- The user has, for each lane, a `+` (a new tile that starts the lane) and a link tab (an existing
  tile starts the lane), each marked with the download or upload icon. A project with no tiles
  opens with the user selected, so its two `+` tabs show.

Every new link takes its pair's default mode from the [link table](../CATALOG.md#lanes-and-links):
asynchronous (a dashed line) to and from a queue, a request (a solid line) otherwise. Where the
table allows both, the line inspector's Interaction field switches it.

Pull a tab with the mouse. Past 36px a thick band stretches from under the tile to the pointer,
and the pull stays open until you let go.

- **A `+`** opens a fan of all seven tile types around the tab, always in the same order and the
  same places. The name shows under the icon the pointer is on. A type the rules refuse on that
  side is greyed, and its name adds why ("A queue can't link to URL database. A queue feeds only
  an application, not a database."). The fan stays on the canvas, at least 16px inside its edges,
  so it never covers a rail or the header; near an edge its icons line up along it, sometimes right
  beside the tab. **Release on an icon** to add a tile of that type. It is named after the type
  ("Cache", then "Cache 2"), docks at the next slot beside its source while the layout animates
  around it, and is selected with its Name field ready to type over (the canvas pans to it if it
  landed out of view). A Service added after a queue is a worker; a new database, cache, storage
  or queue belongs to the application it is added next to. A `+` never links to existing tiles:
  the board doesn't dim, and releasing on a greyed icon or on a tile changes nothing.
- **A link tab** opens no fan. The board dims, and the tiles it can attach to stay bright with a
  dashed outline, which thickens on the one under the pointer. **Release on one** to link the two:
  from the selected tile to it when the rules allow that, else from it to the selected tile.
  Attaching Analytics store to Redirect service makes Redirect service → Analytics store, since a
  store links onward to nothing. From one of the user's link tabs, the tile becomes an entry of
  that lane. The tile you pulled from stays selected, so its next fork or merge starts at once. A
  dimmed tile can't be attached: releasing on it changes nothing, and the notice says why
  ("Redirect service already starts the download lane; a tile has one entry."). Nothing attaches onto the user; a
  lane starts only from the user's own tabs.
- **Release anywhere else**, or press Escape, and the band springs back.

Each add or attach is one batch and one undo step.

Every tile must hang off the user through a lane, with no cycles, links the
[link table](../CATALOG.md#lanes-and-links) allows and at most 4 links out of a tile and 3 entries
per lane; a tile has one entry at most. An edit that breaks one of these rules is refused with
a notice and changes nothing, whether it comes from the canvas, the inspector, chat or the API.

Optional shortcuts: V selects, H pans, Escape cancels a pull. Every action works by mouse alone.

## Removing

The selected tile has a red **X** centred on its top edge (faint until the pointer is on it); the
user has none. The X removes the tile and links each tile before it to each tile after it, wherever
the [link table](../CATALOG.md#lanes-and-links) allows, unless the first already reaches the
second another way. A restitched link is asynchronous when either link it replaces was, and a lane
entry passes on in its lane. Removing Click events in TinyURL links the Redirect service to the
Analytics worker directly, asynchronously.

When the restitching can't reach some tiles (a resource doesn't link onward, so nothing replaces
the links through it), a panel opens at the bottom centre of the canvas instead. It lists the tiles
that would be cut off, with their icons, and marks them, and the tile itself, with a red dashed
ring on the board. **Remove N tiles** removes them all; **Cancel**, Escape, clicking empty paper or selecting
anything else changes nothing. Removing the Redirect service in TinyURL takes the URL cache, Click
events and the Analytics worker with it ("Remove 4 tiles"), since a lane can't start at a cache or
a queue. The URL database stays: the Shorten service still writes it.

A selected line has a red X on a stretch of it that no other line shares, or at its middle when
every stretch is shared (an entry line's sits above its chip). It removes that
connection or entry, unless a tile would be cut off; then nothing changes and the notice names
the tiles ("Removing the link from Redirect service to Click events would cut off Click events and
Analytics worker.").

After removing a tile, the tile before it is selected (the first one, in lane order; often the
user); after removing a line, nothing is. The modules, module links and settings that named what
went are removed with it; a database, cache, storage or queue whose owner went belongs to the
first application that still links to it. Each removal is one batch and one undo step.

Optional shortcuts: Delete or Backspace does what the selected tile's or line's X does.

## Inspector

The inspector shows the selection. Its sections are **General**, **Options**, **Connections** and,
for an application tile, **Modules**; empty ones are hidden.

- A tile: its icon, name and kind, then the **Type** list when its tile type has more than one
  kind: each kind's icon and name in two columns, the current one filled yellow (Service:
  Microservice, Worker service, Redirect, Identity, Notifications, Billing; API: Gateway or CDN;
  Database: Database or Search index). The pointer on a kind shows its one-line description.
  Clicking another switches the tile to it. The tile keeps its name, purpose, links and modules;
  its settings start over from the new kind's defaults, which are preconfigured: Billing starts
  with Stripe, Notifications with Resend, Identity with OpenID Connect, Gateway with Traefik and
  CDN with Cloudflare (the other choices stay selectable). A kind the lane rules refuse is faded
  and its tooltip says why ("Shorten service can't become a worker. A lane starts at a service
  (not a worker), …"; "Link reader in Redirect service can't use a search index; remove its link
  to URL database first.").
- A store (database, search index, cache, storage) shows, below the Type list, who writes it and
  who reads it: **Writes (owner)** names its owner, its only writer; **Reads** names every other
  tile that links to it. Changing the **Owner** field changes who writes
  ([one writer per store](studio-settings.md#relationships)).
- **Language** offers the kind's two languages, its default first: TypeScript or Go, and Go or
  TypeScript for Redirect. Gateway and CDN are products, not code, and have no Language
  ([studio settings](studio-settings.md#languages)).
- A provider chosen on a kind is that service's integration: Billing with Stripe needs no
  External tile for Stripe. Add an External tile only for a third party no kind covers.
- General, Options and Connections: name and purpose, the kind's settings, provider choices and
  optional performance intent (replicas, autoscale signal, request timeout, concurrency limit;
  read replicas and partition key for databases; topology and eviction for caches; partitions for
  queues; redirect caching for the CDN). An empty input or **Unspecified** removes an optional
  value. Connections lists the tile's links, a link into a store marked "Writes (owner)" or
  "Reads"; clicking one selects that line.
- **Modules** (services and the gateway, not the CDN or resources): the tile's modules, each with
  its kind's icon and its name. The dashed **`+`** below opens the ten module kinds as icons
  (names in the tooltips); picking one adds a module named after its kind ("Data access", then
  "Data access 2") with that kind's defaults, opens it and selects its name for renaming.
- A module: a way back to its tile (the arrow and the tile's name), its icon, name and kind, the
  typical product, its readiness ("A cache reader needs a cache connection."), then General (name,
  purpose and **Remove module**), Options (its settings) and Connections: its links (a link
  through a connection selects that line, a link to another module opens it; **Unlink** removes
  it) and **Link to**, the tiles its tile links to whose kind it may use, through that link (an
  event publisher reaches a queue only through a publish link, a consumer only through a consume
  link).
- A line: its two tiles, "Writes (owner)" or "Reads" for a link into a store, then Action,
  Protocol, Interaction, Security, and timeout/retry where the protocol allows. Switching Interaction between Request / response and Asynchronous changes the
  dash where the link table allows both.
- A lane entry (its line or chip): its lane, then the **lane row**: download and upload as icons
  (the name is the tooltip), the current one filled yellow. Clicking the other moves the entry to
  that lane; when that lane already has 3 entries it is faded and its tooltip says why ("The
  download lane already has 3 entries; the most is 3."). Below, the user and the tile the user
  reaches, each a button that selects it.
- The user, or nothing: the system's Name and Goal.

Valid text autosaves after 500ms or on blur; selects commit at once. Selecting, switching tabs and
navigating flush pending valid edits; invalid unsent drafts are discarded. A rejected write stays
visible with Retry/Discard. A revision conflict adopts the fresh design with "Changed elsewhere;
reopen to edit."

## History

**Undo/Redo** in the header step through the server's design history. Each accepted inspector
batch (an autosaved edit, a kind or lane switch, adding, linking, unlinking or removing a module) or chat
turn is one step; a new edit ends the redo chain. Selecting, switching tabs, opening a module,
panning, zooming and Fit add none. The history survives reloads.

## Chat

Chat (left rail, open by default in a fresh project) edits the design with the canvas's own
commands, validation and history: a chat turn is one undo step, however many commands it ran.
Tiles and links change only through the lane commands: `addTile` (after a tile or a lane, or
before a tile), `linkTiles`, `removeTile`, `removeLink`, `changeKind` and `setEntryLane` (moves
an entry to the other lane). A new link's mode is optional: left out, it is the pair's default
from the [link table](../CATALOG.md#lanes-and-links) (async for queue links, sync otherwise),
and the instructions' copy of that table is generated from it. So chat, like the mouse,
can't leave a tile off the lanes, close a loop, link a resource onward or break a cap. A refused
command changes nothing and comes back in the same plain words as the canvas notice ("URL cache
can't link to Shorten service. A cache can't link onward."); the turn's activity list shows
it. Names, purposes, the goal, settings, link details and modules go through `edit`,
`editSystem`, `editConnection` and the module commands.

Chat reads the design as the canvas draws it: both lanes with their entries and tiles
in lane order, then each tile with its kind, settings, links (sync or async; a link into a store
also says whether it writes or reads) and modules, and the caps.
It lists the seven tile types with their kinds. The selected tile, line or entry is sent with
each message, so "Add a cache after the selected service" works. It can ask one focused question
with clickable choices, and accepts Markdown, text and images (PNG, JPEG, WebP, SVG). An empty
project starts with an `addTile` from a lane that names the system. Token counts and
provider-reported cost appear only when complete. The model and provider are chosen in
**Settings**. Chat and the inspector collapse and resize independently.

## The TinyURL study

The single study, `studio-tinyurl@3.0.0` ([factory](../packages/spec/src/studio-examples/tinyurl.ts)),
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

It is laid out in lanes from the user:

```text
DOWNLOAD (reads)
  User ⇣ Stats API → Analytics store                     (reads)
  User ⇣ Redirect service → URL cache
                          → URL database                 (reads on a cache miss)
                          ⇢ Click events ⇢ Analytics worker → Analytics store
UPLOAD (writes)
  User ⇡ Shorten service → URL database                  (the only writer)
```

Each store has one writer, its owner: the Shorten service writes the URL database, the Redirect
service the URL cache (it fills it on a miss) and Click events, and the Analytics worker the
Analytics store. In all: the user and eight tiles, and ten links (three lane entries and seven
connections), three of which are asynchronous or follow an asynchronous link (the click path).
The Stats API's entry comes first, so it is drawn on the top row; its read of the Analytics store
then runs along the top, and the user's line into the Redirect service and the click path are
straight. The study has no C1 people or relationships and no package.

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
(`apps/web/lib/middleware/link.ts`); only its static pages get CDN cache headers. So the user
enters at the Redirect service directly. Running the redirect near users is a setting of the
Redirect service (Execution **Managed**, Host **Cloudflare Workers**), not a CDN tile.

The study stores no layout. Its [blueprint](studio-blueprint.md#example) has three entries, four
services, four resources, no externals, seven connections (each link into a store marked `write`
or `read`) and all nine components, with nothing omitted and no findings. Projects made from
earlier versions keep their own design; only new copies are v3.

## Limits

- The fan is drawn at screen size beside tiles drawn at the board's zoom, and the tabs and the X
  scale with the board. With both rails open (TinyURL fits at 0.52 at 1440×900, 0.42 at 1280×800)
  the tabs are about 21px or 17px, tile names are small, and the fan's seven icons cover nearby
  tiles (a `+` never drops on them, so nothing is lost). Near the canvas's edge the fan lines up
  in a column along it, sometimes over the tile's own tabs. Closing a rail helps; a fitted camera
  refits by itself.
- A notice stays at the bottom of the canvas until you dismiss it, Undo or Redo, or open another
  project; a later successful edit leaves it. A fan opened near the bottom edge after a refusal
  can sit over it.
- Adding tiles never zooms. A long chain built at 100% pans the canvas along with it, so the user
  and the first tiles can leave the view; Fit brings everything back.
- Where two services fork to the same tiles, their lines share one bus (TinyURL: the Redirect
  service and the Shorten service both reach the URL database). Selecting a tile colours its own lines,
  which shows who reaches what. A click on a shared stretch still selects one of the lines on it;
  when every stretch of that line is shared, its X sits at its middle, on the bus. To select or
  remove a particular one, click its row in the tile's Connections list.
- New links get the link table's default action ("Calls", "Reads & writes"), and a new resource
  belongs to the application it was first added next to; both are changed in the inspector. The
  action is a label only: a link from a tile that doesn't own the store still says "Reads &
  writes" until renamed, though it reads.
- Modules are not drawn. The inspector links a module only to tiles; a link between two modules
  of the same tile ("Supplies code") is made through chat.
- An unload flush is an attempt, not a durability guarantee.
- Live chat quality with the lane-canvas instructions has not been evaluated; only the scripted
  test model has run.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).
