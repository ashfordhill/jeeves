# YV2-14 search projection/query evidence

`local.search-projection-query` emits generic public-document/mapping validation, explicit index
assertion, event-to-ID/version upsert, bounded query/result and consumer factories, plus exact
normalized index/client/topic queue bindings. Separate `public-video.ts` contains the shared
strict public record/document schema and mapping; `public-video-search.ts` holds the finite
v1 filters, weights and sort. [Actual APIs, ownership and gaps](../../youtube-v2/interfaces.md#yv2-14--public-search-projection-and-bounded-query).
Generic runtime has no video/channel/YouTube schema, private loader or SQL credential. Actual
foundation versioned mapping and broker hooks are used; existing YV2-05 clients/delivery own
transport. No provider/dependency/pin, normal control or earlier module algorithm changed.

Three focused offline tests exercise emitted sources: public-only document/ID/version/transport
binding, one raw-wire decode followed by separate internal envelope revalidation, a non-video
catalog document through the same factory, exact v1 request bounds/preset, invalid/incomplete/
unbound results, incompatible mapping refusal without mutation, held upsert before delivery
ack, finite malformed handling/drain, actual compiled mapping/broker contribution and honest
installed-support gaps. No Docker/network is needed. Final focused run:3 tests,697ms.

Two final deterministic **51-file** fresh exports rename resources/hosts to **public-documents,
publications,public-indexer,public-api,catalog-producer**. Own frozen standalone install
(`--frozen-lockfile --ignore-scripts`) and untouched emitted build pass. A separately added
**typed non-video catalog adapter** compiles against the same emitted document, projection,
query and actual OpenSearch client interfaces. Its nested notice maps to
`{sku,revision,name,publishedAt}`, uses `Manual:A`/version2, and executes an offline projection/
query round trip without importing the video schema or copying a generic implementation.
The extra owned-upload dependency only supplies emitted transaction/outbox modules for the
producer probe; no completed upload/application behavior is claimed by this scratch assembly.

Small real pinned RabbitMQ/OpenSearch smoke uses the generated foundation provider definitions
and actual `broker-init.mjs`/`search-init.mjs`. A separate disk-backed PGlite producer commits
public metadata plus YV2-06 outbox intent in one transaction, closes and reopens the database,
then relays via the emitted confirmed publisher. A rolled-back publication yields no intent or
search hit. The committed event passes actual RabbitMQ → separately mounted emitted indexer →
OpenSearch and becomes queryable. This is an actual committed-publication probe with a nested
**probe publicNotice wire codec**, not a claim that YV2-15's VideoPublished codec is installed.
No PostgreSQL provider was needed for this bounded transaction evidence.

Duplicate publication advances the index sequence while retaining exactly **one document,
external version1**. The indexed public record equals the validated event record and contains
no private producer field. Pending state and an extra private creator field reach the confirmed
failed queue with `MALFORMED_MESSAGE`; they do not enter the index. `canopy` hits, prefix
`canop` does not, `Pine absentword` still hits through default OR (no added AND), page2 is empty.
Query trims input and returns exact total1. Asserting mapping version2 against the existing
version1 index refuses while the document remains. Re-running actual foundation search setup
also preserves the existing index. No index was deleted/reset/repaired to pass.

Inspected indexer mounts are read-only generated code/dependencies and its probe constructor,
plus **only the broker secret**. No SQL login/database/runtime mount is present. Indexer drains
normally with exit0, then caller closes the search client. This is a small provider/producer
smoke, not a full generated application, provider/fault matrix or new isolation/security claim.
OpenSearch retains the existing local security limits. Equal external versions retain v1's
replacement semantics; no additional conflicting-publication receipt guarantee is claimed.

Required **search-application-bindings**, application services and actual installed-template
gaps remain; `applicationComplete:false` and `installed.templates:[]` are intentional. YV2-15/16
must bind actual stable/canonical VideoPublished identities and committed public projection,
assetId→videoId, authoritative storage namespaces/paths, source-bound mapping/preset, HTTP
responses/media URLs, service constructors, readiness and signals/drain. The reusable public
record has bounded path strings; path ownership and wire authorization remain adapter work.
No prefix search, recommendations, filters/relevance/paging/sort expansion or schema editor.

`pnpm check` passes lint/types and **457 tests/66 files,29.78s**; native `pnpm test:e2e` passes
**36 tests,1.3m**; web build passes **1.67s** (existing chunk advisory). No assertion/timeout/pin
was weakened. No UI changed;
required native browser regressions exercise app load, TinyURL lane canvas and mouse actions.

Scratch project **jeeves-yv2-14-search** used search/broker plus a transient read-only indexer,
its two volumes and network. Loopback search/broker ports **45280/45281**; reserved **45282–45284**
stayed unused. Exact project `down --volumes --remove-orphans` removed its resources; all five
ports are free. No image was built/removed. Owned exports/dependencies/builds/private runtime
and producer DB were removed before root checks. All14 retained v1 services remain healthy.

Frozen v1 remains **108 identical paths/hashes**, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Fixture remains15,584,953 bytes/SHA
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`.
Root README including owner Future Benchmarks, feedback dirt/Zone.Identifier variants and
e2e-docker mode are unchanged by this unit. No v2 field app, branch/worktree/stash or push.

Sanitized harness/logs under `/tmp/jeeves-yv2-14/`: `prepare.mts`, `catalog-adapter.ts`,
`runtime-prepare.mjs`, `compose.mjs`, `indexer.mjs`, `probe.mjs`, `cleanup.mjs`,
`focused-final.log`, `export-final.log`, `export-summary.json`, `install-final.log`,
`build-final.log`, `build-adapter-final.log`, `catalog-smoke-final.log`, `resources.json`,
`runtime-start.log`, `setup-{search,broker}.log`, `setup-search-repeat.log`, `indexer-start.log`,
`indexer-mounts.json`, `indexer-exit.log`, `probe.log`, `probe-summary.json`, `cleanup.log`,
`cleanup-files.log`, `cleanup-summary.json`, `check.log`, `e2e.log`, `web-build.log` and frozen
v1 path/fixture/owner-diff comparisons. No secrets, signed URLs, media or dependencies retained
in the evidence/harness.
