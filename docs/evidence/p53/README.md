# P53 — Logical deployment planning

Implemented on `main` in the existing `/home/ash/github/jeeves` checkout, 1 November 2026.
The [model/editor contract](../../architecture-deployments.md) and
[package specification](../../build-plan-c4-evolution.md#p53--logical-deployment-planning)
describe the supported scope. These captures show planning intent, never observed deployment.

The mouse journey starts with C2 only, adds a hosted environment, nested placement, three
instances of the same redirect service, separate visit/billing queues on one broker, an external
email provider and a reviewed legacy edge mapping. It authors logical and deployment-only
interactions, creates an optional private alternative, uses semantic undo/redo and reloads.
Shared diagram controls move/focus instances with independent layout history and persistence.
A separate journey rejects cyclic nesting and retains a conflicted draft without changing C2.

## Recorded verification

Both final runs retained identical before/after Git fingerprints (`sourceChanged: false`):

| Command | Result | Ignored local run ID |
| --- | --- | --- |
| `pnpm work run browser-preview apps/web/e2e/architecture-deployments.spec.ts apps/web/e2e/local-deployment.spec.ts apps/web/e2e/architecture-layout.spec.ts` | 7 passed; Playwright 15.9s, profile 17.9s. Production assets, strict browser diagnostics, exact expected 409, axe and narrow overflow checks. | `2026-11-01T13-50-11-679Z-browser-preview-b1775df0` |
| `VITEST_MAX_WORKERS=4 pnpm work run check` | All typechecks and 864 tests / 118 files passed; Vitest 39.42s, profile 49.4s. Biome checked 768 files: 1415 warnings / 75 infos / no errors. | `2026-11-01T13-50-30-743Z-check-f2510684` |

The full gate includes deployment structural/reference/count validation, managed-store and
external boundaries, legacy mapping, nested geometry and layout pruning, mouse/chat semantic
parity, scripted chat commit/undo and stale replay rejection. Generator checks compare all
executable files, artifacts and ownership; only the lossless design snapshot gains metadata.
No golden refresh or dependencies changed. P33's original runtime implementation is unchanged;
its browser journey now explicitly enables technical components and waits for the saved camera
at CSS serialization precision instead of assuming pre-P49 layout behavior or network idle.

## Inspected captures

Desktop captures are 1440 × 900; dark narrow captures are 390 × 844. The complete overview
provides topology; the object picker, focused camera and placement disclosure expose detail.
Forms scroll while their actions stay fixed.

- [Hosted overview](p53-hosted-light.png)
- [Nested responsibilities, managed operation and separate broker channels](p53-placements-light.png)
- [Reviewed legacy mapping preserving the source identity](p53-mapping-light.png)
- [Selected replica at readable focus](p53-instance-focus-light.png)
- [Saved camera in a narrow dark environment view](p53-hosted-dark.png)
- [Narrow dark broker editor](p53-broker-dark.png)
- [Retained draft after a revision conflict](p53-conflict-light.png)

The final E2E database inspection found zero projects with the P53/P33 fixture names. Four
fixtures left by earlier timed-out journeys were removed by exact observed IDs. Shared/live
Postgres data and qrwty were retained. Earlier failed/source-changing runs are not final evidence.

P53 adds no provisioning, runtime measurements, capacity/failover proof, credentials, generated
wiring, executable templates, generation filtering or application adoption. The separate local
view remains derived and read-only for its documented HTTP-template scope. Stop after P53;
P54 scenarios/outcomes is the next separately requested package.
