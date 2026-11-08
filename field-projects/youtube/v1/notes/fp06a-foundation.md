# FP06a owned-state handoff

Custom integration after FP05 `aed1d1d29c2e41f3173d3d11fd771e8519e0a838`; untouched generated
baseline `02ac280da62616e9c7aad7f88457dcb72084cb25`. No template/generator/input/`.jeeves` rewrite.
Current retained copy is schema3 revision6, project `293b4a2d-e25b-4a5b-83da-b27de7876f02`.
Original owner YouTube revision2, TinyURL revision53 and Marketplace revision1 remain unchanged.
The three new source revisions and native diagrams are linked in [diagram index](../diagrams/index.md).
These are target designs with implementation incomplete. Frozen005 generation stays reproducible;
the changed saved source intentionally refuses the frozen export profile.

`app/src/contracts/v1.ts` supplies strict, Zod-validated version1 envelopes for processing requests, processing
started/succeeded/failed, committed VideoPublished and ViewPlayed. All messages are bounded64KiB,
UUID IDs, finite text/numeric fields and destination-specific types. Broker messageId must equal
eventId. `logicalEventId(jobId,attemptId,type)` fixes job/processing IDs; publication uses
`logicalEventId(videoId,'publication','1')`. Broker delivery counts never become logical attempts.
`originalKey`/`resultPrefix` bind private originals and immutable outputs to canonical IDs.
Results validate two360p/720p renditions, master/thumbnail/marker and the exact job prefix.
Fields are relative object paths; later edge/Watch code supplies the public media route.

`transaction(pool, tx => ...)` owns BEGIN/COMMIT/ROLLBACK. Every state mutation below takes its
transaction client; never call it in autocommit mode. `VideoRow`, `UploadRow`, `CreatorVideoRow`,
`RecentUploadRow`, `CleanupUploadRow`, `CompleteResponse`, `CompleteResult` and
`BeginCompleteResult` are exported for FP06b. SQL bigint file metadata is returned as strings.

| Function in `src/state/video.ts` | Contract for the next unit |
| --- | --- |
| `reserveUpload(tx, {sub,channel}, NewUpload)` | Validate immutable creator/file snapshot; allocate video/upload/key and DB-clock24h expiry before provider initiation. Creator comes from verified JWT. |
| `ownedUpload(tx, uploadId, sub, lock?)`, `creatorVideo`, `recentUploads` | Owner-scoped private lookup; foreign IDs return null. Recent list bounded50. Never return entire private row to browser. |
| `saveProviderUpload(tx, uploadId, sub, providerId)` | Conditional initiating→active; expiry persists terminal cleanup. Provider initiation can leave an unsaved orphan; FP06b must implement the bounded namespace sweep. |
| `beginComplete(tx, uploadId, sub)` | Lock video/upload, reject terminal/expired state, persist completing before external complete. Return duplicate stored response before expiry validation. |
| `completeUpload(tx, uploadId, sub, {key,size,etag})` | Call only after authoritative ListParts/Complete/Head verification. Checks exact saved key/size, then pending+job+attempt+complete response+job outbox atomically. Repeats return stored IDs. It does not perform S3 or claim ETag is SHA256. |
| `closeUpload(tx, uploadId, sub, 'aborted'|'expired')` | Uploading only; DB expiry wins over abort; close phase+cleanup intent before provider abort. |
| `failUpload(tx, uploadId, sub, code)` | Initiation/object mismatch gives finite visible failure and cleanup intent. |
| `cleanupUploads(tx)`, `clearCleanup(tx, uploadId)` | Bounded due/cleanup records; clear only after successful safe provider cleanup. Unknown provider orphan sweep is still FP06b. |
| `applyProcessing(tx, event)` | Receipt+matching CAS transition+publication intent atomically. Ready can precede started. Duplicate/stale/terminal/unknown outcomes explicit; DB deadline checked even before sweeper. Started never extends an existing processing deadline. |
| `sweepJobs(tx)` | Lock≤50 overdue pending/processing rows; finite10min queue/30min processing failures. Schedule30s in FP06c, not FP06b. |

`src/state/counts.ts:recordView(tx, event)` inserts a private `(videoId,eventId)` receipt and adds1
only when inserted, in the same transaction. It does not validate ready against metadata; Watch
must verify ready before acceptance. Counts has no metadata permission. No worker is started yet.

`src/lib/outbox.ts` exports `relayBatch(pool,destination,publisher,limit=10)` and
`startRelay(...) -> async stop`. Destination is exactly `upload-jobs` or `publication-events`;
pass its dedicated confirmed publisher (`clients/upload-jobs` or `clients/handler-publications`).
The caller must preserve that destination/publisher pairing. Batches≤25 lock due rows using
SKIP LOCKED; publish confirms before sent_at; failure increments attempts and backs off≤5s;
loop polls1s. A confirm/commit gap may retransmit the same eventId. No exactly-once claim.
FP06b starts only the Upload job relay; lifecycle/publication relay waits for FP06c.

`createHttpService(id,budgets,configure,initialize) -> {app,start,close}` configures routes and
initializes dependencies before listen. Health503 until initialized. Body64KiB; safe errors,
no-store; admission/deadline cover awaited handler work. Auth/JWKS must be inside that handler,
not async preHandler hooks. Budget expiry does not cancel work or free its slot until settled.
Return/await all work. The unfinished `httpShell` refuses startup.

`consume(queue,concurrency,retryLimit,handle,{onTerminal?})` passes `Delivery` with messageId,
headers, deliveryCount and redelivered. `NonRetryable('INVALID_MEDIA'|'MALFORMED_MESSAGE')` bypasses
retries. The terminal hook must confirm ProcessingFailed before the failed-copy confirm/ack;
malformed unknown jobs get no invented public state. Hook/confirm failure closes without ack.
The returned `{connection,channel,close,closed}` supports cancel/drain/shutdown and
`closed: Promise<{fatal:boolean}>`. The service must await fatal closure, stop its other loops,
drain admitted work, close pools/publishers and exit. Transport closure alone cannot stop timers.
All confirmations have5s timeout; synchronous send failures clear their timer. Existing bounds
remain Transcoder1/3, lifecycle4/10, indexer4/5, counter8/5 (copies after initial delivery).
Unfinished `workerShell` refuses before opening any consumer/readiness file.

Migrations and operator commands are in [app README](../app/README.md). `setup --add-runtime-roles`
is a deliberate upgrade path for an existing generated runtime and creates only absent scoped
secret files. It never rotates existing values. Migrations check runtime passwords, revoke legacy
reader defaults/blanket table reads and apply checksummed versions transactionally; changed
applied bytes refuse. App runtime code mounts no owners. New application services remain opt-in.
No final field runtime, secret directory, pending jobs, synthetic publication or ready media is
handed off. FP06b initializes the final `jeeves-youtube-v1` runtime and implements its first-run
step tracking/restart/browser/upload subset. All S01–S08 remain incomplete at this checkpoint.
