# SG06 evidence: automatic ELK grid layout

Captured 2026-11-04 on primary `main` (base `0e175ca`) with Node 24.21.0 and Playwright 1.63.0 (Chromium).

## Files

- `capture.mjs` and `capture-log.json` record the browser run at 1440×900 and 1280×800. Each run
  creates one disposable TinyURL project per size and deletes it afterwards (HTTP 204). The Streamly
  owner project is opened read-only, with every non-GET request aborted; none was attempted. All four
  owner projects keep the same `revision` and `updatedAt`. No page errors were logged.
- `compare.mjs` builds the side-by-side sheets `screenshots/compare-*.png`. Each sheet puts the
  earlier unit's screenshot on the left and SG06 on the right: SG01 Streamly C2, SG05 TinyURL C2
  and SG05 TinyURL C3. SG01 has no TinyURL baseline because that study was added in SG04.
- `screenshots/`:
  - `<size>-C1/C2/C3-chat-open.png`: each view as opened.
  - `<size>-C1/C2/C3-fit.png`: each view with the chat collapsed, after **Fit**.
  - `<size>-C2-reorder-dragging.png`, `-reordered.png`, `-reorder-undone.png` and
    `-reordered-reloaded.png`: the row-reorder sequence.
  - `1440x900-C2-tool-added.png`: a Database added with the tool. Layout placed it as a separate
    island below the diagram.
  - `1440x900-streamly-C1/C2/C3-fit.png`: the Streamly owner project.

The Vite dev server already running on 4300 kept serving pre-change `packages/spec` modules during
this session. Its watcher stopped picking up spec edits after a brief `git stash` round-trip, and
project creation failed against the new `study.ts` signature. Restarting that server was not
permitted, so the capture used a separate Vite on 4302, built from the same checkout and proxying
the running 4310 API. That instance was stopped afterwards. The 4300 server needs a restart before
it serves this commit's spec code.

## Observations

| | 1440×900 | 1280×800 |
| --- | --- | --- |
| C1 fit zoom (chat collapsed) | 1.00 | 1.00 |
| C2 fit zoom (chat collapsed) | **0.763** | 0.675 |
| C3 fit zoom (chat collapsed) | **0.453** | 0.401 |
| Opened zoom with chat open (C1 / C2 / C3) | 1 / 0.596 / 0.354 | 0.934 / 0.508 / 0.302 |
| Layout writes while opening, selecting and switching tabs | none | none |
| Layout writes from Fit | none | none |

- C2 meets the target of at least 0.75 at 1440×900. C3 does not reach 0.55. TinyURL C3 is a
  nine-column chain: CDN → responder → publisher → Click events → consumer → aggregation → writer →
  Analytics store, with every in-frame link labelled. Labels sit in their own ELK label layer. See
  the handoff for what SG07 should change.
- **Row reorder by mouse.** Dragging Links database above Link cache inside their column sends one
  `PUT …/layout`. The saved record is `order` (Links database first) and `positions: {}`. Undo
  restores the old rows and Redo reapplies them, each with one PUT. The new order is still there
  after a reload.
- **Determinism.** A second browser context renders identical node transforms.
- **Creation.** A Database added with the toolbar tool sends only `POST …/operations` and no layout
  write. Layout places the new box as a separate island.
- **Streamly (owner, read-only).** Fit zoom is C2 0.572 and C3 0.620. Both views lay out on the
  grid with no detour lanes. Dense parallel lines remain, which SG07 merges.
- Old layout documents still load. Their `positions` and server `viewport` are ignored, not rewritten.

## Checks

- `pnpm lint`: exit 0, 2,797 warnings and 88 infos (unchanged).
- `pnpm typecheck`: exit 0.
- `pnpm --filter @jeeves/web build`: exit 0 (existing chunk-size advisory). The output contains
  `layout.worker-*.js` and `elk-worker.min-*.js`.
- Unit and E2E suites and `pnpm check` were not run (owner-deferred).
