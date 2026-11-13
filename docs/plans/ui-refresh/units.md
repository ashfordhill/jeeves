# UI refresh: tiles, icons, menus, inspector, chat and settings

**Status:** planned 2026-11-12 from the owner's request and their sign-off of the
[preview](preview.md) ("I like everything in the artifact"). Written against `24c9abb`
(after PF14). **Nothing is implemented.** Only UI01's source and unit-test edits were tried (on a
scratch copy, where `pnpm check` passed); everything else was read, not run.
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-12 (UI refresh)](../../HUMAN_FEEDBACK.md).

There are 14 units, run in order: UI01 → UI14. A coordinator gives each unit to a fresh agent. That
agent does only its own unit on `main` in the primary checkout, commits it and stops.

| Phase | Units | What |
| --- | --- | --- |
| A. Studies | UI01 | TinyURL and Marketplace use no legacy tile kind |
| B. Canvas | UI02–UI07 | Right-click menus, top bar, tile colours, icons, module menu, inspector connections |
| C. Providers and chat | UI08–UI12 | API keys in Settings, Sign in with ChatGPT, a custom endpoint, the model picker, usage chips |
| D. Dark mode | UI13 | One surface ramp and a Mantine dark palette |
| E. Review | UI14 | Independent review |

## Decisions (owner, 2026-11-12)

| # | Decision |
| --- | --- |
| D1 | **The preview is the design.** Colours, icons and layouts are as [preview.md](preview.md) shows them. Its exact values are in this plan and in `assets/`. |
| D2 | **No red X on the canvas.** A right-click on a tile, a line or a module link opens a menu. Delete and Backspace still remove the selection. |
| D3 | **Two tile accents.** A tile that takes modules has a sky-blue top band; every other tile has a mint one. The User is lilac; Consume and Produce are yellow. |
| D4 | **One hand-drawn icon set** for every tile kind and module kind: a dark outline, one accent fill, one light fill, the same in both themes. |
| D5 | **Modules are grouped by what they do**: Requests, Data, Events, Files & media, Custom. |
| D6 | **Plain words for who writes the code**: Generated, Building block, You write it, shown as a dot with a legend. They replace Template, Part of a template and Stub wherever a person reads them in the studio. Chat's tool output, the generator's reports and the glossary keep Template and Stub: models read that text and the chat evals pin it. |
| D7 | **The inspector lists a tile's connections.** A click selects the other tile; Back returns. The board's selection and the inspector's page are one value. |
| D8 | **Generate project is in the top bar** (right); **Export diagram** is beside Design and Settings. |
| D9 | **Settings connects providers**: API key fields for OpenAI and Anthropic, saved to `~/.jeeves/config.json`; a Sign in with ChatGPT button; one custom OpenAI-compatible endpoint. This ends the rule that the Anthropic key is never stored. |
| D10 | **No Sign in with Claude.** Anthropic does not allow third-party tools to offer claude.ai login. |
| D11 | **The model is picked in the chat composer**, and chat shows context and token usage. Model names, context sizes and prices come from models.dev, fetched at most once a day. |
| D12 | **Dark mode has no white icon outlines and no see-through fills.** Every coloured fill in dark mode is a solid, deeper shade of its own colour family. |
| D13 | **The built-in studies use no legacy kind.** TinyURL's Redirect service and Marketplace's Payments become Services; Payments calls a Stripe API tile. Worker and Uploads keep their own kinds and labels. Saved projects keep their kinds. |

## Not in this plan

Do none of these, even if they look easy. List anything you notice in your handoff entry.

| Item | Why not |
| --- | --- |
| Removing the Redirect, Billing, Notifications or Gateway kinds, or converting saved designs | A schema change; a later plan |
| Changing chat's tool output, the system prompt, eval cases or recorded eval reports | D6; paid evals need the owner |
| Rewriting the OpenAI, Codex or Anthropic adapters, or moving them to another library | They are tuned and covered by the chat evals |
| Paid model calls, including a live test of the custom endpoint | Need the owner's go-ahead at the time |
| A Claude subscription sign-in, or a Console sign-in through `ant` | D10; the second was offered and not asked for |
| Onboarding, multi-user or audit features | `AGENTS.md` |
| The root `README.md` | Owner-maintained |

## Rules for every unit

**1. Read first, in this order:** `AGENTS.md`; the last three entries of `docs/handoff.md`
(`grep -n '^## ' docs/handoff.md | tail -3` gives their line numbers); this plan's Decisions, Not in
this plan, Rules and Shared values; [preview.md](preview.md) and the images your unit names; then
your own unit. Do not read or start later units.

**2. Exactness.** Where your unit names a file, function, string, colour or number, use exactly
that.

- This plan was written from reading the code, not by running it. If the code differs in a small
  way (a renamed variable, a moved line, a helper that already does what a step asks), follow the
  unit's **Goal** and record it under "Differences from the plan" in your handoff entry.
- If a named file or function doesn't exist, or a step can't be done as written, or doing it would
  change behaviour the unit doesn't mention: **stop**. Undo your own uncommitted work
  (`git checkout -- <each tracked path you edited>` and delete each new file you created), append a
  handoff entry titled `UInn: blocked` saying what you found, commit only `docs/handoff.md`, and
  end. Do not invent an alternative.

**3. Other people's uncommitted work.** Run `git status` first. Anything already modified or
untracked that your unit does not name is not yours: leave it unstaged and untouched (today that is
`README.md`, `.docs/`, `.jeeves-feedback/`, every `Zone.Identifier` file and the mode of
`jeeves/scripts/e2e-docker.sh`). Stage by path. Never run `git add -A`, `git add .`, `git stash`,
`git clean` or `git reset --hard`.

**4. Never edit:** the root `README.md`; anything under `field-projects/`;
`jeeves-generator/templates/`; recorded eval reports under `docs/evals/`; earlier entries of
`docs/handoff.md`; `docs/plans/ui-refresh/preview.md`, `preview/` and `assets/`.

**5. Environment.**

- Put Node 24 first: `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH`. Run every `pnpm`
  command from the repository root.
- Never stop, restart or use the owner's dev servers (ports 4300 and 4310) or the `jeeves`
  database. Never edit the owner's projects.
- Never write a real API key, token or login into a file, a test, a screenshot or the handoff.

**6. Checks.** Run them in this order, after your changes. Every unit runs all four unless it says
otherwise.

| Name | Command | Passes when |
| --- | --- | --- |
| check | `pnpm check` | exit 0 |
| e2e | `pnpm test:e2e` (or `pnpm test:e2e:docker` if Chromium's system libraries are missing) | every test passes |
| build | `pnpm --filter @jeeves/web build` | exit 0 |
| mouse | a temporary Playwright spec, below | passes at both sizes with no page error |

- If `check` fails **before** you change anything, stop as in rule 2.
- If an e2e test fails, rerun that one test alone and report both results. Never weaken a test.
  Change or delete a test only where your unit says so, or where the test asserts exactly the
  behaviour your unit replaces (say which, and why, in the handoff).
- **The mouse check.** Write `jeeves/apps/web/e2e/uiNN-check.spec.ts`. It uses the e2e servers
  (ports 4301 and 4311, database `jeeves_e2e`) and does what your unit's "Mouse check" lists, once
  with `test.use({ viewport: { width: 1440, height: 900 } })` and once with
  `{ width: 1280, height: 800 }`. It fails on any `pageerror`. Run it with
  `pnpm db:up && pnpm exec playwright test -c jeeves/playwright.config.ts uiNN-check`. Where a unit
  changes how something looks, take each screenshot in the light theme and again in the dark theme
  (the status bar's **Dark mode** button). Save at most 6 screenshots under
  `docs/plans/ui-refresh/evidence/uiNN/` and compare them with the preview image the unit names.
  Delete the spec file before you commit. Delete every project it created.

**7. Colours.** Use the tokens in Shared values. Write no literal colour in a component's CSS except
inside `tokens.css`. In the dark theme, never make a fill by mixing a colour with the background or
with `transparent`: use the solid token.

**8. Docs.** Update the docs your unit names. If your change makes another sentence in
`docs/studio.md`, `docs/studio-settings.md`, `docs/studio-blueprint.md`, `jeeves/CATALOG.md`,
`jeeves/PLAN.md`, `jeeves/README.md` or `docs/glossary.md` false, fix that sentence too. Describe
what exists now; don't add history.

**9. Finish.** Append one entry to `docs/handoff.md` with this shape, then make one local commit
named `UInn: <the unit's title in lower case>`. Don't push.

```markdown
## 2026-MM-DD — UInn: <the unit's title>

**What changed.** <files and behaviour, as a short list>
**Checks.** <each check run, with its result and counts>
**Differences from the plan.** <or "None.">
**Noticed.** <things outside the unit, or "Nothing.">
**For the next unit.** <one or two lines>
```

Also append one `- **Resolution update (2026-MM-DD):**` line to the "2026-11-12 — UI refresh" entry
of `docs/HUMAN_FEEDBACK.md`, in plain words, two sentences at most.

## Shared values

The approved preview's source is `assets/preview-source.html.txt`. Its `.jv[data-jv="light"]` and
`.jv[data-jv="dark"]` blocks hold every colour below, and its rules for `.mcard`, `.gdot`,
`.legend`, `.lnk`, `.chip`, `.meter`, `.prov` and `.picker` are the reference for spacing and type
sizes. When a unit says "as the preview draws it", read that file.

Token names. Existing tokens keep their names (`--paper`, `--cream`, `--ink`, `--ink-soft`,
`--line`, `--chrome…`, `--yellow`, `--blue`, `--plus`, `--minus`, `--grid-dot`). New ones:

| Token | Light | Dark | Used for | Added by |
| --- | --- | --- | --- | --- |
| `--cap-host` | `#b4d9f6` | `#2a6690` | Top band of a tile that takes modules | UI04 |
| `--cap-plain` | `#bfe8dc` | `#27695c` | Top band of every other tile | UI04 |
| `--user-fill` | `#e3d9f8` | `#b9a8ef` | The User tile | UI04 |
| `--user-ink` | `#071c28` | `#071c28` | The figure on it | UI04 |
| `--action-fill` | `#f6c945` | `#e6bb4a` | Consume and Produce | UI04 |
| `--action-ink` | `#071c28` | `#071c28` | Their word and badge outline | UI04 |
| `--row-line` | `#8fa5b1` | `#4f7285` | Borders inside a tile (band, module rows) and around menus | UI04 |
| `--ic-ink` | `#071c28` | `#071c28` | Icon outlines | UI05 |
| `--ic-fill` | `#fdfeff` | `#dcebf2` | Icon light fills | UI05 |
| `--badge` | `#ffffff` | `#0f1d26` | Behind a dot or a small pill on a coloured card | UI06 |
| `--hairline` | `#cfe0e8` | `#2a4554` | Dividers inside rails and menus | UI06 |
| `--control` | `#ffffff` | `#0f1d26` | Text boxes, rows you can click | UI07 |
| `--control-line` | `#9db6c3` | `#3d5d6d` | Their borders | UI07 |
| `--ok-bg` / `--ok-ink` | `#d3efe0` / `#135c41` | `#1d5a3c` / `#c4f2d8` | A connected status | UI08 |
| `--off-bg` / `--off-ink` | `#f8dcd8` / `#8f2a22` | `#5d2823` / `#ffcdc6` | A missing status; the Remove item (UI02 adds these two) | UI02 |
| `--well` | `#edf6fa` | `#0f1d26` | The usage panel in chat | UI12 |
| `--panel` | `#f7fcfe` | `#172a35` | Rails, menus and dialogs | UI13 |

Per colour family (the `data-family` attribute, set in `tokens.css` beside `--type-color`):
`--fam` is an icon's accent fill and a group's marker; `--sfam` is the solid fill of a card in that
family.

| Family | `--fam` light | `--fam` dark | `--sfam` light | `--sfam` dark |
| --- | --- | --- | --- | --- |
| `api` | `#46a0e6` | `#6bb6f2` | `#d7eafb` | `#1d4d73` |
| `worker` | `#f28f3d` | `#f5a05e` | `#fde4cf` | `#6a3b17` |
| `data` | `#f4ba36` | `#f2c65e` | `#fbeecb` | `#5c4812` |
| `messaging` | `#ea6c9f` | `#f08db5` | `#fbdde9` | `#642d49` |
| `external` | `#93a8b8` | `#a9bccb` | `#e4ebf0` | `#3b4d59` |
| `client` | `#9d74da` | `#b99cf0` | `#eadffa` | `#46357a` |
| every other family, and no family | `#37b8aa` | `#5fd0c2` | `#d0efea` | `#185b54` |

The dark surface ramp (UI13 applies it): bars `#071219`, canvas `#0f1d26`, rails and menus
`#172a35`, tiles and cards `#213a48`, grid dots `#27414f`, text `#eaf5fa`, soft text `#a8c5d2`,
lines `#7ea8bc`.

---

## Phase A — Studies

### UI01 — The built-in studies use no legacy kind (D13)

**Goal.** TinyURL's Redirect service is a Service. Marketplace's Payments is a Service that calls a
new External API tile, **Stripe API**. No behaviour of the kinds themselves changes.

**1. `jeeves/packages/spec/src/studio-examples/tinyurl.ts`.** `version: "3.2.0"` → `"3.3.0"`. In the
`redirect` element's settings: `kind: "redirect"` → `kind: "service"`, and delete the lines
`lookupStoreConnection: "redirect-db",` and `lookupCacheConnection: "redirect-cache",`.

**2. `jeeves/packages/spec/src/studio-examples/marketplace.ts`.** `version: "1.3.0"` → `"1.4.0"`.
In the `payments` element's settings: `kind: "billing"` → `kind: "service"`, and delete
`provider: "stripe",`. In the header comment, "(Payments, a Billing service with Stripe, publishes
each paid order)" → "(Payments, a Service that calls the Stripe API, publishes each paid order)".
Add this element directly before the `payments-db` element:

```ts
      {
        id: "stripe",
        name: "Stripe API",
        description: "Stripe Checkout and Connect: takes each payment and pays the sellers out.",
        settings: { kind: "external-api", category: "payments", provider: "unspecified" },
      },
```

and this connection directly after the `payments-write` connection:

```ts
      {
        id: "payments-stripe",
        from: "payments",
        to: "stripe",
        kind: "calls",
        planned: call("Opens checkouts and pays sellers", "HTTPS"),
        settings: {},
      },
```

The tile must be named **Stripe API**, not Stripe: `apps/server/src/eval/design-leak.test.ts`
treats every study tile name as a design name, and chat's own text already holds the word Stripe.
The link must come after `payments-write`: earlier places draw longer lines and fail
`laneLayout.test.ts`.

**3. Unit tests.** Change exactly these:

| File | Change |
| --- | --- |
| `jeeves/packages/spec/src/module-generation.test.ts` | In `upgrade a schema-2 design and declare every module in one batch`: `14 other saved values` → `12 other saved values` |
| `jeeves/packages/spec/src/studio-lane-commands.test.ts` | In `changeKind`'s test: the first `run` switches `redirect` to `kind: "redirect"` and expects `definition: { id: "studio-redirect" }` and `settings: createStudioSettings("redirect")`. The last line becomes `expect(change("redirect", "service")).toBe("Redirect service is already a service.");` |
| `jeeves/packages/spec/src/studio-operations.test.ts` | In `reads a stored language outside the pair as the kind's default`: delete `setting("redirect").language = "unspecified";`. After `setting("analytics").language = "python";` add the block below. The three expectations stay. |
| `jeeves/packages/spec/src/studio-examples/foundation.test.ts` | Replace `expect(studioArchitectureExample("studio-tinyurl").design).toEqual(legacy.design);` with the block below |
| `jeeves/packages/spec/src/studio-blueprint.test.ts` | In the marketplace test: the first `toMatchObject` becomes `{ blueprint: 2, findings: [], externals: [{ id: "stripe", name: "Stripe API", category: "payments" }], omitted: [] }`; `["payments", "billing", 6]` → `["payments", "service", 6]`; the comment "the Payments service is Billing with Stripe" → "Payments is a Service that calls Stripe"; the last expectation becomes `toMatchObject({ kind: "service" })`, followed by `expect(blueprint.connections.find((c) => c.id === "payments-stripe")).toMatchObject({ from: { id: "payments", kind: "service" }, to: { id: "stripe", kind: "external" } });` |
| `jeeves/apps/server/src/chat/tools.test.ts` | `toMatchObject({ type: "service", kind: "redirect" })` → `kind: "service"` |

`studio-operations.test.ts`:

```ts
    // A tile of the older Redirect kind, whose pair is Go then TypeScript.
    const redirect = stored.architecture.studio.elements.find(
      (b: { element: string }) => b.element === "redirect",
    );
    redirect.definition.id = "studio-redirect";
    redirect.settings = { ...createStudioSettings("redirect"), language: "unspecified" };
```

`foundation.test.ts`:

```ts
    // NC01's saved design, except that its Redirect service is now a plain Service (3.3.0).
    const expected = JSON.parse(JSON.stringify(legacy.design));
    expected.architecture.studio.origin.example.version = "3.3.0";
    const redirect = expected.architecture.studio.elements.find(
      (x: { element: string }) => x.element === "redirect",
    );
    redirect.definition.id = "studio-service";
    redirect.settings.kind = "service";
    delete redirect.settings.lookupStoreConnection;
    delete redirect.settings.lookupCacheConnection;
    expect(studioArchitectureExample("studio-tinyurl").design).toEqual(expected);
```

Do not edit `fixtures/nc01-schema2.json`. With these edits `pnpm check` passed on a scratch copy
(105 files, 820 tests).

**4. E2E.** In `jeeves/apps/web/e2e/canvas.spec.ts`, test `New project offers the marketplace
study`: 20 tiles → 21, 23 lines → 24, 23 arrows → 24, and its comment's "seventeen tiles" and
"fourteen connections" → "eighteen" and "fifteen". On a scratch run that was cut short,
`module-authoring.spec.ts`'s `looking, hovering and cancelled drags change neither the design nor
the blueprint` also failed and the cause was not found: rerun it alone. If it fails because of this
unit, stop as in rule 2.

**5. Docs.** Measured on a scratch copy with real ELK, by the method that reproduces the documented
TinyURL and YouTube numbers:

| | Before | After |
| --- | --- | --- |
| Marketplace, Simple | 23 lines, 1,280×1,472, 6,912px, 1 crossing, 36 bends | 24 lines, 1,280×1,632, 7,552px, 1 crossing, 42 bends |
| Marketplace, Detailed | 25 lines, 1,568×1,632, 8,896px, 4 crossings | 26 lines, 1,568×1,632, 9,056px, 5 crossings |
| Marketplace fit, Simple (1440×900 closed, both open; 1280×800 closed, both open) | 0.37, 0.37, 0.32, 0.32 | 0.33, 0.33, 0.29, 0.29 |
| Marketplace fit, Detailed | 0.33, 0.33, 0.29, 0.28 | unchanged |
| TinyURL, both views | | unchanged |

- `docs/studio.md`: both Marketplace rows of the two tables under **Size and fit**; "(1,280×1,472px)
  … 0.37 at 1440×900 and 0.32 at 1280×800" → 1,280×1,632, 0.33 and 0.29; "(seventeen tiles,
  1,472px tall) fits at 0.37 … and 0.32" → eighteen tiles, 1,632px, 0.33 and 0.29;
  `studio-tinyurl@3.2.0` → `3.3.0` and `studio-marketplace@1.3.0` → `1.4.0`. In **The marketplace
  study**: add the line `→ Stripe API` (comment "takes payments, pays sellers") under Payments'
  three lines in the lane sketch; "seventeen tiles, and 23 links (… and fourteen connections)" →
  "eighteen tiles, and 24 links (… and fifteen connections)"; replace the two sentences from "Every
  one of its 5,184 entry and link orders" to "(6,912px in all, the longest the Orders service's
  read, 896px)." with "Every one of the 5,184 entry and link orders it had before the Stripe API
  tile, laid out with real ELK, crossed at least once. This order crosses once (42 bends, 7,552px of
  lines in all, the longest the Orders service's read, 896px); Payments' link to the Stripe API
  comes last, and an earlier place draws longer lines."; in the Tiles row, "Payments (Billing,
  Stripe, public: Stripe calls its webhook)" → "Payments (a microservice, public: Stripe calls its
  webhook); Stripe API (External API, payments)"; "no externals, fourteen connections" → "one
  external (the Stripe API), fifteen connections".
- `jeeves/CATALOG.md`, Studies: `@3.2.0` → `@3.3.0`; `@1.3.0` → `@1.4.0`; "Payments (Billing with
  Stripe)" → "Payments (a Service that calls the Stripe API)"; "seventeen tiles, 23 links (… and
  fourteen connections)" → "eighteen tiles, 24 links (… and fifteen connections)". After "a new
  payment flow is a Service that calls its provider as an External API." add "No built-in study
  uses a legacy kind."
- `docs/studio-blueprint.md`: `studio-tinyurl@3.2.0` → `3.3.0`.

**Mouse check.** New project → TinyURL: the Redirect service's label reads **Service**, and its
inspector has no Lookup store or Lookup cache field. New project → Marketplace · studio study:
Payments reads **Service** and links to **Stripe API** (External API); no warning mark.

---

## Phase B — Canvas

### UI02 — Right-click menus replace the red X (D2)

**Goal.** No red X is drawn anywhere. A right-click opens a small menu at the pointer:

| Right-click on | Menu title | Items |
| --- | --- | --- |
| A tile (not the User) | The tile's name | **Remove tile** |
| An action tile | Its name | **Remove action** |
| A line between tiles | `<from> → <to>` | The module link's own label where the drawn line carries one (`projection.lines[].disconnect.label`, such as "Disconnect Link reader from URL database"), then **Remove link** |
| The user's line to an action; the User | none | no menu |
| A loader arrow inside a container | The arrow's label (`loader.label`) | **Disconnect** |

Each item does what the X it replaces did, through the same functions (`remove`,
`removal.onRemoveLine`, `disconnectModule`), in Pointer and in Connect mode alike. The removal
confirmation panel, its notices, Delete and Backspace are unchanged.

**1. `jeeves/packages/board` (it imports no Jeeves code and no Mantine).**

- `src/react/Board.tsx`: delete the props `removable`, `onRemoveTile` and `onRemoveLine`, and
  `LineSpec`'s `removable` and `removeLabel`. Add:

  ```ts
  /** A right-click on a tile: its ID and the pointer, in client pixels. */
  onTileMenu?: (tile: string, at: Point) => void;
  /** A right-click on a line: the selected line when it is under the pointer, else the nearest. */
  onLineMenu?: (line: string, at: Point) => void;
  ```

  Wire them on `<ReactFlow>` with `onNodeContextMenu` and `onEdgeContextMenu`. Each returns at once
  when its prop is unset; otherwise it calls `event.preventDefault()`, clears the line chooser
  (`setLineChoice(undefined)`) and calls the prop with `{ x: event.clientX, y: event.clientY }`. The
  line is found as `onEdgeClick` finds its lines (`nearestLines(point, routes, 3 / rf.getZoom(),
  22)`): `selected.line` when that list holds it, else the list's first, else `edge.id`.
  Delete `removeTile`, the `remove` prop passed to `TileChrome`, `removeLine` in the context value,
  and `fixed` and `removeLabel` in `lineEdges`. `chromeTile` then depends on `tabs?.length` alone.
  Keep Connect mode's hover colour (`hoverLine`, `holdHover`, `releaseHover`,
  `onEdgeMouseEnter`/`Leave`, `linked`), but stop putting `holdHover`/`releaseHover` in the context
  and `hovered` in a line's data. Update the header comment's two sentences about the red X.
- `src/react/TileChrome.tsx`: delete `remove` from `ChromeProps`, the `RemoveButton` block and its
  import, and the comment's sentence about the X.
- `src/react/BoardLine.tsx`: delete the `RemoveButton` block and import, `REMOVE_SIZE`,
  `REMOVE_GAP`, `withX`, `remove`, `removeLine`, the `holdHover`/`releaseHover` reads, the
  `ownStretchMidpoint` import, and `hovered`, `fixed` and `removeLabel` in `BoardLineData`. Update
  the header comment.
- `src/react/context.ts`: delete `removeLine`, `holdHover` and `releaseHover`.
- Delete `src/react/RemoveButton.tsx` and its export line in `src/react/index.ts`.
- `src/react/board.css`: delete every rule whose selector contains `.board-remove` (keep the
  `--board-remove` variables: the removal panel's dashed outline uses them).
- `src/react/board.test.tsx`: delete the assertions and tests that find or click a button named
  `Remove …` (they assert the behaviour this unit removes; the test `shows a line's X while the
  pointer is on it in connect mode, never on a fixed line` goes entirely). Add two tests: a
  right-click (`fireEvent.contextMenu`) on a tile calls `onTileMenu` with its ID; one on a line
  calls `onLineMenu` with that line's ID.

**2. `jeeves/apps/web`.**

- New `src/canvas/CanvasMenu.tsx`: a Mantine `Menu`, `opened`, anchored on a 1px `position: fixed`
  element at the pointer, as automation-pitch does in `src/board/controls/PathContextMenu.tsx`
  (`~/github/automation-pitch`). Props: `at`, `title`, `items: { label: string; onPick: () => void
  }[]`, `onClose`. `Menu.Label` holds the title; each item is a `Menu.Item` with `IconTrash`,
  coloured with `--off-ink` on `--off-bg` (add those two tokens to `tokens.css`, both themes). It
  closes on a pick, a press elsewhere and Escape.
- `src/canvas/Workspace.tsx`: hold the open menu in state and render `CanvasMenu`. Build the items
  from the table above. Close the menu whenever the selection or the design's revision changes.
  Update the header comment ("the red X on a tile or line removes it").
- `src/canvas/removal.tsx`: its `Removal` type no longer picks from `BoardProps`; declare
  `removable`, `onRemoveTile`, `onRemoveLine` and `hud` itself. Behaviour unchanged.
- `src/canvas/LaneCanvas.tsx`: take `onTileMenu` and `onLineMenu` props and pass the board's to
  them; for a line, pass the canonical relationship (`canonical(line)`) and, in the Detailed view,
  that drawn line's `disconnect` if it has one. Pass only `hud` from `removal` to `Board`. Delete
  `unlinks`, the `removeLabel` mapping in `boardLines` and the `onRemoveLine` wrapper.
- `src/canvas/tiles/ContainerTile.tsx`: `ModuleRowsState.onDisconnect` becomes `onLoaderMenu?:
  (link: string, label: string, at: { x: number; y: number }) => void`. The loader arrow's `<div
  className="lane-container-loader">` gets an `onContextMenu` that prevents the default, stops
  propagation and calls it. Delete the `RemoveButton` and its import.
- `src/canvas/canvas.css`: delete the `.lane-container-loader-remove` rules.
- `src/canvas/tiles/ContainerTile.test.tsx`: replace the loader X assertions with one that a
  right-click on the arrow calls `onLoaderMenu` with the link's ID.

**3. E2E.** Add to `jeeves/apps/web/e2e/studio.ts`:

```ts
/** Right-clicks a tile, line or loader arrow and picks an item of the menu that opens. */
export async function pickFromMenu(page: Page, target: Locator, item: string | RegExp) {
  await target.click({ button: "right" });
  await page.getByRole("menuitem", { name: item }).click();
}
```

List every use of the X with
`grep -n "Remove \|Disconnect \|board-remove\|loader-remove" jeeves/apps/web/e2e/*.ts`
(nine specs: `canvas`, `connect`, `detailed-view`, `edit-history`, `inspector`, `modules`,
`ownership`, `relationship-tracing`, `remove`). Replace each click on a board X with `pickFromMenu`
on the tile or line it belonged to and the item from the table. Leave clicks on **Remove N tiles**,
**Remove relationship**, **Remove module** and **Cancel** alone: those buttons stay. Replace an
assertion that an X is visible or hidden with the same assertion about the menu item after a
right-click.

**Docs.** `docs/studio.md`: every sentence that says the red X removes or disconnects something
(`grep -n "red X\| X \|its X" docs/studio.md`) now says right-click. `jeeves/CATALOG.md` likewise.

**Mouse check.** On TinyURL, in each view: right-click Click events → **Remove tile** → the panel
lists the Analytics worker → **Remove 2 tiles** → Undo. Right-click a line → **Remove link** → Undo.
In Detailed, right-click a module's line → its Disconnect item → Undo. Right-click the User: no
menu. `page.locator(".board-remove")` has count 0 throughout. Compare with
`preview/top-bar-light.png` and `-dark.png`.

### UI03 — Export and Generate move to the top bar (D8)

**Goal.** The header reads, left to right: Jeeves, Design | Settings, **Export diagram**, then on
the right Undo, Redo, the chat and inspector toggles, **Generate project**, the project menu. The
canvas toolbar keeps Pointer, Connect, Fit and Detailed | Simple.

**Steps.** In `jeeves/apps/web/src/canvas/Workspace.tsx`, move the two buttons out of
`.studio-tools` into the `header` element that is portalled to `#studio-header-controls`. That
element becomes two groups: a left one holding Export diagram, and the existing
`.studio-header-actions` holding the four icon buttons and then Generate project. Keep each
button's `title`, `disabled` rule, `onClick`, text and the class `diagram-export-trigger`. In
`src/studio/studio.css`: Export diagram takes the header button look (`.studio-header-actions
button`); Generate project is `background: var(--yellow)`, `color: var(--on-yellow)`, a 2px
`--on-yellow` border, weight 900 and `box-shadow: 0 3px 0 var(--btn-shadow)`. Both buttons show
only on the Design tab (they render inside the portal, which exists only there). Below 1100px of
window width the Export diagram label hides and its icon stays, with the label as `aria-label`.

**E2E.** `grep -n "Canvas tools\|studio-tools" jeeves/apps/web/e2e/*.ts`: a locator that looks for
either button inside the toolbar now looks in the header (`page.getByRole("banner")`).

**Docs.** `docs/studio.md`: where it lists the canvas toolbar's buttons and where it says how to
open Export diagram or Generate project.

**Mouse check.** Both buttons open their dialogs from the header at both sizes; neither is in the
canvas toolbar; on the Settings tab neither shows. Compare with `preview/top-bar-*.png`.

### UI04 — Tile colours (D3)

**Goal.** As `preview/tiles-light.png` and `tiles-dark.png`.

**Steps.**

1. `jeeves/apps/web/src/theme/tokens.css`: add `--cap-host`, `--cap-plain`, `--user-fill`,
   `--user-ink`, `--action-fill`, `--action-ink` and `--row-line` to the light and the dark block.
2. `src/canvas/tiles/Tile.tsx`: a new prop `host?: boolean` (the tile can take modules). The icon
   sits in a new `<span className="lane-tile-cap" data-host={host || undefined}>`: full width, 56px
   tall, the icon (36px) centred, `background: var(--cap-plain)`, or `var(--cap-host)` with
   `data-host`, and a 2px `--row-line` bottom border. `.lane-tile` loses its top padding; the name
   has 6px above it; the kind label stays pinned to the bottom. The selected tile's `+` and the
   warning mark keep their corners, over the band.
3. `src/canvas/LaneCanvas.tsx`: pass `host` to `Tile`: `moduleKinds(design, id).length > 0`.
4. `src/canvas/tiles/ContainerTile.tsx` and `canvas.css`: `.lane-container-header` gets
   `background: var(--cap-host)` when the container is `addable`, else `var(--cap-plain)`, and a 2px
   `--row-line` bottom border. `.lane-container-row`'s border is `1.5px solid var(--row-line)`.
5. `canvas.css`: `.lane-actor` uses `--user-fill`, and the figure `--user-ink` (pass it from
   `ActorTile.tsx` in place of `--figure-ink`); its name plate's border is `1.5px solid
   var(--user-ink)`. `.lane-action` uses `--action-fill`; its word `--action-ink`; its badge is
   `--ic-fill` with a 2px `--action-ink` border and an `--action-ink` icon. Delete `--actor-fill`
   and `--figure-ink` once nothing reads them (`grep -rn "actor-fill\|figure-ink"
   jeeves/apps/web/src`), including in the link fan's action items.
6. The kind label on a band-less background keeps its colour; on a container header it is
   `color-mix(in srgb, var(--board-ink) 72%, var(--cap-host))` (text may mix; fills may not).

**Tests.** `Tile` and `ContainerTile` unit tests: `data-host` is set for a Service and absent for a
Database.

**Docs.** `docs/studio.md`: the sentences that describe a tile's face, the user and the actions.

**Mouse check.** TinyURL in both views and both themes, compared with the preview. A diagram export
preview (Export diagram) shows the same bands and colours.

### UI05 — One icon set (D4)

**Goal.** Every tile kind and module kind draws one of the 30 glyphs in
`assets/studio-glyphs.ts.txt`, as `preview/icons-light.png` and `icons-dark.png`.

**Steps.**

1. Copy `docs/plans/ui-refresh/assets/studio-glyphs.ts.txt` to
   `jeeves/apps/web/src/studio/studio-glyphs.ts` and run `pnpm format`.
2. `src/studio/StudioIcon.tsx`: keep its signature (`name`, `size`). For a name in `STUDIO_GLYPHS`
   it renders `<svg className="studio-icon" width={size} height={size} viewBox="0 0 24 24"
   aria-hidden>` holding the glyph's markup, the way `canvas/tiles/HumanFigure.tsx` renders its
   bundled artwork (a `<g dangerouslySetInnerHTML>` with the same `biome-ignore` reason: static
   artwork bundled with the app). An unknown name still falls back to Tabler's `IconBox`, and no
   name to `IconQuestionMark`. Delete the Tabler imports it no longer uses.
3. New `src/studio/studio-icon.css`, imported by `StudioIcon.tsx`: the eleven `.ic …` rules of the
   preview source, with `.studio-icon` in place of `.ic`. Add `--ic-ink` and `--ic-fill` to both
   blocks of `tokens.css`, and `--fam` to every `[data-family]` rule there (light and dark, the
   table in Shared values).
4. Rename the icon names in `jeeves/packages/spec`:

   | In `studio-definitions.ts` (`visual.icon`) | New name |
   | --- | --- |
   | service `server`, browser `browser`, cache `bolt`, external-api `plug` | unchanged |
   | worker `cpu` | `gear` |
   | billing `credit-card` | `card` |
   | redirect `route` | `turn` |
   | notification `mail` | `bell` |
   | identity `lock` | `key` |
   | uploads `cloud-upload` | `cloud-up` |
   | gateway `arrows-split` | `fork` |
   | database `database` | `cylinder` |
   | queue `list` | `channel` |
   | object-store `archive` | `bucket` |
   | search `search` | `magnifier` |
   | cdn `world` | `globe` |

   | In `studio-modules.ts` (`studioComponentVisuals`) | New name |
   | --- | --- |
   | cache-reader `bolt`, custom `puzzle`, favorites `star` | unchanged |
   | rate-limiter `shield` | `gauge` |
   | id-generator `repeat` | `hash` |
   | redirect-responder `route` | `turn` |
   | event-publisher `plug-connected` | `megaphone` |
   | event-consumer `plug` | `inbox` |
   | data-access `database` | `cylinder` |
   | auth-guard `lock` | `shield` |
   | external-call `world` | `box-out` |
   | multipart-uploads `cloud-upload` | `cloud-up` |
   | lifecycle-writer `progress-check` | `pie` |
   | video-encoder `movie` | `play` |
   | video-packager `stack-2` | `parcel` |
   | video-thumbnailer `photo` | `picture` |
   | event-counter `sum` | `counter` |
   | index-writer `list-search` | `index-card` |
   | search-query `search` | `magnifier` |

   Colour families are unchanged. If any test, blueprint output or chat tool output contains an
   icon name (`grep -rn "arrows-split\|plug-connected\|progress-check\|list-search"
   jeeves jeeves-generator --include=*.ts --include=*.tsx --include=*.json -l`), stop as in rule 2
   unless it is a web unit test or `jeeves/CATALOG.md`.
5. An icon takes the colour family of the nearest element with `data-family`. Wherever an icon is
   drawn today that element already exists (`.lane-tile`, `.lane-container`, `.lane-container-row`,
   module cards, menu items, the inspector's title). Remove `color: var(--type-color)` from the
   wrappers that only coloured a Tabler icon (`.lane-tile-icon`, `.lane-container-icon`,
   `.lane-container-row-icon`, `.lane-module-icon`, `.lane-module-menu-icon`, `.lane-fan-icon`).
   `LaneIcon` (Consume and Produce) and the toolbar's icons stay Tabler.

**Tests.** `StudioIcon.test.tsx`: every `visual.icon` and every `studioComponentVisuals` icon is a
key of `STUDIO_GLYPHS`; a known name renders `.studio-icon`; an unknown name the fallback.

**Docs.** `jeeves/CATALOG.md`: the icon column of the kinds and module tables.

**Mouse check.** A project holding every kind (the e2e helper that creates each of the eleven kinds,
plus YouTube for the module kinds): each tile and module row shows its glyph at 36px, 22px and 16px
in both themes, with no white outline in dark. Compare with `preview/icons-*.png`.

### UI06 — Module menu, module cards and plain words (D5, D6)

**Goal.** As `preview/module-menu-light.png` and `-dark.png`, and the module cards in
`preview/inspector-*.png`.

**Steps.**

1. `jeeves/apps/web/src/studio/module-status.ts` owns the studio's words. Add:

   ```ts
   /** What each generation means, in the studio's words (D6). The spec keeps Template and Stub. */
   export const generationWords = {
     lead: { word: "Generated", meaning: "Jeeves writes working code; you fill in one short hooks file." },
     part: { word: "Building block", meaning: "Generated once a Generated module is connected to it. Until then, you write it." },
     stub: { word: "You write it", meaning: "An empty, typed file for your own code." },
   } as const;
   ```

   `moduleStatusLine` returns "Generated" for `template`, "You write it" for `stub` and `custom`,
   and "Refused" for `refused`; its details are unchanged.
2. New `src/studio/module-groups.ts`: the five groups, in this order, each with its colour family
   and its module kinds; within a group, catalog order (`studioComponentKinds`).

   | Group | Family | Module kinds |
   | --- | --- | --- |
   | Requests | `api` | `auth-guard`, `rate-limiter`, `redirect-responder`, `external-call` |
   | Data | `data` | `data-access`, `cache-reader`, `search-query`, `favorites`, `id-generator`, `index-writer`, `event-counter`, `lifecycle-writer` |
   | Events | `messaging` | `event-publisher`, `event-consumer` |
   | Files & media | `worker` | `multipart-uploads`, `video-encoder`, `video-packager`, `video-thumbnailer` |
   | Custom | `generic` | `custom` |

   A unit test asserts every `StudioComponentKind` is in exactly one group.
3. `src/canvas/ModuleMenu.tsx`: `moduleMenuGroups` returns these groups (those with at least one
   allowed kind), each item carrying its `generation`. The menu draws, per group, a heading (a
   small square in `--fam`, the group's name) and its cards two to a row. A card has
   `data-family` = its **group's** family, `background: var(--sfam)`, a `1.5px solid var(--fam)`
   border; first row the name (15px, weight 900) and, at the right, the generation dot; second row
   the 15px icon and the description on one line, cut with an ellipsis. The dot is 13px round with
   a 2px `--plus` border on `--badge`: full `--plus` for `lead`, the left half `--plus` for `part`,
   empty with an `--ink-soft` border for `stub`; its `title` is the word. Under the last group, a
   three-line legend: dot, **word.** meaning. Each item's accessible description becomes "`<word>`.
   `<description>`". Delete the Template / Part of a template / Stub headings and their CSS. The
   menu's placement, focus and closing rules are unchanged.
4. `src/canvas/TileInspector.tsx`, `ModuleCards`: the same card (group family, solid fill, name
   first), with the dot **and its word** in a small `--badge` pill at the right, then the kind name
   and the description on the second row. The generation comes from `moduleGeneration(kind,
   hostKind)`.
5. The module page (`ComponentForm` in `src/studio/InspectorForm.tsx`) shows `moduleStatusLine`'s
   new words; nothing else on it changes.
6. Add `--badge` and `--hairline` to `tokens.css` and `--sfam` to every `[data-family]` rule.

**Tests.** Update `ModuleMenu.test.tsx` and `module-status.test.ts` to the new groups and words.
E2E: `grep -n "Template\|Part of a template\|Stub" jeeves/apps/web/e2e/*.ts`; each match that reads
the menu, a module card or the module page takes the new word; a match that reads chat or a
generation dialog stays.

**Docs.** `docs/studio.md` (Adding a module, the module page, the table of what generates where),
`jeeves/CATALOG.md` (the module menu), and one row in `docs/glossary.md`: "Generated, Building
block, You write it: the studio's words for a module that leads a template, is part of one, or is a
stub."

**Mouse check.** On YouTube v3's Watch API and on a Worker: the menu's groups, dots and legend in
both themes; adding a module from each group still works; the inspector's cards and the module
page read the new words. Compare with the preview.

### UI07 — The inspector lists connections, with Back (D7)

**Goal.** As `preview/inspector-light.png` and `-dark.png`.

**Steps.**

1. `jeeves/apps/web/src/canvas/Workspace.tsx`: a `trail` of tile IDs beside `pick`. A new `jump(to:
   string)` pushes the selected tile onto the trail and selects `to`. `back()` pops the trail and
   selects that tile. Every other selection (a click on the board, a module row, a warning, chat,
   clearing) empties the trail. When IDs are re-keyed, the trail's IDs follow as the selection's do;
   an ID that no longer names a tile is dropped. The trail is view state: it never reaches the
   design or chat.
2. A tile's page (`TileInspector.tsx`, through `TargetInspector` in `src/studio/InspectorForm.tsx`)
   gets a **Connections** section directly above **Modules**, shown when the tile has any line. One
   row per line of `graph.edges` that ends or starts at the tile, incoming first: a small **From**
   or **To**, the other end's icon, its name, its kind label, and one word at the right. The word
   comes from the blueprint (`designBlueprint(design, name).connections`, memoised per design):
   `write` → writes, `read` → reads, `publish` → publishes, `consume` → consumes; anything else →
   calls. A row is a button (`--control` fill, `--control-line` border; add both tokens); a click
   calls `jump`. The same section goes on an action's page (`ActionInspector`).
3. While the trail is not empty, the inspector's first element is a Back button naming the tile it
   returns to, drawn as `.lane-inspector-back` already is on a module page. On a module page the
   module's own Back (to its tile) stays, below it.
4. A connection's page shows its two ends as the two buttons `EntryPath` already draws for an
   entry, in place of the plain "A → B" text.

**Tests.** `selection.test.ts`: the trail follows a rename and drops a removed tile (put the two
pure functions in `selection.ts`). A component test: a click on a connection row calls `jump` with
the other tile's ID.

**Docs.** `docs/studio.md`, the inspector section.

**Mouse check.** TinyURL: select Shorten service → Connections lists Shorten (From) and URL database
(To, writes) → click URL database: the board selects it, the inspector shows it with **Back to
Shorten service** → Back. Click another tile on the board: the Back button is gone. Both themes.

---

## Phase C — Providers and chat

Rules for this phase: no test or check calls a real provider, opens a browser login or needs the
network. Inject `fetch`, `spawn` and the clock. Keys are never returned by the API, logged, or
shown after saving.

### UI08 — API keys in Settings (D9)

**Goal.** Connections on the Settings page is one card per provider, as
`preview/settings-light.png` and `-dark.png`, and an OpenAI or Anthropic key can be saved, replaced
and removed there.

**Steps.**

1. `jeeves/packages/providers/src/catalog.ts`: Anthropic's `auth` becomes `{ type: "api-key",
   envVar: "ANTHROPIC_API_KEY", configKey: "anthropic" }`; delete the `env-key` variant if nothing
   else uses it; its description ends "billed to your Anthropic API key."
2. `jeeves/apps/server/src/settings.ts`: the config file may hold `anthropic.apiKey`.
   `anthropicKey()` returns `{ key, source }` like `openaiKey()` (the environment wins). Add
   `setKey(id: "openai" | "anthropic", key: string)` and `removeKey(id)`, which write only that key
   and keep the rest of the file. `ProviderStatus` gains `keySource: "env" | "file" | null`. Status
   texts: "Key set in the environment" (`env`), "Key saved" (`file`), "No key".
3. `src/routes/settings.ts`: `PUT /settings/providers/:id/key` with body `{ key }` (trimmed, 8 to
   400 characters) and `DELETE /settings/providers/:id/key`. Both answer with `settings.view()`. A
   provider without a key (`codex`) answers 422 `KEY_NOT_SUPPORTED`; an unknown one 404.
4. `src/chat/models.ts`: Anthropic reads `settings.anthropicKey()?.key`; its error text says "Add
   one in Settings".
5. `jeeves/apps/web/src/project/api.ts` and `src/settings/SettingsView.tsx`: each provider is a
   card: its name, a status pill (`--ok-bg`/`--ok-ink` or `--off-bg`/`--off-ink`; add the four
   tokens), one line of help, then: with no key, a Mantine `PasswordInput` and **Save key**; with a
   saved key, "Saved" and **Replace** and **Remove**; with a key from the environment, the text "Set
   by `<ENV VAR>` in the environment" and no buttons. Codex's card keeps its copy-the-command row
   until UI09. The Models card stays until UI11. The field is emptied after a save and never
   refilled.

**Tests.** `src/routes/settings.test.ts`: save, replace and remove for each provider; the file is
written with mode `0600`; no response body and no log line contains the key; the environment wins;
422 and 404. `chat` tests that build `Settings` keep passing.

**Docs.** `docs/studio.md` (Settings), `jeeves/README.md` and `docs/glossary.md` wherever they say
the Anthropic key is read from the environment only.

**Mouse check.** With the e2e server (its `JEEVES_HOME` is a throwaway directory): save a made-up
key for Anthropic → the pill reads Key saved → Replace → Remove. Both themes.

### UI09 — Sign in with ChatGPT (D9)

**Goal.** Codex's card has **Sign in with ChatGPT** and **Sign out**; nobody types `codex login`.

**Steps.**

1. New `jeeves/apps/server/src/codex-login.ts`: `createCodexLogin({ codexPath, spawn, env })`.
   `start()` spawns `<codexPath> login` (the same `codexPath` `main.ts` gives `providerModels`, else
   `codex`), reads its output for up to 10 seconds and resolves with the first `https://` URL it
   prints, if any; the process keeps running until it exits or 10 minutes pass, then it is killed.
   A second `start()` while one runs returns the same state. `state()` is `idle`, `waiting` (with
   the URL) or `failed` (with the last output line). `signOut()` runs `<codexPath> logout`. Jeeves
   never reads Codex's credentials.
2. Routes: `POST /settings/codex/login` → `{ state, url? }`; `GET /settings/codex/login` → the
   state; `POST /settings/codex/logout` → `settings.view()`. `settings.view()` already reports
   whether Codex is signed in.
3. Web: the card shows **Sign in with ChatGPT** when signed out. A click starts the login, shows
   "Finish signing in in your browser" with the URL as a link when there is one, and asks `GET
   /settings` every 2 seconds until Codex is signed in or the state is `failed` (then it shows the
   message and the fallback text "or run `codex login` in a terminal"). Signed in, the card shows
   **Sign out**.

**Tests.** With a fake `spawn`: the URL is found in stdout or stderr; no URL still returns
`waiting`; a non-zero exit gives `failed`; the timeout kills the process; `signOut` runs `logout`.
No test runs `codex`.

**Docs.** `docs/studio.md` (Settings).

**Mouse check.** None with a real login. With the e2e server, where Codex is not signed in: the
button shows, and a click shows either the waiting text or the failure text without a page error.
Record in the handoff that the real sign-in is for the owner to try.

### UI10 — A custom endpoint (D9)

**Goal.** A fourth provider, **Custom endpoint**: a name, a base URL and a key for an
OpenAI-compatible host, usable by the design chat.

**Steps.**

1. Add `ai` and `@ai-sdk/openai-compatible` to `jeeves/packages/providers`, each pinned to its
   newest release that is at least two weeks old (`AGENTS.md`). Record both versions in the
   handoff.
2. New `packages/providers/src/compatible.ts`: `createCompatibleProvider({ name, baseURL, apiKey,
   fetch? })`, a `ModelProvider` with ID `custom` built on the AI SDK's OpenAI-compatible provider.
   It is stateless like the others. Mapping: `instructions` is the system prompt; a user `message`
   is a user message; consecutive assistant `message` and `tool-call` items are one assistant
   message; a `tool-result` is a tool message for its call; `opaque` items of any provider are
   dropped. Tools are passed with their JSON Schemas and no executor, so the SDK returns the calls
   and never runs them. The response gives `text`, `toolCalls` (arguments as a JSON string),
   `items`, `usage` (input, output and cached input tokens where reported, else `null`) and `stop`
   (`tool-calls`, `max-tokens`, else `end`). Text streams through `onEvent`. Failures become
   `ProviderError`s with the kinds `errors.ts` already has. Capabilities: tools, streaming and
   usage true; image input false. Check each SDK name against the installed package's types.
3. `catalog.ts`: `ProviderId` gains `custom`, with `auth: { type: "endpoint" }`, no suggested
   models and `defaultModelAllowed: false`. `settings.ts`: the config file may hold `custom: {
   name, baseUrl, apiKey }`; `PUT /settings/custom` saves all three (the URL must be `https://`, or
   `http://` on a loopback host); `DELETE /settings/custom` removes them; the status is "`<name>` ·
   key saved" or "Not set up". `chat/models.ts` builds the provider from them.
4. Web: a **Custom endpoint** card: a name, the base URL, a key field, **Save** and **Remove**.
   (UI11 adds the list of known hosts.)

**Tests.** `compatible.test.ts` with a fake `fetch` replaying recorded chat-completion bodies: a
text reply, a streamed reply, a tool call and its follow-up round, usage, a 401 and a 429. Settings
tests for the new routes and the URL rule.

**Docs.** `docs/studio.md` (Settings), `jeeves/PLAN.md` where it lists the providers.

**Mouse check.** Save a made-up endpoint → the card reads its name → Remove. No model call. Record
in the handoff that a live turn needs the owner's key and go-ahead, and that a host which requires
its reasoning text to be sent back with tool results is a known limit.

### UI11 — The model catalogue and the picker in chat (D11)

**Goal.** The composer has a model button that opens every connected provider's models, as
`preview/chat-light.png` and `-dark.png`. Settings loses its Models card.

**Steps.**

1. New `jeeves/apps/server/src/model-catalog.ts`: `createModelCatalog({ home, fetch, now })`. It
   reads `https://models.dev/api.json` at most once every 24 hours, with a 5-second timeout, and
   keeps the reply in `<JEEVES_HOME>/models-dev.json`. Offline, it uses that file; with no file, an
   empty catalogue. It never fetches when the server replays a scripted model
   (`JEEVES_FAKE_MODEL_SCRIPT`). From each models.dev model it keeps `id`, `name`, `limit.context`,
   `cost.input`, `cost.output` and `tool_call`.
2. `GET /models` → `{ selected: { provider, model }, providers: [{ id, name, ready, status,
   models: [{ id, name, contextWindow, inputPrice, outputPrice }] }] }`, numbers or `null`. Per
   provider: OpenAI and Anthropic list the models.dev models of `openai` and `anthropic` that take
   tools, newest first, at most 12, plus `suggestedModels` and the selected model. Codex lists the
   models in `~/.codex/models_cache.json` whose `visibility` is `list` (`slug`, `display_name`,
   `context_window`) when that file can be read, else `suggestedModels`. The custom endpoint lists
   the models of the models.dev provider whose `api` equals its base URL, else none (the picker
   then offers a text field).
3. Web: new `src/chat/ModelPicker.tsx`, a Mantine `Menu` opened by a button in the composer's
   action row showing a status dot, the model's name and its provider. One section per provider:
   its name and status; each model with its context size (`500k`, `1M`) and its prices per million
   tokens where known; the selected one on `--yellow`. A provider that is not ready shows one
   disabled row, "Connect it in Settings". A pick saves through `PUT /settings/roles` and applies
   to the next message. Delete the Models card and its code from `SettingsView.tsx`; the custom
   endpoint card gains a list of known hosts (the models.dev providers that have an `api`), which
   fills the name and URL.

**Tests.** `model-catalog.test.ts` with a fake `fetch` and clock: one fetch a day, the cache file,
offline, a malformed reply. Route tests for each provider's list. `chat/store` or a component test:
a pick calls the roles endpoint.

**Docs.** `docs/studio.md` (Chat, Settings), `docs/studio-settings.md` if it describes the model
choice.

**Mouse check.** With the e2e server (scripted model, no fetch): the button shows the scripted
model; the menu opens and lists providers with their status; Settings has no Models card. Both
themes.

### UI12 — Usage chips in chat (D11)

**Goal.** As `preview/chat-light.png`: small counts under each reply, and one panel above the
composer.

**Steps.**

1. Server, `chat/service.ts` and `db/schema.ts` (`ChatUsage`): a turn's usage gains
   `contextTokens`: the input plus output tokens of the turn's **last** model response, when that
   response reported usage. No migration: the column is JSON.
2. Web, `ChatPanel.tsx`: the `Usage` paragraph becomes chips (Mantine `Badge`, `--control` fill,
   `--control-line` border): **in**, **cached** (when reported) and **out**, as `41.2k`. Above the
   composer, a panel on `--well` (add the token): a ring and **Context** `<used> / <window>`, where
   used is the newest turn's `contextTokens` and the window is the selected model's `contextWindow`
   from `GET /models` (the ring and the window are left out when either is unknown); then the
   conversation's totals **in** and **out**; then the cost, only when every turn reported one. The
   panel is hidden until a turn has usage.

**Tests.** A service test: `contextTokens` is the last response's, not the sum. `ChatPanel` tests:
the chips' numbers and each hidden case.

**Docs.** `docs/studio.md` (Chat).

**Mouse check.** With the scripted model, which reports no usage, the panel is absent and no chip
shows; record that. Unit tests cover the shown case.

---

## Phase D — Dark mode

### UI13 — Dark mode (D12)

**Goal.** Every screen in the dark theme matches the preview's dark images: surfaces separate,
controls are steel not grey, no white icon outline, no see-through fill.

**Steps.**

1. `tokens.css`, dark block: `--chrome: #071219`, `--chrome-well: #03090d`, `--chrome-line:
   #3db8d9`, `--paper: #0f1d26`, `--cream: #213a48`, `--chrome-btn: #213a48`, `--ink: #eaf5fa`,
   `--ink-soft: #a8c5d2`, `--line: #7ea8bc`, `--yellow: #e6bb4a`, `--plus: #46b877`, `--minus:
   #ee7b6f`, `--grid-dot: #27414f`. Add `--panel` to both blocks.
2. Rails, menus, popovers, the canvas toolbar, the legend and dialogs use `--panel`; tiles, cards
   and module rows keep `--cream` and `--paper`. (`grep -rn "var(--cream)" jeeves/apps/web/src`
   lists the uses; decide each by this rule.)
3. `src/theme/mantineTheme.ts`: add `colors.dark`, lightest first: `#eaf5fa`, `#c9dde7`,
   `#a8c5d2`, `#7ea8bc`, `#3d5d6d`, `#2a4554`, `#172a35`, `#0f1d26`, `#0b161d`, `#071219`. Give
   `Input`'s `input` the styles `backgroundColor: var(--control)` and `borderColor:
   var(--control-line)` so text boxes read as inset in both themes.
4. Sweep every stylesheet under `jeeves/apps/web/src` and `jeeves/packages/board/src/react` for
   fills made by mixing (`grep -rn "color-mix" …`). A background or border that mixes a colour
   with `transparent`, `--paper`, `--cream` or `--panel` to tint it becomes a solid token (`--sfam`,
   `--ok-bg`, `--off-bg`, `--row-line`, `--hairline`, `--well`). Text colours may keep their mixes.
   List what you changed.
5. Delete the dark overrides that the new tokens make redundant, and the unused `.readiness-*`
   rules in `studio.css`.

**Mouse check.** In the dark theme at both sizes: the Design tab on TinyURL (Detailed and Simple),
the module menu, a tile's inspector with its connections and module cards, the right-click menu,
the removal panel, New project, Export diagram, Generate project, Chat with the model menu open,
and Settings. Then the same list in the light theme, to confirm nothing light changed except text
boxes. Compare each with its preview image. Take the screenshots this unit needs even if that is
more than six.

---

## Phase E — Review

### UI14 — Independent review

**Goal.** Find what the units got wrong between them. Fix small defects; record the rest.

**Steps.** Read every UI handoff entry and the combined diff since this plan's commit. Then:

1. A ledger of every "Noticed" and "For the next unit" line: dealt with, or still open.
2. Check each decision D1–D13 against the running app in both themes at both sizes, and each
   preview image against a fresh screenshot. Check that no red X, no Template / Part of a template /
   Stub wording in the studio's own text, no literal colour outside `tokens.css` and no legacy kind
   in a built-in study remains.
3. Check the seams: the right-click menu on a tile whose inspector trail is open; the icon set in
   the diagram export; the model picker after a provider's key is removed; dark mode on every
   dialog UI08–UI12 added; keys absent from every response, log line and screenshot.
4. Fix a defect only with a test that fails before and passes after. No renames, no refactors, no
   rewording of docs that are true. Record larger findings as follow-ups in
   `docs/plans/ui-refresh/review.md`.
5. Point `AGENTS.md`'s "active plan" sentence at whatever the owner names next, or leave it and say
   so.

Run all four checks before and after.
