# P52 — Current and target design workspaces

The project menu now creates a separate planning target with an immutable source baseline and
provenance. Stable model identities, exact pins, configuration and layout copy; output ownership,
generation/run history, verification passes and semantic history do not. The
[workspace contract](../../architecture-targets.md) describes the shared creation schema,
transaction boundary, recipe modes, comparison and annotation sources.

Protected recipe copies retain their core constraints. An explicit conceptual-replacement
creation requires a reason, preserves the original recipe/configuration in its frozen baseline,
and omits the active recipe binding only in the new planning project. Target APIs refuse output
assignment, generation and run creation before filesystem work or scheduling. Existing source
projects, executable templates, generator behavior and generated locks remain unchanged.

Current baseline, Proposed target and Changes show saved topologies separately. Stable-identity
before/after changes belong to the proposal; current source drift is a separate observation.
Neither a baseline nor a target proves deployment. Source deletion leaves the retained snapshot.
No automatic merge, baseline refresh, reconciliation, live adoption or selective generation exists.

Sourced annotation drafts use explicit session-authentication, resource and extension bindings.
Editable names/responsibilities and exact historical sources survive save, undo/redo and reload.
Names and operation paths never establish business behavior. Mouse and scripted chat use the
same suggestion/operation validators, including the saved project name and stale-source refusal.
Chat target creation shares the service and commits separately from design edits.

## Inspected production captures

Opened the seven **1440 × 900 light / 390 × 844 dark** captures. Baseline topology, proposed/source
changes, exact annotation sources and recipe-mode consequences are readable. Fixed actions stay
reachable while the narrow form body scrolls; fields and source references wrap without page overflow.

- [Target creation from a three-container fixture](p52-create-light.png)
- [Frozen baseline and saved-design facts](p52-baseline-light.png)
- [Proposed changes and separate source drift](p52-changes-light.png)
- [Narrow dark comparison and fixed actions](p52-changes-dark.png)
- [Editable responsibility groups with exact sources](p52-annotations-light.png)
- [Narrow dark annotations with Save/Cancel](p52-annotations-dark.png)
- [Explicit conceptual recipe replacement with reason](p52-replacement-light.png)

## Verification and limits

Final verification passes: **61 focused tests / 5 files**, **843 full-check tests / 117 files**
and **9 production browser journeys**. Commands, timings, run identities and interim findings
are in the append-only [handoff](../../handoff.md). Every recorded final run retained its fingerprint.

Service/API tests cover legacy snapshots, stable identities, source isolation/drift/deletion,
protected recipes, explicit conceptual replacements, incomplete planning documents with strict
ordinary creation retained, structural refusal, stale creation and injected persistence rollback.
They prove no source-output change, no inherited history/evidence and no generator invocation.
Target-origin PATCH attempts are rejected. Annotation sources remain editable through history.
Source identity/revision/snapshot observations use one joined read.

Scripted chat proves creation without source mutation, stale-creation refusal, exact mouse
annotation parity and one-step undo, and stale-annotation refusal. Generator compatibility
compares executable files, contracts, artifacts and ownership while allowing the lossless design
snapshot to retain annotation provenance. No generated goldens are refreshed.

Mouse journeys cover creation from legacy and recipe fixtures, explicit replacement reasons,
retained stale drafts, target editing/history/reload, source drift/deletion and sourced annotations.
Strict browser diagnostics, the single narrowly registered expected creation conflict, axe
(including contrast) and narrow overflow checks pass. Test cleanup leaves no P52 projects in the
isolated E2E database. The four fixtures left by the first timed-out run were removed by exact ID.

Migration metadata is generated from the real schema, matches the scoped additive SQL exactly,
and passes `drizzle-kit check`; only the nullable `projects.target` column is added. Live qrwty,
source application output, runtime availability, dependencies and provisioning are unchanged.
P53 deployment planning is next, only when requested.
