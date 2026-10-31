# P36 — integrated editor, reusable architecture and planned offerings

Completed 2026-10-31 in the existing checkout/branch with one agent. The user's
follow-up expanded the [specification](../../build-plan-p36-architecture.md) to
planned capabilities and a modular [CATALOG.md](../../../CATALOG.md), prioritizing
editor visuals over new runtime implementation or generation campaigns.

## Delivered behavior

- One Draw workspace with C1 context, the editable C2 board and scoped C3 components,
  collapsible chat and object/arrow inspection. Existing starters, recipes, resource,
  events, execution, pooling, deployment, generation and evidence entry points remain
  reachable. Selection, camera and dirty inspector drafts survive scope changes;
  stale edits retain their draft. The latest tab choice wins during a delayed save.
- A searchable library of existing registered templates and **26 planned types**:
  **20 C2 container/service families and six C3 component families**. Typed options
  express such things as cache policy, tenancy, delivery, storage and workload intent.
  Three separate editable architecture studies cover links/QR, community/discussion
  and social/content applications. They do not claim to reproduce named SaaS internals.
- Additive, stable responsibility/member bindings, explicit component/resource/
  connection use and declared C3 arrows. Generated contracts and per-member ownership
  remain visible. Grouping neither duplicates handlers nor fabricates a call graph.
  Lost bindings remain visible; invalid new bindings are refused atomically.
- The separate QR architecture fixture groups accounts, QR management, redirect,
  artwork and analytics. Every actual extension appears exactly once. Direct resource
  configuration reuses the existing editor. Scoped diagrams fit their external
  dependencies; overview cards prioritize readable names and selected details.
- Root catalog with C1 compositions cross-linked to shared C2/C3 families and reverse
  reuse links, availability labels, C4 implementation boundaries and a future load-test
  contract. AGENTS.md now requires maintaining it when offerings or boundaries change.

Planned objects remain `NEEDS_TEMPLATE`; their arrows cannot satisfy executable
ports. Workload settings are saved requirements, not measured capacity, automatic
infrastructure selection or a promise that generated code meets a target.

## QR reference and preservation

Reviewed `~/github/qrwty` at **`9bc5467`** read-only: all eight registered extensions
and shared artwork implementation. QR image rendering uses a QR library and owned
record lookup; redirect records a GET scan and returns the destination for the
browser to follow. Artwork handlers use shared rendering/storage helpers; analytics
uses bounded owner-scoped data. Older stub comments were not treated as runtime truth.

The new [architecture fixture](../../../fixtures/designs/qrwty-architecture.json)
adds metadata to the existing analytics fixture. Templates, runtime archives,
recipes, starters, lockfile and the original fixture are unchanged. Offline generator
tests prove metadata does not change generated output, ownership, contracts or
acceptance references. This is not a new execution proof of custom QR handlers.
Live QRWTY source, running services, accounts, data, URLs and saved design were untouched.

## Verification

Full command output and source fingerprints are retained locally under
`.jeeves-work/runs/<profile-id>.log` and `.json`.

| Check | Result | Profile |
| --- | --- | --- |
| Focused offline architecture/planning/generation/layout tests | 19 tests / 4 files, 1.9s | `2026-10-31T17-21-00-762Z-unit-98b48782` |
| Final production-build browser journeys | 30 passed, Playwright 23.4s / profile 25.1s | `2026-10-31T17-37-47-184Z-browser-preview-646db5a1` |
| Required `pnpm work run check` → `pnpm check` | All types; 665 tests / 99 files; 42.0s | `2026-10-31T17-38-37-548Z-check-2eac1dc6` |

All three listed passing profiles report unchanged source fingerprints. Final Biome
checked 685 files with 511 warnings and 75 infos, no errors; Vitest took 33.84s.
No dependencies or lint/error-observer rules were weakened.

Browser command:

```sh
pnpm work run browser-preview \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/architecture-layout.spec.ts \
  apps/web/e2e/architecture-evidence.spec.ts \
  apps/web/e2e/resources-editor.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/local-execution.spec.ts \
  apps/web/e2e/local-http-pool.spec.ts \
  apps/web/e2e/local-deployment.spec.ts \
  apps/web/e2e/delivery.spec.ts \
  apps/web/e2e/workspace.spec.ts \
  apps/web/e2e/template-upgrade.spec.ts \
  apps/web/e2e/starters.spec.ts \
  apps/web/e2e/chat.spec.ts
```

Chromium **153.0.8010.12**, Playwright **1.63.0**, built Vite preview on loopback
4301/API 4311 and isolated `jeeves_e2e`. Tests use real operations and mouse controls
for placement, connection, typed settings, Save/Cancel, undo/redo, reload, conflict
retention, grouping, resource inspection and rapid navigation. They also check
generation/evidence refresh and existing executable configuration workflows. Chat
uses its scripted test provider; starter generation is write-only. Strict unexpected
network/console/exception diagnostics and axe checks remain active, including desktop,
medium, 390px and dark-theme journeys.

Earlier attempts are retained as failures, not counted as passes. They exposed
stale navigation after a layout save, a queued initial fit that could remain pending,
over-wide planned cards, mobile canvas sizing, planned-component Save validation,
and obsolete test selectors/readiness assumptions. These were corrected. The final
camera uses measured bounds with the initialized viewport instead of waiting on a
controlled-node fit queue. A new delayed-layout browser step covers navigation order.
One concurrent gate/browser attempt (`17-34-53-863Z-check-f3dc9a12`) exceeded the
existing five-second limits in two offline tests; the final gate ran separately and
passed without extending timeouts. The final browser profile has no retries.

Removed **148 named disposable projects created during this session** from the
isolated E2E database and **230 session-created E2E settings/output directories**.
Other projects and the shared Postgres service were preserved. Final read-only checks
confirmed the existing Jeeves development web/API remained healthy at 4300/4310.
Local catalog/document links and `git diff --check` were checked before commit.

## Inspected screenshots

These are retained from the final browser run and were visually inspected.

| Screenshot | What it demonstrates |
| --- | --- |
| [Library examples](p36-library-examples.png) | Planned examples beside the implemented starter/recipe entry point. |
| [Cache options](p36-cache-options.png) | Shared C2 board, left chat draft, right typed inspector and saved cache policy. |
| [Community components](p36-community-components.png) | Planned responsibilities, selected declared relationship and external dependencies. |
| [QR components](p36-qr-components.png) | Five real responsibilities plus technical boundary, fitted external client/store and direct resource configuration. |
| [Medium viewport](p36-medium.png) | 1000px fitted overview with inspector. |
| [Mobile dark](p36-mobile-dark.png) | 390px navigation, fitted overview and mouse/touch-accessible controls. |

Large diagrams use overview labels at low zoom; full descriptions and contracts
remain available by selecting/focusing a card. Mobile panels overlay the canvas.

## Deferred boundary and next work

New template runtimes, template generation/conformance campaigns, stress/load-test
implementation, cloud provisioning and automatic topology/scaling are deferred by
the user. There is no general C4 code/class-diagram editor. Domain/library choices
such as QR encoding remain implementation responsibilities; a future generic load
test cannot certify their correctness. Page-flow editing, developer tester access,
chat-context expansion and live QRWTY adoption are separate future packages.

Review the visible editor and catalog before specifying the next package. Keep the
single-agent/current-branch workflow and preserve existing immutable releases.
