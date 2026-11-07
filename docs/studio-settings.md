# Studio settings

This is the allowlist of everything the studio lets you configure. A field that is not listed
here is not exposed. Add one only for a demonstrated design need, with its schema, form field,
validation and blueprint output together; do not add controls because a cloud provider or an old
model has a property. The source of truth is
[`studio-model.ts`](../packages/spec/src/studio-model.ts),
[`studio-components.ts`](../packages/spec/src/studio-components.ts) and the field descriptors in
[`studio-definitions.ts`](../packages/spec/src/studio-definitions.ts).

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
- Name (1–120 characters) and purpose (0–240) are the element's own fields.
- No credentials, URLs with credentials, account/zone/project IDs, regions, instance sizes or
  secret names.
- Selecting a provider changes no other field's meaning, creates no box, calls nothing and claims
  no working code.

## Profile and persistent requirements

The header's **Profile & requirements** form edits top-level `scope` on stored schema v3,
using `design-scope.ts`. Legacy schema v2 opens with unspecified declarations and changes only
after **Preview requirements → Upgrade & save requirements**. The upgrade and requirements
save form one Undo step; existing tiles, settings and inferred ownership do not change.

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
into contracts. Profile selection supplies no ownership/API/message contract, template manifest or runtime. Explicit ownership declarations have their own editor below.
Chat's `configureDesignScope` shares the mouse command and validation; RF04
`declareReviewScope` remains turn-only metadata. See [blueprint](studio-blueprint.md).

## Applications

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
Microservice and Worker service: ordinary service semantics plus the fields above. Gateway is the API tile's
default kind. Browser app stays in the format but no tile type offers it. A plain service can be
named Catalog or Orders without gaining a business-rule form.

### Languages

Each coded kind offers two languages, its default first; any other value is refused (`Choose
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
gateway's language is dropped. Commands and the inspector still refuse such values.

### Defaults

A new tile and `changeKind` start from the kind's defaults (`createStudioSettings`). The
preconfigured kinds name their usual provider; every other choice stays selectable:

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
| `queue` | `mode` work-queue / topic; `provider` unspecified / self-hosted / aws / google-cloud / cloudflare-queues / external; `retentionSeconds?` 60–1209600 | exactly-once, DLQ automation, event schemas |
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
| Interaction | Request / response, Asynchronous, Streaming | Queue links are Asynchronous. Asynchronous dashes the line and is accepted only where the [link table](../CATALOG.md#lanes-and-links) has an async mode; Streaming counts as a request. |
| Security / `planned.security` | Service identity, User identity, Public, Private network | Intent only. |
| Timeout / `settings.timeoutMs?` | 1–300000 | HTTP, HTTPS or gRPC request/response only. |
| Retry / `settings.retry` | `mode` unspecified / none / fixed; fixed adds `attempts` 1–10 and `delayMs` 1–60000 | Same protocols. Attempts are additional attempts. |
| Channel role / `settings.channelUse?` | publish / consume | Queue links only; set by the connection's direction. |

When a protocol or interaction change makes timeout or retry inapplicable, they are removed in
the same edit. A C1 relationship has only its action and endpoints.

**One writer per store.** A link into a database, search index, cache or object storage *writes*
when it comes from the store's owner (the resource's **Owner**, or a member of the owning package)
and *reads* otherwise; a store with no owner is only read. This is derived, never stored: the line
inspector shows "Writes (owner)" or "Reads" as **Access (inferred)**; the store inspector lists
**Owner** and **Other readers**,
and the [blueprint](studio-blueprint.md) gives the connection `access: "write" | "read"`.
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
[catalog](../CATALOG.md#lanes-and-links). A design stored with an entry in `both` lanes
(possible for a while) loads with that entry in `download`.

## Components

Components are `architecture.studio.components[]` (`id`, `host`, `name`, optional `description`,
`settings`) and `componentConnections[]` (`id`, `from`, `to: {kind: component, id} | {kind:
element, id, via}`, optional `label`). In the studio they are a tile's modules, edited in its
inspector: a new one starts with the defaults below and its kind's name, and Purpose is its
`description`.

| Kind | Settings (default first) |
| --- | --- |
| `rate-limiter` | `algorithm` token-bucket / sliding-window; `limit?`; `windowSeconds?`; `key` ip / api-key / user; `store` memory / redis |
| `cache-reader` | `pattern` cache-aside / read-through; `l1MaxEntries?` (absent = no L1); `l1TtlSeconds?` (needs L1 size); `l2TtlSeconds?`; `negativeTtlSeconds?` (absent = off); `stampede` none / single-flight |
| `id-generator` | `strategy` db-sequence / redis-counter / range-allocation / snowflake / random; `blockSize?` (range allocation only); `encoding` base62 / base58 / base36 / decimal; `minLength?` |
| `redirect-responder` | `status` 302 / 301 / 307; `edgeMaxAgeSeconds?` |
| `event-publisher` | `batchSize?`; `lingerMs?`; `outbox` disabled / enabled |
| `event-consumer` | `concurrency?`; `batchSize?`; `retryLimit?`; `deadLetterQueue?` (a queue other than the source) |
| `data-access` | `poolSize?`; `readRouting` primary / replica; `statementTimeoutMs?` |
| `auth-guard` | `credential` jwt / api-key / session |
| `external-call` | `circuitBreaker` disabled / enabled; timeout and retry stay on the traced connection |
| `custom` | none; its `description` is its one-line purpose |

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

**Ownership & access** in the inspector edits optional top-level `ownership` using `ownership.ts`.
Absence means unspecified; reading never upgrades or derives declarations. Preview the complete
change before **Upgrade & save ownership** (v2) or **Save ownership** (v3). The preview switches
to its report and lists each changed/removed binding and grant. A stale preview cannot save.

| Field | Finite values / limits |
| --- | --- |
| `owners[]` | Up to 50 distinct `{id, name}` records. Slug ID, trimmed name 1–120 chars. Logical responsibility, independent of studio packages. |
| `roles[]` | Up to 500 distinct existing application element IDs: `{element, owner, kind: api/worker, deployable?}`. Owner must be declared; optional deployable is a slug assignment, supplies no permission and implies no running process. |
| `resources[]` | Up to 500 distinct existing database/cache/storage/search element IDs: `{element, authority, kind: source}` or `{element, authority, kind: projection, source}`. Authority is a declared logical owner. A projection names a different declared source resource, with its own authority; projection chains/self references refuse. Population/freshness/failure behavior remains unresolved unless the exact compatible positive-cache contract below refines this specific projection. |
| `grants[]` | Up to 500 distinct role/resource pairs: `{role, resource, access: read/write/read-write, boundary?: published-read}`. Both endpoints need declarations. This records permission intent, not an implemented ACL. |
| `dependencies[]` | Up to 500 distinct canonical application → store connection IDs: `{connection, access: read/write/read-write}`. The actual endpoints determine the role/resource; labels do not. |

A same-owner read stays read. Cache read and fill needs read-write; a read-only grant cannot
satisfy it. A request exceeding a declared grant refuses atomically. Foreign-owner direct writes
refuse even when deployables match. Cross-owner reads need an explicit `published-read` contract
boundary or a reader-owned projection. The marker has targeted unresolved published-contract,
freshness/failure and runtime-authorization findings; it supplies no API bypass or runtime proof.
Missing legacy declarations/grants remain saveable readiness gaps, never inferred permission.

The form clears dependent grants/requests when an owner, role or authority is removed/transferred
in its draft, then previews every affected row. Complete chat replacements must explicitly retain
or remove those rows; contradictions refuse. Canonical tile deletion cleans its role/authority,
grants and removed-edge requests; removing a source used by a surviving projection refuses.
Relationship removal drops its request and retains the independent role grant. One Undo restores
all declarations; unrelated persistent custom requirements survive, including missing targets.

The old binding `owner` and connection `access` remain the **legacy inferred writer/access**
approximation above. They are separate from explicit authority/grants and remain unchanged by
ownership configuration. Exact operation bindings have their own editor below; runtime authorization remains unavailable.

Legacy topology warnings still describe the inferred writer approximation. Targeted
`ownershipFindings` check the explicit declarations; neither proves runtime authorization.


## Exact operation contracts (schema v3)

**Operation contracts** in the inspector edits the optional top-level `operations` allowlist.
Choose a finite operation and canonical API role. Create uses its authoritative database read-write
connection and explicit 24-hour successful-key retention. Resolve uses its source primary read
and positive-cache read-and-fill connections plus the pinned policy. Both bind existing
entry/service callers. Receiver/call IDs are separate stable binding identities. There is no
route/schema/policy editor, auth verifier implementation or arbitrary configuration map. Its
retained-result lookup and unknown-outcome reconciliation require explicit read-write dependency
and role grant; old write-only declarations remain unchanged with a targeted missing-read gap.
The inspector's [Compatibility report](studio-readiness.md) is view-only and adds no setting.

Use **Preview operations** before **Save operations** (or explicit **Upgrade & save operations**
from v2). It shows named changes, exact ref details and targeted unresolved/refused findings.
The fixed operation and existing receiver/connection timeout promises must agree; edit a legacy
API timeout explicitly through **Options → Request timeout**. The form never rewrites it.
Unknown refs remain unresolved and retained. Missing verifier is unavailable independently of
the known auth requirement. Known contradictory schema/auth/idempotency/deadline or foreign write
intent refuses atomically. One Undo restores the whole declaration; stale previews refuse.

**Details & bindings** selects one `operation:<binding-id>` for chat, distinct from its parent
role/owner. Generic configuration does not select one. Removal/transfer previews include exact
dependent operation clears. See [finite operation contracts](studio-contracts.md) for the complete
field shapes, hashing, normalization, idempotency, allocation and error semantics. V3 retains all
rows/findings; default v2 refuses their exact paths. Templates/runtime verification remain none.


The tagged receiver binding is either the unchanged NC03
`{kind:"create-link",storeConnection,successRetentionHours:null|24,authVerifier:null|exactRef}`
or NC04 `{kind:"resolve-link",storeConnection,cacheConnection:null|id,cachePolicy:null|exactRef}`.
Resolve's only known policy is Positive cache · clamp to record expiry v1. Null is unspecified.
The form selects both canonical connections, declares/clears the pinned policy and exposes its
exact ID/version/hash for inspection or an unresolved future reference. No numeric policy DSL,
route/schema editor or new generic connection settings are added. Resolve's exact deadline is
1200 ms; Create retains 10000 ms. A shared role can leave the optional global request timeout empty
to retain each operation deadline. Explicit global/caller deadline conflicts refuse. All-outcome
no-store, primary routing, cache read-write grants, TTL maximums and applicable typed module/CDN
contradictions are checked. [Complete policy and bounds](studio-contracts.md#resolve-link-v1-and-positive-cache-v1).
