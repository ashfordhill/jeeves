# YV2-06 durability evidence

This unit emits transaction, outbox and receipt-with-effect dependencies, with no business
template/service/normal control installed. [Actual APIs and limits](../../youtube-v2/interfaces.md#yv2-06--transactional-delivery-and-receipt-dependencies).
Scratch exports, adapters and raw logs are in `/tmp/jeeves-yv2-06/`; no credential or private
runtime is retained here. No field v2 app, v1 file/asset/runtime/input or root README changed.

## Offline and standalone

Three focused offline cases execute the exact emitted modules using real PGlite 0.5.9 with a
thin query/result adapter. The generator dev dependency reuses the existing server's exact pin;
no new package version/runtime dependency is introduced. Cases cover state+intent rollback;
receipt+effect+intent rollback/replay and identity conflict; caught SQL/atomic-hook failures
still refusing commit; validated transport-timestamp drift projected to stable business identity;
bounded due batch/backoff; confirm-before-mark; and stop/drain while confirmation is admitted.
These tests need no Docker, PostgreSQL server or network. No fake SQL interpreter or broad fault
matrix was added. The initial failed run exposed PGlite SELECT affectedRows=0; the thin adapter
now maps returned rows/affectedRows to pg rowCount. The actual module SQL was unchanged by that fix.

Two fresh deterministic 40-file scratch exports include a diagnostic trusted contribution for
`ledger_private.intents`, `receipts` and `balance` through actual YV2-04 migration/login/grant
hooks. Its selected SQL binding is metadata-db/upload; document-like payloads and logical
destinations use no video contract. This fixture claims no installed semantic implementation.
Own frozen installation/build passes with the unchanged standalone lock. A separate custom
scratch `DocumentEffect` TypeScript adapter compiles against `Tx`, outbox and receipt APIs;
it is not an emitted product implementation or field-app change. Final regenerated exports
recompile the formatted sources; the actual probe used the same implementation before
formatting-only and registry dependency metadata amendments.

## Bounded actual SQL/broker smoke

Recorded before startup: owned project **jeeves-yv2-06-durability**, loopback PostgreSQL 45240,
RabbitMQ 45241, reserved foundation HTTP/identity/object trio 45242/45243/45244. All were free,
and no existing scratch namespace was reused. Only pinned emitted local-postgres/local-broker
services ran. Host-side setup applied actual emitted hash-tracked migrations and explicit grants;
this is a direct module integration probe, not a full first-run/restart or app-readiness claim.

The actual foundation runtime login (`r_metadata_db__upload`) performed all application SQL.
It had explicit SELECT/INSERT/UPDATE only on the three schema-qualified probe tables. CREATE
and ungranted receipt DELETE refused. Setup/admin credentials stayed separate from the runtime
pool; no migration owner was used as an application login.

`probe.log`/`probe-summary.json` record rollback leaving no state/intent/receipt, successful
effect replay once despite validated timestamp drift, failed-confirm deferral without sent mark,
and two concurrent pg connections demonstrating `SKIP LOCKED` on the admitted relay row.
The real YV2-05 RabbitMQ publisher confirmed a message; a narrowly injected pre-COMMIT error
then caused real SQL rollback. The next bounded relay confirmed another copy of the same
stable `document:1` ID. Both actual queue deliveries committed through the receipt helper:
one downstream SQL effect, with the duplicate returning the recorded result. This demonstrates
the at-least-once crash window, not an atomic SQL/broker or exactly-once guarantee. Publisher
failure was explicitly injected; no claim of network partition/reconnect coverage follows.

## Cleanup and compatibility

Scoped all-profile Compose shutdown removed the exact two scratch containers, two volumes and
network. No scratch image was built. Ignored private `.runtime` was removed; all five loopback
ports were released. `cleanup-summary.json` records no remaining owned resource, and all fourteen
owner v1 services healthy. Other projects/data were not stopped or reset.

Frozen v1's complete 108-path/hash list remains byte-identical, including manifest SHA
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Required final Jeeves check/native E2E/web-build results are in the handoff. No normal studio UI
changed; native browser coverage retains TinyURL lane rendering and mouse/generation behavior.
