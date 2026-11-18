# Store outage: template workers wait out a lost database

> Historical completed sequence (RG26, 2026-11-18): SO01–05 and SO08 completed. SO06–07 proposed in the review remain inactive suggestions, not executed units. The original “nothing implemented” statement below describes planning time. See the [plan index](../README.md) and
> [RG handback](../reliable-generation/owner-handback.md) for actual support and next-work authority.

**Status:** planned 2026-11-13 from GS09's first next unit, which the owner asked to fix
("ok fix #2"). Written by the coordinator from the code at `7bef25f` (after GS09). **Nothing is
implemented.** Read, not run.

There are 3 units, run in order: SO01 → SO02 → SO03. A coordinator gives each unit to a fresh
agent. That agent does only its own unit on `main` in the primary checkout, commits it and stops.

## Why

GS07's B09 database row passes only because the Event counter's process crashes. Two template
gaps (`docs/template-gaps.md`, the two rows GS07 and GS09 recorded) work together:

1. `pool()` in `jeeves-generator/templates/local-v2/assets/src/features/service-resources.ts.template`
   creates a `pg.Pool` with no `error` listener. When PostgreSQL ends its idle connections, the
   pool emits `error`, nothing handles it, and the process exits with code 1. The stub pool in
   `runtime/module-clients.ts.template` already has `pool.on("error", () => {})`.
2. The delivery runner (`runtime/delivery.ts.template`, `createDeliveryRunner`) republishes a
   failed message at once with `x-delivery-attempt` + 1, and sends it to `.failed` as
   `RETRY_EXHAUSTED` once the attempts reach `retryLimit`. A stub loop waits `retryDelay` (250 ms
   doubling) before each retry; a mounted template waits not at all. A worker that stays up
   through an outage would spend its retries in moments and send accepted work to `.failed`.

Fixing 1 alone turns today's pass into lost work, so SO01 fixes both together.

## Decision (coordinator, from the owner's "fix #2", 2026-11-13)

A consumer whose store is unreachable keeps its process and its messages. It does not count the
attempt: it waits 5 s (the cache's and the broker's fixed reconnect interval), puts the message
back on its own queue with the same attempt number, and tries again. The retry limit and
`.failed` are only for real failures of a message. HTTP requests are unchanged: they already
answer 503 while the database is away.

"Unreachable" means a connection-level failure, found on the error, on its `cause` chain (up to
five deep) or on any of an `AggregateError`'s `errors`:

- a Node socket code: `ECONNREFUSED`, `ECONNRESET`, `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`,
  `EHOSTUNREACH`, `ENETUNREACH`, `EPIPE`;
- a PostgreSQL SQLSTATE of class `08` (any code starting `08`), or `57P01`, `57P02`, `57P03`;
- a message from `pg`/`pg-pool` that starts with `Connection terminated`, or contains
  `timeout exceeded when trying to connect`;
- a client-side query timeout counts as unreachable (owner, 2026-11-14, QG18): a `pg` message
  that is exactly `Query read timeout` (QG17's bound), so a worker whose database stalls keeps
  its attempt, and a stall that never ends cycles for ever, as any outage does.

A statement timeout (`57014`), a constraint violation or any other error is not unreachable and
keeps today's behaviour.

## Not in this plan

| Item | Why not |
| --- | --- |
| Garage, OpenSearch or Keycloak outages | GS09's next unit 2, a later decision |
| A growing backoff or jitter for the 5 s wait | Fixed 5 s, as the cache and the broker |
| HTTP handlers retrying a request | They answer 503 now; a client retries |
| The outbox relay's polling | GS07 showed it recovers; relay throughput is an open gap |
| Regenerating `field-projects/youtube/v4` | Not needed to prove the fix; a later `update:v2` picks it up |
| Startup while PostgreSQL is down | Unchanged: startup probes fail fast, as today |
| Changing `retryLimit` values or `retryDelay` | Real failures keep today's limits |

## Rules for every unit

The production foundations plan's [Rules for every unit](../production-foundations/units.md#rules-for-every-unit)
2–8 apply as written, with these changes:

- **Rule 1:** read `AGENTS.md`; the last three entries of `docs/handoff.md`; this plan's Why,
  Decision, Not in this plan and Rules; the production foundations Rules 2–8; then your own unit.
  Do not read or start a later unit.
- **Rule 9:** append one entry to `docs/handoff.md` in the same shape, then make one local commit
  with the unit's commit name. No `HUMAN_FEEDBACK` line. Don't push.

---

### SO01 — Template workers wait out an unreachable store

**Goal:** a worker process stays up while PostgreSQL is away, and none of its messages spends a
retry or reaches `.failed` because of the outage. Stub loops and mounted templates behave the
same way.

**Steps.**

1. `templates/local-v2/assets/src/features/service-resources.ts.template`, `pool()`: directly
   after `const client = createPostgres({ … });` add

   ```ts
   	// An idle connection's error is not fatal: the next query reconnects.
   	client.on("error", () => {});
   ```

   (tab-indented, as the file is).
2. `templates/local-v2/assets/src/runtime/delivery.ts.template`:
   - Export `unreachable(error: unknown): boolean`, implementing the Decision's list exactly, with
     a doc comment that names it.
   - Export `export const UNREACHABLE_WAIT_MS = 5000;`.
   - In `createDeliveryRunner`'s `catch (error)`, before `const terminal = …`: when
     `unreachable(error)` is true and the error is not a `NonRetryable`, wait
     `UNREACHABLE_WAIT_MS`, cut short by `close()`. If the runner is closing or `fatalClosure` is
     set once the wait ends, return without acking (the delivery returns to the broker when the
     channel closes). Otherwise republish to `options.queue` with `headers` unchanged (the same
     `x-delivery-attempt`, no `x-terminal-code`), ack, and return. A republish failure calls
     `fatal(failure)`, as today. `onTerminal` is never called for an unreachable error.
   - The wait must not hold `close()` up for 5 s: `close()` ends every pending wait at once.
3. `templates/local-v2/assets/src/runtime/tile-loop.ts.template`:
   - `outcome()`: when `unreachable(error)` (imported from `./delivery.ts`) and the error is not
     a `NonRetryable`, return `{ retry: true, action: "store unreachable, retry in 5000 ms
     (attempt not counted)" }`, with the number taken from `UNREACHABLE_WAIT_MS`.
   - `moduleHandler`: in that case it does not wait `retryDelay` itself (the runner waits); it
     logs its one failure line with that action and rethrows.
   - `templateHandler` logs the same action through `outcome()`; no other change.
4. Tests (offline, in `jeeves-generator/src/v2/`; put each where that module's tests already live,
   such as `primitives.test.ts` for the runner and `tile-loop.test.ts` for the handlers):
   - `unreachable`: true for each socket code, for `08006`, `08001`, `57P01`, `57P03`, for the
     two `pg` messages, for a cause two deep and for an `AggregateError` holding `ECONNREFUSED`;
     false for `57014`, `23505`, a plain `Error("boom")` and a `NonRetryable`.
   - The runner, with a fake transport and fake timers: an unreachable failure at attempt
     `retryLimit` is republished to the queue (not `.failed`) with the same attempt header, after
     5 s, and acked; `close()` during the wait resolves at once and neither republishes nor acks;
     a non-unreachable failure keeps today's behaviour (the existing tests still pass unchanged).
   - `moduleHandler` and `templateHandler`: an unreachable error logs the new action, and
     `moduleHandler` does not wait `retryDelay`.
   - `pool()` registers an `error` listener (a test that reads the emitted
     `service-resources.ts`, or a unit test of the helper, whichever the existing tests do for
     similar template lines).
5. Pins: `processes-off.test.ts` will fail on the changed runtime files. Regenerate the pins by
   the production foundations pin procedure (Rule 7), and check that only these paths change:
   `.jeeves/manifest.json`, `src/runtime/delivery.ts`, `src/runtime/tile-loop.ts`,
   `src/features/service-resources.ts`. Any other changed path: stop as in rule 2.
6. `docs/template-gaps.md`: mark the two rows (the template pool's missing listener, the
   immediate retries) as fixed by SO01, in the table's own style.
7. Docs: where `docs/studio.md`, `jeeves/CATALOG.md` or the generator's README describe a mounted
   template's retries or `.failed`, add one sentence: an unreachable store waits 5 s and keeps
   the attempt.

**Checks:** `pnpm check`, `pnpm test:e2e`, the web build. One extra offline check: export the
Activity fixture (`field-projects/generator-system/fixtures/activity/design.json`) to the
scratchpad, install offline and run `pnpm build` in it, then delete it. No Docker suite in this
unit; SO02 runs them.

**Done when:** the new tests fail against the old templates (say how many) and pass now; the pins
changed only on the four paths.
**Commit:** `SO01: template workers wait out an unreachable store`.

### SO02 — The faults suite proves it with a worker that stays up

**Goal:** B09's database row asserts what SO01 promises instead of passing on a crash.

**Steps.** In `jeeves-generator/integration/scenarios/faults.system.test.ts`, the test named
`B09 database: PostgreSQL stopping during work gives bounded failures; after restore and the
documented restart, accepted work completes once`:

1. Rename it `B09 database: while PostgreSQL is away no worker exits and no accepted event reaches
   .failed; after restore, accepted work completes once without a restart`.
2. Keep its setup, its earlier/during events, its bounded-read assertions (503 within the existing
   bound) and its final exactly-once assertions.
3. Replace the "documented restart" (`pnpm start` or its harness equivalent) with nothing: after
   `start`, no application process is restarted by the harness.
4. Add these assertions, each with a deadline by the harness's monotonic `poll`:
   - from the stop until all accepted events are counted, every application container keeps its
     ID, stays running and its restart count stays at its value from `before` (as BR02/GS07's
     broker rows check);
   - while PostgreSQL is away, the Counter logs at least one failure line whose action contains
     `attempt not counted`, and the Counter's `.failed` queue stays empty (read through the
     harness's existing scoped broker inspection);
   - an idle case: before submitting the `during` events, wait until PostgreSQL has been stopped
     for longer than the pool's idle connections take to error (observe the Counter still running
     at that point, not a fixed sleep as proof);
   - after `start`, every accepted identity is counted exactly once, `.failed` is still empty, and
     one new event succeeds.
5. Record in `docs/plans/generated-system-tests/evidence/` (a new `so02/` folder with a short
   README) the observed times: stop to first failure line, outage length, start to all counted.

**Checks:** `pnpm test:generated --suite=faults` and `--suite=core` (Docker), then `pnpm check`,
`pnpm test:e2e` and the web build, in separate phases. Also prove the row fails without SO01:
run it once against the templates of `7bef25f` (a temporary checkout of those four template files
in the scratchpad export, never committed) and keep that failing result in the evidence. If the
harness can't point a run at older templates without editing generated output, say so instead.

**Done when:** faults passes with the new row, core passes, and the evidence shows the row
failing on the old templates (or why that couldn't be run).
**Commit:** `SO02: the database fault row keeps every worker up`.

### SO03 — Review

**Goal:** find what SO01–SO02 got wrong between them. Read both handoff entries and
`git diff 7bef25f..HEAD`. Check: the classifier's list against the Decision; that no
non-unreachable path changed; `close()` during a wait; the pins; a message that is unreachable
for a long outage (it cycles every 5 s; is anything lost or duplicated?); the log volume while
PostgreSQL is down; docs and `template-gaps.md`. Fix a small defect only with a test that fails
before and passes after; record the rest in `docs/plans/store-outage/review.md`. Run
`pnpm check`, `pnpm test:e2e`, the web build and `--suite=faults` before and after.
**Commit:** `SO03: review store outage`.

---

## Amendment (owner, 2026-11-13): an outside call is not a store

SO03's follow-up 1: the classifier reads only the error, so a handler whose own `fetch` to an
outside API fails with a socket code would wait forever and never reach `.failed`. The owner chose
to keep every provisioned store and service waited out (PostgreSQL, Garage, OpenSearch, Keycloak,
another tile) and to exclude outside calls. Generated store clients don't use `fetch` (`pg`, the
AWS SDK, the OpenSearch client); application code calling an outside API usually does. Generated
code reaches another tile through `httpTarget` (`runtime/module-clients.ts.template`), which uses
`fetch` too, so it marks its own failures as internal. Units SO04 → SO05 run after the
[UI follow-ups](../ui-followups/units.md).

### SO04 — A failed outside `fetch` keeps the normal retries

**Steps.**

1. `templates/local-v2/assets/src/runtime/delivery.ts.template`, `unreachable()`: while walking
   the error and its causes, when an error is a `TypeError` whose `message` is exactly
   `fetch failed` and whose `Symbol.for("jeeves.internal-call")` property is not `true`, return
   `false` at once (an outside call is not a store). The doc comment says so, and that an
   application's SDK which doesn't use `fetch` still looks like a store (it can throw
   `NonRetryable` to end a message).
2. `templates/local-v2/assets/src/runtime/module-clients.ts.template`, `httpTarget`:
   `request: (path, init) => fetch(new URL(path, base), init)` becomes a call that, when `fetch`
   rejects with an object, sets that object's `Symbol.for("jeeves.internal-call")` to `true` and
   rethrows it. Its doc comment adds one sentence: its failures count as an unreachable service.
3. Tests (offline): `unreachable` is false for `new TypeError("fetch failed", { cause:
   Object.assign(new Error("x"), { code: "ECONNREFUSED" }) })`, and true for the same error once
   marked; a `fetch failed` two causes deep under a pg error is still false. `httpTarget` marks a
   rejected `fetch` (inject a fake `fetch` the way the existing module-client tests do; if they
   can't, test the emitted function as SO01's `composition.test.ts` test does) and passes a
   resolved response through unchanged.
4. Pins by Rule 7. Allowed changed paths: `.jeeves/manifest.json`, `src/runtime/delivery.ts`,
   `src/runtime/module-clients.ts`. Any other: stop as in rule 2.
5. Docs: the sentence SO01 and SO03 added to `jeeves-generator/README.md`, the generated README
   (`src/v2/local.ts`) and `docs/studio.md` gains "a failed call to an outside host keeps the
   normal retries"; `docs/plans/store-outage/review.md` follow-up 1 is not edited (it is the
   review's record), the handoff says it is done.

**Checks:** `pnpm check`, `pnpm test:e2e`, the web build, then `pnpm test:generated
--suite=wiring` (internal HTTP and the controlled external endpoint) and `--suite=faults`, the
Docker suites in their own phase.
**Commit:** `SO04: a failed outside fetch keeps the normal retries`.

### SO05 — Review the amendment

Read SO04's handoff and `git diff <SO03's commit>..HEAD -- jeeves-generator docs` (UI follow-up
commits are not yours). Check the guard against the amendment, that `httpTarget` still returns a
response unchanged, and the pins. Fix a small defect only with a test that fails before and passes
after; add findings to `docs/plans/store-outage/review.md` under a new "Amendment" heading. Run
`pnpm check`, `pnpm test:e2e`, the web build and `--suite=wiring`. Then set `AGENTS.md`'s and
`jeeves/PLAN.md`'s active-plan sentence to say there is no active plan and the owner names the
next one.
**Commit:** `SO05: review the outside-call guard`.
