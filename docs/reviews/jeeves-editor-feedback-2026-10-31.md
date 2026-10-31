# Jeeves editor feedback: integrated C4 authoring

Reviewed 2026-10-31. This records the user's latest direction and its effect on the
next package. No application implementation was performed during this review.

Source: `/home/ash/.opencode/jeeves-feedback/`. Read `JEEVES.md`, inspected both
current-UI screenshots and the editor sketch, and checked the Excalidraw labels.
The [original feedback](assets/2026-10-31/JEEVES.md) and
[editor sketch](assets/2026-10-31/editor-1.png) are retained here. The copied text
normalizes Windows line endings and trailing whitespace; its wording is unchanged.
The existing
screenshots establish the user's observed UX; they are not a fresh live-app test.

## Confirmed direction

- One editor: collapsible LLM chat on the left, design canvas in the center and
  the selected object's configuration on the right. C1/C2/C3 tabs change the
  level being edited without sending the user to a separate architecture page.
- Higher-level objects retain their identities as users drill into more detailed
  configuration. Editing any level updates the same design.
- Each box and arrow type needs appropriate controls, labels and useful defaults.
  A template's configurable behavior must have a corresponding usable editor.
  Complex JSON and implementation prompts should not be the primary interaction.
- C4 architecture comes first. Page purpose/navigation/flows and eventual visual
  page layout are separate design concerns. The UI Flow Editor in the sketch is
  a future sibling workspace; it is not part of this C4 implementation.
- Use QRWTY to prove the editor, while supporting reusable SaaS architectures.
  Caching, load balancing, redirects, security, databases and storage need visible
  architectural meaning and meaningful options as those capabilities are added.
  Millions of daily users is a design ambition, not measured capacity of the
  current local templates.
- Preserve room for browser, mobile and desktop clients. Their architecture-facing
  responsibilities and API relationships belong in the model; screen design and
  platform-specific generation remain separate future contracts.
- Improve chat later with visible token usage/cost/context consumption and an
  answer-review experience before submission. Confirm the desired multi-question
  interaction when that package is specified; it does not block C4 work.
- Prioritize usable design over adding new safeguard workflows. Reuse the existing
  validation, undo, draft handling and generation protections.
- Work with one agent in the current checkout/branch. No additional worktrees,
  branches or delegated agents. Make local commits as work completes.

Use the repository's existing C4 vocabulary consistently: C1 is the system context
with people and external systems; C2 contains applications and data stores; C3
contains responsibilities inside an application. A web application is normally
represented at C2 under its system. Do not introduce a different hierarchy merely
because the feedback informally calls a web application a C1 component.

## What the code explains

| Finding | Existing seam | Consequence |
| --- | --- | --- |
| Architecture replaces the board workspace | `apps/web/src/draw/DrawView.tsx`, `architectureOpen` early return | Chat, inspector and primary canvas need a shared shell across levels |
| Selected architecture objects send users back to the board | `apps/web/src/architecture/ArchitectureWorkspace.tsx`, `editElementOnBoard` | Configure the selected object in its current scope |
| Chat competes with Inspector in the right rail | `apps/web/src/draw/inspector/Rail.tsx` | Give chat its own collapsible area as shown in the sketch |
| Template forms already have typed schema/default/preset inputs, with specialized editors for several capabilities | `packages/spec/src/manifest.ts`, `apps/web/src/draw/inspector/` | Reuse and connect these editors; establish a consistent template-to-editor mapping |
| P36 already specifies responsibility bindings and readable diagrams | `docs/build-plan-p36-architecture.md` | Retain that work, adding the integrated editing shell and relationship inspection to acceptance |
| Model responses expose token totals and optional cost, but streamed model events currently carry text only | `packages/providers/src/types.ts` | Live usage/context needs a distinct provider/UI contract; cumulative tokens are not current context occupancy |

## Next implementation: revised P36

[P36](../build-plan-p36-architecture.md) now includes the shared editor shell,
C1/C2/C3 navigation, object/relationship-specific controls, existing editable C2
board behavior and directly configurable C3 responsibilities. Retain its reviewed
QRWTY five-responsibility fixture, non-QR proof, concise cards, fit, atomic edits
and generation-invariance checks. One model and the existing React Flow engine
remain the foundation.

The package should visibly answer the sketch: select a box or arrow at the current
level, inspect/edit the relevant properties on the right, switch levels while
keeping chat available, then return with scope and selection intact. P36 is not
complete if it only improves the separate Architecture page.

Broader capability work follows in individual packages. Map each capability to
its architectural role, editable contract, generated output and verification.
Keep logical applications distinct from their deployment instances while making
their supported deployment configuration accessible from the same editor.
Existing local execution/pool components are a starting point, not general
enterprise scaling support. New cache/storage/cloud runtimes and capacity proofs
are separate implementation work.

One clarification was requested: should not-yet-generatable enterprise capabilities
be available as clearly marked planned objects, or should the palette show only
working templates? The recommendation is to allow explicitly planned capabilities;
this is not yet a user decision and P36 does not depend on implementing them.

Chat usage/answer review, persistent developer testing, page flows and composable
live adoption remain visible follow-ups. The latest priority is architecture UX;
do not treat older next-package paragraphs as a reason to divert into page design
or developer testing automatically.

## Checkpoint and verification

All pre-existing uncommitted Jeeves work was committed on `main` as `1c607d3`
(`docs: checkpoint existing product reviews and planning`). It comprised historical
review documents/assets and handoff/plan changes, with no application source edits.
One trailing-space line in the review was normalized for `git diff --check`.

Before documentation updates, `pnpm check` passed: 671 files checked by Biome,
462 existing warnings/74 informational diagnostics, all typechecks, and 656 tests
across 98 files. Log: `/tmp/jeeves-feedback-baseline-check.log`; Vitest duration
33.51 seconds. No browser run, provider call, deployment or live QRWTY edit was
needed for this source/document review. Final document links and diff checks are
recorded in the appended handoff.
