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

## P17: saved artwork and the qrwty Studio

Outcome: a usable, responsive Studio for an existing QR link, with server-rendered previews and immutable PNG/SVG exports. Keep printed URL identity, existing destination/activity behavior and the legacy PNG endpoint unchanged. Use P16's focused verification workflow; do not expand into a scan-certification or load-testing campaign.

Scope:

- Add a reviewed `qrwty-studio` design/acceptance pack while retaining the original qrwty fixture. One additive internal `artwork` resource belongs to `qr`; it stores the full bounded configuration, server-established canonical URL, renderer version, PNG/SVG hashes and creation time. It has no standard CRUD routes. Add owner-only preview/save commands and owner-only bounded Studio/history/export queries. Every lookup scopes the QR and revision to the session owner; request bodies cannot supply identity, owner, origin or renderer version.
- Saves use a caller-generated UUID request ID as revision identity. Retrying the same normalized settings for the same owned QR returns the original revision; conflicting reuse returns a generic 409. New settings create a new immutable revision. Parent authorization and insertion occur within a transaction. History is limited to at most 25 rows with a cursor tied to that QR. Preserve the first saved canonical URL for later revisions; public-origin migration remains outside this package.
- Pin `@jeeves/qr-artwork@0.1.0` and verify saved export bytes against stored hashes. Preview/export use explicit typed JSON artifact envelopes (base64 bytes, media type and hash), because the current generic HTTP binary verifier supports PNG only. The browser saves those exact server bytes as PNG/SVG; it does not generate QR geometry. This deliberately avoids introducing an unreviewed generic SVG parser. Bound envelope sizes, retain server-side decode validation and verify exported content in acceptance.
- Add a Studio entry from the library and functional workspace navigation. Show preset choices, server preview, colors, module/finder shapes, finite sizes and advanced quiet-zone/correction settings. Clearly distinguish unsaved changes from a saved revision; disable export until the displayed settings match a saved revision. Save, reset, history selection, download, retry and navigation all work by mouse. Preserve drafts in memory when returning to the library, clear them with the session, and warn before leaving the page with unsaved work. Discarding customized settings requires an explicit mouse action.
- Extract the domain-independent preset/configuration editing interaction into `@jeeves/product-ui@0.2.0`, with a non-QR consumer check. Reuse P14's shell and qrwty visual direction, preserve fixed QR-09 hooks and normal generated-client fetch, and keep error/race handling explicit. Inspect desktop/phone screenshots and accessibility in the relevant states.
- Implement in a disposable qrwty checkout first. Regenerate through Jeeves, adopt the new REST runtime by changing the project-owned package pin, and add project-owned immutable renderer/UI artifacts. Preserve every existing vendor artifact and the old migration. Update protected acceptance only through the reviewed pack/generator, retaining QR-01–QR-09 behavior and adopting P12's strict browser helper.
- Before local adoption, prove the old-to-new additive migration with seeded old QR/scan/session data and unchanged legacy PNG/redirect behavior. Back up the live local database to a private path, preserve unrelated qrwty `business-analysis/`, apply the same reviewed design through Jeeves's operations API, and rebuild only necessary API/frontend services. Do not reset a database, alter the unrelated older stack, publish externally or run a paid implementation agent. Preserve unrelated editor/design changes when applying the model addition.

Done when:

- Focused command/revision/export checks cover invalid settings, owner/CSRF isolation, idempotent/conflicting retry, bounded history, pinned bytes and persistence. The old-to-new disposable migration retains existing identities, data and legacy output; the composed consumer passes its protected existing and new fixed acceptance.
- Jeeves's required check gate, qrwty type/unit checks and frontend build pass. Relevant strict browser workflows verify Studio save/export/draft recovery and failure states, with desktop/phone visual evidence; no broad browser-error suppression or Worker transport.
- Review both diffs, generated hashes, immutable artifacts and adoption evidence. Append the P17 handoff and create scoped local commits in each repository. Record remaining testing/architecture limits and continue to a bounded owner-wide analytics package, then deterministic recipe and C4/configuration delivery.

## P18: owner-wide analytics and bounded aggregation

Outcome: a useful qrwty Analytics workspace showing scan activity across the signed-in owner's links, with explicit counting semantics and reusable deterministic aggregation/presentation. Preserve per-QR activity, redirects, saved artwork and printed URLs. This is a focused product/component slice, not an analytics infrastructure migration.

Scope:

- Add one owner-only GET aggregate operation to a reviewed additive `qrwty-analytics` design/acceptance pack. The request supplies UTC start/end dates only; require valid calendar dates, ordered bounds and at most 90 inclusive days. Return zero-filled daily scan counts, total scans, total owned links, distinct active links and the top ten owned links, ordered deterministically. Counts mean recorded redirect events, not people or successful destination loads. No visitor fingerprinting, geo enrichment or external service.
- Extract `@jeeves/analytics@0.1.0`: a browser-safe strict UTC range contract/presets and a server-only owned-parent/child-event aggregate using validated descriptors, parameterized SQL, a read-only consistent transaction and fixed query timeout. No arbitrary diagram/user SQL. Bound result sizes and reject unsafe numeric counts. State that response/range limits are not a capacity guarantee. Prove the same component with non-QR inventory/event descriptors.
- Extract accessible count-chart/metric presentation into a new product-ui artifact version. The consuming application owns labels, navigation and loading/error state. qrwty adds Analytics navigation, 7/30/90-day presets, explicit custom date apply, loading/error/retry and empty states, top-link navigation to Studio and an accessible daily table. Old results must not be labeled as a newly selected range; stale requests must not replace newer results. Every action works by mouse. Inspect desktop/phone rendering and accessibility.
- Generate contracts/acceptance through Jeeves, pin immutable new artifacts and retain all previous ones. Implement in a disposable checkout first. Adopt only after focused actual HTTP/Postgres ownership/date/count checks, relevant strict browser checks, consumer types/build and the required Jeeves gate. No new database migration is needed. Preserve the unfinished live Service element and all unrelated work.

Done when:

- Focused tests cover calendar/range boundaries, zero-fill/count safety, authorization and owner isolation, cross-midnight UTC counting, top-ten ordering and non-QR descriptor use. The protected composed suite proves the new endpoint alongside existing QR-01–QR-14; no exhaustive load/chaos matrix.
- Analytics mouse journeys, failure/retry, range labeling, responsive views and accessibility pass. Exact artifacts, ownership hashes, live read-only adoption evidence and limits are recorded.
- Append the P18 handoff, review scoped diffs and commit each repository. Next: deterministic product recipes so these working components can assemble a complete application without a model implementation run; intentional C4/configuration views follow.

## P19: deterministic QR Studio product recipe

Outcome: create a new diagram from a versioned QR Studio recipe and generate the complete working library, Studio and analytics without an implementation-model call. Keep template generation available for other designs. This first recipe has a deliberately bounded compatibility/configuration envelope; it is not a claim that arbitrary applications generate without domain work.

Scope:

- Add an optional semantic recipe reference/configuration and an undoable operation to the design model. Preserve old documents and their hashes when no recipe is present. Record recipe ID/version and immutable source-manifest hash in generated provenance. A server-owned recipe catalog supplies metadata, an initial executable design, finite branding configuration, pinned source/artifacts and declared provided behavior. No source upload or arbitrary path/code in a request.
- Extract the current qrwty P18 implementation into a reviewed `qr-studio@0.1.0` recipe snapshot, with provenance back to the consumer/component commits. Freeze its fixed acceptance source and all packaged dependency artifacts. Generate recipe implementations as protected files, with a small explicit project-owned extension/customization seam; never silently take ownership of an existing application's feature files. Existing qrwty is not regenerated/adopted into recipe ownership in this package.
- Compose the recipe with the normal generator: validate its required resource/connection/template contract before writes, preserve immutable artifacts, include binary hashes in ownership, reject edited/unmanaged conflicts and incompatible recipe removal/version changes, and reproduce byte-identical outputs for equivalent inputs. Keep mutable notes/presentation separate from executable compatibility. Allow independent additional application work only where it cannot override the recipe contract; unsupported changes produce actionable findings/errors.
- Seed no implementation tasks for behavior provided by a validated recipe; retain tasks for genuinely unprovided extensions/elements. Report provided capabilities and evidence honestly. Generation baseline must execute the recipe's protected API/browser acceptance, not defer already supplied operations or frontend behavior. No planner/coder/provider calls are needed for the complete preset.
- Add a mouse-accessible “New from recipe” flow showing the provided product, maturity and bounded configuration. Create a separate project and positioned diagram without replacing the current project. Generate uses the recipe automatically from the semantic document. Provide safe local environment setup for a fresh recipe output (private ignored secrets, loopback public origin matching the selected free web port); preserve existing environment/data and stop on an incompatible origin change. Keep local start/stop status truthful.
- Provide a repeatable fresh-recipe verification command using a disposable output/database and no live qrwty dependency. Inspect the new UI flow and generated consumer; do not redesign the editor or begin cloud/distributed infrastructure here.

Done when:

- Focused schema/operations/ownership/recipe/seed/API checks pass, including old-document compatibility, deterministic regeneration, unmanaged/edited source and artifact refusal, incompatible binding refusal and zero model calls for provided behavior. `pnpm check` passes.
- From an empty disposable directory, the recipe installs, typechecks, builds and passes its relevant template and complete protected QR-01–QR-16 acceptance. No application implementation is copied from the live checkout at verification time. The mouse flow creates a separate diagram with the correct recipe/configuration and preserves the old project.
- Review ownership/provenance/diffs, append the P19 handoff and create its scoped commit. Preserve live qrwty and all unrelated work. Next: intentional C4 architecture/configuration views bound to these real capabilities, then the smallest useful enterprise reliability component and the required original-plan/Excalidraw/automation-pitch review.

## P20: intentional C4 architecture and structured product configuration

Outcome: people can understand and configure a real executable design at system-context, container and component levels, with mouse navigation between those levels and the existing editable board. Architecture intent and deterministic implementation coverage must be explicit; no inferred percentage or decorative “enterprise-ready” claim.

Scope:

- Update the original PLAN's current direction to make C4 intentional: system context describes people/external systems and purpose; containers are applications/data stores bound to executable elements; component views expose actual capabilities/domain extension modules within one container. Keep deployment topology/reliability separate. Retain the historical build sections and document the optional orchestration step for recipe-provided behavior. Cite the official C4 definitions; no copied C4 artwork.
- Add optional strict architecture intent to the semantic design: one system's name/responsibility, stable people/external-system identities, directed labeled context relations and optional explicit container bindings. Add an undoable operation and validation for duplicate/missing references, invalid context edges and unknown container bindings. Unbound intent is visible and never presented as implemented. Preserve old documents and existing executable identity/layout. Deleting a bound element must not leave an invisible stale architecture binding.
- Provide pure derived architecture projections. Container nodes/relationships come from actual elements/connections. Component nodes come from pinned attachments and declared domain extension boundaries; resources are data contracts, not invented C4 containers. Distinguish template-provided behavior, validated recipe-provided behavior, project implementation still required and unbound intent. Show provenance/configuration/acceptance references as evidence, not a production certification. Work for qrwty and a non-QR resource fixture without hardcoded QR geometry in the projection engine.
- Add a mouse-accessible Architecture workspace with Context / Containers / Components navigation, a readable diagram key, level/container selection, useful empty states and a direct “Edit on board” path to actual configuration. Preserve board positions/camera and semantic revision when switching views. Use stable card/control sizes, readable labels, fitted but bounded diagrams and consistent existing theme; apply the lessons from automation-pitch's VISUAL_IMPROVEMENTS about jumping controls, tiny fitted islands, clipping and ambiguous icons. Keep the board available for editing and do not replace React Flow or import Excalidraw files.
- Add explicit context editing and a structured recipe product-configuration form (name/title, tagline, 7/30/90-day default) with Save/Cancel, validation and a single undo step. Changing a recipe configuration changes the design only until Generate is requested. Expose the stable local public-origin constraint without putting credentials in the design. Seed context for newly created QR Studio projects from the known product roles; do not rewrite the frozen P19 recipe snapshot or mutate the live qrwty draft/data.
- Inspect desktop and narrower editor views and exercise strict browser mouse journeys for context editing, drill-down, configuration/cancel/undo, reload and return to the unchanged board. Read-only comparison with Excalidraw and automation-pitch informs this work; record observations without modifying that repository. A final broader original-plan/product review remains due after the enterprise component slice.

Done when:

- Focused offline checks cover architecture schema/reference validation, old-document compatibility, undo, derived bindings/coverage and a non-QR projection. No view operation changes generation inputs or layout. Relevant generation checks prove metadata/configuration changes retain recipe ownership and deterministic behavior; no full product re-test is needed unless runtime behavior changes.
- Strict browser journeys and visual inspection pass; required `pnpm check` passes. No paid model calls, external deployment, live qrwty regeneration or edits to earlier handoffs.
- Review diffs, append the P20 handoff and create its scoped local commit. Next: the smallest useful versioned event-delivery/reliability component with explicit defaults and a non-QR proving case, then the final original PLAN / Excalidraw / automation-pitch UI and architecture gap review.
