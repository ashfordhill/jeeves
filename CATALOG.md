# Jeeves catalog

What a design can contain. Every entry is design vocabulary: none has a template, runtime or
verification behind it. Exact fields and values are in [studio settings](docs/studio-settings.md);
the source is [`studio-definitions.ts`](packages/spec/src/studio-definitions.ts) and
[`studio-components.ts`](packages/spec/src/studio-components.ts).

## C1 context

The **system** (name and goal), **people** and **external systems**, with relationships between
them. The lane canvas shows only the system: its name and goal are in the inspector when the user
or nothing is selected. People, external systems and their relationships stay in the format.

## Tile kinds (C2)

Sixteen kinds, each one immutable definition `studio-<kind>@1.0.0`.

| Kind | Name | Tile type | What it is |
| --- | --- | --- | --- |
| `service` | Microservice | Service (default) | One independently deployed application. |
| `worker` | Worker service | Service | A background application; the default after a queue. |
| `redirect` | Redirect | Service | A public redirect service with lookup store and cache shortcuts. |
| `identity` | Identity | Service | One service integrating an existing identity provider (starts with OIDC). |
| `notification` | Notifications | Service | One service with email delivery intent (starts with Resend). |
| `billing` | Billing | Service | One service with a payment provider choice (starts with Stripe). |
| `uploads` | Uploads | Service | One service taking large uploads into object storage; its transfer is signed URLs to storage (the default) or through the service with tus. |
| `gateway` | Gateway | API (default) | An entry point routing requests to internal services (starts with Traefik). |
| `cdn` | CDN | API | Content delivery in front of an application or object store (starts with Cloudflare); can resize images on request. |
| `database` | Database | Database (default) | A logical store; engine and provider are separate choices. |
| `search` | Search index | Database | A derived search index. |
| `cache` | Cache | Cache | A logical cache with an optional TTL. |
| `queue` | Queue or topic | Queue | One shared channel between publishers and consumers; it needs an owner. |
| `object-store` | Object storage | Storage | A byte store with access intent. |
| `external-api` | External API | External | An external integration boundary, named for the provider. |
| `browser` | Browser app | none | Browser assets, standalone or served by an application. Not offered on the lane canvas. |

A new database, cache, storage or queue tile is owned by the application it is added next to.

Each coded kind offers two languages, default first: Microservice, Worker service, Identity,
Notifications, Billing and Uploads TypeScript or Go; Redirect Go or TypeScript. Gateway and CDN are
products, not code, and have no language (`studioKindLanguages`, [studio
settings](docs/studio-settings.md#languages)).

A provider chosen on a kind is that service's integration, not a separate tile: Billing with
Stripe needs no External tile for Stripe. **External API tiles are for third parties no kind
covers.** The chat instructions say the same.

## Tile types (lane canvas)

The lane canvas groups kinds into seven tile types, offered as icons in a pulled `+` tab's fan
(always all seven; the ones the link table refuses there are greyed, with the reason). The first
kind is the default and the others are variants, switched by the Type list in the tile's
inspector (`changeKind`).
Source: [`studio-tiles.ts`](packages/spec/src/studio-tiles.ts).

| Tile type | Picker icon | Kinds (default first) | Tile shape |
| --- | --- | --- | --- |
| Service | `server` | `service`, `worker`, `redirect`, `identity`, `notification`, `billing`, `uploads` | rounded rectangle |
| API | `api` | `gateway`, `cdn` | rounded rectangle |
| Database | `database` | `database`, `search` | pill |
| Cache | `bolt` | `cache` | pill |
| Queue | `list` | `queue` | pill |
| Storage | `archive` | `object-store` | pill |
| External | `plug` | `external-api` | rounded rectangle |

A Service spawned after a queue defaults to `worker`. `browser` belongs to no tile type: on the
lane canvas the user (the actor) is the client. A tile face shows its kind's own icon; every kind
has a distinct one.

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
request (solid line); an async link does not wait (dashed line, as is every link that continues
after one). The connection's interaction follows the mode (Request / response or Asynchronous);
its security is Service identity.

| Source → target | Modes | Default | Connection |
| --- | --- | --- | --- |
| user → action | sync | sync | none (the user's line to its action) |
| action → `service`, `redirect`, `identity`, `notification`, `billing`, `uploads`, `gateway` | sync | sync | an entry |
| action → `cdn` | sync | sync | an entry |
| application → application | sync, async | sync | calls, "Calls", HTTPS |
| application → `external-api` | sync, async | sync | calls, "Calls", HTTPS |
| application → `queue` | async | async | depends-on, "Publishes", Messaging, `channelUse: publish` |
| application → `database` | sync | sync | uses-database, "Reads & writes", SQL |
| application → `cache` | sync | sync | uses-database, "Reads & writes", Redis |
| application → `object-store`, `search` | sync | sync | depends-on, "Uses", HTTPS |
| application → `cdn` | sync | sync | depends-on, "Uses", HTTPS |
| `queue` → application | async | async | depends-on, "Consumes", Messaging, `channelUse: consume` |
| `external-api` → application | sync, async | sync | calls, "Calls", HTTPS |
| `cdn` → application | sync | sync | calls, "Calls", HTTPS |
| `cdn` → `object-store` | sync | sync | depends-on, "Uses", HTTPS |

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
derived from the owner, never stored; changing the owner changes who writes. The line inspector
shows "Writes (owner)" or "Reads", the store's inspector lists its writer and readers, chat's
`getDesign` gives each such link its `access`, and the blueprint gives the connection `access`.
Queue links keep publish and consume. The
entry kinds (`studioEntryKinds`) are the action rows' targets. A link given without a mode takes its
pair's default: async for queue links, sync otherwise (`studioDefaultLinkMode`;
`studioLinkDefaults(source, target, mode?)`). `studioLinkRefusal` gives the reason a pair or mode
is refused, in plain words ("A cache can't link onward.", "Publishing to a queue is asynchronous,
not a request."). Switching an existing link's mode is the line inspector's Interaction field.

The table records design intent only. No template-support state is kept: a future code generator
will mark the tiles and links it has no template for (a badge and a blueprint finding) and never
refuse them, keeping design intent and template availability apart.

Caps (`laneLimits`): at most 4 outgoing links per tile and 4 entries per lane (per action), and a
tile has at most one entry. The entry cap was raised from 3 for the marketplace study, whose
upload lane has sign-in, the seller's shop, payments and the cart. A broken rule is a
`LANE_INVALID` finding (`laneFindings`). Validation includes
these, so any batch that leaves a broken lane rule is rejected, from the canvas, chat or the API.
C1 people, external systems and relationships are not tiles and are not checked.

**Lane bands** (`laneBands(graph)` in [`studio-lanes.ts`](packages/spec/src/studio-lanes.ts)):
a tile only the Consume action reaches is in the `download` band, one only Produce reaches in
`upload`, and one both reach in `shared`; an action is in its own lane's band, a line in its
source's, and the user in none. The canvas stacks them in `laneBandOrder` (download, shared,
upload) and keeps lines of different bands apart except in the last 32px before a shared tile;
it puts each store beside the tiles that use it, a later user's line coming back to it
([studio guide](docs/studio.md#layout-and-navigation)). Bands and store placement are layout only:
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

`studioWarningSummaries` describes each in a few words and `studioWarningSentence` is the chat
instructions' sentence, generated from them. The canvas marks a warned tile or action and lists
warnings in the inspector ([studio guide](docs/studio.md#warnings)); chat's `getDesign` and each
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
| `addTile` | A new tile after a tile, after a lane's action (an entry; always a request; the action is added with its default name if the lane has none) or before a tile. `link` (the mode) is optional and defaults to the pair's. Before moves every link into the tile, and its entry, to the new tile: a moved connection keeps its ID and mode and takes the table's defaults. A new database, cache, storage or queue is owned by the application it is added next to. |
| `linkTiles` | Links a lane's action or a tile to a tile already on the board (a merge, or a new entry), in `link` mode or the pair's default. From a lane with no action it is refused; onto a tile that already has an entry, in either lane, too ("Redirect service already starts the download lane; a tile has one entry."). |
| `removeTile` | Removes a tile and links every predecessor to every successor the table allows (restitched entries stay with the action). Tiles that would be cut off must be listed in `alsoRemove`. Their modules, links and the settings that named them go too; a resource whose owner went passes to the first application that still links to it. |
| `removeLink` | Removes a connection or an entry, unless that cuts off a tile. |
| `changeKind` | Switches to another kind of the same tile type with that kind's default settings, unless a link, an entry or a module's link would no longer fit. |
| `setEntryLane` | Moves an entry to the other lane's action (`download` or `upload`), unless that lane has no action or its action already has 4 entries. |

Pure helpers answer what a tile can do, for the canvas and chat:

- `laneActionOptions(design)` returns the user's two actions, download then upload, each with its
  default name, or the refusal when the design already has it.
- `laneOptions(design, from, side)` returns all seven tile types in `studioTileTypes` order for one
  side of a tile (`after` adds on the right, `before` inserts on the left) or a lane's action
  (only a Service or an API fits there). Each is
  `{ type, kind }`, the kind an `addTile` would add (the type's default, a worker after a queue,
  else its first kind the rules accept), or `{ type, refusal }`, the plain-words reason the type's
  preferred kind is refused ("A queue can't link to URL database. A queue feeds only an
  application, not a database."). A create links with the pair's default mode.
- `attachOptions(design, node)` is the link tool. For a tile it lists every other tile in lane
  order with the `linkTiles` an attach would make, in the pair's default mode: selected → target
  when the rules allow it, else target → selected, else the forward direction's refusal. With
  URL database selected, dropping on Analytics worker makes Analytics worker → URL database.
  For an action (`laneActionNode(lane)`) it lists every tile its lane could take as an entry, or
  why not. Nothing attaches onto the user.

On the canvas ([studio guide](docs/studio.md#creating-and-connecting)), the user's one `+` shows
`laneActionOptions` (a pick runs `addAction`), and a tile's or action's side has a `+` when
`laneOptions` has a kind for it, and its fan shows all seven types, greyed with the refusal where
there is none; a pick runs `addTile`. The link tool shows when `attachOptions` has a link, and a
drop runs that option's `linkTiles`. Both leave out `link`, so the pair's default mode applies. A
tile's X runs `removeTile` (after `planRemoveTile`, with the tiles the confirmation listed as
`alsoRemove`), an action's X runs `removeAction` and a line's X runs `removeLink`
([removing](docs/studio.md#removing)); the user's line to an action has no X. The inspector's
Type list runs `changeKind`, an action's Name runs `renameAction`
and an entry's lane row runs `setEntryLane` (a lane either would refuse is disabled, with the
reason as its tooltip). A new tile is named after its type and
numbered when taken ("Cache 2", ID `cache-2`); a new link's ID is `source-target`, or
`lane-target` for an entry. Chat sends the same commands, and these are the only commands that
add or remove tiles and links ([studio guide](docs/studio.md#chat)).

A **package** groups two or more independent applications; it has no language, provider or
runtime. Packages stay in the format, but neither the canvas nor chat shows, creates or changes
them.

## Components (C3)

Components live inside one application and reach other boxes only through an existing C2
connection. In the studio they are the **modules** of an application tile: listed in its
inspector, never drawn ([studio guide](docs/studio.md#inspector)).
Icons: `studioComponentVisuals` in [`studio-modules.ts`](packages/spec/src/studio-modules.ts).

| Kind | Name | Icon | Typical product |
| --- | --- | --- | --- |
| `rate-limiter` | Rate limiter | `shield` | Redis |
| `cache-reader` | Cache reader | `bolt` | Redis, Memcached |
| `id-generator` | ID generator | `repeat` | PostgreSQL, Redis |
| `redirect-responder` | Redirect responder | `route` | CDN |
| `event-publisher` | Event publisher | `plug-connected` | Kafka, Amazon SQS, Redis Streams |
| `event-consumer` | Event consumer | `plug` | Kafka, Amazon SQS, Redis Streams |
| `data-access` | Data access | `database` | PostgreSQL |
| `auth-guard` | Auth guard | `lock` | Identity service |
| `external-call` | External call | `world` | Any API |
| `custom` | Custom | `puzzle` | none: project-specific logic described by a one-line purpose |

Browser apps host only auth guard, external call and custom components. The inspector adds a
module with `createComponent` (`moduleKinds` lists the kinds the tile may hold; `newModuleIdentity`
names it after its kind, numbered within the tile, with an ID such as `shorten-data-access`),
links it with `connectComponent` to one of `moduleLinkChoices` (the tiles its host links to whose
kind it may use, through that link), unlinks it with `disconnectComponent` and removes it with
`removeComponent`.

## Settings

Applications carry execution (Docker or managed), language, host, exposure and kind-specific
choices; resources carry engine, provider and technical options; every application and several
resources take optional performance intent (replicas, autoscaling, timeouts, concurrency,
partitions). Connections carry action, protocol, interaction, security, and timeout/retry where
applicable; a link into a store also has its derived read or write access. All of it is listed
in [studio settings](docs/studio-settings.md).

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

The design chat uses one provider and model chosen in Settings
([`packages/providers`](packages/providers/src/catalog.ts)):

| Provider | Credentials |
| --- | --- |
| OpenAI API | `OPENAI_API_KEY` or `openai.apiKey` in `~/.jeeves/config.json` |
| Codex | its own CLI login (`codex login`); Jeeves never sees the credentials |

## Studies

New project offers three studies, described in the [studio guide](docs/studio.md).

**TinyURL** (`studio-tinyurl@3.2.0`, the default) is built from published designs
(HelloInterview, System Design Primer, DesignGurus/Grokking, ByteByteGo, and Dub's open-source
redirect): a read-heavy URL shortener with separate redirect and create services, a cache in
front of one URL database that only the Shorten service writes, and click analytics through a
queue into a store read by a Stats API. No CDN tile. The user's Open link action reaches the
Stats API and the Redirect service, and its Shorten action the Shorten service: two actions,
eight tiles, twelve links (the user's two lines, three entries and seven connections) and nine
components
([guide](docs/studio.md#the-tinyurl-study)).

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
([guide](docs/studio.md#the-marketplace-study)).

**YouTube** (`studio-youtube@2.1.0`) is a video-sharing site with YouTube's core functionality as
clean microservices, after Alex Xu's "Design YouTube" (ByteByteGo) mapped to templates, with
HelloInterview, DesignGurus' Grokking and crash course, AWS's multipart uploads, tus, and
Cloudflare R2. The Upload service (an Uploads service, transfer signed URLs) writes Original videos
and queues a job; a Transcoder (a worker) writes streamable segments, playlists and thumbnails to
Transcoded videos and announces each video on Completion events, which a Completion handler
records in a MySQL metadata database and a Search indexer adds to the Search index; a Video CDN
serves segments and resizes thumbnails on request; a Watch API reads a video's details through its
own Metadata cache and the database, reads its view count and publishes views, which a View
counter adds in batches; a Search API reads the index; Identity signs everyone in. Two actions
(Watch; Publish), eighteen tiles, 25 links (the user's two lines, five entries and eighteen
connections) and twenty components; it added the Uploads kind
([guide](docs/studio.md#the-youtube-study)).
