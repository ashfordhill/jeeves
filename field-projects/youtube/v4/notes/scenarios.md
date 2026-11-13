# YouTube v4: acceptance by API, then two copies

**The run:** PF12 of the [production foundations plan](../../../../docs/plans/production-foundations/units.md),
2026-11-12 (UTC 2026-11-13), on `git archive` of `app/` at `8e6bfbc` outside the checkout
(`jeeves-pf12`, loopback 45800 HTTP, 45801 identity, 45802 objects). Every step was taken by API
through the edge with `pf.mjs` and V3-17's `upload.mjs`. The raw outputs are in the
[evidence](../../../../docs/plans/production-foundations/evidence/pf12/README.md). No app or
generated file was changed for this run.

**Setup.** `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build`, `pnpm first-run`
(131 s, building both images) and `node scripts/accounts.mjs` (creator, other-creator and viewer
created) all exit 0. 15 containers healthy: the 9 `app-*` and 6 providers.

**Result.** Every step of both parts was observed. The stack was left running with two copies
of each of the eight application processes (23 containers, all healthy, 0 restarts) for PF13.

## Part A — one copy of each process

| Step | Verdict | What was seen |
| --- | --- | --- |
| A1 Sign-in routes | **Observed** | With the creator's and the viewer's token, all three `me` routes answer 200 with that `username`. Without a token, Watch's answers 200 `{"signedIn":false}`; Upload's and Account's answer 401 `SIGN_IN_REQUIRED` |
| A2 Upload to ready | **Observed** (the 404s not recorded) | Start 200, three signed part URLs 200, three part PUTs 200 (5,242,880 / 5,242,880 / 5,099,193 bytes), complete 200 with `state: "pending"`. Details 200 after 4,055 ms (reads every 2 s). `pf.mjs`'s `poll` keeps only its last read, so the earlier reads are known only not to be 200. The asset went pending 03:10:35.06 → processing 03:10:35.82 → ready 03:10:38.68. This video is **A** |
| A3 Details and cache | **Observed** | 200, 200; `EXISTS ready-video:v1:<A>` prints 1 |
| A4 One play, sent twice | **Observed** | Both POSTs 202 (`playStatuses` `[202]`); `before` 0, `expected` 1, `after` 1 (visible after 255 ms), `settled` 1: the resent play counted once |
| A5 Search | **Observed** | 200 with A as the one hit (`found` 1, `total` 1) after 989 ms |
| A6 Favorites | **Observed** | PUT 200, GET 200, the list 200 with A (`listed` true), DELETE 204; PUT without a token 401 |

## Part B — two copies

The plan's `docker compose --profile application up -d --no-recreate --no-deps --scale …=2 …`
exits 0 and starts eight new containers; no setup job ran again. `docker compose --profile '*' ps`
showed 23 containers, every one healthy, 11 s after the command started.

| Step | Verdict | What was seen |
| --- | --- | --- |
| B1 Repeated reads | **Observed** | Details 20 × 200. 20 searches: each 200 with A as the one hit, found on the first read (27–37 ms). 20 favorites runs: each PUT 200, GET 200, list 200 with A, DELETE 204, anonymous PUT 401. Both copies of Watch, Search and Account received traffic (network I/O of the second copies: 26, 34 and 116 kB) |
| B2 One Watch copy stopped | **Observed** | `docker stop jeeves-pf12-app-watch-api-1` took under a second; 11 s later, details 20 × 200. Started again; stopping `-2` at once (while `-1` was still `starting`), then 11 s later, details 20 × 200. Started again; both healthy, 0 restarts |
| B3 Fifty plays, each sent twice | **Observed** | 100 POSTs, all 202. `before` 1, `expected` 51, `after` 51 (visible after 260 ms), `settled` 51. The database holds 51 receipts and a total of 51. Both View counter copies received traffic |
| B4 A new upload | **Observed** | The upload's 200s as in A2, so **B** is created; details 200 after 4,050 ms; search 200 with B as the one hit (`found` 1) after 1,028 ms; `select count(*) from published.videos where video_id='<B>'` prints 1. Transcoder copy 1 encoded B (and A); copy 2 took no job |

**At the end:** 23 containers, all healthy, 0 restarts, and no line containing "error" in any
`app-*` container's log.

**Not shown by this run:** the details' 404 while a video is not yet ready (above), and a job on
the second Transcoder copy. Faults and a throughput sample are PF13's, [below](#faults-and-throughput).

## Faults and throughput

**The run:** PF13, 2026-11-12 (UTC 2026-11-13), on PF12's two-copy stack (23 containers, all
healthy, at the start), with PF12's harness as it left it. The raw outputs are in the
[evidence](../../../../docs/plans/production-foundations/evidence/pf13/README.md). No app or
generated file was changed. **A** for these steps is a new upload (`pangolinsaffron`): its 200s
as in A2, details 200 after 4,060 ms. Before each fault a boundary was recorded, and each
container's log was read only since it.

| Step | Verdict | What was seen |
| --- | --- | --- |
| F1a Cache stopped | **Observed** | `docker stop jeeves-pf12-cache-hot-metadata-1`; details 10 × 200 (111 ms for all ten). Since the boundary, each Watch copy's log has `"event":"failure"` with `"what":"cache watch-api-video-details-cache"` (`Socket closed unexpectedly`, as the cache went down), then `"what":"cache read watch-api-video-details-cache"` (`Cache unavailable`) on its first read; nothing else in the 19 s the cache was down |
| F1b Cache back | **Observed** | `docker start`; 0.1 s later both Watch copies logged `"event":"cache"` with `"state":"available"`. `DEL ready-video:v1:<A>` printed 1 (18.6 s after the start); details 200, 200; `EXISTS` printed 1: the read put the key back |
| F2a Broker stopped | **Observed** | Within 0.11 s of `docker stop jeeves-pf12-local-broker-1`, all 12 `app-*` containers that use the broker **exited** with code 1, each logging `process-failed`: `AMQP publisher unavailable` (both copies of Watch, Upload, Video lifecycle and Transcoder) or `AMQP consumer unavailable` (both copies of Search indexer and View counter). **Stayed up**, healthy: both copies of Account and Search, and the edge. 20 s later `ps -a` still showed the 12 exited. Details answered **503** `{"error":"UNAVAILABLE","message":"Service unavailable."}` from the edge (`app-watch-api could not be resolved`); search answered **200** with A as the one hit (`found` 1) |
| F2b Broker back | **Observed** | `docker start` the broker, then `pnpm start`: exit 0 in 31.8 s. It rebuilt both images from cached layers (new image IDs), ran `setup-migrate` and `setup-broker` again, **stopped and removed all eight `-2` copies**, recreated seven `-1` copies (Transcoder `-1` was started, on its earlier image) and waited for them: `ps` showed 15 containers, one copy of each process, all healthy. PF12's scale command again: exit 0, 23 healthy 11 s after it started. Plays: `playStatuses` `[202]`, `before` 0, `expected` 1, `after` 1 (after 269 ms), `settled` 1 |
| F3 Transcoder killed during a job | **Observed** | **C** (`axolotlindigo`) uploaded with the A2 200s. Its state read `pending` twice, then `processing`; at once `docker top` listed `ffmpeg … -i /tmp/media-job-…/source…` (1 s of CPU) in `jeeves-pf12-app-transcoder-1`. `docker kill` it, 5 s, `docker start` (healthy, 0 restarts). C was ready 3.5 s after `docker kill` was sent, while copy 1 was still down: copy 2 took the redelivered job (its network I/O 15.6 MB in, 11.6 MB out; the source is 15.6 MB), under the attempt ID that Complete returned. Ready 200 on the first read; search 200 with C as the one hit (`found` 1); `select count(*) from published.videos where video_id='<C>'` prints 1; every broker queue then held 0 messages |
| T1 Details reads | **Observed** | Three samples of 2,000 reads of A's details, 50 at a time, through the edge: `failed` 0 each time (table below). Both Watch copies served them (about 3 MB in each) |

| T1 sample | `perSecond` | `p50Ms` | `p95Ms` | `p99Ms` | `failed` |
| --- | --- | --- | --- | --- | --- |
| 1 | 4,076 | 9 | 21 | 67 | 0 |
| 2 | 4,245 | 9 | 19 | 65 | 0 |
| 3 | 4,186 | 9 | 19 | 65 | 0 |

**Machine:** these numbers are from one machine, the owner's computer, not a cluster: AMD Ryzen
5 7600X with 12 logical CPUs and 31 GiB memory, under WSL2 (Docker 29.9.1). All 23 containers and
the load script shared it. There is no pass mark for speed.

**At the end:** 23 containers, all healthy, 0 restarts. The cleanup then removed the stack
(`down --volumes --remove-orphans`), the images `jeeves-pf12-app` and `jeeves-pf12-media` and the
app copy with its `.runtime`; the Docker containers, volumes, networks and images equal those
before PF12.

**Shown by these faults:** the cache read answers through a cache outage and recovers by itself;
a worker killed during a job loses nothing, and the other copy finishes it. A broker outage
stops every process that uses the broker, Watch's details reads with it, and they stay stopped
until `pnpm start` (the known limit "A process that loses its broker exits and is not
restarted" in [template gaps](../../../../docs/template-gaps.md)); `pnpm start` also returns the
stack to one copy of each process.
