# C2/C3 architecture studio

The studio designs software architecture before implementation. C1 states the system purpose;
C2 contains logical applications, stores and external systems; C3 contains responsibilities
inside one application. A queue is a logical channel, and an endpoint is an interface operation.
See the [modeling guidance](c4-modeling.md) for the full boundary rules.

## Everyday workflow

- **Add container** opens C2 choices and a name/responsibility/options form. Saving inserts the
  new boundary into the routed model. A placement gesture is not required.
- **Connect containers** records an arrow with its directional verb, protocol, interaction and
  access boundary. Select the arrow afterward to attach exact interface contracts and policies.
- Application cards show all their high-level C3 responsibilities. Click one to drill in.
  **Explorer** provides the same model as a searchable tree, including relationships.
- **Add component** exposes only families appropriate to the chosen application. Backend
  responsibilities can share API/worker hosts; client responsibilities stay in a client.
- **Connect components** authors local collaboration. Select a declared component and use
  **Connect dependency** to add a C2 relationship and that component's use in one undoable save.
- **Deployment**, beside C1/C2/C3, opens a full-screen hosting diagram and editor. Place C2
  identities on Docker/Kubernetes/VMs or managed services; add load balancing and replica links.
  Replica communication connects distinct instances of the same C2 identity, without adding a
  fictitious logical application. Each environment is an alternative over the shared design.
- Legacy REST/resource implementations show capability groups instead of one component per
  endpoint/table. **Define responsibility** groups their existing members under an authored name.
  Operations remain available in inspection; **Show implementation adapters** reveals transport detail.

## Reading a dense design

C1, whole C2, focused C2 and C3 use routed layouts with reserved label space. The whole system
is an overview; a large graph needs a focused view or zoom to read details. Select a responsibility
in Explorer to center it at a readable scale. **Focus selection** zooms to a box or relationship;
**Fit diagram** restores the overview. **Auto-arrange** clears manual overrides for that scope.
The grip on a card moves it. Layout history and saved cameras never alter design semantics.
Existing manual layouts remain available until explicitly reset.

Focused C2 views select members of the same model, optionally with immediate dependencies.
Hidden relationships remain reachable. URLs carry the level, application and focused-view key,
so reload and shared local links return to that scope. The old freeform board and annotations
remain under Editor actions; architecture diagrams are the default.

## Options, reuse and limits

The library separates **Containers · C2**, **Components · C3**, **Patterns**, **Examples** and
**Runtime templates**. Provider presets do not crowd out application choices. Infrastructure
placement is available through **Deployment**. Traffic targets and legacy tenancy fields are disclosures
inside option forms; they do not dominate ordinary responsibility editing.

C3 includes request handling, data access/transactions, cache freshness, workflows,
transactional event publishing, realtime delivery, file lifecycle and traffic admission alongside
the existing business/client families. A transactional outbox explicitly requires domain state and event intent to share a
transaction; a queue and worker alone do not supply that property.

Interfaces, policies, objectives, data ownership and decisions remain part of the shared model.
Saved architecture templates and patterns retain their existing compatibility/revision guards.
The default [Mattermost reference](examples/mattermost.md) translates published diagrams and
selected source modules into C2/C3, with AWS and Kubernetes deployment alternatives. Its source
mapping distinguishes documented facts, our decomposition, and unresolved implementation choices.
The earlier [Streamly study](examples/streamly.md) remains available as an illustrative design.

Choose existing libraries behind meaningful responsibilities. Component **Technology** can name
the implementation; the realtime-client family also records its client library and recovery policy.
Individual controls and page layout belong in the future UI/page-flow designer.

The canvas keeps names, responsibilities, technologies and relationship verbs visible. Repeated
planning badges and level explanations are omitted. Select an object for its implementation,
contracts and errors; expand notes or source references when needed. Deployment notes live under
**Notes & references**. Availability remains in technical details, Review and implementation handoff.

Generation remains a secondary, separate workflow. There is no new runtime, provisioning,
C4 code editor or capacity verification in this UX package. Legacy test suites have not been
updated for the new labels, geometry or default study. The user's current priority explicitly
defers that maintenance.

Contract inspection also exposes nested payloads, field constraints, operation behavior and outcomes.
Use **Inspect contract** on a component to open that exact definition. Partial/unspecified coverage
and missing behavioral decisions appear in Review; “Complete” is an authored coverage claim, not
verification or template availability. New versions preserve the existing reference guards.
See the [Mattermost backend review](reviews/mattermost-backend-review-2026-11-01.md) for a worked
example and remaining gaps before deterministic implementation.


Component **Configure component → Data** now opens focused contract, dataset, entity, aggregate
and query subeditors. Choose a Data section and an exact definition; follow **Open …** links
without leaving the component draft. Data contracts supply logical fields and reusable local types;
datasets supply authority and stores. Entity fields annotate those same stable field IDs rather
than copying a second type schema. Relations, keys, indexes, concurrency and finite invariants have
bounded row controls. Queries select declared joins, allowed comparisons, output, stable keyset
order, page limits, existing policy/projection references and freshness.

Contract fields support exact local references, bounded maps and tagged unions in both Data and
Interfaces. Referenced contract/type shapes are protected; explicit successors retain older consumers.
Names can change while storage and field identities stay stable. Source-backed legacy shapes remain
read-only. Unresolved policy/type choices remain visible design gaps. Component **Access** authors exact finite policies with focused resource/context, clause, rule,
read/write projection and revocation sections. Choose persisted role/membership sources and direct
relations; allow/deny rules select named clauses with all/any composition. Trusted identity,
authorized scope and correlation come from server checks. Payload roles, cursors, private networks
and initiating actors grant no authority. Default deny, deny wins and rejecting unknown writes
remain fixed. Referenced policy semantics are protected; create an explicit successor and select it
only for the consumers being reviewed. Display names remain editable.

**Affected paths & reuse** lists exact query sources (including hidden filter/order/cursor fields),
byte/output access bindings, operations and capability settings. Follow a query or access use back
to its exact policy, resource entity, dataset and contract without leaving the shared draft.
**Sensitive access uses** selects exact policies/projections for byte, materialization, delivery,
export, job, replay and existing provided-operation paths; it does not implement those paths.
Operation input/output inspection is read-only. Behavior authoring is available below; effect/hook and capability-setting editors follow in P68b/P68c.

**Design preview** illustrates all/any composition and deny precedence against a local synthetic
fixture of explicitly assumed clause/context/revocation facts. Unknown facts cannot demonstrate
permission. A missing declared recheck denies at that site, and read/write projection modes remain
separate. Fixture changes are unsaved, never production authorization or runtime evidence. Chat
**getArchitectureContracts** discovers the same backend declarations and affected policy paths;
chat edits use the shared schemas and atomic operation validation.

All Data and Access changes share **Save component** with General. Cancel discards the whole open draft;
invalid drafts remain editable across section switches. One save is one undo step. Revision conflicts
retain the draft and require Cancel/reopen against the latest revision. These controls describe design
intent; they do not supply storage, query execution, authorization or runtime evidence.


Component **Behavior** now authors exact provided commands and read-only operations alongside
**Lifecycles & state tables**, inside the same component draft. Choose one focused command section:
target/aggregate, current access/participants, finite guards, ordered actions/writes,
identity/concurrency/transaction, idempotency/cancellation, or declared outcomes. Values select
stable input paths, trusted context, persisted fields, server factories, bounded scalar literals,
previous typed action results or a bounded query result. There is no expression or code editor.

Lifecycles select a required persisted enum field, show its state table and initial state, and
bind finite guards to explicit transitions. Referenced lifecycle semantics are protected; **Create
lifecycle successor** preserves existing consumers. Retarget a command's exact lifecycle deliberately.
Names remain editable. **Open …** follows command contracts, policies, aggregates, action lifecycles
and persisted entities into their exact definitions without losing the draft. Operation contracts,
inputs, outputs and outcome meanings are inspected read-only; Interfaces owns contract successors.

Commands declare exact root/child keys, allowlisted writers, separate participant policies and
outcome field mappings. Action order can be changed by mouse. Optimistic CAS selects a typed
expected version; aggregate row-lock intent remains visible. Command-key identity, normalized input
hash fields, published replay window, cooperative deadline and starts-work choice are explicit.
The fixed transaction/receipt/replay/cancellation guarantees remain visible as requirements.
Missing decisions, such as a conflict or uncertain outcome, remain saveable specific findings;
contradictory types, references, outcomes and writers block Save. Effect/hook authoring and
capability settings remain assigned to P68b/P68c. No command, timer, transaction or hook executes.
