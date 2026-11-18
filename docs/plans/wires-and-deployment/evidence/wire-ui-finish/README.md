# Finish studio wire rendering and interaction

Owner-authorized follow-up on `ff4a1ecc13c0a2ad7ec23542702d24715bf53b3b`, 2026-11-18. The owner
asked, “can you have an agent finish it?” This authorizes finishing the visible UI. This
follow-up adapts obsolete shared-line test assumptions as necessary implementation work while
preserving meaningful selection, hover and PNG coverage. This is not a new WD unit or a resumption of the backend WD12 drill. Historical stopped patches
and evidence are unchanged.

## What ships

Both studio views opt into generic Board lanes/wires/dots, source tile colours and alternating
per-wire shades, module marks/fans/gathers, individual soft outlined heads, async beads, blue
selection outlines and hover fading. Browser preference slots persist across reload and views;
view actions change neither design/history nor blueprint. The approved widths/spacing/head/hue
rules are unchanged. Only optional wire rendering uses deterministic Board-owned port anchors.
Legacy generic Board rendering/routing remains covered by its existing tests.

YouTube Detailed's two Transcoder write returns no longer share an upright trunk. Mouse picking
uses actual SVG M/L/C/Q geometry, including fans and rounded returns, with unsnapped coordinates.
Adaptive subdivision and shape-keyed caching preserve the nearest/group/menu chooser behavior.
The export helper decodes actual PNGs and samples the actual offscreen SVG geometry and each
wire's expected light colour; it retains legacy route-ink checks for non-wire boards.

## Actual browser evidence

[Final browser log](browser-fourth.log.gz) passes **2/2** (native fan plus twelve-case matrix,
1.3m). [Matrix](browser-matrix.json), [native fan receipt](native-fan-selection.json),
[geometry/export receipt](geometry-and-exports.json), [harness](browser-review.spec.ts.txt),
[native harness](browser-native.spec.ts.txt), [configuration](browser.config.mts.txt).

| Study | Simple wires | Detailed wires | Both themes, mouse, slots/reload, unchanged saved state/history | PNG |
| --- | --- | --- | --- | --- |
| TinyURL | 12 | 12 | Pass | [Simple](tinyurl-simple-light-export.png), [Detailed](tinyurl-detailed-light-export.png) |
| Marketplace | 24 | 26 | Pass | [Simple](marketplace-simple-light-export.png), [Detailed](marketplace-detailed-light-export.png) |
| YouTube | 25 | 26 | Pass | [Simple](youtube-simple-light-export.png), [Detailed](youtube-detailed-light-export.png) |

Screenshots are `<study>-<simple|detailed>-<light|dark>.png`; actual downloads are the same stems
with `-export.png`; capture metadata and observed SVG paths use `-capture.json`. Both theme
exports are byte-identical for each study/view even with a project reload between them. All six
unique actual PNGs were visually inspected; their tiles/icons/wires have light tones. There are
no zero-wire rows. All views have individual heads and async beads; the matrix checks exact
3.5/6.4/8.4px body/outline/selected-outline widths, colours in each theme, dots, hover, selection,
context menus and Fit. Full design responses (including history) and blueprints match before and
after. The difficult separated YouTube CDN and both module returns select the intended relationship.

The [YouTube Detailed native measurement](youtube-detailed-picking.json) compares all actual
paths with 4,336 native samples: maximum curve error **0.123 board px**, 730 flattened points.
Cold flatten-plus-nearest takes **1.10ms**, repeated median **0.10ms** (0–0.20ms, eight repeated
trials), versus WD08's historical **156.9ms** native-sampling median. This measures the same finite
geometry/nearest workload, not end-to-end interaction latency or a worst-case bound.

## Regression checks

- Final `pnpm check`: **155 files / 1,438 tests**, 118.37s; existing eight lint warnings/twelve
  infos remain. [Final check log](check-second.log.gz).
- Serial native `pnpm test:e2e`: **91/91**, 5.6m, including TinyURL and both mouse rebuilds;
  [log](e2e-full.log.gz). Web build passes in **879ms**, with the inherited chunk warning;
  [log](build.log.gz).
- Focused source checks and initial attempts are retained in compressed logs. Final full checks
  cover default/named row/header anchors, conflicting React Flow handle coordinates, cubic fan
  click/menu, repeat/cache invalidation, adaptive curve accuracy, all six real ELK layouts,
  palette/preferences, legend and PNG behavior.
- Relevant mouse tests retain canonical selection/module tracing, context removal/Undo, generic
  grouping and near-dot chooser mouse/scroll/camera coverage. No skipped cases, weakened colour
  assertions or inflated existing timeouts were used.

## Failures and corrections

1. The first focused invocation used `pnpm test -- ...`, which ran all tests: 1,432 passed and
   three new Detailed fixtures failed because their name callback was missing. Corrected the
   fixture and used direct Vitest filters. An experimental uniform capacity compression was
   removed: no actual study needs it, and approved pitch constants must stay fixed.
2. First native focused run: **22/24**. The old 16px shared-stem point offered only two nearby
   wires; the new 8px actual fan point offers exactly all four and retains chooser scrolling and
   mouse selection. The PNG helper sampled an intermediate live view after a toggle; it now
   observes the actual offscreen export SVG. Corrected affected native cases pass **6/6**.
   [First log](e2e-focused-first.log.gz), [corrected log](e2e-focused-second.log.gz), first PNG and
   chooser screenshots/traces are retained.
3. Matrix attempt 1 asserted hover opacity before its 120ms transition ended. Changed only the
   harness to poll computed opacity. Attempts 2/3 exposed intermittent strict PNG byte inequality:
   2,837 TinyURL pixels / 9,084 YouTube pixels, restricted to fan curves/bead rims. Final layout and
   observed SVG data agreed in the YouTube pair; late-observed data could follow an earlier clone.
   [Preserved mismatch paths](third-attempt-youtube-simple-light-capture.json),
   [pixel diff](youtube-first-theme-diff.png), [decode receipt](youtube-first-theme-diff.json),
   [standard-library decoder](png-diff.py.txt) and traces/logs remain. Board-owned anchors remove
   dependence on measured handles. The final matrix keeps and passes strict PNG equality; no
   palette change or byte-tolerance relaxation was introduced.
4. The anchor snapshot fixtures initially lacked jsdom ResizeObserver setup; added the same
   offline stand-in as existing Board tests. Their three cases pass. Initial full lint stopped
   only on four new evidence JSON formatting errors; formatting only this new directory fixed
   them. Earlier failures are preserved, never relabelled passes.

## Remaining limits

The six actual layouts have zero raw parallel overlaps within 8px and zero routes through other
tiles. At most three arrivals use a port, with the prescribed 22px spacing. Short fans and 0.75
gathers intentionally converge; they can be closer than 8px outside the dot. The prescribed head
outline leaves about **1.05px** before the tile frame. The historical synthetic ten-arrivals-on-a-
128px tile still collapses under fixed-size clamping; no new pitch compression or tile-growth
policy ships. Return fallback still chooses the least-bad route when every rule cannot fit.
Large arbitrary diagrams have no universal geometry or latency guarantee. These limits are
separate from the now-passing actual studio matrix.

## Scope and preservation

No design/schema/blueprint/chat/generation/settings/backend/dependency changes. No generated
source handpatch, owner database/project mutation, owner-port request/control, Docker resource
creation/prune, root/owner/old-evidence edits, branches/worktrees/stash/delegation, live/paid/model
API call, push or deployment. Only own task projects are deleted. [Final preservation receipt](preservation.json) records byte/mode/absence checks and exact
resource equality. The read-only [RG21 audit](rg21-preservation.log.gz) passes with process-local
Git abbreviation; original scripts, baselines and config remain unchanged.
