# V3-13 evidence: complete upload

2026-11-11. [Plan](../../units.md#v3-13-to-v3-16--complete-v3-in-app) (the V3-13 row) ·
[contract](../../contract.md) §1, §2 (question 5), §5 and §7 · field project
[notes](../../../../../field-projects/youtube/v3/notes/README.md) ·
[custom paths](../../../../../field-projects/youtube/v3/notes/custom-paths.md).

**Result:** in `app/`, the upload path works end to end against the real stack:

- **Accounts:** `node scripts/accounts.mjs` creates the realm role `creator` and the users
  `creator`, `other-creator` (creators) and `viewer`, with generated passwords in `.runtime`.
- **Who may upload:** an authenticated creator can start a multipart upload. Anonymous and bad
  tokens get 401 `SIGN_IN_REQUIRED`, and a signed-in viewer 403 `CREATOR_REQUIRED`.
- **The upload:** the creator sends 3 parts to signed URLs and pauses after part 1. Signed in
  again, they list the parts that arrived (ListParts gives part 1) and send only parts 2 and 3.
  The upload then completes, and a repeated complete gives the same answer.
- **The job:** it reaches **Upload jobs**. The Transcoder then answers "Not implemented: job for
  Segmenter and encoder", which is V3-14's.
- **Refusals:** another creator gets 404 `UPLOAD_NOT_FOUND`, and an aborted upload 410
  `UPLOAD_CLOSED`.
- **The original:** its stored bytes hash to the fixture's SHA-256, and an anonymous GET of it is
  403.
- **Stop and start** kept everything.
- **`generated/` is untouched**, and no generated scaffold in `app/` was edited. Four template
  gaps are recorded below.

## What was written

All of it in `app/`, listed in [`custom-paths.md`](../../../../../field-projects/youtube/v3/notes/custom-paths.md).

| Path | What |
| --- | --- |
| `src/modules/video-contract.ts` (new) | The codecs both tiles share, from v2's product contract: metadata, the start request, the completion answer, the original's key, and the `VideoProcessingRequested` job with its stable event ID |
| `src/modules/upload-api/upload-api-multipart-uploads.hooks.ts` | `principal` with v2's creator role check (403). Also `validate`, `metadata`, `response`, `originalKey` and `job` |
| `src/modules/video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts` | What an upload reaches: `metadata`, `identities.request`, `job.codec`, `job.construct` and `response`. The rest is V3-14's |
| `scripts/accounts.mjs` (new) | The account script |
| `test/upload.test.ts` (new) | 5 offline tests (Node's own runner) |

**No product SQL.** Nothing on the upload path needs a product table. The upload, its asset and
the job's outbox are template tables (`upload_api_multipart_uploads.uploads`, `assets` and
`outbox`), so both writer files stay as exported:

- `metadata/modules/upload-api-upload-state-writer.sql` stays empty, as the contract says for v3;
- `metadata/modules/video-lifecycle-lifecycle-writer.sql` gets `published.videos` in V3-14.

## Docker: the owner's state, recorded first

- **Containers:** 43, of which 42 are healthy and the long-exited `excalidraw` is the other.
- **Other resources:** 18 volumes, 9 networks and 31 image rows (tag, ID and digest).
- **v1:** `jeeves-youtube-v1`, 14 healthy, edge `127.0.0.1:4400/healthz` 200.
- **v2:** `jeeves-youtube-v2`, 14 healthy on 45400–45402, edge 200.
- **Ports:** in 454xx only 45400–45402 listened; 45410–45412 were closed.

**Mine:** project `jeeves-v313-upload` on loopback **45620** (HTTP), **45621** (identity) and
**45622** (objects), all free, with no container, volume, network or image of that name.

## The outside copy

The copy, in the session scratchpad outside the checkout, was `cp -a generated` plus
`scripts/accounts.mjs`. All 112 export hashes matched. After that, each step rsynced `app/src/`
and `app/scripts/` into it, then ran `pnpm build`, `pnpm stop` and `pnpm start`.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts` (Node 24.21.0, pnpm 12.16.1) | exit 0, 0.3 s |
| `pnpm build` | exit 0, 0.5 s |
| `COMPOSE_PROJECT_NAME=jeeves-v313-upload LOCAL_HTTP_PORT=45620 LOCAL_IDENTITY_PORT=45621 LOCAL_OBJECT_PORT=45622 pnpm first-run` | exit 0, 130.8 s; 15 containers healthy, 0 restarts |
| `node scripts/accounts.mjs` | exit 0, 0.7 s: role and 3 users `created: true`, 3 password files 0600. A second run: 0.2 s, all `created: false` |

**Tokens** come from the real PKCE flow, scripted, as a browser does it: Keycloak's
authorization endpoint, its login form, the code, then the token with `code_verifier`. The client
is `sign-in-web`, with the redirect `http://127.0.0.1:45620/`.

- The access tokens' `aud` is `["sign-in-web","account"]`.
- `realm_access.roles` holds `creator` for `creator` and `other-creator`, and not for `viewer`.
- No token, password or signed-URL signature is in this record.

## Step by step, in the order a request reaches the hooks

Each row is one change in `app/`, then `pnpm stop` (4–5 s), `pnpm start` (74–77 s, all 15
healthy, 0 restarts) and the same probe: the creator's `me`, a start with no token, a bad token,
the viewer and the creator, and, once a start succeeds, the parts and complete.

| Step | Written | First answer that stops the creator |
| ---: | --- | --- |
| 0 | nothing (the export's hooks) | `POST …/uploads` → **501** "Not implemented: validate for Multipart uploads". The viewer gets the same 501, anonymous and a bad token 401. |
| 1 | `principal`: the creator check | The viewer gets **403** `CREATOR_REQUIRED`; the creator still 501 `validate` |
| 2 | `validate` | **501** "metadata for Multipart uploads". Refusals: size 268435457 → **413** `FILE_SIZE`; `notes.txt`/`text/plain` and `video/quicktime` → **422** `UNSUPPORTED_FILE`; an empty or 201-character title, a bad SHA-256 and an extra field → **400** `INVALID_UPLOAD` |
| 3 | multipart `metadata` | **501** "originalKey for Multipart uploads" |
| 4 | `originalKey` (and the prefix check) | **501** "metadata for Lifecycle writer": the start's `reserve` reached the lifecycle |
| 5 | the lifecycle's `metadata` | **Start 200**; sign 200; 3 part PUTs 200 with ETags; status lists part 1, then all 3. Complete → **501** "identities.request for Lifecycle writer", and the status route answers the same 501, because it re-runs a `completing` upload's completion |
| 6 | the lifecycle's `identities.request`, `job.codec` and `job.construct` | See below: the first start failed. Then complete → **501** "response for Lifecycle writer"; abort 200 |
| 7 | the lifecycle's `response` | **501** "response for Multipart uploads" |
| 8 | multipart `response` | **Complete 200** `{uploadId, videoId, jobId, attemptId, state:"pending"}`, and the same again. The job's outbox row stayed unsent: `attempts` 5 within 8 s, no log line (multipart's `job` was unwritten) |
| 9 | multipart `job` | The outbox row was **sent** at attempt 13. `upload-jobs.failed` got 1 message, and the Transcoder logged `"what":"job for Segmenter and encoder"`, `"action":"sent to upload-jobs.failed (NOT_IMPLEMENTED)"` |
| final | tidying (comments, one size guard) and the tests | the recorded pass below |

**Step 6's first start failed.** `pnpm start` exited 1: `app-upload-api` exited 1 with only
"Application startup failed", so the edge didn't start.

- **The cause:** step 5's upload had stopped at a 501 in phase `completing`. Multipart's sweep at
  start re-ran that completion, which now reached the next unwritten hook. The sweep tolerates
  only the template's own errors, so startup failed (template gap 2).
- **The way past it:** I moved that scratch upload's `expires_at` to now, as `postgres` in my own
  database. The next start's sweep then closed it through the template's own 24-hour expiry: the
  upload `expired`, and the asset `expired` through the lifecycle's `closed`.
- **After that,** every probe aborts an upload whose completion stops at a 501 (abort works on a
  `completing` upload), so the next start has nothing to re-run.

## The recorded pass (final code)

34 requests through the edge `http://127.0.0.1:45620`, 4 part PUTs and 1 storage GET (`…` is
`/api/upload-api/modules/upload-api-multipart-uploads`), with the
[fixture](../../../../../field-projects/youtube/v1/notes/scenarios.md#reproducible-media-fixture-recipe)
v1 and v2 used: 15,584,953 bytes, SHA-256 `1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`,
copied read-only from v1's runtime.

| Request (who) | Answer |
| --- | --- |
| `GET /api/upload-api/modules/upload-api-creator-check/me`: none / bad / creator / viewer | 401 / 401 / 200 `{signedIn:true, subject, username:"creator"}` / 200 `username:"viewer"` |
| `POST …/uploads`: none / bad | **401** `{"error":"SIGN_IN_REQUIRED","message":"Sign in to continue."}` |
| `POST …/uploads`: viewer | **403** `{"error":"CREATOR_REQUIRED","message":"A creator account is required."}` |
| `POST …/uploads` `{fileName:"youtube-v1-fixture.mp4", size:15584953, contentType:"video/mp4", lastModified, sha256, title, description}`: creator | **200** `{uploadId:"9de9fd5f-…", assetId:"9cf3ea9a-…", state:"uploading", partSize:5242880, partCount:3, expiresAt}`, with `expiresAt` 24 h ahead |
| `POST …/uploads/<id>/parts/1` | 200 `{url:"http://127.0.0.1:45622/original-videos/upload-api-multipart-uploads/9cf3ea9a-…/9de9fd5f-…/source.mp4?<signature>", expiresAt}`, 15 min ahead |
| `PUT` part 1 (5,242,880 bytes) to the signed URL | 200, ETag `"e427bb2d…8952"` |
| `POST …/uploads/<id>/complete` (paused: parts 2 and 3 missing) | **409** `INCOMPLETE_PARTS` |
| *pause; sign in again (a new token)* `GET …/uploads/<id>` | 200 `state:"uploading", phase:"active", parts:[{partNumber:1, size:5242880}]`, the same upload ID |
| sign and `PUT` only parts 2 (5,242,880) and 3 (5,099,193) | 200 each, ETags `"8b07cb8a…9510"`, `"5c1c3548…04e2"` |
| `GET …/uploads/<id>` | 200, parts 1, 2 and 3 |
| `GET` / sign / complete / abort `…/uploads/<id>`: other-creator | **404** `UPLOAD_NOT_FOUND` (each) |
| `GET …/uploads`: other-creator | 200 `{"uploads":[]}` |
| `GET …/uploads/<id>`: viewer / none | **403** `CREATOR_REQUIRED` / **401** |
| `POST …/uploads/<id>/complete`: creator | **200** `{uploadId:"9de9fd5f-…", videoId:"9cf3ea9a-…", jobId:"83a61e58-…", attemptId:"22cd0479-…", state:"pending"}` |
| the same again | 200, the same body (the stored answer) |
| `GET …/uploads/<id>` | 200 `state:"completed", phase:"closed"` |
| a second upload: start 200, part 1 `PUT` 200, `POST …/abort` | 200 `{uploadId:"756340b8-…", state:"aborted"}` |
| its complete / its part 2 sign | **410** `UPLOAD_CLOSED` / **410** |
| its abort again; its status | 200 `aborted`; 200 `state:"aborted"` |
| `GET …/uploads`: creator | 200, its 6 uploads (this pass's and the steps'), newest first, each with its metadata (`channel:"creator"`) |
| `POST …/uploads/not-a-uuid/complete` | 400 `UPLOAD_ID` |
| `POST …/uploads/<completed id>/parts/9` | 409 `UPLOAD_CONFLICT` |
| anonymous `GET http://127.0.0.1:45622/original-videos/<key>` | **403** `AccessDenied` (Garage refuses anonymous access) |

**The job on Upload jobs.** The relay published the job, and the Transcoder dead-lettered it at
attempt 1, which is V3-14's. Read back from `upload-jobs.failed` with the runtime broker login
inside `app-upload-api`, then put back:

```json
{
  "messageId": "b2ad1735-6c46-553f-ac35-c24ad28715da",
  "headers": { "x-delivery-attempt": 1, "x-terminal-code": "NOT_IMPLEMENTED" },
  "body": {
    "schemaVersion": 1,
    "type": "VideoProcessingRequested",
    "eventId": "b2ad1735-6c46-553f-ac35-c24ad28715da",
    "occurredAt": "2026-11-11T22:12:16.369Z",
    "videoId": "9cf3ea9a-0037-4598-8782-554903f0af3a",
    "jobId": "83a61e58-1ce1-41b3-8c60-56557a119dba",
    "attemptId": "22cd0479-4e27-4baf-80a2-6a420fb239a4",
    "originalKey": "upload-api-multipart-uploads/9cf3ea9a-0037-4598-8782-554903f0af3a/9de9fd5f-30f7-4a6f-a246-cb201a5933d3/source.mp4",
    "expectedSize": 15584953,
    "expectedSha256": "1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9"
  }
}
```

**The original.** Read inside `app-upload-api` with its own storage key: 15,584,953 bytes,
`video/mp4`, ETag `"346805d5…-3"` (3 parts). Its metadata holds `asset-id`, `upload-id`,
`sha256` and `expected-size`, and **the SHA-256 of its bytes equals the fixture's**.

**The database** (`d_metadata`, as `postgres`, in my scratch run):

| Upload | State | Asset state | Title |
| --- | --- | --- | --- |
| `225158a0` | expired | expired | step 5's (closed by the sweep, see step 6) |
| `1bd46c25`, `c401548c` | aborted | aborted | steps 6 and 7 |
| `1f6dfe91` | completed | pending → **failed `QUEUE_DEADLINE`** at its 10-minute deadline | step 8's |
| `9de9fd5f` | completed | pending → **failed `QUEUE_DEADLINE`** | the recorded pass |
| `756340b8` | aborted | aborted | the aborted upload |

- **The outbox:** two `jobs` rows, both sent, of type `VideoProcessingRequested`.
- **Schemas:** `m_upload_api_upload_state_writer`, `m_video_lifecycle_lifecycle_writer` and
  `published` exist, from V3-05; both product files are still header-only.
- **Without a Transcoder,** a pending video fails `QUEUE_DEADLINE` after 10 minutes, through the
  lifecycle's sweep. So a failure is visible rather than a video hanging, as in v1 and v2.

**Stop and start.** Before `pnpm stop` and after `pnpm start` (4.4 s and 64.7 s, all healthy, 0
restarts), these were identical:

- `.runtime` and `.runtime/secrets` 0700, with 25 files and the same combined hash, the 3
  password files included;
- `local-setup.json`, and the 5 volumes' creation times;
- a hash of every upload row;
- the outbox (2 rows, 2 sent), and `upload-jobs.failed` with 2 messages;
- the realm's 3 users, with `creator` on the 2 creators.

After the start, with new tokens:

- the creator's `me` answers 200, and `GET …/uploads` lists the same 6;
- complete on the finished upload gives 200 with the same stored answer, and on the aborted one
  410;
- other-creator gets 404, the viewer 403 and anonymous 401.

## Tests

- **`test/upload.test.ts`:** run in the copy with `node --test "test/*.test.ts"`, **5 passed** in
  186 ms. It covers 401 and then 403 at `principal`, `validate`'s bounds, the key and its prefix
  check, the job with both codecs and its event ID, and the completion answer.
- **Types:** `tsc` over `src` and `test` together exits 0. `pnpm build` compiles only `src`, so
  the test is in neither `dist` nor the image.

## Template gaps

Recorded in the [notes](../../../../../field-projects/youtube/v3/notes/README.md#template-gaps-found-while-completing-app)
and not worked around.

1. **The hooks can't shape multipart's HTTP answers.** The process mounts the handlers without
   `response` and `error`, and with no `statusCode`. So start is 200 with `assetId` (v2: 201 with
   `videoId`) and complete is 200 (v2 and S02: 202). Status shows the upload's state, not the
   video's lifecycle state or failure, and every error message is "Upload operation refused.".
   S04's status sequence needs a source that V3-14 or V3-16 must name.
2. **A failing completion blocks the next start.** An interrupted completion that throws anything
   but the template's own errors fails the process at start, without the reason.
3. **The outbox relay hides a codec failure.** It retries every ≤5 s for ever, with no log line
   and no dead letter.
4. **The lifecycle's and Transcoder's hooks get no key prefix,** so the contract repeats it and
   multipart's hooks check it at start.

## Backend LOC

`pnpm benchmark:source field-projects/youtube/v3/app d94b13a <a temporary commit of this tree>
field-projects/youtube/v3/notes/benchmarks/backend-scope.json`, with the scope unchanged:

- **72 counted files:** the 71, plus `video-contract.ts` under `src/modules`.
- **Final backend LOC:** 6,403. Of these, 6,237 are retained template lines and **166 are
  post-template**: `video-contract.ts` 83, the multipart hooks 56 and the lifecycle hooks 27.
- **Replaced:** 14 template lines (the throwing bodies and an unused import).
- **Outside the metric:** `scripts/accounts.mjs` and `test/upload.test.ts` are `outside-src`.
- **The share:** 97.41% now. This is not V3-17's result.

## Gates (D2)

- **`generated/`:** `git diff d94b13a -- field-projects/youtube/v3/generated/` is empty, and
  there are no untracked files in it.
- **The processes-off pin and v1:** `processes-off.test.ts`, `generator.test.ts` and
  `assemble.test.ts` pass (3 files, 17 tests), and were in `pnpm check` too. v1 is byte-identical.
- **Frozen v2:** a fresh `export:v2` of `field-projects/youtube/v2/inputs/design.json` gives 72
  files, 70 byte-identical to `generic-export.tar.gz`. `manifest.json` and `report.json` are equal
  under `provenanceWithoutInventory`.

## Repository checks

- **`pnpm check`:** exit 0 (1 m 17 s). **748 tests in 104 files**, the same as V3-12, since this
  unit added no repository test. Lint showed only the existing info.
- **E2E:**
  - **The full run:** **79 passed, 1 failed** (6.2 m). `module-authoring.spec.ts:849` ("with
    Runnable processes on, Preview lists each writer module's own product SQL file") timed out
    after 30 s, waiting for Microservice's "Add linked tile" button during its build.
    `v3-build.spec.ts` (2.6 m) and `v2-rebuild.spec.ts` (2.0 m) passed.
  - **Rerun alone:** it **passed** (8.5 s).
  - **A leak:** the timed-out test had left its project "E2E Product SQL" in `jeeves_e2e`. I
    deleted it through a short-lived API on that database (204), so the database again holds
    only its long-standing TinyURL project.
  - This unit changed no studio, spec or generator code.
- **Web build:** passed (919 ms), with the existing chunk-size advisory.
- **Browser check** (scripted Chromium, by mouse):
  - **Setup:** my API on 4464, on the scratch database `jeeves_v313` (now dropped), and Vite on
    4474.
  - **What it did:** at 1440×900 and at 1280×800 it made a project from the default study,
    "TinyURL · foundation study", through Project → New project.
  - **Result:** 7 tiles and 7 lines in both Detailed and Simple, at both sizes, with no page or
    console error. Both projects were deleted (204).
  - No UI changed in this unit.

## Cleanup

- **My stack:** `docker compose --profile '*' down --volumes --remove-orphans` on
  `jeeves-v313-upload` (15 containers, 5 volumes and the network removed), then
  `docker image rm jeeves-v313-upload-app:latest jeeves-v313-upload-media:latest`. Nothing named
  `v313` remains, and 45620–45622 are free.
- **Files:**
  - I deleted the copy, with its `.runtime` (the secrets and the three account passwords),
    `node_modules` and `dist`;
  - and the fixture copy and the scratch v2 exports.
  - No token or password was ever written to a file. The harness reads the password files at run
    time and keeps tokens in memory.
- **The owner's state matches the record:**
  - the same 43 container IDs and names, with the same restart counts, start times and health
    (42 healthy);
  - the same 18 volumes, 9 networks and 31 image rows (tag, ID and digest);
  - the v1 and v2 edges answer 200, and only 45400–45402 listen in 454xx.
- **Dev servers:** the owner's servers on 4300 and 4310 were not touched. Mine on 4464, 4465
  (the short-lived `jeeves_e2e` API) and 4474 are stopped, and `jeeves_v313` is dropped.
- **[`operator-harness.tar.gz`](operator-harness.tar.gz)** keeps the scratch scripts that made
  this record:
  - `lib.mjs`: the PKCE sign-in and the edge client;
  - the probes, the recorded pass and the after-restart pass;
  - the in-container broker read and original hash;
  - the restart and state helpers.

  None of them holds a credential.
