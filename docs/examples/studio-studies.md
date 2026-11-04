# Finite studio studies

In the opt-in studio (`?studio=next`), open **Library → Examples** and preview a study, then choose
**Create example project**. This creates a separate editable project. The historical New project
chooser/default and saved projects retain their existing behavior until the later rollout unit.

| Study at version 1.0.0 | Foundation and useful C3 scopes | Goal/source map |
| --- | --- | --- |
| Mattermost | One modular Go server, bundled browser, separate same-codebase job process, shared PostgreSQL/files and external email/push. C3 opens the server, job process and browser dependencies. No broker or internal-library service is invented. | [Manifest](../../packages/spec/src/studio-examples/mattermost.goal.json), [factory](../../packages/spec/src/studio-examples/mattermost.ts) |
| Enterprise | Customer/staff browser apps, one Orders API, independent worker, owned/shared database/cache/files, C3 work queue and external identity/payment/email. C3 opens both browser dependencies, API and worker. | [Manifest](../../packages/spec/src/studio-examples/enterprise.goal.json), [factory](../../packages/spec/src/studio-examples/enterprise.ts) |
| Streamly | Viewer/creator and staff browsers, modular platform API, independent playback API, media/activity workers, private originals/renditions, cache, search, CDN and distinct C3 job/topic identities. Each application has a useful dependency scope. | [Manifest](../../packages/spec/src/studio-examples/streamly.goal.json), [factory](../../packages/spec/src/studio-examples/streamly.ts) |
| QRWTY target | Owner/staff browser apps, Management, Redirect, one Billing service, authoritative data/cache, artwork/exports and a shared C3 visit channel feeding the independent analytics worker. Billing adapter, policy and entitlement internals stay source-linked custom work. | [Manifest](../../packages/spec/src/studio-examples/qrwty-target.goal.json), [factory](../../packages/spec/src/studio-examples/qrwty-target.ts) |
| Links & QR | A smaller management/redirect foundation with cached lookup, authoritative fallback, artwork and asynchronous analytics. Its brief is the historical example description and factory, without QRWTY's six-scenario gate. | [Manifest](../../packages/spec/src/studio-examples/links.goal.json), [factory](../../packages/spec/src/studio-examples/links.ts) |
| Community | Browser/API, authoritative content, search/cache, an independent worker with a C3 work queue and subscription Notifications service. | [Manifest](../../packages/spec/src/studio-examples/community.goal.json), [factory](../../packages/spec/src/studio-examples/community.ts) |
| Social | Browser/API, feed/search/cache, media storage, an independent processing worker and realtime service. The documented native client remains an external context boundary; native/offline implementation is C4b. | [Manifest](../../packages/spec/src/studio-examples/social.goal.json), [factory](../../packages/spec/src/studio-examples/social.ts) |

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
The seven remaining coverage rows, default rollout and paused backend work are separate assignments.

QRWTY's cache fallback, disable propagation, billing callback deduplication, tenant authorization,
analytics loss and recovery are pinned source/C4b obligations. Its illustrative timing values remain
unverified. No QRWTY-only settings taxonomy or live application migration is supplied. Community
membership/moderation and notifications, and Social ranking/graph/content rules, remain application
work. Public delivery variants do not make every source media object public; the finite studies
retain private storage intent with delivery/access integration outstanding.

Recorded inspection and limitations: [UX14a evidence](../evidence/studio-ux/UX14a/README.md), [UX14b evidence](../evidence/studio-ux/UX14b/README.md).
