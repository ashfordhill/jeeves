# P36 — useful application architecture, proved with QRWTY

Fresh-agent implementation specification, 2026-10-31. **Implement P36 only, verify,
append the handoff, create a scoped local commit and stop.** This document specifies
the first queued authoring package after P35. It does not implement P36 or authorize
all subsequent packages. The former P35 business-action-forms proposal remains
superseded.

## Starting state and preservation

- P35 is complete in **`6823880` — `P35: isolate generated application sessions`**.
  Its [evidence](evidence/p35/README.md) records 656 offline tests/98 files, 22 REST
  conformance checks, and the passed same-browser/restart/legacy-transition proof.
  Read the latest handoff for any subsequent changes; these are a baseline, not
  permission to skip P36's checks.
- REST attachment 0.1.0 retains frozen runtime 0.2.0; attachment 0.2.0 selects frozen
  runtime 0.3.0. Preserve both archives, their hashes and existing selections. P36
  is not a session/adoption package. **Live QRWTY has not adopted P35.**
- Work in `/home/ash/github/jeeves`. Read `AGENTS.md`, `PLAN.md` §15 and relevant
  §§1–14, latest `docs/handoff.md`, this specification and the
  [QRWTY authoring review](qrwty-authoring-review-2026-10-31.md) before coding.
- Inspect actual Git status/diff. At preparation, unrelated work is 52 older added
  handoff lines, the historical status-paragraph edit in `docs/improvements.md`,
  untracked `docs/build-plan-next.md` and `docs/reviews/`, and
  `~/github/qrwty/business-analysis/`. Preserve all of it; never stage a whole shared
  document merely because your own change is also in it.
- The running QRWTY repository/application and its saved Jeeves project are
  **read-only reference inputs**. Do not regenerate/restart/adopt it, change its
  saved design, create accounts, change data or QR URLs, or modify its source.
  Verify with new disposable Jeeves projects and temporary generated output.
  Applying the resulting architecture metadata to the live saved project is a
  separate reviewed action, not part of this package.
- No paid implementation-model calls, dependency-upgrade campaign, new graph
  engine or additional architecture-research project. Do not delegate to sub-agents
  unless separately requested. Use the existing source and retained reference
  observations rather than restarting the product audit.

## Outcome

A person can open the QRWTY API component view, understand its five principal
responsibilities, inspect every real operation/resource/dependency, and configure
the selected object without losing the architecture scope. Cards contain useful
responsibility descriptions instead of implementation prompts. Fit includes the
external dependencies. The same mechanism works for an ordinary non-QR API.

This is an architecture-authoring correction. It does not create new application
behavior, certify existing custom handlers, or turn frontend components into a
page-flow diagram.

## 1. Explicit, additive responsibility metadata

Extend the existing optional `architecture` semantic model with bounded container
responsibility descriptions and component definitions. Reuse the existing design,
operations/revision, validation and undo mechanisms; `setArchitecture` is the
starting seam. Do not introduce a second executable graph or a parallel saved
configuration store. Old documents without the new optional fields retain their
serialization; do not inject default metadata on load/navigation.

Each declared component has a stable ID, owning element, editable name, short
responsibility (at most 240 characters) and explicit member bindings. For P36,
member bindings cover these existing REST capabilities:

- Accounts/sessions on a session-enabled REST attachment.
- A resource's generated operations, identified by attachment ID and resource ID.
- A domain extension, identified by attachment ID and extension ID.

Derive actual operation IDs, methods, paths, access rules, contracts, acceptance
references and template/recipe/project ownership from the bound definitions. Do
not copy editable endpoint contracts into architecture metadata. Display names can
change without changing component/member identities. One executable member has at
most one primary component in its container; shared data/dependencies can be used
by several components. Do not invent duplicate handlers when grouping them.

Keep unassigned operations/capabilities inspectable, with the existing deterministic
fallback projection and an explicit unassigned indication where appropriate. A
partial grouping must not hide remaining functionality. Keep the HTTP dispatch
boundary available as technical detail rather than a competing primary business
responsibility. Other capabilities (client, workspace, events and delivery) retain
honest existing projections; P36 need not add a universal grouping language for them.

Validate scope, unique IDs, duplicate membership, attachment kind and referenced
members. Newly introduced invalid bindings must be refused atomically. If a later
executable edit removes a referenced element/attachment/resource/extension, preserve
the architectural intent and expose the lost binding as an attention finding; never
silently attach it to a similarly named replacement. Existing missing references
must not turn unrelated metadata edits into data loss. Define and test this
operation-aware distinction, following existing context-unbinding behavior.

Metadata edits may update saved design snapshots, architecture documentation and
associated lock hashes/revision. They must not change generated application source,
API contracts, migrations, Compose/runtime configuration, pinned binaries, task
ownership or private environment. Changing actual resource configuration through
the reused resource editor is a separate explicit semantic edit with its existing
generation effects. Never treat an architectural declaration as completed runtime
implementation or current verification.

## 2. Dependencies and ownership must remain truthful

Component definitions may declare use of existing resources and existing connected
container connections. Resolve resources to their actual configured store; validate
connection endpoints against the component's owning element. Keep these references
separate from operation membership. Do not infer dependencies from implementation
notes, display names, co-location in a service, or the mere availability of Postgres.

The projection must distinguish:

- **Generated bindings:** derivable from implemented session/resource/template
  wiring and actual semantic connections.
- **Declared uses:** explicitly documented resource/connection use by project-owned
  extensions, with inspectable reference IDs and a visibly distinct relationship
  treatment. A declaration is not static analysis or runtime verification.

A source-reviewed fixture may record why a declared use is plausible, but a user
must not be able to set a `verified: true` flag that turns it into generated wiring.
Record source pointers in the fixture's evidence. No automatic code analyzer is
required. Do not add component-to-component call arrows, blanket database edges or
new executable connections in this package. Incoming frontend calls can terminate
at the actual API/scope boundary; they do not mean every frontend calls every
internal component. Keep existing connections and their IDs/direction intact.

The inspector must show member-level template/recipe/project ownership and
acceptance references. A mixed component must not appear wholly template-supplied
or verified because one of its members is supplied. Preserve the existing separation
between provided behavior, generated output and recorded checks/currentness in the
evidence dialog. A metadata revision must not manufacture a fresh passing result.

## 3. QRWTY reference composition and context

Create a **new** reviewed architecture fixture based on
`fixtures/designs/qrwty-analytics.json`; retain that original fixture and all released
recipe/starter files unchanged. Use real IDs from the current fixture. The grouping
below accounts for its eight extension operations; verify identifiers before editing.
Do not hard-code QRWTY names/IDs into the generic projection or editor.

| Primary component | Existing members | Resources / dependency explanation |
| --- | --- | --- |
| Accounts and sessions | Generated registration/login/session/logout capability on `qrwty-api` | Existing session-backed service/store wiring; no new account resource definition |
| QR management | Generated CRUD/list/read/update operations of resource `qr` | Actual `qr` resource and its configured store |
| Redirect and scan recording | Extension `redirect` → `followQr` | Declared read of `qr`, write of `scan`; returns a destination to the browser |
| Artwork | `qr-image` → `downloadQr`; `studio` → `readQrStudio`; `artwork-preview` → `previewQrArtwork`; `artwork-save` → `saveQrArtwork`; `artwork-export` → `exportQrArtwork` | Declared uses of `qr` and persisted `artwork` where applicable; expose actual pinned renderer/dependency details per operation, without claiming all operations use the same library |
| Analytics | `activity` → `qrActivity`; `owner-analytics` → `ownerAnalytics` | Declared uses of `qr`/`scan`, existing owner access and acceptance constraints |

Selecting Artwork must reveal all five operations, including the existing legacy
QR image download. Selecting Analytics must retain both per-QR activity and owner
analytics. Keep every endpoint's method/path/access/contract/acceptance available;
a smaller diagram is not permission to drop technical detail.

Review the corresponding source read-only under
`~/github/qrwty/services/qrwty/src/features/`, including `_shared/artwork.ts`, and the
frozen recipe/source bindings where relevant. Existing boilerplate comments saying
“implement here” do not prove a registered handler is absent. Similarly, project
ownership does not prove it is unfinished. Compare the actual registration/source.

Populate explicit context on the new fixture/disposable project: QR/link owner,
QR visitor, QRWTY system and destination website, with the real container bindings.
The destination interaction says that the **browser follows the destination URL**;
do not draw an API-to-destination fetch as implemented wiring. Keep frontend
components honest about the current application workspace/typed adapter. Page
routes, transitions and frontend page types remain outside P36.

For any proof using a copy of the live saved design, re-read its current state first.
The audit observed revision 4, three generated elements and an extra unbound Service;
that is historical evidence, not today's assumed revision or a reason to delete the
extra element. Preserve unmatched/unbound objects in the copy and expose findings.
Use the complete reference fixture for generation comparisons; do not claim a saved
draft with extra unbound elements is currently generated or verified.

## 4. Selected-object authoring and readable presentation

Reuse existing Mantine/theme components and the shared fixed-footer configuration
dialog. Every action must work by mouse.

- Add a focused component editor with Add/remove/select, name/responsibility,
  existing-member selection and explicit resource/connection-use selection. Show
  valid targets and whole-draft validation. Draft-only selection/keys do not enter
  the semantic document. Save is one atomic revision/undo step; Cancel changes
  nothing; stale revisions preserve the draft and refuse overwrite.
- Offer **Configure** on the selected responsibility from Architecture. Open the
  relevant draft directly, with its owning container/component retained after
  save/cancel. Keep “Edit on board” as an optional navigation action, not the only
  path to configuration.
- A selected resource-bound component can open the existing resource editor
  directly at its bound resource. Reuse its Save/Cancel, revision checks, recipe
  locks and validation; do not fork a second resource editor or silently replace
  extension JSON. For components without a supported executable editor, configure
  their architecture definition and inspect their read-only operation contracts;
  do not promise arbitrary handler/command editing.
- Cards show the name, a short actual responsibility and only a status needing
  attention. Move versions, full implementation notes, detailed provenance and
  evidence guidance into the selected object's details/disclosures. Remove
  `notes`-derived prompt prose from card descriptions, retaining the notes in
  accessible details. Supply honest neutral fallback descriptions for unannotated
  designs. Do not delete semantic notes to shorten the display.
- Scope resources/dependencies to the inspected object, with an available whole-scope
  view. Avoid repeating global guidance and every relationship in every selection.
  Preserve existing evidence/local-deployment access and explicit stale/failed states.
- Correct initial Fit and explicit Fit to include all visible cards, scope boundary,
  external dependency cards and relationship labels after layout/measurement settles.
  Investigate the current component minimum zoom of 0.6 and actual measured bounds;
  retain the existing ELK worker/layout architecture. Do not solve desktop clipping
  solely by shrinking text to an unreadable overview. Keep pan, zoom, flow direction
  and Focus selected available for large/narrow scopes.
- Navigation, selection, fit, focus and evidence refresh never mutate design/layout.
  Preserve board positions/camera, architecture container/selection and the current
  camera where no topology change requires recomputation. A description/name edit
  must not bounce the user to the first component or the board.

## Implementation pointers

Read narrowly as needed; these are existing seams, not instructions to refactor all of them.

| Area | Files |
| --- | --- |
| Semantic metadata, refs, atomic edits | `packages/spec/src/architecture.ts`, `architecture.test.ts`, `design.ts`, `operations.ts`, `apply.ts`, `findings.ts` |
| Projection and ownership | `packages/spec/src/architecture-view.ts`, `packages/generator/src/architecture.test.ts`, `recipes.ts`, `packages/spec/src/evidence.ts` |
| Architecture API and revision handling | `apps/server/src/design/service.ts`, `apps/server/src/routes/projects.ts`, `projects.test.ts`, `apps/web/src/draw/api.ts`, `store.ts` |
| Workspace and details | `apps/web/src/architecture/ArchitectureWorkspace.tsx`, `ArchitectureEditors.tsx`, `ArchitectureEvidence.tsx`, `architecture.css` |
| Geometry/fit | `ArchitectureGraph.tsx`, `layout.ts`, `layout-client.ts`, `layout.test.ts` in the architecture directory |
| Reused editing | `apps/web/src/draw/inspector/ResourceEditor.tsx`, `resourceDraft.ts`, `Inspector.tsx`, `apps/web/src/components/ConfigurationDialog.tsx` |
| Generation invariance / tasks | `packages/generator/src/plan.ts`, `generate.ts`, `recipes.ts`, existing generation tests; `packages/orchestrator/src/seed.ts` |
| Existing journeys | `apps/web/e2e/architecture.spec.ts`, `architecture-layout.spec.ts`, `architecture-evidence.spec.ts`, `resources-editor.spec.ts`, `local-deployment.spec.ts`, `delivery-focus.spec.ts` |
| Reference / verification workflow | `docs/evidence/qrwty-authoring-review/`, `docs/evidence/p20/reference-observations.md`, `docs/developer-workflow.md`, `scripts/lib/work.ts`, `apps/web/e2e/browser-test.ts` |

## Required acceptance

1. **Offline semantic/projection checks.** Old documents serialize unchanged; valid
   metadata save is atomic; display renaming preserves stable IDs; duplicates,
   cross-container/unknown newly introduced references and duplicate membership
   are refused. Executable removal preserves visible unbound intent. Prove full
   endpoint coverage, partial/unassigned groups, mixed ownership, generated versus
   declared dependencies and absence of inferred internal/database/network edges.
   Include QRWTY and one small non-QR owner-resource API. Tests need no network or DB.
2. **Generation/ownership invariance.** Compare before/after metadata-only generation
   on complete disposable fixture(s). Application source, contracts, SQL/migration
   manifests, Compose/runtime settings, runtime pins/archive hashes and task list
   are unchanged. Only intentional architecture documents/design snapshots and
   corresponding lock/revision data may differ. Regeneration preserves project
   source/private environment and still refuses edited protected output. Check
   the original recipe/starter/runtime artifacts remain byte-identical. No live
   regeneration or expensive full QR product suite is necessary for this boundary.
3. **Strict browser authoring proof.** Add `apps/web/e2e/architecture-authoring.spec.ts`
   using disposable projects. Prove reviewed QRWTY grouping and context; inspect all
   eight extension operations; create/rename/change membership and Cancel; Save,
   single-step undo/redo and reload; direct resource edit targeted at the selected
   resource; recipe protection; stale-revision refusal with draft retained; and
   unchanged board/layout/semantic data during navigation/fit/evidence refresh.
   Verify unassigned/missing references stay discoverable. Delete only the created
   fixture projects/output in cleanup, including failure paths.
4. **Visual and regression checks.** At **1440 × 1000**, wait for settled layout and
   verify the whole API graph including both external container cards and labels
   fits inside the actual canvas. Inspect screenshots for useful readable text;
   a presence assertion alone is insufficient. Also inspect at **1000 × 850** and
   a narrow viewport for reachable actions, scrolling/pan/focus and no hidden
   Save/Cancel. Cover light/dark and axe on changed states. Preserve strict console,
   page and network diagnostics; declare expected conflict responses narrowly.
5. **Commands and repository gate.** Run focused new/affected offline tests through
   `pnpm work run unit <files>`. Run the new journey and affected existing journeys:

   ```bash
   pnpm work run browser-preview \
     apps/web/e2e/architecture-authoring.spec.ts \
     apps/web/e2e/architecture.spec.ts \
     apps/web/e2e/architecture-layout.spec.ts \
     apps/web/e2e/architecture-evidence.spec.ts \
     apps/web/e2e/resources-editor.spec.ts
   pnpm work run check
   git diff --check
   ```

   If shared changes touch delivery/local-deployment behavior, select their existing
   focused journeys as well; avoid unrelated full-product/load suites. Use pinned
   Chromium for the Jeeves editor. P35's generated resource-browser proof used
   Firefox because of P32's Chromium stream issue; do not suppress that diagnostic
   or rerun the session Docker proof for metadata-only changes. If runtime behavior
   unexpectedly changes, restore the P36 boundary rather than expanding the package.

Record exact profile IDs/logs, test totals, browser engine/version, inspected
screenshots, cleanup and actual failures/limitations in `docs/evidence/p36/` and
an appended `docs/handoff.md` entry. Review the full scoped diff. After the required
checks, create a local commit such as **`P36: author useful application responsibilities`**.
Local commits are already authorized; stage only this package. Stop after that
verified commit and report what is implemented versus declared and what remains.

## Not in P36 / next package

No developer auto-login, persistent sandbox/scenario launcher, page-flow/routing
contract, public landing page, theme/layout designer, business-action-form runtime,
new QR feature or auth release, live QRWTY metadata/runtime adoption, recipe upgrade,
cloud/scaling work, source analyzer or arbitrary workflow language.

The next bounded authoring package after verified P36 is **persistent developer
testing**: reusable tester/visitor access to an isolated persistent local sandbox,
empty/sample scenarios and scoped reset, using real application sessions. It needs
its own implementation specification before coding. Page flow/public entry and
composable QR adoption remain later separate packages. Do not start them in P36.

## Paste-ready implementation prompt

```text
Work in /home/ash/github/jeeves.

Implement P36: useful application architecture, proved with QRWTY, as specified in docs/build-plan-p36-architecture.md.

Read AGENTS.md, PLAN.md §15, the latest docs/handoff.md entries, the P36 specification, and docs/qrwty-authoring-review-2026-10-31.md before coding. P35 is complete in commit 6823880; preserve its versioned session behavior and frozen artifacts.

Begin implementation rather than producing another plan. Complete P36 only: explicit responsibility/member/dependency bindings, truthful ownership and endpoint details, direct selected-object configuration, concise cards and readable fit. Use the specification's new QRWTY fixture and a non-QR case. Declared source dependencies must remain distinguishable from generated wiring.

Preserve unrelated working-tree changes, published releases and the live QRWTY application/data/saved design. Use disposable projects and generated output for verification. Do not implement developer testing, page flows, public landing pages or live adoption. Do not delegate unless separately requested.

Run the specified focused checks and required repository gate. Record actual results and limitations in docs/evidence/p36/, append docs/handoff.md, and create a scoped local Git commit with P36 in its title. Local commits are already authorized.

Stop after the verified P36 commit. Report what changed, the evidence, declared versus implemented boundaries, remaining limitations and the next bounded authoring package.
```
