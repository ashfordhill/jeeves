# SO03 review: store outage

Reviewed 2026-11-13 from `877c520` (SO02) by an agent that implemented neither SO01 nor SO02.
Read: the plan, both handoff entries, `git diff 7bef25f..HEAD` (without `c51e1a1`, a later
plan's file), the [SO02 evidence](../generated-system-tests/evidence/so02/README.md) and the
harness. Offline probes of the emitted `delivery.ts` ran as a temporary test file, deleted before
the commit; their results are below.

## Verdict

SO01 and SO02 do what the plan asks. One small defect is fixed here (the generated README); the
rest are limits or owner questions, listed at the end.

## Checks

| Check | Finding |
| --- | --- |
| The classifier against the Decision | Matches. The 8 socket codes; `code.startsWith("08")`; `57P01`–`57P03` by `/^57P0[123]$/`; a message that starts with `Connection terminated` (which also covers `pg`'s "Connection terminated due to connection timeout") or contains `timeout exceeded when trying to connect`. Probed: a cause five deep is found and six deep is not; `08P01`, `08003`, `08004`, `57P02` are unreachable; `57P04`, `53300`, `40001`, `40P01`, `XX000`, `57014` and `23505` are not; a self-referencing `cause` ends. SO01 counts each `AggregateError` member as one level deeper: the Decision doesn't say, and the bound keeps a cycle finite. A Node `AggregateError` from a dual-stack connect carries its own `code`, so it is found at its own level |
| No non-unreachable path changed | True. In `createDeliveryRunner` the new branch runs only when `unreachable(error) && !(error instanceof NonRetryable)`, before the unchanged `terminal` code. In `tile-loop.ts`, `outcome()` adds a first branch on the same test; `moduleHandler`'s `waits` equals `next.retry` for every other error, so its delay, log action and wait are unchanged. Probed: a `57014` at the limit still goes to `.failed` as `RETRY_EXHAUSTED` with `onTerminal` called once. A `NonRetryable` whose `cause` is `ECONNREFUSED` is excluded by the runner's own `NonRetryable` test, so a template's `MALFORMED_MESSAGE` or `INVALID_MEDIA` keeps its code |
| `close()` during a wait | Correct. `close()` aborts one `AbortController`; every pending wait resolves at once and the delivery returns unacked (`closing`), so `close()` doesn't wait 5 s. SO01's test proves it with fake timers. Probed too: a broker loss during the wait (`runner.fatal`, as `createConsumer`'s `lose` calls it) ends the wait the same way, with no republish and no ack. `createConsumer.close()` and a stub loop's `scope.own` both reach `runner.close()` |
| The pins | Verified. `processes-off.json` changed only `.jeeves/manifest.json`, `src/features/service-resources.ts` and `src/runtime/delivery.ts`, in `frozen-v2` and `v2-module-design`; `stub-stack` is unchanged. No pinned export holds `src/runtime/tile-loop.ts` (checked in the fixture: 72, 77 and 52 pinned paths, none of them `tile-loop.ts`), so SO01's three-of-four is right |
| A long outage | Nothing is lost. Probed with fake timers: one hour (720 cycles of 5 s) gives exactly 720 republishes to the message's own queue and 720 acks, each with the same `x-delivery-attempt`, and `onTerminal` is never called. A copy is acked only after its republish is confirmed. Duplicates are possible, as with today's retries (at-least-once): the broker dropping **after** the copy is confirmed but **before** the ack leaves both the copy and the unacked original on the queue (probed). The broker dropping **mid-republish** (rejected or the 5 s confirm deadline) calls `fatal`; the original is not acked and returns to its queue (probed), and a copy the broker stored without confirming would be a second copy. The Counter's receipts make a duplicate count once; a stub's own effects are its author's, as the runner's comment says |
| Log volume while PostgreSQL is down | Bounded. `loop-error` is limited to one line a second per module and queue, with a `suppressed` count. A loop with concurrency *c* fails *c* messages every 5 s, so it writes at most one line a second (one every 5 s at concurrency 1, about 720 an hour). SO02's run: two Counter lines in 9.4 s, the second with `suppressed: 2`. The other lines during an outage are unchanged by this plan: an HTTP `failure` at most once a second per route, an outbox relay's `failure` at most once a second (its 1 s poll). The template pool's idle `error` is now silent, as the stub pool's already was |
| Docs and `template-gaps.md` | `template-gaps.md`'s two rows say Fixed in SO01, in the table's style. `docs/studio.md`, `jeeves-generator/README.md` and `field-projects/generator-system/README.md` are true. `jeeves/CATALOG.md` has no sentence on a template's retries. **One false sentence was missed:** the generated README (`local.ts`) says a loop's "other errors retry within the loop's limit"; an unreachable store does not count against the limit. Fixed below |

## SO02's points

- **`connectionsTo`** (`harness/faults.ts`) reads `/proc/net/tcp` and `/proc/net/tcp6` through
  `inApplication`, which `docker exec`s `node` in the one container `serviceContainers` found by
  the run's Compose project and service labels. It writes nothing in the container; it records
  its result. Observation only and scoped to the run.
- **The idle case** depends on PostgreSQL's default `log_line_prefix`; a change fails the row,
  never passes it. It then waits for the Counter's own sockets, not a fixed sleep. Sound.
- **The outage length** (until two `attempt not counted` lines are first seen at least 5 s apart)
  makes each waiting delivery go back and fail again at least once, and the row asserts
  `attempt: 1` on each line, which is the proof that the attempt isn't counted. Reasonable.
- **The old-template run** is real: `old-templates/` shows the row failing at the idle case
  (`app-counter exited`, pg-pool's unhandled `57P01`).
- **478.7 s against 420.4 s.** Not the row: it took 64.2 s against GS07's 63.0 s. Every other row
  was slower too (media 183.6 s against 159.9 s, broker 99.2 s against 88.4 s, B06 67.2 s
  against 54.9 s), which is host variance. This review's runs are under Runs below.
- **The three older records.** GS07's evidence README is a dated record of its run ("Implemented
  … from `c146ce9`", "final `faults` run"); GS09's `review.md` is dated ("Reviewed 2026-11-13
  from `d33e1fe`"); the GS plan's B09 row ("database loss produces bounded errors and recoverable
  work") is still true, and the GS07 unit's "perform the documented process recovery" is that
  unit's instruction. None describes the current suite as such, and
  `field-projects/generator-system/README.md`, which does, links SO02's evidence for the
  database row. Left as they are.

## SO01's points

- `outcome()` and `moduleHandler` share `storeUnreachable`; fine.
- `pnpm stop` during the wait leaves the message unacked, so it returns to its queue with its
  attempt; the generator README says so. Nothing is lost.
- Order changes during an outage: each waiting message goes to the back of its queue, and a
  worker cycles at most its concurrency in messages every 5 s while the rest wait in the queue.
  As with today's retries; not asserted anywhere.
- `field-projects/youtube/v4` still has the old runtime (`generated/` and `app/`: no
  `unreachable`, no pool listener) and its README the old loop sentence. Out of this plan; a
  later `update:v2` picks it up.

## Fixed here

1. **The generated README's loop sentence.** `local.ts` now adds, after a stub's retry limit, that
   an unreachable store waits 5 s and keeps the attempt. Test: `loop-wiring.test.ts`'s README
   assertion gains one `toContain` that fails before the change and passes after. The sentence is
   emitted only with Runnable processes on, so no pinned file changed.

## Runs

| Phase | Before (HEAD `877c520`) | After (with the fix) |
| --- | --- | --- |
| `pnpm check` | 115 files, 910 tests | 115 files, 910 tests (pins unchanged) |
| `--suite=faults` | 5/5, Vitest 475.6 s | 4/5, then 5/5 (469.1 s) on a rerun; see below |
| `pnpm test:e2e` | 74 passed | 74 passed |
| Web build | passed | passed |

The database row's times in the before run and the passing after run: stop to first failure
line 2,017 / 1,863 ms, outage 9,779 / 9,323 ms, start to all counted 5,659 / 5,540 ms; two
Counter lines each time. Every run released its stack; Docker containers, volumes, networks and
image tags then equalled the pre-review inventory.

**The failed after run.** B09 media's case 3 failed its own precondition: `docker top` showed
FFmpeg encoding the 360p rendition 0.6 s before the broker stop's recorded instant, and none
once the 718 ms stop returned (`expect(inHandAtOutage.length).toBeGreaterThan(0)`). Every
other row passed, including the database row. The fix changes one README sentence and no runtime file, and the next run
passed 5/5, so this is the precondition's timing window, failing closed: the stop can land in
the gap between two renditions, or after the last. GS07 saw it land in the 720p rendition.
Recorded as open item 6.

## Open

1. **Owner: the classifier can't tell a store from any other connection.** It reads the error
   only, so a handler whose outbound HTTP call fails with `fetch failed` (cause `ECONNREFUSED`,
   `ENOTFOUND`, …) waits 5 s and keeps its attempt for ever, and never reaches `.failed`; the same
   for a Garage, OpenSearch or Keycloak connection whose error carries a socket code, which the
   plan left to a later decision. For the media worker, such an object-store outage would no
   longer end in `PROCESSING_FAILED` (from the code, not run); the job waits instead. A real product dependency that is permanently gone (a wrong host name) now loops
   rather than failing. Keep it (an outage of anything waits), or limit it to the bound
   PostgreSQL pool (for example by tagging the pool's errors).
2. **Limit: a lost connection `pg` reports without a code.** `Client has encountered a connection
   error and is not queryable` (pg 8.23.1's `client.js`) is not in the Decision's list, so a query
   on a client whose connection has just failed spends one attempt. pg-pool removes an idle
   client on its `error`, so this needs a race; not seen in SO02. Adding it changes the Decision.
3. **Limit: a stalled (not stopped) database.** From the code, not run: with `docker pause`, a
   query on an open connection waits on TCP (the pool sets no client-side query timeout, and the
   paused server can't enforce `statement_timeout`); a new connection fails after 2 s with
   `timeout exceeded when trying to connect`, which waits and keeps the attempt.
4. **Limit: a worker waiting out an outage gives no other signal.** Its container stays running
   and healthy; only its `loop-error` lines show the wait. No backoff, as the plan chose.
5. **Not tested:** a long outage end to end (the probe covers the runner, not a stack), more than
   one Counter copy during the outage, and order.
6. **Harness: B09 media's broker-outage precondition can miss FFmpeg.** It checks once, after
   `docker stop` returns, that FFmpeg still runs; a stop that ends between renditions fails the
   run (once in this review's three runs; GS07's and SO02's recorded runs passed it). A fix (for
   example checking `docker top` before the stop and asserting the job is still in hand after
   it) is a harness change for a later unit.
