# UX10 — Compact edge routing and shared trunks

Complete on primary `main`, following `8655f7048d5280ff5350c26ae9f571a155833387`.
The studio remains opt-in with `studio=next`; runtime/template availability is unchanged.

The new surface consumes UX04b's actual protocol/interaction-specific trunk membership and UX09's
fixed role boxes. Derived Manhattan paths route around padded cards; stable outside lanes retain
feedback, reverse and cycle arrows. Compatible fan-out shares a source stem/bus with explicit
junction dots. Background gaps mark ordinary crossings. Each branch retains its arrowhead,
12px transparent hit region, original aggregate identity and complete member provenance. Mixed
protocols use separate branches; repeated DB connections retain one application/group aggregate.
No semantic connections are created, merged or deleted by routing.

Trunks open the existing short member chooser. Choosing a member highlights only its associated
paths and edits that exact relationship. Its choice survives inspector close/reopen and protocol
regrouping that changes presentation path IDs. Branches with one eligible connection open its form;
multi-member branches choose one connection first. Shared trunks have no bulk settings. Source-only
legacy edges highlight without an empty inspector. Queued C2 summaries retain the shared queue ID
and both actual connection legs; C3 continues to use the one resource identity.

Labels use one inline text line with a small halo and no rectangular label plate. The loaded font's
canvas measurement reserves the actual bounded high-detail text and medium-density variant, plus
6px padding, in an 18-world-unit-high region. Placement considers cards, other labels and routed
lines. A label that cannot fit is omitted; its directed line and inspector text remain. Labels
remain absent below 0.55 zoom. Zoom and selection do not reroute or request a layout worker.

## Direct inspection

Guarded local Chromium inspection passes at **1440×900** and **1280×800**:

| Artifact | Actual observations |
| --- | --- |
| [Main browser](browser-observations.json) | 16 observations; dense fan-out/fan-in, shared DB, opposite arrows, cycle and mixed HTTPS/SQL protocols at 0.45, 0.75 and 1.15 zoom. |
| [Exact routing accounting](routing-accounting.json) | All 18 source connections accounted for in 15 aggregates and 19 visible paths, including three shared trunks; all 11 provenance fields retain their exact members. Reorder/rename preserve path identities/geometry. |
| [Compatibility supplement](supplement-observations.json) | 14 observations across shared-channel C2, its three service C3 scopes, package C3, C1 and uneditable legacy C2, at both sizes. |
| [Member lifecycle](member-lifecycle.json) | Three focused observations: retained choice on inspector reopen, actual single-member protocol regroup, and one semantic Undo. |
| [Default editor](default-browser.json) | Legacy workspace remains the default at both sizes; no writes, errors or warnings. |
| [Fixtures](fixture-1440.json) / [1280](fixture-1280.json) | Public synthetic design/layout captured after acknowledged real API setup; portable design/layout round trips stay exact. |
| [Original projects](project-preservation.json), [files](preservation.json) | Original project set, revisions/hashes, feedback, frozen benchmarks, public fixtures and earlier handoff bytes preserved. |

Actual mouse clicks at low/high zoom verify the HTTPS trunk chooser, chosen-member-only path
emphasis, a single branch, the separate SQL member, repeated DB member chooser and distinct reverse
connection. Every path remains orthogonal and reaches the correct target side; none crosses a card
in the dense fixture. Browser label bounds avoid cards and each other. IDs, path coordinates and
node geometry stay exact across zoom/selection; edge DOM identities stay stable across zoom.
The dense pure routing observation took 5–14ms in the final concurrent capture; this is a local observation,
not a large-graph performance guarantee. No new layout worker is created or messaged.

[Screenshots](screenshots/) were visually inspected across low/high density, both desktop sizes,
selected trunk/member, C1, package/service C3, shared queue, legacy and default editor states.
The same prior UX09 source/layout/camera provides a concrete readability comparison at each size:
[before 1440](../UX09/screenshots/containers-1440-0.75.png) and
[after 1440](screenshots/ux09-comparison-1440-0.75.png), plus
[before 1280](../UX09/screenshots/containers-1280-0.75.png) and
[after 1280](screenshots/ux09-comparison-1280-0.75.png). The prior overlapping labels disappear where
the existing narrow gaps cannot fit them, while separated orthogonal paths avoid the cards and
retain every arrow. Dense snapshots show shared branches, distinct feedback lanes and crossing
gaps. The comparison preserves node positions; no smaller bounding rectangle is claimed as proof.

All browser guards were installed before page creation. Main, compatibility and default passes
blocked every non-read/external request and attempted zero writes. The member lifecycle pass allowed
only exact owned operation/undo routes: two actual 200 responses changed one protocol and undid it;
all other connections, architecture settings and layout stayed exact. Every final pass logged zero
external requests, page errors or console warnings/errors. Setup/deletion used the real API and
exact owned disposable IDs only.
[Main](owned-projects.json) and [supplement](supplement-owned-projects.json) disposables were deleted
and verified 404, as was the [member-lifecycle disposable](member-owned-project.json); final
project-set equality also covers earlier attempted disposables.
No provider, external agent or application generation ran.

## Verification and boundaries

Node **24.21.0**, pnpm **12.16.1**, Node bin directory prepended to PATH:

- `pnpm lint`: final exit 0; unchanged 2,797 warnings / 88 infos, no errors.
- Full `pnpm typecheck`: exit 0 across workspaces/scripts, including existing source/test types.
- `pnpm --filter @jeeves/web build`: exit 0; existing large-chunk advisory.
- Direct browser, exact accounting, scoped formatting, preservation and staged whitespace: pass.

[Check logs](checks/) retain actual outcomes with trailing whitespace normalized only.
[Attempt notes](inspection-attempts.json) record the corrected feedback-corner simplification,
selection wrapper observation, strict initial compile/format issues and optional-architecture
legacy fixture setup. No dependency, fixture typing adaptation, snapshot or broad test maintenance
was needed. Unit/E2E/template suites and `pnpm check` remain explicitly deferred.

Previously overlapping user-placed cards can enclose an endpoint; the fallback retains its directed
selectable path rather than promising an impossible obstacle-free escape. Existing camera/panel
preferences can clip remote objects. Drag, grid preview, asynchronous layout stability and Tidy/fit
remain **UX11a/UX11b**. UX10 supplies derived path/label geometry without changing node placement.
Studio default rollout remains UX15. No product blocker remains; stop after UX10.
P73a/P73b and the backend batch remain paused.
