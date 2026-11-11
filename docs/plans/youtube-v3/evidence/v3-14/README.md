# V3-14 evidence: complete processing

2026-11-11. [Plan](../../units.md#v3-13-to-v3-16--complete-v3-in-app) (the V3-14 row) ·
[contract](../../contract.md) §1, §5 and §7 (S04) · field project
[notes](../../../../../field-projects/youtube/v3/notes/README.md) ·
[custom paths](../../../../../field-projects/youtube/v3/notes/custom-paths.md) · v1's
[bounded policies](../../../../../field-projects/youtube/v1/notes/scenarios.md#bounded-v1-policies).

**Result:** in `app/`, a completed upload is now processed and published against the real stack:

- **The lifecycle:** a valid upload goes **pending → processing → ready**. Invalid media goes
  **pending → processing → failed `INVALID_MEDIA`**. A video that waits too long still fails
  `QUEUE_DEADLINE` (10 minutes) or `PROCESSING_DEADLINE` (30 minutes).
- **The Transcoder:** real FFmpeg encoding into Transcoded videos: H.264/AAC HLS at 640×360 and
  1280×720, 4-second segments, a master playlist, a full-size 1280×720 thumbnail, and the
  template's byte-hashed inventory and completion marker. Invalid media writes nothing.
- **`published.videos`:** a re-runnable view in the Lifecycle writer's SQL file. It shows the
  ready video and never a pending, processing or failed one. Watch API's and Account API's logins
  read it, but not the lifecycle's table.
- **Publication:** one `VideoPublished` reaches Publication events, sent by the outbox relay
  after the ready commit, in the same transaction's outbox row. Search indexer then stops at
  "Not implemented: mapping for Index writer" (V3-16's).
- **Repeats and restarts:** a redelivered job changes nothing (the Transcoder reuses its marker,
  the lifecycle's receipt drops the repeat). Stop and start kept everything.
- **`generated/` is untouched**, and no generated scaffold in `app/` was edited. One more template
  gap was found, and S04's status source is decided (below).

## What was written

All of it in `app/`, listed in [`custom-paths.md`](../../../../../field-projects/youtube/v3/notes/custom-paths.md).
From v2's `youtube-events.ts`, `youtube-lifecycle.ts`, `video-paths.ts`, `public-video.ts` and
`youtube-public-sql.ts`, fitted to v3's hooks.

| Path | What |
| --- | --- |
| `src/modules/video-contract.ts` | Added: each attempt's result prefix `videos/<videoId>/<jobId>/<attemptId>/`; the `ProcessingStarted`, `ProcessingSucceeded` and `ProcessingFailed` events and their stable IDs; the public record `publicVideo`, `VideoPublished` and its one ID per video |
| `src/modules/transcoder/transcoder-segmenter-and-encoder.hooks.ts` | Every hook: `job` (`requestedJob`), `video`, `result`, `eventId`, `event`, `source.owns`, `results.owns` |
| `src/modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts` | The rest: `event`, `result`, `failure`, `identities.result`, `identities.publication`, `publication.codec` and `publication.construct` |
| `infra/postgres/metadata/modules/video-lifecycle-lifecycle-writer.sql` | `published.videos` (product SQL, outside the LOC metric) |
| `test/processing.test.ts` (new) | 4 offline tests (Node's own runner) |

The engine, the ladder, the thumbnail, the inventory and the marker are the video HLS template's;
the transitions, deadlines, receipts and the outbox are the asset lifecycle's. The hooks only
shape and bind the product's data.

## S04's status: where it comes from

A video's state is the lifecycle's own record, the template table
`upload_api_multipart_uploads.assets`, and only the lifecycle moves it. **No v3 route can show it
to the creator:** the upload's status route shows the upload's own state (`completed`), and its
hooks can't merge the video's (V3-13's gap 1). **No published view shows it either:** every login
on Metadata, Watch API's and Account API's included, may read `published`, while v2's status was
the creator's alone. So S04's sequence is read where the lifecycle writes it: `assets` as the
database owner in the scratch run (S04 already reads `published.videos` that way), and the
Processing events behind each change (a scratch queue bound to their exchange). Ready is public
through `published.videos`. For V3-16's browser, the upload's status shows `completed`, and the
video is ready once Watch's details route (V3-15) answers it; pending, processing and "failed" with
its message wait for gap 1 to close in the template.

## Docker: the owner's state, recorded first

- **Containers:** 43, of which 42 are healthy and the long-exited `excalidraw` is the other.
- **Other resources:** 18 volumes, 9 networks and 31 image rows (tag, ID and digest).
- **v1:** `jeeves-youtube-v1`, 14 running, edge `127.0.0.1:4400/healthz` 200.
- **v2:** `jeeves-youtube-v2`, 14 running on 45400–45402, edge 200.
- **Ports:** in 454xx only 45400–45402 listened.

**Mine:** project `jeeves-v314-processing` on loopback **45640** (HTTP), **45641** (identity) and
**45642** (objects), all free, with nothing of that name.

## The outside copy

The copy, in the session scratchpad, was `cp -a` of `app/` at V3-13's commit; its 115 file hashes
matched. Each step then rsynced `app/src`, `scripts`, `infra` and `test` into it, ran the staging
script (below), `pnpm build`, `pnpm stop` and `pnpm start`.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts` (Node 24.21.0, pnpm 12.16.1) | exit 0, 0.3 s |
| `pnpm build` | exit 0, 0.4 s |
| `COMPOSE_PROJECT_NAME=jeeves-v314-processing LOCAL_HTTP_PORT=45640 LOCAL_IDENTITY_PORT=45641 LOCAL_OBJECT_PORT=45642 pnpm first-run` | exit 0, 120.6 s; 15 containers healthy, 0 restarts |
| `node scripts/accounts.mjs` | exit 0, 0.7 s: the role and 3 users |

**Each pass** (`step.sh`): the creator signs in by the real PKCE flow, starts an upload of v1's
fixture (15,584,953 bytes, SHA-256 `16587281…ebf9`, copied read only), sends its 3 parts to
signed URLs and completes it (200, `state: "pending"`). From step 7 a second upload is a 12-byte
text file named `invalid.mp4` (1 part). Then the pass watches each asset's state every second,
and dumps the rows, the outbox, the receipts, the queues, two scratch queues bound to the
Processing and Publication events exchanges (`v314-tap-*`), the dead letters (read and put back)
and the "not-implemented" log lines.

## Step by step, in the order a message reaches the hooks

The final hooks were written in `app/`. For each step the staging script (`stage.py`) put back
the exported `throw new NotImplemented("<hook> for <module>")` in every hook after that step, and
left `published.videos` out until the last step. At step 11 the copy's `src/` and SQL equal
`app/`'s.

| Step | Written | Stop / start | Where the job or event stops |
| ---: | --- | --- | --- |
| 0 | nothing (V3-13's commit, no restart) | — | Upload jobs → `upload-jobs.failed`, attempt 1, `NOT_IMPLEMENTED`: "job for Segmenter and encoder". The video stays pending. |
| 1 | Transcoder `job` | 7.8 / 75.8 s | "video for Segmenter and encoder" |
| 2 | `video` | 4.4 / 77.1 s | "results.owns for Segmenter and encoder"; then the Transcoder's failure report reached `eventId`, which threw: **`app-transcoder` exited 1** with no reason, and the job went back to Upload jobs, unacknowledged (gap 5 below) |
| 3 | `results.owns` | 4.4 / **start failed** | `pnpm start` exited 1, "container app-transcoder exited (1)": the Transcoder took step 2's job while subscribing; it passed `results.owns`, sent nothing yet, stopped at `eventId`, and its failure report threw again |
| 4 | `eventId`, `event` | 7.1 / 76.9 s, 15 healthy | Step 2's job, then this step's: **`ProcessingStarted`** goes out, "source.owns for Segmenter and encoder" sends the job to `.failed`, and the failure report sends **`ProcessingFailed` `PROCESSING_FAILED`**. The lifecycle sends both to `processing-events--video-lifecycle.failed`: "event for Lifecycle writer" |
| 5 | `source.owns` | 4.1 / 76.5 s | **The encode runs:** 15 objects (14 in the inventory, plus the marker), 11,456,464 bytes, in Transcoded videos. Then "result for Segmenter and encoder"; `ProcessingFailed` `PROCESSING_FAILED` |
| 6 | Transcoder `result` | 4.3 / 76.7 s | `ProcessingStarted` and **`ProcessingSucceeded`**; the Transcoder is complete (no new dead letter). The lifecycle: "event for Lifecycle writer" |
| 7 | lifecycle `event` | 4.5 / 75.8 s | "identities.result for Lifecycle writer" for both videos. The invalid file: the Transcoder's probe refuses it, `upload-jobs.failed` with **`INVALID_MEDIA`** at attempt 1, and `ProcessingFailed` `INVALID_MEDIA` |
| 8 | `identities.result` | 4.5 / 79.7 s | **pending → processing** (+1 s, +4 s). The valid video's success stops at "result for Lifecycle writer", the invalid one's failure at "failure for Lifecycle writer" |
| 9 | `failure` | 4.4 / 76.5 s | The invalid video: pending → processing → **failed `INVALID_MEDIA`** (state version 4). The valid one: processing; "result for Lifecycle writer" |
| 10 | lifecycle `result` | 4.2 / 75.2 s | The ready transaction reached "identities.publication for Lifecycle writer" and **rolled back**: still processing (v3), with no `succeeded` receipt and no publication row |
| 11 | `identities.publication`, `publication.construct`, `publication.codec`, and `published.videos` | 7.8 / 77.3 s | **ready** and **published** (below). Publication events → Search indexer: "mapping for Index writer" (V3-16's), `publication-events--search-indexer.failed` |

## The recorded pass (step 11, final code)

**Uploads** (`…` is `/api/upload-api/modules/upload-api-multipart-uploads`):

| Request (creator) | Answer |
| --- | --- |
| `POST …/uploads`, the fixture | 200 `{uploadId:"0930376e-…", assetId:"0f6e53ad-…", state:"uploading", partSize:5242880, partCount:3}` |
| 3 × sign, then `PUT` 5,242,880 / 5,242,880 / 5,099,193 bytes | 200 each, ETags `"e427bb2d…8952"`, `"8b07cb8a…9510"`, `"5c1c3548…04e2"` |
| `POST …/uploads/0930376e-…/complete` | 200 `{videoId:"0f6e53ad-…", jobId:"90a284aa-…", attemptId:"72aa8a13-…", state:"pending"}` |
| `POST …/uploads`, `invalid.mp4` (12 bytes), 1 part, complete | 200 each; `videoId:"71e8c353-…"`, `state:"pending"` |

**The lifecycle**, as the pass watched it (state and state version):

```
+0s 0f6e53ad pending v2, 71e8c353 pending v2
+2s 0f6e53ad processing v3, 71e8c353 pending v2
+3s 0f6e53ad ready v4, 71e8c353 failed INVALID_MEDIA v4
```

| Video | State | Queued | Started | Ready | Receipts |
| --- | --- | --- | --- | --- | --- |
| `0f6e53ad` the fixture | **ready** v4 | 23:02:42 | 23:02:42 | 23:02:46 | `started` → started; `succeeded` → ready |
| `71e8c353` invalid | **failed `INVALID_MEDIA`** v4 | 23:02:42 | 23:02:46 | — | `started` → started; `failed` → failed |

(The invalid job waited behind the fixture's encode: the Transcoder runs one job at a time.)

**Processing events** (from the scratch tap; the result abridged):

```json
[
  { "messageId": "f55e7c34-5091-5aa3-820b-17bdfcafa05f", "type": "ProcessingStarted",
    "videoId": "0f6e53ad-79bd-4ebc-85cb-9e4cb09a3678", "jobId": "90a284aa-…", "attemptId": "72aa8a13-…",
    "occurredAt": "2026-11-11T23:02:42.067Z" },
  { "messageId": "111d0fb1-90ba-5580-ae38-b54d231a93ea", "type": "ProcessingSucceeded",
    "occurredAt": "2026-11-11T23:02:45.675Z",
    "result": { "manifest": "videos/0f6e53ad-…/90a284aa-…/72aa8a13-…/master.m3u8",
                "thumbnail": "videos/0f6e53ad-…/90a284aa-…/72aa8a13-…/thumbnail.jpg",
                "durationSeconds": 20, "renditions": ["640x360 h264/aac", "1280x720 h264/aac"] } },
  { "messageId": "b19ecea9-d000-5fd3-9d02-dded219992a0", "type": "ProcessingStarted", "videoId": "71e8c353-…" },
  { "messageId": "3d4a3fa7-f40d-56b2-ab6a-f6b74d317eb5", "type": "ProcessingFailed", "videoId": "71e8c353-…",
    "code": "INVALID_MEDIA" }
]
```

Each message ID is its event ID, derived from the job and attempt in v1's `youtube-v1`
namespace, as v2 kept it.

**Transcoded videos** (listed and probed inside `app-transcoder` with its own storage key and its
pinned `ffprobe`):

- **15 objects, 11,467,932 bytes,** under `videos/0f6e53ad-…/90a284aa-…/72aa8a13-…/`: the marker
  `_complete.json` and its 14-entry inventory, every entry stored with its size.
- **`master.m3u8`:** two variants, `BANDWIDTH=1250000,RESOLUTION=640x360` (`360/index.m3u8`) and
  `BANDWIDTH=3500000,RESOLUTION=1280x720` (`720/index.m3u8`).
- **360p:** 5 segments, `#EXTINF` 4, 4, 4, 4, 4 (20 s). The first segment: `h264` 640×360
  `yuv420p`, `aac` 48 kHz 2 channels, MPEG-TS, 4.02 s.
- **720p:** 5 segments of 4 s (20 s). The first segment: `h264` 1280×720 `yuv420p`, `aac` 48 kHz 2
  channels, MPEG-TS, 4.02 s.
- **Thumbnail:** `mjpeg` 1280×720, the source's full size, 68,896 bytes.
- **The invalid video:** 0 objects.
- **Through the edge, anonymous** (`/cdn/video-delivery/<prefix>…`): `master.m3u8` 200
  `application/vnd.apple.mpegurl`, `360/index.m3u8` 200, `720/segment00000.ts` 200 `video/mp2t`
  (1,786,752 bytes), `thumbnail.jpg` 200 `image/jpeg`. As in v2, the marker is public there too: it
  names the original's key and hash, while the original itself stays 403.

**`published.videos`** (as `postgres`, in my scratch run), after step 11: one row, the ready video,
and none of the other 14 (pending, processing or failed):

| video_id | title | channel | duration_seconds | manifest | thumbnail | published_at | publication_version |
| --- | --- | --- | ---: | --- | --- | --- | ---: |
| `0f6e53ad-…` | V3-14 step11: test card | creator | 20 | `videos/0f6e53ad-…/…/master.m3u8` | `videos/0f6e53ad-…/…/thumbnail.jpg` | 2026-11-11 23:02:45.681+00 | 1 |

- **The view:** owned by `o_metadata`, `security_barrier=true`, SELECT granted to the four
  runtime logins on Metadata.
- **Who reads what:** with each login's own password, `r_metadata__watch_api` and
  `r_metadata__account_api` read 1 row from `published.videos`, and "permission denied for schema
  upload_api_multipart_uploads" from `assets`. Upload API's and Video lifecycle's logins, whose
  templates own the table, read both.
- **Re-runnable:** the file applied at each of the following starts ("Applied
  infra/postgres/metadata/modules/video-lifecycle-lifecycle-writer.sql").

**Publication.** The lifecycle built the event in the transaction that marked the video ready,
and the relay sent it after that commit:

| `ready_at` | asset updated | outbox row created | outbox `sent_at` | intent key | attempts |
| --- | --- | --- | --- | --- | ---: |
| 23:02:45.681 | 23:02:45.682 | 23:02:45.684 | 23:02:45.772 | `publication:0f6e53ad-…:1` | 1 |

The Publication events tap got exactly one message:

```json
{
  "messageId": "156d972c-ae90-59ff-b5b0-437384679cfa",
  "schemaVersion": 1, "type": "VideoPublished", "eventId": "156d972c-ae90-59ff-b5b0-437384679cfa",
  "occurredAt": "2026-11-11T23:02:45.681Z",
  "videoId": "0f6e53ad-79bd-4ebc-85cb-9e4cb09a3678", "publicationVersion": 1,
  "title": "V3-14 step11: test card",
  "description": "V3-14 step11: a 20 s synthetic test card and 440 Hz tone.",
  "channel": "creator", "durationSeconds": 20,
  "manifest": "videos/0f6e53ad-…/90a284aa-…/72aa8a13-…/master.m3u8",
  "thumbnail": "videos/0f6e53ad-…/90a284aa-…/72aa8a13-…/thumbnail.jpg",
  "publishedAt": "2026-11-11T23:02:45.681Z", "visibility": "public", "state": "ready"
}
```

The invalid video has no publication row and no message.

## A repeated job

I sent the ready video's job to Upload jobs again, with its own message ID
(`85200af6-…`, from its outbox row), as a redelivery would:

- the Transcoder found its completion marker and sent only `ProcessingSucceeded`, with the same
  event ID (`111d0fb1-…`), and nothing new in Transcoded videos (still 15 objects);
- the lifecycle's receipt dropped it: still ready v4 with the same `ready_at`, 2 receipts, and 1
  publication row, sent once; no new dead letter.

## Deadlines and failures

Every video the steps left behind ends in a failure state, so nothing hangs. At 23:30:49 all 15
were terminal: 1 ready, 14 failed, and `published.videos` still held only the ready one.

| Videos | State | Why |
| --- | --- | --- |
| steps 0–7 (8 videos; step 3 made none) | failed **`QUEUE_DEADLINE`** | never started: the lifecycle never applied a `ProcessingStarted`, so the sweep failed each at its 10-minute deadline |
| steps 8–10 (4 videos) | processing → failed **`PROCESSING_DEADLINE`** (state version 4) | started, but their result stopped at an unwritten hook; the sweep failed each within 10 s of its 30-minute deadline (23:26:19, 23:26:19, 23:28:31, 23:30:43) |
| steps 9 and 11, invalid | failed **`INVALID_MEDIA`** | the Transcoder's probe refused the file |

**Dead letters** at the end: `upload-jobs.failed` 9 (5 `NOT_IMPLEMENTED` from steps 0, 1, 2, 4
and 5, and 4 `INVALID_MEDIA` from steps 7, 8, 9 and 11), `processing-events--video-lifecycle.failed` 16 (all `NOT_IMPLEMENTED`, steps
4–10), `publication-events--search-indexer.failed` 1 (`NOT_IMPLEMENTED`, `mapping`, V3-16's).

## Stop and start

After the repeated job, `pnpm stop` (4.3 s) and `pnpm start` (65.9 s, 15 healthy, 0 restarts). A
snapshot before and after was **identical**:

- `.runtime` and `.runtime/secrets` 0700, 25 files with the same combined hash; `local-setup.json`;
- the 5 volumes' creation times;
- 15 assets, and a hash of every ready or failed row (state, version, failure, result, `ready_at`);
- `published.videos` (the same one row), the outbox (16 rows, 16 sent), the receipts (10);
- every queue's depth, the ready video's 15 objects, and the realm's 3 accounts.

After the start, the manifest and thumbnail still answered 200 through the edge. Watch's details
route still answers 501 "Not implemented: key for Video details cache" (V3-15's).

## Tests

- **`test/processing.test.ts`:** with `upload.test.ts`, `node --test "test/*.test.ts"` gives **9
  passed** (4 new) in about 200 ms: the Transcoder's job, source, prefix and `owns`; one stable
  event ID per kind, the same in both tiles; the lifecycle's real `parse` over what the
  Transcoder sends (refusing a foreign prefix, a deadline code and a moved message ID); and the
  publication, bound to its event ID and paths.
- **Types:** `tsc` over `src` and `test` together exits 0, and so does every staged step. `pnpm
  build` compiles only `src`.

## Template gaps

Recorded in the [notes](../../../../../field-projects/youtube/v3/notes/README.md#template-gaps-found-while-completing-app)
and not worked around. V3-13's four stand; gap 1 is why S04's status has no route.

5. **A hook that throws while the Transcoder reports a failure stops the Transcoder.** The media
   worker's terminal step builds `ProcessingFailed` through `eventId` and `event`; a throw there
   is fatal, `app-transcoder` exits 1 with no reason, and the job returns to Upload jobs, so the
   next start fails while subscribing (steps 2 and 3). With every hook written, nothing reaches
   it, but a bug in either codec would keep the Transcoder down.

## Backend LOC

`pnpm benchmark:source field-projects/youtube/v3/app d94b13a <a temporary commit object of this
tree> field-projects/youtube/v3/notes/benchmarks/backend-scope.json`, with the scope unchanged
(no new `src/` file; the SQL and the test are outside the metric):

- **72 counted files.** Final backend LOC **6,563**: **6,218** retained template lines and **345
  post-template** (V3-13's 166, plus V3-14's **179**: `video-contract.ts` +89, the Transcoder's
  hooks 44, the lifecycle's hooks +46). **33** template lines replaced (V3-13's 14, plus 19: the
  throwing bodies and two unused imports).
- **The share:** 94.74% now. This is not V3-17's result.

## Gates (D2)

- **`generated/`:** `git diff d94b13a -- field-projects/youtube/v3/generated/` is empty, and
  there are no untracked files in it.
- **The processes-off pin and v1:** `processes-off.test.ts`, `generator.test.ts` and
  `assemble.test.ts` pass (3 files, 17 tests), and were in `pnpm check` too. v1 is byte-identical.
- **Frozen v2:** a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72
  files, the same paths as `generic-export.tar.gz`, 70 byte-identical. `manifest.json` and
  `report.json` are equal under `provenanceWithoutInventory`. No difference to report.

## Repository checks

- **`pnpm check`:** exit 0 (1 m 23 s). **748 tests in 104 files**, the same as V3-13: the app's
  tests run with Node's own runner, outside the repository's suite. Lint showed only the existing
  info.
- **E2E:** **80 passed (6.4 m)** on the first full run. `module-authoring.spec.ts:852` (V3-13's
  flaky `:849`, "Preview lists each writer module's own product SQL file") passed in 7.9 s;
  `v2-rebuild.spec.ts` 2.1 m, `v3-build.spec.ts` 2.6 m. `jeeves_e2e` holds only its long-standing
  TinyURL project.
  - **The flake's fix:** V3-13's timeout was in the spec's `build` helper, waiting for
    Microservice's "Add linked tile": the click on the tile it had just added missed it, because
    the board can still be moving after `ready` (its 200 ms layout animation and the camera).
    That is the pattern V3-08 fixed in `v2-rebuild.ts` by waiting for a still board. The wait
    (`still`, no tile moving for 300 ms) moved from `v2-rebuild.ts` to the shared `studio.ts` as
    `stillBoard`, unchanged, and `build` now waits for it before each click on a tile. No
    assertion changed. One passing run can't prove a flake gone; V3-18 should watch it.
- **Web build:** passed (1.21 s), with the existing chunk-size advisory.
- **Browser check** (scripted Chromium, by mouse, through the e2e helpers):
  - **Setup:** my API on 4466, on the scratch database `jeeves_v314` (now dropped), and Vite on
    4476. The owner's servers on 4300 and 4310 were not touched.
  - **What it did:** at 1440×900 and at 1280×800 it made a project from the default study,
    "TinyURL · foundation study", through Project → New project, and showed Detailed and Simple
    by the view toggle.
  - **Result:** 7 tiles and 7 lines in both views at both sizes, with no page or console error.
    Both projects were deleted (204). No studio UI changed in this unit.

## Cleanup

- **My stack:** `docker compose --profile '*' down --volumes --remove-orphans` on
  `jeeves-v314-processing` (15 containers, 5 volumes and the network removed), then
  `docker image rm jeeves-v314-processing-app jeeves-v314-processing-media`. Nothing named `v314`
  remains, and 45640–45642 are free.
- **Files:** I deleted the copy, with its `.runtime` (the secrets and the three account
  passwords), `node_modules` and `dist`; the fixture copy and the invalid file; the scratch v2
  export and the frozen archive's extraction; and the run records. No token or password was ever
  written to a file: the harness reads the password files at run time and keeps tokens in memory.
- **The owner's state matches the record:**
  - the same 43 container IDs and names, with the same restart counts, start times and health
    (42 healthy);
  - the same 18 volumes, 9 networks and 31 image rows (tag, ID and digest);
  - the v1 and v2 edges answer 200, and only 45400–45402 listen in 454xx.
- **Dev servers:** the owner's servers on 4300 and 4310 were not touched. Mine on 4466 and 4476
  are stopped, and `jeeves_v314` is dropped.
- **[`operator-harness.tar.gz`](operator-harness.tar.gz)** keeps the scratch scripts that made
  this record, none holding a credential:
  - `harness/lib.mjs` (V3-13's PKCE sign-in and edge client) and `run.mjs`, one pass's uploads;
  - `tap.mjs`, `outputs.mjs` and `replay.mjs`, run inside `app-*` containers: the scratch taps and
    dead letters, the Transcoded objects with `ffprobe`, and the repeated job;
  - `stage.py`, which put the later hooks back to "Not implemented" for each step;
  - `restart.sh`, `step.sh`, `watch.sh`, `state.sh`, `snapshot.sh`, `incontainer.sh` and `env.sh`;
  - `browser-check.spec.ts`, the browser check.
