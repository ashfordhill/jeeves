# FP06c processing/playback handoff

2026-11-08. Base FP06b **384ff5172f3bfc735c82c00a22c9c04acb840b5b**. Primary main, sequential sole
writer; no generator/template/inputs/`.jeeves`/pin/lock/config/source/diagram changes. Current
saved schema3/r6/native010 still deliberately refuses frozen-profile export. Custom runtime is
independent of Jeeves. No v2 or template certification follows from this unit.

Final runtime stays at **http://127.0.0.1:4400/**, identity4401 and S3 signing4402, Compose
**jeeves-youtube-v1**. `app/.runtime/` and all six final volumes/secrets are preserved; creator
password is read locally from `app/.runtime/secrets/creator_password` (username `creator`). Other
creator and original final fixture remain unchanged. See [app operator guide](../app/README.md).
Normal `pnpm stop` / `pnpm start` starts only implemented services: provider PostgreSQL/broker/
Garage/Keycloak/OpenSearch/Valkey plus Upload/lifecycle/Transcoder/Watch/edge (11 containers).
Search API/indexer/Counter stay stopped. Do not reset volumes, rotate secrets or replay bootstrap.

## Real media and publication

Ready video **fdbbc43f-78a0-4be2-9910-a383de70acf6**, upload803dd497-b3a6-4e96-a1b8-529e391e3da2,
jobc6efa967-96cf-4be2-811d-6a397f7cfb21, attempt649849ac-f0c4-4ff9-b8e1-219d78d08351.
Public link: <http://127.0.0.1:4400/?watch=fdbbc43f-78a0-4be2-9910-a383de70acf6>.
Actual queued06:04:45.461 UTC→started06:04:46.041→ready06:04:49.243. Fixed processing deadline
06:34:46.041. Fixture retains15,584,953B/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9
and original mtime1794116246303ms. Original re-download matches exact SHA/size; actual outputs differ.

`src/extensions/transcoder-{encoder,packager,thumbnails}.ts`, `src/lib/media.ts` and real worker
implement bounded hash/size/MP4/H264/AAC/dimension/duration validation, safe argv CPU encode two
renditions plus thumbnail, ffprobe/relative inventory checks and a20min execution bound. Cancellation
waits for child close with a1s SIGKILL fallback. Local temp cleanup runs in finally. Worker remains
broker+S3 only. Source concurrency1/retries3 remain. No DAG/GPU/SQL added.

Result prefix `videos/<videoId>/<jobId>/<attemptId>/`; master`master.m3u8`,360/index.m3u8 and
720/index.m3u8, numbered segment00000.ts etc, thumbnail.jpg, `_complete.json`. S3 uses existing
`youtube-v1-transcoded`; edge route `/media/<key>`. Marker schema1 is exported as
`completionMarker`/`bindMarker` in packager: exact video/job/attempt, original key/size/SHA, validated
media result and unique bounded relative inventory (path,size,SHA,contentType). Segments precede
playlists/thumbnail/master, marker last. Confirmed PUTs then marker/head verification precede
confirmed ProcessingSucceeded and job ack. Same job reuses verified marker without output rewrites;
same event identity is stable. Actual re-delivery of job+result preserves bytes/ETags/LastModified
and one publication. Single-worker serialization is deliberate; no multi-worker atomic claim.

Known invalid job confirms ProcessingFailed before failed-copy/ack; malformed unknown envelopes
fail terminally without invented Video state. Strict destination parse plus required AMQP messageId.
Consumer helper repair distinguishes cancel/admission stop from fatal loss, preserves ack during
normal drain, shares idempotent close, and resolves closed only after admitted work. Fatal initiated
inside terminal-hook failure does not await its own task. Active Transcoder work aborts on fatal
transport/publisher loss. Lifecycle stops sweep/relay and drains consumers before closing SQL.

Lifecycle uses existing `applyProcessing` inbox/CAS transactions, immediate/startup and30s
`sweepJobs`, fixed deadlines and dedicated publication relay. Success before started is accepted;
duplicate/stale/unknown/terminal results are recorded safely. Ready metadata+publication outbox
commit atomically; raw processing never goes to indexer. Two intentionally aged FP06b jobs became
QUEUE_DEADLINE failed, and their late success was ignored, with no publication. They were neither
relabelled nor purged. Remote partial/orphan prefixes are retained (including those two outputs):
this is an explicit limit/deviation from the plan's best-effort remote cleanup idea. Local temp
cleanup is unconditional; no S3 deletion, atomic multi-object or atomic ACL guarantee is implied.
The public bucket may serve guessed unfinished keys; ready-only Watch/search gates playable results.

## FP07a interfaces

- Lifecycle's committed `publication-events` topic feeds durable queue **search-indexer** with
  existing strict `VideoPublished` schema1, stable logicalEventId(videoId,'publication','1'). One
  committed publication is retained, no consumer. Use `clients/indexer-consumer.ts`4/retries5 and
  implement `extensions/indexer-writer.ts`; no raw processing or foreign SQL grant.
- Watch **GET /api/watch/videos/:videoId** (suffix`/videos/:videoId`) gives public fields plus
  manifestUrl/thumbnailUrl and string views. It queries only `video_public.ready_videos` and
  `count_public.video_totals`. Count0 is actual empty totals. `state/watch.ts:readyReader` caches
  positive metadata at`ready-video:v1:<uuid>`, TTL3600, single-flight, never null/counts. Valkey
  commands are bounded150ms, startup connect500ms, primary fallback. Totals query is separate on
  every request. Pending404 before publication did not mask ready200 afterward.
- View POST currently returns explicit503 COUNTS_UNAVAILABLE. FP07a uses existing strict ViewPlayed,
  `watch-views` publisher and Counter's `recordView` receipt+increment transaction. Add ready check,
  HTTP confirmed202 and actual browser cumulative-played2s policy; no event emitted now.
- Browser plain TS in`browser/watch.ts` uses native HLS or pinned hls.js, safe details/thumbnail/
  errors, standard mouse controls and public ID form; ready creator rows add Watch video. Replace
  explicit search/count unavailability with the planned FP07a core UI; no new framework is needed.
  Count freshness cannot be hidden in the1h metadata cache.
- Edge sets media MIME from object metadata,60s playlist/long immutable other paths, no negative
  caching and explicit range forwarding/cache bypass. API responses remain no-store.

Invalid media video **c922e399-2095-4253-a109-cf4950d1c76c** reaches INVALID_MEDIA, creator-visible
safe failure, public404 and no publication; its failed delivery remains in upload-jobs.failed for
inspection. S06/search and S07/counts remain unimplemented/unrun. Independent all-service S01 and
restart/integrated S08 are FP07b. S04 passes this bounded real flow. S05 video/PCM/mouse/range evidence
passes, with **no human audible-tone observation**: Chromium was unmuted, Web Audio measured decoded
440.085Hz tone at RMS~.062; no human listening occurred. Keep that frozen audio criterion limitation
explicit; do not call automated observation a human listening result.

See [evidence and failures](evidence/fp06c/README.md) and file provenance. Active time/cost unknown.
