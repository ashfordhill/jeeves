# Jeeves building-block catalog

Use this catalog to compose applications from reusable responsibilities. Start with
a [C1 offering](#c1-system-offerings), follow its links to shared
[C2 containers](#c2-shared-containers-and-capabilities), then choose the
[C3 components](#c3-shared-components) inside those containers. The same component
type can serve several systems; its configured instances belong to their own
containers. [C4](#c4-implementation-and-verification) connects these choices to
code, libraries and verification without making every implementation detail a
diagram option.

Jeeves is an engineering tool. Its diagrams express boundaries, responsibilities,
contracts and requirements. The application engineer still owns domain behavior,
data choices and the quality of custom implementation.

For modeling and contribution rules, read [C4 modeling guidance](docs/c4-modeling.md).
Families are reusable starting points, not an exhaustive list of permitted architectures.
An instance needs meaningful interfaces and dependencies; adding a family name alone does
not establish a complete design. The [direction review](docs/reviews/c4-direction-review-2026-10-31.md)
identifies the next contract/composition work. The [P46–P57 roadmap](docs/build-plan-c4-evolution.md)
specifies the next work, including reusable architecture templates. [P46 evidence](docs/evidence/p46/README.md), [P47 evidence](docs/evidence/p47/README.md), [P48 evidence](docs/evidence/p48/README.md), [P49 evidence](docs/evidence/p49/README.md), [P50 evidence](docs/evidence/p50/README.md), [P51 evidence](docs/evidence/p51/README.md) [P52 evidence](docs/evidence/p52/README.md) and [P53 evidence](docs/evidence/p53/README.md) record the implemented authoring changes; all new runtime capabilities remain planned.

P55 adds **Saved architecture templates** in the Library: save a C3 responsibility or
C2 composition as a reviewed local draft, publish immutable architecture-only versions,
and preview insertion with named required roles, exact interfaces and policy guarantees.
Instances have independent identities and pinned source content/version; v2 publication,
local customization and retirement preserve existing consumers. Runtime-owned source shapes
require explicit portable planned contracts. No executable availability or verification is
added. See the [local library contract](docs/architecture-library.md) and
[P55 evidence](docs/evidence/p55/README.md).

P53 adds **Deployment plans** in Editor actions: alternative hosted/private environments,
nested placement boundaries, declared container replicas and infrastructure operation ownership.
Instances reference logical C2 applications/stores; named queues/topics stay separate on a
broker, and external providers retain their boundary. Interactions trace existing relationships
or explicitly declare deployment-only infrastructure wiring. A reviewed legacy mapping preserves
its C2 identity and direction. Layout is independent, and declarations supply no capacity,
failover or runtime evidence. P33's supported local arrangement remains derived and read-only.
See the [deployment contract](docs/architecture-deployments.md) and
[example](fixtures/designs/architecture-deployments.json). No runtime availability changes.

P52 adds **planning targets** from any saved design: an immutable baseline, a separate editable
model, stable-identity changes and source drift. Protected recipe copies retain constraints;
a conceptual replacement requires an explicit planning reason and keeps the original baseline.
Explicit auth/resource/extension bindings can suggest editable C1/C3 annotations with provenance.
Targets inherit no output ownership, generation/run history or verification evidence; their
APIs refuse generation and runs. No new catalog family or executable availability is added.
See the [workspace contract](docs/architecture-targets.md).

P46 adds independent **system choices** (business tenancy, authorization intent, data
isolation and delivery model) through Edit context or system inspection. C1 shows only the
tenant audience. Existing combined tenancy settings remain labeled legacy intent; they do
not populate the new choices. Container inspection also records classification, responsibility
ownership and operation independently of runtime compatibility. An externally operated store
can remain inside the system; an owned telemetry collector can be an application. These are
saved design declarations, not implemented access or deployment policies.

P47 adds **Manage interfaces** to component, container and external-system inspection.
Project-local definitions describe planned API/in-process operations, event payloads and
logical datasets; instances provide or require an exact contract version. Definitions can
also reference existing REST/resource or durable-event members with read-only authoritative
shapes and visible source staleness. Renames preserve references; changing an in-use shape
requires an explicit new version and a preview of instance updates. Unresolved drafts and
required-but-unbound interfaces remain saveable design review. These declarations add no
runtime wiring. See [P47 evidence](docs/evidence/p47/README.md).

P48 adds **Manage relationship contracts** to C2 connections and local C3 relationships.
Several exact-version interface bindings can share a connection; cross-container C3 uses
trace through that same C2 identity. Request, publish, consume, callback, read and write
roles stay separate from transport and business synchrony. Optional policy groups describe
identity/tenant scope, timeout/failure, retries/idempotency, delivery/acknowledgement and
freshness/invalidation. Private reachability never supplies caller identity.

**Data responsibilities and objectives** in Editor actions assigns logical dataset authority,
store, readers/writers and tenant/lifecycle/export policy to an exact data contract, including
an existing resource reference. Shared authority requires an explicit decision. Scoped workload
and service objectives carry a value, unit, measurement boundary and window. Unknown choices
and selected version/policy conflicts remain visible design review; malformed references are
rejected. These are unverified declarations with no new runtime or generation behavior.
See [P48 evidence](docs/evidence/p48/README.md) and the [policy example](fixtures/designs/relationship-policies.json).

P49 adds **named focused C2 views** beside the whole-system board. Choose selected flow
members and optionally their immediate dependencies. Every view keeps the system boundary
and a count/link to hidden relationships. Positions, direction and camera persist by stable
view/object identity in layout storage; mouse drag/nudge, Fit selected, Reset layout and
Undo/Redo layout do not change semantic revision. C1 and scoped C3 use the same persistence.
Relationship labels summarize contract counts; selection expands exact names and versions.
QRWTY defaults expose management, redirect and analytics separately. See [P49 evidence](docs/evidence/p49/README.md).

P50 adds **Patterns** in the Architecture library: tenant workspace/access, billing and
entitlements, cached public lookup with update/disable propagation, and asynchronous work
delivery. Delivery has separate best-effort and transactional-outbox variants. Preview host,
boundary and responsibility choices, exact contracts, policies and additions before applying
one undoable edit. Unique compatible hosts resolve automatically; ambiguous hosts require a
choice. Component/channel reuse requires explicit pinned role, ownership, contract and policy
matches, preserving existing customizations. Different business channels remain distinct.

Outbox intent requires atomic domain/event persistence and a delivery responsibility; a queue
and handler cannot establish it. Saved compositions retain pinned historical provenance and
required invariants. These editable patterns supply no runtime implementation or observed
guarantees. See the [fragment/reuse contract](docs/architecture-patterns.md) and
[P50 evidence](docs/evidence/p50/README.md).

P51 adds **Architecture review and decisions** in Editor actions and Findings. Findings group
selected contract, access/authority, cache, delivery/failure and objective concerns with their
assumptions and linked inputs. Optional typed requirements name applicable access boundaries,
cache fallback/update bindings, channel/schedule/request responsibility and required failure
outcomes. Existing editors and relevant pattern previews remain directly reachable.

Decisions retain context, reason, consequence, status and linked identities. Accepted scoped
tradeoffs remain visible and expire when relevant inputs change. Contradictions still prevent
review completion; unresolved findings/decisions remain saveable. Review is separate from
structural validity, Generate and runtime evidence. Mouse/chat share the validator and revision
protection. See the [review contract](docs/architecture-review.md) and
[P51 evidence](docs/evidence/p51/README.md). P52 linked current/target workspaces are next.

## Availability and reuse

| Label | What it means |
| --- | --- |
| Implemented | An existing registered template supplies behavior within its documented supported shape. Current design validation, pinned versions and verification still apply. |
| Editable starter | A reusable initial composition copied into a new project; its resources and architecture can be changed. |
| Product recipe | A composition with reviewed domain implementation and protected acceptance supplied by the recipe. |
| Planned | A block with editable design options or an architecture example. It has no runtime implementation or capacity proof. It prevents generation until the unsupported intent is resolved. |

**Library** exposes implemented templates and planned blocks. Its **Architecture
examples** tab creates separate editable planning projects. **New project** also
offers the existing resource starter and product recipe. The library is not a
claim that every possible combination is compatible. Unsupported attachments and
connections retain their existing validation.

The design assistant can use the same planned C2/C3 families and options to sketch
context, containers and responsibilities from a brief. Chat edits use the shared
validation and one undo step per turn. Planned choices keep their availability
label and generation block; see [P44 evidence](docs/evidence/p44/README.md).

Dynamic scenarios reference existing context/C2/C3 relationships, with actor/start conditions,
main and named alternative/failure paths, expected outcomes/invariants linked to requirements
and decisions, and client feature states coupled to exact bindings and operations. Mouse editing,
history and scripted chat share validation. Expectation reviews become stale when relevant
contracts change; they are authored design agreement, never test results. Legacy P45 scenarios
remain lossless and explicitly incomplete. See the [scenario contract](docs/architecture-scenarios.md)
and [P54 evidence](docs/evidence/p54/README.md). Runtime availability is unchanged.

C1 offerings below are compositions, not separate runtime templates.
Optional SaaS extensions reuse [entitlements](#c3-entitlements), [data lifecycle](#c3-lifecycle), [custom domains](#c3-domains), [abuse handling](#c3-abuse), [organizations](#c3-organizations), [billing](#c3-billing),
[developer access](#c3-developer), [notifications](#c3-notifications),
[reports](#c3-reports), [audit](#c3-audit) and [client features](#c3-screens).
The examples demonstrate selected choices; their blocks remain planned. A component
such as accounts, moderation or analytics can be reused under several C1 offerings
through an appropriate C2 host. Reuse does not require those applications to share
one deployed service or database.

## C1 system offerings

### Resource workspace

**Editable starter.** A signed-in user manages owned records and related records
through a web interface. Suitable for small administrative products, trackers and
internal tools whose main behavior is resource management.

- C2: [web client](#c2-web), [application API](#c2-application),
  [relational store](#c2-data).
- C3: [accounts and access](#c3-accounts), [resource operations](#c3-resources),
  [resource screens and API adapter](#c3-client).
- Start with the [resource workspace starter](starters/README.md).

### QR Studio

**Product recipe, experimental.** An owner manages links and QR artwork; a visitor
follows a stable redirect to a destination website. The recipe supplies specific
QR behavior and its own acceptance. It is one example of composing general web,
API and data capabilities with a domain implementation.

- C2: [web client](#c2-web), [application API](#c2-application),
  [relational store](#c2-data).
- C3: [accounts](#c3-accounts), [resource operations](#c3-resources),
  [domain extensions](#c3-domain), [media processing](#c3-media),
  [analytics](#c3-analytics).
- See the [recipe catalog and boundaries](recipes/README.md). Its supplied QR
  handlers do not make the generic planned media or analytics blocks implemented.

### QRWTY target architecture

**Planned architecture example and composition workshop.** A separate editable hosted-first
QR SaaS target with six scenario families, exact versioned contracts and linked policies/data.
No live QRWTY project or QR Studio recipe behavior changes.

- C2: owner/staff [web clients](#c2-web), management API and separately scaled public
  [redirect application](#c2-application), [relational authority](#c2-data),
  [lookup cache](#c2-cache), [artwork/export objects](#c2-storage), named
  [visit channel](#c2-messaging), [background worker](#c2-worker), external payment,
  e-mail, DNS/certificate providers and developer integration. Analytical storage and
  private delivery remain optional growth decisions, absent from the baseline topology.
- C3: [tenant access](#c3-organizations), stable links, encoded payloads and hosted content
  as distinct [domain responsibilities](#c3-domain), [artwork](#c3-media),
  [billing and entitlements](#c3-billing), [custom domains](#c3-domains),
  [abuse](#c3-abuse), [audit](#c3-audit), reporting/data lifecycle and
  corresponding [client feature areas](#c3-screens), including Studio and staff support.
- [Study, staged mouse assembly and trace table](docs/examples/qrwty-target.md).
  [P56 evidence](docs/evidence/p56/README.md) separates structural/scenario intent,
  unresolved production objectives, template availability and runtime verification.
  The thirteen logical blocks remain planned and block generation.

### Inventory architecture reuse study

**Planned architecture composition exercise.** A five-block non-QR study reuses the same
[tenant access](#c3-organizations) and [asynchronous delivery patterns](docs/architecture-patterns.md),
with transactional outbox intent for authoritative stock changes. Required local template
versions can also be saved before product specialization and inserted through exact compatible
role/interface bindings. Informational best-effort notifications remain distinct from durable stock work.

- [Mouse/chat assembly, reuse and boundaries](docs/examples/inventory-architecture.md).
- This is separate from the executable Resource workspace starter and the Inventory template
  acceptance fixture. It supplies no stock runtime or additional generation capability.

### Links and QR platform

**Planned architecture example.** Owners manage links and artwork; visitors follow
links. Management, redirect traffic and analytics processing can have different
workload requirements. This broader example is independent of the QR Studio recipe.

- C2: [web client](#c2-web), [application API](#c2-application) and a separately
  scoped redirect service, [data](#c2-data), [cache](#c2-cache),
  [object storage](#c2-storage), [queue](#c2-messaging), [worker](#c2-worker).
- C3: [accounts](#c3-accounts), [domain operations](#c3-domain),
  [media processing](#c3-media), [analytics](#c3-analytics).
- Also includes [identity and billing](#c2-integrations), e-mail
  [delivery](#c2-third-party), [edge delivery](#c2-edge) and
  [observability](#c2-integrations). [Client feature areas](#c3-screens),
  [billing](#c3-billing) and [notifications](#c3-notifications) are editable responsibilities.
  [Serverless functions](#c2-serverless) and [analytical storage](#c2-analytics-store)
  remain optional extensions; the [QRWTY target](#qrwty-target-architecture) demonstrates
  analytical storage in a broader SaaS design.

### Community and discussion

**Planned architecture example.** Members publish posts and comments, browse
communities and report content; moderators review it. Discovery and notifications
have distinct responsibilities from storing the discussion itself.

- C2: [web client](#c2-web), [application API](#c2-application),
  [data](#c2-data), [cache](#c2-cache), [search](#c2-search),
  [object storage](#c2-storage), [queue](#c2-messaging), [worker](#c2-worker),
  [notifications](#c2-integrations).
- C3: [accounts](#c3-accounts), [domain operations](#c3-domain),
  [moderation](#c3-moderation), [media processing](#c3-media).
- Also includes [identity and billing](#c2-integrations), e-mail
  [delivery](#c2-third-party), [CDN](#c2-edge) and [observability](#c2-integrations),
  with client and subscription-delivery responsibilities.
- Reuses the same client, persistence, access and processing families as the
  [links platform](#links-and-qr-platform); posts need their own domain contracts.

### Social and content platform

**Planned architecture example.** Members publish content, maintain profiles and
relationships, discover a feed and receive live activity. Independent clients can
use the same domain services. This is a generic design study, not a reproduction
of a particular company's architecture.

- C2: [web/mobile clients](#c2-web), [application API](#c2-application),
  [realtime delivery](#c2-realtime), [data](#c2-data), [cache](#c2-cache),
  [search](#c2-search), [object storage](#c2-storage),
  [queue](#c2-messaging), [worker](#c2-worker).
- C3: [accounts](#c3-accounts), [domain operations](#c3-domain),
  [feeds](#c3-feeds), [moderation](#c3-moderation), [media processing](#c3-media).
- Also includes [identity and billing](#c2-integrations), e-mail
  [delivery](#c2-third-party), [CDN](#c2-edge) and [observability](#c2-integrations),
  plus [mobile API](#c3-facade) and [offline state](#c3-offline).
- Reuses discussion and media concepts from the
  [community offering](#community-and-discussion) without requiring the same data
  model, ranking policy or implementation.

## C2 shared containers and capabilities

C2 shows logical applications, workers and data stores within the system, with external
software systems as supporting dependencies. Managed hosting does not determine whether
something is a container or an external system. Some existing Jeeves templates attach a
capability or execution policy to a container; those attachments are not automatically
separate deployable containers. Instances, regions and load-balancer placement belong in
deployment views.

<a id="c2-web"></a>
### Clients

| Offering | Availability and responsibility | C3 choices / reuse |
| --- | --- | --- |
| Web application | Implemented `web-app`; also a planned web block with customer/staff/both audience and single-page/server-rendered/static marketing kind, alongside rendering/access choices. | [Implemented adapter/screens](#c3-client), planned [screen groups](#c3-screens), [sessions](#c3-session) and [API facade](#c3-facade); all C1 offerings. |
| Mobile application | Planned client with platform and offline intent. | [Client features](#c3-screens), [sessions](#c3-session), [API facade](#c3-facade), [offline sync](#c3-offline) and shared [accounts](#c3-accounts); [social](#social-and-content-platform) or any system needing a mobile client. |
| Desktop application | Planned desktop client with platform/update intent. | [Client features](#c3-screens), [sessions](#c3-session), [API facade](#c3-facade) and [offline sync](#c3-offline); can front a [resource workspace](#resource-workspace). |

<a id="c2-application"></a>
### Application API

Implemented `http-service` hosts application capabilities; `rest-api-server`
supplies a REST boundary. The planned application API block also expresses broader
interface, tenancy and availability choices. A planned GraphQL or RPC choice does
not turn the REST template into that implementation.

Hosts [SaaS responsibilities](#c3-integration) such as [billing](#c3-billing),
[organizations](#c3-organizations), [developer access](#c3-developer),
[notifications](#c3-notifications), [reports](#c3-reports), [audit](#c3-audit),
[accounts](#c3-accounts), [resources](#c3-resources),
[domain operations](#c3-domain), [feeds](#c3-feeds),
[moderation](#c3-moderation), [analytics](#c3-analytics) and
[media processing](#c3-media). Used by every current C1 offering. Several domain
components can share one API; a small application does not need a service per
component.

<a id="c2-worker"></a>
### Background processing

The **background worker** is planned: trigger, concurrency and delivery intent for
work outside the request path. It can host [domain jobs](#c3-domain),
[media processing](#c3-media), [moderation](#c3-moderation) and
[analytics](#c3-analytics), plus planned [event handlers](#c3-events),
[scheduled jobs](#c3-schedules), [indexing](#c3-indexing), [reports](#c3-reports)
and [notifications](#c3-notifications). Used by the links, community and social examples;
the [QRWTY target](#qrwty-target-architecture) also composes teams, developer access and reporting.

<a id="c2-serverless"></a>
The **serverless function** is a planned worker boundary for bounded HTTP-, queue-,
schedule- or storage-triggered work, with timeout and cold-start tolerance targets.
It can reuse the same [domain jobs](#c3-domain), [media](#c3-media) and
[analytics](#c3-analytics) responsibilities in links, community or social systems.
These targets do not provision a function platform or verify its latency.

The implemented [`durable-events`](templates/durable-events/README.md) attachment
supplies a bounded event mechanism inside a compatible HTTP service. It is a
different deployment shape from a separate planned worker or general queue broker.

<a id="c2-realtime"></a>
### Realtime delivery

**Planned realtime service.** Connection, fan-out and reconnect intent for live
updates. Used by the [social offering](#social-and-content-platform); also reusable
for collaborative resource applications. Domain authorization and event meaning
remain in the responsible [application components](#c3-domain).

<a id="c2-data"></a>
### Durable data

| Offering | Availability and responsibility | Reuse |
| --- | --- | --- |
| PostgreSQL | Implemented `postgres`: relational storage for supported consumers. | [Accounts](#c3-accounts), [resources](#c3-resources) and domain data across all current C1 offerings. |
| Relational database | Planned family/topology/isolation/recovery choices. Replicas and sharding are design declarations. | Same domain families; a high write target does not automatically imply sharding. |
| Document database | Planned document, partitioning and consistency intent. | Domain data where aggregate/document access patterns justify it; no supplied implementation. |

<a id="c2-analytics-store"></a>
### Analytics store / warehouse

**Planned data store.** Columnar warehouse, time-series or data-lake intent, with
streaming/micro-batch/nightly loading, retention and internal-dashboard or
customer-report access choices. Reusable by [analytics components](#c3-analytics)
in the [links](#links-and-qr-platform), [community](#community-and-discussion) and
[social](#social-and-content-platform) offerings. [Workers](#c2-worker) can load it
from [events](#c2-messaging); transactional [data](#c2-data) retains its own boundary.
This is analytical storage, separate from an external analytics vendor.

<a id="c2-cache"></a>
### Cache

**Planned distributed cache.** Freshness, invalidation and failure behavior for
derived or frequently read data. Reused by links, community and social examples;
[domain components](#c3-domain), [feeds](#c3-feeds) and [analytics](#c3-analytics)
must identify which reads may be cached. A cache is not the source of truth by
default and does not remove correctness obligations.

<a id="c2-storage"></a>
### Object storage

**Planned object storage.** Access, versioning and retention intent for files and
media. Shared by [media components](#c3-media) in links, community and social
systems. A product-specific QR image is one possible object, not a distinct
infrastructure template.

<a id="c2-search"></a>
### Search

**Planned search index.** Indexing and freshness intent for discovery. Community
and social systems can reuse this boundary with different documents and ranking.
[Search components](#c3-indexing) build/query the index;
[domain components](#c3-domain) own the authoritative records and access rules.

<a id="c2-messaging"></a>
### Queues and streams

**Planned job queue** and **planned event stream** express distinct work-delivery
and event-distribution responsibilities. Ordering, retries and retention are
explicit choices. They connect [application APIs](#c2-application) with
[workers](#c2-worker) or other consumers in the three planned examples. The
implemented in-service [durable events](#c2-worker) capability is available for its
documented supported shape, not a substitute for every broker topology. Model named logical
queues/topics or named channels on relationships at C2; broker instances and clusters belong
in deployment. Reuse channels by contract, ownership and delivery requirements, not merely
because two blocks have the same family.

<a id="c2-traffic"></a>
### Traffic routing and execution

| Offering | Availability and boundary | Reuse |
| --- | --- | --- |
| API gateway | Planned routing, identity boundary and rate-policy intent. | Public application APIs across C1 offerings. |
| Load balancer | Planned routing, instance and readiness intent. | Distributes traffic across instances of one logical C2 service. Explicitly mapped to planned infrastructure after reviewing placement responsibility; its source C2 identity and relationships remain intact. |
| Local HTTP pool | Implemented attachment for a restricted generated resource API; [documented limits](templates/local-http-pool/README.md). | Multiple local instances, with shared data; not arbitrary-service or host failover. |
| Local execution policy | Implemented finite resource/restart/shutdown choices; [documented limits](templates/local-execution/README.md). | Compatible HTTP services; resource ceilings do not establish throughput. |

Start with the shape the application requires. [Workload targets](#workload-intent)
may justify distribution later; a “high traffic” selection never proves capacity.

<a id="c2-edge"></a>
### Edge delivery and protection

**Planned CDN and edge protection.** Public-content caching, TLS and abuse-policy
intent. Reusable by any public client/API, especially media delivery and link
traffic. Private responses and application authorization need explicit handling.

<a id="c2-integrations"></a>
### Shared and external services

| Offering | Availability and responsibility | Related C3 / C1 |
| --- | --- | --- |
| <a id="c2-third-party"></a>Third-party service | Planned generic external boundary: payment, e-mail, SMS, push, maps, analytics vendor, CRM/support, AI API or other provider. Records authentication method, inbound webhooks, data shared and behavior when unavailable. | [Integration adapters](#c3-integration), [notifications](#c3-notifications), [developer webhooks](#c3-developer), [media](#c3-media) and [analytics](#c3-analytics) across C1 offerings; distinct from the specialized billing and identity blocks below. |
| Identity provider | Planned sign-in, federation, MFA and tenancy choices. | [Accounts and access](#c3-accounts) in any system; distinct from current supplied local account behavior. |
| Notification service | Planned delivery-channel and delivery-policy intent. | [Notification components](#c3-notifications) and domain events in [community](#community-and-discussion), social or resource applications. |
| Billing provider | Planned subscription/payment-provider integration boundary. | [Billing & plans](#c3-billing) for any paid SaaS; no new payment implementation. |
| Observability | Planned logs, metrics, traces and retention intent. | All service families, especially [workload verification](#workload-intent); not an existing monitoring deployment. |

## C3 shared components

C3 components are cohesive responsibilities within a C2 container. They can group
existing generated or recipe-owned operations, or describe planned capabilities.
Their names and grouping do not duplicate handlers or create runtime calls.
Declared uses/arrows describe intent; actual generated wiring keeps its own identity.
The library and component type picker show backend families for service/worker hosts
and client families for frontend hosts. Optional technology tags describe design
intent. **Show technical components** in Editor actions reveals the derived HTTP
resource boundary and typed API adapter; it starts off and preserves operation groups.
See [P42's specification](docs/build-plan-c4-saas.md#p42--c3-catalog-saas-responsibilities-and-client-components)
for the planning scope; page-flow routing remains separate.
The [QRWTY target](#qrwty-target-architecture) reuses accounts, domain/media/analytics,
organizations, billing, developer access, integration, notifications, reports and
client feature areas. Its [study](docs/examples/qrwty-target.md) records the composition.

| Component family | Availability and responsibility | Hosts and C1 reuse |
| --- | --- | --- |
| <a id="c3-accounts"></a>Accounts and access | Implemented session/account behavior through compatible REST attachments; planned authorization module for broader access/tenancy choices. | [Application API](#c2-application), optionally [identity provider](#c2-integrations); all C1 offerings. |
| <a id="c3-resources"></a>Resource operations | Implemented configured CRUD/list operations and ownership rules within supported resource models. | [Application API](#c2-application) + [data](#c2-data); [resource workspace](#resource-workspace), [QR Studio](#qr-studio); analogous future post/profile models need their own definitions. |
| <a id="c3-client"></a>Client adapter and resource screens | Implemented `rest-api-client` and `resource-workspace` attachments for typed API use and supported resource views. Arbitrary page flows remain future work. | [Web client](#c2-web), or compatible service for a client adapter; primarily the [resource starter](#resource-workspace). |
| <a id="c3-domain"></a>Domain module / extension | Planned domain-module options; existing REST extensions expose concrete contracts and acceptance references, with implementation supplied by a recipe or project. | [API](#c2-application) or planned [worker](#c2-worker); link management, discussions, social relationships or other application responsibilities. |
| <a id="c3-feeds"></a>Feed module | Planned audience, ordering and freshness intent. | [API](#c2-application) / [worker](#c2-worker), with selected [cache](#c2-cache) or [data](#c2-data) dependencies; [social](#social-and-content-platform), potentially community activity. |
| <a id="c3-moderation"></a>Moderation module | Planned review, reporting and enforcement responsibility. | [API](#c2-application) / [worker](#c2-worker); [community](#community-and-discussion) and [social](#social-and-content-platform). |
| <a id="c3-analytics"></a>Analytics module | Planned aggregation, freshness and retention intent. The QR recipe supplies its own bounded analytics operations. | [API](#c2-application) / [worker](#c2-worker), [data](#c2-data) / [analytics store](#c2-analytics-store) / [streams](#c2-messaging); [links](#links-and-qr-platform), [QR Studio](#qr-studio), reusable for other activity data. |
| <a id="c3-media"></a>Media module | Planned transform, delivery and storage intent. Specific rendering, QR encoding and file correctness remain implementation or recipe behavior. | [API](#c2-application) / [worker](#c2-worker), [object storage](#c2-storage); links, QR Studio, community and social offerings. |
| <a id="c3-integration"></a>Integration adapter | Planned provider target, retries, timeout, request/response mapping and webhook verification. | [API](#c2-application) / [worker](#c2-worker) → [third-party provider](#c2-third-party); reusable for paid SaaS, notifications and external data in all C1 offerings. |
| <a id="c3-notifications"></a>Notifications | Planned message channels, templates and recipient preferences. | [API](#c2-application) / [worker](#c2-worker), [delivery services](#c2-integrations); community, social and resource applications. |
| <a id="c3-entitlements"></a>Entitlements & quotas | Planned limits, usage counters, enforcement and downgrade policy, with unspecified defaults. | API/worker hosts; paid products across offerings. |
| <a id="c3-abuse"></a>Abuse & trust/safety | Planned destination screening, quarantine, reports and appeals. | API/worker hosts; QR/link safety, distinct from community content moderation. |
| <a id="c3-domains"></a>Custom domains | Planned ownership verification, certificate lifecycle, transfer and takeover protection. TLS placement also belongs in deployment. | API/worker hosts; links, branded workspaces and other domain-based products. |
| <a id="c3-lifecycle"></a>Data lifecycle | Planned export access, deletion, retention and anonymization. | API/worker hosts; all offerings with retained user or business data. |
| <a id="c3-billing"></a>Billing & plans | Planned plans, trial duration, entitlements and provider synchronization. | [API](#c2-application) / [worker](#c2-worker), [billing provider](#c2-integrations); any paid links, community or resource product. |
| <a id="c3-organizations"></a>Organizations & members | Planned team structure, invitations and membership roles. | [API](#c2-application) / [worker](#c2-worker); team-based resource, links, community and social offerings. |
| <a id="c3-developer"></a>Developer API & webhooks | Planned API key access, rate targets, outbound webhooks and versioning. | [API](#c2-application) / [worker](#c2-worker), [external systems](#c2-third-party); developer access to links, community or resource products. |
| <a id="c3-reports"></a>Reports & exports | Planned output formats, asynchronous generation and export retention. | [API](#c2-application) / [worker](#c2-worker), [analytics data](#c2-analytics-store) / [object storage](#c2-storage); reports across C1 offerings. |
| <a id="c3-indexing"></a>Search & indexing | Planned indexed documents, update policy, freshness and access filtering. | [API](#c2-application) / [worker](#c2-worker) → [search index](#c2-search); community/social discovery or resource lookup. |
| <a id="c3-schedules"></a>Scheduled jobs | Planned schedule, time zone, overlapping-run and retry intent. | [API](#c2-application) / [worker or function](#c2-worker); recurring exports, reconciliation and maintenance in any C1 offering. |
| <a id="c3-events"></a>Event handlers | Planned event contracts, idempotency, retries and dead-letter intent; distinct from the implemented durable-events mechanism. | [API](#c2-application) / [worker](#c2-worker), [queues / streams](#c2-messaging); activity processing across C1 offerings. |
| <a id="c3-audit"></a>Audit log | Planned audited actions, actor attribution, retention and audit access. | [API](#c2-application) / [worker](#c2-worker), [data](#c2-data); administrative actions across C1 offerings. |
| <a id="c3-screens"></a>Screen group / feature area | Planned pages, public/signed-in/admin access and data used. | [Web/mobile/desktop clients](#c2-web); reusable client features in all C1 offerings. |
| <a id="c3-session"></a>Client session & access | Planned session source, access roles and session-expiry experience. | [Clients](#c2-web), [accounts](#c3-accounts) / [identity provider](#c2-integrations); signed-in C1 experiences. |
| <a id="c3-facade"></a>API facade | Planned client counterpart of the implemented typed adapter, with API target, transport, data mapping and error policy. | [Clients](#c2-web) → [application API](#c2-application); shared API use across C1 offerings. |
| <a id="c3-offline"></a>Local state & offline sync | Planned local storage, synchronization, conflict handling and retained data. | [Clients](#c2-web), especially mobile/desktop; cached resource workspaces or draft content in links, community and social products. |

The implemented [durable-events attachment](#c2-worker) also exposes event contracts
inside its service. Execution/pooling policies remain attached to their C2 host;
they need not be modeled as business components.

## C4 implementation and verification

C4 is the implementation detail level of the C4 model, not a fourth infrastructure
tier. Jeeves currently offers C1/C2/C3 editing and inspectable implementation
contracts/provenance; it has no general C4 class/code-diagram editor.

A QR encoder is usually a library behind a domain/media operation. If processing
needs a separate deployed worker, that worker is C2; its QR processing responsibility
is C3; the chosen library and calling code are C4 details. Domain specificity alone
does not determine a C-level. Most applications can reuse the surrounding request,
storage, queue and load-test structure without adopting QR semantics.

Existing templates and recipes supply their documented contracts and test packs.
Generated wiring, project-owned implementation and recorded verification remain
distinct. A passing structural or load test cannot establish that a QR decodes to
the correct destination, that a moderation decision is correct, or that all business
rules are complete. Domain acceptance belongs to the supplied recipe or application
engineer, with appropriate data and assertions.

### Workload intent

Planned API/service, worker, data and component blocks expose a traffic pattern,
peak target with a unit, and a P95 latency target. Zero means unspecified for the
numeric targets. These are saved design goals, not benchmark results or automatic
topology changes. Other planned controls describe cache behavior, concurrency,
instance counts and availability. Existing executable templates retain their
documented options.

A future reusable load-test contract should take representative application data,
operation mix and cardinality, plus a sustained/burst rate, duration, concurrency,
latency and error budget. It should report the measured environment, actual
throughput and failures against those declared targets. Testing QR records, user
accounts or forum posts can share a harness while supplying different fixtures and
domain assertions. A low-traffic application should be able to stay simple.

**Deferred:** load/stress-test generation and execution, automatic infrastructure
selection, cloud provisioning, autoscaling and evidence that these new planned
targets are met. A future implementation agent must design and verify those
capabilities explicitly; selecting “Bursty” today grants none of them.

## Maintaining this catalog

Update this file when an offering, reusable boundary or availability changes.
Keep C1 entries linked to shared C2/C3 entries; add reverse reuse links when adding
a reusable family. Describe responsibility, options and limits here. Keep exact
versions, schemas, runtime choices and test procedures in the linked implementation
documentation and registry rather than duplicating them in this catalog.

Current sources: [registered templates](packages/registry/src/builtin.ts),
[template briefs](docs/templates/README.md), [starters](starters/README.md),
[recipes](recipes/README.md), [planned block definitions](packages/spec/src/planned-capabilities.ts)
and [planning examples](packages/spec/src/architecture-examples.ts). Historical
template briefs marked “stub” are not additional implemented library offerings.
