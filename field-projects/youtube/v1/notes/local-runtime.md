# Selected local adapters

Selected 2026-11-07 for the experimental v1 export. This is a bounded configuration decision,
**not a tested Compose runtime**. No cloud account or paid service is required. Downloading
images/packages during setup still needs internet access. The exported app must build/run outside
the Jeeves checkout and must not import workspace packages or call the studio API.

Exact `tag@sha256` references, linux/amd64 child digests, availability timestamps, npm integrity
strings and source URLs are frozen in [runtime-pins.json](../inputs/runtime-pins.json).
[Registry metadata](evidence/image-availability.json.gz) was inspected without pulling/running
containers. The FFmpeg deb was downloaded and its SHA256 checked, not installed. No Docker
runtime, generation or broad certification ran in FP01.

| Role / canonical IDs | Exact selection | Upstream release date / reason |
| --- | --- | --- |
| Application/worker base | `node:24.21.0-bookworm-slim` | Reuse installed Jeeves Node 24.21.0; registry image records 2026-10-06 creation |
| Metadata and counts: `metadata-db`, `view-counts` | `postgres:17.11-alpine3.23` | 2026-08-13; same major as Jeeves' `postgres:17-alpine`, now explicitly pinned |
| Redis-compatible cache: `metadata-cache` | `valkey/valkey:8.1.10-alpine` | 2026-08-31; standalone basic Redis protocol adapter, no cluster claim |
| Jobs/topics: `upload-queue`, `completion-events`, `view-events` | `rabbitmq:4.4.0-management-alpine` | 2026-10-20; work-queue plus durable fanout subscriptions in one bounded local broker |
| Search: `search-index` | `opensearchproject/opensearch:3.9.0` | 2026-09-29; honors drawn OpenSearch choice |
| OIDC: `identity` | `quay.io/keycloak/keycloak:26.8.1` | 2026-10-13; local creator realm/client; vendor-language override explicitly reported |
| Objects: `originals`, `transcoded` | `dxflrs/garage:v2.4.1` | 2026-09-08; self-hosted S3 subset with multipart/presigning; tested integration still required |
| Local video edge: `video-cdn` | `nginx:1.28.3-alpine` | 2026-03-24; local reverse proxy/cache; automation-pitch used nginx 1.27-alpine without an exact patch |
| Encoding/probe: `transcoder` | Debian `ffmpeg=7:5.1.9-0+deb12u1` | 2026-05-13; Bookworm package for selected Node base, CPU H.264/AAC/HLS capabilities must be checked in the actual build |

Dates/published metadata were checked against primary sources: [PostgreSQL release notes](https://www.postgresql.org/docs/release/17.11/),
[Valkey release](https://github.com/valkey-io/valkey/releases/tag/8.1.10),
[RabbitMQ releases](https://www.rabbitmq.com/release-information),
[OpenSearch release](https://github.com/opensearch-project/OpenSearch/releases/tag/3.9.0),
[Keycloak release](https://github.com/keycloak/keycloak/releases/tag/26.8.1),
[Garage releases](https://garagehq.deuxfleurs.fr/_releases.html),
[nginx changes](https://nginx.org/en/CHANGES-1.28) and
[Debian FFmpeg](https://packages.debian.org/bookworm/ffmpeg).
New package selections precede 2026-10-24, satisfying the two-week rule at selection. Registry
image rebuild timestamps can be newer than the upstream release; their exact bytes are pinned,
not described as two weeks old. Do not silently float those tags.

Jeeves/automation-pitch were inspected first. Reuse exact Jeeves versions for `fastify 5.12.7`,
`pg 8.23.1`, `tsx 4.23.15`, `typescript 7.0.2`, `zod 4.5.4`, `@types/node 24.19.2`,
`@types/pg 8.23.1`, Node and `pnpm 12.16.1`. No appropriate pinned object/OIDC/AMQP/search
runtime already existed there. New client choices are `@aws-sdk/client-s3 3.1156.0`,
`@aws-sdk/s3-request-presigner 3.1156.0`, `amqplib 2.2.0`, `jose 6.2.13`, `redis 6.3.0`,
`@opensearch-project/opensearch 3.9.0` and `hls.js 1.7.3`. Primary npm registry publication dates,
tarballs and integrity are retained in [npm metadata](evidence/npm-availability.json.gz).
These choices do not attest API interoperability, TypeScript compatibility or Redis-client
compatibility with Valkey; the first independent build/smoke must establish that.

Use a small static browser interface with TypeScript and standard controls, plus hls.js for
MSE HLS playback; native HLS can be used when available. No React/UI framework is required for
the minimal interface. [hls.js's own README](https://github.com/video-dev/hls.js) documents its
browser playback path. Actual decoding/playback, including codec availability in the browser
used for the walkthrough, must be observed, not inferred from a playlist or ffprobe output.

The native FFmpeg package itself is pinned and hashed. Its transitive OS closure is **not frozen
in FP01**. FP03 must select a fixed Debian apt snapshot and record resolved OS package versions
alongside the field lockfile before committing a standalone build. That remaining build detail
is not a template/runtime reliability certificate or a claim of bit-identical container builds.
If the selected package is unavailable or fails the build, append an explicit pin decision;
do not quietly install a different FFmpeg. No downloaded deb/video is committed here.

## Local wiring choices and limits

Use one PostgreSQL container, separate logical databases/users for metadata, counts and Keycloak,
and least necessary owner-write/reader grants. The diagram still has two distinct stores with
their original writers. Application tables and durable pending/failure-state ownership are G01
custom work; do not let upload or transcoder silently acquire metadata writes. No read replicas,
sharding or autoscaling are provisioned. One container per service/worker honors local min/max 1;
retained worker concurrency is an explicit future implementation requirement, not observed load
capacity. Valkey is standalone with a finite memory bound/LRU and one-hour cache intent; exact
cache behavior and resource sizing remain untested.

Use one RabbitMQ node. `upload-queue` becomes a durable work queue; each completion subscriber
gets its own durable queue behind a fanout exchange; view-counter gets a durable queue behind
the view exchange. Use persistent messages, publisher confirms and manual ack after successful
side effects. Retry limits must remain explicit per source component and terminal failures
visible; no infinite immediate requeue loop. Queue message expiry is not equivalent to the
original retained topic history, so the copy removes topic partitions/retention rather than
claiming Kafka-like replay. A single node provides no broker redundancy. A confirm does not
make application effects exactly once: the official [reliability guide](https://www.rabbitmq.com/docs/reliability)
and [confirm/ack guide](https://www.rabbitmq.com/docs/confirms) distinguish delivery and side
effects. Idempotence and disabled-outbox publication gaps remain G02/G03/G05.

Use local Keycloak with a realm `youtube-v1`, public browser client `youtube-v1-web`, API audience
`youtube-v1-api`, creator role `creator` and authorization code + PKCE S256. Provision one local
creator at setup using environment-provided credentials, with no committed secret. Validate
issuer, audience, signature, expiry and creator role in upload control operations. A viewer can
watch/search public videos anonymously. Local HTTP development mode, loopback ports and a
PostgreSQL identity database are deliberate demo choices. Realm import/setup is not backup
certification. Primary [Docker](https://www.keycloak.org/getting-started/getting-started-docker),
[container](https://www.keycloak.org/server/containers) and
[import](https://www.keycloak.org/server/importExport) guides support this setup direction.

Proposed browser origins are web/edge `http://127.0.0.1:4400`, OIDC
`http://127.0.0.1:4401/realms/youtube-v1`, S3 `http://127.0.0.1:4402`. These avoid Jeeves ports.
Use the internal identity JWKS URL while validating the public issuer; never weaken issuer
checks to make container hostname differences work. The exact public/internal OIDC behavior
remains an integration smoke requirement. Infrastructure stays on the Compose network; any
host-published port, including optional broker management, binds to 127.0.0.1.

Garage uses one node/replication factor 1 with persistent local volumes. Its official
[quick start](https://garagehq.deuxfleurs.fr/documentation/quick-start/) describes this as a
nonredundant setup. Use the existing bucket access model: `youtube-v1-originals` private with
upload write and transcoder read; `youtube-v1-transcoded` public for successful encoded media,
with transcoder write. Garage uses per-key/bucket grants, not S3 policy/ACL parity. The official
[compatibility table](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/)
lists SigV4, path-style, presigning, multipart and CORS endpoints, with missing APIs and its own
permission limitations. That current table is not version-specific proof for 2.4.1.

Separate the internal S3 control endpoint `http://objects:3900` from the public presigning
endpoint. Do not rewrite a signed Host. Browser part PUTs need exact-origin CORS, allowed headers
and exposed ETag; no wildcard credential workaround. Enable Garage website serving only for
the transcoded bucket using its global alias; originals get no website exposure. nginx can
route `/media/` to the website endpoint with the required internal Host
`youtube-v1-transcoded.web.garage.localhost`. This avoids host DNS edits. Garage's
[website guide](https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/) documents
the alias/Host requirement and static serving. Content types, byte ranges, CORS, Host routing
and real HLS delivery must still be proved in the field smoke.

nginx provides a local proxy/cache only; [proxy/cache documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
supports that bounded role. It is not a globally distributed CDN. Full-size thumbnails replace
on-request resizing, explicitly disabled in the copy. Use immutable completed object paths,
appropriate short playlist/long segment cache policy and no public original route; no cache
performance result is claimed. Public metadata/search ordering and handling partial outputs
remain custom-phase requirements. No production TLS, mTLS/workload identity, HA, disaster
recovery, adaptive global delivery, tenant isolation or throughput target is implemented here.

OpenSearch runs single-node with persistent data, one index shard and zero replica shards for
this local demonstration. Do not expose its port publicly. Its official
[Docker guide](https://docs.opensearch.org/latest/install-and-configure/install-opensearch/docker/)
documents the host map-count/memory requirements and local configurations; the actual exported
setup must report a prerequisite instead of silently changing host settings. The current host
has `vm.max_map_count=1048576`; no sysctl was changed. Schema/query/publication correctness remains
custom work. Full production security and a search cluster are outside this local binding.

## FP03a observed build and startup, 2026-11-07

The deferred FFmpeg OS closure above is now fixed in real template source using Debian and
Debian-security snapshots `20261024T000000Z`. Exact frozen FFmpeg version/deb SHA and all 288
resolved OS package versions are checked during Docker build; no frozen input was edited.
The standalone exact package/lockfile installs and builds outside Jeeves. See
[actual-output evidence](evidence/fp03a/README.md) for build logs, actual versions and per-file hashes.

All 14 local containers started healthy from fresh setup. Bounded probes observed browser signed
part PUT/CORS/readable ETag using the public Host, internal control and transcoder-original reads,
private-original403/public-edge200/range206, PG default-reader grants, Valkey basics, broker confirm/
manual-ack bounded failure, an empty OpenSearch 1-shard/0-replica index and real Keycloak PKCE/token/
JWT integration. Garage CORS setup temporarily grants owner and revokes it before runtime;
scoped credential files are readable to container UIDs behind a private0700 host runtime parent.

These are foundation/helper observations, not complete S01–S08 scenarios. HTTP business routes
return501, workers fail into bounded failed queues, and no real media encoding/application
lifecycle/publication/search/count/UI policy is implemented. G01–G08 and strict readiness remain
unchanged. Independent fanout publication ordering is not repaired, and upload/transcoder receive
no metadata/counts grants. Later field handoffs require independent build and applicable checks;
heavy provider/fault/performance/template certification remains deferred.

## FP05 next runtime changes

The [custom implementation plan](implementation-plan.md) specifies the next source/SQL/credential
corrections and FP06a–FP07b order against committed FP04. In particular private upload/lifecycle
tables must not inherit the generated default reader SELECT; runtime Video/Counts writer logins
are separated from migration owners, and search consumes committed publication instead of raw
processing events. First-run initialization and normal stop/start get separate documented paths
that preserve secrets/volumes. These are planned changes, not another runtime campaign or an
amendment to the historical probe results above. Baseline app/runtime bytes remain untouched
through FP05; final working stack is to remain available at loopback4400–4402 for owner review.
