# YouTube v3

YouTube v3 is v2's video platform designed again in the studio, by mouse, from a blank project,
with the studio's v3 additions: an **Optional** sign-in for watchers on Watch API, a separate
**Account API** whose **Favorites** keep each signed-in account's favorite videos, kind labels
instead of kind words in names, and **Runnable processes** on. It has 21 tiles, 33 lines in
Simple (8 dashed, all through a queue or topic), 26 modules (24 Template, 2 Stub), 30 module
connections and 8 useful values.

- **Plan:** [YouTube v3 plan](../../../../docs/plans/youtube-v3/units.md) (V3-11 to V3-17).
- **Design:** [v3 contract](../../../../docs/plans/youtube-v3/contract.md) §5, as data in
  [`fixtures/v3-modules.ts`](../../../../jeeves/packages/spec/src/fixtures/v3-modules.ts).
- **Built by mouse:** [V3-11 evidence](../../../../docs/plans/youtube-v3/evidence/v3-11/README.md)
  and its spec, [`e2e/v3-build.spec.ts`](../../../../jeeves/apps/web/e2e/v3-build.spec.ts).

## The studio project

**YouTube v3**, ID `e56a3800-d0d6-43df-b6d0-01019c4bae8b`, saved revision **171**, in the owner's
`jeeves` database ([open](http://127.0.0.1:4300/?project=e56a3800-d0d6-43df-b6d0-01019c4bae8b)).

## Snapshot (V3-11)

| File | What |
| --- | --- |
| [`inputs/design.json`](../inputs/design.json) | The saved design in the server's canonical encoding (sorted keys, array order kept, UTF-8, no trailing newline), the bytes Generate project assembles. SHA-256 `9762df418108917c71f42de6190c3c756d1db62dbaeca83653b6e9b6db93813f`. Don't pretty-print or resave it. |
| [`inputs/blueprint.json`](../inputs/blueprint.json) | Blueprint v3 of the same revision (`GET /api/projects/<id>/blueprint?version=3`). |
| [`diagrams/detailed.png`](../diagrams/detailed.png), [capture](../diagrams/detailed-capture.json) | Export diagram → PNG in Detailed: 5312×3520, 24 tiles (with the user and actions), 37 lines. |
| [`diagrams/simple.png`](../diagrams/simple.png), [capture](../diagrams/simple-capture.json) | Export diagram → PNG in Simple: 3904×2976, 24 tiles, 33 lines. |

Both captures name revision 171 and the design's SHA-256 above. They were taken from a Vite dev
server at commit `2cf676f`; its uncommitted changes were V3-11's e2e files and the owner's
`.jeeves-feedback/`, none of them renderer code.

## Two outputs

The owner asked for two outputs per field project ([owner feedback](../../../../docs/plans/youtube-v3/units.md#owner-feedback-2026-11-10)
item 11, decision D8):

| Folder | What it is | Who edits it |
| --- | --- | --- |
| [`generated/`](../generated/) | **Generated code only.** The exact export of [`inputs/design.json`](../inputs/design.json) with Runnable processes on, as Generate project's ZIP gives it. Read it to see what Jeeves writes from the diagram. | Nobody, ever. |
| [`app/`](../app/) | **Generated code plus the rest of the solution.** It starts as a byte-for-byte copy of `generated/` and is completed in place. | V3-13 to V3-16, each change listed in [`custom-paths.md`](custom-paths.md). |

### `generated/`

It was made in V3-12 by `pnpm --filter @jeeves/generator export:v2
"$PWD/field-projects/youtube/v3/inputs/design.json" <new directory>`, which uses the same
assembler and template registry as the studio's **Generate project → Download project ZIP**.
It has 112 files (5,133,781 bytes), 0 findings and `processes.runnable: true`; manifest SHA-256
`1e06c42996279d0c34f1f5db37387b000332ba9cbd6cfb86ef5193aaf4427250`. A fresh export and the
studio ZIP of the kept project gave the same 112 files, byte for byte
([evidence](../../../../docs/plans/youtube-v3/evidence/v3-12/README.md)).

Nothing was added to it, removed from it or reformatted. Its [`README.md`](../generated/README.md)
is the export's own, which is why this explanation lives here. Biome skips it. Later units check
that `git diff <V3-12 commit> -- field-projects/youtube/v3/generated/` is empty.

Where to look:

- **`src/processes/<tile>.ts`:** one process per application tile (four HTTP, four workers),
  with its compiled settings and what it mounts.
- **`src/runtime/`:** the reusable mechanisms (sign-in, multipart, lifecycle, HLS, cache, counter,
  favorites, search, delivery, loops).
- **`src/modules/`:** what is yours to write. There are 8 hooks files and the 2 stub bodies,
  View count reader and View publisher.
- **`infra/postgres/`:** the template migrations, plus the 4 product SQL files, which are empty
  in the export.
- **`.jeeves/report.json`:** what runs, every route and loop, and the 9 required gaps (7 template
  binding files and the 2 stubs).

### `app/`

At V3-12, `app/` equals `generated/`, byte for byte. That commit is the backend LOC benchmark's
baseline (contract §6), with the reviewed [scope](benchmarks/backend-scope.json) and its
[file-by-file review](benchmarks/scope-review.md): 71 backend `src/` files, 6,251 LOC. V3-13 to
V3-16 then filled in the following, and V3-17 measured the result:

- the product hooks;
- the two stub bodies;
- the product SQL (`published.videos`);
- the account script;
- the reused v2 browser.

**Since V3-16, `app/` works end to end, in the browser at the edge's origin:** a creator signs
in, uploads in resumable parts and sees the upload's status; the video is processed and published;
anyone searches for it and watches it, and its plays are counted; a signed-in account keeps
favorites. **V3-17 ran the acceptance** (contract §7) from a fresh copy: see the
[scenarios](scenarios.md), the [owner review pack](review-pack.md) and the
[backend benchmark](benchmarks/README.md) (556 post-template lines, 91.75% template).

#### Progress

| Unit | Area | State |
| --- | --- | --- |
| V3-13 | Upload | **Done** ([evidence](../../../../docs/plans/youtube-v3/evidence/v3-13/README.md)). The account script; the creator check on multipart's `principal`; every multipart hook; the lifecycle's `metadata`, `job` and `response`. A signed-in creator starts a multipart upload, sends its parts to signed URLs, pauses and resumes from the parts that arrived, and completes it; the job reaches Upload jobs. Anonymous 401, a non-creator 403, another creator 404, an aborted upload 410. |
| V3-14 | Processing and lifecycle | **Done** ([evidence](../../../../docs/plans/youtube-v3/evidence/v3-14/README.md)). Every Transcoder hook, the rest of the lifecycle's hooks, and `published.videos` in the Lifecycle writer's SQL file. A completed upload goes pending → processing → ready: the Transcoder encodes H.264/AAC HLS at 360p and 720p in 4 s segments, with a full-size thumbnail, into Transcoded videos; the ready video is in `published.videos`, and one `VideoPublished` reaches Publication events after the ready commit. Invalid media goes pending → processing → failed `INVALID_MEDIA`, with no output and no publication. Search indexer then stops at "Not implemented: mapping for Index writer" (V3-16's). |
| V3-15 | Watch and Favorites | **Done** ([evidence](../../../../docs/plans/youtube-v3/evidence/v3-15/README.md)). The five cache read hooks, the two Watch stubs, the four counter hooks and Favorites' `eligible`. Anyone, signed in or not, reads a ready video's details from `published.videos`, then from Hot metadata for the cache's TTL; a pending, failed or unknown video is 404 and never cached. A play of a ready video (`POST …/watch-api-view-publisher/<videoId>` `{eventId}`, 202) reaches View events with the viewer's subject or `null`, and View counter counts it once per `(videoId, eventId)`; `…/watch-api-view-count-reader/<videoId>` reads the total fresh. A signed-in account adds, checks, lists and removes favorite videos; only a ready video may be added (404 `NOT_ELIGIBLE`), and anonymous callers get 401. One scaffold edit (gap 6). |
| V3-16 | Search and the browser | **Done** ([evidence](../../../../docs/plans/youtube-v3/evidence/v3-16/README.md)). The Index writer's five hooks and Video search's two: a `VideoPublished` is indexed as the ready video's public record (v2's mapping, version 1), and `…/search-api-video-search?q=&page=` finds ready public videos by title, description and channel (v1/v2's preset), each hit with its thumbnail under `/cdn/video-delivery/`. The v2 browser, moved to v3's routes in `browser/` and `public/` and served by the edge at `/`, with an Optional sign-in for watchers and, when signed in, a ☆/★ favorite toggle and "My favorites". Four scaffold edits so the edge can serve it (gap 8). |
| V3-17 | Acceptance and benchmark | **Done** ([evidence](../../../../docs/plans/youtube-v3/evidence/v3-17/README.md)). No change to `app/`. A fresh copy outside the checkout, observed by mouse and by API: S01, S03, S06, S07, S09 and S10 in full; S05 except human listening; S02, S04 and S08 in part, because of gap 1 (complete answers 200, and the page can't show pending, processing or failed). Stop and start kept everything. `custom-paths.md` matches `diff -rq generated app`. Backend LOC: 72 files, 556 post-template, 91.75% template ([report](benchmarks/README.md)). |

What each unit wrote is in [`custom-paths.md`](custom-paths.md); what the templates can't yet
express is under [template gaps](#template-gaps-found-while-completing-app).

**Where S04's status comes from (V3-14).** A video's state is the lifecycle's own record, the
template table `upload_api_multipart_uploads.assets` (`state`, `failure_code`, `queued_at`,
`started_at`, `ready_at`), and only the lifecycle moves it: uploading, then pending at complete,
processing at `ProcessingStarted`, then ready or failed. No v3 route can show it to the creator.
The upload's status route shows the upload's own state, and its hooks can't merge the video's
(gap 1). No published view shows it either: every login on Metadata, Watch API's and Account
API's included, may read `published`, and v2's status was the creator's alone. So S04's sequence
is observed where the lifecycle writes it: in `assets`, read as the database owner in the scratch
run (as S04 already reads `published.videos`), and in the Processing events behind each change.
Ready is public through `published.videos`. The browser (V3-16) shows the upload's own status;
a completed upload reads "uploaded · not ready yet" until Watch's details route (V3-15) answers
its video (200, not 404), then "ready" with Watch video. Pending, processing and "failed" with its
message have no route until gap 1 is closed in the template, so an invalid upload stays "not ready
yet" in the browser.

**What Watch and Account API answer (V3-15),** through the edge, for V3-16's browser. Every
Watch route takes an optional `Authorization: Bearer <token>` (anonymous without one, 401
`SIGN_IN_REQUIRED` for a bad one); every Account API route needs one.

| Request | Answer |
| --- | --- |
| `GET /api/watch-api/modules/watch-api-video-details-cache/<videoId>` | 200: `videoId`, `title`, `description`, `channel`, `durationSeconds`, `publishedAt`, `publicationVersion`, `manifest`, `thumbnail`, `visibility`, `state`, and `manifestUrl` and `thumbnailUrl` under `/cdn/video-delivery/`; 404 `NOT_FOUND` unless ready; 400 `VIDEO_ID` |
| `GET /api/watch-api/modules/watch-api-view-count-reader/<videoId>` | 200 `{views}`, a decimal string, read fresh |
| `POST /api/watch-api/modules/watch-api-view-publisher/<videoId>` `{eventId}` | 202 `{eventId, accepted, acceptedAt, publicationVersion}`; 404 `VIDEO_NOT_READY`; 400 `VIEW_REQUEST`. Send one event ID per page session, once two cumulative seconds have played; a retry with the same ID counts once |
| `GET /api/watch-api/modules/watch-api-viewer-check/me` | `{signedIn:false}` or `{signedIn:true, subject, username}` |
| `PUT`, `GET`, `DELETE /api/account-api/modules/account-api-favorite-videos/items/<videoId>`, `GET …/items?after=` | contract §3: 200 `{itemId, addedAt}`, 404 `NOT_FAVORITE` or `NOT_ELIGIBLE`, 204, `{items, next}` |

**What Search answers (V3-16),** through the edge, with no sign-in:

| Request | Answer |
| --- | --- |
| `GET /api/search-api/modules/search-api-video-search?q=<text>&page=<n>` | 200 `{q, page, pageSize: 20, total, hits}`; each hit `videoId`, `title`, `description`, `channel`, `durationSeconds`, `publishedAt` and `thumbnailUrl` (`/cdn/video-delivery/…/thumbnail.jpg`). Ready public videos only, matched on title^3, description and channel^2 (any word), by score, then newest, then ID |
| a `q` empty or over 200 characters, a `page` outside 1–100, any other parameter | 400 `SEARCH_QUERY` |

A video is searchable about a second after it is ready: the lifecycle's outbox sends its
`VideoPublished` after the ready commit, and the Search indexer upserts it at its version. A
publication refused while a hook was unwritten stays in `publication-events--search-indexer.failed`;
it is indexed once sent back to the queue.

**The browser (V3-16)** is at `http://127.0.0.1:$LOCAL_HTTP_PORT/`. `pnpm first-run` and `pnpm
start` build it into `dist-public/` (git-ignored) and bind its sign-in to the run's ports; the edge
serves that folder. Signed out you can search and watch, and plays count anonymously. **Sign in**
(top right, Keycloak's page) as `creator` to upload (choose an MP4, a title and a description;
**Pause upload**, then after a refresh select the upload, reselect the file and **Resume selected
upload**), or as any account to favorite the open video (☆/★) and see **My favorites**. A sign-in
started on a watch page returns to that video.

### How to run each

Both run the same way: Node 24.21.0, pnpm 12.16.1 and Docker. Run `generated/` from a copy
outside the checkout, so the folder stays the bare export. `app/` can run from a copy too. Its
`.gitignore` keeps `node_modules`, `dist` and `.runtime` out of Git if it runs in place.

```sh
cp -a field-projects/youtube/v3/generated /somewhere/youtube-v3-generated   # or .../app
cd /somewhere/youtube-v3-generated
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
export COMPOSE_PROJECT_NAME=youtube-v3-generated \
  LOCAL_HTTP_PORT=45600 LOCAL_IDENTITY_PORT=45601 LOCAL_OBJECT_PORT=45602
pnpm first-run          # once: about 2 minutes, then 15 containers healthy (app/: builds the browser first)
node scripts/accounts.mjs   # app/ only, once: the creator role and the three local accounts
pnpm stop               # drains every process; keeps volumes and .runtime
pnpm start              # back, with the same credentials and data
```

**Ports:** pick a unique project name and three free loopback ports. Avoid the owner's v1
(4400) and v2 (45400–45402) stacks and Jeeves' own ports.

**Where things answer:**

- in `app/`, the browser at `http://127.0.0.1:$LOCAL_HTTP_PORT/`;
- the edge at `http://127.0.0.1:$LOCAL_HTTP_PORT/healthz`, and each public tile under `/api/<tile>/`
  (for example `/api/watch-api/modules/watch-api-viewer-check/me`);
- Keycloak's sign-in at `$LOCAL_IDENTITY_PORT` (realm `sign-in`, client `sign-in-web`);
- Transcoded videos at `/cdn/video-delivery/`.

**Credentials:** they are generated into the copy's private `.runtime/secrets` and are never in
Git. In `app/`, `node scripts/accounts.mjs` adds the realm role `creator` and three accounts:
`creator` and `other-creator` (creators) and `viewer` (not a creator). Their passwords are in
`.runtime/secrets/creator_password`, `other_creator_password` and `viewer_password`. Sign in
through Keycloak's own page (client `sign-in-web`, PKCE); there is no sign-up.

**Clean up a disposable copy:**

1. `docker compose --profile '*' down --volumes --remove-orphans`, with the same environment.
2. `docker image rm "$COMPOSE_PROJECT_NAME-app" "$COMPOSE_PROJECT_NAME-media"`.
3. Delete the copy, with its `.runtime`.

### What `generated/` answers

From V3-12's outside run, every route and loop answers, and each one stops at the first hook on
its path, which names itself:

| Path | Answer |
| --- | --- |
| Viewer check `me`, Optional | `{signedIn:false}` without a token, the account with one, and 401 for a bad one |
| Creator check and Account check `me`, Required | 401 without a token, the account with one |
| Video details cache `GET …/<id>` | 501 "Not implemented: key for Video details cache" |
| View count reader and View publisher, any method | 501 "Not implemented: View count reader" / "View publisher" |
| Video search `?q=` | 501 "Not implemented: mapping for Index writer"; 400 `SEARCH_QUERY` for a bad `q` or `page` |
| Multipart `POST …/uploads`, signed in | 501 "Not implemented: validate for Multipart uploads"; the list is empty; an unknown upload is 404 |
| Favorites `PUT …/items/<id>`, signed in | 501 "Not implemented: eligible for Favorite videos"; check 404, list empty, remove 204; 401 signed out |
| `/cdn/video-delivery/<key>` | 404 JSON for a missing key, 405 for a write |
| Upload jobs, Processing events, Publication events, View events | the message goes to its queue's `.failed` with `NOT_IMPLEMENTED` at attempt 1, and the log names `job for Segmenter and encoder`, `event for Lifecycle writer`, `mapping for Index writer` and `event for Receipt and increment` |

Hooks after the first one on a path (for example multipart's `metadata`, or the lifecycle's
`publication`) are reached only once the hooks before them are written. That happens in `app/`.

## Template gaps found while completing `app/`

Recorded as found. V3-13 and V3-14 worked around none and edited no generated scaffold. V3-15
made one small scaffold edit for gap 6, because without it v1/v2's duplicate-safe count can't be
had at all. V3-16 made four for gap 8, because the export has no place for a browser. Each is
listed in [`custom-paths.md`](custom-paths.md) as a scaffold edit.

| Unit | Gap | Effect in v3 |
| --- | --- | --- |
| V3-13 | **Multipart's HTTP answers can't be shaped from its hooks.** `src/processes/upload-api.ts` mounts `createMultipartHttpHandlers({ multipart, principal })` without its `response` and `error` options, and the compiled mounts carry no `statusCode`. | Start answers 200 with `assetId` (v2: 201 with `videoId`); complete answers 200 (v2 and contract S02: 202; its body does carry `videoId` and `jobId`). Status and list give the upload's own state (`uploading`, `completed`, `aborted`, `expired`), not the video's (`pending`, `processing`, `ready`, `failed`) or its failure, which v2's status merged in. Errors keep their codes, with one message, "Upload operation refused.". S04's "uploading → pending → processing → ready" therefore has no upload route to read from: V3-14/V3-16 must say where it comes from. |
| V3-13 | **A completion stopped by a failing hook blocks the next start.** The upload stays `completing`; multipart's sweep at start re-runs the completion, and any error that isn't the template's own fails the process: "Application startup failed", without the reason. Until then its status route re-runs it too. | Seen once mid-unit with an unwritten hook (the scratch upload was closed by moving its expiry); with every upload hook written nothing on the upload path reaches it now, but any other throw in a completion hook (a bug, a refused SQL statement) would. |
| V3-13 | **The outbox relay retries a codec failure silently.** An unwritten (or throwing) `job` codec is treated as a failed publish: the row is retried every ≤5 s for ever, with no log line and no `.failed`. | Seen mid-unit: 13 attempts, then sent once `job` was written. |
| V3-13 | **The lifecycle's and Transcoder's hooks get no key prefix.** Only multipart's hooks get `prefix`. | `video-contract.ts` repeats the compiled prefix as `ORIGINALS_PREFIX`; multipart's hooks refuse to start if they differ. The Transcoder's result prefix, `videos/<videoId>/<jobId>/<attemptId>/`, is v2's product path, kept in the contract (V3-14). |
| V3-14 | **A hook that throws while the Transcoder reports a failure stops the Transcoder.** When a job fails for good, the media worker's terminal step builds a `ProcessingFailed` through `eventId` and `event`. If either throws, the failure is fatal: `app-transcoder` exits 1 with no reason (its last line is the hook's `"action":"thrown"`), and the job, never acknowledged, goes back to Upload jobs. The next `pnpm start` takes it again while subscribing and fails with "container app-transcoder exited (1)". | Seen at steps 2 and 3, with `video` written but `eventId` not; writing `eventId` and `event` cleared it, and the job then failed normally. With every hook written nothing reaches it, but a bug in `eventId` or `event` would keep the Transcoder down. |
| V3-15 | **A stub's queue publisher can't name its message's ID, and the event counter's receipt is keyed on it.** The generated `queuePublisher` (`src/runtime/module-clients.ts`) gave every message a fresh ID, and `QueuePublisher.publish` (`src/modules/dependencies.ts`) had no way to pass one. The counter template requires each event's ID to be its broker message's ID (`createEventCounter`, "Counter event mismatch"), and its receipt is `(aggregate, event ID)`. | Without a change, a View publisher stub can't send a retried play as the same message, so no hook can make v1/v2's `(videoId, eventId)` count once: with the counter's hooks binding the play's event ID to the message ID (as v2's did), every play went to `view-events--view-counter.failed` as `MALFORMED_MESSAGE` (step 8 of the [V3-15 run](../../../../docs/plans/youtube-v3/evidence/v3-15/README.md)), and binding the message's random ID instead would count every retry. **Scaffold edit in `app/`:** `publish(message, { messageId })`, one line in each file; the generator fix is the same in `module-clients.ts.template` and `dependencies.ts.template`. |
| V3-15 | **The cache read's 404 can't be shaped from its hooks.** `src/processes/watch-api.ts` answers a null record with the template's own 404 `NOT_FOUND` "No record for this key."; `load` may only return null for a missing record. | A pending, failed or unknown video is 404 `NOT_FOUND`, where v1/v2's details said 404 `VIDEO_NOT_READY` "This video is not publicly available." (the View publisher still says that). The status is the same, and the browser (V3-16) reads 404 as not available. A bad ID is v2's 400 `VIDEO_ID` (from `key`). |
| V3-16 | **The export serves no browser and has no place for one.** The edge's `location /` answers 404 JSON, `app-edge` mounts only `nginx.conf`, nothing builds a browser, and nothing writes its sign-in binding (issuer, client, callback) for the run's ports. The search hooks themselves expressed v1/v2's policy fully: no gap there. | Serving v2's browser took four **scaffold edits** in `app/`: `infra/edge/nginx.conf` (`location /` serves the built files), `compose.yaml` (the edge mounts `./dist-public` read only), `package.json` (`first-run` and `start` build the browser first) and `.gitignore` (`dist-public/`). Because `local.mjs` records `compose.yaml`'s hash, an existing v3 runtime refuses to start with the new edge ("composition … differs"); it takes a fresh `first-run`. The generator fix: when a design has a user, emit a `public/` folder the edge serves at `/`, a browser build step and the sign-in binding. |
