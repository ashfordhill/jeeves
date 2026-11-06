# Design polish units

**Status: approved 2026-11-05, not started.** DP01–DP07 are approved as written. DP08 and DP09
(the Etsy and YouTube studies) wait on the owner's answers listed under them.

The owner reviewed the lane canvas after PL02 (2026-11-05) and decided the following:

- `+` only creates.
- A separate link tool attaches two existing tiles, in either direction.
- The fan offers the same seven tile types on both sides.
- "Both" lane entries go.
- Service and API types become clearly labelled, preconfigured choices with two languages each.
- TinyURL is rebuilt from published designs.

There are nine units, run in order: DP01 → DP09. A fresh agent runs one unit at a time on primary
`main`.

## Why this matters

Jeeves exists to bring cohesion to designing large software systems with AI, while keeping the
human developers able to follow what is going on at a high level. Every tile, setting and link on
the canvas will feed a template in a future code generator. The developer then joins those
templates together and writes the rest. The rough aim is 60–80% of the code coming from templates,
with the rest specific to the implementation; that range is a guide, not a target. So every option
added to the canvas should:

- map to something a generator could plausibly produce (a ready-made backend it deploys and
  configures, or a generated service skeleton);
- be understandable at a glance by someone who did not draw the diagram;
- stay at diagram level. Algorithms, hashing, cleanup jobs and similar choices belong to the
  developer after generation (owner, 2026-11-05).

One project is one self-contained system. A product with several complex features is several
Jeeves projects with little cross-talk.

## Rules for every unit

The [lane-grid rules](../lane-grid/execution-units.md#rules-for-every-unit) apply, with two changes:

- Port from automation-illustrator only where a unit says so.
- Commit as `DPnn: <summary>`.

In short:

- Read AGENTS.md, the latest handoff entries and this plan. Do only your unit.
- `packages/board` imports no Jeeves code.
- Tests: a few focused unit tests for rules that are costly to get wrong.
- Checks: `pnpm check`, `pnpm test:e2e` (or `:docker`), `pnpm --filter @jeeves/web build`, and a
  browser check by mouse.
- Keep the docs current.
- Append a handoff entry, then make one commit with only your changes. Leave `.jeeves-feedback/`
  alone.
- Use Node 24 (`~/.nvm/versions/node/v24.21.0/bin` first in PATH); the default `node` is 18.

---

## DP01 — Lines line up on the grid

Where a tile has two predecessors, its lines have small jogs. The owner circled two in TinyURL:

- Redirect service → Link cache
- Shorten API → Links database

Measured with real ELK on the current TinyURL input:

| Tile | Centre y |
| --- | --- |
| Redirect | 248 |
| Link cache | 256 |
| Shorten API | 488 |
| Links database | 496 |

ELK's balanced node placement centres a merge target between its predecessors, and
`toBoardLayout` only rounds ELK's numbers. Tile tops therefore sit off the 32px grid (y mod 32 is
8, 16 or 24) even though the docs say the board is on it. automation-illustrator has the same gap,
but its boards rarely merge into one tile.

**Read:**

- `packages/board/src/layout/elkGraph.ts`, `elkLayout.ts`, `engine.ts`, `metrics.ts`,
  `layout.test.ts`
- `packages/board/src/react/useBoardLayout.ts` and `Board.tsx`: how positions, routes and chips
  are used, and how shown positions become stability hints
- `apps/web/src/canvas/LaneCanvas.tsx`: tile and chip sizes. The user tile is 128×160; other tiles
  are 128×128; entry chips are 32×32.

**Do:** add a pure alignment step after ELK (for example `alignLayout(layout, input)`, run before
the layout is cached). It follows these rules:

1. **Ports on grid lines.** Every tile's top-left sits on the 32px grid. The only exception is a
   tile whose half-height is not a multiple of 32 (the 160px user): that tile's centre sits on a
   grid line instead. Every port (mid-height, left and right) then sits on a grid line.
2. **Near-straight lines become straight.** When a tile's input port is within 16px of one of its
   predecessors' output ports, the two share the row exactly. If several predecessors qualify,
   choose deterministically, for example the one whose line is otherwise straight, then input
   order.
3. **Columns keep their order and gaps.** Tiles in one column keep their top-to-bottom order, with
   at least `BRANCH_GAP` between them. Moving one tile down pushes the tiles below it.
4. **Routes follow the tiles.** A route's first horizontal run takes its source port's y, and its
   last horizontal run takes its target port's y. Vertical bus segments keep their x. If a route
   was straight and its ends now differ, give it a bend on a grid column between the tiles. Chips
   move with the run they sit on. Bounds grow if needed.

**Acceptance (unit-tested with real ELK, as `layout.test.ts` already does):**

- On the current TinyURL input, no route has a vertical segment shorter than 32px.
- Every tile's top is on the grid, except the user, whose centre is.
- Redirect → Link cache and Shorten API → Links database are straight.
- The animation and stability hints still work: an edit moves only what it changes.

Not in scope: ELK option changes (try them only if the post-pass can't meet the rules, and say so
in the handoff); changes to automation-illustrator. Note the gap there in the handoff for when the
board is shared.

**Browser:** TinyURL at the fitted zoom and at 150%. Screenshot the two places the owner circled.
Then build a merge from **Blank architecture**: two services that both link to one database.
**Docs:** the studio guide's Layout section, describing what is now true.
**Commit:** `DP01: lines line up on the grid`

## DP02 — Remove both-lane entries

Owner: remove "both". Each lane entry is in the download or the upload lane, and a tile has at
most one entry.

**Read:** the PL02 handoff entry, which lists every place PL02 touched; `git show 93fe789`; the
files it changed.

**Do:** remove what PL02 added, by hand. Don't `git revert`: earlier handoff entries are never
edited, and some later docs wording differs. That means removing:

- `studioEntryLanes`, `StudioEntryLane`, `entryLanes`
- the both-lane chip (`BOTH_CHIP`, `.lane-icon-both`, `LaneIcon`'s `both`)
- the middle lane-order group
- `both` in `laneEntryRefusal`, `laneWords`, the entry inspector's lane row, the blueprint's two
  rows, the chat schema, instructions and `getDesign`

Then:

- A lane tab dropped on the tile that starts the other lane is refused again, in plain words
  ("CDN already starts the download lane; a tile has one entry.").
- `setEntryLane` stays, for download ↔ upload only. The entry inspector's lane row has the two
  icons.
- A stored design with a `both` entry loads with that entry as `download`. Normalise it in the one
  place designs are parsed, and note it in the handoff.

**Tests:** drop PL02's both-lane tests and keep the cap tests. In `spawn.spec.ts`, the user's
upload `+` dropped on the CDN is now refused (the CDN is dimmed and nothing changes).
**Docs:**

- the studio guide, CATALOG, studio settings and blueprint docs: no "both"
- PLAN.md: the data model, commands and chat sections; remove the read/write-tags note from Next

**Commit:** `DP02: remove both-lane entries`

## DP03 — Link rules as one table, with reasons

The owner wants the fan to offer the same options on both sides of every tile, and the link
rules ready for a future code generator. Today:

- `studioLinkDefaults` is a chain of `if`s.
- The fan only lists accepted types.
- Each tab has a fixed mode (sync `+`, async `---`).

**Read:**

- `packages/spec/src/studio-links.ts` and `studio-tiles.ts`
- `studio-lane-commands.ts` (`laneChoices`, `laneTabs`, `laneLinkRefusal`, `addTileRefusal`,
  `linkTilesRefusal`)
- `studio-lanes.ts`
- `apps/server/src/chat/tools.ts`
- CATALOG "Lanes and links"

**Do:**

1. **One table.** Turn the link rules into data in `studio-links.ts`: rows by source role and
   target role, each with its allowed modes, its default mode and the connection defaults it gets
   today. The roles are user, application, CDN, external API, queue and store. The owner-approved
   rules:
   - Stores (database, search index, cache, object storage) are end tiles: no links out.
   - A queue sits between applications: only an application publishes to it, only an application
     consumes from it, and both links are always asynchronous.
   - A CDN fronts an application or object storage, by request only.
   - User entries: the kinds in `studioEntryKinds`, by request.
   - An external API calls an application (sync or async).
   - Everything else an application does is allowed. Links into stores, search and the CDN are
     requests; application → application or external is sync or async, default sync.

   Refusals keep today's plain words. Export the table so a later blueprint version can publish it.
2. **Mode from the pair.** `studioLinkDefaults(source, target, mode?)`: with no mode, use the
   pair's default (async for queue links, sync otherwise). `addTile.link` and `linkTiles.link`
   become optional with the same default. Switching an existing link's mode stays in the line
   inspector's Interaction field.
3. **`laneOptions(design, from, side)`.** Return all seven tile types, always in `studioTileTypes`
   order. Each entry is either `{ type, kind }`, the kind it would add, or `{ type, refusal }`, the
   plain-words reason for the type's preferred kind. A create links with the pair's default mode.
4. **`attachOptions(design, node)`** (the link tool):
   - For a tile: every other tile, each with the link an attach would make. That is selected →
     target when the rules allow it, else target → selected. Otherwise the refusal (the forward
     direction's reason when both are refused). Example: Links database selected, dropped on
     Analytics worker → Analytics worker → Links database.
   - For the user (`LANE_ACTOR`), per lane: the tiles that lane could take as an entry, or why not.
5. Keep `laneChoices` and `laneTabs` working on top of the new functions, so the canvas looks the
   same until DP04 removes them.
6. **Chat.** `link` is optional in the tool schema. Generate the instructions' link-table
   paragraph from the table, so the two can't drift.

No template-support state is added now: no generator exists yet. The docs say that a future
generator marks unsupported tiles or links (a badge and a blueprint finding) and never refuses
them, keeping design intent and template availability apart.

**Tests:**

- each rule, and the default mode of every row
- `laneOptions` always returns seven types, with reasons
- `attachOptions` in both directions, including from the user
- `addTile` and `linkTiles` without `link`

**Docs:** CATALOG "Lanes and links" (the table, default modes, `laneOptions`, `attachOptions`).
**Commit:** `DP03: link rules as one table, with reasons; mode from the pair`

## DP04 — `+` creates, the link tool attaches

Owner: "+ is for create. The --- is for attaching 2 tiles together", in either direction, with a
link icon instead of `---` so it isn't mistaken for a dashed line.

**Read:**

- `packages/board/src/react/TileChrome.tsx` (`TabSpec`, `FanItem`, `TabGlyph`), `Board.tsx` (pull,
  drop targets, `canDrop`), `fan.ts`, `DashGlyph.tsx`, `board.css`
- `apps/web/src/canvas/creation.tsx`, `LaneCanvas.tsx`, `canvas.css`,
  `apps/web/src/studio/StudioIcon.tsx`
- `apps/web/e2e/spawn.spec.ts` and `canvas.spec.ts`
- the studio guide's "Creating and connecting"

**Do:**

1. **Board: two tab kinds.**
   - A **create** tab (`+`) opens a fan and never links to existing tiles: no drop targets, no
     dimming.
   - An **attach** tab (a link icon) opens no fan. While it is pulled, the tiles it can attach to
     stay bright with the dashed outline and the rest dim. Releasing on one attaches; releasing
     anywhere else, or Escape, springs back.
   - `TabSpec` says which kind a tab is, and the glyph becomes `plus` or `link`. Remove `dash` and
     `DashGlyph` if nothing else uses them.
2. **Board: disabled fan items.**
   - `FanItem` takes an optional `disabled` reason. A disabled item is drawn greyed in its usual
     slot, and its name label shows the reason when the pointer is on it.
   - Releasing on a disabled item changes nothing.
   - Item slots are stable, so each type sits in the same place every time.
3. **Jeeves canvas, tiles.**
   - A tile shows a `+` on each side where at least one type is available (left inserts before,
     right adds after). Its fan always shows all seven types, with unavailable ones greyed and the
     `laneOptions` reason.
   - A tile shows one attach tab (on the right, below its `+`, or alone where it has no `+`)
     whenever `attachOptions` has a target.
   - A released attach on a dimmed tile shows the reason as the notice, as today.
4. **Jeeves canvas, the user.** One `+` per lane (new entry tile) and one attach tab per lane
   (make an existing tile an entry), each with its lane badge. Tiles can't attach onto the user.
5. Remove the `---` tabs, the per-mode tab logic, `laneChoices` and `laneTabs`. Creates and
   attaches use the pair's default mode.

**Tests:** a board unit test that a disabled fan item can't be picked, and that slots are stable.
E2E (`spawn.spec.ts`):

- Redirect's right `+` shows seven icons.
- A database's left `+` greys Database, Cache, Storage and Queue.
- Releasing a `+` on an existing tile changes nothing.
- Attach from Analytics store onto Redirect service creates Redirect → Analytics store; Undo.

**Browser:** TinyURL and Blank by mouse alone. Record the tabs shown on each TinyURL tile, and the
drag and click count to rebuild TinyURL from Blank.
**Docs:** the studio guide's "Creating and connecting" (rewritten) and the CATALOG mention of the
canvas commands.
**Commit:** `DP04: + creates, the link tool attaches`

## DP05 — Inspector: type list, preconfigured kinds, two languages

The owner looked for a way to say what a service is (Billing? using Stripe?). It already exists as
the kind row, but the row is bare icons with the names only in tooltips. Every application kind
also offers seven languages, C# included.

**Read:**

- `apps/web/src/canvas/TileInspector.tsx` (the `lane-kinds` fieldset)
- `packages/spec/src/studio-definitions.ts` (fields, defaults, `createStudioSettings`),
  `studio-model.ts` (`studioLanguageSchema`), `studio-validation.ts`, `studio-blueprint.ts`
- docs/studio-settings.md
- `apps/server/src/chat/tools.ts`

**Do:**

1. **Type list.** Replace the icon-only kind row with a labelled **Type** list: each kind's icon
   and name, the current one highlighted, refused ones disabled with the reason as the title. It
   is shown for tile types with more than one kind (Service, API, Database).
2. **Preconfigured kinds** (owner-approved). New tiles and `changeKind` start with:

   | Kind | Field | Starts as |
   | --- | --- | --- |
   | Billing | payment provider | Stripe |
   | Notifications | delivery provider | Resend |
   | Identity | integration | OIDC |
   | Gateway | product | Traefik |
   | CDN | provider | Cloudflare |

   The other choices stay selectable.
3. **Two languages per application kind** (owner-approved; default first). Drop `unspecified` from
   language.

   | Kind | Languages |
   | --- | --- |
   | Microservice | TypeScript, Go |
   | Worker | TypeScript, Go |
   | Redirect | Go, TypeScript |
   | Identity | TypeScript, Go |
   | Notifications | TypeScript, Go |
   | Billing | TypeScript, Go |
   | Gateway | none (it's a product, not code) |
   | CDN | none (it's a product, not code) |

   Validation refuses any other value for that kind. A stored value outside the kind's pair loads
   as the kind's default: normalise it where DP02 normalises `both`, and list it in the handoff.
   The browser app kind (not offered on the canvas) keeps its current fields.
4. **No duplicate tiles for providers.** A provider chosen on a kind (Billing → Stripe) is that
   service's integration, not a separate External tile. External tiles are for third parties no
   kind covers. Say so in the docs and the chat instructions.
5. **Chat.** The tool schema and `getDesign` show each kind's two languages and presets.

**Tests:**

- the defaults table
- language validation per kind
- normalising an out-of-pair language

**Browser:**

- Select Shorten API: the Type list shows names.
- Switch to Billing: the payment provider is Stripe and the language offers TypeScript and Go only.
- Switch to Gateway: no language, product Traefik.

**Docs:** studio settings (languages, defaults), studio guide (Inspector), CATALOG (the kind table
and the External rule).
**Commit:** `DP05: inspector type list, preconfigured kinds, two languages per kind`

## DP06 — TinyURL v3 from published designs; one writer per store

The owner found the current study hard to follow, for three reasons:

- Both services reach the cache and the database, so their lines share one bus.
- The cache does two unrelated jobs.
- The analytics store is never read.

The owner asked for a design based on the published interview-prep designs. The research
(2026-11-05) found:

- **Agreed by all four sources:** a create path, a redirect path with a cache in front of the
  database, and one URL database written by create and read by redirect.
- **Separate redirect and create services:** three of the four.
- **Click analytics read through a stats API:** DesignGurus/Grokking (queue → consumers → store →
  analytics API).
- **Owner decisions:** ID generation is a module-level detail. The URL safety check and the expiry
  cleanup job are left out; the developer can add them later.

Sources:

- HelloInterview, *Design Bit.ly*:
  https://www.hellointerview.com/learn/system-design/problem-breakdowns/bitly
- System Design Primer, *Pastebin / Bit.ly*:
  https://github.com/donnemartin/system-design-primer/tree/master/solutions/system_design/pastebin
- DesignGurus (Grokking), *TinyURL*:
  https://www.designgurus.io/course-play/grokking-the-system-design-interview/doc/designing-a-url-shortening-service-like-tinyurl
- ByteByteGo (Alex Xu), *Design a URL Shortener*:
  https://bytebytego.com/courses/system-design-interview/design-a-url-shortener

**Read:**

- `packages/spec/src/studio-examples/tinyurl.ts` and `study.ts`
- `studio-blueprint.ts`, `studio-validation.ts`, the owner reference field (`ownerChoices` in
  `apps/web/src/studio/InspectorForm.tsx`), `apps/web/src/studio/ConnectionForm.tsx`
- `apps/web/src/project/create-example.ts`
- the E2E specs and `fixtures/chat/e2e-script.json`, which use TinyURL names and counts

**Do:**

1. **One writer per store.** A database, cache, storage or search index is written only by its
   owner (the binding's `owner`). Every other application's link to it reads. This is derived,
   not stored:
   - The line inspector shows "Writes (owner)" or "Reads" for a link into a store.
   - The blueprint gives each such connection `access: "write" | "read"`.
   - Changing a store's owner changes who writes.

   Queues keep publish and consume.
2. **TinyURL v3** (`studio-tinyurl@3.0.0`), exactly:

   ```
   DOWNLOAD (reads)
     User ⇣ CDN → Redirect service → URL cache
                                   → URL database      (reads)
                                   ⇢ Click events ⇢ Analytics worker → Analytics store
     User ⇣ Stats API → Analytics store                (reads)

   UPLOAD (writes)
     User ⇡ Shorten service → URL database             (the only writer)
   ```

   - **Tiles:**
     - CDN (`cdn`, Cloudflare)
     - Redirect service (`redirect`, Go)
     - URL cache (`cache`, Redis-compatible, LRU)
     - URL database (`database`, PostgreSQL, read replicas)
     - Click events (`queue`, topic)
     - Analytics worker (`worker`, TypeScript)
     - Analytics store (`database`, ClickHouse)
     - Stats API (`service`, TypeScript)
     - Shorten service (`service`, TypeScript)
   - **Owners:**
     - URL database → Shorten service
     - URL cache and Click events → Redirect service
     - Analytics store → Analytics worker
   - **Totals:** 9 tiles; 11 links (3 entries and 8 connections).
   - **Modules** (inspector only):
     - Redirect: cache reader, link reader, redirect responder (302), click publisher
     - Analytics worker: click consumer, aggregation, aggregate writer
     - Stats API: stats reader
     - Shorten service: link writer
   - **Removed:** the URL reputation API, the rate limiter, the ID generator and the reputation
     check.
   - **The CDN:** depends on the owner's answer to DP06's question below. Until then, keep the CDN
     with redirect caching off and the responder sending `Cache-Control: no-store`, because every
     click must reach analytics.
   - **Sources:** cite them in the study's doc comment.
   - **Where it appears:** the fresh-install default and **Architecture study** use v3. The owner's
     existing projects are not touched.
3. Regenerate the blueprint example in docs/studio-blueprint.md.

**Tests:**

- the study validates with no findings
- the blueprint counts
- derived access: the owner writes, others read, and changing the owner flips it

Update every E2E spec and the chat fixture that names TinyURL tiles or counts.
**Browser:** v3 renders with straight lines (DP01). Selecting each store shows who writes.
**Docs:** the studio guide's TinyURL section, CATALOG Study, the blueprint doc.
**Commit:** `DP06: TinyURL v3 from published designs; one writer per store`

Open question for the owner (asked 2026-11-05): with click analytics in scope, the CDN can't cache
redirects. Should it stay at the edge with caching off, or be dropped?

## DP07 — Acceptance and documentation

**Do:**

- Walk through everything from DP01–DP06 by mouse at 1440×900 and 1280×800, with rails open and
  closed, in light and dark mode:
  - TinyURL v3
  - rebuilding it from Blank
  - attach in both directions
  - the greyed fan items
  - the Type list and presets
  - the lane entries
- Record clicks and drags, and anything rough.
- Sweep every doc in the AGENTS.md list and PLAN.md, update the studio guide's Limits, and mark
  this plan's status.
- Fix small defects found. Record larger ones as follow-ups in the handoff, not here.

**Commit:** `DP07: design polish acceptance and documentation`

## DP08 — Etsy study (waits on owner answers)

## DP09 — YouTube study (waits on owner answers)

The owner wants two more studies, made like TinyURL: research each system's architecture on the
web, build it on the canvas, and make it available for the owner to review as a project. If the
design can't be expressed, the agent adds options to the canvas, within the lane model and the
template goal above, so that the proper design can continue.

Questions put to the owner on 2026-11-05, to be answered before DP08 starts:

1. Real company or reference design? Etsy's own engineering talks describe a largely PHP monolith
   on sharded MySQL, which would be one big tile. Proposal: follow the published reference design
   for that kind of system, cross-checked against the company's engineering blog, and note where
   the real company differs.
2. How the studies reach the owner. AGENTS.md forbids agents touching the owner's `jeeves`
   database. Proposal: **New project** offers each study (TinyURL, Etsy, YouTube), so the owner
   creates each with one click.
3. Scope. Each system has several big features. Proposal: one project per system, covering the
   core flows the sources agree on. Split into two or three projects only if a clean diagram can't
   hold them, and say why.
4. What the agent may add without asking. Proposed ladder, in order of preference:
   1. existing options
   2. a new kind or preset within an existing tile type, with its default and alternative
      language, its provider and the template it implies
   3. a new setting (schema, form, validation and blueprint together)
   4. raising a cap in `laneLimits`
   5. a new tile type or lane-rule change, only after asking the owner

   Each addition is recorded in the handoff with the design need, the template it implies and why
   the existing options didn't fit.

The units are written out once the owner answers.
