# FP06b upload handoff

Base **65f3a33b5a16418f8ae414628def67c7da8bab77** (FP06a); untouched generated comparison
**02ac280da62616e9c7aad7f88457dcb72084cb25**. Only creator/upload/browser/operator subset is
implemented. [Evidence](evidence/fp06b/README.md), [operator instructions](../app/README.md),
[FP06a interfaces](fp06a-foundation.md) and [next stage](implementation-plan.md#fp06c--actual-processing-lifecycle-publication-and-playback).

Final **jeeves-youtube-v1** runtime is retained, healthy at **http://127.0.0.1:4400/**; Identity4401,
S3 signing4402, all loopback. Seven containers: postgres, broker, objects, identity, search-index,
upload, edge. No cache, Transcoder, lifecycle, Watch, indexer, Search API or counter starts.
Only Upload's `upload-jobs` relay and Upload's30s multipart cleanup/reconciliation loop run.
There is no pending-job deadline sweep yet. Use `pnpm stop` / `pnpm start` in `app/`, preserving
`.runtime`, Compose name and all five volumes. First initialization is `pnpm first-run`; its
tracked record refuses ambiguous bootstrap replay, changed credentials or missing/mismatched
recorded volumes. No independent outside-checkout runtime startup was attempted here; own frozen
install/build/checks and Docker edge build passed there. Final all-service independent S01 is FP07b.

Credentials are local files, never values in evidence: `app/.runtime/secrets/creator_password`
for `creator`, `other_creator_password` for `other-creator`. The private runtime parent is0700;
container-readable mounts remain UID-readable. Local bootstrap credentials/realm stay provider-
only. Upload mounts only metadata_upload, broker and upload S3. All current config bytes,
`.jeeves`, inputs, snapshots001–010, generator and templates remain unchanged in this unit.
Saved v1 is still schema3/revision6/source010; no adopted design/presentation decision required
another native snapshot. The frozen005 profile deliberately remains ineligible for this custom copy.

`extensions/upload-multipart.ts` exports `UploadMultipart(pool,control,signing)`, `PART_SIZE`,
`parseUpload`, `validateParts`, `uploadView`. Its methods own creator-scoped start/list/status/
sign/complete/abort and bounded sweep. All route auth/JWKS/dependencies are inside awaited handlers.
`services/upload.ts` uses the actual `transaction(pool, tx => ...)` state functions, no autocommit
state writes or private-row wholesale responses. SQL bigint fingerprints are converted from strings
at the finite HTTP boundary. Status maps only owner-visible fields. No caller key/bucket/provider
ID/ETag reaches control authority. ListParts validates exact consecutive part sizes before complete;
Head validates the exact saved object's size/metadata. Actual SHA is independently checked in smoke
and must be checked again by the worker. URLs sign public4402; control remains objects:3900.

`state/video.ts` adds bounded `interruptedUploads(tx)` and conditional `reopenIncomplete(tx,id,sub)`.
The former covers interrupted initiating/completing SQL/provider gaps, not job deadlines. Known
cleanup intent is persisted before provider abort and cleared only after safe success; a bounded
paginated recognized-original namespace pass handles >24h unsaved multipart orphans. Completed
originals remain retained. Expiry/cleanup/reconciliation code is implemented; no24h wait/fault
campaign is claimed. The HTTP helper now drains timed-out admitted work on close and defaults
unknown dependency failures to finite503. The publisher now exposes `closed: Promise<{fatal:boolean}>`
and safely closes after transport loss. Upload awaits that signal or process termination, then
stops HTTP/sweep/relay/pool/clients. Normal stop/restart and a targeted HTTP drain check pass;
there was no separate publisher-loss campaign in FP06b.

Browser code is under `browser/`; separate DOM-only TS build emits ignored `dist-public/` and copies
installed pinned hls.js for the next player stage. Node-only modules cannot enter that browser build.
The edge image copies built assets and exact nginx pin; there is no host public mount. Access logging
is disabled before real OIDC use so callback codes stay out of logs. Tokens are session-only;
cryptographic one-use state/nonce and PKCE S256 bind the exact callback. `/me` supplies trusted
identity before controls enable. Provider logout was proved by the next sign-in showing the login
form. UI has real file/title/description/progress, recent/status, pause, reselect/resume and abort;
public Watch/search are visibly unavailable. Completed-transfer progress remains100% on selection/
refresh/reload even though closed multipart status returns no live parts; failed-with-jobId also
retains a completed transfer. Aborted/expired/initiation-failed states show explicit terminal text. It uses one PUT at a time (within the bound of two).

Fixture is retained at **app/.runtime/media/youtube-v1-fixture.mp4** (no Git media), generated with
the frozen recipe and actual pinned field FFmpeg image **jeeves-youtube-v1-ffmpeg**:

- Size **15,584,953 bytes**; SHA256 **1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9**.
- H.264 High/yuv420p1280×720/24fps, AAC48kHz mono,20s. Version/configuration/ffprobe/log retained.
- Actual S02 PUT sizes **5,242,880 / 5,242,880 / 5,099,193**, ETags/ListParts retained; both completed
  objects independently streamed to the exact same hash/size. Multipart ETag is a different value.
- Same bytes/mtime must stay for browser resume and later v2 comparison. Small ignored `invalid.mp4`
  is text for FP06c invalid-media checks. The sparse oversize and unsupported-text probes were removed.

Two real jobs are durable and unconsumed (queue2, consumers0, one sent intent each). The separate
aborted upload is `d2c52469-916e-4428-9f56-4be397735dd6` / video56815172-d561-4a8b-bf57-f4bb5f9f4063.
There are no provider multiparts left, no fake ready/publication/search/count data.

| Upload / video | Job / logical attempt | Queued / fixed deadline (UTC) |
| --- | --- | --- |
| 19e4dfe6-b26c-4200-bf85-6ce8ce4cf124 / f96198cf-1c7d-41ff-ae36-3eac1a9af476 | 70e28948-1872-4cb3-97bd-11e5bdfbe025 / b9536b60-bd0e-4cba-8389-74bbd1fdc6a8 | 2026-11-08 05:39:08.889 / 05:49:08.889 |
| 5cd4edbb-9143-4bd7-8ebb-80a151b2a929 / 1fe2c0fc-8034-4ea5-b0c2-c9c11b596774 | 14d205b3-752b-4574-a1f3-31fde2aba8a2 / 26ad35f1-38f1-4aa4-b661-08525f5c48b1 | 2026-11-08 05:39:10.392 / 05:49:10.392 |

**Those deadlines elapsed during staged implementation/checks.** Leave the jobs/identities durable;
FP06c must use fresh uploads for successful processing acceptance and retain the final ten-minute
policy. Do not extend deadlines or interpret the deliberately stopped lifecycle sweep as success.
FP06c now implements the three actual FFmpeg extensions/worker, lifecycle consumer/publication relay/
fixed-deadline sweep, ready-only Watch/cache and browser HLS. Search/index/count consumers stay stopped
until FP07a. Reuse the retained media bytes, SQL/client contracts and exact pins; no source rewrite or
broader provider campaign is needed merely to begin that unit.
