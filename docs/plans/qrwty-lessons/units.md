# QRWTY lessons: generic mechanisms for stubs (QL units)

**Status:** proposed 2026-11-14 by the JP00 planner from Jeeves at `0a2ee22` (QG24), QRWTY arm A at
`074d9e8` and arm B at `26e8997`. The evidence is in [analysis.md](analysis.md); this file is the
build plan. **Nothing is implemented.** Units run one at a time on `main` in the primary checkout,
each by a fresh agent, in the order below, **after QGR2 has been committed** (QG07–QG09 and QG20
edit the same template files as QL01–QL04; two agents must never share the checkout).

## Order

| Unit | Title | Depends | Owner decision | Layer |
| --- | --- | --- | --- | --- |
| QL01 | Pub/Sub clients reconnect within two seconds and skip the credential lookup locally | QG07, QG08 landed | No | templates |
| QL02 | Route stubs get a deadline signal and a route table | — | No | templates, generator |
| QL03 | Database stubs get a scoped transaction | — | No | templates, generator |
| QL04 | Route stubs get idempotency records | QL02, QL03 | **D4** | templates, generator |
| QL05 | Stubs declare their settings and startup refuses an invalid one | — | **D6** | templates, generator |
| QL06 | A keys library for stubs: rings, signatures, sealed values and cursors | QL05 | No | templates, generator |
| QL07 | A Scheduled task module kind with its interval | — | **D2** | spec, studio, chat |
| QL08 | Scheduled tasks run every N seconds under a shared lease | QL03, QL07 | **D2**, **D4** | templates, generator |
| QL09 | A Custom module can call its tile's Cache reader | — | **D5** | spec, studio, generator |
| QL10 | Service identity links carry workload tokens between tiles | QL05 | **D1** | templates, generator, setup |
| QL11 | A Browser session module kind and its template contract | — | **D3** | spec, studio, chat |
| QL12 | Browser session generates sign-in, cookie sessions, CSRF and token forwarding | QL06, QL11 | **D3** | templates, generator, setup |
| QL13 | **QLR1 — Review the QL plan's units** | all above | No | review |

QL01–QL03 and QL05 are independent and may run in any order after QGR2; QL07 and QL09 are
independent of the template units; QL11 waits only for the owner. A unit whose decision is "no"
is skipped and the review notes it.

## Decisions (each with the planner's recommendation)

1. **D1 — Workload identity between tiles (QL10).** A direct link between two application tiles
   whose Security is **Service identity** (the stored default) makes the callee require a workload
   token minted by the design's Identity for the tiles that link to it, and the caller's
   `httpTarget` attach one; **Private network** keeps today's open call. Needs at least one
   Sign-in template in the design (that is what provisions Keycloak); otherwise the value stays
   intent only and the report says so. Production foundations D1 called host names deployment;
   QG06 settled that reading them is generic. Both QRWTY arms require allowlisted workload callers
   on internal routes. **Recommend: yes.** The alternative is to keep it deployment (Cloud Run
   invoker IAM) and leave internal routes open on the local network.
2. **D2 — A Scheduled task module kind (QL07, QL08).** A new module kind hosted in a Worker with
   one setting, **Every (seconds)**, 1–86,400, default 60, and Custom's many-target `uses` slot;
   it needs a database it writes, for its lease. QG14 asked for this decision. **Recommend: yes.**
   The alternative (a setting on Custom) would give Custom a control that means nothing in a
   Service.
3. **D3 — A Browser session template (QL11, QL12).** A new module kind in a Service with
   `identity` and `sessions` slots, leading a template that generates OIDC code+PKCE sign-in,
   HttpOnly cookie sessions with sealed tokens, CSRF and `request.caller` for the tile's stubs,
   with a fixed policy record (7 days absolute, 24 hours idle). It adds `openid-client@6.8.8` to
   every export's lock, as the Pub/Sub SDK was added. It is the largest and riskiest item and the
   only one that moves a QRWTY-like app's share from about 50% to about 60%. **Recommend: yes, as
   the last two build units;** the owner may also say "after Q17's report".
4. **D4 — Jeeves-owned tables for stubs (QL04, QL08).** The idempotency records and the schedule
   leases live in schema `jeeves` on the database the stub writes, created by a generated
   migration `050-jeeves-<name>.sql` and granted to the tile's login, like a template's table; a
   stub never creates them. **Recommend: yes.** The alternative (documented DDL the application
   pastes into product SQL) generates nothing and drifts.
5. **D5 — The Cache reader a Custom module links becomes a library (QL09).** When a Custom module
   in the same tile fills its `uses` slot with the Cache reader, the reader's HTTP route
   `GET /modules/<lead>/:key` is not mounted and the Custom module gets `get(input)` instead; with
   no such link the route stays as today. **Recommend: yes** (the Custom module owns the tile's
   HTTP surface). The alternative mounts both.
6. **D6 — Stub files export a `settings` declaration (QL05).** Every generated stub body gains
   `import { declareSettings } from "../../runtime/settings.ts";` and
   `export const settings = declareSettings({});`, and the process reads the declaration before any
   client's probe, refusing startup with `Invalid setting <NAME>`. An older stub without the export
   still builds and runs (the process reads it through an optional cast). **Recommend: yes.**

## Not in this plan

| Item | Why not |
| --- | --- |
| QG10, QG18, QG21, QG22, QG23, QG25 | Already in the post-QRWTY backlog; QG25 should also strip inbound `X-Forwarded-*` and record F22 (analysis §6) |
| QG16 (startup with a lost broker, bounded drain) | Needs its own owner decision (analysis §6) |
| An L1 in-process map for the Cache reader (`l1MaxEntries`), a `rate-limiter` template, `ES256` and `nbf` in the sign-in verifier, a guest handle, a virtual clock | Later plan; evidence is thinner (analysis §3, §5) |
| Edge route maps, erasure journal, restore gate, account deletion, test tooling | Product, operations or the experiment's (analysis §5) |
| Any UI, deployment, cloud resource or IAM | Outside Jeeves |

## Rules for every unit

Jeeves's production foundations "Rules for every unit" 2–8 (`docs/plans/production-foundations/units.md`)
apply as written, with these changes:

- **Rule 1:** read `AGENTS.md`; the last three entries of `docs/handoff.md`; this plan's Order,
  Decisions, Not in this plan, Rules and Regeneration proof; then your own unit. Do not read or
  start another QL unit. Check that `git log -1 --format=%s` is at or after `QGR2: review QRWTY gap
  batch 2` and that `git status --short jeeves jeeves-generator` shows no other agent's edits;
  otherwise stop and record it (Rule 2).
- **Rule 6, Docker phase:** run Docker suites in their own phase after `pnpm check`, as SO02 did.
  Create only resources scoped to your run, remove them by exact name (image tags too), never
  prune, never touch `jeeves-postgres-1` or another project's containers, and compare the Docker
  inventory before and after.
- **Rule 9:** append one handoff entry in the usual shape, titled `QLnn: <title>`, saying in
  **Noticed** that the unit comes from the QRWTY lessons plan (JP00), then make one local commit
  with the unit's commit name. No `HUMAN_FEEDBACK` line. Don't push.
- Where a step names an API of a pinned package (Fastify 5.12.7, pg 8.23.1, redis 6.3.0,
  `@google-cloud/pubsub` 6.3.2, `openid-client` 6.8.8 once QL12 adds it), check it against that
  version's types in `node_modules`; if it differs, follow the unit's Goal and Invariants and
  record the difference (Rule 2).
- A new dependency follows QG07's procedure: resolve the lock in a scratch copy of the two
  assets with `pnpm install --lockfile-only` and `minimumReleaseAge` 20160 minutes, `diff` the
  locks, confirm no existing entry changed, list the added packages in the handoff.
- Every generated line that names a variable from the environment reads it with QG06's rule and
  message shape (`Invalid endpoint <NAME>` for an endpoint, `Invalid setting <NAME>` for a stub's
  setting), never printing the value.
- A new runtime file goes in `jeeves-generator/templates/local-v2/assets/src/runtime/<name>.ts.template`
  and is listed in the registry's source paths like its neighbours; a new emitter in
  `jeeves-generator/src/v2/<name>.ts` is registered where `loadLocalV2Registry` lists the others.

## Regeneration proof (shared)

Three fixtures: `docs/plans/qrwty-gaps/fixtures/probe-design.json` (SHA-256
`a3b6204fc40765cee51835caddbee17a653c10d6b4f827783424f50c19430505`),
`docs/plans/qrwty-gaps/fixtures/qrwty-r83.json`, and `field-projects/youtube/v4/inputs/design.json`
(a template-heavy design, to show templates are unaffected). Procedure, in the scratch directory:
before your change, `pnpm --filter @jeeves/generator export:v2 <fixture> $SCRATCH/before-<name>` for
each; after it, the same into `after-<name>`; `diff -rq` each pair and list every changed path in
the handoff. The changed paths must be exactly the unit's **Emitted output** list (plus
`.jeeves/manifest.json` and `.jeeves/report.json`); any other path: stop (Rule 2). In each
`after-*`: `pnpm install --frozen-lockfile --ignore-scripts --offline` (without `--offline` only in a
unit that adds a dependency) and `pnpm build`, exit 0. A unit that names a **Docker proof** runs it
on `after-probe` (or on the scratch design it names) with the probe bodies from QRWTY
`docs/evidence/q03/fixtures/app-code/` copied to their `generated-extension` paths, under its own
Compose project and loopback ports, then removes it. A **scratch design** is a copy of
`probe-design.json` edited in the scratch directory through the studio's own command path (as Q03
built the probe) or by hand with the same structure; it is never committed. Also run
`pnpm --filter @jeeves/generator update:v2 field-projects/youtube/v4/inputs/design.json "$PWD/field-projects/youtube/v4/app" --check`
(read only): `refused` must be empty. Delete the scratch exports at the end.

---

### QL01 — Pub/Sub clients reconnect within two seconds and skip the credential lookup locally

**Status:** ready once QG07 and QG08 have landed. **Depends:** QG07, QG08.

**Goal:** after a Pub/Sub outage every generated publisher and subscriber reconnects within about
two seconds of the service's return, and a process started against the local emulator never waits
on Application Default Credentials.

**Found (arm B, VE).** B05 review F1: after a 60 s outage, redirects stayed 503 for as long as
grpc-js's reconnect backoff, which grows 1.6× per attempt up to 120 s. B05b set
`grpc.initial_reconnect_backoff_ms` 500 and `grpc.max_reconnect_backoff_ms` 2,000 and measured
every replica answering 302 within 2,060 ms of the broker's return (5,000 left some at 5,677 ms).
B also found that a client in emulator mode without `universeDomain: "googleapis.com"` asks ADC for
the universe and waits about 3 s for the metadata server on its first call, so first publishes
missed their deadline.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`: every
  `new PubSub({` the `pubsubPublisher` section builds; and the subscriber's construction if QG08
  put it elsewhere (`grep -rn "new PubSub(" jeeves-generator/templates/local-v2/assets/src/`
  lists every site; edit each).
- Tests: `jeeves-generator/src/v2/pubsub.test.ts` (QG07's) or `module-clients.test.ts`, whichever
  holds the fake `@google-cloud/pubsub` that records constructor options.
- Docs: `jeeves-generator/README.md`, the Module clients paragraph on `pubsubPublisher`.

**Invariants.**
1. Every `PubSub` the templates construct receives `"grpc.initial_reconnect_backoff_ms": 500` and
   `"grpc.max_reconnect_backoff_ms": 2000`.
2. When `PUBSUB_EMULATOR_HOST` is set, the options also carry `universeDomain: "googleapis.com"`;
   when it is not set, no `universeDomain` is passed. QG07's other options (project, emulator
   detection, gax timeout, batching, bounds) are unchanged.
3. No other behaviour changes: deadlines, bounds, ack rules and log lines stay as QG07 and QG08
   left them.

**Emitted output.** `src/runtime/module-clients.ts` (and the subscriber's file if separate) for
designs with a `google-cloud` queue; `.jeeves/manifest.json`, `.jeeves/report.json`. Pinned paths:
none expected (no pinned export has a Pub/Sub stub); if `processes-off.test.ts` fails, Rule 7.

**Offline tests** (fail before, pass after): the recorded constructor options of the publisher and
of the subscriber contain both backoff keys with those values; with `PUBSUB_EMULATOR_HOST` set the
options contain `universeDomain: "googleapis.com"`; without it they don't.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=pubsub`.
**Docker proof:** the probe fixture with Events set to Google Cloud and the Tally loop (QG08's
proof design), `first-run`; then (a) the first `POST …/front-probe/publish?id=a` after Front's
start answers 202 in under 2.0 s (`curl -w '%{time_total}'`); (b) `docker pause` the emulator for
60 s, `docker unpause`, and poll the publish every 200 ms: the first 202 comes within 3.0 s of the
unpause (record the time); (c) a message published during the pause window's retries is counted
once by Tally. Remove the project.
**Commit:** `QL01: Pub/Sub clients reconnect within two seconds and skip the credential lookup locally`.

### QL02 — Route stubs get a deadline signal and a route table

**Status:** ready. **Depends:** none.

**Goal:** a route stub can bound its own downstream work to the tile's Request timeout and the
client's presence, and can declare its routes in a table that answers 404 and 405 with `Allow`
for it.

**Found (arm B).** `platform/http/server.ts` gives every handler `request.deadlineSignal`
(aborted at the deadline or when the client goes) and `routeMethods` answers other methods 405
with `Allow`; B's four route files spend an estimated 15–25% of their lines on dispatch. Today a
Jeeves route stub answers any method on `/modules/<id>/*`, writes its own dispatch and 405, and
its downstream calls keep running after the admission's `DEADLINE`.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/modules/entry.ts.template` (`ModuleRequest`
  gains `signal`; new `RouteHandler`, `defineRoutes`).
- `jeeves-generator/templates/local-v2/assets/src/runtime/tile-http.ts.template` (`stubRoutes`
  takes `{ deadlineMs }`, builds the signal).
- `jeeves-generator/src/v2/http-wiring.ts`: the stub mount's `stubRoutes(...)` call gains
  `{ deadlineMs: config.settings.requestTimeoutMs }` (use the exact name the process file's
  `config` holds for the Request timeout; `grep -n requestTimeoutMs jeeves-generator/src/v2/tile-processes.ts`).
- Tests: `jeeves-generator/src/v2/tile-processes.test.ts` (the block that loads the emitted
  `http.ts`), `tile-guard.test.ts` (loads the emitted `tile-http.ts`), `module-stubs.test.ts` if
  it asserts the stub's signature text.
- Docs: `jeeves-generator/README.md` (Module routes, the route stub bullet), `docs/studio.md`
  where it lists `ModuleRequest`'s fields.

**Invariants.**
1. `ModuleRequest.signal: AbortSignal` is aborted with `Error("DEADLINE")` when `deadlineMs`
   passes after the handler starts, or with `Error("CLIENT_CLOSED")` when the response socket
   closes before the answer is written; it is never aborted after a normal answer. The admission's
   own 503 `DEADLINE` behaviour is unchanged.
2. `defineRoutes(table)` returns an entry `(request: ModuleRequest) => Promise<ModuleResponse>`.
   A key is `"<METHOD> <pattern>"`: METHOD one of DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT;
   pattern starts with `/`, segments are literals or `:name` (one non-empty segment, name
   `[A-Za-z_][A-Za-z0-9_]*`), no wildcards, no trailing slash except `/` itself. The handler gets
   `request` with `params: Record<string, string>` (decoded with `decodeURIComponent`; a segment
   that fails to decode is 400 `{"error":"INVALID_REQUEST","message":"Invalid request."}`).
3. Matching: the first key whose pattern matches the path (table order) and whose method equals
   the request's; `HEAD` falls back to a `GET` key for the same pattern when no `HEAD` key exists.
   A path no pattern matches: 404 `{"error":"NOT_FOUND","message":"Route not found."}`. A path
   that matches but no method: 405 `{"error":"METHOD_NOT_ALLOWED","message":"Method not allowed."}`
   with `Allow` listing that pattern's methods, sorted, comma and space separated (`GET, HEAD`
   when only `GET` is declared).
4. `defineRoutes` throws at definition, naming the key, for a duplicate key or an invalid key
   (`Invalid route <key>`), so a bad table fails startup.
5. A stub that does not use `defineRoutes` is unchanged.

**Emitted output.** `src/modules/entry.ts`, `src/runtime/tile-http.ts`, the process files of tiles
with route stubs (the `stubRoutes(...)` argument), `.jeeves/manifest.json`, `.jeeves/report.json`.
Pinned paths: none expected (the processes-off exports emit neither file); if
`processes-off.test.ts` fails, Rule 7.

**Offline tests** (fail before, pass after; load the emitted `entry.ts` and the emitted service):
`defineRoutes` with `GET /links/:id`, `PATCH /links/:id`, `POST /links`: `GET /links/a%20b` gives
`params.id` `a b`; `HEAD /links/x` reaches the GET handler; `DELETE /links/x` is 405 with
`allow: "GET, HEAD, PATCH"`; `/other` is 404; duplicate key throws; `GET /x/` (trailing slash)
throws at definition. On the emitted service with `requestTimeoutMs` 300 and a stub whose entry
awaits its `signal`: the signal aborts with `DEADLINE` within 300 ms plus timer slack and the
answer is the admission's 503; a client that disconnects aborts with `CLIENT_CLOSED`; a normal
answer leaves the signal unaborted.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=wiring`.
Nothing user-visible in the studio: no mouse check.
**Regeneration proof:** shared; then in `after-probe` with the probe bodies, `GET
…/front-probe/env` still answers (the probe body uses no table), and a body added for the proof
using `defineRoutes` answers 405 with `Allow` for a `PUT`.
**Commit:** `QL02: route stubs get a deadline signal and a route table`.

### QL03 — Database stubs get a scoped transaction

**Status:** ready (replaces the deferred QG13). **Depends:** none.

**Goal:** a stub runs several statements in one transaction on one connection, retried on a
serialization failure, with a broken commit reported as unknown and never as success.

**Found (arm A, VE; arm B).** Q03's `/tx` probe: after `execute("BEGIN")` the pool hands an
`idle in transaction` connection to the next caller. A's remedy writes every multi-row invariant
as a PL/pgSQL function. B's `platform/db/transaction.ts` (130 lines) is used by every write in
`links/` and `session/`: one reserved client, READ COMMITTED, a scoped handle that refuses
transaction-control text, retry on `40001`/`40P01` (3 attempts), a connection-level `COMMIT` error
is `UnknownOutcomeError`.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/modules/dependencies.ts.template`: new
  `export interface Tx { query<Row>(sql, values?): Promise<Row[]>; execute(sql, values?): Promise<{ rowCount: number }> }`
  and `DatabaseReadWriter.transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>` with the doc
  comment "One transaction on one connection: BEGIN, your statements, COMMIT; ROLLBACK when fn
  throws. A serialization failure or deadlock reruns fn (at most 3 attempts). Don't send BEGIN,
  COMMIT or ROLLBACK yourself."
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`,
  `databaseClient`: imports `transaction` from `./transaction.ts` (inside the
  `@database-import-start` section) and implements the method.
- `jeeves-generator/templates/local-v2/assets/src/runtime/transaction.ts.template`: unchanged.
- `jeeves-generator/src/v2/primitives.ts` (`clientLibraries`): the database section needs
  `transaction`, emitted as `src/runtime/transaction.ts` unless `local.durability` already emits
  it (as QG04 did for `valkey.ts`: one writer, same bytes).
- Tests: `jeeves-generator/src/v2/module-clients.test.ts` (the fake `pg`), `client-wiring.test.ts`
  (the emitted file set), `tile-processes.test.ts` (the stub stack's list of added paths).
- Docs: `jeeves-generator/README.md` (Module clients, the `databaseClient` sentence),
  `docs/studio.md` if it describes a stub's database client, `docs/template-gaps.md` (no row
  changes; QG13 was never a row).

**Invariants.**
1. `transaction(fn)` calls `transaction(pool, …)` from `./transaction.ts` with a `Tx` whose
   `query` returns `rows` and `execute` returns `{ rowCount }` (0 when pg gives null), both on the
   reserved client, inside `BEGIN` … `COMMIT`.
2. SQL whose text, after leading whitespace, starts with `begin`, `start transaction`, `commit`,
   `end`, `rollback`, `abort`, `savepoint`, `release` or `prepare transaction` (case-insensitive)
   is refused before it is sent: `Error("Transaction control is owned by transaction()")`.
3. When `fn` throws, or a statement fails, the transaction rolls back and the error is rethrown;
   a `Tx` used after its transaction ended rejects (`transaction.ts`'s `assertTransaction`).
4. When the error has SQLSTATE `40001` or `40P01` and fewer than 3 attempts have run, the whole
   `fn` runs again on a new transaction after 20 ms × attempt number (20 ms, then 40 ms); the third
   failure is rethrown.
5. When `fn` resolved and the `COMMIT` itself failed with a connection-level error (SQLSTATE class
   `08`, `57P01`, `57P02`, or no SQLSTATE), the rejection is `Error("Transaction outcome unknown")`
   with `name` `"TransactionOutcomeUnknown"`, never the result. A `COMMIT` the server answered
   with another SQLSTATE rejects with that error (rolled back).
6. `query` and `execute` on the client itself are unchanged; `transaction.ts` is unchanged; the
   pool's `statement_timeout` and `query_timeout` (QG17) apply inside the transaction.

**Emitted output.** `src/modules/dependencies.ts`, `src/runtime/module-clients.ts`,
`src/runtime/transaction.ts` (new in stub-only exports with processes on), `.jeeves/manifest.json`,
`.jeeves/report.json`. Pinned (Rule 7): `src/modules/dependencies.ts` in frozen-v2,
v2-module-design and stub-stack, and `.jeeves/manifest.json`; any other: stop.

**Offline tests** (fake `pg` recording per-client statements; fail before, pass after): BEGIN, two
statements and COMMIT on one client while a parallel `query` uses another; a throwing `fn` gives
ROLLBACK and no COMMIT; `tx.execute("BEGIN")` rejects with the control message and nothing is sent;
a `40001` on the first attempt reruns `fn` (two BEGINs, one COMMIT) after 20 ms with fake timers;
three `40001`s reject with the third error; a COMMIT rejecting with `code: "08006"` gives
`TransactionOutcomeUnknown`; a COMMIT rejecting with `code: "40001"` on the third attempt gives
that error. `client-wiring.test.ts`: the stub stack emits `src/runtime/transaction.ts` once from
`local.primitives`, and v2 (favorites, durability) emits it once from `local.durability` with the
same bytes.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=wiring`,
`--suite=core`. Nothing user-visible: no mouse check.
**Docker proof:** `after-probe` with the probe bodies plus a proof body `…/front-probe/tx2`
that inserts two rows in `transaction` and throws before returning: 0 rows after; without the
throw 2 rows; while it runs, `SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in
transaction'` is 0 after the request completes.
**Commit:** `QL03: database stubs get a scoped transaction`.

### QL04 — Route stubs get idempotency records

**Status:** after the owner's decision D4. **Depends:** QL02, QL03.

**Goal:** a stub makes a create or payment request idempotent with one call: the same key and the
same request return the stored 2xx answer, a different request under the key is a conflict, and
the record expires after 24 hours.

**Found (arm B; both arms, DI).** B's `links/idempotent.ts` and `idempotency.ts` (126 lines) plus a
table: insert the key row first (`ON CONFLICT DO NOTHING`), a concurrent holder on another replica
waits on the primary key, replay the stored body, 409 on a different request hash, only 2xx stored,
24-hour window on `(scope_kind, scope_id, key)`. The frozen HTTP contract requires
`Idempotency-Key` on four routes; A writes the same in product SQL.

**Files.**
- New `jeeves-generator/templates/local-v2/assets/src/runtime/idempotency.ts.template`:
  `requestHash`, `takeKey`, `storeResult`, `sweepExpired`, `IdempotencyConflict`.
- `jeeves-generator/templates/local-v2/assets/src/modules/dependencies.ts.template`:
  `IdempotencyScope`, `IdempotentResult`, `DatabaseReadWriter.idempotent(...)`.
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`
  (`databaseClient`: `idempotent`, and a `periodic` sweep registered on `scope`).
- `jeeves/packages/spec/src/generation-catalog.ts`: policy record `idempotency`
  (`"idempotency-policy"`: `{ windowSeconds: 86400, keyMinCharacters: 1, keyMaxCharacters: 255, sweepSeconds: 60, sweepBatch: 1000, stored: "2xx-only" }`).
- `jeeves-generator/src/v2/primitives.ts` (emit `idempotency.ts` with the database section).
- `jeeves-generator/src/v2/client-wiring.ts` (`stubClients(...).mount.local`): for every database
  a stub of the process writes, the migration file `infra/postgres/<database id>/050-jeeves-idempotency.sql`
  (emitted as a `generated-scaffold` file, as `src/v2/favorites.ts` emits `100-<selection>.sql`)
  and grant rows for the tile's login, in the same shape Favorites uses for its table.
- Tests: `module-clients.test.ts`, new `idempotency.test.ts`, `client-wiring.test.ts`,
  `tile-processes.test.ts`, `product-sql.test.ts` (migration order).
- Docs: `jeeves-generator/README.md` (Module clients; Provisioning for stubs: the Database row
  gains "and `jeeves.idempotency_records`"), `docs/studio.md`.

**Invariants.**
1. The migration creates `CREATE SCHEMA IF NOT EXISTS jeeves;` and
   `CREATE TABLE IF NOT EXISTS jeeves.idempotency_records (tile text NOT NULL, scope_kind text NOT NULL, scope_id text NOT NULL, idem_key text NOT NULL, request_hash bytea NOT NULL, status integer NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY (tile, scope_kind, scope_id, idem_key));`
   and `CREATE INDEX IF NOT EXISTS idempotency_records_expires ON jeeves.idempotency_records (expires_at);`.
   Only the logins of tiles whose stubs write that database get `USAGE` on `jeeves` and `SELECT,
   INSERT, UPDATE, DELETE` on the table; the setup-only owner creates it; no `PUBLIC` access.
2. `requestHash({ method, route, params?, body? })` is SHA-256 over the UTF-8 of
   `JSON.stringify` of `{ method: upper, route, params: sorted keys, body: canonical }` where
   canonical JSON sorts object keys at every depth and keeps array order; `undefined` body is
   `null`.
3. `idempotent({ scope, key, hash }, fn)`: `scope.kind` matches `^[a-z][a-z0-9-]{0,31}$`,
   `scope.id` 1–255 characters, `key` 1–255 visible ASCII (`[\x21-\x7e]`); else
   `Error("Invalid idempotency key")` before any statement. Inside one `transaction` (QL03): delete
   the row for this key whose `expires_at <= now`; insert the row with `status` 0 and `response`
   `{}`, `created_at` now, `expires_at` now + 86,400 s, `ON CONFLICT DO NOTHING`; if inserted, run
   `fn(tx)`: a result with `status` 200–299 is stored (`UPDATE … SET status, response`) and the
   transaction commits; any other status rolls the transaction back (the stub's writes too) and
   the result is returned with `replayed: false`; if not inserted, read the row: a different
   `request_hash` throws `IdempotencyConflict` (`name` `"IdempotencyConflict"`); the same hash
   returns `{ status, body: response, replayed: true }` without running `fn`. A row that vanished
   between the two statements rejects `Error("Idempotency record changed; retry")`.
4. Every 60 s the process runs `sweepExpired`, which takes `pg_try_advisory_lock(hashtext('jeeves.idempotency'))`
   on one connection, deletes at most 1,000 expired rows, releases the lock, and logs a failure
   line `idempotency sweep <tile>` when it throws; a copy that doesn't get the lock does nothing.
   The sweep is owned by `scope` and stops at drain.
5. Loop stubs may call `idempotent` too (same rules). A database a stub only reads gets no table
   and no grant.

**Emitted output.** `src/modules/dependencies.ts`, `src/runtime/module-clients.ts`,
`src/runtime/idempotency.ts`, `infra/postgres/<db>/050-jeeves-idempotency.sql`, `infra/local.json`,
`README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`. Pinned: `src/modules/dependencies.ts`
and `.jeeves/manifest.json` in the three exports (processes off provisions no stub store, so no
migration appears there); any other: stop.

**Offline tests.** `idempotency.test.ts`: canonical hash equal for `{a:1,b:2}` and `{b:2,a:1}`,
different for a different body or route. `module-clients.test.ts` (fake pg, fake timers): the
statement order BEGIN, DELETE, INSERT, [fn], UPDATE, COMMIT for a new key; a replay runs no fn and
returns the stored body; a different hash throws `IdempotencyConflict` after ROLLBACK; a 403 result
rolls back and is not stored; an invalid key throws before BEGIN; the sweep runs at 60 s with the
advisory lock and stops at drain. `client-wiring.test.ts`: the stub stack's writing database gets
the migration and grants; a read-only database gets none. `product-sql.test.ts`: `050-` files
apply before `100-` and product SQL.

**Required regressions:** check, e2e, build; Docker phase `--suite=wiring`, `--suite=core`,
`--suite=regeneration`. No mouse check.
**Docker proof:** `after-probe` with a proof body `POST …/front-probe/idem` reading
`Idempotency-Key`: first call 201 `replayed:false`; same key and body 201 `replayed:true`, one row
in `jeeves.idempotency_records`; same key, other body → the body maps `IdempotencyConflict` to 409;
`psql` inserts a row with `expires_at` in the past, and it is gone within 70 s.
**Commit:** `QL04: route stubs get idempotency records`.

### QL05 — Stubs declare their settings and startup refuses an invalid one

**Status:** after the owner's decision D6. **Depends:** none.

**Goal:** a stub declares the settings it reads, each typed, and its process refuses to start,
naming the setting and never its value, when one is missing or invalid.

**Found (arm B).** `platform/config/registry.ts` (1,106 lines) and `validate.ts` (557) declare and
validate 62 settings per process kind so that a process refuses `missing-required-value`,
`placeholder-credential` and the rest by name (R01). A Jeeves stub reads `process.env` itself; Q03
F6 and F12: QRWTY's Session API got no configuration seam, and its adapters read unvalidated
values.

**Files.**
- New `jeeves-generator/templates/local-v2/assets/src/runtime/settings.ts.template`:
  `declareSettings`, `text`, `integer`, `url`, `secret`, `keyRing`, `optional`, `readSettings`,
  types `SettingsDeclaration`, `SettingsOf`.
- `jeeves-generator/src/v2/module-stubs.ts`: the stub body's initial text and the `.slots.ts`
  `Dependencies` type; emit `src/runtime/settings.ts` beside `dependencies.ts` (same owner,
  `local.module-stubs`).
- `jeeves-generator/src/v2/client-wiring.ts`: each stub's dependency object gets `settings`.
- Tests: `module-stubs.test.ts`, `client-wiring.test.ts`, `tile-processes.test.ts` (load the
  emitted `settings.ts`), `module-clients.test.ts` if it builds dependency objects.
- Docs: `jeeves-generator/README.md` (a paragraph "Settings a stub declares" after Module clients),
  `docs/studio.md` (the stub section), `docs/glossary.md` (Stub: one sentence).

**Invariants.**
1. A declaration maps names to kinds: `text({ max?: number })`, `integer({ min?, max? })`,
   `url({ protocols?: ("http:" | "https:")[] })` (default both; absolute, no credentials),
   `secret()`, `keyRing()`; `optional(kind)` wraps any kind. A name matches
   `^[A-Z][A-Z0-9_]{0,63}$` and doesn't start with `JEEVES_`, `OIDC_`, `PG` or equal `SECRET_DIR`
   or `PORT`; otherwise `declareSettings` throws `Error("Reserved setting name <NAME>")`.
2. `readSettings(module, declaration)` reads a non-secret value from `process.env[NAME]` and a
   `secret()` or `keyRing()` from the file `${process.env.SECRET_DIR ?? "/run/secrets"}/<name>`
   where `<name>` is the setting name lower-cased with `_` as `-`, with one trailing newline
   removed. Missing (unset, empty, or no file) when not optional, or invalid for its kind, throws
   `Error("Invalid setting <NAME>")`; the value never appears in the error or a log line. A
   `keyRing` is a JSON array of `{ id: string, key: string }`, 1–8 entries, `id` 1–32 of
   `[A-Za-z0-9_-]`, `key` base64url of at least 32 bytes; the first entry is `current`.
3. The result is a frozen object typed `SettingsOf<typeof declaration>`: strings, numbers, `URL`
   values, `Uint8Array` secrets, and `{ current, entries }` rings with `Buffer` keys.
4. The generated initial stub body has, after its existing imports,
   `import { declareSettings } from "../../runtime/settings.ts";` and, before the entry
   function, `export const settings = declareSettings({});` with the comment "The settings this
   module reads, by name: text(), integer(), url(), secret() or keyRing(); optional(kind) for an
   optional one. Values come from the process environment, secrets from SECRET_DIR files." The
   `.slots.ts` `Dependencies` type gains `settings: SettingsOf<typeof import("./<module>.ts")>`
   where `SettingsOf` resolves to the declaration's values or `Record<never, never>` when the
   module exports none.
5. The process file reads each stub's declaration **before building any client**:
   `readSettings("<module>", (mod as { settings?: SettingsDeclaration }).settings ?? declareSettings({}))`,
   so an older stub without the export builds and runs; a refusal is the `startup-failed` line
   `Error: Invalid setting <NAME>`.
6. Compose sets nothing for these (the application's `compose.override.yaml` does, QG02); the
   README says so and names the file convention.

**Emitted output.** `src/runtime/settings.ts`, every stub's `src/modules/<host>/<module>.ts` and
`.slots.ts`, the process files, `README.md`, `.jeeves/manifest.json`, `.jeeves/report.json`.
Pinned: `src/runtime/settings.ts`, the stubs' `.ts` and `.slots.ts`, `.jeeves/manifest.json` in the
three exports; any other: stop.

**Offline tests** (emitted `settings.ts` loaded with a scratch `SECRET_DIR`): each kind accepts
and refuses (`integer` out of range, `url` with credentials, `secret` file missing, ring with 31-byte
key), the message names the setting and not the value (assert the value string is absent from
`error.message`); reserved names refused; `optional` returns `undefined`; `module-stubs.test.ts`:
the two new lines and the `Dependencies.settings` type; a process file in `tile-processes.test.ts`
reads settings before `databaseClient`; `update:v2 --check` of YouTube v4's app refuses nothing
(the stub bodies are `keepChanged` with shadows).

**Required regressions:** check, e2e, build; Docker phase `--suite=wiring`, `--suite=regeneration`.
No mouse check.
**Docker proof:** `after-probe` with a probe body declaring `PROBE_GREETING: text()` and
`PROBE_TOKEN: secret()`: without them `app-front` fails startup with `Invalid setting
PROBE_GREETING`; with `compose.override.yaml` setting the variable and a secret file, Front starts
and `…/front-probe/settings` answers the greeting and the token's length (never the token).
**Commit:** `QL05: stubs declare their settings and startup refuses an invalid one`.

### QL06 — A keys library for stubs: rings, signatures, sealed values and cursors

**Status:** ready after QL05. **Depends:** QL05.

**Goal:** a stub signs and verifies short values, seals and opens secrets at rest and issues
pagination cursors bound to an account, with key rotation, without writing crypto.

**Found (arm B).** `platform/config/keyring.ts`, `platform/crypto/aead.ts`, `account/cursor.ts` and
the HMAC helpers in `session/guest.ts` (about 150 lines) serve the guest handle, CSRF, sealed claim
proofs, sealed tokens and list cursors; every verify accepts any ring key and signs with the first.

**Files.** New `jeeves-generator/templates/local-v2/assets/src/runtime/keys.ts.template`;
`jeeves-generator/src/v2/module-stubs.ts` (emit `src/runtime/keys.ts` beside `settings.ts`); tests
new `jeeves-generator/src/v2/keys.test.ts` (loads the emitted file), `client-wiring.test.ts`,
`tile-processes.test.ts` (added path); docs `jeeves-generator/README.md` (one paragraph after the
settings paragraph).

**Invariants.**
1. `sign(ring, purpose, text): string` is base64url of HMAC-SHA256 with `ring.current.key` over
   `${purpose}\n${text}`; `verify(ring, purpose, text, tag): boolean` compares with
   `timingSafeEqual` against every entry and is true when any matches; a malformed tag is false.
2. `seal(ring, purpose, plaintext: Uint8Array, aad: string): Uint8Array` derives a 32-byte key by
   HKDF-SHA256 (`crypto.hkdfSync("sha256", entry.key, "", purpose, 32)`), encrypts with
   AES-256-GCM, a random 12-byte nonce and `aad` as additional data, and returns
   `0x01 | id length (1 byte) | id (UTF-8) | nonce (12) | ciphertext | tag (16)`;
   `open(ring, purpose, sealed, aad)` finds the entry by `id`, decrypts, and throws
   `Error("Cannot open sealed value")` for an unknown id, a wrong `aad`, a wrong purpose or a
   tampered byte.
3. `encodeCursor(ring, subject, position: Record<string, string>): string` is
   `base64url(JSON {v:1, p: position}) + "." + sign(ring, "cursor", subject + "\n" + payload)`;
   `decodeCursor(ring, subject, cursor)` returns the position, or `null` for a cursor over 512
   characters, a bad shape, a failed signature or another subject.
4. The library imports only `node:crypto`; keys are `Buffer`s from a `keyRing()` setting (QL05).

**Emitted output.** `src/runtime/keys.ts`, `.jeeves/manifest.json`, `.jeeves/report.json`. Pinned:
`src/runtime/keys.ts` and `.jeeves/manifest.json` in the three exports.
**Offline tests.** Sign with ring A verifies; rotate (new first entry, old kept) → old tags still
verify, new tags use the new id; seal/open round trip; wrong aad, purpose, id or a flipped byte
throws; cursor bound to the subject (another subject gives null); 513-character cursor null.
**Required regressions:** check, e2e, build. No mouse check, no Docker phase (pure library; the
regeneration proof's build covers the emitted file).
**Commit:** `QL06: a keys library for stubs: rings, signatures, sealed values and cursors`.

### QL07 — A Scheduled task module kind with its interval

**Status:** after the owner's decision D2 (replaces the deferred QG14). **Depends:** none.

**Goal:** a Worker can hold a **Scheduled task** module whose one setting is how often it runs; by
mouse and by chat it is added, set, connected to the stores it uses, and reported as a stub until
QL08 generates its loop.

**Found (arm B; arm A).** B runs cleanup, deletions and reconciliation as job routes called every
minute by a scheduler process (`processes/test-scheduler.ts`, 133 lines; Cloud Scheduler in
cloud), each run leased in the database; A's remedy for G11 is the same shape in
`compose.override.yaml`. Jeeves's `periodic()` runs template sweeps only; QG14 waited for the
owner's decision on the kind.

**Files.**
- `jeeves/packages/spec/src/studio-components.ts`: `studioComponentKinds` gains
  `"scheduled-task"` after `"custom"`; `studioScheduledTaskSettingsSchema =
  z.strictObject({ kind: z.literal("scheduled-task"), everySeconds: z.number().int().min(1).max(86400) })`
  in the settings-by-kind map; defaults `{ kind: "scheduled-task", everySeconds: 60 }`; the
  definition: `name: "Scheduled task"`, `description: "Runs your code every N seconds in a
  worker; copies of the worker run a tick once."`, `thirdParty: []`, `browserHost: false`,
  `hosts: ["worker"]`, `scope: "generic"`, `slots: [{ ...slot("uses", allTargets, "uses",
  "optional"), many: true }]`, `generation: stub`, `targets: allTargets`, `fields:` one numeric
  field `everySeconds`, label `Every (seconds)`, range 1–86400, group `Options`, help `"How often
  a tick runs. Copies of the worker share one lease, so each tick runs once."`, built with the
  numeric field helper the file uses for the rate limiter's `windowSeconds`.
- `jeeves/packages/spec/src/studio-modules.ts`: `studioComponentVisuals["scheduled-task"] =
  { icon: "clock", color: "worker" }`.
- `jeeves/apps/web/src/studio/studio-glyphs.ts`: `clock:
  "<circle class='a' cx='12' cy='12' r='8.6'/><circle class='c' cx='12' cy='12' r='6.2'/><path class='i' d='M12 7.8V12l3.1 2'/>"`.
- `jeeves/apps/web/src/studio/module-groups.ts`: the Custom group's kinds become
  `["custom", "scheduled-task"]`.
- `jeeves/packages/spec/src/module-generation.ts` (`moduleStatuses`): a `scheduled-task` with no
  `uses` link to a Database the host writes is a Stub with the reason `"Needs a database it
  writes, for its lease."`; with one it is a Stub with the usual stub wording.
- `jeeves/packages/spec/src/generation-resolver.ts`: the process stub row's `role` gains
  `"schedule"`: a `scheduled-task` stub in a worker process with such a database gets
  `{ role: "schedule", everySeconds, lease: <that database's element id> }` (the lowest element
  id when several); without one, `role: "library"` and a required `custom` gap
  `schedule-<module>` with the same reason text.
- Every exhaustive `Record<StudioComponentKind, …>` TypeScript then flags (`design-readiness.ts`,
  `resolve-contracts.ts`, `studio-modules.ts`, web tests): add the kind with the value Custom has.
- `jeeves-generator/src/v2/module-stubs.ts`: a `schedule` role is treated as `library` until QL08
  (no file change beyond accepting the role in its `roles` map type).
- Chat: `docs/chat-tool-schemas.md` if it lists module kinds; `jeeves/apps/server/src/eval/fixtures/rf00.json`
  only if `pnpm eval:chat` fails on the kind list (then add the kind there and say so).
- Tests: `jeeves/packages/spec/src/studio-modules.test.ts`, `module-generation.test.ts`,
  `studio-operations.test.ts`, `generation-resolver.test.ts` or `runnable-processes.test.ts`,
  `jeeves/apps/web/src/studio/module-groups.test.ts`, `jeeves/apps/web/src/canvas/detailedView.test.ts`
  and `tiles/ContainerTile.test.tsx` (kind counts), `jeeves/apps/web/e2e/module-authoring.spec.ts`
  if it counts menu items.
- Docs: `jeeves/CATALOG.md` (Components table row and a bullet), `docs/studio-settings.md`
  (Components table row), `docs/studio.md` (module menu), `jeeves-generator/README.md` (one
  sentence: a Scheduled task is a stub until QL08).

**Invariants.** `addModule` of kind `scheduled-task` in a Service is refused with `Scheduled task
can't go in <name>; it goes in a worker.`; in a Worker it is added as "Scheduled task" with
`everySeconds` 60; the inspector shows **Every (seconds)** under Options and refuses 0 and 86,401;
`connectModule` fills `uses` like Custom's; chat's `editableSettings` lists `everySeconds`; the
status wording above; export of a design with the kind is not refused (it is a stub);
`report.processes.tiles[].stubs[]` carries `role: "schedule"` with `everySeconds` and `lease`.

**Emitted output.** None for existing designs (`.jeeves/report.json` unchanged: no fixture has the
kind). Pins: none.
**Offline tests** (fail before, pass after): the refusal text; defaults; range; both statuses; the
resolver row; `moduleGroups` has 6 kinds in Custom's group order; the glyph exists.
**Mouse check** (Rule 6, `jeeves/apps/web/e2e/ql07-check.spec.ts`): new project; add a Worker; its
module `+` menu's Custom group shows **Scheduled task**; add it; the module page shows Every
(seconds) 60; set 5; connect it to a new Database; its status reads "You write it"; Generate
project → Preview lists it as a stub; both sizes; delete the project.
**Required regressions:** check, e2e, build, evals, mouse.
**Commit:** `QL07: a Scheduled task module kind with its interval`.

### QL08 — Scheduled tasks run every N seconds under a shared lease

**Status:** after D2 and D4. **Depends:** QL03, QL07.

**Goal:** a Scheduled task's stub runs every N seconds in its Worker's process; when several copies
run, each tick runs once; a tick that throws is logged and the next one runs; `pnpm stop` waits for
the tick in hand.

**Files.**
- New `jeeves-generator/templates/local-v2/assets/src/runtime/tile-schedule.ts.template`:
  `startModuleSchedule(scope, log, row, tick)`.
- `jeeves-generator/templates/local-v2/assets/src/modules/entry.ts.template`:
  `export type ModuleTick = { module: string; scheduledAt: Date; holder: string }`.
- `jeeves-generator/src/v2/module-stubs.ts`: a `schedule` stub's body is
  `export async function <entry>(dependencies: Dependencies, tick: ModuleTick): Promise<void>`
  throwing `Not implemented: <name>`; its `.slots.ts` keeps every `uses` slot as a dependency
  (the lease database included).
- `jeeves-generator/src/v2/loop-wiring.ts` (`loopMounts`, the stub part): for a `schedule` stub,
  a mount that imports `startModuleSchedule` and `ModuleTick`, with `started` check text
  `scheduled every <N> s` and a report row.
- `jeeves-generator/src/v2/registry.ts` (`V2ProcessReport`): `schedules?: { module: string;
  everySeconds: number; lease: string }[]`; `tile-processes.ts` (`reportRow`, `scaffolds`: emit
  `tile-schedule.ts` when any mount schedules; the README's process line).
- `jeeves-generator/src/v2/client-wiring.ts` (`stubClients(...).mount.local`): for the lease
  database, the migration `infra/postgres/<database id>/050-jeeves-schedule.sql` and grant rows for
  the tile's login (`USAGE` on `jeeves`; `SELECT, INSERT, UPDATE` on `jeeves.schedule_leases`).
- Tests: new `jeeves-generator/src/v2/tile-schedule.test.ts` (emitted file, fake pool, fake
  timers), `module-stubs.test.ts`, `loop-wiring.test.ts`, `tile-processes.test.ts`,
  `client-wiring.test.ts`, `product-sql.test.ts`.
- Docs: `jeeves-generator/README.md` (a "Scheduled tasks" paragraph after Consume loops),
  `docs/studio.md`, `jeeves/CATALOG.md` (the kind's Generation column: still Stub; the bullet
  says what the process does).

**Invariants.**
1. The migration: `CREATE SCHEMA IF NOT EXISTS jeeves; CREATE TABLE IF NOT EXISTS
   jeeves.schedule_leases (module text PRIMARY KEY, holder text NOT NULL, held_until timestamptz NOT NULL);`.
2. `startModuleSchedule` uses `periodic(scope, effect, everySeconds * 1000, onFailure)` from
   `./process.ts`. `effect`: one statement on the lease database's pool,
   `INSERT INTO jeeves.schedule_leases (module, holder, held_until) VALUES ($1, $2, clock_timestamp() + $3 * interval '1 second') ON CONFLICT (module) DO UPDATE SET holder = EXCLUDED.holder, held_until = EXCLUDED.held_until WHERE jeeves.schedule_leases.held_until <= clock_timestamp() RETURNING holder`
   with `$3 = everySeconds`; no row returned → the tick is skipped (another copy holds the lease);
   a row → `tick({ module, scheduledAt: new Date(), holder })` is awaited. The holder is
   `${tile}-${process.pid}-${randomUUID()}`, fixed per process.
3. A tick that throws "Not implemented" logs the `not-implemented` line (`what`, `module`,
   `action: "tick skipped"`) through the process's rate-limited log; any other error logs a failure
   line `schedule <module>`; an unreachable lease database logs `schedule <module>` too and the
   next tick runs; the process never exits for a tick.
4. The first tick runs when the process is ready (as `periodic` does), then every `everySeconds`
   after the previous tick settled; two copies started together run each interval's tick once
   (the lease's `held_until` is the gate, not the timer).
5. Drain: `periodic`'s own drain awaits the tick in hand; the lease is not released early (it
   expires by time).
6. A `schedule` stub's dependencies are built like a library stub's; it has no HTTP route and no
   queue.

**Emitted output.** `src/runtime/tile-schedule.ts`, `src/modules/entry.ts`, the Worker's process
file, the stub's `.ts` and `.slots.ts`, `infra/postgres/<db>/050-jeeves-schedule.sql`,
`infra/local.json`, `README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`, all only for
designs with the kind. Pinned: none expected.
**Offline tests.** The emitted runtime with a fake pool: a returned row runs the tick, an empty
result skips it; ticks at 0, N, 2N s with fake timers; a throwing tick logs and the next runs; a
"Not implemented" tick logs the not-implemented line; drain waits for a tick that resolves 100 ms
later; the statement text equals invariant 2's. Wiring tests on a scratch design (a Worker with a
Scheduled task every 5 s on a database): the mount lines, the report row, the migration and grants.
**Required regressions:** check, e2e, build; Docker phase `--suite=core`, `--suite=wiring`.
**Docker proof:** the scratch design exported; the stub body inserts `(holder, clock_timestamp())`
into a product table `m_<module>.ticks`; `first-run`; start a second copy with
`docker compose --profile '*' run -d --no-deps app-<worker>`; after 60 s the table has 11–13 rows and
no two rows within 4 s of each other; `pnpm stop` and `docker rm -f` of the second copy exit 0 with
no tick cut short (the last row's time is before the stop's `drain` line).
**Commit:** `QL08: scheduled tasks run every N seconds under a shared lease`.

### QL09 — A Custom module can call its tile's Cache reader

**Status:** after the owner's decision D5. **Depends:** none.

**Goal:** a Custom module in a Service uses the tile's Cache reader as an in-process dependency,
`get(input)`, so a redirect or lookup stub gets the cache read template's single flight, absolute
expiry and recovery without mounting the template's HTTP route.

**Found (arm A, VE; arm B).** Q01/Q02 F8: QRWTY left `positive-cache-read` unused because it is an
HTTP route a stub can't call, and A's Q08 rewrites the cache in a stub. B's `redirect/route-cache.ts`
and `entry.ts` (462 lines) are that rewrite: single flight, a bounded authoritative read, an
absolute `validatedUntil`. Jeeves's reader already has single flight, uncached misses, an absolute
`PXAT` and the 5-second skip (PF07); only its surface is wrong.

**Files.**
- `jeeves/packages/spec/src/studio-components.ts`: Custom's `uses` slot also accepts a module
  target that is a `cache-reader` in the same host (as Favorites' `items` accepts a Data access),
  `in-process`; `moduleConnectOptions` offers it for a Custom module's drag.
- `jeeves/packages/spec/src/studio-operations.ts` (`connectModule`): `slot: "uses"`, `target:
  { module }` for that case; a reader in another tile or a non-reader module keeps today's rule.
- `jeeves/packages/spec/src/generation-resolver.ts`: the Custom stub's slot connection carries
  the reader's `component` target (as module targets already do).
- `jeeves-generator/templates/local-v2/assets/src/modules/dependencies.ts.template`:
  `export interface CacheReaderCall<I = { key: string }, R = unknown> { get(input: I): Promise<R | null> }`.
- `jeeves-generator/src/v2/module-stubs.ts` (`dependencyType`): a component target whose module
  is a `cache-reader` lead with a `positive-cache-read` selection → `CacheReaderCall`.
- `jeeves-generator/src/v2/http-wiring.ts` (`positiveCacheRead`): when a stub of the same process
  links the lead, the mount omits `configure` and `routes` (report `template.level: "library"`,
  `config` without `route`); `setup`, `initialize` and `started` are unchanged.
- `jeeves-generator/src/v2/client-wiring.ts`: the dependency value for such a target is
  `{ get: (input) => <reader const>.read(input) }`, where `<reader const>` is the mount's
  `const <camel(selection id)>`.
- Tests: `studio-operations.test.ts`, `module-generation.test.ts`, `http-wiring.test.ts`,
  `client-wiring.test.ts`, `module-stubs.test.ts`; `jeeves/apps/web/e2e/module-authoring.spec.ts`
  for the drag.
- Docs: `jeeves/CATALOG.md` (Custom's slots; the Cache reader bullet), `docs/studio-settings.md`
  (Components: Custom), `docs/studio.md` (connect mode), `jeeves-generator/README.md` (Cache
  reader paragraph), `docs/template-gaps.md` (gap 7's row: "A Custom module that links the reader
  shapes its own answer (QL09)").

**Invariants.** The reader's hooks file, settings and startup checks are unchanged; `get` runs the
same `read` as the route did and gives `null` for an ineligible or missing record; with a linking
Custom module the route `GET /modules/<lead>/:key` answers 404 `NOT_FOUND` like any unmounted
path and the report row says `library`; without one, everything is as today; a Custom module in
another tile can't link the reader (refused: `<Custom> can only call a Cache reader in its own
tile.`).

**Emitted output.** The linking tile's process file, `src/modules/dependencies.ts`, the Custom
module's `.slots.ts`, `README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`. Pinned:
`src/modules/dependencies.ts` and `.jeeves/manifest.json` in the three exports; any other: stop.
**Offline tests.** Connect options and the refusal; the resolver's target; the mount with and
without a linking stub; the dependency value and type; the report row.
**Mouse check** (`ql09-check.spec.ts`): in a project with a Service holding a Data access on a
Database, a Cache reader on a Cache with the Data access as loader, and a Custom module: Detailed
view, drag from the Custom row's dot to the Cache reader row → the in-process link appears; the
Custom's page lists the reader; Generate → Preview shows the reader as `library`; right-click the
link → Disconnect → the route is back in Preview; both sizes; delete the project.
**Required regressions:** check, e2e, build, evals, mouse; Docker phase `--suite=faults` (B06, the
cache read), `--suite=wiring`.
**Docker proof:** a scratch design (the probe's Front plus a Data access, a Cache reader and the
Custom stub linking it) exported with hooks loading a row from `m_front_probe.records`:
`…/front-probe/lookup?k=a` answers the record and the second call is a cache hit (the reader's
`cache` info line and no second `SELECT` in the database log); `docker pause` the cache → the
lookup still answers from the database within 0.5 s; `GET /api/front/modules/<reader>/a` → 404.
**Commit:** `QL09: a Custom module can call its tile's Cache reader`.

### QL10 — Service identity links carry workload tokens between tiles

**Status:** after the owner's decision D1. **Depends:** QL05.

**Goal:** when a direct link between two application tiles is set to **Service identity**, the
caller's `httpTarget` carries a workload token minted by the design's Identity, and the callee
answers 401 to any module request without a valid token from a tile that links to it.

**Found (arm B; both arms, DI).** B's internal routes verify `X-QRWTY-Workload-Token` (issuer,
audience = this service, `azp` in the route's allowlist) and callers obtain it by client
credentials locally (`platform/auth/tokens.ts`); the billing contract requires allowlisted
workload callers. Jeeves's link field `planned.security` has the values `Service identity`
(default), `User identity`, `Public`, `Private network` and is "intent only"; `httpTarget` sends no
credential.

**Files.**
- `jeeves/packages/spec/src/generation-resolver.ts`: for each direct connection between two tiles
  that both run processes, when `planned.security` is `"Service identity"` and the design has at
  least one `verified-identity` selection: `model.processes[callee].workload = { callers: [<caller
  tile ids, sorted>] }` and `model.processes[caller].workloadCalls = [<callee tile ids, sorted>]`;
  when it has no sign-in template, a report note on the link `workload: "intent only: no Identity
  issues tokens"` and nothing else. `"Private network"`, `"Public"` and `"User identity"` change
  nothing.
- `jeeves-generator/src/v2/local.ts` and `jeeves-generator/templates/local-v2/assets/scripts/setup.mjs`:
  `infra/local.json`'s identity entry gains `workloadClients: [{ tile, audiences: [<callee ids>] }]`;
  `setup.mjs` writes, per entry, a confidential client `<tile>-workload` (`publicClient: false`,
  `serviceAccountsEnabled: true`, `standardFlowEnabled: false`, `directAccessGrantsEnabled: false`,
  `secret` generated as the other secrets are and written to `.runtime/secrets/workload-<tile>`,
  and one `oidc-audience-mapper` per audience with `included.client.audience: "<callee>"`).
- New `jeeves-generator/templates/local-v2/assets/src/runtime/workload.ts.template`:
  `createWorkloadTokenSource({ tokenUrl, clientId, secret })` (POST
  `grant_type=client_credentials` with a 3 s deadline, cached until 30 s before `expires_in`, one
  in-flight fetch) and `createWorkloadVerifier({ issuer, jwksUrl, audience, callers })` built on
  `createPrincipalVerifier` from `./identity.ts` with `azp` mapped through `callers`.
- `module-clients.ts.template` (`httpTarget`): takes `{ tile, workload?: WorkloadTokenSource }`
  and sends `Jeeves-Workload-Token: <token>` when given; a token fetch failure rejects the call
  with `Error("Workload token unavailable")` (counted as unreachable like a tile call).
- `tile-http.ts.template`: `requireWorkload(routes, verifier)` wraps every module route of a
  callee: a missing or invalid header answers 401
  `{"error":"WORKLOAD_REQUIRED","message":"A workload token from an allowed caller is required."}`;
  `/healthz` stays open.
- `http-wiring.ts`, `client-wiring.ts`, `tile-processes.ts`, `local-contract.ts`
  (`localEndpoints`): the variables below and the report rows `workload.callers` and `calls`.
- Tests: `generation-resolver.test.ts`, `module-clients.test.ts`, `tile-guard.test.ts` (the
  verifier with the jose stand-in QG11's tests use), `composition.test.ts` / `tile-processes.test.ts`
  (environment), `local.test.ts` (the emitted `setup.mjs` text).
- Docs: `jeeves-generator/README.md` (Module clients; Endpoints from the environment table),
  `docs/studio-settings.md` (Security: "consumed with Runnable processes on: …"),
  `jeeves/CATALOG.md`, `docs/studio.md`.

**Variables** (QG06's rule and message): caller `JEEVES_WORKLOAD_TOKEN_URL` (local
`http://identity-<id>:8080/realms/<id>/protocol/openid-connect/token`), `JEEVES_WORKLOAD_CLIENT_ID`
(`<tile>-workload`), secret file `workload-<tile>`; callee `JEEVES_WORKLOAD_ISSUER`,
`JEEVES_WORKLOAD_JWKS_URL` (the sign-in's values), `JEEVES_WORKLOAD_AUDIENCE` (`<callee tile>`),
`JEEVES_WORKLOAD_CALLERS` (JSON object `{"<caller>-workload": "<caller tile>"}`). A deployment sets
its own issuer and clients.

**Invariants.** A token's `iss`, `aud` (contains the callee), `exp`, signature (RS256) and `azp`
(a key of the callers map) are all checked; the user token's `Authorization` header is untouched,
so a callee with a Sign-in guard checks both; both processes `depends_on` the identity healthy;
designs without a sign-in template are unchanged byte for byte except the report note; the local
stack behaves as before for `Private network` links.

**Emitted output.** Caller and callee process files, `src/runtime/module-clients.ts`,
`src/runtime/tile-http.ts`, `src/runtime/workload.ts`, `compose.yaml`, `infra/local.json`,
`scripts/setup.mjs`, `README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`. Pinned:
`scripts/setup.mjs` and `.jeeves/manifest.json` in the three exports (the asset text changes even
where no client is written); any other: stop.
**Offline tests.** The resolver rows for `Service identity`, `Private network` and a design with no
sign-in; the token source caches and refreshes at 30 s before expiry (fake timers, fake fetch); the
verifier accepts a token with `azp` in the map and refuses a wrong audience, an unknown `azp` and
a forged signature; `httpTarget` sends the header; a callee without the header is 401 and
`/healthz` 200; the Compose environment and the emitted `setup.mjs` clients.
**Required regressions:** check, e2e, build; Docker phase `--suite=identity`, `--suite=wiring`.
**Docker proof:** a scratch design (the probe plus a Service `Inner` with a Custom stub, a
`Service identity` link Front → Inner, a Sign-in Optional on Front): inside the network
`curl http://app-inner:3000/modules/<stub>/x` without a header → 401 `WORKLOAD_REQUIRED`; Front's
probe body calling `dependencies.inner.request("/x")` → the stub's answer; the same design with the
link set to `Private network` → the direct curl answers 501 (the stub) as today.
**Commit:** `QL10: Service identity links carry workload tokens between tiles`.

### QL11 — A Browser session module kind and its template contract

**Status:** after the owner's decision D3. **Depends:** none.

**Goal:** a Service can hold a **Browser session** module connected to the Identity and to a
Database for its sessions; the catalog, the derivation and the docs know the template it leads,
and the studio shows it as Template once QL12 installs the emitter.

**Found (arm B, VE; both arms, DI).** B's `session/` layer (about 990 generic lines) implements
code+PKCE with `openid-client`, sessions with sealed tokens, `__Host-` cookies, CSRF and
forwarding; its A14 row passed. Both contracts require that tokens never reach the browser.
Jeeves's Sign-in template verifies bearer tokens the browser holds.

**Files.**
- `jeeves/packages/spec/src/studio-components.ts`: kind `"browser-session"` after
  `"scheduled-task"`; settings schema `z.strictObject({ kind: z.literal("browser-session") })`
  with no fields; definition `name: "Browser session"`, `description: "Signs the browser in with
  the Identity and keeps a cookie session; tokens never reach the browser."`, `thirdParty:
  ["OpenID Connect"]`, `browserHost: false`, `hosts: ["service"]`, `scope: "generic"`, `slots:
  [slot("identity", ["identity"], "verify"), slot("sessions", ["database"], "read-write")]`,
  `generation: lead("browser-session")`, `targets: ["identity", "database"]`.
- `jeeves/packages/spec/src/studio-modules.ts`: visual `{ icon: "key", color: "api" }`;
  `jeeves/apps/web/src/studio/module-groups.ts`: Requests group gains `"browser-session"` after
  `"auth-guard"`.
- `jeeves/packages/spec/src/generation-catalog.ts`: policy `browserSession`
  (`"browser-session-policy"`: `{ cookie: "__Host-sid", loginCookie: "__Host-login",
  absoluteSeconds: 604800, idleSeconds: 86400, loginSeconds: 600, csrfHeader: "X-CSRF-Token",
  sessionIdBytes: 32, tokens: "aes-256-gcm-sealed", flow: "authorization-code-pkce-s256" }`) and
  template `"browser-session"` with that policy.
- `jeeves/packages/spec/src/module-generation.ts` (`planModules`, `covers`, ownership): the lead
  selects `browser-session` when both slots are connected, binding
  `{ kind: "browser-session", identity, sessions }`; the host owns the sessions database (as
  Favorites' `state`); a tile that holds both a Browser session and an Auth guard is refused by the
  command: `<tile> holds a Browser session; it needs no Auth guard.`; Multipart uploads and
  Favorites in that tile stay Stub with their existing "Needs an Auth guard set to Required"
  wording (documented).
- `jeeves/packages/spec/src/generation-support.ts`: the template is installed only when an
  emitter provides it (QL12); until then the lead's status is the existing "template not
  installed" wording and studio export of such a design is refused with `NEEDS_TEMPLATE` (as a
  design with Runnable processes was before the owner was installed). Record this in the handoff.
- Exhaustive records, chat docs and eval fixture as QL07.
- Tests: `studio-modules.test.ts`, `module-generation.test.ts`, `studio-operations.test.ts`,
  web group tests; docs `jeeves/CATALOG.md`, `docs/studio-settings.md`, `docs/studio.md`.

**Invariants.** `addModule` in a Worker is refused with `Browser session can't go in <name>; it
goes in a microservice.`; connecting both slots gives status Template · Browser session (after
QL12) or the not-installed wording (before); the refusal with an Auth guard; a tile holds one
Browser session.

**Emitted output.** None. Pins: none.
**Mouse check** (`ql11-check.spec.ts`): a Service with an Identity and a Database; add Browser
session; connect `identity` and `sessions` by drag; the module page shows no Options; add an Auth
guard to the same tile → refused with the message; both sizes; delete the project.
**Required regressions:** check, e2e, build, evals, mouse.
**Commit:** `QL11: a Browser session module kind and its template contract`.

### QL12 — Browser session generates sign-in, cookie sessions, CSRF and token forwarding

**Status:** after D3. **Depends:** QL06, QL11.

**Goal:** a Browser session's tile signs the browser in through the Identity with code+PKCE, keeps
the session in its database with the issuer's tokens sealed, gives the tile's stubs
`request.caller` (the session's account) and an access token to forward, and refuses a
cookie-bearing mutation without its CSRF token.

**Files.**
- New emitter `jeeves-generator/src/v2/browser-session.ts` (`local.browser-session`), registered
  with the others: provides the template; emits migration `100-<selection>.sql` on the `sessions`
  database, the hooks-less mount, and `src/runtime/browser-session.ts`.
- New `jeeves-generator/templates/local-v2/assets/src/runtime/browser-session.ts.template`:
  `createBrowserSession({ pool, keys, oidc: { issuer, clientId, clientSecret, redirectUri }, policy, module, failure })`
  returning `{ routes(routes), caller(request), csrf(routes), close() }`.
- `jeeves-generator/templates/local-v2/assets/package.json` and `pnpm-lock.yaml`:
  `openid-client` `6.8.8` (published 2026-09-05), by the Rules' dependency procedure.
- `jeeves-generator/src/v2/http-wiring.ts`: the mount: `setup` builds the session from the
  `sessions` pool, the key ring file `session-keys-<tile>`, and the environment; every module route
  of the tile is mounted through `session.csrf(routes)` and route stubs get `session.caller` as
  their `caller`; `tile-guard.ts` is not emitted for this tile.
- `jeeves-generator/src/v2/local.ts` and `scripts/setup.mjs`: `infra/local.json` identity entry
  gains `sessionClients: [{ tile, module }]`; `setup.mjs` writes a confidential client
  `<tile>-session` (`publicClient: false`, `standardFlowEnabled: true`, `redirectUris:
  ["<origin>/api/<tile>/modules/<module>/callback"]`, `webOrigins: ["<origin>"]`, an audience
  mapper for `<identity>-web` so forwarded access tokens pass the other tiles' guards, `secret`
  to `.runtime/secrets/oidc-client-<tile>`) and a key ring file `.runtime/secrets/session-keys-<tile>`
  (JSON, two entries, 32 random bytes each, base64url). Compose: `OIDC_ISSUER`,
  `OIDC_JWKS_URL`, `OIDC_CLIENT_ID` (`<tile>-session`), `OIDC_REDIRECT_URI`
  (`http://127.0.0.1:${LOCAL_HTTP_PORT}/api/<tile>/modules/<module>/callback`), and the two secret
  files; `depends_on` the identity healthy.
- Tests: new `jeeves-generator/src/v2/browser-session.test.ts` (emitted runtime with a fake pool,
  a mocked `openid-client` and fake timers), `http-wiring.test.ts`, `local.test.ts`,
  `tile-processes.test.ts`; integration: `jeeves-generator/integration/scenarios/identity.system.test.ts`
  gains a row **B07b** if the identity suite's fixture can hold the module (else a new fixture
  under `field-projects/generator-system/fixtures/session/` and its README rows).
- Docs: `jeeves-generator/README.md` (Module routes: a **Browser session** bullet like Sign-in's),
  `jeeves/CATALOG.md`, `docs/studio.md`, `docs/studio-settings.md`.

**Invariants.**
1. Migration: `<schema>.sessions (id_hash bytea PRIMARY KEY, subject text NOT NULL, username text,
   created_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL, absolute_expires_at timestamptz NOT NULL,
   revoked_at timestamptz, tokens bytea NOT NULL, token_expires_at timestamptz NOT NULL)` and
   `<schema>.login_transactions (state_hash bytea PRIMARY KEY, verifier bytea NOT NULL, nonce text NOT NULL,
   return_to text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz)`; the tile's
   login gets SELECT, INSERT, UPDATE, DELETE on both; nothing is published.
2. Routes under `/modules/<module>`: `GET /login?returnTo=` (a `returnTo` that is not a relative
   path starting with `/` and not `//` becomes `/`) answers 302 to the issuer's authorization
   endpoint with `code_challenge_method=S256`, `state`, `nonce`, `scope=openid profile`, and sets
   `__Host-login` (10 min) holding the transaction's state; `GET /callback` consumes the
   transaction once (a reused or unknown `state` → 302 to `returnTo` with `signin=failed`; the
   issuer's `error` → `signin=cancelled`), exchanges the code, checks `nonce`, creates the session
   (a random 32-byte id; the database stores SHA-256(id), `tokens` sealed with `seal(ring,
   "session-tokens", …, id_hash hex)`), sets `__Host-sid` (`Secure; HttpOnly; SameSite=Lax; Path=/;
   Max-Age=604800`) and answers 302 to `returnTo`; `POST /logout` (CSRF) revokes the session, clears
   the cookie and answers 204; `GET /session` answers `{ authenticated, csrfToken, subject,
   username }` or `{ authenticated: false, csrfToken: null }`.
3. A session is valid while not revoked, `absolute_expires_at` (created + 7 days) and
   `last_seen_at + 24 h` are in the future; `last_seen_at` is written at most once a minute. A
   cookie that names no valid session makes every module route of the tile answer 401
   `{"error":"SESSION_EXPIRED","message":"Sign in again."}` with the cookie cleared, never
   anonymous; a request without the cookie is `{ signedIn: false }`.
4. `session.caller(request)` is `{ signedIn: true, principal: { subject, claims: { username } },
   accessToken(): Promise<string> }` for a valid session: `accessToken` opens the sealed tokens
   and refreshes through `openid-client`'s refresh grant when fewer than 30 s remain, storing the
   new sealed tokens; a failed refresh revokes the session and rejects `Error("SESSION_EXPIRED")`.
5. CSRF: `csrfToken` is `sign(ring, "csrf", id_hash hex)`; every `POST`, `PATCH`, `PUT` or
   `DELETE` module route of the tile with a session cookie needs `X-CSRF-Token` verifying
   (`verify`), else 403 `{"error":"CSRF_FAILED","message":"Missing or invalid CSRF token."}`; the
   session's own `login` and `callback` are exempt; a request without a cookie is not checked.
6. Startup: the pool probe and the issuer's discovery; discovery that fails logs a failure line
   `session <module>` and is retried every 5 s, so the process starts and anonymous routes work
   while the Identity is down (B's F04); `login` answers 503 `UNAVAILABLE` meanwhile.
7. Sessions whose `absolute_expires_at` passed a day ago and consumed or expired login
   transactions are deleted by a sweep every 60 s under `pg_try_advisory_lock(hashtext('jeeves.sessions.<selection>'))`.

**Emitted output.** `src/runtime/browser-session.ts`, `src/features/…` bindings the mount needs if
the emitter follows Favorites' shape, the tile's process file, `infra/postgres/<db>/100-<selection>.sql`,
`infra/local.json`, `compose.yaml`, `scripts/setup.mjs`, `package.json`, `pnpm-lock.yaml`,
`README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`. Pinned: `scripts/setup.mjs`,
`package.json`, `pnpm-lock.yaml`, `.jeeves/manifest.json` in the three exports; any other: stop.
**Offline tests.** The login redirect's parameters and cookie; a callback with a reused state →
`signin=failed`; a successful callback's session row and cookie attributes; `caller` on a valid,
an idle-expired and a revoked session; `accessToken` refresh at 29 s remaining and not at 31 s;
CSRF accepted, missing and wrong; a cookieless POST not checked; the sweep statements; the
emitted `setup.mjs` client and key ring; the Compose environment; the migration text.
**Required regressions:** check, e2e, build; Docker phase `--suite=identity` and the new row.
**Docker proof:** a scratch design (a public Service with a Browser session on the Identity and a
Database, plus a Custom stub answering `request.caller`): `first-run`; create a user through
Keycloak's admin API as v2's account script did; with Playwright: `GET …/<module>/login` →
Keycloak → back; `GET …/<module>/session` authenticated with a `csrfToken`; the stub route shows
`signedIn: true`; `POST` to the stub without the header → 403, with it → 200; `docker stop` the
identity → `/session` still answers and `login` is 503; `docker start` → `login` works again
without a restart. Remove everything.
**Commit:** `QL12: Browser session generates sign-in, cookie sessions, CSRF and token forwarding`.

### QL13 — QLR1: review the QL plan's units

A fresh reviewer (Fable, xhigh) who implemented none of QL01–QL12 reads every QL handoff entry and
`git diff <this plan's commit>..HEAD`; checks each unit's invariants, pins and emitted-output changes
against its brief, the shared regeneration proof on the three fixtures, and the interactions
(QL02 + QL04's request hash; QL03 + QL04 + QL08 on `transaction`; QL05 + QL10 + QL12 on the
environment and `setup.mjs`; QL09 + the Cache reader's 5-second skip); runs `pnpm check`,
`pnpm test:e2e`, the web build, `pnpm eval:chat`, and `pnpm test:generated --suite=core`,
`--suite=wiring`, `--suite=identity` plus any suite a unit added; re-runs two Docker proofs of its
choice. It fixes a small defect only with a test that fails before and passes after; records the
rest in `docs/plans/qrwty-lessons/review.md`, with any new unit under **Proposed units** marked
ready or needs the owner; adds the design-playbook lesson from analysis §6 if no unit did; and
updates `docs/template-gaps.md`'s rows that the units closed. Commit:
`QLR1: review the QRWTY lessons units`.
