# WD08 — review of the wire canvas

Independent review on `e1c7f87863541029dc41450726b5d159d8bea560`, 2026-11-18. Findings were
written before the fix. WD01–WD05 are accepted; WD06 and WD07 are stopped patches with their
source attempts restored. **Studio wires remain off. This is not a completed wire matrix.**

## Findings first and dispositions

1. **Owner follow-up — activation versus retained regressions.** The unchanged Detailed
   `pointNear` chooser case requires CDN and both Transcoder incoming routes within 2px of one
   point. Distinct incoming lanes/heads remove that shared approach. Its helper also reads C/Q
   control coordinates as polyline vertices. The WD06 patch retains the actual failure.
   Recreating the shared run or changing the old test would contradict the assigned boundary.
   The transparent wire BaseEdge separately conflicts with old inline selected-stroke checks;
   the old PNG centre-ink helper also failed. None of these failures is resolved or relabelled
   passed here. WD06 remains stopped, and absent wires still prevent WD07 hover acceptance.
2. **Fixed — clicking visible wire artwork can select a different line.** Both click and context
   menu used raw layout polylines, although the artwork has cubic fans/gathers and rounded corners.
   React Flow additionally snapped pointer coordinates to the board's 32px grid. Two new tests
   failed first, selecting `middle` instead of `upper` on the exact emitted upper fan. Measuring
   artwork alone still failed; disabling pointer snapping for optional wires completed the fix.
   Both handlers now measure the live wire body in 2px arc-length steps and use the existing
   nearest-line/group chooser. Legacy boards return their original routes and pointer behavior.
   [Failure](evidence/wd08/selection-fail-first.log),
   [geometry-only failure](evidence/wd08/selection-curves-only-failure.log),
   [board pass](evidence/wd08/board-after-fix.log). Native Chromium also clicked and right-clicked
   the upper fan successfully in an isolated generic Board fixture, without SVG mocks or studio
   activation: [receipt](evidence/wd08/optional-board-native-selection.json),
   [image](evidence/wd08/optional-board-native-selection.png). This does not prove the failed WD06
   YouTube click or the rest of its wire matrix.
3. **Owner follow-up — YouTube Detailed still has a shared return trunk.** Independent optional
   layout of the actual Detailed projection yields both `transcoder-write/transcoder-packager`
   and `transcoder-write/transcoder-thumbnails` at **x816, overlapping y918–979**. Their final
   approaches are distinct; this 61px upright overlap is away from a dot. Existing WD study lane
   tests cover Simple only. Their zero-overlap claims remain valid for that scope. The shared
   trunk is reproduced by the retained input/layout/art in
   [optional-layouts.json](evidence/wd08/optional-layouts.json), YouTube/detailed. Return fallback
   and size/routing changes need owner direction; no routing redesign is made here.
4. **Owner follow-up — fixed-size capacity and literal clearance limits.** A generic synthetic
   128px target with ten incoming lines produces y `[0,0,0,0,12,34,56,78,100,122]`: clamping can
   collapse arrivals. This is a board capacity probe, not a claim that this exact degree is
   authorable in the studio. Separately, the prescribed 36px fans intentionally converge:
   native samples 12 arc-pixels from a shared port are sometimes less than 8px apart, beyond the
   5.5px dot radius. That measured trait makes the literal clearance checklist ambiguous near
   fans; it is distinct from the unintended shared return trunk. All measured soft heads have
   tips 3.6px before the target frame, with a 5.1px outline leaving a nominal **1.05px gap**.
   The constants match the prescribed renderer; whether that counts as touching needs owner
   interpretation. No spacing/head constant is changed.
5. **Measured limitation — click work grows with path length.** Native sampling plus actual
   `nearestLines` took median 129.4ms for YouTube Simple (4,763 points) and 156.9ms for Detailed
   (6,510 points), seven trials each. This is input-proportional work, with no hard sample cap
   and no worst-case latency claim. Length must be positive and finite before allocation.
   Optimization is an owner follow-up; no coarse cap or geometry refactor is introduced.

## Full diff scope

The owner plan commit is `95d60ac`. Its combined diff through the review start has **781 paths**:
751 accepted RG23–RG26-only paths, one shared append-only `docs/handoff.md`, and 29 WD-only paths.
The complete [inventory](evidence/wd08/diff-inventory.tsv) classifies every path. The accepted RG
commits are `99396d1` (RG23), `ed99644` (RG24), `3bfce24` (RG25), and amended `0ea91d3` (RG26).
Their fixtures, integration harness/scenarios, proof artifacts, assembly README contract/snapshot
and current guidance/retired queues are accepted background, not WD changes. The actual WD
implementation baseline is **`0ea91d3406ca3c668534fa80c8e67d23fcd9fe11`**.

Against that baseline, production WD changes are optional generic-board lane routing/artwork,
pure web colour functions and browser preferences. New tests, evidence and handoffs account for
the rest. WD06/WD07 contain only saved attempts and stop handoffs. The current LaneCanvas and
Workspace supply no `wire`, `dot` or `lanes`; hover CSS is absent. Stopped source was inspected as
patch text and never applied. No later unit was read or executed.

## Handoff rough-edge ledger

| Origin | Passed-on issue or limit | Disposition in this review |
| --- | --- | --- |
| WD01 | Inherited RG26 receipt formatting blocked the first combined check. | Corrected in accepted amended RG26; no inherited receipt edit here. |
| WD01 | Planned formatter path differed; import wrapping was mechanical. | Actual `tooling/biome.config.json` used; no algorithm change. |
| WD01 | Snapshot comparator initially treated absent baseline entries as files. | Historical comparator correction only; independent byte/mode/absence audit repeated here. |
| WD01–05 | Optional additions had no studio callers. | Still true; all 12 live cases have zero wires. |
| WD02 | Unused imports/Biome wrapping; successful timing output was suppressed. | Resolved in that unit; its measurement receipt remains intact. Independent six-case measurements below. |
| WD02 | YouTube Simple crossings increased 1→2. | Reproduced; owner follow-up, no new routing choice. |
| WD02 | Return separation was deferred. | WD03 added optional return lanes; Simple studies remain clear. Detailed shared trunk is finding 3. |
| WD02 | Preservation image format and added-import order assumptions needed correction. | Historical tooling issues; independent comparisons do not change baseline files. |
| WD03 | New named-port fixture omitted `side: "out"` and initially failed. | Corrected in that unit; old fixtures/assertions remain unchanged. |
| WD04 | Snapshot no longer calls `layoutInput`; it clones live layout. | Current code carries lanes at the real call, dot in both node builders; snapshot cases pass. |
| WD04 | Initial focused formatting report. | Resolved there; renderer and original cases independently checked. |
| WD05 | Predicate wrapping, Git 7→8-digit headers and inherited owner CRLF. | Own formatting only; process-local `core.abbrev=7`; root/owner bytes and original baselines preserved. |
| WD05 | Colour slots live in browser preferences, differing from the earlier preview promise. | Explicit plan decision; preference code is isolated from design/history/blueprint/chat, but assignment has no studio caller. |
| WD06 | Unchanged Detailed shared-approach chooser fails under lanes. | Finding 1; owner follow-up, old test preserved. |
| WD06 | Wire mouse-selection failures, including YouTube Simple/light. | Two causes reproduced and fixed at generic Board level; that study wire attempt remains unverified. |
| WD06 | Old inline selected BaseEdge stroke assertion fails. | Independent owner follow-up; actual coloured outline is separate from transparent hit path. |
| WD06 | PNG centre-ink sampling failed despite visible stopped PNGs. | Owner follow-up. A wider colour stroke missing the fixed 5×5 ink sample remains an inference. Current legacy exports pass, not a wire-export repair. |
| WD06 | Own colour/reload test used Simple IDs in Detailed, corrected but not rerun. | Still unverified within the stopped attempt; no accepted reload/slot-life UI claim. |
| WD06 | TinyURL four-case wire evidence passed; YouTube wire review stopped early. | Historical partial evidence preserved. Independent current 12-case review below is explicitly legacy. |
| WD06 | Temporary harness CJS/`__name` failures. | Tooling-only failures retained in patch; no product change or successful matrix inferred. |
| WD06 | All activation source restored; restored checks passed. | Confirmed by source diff plus this unit's full checks; source remains restored. |
| WD07 | Expected 12 wires, actual 0; hover/opacity/after-blueprint steps not reached. | Reconfirmed zero wires independently. No wire-hover blueprint pass is claimed. |
| WD07 | Class names matched; only new assertion formatting needed correction. | Source and actual DOM agree; changing CSS cannot supply missing wires. |
| All | Existing eight lint warnings/twelve infos and Vite chunk warning. | Retained, not silently cleaned up. No new dependency. |

## Independent live browser matrix

Native Chromium on isolated 4301/4311, own `jeeves_e2e` projects. Every view/theme switch, Fit,
tile selection and relationship selection used the mouse. Each row also downloaded/decoded a
real PNG with the unchanged route-ink helper and compared design plus blueprint with its initial
state. Both themes produce byte-identical PNGs for each study/view. All 12 screenshots and six
unique exported PNGs were visually inspected: studies render, arrows/routes are visible, exports
have light paper/tile colours. Detailed module dots are the existing legacy marks.

| Study / view | Light legacy edges / wires | Dark legacy edges / wires | Mouse / PNG / unchanged state | Screenshots |
| --- | --- | --- | --- | --- |
| TinyURL Simple | 12 / 0 | 12 / 0 | Pass both themes | [light](evidence/wd08/tinyurl-simple-light.png), [dark](evidence/wd08/tinyurl-simple-dark.png) |
| TinyURL Detailed | 12 / 0 | 12 / 0 | Pass both themes | [light](evidence/wd08/tinyurl-detailed-light.png), [dark](evidence/wd08/tinyurl-detailed-dark.png) |
| Marketplace Simple | 24 / 0 | 24 / 0 | Pass both themes | [light](evidence/wd08/marketplace-simple-light.png), [dark](evidence/wd08/marketplace-simple-dark.png) |
| Marketplace Detailed | 26 / 0 | 26 / 0 | Pass both themes | [light](evidence/wd08/marketplace-detailed-light.png), [dark](evidence/wd08/marketplace-detailed-dark.png) |
| YouTube Simple | 25 / 0 | 25 / 0 | Pass both themes | [light](evidence/wd08/youtube-simple-light.png), [dark](evidence/wd08/youtube-simple-dark.png) |
| YouTube Detailed | 26 / 0 | 26 / 0 | Pass both themes | [light](evidence/wd08/youtube-detailed-light.png), [dark](evidence/wd08/youtube-detailed-dark.png) |

[Machine matrix, including PNG hashes](evidence/wd08/browser-matrix.json),
[browser log](evidence/wd08/browser-review.log). PNGs are named `<study>-<view>-export.png` in
that directory. The native optional-Board fixture is separate from these 12 studio cases.

## Decisions table, row by row

“Unavailable” below applies to **each of the 12 live cases above**, because no wire renderer is
activated. It does not imply the optional code is absent or its component tests failed.

| Decision | Actual browser observation / mismatch | Separate optional-code evidence and limit |
| --- | --- | --- |
| A · Individual entering heads, 22/16px lanes, 0.75 gather | Unavailable; legacy approaches can share a run/head position. | Lane/gather tests pass; finding 3 identifies a Detailed trunk failure. |
| B, K · 7×6.8 soft outlined triangle | Unavailable; legacy open arrows render. | `wireArt` constants/tests agree; nominal outline-tip gap is finding 4. |
| C · Sending tile colour | Unavailable; common legacy line colour, selection blue. | Pure hue/tone functions and caller-supplied `LineSpec.wire` exist. |
| D · 3.5 colour over 6.4 ink, crosses without bridge, joins at dots | Unavailable; thin legacy artwork and crossing gaps remain. | Optional renderer widths/ink/no-bridge branch match; no studio crossing acceptance. |
| E · 11px side-by-side gap | Unavailable; legacy shared stems. | Simple raw routes have zero <8px parallel overlaps. Detailed YouTube and intentional close fans are findings 3/4. |
| G · A shade per line | Unavailable; no source palette in any live case. | Shade callback ranks by source route y, ties by input order; unit cases cover ranks. |
| H · Module dot, 10px frame fan | Legacy Detailed dots exist, but coloured frame fan is unavailable. | Optional geometry/tests match; module colour integration is restored with WD06. |
| I · Async round `0.01 12` beads | Unavailable; long dashed legacy async lines and legend remain. | Optional widths, caps and dash array match in code/tests. |
| L · Alternating light/deep source shade order | Unavailable in all live cases. | Pure permutation tests for 1–14 lines pass; no active studio assignment. |
| M · Return loops enter on left, same routing rules plus lanes | Legacy loops still enter left in live YouTube. Wire lanes unavailable. | Optional return tests pass; actual Detailed fallback overlap remains. |
| N · Twelve OKLCH hues, offset rounds, stable slots, slate actor/actions | Unavailable; no coloured source slots drawn. | Formula/tests match first/later rounds and lowest-free allocation; no unlimited perceptual-distinction claim. |
| Shade · Theme lightness/chroma/drift/gamut and midtone dot | Unavailable; legacy theme palette observed. | Pure tone tests and source agree. Dot midtone intentionally differs from individual shade RGB values; source hue is the intended association. |
| Where kept · Browser-local preferences, fallback assignment in node order | No active slot assignment to observe. | `Preferences.wires` default/validation exist outside design. No reload lifetime UI acceptance. |
| Selected · Preserve fill, blue outline, selected outline +2px | Unavailable; live legacy lines turn blue throughout. | Optional renderer tests pass; native fan identity fix passes. Old inline hit-path assertion remains incompatible. |
| How lanes are made · Two-pass ELK, unique ports, merge off, same defaults | New layout unavailable in studio. | Actual engine/input inspection and six measurements below; default isolation tests pass. |
| Board stays generic · Optional props, unchanged default rendering | Live default rendering works in all cases. | Original board cases/fixtures/assertions preserved; no Jeeves import. |
| Both views · Wires in Simple and Detailed | Mismatch: both views currently use legacy lines in all studies/themes. | WD06 activation stopped and not reapplied. |
| Export · Light wire colours regardless of theme | Legacy light PNGs pass all six theme pairs. Wire colours unavailable. | Historical stopped TinyURL PNG evidence stays partial; no new wire export claim. |
| R5 / WD07 · Hover picks out one wire | Unavailable in all live cases; no wire/hover CSS. | Stopped class names matched. Hover opacity and wire-hover blueprint acceptance remain unperformed. |

## Geometry, colour, export and performance limits

The following are **optional engine/native SVG probes**, not the live studio matrix. Inputs use
`studioArchitectureExample("studio-<study>")`, `laneGraph`, then `laneLayoutInput` or the actual
`detailedView` projection, with only `lanes: true` added. Each fresh engine uses bundled ELK and
zero debounce. Elapsed layout time includes both passes. Native SVG probes use `wireArt` from
those routes and the actual named/default port centres. No stopped activation was needed.

| Study / view | Optional layout ms | Width before → lanes | Crossings before → lanes | Parallel shared runs <8px | Samples / median sampling + nearest ms |
| --- | --- | --- | --- | --- | --- |
| TinyURL Simple | 102.79 | 1024→1136 | 0→0 | 0 | 1,422 / 33.9 |
| TinyURL Detailed | 74.08 | 1280→1392 | 1→1 | 0 | 1,622 / 33.9 |
| Marketplace Simple | 93.14 | 1280→1376 | 1→1 | 0 | 3,907 / 81.5 |
| Marketplace Detailed | 94.50 | 1568→1664 | 5→4 | 0 | 4,692 / 89.4 |
| YouTube Simple | 144.04 | 1504→1627 | 1→2 | 0 | 4,763 / 129.4 |
| YouTube Detailed | 421.68 | 1920→2043 | 4→3 | 1 | 6,510 / 156.9 |

Both YouTube requests stay below 3 seconds on this machine. That is neither a rendering-time
nor click-time bound. Native 2px body samples found no path inside any tile in these six layouts;
this is sampled centreline evidence, not an exhaustive stroke-boundary proof. All six contain
close fan pairs outside their shared dot, and all measured heads have the nominal 1.05px gap.
No active coloured dot can be checked against studio wires. Colour formulas/ranks/slot storage
were inspected and their pure tests run; no new theme/slot/export integration was invented.
Full measurements, input/layout/art and seven-trial click-sampling timings are retained in
[geometry-review.json](evidence/wd08/geometry-review.json) and
[optional-layouts.json](evidence/wd08/optional-layouts.json).

## Constraint proof, checks and preservation

All eight pre-WD board test files were compared against accepted RG26: six whole files are
byte-identical; the two extended files preserve every original body/assertion/fixture, with only
new imports/new cases. WD08 adds a separate regression file and changes no old test. All 89 board
tests pass. [Constraint receipt](evidence/wd08/constraint-review.json). The board imports no Jeeves
code. WD introduces no design schema, blueprint, chat tool, generation, settings allowlist,
template-support or dependency changes. The live before/after design and blueprint checks
cover legacy selection/Fit/view/theme/export; they do not certify unavailable wire hover.

| Required check | Final result |
| --- | --- |
| `pnpm check` | Pass: lint/types, 149 files / 1,391 tests, 177.21s |
| Native `pnpm test:e2e` | 87/87 pass, 6.2m, including TinyURL and both mouse rebuilds |
| `pnpm --filter @jeeves/web build` | Pass; inherited chunk warning |
| Independent browser review | 3/3 probe tests; 12/12 legacy live cases, native optional Board identity and native geometry probes |

[Check log](evidence/wd08/check-final.log), [E2E log](evidence/wd08/e2e.log),
[build log](evidence/wd08/build.log), [preservation receipt](evidence/wd08/preservation.json).
All 7,268 protected starting byte/mode/absence states and own starting modes match. The exact
42 original container ID/name/state triples, 9 networks, 23 volumes, 43 images and both old E2E
project rows are preserved. Own projects remaining: zero. E2E servers exited, owner 4300/4310
listener PIDs are unchanged. The original read-only RG21 audit passes with process-local
`core.abbrev=7`; root/owner changes, accepted SQL/dependencies, frozen v1 and historical evidence
remain untouched. No baseline/config edit, branch/worktree/stash/delegation, unrelated cleanup,
live/paid call, push or deployment occurred.

The initial complete `pnpm check` passed 149 files/1391 tests; it is repeated after the explicit
finite-length guard and new evidence formatting, so the final gate covers the final source.
No successful native browser review or production build is repeated without a new reason.

Review harness failures were retained: initial temporary config was treated as CJS; the next
run used a wrong tile label and a default-only Vite ReactDOM import. Correcting only the harness
resolved these. A direct Node geometry script could not import an SVG; running the same probe
through the repository's Vitest loader resolved that tool issue. The timed-out own project was
removed by exact ID before the successful run. An initial preservation comparator included the
new describe's separator blank line; comparing the exact old test-body boundary resolved it.
No product defect was hidden by these tooling corrections. Scripts are retained as `.txt`
evidence; no new test harness dependency or permanent browser fixture is installed.

Raw console evidence retains terminal whitespace and blank EOF lines. The broad own-path Git
whitespace check flags only those logs; the scoped source/docs/JSON/script check passes. Raw
results remain intact; this required no product change or test rerun.
