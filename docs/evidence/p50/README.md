# P50 — Contract-aware pattern composition

Four versioned patterns now compose editable C2/C3 design intent: tenant workspace/access,
billing/entitlements, cached public lookup with update/disable propagation, and asynchronous
work delivery with separate best-effort and transactional-outbox variants. The
[fragment and reuse contract](../../architecture-patterns.md) documents the format and limits.

Library → Patterns previews required roles, compatible candidates, additions, exact contracts,
policies, guarantees and extension points. Unique compatible hosts resolve automatically;
ambiguous hosts require an explicit choice. Pinned compatible components/channels and existing
C2 relationships can be reused explicitly. Names/families alone cannot establish compatibility.
Fresh expansions retain stable identities and immutable source provenance; existing host
configuration, custom names and additional dependencies are preserved.

Outbox intent names an atomic domain/event writer, two datasets sharing one store, retained
event intent, delivery/progress responsibility and idempotent consumption. A best-effort visit
channel cannot satisfy a billing outbox role. These are required design guarantees, not runtime
implementations, measured capacity, verified transactions or broker provisioning.

## Inspected production captures

Actual **1440 × 900 light / 390 × 844 dark** Chromium captures. Fixed Apply/Cancel actions
remain reachable while the body scrolls. Narrow controls, guarantee paragraphs and long role
help wrap without horizontal overflow. The C3 capture waits for completed layout.

- [Tenant access host/role preview](p50-tenant-light.png)
- [Cached lookup freshness and role preview](p50-cache-light.png)
- [Explicit compatible component reuse](p50-reuse-light.png)
- [Outbox guarantees and extension points](p50-outbox-light.png)
- [Saved delivery responsibilities in scoped C3](p50-delivery-c3-light.png)
- [Narrow dark role bindings](p50-roles-dark.png)
- [Narrow dark outbox requirements](p50-outbox-dark.png)

## Verification and limits

Focused unit tests cover all four patterns on a three-container fixture, explicit selected
API/store reuse, distinct visit/billing channels, outbox writer/store/delivery structure, wrong
ownership/tenant/contracts/policies/guarantees, conservative role reuse, customizations, unfilled
and ambiguous choices, identity collisions, source pinning and revision conflicts. Exact contract
shape matching includes field names and versions; no schema-subtyping engine is supplied.

Mouse journeys add all four patterns and both delivery variants, select compatible responsibility
reuse, compare saved output with shared expansion, and prove Cancel, one-step history, reload and
retained conflict drafts. Strict browser diagnostics, axe and narrow overflow remain enabled.
Scripted chat discovery/preview/application matches mouse expansion, needs no extra approval,
keeps multiple pending applications in one transaction and refuses stale pattern replay over a
concurrent context edit. Existing authoring and catalog/example journeys remain covered.

Generator tests preserve executable outputs/artifacts/ownership when historical provenance is
saved; only the intentionally lossless design snapshot changes. Actual new planned components
still block Generate. Domain payload/lifecycle decisions remain visible separate review work.
No new runtime/template/recipe, generated output/golden, dependencies, live QRWTY edits, paid
model calls or deployment changes. User-published storage/adoption is deferred to P55.

Exact final commands, counts, timings and run fingerprints are recorded in
[the handoff](../../handoff.md). P51 requirement-based advice and decisions are next, only when requested.
