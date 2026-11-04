# UX01 — Baseline, inventory and public inputs

**Complete.** Evidence directory casing is **UX01** throughout. Baseline source is feff820 on
primary main, 2026-11-03 (America/Chicago). This unit changes evidence and narrowly scoped lint
input hygiene only. It implements no studio model/UI/runtime and starts no later unit.

- [Action inventory](action-inventory.md) accounts for current shell, workspace, graph, board,
  dynamic menus, Library, source editors, Generate/Runs and settings/chat controls. The separate
  [menu audit](menu-source-audit.json) enumerates every actual non-test Menu.Item/CheckboxItem site.
- [Coverage inventory](coverage-inventory.md) accounts for nine shipped examples plus E10–E14,
  with incomplete P73a/P73b clearly retained. [Factory baselines](shipped-example-baselines.json)
  pin emitted design/layout hashes and counts. No runtime capability is added.
- [Public inputs](fixtures/README.md) cover six cases in seven small JSON files; the rich legacy
  case uses a compact public-factory descriptor. [Fixture manifest](fixture-manifest.json) pins
  IDs, provenance and before hashes. Future studio inputs are intentionally not accepted by the
  old strict parser until UX02a. No registry entry or runtime template is created.
- [Raw source hashes](source-hashes.json) pin repository factories/helpers/briefs, all frozen
  benchmark files and original feedback pairs. [Preservation check](preservation.json) records
  the final comparison; original feedback and frozen inputs remain byte-identical.

## Direct browser baseline

Used installed Playwright Chromium directly as a one-off inspection, not the E2E suite. Existing
servers remained on 127.0.0.1:4300 / 4310. The browser request guard was registered before page
creation and allowed only GET/HEAD/OPTIONS while viewing the existing target. No save/generation/
provider action was used. [Browser record](read-only-browser.json): no attempted blocked writes,
page errors, warning/error console messages or HTTP errors. [Existing-project hashes](live-project-preservation.json)
compare every pre-existing project's semantic document and layout before/after; all unchanged.
Only IDs/hashes/revisions are stored, not user document contents.

C2 and API C3 were inspected at both required sizes:

| Size | C2 | C3 |
| --- | --- | --- |
| 1440×900 | [Baseline](screenshots/live-containers-1440x900.png) | [Baseline](screenshots/live-components-1440x900.png) |
| 1280×800 | [Baseline](screenshots/live-containers-1280x800.png) | [Baseline](screenshots/live-components-1280x800.png) |

The saved cameras are preserved, so some cards/relationships extend outside the viewport. Both
sizes show the current broad action rows, Explorer, persistent Saved chrome, verbose relationship
panels and large responsibility lists/dashed planned-card outlines. No fresh-fit or redesign is
claimed. [Opened editor menu](screenshots/live-editor-menu-1440x900.png) supports the source inventory.

For a gesture, created a separate owned project from the unchanged **public QRWTY target factory**,
not a user's saved project. Its API C3 contains 22 cards / 39 relationships. The browser guard allowed
only that exact project's PUT layout route; all other non-read methods were blocked. Clicked a
card, used Focus selection, dragged its existing small grip in 12 pointer steps (108×48 screen
pixels), dropped, then awaited acknowledgements. Only layout writes succeeded. The original
semantic revision remained 1 and its initialized semantic before/after hashes match.
[Owned IDs/cleanup](owned-project.json) records every disposable attempt and deletion/404.

See [drag before](screenshots/drag-before-1440x900.png), [mid-move](screenshots/drag-mid-1440x900.png),
[after](screenshots/drag-after-1440x900.png), [recording](screenshots/drag-1440x900.webm),
[raw frames](drag-observations.json) and [analysis](drag-analysis.json). This bounded reproduction
retained all 39 edge paths/labels and 22 card identities in every sample. Only the dragged card
moved; four incident paths changed, with two incident labels relocating later in the move. No
edge had an empty path, display:none or zero opacity. No additional worker/postMessage appeared
during movement/drop. Unrelated paths stayed at their captured geometry in this case. Selection
still visibly fades unrelated cards/edges, which is separate from disappearance.

The original feedback GIF's reported flicker is historical observed evidence. **This run did not
reproduce complete edge disappearance**, and 12 sampled DOM frames are not a frame-perfect GPU
trace. Source-backed candidate: ArchitectureGraph.tsx sets temporary dragging positions on each
move; its current-geometry memo calls positionedArchitectureGeometry; layout.ts:240–279 loops
all sorted relationships, reserves each label against all cards/earlier labels, and rebuilds a path
when its label relocates, even if neither endpoint moved. This can disturb unrelated geometry, but
is not proof of the flicker root cause. No performance fix or routing change is made in UX01.
layout-client.ts caches 16 results and creates one worker per uncached input; the topology key
excludes drag positions, explaining the stable observed worker count.

## Checks and baseline hygiene

Exact commands/results are in [checks/results.json](checks/results.json), with command logs beside
it. Used Node 24.21.0 by placing /home/ash/.nvm/versions/node/v24.21.0/bin first on PATH.

The initial pnpm lint exited 1: two immutable Excalidraw SVG copies lacked accessible title elements,
and the earlier **derived** review browser JSON lacked its trailing newline. The initial result
already contained 2,797 warnings and 88 infos. biome.json now explicitly excludes only the raw
.jeeves-feedback input and the exact preserved review sources directory. The derived browser JSON
gained its final newline. No source SVG/Excalidraw bytes changed; no application warnings were
suppressed. Final lint passes with the same warning/info counts. Typecheck and web production
build pass; build retains the existing >500 kB chunk advisory.

Unit/E2E/template suite maintenance and execution, pnpm check, runtime generation and provider
calls are deferred/excluded. Future studio parsing, source reconstruction maps and redesigned
interaction behavior remain later-unit work. Existing live saved projects were never rewritten.
