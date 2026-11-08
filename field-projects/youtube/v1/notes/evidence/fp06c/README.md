# FP06c — real processing, committed publication and public playback

2026-11-08, base FP06b **384ff5172f3bfc735c82c00a22c9c04acb840b5b**, untouched generated baseline
**02ac280da62616e9c7aad7f88457dcb72084cb25**. Sequential Sol/xhigh sole writer on primary main,
no branch/worktree/stash/subdelegation/push. Active time/tokens/cost/savings unknown. Exact next
interfaces/IDs/runtime limits are in [handoff](../../fp06c-playback.md), cumulative file accounting
in [provenance](provenance.json). `.jeeves`, frozen005 inputs, source/config/native001–010,
generator/templates/pins/locks remain unchanged; no new architectural decision or011 was needed.

| Frozen scenario | Bounded result here |
| --- | --- |
| S04 | **Pass actual fresh flow:** uploading/pending→processing→ready, actual CPU H264/AAC360/720 HLS with five4s segments each, source-size JPEG, immutable marker and one committed publication. Same job and success re-delivered: no output rewrite or second publication. |
| S05 | **Automated video/PCM/mouse evidence:** signed out,5.005s playback,124 decoded frames/0 dropped,1280×720, real playlists/segments and206range, mouse seek5.155→15.453s. Unmuted volume1 Web Audio PCM peak440.085Hz/RMS.06245, context running. **No human listening occurred**; do not describe this as a human audible-tone observation/full human audio criterion. |
| S08 | Partial: invalid completed MP4 visibly INVALID_MEDIA/public404/no publication; safe HTML503 fallback; old staged jobs QUEUE_DEADLINE, late results ignored; signed-out ready persists across normal rebuild/start. Full independent integrated restart/S01/S08 is FP07b. |
| S06/S07 | **Open/unimplemented.** Search API/indexer/Counter stopped. Publication queue retains one committed event, totals empty0; view POST explicitly503 and no playback event emitted. |

`processing-result.json` retains actual three PUTs/sizes/ETags and observed status/API pending404→
ready200; original fixture bytes/mtime unchanged. Publication queued06:04:45.461, processing start
06:04:46.041, ready06:04:49.243 UTC. Two intentionally aged FP06b jobs visibly failed under fixed
10min queue policy; no ID/deadline relabel/purge. Those workers still encoded outputs because the
no-SQL worker cannot inspect lifecycle state; lifecycle ignored their late results. Those remote
objects stay as explicit orphans, not ready/search results.

`transcoder.log` retains actual safe argv, CPU encode logs and per-rendition probes; exact same
pinned field FFmpeg5.1.9 configuration is in`ffmpeg-version.txt`. `ffprobe-360.json` and
`ffprobe-720.json` inspect actual HLS through edge (H264/yuv420p640×360 and1280×720, AAC48kHz stereo,
20.000s). `media-and-duplicate.json` independently re-downloads/hashes original and all output
objects, checks the complete inventory against actual bytes, retains master/VOD/ENDLIST text,
marker bindings, content types and before/after LastModified/ETags/SHA/size. The original SHA is
1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9; all output hashes differ.

`committed-state.json` retains safe private row projections, inbox outcomes and outbox payloads;
ready and publication are atomic, duplicate success returns the prior ready outcome. Invalid media
video c922e399-2095-4253-a109-cf4950d1c76c has no public view/publication. `lifecycle.log` records
terminal/started/ready/duplicate/failed receipts; `queues.txt` shows no unfinished consumers and one
retained publication plus one invalid-media failed copy. Nothing was purged to obtain that state.

`browser-result.json` retains signed-out media requests, decoded frames/PCM/mouse seek/range,
explicit count503 and invalid failure. No tokens/signed URL queries/codes/passwords/raw auth traces
or media bytes are saved. Actual screenshots show signed-out playing/seek, invalid failure/refusal,
final creator ready/failed and public details/thumbnail. `ready-cache.json` shows positive metadata
TTL≤3600, no cached counts, absent invalid key and separate empty SQL totals. Pure checks cover
single-flight, miss→ready (no negative cache), cache fallback and short single-segment inventory.
`edge-headers.json` retains final MIME/cache and absent-media404 headers. Final mouse audit also
simulates an HTML503 only in that page route and confirms the safe finite message/no details.

Local temp directories are removed on every worker exit path. **Remote partial/orphan prefixes are
retained:** this is a documented bounded-v1 deviation from the plan's best-effort remote-cleanup
idea. No S3 cleanup, atomic multi-object or atomic ACL publication is implied. Guessed partial
public-bucket keys can be fetched; ready-only Watch/search is the application publication boundary.

Scoped generated-helper repair is distinct from custom business extensions: AMQP now shares
idempotent cancel/drain/close, preserves graceful ack, waits for admitted work before closed and
avoids fatal self-await. `consumer-drain.json` uses only unique synthetic queues to verify normal
drain/ack, terminal-hook failure with unacked requeue and fatal transport drain. All owned scratch
queues were deleted; final application queues/data remain. `foundation.log` records seven own
network-free checks and both own server/browser TypeScript builds. No provider/fault/load matrix,
new generic contract system or template certification was attempted.

Observed failed attempts/repairs (kept distinct from product behavior):

- Native-control harness first clicked the timeline at height−22 instead of Play at height−48;
  playback stayed paused and the30s harness wait failed. Actual screenshot`playback-first-attempt.png`
  retained. Correct mouse coordinates then played successfully; product controls required no repair.
- First successful playback probe serialized the platform VideoPlaybackQuality object as`{}`,
  causing its frame assertion to fail. `playback-probe-first.json` retains that attempt, including
  actual5.005s/PCM440.085Hz. Explicit frame properties fixed the harness; replay measured124/0.
- API states changed within4s, before the5s UI poll. The initial `ready-api-before-ui-poll.png` retains the pending DOM; two byte-identical
  pending/processing captures are omitted.
  Final mouse Refresh/selection waited for real ready badge/100%/Watch button (`creator-ready.png`).
- Duplicate probe initially published to nonexistent exchange`upload-jobs`, yielding a broker
  not-found; production already uses default exchange + routing key`upload-jobs`. Corrected probe,
  then confirmed same job/result and unchanged outputs. No queue purge or product repair.
- Scratch drain probe initially requested transient nonexclusive queues, rejected by RabbitMQ4.4;
  used durable unique scratch queues, without changing production broker config. Passing probe
  removed its own queues only. No application traffic was diverted.
- Early review corrected marker inventory minimum7→6 for valid1s/single-segment media and removed
  unbound hardcoded CODECS attributes. Cancellation now force-kills/awaits close rather than racing
  temp cleanup on AbortError. Watch HTML error fallback is safe. These were fixed before final build.
- Biome stdin formatting first hit its disabled HTML formatter twice; scoped TS/CSS formatting then
  passed. No root config or prior generated artifacts were formatted.

Required Jeeves regression results and final studio mouse preservation audit are recorded below
once completed. App build/checks are separate because root intentionally excludes this independent
app. Final stack/credentials/fixture/volumes remain for FP07a and owner; no paid/cloud/model calls,
secret/media/deps/dist/runtime files or broad Docker cleanup enter Git.

Final required regressions were sequential, source steady, after Docker builds/cleanup finished:
first `pnpm check` hit the known PGlite restart5s timeout (397/398,22.37s); unchanged projects test
file passed12/12 in4.92s, then unchanged full **398 tests/50 files in22.56s**, with lint/types.
No test/root/timeout edits. Native **36/36 E2Es in1.4m** pass first try. Web build **976ms** passes,
with existing chunk-size advisory. Logs below retain the first failure, isolated and passing runs.
Final actual mouse owner4300 local-v1 schema3/r6 Fit22/27 plus Upload focus, TinyURL53 Fit12/13,
all four complete project/design/history/layout/blueprint responses and listing preserved, zero
page errors (`studio-mouse.json`). E2E DB retains its original default-only TinyURL project.
No native011/source correction or duplicate architectural PNG was needed. Final agent studio
screenshots are regression evidence, separate from immutable native diagram history.
