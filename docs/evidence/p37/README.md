# P37 — simplified editor evidence

[Specification and approved choices](../../build-plan-p37-editor.md). Work began
at `3282fdb` on the existing `main` checkout, with one agent. The JEEVES-2 research
was read, not repeated. No new dependencies, templates, contracts, generator changes
or live QRWTY adoption are included.

## Browser verification

Final production-build profile: `2026-10-31T20-04-23-930Z-browser-preview-8fd282c1`.
**32 tests passed**, Playwright **24.8s**, complete profile **26.5s**, no retries,
strict browser diagnostics and source fingerprints unchanged during the run.

```bash
pnpm work run browser-preview \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/architecture-layout.spec.ts \
  apps/web/e2e/template-upgrade.spec.ts \
  apps/web/e2e/architecture-evidence.spec.ts \
  apps/web/e2e/local-deployment.spec.ts \
  apps/web/e2e/local-http-pool.spec.ts \
  apps/web/e2e/workspace.spec.ts \
  apps/web/e2e/delivery.spec.ts \
  apps/web/e2e/delivery-focus.spec.ts \
  apps/web/e2e/chat.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/resources-editor.spec.ts \
  apps/web/e2e/starters.spec.ts
```

The journeys cover mouse canvas selection and connections, menus, drawer draft
continuity, selection/level/conflict drafts, Save/Cancel, undo/redo, reload, exact
existing pins, explicit upgrade review, context editing, findings, evidence,
deployment, resource/workspace/event configuration, protected recipes, starter
creation and disposable write-only generation. Axe scans cover desktop, narrow
and dark editing/configuration. Providers are scripted and test projects use the
isolated `jeeves_e2e` database. This is UI/compatibility evidence, not runtime,
load or live-application certification.

Interim failures identified and corrected low-contrast type text, a queued fit on
an empty C2 board, oversized intrinsic card widths, inspector visibility/camera
restoration across scopes, and obsolete test assumptions about tabs, permanently
visible controls, acceptance IDs, version options and default C3 selection.
No diagnostic suppression, retry or timeout increase was added. Full logs and
JSON for failed attempts and final passes remain in ignored `.jeeves-work/runs/`.

## Inspected screenshots

All seven captures below were opened and visually inspected from the final browser
run. QRWTY images use an independent fixture project with the already-declared
architecture; no actors or context were inserted into the live saved design.

| Capture | Observation |
| --- | --- |
| [Empty C1](empty-context.png) | Explicit purpose/people setup action; no invented context card. |
| [Saved C1](context.png) | Mouse-authored actor, purpose and interaction plus a focused inspector. |
| [QR context](qr-context.png) | Owner, visitor, external destination and purpose from the fixture. |
| [C2 containers](containers.png) | Stable client/API/store colors, distinct database shape, version-free type labels. The inspector was explicitly opened in this journey. |
| [C3 analytics](analytics.png) | One responsibility heading and compact method/path/media summaries; no acceptance IDs or repeated ownership badges. |
| [Chat drawer](chat.png) | Left drawer, reachable close control and preserved unsent draft; graph refits in the available space. |
| [Narrow dark C1](mobile-dark.png) | Header, edge handle and diagram controls stay on screen at 390px; selection/zoom exposes fuller detail. |

## Boundaries

C3 remains responsibility-based; ungrouped existing capabilities stay visible.
This package does not create a complete API operation list, API viewer/editor,
code graph, data authoring canvas or deployment authoring system. Those follow-ups
are specified separately. New type selection uses the registry's explicit semantic
version ordering; selecting an existing type retains its exact stored release.
Versions and explicit upgrades remain in inspector implementation details. Fixed
acceptance metadata stays in the contracts and evidence; event authoring exposes
it only through Verification metadata.

Catalog offerings and C1/C2/C3 boundaries did not change, so `CATALOG.md` is unchanged.

## Required check and cleanup

`pnpm work run check` → `pnpm check` **passed**, profile
`2026-10-31T20-05-56-648Z-check-d8cf1f71`, **44.3s**, unchanged source fingerprints
during the run. All workspace/script type checks passed; **665 tests / 99 files**,
Vitest **37.07s**; Biome **687 files**, **514 warnings / 74 infos / no errors**.
Only evidence/handoff documentation was updated afterward.

Removed **87** named session-created test projects from `jeeves_e2e` and **132**
session-created E2E settings/output directories, constrained to this session's test
time window. Kept the shared Postgres service, existing projects and run logs.
The existing dev API health check at `127.0.0.1:4310/health` returned
`{"status":"ok","database":"ok","version":"0.1.0"}`. No live QRWTY source,
services, saved design or data was edited. `git diff --check` passed.
