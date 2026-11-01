# Architecture pattern composition

P50 supplies four versioned design fragments through **Library → Patterns** and the design
assistant. Applying one adds editable responsibilities, exact contracts, policies and optional
scenarios to the current design. These are architecture templates, separate from executable
runtime templates. New planned components and connections retain `NEEDS_TEMPLATE`.

| Pattern | Intent |
| --- | --- |
| Tenant workspace and access | Membership authority, principal/tenant access checks and authenticated scoped persistence. Does not select organization tenancy or deployment isolation. |
| Billing and entitlements | External signed callbacks, durable acceptance, deduplication, billing state and entitlement decisions. Downgrade behavior remains an explicit implementation decision. |
| Cached public lookup | An opaque-key lookup interface, application→cache read and application→source fallback, authenticated writes and bounded update/disable invalidation. No cache→store dependency. |
| Asynchronous work delivery | A named logical channel, producer and handler. Best effort permits explicit bounded work loss; transactional outbox requires atomic persistence plus delivery. |

The outbox variant declares an atomic writer with a `commit-domain-event` operation, domain
and event-intent datasets in the same selected store, and a delivery responsibility that reads
retained intent, publishes it and records acknowledged delivery progress. The handler receives
tenant/event identities and requires deduplication. Atomicity is a required invariant; no runtime,
transaction, transport adapter or verification evidence is supplied by these declarations.

## Fragment and saved model

The Zod [fragment schema and expansion](../packages/spec/src/architecture-patterns.ts) use
format version 1 and pinned pattern version `1.0.0`. Fragment-local identities describe:

- Required host roles, boundaries and component roles with ownership/classification constraints.
- Standard P47/P48 contracts, provided/required interfaces, bindings, datasets and policies.
- Existing C2 connection and scoped C3 relationship schemas, with verb/protocol/interaction.
- Bounded configuration, required invariants, extension points and optional standard scenarios.

There is no second connection or payload language. Expansion maps local IDs to fresh instance
IDs; an explicit reuse choice maps a role or relationship to an existing identity. Scenario
steps reference those same relationships. System choices and existing architecture collections
are preserved. Current built-ins use backend service/worker hosts and relational SQL storage
(Postgres or the planned relational-store host); a cache/channel is not an authority-store match.
This is host eligibility, not a claim that the selected runtime implements the new contracts.

Configuration bounds composition/channel names to 80 characters, tenant scope to the three
explicit choices, and freshness/loss windows to 0–86,400 integer seconds. Pattern instance IDs
are lowercase slugs up to 22 characters, leaving room for expanded stable identities. Domain
payload fields deliberately remain unresolved where application-specific structure is needed.
Data lifecycle/export choices and selected system policies remain separate design-review work.

Optional `architecture.patternInstances` stores the pinned pattern/version/variant, saved base
revision, configuration, local→expanded identity map and invariants. Existing entries cannot be
rewritten by an operation batch; graph names, responsibilities, configuration and extensions
remain editable. Provenance is historical and does not protect deleted graph entries from normal
editing or prove that the current graph still satisfies the original pattern. **Compositions in
this design** in the Patterns tab exposes that distinction and the recorded requirements.

## Reuse and atomic application

Preview lists compatible host candidates. A sole compatible host resolves automatically; several
APIs/stores require a choice, and unfilled roles stay visible. Boundaries/components default to a
fresh instance. Their reuse requires an explicit choice of a prior pinned expansion whose current
ownership, exact contract identities/versions/shapes and original policies/guarantees still match
the configured fragment. Names and family alone cannot establish compatibility. Matching is
conservative: same tenant/channel/bounds and intact fragment obligations are required; added
interfaces/dependencies and display customizations are retained. Arbitrary manual responsibility
adoption and user-saved templates are separate future work in P55.

Existing C2 relationships can be selected explicitly when endpoints, protocol and interaction
match. Multiple exact-version bindings may share one connection; this never changes its executable
endpoints or attaches a runtime. Different logical visit/billing channels are fresh by default,
even if a later deployment shares one broker. Different contracts require an explicit adapter.

Apply sends one validated operation batch. Cancel, invalid choices and revision conflicts add
nothing. Undo/redo and reload use ordinary semantic history. A conflicted mouse draft retains its
opening snapshot; another Apply cannot overwrite concurrent edits. Chat pattern batches also
refuse the generic stale-operation replay path and require a fresh preview of the current design.

Chat exposes `listArchitecturePatterns`, `describeArchitecturePattern`,
`previewArchitecturePattern` and `applyArchitecturePattern`, all using the same expansion.
Use `getDesign.patternBaseRevision` for requests, including multiple applications in one turn.
The saved base remains provenance while pending edits are included in expansion. The whole turn
commits as one undo step. Unambiguous or supplied choices need no separate approval flow.

See [P50 evidence](evidence/p50/README.md) and the [three-container fixture](../fixtures/designs/pattern-composition.json).
P51 requirement-based review/decisions are next; no additional runtime work is included here.
