# FP00 diagram PNG export evidence

FP00 adds **Export diagram → PNG** and a secondary exact-image capture-details download.
It freezes the existing board's resolved layout, HTML tile faces and SVG relationship renderer;
there is no ELK rerun, alternative architecture renderer, generator or field application.
See the [studio guide](../../../../studio.md#diagram-png-export) for usage and limits.

Required checks on Node **24.21.0**, sequential with source frozen during E2E:

- `pnpm check`: lint/all typechecks, **385 tests / 47 files** passed (`check.log.gz`).
- `pnpm test:e2e`: **34 native Chromium tests**, **1.1m**, passed (`e2e.log.gz`).
- `pnpm --filter @jeeves/web build`: passed in **906ms**, existing chunk advisory (`build.log.gz`).
- A production build with PATH restricted to the Node bin directory, without a callable Git,
  passed; emitted renderer identity is explicitly `commit:null, trackedTreeDirtyAtBuild:null`
  (`no-git-build.log.gz`). This exercises the archive/Docker missing-Git path, not a Docker image build.

The five added unit cases cover off-tile route/label bounds, missing/invalid/oversize capture
refusal, sorted source hashing, waiting for layout and detached resolved geometry. Two bounded
E2Es inspect downloaded PNG signatures/dimensions/hashes and actual route pixels, then check
full YouTube export after mouse focus/pan/zoom/dark mode with exact camera/selection/layout and
saved design/history preservation. They also cover owner collapse/expansion during layout,
stale saved revision, missing font, cancelled stalled font readiness and switching projects.
The initial full check hit existing server chat-hook/project-restart timeouts; an unchanged rerun
passed. Both logs are retained. No timeout configuration was weakened.

`manual.mjs.gz`, `manual.log.gz` and [results.json.gz](results.json.gz) record the final actual
mouse walkthrough in the owner app at **1280×800**, Chromium **153.0.8010.12**:

| Actual saved view | Clean PNG | Dimensions | Tiles / relationships |
| --- | --- | --- | --- |
| Owner YouTube, revision 1 | [youtube.png](youtube.png) | 3008×2752 | 21 / 25 |
| Owner TinyURL, revision 53 | [tinyurl.png](tinyurl.png) | 2752×1472 | 12 / 13 |
| Temporary foundation, collapsed | [owner-collapsed.png](owner-collapsed.png) | 1728×1408 | 6 / 7 |
| Same source, expanded roles | [owner-expanded.png](owner-expanded.png) | 1728×1264 | 7 / 7 |

The matching `*-capture.json.gz` files preserve the exact downloaded JSON bytes. Source hashes
were independently recomputed from the saved owner designs and match; PNG hashes match too.
After mouse focus, Fit focus, pan, zoom and dark mode, each owner's PNG hash is identical to its
unfocused light export. The duplicate PNG bytes stay in `/tmp/jeeves-fp00/manual/`; the focused
capture details and results retain their independent capture times and interactive view context.

The four clean PNGs were visually inspected: labels, icons, solid/dashed routes, crossing gaps,
arrowheads, long returning routes and complete bounds are readable. The collapsed owner has
no Expand roles editing button; the expanded image includes both canonical API faces and their
operation labels. A full logical-owner projection is explicit, not a claim to draw hidden role
faces. The underlying YouTube architecture was not redesigned or certified by this export check.

The standard-size `studio-*.png` screenshots retain fitted, focused/panned/zoomed dark, owner
collapsed/expanded and export-dialog UI. The mouse also opened/closed the line guide and used
Fit. `results.json.gz` records the exact interactive view before each export and asserts it is
unchanged afterward. Zero final page/console errors. `owner-before.json.gz` retains the initial
full project/design/history/blueprint responses; exact after-response comparisons and unchanged
listing are asserted in the script. The temporary foundation was deleted 204; the owner listing
returns to TinyURL 53 / YouTube 1 / Marketplace 1. E2E storage returns to its original default-only
listing. No paid/live chat, owner settings changes or owned listeners were required.

Capture provenance is deliberately bounded. These development captures report parent renderer
`4669546` with a dirty tracked tree; [renderer-source-audit.json.gz](renderer-source-audit.json.gz)
records exact renderer file hashes and untracked source files. The final unit commit contains
those files. Git identity is sampled at server startup/build, so HMR captures require an external
source audit. FP01 must take its own original/PostgreSQL/baseline snapshots from the committed
renderer, retaining editable design, blueprint and Git identity. This evidence folder does not
establish the field-project archive or change the saved owner YouTube database.

Failed approaches are retained rather than counted as accepted evidence. The initial
[experiment-missing-routes.png](experiment-missing-routes.png) has tile faces but missing strokes:
html-to-image deep SVG cloning dropped board-scoped CSS variables. Explicit SVG capture extents
and preserving computed board variables repair the final images; route-pixel E2E assertions
protect the observed failure. Dark root family colors initially overrode light capture colors;
stronger scoped rules repair it. The first E2E attempted to diff entire differing PNG Buffers,
spending over a minute synchronously constructing diagnostics; its single worker was killed,
and only its exact named/id E2E project was deleted (`interrupted-test-cleanup.log.gz`). Hash-string
comparison avoids that diagnostic blowup. Cancellation initially unmounted a second React root
during the workspace commit; removal plus queued unmount avoids the warning. The second targeted
run and full suite have no such warning. Two manual script attempts used incorrect existing
button/tile labels (`Light mode`, `Redirect`); corrected to `Dark mode`, `Redirect service` without
product changes. Their timeout logs are retained; the final walkthrough completed.

`html-to-image` is pinned at **1.11.13**, absent from automation-pitch. Its
[primary README](https://github.com/bubkoo/html-to-image/blob/v1.11.13/README.md) documents DOM/font/SVG
capture and scaling; the [release](https://github.com/bubkoo/html-to-image/releases/tag/v1.11.13)
is dated **2025-02-14**, satisfying the two-week rule. This is browser rasterization, not server
resvg rendering of HTML foreignObject. Chromium is checked; cross-browser pixel identity,
vector output and automatic archive services remain outside FP00. The image retains existing
two-line canvas labels, not every inspector detail. Oversize captures refuse instead of clipping.

[raw-evidence.json.gz](raw-evidence.json.gz) records original bytes/SHA256 for retained artifacts;
`.gz` files are lossless originals. Temporary debugging artifacts remain in `/tmp/jeeves-fp00/`.
No prior feedback image, historical handoff entry or `.jeeves-feedback/` was edited.
