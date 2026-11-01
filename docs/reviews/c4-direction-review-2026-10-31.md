# Jeeves direction review: make the architecture meaningful before generating it

**Planning follow-through:** the [revised P46–P57 roadmap](../build-plan-c4-evolution.md)
now incorporates this review. Package numbers and criticisms below describe the original
P46–P53 proposal at the reviewed revision, not the replacement specification. Implementation
has not started.

31 October 2026. Reviewed at `4683fe6`, after P45. **The direction is sound; P46–P53 should not be implemented as currently written.** Keep the shared model, scoped C3 views, planned catalog, stable identities and scenarios. Prioritize relationship semantics and reusable composition. Defer new generation behavior under the user's current instruction.

This is a design review, not approval or implementation of the proposed packages. The accompanying [business assessment](../../../qrwty/business-analysis/decision-review.md) favors a bounded hosted-product test; it does not justify making private deployment the default requirement.

**What is actually present**

The [catalog](../../CATALOG.md) already has 23 planned C2 families and 20 C3 families, alongside implemented templates. P39–P45 added notation, relationships, SaaS components, examples, chat access and scenarios. A read-only API check confirmed live qrwty revision 17 still has three elements, two connections and no `architecture` metadata. The richer [target study](../examples/qrwty-target.md) is separate.

[Connection metadata](../../packages/spec/src/planned-capabilities.ts) records label, protocol, interaction and a coarse security choice. [C3 components](../../packages/spec/src/architecture.ts) reference resources and C2 connections; they do not yet declare reusable provided/required interfaces. [Planned-edge validation](../../packages/spec/src/validate.ts) checks endpoints and self-connections but does not establish contract compatibility. Changing a protocol label changes no generated wiring. Preserve those distinctions while making the model more useful to an architect.

The inspected [P43 C2 screenshot](../evidence/p43/p43-qrwty-target-c2-light.png) packs many crossing lines and tiny labels into one overview. Preserve a whole-system view, but add focused management, redirect and analytics views of the same model. More boxes or more auto-fit cannot resolve that readability problem.

**Corrections to the proposed plan**

| Area | Recommended correction |
| --- | --- |
| P46: C4 classification | Classify by responsibility, ownership and abstraction. Managed hosting does not turn an application or store into infrastructure. A logical gateway with application behavior can remain visible at C2; load-balancer instances and regions belong in deployment. An owned telemetry collector can be a container; an outside monitoring product is an external system. Avoid family-wide reclassification. [C4 containers](https://c4model.com/diagrams/container), [deployment](https://c4model.com/diagrams/deployment) |
| P46/P48: messaging | Model named logical queues/topics or named channels on relationships; place the broker/cluster in deployment. The plan's assertion that a broker is the right C2 abstraction conflicts with official guidance. Never reuse a queue solely because its family matches: visit analytics and billing jobs have different delivery needs. [C4 messaging](https://c4model.com/abstractions/queues-and-topics) |
| P46: tenancy | Separate the business tenant (personal workspace, organization, agency/client), authorization policy, storage isolation and deployment model. “Dedicated per tenant” is not an alternative to “Organizations.” A private deployment can contain many organizations. |
| P47: horizons | Keep current/target views as design metadata first. Defer filtering generation. The proposal overlooks planned C3 components, which independently produce `NEEDS_TEMPLATE`. Later generation must select an explicit, dependency-complete scope; required authorization or billing cannot disappear merely because it is marked “later.” Separate target status, template availability and verification. |
| P48: patterns | Start with a few patterns and explicit role/contract bindings. Preview additions and reuse. A queue plus handler is **not** a substitute for a transactional outbox: the defining guarantee is atomic domain-state/event recording. Preserve that requirement when implementation is unavailable. [AWS outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) |
| P49: advice | Ground rules in declared requirements. Cache-aside does not require a cache→database arrow; the application performs fallback. Search can legitimately be synchronous. Starting asynchronous work and then responding is valid. Billing does not imply organizations; private hosting does not automatically require SSO. Warn about unmet selected policies. [Azure cache-aside](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) |
| P50/P51: adoption and deployment | Annotate current architecture from evidence; names alone do not prove behavior. Keep current and proposed topologies distinguishable. Add deployment to explain instances, failure domains and managed services. Hosted-first is the qrwty reference; private delivery is an optional variant. |
| P52/P53: priorities | Bring readable focused views and saved layout forward. Record consequential decisions. Defer multiple export formats; if DSL export is later promised, validate it with the actual parser, not a text approximation. |

Consolidate redundant provider presets, but retain the distinction between an internally deployed notification service, an in-process notification component and an external delivery provider.

**What connections need to express**

C4 establishes a communication vocabulary; it is not a complete code-generation specification. Jeeves needs a small structured contract layer behind the diagrams. Keep the canvas to a clear verb and protocol, with these details in a focused inspector:

| Contract detail | qrwty example |
| --- | --- |
| Provider, consumer and provided/required interface | Link management provides `UpdateDestination`; the UI consumes it. C3 responsibilities project through the existing C2 relationship. |
| Operation/event identity and version | `VisitRecorded v1` with a defined payload, publisher and consumers; distinct from a billing event. |
| Direction and interaction meaning | “Publishes visits to” is message flow; “Consumes visits from” is dependency direction. Label the convention. A webhook is asynchronous to the business flow but still uses an HTTP request and acknowledgement. |
| Authority and trust | Organization-bound user/API-key access; signed provider callback; ownership of link records and permitted readers. “Private network” does not establish authorization. |
| Relevant failure and consistency policy | Lookup timeout/fallback; maximum stale destination age; bounded visit buffering or permitted loss; retry/deduplication for money and account changes. |

Use references and bounded policies, not prose interpreted differently by each implementation agent. Require only relevant fields. Preserve existing executable bindings and report missing or contradictory intent. Template selection can later bind these contracts without redefining the architecture.

**A sufficient qrwty architecture**

Use an owner/staff web client, a management API, a separately scalable public redirect service, background processing, authoritative relational data and artwork storage. Add a lookup cache and a named visit channel where workload justifies them. An analytical store is an optional growth choice. Payment and email providers remain external systems. This is a proposed composition, not a claim about QR.io's internals.

The management API's C3 responsibilities should cover identity/tenant access, links and content, artwork, billing/entitlements, custom domains, abuse decisions, reporting and audit. Several can share one process. Client feature areas should cover creation, Library, Studio, Analytics, team/settings and staff support. Treat QR payload types and hosted landing-page content as explicit requirements: URL redirects alone do not cover QR.io's advertised offering. [QR.io pricing](https://qr.io/pricing)

Retain the proposed four additions—entitlements, abuse, custom domains and data lifecycle—as reusable responsibility families. An instance still needs its interface, dependencies, invariants and extension boundary. Keep provider adapters distinct from business policy. No new runtime or class hierarchy is needed to model this.

Connect **link changes and abuse decisions to lookup freshness**, not just scans to a cache. Define what happens when the queue is unavailable. Asynchronous processing alone does not remove a synchronous publish acknowledgement from the redirect path. Prefer redirect availability with explicitly bounded analytics loss/degradation unless a stricter requirement is chosen. Tenant checks, destination shutdown and billing changes need defined propagation semantics.

**Recommended sequence and completion gate**

1. Correct catalog semantics; define reusable C3 interfaces and relationship contracts, with compatibility feedback and mouse authoring.
2. Add patterns for tenant access, billing/entitlements, cached lookup and asynchronous delivery. Reuse elements through explicit compatible bindings. Show current and target views without changing generation.
3. Make the qrwty target readable and complete through focused C2 views, scoped C3 views and the six scenarios below. Add a compact deployment view and decision records where they explain real choices.
4. Review the resulting model as the implementation brief. Only then specify new runtime/templates and generation work for implementation agents.

The design is ready for handoff when a reviewer can trace these flows without inventing architecture:

| Scenario | Decision the model must make explicit |
| --- | --- |
| Create/edit a QR link, artwork or hosted content | Stable printed URL; content ownership; update propagation into cached lookups. |
| Follow a QR during cache/queue failure | Source fallback, timeout, redirect outcome and analytics-loss policy. |
| Invite/restrict a member or use an API key | Tenant boundary and access checks across API, data, background jobs and exports. |
| Receive a duplicate billing webhook or downgrade | Idempotency, entitlement state and the deliberate policy for existing printed codes. |
| Attach, transfer or remove a custom domain; disable an abusive link | Ownership/TLS lifecycle, preserved paths, and bounded enforcement delay. |
| Query/export/delete analytics and recover stored state | Event meaning, retention, tenant access, freshness and recovery objectives. |

Each scenario must use identified relationships, name the responsible component, and expose relevant unresolved decisions. Latency, throughput, availability and recovery values are targets with units and measurement boundaries—not evidence of capacity. Zero generic warnings or a fixed box count cannot prove architectural quality.

The durable rules for future agents are in [C4 modeling guidance](../c4-modeling.md). The outcome should be an editable architecture whose decisions survive into implementation, with qrwty as a demanding example rather than a catalog of special-purpose QR boxes.
