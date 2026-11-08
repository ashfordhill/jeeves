# YV2-07 owned upload persistence evidence

This unit implements a generic SQL upload repository and application hooks, not the signed
multipart engine. [Actual interfaces and boundaries](../../youtube-v2/interfaces.md#yv2-07--owned-upload-persistence-and-application-hooks).
It registers `local.upload-state` as a dependency only; no multipart template, route, application
service, normal control or readiness claim is installed. YV2-08 owns transport integration.

## Offline durable state

Four focused cases run the exact emitted modules and migration SQL in real offline PGlite,
using a thin pg query/result adapter. There is no Docker, network or external Postgres dependency
in unit tests. The migration runs with no video table, application foreign key, title or channel.
The adapter uses PDF file metadata and an unrelated `attachments_private.transfers` table.

- Reservation + application metadata rollback together, including when the caller catches the
  failed hook. Owner/key fields in raw input cannot replace the verified subject or server-bound
  UUID/key. Foreign-owner lookup/provider mutation/list refuse. UUID lookup normalizes case;
  a repeated start intentionally creates new identities. DB expiry remains the fixed 24 hours.
- Completion hook + pending document state + outbox intent rollback together on hook or response
  validation failure. A provider-completing record remains completing with its provider ID after
  failure. Valid completion commits one intent and a stored response; replay, including after
  expiry, retains that response and does not rerun the hook. Foreign owner and mismatched source
  fingerprint refuse. No broker/network effect is presented as transactional.
- Terminal hook failures poison and roll back the same transaction. Aborted/expired/failed
  records refuse completion. Early expiry refuses; expired close uses DB time. Completing and
  old-initiating records appear in bounded reconciliation; incomplete reopens; cleanup flags
  persist until explicit acknowledgement. Cleanup/interrupted methods are privileged internal
  operations, never owner-selectable public routes.
- Actual dependency output/provenance, unsafe SQL-name refusal, exact migration/login/relation
  grants and unfinished registry support are checked through the real assembler/foundation.

The stored metadata/response codecs validate normalized, non-null JSON snapshots on write/read;
undefined, nonfinite values and classes/dates refuse, and codecs must round-trip stably. Hooks
receive detached records. Complete/closed hooks see the pretransition state under its row lock.
YV2-09 can use these hooks for lifecycle state and durable job intent without editing upload core.

## Standalone output and compatibility

Two fresh deterministic **43-file** scratch exports use the actual `ownedUploadPersistence`
helper through a disposable diagnostic contributor. The actual emitted upload migration and
schema-qualified SELECT/INSERT/UPDATE login grants are composed by the foundation. Document
state and outbox are separately contributed, with no fake installed feature attestation.
Own unchanged frozen-lock installation and untouched output build pass. A separate typed
`DocumentTransfer` PDF metadata/reservation/completion/terminal adapter compiles against the
actual emitted `VerifiedPrincipal`, `Tx`, repository and outbox interfaces. It emits no YouTube
contract import or title/channel field and is scratch validation, not a new product or field app.

Frozen v1's complete **108-path/hash list** remains identical, including manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
No v1 app/input/runtime/fixture, local-v1 asset, dependency pin/lock or root README changed.
Logs, fresh exports and typed adapter are under `/tmp/jeeves-yv2-07/`; final required Jeeves
check/E2E/web-build results are recorded in the handoff. An initial check overlapped the browser
run and had one existing undo/redo test exceed its unchanged 5-second timeout; the final check
ran after browser/build work finished, with no timeout or assertion changes.

Final `pnpm check` passed lint/types and **430 tests / 59 files (40.08s)**. Native
`pnpm test:e2e` passed **36 tests (2.7m)**; web build passed **5.36s**, with the existing
chunk-size advisory. Logs are `check-final.log`, `e2e.log`, `web-build.log`,
`export-verified.log`, `install-verified.log`, `build-verified.log` and
`build-adapter-verified.log` under the scratch directory above.

## Resource scope and limits

No new provider stack, private runtime, secret, port or Docker volume was created. No external
PostgreSQL grant/provider-network/S3 behavior is claimed by this persistence unit; actual
foundation wiring is emitted and offline PostgreSQL-compatible state SQL is exercised. The next
unit must run the real multipart provider smoke. All fourteen owner `jeeves-youtube-v1` services
were observed healthy after verification; other services and owner dirty files remain untouched.
No normal studio UI changed; native browser coverage retains TinyURL lane rendering, mouse
actions, history and generation behavior. No YV2-08 implementation or v2 field app was started.
