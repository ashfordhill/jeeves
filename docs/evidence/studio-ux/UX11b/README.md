# UX11b — Grid landing, durable drop and Tidy and fit

Complete on primary `main`, following `8b393338a1a8c2875186f6e0b0f24179a8588689`.
Only the opt-in `studio=next` surface changes. Default rollout remains UX15; Generate, chat,
examples, runtime/template availability and the paused backend work are unchanged.

The whole card picks up after five screen pixels. A thin outline previews the nearest free
24-world-unit landing with 16-unit obstacle clearance. Distance ties use the canonical first
selected ID and coordinate order. Multi-selection is available by mouse in every scope; groups
translate rigidly, preserving older off-grid relative offsets. The search extends beyond the
viewport. Movement never inserts a connection or changes package membership.

Drop holds the preview placement through the acknowledged layout PUT and records one chronological
history step. Unaffected cards keep their exact coordinates. Incident routing settles once, with
shared buses/branches settled together and other paths/labels reserved at their captured geometry.
The reservation is bound to its exact position/topology basis; Undo or a later layout cannot reuse
obsolete anchors. Existing UX11a cancellation, mounted identities, fallback paths and generation
checks remain. Final modest changes interpolate for 180ms without opacity fades; reduced motion
and large changes snap. Identical acknowledged geometry does not restart an animation.

Fresh scopes use stable strongly connected components and dependency layers, sorted by ID, with
48-unit minimum node/layer gaps and space for bounded relationship text. Cycles retain their
relationships and outside routing. Positions use the 24-unit grid. Creation preserves the currently
arranged positions of existing cards. Automatic placement itself performs no semantic/layout write.

One **Tidy and fit** clears only the current scope's manual positions, routes its fresh arrangement,
and fits nodes, bends and labels with 48 screen pixels of padding and maximum zoom 1.0. Positions
and camera are one acknowledged layout/history step. Undo captures the actual pre-Tidy camera even
when that scope had no persisted viewport. Pan/wheel remain available and save only the camera,
without history. No Fit/Focus/Arrange menu was added.

## Direct browser evidence

Installed Chromium was driven by temporary one-off inspection scripts, not a maintained test suite.
All request guards were installed before page creation. Only each driver's exact owned disposable
layout PUT route was permitted; all other writes and external requests were blocked.

- [Combined observations](browser-observations.json): 24 records at 1440×900 and 1280×800, with
  continuous [1440 recording](screenshots/continuous-layout-1440x900.webm) and
  [1280 recording](screenshots/continuous-layout-1280x800.webm). Single/group empty and occupied
  landing, single/group cancel, one-step history, acknowledged reload, C2/package-C3 Tidy and C3
  mouse group movement all pass. Every layout action retains the exact semantic hash/revision.
  Each successful drop sends one layout PUT and one settlement request; pointer movement sends
  zero worker requests. Every sampled edge remains nonempty/full opacity, identities stay mounted,
  unrelated nodes/paths stay captured and labels remain frozen while moving.
- [Landing observations](landing-observations.json): actual drops retain rigid group offsets and
  at least 16 world units of clearance from every unaffected card.
- [Async and motion observations](async-and-motion.json): an old real worker callback released
  after a newer durable drop cannot replace it; failed settlement retains saved positions and all
  19 path IDs; Tidy retries successfully. Leaving a scope during a held Tidy prevents its late
  result from writing. Isolated fresh scopes arrange deterministically/read-only. Reduced motion
  has one final position; normal motion has intermediate positions. The same production arrangement
  and landing functions also pass a small one-off input-order, cycle/layer and brute-force nearest
  grid inspection. Actual DOM fit padding is at least 48px (rounding tolerance 0.5px) at both sizes.
- [Camera observations](camera-observations.json): real mouse wheel and Hand pan persist through
  reload, keep the same node positions and semantic hash/revision, request no routing work and
  leave the history length unchanged.
- [Default editor](default-browser.json): the legacy editor remains default at both desktop sizes,
  with no studio graph, writes, warnings or errors.

Representative previews, Tidy, C3, failure and default screenshots were visually inspected.
Screenshots accompany real gesture/request observations; their existence is not the acceptance test.
Final main/supplement/default runs have no page errors, console warnings/errors, external requests
or blocked/unowned writes. Main and supplementary runs perform only real 200 layout saves; no
success response is fabricated. Held/failing callbacks are explicit browser instrumentation.

[Original project preservation](project-preservation.json) matches all 13 original semantic/layout
hashes and revisions. [Main](owned-projects.json), [supplementary](extra-owned-projects.json) and
[camera](camera-owned-project.json)
owned projects are deleted and verified 404; the final project set is exact, including cleanup of
earlier attempts. [File preservation](preservation.json) covers all unrelated tracked files, earlier
handoff bytes, original feedback/copies, seven public fixtures, 48 frozen benchmark inputs and old
factories. No provider, external agent or application generation runs; no sibling repo changes.

## Checks and limits

Node 24.21.0 / pnpm 12.16.1, Node bin path prepended. [Actual check logs](checks/results.json):
lint, full workspace/script typecheck and web production build pass. Existing lint warnings/infos
and the large-chunk build advisory remain. Scoped formatting and staged whitespace checks include
new logs. No dependency, fixture typing adaptation or snapshot maintenance was needed.
`pnpm check`, unit/E2E/template suites and their maintenance remain explicitly deferred.

[Bounded inspection notes](inspection-attempts.json) record corrected local compile/lint diagnostics
and driver-only assumptions. Existing overlapping legacy positions remain preserved on load;
a selected group's internal offsets are preserved rather than repacked. Temporary incident paths
prioritize visibility and can cross other geometry while moving. No product blocker remains.
UX11b stops here; UX12 is a separate assignment.
