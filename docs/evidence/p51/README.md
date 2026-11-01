# P51 — Architecture review and decisions

Architecture review now groups unmet selected contracts, access/authority, cache behavior,
delivery/failure and objectives with their assumptions and linked identities. The
[review contract](../../architecture-review.md) describes the typed requirements, decision
format, acknowledgement inputs and limits. The [fixture](../../../fixtures/designs/architecture-review.json)
extends the existing relationship-policy model without changing any live design.

Review completion is calculated separately from structural validity, generation readiness,
template availability and runtime evidence. Contradictions remain saveable review conflicts;
structural invalidity still rejects operations. No decision can hide a contract mismatch or
certify missing implementation. No style rule requires more boxes, organizations, queues,
SSO or a cache→store arrow.

Optional requirements describe selected access boundaries, cache fallback/update bindings,
channel/schedule/request delivery responsibility and failure outcomes. An external consumer
can provide delivery; synchronous search, personal billing and async-send-then-response stay
valid. Source and cache can have different explicit representations, with exact contracts
checked within each binding. Dataset and existing policy/objective review remain visible.

Decisions record context, reason, consequence, status and linked identities. Accepted scoped
tradeoffs stay in the report, with the recorded reason. Relevant-input changes reactivate the
finding; unrelated revision/notes/context wording do not. Fingerprints are deterministic
non-security change detectors. Explicit unresolved decisions keep review incomplete.

## Inspected production captures

Opened all seven final Chromium captures at **1440 × 900 light / 390 × 844 dark**.
The fixed Save/Cancel footer stays reachable while fields and long findings scroll. Text,
inputs, badges and actions wrap within the narrow viewport; axe checks include contrast.

- [Selected cache requirement, assumption and editor/pattern links](p51-review-light.png)
- [Decision with context, reason and consequence](p51-decision-light.png)
- [Changed relevant inputs expire the acknowledgement](p51-expired-light.png)
- [Exact-version contradiction remains a conflict](p51-contract-conflict-light.png)
- [Narrow dark finding and assumption](p51-review-dark.png)
- [Narrow dark decision fields and fixed actions](p51-decision-dark.png)
- [Narrow dark requirement editing](p51-requirements-dark.png)

## Verification and limits

Focused unit tests cover positive/negative selected requirement rules, cache ownership and
propagation bounds, separate source/cache representations, scheduled/request workers and
external consumers, valid architecture exceptions, scoped acknowledgement expiry, required
identity links, contradictions, explicit unresolved decisions, atomic structural refusal and
historical repair. Existing contract/binding tests remain included.

Mouse journeys author all four requirement kinds, record a scoped decision, exercise semantic
undo/redo and reload, reactivate accepted findings after changed inputs, open exact relationship
editors and pattern previews, and retain conflict drafts with Cancel. Review returned by the
production API matches the shared function. Strict browser diagnostics, a narrowly registered
expected HTTP revision conflict, axe and narrow overflow checks pass.

Scripted chat matches mouse validation and saves one undo step without extra approval. A stale
review snapshot saves nothing over concurrent architecture. Generator tests compare executable
files, contracts, artifacts and ownership while allowing the intentionally lossless design
snapshot to retain review metadata. No generated goldens were refreshed. Declared cache/failure
behavior, event execution and guarantees remain unverified; examples retain their real gaps.

Final verification: **85 focused tests / 6 files**, **825 full-check tests / 115 files** and
**8 production browser journeys** pass. Exact commands, timings, fingerprints and interim
findings are recorded in the append-only [handoff](../../handoff.md). No new runtime/template,
dependency, lockfile, provisioning, paid model call or live QRWTY changes. P52 linked
current/target workspaces are next, only when requested.
