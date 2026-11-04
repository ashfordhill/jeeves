# UX06b — Chronological semantic and architecture-layout history

Complete on primary `main`, following `db5a855ad0c5898a4be40c8993d3559522f0d54a`.
The rollout remains `?studio=next`; default rollout is UX15. Runtime/template availability,
original examples, frozen backend inputs and paused P73a/P73b work are unchanged.

The existing `draw/store.ts` history now includes architecture scope snapshots with before/after
positions and optional camera. Architecture edits and history restoration share the existing
serialized design request chain. A successful architecture PUT adds one step; rejected saves add
none. Undo/Redo retain their marker on failure and move it only after acknowledgement. Valid form
input flushes first, including an in-flight same-field follow-up. Buttons prevent duplicate history
actions and wait for failed forms to be retried/discarded. Camera-only changes, selection and no-op
saves (including reordered JSON keys) create no step.

History is retained per project during in-app switching, including late form/layout acknowledgements.
A new semantic/layout edit clears local redo; the client also suppresses the obsolete server redo
fallback after a layout branch, without creating a semantic revision. Dead scope/card targets are
pruned before restoration. The old layout methods are compatibility aliases to the same history;
no independent architecture undo stack remains. The old menus now say “Undo/Redo last action.”
Per-turn Undo cannot jump over a newer layout action and still uses server history after reload.

The opt-in graph consumes saved positions and camera changes so history restoration is visible.
Ordinary moves preserve subsequent camera changes; a Tidy snapshot restores the camera it changed.
Project-local manual cameras retain precedence on reopening a scope. The full drag, grid preview,
Tidy toolbar and automatic-layout behavior remain UX11 work. This unit deliberately exercises their
existing `setArchitectureView(scope, view, true)` commit seam through the real browser/store/API;
it does **not** claim that those later gestures or toolbar have shipped.

[Browser observations](browser-observations.json) record 21 direct Chromium scenarios and 67 real
browser mutation requests. This is one-off inspection, not a maintained unit/E2E suite. A write
guard was installed before page creation and allowed only exact owned disposable IDs and the
operations/undo/redo/layout routes. Delays held actual server responses; successful responses were
never fabricated. The only console errors are three deliberate aborted requests and one real 409;
there are zero page errors or blocked/unowned writes.

Observed outcomes include:

- Edit → move → edit → Tidy, then four Undo and four Redo actions in exact order. Each action made
  one request; layout changed coordinates/camera without changing semantic revision. Semantic undo
  and redo each made a new revision. The capture includes every value, coordinate and request.
- Mouse pan/zoom and selection made no request and consumed no step. A pending valid edit saved
  before Undo; a delayed acknowledgement blocked Undo until it completed. Failed form/undo/layout
  requests created no phantom step. Retrying the Undo button retained the correct target.
- Camera-only persistence preserved redo. New semantic and layout branches retired their opposite
  redo branch. No-op placement, including a reordered copy of the same saved JSON, made no request.
- In-flight form and layout saves remained bound to their original project during real header-menu
  switching. Returning restored their proper history; the other project remained unchanged.
- A delayed edit, a same-field follow-up and a layout commit persisted as operations → operations →
  layout without deadlock. A two-card group placement was one step and one PUT. Undo waited for a
  held layout response and preserved a camera change in another scope.
- One real owned-project API edit delivered through the existing chat-adoption seam produced one
  history step, with no provider call. Its per-turn Undo respected later layout. A real stale edit
  adopted peer deletion; undo skipped the dead scope without a request and restored no ghost card.
- At 1440×900 and 1280×800, one visible Undo/Redo pair remained usable by mouse with no horizontal
  document overflow. Reload preserved acknowledged coordinates, reset local layout history, and
  retained the existing server semantic-history fallback.

Screenshots show the [ordered actions at 1440×900](screenshots/ordered-actions-1440x900.png),
[failed form feedback](screenshots/failed-edit-1440x900.png), and the final history surface at
[1440×900](screenshots/history-1440x900.png) and [1280×800](screenshots/history-1280x800.png).
Screenshots illustrate the captured observations; they are not the interaction proof by themselves.
[Default-browser observations](default-browser.json) also confirm the default legacy editor
opens read-only at both desktop sizes with no warnings/errors or writes.

[Project preservation](project-preservation.json) records exact design/layout hashes and semantic
revisions for all 13 existing projects. Every owned disposable project, including earlier attempts,
was deleted and verified 404. [Source preservation](preservation.json) verifies earlier handoff
bytes, all 21 original/copy feedback pairs, seven public fixtures, 48 frozen benchmark files and
all unrelated tracked source. [Earlier inspection attempts](inspection-attempts.json) retain bounded
outcomes; raw logs stay in the ignored workspace. The initial Redo enabled-state bug and scoped
TypeScript narrowing error were corrected before final verification. Review also protected
same-field follow-up ordering, cross-scope camera acknowledgements and JSON key-order no-ops.

Required Node 24.21.0 / pnpm 12.16.1 checks pass: `pnpm lint`, full `pnpm typecheck`, and
`pnpm --filter @jeeves/web build`. See [check outcomes](checks/results.json) and their logs. Lint
retains the baseline 2,797 warnings/88 infos with no errors; build retains its large-chunk advisory.
No fixture typing changes were needed. Unit/E2E/template suites, snapshots, their maintenance and
`pnpm check` remain explicitly deferred. The existing focused-view test in `draw/store.test.ts`
still asserts independent architecture history; that assertion is superseded by this contract and
its maintenance is deferred with the suites. Captured command logs only normalize trailing whitespace.

Local architecture history is intentionally not durable across a browser restart. A browser unload
can only attempt an unacknowledged save, as established in UX06a. The server's historical semantic
undo/redo contract is unchanged; there is no new history transport or backend migration. No sibling
repository, live user project, factory, frozen benchmark, provider or generated application changed.
UX06b stops here; remaining forms and creation/geometry work are subsequent assignments.
