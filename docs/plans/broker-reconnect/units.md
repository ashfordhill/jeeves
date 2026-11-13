# Broker reconnect: a lost broker never stops a process

**Status:** planned 2026-11-12 from the owner's decision on follow-up 1 of the
[production foundations review](../production-foundations/review.md). Written by the
coordinator from the code at `24c9abb`; not yet checked by an independent reviewer. **Nothing is
implemented yet.**

There are 2 units, run in order: BR01 → BR02. A coordinator gives each unit to a fresh agent.
That agent does only its own unit on `main` in the primary checkout, commits it and stops.
GS07 of [generated system tests](../generated-system-tests/units.md) runs after BR02.

## Why

In PF13's F2a, stopping RabbitMQ made 12 of 16 application containers exit with code 1 and stay
down. Each broker publisher or consumer calls `onFatal` (`scope.fail`) when its connection or
channel closes, and `runProcess` ends the process when a transport's `closed` resolves. Watch's
details read, which needs only the cache and the database, answered 503 for the whole outage
because Watch also holds a publisher. Recovery needed `pnpm start` (F2b).

## Decision (owner, 2026-11-12)

Generated services reconnect to the broker, as PF07 made the cache do. After startup, a lost
broker connection never ends a process: work that doesn't need the broker keeps going, publishing
fails at once while the broker is away, consumers resubscribe when it is back, and each change is
logged. A restart policy, a broker cluster and replica counts stay deployment (D1).

## Not in this plan

| Item | Why not |
| --- | --- |
| A process started while the broker is down | Startup is unchanged: a first connect that fails still fails startup, and Compose starts processes after the broker is healthy. A later owner decision |
| A restart policy in the generated `compose.yaml` | Deployment (D1) |
| Growing backoff or jitter on reconnect | Fixed 5 s, as the cache; enough for one local stack |
| `pnpm start` returning the stack to one copy | Review follow-up 10, a separate decision |
| Outbox relay throughput, receipt retention | Open template gaps |
| Broker clustering, quorum queues | Deployment |
| GS07's fault suite | The generated-system-tests plan; it runs after BR02 |

## Rules for every unit

The production foundations plan's [Rules for every unit](../production-foundations/units.md#rules-for-every-unit)
2–8 apply as written, with these changes:

- **Rule 1:** read `AGENTS.md`; the last three entries of `docs/handoff.md`; this plan's
  Decision, Not in this plan and Rules; the production foundations Rules 2–8; then your own unit.
  Do not read or start a later unit.
- **Rule 4:** `field-projects/youtube/v4` is not protected; BR02 updates it as its unit says.
  Everything else in rule 4 stands.
- **Rule 9:** append one entry to `docs/handoff.md` in the same shape, then make one local commit
  with the unit's commit name. No `HUMAN_FEEDBACK` line. Don't push.

---

### BR01 — The broker client reconnects

**Goal:** `createPublisher` and `createConsumer` (`src/runtime/amqp.ts.template`) survive a lost
connection, a closed channel and a cancelled subscription. Each keeps one connection generation
at a time, reports every change through a new `onState` hook, and opens a new generation every
5 s until one succeeds. Their `closed` resolves only when they are closed on purpose, always with
`{ fatal: false }`, so no broker loss reaches `runProcess`. Startup is unchanged. Nothing else
about delivery changes: manual ack, prefetch, retries, `.failed`, confirms and drain stay.
**Checks:** check, e2e, build.
**Exported files this unit may change:** `src/runtime/amqp.ts`, `src/runtime/delivery.ts`,
`src/runtime/tile-loop.ts`, `src/runtime/tile-process.ts`, `src/runtime/module-clients.ts`,
`src/features/service-resources.ts`, and the process files under `src/processes/`.

**1. The hook.** In `amqp.ts.template` add and export
`export type BrokerState = (state: "available" | "unavailable", error?: unknown) => void;`.
Every call to it is guarded (a throwing hook changes nothing), and it is called only when the
state changes: `available` once a generation is open (after the first connect at startup, so
startup reports `available` once), `unavailable` with the error once that generation is lost.

**2. `createPublisher(binding, destination, hooks)`.** `hooks` becomes
`{ onState?: BrokerState } = {}` (it was `Pick<ConsumerHooks, "onFatal">`).

- A generation is one connection and one confirm channel. The first is opened as now; if it fails,
  `createPublisher` rejects as now and leaves no timer.
- The current generation is lost when its connection or channel emits `close` other than through
  `close()`. Then: report `unavailable`, close what is left of it, and try a new generation 5 s
  later, again every 5 s until one opens; report `available` when it does. Events from a
  generation that is no longer current, or after `close()`, are ignored.
- While no generation is open, `publish` rejects at once with `Error("Broker unavailable")`: it
  never waits for the confirm deadline or queues the message. A publish in flight on the lost
  channel rejects (amqplib fails its confirm, or the confirm deadline does).
- A rejected confirm on an open channel rejects that publish only, as now.
- `close()` clears the retry timer, settles the pending publishes, closes the current generation
  (and a generation still opening, once it opens) and resolves `closed` with `{ fatal: false }`.
  `publish` after `close()` still throws `AMQP publisher is draining`.

**3. `createConsumer(binding, options)`.** `options` takes `onState?: BrokerState` beside its
current fields; `onFatal` is no longer called by `createConsumer`.

- A generation is one connection, one confirm channel with `prefetch(concurrency, false)`, one
  `consume` on `options.queue`, and its own `createDeliveryRunner` whose transport is that
  channel. The first is opened as now; if it fails, `createConsumer` rejects as now.
- The current generation is lost when its connection or channel emits `close` other than through
  `close()`, when its subscription is cancelled (`consume` delivers `null`), or when its runner
  fails (a failed republish or ack). Then: report `unavailable` and call the runner's `fatal`, so
  it stops acknowledging and drains the deliveries in hand; their messages return to the queue
  when the channel closes and are delivered again (receipts and handlers already make that safe).
- The next generation opens no sooner than 5 s after the loss **and** only after the lost
  runner's drain has finished, so the deliveries in hand never exceed `concurrency`. If opening
  fails, try again every 5 s. Report `available` once the new `consume` succeeds.
- `close()` clears the retry timer and closes the current generation's runner as now (cancel,
  drain, close channel then connection); during an outage it waits for the lost runner's drain
  and opens nothing. `closed` resolves with `{ fatal: false }`.

**4. Comments that become false.** `delivery.ts.template`: the sentence "it provides no reconnect
or exactly-once promise" says the runner serves one channel and `createConsumer` reconnects with a
new runner; it still makes no exactly-once promise. `tile-loop.ts.template`: `startModuleLoop`'s
"A lost broker connection fails the process; nothing else does." `module-clients.ts.template`:
`queuePublisher`'s "A lost broker connection fails the process, as a loop's does." Each now says
the client reconnects. Change no behaviour in these files except step 5's hook.

**5. Wiring.** In `tile-process.ts.template` add:

```ts
/** A broker client's state hook: one failure line when it is lost, one info line when it is back. */
export function brokerState(tile: string, failure: FailureLog, what: string) {
  return (state: "available" | "unavailable", error?: unknown) =>
    state === "unavailable"
      ? failure(what, error ?? new Error("Broker unavailable"))
      : console.log(JSON.stringify({ level: "info", event: "broker", tile, what, state }));
}
```

(`FailureLog` is the type `createFailureLog` returns; use its existing name.) Every broker
publisher and consumer a generated process opens gets
`onState: brokerState(config.tile, failure, "<what>")`, where `<what>` is `broker publish <id>`
for a publisher (the exchange of a topic, or the work queue) and `broker consume <queue>` for a
consumer. Thread it as an optional last parameter or hook field through `publisher` and
`consumer` (`service-resources.ts.template`), `loopConsumer` and `startModuleLoop`
(`tile-loop.ts.template`) and `queuePublisher` (`module-clients.ts.template`), and emit it from
`http-wiring.ts`, `loop-wiring.ts` and `client-wiring.ts`. Every emitted
`onFatal: scope.fail` that is passed to a broker publisher or consumer is replaced by that
`onState`. `startMediaWorker`'s own `onFatal` and its `consumerHooks` stay; the transcoder's
`loopConsumer` call gets `{ ...consumerHooks, onState: … }`. Keep every `scope.transport(…)` line:
`closed` now resolves only while the process drains.

**Tests** (a new `jeeves-generator/src/v2/amqp.test.ts`: the emitted `amqp.ts` and `delivery.ts`
on a fake `amqplib`, loaded as `positive-cache.test.ts` loads `valkey.ts` on its fake `redis`,
with fake timers):

1. Publisher: when the connection closes, `onState("unavailable", error)` once; `publish` then
   rejects at once with `Broker unavailable`; `closed` stays pending. No new connection before
   5 s; one at 5 s; if it fails, the next at 10 s; when one opens, `available` once and `publish`
   resolves on the fake confirm. At most one connection is open at any time.
2. Publisher: a publish waiting for its confirm when the channel closes rejects, no later than the
   confirm deadline.
3. Publisher `close()`: during an outage, advancing time opens no connection and `closed`
   resolves `{ fatal: false }`; while a new generation is opening, that connection is closed as
   soon as it opens.
4. Consumer: with one delivery in hand, the connection closes: that delivery is never acked or
   republished on the old channel, `unavailable` once, and no new connection opens until the
   handler settles **and** 5 s have passed. The new generation has the same prefetch and queue,
   `available` once, and a delivery on it is handled and acked on the new channel.
5. Consumer: a cancelled subscription (`consume` delivers `null`) is a loss as in 4; the old
   connection is closed.
6. Consumer: a failed republish (a handler throws, the retry publish's confirm fails) ends that
   generation without an ack; the consumer reconnects; the hook passed as `onFatal` is never
   called.
7. Consumer `close()`: running normally, it cancels, drains and closes as before; during an
   outage, advancing time opens no connection. Both resolve `closed` with `{ fatal: false }`.
8. An `onState` that throws breaks neither `publish` nor a reconnect.
9. Startup is unchanged: a first connect that fails rejects `createPublisher` and
   `createConsumer`, and advancing time afterwards opens no connection.
10. Wiring: the YouTube v3 design's export (as `youtube.test.ts` exports it) has, in every process
    file, one `brokerState(` per broker publisher and consumer, and no `onFatal: scope.fail` passed
    to `loopConsumer`, `startModuleLoop`, `publisher`, `consumer` or `queuePublisher`.

Tests that assert a lost broker connection ends the process, or that emitted lines pass
`onFatal: scope.fail` to a broker client, are this unit's to update: list each in the handoff
entry. If any other test fails, stop (rule 2).

**Docs.** `jeeves-generator/README.md`: the paragraph that says a lost broker connection makes the
process drain and exit 1 until `pnpm start` now says it reconnects every 5 s, keeps serving what
doesn't need the broker, and answers 503 for a publish while the broker is away; the Failure lines
list gains `broker publish <id>` and `broker consume <queue>` and the
`{"level":"info","event":"broker",…,"state":"available"}` line; `process-failed`'s example is no
longer "a lost broker connection". `docs/template-gaps.md`: the row "A process that loses its
broker exits and is not restarted" has Status `Fixed in BR01`.

**Done when:** the three checks pass, and
`grep -rn "onFatal: scope.fail" jeeves-generator/src/v2/*-wiring.ts` lists no line passed to a
broker publisher or consumer.
**Commit:** `BR01: broker clients reconnect`.

### BR02 — v4 takes BR01 and survives a broker outage

**Goal:** YouTube v4 takes BR01 through `update:v2`, keeps every file the application owns, and,
in one Docker run with two copies of each process, stops no process while the broker is away and
recovers without `pnpm start`. **Change no template or runtime code.** If a step fails, record
exactly what happened and go on.
**Checks:** none (evidence and notes), plus v4's own build and tests.
**Project and ports:** `COMPOSE_PROJECT_NAME=jeeves-br02`, `LOCAL_HTTP_PORT=45820`,
`LOCAL_IDENTITY_PORT=45821`, `LOCAL_OBJECT_PORT=45822`. The production foundations Phase E Docker
rules apply, with the images `jeeves-br02-app` and `jeeves-br02-media`.

**Regenerate.**

1. Export into scratch: `pnpm --filter @jeeves/generator export:v2 "$PWD/field-projects/youtube/v4/inputs/design.json" "$SCRATCH/generated"`
   (0 findings), then replace `field-projects/youtube/v4/generated` with it
   (`rm -rf field-projects/youtube/v4/generated && cp -a "$SCRATCH/generated" field-projects/youtube/v4/generated`).
   `git status --short field-projects/youtube/v4/generated` must list only BR01's exported files,
   `.jeeves/manifest.json` and `.jeeves/report.json`. If it lists anything else, stop (rule 2).
2. `pnpm --silent --filter @jeeves/generator update:v2 "$PWD/field-projects/youtube/v4/inputs/design.json" "$PWD/field-projects/youtube/v4/app" --check`:
   `refused`, `create`, `remove`, `orphan` and `keepChanged` empty; `replace` only BR01's exported
   files and `.jeeves/report.json`; `override` the same four paths as PF11. Otherwise stop
   (rule 2). Then run it without `--check` and save the output as
   `field-projects/youtube/v4/notes/update-br02.json` (`biome format --write` it).
3. `git status --short field-projects/youtube/v4/app` must list only paths that v4's manifest
   records with an ownership other than `generated-extension`, plus `.jeeves/manifest.json`. If
   it lists a hook, a stub body, product SQL or any file outside the manifest, stop (rule 2).
4. Copy `v4/app` to `$SCRATCH/check` and run there: `pnpm install --frozen-lockfile --ignore-scripts`,
   `pnpm build`, `node --test "test/*.test.ts"`: 19 tests pass. Delete the copy.

**Run.** Set up as PF12's Setup steps 1–4, with this unit's project name and ports in `env.sh`,
except that step 1 copies the updated working tree (`cp -a field-projects/youtube/v4/app "$SCRATCH/app"`)
instead of `git archive HEAD`, since steps 1–3 aren't committed yet. Expect 15 healthy containers. Upload the
fixture and wait for ready (`node upload.mjs r-a fixture:<word>`, `node pf.mjs ready r-a-ready <id>`):
this is **A**. Run PF12's Part B scale command; wait for 23 healthy containers. Before each step
record a boundary (`date -u +%Y-%m-%dT%H:%M:%SZ`) and read logs since it.

| Step | Do | Expect |
| --- | --- | --- |
| O1 | `docker stop jeeves-br02-local-broker-1`; wait 20 s; `docker compose --profile '*' ps -a` | Every `app-*` container still running; none exited. Each broker-using container's log has a `"event":"failure"` line whose `what` starts `broker ` |
| O2 | `node pf.mjs details o2 <A> 10`; `node pf.mjs search o2-search <word> <A>` | 200 every time; `found` 1 |
| O3 | Send one play by API with a new event ID `<E>` (`POST /api/watch-api/modules/watch-api-view-publisher/<A>`, body `{"eventId":"<E>"}`; record the command) | 503 `UNAVAILABLE`, within 6 s |
| O4 | `docker start jeeves-br02-local-broker-1`; wait up to 30 s | Each container that logged a `broker` failure logs `"event":"broker"` with `"state":"available"` for the same `what`; `docker compose --profile '*' ps` shows 23 healthy; `docker inspect -f '{{.RestartCount}}'` is 0 for each `app-*`; `pnpm start` is never run |
| O5 | Send O3's play again with the same `<E>`; then `node pf.mjs plays o5 <A> 20` | 202; the count rises by exactly 1 for `<E>`, then `counts.settled` equals `counts.expected` |
| O6 | `node upload.mjs o6 fixture:<word2>` (**B**); `node pf.mjs ready o6-ready <B> 180`; `node pf.mjs search o6-search <word2> <B>`; `select count(*) from published.videos where video_id='<B>'` | B ready; `found` 1; count 1 |

**Record.** Add a "Broker outage after BR01" table to
`field-projects/youtube/v4/notes/scenarios.md`, and raw outputs under
`docs/plans/broker-reconnect/evidence/br02/` with a `README.md` (secrets checked, anything over
100 KB gzipped, as PF12). In `field-projects/youtube/v4/notes/README.md`, say that v4 now also
carries BR01, with the counts from `update-br02.json`. Clean up as PF13 did and compare the
Docker inventory with the one you recorded first.

**Commit:** `BR02: v4 survives a broker outage`.
