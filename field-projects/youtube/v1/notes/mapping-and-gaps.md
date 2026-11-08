# Proposed finite mapping and explicit gaps

The machine-readable [bindings](../inputs/local-bindings.json) enumerate all **18 elements,
20 components and 18 connections** from snapshot 005, using canonical IDs, definition versions,
settings and exact source paths. These are proposed template families for FP02/FP03. There is
currently **no implemented template or functional coverage**. Names, descriptions, `thirdParty`
suggestions in the blueprint and custom module prose select no implementation.

| Canonical IDs | Proposed partial output | Behavior still missing |
| --- | --- | --- |
| `watch`, `search` | TypeScript HTTP shells, declared dependency clients/config | Detail/search routes, public-only rules, cache-aside, playback event publication |
| `upload` | TypeScript signed-multipart shell, local S3/OIDC configuration | Creator authorization, upload ownership, part/resume/complete/abort flow and job publication |
| `transcoder` | TypeScript worker shell, FFmpeg installation/configuration | Actual encode, HLS packaging, thumbnails, completion/failure handling and idempotence |
| `completion-handler`, `search-indexer`, `view-counter` | Worker shells, explicit consume bindings and database/index clients | Metadata publication, committed search projection, event receipts and aggregation |
| `metadata-db`, `view-counts` | Separate PostgreSQL logical databases/users on one instance | Application schema/migrations/queries and transactional policies |
| `metadata-cache` | Standalone Valkey resource/config | Cache keys, result shape, fill/single-flight/expiry behavior |
| `search-index` | Single-node OpenSearch resource | Mapping/query/projection and public visibility enforcement |
| `identity` | Local Keycloak OIDC resource/config | Actual realm/client/role setup and JWT verification integration |
| `originals`, `transcoded` | Separate Garage buckets and credentials | Real SigV4 multipart/CORS, publication paths and browser-visible delivery |
| `upload-queue` | Durable RabbitMQ work queue | Confirm/ack/reconnect/retry integration and terminal failure handling |
| `completion-events`, `view-events` | Fanout exchanges with durable subscriber queues | Payloads, delivery/idempotence policy and publication ordering |
| `video-cdn` | Local nginx proxy/cache, labeled Local video edge | Actual media routing/cache headers; no global distribution or dynamic resizing |

Component mappings preserve each exact `settings` object and outgoing component links. A
`data-access`, `auth-guard`, `cache-reader` or publisher/consumer kind can select proposed
client/config scaffolding; it does not supply missing API/data/message contracts. All seven
`custom` modules remain named extension work (`counter-sum`, `search-query`, `upload-multipart`,
`transcoder-encoder`, `transcoder-packager`, `transcoder-thumbnails`, `indexer-writer`). No
transcode placeholder, empty handler or configuration file receives functional credit.

Each connection maps explicit endpoint IDs to a local logical resource and access. The original
storage reader **already exists**: `transcoder-read` and `encoder-originals` permit reading
`originals`; adding a speculative missing-reader tile would be wrong. Ownership remains the
schema 2 legacy declaration/inference: completion-handler writes metadata, view-counter writes
counts, search-indexer writes the index, upload writes originals and transcoder writes encoded
objects. Do not present this as new schema 3 ownership/contracts.

Settings changed on the v1 copy are retained in snapshot 004's `intentional-changes.json`:
one min/max replica per process, no autoscale signal, zero PostgreSQL read replicas, no partition
key, standalone cache, no queue partition/retention setting, self-hosted objects, external edge
and disabled resizing; `watch-details.readRouting` is primary. Snapshot 005 aligns the prose.
Original cloud/capacity intent is intact in 001/002/003. Logical `video_id` keys remain an
application policy, not an implemented database partition. RabbitMQ fanout is a local topic
substitute with no retained-log replay or cross-subscriber ordering guarantee.

The remaining declared settings are input requirements, not silently honored fields. FP02/03
must account for every meaningful path as emitted, configuration-only, custom or unsupported.
In particular request timeouts/concurrency limits, worker concurrency, SQL pool/statement
timeouts, cache TTL/LRU/single-flight, publisher batch/linger/outbox and consumer batch/retry
settings do not become runtime behavior merely by appearing in an environment file. The
disabled outboxes remain an explicit reliability limitation. A stub must fail clearly until
implemented. Unknown IDs/versions/settings and contradictory bindings must be reported/refused
as appropriate, never guessed from prose.

The binding lists **25 exact unsupported source paths** for the local substitutions:

- `identity.settings.language = typescript` remains declared; Keycloak is a Java vendor runtime.
  The explicit local binding substitutes Keycloak; it does not implement that language setting.
- Every connection's `planned.security = Service identity` remains intent. Local resource
  credentials and an isolated Compose network do not implement mTLS or workload identity.
- The six `planned.protocol = HTTPS` links remain declared. The chosen local endpoints use
  HTTP on loopback/Compose; no HTTPS implementation or equivalent production security is claimed.

These overrides must be visible in future experimental export reports, with the exact paths
from the JSON, and in the later custom plan/review. They are not a reason to add a universal
provider model now. The source language constraint cannot represent Java at present. The
strict blueprint/readiness report is preserved in full and remains ineligible/unavailable/
unverified; the TinyURL composition-domain string inside the existing report is not a YouTube
runtime certificate.

Known custom-phase gaps are frozen before generation:

| ID | Concrete gap / source references | Completion boundary |
| --- | --- | --- |
| G01 | No durable pending/failed upload-processing lifecycle, status route, cleanup or state ownership is drawn (`upload-multipart`, `transcoder`, `handler-writer`) | Plan explicit owned state and failures after inspecting real output; do not give upload/worker silent write access to metadata owned by completion-handler |
| G02 | `completion-events` feeds `completion-handler` and `search-indexer` independently, so indexing may precede committed public metadata | Resolve publication/search ordering in the custom plan; never expose a result that cannot be watched; any necessary diagram correction gets a new snapshot |
| G03 | Retries may duplicate processing, output writes, completion and indexing | Stable job/video identities and idempotent side effects; no exactly-once claim from broker confirms |
| G04 | Browser UI is outside the drawing; OIDC verifier/role wiring is implicit | Minimal sign-in/upload/status/search/watch interface, real PKCE/JWT integration; trace as custom or actual emitted output |
| G05 | Basic count meaning, event IDs/receipts and transactions are not represented (`watch-views`, `counter-sum`, `counter-writer`) | Apply the frozen playback-event policy; eventual aggregate with duplicate-event protection |
| G06 | Multipart limits, resumability ownership, public/internal signing hosts and CORS are not executable contracts | Prove actual part bytes, ETags, list/resume, complete/abort and private-original denial |
| G07 | Encoding ladder, packaging, thumbnails and failure behavior are prose-only | Real CPU FFmpeg HLS/renditions and an actual browser play; failed files stay out of public metadata/search |
| G08 | Local provider/protocol/language overrides and removed scale intent | Report exact limits; no CDN, autoscaling, replica, partition or production-security claims |

No G01–G08 implementation plan/code is supplied in FP01. These are observable unmet requirements
and mapping boundaries. FP05 must plan from the **actual committed untouched output**; necessary
corrections are allowed and must be classified as diagram changes, template repairs or custom
application decisions. NC07–NC13 and new abstract video contracts remain deferred.

## FP06b staged upload observations

[FP06b](evidence/fp06b/README.md) now implements creator JWT/PKCE identity, scoped durable real S3
multipart control, browser progress/reselect/resume/abort/status, confirmed job relay and safe
tracked first-run/restart. G04/G06 have actual bounded upload evidence, not only configuration:
S02 and S03 pass; S01 is staged in-repo subset startup plus separate independent builds, with
final outside-runtime/all-service acceptance deferred to FP07b. G01/G03's pending/job identity
boundary is exercised by stable repeats and one durable intent/queued message per completed file.
G02/G05/G07 and the remaining public UI still require later working processing/search/count flows;
G08's local limits remain. No blanket closure of G01–G08 or template/coverage/savings credit follows.
No current source/config intent changed from native010 and historical generated005 inputs remain
immutable. Six business extensions and the unfinished public/worker entries still refuse startup.

## FP06c processing/playback observations

[FP06c](evidence/fp06c/README.md) now implements real CPU H.264/AAC 360p/720p HLS, thumbnails,
job-bound marker inventory, strict result handling, lifecycle inbox/CAS/deadline/publication relay,
ready-only Watch/cache and public browser playback. G01/G03/G07 have bounded actual processing,
duplicate/no-rewrite, invalid-media and public playback evidence; G02's committed publication is
retained for the real indexer in FP07a. G04 now includes public Watch/details/thumbnail/errors;
search UI and G05 counts still remain. No blanket gap closure or generated-template credit follows.
S04 passes; S05 has five-second decoded video, unmuted decoded 440 Hz PCM, mouse seek and range
requests, with no human listening observation. The fixed-deadline staged jobs correctly fail.
Remote partial/orphan objects remain a documented limit; local temp cleanup is unconditional.
G08's local security/provider/scale limits and independent integrated FP07b acceptance remain.

## FP07a committed search/count observations

[FP07a](evidence/fp07a/README.md) now exercises G02's committed publication boundary through actual
OpenSearch title/description/channel queries and versioned repeated upserts; public pending/invalid
exclusion and1.156s ready→search are observed. G04 includes the same minimal mouse search/Watch UI;
G05 now has actual cumulative-play policy, confirmed events, transactionally deduplicated receipts/
totals, fresh count polling, lost-response retry0 and new-session+1. All core handlers run; no
business placeholder remains. Frozen S06/S07 pass these bounded in-repo flows. No blanket gap,
security/scale/production/certification closure or retroactive generated-template credit follows.
Independent integrated all-service S01–S08 outside-checkout evidence remains FP07b, with original
S05 no-human-listening and remote orphan-output limitations retained. Source/native010 intent and
frozen inputs remain unchanged. See exact safe event/video IDs, failed harness assumption and file
accounting; no tidy reset, feature percentage, effort saving or automatic v2 decision is inferred.

## FP07b current bounded completion/review status

[Independent integrated evidence](evidence/fp07b/README.md) now exercises the final app outside the
checkout: G01 lifecycle/status, G02 committed public search, G03 identities/receipt boundaries,
G04 minimal browser/PKCE, G05 basic2s counts, G06 real owned multipart/resume/abort and G07 real
media all have observed bounded flows. S01–S04/S06–S08 pass; S05 remains partial without human
listening. G08 local security/provider/capacity overrides remain limits, not resolved by success.
Remote partial/orphan outputs and guessed public partial keys stay explicit. No exhaustive fault,
crash, expiry24h, background OS tab or production guarantee follows. Source/native010 models
owners/resources/publication but not all API/data/lifecycle/browser policy. The exact005 generator
cannot emit current customr6. FP08 reviews the [provenance, remaining design gaps and safe future
regeneration boundary](review-pack.md), without retrospective template credit or automatic v2.
