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

| Kind | Name | Library group | Created at | What it is |
| --- | --- | --- | --- | --- |
| `service` | Microservice | Services | C2 | One independently deployed application. |
| `browser` | Browser app | Services | C2 | Browser assets, standalone or served by an application. |
| `worker` | Worker service | Services | C2 | A background application. |
| `gateway` | Gateway | Services | C2 | An entry point routing requests to internal services. |
| `billing` | Billing | Presets | C2 | One service with a payment provider choice. |
| `redirect` | Redirect | Presets | C2 | A public redirect service with lookup store and cache shortcuts. |
| `notification` | Notifications | Presets | C2 | One service with email delivery intent. |
| `identity` | Identity | Presets | C2 | One service integrating an existing identity provider. |
| `database` | Database | Resources | C2 or C3 | A logical store; engine and provider are separate choices. |
| `cache` | Cache | Resources | C2 or C3 | A logical cache with an optional TTL. |
| `queue` | Queue or topic | Resources | C3 only, owner required | One shared channel; C2 summarises producer → consumer. |
| `object-store` | Object storage | Resources | C2 or C3 | A byte store with access intent. |
| `search` | Search index | Resources | C2 or C3 | A derived search index. |
| `cdn` | CDN | Integrations | C2 or C3 | Content delivery in front of an application or object store. |
| `external-api` | External API | Integrations | C2 or C3 | An external integration boundary, named for the provider. |

Applications can also be created as members of a package. A resource created at C3 is owned by
the application or package it was created from.

## Tile types (lane canvas)

The lane canvas groups kinds into seven tile types, offered as picker icons once tiles can be
created by mouse (not yet). The first kind is the default and the others are variants.
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
**download** or **upload** lane. Every tile must be reachable from the actor, with no cycles.
Which kinds may link, and how, is one table
([`studio-links.ts`](packages/spec/src/studio-links.ts)). "Application" means the Service and API
kinds except `cdn`. A sync link is a request (solid line); an async link does not wait (dashed
line, as is every link that continues after one).

| Source → target | Sync | Async |
| --- | --- | --- |
| actor → `service`, `redirect`, `identity`, `notification`, `billing`, `gateway`, `cdn`, `object-store`, `external-api` (an entry) | yes | no |
| application → `database`, `cache` | yes (uses-database) | no |
| application → `object-store`, `search`, `cdn` | yes (depends-on) | no |
| application → application, `external-api` | yes (calls) | yes (calls, Asynchronous) |
| application → `queue` | no | yes (publish) |
| `queue` → application | no | yes (consume) |
| `external-api` → application | yes | yes |
| `cdn` → application, `object-store` | yes | no |
| `database`, `cache`, `object-store`, `search` → anything | no (end tiles) | no |

Caps (`laneLimits`): at most 4 outgoing links per tile and 3 entries per lane. A tile is entered
at most once. A broken rule is a `LANE_INVALID` finding (`laneFindings`). Validation includes
these, so any batch that leaves a broken lane rule is rejected, from the canvas, chat or the API.
C1 people, external systems and relationships are not tiles and are not checked.

Lane commands ([`studio-lane-commands.ts`](packages/spec/src/studio-lane-commands.ts)) edit a
design that keeps these rules, and refuse in plain words with tile names ("Link cache can't link
to Geo lookup. A cache can't link onward."):

| Command | What it does |
| --- | --- |
| `addTile` | A new tile after a tile, after a lane (an entry; always a request) or before a tile. Before moves every link into the tile, and its entry, to the new tile: a moved connection keeps its ID and mode and takes the table's defaults. A new database, cache, storage or queue is owned by the application it is added next to. |
| `linkTiles` | Links a lane or a tile to a tile already on the board (a merge). |
| `removeTile` | Removes a tile and links every predecessor to every successor the table allows (restitched entries stay in the lane). Tiles that would be cut off must be listed in `alsoRemove`. Their modules, links and the settings that named them go too; a resource whose owner went passes to the first application that still links to it. |
| `removeLink` | Removes a connection or an entry, unless that cuts off a tile. |
| `changeKind` | Switches to another kind of the same tile type with that kind's default settings, unless a link, an entry or a module's link would no longer fit. |

A **package** groups two or more independent applications; it has no language, provider or
runtime, and the lane canvas does not show it. The **Service and worker** preset (offered to chat)
creates a service, a worker and a package-owned work queue in one step; nothing links to the
service, so the lane rules refuse it.

## Components (C3)

Components live inside one application and reach other boxes only through an existing C2
connection.

| Kind | Name | Typical product |
| --- | --- | --- |
| `rate-limiter` | Rate limiter | Redis |
| `cache-reader` | Cache reader | Redis, Memcached |
| `id-generator` | ID generator | PostgreSQL, Redis |
| `redirect-responder` | Redirect responder | CDN |
| `event-publisher` | Event publisher | Kafka, Amazon SQS, Redis Streams |
| `event-consumer` | Event consumer | Kafka, Amazon SQS, Redis Streams |
| `data-access` | Data access | PostgreSQL |
| `auth-guard` | Auth guard | Identity service |
| `external-call` | External call | Any API |
| `custom` | Custom | none: project-specific logic described by a one-line purpose |

Browser apps host only auth guard, external call and custom components.

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
| Payments, email, identity | Stripe; Resend, Amazon SES; OIDC; or external |
| Gateway product | Envoy, Kong, NGINX, Traefik, Amazon API Gateway, external |
| Databases and caches | self-hosted, AWS, Google Cloud, Neon, Supabase, Cloudflare D1, Upstash (by engine) |
| Queues, object storage, search, CDN | self-hosted, AWS, Google Cloud, Cloudflare Queues/R2, Amazon S3/CloudFront, Google Cloud Storage/CDN, external (by kind) |

## Chat model providers

The design chat uses one provider and model chosen in Settings
([`packages/providers`](packages/providers/src/catalog.ts)):

| Provider | Credentials |
| --- | --- |
| OpenAI API | `OPENAI_API_KEY` or `openai.apiKey` in `~/.jeeves/config.json` |
| Codex | its own CLI login (`codex login`); Jeeves never sees the credentials |

## Study

**TinyURL** (`studio-tinyurl@2.0.0`) is the one study: a read-heavy URL shortener with a CDN,
cache-aside redirects, range-allocated IDs and asynchronous click analytics, using eleven
components. The user downloads through the CDN and uploads through the Shorten API: nine tiles
and eleven links. It is described in the [studio guide](docs/studio.md#the-tinyurl-study).
