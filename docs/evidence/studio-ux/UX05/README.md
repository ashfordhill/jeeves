# UX05 — Opt-in shell and explicit depth navigation

Complete on primary `main`, following `de562556c0c6dac5758ef6ab1271de6c93388573`.
Use `?studio=next` with a project URL; the default remains the existing editor until UX15.
The shell composes the current App, project selector, draw store, chat, settings and run view.
It directly renders `studioViews` from UX04, including real scope/node/relationship identities.

One shared header provides C1/C2, contextual C3, short C3 breadcrumb/back, semantic Undo/Redo,
and independent chat/inspector toggles. Click selects and inspects without changing scope;
double-click drills only when the projected node has an actual useful child scope. The C1 system
opens C2; people/external systems and a service without dependencies do not invent children.
No Explorer/map, parent dropdown, second legacy toolbar, ellipsis, focused-view selector,
Review/Patterns/Data/Saved/Deployment control or excluded business editor is mounted.

Chat starts open at 300px. The 320px inspector opens for an eligible selection and currently shows
compact read-only name/purpose or action/protocol information. Rails resize by mouse, scroll
independently and collapse separately. Width/collapse, active scope and each scope's camera use
validated, project-specific local browser preferences. Navigation, selection, resize, pan and zoom
perform no project writes. Camera changes do not add undo steps or change structural depth.

[Browser observations](browser-observations.json) record direct headless Chromium inspection,
using only mouse gestures for the checked navigation/actions, at 1440×900 and 1280×800:

- C1 system → C2 package → package C3 → service C3 → breadcrumb/back, with exact restoration of
  three distinct scope cameras, including a panned/zoomed package camera and C3 reload.
- One real projected package card, five package C3 cards/four edges and three service C3 cards.
  Selection retains scope; non-expandable services have no C3 entry and double-click stays put.
- Fresh chat-open/inspector-closed defaults; independent close/open; both rails resized to 340px
  by mouse; widths/collapse survive reload and actual shared project-menu switching.
- Generate/Design navigation returns to the saved C2 camera without starting work. Long project
  names fit the header; no overlap or horizontal document overflow at either size.
- Original QRWTY C1 people do not drill. A guarded default load retains Runs and Editor actions,
  with no new workspace rendered. All [13 original project hashes/revisions](project-preservation.json)
  remain exact, including layouts. Guard installed before page creation; zero blocked/write requests,
  page/console warnings/errors or HTTP errors. Final [owned projects](owned-projects.json) deleted
  with 204 and verified 404. Earlier failed inspection attempts also cleaned their owned projects.

Screenshots show [C1 inspection](screenshots/c1-inspect-1280x800.png),
[C2 selection with both rails](screenshots/c2-package-inspect-1440x900.png),
[package C3](screenshots/package-c3-1280x800.png),
[service C3/breadcrumb](screenshots/service-c3-1280x800.png) and
[unchanged default](screenshots/default-unchanged-1280x800.png).
The interaction observations establish behavior; screenshot existence alone is not the acceptance.

[Action destinations](action-destinations.md) compares the full UX01 inventory. Transitional limits:
finite autosave/forms (UX06/UX07), creation/Library (UX08), final card density, trunks/routing,
drag/Tidy (UX09–UX11), unified Generate (UX12) and finite chat tools/usage (UX13) remain later work.
The working two-tool Select/Hand palette has no placeholder creation actions. Graph placement is
an initial deterministic grid with ordinary React Flow edges; a dense graph is not claimed fully
routed. Current Generate is the shared existing Runs content with an opt-in label; existing default
retains legacy generation until its assigned consolidation. Existing chat controls/profile remain
shared; no message/provider call was sent. No old report or editor substitutes for unfinished forms.

Checks use Node 24.21.0 / pnpm 12.16.1 with the Node bin path prepended:
`pnpm lint`, full `pnpm typecheck` and `pnpm --filter @jeeves/web build` pass. Lint retains the
existing 2,797 warnings/88 infos with no errors; build retains the large-chunk advisory. Exact
outcomes/logs are in [checks/results.json](checks/results.json). No fixture/test typing adaptation
was needed. Unit/E2E/template suites, snapshots and `pnpm check` were explicitly deferred.

Routine corrections removed initial unused imports and adjusted semantic accessibility elements;
initial read-only browser capture exposed/fixed project-name overflow. The first larger inspection
attempts corrected empty-body JSON cleanup headers and an about:blank localStorage setup access;
the final guarded capture passes. The raw UX01 source hash list predates predecessor changes; preservation therefore checks immutable feedback/benchmarks against that baseline and every unrelated tracked file against this unit’s entry snapshot. Early logs remain. Scoped formatting, staged whitespace including
new logs, original handoff prefix, all source feedback/fixture/frozen benchmark bytes and every
unrelated tracked file are checked in [preservation.json](preservation.json).

No backend resumption, application generation, runtime/template availability change, provider or
external-agent execution, sibling edit, branch/worktree/delegation or further assignment occurred.
