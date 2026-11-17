# RG13 — callable cache reads with explicit freshness

Built on accepted RG12 `f11ba8a9233e65c0c59122d2de7241912b21244e`; extension API remains **v8**.
The existing Cache reader implements the common `cache-reader.read@1` binding. Custom and standalone
Data access consume a **read** slot; a template part has no standalone operation and refuses one.
The product must call the supplied handle. There is no extra endpoint for in-process exposure.
The normal controls are Freshness, Exposure and shared TTL; old unsupported settings stay readable
and refused. Mouse, chat, blueprint and normalized Preview use the same finite choices.

Immutable positive records retain their own contract. Versioned records explicitly require a
canonical uint64 decimal source version and finite absolute source validity. TTL starts before the
authoritative query; absolute expiry is the earlier of that TTL and source validity. Canonical
normalized DTO bytes make equal-version comparisons transport-independent. A slower old fill
cannot overwrite a retained newer version; if fenced it retrieves an eligible newer value or
refuses, including after a failed/malformed/private reread. Equal-version conflicting contents
refuse. Hits never renew expiry. In-process results contain immutable record/freshness/version/
absolute validity/source metadata or null. The caller must recheck validity after another awaited
operation. HTTP preserves its existing record-only body and explicitly adds no-store and
`X-Jeeves-Cache-Freshness`, `X-Jeeves-Valid-Until`, `X-Jeeves-Cache-Version` headers as applicable.
Legacy absent settings retain immutable-positive/HTTP behavior; no hook or client rewrite occurs.

Keys, codecs, eligibility, versions, expiry and their getter snapshots run under pure guards;
rejected async policies are observed and refused. Inputs, outputs and policy DTOs are normalized
and immutable. Coalescing requires identical key/input/verified subject and rechecks eligibility
and expiry for each waiter. Each reader keeps at most **32 actual unsettled fills**, **128 waiting
callers**, **32 per compatible fill**, and a **2s** caller bound clamped to RG03's received budget.
Caller timeout releases its waiter, never the actual fill slot. One actual cache phase at a time
is admitted by a reader; others use authority within those same bounds. Cache phases are **150ms**;
genuine failure bypasses cache for a monotonic **5s**, then recovers after settlement/reconnect.
Healthy saturation does not trip the breaker; corrupt values invalidate only that entry. Unknown
fills remain unknown internally and never retry, while a valid authoritative read can succeed.
First-fill context cancellation conservatively fails its compatible waiters. Failure logs contain
only classified values, without cached payloads/codec messages. No correctness relies on this map.

The source loader now receives a working registered **read-only** RG07 product handle. The reader
lead's stable ID is compiled as a read-only database binding. Product declaration, SQL, endpoint and
product credential validation happen before client construction; queries use the separate product
credential and `BEGIN READ ONLY`. No raw pool, SQL, transaction or migration authority reaches a
hook. Source SQL and public eligibility remain product work, reflected in the custom gaps.
New handwritten `rg-cache-reader` inputs install the same registered SELECT and pure mapping for
immutable and mutable redirect-like records. Their generated output exists only in scratch.

Generated cache namespaces bind stable process/module/source IDs, callable contract, freshness and
TTL. Product handles cannot read/write/delete the reserved `jeeves:` prefix, including on the same
physical client; private fills cannot address admission state. Old unnamespaced entries are ignored,
never remapped/deleted. Copies must share key/codec/eligibility/source-version policy; changing
product policy requires an explicit key/contract migration. Both modes retain the finite LRU cache
contract and refuse sharing with no-eviction admission. Version fencing lasts only while a key is
retained, without a durable watermark after eviction/expiry/data loss. Compatible UTC clocks are
required. This is bounded snapshot freshness, without immediate invalidation or linearizable reads.

| Check | Actual result |
| --- | --- |
| [Standard check](check.txt) | Node 24.21.0; Biome/workspace type checks pass; **132 files / 1,210 tests passed**, **89.68s**. Existing informational local.mjs suggestion only. |
| [Focused mechanisms/contracts](focused.txt) | **156 passed** across actual emitted reader/source, legacy immutable reader, public clients, atomic adapter, HTTP wiring and mouse/chat command parity. |
| [Shared-client namespace proof](namespace.txt) | **72 passed**. Actual generated client serves private immutable fills inside read-like authority while public writes in read effects refuse; public get/set/delete cannot address reader or admission namespaces. |
| [Emitted source helper](source.txt) | Actual emitted prepareCacheSource/cacheSource uses a PG seam backed by PGlite: validates before opening, selects the exact product credential, shares one compatible pool, executes `BEGIN READ ONLY`/SELECT/COMMIT and dispatches no SQL for pure captured reads or unknown operation names. This tests generated configuration/transaction behavior; PGlite runs as its default user, so native role/login enforcement remains RG14. |
| [Ten scratch exports](emitted-compile.txt), [runner](compile.ts) | Immutable, versioned and versioned HTTP **63** files each; limiter **71**, limiter off **49**, video **125**, stubs **96**, frozen v2 **80**, module design off **87**, stub stack off **60**. All pass extension checker and TS7. Three new variants install handwritten SELECT/hooks/contracts/caller. Negative proofs deny constructors, private imports, caller spoofing, raw cache/lifecycle controls and captured policy reads. |
| [Offline plain pnpm eval:chat](chat.txt) | Scripted fetch-disabled evals and synthetic replays pass; no positional argument, paid model or live issuer. |
| [Web build](build.txt) | Passed, existing chunk-size warning only. |
| [Full browser run](browser-initial.txt) | **78/80 passed**, **6.4 min**, including TinyURL, RG13 controls/connection/Preview and the other complete mouse rebuild. Two stale expectation failures diagnosed below; corrected rerun recorded separately. |
| [Corrected browser cases](browser-corrected.txt) | **3 passed / 1.7 min**: source export, RG13 mouse controls/connection/blueprint/Preview and full YouTube v2 mouse rebuild. Together with the full run, all **80 unique scenarios** passed; no runtime source changed for the two expectation corrections. |
| [Final lint](lint.txt) | Passed after evidence and e2e assertion updates; existing informational suggestion only. |
| [Off-pin review](pins.json) | **79→80 / 86→87 / 60→60**. Only added paths are hook-boundary.ts in cache-bearing off exports; shared runtime/checker/guide changes, new supported settings/slots and metadata are reviewed. Frozen v1 unchanged. |
| [Preservation](preservation.txt), [before](docker-before.txt)/[after](docker-after.txt) | Seven root hashes, exact **34,001-byte** owner diff/modes and **42 container ID/name/state rows** preserved, including jeeves-postgres-1. Human uptime labels may advance. |

The first [broad test run](tests-initial.txt) exposed stale slot/default/wiring/gap expectations,
a policy test's millisecond-varying record oracle and an incomplete source-driver stand-in.
Those assertions remain exact; final tests use one controlled record and the emitted source helper
executes the actual read-only transaction. The first [standard check](check-initial.txt) passed
1,207 tests and failed two old string assertions for the constructor's inline TTL assignment;
both now assert its explicit TTL binding. The initial source-helper harness replaced only the first
of two local-bindings imports; replaceAll corrects that test loader. No runtime guarantee weakened.

The full browser failures were an obsolete unavailable-loader gap-text selector and the v2 rebuild's
exact empty diff against legacy absent freshness/exposure fields. The corrected rebuild asserts all
four exact new module/input rows and their immutable-positive/HTTP values, retaining full equality;
its evidence names those explicit legacy defaults separately. Historical fixtures/evidence remain
unchanged. No Board source, timeout or unrelated mouse assertion changed.

Only RG13 text logs normalize trailing whitespace/final blank lines and elide very long data-URL
stack lines; original command output remains under /tmp/jeeves-rg13-*.txt. Native Valkey/shared
process/transport/login proof remains **RG14**. RG11 Lua scripts are unchanged; their prior exact Lua
proof is not relabelled native evidence. No new provider/dependency, benchmark, cache DSL, generated
system Docker checkpoint, owner port, live/paid call, later unit, push or deployment.
