# Finite studio studies

In the opt-in studio (`?studio=next`), open **Library → Examples** and preview a study, then choose
**Create example project**. This creates a separate editable project. The historical New project
chooser/default and saved projects retain their existing behavior until the later rollout unit.

| Study at version 1.0.0 | Foundation and useful C3 scopes | Goal/source map |
| --- | --- | --- |
| Mattermost | One modular Go server, bundled browser, separate same-codebase job process, shared PostgreSQL/files and external email/push. C3 opens the server, job process and browser dependencies. No broker or internal-library service is invented. | [Manifest](../../packages/spec/src/studio-examples/mattermost.goal.json), [factory](../../packages/spec/src/studio-examples/mattermost.ts) |
| Enterprise | Customer/staff browser apps, one Orders API, independent worker, owned/shared database/cache/files, C3 work queue and external identity/payment/email. C3 opens both browser dependencies, API and worker. | [Manifest](../../packages/spec/src/studio-examples/enterprise.goal.json), [factory](../../packages/spec/src/studio-examples/enterprise.ts) |
| Streamly | Viewer/creator and staff browsers, modular platform API, independent playback API, media/activity workers, private originals/renditions, cache, search, CDN and distinct C3 job/topic identities. Each application has a useful dependency scope. | [Manifest](../../packages/spec/src/studio-examples/streamly.goal.json), [factory](../../packages/spec/src/studio-examples/streamly.ts) |

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
The other eleven coverage rows, default rollout and paused backend work are outside UX14a.

Recorded inspection and limitations: [UX14a evidence](../evidence/studio-ux/UX14a/README.md).
