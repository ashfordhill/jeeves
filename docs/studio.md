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
  Modules (components) are not drawn, and C1 people, external systems and packages are not shown.

## Layout and navigation

The layout is automatic and never stored: ELK layered, left to right, on a 32px grid, with
automation-illustrator's options. A fork is centred on its tile, and links that meet at the same
tiles share one bus. The positions on screen are stability hints for the next layout, so forks keep
their rows when the design changes, and changes animate for 200ms. The canvas writes no layout.

Drag the paper to pan; the wheel zooms, and zooming out stops a little below the fit. The toolbar
has **Select** (V), **Hand** (H; every drag pans, even from a tile, and nothing is selected) and
**Fit**. The canvas fits once when it opens; Fit refits, and never zooms in past 100%. TinyURL fits
at 0.78 zoom at 1440×900 with the chat rail closed (0.61 with it open), and at 0.69 at 1280×800
(0.53 open).

## Creating and connecting

The canvas is read-only for now: tiles and lines are not added, linked or removed by mouse. Chat
edits the design through the studio commands, and the inspector edits settings.

Every tile must hang off the user through a lane, with no cycles, links the
[link table](../CATALOG.md#lanes-and-links) allows and at most 4 links out of a tile and 3 entries
per lane. An edit that breaks one of these rules is refused with a notice and changes nothing,
whether it comes from the inspector, chat or the API.

Optional shortcuts: V selects, H pans. Every action works by mouse alone.

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

**Undo/Redo** in the header follow one chronological stack of design edits. Each accepted
inspector batch or chat turn is one step. Selecting, switching tabs, panning, zooming and Fit add
none. The server keeps design history across reloads.

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

- The canvas does not add, link or remove tiles by mouse yet. A **Blank architecture** project
  shows only the user; its first tile has to come from chat (`addTile`).
- Modules (components) are neither drawn nor listed in the inspector yet; chat and the blueprint
  carry them.
- Where two services fork to the same tiles, their lines share one bus. In TinyURL, Redirect
  service and Shorten API both reach Link cache and Links database, so the lines alone don't show
  which of them reaches Click events or the URL reputation API; selecting a line does.
- An unload flush is an attempt, not a durability guarantee.
- Live chat quality has not been evaluated.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).
