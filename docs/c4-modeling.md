# C4 modeling guidance for Jeeves agents

Read this before changing architecture authoring, catalog entries, connections or patterns. The user's current priority is a useful C2/C3 design experience and reusable composition. New application runtimes and generation expansion follow separately. These rules do not mark proposed capabilities implemented or authorize a queued package.

## Levels and views

| View | Meaning in Jeeves |
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

Behind an important arrow, record the provided/required interface or operation/event contract, its owner, access boundary and relevant failure/consistency policy. Keep details in the inspector and references in the model. Do not infer authorization from network privacy, delivery guarantees from a dashed line, or runtime wiring from a label.

C3 uses of a cross-container interface must trace to the same C2 relationship. Do not create contradictory copies. Several operations may share a connection; request/response, publication, consumption and callbacks still have distinct meanings. A webhook's business flow may be asynchronous while its HTTP delivery requires an acknowledgement.

Validate structural contradictions as errors. Present requirement-dependent concerns as advice with their assumptions. Cache-aside ordinarily has application→cache and application→store dependencies. Search may be synchronous. An asynchronous send may be followed by a response. Topology alone does not prove a defect.

## Reusable catalog and patterns

- Prefer existing libraries behind a meaningful capability. Record the selected implementation
  and integration contract at design time; C3 does not require writing a player, editor or
  realtime client from scratch. Individual controls and page layout belong in the future UI
  designer. Docker/Kubernetes, routing, replicas and failure placement must be easy to reach
  through the companion Deployment view; they are not C4 code-detail work.
- A C3 family is a reusable responsibility with a host, interfaces, dependencies, configuration and extension boundary. It is not necessarily a separate service or package. One instance can use several libraries.
- Separate organization structure, authorization, data isolation and deployment. Organization tenants can use shared or dedicated infrastructure. Private deployment does not automatically imply SSO, airgap or multi-region requirements.
- Distinguish application notification policy from an external email provider; billing policy from a payment adapter. Consolidate aliases without losing different responsibilities.
- Patterns compose responsibilities and relationships. Preview additions and explicit bindings; reuse by role, ownership and contract compatibility, never merely family/name. Preserve identities and make application one undoable edit.
- A transactional outbox means atomic persistence of domain change and event intent. A queue plus worker alone does not supply that guarantee. Keep required guarantees visible when a template is missing.
- Keep architecture intent, selected template/version, planned/current status and observed verification separate. A target design is useful before its templates exist. Never silently omit required behavior to make Generate succeed.

## Review before implementation handoff

Use the smallest architecture that explains the required behavior. Start with a modular application where appropriate; split deployments for a stated scaling, availability, ownership or security reason. “Enterprise” is not a box count or a demand for Kubernetes.

For each important journey, identify the actor, responsible components, authoritative data, communication contracts and material failure outcomes. Include tenant checks through background processing, cache-update/disable behavior, retry/deduplication where side effects matter, and data/recovery policies. Workload objectives need units and measurement boundaries. They remain unverified targets until tested.

Show a readable overview plus focused views of the same model. Use technology as an explicit choice or unresolved decision. Preserve mouse-only editing, Save/Cancel, undo/redo, reload and revision conflict handling. Layout changes must not change semantics.

The [qrwty review and six-scenario gate](reviews/c4-direction-review-2026-10-31.md) explain the rationale. The [revised P46–P57 roadmap](build-plan-c4-evolution.md) incorporates the corrections and is the current planning specification. Its shared model contract and each package's acceptance criteria govern implementation when that work is requested. Keep future runtime implementation details out of the architecture task unless the user expands its scope.
