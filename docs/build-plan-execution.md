# Continuing delivery: qrwty and deterministic Jeeves

The user's continuing implementation instruction supersedes the earlier P12-only stop boundary and planning-only status of the product reviews. Deliver one verified package and local commit at a time, preserving unrelated work and existing QR identities/data. No paid Jeeves agent runs or public deployment are needed.

The product target is the branded qrwty QR Studio, management and analytics experience described in the 2026-10-30 reviews, with proven reusable behavior extracted into versioned Jeeves templates. C4-informed views should explain one model's responsibilities and implementation bindings; structured configuration should drive deterministic generation and tested reliability presets. Retain React Flow, the operations API, generated-file ownership and protected business acceptance. Do not invent cloud capacity/reliability claims without measured evidence.

Final acceptance also requires the user's subsequent review instruction: reconcile the completed system against Jeeves's original plan with explicit C4 model intentionality; inspect the automation-pitch repository and its `VISUAL_IMPROVEMENTS.md`; compare interaction ease and visual quality against automation-pitch and Excalidraw. Demonstrate diagram-level composition of the supported enterprise application capabilities with minimal implementation-model usage, report deterministic versus model-dependent coverage, and state unsupported capabilities honestly. Novelty is a design aspiration, not a claim to make without evidence.

## P13: editor interaction reconciliation

Outcome: finish the pending Draw Jeeves placement/control/geometry work so it is a dependable foundation for later architecture editing.

Read the pending diff and `apps/web/e2e/editor-interactions.spec.ts`, the relevant Draw components, existing draw/resource/inspector acceptance, and the latest handoff. PLAN §§1–14 and §15 remain background and process requirements.

Scope:

- Creation tools cannot accidentally activate existing card controls, create on top of cards, move cards, resize them or reconnect edges. Frame interiors remain valid placement surfaces.
- Subtype review/cancellation and compatible component controls work by mouse in selection mode. Creation and connection tools have an explicit mouse-accessible cancel action.
- Selection does not change card geometry. Opening the inspector keeps the diagram visible without changing semantic data or item positions.
- Reproduce and investigate the recorded ResizeObserver error. Correct related layout feedback if present; do not suppress browser errors.
- Record any required pinned dependency compatibility patch and verify the remaining browser suites when shared browser configuration or dependency behavior changes.
- Preserve the existing implementation where correct, extend acceptance for uncovered interaction regressions, and avoid an editor redesign.

Done when:

- Focused editor interaction, draw, resource-editor and inspector browser acceptance passes, including explicit unexpected browser-error detection for the new interaction tests.
- `pnpm check` and `git diff --check` pass.
- The scoped diff is reviewed, a handoff is appended, and P13 is locally committed. Earlier uncommitted review/planning/handoff work stays outside the commit.

Next: define and implement a bounded qrwty session/shell/library product package using existing backend contracts, with controlled adoption in project-owned code and shared deterministic UI primitives. Then address artwork revisions/Studio, extract the proven recipe, and expose structured C4/configuration views in successive independently verified packages. Each package receives its detailed specification before implementation.
