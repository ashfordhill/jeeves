# QGR3 review: QRWTY gap batch 3

Reviewed 2026-11-15 from `fa78baf` by an agent that implemented none of QG30, QG31, QG29, QG28,
QG32, QG33 or QG34. Read: `AGENTS.md`; batch 3's header, mapping, decisions and rules, the seven
briefs and the QGR3 brief; the plan's Rules for every unit and Regeneration proof; every batch-3
handoff entry (QGB3 to QG34); `git diff e1b4130..HEAD` and `git log --oneline e1b4130..HEAD` (seven
commits, one per unit, no docs-only coordinator commit in the range); [review-batch2.md](review-batch2.md)
for the format; arm A's evidence `q04/a-found-gaps.md`, `q05/checks.md` §9–10 and
`q06/a-found-gaps.md`, and nothing else in qrwty; nothing of the QL plan or of arm B. Probes: the
regeneration proof across the whole batch on the three fixtures, and the generator, templates and
tests at HEAD. **No defect was found, so nothing is fixed here**; everything is recorded.

## Verdict

The seven units do what their briefs ask. Their invariants hold, their pins and emitted-output lists
are exact (the union of the seven lists is exactly what the whole batch changed in each of the three
fixtures), and they compose in the shared files: `module-clients.ts` carries QG30's switch rule,
QG31's pass and readers and QG28's comment as one file with one `requireTls()`; `tile-guard.ts`
holds the sign-in's checks once (`signInSettings`), which the pass and the guard both call;
`migrate.mjs` reads its transport before its first `secret()`, and `common.mjs`'s `secret` and
`local.ts`'s `readSecret` apply one credential rule. Both owner-decided readings are implemented as
the owner decided. The rest are limits and notes under Findings, five proposals under Proposed units
(one ready, four for the owner), and what a regeneration of arm A's export would change.

## Checks

The owner's lighter profile (2026-11-15): `pnpm check`, the web build, and a Docker proof only on
doubt.

| Check | Result |
| --- | --- |
| `pnpm check` | On `fa78baf`, exit 0: 117 files / 1027 tests; Biome only the older 1 info. This review adds docs only, so the tree's code is HEAD's. (A first run under the shell's default Node 18.19.1, `/usr/bin/node`, failed at Vitest's startup, `styleText` missing from `node:util`; the repository needs Node 24, `.nvmrc` 24.21.0, which nvm has. Every check here ran with it on `PATH`.) |
| `pnpm --filter @jeeves/web build` | exit 0 |
| e2e, `test:generated --suite=all`, the HEAD measurement of new tests | Not run, by the packet. Nothing in the studio or web changed in the batch (no path under `jeeves/apps`). |
| Docker proof | None: no claim is doubted. QG31, QG29 and QG34 proved their behaviour on a stack or a TLS-only PostgreSQL; QG28's "each subscription gets every message" is Pub/Sub's rule, which the pubsub suite already exercises with the harness's capture subscription beside Count's (P1) and whose plan rows `pubsub-init.mjs`'s tested code creates; QG30's Node behaviour is Q04's experiment; QG32's image built in the core suite. No `qgr3-` resource was created and the Docker inventory was not touched. |
| Regeneration proof, whole batch | A scratch clone at `e1b4130` with its own offline install exported `probe-design.json` (`a3b6204f…0505`, verified), `qrwty-r83.json` (`4c16e0ca…5d50`) and the Pub/Sub fixture's `design.json`; this tree exported the same. **Probe** changed exactly `.jeeves/manifest.json`, `.jeeves/report.json`, `Dockerfile`, `README.md`, `compose.yaml`, `scripts/common.mjs`, `scripts/migrate.mjs`, `src/features/service-resources.ts`, `src/processes/front.ts`, `src/processes/tally.ts`, `src/runtime/local.ts`, `src/runtime/module-clients.ts`, `src/runtime/tile-guard.ts`, `src/runtime/valkey.ts`. **r83** the same, with `account-api`, `analytics-worker`, `billing-api`, `link-api`, `redirect-service` and `session-api` in place of the probe's two. **Pub/Sub fixture**: manifest, report, `Dockerfile`, `README.md`, `compose.yaml`, `infra/local.json`, `scripts/common.mjs`, `scripts/migrate.mjs`, `src/processes/clicks-api.ts`, `src/processes/tally.ts`, `src/runtime/local.ts`, `src/runtime/module-clients.ts` (it has no sign-in, cache or template, so no `tile-guard.ts`, `valkey.ts` or `service-resources.ts`). Each list is exactly the union of the seven Emitted output lists for that fixture. In every pair `compose.yaml` differs only by `setup-migrate`'s `JEEVES_MIGRATE_TLS: disable` (QG31 invariant 6, QG34 invariant 3), the report's `processes` is equal for the probe and r83 and differs for the Pub/Sub fixture only in Tally's `loops` and `stores` (QG28), and the manifest differs in `files`, `implementations` and `registry`. Required gaps unchanged: probe 3, r83 11, pubsub 2. Before, exactly `Dockerfile` (all three) and `src/features/service-resources.ts` (probe, r83) ended with a blank line; after, no file in any export does (QG32). The clone and the exports are deleted. |
| Pins | `processes-off.json` changed, per export: `.jeeves/manifest.json`, `Dockerfile`, `README.md`, `scripts/common.mjs`, `scripts/migrate.mjs`, `src/runtime/local.ts` in all three; `compose.yaml`, `src/features/service-resources.ts`, `src/runtime/valkey.ts` in `frozen-v2` and `v2-module-design`. Exactly the union of QG30's, QG29's, QG32's and QG34's pin lists; QG31, QG28 and QG33 changed none, as their briefs expected. `processes-off.test.ts` passes. |

## Each unit against its brief

**QG30.** `requireTls()` in `module-clients.ts.template`, `valkey.ts.template` and
`service-resources.ts.template` (inside `@sql`, tabs, `throw Error(`) keeps `undefined` → `false` and
`Invalid endpoint JEEVES_REQUIRE_TLS` for any other value but `true`, then refuses a defined
`NODE_TLS_REJECT_UNAUTHORIZED` other than `"1"` with `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`
(the brief's two-line comment above it). The sign-in's line went into `signInSettings` with QG31,
third as the brief's step 2 ordered it. `endpointsReadme` and the generator README carry step 3's
sentence; the Known limits row is the brief's. Invariant 4 holds in the templates: the only `fetch`
in the runtime is `target()`'s (`httpTarget`, `externalTarget`, `identityTarget`, all through
`requireTls()`), and the sign-in's key set goes through `signInSettings`; a process that reads the
switch nowhere makes no TLS connection. Pins as listed.

**QG31.** `checkConfiguration` is the brief's text, exported after `transport`. `databaseEndpoint`,
`cacheClientEndpoint` and `pubsubProjectId` are the clients' reads moved, each read again at build
(`databaseClient` keeps its `localLogins` lookup first and spreads the endpoint into
`createPostgres`; both `new PubSub(` use `pubsubProjectId()`). `signInSettings` holds the guard's
checks in the brief's order and messages; `verifiedIdentity` calls it and `createPrincipalVerifier`
gets `settings.*`. `stubClients` builds the pass as a `Map` keyed by the check's text in the brief's
order (sorted clients, then the loops' `brokerBinding()`/`pubsubProjectId()`, then
`signInSettings()`), emits it first in `setup` only when it has a check, and imports each reader once
(the mount's import merge gives the process one
`import { createTileGuard, signInSettings } from "../runtime/tile-guard.ts";`). The probe's Front
pass is the brief's block line for line; Tally's is `databaseEndpoint("tally-db")`, `brokerBinding()`.
Checked: `tileGuard` (a `verified-identity` selection on the tile) and `render`'s `guarded` (a mount
with a guard) agree, so a pass that imports `signInSettings` always has `tile-guard.ts`; a process
with stubs but no provisioned client and no sign-in gets no pass and no import; `target()` has no
side effect, so running an HTTP client's call in the pass opens nothing; the pass is inside
`runProcess`'s start, so its failure is the `startup-failed` line (QG31's proof showed it, with no
probe line before it). Invariant 6 holds in all three fixtures (Compose, the report's `environment`
and the README's per-process lists unchanged). Three existing assertions outside the brief's test
list changed with the emitted code; each checks the same thing at the new place.

**QG29.** `migrationSsl()` reads, before `const connect`, the switch, QG30's override, the mode,
the server name (QG10's host rule, the same regular expression as `host()`), then the CA file, in the
order `transport()` reads them; `pg.Client` gets `ssl` (`false`, or `{ rejectUnauthorized: true,
ca?, servername?, checkServerIdentity? }` as `postgresSsl` builds it), and the one `connect` serves
the admin, each owner and the runtime-login checks. All imports are evaluated before the module
body, so `common.mjs`'s `chdir` precedes `migrationSsl()` and the first `secret()` follows it:
everything is read before the first connection (invariant 3). `pg` 8.23.1 reads `PGSSLMODE` only
when `ssl` is undefined, which the Docker proof confirmed (`verify-full` with `PGSSLMODE=disable`
over TLS). The product step's three anchors are byte-identical, Compose gives `setup-migrate`
`disable`, no `src/` file names `JEEVES_MIGRATE_`, and the README sentence and docs are the brief's.
The import is the second line (Biome's import order), recorded.

**QG28.** `pubsubSubscription(topic, tile, module)` gives `<topic>--<tile>--<module>` through
`generationLocalIdentity(...).local` (idempotent: `idSchema.parse`), and `pubsubSubscriptions`
filters the tile's loop stubs whose `consumes` has the topic. The plan (`local.ts`), the loops
(`stubLoops`, with its `id`), the report row (`provisionedAs`) and `pubsubLoop`'s comment agree.
Checked a case the briefs don't name: a tile with a route stub publishing to a topic its own loop stub
consumes. `stubStores` keys a queue by `element\0access`, so the publish and consume rows are
separate and a consume row's `modules` are exactly the consuming loop stubs; the report row and the
plan can't disagree. RabbitMQ (`subscriberQueue`, `subscriberQueues`, `broker-init.mjs`) and
`pubsub-init.mjs` are untouched (invariants 1 and 3). The Pub/Sub fixture's plan, Tally's loop row
and the suite's constant are `clicks--tally--count`. A name is at most 200 characters, so
`pubsubName`'s 255 limit never refuses one.

**QG32.** The asset `Dockerfile` lost its last empty line; `composition.ts` ends `constructors` with
one newline after the section loop. In the three before-exports exactly `Dockerfile` and
`service-resources.ts` ended with a blank line; after, no emitted file does, and the blank lines the
kept markers leave inside `service-resources.ts` stay (invariant 2). The test covers the base, the
stub stack, the full selections and the probe.

**QG33.** The three Known limits rows are the brief's text, in its order, after the edge's
forwarded-headers row; no other line changed. Checked against the code: `local.ts` names the
Keycloak provider's database and logins `i_<id>`, `io_<id>`, `ik_<id>`, and `valkey.ts` reads the
cache's password once when its client is built.

**QG34.** `readSecret`: the name rule first, then `JEEVES_SECRET_<NAME>_FILE` (`toUpperCase`, `-`
and `.` as `_`), an absolute value with no control character else `Invalid endpoint <variable>`, the
read trimmed, a failed read `Unreadable secret file <variable> (<code>)` as `readCa` shapes it; unset,
the default read is byte for byte today's. `secret` in `common.mjs` applies the same variable rule
(and, as at HEAD, no name rule; `migrate.mjs`, `broker-init.mjs` and `storage-config.mjs` read
through it). Compose sets none of the variables; the report and the per-process lists don't name
them; the README sentence is the brief's. A credential is read when its client is built, after the
pass (finding 1). Names that differ only by `-`, `.` or `_` share a variable; today's names don't
collide.

## Interactions

- **`module-clients.ts.template`** (QG30, QG31, QG28). One `requireTls()`, read by `transport`,
  `target` and `refuseEmulator`, so every reader the pass calls (`databaseEndpoint`,
  `cacheClientEndpoint`, `pubsubProjectId`, the HTTP clients) carries QG30's rule, and an invalid
  switch value is one message the pass dedupes and rethrows alone (`Invalid endpoint
  JEEVES_REQUIRE_TLS` first, QG30 invariant 3). `pubsubProjectId()` runs `refuseEmulator()`, so the
  emulator refusal also moves into the pass. QG28 changed only `pubsubLoop`'s comment.
- **`tile-guard.ts.template` and the guard's lines** (QG30, QG31). The sign-in's checks exist once,
  in `signInSettings`; the process file calls it in the pass (with stubs) and in the guard's IIFE
  (always), with the same messages. The emitted process file holds no `OIDC_` text.
- **`migrate.mjs` and `common.mjs`** (QG29, QG34). `migrationSsl()` runs before any `secret()`;
  a wrong transport is named before a credential file is opened, and a bad
  `JEEVES_SECRET_<NAME>_FILE` is named before any connection (the first `secret("postgres-admin")`
  precedes `connect`). QG34's proof ran `setup-migrate` with seven variables.
- **`service-resources.ts.template`** (QG30, QG32). QG30's lines are inside `@sql`, which the
  section strip keeps or drops whole; QG32's trim touches only the file's end. Neither fixture with
  processes has `@sql`, so `service-resources.ts` changed there only by its ending.
- **`client-wiring.ts`** (QG31, QG28). `stubClients` (the pass) and `provisionedAs` (the row) are
  separate functions; `pubsubSubscription`'s third argument reached `provisionedAs`, `stubLoops` and
  the plan together.
- **QG31 + QG34.** The pass covers endpoints, transports, the Pub/Sub project and the sign-in; a
  credential's file is read at build (finding 1).
- **QG31 + QG20.** The probe's Front pass needs `JEEVES_EXTERNAL_PROVIDER_URL`, so a Docker proof on
  `after-probe` still needs the application's `compose.override.yaml` (batch 3's rule).

## The two owner-decided readings

**QG28, "each loop stub gets its own subscription, so every module sees every message."**
Implemented as decided: every Pub/Sub loop stub, alone on its tile or not, in either queue mode,
consumes `<topic>--<tile>--<module>`, with its own `.failed` topic and pull subscription; copies of
a tile share their module's. Pub/Sub delivers each message to every subscription on the topic, so
each module sees every message. The README and the generator README say that in work-queue mode two
loop stubs of one tile each get every message on Pub/Sub, where RabbitMQ's share the queue (QG28
invariant 5); the owner's words cover it ("every module").

**QG29, "verifies TLS with the same CA-file setting the app's connections use since QG10."**
Implemented as QGB3 read it and as QGR2 proposed (the owner decided "as QGR2 proposed"): QG10's
setting, a `_TLS` mode (`disable` or `verify-full`), an optional `_CA_FILE` and `_TLS_SERVERNAME`,
under the migration's own prefix `JEEVES_MIGRATE_`, with QG10's rules and messages and QG30's
override rule. The other reading, reusing the processes' `JEEVES_DATABASE_<ID>_CA_FILE`, has no
single variable to reuse: the migration reaches one cluster at `PGHOST` for every database, including
provider databases no process reads (`i_identity`), so the prefix is the only deterministic reading.
A deployer gives both families the same CA file; nothing checks they agree, rightly, since the
migration job may reach the cluster by another address than the processes (a socket directory,
which `disable` under the switch accepts).

## Findings

1. **Low, a limit (QG31 with QG34). The configuration pass doesn't cover credential files.**
   `readSecret` runs when a client is built (`postgres.ts` the login's secret, `valkey.ts` the cache
   password, `amqp.ts` `broker-password`, `objects.ts` the key), so a wrong
   `JEEVES_SECRET_<NAME>_FILE` or a missing secret fails startup alone, after the probes before it:
   QG34's proof step 4 shows the `events` and `hot` probe lines before
   `Unreadable secret file JEEVES_SECRET_SQL_STORE__FRONT_FILE (ENOENT)`. Proposed unit QG35.
2. **Low, a limit (QG31).** A template's own clients (`pool` and `brokerBinding` in
   `service-resources.ts`, the cache read's `cacheEndpoint` in `valkey.ts`) still read their variables
   as each is built, so a process with templates and stubs has a pass for the stubs' side only, and a
   template-only process has none. Recorded by QG31's Known limits row. Proposed unit QG36 (needs the
   owner).
3. **Low, wording (QG34, pre-existing).** `readSecret`'s default read fails with Node's own error,
   which names the file (`ENOENT: no such file or directory, open '/run/secrets/<name>'`), while the
   variable's read fails `Unreadable secret file <variable> (<code>)`. The brief's invariant 1 kept
   the default byte for byte. No unit; QG35 may give the default read the same shape
   (`Unreadable secret file <name> (<code>)`) if the owner wants one message.
4. **Note (QG29).** `JEEVES_MIGRATE_CA_FILE` is read after `common.mjs` has changed the working
   directory to the export root, so a relative path resolves from there; a process's `_CA_FILE`
   resolves from its working directory. In the image both are `/app`, so Compose and a deployment
   see no difference; only a host-run `node scripts/migrate.mjs` from another directory does. Use
   absolute paths, as QG34 requires for a credential's file.
5. **Note (QG30).** `signInSettings` and `migrationSsl` read `process.env.NODE_TLS_REJECT_UNAUTHORIZED`
   before testing the switch and check it only under the switch; `requireTls()` reads it only under
   the switch. Invariant 1 holds in effect (nothing is refused without the switch).
6. **Note (QG31).** Each reader runs twice at startup, so a CA file is read twice; both reads use one
   function (invariant 3). A process that passes the pass can still fail a probe; the outage then
   comes after the configuration, never instead of it.
7. **Note (QG28).** Every existing Pub/Sub subscription is renamed once: the suite's `clicks--tally`
   is `clicks--tally--count`, and arm A's `click-events--analytics-worker` becomes
   `click-events--analytics-worker--analytics-worker-click-aggregator` (71 characters; the loop
   stub's module in r83's Analytics worker) with its `.failed`. A deployment creates the new
   subscription and `.failed` topic before it deploys, since Pub/Sub keeps messages only for
   subscriptions that exist when they are published, then drains and deletes the old one. r83 as
   saved (Events on RabbitMQ) renames nothing.
8. **Note, wording.** The generated README's Runnable-processes sentence still says a worker's loop
   is on "a topic's `<topic>--<id>` subscriber"; for a Pub/Sub loop the name is
   `<topic>--<tile>--<module>`, which the Pub/Sub paragraph gives. Loose, not false; no unit.
9. **Note (process).** QG31, QG29, QG28, QG32 and QG34 skipped the HEAD measurement of their new
   tests in a scratch clone (the owner's lighter profile); QG30 did it (5 fail on HEAD), and QG32 ran
   its test on HEAD in the checkout (exactly the two paths). Each other new test asserts emitted text
   or behaviour that HEAD doesn't have (`checkConfiguration`, `migrationSsl`, `--<module>`,
   `JEEVES_SECRET_`), so each would fail there. Accepted.
10. **Note (new A evidence, not in batch 3).** Arm A's Q06 recorded AG-10 (a stub's own
    configuration and credentials have no startup step and aren't declared), AG-11 (product SQL has
    no versioned steps) and AG-12 (a module schema's grant is fixed at SELECT, INSERT, UPDATE,
    DELETE). None is in batch 3's mapping. Proposed units QG37–QG39, each for the owner.
11. **Note.** QG31's handoff and the generator README name the pass's order (the clients' sorted keys,
    the loops' broker and Pub/Sub, then the sign-in); r83's Session API pass is `httpTarget`
    account-api, billing-api, `identityTarget` identity, `httpTarget` link-api, `databaseEndpoint`
    sessions, in that sorted order.

## Proposed units

- **QG35 — The configuration pass reads each credential (ready).** `client-wiring.ts`, `stubClients`:
  after the clients' checks and the loops' `brokerBinding()`/`pubsubProjectId()`, before
  `signInSettings()`, one `() => readSecret("<secret>")` per credential the process's clients read,
  sorted with `v2Compare`: `sql-<database>--<tile>` for each provisioned database, `cache-<id>` for
  each cache, `broker-password` when `sections` has `broker`, `s3-<tile>` when a store is object
  storage (the names Compose's `secrets` list gives the service). Import `readSecret` from
  `../runtime/local.ts`. The value is discarded; a message names the variable or the file's error
  code, never a value. Tests: `client-wiring.test.ts`'s QG31 test, the probe's Front pass gains
  `() => readSecret("broker-password")`, `() => readSecret("cache-hot")`,
  `() => readSecret("sql-store--front")` between `databaseEndpoint("store")` and `signInSettings()`,
  and Tally's `() => readSecret("broker-password")`, `() => readSecret("sql-tally-db--tally")`;
  `module-clients.test.ts`'s QG31 describe, a pass with a missing `JEEVES_SECRET_<NAME>_FILE` and a
  wrong `_TLS` names both as `Invalid configuration: …`. Docker proof: QG34's step 4 with the
  variable pointing at a missing file, now with no `"event":"probe"` line before the
  `startup-failed` line. Emitted output: process files with stubs, report and manifest; pins none
  (processes off has no stub). Regressions: check, build; Docker `--suite=wiring`.
- **QG36 — The pass covers a template's own clients (needs the owner).** QG31's owner-scoped Goal
  was the stubs' clients and the sign-in. Extending it means a `databaseEndpoint`-like reader in
  `service-resources.ts.template` (`pool`'s three reads, inside `@sql`), the cache read's
  `cacheEndpoint` and `brokerBinding` in the pass, and the template mounts in `http-wiring.ts`
  emitting one check per mounted resource (`pool(scope, selected(...), "<field>")`'s binding), so
  every emitted template process changes. The owner decides whether that is wanted now; the Known
  limits row covers it meanwhile.
- **QG37 — A stub's own configuration has a startup step (needs the owner; Q06 AG-10).** A stub
  module declares the variables and credentials it reads; the process reads and checks them in the
  configuration pass (naming the variable, never the value), the report's `environment`, the
  README's per-process list and Compose's `secrets` include them, and a failure is the
  `startup-failed` line, not an import-time stack trace. It adds a declared surface to stub modules,
  so the owner picks the shape (a `configure` export in the stub file, or fields in the design).
- **QG38 — Versioned product migrations (needs the owner; Q06 AG-11).** Product SQL per module as
  numbered files applied once in order and recorded by hash, like the template's own migrations,
  beside or instead of the re-run module file. It changes the product-SQL contract the field projects
  write to, so the owner decides.
- **QG39 — Per-table privileges in a module schema (needs the owner; Q06 AG-12).**
  `grantProductSql` applies a declaration beside the module's SQL (which tables are append-only or
  never deleted) instead of the blanket SELECT, INSERT, UPDATE, DELETE. The owner decides the
  declaration's form.

## Owner decisions B1–B4

- **B1 (QG34, AG-03): yes**, 2026-11-15, relayed by the coordinator; QG34 is done, and its Known
  limits row says "Fixed in QG34".
- **B2 (AG-04), B3 (AG-05), B4 (AG-08):** no answer is recorded in the handoffs. QGB3's
  recommendations (no unit now) were applied: QG33 records AG-04 and AG-05 as Known limits rows
  (with QG28's names), AG-06 too, and AG-08 is not a template gap (no row). They stay open for the
  owner; a yes to B3 is a later unit after QG28 reading the names from the environment.
- No unit was declined, so this review adds no Known limits row.

## What a regeneration of arm A's export would change

Arm A's export is frozen at `4e87f97` (the QGR2 tree). Regenerating its design from this tree
changes, from the r83 export and the Pub/Sub fixture:

- **Every process file with stubs** opens with `checkConfiguration([...])` after the module clients'
  import gains `checkConfiguration` and the readers (QG31); the guarded ones (Account, Billing and
  Link API) call `signInSettings()` in the pass and in the guard, and `tile-guard.ts` holds the
  checks. A wrong setting now fails startup by name before any probe, several together as
  `Invalid configuration: …`; the preflight's own check (Q04's AG-01 workaround) becomes redundant.
- **`JEEVES_REQUIRE_TLS=true` refuses `NODE_TLS_REJECT_UNAUTHORIZED`** other than unset or `1`
  (QG30), in every process and in `migrate.mjs`; the preflight's refusal (AG-02 workaround) becomes
  redundant.
- **The migration job needs `JEEVES_MIGRATE_TLS`** (`verify-full`, with `JEEVES_MIGRATE_CA_FILE` and,
  by a private address, `JEEVES_MIGRATE_TLS_SERVERNAME`, or `disable` with `PGHOST` a socket
  directory under the switch); unset, it fails `Invalid endpoint JEEVES_MIGRATE_TLS` before
  connecting (QG29). `compose.yaml` gives `setup-migrate` `disable`, its only Compose change.
- **Each credential can be named by `JEEVES_SECRET_<NAME>_FILE`** (QG34): Cloud Run mounts each
  secret at its own path and sets the variable, so Q04's link-and-exec wrapper and `SECRET_DIR` can
  go. Processes and the migration job read through the same rule.
- **The Pub/Sub subscription is renamed** (QG28): `click-events--analytics-worker` becomes
  `click-events--analytics-worker--analytics-worker-click-aggregator`, with
  `click-events--analytics-worker--analytics-worker-click-aggregator.failed` as its dead-letter topic
  and pull subscription; `infra/local.json`, the IaC's three names, the loop row and the report change
  with it. Create the new subscription and `.failed` topic first, deploy, then drain and delete the old.
- `Dockerfile` and `src/features/service-resources.ts` end with one newline (QG32); `git diff --check`
  is clean.
- `README.md` gains QG30's, QG31's, QG29's and QG34's sentences; `.jeeves/report.json` changes in
  its source inventory (and, with Pub/Sub, the loop and store rows); `.jeeves/manifest.json` with
  every changed file.
- Nothing else: `package.json`, the lock, the edge, the stubs' and hooks' files and product SQL are
  untouched.

## Notes for the QL plan (`docs/plans/qrwty-lessons/`, not read here)

- A QL unit that adds a client, reader or setting a process reads should give the pass its check
  (`checkConfiguration` in `client-wiring.ts`'s `stubClients`), else QG31's rule ("checked before any
  client is built or probed") stops holding for that reader.
- A QL unit that adds a TLS connection should read `requireTls()` (or `signInSettings`) so QG30's
  override rule covers it; a plain `fetch` elsewhere would not be.
- Pub/Sub names are `<topic>--<tile>--<module>` (QG28); any QL suite row or fixture naming a
  subscription takes that shape.
- The migration job has its own transport variables (QG29) and every credential its own optional
  file variable (QG34); a QL unit that writes Compose overrides or deployment profiles lists them.
- The QL plan can start: batch 3 is complete and committed, the regeneration proof holds across it,
  and nothing here blocks a QL unit. The proposals above are independent of it.

## Scratch

The clone at `e1b4130` (its own offline install) and the six exports were in the scratchpad and are
deleted. The checkout's `node_modules` was not touched by the clone. No Docker command was run.
