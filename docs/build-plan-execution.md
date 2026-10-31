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

## P14: qrwty session, shell and library foundation

Outcome: a branded, responsive QR workspace using the existing contracts, with an independently consumable Jeeves product shell. This is the first product slice, not completed Studio or architecture-model delivery.

Read qrwty's ownership instructions, web element notes, project-owned components and supplemental workflows; the 2026-10-30 product concepts; automation-pitch's visual improvement log; and the existing runtime/package conventions. Preserve the generated files, runtime artifacts, server behavior, database and public QR URLs.

Scope:

- Replace the sparse proof layout with a dark-blue qrwty workspace: clear brand, responsive navigation, page hierarchy, create form, manageable library, selected details, contextual feedback and honest loading/empty/error states. Navigation and every action must work with a mouse, remain readable at 390px, and preserve the protected QR-09 hooks and row-scoped actions.
- Keep the existing create/edit/pagination/download/activity contracts. Add copy-link feedback and a server-image preview on explicit request; do not synthesize QR artwork in the browser, invent account-wide totals/search, or offer inactive Studio controls.
- Fix failed logout, distinguish session-check failure from signed-out state, preserve entered form values on errors, and prevent stale async responses from replacing newer list/activity results.
- Adopt ordinary generated-client fetch and remove the project-owned Worker workaround. Use P12's strict observer in supplemental browser tests with explicitly required negative responses; retain unexpected request/asset/console/exception detection. Do not edit the old generated acceptance files to adopt the observer.
- Extract the proven layout/feedback primitives into versioned `@jeeves/product-ui`, with source exports in the workspace, compiled immutable package artifacts for consumers, scoped theme tokens, accessible navigation and no QR/API coupling. Verify a non-QR consumer. The qrwty artifact goes in a project-owned `artifacts/` directory; protected `vendor/jeeves/` and generated ownership hashes remain unchanged. Automatic template wiring is a subsequent package, not implied by manual adoption.

Done when:

- `pnpm check` passes in Jeeves; qrwty install, recursive typecheck/unit/workflow checks and frontend production build pass.
- Supplemental Chromium workflows verify ordinary fetch, required negative scenarios, failure/retry state, copy/preview, responsive layout and accessibility. Capture desktop/mobile visual evidence and inspect it.
- A disposable composed copy passes the fixed qrwty acceptance and template checks relevant to the changed frontend. It uses an isolated database/volume and loopback port; no live data or generated-owned files are changed. Build/start checks run against that disposable copy before adopting the frontend locally.
- Review both repository diffs and protected-file hashes, append the implementation handoff with commands/results and remaining limits, and create scoped local P14 commits. Existing review/planning additions remain uncommitted and preserved.

Next: bounded immutable artwork/Studio contract and rendering package, followed by deterministic product-recipe adoption and C4/configuration/reliability packages. Specify each before coding and use measured acceptance to decide its actual scope.
