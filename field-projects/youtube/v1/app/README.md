# YouTube local v1 — upload, search, playback and counts

This independent app began as generated baseline `02ac280da62616e9c7aad7f88457dcb72084cb25`.
FP06a added owned state/contracts; FP06b implements creator sign-in and real resumable multipart
uploads; FP06c adds CPU encoding, committed publication and public HLS playback. FP07a adds committed-publication search and basic actual-playback counts. `.jeeves/` stays the immutable historical partial report/input. Current custom intent is
in `config/implementation-source.json` and `config/ownership.json`. Do not regenerate over it.

All core handlers run, and FP07b independently installed/built/started a tracked-source copy,
exercised integrated S01–S08 and normal restart, then removed only its named scratch runtime.
See the [results and replay evidence](../notes/evidence/fp07b/README.md) and
[owner/fresh-agent review pack](../notes/review-pack.md). S05 remains partial: decoded video and
unmuted 440 Hz PCM were measured; no human listening was performed in these checks. Next is FP08 review, not automatic v2.

Requirements: Linux amd64 Docker Compose, Node24.21.0, pnpm12.16.1, free loopback ports4400–4402,
and OpenSearch's documented `vm.max_map_count` prerequisite (at least262144). Setup does not
change host sysctls. Existing exact package/image/FFmpeg pins remain; initial downloads need the
network, but no cloud account, paid service or Jeeves runtime is needed.

From this directory (also works after copying app sources outside the repository):

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check:foundation
pnpm first-run
```

The app owns its compiler and dependencies. `build` compiles Node sources and separately compiles
plain browser TypeScript, copies public CSS/HTML and installed pinned hls.js to `dist-public/`.
No browser framework/bundler or parent workspace tooling is used. Docker builds these assets
itself; edge uses the exact pinned nginx image and contains them without a host public mount.
The browser prefers native HLS and otherwise uses this pinned hls.js asset with standard video
play/pause/seek controls.

First-run creates private `.runtime/`, generated credentials and two local creator accounts;
builds app/edge; starts PostgreSQL, RabbitMQ, Garage, Keycloak, OpenSearch and Valkey; bootstraps
Garage once; runs versioned SQL migrations and idempotent broker/search settings assertions;
then starts **upload, completion-handler, transcoder, watch, search, search-indexer, view-counter
and edge**, with Valkey for the positive ready cache. There are fourteen long-running containers
and six persistent volumes. Use the documented commands for this complete implemented subset.

Open **http://127.0.0.1:4400/**. Click Sign in; username `creator`. Read its password locally from
`.runtime/secrets/creator_password` (do not paste it into logs or Git). `other-creator` and
`.runtime/secrets/other_creator_password` are a separate ownership-test account. Sign out ends the
Keycloak session as well as clearing local tokens. OIDC is public-client code + PKCE S256 with
one-use state/nonce and exact callback/logout redirect `http://127.0.0.1:4400/`. Browser session
storage holds tokens for this local demo; expiry exposes Sign in again. The API verifies signature,
public issuer4401, audience, exp/sub and creator role via internal JWKS `identity:8080`.

Choose a supported MP4, title and description, then Upload video. Transport accepts1 byte–256MiB;
media support is H.264/AAC, landscape720p–1080p,1–600seconds (the worker verifies actual streams before publication). Bytes PUT directly to private originals through temporary15-minute signed URLs on
4402, using5MiB nonfinal parts. API control calls remain on4400; internal object control uses
`objects:3900`. Exact-origin CORS exposes ETag. Original files are not public. Access logging is
disabled at edge so callback codes do not enter logs.

Pause upload or refresh to interrupt. Select an unfinished recent upload, reselect the **same
file**, then Resume selected upload. Whole-file SHA256, size/type/name/lastModified must match;
authoritative ListParts skips only matching acknowledged parts. At most one PUT is in flight.
Resume renews part URLs. Different files give a visible conflict, and different creators cannot
manage each other's uploads. Abort upload closes an unfinished upload; it cannot later complete.
New controls stop after abort/24h expiry, but already issued/in-flight signed capabilities cannot
be instantly revoked. Terminal records remain visible; there is no edit/delete/retry product.

Normal restart uses the same credentials, Compose name and volumes:

```sh
pnpm stop
pnpm start
```

`start` rebuilds current code, asserts healthy providers, runs repeatable migrations/broker/search
assertions and starts the same implemented services. It never reruns secret generation or Garage
bootstrap. `COMPOSE_PROJECT_NAME=jeeves-youtube-v1 docker compose --profile '*' down` (without `-v`) also retains data;
follow it with `pnpm start` (substitute the recorded name for an alternate project).
Default project is **jeeves-youtube-v1**. A deliberate alternate `COMPOSE_PROJECT_NAME` must be
chosen before first-run and used consistently afterward. Do not claim another project's ports.

`.runtime/local-setup.json` records version/project, credential hashes, completed steps and
persistent volume names/creation identities/Compose labels. Missing/changed credentials or
recorded volumes refuse before `up`. New initialization refuses preexisting project volumes or
an untracked `.runtime`. Failed repeatable steps can resume with `pnpm first-run`. An interrupted
Garage bootstrap **refuses replay**, with a precise inspection/recovery message; preserve state,
compare layout/buckets/keys/CORS/owner revocation with `scripts/bootstrap.mjs`, and complete that
step manually before updating its local record. Never rotate keys or delete state to bypass the
guard. Back up secrets, setup record and provider volumes together. This is bounded local startup
protection, not disaster recovery certification.

Private versioned migrations run transactionally under advisory locks and verify checksums.
Owners are migration/init-only; runtime passwords never rotate. For an older generated runtime,
`node scripts/setup.mjs --add-runtime-roles` deliberately creates only absent scoped role files;
it is not a way to attach the new tracked first-run path to unknown volumes.

| Process | SQL/resource boundary |
| --- | --- |
| Upload | `metadata_upload`: private videos/uploads/outbox DML, no inbox/delete/DDL; originals bucket key + broker; no owner/Counts/identity-admin mount |
| Video lifecycle | `metadata_lifecycle`, private Video DML + inbox; publication publisher |
| Watch | `metadata_reader`: ready view only; `counts_reader`: totals only; cache + view publisher |
| Count worker | `counts_writer`: private receipts/totals only |
| Transcoder | Broker + S3, no SQL |
| Search/indexer | Search network client, indexer broker, no SQL/S3 |

All Upload auth/JWKS and request dependency work is inside awaited handlers and the5000ms/500
admission budget. Dependency attempts are bounded. A response deadline does not cancel admitted
work; it retains its slot until settled, and shutdown drains it. Check status before retrying a
write. Completion re-lists authoritative parts, persists completing, completes/Heads the bound
object, then commits pending + stable video/job/attempt IDs + upload-jobs outbox atomically.
Repeat complete returns the saved result. A completing-provider gap reconciles through the exact
key and metadata; browser ETags/keys/provider IDs are never accepted as authority. Head verifies
binding/size; it does **not** prove SHA256. The worker rehashes actual bytes. Evidence independently
streams completed originals and hashes them; multipart ETag is not a content SHA256.

Upload's dedicated upload-jobs and lifecycle's publication-events confirmed outbox relays run. It handles fatal publisher loss
by draining/closing HTTP, sweep, relay, pools and clients, then exiting. Confirm/commit gaps may
duplicate the same event ID. A30s Upload loop handles expiry/cleanup/interrupted initialization
and completion; a bounded paginated namespace sweep aborts recognized original multiparts older
than24h. Completed originals are retained. Lifecycle checks fixed queue10min/processing30min deadlines at startup and every30s. Matching
started/results and ready+publication intent use private inbox/CAS transactions. A result may
precede started; duplicates/stale/late/terminal results do not republish. Deadlines never extend.
The two uploads staged by FP06b have elapsed queue deadlines and visibly failed; re-upload
creates a new video/job. Their late encoded outputs do not make them public.

After upload, select View status or Refresh to see pending, processing, ready or a finite safe
failure. Ready rows offer **Watch video**. Public visitors can paste a ready Video ID into
**Open video**, or open `http://127.0.0.1:4400/?watch=<videoId>`. Details, thumbnail and standard
HLS controls work signed out. Pending/failed IDs give404 and no playable Watch result. **Find a public video** searches title, description or channel and opens Watch by mouse.
`GET /api/search/videos?q=<1–200 characters>&page=<1–100>` returns at most20 hits, sorted by
relevance, published time and video ID. Invalid query/unknown routes return finite400/404.
Only committed ready/public publications enter OpenSearch; the indexer has no metadata SQL grant
and never consumes raw processing results. Its strict public mapping is added to the historical
empty index without reset; incompatible mappings/settings refuse with the exact field and an
explicit-migration instruction. Repeat publication upserts the same video ID at external version1.

A view counts after **2 cumulative actual played seconds** at normal speed on the mounted Watch
page. Paused, waiting, seeking, hidden/background, non-normal-rate or suspended callback samples
receive no credit. Short250ms samples require advancing media and bounded wall deltas≤500ms;
seek jumps and activity changes reset the sample while preserving accumulated qualifying time.
One random event ID belongs to that page/video session, including retries. Pause/resume/seek,
details polling, searches and media GETs never create another event. Opening the video again or
reloading creates a new session and may count once after qualifying playback.

Watch validates a strict `{eventId}` UUID body and ready public metadata, stamps server timestamps/
version, then confirms a persistent matching-ID broker event before202 `{eventId,accepted:true,
acceptedAt,publicationVersion}`. Counter commits receipt `(videoId,eventId)` and increment together,
then acknowledges; duplicates add0. It cannot connect to metadata. Browser retries an uncertain
response three times with the same ID and offers a mouse retry with that ID after a finite error.
Counts refresh separately every2seconds without remounting the player or resetting its session;
target commit is immediate/≤2s and bounded smoke visibility≤10s after accepted confirmation.
This is basic anonymous engagement counting, with no fraud/unique-viewer guarantee.

Transcoder has broker+S3 only, no SQL mount. It checks1–256MiB original bytes and SHA256, MP4/
H.264/AAC/landscape720p–1080p/1–600s, then CPU encodes640×360 and1280×720 H.264/yuv420p/AAC with
approximately4s VOD HLS segments and a source-size JPEG. Safe argv subprocesses share a20min
execution bound; cancellation force-terminates and awaits them before local temp cleanup.
Segments precede rendition playlists/thumbnail/master, then a job/fingerprint/inventory-bound
`_complete.json`. A verified marker lets the single worker re-emit stable success without
rewriting outputs. Known invalid media confirms a failed event before failed-copy/ack; malformed
unknown jobs do not invent state. Normal/fatal shutdown drains admitted work before dependencies
close; fatal worker transport loss aborts active downloads/subprocesses.

Watch reads only the ready public view; it caches positive public metadata for3600s with
single-flight fill, bounded cache calls and primary fallback. It never caches misses or totals.
Every details request reads Counts separately. Edge provides correct media MIME/range handling,
one-minute playlists and long-lived immutable segment/thumbnail caching, without caching404s.
The public encoded bucket can serve guessed partial keys before ready; Watch/search publication
is the application boundary. **Remote partial/orphan prefixes are retained in this bounded v1**
(including output for the two expired staged jobs); only local execution directories are always
removed. No S3 cleanup or atomic multi-object/ACL publication is claimed.

The retained fixture is ignored at `.runtime/media/youtube-v1-fixture.mp4`; its recipe, exact
FFmpeg version/configuration, ffprobe output, hash and IDs are in `../notes/evidence/fp06b/`.
Keep these actual bytes for later units/v2. No media or passwords are committed.

Local limits remain: no TLS/mTLS, HA, replicas, global CDN, fraud-resistant counts, arbitrary
codecs, cloud parity, production capacity or exactly-once promise. Garage keys are bucket-scoped,
not per-object creator ACLs; broker uses shared local credentials. OpenSearch security is disabled
only on the isolated network. Dependency presence alone does not establish business behavior, and
this custom app is not retroactively generated by the frozen templates.

## Retained owner demonstration after FP07b

Search `marigoldquartz`, `saffroncobalt` or `creator`, then click Watch video for
`fdd51924-5a94-4e45-be02-a77b3c82d1a7` (FP07a public fixture). Its retained count before and after
FP07b restore is3; owner playback may legitimately increase it. The earlier
`fdbbc43f-78a0-4be2-9910-a383de70acf6` remains ready/searchable with0views. Invalid/expired staged
jobs remain. Normal start/stop preserves all six volumes, credential identities and the exact
ignored fixture. Do not regenerate or reset this runtime to reproduce a clean count.

The FP07b scratch project `jeeves-fp07b-review` is removed. Its independent evidence IDs are not
owner URLs. Its cleanup used `docker compose -p jeeves-fp07b-review --profile '*' down --volumes` only for
that named scratch project: Compose's default-profile down left application-profile containers behind.
Never apply that destructive scratch cleanup to the retained owner project. Use `pnpm stop`
for normal owner stops. Public encoded partial keys and remote orphan retention, no human audio
observation and no direct OS background-tab proof remain review limitations.
