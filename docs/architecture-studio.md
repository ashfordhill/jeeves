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
placement belongs in deployment plans. Traffic targets and legacy tenancy fields are disclosures
inside option forms; they do not dominate ordinary responsibility editing.

C3 includes request handling, data access/transactions, cache freshness, workflows,
transactional event publishing and traffic admission alongside the existing business/client
families. A transactional outbox explicitly requires domain state and event intent to share a
transaction; a queue and worker alone do not supply that property.

Interfaces, policies, objectives, data ownership and decisions remain part of the shared model.
Saved architecture templates and patterns retain their existing compatibility/revision guards.
The new [Streamly study](examples/streamly.md) exercises the full authoring path. Its numeric
objectives are assumptions, and its decisions are example decisions, not production approval.

Generation remains a secondary, separate workflow. There is no new runtime, provisioning,
C4 code editor or capacity verification in this UX package. Legacy test suites have not been
updated for the new labels, geometry or default study. The user's current priority explicitly
defers that maintenance.
