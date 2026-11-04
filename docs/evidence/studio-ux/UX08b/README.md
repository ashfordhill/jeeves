# UX08b — Connector, dependency shortcuts and membership actions

Complete on primary `main`, following `1da4753e72a8ff0b7aa3febe27610b8234105a58`.
The new studio remains opt-in through `studio=next`. Runtime availability is unchanged.

The Connection tool accepts source/target clicks, explains incompatible endpoints without persisting
an edge, and opens a compact review of Action, Protocol, Interaction and Access. Queue roles are
explicit: application → queue publishes; queue → application consumes. A visible Reverse direction
action and editable endpoints let a draft be corrected; Select, Cancel and dialog close discard it.
Bare C1 relationships show only Action. Package cards require actual application endpoints.

The existing serialized save queue rebuilds actions against its latest accepted design. The shared
command's optional Redirect lookup creates the relationship and selects its setting in one batch.
A single existing dependency is reused by ID; multiple connections require choosing the actual
connection. Clearing a shortcut preserves its connection; Disconnect removes the relationship,
policy binding and dependent shortcut together. Library can reuse an existing dependency or review
a new C3 integration and its real relationship before committing both together. Ownership stays
on the one shared resource. New reference cards receive initial free grid positions; existing cards
are not repacked.

Package General supplies Add member, Remove member, Ungroup and a separate red Delete members
choice with Delete/Keep confirmation. Dialogs name their actual targets. Ungroup preserves all
applications, resources and relationships. Removing the last necessary member dissolves the package.
Both require explicit replacement owners for affected resources; queues cannot choose No owner.
Delete members similarly preserves resources and other consumers, requiring explicit reassignment.
Optional CDN origin/browser serving references and Redirect shortcuts clear when their target is
explicitly deleted. Every accepted action is one semantic undo step; rejected/cancelled actions
leave no partial model or position.

## Direct browser evidence

Chromium inspected real local APIs at **1440×900** and **1280×800**. Guards were installed before
page creation. Browser mutations were allowed only for exact owned disposable projects and only
operations/layout/undo/redo. External requests were blocked. API setup/deletion also checked exact
ownership. No provider, application generation, external agent or sibling repository was used.

| Artifact | Observed result |
| --- | --- |
| [Main inspection](browser-observations.json) | 28 scenarios, 110 browser mutation responses, including six deliberate real 422 rejections; all pass. |
| [C1/queue/plain-package inspection](supplement-observations.json) | Eight scenarios, 32 real mutation responses; all pass. |
| [Multiple-connection selection](choice-observations.json) | Two scenarios, zero mutations; both desktop sizes pass. |
| [Default editor](default-browser.json) | Legacy workspace remains default at both sizes; zero writes, errors or warnings. |
| [Preservation](preservation.json) and [projects](project-preservation.json) | Earlier handoff bytes, original feedback/fixtures/frozen benchmarks/factories, all original projects and final project set preserved. |
| [Main](owned-projects.json), [supplement](supplement-owned-projects.json), [choice](choice-owned-projects.json) disposables | Deleted and verified 404. |

The main inspection covers HTTP creation/inspection/undo/redo/reload; invalid source/self/action;
blank-canvas and preview cancellation; atomic Redirect database creation and shortcut; shortcut clear
without disconnection; existing-ID reuse; queue publication and consumption; shared outside consumer;
no C2 queue box with exact producer/consumer provenance; explicit disconnection and cleanup; CDN
origin cleanup; C3 integration add/cancel; shared cache reuse; Add/Remove member; package dissolution;
explicit queue reassignment and optional owner clearing; safe Ungroup; separate Delete members;
browser serving cleanup; undo/redo/reload; portable design/layout exchange and viewport reachability.

Negative network cases change only an owned outgoing operation body, then send it to the **real
server**: wrong channel role, duplicate studio connection binding and dangling target. Each returns
422 with unchanged revision/model. The same dialog remains available and later commits a corrected
draft. No successful mutation is mocked. The browser also rejects the wrong queue role before a
request and requires choosing an actual relationship when several share endpoints.

The supplement exercises explicit Publish/Consume resource actions, reverse direction and cancel,
C1 action-only creation/inspection/history/reload/disconnection, rejected package endpoints and plain
Ungroup without owner configuration. The bounded member-choice pass checks the non-Redirect
multiple-connection branch and clears a stale problem when its target changes. No pass reports a
page error, external request or blocked/unowned write. The six deliberate 422s produce only their
expected browser resource-error messages.

[Screenshots](screenshots/) were visually inspected: HTTP draft, queue refusal, owner reassignment,
separate destructive confirmation, final diagrams and unchanged default editor. Controls remain
reachable without document overflow at both sizes. Saved synthetic designs/layouts are in
`saved-1440.json`, `saved-1280.json` and the corresponding supplement/choice files.

## Required checks

Node **24.21.0**, pnpm **12.16.1**, Node bin directory prepended to PATH:

- `pnpm lint`: exit 0; existing 2,797 warnings and 88 infos, no errors.
- Full `pnpm typecheck`: exit 0 across workspaces/scripts and existing source/test types.
- `pnpm --filter @jeeves/web build`: exit 0; existing large-chunk advisory.
- Scoped formatting, preservation and staged whitespace (including new evidence/check logs): pass.

[Check logs](checks/) record actual outcomes. Logs normalize trailing whitespace only. Routine
inspection/format corrections are recorded in [attempt notes](inspection-attempts.json). No fixture
typing changes, dependencies, snapshots or broad test maintenance were needed. The owner continues
to defer unit/E2E/template suites and `pnpm check`.

## Remaining unit boundaries

Edge routing can still cross an unrelated card. The C1 inspection clicks a visible edge segment
with the mouse; it does not force a click through an intervening node. Geometry/trunks are UX09–10;
card movement/Tidy are UX11. The crossing gesture confirms no semantic change while this scaffold
still disables card dragging; it does not claim UX11 movement is implemented. Existing camera
clipping after panel changes and nonpersistent local layout history remain as previously recorded.
No implicit connection or membership follows movement. Browser termination cannot guarantee an
unacknowledged save. No product blocker remains for UX08b; UX09 and all later work are unstarted
by this worker. P73a/P73b and the backend batch remain paused.
