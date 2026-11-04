# UX12 — Unified Generate

Complete on primary `main`, following `718ce51b295111a3a2b7a746eac4da3ea3ee3c59`.
The opt-in `studio=next` destination now has Review, Activity and conditional Outputs.
Default rollout remains UX15. No application runtime, generator family or provider integration
was implemented or executed; P73a/P73b and the backend batch remain paused.

Review captures the existing read-only handoff API after pending valid edits/layout finish.
It separates design findings, unresolved choices, exact implementation availability, explicit C4b
boundaries and recorded verification. Details disclose exact contracts, IDs, notes and source.
Captures survive in-app navigation; revision or semantic/project-name fingerprint changes mark
them stale. Source export is lossless; bounded handoff JSON/Markdown retain their captured revision.
The existing explicit scope/ownership/partial approval workflow and target source comparison remain
available on demand. Approval records architecture agreement, never runtime verification.

Activity composes the existing generation stream and orchestration API, preserving generation,
run, task and attempt identities, settings, cancellation, logs/checks/diffs and restrictions.
Ownership conflicts remain inspectable even when no files were produced. Outputs appears for
recorded application artifacts or a current captured diagram. Portable architecture outputs are
explicitly distinguished from generated application code. Selected-view SVG retains actual world
positions, visible bounded labels and relationship identities; rendered trunks join their actual
branches, without adding junction arrowheads or semantic relationships. Portable SVG uses the
existing static box renderer; full shapes/settings remain in the studio and lossless source.

Generation starts retain the existing request shape. Valid edits flush first; changed review inputs
stop the request. Failed drafts retain Retry/Discard in Generate. Server support guards reject
studio planning/start/resume/replan before jobs, including when an older output directory is set.
Legacy generation eligibility and explicit pause/cancel remain intact. There is no second studio
Generate drawer, provider setup or automatic execution.

## Actual inspection

Temporary one-off Chromium drivers were used, with guards installed before page creation.
Only exact owned disposable routes were allowed to mutate. Successful writes were real API
responses. Interception and synthetic local records below are explicitly simulations, not runtime
acceptance. Both 1440×900 and 1280×800 were inspected by mouse.

- [Main observations](browser-observations.json): 21 records. Empty history, current review,
  lossless source/legacy annotation and handoff exports, C3 queue links, acknowledged pending save,
  revision staleness and a real rename changing the fingerprint without changing revision.
  A supported legacy fixture's exact start payload is captured before the server; the request is
  rejected by inspection. Six simulated generation states include progress, failure, ownership
  block, cancellation, interruption and completion/output. Real historical Generation 44/Run 26
  and recorded output links remain reachable read-only; no historical pass is applied to a new build.
- [Supplementary observations](supplementary-browser.json): 21 records. All eight orchestration
  states use labeled simulated API records. Start/cancel requests are intercepted before execution.
  A real save is held: no review request occurs before acknowledgement. A pending edit flushes
  before Start, changes the revision and prevents the start request. Simulated HTTP 503 preserves
  failed intent and a real Retry saves it. Existing attempt logs/checks/diffs are inspected read-only.
- [Navigation](navigation-browser.json): eight records. C1 person, package-member C3 and a precise
  member of a bundled C2 relationship select their canonical IDs. Ordinary scope navigation clears
  obsolete selection parameters. Semantic/layout hashes remain exact.
- [Handoff](handoff-browser.json): actual selected-diagram SVG at both sizes, real scope/ownership
  and partial approval saves, persisted ownership reload and an existing target's source comparison.
  Downloaded SVG is parsed and checked against the displayed positions and actual branch paths.
  [1440 SVG](selected-diagram-1440.svg) and [1280 SVG](selected-diagram-1280.svg) are public synthetic
  architecture exports. No generation is created by approval.
- [Real server guards](server-guards.json): studio generation/planning/start/resume/replan reject
  with 422 `STUDIO_DESIGN_ONLY`. An exact-owned synthetic planned/paused run and simulated older
  output path exercise the guard; cancellation actually transitions it to cancelled (200).
  Job counts remain zero. Supported legacy generation reaches existing `INVALID_OUTPUT_DIR`
  validation without launching generation.
- [Default editor](default-browser.json): four read-only records retain the old default Design and
  Runs surfaces at both sizes. Studio rollout is unchanged.

Representative review, activity, output, deep-link, scope, default and SVG-preview screenshots
were visually inspected. All final browser runs have zero page errors, external requests or
blocked/unowned writes. Main/supplementary console errors are exactly the seven intentionally
intercepted HTTP 422/409/503 responses, recorded as such; other runs have none.

[Project preservation](project-preservation.json) retains all 13 original semantic/layout hashes
and revisions. Owned-project records document deletion and verified 404s; final preservation also
checks the original set and all attempted owned IDs. [File preservation](preservation.json) covers
prior handoff bytes, source feedback/copies, public fixtures, frozen benchmarks, old factories and
all unrelated tracked files. No sibling repository changed.

## Checks and limits

Node 24.21.0 / pnpm 12.16.1; Node bin path prepended. [Check results](checks/results.json):
`pnpm lint`, full `pnpm typecheck` and `pnpm --filter @jeeves/web build` pass. The original 2,797
lint warnings/88 infos and large-chunk build advisory remain. New evidence/log whitespace and
scoped formatting are checked. [Attempt notes](inspection-attempts.json) record corrected local
compile/driver issues and the fixed full-page deep-link reload. No dependency, fixture typing or
snapshot change was required. `pnpm check`, unit/E2E/template suites and their maintenance remain
explicitly deferred. No new generated application or live-provider success is claimed.

UX12 stops here. UX13 and the example/default-rollout units are separate assignments.
