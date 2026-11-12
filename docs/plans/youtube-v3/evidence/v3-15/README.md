# V3-15 evidence: complete watch and favorites

2026-11-11. [Plan](../../units.md#v3-13-to-v3-16--complete-v3-in-app) (the V3-15 row) ·
[contract](../../contract.md) §1, §2, §3, §5, §7 (S05, S07, S09, S10) and questions 7 and 8 ·
field project [notes](../../../../../field-projects/youtube/v3/notes/README.md) ·
[custom paths](../../../../../field-projects/youtube/v3/notes/custom-paths.md) · v1's
[bounded policies](../../../../../field-projects/youtube/v1/notes/scenarios.md#bounded-v1-policies).

**Result:** in `app/`, watching, counting and Favorites now work against the real stack:

- **Details:** anyone, signed in or not, reads a ready video's public record. The first read loads
  it from `published.videos`; later reads come from Hot metadata for the cache's TTL (3601 s, the
  design's value). A pending, failed, still-uploading or unknown video is 404, and a miss is never
  cached, so a video answers the moment it is ready. No count is ever in the cached record.
- **Plays:** `POST …/watch-api-view-publisher/<videoId>` `{eventId}` accepts a play of a ready
  video only (404 `VIDEO_NOT_READY` otherwise) and answers 202. It sends one `ViewPlayed` to View
  events, with the viewer's subject when signed in and `null` when anonymous, whose message ID is
  the event ID.
- **Counts:** View counter counts each play once per `(videoId, eventId)`: two plays and their two
  retries add 2. `…/watch-api-view-count-reader/<videoId>` reads the total fresh. A repeat that
  claims another viewer for the same play never counts.
- **Sign-in on Watch:** Optional. No token is anonymous; a bad token is 401 on every Watch route.
- **Favorites:** a signed-in viewer adds, checks, lists and removes a favorite video. Only a ready
  video may be added (404 `NOT_ELIGIBLE`); anonymous and bad tokens get 401.
- **Stop and start** kept counts, receipts, favorites, the cached records and everything else.
- **`generated/` is untouched.** One small **scaffold edit** was unavoidable (template gap 6,
  below): without it the stub publisher can't send a retried play as the same message, and the
  counter template can't count it once.

## What was written

All of it in `app/`, listed in [`custom-paths.md`](../../../../../field-projects/youtube/v3/notes/custom-paths.md).
From v2's `youtube-watch.ts`, `youtube-counter.ts` and `ViewPlayed`, fitted to v3's hooks and stubs.

| Path | What |
| --- | --- |
| `src/modules/video-contract.ts` | Added `watchedVideo` (the details answer: `publicVideo` plus `manifestUrl` and `thumbnailUrl` under `/cdn/video-delivery/`) and `watched` (built from a `published.videos` row), `viewRequest` (`{eventId}`) and `viewPlayed` (v2's `ViewPlayed` plus `viewer`) |
| `src/modules/watch-api/watch-api-video-details-cache.hooks.ts` | The cache read's `key` (`ready-video:v1:<videoId>`, 400 `VIDEO_ID`), `load` (`published.videos`), `codec`, `eligible` and `expiresAt` (null: the record is immutable) |
| `src/modules/watch-api/watch-api-view-count-reader.ts` | Stub body: `GET /<videoId>` → `{views}` from the counter's public `totals` view |
| `src/modules/watch-api/watch-api-view-publisher.ts` | Stub body: `POST /<videoId>` `{eventId}`: the ready check, one `ViewPlayed` with the viewer, message ID = event ID, 202 |
| `src/modules/view-counter/view-counter-receipt-and-increment.hooks.ts` | The counter's `event`, `aggregateKey`, `eventId` and `identity` |
| `src/modules/account-api/account-api-favorite-videos.hooks.ts` | Favorites' `eligible`: a canonical video ID in `published.videos` |
| `src/modules/dependencies.ts` | **Scaffold edit:** `QueuePublisher.publish` options gain `messageId` |
| `src/runtime/module-clients.ts` | **Scaffold edit:** `queuePublisher` sends that `messageId`, else a fresh ID as before |
| `test/watch.test.ts` (new) | 6 offline tests (Node's own runner) |

**No product SQL.** The details, the ready check and `eligible` read V3-14's `published.videos`;
the count reader reads the counter template's own `view_counter_receipt_and_increment_public.totals`;
Favorites and the counter use their template tables. Watch API's View counts login may read only
that view and `published`, and its Metadata login only `published` (the export's grants).

**Two cumulative seconds per page session, the server's part.** v1's policy counts one play per
watch page session, after two cumulative played seconds; pausing, resuming and seeking reuse the
session's one event ID. The server can't see the player, so its part is what v1 and v2's servers
did: the play report takes only `{eventId}` (a UUID, nothing else: `{"eventId":"x","seconds":2}`
is 400), only a ready video accepts it, and the event ID is the dedupe key, so every retry or
repeat in one session counts once and a new session counts again. Measuring the two seconds and
keeping one event ID per page is the browser's (V3-16).

## Template gap 6 and the scaffold edit

The event counter template keys its receipt on the broker message's ID: its adapter must give the
message's ID as the event ID ("Counter event mismatch" otherwise), and the receipt is `(aggregate,
event ID)`. The generated module client for stubs, `queuePublisher`, gave every message a fresh
random ID, and `QueuePublisher.publish` had no way to pass one. So a View publisher stub could not
send a retried play as the same message:

- with the counter's hooks binding the play's event ID to the message ID (v2's `wireEvent`), every
  play was refused, `MALFORMED_MESSAGE` (step 8 below, with the generated client);
- binding the random message ID instead would have counted every retry, breaking v1's
  `(videoId, eventId)` rule.

No hook can fix either. The edit is one line in each scaffold file: the option `messageId` and
`opened.publish(message, options?.messageId ?? randomUUID())`. Every other module client and the
fresh-ID default are unchanged. The generator fix is the same two lines in
`module-clients.ts.template` and `dependencies.ts.template` (not made here: V3-15 completes `app/`
only). Step 9 below shows the edit's effect: the message ID is the event ID, and the counter goes on
to its next hook.

**Gap 7 (minor).** The cache read's route answers a null record with the template's own 404
`NOT_FOUND` "No record for this key.", where v1/v2's details said 404 `VIDEO_NOT_READY`; hooks
can't shape it. The status is the same. Both gaps are in the
[notes](../../../../../field-projects/youtube/v3/notes/README.md#template-gaps-found-while-completing-app).

## Docker: the owner's state, recorded first

- **Containers:** 43, of which 42 are healthy and the long-exited `excalidraw` is the other.
- **Other resources:** 18 volumes, 9 networks and 31 image rows (tag, ID and digest).
- **v1:** `jeeves-youtube-v1`, 14 running, edge `127.0.0.1:4400/healthz` 200.
- **v2:** `jeeves-youtube-v2`, 14 running on 45400–45402, edge 200.
- **Ports:** in 454xx only 45400–45402 listened.

**Mine:** project `jeeves-v315-watch` on loopback **45660** (HTTP), **45661** (identity) and
**45662** (objects), all free, with nothing of that name.

## The outside copy

The copy, in the session scratchpad, was `git archive` of `app/` at V3-14's commit (116 files).
Each step staged its sources (`stage.py`, below), then ran `pnpm build`, `pnpm stop` and `pnpm start`.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts` (Node 24.21.0, pnpm 12.16.1) | exit 0, 0.3 s |
| `pnpm build` | exit 0 |
| `COMPOSE_PROJECT_NAME=jeeves-v315-watch LOCAL_HTTP_PORT=45660 LOCAL_IDENTITY_PORT=45661 LOCAL_OBJECT_PORT=45662 pnpm first-run` | exit 0, 119 s; 15 containers healthy, 0 restarts |
| `node scripts/accounts.mjs` | exit 0, 0.9 s: the role and 3 users |

**The videos,** through V3-13's upload and V3-14's processing (`upload.mjs`, as the creator, by
the real PKCE flow, v1's fixture copied read only):

| Video | How | State |
| --- | --- | --- |
| `a4f2fd81-…` "V3-15 videos: test card" | the fixture, 3 parts, completed | **ready** within 12 s; in `published.videos` |
| `51bfcb92-…` | a 59-byte text file named `invalid.mp4`, completed | **failed `INVALID_MEDIA`** |
| `df3a8f7f-…` | an upload started, no part sent | **uploading** |
| `dee5c20f-…` (final pass) | the fixture, completed while `app-transcoder` was stopped | **pending**, then ready 5 s after the Transcoder came back |

**Each pass** (`probe.mjs`, through the edge): the viewer signs in by the real PKCE flow, and a
copy of its token with a changed signature is the bad token. It reads `me`; the details of every
video (anonymous, the viewer, an upper-case ID, the bad token, a bad ID); the count; makes two
fresh plays, one anonymous (A) and one as the viewer (B), and sends each again with the same event
ID; tries the not-ready videos, a bad body and GET; reads the count until it settles; then every
Favorites call anonymous, with the bad token and as the viewer. `watchstate.sh` then dumps Valkey's
hits and misses and the cached keys, the counter's totals and receipts, the favorites table, the
queues, a scratch queue bound to the View events exchange (`v315-tap-views`), the counter's dead
letters (read and put back) and the "not-implemented" log lines.

## Step by step, in the order a request reaches the hooks

The final code was written in `app/`. For each step, `stage.py` put back the exported "Not
implemented" body in every hook after that step and V3-14's version of every later file. At step 13
the copy's `src/` equals `app/`'s. Every restart was **15 healthy, 0 restarts**.

| Step | Written | Stop / start | Where the request or message stops |
| ---: | --- | --- | --- |
| 0 | nothing (V3-14's commit) | — | details 501 "key for Video details cache"; count 501 "View count reader"; play 501 "View publisher"; favorite add 501 "eligible for Favorite videos" (check 404, list empty, remove 204); every bad token 401 |
| 1 | details `key` | 4.6 / 80.8 s | "load for Video details cache"; a bad ID is now 400 `VIDEO_ID` |
| 2 | `load` | 4.4 / 76.9 s | the ready video: "codec for Video details cache". The failed, uploading and unknown videos: **404** (null, before any codec) |
| 3 | `codec` | 4.5 / 76.5 s | "eligible for Video details cache" |
| 4 | details `eligible` | 4.4 / 101.9 s | "expiresAt for Video details cache" (this start ran beside `pnpm check`) |
| 5 | `expiresAt` | 4.4 / 78.0 s | **details 200** for the ready video, anonymous and signed in; Valkey: 4 misses, then 2 hits; the key `ready-video:v1:a4f2fd81-…` with PTTL 3,598,712 ms, 925 bytes |
| 6 | View count reader | 4.6 / 76.5 s | **count 200 `{views:"0"}`**; play still 501 |
| 7 | View publisher (with the type of `messageId`, but the **generated** client) | 4.3 / 76.3 s | **play 202**; failed and uploading 404 `VIDEO_NOT_READY`; 400 and 405. The 4 messages reach View events with `viewer` `null` and the viewer's subject, each with a fresh random message ID; the counter: `.failed` at attempt 1, "event for Receipt and increment" |
| 8 | counter `event` | 4.4 / 76.6 s | all 4 messages `MALFORMED_MESSAGE` at attempt 1: the play's event ID isn't its random message ID (gap 6). The count stays 0 |
| 9 | the scaffold edit (`module-clients.ts`) | 4.3 / 76.1 s | each message's ID **is now its event ID** (`b5e50148-…` for both sends of A); "aggregateKey for Receipt and increment" |
| 10 | `aggregateKey` | 4.4 / 76.3 s | "eventId for Receipt and increment" |
| 11 | `eventId` | 4.2 / 76.1 s | "identity for Receipt and increment" |
| 12 | `identity` | 7.9 / 77.4 s | **counted: 0 → 2** for the 2 plays and their 2 retries; 2 receipts, A's with viewer null and B's with the viewer's subject. Favorites still 501 |
| 13 | Favorites `eligible` (= `app/`) | 4.4 / 76.5 s | everything below |

## The recorded pass (step 13, final code)

`W` is `/api/watch-api/modules`, `FAV` is `/api/account-api/modules/account-api-favorite-videos/items`;
`<ready>` is `a4f2fd81-56cc-4548-832f-3f052f914b51`. The viewer's subject is `0e572778-f121-482d-9ab0-208c029d6cdb`.

**Sign-in and details:**

| Request | Answer |
| --- | --- |
| `GET W/watch-api-viewer-check/me`, anonymous / viewer / bad token | 200 `{signedIn:false}` / 200 `{signedIn:true, subject:"0e572778-…", username:"viewer"}` / 401 `SIGN_IN_REQUIRED` |
| `GET W/watch-api-video-details-cache/<ready>`, anonymous, viewer, and upper-case | 200, the record below (3 cache hits: the key had survived 8 restarts, since Valkey keeps an append-only file on its volume) |
| the same, bad token | 401 `SIGN_IN_REQUIRED` |
| failed, uploading, unknown | 404 `NOT_FOUND` "No record for this key." (3 misses, nothing cached) |
| `GET W/watch-api-video-details-cache/not-a-video` | 400 `VIDEO_ID` "Invalid video identity." |

```json
{
  "videoId": "a4f2fd81-56cc-4548-832f-3f052f914b51", "publicationVersion": 1,
  "title": "V3-15 videos: test card",
  "description": "V3-15 videos: a 20 s synthetic test card and 440 Hz tone.",
  "channel": "creator", "durationSeconds": 20,
  "manifest": "videos/a4f2fd81-…/8841b221-…/b9d9246e-…/master.m3u8",
  "thumbnail": "videos/a4f2fd81-…/8841b221-…/b9d9246e-…/thumbnail.jpg",
  "publishedAt": "2026-11-11T23:50:09.654Z", "visibility": "public", "state": "ready",
  "manifestUrl": "/cdn/video-delivery/videos/a4f2fd81-…/8841b221-…/b9d9246e-…/master.m3u8",
  "thumbnailUrl": "/cdn/video-delivery/videos/a4f2fd81-…/8841b221-…/b9d9246e-…/thumbnail.jpg"
}
```

Through the edge, `manifestUrl` gave 200 `application/vnd.apple.mpegurl` (194 bytes) and
`thumbnailUrl` 200 `image/jpeg` (68,896 bytes). Every answer carries `Cache-Control: no-store`
(the HTTP service's own header), so the count is never cached on the way either.

**Plays and counts:**

| Request | Answer |
| --- | --- |
| `GET W/watch-api-view-count-reader/<ready>` | 200 `{views:"2"}` (step 12's) |
| the same, bad token | 401 |
| `POST W/watch-api-view-publisher/<ready>` `{eventId: A}`, anonymous | 202 `{eventId: "8ad31487-…", accepted: true, acceptedAt: "…00:12:46.427Z", publicationVersion: 1}` |
| the same `{eventId: B}`, viewer | 202 (B `6b37ccc6-…`) |
| A again, anonymous; B again, viewer | 202 each, with a new `acceptedAt` |
| `{eventId}` with the bad token | 401 |
| the failed and the uploading video | 404 `VIDEO_NOT_READY` "This video is not publicly available." |
| `{"eventId":"x","seconds":2}` | 400 `VIEW_REQUEST` "Supply a video UUID and an eventId UUID only." |
| `GET W/watch-api-view-publisher/<ready>` | 405 `METHOD_NOT_ALLOWED` |
| `GET W/watch-api-view-count-reader/<ready>`, after | 200 `{views:"4"}`: **+2 for 4 messages** |

The tap got 4 messages, each with its event ID as message ID (`8ad31487` twice with `viewer: null`,
`6b37ccc6` twice with `viewer: "0e572778-…"`). The counter kept one receipt per play:

| scope (video) | event ID | viewer in the receipt | applied |
| --- | --- | --- | --- |
| `a4f2fd81-…` | `8ad31487-…` | null | true |
| `a4f2fd81-…` | `6b37ccc6-…` | `0e572778-…` | true |

**A repeat claiming another viewer** (`extras.mjs conflict`): the viewer reported play
`d6310604-…` (count 4 → 5), then the same event ID was sent anonymously. Both answered 202; the
counter found the receipt's identity differs ("Conflicting or incomplete receipt"), retried it 5
times and sent it to `view-events--view-counter.failed` as **`RETRY_EXHAUSTED`** at attempt 6.
The count stayed 5.

**A pending video** (`dee5c20f-…`, completed while `app-transcoder` was stopped): details 404,
count `{views:"0"}`, play 404 `VIDEO_NOT_READY`, favorite add 404 `NOT_ELIGIBLE`, and no cache key.
With the Transcoder started again it was ready 5 s later, and at once: details 200, play 202,
favorite add 200 and remove 204, and the key cached with PTTL 3,600,854 ms.

**Favorites:**

| Request | Answer |
| --- | --- |
| `PUT`, `GET FAV/<ready>`, `GET FAV`, `DELETE FAV/<ready>`, each anonymous and with the bad token | 401 `SIGN_IN_REQUIRED` (8 calls) |
| `PUT FAV/<ready>`, viewer | 200 `{itemId:"a4f2fd81-…", addedAt:"2026-11-12T00:12:49.999084Z"}` |
| the same again | 200, the same `addedAt` |
| `GET FAV/<ready>` | 200, the same |
| `GET FAV` | 200 `{items:[{itemId:"a4f2fd81-…", addedAt:"…49.999084Z"}], next:null}` |
| `DELETE FAV/<ready>` | 204 |
| `GET FAV/<ready>` | 404 `NOT_FAVORITE` |
| `PUT FAV/<failed>`, `<uploading>`, an unknown UUID, the ready ID in upper case | 404 `NOT_ELIGIBLE` "This item can't be added to favorites." |
| `PUT FAV/bad%20id!` | 400 `ITEM_ID` |
| `PUT FAV/<ready>` (kept for the restart) | 200, `addedAt` `…00:12:50.054198Z` |

## Stop and start

After the extras, `pnpm stop` (4.4 s) and `pnpm start` (65.9 s, 15 healthy, 0 restarts). A
snapshot before and after was **identical**: `.runtime` and `.runtime/secrets` 0700 with 25
files and the same combined hash; `local-setup.json`; the 5 volumes' creation times; the totals
(`a4f2fd81` 5, `dee5c20f` 1); 6 receipts and their hash; 1 favorite and its hash; `published.videos`
(the 2 ready videos); both cached records' hashes; the realm's 3 accounts. Read back after the
start: both videos' details 200 (4 cache hits, 0 misses), counts `"5"` and `"1"`, the viewer's
list still the one favorite, and `me` for a new sign-in as `viewer` (the realm and its keys kept).

**Dead letters at the end:** `view-events--view-counter.failed` 21: 4 `NOT_IMPLEMENTED` from each
of steps 7, 9, 10 and 11, 4 `MALFORMED_MESSAGE` from step 8 (gap 6), and the conflicting repeat's
`RETRY_EXHAUSTED`.

## Tests

- **`test/watch.test.ts`:** with V3-13's and V3-14's, `node --test "test/*.test.ts"` gives **15
  passed** (6 new) in about 200 ms: the details through the template's real `createPositiveReader`
  with an in-memory cache (one load, then hits for the TTL; a miss never cached; 400), the codec's
  refusals, the View publisher (each play one message whose ID is its event ID, with the viewer or
  null; 404, 400, 405), the counter through the template's real `createEventCounter` (one identity
  whatever the accept time; a moved message ID refused), the count reader and `eligible`.
- **Types:** `tsc` over `src` and `test` together exits 0, and so does every staged step (0–13).
  `pnpm build` compiles only `src`.

## Backend LOC

`pnpm benchmark:source field-projects/youtube/v3/app d94b13a <a temporary commit object of this
tree> field-projects/youtube/v3/notes/benchmarks/backend-scope.json`, with the scope unchanged
(no new `src/` file; the test is outside the metric):

- **72 counted files.** Final backend LOC **6,692**: **6,194** retained template lines and **498
  post-template**. V3-15 adds **153**: the View publisher 43, `video-contract.ts` +50, the details
  hooks 20, the count reader 20, the counter's hooks 13, `eligible` 5, and 1 in each scaffold edit.
  **57** template lines replaced (V3-14's 33, plus 24: the throwing bodies, two unused imports and
  the two edited scaffold lines).
- **The share:** 92.56% now. This is not V3-17's result.

## Gates (D2)

- **`generated/`:** `git diff d94b13a -- field-projects/youtube/v3/generated/` is empty, and
  there are no untracked files in it.
- **The processes-off pin and v1:** `processes-off.test.ts`, `generator.test.ts` and
  `assemble.test.ts` pass (3 files, 17 tests), and were in `pnpm check` too. v1 is byte-identical.
- **Frozen v2:** a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72
  files, the same paths as `generic-export.tar.gz`, 70 byte-identical; `manifest.json` and
  `report.json` are equal under `provenanceWithoutInventory`. No difference to report.

## Repository checks

The full numbers are in the [handoff](../../../../handoff.md) entry for V3-15.

- **`pnpm check`:** exit 0 (1 m 29 s), **748 tests in 104 files** (the app's tests run with Node's
  own runner, outside the repository's suite); lint only the existing info.
- **E2E:** **79 passed, 1 failed (5.7 m)** on the full run, with my Docker stack already down.
  `connection-dots.spec.ts:208` ("a dot drag held past the canvas edge pans, then connects on
  release") timed out waiting for the target to come inside the board while panning. **Rerun
  alone it passed (5.0 s), and 5 of 5 with `--repeat-each=5`.** No studio code changed in this
  unit. `jeeves_e2e` holds only its long-standing TinyURL project.
- **Web build:** passed (1.27 s), with the existing chunk-size advisory.
- **Browser check** (scripted Chromium, by mouse, through the e2e helpers; `browser-check.spec.ts`):
  my API on 4467 with the scratch database `jeeves_v315` (now dropped) and Vite on 4477. At
  1440×900 and 1280×800 it made the TinyURL foundation study through Project → New project and
  showed Detailed and Simple: 7 tiles and 7 lines in each, no page or console error, both projects
  deleted (204). A first run, while my Docker steps were recreating containers, saw Chromium's
  `net::ERR_NETWORK_CHANGED` resource errors from the host's network changes, not from the page;
  rerun with Docker quiet it passed cleanly. No studio UI changed in this unit.

## Cleanup

- **My stack:** `docker compose --profile '*' down --volumes --remove-orphans` on
  `jeeves-v315-watch` (15 containers, 5 volumes and the network removed), then
  `docker image rm jeeves-v315-watch-app jeeves-v315-watch-media`. Nothing named `v315` remains,
  and 45660–45662 are free.
- **Files:** I deleted the copy, with its `.runtime` (the secrets and the three account
  passwords), `node_modules` and `dist`; the fixture copies; the type-check copies; the scratch v2
  export and the archive's extraction; the temporary index; and the run records. No token or
  password was written to a file: the harness reads the password files at run time and keeps
  tokens in memory.
- **The owner's state matches the record:** the same 43 container IDs, names, restart counts,
  start times and health (42 healthy); the same 18 volumes, 9 networks and 31 image rows (tag, ID
  and digest); the v1 and v2 edges answer 200, and only 45400–45402 listen in 454xx.
- **Dev servers:** the owner's servers on 4300 and 4310 were not touched. Mine on 4467 and 4477
  are stopped, and `jeeves_v315` is dropped.
- **[`operator-harness.tar.gz`](operator-harness.tar.gz)** keeps the scratch scripts that made
  this record, none holding a credential: `harness/lib.mjs` (V3-13's PKCE sign-in and edge client),
  `upload.mjs`, `probe.mjs`, `extras.mjs`, `readback.mjs` and `tap.mjs` (run inside `app-watch-api`);
  `stage.py`; `env.sh`, `restart.sh`, `pass.sh`, `states.sh`, `watchstate.sh`, `snapshot.sh` and
  `incontainer.sh`; and the browser check with its config.
