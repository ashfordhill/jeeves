# Finite studio studies

In the default studio, open **Library → Examples** and preview a study, then choose
**Create example project**. This creates a separate editable project. The historical New project
factories and saved projects retain their source data. New project and fresh-install defaults now
use the source-mapped studio studies; [UX15 acceptance](../evidence/studio-ux/UX15/README.md) records rollout.

| Study at version 1.0.0 | Foundation and useful C3 scopes | Goal/source map |
| --- | --- | --- |
| Mattermost | One modular Go server, bundled browser, separate same-codebase job process, shared PostgreSQL/files and external email/push. C3 opens the server, job process and browser dependencies. No broker or internal-library service is invented. | [Manifest](../../packages/spec/src/studio-examples/mattermost.goal.json), [factory](../../packages/spec/src/studio-examples/mattermost.ts) |
| Enterprise | Customer/staff browser apps, one Orders API, independent worker, owned/shared database/cache/files, C3 work queue and external identity/payment/email. C3 opens both browser dependencies, API and worker. | [Manifest](../../packages/spec/src/studio-examples/enterprise.goal.json), [factory](../../packages/spec/src/studio-examples/enterprise.ts) |
| Streamly | Viewer/creator and staff browsers, modular platform API, independent playback API, media/activity workers, private originals/renditions, cache, search, CDN and distinct C3 job/topic identities. Each application has a useful dependency scope. | [Manifest](../../packages/spec/src/studio-examples/streamly.goal.json), [factory](../../packages/spec/src/studio-examples/streamly.ts) |
| QRWTY target | Owner/staff browser apps, Management, Redirect, one Billing service, authoritative data/cache, artwork/exports and a shared C3 visit channel feeding the independent analytics worker. Billing adapter, policy and entitlement internals stay source-linked custom work. | [Manifest](../../packages/spec/src/studio-examples/qrwty-target.goal.json), [factory](../../packages/spec/src/studio-examples/qrwty-target.ts) |
| Links & QR | A smaller management/redirect foundation with cached lookup, authoritative fallback, artwork and asynchronous analytics. Its brief is the historical example description and factory, without QRWTY's six-scenario gate. | [Manifest](../../packages/spec/src/studio-examples/links.goal.json), [factory](../../packages/spec/src/studio-examples/links.ts) |
| Community | Browser/API, authoritative content, search/cache, an independent worker with a C3 work queue and subscription Notifications service. | [Manifest](../../packages/spec/src/studio-examples/community.goal.json), [factory](../../packages/spec/src/studio-examples/community.ts) |
| Social | Browser/API, feed/search/cache, media storage, an independent processing worker and realtime service. The documented native client remains an external context boundary; native/offline implementation is C4b. | [Manifest](../../packages/spec/src/studio-examples/social.goal.json), [factory](../../packages/spec/src/studio-examples/social.ts) |
| Discourse foundation | One modular discussion API, independent worker, shared PostgreSQL, private files and external thin client/email. C3 exposes the same logical SQL-backed work identity from producer and consumer. D01–D20 and all 66 observations remain future work. | [Manifest](../../packages/spec/src/studio-examples/discourse-foundation.goal.json), [factory](../../packages/spec/src/studio-examples/discourse-foundation.ts) |
| Vendure foundation | One modular commerce API, independent worker, PostgreSQL, private catalog/receipt bytes and external client, email, hosted payment and warehouse boundaries. V01–V20 and all 63 observations remain future work. | [Manifest](../../packages/spec/src/studio-examples/vendure-foundation.goal.json), [factory](../../packages/spec/src/studio-examples/vendure-foundation.ts) |
| Zammad reference | Small support API/data/background-work/external-channel reference. Z01–Z20 and all 66 observations are mapped; detailed P73a/P73b design remains incomplete and paused. This is a separate reference, not the missing complete benchmark example. | [Manifest](../../packages/spec/src/studio-examples/zammad-foundation.goal.json), [factory](../../packages/spec/src/studio-examples/zammad-foundation.ts) |
| QRWTY original goal | Approved original cohesive HTTP API, browser and PostgreSQL; sessions, QR image/redirect/activity stay inside one API. This is distinct from the larger target, live project and existing supported recipe. | [Manifest](../../packages/spec/src/studio-examples/qrwty-original.goal.json), [factory](../../packages/spec/src/studio-examples/qrwty-original.ts) |
| Dropshipping | One managed Cloudflare Worker serves bundled storefront/admin, uses D1/R2, Stripe-hosted checkout, Workflows, EmailSender and operator Access. Guest shoppers have no accounts. Vendor/order/compliance/branding behavior stays future work. | [Manifest](../../packages/spec/src/studio-examples/dropshipping.goal.json), [factory](../../packages/spec/src/studio-examples/dropshipping.ts) |
| Inventory labeling — limited | P56 software API/worker/PostgreSQL/browser/work-channel foundation plus external terminal and physical-printer boundaries. Hardware, exact fields/actions, application identity and offline requirements remain unknown. | [Manifest](../../packages/spec/src/studio-examples/inventory.goal.json), [factory](../../packages/spec/src/studio-examples/inventory.ts) |
| Grocery review — limited | External capture/review client, bounded application API, private media/data and recognition/reference-data boundaries. Device choice, vendor/data/API permissions, input formats and recognition quality remain unknown. | [Manifest](../../packages/spec/src/studio-examples/grocery.goal.json), [factory](../../packages/spec/src/studio-examples/grocery.ts) |

Each manifest pins repository-relative source references, a Git revision and file SHA-256 values.
Its requirement rows distinguish represented design, possible future fixed templates, C4b work
and unresolved questions. `architecture.studio.origin` pins that exact example/version/manifest
hash. A later edit preserves the seed provenance; it does not prove continued goal satisfaction.
Generate's **Export source** includes the design, layout and exact resolved manifest. Portable
implementation handoffs retain those sources, unresolved decisions and their future owner assignments.

Use the finite inspectors for technical intent such as language, execution, database/cache engine,
storage provider, queue retention or CDN origin/provider. Queue roles use the actual shared queue
identity in C3. AWS CloudFront is an optional Streamly CDN identity, with no provisioning action.
Streamly's source Kotlin and FFmpeg choices remain explicit source work; their language setting
stays Unspecified because Kotlin/FFmpeg are not entries in the finite language list. Mattermost's
SMTP integration stays in the source map while its finite transport is Unspecified.

Generate shows **source-linked C4b obligations** for source internals, application behavior,
contracts, access/tenant rules, media processing/permissions, notification integrations and recovery.
The historical Mattermost AWS/Kubernetes deployment declarations stay pinned source; there is no
new Kubernetes editor. Existing source contracts, scenarios, policies and workload objectives are
preserved through the source map, with their implementation and measurement still outstanding.

These are design studies. The server rejects application generation with `STUDIO_DESIGN_ONLY`.
No runtime resolver, application build, capacity result, provider integration or business acceptance
is supplied by these diagrams. Future C4a/C4b implementation needs a separately authorized task.
The original factories/briefs, frozen benchmark declarations and live projects are unchanged.
All 14 coverage rows are accounted for across UX14a–UX14d. Default rollout and paused backend work
remain separate assignments; limited source concepts are not completed products.

QRWTY's cache fallback, disable propagation, billing callback deduplication, tenant authorization,
analytics loss and recovery are pinned source/C4b obligations. Its illustrative timing values remain
unverified. No QRWTY-only settings taxonomy or live application migration is supplied. Community
membership/moderation and notifications, and Social ranking/graph/content rules, remain application
work. Public delivery variants do not make every source media object public; the finite studies
retain private storage intent with delivery/access integration outstanding.

The backend references map every frozen G case/observation to future fixed-contract C4a work and
every H case/observation to C4b hook/integration work. All source weights, observations, fixture
barriers, expected outcomes and scoring remain unchanged. No observed points or runtime support
are gained. Vendure's external payment provider retains the separate Reference-v1 and Stripe
obligations; it does not add a hosted checkout UI or another Billing deployment.

Their C3 work resource summarizes source SQL intent; named subchannels, payloads, claims and receipts
remain distinct implementation contracts. It implies no extra broker, SQL/network atomicity or
delivery guarantee. Queue retention is unspecified and separate from command/business retention.
The sources retain PostgreSQL projections and require no added cache or search cluster. The source
external byte adapter maps to one private object-store resource and its API/worker dependencies;
its exact C1 adapter contract remains pinned without adding a duplicate provider card. SMTP/TLS is
preserved source; its finite transport is Unspecified. Zammad's SLA/calendar/routing and internal-note
visibility are future fixed/custom work, with no new business editor. The P73 checkpoint provenance
pins the historical handoff commit, since that log continues to grow by append-only entries.

The original QRWTY reference preserves QR-01–QR-09, the approved session/ownership and wire
contracts, and the historical recipe evidence without adopting P35 or changing a live application.
Its historical hardware/location/map background is not silently revived; the sibling README
qualifies QRWTY as a generation guinea pig and says custom hardware is not worth exploring.

Dropshipping pins all 44 frozen GOAL clauses plus its architecture and scaffold handoff. Its
Workflows object denotes a managed orchestration capability bound to the same Worker, not a
message queue or another custom deployment. Durable order waits/recovery, idempotent signed
payments, vendor conformance, human tasks, compliance, sourcing and branding remain future C4b
implementation. Operator identity does not create shopper accounts. Only synthetic demo data
belongs in these examples; the scaffold is not the complete storefront.

Inventory does not turn firmware, printer drivers or forms into Docker services. Its separate P56
software study preserves atomic stock/outbox/tenant obligations as future C4a/C4b work; a queue
setting supplies none of those guarantees. Grocery chooses neither glasses nor phone and assumes
no Retailmotus/Trax API permissions. Consented reference images and deterministic doubles can
exercise future software boundaries, not prove recognition accuracy, stock counts or KPI results.

Recorded inspection and limitations: [UX14a evidence](../evidence/studio-ux/UX14a/README.md), [UX14b evidence](../evidence/studio-ux/UX14b/README.md), [UX14c evidence](../evidence/studio-ux/UX14c/README.md), [UX14d evidence](../evidence/studio-ux/UX14d/README.md).
