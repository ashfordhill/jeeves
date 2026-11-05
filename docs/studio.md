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
  The selected tile shows its pull tabs ([Creating and connecting](#creating-and-connecting)).
  Modules (components) are not drawn, and C1 people, external systems and packages are not shown.

## Layout and navigation

The layout is automatic and never stored: ELK layered, left to right, on a 32px grid, with
automation-illustrator's options. Each tile sits one column right of its furthest predecessor (the
user's entries share the first column), a fork is centred on its tile, and links that meet at the
same tiles share one bus. The positions on screen are stability hints for the next layout, so forks
keep their rows and columns when the design changes, and changes animate for 200ms. The first
layout already follows these rules, so the first edit moves only what it changes. The canvas writes
no layout.

Drag the paper to pan; the wheel zooms, and zooming out stops a little below the fit. The toolbar
has **Select** (V), **Hand** (H; every drag pans, even from a tile, and nothing is selected) and
**Fit**. The canvas fits once when it opens; Fit refits, and never zooms in past 100%. TinyURL fits
at 0.78 zoom at 1440×900 with the chat rail closed (0.61 with it open), and at 0.69 at 1280×800
(0.53 open).

## Creating and connecting

Only the selected tile shows controls: tabs on its sides, for what the lane rules allow there.

- **`+`** adds or links with a request (a solid line); **`---`** with an asynchronous link (a
  dashed line).
- The right side works after the tile. The left side works before it: a new tile takes over every
  link into the tile (and its lane entry) and then links to it.
- The user has one `+` per lane on its right, marked with the download or upload icon. A project
  with no tiles opens with the user selected, so both lane tabs show.
- A side or mode with nothing to offer has no tab: databases, caches, storage and search indexes
  have no right-side tabs, and a queue has only `---`.

Pull a tab with the mouse. Past 36px a thick band stretches from under the tile to the pointer, the
rest of the board dims, and a fan of tile-type icons opens around the tab, offering only the types
the rules accept there (the name shows under the icon the pointer is on).

- **Release on an icon** to add a tile of that type. It is named after the type ("Cache", then
  "Cache 2"), docks at the next slot beside its source while the layout animates around it, and is
  selected with its Name field ready to type over. A Service added after a queue is a worker; a new
  database, cache, storage or queue belongs to the application it is added next to.
- **Release on another tile** to link to it (a merge): from the right side the tile links to it,
  from the left side it links to the tile, and from a lane tab it becomes an entry of that lane.
  Tiles the tab can link to stay bright with a dashed outline; on a tile, the fan steps back and the
  outline thickens. A dimmed tile can't be linked: releasing on it changes nothing and the notice
  says why ("Shorten API already starts the upload lane; a tile can start only one lane.").
- **Release anywhere else**, or press Escape, and the band springs back.

Each add or link is one batch and one undo step.

Every tile must hang off the user through a lane, with no cycles, links the
[link table](../CATALOG.md#lanes-and-links) allows and at most 4 links out of a tile and 3 entries
per lane; a tile starts at most one lane. An edit that breaks one of these rules is refused with a
notice and changes nothing, whether it comes from the canvas, the inspector, chat or the API.

Optional shortcuts: V selects, H pans, Escape cancels a pull. Every action works by mouse alone.

## Inspector

The inspector shows the selection. Its sections are **General**, **Options** and **Connections**;
empty ones are hidden.

- A tile: its icon, name and kind, then name and purpose, the kind's settings, provider choices and
  optional performance intent (replicas, autoscale signal, request timeout, concurrency limit;
  read replicas and partition key for databases; topology and eviction for caches; partitions for
  queues; redirect caching for the CDN). An empty input or **Unspecified** removes an optional
  value. Connections lists the tile's links; clicking one selects that line.
- A line: its two tiles, then Action, Protocol, Interaction, Access, and timeout/retry where the
  protocol allows. Switching Interaction between Request / response and Asynchronous changes the
  dash where the link table allows both.
- A lane entry (its line or chip): the lane and the tile the user reaches; each is a button that
  selects that tile.
- The user, or nothing: the system's Name and Goal.

Valid text autosaves after 500ms or on blur; selects commit at once. Selecting, switching tabs and
navigating flush pending valid edits; invalid unsent drafts are discarded. A rejected write stays
visible with Retry/Discard. A revision conflict adopts the fresh design with "Changed elsewhere;
reopen to edit."

## History

**Undo/Redo** in the header step through the server's design history. Each accepted inspector
batch or chat turn is one step; a new edit ends the redo chain. Selecting, switching tabs,
panning, zooming and Fit add none. The history survives reloads.

## Chat

Chat (left rail, open by default in a fresh project) uses the same finite command vocabulary,
validation and history as manual edits: a chat turn is one undo step. It reads the design and the
studio definitions, applies commands against the saved revision, and can ask one focused
question with clickable choices. It accepts Markdown, text and images (PNG, JPEG, WebP, SVG).
Token counts and provider-reported cost appear only when complete. The model and provider are
chosen in **Settings**. Chat and the inspector collapse and resize independently.

## The TinyURL study

The single study, `studio-tinyurl@2.0.0` ([factory](../packages/spec/src/studio-examples/tinyurl.ts)),
is a read-heavy, low-latency URL shortener: about 100 reads per write. It is laid out in lanes
from the user:

- **Download** (following a short link): the user enters at the CDN, which forwards misses to the
  Redirect service. Redirect reads the Link cache and the Links database, and publishes clicks
  asynchronously: Click events → Analytics worker → Analytics store.
- **Upload** (creating a link): the user enters at the Shorten API, which writes the Links
  database, counts requests in the Link cache and checks destinations with the URL reputation
  API.

The Links database and the Link cache are reached from both lanes. In all: the user and nine
tiles, and eleven links (two lane entries and nine connections), three of which are asynchronous or
follow an asynchronous link (the click path). The study has no C1 people or relationships and no
package.

| Part | Content |
| --- | --- |
| Tiles | CDN, Redirect service, Shorten API, Analytics worker, Click events (topic), Links database (PostgreSQL, two read replicas, partitioned by `short_code`), Link cache (Redis cluster, LRU), Analytics store (ClickHouse) and the URL reputation API. |
| Modules | Shorten API: rate limiter (token bucket, 100/min per API key, Redis), reputation check (external call with a circuit breaker), ID generator (range allocation in blocks of 1,000, base62, at least 7 characters) and link writer. Redirect service: link cache reader (cache-aside, in-process L1 plus Redis, negative caching, single-flight), replica link reader, redirect responder (302, 60-second edge max-age) and batched click publisher. Analytics worker: click consumer (batches of 1,000, bounded retries), custom aggregation and aggregate writer. |

The CDN caches redirects briefly, the Redirect service scales on requests per second and clicks
leave the request path through the queue. A 302 rather than a 301 keeps every click reaching
analytics once the edge entry expires. The study stores no layout. Its
[blueprint](studio-blueprint.md#example) has both entries, three services, five resources, one
external, nine connections and all eleven components, with nothing omitted and no findings.

## Limits

- Tiles and lines are not removed by mouse yet; chat removes them (`removeTile`, `removeLink`).
- The fan and the tabs are drawn at the board's zoom and screen size: at low zoom the tabs are small
  and the fan can cover nearby tiles. A tile under a fan icon is linked by entering it where no icon
  covers it (or after zooming in).
- Modules (components) are neither drawn nor listed in the inspector yet; chat and the blueprint
  carry them.
- Where two services fork to the same tiles, their lines share one bus. In TinyURL, Redirect
  service and Shorten API both reach Link cache and Links database, so the lines alone don't show
  which of them reaches Click events; selecting a line does.
- An unload flush is an attempt, not a durability guarantee.
- Live chat quality has not been evaluated.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).
