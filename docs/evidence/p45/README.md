# P45 — Dynamic runtime scenarios

[Specification](../../build-plan-c4-saas.md#p45--dynamic-runtime-scenario-view-optional).
Started clean at `9036f10` on the existing `main` checkout. One agent, sequential
work; no branches, worktrees or delegation.

Saved `architecture.scenarios` describe ordered steps over existing C2 connections
or relationships in one authored C3 view. Each scenario has a stable identity,
name and scope; each step has a stable identity, relationship kind/ID and short
text. Steps can reuse one arrow. C3 connection uses include explicitly declared
uses and existing storage connections from grouped accounts/resources; projection
and validation share that resolution. Hidden technical-only edges and C1 context
interactions are not separate scenario references.

The diagram/editor menu offers a picker, Add and Edit. Selecting a scenario adds
number badges to the referenced edge labels and a scrollable list beside the
diagram (below it on narrow screens). C1 has no overlay. Selection is local to the
current session and scope; the saved scenario content survives reload. Mouse
controls add, move and remove steps; fixed Save/Cancel actions protect the draft.
Save is one shared `setArchitecture` operation and undo step. Whole-scenario
removal is also undoable. Conflicts retain the open draft without overwriting a
newer design. Stable step identities keep fields attached to their steps while
reordering.

The QRWTY target example now includes **Visitor follows a QR** and **Owner creates
a link**. The visitor scenario documents a conditional cache miss and asynchronous
visit processing; its browser follows the returned destination. The owner scenario
reuses the web/API connection for request and response. Neither adds wiring.

Validation rejects missing and out-of-scope relationships, missing C3 containers,
duplicate scenario/step identities and malformed or unbounded content. There are
at most 50 scenarios, 1–50 steps each, names up to 120 characters and step text up
to 240. Removing referenced wiring is rejected until its scenario steps are
updated/removed, either first or in the same atomic operations batch. Old designs
without scenarios retain their serialization. Generated behavior, contracts,
artifacts and ownership are unchanged; only the lossless input snapshot records
the new metadata.

## Verification

- `pnpm work run unit packages/spec/src/scenarios.test.ts packages/spec/src/architecture-examples.test.ts packages/generator/src/architecture.test.ts`:
  **23 tests / 3 files passed**, Vitest **2.52s**, profile **3.2s**;
  `2026-11-01T00-47-32-325Z-unit-94d8ef0e`. Covers old-document compatibility,
  independent seeded scenarios, repeated references, bounds, cross-scope/missing
  references, stable identity checks, atomic removal, projected authored storage
  uses and byte-identical generated artifacts/ownership.
- `pnpm work run browser-preview apps/web/e2e/architecture-scenarios.spec.ts apps/web/e2e/architecture-examples.spec.ts apps/web/e2e/architecture-layout.spec.ts apps/web/e2e/architecture-authoring.spec.ts apps/web/e2e/draw.spec.ts apps/web/e2e/chat-planning.spec.ts`:
  **15 tests passed**, Playwright **30.0s**, profile **32.0s**;
  `2026-11-01T00-48-09-862Z-browser-preview-d34a58c6`, unchanged fingerprints,
  no retries, strict diagnostics. New journeys cover mouse add/reorder/remove,
  Cancel/Save/undo/redo/reload, scenario removal/undo, repeated edge numbers,
  C1 exclusion, C3 scope switching and local choices, missing-wiring rejection,
  retained conflict drafts, accessibility and no narrow page overflow. The expected
  409 is explicitly declared and consumed by the strict diagnostics collector.
  Existing example creation, every authored C3 view, grouped operations, worker
  failure/retry, camera preservation, drawing and scripted planned chat pass.
- `VITEST_MAX_WORKERS=4 pnpm work run check` → `pnpm check` passed:
  **748 tests / 109 files**, Vitest **37.26s**, profile **44.6s**; all workspace
  and script typechecks passed. Biome checked **724 files**, **677 warnings /
  75 infos / no errors**. `2026-11-01T00-51-47-010Z-check-8a6fec64`, unchanged
  fingerprints. Generator golden/ownership checks pass without fixture edits.
  The environment bounds concurrency only; no test, assertion, timeout or retry
  setting changed. Two default-concurrency attempts failed the existing disk-backed
  server restart/undo test's 5000ms limit (**747 passed / 1 timed out** each):
  `2026-11-01T00-49-35-459Z-check-183c982b` and
  `2026-11-01T00-50-36-035Z-check-c8dd5930`. The unchanged server suite separately
  passed **18 tests**, Vitest **6.46s** / profile **7.0s**;
  `2026-11-01T00-50-25-455Z-unit-163111f9`. Default-concurrency timeout sensitivity
  remains a verification limitation; no unrelated test-infrastructure change was made.
- `git diff --check` and changed-document local links checked before commit.

Interim runs caught a missing component-use cleanup in an atomic-removal unit
expectation; a narrow flex rule lost through the new diagram wrapper; exact test
labels that omitted Mantine's required asterisk; and an undeclared expected 409.
All were corrected without increasing timeouts/retries or suppressing diagnostics.
Screenshot review prompted zoom-independent number text and multiline step drafts.

## Inspected captures

All seven final captures were opened and inspected. Each diagram capture passes
axe; the narrow editor also passes axe. Narrow diagrams remain fitted overviews;
mouse zoom/selection reveals details, and the step list scrolls independently.

| View | 1440 × 900 light | 390 × 844 dark |
| --- | --- | --- |
| Visitor follows a QR | [C2](p45-visitor-light.png) | [C2](p45-visitor-dark.png) |
| Owner creates a link | [C2](p45-owner-light.png) | [C2](p45-owner-dark.png) |
| Authored component scenario | [C3](p45-components-light.png) | [C3](p45-components-dark.png) |
| Multiline step editor, fixed actions | — | [Editor](p45-editor-dark.png) |

No runtime/template/recipe implementation, golden fixture, dependency/lockfile or
live QRWTY changes. Scenarios are explanations, not execution traces, test results,
page flows or new behavior. The approved P39–P45 sequence is complete; further
implementation/code graphs, runtime expansion and live adoption require their own
scope.

Removed four exact-ID session-created projects left by the first timed-out browser
runs and 48 session-created E2E settings/output directories. Final journeys delete
their own projects. No P45 scenario projects remain; pre-existing projects/logs and
the shared Postgres were retained. Existing health on 4310 remains OK.
