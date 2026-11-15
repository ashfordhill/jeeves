# QG09: generated-system tests for Pub/Sub channels

`pnpm test:generated --suite=pubsub` runs the Pub/Sub fixture
(`field-projects/generator-system/fixtures/pubsub/`) against the pinned emulator, with the
harness's scoping, cleanup and evidence rules. Run on 2026-11-14 (log stamps are UTC,
2026-11-15) from `b4003fc` plus this unit's working tree, source SHA-256
`28b55c180ead52fc8da56049168f692ab4151738b71677ebe9d2838c39cf057a` (`pubsub/source.json.gz`).
QG09's folded template changes F1–F3 are in that tree: each export's own `pnpm-workspace.yaml`
(`allowBuilds: { protobufjs: false }`), `METADATA_SERVER_DETECTION: none` for each local service
that publishes to or consumes a topic, and the gRPC reconnect options 500/2000 ms on every
`new PubSub(`.

`pubsub/` is the final run's artifact directory as the harness wrote and sanitized it (logs and
the larger JSON gzipped; `pnpm format` reflowed the JSON). Each stack's row file holds its observations: `p7-fresh-start.json`,
`p1-p3.json`, `p2-p6.json`, `p4-kill-boundary.json` and `p4-p5.json`.

## The fixture

Clicks API (public) has the Record stub, which publishes `{ value }` to Clicks with the click's ID
as `messageId`. Clicks is a queue only stubs use, saved with provider Google Cloud, so it is a
Pub/Sub topic. Tally (a Worker, Concurrency 1) has the Count stub on its subscription
`clicks--tally`; Count records each delivery in `m_count.deliveries` (ID, attempt, worker), then
counts the click once by its ID in `m_count.clicks` (`ON CONFLICT DO NOTHING`). An `ni-` click
throws "Not implemented" before any write; a `retry-` click records its delivery and throws a
retryable error. `integration/author-pubsub.ts` holds the studio commands that made the design.

The harness reaches the emulator, which publishes no port, through its REST API from inside Clicks
API's container (`PUBSUB_EMULATOR_HOST`, `JEEVES_PUBSUB_PROJECT` from that container's own
environment): it creates a capture subscription `clicks--gs-capture` on the topic and pulls
`clicks--tally.failed`, acknowledging what it pulls. Faults are `docker pause`/`unpause` of
`local-pubsub`, `docker kill`/`start` of `app-tally` and `docker stop`/`start` of
`local-postgres`, each on the one container the exact project label names.

## Rows and observed times (final run)

Three stacks, each a fresh export, install, build and `first-run`.

| Row | Result |
| --- | --- |
| P8 | Each stack installed its fresh export with `pnpm install --frozen-lockfile` (no `--ignore-scripts`): exit 0 in 0.3 s, three times. |
| P7 | Subscriber probe (Tally's database probe line to its subscription probe line): 77, 53 and 54 ms. First publish: 43, 24 and 23 ms (202). Clicks API's topic probe, from its container's start (Node's start and imports included): 486, 499 and 547 ms. |
| P1 | `p1-a`, `p1-b`, `p1-b`, `p1-c` answered 202; the capture held exactly those four messages, each with its body and `messageId` attribute. Count recorded two `p1-b` deliveries (attempt 1 each) and counted each click once. |
| P3 | `.failed` held exactly `ni-p3` (`x-terminal-code: NOT_IMPLEMENTED`) and `retry-p3` (`RETRY_EXHAUSTED`), each with its body and attributes. `retry-p3` was delivered with attempts 1, 2, 3, 4, 5, 6. Neither was counted. |
| P2 | Emulator paused: two publishes answered 503 in 1,004 and 1,003 ms (Clicks API's 1000 ms request deadline answers before the publisher's own 2000 ms), `/healthz` 200 in 2 ms. Clicks API's only failure lines were `request POST /modules/record`. Unpaused: the first 503's click sent again answered 202 74 ms after the unpause began. No process exited or restarted. |
| P6 | Paused 60,165 ms; the six clicks sent every 10 s answered 503 in 1,003–1,004 ms. The first of them sent again answered 202 **76 ms** after the unpause began; Tally had counted the backlog (the six sent again and three new) **1,034 ms** after it. Tally logged no error line in P2 or P6. No process exited or restarted. |
| P4 | Count's delivery record waited at the gate 4 ms after its click committed; Tally was killed (`docker kill`, 359 ms) and the same statement was still waiting 462 ms into its 2,000 ms statement timeout, which then ended it uncommitted. After `docker start` the click was delivered again with attempt 2, 8,205 ms after the start began, and counted once. `.failed` stayed empty. |
| P5 | PostgreSQL stopped for 6,551 ms; `p5-0`, `p5-1` and `p5-2` answered 202. Tally logged `store unreachable, retry in 5000 ms (attempt not counted)` for `p5-0` with attempt 1, first seen 683 and 6,081 ms after the stop; `.failed` stayed empty. All three were counted 5,685 ms after the start began, each with one delivery, attempt 1. No process restarted. |

## A redelivery while a click is held

In the development run, and in one of three scratch reproductions (a `qg09-` stack, PostgreSQL
away for about 20 s), a click held in the unreachable-store wait was also delivered again while it
waited: after the restore Count recorded `p5-0` with attempts 1 then 2, and in the reproduction
`x-1` (held back by flow control) with attempts 1, 2 and 3. The held copy kept attempt 1 and ran
first, and each copy counted once. With the SDK's own logging on (through the export's
`compose.override.yaml`), two further reproductions showed no copy: the client sent its lease
extensions for the held messages at most 8.9 s apart, against its 10 s stream deadline. So a lease can lapse, and Pub/Sub
then delivers the message again with a later attempt (at least once); the run that lapsed was not
logged, so the trigger isn't pinned. P5 therefore asserts that the held click's first delivery has
attempt 1 and that each click counts once, and records every delivery.

## Against HEAD's templates (QG08)

`head-templates/` is the same suite run from a scratch clone at `b4003fc` with its own offline
install, the new harness, scenario and fixture copied in and HEAD's templates and generator source
unchanged (source SHA-256 `785c80d8…358c`). 0/3 passed: every stack's setup failed at P8, the
export's plain `pnpm install --frozen-lockfile`, with `ERR_PNPM_IGNORED_BUILDS` (`Ignored build
scripts: protobufjs@7.6.6`), before any container started (8.8 s). That is F1's row.

P7 measured by hand on the same HEAD-template export (installed with `--ignore-scripts`, project
`qg09-head`, removed after): Tally's subscriber probe passed **3,067 ms** after its database probe
(`head-templates/p7-probe-lines.log`), over P7's 2.0 s, while the first publish answered 202 in
24 ms. That is F2's effect. P6 passed in the development and final runs with F3 in place; a paused
emulator keeps its TCP connections, so no reconnect was needed, and the run doesn't show F3's
reconnect bound at work.

## Other suites

`--suite=core` 4/4 (310.6 s) and `--suite=wiring` 2/2 (189.7 s), on the same source as the final
pubsub run (`core/`, `wiring/`: summary, identity, cleanup and Vitest results).
