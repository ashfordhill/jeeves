# The studio

The studio is the **Design** tab: a C1/C2/C3 diagram of one project, a chat rail on the left and
an inspector on the right. Everything in it is design intent. Nothing is provisioned, deployed or
generated; a future code generator reads the [blueprint](studio-blueprint.md). Field values are
listed in [studio settings](studio-settings.md).

## Projects

The project menu (top right) lists recent projects and opens **New project**, the project browser
(search, rename, delete) and rename. New project offers:

- **Architecture study**: a copy of the [TinyURL study](#the-tinyurl-study). A fresh installation
  starts with one.
- **Blank architecture**: an empty design.

The last opened project reopens on the next visit; its ID is in the URL.

## Levels

C1, C2 and C3 are three equal tabs over the same model:

- **C1** shows the system, its people and external systems.
- **C2** shows each application (service, browser app, worker and the named service kinds) and
  each resource. A **package** is an open labelled frame around its member applications and the
  resources it owns.
- **C3** shows the whole system at once. An application with components is a frame containing
  them; queues, resources and external systems sit around the frames. A component's link to an
  element follows its traced C2 connection, so C3 never contradicts C2.

Click a card, frame or line to inspect it. The selection carries across tabs (a component maps to
its application at C1/C2). There is no drill-down, breadcrumb or back. Zoom changes text density
only.

## Layout

Every view is laid out automatically: ELK layered, left to right, on a 32px grid, with frames as
compound nodes and disconnected islands packed left to right, then top to bottom. Positions are
derived, never stored. The only saved layout input is a row order per view: drag a card (or a
frame with its contents) up or down within its column past a neighbour's centre. That saves one
undoable layout action; horizontal movement is ignored.

**Fit** frames the view without saving anything. The camera is remembered per view in browser
preferences, and a remembered camera that no longer shows the diagram is refitted. Labels hide
below 45% zoom. TinyURL's C3 fits at about 0.55 zoom at 1440×900 with the chat rail closed, so
zoom in to read it.

## Creating and connecting

Every box must hang off the user through a lane, with no cycles, links the
[link table](../CATALOG.md#lanes-and-links) allows and at most 4 links out of a box and 3 entries
per lane. An edit that breaks one of these rules is refused with a notice and changes nothing,
whether it comes from the canvas, chat or the API.

- **`+` handles.** Hover or select a box: the east `+` adds a box it connects to, the west `+` a
  box that connects to it. Drag past about 36px (a dashed preview follows) and release on empty
  canvas, or just click the handle, to open a picker of the kinds valid there: people and external
  systems at C1; services, browser app, resources, CDN and external API at C2; at C3, components
  of the same application and the resources, queues and integrations it can use. The box and its
  relationship are one undoable action; the new line is selected with its form open and defaults
  filled. A queue or resource created at C3 from an application is owned by it.
- **Release on another box** to connect the two. Element and C1 pairs open **Connect** prefilled
  (with Reverse). A pair involving a component links them directly, adding the traced C2
  connection when it is missing.
- **New island** in the toolbar, and the first-box panel on an empty view, offer one unconnected
  box. At C2 and C3 the lane rules refuse it ("… can't be reached from the user; every tile hangs
  off a lane."); C1 people and external systems are not lane tiles and are still added.
- **Connection** in the toolbar: click source and target, review Action, Protocol, Interaction and
  Access, then **Connect**. Resources are reused by explicit identity, never by matching name.
- **Library** groups Services, Resources, Integrations, Presets (C2 only) and Examples, filtered to
  what the current level accepts. Previews need **Add**. Like New island, an added box or preset
  is unconnected, so the lane rules refuse it. Examples create a separate project.
- **Group as package**: select several C2 applications. The package inspector has Add/Remove
  member, Ungroup and a separately confirmed Delete members. Removing an owner requires explicit
  resource reassignment.

Optional shortcuts: V selects, H pans, Escape cancels a pull or closes the picker. Every action
works by mouse alone.

## Lines

Each ordered pair of boxes has at most one line. Relationships between the same two boxes in the
same direction merge into it, and its label shows the count (`3 calls`). Clicking a merged line
opens a chooser of the actual relationships. Opposite directions stay two lines.

A label is short: the verb phrase plus the protocol, about 24 characters (`reads links · SQL`).
Labels wider than about 96px stack the verb above the line and the protocol below. The full text
is in the inspector and the line's tooltip. In-process links inside one frame have no label.
Layout reserves room for every other label, so labels never overlap boxes. Lines stay 2px on
screen (3px selected) and leave and enter boxes horizontally.

## Inspector

The selected object shows up to three sections, **General**, **Options** and **Connections**;
empty ones are hidden.

- Elements: name and purpose, the kind's settings, provider choices and optional performance
  intent (replicas, autoscale signal, request timeout, concurrency limit; read replicas and
  partition key for databases; topology and eviction for caches; partitions for queues; redirect
  caching for the CDN). An empty input or **Unspecified** removes an optional value.
- Components: kind, host application and typical third-party product, then a readiness list
  (each link its settings need, or the gap). General holds Name, Purpose and **Remove component**
  (undoable). Connections lists its links; a traced link opens its C2 connection, where an
  external call's timeout and retries are edited.
- Connections: Action, Protocol, Interaction, Access, and timeout/retry where the protocol allows.

Valid text autosaves after 500ms or on blur; selects commit at once. Selecting, switching tabs and
navigating flush pending valid edits; invalid unsent drafts are discarded. A rejected write stays
visible with Retry/Discard. A revision conflict adopts the fresh design with "Changed elsewhere;
reopen to edit."

## History

**Undo/Redo** in the header follow one chronological stack of design edits and row-order changes.
Each accepted inspector batch, creation, connection, grouping, row move or chat turn is one step.
Selecting, switching tabs, panning, zooming and Fit add none. The server keeps design history
across reloads; local layout history resets on reload.

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

| Level | Content |
| --- | --- |
| C1 | The TinyURL system. |
| C2 | Shorten API, Redirect service, Analytics worker, CDN, Links database (PostgreSQL, two read replicas, partitioned by `short_code`), Link cache (Redis cluster, LRU), Analytics store (ClickHouse) and the URL reputation API. |
| C3 | Shorten API: rate limiter (token bucket, 100/min per API key, Redis), reputation check (external call with a circuit breaker), ID generator (range allocation in blocks of 1,000, base62, at least 7 characters) and link writer. Redirect service: link cache reader (cache-aside, in-process L1 plus Redis, negative caching, single-flight), replica link reader, redirect responder (302, 60-second edge max-age) and batched click publisher. Analytics worker: click consumer (batches of 1,000, bounded retries), custom aggregation and aggregate writer. The Click events topic is shown at C3 only. |

The CDN caches redirects briefly, the Redirect service scales on requests per second and clicks
leave the request path through the queue. A 302 rather than a 301 keeps every click reaching
analytics once the edge entry expires. The study stores no layout. Its
[blueprint](studio-blueprint.md#example) has both entries, three services, five resources, one
external, nine connections and all eleven components, with nothing omitted and no findings.

## Limits

- Library fragments and presets do not carry C3 components.
- On this canvas a box can only be added next to one the user already reaches, so a **Blank
  architecture** project cannot get its first box here; the first tile must start a lane
  (`addTile`), which the canvas does not offer yet.
- People, the C1 system and package frames have no `+` handles at C2. A spawned box takes ELK's
  row; no order hint is written.
- Remove component has no confirmation (it is undoable).
- An unload flush is an attempt, not a durability guarantee.
- Live chat quality has not been evaluated.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).
