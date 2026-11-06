# The studio

The studio is the **Design** tab: the lane canvas of one project, a chat rail on the left and an
inspector on the right. Everything in it is design intent. Nothing is provisioned, deployed or
generated; a future code generator reads the [blueprint](studio-blueprint.md). Field values are
listed in [studio settings](studio-settings.md).

## Projects

The project menu (top right) lists recent projects and opens **New project**, the project browser
(search, rename, delete) and rename. New project offers:

- **Architecture study**: a copy of a study, chosen in the **Study** list: the
  [TinyURL study](#the-tinyurl-study) (the default; a fresh installation starts with one), the
  [marketplace study](#the-marketplace-study) or the [YouTube study](#the-youtube-study). The
  project name follows the chosen study until you type over it.
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

- **Tiles** are 128×128: the kind's icon in its family colour and the name in up to two lines.
  Database, cache, queue and storage tiles are pills; services, APIs and externals are rounded
  rectangles. The user tile is 128×160. An **action tile** is 128×128 on the user's pastel: its
  lane icon in a round badge and its name in large type (smaller for a long name), so it reads as
  the start of a flow, not as a service.
- **Lines** carry no words. A solid line is a request; a dashed line is an asynchronous link, and so
  is every link that continues after one. The user's line to an action is a plain line; entry
  lines carry no chip, since the action tile says which lane they start. Action, protocol and the
  rest are in the inspector.
- Click a tile or a line to select it and open the inspector; click empty paper to clear.
  The selected tile shows its pull tabs ([Creating and connecting](#creating-and-connecting)) and
  a red X, and its own lines (in and out) turn the selection blue, drawn over the rest, so you can
  see which tiles it reaches where lines share a bus. A selected line is drawn on top, thicker, in
  the same blue, with a red X ([Removing](#removing)).
  Modules (components) are not drawn; they are listed in their tile's inspector
  ([Inspector](#inspector)). C1 people, external systems and packages are not shown.

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

The **lane bands** (`laneBands` in the spec decides them; `layoutBands` in `packages/board` draws
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

**Stores beside their users** (`endColumns` and `routeReturns` in `packages/board`). A store (on
the board, any tile with links in and none out) sits next to the tiles that use it, so a tile's
links to its stores are short branches, not long lines beside the pipeline it also feeds:

- A store with one user sits in the column right after it.
- A store several tiles use sits in the first column, from right after its earliest user (its
  first link in, so a download user comes before an upload one), that doesn't make its band
  taller: where the band has fewer tiles than in its tallest column. It never sits more than one
  column before its last user, and at most right after it. YouTube: Original videos sit right
  after the Upload service, beside Upload jobs, and Transcoded videos right after the Video CDN;
  View counts sit with the Metadata cache and View events right after the Watch API.
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

On the grid (`alignLayout` in `packages/board`, run on every layout):

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
| 1440×900 | 0.67 | 0.67 | 0.67 | 0.56 |
| 1280×800 | 0.59 | 0.59 | 0.59 | 0.45 |

TinyURL draws 1,024×832px and fits by height unless both rails are open. The marketplace study
(1,280×1,472px) is taller than it is wide, so it fits by height whichever rails are open: 0.37 at
1440×900 and 0.32 at 1280×800. The YouTube study (1,504×1,376px) fits by height with at most one
rail open, at 0.39 and 0.35, and by width with both open, at 0.38 and 0.30.

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
- **The user** has one `+` and no link tab. Its fan offers its two actions, **Consume** (the
  download icon) and **Produce** (the upload icon); one the design already has is greyed ("This
  design already has a Produce action; each lane has one."), and when it has both the `+` is gone.
  A picked action becomes an action tile named Consume or Produce, selected with its Name field
  ready to type over ("Watch"). A project with no tiles opens with the user selected, so its `+`
  shows.
- **An action** has a right `+` (a new tile that becomes its entry: a Service or an API; the other
  types are greyed, "An action reaches a service (not a worker), an API or the CDN.") and a link
  tab (an existing tile becomes its entry: any application or CDN with no entry yet). It has no
  left `+`: nothing goes before an action.

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
  store links onward to nothing. From an action's link tab, the tile becomes that action's entry.
  The tile you pulled from stays selected, so its next fork or merge starts at once. A dimmed tile
  can't be attached: releasing on it changes nothing, and the notice says why ("Redirect service
  already starts the download lane; a tile has one entry."). Nothing attaches onto the user or an
  action; an entry starts only from its action's own tab.
- **Release anywhere else**, or press Escape, and the band springs back.

Each add or attach is one batch and one undo step.

Every tile must hang off the user through an action, with no cycles, links the
[link table](../CATALOG.md#lanes-and-links) allows and at most 4 links out of a tile and 4 entries
per action; a tile has one entry at most, and a lane one action. An edit that breaks one of these
rules is refused with a notice and changes nothing, whether it comes from the canvas, the
inspector, chat or the API.

Optional shortcuts: V selects, H pans, Escape cancels a pull. Every action works by mouse alone.

## Removing

The selected tile has a red **X** centred on its top edge (faint until the pointer is on it); the
user has none. The X removes the tile and links each tile before it to each tile after it, wherever
the [link table](../CATALOG.md#lanes-and-links) allows, unless the first already reaches the
second another way. A restitched link is asynchronous when either link it replaces was, and a lane
entry passes on to its action. Removing Click events in TinyURL links the Redirect service to the
Analytics worker directly, asynchronously.

An action's X removes the action and its entries, unless that would cut tiles off; then nothing
changes and the notice names them ("Removing Watch would cut off API."). An action with no
entries, or whose tiles are also reached another way, goes at once, and the user is selected.

When the restitching can't reach some tiles (a resource doesn't link onward, so nothing replaces
the links through it), a panel opens at the bottom centre of the canvas instead. It lists the tiles
that would be cut off, with their icons, and marks them, and the tile itself, with a red dashed
ring on the board. **Remove N tiles** removes them all; **Cancel**, Escape, clicking empty paper or selecting
anything else changes nothing. Removing the Redirect service in TinyURL takes the URL cache, Click
events and the Analytics worker with it ("Remove 4 tiles"), since a lane can't start at a cache or
a queue. The URL database stays: the Shorten service still writes it.

A selected line has a red X on a stretch of it that no other line shares, or at its middle when
every stretch is shared. It removes that connection or entry, unless a tile would be cut off;
then nothing changes and the notice names the tiles ("Removing the link from Redirect service to
Click events would cut off Click events and Analytics worker."). The user's line to an action has
no X: it goes with the action.

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
  Microservice, Worker service, Redirect, Identity, Notifications, Billing, Uploads; API: Gateway
  or CDN; Database: Database or Search index). The pointer on a kind shows its one-line
  description.
  Clicking another switches the tile to it. The tile keeps its name, purpose, links and modules;
  its settings start over from the new kind's defaults, which are preconfigured: Billing starts
  with Stripe, Notifications with Resend, Identity with OpenID Connect, Uploads with signed URLs
  (its **Transfer**: [studio settings](studio-settings.md#uploads)), Gateway with Traefik and CDN
  with Cloudflare (the other choices stay selectable). A kind the lane rules refuse is faded
  and its tooltip says why ("Shorten service can't become a worker. An action reaches a service
  (not a worker), an API or the CDN."; "Link reader in Redirect service can't use a search index;
  remove its link to URL database first.").
- A store (database, search index, cache, storage) shows, below the Type list, who writes it and
  who reads it: **Writes (owner)** names its owner, its only writer; **Reads** names every other
  tile that links to it. Changing the **Owner** field changes who writes
  ([one writer per store](studio-settings.md#relationships)).
- **Language** offers the kind's two languages, its default first: TypeScript or Go, and Go or
  TypeScript for Redirect. Gateway and CDN are products, not code, and have no Language
  ([studio settings](studio-settings.md#languages)).
- A provider chosen on a kind is that service's integration: Billing with Stripe needs no
  External tile for Stripe. Add an External tile only for a third party no kind covers.
- General, Options and Connections: name and purpose, the kind's settings (a CDN's **Image
  resizing**: Unspecified, Disabled or On request), provider choices and
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
- An action: its lane icon and name, then **Name** (the word on its tile, at most 24 characters;
  it autosaves like a tile's name), its **Lane** (read-only) and its **Entries**, each a button
  that selects that tile.
- A lane entry (its line): its action, then the **lane row**: download and upload as icons (the
  name is the tooltip), the current one filled yellow. Clicking the other moves the entry to that
  lane's action; when that lane has no action, or its action already has 4 entries, it is faded
  and its tooltip says why ("The upload lane has no action yet; add its Produce action first.";
  "Watch already has 4 entries; the most is 4."). Below, the action and the tile it reaches, each
  a button that selects it.
- The user's line to an action: the action, and the user and the action as buttons.
- The user, or nothing: the system's Name and Goal, below the list of every
  [warning](#warnings), each with a button that selects its tile or action.

A tile or action with a warning lists it, in yellow, below its kind.

Valid text autosaves after 500ms or on blur; selects commit at once. Selecting, switching tabs and
navigating flush pending valid edits; invalid unsent drafts are discarded. A rejected write stays
visible with Retry/Discard. A revision conflict adopts the fresh design with "Changed elsewhere;
reopen to edit."

## Warnings

A **warning** is a design that looks wrong but is allowed. A design is built step by step, so a
queue with no consumer yet or a new action with no entries must be accepted while you build it.
Warnings never refuse an edit: no command, pull, attach or chat call is blocked by one, and they
are not "Fix the lanes first" problems (those are lane errors). There are four:

- **A store with no writer**: a database, search index, cache or storage with no owner, or whose
  owner doesn't link to it, for example after **Add before** the store or removing the owner's
  link ("URL database has no writer: its owner Shorten service doesn't link to it. Link Shorten
  service to it, or choose another owner.").
- **A worker's output nobody reads**: a store whose only links come from its owner, a worker
  ("Nothing reads Analytics store: only its owner Analytics worker links to it. Link the service
  or API that reads it."). A cache only its owner uses is normal and is not flagged.
- **A queue with no publisher, or no consumer** ("Link events has no consumer: nothing takes its
  messages. Add a worker after it.").
- **An action with no entries** ("Watch has no entries: nothing handles it yet. Add the service or
  API that handles it after it, or remove the action.").

On the canvas, a tile or action with a warning has a small yellow mark in its top-right corner;
the pointer on it shows the message. Its inspector lists its warnings, and the system's inspector
(click empty paper) lists them all. The mark goes as soon as the design is fixed, or with Undo.
The blueprint reports warnings as findings (`DESIGN_WARNING`, severity `warning`), and chat sees
them. The three studies have none. The rules live in `studio-warnings.ts`.

## History

**Undo/Redo** in the header step through the server's design history. Each accepted inspector
batch (an autosaved edit, an action's rename, a kind or lane switch, adding, linking, unlinking or
removing a module) or chat turn is one step; a new edit ends the redo chain. Selecting, switching tabs, opening a module,
panning, zooming and Fit add none. The history survives reloads.

## Chat

Chat (left rail, open by default in a fresh project) edits the design with the canvas's own
commands, validation and history: a chat turn is one undo step, however many commands it ran.
Actions, tiles and links change only through the lane commands: `addAction`, `renameAction` and
`removeAction` (a lane's action, by lane), `addTile` (after a tile or a lane's action, which it
adds with its default name if the lane has none, or before a tile), `linkTiles`, `removeTile`,
`removeLink`, `changeKind` and `setEntryLane` (moves an entry to the other lane's action). The
instructions say what an action is in two sentences. A new link's mode is optional: left out, it is the pair's default
from the [link table](../CATALOG.md#lanes-and-links) (async for queue links, sync otherwise),
and the instructions' copy of that table is generated from it. So chat, like the mouse,
can't leave a tile off the lanes, close a loop, link a resource onward or break a cap. A refused
command changes nothing and comes back in the same plain words as the canvas notice ("URL cache
can't link to Shorten service. A cache can't link onward."); the turn's activity list shows
it. Names, purposes, the goal, settings, link details and modules go through `edit`,
`editSystem`, `editConnection` and the module commands.

Chat reads the design as the canvas draws it: the actions, each with its lane, name, entries and
the tiles its lane reaches, then each tile in lane order with its kind, settings, links (sync or
async; a link into a store also says whether it writes or reads) and modules, and the caps.
It also sees the findings and, separately, the [warnings](#warnings), in `getDesign` and after
each accepted command; its instructions list the warnings (generated from the spec) and say to
resolve the ones its edits caused before it finishes, or say why one stays.
It lists the seven tile types with their kinds. The selected tile, line or entry is sent with
each message, so "Add a cache after the selected service" works; the user, an action and the
user's line to it have no design ID, so selecting one sends nothing. It can ask one focused
question with clickable choices, and accepts Markdown, text and images (PNG, JPEG, WebP, SVG). An
empty project starts with an `addAction` or an `addTile` from a lane that names the system. Token counts and
provider-reported cost appear only when complete. The model and provider are chosen in
**Settings**. Chat and the inspector collapse and resize independently.

## The TinyURL study

The default study, `studio-tinyurl@3.2.0` ([factory](../packages/spec/src/studio-examples/tinyurl.ts)),
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
lines to its actions, three lane entries and seven connections), three of which are asynchronous
or follow an asynchronous link (the click path). The URL database, which both lanes reach, sits in
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
(`apps/web/lib/middleware/link.ts`); only its static pages get CDN cache headers. So Open link
reaches the Redirect service directly. Running the redirect near users is a setting of the
Redirect service (Execution **Managed**, Host **Cloudflare Workers**), not a CDN tile.

The study stores no layout. Its [blueprint](studio-blueprint.md#example) has two actions, three
entries, four services, four resources, no externals, seven connections (each link into a store
marked `write` or `read`) and all nine components, with nothing omitted and no findings. Projects
made from earlier versions keep their own design (a lane with entries reads with its default
action, Consume or Produce); only new copies are v3.2.

## The marketplace study

`studio-marketplace@1.3.0` ([factory](../packages/spec/src/studio-examples/marketplace.ts)) is a
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
connections), six of which are asynchronous or follow an asynchronous link (the listing and
paid-order paths). Every service is TypeScript on Docker; the study has no C1 people or
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

`studio-youtube@2.1.0` ([factory](../packages/spec/src/studio-examples/youtube.ts)) is a
video-sharing site with YouTube's core functionality, designed as clean microservices rather than
copied from YouTube. Version 2 follows Alex Xu's "Design YouTube" (ByteByteGo), mapped to Jeeves
tiles and templates, after the owner's review of 1.2 (the
[human feedback](HUMAN_FEEDBACK.md#2026-11-06--youtube-v2-search-feed-upload-forks-layout-xus-design)).
Its core flows, and the tiles that carry them:

- A creator publishes a video: the Upload service (an **Uploads** service, its transfer **signed
  URLs**) starts a multipart upload in Original videos and signs a URL for each part; the
  creator's app sends the parts with those URLs and can resume, and the Upload service completes
  the upload and queues an upload job carrying the title and description. A user reaches storage
  only through a service: the signed URLs only change where the bytes travel.
- The video is transcoded: the Transcoder takes each job from Upload jobs, reads the original,
  encodes it at several resolutions and bitrates in segments of a few seconds, writes the
  segments, HLS playlists and thumbnails to Transcoded videos, and announces the playable video on
  Completion events.
- The video is recorded and indexed: the Completion handler records it in the Metadata database,
  and the Search indexer adds it to the Search index, each from the same completion event.
- A viewer watches: the Watch API gives the player the video's details (from its Metadata cache,
  or a database replica on a miss, filling the cache), playlist and view count; the Video CDN serves
  the playlists and segments from Transcoded videos, and the player picks each segment's bitrate
  (adaptive bitrate streaming). Thumbnails come through the same CDN, resized on request.
- Views are counted: the Watch API publishes each view the player reports to View events; the
  View counter sums them per video and adds them to View counts in batches.
- A viewer finds videos: the Search API reads the Search index.
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
  User → Watch   ⇣ Watch API → Metadata cache                       (its own: fills on a miss)
                             → Metadata database, View counts       (reads)
                             ⇢ View events ⇢ View counter → View counts   (the only writer)
                 ⇣ Search API → Search index                        (reads)
                 ⇣ Video CDN → Transcoded videos                    (reads; resizes thumbnails)
UPLOAD (writes)
  User → Publish ⇡ Identity                                         (sign-in)
                 ⇡ Upload service ⇢ Upload jobs ⇢ Transcoder → Original videos     (reads)
                                                             → Transcoded videos   (the only writer)
                                                             ⇢ Completion events
                                                                 ⇢ Completion handler → Metadata database
                                                                 ⇢ Search indexer → Search index
                                  → Original videos                 (signed URLs; the only writer)
```

Each store has one writer, its owner: the Upload service writes Original videos and Upload jobs;
the Transcoder writes Transcoded videos and Completion events; the Completion handler writes the
Metadata database; the Search indexer writes the Search index; the Watch API writes its Metadata
cache and View events; the View counter writes View counts. Every other link into a store reads.
In all: the user, two actions and eighteen tiles, and 25 links (the user's two lines, five lane
entries, two of them upload, and eighteen connections), twelve of which are asynchronous or follow
an asynchronous link (the view path, and the pipeline after Upload jobs). Every service is
TypeScript on Docker; the study has no C1 people or relationships and no package. The Watch API
has four links out, the most a tile can have; the Transcoder three. Transcoded videos, the
Metadata database and the Search index, which both lanes reach, sit in the shared band, one row;
the Metadata cache, the Watch API's own, sits in the download band. The stores sit beside their
users ([Layout](#layout-and-navigation)): Original videos right after the Upload service, beside
Upload jobs; Transcoded videos right after the Video CDN; the Metadata cache, View counts and View
events right after the Watch API. The Transcoder's read and write and the View counter's write come
back to them one column. The Metadata database and the Search index sit one column before their
writers (the Completion handler, the Search indexer), so the Watch API's and the Search API's
reads still cross the board to them. Half of its 6,912 entry and link orders, laid out with real
ELK, leave a bend shorter than the grid; every other one crosses at least once, and this one
crosses once (the Watch API's read of the Metadata database passing the Search API's), with 54
bends and the shortest lines (8,864px in all, the longest the Search API's read, 1,056px). The
Upload service's link to Upload jobs comes before Original videos.

| Part | Content |
| --- | --- |
| Tiles | Watch API and Search API (microservices, public); Upload service (Uploads, public, transfer signed URLs); Identity (OpenID Connect); View counter, Transcoder, Completion handler and Search indexer (workers, scaled on queue lag; the Transcoder takes one job at a time per replica, up to 50); Video CDN (Cloudflare, origin Transcoded videos, image resizing on request); Transcoded videos (Cloudflare R2, public through the CDN) and Original videos (Cloudflare R2, private); Metadata cache (Redis-compatible cluster, an hour's TTL, least recently used evicted first); Search index (OpenSearch); Metadata database and View counts (MySQL, partitioned by `video_id`, with read replicas); View events (a topic, 12 partitions, a day's retention), Upload jobs (a work queue, a week's retention) and Completion events (a topic, 6 partitions, a week's retention). |
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
| Completion handler updates the metadata cache | The Watch API owns the Metadata cache (cache-aside) | A video's record is written once and never edited, so a write-through cache would never refill a video it evicted; a reader filling a cache another tile writes would be a second writer. |
| CDN, transcoded files pushed to it | Video CDN pulling from Transcoded videos | The CDN's origin is the store the pipeline wrote; the pipeline never writes the CDN. |
| The client is told the upload finished | not drawn | No line runs to the user; the creator's app asks the Watch API. |
| (not in Xu) | Search API, Search indexer, Search index; View events, View counter, View counts; Identity | The crash course's search and view counts; sign-in. |

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
- **The Watch API owns the Metadata cache** (see Xu's boxes): it reads the cache, reads a replica
  on a miss and fills the cache for an hour.
- **Views are summed before they are written**, so a popular video's count is not written on
  every view (the reason the crash course reaches for a wide-column store).
- **Thumbnails are stored once**, at full size, beside the segments, and the Video CDN resizes
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

- The fan is drawn at screen size beside tiles drawn at the board's zoom, and the tabs and the X
  scale with the board. With both rails open (TinyURL fits at 0.56 at 1440×900, 0.45 at 1280×800)
  the tabs are about 22px or 18px, tile names are small, and the fan's seven icons cover nearby
  tiles (a `+` never drops on them, so nothing is lost). Near the canvas's edge the fan lines up
  in a column along it, sometimes over the tile's own tabs. Closing a rail helps; a fitted camera
  refits by itself.
- A tall design fits small. The fit leaves 28% of the design's size free on each side, so the
  marketplace study (seventeen tiles, 1,472px tall) fits at 0.37 at 1440×900 and 0.32 at
  1280×800, and YouTube (1,376px) at 0.39 and 0.35. At those zooms the action words (about 9px)
  and the bands read, but tile names are about 5px and need the wheel to read.
- The lane bands cost height. A band's rows hold only its own tiles, so a column the shared band
  leaves empty stays empty between the lanes (YouTube: the space between the Video CDN and
  Identity, beside Transcoded videos). A store with several users goes where its band doesn't grow
  ([Layout](#layout-and-navigation)), which keeps the shared band one row tall in the studies.
- A store read at the start of one lane and written at the end of the other still has one long
  line. It sits no more than one column before its writer, so the reader's line crosses the
  columns between: YouTube's Search API → Search index (1,056px) and Watch API → Metadata database
  (1,024px, past View events and the View counter), the marketplace's Orders service → Orders
  database (896px) and Storefront API → Search index (800px). Right after the reader instead, the
  writer's line would come back just as far.
- Lines that come back are routed one at a time, in order, each the best it can be with the ones
  before it. Between two bands there is one free row (they are 32px apart), so when two lines come
  back across the same band gap the second goes round: YouTube's Search indexer's write goes up
  past the Completion handler and over the Search index to come down into it. A line that comes
  back to a store in its own tile's column (TinyURL's Analytics worker into the Analytics store
  above it, the marketplace's Search indexer into the Search index) hooks round the store's corner.
- A line that comes back can read as a box. Lines have no arrowheads, and lines after a queue are
  dashed, so a dashed U round the tiles it passes looks like a group outline, at the fitted zoom
  and still at 100%: YouTube's View counter → View counts round View events and the View counter,
  the Transcoder's two lines round Upload jobs and the Transcoder, and the Completion handler's
  and the Search indexer's writes nested round the Search index. Selecting the worker colours its
  lines, which shows where the U starts and ends.
- Which column a store with several users takes depends on how many tiles its band has per
  column, so an edit elsewhere in a band can move it, and a store that gains a link out (only a
  board outside Jeeves allows it; Jeeves stores are end tiles) goes back to the column after its
  last user.
- A notice stays at the bottom of the canvas until you dismiss it, Undo or Redo, or open another
  project; a later successful edit leaves it. A fan opened near the bottom edge after a refusal
  can sit over it.
- Adding tiles never zooms. A long chain built at 100% pans the canvas along with it, so the user
  and the first tiles can leave the view; Fit brings everything back. A link tab's drop target
  must be on screen, so attaching to a tile that has left the view needs Fit (or a pan) first.
- Where two services of one lane fork to the same tiles, their lines share one bus (the
  marketplace: the Shop service and Payments into the Catalog database). A line that comes back to
  a store joins its other lines just before it (YouTube: the Transcoder's read joins the Upload
  service's write of Original videos). Lines of different lanes meet only in the last 32px before
  a shared tile. Selecting a tile colours its own lines,
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
  test model has run. Selecting an action sends chat no identity, so "rename this" with an action
  selected needs the lane or the name in words.
- A design stored with an entry straight into storage or an external API (YouTube 1.0.0 had one)
  loads unchanged and reports it ("Produce can't link to Original videos; an action reaches a
  service (not a worker), an API or the CDN."). Until that entry is removed (select its line and
  click its X), every other lane command on the design is refused with "Fix the lanes first."
  Removing it is saved only when that leaves no lane error, so a design with two such entries, or
  one whose entry is its tile's only way in ("would cut off"), can't be edited at all.
- A warning's mark scales with the board: at TinyURL's both-rails fit (0.56) it is about 12px
  across. The system's inspector lists every warning at full size.
- Keeping the lanes' lines apart is checked on the three studies and the board's own test cases.
  The last step before a shared tile moves or swaps one bus at a time, so an unusual design could
  still leave two lanes' lines running together for more than 32px there. A line that comes back
  takes, when no route keeps all its rules, the one that breaks the fewest, so on a crowded board
  it can touch or run along another lane's line. A design whose links loop (only a broken stored
  one can) is laid out without bands.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).
