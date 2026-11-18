# Current wire UI — owner-authorized finish, 2026-11-18

Studio **Simple and Detailed now draw the approved coloured, outlined wire bundles**. After
seeing the old UI, the owner asked, “can you have an agent finish it?” This follow-up adapts
obsolete shared-line assertions as necessary implementation work while preserving meaningful
selection, hover and PNG coverage. This is
one follow-up task, not another numbered WD unit. The WD06/07 stop patches and all review text
below remain historical. WD12's backend drill remains stopped and outside this task.

The [new evidence](evidence/wire-ui-finish/README.md) records the actual twelve-case browser
matrix: TinyURL 12/12, Marketplace 24/26 and YouTube 25/26 wires in Simple/Detailed, in light and
dark. Mouse hover, selection, context menus, Fit, browser reload/colour slots and exact saved
**design response (including history) plus blueprint** checks pass. Each actual downloaded PNG
was decoded and checked for every wire's light colour; the two themes produce byte-identical
PNGs for each study/view, even across reload. These results supersede the earlier legacy-zero-wire
matrix for current UI behavior. The six unique exported PNGs were visually inspected.

WD08 findings now have these dispositions:

- **Activation and regressions resolved.** Source colours/shades, dots/fans/gathers, individual
  soft heads, async beads, selection outlines and hover ship. The chooser test clicks near the
  actual common fan dot, asserts all four offered relationships and retains mouse choice,
  scrolling and unchanged camera coverage. Separated Detailed CDN/module returns are each
  clicked and right-clicked. Export checks inspect the offscreen snapshot's actual SVG curves.
- **Actual artwork picking preserved and faster.** Picking still uses the live SVG `d` and
  unsnapped board coordinates, with the same nearest/group/menu rules. Adaptive cubic/quadratic
  subdivision replaces native sampling every 2px; a cache invalidates when `d` changes. The
  native fan probe and repeated/cache-invalidation tests pass. On actual YouTube Detailed:
  730 points, 1.10ms cold flatten-plus-nearest, 0.10ms median repeated (0–0.20ms), versus the
  historical native-sampling median 156.9ms. Native comparison at 4,336 samples finds maximum
  error 0.123px. These are finite observations, not a worst-case latency guarantee.
- **Shared return trunk resolved for actual studies.** Source/target shared-run exemptions now
  apply only to legacy routes. All six actual study/view layouts have zero parallel overlaps
  closer than 8px and zero raw routes through other tiles, including the two Detailed YouTube
  Transcoder writes. Optional Board defaults without lanes/wires/dots retain their legacy paths.
- **Stable wire anchors.** Optional wires use Board-owned placed frame/default/named-port
  coordinates rather than React Flow's asynchronously measured handles. A conflicting-handle
  regression, default-port snapshot and module-row/header snapshot tests cover the correction.
  Earlier PNG mismatches were confined to fans/bead rims while final observed artwork agreed,
  consistent with a transient handle/clone race; no theme palette change was made.
- **Geometry limits retained.** Nominal 11px lanes, 10px fans, 22/16px arrivals, 0.75 gathers and
  head constants stay unchanged. Fans/gathers intentionally converge; their literal 8px clearance
  does not hold throughout the approach. The nominal head-outline/frame gap is about 1.05px.
  The synthetic ten-arrivals/128px capacity probe still collapses under clamping; the actual
  studies need at most three arrivals per port and do not exceed capacity. No new compression
  policy or automatic tile growth ships. The return fallback can still break clearance rules
  on unusual crowded diagrams; this is not generic layout certification.

Only generic Board rendering/layout, studio view code, relevant tests and current guidance
changed. No design schema, blueprint/chat/generation/settings/backend/dependency change or normal
colour metadata in design/history was introduced. Serial gates pass: `pnpm check` 155 files/1,438 tests (118.37s), native E2E 91/91 (5.6m),
web build 879ms. The new evidence records exact protected-byte/mode and resource preservation. Historical WD14 and WD08 reviews follow unchanged.

---

> **Current WD14 status (2026-11-18):** final review complete for coordinator acceptance; execution
> stops here. WD01–05/08–11/13 are accepted; WD06/07/12 remain accepted stop records. Studio
> wires/hover and the exported failure drill are unavailable. [WD14 findings and dispositions](#wd14--final-review-of-wires-and-deployment).

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

# WD14 — final review of wires and deployment

Independent review starts at accepted WD13 `238de0836dd285904b741895c4f1457de06f6928`,
2026-11-18. Approved plan `95d60ac` predates accepted RG23–RG26 carry-in; the actual WD
implementation base is amended RG26 `0ea91d3`. Stopped patches were read without applying them.

## Findings first

1. **Bounded documentation defect reproduced on fresh public CLI exports.** The generated root
   README calls its local Compose/external-URL summary “Each process reads”. On the required
   `wd-front-door` export it lists `app-front: none` and `app-edge-stamp: LOCAL_HTTP_PORT`, although
   the service and stamper read the private stamp key supplied by `env_file`. On `wd-deployment`
   it also omits optional `JEEVES_DB_POOL_MAX`. Both deployment inventories are correct. The
   correction now describes the local summary's actual scope and links the exact installed-runtime
   inventory. Its observable-output regression [failed first](evidence/wd14/readme-fail-first.log.gz)
   and then passed. No second inventory was added.
2. **Unmet Acceptance remains explicit.** WD06/WD07 studio wires/hover remain off. WD12 shipped
   no drill, check scripts or workflow: receipt/progress alone cannot prove a product effect.
   The stopped proof's valid duplicate catalog delivery gives one receipt and zero product rows.
   A mandatory application-owned request/auth/message/effect interface requires owner direction.
3. **Part A follow-ups remain open.** The accepted optional Board hit fix does not resolve all
   stopped studio failures. Detailed shared return, fixed-height arrival collapse, close fans,
   nominal head spacing and input-proportional sampling remain decisions/limits, as detailed above.

## Combined diff and handoff ledger

The actual combined diff from `95d60ac` to WD13 covers **957 paths**: 739 RG-only carry-in,
205 WD-only, and 13 shared. The [complete inventory](evidence/wd14/diff-inventory.tsv) distinguishes
those scopes. Accepted RG23–RG26 integration fixtures/harness, regeneration evidence and handback
are carry-in, rather than WD implementations. Necessary shared sources, emitted consumers,
settings/creation/chat call sites, tests, pins and documentation were reviewed against that diff.
No approved unit brief, decision or previous handoff was changed.

The earlier WD01–WD08 ledger above remains applicable. Its rough edges are not erased by later
units. [Source equality](evidence/wd14/evidence-reuse.json) confirms the Part A implementation,
activation call sites and WD08 evidence have not changed since accepted WD08 `a115abdf`.

| Origin | Rough edge or stopped work | Final disposition |
| --- | --- | --- |
| WD01–05 | Optional lanes/artwork/colours/preferences had no studio consumer; mechanical formatting/comparator corrections. | Optional mechanisms accepted, tooling corrections resolved in their units. Default board behavior preserved; no later activation. |
| WD02–03 | Simple YouTube crossings 1→2; optional return separation only finitely tested. | Recorded limit. WD08's Detailed shared trunk remains open. |
| WD06 | Existing chooser requires an incoming shared approach incompatible with the prescribed separate lanes/heads. | **Stopped/restored**, saved [patch](stopped/WD06.patch). Requires owner choice about the incompatible retained regression/activation boundary. |
| WD06/08 | Wire mouse identity, YouTube selection, inline hit-path selected stroke and PNG ink sampling failures. | WD08 fixed actual SVG-body identity plus pointer snapping for generic Board with two fail-first tests and native mouse proof. The stopped YouTube case, old inline-stroke assertion and wire PNG helper failures were not all resolved. |
| WD06–07 | Partial TinyURL wire captures; incorrect new colour-case IDs corrected but not rerun; zero live wires prevents hover. | Historical partial evidence only. WD07 **stopped/restored** in [patch](stopped/WD07.patch); opacity/after-blueprint steps never reached. No reload slot-life or studio wire-hover acceptance. |
| WD08 | 61px Detailed YouTube shared return; synthetic fixed-height arrivals collapse; close fans and nominal 1.05px head gap. | All remain owner follow-ups. Prescribed geometry/constants are unchanged. No routing/capacity redesign or wire activation. |
| WD08 | Native sampling medians ~129/157ms; 4,763/6,510 sampled points; no worst-case bound. | Measured limitation remains. No optimization or latency guarantee. The 12 actual studio cases were **legacy, zero wires**; default PNG/mouse success is not wire acceptance. |
| WD09 | Inventory could overclaim application settings, SDK conventions or background/state intent. | Explicit installed-runtime scope retained. Conservative `alwaysOn` includes capability-enabled maintenance/durable work; only source-backed positive copies are rebuildable. Search events alone do not prove full reconstruction. |
| WD09 | Resource labels, old counts/pins and startup-reader audit needed adjustment; owner API child reloaded. | Accepted display-metadata changes preserve stable identities/runtime facts. Exact tests/pin review passed. Automatic watcher reload is recorded, not an owner-service control or unchanged-PID claim. |
| WD10 | First exemption admitted internal descendants/methods; normal mouse creation differed from chat. | Corrected with fail-first and mouse/chat proof in WD10. Exact compiled roots preserve guards; saved absence remains none. Identity vendor has no required consumer. |
| WD10 | Native internal 401s were user-first; initial v3 trace/PNG lost. | Reused 27 observations retain their limit: `SIGN_IN_REQUIRED` is not new issuer/workload-token proof. All 51 old non-inventory payloads were byte-identical then. Lost trace/PNG is not reconstructed; full failure log remains. |
| WD11 | New SQL traces/fakes, first refresh deadline failure and sibling-directory collision. | Corrected/preserved evidence; serial native-2 passed. Resource contention is an inference about the first deadline, not a proved cause. Existing budgets/assertions were retained. |
| WD11 | Pooler topology could be bypassed by fault proxies/admin probes. | Native-2 has 10 foundation + 6 catalog + 4 session cases, pinned transaction mode, two copies. **Both COMMIT proxies traverse it**. Setup/admin/permission probes stay direct and do not count as pooler-path runtime evidence. No production pooler supplied. |
| WD12 | Existing design/deployment/API8 seams lack valid ordinary request/auth/message factories and a product-effect observer. | **Stopped/restored**, saved [patch](stopped/WD12.patch). Valid catalog duplicate delivery under an API8-valid no-op records one receipt/progress and zero product rows. Neither product completion nor successful drill follows. |
| WD12 | Worker health routes absent; optional cache legitimately stays ready. | Existing ready marker/process/progress and optional-cache fallback are feasible nearest details, not blockers. Existing hook/stub/operator seams were considered. A new helper/config file alone is not architectural; making a new application-owned test/oracle interface mandatory is the missing owner contract decision. No interface invented. |
| WD13 | File reread versus cached token and issuer coordination; initial assertion/inventory failures. | Six real-file/fake-issuer cases cover rotation/coalescing/failure/expiry/recovery and old startup snapshot. No live issuer. Documentation and exact inventory assertions corrected; WD14 addresses the separate root README's overbroad local-table label. |
| All | Inherited lint/chunk warnings, preservation comparisons and setup-tool failures. | Kept separate from product findings. Required checks and final preservation are linked below; no broad cleanup or baseline edits. |

[Stopped-patch inventory](evidence/wd14/stopped-inventory.json) records all three hashes/sections,
including saved evidence and binary artifacts. They were read as stopped work, never applied.

## WD09–WD13 Acceptance against fresh exports

The public CLI freshly exported the existing `wd-deployment` source (94 files, zero findings,
12 explicit application gaps), with supplemental `wd-front-door("required")` (55 files, zero
findings, two gaps). Both generated deployment JSON and guides were **opened and compared by hand**
with their source designs. [Detailed comparison and artifact links](evidence/wd14/README.md),
[exact before/after payload review](evidence/wd14/export-review.json). These are partial scaffolds,
not completed products. No generated implementation was patched.

| Unit | Independent review and finite proof | Acceptance status / limit |
| --- | --- | --- |
| WD09 | Four processes/four stores, six uses/call arrows, one async consumer edge; sorted IDs/names and matching headings/clicks/source folders. Full JSON equals the pre-existing handwritten expectation. Actual configuration-reader audit and generated-update/tamper tests pass. | Accepted implementation. Environment means possible installed-runtime reads, including optional imported readers; excludes application settings/SDK/setup conventions. Fresh artifact check and public update check pass. |
| WD10 | Required export lists both keys/header/60s window; exact gate/runtime/local edge are unchanged since accepted native27. Missing/stale/future/wrong-method/path/MAC, current/previous, health, direct/edge/none cases are covered there and by current focused tests. Current E2E covers mouse/chat creation/edit; old saved absence retains none. | Accepted finite proof. Missing key fails startup before readiness. Internal 401 observations reach user auth first; no new native valid-user/workload-token or live issuer proof. Old51 byte identity is historical WD10 evidence, not a claim that later intentional pooler/workload updates change no bytes. |
| WD11 | Fresh export has transaction-local timeouts, xact cleanup lock, no forbidden session surface and pool maximum in actual imported SQL readers. Offline races/mechanisms pass; unchanged pooler sources support reuse of native-2's two fixtures/20 cases. | Accepted implementation and finite pooler evidence. Setup/admin probes direct; arbitrary application SQL and managed-provider compatibility need their own review. Optional maximum 1–100 is startup-only, with old defaults when absent. |
| WD12 | Fresh package has no `drill`, `check`, `check:all`, drill script or check workflow. Saved valid-DTO no-effect proof was inspected against the mapper, receipt callback and product table. | **Acceptance unmet/stopped.** Neither required fixture drill, bad-readiness variant nor failure-path cleanup acceptance was run. One receipt/progress cannot substitute for one product effect. Owner must choose the application input/auth/message/effect oracle contract or change Acceptance. |
| WD13 | Fresh contract/guide names the optional file and endpoint-defined issuer; actual workload runtime rereads inside new-token acquisition. Six real-file/fake-issuer cases preserve cache, one refresh per audience, safe file failure/cooldown/expiry/recovery and old per-client startup form. | Accepted finite offline proof. Rotation takes effect at next refresh; valid cached token's existing bounds remain. Issuer-side acceptance/rotation is operator-owned; no live/provider issuer claimed. |

The only WD14 executable-source correction emits documentation. Before/after comparisons show
all **55/24 source payloads** in the two exports byte-identical; only their root README and
report/manifest provenance change. Both actual API8 checkers, TypeScript **7.0.2**, and public
`update:v2 --check` pass offline with existing pinned dependencies and no install. All three
processes-off pins pass unchanged. Current focused review tests pass **70/70**. No native system
matrix rerun is warranted by the documentation-only payload delta; accepted finite scenarios
are reused only with the [recorded source equality](evidence/wd14/evidence-reuse.json).

## Migration and operating guidance

Existing generated applications migrate explicitly to RG **API8**, acknowledging with
`--ack-extension-api=8` only after reviewing/migrating affected application-owned hooks, registered
product SQL and calls. Preserve hooks, product data, stable owner/process/module identities,
private runtime credentials and their original Docker volumes. The updater does not rewrite
product bodies or perform database/issuer migration. Follow the emitted extension packet and
[RG migration evidence](../reliable-generation/owner-handback.md#migration-and-maintenance-cost).

An existing diagram with absent `frontDoor` stays none. Enabling required on an already retained
local runtime requires privately provisioning its stamp key/env file and coordinating the front
door/service keys; rerunning the **single-use** setup or resetting `.runtime` is not a migration.
Production front doors, secret distribution and TLS remain operator-owned. Pool maximum is an
optional external 1–100 startup decision, not a diagram setting. Workload secret-file replacement
is read at next refresh; coordinate issuer-side changes yourself. Cached-token validity is
unchanged, and changing the selected file path/endpoints still requires configuration restart.
No QRWTY redesign, regeneration or deployment, and no new whole-application LOC benchmark was done.

## Final checks and preservation

Required serial gates and mouse/export proof are recorded in [WD14 evidence](evidence/wd14/README.md).
The serial gates pass: `pnpm check` **153 files / 1,431 tests** (114.19s), native E2E **89/89**
(5.1m, TinyURL and both mouse rebuilds), and web build **832ms**. The targeted mouse/export
probe passes **1/1**: TinyURL renders with 12 legacy edges/zero wires; mouse Preview/Download
delivers the corrected root README, its deployment links and exact stamp-key inventory. Both
screenshots were visually inspected. The first probe reached download, then failed because
`unzip` is absent; its log/PNG/trace are retained, and only the temporary harness changed to
Python's standard ZIP reader. No product change or unrelated gate rerun followed.

The [preservation receipt](evidence/wd14/preservation.json) records 7,404 unrelated starting
byte/mode/absence states, all starting modes and the prior handoff prefix; original 42 full
container ID/name/state triples, nine networks, 23 volumes, 43 images and both old E2E rows are
preserved. No task project/container remains; 4301/4311 are free. Read-only RG21 audit passes
with process-local `core.abbrev=7`. Owner web PID stays 1124326; API child 907676→927362 under
the pre-existing watcher is consistent with automatic reload from authorized source edits.
No owner-port request or service control occurred. Root/owner files, stopped patches, old
apps/exports/evidence, accepted SQL/dependencies and frozen v1 are preserved. No push/deployment,
later plan/unit or new benchmark occurred. Inherited lint/chunk warnings remain.

## Owner list

- **Ran:** optional Board wires/colours/preferences and its bounded hit fix; deployment contract,
  front-door stamp, pooler-safe SQL and workload secret-file rotation; WD14 fresh artifact review
  and bounded README scope correction. Regression results are linked above, with finite proof limits.
- **Stopped:** WD06's distinct lanes conflict with a retained shared-run chooser assertion; WD07
  needs that absent activation; WD12 lacks application-valid inputs and a product-effect oracle.
  Their implementations were restored. No studio wires/hover or exported drill/check/workflow shipped.
- **Decision needed:** reconcile wire activation/regressions and outstanding geometry/sampling
  limits; choose WD12's application-owned input/auth/message/effect contract or amend its acceptance.
  No later plan, remedial unit or deferred-reachability work is started by this review.
