# YouTube v3: studio feedback, generation gaps, a better chat agent, then v3

**Status:** planned 2026-11-10 from owner feedback. The owner confirmed the decisions the same
day, revising D4 (adding Favorites) and D6 (chat). V3-01 to V3-10 are done; the owner approved
[contract](contract.md) question 1 (a fifth link, raised in V3-06). V3-10's live model comparison
waits for the owner's go-ahead. V3-11 is next.
**Feedback record:** [HUMAN_FEEDBACK, 2026-11-10 — Studio feedback and YouTube v3](../../HUMAN_FEEDBACK.md)
· [module add button sketch](../../human-feedback/2026-11-10-module-add-button.png)
· Follows [tile processes](../tile-processes/units.md) and its [review](../tile-processes/review.md).

There are 18 units, run in order: V3-01 → V3-18. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.

The work comes in five phases:

| Phase | Units |
| --- | --- |
| A — Studio feedback | V3-01 to V3-03 |
| B — Generation gaps that v3 needs | V3-04 to V3-08 |
| C — A better chat agent | V3-09 and V3-10 |
| D — YouTube v3 | V3-11 to V3-17 |
| E — Review | V3-18 |

## Owner feedback (2026-11-10)

1. **Undo and redo:** Ctrl+Z undoes and Ctrl+Shift+Z redoes, as in other programs.
2. **"Queue or topic":** the label is unclear. What is a topic?
3. **Kind labels:** each tile shows its kind in small grey text at the bottom ("database",
   "service"). Names then don't need the kind word: "Metadata database" becomes "Metadata".
4. **Adding a module:** replace the drag-out module tab with a **+ button at the bottom inside the
   tile** that opens and closes the module menu. Clicking away or clicking + again closes it.
   See the [sketch](../../human-feedback/2026-11-10-module-add-button.png).
5. **The legend:** drop "Request" from it, because not every solid line is a request. Show that
   dotted means async. The latest YouTube diagram must follow that convention. Edit it freely;
   version control keeps the history.
6. **Views:** rename "Overview" to **"Simple"**. **Detailed** is the default and moves to the left.
7. **Tools:** remove the Hand tool. The pointer already pans on empty paper, so the tools are
   **Pointer** and **Connect**.
8. **Watchers' identity:** some viewers are signed in and some aren't, and the YouTube design
   doesn't show that. Marketplace will need buyer and seller accounts too.
9. **Inspector +:** the inspector also gets a **+** for adding a module, using the same command
   as the board. The module options pop out to the left of the inspector.
10. **The chat agent:** make it very good at creating and reviewing diagrams.
11. **Two outputs per field project:**
    - **generated code only**, for the owner to review and learn from;
    - **generated code plus the rest of the solution.**
12. Build **YouTube v3** with all of the above.
13. **Favorites** (owner, at confirmation): a favorites capability belongs to generic account
    services, because it applies to more than YouTube.
14. **Chat** (owner, at confirmation): chat takes prompts and makes or suggests diagram edits. It
    must use the diagram well rather than produce gibberish, and ideally it should not need an
    expensive model, so give it tools that help.

## Decisions (confirmed 2026-11-10)

| # | Topic | Default | Alternative |
| --- | --- | --- | --- |
| D1 | Product tables and read access (tile-processes review row 2) | **The writer owns its tables, and readers see only what it publishes.** Each module that writes a database gets its own custom SQL file. It is created empty once and never overwritten, and first run and start apply it. A module with a read link to that database gets SELECT on the writer's `published` views only, derived from links with no new forms. This is v2's pattern: Watch saw only the ready-public view and the public totals. | Readers get SELECT on all of the writer's tables. That is simpler, but it exposes private rows and columns. |
| D2 | Gates | Retire the YouTube Overview PNG hash gate, because tiles visibly change. v1/v2 frozen exports become **check and report**, not stop: they stay in Git as history. | Keep v1/v2 byte gates blocking. |
| D3 | The link fan | It also opens by **click** (a toggle: click away or click again to close), like the new module menu. Dragging is no longer needed anywhere. | Keep the drag-out link fan. |
| D4 | Identity and Favorites in v3 | **Optional sign-in** on Watch: an Auth guard set to *optional* verifies a token when present, and otherwise the viewer is anonymous. View events carry the viewer's account when signed in. **Favorites** is a new generic template: a signed-in account can add, remove and list favorite items. Its one product hook decides whether an item may be favorited (in v3, a ready, public video). It is reusable for Marketplace listings. There are no other new viewer features: no history, likes or subscriptions. | Chosen with the owner's addition. |
| D5 | Settings on stub tiles | Request timeout and Concurrency limit show on every HTTP or worker tile while Runnable processes is on, because the process uses them (tile-processes review row 4). | Show them only once a template derives. |
| D6 | The chat agent | **Chat can do exactly what the mouse can, and no more.** It uses the same commands, the fan's 11 tile kinds and the module catalog, so nothing it saves is something the UI couldn't make. Update the eval seeds that used Billing. The knowledge lives in the **tools** so that a cheap model is enough: **apply a reviewed pattern** as one validated batch, **preview** commands with their findings before saving, and an **automatic review** after every change. Evals compare a cheap model with a stronger one. Live, paid runs only with the owner's explicit go-ahead at that time. | Chosen with the owner's direction. |
| D7 | The legend | Only **dashed = Async** is shown, with no explanatory text (owner, 2026-11-11). | Show both, as **Direct** and **Async**. |
| D8 | v3 layout | `field-projects/youtube/v3/` holds `inputs/`, `diagrams/` and `notes/`, plus two outputs: `generated/` (the exact export, never edited) and `app/` (generated plus custom completion). The backend LOC benchmark compares `app/` with `generated/`. | One app directory with a baseline commit, as in v2. |

## Fixed constraints

- **Shared commands:** mouse, chat and generation share commands. Every action works by mouse;
  hotkeys are extras and never fire inside text fields, where the browser's own text undo works.
  `jeeves/packages/board` imports no Jeeves code.
- **Necessary controls only:** a normal control must affect an implemented template, stub or
  process and represent a necessary user decision. No Advanced forms, no explanatory paragraphs.
- **Off means unchanged:** with Runnable processes off, exports of existing designs are unchanged
  unless a unit says otherwise and records it. Generated apps stay standalone and deterministic,
  with no secrets in source.
- **Docker hygiene:**
  - Use your own compose project names and loopback ports.
  - Never touch the owner's stacks (v1/v2 on 45400–45412), volumes or image tags.
  - Remove everything you create, including scratch exports holding runtime secrets.
- **No invented product behaviour:** v3 completion follows v1/v2's product scope (uploads,
  processing, publication, playback, search, counts), plus D4: optional sign-in and Favorites. It
  adds nothing else.

## Rules for every unit

- **Read first:** `AGENTS.md`, the latest `docs/handoff.md` entries, this plan (including the
  confirmed decisions) and the HUMAN_FEEDBACK entry. From V3-05 on, also read
  `docs/plans/youtube-v3/contract.md`. Do only your unit and stop at its end.
- **Before editing:**
  - Run `git status`. The owner may have uncommitted work: `README.md`, `.docs/`,
    `.jeeves-feedback/` and the mode of `e2e-docker.sh`. Leave it unstaged and untouched.
  - If a file you must change has uncommitted edits you did not make, stop and report.
- **Environment:**
  - Use Node 24 (`~/.nvm/versions/node/v24.21.0/bin` first in `PATH`).
  - Run Biome or format only from the repo root.
  - Never stop or restart the owner's dev servers on 4300/4310; use your own ports and scratch
    databases.
  - The owner's own edits in the running UI are play. Don't flag them; don't edit owner
    projects.
- **Checks:**
  - `pnpm check`;
  - `pnpm test:e2e` (or `:docker`);
  - `pnpm --filter @jeeves/web build`;
  - a mouse check in the browser at 1440×900 and 1280×800: the TinyURL study renders and the
    changed behaviour works, with no page errors.

  If an e2e test fails, rerun it alone and report both results. Never weaken a test.
- **Gates (D2):** run the processes-off pin and the v1/v2 frozen comparison, and report any
  difference in the handoff.
- **Docs:** keep current `docs/studio.md`, `docs/studio-settings.md`, `docs/studio-blueprint.md`,
  `jeeves/CATALOG.md`, `jeeves-generator/README.md` and `docs/chat-evals.md` where affected. Add a
  dated playbook lesson when you learn something.
- **Evidence:** at most 4 screenshots per visible unit, under
  `docs/plans/youtube-v3/evidence/<unit>/`.
- **Finish:** append a short handoff entry and make one local commit named `V3-nn: <summary>`.
  Don't push.

---

## Phase A — Studio feedback

### V3-01 — Undo/redo keys, two tools, Simple and Detailed

- **Undo and redo keys:**
  - **Ctrl/Cmd+Z** runs Undo, and **Ctrl/Cmd+Shift+Z** (and Ctrl+Y) runs Redo.
  - Both use the same functions and disabled states as the header buttons.
  - Neither acts while focus is in a text field, select or contenteditable, nor while a dialog
    is open.
- **Remove the Hand tool:** remove its button, the H key and every Hand-only code path in web and
  board. The tools are **Pointer (V)** and **Connect (C)**. Panning by dragging empty paper and
  zooming by wheel stay as they are.
- **Views:**
  - Rename the toggle to **Detailed | Simple**, in that order. Detailed is the default.
  - Keep a saved per-project choice; old saved "overview" values read as Simple.
- **Tests**
  - Key tests: in a field they don't undo; outside one they do.
  - The toolbar shows two tools.
  - The default view is Detailed.
  - Update existing specs that used Hand or "Overview".

**Commit:** `V3-01: undo keys, two tools, simple and detailed`.

### V3-02 — Kind labels, queue or topic, the legend

- **Kind labels:** every tile (Simple faces and Detailed container headers) shows its kind in
  small grey text at the bottom: "Database", "Service", "Worker", "Search index" and so on. It
  must stay legible at 100% and not crowd the name.
- **Queue or topic:** a queue tile's label is **Queue** or **Topic**, from its derived mode
  (`settings.mode`: work queue or topic). In plain words:
  - A **queue** gives each message to exactly one consumer. Upload jobs: one transcoder takes each
    job.
  - A **topic** copies each message to every subscriber, like a Kafka topic or a RabbitMQ
    exchange. Publication events go to the search indexer and to anything else that subscribes.

  Reword the kind name, the module descriptions and the inspector text that say "queue or topic"
  so they read naturally.
- **The legend (D7):** remove "Request". The collapsed legend shows **dashed = Async**. The
  expanded help explains solid and dashed in one line each. Keep the direction conventions.
- **Audit the lines:** in all four studies, check that every dashed line goes through a queue or
  topic and every solid one is a direct call. Fix the YouTube study's lines where they are wrong
  (the owner allows editing it). Record what changed.
- **Names:** the YouTube study's names drop the kind word where the label now shows it
  ("Metadata database" becomes "Metadata"). Other studies only if trivial.
- **Gates:** the PNG hash gate is retired (D2). Record a new YouTube Simple export hash as the
  new reference.

**Commit:** `V3-02: kind labels, queue or topic, legend`.

### V3-03 — A + inside the tile, and in the inspector

- **The module menu on the board ([sketch](../../human-feedback/2026-11-10-module-add-button.png)):**
  - Remove the drag-out module tab on the left.
  - In Detailed, every application container shows a small **+** at the bottom, inside the
    frame. That includes empty Service, Worker and Uploads tiles, which become containers with
    just the +.
  - Clicking + toggles a **module menu** popover: grouped Template / Part of a template / Stub,
    each item with its icon, name, one-line description and status.
  - Clicking away, pressing Esc or clicking + again closes it. Picking an item runs `addModule`
    and opens the new module with its name focused.
  - In Simple, the + appears inside the **selected** application tile.
- **The inspector:** the tile page's Modules section gets the same **+**. The same menu pops out
  to the **left of the inspector rail**. One shared component and one command for board and
  inspector.
- **The link fan (D3):** it opens by click as a toggle too. Fix it covering its own tile in a
  narrow canvas (module-authoring review follow-up 6).
- **Tests**
  - Add a module from the container + in Detailed, from the selected tile in Simple, and from the
    inspector +.
  - Click away closes the menu; + toggles it.
  - The link fan works by click.
  - Update the MA06 and MA09 specs (the v2 rebuild must still pass by mouse).

**Commit:** `V3-03: module + in the tile and inspector`.

## Phase B — Generation gaps that v3 needs

### V3-04 — v3 contract (docs only)

Write `docs/plans/youtube-v3/contract.md`, concise, with tables and file:line citations. Start it
with an Owner summary of at most 12 lines and add Open questions with defaults. The coordinator
pauses only for questions that go beyond the confirmed decisions.

1. **Product tables (D1):**
   - the SQL file's path and naming;
   - which modules get one (writers: Data access, Lifecycle writer, stubs with write links);
   - apply order and the setup-only owner;
   - how `published` views are named and granted from read links;
   - template-owned tables (upload state, lifecycle, counter) versus product tables;
   - re-export preservation;
   - processes-off effect.
2. **The Auth guard template (D4):**
   - a generic verified identity against the Identity tile (Keycloak locally);
   - the setting **Sign-in: Required / Optional**;
   - the principal-or-anonymous value given to the other modules and hooks in its tile;
   - how it satisfies multipart's `principal` hook;
   - provisioning of the Keycloak client and realm;
   - errors (401 when required, anonymous when optional);
   - reuse in Marketplace for buyers and sellers.
3. **The Favorites template (D4):**
   - its module kind, host kinds and slots: an Auth guard in the same tile set to required, and
     a database it writes;
   - its endpoints (add, remove, list for the signed-in account) and their errors;
   - the table it owns;
   - the single product hook (`eligible`: may this item be favorited?);
   - how v3 answers that hook from the published videos view;
   - reuse for Marketplace listings.
4. **Settings on process tiles (D5):** which settings and on which kinds.
5. **The v3 design:** the full table of tiles (names without kind words), links (direct or
   async, with direction), modules and module links, in the v2-rebuild format.
   - It includes Watch API's optional Auth guard and the Watch API → Identity link.
   - Where Favorites lives: on Watch API, or on a separate **Account API** with a required guard.
     The default is a separate Account API, because favorites are generic account services; the
     contract confirms or argues otherwise.
   - View events carry the viewer when signed in.
   - Product tables come from D1: which module writes `videos` and which views Watch reads.
   - Search mappings and query preset data.
   - The useful settings.
6. **Field-project layout (D8):**
   - `generated/` (exact export, processes on, never edited) and `app/` (copy plus completion);
   - how `app/` records its custom paths;
   - the LOC benchmark scope;
   - the reused v2 browser.
7. **Acceptance:** v1/v2's S01–S08 scenarios plus signed-in and anonymous watching, and
   Favorites. A signed-in viewer adds, lists and removes favorites. Anonymous favorites calls
   answer 401. Favoriting a video that isn't ready is refused. Say exactly what is observed, by
   mouse in the browser and by API.

Revise V3-05 to V3-17 if the contract changes their scope.

**Commit:** `V3-04: v3 contract`.

### V3-05 — Product tables and published views

Implement [contract](contract.md) §1, only with Runnable processes on:

- per-writer SQL files `infra/postgres/<database>/modules/<module>.sql` (`generated-extension`,
  a header only, created once and preserved), for every module that writes a database other than
  through a template's outbox;
- the `migrate.mjs` product step, by an exactly-once substitution as TP04 did for `local.mjs`:
  `published` and `m_<module>` schemas, each file after the template views, at every first-run
  and start;
- grants from links: a writer's host gets its module schema; every login on the database gets
  SELECT on `published` (this gives the cache read's source login its read);
- report entries;
- off means unchanged (the pin).

**Tests**

- Generator unit tests.
- A Docker run of a small design: one writer with a table and a published view, and one reader
  with a cache-read loader. The reader's filled `load` reads the view. The reader can't read the
  base table. An edit to the writer's file applies at the next `start`. Restart keeps it all.

**Commit:** `V3-05: product tables and published views`.

### V3-06 — The Auth guard template

Implement [contract](contract.md) §2:

- the Auth guard as the lead of `verified-identity@0.1.0` (Template in the module menu), no
  longer a part of multipart;
- the Sign-in setting (absent reads Required; initial value Required) on the module page and in
  chat;
- `src/runtime/tile-guard.ts`: Required (401) and Optional (anonymous; an invalid token gives
  401), `GET /modules/<guard>/me`, and `ModuleRequest.caller`;
- Keycloak provisioning from every guard selection;
- Multipart uploads and Favorites need a Required guard in their tile; multipart's `principal`
  defaults to `guard.require`;
- multipart's hooks reach the asset lifecycle that names its upload, and `reserve`, `complete`
  and `closed` delegate to it (contract §2, "Also in V3-06");
- pin `youtube-core`'s policy list to its six refs (sha unchanged);
- if the owner agrees (contract question 1), raise `laneLimits.outgoingLinks` to 5, with docs
  and a mouse check of a 5-link tile at both sizes.

Record the intended changes: the processes-off pin for the v2 module design (Creator check
becomes its own template), the v2-rebuild spec's counts, `v2IntendedDifferences` and the
equivalence test. Frozen v2 and v1 stay unchanged.

**Tests**

- Unit tests.
- A Docker run:
  - a Required guard answers 401 without a token;
  - an Optional guard gives anonymous without a token, the principal with a valid one, and 401
    with an invalid one (`me` shows each);
  - an upload with a valid token reaches `validate`.

**Commit:** `V3-06: auth guard template`.

### V3-07 — The Favorites template

Implement [contract](contract.md) §3:

- the template;
- its module kind in the catalog and the module menu, marked Template;
- the `items` slot to a Data access row (drawn and authored like the loader);
- its table and endpoints, including the one-item check;
- the `eligible` hook in a hooks file;
- the bounds in a `favorites-policy` record;
- the Auth guard requirement (a Stub with a plain reason without a Required guard in the same
  tile);
- chat parity.

**Tests**

- Unit tests.
- A Docker run of a small design: a Service with a required guard, Favorites, a database, and a
  Data access on a second database that publishes a view.
  - With a token: add, check, list and remove work.
  - Without one: 401.
  - The unwritten `eligible` answers "Not implemented: eligible".
  - With `eligible` filled in a scratch copy to read the view, an ineligible item is refused
    with 404, and the 1,001st favorite with 409.

**Commit:** `V3-07: favorites template`.

### V3-08 — Process settings, search and delivery, robustness

- **D5 ([contract](contract.md) §4):** while Runnable processes is on, Service and Uploads tiles
  show Request timeout and Concurrency limit, and Worker tiles show Concurrency, which stub loops
  use. All are consumed.
- **Search ([contract](contract.md) §5):** mount search projection and search query on hooks
  files that hold the mapping, document, event, preset and hit. Both assert the index at start.
  Until the hooks are written they answer "Not implemented" naming the hook, and stay healthy.
  This replaces row 8.
- **Delivery:** a CDN tile in front of public object storage gets the edge route `/cdn/<cdn id>/`
  (contract question 10).
- **Tile-processes review follow-ups:**
  - row 6: each consuming module gets its own subscriber queue when a tile has several on one
    topic;
  - row 7: a reached unwritten hook is terminal at once.
- **A short Docker fault drill** (row 5): stop the broker. A process drains, exits 1 and stays
  exited, and start recovers it. A stub's own error retries 5 times.

**Tests:** unit tests; in Docker, a stub-only Service's Request timeout set by mouse reaches its
process, filled search hooks in a scratch copy index and find a document, a public object is
served at `/cdn/<cdn id>/`, and the fault drill.

**Commit:** `V3-08: process settings and robustness`.

## Phase C — A better chat agent

### V3-09 — Chat tools that carry the knowledge (D6)

**Goal:** a modest model builds and reviews correct diagrams because the tools do the hard
parts. Chat can do exactly what the mouse can, and no more.

- **The same surface as the mouse:** chat's commands are the supported authoring commands, with
  the fan's 11 tile kinds, the module catalog and the processes option. Update the eval seeds
  that used Billing.
- **Knowledge in the tools:**
  - `listStudioDefinitions` returns the module catalog (slots, hosts, Template / Part of a
    template / Stub, the one-line descriptions) and the tile kinds with their labels.
  - `getDesign` returns a compact, readable design: tiles, links, modules and statuses.
- **Applying a pattern:** `applyPattern` applies a curated, module-authored pattern from the
  design playbook as **one validated batch**, with names and links filled in from the
  arguments. The patterns are:
  - the upload pipeline;
  - the read path with a cache loader;
  - counting from events;
  - search fed by events;
  - required or optional sign-in;
  - favorites;
  - a store with one writer and published views.

  `listStudioPatterns` describes each pattern's arguments.
- **Preview:** `previewCommands` dry-runs a batch and returns the resulting statuses and findings
  without saving.
- **Review:** `reviewDesign` adds:
  - module statuses and their reasons;
  - required slots left unconnected;
  - generation findings;
  - the playbook smells (a store with no writer, a worker writing an unrelated store, a user
    reaching a store, a long line to a far store);
  - line styles that contradict their channel.

  Each finding names its tile or module and a concrete fix, as a command where possible.
- **The working loop:** **plan → preview → apply → review → fix**. Chat runs a review after every
  change it saves and reports what's left. Keep the system prompt short; the tools do the
  teaching.
- **The legend and direct async lines ([contract](contract.md) question 12, answered
  2026-11-11):** the legend shows only the dashed **Async** sample. Remove its explanatory help
  text. Direct async lines stay allowed. The review accepts a dashed line with no queue or topic where the link table
  allows one (between applications, or to and from an External API), and flags a line whose
  style contradicts its channel.

**Commit:** `V3-09: chat tools that carry the knowledge`.

### V3-10 — Chat evals that score real designs

- **The v3 reference:** write `jeeves/packages/spec/src/fixtures/v3-modules.ts`, contract §5 as
  commands (as `v2-modules.ts` is for v2). Generalise `v2-diff.ts` so it compares any two designs
  by name, with a list of intended differences. V3-11 compares its mouse build with this fixture.
- **Build-from-brief eval:** give chat the v3 brief (contract §5 in prose) and score the saved
  design with the generalised diff against the v3 reference. Score tiles, links, modules and
  module links, and templates resolved, from 0 to 100 per area.
- **Review eval:** seed designs with known defects (one per smell and status class). Score
  whether chat names each one and fixes it.
- **Model comparison:** the harness runs any configured provider and model. Recorded replay runs
  offline, as RF06 does.
  - The **live comparison** of a cheap model against a stronger one needs the owner's explicit
    go-ahead at run time; the coordinator asks first.
  - Never store keys.
  - Record the scores in `docs/evals/`.
- `docs/chat-evals.md` explains how to run the evals and how to read the scores.

**Commit:** `V3-10: chat design evals`.

## Phase D — YouTube v3

### V3-11 — Design v3 by mouse

- Build [contract](contract.md) §5 **by mouse** in a blank project, in Detailed, with the new +
  and Connect: its 31 steps, 26 modules with names and descriptions, 30 module connections and 8
  values, then tick Runnable processes.
- Check:
  - the structural diff against V3-10's reference has 0 unexpected rows;
  - 21 tiles and 33 lines in Simple, 8 of them dashed;
  - Generate → Preview resolves 11 template selections (Sign-in ×3, Cache read, Favorites,
    Multipart upload, Video encoding, Upload lifecycle, Event counter, Search indexing, Search
    query) and 2 stubs (View count reader, View publisher), with no findings and runnable.
- Keep the project in the owner's database as **"YouTube v3"**.
- Save its snapshot to `field-projects/youtube/v3/{inputs,diagrams}`: the design, the blueprint,
  and Detailed and Simple PNG exports. Exclude their JSON from Biome, as v1's and v2's are.
- Note how many mouse steps it took and what was awkward.

**Commit:** `V3-11: design v3 by mouse`.

### V3-12 — Generated output

- Export v3, with Runnable processes on, into `field-projects/youtube/v3/generated/`. Commit it
  untouched, adding no file to it: its `README.md` is the export's own. This is the owner's
  generated-code-only deliverable. Explain both outputs and how to run each in
  `field-projects/youtube/v3/notes/README.md`.
- Check, from an outside copy:
  - install, build and first-run;
  - every process healthy;
  - each missing hook or stub answers "Not implemented" by name.
- In the same commit, copy `generated/` to `app/` byte for byte. That commit is the benchmark
  baseline ([contract](contract.md) §6). Start `notes/custom-paths.md` empty, and write
  `notes/benchmarks/backend-scope.json`, reviewed against the export.
- Exclude `v3/generated` and `v3/app` from Biome.

**Commit:** `V3-12: v3 generated output`.

### V3-13 to V3-16 — Complete v3 in `app/`

Each unit fills the product hooks, stub bodies and product SQL for one area, in the order a
request reaches them. Each one reruns its path in Docker after each step and keeps
`generated/` untouched. They reuse v1/v2 product code only where it fits the hook interfaces.
They record each added or changed path in `notes/custom-paths.md`, with what was written and why.

| Unit | Area ([contract](contract.md) §5 and §7) |
| --- | --- |
| V3-13 | Upload: the account script (role `creator`; users `creator`, `other-creator` and `viewer`), the creator check wrapped around multipart's `principal`, the multipart hooks, and the lifecycle hooks an upload reaches (`metadata`, `job`, `response`) |
| V3-14 | Processing and lifecycle: transcoder codecs, lifecycle codecs, publication, and `published.videos` in the Lifecycle writer's SQL file |
| V3-15 | Watch and Favorites: the cache read hooks over `published.videos`, the counter's hooks, the View count reader, the View publisher (ready videos only, with the optional viewer), and Favorites' `eligible` over `published.videos` |
| V3-16 | Search, plus the browser: the search hooks (mapping, document, event, preset, hit); the v2 browser moved to v3's routes, with optional sign-in for watchers and a favorite toggle and list for signed-in watchers, served by the edge |

**Commits:** `V3-13: complete upload`, `V3-14: complete processing`, `V3-15: complete watch and
favorites`, `V3-16: complete search and browser`.

### V3-17 — End-to-end acceptance and benchmark

- **Independent run:** copy `app/` outside the checkout and run it on its own project and ports.
  Observe S01–S10 as [contract](contract.md) §7 says, by mouse in the browser and by API:
  - creator sign-in and a multipart upload with resume;
  - processing, publication and playback;
  - search;
  - counts for a signed-in watcher and for an anonymous one;
  - Favorites for a signed-in watcher, and 401 for an anonymous one.

  Stop and start keep the data. Record what was observed and what was not.
- **`custom-paths.md` check:** it matches `diff -rq generated app`.
- **Backend LOC benchmark:** `pnpm benchmark:source field-projects/youtube/v3/app <V3-12 commit>
  <final commit> field-projects/youtube/v3/notes/benchmarks/backend-scope.json`, backend only,
  following `docs/field-projects/source-loc.md`.
- **Owner review pack:** `field-projects/youtube/v3/notes/review-pack.md`, covering how to run
  each output, what's generated versus custom, and the screenshots.

**Commit:** `V3-17: v3 acceptance and benchmark`.

## Phase E — Review

### V3-18 — Independent review

A fresh agent adds no features. It checks the owner's feedback items 1–14 and D1–D8 by mouse and
against the evidence. It fixes small defects, with tests, and writes
`docs/plans/youtube-v3/review.md` with ranked follow-ups, including the Marketplace revisit with
buyer and seller accounts.

**Commit:** `V3-18: review v3`.

## Risks and stop conditions

- **Contract (V3-04):** if a decision can't be met without inventing product behaviour or a
  forms-based "Advanced" UI, stop and report.
- **Docker:** if Docker or images are unavailable, report it. Do not substitute mocks for the
  acceptance runs.
- **Completion (V3-13 to V3-16):** if a hook interface can't express a v1/v2 behaviour, record it
  as a template gap; don't patch generated files in `generated/`.
- **Chat evals (V3-10):** live provider calls only with explicit opt-in. Never store keys.

## Coordinator prompt

> You are a fresh agent in `/home/ash/github/jeeves`. Do unit **V3-nn** of
> `docs/plans/youtube-v3/units.md`, and only that unit. First read `AGENTS.md`, the latest
> `docs/handoff.md` entries, this plan (owner feedback, confirmed decisions, constraints, rules),
> the HUMAN_FEEDBACK entry, and (from V3-05) `docs/plans/youtube-v3/contract.md`. Follow the unit,
> run every check, append a handoff entry, make one local commit named as the unit says, and
> stop. If a stop condition applies, or a file you must change has someone else's uncommitted
> edits, report and stop without committing.
