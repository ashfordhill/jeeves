# QG16 decision: a generated process waits for a missing store at startup

2026-11-14, by the JP00 planner at the owner's request (clarification 8 of
[owner-summary.md](owner-summary.md)). Read from Jeeves `0a2ee22` plus the committed plan
`423acbd`; arm B's `platform/lifecycle.ts` (`waitForDependency`) and `processes/runtime.ts` are the
evidence. Nothing is implemented; the coordinator applies the change to the committed plan.

## (a) Decision

**A generated process whose store, broker or topic is unreachable at startup waits and retries
every 5 seconds, alive but not ready, until the dependency answers or SIGTERM arrives; only a
configuration error (an invalid endpoint, setting or secret) still fails startup at once.**

## (b) The behaviour, exactly

**What waits.** Every startup check a process runs against a dependency: each stub client's probe
(`SELECT 1`, the broker confirm channel, Pub/Sub `topic.exists()`, `HeadBucket` or the multipart
open-and-abort, OpenSearch cluster health) and each mounted template's `initialize` check (the
cache read's `SELECT 1` on its source, the multipart and lifecycle sweeps at start, the search
index assertion). The cache is unchanged: QG04's decision 3 stands (one `warn` line, startup goes
on, the client reconnects by itself). A check is retried as a whole; a sweep is re-runnable, so
retrying it is safe.

**What does not wait.** Errors thrown before any probe, which no retry can fix: `Invalid endpoint
<NAME>` (QG06, QG24), `Invalid setting <NAME>` (QL05), a missing or unreadable secret file, and an
`OIDC_AUDIENCE` that is missing (QG11). These keep today's `startup-failed` line,
`Application startup failed` and exit code 1.

**Backoff.** Fixed: the next attempt starts 5,000 ms after the previous one failed. No exponential
growth, no jitter, no maximum wait and no attempt count. Each attempt keeps the existing 5 s probe
bound, so one dependency is probed at most once every 5–10 s. This is the runtime's existing
reconnect rule (BR01 for the broker, PF07 and QG04 for the cache, SO01 for an unreachable store in
a loop), so a process behaves the same whether a store went away before or after it started.
Jitter is not needed: copies start at different moments and a probe is one statement.

**Readiness and liveness while waiting.**
- An HTTP process **listens before its checks**, so a port probe (what Cloud Run and a TCP
  liveness check look at) sees it alive at once. `GET /healthz` answers 503
  `{"service":"<id>","application":"starting"}` (the state the service already has) until every
  check has passed and the loops have subscribed; then 200 `"ready"` as today. Every module route
  answers the admission's 503 `UNAVAILABLE` with `Retry-After: 1` (QG19) while the admission is
  not open; the sign-in routes and templates' routes too. A new `GET /livez` answers 200
  `{"service":"<id>","process":"alive"}` from the first listen until the process exits, so a
  deployment that wants a liveness path distinct from readiness has one that never flaps while a
  store is down.
- The ready marker (`/tmp/application-ready`, the Compose healthcheck) is written only when every
  check passed and the loops subscribed, as today, for HTTP processes and workers alike.
- A worker has no listener; its readiness stays the marker and its liveness the process. Its loops
  do not subscribe until every check has passed, so a process that cannot reach its store takes no
  message.

**What is logged.** Each failed attempt writes the existing probe line with
`"result":"waiting"`, `"retryIn":5000` and `"error"` (the error's name and message, at most 300
characters), on stdout at level `warn`; a template's `initialize` writes the same shape with
`"client":"<module>"` and `"check":"initialize"`. When the check passes, the existing
`"result":"ok"` line follows, then the template `started` lines and `Application ready` as today.
No `startup-failed` line is written for a wait. Lines are not rate-limited beyond the 5 s cadence.

**Drain and SIGTERM while waiting.** The wait ends at once: pending timers are cleared, a probe in
flight is abandoned within its own bound, nothing has subscribed or opened so there is nothing to
drain beyond closing the listener and the clients built so far, one line
`{"level":"info","event":"startup-stopped","tile":"<id>"}` is written, and the process exits 0
(not 1: nothing failed). A second signal exits at once, as today.

**HTTP processes versus workers and loops.** They differ only in liveness: an HTTP process listens
first and answers 503s; a worker has no port and simply holds its idle timer while it waits. Both
wait for every check, both write the marker only when ready, both end the wait on SIGTERM.

## (c) Why

Jeeves promises code that is correct with several copies running and stores that fail and come
back, and leaves restart policy to deployment. A process that exits when a store is down turns a
store outage into a restart storm (crash-loop backoff reaches minutes on Kubernetes; on Cloud Run a
new revision whose instances exit fails to deploy at all), and it makes two copies of one tile
behave differently during the same outage: the copy that was already connected reconnects every
5 s (BR01, SO01) while the copy that started a second later dies. Waiting removes that split: every
copy is alive, not ready, probing every 5 s, and the orchestrator routes nothing to it until
`/healthz` is 200, which is what readiness is for. QG04's decision 3 already made the cache
optional at start because the reader falls back to the database; a database, broker or topic is not
optional, so the process must not become ready without it, but neither should it die for it. Arm B
chose the same (`waitForDependency`, no crash loop; only invalid configuration exits), and its
F02–F04 rows passed with it.

## (d) Where it lands

A new unit, **QL14**, in [units.md](units.md); the review QL13 becomes the last unit and reads
"all above" including QL14. Place QL14 in the Order table after QL06 and before QL07 (it edits the
same template files as QL02–QL05 and must not run beside them; it has no dependency on the spec
units). In `docs/plans/qrwty-gaps/units.md`, QG16's outline gets one line: "Decided 2026-11-14:
startup waits (QL14 in `docs/plans/qrwty-lessons/units.md`); the overall drain bound stays
deployment's stop grace (QG04 removed the observed hang)."

### QL14 — Startup waits for a missing store; configuration still fails fast

**Status:** ready (the owner's decision above; replaces QG16's startup half). **Depends:** none;
run after QL06 and before QL07.

**Goal:** a process whose database, broker, topic, bucket or search service does not answer at
startup stays alive and not ready, retries every 5 s, and becomes ready by itself when the
dependency is back; an invalid endpoint, setting or secret still fails startup at once; an HTTP
process listens from the start so liveness never depends on a store.

**Found (arm A, VE; arm B).** Q03's `g04-startup-coupling.txt`: a Front restarted while its cache
was down failed startup (`Probe deadline (5 s)`), exited 1 and stayed down (the edge answered
503); a Tally restarted with the broker down exited the same way. QG04 fixed the cache. Arm B's
`platform/lifecycle.ts` waits for every dependency with capped backoff and exits only for invalid
configuration; its HTTP processes listen first and report readiness separately.

**Files.**
- `jeeves-generator/templates/local-v2/assets/src/runtime/process.ts.template`: a new
  `export async function waitUntilReady<T>(scope, name, check: () => Promise<T>, log): Promise<T>`
  beside `periodic`: runs `check`; on rejection logs the waiting line and retries after 5,000 ms;
  stops at once (rejecting `Error("Process stopped during startup")`) when the scope is stopping;
  `runProcess` writes the `startup-stopped` line and sets exit code 0 when startup rejects with
  that error after a signal, instead of `startup-failed`.
- `jeeves-generator/templates/local-v2/assets/src/runtime/module-clients.ts.template`: every
  probe except the cache's goes through `waitUntilReady` (the probe log gains `result: "waiting"`,
  `retryIn`, `error`); configuration errors (`Invalid endpoint`, the secret read) are thrown before
  `waitUntilReady` is entered, so they keep failing startup. The header comment and the process
  files' comment "a failed probe fails startup" (noted by QG04 and QG06) become "a store that
  doesn't answer is retried every 5 s; startup fails only for an invalid endpoint, setting or
  secret".
- `jeeves-generator/templates/local-v2/assets/src/runtime/http.ts.template` (`createHttpService`):
  `start()` listens first, then awaits `initialize()`, then sets `state = "ready"` and opens the
  admission; `GET /livez` is added beside `/healthz` (reserved like it); `initialize()` is given
  to `waitUntilReady` by the process file (below), so `http.ts` itself stays free of the retry.
- `jeeves-generator/src/v2/http-wiring.ts` and `tile-processes.ts` (`entryFile`): the process's
  `initialize` wraps each mount's `initialize` lines in `waitUntilReady(scope, "<module> initialize",
  …)`; the HTTP service's `start` is called before the client probes so the port is open while they
  wait; loops are started only after every probe and initialize has passed (the existing order:
  clients, then loops, then `ready()`).
- `jeeves-generator/src/v2/loop-wiring.ts`: no change expected; if a loop's mount probes its own
  store at start, that probe goes through `waitUntilReady` too (list it in the handoff).
- `jeeves-generator/templates/local-v2/assets/src/features/service-resources.ts.template`: no
  change (templates' pools are probed through their mounts' `initialize`).
- Tests: `jeeves-generator/src/v2/tile-processes.test.ts` (the block that loads the emitted
  `http.ts`: listen before initialize, `/livez`, `/healthz` 503 `starting`, routes 503 `UNAVAILABLE`
  with `Retry-After: 1` while waiting), `module-clients.test.ts` (fake `pg`, fake timers: a probe
  that fails twice then passes; the waiting lines; `Invalid endpoint` still throws at once; a stop
  during the wait rejects at once), `tile-loop.test.ts` or `loop-wiring.test.ts` (no subscribe
  before readiness), `processes-off.test.ts` by Rule 7.
- Docs: `jeeves-generator/README.md` (Runnable processes: the startup and `/healthz` sentences;
  Module clients: the probe sentence; the failure-lines list gains the waiting probe line),
  `docs/studio.md` where it says a failed probe fails startup, `docs/template-gaps.md` Known
  limits (a new row "Fixed in QL14" replacing the implied limit "a dependency down at start fails
  startup"; QG04's row text unchanged), `docs/plans/tile-processes/contract.md` §6 is a plan and is
  left as is (note it in the handoff).

**Invariants.**
1. With every dependency up, startup is unchanged: the same probe lines, `started` lines, marker
   and `Application ready`; `/healthz` 200 once ready; the only new output is the `/livez` route.
2. With a database, broker, topic, bucket or search service unreachable at start: the process
   stays running with restart count 0; the waiting line repeats every 5–10 s naming the client and
   the error; `/healthz` is 503 `starting` and `/livez` 200; a module route is 503 `UNAVAILABLE`
   with `Retry-After: 1`; no loop is subscribed; the marker is absent. When the dependency answers,
   the `ok` line, the loops, the marker and `/healthz` 200 follow within one retry interval plus
   the probe's own time, with no restart.
3. `Invalid endpoint <NAME>`, `Invalid setting <NAME>` and a missing secret file still write
   `startup-failed` and exit 1 before any probe.
4. The cache's startup behaviour is exactly QG04's.
5. SIGTERM during a wait: exit 0 within 1 s, the `startup-stopped` line, no `startup-failed`
   line, no `drain-failed` line.
6. `pnpm first-run` and `pnpm start` are unchanged (providers are healthy before application
   services start; the healthcheck is still the marker).

**Emitted output.** With processes on: `src/runtime/process.ts`, `src/runtime/http.ts`,
`src/runtime/module-clients.ts`, every `src/processes/*.ts`, `README.md`, `.jeeves/report.json`,
`.jeeves/manifest.json`. Pinned (Rule 7): `src/runtime/http.ts` (frozen-v2, v2-module-design) and
`.jeeves/manifest.json`; any other: stop.

**Offline tests** (fail before, pass after): the emitted service answers `/livez` 200 and
`/healthz` 503 `starting` after `start()` is called but before `initialize` resolves, and a route
503 `UNAVAILABLE` with `retry-after: 1`; `waitUntilReady` with fake timers retries at 5,000 ms and
resolves on the third attempt with two waiting lines; it rejects at once when the scope stops; the
emitted `module-clients.ts` with a fake `pg` whose first `SELECT 1` rejects `ECONNREFUSED`:
`databaseClient` resolves after the fake recovers, with one waiting line; `Invalid endpoint
JEEVES_DATABASE_TALLY_DB_HOST` is thrown before any `SELECT 1`; a process file calls
`service.start(...)` before the first `await databaseClient(` (text order) and `startModuleLoop`
after the last probe.

**Required regressions:** check, e2e, build; Docker phase `pnpm test:generated --suite=core`,
`--suite=wiring`, `--suite=faults`. Nothing user-visible in the studio: no mouse check.
**Docker proof** (`after-probe` with the probe bodies, its own Compose project): `first-run`;
`docker stop` of `local-postgres`; `docker restart` of `app-front` and `app-tally`: both containers
stay `running` with restart count 0 for 60 s; `GET /api/front/healthz` → 503 `starting`,
`GET /api/front/livez` → 200, `GET …/front-probe/env` → 503 `UNAVAILABLE` with `Retry-After: 1`;
Front's log shows `"result":"waiting"` lines 5–10 s apart; `rabbitmqctl list_consumers` shows no
Tally consumer; `docker start local-postgres` → within 15 s `/healthz` 200, `/env` answers, Tally's
consumer is listed and a published message is counted; then `docker stop local-postgres`,
`docker restart app-front`, and `docker stop -t 10 app-front` during the wait exits 0 in under 2 s
with the `startup-stopped` line. Remove the project.
**Commit:** `QL14: startup waits for a missing store; configuration still fails fast`.
