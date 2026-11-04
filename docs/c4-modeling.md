# C4 modeling guidance for Jeeves agents

Read this before changing architecture authoring, catalog entries, connections or patterns. The user's current priority is a useful C2/C3 design experience and reusable composition. New application runtimes and generation expansion follow separately. These rules do not mark proposed capabilities implemented or authorize a queued package.

## Implemented studio direction — 4 November 2026

The [studio UX plan](build-plan-studio-ux.md) and
[resolved owner decisions](../.docs/visual-improvements/2026-11-03-ux-review/DECISIONS-FINAL.md)
govern the implemented default studio. [UX15 acceptance](evidence/studio-ux/UX15/README.md)
records the combined design checks, and the completed [studio grid plan](build-plan-studio-grid.md)
([SG10 acceptance](evidence/studio-grid/SG10/README.md)) supersedes its canvas and C3 rules.
New runtime/template work remains separate.
The standard C4 definitions below remain useful for understanding boundaries; they must not be used
to override the owner's deliberate product choices:

- Docker is the default execution intent for new Jeeves-managed services. Preserve real managed,
  browser and external/device boundaries; language intent is independent of current template support.
- A C2 card is one deployable application, browser client or resource. A **service package** of
  independent applications is drawn at C2 as an open labelled group frame around its members; it
  is a grouping, not another process/container (studio grid D1, SG05).
- C3 is one whole-system view: each application with components is a frame containing its
  finite-catalog components, with queues, resources and external systems around them. A component
  link to an element draws along its `via` C2 connection, so C3 never contradicts C2. C1/C2/C3 are
  equal tabs; there are no per-service detail scopes or drill-down (studio grid O1).
- Queues/topics appear as resources at C3, with one identity across producer/consumer views.
  C2 summarizes queued communication with provenance. The queue is not a custom microservice.
- Put scalar settings in the inspector. Do not split Billing into policy/provider/entitlement boxes,
  or draw an internal library/adapter merely to give it a name. Omit unconfigurable internals.
- No normal route/schema/entity/business-policy/lifecycle/effect editors. Preserve existing data;
  future fixed template behavior is C4a, and project-specific additions/integration stubs are C4b,
  using the [README's terminology](../README.md). Neither is proven by drawing it.
- C3 components come only from the finite component catalog (rate limiter, cache reader, ID
  generator, redirect responder, event publisher/consumer, data access, auth guard, external call,
  custom). Project-specific logic is a `custom` component with a one-line purpose: its future C4b
  stub. A component is not a nested microservice.
- Layout is derived (ELK); authors choose only row order within a column. Parallel relationships
  between one ordered pair are one counted line; the full action text stays in the inspector.
- Use compact autosaving forms, C1/C2/C3 tabs, no named focused views/Explorer,
  no fading/dashed status boxes and one Generate destination. Kubernetes/Helm and provider setup
  wizards are outside the current scope.

The [model contract](plans/studio-ux/model-contract.md) makes these distinctions precise. Do not
infer that every feature must become independently deployed simply because services are preferred.
The documented dropshipping Worker, for example, must not be silently split into multiple services
when it is used as a faithful architecture reference.

## Levels and views

| View | Standard C4 meaning underlying the stored model |
| --- | --- |
| C1: context | One software system, its purpose, people and external systems. Product offerings/starters can seed this model; they are not a separate C4 abstraction. |
| C2: containers | Logical applications and data stores, their responsibilities and communication. A container is not necessarily a Docker container, microservice or server. |
| C3: components | Cohesive responsibilities behind interfaces inside one container. Group by architectural responsibility; do not turn every endpoint, table, screen widget or library into a component. |
| Level 4: code | Implementation detail. Jeeves generates/implements code from richer contracts; C4 itself does not specify code generation. No class editor is required for the current work. |
| Dynamic / deployment | Supplemental views of interactions and runtime placement. They reference the same identities; they are not deeper levels of decomposition. |

These definitions follow the official [container](https://c4model.com/diagrams/container), [component](https://c4model.com/abstractions/component), [code](https://c4model.com/diagrams/code), [dynamic](https://c4model.com/diagrams/dynamic) and [deployment](https://c4model.com/diagrams/deployment) guidance.

**Classify by responsibility and ownership.** A managed database is still a logical store; a gateway's hosting vendor does not determine its level. Model a third-party product as an external system when its internals are outside the scope. Regions, clusters, replicas, load balancers and failover placement belong in deployment. A collector can be a container; “observability” can also name a requirement or an external product. Establish the meaning before adding a box.

**Model message channels explicitly.** Use named queues/topics as logical stores, or name the channel on the producer/consumer relationship. Broker instances/clusters are deployment details. Shared hosting does not imply a shared logical queue or delivery policy. See [official messaging guidance](https://c4model.com/abstractions/queues-and-topics).

## Relationships are architecture

Every arrow needs a directionally accurate verb; inter-container arrows also need a protocol. Distinguish dependency direction from message/data flow. Explain the convention in the legend. Colours, dashed lines and cylinders are Jeeves notation choices, not universal C4 mandates. See [official notation](https://c4model.com/diagrams/notation).

Behind an important arrow, preserve existing provided/required interfaces or operation/event contracts, ownership and relevant policies. Fixed templates can own such details; the current UX does not expose their manual authoring. Keep their references in the model and source/review details in Generate/export. Do not infer authorization from network privacy, delivery guarantees from a dashed line, or runtime wiring from a label.

C3 uses of a cross-container interface must trace to the same C2 relationship. Do not create contradictory copies. Several operations may share a connection; request/response, publication, consumption and callbacks still have distinct meanings. A webhook's business flow may be asynchronous while its HTTP delivery requires an acknowledgement.

Validate structural contradictions as errors. Present requirement-dependent concerns as advice with their assumptions. Cache-aside ordinarily has application→cache and application→store dependencies. Search may be synchronous. An asynchronous send may be followed by a response. Topology alone does not prove a defect.

## Reusable catalog and patterns

- Prefer existing libraries behind a meaningful capability. C3 does not require writing a player,
  editor or realtime client from scratch. Individual controls and page layout belong outside this
  architecture task. The current studio exposes restrained execution/provider intent; preserve
  historical deployment declarations without restoring their full authoring view.
- A C3 family is a reusable responsibility with a host, interfaces, dependencies, configuration and extension boundary. It is not necessarily a separate service or package. One instance can use several libraries.
- Separate organization structure, authorization, data isolation and deployment. Organization tenants can use shared or dedicated infrastructure. Private deployment does not automatically imply SSO, airgap or multi-region requirements.
- Distinguish application policy from an external provider in the model/source. That distinction
  does not require separate visual boxes. Billing is one normal C2 service with provider settings;
  project-specific policy belongs in C4b unless a later fixed template explicitly supplies it.
- Patterns compose responsibilities and relationships. Preview additions and explicit bindings; reuse by role, ownership and contract compatibility, never merely family/name. Preserve identities and make application one undoable edit.
- A transactional outbox means atomic persistence of domain change and event intent. A queue plus worker alone does not supply that guarantee. Keep required guarantees visible when a template is missing.
- Keep architecture intent, selected template/version, planned/current status and observed verification separate. A target design is useful before its templates exist. Never silently omit required behavior to make Generate succeed.

## Review before implementation handoff

Use understandable deployment/ownership boundaries. The current product prefers independent Docker
services but does not demand one service per feature or library; preserve documented shared
deployment boundaries in references. “Enterprise” is not a box count or a demand for Kubernetes.

For each important journey, identify the actor, responsible components, authoritative data, communication contracts and material failure outcomes. Include tenant checks through background processing, cache-update/disable behavior, retry/deduplication where side effects matter, and data/recovery policies. Workload objectives need units and measurement boundaries. They remain unverified targets until tested.

Show a readable overview and explicit C3 detail of the same model. Use technology as an explicit
choice or unresolved decision. Preserve mouse-only editing, valid-edit autosave, undo/redo, reload
and revision conflict handling. Invalid abandoned drafts are discarded; rejected writes must not
look saved. Layout changes must not change semantics.

The [qrwty review and six-scenario gate](reviews/c4-direction-review-2026-10-31.md) and
[P46–P57 roadmap](build-plan-c4-evolution.md) explain the earlier completed work. Their evidence and
stored contracts remain preserved. The active studio plan above supersedes conflicting UX choices;
QRWTY is now one of several coverage cases, not the acceptance driver. Keep future runtime work
outside the UX task unless the user expands its scope.
