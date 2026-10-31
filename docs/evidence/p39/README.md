# P39 — C4 container notation evidence

[Specification and recorded decisions](../../build-plan-c4-saas.md#p39--c4-container-notation-on-the-c2-board).
Started clean at `3d4fb0f` on the existing `main` checkout. One agent, no delegation,
branches or worktrees. Followed AGENTS, PLAN §15 and the latest P37/P38 handoffs.

C2 now shows a stereotype, name, technology and short responsibility. Optional
`element.description` is bounded at 240 characters; optional technology at 120.
Implemented technology comes from a spec display map, independent of manifests or
pins. Planned technology uses an explicit override, an engine/default where present,
or “Technology unspecified”. Empty descriptions use a display default, never notes.
Old documents are not migrated. Planned metadata saves with its options; executable
descriptions have explicit Save/Cancel and retain drafts across selection/conflicts.

Cards have at most two config chips and a compact capability icon row. The type
label opens the existing reviewed subtype workflow; the inspector retains subtype
and explicit version controls. Compatible add-capability actions are compact icons
with accessible names/tooltips and keep the card's selection geometry stable.
Descriptions/chips hide below zoom 0.55. Family colors, database cylinders, grey
external systems, person glyphs and separate status/selection/issue cues remain.

The labeled, dashed system boundary derives from measured non-external containers.
Context people/external systems with system relationships appear outside, with
bound edges reaching their containers and unbound edges reaching the boundary.
Planned external blocks derive positions outside as well. Authored layout stays
intact; derived nodes are neither annotations nor saved layout entries. Context
objects/relationships open the existing mouse editor from C2 and Find object.
The scope caption sits outside a measured canvas wrapper, so all four controls fit.

## Verification

Final production browser profile: `2026-10-31T20-58-04-769Z-browser-preview-d0e62f7d`.
**38 tests / 14 suites passed**, Playwright **28.2s**, profile **30.0s**, no retries,
strict diagnostics and unchanged source fingerprints.

```bash
pnpm work run browser-preview \
  apps/web/e2e/container-notation.spec.ts \
  apps/web/e2e/resources-editor.spec.ts \
  apps/web/e2e/editor-interactions.spec.ts \
  apps/web/e2e/template-upgrade.spec.ts \
  apps/web/e2e/architecture.spec.ts \
  apps/web/e2e/architecture-authoring.spec.ts \
  apps/web/e2e/editor-simplification.spec.ts \
  apps/web/e2e/draw.spec.ts \
  apps/web/e2e/inspector.spec.ts \
  apps/web/e2e/api-contracts.spec.ts \
  apps/web/e2e/chat.spec.ts \
  apps/web/e2e/delivery-focus.spec.ts \
  apps/web/e2e/delivery.spec.ts \
  apps/web/e2e/local-http-pool.spec.ts
```

Covers description/technology Save/Cancel/undo/redo/reload, retained 409 drafts,
context Save/Cancel/history and unbinding, subtype loss review and protected/exact
pins, native attachment dragging, placement/resize/selection, resources, API
contracts, events, chat and existing C1/C3 navigation. Axe passes desktop and
390px dark C2, plus the exercised inspector/configuration/reference surfaces.
Fit assertions check every node, the measured canvas bounds and mouse controls.
Only specific intentional 409 responses are registered; provider work is scripted.

`pnpm work run check` → **`pnpm check` passed**, profile
`2026-10-31T20-58-35-024Z-check-77e8d978`, **43.8s**, unchanged fingerprints.
Biome checked **703 files**, **561 warnings / 75 infos / no errors**. All workspace
and script typechecks passed. **677 tests / 103 files passed**, Vitest **35.99s**.
Includes bounded metadata, fallback safety for unknown templates, measured boundaries,
external exclusion, bound/unbound projection, unchanged inputs and generator
artifact/ownership equality. Existing golden fixtures pass unchanged.

Interim logs remain in `.jeeves-work/runs/`. Corrections include boundary hit testing,
external color variables, tool-hint overlap, reserved capability geometry, stale
inline-select/tab selectors, a moving native-drag camera and premature redo/reload.
Whole-page axe checks now wait for closing menus/dialogs to unmount. The scope caption
initially fought React Flow's inline wrapper sizing; a separate stage fixes the bottom
control clipping. No timeout/retry increase or diagnostic suppression was added.

## Inspected screenshots

Opened and visually inspected all six captures from the final successful run.

| Capture | Observation |
| --- | --- |
| [QR light](qr-light.png) | Three implemented containers, technology/description/chips, cylinder, people outside the named boundary; all controls visible at 1440 × 900. |
| [Link platform light](link-platform-light.png) | Eight planned containers, engine defaults, family colors and separate Planned labels fit at 1440 × 900. |
| [QR dark](qr-dark.png) | 390 × 844 overview fits all boxes and controls; zoom hides detailed descriptions/chips. |
| [Link platform dark](link-platform-dark.png) | Full planned composition fits the same narrow overview without horizontal overflow. |
| [Description conflict](conflict.png) | Saved description remains on the card while the draft and reachable Save/Cancel survive the 409. |
| [Unbound context](unbound-context.png) | Mouse-edited context relationship is Not assigned and reaches the system boundary. |

## Boundaries and cleanup

No template, runtime, recipe, generator implementation, dependency pin, lockfile,
golden fixture or live QRWTY change. Generated artifacts and ownership stay identical;
the existing lossless `jeeves/design.json` input snapshot naturally retains new metadata
when present. Catalog offerings, availability and reusable C1–C3 boundaries are unchanged,
so `CATALOG.md` is unchanged. Only evidence/planning/handoff documents changed after gates.

Legacy planned examples deliberately keep unspecified technologies until explicitly
chosen; their reviewed content refresh is P43. Authored board positions are preserved,
including existing arrow/card overlaps. Relationship labels, protocols and the old
planned-edge dash semantics remain P40; this package claims N1/N2/N4/N5/N6 only, not N7–N9.
Narrow views are overviews; mouse zoom and selection expose detail.

Removed **165** named session-created projects from `jeeves_e2e` and **172** session-created
E2E settings/output directories, restricted by exact names/time or directory birth time.
Retained existing data/logs and shared Postgres. Existing Jeeves API health on 4310 is OK.
