# Studio UX and configurable architecture build plan

**Status: specified, not implemented.** Written 2026-11-03 for sequential Sol 6.1 xhigh
assignments. The owner has completed the review questions; this document translates the answers
into concrete implementation work. Do not execute the queue merely because this plan exists.

This plan replaces conflicting historical UI requirements for the current cleanup. It does not
resume P73a/P73b or the backend runtime roadmap. P73a remains a partial checkpoint. Existing
runtime/template availability, frozen benchmark obligations and recorded evidence remain truthful.

## 1. Read these documents as one specification

| Document | Purpose |
| --- | --- |
| [Final owner decisions](../.docs/visual-improvements/2026-11-03-ux-review/DECISIONS-FINAL.md) | R01–R07, C4a/C4b boundary, delegated choices and deferred questions. |
| [First answers and Q01–Q42 trace](../.docs/visual-improvements/2026-11-03-ux-review/DECISIONS-ROUND-1.md) | Earlier decisions retained across the owner's successive messages. |
| [Review and original evidence](../.docs/visual-improvements/2026-11-03-ux-review/REVIEW.md) | Screenshots, recordings, inspected code, source manifest and automation-pitch references. |
| [Model contract](plans/studio-ux/model-contract.md) | Canonical identities, finite definitions, packages, resources, queue projection, compatibility and mutations. |
| [Configuration matrix](plans/studio-ux/configuration-matrix.md) | Every first-version field, its storage, defaults, visibility and exclusions. This is an allowlist. |
| [Interaction contract](plans/studio-ux/interaction-contract.md) | Shell, inspector, autosave, gestures, labels, layout and Generate. |
| [Example coverage](plans/studio-ux/example-coverage.md) | All examples, goal provenance, C4b boundaries and design versus runtime acceptance. |
| [25-unit execution queue](plans/studio-ux/execution-units.md) | Exact assignments, dependencies, code seams, checks and handoff requirements. |

Precedence: latest owner instruction → final decisions → this specification and its contracts →
older plans/guides. The Q/R records retain historical wording; “open” in the earlier record does
not reopen an R decision resolved in the final record. Historical architecture evidence describes
the version inspected, not the interface to rebuild.

## 2. Intended result

Jeeves is a design studio for selecting, connecting and configuring a finite set of understandable
building blocks. A user can prompt an initial architecture, inspect it at C1/C2/C3, adjust useful
technical settings, place cards neatly and inspect implementation readiness in Generate.

The normal diagram contains names, recognizable symbols and short relationships. Detailed
settings appear only for a selected configurable object. C2 usually shows services and resources;
a service package can compact several independent services into one card. C3 exposes meaningful
children and dependencies, including queues. Scalar choices do not become little boxes.

The product prefers Docker for Jeeves-managed services and supports language intent independently
of today's TypeScript templates. Providers supply established infrastructure and integrations.
Jeeves does not become a cloud control panel, route designer, database schema editor or business
workflow programming environment. Project-specific additions belong in C4b, as shown in the
[README diagram](../.docs/c4-flow.svg).

## 3. Scope and exclusions

Included:

- A bounded, versioned studio contract over the existing design identities; finite design
  definitions and provider choices; one source for each editable value.
- Service/package distinction, shared stores and C3 queues, sensible C2/C3 projection, compact
  typed configuration, operation validation, persistence, undo and portable preservation.
- A reduced shell, contextual toolbar, useful library, autosave inspector, clear icons/shapes,
  semantic text density, connection trunks, stable drag and automatic/grid-guided placement.
- Generate as the single destination for readiness, C4b obligations, existing execution, history
  and outputs. Readiness uses actual support; opening Generate does not execute anything.
- Assistant alignment with the same finite manual-edit vocabulary and available usage data.
- Fresh example diagrams reconstructed from documented goals and preserved source references.

Excluded:

- New application runtimes, generators, template harnesses, provider provisioning, real service
  deployments, Kubernetes/Helm, a separate-generator architecture decision or live integration calls.
- Manual HTTP route/type/entity/field, access-policy, command, state-machine, lifecycle, effect,
  hook, entitlement, subscription-plan, trial-day or business-rule authoring.
- A generic “custom configuration” JSON editor, arbitrary code/expression boxes or a new DSL.
- Named/focused diagrams, an Explorer/minimap, annotations/text/notes/frames, implicit structural
  zoom, mobile layouts, broad chat redesign and unit/E2E suite maintenance/execution.
- Updating the dropshipping/QRWTY application repositories or replacing users' live projects.

Removal of an editing surface does not authorize deletion of old data. A finite template can still
contain contracts, schemas and behavior internally. Those are template-owned, not new manual UI.

## 4. Non-negotiable outcomes

1. **UI restraint:** no empty tabs, report dumps, permanently displayed capability lists, redundant
   category captions, persistent Saved badge, unrelated fading or dashed status outlines on boxes.
2. **Honest structure:** a service package is not a runtime; a queue is not a fabricated service;
   sharing physical storage does not imply sharing a logical store. Provider choice creates no
   invisible deployable code. Diagram simplification never deletes semantic relationships.
3. **Useful editing:** every displayed control has a typed destination and an observable save;
   every displayed child exists for a meaningful setting/connection, not merely editable naming.
4. **Durability:** valid edits finish saving across selection changes; rejected writes are visible;
   layout, provider selection and navigation cannot overwrite a newer semantic revision.
5. **Stable movement:** unrelated nodes and edges remain drawn during drag; layout changes never
   add connections, change membership or rewrite business intent. Tidy and fit is predictable.
6. **Truthful availability:** design definition ≠ runtime template ≠ verified behavior. Planned
   language/provider combinations stay planned. Hidden legacy obligations still affect readiness.
7. **Broad coverage:** all shipped examples plus the documented field studies are accounted for.
   QRWTY participates without dictating every capability or acceptance scenario.

## 5. Delivery and verification

The new namespace **UX01–UX15**, including mandatory child units, avoids collisions with S/P
history and P58–P110. There are **25 individual assignments**, all initially unstarted. Assign one
exact unit. A request for a split parent means its first unfinished child only. Commit each completed
unit locally with its exact ID; do not combine children or advance automatically.

Work on primary `main`, preserve unrelated `.jeeves-feedback/`, and read the latest handoff before
each assignment. Do not delegate or create worktrees. Read PLAN §15; this task's explicit check
profile supersedes its older suite requirement:

```sh
pnpm lint
pnpm typecheck
pnpm --filter @jeeves/web build
```

Use the repository's Node >=24 environment. Inspect changed interactions directly in a browser at
1440×900 and 1280×800; 1600×1000 is an optional comparison with review evidence. This is ordinary
desktop coverage, not a mobile project. Inspect the browser console and relevant network saves.
Use disposable demo projects for mutations, not the user's active diagrams. Keep servers bound to
127.0.0.1 on the documented ports.

Do not run `pnpm check`, unit/E2E/template suites or repair their snapshots in these UX assignments.
Typecheck still includes existing source/test types; record a pre-existing error rather than hiding
it or turning this into test maintenance. Small one-off schema/round-trip inspections and direct
browser automation are permitted verification; do not disguise a newly maintained test suite as
“manual inspection.” Record exactly what ran and what was deferred. Existing lint warnings are not
new regressions; report the comparison, never suppress them broadly.

Evidence lives under `docs/evidence/studio-ux/<unit>/`: concise README, actual screenshots/recordings,
small public fixtures or captured sanitized observations as needed. Source-feedback files stay
byte-identical. Never use screenshot existence alone as proof that a gesture, save or conflict works.

## 6. Rollout and compatibility

Build the new surface behind a temporary `studio=next` URL flag introduced in UX05, with no visible
feature-toggle menu. It composes the existing app/store; do not fork a second application. Earlier
model/projection units are usable by disposable fixtures without changing the normal interface.
UX15 switches the default only after the combined checks pass, then removes the temporary switch.
Do not ship empty toolbar actions or placeholder tabs as the final interface.

Existing projects open through the compatibility projection described in the model contract.
Opening, zooming, changing depth or saving layout never rewrites their semantic document. Older
backend declarations and focused-layout records remain preserved/exportable; their old editors do
not reappear in the normal studio. New examples are separate projects with provenance, not an
automatic migration of every saved project.

Reconstruction is not permission to retarget the frozen Discourse/Vendure/Zammad benchmarks or
declare their runtimes complete. Their detailed source fixtures remain intact. New studio examples
can classify custom behavior as C4b while the benchmark still correctly reports it unimplemented.

## 7. Completion gate and later field test

UX15 closes this plan only when the model/UI contracts and every coverage row have recorded
evidence, all 25 units are complete, existing supported generation remains reachable, and no
unsupported studio design can accidentally fall through to a legacy generator that ignores it.
The current guide and CATALOG must then describe the implemented UI and actual availability.

This establishes **design coverage**, not a working application for every example. A later runtime
task should pick generated builds, pin their template inputs, measure reproducibility, verify C4a
behavior and exercise C4b extension/regeneration boundaries. For dropshipping and QRWTY, useful
outcomes include the amount of bespoke code still required, number of low-level repair prompts,
clarity of integration points and verified behavior under failure. Do not manufacture targets or
declare those outcomes achieved during this UI work.

The next executable assignment, when requested, is **UX01**. No outstanding product question
requires another broad questionnaire before this plan can be reviewed.

## 8. Copyable single-unit assignment

Use this for an implementation session; replace only the unit ID after checking the latest handoff:

```text
Implement UX01 only from docs/plans/studio-ux/execution-units.md.
Read AGENTS.md, PLAN.md section 15, the latest docs/handoff.md entries,
docs/build-plan-studio-ux.md and the contracts named by UX01 before editing.
Work sequentially in /home/ash/github/jeeves on main. No delegation, branches or worktrees.
Preserve unrelated work, original feedback, old project data and paused backend work.
Stay within this unit. Do not implement later UX units or resume P73a/P73b.
Follow the UX verification profile: lint, typecheck, web production build and direct
browser inspection; unit/E2E maintenance and suite execution are deferred.
Record concrete evidence and remaining limitations, append the handoff, and make one
scoped local commit titled UX01: <concrete change>. Stop after that assignment.
If a product decision is still ambiguous, explain the exact conflict instead of inventing it.
```
