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

RG09 fixes the missing workload-identity boundary for new generated route-stub service calls
through API8: dedicated local service accounts, scoped caller handles and operation allowlists.
Missing issuer setup refuses export even on private networks. Installed-template cross-process
adapters and arbitrary external HTTP adapters remain explicit gaps. Existing issuer/client
updates require reviewed provisioning; realm import does not update an existing realm. Native
two-service authentication is a later RG14 evidence case, not established by these unit fixtures.

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
| `JEEVES_REQUIRE_TLS=true` accepted `NODE_TLS_REJECT_UNAUTHORIZED=0`, which turns off certificate checks for every client that leaves them to Node (`fetch`, the sign-in's key set). Found in QRWTY arm A's Q04 (AG-02) | Fixed in QG30: under the switch it must be unset or `1` |
| Configuration was checked one client at a time between probes, so a store that was down hid a wrong setting (named in 15 of 96 starts). Found in QRWTY arm A's Q04 (AG-01) | Fixed in QG31 for stubs' clients and the sign-in; a template's own clients still read theirs as each is built |
| The broker (RabbitMQ), object storage and search connect in plain text, and `JEEVES_REQUIRE_TLS` doesn't refuse them | Open; QRWTY uses none of the three |
| `migrate.mjs` couldn't verify a private CA: `pg` mapped `PGSSLMODE` to TLS against Node's roots with the host name checked, or to none, and didn't read `PGSSLROOTCERT`; nothing refused a plain-text migration. Found in the QGR2 review | Fixed in QG29: `JEEVES_MIGRATE_TLS` is `disable` or `verify-full` (optional `JEEVES_MIGRATE_CA_FILE` and `JEEVES_MIGRATE_TLS_SERVERNAME`), `PGSSLMODE` can't change it, and `JEEVES_REQUIRE_TLS=true` refuses `disable` unless `PGHOST` is a socket directory |
| A Cloud SQL server certificate whose only name is `<project>:<instance>` can't be checked by `_TLS_SERVERNAME`: Node's host-name check needs a DNS name. Reach such an instance by its Unix socket directory (`JEEVES_DATABASE_<ID>_HOST=/cloudsql/<instance>`, which `JEEVES_REQUIRE_TLS` accepts) or give it a CA whose certificates carry DNS names. Found in the QGR2 review | Open (Node's check) |
| A non-superuser migration admin must hold `ADMIN OPTION` on each database owner role it didn't create: the role's creator runs `GRANT <owner> TO <admin> WITH ADMIN OPTION` first, else `migrate.mjs` stops at `permission denied to grant role "<owner>"` before any database statement. Found in the QGR1 review | Open (PostgreSQL's rule; one statement for the deployer) |
| A template's database pool (`pool` in `service-resources.ts`) has no error listener, unlike a stub's: when PostgreSQL ends its idle connections the process exits, and `pnpm start` brings it back. Seen for the Event counter in GS07 | Fixed in SO01 |
| A mounted template retries a failed message at once (stub loops wait 250 ms doubling): during a store outage a worker whose process stays up could use its retries in moments and send accepted messages to `.failed` | Fixed in SO01: an unreachable store waits 5 s and keeps the attempt |
| A query on a stalled (not stopped) database never settles: PostgreSQL enforces `statement_timeout` itself, so a paused server can't, and the pool set no client-side bound; the pool's drain waited on that connection too. Seen in SO03 (open item 3) and probed in QRWTY's Q03 review | Fixed in QG17: a query with no reply 500 ms past its statement timeout rejects `Query read timeout`, the pool discards that connection and a drain doesn't wait on it. That error counts as an unreachable store (QG18), so a worker's message waits 5 s and keeps its attempt |
| During a long database stall, discarded connections' sockets stay open: pg destroys a timed-out query's socket only in pipeline mode, so each closes when the network recovers (FIN) or TCP gives up. Sockets can accumulate during the stall and return to baseline after it | Open (pg's behaviour) |
| No installed external-API client: a stub's link to an External API or an Identity answered "Not implemented", so an application wrote its own `fetch` adapter (GS review; QRWTY's Q03) | Fixed in QG20: an External API's stub gets `externalTarget`, an HTTP client at `JEEVES_EXTERNAL_<ID>_URL`, which the application sets, and an Identity a sign-in binds `identityTarget`, at `JEEVES_IDENTITY_<ID>_URL`. Each passes the stub's `init` through, so the stub sets its timeout and its own credential |
| Locally a stub's Identity client couldn't reach Keycloak: its base was `OIDC_ISSUER`, which `compose.yaml` sets to the issuer the browser sees and a sign-in compares tokens with, `http://127.0.0.1:$LOCAL_IDENTITY_PORT/realms/<id>`; inside a container that address is the container itself, so the call was refused (a loop waited, a route answered 503). Found in QG20's proof | Fixed in QGR2: the client's base is `JEEVES_IDENTITY_<ID>_URL`, the Identity as the process reaches it, which `compose.yaml` sets to Keycloak's address inside the network, `http://identity-<id>:8080`; a deployment sets its issuer's origin or another address its processes reach |
| The edge passes a request's headers to its process as the client sent them, except `Host`, which nginx sets to `app-<id>:3000`: an `X-Forwarded-For` is the client's own claim, and nothing tells a process the client's address or the host it asked for. An application that needs either (a rate limiter by address, say) puts its own trusted edge in front of `app-<id>:3000`, as QRWTY does. Found in QRWTY's Q03 (F22); a Jeeves limit by its review | Open: the edge sets no forwarded headers. Clearing inbound `X-Forwarded-*` and setting `X-Forwarded-For` from `$remote_addr` is right only where the edge is the first hop, so it waits for a decision on which hops a deployment trusts |
| A cache's password is read once from its secret file and sent on every connection, so a managed cache's token authentication can't be used (Memorystore for Valkey's IAM tokens expire an hour after they are fetched). Such a cache runs with authentication off, reachable only on a private network, with `verify-full`. Found in QRWTY arm A's Q04 (AG-04) | Open; deferred until a field project needs it: a credentials provider that fetches a fresh token per connection, selected by a variable |
| Pub/Sub topic and subscription names are the design's IDs (`<topic>`, `<topic>--<tile>--<module>` and its `.failed`), compiled into the process files and `infra/local.json`, as database, login and bucket names are, so two deployments of one design can't share a Google Cloud project. Found in QRWTY arm A's Q04 (AG-05) | Open; a later unit can read the names from the environment as QG06 reads endpoints |
| `migrate.mjs` creates every provider database and login in `infra/local.json`, the local Keycloak's included (for Identity `identity`: `i_identity`, `io_identity`, `ik_identity`), also where a deployment uses a managed issuer: one unused database, and two secrets the migration job must still be given. Found in QRWTY arm A's Q04 (AG-06) | Open (harmless; give the two secrets random values) |
| Credentials were read from one directory only, `SECRET_DIR/<name>`, and Cloud Run mounts each secret at its own path. Found in QRWTY arm A's Q04 (AG-03) | Fixed in QG34: `JEEVES_SECRET_<NAME>_FILE` names a credential's file |


## Reliable-generation runtime boundary (RG03)

Operation budgets/cancellation and typed refused/definite-failure/unknown outcomes now reach
installed template and stub adapters. Queue identities/attributes are bounded; delivery gets a
fresh execution budget. Private legacy target transport is destination/body/header bounded, but
raw SQL and authenticated target handles remain unavailable; RG07 installs registered product SQL
on declared stub database links with product-only credentials and READ ONLY queries. Template
loaders without that binding remain explicit selection-specific gaps.
Unknown effects go to the existing terminal queue path without intentional runner replay. This
does not prevent broker redelivery after a crash; unguarded Custom external effects still require
an installed recovery/idempotency capability. No provider/cloud or once-only-effect certification
is claimed. [Unit evidence](plans/reliable-generation/evidence/rg03/README.md).

## Versioned product state (RG07)

New exports replace re-runnable module files with ordered checksummed migrations and one
protected namespace history, with restricted product DDL roles and actual database denials for
protected state. Registered parameterized operations remain inside compiled ownership/grant and
module-link maxima. There is no arbitrary SQL handle or schema designer. Existing SQL requires
a reviewed external baseline and explicit API v7 migration; no automatic data conversion occurs.
Real concurrent migration/login proof remains RG14.

## Local operation replay (RG10)

The new public `defineLocalOperation` boundary binds one writable stub database before startup.
HTTP and generated same-process calls authenticate the account, validate canonical identity,
recover committed results before new-work admission, and commit registered product commands with
private replay storage. Secret responses use private purpose-bound sealing keys. Scoped commands
run under the product-only role; captured database/network handles cannot escape that callback.
Retention cleanup starts with the configured runtime and removes only bounded expired committed
records. Cross-database atomicity, payments and durable external effects remain unavailable here;
real simultaneous PostgreSQL contention remains RG14. [Evidence](plans/reliable-generation/evidence/rg10/README.md).

## Atomic cache runtime (RG11)

Private Valkey primitives now provide a bounded single-key rolling admission log on store time
and exact unsigned-decimal version comparisons with absolute expiry. Queue saturation refuses
without disconnecting a healthy client; unknown mutations never retry automatically. Public
stub `CacheClient` remains unchanged: callable admission and mutable cache-reader policies are
not exposed by RG11. Optional immutable-cache fallback remains separate. Version fences last
while a key is retained, not across cache eviction, expiry or data loss. Native competing-client
and store recovery proof remains RG14. [Evidence](plans/reliable-generation/evidence/rg11/README.md).
