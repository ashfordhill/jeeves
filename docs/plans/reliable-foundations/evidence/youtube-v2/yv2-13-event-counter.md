# YV2-13 receipt-counter evidence

`local.event-counter` emits generic `src/runtime/{counter-sql,event-counter,counter-worker}.ts`.
[Actual APIs, identity boundary, ownership and remaining bindings](../../youtube-v2/interfaces.md#yv2-13--receipt-based-event-counts).
`createEventCounter` uses YV2-06 `createReceipts.withEffect` and the same caller transaction for
one receipt plus one increment. Identity is scoped by aggregate+event, preserving v1's composite
PK. Required adapter identity preserves meaningful data while omitting regenerated transport
timestamps. The wire decoder runs once; receipts validate a distinct internal envelope. Generic
text keys preserve case; canonical UUID aggregate/event/transport IDs remain YV2-15 adapter work.
Supplied transport IDs must exactly match derived event IDs, including with an unbound adapter.

`eventCounterPersistence` contributes actual schema/migration, private writer login/grants and
narrow public totals view; `eventCounterReadAccess` contributes only the explicitly named view
SELECT and separate reader login. Foundation normalized authority/published-read validation
remains enforced. Default dependency emission grants no SQL access. The emitter contributes
the actual selected consuming host/event resource to durable topic/failed topology. No labels,
private receipt credential, setup owner credential or normal field is inferred for a reader.

Three focused offline PGlite/delivery cases execute the emitted sources:

- Duplicate event with changed received time increments once; another event increments again.
  The same event ID counts separately in a second aggregate. `Manual:A` and `manual:a` remain
  distinct. A nested non-video notice codec uses a different normalized domain shape, proving
  receipt/worker revalidation does not feed normalized data back through a wire codec.
- Receipt+increment roll back together, conflicting stable semantic identity refuses, invalid
  keys and transport-ID mismatch refuse. Public totals read strings and absent totals read0.
- A held COMMIT prevents ack; close cancels admission, waits commit/ack, and drains once.
  Malformed input uses existing `MALFORMED_MESSAGE` confirmed failed-queue/ack behavior.
  Focused final log: three tests, one file,3.60s. No Docker/network in unit tests.

Two own deterministic **42-file** fresh exports use **notice-counter/manual-api/activity-db/
notice-events**, explicit **activity_private.{receipts,totals}** and
**activity_public.notice_totals**. The scratch source retains required dependency selections
for the public-read declaration; it claims no complete Watch application. Own frozen standalone
install (`--frozen-lockfile --ignore-scripts`) and **untouched emitted build pass**, then a
separately added typed nested-notice adapter compiles against the same emitted counter, reader,
worker and actual AMQP/Postgres client interfaces. It normalizes `{notice:{topic,number,
revision},accepted}` to `{topic,number,revision}` and excludes transport time from identity.
No copied algorithm or YouTube contract import is needed.

Small isolated real PostgreSQL/RabbitMQ probe uses the emitted migration runner and its actual
runtime logins/grants. Confirmed events pass through `createPublisher` → actual `createConsumer`
→ `startCounterWorker` → receipt/increment commit. Observed totals are **Manual:A=2,
Manual:B=1,manual:a=1**, four receipts after five valid messages, including a duplicate with a
changed accepted time. The generated public reader sees fresh totals; PostgreSQL denies its
private receipts, private totals, view writes and CREATE. Writer DELETE is also denied.
Malformed wire reaches the failed queue with `MALFORMED_MESSAGE`, attempt1. Consumer drains
normally, queue has no remaining messages/consumers, and caller closes both pools afterward.
This is a bounded DB/broker smoke, not a full first-run app or broad provider fault matrix.

Required **event-counter-application-bindings** and `applicationComplete:false` remain honest;
installed templates stay empty. YV2-15/16 own actual ViewPlayed qualification/codec and UUID
canonicalization, Watch API and fresh totals mapping, explicit source-bound SQL/service/runtime
construction, readiness and signals. No page/browser-time qualification, unique viewers,
analytics, fraud/score policy, arbitrary amount/aggregation DSL or new controls were added.
No media/cache algorithm, dependency or provider pin changed.

`pnpm check` passes lint/types and **454 tests/65 files,29.93s** (existing Biome info).
Native `pnpm test:e2e` passes **36 tests,1.3m**; web build passes **1.57s** (existing chunk-size
advisory). No UI changed; browser tests cover app load, TinyURL lane rendering and mouse
canvas/history/generation behavior. No assertion, timeout or pin was weakened.

Frozen v1 stays **108 identical paths/hashes**, manifest
`5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
Retained fixture stays15,584,953 bytes/SHA
`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`.
Root README including owner Future Benchmarks, feedback changes/deleted Unicode Zone.Identifier/
untracked colon variants and e2e-docker mode are preserved. All fourteen v1 services remain
healthy. No v2 field app, branch, worktree, stash or push.

Owned scratch project **jeeves-yv2-13-counts** used only **local-postgres/local-broker** and its
two volumes/network. Published loopback ports **45270/45271**; reserved **45272–45274** stayed
unused. Exact-project `down --volumes --remove-orphans` removed these resources; all five ports
are free. No image was created/removed; retained FFmpeg image and owner stacks remain intact.
Own exports/copies, dependencies, builds and private `.runtime` were removed before root checks.

Sanitized harness/logs under `/tmp/jeeves-yv2-13/`: `prepare.mts`, `notice-adapter.ts`, `probe.mjs`,
`compose.mjs`, `runtime-prepare.mjs`, `cleanup.mjs`, `focused-final.log`, `typecheck.log`,
`export.log`, `export-summary.json`, `install.log`, `build.log`, `build-adapter.log`,
`runtime-prepare.log`, `runtime-start.log`, `migrate.log`, `probe.log`, `probe-summary.json`,
`resources.json`, `cleanup.log`, `cleanup-files.log`, `cleanup-summary.json`, `check.log`,
`e2e.log`, `web-build.log`, `v1-path-hashes.json`, `fixture-after.log` and owner diff comparisons.
No secrets/media are retained in this evidence or harness.
