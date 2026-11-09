# YV2-15: YouTube adapters, 2026-11-08

Product-contract libraries are emitted by `local.youtube-adapters`, composing the preceding
actual factories. No complete selected template/preset/service is installed; reports retain
required application and `youtube-service-composition` gaps. No editor/UI/provider/pin changes.
[Actual paths/APIs and remaining work](../../youtube-v2/interfaces.md#yv2-15--youtube-contracts-and-browser-api-adapters).

## Evidence

- Three focused offline cases: strict creator/upload/event/public schemas and authoritative
  original/result namespaces; actual PGlite upload/lifecycle/outbox/public-view → cached ready
  metadata + fresh transactional count + confirmed-acceptance promise + Search browser shape;
  deterministic manifest ownership/incomplete report. Tests require no network/Docker/Postgres.
  Prior Search/lifecycle/counter/HLS focused cases also pass; no lifecycle algorithm change.
- Two fresh deterministic **80-file** exports of the actual full source fixture. Own pinned
  `pnpm install --frozen-lockfile` and untouched `pnpm build` pass. Compilation exposed and
  corrected adapter codec call signatures and a contextual type annotation in the unchanged
  public query preset. No output source was edited to make it build. The runtime probe preceded
  final whitespace-title validator reuse; that final codec received its focused test and another
  deterministic untouched export/install/build.
- The compiled standalone output ran three real loopback HTTP services on 45290–45292, with
  verified RS256 issuer/audience/creator policy, isolated disk PGlite and the pinned scratch
  RabbitMQ on 45293. HTTP 401/403, owned upload 404, upload 201/sign 200/complete 202 with stable
  replay, pending Watch 404, matching committed success/publication, canonical uppercase UUID
  inputs and ready status enrichment were observed. Search returned exact public hit fields and
  media URL mapping; invalid query/body 400. Original fingerprint/provider fields stay private.
- Watch 202 followed the actual emitted confirmed RabbitMQ publisher. Two accepted requests
  with one canonical event ID produced one durable count through the actual emitted consumer
  and product counter adapter. GET observed fresh string `"1"` while only immutable metadata
  occupied the cache. Closing the publisher caused 503, without accepted:true. The offline
  deferred-confirm assertion separately shows the route cannot finish before its publisher.
- Public SQL role could SELECT the exact nine-column ready view; private SELECT failed 42501.
  `has_table_privilege(...,'INSERT')` was explicitly false. A view INSERT failed 55000 because
  the view is intrinsically non-updatable; that rewrite rejection alone is **not** grant proof.
  Actual source-bound migration/login/grant composition remains YV2-16 work.

The probe explicitly doubles multipart object operations, Search client and successful media
result. It establishes adapter/HTTP/confirm/counter behavior, not a full real-media application
or fresh provider-integrated preset. Queue counters use actual confirmed delivery/receipts;
OpenSearch/media/storage behavior remains supported by prior module evidence and awaits 16's
complete assembly. The existing browser is read for contract compatibility; no UI is changed.

## Checks and source scope

`pnpm check`: **460 tests/67 files,30.43s**, lint/type checks pass (one existing lint info).
Native `pnpm test:e2e`: **36 passed, 1.3m**. `pnpm --filter @jeeves/web build`: **888ms**,
passes with the existing chunk-size advisory.
Native TinyURL E2Es exercise application loading, lane rendering and mouse/history/generation;
no user-visible studio behavior changed in this unit.

[Reviewed separate LOC record](yv2-15-adapter-loc.json), using the existing source-loc-v2 parser:
**785 backend LOC in 10 product adapter files**, plus **95 LOC in 3 shared public-video feature
files**. All emitted `src/{adapters,features,runtime}` code is backend; no UI source is emitted.
This bounded inventory is not the final generated-vs-completed app benchmark or a template-share
claim; YV2-23 owns that report. Paths and byte hashes identify the measured output.

Scratch evidence/scripts/logs remain in `/tmp/jeeves-yv2-15/`:
`{focused-final,check-final,e2e,web-build,export,install,build,probe,runtime-start,cleanup}.log`,
`{export-summary,probe-summary,adapter-loc,resources,cleanup-summary}.json`,
`{prepare,record-loc}.mts`, `probe.mjs`. No tokens, secrets, signed URLs, dependency/runtime/DB
or build directories are retained in the repository.

## Cleanup and preservation

Exact project `jeeves-yv2-15-contract` broker, one volume and network were removed by scoped
`down --volumes --remove-orphans`. Owned exports/copy/dependencies/builds, producer DB and
secret directory were removed before root checks. 45290–45293 are free; no image was built or
removed. All 14 retained v1 services remain healthy. Root README/owner Future Benchmarks,
feedback dirt/deleted Unicode Zone.Identifier/colon variants and e2e-docker mode are preserved.
Retained fixture 15584953 bytes/SHA1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9 unchanged.
Frozen v1 **108 paths/hashes** remain unchanged; manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
No branch/worktree/stash/push, field v2 app, new media or later unit work.
