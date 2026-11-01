# Mattermost review: designing a backend that templates can implement

1 November 2026 · UX5. Scope: C2/C3 architecture, contracts and configuration for a backend
supporting thin clients. Page layout, frontend composition and new runtime generation are outside
this work. The [README](../../README.md) supplies the product intent; the
[reference walkthrough](../examples/mattermost.md) maps the study to its sources.

The C2 decomposition is a good starting point. The main weakness was the information inside the
boundaries: names and arrows described responsibilities without sufficiently constraining their
behavior. More services would not fix that. A useful implementation handoff needs the interface,
authoritative state, permission rule, transaction boundary, retry semantics and observable outcomes
for each important operation. Some of those can be deterministic template options; application
rules still require explicitly bounded hooks.

## C2 decisions

| Boundary | Decision and required design depth |
| --- | --- |
| Application server | Keep one modular application. REST, authorization, posts, membership, live delivery, files and notification policy can share a deployment. Split only for a documented ownership, load or isolation requirement. |
| Job server | Keep the separate process role shown in the reference. Its selected source path polls database jobs. Choose claim concurrency, cancellation, restart/replay behavior and job-specific access context; a broker is not implied. |
| PostgreSQL | Keep one logical authoritative store with writer/reader placements. Specify each aggregate's owner, uniqueness/concurrency rules, critical read freshness, migrations and recovery objectives. Replication does not imply read-after-write consistency. |
| Object storage | Keep shared bytes separate from SQL metadata. File lifecycle belongs in the server; write order, orphan recovery and deletion/retention are application decisions. |
| Email and push | Keep external providers separate from notification eligibility and preference logic. Choose per-channel retries, deduplication, sensitive payload rules and outage outcomes. |
| Thin web client | Keep REST/realtime adapters and state reconciliation. Server-side domain/access decisions must not depend on the client hiding a control. No page layout or widget authoring is needed. |

No additional C2 family is required for this slice. A search index, external identity provider,
dedicated realtime process, cache or queue becomes appropriate only when a chosen requirement
needs it. Existing library families can express these alternatives. The reusable C3 responsibilities
should remain composable inside an application or worker without forcing a service per feature.

## What changed in Jeeves

| Area | Delivered |
| --- | --- |
| Realtime C3 | Added **Realtime delivery**: subscription/recipient rules, delivery and ordering scope, reconnect, slow-consumer behavior, revocation and cross-instance fan-out. Mattermost's hub now uses this family. The existing C2 realtime service remains available for a deliberately separate process. |
| Files C3 | Added **File lifecycle**: upload path/size, content acceptance, access, attachment states, metadata/bytes consistency and cleanup. Mattermost's file service now uses it; a generic integration adapter remains appropriate for provider mapping. |
| State ownership | Added **Channels & membership** to the example using the existing domain family. Authorization consults membership; it does not own all channel state. Added channel/membership and file datasets with lifecycle decisions left open. |
| Existing options | Expanded authorization, repository, workflow, notification and worker settings. Removed the repository's misleading default claim that domain state and outbox intent share a transaction. Added database polling as a worker trigger. |
| Contracts | Fixed nested object/array shapes, nullable values, text enumerations and numeric/length/item bounds. Required and nullable are independent. Shapes are bounded to five nested levels and forty fields per object. Missing item/object definitions remain unresolved drafts. |
| Operation design | Added command/query intent, authorization, preconditions, state changes, transaction boundaries, idempotency, side effects, acceptance criteria and template/application-hook boundaries. Named outcomes record conditions, optional HTTP status, state after the outcome, retry decisions and optional payloads. |
| Review and handoff | Coverage is explicitly Unspecified, Partial or Complete. Review keeps unspecified/partial contracts open and reports missing operation behavior, including nested unresolved fields. Exact referenced versions remain immutable. Handoff JSON retains behavior/outcomes and coverage; the Markdown brief identifies coverage separately from shape resolution. |
| Access and workload | Added **Resource scoped** alongside tenant scoping, so channel permissions do not masquerade as isolated customer tenancy. Workload controls now allow concurrent connections, messages/second and bytes/second, plus a measurement boundary. Targets remain unverified. |
| Navigation | A component's sidebar shows its contract operations and outcomes and opens the selected contract directly. Configuration stays reachable from the component. Large field shapes are collapsible; open review details are grouped. |

These are design capabilities, not executable rules. Text in a precondition or hook contract is
still a specification for engineering work. Selecting “Template configuration” does not install a
template, establish template support or prove the behavior. Coverage describes the selected
contract's authored scope; it cannot certify a complete product.

## Evidence that changes the design

The [official architecture](https://docs.mattermost.com/deployment-guide/application-architecture)
supports the separation of application behavior, persistent data, files and external delivery.
Detailed behavior below comes from the pinned source, rather than inferring guarantees from an
architecture picture.

- [CreatePost API](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/api/v4/source/posts.yaml)
  includes `file_ids` as a string array and nested priority metadata. These are now represented as
  actual shapes. The complete response, API flags and error schemas are still partial.
- [Post application logic](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/app/post.go)
  separates persistence, file association, pending-post cache bookkeeping and post-processing.
  Its bounded pending-post cache is not evidence of durable cross-replica idempotency. A response
  failure after persistence must be reconciled; it does not establish rollback. The example
  captures these distinctions in the API and internal Post command contracts.
- [WebSocket hub](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/app/platform/web_hub.go)
  checks recipient eligibility and removes a connection when its send buffer is full. Live delivery
  is distinct from persisted history. Buffer sizing, recovery windows and revocation latency need
  deliberate choices in a future TypeScript implementation.
- [Job operations](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/jobs/jobs.go)
  use an optimistic pending-to-in-progress claim. Winning a claim does not make later object-store
  or external-provider effects exactly-once. The claim contract and crash scenario preserve that
  distinction.
- [File handling](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/app/file.go)
  and [channel logic](https://github.com/mattermost/mattermost/blob/2b3fb21fe39e6d8178625aabd8b9176596ad4cf5/server/channels/app/channel.go)
  motivate cohesive lifecycle and membership responsibilities. The example's orphan-cleanup and
  interrupted-job recovery paths are **proposed design requirements**, not claims that those
  exact procedures were verified upstream.

The expanded study has seven C2 containers, thirteen C3 components, nine partial contracts,
twelve exact relationship bindings, three datasets and three scenarios with failure branches.
It remains a selected messaging/files/jobs slice, not a specification of every Mattermost feature.
Existing saved projects are not silently migrated when the example changes.

## What should become deterministic, and what should stay explicit

| Reusable mechanism candidate | Configuration needed | Application boundary |
| --- | --- | --- |
| Request adapter | Typed inputs/outputs/errors, transport mapping, limits, session context | Permission and domain validation hooks with typed results |
| Repository/transaction | Aggregate schema, uniqueness, version checks, query bounds and atomic write set | Business invariants and operations spanning multiple aggregates |
| Job execution | Claim/lease policy, retries, deadline, cancellation, deduplication/reconciliation | Job handler effects and compensation |
| Realtime transport | Subscription policy, buffer bounds, order/replay scope, revocation and recovery | Which recipients may receive which event and how events map to authoritative state |
| File lifecycle | Upload limits, accepted content, storage adapter, states, cleanup and retention | Domain ownership, attachment rules, classification and holds |
| Notification delivery | Delivery channels, templates, preferences, retry/deduplication | Recipient selection, sensitive-content policy and product-specific triggers |

Templates should declare supported option combinations and reject unsupported required behavior.
They should expose small hook contracts with clear input, output and allowed effects. The design
must not claim a general atomic outbox simply because a queue/worker exists, or silently drop
permission checks to make generation succeed.

## Remaining design work before a serious implementation handoff

1. **Complete contract vocabulary.** Dynamic-key maps (the history `posts` dictionary), unions,
   reusable type references, transport locations/content types, complete error bodies and a bounded
   OpenAPI import. Use a real dictionary model; do not disguise one as text or a fixed object.
2. **Structured domain behavior.** Add aggregate invariants, state transitions, relationships,
   unique constraints, version/concurrency checks and transaction participants. Turn frequently
   repeated prose into validated options only where semantics are genuinely reusable. Do not build
   a universal programming language into the sidebar.
3. **Operation-to-effect tracing.** Bind declared state changes, emitted events and downstream
   operations to exact dataset/contract/component identities. Current behavior prose and scenario
   wiring are useful but cannot automatically establish all effects or prove consistency.
4. **Recovery and access scenarios.** Flesh out membership removal during active streams/jobs,
   duplicate or concurrent commands, partial file failures, notification outages, cancellation,
   retention/erasure and restore. Record expected observations and fixtures for each branch.
5. **Template compatibility and verification.** In a separately scoped runtime task, map selected
   designs to a versioned capability matrix, deterministic output and reusable black-box/load
   harnesses. Include fixtures, representative cardinality, fan-out, failure injection and exact
   acceptance criteria. Keep measured evidence separate from objectives and authored scenarios.

Before implementing the messaging slice, an engineer should be able to answer: who may act,
which state is authoritative, what commits together, what a retry does, what the client sees after
each failure, and which remaining rule needs application code. Jeeves captures substantially more
of that now; incomplete fields and unresolved decisions must remain visible until resolved.
