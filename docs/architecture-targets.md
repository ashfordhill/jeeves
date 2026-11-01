# Current and target design workspaces

P52 adds **Create target from this design** in the project menu. A target is a separate,
editable planning project. Its immutable origin records the source project's ID/name/revision,
capture time, schema version and complete baseline semantic snapshot. Stable model identities,
exact template pins, configuration, starter provenance and layout copy into the new project.
The baseline retains legacy documents; editing uses the existing lossless v2 conversion.

The source's output folder, generation/run history, chat and undo history do not transfer.
The target has its own semantic history and layout. Source deletion does not cascade to the
snapshot. No automatic merge, refresh, rebase, live adoption or generation subset exists.
The link identifies a saved design, not a deployed application.

## Creation and protection

`POST /projects/:id/targets` accepts `name`, `baseRevision`, optional `recipeMode` and `reason`.
The default `protected-copy` retains the active recipe binding/configuration and protected core
checks. Removing or replacing that binding is refused in the protected target. Changing protected
core contracts still fails the existing recipe validator. Exact runtime pins are copied faithfully.

For a protected source, **Plan an editable conceptual replacement** is a separate explicit
creation choice requiring a reason. Only that new target omits the active recipe binding;
the original binding, configuration and constraints remain in its frozen baseline. It still
cannot generate, take output ownership or start implementation. This choice never detaches a
source recipe or authorizes overwriting generated files. Changes remain planning intent.

Creation locks the source revision and inserts the project, revision zero and copied layout in
one transaction. A stale revision returns 409 with the current design. Invalid structural input
or a persistence failure leaves no orphan project or partial snapshot. Only this scoped planning
path accepts structurally valid incomplete designs, retaining their readiness findings. Ordinary
starter/recipe/project creation retains its stricter readiness requirements.

The immutable project origin is outside editable design operations. The project PATCH schema
cannot change it. Output-folder assignment, generation and run creation are refused at the
service/API boundary with `PLANNING_WORKSPACE`, before output reads/writes or work scheduling.
The target editor hides Generate; Runs reports planning-only readiness and cannot plan a run.
No generator semantics, executable templates or ownership locks change.

## Navigation and source drift

**Proposed target** is the normal editable C1/C2/C3 workspace. **Current baseline** opens a
read-only saved topology and full semantic snapshot; **Changes** shows additions, removals and
changes by stable identity with before/after values. The comparison's Proposed target tab shows
only the target snapshot. Both topologies are never superimposed.

`GET /projects/:id/target` returns the frozen origin, current proposed document, proposed changes
and a separate observation of the latest source revision/drift. **Check source drift** re-reads
those saved facts. It never refreshes the baseline. A revision-only source change is distinguished
from semantic drift. Revisions/layout and top-level collection order do not create a semantic diff;
contract identities include exact versions. Source drift remains separate from proposed changes.
A deleted source leaves an explicit notice and the complete baseline.

These saved-design facts are separate from the existing evidence dialog, which reports only the
target's own project identity. Clones inherit no verification passes, deployment claims or output
ownership. Declared template/recipe availability describes design coverage, not measured execution.

## Sourced, editable annotations

**Suggest responsibility annotations** in Editor actions previews drafts from explicit REST
server session-authentication, resource and extension bindings. It preserves existing authored
architecture and primary memberships. Unassigned resources/extensions start in responsibility
groups for review; operation names/paths never establish business behavior. A session binding can
suggest a generic actor, whose actual roles still need editing.

Each suggested node/component retains `annotationOrigin`: the saved revision, exact element /
attachment / member references and the stated basis. These are historical suggestion inputs,
not assertions of current binding validity or implementation. Names/responsibilities are editable
before saving and in the existing context/component editors afterwards. Save is one validated
`setArchitecture` batch with undo/redo/reload and conflict protection. Invalid/conflicting drafts
remain open; Cancel discards them explicitly. Suggestions add no runtime behavior or evidence.

Chat's `getArchitectureAnnotationDraft` uses the same pure suggestion function; edits use the
same operations. Save pending edits before requesting a draft with saved source provenance.
Sourced snapshots refuse stale replay over concurrent revisions. `createTargetWorkspace` uses
the same creation schema/service and must be in a separate turn from design edits; creation
commits at turn completion and returns a target link. It needs no blanket approval step. A
stale source creates nothing and requires a fresh read. Chat never executes Generate or runs.

The [roadmap](build-plan-c4-evolution.md#p52--current-and-target-design-workspaces) and
[P52 evidence](evidence/p52/README.md) bound this package. P53 deployment planning is separate.
