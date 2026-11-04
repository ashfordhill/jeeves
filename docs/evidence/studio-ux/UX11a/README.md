# UX11a — Stable movement and asynchronous routing

Complete on primary `main`, from `f06c63f7c7eae298c97dda13aa5cfe0f268acd08`.
Only the opt-in `studio=next` surface changes. UX11b retains landing preview, grid/collision
settling, durable drop, layout history, animation, arrangement and Tidy and fit.

The studio captures routes, labels, node boxes and the active generation on pointer down.
During drag, an incident-path index updates only moving anchors; shared buses/junctions and every
unrelated route retain their captured geometry. Labels are frozen. React Flow receives its measured
dimensions back through `onNodesChange`, preserving handle initialization and mounted edge identities.
This unit's temporary gesture restores its snapshot on release, Escape, pointer cancellation or
window blur; it writes no layout. UX11b will replace release restoration with its settled commit.

Obstacle routing and label reservation now run in a small browser worker. Loaded-font measurements
include combined protocol siblings. Exact scope/topology/sizing/position requests coalesce, successful
results use a bounded 16-entry cache, and subscriber cancellation terminates computation only when
no subscriber needs it. Generation and abort guards reject obsolete responses. Pending/failing work
keeps the last valid paths; fresh relationships have immediate directed fallback routes. Failure
offers mouse-accessible Retry routing without replacing React Flow. No ELK runs during movement.

## Direct browser observations

Used installed Chromium as temporary one-off inspection drivers, not the maintained E2E suite.
The unchanged [UX10 public dense fixture](../UX10/fixture-1440.json) supplies nine cards, 18 source
connections, 15 aggregates and 19 visible paths. Its original layout/factories remain unchanged.

| Evidence | Observed result |
| --- | --- |
| [Dense drag record](browser-observations.json) | At each 1440×900 and 1280×800 size: 36 active drag samples, zero worker requests during movement, four changed incident paths and 15 byte-exact unrelated paths. All unrelated node geometry and every label remain exact. |
| [Continuous 1440 recording](screenshots/continuous-drag-1440x900.webm), [1280 recording](screenshots/continuous-drag-1280x800.webm) | Every sample retains all nine node and 19 edge identities; actual DOM references remain mounted, all paths remain nonempty/full opacity. Recordings continue through cancel, delayed response and failure/retry. No FPS claim. |
| [Async lifecycle](async-lifecycle.json) | Trunk-source movement changes six paths while 13 stay exact; no worker call. Selection/zoom also create zero requests. Delayed real callbacks released after scope return, a new drag or deletion cannot replace newer geometry or resurrect deleted objects. |
| [Worker client](async-lifecycle.json) | Two identical concurrent subscribers create one request; cancelling one preserves the other. A later cache hit creates zero requests. Constructor failure rejects safely. |
| [Failure screenshots](screenshots/failure-1280.png) | Injected worker failure retains five usable directed fallback paths and the same node positions/edge IDs; Retry succeeds. |
| [Default editor](default-browser.json) | Legacy editor stays the default at both sizes, with zero writes, errors or warnings. |

Before/mid/after screenshots at both sizes were visually inspected, as were failure/default states.
The main runs and default inspection make zero browser mutation requests. All guards precede page
creation, reject external requests and protect every existing project. The separate lifecycle
inspection permits only its owned disposable's operation and layout routes: two connection-label
edits, one node deletion and its existing position-pruning save return 200. The cleanup removes
only the deleted position; it is separate from dragging. Provider/generation writes stay blocked.
No API success is fabricated. Held callbacks/failure injection are explicitly browser instrumentation.

[Original project hashes](project-preservation.json) match all 13 projects' UX10 baseline exactly.
Main gesture semantics/layout remain unchanged. [Main](owned-projects.json) and
[lifecycle](async-owned-projects.json) disposables are deleted and verified 404; the final project
set matches the original 13. All final runs have zero blocked/unowned writes, external requests,
page errors or console warnings/errors. No provider, external agent or application generation runs.

## Checks and remaining boundary

Node 24.21.0 / pnpm 12.16.1, Node bin path prepended. [Actual logs](checks/) record:

- `pnpm lint`: exit 0; unchanged 2,797 warnings / 88 infos, no errors.
- Full `pnpm typecheck`: exit 0, including existing source/test types and scripts.
- `pnpm --filter @jeeves/web build`: exit 0; existing large-chunk advisory; routing worker 5,785 bytes.
- Scoped formatting, preservation and staged whitespace including new evidence/logs: pass.

[Bounded attempt notes](inspection-attempts.json) describe the measured-dimension fix, initial
effect diagnostics, pickup-sample assertion and readable fallback adjustment. No dependency,
fixture typing, snapshot or broader test maintenance was needed. `pnpm check`, unit/E2E/template
suites and their maintenance remain explicitly deferred.

[File preservation](preservation.json) checks the earlier handoff prefix, original feedback/copies,
public fixtures, frozen benchmark inputs, old factories and every unrelated tracked file exactly.
No catalog offering, reusable boundary, template/runtime availability or backend capability changes.
Fallback/temporary incident paths prioritize continuity and may cross other geometry while a card
moves; obstacle routing/label settlement on a durable landing belongs to UX11b. No product blocker
remains. UX11a stops here; studio default rollout remains UX15 and backend/P73 work stays paused.
