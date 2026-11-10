# Tile processes: independent review (TP09)

Reviewed 2026-11-10 against the [plan](units.md)'s owner decisions and the [contract](contract.md).
Commits `e8b53a3` (plan) to `ef50543` (TP08), on baseline `f84a27c`, then
`TP09: review tile processes`.

How: the TP02–TP08 [evidence](#evidence), then my own runs. Docker: my own projects
`jeeves-tp09-stub` (ports 45490–45492) and `jeeves-tp09-v2` (45493–45495). Browser: my own API
(4379, scratch database `jeeves_tp09`, now dropped) and Vite (4369), scripted Chromium using the
mouse (keys only to type a name). The owner's servers, stacks and projects were not touched.

## The owner's decisions

| # | Decision | Verdict | What I saw |
| --- | --- | --- | --- |
| 1 | IDs follow names | **Delivered** | At 1440×900 and 1280×800, by mouse: a blank project, then Consume → Microservice → Queue or topic → Worker service from the fans. The Worker renamed by typing became `video-lifecycle-worker` and stayed selected; a Data access from its `+`, renamed "State writer", became `video-lifecycle-worker-state-writer`, and Undo moved it back to `…-data-access`. "Microservice" waited in the field with the clash reason and saved nothing. Ticking Runnable processes, Preview listed `app-microservice` and `app-video-lifecycle-worker` ([1280](evidence/tp09/ids-processes-1280.png)). Chat builds the same batches (below). |
| 2 | Opt-in, off by default | **Delivered** | Generate project's "Runnable processes" box starts unticked; a tick is one revision and one Undo step (the e2e test). Off, the [pin](../../../jeeves-generator/src/v2/fixtures/processes-off.json) of frozen v2, the v2 module design and the stub stack passes, and frozen v2 and v1 hold (below). A study or frozen v2 refuses the same way by mouse and chat. |
| 3 | Provisioning for stubs | **Delivered**, with the contract's limits | The stub stack's 10 containers came up healthy with 0 restarts, and all 8 store probes passed, again after stop and start. Not provisioned, as the contract says: Identity for stubs, CDN and External API tiles, other providers (an `unsupported` gap). Stub logins get no table rights (follow-up 2). |
| 4 | Consume loops survive "Not implemented" | **Delivered** | One message to Visits went to `visits--visit-worker.failed` on its first delivery (`NOT_IMPLEMENTED`, attempt 1) with one log line; every process stayed healthy, and the dead letter was still there after stop and start. Retries of a stub's other errors are tested only in units, on the real delivery runner (follow-up 5). |
| 5 | Usable dots; a connect drag pans at the edge | **Delivered** | YouTube study, Detailed + Connect at the fit: the dot is drawn 4.0px and 3.5px, and its hit area measures 16.5×11.5px at 1440 (zoom 0.337) and 16.75×10px at 1280 (zoom 0.295), as TP02 recorded. A press 7px left of View publisher's dot, released on View counts, connected the module; Undo removed it ([1440](evidence/tp09/dots-fit-1440.png)). Zoomed in with the inspector open, a drag from Job publisher held past the edge panned 406px in 1.1 s (1440) and 335px in 0.9 s (1280) at the same zoom, and the release on Metadata database connected. |
| 6 | The owner's own UI edits are play | **Held** | No unit treated an owner edit as an incident or touched an owner project. MA10's note on the frozen v2 studio project (revision 4) is still the owner's call. |

## My Docker runs

- **Stub stack**, as the plan asked (shorter than TP08's): exported with processes on (71 files,
  0 findings, `runnable: true`); install 0.3 s, build 0.5 s, `first-run` 65.8 s. Edge and 4
  `app-*` healthy, 10 containers, 0 restarts, no restart policy; 8 probes `ok`. Through the edge:
  `/healthz` and both public `/healthz` 200; `redirector`, `redirector/abc`, `link-reader` (POST)
  and `archive-upload` 501 "Not implemented: <name>"; `modules/nope`, the loop's path and the
  internal Stats API 404. `pnpm stop` 3.1 s (every `app-*` exit 0, OpenSearch 143), `pnpm start`
  42.4 s: the same 10 secret hashes (`.runtime` 0700), the same 5 volumes and creation times, the
  dead letter, 8 probes again, the same answers.
- **v2 module design, short smoke of the two fixes** (not a repeat of TP08's acceptance run,
  whose evidence is consistent): 98 files, `first-run` 126.3 s, 14 containers healthy. Each of
  the 7 templates logged its new `started` line. One message each to `upload-queue`,
  `completion-events`, `view-events` and `publication-events` went to `.failed` as
  `NOT_IMPLEMENTED` (TP08: three were `MALFORMED_MESSAGE`), each log line naming its hook. Then,
  in that scratch export only, I wrote the event counter's four hooks and ran `pnpm build` and
  `pnpm start` (42.6 s; no scaffold edit). Three deliveries of two views of one video, one view
  sent twice, gave 2 receipts and `counter_sum_public.totals` = `v1|2`; a view without a video went
  to `.failed` as `MALFORMED_MESSAGE`, beside the earlier `NOT_IMPLEMENTED` one. 2.29 GiB at rest.
- **Cleanup:** both projects `down --volumes --remove-orphans`, three image tags removed, the
  scratch exports and their `.runtime/secrets` deleted. Against the record taken before the
  unit, the owner's container IDs and names, 18 volumes, 9 networks, 31 image tag and digest rows
  and the listening ports in 454xx (only 45400–45402) are identical; 42 containers are healthy
  and both edges answer `/healthz` 200.

## Invariants

| Invariant | Result |
| --- | --- |
| Processes-off pin | **Passes** (`processes-off.test.ts` in `pnpm check`). |
| Frozen v2 (module authoring contract §8) | **Holds.** A fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json`: 72 files, 70 byte-identical to `generic-export.tar.gz`; `manifest.json` and `report.json` equal once their source and emitter inventory is set aside. |
| v1 frozen export | **Byte-identical** (`assemble.test.ts` in `pnpm check`). |
| YouTube Overview PNG, 1440×900 | **`472a4c8c…dc9f`**, unchanged (exported by mouse from a new YouTube study). |
| Mouse and chat parity | **Holds.** In a scratch script, `buildStudioCommand` (mouse) and `buildSupportedAuthoringCommand` (chat) gave the same batch or the same refusal in 12 cases: `setRunnableProcesses` on (v2 module design, stub stack), off, twice, on frozen v2 and on the TinyURL study; renames that re-key a tile, a following module, a tile with its following module (cascade), a hand-chosen module ID (no re-key), a clash, and a pinned frozen v2 tile. |

## Fixes in this unit

1. **The e2e flake was a race in the test, now fixed.** `module-authoring.spec.ts`'s `build`
   helper clicked the next tile as soon as the board was ready, but a new tile is selected only
   when its commit lands (`creation.tsx`, `commitAction(...).then(onCreated)`). Under load the
   commit landed after the click on Microservice, moved the selection to the new tile and hid
   Microservice's tabs, so `pull` waited for "Add linked tile" until the test timed out, as in
   TP08. I reproduced it on purpose by holding each commit's response until just after the next
   click: the old helper timed out at exactly that step; the fixed one passed. The helper now
   waits for each new tile (and the action) to be selected before going on, as `spawn.spec.ts`
   already did. No assertion changed. It affected the three tests that link twice from
   Microservice: "connects a module from its dot…", "the Cache reader's loader…" and "a cache
   read built by mouse…" (TP08's `:497`).
2. **A template's dead letter names an unwritten hook** (TP08 finding 3). `templateHandler`
   (`tile-loop.ts`) sends a message that reached a hook that isn't written to `.failed` as
   `NOT_IMPLEMENTED`, as a stub's does, instead of the template's generic `MALFORMED_MESSAGE` or
   `RETRY_EXHAUSTED`. A code of the template's own (the media worker's `INVALID_MEDIA`, which its
   `onTerminal` reads) is kept, and so are its retries; bad input with no unwritten hook still says
   `MALFORMED_MESSAGE`. The report's loop `answers` say the same. Tests: one changed and two new
   in `tile-loop.test.ts` (one on the real delivery runner's dead-letter header); all three fail
   without the fix.
3. **Template startup says what it checked** (TP08 finding 2). Just before the ready marker, each
   mounted or placeholder template logs one line, for example
   `{"level":"info","event":"started","tile":"completion-handler","module":"handler-writer","template":"asset-lifecycle","wiring":"mounted","checks":["sweep at start","publication relay started","subscribed completion-events--completion-handler","sweep every 30 s"]}`.
   It lists only what its code ran before that point (the cache read lists only its source
   login's `SELECT 1`, since a cache failing at start is allowed). Tests: `loop-wiring.test.ts`,
   `http-wiring.test.ts`, `tile-loop.test.ts`.
4. **Docs.** The generator README said `tile-process.ts` holds the 501 wrapper (TP06 moved it to
   `tile-http.ts`); `studio-settings.md` said application processes stay custom work even with the
   option on. Both fixed, and the README and contract §3 now describe fixes 2 and 3.

Fixes 2 and 3 change only exports with processes on; the off pin, frozen v2 and v1 are unchanged.

**Leftovers search.** `unprovisioned` survives only in two test names (it is gone from the
code since TP07), and TP06's `stubProvisioned` and queue block are gone. `loopBroker` is still
used: a stub-only design emits no `service-resources.ts`. No other dead code from replaced paths.

**Secrets.** The repository holds no runtime secrets: the only `.runtime` folders are the
owner's two field apps, both ignored. Every export's `.gitignore` lists `.runtime/` and its
`.dockerignore` lists `.runtime`, so credentials stay out of Git and out of the image. The
evidence omits key IDs and passwords.

## Earlier deviations, checked

| Deviation | Verdict |
| --- | --- |
| TP06: on stop, a message waiting to retry is republished to its queue (attempt + 1) instead of left unacked | Sound: nothing is lost or doubled (the ack follows the broker's confirm), only one attempt is spent. The README says so. |
| TP06: two loops in one tile on one topic share `<topic>--<tile>` | Works as documented, but each event reaches only one of the two modules, which a reader of the canvas wouldn't expect (follow-up 6). |
| TP07: stubs never get a real Identity verifier | Sound: a template that binds Identity holds its tile's only Auth guard, so the contract's exception can't arise. A stub Auth guard answers "Not implemented". |

## Follow-ups, most important first

| # | Issue | Suggested next step | Owner decision? |
| --- | --- | --- | --- |
| 1 | **Past the first hook is mostly untested** (TP08 finding 1). A run reaches 5 of the 37 hooks. I ran one template (the event counter) past its first hook, by writing its hooks in a scratch export; the multipart, cache read, lifecycle and video paths behind their first hook have never run in a process. | Fill hooks in the order a request reaches them, rerunning after each, in a field project (YouTube v3, row 3). The `started` lines and the dead-letter reason now show how far each run got. | No (the order is generic) |
| 2 | **Logins can't read what a written hook needs** (TP08 finding 4). The cache read's source login and stub logins get CONNECT and USAGE only, and Metadata database publishes no view, so a written `load` needs a hand-made view and grant in `infra/local.json`. | Decide how product tables and reads are declared: a per-module migration file that export carries over, or a view the source's owner publishes for a loader link. | **Yes** |
| 3 | **YouTube v3 readiness.** The module-authoring blockers are gone: IDs follow names (TP03), every tile is a process (TP04–TP07), Watch API's two stubs answer 501. Left: empty system and tile descriptions, every product hook, the search mappings and query preset (data), and row 2. | Start v3 from the module-built design (the kept MA09 rebuild, renamed by mouse, or the fixture) with processes on, and fill hooks per row 1. | **Yes** (start v3, and from which design) |
| 4 | **Settings still appear only once a template derives** (module authoring follow-up 4, which the plan hoped processes would settle). They don't: a stub-only HTTP process runs on the fixed 1000 ms and 1000 (listed in the report), and no control changes them. | Decide whether Request timeout and Concurrency limit show on every HTTP tile while Runnable processes is on, now that a process uses them. | **Yes** |
| 5 | **Not exercised in Docker** (TP08 finding 6): a lost broker (the process should drain, exit 1 and stay exited), a stub's own errors and their 5 retries, Identity for stubs. | A short fault drill on a scratch stub stack: stop the broker; make one scratch stub throw another error. | No |
| 6 | **Two consumers of one topic in one tile split its events** (TP06). Each event reaches only one of them. | Give each consuming module its own subscriber queue when a tile has more than one on a topic, or say so at connect time. | No |
| 7 | **An unwritten effect hook still retries** within its template's limit (the lifecycle's 10, at once) before going to `.failed` as `NOT_IMPLEMENTED`. Bounded, but pointless. | Make a reached unwritten hook terminal at once in `templateHandler`, as for stubs. | No |
| 8 | **Search stays placeholders** (TP08 finding 5): no index, both search gaps `unfinished`, and the indexer builds no search client, so its access is never probed. | Probe the index's cluster from the indexer's placeholder (small); mappings come with v3 (row 3). | No |
| 9 | **TinyURL and Marketplace revisit** (module authoring follow-up 3). Their studies refuse Runnable processes (pinned IDs), and after one module command TinyURL's Cache reader and Data access read Refused. | Rebuild each by mouse as a module-built design, as v2 was, then tick Runnable processes and run it. | **Yes** (rebuild, or one "use local defaults" step) |
| 10 | **Cost** (TP08 finding 7): the v2 stack is 14 containers and 2.3 GiB at rest; `first-run` takes about 2 minutes. | Only if it matters on the owner's machine: smaller OpenSearch and Keycloak memory settings. | No |
| 11 | **Open module-authoring follow-ups** ([review](../module-authoring/review.md)): 5 chat can still add the legacy kinds; 6 the link fan covers its tile in a narrow canvas; 7 ownership clean-up matches facts by key; 8 the frozen v2 studio project is at revision 4; 9 UI10's follow-ups. Follow-ups 1 and 2 are done (TP02, TP03). | As that review suggests. | 5 and 8 **yes**; 6, 7 no; 9 as there |

## Checks

- `pnpm check` exited 0: **634 tests in 89 files** (630 before, plus 4 new; lint: only the
  existing info), 50 s.
- `pnpm test:e2e`: **67 passed (4.4 m)** on the first full run, the fixed spec included.
  `jeeves_e2e` holds only its long-standing "TinyURL · studio study". The deliberate reproduction
  of the race leaked one project, which I deleted.
- `pnpm --filter @jeeves/web build` passed (1.43 s, the existing chunk-size advisory).
- **Mouse check** (scripted Chromium on my own API 4379, scratch database `jeeves_tp09`, now
  dropped, and Vite 4369; 9 of 9, twice): the TinyURL study shows 7 tiles and 7 lines at 1440×900
  and 1280×800, Fit and a tile selected by mouse; the decision 1, 2 and 5 checks above; the PNG
  hash. No page or console errors. All projects were deleted.

## Evidence

- Earlier units: [tp02](evidence/tp02/), [tp04](evidence/tp04/README.md),
  [tp05](evidence/tp05/README.md), [tp06](evidence/tp06/README.md),
  [tp07](evidence/tp07/README.md) and [tp08](evidence/tp08/README.md) with its ranked findings.
- This unit: [dots-fit-1440.png](evidence/tp09/dots-fit-1440.png) (the YouTube study in
  Detailed + Connect at its fit, where every dot was measured) and
  [ids-processes-1280.png](evidence/tp09/ids-processes-1280.png) (Generate project after the
  renames, Runnable processes ticked: the processes take the typed names).
