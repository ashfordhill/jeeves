# SG07 evidence: merged lines and short labels

Captured 2026-11-04 on primary `main` (base `1fe97e3`) with Node 24.21.0 and Playwright 1.63.0
(Chromium), against a temporary Vite on 4302 from this checkout proxying the running 4310 API
(the 4300 instance serves stale `packages/spec` modules; see the SG06 handoff). The 4302 Vite was
stopped afterwards.

## Files

- `probe.mts` / `probe.json`: pure projection of the TinyURL study through `studioPaths` and
  `studioPathLabels`. It lists every drawn line, its member count, the derived short label and the
  full text (`apps/server/node_modules/.bin/tsx probe.mts <spec index.ts> <studio routing.ts> probe.json`).
- `capture.mjs` / `capture-log.json`: the browser run at 1440×900 and 1280×800. Each size creates
  one disposable TinyURL project and deletes it at the end (HTTP 204). The Streamly owner project
  is opened read-only with every non-GET request aborted (none attempted). All four owner projects
  keep the same `revision` and `updatedAt`. No page errors.
- `compare.mjs` builds `screenshots/compare-*.png` (left SG06, right SG07) for TinyURL C2/C3 at
  both sizes and Streamly C2/C3.
- `screenshots/`:
  - `<size>-C1/C2/C3-fit.png`: each view with the chat collapsed, after **Fit**.
  - `<size>-C3-fit-closeup.png`: a 520×320 crop of the fitted C3 at screen scale (line
    thickness, arrowheads, stacked labels).
  - `<size>-C2-merged-chooser.png`: after clicking the `2 calls · HTTPS` label. The line is
    selected (3px), and the inspector shows the member chooser.
  - `<size>-C2-merged-member.png`: after picking the first member (its connection form).
  - `<size>-C3-zoomed.png`: C3 zoomed in by mouse wheel (zoom 2.0 / 1.82). Strokes are still 2px.
  - `1440x900-streamly-C1/C2/C3-fit.png`: the Streamly owner project.

## Observations

| | 1440×900 SG06 → SG07 | 1280×800 SG06 → SG07 |
| --- | --- | --- |
| C1 fit zoom | 1.00 → 1.00 | 1.00 → 1.00 |
| C2 fit zoom | 0.763 → **0.853** | 0.675 → **0.755** |
| C3 fit zoom | 0.453 → **0.544** | 0.401 → **0.481** |
| Labels at C3 Fit | hidden (threshold 0.55) → 11 shown, about 6.5px on screen | hidden → 11 shown, about 5.8px |
| Labels at C2 Fit | 11 shown, about 9px → 11 shown, about 10px | 11 shown → 11 shown, about 9px |

- **One line per ordered box pair.** TinyURL has 3 lines at C1, 11 at C2 and 17 at C3. The one
  merged line is C2 Shorten API → URL reputation API. It carries the connection and the C1
  context relationship bound to the same container, and its label is `2 calls · HTTPS`, drawn bold
  with a dotted underline. Clicking the label selects the line (3px). The inspector then lists both
  members in the "Select a connection" chooser, and picking one opens its form.
  Streamly C2 has three merged lines: `2 calls · HTTPS/JSON`, `2 calls · HTTPS/JWKS` and
  `2 calls` (mixed protocols). Shared trunks and branch paths are no longer drawn.
- **Strokes.** Every line has `vector-effect: non-scaling-stroke`. The computed width is 2px
  (3px selected) at Fit, at zoom 0.48 and at zoom 2.0. Arrowheads are drawn in screen space, about
  11×10px, and are shortened only where the final straight run is shorter than the head.
- **Labels.** Every short label is at most 23 characters (`probe.json`). In-process component
  links inside a frame (6 at C3) have no label and no reserved ELK label space; the full text is in
  the hover tooltip. Long labels stack the verb above the line and the protocol below. No label
  overlaps a box or another label at any captured view, including both Streamly views. An earlier
  SG07 pass without stacked labels had 4 label-on-label overlaps at Streamly C3.
- **Streamly (owner, read-only).** C2 fit 0.572 → 0.624, C3 0.620 → 0.608. The stacked labels
  are taller, and Streamly C3 is height-bound.
- C3 at 1440×900 reaches 0.544, just short of the 0.55 target. The label threshold is now 0.45, so
  labels show at both desktop fits, but at Fit they are 6–7px on screen, small enough that you need
  to zoom in to read them. The handoff has the remaining options.

## Checks

- `pnpm lint`: exit 0 (2,797 warnings and 88 infos, unchanged).
- `pnpm typecheck`: exit 0.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory).
- Unit and E2E suites and `pnpm check` were not run (owner-deferred).
