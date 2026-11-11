# Jeeves catalog

What a design can contain. Tile/module kinds are design vocabulary. Runtime support comes only
from selected feature bindings and the actual installed registry; a kind alone claims none. Exact fields and values are in [studio settings](../docs/studio-settings.md);
the source is [`studio-definitions.ts`](packages/spec/src/studio-definitions.ts) and
[`studio-components.ts`](packages/spec/src/studio-components.ts).

## Installed features and controls

Installed templates are reached through modules: a template's lead, with its parts connected in
its tile, selects it (the [module catalog](#components-c3)); there is no feature preset to attach,
and designs that attached the video feature stay readable and exportable. Product codecs, routes,
projections and service composition remain custom work after generation. Historical YouTube declarations
remain readable; their product implementations are not installed. Useful normal settings are HTTP deadline/admission, adjustable worker concurrency, cache TTL,
SQL pool/statement limits on a bound Data access or a Lifecycle writer (Favorites' items Data
access too), and an Auth guard's Sign-in (Required or Optional). Fixed policies/providers/language and unsupported alternatives
stay out of forms. Mouse/chat share `buildSupportedAuthoringCommand`; historical declarations stay
unchanged on read. Source-schema tables below do not imply editable or executable support.
The one export option is **Runnable processes** (`generation.processes`, Generate project's
checkbox and chat's `setRunnableProcesses`): every Service, Uploads, Worker, Redirect, Billing and
Notifications tile then exports as its own process ([export](../docs/studio.md#experimental-project-export)).
While it is on, a process tile with no template that consumes them shows its process's own
limits: Request timeout and Concurrency limit on a Service, Uploads, Redirect or Billing tile, and
Concurrency on a Worker, which its stub loops run ([process settings](../docs/studio-settings.md)).
A CDN tile linked to one public object storage is then served at the edge's `/cdn/<cdn id>/`.

## C1 context

The **system** (name and description), **people** and **external systems**, with relationships
between them. The lane canvas shows only the system: its Name and Description are in the inspector
when the user or nothing is selected. People, external systems and their relationships stay in the format.

## Tile kinds (C2)

Sixteen kinds, each one immutable definition `studio-<kind>@1.0.0`.

| Kind | Name | Label | Tile type | What it is |
| --- | --- | --- | --- | --- |
| `service` | Microservice | Service | Service (default) | One independently deployed application. |
| `worker` | Worker service | Worker | Service | A background application, typically after a queue. |
| `redirect` | Redirect | Redirect | Service | A public redirect service with lookup store and cache shortcuts. |
| `identity` | Identity | Identity | Service | One service integrating an existing identity provider (starts with OIDC). |
| `notification` | Notifications | Notifications | Service | One service with email delivery intent (starts with Resend). |
| `billing` | Billing | Billing | Service | One service with a payment provider choice (starts with Stripe). |
| `uploads` | Uploads | Uploads | Service | One service taking large uploads into object storage; its transfer is signed URLs to storage (the default) or through the service with tus. |
| `gateway` | Gateway | Gateway | API (default) | An entry point routing requests to internal services (starts with Traefik). |
| `cdn` | CDN | CDN | API | Content delivery in front of an application or object store (starts with Cloudflare); can resize images on request. |
| `database` | Database | Database | Database (default) | A logical store; engine and provider are separate choices. |
| `search` | Search index | Search index | Database | A derived search index. |
| `cache` | Cache | Cache | Cache | A logical cache with an optional TTL. |
| `queue` | Message channel | Queue or Topic | Queue | One shared channel between publishers and consumers; it needs an owner. A work queue gives each message to one consumer; a topic copies it to every subscriber. |
| `object-store` | Object storage | Object storage | Storage | A byte store with access intent. |
| `external-api` | External API | External API | External | An external integration boundary, named for the provider. |
| `browser` | Browser app | Browser app | none | Browser assets, standalone or served by an application. Not offered on the lane canvas. |

**Label** is the short kind a tile shows under its name (`label`, read through `studioKindLabel`).
A message channel's is **Queue** when its `mode` is `work-queue` and **Topic** otherwise, the
generation contract's default mode.

A new database, cache, storage or queue tile is owned by the application it is added next to.

The historical source schema accepts two languages per coded kind, default first: Microservice, Worker service, Identity,
Notifications, Billing and Uploads TypeScript or Go; Redirect Go or TypeScript. Gateway and CDN are
products, not code, and have no language (`studioKindLanguages`, [studio
settings](../docs/studio-settings.md#languages)).

A provider chosen on a kind is that service's integration, not a separate tile: Billing with
Stripe needs no External tile for Stripe. **External API tiles are for third parties no kind
covers.** The chat instructions say the same.

## Tile types and the link fan

The kinds are grouped into seven tile types. A type gives its tiles their shape, and `changeKind`
(source vocabulary; the normal inspector has no kind switcher) switches only within one.
Source: [`studio-tiles.ts`](packages/spec/src/studio-tiles.ts).

| Tile type | Kinds | Tile shape |
| --- | --- | --- |
| Service | `service`, `worker`, `redirect`, `identity`, `notification`, `billing`, `uploads` | rounded rectangle |
| API | `gateway`, `cdn` | rounded rectangle |
| Database | `database`, `search` | pill |
| Cache | `cache` | pill |
| Queue | `queue` | pill |
| Storage | `object-store` | pill |
| External | `external-api` | rounded rectangle |

**The link fan** (`studioLinkFan`) is what a new tile can be on the lane canvas: eleven kinds, the
module authoring contract's tile fan, in four groups that are the fan's rows, always in the same
slots. A selected tile's or action's link tab offers all eleven, each with its kind's icon and
name, greyed with the reason where the link table refuses it.

| Group | Kinds |
| --- | --- |
| `application` | `service`, `worker`, `uploads`, `identity` |
| `data` | `database`, `search`, `cache`, `object-store` |
| `messaging` | `queue` |
| `edge` | `cdn`, `external-api` |

Gateway and the older `redirect`, `notification` and `billing` kinds are not offered; tiles of
those kinds keep working, and `addTile` still accepts them. `browser` belongs to no tile type: on
the lane canvas the user (the actor) is the client. A tile face shows its kind's own icon; every
kind has a distinct one.

## Lanes and links

Every lane design starts from one **actor**, the user, which is not stored. The user does at most
two things, its **actions** (`architecture.studio.actions`, each `{ lane, name }`): one in the
**download** lane (it consumes; default name **Consume**) and one in the **upload** lane (it
produces; default **Produce**), at most one per lane. `name` is the one large word on the action
tile, 1–24 characters. The user links only to its actions. An action's **entries**
(`architecture.studio.entries`, each `{ id, lane, element }`) link it to the tiles that handle it;
an entry needs its lane's action, and a tile has at most one entry. Every tile must be reachable
from the actor, with no cycles. Actions are design intent and generate no code. A stored design
whose lane has entries but no action reads with that lane's default action (`studioActions`; the
model's parse stores it, beside the `both` and language normalisation).
Which tiles may link, and how, is one table, `studioLinkRules` in
[`studio-links.ts`](packages/spec/src/studio-links.ts), exported so a later blueprint version can
publish it. Its rows are by source role and target role: **user** (the actor), **action** (a lane
action; its links are its entries), **application** (the Service and API kinds except `cdn`),
**CDN**, **external API**, **queue** and **store** (`database`, `search`, `cache`,
`object-store`). Each row has its allowed modes, its
default mode and the connection a new link gets; a pair with no row is refused. A sync link is a
direct call where the caller waits (solid line); an async link does not wait (dashed line). The
canvas legend says dashed means through a queue or topic: every study's async link is a queue
link. Application → application, application → external API and external API → application still
allow async, a direct call drawn dashed with no channel. Style follows each relationship, so a
worker's store request remains solid after a queue. Target arrowheads mean caller → target for
requests, including reads, and publisher → channel → consumer for messaging. The connection's
interaction follows the mode (Request / response or Asynchronous); its security is Private network.

| Source → target | Modes | Default | Connection |
| --- | --- | --- | --- |
| user → action | sync | sync | none (the user's line to its action) |
| action → `service`, `redirect`, `identity`, `notification`, `billing`, `uploads`, `gateway` | sync | sync | an entry |
| action → `cdn` | sync | sync | an entry |
| application → application | sync, async | sync | calls, "Calls", HTTP |
| application → `external-api` | sync, async | sync | calls, "Calls", HTTP |
| application → `queue` | async | async | depends-on, "Publishes", Messaging, `channelUse: publish` |
| application → `database` | sync | sync | uses-database, "Reads & writes", SQL |
| application → `cache` | sync | sync | uses-database, "Reads & writes", Redis |
| application → `object-store`, `search` | sync | sync | depends-on, "Uses", HTTP |
| application → `cdn` | sync | sync | depends-on, "Uses", HTTP |
| `queue` → application | async | async | depends-on, "Consumes", Messaging, `channelUse: consume` |
| `external-api` → application | sync, async | sync | calls, "Calls", HTTP |
| `cdn` → application | sync | sync | calls, "Calls", HTTP |
| `cdn` → `object-store` | sync | sync | depends-on, "Uses", HTTP |

So the user reaches a store or a third party only through a service; stores are end tiles (no row
has a store as its source); a queue sits between applications; a CDN fronts an application or
object storage; `browser` has no role and takes no links. A design stored with an entry into
storage or an external API (YouTube 1.0.0's upload entry into Original videos) loads unchanged
and reports it as a finding ("Produce can't link to Original videos; an action reaches a service
(not a worker), an API or the CDN."); no command adds one, and until that entry is removed
(`removeLink`, which a design broken only by refused links accepts) every other lane command is
refused. That removal is saved only when it leaves no lane error: a design with two such entries,
or one whose entry is its tile's only way in (removing it would cut the tile off), takes no edit
at all (an open owner question).

**One writer per store.** A link into a store (database, search index, cache, object storage)
writes when it comes from the store's owner and reads otherwise (`studioStoreAccess(design,
connection)`: `"write" | "read"`, or `undefined` for a link that doesn't end at a store). It is
derived from the owner, never stored; changing source ownership changes who writes. Full source
diagnostics retain the legacy owner. Chat `getDesign` and the blueprint retain each link's `access`.
Owning package members also count as writers. The model cannot distinguish an owner's
individual read from a write; the saved action label does not change this inference. Queue links
keep publish and consume. The
entry kinds (`studioEntryKinds`) are the action rows' targets. A link given without a mode takes its
pair's default: async for queue links, sync otherwise (`studioDefaultLinkMode`;
`studioLinkDefaults(source, target, mode?)`). `studioLinkRefusal` gives the reason a pair or mode
is refused, in plain words ("A cache can't link onward.", "Publishing to a queue is asynchronous,
not a request."). Existing link modes remain preserved source intent; normal line authoring edits only the label.

The table records design intent only. No template-support state is kept: a future code generator
will mark the tiles and links it has no template for (a badge and a blueprint finding) and never
refuse them, keeping design intent and template availability apart.

Caps (`laneLimits`): at most 5 outgoing links per tile and 4 entries per lane (per action), and a
tile has at most one entry. The entry cap was raised from 3 for the marketplace study, whose
upload lane has sign-in, the seller's shop, payments and the cart; the link cap from 4 for
YouTube v3's Watch API, which also verifies optional sign-in (owner approval, 2026-11-11). A broken rule is a
`LANE_INVALID` finding (`laneFindings`). Validation includes
these, so any batch that leaves a broken lane rule is rejected, from the canvas, chat or the API.
C1 people, external systems and relationships are not tiles and are not checked.

**Lane bands** (`laneBands(graph)` in [`studio-lanes.ts`](packages/spec/src/studio-lanes.ts)):
a tile only the Consume action reaches is in the `download` band, one only Produce reaches in
`upload`, and one both reach in `shared`; an action is in its own lane's band, a line in its
source's, and the user in none. The canvas stacks them in `laneBandOrder` (download, shared,
upload) and keeps lines of different bands apart except in the last 32px before a shared tile;
it puts each store beside the tiles that use it, a later user's line coming back to it
([studio guide](../docs/studio.md#layout-and-navigation)). Bands and store placement are layout only:
they add no rule, finding or blueprint field.

**Design warnings** ([`studio-warnings.ts`](packages/spec/src/studio-warnings.ts)) are designs
that look wrong but are allowed, because a design is built step by step. `studioWarnings(design)`
returns `{ rule, node, message }` (the node is the tile's ID or the action's `laneActionNode`);
validation includes them as `DESIGN_WARNING` findings (category `warning`, severity `warning`),
which `applyOperations`, the lane commands and their "Fix the lanes first." gate (`laneFindings`)
never look at, so no warning refuses an edit:

| Rule | When | Example message |
| --- | --- | --- |
| `store-without-writer` | A store has no owner, or no link into it comes from its owner | "URL database has no writer: its owner Shorten service doesn't link to it. Link Shorten service to it, or choose another owner." |
| `output-unread` | A store (not a cache) whose only links come from its owner, a worker | "Nothing reads Analytics store: only its owner Analytics worker links to it. Link the service or API that reads it." |
| `queue-without-publisher` | No link into a queue | "Click events has no publisher: nothing sends it messages. Link the service that publishes them to it." |
| `queue-without-consumer` | No link out of a queue | "Link events has no consumer: nothing takes its messages. Add a worker after it." |
| `action-without-entries` | An action with no entries | "Watch has no entries: nothing handles it yet. Add the service or API that handles it after it, or remove the action." |
| `uploads-without-storage` | Uploads has no outgoing link to object storage | "Uploads has no storage relationship: link the durable storage used for uploads." |
| `worker-without-output` | A worker has no outgoing relationship of any kind | "Worker has no outgoing relationship: no output, publication or downstream call is represented." |

`studioWarningSummaries` describes each in a few words and `studioWarningSentence` is the chat
instructions' sentence, generated from them. The canvas marks a warned tile or action and lists
warnings in the inspector ([studio guide](../docs/studio.md#warnings)); chat's `getDesign` and each
accepted command return `warnings` beside `findings`; the blueprint's `findings` include them. The
three studies have none.

Lane commands ([`studio-lane-commands.ts`](packages/spec/src/studio-lane-commands.ts)) edit a
design that keeps these rules, and refuse in plain words with tile and action names ("URL cache
can't link to Geo lookup. A cache can't link onward."):

| Command | What it does |
| --- | --- |
| `addAction` | Adds a lane's action (`lane`, optional `name`, default Consume or Produce); refused when the lane has one ("This design already has a Produce action; each lane has one."). `system` starts a new project's system. |
| `renameAction` | Renames a lane's action (`lane`, `name`). |
| `removeAction` | Removes a lane's action and its entries, unless that cuts off a tile ("Removing Shorten would cut off Shorten service."). |
| `addTile` | A new tile of `tile.kind` after a tile or after a lane's action (an entry; always a request; the action is added with its default name if the lane has none). `side` is always `after`: nothing is inserted before a tile. `link` (the mode) is optional and defaults to the pair's. A new database, cache, storage or queue is owned by the application it is added next to. |
| `linkTiles` | Links a lane's action or a tile to a tile already on the board (a merge, or a new entry), in `link` mode or the pair's default. From a lane with no action it is refused; onto a tile that already has an entry, in either lane, too ("Redirect service already starts the download lane; a tile has one entry."). |
| `removeTile` | Removes a tile and links every predecessor to every successor the table allows (restitched entries stay with the action). Tiles that would be cut off must be listed in `alsoRemove`. Their modules, links and the settings that named them go too; a resource whose owner went passes to the first application that still links to it. |
| `removeLink` | Removes a connection or an entry, unless that cuts off a tile. |
| `changeKind` | Switches to another kind of the same tile type with that kind's default settings, unless a link, an entry or a module's link would no longer fit. |
| `setEntryLane` | Moves an entry to the other lane's action (`download` or `upload`), unless that lane has no action or its action already has 4 entries. |

Pure helpers answer what a tile can do, for the canvas and chat:

- `laneActionOptions(design)` returns the user's two actions, download then upload, each with its
  default name, or the refusal when the design already has it.
- `linkFanOptions(design, from)` returns the link fan's eleven kinds in their slots for a new tile
  after a tile or a lane's action (only a Microservice, Uploads, Identity or a CDN fits there):
  each `{ kind, group }`, with `refusal`, the plain-words reason `addTile` would give, where the
  rules refuse it ("Click events can't link to a search index. A queue feeds only an application,
  not a search index."). A create links with the pair's default mode.
- `connectOptions(design, node)` is Connect mode's: every other node on the board (the user, the
  actions, then the tiles, in lane order), each with the `linkTiles` a link from `node` to it
  would run in the pair's default mode, or why not. The link always runs from `node`; a refused
  direction is never reversed ("URL database can't link to Analytics worker. A database can't
  link onward."). From an action (`laneActionNode(lane)`) a link is an entry. Nothing links onto
  the user or an action, and the user links only to its actions.

On the canvas ([studio guide](../docs/studio.md#creating-and-connecting)), the user's one `+` shows
`laneActionOptions` (a pick runs `addAction`), and a tile or action has its link tab when
`linkFanOptions` allows at least one kind, and its fan shows all eleven, greyed with the refusal
where there is one; a pick runs `addTile` with that kind. In Connect mode a drag from a node may end on the tiles
`connectOptions` gives a link for, and a release there runs its `linkTiles`. Both leave out
`link`, so the pair's default mode applies. A
tile's X runs `removeTile` (after `planRemoveTile`, with the tiles the confirmation listed as
`alsoRemove`), an action's X runs `removeAction` and a line's X (a selected line's, or in Connect
mode a hovered one's) runs `removeLink` ([removing](../docs/studio.md#removing)); the user's line
to an action has no X. The inspector's
normal authoring omits kind replacement; an action's Name runs `renameAction`
and an entry's lane row runs `setEntryLane` (a lane either would refuse is disabled, with the
reason as its tooltip). A new tile is named after its kind and
numbered when taken ("Worker service 2", ID `worker-service-2`); a new link's ID is `source-target`, or
`lane-target` for an entry. Chat sends the same commands, and these are the only commands that
add or remove tiles and links ([studio guide](../docs/studio.md#chat)). IDs follow names: `edit`
with a new name re-keys a tile ID that still has its creation form or its old name's slug to the
new name's slug, with its following modules and every reference, in one batch (a `rekey`
operation per ID); a clash refuses, and studies, designs with tile-level templates or a preset and
other IDs keep theirs ([names and IDs](../docs/studio.md#inspector)). Link IDs never change.

A **package** groups two or more independent applications; it has no language, provider or
runtime. Packages stay in the format, but neither the canvas nor chat shows, creates or changes
them.

## Components (C3)

Components live inside one application and reach other boxes only through an existing C2
connection. In the studio they are the **modules** of an application tile: listed in its
inspector and drawn as rows in the Detailed view ([studio guide](../docs/studio.md#inspector)),
added with the module `+` inside the tile or in its inspector
([adding a module](../docs/studio.md#adding-a-module)) and
connected from a row's dot in Connect mode ([connect mode](../docs/studio.md#connect-mode)).
A module is the unit of generated code ([module authoring contract](../docs/plans/module-authoring/contract.md)):
each kind is a template's **lead**, a **part** of templates, or a **stub**. Icons:
`studioComponentVisuals` in [`studio-modules.ts`](packages/spec/src/studio-modules.ts); hosts,
slots and generation: `studioComponentDefinitions` in
[`studio-components.ts`](packages/spec/src/studio-components.ts).

| Kind | Name | Icon | Hosts | Slots: target · use | Generation |
| --- | --- | --- | --- | --- | --- |
| `rate-limiter` | Rate limiter | `shield` | any | store: Cache · read & write | Stub |
| `cache-reader` | Cache reader | `bolt` | any | cache: Cache · read & write; loader: a Data access in its tile | Lead of `positive-cache-read` |
| `id-generator` | ID generator | `repeat` | any | store: Database or Cache · read & write | Stub |
| `redirect-responder` | Redirect responder | `route` | any | none: can't connect | Stub |
| `event-publisher` | Event publisher | `plug-connected` | any | channel: Queue · publish; outbox: Database · write | Part of `owned-multipart`, `asset-lifecycle`, `video-hls` |
| `event-consumer` | Event consumer | `plug` | any | channel: Queue · consume | Part of `asset-lifecycle`, `video-hls`, `event-counter`, `search-projection` |
| `data-access` | Data access | `database` | any | database: Database · read & write | Part of `owned-multipart`, `positive-cache-read`, `event-counter`, `favorites` |
| `auth-guard` | Auth guard | `lock` | any | identity: Identity or External API · verify | Lead of `verified-identity` (Service, Uploads) |
| `external-call` | External call | `world` | any | target: External API, an application or Identity · request | Stub |
| `custom` | Custom | `puzzle` | any | uses: any tile, many | Stub |
| `multipart-uploads` | Multipart uploads | `cloud-upload` | Uploads, Service | objects: Object storage · read & write | Lead of `owned-multipart` |
| `lifecycle-writer` | Lifecycle writer | `progress-check` | Worker | state: Database · read & write | Lead of `asset-lifecycle` |
| `video-encoder` | Video encoder | `movie` | Worker | originals: Object storage · read | Lead of `video-hls` |
| `video-packager` | Video packager | `stack-2` | Worker | outputs: Object storage · write | Part of `video-hls` |
| `video-thumbnailer` | Video thumbnailer | `photo` | Worker | outputs: Object storage · write | Part of `video-hls` |
| `event-counter` | Event counter | `sum` | Worker | none: can't connect | Lead of `event-counter` |
| `index-writer` | Index writer | `list-search` | Worker | index: Search index · write | Lead of `search-projection`; hooks `mapping`, `document`, `event` |
| `search-query` | Search query | `search` | Service | index: Search index · read | Lead of `search-query` (needs an Index writer on its index); hooks `preset`, `hit` |
| `favorites` | Favorites | `star` | Service | state: Database · read & write; items: a Data access in its tile (optional) | Lead of `favorites` |

- **Hosts:** "any" is a Service, Worker or Uploads tile, and existing Redirect, Notifications
  and Billing tiles. Identity, Gateway and Browser tiles take no new modules (`moduleKinds`); older
  source keeps the browser-safe kinds it has.
- **Slots:** a slot is one use of a tile through the host's link, and its arrow follows that link.
  Every slot takes one connection except Custom's. The publisher's outbox is needed for jobs and
  publication, not for results. The Cache reader's **loader** and Favorites' **items** are the
  in-process slots.
  `moduleSlots` lists a module's slots and the links that fill them; `moduleLinkSlot` gives the slot
  a link fills.
- **Generation:** a template is selected only by its lead, once every needed part in its tile is
  connected. Any other module is generated as a typed stub (`module-stub@0.1.0`), including a part
  outside a complete template. The ten older kinds keep their targets, typical products
  (`thirdParty`) and `requires` reasons.
- **Sign-in:** an Auth guard connected to an Identity leads `verified-identity@0.1.0` (Template ·
  Sign-in), with **Sign-in** Required or Optional (`signIn`, absent = Required); connected to an
  External API, or in a Worker, it stays a stub. A tile holds one. Multipart uploads needs its
  tile's guard set to Required: it binds the guard's Identity and is a Stub ("Needs an Auth guard
  set to Required in Upload API.") until then; the guard is no longer one of its parts. A guard a
  tile-level upload template binds (frozen v2, the presets) stays that template's.
- **Favorites:** generic, for any product's items (videos, listings). Connected to its own
  database (`state`) beside its tile's Auth guard set to Required, it leads `favorites@0.1.0`
  (Template · Favorites); its optional **items** are a Data access in the same tile, whose database
  the product's `eligible` hook reads. Until then it is a Stub that says what it needs ("Needs an
  Auth guard set to Required in Account API."; "Needs Item reader, its items, connected to a
  database."). Its bounds are fixed in `favorites-policy`: item IDs of 1–200 characters of
  `A-Za-z0-9._:-`, 1,000 favorites per account, 50 to a page. It has no settings; its own pool
  runs fixed at 10 connections and 2000 ms, and its items Data access shows Pool size and
  Statement timeout.
- **Search:** generic, for any product's documents. The Index writer (fed by an Event consumer
  in its Worker, from an outbox a template writes) and the Search query on the same index are
  mounted on hooks files: the writer's holds the index's mapping, its documents and the events
  that carry them, and the query reads those and adds its own preset and each hit's answer. Both
  processes create and check the index at start once the mapping is written. No template code
  names a product.
- **Consumers of one topic:** with Runnable processes on, two or more modules in one tile that
  consume the same topic (stub Event consumers, say) each get their own subscriber queue, so each
  receives every message; one alone uses the tile's.

Module commands, in [`studio-operations.ts`](packages/spec/src/studio-operations.ts), are shared
by the mouse and chat through `buildSupportedAuthoringCommand`:

| Command | What it does |
| --- | --- |
| `addModule` | A module of `kind` in `host`, named after its kind and numbered when taken ("Data access 2", ID `shorten-data-access-2`), unless `id`, `name` and `description` are given; a given name with no `id` gives the ID `<host>-<slug(name)>`. `editComponent` with a new name re-keys an ID that still follows to `<host>-<slug(name)>`. A kind the tile can't hold is refused ("Video encoder can't go in Watch API; it goes in a worker."). A schema-2 design is upgraded to schema 3 with an empty generation for the local runtime. |
| `connectModule` | Fills a `slot` with `target` `{tile}`, through the host's own link to it (a consume slot's runs from the queue). With no such link it adds the one the lane rules give, or is refused as `linkTiles` would be. For a Cache reader, `slot: "loader"`, and for Favorites, `slot: "items"`, target `{module}`, a Data access in the same tile. A filled slot must be disconnected first. |
| `disconnectModule` | Removes one module `link`; the tiles' link stays. |
| `removeModule` | Removes the `module` and its links. A module a tile-level binding names (v2's Creator check) can't be removed. |

Each command derives, in the same batch and one Undo step, every module's generation
([`module-generation.ts`](packages/spec/src/module-generation.ts)). This covers the selections,
the values a template fixes, initial values for its needed settings, and the ownership it needs
(roles, owners, authority, grants and access). `removeTile` and `removeLink` re-derive once
module-level selections exist. `createComponent` and `connectComponent` stay refused in normal
authoring. `disconnectComponent`, `removeComponent` and `editComponent` don't derive (except an
`editComponent` that changes an Auth guard's Sign-in, which re-derives its tile), so once
module-level selections exist normal authoring (chat) refuses the first two and names
`disconnectModule` and `removeModule`; the mouse sends only those.

The whole command is refused, naming the tiles and modules, when:

- a part has two candidates ("Upload API has two Data access modules on databases; Multipart
  uploads needs one.");
- a part already serves another template;
- a tile would hold two templates of one kind, or one both as a tile and through a module;
- the packager and the thumbnailer write different storage;
- a host would need two owners, or a derived fact contradicts a kept one.

A kept value the command may not overwrite does not refuse it: the module's status says why.

The pure helpers for the inspector, chat and Generate are:

- `planModules` reads each lead and what it still needs.
- `moduleConnectOptions(design, module)` gives every tile (and module in its tile) a dragged link
  may end on, each with the `connectModule` it would run or the refusal.
- `moduleStatuses` gives each module **Template**, **Stub** (what it still needs), **Custom** (no
  selection covers it) or **Refused** (why), and its unconnected slots.

On the canvas and in the inspector the module `+` menu offers `moduleKinds`, grouped by what each
kind can generate in that tile: **Template** for a lead, **Part of a template** for a part, but
**Stub** where the template doesn't allow the tile's kind (a Cache reader in a Worker); a pick
runs `addModule`. A
row has a dot when its kind has slots, filled when `moduleSlots` has a link; a drag from it may
end where `moduleConnectOptions` gives a command, and runs it. The X on a module's drawn line or
on an in-process link's gutter arrow (a loader, Favorites' items) runs `disconnectModule`, and the module page's Remove module runs
`removeModule`.

## Settings

Applications carry execution (Docker or managed), language, host, exposure and kind-specific
choices; resources carry engine, provider and technical options; every application and several
resources take optional performance intent (replicas, autoscaling, timeouts, concurrency,
partitions). Connections carry action, protocol, interaction, security, and timeout/retry where
applicable; a link into a store also has its derived read or write access. All of it is listed
in [studio settings](../docs/studio-settings.md).

## Provider choices

Settings name providers as intent only: they create no box, credential, deployment or API call.

| Area | Choices |
| --- | --- |
| Managed hosting | Cloudflare Workers, AWS, Google Cloud, external |
| Browser hosting | Cloudflare, AWS, Google Cloud, external |
| Payments, email, identity | Stripe; Resend, Amazon SES; OIDC; or external (Stripe, Resend and OIDC preset) |
| Gateway product | Traefik (preset), Envoy, Kong, NGINX, Amazon API Gateway, external |
| Upload transfer | signed URLs to storage (preset), through the service with tus (a ready-made tus server) |
| Databases and caches | self-hosted, AWS, Google Cloud, Neon, Supabase, Cloudflare D1, Upstash (by engine) |
| Queues, object storage, search, CDN | self-hosted, AWS, Google Cloud, Cloudflare Queues/R2, Amazon S3/CloudFront, Google Cloud Storage/CDN, external (by kind; a CDN starts with Cloudflare) |

## Chat model providers

Chat also reads the finite [reviewed pattern catalog](../docs/studio-patterns.md)
([source](packages/spec/src/studio-patterns.ts)), version 1.0.0: cache-aside lookup, durable jobs,
publication-to-search and pending-order/payment coordination. `listStudioPatterns` and
`describeStudioPattern` expose applicability, requirements, variants, failures, sources and
explicit support gaps through the actual chat tool loop. These are design references; no runtime
template or verification is available. Current kind defaults and link rules still come from
their existing catalogs, and unsupported lifecycle returns do not authorize workaround services.

The design chat uses one provider and model chosen in Settings
([`packages/providers`](packages/providers/src/catalog.ts)):

| Provider | Credentials | Tool argument constraints |
| --- | --- | --- |
| OpenAI API | `OPENAI_API_KEY` or `openai.apiKey` in `~/.jeeves/config.json` | Strict function schemas through an audited wire adapter; canonical server validation still applies. |
| Codex | its own CLI login (`codex login`); Jeeves never sees the credentials | Outer structured answer only; inner argument JSON strings are validated by the server. |

The [tool-schema guide](../docs/chat-tool-schemas.md) documents omission/null encoding, the supported
subset, history replay and explicit refusal of unaudited schema constructs. Strict arguments do
not prove architecture quality or runtime behavior; live-model evidence remains separate.

## Studies

New project offers three studies, described in the [studio guide](../docs/studio.md).

**TinyURL foundation** (`studio-tinyurl-foundation@1.0.0`, the default) is the bounded schema-v3
create/resolve design: Create and Follow actions, one Links logical owner, Create link and Resolve
link canonical API roles sharing an explicit deployable assignment, authoritative PostgreSQL and
a Links-owned Redis-compatible positive projection. Create has source read-write access for
commit/reconciliation; Resolve reads the primary and reads/fills the cache. Existing finite
Create/Resolve/cache records and the exact TinyURL profile are pinned. The verifier is null;
report: valid / complete / unavailable / none, generation ineligible. Analytics, editable targets,
disable management, reputation, quotas and custom slugs are visibly excluded; required additions
block this profile. There are no modules, additional services or runtime artifacts.
([guide](../docs/studio.md#the-tinyurl-foundation-study)).

**Extended TinyURL** (`studio-tinyurl@3.2.0`, design only) is built from published designs
(HelloInterview, System Design Primer, DesignGurus/Grokking, ByteByteGo, and Dub's open-source
redirect): a read-heavy URL shortener with separate redirect and create services, a cache in
front of one URL database that only the Shorten service writes, and click analytics through a
queue into a store read by a Stats API. No CDN tile. The user's Open link action reaches the
Stats API and the Redirect service, and its Shorten action the Shorten service: two actions,
eight tiles, twelve links (the user's two lines, three entries and seven connections) and nine
components
([guide](../docs/studio.md#the-tinyurl-study)).

**Marketplace** (`studio-marketplace@1.3.0`) is a multi-seller marketplace with Etsy's core
functionality as clean microservices (Educative, System Design Handbook, ByteByteGo's payment
system, Online Boutique, eShop, Stripe Connect, and Cloudflare's and AWS's image delivery). The
Shop service is the only writer of the catalog and its photos, and publishes listing changes that a
worker indexes for the Storefront API; an Image CDN resizes photos on request; Payments (Billing
with Stripe) prices the cart, takes one payment per order and pays each seller through Stripe
Connect, and publishes paid orders that a worker records for the Orders service; a Cart service
keeps carts in Redis; Identity signs everyone in. Two actions (Browse; Buy & sell), seventeen
tiles, 23 links (the user's two lines, seven entries, four of them upload, and fourteen
connections) and sixteen components
([guide](../docs/studio.md#the-marketplace-study)).

**YouTube** (`studio-youtube@2.2.0`) is a video-sharing site with YouTube's core functionality as
clean microservices, after Alex Xu's "Design YouTube" (ByteByteGo) mapped to templates, with
HelloInterview, DesignGurus' Grokking and crash course, AWS's multipart uploads, tus, and
Cloudflare R2. The Upload service (an Uploads service, transfer signed URLs) writes Original videos
and queues a job; a Transcoder (a worker) writes streamable segments, playlists and thumbnails to
Transcoded videos and announces each video on Completion events, which a Completion handler
records in a MySQL database (Metadata) and a Search indexer adds to a search index (Videos); a CDN
(Video delivery) serves segments and resizes thumbnails on request; a Watch API reads a video's
details through its own cache (Hot metadata) and the database, reads its view count and publishes views, which a View
counter adds in batches; a Search API reads the index; Identity signs everyone in. Two actions
(Watch; Publish), eighteen tiles, 25 links (the user's two lines, five entries and eighteen
connections) and twenty components; it added the Uploads kind
([guide](../docs/studio.md#the-youtube-study)).


`reviewStudioDesign(base, working, scope)` ([source](packages/spec/src/studio-review.ts)) is a
read-only review of staged identity changes and the existing validation/warning findings,
including their targets and whether they were introduced. `declareReviewScope` explicitly
selects up to four pattern IDs, up to eight applicable checklist IDs each, eight assumptions and
eight custom obligations. It replaces turn metadata only. `reviewDesign` reports this scope,
pattern versions and stable obligation IDs. Pattern retrieval never selects applicability.
Unsupported behavior checks are **not specified**, with no inference from prose or module names.
The final saved-state review and compact saved/unresolved result are visible in chat; full
requirements use a mouse disclosure. Two repair batches fit inside the original 16-round limit.
Neither tool changes persisted settings, contracts, blueprint versions or runtime evidence.


## Persistent behavior scope

[`design-scope.ts`](packages/spec/src/design-scope.ts) is the finite schema-v3 scope catalog:
`tinyurl-create-resolve@1.0.0` selects immutable HTTP(S) destinations, authenticated create,
public resolve and optional expiry in one public namespace. Custom slugs, destination mutation,
disable/management, reputation, quotas and exact analytics are excluded. The ten finite rows
can carry included/excluded, required/advisory intent; required incompatible behavior stays
saveable with a blocker. Up to eight targeted custom requirements are always unresolved.
Unknown exact profile references remain unresolved without substitution.

Explicit source commands and narrow chat `configureDesignScope` use
`previewDesignScope` / `buildDesignScopeCommand`. Preview then explicit upgrade preserves
schema-v2 projects; one Undo crosses the version boundary. Scope-only chat changes invalidate
review and count toward its existing two repair batches. RF04 review scope remains turn-only.
The v3 blueprint retains scope and unresolved contracts; default v2 refuses every v3-only path.
No owner/API/message contracts, deployables, runtime templates, generator or verification follow
from profile selection. See [settings](../docs/studio-settings.md#profile-and-persistent-requirements)
and [blueprint](../docs/studio-blueprint.md#contents-blueprint-3).


## Explicit logical authority and access

[`ownership.ts`](packages/spec/src/ownership.ts) adds optional schema-v3 `ownership`, independently
from legacy inferred store writers. Owners contain canonical element roles (`api`/`worker`) with
optional deployable assignment. Databases/caches/storage/search declare one authority and source
or projection classification; projections name a different declared source and remain unresolved
for population/freshness/failure. Role grants and actual store-connection requests independently
select `read`, `write` or `read-write`. Co-deployment and package membership grant nothing.

`previewOwnership` / `buildOwnershipCommand` back explicit source commands and the
narrow `configureOwnership` chat tool; preview is pure, apply is atomic/revision protected and one
Undo. Contradictory grants and foreign writes refuse; foreign reads need deliberate published-read
intent or an owned projection. Missing declarations stay saveable/unresolved. The marker does not
implement a published contract or runtime ACL. Complete removal/transfer previews preserve unrelated
custom requirements; surviving projections cannot silently lose their source.

The canvas shows canonical process tiles directly, without owner cards, role/deployable subtitles,
expansion/collapse actions or fallback narration. The existing lane layout receives the canonical
graph; view interaction changes no contracts. **Export diagram → Source & diagnostics** retains
read-only ownership/access, operations, scope and exact source JSON download; normal forms contain
only identity and useful installed settings. Diagnostic buttons retain exact owner/operation chat
selection. Removal previews and Undo still preserve declarations.
V3 retains every declaration and distinguishes legacy inference; v2 refuses every nonempty new
row with an exact path. Generic tiles supply no capability, template or runtime verification.
Exact Create/Resolve operation bindings refine these grants; other operations remain unspecified. Existing presets are unchanged.


### Finite Create link contract (NC03)

`operation-catalog.json` freezes `links-create@1.0.0` with full-definition SHA256 and separate
request/success/error schema hashes. `operation-contracts.ts` supplies exact bounded refs,
receiver/caller bindings, validation, preview and the shared mouse/chat command; these are
separate from generic kinds/modules. The inspector adds an attached named responsibility on the
same canonical API, with explicit operation selection. Several distinct operations may share an
API/edge; binding IDs are stable and separate from graph IDs. No operation follows from a label.

The fixed behavior declares verified-principal create, HTTP(S) normalization, optional expiry,
16-byte random codes with five total attempts, atomic durable success, principal/operation/key
replay for 24 hours and explicit errors under one 10-second deadline. Unknown exact refs are
retained/unresolved; known contradictions refuse. [Contract details](../docs/studio-contracts.md).
`describeOperation` retrieves this exact record; `configureOperations` previews/applies the same
bounded source declarations. Optional v3 `operations` exports completely; default v2
refuses each nonempty row. Auth verifiers/templates/runtime evidence remain unavailable. Resolve
and cache/expiry lookup policy are declared separately by NC04. No presets or owner designs are migrated.


### Finite Resolve link and positive cache (NC04)

`resolve-operation-catalog.json` and `cache-policy-catalog.json` freeze `links-resolve@1.0.0`
and `links-positive-cache@1.0.0`, with actual schema/behavior hashes. Create's NC03 identity is
unchanged. Public GET `/links/{code}` yields 307 Location or 400/404/410/503, always no-store.
Stable 410 retains expiry evidence forever; immutable codes/destinations are never reused/edited.
Primary lookup, same-owner source read and exact cache projection read-and-fill compose with
Create's durable success. Positive cache caps 300s and clamps every write to record expiry, with
50 ms cache /1000 ms primary /1200 ms total bounds, 64 actual primary calls shared per instance,
immediate overload refusal and no L1/negative/retries/HTTP response cache. These are finite
contract choices, not runtime verification. Settings/modules/CDN contradictions refuse rather
than migrate. Selected-profile namespace agreement is checked; arbitrary independent namespaces
remain legal. Unknown exact refs and incomplete declarations stay unresolved. Source commands, chat lookup/configure, preview/history and blueprint share these declarations.
No preset, saved project, provider adapter, template or backend runtime is added.

### Exact snapshot compatibility report (NC05)

`design-readiness.ts` uses full structural validation, exact profile/contract completeness and
independent whole-design coverage. The read-only **Export diagram → Source & diagnostics** report, blueprint v3 `readiness` and
`readReadiness {}` share it; initial chat context carries a compact status/count/hash summary.
`readiness-subject.ts` exposes the canonical semantic subject with all source settings, grants,
bindings, deployables and names/prose, excluding only revision/origin and external layout/UI.
`tinyurl-readiness-profile.json` pins the actual local profile definition and explicit three v1
record refs; unrelated future records cannot alter its identity. Create requires read-write
source intent/grant for retained-result lookup and writes; old write-only declarations remain
saveable with a targeted contract gap. Concrete verifier availability remains a separate gap.

`readiness-artifacts.ts` checks host-only pinned manifest/content/expected-output-receipt/evidence
inputs, never a model/user manifest. A manifest supports one exact composition; positive paths
exist only in isolated tests. Generation eligibility excludes output evidence to permit first
generation, and never implies verification. Product availability is unavailable; evidence is
none. [Report fields, hash rules and trust limits](../docs/studio-readiness.md).

NC14 checks Create's actual source dependency for synchronous SQL/native intent and an internal
service boundary; known contradictions refuse, unspecified protocol stays unresolved, and unknown
operation refs acquire no Create semantics. Source diagnostics preserve declared API/worker roles, resource access and legacy inference
without presenting them as normal generation controls. V3 exports detached
ownership rows. Trusted suite format v2 additionally pins hash-resolved executable-bundle bytes;
case names alone identify no code. Frozen operation/cache/profile records are unchanged. See the
[independent review](../docs/plans/reliable-foundations/nc14-review.md) and the separate
[future backend plan](../docs/plans/reliable-foundations/backend-first-proof-plan.md).

### Experimental local-v2 video composition

`local.video-composition` installs bound constructors for seven reusable generation templates.
Base video selects upload/lifecycle/HLS and requires custom product/service hooks. YouTube
adapters, public-video policy, service entry point and browser edge are no longer templates.
The same historical v2 design can export its reusable modules with explicit custom gaps. Normal
mouse/chat attachment offers video only; existing generic settings remain editable. Unknown refs,
invalid bindings and unsupported settings still refuse export. Exact-v1 compatibility and strict
readiness semantics remain separate.
[Corrected generation boundary and count](../docs/plans/reliable-foundations/youtube-v2-generic-baseline.md).
