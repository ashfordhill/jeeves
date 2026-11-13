# GS07: generated backends recover from real failures

Implemented B06 recovery and B09 on 2026-11-13 from `c146ce9` (BR02) plus this unit's recorded
dirty source. The suite is `pnpm test:generated --suite=faults`; manual CI offers it and the
weekly `all` includes it. Final source SHA-256
`ddbc70ff43bdfd4ac54ce1d7e6bc23424321ffe76a80a39096d6d3ab84d5b4b4` (`faults/source.json`).
No template, generated scaffold, fixture, owned file, historical field app, pin or studio UI
changed. Hosted execution remains pending owner publication; no push occurred.

## How faults are made and judged

The suite reuses three existing fixtures unchanged: Regeneration's catalog design (one API,
PostgreSQL, Valkey), Activity, and Media. Faults are real controls on containers discovered by
exact Compose project label: `docker stop`/`start`, `kill`, `pause`/`unpause`. Two database
boundaries use administrative psql sessions the harness holds open: a `SELECT … FOR UPDATE`
row lock, and a trigger that waits on a harness-held advisory lock. The trigger fires only
before `sent_at` changes on the `jobs` row of one named video, supplies no effect, retry or
deduplication, and is dropped and checked absent before recovery assertions.

Each precondition is an assertion: a missed window fails the run. Broker rows restart no
application process. `assertNoProcessExited` compares every running `app-*` container's ID, start
time, state and restart count before and after; each broker client must log its `broker …`
failure line and later `"state":"available"` for the same `what`, per container. A container
stopped as a fault's precondition (B09 broker phase 1's Counter) is not judged and is resumed
explicitly. Precise interruptions run one copy of the targeted worker or relay. Durations are
measured on the monotonic clock; boundaries are wall-clock instants for `docker logs --since`.

## Observations (final `faults` run, 5/5)

| Row | Injection | Precondition / boundary observed | Restoration | Durable outcome |
| --- | --- | --- | --- | --- |
| Cache stopped | `docker stop` Valkey | `cache catalog-read` "Socket closed unexpectedly" 0.14 s later; eight reads over eight seconds all 200 in 1–4 ms, one authoritative load each; a later read tried the cache again and found it still unavailable | `docker start`; `"event":"cache","state":"available"` 0.33 s later | Cleared key refilled by one read (exact value, PTTL 3,729 ms); the next read is one INFO-measured hit with no load; the API never restarted |
| Cache stalled | `docker pause` Valkey | First read 153 ms (150 ms deadline: `cache read` and `cache catalog-read` "Cache deadline"), the other seven 2 ms; all 200 from PostgreSQL; a read 5.8 s on still found no usable cache | `docker unpause`; available 3.4 s later | Same refill (PTTL 3,734 ms) and hit; API never restarted |
| Counter dies before commit | Harness holds the total row; an event is submitted; `docker kill` of the one Counter | The worker's upsert waits (`Lock`/`transactionid`, from its own address, 4 ms in) and RabbitMQ shows 0 ready, 1 unacknowledged, 1 consumer. After the kill the same pid, transaction and statement still wait (997 ms into the 2 s statement timeout) | Row released; the dead backend ends; nothing committed (receipts and total unchanged); the delivery is back in the queue (1 ready, 0 consumers); `docker start` | Total 2, receipts exactly the seed and the killed event; `.failed` empty |
| Committed event again | The committed envelope replayed through the real `events` exchange, Counter stopped | Observed queued (1 ready) | Counter started; queue drained | Total and receipts unchanged; `.failed` empty. Duplicate-delivery proof, not a commit/ack crash |
| Broker, queued work | Counter stopped (precondition), five confirmed events queued; broker stopped 12.2 s | Activity API logs `broker publish events` failure 65 ms after the stop; at the start and after 12 s, submissions answer 503 `UNAVAILABLE` in 1–3 ms and reads 200; no running process exited | `docker start`; available 11.5 s later; the queue still holds the five | The 503's identity resubmitted counts once; all eight identities exactly once; no restart |
| Broker, running clients | Counter running; broker stopped 12.2 s | Publisher and consumer failure lines 65 ms after the stop; 503s and 200 reads at the start and after 12 s | Both log available 8.0 s after `docker start`; the consumer is back (1) | Two more identities exactly once; no process exited or restarted |
| PostgreSQL during work | `docker stop` PostgreSQL right after three commits | Three submissions still 202 (broker only); reads 503 `UNAVAILABLE` in 6–19 ms. The Counter **exited** (code 1): pg-pool's idle listener emitted an unhandled `'error'` ("terminating connection due to administrator command"); its raw output is kept. The three accepted events waited queued (3 ready, 0 consumers, `.failed` empty). The Totals API stayed up | `docker start`, then the generated README's documented recovery, `pnpm start` | All six accepted identities exactly once; a new event commits; `.failed` empty |
| Transcoder dies mid-encode | `docker kill` of the one Transcoder 0.72 s after the job's `started` | Asset `processing`, details 404, `docker top` shows FFmpeg encoding the 360p rendition of the 40 s source | The job is back in `upload-jobs` (1 ready, 0 consumers); `docker start` | Ready 8.0 s after the kill; details 404 until then and never 200 before `ready`; FFprobe-valid delivery; receipts `started,succeeded`, one publication intent (sent), one `published.videos` row, one search document |
| Relay dies after confirm | Trigger gate on the video's `jobs` row; complete; `docker kill` of the Upload API (the jobs relay's process) | The relay's `UPDATE … SET sent_at` waits on `advisory` as `r_metadata__upload_api` from the relay's address, 65 ms in; the job is already in `upload-jobs` (1 ready, consumer stopped). After the kill the same pid, transaction and statement still wait (912 ms in) | Advisory lock released; the dead backend ends; the intent is still pending (`sent` false, attempts 0); gate dropped and checked absent; `docker start` | Relayed again and marked sent (attempts 1); two copies of the job queued; with the Transcoder started: one publication intent, `started,succeeded`, one published row, one search document |
| Broker, job in hand and intent waiting | `docker stop` broker while FFmpeg encodes the 720p rendition of another video | All eight broker clients log failure 76–79 ms after the stop; FFmpeg still runs after the stop. Details 200 for both ready videos, search 200 (total 2), a play 503 in 31 ms. A second upload completes (200 pending); its `jobs` intent is deferred by the relay (attempts 1). The job in hand runs on and fails only its final publish ("Broker unavailable", 5.0 s into the outage) | `docker start` after 5.9 s; all eight clients log available 4.2 s later; no process exited or restarted | The redelivered job reuses its completed output: ready after the restart. The waiting intent is sent; both videos have one publication, `started,succeeded` and one document each. The 503 play's identity retried: 202, views 1, one receipt. Search total 4; every queue drained with its consumer back; every `.failed` empty |

Long synthetic video: 40 s, 1280×720 H.264/AAC from the export's pinned FFmpeg, 23,907,836 bytes,
SHA-256 `56de22960c9c5c15ef2126f51267f450262db4de40e1132be89517881782132c`, under the existing
30 MiB bound (a five-part upload). B08's four-second two-part input is unchanged (8,261,230 bytes,
the same hash as GS06).

Run cost: Vitest 420.4 s, CLI wall 7:49.7 (five stacks released one at a time: 37 containers,
five networks, 13 volumes; every scope empty afterward, scrub marker matching). A first full
`faults` run on the previous source (wall-clock durations) also passed 5/5 in 7:48.8.

## `all` once, and a host clock finding

`--suite=all` ran once on the previous source (`all/`): 13 of 14 passed (core 4, Wiring 2,
Identity 1, Media 1, faults 5); GS08's B10 failed. Its fresh-B expiry poll timed out at 15.1 s
of an intended 19 s window, with the key 671 ms from expiry and no further observation. The host's
wall clock is stepped forward 3.58 s every 32.25 s of monotonic time (WSL2 time sync;
`all/host-clock-steps.json`, 49 steps of 3.576–3.593 s from the journal's realtime/monotonic
stamps). One step landed between B10's last two observations and passed the poll's `Date.now()`
deadline by 30 ms. B10, its harness and the generated code were not changed by this unit; the
failure is retained and was not rerun. `poll` and B10's elapsed times use the wall clock, so any
tight wall-clock window on this host can lose up to 3.6 s; GS09 should decide the fix.

That `all` took 1,095.5 s of Vitest time (20:26 wall) with B10 cut short; B10 normally takes about
128 s, so a passing `all` is about 1,175 s against the previous 1,200 s bound for one Vitest
command. `run.ts` now gives `all` 40 minutes (one suite keeps 20), and the workflow gives `all`
a 50-minute step in a 60-minute job; core and single expanded suites keep 15/20 and 30/40.
All removed 114 containers, 14 networks and 39 volumes sequentially; every scope is empty.

## Limits

- **Not run:** a PostgreSQL outage while a template worker's pool is idle. From the code, a
  worker that then stays up retries a failed message at once (mounted templates have no retry
  wait), so accepted work could reach `.failed` within moments. Recorded as a known limit in
  [template gaps](../../../../template-gaps.md), with the Counter's exit seen here.
- The database row recovers through the documented `pnpm start` after the Counter exited; it
  passes because that exit leaves the accepted messages queued.
- Exact commit/ack crash timing, network partitions, Garage, OpenSearch and Keycloak outages and
  Valkey data loss remain unverified.
- Timing windows: the Counter and relay kills must land inside the 2 s statement timeout; observed
  997 ms and 912 ms here. A slower host that misses the window fails the run; it cannot pass by
  luck, because the post-kill check names the same transaction.
- The harness removes each stack's containers, networks and volumes but leaves its built
  `<project>-app`/`-media` image tags (existing behavior; 83 such tags predated this unit). This
  unit removed its own tags by exact name after the runs.

## Files

`faults/` is the final run: per-stack results, observations (gzip), boundary files
(`counter-kill-boundary.json`, `broker-phase-*-signals.json`, `database-outage.json`,
`cache-signals.json`, `transcoder-kill.json`, `relay-kill-boundary.json`, `broker-outage.json`),
synthetic inputs, original reports/manifests, scaffold hashes, JUnit/JSON, cleanup inventories
and the scrub marker. `all/` is the `all` run with B10's failure and the clock steps. Logs and
large files are gzip-compressed; no runtime secret, token, signed URL or media is kept (the one
`secretKey` in the Counter's crash dump is the terminated PostgreSQL backend's cancel key).
