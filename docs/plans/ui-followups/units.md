# UI follow-ups: menu size, colours, model button, plain module words, CI time budget

**Status:** planned 2026-11-13 from the owner's answers to the [UI refresh review](../ui-refresh/review.md)
follow-ups 1–5 and 13, and to CI's failing `pnpm check`. Written by the coordinator from the code at
`29458cf`. **Nothing is implemented.** Read, not run. Runs after [store outage](../store-outage/units.md).

There are 6 units, run in order: UF01 → UF06. A coordinator gives each unit to a fresh agent. That
agent does only its own unit on `main` in the primary checkout, commits it and stops.

## Decisions (owner, 2026-11-13)

| # | Decision |
| --- | --- |
| F1 | **Shrink the module menu's cards** so a Service's and a Worker's menu open beside their tile with the legend in view at 1440×900 and 1280×800. |
| F2 | **Use the preview's values:** dark `--blue` is `#3d9cf0`; the chat's user bubble is `--chrome` with `--chrome-ink` text. |
| F3 | **The warning mark is orange**, everywhere: `#f28f3d` light, `#f5a05e` dark, dark ink on it. Red stays for removing. |
| F4 | **Chat never reads icons.** The kind description chat's tools return drops `visual`. |
| F5 | **The model button shows the model's name only.** The provider is in its tooltip and accessible name, and in the open menu. |
| F6 | **Plain words in module sentences**, everywhere they appear (the owner chose "change them everywhere" over a studio-only layer). The exact sentences are in UF05. They reach the studio, chat, the Generate dialog's reasons, the generator's `.jeeves/report.json` and a stub's header comment alike (amended 2026-11-13 after UF05's first run: these share one source). The glossary's Template and Stub entries, the Generate dialog's group headings and the generator's own field names keep their words. |
| F7 | **CI's unit tests get a time budget** that fits a slower runner. No assertion changes. |

## Not in this plan

| Item | Why not |
| --- | --- |
| Grouping Database, Object storage, Cache and Search under one palette heading | Asked about, not decided |
| A paid chat eval run | Needs the owner's go-ahead at the time; no eval case pins the changed sentences |
| Any other review follow-up (6–12, 14) | Not decided |
| Pushing, or changing branch protection | The owner's |

## Rules for every unit

The [UI refresh plan's Rules for every unit](../ui-refresh/units.md#rules-for-every-unit) 1–8 apply
as written, with these changes:

- **Rule 1:** read `AGENTS.md`; the last three entries of `docs/handoff.md`; this plan's Decisions,
  Not in this plan and Rules; the UI refresh plan's Rules 1–8 and Shared values; then your own
  unit. Do not read or start a later unit.
- **Rule 6, the mouse check:** only units that change something a person sees run it. UF01 doesn't.
- **Rule 9:** append one entry to `docs/handoff.md` in the UI refresh shape, then make one local
  commit with the unit's commit name. No `HUMAN_FEEDBACK` line. Don't push.

---

### UF01 — Unit tests fit a slower runner (F7)

**Why.** CI has failed `pnpm check` on every push since at least 2026-11-08. On GitHub's runner,
five PGlite-backed generator tests pass their assertions but take just over Vitest's default 5 s:
`src/update.test.ts` (2. keeps a stub body…), `src/v2/asset-lifecycle.test.ts`,
`src/v2/product-sql.test.ts`, `src/v2/upload-state.test.ts`, `src/v2/favorites.test.ts`
(run `43530225460`). Locally they take 3–5 s.

**Steps.** In `jeeves-generator/vitest.config.ts`, add `testTimeout: 20_000` and
`hookTimeout: 20_000` to its `test` options, with the comment `// PGlite-backed tests start a
database per file; a shared CI runner needs more than Vitest's 5 s default.` Change nothing else.
If the file's shape makes that impossible (no `test` block, or it already sets these), follow the
Goal and record it.

**Checks.** `pnpm check`, then `taskset -c 0,1 pnpm check` (two CPUs, as a small hosted runner),
`pnpm test:e2e`, the web build. No mouse check.
**Done when:** both `pnpm check` runs pass. Hosted CI is confirmed only after the owner pushes; say so.
**Commit:** `UF01: unit tests fit a slower runner`.

### UF02 — The module menu fits beside its tile (F1)

**Goal.** At 1440×900 and at 1280×800, a Microservice's and a Worker's module menu open beside the
tile without covering it, lie wholly inside the window, and show the legend without scrolling. The
menu **may cover a side rail** (owner, 2026-11-13, after UF02's first run: at 600px wide it can't
sit on a 650px board beside a mid-board tile). The placement rule in `ModuleMenu.tsx`, whose
fallback already places the menu inside the window over a rail, is unchanged.

**Steps.** In `jeeves/apps/web/src/canvas/canvas.css` (menu only: never change
`.lane-module-card`, the inspector's card):

1. `.lane-module-menu`: `width: 468px` → `width: 600px`; `gap: 10px` → `gap: 8px`; `padding: 12px`
   → `padding: 10px`.
2. `.lane-module-menu-items`: `grid-template-columns: repeat(auto-fit, minmax(190px, 1fr))` →
   `grid-template-columns: repeat(3, minmax(0, 1fr))`; `gap: 6px` → `gap: 5px`.
3. A new rule after the shared `.lane-module-menu-item, .lane-module-card` rule:

   ```css
   .lane-module-menu-item {
     gap: 2px;
     padding: 6px 8px 7px;
   }
   .lane-module-menu-item .lane-module-top strong {
     font-size: 13.5px;
   }
   ```

4. `.lane-module-menu-legend`: `padding: 9px 2px 0` → `padding: 7px 2px 0`; `font-size: 11.5px`
   → `font-size: 11px`.
5. `jeeves/apps/web/e2e/module-menu.spec.ts`, test `an empty Service is a container with a + at
   its bottom; it toggles the menu and adds a module`:
   - `await page.setViewportSize({ width: 1440, height: 1000 });` → `{ width: 1440, height: 900 }`,
     and its comment → `// A Service's menu (632px tall, three to a row, UF02) opens beside the tile.`
   - The comment `// It sits beside the tile, not over it, on the board.` →
     `// It sits beside the tile, not over it, inside the window; it may cover a rail.`
   - `expect(inside(await box(moduleMenu(page)), await box(page.locator(".lane-canvas")))).toBe(true);`
     → `expect(inside(await box(moduleMenu(page)), { x: 0, y: 0, width: 1440, height: 900 })).toBe(true);`
     (if `inside` takes another box shape, pass the window in that shape).
   - Every other assertion is unchanged.

Measure both menus at both sizes: their bounding box, whether it covers the tile, whether it lies
inside the window, and whether the legend's last item is inside the menu's visible box. If either
menu scrolls, covers its tile or leaves the window, stop as in rule 2 and report the measurements;
do not pick other values. Covering a rail is expected and fine. (First run, `0923df1`: both menus
632px tall and 600px wide at both sizes, no scrolling; they opened over a rail.)

**Docs.** `docs/studio.md` and `jeeves/CATALOG.md` where they say the menu's cards are two to a
row or that the menu sits on the board.

**Mouse check.** On YouTube v3's Watch API and Transcoder (as UI06's check did), at both sizes and
in both themes: the menu opens beside the tile, the legend is visible, one module from each group
can still be added. Compare with `preview/module-menu-*.png`: three columns instead of two is the
expected difference.
**Commit:** `UF02: the module menu fits beside its tile`.

### UF03 — Dark blue, the chat bubble and an orange warning mark (F2, F3)

**Steps.**

1. `jeeves/apps/web/src/theme/tokens.css`, dark block: `--blue: #7eb6e0` → `--blue: #3d9cf0`.
2. `tokens.css`: add `--warn` (`#f28f3d` light, `#f5a05e` dark) and `--on-warn` (`#071c28` both)
   to the light and the dark block. If the warning mark appears in an exported diagram, add the
   light values to the capture-surface block too (UI04's pattern; `diagram-export.spec.ts` checks it).
3. `jeeves/apps/web/src/project/design-view.css`, `.chat-user`: `background: var(--banner)` →
   `background: var(--chrome)`, `border: 2px solid var(--line)` → `border: 2px solid var(--chrome)`,
   and add `color: var(--chrome-ink)`. Any text inside the bubble that sets its own colour from
   `--ink` takes `--chrome-ink` (or `--chrome-ink-soft` for soft text).
4. The warning mark is orange wherever it is drawn:
   - `canvas.css` `.lane-warning-mark`: `background: var(--yellow)` → `var(--warn)`,
     `color: var(--on-yellow)` → `var(--on-warn)`.
   - `canvas.css` `.lane-warnings li`: `border: 1px solid var(--yellow)` → `var(--warn)`. The list
     element's `data-family="data"` (its yellow `--sfam` wash) becomes `data-family="worker"` (the
     orange family), and its comment says so.
   - Any other place that draws a design warning in yellow:
     `grep -rn "warn" jeeves/apps/web/src jeeves/packages/board/src --include=*.css --include=*.tsx`.
     The board's marked-tile ring (`board.css`, `.is-marked`) included, if it uses yellow.
   - Yellow that isn't a warning (Generate project, the selected model, Consume and Produce)
     stays yellow.

**Mouse check.** In both themes at both sizes: a tile with a warning (Marketplace's or any study
tile the e2e helpers give a warning), a yellow action tile with a warning, the inspector's warning
list, a chat turn's user bubble, a selected tile's blue ring in dark. Compare with the preview's
`.msg-u` and `--blue`.
**Commit:** `UF03: dark blue, the chat bubble and an orange warning mark`.

### UF04 — The model button shows the model's name (F5)

**Steps.** `jeeves/apps/web/src/chat/ModelPicker.tsx`: delete the
`{provider ? <span className="chat-model-provider">· {provider.name}</span> : null}` line. Keep the
button's `aria-label` and `title` as they are (both name the provider). Delete the
`.chat-model-provider` CSS rule. The name keeps its ellipsis rule. Update any unit or e2e test that
reads the provider inside the button to read it from the `title` or the accessible name.

**Mouse check.** Both themes, both sizes: the button shows the dot, the name and the chevron; hover
shows "name · provider"; the open menu still groups by provider.
**Commit:** `UF04: the model button shows the model's name`.

### UF05 — Chat reads no icons; module sentences in plain words (F4, F6)

**Amendment (coordinator, 2026-11-13, after the first run `3a5bd92` stopped).** The first run found
four things the steps below miss. They apply on top of the steps:

- **A. Chat's own describer.** Chat doesn't call the spec's `describeStudioDefinition`. Its tool in
  `jeeves/apps/server/src/chat/tools.ts` (`case "describeStudioDefinition"`) spreads
  `studioDefinitions[kind]` itself. Change `const { settingsSchema, ...definition } =
  studioDefinitions[kind];` to `const { settingsSchema, visual: _visual, ...definition } =
  studioDefinitions[kind];`. Make step 1's edit to the spec function as well.
- **B. More sentences**, added to step 2's table (exact old → new):

  | File | Old | New |
  | --- | --- | --- |
  | `spec/src/module-status.ts` (`stubReason`, custom) | `Your own logic, with no template.` | `Your own logic: you write it.` |
  | `spec/src/module-status.ts` (`stubReason`, other stubs) | `` `${definition.name} has no template.` `` | `` `Jeeves doesn't generate a ${definition.name}; you write it.` `` |
  | `spec/src/module-status.ts` (`blocked`) | `` `${kept}, which its template can't use` `` | `` `${kept}, which its generated code can't use` `` |
  | `spec/src/module-generation.ts` (projection refusal) | `…but its templates need it as a source of truth.` | `…but what they generate needs it as a source of truth.` |
  | `spec/src/module-generation.ts` (link refusal) | `` `…, but its template needs ${access}.` `` | `` `…, but its generated code needs ${access}.` `` |

  The step-3 note that the Generate dialog's `Your own logic, with no template.` stays is
  **withdrawn**: it is `stubReason`'s text and takes the new words (F6).
- **C. The generator's output changes, and the pins are re-taken.** The reasons are copied into
  `.jeeves/report.json` (`jeeves-generator/src/v2/assemble.ts`), and a stub's header comment uses
  its kind's description (`module-stubs.ts`). Re-take the pins by the production foundations pin
  procedure (its Rule 7). The allowed changed paths are: `.jeeves/report.json` and
  `.jeeves/manifest.json` in the exports that change, and `src/modules/visit-worker/archiver.ts`
  in stub-stack (its header comment only). Review each changed path; any other path, or a change
  other than these sentences and hashes, means stop as in rule 2. Frozen local-v1 output must not
  change.
- **D. Tests and docs.** Every assertion of an old sentence takes the new text, including
  `jeeves-generator/src/v2/generation-v2.test.ts` and `module-authoring.spec.ts:1002`
  (`StubYour own logic, with no template.` → `StubYour own logic: you write it.`). In
  `docs/studio.md`, fix the quotes (around lines 630–632 and 794) and the sentence near 633 that
  says a Custom status shows no reason (it shows one). Leave `docs/design-playbook.md`'s dated
  lesson alone.

**Steps.**

1. `jeeves/packages/spec/src/studio-definitions.ts`, `describeStudioDefinition`:
   `const { settingsSchema: _schema, ...description } = definition;` →
   `const { settingsSchema: _schema, visual: _visual, ...description } = definition;`, and its doc
   comment says icons and colours are the canvas's, not the model's. Then
   `grep -rn "visual\|icon" jeeves/apps/server/src/chat` and confirm no other chat tool output
   carries an icon name; if one does, drop it the same way and record it.
2. The sentences (exact old → new text):

   | File | Old | New |
   | --- | --- | --- |
   | `spec/src/studio-components.ts` (custom module) | `Your own logic, generated as a stub.` | `Your own logic: Jeeves gives you an empty, typed file to fill in.` |
   | `spec/src/module-status.ts` | `No template covers it.` | `Jeeves doesn't generate this; you write it.` |
   | `spec/src/module-status.ts` | `` `No template in ${nameOf(module.host)} uses it.` `` | `` `No Generated module in ${nameOf(module.host)} uses it, so you write it.` `` |
   | `spec/src/module-status.ts` | `Its template isn't selected yet.` | `It isn't generated yet.` |
   | `spec/src/module-generation.ts` (role refusal) | `…, but its template needs ${…}` | `…, but what it generates needs ${…}` |
   | `spec/src/module-generation.ts` (access refusal) | `…doesn't allow what its template needs.` | `…doesn't allow what its generated code needs.` |

3. Tests: `grep -rn "No template\|generated as a stub\|isn't selected yet\|its template needs"
   jeeves --include=*.ts --include=*.tsx` lists every assertion of the old text (today in
   `studio-module-patterns.test.ts`, `module-generation.test.ts`, `ModuleMenu.test.tsx` and
   `module-authoring.spec.ts:259`). Each takes the new text, nothing else. The Generate dialog's
   `Your own logic, with no template.` (`module-authoring.spec.ts:1002`) is not in the table and
   stays.
4. Docs: `docs/studio.md` wherever it quotes one of these sentences. Leave
   `docs/plans/ui-refresh/review.md` as it is (it is the review's record); the handoff says that
   follow-ups 4, 5 and 13 of that review are done.
5. Evals: `grep -rn` the old sentences under `jeeves/apps/server/src/eval` and `docs/evals`. If an
   eval case (not a recorded report) asserts one, stop as in rule 2. Recorded reports stay as they
   are. Run no paid eval.

**Mouse check.** On a project with a Custom module and an unconnected part (the e2e
`module-authoring` fixtures show both): the module page and the menu read the new sentences, in
light only (no colour changes).
**Commit:** `UF05: chat reads no icons; module sentences in plain words`.

### UF06 — Review

**Goal.** Find what UF01–UF05 got wrong between them. Read their handoff entries and
`git diff 29458cf..HEAD -- jeeves jeeves-generator/vitest.config.ts docs` (the store outage
units' diff is not yours). Check each decision F1–F7 in the running app in both themes at both
sizes; that no warning is still drawn in yellow; that no sentence in the table survives in the
studio; that the inspector's module cards are unchanged by UF02; and that the Generate dialog
still reads Template and Stub. Fix a small defect only with a test that fails before and passes
after; record the rest in `docs/plans/ui-followups/review.md`. Run all four checks before and after.
**Commit:** `UF06: review ui follow-ups`.
