# P55 — User-defined reusable architecture library

Implemented on `main` in `/home/ash/github/jeeves`, 1 November 2026. See the
[local library contract](../../architecture-library.md) and
[package specification](../../build-plan-c4-evolution.md#p55--user-defined-reusable-architecture-library).

Mouse acceptance saves a tenant-access component and multi-container durable-delivery pattern,
reviews required hosts/interfaces/guarantees and publishes immutable versions. A second project
reuses both, customizes an instance, and publishes v2 while v1 consumers retain their original
source content/version. Undo/redo and reload preserve insertion identities. Retirement retains
source records and prevents new selection. A concurrent design edit rejects stale insertion,
retains the draft and leaves the concurrent revision unchanged. Empty-name drafts stay editable.

Offline tests additionally prove catalog restart, immutable publication, stale draft protection,
draft deletion, private-configuration exclusion, missing/incompatible roles and guarantees,
explicit shared definitions with multiple versions, finite option provenance, P54 context actors,
client states and alternative/outcome references, and mouse/scripted-chat equivalence. Scripted
chat commits one undoable edit and survives an app restart. Generator compatibility retains all
executable files/artifacts/ownership; only its deliberately lossless design snapshot gains pins.

## Inspected captures

Desktop captures are 1440 × 900 light; the published-v2 capture is 390 × 844 dark.

- [Single-component draft and named required roles](p55-access-draft-light.png)
- [Multi-container delivery draft and required invariants](p55-delivery-draft-light.png)
- [Exact external-role binding and independent access insertion](p55-access-preview-light.png)
- [Independent multi-container expansion](p55-delivery-preview-light.png)
- [Published v2 and fixed narrow controls](p55-published-v2-dark-narrow.png)
- [Retained conflict draft and fixed error/actions](p55-conflict-light.png)

## Verification

- `pnpm work run unit packages/spec/src/architecture-library.test.ts packages/spec/src/architecture-patterns.test.ts apps/server/src/architecture/architecture-library.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts packages/generator/src/architecture.test.ts`: **72 tests / 6 files**, Vitest **5.36s**, profile **5.9s**;
  `2026-11-01T16-48-46-257Z-unit-c700cdc6`.
- `pnpm work run browser-preview apps/web/e2e/architecture-library.spec.ts apps/web/e2e/architecture-patterns.spec.ts apps/web/e2e/architecture-scenarios.spec.ts`: **8 passed**, profile **18.8s**;
  `2026-11-01T16-49-40-080Z-browser-preview-bfbe696c`.
  Production assets, strict browser diagnostics, axe, narrow overflow, P50/P45/P54 regressions,
  semantic history and retained conflicts pass. No automatic retries or diagnostic suppression.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **900 tests / 120 files**,
  Vitest **36.08s**, profile **44.4s**; `2026-11-01T16-50-44-669Z-check-2ed683d4`.
  Biome checked **778 files**, **1725 warnings / 75 infos / no errors**.
- All three final runs retained unchanged Git fingerprints. All **204 changed-document local
  targets** resolve; earlier handoff bytes and `git diff --check` pass. Database inspection
  found **zero** P55 fixture projects after exact-ID cleanup of the first timeout's source.
  The appended [handoff](../../handoff.md) records the recovery and portability limits.

## Boundaries

Architecture-only publication adds no runtime, recipe, generated implementation, remote catalog,
provisioning or live QRWTY adoption. Portable planned selections preserve declared contracts and
policy guarantees; runtime-owned members/source-backed contracts require explicit portable
planned definitions rather than copying private configuration or inventing equivalence. Only
finite catalog configuration transfers. Existing generation blocks and ownership remain intact.
There is no automatic upgrade or dependency resolver. The local atomic-file catalog assumes one
server process. SHA-256 identifies published content; it supplies no execution/security evidence.
