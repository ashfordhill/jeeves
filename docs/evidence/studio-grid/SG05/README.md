# SG05 evidence — C1/C2/C3 tabs and whole-system C3

Captured 2026-11-04 on primary `main` (base `ac7ab02`), Node 24.21.0, against the dev servers
already running on 4300/4310 (left running).

## Files

- `probe.mts` / `probe.json`: pure projection of the TinyURL study
  (`apps/server/node_modules/.bin/tsx probe.mts <packages/spec/src/index.ts> probe.json`).
  Keys `studio:context`, `studio:containers`, `studio:components`. C2: 12 nodes, 1 frame
  (Link platform around Shorten API and Redirect service), 11 lines. C3: 21 nodes, 3 frames
  (Analytics worker, Redirect service, Shorten API), 11 components, 1 queue (Click events),
  17 lines; all 15 component links drawn; `viaConsistent: true` (every element link follows its
  `via` connection's direction, e.g. Click events → Click consumer); no unresolved relationships;
  no unscoped queues; old `studio:service:*` / `studio:package:*` keys recognised as legacy.
- `capture.mjs` / `capture-log.json`: browser run at 1440×900 and 1280×800 on disposable TinyURL
  projects, clicking only by mouse.
- `screenshots/`: per size `C1`, `C2`, `C3` (fitted), `C3-redirect-selected` (selection carried
  from C2), `C3-component-selected` (read-only component inspector), `C3-zoomed-redirect`,
  `C2-zoomed-package`; plus `1440x900-owner-legacy-C2/C3` (Streamly owner project, read-only).

## Observations (both sizes)

- Header tabs are exactly C1, C2, C3; no breadcrumb or back control exists.
- Selecting Redirect service at C2 stays selected at C3 (its frame). Selecting the Link cache
  reader component at C3 maps to Redirect service at C2, nothing at C1 (no counterpart), and the
  component again on returning to C3.
- Double-clicking Shorten API at C2 and the Redirect service frame at C3 leaves the scope unchanged.
- A saved preference `scope: "studio:service:redirect"` with cameras keyed by old detail scopes,
  and a URL `studioScope=studio:package:link-platform`, both open C3 with no page errors.
- The Streamly owner project (no components, no packages) opens at C2 and C3; C3 shows its
  applications, resources and 2 queues as plain cards. Every non-GET request was aborted for it;
  none was attempted. All four owner projects' `revision`/`updatedAt` are unchanged.
- `errors: []` (no page errors). Disposable projects created by `capture.mjs` were deleted (204),
  as were two debug projects named `SG05 disposable TinyURL debug` (204) from a scratch script.

## Known limits (for SG06/SG07)

Fitted C3 is wide (five layers; zoom ≈ 0.3 at 1440×900 with chat open), so labels hide until the
user zooms in. Layout is the SG05 minimum (existing layering, applied inside frames first); ELK
compound layout, merged lines and short labels are later units.
