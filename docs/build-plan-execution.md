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

## P15: validated Studio foundations

Inspection found two concrete prerequisites for saved artwork: the resource vocabulary has only text/URL/timestamp fields, and custom operations are GET-only. The existing session runtime already protects non-GET owner operations with Origin and CSRF checks. Extend these boundaries deliberately before adopting a new qrwty schema. P15 changes Jeeves only; P16 will bind the resulting contracts/rendering to qrwty and build the Studio UI.

Scope:

- Add bounded integer and finite enum resource fields, with strict design/input/output schemas, SQL constraints, generated descriptors, meaningful standard acceptance, and model-tool schema support. Preserve stable physical IDs and old field behavior. Existing constraint changes require reviewed migration; never silently narrow or discard data.
- Allow owner-only POST extension commands with an explicit required JSON request-body contract. GET body contracts and public POST commands remain unsupported. Generate the declared method/body into OpenAPI and typed clients; verify missing/invalid bodies, unknown fields, no session, wrong owner, missing/wrong CSRF and wrong Origin. Project features still cannot replace generated operations. Existing GET extensions and fixed acceptance stay compatible.
- Version the REST runtime artifact for the widened resource descriptor surface; do not overwrite qrwty's pinned runtime or regenerate it in this package. Record compatibility and adoption requirements. No model-provider invocation is needed for this work.
- Add a pinned, versioned QR artwork domain package. A strict finite configuration selects reviewed colors, square/rounded modules, bounded finder styles, 256/512/1024px PNG or SVG, quiet zone of at least four modules and M/Q/H correction. Keep canonical encoded URL separate from mutable destination. Enforce useful module resolution and conservative color constraints without presenting a numeric heuristic as a scan guarantee. No logo uploads or arbitrary artwork in this package.
- Render deterministically on the server from canonical URL + configuration + renderer version. Produce identical bytes for identical inputs. Independently decode representative exports across presets, sizes, rotation and bounded degradation; reject invalid settings. State exactly what the checks prove. A saved artwork revision will pin this renderer/configuration in P16; legacy 512px PNG behavior remains a separate unchanged endpoint.

Done when:

- Focused offline schema/generator/runtime/renderer tests pass, including invalid command authorization and migration cases; `pnpm check` passes.
- An isolated generated fixture compiles and exercises the new typed resource and owner command through actual HTTP/Postgres, including persistence/restart and cross-owner denial. Existing relevant REST/resource conformance remains green; no live qrwty or database change.
- Diff review confirms old identity/ownership protections and no weakening of QR-01–QR-09. Append the P15 handoff and create its scoped local commit.

Next: P16, immutable artwork revision adoption and the qrwty Studio product flow. Reuse P14's shell, add a generic preset/configuration editor verified against a non-QR example, preserve printed QR identity/legacy exports, and prove the controlled additive migration in disposable copies before live adoption. Owner-wide analytics, deterministic product recipes and C4/reliability packages follow separately.

## P16: repeatable work and architecture reference library

The user's subsequent overnight instruction adds code-based research of mature open-source applications, reusable task automation and a lighter verification strategy. Before Studio work begins, use this package slot for those prerequisites; the previously proposed Studio adoption moves to P17. Continue implementation without waiting for feedback. No package may claim bug-free or enterprise-ready behavior from limited evidence.

Scope:

- Provide one local command for the existing check gate, selected unit/template/browser tests, and disposable qrwty verification. Save complete local logs plus a concise machine-readable result containing the exact command, duration, exit status and repository fingerprint. Preserve failures and interrupted runs honestly. No automatic cache-based skipping, model calls, arbitrary shell execution or live application regeneration.
- Provide a pinned architecture-reference catalog and a repeatable source-fetch command. Inspect actual implementation seams and license files for Medusa, Payload, Umami, Zulip and Backstage. Record commit IDs, file hashes, strengths, costs, license boundaries and concrete candidate Jeeves components. Download source only for inspection; do not execute or install upstream applications or silently copy their code into generated products.
- Connect each candidate to a C4 responsibility, deterministic configuration contract, model-owned extension seam, qrwty or second-consumer proving case, and an explicit maturity state. Favor coherent contracts and constrained defaults over an indiscriminate template catalog. Reuse architectural patterns first; direct source adoption requires a separately scoped provenance and compatibility decision.
- Record the user's verification preference: run focused checks for changed behavior and the existing required `pnpm check` before each handoff; run relevant integration/browser checks when boundaries change. Defer exhaustive reliability, load, chaos, combinatorial and certification-style testing to the later testing campaign. Track deferred evidence instead of converting untested behavior into a passing claim.

Done when:

- The command can list tasks, run a selected existing test, report a real failed command and reject invalid selections; the check gate runs through it successfully. Interrupt/cleanup behavior is inspected without touching live stacks.
- Five references have immutable source provenance and inspected implementation evidence. Fetching pinned selected files validates hashes and can reuse a local verified cache without network access; a mismatched file is rejected.
- `pnpm check`, script type checking and diff review pass. Append the P16 handoff and commit only scoped changes. No live qrwty or generated ownership changes.

Next: P17, immutable artwork revisions and qrwty Studio adoption, using the P15 renderer and command schema. Then owner-wide analytics, deterministic product recipes, C4/configuration and selected enterprise components. Expand implementation in bounded packages, with the final original-plan and Excalidraw/automation-pitch review still required.
