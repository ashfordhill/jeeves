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

## Amendment

SO05, reviewed 2026-11-13 from `410b177` (SO04) by an agent that didn't implement SO04. Read:
the amendment, SO04's handoff entry and `git diff 9c0c035..HEAD -- jeeves-generator
docs/studio.md docs/template-gaps.md`, taking only SO04's hunks (the UF01–UF06 hunks in
`docs/studio.md`, `vitest.config.ts`, `module-stubs.test.ts` and the stub-stack pins are
another plan's). Probes: a temporary `so05-probe.test.ts` (5 tests, deleted before the commit)
ran the emitted `delivery.ts`; Node 24's own `fetch` was run against loopback ports and servers.

### Verdict

SO04 does what the amendment asks, and open item 1 above is done by it. No defect was found to
fix, so the checks ran once. Two limits, one wording and one doc sentence are recorded below,
with three proposed units.

### Checks

| Check | Finding |
| --- | --- |
| The guard against the amendment | Matches. In `unreachable()`'s walk a value that is a `TypeError` with the message exactly `fetch failed` and no `Symbol.for("jeeves.internal-call")` of `true` answers false before its code, message, `errors` or `cause` are read. Probed: Node 24's `fetch` to a refused loopback port rejects with `TypeError "fetch failed"` (no `code` of its own) whose `cause` carries `ECONNREFUSED`, so the guard meets the real error. Unmarked: false at depth 0, wrapped once, twice or five deep (six deep nothing is read). Marked: true through the cause's code, and through a dual-stack `AggregateError` cause that carries its own `ECONNREFUSED`. The walk is outside in, so an outer error that itself carries a socket code or a `Connection terminated` message over an unmarked fetch is unreachable: the application's own re-coding, not a gap. Only a `TypeError` (or a subclass) with that exact message is guarded; only undici throws it. `httpTarget` is wired for `kind === "application"` targets only (`client-wiring.ts`): an External API, Identity or CDN link is `unavailable` to a stub, so nothing but a call to another tile carries the mark |
| `AggregateError` | Verified: inside one, an unmarked `fetch failed` answers false for its own item and the other items are still read. `[fetch failed, 08006]` and `[57P01, fetch failed]` are unreachable; `[fetch failed]` and `[fetch failed, 57014]` are not. Accepted: the step names the error and its causes, an `AggregateError`'s members are siblings, and a store failure beside an outside one is still a store failure |
| `httpTarget` returns a response unchanged | True. `request` is `fetch(url, init).catch(…)`: a resolved `Response` is the same object (SO04's test asserts identity; the earlier test still asserts that the URL and `init` reach `fetch` as given). The `.catch` rethrows the same rejection. An error that can't take the mark (frozen or sealed): `Reflect.set` returns false and doesn't throw (probed; a strict-mode assignment would throw a `TypeError` and replace the error), so the rejection is rethrown as it was; a non-object rejection too (SO04's test). A sync throw from `new URL(path, base)` (`ERR_INVALID_URL`) escapes `request()` as before SO04 and is never unreachable |
| The pins | Verified. `processes-off.json` changed only `.jeeves/manifest.json` and `src/runtime/delivery.ts`, in `frozen-v2` and `v2-module-design`; `stub-stack` unchanged. No pinned export holds `src/runtime/module-clients.ts` (0 occurrences in the fixture: the three pins have Runnable processes off), so SO04's two-of-three is right. `pnpm check` passes on the pins |
| The test fixture's pg error | `P0001` (`raise_exception`) is the right code: with an unreachable SQLSTATE on the outer error the walk would answer true at depth 0 and never reach the fetch. With `P0001` the test fails before SO04 (`ECONNREFUSED` found at depth 3) and passes after, so it proves the guard at depth 2 |
| Docs | `jeeves-generator/README.md` carries the limit in its parenthetical ("a `fetch failed` counts as unreachable only when it is `httpTarget`'s call to another tile"); the doc comment on `unreachable` says an application's SDK that doesn't use `fetch` still looks like a store and can throw `NonRetryable`. `docs/studio.md` and the generated README (`local.ts`) have the amendment's unqualified sentence: finding 3. `template-gaps.md`: nothing to change. Open item 1 above is SO04's record and stays as written |

### Findings (not fixed)

1. **Limit: a tile that dies mid-request spends an attempt.** Probed on loopback: a server that
   destroys the socket before answering makes `fetch` reject with `TypeError "fetch failed"`
   whose cause is undici's `SocketError`, code `UND_ERR_SOCKET` ("other side closed"); one that
   dies mid-body makes `response.text()` reject with `TypeError "terminated"`, the same cause.
   Neither code is on the Decision's list, so a marked call to a tile that dies while a request is
   in flight spends one attempt (the loop's concurrency in messages, once per outage); the next
   attempt gets `ECONNREFUSED` or `EAI_AGAIN` and waits. A message at its last attempt at that
   moment reaches `.failed`: the one hole in "another tile is waited out". PostgreSQL has no such
   hole: the same moment reports `Connection terminated unexpectedly`, `57P01` or `ECONNRESET`,
   all listed. undici's connect timeout (`UND_ERR_CONNECT_TIMEOUT`, 10 s, a paused tile) is the
   `fetch` form of the listed `ETIMEDOUT` and spends an attempt every 10 s likewise. This is
   against the amendment's intent, narrowly; adding a code changes the Decision, so it is
   proposed unit 1, with a catch about the body read.
2. **Wording: the line for a tile that is away reads "store unreachable".** A marked call's
   `loop-error` line is `error: "TypeError: fetch failed"`, `action: "store unreachable, retry in
   5000 ms (attempt not counted)"`. `describe()` keeps the error's name and message and drops the
   cause, so the line names no tile and no host (`connect ECONNREFUSED 10.0.0.3:3000`,
   `getaddrinfo EAI_AGAIN app-x`). "fetch failed" tells an operator it was an HTTP call, not
   PostgreSQL; which process is away isn't in the line. Not reworded here: proposed unit 2.
3. **Docs: the unqualified sentence.** `docs/studio.md` and the generated README say "a failed
   call to an outside host keeps the normal retries", the amendment's words. True of `fetch`,
   which the amendment takes as the application's way to call outside; an outside call through
   axios, `node:http`, `undici.request()` or `node-fetch` carries the socket code itself and
   waits for ever, as the doc comment and the generator README's parenthetical say. Not reworded:
   the plan prescribed the sentence; proposed unit 3.
4. **Limit: the depth bound covers the mark.** A marked `fetch failed` wrapped five deep has its
   cause at depth 6, out of reach, so that message spends an attempt (as any cause six deep does,
   SO03's probe); four wraps deep still waits.
5. **Observation.** A `fetch` ended by `AbortSignal.timeout` is a `DOMException` (`TimeoutError`),
   never unreachable, marked or not: the application's own deadline, not a lost connection.

### Proposed units

Numbers are the coordinator's. One is ready; two need the owner.

1. **SO06 — A tile that dies mid-request is waited out.** *Needs the owner: it adds to the
   Decision's list.*
   **Goal:** a marked call whose `fetch failed` cause carries undici's `UND_ERR_SOCKET` or
   `UND_ERR_CONNECT_TIMEOUT` waits 5 s and keeps the attempt, as a socket code does; nothing
   else changes. **The catch for the owner:** the two codes must count only beneath a marked
   `fetch failed`, not on the list for every level. On the list, an outside host closing
   mid-body (`TypeError "terminated"`, cause `UND_ERR_SOCKET`, never marked: the body is read
   after `request()` has returned) would wait for ever; and a marked call's own mid-body
   `terminated` isn't marked either, so it keeps spending an attempt unless `httpTarget` also
   wraps the `Response`'s body reads. The owner chooses (a) below, or (b) leave the code and
   record the limit in `jeeves-generator/README.md` in one sentence.
   **Files (a):** `templates/local-v2/assets/src/runtime/delivery.ts.template`,
   `src/v2/primitives.test.ts`, `src/v2/fixtures/processes-off.json`, `jeeves-generator/README.md`,
   `docs/plans/store-outage/units.md` (the Decision's list, in the owner's words).
   **Steps (a):** 1. In `delivery.ts.template`, after `internalCall`, add `const internalCodes =
   new Set(["UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"]);`. In `found`, directly after the
   guard's `return false;`, add: when `value` is a `TypeError` with message `fetch failed` marked
   `true`, and its `cause` is an object whose `code` is in `internalCodes`, return true. Extend the
   doc comment by one sentence. 2. `primitives.test.ts`, in "tells a failed outside fetch from a
   call to another tile": marked `fetch failed` with cause `{ code: "UND_ERR_SOCKET" }` is true
   and with `{ code: "UND_ERR_CONNECT_TIMEOUT" }` is true; the same unmarked is false; `new
   TypeError("terminated", { cause: { code: "UND_ERR_SOCKET" } })` is false; `Object.assign(new
   Error("x"), { code: "UND_ERR_SOCKET" })` alone is false. 3. Pins by Rule 7; allowed paths
   `.jeeves/manifest.json`, `src/runtime/delivery.ts`. 4. `jeeves-generator/README.md`'s list of
   what counts as unreachable gains "or, on `httpTarget`'s call to another tile, undici's
   `UND_ERR_SOCKET` and `UND_ERR_CONNECT_TIMEOUT`"; the Decision gains one bullet.
   **Checks:** `pnpm check`, `pnpm test:e2e`, the web build; then `--suite=wiring` and
   `--suite=faults` in their own phase. **Commit:** `SO06: a tile that dies mid-request is waited out`.
2. **SO07 — The loop's failure line carries the cause.** *Needs the owner: a log format choice.*
   **Goal:** a `loop-error` line for a marked call names the host: `describe()` in
   `tile-loop.ts.template` and `describeError()` in `tile-process.ts.template` (the same
   function) append the first `cause`'s name and message after `; ` (`TypeError: fetch failed;
   Error: connect ECONNREFUSED 10.0.0.3:3000`), still cut at 300 characters; an error with no
   cause reads as today. The owner may instead, or as well, change the action's first words
   (`store unreachable`) for a marked call; SO05 didn't reword it.
   **Files:** the two templates; `src/v2/tile-loop.test.ts` (one assertion on the `error` field
   of a logged line with a cause, failing before); `module-clients.ts.template` line 72 uses its
   own `describe`, left as is unless the owner wants probes to match. Neither template is in a
   pinned export (0 occurrences of `tile-process` and `tile-loop` in `processes-off.json`), so no
   pin should change; run Rule 7 if `processes-off.test.ts` fails.
   **Checks:** `pnpm check`, `pnpm test:e2e`, the web build, `--suite=faults` (B09's row asserts
   the action, not the error field). **Commit:** `SO07: the loop's failure line carries the cause`.
3. **SO08 — Say which outside calls keep the normal retries.** *Ready.*
   **Goal:** the two unqualified sentences say `fetch`. **Files:** `docs/studio.md` (the sentence
   at the end of the loops paragraph, "a failed call to an outside host keeps the normal
   retries"), `src/v2/local.ts` (the generated README's same words), `src/v2/loop-wiring.test.ts`.
   **Steps:** 1. `docs/studio.md`: "a failed call to an outside host keeps the normal retries"
   becomes "a failed `fetch` to an outside host keeps the normal retries (another HTTP client's
   socket error still waits: see the generator README)". 2. `local.ts`: the same words become
   "a failed `fetch` to an outside host keeps the normal retries". 3. `loop-wiring.test.ts`: the
   `toContain` of the old words takes the new words (fails before, passes after). No pin changes: the sentence is emitted only with Runnable processes on.
   `jeeves-generator/README.md` already carries the qualifier. **Checks:** `pnpm check`,
   `pnpm test:e2e`, the web build. **Commit:** `SO08: say which outside calls keep the normal retries`.

### Runs

One round, as nothing was fixed; the tree at `410b177`.

| Phase | Result |
| --- | --- |
| `pnpm check` | exit 0, 115 files / 912 tests, Biome 1 info |
| `pnpm test:e2e` | 74 passed (4.6 min) |
| Web build | exit 0 |
| `--suite=wiring` | 2/2, Vitest 178.5 s (198 s wall) |

The wiring run released its stack; Docker containers, volumes, networks and image tags equalled
the pre-review inventory, the run's `test-results/generated/` folder was removed, and no
`jeeves-system-*` temporary folder was left.
