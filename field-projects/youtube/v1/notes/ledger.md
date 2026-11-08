# Decisions and reusable hypotheses

Append new entries. No runtime finding, effort saving or functional coverage is measured yet.
Owner review follows working v1; this ledger does not authorize automatic v2.

| ID | Decision / evidence | Classification and current outcome |
| --- | --- | --- |
| D01 | Owner chose local Docker, signed-in creator upload, automatic public success, real encoding/playback/search/counts, minimal UI and PostgreSQL | Agreed product scope; [active plan](../../../../docs/plans/reliable-foundations/youtube-field-project-plan.md); no unanswered product choice |
| D02 | Archive actual owner revision 1 before the two engine changes; preserve schema/origin and all other fields | Source provenance; snapshots 001→002, API operation 6466; owner now revision 2 |
| D03 | Make a retained named copy using full schema-aware seed operations | Experiment isolation; snapshot 003, operation 6467; no shipped study/global-default rewrite |
| D04 | Bind objects/edge locally and normalize capacity intent explicitly on the copy | Local substitution; 35 changed setting paths in snapshot 004, operation 6468; original scale/cloud intent remains archived |
| D05 | Correct replica descriptions and local-edge name/prose in another snapshot | Source/context consistency; snapshot 005, operation 6469; no topology change, new clean image |
| D06 | Use pinned local Garage/Keycloak/RabbitMQ/Valkey/OpenSearch/PostgreSQL/nginx and Node/FFmpeg | Bounded experimental adapter choice; primary metadata/digests in inputs; startup/compatibility still unverified |
| D07 | Preserve exact TypeScript identity and HTTPS/service-identity declarations but expose explicit local overrides | Unsupported source intent; 25 exact paths in bindings, no false implementation claim; revisit in custom plan/review |
| D08 | Count explicit two-second playback events once per page session/event ID; public-only search and fixed encoding bounds | App-specific demonstration policy; [S01–S08](scenarios.md) frozen before generation; not implemented |
| D09 | Do not front-load lifecycle/search/idempotence abstractions or broaden NC07–NC13 | G01–G08 remain named gaps for the actual-output custom plan; necessary correctness/diagram fixes stay allowed |

These hypotheses are deliberately tentative. Another plausible use motivates investigation,
not immediate promotion into a new tile or a claimed reusable template.

| ID | Observed starting problem / references | Candidate / another plausible use | Decision and evidence needed |
| --- | --- | --- | --- |
| H01 | Upload multipart/resume is prose-only (`upload-multipart`, G06) | Signed/resumable upload module + bounded template; document/image import | Investigate after v1; show what actual custom code repeats and provider limitations |
| H02 | Pending/failure state and ownership are missing (G01) | Owned asynchronous lifecycle/status pattern; reports/imports/builds | Defer representation until actual implementation; retain owner consistency and failure evidence |
| H03 | Independent completion consumers can publish search too early (G02) | Committed-publication projection pattern; catalogs/listings | Correct v1, record actual diagram/code change, then judge reusable event/operation/template form |
| H04 | Retried processing/count delivery needs identities and receipts (G03/G05) | Idempotent worker/aggregation module; exports/activity counters | Require concrete side-effect boundaries and observed duplicate protection before promotion |
| H05 | Vendor/provider choices do not express transport/language substitution (D07/G08) | Explicit adapter override report; other local field projects | FP02 should report exact unsupported paths; no universal provider schema in FP01 |
| H06 | Hidden settings changes produce identical diagram PNGs (001–004) | Paired clean image + source + inspector evidence; any resource-setting edit | Accepted evidence practice; no need to add all settings to tile faces |
| H07 | Local settings edits left contradictory descriptions until review (004→005) | Context/source consistency review; any prose + structured intent pair | Accepted narrow correction; no runtime/chat-quality improvement claimed |
| H08 | Encoding ladder/packaging/thumbnail code is video-specific (G07) | Video template first; later other video products | Keep app-specific until a second use justifies generalization |
| H09 | Browser interface is outside current diagram (G04) | Browser/template entry and explicit client/server bindings; any minimal app | Track actual custom cost; do not pretend existing action lanes generate a UI |

For each later adoption/rejection append: observed problem, source/code/smoke references, chosen
representation, applicability/exclusions, implementation commit, investment in Jeeves, remaining
custom cost and stable-scope v2 result. Preserve rejected approaches. Curating a documentation
lesson alone does not change actual chat guidance or prove assistant/model quality.

## 2026-11-07 — FP03a observed foundations and independent boundary

- **D10 (deferred build detail resolved):** use Debian and Debian-security snapshot
  `20261024T000000Z` for exact frozen FFmpeg `7:5.1.9-0+deb12u1`; lock/check all 288 OS package
  versions and the frozen deb SHA in template source. [Actual builds](evidence/fp03a/README.md)
  pass; no input pin was replaced or image reproducibility/certification claimed.
- **D11 (independent field tooling boundary):** exclude exactly `field-projects/youtube/v1/app`
  from root Biome, as it is already outside root workspaces. Preserve untouched generated files
  and immutable `.jeeves` snapshots. This supersedes FP01's initial no-app-exclusion choice;
  future field handoffs run their own frozen install/TypeScript build and applicable field checks.
  Existing Jeeves studio/generator checks remain mandatory. No formatter dependency was added.
- **D12 (observed local compatibility):** bounded actual generated-output probes establish
  basic pinned-client/resource interoperability, public/internal Host and issuer wiring,
  scoped UID-readable secrets and readable nginx mounts. [Results](evidence/fp03a/provider-result.json)
  are separate from application S01–S08, all still unrun; G01–G08 remain custom and no functional
  coverage or effort saving is inferred. Empty index/realm/bucket/client setup is foundation output.

## 2026-11-07 — FP04 untouched output checkpoint

- **D13 (actual baseline):** retain the actual Jeeves mouse ZIP as108 untouched files in `app/`,
  validated against repeated assembler bytes, all CRCs and the frozen manifest/inputs/005PNG.
  [Provenance](baseline.md) records FP03b `aedbd606342c5a369142b10cf127fc7130d50671`, exact versions/hashes
  and observable S01–S08 limits. Own frozen installs/TS builds pass in-repo and independently.
  No generated bytes/locks are repaired; existing19 experimental families and all gaps remain.
  FP05 records this containing commit before planning custom work. Configuration/shells earn no
  complete feature credit; no coverage percentage, observed savings, certification or v2 decision.

## 2026-11-07 — FP05 planned custom decisions, not implemented behavior

- **D14 (comparison anchor):** FP04 commit `02ac280da62616e9c7aad7f88457dcb72084cb25`, after FP03b
  `aedbd606342c5a369142b10cf127fc7130d50671`, is the untouched108-file baseline. The [concrete
  plan](implementation-plan.md) leaves `app/.jeeves`, inputs/snapshots and all baseline bytes
  unchanged in this unit. Later source provenance must distinguish extension work, modified
  generated integration/defect repair, newly custom, reused custom and external dependencies.
- **D15 (planned G01 authority):** one Video owner with initiating Upload API and existing
  lifecycle worker, explicit schema3 grants/metadata edge, private lifecycle/upload tables,
  migration-only owners and separate runtime credentials. Transcoder remains no-SQL. Watch
  gets only a ready-public view, Counts reader only totals; revoke blanket future-table SELECT.
  No new independent completion owner or generic lifecycle DSL. FP06a applies/snapshots it.
- **D16 (planned G02/G03 ordering):** Processing events go only to lifecycle; ready decision and
  publication outbox commit together; new Publication events feed indexer. Upload pending/job
  outbox, stable IDs, bounded retries/terminal hook, inbox and marker/deadline policy supply the
  finite custom recovery boundary. No exactly-once or SQL+object atomicity claim. Existing
  outbox-disabled intent changes explicitly in the next source snapshot, not in frozen inputs.
- **D17 (planned minimal local implementation):** plain TypeScript browser/copy pinned hls.js,
  fixed actual CPU encoding ladder, ready-only metadata cache separated from current counts,
  actual OpenSearch, immediate asynchronous per-event receipt+increment. Batch1 source/prose
  corrections avoid adding buffering scope; frozen S01–S08 and two-second playback policy stay.
  Public object keys can be guessed before ready; no public playable Watch result is allowed
  before successful owner commit. Existing local security/provider limits remain explicit.
- **D18 (assigned implementation order):** FP06a source/state foundation; FP06b creator and real
  multipart/resume/abort/uploader; FP06c encoding/lifecycle/publication/Watch/HLS; FP07a committed
  search/counts/core UI; FP07b independent integrated walkthrough/provenance/review pack. Each
  has concrete files/interfaces and acceptance in the plan, required regressions and one local
  commit. Owner review precedes v2; no renewed product/milestone prompt is needed.

These choices resolve planning questions, not application gaps. H01–H09 remain hypotheses;
existing ownership/publication lessons already apply. No new reusable-template/chat-quality
lesson, functional percentage or measured time/token saving is asserted from static inspection.

## 2026-11-07 — FP06a implemented owned-state foundation

- **D19 (Video authority adopted):** retained copy explicitly upgrades schema3 in ordinary atomic
  operation6470/r4; original roles/legacy metadata preserved, Upload and lifecycle receive named
  read-write grants, Transcoder no SQL, Watch published views, Discovery projection and Counts
  authority. [008](../diagrams/008-video-authority/snapshot.json) retains the initial direct-outbox-link
  findings; [009](../diagrams/009-explicit-outbox-store/snapshot.json)/6471/r5 adds both explicit module
  links; [010](../diagrams/010-readable-upload-role/snapshot.json)/6472/r6 shortens a clipped role name.
  Status responsibility stays in Purpose; existing expanded-role fallback/readability limit remains.
- **D20 (durable policy implemented, flow incomplete):** checksummed repeatable owner migrations,
  runtime-only DML roles/private schemas, ready/totals-only views, fixed identities/inbox/outbox,
  conditional state and per-event count receipts now exist. Real isolated grant/rollback/duplicate/
  confirm/backoff probes pass; no synthetic rows/messages survive. No RLS/exactly-once claim.
- **D21 (publication and transport boundary):** processing only to lifecycle, committed publication
  only to indexer; repeat setup unbinds old fanout. HTTP config/init precedes listen; awaited handlers
  own execution admission; AMQP terminal hook precedes failed-copy/ack and exposes fatal closure for
  stopping loops/pools. No unfinished consumer starts. Exact [FP06b interfaces](fp06a-foundation.md)
  keep its scope independent of later real media consumers.

H02–H04 now have concrete app-specific code and bounded SQL/broker observations, but remain reuse
hypotheses until working flows and another applicable use justify a shared template/module. H06/H07
continue as evidence/source consistency practices. No generic lifecycle/contract framework, heavy
certification, coverage percentage, time/token savings or automatic v2 decision follows from this
foundation. The modified-generated/new-custom file accounting is [explicit](evidence/fp06a/provenance.json).

## 2026-11-07 — FP06b implemented creator/multipart/browser subset

- **D22 (observed upload authority):** owner-scoped JWT controls inside awaited route budgets,
  fixed fingerprint/key/expiry, authoritative ListParts and exact-size complete, stable pending/job/
  outbox and confirmed relay now work with three real parts. Cross-creator404 and anonymous401,
  refresh/reselect missing-parts-only resume and abort410 are observed; independent object streams
  match the frozen fixture SHA/size. Browser SHA and multipart ETag stay distinct from byte proof.
- **D23 (bounded browser/runtime):** plain DOM TypeScript/installed pinned hls asset and baked edge
  assets; actual public-client PKCE one-use state/nonce, trusted /me and provider logout. Tracked
  first-run/restart retains secrets/project/volume identities and refuses ambiguous bootstrap replay.
  Normal subset restart preserves two pending/one aborted record. Own outside-copy builds pass;
  independent final runtime/all-service S01 stays FP07b. Consumers remain stopped; fixed elapsed
  ten-minute queued deadlines require fresh FP06c uploads, not policy weakening.
- **D24 (measured boundary, no promoted abstraction):** [provenance](evidence/fp06b/provenance.json)
  distinguishes custom extension/browser/operator work from generated integration and scoped HTTP/
  publisher shutdown repairs. H01/H02/H04/H09 now have app-specific code and bounded observations;
  document/image import remains another plausible upload use, but provider/media/creator policy and
  browser cost are still concrete custom work. No shared framework/template adoption, functional
  percentage, observed effort/token saving or automatic v2 decision. Active cost/time remain unknown.

[Evidence](evidence/fp06b/README.md) records the Docker COPY-order repair, pre-flow busy-state/
volume-guard corrections, evidence-format lint failure and retained35/36 E2E setup timeout followed
by unchanged isolated/pass36/36. Existing Jeeves checks were kept; no timeout weakening, provider
campaign or source diagram change. Current schema3/r6/native010 and all historical artifacts stay.

## 2026-11-08 — FP06c real media and public-ready boundary

- **D25 (observed processing):** custom CPU FFmpeg extensions validate bounded actual original
  hash/size/streams, encode two HLS renditions and source-size thumbnail, validate relative
  inventory and confirm a job/fingerprint-bound marker before success/ack. Same job/result
  re-delivery preserves every output SHA/ETag/mtime and one publication. No SQL in Transcoder.
- **D26 (publication and read boundary):** lifecycle uses existing atomic inbox/CAS/outbox and
  fixed startup/30s deadline sweeps. Expired staged jobs fail and ignore late success. Ready-only
  Watch caches only positive public metadata, single-flight/TTL3600/bounded primary fallback;
  totals are read separately. Pending404 never masks later ready200. Signed-out mouse playback,
  seek, actual edge MIME/range and decoded 440 Hz PCM are observed, with no human listening.
- **D27 (explicit local limit):** local temp cleanup is unconditional, but remote partial/orphan
  prefixes are retained, including outputs of aged staged jobs. This documents the deviation from
  best-effort remote cleanup rather than claiming S3 cleanup or atomic object/ACL publication.
  Search/counts stay stopped; no event reaches an unimplemented Counter. FP07a consumes retained
  committed publication and adds actual playback counting; independent S01/S08 remain FP07b.

[Evidence](evidence/fp06c/README.md) separates custom extension work from the scoped AMQP helper
repair (idempotent admitted-work drain/fatal self-await fix) and retains real/harness failed attempts.
Cumulative [provenance](evidence/fp06c/provenance.json) is file accounting, not coverage or template
credit. Existing reuse hypotheses remain hypotheses; active time/cost/savings unknown. No generic
DSL, new source/diagram decision, certification campaign or automatic v2 follows from this unit.

## 2026-11-08 — FP07a committed search and playback counts

- **D28 (observed derived publication):** actual OpenSearch uses a strict public field mapping,
  ready/public filters, bounded paged title/description/channel queries and stable ordering.
  Indexer consumes only committed publication, with no metadata SQL/raw processing dependency;
  `_id=videoId`/external_gte version1 preserves one document across repeats. Empty historical
  index receives compatible mapping without reset; incompatible mapping precisely refuses.
  Fresh ready→search1.156s, pending/invalid public exclusion and mouse Watch link pass S06.
- **D29 (observed event policy):** normal-speed short advancing playback samples accumulate2s
  per mounted session; pause/seek/inactive/suspended samples reset only the sample. One UUID
  survives HTTP retries; persistent matching-ID confirm precedes202, transaction receipt+increment
  precedes ack. Fresh count reads stay outside positive metadata cache. Actual lost-response retry
  adds1/visible1.023s, explicit repeat/pause/seek/resume add0, new page adds1. Advancing media during
  a measured main-thread block/controlled hidden signal/2x rate adds0; OS tab hiding is not claimed.
- **D30 (no inferred template adoption):** cumulative provenance separates three planned custom
  business extensions, modified-generated service integration and the small finite404 helper repair.
  H02/H03/H04 have concrete bounded observations; another plausible use is committed catalog search
  and idempotent document-engagement events, but ownership/version/policy choices remain custom.
  No shared abstraction/capacity/fraud/exactly-once certificate or measured time/cost/savings credit.
  Retained failed CDP-freeze assumption counted real playback legitimately; no receipts were reset.

All core14 services now run through retained normal start/stop;6volumes/credentials/fixture and
original demo stay. FP07b independent integrated walkthrough remains; frozen inputs/config/native010/
app`.jeeves`/generator/templates/pins unchanged. Audio/no-human-listening and remote orphan limits
stay explicit. No additional source decision/snapshot011 or automatic v2 follows from this unit.
