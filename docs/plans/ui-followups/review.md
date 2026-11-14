# UI follow-ups: independent review (UF06)

Reviewed 2026-11-13 at `bb164c0` by an agent that wrote none of UF01–UF05. Each unit was read
against [the plan](units.md) (with its UF02 and UF05 amendments and F6 as amended), the UI refresh
plan's Rules 1–8 and Shared values, and its [handoff](../../handoff.md) entries, the blocked ones
included. The diff `a012c31..HEAD` was read (that is `29458cf..HEAD` without the store outage
units SO01–SO03 and their plan commits). The four checks were run before and after, and a
temporary `uf06-check.spec.ts` (deleted) drove the running app by mouse at 1440×900 and 1280×800
in both themes, on three projects: the TinyURL extended study, a blank Simple project and the
YouTube study. Eight screenshots are in [evidence/uf06](evidence/uf06/).

## Owner summary

- The five units did what the plan asked. F1–F7 hold in the running app in both themes at both
  sizes; no warning is drawn in yellow; no sentence from either UF05 table survives in the studio,
  chat, the Generate dialog or the generator's report; the inspector's module cards are as UI06
  left them; chat's kind descriptions carry no icon.
- **Fixed here**, each with a test that failed before: a group's lone card in the module menu
  takes the whole row again, as the preview draws it; "Jeeves doesn't generate a ID generator"
  reads "Jeeves doesn't generate ID generator modules; you write it."; Custom's description no
  longer gives a stub's header comment two colons; Biome's two warnings in `canvas.css` are gone
  with no change on screen.
- **For you to decide** (marked **Owner** below): the 600px menu over a tile that has no room
  beside it at 1280×800, and over the top bar or the status bar; the dark theme's `--select-ring`,
  still the old blue; two findings that still say "stub" and "template"; hosted CI, which only
  your push confirms.

## Decisions

| # | Verdict | What I saw |
| --- | --- | --- |
| F1 | **Delivered for the plan's two tiles; a gap beyond them (Owner)** | Watch API's and the Transcoder's menus, both sizes, both themes: 600×632.375px, seven card rows, `scrollHeight` 628 = `clientHeight` 628, the legend's last item inside the menu, the menu inside the window and never over its tile. Boxes equal UF02's: Watch API (655.6, 16) at 1440 and (588.7, 16) at 1280; Transcoder (812.6, 251.6) and (51.9, 151.6). The inspector's cards are untouched (padding 8px 10px 9px, gap 3px, name 15px). But a Microservice in the middle of the window at 1280×800 (a blank Simple project with both rails: tile at x 587–715, y 314–442) has 571px on its left, 549 on its right, 298 above and 342 below, less than the 612 or 644 the rule needs, so the fallback puts the menu at (16, 23.8), **over the tile** and the top bar's left end. Follow-up 1. |
| F2 | **Delivered** | Dark `--blue` resolves to `rgb(61, 156, 240)` and the selected tile's ring (`.board-tile[data-selected]`, 4px) takes it; light is `rgb(26, 143, 212)`. The user's bubble is `--chrome` with a `--chrome` border (`rgb(12, 51, 73)` light, `rgb(7, 18, 25)` dark) and `rgb(243, 251, 254)` text. |
| F3 | **Delivered** | Every `.lane-warning-mark` (a Message channel with no consumer, an unlinked Produce) is `rgb(242, 143, 61)` / `rgb(245, 160, 94)` with `rgb(7, 28, 40)` ink. The tile's and the system's warning lists are `data-family="worker"`, their rows' edge the mark's colour on `rgb(253, 228, 207)` / `rgb(106, 59, 23)`. No element with "warn" in its class has a yellow fill or edge. The yellow that remains is not a warning: Generate project, the selected model, Consume and Produce, Settings' selected tab and a module's Refused pill (a refusal). |
| F4 | **Delivered** | A throwaway unit test (deleted) ran chat's `describeStudioDefinition` for every kind in `studioDefinitions` and the spec's for the same refs: no `visual`, no `"icon"`; `listStudioDefinitions`, `getDesign` and `listStudioPatterns` carry none either. |
| F5 | **Delivered** | The button's text is `gpt-5.4-mini` with no "·"; its `title` is `gpt-5.4-mini · OpenAI API` and its name `Design model: gpt-5.4-mini, OpenAI API`, in both themes at both sizes. |
| F6 | **Delivered, two wording defects fixed here** | The module page reads "No Generated module in Microservice uses it, so you write it." (Data access), "Jeeves doesn't generate Rate limiter modules; you write it." (after the fix) and "Your own logic: you write it." (Custom); the menu's Custom card "Your own logic, in an empty, typed file for you to fill in." (after the fix). The Generate dialog's rows keep **Template** and **Stub** (TinyURL extended shows both) beside the same reasons. The body text of every module page, menu and dialog opened, and a grep of `jeeves`, `jeeves-generator` and `docs`, hold no sentence from either table (what remains is prose, comments and test names). The glossary's Template and Stub entries and `docs/design-playbook.md`'s dated lesson are as F6 says. |
| F7 | **Delivered as far as this machine shows** | `jeeves-generator/vitest.config.ts` sets `testTimeout` and `hookTimeout` to 20 000 with the plan's comment; `pnpm check` passes here. Hosted CI is confirmed only by the owner's push. |

## The coordinator's ledger

| Unit | Item | Status |
| --- | --- | --- |
| UF02 | Two Biome `noDescendingSpecificity` warnings in `canvas.css` | **Fixed** here: the 13.5px `.lane-module-menu-item .lane-module-top strong` rule now follows `.lane-module-status[data-status="refused"] strong`. Biome: 2 warnings before, 0 after. Computed styles before and after: a menu card's name 13.5px, an inspector card's 15px, the status pill 11px. |
| UF02 | The open menu can cover the top bar's right end or the Dark mode button | **Recorded, Owner** (follow-up 2). Measured: Watch API's menu opens at y 16 at both sizes, over the top bar (56px); the Transcoder's ends at y 884 at 1440×900 and 784 at 1280×800, over the status bar (the bottom 36px); the blank project's Microservice at 1280 opens at y 23.8, over the top bar's left end. A click away closes it. |
| UF02 | A group's lone card takes one of three columns | **Fixed** here with one rule, `.lane-module-menu-item:only-child { grid-column: 1 / -1; }`. It matches menu cards only (`.lane-module-card`, the inspector's, is untouched); the menu's height is unchanged (632.375px); Multipart uploads and Custom now take the row as the preview's `auto-fit` grid gave them. |
| UF03 | Dark `--select-ring` is the old blue at 65%; dark `--blue-deep` `#a8d0ee` | **Recorded, Owner** (follow-up 3). Ruling: Rule 7 and D12 forbid a see-through *fill*; this is an outline, drawn in `tokens.css`, and the light theme uses the same device (`--blue` at 50%). Not a breach. It is a loose end of F2: the dark `+` now has a `#3d9cf0` face with a ring of the blue it replaced. |
| UF05 | "a ID generator", "a External call" | **Fixed** here: `Jeeves doesn't generate ${definition.name} modules; you write it.`, with its assertions and pins. |
| UF05 | A stub header with two colons | **Fixed** here: Custom's description is `Your own logic, in an empty, typed file for you to fill in.`; stub-stack's `archiver.ts` header reads `// Archiver, a Custom in Visit worker: Your own logic, in an empty, typed file for you to fill in.`. |
| UF05 | "stub" and "template" outside the tables | **Recorded** (follow-up 4). `studio-validation.ts:338` "A custom component needs a one-line purpose for its generated stub." (a readiness finding, in the blueprint and on the Custom page) and `studio-design-review.ts:194` "<module> in <tile> can't generate its template: …" (chat's `reviewDesign`, pinned by `studio-design-review.test.ts:131`). No eval case or recorded report under `server/src/eval` or `docs/evals` holds either. |
| UF01 | Hosted CI | **Pending** the owner's push. |

## Fixes in this unit

| Defect | Fix | Test (fails before, passes after) |
| --- | --- | --- |
| A group's lone card (Multipart uploads, Custom) took one column of three; the preview stretches it across the row | `canvas.css`: `.lane-module-menu-item:only-child { grid-column: 1 / -1; }`, its comment and `docs/studio.md`'s "(a lone card takes the whole row)" | `module-menu.spec.ts`, the "empty Service" test: the Custom card is as wide as its group's grid. Without the rule, 387.34px short; with it, the file's 5 tests pass. |
| `Jeeves doesn't generate a ${definition.name}` reads "a ID generator", "a External call" | `spec/src/module-status.ts`: `Jeeves doesn't generate ${definition.name} modules; you write it.` | The five assertions of the sentence (`module-stubs.test.ts`, `chat/tools.test.ts`, `routes/generation-v2.test.ts`, `module-generation.test.ts`, `module-authoring.spec.ts`) and the stub-stack pin: with the old sentence 6 tests fail (70 pass); with the new, 76 pass. |
| Custom's description gave a stub's header comment two colons | `spec/src/studio-components.ts`: `Your own logic, in an empty, typed file for you to fill in.` | `ModuleMenu.test.tsx` and the stub-stack pin, in the same run. |
| Biome: two `noDescendingSpecificity` warnings | The 13.5px rule moved after the last `strong` rule | `pnpm lint`: 2 warnings before, 0 after; the mouse spec read the same computed sizes before and after. |

Pins (production foundations Rule 7): `pnpm --filter @jeeves/generator pins:update` changed only
stub-stack's `.jeeves/manifest.json`, `.jeeves/report.json` and `src/modules/visit-worker/archiver.ts`;
v2-module-design and frozen-v2 are unchanged, and the frozen v1 test passes. Review: each changed
file was rebuilt, the two new sentences put back (and, in the manifest, archiver.ts's old hash and
size, 380 → 386 bytes), and each then hashed to its old pin, so nothing else moved. The report's
changed reasons are Rate limiter, Redirect responder and External call.

## Follow-ups

1. **Owner.** A tile with no room beside it gets the menu on top of it. At 1280×800 with both rails
   a mid-window tile (the blank project's Microservice above) has at most 571px beside and 342px
   below, and the fallback in `menuPlace` (`ModuleMenu.tsx`) puts the 600×632 menu wherever it
   covers least, here over the tile. UF02's Goal ("without covering it") holds for YouTube's two
   tiles and the e2e's Detailed Microservice, not for every tile. Proposed unit UF07.
2. **Owner.** The window the menu is clamped to is the whole window, so it may lie over the top bar
   (Watch API) or the status bar's Dark mode button (Transcoder). Proposed unit UF07 insets the bars.
3. **Owner.** Dark `--select-ring` (`rgba(126, 182, 224, 0.65)`, the open `+`'s outline) and dark
   `--blue-deep` (`#a8d0ee`, its border) predate F2. Proposed unit UF08.
4. **Owner.** Two module sentences outside the UF05 tables still say "stub" and "template" (the
   ledger's UF05 row). Proposed unit UF09.
5. Hosted CI: UF01's budget is confirmed by the `check` job on the owner's next push; if a test
   still times out there, its name says which Vitest project needs the budget.
6. `docs/studio.md` (around line 456) says Generate project's Modules list keeps the spec's words
   (Template, Part of a template, Stub). True of its labels; its reasons are now the module page's
   sentences (F6 as amended). The sentence is not false, so it is left as it is.

## Proposed units

### UF07 — The menu never covers its tile, and stays out of the bars (needs the owner)

**Why.** Follow-ups 1 and 2. **Owner question:** when no side of the tile has room for the whole
menu, which should give: the menu's height (it scrolls inside itself, as before UF02), its place
(it covers the tile), or the camera (the board pans so the tile has room beside it)? The steps
below are for the first answer, the only one that keeps the placement rule; choose another and the
unit is rewritten.

**Files.** `jeeves/apps/web/src/canvas/ModuleMenu.tsx`, `jeeves/apps/web/e2e/module-menu.spec.ts`,
`docs/studio.md`.

**Steps.**

1. `menuPlace`: the `window_` box insets the bars: `y: 56` (the top bar, `--header-height`),
   `h: document.documentElement.clientHeight - 56 - 36` (the status bar, `--status-bar-height`).
   Read both from `getComputedStyle(document.documentElement)` rather than as literals if the
   tokens resolve there; else name the two constants beside `GAP`.
2. When `inWindow.covers > 0` (nothing avoids the tile), return the placement above or below the
   tile with the most room, and give the menu `max-height` of that room minus `GAP`, so it scrolls.
   `ModuleMenu` takes the height with the point (`menuPlace` returns `{ x, y, maxHeight? }`) and
   sets it as an inline style; `.lane-module-menu` already has `overflow: auto`.
3. `module-menu.spec.ts`: a new test at 1280×800, both rails open, on `blankService(page, …,
   "Simple")` with Consume → Microservice → Message channel so the Microservice sits mid-window:
   the menu never overlaps the tile; `menu.y >= 56` and `menu.y + menu.height <= 800 - 36`; when
   it scrolls, `scrollHeight > clientHeight` and the legend is reachable by scrolling. In the
   "empty Service" test add `expect(box.y).toBeGreaterThanOrEqual(56)` for the Watch API case
   (the e2e's Microservice at 1440×900).
4. `docs/studio.md` where it says the menu "usually opens over a rail beside the tile; it scrolls
   inside itself only in a window shorter than the menu plus 32px": it also scrolls when no side of
   its tile has room for it, and it never lies over the top or the status bar.

**Checks.** The four checks; the mouse check at both sizes in both themes on YouTube's Watch API
and Transcoder and on the mid-window Microservice. **Commit:** `UF07: the menu never covers its
tile`.

### UF08 — The dark select ring follows the dark blue (needs the owner)

**Why.** Follow-up 3. **Owner question:** the open `+` in dark has a `--blue` (`#3d9cf0`) face, so a
ring of the same blue at 65% is a dimmer halo of its own colour, where today's pale ring stands
out. Pick one: (a) the new blue at 65%, `rgba(61, 156, 240, 0.65)`; (b) keep today's; (c) a solid
ring in `--blue-deep` (no alpha, in Rule 7's spirit). The steps are for (a).

**Files.** `jeeves/apps/web/src/theme/tokens.css`, `jeeves/apps/web/e2e/module-menu.spec.ts`.

**Steps.** In the dark block, `--select-ring: rgba(126, 182, 224, 0.65)` → `rgba(61, 156, 240, 0.65)`.
In `module-menu.spec.ts`'s "empty Service" test, after the menu opens, click **Dark mode** and
assert the `+`'s computed `outline-color` is `rgba(61, 156, 240, 0.65)` (and, before the toggle,
`rgba(26, 143, 212, 0.5)`); click Dark mode again. **Checks.** The four checks; the mouse check in
dark at both sizes. **Commit:** `UF08: the dark select ring follows the dark blue`.

### UF09 — Two findings in plain words (needs the owner)

**Why.** Follow-up 4; F6 chose plain words "everywhere they appear", but named exact sentences, and
these two were found by UF05 after the plan was written. **Owner question:** the exact words. The
steps use these; change them before the unit runs if you prefer others.

**Files.** `jeeves/packages/spec/src/studio-validation.ts`, `jeeves/packages/spec/src/studio-design-review.ts`,
their tests, `docs/studio.md`, and the pins if a pinned export's report carries either finding.

**Steps.**

1. `studio-validation.ts:338`: `A custom component needs a one-line purpose for its generated stub.`
   → `A Custom module needs a one-line purpose: it heads the file you write.`
2. `studio-design-review.ts:194`: `` `${where} can't generate its template: ${…}` `` →
   `` `${where} can't be generated: ${…}` ``.
3. `grep -rn "one-line purpose for its generated stub\|can't generate its template" jeeves jeeves-generator docs --include=*.ts --include=*.tsx --include=*.md --include=*.json`
   lists every assertion and quote (today `studio-design-review.test.ts:131` and any `docs/studio.md`
   quote); each takes the new text. If `pnpm check` then fails `processes-off.test.ts`, re-take the
   pins by the production foundations Rule 7; the allowed changed paths are `.jeeves/report.json`
   in the exports that change, nothing else.
4. `grep -rn` both old sentences under `jeeves/apps/server/src/eval` and `docs/evals`: if an eval
   case asserts one, stop as in rule 2 (today none does).

**Checks.** The four checks; the mouse check in light on a Custom module with no description (its
page shows the finding). **Commit:** `UF09: two findings in plain words`.

## Checks

"Before" is the tree at `bb164c0`, before any fix here. `pnpm check` and the mouse spec were run
on it by this unit; the e2e and build "before" figures are UF05's runs on that same tree, not
reruns.

| Check | Before | After |
| --- | --- | --- |
| `pnpm check` | exit 0, 115 files, 910 tests; Biome 2 warnings, 1 info | exit 0, 115 files, 910 tests; Biome 0 warnings, 1 info (the older `local.mjs` one). An interim run with the mouse spec still in place failed on that spec's own type error only, fixed in the spec. |
| `pnpm test:e2e` | UF05 at `bb164c0`: 74 passed (4.6 min) | 74 passed (4.6 min), with the mouse spec parked outside the e2e folder for the run |
| `pnpm --filter @jeeves/web build` | UF05 at `bb164c0`: exit 0 | exit 0 |
| `uf06-check.spec.ts` (one worker, deleted after) | 2 passed (16 s each), no page error, once Produce was added before the board grew (at 1280 the User tile is clipped later and a click on it never lands); the mid-window Microservice at 1280 logged over its tile; lone cards 188.66px of 576 | 2 passed (16.3 s, 16.1 s), no page error; every menu box as before; lone cards 576 of 576; the new sentences on the module page, the menu card and the Generate dialog |

The spec created three projects per size and deleted them; `E2E UF06 blank` from the first,
timed-out 1280 run (its cleanup was cut off with the test) was deleted afterwards by SQL, every
dependent table cascading. `jeeves_e2e` holds only "E2E Every kind" and "TinyURL · studio study".
