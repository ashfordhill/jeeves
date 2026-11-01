# P43 — QRWTY target architecture and example refresh

[Specification and recorded decisions](../../build-plan-c4-saas.md#p43--qrwty-target-architecture-example-and-example-refresh).
Started clean at `39f86cd` on the existing `main` branch. Followed AGENTS, PLAN §15
and the latest handoffs; one agent, sequential work, no branches/worktrees/delegation
or repeated external research.

The library now creates a separate **QRWTY target architecture** project with fourteen
planned blocks and nineteen responsibilities: API (8), redirect (2), worker (3), owner
web app (5) and staff console (1). It includes teams, plans, developer access, CDN,
analytical storage and third-party payment/e-mail delivery. C1 distinguishes owners,
team administrators, QR visitors, the destination website and providers. Destination
navigation belongs to the visitor browser; no service-to-destination call is invented.
The [study](../../examples/qrwty-target.md) records the proposed technology choices,
responsibilities, editable options and navigation.

The links, community and social studies now contain thirteen, fourteen and fifteen
planned blocks respectively, with identity, billing, delivery, CDN and observability.
Containers and authored components have explicit descriptions and proposed technology;
relationships have verbs and protocols. Community adds a subscription-delivery scope;
Social adds mobile API and offline-reading responsibilities. Library miniatures derive
all their nodes and connections from the actual compositions. The [catalog](../../../CATALOG.md)
records the new offering and reusable boundaries. Factory changes affect newly created
studies; no existing saved project is rewritten.

## Small supporting changes

- Optional `architecture.nodes[].container` binds an external C1 identity to an existing
  planned external block. Validation rejects missing/internal targets, person bindings
  and duplicate provider bindings. C2 reuses that block and a matching directed connection;
  renaming does not break the binding. Removing the block preserves the context identity.
  The existing context inspector exposes the binding with Save/Cancel and history.
- Declared C3 container uses retain incoming queue/provider direction. In-process target
  relationships resolve member access, execute link operations and resolve the billing
  organization. These are planning dependencies, not additional generated wiring.
- Fitted desktop cards retain stereotype, description and technology, with whole text
  lines and C3 data-store cylinders. Narrow overviews cap title enlargement. The C2 zoom
  floor permits larger studies to fit at 390px, and relationship labels can use the full
  fitted bounds. C1/C3 Fit View includes routed bends and labels as well as cards, through
  a presentation-only extent. No extent or derived boundary enters saved layout/design.

These changes complete the example checklist on the existing editor surfaces; no new
runtime, generator implementation or dependency is introduced.

## Verification

Final production browser profile: **`2026-11-01T00-19-13-368Z-browser-preview-eb355ccc`**.
**50 tests / 11 suites passed**, Playwright **56.3s** / profile **58.1s**, no retries,
strict browser diagnostics, unchanged source fingerprints.

```bash
pnpm work run browser-preview \
  apps/web/e2e/architecture-examples.spec.ts \
  apps/web/e2e/architecture-layout.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/relationship-notation.spec.ts \
  apps/web/e2e/container-notation.spec.ts \
  apps/web/e2e/saas-components.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/draw.spec.ts \
  apps/web/e2e/chat.spec.ts
```

All four examples are created through the library by mouse, with an untouched seed
project, one saved initial revision, correct miniature node/edge counts, C1/C2 and every
authored C3 scope. The target's team options exercise Cancel, Save, undo/redo and reload;
provider binding exercises Cancel, Save, undo and reload. Navigation/zoom preserve saved
semantics. Desktop assertions require visible C4 content, C3 data cylinders, and fitted
card/relationship bounds; narrow cases also check relationship bounds and page overflow.
Every captured diagram passes axe. Existing C4 editing, full technical projections,
worker failure/retry, pins, retained conflicts, placement, resource operation uniqueness,
drawing and scripted chat pass.

**`pnpm work run check` → `pnpm check` passed**, profile
**`2026-11-01T00-20-14-035Z-check-028cd425`**, **43.6s**, unchanged fingerprints.
Biome: **716 files**, **643 warnings / 75 infos / no errors**. All workspace/script
typechecks passed. **736 tests / 107 files passed**, Vitest **36.55s**. New tests cover
bounded example content, technologies, valid planned creation, independence, generation
blocking, explicit provider reuse/validation/removal/renaming, incoming C3 edge direction
and camera bounds beyond cards. Existing generator golden/ownership checks pass; fixtures
and generator/runtime implementations are unchanged. Focused unit checks and web/spec
typechecking also passed during implementation.

Interim logs retain the corrected catalog ID, crowded C2 labels, hidden desktop details,
clipped narrow relationship label and whole-line text spacing. The first full check was
interrupted by SIGTERM after typechecking, during unit execution; the final check above
completed. The expanded layout suite exposed two stale pre-P42 technical-node count
assumptions; those tests now explicitly enable the existing toggle and retain their
original full-projection assertions. A later browser run passed 49/50 and caught an
existing placement test issuing a second placement before the first saved card appeared,
reusing its ID. The test now waits for each visible card before the next gesture. No
retry/timeout increase or diagnostic suppression. Final gates ran sequentially. Only
this evidence, screenshot copies and handoff changed after the final gates.

## Inspected captures

All **53 final captures** were reviewed in five contact sheets, with representative
QR C1/C2, API, worker, web and narrow API views also opened at full size during review.
Desktop is **1440 × 900 light**; narrow is **390 × 844 dark**. Dense fitted diagrams
remain overviews; mouse zoom/selection and the inspector reveal details. No authored
C3 scope exceeds ten components. Infrastructure and vendor internals have no authored
application decomposition in these studies.

[Library and composition-based miniatures](p43-library.png).

| QRWTY target view | Desktop | Narrow / dark |
| --- | --- | --- |
| C1 | [Context](p43-qrwty-target-c1-light.png) | [Context](p43-qrwty-target-c1-dark.png) |
| C2 | [Containers](p43-qrwty-target-c2-light.png) | [Containers](p43-qrwty-target-c2-dark.png) |
| C3 Application API | [Components](p43-qrwty-target-c3-api-light.png) | [Components](p43-qrwty-target-c3-api-dark.png) |
| C3 Redirect service | [Components](p43-qrwty-target-c3-redirect-light.png) | [Components](p43-qrwty-target-c3-redirect-dark.png) |
| C3 Analytics worker | [Components](p43-qrwty-target-c3-worker-light.png) | [Components](p43-qrwty-target-c3-worker-dark.png) |
| C3 Owner web app | [Components](p43-qrwty-target-c3-web-light.png) | [Components](p43-qrwty-target-c3-web-dark.png) |
| C3 Admin console | [Components](p43-qrwty-target-c3-admin-light.png) | [Components](p43-qrwty-target-c3-admin-dark.png) |

| Links & QR view | Desktop | Narrow / dark |
| --- | --- | --- |
| C1 | [Context](p43-link-platform-c1-light.png) | [Context](p43-link-platform-c1-dark.png) |
| C2 | [Containers](p43-link-platform-c2-light.png) | [Containers](p43-link-platform-c2-dark.png) |
| C3 API | [Components](p43-link-platform-c3-api-light.png) | [Components](p43-link-platform-c3-api-dark.png) |
| C3 Redirect | [Components](p43-link-platform-c3-redirect-light.png) | [Components](p43-link-platform-c3-redirect-dark.png) |
| C3 Worker | [Components](p43-link-platform-c3-worker-light.png) | [Components](p43-link-platform-c3-worker-dark.png) |
| C3 Web | [Components](p43-link-platform-c3-web-light.png) | [Components](p43-link-platform-c3-web-dark.png) |

| Community view | Desktop | Narrow / dark |
| --- | --- | --- |
| C1 | [Context](p43-community-c1-light.png) | [Context](p43-community-c1-dark.png) |
| C2 | [Containers](p43-community-c2-light.png) | [Containers](p43-community-c2-dark.png) |
| C3 API | [Components](p43-community-c3-api-light.png) | [Components](p43-community-c3-api-dark.png) |
| C3 Worker | [Components](p43-community-c3-worker-light.png) | [Components](p43-community-c3-worker-dark.png) |
| C3 Web | [Components](p43-community-c3-web-light.png) | [Components](p43-community-c3-web-dark.png) |
| C3 Notifications | [Components](p43-community-c3-notifications-light.png) | [Components](p43-community-c3-notifications-dark.png) |

| Social view | Desktop | Narrow / dark |
| --- | --- | --- |
| C1 | [Context](p43-social-c1-light.png) | [Context](p43-social-c1-dark.png) |
| C2 | [Containers](p43-social-c2-light.png) | [Containers](p43-social-c2-dark.png) |
| C3 API | [Components](p43-social-c3-api-light.png) | [Components](p43-social-c3-api-dark.png) |
| C3 Worker | [Components](p43-social-c3-worker-light.png) | [Components](p43-social-c3-worker-dark.png) |
| C3 Web | [Components](p43-social-c3-web-light.png) | [Components](p43-social-c3-web-dark.png) |
| C3 Mobile | [Components](p43-social-c3-mobile-light.png) | [Components](p43-social-c3-mobile-dark.png) |
| C3 Realtime | [Components](p43-social-c3-realtime-light.png) | [Components](p43-social-c3-realtime-dark.png) |

## Boundaries and cleanup

No live QRWTY, template/runtime/recipe/generator implementation/output, dependency pin,
lockfile or golden fixture edits. All example capabilities remain planned. The small
provider binding and presentation extensions above were needed to avoid duplicate
providers and complete the notation/fitting checklist on the larger studies. Page flows,
chat-library awareness and dynamic scenarios retain their later scopes.

Removed **50** exact-name/session-time E2E projects and **132** session-created E2E
settings/output directories. No projects from this browser session remain. Retained
pre-existing data/logs/shared Postgres; existing Jeeves health on 4310 remains OK.
`git diff --check` and local documentation targets were checked before commit.
**P44 is next**, followed by P45; continue the current-checkout, one-agent policy.
