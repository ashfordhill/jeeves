# V3-17 evidence: v3 acceptance and benchmark

2026-11-11 (UTC 2026-11-12). [Plan](../../units.md#v3-17--end-to-end-acceptance-and-benchmark) ·
[contract](../../contract.md) §6 and §7 · field project
[notes](../../../../../field-projects/youtube/v3/notes/README.md) ·
[scenarios](../../../../../field-projects/youtube/v3/notes/scenarios.md) ·
[review pack](../../../../../field-projects/youtube/v3/notes/review-pack.md) ·
[benchmark](../../../../../field-projects/youtube/v3/notes/benchmarks/README.md).

**Result.** A fresh copy of `app/` outside the checkout, on its own Compose project and ports,
was observed against contract §7 by mouse in Chromium and by API.

- **Observed in full, by mouse and by API:** S01, S03, S06, S07, S09 and S10, and S05 apart from
  human listening.
- **Partial, because of template gap 1:**
  - **S02:** complete answers 200, not 202, and the page shows "uploaded · not ready yet", not
    "pending".
  - **S04:** the page shows only uploading → not ready yet → ready, and an invalid upload never
    shows "failed". The full sequence was read in the lifecycle's own rows and events.
  - **S08:** invalid media can't be seen to fail by mouse. Everything else in S08 was observed.
- **Also not observed:** the encoder's own command line or log for a successful encode (the
  template logs none), and human listening (the 440 Hz tone was measured as decoded PCM).
- **No app change was made.** `generated/` is untouched, and `custom-paths.md` matches
  `diff -rq generated app`.
- **Backend LOC** (source-loc-v2, `d94b13a` → `3409af2`): **72 files, 6,740 LOC, 556
  post-template, 67 replaced, 91.75% template.**

## Setup

| Item | Value |
| --- | --- |
| The copy | `git archive 3409af2:field-projects/youtube/v3/app` (V3-16's commit, the last to touch `app/`), 129 files, in the session scratchpad; `diff -r` against `app/`'s working tree is empty |
| Tools | Node 24.21.0, pnpm 12.16.1, Docker 29.9.1, Compose v5.6.0; Playwright 1.63.0's Chromium, headless, 1280×900 |
| Project and ports | `jeeves-v317-accept`; loopback 45700 (HTTP), 45701 (identity), 45702 (objects), all free before |
| Media | v1's fixture (15,584,953 bytes, SHA-256 `16587281…aebf9`) and its 59-byte `invalid.mp4`, copied read only; for S08's browser refusals a 268,435,457-byte sparse `oversize.mp4` and a `notes.txt` |

**The owner's state, recorded first:** 43 containers (42 healthy; `excalidraw` exited 9 days
earlier), 18 volumes, 9 networks and 31 image rows. The v1 and v2 edges answered 200, and only
45400–45402 listened in 454xx–458xx.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts` | exit 0, 0.28 s |
| `pnpm build` | exit 0, 0.45 s |
| `node --test "test/*.test.ts"` | 19 passed |
| `pnpm first-run` | exit 0, 120.7 s (it built the browser first) |
| `node scripts/accounts.mjs` | exit 0, 0.82 s: role `creator`; `creator` and `other-creator` with it, `viewer` without |
| `docker compose ps` | 9 `app-*` (8 tiles and the edge) and 6 providers, all healthy, `RestartCount` 0 |
| The edge | `/` 200 `text/html`; `/main.js`, `/hls.min.js`, `/runtime-config.js` 200 `text/javascript`; `/style.css` 200 `text/css`; `/healthz` 200; `/nope` 404 JSON. `runtime-config.js` names issuer `127.0.0.1:45701/realms/sign-in`, client `sign-in-web`, callback `127.0.0.1:45700/` |

Three scratch queues were bound to View, Processing and Publication events before any traffic.

## The videos

| Video | Made by | Title word | End state | Used for |
| --- | --- | --- | --- | --- |
| **A** `82296c21` | mouse, with pause and resume | aurorafinch (description: glimmerreed) | ready | S02–S07, S09, S10, the restart |
| `241f2298` | mouse, paused after part 1, then Abort upload | — | aborted | S03 |
| `b192b44a` | mouse, `invalid.mp4` | cobaltwren | failed `INVALID_MEDIA` | S08, S06 |
| **B** `75b35e7a` | API (V3-13's recorded pass) | amethyst (description: quartzlantern) | ready | S02/S03 by API; S07, S09, S10 by API |
| `3cd285ac` | API, aborted after part 1 | — | aborted | S03 by API |
| **P** `a2d411d8` | API, completed while my Transcoder was stopped | sapphiremoth | pending, then ready | S04, S05, S06, S10 |
| `59620964` | API, `invalid.mp4` | cobaltfern | failed `INVALID_MEDIA` | S04, S06, S10 |
| `c2631665` | API, started and never completed | emberquill | uploading | S06, S10 |
| `a9a74229` | API, while the Transcoder was stopped again | tidepoolheron | pending, then ready | S04's `published.videos` read |
| `c16bcb3a` | API, searched for by mouse at once | nightjarlumen | ready | S06's timing |

**A pending video,** as in V3-15: I stopped only my own `app-transcoder` (`docker stop`, exit
code 0), completed an upload, observed it, then started the container again. It was healthy
5.7 s later, with `RestartCount` 0, and took the waiting job. The lifecycle went pending →
processing (+15.4 s) → ready (+18.7 s).

## By scenario

### S01: setup and sign-in

- **By mouse** (phase A):
  - The page opens signed out, with Upload video disabled and no favorites.
  - Sign in leads to Keycloak's page, then back to "Signed in as creator" with Sign out.
  - Sign out, then Sign in again: Keycloak showed its password form again.
- **By API:**
  - `…/upload-api-creator-check/me` with the creator's real PKCE token is 200
    `{signedIn:true, subject, username:"creator"}`, and the viewer's is `username:"viewer"`.
  - Anonymous and a changed token are both 401 `SIGN_IN_REQUIRED`.
  - Setup is in the table above.

### S02: multipart upload

- **By mouse:** the creator chose the fixture through the file chooser, typed a title and a
  description, and clicked Upload video. Upload was held to 1 MiB/s so that Pause lands in part 2.
  After the resume below, the page said "Upload received…". The list's badge showed:
  - "uploading" at 9 ms;
  - "uploaded · not ready yet" at 263 ms;
  - "ready" at 4.8 s.

  **Not observed: "pending".** The upload's status is its own, not the video's (gap 1).
- **By API** (V3-13's recorded pass, video B):
  - **Refusals:** anonymous `POST …/uploads` is 401 `SIGN_IN_REQUIRED`, a changed token 401, and
    `viewer` 403 `CREATOR_REQUIRED`. Anonymous part signing and complete are 401.
  - **The parts:** three real part PUTs of 5,242,880, 5,242,880 and 5,099,193 bytes, with ETags
    `e427bb2d…`, `8b07cb8a…` and `5c1c3548…`. ListParts gave the parts.
  - **`other-creator`:** status, sign, complete and abort are all 404 `UPLOAD_NOT_FOUND`, and its
    list is `{uploads:[]}`. The viewer's status read is 403.
  - **Complete answers 200, not 202 (gap 1).** The body is `{uploadId, videoId, jobId,
    attemptId, state:"pending"}`, and a second complete gives the same answer.
- **The originals:** A's and B's stored originals both hash to the fixture's SHA-256, with
  ETag `346805d5…-3` (3 parts). An anonymous GET of B's original at the object port is 403
  `AccessDenied`.

### S03: resume and abort

- **By mouse:**
  - Part 1 PUT 200; Pause during part 2 aborted its PUT (`net::ERR_ABORTED`).
  - After a refresh the page selected the same upload ID: "Selected “…”. Reselect the same file
    and click Resume." It showed "1 of 3 parts acknowledged · uploading", from ListParts.
  - Choosing the same file and clicking Resume selected upload signed and sent **only parts 2
    and 3** (both 200), then completed.
  - A second upload was paused after part 1. "Abort upload" on its row gave "“V3-17 mouse:
    aborted upload” was aborted." and the badge "aborted".
- **By API:**
  - The same upload ID throughout, and a new sign-in (a new token) before the resume.
  - Complete with a part missing is 409 `INCOMPLETE_PARTS`. ListParts before the resume was
    `[1]`, and only 2 and 3 were sent.
  - Complete after abort is **410** `UPLOAD_CLOSED`, for both the mouse-aborted upload and the
    API-aborted one, and so is signing a further part.

### S04: processing and publication

- **By mouse:** only uploading → "uploaded · not ready yet" → "ready" (gap 1). The invalid
  upload still read "uploaded · not ready yet" 12 s after complete and after Refresh, and after
  the restart (see [the creator screenshot](v3-17-creator.png)). **Not observable by mouse:**
  pending, processing and "failed" with its message.
- **By API, the sequence** (the lifecycle's `assets` rows, read as the database owner in this
  scratch run, as V3-14 did):

  | Video | Created (UTC) | Queued (pending) | Started (processing) | Ready or failed |
  | --- | --- | --- | --- | --- |
  | A | 01:37:55.259 | 01:38:00.825 | 01:38:00.995 | ready 01:38:04.057 |
  | B | 01:38:34.839 | 01:38:35.073 | 01:38:35.595 | ready 01:38:38.988 |
  | P | 01:39:35.196 | 01:39:35.356 | 01:39:50.706 | ready 01:39:54.014 |
  | `59620964` (invalid) | 01:40:12.792 | 01:40:12.836 | 01:40:13.476 | failed `INVALID_MEDIA` 01:40:13.538 |

  - **Polled every 0.25 s,** P read pending, then processing, then ready. The invalid upload
    went pending → failed within the 0.2 s poll, so "processing" shows only in its `started_at`
    and its `ProcessingStarted` event.
  - **The Processing events tap:** `ProcessingStarted` then `ProcessingSucceeded` (`640x360
    h264/aac`, `1280x720 h264/aac`) for each of the 5 ready videos, and `ProcessingStarted` then
    `ProcessingFailed` `INVALID_MEDIA` for both invalid uploads.
  - **Publication events:** exactly 5 `VideoPublished`, one per ready video. `upload-jobs.failed`
    holds the two invalid jobs (`INVALID_MEDIA`); every other `.failed` queue was empty.
- **ffprobe** (inside my `app-transcoder`, on A's outputs):
  - 15 objects (11,456,276 bytes); every inventory entry is stored.
  - H.264 yuv420p with AAC at 48 kHz stereo, at 640×360 and 1280×720, in MPEG-TS.
  - 5 segments of 4.000 s for each rendition, 20 s in all.
  - The master lists 1,250,000 and 3,500,000 bandwidth. The thumbnail is a 1280×720 JPEG.
- **`published.videos`** (psql as the owner): while `a9a74229` was pending it had 0 rows for it,
  and after ready 1. At the end it held the 5 ready videos. No failed, aborted or uploading
  video was in it, ever.
- **Not observed:** the encoder's command line or stderr for a successful encode. The Transcoder
  logs only its start (`pinned ffmpeg and ffprobe`) and each dead letter, as in v2.

### S05: playback

- **By mouse, signed out** (phase B):
  - Search, then Watch video, opened `?watch=<A>` with "creator · 20 seconds" and "0 views", and
    no sign-in was asked. "Video thumbnail" expanded to a loaded 1280×720 image.
  - Before playing, an `AnalyserNode` was attached to the player (AudioContext running, 44.1
    kHz). Then the player's own play control was clicked.
  - From 1.89 s it played to 7.58 s, more than 5 s: 217 frames decoded, 0 dropped, 1280×720,
    119,832 audio bytes decoded.
  - **The decoded PCM peaked at 440.08 Hz, RMS 0.0624,** with the element unmuted at volume 1.
    Playwright launches Chromium with `--mute-audio` and nobody listened: **human listening is
    not observed.**
  - A click on the timeline at 80% jumped from 7.74 s to 16.08 s, and it kept playing (18.05 s
    two seconds later).
- **By API and the edge:**
  - The browser's requests for A were all under `/cdn/video-delivery/`: master (6), playlists
    (12), 720p segments (16) and 360p segments (6), all 206, and the thumbnail 200.
  - **Anonymously through the edge:** master and playlists 200
    `application/vnd.apple.mpegurl`, segments 200 `video/mp2t`, a range request 206 `bytes
    0-1023/633184`, and the thumbnail 200 `image/jpeg`. A PUT is 405.
  - **The segment bytes differ from the original:** no segment's hash equals the fixture's, no
    4 KiB window from any probed segment occurs in the fixture, and the segments run at about
    1.2 Mbit/s (360p) and 3.3–3.6 Mbit/s (720p), where the fixture is 6 Mbit/s.
  - **A video that isn't ready gives 404 from the details route** (`NOT_FOUND`, gap 7, not v2's
    `VIDEO_NOT_READY`): P while pending, both failed ones and the unfinished one. A play is 404
    `VIDEO_NOT_READY`.
  - **By mouse,** opening each of them by ID said "This video is not publicly available." (phase
    P, signed out).

### S06: search

- **By mouse, signed out:**
  - "aurorafinch" (title), "glimmerreed" (description) and "creator" (channel) each listed A, and
    its Watch video opened it.
  - **Within 60 s of ready:** `c16bcb3a` completed at 01:44:32.63 and was ready at 01:44:36.222.
    Mouse searches for "nightjarlumen" every 2 s gave 0 results at 01:44:33.787 and 01:44:35.842,
    then **1 result at 01:44:37.895, 1.7 s after the ready commit**, and it opened.
  - The pending (sapphiremoth, while pending), failed (cobaltfern, cobaltwren) and unfinished
    (emberquill) titles each gave "0 results · Page 1".
- **By API:**
  - The title, description and channel words found only ready videos ("creator": the 5 ready
    ones, newest first).
  - cobaltfern, cobaltwren, emberquill, "aborted" and "invalid" gave `total: 0`, and so did
    sapphiremoth while pending.
  - An empty `q`, 201 characters, `page` 0 or 101 and an extra `sort` are 400 `SEARCH_QUERY`.

### S07: counts

- **By mouse, signed out, on A:**
  - **Fetches add nothing:** three searches and three opens of the details. 3 s later the page
    showed "0 views", and no play request had been sent.
  - **A short play adds nothing:** played to 1.10 s and paused, then a timeline click while paused
    (to 1.89 s). 3 s later nothing was sent and it was still 0.
  - **Then playing:** "Playback accepted" (202), and **"1 views" 0.3 s after the 202**, well
    within 10 s. The policy counts cumulative seconds, so the short play's second counted toward
    the two.
  - **Seek, pause, a seek while paused, 2.5 s of resume, pause:** still one play sent, still 1.
  - **A new page session** (reload, the same video by `?watch=`): a new event ID was sent, and "2
    views" showed 1.3 s after the 202.
- **By API:**
  - A's first event ID `6d093fc2…`, sent again anonymously: 202, and the count stayed 3 (6 s
    later). The counter has one receipt per event ID: A's three, `(videoId, eventId)`.
  - **On B:** two plays and their two retries (anonymous and the viewer) gave 202 four times, and
    0 → 2, visible 253 ms after. A changed token is 401. `{eventId:"x", seconds:2}` is 400
    `VIEW_REQUEST`. GET is 405.
  - `view_counter_receipt_and_increment_public.totals` shows A 3, B 2, P 1, and the same after
    the restart.

### S08: failures and independence

- **By mouse:**
  - **A changed token:** after the viewer signed in, the stored token's signature was changed.
    The page's next request carrying it was 401. The header then said "Your sign-in expired or
    was refused. Sign in again." (styled as an error), "Signed out" with Sign in, and no
    favorites. The refused request was not sent again anonymously.
  - **A file over 256 MiB:** "Choose a file between 1 byte and 256 MiB.", and no upload
    request was sent.
  - **Not an MP4** (`notes.txt`): "Choose an MP4 video (H.264/AAC, landscape 720p–1080p, 1–600
    seconds).", and no request.
  - **Invalid media:** **not observable** (gap 1). It uploaded, completed and stayed "uploaded ·
    not ready yet", while the lifecycle had failed it `INVALID_MEDIA`.
- **By API:**
  - A changed token is 401 on every route tried. Oversize (268,435,457 bytes) is **413**
    `FILE_SIZE`. `text/plain` and `video/quicktime` are **422** `UNSUPPORTED_FILE`. An empty or
    201-character title, a bad SHA-256 or an extra field are 400 `INVALID_UPLOAD`.
  - Both invalid uploads failed `INVALID_MEDIA`, with no publication, no `published.videos` row,
    no search hit and a 404 from the details.
  - An anonymous GET of an original is 403, before and after the restart.
- **Stop and start** (`pnpm stop` 8.0 s, all 15 exited; `pnpm start` 64.0 s, which rebuilt the
  browser first). A snapshot before and after was **identical**:
  - `.runtime` and `secrets` 0700, 25 secrets with the same combined hash, `local-setup.json`;
  - the 5 volumes' creation times;
  - 10 assets and 10 uploads (states and hashes), `published.videos` (5), the outbox (12 rows, all
    sent);
  - totals A 3, B 2, P 1; 6 receipts; 3 favorites; the index (5 documents, the same hash); 4
    cached records;
  - 7 originals and 75 transcoded objects (keys, sizes and ETags);
  - the 3 accounts and their creator roles;
  - 15 healthy, 0 restarts.

### S09: signed-in and anonymous watching

- **By mouse:**
  - Watching signed out asked for no sign-in, no token was sent, and the play counted with
    `viewer: null`.
  - Then, on A's watch page, Sign in as `viewer` came back to `?watch=<A>`, "Signed in as viewer",
    with "Uploads need a creator account." and the ☆ toggle. The viewer's play was sent with the
    token: **"3 views"** 0.34 s after the 202.
- **By API:** `…/watch-api-viewer-check/me` is `{signedIn:false}` without a token, `{signedIn:true,
  subject:"5f0b30a9…", username:"viewer"}` with the viewer's, and 401 with a changed one.
- **The View events tap** received every play, each with its event ID as message ID:
  - A's two anonymous plays with `viewer: null`, and the viewer's with `viewer: "5f0b30a9…"`;
  - B's API plays, null and the subject, each twice (the retries);
  - the replay of `6d093fc2…`.

  The receipts carry the same viewers, and each play added 1.

### S10: Favorites

- **By mouse:**
  - Signed in as `viewer` on A, ☆ Add to favorites → "★ In favorites", and My favorites listed A.
  - **Remove** in the list took A out and set the toggle back to ☆. Clicking ☆ again kept it for
    the restart.
  - Signed out, A opened with **no toggle and no list**, only Sign in.
- **By API, with the viewer's token on B:**
  - `PUT …/items/<B>` is 200, and again 200 with **the same `addedAt`**. `GET …/items/<B>` is
    200, and `GET …/items` lists it.
  - `DELETE` is 204, then `GET` 404 `NOT_FAVORITE`, and a second `DELETE` 204 again.
  - **Without a token,** and with a changed one, all four routes are 401.
  - **A video that isn't ready** is 404 `NOT_ELIGIBLE`: P while pending, both failed ones, the
    unfinished one, an unknown UUID, and B's ID in upper case. `bad%20id!` is 400 `ITEM_ID`.
- **The list survives stop and start:** A, B and P, by API and by mouse.

## After the restart (phase C)

By mouse:

- Signed out, "aurorafinch" found A. It opened with its count kept, played (95 frames to 3.78 s)
  and that new page session counted.
- The creator signed in and A was still "ready" in the list.
- Sign out, then Sign in as `viewer`: Keycloak asked for the password again. My favorites still
  listed A, B and P, and A opened from it with ★.

By API: the details of A and B were 200, the counts were kept, the viewer's favorites were the
same three, `me` worked, "creator" still found 5, and the original was 403.

## Attempts, for the record

No app file changed between attempts; only my specs did.

1. **The refused-token check**, from V3-16, failed twice.
   - **What happened:** after the tamper, the details I opened came back 200 without a token. A
     diagnostic run showed why. Since phase B the viewer had favorites, so right after sign-in
     the list fetched A's details for its title. That request was the first to carry the changed
     token. It got 401, and the page signed out and said "Sign in again". My open then came
     from a signed-out visitor, so it was rightly anonymous.
   - **Why V3-16's spec passed:** it assumed my open would be the first request with the token.
     That held only while the list was empty.
   - **The fix:** the spec now checks whichever request carries the changed token first: it must
     be 401, the page must ask to sign in again, and it must not be retried anonymously. It
     passed on the third run.
2. **Phase C** first expected the count to be the same after its own play. The play was a new
   page session and counted (3 → 4). That run had already seen "3 views" kept across the
   restart, the creator's ready upload and the viewer's favorites. The spec now expects the kept
   count before the play and one more after it. It passed on the second run (4 → 5).

## Screenshots

| Screenshot | What |
| --- | --- |
| [Creator](v3-17-creator.png) | After the uploads: A ready with Watch video, the aborted upload, and the invalid upload still "uploaded · not ready yet" (gap 1) |
| [Anonymous watch](v3-17-anonymous-watch.png) | Signed out, from search: playing at 0:07, "1 views", "Playback accepted", the thumbnail, no favorites UI |
| [Viewer favorites](v3-17-viewer-favorites.png) | Signed in as viewer on A's page: "3 views", "★ In favorites", My favorites |
| [After restart](v3-17-after-restart.png) | After `pnpm stop` and `pnpm start`: the viewer's favorites kept, A with ★ |

## The two other checks

- **`custom-paths.md`:** its 34 rows are exactly the 34 files that `diff -rq generated app`
  reports, leaving out `node_modules`, `dist`, `dist-public` and `.runtime`. No file is removed,
  and `app/` has no untracked file.
- **Backend LOC:** `pnpm benchmark:source field-projects/youtube/v3/app d94b13a… 3409af2…
  field-projects/youtube/v3/notes/benchmarks/backend-scope.json`. The result is in
  [the report](../../../../../field-projects/youtube/v3/notes/benchmarks/source-loc-v2.json) and
  [its summary](../../../../../field-projects/youtube/v3/notes/benchmarks/README.md).
  - The CLI's stdout has SHA-256 `5951ed4c…6a6e` (kept as
    [`source-loc-v2-cli.json.gz`](source-loc-v2-cli.json.gz)).
  - Biome reformatted only the committed copy's whitespace; parsed, the two are equal.

## Gates (D2)

- **`generated/`:** `git diff d94b13a -- field-projects/youtube/v3/generated/` is empty, and it
  has no untracked file.
- **The processes-off pin and v1:** `processes-off.test.ts`, `generator.test.ts` and
  `assemble.test.ts` pass in `pnpm check`. v1 is byte-identical.
- **Frozen v2:** a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72
  files, the same paths as `generic-export.tar.gz`, 70 of them byte-identical. `manifest.json` and
  `report.json` are equal under `provenanceWithoutInventory`. No difference to report.

## Repository checks

- **`pnpm check`:** exit 0 (69 s), **748 tests in 104 files**; lint has only the existing info.
- **E2E:** **80 passed (5.7 m)** on the first full run, `connection-dots.spec.ts` included.
  `jeeves_e2e` holds only its TinyURL project.
- **Web build:** passed (967 ms), with the existing chunk-size advisory.
- **Studio browser check** (scripted Chromium, by mouse, through the e2e helpers; my API on 4469
  with the scratch database `jeeves_v317`, now dropped, and Vite on 4479): at 1440×900 and
  1280×800 the TinyURL study showed 7 tiles and 7 lines in Detailed and in Simple, with no page or
  console error. Both projects were deleted (204). No studio code changed in this unit.

## Cleanup

- **My servers:** 4469 and 4479 are stopped and `jeeves_v317` is dropped. The owner's 4300 and
  4310 were never touched.
- **My stack:** `docker compose --profile '*' down --volumes --remove-orphans` (5.1 s), then both
  image tags removed. No container, volume, network or image named `v317` remains, and
  45700–45702 are free.
- **Files:** the copy (with `.runtime`, its 25 secrets, the three passwords, `node_modules`,
  `dist` and `dist-public`), the media copies, the frozen-v2 comparison exports and the
  Playwright outputs are deleted.
  - No token, password or signed URL is in any record: a scan of the records for JWTs, S3
    signatures and the three passwords found none.
- **The owner's state matches the record:** the same 43 containers (IDs, restart counts, start
  times, health), 18 volumes, 9 networks and 31 image rows. 42 are healthy, both edges answer
  200, and only 45400–45402 listen.
- **[`operator-harness.tar.gz`](operator-harness.tar.gz)** holds the scripts and the sanitized
  run records:
  - `harness/`: the PKCE client, the upload, probe, search, edge-media and in-container
    scripts;
  - `browser/`: the phase A, P, B, C, refused and fresh specs;
  - the shell helpers;
  - `runs/`.
