# QRWTY lessons for Jeeves: the evidence (JP00)

**Written** 2026-11-14 by the JP00 planner from three read-only checkouts: Jeeves at `0a2ee22`
(QG24; QG07 uncommitted in the working tree), QRWTY arm A (`qrwty`) at `074d9e8`, and QRWTY arm B
(`qrwty-baseline`) at `26e8997` (B05b accepted). Nothing was run, installed or generated; every
number below is a count of files as they are, with its method stated. Each claim is marked
**DI** (design intent: what a contract or ADR asks for), **TA** (template availability: what
Jeeves's templates do today, read from the code and docs) or **VE** (verification evidence: a
probe or test someone ran and recorded). A guess is labelled a guess.

## 1. What was inventoried

### 1.1 Arm B's backend (`qrwty-baseline/app/src/`)

**Method.** `grep -c -v '^\s*$'` per `.ts` file under `app/src/` (nonblank physical lines, comment
lines included). B's files carry long header comments (roughly 10–20% of lines, a guess from the
files read), so these totals are 10–20% above what source-loc-v2 (comments removed) would give.
`app/test/` (8,070 lines), `app/migrations/` (281 lines of SQL) and `infra/` (6,503 lines of
Compose, OpenTofu, scripts and control tooling) are outside the backend measure and are reported
only for scale.

**State.** B has finished B00–B05b: platform, guest links, accounts and ownership, account
deletion and restore, the redirect service. Not yet written: B06 (abuse and moderation), B07
(analytics worker and pipeline guard), B07a/B07b (billing). So this inventory covers an estimated
65–75% of B's final backend (a guess: the four pending domains are of the same order as links and
sessions together). Billing and analytics are therefore judged from B's ADRs (DI), not from code.

| Directory | Files | Nonblank lines | Share |
| --- | ---: | ---: | ---: |
| `platform/` (config, http, db, pubsub, auth, cache, crypto, storage, lifecycle, log, errors, clock, tls, test control) | 22 | 3,729 | 42% |
| `session/` (OIDC relying party, sessions, guest handle, CSRF, forwarding, routes, deletion, jobs) | 9 | 1,626 | 18% |
| `links/` (create, claim, manage, destination rules, idempotency, erasure, routes) | 12 | 1,163 | 13% |
| `processes/` (shared start-up, entry points, release jobs, test edge, test scheduler, test routes) | 15 | 1,046 | 12% |
| `redirect/` (route cache, click event, routes, safety gate, pages) | 6 | 837 | 9% |
| `edge/` (route table, header policy, upstream exchange) | 2 | 293 | 3% |
| `account/` (owned list, cursors) | 2 | 187 | 2% |
| **Total** | **68** | **8,881** | 100% |

### 1.2 Arm A's planned hand-written work

- **Q02's as-found export** (VE, `docs/evidence/q02/`): 84 files; backend `src/` holds 35
  scaffold files with 2,574 raw nonblank lines and 11 stub bodies with 88 lines; 8 product SQL
  files with 125 lines of comments. Every product route answered 501 and the one consumer
  dead-lettered. Of the 14 modules, 3 are templates (three Sign-in guards) and 11 are stubs.
- **Q03's audit** (VE): G01–G13 and F1–F26 became QG01–QG20, then QG21–QG25 from the QGR1
  review. Landed in Jeeves by 2026-11-14 evening: QG01, 02, 03, 04, 05, 06, 11, 12, 17, 19, 24.
  In flight: QG07 (Pub/Sub publishers). Queued: QG08, QG09, QG20, QGR2. Moved to the post-QRWTY
  backlog: QG10, 18, 21, 22, 23, 25. Deferred with no brief: QG13 (stub transactions), QG14
  (scheduled trigger), QG15 (per-route exposure), QG16 (startup with a lost broker, bounded drain).
- **A's product units** (DI, `qrwty/docs/plans/production-build/units.md`): Q06 links and
  creation (product SQL functions, slugs, idempotency, claim proof), Q07 sessions and ownership
  (code+PKCE, cookies, CSRF, token forwarding, claim, owned CRUD), Q08 redirect (route cache with
  `validatedUntil`, awaited publish, 503 shapes), Q09 abuse (admission, reputation, moderation),
  Q10 analytics (dedup, aggregates, quarantine), Q10a+Q10b billing (Checkout, webhook inbox,
  leased reconciliation, grants, quotas). Q03's remedies tell A to write every multi-row
  invariant as a single-statement PL/pgSQL function (G02), to run cleanup and reconciliation as
  "authenticated scheduled owner calls" from a scheduler service in `compose.override.yaml`
  (G11), and to own its edge route map (G08).

### 1.3 How the two arms' designs agree

Both arms, independently, converged on the same production mechanisms (DI): one logical writer per
store with reader views; a reserved-connection transaction API for every multi-statement change;
insert-first idempotency records keyed by `(scope, key)` with the 2xx result stored; a route cache
whose entries carry an absolute `validatedUntil` that copying never extends; a bounded Pub/Sub
publisher awaited before the 302 with the same event ID on retry; a BFF with HttpOnly cookie
sessions, CSRF and a stateless guest handle; workload tokens on internal calls with a caller
allowlist; leased, idempotent scheduled jobs; a production profile that refuses emulator
endpoints, fixtures, placeholders and disabled TLS by name. Where B wrote these as libraries
(`platform/`), A has to write them in stub bodies and product SQL, because the templates don't
offer them. That is the gap this analysis measures.

## 2. Classification

**Generic** means a production web backend of another application would need it too (an ordinary
SaaS backend was the test; the YouTube field project was checked for each item). **Product policy**
means QRWTY only. Lines are B's (section 1.1 method); a file split between the two classes is
estimated and marked `~`.

| # | Concern | B files | Lines | Class |
| --- | --- | --- | ---: | --- |
| C1 | Configuration registry, typed validation, secrets by name, production-profile refusal (R01) | `platform/config/{registry,validate,keyring}.ts`, `tls.ts` | 1,740 | Generic (the mechanism); QRWTY's own setting list is product |
| C2 | Process lifecycle: validate then listen, liveness vs readiness, wait for dependencies with backoff, bounded drain | `platform/lifecycle.ts`, `processes/runtime.ts` | 408 | Generic |
| C3 | HTTP runtime: admission, per-request deadline signal, error vocabulary, 405 with `Allow`, raw-body route, request log | `platform/http/server.ts`, `errors.ts`, `log.ts` | 434 | Generic |
| C4 | Database: bounded pool with TLS, unavailable-error mapping, transaction API with retry and unknown-outcome rule | `platform/db/{pool,transaction}.ts` | 261 | Generic |
| C5 | Migrations as a release job, roles and databases bootstrap | `platform/db/{migrate,roles}.ts`, `processes/{migrate,db-bootstrap}.ts` | 291 | Generic (Jeeves covers it, differently) |
| C6 | Pub/Sub publisher with bound and deadline, streaming-pull subscriber with reconnect | `platform/pubsub/client.ts` | 230 | Generic (QG07–QG09) |
| C7 | Token verification (user and workload), guards with caller allowlists, token source for outgoing calls | `platform/auth/{tokens,guard}.ts` | 226 | Generic |
| C8 | Valkey client with command deadline and no offline queue | `platform/cache/valkey.ts` | 82 | Generic (QG04) |
| C9 | Browser session layer (BFF): OIDC code+PKCE, session store with sealed tokens, guest handle, CSRF, cookies, forwarding with the user's token | `session/{oidc,store,guest,forward,auth-routes}.ts`, ~40% of `session/routes.ts` | ~990 | Generic |
| C10 | Idempotency records: insert first, scoped, 2xx stored, 24 h, 409 on a different request | `links/{idempotent,idempotency}.ts` | 126 | Generic |
| C11 | Route cache: in-process LRU, Valkey tier with a stale-fill guard, authoritative read with single flight and a semaphore, absolute `validatedUntil` | `redirect/{route-cache,entry}.ts` | 462 | Generic |
| C12 | Scheduled jobs: job routes with leases and a scheduler | `processes/test-scheduler.ts`, `session/jobs.ts`, lease SQL in `session/deletion.ts` | ~230 | Generic |
| C13 | Keys: key rings, HMAC sign/verify, AES-GCM seal/open, HMAC-bound pagination cursor | `platform/config/keyring.ts` (in C1), `platform/crypto/aead.ts`, `account/cursor.ts` | ~150 | Generic |
| C14 | Edge: header trust, origin signature, route table, upstream exchange, local test edge | `platform/http/edge-auth.ts`, `edge/*`, `processes/test-edge.ts` | 622 | Mixed: header trust and signing generic (~200); the route map, pages and the test edge product or test tooling |
| C15 | Test clock and fault points | `platform/clock.ts`, `test-control.ts`, `processes/test-routes.ts` | 138 | Generic test tooling (oracle-driven) |
| C16 | Erasure journal, restore gate, account deletion and reapply jobs | `platform/storage/erasure-journal.ts`, `db/restore-gate.ts`, `session/{deletion,reapply}.ts`, `links/{erasure,reapply}.ts` | 659 | Product policy and operations (QRWTY's A15) |
| C17 | Links domain: slugs, claim proofs, create, claim, manage, destination rules, error catalogue, model | `links/*` minus C10 | 1,037 | Product policy (SSRF-safe URL validation, 192 lines, is a reusable library but not a Jeeves concern) |
| C18 | Redirect domain: click event, pages, request order, safety gate | `redirect/{click-event,pages,routes,safety-gate}.ts` | 375 | Product policy |
| C19 | Session and account product routes | ~60% of `session/routes.ts`, `account/routes.ts` | ~340 | Product policy |
| C20 | Entry points and release-job wrappers | `processes/*-api.ts`, `*-worker.ts`, `redirect.ts`, `jobs.ts` | 280 | Generic (Jeeves generates them) |

Totals (estimated where marked): **generic ≈ 6,000 lines (68%)**, **product policy ≈ 2,400
lines (27%)**, test tooling ≈ 450 lines (5%). Of the generic part, Jeeves today generates an
equivalent of roughly 1,900 lines (C2, C3 mostly, C5, C6 with QG07–QG09, C8, C20, the
verification half of C7): **TA**. What remains generic and not generated is about 4,000 lines
(C1's mechanism, C4's transaction, C7's workload half, C9, C10, C11, C12, C13, C14's trusted
headers). That is the number the plan goes after.

## 3. The generic concerns in detail

Each entry: what B wrote (lines, section 1.1 method), what Jeeves does today (TA), how it would be
expressed on the canvas within Jeeves's rules (only what generates is offered; settings are a
finite allowlist of necessary decisions; no Advanced dumping ground), what would generate and what
stays a stub or hook, and who else would reuse it.

### C4 — A scoped transaction for database stubs

- **B:** 130 lines (`transaction.ts`): one reserved client, `BEGIN` at READ COMMITTED, a scoped
  handle that refuses `BEGIN`/`COMMIT`/`ROLLBACK` text, retry of the whole function on `40001`
  or `40P01` (3 attempts), a broken `COMMIT` reported as an unknown outcome, never success; the
  client is destroyed on a connection-level error. Used by every write in `links/` and
  `session/` (VE: `withTransaction` appears in create, claim, manage, erasure, deletion, store).
- **Jeeves today (TA):** `DatabaseReadWriter` is `query`/`execute` over `pg.Pool.query`. Q03
  probed that `execute("BEGIN")` leaks an `idle in transaction` connection to the next caller
  (VE, `g02-transactions.txt`). `runtime/transaction.ts` exists for templates (favorites,
  durability) with `assertTransaction`/`abortTransaction`, no retry. QG13 was deferred because a
  single-statement PL/pgSQL function is atomic. That remedy moves application logic into
  product SQL, which is outside the backend measure and harder to test; B shows the
  TypeScript-side transaction is what a production backend writes.
- **Canvas:** nothing new. Every stub whose link writes a Database already gets a
  `DatabaseReadWriter`; it gains `transaction(fn)`.
- **Generates:** the `transaction` method in `module-clients.ts` (reusing `runtime/transaction.ts`),
  the retry rule, the unknown-outcome error and the nested-transaction refusal. **Stub:** the SQL
  inside `fn`.
- **Reuse:** every application with a write path. YouTube's templates already use
  `transaction()`; its stubs would too.

### C10 — Idempotency records for route stubs

- **B:** 126 lines plus a table and a cleanup statement: `takeKey` inserts the key row before any
  other write (`ON CONFLICT DO NOTHING`), replays the stored 2xx body on a repeat, answers 409 on a
  different request hash, stores only 2xx; a 24-hour window; a scope of the verified subject or
  the guest id. Both arms' contract requires `Idempotency-Key` on every create (DI).
- **Jeeves today (TA):** nothing. A stub reads the header and writes its own table in product SQL.
- **Canvas:** nothing new. Offered to every route stub whose tile writes a Database.
- **Generates:** `runtime/idempotency.ts` (take, store, request hash), the records table in a
  Jeeves-owned schema on that database with the tile login's grants, a 60-second expiry sweep
  under an advisory lock, and `DatabaseReadWriter.idempotent(...)`, which runs the take, the
  stub's function and the store inside one transaction (C4). **Stub:** the scope (subject or its
  own guest handle), the body hashed, and mapping `IdempotencyConflict` to its contract's 409.
- **Reuse:** every public API with creates or payments (SaaS: yes; YouTube: an upload start or a
  favorites add could use it; today they rely on the template's own idempotent design).

### C12 — Scheduled work with a lease

- **B:** ~230 lines: a test scheduler process (133) that calls job routes with a workload token,
  Session API's two job routes (60), and lease rows for deletion steps. B's reason for job routes
  is Cloud Run's request-driven CPU (ADR-001 §3). A's remedy is the same shape in
  `compose.override.yaml` plus Cloud Scheduler (G11).
- **Jeeves today (TA):** `periodic()` in `runtime/process.ts` runs template sweeps (multipart,
  lifecycle); no stub can use it; QG14 is deferred pending the owner's decision on the kind.
- **Canvas:** a new module kind **Scheduled task** hosted in a Worker, with one setting, **Every**
  (seconds, 1–86,400), which is a necessary user decision, and Custom's many-target `uses` slot. A
  Worker is a long-running process (a Cloud Run worker pool in B's terms), so an in-process
  `periodic` with a database lease is correct there, and no external scheduler is needed. The
  task needs a Database link to hold its lease; without one it is a Stub saying so, like
  Favorites without its guard.
- **Generates:** `runtime/tile-schedule.ts` (`startModuleSchedule`: `periodic` at the interval,
  one lease row per module in a Jeeves-owned table, so two copies run a tick once; a tick that
  throws is logged and the next tick runs; drain waits for the tick in hand), the lease table and
  grants, the process wiring and report row. **Stub:** the tick body.
- **Reuse:** every application has cleanup, retention or reconciliation (QRWTY: idempotency and
  claim-proof cleanup, nightly billing reconciliation, partition maintenance; YouTube: a retention
  sweep for the event counter's receipts, today a known limit; SaaS: digests, expiries).

### C11 — The cache reader as a library a stub can call

- **B:** 462 lines: an LRU per replica, a Valkey tier written through a Lua script that keeps the
  newer version, an authoritative read that is single-flight per key behind a semaphore (16
  concurrent, 64 waiting, 200 ms), and one rule for every tier: an entry is usable only before its
  absolute `validatedUntil`, set from the instant before the authoritative read started and never
  extended by a copy (ADR-005). QRWTY's A07/A08 rows (edit, disable, block and expiry propagate
  within 60 s; no 302 after `expiresAt`) rest on it (VE: B05 oracle A24, F01, F02 passed).
- **Jeeves today (TA):** `positive-cache-read` is close: cache-aside, single-flight, misses not
  cached, the Valkey `PXAT` expiry is already absolute, a stalled cache is skipped for 5 s. But it
  is an HTTP route (`GET /modules/<lead>/:key`), its 404 can't be shaped (gap 7) and a stub can't
  call it, so QRWTY left it unused (F8) and A's Q08 rewrites it in a stub.
- **Canvas:** a Custom module's `uses` slot accepts the Cache reader in its own tile as an
  in-process target (as Favorites' `items` and the reader's `loader` already are). The reader's
  hooks (`key`, `codec`, `eligible`, `load`, `expiresAt`) and its Cache TTL stay as they are.
- **Generates:** `dependencies.<reader>.get(input)`, the reader built once per process, the
  route only when no Custom module links it (decision D5), and an L1 in-process map when the
  reader's `l1MaxEntries` is set (an existing setting the template doesn't consume yet).
  **Hooks:** unchanged. **Stub:** policy on the record, the 302 and the publish.
- **Reuse:** any lookup path (redirects, product pages, feature flags). YouTube's watch cache
  stays a route; nothing changes for it.

### C7 — Workload identity between tiles

- **B:** ~120 of 226 lines plus per-route allowlists: internal routes verify an
  `X-QRWTY-Workload-Token` (issuer, audience = this service, caller claim in the route's
  allowlist) after the user token; callers obtain a token from the local issuer (client
  credentials) or the metadata server in cloud. Both arms' billing contract requires "internal
  entitlement endpoints require workload identity and an allowlisted caller" (DI). Q03 classed
  this as deployment ("Cloud Run ingress versus invoker IAM"), and A's Entitlements moved to an
  internal tile instead.
- **Jeeves today (TA):** `httpTarget` calls `JEEVES_TILE_<ID>_URL` with no credential; an internal
  tile's routes are open to any process on the network. The link field `planned.security`
  (`Service identity` by default, `User identity`, `Public`, `Private network`) is "intent only".
- **Canvas:** that field, consumed: on a direct link between two application tiles, **Service
  identity** makes the callee require a workload token from the tiles that link to it (the
  allowlist is the diagram), and the caller's `httpTarget` attaches one; **Private network** keeps
  today's open call. It needs an Identity tile in the design to issue tokens; without one the
  value is reported as intent only (no refusal, so existing designs keep working).
- **Generates:** the Keycloak client per calling tile and its secret (setup), the token source and
  the verifier (`JEEVES_WORKLOAD_*` variables, QG06's rule), the check on every module route of
  the callee, and the report. **Stub:** nothing.
- **Reuse:** every multi-service backend not protected by its platform's IAM. YouTube v3 has no
  tile-to-tile call (its links are through queues), so nothing changes for it.

### C9 — A browser session (BFF) template

- **B:** ~990 lines: `openid-client` code+PKCE with `state`/`nonce` and a login transaction row,
  a sessions table holding SHA-256(session id), the subject and the issuer's tokens sealed with
  AES-256-GCM, `__Host-` cookies (Secure, HttpOnly, SameSite=Lax), idle and absolute expiry on the
  application clock, CSRF tokens as HMAC(session id) checked on every cookie-bearing mutation, a
  stateless signed guest handle, token refresh, and forwarding to internal services with the
  user's access token. A14 (forged tokens, rotation, expired sessions) passed in B04 (VE).
  Both arms' contract requires the BFF (DI): "tokens never reach the browser".
- **Jeeves today (TA):** the Sign-in template verifies bearer tokens; the browser holds the token
  (YouTube v3's browser uses the public PKCE client `<identity>-web` directly). No cookie
  session, no CSRF, no token refresh.
- **Canvas:** a new module kind **Browser session** in a Service, slots `identity` (Identity ·
  verify) and `sessions` (Database · read & write), lead of a `browser-session` template; a tile
  holds it or an Auth guard, not both. No settings: the lifetimes and names are a fixed policy
  record, like Favorites' bounds. The guest handle and account deletion stay product.
- **Generates:** the login, callback, logout and `session` routes, the tables and grants, the
  cookie and CSRF rules on the tile's module routes, `request.caller` for the tile's stubs (the
  session's subject) with `accessToken()` for forwarding, the local confidential Keycloak client
  and `OIDC_CLIENT_*` variables. **Stub:** every product route; the guest handle (C13 helps).
- **Reuse:** any SaaS with browser sign-in that wants HttpOnly cookies (most). YouTube: optional.
  This is the largest item by lines and the riskiest: two units, a new dependency
  (`openid-client`), crypto, and Keycloak setup.

### C1 — Declared settings for stubs, refused at startup

- **B:** 1,740 lines, of which about 1,100 (`registry.ts`) is QRWTY's own list of 62 settings
  per process kind, and about 600 the generic mechanism: typed parsing, secret handling, key
  rings, cross-checks and the profile refusal categories (R01).
- **Jeeves today (TA):** endpoints, `OIDC_*` and secrets are derived from the diagram and
  validated by name (QG06, QG11, QG24); a stub's own settings (Stripe keys, a provider URL, a
  policy name) are read from `process.env` by the stub with no validation, no startup refusal and
  no inventory; QG10 (TLS and the insecure-endpoint refusal) is in the backlog.
- **Canvas:** nothing: a stub's settings are application code, never a diagram control.
- **Generates:** `runtime/settings.ts` (`text`, `integer`, `url`, `secret`, `keyRing`, each
  required unless `optional()`), read once per stub before its clients' probes, refusing with
  `Invalid setting <NAME>` (never the value) through `startup-failed`, typed into
  `dependencies.settings`, and listed in the report and README. **Stub:** the declaration (one
  line per setting) and its use. This gives QRWTY A the equivalent of B's registry in perhaps
  60–100 declaration lines instead of 1,100 (a guess), and it is where QG10's production refusal
  can later plug in.
- **Reuse:** every application with a provider credential or a policy value (YouTube v3's hooks
  hold none, but a deployed one would).

### C13 — Keys: rings, HMAC, AEAD, cursors

- **B:** ~150 lines (ring 52, AEAD 47, cursor 53) used by the guest handle, CSRF, sealed claim
  proofs, sealed tokens and list cursors.
- **Jeeves today (TA):** nothing; Favorites has its own cursor.
- **Canvas:** nothing. A `keyRing()` setting (C1) reads a JSON array of `{id, key}` from a
  secret file; `runtime/keys.ts` offers `sign`/`verify` (timing-safe, any ring key verifies),
  `seal`/`open` (AES-256-GCM, HKDF per purpose) and `encodeCursor`/`decodeCursor` bound to a
  subject.
- **Generates:** the library when a stub declares a key ring. **Stub:** what it signs or seals.
- **Reuse:** any app with signed cookies, sealed secrets or keyset pagination; a prerequisite of
  the session template.

### C3 — Route stubs: a deadline signal and a route table

- **B:** `routeMethods` (405 with `Allow`), `request.deadlineSignal` (aborted at the request
  deadline or when the client goes), `toAppError` mapping. B's four product route files (819
  lines) spend an estimated 15–25% on method and path dispatch and parameter parsing.
- **Jeeves today (TA):** a route stub answers any method on `/modules/<id>/*`; it writes its own
  dispatch and 405; it gets no signal to bound downstream work to the Request timeout (the
  admission answers `DEADLINE` but the handler's calls keep running).
- **Canvas:** nothing.
- **Generates:** `ModuleRequest.signal` and a `defineRoutes({"GET /links/:id": handler})` helper
  in `entry.ts` that answers 404 and 405 with `Allow`, parses `:params`, and keeps the stub's own
  bodies. **Stub:** the handlers.
- **Reuse:** every route stub.

### C6 — Pub/Sub client bounds (lessons for QG07–QG09)

- **B (VE, B05 review F1 and B05b):** after a 60 s broker outage, redirects stayed 503 for as long
  as gRPC's reconnect backoff, which grows 1.6× per attempt to 120 s; with
  `grpc.initial_reconnect_backoff_ms` 500 and `grpc.max_reconnect_backoff_ms` 2,000 every replica
  answered 302 within 2.06 s of the broker's return (5,000 left some at 5.7 s). Off GCP, a client
  without `universeDomain: "googleapis.com"` asks Application Default Credentials for it and
  waits about 3 s for the metadata server on its first call, so the first publishes of every
  replica missed their deadline. B's publisher holds its in-flight slot until the SDK's own
  promise settles, so a stalled broker fills the bound instead of growing memory (F06 passed).
- **Jeeves (TA):** QG07's brief fixes a 2,000 ms gax timeout and 1,000 outstanding publishes; it
  says nothing about the channel's reconnect backoff or the emulator's credential lookup. Those
  two options are the smallest high-value change in this analysis.

### C14 — Trusted forwarded headers at the edge

- **B:** the edge strips every client-supplied `X-Forwarded-*`, `Forwarded`, `X-User-Id` and
  `X-Oracle-*` header and signs what it forwards; origins trust only signed values.
- **Jeeves (TA):** Q03's F22: the generated nginx rewrites `Host` and passes a client's
  `X-Forwarded-For` unchanged. The F22 note is still owed in `docs/template-gaps.md` and belongs
  to QG25 (backlog), which already touches `nginx.conf`: strip inbound `X-Forwarded-*` and set
  `X-Forwarded-For` from `$remote_addr`. Signing is for the application's own edge; not planned.

### Covered already, or by queued units (no new work)

C2 (lifecycle: Jeeves's `runProcess`, `/healthz` 503 before ready and while draining, ordered
drain; the open behaviour question is QG16), C5 (migrations, roles, grants: Jeeves's
`migrate.mjs` with QG12 is richer than B's), C6 (QG07–QG09), C8 (QG04), the verification half of
C7 (`verified-identity`; B adds `ES256` and `nbf`, worth one line in a later sign-in unit), the
error fallback (QG21 in the backlog), and C20.

## 4. Ranking and the share estimate

Score = expected backend lines saved per app that uses it × reuse (3 every app, 2 most, 1 some) ÷
complexity and risk (1 one small unit, 2 one or two units in one layer, 3 spec + studio + chat +
generator, 4 new dependency or crypto). Lines are the B lines a Jeeves app would no longer write,
less what it still writes as declarations or hooks (estimates; a guess where B has no code yet).

| Rank | Item | Lines saved per app | Reuse | Complexity | Score | Plan unit |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Pub/Sub client bounds (C6 lessons) | 0, but a two-minute outage tail removed | 3 | 1 | correctness | QL01 |
| 2 | Scoped transaction for stubs (C4) | 130, plus no PL/pgSQL for invariants | 3 | 1 | 390 | QL03 |
| 3 | Route table and deadline signal (C3) | 150 | 3 | 1 | 450 | QL02 |
| 4 | Declared settings (C1 mechanism) | 400 (a guess) | 3 | 2 | 600 | QL05 |
| 5 | Cache reader as a dependency (C11) | 350 | 2 | 2 | 350 | QL09 |
| 6 | Keys library (C13) | 150 | 2 | 1 | 300 | QL06 |
| 7 | Scheduled task with a lease (C12) | 230 | 3 | 3 | 230 | QL07, QL08 |
| 8 | Idempotency records (C10) | 130 plus DDL and cleanup | 3 | 2 | 195 | QL04 |
| 9 | Workload identity (C7) | 220 | 2 | 3 | 147 | QL10 (decision) |
| 10 | Browser session template (C9) | 1,000 | 2 | 4 | 500 | QL11, QL12 (decision) |

The plan's order (units.md) follows dependencies, not this score: QL02 and QL03 are libraries the
later units build on; QL04 needs both.

**Today's share, QRWTY-like app.** With QG01–QG24 landed, the generated `src/` of A's design is
about 2,700–2,900 raw lines (Q02's 2,574 plus QG01–QG06's additions, a guess from the handoffs'
byte deltas). If A's hand-written backend comes out near B's product-policy part plus the generic
gaps B had to write (section 2: ≈ 2,400 + 4,000 ≈ 6,400 raw lines, comments removed ≈ 5,300), the
share is about 2,800 ÷ (2,800 + 5,300) ≈ **35%**, consistent with the packet's 30–35%.

**With the top items.** Ranks 2–8 remove about 1,500 hand-written lines and add about 900 generated
lines; rank 9 about 220 and 150; rank 10 about 1,000 and 700. Hand-written ≈ 5,300 − 2,700 ≈ 2,600;
generated ≈ 2,800 + 1,750 ≈ 4,550; share ≈ **64%**. Without the session template and workload
identity (ranks 2–8 only): hand-written ≈ 3,800, generated ≈ 3,700, share ≈ **49%**. These are
estimates from B's line counts, not measurements of A; the method is stated so Q17 can check them.
The owner's 60% target is reachable for this kind of application only with the session template.

**YouTube.** v3's share is 91.75% because its product is almost all hooks. QL03, QL04 and QL07/08
would let a v5 add a retention sweep and an idempotent upload start as generated mechanisms; QL01,
QL02, QL05 change nothing user-visible there. The share would not move much; the point for
YouTube is correctness and fewer scaffold edits.

## 5. What Jeeves should not take on

| Item | Why not |
| --- | --- |
| QRWTY's edge route map (`/{slug}`, reserved segments, `/api/v1/*`), HTML error pages, the Cloudflare Worker, the local test edge | Product paths and deployment; Jeeves's edge is local only (QG15 stays deferred) |
| Erasure journal, restore gate, account deletion, backup and restore procedure (C16) | Operations and product policy; the mechanism depends on the deployment's storage and backups |
| Destination validation, slugs, claim proofs, link states, click event, safety gate, pipeline guard, billing lifecycle, tier policies | Product policy; stubs and product SQL are the right place |
| Test clock, fault points, test routes, the oracle adapter (C15) | Test tooling of the experiment; a generic virtual clock would need a profile concept Jeeves doesn't have (noted for later, not planned) |
| Per-request logging, log redaction paths | Operations; the failure lines are the generic minimum |
| TLS, the production profile's refusal of emulators and placeholders | Already planned as QG10 (backlog); QL05's settings seam is where its checks of a stub's values would hang |
| Any UI, sizing, cloud resources, IAM, DNS | Outside Jeeves (AGENTS.md) |

## 6. Notes for the queued and backlog QG units

- **QG07/QG08 (in flight, queued):** take QL01's two options into the publisher and subscriber
  if their agents have not finished; otherwise QL01 runs after QGR2.
- **QG25 (backlog):** when it edits `nginx.conf`, also strip inbound `X-Forwarded-*` and set
  `X-Forwarded-For` from `$remote_addr`, and record F22 in `docs/template-gaps.md` as the plan
  asks.
- **QG13:** replaced by QL03 (this plan). **QG14:** replaced by QL07 and QL08.
- **QG16:** B waits for a missing dependency with capped backoff instead of exiting (ADR, VE in
  B's lifecycle tests), while Jeeves fails startup and relies on a restart policy that the local
  stack doesn't have. B's choice is the production one for a worker pool with no orchestrator
  restart; the owner's decision is still needed (not in this plan).
- **Design playbook:** one lesson is worth recording by whoever runs QL13: both arms independently
  wrote a transaction API, idempotency records, an absolute-deadline route cache and leased jobs;
  a design that needs a production backend should expect these four and check the templates
  offer them before drawing.

## Appendix: counts

B per-file nonblank lines (section 1.1 method), largest first: `platform/config/registry.ts` 1,106;
`platform/config/validate.ts` 557; `redirect/route-cache.ts` 354; `session/routes.ts` 341;
`session/store.ts` 317; `session/deletion.ts` 306; `platform/http/server.ts` 287;
`processes/test-edge.ts` 266; `platform/pubsub/client.ts` 230; `processes/runtime.ts` 229;
`session/oidc.ts` 209; `links/destination.ts` 192; `links/routes.ts` 179; `platform/lifecycle.ts`
179; `links/create.ts` 174; `session/auth-routes.ts` 168; `redirect/routes.ts` 165;
`edge/routing.ts` 161; `platform/auth/tokens.ts` 161; `links/manage.ts` 136; `account/routes.ts`
134; `processes/test-scheduler.ts` 133; `edge/node-forward.ts` 132; `platform/db/pool.ts` 131;
`platform/db/transaction.ts` 130; `platform/storage/erasure-journal.ts` 125; `platform/db/migrate.ts`
117; `redirect/entry.ts` 108; the remaining 40 files are each under 100 lines (total 1,676).

Jeeves template assets (`templates/local-v2/assets/src/`, same method): 50 files, 6,870 nonblank
lines; the largest are `asset-lifecycle` 445, `owned-upload` 431, `amqp` 382, `multipart` 373,
`module-clients` 366, `media-worker` 344, `video-hls` 271, `tile-loop` 268, `delivery` 236.
