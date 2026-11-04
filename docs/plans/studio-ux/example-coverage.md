# Example reconstruction and coverage

Part of the [studio plan](../../build-plan-studio-ux.md). “Covered” in this task means the documented
architecture can be assembled from finite studio definitions with explicit custom-work boundaries.
It does not mean the application builds, runs or passes its business tests. Those require the later
C4a/runtime task. A screenshot alone establishes neither kind of coverage.

## 1. Preserve the source, create a fresh interpretation

The current `architectureExamples` registry has nine entries. Keep its historical source factories
and frozen benchmark declarations intact. Introduce `studioArchitectureExamples` and separate
`studio-<old-id>` fixtures for the new UI. Register them through the new Library/creation path after
their assigned review. Do not change an old factory's data to make its frozen tests or benchmarks
describe a different system. New source files belong under `packages/spec/src/studio-examples/`.

Before reconstructing each fixture:

1. Read the source goal/brief, then the current diagram/factory as reference. Record source path,
   version/commit where applicable, content hash and scope in a small tracked goal manifest beside
   the new fixture. If there is no GOAL.md, identify the actual brief; do not pretend one exists.
2. List the explicitly required responsibilities and boundaries. Label tentative background and
   unknown requirements separately. Do not upgrade speculative historical notes into owner decisions.
3. Map each requirement to a finite studio node/relationship, a fixed future template obligation,
   C4b custom behavior/integration, or an unresolved source question. Record canonical IDs.
4. Build a fresh diagram/layout. Use a package only for actual grouped application boundaries;
   do not split every feature into a microservice or force a one-Worker design into several services.
5. Inspect C1/C2 and every useful C3 scope, configure representative fields, reload and export.
   Compare the goal map, not the old card count. Never remove requirements to make a diagram neat.

The manifest is static example provenance, not a new application goal editor. Use columns
`requirementId`, `source`, `summary`, `disposition`, `nodeIds`, `connectionIds`, `remainingWork`.
Allowed dispositions are `represented-design`, `fixed-template-candidate`, `c4b`, `unknown`.
None means runtime implemented. Referenced graph IDs must resolve. Preserve hashes of original
factories and benchmark files in evidence before/after the reconstruction.

Use a strict JSON manifest with `schemaVersion: 1`, `example: {id, version}`, `sources` (1–30
entries shaped `{id, path, commit?, sha256}`), and `requirements` (1–500 rows with the fields above).
Source IDs are unique slugs; paths are repository-relative documentation references, never runtime
file-read instructions. A requirement's `source` is `{sourceId, location}` with a clause/section
location of at most 240 characters. `requirementId` is unique nonempty text up to 120 characters,
allowing original labels such as CP-01. Summary/remainingWork are each at most 1200 characters;
node/connection lists contain at most 100 IDs each. Record unknowns as `disposition: unknown`,
not a separate unstructured document blob.
Hash canonical JSON with stable key ordering and declared array order. Pin the manifest through
`architecture.studio.origin`; export the exact registered bytes/data with the portable handoff.
These limits serve the finite example corpus, not arbitrary document ingestion.

For portable custom-work visibility, use the existing typed `architecture.decisions` records and
implementation-handoff assignments: IDs prefixed `studio-c4b-`, source/context, concise remaining
work, `Unresolved` status and links to affected identities. Do not misuse access/cache/delivery
reviewRequirement variants as generic goal storage. Generate renders these as C4b obligations;
their resolution requires real later implementation, not dismissing a UI warning. Include the static
goal manifest in the example's portable source bundle and verify its hash. No secrets/private
business data or entire sibling repository is copied into Jeeves.

## 2. Complete coverage inventory

| Row / unit | Goal authority and existing source | Required architecture coverage | Boundary that must stay explicit |
| --- | --- | --- | --- |
| E01 / UX14a: Mattermost | [Brief](../../examples/mattermost.md), [factory](../../../packages/spec/src/mattermost-example.ts) and its pinned public references | Browser, server, separate background process, database, file store, notification/integration paths; useful C3 dependencies | A reference to the documented system, not a demand to turn each internal responsibility into a new service. Kubernetes alternatives remain preserved source, outside normal UI. |
| E02 / UX14a: Enterprise web | [Reference](../../reference/enterprise-architecture.md), [factory](../../../packages/spec/src/enterprise-web-example.ts) | Frontend/application boundaries, owned/shared data, identity/external integrations and actual independent workers | Tenant policies, roles and detailed business access rules remain source/C4b; network privacy is not authorization. |
| E03 / UX14a: Streamly | [Brief](../../examples/streamly.md), [factory](../../../packages/spec/src/video-platform-example.ts) | Playback versus platform responsibilities, media processing worker(s), object storage, cache, CDN, search, C3 queued processing | Codec/rendition jobs, media permissions, moderation, revocation and delivery guarantees are not newly configurable business programs. Include AWS CloudFront as an optional provider identity, not a provisioning promise. |
| E04 / UX14b: QRWTY target | [Target brief](../../examples/qrwty-target.md), [proof source](../../../packages/spec/src/architecture-proofs.ts) | Owner browser/app, Redirect, one Billing C2 service, data/cache, C3 queue and analytics worker path | Billing policy/entitlements/adapter internals are not separate default cards. Custom QR/business semantics remain C4b; no live QRWTY repair. |
| E05 / UX14b: Links & QR | [Existing example](../../../packages/spec/src/architecture-examples.ts) | Management, fast redirect, cache fallback, asynchronous analytics and appropriate provider/data choices | Keep a distinct small reference rather than a second copy of QRWTY's detailed scenario gate. Its existing brief is authority until expanded by the owner. |
| E06 / UX14b: Community | [Existing example](../../../packages/spec/src/architecture-examples.ts) | Browser/API, content data, search, notifications and queued background work | Posting/moderation workflows and permissions are custom application behavior, not a generated state-machine editor. |
| E07 / UX14b: Social | [Existing example](../../../packages/spec/src/architecture-examples.ts) | Browser/API, media/object storage, independent processing, feed/search/cache dependencies | Ranking, graph policy, content rules and page/UI design remain C4b. Do not invent requirements beyond the existing description. |
| E08 / UX14c: Discourse core | [Brief](../../examples/discourse-core.md), [factory](../../../packages/spec/src/discourse-core-example.ts), frozen Discourse ledger | Represent the meaningful service/store/worker/integration foundation and link every fixed D obligation to its preserved source or C4b work | Detailed backend source stays intact. “Complete backend design” in an older fixture is not a runtime claim; new UX coverage cannot change benchmark scoring. |
| E09 / UX14c: Vendure core | [Brief](../../examples/vendure-core.md), [complete design factory](../../../packages/spec/src/vendure-core-complete.ts), frozen Vendure ledger | Commerce foundation, hosted payment integration, store/cache/queue/worker boundaries | Money, stock, order and provider recovery behavior stays explicit C4b/fixed-contract work; no generic entity or workflow editor. |
| E10 / UX14c: Zammad reference | [Benchmark roadmap](../../build-plan-backend-benchmarks.md), [reference pack](../../reference/backend-benchmarks.md), frozen Zammad ledger and partial P73a sources | A small separately named studio foundation/reference covering support API, data, background work and external channels | P73a/P73b remain incomplete/paused. This is not completion of the detailed Zammad backend design, not registration of that missing benchmark example and not permission to repair its semantics. |
| E11 / UX14d: QRWTY existing goal | [Original brief](../../examples/qrwty.md), existing supported project/recipe and [repo README](../../../../qrwty/README.md) | Map its original goal to the new studio vocabulary in a separate reference; retain existing executable legacy flow as compatibility evidence | Do not mutate the working QRWTY project, auto-adopt P35, or make this the sole gate. The sibling README explicitly describes it as a generation guinea pig. |
| E12 / UX14d: Dropshipping | [Local brief](../../examples/storefront.md), [frozen GOAL](../../../../dropshipping/.docs/GOAL.md), [build plan](../../../../dropshipping/.docs/BUILD_PLAN.md) | Browser/admin assets, one Worker/API boundary, D1, R2, Stripe-hosted checkout, external email/workflow integration and custom fulfillment | Preserve the documented single deployment, guest checkout/no customer accounts and demo-only data. Cloudflare Workflows is not merely a queue. Durable order process, vendor adapters, compliance, sourcing and branding logic remain C4b/fixed future work. Current scaffold is not the completed application. |
| E13 / UX14d: Inventory labeling | [Brief](../../examples/inventory-labeling.md), [architecture reference](../../examples/inventory-architecture.md) | Application server, authoritative store, external device/printer boundary and explicit application/device integration | Do not model firmware, printer drivers or every form as Docker microservices. Hardware, fields/actions and offline requirements still marked open remain unknown. A bounded foundation is possible; full product coverage cannot be claimed. |
| E14 / UX14d: Grocery review | [Brief](../../examples/grocery-review.md) and its linked concept | Client/external capture boundary, application API, media/data store and external recognition integration | Device choice/data access/recognition accuracy remain unknown. Do not invent access to vendor APIs, choose glasses versus phone, or claim recognition performance from a diagram. |

Frozen ledgers live under [benchmarks](../../../benchmarks/README.md); their rules/thresholds are
not edited by this plan. E10 is additional design coverage with a deliberately different fixture
name. E13/E14 may end with explicitly limited coverage because their briefs are incomplete; that
is an accounted-for row, not a claim those unknown features have been solved.

## 3. UI acceptance fixtures independent of application branding

Create small public fixtures for the following cases in UX01; use them throughout the queue so
QRWTY does not determine acceptance:

- **Single service:** a service with a provider choice but no meaningful child graph. Inspection
  works and double-click creates no empty C3 view.
- **Package:** API + independently deployed worker, owned queue/cache and a database. C2 has one
  package card, C3 exposes real children, member language settings stay independent.
- **Shared channel:** producer and two consumers, one queue ID visible in their relevant C3 scopes,
  C2 asynchronous summaries and correctly traceable branches. Provider edit affects one resource.
- **Shared data:** two services use one logical database plus one separate owned database. Distinct
  caches use recognizable icons. Database edges are compact without losing their true owners.
- **Dense graph:** at least 24 visible nodes, repeated fan-out, one cycle, mixed protocols, long
  names and opposite-direction links. Use deterministic synthetic values, no private copied data.
- **Legacy preservation:** an existing supported-template design and a rich backend design with
  contracts/types/policies, old annotations and saved focused layouts. Capture semantic hashes.

These are verification data, not additional runtime products or a new maintained test suite. A
one-off browser scenario may load them into owned disposable projects. Track exact IDs for cleanup.

## 4. Required recorded evidence per example

Record the source/goal map, C1/C2 screenshot, every distinct useful C3 pattern and three representative
configuration saves across that example (or all applicable fields if fewer). Record reload and
portable export observations, unresolved source questions, C4b obligations, generation status and
the absence of unauthorized legacy/source changes. A fixture with no C3 must explicitly show why.

Across the full corpus inspect each definition/provider-selection category at least once, every
field/condition in the configuration matrix, a package, a shared queue and the dense layout case.
No need to perform identical save checks on every repeated database in every fixture. The final
matrix records which example supplies each kind of evidence; do not leave coverage as “looks good.”

The UI goal map can identify later C4a candidates but cannot select a runtime backlog implicitly.
Actual field testing of generated dropshipping/QRWTY builds, reproducible output and black-box
behavior belongs to a separately requested runtime/template plan. Keep a short list of what that
later test must verify, without implementing it in UX14/UX15.
