# Template gaps

Generated files are never edited by hand (AGENTS.md). When a field project needs something a
template can't do, add a row here and say what the application did instead. A unit that closes a
gap changes its Status.

| # | Gap | Found | Status |
| --- | --- | --- | --- |
| 1 | Multipart's status, list and complete can't carry the video's state; complete answers 200, not 202 | v3 (V3-13) | Open |
| 2 | A completion stopped by a failing hook fails the next start, with no reason | v3 (V3-13) | Fixed in PF08 |
| 3 | The outbox relay retries a failing codec silently, for ever | v3 (V3-13) | Open: still retried for ever, now logged (PF06) |
| 4 | Lifecycle and Transcoder hooks get no key prefix | v3 (V3-13) | Open |
| 5 | A hook that throws while the Transcoder reports a failure stops the Transcoder | v3 (V3-14) | Fixed in PF08 |
| 6 | A stub's queue publisher can't name its message ID | v3 (V3-15) | Fixed in V3-18 |
| 7 | The cache read's 404 can't be shaped from its hooks | v3 (V3-15) | Open |
| 8 | The export serves no browser and has no place for one | v3 (V3-16) | Open; v3 edits four scaffold files instead. UI is outside Jeeves for now. |

Details of 1–8: [YouTube v3 notes](../field-projects/youtube/v3/notes/README.md#template-gaps-found-while-completing-app).

## Known limits

Found in the 2026-11-12 review. Each is a fixed policy inside a template.

| Limit | Status |
| --- | --- |
| The cache read turns its cache off for the life of the process after one stalled cache call | Fixed in PF07 |
| The event counter keeps one receipt row per event for ever | Open |
| The outbox relay sends at most 10 rows about once a second | Open |
| A process that loses its broker exits and is not restarted | Fixed in BR01 |
| Host names are compiled into the export for local Compose | Fixed in QG06: endpoints come from the environment; values are deployment |
| Object storage and search endpoints are still compiled into the export (`local-objects`, `search-<id>`) | Open; a later unit can extend QG06's convention |
| Database and cache clients had no TLS options, and `pg` silently followed `PGSSLMODE`; nothing refused a plain-text endpoint in production. Found in QRWTY's Q03 | Fixed in QG10: `_TLS` is `disable` or `verify-full` (optional CA file and certificate name), and `JEEVES_REQUIRE_TLS=true` refuses plain-text databases, caches, tile and sign-in URLs and the Pub/Sub emulator at startup |
| The broker (RabbitMQ), object storage and search connect in plain text, and `JEEVES_REQUIRE_TLS` doesn't refuse them; `migrate.mjs` still follows `PGSSLMODE` | Open; QRWTY uses none of the three |
| A template's database pool (`pool` in `service-resources.ts`) has no error listener, unlike a stub's: when PostgreSQL ends its idle connections the process exits, and `pnpm start` brings it back. Seen for the Event counter in GS07 | Fixed in SO01 |
| A mounted template retries a failed message at once (stub loops wait 250 ms doubling): during a store outage a worker whose process stays up could use its retries in moments and send accepted messages to `.failed` | Fixed in SO01: an unreachable store waits 5 s and keeps the attempt |
| A query on a stalled (not stopped) database never settles: PostgreSQL enforces `statement_timeout` itself, so a paused server can't, and the pool set no client-side bound; the pool's drain waited on that connection too. Seen in SO03 (open item 3) and probed in QRWTY's Q03 review | Fixed in QG17: a query with no reply 500 ms past its statement timeout rejects `Query read timeout`, the pool discards that connection and a drain doesn't wait on it. That error isn't an unreachable store, so a worker's message spends an attempt |
| During a long database stall, discarded connections' sockets stay open: pg destroys a timed-out query's socket only in pipeline mode, so each closes when the network recovers (FIN) or TCP gives up. Sockets can accumulate during the stall and return to baseline after it | Open (pg's behaviour) |
