# QRWTY-driven generator gaps (QG units)

**Status:** plan, copied 2026-11-14 by the QRWTY execution coordinator from qrwty
`docs/plans/production-build/jeeves-gaps.md` at commit `ccaca7d` (SHA-256 `78d432cf3eeeab2129cdbad93f68c1233d60204c0546a86bb4fc90b1c3b7a71e`),
written by QRWTY units Q03 (audit), the Q03 review and Q03b (amendments). The owner authorized
QRWTY-required generic Jeeves fixes as separate units ("required QRWTY generic gap work once the
Jeeves checkout is available"). Units run one at a time on `main`, each by a fresh agent.

## Batch 1 (assigned now; no owner decision needed)

Run in this order, then the review unit:

1. QG01 — Route stubs see the exact request bytes and send repeated headers
2. QG02 — The application's own Compose override is a documented seam
3. QG05 — The application image runs as a non-root user
4. QG17 — Database calls settle while PostgreSQL stalls
5. QG19 — The admission's 503 answers carry `Retry-After`
6. QG12 — Migrations run with a non-superuser admin, one at a time (as amended by R1)
7. QG11 — The sign-in audience comes from the environment
8. **QGR1 — Review batch 1.** A fresh reviewer (Fable, xhigh) reads every batch-1 handoff entry and
   `git diff <this plan's commit>..HEAD`; checks each unit's invariants, the pins and emitted-output
   changes against its brief, the regeneration proof, and interactions between units; runs
   `pnpm check`, `pnpm test:e2e`, the web build and `pnpm test:generated --suite=core` (plus any
   suite a unit names). Fixes a small defect only with a test that fails before and passes after;
   records the rest in `docs/plans/qrwty-gaps/review-batch1.md`, with any new unit under
   **Proposed units** marked ready or needs the owner. Commit: `QGR1: review QRWTY gap batch 1`.

QG03, QG04, QG06 (and so QG07–QG10), QG18 and QG20 wait for the owner's decisions listed below.
QG13–QG16 are deferred.

## Batch 2 (owner decisions, 2026-11-14 morning)

The owner answered the plan's decisions for QRWTY's coordinator:

- **Decision 1 (QG03): yes.** The application owns its package dependencies; Jeeves keeps its own pins.
- **Decision 2 (QG06): yes.** Store and tile endpoints come from the environment (as amended by R3).
- **Decision 3 (QG04): yes.** A stub cache that is down at startup no longer stops the process.
- **Decision 6 (QG18): yes.** A client-side query timeout counts as unreachable.
- **Decision 7 (QG20): yes.** External API and Identity tiles give stubs a configured HTTP client.

Run after batch 1's remaining units (QG12, QG11) and QGR1, in this order: QG03, QG04, QG06, QG24, QG07,
QG08, QG09, QG10, QG18, QG20, then **QGR2 — Review batch 2**, written like QGR1 (Fable, xhigh; its
record is `docs/plans/qrwty-gaps/review-batch2.md`; commit `QGR2: review QRWTY gap batch 2`). QGR2's commit is QRWTY arm A's
frozen generation baseline (QRWTY owner decisions §10). Then QG21, QG22, QG23 and QG25, with the folds that [QGR2](review-batch2.md) lists. QG21 gains two test cases, and QG23 gains
two deployer sentences. Then QGR2's ready units, QG26 and QG27, followed by QG28 and QG29 once the owner decides (their briefs
are in review-batch2.md §Proposed units). [QRWTY lessons](../qrwty-lessons/units.md)'s review (QLR1) also covers all of these;
that plan follows them.
QG21–QG24 are the QGR1 review's ready units; their briefs are in [review-batch1.md](review-batch1.md) §Proposed units (QG24 after QG06). QG25 (the edge's 502/503/504 carry `Retry-After: 1`): **owner decision 2026-11-14: yes**; its brief is in review-batch1.md §Proposed units, and it also records the Q03 review's F22 note (below) in `docs/template-gaps.md`, since it touches the edge. QG13–QG16 stay deferred.


Notes from the Q03 review that Q03b left for this copy: record F22 (the edge rewrites `Host` and
passes the client's `X-Forwarded-For`) as a Jeeves limit in `docs/template-gaps.md` when a unit
touches the edge; cite GS09's external-API gap, SO03's open item 3 (stalled database) and PF review
follow-up 10 (`pnpm start` drops copies; an oracle adapter must not recover a copy that way).

## Batch 3: arm A's found gaps (QG30–QG34)

**Status:** planned 2026-11-15 by QGB3 (docs only) at Jeeves `573b94e`, for QRWTY run
`qrwty-r1-20261114`, arm A, template development. Nothing is implemented. Arm A builds on the export
frozen at `4e87f97` (QGR2). Its Q04 and Q05 found nine gaps in Jeeves's templates, AG-01 to AG-09
(qrwty `docs/evidence/q04/a-found-gaps.md`; `docs/evidence/q05/checks.md` §10). The Q05 review
(qrwty `docs/reviews/Q05-review.md` lines 180–185) finds them recorded honestly, each with a
workaround, and none blocking a later QRWTY unit. These units come from A's own findings, so A may
take them later by regenerating. They run **before** the [QRWTY lessons](../qrwty-lessons/units.md)
(QL) plan, which draws on arm B. QGR2's two proposals, QG28 and QG29, join this batch: the owner
decided both on 2026-11-15, and their exact briefs below replace
[review-batch2.md](review-batch2.md)'s proposals.

### Gap-to-unit mapping

| Gap | A's severity | What was found | Batch 3 |
| --- | --- | --- | --- |
| AG-01 | Low | Configuration is checked one client at a time, between probes | **QG31** (ready) |
| AG-02 | Medium | `JEEVES_REQUIRE_TLS=true` accepts `NODE_TLS_REJECT_UNAUTHORIZED=0` | **QG30** (ready) |
| AG-03 | Medium | Credentials are read from one directory only, `SECRET_DIR/<name>` | **QG34** (needs the owner, B1) |
| AG-04 | Medium | The cache client sends a static password, so a managed cache's token (IAM) authentication can't be used | No unit: a known limit, recorded by QG33; a credentials provider is deferred until a field project needs it (B2) |
| AG-05 | Low | Pub/Sub topic and subscription names are compiled from the design | No unit: a known limit, recorded by QG33; database, login and bucket names are compiled the same way (B3) |
| AG-06 | Low | `migrate.mjs` provisions the local Keycloak's database and logins also where the issuer is managed | No unit: a known limit, recorded by QG33 (one unused database and two secrets; harmless) |
| AG-07 | Low (docs) | The generator README's endpoints table named `OIDC_ISSUER` for a stub's Identity client | No unit: fixed in QG26 (`51f6639`). Checked at `573b94e`: the table row (`jeeves-generator/README.md` line 738) and the paragraph after it (line 754) name `JEEVES_IDENTITY_<ID>_URL` |
| AG-08 | Low (notation) | A queue's Provider isn't drawn: revision 84's PNGs equal revision 83's | No unit: not a template gap. The canvas draws no tile's provider or engine (a Database's neither); the Inspector and Preview show it (B4) |
| AG-09 | Low (cosmetic) | `Dockerfile` and `src/features/service-resources.ts` end with a blank line | **QG32** (ready) |
| QGR2 finding 5 | Low | Several loop stubs of one tile share one Pub/Sub subscription | **QG28** (decided by the owner, 2026-11-15) |
| QGR2 finding 11 | Low | `migrate.mjs` can't verify a private CA, and nothing refuses it in plain text | **QG29** (decided by the owner, 2026-11-15) |

### Run order

1. QG30 — The TLS switch refuses Node's verification override
2. QG31 — Configuration is checked before the first probe
3. QG29 — `migrate.mjs` verifies TLS with the deployment's CA
4. QG28 — Each Pub/Sub loop stub gets its own subscription
5. QG32 — Generated files end with one newline
6. QG33 — Three limits for managed deployments (docs)
7. QG34 — A credential's file can be named by its own variable, once the owner answers B1 yes.
   If the owner declines, it is skipped and QGR3 records AG-03 as a Known limits row.
8. **QGR3 — Review batch 3**, written like QGR1 and QGR2 (below).

QG31 follows QG30 (QG30's check moves with the sign-in's lines), QG29 follows QG30 (its switch
read takes QG30's rule), QG28 follows QG31 (both edit `client-wiring.ts` and the Pub/Sub part of
`module-clients.ts.template`), and QG33 follows QG28 (its AG-05 row uses QG28's names). The QL plan
starts after QGR3.

### Batch 3 decisions

Recorded:

- **QG28: decided by the owner, 2026-11-15 (relayed by the QRWTY coordinator), as QGR2 proposed.**
  Each loop stub on a Pub/Sub topic gets its own subscription, `<topic>--<tile>--<module>`, so
  every module sees every message.
- **QG29: decided by the owner, 2026-11-15 (relayed by the QRWTY coordinator), as QGR2 proposed.**
  `migrate.mjs` verifies TLS with the setting QG10 gave the application's database connections: a
  `_TLS` mode (`disable` or `verify-full`), an optional `_CA_FILE` and `_TLS_SERVERNAME`, under the
  migration's own prefix, `JEEVES_MIGRATE_`, since it reaches one cluster at `PGHOST`.

Open, each with QGB3's recommendation:

- **B1 (QG34, AG-03).** Can each credential's file be named by its own variable,
  `JEEVES_SECRET_<NAME>_FILE`, beside today's `SECRET_DIR/<name>`? It adds a family of deployment
  variables, as QG06 did for endpoints. The alternatives are reading `<SECRET_DIR>/<name>/<file>`
  when that path is a directory (no variable, but a fixed file name to agree on), or keeping one
  directory and documenting Q04's link-and-exec wrapper. **Recommendation: yes, the variable.** It
  works on any platform that mounts files, Compose sets none of them, and it removes a shell wrapper
  from every Cloud Run service and job.
- **B2 (AG-04).** Should the cache client fetch a fresh token per connection for a managed cache's
  token authentication? **Recommendation: no unit now** (deferred, as QG13–QG16 are). It needs a
  provider-specific credentials provider, a variable to select it, and a refresh rule Q04 couldn't
  confirm (`TOKEN_AUTH`). Q04's `AUTH_DISABLED` on a private network with `verify-full` works.
  QG33 records it.
- **B3 (AG-05).** Should Pub/Sub topic and subscription names come from the environment?
  **Recommendation: no unit now.** Database, login and bucket names are compiled the same way, so
  one design's deployments already need their own instances, and sharing a project is a deployment
  choice. QG33 records it. If yes, a later unit after QG28 reads the names from variables (the
  owner picks then: one prefix, or a variable per name).
- **B4 (AG-08).** Should the canvas draw a queue's provider? **Recommendation: no unit now.** The
  canvas draws no tile's provider or engine, so drawing only the queue's would be inconsistent. If
  wanted, a later studio unit draws every kind's alike in the Detailed view, under the owner's
  visual review.

### Rules for batch 3

This plan's **Rules for every unit** and **Regeneration proof** apply, with these changes:

- **Rule 1:** read `AGENTS.md`, the last three entries of `docs/handoff.md`, this plan's Rules for
  every unit and Regeneration proof, then this batch's text above and your own brief. Don't read
  another brief.
- **Isolation.** These units come from QRWTY arm A's findings. Don't read `docs/plans/qrwty-lessons/`,
  QRWTY's repositories or anything of arm B, and take nothing from them: each brief carries its
  evidence.
- **Rule 9's Noticed** says the unit is QRWTY-driven, naming its gap (`AG-nn`, or QGR2's finding).
- **Regeneration proof:** QG28 and QG31 change Pub/Sub code, so they also export the Pub/Sub
  fixture's design, `field-projects/generator-system/fixtures/pubsub/design.json`, as QG27 did. A
  Docker proof on `after-probe` needs the application's `compose.override.yaml` to set
  `JEEVES_EXTERNAL_PROVIDER_URL` on `app-front` (QG20: Front fails startup without it), as QG22's
  and QGR2's proofs did.
- Run new and changed tests on HEAD's templates in a scratch clone with its own offline install,
  record which fail there, and delete the clone, as QG21–QG27 did.

### QG30 — The TLS switch refuses Node's verification override (ready)

**Status:** local and cloud (QRWTY's production profile starts every process with the switch).
Ready: QG10's approved Goal includes a refusal for disabled TLS verification.
**Depends:** none.

**Goal:** with `JEEVES_REQUIRE_TLS=true`, a process refuses to start while
`NODE_TLS_REJECT_UNAUTHORIZED` is set to anything but `1`, so no client that leaves certificate
checks to Node's default can run unverified.

**Found (arm A, Q04: qrwty `docs/evidence/q04/a-found-gaps.md` lines 12 and 34–45).** With
`NODE_TLS_REJECT_UNAUTHORIZED=0`, a `fetch` to a server whose certificate it can't verify answers
200. `pg` with a wrong CA is still refused: its explicit `rejectUnauthorized: true` wins. Session,
Link, Account and Billing API start and become ready with the variable set under
`JEEVES_REQUIRE_TLS=true`. So `httpTarget`, `externalTarget`, `identityTarget` and the sign-in's
remote key set would accept any certificate, and a key set fetched unverified can be replaced.
Node turns verification off for exactly `0`; the remedy refuses every value but `1`.

**Files.**
- `requireTls()` in each of these templates:
  - `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`;
  - `jeeves-generator/templates/local-v2/assets/src/runtime/valkey.ts.template`;
  - `jeeves-generator/templates/local-v2/assets/src/features/service-resources.ts.template`, inside
    `@sql`, with tabs and `throw Error(`.
- `jeeves-generator/src/v2/http-wiring.ts`, `verifiedIdentity`'s emitted setup lines.
- `jeeves-generator/src/v2/local.ts`, `endpointsReadme`.
- The tests below. Docs: `jeeves-generator/README.md` (Verified TLS bindings) and
  `docs/template-gaps.md` (Known limits).

**Steps.**
1. Each `requireTls()` keeps `undefined` → `false`, and `Invalid endpoint JEEVES_REQUIRE_TLS` for any
   value but `true`. For `true` it then reads `process.env.NODE_TLS_REJECT_UNAUTHORIZED`. When that
   is defined and isn't exactly `"1"`, it throws `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`;
   otherwise it returns `true`. A two-line comment says why: `0` turns off certificate checks for
   every client that leaves them to Node, so under the switch only unset or `1` passes (QG30).
2. In the guard's lines, right after
   `if (requireTls !== undefined && requireTls !== "true") throw new Error("Invalid endpoint JEEVES_REQUIRE_TLS");`,
   emit, with the same indent:
   `if (requireTls && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== undefined && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "1") throw new Error("Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED");`.
   The comment above those lines says so.
3. In `endpointsReadme`, after "the broker, object storage and search are plain text and aren't
   checked.", add: "With the switch, `NODE_TLS_REJECT_UNAUTHORIZED` must be unset or `1`, else
   startup fails with `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`: `0` would turn off
   certificate checks for every client that leaves them to Node." Every other phrase stays as it is.

**Invariants.**
1. Without the switch nothing changes: the variable isn't read, Compose sets neither, and local
   stacks are unchanged.
2. With the switch, unset or `1` passes. `0`, the empty string, `false` and `true` each fail by
   name, never by value, before any client of that reader is built.
3. An invalid switch value still fails `Invalid endpoint JEEVES_REQUIRE_TLS` first. No other rule,
   message or order changes, and `pg`'s and the cache's own `rejectUnauthorized: true` stay.
4. The check runs where the switch is read, as QG10's refusals do. A process that reads it nowhere
   (no database, cache, Pub/Sub client, HTTP client or sign-in) isn't checked.

**Emitted output.**
- Where the export has them: `src/runtime/module-clients.ts`, `src/runtime/valkey.ts` and
  `src/features/service-resources.ts` (with its `@sql` section).
- Guarded process files, `README.md` (processes on), `.jeeves/report.json` and
  `.jeeves/manifest.json`.
- Pinned (Rule 7): `src/runtime/valkey.ts`, `src/features/service-resources.ts` and
  `.jeeves/manifest.json` in `frozen-v2` and `v2-module-design`, and nothing in `stub-stack`. Any
  other pinned path: stop.

**Offline tests** (each fails before):
- **`module-clients.test.ts`**, the QG10 block, one new test. The switch is on with verified
  values: `verify-full` for the database and cache, `https:` URLs, no `PUBSUB_EMULATOR_HOST`, and
  `JEEVES_PUBSUB_PROJECT` set.
  - With `NODE_TLS_REJECT_UNAUTHORIZED` each of `0`, the empty string, `false` and `true`, these each fail
    `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`, with `fake.calls` and the probe lines empty:
    `databaseClient`, `cacheClient`, `httpTarget`, `externalTarget`, `identityTarget`,
    `pubsubPublisher` and `valkey.cacheEndpoint`.
  - With `1`, or unset, each is built.
  - Without the switch, `0` builds each.
- **`composition.test.ts`**, the QG10 pool test.
  `tls({ JEEVES_REQUIRE_TLS: "true", [name("TLS")]: "verify-full", NODE_TLS_REJECT_UNAUTHORIZED: "0" })`
  is `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`; with `"1"` it is `{ mode: "verify-full" }`.
- **`tile-guard.test.ts`**, the QG10 test. Under the switch, `0` gives the `startup-failed` line
  `Error: Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED` and no app; `1` gives
  `Application ready`. Its `finally` restores the variable.
- **`http-wiring.test.ts`**: the emitted sign-in lines include the new line.
- **`tile-processes.test.ts`**: its README phrases include step 3's sentence.

**Docker proof:** none. The refusal is a startup check that the offline tests run on the emitted
files, and Node's behaviour is Q04's experiment.
**Required regressions:** check, e2e, build. Docker phase: `--suite=wiring` and `--suite=identity`.
**Docs.**
- `jeeves-generator/README.md`, Verified TLS bindings: step 3's sentence.
- `docs/template-gaps.md`, a new Known limits row: "`JEEVES_REQUIRE_TLS=true` accepted
  `NODE_TLS_REJECT_UNAUTHORIZED=0`, which turns off certificate checks for every client that
  leaves them to Node (`fetch`, the sign-in's key set). Found in QRWTY arm A's Q04 (AG-02) | Fixed
  in QG30: under the switch it must be unset or `1`".

**Commit:** `QG30: the TLS switch refuses Node's verification override`.

### QG31 — Configuration is checked before the first probe (ready)

**Status:** local and cloud: this is what a deployer sees when a setting is wrong. Ready: every
refusal stays the same refusal, it only comes earlier.
**Depends:** QG30 (its guard line moves here).

**Goal:** a process with stubs checks, in one pass, every variable its stubs' clients and its
tile's sign-in read, before any client is built or probed. A wrong setting is then named even while
a store is down, and several wrong settings are named together.

**Found (arm A, Q04: qrwty `docs/evidence/q04/a-found-gaps.md` lines 11 and 19–31).**
- Each client reads and checks its variables as it is built. The clients are built in the
  `clients` object's sorted order, each probed before the next.
- With the production environment and one wrong setting per start, the generated runtime named the
  wrong setting in only 15 of 96 starts.
- In Redirect service the Pub/Sub publisher `click-events` comes first. So
  `JEEVES_DATABASE_LINKS_TLS=disable`, or a missing `JEEVES_DATABASE_LINKS_HOST`, showed only as
  `Startup probe failed: queue click-events` while Pub/Sub was unreachable.
- QGR2 recorded the same order (Interactions, `module-clients.ts.template`).

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`:
  - `checkConfiguration` (below), exported, outside every `@…` section (after `transport`), so
    every emitted `module-clients.ts` has it.
  - Database section: `export function databaseEndpoint(resource: string)`, returning
    `{ hostname, port, tls }`. These are `databaseClient`'s three reads moved as they are
    (`endpoint(variable("DATABASE", resource, "HOST"), host(true))`, the `PORT` read and
    `transport("DATABASE", resource, hostname)`). `databaseClient` keeps its `localLogins` lookup
    first, then calls `databaseEndpoint`.
  - Cache section: `export function cacheClientEndpoint(cache: string)`, returning
    `{ hostname, port, tls }`. These are `cacheClient`'s reads moved; `cacheClient` calls it.
  - Pub/Sub section: `export function pubsubProjectId(): string`, which runs `refuseEmulator()` and
    returns `endpoint("JEEVES_PUBSUB_PROJECT", pubsubProject)`. Both `new PubSub({ projectId: … })`
    calls use it in place of their `refuseEmulator()` call and `endpoint(…)` argument.
    `pubsubConsumer` keeps `validateDeliveryBinding` and its concurrency check before it.
  - The file's header comment says what runs first.
- `jeeves-generator/templates/local-v2/assets/src/runtime/tile-guard.ts.template`:
  `export function signInSettings(): { issuer: string; audience: string; jwksUrl: string }`. It
  holds the guard's emitted checks, moved here with their order and messages:
  1. `OIDC_AUDIENCE` must be non-empty, else
     `OIDC_AUDIENCE must name the audience of the sign-in tokens.`
  2. `JEEVES_REQUIRE_TLS` must be unset or `true`, else `Invalid endpoint JEEVES_REQUIRE_TLS`.
  3. QG30's `NODE_TLS_REJECT_UNAUTHORIZED` check.
  4. `OIDC_ISSUER`, then `OIDC_JWKS_URL`, by the `signInUrl` rule: no whitespace, and
     `URL.parse`'s protocol `http:` or `https:` (`Invalid endpoint <name>`); `https:` under the
     switch (`Insecure endpoint <name>`).
- `jeeves-generator/src/v2/http-wiring.ts`, `verifiedIdentity`:
  - The IIFE keeps `const binding = …`, then runs `const settings = signInSettings();` and calls
    `createPrincipalVerifier({ issuer: settings.issuer, audience: settings.audience, jwksUrl: settings.jwksUrl, algorithms: ["RS256"], jwksTimeoutMs: 3000 })`.
  - The mount imports `signInSettings` from `../runtime/tile-guard.ts`.
  - A one-line comment goes where the inline checks were.
- `jeeves-generator/src/v2/client-wiring.ts`, `stubClients`: the pass (below) and its imports:
  - `checkConfiguration` and the readers it calls, from `module-clients.ts`;
  - `signInSettings` from `../runtime/tile-guard.ts`, when `tileGuard(process, selections)` from
    `http-wiring.ts` names a sign-in.
- `jeeves-generator/src/v2/local.ts`, `endpointsReadme`: its first sentence and its failure
  sentence (Docs).
- Tests, and docs: `jeeves-generator/README.md` (Endpoints from the environment) and
  `docs/template-gaps.md` (Known limits).

**`checkConfiguration`, exactly:**

```ts
/** Runs every check before any client is built or probed (QG31): each reads and checks its
 * variables as its client will. One failing check fails startup with its own error; several with
 * `Invalid configuration: <message>; <message>`, in the order given, each message once. A message
 * names a variable, never its value. */
export function checkConfiguration(checks: readonly (() => unknown)[]): void {
  const failures: unknown[] = [];
  const messages: string[] = [];
  for (const check of checks)
    try {
      check();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!messages.includes(message)) {
        messages.push(message);
        failures.push(error);
      }
    }
  if (failures.length === 1) throw failures[0];
  if (failures.length) throw new Error(`Invalid configuration: ${messages.join("; ")}`);
}
```

**The pass.** It goes first in the stub clients' `setup`, before the "Module clients" comment,
whenever it has at least one check. Its comment reads: "Configuration: every variable these
clients and the tile's sign-in read, checked before any client is built or probed; one wrong
setting fails startup naming it, several are named together." Then
`checkConfiguration([`, one `  () => <check>,` line per check, and `]);`. The checks come in this
order, each once (compared by its text):
1. One per entry of the sorted `clients` list:
   - a database: `databaseEndpoint(<resource>)`;
   - a RabbitMQ publisher (`queue`): `brokerBinding()`;
   - a Pub/Sub publisher (`pubsub`): `pubsubProjectId()`;
   - a cache: `cacheClientEndpoint(<resource>)`;
   - an HTTP client: its own call (`httpTarget({ tile: "<id>" })`,
     `externalTarget("JEEVES_EXTERNAL_<ID>_URL")` or `identityTarget({ identity: "<id>" })`);
   - object storage and search: none, since their endpoints are compiled.
2. `brokerBinding()` when `sections` has `broker`, and `pubsubProjectId()` when it has
   `pubsub-loop`.
3. `signInSettings()` when the tile has a sign-in.

For the probe fixture's Front, the emitted pass is exactly:

```
  checkConfiguration([
    () => brokerBinding(),
    () => cacheClientEndpoint("hot"),
    () => identityTarget({ identity: "identity" }),
    () => externalTarget("JEEVES_EXTERNAL_PROVIDER_URL"),
    () => databaseEndpoint("store"),
    () => signInSettings(),
  ]);
```

**Invariants.**
1. Every refusal a client or the sign-in makes today keeps its rule and its message. It now comes
   from the pass, before the probe log, any client, probe or loop. A lone wrong setting fails with
   exactly today's message, so every existing single-failure assertion holds; two or more fail with
   `Invalid configuration: …`.
2. Within one check, only its first failure is reported, in the reader's order as today (a
   database's `HOST`, then `PORT`, then `TLS`).
3. The clients, the sign-in and the loops still read their variables as they are built, with the
   same functions, so a value can't change between the pass and the build unchecked.
4. Templates' own clients are unchanged and still read their variables as each is built: `pool` and
   `brokerBinding` in `service-resources.ts`, and the cache read's `cacheEndpoint`. This is recorded
   as a limit.
5. A process without stubs has no pass. Its sign-in still checks in the guard's setup, now through
   `signInSettings`.
6. No variable is added. Compose, the report's `environment` and the README's per-process lists
   are unchanged.

**Emitted output.**
- `src/runtime/module-clients.ts`, `src/runtime/tile-guard.ts` (guarded designs) and every process
  file with stubs or a sign-in.
- `README.md` (processes on), `.jeeves/report.json` and `.jeeves/manifest.json`.
- Pinned: none expected, since no pinned export has processes on. If `processes-off.test.ts` fails,
  follow Rule 7.

**Offline tests** (each fails before):
- **`module-clients.test.ts`:**
  - `checkConfiguration` runs every check. A lone failure rethrows that error object. Three failing
    checks, two with one message, give `Invalid configuration: <a>; <b>`, and no value appears.
  - With the database's `_TLS` set to `require` and the cache's `_HOST` unset,
    `checkConfiguration([() => clients.databaseEndpoint("links-db"), () => clients.cacheClientEndpoint("links-cache")])`
    throws
    `Invalid configuration: Invalid endpoint JEEVES_DATABASE_LINKS_DB_TLS; Invalid endpoint JEEVES_CACHE_LINKS_CACHE_HOST`,
    with `fake.calls` empty.
  - The existing QG06 and QG10 tests pass unchanged.
- **`client-wiring.test.ts`**, the QG20 describe:
  - The probe's `front.ts` holds the block above before `  const probe = createProbeLog(config.tile);`.
  - It imports `brokerBinding`, `cacheClientEndpoint`, `checkConfiguration` and `databaseEndpoint`
    from `../runtime/module-clients.ts`, and `signInSettings` from `../runtime/tile-guard.ts`.
  - The probe's `tally.ts` pass is its database's `databaseEndpoint(…)`, then `brokerBinding()`,
    with no `signInSettings`.
- **`http-wiring.test.ts`**: the emitted sign-in lines are the new ones.
- **`tile-guard.test.ts`**: the existing tests pass unchanged. The sign-in stack's `watch-api` now
  checks through `signInSettings()` in its pass, with the same messages.

**Docker proof.** Run it on `after-probe` with the probe bodies and the override, as project
`qg31-probe` on its own loopback ports.
1. `pnpm first-run`; every service is healthy.
2. `docker compose --profile '*' stop local-broker`.
3. Run
   `docker compose --profile '*' run --rm --no-deps -e JEEVES_DATABASE_STORE_TLS=require -e JEEVES_CACHE_HOT_HOST= app-front`.
   It exits non-zero, and its `startup-failed` line is
   `Error: Invalid configuration: Invalid endpoint JEEVES_CACHE_HOT_HOST; Invalid endpoint JEEVES_DATABASE_STORE_TLS`,
   with no `"event":"probe"` line before it.
4. Run the same without the two `-e`: it fails `Startup probe failed: queue events`, the outage as
   before.
5. Run step 3's command on `before-probe` (HEAD's templates, same steps): it names only
   `Startup probe failed: queue events`. Record both results.
6. Tear down: `pnpm stop`, `docker compose --profile '*' down --volumes --remove-orphans`, the
   image removed by name, `.runtime` deleted.

**Required regressions:** check, e2e, build. Docker phase: `--suite=wiring`, `--suite=identity`,
`--suite=pubsub` and `--suite=core`.
**Docs.**
- `jeeves-generator/README.md`, Endpoints from the environment. The first sentence becomes: a
  process with stubs checks every variable its stubs' clients and its sign-in read in one pass,
  `checkConfiguration` at the top of its process file, before any client is built or probed; each
  client reads its own again as it is built; a template's own clients read theirs as each is built.
  The failure sentence adds that several fail together as `Invalid configuration: <message>; <message>`.
- The generated README (`endpointsReadme`), the same in its words. Its first sentence becomes
  "Each process with stubs checks the endpoints its clients and sign-in use in one pass before any
  client is built or probed, and reads each again as it builds that client, with no default". After
  "fails startup with `Invalid endpoint <variable>`, never its value" it adds "(several at once:
  `Invalid configuration: <message>; <message>`)".
- `docs/template-gaps.md`, a new Known limits row: "Configuration was checked one client at a time
  between probes, so a store that was down hid a wrong setting (named in 15 of 96 starts). Found in
  QRWTY arm A's Q04 (AG-01) | Fixed in QG31 for stubs' clients and the sign-in; a template's own
  clients still read theirs as each is built".

**Commit:** `QG31: configuration is checked before the first probe`.

### QG29 — `migrate.mjs` verifies TLS with the deployment's CA (decided by the owner, 2026-11-15)

**Status:** cloud: a managed PostgreSQL with its own CA, reached by a private address.
**Depends:** QG30 (its switch read takes QG30's rule).

**Goal:** `scripts/migrate.mjs` reaches PostgreSQL over a transport the deployment names, with QG10's
setting: TLS verified against its CA, a transport `PGSSLMODE` can't change, and a plain-text one
refused under `JEEVES_REQUIRE_TLS=true`.

**Found (QGR2: [review-batch2.md](review-batch2.md) finding 11 and §Proposed units; Known limits in
`docs/template-gaps.md`).**
- `migrate.mjs` passes no `ssl`, so `pg` follows `PGSSLMODE`: `ssl: true` with Node's roots and the
  host name checked, or `false`, and `no-verify` turns checks off. It doesn't read `PGSSLROOTCERT`.
- So a private CA can't be verified there.
- Nothing refuses a plain-text migration, though its connection carries the admin's password.

**Variables.**
- `JEEVES_MIGRATE_TLS`: `disable` or `verify-full`, with no default (`Invalid endpoint JEEVES_MIGRATE_TLS`).
- With `verify-full`, two optional variables:
  - `JEEVES_MIGRATE_CA_FILE`, a PEM file read at the start. One that can't be read fails
    `Unreadable CA file JEEVES_MIGRATE_CA_FILE (<code>)`, never with its path.
  - `JEEVES_MIGRATE_TLS_SERVERNAME`, by QG10's host rule (`Invalid endpoint JEEVES_MIGRATE_TLS_SERVERNAME`).
- `JEEVES_REQUIRE_TLS`: `true` or unset, else `Invalid endpoint JEEVES_REQUIRE_TLS`.
  - With `true`, `disable` fails `Insecure endpoint JEEVES_MIGRATE_TLS`, unless `PGHOST` starts
    with `/` (a socket directory, local transport, as QG10 accepts).
  - With `true`, QG30's `NODE_TLS_REJECT_UNAUTHORIZED` rule applies too.

**Files.**
- `jeeves-generator/templates/local-v2/assets/scripts/migrate.mjs`:
  - A new first line, `import { checkServerIdentity } from "node:tls";`.
  - A `migrationSsl()` function, called once into `const ssl` before `connect` is defined.
  - `connect`'s `pg.Client` gets `ssl`: `false` for `disable`; for `verify-full`,
    `{ rejectUnauthorized: true, ca?, servername?, checkServerIdentity? }`, built as `postgresSsl`
    in `postgres.ts.template` builds it, so a given name is checked by
    `checkServerIdentity(servername, certificate)`. Every connection (admin, owner, the
    runtime-login checks) uses it.
  - The three anchors of `local.ts`'s `productStep` stay byte-identical: the line
    `import { hash, plan, quote, secret } from "./common.mjs";`, the Keycloak comment and the
    `COMMIT` line.
- `jeeves-generator/src/v2/local.ts`:
  - `setup-migrate`'s `environment` gains `JEEVES_MIGRATE_TLS: "disable"`, as `setup-pubsub` adds
    its own.
  - The generated README's intro gains one sentence after "Migration owners/admin are mounted only
    into setup.": "`scripts/migrate.mjs` reaches PostgreSQL at `PGHOST` and `PGPORT` with
    `JEEVES_MIGRATE_TLS` (`disable`, or `verify-full` with an optional `JEEVES_MIGRATE_CA_FILE`
    and `JEEVES_MIGRATE_TLS_SERVERNAME`), read as a database's `_TLS` is; `PGSSLMODE` can't change
    it, and with `JEEVES_REQUIRE_TLS=true` it must be `verify-full` unless `PGHOST` is a socket
    directory."
- Tests in `jeeves-generator/src/v2/local.test.ts`, beside QG12's test.
- Docs.

**Invariants.**
1. Locally the same as today: Compose sets `disable`, so `ssl: false`.
2. `verify-full` checks the chain and the host name (or `_TLS_SERVERNAME`), with the CA file when
   one is given. No value turns verification off, and `PGSSLMODE` changes nothing.
3. Everything is read before the first connection, so a wrong setting fails before any statement.
4. Nothing else in `migrate.mjs` changes: roles, databases, grants, the lock, history, messages and
   the product step.
5. No process reads these variables.

**Emitted output.**
- `scripts/migrate.mjs`, `compose.yaml` (exports with a database), `README.md`,
  `.jeeves/manifest.json` and `.jeeves/report.json`.
- Pinned (Rule 7): `scripts/migrate.mjs`, `README.md` and `.jeeves/manifest.json` in all three;
  `compose.yaml` in `frozen-v2` and `v2-module-design`. Any other pinned path: stop.

**Offline tests** (`local.test.ts`; each fails before):
- **Text checks.** The emitted `migrate.mjs` has the import and the reads before the first
  `connect(`. `pg.Client` gets `ssl`. Compose gives `setup-migrate` `JEEVES_MIGRATE_TLS: "disable"`.
  With processes on, the product step is still substituted.
- **Behaviour.** Use `frozen-v2`'s emitted `scripts/migrate.mjs` and `scripts/common.mjs`, copied to
  a temporary directory with `infra/local.json` = `{}`, a `SECRET_DIR` holding `postgres-admin`, and
  a fake `node_modules/pg`. The fake's `Client` prints its options' `ssl` as one JSON line
  (`checkServerIdentity` as its `typeof`), and its `connect` rejects `stop`. Run each case with a
  child `node`:
  - `disable` → `false`, with `PGSSLMODE=require` too;
  - `verify-full` → `{ rejectUnauthorized: true }`; with a CA file, its exact text; with a server
    name, `servername` and a function `checkServerIdentity`;
  - `JEEVES_MIGRATE_TLS` unset, or `require` → `Invalid endpoint JEEVES_MIGRATE_TLS`;
  - a missing CA file → `Unreadable CA file JEEVES_MIGRATE_CA_FILE (ENOENT)`;
  - the switch with `disable` → `Insecure endpoint JEEVES_MIGRATE_TLS`, and with
    `PGHOST=/cloudsql/p:r:i` it passes (`false`);
  - the switch with `NODE_TLS_REJECT_UNAUTHORIZED=0` → `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`.
  - Every failing case prints no `Client` line.
  - Delete the temporary directory afterwards.

**Docker proof.** QG10's, on the migration. Use a scratch PostgreSQL 17.11 (the pinned digest)
that accepts only `hostssl`, with a CA and a server certificate generated at run time in the scratch
directory, never in the repository. Run `after-probe`'s `migrate.mjs` with QG12's command shape
(`env PGHOST=127.0.0.1 PGPORT=… SECRET_DIR=… node scripts/migrate.mjs`):
- `verify-full` with that CA completes, and a repeat applies nothing new;
- another CA is refused, exit 1, nothing applied;
- `disable` is refused by the server (no `pg_hba.conf` entry without encryption);
- `verify-full` with `PGSSLMODE=disable` still connects over TLS (`pg_stat_ssl.ssl` is true for
  its backend);
- `JEEVES_REQUIRE_TLS=true` with `disable` fails before connecting.
Remove the container by name.

**Required regressions:** check, e2e, build. Docker phase: `--suite=core` and `--suite=regeneration`.
**Docs.**
- `jeeves-generator/README.md`: in Verified TLS bindings, "and `migrate.mjs` still follows
  `PGSSLMODE`" becomes what it reads now; the QG12 paragraph names the variables.
- `docs/template-gaps.md`: the row "`migrate.mjs` can't verify a private CA …" becomes "Fixed in
  QG29", and the plain-text row drops "`migrate.mjs` still follows `PGSSLMODE`".

**Commit:** `QG29: migrate.mjs verifies TLS with the deployment's CA`.

### QG28 — Each Pub/Sub loop stub gets its own subscription (decided by the owner, 2026-11-15)

**Status:** local and cloud.
**Depends:** QG27 (the same consumer code) and QG31 (the same files).

**Goal:** every loop stub on a Pub/Sub topic consumes its own subscription,
`<topic>--<tile>--<module>`, so every module sees every message. Copies of one tile still share
their module's subscription and compete for its messages.

**Found (QGR2: [review-batch2.md](review-batch2.md) finding 5 and §Proposed units).** Two loop stubs
of one tile on one topic share `<topic>--<tile>` and split its messages, while RabbitMQ gives each
consuming module of a topic its own subscriber queue.

**Names.**
- Every Pub/Sub loop stub, alone on its tile or not, in either queue mode, gets subscription
  `<topic>--<tile>--<module>`. `<tile>` is `generationLocalIdentity(tile).local`, as today, and
  `<module>` is `generationLocalIdentity(<module>).local`, the `id` that `stubLoops` uses.
- Each gets dead-letter topic `<topic>--<tile>--<module>.failed` and a pull subscription of that
  name.
- The settings are unchanged: 60 s ack deadline, retries backing off from 1 s to 10 s, 100 delivery
  attempts.
- Because a name never depends on how many modules consume, adding a second loop stub never renames
  the first one's subscription. Every existing subscription is renamed once (Noticed for the owner,
  below).

**Files.**
- `jeeves-generator/src/v2/local-contract.ts`:
  - `pubsubSubscription(topic, tile, module)` returns
    `{ name: <topic>--<tile>--<module>, failed: <name>.failed }`.
  - New `pubsubSubscriptions(model: LoopModel, topic, tile)`: for each loop stub of the tile's
    process whose `consumes` has that topic (by `generationLocalIdentity(queue.element).local`),
    that module's subscription, sorted by name with `v2Compare`.
  - Both doc comments are updated.
- `jeeves-generator/src/v2/loop-wiring.ts`, `stubLoops`: `pubsubSubscription(topic, process.tile, id)`.
- `jeeves-generator/src/v2/local.ts`:
  - The Pub/Sub plan (the `byKind("pubsub")` loop) adds, for each consuming host, every entry of
    `pubsubSubscriptions(model, r.id, host)`, each with its `.failed` topic and pull subscription,
    named and checked by `pubsubName` as today.
  - The comment above it is updated.
  - The README's Pub/Sub paragraph (below).
- `jeeves-generator/src/v2/client-wiring.ts`, `provisionedAs`, the consuming Pub/Sub row:
  - With one module, today's text with the new names: "Google Cloud Pub/Sub subscription <name> on
    topic <topic>, with dead-letter topic <name>.failed and its subscription (<local>)".
  - With several: "Google Cloud Pub/Sub subscriptions <a>, <b> on topic <topic>, one per consuming
    module, each with its dead-letter topic <subscription>.failed and its subscription (<local>)".
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`,
  `pubsubLoop`'s doc comment: "its tile's Pub/Sub subscription `<topic>--<tile>`" becomes "its own
  Pub/Sub subscription `<topic>--<tile>--<module>`", and `<topic>--<tile>.failed` becomes
  `<subscription>.failed`. Its comment only; no code changes.
- The Pub/Sub suite and fixture: `jeeves-generator/integration/scenarios/pubsub.system.test.ts`'s
  `subscription` becomes `"clicks--tally--count"`, and `field-projects/generator-system/README.md`
  names it everywhere it names `clicks--tally`.
- Tests: `jeeves-generator/src/v2/pubsub.test.ts`.
- Docs: `jeeves-generator/README.md` (the Provisioning row for a queue saved on Google Cloud, and
  Pub/Sub loops).

**The README's Pub/Sub paragraph** (`pubsubReadme` in `local.ts`). "Each tile that consumes a topic
gets subscription `<topic>--<tile>`, which its copies share (another tile gets its own, so each
tile gets every message)" becomes "Each loop stub that consumes a topic gets its own subscription,
`<topic>--<tile>--<module>`, which its tile's copies share (every other loop stub, of this tile or
another, gets its own, so each gets every message, in either mode)". Each `<topic>--<tile>.failed`
in that paragraph becomes `<subscription>.failed`.

**Invariants.**
1. RabbitMQ is unchanged: `subscriberQueue` and `subscriberQueues`, `broker-init.mjs` and its plan.
2. One subscription per Pub/Sub loop stub per topic, with its own `.failed` topic and pull
   subscription. The loop's `config.loops[n].queue` and `failedQueue` are its own, and the report
   row names them.
3. Processes still create nothing, and `pubsub-init.mjs` is unchanged: it creates what the plan
   lists.
4. A publisher-only design is unchanged.
5. In work-queue mode, two loop stubs of one tile now each get every message on Pub/Sub, where
   RabbitMQ's share the queue. QG07 already treats tiles that way ("in either mode"), and the
   generator README says so.

**Emitted output.**
- For a design with a Pub/Sub loop: `infra/local.json`, the consuming process files,
  `src/runtime/module-clients.ts` (the comment), `README.md`, `.jeeves/report.json` and
  `.jeeves/manifest.json`. For a publisher-only Pub/Sub design, `README.md`, report and manifest.
- Pinned: none expected; if `processes-off.test.ts` fails, follow Rule 7.
- Regeneration proof: the probe and r83 change only manifest and report. The Pub/Sub fixture
  changes the paths listed in the first bullet.

**Offline tests** (`pubsub.test.ts`; each fails before):
- **Two loops on one tile.** Take the stub stack on Google Cloud (`cloud`) with a second loop stub
  on Visit worker, added with `runStudioCommands`:
  `{ type: "addModule", host: "visit-worker", kind: "event-consumer", id: "visit-auditor", name: "Visit auditor" }`
  and
  `{ type: "connectModule", module: "visit-auditor", slot: "channel", target: { tile: "visits" } }`.
  - `infra/local.json`'s Pub/Sub subscriptions are `visits--visit-worker--visit-auditor` and
    `visits--visit-worker--visit-consumer`, with their two `.failed` pulls.
  - Its topics include both `.failed` topics, and there is no `visits--visit-worker`.
  - `src/processes/visit-worker.ts`'s two loops consume their own names.
  - The report row names both.
- **Work-queue mode.** The same design with Visits edited to `mode: "work-queue"` has the same two
  subscriptions.
- **Today's `cloudExport`.** Its subscription is now `visits--visit-worker--visit-consumer`: update
  every existing assertion of an emitted Pub/Sub name in this file and in any other test that fails
  for this reason. A name a test passes to a fake itself stays as it is.

**Docker phase:** `--suite=pubsub` (P1–P9 on `clicks--tally--count`) and `--suite=core`. **Docker
proof:** none beyond the suite. The plan's subscriptions are rows `pubsub-init.mjs` creates with
its existing, tested code, and each subscription getting every message is Pub/Sub's own rule.
**Required regressions:** check, e2e, build.
**Commit:** `QG28: each Pub/Sub loop stub gets its own subscription`.

### QG32 — Generated files end with one newline (ready)

**Status:** cosmetic: every application that commits its export sees `git diff --check` flag two
generated files.
**Depends:** none.

**Goal:** no emitted file ends with a blank line.

**Found (arm A, Q05: qrwty `docs/evidence/q05/checks.md` lines 241 and 253; the Q05 review, line
43).**
- `git diff --check` over the export reports `new blank line at EOF` for `Dockerfile` and
  `src/features/service-resources.ts`.
- Read here: the asset `templates/local-v2/assets/Dockerfile` ends with `\n\n`. It is the only file
  under `jeeves-generator/templates/` that does.
- `composition.ts` strips `service-resources.ts.template`'s sections with
  `// @<name>-start[\s\S]*?// @<name>-end`, which becomes `""` when the section is dropped. When it
  is kept, only the markers become `""`. Either way the file's last line, `// @cache-end`, ends up
  empty.

**Files.**
- `jeeves-generator/templates/local-v2/assets/Dockerfile`: delete its last, empty line and nothing
  else.
- `jeeves-generator/src/v2/composition.ts`: after the section loop,
  `constructors = constructors.replace(/\n+$/, "\n");`, with a one-line comment.
- A test in `jeeves-generator/src/v2/local.test.ts`.

**Invariants.**
1. Only the final blank line goes; every other byte of both files is unchanged.
2. The blank lines the kept markers leave inside `service-resources.ts` stay. Removing them would
   change every pinned copy's lines for no reader.
3. No other template or emitter changes.

**Emitted output.**
- `Dockerfile` and `src/features/service-resources.ts`, each where the export has it, and
  `.jeeves/manifest.json`.
- Pinned (Rule 7): `Dockerfile` and `.jeeves/manifest.json` in all three;
  `src/features/service-resources.ts` in `frozen-v2` and `v2-module-design`. Any other pinned path:
  stop.

**Offline test** (`local.test.ts`, beside QG22's test). It covers the exports QG22's test builds
and the probe fixture (`docs/plans/qrwty-gaps/fixtures/probe-design.json`, read as
`client-wiring.test.ts` reads it).
- No emitted file's bytes end with `\n\n`.
- `Dockerfile` and `src/features/service-resources.ts` end with exactly one `\n`.
- Before changing anything, run it on HEAD. It must fail on exactly those two paths. If it names
  any other path, stop (Rule 2) and list them in the handoff.

**Docker proof:** none.
**Required regressions:** check, e2e, build. Docker phase: `--suite=core` (the image builds from
the changed `Dockerfile`).
**Commit:** `QG32: generated files end with one newline`.

### QG33 — Three limits for managed deployments (ready, docs)

**Status:** docs only; AG-04, AG-05 and AG-06 get no unit (B2, B3).
**Depends:** QG28 (the AG-05 row names its subscriptions).

**Goal:** a deployer reads each of these three limits, with its workaround, in one place.

**Found (arm A, Q04: qrwty `docs/evidence/q04/a-found-gaps.md` lines 14–16, 60–91).**
- The cache's password is read once and sent on every connection.
- Topic and subscription names are compiled into the process files and the setup plan.
- `infra/local.json`'s provider logins and databases include the local Keycloak's (`i_identity`,
  `io_identity`, `ik_identity`), so `migrate.mjs` creates them and needs two secrets even where the
  issuer is managed.

**Files.** `docs/template-gaps.md`, Known limits: three rows after the table's last row, in this
order and with this text:
1. "A cache's password is read once from its secret file and sent on every connection, so a managed
   cache's token authentication can't be used (Memorystore for Valkey's IAM tokens expire an hour
   after they are fetched). Such a cache runs with authentication off, reachable only on a private
   network, with `verify-full`. Found in QRWTY arm A's Q04 (AG-04) | Open; deferred until a field
   project needs it: a credentials provider that fetches a fresh token per connection, selected by
   a variable"
2. "Pub/Sub topic and subscription names are the design's IDs (`<topic>`,
   `<topic>--<tile>--<module>` and its `.failed`), compiled into the process files and
   `infra/local.json`, as database, login and bucket names are, so two deployments of one design
   can't share a Google Cloud project. Found in QRWTY arm A's Q04 (AG-05) | Open; a later unit can
   read the names from the environment as QG06 reads endpoints"
3. "`migrate.mjs` creates every provider database and login in `infra/local.json`, the local
   Keycloak's included (for Identity `identity`: `i_identity`, `io_identity`, `ik_identity`), also
   where a deployment uses a managed issuer: one unused database, and two secrets the migration job
   must still be given. Found in QRWTY arm A's Q04 (AG-06) | Open (harmless; give the two secrets
   random values)"

**Invariants.** No other line of any file changes.
**Emitted output:** none (no template changes).
**Required regressions:** check.
**Commit:** `QG33: three limits for managed deployments`.

### QG34 — A credential's file can be named by its own variable (needs the owner, B1)

**Status:** cloud (Cloud Run mounts each secret at its own path). Needs the owner: it adds a family
of deployment variables beside QG06's endpoints.
**Depends:** none.

**Goal:** each credential a process or setup script reads can come from a file the deployment
names, so a platform that mounts every secret at its own path needs no wrapper.

**Found (arm A, Q04: qrwty `docs/evidence/q04/a-found-gaps.md` lines 13 and 47–58).**
- `readSecret(name)` reads `${SECRET_DIR ?? "/run/secrets"}/${name}`, and so does `migrate.mjs`,
  through `common.mjs`'s `secret`.
- Cloud Run doesn't allow mounting two secrets at one path. Redirect service, Link API and Account
  API read two credentials each, and the migration job reads fourteen.
- Q04 mounts each secret at `<dir>/<name>/value`, links them into one directory in a preflight,
  and starts the process through a shell (`SECRET_DIR=… exec node …`).

**The variable.** `JEEVES_SECRET_<NAME>_FILE`, where `<NAME>` is the secret's name upper-cased
with each `-` and `.` as `_` (`sql-links--redirect-service` →
`JEEVES_SECRET_SQL_LINKS__REDIRECT_SERVICE_FILE`).
- It is optional. When it is set, it holds an absolute path to the file, which is read as the
  credential (trimmed, as today). Unset, the credential is read from `<SECRET_DIR>/<name>` as
  today.
- A set value that isn't absolute, or holds a control character, fails `Invalid endpoint <variable>`.
- A file it names that can't be read fails `Unreadable secret file <variable> (<code>)`, never with
  the path or the value.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/local.ts`, `readSecret`: the name rule
  first (`Invalid secret identity`, as today), then the variable, then the read.
- `jeeves-generator/templates/local-v2/assets/scripts/common.mjs`, `secret`: the same variable
  rule.
- `jeeves-generator/src/v2/local.ts`: one sentence in the generated README's intro, after
  "Migration owners/admin are mounted only into setup." (or after QG29's sentence): "A credential
  is read from `JEEVES_SECRET_<NAME>_FILE` when that is set (an absolute path; `<NAME>` is the
  secret's name upper-cased, with `-` and `.` as `_`), else from `SECRET_DIR/<name>`
  (`/run/secrets/<name>`, where Compose mounts it)."
- Tests in `jeeves-generator/src/v2/local.test.ts`.
- Docs: `jeeves-generator/README.md`, where it describes secrets and `SECRET_DIR`, and
  `docs/template-gaps.md` (a row).

**Invariants.**
1. Unset, every read is today's byte for byte: `SECRET_DIR`, `/run/secrets`, `.trim()`, and the
   name rule first.
2. Both readers apply the same rule.
3. Compose sets none of these variables, since locally the files are where Compose mounts them.
   Nothing else reads a secret.
4. The report's `environment` and the README's per-process lists don't list them; they are
   optional, like `_CA_FILE`. The README sentence gives the rule.

**Emitted output.**
- `src/runtime/local.ts`, `scripts/common.mjs`, `README.md`, `.jeeves/manifest.json` and
  `.jeeves/report.json`.
- Pinned (Rule 7): `src/runtime/local.ts`, `scripts/common.mjs`, `README.md` and
  `.jeeves/manifest.json` in all three. Any other pinned path: stop.

**Offline tests** (`local.test.ts`; each fails before):
- **`readSecret`.** Load the emitted `src/runtime/local.ts`, type-stripped, as `tile-guard.test.ts`
  loads emitted files. In a temporary directory:
  - the default read comes from `SECRET_DIR`;
  - the variable, naming another file, wins;
  - a relative value fails `Invalid endpoint JEEVES_SECRET_<NAME>_FILE`;
  - a missing file fails `Unreadable secret file JEEVES_SECRET_<NAME>_FILE (ENOENT)`, with no path
    in the message;
  - an invalid name fails `Invalid secret identity` before the variable is read.
- **`common.mjs`.** Copy the emitted `common.mjs` to `scripts/` in a temporary directory, with
  `infra/local.json` = `{}`. A child `node` runs the same four cases for `secret`, as QG22's test
  runs `setup.mjs`.

**Docker proof.** Run it on `after-probe` with the probe bodies and the override, as project
`qg34-probe`.
1. `pnpm first-run`.
2. Give `app-front` and `setup-migrate` Cloud Run's shape in the override:
   - each secret in the service's `secrets` list, bind-mounted read-only from
     `.runtime/secrets/<name>` at `/credentials/<name>/value`;
   - `JEEVES_SECRET_<NAME>_FILE: /credentials/<name>/value` for each;
   - `SECRET_DIR: /nonexistent`.
3. `pnpm start`: `setup-migrate` exits 0, and `app-front` is healthy (its probes used each
   credential).
4. Point one variable at a missing file: `app-front`'s `startup-failed` line names
   `Unreadable secret file <variable> (ENOENT)`.
5. Tear down as QG31 does.

**Required regressions:** check, e2e, build. Docker phase: `--suite=core` and `--suite=wiring`.
**Docs.** `docs/template-gaps.md`, a new Known limits row: "Credentials were read from one
directory only, `SECRET_DIR/<name>`, and Cloud Run mounts each secret at its own path. Found in
QRWTY arm A's Q04 (AG-03) | Fixed in QG34: `JEEVES_SECRET_<NAME>_FILE` names a credential's file".

**Commit:** `QG34: a credential's file can be named by its own variable`.

### QGR3 — Review batch 3

**Who.** A fresh reviewer (Fable, xhigh) that implemented none of the batch's units.

**What it reads and checks.**
- Every batch-3 handoff entry, and `git diff <QGB3's commit>..HEAD`.
- Each unit's invariants, pins and emitted-output lists, against its brief.
- The regeneration proof across the batch: the two fixtures and the Pub/Sub fixture.
- The interactions between units in these files:
  - `module-clients.ts.template` (QG30, QG31, QG28);
  - `tile-guard.ts.template` and the guard's lines (QG30, QG31);
  - `migrate.mjs` and `common.mjs` (QG29, QG34);
  - `service-resources.ts.template` (QG30, QG32).

**What it runs:** check, e2e, build and `pnpm test:generated --suite=all`.

**What it may fix:** a small defect, only with a test that fails before and passes after.

**What it records** in `docs/plans/qrwty-gaps/review-batch3.md`:
- the rest of its findings, with any new unit under **Proposed units**, marked ready or needs the
  owner;
- the owner's answers to B1–B4;
- a Known limits row in `docs/template-gaps.md` for a declined unit's gap;
- what a regeneration of arm A's export would change, QG28's renamed subscriptions included.

**Isolation:** it reads nothing of the QL plan or of QRWTY arm B.
**Commit:** `QGR3: review QRWTY gap batch 3`.

---

# QRWTY-driven generator gaps: QG01–QG20

**Status:** proposed 2026-11-14 by QRWTY unit Q03 (arm A) from Jeeves at `59bfbc6` (SO08),
registry `08e0c945…d322d`. Written from the code and from probes of generated output
([capability audit](../../evidence/q03/capabilities.md)); **nothing is implemented**. The QRWTY
coordinator copies each unit into Jeeves as its own plan (suggested folder
`docs/plans/qrwty-gaps/`), together with the shared sections below, and assigns it to a fresh
Jeeves agent. That agent works under Jeeves's `AGENTS.md`, does only its unit, commits it and
stops. All of this work is charged to QRWTY arm A's template-development ledger.

**Amended** 2026-11-14 by Q03b from the [Q03 review](../../evidence/q03/review.md): QG06 (R3),
QG07's owner decision (R9), QG10 (R8), QG12 (R1) and the new units QG17–QG20. The readings
this needed are in [Q03b notes](#q03b-notes).

## Order and status

QG01–QG16 are numbered in dependency order; QG17–QG20 come from the Q03 review and continue the
numbers. "Local" means needed before QRWTY's local build can pass (Q04/Q05 and the product units
named); "cloud" means needed only for managed services (Q12a/Q13); "deferred" means not needed
now, with the reason. "Assign now?" is the review's section 5, with the amendments it asked for
applied.

| Unit | Title | Status | Depends | Jeeves owner decision first | QRWTY units waiting | Assign now? |
| --- | --- | --- | --- | --- | --- | --- |
| QG01 | Route stubs see the exact request bytes and send repeated headers | Local | — | No | Q07, Q10a | Yes |
| QG02 | The application's own Compose override is a documented seam | Local | — | No | Q06–Q10b, Q12 | Yes |
| QG03 | The application owns its package dependencies | Local | — | **Yes** | Q10a | After owner decision 1; not on the critical path (`.jeeves/overrides.json` serves Q10a meanwhile) |
| QG04 | Stub caches use the bounded Valkey client | Local | — | Minor (startup rule) | Q04, Q08 | After owner decision 3, either answer (a no drops invariant 2) |
| QG05 | The application image runs as a non-root user | Local | — | No | Q04 | Yes |
| QG06 | Store and tile endpoints come from the environment | Local | — | **Yes** (D1) | Q04 | After owner decision 2 (R3 applied) |
| QG07 | Pub/Sub channels and stub publishers | Local | QG06 | No (pins are a note) | Q04, Q08 | After QG06 |
| QG08 | Stub loops consume Pub/Sub subscriptions | Local | QG07 | No | Q04, Q10 | After QG07 |
| QG09 | Generated-system tests for Pub/Sub channels | Local | QG08 | No | Q05 (not Q04's start) | After QG08 |
| QG10 | Verified TLS bindings and an insecure-endpoint refusal | Local (R01 runs it locally) | QG04, QG06, QG07 | No | Q04, Q12 | After QG04, QG06 and QG07 (R8 applied) |
| QG11 | The sign-in audience comes from the environment | Cloud | QG06 | No | Q12a | Yes (cloud) |
| QG12 | Migrations run with a non-superuser admin, one at a time | Cloud | — | No | Q12a, Q13 | Yes (cloud; R1 applied) |
| QG13 | Database stubs get a scoped transaction | Deferred: one-statement product SQL functions are atomic today (probe `/fn`) | — | — | — | No (deferred) |
| QG14 | A scheduled trigger for Worker stubs | Deferred: QRWTY uses authenticated scheduled owner calls with leases | — | Yes | — | No (deferred) |
| QG15 | Per-route exposure on a public tile | Deferred: QRWTY moves internal routes to an internal tile and owns its edge | — | Yes | — | No (deferred) |
| QG16 | Startup with a lost broker or publisher, and a bounded drain | Deferred: Jeeves BR plan left startup to a later owner decision; QG04 removes the observed drain hang | QG04, QG07 | **Yes** | — | No (deferred) |
| QG17 | Database calls settle while PostgreSQL stalls | Local (before Q04, with QG04) | — | No | Q04 | Yes |
| QG18 | A client-side query timeout counts as unreachable | Local, after the owner | QG17 | **Yes** (store-outage Decision) | — (the review names none) | After the owner's answer (decision 6) |
| QG19 | The admission's 503 answers carry `Retry-After` | Local | — | No | — (the review names none) | Yes |
| QG20 | External API and Identity tiles give stubs a configured HTTP client | Local, after the owner | QG06 | **Yes** | Q07, Q09, if confirmed | After the owner's answer (decision 7); before Q07/Q09 if yes |

QG01–QG06, QG12, QG17 and QG19 are independent and can run in any order; QG10 waits for QG04,
QG06 and QG07, QG18 for QG17, and QG20 for QG06; the Pub/Sub chain QG06 → QG07 → QG08 → QG09 is
the longest. QG17 lands before Q04, with QG04. QG09 is required before Q05's freeze, not before
Q04's start. Landing QG11 and QG12 before QRWTY's Q05 baseline freeze avoids a later
regeneration of the frozen baseline.

## Why

QRWTY is a link and QR service whose diagram ([Q01](../../evidence/q01/checks.md)) generates six
processes with 11 stubs. Its local acceptance runs the GCP Pub/Sub emulator, Toxiproxy between
every process and every dependency, at least two copies of each process, a Stripe fixture driven
through the official SDK, and production-profile refusals ([neutral pack v1.1
acceptance](../../benchmarks/neutral-pack/v1.1/frozen/acceptance-oracle.md)). Q03 probed the
generated code against those needs. What exists is in the audit's section 1 and is not repeated
here (HTTP status and headers, Optional sign-in, broker reconnect BR01, unreachable-store waits
SO01/SO04, the template cache PF07, product SQL and grants). What follows are the generic gaps
the probes found, each as small as one fresh agent can finish.

## Decisions for the Jeeves owner before assignment

1. **QG03:** an application adds npm packages its stubs and hooks use (QRWTY: the Stripe SDK the
   billing contract requires). Choose (a) `package.json` and `pnpm-lock.yaml` become the
   application's own files (`generated-extension`), the default written below; or (b) they stay
   generated and listing them in `.jeeves/overrides.json` is declared the supported way, not a
   template gap (docs only).
2. **QG06:** production foundations D1 lists "host names from the environment" as deployment.
   QG06 keeps every value deployment's and only makes generated processes read endpoints from
   their environment instead of compiled Compose names. Confirm, or keep D1 as it is (then QRWTY's
   Toxiproxy faults and same-image promotion stay blocked).
3. **QG04:** a stub's cache that is down at startup no longer stops the process, as PF07 decided
   for the cache read. Confirm, or keep the stub probe fatal (QG04 then drops its invariant 2).
4. **QG07 (a note, not a decision):** pins follow the existing convention; every provider SDK
   already ships in each export. The Pub/Sub SDK and emulator pins below are the ones QRWTY's
   neutral oracle uses; they enter every export's lock file (like `hls.js` today).
5. **QG14–QG16:** deferred; each needs a decision before it is planned in detail.
6. **QG18:** `Query read timeout` (QG17's client-side bound) joins the store-outage Decision's
   list of unreachable errors, so a worker whose database stalls keeps its attempt; a stall that
   never ends then cycles for ever, as any outage does under the Decision. Confirm, or keep the
   list as it is.
7. **QG20:** an External API or Identity link gives a stub a real HTTP client, with the base URL
   from the environment, instead of today's `unavailable` proxy. Confirm, or keep product
   `fetch` adapters (Q03's remedy; nothing then changes).

## Not in this plan

| Item | Why not |
| --- | --- |
| Cloud resources, IAM, Secret Manager, Cloudflare, Cloud Run settings | Deployment; QRWTY's `infra/` (Q04, Q12a, Q13) |
| Object storage (Garage) and search (OpenSearch) endpoints from the environment | QRWTY uses neither; a later unit can extend QG06's convention |
| Pub/Sub for template-owned channels (event counter, lifecycle, media) | QRWTY's channel is a stub's; templates keep RabbitMQ (QG07 refuses the combination) |
| Workload identity tokens on calls between tiles | Deployment choice (Cloud Run ingress versus invoker IAM); revisit if QRWTY's IaC chooses IAM |
| Batch delivery to loop stubs, event-counter receipt retention | Capacity work (QRWTY Q15); the counter limit stays a Jeeves known limit |
| A UI for generated applications | Outside Jeeves |
| Unused generated material (FFmpeg stages, unused dependencies) | No correctness effect; QRWTY's Q05 reports it as unused |
| RabbitMQ TLS | QRWTY has no broker after QG07; QG10's TLS bindings are for databases and caches only |

## Rules for every unit

Jeeves's production foundations "Rules for every unit" 2–8 (Jeeves
`docs/plans/production-foundations/units.md`) apply as written, with these changes:

- **Rule 1:** read `AGENTS.md`; the last three entries of `docs/handoff.md`; this plan's Order,
  Why, Decisions, Not in this plan, Rules and Regeneration proof; then your own unit. Do not read
  or start another QG unit.
- **Rule 6, Docker phase:** run Docker suites in their own phase after `pnpm check`, as SO02 did.
  Create only resources scoped to your run, remove them by exact name (image tags too), never
  prune, never touch `jeeves-postgres-1` or another project's containers, and compare the Docker
  inventory before and after.
- **Rule 9:** append one handoff entry in the usual shape, titled `QGnn: <title>`, saying in
  **Noticed** that the unit is QRWTY-driven (Q03), then make one local commit with the unit's
  commit name. No `HUMAN_FEEDBACK` line. Don't push.
- Where a step below names an API of a pinned package (Fastify 5.12.7, pg 8.23.1, redis 6.3.0,
  `@google-cloud/pubsub` 6.3.2), check it against that version's types in `node_modules`; if it
  differs, follow the unit's Goal and Invariants and record the difference (Rule 2).

## Regeneration proof (shared)

Two fixtures, copied by the coordinator into the plan folder (`fixtures/`) when assigning:

- `probe-design.json`: QRWTY's Q03 probe, SHA-256
  `a3b6204fc40765cee51835caddbee17a653c10d6b4f827783424f50c19430505` (QRWTY
  `docs/evidence/q03/fixtures/probe-design.json`): public Service Front (Optional sign-in;
  Custom stubs Probe and Internal grant on a Database, a Cache, a Queue, an External API and the
  Identity), Worker Tally (a Custom loop stub on the Queue, writing its own Database), Runnable
  processes on. Its application-owned probe bodies and product SQL are in QRWTY
  `docs/evidence/q03/fixtures/app-code/` (stub files and product SQL only).
- `qrwty-r83.json`: QRWTY's saved design, revision 83 (QRWTY
  `docs/evidence/q01/jeeves/QRWTY-production-candidate-v1-r83-source.json`).

Procedure, in the scratch directory: before your change, `pnpm --filter @jeeves/generator export:v2
<fixture> $SCRATCH/before-<name>` for both; after it, the same into `after-<name>`; `diff -rq`
each pair and list every changed path in the handoff. The changed paths must be exactly the
unit's **Emitted output** list (plus `.jeeves/manifest.json` and `.jeeves/report.json`); any
other path: stop (Rule 2). In each `after-*`: `pnpm install --frozen-lockfile --ignore-scripts
--offline` (without `--offline` only in a unit that adds a dependency) and `pnpm build`, exit 0.
A unit that names a **Docker proof** runs it on `after-probe` with the probe bodies copied to
their `generated-extension` paths, under its own Compose project and loopback ports, then removes
it. Delete the scratch exports at the end.

---

### QG01 — Route stubs see the exact request bytes and send repeated headers

**Status:** local. QRWTY's Payment events must check Stripe's signature over the body as received
(A20), and its Session API must set a session cookie and a CSRF cookie in one answer (Q07).
**Depends:** none.

**Goal:** a route stub can verify a signature over the request body byte for byte, and can answer
with several values of one header.

**Found (Q03).** A 57-byte JSON body reaches the stub as an object whose re-serialization is 48
bytes, so an HMAC over it differs; `ModuleRequest` has only `method, path, query, headers, body,
caller`. Two `Set-Cookie` values reach the client at run time, but `ModuleResponse.headers` is
`Record<string, string>` (TS2322).

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/http.ts.template` (`createHttpService`)
- `jeeves-generator/templates/local-v2/assets/src/runtime/tile-http.ts.template` (`moduleRequest`, `stubRoutes`)
- `jeeves-generator/templates/local-v2/assets/src/modules/entry.ts.template` (`ModuleRequest`, `ModuleResponse`)
- Tests: `jeeves-generator/src/v2/tile-processes.test.ts` (the "emitted HTTP service and process
  runtime" block, which loads the emitted `http.ts`) and `jeeves-generator/src/v2/tile-guard.test.ts`
  (which loads the emitted `tile-http.ts`).
- Docs: `jeeves-generator/README.md` (Module routes, the route stub bullet); any sentence in
  `docs/studio.md` that lists `ModuleRequest`'s fields.

**Invariants.**
1. `request.body` is unchanged for every request: the same parsed JSON or text, 400 for invalid
   or empty JSON, 413 over 64 KiB, 415 for any other content type.
2. New `request.rawBody`: the bytes the HTTP service received, unchanged (no decoding, no BOM or
   whitespace change), for an `application/json` or `text/plain` request with a body; `undefined`
   when there is no body. The same 64 KiB limit covers it.
3. A `ModuleResponse.headers` value may be a string (as today) or an array of strings; an array
   sends one header line per value, in order. `Cache-Control: no-store` is still set on every
   answer.
4. `/healthz`, the sign-in routes and every mounted template (cache read, Favorites, multipart,
   search) answer exactly as before.

**Emitted output.** `src/runtime/http.ts`, `src/runtime/tile-http.ts`, `src/modules/entry.ts`.
Pinned (Rule 7): `src/runtime/http.ts` (frozen-v2, v2-module-design) and `.jeeves/manifest.json`.

**Steps.**
1. `http.ts.template`: remove Fastify's default `application/json` and `text/plain` parsers and add
   two with `parseAs: "buffer"` and `bodyLimit: 65536`. Each keeps the received `Buffer` on the
   request (a `rawBody` request decoration, `undefined` by default, typed by a `FastifyRequest`
   module augmentation) and produces the value and the errors Fastify's defaults produce: JSON
   through Fastify's own default JSON parser (`app.getDefaultJsonParser` with its default
   poisoning options; give it `body.toString("utf8")` if it takes a string), text as the UTF-8
   string.
2. `tile-http.ts.template`: `moduleRequest` adds `rawBody: request.rawBody`; `stubRoutes` sends an
   array value with `reply.header(name, [...value])`.
3. `entry.ts.template`: `rawBody?: Uint8Array` with the doc comment "The body's bytes exactly as
   received (JSON or text, up to 64 KiB), to check a signature over them; undefined when there
   is none. Don't change it." `headers?: Record<string, string | readonly string[]>` with "An
   array sends the header once per value, such as two `Set-Cookie` lines."
4. Pins by Rule 7 with the paths above.

**Offline tests** (each fails on HEAD's templates, passes after; say how many):
- emitted service, `POST` `application/json` with the bytes
  `{"id":"evt_1",  "amount": 100,\n "name":"café", "n": 1.0}` (57 bytes UTF-8): the route sees
  `rawBody` equal to them and `body` equal to `{ id: "evt_1", amount: 100, name: "café", n: 1 }`;
  `text/plain` likewise; `GET` has `rawBody` undefined;
- the unchanged answers: 65,537 bytes of JSON 413, `{"bad":` 400, an empty JSON body the status
  the runtime before the change gives, `application/x-www-form-urlencoded` 415;
- `stubRoutes`: an entry answering `{ headers: { "Set-Cookie": ["a=1; Path=/", "b=2; Path=/"] } }`
  gives `set-cookie` equal to both values in order; a string header as today; the entry's
  request carries `rawBody`.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=wiring` and
`--suite=identity`. Nothing user-visible in the studio: no mouse check.
**Regeneration proof:** shared; emitted paths as above.
**Done when:** the new tests fail before and pass after, and the pins changed only as listed.
**Commit:** `QG01: route stubs see the exact request bytes and send repeated headers`.

### QG02 — The application's own Compose override is a documented seam

**Status:** local. QRWTY's own modules need their own environment and secrets (Stripe fixture
URL and key, Web Risk endpoint, OIDC client settings, cookie keys) and a service of their own (a
scheduler that calls owner routes, a trusted test edge), without editing the generated
`compose.yaml`.
**Depends:** none.

**Goal:** an export says that `compose.override.yaml` beside `compose.yaml` is the application's
own file, and a test keeps the generated scripts from dropping it.

**Found (Q03).** Docker Compose merges a `compose.override.yaml` into every `docker compose` call
the generated scripts make, because none passes `-f` or sets `COMPOSE_FILE`: a probe module saw
`PROBE_OVERRIDE` from it, and `docker compose config` showed it merged. Nothing documents or
guards this; `local.mjs`'s composition hash covers only `compose.yaml` and `infra/local.json`, so
editing the override never refuses `start`.

**Files.** `jeeves-generator/src/v2/local.ts` (the generated README's text); the test file that
already reads the emitted `scripts/local.mjs` or the README (`src/v2/local.test.ts` or
`loop-wiring.test.ts`); `jeeves-generator/README.md` ("Updating an existing export", Kept;
"Runnable processes", running an export). No script changes.

**Invariants.** No export ever contains `compose.override.yaml`; `update:v2` never touches it
(already true: it is in no manifest); the emitted `scripts/common.mjs` and `scripts/local.mjs`
never pass `-f`, `--file` or `--project-directory` and never set `COMPOSE_FILE`; the composition
hash stays as it is.

**Emitted output.** `README.md` (pinned in all three exports) and `.jeeves/manifest.json`.

**Steps.**
1. The generated README gains this paragraph after its run instructions:
   "**Your own configuration.** `compose.override.yaml` beside `compose.yaml` is yours: export
   never writes it and `update:v2` never touches it. Docker Compose merges it into every command
   `pnpm first-run`, `start` and `stop` run, so give your modules their own `environment` and
   `secrets` there, or add a service of your own (for example a scheduler that calls your
   routes). Don't redefine a generated service's image, command, ports or healthcheck. A change
   applies at the next `pnpm start`."
2. A test: the emitted `scripts/common.mjs` and `scripts/local.mjs` contain none of `"-f"`,
   `"--file"`, `"--project-directory"`, `COMPOSE_FILE`; the README contains the paragraph (fails
   before).
3. `jeeves-generator/README.md`: one sentence in each named section. Pins by Rule 7.

**Required regressions:** check, e2e, build. **Docker proof:** export the probe fixture, add QRWTY
`docs/evidence/q03/fixtures/compose.override.yaml`, `pnpm first-run`; `docker compose --profile
'*' config` shows `PROBE_OVERRIDE` on `app-front`; `pnpm stop`; change the value; `pnpm start`
does not refuse and the container's environment has the new value; remove the project.
**Commit:** `QG02: the application's own Compose override is a documented seam`.

### QG03 — The application owns its package dependencies

**Status:** local, after the owner's decision 1. QRWTY's billing contract verifies Stripe webhooks
and calls Stripe through the official SDK (Q10a). If QRWTY's coordinator instead amends the
contract to Stripe's documented `node:crypto` scheme and `fetch`, this unit becomes deferred.
**Depends:** none.

**Goal:** an application adds a package with `pnpm add <name>@<exact version>` in its export
without editing a generated file, and `update:v2` keeps its manifests while showing the
template's new ones.

**Found (Q03).** `package.json` and `pnpm-lock.yaml` are `generated-scaffold` with a fixed
dependency set in every export; the only way to add a package is an override, which Jeeves
records as a template gap.

**Files (option a).** `jeeves-generator/src/v2/local.ts` (the foundation's list that emits
`package.json` and `pnpm-lock.yaml`: emit both as `generated-extension`); tests in
`src/update.test.ts` (`planUpdate` rows) and the test that asserts the foundation's ownership
(`src/v2/local.test.ts` or `assemble.test.ts`); docs `jeeves-generator/README.md` ("Updating an
existing export": Kept lists the two files; "Template hook and report"), and `AGENTS.md`'s
"Hook files, stub bodies and product SQL are the application's own" sentence only if the
owner's decision says to add "and its package manifests".

**Invariants.** A fresh export's two files have today's bytes; only their manifest ownership
changes. `update:v2` on an export whose manifest recorded them as generated: unedited →
`unchanged`; edited by the application → `keep`, never refused; when a later template changes
them → `keep-changed` with the new bytes in `.jeeves/generated/package.json` and
`.jeeves/generated/pnpm-lock.yaml`. An existing `.jeeves/overrides.json` entry for `package.json`
(YouTube v4) keeps working. The Dockerfile is unchanged (it copies both and installs with
`--frozen-lockfile`). `source-loc` still excludes both (they are outside `src/`). The report's
required gaps don't change.

**Emitted output.** `.jeeves/manifest.json` only (every export, pins included).

**Offline tests.** `planUpdate`: generated → extension with unchanged bytes is `unchanged`, with
edited bytes `keep`, with a later template change `keep-changed` and a shadow; a fresh export's
manifest lists both as `generated-extension`. Update in place of YouTube v4's app with
`update:v2 --check`: nothing refused.

**Option b (if chosen instead).** No code: `jeeves-generator/README.md` and
`docs/template-gaps.md` say that overriding `package.json` and `pnpm-lock.yaml` with a reason
naming the added packages is the supported way to add application packages and is not a
template gap. Commit name the same.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=regeneration`
(`update:v2`). **Regeneration proof:** shared; then in `after-probe`, `pnpm add stripe@<an exact
version at least 14 days old>` (network for this one step), `pnpm build`, and `update:v2 --check`
of that directory against the same fixture: no refusal, both files `keep`.
**Commit:** `QG03: the application owns its package dependencies`.

### QG04 — Stub caches use the bounded Valkey client

**Status:** local (QRWTY F01: Valkey stalled during hot redirects; F05: drain; R03).
**Depends:** none.

**Goal:** a stub's cache call settles within a fixed bound while Valkey is stalled or gone, a
stall never holds a drain open, a cache that is down at start doesn't stop the process, and the
client comes back by itself: the rules the cache read already has (PF07's `createValkeyCache`).

**Found (Q03).** The stub `cacheClient` (`module-clients.ts`) builds its own `redis` client with
no command deadline and no queue bound, and its startup probe is fatal. With Valkey paused a
`get` waited for the HTTP deadline (503 at 1.11 s); a product-side race returned at 100 ms but
left the command pending, and that pending command kept SIGTERM's drain open until SIGKILL (exit
137 at 10 s). A Front restarted with its cache stopped failed startup and stayed down. In redis
6.3.0 a per-command `timeout` is dropped once the command is written, so it cannot bound a
stalled reply; `createValkeyCache` bounds it by destroying the generation.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/valkey.ts.template` (`createValkeyCache`:
  add `delete(key)`; let `set` take the expiry a stub needs as well as the reader's `{ PXAT }`)
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template` (`cacheClient`)
- the emitter that selects runtime files for stub clients (`src/v2/client-wiring.ts` or
  `tile-processes.ts`): emit `src/runtime/valkey.ts` whenever a stub uses a cache
- Tests: `src/v2/module-clients.test.ts` (its `cacheClient` test records `createClient`'s options:
  update that named assertion); `src/v2/positive-cache.test.ts` or the file that tests
  `createValkeyCache` (for `delete` and `set`).
- Docs: `jeeves-generator/README.md` (Module clients: the `cacheClient` sentence; the probe
  sentence's exception), `docs/studio.md` if it describes a stub cache.

**Invariants.**
1. `get`, `set` and `delete` settle within 150 ms plus timer slack while Valkey is stalled; the
   generation is destroyed and every pending command rejects; while no generation is ready each
   call rejects at once (`Cache unavailable`); at most 32 commands queue.
2. A cache unreachable at startup: the probe logs one line `{"event":"probe",…,"kind":"cache",
   "check":"PING","result":"unavailable"}` at level `warn`, startup goes on, a new generation is
   tried every 5 s, and each change logs as the reader's does (`cache <module>` failure lines
   through the process's failure log, `"state":"available"` info lines). (Owner decision 3.)
3. `close()` destroys the current client, so a drain never waits on Valkey.
4. `CacheClient` is unchanged: `set(key, value, ttlSeconds?)` with a TTL in seconds (none = no
   expiry), `get` gives `undefined` for a missing key.
5. The cache read (`positive-cache-read`) behaves exactly as before.

**Emitted output.** `src/runtime/module-clients.ts`, `src/runtime/valkey.ts` (now also for stub
caches); pinned: `src/runtime/valkey.ts` (frozen-v2, v2-module-design), `.jeeves/manifest.json`.

**Offline tests** (with the existing fake `redis`; fake timers): a command that never answers
rejects at 150 ms and destroys the client; the next call rejects `Cache unavailable` until a new
generation connects 5 s later; a failed first connect doesn't make `cacheClient` throw and logs
`unavailable`; `delete` sends `DEL`; `set(k, v, 30)` sends `EX 30`, `set(k, v)` no expiry;
`close()` destroys.

**Required regressions:** check, e2e, build; Docker phase `--suite=wiring`, `--suite=faults`,
`--suite=regeneration`, `--suite=media` (every suite with a cache, per the fixture README).
**Docker proof:** the probe export with its bodies: `docker pause` the cache; `GET
…/front-probe/cache` answers (an error from the stub) in under 0.5 s; with one such request in
flight `docker stop -t 10` of Front exits 0 in under 3 s; a Front restarted with the cache
stopped starts and `…/front-probe/redirect` answers 302.
**Commit:** `QG04: stub caches use the bounded Valkey client`.

### QG05 — The application image runs as a non-root user

**Status:** local (QRWTY builds and rehearses its production images locally: R03, Q04). Also
production foundations review follow-up 11.
**Depends:** none.

**Goal:** every generated application and setup container runs as an unprivileged user.

**Found (Q03).** A probe module reported `process.getuid()` 0; the Dockerfile has no `USER`.

**Files.** `jeeves-generator/templates/local-v2/assets/Dockerfile`; the test that reads the
emitted Dockerfile (`src/v2/composition.test.ts` or `local.test.ts`); docs where the image is
described (`jeeves-generator/README.md`).

**Invariants.** `app` and `media` stages run as `node` (uid 1000, from the pinned base image);
every build step before `USER` is unchanged; `/app` stays root-owned and readable; at run time a
process writes only under `/tmp` (the ready marker); Compose secrets stay readable (setup writes
them 0644). If a suite shows a write elsewhere (for example the media worker's FFmpeg work
files), stop (Rule 2) and record the path.

**Steps.** Add `USER node` as the line before `CMD` in the `app` stage and after `COPY --from=app
/app /app` in the `media` stage. Nothing else.

**Emitted output.** `Dockerfile` (every export, all three pins) and `.jeeves/manifest.json`.
**Offline test:** both stages of the emitted Dockerfile contain `USER node` (fails before).
**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=all`
(the fixture README's row for the Dockerfile).
**Docker proof:** the probe export: `docker compose --profile '*' exec app-front id -u` prints
1000, `…/front-probe/env` answers `"uid":1000`, `pnpm stop` exits 0.
**Commit:** `QG05: the application image runs as a non-root user`.

### QG06 — Store and tile endpoints come from the environment

**Status:** local, after the owner's decision 2. QRWTY's oracle injects faults through Toxiproxy
between each process and each dependency (F01–F03), and R05 requires the same image digest in
every configuration; Cloud Run reaches Cloud SQL (a Unix socket or a private address),
Memorystore and other services at deployment-supplied endpoints.
**Depends:** none.

**Goal:** every endpoint a generated process uses is read from its environment at startup, with
no compiled default, and the generated `compose.yaml` sets today's local values, so a local stack
behaves exactly as before.

**Found (Q03).** Both probe processes started on the host with `PGHOST`, `REDIS_URL` and
`AMQP_URL` set still failed on the compiled names (`ENOTFOUND local-broker`,
`ENOTFOUND local-postgres`): `module-clients.ts` and `service-resources.ts` compile
`local-postgres:5432`, `local-broker:5672`, `cache-<id>:6379` and `http://app-<id>:3000`.

**Variables** (exact names; `<ID>` is the tile ID upper-cased with `-` as `_`, so `hot-routes`
is `HOT_ROUTES`):

| Endpoint | Variables | Local value in `compose.yaml` |
| --- | --- | --- |
| A Database tile | `JEEVES_DATABASE_<ID>_HOST`, `JEEVES_DATABASE_<ID>_PORT` | `local-postgres`, `5432` |
| A Cache tile | `JEEVES_CACHE_<ID>_HOST`, `JEEVES_CACHE_<ID>_PORT` | `cache-<id>`, `6379` |
| The broker | `JEEVES_BROKER_HOST`, `JEEVES_BROKER_PORT` | `local-broker`, `5672` |
| Another application tile a stub calls | `JEEVES_TILE_<ID>_URL` | `http://app-<id>:3000` |

**Validation**, when a client is built and before any probe: a host is 1–253 characters of
`[A-Za-z0-9.-]` (`createValkeyCache`'s check becomes this same rule, since QG04 routes stub
caches through it), or for a database an absolute path (a Unix socket directory, as `pg` reads
it);
a port is an integer 1–65535; a URL is absolute `http:` or `https:` with no credentials, query or
fragment. Missing or invalid: startup fails with `Invalid endpoint <variable name>` (never the
value) through the existing `startup-failed` line.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`
  (`databaseClient`, the broker binding, `cacheClient`, `httpTarget`)
- `jeeves-generator/templates/local-v2/assets/src/features/service-resources.ts.template`
  (`pool()` and the broker binding of mounted templates)
- `jeeves-generator/templates/local-v2/assets/src/runtime/valkey.ts.template`
  (`createValkeyCache`'s host check)
- `jeeves-generator/src/v2/http-wiring.ts` (the cache read's Valkey binding), `client-wiring.ts`
  (`httpTarget(...)` calls), `local.ts` (each `app-*` service's `environment`: exactly the
  variables its process reads), `tile-processes.ts` (the report)
- Tests: `module-clients.test.ts`, `client-wiring.test.ts`, `http-wiring.test.ts`,
  `tile-processes.test.ts`, `composition.test.ts`: update only the assertions that name an
  emitted endpoint literal, and list them in the handoff.
- Docs: `jeeves-generator/README.md` (Module clients, Provisioning for stubs, the edge
  paragraph's `http://app-<id>:3000`), `docs/studio.md` where it says where a process finds its
  stores, `docs/template-gaps.md` (Known limits: "Host names are compiled into the export for
  local Compose" becomes "Fixed in QG06: endpoints come from the environment; values are
  deployment").

**Invariants.** Local stacks are unchanged in behaviour: the same hosts and ports, now through
the environment. No code path falls back to a compiled host. Setup scripts keep their own
(`migrate.mjs` already reads `PGHOST`/`PGPORT`; `broker-init.mjs`, `bootstrap.mjs`,
`search-init.mjs` stay local). Object storage, search and Keycloak's settings are out of scope.
`.jeeves/report.json` `processes.tiles[].environment` lists the variable names each process
reads, sorted; the generated README lists them per process.

**Emitted output.** With processes on: `src/runtime/module-clients.ts`, `src/processes/*.ts`,
`src/features/service-resources.ts`, `src/runtime/valkey.ts` (where an export has it),
`compose.yaml`, `README.md`, `.jeeves/report.json`. Pinned (processes off):
`src/features/service-resources.ts`, `src/runtime/valkey.ts` (frozen-v2, v2-module-design),
`compose.yaml`, `README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`; any other: stop.

**Offline tests.** `databaseClient` with `JEEVES_DATABASE_LINKS_HOST=db.internal` and
`_PORT=6432` passes them to `createPostgres` (fake); missing → rejects `Invalid endpoint
JEEVES_DATABASE_LINKS_HOST` before any probe; `/cloudsql/p:r:i` is accepted for a database;
`cacheClient`, the broker and `httpTarget` likewise; the stub stack's emitted `compose.yaml` has
exactly the expected variables per service; the report's `environment` rows.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=all`.
**Regeneration proof:** shared; then, in `after-probe` built, start `node dist/processes/tally.js`
on the host with `SECRET_DIR` pointing at files holding placeholder text and
`JEEVES_DATABASE_TALLY_DB_HOST=db.invalid` (port set): the probe line names `db.invalid`, which
proves the value is read; with the variable unset: `Invalid endpoint JEEVES_DATABASE_TALLY_DB_HOST`.
**Commit:** `QG06: store and tile endpoints come from the environment`.

### QG07 — Pub/Sub channels and stub publishers

**Status:** local. QRWTY's frozen decision is "GCP Pub/Sub via its official client; locally the
Pub/Sub emulator", and every successful redirect awaits a durable publish (A10–A13, A24, F03).
**Depends:** QG06 (its environment convention).

**Goal:** a Queue tile whose users are stubs can be set to provider **Google Cloud** by mouse and
by chat; its stub publishers publish to a Pub/Sub topic with the official SDK and resolve only
after the service acknowledges; locally the export runs the emulator and creates the topic and
every subscription. Consumers come in QG08: until then a loop stub on such a queue is refused for
export with a named gap.

**Found (Q03).** `edit <queue> {provider: "google-cloud"}` and `{mode: "topic"}` are refused ("no
installed, useful editable consumer"). With the SDK 6.3.2 against emulator 591.0.0: a default
publish with the service unreachable was still pending after 20 s, and one with
`gaxOpts.timeout: 1500` rejected at 1.94 s; a resent payload got a new server ID, so a consumer
must deduplicate by an attribute; `deliveryAttempt` is 0 without a dead-letter policy and counts
with one; a nack redelivers at once; the emulator loses topics on restart; its default retention
is 7 days.

**Files.**
- Spec: `jeeves/packages/spec/src/generation-resolver.ts`: a setting decision that makes a Queue's
  `provider` a normal control with values `unspecified`, `self-hosted`, `google-cloud` when the
  processes owner is installed and every user of the queue is a stub (as the `process.*`
  decisions are made); a template's queue keeps today's required `unsupported` gap
  `provider-<module>-<tile>` for `google-cloud`. `generation-support.ts` only if an installed flag
  is needed. The studio's form renders normal controls; check it by mouse.
- Generator: `src/v2/local-contract.ts` (`stubStores`), `src/v2/local.ts` (services
  `local-pubsub` and `setup-pubsub`; `setup-pubsub` runs before the application services, as
  `setup-broker` does), new asset `templates/local-v2/assets/scripts/pubsub-init.mjs`,
  `templates/local-v2/assets/providers.json` (the emulator pin), `templates/local-v2/assets/package.json`
  and `pnpm-lock.yaml` (`@google-cloud/pubsub` `6.3.2`). The asset lock has not changed since
  YV2-04: resolve the new one in a scratch copy of the two assets with `pnpm install
  --lockfile-only` (network for this one step) and pnpm's `minimumReleaseAge` set to `20160`
  minutes, so every new entry is at least 14 days old (AGENTS.md); `diff` the old and new locks
  and confirm no existing entry changed; copy both back; list the added packages in the handoff,
  `templates/local-v2/assets/src/runtime/module-clients.ts.template` (a `pubsubPublisher` section,
  kept only when used), `src/v2/client-wiring.ts` (emit it for a `google-cloud` queue), the
  report's `stores[].provisioned` text.
- Docs: `docs/studio-settings.md` (the queue row), `jeeves/CATALOG.md` if it lists queue
  providers, `jeeves-generator/README.md` (Provisioning for stubs table, Module clients),
  `docs/studio.md`.

**Invariants.**
1. Topic ID = the Queue tile's ID. Each consuming tile gets subscription `<topic>--<tile>`, in
   either mode (copies of one tile share it and compete; different tiles each get every message),
   with dead-letter topic `<topic>--<tile>.failed` plus a pull subscription of that name for
   inspection; `ackDeadlineSeconds` 60; retry policy minimum backoff 1 s, maximum 10 s;
   `deadLetterPolicy.maxDeliveryAttempts` = 100 (a backstop: QG08 sends to `.failed` itself).
   Pub/Sub keeps a message only for subscriptions that exist when it is published, so
   `setup-pubsub` creates all of them before any application process starts. In cloud the
   deployment's IaC creates the same resources and grants the Pub/Sub service agent what a
   dead-letter policy needs; the README says so.
2. `publish(message, { messageId })` calls `topic.publishMessage({ data, attributes: { messageId } })`
   with the module's `messageId` (else `randomUUID()`), and resolves only after the service's
   acknowledgement. Fixed bounds: a total publish deadline of 2000 ms (the SDK's gax timeout; the
   probe shows the default waits longer than 20 s), and at most 1000 outstanding publishes per
   process (the next rejects at once, `Publisher queue full`). SDK default batching.
3. Environment: `JEEVES_PUBSUB_PROJECT` (required, validated as QG06 does);
   `PUBSUB_EMULATOR_HOST` only in the local Compose environment (`local-pubsub:8085`). Credentials
   are Application Default Credentials; the export never holds a key file.
4. Startup probe: `topic.exists()` inside the 5 s probe bound; false or an error fails startup as
   other probes do. The README names the IAM it needs: `pubsub.topics.get` and
   `pubsub.topics.publish` on the topic.
5. Processes never create or change topics or subscriptions. Only `setup-pubsub` does, locally,
   idempotently: create when missing; an existing one whose settings differ refuses with its name.
6. Local emulator: `gcr.io/google.com/cloudsdktool/google-cloud-cli:591.0.0-emulators@sha256:112c21f8f6e04b03b393b3c34fb943a1f443e839f18c6492c364ac2e6c3ff935`,
   command `gcloud beta emulators pubsub start --host-port=0.0.0.0:8085 --project=local`, healthy
   once it answers on 8085, no published port. Its state lasts only while it runs: `pnpm start`
   reruns `setup-pubsub`, and the generated README says the emulator keeps no messages across a
   restart (local only; never a durability claim).
7. A design whose only channels are `google-cloud` gets no `local-broker`.
8. A loop stub on a `google-cloud` queue: a required `unsupported` gap
   `provider-<module>-<tile>`, reason "Consuming Pub/Sub is not installed yet."

**Emitted output.** With processes on: `src/runtime/module-clients.ts`, the publishing process
files, `compose.yaml`, `infra/local.json`, `scripts/pubsub-init.mjs`, `package.json`,
`pnpm-lock.yaml`, `README.md`, `.jeeves/report.json`. Pinned: `package.json`, `pnpm-lock.yaml`,
`.jeeves/manifest.json`, and `infra/local.json`/`scripts/local.mjs` only if the setup step's
ordering lives there; any other: stop.

**Offline tests.** Resolver: `provider: google-cloud` on a stub-only queue is a supported normal
control; on a template's queue the unsupported gap; `buildSupportedAuthoringCommand` accepts the
edit, and the refusal text above no longer appears for it. Export: `local-pubsub`,
`setup-pubsub`, the publisher's environment, the `infra/local.json` plan (topic, subscription,
dead-letter topic). `pubsubPublisher` with a fake SDK: resolves after `publishMessage` resolves,
passes `attributes.messageId`, rejects at the 2000 ms deadline (fake timers), rejects at once at
1000 outstanding, `close()` waits for outstanding publishes then closes the client. A loop stub on
the queue: the gap of invariant 8.

**Mouse check** (Rule 6): in a design with a stub publishing to a Queue, open the Queue's
options, choose Provider → Google Cloud, Generate project → Preview: the queue's row says it is a
Pub/Sub topic; both sizes; delete the project. **Chat:** `pnpm eval:chat` (offline).
**Required regressions:** check, e2e, build, evals, mouse; Docker phase `--suite=wiring` and
`--suite=core` (RabbitMQ designs unchanged).
**Regeneration proof:** shared, plus the probe fixture with Events set to Google Cloud and the
Tally loop's consume link removed (publisher only): install without `--offline` once (new
dependency), build, `first-run`; `POST …/front-probe/publish?id=a` → 202 and a capture
subscription created by the agent's script sees attribute `messageId=a`; `docker pause` the
emulator → the stub's 503 within 2.5 s; unpause → 202 again.
**Commit:** `QG07: Pub/Sub channels and stub publishers`.

### QG08 — Stub loops consume Pub/Sub subscriptions

**Status:** local (QRWTY's Analytics worker; A10–A13, F03).
**Depends:** QG07.

**Goal:** a loop stub on a `google-cloud` queue consumes its tile's subscription with the
contract a RabbitMQ loop has: acknowledge only after the handler resolves; the retry limit and
`.failed` for real failures; an unreachable store waits 5 s and keeps the attempt; Concurrency
bounds the messages in hand; `pnpm stop` drains.

**Files.** A subscriber in `templates/local-v2/assets/src/runtime/` (in `module-clients.ts.template`
or a new `pubsub.ts.template`), `tile-loop.ts.template` (`startModuleLoop` takes the consumer
through an interface both transports implement), `delivery.ts.template` (reuse `unreachable`,
`NonRetryable` and the retry decision), `src/v2/loop-wiring.ts`, the resolver (remove QG07's
invariant-8 gap), tests in `src/v2/tile-loop.test.ts` (or a new `pubsub.test.ts`), docs
(`jeeves-generator/README.md` Consume loops; `docs/studio.md`).

**Invariants.**
1. One streaming-pull subscriber per loop on `<topic>--<tile>`, flow control `maxMessages` =
   the tile's Concurrency, `allowExcessMessages: false`.
2. `ModuleMessage`: `body` the data bytes; `messageId` the `messageId` attribute, else the
   server ID; `headers` the attributes; `attempt` the service's `deliveryAttempt` (the
   subscription has a dead-letter policy, so it counts from 1); `source` the subscription name.
3. Success: `ack()` after the handler resolves, never before.
4. Terminal (a `NotImplemented`, a `NonRetryable`, or a failure on delivery attempt retry
   limit + 1, so a Pub/Sub loop allows exactly as many retries as a RabbitMQ loop does):
   publish the message to `<topic>--<tile>.failed` with its attributes plus `x-terminal-code`
   (`NOT_IMPLEMENTED`, `RETRY_EXHAUSTED`, `MALFORMED_MESSAGE` as today), await the
   acknowledgement, then `ack()`. If that publish fails: `nack()` (redelivered; nothing lost).
5. A retryable failure below the limit: `nack()`; the subscription's retry policy spaces the
   redeliveries (this replaces the in-process 250 ms doubling wait for Pub/Sub loops).
6. An unreachable store (`unreachable(error)`, not a `NonRetryable`): keep the message (the SDK
   extends its lease), wait 5 s (cut short by close), run the handler again with the same message
   and attempt, and log `store unreachable, retry in 5000 ms (attempt not counted)`; `close()`
   during the wait → `nack()`.
7. Subscriber errors: one `broker consume <subscription>` failure line, `"state":"available"`
   when it streams again; a subscriber that closes on an error is reopened 5 s later, as BR01
   does; the process never exits for it.
8. Drain: after HTTP admission stops, the subscriber closes; handlers in flight settle first.

**Emitted output.** With processes on only: the subscriber runtime file, `tile-loop.ts`,
`delivery.ts` if touched, the consuming process files, `.jeeves/report.json`. No pinned path is
expected (no pinned export has Runnable processes on); if `processes-off.test.ts` fails, Rule 7.

**Offline tests** (fake subscription emitter, fake timers): ack after the handler; nack on a
retryable error; terminal → `.failed` publish then ack; `.failed` publish failure → nack;
unreachable → the handler runs again after 5 s with the same attempt and no nack; close during
the wait → nack; flow control equals Concurrency; the `ModuleMessage` mapping.
**Required regressions:** check, e2e, build; Docker phase `--suite=wiring`, `--suite=core`,
`--suite=faults`.
**Regeneration proof:** shared, plus the probe fixture with Events on Google Cloud and the Tally
loop: `first-run`; three publishes, one ID twice → `m_tally_count.seen` has the three IDs once
each; a body that makes the stub throw "Not implemented" → in the `.failed` subscription with
`x-terminal-code=NOT_IMPLEMENTED`; PostgreSQL stopped for 15 s → nothing in `.failed`, the
attempt unchanged in the log, all rows present after restore, no restart.
**Commit:** `QG08: stub loops consume Pub/Sub subscriptions`.

### QG09 — Generated-system tests for Pub/Sub channels

**Status:** local (Jeeves's own proof, on real services, of what QRWTY's durable clicks rely on).
**Depends:** QG08.

**Goal:** `pnpm test:generated --suite=pubsub` proves QG07–QG08 against the pinned emulator with
the harness's existing scoping, cleanup and evidence rules.

**Files.** `jeeves-generator/integration/scenarios/pubsub.system.test.ts` (new); emulator helpers
in `integration/harness/` (a capture subscription, pause and unpause by the run's labels);
`integration/run.ts` and `harness/suites.ts` (the suite name, and `all`); a fixture
`field-projects/generator-system/fixtures/pubsub/` (a public Service with a publisher stub, a
Worker with a consumer stub writing a database, its owned files and attachments); the fixture
README's tables; the CI workflow's suite list if it names suites; evidence in the plan folder.

**Rows.**
- **P1** A 202 means published: every ID answered 202 is in the capture subscription; a repeated
  ID is counted once by the consumer.
- **P2** Emulator paused: publishes answer 503 within 2.5 s and nothing else in the process
  fails; no exit; unpaused: 202 within 10 s; no restart (same container IDs, restart counts).
- **P3** A handler that throws "Not implemented": the message is in `<sub>.failed` with
  `x-terminal-code`; a retryable failure is redelivered with a growing `attempt` and ends
  `RETRY_EXHAUSTED` at the limit.
- **P4** The consumer killed after its commit and before its ack (a harness gate, as GS07's
  relay row): redelivered and counted once.
- **P5** PostgreSQL stopped during consumption: nothing in `.failed`, the attempt unchanged, all
  counted after restore, no restart (SO02's pattern).

**Checks:** the new suite; `--suite=core`, `--suite=wiring`; then check, e2e, build, in that
order of phases. Show one row failing against HEAD's templates of QG08 (or say why it can't run),
as SO02 did. **Commit:** `QG09: generated-system tests for Pub/Sub channels`.

**Folded into QG09 (owner, 2026-11-14).** These are template changes, made in this unit before the
suite, and the suite proves them:
- **(F1) Install scripts.** Every export gains `pnpm-workspace.yaml` with `allowBuilds: { protobufjs: false }`
  (QG07 verified that it works with the lock unchanged), so plain `pnpm install` and `pnpm add` succeed
  without `--ignore-scripts`. It is a new emitted path in every export, and pins follow Rule 7. Update
  the generated README's install note and the generator README's `--ignore-scripts` advice.
- **(F2) No metadata lookup locally.** The local `compose.yaml` gives every service that publishes to or
  consumes a Pub/Sub topic `METADATA_SERVER_DETECTION: none` (QG07 and QG08 measured 3.1–3.3 s of the
  5 s probe spent on the lookup). Pass no `universeDomain`: QG07 found that it switches the SDK out of
  emulator mode.
- **(F3) Reconnect bound** (QRWTY lessons QL01, folded here). Every `new PubSub(` in the templates
  receives `"grpc.initial_reconnect_backoff_ms": 500` and `"grpc.max_reconnect_backoff_ms": 2000`.
  QG08 also found, in the SDK's source, that an `UNAVAILABLE` stream otherwise retries with up to 60 s
  backoff.

**Emitted output for F1–F3:** `pnpm-workspace.yaml` (new), `compose.yaml` (Pub/Sub designs only),
`src/runtime/module-clients.ts` and `src/runtime/tile-loop.ts` (wherever `new PubSub(` is), the
generated `README.md`, `.jeeves/manifest.json` and `.jeeves/report.json`.

**Extra rows:**
- **P6:** pause the emulator for 60 s, then unpause. The first 202 comes within 3.0 s, and the consumer
  counts the backlog within 10 s. Record both times.
- **P7:** a fresh `first-run`'s first publish answers 202 in under 2.0 s, and the subscriber probe
  passes in under 2.0 s.
- **P8:** in a fresh export, plain `pnpm install --frozen-lockfile` (without `--ignore-scripts`) exits 0.

Offline tests cover F1–F3's emitted lines (fail before, pass after). The harness keeps
`--ignore-scripts` for the other suites.

### QG10 — Verified TLS bindings and an insecure-endpoint refusal

**Status:** local, because QRWTY's R01 starts every process locally in the production profile and
requires a refusal for disabled TLS verification and for an emulator endpoint; its effect is in
cloud (Memorystore in-transit encryption, Cloud SQL over a private address, `https` for tiles and
the issuer).
**Depends:** QG04, QG06, QG07.

**Goal:** a database or cache binding can require verified TLS with a given CA, and one switch
makes a process refuse any plain-text or emulator endpoint at startup.

**Found (Q03).** `createPostgres` passes no `ssl`, so `pg` silently follows `PGSSLMODE` from the
environment; the cache and broker clients have no TLS; the verifier accepts an `http` JWKS URL.

**Variables.** `JEEVES_DATABASE_<ID>_TLS` and `JEEVES_CACHE_<ID>_TLS`: `disable` or `verify-full`
(required, no default); `…_CA_FILE`: a PEM file path, optional with `verify-full` (else Node's
roots); `…_TLS_SERVERNAME`: optional, the name the certificate must carry when it differs from
the host (a managed instance reached by a private address). `JEEVES_REQUIRE_TLS`: `true` or
absent. With `true`, startup refuses with `Insecure
endpoint <variable name>`: a database or cache binding that isn't `verify-full` (a database Unix
socket host counts as local transport and is accepted), a `JEEVES_TILE_*_URL`, `OIDC_ISSUER` or
`OIDC_JWKS_URL` that isn't `https:`, and any `PUBSUB_EMULATOR_HOST`.

**Files.** `templates/local-v2/assets/src/runtime/postgres.ts.template` (an `ssl` option: `false`
for `disable`, so the environment can't change it; `{ rejectUnauthorized: true, ca? }` for
`verify-full`), `module-clients.ts.template`, `valkey.ts.template` (`socket.tls`, `ca`),
`src/features/service-resources.ts.template`, `src/v2/http-wiring.ts` (the guard's URLs),
`src/v2/local.ts` (Compose: `disable` everywhere locally), tests beside QG06's, docs as QG06's.

**Invariants.** Local stacks unchanged (`disable`, no `JEEVES_REQUIRE_TLS`); `verify-full` checks
the certificate chain and the host name; a CA file that can't be read fails startup naming the
variable; no option disables verification.

**Emitted output.** `src/runtime/postgres.ts`, `src/runtime/valkey.ts`, `module-clients.ts`,
`service-resources.ts`, process files, `compose.yaml`, `README.md`, `.jeeves/report.json`; pinned:
`src/runtime/postgres.ts`, `src/runtime/valkey.ts`, `src/features/service-resources.ts`,
`compose.yaml`, `README.md`, `.jeeves/report.json`, `.jeeves/manifest.json`.

**Offline tests.** The options reaching fake `pg` and `redis` for each value; each refusal case of
`JEEVES_REQUIRE_TLS=true`; an unreadable CA file.
**Required regressions:** check, e2e, build; Docker phase `--suite=all`.
**Docker proof:** a scratch PostgreSQL 17.11 that accepts only `hostssl`, with a CA and server
certificate the test generates at run time (never written to the repository): `verify-full` with
that CA connects; another CA is refused; `disable` is refused by the server; then remove it.
**Commit:** `QG10: verified TLS bindings and an insecure-endpoint refusal`.

### QG11 — The sign-in audience comes from the environment

**Status:** cloud. The managed issuer's tokens carry an audience other than the local
`<identity>-web`; the local Keycloak works today.
**Depends:** QG06 (convention only).

**Goal:** a guarded tile accepts tokens for the audience its deployment names.

**Found (Q03).** `http-wiring.ts` emits `audience: \`${binding.identity}-web\``; a token for
another audience is refused even with `OIDC_ISSUER` set to its issuer.

**Files.** `jeeves-generator/src/v2/http-wiring.ts` (the guard's `createPrincipalVerifier` call),
`src/v2/local.ts` (Compose: `OIDC_AUDIENCE: <identity id>-web` beside `OIDC_ISSUER`), tests in
`http-wiring.test.ts` and `tile-guard.test.ts`, docs (`jeeves-generator/README.md` sign-in bullet,
`jeeves/CATALOG.md` Sign-in, `docs/studio.md`).

**Invariants.** `audience: process.env.OIDC_AUDIENCE`; a missing or empty value fails startup
naming `OIDC_AUDIENCE`; local tokens and answers unchanged; issuer, JWKS, algorithms, `exp` and
`sub` checks unchanged.

**Emitted output.** Guarded process files, `compose.yaml`; pinned: `compose.yaml`,
`.jeeves/manifest.json`, and the file that builds a tile-level guard's verifier in a pinned export
if one does (find it with `grep -rl -- '-web' ` in the pinned export first); any other: stop.
**Offline tests.** The emitted line; a token for audience `api://example` accepted with
`OIDC_AUDIENCE=api://example` and refused without; missing → `startup-failed` naming the variable.
**Required regressions:** check, e2e, build; Docker phase `--suite=identity`, `--suite=media`,
`--suite=faults`.
**Commit:** `QG11: the sign-in audience comes from the environment`.

### QG12 — Migrations run with a non-superuser admin, one at a time

**Status:** cloud. A managed PostgreSQL admin has CREATEDB and CREATEROLE but is not a
superuser.
**Depends:** none.

**Goal:** `scripts/migrate.mjs` completes with such an admin and with two copies started at once.

**Found (Q03).** With `postgres` as a CREATEDB CREATEROLE non-superuser on PostgreSQL 17.11:
`must be able to SET ROLE "o_store"` (42501) at `CREATE DATABASE … OWNER`, after the roles had
been created; after `GRANT o_store, o_tally_db, io_identity TO postgres WITH INHERIT FALSE, SET
TRUE` the run and a repeat pass. Two concurrent first runs as superuser: one fails `duplicate key
value violates unique constraint "pg_authid_rolname_index"`, the other passes.

**Files.** `jeeves-generator/templates/local-v2/assets/scripts/migrate.mjs`; a test of the emitted
script's text (where `migrate.mjs` is already read, for example `product-sql.test.ts`); docs
(`jeeves-generator/README.md`'s migration sentences).

**Steps.**
1. On the admin connection, before creating any role: `SELECT pg_advisory_lock(hashtext($1))`
   with `local-v2:cluster`, held until the last database is done (released by `pg_advisory_unlock`
   or the session's end).
2. Read `rolsuper` of `current_user` once. When false, after creating each database owner role
   (and for an owner role that already exists), run `GRANT <owner> TO CURRENT_USER WITH INHERIT
   FALSE, SET TRUE` (PostgreSQL 16+ syntax; the pinned server is 17.11), quoted with `quote`.
3. Run `REVOKE ALL ON DATABASE … FROM PUBLIC` and each `GRANT CONNECT ON DATABASE … TO <login>`
   as the owner: on the admin connection `SET ROLE <owner>` before them and `RESET ROLE` after
   (quoted with `quote`), so a non-superuser admin's statements are not warnings.
4. Nothing else changes: roles, databases, grants, files, history, messages.

**Invariants.** A superuser admin behaves exactly as today; a non-superuser CREATEDB CREATEROLE
admin completes; two concurrent first runs both exit 0; a repeat applies nothing new; `INHERIT
FALSE` keeps the owners' privileges away from the admin's own session; after a non-superuser
run, `has_database_privilege(current_user, <db>, 'CONNECT')` is false and `pg_database.datacl`
has no PUBLIC (`=`) entry.

**Emitted output.** `scripts/migrate.mjs` (all three pins) and `.jeeves/manifest.json`.
**Offline test:** the emitted script holds the lock and the conditional grant, and runs the
database-level `REVOKE` and `GRANT CONNECT` between `SET ROLE <owner>` and `RESET ROLE` (fails
before).
**Required regressions:** check, e2e, build; Docker phase `--suite=core` and
`--suite=regeneration` (setup and update in place).
**Docker proof:** QRWTY's Q03 steps (`docs/evidence/q03/commands/README.md` step 14) against the
new script: the non-superuser run passes without a manual grant, and after it every database's
`datacl` has no PUBLIC (`=`) entry and `has_database_privilege(<admin>, <db>, 'CONNECT')` is
false (exit codes alone don't show this); two concurrent first runs both pass; a third applies
nothing.
**Commit:** `QG12: migrations run with a non-superuser admin, one at a time`.

---

## Deferred units (outlines; plan in detail only when needed)

### QG13 — Database stubs get a scoped transaction

**Why deferred:** a PL/pgSQL function in product SQL, called with one `execute`, is atomic
(Q03's `/fn`: two inserts and a raise left 0 rows). QRWTY writes each invariant that way. **If
needed:** `DatabaseReadWriter.transaction(fn)` on one reserved pool client (BEGIN, `fn(tx)`,
COMMIT; ROLLBACK on throw; release, destroying the client on a connection error), reusing
`runtime/transaction.ts`; nested calls refused; the statement timeout applies. The smallest
failing test today: after `execute("BEGIN")` the pool hands an `idle in transaction` connection
to the next caller (Q03 `/tx`).

### QG14 — A scheduled trigger for Worker stubs

**Why deferred:** QRWTY runs cleanup and reconciliation as authenticated scheduled owner calls
(a scheduler service in its `compose.override.yaml` locally, Cloud Scheduler in cloud) with
database leases. **If needed:** a Worker stub setting or module kind "every N seconds" built on
`periodic` in `process.ts`, with a generic lease helper so copies don't run a job twice; spec,
studio, chat and generator, probably two units. Needs the owner's decision on the kind.

### QG15 — Per-route exposure on a public tile

**Why deferred:** QRWTY moves Billing API's Entitlements to an internal tile (or authorizes the
caller in its handler) and owns its trusted edge and route map. **If needed:** a module-level
`exposure` (public/internal) that the edge honours, with the edge returning 404 for internal
module paths. Needs the owner's decision on a module setting.

### QG16 — Startup with a lost broker or publisher, and a bounded drain

**Why deferred:** BR01's plan left a process started while the broker is down to a later owner
decision; QG04 removes the drain hang Q03 observed; Cloud Run's SIGKILL after its grace period
bounds a drain in production. **If needed:** a publisher or consumer that can't connect at start
logs `unavailable` and keeps retrying every 5 s instead of failing startup (requests that publish
answer 503 meanwhile), and `runProcess` ends a drain after a fixed bound with a `drain-failed`
line. Needs the owner's decision.

---

## Units from the Q03 review: QG17–QG20

Copied verbatim from the [Q03 review](../../evidence/q03/review.md), section 6. In them, "the
review" and "this review" mean that report; its section 2 holds the stalled-PostgreSQL probe.
They follow this plan's Rules and Regeneration proof. QG17 and QG19 are ready. **QG18 and QG20
need the Jeeves owner first** (decisions 6 and 7).

### QG17 — Database calls settle while PostgreSQL stalls (ready; local, before Q04)

**Goal:** a stub's or template's query on a connection whose server has stopped answering
rejects within a fixed bound, the pool discards that connection, and a drain no longer waits on
it. **Found (review).** With `docker pause` on PostgreSQL and one warm pooled connection,
`SELECT 1` on the generated options is still pending after 12 s and `pool.end()` after 5 s;
`statement_timeout` is enforced by the server, which is frozen. With pg's `query_timeout: 2500`
the query rejects `Query read timeout` at 2.5 s, pg-pool removes the client (`_release` with an
error → `_remove`), and `pool.end()` resolves at once.
**Files.** `templates/local-v2/assets/src/runtime/postgres.ts.template` (one option);
`src/v2/module-clients.test.ts` or the test that asserts `createPostgres`'s options (if none
reads the emitted file, add one as SO01's `composition.test.ts` test does); `jeeves-generator/README.md`
(the sentence on a stub's database client's deadlines); `docs/studio.md` if it names the
statement timeout; `docs/template-gaps.md` Known limits: SO03's "a stalled (not stopped)
database" item becomes a row "Fixed in QG17" (add the row if the review's item was never copied).
**Invariants.** 1. `createPostgres` passes `query_timeout: options.statementTimeoutMs + 500` to
`pg.Pool`, so a healthy server's `statement_timeout` (SQLSTATE `57014`) still wins and the client
bound fires only when no reply comes. 2. Nothing else about the pool changes (`max`,
`connectionTimeoutMillis`, `statement_timeout`, the `error` listener callers add). 3. Both
callers (`databaseClient` in `module-clients.ts.template`, `pool()` in
`service-resources.ts.template`) get it through `createPostgres`; neither is edited.
4. `migrate.mjs` and the setup scripts are unchanged (long migrations are legitimate).
**Emitted output.** `src/runtime/postgres.ts` (pinned: frozen-v2, v2-module-design) and
`.jeeves/manifest.json`; any other: stop.
**Offline tests.** The emitted `postgres.ts` passes `query_timeout` equal to the statement timeout
plus 500 (fails before); with a fake `pg.Pool` constructor the option value is 2500 for
`statementTimeoutMs: 2000`.
**Required regressions:** check, e2e, build; Docker phase `--suite=core`, `--suite=faults`
(SO02's database row must still pass: a **stopped** server reports `57P01`/`ECONNRESET`, which is
unchanged). **Docker proof:** the probe export built; a scratch PostgreSQL 17.11 (pinned digest);
`node` script on the built `dist/runtime/postgres.js` as this review's: warm one connection,
`docker pause`, a query rejects `Query read timeout` within 3 s, `pool.totalCount` is 0,
`pool.end()` resolves within 1 s; `docker unpause`; remove the container by name. **Limit to
record:** pg destroys the stalled socket only in pipeline mode; otherwise the discarded client's
socket closes when the network recovers (FIN) or TCP gives up, so sockets can accumulate during a
long stall and return to baseline after it.
**Commit:** `QG17: database calls settle while PostgreSQL stalls`.

### QG18 — A client-side query timeout counts as unreachable (needs the owner)

**Why the owner:** it adds to the store-outage Decision's list, as SO05 said of SO06. **Goal:**
`unreachable()` in `delivery.ts.template` answers true for an error whose message is exactly
`Query read timeout` (pg's client-side timeout, QG17), so a worker whose database stalls waits 5 s
and keeps the attempt instead of spending its retries. **The catch for the owner:** a stall that
never ends then cycles for ever, as any outage does under the Decision; a query that is merely
slow (over 2.5 s but under the server's `statement_timeout`) is not affected because the server's
`57014` comes first. **Files:** `delivery.ts.template`; `src/v2/primitives.test.ts` (true for
`new Error("Query read timeout")`, false for `new Error("Query read timeout exceeded")` and for a
`NonRetryable` wrapping it); pins `.jeeves/manifest.json`, `src/runtime/delivery.ts`;
`docs/plans/store-outage/units.md` Decision (one bullet, in the owner's words);
`jeeves-generator/README.md`'s list of what counts as unreachable. **Checks:** check, e2e, build;
`--suite=faults`. **Commit:** `QG18: a client-side query timeout counts as unreachable`.

### QG19 — The admission's 503 answers carry `Retry-After` (ready; local)

**Goal:** the three 503s the generated runtime answers on its own (`UNAVAILABLE` while not
accepting, `OVERLOADED` at the concurrency limit, `DEADLINE` at the request timeout) carry
`Retry-After: 1`, so a client's bounded retry needs no product code; a stub's own 503 keeps its
own value. **Found (Q03 F23, review R6).** `createAdmission` throws `HttpError`s and
`createHttpService`'s error handler sends `{ error, message }` with no header; durable-clicks
requires a bounded `Retry-After` on every failure path including "exhausted capacity", which a
stub cannot shape. **Files.** `templates/local-v2/assets/src/runtime/http.ts.template`
(`setErrorHandler`: when `error instanceof HttpError && error.statusCode === 503`, set
`Retry-After` to `"1"` unless the reply already has one); tests in `src/v2/tile-processes.test.ts`
(the block that loads the emitted `http.ts`): a handler that never resolves → 503 `DEADLINE` with
`retry-after: 1`; a route called while not accepting → 503 `UNAVAILABLE` with it; a 503 thrown by
a handler as `HttpError(503, …)` also gets it; a 404 and a 400 do not. Docs:
`jeeves-generator/README.md` where the three codes are listed. **Invariants.** Status codes,
bodies and the `Cache-Control: no-store` hook are unchanged; the value is fixed (one second).
**Emitted output.** `src/runtime/http.ts` (pinned) and `.jeeves/manifest.json`.
**Required regressions:** check, e2e, build; `--suite=wiring`. **Commit:** `QG19: the admission's
503 answers carry Retry-After`.

### QG20 — External API and Identity tiles give stubs a configured HTTP client (needs the owner)

**Why the owner:** today an External API or Identity link gives a stub an `unavailable` proxy by
design ("isn't provisioned locally", "an Identity isn't provisioned for stubs"); this makes both
real clients, with the base URL from the environment. Confirm, or keep product `fetch` adapters
(Q03's remedy; nothing then changes). **Goal:** for a stub's link to an External API tile,
`dependencies[...].<slot>` is `httpTarget`-like with base `JEEVES_EXTERNAL_<ID>_URL` (required,
validated as QG06 validates a URL; QG10's `https:` refusal applies), **without** the internal-call
mark (an outside call keeps the normal retries, SO04); for a link to the Identity tile, base
`OIDC_ISSUER` (already in the guarded tile's environment; QG06 adds it to a stub tile that links
the Identity) **with** the mark (a provisioned service is waited out). **Depends:** QG06.
**Files.** `module-clients.ts.template` (an `externalTarget(base)` beside `httpTarget`, no mark;
`httpTarget` unchanged), `src/v2/client-wiring.ts` (the `identity` and `external-api` branches:
emit the targets instead of `unavailable`; the Identity branch keeps `unavailable` only when the
design has no Identity binding), `src/v2/local.ts` (Compose `environment`: nothing for an External
API locally — the value is the application's, through `compose.override.yaml`, so startup fails
`Invalid endpoint JEEVES_EXTERNAL_<ID>_URL` until it is set; `OIDC_ISSUER` for a stub tile linking
the Identity), `tile-processes.ts` (report: `stores[].provisioned` text for both),
tests `client-wiring.test.ts`, `module-clients.test.ts`, docs (`jeeves-generator/README.md`
Provisioning for stubs table; `docs/studio.md`; `docs/template-gaps.md`: GS09's "no installed
external-API client" row, if present, becomes Fixed). **Invariants.** A stub with no such link is
unchanged; the `unavailable` proxy stays for CDN tiles and for an application tile that runs no
process; `request(path, init)` passes `init` through so a stub can bound a call with
`AbortSignal.timeout`; no credential is read by the client (the stub adds its own header from a
`SECRET_DIR` file). **Emitted output.** `src/runtime/module-clients.ts`, the linking process files,
`compose.yaml`, `README.md`, `.jeeves/report.json`; pinned paths: none expected (processes off);
if `processes-off.test.ts` fails, Rule 7. **Offline tests.** The probe fixture's `front.ts` has
`externalTarget(...)` for `provider` and the marked target for `identity` instead of
`unavailable`; `externalTarget` does not set the mark on a rejected `fetch`; startup with the
variable unset fails naming it. **Required regressions:** check, e2e, build; `--suite=wiring`.
**Regeneration proof:** shared; in `after-probe`, `…/front-probe/provider` with
`JEEVES_EXTERNAL_PROVIDER_URL` pointing at a loopback server answers that server's status instead
of 501. **Commit:** `QG20: External API and Identity tiles give stubs a configured HTTP client`.

---

## Q03b notes

The readings Q03b needed where the review's section 6 left a choice. Nothing else the review
says was turned into an amendment.

- **Commit name.** The assignment packet's name is used; section 6 suggested `Q03b: amend the QG
  briefs from the review`.
- **QG07 is not split.** The review calls the split optional ("consider QG07a/QG07b", R9;
  "optional split", section 5), and its Q03b steps neither split QG07 nor write the two briefs,
  so QG07's brief is unchanged. If the coordinator splits it when copying, the review's line is
  QG07a for the control and export plumbing and QG07b for the publisher runtime (section 3.4).
- **Where R9 lands.** QG07's brief never names the owner decision, so R9 changes only decision 4
  (now a note; its number is kept so decisions 1–3 and 5 keep theirs) and the Order table.
- **R3's emitted output.** Section 6 adds `valkey.ts.template` to QG06's Files only. Editing it
  changes the emitted `src/runtime/valkey.ts`, which is pinned in frozen-v2 and
  v2-module-design (Jeeves `jeeves-generator/src/v2/fixtures/processes-off.json` at `59bfbc6`),
  so QG06's Emitted output lists that file too; without it the shared regeneration proof would
  stop QG06 on its own change. The review adds no offline test for the relaxed rule; a cache
  host `10.1.2.3` being accepted is the obvious one.
- **R8's "Not in this plan".** QG10 has no section of that name, so the RabbitMQ TLS row is in
  this plan's shared table, which every QG agent reads (Rule 1).
- **R1 with a superuser admin.** Step 3 applies to every admin, as section 6 writes it.
  PostgreSQL performs a superuser's GRANT or REVOKE as though the object's owner had issued it,
  so a superuser run leaves today's ACL and "a superuser admin behaves exactly as today" holds.
- **Decisions 6 and 7.** The headings of QG18 and QG20 say they need the owner. The Decisions
  section lists them too, in their briefs' words, because Rule 1 sends every agent there.
- **Order table.** QG18 depends on QG17: the review names no dependency, but the error QG18
  classifies exists only once QG17 sets `query_timeout`. The review names no waiting QRWTY unit
  for QG18 or QG19, so the column says that instead of guessing one. For QG20, section 5 says
  "before Q07/Q09" and section 6 "before Q07"; the table follows section 5 (Q07 uses the Identity
  link, Q09 the reputation adapter's External API). QG09 now waits on Q05, not Q04 (sections 3.4
  and 5).
- **Not done here.** R7 (F22 is a Jeeves limit, class J) and R11 (cite GS09's external-API gap,
  SO03's open item 3 and PF review follow-up 10; the oracle adapter must not recover a copy with
  `pnpm start`) are for when the coordinator copies briefs into Jeeves. Section 6 gives Q03b no
  step for them, and F22's class in `capabilities.md` stays Q03's record.
