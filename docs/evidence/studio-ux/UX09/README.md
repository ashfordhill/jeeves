# UX09 — Compact symbols, selection and zoom text

Complete on primary `main`, following `2eafbc2f0be24587b5e73bf61fb53b55862eb29f`.
The studio remains opt-in through `studio=next`; runtime/template availability is unchanged.

Applications/packages have fixed **216×96**, resources/integrations **168×96**, and people
**144×96** world dimensions. Database cylinders, person/service/browser symbols, a distinct cache
stack, queue arrows and a package group mark retain capability meaning without repeated kind
captions or child lists. Existing adaptive capability colors supply solid borders and light fills.
Known providers can add bundled Tabler marks; unmarked providers retain their capability icon.
No remote assets, dependency installation or generation-status styling is involved.

Selection adds a 3px halo or stronger edge without dimming unrelated objects. Hover is weaker.
Names use at most two lines with ellipsis and full hover/accessibility text. At zoom below 0.55,
relationships have no label or label plate. From 0.55, they show at most 36 action characters.
From 1.10, cards can add one-line purpose and actual language/engine/provider values; relationship
labels retain a useful protocol within 56 total characters. `Unspecified`/`In process` protocols
add no visual suffix. Empty secondary text and guessed legacy settings are omitted. Full stored
values remain available through the existing inspector. Presentation changes request no layout.

## Direct inspection

Chromium used real local API setup and read-only browser interactions at **1440×900** and
**1280×800**. Guards preceded page creation, restricted all main-pass mutation targets to exact
owned disposables, and blocked external requests. The focused supplement and default-editor
inspection blocked all browser writes. No browser attempted a write, provider call, agent action,
generation or external request. Setup/deletion used exact owned IDs and the real server.

| Artifact | Observed result |
| --- | --- |
| [Main observations](browser-observations.json) | 32 observations across C1/C2/package C3 at 0.45, 0.75 and 1.15, both desktop sizes; pass. |
| [Focused observations](supplement-observations.json) | Eight observations: actual mouse edge selection, full accessible/inspector values, both sides of 0.55/1.10 thresholds, omitted unspecified protocol and dark theme; pass. |
| [Default editor](default-browser.json) | Legacy workspace stays default at both sizes; zero writes/warnings/errors. |
| [Main fixture 1440](fixture-1440.json), [1280](fixture-1280.json) | Public synthetic source/layout captured after acknowledged real setup; exact portable round trip passes. |
| [Main disposables](owned-projects.json), [focused disposables](supplement-owned-projects.json) | Final-pass projects deleted and verified 404. Earlier attempted disposables also cleaned up; final project set equals baseline. |
| [Preservation](preservation.json), [original projects](project-preservation.json) | Original projects, feedback, frozen benchmarks, old factories, public fixtures and earlier handoff bytes preserved. |

[Screenshots](screenshots/) cover the required zooms/roles, long names, selected cards and edges,
full inspector values, dark theme and default editor. Representative screenshots at each density,
both desktop sizes and the supplementary states were visually inspected. Cards retain their full
opacity and source names; controls stay reachable without document overflow. Existing route
crossings and overlapping labels remain visible and are reserved for UX10.

The observations compare exact node positions/dimensions and retained DOM identities across zoom.
Edge coordinates are compared at **0.001 world-unit precision**, allowing React Flow's floating
handle measurement noise (the first strict comparison found differences below 0.0001 world unit).
This is measurement tolerance, not a product geometry adjustment. There are no worker creations
or messages during zoom/selection. Selected/unrelated card colors and opacity compare equal.
The source/layout remain exact after all browser interactions, including reload and portable export.
The existing conservative creation spacing still reserves the largest role; movement/Tidy is UX11.

## Checks and scope

Node **24.21.0**, pnpm **12.16.1**, Node bin directory prepended to PATH:

- `pnpm lint`: exit 0, unchanged 2,797 warnings and 88 infos, no errors.
- Full `pnpm typecheck`: exit 0 across workspaces/scripts and existing source/test types.
- `pnpm --filter @jeeves/web build`: exit 0, existing large-chunk advisory.
- Scoped formatting, preservation and staged whitespace, including new check logs: pass.

[Check logs](checks/) record actual outcomes; trailing whitespace is normalized only.
[Attempt notes](inspection-attempts.json) explain the bounded fixture/measurement/format corrections.
Raw one-off scripts and exploratory logs remain ignored. No fixture typing, dependency, snapshot
or test-suite changes were needed. Unit/E2E/template maintenance, suite execution and `pnpm check`
remain explicitly deferred by the owner.

UX09 does not implement shared trunks, compact route reservation, drag/Tidy or default rollout.
Cameras can still preserve a viewport that clips distant objects after panel changes. No product
blocker remains for this unit. UX10 is the next exact assignment boundary and is not started here.
P73a/P73b and the backend batch remain paused.
