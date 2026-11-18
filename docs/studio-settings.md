# Studio settings

The normal editor exposes only useful settings with actual consumers in the executing installed
registry. The broader tables below document the preserved source schema, not a menu of supported
controls. Reading, selecting, renaming or reloading a design never removes unsupported intent.

## Normal feature configuration

Installed templates are selected by modules: a lead with its parts connected (contract §3) gets
its template, and the module command derives its declarations in one atomic save/Undo. There is no
feature preset to attach; a design that attached one stays readable, editable and exportable.
Product implementation remains custom work after generation. Historical YouTube selections
remain readable and export reusable modules with explicit gaps; they install no product code. Local
Docker, TypeScript, exact providers, codecs, renditions, deadlines and event policy are fixed.

| Normal control | Actual selected consumer | Bound |
| --- | --- | --- |
| Request timeout | HTTP service deadline: a template's, or (Runnable processes on) the tile's process | 1–300000 ms |
| Front door | Public runnable HTTP process, before routing/parsing/admission/sessions | Required or None |
| Concurrency limit | HTTP admission: a template's, or (Runnable processes on) the tile's process | 1–100000 |
| Worker concurrency | AMQP handler admission, except fixed media worker; (Runnable processes on) its stub loops too | 1–1024 |
| TTL | Positive cache reader | 1–604800 seconds |
| Freshness / Exposure | Cache reader mode and HTTP/in-process binding | Immutable-positive or versioned; HTTP or in-process |
| Limit per window / Window | Shared Rate limiter | 1–10000 / 1–604800 seconds |
| Interval | Scheduled task in Service or Worker | 1–604800 seconds |
| Body limit / Signature window | Generic HMAC Webhook receiver | 1024, 16384 or 65536 bytes / 30–300 seconds |
| Delivery horizon | Event counter receipt retention requirement | 1–604800 seconds |
| Sign-in / Idle expiry / Absolute expiry / Guest cookie context / Request offline access | Browser session | Required or Optional; 60–86400 / 60–604800 seconds, idle ≤ absolute; disabled or enabled |
| Sign-in | Bearer Auth guard | Required or Optional |
| Pool size | SQL client of a Data access or Lifecycle writer | 1–1000 |
| Statement timeout | SQL client of a Data access or Lifecycle writer | 1–300000 ms |
| Provider (a Queue only stubs use) | (Runnable processes on) its stubs' processes: RabbitMQ, or a Google Cloud Pub/Sub topic | Unspecified, Self-hosted, Google Cloud |

Worker **shareOwner** and named product table/view access are also implemented authoring
choices; credentials, retry/fence/refresh state and arbitrary setting-name declarations stay out
of normal controls. See [logical ownership](studio.md#logical-owners-roles-and-access) and the
[foundation handback](plans/reliable-generation/owner-handback.md) for boundaries/evidence.

Controls additionally require an authoritative saved source field and the installed template's
matching consumer/output paths. A saved value outside its bound or its template's supported values
(an older or hand-made design) keeps its own control, showing the value and the reason, so the
Options form or chat's `edit` puts it right; only a supported value is accepted. While it is
invalid, Generate project refuses and the design's other controls wait. Chat's review offers to
clear a process's own setting (the process then runs its initial value).

TTL is edited on the cache tile; its traced reader mirror changes in the same atomic command. Worker
concurrency mirrors behave the same way. A mirror has no second editor. SQL settings are edited on
the module that reads that database for the template: its bound Data access, or the Lifecycle
writer, which is its lifecycle template's own SQL source. Normal controls never expose
weights/mappings, IDs, exact versions, grants, arbitrary config, L1/negative caching, Go/tus/cloud
alternatives, provider choices (apart from a stub-only Queue's, below) or media internals. A select
offers only its control's supported values, as chat's `editableSettings` lists them. Historical modules remain inspectable and
renameable; arbitrary module/kind replacement requires explicit custom source work.

`buildSupportedAuthoringCommand` and `normalSettingFields` in
[`supported-authoring.ts`](../jeeves/packages/spec/src/supported-authoring.ts) drive mouse/chat.
`GET /generation-support` reports the actual server registry; failure means no editable template
settings. Unsupported chat changes refuse without modifying source. Explicit custom requirements
remain visible unresolved generation gaps. The low-level source schemas/commands below remain
available for imports and diagnostics.

Normal edits also check the resulting composition against the installed resolver before returning
operations. A new incompatibility refuses the whole mouse command or chat batch. Existing imported
findings may remain during repair, and label edits preserve their source identities. Incomplete
module scaffolds and unwritten product hooks remain explicit custom work; they are not certified
by the settings check. Preview, download and the CLI refuse the same unsupported saved source
before producing an export. There is no Advanced settings section or alternate chat bypass.

## Rules

- Each kind has one immutable definition, `studio-<kind>@1.0.0`: display name, icon and colour,
  classification, settings schema, provider choices and field descriptors. Definitions are design
  vocabulary, not runtime templates.
- Forms come from explicit field descriptors (path, label, control, allowed values or range,
  applicability, short help), never from schema reflection. A visible default is exactly the
  stored value.
- Stored values are machine identifiers from this page. `unspecified` is an explicit option where
  listed; an omitted optional number or reference means unspecified and shows an empty input.
  Defaults apply on creation only and are never filled in on read (the one exception: a stored
  language outside its kind's pair reads as the default, see [Languages](#languages)).
- Name (1–120 characters) and description (0–240; **Description** in the inspector) are the
  element's own fields.
- No credentials, URLs with credentials, account/zone/project IDs, regions, instance sizes or
  secret names.
- Selecting a provider changes no other field's meaning, creates no box, calls nothing and claims
  no working code.

## Profile and persistent requirements

Top-level schema-v3 `scope` remains typed source (`design-scope.ts`), visible read-only only in
the full saved source under **Export diagram → Source & diagnostics**. Normal authoring has no
requirements form. Explicit source/chat commands still require an explicit schema2 upgrade and
save the whole boundary in one Undo step; pure reads change nothing.

| Path | Allowed values / bound |
| --- | --- |
| `scope.profile` | `null` (unspecified) or exact `{id, version}`. IDs are lowercase slugs (63 chars); versions are exact three-part nonnegative decimal versions (40 chars, no leading zeros/ranges). The selectable known ref is `tinyurl-create-resolve@1.0.0`. Unknown well-formed refs remain saveable/unresolved and visible. |
| `scope.requirements[]` | At most ten distinct finite features below; each has `disposition: included/excluded` and `criticality: required/advisory`. Missing feature is unspecified. |
| `scope.customRequirements[]` | At most eight distinct slug IDs, `requirement` (1–1000 trimmed chars), `criticality: required/advisory`, optional element and connection slug targets. Always unresolved; removing a target retains the requirement with a missing-target diagnostic. |

Selecting the TinyURL profile initially includes `immutable-http-targets`, `authenticated-create`,
`public-resolve`, `optional-expiry`, and excludes `custom-slugs`, `mutable-destinations`,
`disable-management`, `reputation-enforcement`, `quotas`, `exact-analytics`, all required.
Existing explicit rows/custom requirements are preserved when selecting the profile. Each row
can be included, excluded or unspecified, and required or advisory. Contradictions remain
saveable intent with targeted unresolved findings; a required excluded feature blocks this
profile. Removing the profile preserves its requirement declarations.

Preview shows the exact unresolved contracts and the v3 export boundary. A changed design
invalidates the preview before save. Profile selection never converts names, labels or modules
into contracts. Profile selection supplies no ownership/API/message contract, template manifest or runtime. Explicit ownership declarations remain typed source below.
RF04 `declareReviewScope` is turn-only review metadata; chat does not edit the saved scope. See [blueprint](studio-blueprint.md).

The new `studio-tinyurl-foundation@1.0.0` study explicitly stores these scope defaults, complete
ownership/access and operation/cache declarations in schema v3 as one seed edit. This does not
change per-kind creation defaults or migrate older projects/studies. No new settings were added.

## Applications

**Front door** (`settings.frontDoor?`, on kinds with Exposure) is `required` or `none`.
The normal form and chat offer it only on a public runnable HTTP process. New normal tiles
store `required` (inactive while internal); a new lane-entry service also stores public Exposure.
Reading a saved design never adds the field: absence means `none`, preserving its service source.
The installed Identity vendor has no stamp consumer and offers no such normal control; its source
schema can retain `none`, while `required` on that vendor is refused.

Required services accept `x-edge-stamp: v1.<unix seconds>.<lowercase HMAC-SHA256 hex>` over
`<seconds>.<METHOD>.<path without query>`, within ±60 seconds. Health paths are exempt; only
compiled internal workload adapters are exempt, retaining workload and independent user checks.
Missing/invalid stamps get the standard 403 body before routing, parsing, admission or sessions,
and one reason-only log. The private header is removed before dispatch. Startup requires
`JEEVES_EDGE_STAMP_KEY`; optional `JEEVES_EDGE_STAMP_KEY_PREVIOUS` permits overlap. Keys are
32–512 printable non-whitespace ASCII characters. Neither keys nor stamps are product settings.
The generated local edge uses a setup-generated private key. Runnable processes off has no
per-tile process/gate; this setting is then inactive and is not offered as a normal control.

`S` is `architecture.studio.elements[].settings`. "Common" means service, worker, billing,
redirect, notification, identity, uploads and gateway; "coded" means the common kinds except
gateway.
References are IDs of existing objects.

| Field / path | Values (creation default first) | Applies to and effect |
| --- | --- | --- |
| Execution / `S.execution` | `docker`, `managed` | Common. Execution intent. Managed reveals Host. |
| Language / `S.language` | the kind's two languages ([below](#languages)) | Coded kinds only; gateway has none. No framework or version. |
| Host / `S.host` | `unspecified`, `cloudflare-workers`, `aws`, `google-cloud`, `external` | Only with `execution=managed`; removed when switching back to Docker. |
| Exposure / `S.exposure` | `internal`, `public` | Common except worker. Redirect, uploads and gateway default to public. Network intent, not an auth guarantee. |
| Delivery / `S.delivery` | `standalone`, `bundled` | Browser. How browser assets are distributed. |
| Served by / `S.servedBy` | optional application ref | Browser, bundled. Unset is a readiness gap. |
| Hosting provider / `S.provider` | `unspecified`, `cloudflare`, `aws`, `google-cloud`, `external` | Browser, standalone. |
| Concurrency / `S.concurrency` | optional integer 1–1024 | Worker. Its concurrency limit. |
| Payment provider / `S.provider` | `stripe`, `unspecified`, `external` | Billing. One service; no adapter or entitlement boxes. |
| Lookup store / `S.lookupStoreConnection` | optional connection ref to a database | Redirect. Names the real service→store connection. |
| Lookup cache / `S.lookupCacheConnection` | optional connection ref to a cache | Redirect. Same rule. |
| Delivery provider / `S.provider` | `resend`, `unspecified`, `aws-ses`, `external` | Notification. |
| Identity integration / `S.provider` | `oidc`, `unspecified`, `external` | Identity. No roles, grants or login screens. |
| Transfer / `S.transfer` | `signed-url`, `tus` | Uploads. How an upload's bytes travel ([below](#uploads)). No size limits, file types or bucket names. |
| Routing / `S.routing` | `path-prefix`, `host-name` | Gateway. No route table; downstream services are its outgoing connections. |
| Gateway product / `S.provider` | `traefik`, `unspecified`, `envoy`, `kong`, `nginx`, `aws-api-gateway`, `external` | Gateway. |

Billing, Redirect, Notifications, Identity and Uploads are kinds of the Service tile, like
Microservice and Worker service: ordinary service semantics plus the fields above. Gateway and CDN
are the API tile's kinds. The canvas's link fan adds only Microservice, Worker service, Uploads,
Identity, CDN and the data, queue and external kinds ([catalog](../jeeves/CATALOG.md#tile-types-and-the-link-fan));
existing Billing, Redirect, Notifications and Gateway tiles keep their settings. Browser app stays
in the format but no tile type offers it. A plain service can be
named Catalog or Orders without gaining a business-rule form.

### Languages

The historical source schema accepts two languages per coded kind, its default first; any other value is refused (`Choose
TypeScript or Go; this kind offers no other language.`). Gateway and CDN are products, not code,
and have no language; the browser app has none either.

| Kind | Languages (default first) |
| --- | --- |
| `service` (Microservice) | `typescript`, `go` |
| `worker` | `typescript`, `go` |
| `redirect` | `go`, `typescript` |
| `identity` | `typescript`, `go` |
| `notification` | `typescript`, `go` |
| `billing` | `typescript`, `go` |
| `uploads` | `typescript`, `go` |
| `gateway`, `cdn` | none |

A stored design whose language is outside its kind's pair (including the old `unspecified`,
`javascript`, `python`, `java`, `csharp` and `rust`) reads with the kind's default, and a stored
gateway's language is dropped. Low-level source commands still refuse such values. Normal forms expose no language choice.

### Defaults

A new tile and `changeKind` start from the kind's defaults (`createStudioSettings`). The
preconfigured kinds name their usual provider; other source values remain preservable:

| Kind | Field | Starts as |
| --- | --- | --- |
| Billing | payment provider | `stripe` |
| Notifications | delivery provider | `resend` |
| Identity | integration | `oidc` |
| Uploads | transfer | `signed-url` |
| Gateway | product | `traefik` |
| CDN | provider | `cloudflare` |

Applications start with `execution=docker`, the kind's default language and `exposure=internal`
(redirect, uploads and gateway: `public`).

A provider chosen on a kind is that service's integration: Billing with Stripe needs no separate
External tile for Stripe. External API tiles are for third parties no kind covers.

A lookup shortcut names an existing connection and never duplicates its endpoints. The inspector
lists the redirect's connections to a database or cache; chat sets it with an `edit` whose
settings name one (after a `linkTiles` when the link is new). Clearing it removes the setting, not
the connection; deleting the connection clears the shortcut in the same operation.

A **package** has name, purpose and members only: no language, provider or runtime. Packages stay
in the format; neither the canvas nor chat creates or changes them.

### Uploads

An **Uploads** service takes large files (videos, archives) into the object storage it owns, and
**Transfer** (`transfer`, Options, required) says how the bytes travel. The diagram is the same
either way: the user's action reaches the Uploads service, which writes the store; a user never
reaches storage on the canvas.

- `signed-url` (Signed URLs to storage, the default): the service starts a multipart upload,
  signs a URL for each part, and the client sends the parts straight to storage; the client can
  resume by asking which parts arrived, and the service completes the upload. Template: a
  generated service with the storage SDK's multipart calls (AWS's presigned multipart pattern).
- `tus` (Through the service (tus)): the client sends the bytes to the service with the tus
  resumable-upload protocol, and the service streams them into storage. Template: a ready-made
  tus server configured with the store as its backend (tusd in Go, `@tus/server` in TypeScript),
  with a hook that checks the user before an upload starts and one that publishes the job when it
  finishes.

The store it writes is the object storage it links to and owns. Who may upload, size limits and
accepted file types stay application work. The [YouTube study](studio.md#the-youtube-study)'s
Upload service is one, with signed URLs.

### Performance intent

All optional; absent means unspecified.

| Kinds | Fields |
| --- | --- |
| Common except worker | `minReplicas` 0–1000, `maxReplicas` 1–1000, `autoscaleOn` cpu / requests-per-second / queue-lag, `requestTimeoutMs` 1–300000, `concurrencyLimit` 1–100000 |
| Worker | replicas and `autoscaleOn` as above; `concurrency` is its limit; no request timeout |
| Database | `readReplicas` 0–15, `partitionKey` (one column name) |
| Cache | `topology` standalone / cluster, `eviction` lru / lfu / ttl / none |
| Queue | `partitions` 1–1024 |
| CDN | `cacheRedirects` disabled / enabled |

Minimum replicas may not exceed maximum, and `autoscaleOn` needs a maximum above the minimum
(default 1). The inspector appends these after the definition's own Options fields.

## Resources and integrations

A resource can have an optional legacy inferred writer (an application or package), stored in the
binding's `owner`, not in `S`; a queue requires one. Ownership provisions nothing. A store's owner
is its only writer ([one writer per store](#relationships)).

| Kind | Settings beyond `kind` (default first) | Not offered |
| --- | --- | --- |
| `database` | `engine` unspecified / postgresql / mysql / sqlite / mongodb / clickhouse; `provider` (table below) | tables, queries, migrations, credentials, pool tuning |
| `cache` | `engine` unspecified / redis-compatible / memcached; `provider`; `ttlSeconds?` 1–604800 | key schemas, invalidation programs |
| `queue` | `mode` work-queue / topic (the tile's label: Queue or Topic); `provider` unspecified / self-hosted / aws / google-cloud / cloudflare-queues / external; `retentionSeconds?` 60–1209600 | exactly-once, DLQ automation, event schemas |
| `object-store` | `provider` unspecified / self-hosted / cloudflare-r2 / aws-s3 / google-cloud-storage / external; `access` private / public | bucket names, lifecycle rules |
| `search` | `engine` unspecified / opensearch / elasticsearch / meilisearch / external; `provider` unspecified / self-hosted / aws / google-cloud / external | index fields, analyzers |
| `cdn` | `provider` cloudflare / unspecified / aws-cloudfront / google-cloud-cdn / external; `origin?` application or object-store ref; `imageResizing?` disabled / on-request | cache rules, domains, WAF, language, image sizes or formats |
| `external-api` | `category` generic / payments / email / identity / recognition / workflow; `provider` unspecified / cloudflare / aws / google-cloud / external | request builders, webhooks, secrets |

**Image resizing** (`imageResizing`, a CDN's Options; absent means unspecified): `on-request`
means the CDN resizes images from its origin per request (the size in the URL) and caches each
size, so the origin keeps only originals (Cloudflare's image transformations; AWS's Dynamic Image
Transformation in front of CloudFront). It names no sizes or formats; those belong to the pages
that ask for them. The [marketplace study](studio.md#the-marketplace-study) uses it for product
photos, the [YouTube study](studio.md#the-youtube-study) for video thumbnails.

A new queue is owned by the application it is added next to (its links are always asynchronous);
one with no application next to it is refused. Database and cache providers depend on the engine:

| Engine | Providers |
| --- | --- |
| unspecified (any kind) | unspecified, external |
| PostgreSQL | unspecified, self-hosted, aws, google-cloud, neon, supabase, external |
| MySQL | unspecified, self-hosted, aws, google-cloud, external |
| SQLite | unspecified, self-hosted, cloudflare-d1, external |
| MongoDB | unspecified, self-hosted, external |
| ClickHouse | unspecified, self-hosted, aws, google-cloud, external |
| Redis-compatible | unspecified, self-hosted, aws, google-cloud, upstash, external |
| Memcached | unspecified, self-hosted, aws, google-cloud, external |

A search provider needs a specified engine. Changing the engine resets an incompatible provider
to unspecified in the same edit. Generic AWS or Google Cloud never implies a hidden product (AWS
plus a topic does not mean SQS); only the named products above carry a product identity.

## Relationships

| Field | Values | Conditions |
| --- | --- | --- |
| Action | `planned.label`, 1–60 characters | Default from the endpoint kinds: Calls, Reads & writes, Publishes, Consumes, Uses. |
| Protocol | Unspecified, HTTPS, HTTP, gRPC, WebSocket, SSE, SQL, Redis, Messaging, Native binding | — |
| Interaction | Request / response, Asynchronous, Streaming | Queue links are Asynchronous. Asynchronous dashes the line and is accepted only where the [link table](../jeeves/CATALOG.md#lanes-and-links) has an async mode; Streaming counts as a request. |
| Security / `planned.security` | Service identity, User identity, Public, Private network | Intent only. |
| Timeout / `settings.timeoutMs?` | 1–300000 | HTTP, HTTPS or gRPC request/response only. |
| Retry / `settings.retry` | `mode` unspecified / none / fixed; fixed adds `attempts` 1–10 and `delayMs` 1–60000 | Same protocols. Attempts are additional attempts. |
| Channel role / `settings.channelUse?` | publish / consume | Queue links only; set by the connection's direction. |

When a protocol or interaction change makes timeout or retry inapplicable, they are removed in
the same edit. A C1 relationship has only its action and endpoints.

**One writer per store.** A link into a database, search index, cache or object storage *writes*
when it comes from the store's owner (the resource's **Owner**, or a member of the owning package)
and *reads* otherwise; a store with no owner is only read. This is derived, never stored. Full
source diagnostics retain the legacy owner; the [blueprint](studio-blueprint.md) gives the
connection `access: "write" | "read"`.
Changing a store's owner changes who writes. An owner's individual read cannot be distinguished
from a write by this model; editing the Action label does not override inferred access. Queue
links keep their channel role (publish or consume) instead. Solid/dashed strokes follow each
relationship's own Interaction, independently of upstream queues; target arrowheads and the
canvas's mouse-opened legend add no saved settings.

## Actions

`architecture.studio.actions[]` (`lane` download / upload, `name`) records what the user does:
at most one action per lane. `name` is the one large word on its action tile, 1–24 characters
after trimming ("Use 24 characters or fewer."); the action's inspector has a **Name** field that
autosaves through `renameAction`, and shows its lane read-only. A new action is named
**Consume** (download) or **Produce** (upload) unless a name is given. An action has no other
settings and no ID; commands name it by its lane. Two actions in one lane are invalid ("Each lane
has one action; the upload lane has 2."). A design stored with entries in a lane that has no
action (stored before actions) loads with that lane's default action, Consume or Produce; this
composes with the `both` and language normalisation below and in [Languages](#languages). The
[blueprint](studio-blueprint.md) lists the actions.

## Lane entries

`architecture.studio.entries[]` (`id`, `lane` download / upload, `element`) records the tiles
each lane's action reaches directly; an entry needs its lane's action, and a tile has at most one
entry. An entry has no settings form; its inspector's lane row sets `lane` (moving it to the other
lane's action). Its ID shares the design's ID space, its element must exist, and removing the
element removes the entry. Every tile must be reachable from the user through an action and an
entry; which kinds may be entries, and the other lane rules validation enforces, are in the
[catalog](../jeeves/CATALOG.md#lanes-and-links). A design stored with an entry in `both` lanes
(possible for a while) loads with that entry in `download`.

## Components

Components are `architecture.studio.components[]` (`id`, `host`, `name`, optional `description`,
`settings`) and `componentConnections[]` (`id`, `from`, `to: {kind: component, id} | {kind:
element, id, via}`, optional `label`). In the studio they are a tile's modules, edited in its
inspector: a new one starts with the defaults below and its kind's name, and **Description** is
its `description`.

| Kind | Settings (default first) |
| --- | --- |
| `rate-limiter` | New: `limit` 100 (1–10,000), `windowSeconds` 60 (1–604,800). Fixed generated policy: `algorithm: sliding-window`, `key: policy`, `store: redis`. Legacy token-bucket / ip / api-key / user / memory values remain readable but unsupported. |
| `cache-reader` | `pattern` cache-aside / read-through; `l1MaxEntries?` (absent = no L1); `l1TtlSeconds?` (needs L1 size); `l2TtlSeconds?`; `negativeTtlSeconds?` (absent = off); `stampede` none / single-flight |
| `id-generator` | `strategy` db-sequence / redis-counter / range-allocation / snowflake / random; `blockSize?` (range allocation only); `encoding` base62 / base58 / base36 / decimal; `minLength?` |
| `redirect-responder` | `status` 302 / 301 / 307; `edgeMaxAgeSeconds?` |
| `event-publisher` | `batchSize?`; `lingerMs?`; `outbox` disabled / enabled |
| `event-consumer` | `concurrency?`; `batchSize?`; `retryLimit?`; `deadLetterQueue?` (a queue other than the source) |
| `data-access` | `poolSize?`; `readRouting` primary / replica; `statementTimeoutMs?` |
| `auth-guard` | `credential` jwt / api-key / session; `signIn?` required / optional (absent = required) |
| `external-call` | `circuitBreaker` disabled / enabled; timeout and retry stay on the traced connection |
| `custom` | none; its `description` is its one-line purpose |
| `lifecycle-writer` | `poolSize?`; `statementTimeoutMs?` |
| `multipart-uploads`, `video-encoder`, `video-packager`, `video-thumbnailer`, `event-counter`, `index-writer`, `search-query`, `favorites` | none |

The module commands (`addModule`, `connectModule`, `disconnectModule`, `removeModule`, in the
[catalog](../jeeves/CATALOG.md#components-c3)) write, in the same batch, the values a selected
template fixes. They write each one only where the tile or module still holds its creation
default or `unspecified`:

| Where | Value |
| --- | --- |
| Database | PostgreSQL, self-hosted |
| Cache | Redis-compatible, self-hosted |
| Search index | OpenSearch, self-hosted |
| Queue | self-hosted; a work queue for jobs, a topic otherwise |
| Object storage | self-hosted; private, but public for outputs |
| Identity, and a service host that is a lane entry | public |
| Video encoding worker | concurrency 1 |
| Event publisher | outbox on for jobs and publication, off for results |
| Cache reader | cache-aside, single-flight (also set when it is added) |
| Auth guard | Sign-in required, once it verifies an Identity |

A needed setting with no value gets one: Request timeout 1000 ms, Concurrency limit 1000, Worker
concurrency 4, Cache TTL 3600 s, Pool size 10 and Statement timeout 2000 ms (on a Data access in
a template, Favorites' items included, and on a Lifecycle writer). Any other kept value stays, and the module's status is
**Refused** with the reason. Stub modules get no values.

**Sign-in** (`signIn`, v3 contract §2) is the one setting an Auth guard shows, on its module page
and in chat's `editableSettings`, once the guard leads its sign-in template (connected to an
Identity, in a Service or Uploads tile). **Required**: every module route of the tile needs a
valid token, else 401. **Optional**: a request without a token is anonymous; an invalid one is
still 401. Absent reads as Required, so older designs keep their meaning. With Runnable
processes on, `src/runtime/tile-guard.ts` consumes it. Changing it re-derives the tile in the
same step: Multipart uploads and Favorites need their tile's guard set to Required, and are a
Stub ("Needs an Auth guard set to Required in <tile>.") otherwise. Credential stays fixed at JWT
and hidden.

**Favorites** has no settings (no field was added). Its bounds are fixed in the
`favorites-policy` record (item IDs 1–200 characters of `A-Za-z0-9._:-`, 1,000 per account, 50 to
a page), and its own pool on its database runs fixed at 10 connections and 2000 ms, so its module
page shows no Options. Its **items** Data access shows Pool size and Statement timeout like any
Data access in a template (initial 10 and 2000), and its tile Request timeout and Concurrency
limit (initial 1000 ms and 1000).

Rejected outright: a host that is not a studio application (browser apps host only auth guard,
external call and custom); a component-to-component link across hosts; an element link whose
`via` connection does not join host and target directly; a publisher or consumer link that does
not trace a publish or consume connection; duplicate identities.

Readiness gaps (`CONFIG_REQUIRED`, saved but reported): a required dependency is missing (cache
reader → cache, data access → database, publisher or consumer → queue, Redis rate limiter →
cache, sequence or range ID → database, Redis counter → cache, outbox → database, external call
→ target); replica read routing without a replicated database; a custom component without a
purpose. Deleting a host removes its components; deleting a traced connection or target removes
the links.

## Never in normal authoring

HTTP routes, request/response or event schemas, entities and queries, plan/role/limit tables,
lifecycle or state-machine editors, business data-retention rules, capacity targets,
framework/library versions and cloud deployment configuration. Behaviour like that belongs to a
future generator's templates or to code written later, not to a free-text field that pretends it
is implemented.

## Explicit logical ownership and store access (schema v3)

Optional top-level `ownership` uses `ownership.ts` and is visible under
**Export diagram → Source & diagnostics → Ownership & access**. Absence means unspecified;
reading never upgrades or derives declarations. Supported feature attachment writes its required
rows atomically. Explicit source/chat commands retain pure previews and atomic validation.

| Field | Finite values / limits |
| --- | --- |
| `owners[]` | Up to 50 distinct `{id, name}` records. Slug ID, trimmed name 1–120 chars. Logical responsibility, independent of studio packages. |
| `roles[]` | Up to 500 distinct existing application element IDs: `{element, owner, kind: api/worker, deployable?, sharedWith?}`. Owner must be declared; optional deployable is a slug assignment, supplies no permission and implies no running process. |
| `resources[]` | Up to 500 distinct existing database/cache/storage/search element IDs: `{element, authority, kind: source, productNamespace?: owner}` or `{element, authority, kind: projection, source}`. Authority is a declared logical owner. A projection names a different declared source resource, with its own authority; projection chains/self references refuse. Population/freshness/failure behavior remains unresolved unless the exact compatible positive-cache contract below refines this specific projection. |
| `grants[]` | Up to 500 distinct role/resource pairs: `{role, resource, access: read/write/read-write, boundary?: published-read}`. Both endpoints need declarations. Optional `product: {tables: [{name, operations: [SELECT/INSERT/UPDATE/DELETE]}], views: [name]}` compiles exact product grants when Runnable processes is on. Table/view names are bounded SQL identifiers; operations and names are unique. Private tables require the resource's logical owner; foreign readers name only published views. Template grants are independent and cannot be named through product access. |
| `dependencies[]` | Up to 500 distinct canonical application → store connection IDs: `{connection, access: read/write/read-write}`. The actual endpoints determine the role/resource; labels do not. |

A same-owner read stays read. Cache read and fill needs read-write; a read-only grant cannot
satisfy it. A request exceeding a declared grant refuses atomically. Foreign-owner direct writes
refuse even when deployables match. Cross-owner reads need an explicit `published-read` contract
boundary with named product views, or a reader-owned projection. A marker without a named product declaration retains targeted unresolved published-contract,
freshness/failure and runtime-authorization findings; it supplies no API bypass or runtime proof.
Missing legacy declarations/grants remain saveable readiness gaps, never inferred permission.

`cleanOwnershipChange` clears dependent grants/requests for explicit owner/role/authority removals
or transfers; `previewOwnership` reports every affected row. Complete replacements must explicitly retain
or remove those rows; contradictions refuse. Canonical tile deletion cleans its role/authority,
grants and removed-edge requests; removing a source used by a surviving projection refuses.
Relationship removal drops its request and retains the independent role grant. One Undo restores
all declarations; unrelated persistent custom requirements survive, including missing targets.

The old binding `owner` and connection `access` remain the **legacy inferred writer/access**
approximation above. They are separate from explicit authority/grants and remain unchanged by
feature attachment. Exact operation bindings remain typed source below; strict runtime authorization remains unavailable.

On a module-authored design, the worker inspector offers **Share logical owner with API** (`shareOwner {worker, api}`), with
atomic refusal when the worker already owns conflicting state. It never copies credentials.
The process inspector offers **Product table**, four operation checkboxes, and **Published view**
(`setDatabaseAccess {role, database, product}`). Empty product access grants nothing. Shared
membership and product grants survive later module commands and display renames. The source resource
persists `productNamespace: owner` when private-table authoring or explicit worker sharing first selects
owner-scoped product state; clearing/regranting allowlists never clears that namespace. Named-view
audiences alone leave legacy module namespaces in place. All product
schemas are setup-owned; application logins have no CREATE or migration credentials. A composed
`p_<owner ID>` must fit 63 bytes, including for a read-only declaration with no writer file.

Historical study/preset declarations remain readable; their forms do not offer new product-access
authoring, since those designs cannot enable Runnable processes.

Normal forms omit legacy writer/access controls and repeated owner/role/deployable explanations.
The full saved source download retains legacy inference, explicit authority, grants, dependencies
and operation intent independently. Connections rows can identify a saved declared request.
Canonical process tiles do not imply a new logical owner or deployment.

Topology writer warnings use valid declared authority/role/write-grant/dependency facts when
present, with legacy inferred-writer fallback when resource access declarations are absent. Targeted
`ownershipFindings` check the explicit declarations; neither proves runtime authorization.


## Exact operation contracts (schema v3)

Optional top-level `operations` is a finite source allowlist, shown read-only only in the full
saved source under **Export diagram → Source & diagnostics**. Normal generation authoring has no
declaration-only operation form.

`previewOperations` / `buildOperationsCommand` retain explicit upgrades, structural
refusals, exact contract checks, history and Undo. Fixed operation deadlines must agree with
existing source settings; unsupported historical intent requires explicit source work. Nothing
rewrites a preserved timeout, policy or verifier on read. Removal/transfer previews name exact
clears. V3 retains all rows/findings; default v2 refuses their exact paths. Strict contract template
availability and runtime verification remain separate from experimental generation support.

The tagged receiver binding is either the unchanged NC03
`{kind:"create-link",storeConnection,successRetentionHours:null|24,authVerifier:null|exactRef}`
or NC04 `{kind:"resolve-link",storeConnection,cacheConnection:null|id,cachePolicy:null|exactRef}`.
Resolve's only known policy is Positive cache · clamp to record expiry v1. Null is unspecified.
Source bindings retain both canonical connections and nullable exact policy refs, including
unknown ID/version/hash values for diagnostics without substitution. No numeric policy DSL,
route/schema editor or new generic connection settings are added. Resolve's exact deadline is
1200 ms; Create retains 10000 ms. A shared role can leave the optional global request timeout empty
to retain each operation deadline. Explicit global/caller deadline conflicts refuse. All-outcome
no-store, primary routing, cache read-write grants, TTL maximums and applicable typed module/CDN
contradictions are checked. [Complete policy and bounds](studio-contracts.md#resolve-link-v1-and-positive-cache-v1).

## Experimental generation declarations (schema v3)

The optional top-level `generation` contract now preserves exact local runtime/preset/template
refs, canonical element/component targets and finite resource/connection/selection bindings.
It adds no form or normal settings control. Unknown refs remain explicit unavailable declarations;
the finite catalog does not install implementations. Internal versioned transfer/media/lifecycle/
cache/count/public-video policies remain in typed metadata. Existing cache TTL and other settings
keep one authority; bindings do not copy configurable numeric values.

`buildGenerationCommand` / `previewGeneration` accept the complete selection plus optional
explicit ownership replacement, preview affected ownership/operation facts and produce one
atomic batch. Schema2 requires an explicit upgrade. Reads never add selections, grants or
defaults. Deleting a selected target cleans its selection; removing a resource/connection/guard
still bound by a surviving selection refuses until explicitly detached or replaced in the same
batch. Undo/Redo restore full declarations. Blueprint v3 preserves them; v2 refuses the exact
unsupported paths. Template resolution, installed support and later mouse/chat choices are
separate work. [Actual source interfaces](plans/reliable-foundations/youtube-v2/interfaces.md).

Pure v2 support resolution now lives in `@jeeves/spec`'s `resolveGeneration` and
`generationCapabilities`. It records finite consumers/source paths, providers/languages, required
roles/grants/channels and fixed policies. Cache tile TTL and worker concurrency are authoritative;
existing duplicate component values must agree. Only a necessary user choice with a real host-installed
consumer/output can qualify as a normal control. The current editor is unchanged; this unit installs
no v2 runtime implementation or controls. Unsupported historical intent stays preserved and reported.
The [interface record](plans/reliable-foundations/youtube-v2/interfaces.md#yv2-02--semantic-normalization-and-installed-control-support)
also explains the explicit local Keycloak substitution and transport-intent gaps.

Normal mouse/chat attachment installs the reusable video feature. Historical YouTube source
batches remain readable; the active generator no longer implements their product policies.
Generic cache, SQL and worker settings still reach generated constructors; required codecs,
routes and projections remain custom work, and so do application processes unless Runnable
processes is on (below). Base video adds no search
or counts. [Current boundary](plans/reliable-foundations/youtube-v2-generic-baseline.md).

**Runnable processes** (`generation.processes`, tile process contract §1) is the one export
option. Its schema is `true` or absent; off removes the key, so off has one form and exports
exactly as before. Its form is the unticked "Runnable processes" checkbox in Generate project,
which sends `setRunnableProcesses {on}`, as chat does: one `setGeneration` batch that never
derives. Validation refuses it on a design not built from modules (a study, frozen v2, tile-level
templates or a preset: "Runnable processes needs a design built from modules."), on one with no
module-level selection ("Add a module first.") and where the registry doesn't install processes
(`GenerationInstalledSupport.processes`); a raw source edit on a tile-level design is a
`CONFIG_INVALID` finding at `/generation/processes`. Blueprint v3 carries it in `generation`, and
v2 refuses its path. It adds no `generationPolicies` record and no new tile or module field.

**Process settings (D5, v3 contract §4).** While Runnable processes is on, a tile's process uses
its limits, so they are its normal controls even with only stubs (or no module): a Service or
Uploads tile (and the legacy Redirect and Billing) shows **Request timeout** and **Concurrency
limit** in its Options, consumed by the process's admission for every route, and a Worker shows
**Concurrency**, which its stub loops run (each loop's prefetch) instead of one message at a time.
Where a template on the tile consumes them, that template's control is the one shown (and its stub
loops take the same value); a Video HLS worker's Concurrency stays fixed at 1 and hidden.
Notifications has no Concurrency field, so its loops run one at a time. Turning the option on
writes nothing: an unsaved field is empty and shows what the process runs as its placeholder
(1000 ms, 1000, or 1), typing saves the value on the tile, and clearing it runs the initial value
again. The report lists each process's settings with their origin: `template`, `tile` (the
tile's saved value) or `fixed`. Mouse and chat share the controls (`getDesign.editableSettings`
rows with `process: <tile>` and `input: process.<setting>`). With the option off, nothing shows
and a saved value is preserved intent.

**A Queue's Provider (QG07).** While Runnable processes is on, a Queue or Topic whose every user is
a stub (no template binds it) is provisioned by its stubs' processes, so its **Provider** is its
normal control, offering only **Unspecified**, **Self-hosted** (both RabbitMQ) and **Google Cloud**
(a Pub/Sub topic: its publishers use the official client, and locally the export runs the Pub/Sub
emulator). It is consumed as `stub-channel.provider`; mouse and chat share it
(`getDesign.editableSettings` rows with `input: queue.provider`), and it can't be cleared. A
Queue a template uses has no such control: its template fixes it at Self-hosted, and any other
saved value is that template's unsupported setting. A saved value it doesn't support (AWS, an
older design) keeps the control, unsupported, until it is put right. A loop stub on a Google
Cloud queue consumes its tile's Pub/Sub subscription.

Generation preview and ZIP use these same installed consumer contracts. The dialog shows exact
selected-source support findings and emitted consumers/custom gaps; unsupported settings refuse
export instead of becoming an honored JSON-only setting. Partial product hooks and experimental
backend support remain separate from strict readiness and runtime evidence. See [export](studio.md#experimental-project-export).

Display names preserve IDs, target addresses, durable namespaces and hook paths. Custom's optional
**call** is a diagram link to a complete Favorites module in the same tile, not a configuration
field. Its installed exact input/output/version/effect contracts are compiled metadata; there is
no schema editor or Advanced setting. See [module connections](studio.md#adding-a-module).

Server/worker modules have an optional **workload** link to an Identity, independent of user
Sign-in. Select the same installed local OIDC/Keycloak issuer on each calling/called process.
This is an implemented link choice, not an extra setting. New service calls on private networks
need it too. Callee route stubs may export `allowedCallers` in product code to narrow the declared
process callers; there is no audience/credential override control. An Auth guard first connects
user identity, then workload on another Identity drag; other supported module Identity dots choose
workload. Browser hosts cannot hold these credentials. See the emitted API8 guide.

### Distributed admission (RG12)

A Service or Uploads Rate limiter becomes generated after its required **store** cache link and its
own tile's Required Auth guard are connected. Only **Limit per window** and **Window** are normal
editable settings, in inspector and chat. They feed the private single-key rolling-window log;
the cache's generic TTL is not used. The installed local provider is standalone self-hosted
Redis-compatible Valkey, with no eviction and AOF fsync on every write. Unsupported provider,
eviction, algorithm and key-trust choices refuse with the preserved source value.

The pure key hook receives only an immutable verified subject, and returns 1–256 well-formed UTF-8
bytes without control characters. No address capability is installed: `X-Forwarded-For` never
establishes trust. Old key choices require an explicit product-policy migration; reading does not
rewrite them. Missing/optional sign-in leaves the lead incomplete; callable connections require
the complete lead. Custom and Data access have an optional **admission** slot to it.

The immutable positive Cache reader and Rate limiter cannot share one cache: the reader uses LRU
and admission requires no eviction. Connecting that combination refuses immediately with this
reason. Product `CacheClient.get/set/delete` reject the literal `jeeves:` prefix before dispatch,
so ordinary product handles sharing the limiter resource cannot read/reset generated admission
state. Existing application-owned keys under that prefix require an explicit migration to a
product namespace; regeneration does not rewrite hooks, remap keys or delete stored data.

Admission links require an independent product operation. A Data access used as a template part
(for example a positive reader's loader or Favorites' items) receives no standalone admission
handle and refuses that link. Custom and standalone Data access modules remain supported; use
one of those to compose new-work admission. Saved raw unconsumed part links also refuse export.

RG13 Cache reader offers only **Freshness**, **Exposure** and **Shared cache TTL**. Freshness is
`immutable-positive` (legacy/default) or `versioned`; Exposure is `http` (legacy/default) or
`in-process`. The emitted runtime consumes both choices. Versioned policies must supply a canonical
uint64 decimal version and finite source expiry; cache TTL clamps absolute validity from the start
of the authoritative lookup. Cached hits never renew it. L1, negative caching and other saved
patterns remain schema-readable but unsupported. Both reader modes use the existing LRU store and
therefore require a separate cache from admission. Custom/standalone Data access **read** slots
consume the installed `cache-reader.read@1` contract; parts cannot consume these handles.


HTTP Cache reader exposure on an internal service refuses because no workload-authenticated
template adapter is installed. Select `in-process` and invoke it through an authenticated route
module. Public eligible-record HTTP exposure remains supported.

### Scheduled task (RG16)

A Scheduled task in a Service or Worker has one normal setting: **Interval**, 1–604800 seconds
(default 60). It requires a **state** link to a writable PostgreSQL database and Runnable
processes. Missing state leaves an explicit handler scaffold; incompatible owner/write access
refuses the connection. Worker ownership is declared with **shareOwner**, never inferred from a
shared database or a similar name. Product permissions and credentials remain distinct by role.

No cron, timer callback, retry/fence control or Advanced fields are offered. Missed intervals
coalesce to one current database-time tick, with one unfinished tick per task across copies.
Failed/unknown ticks halt new admission and log that outcome. The generated scaffold keeps
seven-day completed retention, independent of the interval. Changing the interval preserves
unfinished accepted work; changing the handler/version/identity needs explicit migration.

### Webhook receiver (RG17)

The Service-only **Webhook receiver** exposes **Body limit** (`bodyLimitBytes`: string choice `1024`, `16384`, `65536`; default `65536`) and **Signature window** (`replayWindowSeconds`:30–300; default300). Inspector/chat/blueprint and generated receiver limits use these same values. HMAC-SHA256 is the fixed installed protocol; no provider/verifier/ACK/retry setting is offered. The private RG08 ring is configured through a secret file, outside the diagram and product settings. Required user guards refuse this host combination. [Protocol, secret filename and retention](plans/reliable-generation/evidence/rg17/README.md).

### Consumer receipts (RG18)

Event counter exposes **Delivery horizon** (`deliveryHorizonSeconds`:1–604800 seconds; default604800).
The declared maximum includes original delivery, retries, quarantine/operator delay and subsequent delivery together. Generated counter receipts
retain identity for seven days after database-time completion. Dates and aggregation destinations
never scope receipt identity. A repeat with different effect-relevant data conflicts.
Retention, cleanup batches, heartbeat and ACK controls are generated internals, without inspector
fields. A standalone Event consumer can connect optional writable owned **state** and declare a
scoped `receiptConsumer` in its application module; declared retention must cover its delivery
horizon and is at most 30 days. Event counter's seven-day policy is distinct from that public declaration.
See [the emitted extension contract](plans/reliable-generation/evidence/rg18/protocol.md).

### Browser session (RG19)

Service-only **Browser session** requires an **identity** connection and writable owned **state**, with Runnable processes. Normal controls are **Sign-in** (`required`/`optional`, default optional), **Idle expiry** (60–86400s, default86400), **Absolute expiry** (60–604800s, default604800; idle must not exceed absolute), **Guest cookie context** and **Request offline access** (both disabled/enabled, default disabled). Every choice has schema, form, chat, blueprint and emitted consumers. Invalid supplied cookies always401 and clear; cookieless Optional operations stay anonymous. Offline access requests/stores sealed refresh material. Private refresh coordination uses that material when invoked by generated token-availability code; local identity lookup does not trigger refresh. There is no new normal control or public refresh route, and session forwarding uses declared matching-Identity bearer-guard callee operations with independent workload authentication.

Bearer Auth guards, webhook ingress and JWT-only Required-user template combinations (Favorites, Rate limiter, Multipart uploads) refuse on that Service. The selected Keycloak Identity needs trusted HTTPS and exact compiled confidential-client/callback registration; export reports this required integration work, without a production insecure bypass. Secrets/issuer endpoints are private deployment configuration, outside inspector controls. [Protocol and configuration](plans/reliable-generation/evidence/rg19/protocol.md).


RG21 session forwarding binds declared Service calls to generated route-operation handles. Browser session callers require a matching Identity bearer Auth guard on the callee and independent workload slots on both processes. Product routes compose immutable bounded JSON results through the public API; tokens stay private. Only a read can refresh/retry once after a generated user-authentication refusal; POST and uncertain outcomes are never automatically replayed. Finite conditional/request and ETag/Allow/JSON content-type/Retry-After response headers retain the request budget. No new normal setting, arbitrary proxy, background user authority or mutation replay contract is implied. See [the forwarding contract](plans/reliable-generation/evidence/rg21/protocol.md).
