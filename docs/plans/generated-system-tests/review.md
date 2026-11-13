# GS09 review: generated system coverage and CI gates

Reviewed 2026-11-13 from `d33e1fe` (GS07) by an agent that implemented none of GS01–GS08.
Evidence: [gs09/](evidence/gs09/README.md). Hosted CI has never run: every result below is local
(WSL2, 12 logical CPUs, 31 GiB, Docker 29.9.1, Compose 5.6.0). The commits are unpublished;
only the owner publishes them and changes branch protection.

## Coverage map

Every installed template runs in at least one suite. Coverage means the named observations
below on the pinned providers and tested topologies, nothing more.

Providers (registry pins): PostgreSQL 17.11, RabbitMQ 4.4.0, Valkey 8.1.10, Garage 2.4.1,
Keycloak 26.8.1, OpenSearch 3.9.0, nginx 1.28.3; app image Node 24.21.0 (bookworm-slim); FFmpeg
`7:5.1.9-0+deb12u1` in the exported media image.

| ID | Test (suite) | Templates | Providers | GS09 result | Remaining limits |
| --- | --- | --- | --- | --- | --- |
| B01 | `core.system` (core) | event counter, 2 stubs (publisher, totals reader) | nginx, PostgreSQL, RabbitMQ | Pass (38 s) | One event; publisher has no outbox (202 = broker confirm) |
| B02 | `core-delivery` (core) | same | same | Pass (99 s); API failover recovered in 3–5,263 ms of the 15 s bound | Two worker and two API copies, one edge; no fairness claim |
| B03 | `core-delivery` (core) | same | same | Pass (71 s) | Ordinary stop/start only; no host crash or volume loss |
| B04 | `core-delivery` (core) | same | same | Pass (39 s) | One malformed shape; reader permissions on one view |
| B05 | `wiring.system` (wiring) | 12 stubs, positive cache read | nginx, PostgreSQL, RabbitMQ, Valkey, Garage, OpenSearch, a labelled HTTP fixture | Pass (91 s) | External call is owned code (no installed external client); search index is harness-mapped and seeded (the report keeps its mapping gap) |
| B06 normal | `wiring.system` (wiring) | positive cache read | PostgreSQL, Valkey | Pass (65 s) | 4 s TTL only |
| B06 recovery | `faults.system` (faults) | positive cache read | PostgreSQL, Valkey | Pass (60 s) | Stop and pause; no Valkey data loss or eviction |
| B07 | `identity.system` (identity) | verified identity, favorites, stub | nginx, PostgreSQL, Keycloak | Pass (109 s) | No token expiry/refresh, no Keycloak outage |
| B08 | `media.system` (media) | all 13 Media selections: multipart, video HLS, lifecycle, search projection/query, counter, favorites, cache read, identity, stubs | all seven + FFmpeg | Pass (128 s) | 200 (not 202) completion and no creator-status UI (gap 1); FFprobe, not human playback; one copy of each worker |
| B09 | `faults.system`, `faults-media.system` (faults) | counter; media templates | as B01 and B08 | Pass: counter 56 s, broker 91 s, database 65 s, media 166 s | See "Faults" below |
| B10 | `regeneration.system` (regeneration) | positive cache read, stub | nginx, PostgreSQL, Valkey | Pass (132 s), one clock step inside a window (below) | One compatible setting (TTL 4 → 16 s); no topology or schema migration; needs a host clock that doesn't step more than 3 s |

By mechanism: stub connections B05 (module, internal HTTP, topic fanout, work queue, object
store, search client); sign-in B07, B08; multipart B08, B09; lifecycle and outbox B08, B09;
encoding B08, B09; cache B06, B10 and B08's detail cache; counter B01–B04, B08 (views), B09;
search indexing and query B08 (B05 queries a seeded index through a stub); favorites B07, B08.

**Faults (B09) covered:** Counter killed while its increment waits on a held row; a committed
event replayed; broker stopped with queued work and with running clients (no process restart);
PostgreSQL stopped during work; Transcoder killed mid-FFmpeg; jobs relay killed after its
confirmed publish (trigger gate); broker stopped with a job in hand and an outbox intent waiting.
**Not covered:** Garage, OpenSearch and Keycloak outages; network partitions; exact consumer
commit/ack crash timing; Valkey data loss; a PostgreSQL outage while a template worker stays up.

## What GS07 reported, checked

- **PostgreSQL row.** Confirmed from the code: the template pool (`createPostgres`) has no
  `'error'` listener (stub pools do), so the Counter exits when PostgreSQL ends its idle
  connections, and its accepted messages wait queued until `pnpm start`. A worker that stays up
  would fail the message, `delivery.ts` republishes it at once, and after `retryLimit` it goes to
  `.failed` as `RETRY_EXHAUSTED`. The row passes because of the crash. Both are template gaps,
  not harness defects, and must be fixed together: an error listener alone turns today's pass
  into lost work. Recorded in [template gaps](../../template-gaps.md).
- **Kill timing.** The pre-commit and relay kills must land inside the generated 2 s statement
  timeout; GS07 saw the statements 997 ms and 912 ms in at the post-kill check (kills took 341
  and 502 ms). A late kill fails, never passes: the post-kill check requires the same backend,
  transaction and statement still waiting. GS09's run: 1,047 ms and 933 ms (kills 388 and
  413 ms), so about 1 s of margin remains on this host; a hosted runner's is unmeasured.
- **Deadlines.** `run.ts` gives `all` 40 min (one suite 20); the workflow gives `all` a 50-min
  step in a 60-min job, core 15/20, one expanded suite 30/40. GS09's `all` took 1,210.9 s of
  Vitest time and 1,229 s CLI (monotonic; 1,366 s by the stepped wall clock), inside 40 min.
- **Not covered:** confirmed as listed above.

## B10 flake: diagnosis

GS07's failing `all` stopped B10's fresh-B expiry poll with the key 671 ms from expiry.

1. **The host clock.** On this WSL2 VM (`tsc` clocksource), over 70 s of monotonic time the
   wall clock and the Windows host clock both advanced about 77.4–78 s: the VM's monotonic clock
   runs about 10% slow, and time sync corrects the wall clock in +3.58 s steps every 32.25 s
   (measured again in GS09: three steps of 3,581–3,587 ms in 100 s).
2. **A harness defect, fixed.** `poll` measured its deadline on `Date.now()`. A step during its
   250 ms sleep put the wall clock past the deadline, and it gave up without another
   observation, cutting a wait short by up to 3.58 s. The same applied to `until`, the psql
   session deadline and the B02 routing bound. They now use `performance.now()`. New offline
   test `jeeves-generator/src/v2/system-harness.test.ts` fails on the old harness (the poll gave
   up after one observation of a 1.5 s window; `until` returned at once) and passes now.
3. **Not fixed, and not a harness defect: B10's bound.** Valkey expires keys by the same wall
   clock, so B10 correctly measures elapsed time on it. In the failing run the step jumped the
   wall clock from about 15.4 s to 19.03 s after the fill; Valkey's key expired at that step, so
   even a correct poll would have seen it absent at 19.03 s, past the 19 s bound. Measuring on
   the monotonic clock instead would fail more often (any step early in the window makes Valkey
   expire 3.58 s early, under the 13 s floor). The bound's 3 s margins are smaller than the
   step, so on this host B10 can fail when a step lands near a fill or an expiry (estimated a
   few percent per expiry check, four checks per run). B10 now records monotonic time beside
   each observation, so such a failure shows the step. No bound or invariant changed.
4. **Seen live in GS09.** In this review's `all`, a step landed inside fresh-B's window: the
   key was first seen absent at 18,174 ms wall but 14,586 ms monotonic (a 3,588 ms step). It
   passed with 826 ms to spare; a step about a second later would have failed it
   (`evidence/gs09/all/1-regeneration/fresh-b-expiry.json`).

**Decision:** the poll defect is fixed. B10's remaining exposure is the host's clock; the fix
belongs to the host (see "Owner decisions"). It is not hidden by retries.

## Review of the harness

- **Cleanup and scoping.** Every Docker action targets IDs found by the exact Compose project
  label (`gs-<uuid>-<n>`), checked again before removal; cleanup refuses foreign records,
  paths and symlinks; no global prune. Each stack is released when it finishes, and the outer
  record cleanup is idempotent and also runs on SIGINT/SIGTERM and from `--cleanup`. **Fixed in
  GS09:** built image tags were never removed (GS07 counted 83 left by earlier units); they are
  now in the label inventory and removed by exact name. GS09's `all` released 118 containers,
  15 networks, 41 volumes and 17 image tags, one stack at a time, and left nothing labelled
  with its run; the 83 older tags remain.
- **Fixture ownership.** Attachments must be report-listed hooks, stub files (not `.slots.ts`)
  or product SQL, `generated-extension` in the manifest, regular files under `owned/`; scaffold
  and manifest hashes are checked after attaching, during B10's update and after every run.
- **Assertion independence.** Scenarios import no generated or binding code (only types and a
  path-safety helper); expected values are scenario constants; provider observations use
  administrative logins only for setup, observation and faults, and the reader's own login for
  permission checks. One soft spot: B10 stamps an observation's elapsed time before the
  `docker exec` that reads it, so its upper bound tolerates that latency (hundreds of ms).
- **Omitted or unobserved steps.** Each fault's precondition is an assertion; an empty run fails
  (`passWithNoTests: false`). **Fixed in GS09:** `all` passed if a selected suite's scenario
  files went missing while the others ran; `run.ts` now fails a selected suite that ran no file.
  The deliberate failure below shows an omitted fault fails its test.

## Deliberate harness failure

`faults` was run with the Counter's `docker kill` replaced by a no-op
([patch](evidence/gs09/deliberate-failure/omitted-kill.patch)). Result: 4 of 5 passed, exit 1,
435 s. B09 counter failed at its first durable check: `expected [ 'counter:killed',
'counter:seed' ] to deeply equal [ 'counter:seed' ]` (the unkilled worker committed). The stack's
`result.json` records phase `assertion`; the run's JUnit/JSON, observations, logs and
`failure.log` are kept; all five stacks were released (37 containers, 5 networks, 13 volumes, 6
image tags), the scrub marker matches and the private runtime was removed. The scenario was
restored byte for byte (SHA-256 checked) before the final checks.

## Gates

Observed (this host, warm, Vitest seconds): core 248, wiring 156, identity 109, media 128,
regeneration 132, faults 438; `all` 1,211 (20.5 min). GS03 measured core at about 6 min cold and
5.2 min warm by CLI wall time, with about 1.5 GiB sampled peak memory; GS06 measured Media at
about 3.5 GiB. Reliability, from the GS01–GS09 handoffs: no final-source core failure other
than deliberate ones; one B10 failure (GS07), diagnosed above as the host clock.

| Gate | Recommendation |
| --- | --- |
| Pull requests and pushes to `main` | **core** (B01–B04), as the workflow already does: small, about 5 min, no timing windows tighter than its 15 s routing bound. After the owner publishes and the first hosted runs pass, the owner may make its check ("Generated backend behavior") required. |
| Weekly schedule | **all**, as now (40-min CLI bound, 50-min step, 60-min job). Not a PR gate: five times core's cost, the FFmpeg build (139 s cold) and the Keycloak/OpenSearch images, and faults' about-1 s kill margins and B10's clock dependence are unmeasured on hosted runners. |
| Manual | One suite, chosen from the fixture README's template table, before merging a change to that template. Not enforced. |

Keep `all` and faults non-required until several hosted weekly runs pass. Revisit after the
owner sees hosted durations; don't loosen a bound to fit a runner.

## Open template gaps

From [template gaps](../../template-gaps.md): multipart's 200/no state (1), the outbox relay
retrying a failing codec for ever (3), no key prefix for lifecycle/Transcoder hooks (4), the cache
read's unshaped 404 (7), no browser in the export (8); known limits: receipts kept for ever,
the relay's 10 rows a second, compiled host names, the template pool's missing error listener
and mounted templates' immediate retries. The export also reports an unfinished search mapping,
and there is no installed external-API client.

## Next focused units

1. **Template workers survive a database outage** (template unit). Add an `'error'` listener to
   the template pool and keep a store outage from spending a message's retry budget (wait and
   retry, or leave it unacknowledged until the database answers), with fresh exports and the
   processes-off pin review. Then extend B09's database row: the Counter stays up with no
   `pnpm start`, an idle-pool outage is included, and accepted work completes once.
2. **Outages of the remaining providers** (GS follow-up). Garage, OpenSearch and Keycloak stopped
   and restarted, and one application container disconnected from its network, each with
   bounded failures and recovery observed.
3. **Hosted CI check** (after the owner publishes). Record the first hosted core and manual
   `all` runs' durations and results beside this local evidence.

Deferred: exact commit/ack crash timing (needs a controllable boundary), Valkey data loss, token
expiry/refresh, and B10 with TTL margins wider than any expected clock step (a fixture design
change; only if the host clock can't be fixed).

## Owner decisions

- **Publish and gate.** Publish the commits, check the first hosted run, then decide whether
  core becomes a required status. Only the owner changes branch protection.
- **This host's clock.** The WSL2 VM's monotonic clock runs about 10% slower than Windows' and
  its wall clock is stepped +3.58 s every 32 s. The VM uses the `tsc` clocksource; switching to
  a Hyper-V clocksource may fix it (not tried: it changes the owner's machine). Until then B10 can fail
  here a few percent of the time, and any time measurement on this host reads about 10% short
  on the monotonic clock.
- **Next unit.** Whether to assign the database-outage template unit; it changes how template
  workers retry during a store outage.
- **Older image tags.** 83 `gs-…-app`/`-media` tags from GS01–GS08 remain. Each carries its
  run's Compose project label; remove them by exact name if wanted. GS09 left them alone.
