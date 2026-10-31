# P40 — Relationship labels, protocols and line semantics

[Specification and recorded decisions](../../build-plan-c4-saas.md#p40--relationship-labels-protocols-and-line-semantics).
Started clean at `fcfe48b` on the existing `main` checkout. One agent, sequential
package work, no branches, worktrees or delegation. Followed AGENTS, PLAN §15,
the latest P38/P39 handoffs and recorded C4 decisions.

Executable connections accept optional `label` (120 characters), `protocol`
(80 characters) and the existing three interaction choices. The atomic
`updateConnection` operation preserves connection order, identity and capability
bindings. Old documents retain their serialization until edited. Defaults follow
the current target name: “Reads and writes … records” / SQL, “Calls … API” /
HTTPS/JSON, or “Uses …” / Undecided. An existing API suffix is not repeated.
Labels/protocols use shared Zod definitions; planned protocols now accept bounded
text, including HTTPS/JSON or AMQP, through the existing inspector.

The executable inspector has explicit Save/Cancel and retains dirty drafts across
selection and 409 reloads. Undo/redo/reload follows existing semantic history.
C2/C3 render a verb phrase and protocol separately, solid request/response lines,
dashed asynchronous lines and dotted streaming lines. Planned intent is a badge;
it never determines the line pattern. The existing type-color legend also explains
relationship styles. C1 relationships keep their existing descriptions and styling,
without protocols. C2 projections of context intent show Undecided rather than
inferring a transport from prose.

C3 connection uses inherit the existing connection's presentation. Resource uses
name their selected resources, aggregated once per existing store connection;
inferred account/resource dependencies use the connection label. Declared component
relationships retain their descriptions, with optional protocol/interaction fields
in their existing dialog (default In process / request-response). No per-use
label-override model or new dialog was needed. “Declared use” and “Uses store”
are absent from rendered edges.

C2 labels reserve space against measured cards and earlier labels within fitted
object bounds. A thin leader associates a displaced label with its arrow; authored
positions, arrows, annotations and saved layout are not rewritten. C3 layout reserves
space for the largest overview text, protocol and Planned badge, avoiding overlapping
text lines. Existing authored arrow crossings remain; this is not automatic rerouting.

## Verification

Final production browser profile: `2026-10-31T23-09-15-415Z-browser-preview-c3f68a50`.
**36 tests / 10 suites passed**, Playwright **26.0s** / profile **27.8s**, no retries,
strict diagnostics and unchanged source fingerprints.

```bash
pnpm work run browser-preview \
  apps/web/e2e/relationship-notation.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/draw.spec.ts \
  apps/web/e2e/chat.spec.ts \
  apps/web/e2e/container-notation.spec.ts \
  apps/web/e2e/inspector.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/api-contracts.spec.ts
```

Covers QR and all three examples at C2/C3, bounded labels without card/label overlap,
line-pattern assertions, declared-component protocol/async editing, executable
Save/Cancel/undo/redo/reload/409 draft retention and planned streaming persistence.
Existing context/configuration, placement, selection, chat, protected contracts and
API reference journeys pass. Axe covers desktop C2/C3, 390px dark C2 and existing
inspector/configuration/reference surfaces. Only intentional 409s are registered;
providers are scripted and generated projects disposable.

`pnpm work run check` → **`pnpm check` passed**, profile
`2026-10-31T23-10-01-560Z-check-adbb57ab`, **45.2s**, unchanged fingerprints.
Biome: **710 files**, **577 warnings / 75 infos / no errors**. All workspace/script
typechecks passed. **686 tests / 105 files passed**, Vitest **37.69s**. Generator
golden/ownership checks pass unchanged; added checks compare all generated artifacts,
wiring and ownership with metadata edited on both the QR fixture and protected recipe.
The lossless input snapshot `jeeves/design.json` naturally retains edited metadata.

Interim logs remain in `.jeeves-work/runs/`. Fixed test assumptions about C3's initially
closed inspector and the restored C2 panel before narrowing; screenshot review exposed
card-hidden labels, label collisions/out-of-fit positions and overlapping C3 text.
The first full check also caught a stale expected API suffix and a 5-second existing
PGlite migration-test timeout while browser tests were running. Corrected the assertion
and ran the final gates sequentially; no timeout increase, retry or suppression.

## Inspected screenshots

Opened and visually inspected all fifteen final captures. Desktop C2/C3 captures
are 1440 × 900; dark C2 captures are 390 × 844. Narrow diagrams are fitted overviews;
mouse zoom/selection remains necessary for detailed reading.

| Design | C2 light | C3 light | C2 narrow/dark |
| --- | --- | --- | --- |
| QR fixture | [Containers](qr-c2-light.png) | [Components](qr-c3-light.png) | [Overview](qr-c2-dark.png) |
| Link platform | [Containers](link-platform-c2-light.png) | [Components](link-platform-c3-light.png) | [Overview](link-platform-c2-dark.png) |
| Community | [Containers](community-c2-light.png) | [Components](community-c3-light.png) | [Overview](community-c2-dark.png) |
| Social | [Containers](social-c2-light.png) | [Components](social-c3-light.png) | [Overview](social-c2-dark.png) |

[Retained conflict draft](conflict.png) shows saved presentation alongside the dirty
draft and reachable Save/Cancel. [Streaming](streaming.png) shows AMQP and the saved
Streaming choice. [Declared collaboration](component-relationship.png), a focused
1440 × 1000 capture with chat/inspector open, shows its In process label and dashed
async arrow; the full community overview is captured separately above.

## Boundaries and cleanup

No template, runtime, recipe, generator implementation, dependency/lockfile, golden
fixture or live QRWTY changes. No offerings, availability or reusable C1/C2/C3 boundaries
changed, so CATALOG.md is unchanged. Only evidence/planning/handoff documentation changed
after the final gates. Removed **36** exact-name/session-time E2E projects and **70**
session-created temporary settings/output directories. Retained pre-existing data,
logs and shared Postgres; existing Jeeves health on 4310 remains OK. P41 is next.
