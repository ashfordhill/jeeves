# QRWTY target architecture

This is an editable **planned SaaS study**, separate from the QR Studio recipe and
from the live QRWTY repository or saved design. Open **Library → Architecture
examples → Create qrwty target architecture**. Jeeves creates a new project; the
current project is preserved. The proposed technologies, queues, failure policies,
team access, billing and API behavior are design intent. None is provisioned or
verified by this example, and planned capabilities block generation.

The [P43 specification and decisions](../build-plan-c4-saas.md#p43--qrwty-target-architecture-example-and-example-refresh)
define the scope. The executable source for this and the three refreshed studies is
[architecture-examples.ts](../../packages/spec/src/architecture-examples.ts).

P49 adds **Management**, **Public redirect** and **Analytics** to the C2 view selector.
Management and analytics use explicit flow membership; redirect includes immediate dependencies.
The whole-system board remains available, and each focus links all hidden relationships.
Edit view changes membership/filtering without changing architecture; drag/nudge and camera
changes persist separately. See [P49 evidence](../evidence/p49/README.md).

## Context

Link owners manage their QR links and artwork. Team administrators manage membership
and billing. QR visitors follow short links; **their browser** follows the returned
destination. The redirect service does not fetch destination websites. The e-mail
provider delivers transactional messages; the payment provider handles subscriptions.
C1 keeps these responsibilities free of technology tags.

## Containers

The fourteen planned blocks are:

| Boundary | Proposed technology | Responsibility |
| --- | --- | --- |
| Owner web app | React / TypeScript | Customer landing, sign-in, library, Studio, analytics and settings |
| Admin console | React / TypeScript | Staff account and subscription support |
| Application API | Node.js / Fastify | Accounts, teams, link management, plans and developer access |
| Redirect service | Node.js / Fastify | Public destination lookup and visit capture |
| Primary data | PostgreSQL | Authoritative accounts, links, ownership and memberships |
| Lookup cache | Redis compatible | Derived lookups with source fallback |
| Artwork storage | S3 compatible | Versioned artwork and expiring export files |
| Visit queue | RabbitMQ | Asynchronous visit and background work delivery |
| Analytics worker | Node.js / TypeScript | Aggregation, scheduled reports and message delivery |
| Analytics store | ClickHouse | Customer-facing aggregate visit reporting |
| CDN & edge | HTTPS CDN | Static client assets and public artwork; redirects stay uncached |
| Payment provider | Provider API | Subscriptions and signed billing events |
| E-mail delivery provider | Provider API | Account, invitation and report-ready delivery |
| Observability | OpenTelemetry collector | Redacted logs, metrics and traces |

Relationships state their verbs, protocols and interaction style. Queued work, billing
events and telemetry are asynchronous; browser/API requests and storage queries are
request/response. A provider's C1 object explicitly binds to its planned external C2
block, so C2 reuses the block and an existing matching connection. This is identity
reuse, with no name matching or added wiring. **External block on C2** in the context
inspector edits that binding with Save/Cancel and history. Removing its block retains
the context object. Other context relationships retain their separate system-end
application binding. Managed providers and edge delivery sit outside the system.

## Components

Select **C3 Components**, then choose an application with the mouse.

- Application API: Accounts & sessions, Organizations & members, Link management,
  QR artwork, Analytics queries, Billing & plans, Developer API & webhooks,
  Notifications adapter (eight responsibilities). Explicit in-process relationships
  resolve member access, execute link operations and resolve the billing organization.
- Redirect service: Destination lookup and Visit capture.
- Analytics worker: Visit aggregation, Scheduled exports and Notification delivery.
- Owner web app: Public landing & sign-in, Library & create, Studio, Analytics,
  Settings & billing (five screen groups). These describe feature boundaries, not routing.
- Admin console: Support & administration.

Each authored component has a description and proposed technology. Dependencies reuse
existing container relationships, including their incoming direction for queue delivery
and signed provider events. Databases, queue infrastructure and external vendor internals
have no authored application decomposition in this study. Desktop fitted views retain
stereotypes, descriptions and technology; narrow fitted views are overviews. Mouse zoom,
selection and the inspector expose details. Navigation and zoom do not change the design.

## Reuse

The [catalog](../../CATALOG.md#qrwty-target-architecture) links these C1/C2/C3 boundaries.
Links & QR, Community & discussion and Social & content retain their original focus and
now include identity, billing, e-mail delivery, CDN and observability, within fifteen
blocks each. Their actual compositions also drive the library miniatures. Social includes
mobile API/offline responsibilities; Community includes subscription-message delivery.
Technology tags describe choices for these studies, not claims about a named company.

## Dynamic scenarios

On C2, open **Editor actions** and choose **Visitor follows a QR** or **Owner creates
a link**. Numbered badges reuse existing arrows; the adjacent list describes their
order, conditional cache misses and asynchronous visit processing. The visitor's
browser follows the destination; the redirect service does not fetch it. The owner
flow reuses the web/API arrow for request and response.

**Add scenario** opens a draft in the current C2 or C3 scope. Choose existing
relationships, describe each step, and use **Move up**, **Move down** and **Remove**.
Save is one undo step; Cancel discards the draft. C3 also offers the picker under
**Diagram options**. Relationship removal requires updating its scenario steps in
the same batch, or removing those steps first. See [P45 evidence](../evidence/p45/README.md).

No live adoption, runtime implementation, generated behavior or page routing is
supplied by this study. P44 supplies chat-library access; P45 supplies the saved
scenario explanations above. Planned blocks continue to prevent generation.
