# Inventory architecture reuse study

This small P56 design exercise proves non-QR reuse. It is separate from the executable Resource
workspace starter, generated Inventory fixtures and live applications. [Evidence](../evidence/p56/README.md)
records authoring verification, not stock runtime acceptance.

Create an empty project and choose **Library → Build a study step by step → Inventory**.
Apply the three-host seed (API, worker, relational authority), tenant access, asynchronous work
with the **transactional-outbox** variant, then the product-contract/scenario stage. The fifth
logical block is the browser workspace; the named Stock changes channel is the fourth. Inspect
Management/Analytics C2 focuses, scoped C3, exact contracts, datasets, review and scenarios.

The same versioned tenant-access pattern and exact access shape used by the
[QRWTY study](qrwty-target.md) authorize tenant/principal operations. Both products recheck access
at API/data boundaries, job execution and export download. Stock authority and durable event intent
commit together through an atomic writer in one selected store. Delivery reads retained intent,
publishes, records acknowledged progress and deduplicates tenant/event IDs in the handler. This is
an implementation invariant, not a queue/transaction supplied by Jeeves.

Unlike QR visit analytics, authoritative stock work selects persisted acknowledgement, retry,
idempotency and buffering. The stock scenario references the atomic writer's persistence boundary;
there is no second independent stock write before atomic commit. Membership and analytics/export/
delete/recovery scenarios reuse the same reference model. Production objectives remain explicitly
unresolved and assigned, while sample lifecycle/timeout choices remain unverified examples.

Chat uses `listArchitectureStudies`, `previewArchitectureStudyStage` and
`applyArchitectureStudyStage` with `product: inventory` and the saved base revision. Mouse and
chat call the same operations/validators. Stages or a supplied chat turn are undoable, save/reload
normally and refuse stale replay.

The local-library proof also publishes portable tenant and delivery selections from QR's early
composition stages and inserts their exact content/version into an Inventory composition with
explicit matching host/store interfaces. A copied best-effort channel is informational notification
intent, separate from the durable stock path; a local source never silently upgrades guarantees.
After full product specialization, broader scenario/decision dependencies may exceed the local
fragment's 20-role portability bound. Save the bounded reusable selection before that coupling,
or author an explicit smaller boundary; the catalog refuses rather than dropping references.

Planned blocks/components still block generation. No stock runtime, generated UI, provider call,
provisioning or live application change is supplied. P57 implementation handoff is next separately.
