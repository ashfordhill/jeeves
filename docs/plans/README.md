# Plans and execution status

The owner selects work; a historical plan header or a root AGENTS pointer does not restart its
queue. Current behavior is documented in the [studio guide](../studio.md),
[generator guide](../../jeeves-generator/README.md) and [template gaps](../template-gaps.md).
Earlier plans and evidence remain preserved below.

## QRWTY v2

- The generator work is ready to assign to a coordinator. Its three implementation units cover Auth0, native Stripe notifications and configurable click retention. A fresh reviewer verifies the combined export. [Generator plan](qrwty-v2-generator/units.md) · [Copyable coordinator prompt](qrwty-v2-generator/coordinator-prompt.md)
- The field build follows that handoff. It uses the reviewed diagram, measures the finished backend, compares shared behavior with the frozen v1 B implementation and rehearses deploy readiness locally. The lower-cost model experiment is a separate future study. [QRWTY v2 build and evaluation](../field-projects/qrwty/v2-build-plan.md)

## Current handback and final review

- [Reliable generation](reliable-generation/README.md): **RG01–RG26 accepted**, through amended
  RG26 `0ea91d3`. The [owner handback](reliable-generation/owner-handback.md) records its shipped
  capabilities, finite proof, migration costs and gaps. It creates no extra implementation units.
- [Wires and deployment](wires-and-deployment/units.md), approved by owner commit `95d60ac`:
  WD01–05/08–11/13 and WD14 review are accepted; WD06/07/12 keep their historical stop records.
  The owner subsequently asked, “can you have an agent finish it?” The **Finish studio wire
  rendering and interaction** follow-up adapts obsolete shared-line test assumptions as necessary
  implementation work. Studio wires and hover now ship in both
  views; [follow-up evidence](wires-and-deployment/evidence/wire-ui-finish/README.md) and the
  [current review](wires-and-deployment/review.md) separate that result from the historical stops.
  WD12's exported failure drill/check/workflow remains unavailable. This follow-up starts no new unit.

## Preserved earlier work

Status is reconciled from code, Git subjects and the append-only [handoff](../handoff.md),
not copied from old planning headers. Completed mechanisms remain the implementation baseline;
unfinished outlines have no execution authority unless the owner selects them again.

| Earlier plan | Actual disposition |
| --- | --- |
| [Lane grid](lane-grid/execution-units.md), [polish](lane-grid/polish-units.md), [design polish](design-polish/units.md), [lane actions](lane-actions/units.md), [system design](system-design/units.md) | Completed LG01–13, PL01–02, DP01–10, LA01–05 and SD01–05; historical studio baseline. |
| [Reliable foundations](reliable-foundations/units.md) | RF00–07 completed the studio/review phase (RF06 tooling has its recorded model-evidence limit). The wider original runtime queue was superseded; do not treat it as fully implemented. |
| [Next contract](reliable-foundations/next-contract-plan.md), [separate backend proof](reliable-foundations/backend-first-proof-plan.md) | NC01–06 and NC14 completed; NC07–13 and the separate-backend TinyURL proof remain deferred/inactive. The retired strict-review surface is historical, not a new runtime commitment. |
| [YouTube field plan](reliable-foundations/youtube-field-project-plan.md), [v2](reliable-foundations/youtube-v2-plan.md) | FP00–FP07b and YV2-01–23 completed their bounded experiments; the [generic replay](reliable-foundations/youtube-v2-generic-baseline.md) preserves the provenance correction. Further products/iterations are not queued. |
| [UI overhaul](ui-overhaul/units.md), [module authoring](module-authoring/units.md), [tile processes](tile-processes/units.md), [YouTube v3](youtube-v3/units.md) | UI01–10, MA01–10, TP01–09 and V3-01–19 completed. Historical product exports/reviews remain unchanged. |
| [Production foundations](production-foundations/units.md), [UI refresh](ui-refresh/units.md), [broker reconnect](broker-reconnect/units.md), [generated system tests](generated-system-tests/units.md), [UI follow-ups](ui-followups/units.md) | PF01–14, refresh UI01–14, BR01–02, GS01–09 and UF01–06 completed; old “nothing implemented” introductions describe planning time only. |
| [Store outage](store-outage/units.md) | SO01–05 and SO08 completed. SO06–07 request-failure classification/log-format suggestions in the review remain inactive; neither was executed as an old unit. |
| [QRWTY gaps](qrwty-gaps/units.md) | QG01–12 and QG17–35 plus QGR1–3 completed. QG13–16 were deferred outlines; their generic transaction/scheduling/lifecycle needs are now addressed within RG's narrower contracts. Per-route exposure, provider/cloud details and broader variants remain unsupported/deferred. |
| [QRWTY lessons](qrwty-lessons/units.md) | QL01 folded into QG09; QL02–05 implemented. Unimplemented QL06–14 are superseded by RG08, RG02–04, RG15–16, RG05/13, RG09, RG19–21 and RG14/25 as mapped [here](reliable-generation/evidence.md#disposition-of-unimplemented-plans). No remaining QL queue. |
| QG36–39 remnants | QG36 configuration parity absorbed by RG02; QG37 declarations implemented in QL05 and tightened in RG02/08. Diagram-level arbitrary setting names were not added. QG38/39 versioned SQL/grants replaced by RG06/07. No old unit is silently relabelled executed. |

The newer QRWTY plan above specifies the Stripe receiver and Auth0 work. Broader provider packs,
account erasure/sagas, managed credential refresh and cloud adapters remain deferred choices.
The Wires and deployment work had its own owner authorization. The frozen QRWTY evaluations
and original drain assessment remain historical evidence, with the correction linked from the
[handback](reliable-generation/owner-handback.md).
