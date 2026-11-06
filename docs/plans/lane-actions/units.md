# Lane actions units

**Status: complete 2026-11-06.** Five units, run in order: LA01 → LA05. A fresh agent runs one
unit at a time on primary `main`.
**Progress:** LA01–LA05 are done (see [the handoff](../../handoff.md)).

## Why

The owner reviewed the YouTube study after DP10 (2026-11-06) and found it hard to read. The
problems:

- **The user links straight to a store.** A line runs from the User to Original videos, but a user
  never reaches a database or a store directly, and the Upload service already handles uploads.
  Today's link table allows it (`user → object-store` and `user → external` rows).
- **The CDN looks like part of the upload.** Video CDN's line to Encoded videos shares a vertical
  run with the Upload service's lines, so the download and upload paths blur together.
- **The User's tabs are confusing.** It has a `+` and an attach tab for each lane, and the lanes
  are easy to misuse.

The owner's model: a user does one of two things. They **consume** (watch a video) or they
**produce** (publish their own video). So the User branches into at most two **action tiles**, each
with its lane icon and one large word ("Watch", "Publish"). Each action tile then branches to the
services that handle that action. Owner answers of 2026-11-06:

- **One action per lane:** a Consume (download) action and a Produce (upload) action, at most.
- **Lane bands:** consuming tiles sit in a band above, producing tiles in a band below, and tiles
  both lanes use sit between them. A line never shares a run with a line from the other lane.
- **Design warnings:** the canvas, the blueprint and chat report designs that look wrong but are
  allowed (a store nobody writes, a queue nobody consumes). Warnings are never refusals.
- **A small plan with a review unit at the end** (the owner's rule for split-up work).

These answer three of DP10's questions: shared buses (Q2) and download-above-upload (Q8) are
handled by LA03's bands, and a store left without a writer (Q6) becomes a warning in LA02. The
other DP10 questions stay open and are not in scope: fit padding, DP01's dots, DP04's fan latch,
notices clearing, and the `access` field name.

"Why this matters" in [the design-polish plan](../design-polish/units.md#why-this-matters)
still applies: every option maps to a template or stays readable at diagram level. Action tiles
generate no code; they are design intent, telling the reader (and a future generator's frontend
templates) which user flow each service serves.

## Rules for every unit

The [design-polish rules](../design-polish/units.md#rules-for-every-unit) apply, with these
additions:

- Commit as `LAnn: <summary>`. Head the handoff entry `## <date> — LAnn: <summary> (complete)`.
- **Processes:** stop only processes you started, by their PID. Never use `pkill`, `killall` or a
  pattern match. Don't touch the owner's servers on 4300, 4304 or 4310.
- **Projects:** in `jeeves_e2e`, wait for each new project's URL before acting, and delete only the
  projects you created. Only LA04 touches the owner's `jeeves` database.
- **Rules belong in the spec.** Any rule this plan adds lives in `packages/spec` and is used by the
  canvas, chat and blueprint from there. Don't restate a rule by hand in the web app or in chat
  instructions; generate the text from the spec, as DP03 did for the link table.

---

## LA01 — Action tiles

**Read:**

- `packages/spec/src/studio-model.ts` (`studioEntrySchema`, the `both` and language normalisation)
- `studio-links.ts` (the link table, `studioEntryKinds`, `laneLimits`)
- `studio-lanes.ts` (`LANE_ACTOR`, `laneGraph`)
- `studio-lane-commands.ts` (`addTile` from a lane, `linkTiles` from a lane, `setEntryLane`,
  `removeLink` on an entry, `laneOptions`, `attachOptions`, `laneEntryRefusal`)
- `studio-blueprint.ts`, `studio-validation.ts`, the three studies in `studio-examples/`
- `apps/web/src/canvas/LaneCanvas.tsx` (the User tile, entry chips), `creation.tsx` (the User's
  tabs), `Workspace.tsx` (the entry inspector)
- `apps/server/src/chat/tools.ts`
- the studio guide's sections on lanes, creating and connecting, and the inspector

**Do:**

1. **Model.** Add `studio.actions`: at most one per lane, each `{ lane, name }`. `name` is the
   large word, 1–24 characters. An entry (`{ id, lane, element }`) is now a link from its lane's
   action to the element; an entry needs its lane's action. The User links only to actions.
2. **Loading old designs.** Where stored designs are parsed (beside the `both` and language
   normalisation), a lane that has entries but no action gets one with the default name:
   **Consume** for download, **Produce** for upload. Stored entries that reach a store or an
   external API load unchanged and are reported as a finding ("Consume can't link to Original
   videos; an action reaches a service, an API or the CDN."). Commands refuse new ones.
3. **Link table.** Replace the user rows: the User links only to an action. Add an `action` role
   whose rows allow today's application entry kinds and the CDN, by request. Remove
   `user → object-store` and `user → external`. The chat instructions' link paragraph is generated
   from the table, so it follows.
4. **Commands.**
   - `addAction { lane, name? }` (refused when the lane has one) and `renameAction`.
   - `removeAction` removes the action and its entries, and is refused if that would strand tiles,
     like removing an entry today.
   - `addTile` from a lane creates that lane's action with the default name in the same operation
     if it doesn't exist yet.
   - `setEntryLane` moves an entry to the other action, and is refused when that lane has no action
     or is full (`laneLimits.entriesPerLane` still caps entries per action).
5. **Canvas.**
   - The User has one `+` and no attach tab. Its fan offers two items: Consume (download icon) and
     Produce (upload icon). An action that already exists is greyed, with the reason "This design
     already has a Produce action; each lane has one." Nothing attaches onto the User.
   - An action tile is 128×128 on the grid. It shows its lane icon and its name in large type, and
     reads at a glance as the start of a flow, not as a service. It has a right `+` (the
     seven-type fan, greyed by the rules) and an attach tab (onto applications that have no
     entry). It has no left `+`.
   - The User → action line is a plain line. The entry chips are removed, because the action tile
     does their job.
   - The action's inspector has Name (the word), its lane (read-only) and its entries.
6. **Chat.** `addAction`, `renameAction` and `removeAction` go in the tool schema. `getDesign`
   lists the actions and each one's entries. The instructions say what an action is, in two
   sentences.
7. **Blueprint.** Additive, so it stays version 2: a top-level `actions` list, and each entry row
   gains `action` (the name).
8. **Studies,** so they stay valid:
   - TinyURL actions: **Open link** and **Shorten**.
   - Marketplace: **Browse** and **Buy & sell**.
   - YouTube: **Watch** and **Publish**. The user's entry into Original videos goes: the Upload
     service writes Original videos (the multipart, signed-URL upload is the Upload service's job,
     described in its modules).
   - Bump each study's minor version. Layout tuning waits for LA03.

**Tests:** the link rows (user → action only; action → store and action → external refused); one
action per lane; loading a design with entries and no actions; a stored entry into a store (loads,
finding, new one refused); `removeAction` (removes, or refuses when it strands); `addTile` from a
lane creating the action; the blueprint's actions. Update the E2E specs and the chat fixture that
use the User's tabs or entry chips.

**Browser:** from **Blank architecture**: User `+` → Consume, name it Watch; its `+` → API;
User `+` → Produce (Consume now greyed). Then the three studies render with their action words.

**Docs:** the studio guide (lanes, creating and connecting, the inspector, chat), CATALOG (link
table, commands), studio settings (actions), blueprint doc, PLAN (data model, commands).

**Commit:** `LA01: action tiles`

## LA02 — Design warnings

**Read:** `studio-validation.ts` and where findings show today (canvas, blueprint, chat); DP06's
derived store access (`studioStoreAccess`); DP10's handoff finding 4.

**Do:** add warnings to validation. They are findings, never refusals:

1. **A store with no writer:** it has no owner, or its owner has no link into it. This is DP10's
   finding 4: moving or removing the owner's link leaves the store owned but unwritten. Example:
   "URL database has no writer: its owner Shorten service doesn't link to it."
2. **A worker's output nobody reads:** a store whose only links come from its owner, when that
   owner is a worker. TinyURL v2's analytics store is the example. Caches used only by their owner
   are normal and are not flagged.
3. **A queue with no publisher, or no consumer.**
4. **An action with no entries.**

Each warning names the tiles and says what to do in plain words. Chat sees warnings in `getDesign`
and after each command. The instructions say to resolve the warnings it caused before finishing,
in a sentence generated from the warning list. The canvas shows warnings where it shows findings
today. All three studies have none.

**Tests:** each warning, both firing and not firing (including a cache used only by its owner);
the DP10 reproduction (Add before URL database, or remove the Shorten → URL database link) gives
warning 1.

**Docs:** the studio guide (warnings), CATALOG, the blueprint doc if findings change shape.

**Commit:** `LA02: design warnings`

## LA03 — Lane bands

**Read:** `packages/board/src/layout/` (`elkGraph.ts`, `elkLayout.ts`, `engine.ts`, `align.ts` from
DP01, `layout.test.ts`), how `LaneCanvas.tsx` builds the layout input, and the DP08 and DP09
handoff entries on choosing entry orders with real ELK.

**Do:**

1. **Bands.**
   - Each tile belongs to the download band (reached only from the Consume action), the upload
     band (reached only from Produce) or the shared band (reached from both).
   - From top to bottom, the bands are download, shared, upload. The User sits at the left; the
     Consume action is above its centre and the Produce action below.
   - A line belongs to its source tile's band.
2. **No shared runs across lanes.** Two lines from different bands never share a collinear run,
   except within 32px of a shared tile's input port.
3. **Keep DP01's grid rules.** Tiles sit on the grid, near-straight lines are straight, columns
   keep their order.
4. **The board stays generic.** `packages/board` imports no Jeeves code. Pass band membership as
   plain layout input (for example a band index on nodes and edges). ELK option changes are allowed
   now, as are separate per-band layouts or a post-pass. Choose by measurement and say why in the
   handoff.
5. **Studies.** Re-choose each study's entry and link orders with real ELK for the fewest
   crossings and bends under the bands. Report each study's size, crossings, bends and fit zoom.
   The fit's padding is not in scope.

**Acceptance (unit-tested with real ELK):**

- In all three studies, every tile is in its band's rows, and no two lines from different bands
  share a run outside the 32px allowance.
- YouTube: Video CDN's line to Encoded videos shares no run with the Upload service's lines.
- DP01's grid acceptance still holds, and an edit moves only what it changes.

**Browser:** the three studies at the fitted zoom, both window sizes. Screenshot YouTube where the
owner circled (Video CDN, the Upload service, the stores).

**Docs:** the studio guide's Layout section and Limits.

**Commit:** `LA03: lane bands`

## LA04 — Acceptance, docs and the owner's copies

**Do:**

- Walk through LA01–LA03 by mouse at 1440×900 and 1280×800, light and dark:
  - build a small YouTube-like design from Blank with both actions
  - the greyed second action
  - a warning appearing and clearing
  - the three studies in bands
- Record clicks and drags, and anything rough. Fix small defects; record larger ones as follow-ups.
- **The owner's `jeeves` database:** replace the Marketplace and YouTube study copies with fresh
  ones from **New project**, deleting the two old copies (`4222440b…` and `7eef33c4…`). Use your
  own API port against the `jeeves` database, never 4310. Leave the owner's TinyURL project
  (`41bbd268…`) unchanged; check that it loads, with its actions added by normalisation. Record
  the new IDs in the handoff.
- Sweep every doc in the AGENTS.md list and PLAN.md, update the studio guide's Limits, and mark
  this plan's progress (LA01–LA04 done, LA05 remains).

**Commit:** `LA04: lane actions acceptance and documentation`

## LA05 — Review of LA01–LA04

Follows the [DP10 pattern](../design-polish/units.md#dp10--review-of-dp01dp09): a narrow review
of what falls between units, not a second acceptance pass.

**Read:** every LA handoff entry; this plan; `git log --oneline <this plan's commit>..HEAD`. Read the
combined diff only where the steps below point to it.

**Do:**

1. **Rough-edge ledger.** List every rough edge, deviation and next-unit note in the LA handoff
   entries. Give each one a status: fixed (by which unit), still open, or no longer applies. Say in
   one line how you checked.
2. **Correctness review.** Run `/code-review` at `high` on the plan commit..HEAD, keeping only
   findings you can show. Then check these seams yourself:
   - every rule in this plan lives in the spec and nowhere else
   - load-time normalisation: `both`, languages and actions compose
   - nothing still refers to entry chips, the User's attach tab or the old user rows
   - the three studies have no findings or warnings
3. **Fix confirmed defects only,** each with a test that fails before the fix and passes after.

**Don't:** rename, refactor, reformat or reword anything that isn't wrong; add tests for behaviour
that is already covered; change recorded decisions (list doubts as owner questions); add features.

**Handoff:** the ledger, a findings table (severity, `file:line`, what goes wrong, how to reproduce,
fixed or follow-up), and questions for the owner. Mark this plan complete.
**Commit:** `LA05: review of the lane actions units`
