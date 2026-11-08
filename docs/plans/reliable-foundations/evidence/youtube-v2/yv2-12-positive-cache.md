# YV2-12 positive-cache evidence

`local.positive-cache` emits `src/runtime/{positive-cache,valkey}.ts` and
`src/features/positive-cache-bindings.ts`. [Actual APIs and remaining bindings](../../youtube-v2/interfaces.md#yv2-12--immutable-positive-cache-read-dependency).
The generic adapter owns immutable positive eligibility, identity, codec, key and authoritative
loader. No product SQL, private/totals cache, new setting or provider/dependency pin was added.
`positiveCacheReadAccess` contributes SELECT on one trusted explicitly named view plus its exact
runtime login; the actual view must be contributed separately. Default emission grants nothing.

Seven focused offline checks execute the emitted source:

- Same-key requests share read/fill; a valid hit avoids authority. A PDF/manual shape uses the
  same algorithm without YouTube imports.
- Corrupt JSON/schema, wrong identity, ineligible record and failed cache fall back. Null and
  ineligible primary records are never written; primary errors propagate and release the fill.
- Failed fills preserve authoritative success. Stalled reads/fills finish within150ms and
  disable the reader's cache, preventing repeated stalled calls.
- Absolute atomic `PXAT` uses the TTL or earlier record expiry, without upward rounding.
  Subsecond life skips fill; expired hit reloads, expired primary yields null, and expiry
  crossed during fill yields null.
- Actual emitted Valkey constructor, with an offline SDK double, uses bound endpoint/secret,
  startup500ms, command150ms, queue32, no offline queue/reconnect and socket destruction on
  deadline. An explicit view-only access probe produces exactly one SELECT grant.
- An edited authoritative TTL changes emitted bindings; an unequal existing mirror refuses.

Two final deterministic **31-file** fresh exports use **manual-api/manual-db/manual-cache**,
selection **manual-reader**, and the source tile's **7200-second** TTL. Own frozen install
(109 packages, all reused) and untouched build pass. A separately added typed strict PDF/manual
adapter compiles against the emitted reader and actual Valkey factory; its offline execution
checks coalescing, fill, actual TTL7200 and uncached absence. No copied cache algorithm or
search/count/video dependency is needed. Build verified the existing pinned `redis6.3.0` API.

`applicationComplete:false`, installed templates empty and required
`positive-cache-application-bindings` remain honest. YV2-15/16 must bind the actual public-ready
video projection, loader/codecs and service/client lifetime, passing the emitted TTL and keeping
totals outside this cache. This is no strict TinyURL Resolve claim: no propagated primary/total
deadline, global primary admission, synchronized clocks or expired410 contract. No real Valkey
provider/fault matrix was run; the assignment's focused offline evidence and standalone builds
cover this unit. Trusted namespace isolation remains required; schema checks do not authenticate
malicious values. Injected cache adapters own cancellation/late completion.

`pnpm check` passes lint/types and **451 tests/64 files,29.20s** (existing Biome info).
Native `pnpm test:e2e` passes **36 tests,1.3m**; web build passes **1.52s** (existing chunk-size
advisory). No UI changed; browser checks retain TinyURL lane rendering, mouse edits/history
and generation behavior. No assertions/timeouts were weakened.

Frozen v1 remains **108 identical paths/hashes**, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
The15,584,953-byte retained fixture SHA stays
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`.
Root README/owner Future Benchmarks, feedback dirt and e2e-docker mode are byte-preserved;
all fourteen v1 services remain healthy. No scratch provider/port/volume/image/secret was
created, no v2 field app, branch/worktree/stash or push.

Sanitized harness/logs under `/tmp/jeeves-yv2-12/`: `focused.log`, `check.log`, `e2e.log`,
`web-build.log`, `export-final.log`, `export-summary.json`, `install-final.log`, `build-final.log`,
`build-adapter-final.log`, `manual-smoke-final.log`, `v1-path-hashes.json`, `fixture-after.log`
and `cleanup-summary.json`. Owned exports, dependencies and build outputs are removed after
verification; retained harness/evidence contains no secrets or media.
