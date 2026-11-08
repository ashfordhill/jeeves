# Custom YouTube v1 completion plan

FP05, 2026-11-07. This is the implementation contract for the next sequential units, based on
the **actual untouched generated baseline**, FP04 commit
**`02ac280da62616e9c7aad7f88457dcb72084cb25`**. FP03b export/UI commit is
**`aedbd606342c5a369142b10cf127fc7130d50671`**. See [baseline](baseline.md),
[frozen S01–S08 and policies](scenarios.md), [G01–G08](mapping-and-gaps.md),
[runtime](local-runtime.md), and the [active repository plan](../../../../docs/plans/reliable-foundations/youtube-field-project-plan.md).

This unit plans only. No app, template, input, saved design or snapshot changes. The baseline's
108 files, generator `0.1.0-experimental.2`, 19 families `0.1.0-experimental.1`, local profile
`1.0.0` and manifest SHA256
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f` stay immutable in that
commit. In later units `app/.jeeves/` stays byte-for-byte historical, including its partial report
and snapshot005 input. It is not a completion certificate for the edited app. Never regenerate
over custom work. A separate completion record will identify the final custom range.

The settled product is local Docker, creator-authenticated upload, success-only automatic public
publication, real two-rendition HLS and thumbnail, a mouse-operated browser interface, public
search and basic eventual counts. PostgreSQL remains the state store. The frozen scenarios and
policies are the comparison denominator. No new product decision or milestone permission is
needed. Working v1 goes to owner/fresh-agent review before v2. No generic workflow/entity DSL,
new capability-contract system, renderer redesign or heavy template certification is required.

## What the actual baseline supplies

| Inspected file/hook (under `app/`) | Reuse and required change |
| --- | --- |
| `src/lib/http.ts`, `src/services/{upload,watch,search}.ts` | Fastify/error/health foundation. `httpShell` **listens before returning**; custom routes cannot be registered afterward. Introduce a configure-before-listen factory/setup callback and explicit startup. This is modified-generated integration. Change health to distinguish initialized application dependencies from mere shell life. |
| `src/lib/worker.ts`, `src/workers/*.ts` | `workerShell` always throws. Replace each entry point with its real handler only in its assigned unit; do not start unfinished consumers. |
| `src/lib/amqp.ts`, `src/clients/*consumer.ts` | Existing prefetch, confirms and manual ack are useful. Callback sees only `Buffer`; retries confirm a copy then ack, eventually moving to `.failed` without a business terminal hook. Add delivery metadata, validated envelopes, bounded nonretryable/terminal hooks and orderly shutdown. Ack after durable effects/confirmed result. Do not claim exactly once. |
| `src/lib/{jwt,objects,postgres,cache,search}.ts`, `src/clients/*.ts` | Reuse JWT verification, internal JWKS/public issuer, S3 public signing host, pool settings, Valkey and OpenSearch clients. These are transport helpers; business ownership, transitions, queries, cache policy and algorithms are custom. Add owned upload/lifecycle/publication clients. |
| `src/extensions/*.ts` | All seven throw. Implement `upload-multipart`, encoder, packager, thumbnailer, `indexer-writer`, `search-query`, `counter-sum` in the assigned feature units; do not report stub/dependency presence as behavior. |
| `infra/postgres/init.sh` | Currently grants readers default SELECT on every future public table. Revoke that policy **before creating private tables**. Add migrations, separate runtime writer logins and explicit ready/count read views. |
| `infra/broker/completion-events.json`, `scripts/broker-init.mjs` | Currently fans raw completion to handler and indexer independently. Replace it with processing events → lifecycle handler; add committed publication events → indexer. On existing runtimes explicitly unbind the old indexer queue; merely asserting new bindings leaves the defect. |
| `scripts/{setup,bootstrap,search-init}.mjs`, `compose.yaml` | Setup/bootstrap/search creation are deliberately single-use and refuse existing state. Add documented first-run versus normal-start paths, versioned migrations and repeatable assertions without rotating secrets, resetting volumes or rerunning single-use bootstrap. |
| `package.json`, `tsconfig.json`, `Dockerfile`, `public/index.html`, `infra/edge/nginx.conf` | Current build compiles NodeNext `src` to `dist`; browser is a notice and hls.js is only installed. Add a separate small browser TypeScript build and serve built assets from an edge image. Preserve existing exact pins; no framework/bundler dependency is needed. |

FP03a's 14-container/provider probes and FP04's independent frozen installs/builds establish
useful foundations. Business routes are 501, workers throw and all S01–S08 remain incomplete at
this checkpoint. Known gaps below are custom integration work, not retrospectively broken
promises of an experimental partial template. If an emitted helper itself must be repaired,
record that repair separately from implementing its named extension.

## Authority, drawing and permissions

Use **one logical Video owner** for the existing `upload` API and `completion-handler` lifecycle
worker. They share authoritative lifecycle data through explicit role grants. Keep their
canonical IDs/processes; rename their display responsibilities to Upload & status API and Video
lifecycle worker. The Transcoder remains a separate Media worker with **no SQL credential**.
Watch, Discovery (Search API + indexer), Counts and Identity remain distinct owners. A result
service with a new independent authority would not fix G01 and is unnecessary.

The first implementation unit must intentionally upgrade the retained **v1 project copy** from
schema2 to schema3 using existing preview/ownership facilities. Preserve all legacy source,
canonical IDs, local settings, history and original owner project. Declare these owner/role and
resource rows; same-owner membership grants nothing by itself:

| Resource | Authority / source intent | Exact role access and runtime boundary |
| --- | --- | --- |
| `metadata-db` | Video / source | `upload` read-write, `completion-handler` read-write. `watch` read with `published-read`, implemented as the ready-only SQL view below. No Transcoder, Search API or indexer SQL access. |
| `originals` | Video / source | Upload read-write; existing `transcoder-read`/`encoder-originals` read remains, with explicit cross-owner `published-read` contract meaning private job-scoped input access, **not anonymous access**. Garage key remains bucket-scoped; worker enforces job key. |
| `transcoded` | Media / source | Transcoder read-write for immutable output/marker checks. The external local edge reads its public website endpoint; do not invent an API role for the external-system tile. |
| `metadata-cache` | Watch / projection of `metadata-db` | Watch read-write only, holding ready public metadata. Custom freshness/failure policy is below. |
| `view-counts` | Counts / source | View counter read-write; Watch published-read of public totals only. |
| `search-index` | Discovery / projection of `metadata-db` | Indexer read-write, Search API read. Population is committed publication events, not a foreign metadata-table grant. |

Owners are IDs `video`, `media`, `watch-owner`, `discovery`, `counts`, `identity-owner`; existing
application IDs are their roles (`api`/`worker` as appropriate). Retain resource legacy owner
metadata as labeled legacy data; explicit v3 declarations govern new intent. Add matching
dependency requests for every declared store relationship. Cross-owner reads/projections will
still have precise unresolved executable-contract findings: this finite v1 plan/code supplies
their application policy, **not a new studio contract or verified template**. Queue authority is
not supported by v3 store authority rows; retain its existing channel ownership metadata and
record the runtime channel policy separately.

FP06a must apply and snapshot the following changes before handoff:

1. Add `upload-state`: Upload → metadata, read-write, plus an attached data-access module
   `upload-state-writer` (pool10, primary, statement timeout2000ms). Explicitly change metadata
   authority from legacy completion-only to Video's two named roles. Do not silently mount an
   owner password into Upload.
2. Rename existing `completion-events` to **Processing events** (keep canonical element ID;
   runtime exchange becomes `processing-events`). It carries started/succeeded/failed results
   from Transcoder to lifecycle only. Correct Transcoder/handler/module/connection prose.
3. Add **Publication events** (`publication-events`, local topic), published by lifecycle after
   commit and consumed by Search indexer. Replace `completions-indexer` with
   `publications-indexer`; add `handler-publication` and publisher module `handler-publications`.
   Keep one indexer and one lifecycle handler. Correct module links and queue descriptions.
4. Change `upload-jobs.outbox` from disabled to enabled; new `handler-publications.outbox` is
   enabled. Transcoder result publisher and Watch view publisher remain explicitly disabled
   (neither owns a SQL outbox). These are deliberate source corrections, not historical input
   rewrites. Update current app config/connection files alongside source when implemented.
5. Make local batch choices explicit: Watch view publisher `batchSize=1`, `lingerMs=0`;
   counter consumer `batchSize=1`; indexer consumer `batchSize=1`. Preserve concurrency/retry
   bounds. Correct batched-count prose to immediate asynchronous transactional increments and
   Transcoder's speculative task-DAG prose to the fixed CPU ladder. This meets the frozen
   two-second flush target without an unnecessary buffered aggregator.

Use numbered snapshots after007, recording each intentional saved edit (including schema
upgrade) with actual source/blueprint/native exported PNG, renderer/tree identity, view metadata
and 1280×800 studio screenshot. Label target-state pictures as implementation incomplete. Never
rewrite001–007, inputs or `app/.jeeves`. Add snapshot links to diagram index/work log. The source
change makes frozen-profile re-export ineligible by design; do not extend the generator profile
to match the custom app. Normal custom-v1 work proceeds from the committed app and its own build/
start commands; the original generation remains reproducible through the CLI from committed005
inputs and pinned generator/templates. Its exported `.jeeves` data remains historical. Do not
add cloning or generic lifecycle features merely to keep a generation button enabled. No
duplicate of the original owner YouTube is to be overwritten.

The collapsed Video path may form a projected cycle through queue/work/result. Use existing
expanded-role fallback and capture actual overview plus useful mouse focus/inspector evidence.
Keep the honest readability limitation if the whole view is small or expanded; do not split
authority or promise a renderer redesign to avoid it. Any later implementation deviation needing
a source correction gets its own native snapshot in that unit before handoff.

## Durable data and lifecycle

Keep the existing logical PostgreSQL databases `metadata`, `counts`, `identity`. Use versioned,
transactional SQL migrations with an applied-version table and repeatable runner. Initial setup
and upgrades both run them; `docker-entrypoint-initdb.d` alone cannot upgrade existing volumes.
Revoke PUBLIC database/schema access as appropriate and all reader default table grants, also
revoking any existing blanket SELECT. New private schemas get no PUBLIC/reader usage.

| Data | Concrete contents/invariants |
| --- | --- |
| `video_private.videos` | `video_id` UUID PK, creator OIDC `sub`, channel snapshot, title(1–200 trimmed chars), description(0–5000), expected original size/SHA256, state, `state_version`, stable `job_id`/`attempt_id` nullable until complete, timestamps/deadlines, safe failure code/message, ready media metadata nullable until success. Separate `publication_version=1` on first ready; no edit/delete/unpublish product. |
| `video_private.uploads` | UUID `upload_id` PK, unique `video_id`, private deterministic original key, provider multipart ID nullable during initiation, phase (`initiating`, `active`, `completing`, `closed`), file name/size/type/lastModified/SHA256, `expires_at`, stored complete response/original ETag and cleanup-needed flag. Creator derives from joined video; never trust a request creator or object key. |
| `video_private.inbox` | Processing `event_id` unique, video/job/attempt IDs and handled outcome. Insert receipt and transition/publication intent in one transaction. Invalid/stale messages have a recorded safe outcome; do not let old results overwrite terminal state. |
| `video_private.outbox` | UUID event ID PK, destination allowlist (`upload-jobs`, `publication-events`), versioned JSON payload, created/sent times, attempts/next-attempt. One unique job intent per job and one publication per video version. Relay locks a bounded batch with `FOR UPDATE SKIP LOCKED`, confirms then marks sent; duplicate delivery remains possible. |
| `video_public.ready_videos` | Owner-created view selecting **only `state='ready'`** and videoId/title/description/channel/duration/manifest/thumbnail/publishedAt/version. Exclude creator subject, original key, expected hash, provider upload ID, errors, outbox and inbox. Explicit SELECT for `metadata_reader` on this view only. It is the deliberate foreign read contract. |
| `count_private.receipts`, `count_private.totals` | Receipt PK `(video_id,event_id)` and totals PK `video_id` with bigint count. Insert receipt (`ON CONFLICT DO NOTHING`) and add1 only for a newly inserted receipt in one transaction. Public totals view exposes only video ID/count; `counts_reader` cannot read receipt IDs. |

Use migration credentials (`metadata_owner`, `counts_owner`) only in a setup/migration container,
not in service mounts. Give Upload its new `metadata_upload` login/secret and lifecycle its
`metadata_lifecycle` login/secret. Explicit SQL grants: both Video logins SELECT/INSERT/UPDATE
videos, uploads and outbox plus sequence usage if needed; lifecycle alone writes inbox. Upload
does not need inbox or delete authority. Both may clear cleanup flags/update owned rows, using
the transition queries below. Lifecycle sweeper can mark overdue jobs; Upload handles original
multipart cleanup because it has the key. Runtime roles cannot create schema/tables, grant
access or own these objects. Grants enable trusted application code within the one authority;
the API's allowed state transitions are enforced by conditional transactional queries, not a
claim of per-state SQL row security. Count worker uses a separate runtime `counts_writer`
credential with receipt/totals DML; Counts owner remains migration-only. Keep existing Watch
read-only secrets. These extra runtime secrets require changes to setup/init/Compose, never
committed values. Transcoder still mounts broker + its S3 key only.

Transitions lock/compare the current row (`state`, job/attempt IDs, version); affected-row count
decides the outcome. Database clock is authoritative for expiry. Public state vocabulary stays:

| Transition | Who / condition / durable effect |
| --- | --- |
| absent → `uploading` | Upload authenticated creator; allocate video/upload IDs, immutable file/creator snapshot and 24h expiry before provider initiation. Persist provider ID afterward. Initiation failure records a visible `failed` code and cleanup intent. |
| `uploading` → `pending` | Upload only after authoritative ListParts/complete/Head confirms expected object size and binding. Allocate one job UUID and one logical attempt UUID, save queue deadline and upload-jobs outbox in same transaction. Repeating complete returns the same IDs/result. |
| `pending` → `processing` | Lifecycle consumes matching ProcessingStarted; persist earliest start and fixed processing deadline. Repeated starts never extend it. |
| `pending`/`processing` → `ready` | Lifecycle consumes matching ProcessingSucceeded with complete validated result. Commit public columns, increment state version, set publication version1 and publication outbox atomically. Success may arrive before started; accept it without requiring queue ordering. |
| `pending`/`processing` → `failed` | Matching terminal failure or deadline sweep. Preserve finite safe reason. Late successes are ignored and logged; no publication follows. |
| `uploading` → `aborted`/`expired` | Creator abort or Upload sweep at24h. Close phase and persist cleanup intent before aborting provider multipart. Retrying cleanup is safe. No complete/sign after either state. |

`ready`, `failed`, `aborted`, `expired` are terminal for v1. Invalid media becomes failed;
re-upload is a new video/job, not an edit/retry UI. Abort applies only to unfinished uploading,
not pending/processing. Creator status retains terminal rows through the demo; no deletion UI.
Set initial pending deadline10min and processing deadline30min; FFmpeg subprocess bound20min.
Lifecycle checks overdue jobs every30s, independently of broker consumption. An unavailable
process/DB cannot update status; restart resumes sweeps. This is finite application recovery,
not a systematic crash/fault guarantee. No retries may refresh these deadlines indefinitely.

Reconcile S3/SQL boundaries explicitly. Before provider complete set phase `completing`; its
deterministic key and object metadata bind video/upload/size. A repeat complete or bounded Upload
sweep handles provider NoSuchUpload by Head of that exact key: matching completed object permits
the one pending/outbox transaction; absence/mismatch is a visible safe error. ListParts is the
authority for part ETags and sizes, not the browser's completion list. A crashed start can leave
a provider multipart without a saved ID: periodically list provider multipart uploads and abort
only the app's recognized original-key namespace older than24h, bounded per pass, alongside
known cleanup records. No bucket-wide blind delete. Preserve completed originals for this demo;
do not add retention/deletion product scope. Partial output cleanup is best effort in the worker;
orphan output retention is an explicit bounded-demo limitation, not a cleanup/ACL guarantee.

## HTTP, browser auth and multipart contracts

All browser API paths below are through loopback edge4400. nginx already strips the service
prefix; register the suffix in each service before listen. JSON request limit64KiB is enough for
control operations (file bytes go directly to S3). Responses use JSON `{error,message}` with
finite safe codes, no tokens/signed URLs/provider secrets in logs. UUIDs/part numbers/text/page
bounds are validated. 400 malformed,401 missing/invalid/expired bearer,403 valid noncreator,
404 unknown or foreign upload/video,409 state/file conflict,410 expired/aborted operation,
413 transport size,422 unsupported media/input,503 unavailable dependency/deadline. GET status
returns terminal state and safe error rather than hanging. Do not expose stack traces publicly.

| Route | Contract |
| --- | --- |
| `GET /api/upload/me` | Verified creator JWT → subject and channel display identity. Use verified `preferred_username` (bounded) or subject fallback for channel; do not accept channel ownership from browser fields. |
| `POST /api/upload/uploads` | Creator; `{fileName,size,contentType,lastModified,sha256,title,description}`; enforce 1..256MiB, MP4 declared type/extension and text bounds. Create owned upload/video;201 returns uploadId/videoId, state, 5MiB part size/count and expiry. No public metadata. |
| `GET /api/upload/uploads` | Creator's recent active/terminal records only, bounded limit50; supplies resume/status list after refresh. |
| `GET /api/upload/uploads/:uploadId` | Same creator only; lifecycle/expiry/file fingerprint, videoId/jobId/attemptId when allocated, safe error and authoritative listed `{partNumber,size,etag}` for active multipart. Paginate provider ListParts internally. |
| `POST /api/upload/uploads/:uploadId/parts/:partNumber` | Same active unexpired upload; validate number against expected part count; return URL+expiresAt for **this exact** private key/provider ID/part. URLs15min, renewable; never sign caller-supplied key/host/bucket. |
| `POST /api/upload/uploads/:uploadId/complete` | Same creator. Re-list parts; require consecutive numbers, exact5MiB nonfinal sizes, exact expected final size and total before complete. Bound small request body; ignore untrusted browser ETag assertions. Reconcile as above;202 pending with stable IDs or same terminal/status response on retry. |
| `POST /api/upload/uploads/:uploadId/abort` | Same creator; persist aborted/cleanup intent and abort S3. Idempotent terminal abort; already queued/ready409. Expired410. |
| `GET /api/watch/videos/:videoId` | Anonymous; ready-only view/cache plus **fresh separate** count read;200 public detail or404 for pending/failed/unknown. No negative cache or internal state leakage. |
| `POST /api/watch/videos/:videoId/views` | Anonymous; ready-only check then `{eventId}` UUID; confirmed ViewPlayed publication →202 `{eventId,accepted:true}`. No broker confirm →503; browser retries same ID. No increment in this HTTP process. |
| `GET /api/search/videos?q=...&page=...` | Anonymous; q1..200 chars, page1..100, size20; return OpenSearch ready-public matches with title/description/channel/thumbnail/watch link and basic page metadata. No SQL grant or in-memory substitute. |

Creator control endpoints always invoke the existing JWT helper with signature/RS256, required
exp/sub, public issuer `http://127.0.0.1:4401/realms/youtube-v1`, API audience and creator role.
Map verifier failures to401; role failures403. Internally fetched JWKS remains
`http://identity:8080/.../certs`; never weaken issuer/audience for host differences. API binds to
0.0.0.0 **inside Compose only**, with no host port; all published ports bind127.0.0.1.

Browser uses public client `youtube-v1-web`, authorization code + PKCE S256, cryptographic state
and nonce, exact callback origin4400 and one-time state/verifier validation. Exchange at public
issuer, retain tokens only in sessionStorage for this local demo, validate the returned nonce
and get trusted identity from `/me` before enabling creator controls. Clear callback query and
one-time data. Expiry leads to a visible sign-in-again control; refresh/sign-in may be needed
for resumed upload. Sign-out clears local auth and uses Keycloak's end-session URL with ID token
hint and allowlisted post-logout redirect; configure that realm/client attribute before first
setup. No browser client secret. No token/capability storage in evidence. Setup may provision a
second local creator (`other-creator`, separately generated local password) for ownership smoke;
this is a demo fixture, not an account-management feature.

The minimal interface has creator identity/sign-in/sign-out, file/title/description controls,
per-part progress, recent uploads, explicit resume/reselect and abort, polled status/failure,
search input/results, watch details/thumbnail/player/count. All controls work by mouse. Store
only upload ID/file fingerprint locally for resume. Reselect computes whole-file SHA256 and
requires equality with saved fingerprint (including size; file metadata assists UX); do not
resume by filename alone. Authoritative ListParts skips only acknowledged matching parts;
unfinished/missing parts are PUT again. At most two concurrent PUTs; network failures leave a
visible resumable state. Expired signed URLs are renewed through owner-authenticated endpoints.

Use internal `http://objects:3900` for control/Get/Head and existing public
`http://127.0.0.1:4402` for part signing. Never rewrite signed Host. Retain exact-origin CORS,
PUT allowed headers and exposed ETag. Garage grants are bucket-level, so creator checks precede
every control/sign request; signed URLs remain temporary bearer capabilities. Abort/expiry stops
new control operations and requests provider abort; it does not promise instantaneous revocation
of an already issued/in-flight capability. Anonymous originals remain403. Browser SHA is an
expected fingerprint, **not proof of stored bytes**: S02 evidence independently streams the
completed private object and compares actual whole-file SHA256/size with the fixture; multipart
ETag is not that checksum. Worker rechecks original size/hash before processing.

## Messages, idempotence and publication

Use version1 envelopes validated with existing Zod: `{schemaVersion:1,type,eventId,occurredAt,
videoId,...}` with UUID identities, bounded fields and destination-specific type allowlists.
No arbitrary object path from HTTP reaches jobs. Broker messageId equals eventId. IDs are stable
across HTTP repeats, outbox retransmission and broker retry. Processing `attemptId` is one
**logical attempt for this job**; broker retry/delivery count is separate, not a new application
attempt. A random executionId may label temporary dirs/logs, never authoritative state.

| Destination / consumer | Payload and side-effect/ack boundary |
| --- | --- |
| `upload-jobs` queue → Transcoder | `VideoProcessingRequested`, stable jobId/attemptId, private original key, expected size/hash. User text/channel remains authoritative SQL data and need not be copied into worker output. Upload outbox commits with pending; relay confirms then records sent. |
| `processing-events` fanout → `completion-handler` only | `ProcessingStarted`, `ProcessingSucceeded`, `ProcessingFailed`, each with stable distinct eventId derived from job/attempt/type. Success includes result prefix/manifest/thumbnail/duration/rendition details and marker identity; failure includes safe finite code. Lifecycle transaction inserts inbox + matching state transition + publication outbox. Ack only after commit. Out-of-order started after terminal is harmless. |
| `publication-events` fanout → `search-indexer` only | `VideoPublished`, eventId, videoId, publicationVersion1, `visibility:'public'`, state ready, committed title/description/channel/duration/thumbnail/manifest/publishedAt. Payload comes from the committed owner transaction. Indexer upserts document `_id=videoId` using monotonic external publication version (`external_gte` or equivalent checked version); same/old event cannot overwrite newer content. Ack after index success; no dependency on sibling processing consumer. |
| `view-events` fanout → `view-counter` | `ViewPlayed`, eventId supplied by page session, videoId, acceptedAt and public version. Watch verifies ready before confirmed publish. Worker deduplicates receipt+increment transaction, then ack. No metadata DB permission is needed by Counts. |

Metadata outbox relays run in existing Upload (job destination) and lifecycle (publication
destination), not additional services/tiles. Poll within1s, bounded batches, confirmed publish,
backoff capped5s, safe operational errors. Transaction commit and event delivery are separate;
there is no exactly-once claim. The DB+S3 completion gap is reconciled as above. Result messages
have no SQL outbox: worker confirms result before ack; a complete output marker allows a retried
job to reproduce the same success instead of encode again. A persistent broker outage may
delay search beyond the smoke bound and must be reported rather than hidden by a fake list.

Extend `consume` so handler receives messageId, headers and delivery count, and can signal a
nonretryable invalid-media error. Preserve configured concurrency/retry bounds: Transcoder1/3,
lifecycle4/10, indexer4/5, counter8/5 (retry limit is copies after initial delivery). Transient
errors copy with incremented count, confirm then ack; terminal/nonretryable processing failure
must confirm `ProcessingFailed` **before** confirming the `.failed` copy and acking the job.
If that hook/publish fails, do not acknowledge; close/exit cleanly for redelivery. Dead worker
or lost-result cases also reach the fixed lifecycle deadline. Keep malformed/poison messages
in bounded failed queues with safe diagnostics; do not create public state for unknown IDs.
Other consumer terminal queues are visible limitations, not an automated redrive feature.

At Transcoder concurrency1, duplicate jobs may arrive sequentially: check deterministic complete
marker for this job/attempt, validate its original fingerprint and result inventory, and emit
same success. Partial prefixes are not success; redo before marker. This is bounded duplicate
protection in the one-worker local profile, not cross-worker locks or a crash/concurrency campaign.
Lifecycle CAS and index versions remain necessary even with that profile.

## Real encoding, delivery, cache, search and counts

Generate the fixture outside Git from the **frozen scenario recipe**, preferably with the actual
selected field FFmpeg image; retain version/configuration, hash/size and ffprobe output. Reuse
those bytes through subsequent units/v2. Require actual size>10MiB and at least three real PUTs
with5MiB nonfinal parts. Invalid fixture is small text named `invalid.mp4`. Media/temp/log storage
under ignored `.runtime/` is separate from Git evidence; redact signed URLs and credentials.

Transcoder streams original to a bounded temp file, hashes it, checks size, then probes with
timeout. Enforce H.264 video/AAC audio, landscape720p–1080p and1–600s; reject missing/nonconforming
streams visibly. Invoke `execFile`/spawn argument arrays, never a shell with filenames. CPU encode
each rendition using libx264, `veryfast`, yuv420p, rates about1M/3M, AAC128k, two-channel audio,
4s MPEG-TS HLS, independent aligned keyframes (e.g. forced every4s, scene cuts disabled), VOD
playlists with ENDLIST, scale+pad to640×360 and1280×720 preserving aspect ratio without upscaling
source content. Use actual encoding, not stream copy. Thumbnail is one JPEG at original video
dimensions from a valid early frame. Exact tested argv/version/log becomes evidence in FP06c;
the bounded design choices here are not an unexecuted compatibility claim.

Stage all files locally, validate ffprobe output/playlist references, then upload under immutable
`videos/<videoId>/<jobId>/<attemptId>/`: segments first, rendition playlists, thumbnail, master
last, then `_complete.json` inventory/fingerprint marker. Relative playlist references may only
name files under this prefix. Set MPEG-TS/M3U8/JPEG/JSON content types. Confirm writes/marker
checks before success publication; worker cleans its temp directory on all exits. Do not claim
that writing a marker is an atomic multi-object transaction.

The public Garage website/edge can serve guessed partial object keys before SQL ready. Frozen
S05 requires **no playable public watch result** for pending/failed IDs; ready-only Watch/search
enforces that. It does not require a new private-encoded-bucket callback/authorization cycle or
atomic ACL publication. Do not expose unfinished URLs in UI/API. Document this exact object-level
limit at review. Failed jobs never commit ready/search, even if some orphan objects remain.

nginx routes `/media/` through the existing website Host and no original route. Use immutable
paths, one-minute playlist and long segment/thumbnail caching, correct MIME/range behavior and
no negative media caching that masks later uploads. API responses have `Cache-Control:no-store`.
Watch caches **only positive ready metadata**, versioned key `ready-video:v1:<videoId>`, TTL3600s,
in-process single-flight fill. No negative cache; DB primary on miss. Valkey outage falls back
to primary with safe logging and bounded calls. Counts are fetched separately every details
request, never inside the one-hour value, so S07 cannot be hidden by stale cached totals. No
replica, cache-performance or global-CDN claim.

Use `browser/` custom TypeScript plus `tsconfig.browser.json`; compile to ignored built public
assets separately from Node sources. `scripts/build-browser.mjs` copies the **installed pinned**
`hls.js/dist/hls.min.js` into built assets; load it as a browser script with a small typed adapter.
Keep `tsc`/plain modules/DOM APIs; no new UI/bundler packages. `pnpm build` must build server and
browser; Docker app stage includes sources/assets, new edge stage uses the existing exact nginx
pin and copies built public files. Remove reliance on a checkout-host public bind mount for
delivery. Prefer native HLS when supported, otherwise hls.js; standard video controls provide
play/pause/seek. Browser codec capability reporting is only a preflight, not playback evidence.

Search index mapping is explicit text fields title/description/channel, keyword videoId/state/
visibility, numeric version/duration and public URLs/timestamps. Consumer stores only committed
ready-public projection. Query uses real OpenSearch `multi_match` plus state/visibility filters,
stable tie-break sort and bounded paging. Refresh within1s/default small refresh policy, eventual
visibility measured within60s after ready commit. V1 has no update/delete/unpublish; a full
rebuild/reconciliation product is deferred. Startup may assert/create the existing expected
mapping without resetting an existing index; incompatible mapping must fail with a migration
message. Search cannot invent pending hits. Opening each returned hit must resolve ready Watch.

For S07 generate one random eventId per mounted watch page/video session. Accumulate **actual
played elapsed time** from playing/timeupdate (or video-frame callbacks), tracking wall-clock
deltas only while progressing and not paused/seeking/stalled/ended. Reset the sample on seeks,
pause, stall, rate changes and page visibility gaps; a seek jump itself contributes0. Use short
bounded deltas (e.g. ≤500ms) so long suspended callbacks cannot count. Threshold2 cumulative
seconds at normal playback triggers one logical event, retained across HTTP retries in that
page session. Metadata/search/segment loads, play click, seek and pauses trigger none. Navigating
to a new watch page session creates a new ID. This is a demo policy, not fraud-resistant telemetry.
Watch202 means broker-confirmed acceptance; duplicate accepts are allowed, counter receipt is
the deduplication boundary. Immediate asynchronous transactional per-event increments satisfy
the ≤2s flush target; details must show accepted increments within10s. No unique viewers,
bot/billing/watch-time analytics or exact global counts claim.

Use source request timeout/admission values (Upload5000ms/500, Watch1000ms/2000, Search1000ms/1000)
as explicit service control budgets. Add request admission counters and dependency/subprocess
timeouts; budget expiry returns finite503 and releases admission only after work settles.
Do not claim Fastify's receive-timeout setting cancels handlers. Writes use idempotent transitions
so a late completion after response timeout can be reconciled by status/retry. SQL pool/statement
timeouts remain the existing explicit values; no batching/linger implementation is claimed from
old config. If a real smoke shows a chosen budget needs change, append the failed evidence and
adopt an explicit source/config/snapshot correction, never silently disable the budget.

## Independent runtime and credential boundaries

Keep Node24.21.0/pnpm12.16.1 and all current exact package/image/FFmpeg OS pins. No workspace
imports, Jeeves API, live model, cloud account or paid runtime call. Downloading fixed images/
packages on first build still uses the network. Use a unique Compose project (owner final stack
`jeeves-youtube-v1`) and loopback4400 UI/edge,4401 identity,4402 public S3. Infrastructure, SQL,
cache, broker and search stay unexposed on the Compose network. Preserve unrelated Compose
projects and owner4300/4310 watchers/projects. Check4400–4402 before starting, do not kill others.

| Process | Runtime secret/data boundary |
| --- | --- |
| Upload | broker password, upload S3 key (originals read/write, owner grant revoked after CORS setup), new metadata_upload. No encoded-bucket/Counts/identity-admin secret. JWT verifies public keys. |
| Lifecycle | broker password, new metadata_lifecycle. No S3/Counts/identity admin credentials. Validate bounded result paths under job prefix from trusted worker messages; no arbitrary public URL. |
| Transcoder | broker password, transcoder S3 key (originals read; transcoded read/write). No SQL credentials. |
| Watch | broker, metadata_reader view-only, counts_reader totals-view-only, cache password. No state writer/S3 key. |
| Search / indexer | Search client on isolated network; indexer also broker. No SQL/S3 key. OpenSearch security is disabled in this local binding: these are intended client roles, not enforced per-user search ACLs. |
| Counter | broker + counts_writer. No metadata writer/reader. |
| Identity | Existing derived identity.env (identity_owner DB password and local bootstrap admin) plus generated realm import; provider-only mounts. Its state stays in the identity database, separate from Video/Counts. |
| Edge / browser | No resource password/key in edge assets. Browser holds only its session-scoped OIDC tokens and temporary part capabilities; public media uses the website endpoint. |
| Migration/setup | PG owner/admin, Garage owner/admin/setup access, identity bootstrap, generated local passwords. Setup-only mounts; private0700 runtime parent with UID-readable specific mount files. No secret values in source/images/evidence. |

Existing broker uses shared `youtube`/broker_password, not separate AMQP service ACLs. Isolation
and deliberate clients are the bounded local policy; no mTLS/workload-identity or malicious
container isolation claim. Keep exact25 unsupported paths in historical reports; HTTPS/service
identity and Java-language override remain limits. No replica/partition/autoscale/HA/global edge,
arbitrary codecs, cloud provider parity, throughput or disaster-recovery claim.

First-run entry point must: refuse mismatched runtime/volume state; create credentials only when
absent; build; start healthy providers; bootstrap Garage only for a genuinely new runtime; run
versioned SQL and idempotent broker/search assertions; then start **implemented** app services
and edge. Record completed initialization steps locally so a partially failed bootstrap is not
blindly replayed. Refuse ambiguous partial state with a precise recovery message rather than
rotating/deleting keys/data. Normal start/stop is a separate documented command path preserving
the same runtime secrets/Compose name/volumes. `docker compose down`/up (no `-v`) must retain ready
videos, identities and counts; no rerun of single-use secret/bootstrap generation. Readiness
must mean handlers/dependencies initialized, not a stale shell-ready file. Pending timers resume
after startup. Final working stack stays available to owner at4400–4402, with local instructions
for reading its creator password; only disposable scratch resources are removed.

## Sequential assigned units and acceptance

Each row is a fresh sequential sole-writer unit on primary main, one local commit after checks
and appended handoff. The owner already authorized continued work through working v1. Do not
stop for a product/milestone prompt. If a row proves too large, coordinator splits it at a
concrete documented interface and retains this order; never hand off a claimed working feature
with a hidden stub. No branch/worktree/stash/subdelegation/push.

### FP06a — source corrections and owned-state foundation

Depends on FP05. Apply the authority/event/batch/prose corrections and required native snapshots
above **before handoff**. New `app/infra/postgres/migrations/`, `scripts/migrate.mjs`,
`src/contracts/`, `src/state/` and `src/lib/outbox.ts` contain finite v1 data/message/transition
code. Modify `infra/postgres/init.sh`, setup/Compose secret mounts, relevant current config and
broker JSON/init; add separate runtime logins, private schemas/views, inbox/outbox and SQL runner.
Repair HTTP setup-before-listen and AMQP terminal metadata hooks without enabling unfinished
business consumers. Do not copy code into generator templates.

Acceptance: own frozen install/build; repeat migration without changes; SQL probes show Upload
and lifecycle permitted writes, Watch ready-view-only/denied private tables, Counts reader denied
receipts, and Transcoder no SQL mount. Real SQL transaction demonstrates pending+job intent and
ready+publication intent atomicity; rollback leaves neither side. Repeat event/outbox delivery
preserves one transition/publication identity. Broker bindings show indexer absent from raw
processing fanout. Retain finite targeted pure transition/envelope checks where they protect
state/identity semantics; keep root unit tests network-free. No S01–S08 completion claim yet.
Source/PNG/UI audit and expanded-role readability limitation are part of this unit's evidence.
SQL/broker probes use unique synthetic IDs and roll back or remove their own records, outbox/
inbox entries and queued messages before handoff. Never leave synthetic ready/search/publication
data in the later real-media demo; clean only owned probe resources, not unrelated queues/data.
Handoff names exact state/client interfaces for FP06b; schema/views/migrations must exist, not
just a prose design.

### FP06b — creator, real multipart and minimal uploader

Depends on FP06a. Implement `extensions/upload-multipart.ts`, upload routes/auth/status/cleanup,
job outbox relay and browser sign-in/uploader/resume/abort UI. Add plain-browser build/edge image,
safe first-run versus restart commands and local test creator. Reuse JWT/S3 primitives; repair
setup/bootstrap/current app config only where needed and record modified-generated cost. Do not
start Transcoder, lifecycle processing consumer, indexer or counter while they still throw;
leave queued jobs durable for FP06c. Document exact staged startup service list. Lifecycle sweep
is not started prematurely to fail queued upload-only acceptance jobs.

Acceptance: S01 sign-in/identity/sign-out and independent startup of this implemented subset;
S02 real frozen-recipe fixture with≥3 actual PUTs/ETags/ListParts/completed object hash, anonymous
start/sign/complete denial and second-creator denial; S03 interrupt after a nonfinal part, refresh/
reselect/resume same ID sending missing parts only, abort separate upload and completion refusal.
Status is pending with stable video/job/attempt IDs and one queued intent; no public watch/search
result. Verify invalid token/oversize/declared nonconforming file gives visible finite error.
Document this staged S01 evidence separately from final all-services S01 rerun. No S04+ credit.
Preserve fixture bytes/hash locally and hand off known queued jobs/deadlines; use a fresh upload
if the intentional staged delay exceeds10min, rather than weakening the final timeout policy.

### FP06c — actual processing, lifecycle publication and playback

Depends on FP06b. Implement three Transcoder extensions and real worker, lifecycle consumer/
inbox/publication relay/deadline sweep, Watch ready-read/cache and browser HLS player/status.
Implement safe error displays and media edge policy. Search indexer/counter remain stopped until
their handlers exist; publication queue retains events for FP07a. Watch may return count0 from
empty totals. View POST can remain clearly unavailable until FP07a; do not publish to a throwing
counter. Hand off precise result marker/envelope and public views/URLs.

Acceptance: rerun fresh fixture end to end for S04 and S05. Retain pending→processing→ready
status, actual CPU FFmpeg argv/log and ffprobe H.264/AAC640×360/1280×720/durations, HLS object
inventory/master/ENDLIST/thumbnail, actual output-vs-original hashes, marker and committed ready
row/publication outbox. Re-deliver same job/result once to check stable publication/no rewrite.
Invalid-media job reaches visible failed with no public watch. Ready-only cache miss/fill/hit
and separate count query work; pending negative lookup must not mask subsequent ready. Signed-out
mouse play advances≥5s with decoded frames and seek, actual edge playlist/segment/range requests.
Audio evidence must be truthful: human audible-tone observation if performed, otherwise retain
decoded PCM440Hz tone evidence and explicitly record whether the browser was muted. Playwright's
normal mute is not human listening. Do not declare S05 fully satisfied without the frozen audio
criterion's evidence/explicit limitation. No S06/S07 claim yet.

### FP07a — committed search, playback events and final core UI

Depends on FP06c. Implement `extensions/{indexer-writer,search-query,counter-sum}.ts`, search/index
mapping and routes, real indexer/counter workers, Watch event route and browser cumulative-played
event policy/search/results/count refresh. Update source/config only if an actual decision
differs; snapshot any adopted source change. Finish the same minimal core UI; add no clone scope.

Acceptance: S06 fixture title/description/channel queries in actual OpenSearch/UI within60s
after ready commit, hit opens ready Watch, unique pending/invalid-media titles never hit. Repeat
publication event preserves one versioned document. S07 fetch/search causes0; ≥2 cumulative
actual played seconds causes+1 within10s after confirm/202; pause/seek/resume same page causes0
additional; same eventId retry0; new watch page/session+1. Retain accepted IDs and private receipt/
totals evidence with no credential leakage. Ready metadata cache must not delay count visibility.
Check no event on seek jump or suspended callback. This is a bounded duplicate/policy smoke,
not a fraud, load or concurrency campaign. Handoff all handlers implemented, no business501.

### FP07b — independent S01–S08 walkthrough and review pack

Depends on FP07a. Copy final tracked application files (excluding dependencies/dist/runtime) to
a fresh outside-checkout location; own frozen install/build and Docker build/start from its docs
with separate scratch runtime/Compose name. Exercise all frozen S01–S08 by mouse and targeted
observable probes. Fix bounded integration defects in this unit and classify each repair; if
architecture changes, correct source and snapshot before handoff. Do not relabel a failed run.
If the owned in-repo field stack occupies4400–4402, stop it normally while retaining its runtime/
volumes, run the independent scratch copy, remove only that scratch copy's resources, then
restart the owned field stack and verify its retained data. Do not stop another project's ports.

Acceptance: retain one integrated result table with actual commands/versions/fixture hash,
evidence and limitations per scenario. Include visible invalid token/oversize/nonconforming/
invalid-media finite failures, private-original403, normal stop/start preserving ready watch/
search/counts and same secrets/volumes. No Jeeves runtime dependency or cloud call. Reconcile
saved design vs implemented code, inspect latest native PNG/studio view and document gaps that
v1 does not model. Leave final in-repo owner stack healthy at4400–4402 with exact start/stop,
creator-password location and current ready demo URLs; remove only scratch resources created by
these units. Add owner-facing concise walkthrough and fresh-agent review checklist. FP08 owner
review chooses subsequent Jeeves improvements/v2; this unit must not start v2 automatically.

## Checks, evidence and provenance for every handoff

Run the AGENTS checks sequentially with source steady and no heavy Docker/build/cleanup I/O
overlap: `pnpm check`, `pnpm test:e2e` (or documented Docker fallback),
`pnpm --filter @jeeves/web build`, then actual browser mouse check that studio loads/TinyURL
renders and changed behavior works. Use Node24.21.0 on PATH. Do not weaken the existing5s PGlite
test timeout if resource pressure causes a failure; retain it and rerun appropriately after
diagnosis. Preserve owner projects/watchers and scripted E2E DB cleanup. Independent app has
its own `pnpm install --frozen-lockfile` and `pnpm build`; root commands do not verify it.
For FP05 only the unchanged baseline's own build and read-only studio/TinyURL/local-v1 review
apply; no new provider/startup campaign or docs-only tests are needed.

For code units run only meaningful targeted checks and their assigned real-container flow;
expand after new defects, not as an artificial template certification gate. Full integrated
S01–S08 is FP07b. Keep generated/helper/provider checks distinct from application evidence.
Audio/decoding must be observed as described, not inferred from package availability or console
play success. Screenshots/log summaries are evidence; do not commit media, credentials, tokens,
signed URLs, dependencies, database files, caches or build output. Native diagram snapshots are
required only for intentional source/presentation changes; no duplicate snapshot for pan/zoom.

Append each unit's work log and handoff: base/containing prior commit, changed contracts/files,
diagram snapshot links, commands/outcomes, failed attempts/repairs, remaining gaps/next unit,
resource ownership and runtime availability. Track model/environment/prior-code access and
scope changes. Unknown active time, turns/tokens/cost and savings stay unknown. Do not invent
percentages or infer effort savings from generated line counts. For each scenario report the
baseline foundation, actual working evidence and custom/repair/reuse needed; eight scenarios
are not eight equal engineering weights.

Final provenance file uses the immutable manifest's107 hashed payloads plus baseline manifest
to classify: unchanged generated bytes, modified generated files (separate integration/defect
repair notes), new custom files, reused custom code with source commit/path, external pinned
dependencies. New business extension implementations are planned custom work even though
their containing shell was generated. Keep generator/template/diagram/studio investment
separate from field completion. No repaired custom app is retroactively emitted by the old
templates. Ledger H01–H09 stay hypotheses until observed code/flow evidence supports an adoption;
record applicability/exclusions and another plausible use before proposing a shared abstraction.

G01–G08 all remain open at FP05. Planned ownership/state addresses G01; committed publication
G02; stable identities/inbox/outbox/receipts G03; real browser/OIDC G04; event policy/counts G05;
multipart/ownership/resume G06; encode/playback G07. G08's deliberate local/security/capacity
limits remain disclosed at final review. Closure needs the assigned working evidence, not this
plan. Heavy provider matrices, crash campaigns, soak/performance and template certification
remain deferred until interfaces stabilize. No additional product choices are outstanding.
