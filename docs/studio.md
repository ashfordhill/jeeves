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
below 45% zoom. TinyURL's C3 fits at about 0.54 zoom at 1440×900, so zoom in to read it.

## Creating and connecting

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
- **New island** in the toolbar, and the first-box panel on an empty view, add one unconnected box.
- **Connection** in the toolbar: click source and target, review Action, Protocol, Interaction and
  Access, then **Connect**. Resources are reused by explicit identity, never by matching name.
- **Library** groups Services, Resources, Integrations, Presets (C2 only) and Examples, filtered to
  what the current level accepts. Previews need **Add**. Examples create a separate project.
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

The single study, `studio-tinyurl@1.0.0` ([factory](../packages/spec/src/studio-examples/tinyurl.ts)),
is a read-heavy, low-latency URL shortener: about 100 reads per write.

| Level | Content |
| --- | --- |
| C1 | Link creator and Visitor use the TinyURL system, which checks destinations with an external URL reputation API. |
| C2 | Web app, Shorten API, Redirect service, Analytics worker, CDN, Links database (PostgreSQL, two read replicas, partitioned by `short_code`), Link cache (Redis cluster, LRU), Analytics store (ClickHouse) and the URL reputation API. A **Link platform** package holds Shorten API and Redirect service. |
| C3 | Shorten API: rate limiter (token bucket, 100/min per API key, Redis), reputation check (external call with a circuit breaker), ID generator (range allocation in blocks of 1,000, base62, at least 7 characters) and link writer. Redirect service: link cache reader (cache-aside, in-process L1 plus Redis, negative caching, single-flight), replica link reader, redirect responder (302, 60-second edge max-age) and batched click publisher. Analytics worker: click consumer (batches of 1,000, bounded retries), custom aggregation and aggregate writer. The Click events topic is shown at C3 only. |

The CDN caches redirects briefly, the Redirect service scales on requests per second and clicks
leave the request path through the queue. A 302 rather than a 301 keeps every click reaching
analytics once the edge entry expires. The study stores no layout. Its blueprint contains every
service, resource, external, the package and all eleven components, with nothing omitted and no
findings.

## Limits

- Library fragments and presets do not carry C3 components.
- People, the C1 system and package frames have no `+` handles at C2. A spawned box takes ELK's
  row; no order hint is written.
- Remove component has no confirmation (it is undoable).
- An unload flush is an attempt, not a durability guarantee.
- Live chat quality has not been evaluated.

Background on the C1/C2/C3 vocabulary is in [C4 notes](c4-modeling.md).
