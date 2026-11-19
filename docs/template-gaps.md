# Template gaps

Generated files are never edited by hand (AGENTS.md). When a field project needs something a
template can't do, add a row here and say what the application did instead. A unit that closes a
gap changes its Status. The [foundation handback](plans/reliable-generation/owner-handback.md)
records current API8 mechanisms, finite evidence and migration limits. Older field apps/exports
keep their recorded runtime; a fixed generator gap does not mean those apps adopted the fix.

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
updates require reviewed provisioning; realm import does not update an existing realm. Selected
native two-service authentication cases pass in [RG14](plans/reliable-generation/evidence/rg14/review.md)
and [RG23](plans/reliable-generation/evidence/rg23/results.md); this is not production issuer certification.

Found in the 2026-11-12 review. Each is a fixed policy inside a template.

| Limit | Status |
| --- | --- |
| The cache read turns its cache off for the life of the process after one stalled cache call | Fixed in PF07 |
| The event counter keeps one receipt row per event for ever | Fixed in RG18: seven-day completed receipts, bounded idle cleanup and declared delivery horizon. Standalone checked consumers declare retention covering their horizon, up to30 days; no forever dedupe. |
| The outbox relay sends at most 10 rows about once a second | Open |
| A process that loses its broker exits and is not restarted | Fixed in BR01 |
| Host names are compiled into the export for local Compose | Fixed in QG06: endpoints come from the environment; values are deployment |
| Object storage and search endpoints are still compiled into the export (`local-objects`, `search-<id>`) | Open/deferred; no new adapter unit is queued |
| Database and cache clients had no TLS options, and `pg` silently followed `PGSSLMODE`; nothing refused a plain-text endpoint in production. Found in QRWTY's Q03 | Fixed in QG10: `_TLS` is `disable` or `verify-full` (optional CA file and certificate name), and `JEEVES_REQUIRE_TLS=true` refuses plain-text databases, caches, tile and sign-in URLs and the Pub/Sub emulator at startup |
| `JEEVES_REQUIRE_TLS=true` accepted `NODE_TLS_REJECT_UNAUTHORIZED=0`, which turns off certificate checks for every client that leaves them to Node (`fetch`, the sign-in's key set). Found in QRWTY arm A's Q04 (AG-02) | Fixed in QG30: under the switch it must be unset or `1` |
| Configuration was checked one client at a time between probes, so a store that was down hid a wrong setting (named in 15 of 96 starts). Found in QRWTY arm A's Q04 (AG-01) | Fixed for the guarded contract by RG02: template/stub configuration validates before opening clients, through one lifecycle (QG31/QL05 were the partial baseline) |
| The broker (RabbitMQ), object storage and search connect in plain text, and `JEEVES_REQUIRE_TLS` doesn't refuse them | Open; QRWTY uses none of the three |
| `migrate.mjs` couldn't verify a private CA: `pg` mapped `PGSSLMODE` to TLS against Node's roots with the host name checked, or to none, and didn't read `PGSSLROOTCERT`; nothing refused a plain-text migration. Found in the QGR2 review | Fixed in QG29: `JEEVES_MIGRATE_TLS` is `disable` or `verify-full` (optional `JEEVES_MIGRATE_CA_FILE` and `JEEVES_MIGRATE_TLS_SERVERNAME`), `PGSSLMODE` can't change it, and `JEEVES_REQUIRE_TLS=true` refuses `disable` unless `PGHOST` is a socket directory |
| A Cloud SQL server certificate whose only name is `<project>:<instance>` can't be checked by `_TLS_SERVERNAME`: Node's host-name check needs a DNS name. Reach such an instance by its Unix socket directory (`JEEVES_DATABASE_<ID>_HOST=/cloudsql/<instance>`, which `JEEVES_REQUIRE_TLS` accepts) or give it a CA whose certificates carry DNS names. Found in the QGR2 review | Open (Node's check) |
| A non-superuser migration admin must hold `ADMIN OPTION` on each database owner role it didn't create: the role's creator runs `GRANT <owner> TO <admin> WITH ADMIN OPTION` first, else `migrate.mjs` stops at `permission denied to grant role "<owner>"` before any database statement. Found in the QGR1 review | Open (PostgreSQL's rule; one statement for the deployer) |
| A template's database pool (`pool` in `service-resources.ts`) has no error listener, unlike a stub's: when PostgreSQL ends its idle connections the process exits, and `pnpm start` brings it back. Seen for the Event counter in GS07 | Fixed in SO01 |
| A mounted template retries a failed message at once (stub loops wait 250 ms doubling): during a store outage a worker whose process stays up could use its retries in moments and send accepted messages to `.failed` | Fixed in SO01: an unreachable store waits 5 s and keeps the attempt |
| A query on a stalled (not stopped) database never settles: PostgreSQL enforces `statement_timeout` itself, so a paused server can't, and the pool set no client-side bound; the pool's drain waited on that connection too. Seen in SO03 (open item 3) and probed in QRWTY's Q03 review | Fixed in QG17: a query with no reply 500 ms past its statement timeout rejects `Query read timeout`, the pool discards that connection and a drain doesn't wait on it. That error counts as an unreachable store (QG18), so a worker's message waits 5 s and keeps its attempt |
| During a long database stall, discarded connections' sockets stay open: pg destroys a timed-out query's socket only in pipeline mode, so each closes when the network recovers (FIN) or TCP gives up. Sockets can accumulate during the stall and return to baseline after it | Open (pg's behaviour) |
| No installed external-API client: a stub's link to an External API or an Identity answered "Not implemented", so an application wrote its own `fetch` adapter (GS review; QRWTY's Q03) | Historical QG20 installed private transport. Current API8 does not expose raw external/issuer HTTP, credentials or auth overrides to hooks; arbitrary external adapters remain gaps. Declared generated route-stub calls use authenticated scoped ServiceTarget instead (RG09/21) |
| Locally a stub's Identity client couldn't reach Keycloak: its base was `OIDC_ISSUER`, which `compose.yaml` sets to the issuer the browser sees and a sign-in compares tokens with, `http://127.0.0.1:$LOCAL_IDENTITY_PORT/realms/<id>`; inside a container that address is the container itself, so the call was refused (a loop waited, a route answered 503). Found in QG20's proof | Historical private transport corrected in QGR2. Current API8 issuer/session/workload adapters own transport; this is not a raw Identity HTTP handle supplied to product hooks |
| The edge passes a request's headers to its process as the client sent them, except `Host`, which nginx sets to `app-<id>:3000`: an `X-Forwarded-For` is the client's own claim, and nothing tells a process the client's address or the host it asked for. An application that needs either (a rate limiter by address, say) puts its own trusted edge in front of `app-<id>:3000`, as QRWTY does. Found in QRWTY's Q03 (F22); a Jeeves limit by its review | Open: the edge sets no forwarded headers. Clearing inbound `X-Forwarded-*` and setting `X-Forwarded-For` from `$remote_addr` is right only where the edge is the first hop, so it waits for a decision on which hops a deployment trusts |
| A cache's password is read once from its secret file and sent on every connection, so a managed cache's token authentication can't be used (Memorystore for Valkey's IAM tokens expire an hour after they are fetched). Such a cache runs with authentication off, reachable only on a private network, with `verify-full`. Found in QRWTY arm A's Q04 (AG-04) | Open; deferred until a field project needs it: a credentials provider that fetches a fresh token per connection, selected by a variable |
| Pub/Sub topic and subscription names are the design's IDs (`<topic>`, `<topic>--<tile>--<module>` and its `.failed`), compiled into the process files and `infra/local.json`, as database, login and bucket names are, so two deployments of one design can't share a Google Cloud project. Found in QRWTY arm A's Q04 (AG-05) | Open/deferred; names remain compiled and no new unit is queued |
| `migrate.mjs` creates every provider database and login in `infra/local.json`, the local Keycloak's included (for Identity `identity`: `i_identity`, `io_identity`, `ik_identity`), also where a deployment uses a managed issuer: one unused database, and two secrets the migration job must still be given. Found in QRWTY arm A's Q04 (AG-06) | Open (harmless; give the two secrets random values) |
| Credentials were read from one directory only, `SECRET_DIR/<name>`, and Cloud Run mounts each secret at its own path. Found in QRWTY arm A's Q04 (AG-03) | Fixed in QG34: `JEEVES_SECRET_<NAME>_FILE` names a credential's file |


## Reliable-generation runtime boundary (RG03)

Operation budgets/cancellation and typed refused/definite-failure/unknown outcomes now reach
installed template and stub adapters. Queue identities/attributes are bounded; delivery gets a
fresh execution budget. Private legacy target transport is destination/body/header bounded, but
raw SQL and arbitrary target handles remain unavailable; declared authenticated route-stub calls
use the scoped RG09/21 ServiceTarget. RG07 installs registered product SQL
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
a reviewed external baseline and explicit migration to current API8; no automatic data conversion
occurs. Real concurrent migration/login cases are recorded in RG14 and RG23; RG24 proves the
same-namespace repaired hook update and guarded catalog cold adoption, not live m_*→p_* conversion.

## Local operation replay (RG10)

The new public `defineLocalOperation` boundary binds one writable stub database before startup.
HTTP and generated same-process calls authenticate the account, validate canonical identity,
recover committed results before new-work admission, and commit registered product commands with
private replay storage. Secret responses use private purpose-bound sealing keys. Scoped commands
run under the product-only role; captured database/network handles cannot escape that callback.
Retention cleanup starts with the configured runtime and removes only bounded expired committed
records. Cross-database atomicity and payments remain unavailable. Durable external work uses the
separate RG15 protocol below. RG14/RG23 record actual simultaneous PostgreSQL contention. [Evidence](plans/reliable-generation/evidence/rg10/README.md).

## Atomic cache runtime (RG11)

Private Valkey primitives now provide a bounded single-key rolling admission log on store time
and exact unsigned-decimal version comparisons with absolute expiry. Queue saturation refuses
without disconnecting a healthy client; unknown mutations never retry automatically. Public
stub `CacheClient` remains unchanged: callable admission and mutable cache-reader policies are
not exposed by RG11. Optional immutable-cache fallback remains separate. Version fences last
while a key is retained, not across cache eviction, expiry or data loss. Native competing-client
and store recovery observations are recorded in RG14/RG23. [Evidence](plans/reliable-generation/evidence/rg11/README.md).

## Callable admission (RG12)

The Rate limiter is now an installed callable lead for Service/Uploads with a required shared
cache and Required Auth guard. It emits rolling-window decisions, protected denials/retry timing
and a pure verified-subject key hook. Custom/Data access admission handles can be called inside
RG10 new-work admission; replay returns first. Legacy unsupported choices remain preserved and
refused. Address trust is still unavailable; the earlier edge-trust gap remains open. Product key
policy and product caller bodies remain application work; RG14/RG23 record real competing-copy/outage proof.

RG12's public product cache wrapper reserves `jeeves:` before reads/writes/deletes, protecting
admission logs on shared clients. Ordinary keys remain supported; existing application keys under
that prefix need explicit migration. Immutable positive readers and admission refuse cache sharing
because their eviction contracts differ. This is a finite runtime/compilation boundary, not a
cache ACL provider or hostile-code sandbox.

RG13 closes the cache-only callable/source-loader gap: Custom and standalone Data access consume
`cache-reader.read@1`; source loading now uses registered read-only queries under existing RG07
declarations/grants. Immutable and finite versioned modes are explicit. Cache policies and SQL
remain application-owned completion work. Version fencing lasts only while the shared cache key
is retained; no durable watermark, immediate invalidation, stale-serving mode, L1/negative cache,
new provider or authenticated cross-process cache adapter is claimed. Native store cases pass in RG14/RG23.


RG14 review found that explicit HTTP cache-reader exposure on an internal service emitted an
alternate route without a workload-authenticated template adapter. This composition now refuses;
use the installed in-process reader behind an authenticated route stub. Public eligible-record
HTTP exposure remains supported. No cross-process template adapter was added. Native foundation
results and limits are recorded in [RG14 review](plans/reliable-generation/evidence/rg14/review.md).


RG14's native COMMIT-reply loss test found a PostgreSQL client lifecycle gap: pg-pool observes
idle errors, while a checked-out client can emit a later transport error after rejecting its
query. The generated factory now observes that error once per physical client so it cannot crash
Node before unknown-outcome recovery. Query rejection, discard, private replay and idle-pool
error handling retain their semantics. See the RG14 review for native evidence and limits.


RG14 also found that initialized readiness could stay successful while required admission
storage was known unavailable, contrary to the common contract. Private lifecycle availability
now drives HTTP and worker readiness, with bounded adapter-owned PostgreSQL/required-Valkey
health probes and recovery. Required AMQP/PubSub state and bounded safe object/search reads
use the same private readiness state. The installed Garage listener is private with no admin
credential or grant expansion. Optional cache fallback stays available. No new normal control,
provider, business retry or monitoring service was added; see the RG14 review for exact evidence.

RG16 closes the missing generated home for interval reconciliation in both Service and Worker.
The installed Scheduled task binding uses the accepted durable engine and common lifecycle,
DB-time interval identities, one unfinished tick across copies and a scoped product handler.
Queue-free timer Workers keep explicit logical ownership and precise credentials. Retry/fence
bookkeeping stays private. RG23 records actual same-Service remote holder replacement/fencing,
not interchangeable same-owner Worker authority. Cron/cloud/workflow scheduling and unsupported
remote authority/result cases remain unavailable.

### RG17 authenticated generic inbox

RG17 closes generic HMAC accept/store/process through the existing protected052 durable work engine. Generated verifier and acceptance remain private; the separate pure mapper and scoped completion body are product work. Stripe/other provider signatures/SDKs, arbitrary verifier hooks, public replay/admin UI, independent receiver-to-Worker handoff and forever dedupe remain unsupported. Completed retention is seven days; remote authority/checkpoint limits remain RG15’s. [Evidence and protocol](plans/reliable-generation/evidence/rg17/README.md).

RG21 closes request-scoped Browser session forwarding for declared matching-Identity bearer-guard
callee route operations. Generic POST remains unretried: an arbitrary key does not establish a
callee replay/recovery contract. HTTPS/client/audience registration remains required integration
work. See [the exact forwarding boundary](plans/reliable-generation/evidence/rg21/protocol.md).

RG25 found two stale API7 acknowledgement commands in the generated API8 SQL migration guide.
The assembler now uses the emitted target version; a regression checks every acknowledgement
command in the actual extension guide against its manifest. Runtime and exported README bytes
are unchanged. [Independent review](plans/reliable-generation/evidence/rg25/review.md).


## Durable recovery and session limits

Durable work uses explicit workload-only operations, separate replay scope, stable work identity
and a selected callee-owned expiring ticket across holders. Required-user guards stay required.
Ticket/replay expiry never grants replacement execution; unresolved outcomes remain unknown for
reconciliation. A same-owner Worker cannot replace another compiled process identity's remote
authority. Declared secret remote-result checkpoints refuse before execution. No stored user
bearer, delegation, arbitrary provider adapter or exactly-once external-effect promise is added.
[Approved amendment](plans/reliable-generation/evidence/rg15/authority-decision.md) ·
[Native recovery and limits](plans/reliable-generation/evidence/rg23/results.md).

Browser sessions/refresh/forwarding are installed under API8 with immutable product facts and
private sealed tokens. Trusted HTTPS/client registration is required. Unknown rotation may need
sign-in, and POST/product/workload failures do not trigger automatic user refresh/replay.
[Final review](plans/reliable-generation/evidence/rg25/review.md) records exact selected evidence.

The original evaluation overstated bounded drain. Current generated shutdown has a final
10-second stop deadline, independently observed in RG14/RG23; the original evaluation and old
apps are preserved. Compatible stable-ID API8 stopped updates preserve hooks/data/session promises
and pending work as recorded in [RG24](plans/reliable-generation/evidence/rg24/migration.md).
No QRWTY rebuild, live legacy namespace conversion or rolling mixed-version proof is claimed.

## QRWTY contract limits in the proposed diagram

| Product requirement | Installed boundary and proposed treatment |
| --- | --- |
| Stripe-signed bodies up to 256 KiB and 35 days of completed-event deduplication | The generic receiver verifies Jeeves HMAC envelopes up to 64 KiB and keeps completed work seven days. The proposed edge adapter verifies Stripe, then signs a bounded canonical event. The billing owner must retain its own event ID and digest. [Payment ingress](field-projects/qrwty/README.md#where-generation-ends) |
| Pub/Sub replay for 31 days with 35-day click receipts | The counter retains seven days and the checked consumer supports at most 30. The proposal keeps an Event consumer stub and an explicit atomic receipt/aggregate requirement. The longer window needs a compatible mechanism and replay evidence. [Click processing](field-projects/qrwty/README.md#where-generation-ends) |
| Auth0 browser login and service calls | Generated forwarding currently expects Keycloak. Support the Auth0 tenant issuer, registered audience and separate service credentials, then verify login through two services. [Auth0 implementation](field-projects/qrwty/implementation-notes.md#sign-in-once-with-auth0) |

The owner wants the webhook receiver to verify Stripe directly and the click consumer and cleanup job to accept real retention settings. The [implementation notes](field-projects/qrwty/implementation-notes.md) give the behavior and checks for both.
