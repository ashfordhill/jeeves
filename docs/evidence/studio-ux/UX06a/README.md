# UX06a — Shared autosave and conflict handling

Complete on primary `main`, following `cf7e70ca14feb4a4b338856eaf37512db317e04f`.
The rollout remains `?studio=next`. Only exact `studio-service@1.0.0` objects gain this unit's
representative form: Name, Purpose, Execution, Language, conditional Host and Exposure. Other
objects retain their UX05 summaries; the remaining forms and chronological architecture-layout
history belong to UX07 and UX06b respectively. Runtime/template availability is unchanged.

`draw/form-drafts.ts` owns project + semantic target + exact definition/version drafts, complete
validation, baselines and changed paths. Text debounces for 500ms; blur flushes sooner; selects
coalesce dependent changes after the event. Valid input enters the existing `draw/store.ts` chain,
which rebuilds each operation batch on its latest accepted project revision. There is no second
request queue. Selection/scope/project navigation and unmount flush valid input without cancelling
started requests. Invalid unsent input is discarded on leave; failed intents retain Retry/Discard.
Undo/redo, deletion and chat send flush first; Generate navigation waits for the queue. The chat
boundary was inspected in source without sending a message or invoking a provider.

A changed field's expected value is compared before replay. Unrelated accepted changes survive.
A real server conflict adopts the fresh design and shows “Changed elsewhere; reopen to edit” with
no automatic overwrite/retry. A late old acknowledgement cannot replace a newer accepted revision,
restore a selection, or show another project's errors. Follow-up local edits retain their own
intent; reverting during a flight still saves, and a newer peer change cannot silently become
that follow-up's expected baseline. Pending feedback appears only after a save remains pending
for 800ms; success removes it without a toast or persistent Saved badge.

[Browser observations](browser-observations.json) record 22 direct Chromium scenarios, 26 browser
operation requests and real server acknowledgements. This was one-off interaction inspection,
not a maintained unit/E2E suite. A request guard was installed before page creation; writes were
allowed only to the two exact owned disposable project IDs and operation/undo/redo/layout routes.
Fault injection aborted four real requests; delay injection held actual server responses. No
synthetic successful save response was used. A direct owned-project peer mutation produced the
real 409. Real peer state was also delivered through the existing `adoptChange` seam to inspect
concurrent accepted revisions without calling chat or a provider.

Observed behavior includes:

- 523ms ordinary debounce, 48ms blur save; rapid Name/Purpose/Language edits use successive accepted
  revisions. Managed execution adds Host atomically; returning to Docker removes Host.
- Quick type-and-switch saves to the original service. Invalid leave writes nothing. Invalid
  input on top of an in-flight valid save discards only the unsent part.
- Delayed acknowledgement retains the newest local input; reverting to the original baseline
  still sends its follow-up. Saving appears after 800ms and disappears when acknowledged.
- Network failure remains failed without looping. Explicit retry preserves an unrelated peer
  Purpose change. A changed Name baseline rejects retry before another write. Discard writes nothing.
- A real 409 adopts the peer Name without retry. An old acknowledgement preserves a newer accepted
  revision; a newer peer Name also blocks an unsent local follow-up from overwriting it.
- Real header project switching preserves an original-project in-flight save and failed retry intent,
  while the other project's form and feedback remain clean. Reopening/reloading restores acknowledged
  values. Pending valid input flushes before semantic Undo, and Redo restores it.
- Both 1440×900 and 1280×800 forms fit their inspector without horizontal document overflow;
  Generate navigation acknowledges its pending edit without executing anything.

The [1280×800 form](screenshots/service-form-1280x800.png),
[1440×900 form](screenshots/service-form-1440x900.png),
[pending save](screenshots/pending-1440x900.png),
[retry notice](screenshots/failure-1440x900.png) and
[real conflict](screenshots/conflict-1440x900.png) illustrate the recorded observations.
Existing UX05 camera placement can leave another card partly outside the center after opening
an inspector; final layout/fit remains a later unit. No geometry claim is added here.

[Default-browser observations](default-browser.json) inspect the original editor at both desktop
sizes under a read-only guard. The opt-in workspace remains absent and Runs remains named Runs.
[Original project hashes](project-preservation.json) remain exact for all 13 projects, including
semantic revisions and layouts. The [owned disposable projects](owned-projects.json) were deleted
and verified 404 after every inspection attempt. Final browser console output contains only the
four deliberate aborted requests and the deliberate 409; zero page errors or blocked writes.
The default-editor inspection reports no console warnings/errors.

Required checks use Node 24.21.0 / pnpm 12.16.1 with the Node bin directory prepended to PATH:
`pnpm lint`, full `pnpm typecheck`, and `pnpm --filter @jeeves/web build` pass. Lint retains the
existing 2,797 warnings/88 infos without new diagnostics; build retains the large-chunk advisory.
See [check outcomes](checks/results.json). Source/test types compile without fixture adaptation.
Unit/E2E/template suites, snapshots, their maintenance and `pnpm check` remain explicitly deferred.

Routine verification corrections: the first scoped compile wrapped a Zod symbol-capable issue
path with `String`; an optional-chain warning was removed. Initial browser setup used an outdated
service label, then imported a stale Vite store URL after HMR; assertions now use the actual
versioned store imported by StudioWorkspace. [Earlier attempts](inspection-attempts.json) and
ignored raw logs retain these outcomes. Review then added the two in-flight race protections and
repeated required checks/browser inspection. Generated observation JSON needed Biome formatting;
no lint rule, bound, backend validation or test expectation was relaxed.

A browser unload can attempt a flush only. Browser termination can interrupt an unacknowledged
request; neither unsent drafts nor failed intents are promised durable across a page restart.
There is no unload confirmation dialog. Per-project failed/pending intents survive in-app switching.
No provider/application generation, sibling repository edit, factory/benchmark rewrite, backend
resumption, worktree, branch or worker delegation occurred. UX06b is the next boundary and was not
started here.
