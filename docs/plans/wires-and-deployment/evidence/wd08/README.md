# WD08 evidence

The [review](../../review.md) gives findings and dispositions. The committed implementation
baseline is accepted RG26 `0ea91d3`; review start is WD07 stop `e1c7f87`.

- `diff-inventory.tsv` classifies all 781 changed paths since owner plan `95d60ac`, separating
  accepted RG23–RG26 work from WD. `constraint-review.json` preserves the original board cases.
- `selection-fail-first.log` records two failures before the Board fix;
  `selection-curves-only-failure.log` retains the intermediate failure that exposed pointer
  snapping. `board-after-fix.log` passes all 89 board tests; final `pnpm check` covers the
  finite-length guard as well. New regressions live in `wireSelection.test.tsx`.
- `browser-matrix.json`, 12 screenshots and six `*-export.png` files review the **legacy** live
  studio in each study/view/theme. Zero wires in every case. PNG hashes match between themes;
  the unchanged PNG route-ink helper, real mouse interactions and before/after design+blueprint
  checks pass. Each screenshot/export was visually inspected.
- `optional-board-native-selection.*` is a separate generic Board fixture: real native SVG
  click/right-click on an upper fan return `upper`, without enabling studio wires.
- `optional-layouts.json` contains the exact six optional inputs, layouts and `wireArt` paths.
  `geometry-review.json` measures them using native SVG; it is not a studio wire screenshot or
  export test. Engine timing and click-sampling timing are separate. The ten-arrival capacity
  probe is synthetic; actual YouTube Detailed shared-return evidence uses the real projection.
- `browser-review.spec.ts.txt`, `browser-review.config.ts.txt` and
  `geometry-measurement.test.ts.txt` retain the successful probe source as evidence. To reproduce
  locally, recreate the browser files under `/tmp/jeeves-wd08-browser` with a `type: module`
  package marker; run Playwright from the repository. Run the geometry probe as a temporary
  `.test.ts` in the web canvas with the existing Vitest config before its native browser probe.
  Its outputs go to `/tmp/jeeves-wd08-browser/geometry.json`; remove only that own temporary
  source afterward. Browser config uses isolated 4301/4311 and scripted `jeeves_e2e` settings.
  The recorded `beforeAll` exact-ID deletion cleaned only this review's timed-out project.
- Initial/intermediate failures are retained alongside successful results; no stopped WD06/07
  patch or old assertion was changed. Historical evidence remains at its original location.
