# UI refresh: independent review (UI14)

Reviewed 2026-11-13 at `7277766` by an agent that wrote none of UI01–UI13. Each unit was read
against [the plan](units.md), [the preview](preview.md) and its [handoff](../../handoff.md) entry,
the combined diff since `3b985d2` was read (the GS commits in that range left out), and the four
checks were run before and after. Fresh screenshots of the running app, at 1440×900 and 1280×800 in
both themes, were compared with every preview image; six are in [evidence/ui14](evidence/ui14/).

## Owner summary

- The thirteen units did what the plan asked. The app matches the preview's tiles, icons, module
  menu, inspector, top bar, right-click menus, Settings cards, model picker and usage panel, in
  both themes and at both sizes, with the differences each unit recorded (below).
- **One real defect, fixed here:** since UI05 every studio glyph in an exported PNG was a solid
  black shape, and the Detailed view's loader arrow was a black bar (since MA06). The capture now
  copies each SVG shape's paint before rasterising; a new export test checks the PNG. The UI05
  evidence and Resolution line said the glyphs showed in exports; nobody had looked at the PNG.
- Two small fixes: the e2e server now blanks `ANTHROPIC_API_KEY` as it does `OPENAI_API_KEY`, and
  three leftovers are gone (`ownStretchMidpoint`, `shell/StatusBadge.tsx`, a stale adapter
  comment).
- **For you to decide** (marked **Owner** below): the module menu's height, the dark theme's blue
  and chat bubble, the warning mark on yellow actions, chat's tool output now carrying the new
  icon names, words in module descriptions, and the first live run of models.dev, the custom
  endpoint and Sign in with ChatGPT.
- `AGENTS.md` and `jeeves/PLAN.md` now name broker reconnect (BR01 → BR02), then GS07 and GS09 of
  generated system tests, as the active plan.

## Decisions

| # | Verdict | What I saw |
| --- | --- | --- |
| D1 | **Delivered** | Every screen matches its preview image in both themes; the differences are the ones the units recorded (Codex pill words, the Back button's shape, no "plan" on Codex rows, chips with one decimal). |
| D2 | **Delivered** | No `.board-remove` or loader X on any screen; right-click on a tile, an action, a line and a loader arrow opens the menu; the User and its lines open none; Delete still removes. |
| D3 | **Delivered** | Bands computed `--cap-host`/`--cap-plain` on every tile and container in both views and themes; User lilac, actions yellow. |
| D4 | **Delivered after this review's fix** | 30 glyphs on the board, in menus and the inspector, outlines `#071c28` in both themes. In the PNG export they were black until the fix here. |
| D5 | **Delivered** | Requests, Data, Events, Files & media, Custom, with dots and the three-line legend. |
| D6 | **Delivered**, with leftovers | No Template, Part of a template or Stub in the studio's own text on the canvas, menus, inspector or module page. Generate project's Modules list keeps the spec's words, as the plan's UI06 test rule says. Lower-case "stub" and "template" remain inside spec text the studio shows (Custom's description "generated as a stub", the module page's "No template covers it"). |
| D7 | **Delivered** | Connections above Modules, From/To, the blueprint's word; a row selects the other end with Back; any other selection clears the trail. |
| D8 | **Delivered** | Header: Design, Settings, Export diagram, then Undo, Redo, the two toggles, Generate project, the project menu. Toolbar: Pointer, Connect, Fit, Detailed, Simple. |
| D9 | **Delivered** (no live sign-in) | Four cards; a made-up Anthropic key saved, shown as dots, removed; never in a response, the page or a screenshot. Codex's button shows the stand-in's waiting and failed states. The real sign-in is the owner's to try. |
| D10 | **Delivered** | No Sign in with Claude anywhere. |
| D11 | **Delivered** (no live fetch) | The picker lists every provider with status, context and prices from a made-up catalogue; the usage chips and panel show. models.dev has never been fetched. |
| D12 | **Delivered** | In dark, no white icon outline; across every screen checked the only see-through fill is Mantine's modal scrim. |
| D13 | **Delivered** | No built-in study uses `redirect`, `billing`, `notification` or `gateway`; TinyURL's Redirect service reads Service. |

## The coordinator's ledger

Each item reported by a unit, and what became of it.

| Unit | Item | Status |
| --- | --- | --- |
| UI01 | The plan was amended (`1135fda`) to expect a Service's 13 menu items; no e2e test opens a Redirect-kind tile's own module menu | **Open**, follow-up 9. `studio-lane-commands.test.ts` and `studio-operations.test.ts` cover the kind in unit tests. |
| History | `09b4bee` swept in UI06's work and pushed `ui06-check.spec.ts`; `9f93890` deletes it; `d481275` fixes UI08's e2e locator | Dealt with. The spec is gone from `main`; the locator fix keeps the same assertion. |
| UI02 | A right-click picks the selected line, then the one under the pointer, then the first | Dealt with: the plan's order opened the wrong line on a shared bus; this is better. |
| UI02 | Remove selects first; switching to Connect no longer cancels an open removal confirmation | Dealt with: selecting first is what keeps the confirmation; the open panel in Connect mode is harmless (Delete does nothing there). |
| UI02 | `ownStretchMidpoint` and `DetailedLine.removable` are dead | `ownStretchMidpoint` **deleted** here. `removable` is still set and pinned by `detailedView.test.ts`: **open**, follow-up 10. |
| UI02 | `docs/design-playbook.md` still mentions the X | **Open**, follow-up 11 (dated lessons, not edited here). |
| UI04 | Low contrast of the warning mark on yellow action tiles | **Open, Owner**, follow-up 3. |
| UI04 | The Detailed export draws the loader arrow as a black bar | **Fixed** here, with the glyphs (same cause). |
| UI05 | Chat's `describeStudioDefinition` hands the model the new icon names | **Open, Owner**, follow-up 4. |
| UI05 | Five old icon wrappers keep `color: var(--type-color…)` | Dealt with: not dead. They still colour Tabler fallback and arrow icons inside those wrappers. |
| UI06 | `module-menu.spec.ts`'s "on the board" test moved to 1440×1000 | **Ruling: not a weakening.** Every assertion is kept and the placement rule it tests (`size.h <= board.h − 32` opens beside the tile) is unchanged; the window is the test's input, set so the rule's "beside" branch is reachable with the preview's taller menu. What it gives up, the menu fitting beside the tile at 1440×900, is a design consequence of the preview's cards, not a regression the test should hide. **Owner** question, follow-up 1. |
| UI06 | At 1280×800 the Worker menu scrolls the legend out of sight | **Open, Owner**, follow-up 1. |
| UI06 | `GenerationModules.tsx` reads the spec's labels | Dealt with: Generate project keeps Template and Stub, as the plan's test rule says. |
| UI06 | The playbook's V3-03 entry still describes Template/Part/Stub grouping | **Open**, follow-up 11. |
| UI07 | `designBlueprintV3` instead of `designBlueprint` | Dealt with: v2 throws on schema-3 designs; the connections are the same. |
| UI07 | Module navigation keeps the trail | Dealt with: otherwise the plan's module page with both Backs could never show. |
| UI07 | Chat never sets the selection | Dealt with: nothing to empty. |
| UI08 | `shell/StatusBadge.tsx` unused | **Deleted** here, with its `.status-badge` rule (it held the last literal colours in a component). |
| UI08 | The header comment of `providers/src/anthropic.ts` is stale | **Fixed** here (comment only). |
| UI08 | `playwright.config.ts` blanks `OPENAI_API_KEY` but not `ANTHROPIC_API_KEY` | **Fixed** here, with a test (below). |
| UI08 | OpenAI's chat error text is old | **Open**, follow-up 7. |
| UI09 | The e2e Codex is `e2e/fake-codex.mjs` with a throwaway `CODEX_HOME` | Dealt with: the e2e server never runs the real `codex`. |
| UI09 | Chat's Codex error still says to run `codex login` | **Open**, follow-up 7. |
| UI09 | `CODEX_API_KEY` defeats Sign out | **Open**, follow-up 8. |
| UI09 | The real sign-in is untried | **Open, Owner**, follow-up 6. |
| UI10 | A guard in `eval/design-runner.ts` the plan doesn't name | Dealt with: without it `--models=custom:…` would have run Codex. |
| UI10 | Hand-written, not recorded, response bodies | **Open**, follow-up 6 (record one at the first live turn). |
| UI10 | The base URL rules | Dealt with: stricter than the plan (no user, query or fragment), all refusals plain. |
| UI10 | No live call | **Open, Owner**, follow-up 6. |
| UI11 | The provider name squeezed in the 300px rail | **Open, Owner**, follow-up 5. |
| UI11 | Codex rows have no "plan" label | Dealt with: telling a ChatGPT login from an API key would need Codex's `auth.json`, which Jeeves never reads. |
| UI11 | Attach is icon-only | Dealt with: as the preview draws it. |
| UI11 | models.dev never fetched | **Open, Owner**, follow-up 6. |
| UI12 | The scripted model reports usage (100/20) | Dealt with: the unit checked both the absent and the shown cases. |
| UI12 | Per-reply cost removed | Dealt with: the preview's chips are in, cached and out; cost is in the panel. |
| UI12 | The ring is an SVG arc; `role="note"` | Dealt with (rule 7; Biome). |
| UI13 | Text boxes styled through Mantine's `--input-bg`/`--input-bd` | Dealt with: keeps the focus and error edges. |
| UI13 | The link tab's `--data` mix; two 55%-`transparent` dashed rings | **Open**, follow-up 12 (rule 7). |
| UI13 | Mantine's light variants on the New project error and the project browser's red hover | **Open**, follow-up 12. |
| UI13 | Dark `--blue` `#7eb6e0` against the preview's `#3d9cf0`; the chat bubble on `--banner` against `--chrome` | **Open, Owner**, follow-up 2. |
| UI13 | The inspector's native fields on `--paper`/`--grid-dot` | **Open**, follow-up 12. |
| UI13 | Old literal colours in `canvas.css` | **Open**, follow-up 12 (they predate this plan). |

## Seams (step 3)

- **Right-click with the inspector trail open.** After a jump (Shorten service → URL database), a
  right-click on Shorten service and Escape leaves the selection and Back as they were; Remove tile
  selects the tile it removes, so the trail empties, and Undo restores the tile. No page error.
- **Icons in the diagram export.** Broken; fixed here (above).
- **The model picker after a key is removed.** Pick Claude Haiku, remove the Anthropic key in
  Settings, return to Design: the button's dot reads not ready, and the menu's Anthropic section
  is one disabled "Connect it in Settings". (The e2e server's scripted model answers in place of
  every provider, so a message still went through there; chat's "No Anthropic API key is set. Add
  one in Settings." is covered by `routes/settings.test.ts`.)
- **Dark mode on what UI08–UI12 added.** Settings' cards, the Codex waiting chip, the known-hosts
  list, the picker and the usage panel are solid `--panel`/`--control` surfaces; no see-through
  fill.
- **Keys.** The made-up key appeared in no `/api` response, not in the page's HTML, and in no
  screenshot. The server's log lines are checked by `routes/settings.test.ts` (UI08, UI10).

## Fixes in this unit

| Defect | Fix | Test (fails before, passes after) |
| --- | --- | --- |
| Exported PNG draws every studio glyph and the loader's hit stroke black | `capturePng.tsx`: `inlineSvgPaint` copies each SVG shape's computed fill, stroke and opacity onto it before html-to-image clones it; `docs/studio.md`'s two recorded YouTube export hashes follow | New `diagram-export.spec.ts` test "PNG draws the studio glyphs in their colours and no black shape": before, 12,441 black pixels; after, none, and the data and api accents appear |
| The e2e server inherits the shell's `ANTHROPIC_API_KEY` | `playwright.config.ts`: `ANTHROPIC_API_KEY: ""` | `blueprint-chat.spec.ts` "offers Anthropic in Settings…" run with a made-up `ANTHROPIC_API_KEY` in the shell: failed before (no "No key"), passed after |
| Dead code and a stale comment | `ownStretchMidpoint` (no caller), `shell/StatusBadge.tsx` and its rule (no user), the Anthropic adapter's header | `pnpm check` (types, lint) |

## Follow-ups

1. **Owner.** The module menu at the preview's card size is 780px (Service) and 843px (Worker): at
   1440×900 a Service's menu opens over a rail, and at 1280×800 both scroll and hide the legend.
   Keep it, or tighten the cards?
2. **Owner.** Dark `--blue` is `#7eb6e0` where the preview uses `#3d9cf0`, and the chat user bubble
   is `--banner` where the preview draws `--chrome`. Adopt the preview's values?
3. **Owner.** The warning mark (`--yellow`) on a yellow action tile has little contrast.
4. **Owner.** Chat's `describeStudioDefinition` now carries the new icon names (`cylinder`,
   `channel`…). Harmless to the model so far, but it is chat tool output (D6, Not in this plan).
   Keep, or drop `visual` from it with an eval run?
5. **Owner.** In the 300px chat rail a long model name leaves the provider as "· …". Wider rail,
   or a second line?
6. **Owner.** The first live runs are yours: Sign in with ChatGPT and Sign out on the dev server,
   one custom-endpoint turn (then record its response bodies for `compatible.test.ts`), and the
   dev server's first models.dev fetch (its parser follows the published shape only).
7. The chat errors for OpenAI ("set `OPENAI_API_KEY` or edit the config file") and Codex ("run
   `codex login`") predate Settings' key field and sign-in button; they could say "in Settings".
8. With `CODEX_API_KEY` set, Codex reads signed in and Sign out can't sign it out; the card could
   say "Set by `CODEX_API_KEY` in the environment", as the key cards do.
9. No e2e test opens the Redirect kind's own module menu (10 kinds) now that no study has one; a
   test could switch a tile to Redirect first.
10. `DetailedLine.removable` is still set on the user's lines and asserted in
    `detailedView.test.ts`, but nothing reads it.
11. `docs/design-playbook.md` still speaks of the red X (UI02's lessons) and of the
    Template/Part/Stub menu (V3-03). They are dated lessons; a note pointing at UI02 and UI06 would
    keep them from misleading.
12. Rule 7 leftovers: the link tab's fill mixes `--data` into `--paper-deep`; two dashed rings mix
    with `transparent`; Mantine's light variants on the New project error and the project browser's
    red hover are alpha fills; the inspector's native fields use `--paper`/`--grid-dot`, not
    `--control`; `canvas.css` still holds a few literal colours from before this plan.
13. **Owner.** D6 inside spec text: module descriptions and the module page still use lower-case
    "stub" and "template" ("generated as a stub", "No template covers it"). Chat's tool output
    carries the same descriptions, so changing them touches the evals.
14. Codex's card in Settings cuts its description with an ellipsis at both sizes ("For the design
    chat it answers in s…").

## Checks

| Check | Before | After |
| --- | --- | --- |
| `pnpm check` | exit 0, 113 files, 890 tests | exit 0, 113 files, 890 tests |
| `pnpm test:e2e` | 73 passed (4.7 min) | 74 passed (4.7 min): the 73 and the new export test |
| `pnpm --filter @jeeves/web build` | exit 0 | exit 0 |
| `ui14-check.spec.ts` (alone, one worker, deleted after) | 2 passed (fixes set aside); export hashes TinyURL `6f5b7d4f…`, YouTube `d64b88c5…`, `cb8e8172…` | 2 passed; TinyURL `aaa6abf8…`, YouTube Simple `799a8582…59a5`, Detailed `bd04165a…8f7b`, the same at both sizes and from both themes |
