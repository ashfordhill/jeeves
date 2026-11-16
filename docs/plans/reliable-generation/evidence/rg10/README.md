# RG10 — local mutation and replay ownership

Built on accepted RG09 `1bc45e0077b106d810df0138e6e878207c35602e`. Extension API remains
**v8** with additive local-operation and finite service-key support. No ordinary inspector field,
provider, dependency, payment or durable external-work feature is added.

A route stub exports `localOperation = defineLocalOperation(...)`: one declared writable database,
stable operation ID/version, explicit retention and secret flag, synchronous DTO validation,
new-work admission and a local mutation. The generated preconnection pass checks descriptor
identity, database binding, registered SQL, product/runtime credentials and private replay keys.
Missing private credentials refuse with zero constructed/probed clients. The HTTP entry uses the
operation's `route`; generated same-process links dispatch its `call` through the same core.
Authenticated internal POST callers supply the finite `ServiceTarget` `key` field, which maps to
`Idempotency-Key` without header/credential override authority.

The framework establishes the verified account subject and validates its bounded UTF-8 encoding,
then the key and DTO identity. Both raw and validated inputs receive the same bounded JSON
normalization: no shared references or signed zero, and stable object order. Absent and null root
inputs remain distinct in the new hash; legacy `requestHash` semantics are unchanged. Product
callbacks receive frozen DTOs and necessary immutable subject facts. Committed replay is recovered
before new-work admission; a transaction advisory lock and second lookup close the competing-start
window. Same identity returns the original status/body; changed input conflicts (409), a competing
holder is in progress (409), a retained expired row refuses (410), and invalid/unreadable replay
fails closed (503). Authentication and safe HTTP error/header behavior remain generated.

Product mutation and success replay use one reserved connection and transaction. The callback
receives registered same-database commands only, with SQL `RETURNING` for results. The private
runtime switches once to the existing product-only role for the whole callback. It closes scoped
handles, observes actual issued SQL and command promises, preserves the first transaction poison,
and validates/snapshots the complete result inside the denied effect scope before restoring the
framework role and storing replay. Body/status accessors refuse without evaluation. Concurrent
commands cannot interleave role resets. Caught SQL/name/parameter failures still roll everything
back. Sparse, undefined and accessor parameter slots refuse before SQL. Captured ordinary database
handles (including the same database) and service/queue/PubSub/cache/object/search/HTTP handles
cannot escape the mutation boundary, including through nested reads. There is no general retry
callback, raw SQL/control handle, cross-database transaction or automatic mutation retry.

Successful JSON bodies are bounded to 12 KiB, with mandatory codec/version/secret/retention
metadata. Secret bodies use private RG08 `jeeves.replay.v1` sealing keys bound to account and
operation/key/input identity. The private ring is snapshotted once before clients; no key or sealed
record reaches product hooks or framework logs. Retained-key rotation replays old records; removed
keys and cross-account ciphertext swaps refuse. Configure the private ring externally through
`JEEVES_SECRET_JEEVES_REPLAY_KEYS_FILE` or `SECRET_DIR/jeeves-replay-keys`, as described in the
generated guide. No credential/ring is checked in.

The historical 050 migration and existing records remain intact. Appended 051 adds nullable replay
metadata, while generated setup grants private runtime roles SET-only membership in their exact
product role. Public product-only credentials retain no protected-table access. Retention is
mandatory, 60 seconds through seven days, finalized with database `clock_timestamp()` at successful
storage. Runtime-owned cleanup starts without waiting for a request and runs every 60 seconds in
batches of at most 1,000 expired committed records, with advisory coordination and `SKIP LOCKED`.
Status-zero and locked active work are preserved. After cleanup removes an expired record, its key
is reusable; there is no deduplication promise beyond retention.

A lost COMMIT response remains unknown and discards that connection after actual settlement.
A later call with the same identity recovers the committed durable result without another local
effect. Existing RG03 transaction/driver tracking and bounded shutdown remain in place.

| Check | Actual result |
| --- | --- |
| [Final `pnpm check`](check.txt) | Node 24.21.0; Biome, all workspace type checks, **128 files / 1,171 tests passed**. Existing `local.mjs` informational suggestion only. |
| [Focused mechanisms](focused.txt), [emitted assignment](binding.txt) | Four mechanism suites **109 passed**, plus the emitted assignment case in the final local-operation suite **17 passed**. Includes PGlite SQL/role denials, replay ordering/conflicts/scope/rollback, deterministic lost COMMIT, rotation, expiry, no-traffic cleanup, effect isolation and canonical DTO cases. |
| [Full browser suite](browser.txt) | **78/78 passed**, including TinyURL, both complete mouse rebuilds, workload mouse paths and Preview. Uses 4301/4311 and `jeeves_e2e`, deleting its own projects. |
| [Web build](build.txt) | Passed; existing chunk-size warning only. |
| [Scratch checker/TS7](emitted-compile.txt), [runner](compile.ts) | Eleven variants pass: local operation **63**, keys **53**, no-stub **76**, Favorites **75**, video **125**, workload-only **55**, workload+user **59**, migrated stubs **96**, frozen v2 **79**, module design off **86**, stub stack off **60** files. Negative type proof refuses raw SQL/transaction/pool/private-key/scope/extra-callback APIs and retained workload/key escapes. |
| [Processes-off review](pins.json), [pin format check](pins-check.txt) | **79→79 / 86→86 / 60→60**, no added/removed paths. Payload changes are generated guidance/public finite key type, classified errors, effect/transaction guards and private settings. Frozen v1 unchanged. |
| [Preservation](preservation.txt) | Seven root hashes and exact **34,001-byte** owner binary diff/modes match supplied receipts. No protected history/export/root modification. |

The [application-owned fixture](../../../../../field-projects/generator-system/fixtures/rg-local-operation/README.md)
contains only backend scope and no frontend or LOC benchmark claim. Its actual input body and SQL
compile through the export checker. The same-process test executes the emitted dependency
assignment with real dispatch/core functions, not a reimplementation. The authenticated HTTP test
uses emitted Fastify service/route/user/workload guards with crypto-backed jose unit infrastructure
and intercepted fetch, then compares the same core's callable results. It covers malformed keys,
missing identities, conflict, replay after admission failure, absent/null identity and object
order/shared-reference/numeric parity. No live issuer or network service is used.

PGlite serializes its connections: concurrent identical promises and an injected lock refusal
prove the local states, **not native simultaneous PostgreSQL contention**. Real two-copy/Keycloak,
login and concurrent migration proof remain RG14. A deliberately installed invoker function proves
that hidden protected-table access still runs under the restricted product role; caught concurrent
failure leaves neither product data nor replay. This is no hostile JavaScript/SQL sandbox or
provider certification. No generated-system/Docker checkpoint occurred.

Early failures were exact migration/file/wiring expectations, fake import/configuration seams,
initial scratch TypeScript narrowing, a PGlite test connection's rollback trace and intentional
malformed-then test lint. They were corrected without weaker assertions/timeouts. Review added raw
and validated DTO normalization, account encoding refusal, sparse-parameter rejection, first-poison
preservation, whole-result accessor denial and an executed emitted binding. Browser/build evidence
is retained because later corrections affect private runtime behavior, not their exercised paths.
No authoring command or chat tool description changed, so offline chat evals were not rerun.

Scratch exports use read-only installed dependency symlinks and are removed in `finally`; no
install occurs. `docker ps` shows only the existing healthy `jeeves-postgres-1` on loopback 54329.
The recorded `docker ps -a` also includes historical stopped containers, all preserved. Task-owned
resource delta is zero; no cleanup/prune, owner 4300/4310 use, secret inspection, paid/live call,
cloud provisioning, push, deployment or later unit occurred. Commit subject:
`RG10: own replay ordering and local mutation atomicity`. Stop for coordinator acceptance.
