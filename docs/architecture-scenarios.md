# Scenario expectations and client journeys

[P54](build-plan-c4-evolution.md#p54--scenarios-outcomes-and-client-journeys) extends
[P45 scenarios](evidence/p45/README.md) on the shared architecture model. C2 Editor actions
and the C3 Diagram menu offer Add scenario, selection, editing and hiding. The scenario panel
selects the main path or a named alternative and numbers that path's existing arrows.
Context entry/exit steps remain explicit in the step list even when their C1 arrows are outside
the current C2/C3 diagram. Relationship direction always describes the static dependency;
request, response and asynchronous continuation describe the interaction in the scenario.

## Authored model

Optional `architecture.scenarios` retains every original P45 field. New fields are optional;
loading a legacy scenario does not invent an actor, condition, alternative, outcome or review.
Its expectation review is explicitly Incomplete until relevant details are authored.

- `actor` references an existing context person or external system. `startCondition` records
  the trigger/precondition, up to 1200 characters.
- `steps` is the ordered main path (1–50). A step references `connection`,
  `componentRelationship` or `contextRelationship`. Optional `phase` is request, response
  or continuation; it changes no static endpoint or generated wiring.
- Optional `binding` references the exact P48 binding on that relationship, retaining its
  contract/version and operation. A client state identifies a `screen-group` component
  participating through that binding's provided/required interface. API/in-process client
  states need the bound operation, or an authoritative REST-operation source. States are loading, success, denied and failed.
- Up to 12 `alternatives` each have an identity, name, alternative/failure kind, condition,
  `afterStep` pointing to the main path and their own 1–50 ordered steps. The main prefix
  through that step establishes the branch point; the alternative then terminates in its
  named outcomes. No loops, joins, expressions, scripts or executable state machine exist.
- Up to 30 `outcomes` record an expectation (up to 1200 characters), up to 20 invariants,
  and optional links to existing review requirements and decisions. `mainOutcomes` and each
  alternative's `outcomes` identify the expectations for that path. Requirements/decisions
  retain their independent review status; a scenario does not acknowledge their conflicts.

Scenario identities use the existing shared architecture namespace. Path, step and outcome
identities are unique inside their scenario; alternative path IDs reserve `main` for main-path
selection. Existing P45 steps named `main` remain valid. Reusing an
arrow across different steps is valid. Context references must touch the system; C3 context
references must bind to that scoped container. C3 relationships stay inside their application;
its C2 dependencies must be authored component uses. Cross-scope, missing or mismatched
relationships/bindings/client features/outcomes/requirements/decisions reject an operation
atomically. Renaming preserves references. Remove dependent references in the same batch
before deleting their referenced objects. Missing expectations are saveable incomplete intent.

## Review and editing

The panel and editor show Incomplete, Needs review, Reviewed or Stale. Record expectation
review explicitly records agreement with the current expectations. Save commits that record
with the draft; Cancel discards it. A deterministic non-security fingerprint covers the scenario,
actor, selected relationships, bindings/interfaces, exact contracts and live authoritative
contract sources, client feature definitions, and linked requirements/decisions. Requirements'
related bindings and decision-linked bindings/contracts are included. A relevant edit expires
review; unrelated semantic revision, layout, notes or unreferenced contracts do not.

This is authored acceptance intent, never a test result, simulation, measured objective or
implementation claim. Expectation completeness/freshness is separate from generation findings
and P51's requirement review completion. P51's review tool returns scenario status/fingerprints
separately. Chat reads the same document and uses `setArchitecture` with the same schemas and
validators. Ordinary supplied scenario edits need no additional approval; recording expectation
review must be requested explicitly. Scenario-bearing architecture snapshots refuse automatic
replay after a revision conflict, preserving concurrent changes and requiring a new read.

Mouse controls add/remove/reorder steps and alternatives, choose relationships and bindings,
edit outcomes and links, and select client states. Client component details list its journey
expectations. Fixed Save/Cancel remain reachable while forms scroll. Invalid references keep
the draft and disable Save; concurrent save failures retain edits for review. Semantic saves
are one undo step, support redo and survive reload. Layout remains separate.

The [scenario fixture](../fixtures/designs/architecture-scenarios.json) covers redirect cache
hit/miss, source fallback and queue-failure degradation; billing duplicate delivery; and an
owner action ending in success or denial. The original QRWTY target/P45 examples stay lossless.
[Recorded evidence](evidence/p54/README.md) gives actual checks and inspected captures. P54 adds
no routing, UI generation, application behavior, automatic tests or runtime templates. P55's
user-defined reuse library is the next separately requested package.
