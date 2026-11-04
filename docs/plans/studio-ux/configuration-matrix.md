# Finite configuration and catalog matrix

This is an allowlist for the [studio plan](../../build-plan-studio-ux.md). A field absent from this
document is not permission to expose the entire historical capability/backend schema. Additions
require a demonstrated missing design requirement and an explicit plan change. Do not add controls
merely because an old model has a property or a cloud provider offers a setting.

## 1. Definition contract and inspector rules

Each immutable `studio-<kind>@1.0.0` definition declares its display name, capability icon/color,
classification, allowed creation scopes, settings schema, provider choices, field groups and C4b
integration obligations. It also declares which real relationships/resources it can reference.
Its runtime-support field starts absent; design definitions are not runtime templates.

Generate forms from **explicit field descriptors**, not arbitrary schema reflection. A descriptor
contains path, label, control kind, allowed values/range, applicable conditions and concise help only
when needed. Types and field descriptors must agree. A visible default must resolve to exactly the
value validation/export uses; do not display an optimistic default while storing another value.

The selected object's right inspector has at most **General, Options, Connections** tabs. Hide a
tab when it has no content. With only one tab's content, omit the tab strip. General contains name
and optional purpose, plus relevant execution/language controls. Options contains provider and
technical settings. Connections contains actual dependencies and their creation/navigation actions.
Relationships use their own small General/Options form. Do not display an empty settings report.

All identifiers in persisted settings are machine values from this matrix, not display strings.
`unspecified` is an explicit select option. An omitted optional number/reference is unspecified;
show an empty input with that placeholder, not zero or a claimed provider default. Defaults below
apply on new creation only. Never fill them into older documents on read.

Name (1–120) and purpose (0–240) map to canonical element fields. The inspector shows full text;
the canvas truncates by density rules. An ID, definition version, raw JSON, support matrix, backend
schema and field-by-field explanation are not normal form content. Generate/export can expose
provenance. Do not add credential values, URLs with embedded credentials, account/zone/project IDs,
region lists, infrastructure sizing or secret-name setup forms in this version.

## 2. Application settings

Below, `S` means the selected `architecture.studio.elements[].settings` record. Every kind has its
literal `S.kind`. “Common application” fields apply to service/worker/billing/redirect/notification/
identity. Browser has its separate delivery fields. References are IDs selected from compatible
objects; no free-text paths or guessed cross-service table names.

| Field / stored path | Values and new default | Visibility and effect |
| --- | --- | --- |
| Execution / `S.execution` | `docker` (default), `managed` | Common applications. Records execution intent only. Selecting managed reveals Host; Docker shows no cloud form. |
| Language / `S.language` | `unspecified` (default), `typescript`, `javascript`, `python`, `go`, `java`, `csharp`, `rust` | Common applications. Provider/library constraints are reported in Generate; a language choice promises no template. No framework/version selector yet. |
| Host / `S.host` | `unspecified`, `cloudflare-workers`, `aws`, `google-cloud`, `external` | Only `execution=managed`; default unspecified. Provider identity, no deployment setup. Remove this field when switching back to Docker. |
| Exposure / `S.exposure` | `internal` (default), `public` | service/billing/redirect/notification/identity. Worker omits it. This is network intent, not an authentication or authorization guarantee. Redirect preset defaults public. |
| Delivery / `S.delivery` | `standalone` (default), `bundled` | browser. Represents distribution of browser assets; the browser is not claimed to run in Docker. |
| Served by / `S.servedBy` | optional application element ref | Browser with bundled delivery. Select an actual application, not a package. Unset creates a readiness gap. Does not invent a network call or separate deployment. |
| Hosting provider / `S.provider` | `unspecified` (default), `cloudflare`, `aws`, `google-cloud`, `external` | Browser with standalone delivery. No framework, screen/page or UI-component form. |
| Concurrency / `S.concurrency` | optional integer 1–1024 | worker only. Design setting; no scale/throughput guarantee or replica count. Queue is selected through Connections, not a boolean. |
| Payment provider / `S.provider` | `unspecified` (default), `stripe`, `external` | billing. One Billing service; selecting Stripe does not create adapter/policy/entitlement cards. |
| Lookup store / `S.lookupStoreConnection` | optional connection ref targeting a database | redirect. Display the store name; the helper selects/creates its real service→store dependency atomically. It does not invent a database. |
| Lookup cache / `S.lookupCacheConnection` | optional connection ref targeting a cache | redirect. Same identity-backed rule. No domain, routing-rule, short-code or expiry-policy editor. |
| Delivery provider / `S.provider` | `unspecified` (default), `resend`, `aws-ses`, `external` | notification. Email integration intent; no sender verification, email-template, recipient-rule or preference editors. |
| Identity integration / `S.provider` | `unspecified` (default), `oidc`, `external` | identity. Generic existing-provider integration; no role lists, permission policy, grant editor, login-screen designer or tenant policy. |

`service` is the base Microservice entry, `browser` the Browser app entry and `worker` the Worker
service entry. Billing, Redirect, Notifications and Identity are named presets with the same actual
service deployment semantics plus the listed fields. A plain service can be named Catalog, Orders,
Search API, Recognition or another domain responsibility without gaining a business-language form.

Lookup connection references select the corresponding existing connection; they do not duplicate
its endpoint or protocol/settings. Selecting a resource creates a new dependency only when
none exists and exactly one valid direction exists. If several exist, select the actual one in the
Connections tab. Clearing the shortcut removes the setting but does not silently delete a manually
authored connection. A connection deletion clears its dependent shortcut in the same operation.

For presets comprising multiple services, store the selected common settings on the member services,
not on the package. The package inspector exposes name/purpose, member list and explicit
Add member/Ungroup actions. Do not invent a language/provider setting that applies to all members.

## 3. Resources and external capabilities

Resources can select an optional logical Owner through General; queues require one. Persist that
in the studio binding's `owner`, not inside `S`. It never provisions a database/role/schema. The
selected service's C3 resource picker creates ownership explicitly and can reuse existing resources.

| Kind and capability | Typed settings beyond `kind` | Default / limitations |
| --- | --- | --- |
| `database` / Database | `engine`: unspecified/postgresql/mysql/sqlite/mongodb; `provider`: below | Both unspecified. Engine first, compatible provider second. No tables, entities, field types, queries, migrations, database name, credentials or connection pool tuning in this version. |
| `cache` / Cache | `engine`: unspecified/redis-compatible/memcached; `provider`: below; `ttlSeconds?`: integer 1–604800 | Engine/provider unspecified; TTL absent. TTL is a cache design policy, not user-data retention. No key schemas, invalidation programs or eviction/cluster controls. |
| `queue` / Queue or topic | `mode`: work-queue/topic; `provider`: below; `retentionSeconds?`: integer 60–1209600 | mode work-queue; provider unspecified; retention absent. Queue storage retention is technical, not business retention. Provider feasibility belongs in Generate; never silently clamp a value. No exactly-once checkbox, DLQ automation, event schema editor or retry workflow. |
| `object-store` / Object storage | `provider`: below; `access`: private/public | Provider unspecified, access private. No real bucket creation/name, lifecycle rules, signing-key forms or upload workflow designer. Access records intent; provider integration is C4b. |
| `search` / Search index | `engine`: unspecified/opensearch/elasticsearch/meilisearch/external; `provider`: unspecified/self-hosted/aws/google-cloud/external | Both unspecified. No index fields, query language, analyzer or relevance editor. Provider entries are hosting/integration intent, not assertions of a managed engine combination. |
| `cdn` / CDN | `provider`: unspecified/cloudflare/aws-cloudfront/google-cloud-cdn/external; `origin?`: application or object-store ref | Provider unspecified, origin absent. Select an existing origin; no cache rules, routes, TLS/domain onboarding, zone IDs or WAF controls. |
| `external-api` / External API | `category`: generic/payments/email/identity/recognition/workflow; `provider`: unspecified/cloudflare/aws/google-cloud/external | category generic; provider unspecified. Name can identify the actual vendor. No request builder, response mapping, webhook setup, provider secret or arbitrary provider-specific fields. |

Provider compatibility is a finite catalog table, not a cross-product of every vendor and engine:

| Capability | Initial provider machine values / displayed intent |
| --- | --- |
| PostgreSQL | unspecified, self-hosted, aws, google-cloud, neon, supabase, external |
| MySQL | unspecified, self-hosted, aws, google-cloud, external |
| SQLite | unspecified, self-hosted, cloudflare-d1, external |
| MongoDB | unspecified, self-hosted, external |
| Redis-compatible cache | unspecified, self-hosted, aws, google-cloud, upstash, external |
| Memcached | unspecified, self-hosted, aws, google-cloud, external |
| Queue/topic | unspecified, self-hosted, cloudflare-queues, aws, google-cloud, external |
| Object storage | unspecified, self-hosted, cloudflare-r2, aws-s3, google-cloud-storage, external |

For an unspecified engine, show only unspecified/external provider. A later engine change that
invalidates a selected provider clears it in the same pending edit and visibly resets the field;
it does not silently retain an incompatible hidden value. A provider change cannot mutate the graph,
create resources, change another field's meaning, call the provider or claim working code.

These selections deliberately stop at identity. For example AWS plus a topic does not select SQS
or SNS behind the user's back, and choosing a database/cloud does not choose a region or instance
size. A provider-specific adapter and any required product choice remain C4b/unresolved integration.
Only named products explicitly in this table carry that product identity.

The initial list is based on the requested ecosystems and their primary directories:
[Cloudflare](https://developers.cloudflare.com/directory/), [AWS](https://aws.amazon.com/products/),
[Google Cloud](https://cloud.google.com/products), [Stripe](https://docs.stripe.com/),
[Resend](https://resend.com/docs/introduction), [Neon](https://neon.com/docs),
[Supabase](https://supabase.com/docs), [Upstash](https://upstash.com/docs/redis/overall/getstarted).
It is not a compatibility certification or a recommendation to purchase a service. Adding Azure,
another payment provider or another database later should add finite metadata, not redesign forms.

## 4. Relationships

Creating a connection selects direction, short action and protocol. Existing defaults may suggest
a value, but the user sees the chosen fields before the connection is committed. After creation,
clicking an individual configurable relationship opens the same small form. A trunk with multiple
semantic members opens the member chooser first.

| Field | Persistence / allowed values | Conditions |
| --- | --- | --- |
| Action | canonical label, new UI max 60 characters | Default Calls / Reads & writes / Publishes / Consumes / Uses according to explicit endpoint kinds and channel role. Preserve longer legacy labels; truncate visually without rewriting. |
| Protocol | canonical protocol | New choices: Unspecified, HTTPS, HTTP, gRPC, WebSocket, SSE, SQL, Redis, Messaging, Native binding. No protocol DSL. Existing other protocol strings remain preserved/readable. |
| Interaction | canonical interaction enum | Request / response, Asynchronous, Streaming. Queue links require Asynchronous; do not infer reliability from it. |
| Access | existing planned security field for new planned connections | Service identity, User identity, Public, Private network. Records intent; no authorization guarantee or secret/token editor. |
| Timeout / `settings.timeoutMs?` | integer 1–300000 | HTTP/HTTPS/gRPC request/response only. Missing = unspecified. No text on canvas. |
| Retry / `settings.retry` | `mode`: unspecified/none/fixed; if fixed, `attempts`: 1–10 and `delayMs`: 1–60000 | Same eligible request/response protocols. New default unspecified; attempts count additional attempts. This is a policy request, not proof an unsafe operation is retryable. No retries automatically enabled. |
| Channel role / `settings.channelUse?` | publish/consume | Queue links only, endpoint-validated. Set by the explicit connection action. |

When protocol/interaction makes timeout/retry inapplicable, remove those settings in the same pending
edit. Never retain hidden active policies. Switching back starts unspecified. Existing exact contracts
are preserved and may flag conflicts in Generate; this small editor cannot overwrite them.

A bare context relationship has only its action/name and endpoints, with no transport Options tab.
Selecting a non-editable legacy relation can highlight it without opening a report panel.

`StudioConnectionSettings` is a strict object containing only optional `timeoutMs`, optional
`retry` (a discriminated union by mode) and optional `channelUse`. An empty object is valid for
a relationship with no extra technical settings. Graph validation enforces the applicability
conditions above; the form cannot bypass them. Newly authored relationships remain planned:
use the existing `planned` label/protocol/interaction/security fields and choose the canonical
connection kind from the actual endpoints. No studio connector creates executable wiring.

## 5. Fixed versus editable template content

The following are always excluded from new normal authoring: HTTP route/path/method lists;
request/response/event schemas; entities/fields/aggregate/query definitions; plan/trial/role/limit
tables; lifecycle/state-machine/guard/action/effect/hook editors; data-retention business rules;
arbitrary capacity targets; framework/library version and cloud deployment configuration.

The future template can own those details where appropriate. The user selects a template/preset
and its allowed technical options, then completes unsupported application behavior in C4b. A custom
integration request becomes an explicit goal/implementation obligation; it does not justify a generic
text field that pretends the behavior is implemented. No new free-text C4b-programming inspector is
introduced here. Generate links to the goal/source and lists concise extension obligations.

## 6. Catalog and visual mapping

Library groups: **Services**, **Resources**, **Integrations**, **Presets**, **Examples**. Show only
scope-compatible creation entries. Runtime availability belongs in a compact detail/Generate
summary; avoid a grid full of repeated badges and warnings. Retain access to existing supported
runtime templates within Library's Presets detail, without mixing their status with studio definitions.

Colors distinguish capability families (application, worker, data, messaging, integration); provider
logos are secondary identity marks. Use existing Tabler/maintained assets if available; missing
vendor artwork falls back to the capability symbol. Do not fetch arbitrary logos at render time.
Database cylinder, cache stack, queue stack/channel, person figure and service/browser symbols
remain recognizable without color. Exact colors inherit the app's existing accessible theme.

Every field listed above needs a recorded check: applicable type shows it, irrelevant type does
not, change persists, reload restores the same value, invalid input is rejected, and exports contain
the typed source value. A field that cannot pass that check must not ship as a decorative control.

## 7. Studio grid additions (SG02)

Added by [studio grid plan](../../build-plan-studio-grid.md) §5 (the explicit plan change this
allowlist requires). Model and commands only; the inspector exposure follows in SG09. All new
fields are optional, absent means unspecified, and no default is filled on read, so existing
version-1 studio documents read unchanged. Source: `studio-model.ts`, `studio-components.ts`.

| Where | New optional fields |
| --- | --- |
| service, billing, redirect, notification, identity | `minReplicas` 0–1000, `maxReplicas` 1–1000, `autoscaleOn` cpu/requests-per-second/queue-lag, `requestTimeoutMs` 1–300000, `concurrencyLimit` 1–100000 |
| worker | replicas and `autoscaleOn` as above; its existing `concurrency` remains its limit; no request timeout |
| database | `readReplicas` 0–15, `partitionKey` (one column name) |
| cache | `topology` standalone/cluster, `eviction` lru/lfu/ttl/none |
| queue | `partitions` 1–1024 |
| cdn | `cacheRedirects` disabled/enabled |

Minimum replicas may not exceed maximum; `autoscaleOn` needs a maximum above the minimum.
Descriptors are `studioPerformanceFields`, kept outside `definition.fields` until SG09.

**Components** are `architecture.studio.components[]` (`id`, `host`, `name`, optional
`description`, `settings`) and `architecture.studio.componentConnections[]` (`id`, `from`,
`to: {kind: component, id} | {kind: element, id, via}`, optional `label`). Settings:

| Kind | Settings (creation default first) |
| --- | --- |
| `rate-limiter` | `algorithm` token-bucket/sliding-window; `limit?`; `windowSeconds?`; `key` ip/api-key/user; `store` memory/redis |
| `cache-reader` | `pattern` cache-aside/read-through; `l1MaxEntries?` (absent = no L1); `l1TtlSeconds?` (needs L1 size); `l2TtlSeconds?`; `negativeTtlSeconds?` (absent = off); `stampede` none/single-flight |
| `id-generator` | `strategy` db-sequence/redis-counter/range-allocation/snowflake/random; `blockSize?` (range allocation only); `encoding` base62/base58/base36/decimal; `minLength?` |
| `redirect-responder` | `status` 302/301/307; `edgeMaxAgeSeconds?` |
| `event-publisher` | `batchSize?`; `lingerMs?`; `outbox` disabled/enabled |
| `event-consumer` | `concurrency?`; `batchSize?`; `retryLimit?`; `deadLetterQueue?` (a queue other than the source) |
| `data-access` | `poolSize?`; `readRouting` primary/replica; `statementTimeoutMs?` |
| `auth-guard` | `credential` jwt/api-key/session |
| `external-call` | `circuitBreaker` disabled/enabled. Timeout/retry stay on the traced connection (§4). |
| `custom` | none; its `description` is the stub purpose |

Structural rules (batch rejected): the host is a studio-bound application (browser apps host only
auth guard, external call and custom); a component-to-component link stays inside one host; an
element link names an allowed target kind and a `via` connection joining host and target directly;
publisher/consumer queue links trace a publish/consume connection; identities are unique across the
design. Readiness gaps (`CONFIG_REQUIRED`, saved): a required dependency is missing (cache reader →
cache, data access → database, publisher → queue, consumer → queue, Redis rate limiter → cache,
sequence/range ID → database, Redis counter → cache, outbox → database, external call → target),
replica read routing without a replicated database, and a custom component without a purpose.
Deleting a host removes its components; deleting a traced connection or target removes the links.

