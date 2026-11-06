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

Fifteen kinds, each one immutable definition `studio-<kind>@1.0.0`.

| Kind | Name | Tile type | What it is |
| --- | --- | --- | --- |
| `service` | Microservice | Service (default) | One independently deployed application. |
| `worker` | Worker service | Service | A background application; the default after a queue. |
| `redirect` | Redirect | Service | A public redirect service with lookup store and cache shortcuts. |
| `identity` | Identity | Service | One service integrating an existing identity provider (starts with OIDC). |
| `notification` | Notifications | Service | One service with email delivery intent (starts with Resend). |
| `billing` | Billing | Service | One service with a payment provider choice (starts with Stripe). |
| `gateway` | Gateway | API (default) | An entry point routing requests to internal services (starts with Traefik). |
| `cdn` | CDN | API | Content delivery in front of an application or object store (starts with Cloudflare). |
| `database` | Database | Database (default) | A logical store; engine and provider are separate choices. |
| `search` | Search index | Database | A derived search index. |
| `cache` | Cache | Cache | A logical cache with an optional TTL. |
| `queue` | Queue or topic | Queue | One shared channel between publishers and consumers; it needs an owner. |
| `object-store` | Object storage | Storage | A byte store with access intent. |
| `external-api` | External API | External | An external integration boundary, named for the provider. |
| `browser` | Browser app | none | Browser assets, standalone or served by an application. Not offered on the lane canvas. |

A new database, cache, storage or queue tile is owned by the application it is added next to.

Each coded kind offers two languages, default first: Microservice, Worker service, Identity,
Notifications and Billing TypeScript or Go; Redirect Go or TypeScript. Gateway and CDN are
products, not code, and have no language (`studioKindLanguages`, [studio
settings](docs/studio-settings.md#languages)).

A provider chosen on a kind is that service's integration, not a separate tile: Billing with
Stripe needs no External tile for Stripe. **External API tiles are for third parties no kind
covers.** The chat instructions say the same.

## Tile types (lane canvas)

The lane canvas groups kinds into seven tile types, offered as icons in a pulled tab's fan (only
the types the link table accepts there). The first kind is the default and the others are
variants, switched by the Type list in the tile's inspector (`changeKind`).
Source: [`studio-tiles.ts`](packages/spec/src/studio-tiles.ts).

| Tile type | Picker icon | Kinds (default first) | Tile shape |
| --- | --- | --- | --- |
| Service | `server` | `service`, `worker`, `redirect`, `identity`, `notification`, `billing` | rounded rectangle |
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

Every lane design starts from one **actor**, the user, which is not stored. Its **entries**
(`architecture.studio.entries`) are links to the tiles the user reaches directly, each in the
**download** or **upload** lane. A tile has at most one entry. Every tile must be reachable from the actor, with no cycles.
Which tiles may link, and how, is one table, `studioLinkRules` in
[`studio-links.ts`](packages/spec/src/studio-links.ts), exported so a later blueprint version can
publish it. Its rows are by source role and target role: **user** (the actor's entries),
**application** (the Service and API kinds except `cdn`), **CDN**, **external API**, **queue** and
**store** (`database`, `search`, `cache`, `object-store`). Each row has its allowed modes, its
default mode and the connection a new link gets; a pair with no row is refused. A sync link is a
request (solid line); an async link does not wait (dashed line, as is every link that continues
after one). The connection's interaction follows the mode (Request / response or Asynchronous);
its security is Service identity.

| Source → target | Modes | Default | Connection |
| --- | --- | --- | --- |
| user → `service`, `redirect`, `identity`, `notification`, `billing`, `gateway` | sync | sync | an entry |
| user → `cdn` | sync | sync | an entry |
| user → `object-store` | sync | sync | an entry |
| user → `external-api` | sync | sync | an entry |
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

So stores are end tiles (no row has a store as its source); a queue sits between applications;
a CDN fronts an application or object storage; `browser` has no role and takes no links.

**One writer per store.** A link into a store (database, search index, cache, object storage)
writes when it comes from the store's owner and reads otherwise (`studioStoreAccess(design,
connection)`: `"write" | "read"`, or `undefined` for a link that doesn't end at a store). It is
derived from the owner, never stored; changing the owner changes who writes. The line inspector
shows "Writes (owner)" or "Reads", the store's inspector lists its writer and readers, chat's
`getDesign` gives each such link its `access`, and the blueprint gives the connection `access`.
Queue links keep publish and consume. The
entry kinds (`studioEntryKinds`) are the user rows' targets. A link given without a mode takes its
pair's default: async for queue links, sync otherwise (`studioDefaultLinkMode`;
`studioLinkDefaults(source, target, mode?)`). `studioLinkRefusal` gives the reason a pair or mode
is refused, in plain words ("A cache can't link onward.", "Publishing to a queue is asynchronous,
not a request."). Switching an existing link's mode is the line inspector's Interaction field.

The table records design intent only. No template-support state is kept: a future code generator
will mark the tiles and links it has no template for (a badge and a blueprint finding) and never
refuse them, keeping design intent and template availability apart.

Caps (`laneLimits`): at most 4 outgoing links per tile and 3 entries per lane, and a tile has
at most one entry. A broken rule is a `LANE_INVALID` finding (`laneFindings`). Validation includes
these, so any batch that leaves a broken lane rule is rejected, from the canvas, chat or the API.
C1 people, external systems and relationships are not tiles and are not checked.

Lane commands ([`studio-lane-commands.ts`](packages/spec/src/studio-lane-commands.ts)) edit a
design that keeps these rules, and refuse in plain words with tile names ("URL cache can't link
to Geo lookup. A cache can't link onward."):

| Command | What it does |
| --- | --- |
| `addTile` | A new tile after a tile, after a lane (an entry; always a request) or before a tile. `link` (the mode) is optional and defaults to the pair's. Before moves every link into the tile, and its entry, to the new tile: a moved connection keeps its ID and mode and takes the table's defaults. A new database, cache, storage or queue is owned by the application it is added next to. |
| `linkTiles` | Links a lane or a tile to a tile already on the board (a merge), in `link` mode or the pair's default. A lane onto a tile that already has an entry, in either lane, is refused ("Redirect service already starts the download lane; a tile has one entry."). |
| `removeTile` | Removes a tile and links every predecessor to every successor the table allows (restitched entries stay in the lane). Tiles that would be cut off must be listed in `alsoRemove`. Their modules, links and the settings that named them go too; a resource whose owner went passes to the first application that still links to it. |
| `removeLink` | Removes a connection or an entry, unless that cuts off a tile. |
| `changeKind` | Switches to another kind of the same tile type with that kind's default settings, unless a link, an entry or a module's link would no longer fit. |
| `setEntryLane` | Moves an entry to the other lane (`download` or `upload`), unless that lane already has 3 entries. |

Two pure helpers answer what a tile can do, for the canvas and chat:

- `laneOptions(design, from, side)` returns all seven tile types in `studioTileTypes` order for one
  side of a tile (`after` adds on the right, `before` inserts on the left) or a lane. Each is
  `{ type, kind }`, the kind an `addTile` would add (the type's default, a worker after a queue,
  else its first kind the rules accept), or `{ type, refusal }`, the plain-words reason the type's
  preferred kind is refused ("A queue can't link to URL database. A queue feeds only an
  application, not a database."). A create links with the pair's default mode.
- `attachOptions(design, node)` is the link tool. For a tile it lists every other tile in lane
  order with the `linkTiles` an attach would make, in the pair's default mode: selected → target
  when the rules allow it, else target → selected, else the forward direction's refusal. With
  URL database selected, dropping on Analytics worker makes Analytics worker → URL database.
  For the user (`LANE_ACTOR`) it lists, per lane, every tile that lane could take as an entry, or
  why not.

On the canvas ([studio guide](docs/studio.md#creating-and-connecting)), a side's `+` shows when
`laneOptions` has a kind for it, and its fan shows all seven types, greyed with the refusal where
there is none; a pick runs `addTile`. The link tool shows when `attachOptions` has a link, and a
drop runs that option's `linkTiles`. Both leave out `link`, so the pair's default mode applies. A
tile's X runs `removeTile` (after `planRemoveTile`, with the tiles the confirmation listed as
`alsoRemove`) and a line's X runs `removeLink` ([removing](docs/studio.md#removing)); the
inspector's Type list runs `changeKind`
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
partitions). Connections carry action, protocol, interaction, access, and timeout/retry where
applicable. All of it is listed in [studio settings](docs/studio-settings.md).

## Provider choices

Settings name providers as intent only: they create no box, credential, deployment or API call.

| Area | Choices |
| --- | --- |
| Managed hosting | Cloudflare Workers, AWS, Google Cloud, external |
| Browser hosting | Cloudflare, AWS, Google Cloud, external |
| Payments, email, identity | Stripe; Resend, Amazon SES; OIDC; or external (Stripe, Resend and OIDC preset) |
| Gateway product | Traefik (preset), Envoy, Kong, NGINX, Amazon API Gateway, external |
| Databases and caches | self-hosted, AWS, Google Cloud, Neon, Supabase, Cloudflare D1, Upstash (by engine) |
| Queues, object storage, search, CDN | self-hosted, AWS, Google Cloud, Cloudflare Queues/R2, Amazon S3/CloudFront, Google Cloud Storage/CDN, external (by kind; a CDN starts with Cloudflare) |

## Chat model providers

The design chat uses one provider and model chosen in Settings
([`packages/providers`](packages/providers/src/catalog.ts)):

| Provider | Credentials |
| --- | --- |
| OpenAI API | `OPENAI_API_KEY` or `openai.apiKey` in `~/.jeeves/config.json` |
| Codex | its own CLI login (`codex login`); Jeeves never sees the credentials |

## Study

**TinyURL** (`studio-tinyurl@3.0.0`) is the one study, built from published designs
(HelloInterview, System Design Primer, DesignGurus/Grokking, ByteByteGo, and Dub's open-source
redirect): a read-heavy URL shortener with separate redirect and create services, a cache in
front of one URL database that only the Shorten service writes, and click analytics through a
queue into a store read by a Stats API. No CDN tile. The user downloads through the Stats API
and the Redirect service and uploads through the Shorten service: eight tiles, ten links (three
entries and seven connections) and nine components. It is described in the
[studio guide](docs/studio.md#the-tinyurl-study).
