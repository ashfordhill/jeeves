# P48 — Relationship bindings and architecture policies

P48 binds provided/required interfaces to existing C2 connections or local C3 relationships.
Bindings retain exact contract versions, optional operation identity and distinct interaction
roles. Cross-container C3 uses derive from the same C2 connection; several bindings can share
that identity. Endpoint ownership/containment, missing references and identity collisions are
structural errors. Names may change without rewriting references. Removing referenced items
requires explicit cleanup; no policy, interface or objective is silently discarded.

Manage relationship contracts opens a focused Save/Cancel dialog. Transport, business synchrony
and optional policy groups remain independent: identity/tenant/network, timeout/failure,
bounded retry/idempotency, delivery/ordering/acknowledgement and freshness/invalidation. Unknown
choices remain explicit. A signed callback can describe asynchronous business delivery over
acknowledged HTTPS. Private-network reachability does not establish identity. Arrowheads follow
the authored dependency/message direction and verbs; the legend retains the asynchronous dashed
line convention without treating it as a delivery guarantee.

Data responsibilities and objectives in Editor actions assigns logical dataset owners, a store,
readers/writers, tenancy, retention/deletion and export access. Multiple authorities require an
explicit decision. Exact data contracts can reuse existing resource sources without copying a SQL
schema. Referenced shapes are immutable; source changes keep P47's visible staleness. Objectives
reference the system, a container, component, binding or dataset, with value/unit/boundary/window.
Redirect response time, analytics lag and background completion are separate unverified targets.

`architectureReview` reports missing/unknown work and selected version, interaction, direction,
tenant, delivery, access or objective-unit conflicts. Review findings stay outside `blocksGenerate`;
they do not modify executable bindings or weaken existing runtime readiness. Planned containers
and components retain `NEEDS_TEMPLATE`. Chat discovers bindings, datasets, objectives and review
through `getArchitectureContracts` and uses the same schemas/atomic operations. Multiple tools
still commit once per turn. Invalid batches do not mutate the working document.

The [bounded link-service fixture](../../../fixtures/designs/relationship-policies.json) models
cache-aside with application→cache and application→store, separate invalidation from link changes,
a signed/idempotent billing callback, named visit publication/consumption with bounded analytics
loss, resource authority and three distinct measurement boundaries. It is design intent, with no
claim about a deployed service or measured throughput.

## Inspected captures

Actual Chromium captures at 1440 × 900 light and 390 × 844 dark. Dialog bodies scroll while
Save/Cancel remain fixed; long outcome, key and measurement fields wrap. Narrow diagrams remain
fitted overviews. The same relationship can be reached from C2 and scoped C3 by mouse.

- [Exact interfaces and interaction identity](p48-binding-light.png)
- [Cache freshness and invalidation](p48-cache-light.png)
- [Signed callback identity and business synchrony](p48-callback-identity-light.png)
- [Bounded callback retry and idempotency](p48-callback-light.png)
- [Saveable exact-version and tenant conflicts](p48-review-light.png)
- [Bounded-loss visit channel, narrow dark](p48-visits-dark.png)
- [Explicit shared dataset authority](p48-data-light.png)
- [Scoped analytics-lag target, narrow dark](p48-objectives-dark.png)

## Verification boundaries

Focused spec, generator and scripted chat checks cover exact bindings, shared C2 identities,
local containment, several operations per connection, mismatch/unknown review, atomic reference
rejection, rename/removal, shared authority, source reuse/immutability and scoped objective units.
Generator equality excludes only the lossless `jeeves/design.json` snapshot; executable outputs,
contracts, artifacts and element ownership remain equal. No golden output is refreshed.

Production browser journeys cover mouse authoring/inspection, cache-aside, callback/visit policies,
C2→C3 traceability, local C3 edits, shared data authority, objectives, history/reload and retained
conflicts. Expected HTTP conflicts are narrowly registered; strict browser diagnostics, axe and
narrow overflow checks run without suppression or retries. P47 contract and existing architecture
authoring journeys are rerun. Exact commands/counts/run IDs are in [the handoff](../../handoff.md).

No runtime/template/recipe/dependency changes, generated contract/golden changes or live qrwty
edits. Policy execution, real authentication, queue clients, generation port changes and new
topologies are excluded. P49 focused views and persistent layout remain the next package.

Final recorded checks (unchanged fingerprints during each run):

| Check | Result | Run |
| --- | --- | --- |
| Focused binding/contract/generator/chat suites | 55 passed / 5 files | `2026-11-01T03-23-05-243Z-unit-531b0bfd` |
| `VITEST_MAX_WORKERS=4 pnpm work run check` | 784 passed / 112 files; all typechecks; no lint errors | `2026-11-01T03-23-50-027Z-check-aa5e15e3` |
| P48, P47 contracts and architecture authoring browser suites | 9 passed | `2026-11-01T03-23-51-141Z-browser-preview-73e4c7c4` |
