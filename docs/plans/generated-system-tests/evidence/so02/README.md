# SO02: the database fault row keeps every worker up

B09's database row (`faults.system.test.ts`) now asserts what SO01 promises instead of passing
on the Counter's crash. Run on 2026-11-13 (log stamps are UTC, 2026-11-14) from `766944b`
(SO01) plus this unit's dirty harness files. The row takes about as long as before (64.2 s;
GS07's 63.0 s). Final source SHA-256
`edacdd221c4492e02543d11ffce9d77ce4c3e34cd31d6a8a995874acdfd8e960` (`faults/source.json.gz`,
`core/source.json.gz`). No template, generated file, fixture, owned file or pin changed.

## What the row does

The Activity fixture, one Counter copy. Three events commit, then:

1. **Idle case.** `pg_stat_activity` shows the Counter's pool holding only idle connections from
   its address (three backends), and the Counter's own `/proc/net/tcp` shows the same three
   client ports `ESTABLISHED` to 5432. PostgreSQL is stopped (`docker stop`). Its log has
   `[pid] FATAL:  terminating connection due to administrator command` for each of those
   backends. A poll then waits until the Counter has closed its side of each ended connection
   (none `ESTABLISHED` or `CLOSE_WAIT`), or has exited: the point at which an unhandled idle
   `'error'` would have ended its process. Every application container must still be running
   with its container ID, start time and zero restarts.
2. **During.** Three events are submitted (202: publication needs only the broker); three reads
   answer 503 within 1.5 s. A poll reads the Counter's `loop-error` lines and `.failed`
   (`rabbitmqctl`) until two lines whose action contains `attempt not counted` are first seen
   at least 5 s apart, so the deliveries have waited, gone back to their queue and failed again.
   `.failed` must be empty, and each such line has `module: increment`, the subscriber queue
   and `attempt: 1`.
3. **After.** `docker start` PostgreSQL. No application process is restarted by the harness:
   all six accepted identities commit exactly once, `.failed` is empty, every container keeps
   its ID, start time and zero restarts, and a new event commits.

Every wait is the harness's monotonic `poll` with a deadline; there is no fixed sleep, retry or
skip. The new harness helper `connectionsTo` reads a running container's socket table and is
observation only.

## Observed times (final `faults` run)

| Measure | Value |
| --- | --- |
| Stop to first failure line (first seen by a poll; includes the idle case) | 1,847 ms |
| Submission of the `during` events to first failure line | 138 ms |
| Outage length (stop command to start command) | 9,428 ms |
| Start to all six accepted identities counted | 5,535 ms |

Durations are monotonic (`performance.now()`); "first seen" is an upper bound by up to one poll.
Other boundaries, from `faults/4-activity/database-outage.json`:

- `docker stop` took 591 ms. PostgreSQL logged the three FATAL lines 72 ms after the stop's
  wall instant. At the first observation (949 ms after the stop began) the Counter was running
  and the three sockets were `TIME_WAIT`, closed from its side.
- Reads during the outage: 503 `UNAVAILABLE` in 9, 6 and 10 ms.
- The first line: `database:during:0`, attempt 1, `Error: getaddrinfo ENOTFOUND local-postgres`,
  action `store unreachable, retry in 5000 ms (attempt not counted)`. The second, 5.02 s later by
  its log stamps: the same message, attempt 1, `suppressed: 2` (the other two messages' lines in
  the once-a-second limit). Meanwhile RabbitMQ showed the queue with 0 ready, 3 unacknowledged,
  1 consumer, and `.failed` 0/0.
- After the start: `.failed` 0/0 after the six were counted and after the new event; the four
  application containers (`app-activity-api`, `app-counter`, `app-edge`, `app-totals-api`) kept
  their IDs and start times, running, 0 restarts.

## The row against the templates of `7bef25f`

The harness exports from the checkout's templates, so one run can be pointed at older templates
without editing generated output: SO01's three template files
(`features/service-resources.ts.template`, `runtime/delivery.ts.template`,
`runtime/tile-loop.ts.template`) were replaced by their `7bef25f` versions (the template tree
then equalled `7bef25f`'s), `pnpm test:generated --suite=faults` ran once, and SO01's files were
put back and checked by SHA-256 against a scratchpad copy, which was then deleted. Nothing was
committed. The run (`old-templates/`, source SHA-256
`ebd6970e9072a8f0fa00cc263bac31dbc507a16c60e12c51629e02ce779bde09`, its `identity.json` lists
the three template files as dirty) failed as it should:

- 4 of 5 passed (B06, B09 counter, B09 broker, B09 media); exit 1.
- B09 database failed after 46.8 s at the idle case: `PostgreSQL ended the Counter's idle
  connections: app-counter exited`. The same three idle backends were seen and ended by
  PostgreSQL; the Counter wrote pg-pool's unhandled `'error'` (`terminating connection due to
  administrator command`, `57P01`, from `Client.idleListener`) 2.5 ms after PostgreSQL's FATAL
  lines and exited with code 1 (`old-templates/4-activity/database-outage.json`, its
  `counterOutputAtIdle`).

## Runs

| Run | Result | Vitest | CLI (monotonic / wall) | Released |
| --- | --- | --- | --- | --- |
| `faults/` | 5/5 passed (database row 64.2 s) | 478.7 s | 482.5 s / 8:56.6 | 37 containers, 5 networks, 13 volumes, 6 image tags |
| `core/` | 4/4 passed | 292.3 s | 294.8 s / 5:27.4 | 27 containers, 4 networks, 8 volumes, 4 image tags |
| `old-templates/` | 4/5, database row failed | 448.4 s | 452.3 s / 8:22.7 | 37 containers, 5 networks, 13 volumes, 6 image tags |

Every stack scope was empty after its run and each private runtime removed. Docker containers,
volumes, networks and image tags then equalled the pre-unit inventory. Logs, JUnit,
observations and source snapshots are gzip-compressed; the harness's sanitizer ran on each run
(`sanitized.json`). `checks.json` adds the later phases: `pnpm check` (115 files, 910 tests),
`pnpm test:e2e` (74 passed, 4.7 min) and the web build, all passing.

## Limits

- The idle case relies on PostgreSQL's default `log_line_prefix` (`%m [%p] `) to name each
  backend in its FATAL line; a fixture that changed it would fail the row, not pass it.
- One Counter copy, one outage of about 9.4 s (two wait cycles). A longer outage repeats the
  same cycle; it was not run.
- A message waiting out the outage holds its prefetch slot and comes back at the end of its
  queue (SO01's note); this row does not assert order.
