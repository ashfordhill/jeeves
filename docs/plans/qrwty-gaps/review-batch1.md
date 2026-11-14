# QGR1 review: QRWTY gap batch 1

Reviewed 2026-11-14 from `84a766a` by an agent that implemented none of QG01, QG02, QG05, QG17,
QG19, QG12 or QG11. Read: `AGENTS.md`; the plan's batch headers, Rules, Regeneration proof and the
seven briefs; every batch-1 handoff entry (QG01's blocked attempt and the coordinator's Biome fix
included); `git diff c2c8127..HEAD` (`3a0cee3` and `84a766a` are docs). Probes: the emitted
parsers on Fastify 5.12.7 (a scratch script, deleted), the regeneration proof across the whole
batch, and QG12's and QG17's Docker proofs rerun on scratch containers. Nothing is fixed here: no
defect was found that a test could show, so no code, template, pin or doc other than this file
and the handoff entry changed.

## Verdict

The seven units do what their briefs ask. Their invariants hold, their pins and emitted-output
lists are exact, and they compose: the two that edit `http.ts` merged into one coherent file, and
QG05's `node` user reads what QG12's script needs and writes nothing. What remains are limits and
interactions, listed under Findings, with five proposed units (four ready, one for the owner).

## Checks

| Check | Result |
| --- | --- |
| `pnpm check` | exit 0: 115 files / 926 tests; Biome shows only the older 1 info. This unit changes no code, so there is no "after" to distinguish. |
| `pnpm test:e2e` | Run 1, while this review's four exports, two installs and two builds ran beside it: 14 failed / 60 passed; every failure was `getByRole('button', { name: /^Project:/ })` not visible within 5 s right after `page.goto` (`e2e/studio.ts:94`), so the page didn't load in time under that load. Run 2, alone: 74 passed (4.6 min). |
| `pnpm --filter @jeeves/web build` | exit 0. |
| `pnpm test:generated --suite=core` | 2 files / 4 tests passed (B01–B04, 282 s), in its own phase after the offline checks and the web build, with QG12's and QG17's proofs running beside it. No other suite was rerun: the units' own runs cover `wiring`, `identity`, `media`, `regeneration` and `faults` at or after the commits that touched what they test, and the two failures recorded there (B10's clock step, B09 media's case-3 precondition) are known harness items, not doubts about a unit. |
| Regeneration proof, whole batch | `probe-design.json` (`a3b6204f…0505`, verified) and `qrwty-r83.json` exported from a scratch clone at `c2c8127` (its own offline install) and from HEAD. `diff -rq`: the probe changed exactly `.jeeves/manifest.json`, `.jeeves/report.json`, `Dockerfile`, `README.md`, `compose.yaml`, `scripts/migrate.mjs`, `src/modules/entry.ts`, `src/processes/front.ts`, `src/runtime/http.ts`, `src/runtime/postgres.ts`, `src/runtime/tile-http.ts`; r83 the same, with `src/processes/account-api.ts`, `billing-api.ts` and `link-api.ts` in place of `front.ts`. That is exactly the union of the seven **Emitted output** lists. `compose.yaml` differs only by `OIDC_AUDIENCE: "identity-web"` on each guarded service (1 in the probe, 3 in r83); each guarded process only by QG11's check and audience lines; the report only in registry hashes and sizes. In each `after-*`, `pnpm install --frozen-lockfile --ignore-scripts --offline` and `pnpm build` exit 0. |
| Pins | `processes-off.json` changed `.jeeves/manifest.json`, `Dockerfile`, `README.md` and `scripts/migrate.mjs` in all three exports, and `src/runtime/http.ts` and `src/runtime/postgres.ts` in `frozen-v2` and `v2-module-design`; `compose.yaml` is unchanged (no pinned export has processes on). Exactly the units' lists. |
| Docker inventory | Containers, images, networks and volumes recorded before the Docker phase and after it. The difference is other runs': arm B's `qrwtyb-*` stack (24 entries before, gone after) and two `n03-selftest-*` containers that appeared meanwhile; none of them was touched. No `gs-` or `qgr1-` resource is left; the five `qgr1-pg-*` containers were removed by name. |
| The checkout after QG11's repair | `node_modules/.modules.yaml`, `.pnpm-workspace-state-v1.json`, `.pnpm/lock.yaml` and every `.bin` shim name no scratch or `/tmp` path; `pnpm check` passes on it. Clean. |

## Each unit against its brief

**QG01.** Invariants 1–4 read in `http.ts.template`, `tile-http.ts.template` and `entry.ts.template`:
the parsers are Fastify's own (`getDefaultJsonParser("error", "error")` is the default; text is
`toString("utf8")`, as Fastify's `defaultPlainTextParser` reads it in `content-type-parser.js`).
Probed on Fastify 5.12.7 with the template's registration: empty JSON → 400
`FST_ERR_CTP_EMPTY_JSON_BODY`; the body `null` → 200 with `body` `null`; no Content-Type and no
bytes → `rawBody` undefined; no Content-Type with bytes → 415; a BOM before `{}` → 200 `{}` with
the BOM kept in `rawBody` (secure-json-parse strips it, as HEAD's default parser did); a
Content-Length over the limit → 413 before the body is read; `charset=utf-16` JSON → 400, as
before. The points raised: the tests borrow the Jeeves server's Fastify through `createRequire` on
`jeeves/apps/server/package.json`, and one assertion keeps its version equal to the asset's pin
(5.12.7 both); only `listen` is replaced. So the generator's unit tests now depend on the server
app's dependency, and a server bump without the template's pin fails that test by design (finding
8). An empty `text/plain` body gives `rawBody` a 0-byte Buffer and `body` `""`, unchanged from
HEAD's text parser (finding 7).

**QG02.** The README paragraph is the plan's, word for word, in every export. `common.mjs` runs every
command as `docker compose --profile '*' …` with no `-f`, `--file`, `--project-directory` or
`COMPOSE_FILE`, and `local.mjs` hashes `compose.yaml` and `infra/local.json` only. The point raised
is right: `local.mjs` starts named services only (`up -d --wait … <providers>`, `<identity>`,
`<plan.application>`; `run --rm --no-deps setup-*`), so a service that exists only in the override
starts with `pnpm start` only when a generated service `depends_on` it; `pnpm stop` stops it. The
generated paragraph doesn't say so (finding 9).

**QG05.** `USER node` is the line before each `CMD`; no built service sets `user`; no application or
setup service mounts anything but the edge's read-only `nginx.conf`. `bootstrap.mjs` runs on the
host (`local.mjs` spawns `process.execPath scripts/bootstrap.mjs`), so Garage's keys are written as
the host user, unaffected by the image's user. The runtime writes only `/tmp/application-ready`.
Secrets: `setup.mjs` and `bootstrap.mjs` write them with `mode: 0o644, flag: "wx"`; the host
umask still masks that mode (finding 5).

**QG17.** `postgres.ts.template` passes `query_timeout: options.statementTimeoutMs + 500` and nothing
else changed; checked against pg 8.23.1 (`client.js`: the `Query read timeout` timer, the queue
removal, the socket destroyed only in pipeline mode) and pg-pool 3.14.0 (`_release` with an error →
`_remove`). The points raised: a stalled database now spends a worker attempt, true (`delivery.ts`'s
`unreachable` doesn't match a plain `Error`; QG18, owner decision 6, closes it). "pg-pool discards
a connection after any query error" is true for `pool.query` (pg-pool's `query` releases with the
error) and for `transaction.ts` (a failed `ROLLBACK` sets `discard`, so a stalled ROLLBACK discards
the client); verified under Runs. A caller that checked a client out with `pool.connect()` and
released it without the error would keep a stalled client; no template does.

**QG19.** The handler sets `Retry-After: 1` on an `HttpError` 503 unless `reply.hasHeader` says the
route set one; Fastify's `error-handler.js` keeps headers set before a throw except `content-type`
and `content-length`, and `hasHeader` lower-cases its key and checks the raw reply too. The three
admission 503s are `HttpError`s (`admission.ts`). The point raised is right and matters: the
error handler's fallback 503 (`UNAVAILABLE`, "Service unavailable." for any error that isn't an
`HttpError`), `/healthz`'s 503 and the edge's 503 carry no `Retry-After` (finding 1).

**QG12.** The script was read in full; the `SET ROLE … RESET ROLE` pair wraps only the two
database-level statements, the lock is the first statement and its unlock the last, and the
emitted `migrate.mjs` keeps the product step (`applyProductSql`, `grantProductSql`) on the owner's
connection. The proof rerun is under Runs. The points raised: the CREATEROLE self-grant works on
17.11 with `createrole_self_grant` at its default (empty): `pg_auth_members` shows, for every role
the admin created, PostgreSQL 16's implicit grant (grantor the bootstrap superuser, inherit f, set
f, admin t) and, for the three owners, the script's grant (grantor the admin, inherit f, set t,
admin f); `pg_has_role(admin, owner, 'USAGE')` is false and `'SET'` true. An owner role another
role created: the run stops at the grant with `permission denied to grant role "o_store"` before
any database statement; after that role's creator runs `GRANT o_store TO <admin> WITH ADMIN
OPTION`, the run passes (finding 3). The lock waits without bound: a waiting copy holds nothing; a
holder that hangs (for example on a stalled database, since `migrate.mjs` has no `query_timeout`
by QG17's invariant 4) blocks every copy until the deployment's job timeout ends it (finding 4).

**QG11.** The emitted lines are inside `runProcess`'s start (the guard's `setup` lines), so a missing
value is `startup-failed`, as the test shows. Keycloak's `setup.mjs` maps `browser-audience` to
`<id>-web`, the value Compose sets, so local tokens pass as before (B07 is the real-jose proof,
run by QG11). The points raised: the jose stand-in checks the algorithm, the RS256 signature,
`iss`, `aud`, the required claims and `exp` with `node:crypto` and records the audience asked for;
adequate for what the tests assert, and the identity suite covers the real verifier. An unset
`OIDC_ISSUER` or `OIDC_JWKS_URL` still fails with the verifier's generic errors (finding 6). The
faults flake (store-outage open item 6) is the harness's and was not rerun here.

## Interactions

- **QG01 + QG19** share `http.ts.template`: one file, both changes present; QG19's tests run on
  QG01's parsers (a `{"bad":` 400 has no `Retry-After`).
- **QG17 + QG19:** a stub's `Query read timeout` is a plain `Error`, so it reaches the fallback 503
  without `Retry-After` (finding 1).
- **QG17 + templates' transactions:** a query that stalls inside `transaction()` rejects at the
  bound, then the `ROLLBACK` stalls to the same bound, so the transaction settles at twice
  `statement_timeout + 500 ms` and the client is discarded (verified: 5,067 ms). Within a fixed
  bound, as QG17's goal asks; recorded so nobody expects 2.5 s there.
- **QG05 + QG12:** `setup-migrate` runs the new `migrate.mjs` as `node`; it reads `/run/secrets/*`
  (0644) and `infra/` (root-owned, readable) and writes nothing. Locally the admin is Compose's
  superuser, so the non-superuser path runs only in cloud; hence the proof.
- **QG11 + QG06 (batch 2):** QG11 reads `OIDC_AUDIENCE` directly; QG06's `Invalid endpoint
  <variable>` convention can take the three `OIDC_*` variables (finding 6).

## Findings (not fixed)

1. **Medium. The fallback 503 has no `Retry-After`.** `http.ts`'s error handler answers any
   non-`HttpError` with 503 `UNAVAILABLE` and no header: a stub's dependency error (a database
   error, the new `Query read timeout`, a lost broker) takes this path. QG19's goal, "a client's
   bounded retry needs no product code", holds only for the admission's three 503s and for
   `HttpError` 503s; a stub must wrap its dependency calls to get the header. `/healthz`'s 503 is
   for orchestrators and the edge's 503 is nginx's. Proposed unit QG21; the edge QG25.
2. **Low. A stalled database spends a worker attempt** (QG17's handoff). Planned: QG18, owner
   decision 6 yes. Nothing to add.
3. **Low. A non-superuser admin must hold `ADMIN OPTION` on every owner role it did not create.**
   Verified (Runs, D). The remedy is one statement by the role's creator. Not written anywhere a
   deployer would read it. Proposed unit QG23.
4. **Low, a limit. The cluster lock waits without bound.** By design; a `lock_timeout` would make
   a legitimately long migration fail its waiters. Recorded here; no unit.
5. **Low. The secrets' 0644 depends on the host umask.** `setup.mjs` and `bootstrap.mjs` pass
   `mode: 0o644`, which `open(2)` masks: with umask `027` or `077` the files are 0640 or 0600, and
   since QG05 the container's `node` (uid 1000) reads them only when the host user is uid 1000;
   before QG05, root read them regardless. Default umasks (`022`, this host's) give 0644.
   Proposed unit QG22.
6. **Low. `OIDC_ISSUER` and `OIDC_JWKS_URL` fail startup with generic errors** (`Invalid verified
   identity binding`, `Invalid URL`) that name neither variable, while `OIDC_AUDIENCE` names
   itself. Proposed unit QG24, after QG06.
7. **Low, wording.** `entry.ts` says `rawBody` is "undefined when there is none"; an empty
   `text/plain` body gives a 0-byte Buffer (and `body` `""`), as HEAD's text parser gave `""`. The
   next unit that edits `entry.ts.template` can say "undefined when no body was read"; not worth
   a pin change of its own.
8. **Note.** The generator's unit tests now load `jeeves/apps/server`'s Fastify. The version
   assertion makes a drift between the server's dependency and the template's pin a test failure,
   which is the right failure; it is a coupling to know about when either is bumped.
9. **Low, docs.** The generated README's "Your own configuration" paragraph invites "a service of
   your own" without saying that `pnpm first-run` and `start` start only the generated services
   (plus what they `depends_on`), so an override-only service starts with the application's own
   `docker compose up` or by a `depends_on` the override adds to a generated service. Proposed
   unit QG23.

## Proposed units

- **QG21 — The fallback 503 carries `Retry-After` too (ready).** `http.ts.template`: in the
  non-`HttpError` branch, when the answer is 503, `Retry-After: 1` unless the reply has one
  (same rule as QG19). Test in `tile-processes.test.ts` on the real Fastify: a route that throws
  `new Error("Query read timeout")` and a stub entry that throws a plain `Error` answer 503
  `UNAVAILABLE` with `retry-after: 1`; a route that set `Retry-After: 30` keeps it; a 400 has
  none; `onFailure` is still called once. Pins: `src/runtime/http.ts` (frozen-v2,
  v2-module-design) and `.jeeves/manifest.json`. `jeeves-generator/README.md`: the QG19 sentence
  gains the fallback. Regressions: check, e2e, build; `--suite=wiring`.
- **QG22 — Secret files are 0644 whatever the host umask (ready).** `setup.mjs` and
  `bootstrap.mjs`: `chmodSync(path, 0o644)` after each `writeFileSync` (or `openSync` with
  `fchmodSync`), nothing else. Test: the emitted scripts' text (`local.test.ts`, beside QG05's
  test). Pins: `scripts/setup.mjs`, `scripts/bootstrap.mjs` and `.jeeves/manifest.json` in the
  three exports. README: the QG05 passage says the mode no longer depends on the umask. Docker
  proof: `umask 077; pnpm first-run` on the probe export → every file in `.runtime/secrets` is
  0644 and `app-front` is healthy; `pnpm stop`; remove the project. Regressions: check, e2e,
  build; `--suite=core`.
- **QG23 — Two sentences deployers need (ready, docs).** (a) `docs/template-gaps.md` Known limits:
  a non-superuser migration admin must hold `ADMIN OPTION` on each database owner role it did not
  create (`GRANT <owner> TO <admin> WITH ADMIN OPTION` by the role's creator), else `migrate.mjs`
  stops at `permission denied to grant role` before any database statement; and
  `jeeves-generator/README.md`'s QG12 paragraph says the same in one sentence. (b) The generated
  README's "Your own configuration" paragraph (`local.ts`) gains: "A service of your own starts
  with `pnpm start` only when a generated service `depends_on` it, which your override may add;
  otherwise start it with your own `docker compose up`." Update the `own` string in
  `local.test.ts` and the README pins (three exports) with `.jeeves/manifest.json`. Regressions:
  check, e2e, build.
- **QG24 — The `OIDC_*` variables fail startup by name (ready, after QG06).** With QG06's
  `Invalid endpoint <variable name>` rule in place, `OIDC_ISSUER` and `OIDC_JWKS_URL` are
  validated as absolute `http:`/`https:` URLs and `OIDC_AUDIENCE` as non-empty, each failing
  `startup-failed` with its own name; QG11's message may become the same shape. Tests in
  `tile-guard.test.ts` (the three unset and invalid cases) and `http-wiring.test.ts` (the emitted
  lines). Emitted output: the guarded process files only (no pinned export has a guard's
  verifier). If QG06's agent has not started, the coordinator may fold this into QG06's brief
  instead.
- **QG25 — The edge's 503 carries `Retry-After` (needs the owner).** `infra/edge/nginx.conf`
  answers 502/503/504 while a process is down with nginx's defaults. Adding `Retry-After: 1` to
  those answers is a one-line `add_header … always` per `error_page`, but the edge is the file
  QRWTY replaces with its own (QG15's note) and the Q03 review's F22 note is still owed when a unit
  touches the edge; the owner decides whether Jeeves's edge should promise it.

## Runs

**QG12's proof, rerun** on after-probe's `scripts/migrate.mjs` with the probe's SQL and stub bodies
at their `generated-extension` paths. Four scratch `postgres:17.11-alpine3.23@sha256:bc2701f9…b61f`
containers (`qgr1-pg-nonsu`, `-concur`, `-su`, `-foreign`) on 127.0.0.1:47991–47994, every
credential generated for the run and deleted after it. "Non-superuser" instances have a
`bootstrap` superuser and `CREATE ROLE postgres LOGIN CREATEDB CREATEROLE` (`rolsuper` f). The
command was `env PGHOST=127.0.0.1 PGPORT=… SECRET_DIR=… node scripts/migrate.mjs`.

- **A, non-superuser, no manual grant:** first run exit 0 in 0.9 s, 3 migrations and 3 module SQL
  files applied; repeat exit 0, only the 3 module files again. Every `datacl` is
  `{o_x=CTc/o_x,r_x=c/o_x}` with no `=` entry; `has_database_privilege` is false for `public` and
  for the admin on all three databases; `psql -U postgres -d d_store` fails `permission denied for
  database "d_store"` (no CONNECT). Memberships as described under QG12 above.
- **B, non-superuser, two concurrent first runs:** both exit 0 (1.1 s and 1.2 s); one applied the
  migrations, the other found them current; a third run exit 0 and applied nothing new. The ACL
  invariant holds.
- **C, superuser:** first run and repeat exit 0; the same `datacl` values; PUBLIC has no CONNECT;
  the admin has no membership rows.
- **D, foreign owner:** with `o_store` created by `bootstrap` first, the run exits 1 in 60 ms at
  `permission denied to grant role "o_store"` with nothing applied; after `GRANT o_store TO
  postgres WITH ADMIN OPTION` as `bootstrap`, the run exits 0 and applies everything.
- Removed by name (`docker rm -f -v`); the secrets directory deleted.

**QG17's proof, rerun** on after-probe's built `dist/runtime/postgres.js` against a scratch
`qgr1-pg-stall` (the same image, 127.0.0.1:47995), while the core suite built images beside it
(load average 2.5): the pool got `statement_timeout: 2000, query_timeout: 2500,
connectionTimeoutMillis: 2000, max: 10`; healthy `SELECT pg_sleep(5)` rejected `57014` at
2,010 ms; one warm connection, `docker pause`, `SELECT 1` rejected `Query read timeout` at
2,502 ms with `totalCount` 0; `pool.end()` resolved in 0 ms; `docker unpause`. Then the template's
`transaction.ts` (type-stripped by Node 24, since neither fixture export has it): `SELECT 1`, pause
inside the transaction, `SELECT 1` → rejected `Query read timeout` at 5,067 ms (the query's
2.5 s, then the `ROLLBACK`'s), pool empty; after unpause a new connection answered in 5 ms.
Removed by name.

**The regeneration exports** (`before-*`, `after-*`) and the scratch clone were deleted at the end.
