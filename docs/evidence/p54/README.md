# P54 — Scenarios, outcomes and client journeys

Implemented on `main` in `/home/ash/github/jeeves`, 1 November 2026. The
[scenario contract](../../architecture-scenarios.md) and
[package specification](../../build-plan-c4-evolution.md#p54--scenarios-outcomes-and-client-journeys)
describe this design authoring package. Existing P45 examples remain lossless.

The production journey inspects redirect cache miss and visit-channel failure, billing duplicate
delivery and a mouse-authored owner journey. It adds context entry, operation-coupled loading,
success and denial states, main/alternative outcomes and invariants with requirement links.
It reorders/removes steps, records expectation review, saves as one undo step, undoes/redoes
and reloads. An explicit new contract version and migrated binding expire scenario review.
The client component inspector lists its authored journey states. Invalid branch removal and a
concurrent revision retain the draft without replacing saved inputs; errors and actions stay fixed.

Expectation review is agreement with authored acceptance intent, never a test result. Static
relationship direction remains unchanged by response/continuation phases. There is no simulation,
workflow language, generated UI/routing, automatic test generation or new runtime capability.
Relevant contracts, authoritative sources, bindings, policies and linked requirements/decisions
expire review; unrelated revisions/layout/notes/contracts do not. Chat shares validation and
commits one undo step, refusing concurrent replay. Generation preserves executable files,
contracts, artifacts and ownership; its lossless design snapshot retains the new metadata.

## Inspected captures

Desktop captures are 1440 × 900 light (client inspector dark); narrow captures are 390 × 844 dark.

- [Cache miss and authoritative fallback](p54-cache-miss-light.png)
- [Channel failure and bounded analytics degradation](p54-queue-failure-light.png)
- [Duplicate billing acknowledgement](p54-billing-duplicate-light.png)
- [Owner success and reviewed expectations](p54-owner-success-light.png)
- [Owner denial and stale expectation review](p54-owner-denial-dark.png)
- [Narrow alternative editor with fixed actions](p54-editor-dark.png)
- [Client feature journey inspector](p54-client-inspector-dark.png)
- [Retained conflict draft with fixed error](p54-conflict-light.png)

## Recorded verification

Every recorded run retained unchanged before/after Git fingerprints (`sourceChanged: false`).

| Command | Result | Ignored local run ID |
| --- | --- | --- |
| `pnpm work run unit packages/spec/src/scenarios.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts packages/generator/src/architecture.test.ts` | 82 tests / 4 files; Vitest 5.50s, profile 6.0s | `2026-11-01T14-33-15-277Z-unit-a80f4c41` |
| `pnpm work run browser-preview apps/web/e2e/architecture-scenarios.spec.ts apps/web/e2e/architecture-authoring.spec.ts` | 7 passed; Playwright 15.3s, profile 17.1s; production assets, strict diagnostics, exactly registered expected revision conflicts, axe and narrow overflow | `2026-11-01T14-32-28-776Z-browser-preview-e890cdb5` |
| `VITEST_MAX_WORKERS=4 pnpm work run check` | All typechecks; 889 tests / 118 files; Vitest 37.62s, profile 45.6s; Biome 770 files, 1590 warnings / 75 infos / no errors | `2026-11-01T14-35-00-572Z-check-b8b2c5a1` |

The full gate includes 25 new tests for all-path reference/scope validation, client operation
coupling (including authoritative REST-operation sources), review freshness, legacy `main` step
compatibility, atomic rejection, source/removal protection, mouse/chat parity and concurrency.
Scenario-only scripted concurrency explicitly excludes P51 review metadata to exercise the new
guard independently. Existing generation/ownership and P45 authoring checks remain intact.
No dependency changes, automatic retries, timeout increases, diagnostic suppression or golden refresh.
The read-only E2E database inspection found zero projects named P54 scenario journeys or
P45 scenarios. No shared/live projects or volumes were removed. Earlier failed or source-changing
runs are not release evidence. P55 local architecture reuse is next, only when separately requested.
