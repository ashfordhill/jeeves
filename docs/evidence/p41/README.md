# P41 — Missing SaaS containers in the C2 planning catalog

[Specification and recorded decisions](../../build-plan-c4-saas.md#p41--c2-catalog-missing-saas-containers).
Started clean at `07a8548` on the existing `main` checkout. One agent, sequential
work, no branches, worktrees or delegation. Followed AGENTS, PLAN §15, the latest
handoffs and the approved C4 decisions; no repeated external research.

Added three planned C2 families using the existing schema-driven options inspector:

- **Third-party service**, external: all nine provider categories, API-key/OAuth-client/
  mTLS authentication method, inbound webhooks, shared-data description, and
  fail-request/degrade/queue-and-retry intent. No credential-value field is added.
- **Analytics store / warehouse**, database: columnar/time-series/data-lake family,
  streaming/micro-batch/nightly loading, retention and internal-dashboard/customer-report
  access. Retention zero means indefinite.
- **Serverless function**, worker: HTTP/queue/schedule/storage-event trigger, timeout
  target in seconds and cold-start tolerance. It inherits the existing worker workload
  targets; these choices provide no platform implementation or latency evidence.

The planned web application adds Customers/Internal staff & admins/Both audience and
Single-page app/Server-rendered site/Static marketing site kind. Existing rendering,
responsive and access options remain readable without rewriting saved configuration.
Descriptions and free-text technology reuse P39. Existing family colors/icons, external
styling, database cylinders and derived boundaries apply by role. Library search now
includes option labels/choices, so SMS, Data lake and Storage event find the right block;
group and Implemented filters still compose with search. Screenshot review prompted a
small shared inspector adjustment to space and wrap the family/status badges.

[CATALOG.md](../../../CATALOG.md) records the new planned boundaries, web options and
cross-linked reuse. Existing architecture examples remain unchanged for P43.

## Verification

Final production browser profile: `2026-10-31T23-17-54-248Z-browser-preview-bc7eb566`.
**32 tests / 9 suites passed**, Playwright **27.5s** / profile **29.3s**, no retries,
strict browser diagnostics and unchanged source fingerprints.

```bash
pnpm work run browser-preview \
  apps/web/e2e/saas-containers.spec.ts \
  apps/web/e2e/container-notation.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/relationship-notation.spec.ts \
  apps/web/e2e/draw.spec.ts \
  apps/web/e2e/chat.spec.ts
```

New browser cases place each of the three new containers and the planned web client
by mouse from option search plus category filters. Each edits its new options,
description and technology; Cancel leaves the document unchanged; Save is one revision;
undo/redo/reload restores all selected options. Assertions check family icons, external
stereotype, warehouse cylinder class and technology/description content. Axe passes
on each desktop options surface and each 390px dark diagram. Existing examples,
C1/C3 navigation/configuration, relationships, placement and scripted chat pass.

`pnpm work run check` → **`pnpm check` passed**, profile
`2026-10-31T23-18-29-723Z-check-62688d59`, **43.8s**, unchanged fingerprints.
Biome: **711 files**, **580 warnings / 75 infos / no errors**. All workspace/script
typechecks passed. **694 tests / 105 files passed**, Vitest **35.59s**. New schema
checks exercise every catalog choice, type/range/text bounds, valid C2 projections,
continued generation blocking and legacy web configuration serialization. Existing
generator golden/ownership checks pass unchanged; no golden files were edited.

The focused unit run (15 tests), typecheck, initial four-case browser run and earlier
full gates also passed. Successful interim logs remain in `.jeeves-work/runs/`. Final
gates ran sequentially after the screenshot-driven badge-spacing adjustment. No retry,
timeout increase or diagnostic suppression. `git diff --check` and local documentation
links were checked before commit.

## Inspected screenshots

Opened and visually inspected all twelve final captures: 1440 × 900 light diagrams
and options panels, plus 390 × 844 dark diagrams. Options panels scroll with fixed
Save/Cancel controls; the captures show the upper options after reload.

| Block | C2 light | Saved options | C2 narrow/dark |
| --- | --- | --- | --- |
| Third-party service | [Diagram](third-party-service-light.png) | [Options](third-party-service-options.png) | [Diagram](third-party-service-dark.png) |
| Analytics store / warehouse | [Diagram](analytics-store-light.png) | [Options](analytics-store-options.png) | [Diagram](analytics-store-dark.png) |
| Serverless function | [Diagram](serverless-function-light.png) | [Options](serverless-function-options.png) | [Diagram](serverless-function-dark.png) |
| Web application | [Diagram](browser-client-light.png) | [Options](browser-client-options.png) | [Diagram](browser-client-dark.png) |

## Boundaries and cleanup

No template, runtime, recipe, generator implementation/output, dependency/lockfile,
golden fixture or live QRWTY changes. The added blocks remain planned and prevent
generation until unsupported intent is resolved. Technology text is authored design
metadata, not a runtime recommendation. C3 families remain P42; examples remain P43.

Removed **20** exact-name/session-time E2E projects left by existing suites and **38**
session-created temporary settings/output directories. New P41 tests delete their own
projects. No E2E projects created during this session remain. Retained pre-existing
data, logs and shared Postgres; existing Jeeves health on 4310 remains OK. Only
planning/evidence/handoff documentation and screenshot copies changed after final gates.
P42 is next.
