# P42 — SaaS responsibilities and client components

[Specification and recorded decisions](../../build-plan-c4-saas.md#p42--c3-catalog-saas-responsibilities-and-client-components).
Started clean at `1e8ea1e` in the existing `main` checkout. One agent, sequential
work, no branches, worktrees or delegation. Followed AGENTS, PLAN §15 and the latest
handoffs; used the approved local plan without repeating external research.

Added all ten specified backend and four frontend planned component families. Their
bounded options describe provider adaptation, notifications, billing, organizations,
developer access, reporting, indexing, schedules, event handling, audit, screens,
client sessions, API facades and local/offline state. Existing traffic targets apply.
No component generates behavior or selects a runtime. Planned components still block
generation. The library, type picker and semantic validation share host-role rules:
backend responsibilities fit services/workers (including planned functions); client
responsibilities fit frontend hosts, including web/mobile/desktop. Existing six backend
families remain available to service/worker hosts.

Components accept optional trimmed technology text (≤ 120 characters), shown on C3
cards and in the existing configuration dialog. C3 cards identify their Component
stereotype; frontend families use the existing client color/icon treatment. Minor
spacing and two-line truncation keep technology and status clear on long names.
Dependency choices use their existing verb labels. Container uses inherit the saved
label/protocol/interaction; existing component-to-component relationship editing remains
available. No second runtime dependency is created.

The approved D9 **Show technical components** checkbox in Editor actions starts off.
It reveals HTTP resource boundaries and typed API adapters, retaining the full underlying
projection for evidence and existing bindings. Hiding removes only their displayed edges
and neighbours with no remaining edge; responsibility members, resource contracts,
operation access and declared uses remain intact. It changes neither revision nor board
layout, and resets to off on reload. C1 retains its technology-free presentation.
[CATALOG.md](../../../CATALOG.md) includes all families and C1/C2 reverse reuse links.
Existing planning examples are unchanged for P43.

## Verification

Final production browser profile: `2026-10-31T23-47-55-860Z-browser-preview-393997fa`.
**51 tests / 11 suites passed**, Playwright **44.2s** / profile **46.0s**, no retries,
strict browser diagnostics, unchanged source fingerprints.

```bash
pnpm work run browser-preview \
  apps/web/e2e/saas-components.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/relationship-notation.spec.ts \
  apps/web/e2e/api-contracts.spec.ts \
  apps/web/e2e/saas-containers.spec.ts \
  apps/web/e2e/container-notation.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/draw.spec.ts \
  apps/web/e2e/chat.spec.ts
```

Each new family is added by mouse from role-filtered search, configured in the existing
component dialog, linked to an external container through a verb/protocol-labeled use,
canceled without mutation, saved as one revision, undone/redone and reloaded. All fourteen
options surfaces and desktop/narrow diagrams pass axe. The new QR case compares all **16**
displayed API operations against the saved API preview, with no duplicates, and toggles
both technical node types without editing the design. It also checks frontend filtering
on the implemented web host. Existing component relationships, examples, C1/C2 editing,
retained conflicts, pins, placement, API reference, resource editing and scripted chat pass.

**`pnpm work run check` → `pnpm check` passed**, profile
`2026-10-31T23-48-52-649Z-check-4e694d2d`, **44.2s**, unchanged fingerprints.
Biome: **713 files**, **596 warnings / 75 infos / no errors**. All workspace/script
typechecks passed. **726 tests / 106 files passed**, Vitest **36.99s**. New unit tests
cover every field's choices/types/bounds, planned and registered host roles, atomic
incompatible-host rejection, planned generation blocking, technology bounds and old
serialization. Generator tests prove hidden/visible operation bindings match exactly,
retain declared edges, and technology changes leave generated artifacts, wiring and
ownership identical except the existing lossless input design snapshot. Golden fixtures
were not edited.

Focused unit tests (55 tests) and typechecking also passed. Interim browser logs retain
corrections: the dependency dropdown needed closing by mouse before footer actions;
Mantine's native checkbox menu item is required for its checked role; card descriptions
needed whole-line truncation beside the added technology. A full interim run passed 50/51
and exposed an existing context test reloading before Redo finished. It now waits for the
saved architecture before reload. The first blocked browser run was interrupted after
recording the shared cause. No increased timeout/retry policy or suppressed diagnostics.
`git diff --check` and documentation targets were checked before commit.

## Inspected screenshots

All **44 final captures** were reviewed in contact sheets; representative API, client,
mobile, QR and options captures were also opened at full size. Diagrams are **1440 × 900
light** and **390 × 844 dark**; options show the configured draft at desktop size, with
scrollable fields and fixed Save/Cancel. The QR narrow view remains a fitted overview
with mouse zoom/selection for details, as in earlier packages.

| Family | C3 light | Options | C3 narrow/dark |
| --- | --- | --- | --- |
| Integration adapter | [Diagram](integration-adapter-light.png) | [Options](integration-adapter-options.png) | [Diagram](integration-adapter-dark.png) |
| Notifications | [Diagram](notifications-module-light.png) | [Options](notifications-module-options.png) | [Diagram](notifications-module-dark.png) |
| Billing & plans | [Diagram](billing-module-light.png) | [Options](billing-module-options.png) | [Diagram](billing-module-dark.png) |
| Organizations & members | [Diagram](organizations-module-light.png) | [Options](organizations-module-options.png) | [Diagram](organizations-module-dark.png) |
| Developer API & webhooks | [Diagram](developer-api-module-light.png) | [Options](developer-api-module-options.png) | [Diagram](developer-api-module-dark.png) |
| Reports & exports | [Diagram](reports-module-light.png) | [Options](reports-module-options.png) | [Diagram](reports-module-dark.png) |
| Search & indexing | [Diagram](search-module-light.png) | [Options](search-module-options.png) | [Diagram](search-module-dark.png) |
| Scheduled jobs | [Diagram](scheduled-jobs-module-light.png) | [Options](scheduled-jobs-module-options.png) | [Diagram](scheduled-jobs-module-dark.png) |
| Event handlers | [Diagram](event-handlers-module-light.png) | [Options](event-handlers-module-options.png) | [Diagram](event-handlers-module-dark.png) |
| Audit log | [Diagram](audit-log-module-light.png) | [Options](audit-log-module-options.png) | [Diagram](audit-log-module-dark.png) |
| Screen group / feature area | [Diagram](screen-group-light.png) | [Options](screen-group-options.png) | [Diagram](screen-group-dark.png) |
| Client session & access | [Diagram](client-session-light.png) | [Options](client-session-options.png) | [Diagram](client-session-dark.png) |
| API facade | [Diagram](api-facade-light.png) | [Options](api-facade-options.png) | [Diagram](api-facade-dark.png) |
| Local state & offline sync | [Diagram](local-state-light.png) | [Options](local-state-options.png) | [Diagram](local-state-dark.png) |
| QR operation groups, technical nodes hidden | [Diagram](qr-light.png) | Toggle and operation coverage asserted in browser | [Diagram](qr-dark.png) |

## Boundaries and cleanup

No template/runtime/recipe/generator implementation/output, dependency/lockfile,
golden fixture or live QRWTY edits. All new families are planned. Page-flow routing,
new generated behavior and chat-library awareness remain outside P42. No material
scope deviation; the menu uses Mantine's checked-item component and existing component
and relationship dialogs. Only planning/evidence/handoff documentation and screenshot
copies changed after final gates.

Removed **32** exact-name/session-time projects from `jeeves_e2e` (including interrupted
new cases and existing suites' leftovers) and **70** session-created E2E settings/output
directories. No projects created in this browser session remain. Retained existing data,
logs and shared Postgres; existing Jeeves health on 4310 remains OK. **P43 is next.**
