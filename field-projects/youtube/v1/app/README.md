# YouTube local v1 — creator upload subset

This independent app began as generated baseline `02ac280da62616e9c7aad7f88457dcb72084cb25`.
FP06a added owned state/contracts; FP06b implements creator sign-in and real resumable multipart
uploads. `.jeeves/` stays the immutable historical partial report/input. Current custom intent is
in `config/implementation-source.json` and `config/ownership.json`. Do not regenerate over it.

**This is a staged upload-only runtime.** Uploads remain pending in a durable queue. Processing,
Watch, search and view counting are not implemented yet. Their services/consumers must stay
stopped. No complete all-services S01 or S04–S08 claim is made here.

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
The hls.js asset is prepared for a later player and proves no playback.

First-run creates private `.runtime/`, generated credentials and two local creator accounts;
builds app/edge; starts only PostgreSQL, RabbitMQ, Garage, Keycloak and OpenSearch; bootstraps
Garage once; runs versioned SQL migrations and idempotent broker/search settings assertions;
then starts **only upload and edge**. There are seven long-running containers. No Valkey or
processing/lifecycle/index/count consumer starts. Do not run a broad application profile.

Open **http://127.0.0.1:4400/**. Click Sign in; username `creator`. Read its password locally from
`.runtime/secrets/creator_password` (do not paste it into logs or Git). `other-creator` and
`.runtime/secrets/other_creator_password` are a separate ownership-test account. Sign out ends the
Keycloak session as well as clearing local tokens. OIDC is public-client code + PKCE S256 with
one-use state/nonce and exact callback/logout redirect `http://127.0.0.1:4400/`. Browser session
storage holds tokens for this local demo; expiry exposes Sign in again. The API verifies signature,
public issuer4401, audience, exp/sub and creator role via internal JWKS `identity:8080`.

Choose a supported MP4, title and description, then Upload video. Transport accepts1 byte–256MiB;
media support is H.264/AAC, landscape720p–1080p,1–600seconds (actual stream verification comes with
processing). Bytes PUT directly to private originals through temporary15-minute signed URLs on
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
assertions and starts the same implemented subset. It never reruns secret generation or Garage
bootstrap. `COMPOSE_PROJECT_NAME=jeeves-youtube-v1 docker compose down` (without `-v`) also retains data;
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
| Video lifecycle (stopped) | `metadata_lifecycle`, private Video DML + inbox; publication publisher |
| Watch (stopped) | `metadata_reader`: ready view only; `counts_reader`: totals only; cache + view publisher |
| Count worker (stopped) | `counts_writer`: private receipts/totals only |
| Transcoder (stopped) | Broker + S3, no SQL |
| Search/indexer (stopped) | Search network client, indexer broker, no SQL/S3 |

All Upload auth/JWKS and request dependency work is inside awaited handlers and the5000ms/500
admission budget. Dependency attempts are bounded. A response deadline does not cancel admitted
work; it retains its slot until settled, and shutdown drains it. Check status before retrying a
write. Completion re-lists authoritative parts, persists completing, completes/Heads the bound
object, then commits pending + stable video/job/attempt IDs + upload-jobs outbox atomically.
Repeat complete returns the saved result. A completing-provider gap reconciles through the exact
key and metadata; browser ETags/keys/provider IDs are never accepted as authority. Head verifies
binding/size; it does **not** prove SHA256. The worker will rehash actual bytes. Evidence independently
streams completed originals and hashes them; multipart ETag is not a content SHA256.

Only Upload's dedicated upload-jobs confirmed outbox relay runs. It handles fatal publisher loss
by draining/closing HTTP, sweep, relay, pools and clients, then exiting. Confirm/commit gaps may
duplicate the same event ID. A30s Upload loop handles expiry/cleanup/interrupted initialization
and completion; a bounded paginated namespace sweep aborts recognized original multiparts older
than24h. Completed originals are retained. No lifecycle job-deadline sweep starts in this staged
runtime. Pending jobs still carry their fixed10min deadline: later processing must use fresh
uploads after staged delays, never extend the policy.

The retained fixture is ignored at `.runtime/media/youtube-v1-fixture.mp4`; its recipe, exact
FFmpeg version/configuration, ffprobe output, hash and IDs are in `../notes/evidence/fp06b/`.
Keep these actual bytes for later units/v2. No media or passwords are committed.

Local limits remain: no TLS/mTLS, HA, replicas, global CDN, fraud-resistant counts, arbitrary
codecs, cloud parity, production capacity or exactly-once promise. Garage keys are bucket-scoped,
not per-object creator ACLs; broker uses shared local credentials. OpenSearch security is disabled
only on the isolated network. Remaining business paths are not made functional by dependency
presence, and this custom app is not retroactively generated by the frozen templates.
