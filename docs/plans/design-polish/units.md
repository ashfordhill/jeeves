# Design polish units

**Status: approved 2026-11-05.** All units are approved, including DP08 (the marketplace study,
which replaces Etsy) and DP09 (the YouTube study), after the owner's answers of 2026-11-05.
The owner added DP10 (a review of DP01–DP09) later the same day.
**Progress:** DP01–DP07 are done (see [the handoff](../../handoff.md)); DP08–DP10 remain.

The owner reviewed the lane canvas after PL02 (2026-11-05) and decided the following:

- `+` only creates.
- A separate link tool attaches two existing tiles, in either direction.
- The fan offers the same seven tile types on both sides.
- "Both" lane entries go.
- Service and API types become clearly labelled, preconfigured choices with two languages each.
- TinyURL is rebuilt from published designs.

There are ten units, run in order: DP01 → DP10. A fresh agent runs one unit at a time on primary
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
- **No CDN tile** (owner, 2026-11-05, after the question below was researched). What gets cached
  is the lookup, not the redirect response. All four sources put a cache in front of the database.
  Caching the 302 at a CDN or in the browser stops clicks reaching the service. ByteByteGo's 301
  vs 302 discussion and HelloInterview make that trade explicitly, and Grokking sends 302 with
  `Cache-Control: no-store` so every click counts. Dub, an open-source shortener (AGPL), shows
  how this is done in practice: its redirect runs as code on every request (Next.js Middleware),
  reads link data from Redis, answers 302, and records the click after responding
  (`ev.waitUntil(recordClick(...))` into Tinybird/ClickHouse). Only its static pages get CDN
  cache headers (`apps/web/lib/middleware/link.ts`). So the user enters at the Redirect service
  directly. Running the redirect near users is the existing Execution → Managed → Cloudflare
  Workers setting, not a CDN tile.

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
     User ⇣ Redirect service → URL cache
                             → URL database      (reads on a cache miss)
                             ⇢ Click events ⇢ Analytics worker → Analytics store
     User ⇣ Stats API → Analytics store          (reads)

   UPLOAD (writes)
     User ⇡ Shorten service → URL database       (the only writer)
   ```

   - **Tiles:**
     - Redirect service (`redirect`, Go, public, Docker)
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
   - **Totals:** 8 tiles; 10 links (3 entries and 7 connections).
   - **Modules** (inspector only):
     - Redirect: cache reader (cache-aside), link reader, redirect responder (302, no edge
       caching), click publisher
     - Analytics worker: click consumer, aggregation, aggregate writer
     - Stats API: stats reader
     - Shorten service: link writer
   - **Removed:** the URL reputation API, the rate limiter, the ID generator and the reputation
     check.
   - **Sources:** cite them, Dub included, in the study's doc comment.
   - **Where it appears:** the fresh-install default and **Architecture study** use v3. The owner's
     existing projects are not touched.
3. Regenerate the blueprint example in docs/studio-blueprint.md.

**Tests:**

- the study validates with no findings
- the blueprint counts
- derived access: the owner writes, others read, and changing the owner flips it

Update every E2E spec and the chat fixture that names TinyURL tiles or counts.
**Browser:** v3 renders with straight lines (DP01). Selecting each store shows who writes.
**Docs:** the studio guide's TinyURL section (including the paragraph on why there is no CDN),
CATALOG Study, the blueprint doc.
**Commit:** `DP06: TinyURL v3 from published designs; one writer per store`

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

## Rules for the studies (DP08, DP09)

The owner wants more studies, made like TinyURL. Their purpose is to test Jeeves's design options
against real-world systems instead of deciding in a vacuum. Owner answers of 2026-11-05:

- **Same functionality, clean microservices.** A study doesn't copy the real company's
  architecture, which carries legacy code and business history. It designs the same core
  functionality as clean microservices, using the published reference designs: interview-prep
  write-ups, open-source reference apps and company engineering blogs. Note where the real company
  differs. No PHP. Every generated service uses its kind's two languages (DP05).
- **Core flows only.** What the sources agree a system must do. Extra and "fun" features are left
  out. One project per system; split into two or three only if one clean diagram can't hold the
  core, and say why in the handoff.
- **When the design doesn't fit, extend the canvas.** Prefer, in this order:
  1. existing options
  2. a new kind or preset within an existing tile type, with its two languages, its provider and
     the template it implies
  3. a new setting (schema, form, validation and blueprint together, per AGENTS.md)
  4. raising a cap in `laneLimits`
  5. a new tile type or a lane-rule change: stop and ask the owner first

  Record each addition in the handoff: the design need, the template it implies (a ready-made
  backend to deploy and configure, or a generated skeleton) and why the existing options didn't
  fit. Keep the template goal and the readability goal in "Why this matters" in view.
- **Delivery.** Add each study to **New project**, which then offers TinyURL and the new ones.
  Also create one project of each in the owner's `jeeves` database so the owner can review it.
  The owner allows this; AGENTS.md now says so. Use the app's normal create path. If the owner's
  API on 4310 is running, use it; otherwise start the API briefly against the `jeeves` database
  and stop it afterwards.
- **Sources.** Cite them in the study's doc comment and the studio guide. Research first, then
  design. Every tile must trace to a source or to a stated design decision.

## DP08 — Marketplace study

The owner first picked Etsy, expecting a clean microservice architecture. Etsy's own engineering
talks describe a largely PHP monolith on sharded MySQL (High Scalability; The Next Platform,
2015). So this study is a **multi-seller marketplace** with Etsy's core functionality, designed as
clean microservices. The owner also wants it as a reference for a dropshipping site they are
building (`~/github/dropshipping`, Cloudflare Workers with Drizzle). That site is a storefront
where sellers open a shop and upload products, and buyers browse a grid of large thumbnails with
prices and buy.

**Core flows:**

- A seller opens a shop and lists products with images.
- A buyer browses and searches listings (thumbnails, prices) and opens a product.
- A buyer puts items in a cart and checks out.
- Payment goes through a provider, sellers get paid, and orders are recorded.
- Buyers and sellers see their orders.

**Research:**

- interview-prep "design an e-commerce marketplace / Amazon / Etsy" write-ups
- Google's Online Boutique microservices demo (its service split: catalog, cart, checkout,
  payment, shipping, email, recommendation; ignore its mixed languages)
- marketplace payments with seller payouts (for example Stripe Connect)
- serving product images (object storage, image resizing, a CDN in front)

Questions to settle from the sources, not by guessing:

- where search lives (a search index fed from the catalog)
- how thumbnails are produced (on upload by a worker, or resized on request at the edge)
- whether the cart is its own service with a cache-like store

Expect to test:

- object storage plus a CDN for images, where a CDN genuinely belongs
- the Billing kind with Stripe for payments and payouts
- a search index
- an upload-triggered worker
- one writer per store across catalog, orders and shops
- identity for buyers and sellers

**Tests:** the study validates with no findings; the blueprint counts. Unit tests for any option
added.
**Browser:** the study renders, both window sizes; every tile's inspector shows sensible presets.
**Docs:** the studio guide (a section per study, beside TinyURL), CATALOG Study, and any doc an
added option touches.
**Commit:** `DP08: marketplace study`

## DP09 — YouTube study

**Core flows:**

- A creator uploads a video, and it is processed: stored, transcoded into streamable renditions,
  thumbnailed.
- A viewer watches a video, streamed through a CDN at an adaptive bitrate.
- A viewer finds videos (search) and sees a video's details and view count.

Comments, recommendations, monetisation and live streaming are out unless every source treats
them as core.

**Research:**

- ByteByteGo / Alex Xu, *Design YouTube*
- HelloInterview and DesignGurus equivalents
- YouTube or Google engineering material where it describes the same flows (for example Vitess
  came from YouTube)

Expect to test:

- large uploads (object storage, resumable or presigned uploads)
- a processing pipeline of queues and workers
- a CDN serving segments from storage
- metadata and view counts with one writer per store
- a search index

**Tests, Browser, Docs** as DP08.
**Commit:** `DP09: YouTube study`

## DP10 — Review of DP01–DP09

Owner, 2026-11-05: a plan split into units ends with a unit that reviews what the earlier units
added. Each unit's agent saw only its own unit. This review looks for what falls between units.
It is not a second acceptance pass: DP07 did the walkthrough and the docs sweep.

**Read:** every DP handoff entry; this plan; `git log --oneline 2b9eff5..HEAD`. Read the combined
diff (`git diff 2b9eff5..HEAD`) only where the steps below point to it.

**Do:**

1. **Rough-edge ledger.** List every rough edge, deviation and next-unit note in the DP handoff
   entries. Give each one a status: fixed (by which unit), still open, or no longer applies. Say
   in one line how you checked.
2. **Correctness review.** Run the `/code-review` skill at `high` on `2b9eff5..HEAD`; if it isn't
   available, review by hand. Then check these seams yourself:
   - **Rules in more than one place.** A rule enforced in the spec should not be restated by hand
     in the canvas, inspector, chat or blueprint. A known case: the queue-must-be-async check in
     `apps/web/src/studio/connection-drafts.ts` versus DP03's link table.
   - **Load-time normalisation.** DP02 (`both`), DP05 (languages) and anything DP06–DP09 added
     run where stored designs are parsed. Check that they compose, that commands still validate
     strictly, and that each one is listed in the docs.
   - **Removed features.** Nothing still refers to `both`, `laneChoices`, `laneTabs`, `DashGlyph`,
     `unspecified` or the `---` tabs: code, exports, CSS, tests, chat instructions or docs.
   - **The studies.** DP08 and DP09 validate under the final rules, and any option they added has
     its schema, form, validation, blueprint output and docs (AGENTS.md).
3. **Fix confirmed defects only.** A defect is confirmed when you can show it: a failing test, a
   reproduction, or a statement in the docs that the code contradicts. Each fix comes with a test
   that fails before it and passes after (or the corrected sentence, for docs).

**Don't:** rename, refactor, reformat or reword anything that isn't wrong. Don't add tests for
behaviour that is already covered. Don't change decisions recorded in a handoff entry (for example
DP01's dot offset, or DP04's fan latch and no dimming on a `+` pull); list doubts about them as
questions for the owner. Don't add features.

**Handoff:** the ledger; a findings table (severity, `file:line`, what goes wrong, how to
reproduce, fixed or follow-up); questions for the owner. Keep it short: a finding you can't show is
not a finding.
**Checks:** as every unit. The browser check covers only what you changed.
**Docs:** only false statements. Mark this plan's status as complete.
**Commit:** `DP10: review of the design polish units`
