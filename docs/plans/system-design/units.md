# System design units

**Status: approved 2026-11-06.** Five units, run in order: SD01 → SD05. A fresh agent runs one
unit at a time on primary `main`.
**Progress:** SD01 is done (see [the handoff](../../handoff.md)).

## Why

The owner reviewed YouTube after the lane-actions plan. The review is the last entry in
[HUMAN_FEEDBACK](../../HUMAN_FEEDBACK.md#2026-11-06--youtube-v2-search-feed-upload-forks-layout-xus-design),
with the marked-up image. In short:

- The Video processor writes the Search index directly; search should be fed from the video's
  data.
- The Upload service's line to Original videos runs under the whole pipeline, and the Watch API's
  forks look the same. A tile seems to split into two lanes.
- The Video CDN takes a long path to reach one store.
- Alex Xu's *System Design Interview*, "Design YouTube", has a fuller and clearer upload path
  (transcoding servers, a completion queue, a completion handler, a metadata cache and DB).
- Lessons like these should be kept, so agents design better over time.

Owner answers (2026-11-06):

- **Uploads go through a service.** The diagram keeps Publish → Upload service → Original videos.
  A signed URL straight to storage only changes where the bytes travel, so it is a choice on the
  Upload service, not a different diagram.
- **Search is fed by an event and an indexer worker,** as in the marketplace.
- **Stores sit beside the tiles that use them,** so a fork is two short branches.
- **YouTube v2 follows Xu, mapped to templates,** keeping one writer per store and recording every
  difference.

Not in scope (still open owner questions): the fit's padding, DP01's dots, the fan latch and
placement, notices clearing, the blueprint `access` name, and the other LA05 questions.

## Rules for every unit

The [lane-actions rules](../lane-actions/units.md#rules-for-every-unit) apply. They include the
design-polish rules, the process and project rules, and "rules belong in the spec". In addition:

- Commit as `SDnn: <summary>`. Head the handoff entry `## <date> — SDnn: <summary> (complete)`.
- Read [HUMAN_FEEDBACK](../../HUMAN_FEEDBACK.md) and, from SD02 on, the
  [design playbook](../../design-playbook.md).
- Append what your unit resolved to the last HUMAN_FEEDBACK entry's **Resolution**. Never rewrite
  its other sections.
- The [extension ladder](../design-polish/units.md#rules-for-the-studies-dp08-dp09) applies to
  any option a unit adds. Step 5 (a new tile type or a lane-rule change) means stop and ask.

---

## SD01 — Design playbook

**Do:** research, then write `docs/design-playbook.md`, the design knowledge agents read before
designing a study.

- **Sources:**
  - Alex Xu, *System Design Interview*, "Design YouTube" (ByteByteGo), and the sources the three
    studies already cite (see their doc comments and the studio guide)
  - HelloInterview's YouTube and Dropbox breakdowns, for the upload and media pipeline
  - one or two engineering write-ups on search indexing from events, and on counting from events
- **Content: patterns.** Each pattern gets the problem, the shape, how it maps to Jeeves tiles,
  kinds and settings, the template it implies, where real systems or sources differ, and the
  sources. At least:
  - uploading large files through an upload service: proxied or signed URL, resumable or
    multipart
  - a media pipeline: job queue → workers → output store, then a completion event → a completion
    handler that records the result
  - search fed by events through an indexer worker
  - the read path: an API with a cache in front of a database, and who writes the cache
  - counting from events (events → aggregator → counts store)
  - a CDN pulling from object storage
  - one writer per store: how to turn a design with two writers into one (route writes through
    the owner by events, or carry data in a job)
- **Content: smells.** Shapes that read wrong on the canvas, each with its fix:
  - the user reaching a store
  - a worker writing a store for an unrelated concern (the processor writing the search index)
  - a fork that reads as a second lane
  - a long line to a far store
  - a store nobody reads
  - two writers
  - a gateway that does nothing a reader needs to see
- **Content: gaps.** Patterns Jeeves can't draw today, such as a database's change stream feeding
  a queue (store → queue), with the extension-ladder step each would need. Don't build them.
- **Check the studies.** Check TinyURL and the marketplace against the smells. List what you find
  in the handoff as follow-ups, and don't change them.
- **AGENTS.md:** drop "(once it exists)" from the playbook line.

No code. **Checks:** `pnpm check` still passes. The playbook is reviewed by reading; E2E and the
browser check are not needed for a docs-only unit.
**Commit:** `SD01: design playbook`

## SD02 — YouTube v2

**Read:** the playbook, `packages/spec/src/studio-examples/youtube.ts`, the DP09 and LA01–LA03
handoff entries, and the marketplace study (for its search indexer).

**Do:**

1. **Design YouTube v2** (`studio-youtube@2.0.0`) from the playbook and Xu, mapped to Jeeves
   kinds. This starting point can change with stated reasons:
   - **Watch:**
     - Watch API → Metadata cache and Metadata DB (reads) and ⇢ View events.
     - View events ⇢ View counter → View counts.
     - Search API → Search index.
     - Video CDN → Transcoded videos (origin pull).
   - **Publish:**
     - Upload service → Original videos, and ⇢ Upload jobs.
     - Upload jobs ⇢ Transcoder: reads Original videos, writes Transcoded videos, ⇢ Completion
       events.
     - Completion events ⇢ Completion handler, the one writer of the Metadata DB and cache.
     - Completion events ⇢ Search indexer → Search index.
     - Identity.
   - **One writer per store.** Where Xu has two writers (the API servers also write metadata),
     route the write through the owner (for example the title rides in the upload job) and say
     so.
   - **The load balancer.** Add a Gateway only if a reader needs to see it, and record the
     decision.
2. **The upload transfer choice.** Decide by the ladder between a new **Uploads** kind (step 2:
   two languages, a preset, and the template it implies, such as an open-source resumable upload
   server) and a setting on the existing kind (step 3: schema, form, validation, blueprint, docs).
   Record the choice and why.
3. **Caps.** Stay within `laneLimits`. If v2 needs more, raise a cap (step 4) and say why.
4. **Sources** in the study's doc comment and the studio guide's YouTube section. Every tile traces
   to a source or a stated decision.

**Tests:** the study validates with no findings or warnings; the blueprint counts; unit tests for
any kind or setting added.
**Browser:** v2 renders; each tile's inspector shows sensible presets; each store shows one writer.
**Docs:** the studio guide's YouTube section, CATALOG Studies, settings, the blueprint doc if
affected, the playbook (anything learned).
**Commit:** `SD02: YouTube v2 from Xu's design`

## SD03 — Stores beside their users

**Read:** `packages/board/src/layout/` (`bands.ts`, `junctions.ts`, `align.ts`, `engine.ts`,
`elkGraph.ts`, `layout.test.ts`), `apps/web/src/canvas/laneLayout.ts`, and the LA03 handoff
entry (why the bands are laid out per band).

**Do:** today every store ends up in the last column, so a tile that reads a store draws a long
line beside the pipeline. Instead:

1. **A store sits in the column right after the tile that uses it.** For a store several tiles
   use, choose the column that makes the lines shortest, preferring the earliest user in lane
   order. A later user's line then comes back to it.
2. **A fork is two short branches.** A tile's lines to its own stores don't run alongside the
   pipeline it also feeds.
3. **Keep LA03 and DP01.** The bands, no shared runs across lanes, grid alignment, straight
   near-straight lines and edit stability all still hold.
4. **The board stays generic** (no Jeeves imports). ELK options, per-band layouts or a post-pass
   are all allowed; choose by measurement and say why.
5. **Studies.** Re-choose each study's entry and link orders under the new layout, as LA03 did.

**Acceptance (unit-tested with real ELK, on all three studies):**

- A store with one user sits in the column right after it.
- YouTube v2: the Video CDN's line to Transcoded videos spans at most one column gap. The Upload
  service's line to Original videos doesn't run under the pipeline.
- The total line length and the longest line are both shorter than LA03's for every study.
  Report the numbers.
- LA03's and DP01's acceptance still hold.

If the rules can't all hold for some study, stop and report with measurements and screenshots.
Don't weaken the bands.

**Browser:** the three studies fitted at both window sizes. Before and after screenshots of
YouTube go in `docs/human-feedback/` and under the HUMAN_FEEDBACK entry's Resolution.
**Docs:** the studio guide's Layout section and Limits.
**Commit:** `SD03: stores beside their users`

## SD04 — Acceptance, docs and the owner's copy

**Do:**

- Walk through SD02–SD03 by mouse at 1440×900 and 1280×800, light and dark: the three studies,
  YouTube v2's inspectors, the upload transfer choice, and an edit plus Undo on each study. Record
  anything rough; fix small defects.
- **The owner's `jeeves` database:** replace the YouTube copy `7ec5980c-6191-40a4-8688-fa2dd8821d54`
  with a fresh v2 from **New project**, using your own API port, never 4310. Leave the Marketplace
  copy and the owner's TinyURL unchanged. Record the new ID.
- Finish the HUMAN_FEEDBACK entry's Resolution: what changed, the commits, and what's open.
- Sweep the docs (the AGENTS.md list, PLAN.md and the playbook), and mark this plan's progress
  (SD01–SD04 done, SD05 remains).

**Commit:** `SD04: system design acceptance and documentation`

## SD05 — Review of SD01–SD04

Follows the [LA05 pattern](../lane-actions/units.md#la05--review-of-la01la04): a narrow review of
what falls between units, on `<this plan's commit>..HEAD`.

1. **Rough-edge ledger.** Every rough edge, deviation and note from the SD handoff entries, each
   fixed, still open or no longer applicable.
2. **Correctness review.** `/code-review` at `high`, keeping only findings you can show. Then the
   seams:
   - the playbook agrees with YouTube v2 and the guide
   - any kind or setting SD02 added is complete per AGENTS.md
   - the layout change keeps LA03's and DP01's tests meaningful (no test loosened to pass)
   - HUMAN_FEEDBACK's Resolution matches the commits
3. **Fix confirmed defects only,** each with a test that fails before and passes after.

**Don't:** rename, refactor, reword what isn't wrong, or change recorded decisions; list doubts as
owner questions. **Handoff:** the ledger, the findings table and owner questions. Mark the plan
complete.
**Commit:** `SD05: review of the system design units`
