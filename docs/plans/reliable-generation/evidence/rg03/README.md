# RG03 — operation budgets and uncertain effect outcomes

**Implementation verified; awaiting coordinator acceptance.**

Baseline: accepted RG02 `ac2113b2ec742cf93588385e1b9c48ffab3cc0e2`. This unit changes the
installed extension API to **v3**; saved diagrams, frozen v1 and historical exports are preserved.
No later mechanism, new provider, provider/cloud test or generated-system checkpoint ran.

## Implemented contract

- Runtime-owned `OperationContext` carries bounded request/correlation identities, immutable
  verified caller facts, a live signal and `remainingMs()`. Local monotonic timestamps stay
  private. HTTP accepts only a remaining duration (`x-jeeves-remaining-ms`), clamped by its own
  configured maximum; correlation is independent (`x-correlation-id`). Disconnect and process
  stop cancel the context. Stub requests and queue messages expose it through the checked API;
  existing in-process stub calls retain the active context and refuse late dispatch.
- Templates and stubs share the operation helper through actual PostgreSQL, transaction, cache,
  AMQP, Pub/Sub, object/search and verified-identity adapters. HTTP/broker callbacks explicitly
  retain their process scope. Adapters refuse expired/cancelled contexts before dispatch and
  recheck after SQL connection acquisition and before transaction statements/COMMIT. Native
  `EPIPE`/`ECONNRESET` are not mistaken for authoritative SQLSTATE failure.
- `OperationError`/`OperationFailure` distinguish `refused`, `definite-failure` and `unknown`.
  Mutation timeout, lost publish confirmation and lost COMMIT response remain unknown. A
  successful later ROLLBACK does not prove an earlier COMMIT failed. SQL connection ownership,
  poisoned-transaction checks and known serialization/deadlock retries are retained; ambiguous
  COMMIT discards its connection and never reruns the product callback automatically.
- Driver promises remain tracked after a caller race ends. A transaction keeps its reserved
  connection until final settlement, and timed-out publishers keep their capacity slot until
  the real operation settles. Process drain waits for underlying work inside RG02's existing
  ten-second final termination bound. Fetch/S3/OpenSearch receive supported cancellation;
  PostgreSQL/amqplib/Pub/Sub promise APIs and shared Jose JWKS work are not falsely labelled
  cancelled. One identity caller cannot cancel another caller's shared key-set fetch.
- Both publishers preserve stable message identity and validated attributes: at most 32 entries,
  64-byte safe names, 1024-byte values, 8192 total bytes; identity is 1–128 safe ASCII characters.
  Runtime identity/correlation fields are reserved. Each delivery gets a fresh **30-second**
  execution budget, ignoring any originating HTTP deadline. Correlation may survive independently.
- Private legacy target transport enforces its configured origin (including credential/URL checks),
  manual redirects, finite safe product headers and a **64 KiB** streamed response bound. Mapping
  cannot supply Authorization/Cookie credentials. Mutation response overflow/transport uncertainty
  remains unknown. There is no automatic provider-mutation retry. Public SQL, arbitrary targets
  and new authenticated service calls remain selection-specific unavailable gaps.
- Unknown queue effects take the existing terminal `.failed` path with `OUTCOME_UNKNOWN` rather
  than the current runner's retry/store-wait branch. This is not a durable recovery mechanism:
  broker redelivery/crash during terminal handling can still repeat an unguarded Custom effect.
  Existing outbox event publication remains explicitly at least once with stable durable event
  identity. That transport behavior does not establish provider mutation recovery or once-only
  Custom effects. Unsupported unguarded effects retain their required custom gaps.

API v2-to-v3 updates refuse without explicit acknowledgement. The export's `.jeeves/extensions.md`
describes migration of application-created request/message DTOs to the received context; no hook
body is rewritten. A real v2 manifest refusal test preserves every target byte. Existing staged
TypeScript/boundary migration checks remain in place.

## Deterministic behavior evidence

Tests execute emitted adapters, with recording drivers and real offline PGlite where appropriate:

- A one-second request refuses subsequent SQL, cache, publish and module dispatch without driver
  calls; a later healthy cache request uses the same single Redis generation without destruction.
  A template pool that acquires a connection after expiry sends no SQL and releases it.
- A timed-out COMMIT retains its connection through the late response and process drain; a lost
  native COMMIT response remains unknown even when ROLLBACK answers. The callback runs once.
  Native EPIPE on a standalone template query is unknown and discards the connection.
- Late AMQP and Pub/Sub confirms stay pending through close/drain and are never republished by
  the adapter. Actual AMQP headers and Pub/Sub attributes preserve the supplied values/identity;
  invalid, reserved, over-count and oversized attributes refuse before either transport sends.
- The AMQP fake follows the pinned driver's **confirm callback before adapter close listener**
  order. Only an explicit broker NACK is definite failure; a closed-channel confirm is unknown.
- Queued work executes with a fresh budget after the original request has expired. Both stub and
  template failure paths classify unknown effects terminally, including a socket-error cause.
- HTTP on real Fastify clamps the forwarded budget, exposes authenticated caller facts and aborts
  the supported downstream signal. Existing real-socket disconnect checks continue to pass.
  Target tests refuse origin/auth overrides, preserve manual redirects, bound response data and
  show a POST overflow is unknown without another fetch.
- Concurrent short/long identity calls share key-set work: expiry refuses new verification,
  bounds the first wait, and allows the other caller to finish. No per-caller JWKS abort is sent.
- A real child with an unresolved underlying driver promise terminates at a shortened final drain
  bound with `shutdown-deadline`; this is not a cancellation/rollback proof.

Pinned SDK inspection used the installed sources/types, not provider calls: amqplib **2.2.0**
`lib/channel.js` (`close`, `nack` callback order), Pub/Sub **6.3.2**
`build/src/publisher/{index,message-queues}.js` and Google GAX `CallOptions`. Publish retry is
explicitly `retry: null, maxRetries: 0`; S3 **3.1156.0** uses `maxAttempts: 1`; OpenSearch **3.9.0**
uses `maxRetries: 0` and its abortable request. PostgreSQL **8.23.1**, Redis **6.3.0**, Jose
**6.2.13** and the package/lock assets retain their existing exact versions.

## Checks and regeneration

All commands use Node **24.21.0**. Required checks pass.

| Check | Actual evidence |
| --- | --- |
| Required `pnpm check` | Exit 0: Biome, every package typecheck, **121 files / 1,097 tests**. `/tmp/jeeves-rg03-check-final4.log`; preceding full runs 2/3 also passed before the final meaningful corrections. |
| `pnpm test:e2e` | Exit 0, **74 passed (5.6 min)**. `/tmp/jeeves-rg03-e2e.log`. |
| `pnpm --filter @jeeves/web build` | Exit 0; existing chunk-size warning. `/tmp/jeeves-rg03-build.log`. |
| Focused adapter/regression run | **188 passed**, eight files. `/tmp/jeeves-rg03-focused-final.log`. |
| Identity/client focused run | **82 passed**, two files. `/tmp/jeeves-rg03-identity-targeted.log`. |
| Final client correction | **69 passed**, one file, including expired-cache reuse and native SQL EPIPE. `/tmp/jeeves-rg03-clients-final.log`. |
| Final AMQP callback-order correction | **12 passed**, one file. `/tmp/jeeves-rg03-amqp-final.log`. |
| Fresh standalone exports | Five real scratch exports pass the boundary checker and pinned TS **7.0.2**: sign-in **79**, search **80**, Favorites **63**, video **115**, stubs **85** files. After the last AMQP correction the affected video/stub exports pass again. [Compiler output](emitted-compile.txt), [fixture records](fixtures.json). |
| Reviewed processes-off pins | **77→78, 83→84, 58→59**. Exactly one new runtime file, `src/runtime/operation.ts`; changed metadata/guide/public API and relevant adapters are listed in [pins](pins.json). No frozen-v1 change. |

Initial focused runs found unsupported Node strip-only parameter syntax in the new helper, genuine
adapter integration defects and old exact API/error/response assertions; these were corrected.
The first full regression run exposed the remaining exact v3 metadata/file/call assertions.
A later full run had **13 loop test failures** because its fake ProcessScope lacked the mandatory
live signal now used by explicit scope capture. Adding that signal preserved all runtime checks;
the exact loop suite then passed **28/28**. Required full checks were rerun for the remaining failed
regression and later meaningful SQL/identity/AMQP source corrections, not to retry successful tests
until green. No assertion, timeout, lint rule or runtime guarantee was weakened. Browser/build
successes were retained after private runtime-only corrections; authoring commands/descriptions
were unchanged, so no extra offline/live chat eval ran.

The existing e2e app loaded and rendered TinyURL, exercised the generation preview/download/tamper
flow by mouse, and completed both YouTube mouse build studies. No owner studio process was used.
Scratch exports were removed in `finally`, with existing dependencies symlinked read-only; no
install or historical export edit occurred. Driver: `/tmp/jeeves-rg03-compile.ts`.

Root hashes match the coordinator's preservation snapshot; the owner's binary diff is identical.
Docker inventory remains only `c0fbbc2996fe jeeves-postgres-1`, PostgreSQL 17 Alpine on
`127.0.0.1:54329`. No new task Docker resource, push or deployment occurred. The unit stops at one
explicit-path local commit for coordinator acceptance; no next unit starts here.
