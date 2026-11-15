# QGR2 review: QRWTY gap batch 2

Reviewed 2026-11-14 from `78371fe` by an agent that implemented none of QG03, QG04, QG06, QG24,
QG07, QG08, QG09, QG10, QG18 or QG20. Read: `AGENTS.md`; the plan's batch headers, Rules,
Regeneration proof and the ten briefs (QG24's in [review-batch1.md](review-batch1.md), QG09's folded
F1–F3 in `units.md`); every batch-2 handoff entry; `git diff b55644a..HEAD` and `git log --oneline
b55644a..HEAD`, treating `d469660`, `a7c4b0d`, `423acbd` and `b4003fc` (docs) and the owner's
`abe2d8d`, `fe27ab6`, `efca408`, `516c142`, `c6797ca` and `fefc74f` (README and `.docs`) as not
units, and the owner's `6a21cfc` as QG07's source together with `2625d96`. Probes: the installed
`@google-cloud/pubsub` 6.3.2 (`subscriber.js`, `lease-manager.js`, `message-stream.js`,
`default-options.js`) and `URL.parse` on Node 24, the regeneration proof across the whole batch, the
read-only `update:v2 --check` of YouTube v4, and one Docker proof of my own on the probe export
(Runs). **One defect is fixed here** (QG20's Identity client, below); everything else is recorded.

## Verdict

The ten units do what their briefs ask. Their invariants hold, their pins and emitted-output lists
are exact (the union of the lists is exactly what the whole batch changed in both fixtures), and
they compose in the shared runtime files: `module-clients.ts` carries QG04, QG06, QG07, QG08, QG09's
F3, QG10 and QG20 as one file with one endpoint reader, one TLS reader and one HTTP client core.
The one thing that did not work as exported was QG20's Identity client, which read the browser's
issuer and so could never reach Keycloak locally; its base is now `JEEVES_IDENTITY_<ID>_URL`,
Keycloak's address inside the network, proved on the probe stack. The rest are limits,
interactions and two Pub/Sub consumer behaviours worth a unit each, under Findings and Proposed
units. This commit is QRWTY arm A's frozen generation baseline; what Q05 must know is at the end.

## Checks

| Check | Before (`78371fe`) | After (this tree) |
| --- | --- | --- |
| `pnpm check` | exit 0: 117 files / 1012 tests; Biome only the older 1 info (1 min 7 s) | exit 0: 117 files / 1012 tests; Biome only the older 1 info (1 min 16 s). The fix changes seven existing tests' assertions and adds no test, so the count is unchanged. (A first run on the fixed tree failed only `tsc`, on one assertion of mine that read a field the test's `Service` type lacks; rewritten as `toHaveProperty`, before this run.) |
| `pnpm test:e2e` | 74 passed (4.7 min), alone | 74 passed (4.7 min), first run, alone, before the Docker phase (after the fix's template and generator changes; before the one-line test type fix, which no e2e test reads) |
| `pnpm --filter @jeeves/web build` | — | exit 0 |
| The fix's tests on HEAD's templates | A scratch clone at `78371fe` with its own offline install and the two changed test files: **7 fail** (`module-clients.test.ts` 4: the Identity client's marked rejection, its base, the unset/invalid names, the switch; `client-wiring.test.ts` 3: the probe's process lines, the Compose environment, the stores row and README). The clone is deleted. | all pass |
| `pnpm test:generated --suite=all` | — | Run 1: **15/17 passed** (Vitest 1,542 s, 23:11–23:37), its first three minutes beside my proof stack's image build and Keycloak start. The two failures are the packet's known flakes, both rerun alone and passed: **B06 recovery** (`faults.system.test.ts:87`, `expected +0 to be 1`: after the stall the refill's next read wasn't a hit, QG04's note on the 4 s TTL expiring during the harness's steps under load) and **B10**'s clock (`fresh-b: expiry outside independent bounds`, `elapsedMs` 12,355, `pttl` -2). `--suite=faults` alone: 5/5 (B06 recovery, B09 counter, broker, database, media; 9.2 min). `--suite=regeneration` alone: 1/1 (B10, 2.7 min). First time in run 1: core 1, core-delivery 3, wiring 2, identity 1, media 1, faults-media 1, faults 3 of 4, pubsub 3 (P1–P8). So every suite passes on this tree. |
| Docker proof (mine) | — | Runs, below: QG20's fixed client and QG04's cache rows on the probe export |
| Regeneration proof, whole batch | `probe-design.json` (`a3b6204f…0505`, verified) and `qrwty-r83.json` (`4c16e0ca…5d50`) exported from a scratch clone at `b55644a` (its own offline install) and from this tree. Probe changed exactly: `.jeeves/manifest.json`, `.jeeves/report.json`, `README.md`, `compose.yaml`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (new), `scripts/local.mjs`, `src/features/service-resources.ts`, `src/processes/front.ts`, `src/processes/tally.ts`, `src/runtime/delivery.ts`, `src/runtime/module-clients.ts`, `src/runtime/postgres.ts`, `src/runtime/tile-loop.ts`, `src/runtime/valkey.ts` (new). r83 the same with `account-api.ts`, `analytics-worker.ts`, `billing-api.ts`, `link-api.ts` and `session-api.ts` in place of the probe's two (`redirect-service.ts` is unchanged: its client calls did not change). That is exactly the union of the ten **Emitted output** lists plus manifest and report; `infra/local.json` and `scripts/pubsub-init.mjs` do not appear because neither fixture has a Pub/Sub topic. `compose.yaml` differs only by added `environment` keys on `app-*` services (QG06's endpoints and QG10's `_TLS: disable`; QG20's Identity variable on the probe's Front and r83's Session API, which also lost `OIDC_ISSUER` by the fix). The lock is byte-identical to the asset's (`3eee9f4b…d61b`). In each `after-*`: `pnpm install --frozen-lockfile --ignore-scripts --offline` and `pnpm build` exit 0, and a plain `pnpm install --frozen-lockfile --offline` (F1) exits 0 with the lock unchanged. Compared with HEAD's own exports, the fix changed only `src/runtime/module-clients.ts`, the Identity-calling process file, `compose.yaml`, `README.md`, the report and the manifest: inside QG20's list. | |
| Pins | `processes-off.json`: `frozen-v2` and `v2-module-design` changed `.jeeves/manifest.json`, `README.md`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (added), `scripts/local.mjs`, `src/features/service-resources.ts`, `src/runtime/delivery.ts`, `src/runtime/postgres.ts`, `src/runtime/valkey.ts`; `stub-stack` the first six. Exactly the units' pin lists (QG03, QG04, QG06, QG07, QG09 F1, QG10, QG18). The fix changes no pin: `processes-off.test.ts` passes as it is. | |
| Docker inventory | Recorded before any work (22:42) and after the Docker phase (00:04): containers, networks and volumes identical line for line; images differ only by eleven `us-central1-docker.pkg.dev/…/qrwtyb/*:b09b-1` tags that arm B removed meanwhile (not touched). `jeeves-postgres-1` is up and unchanged; no `qgr2-` or `gs-` resource and no `/tmp/jeeves-system-*` is left; every suite wrote its artifacts to the scratchpad, so `test-results/generated/` keeps only its 10 older folders. | |

## Each unit against its brief

**QG03.** `local.ts` emits `package.json`, `pnpm-lock.yaml` (and since QG09 `pnpm-workspace.yaml`)
as `generated-extension`, bytes unchanged; the Dockerfile still copies the two and installs with
`--frozen-lockfile --ignore-scripts`. The points raised, verified: `update:v2 --check` of YouTube
v4's app against `v4/inputs/design.json` answers `refused: []`, `keepChanged: [package.json,
pnpm-lock.yaml]`, `override: [.gitignore, compose.yaml, infra/edge/nginx.conf]` and `create: 1`
(the new workspace file), so v4's `package.json` override is inert (finding 15); `AGENTS.md` is
unchanged, as the owner's decision did not ask for "and its package manifests"; a template's later
pin change reaches an existing export only as `.jeeves/generated/package.json` and
`pnpm-lock.yaml` to merge by hand (finding 15).

**QG04.** `cacheClient` is `createValkeyCache` with the stub's `cache-<id>` secret; `ValkeyCache`
has `get`, `set` (`{ PXAT }`, `{ EX }` or none), `delete` and `ping`, each through the 150 ms bound
with 32 queued, a lost generation destroyed and retried every 5 s, `close()` destroying the client.
The probe is a bounded `PING` logged `ok` or `warn`/`unavailable`, and startup goes on (decision
3). Rerun under Runs: a paused cache answers 503 in 0.169 s (the stub's `Cache deadline` through
the fallback 503) and the next request in 0.001 s (`Cache unavailable`), the client comes back by
itself after the unpause, and a Front restarted with the cache stopped is healthy, logs the
`warn`/`unavailable` probe line and answers 302. The points raised hold: the process files' comment still says "a failed
probe fails startup" (finding 10), and so does `docs/plans/tile-processes/contract.md` §6 (a plan,
not a Rule 8 doc); Compose `depends_on` still waits for the cache, so only a restarted process runs
without one.

**QG06.** One reader (`endpoint`, `host`, `port`, `url`) in `module-clients.ts`, `endpointHost` /
`endpointPort` in `service-resources.ts`, `cacheEndpoint` in `valkey.ts`; `localEndpoints` gives
Compose, the report and the README the same rows; no `local-postgres`, `local-broker`, `cache-<id>`
or `app-<id>:3000` literal is left in a client, except the one noted below. The points raised:
`loop-wiring.ts` changed outside the brief's Files, rightly, because every loop consumed through
`tile-loop.ts`'s compiled `loopBroker` and the process files now pass `brokerBinding()`; that
compiled default is still in `tile-loop.ts` (`local-broker:5672`), used by no generated process
(finding 9). `positive-cache-bindings.ts` keeps its compiled `hostname`/`port`, now unused by any
process. Object storage and search are still compiled (`http://local-objects:3900`,
`http://search-<index>:9200`; template-gaps row).

**QG24.** In the emitted guarded process the setup lines read: the `OIDC_AUDIENCE` check (QG11's
message) first, then `signInUrl` for the issuer and key set, inside the guard's IIFE, which runs
after the clients object with its awaited probes. So with everything unset the audience's line
comes first, and a missing store fails before a missing `OIDC_*`. Verified on Node 24: `URL.parse`
strips leading and trailing C0 controls and spaces, so `"http://a.example/realms/x\n"` passes with
`protocol` `http:`; the value then fails every token on `iss` with 401s (finding 18; QG06's URL
rule shares it).

**QG07.** Reviewed across `6a21cfc` and `2625d96`. The resolver's `stubQueueSettings` gives a
stub-only queue a normal `queue.provider` control (`unspecified`, `self-hosted`, `google-cloud`)
when processes are installed, and leaves a template's queue fixed; `stubPubsub` marks the store,
`local.ts` provisions the `pubsub` resource kind (never the broker's), the emulator service at the
pinned digest with `curl` health on 8085 and no port, `setup-pubsub` before the application, and
`infra/local.json`'s plan with `ackDeadlineSeconds` 60, retry 1–10 s, dead-letter after 100 and the
`.failed` pull subscription. `pubsubPublisher` resolves after `publishMessage`, with the
`messageId` attribute, `gaxOpts.timeout` 2000 and its own 2000 ms timer, 1000 outstanding,
`topic.exists()` as the probe, and a drain that waits for outstanding publishes. The lock: 79
packages added; the only `-` lines are the six redis snapshot keys, which reappear with the
optional peer `@opentelemetry/api@1.9.1` (redis loads it only in `OpenTelemetry.init()`); no other
existing entry changed. The points raised: the 20 pre-existing entries under 14 days old predate
the batch and were exempted, so AGENTS.md's rule was applied to the new entries only (finding 16);
the two studio changes outside the brief's Files (`InspectorForm`'s select narrowing and Preview's
"Provisioned as") were needed by the mouse check and by AGENTS.md's shared-choices rule, but the
narrowing is general to every select whose control has `values` (finding 14); delivery is
at-least-once under Front's 1000 ms request timeout, since a publish the admission abandons at
1000 ms keeps running to its 2000 ms deadline and can land (QG07's `b2`; finding 2).

**QG08.** `pubsubLoop` is a `LoopTransport` with `retries: "transport"`; `pubsubConsumer` opens one
streaming-pull subscriber with `flowControl: { maxMessages: concurrency, allowExcessMessages:
false }`, maps `ModuleMessage` as the brief says (`deliveryAttempt` below 1 counts as 1), acks only
after the handler, nacks a retryable failure at once, copies a terminal message to `.failed` within
2000 ms before acking (nack on a failed copy), waits out an unreachable store with the same message
and attempt (nack when closed during the wait), reports a subscriber error once and reopens 5 s
later after the messages in hand settle, and drains by settling the handlers in hand and then
closing the subscription. I checked the SDK's `Subscriber.close()` (6.3.2): its default
`NackImmediately` behaviour nacks every message still in inventory, including ones already
dispatched, after destroying the stream; because the template settles its in-flight handlers
before calling it, those are acked first and only the held-back ones are nacked, which is what the
handoff claims. The points raised: several loop stubs of one tile share one subscription (finding
5); Pub/Sub counts every redelivery as an attempt (finding 3); the drain does not use
`WaitForProcessing`, rightly, since that waits on messages never handed over; a consuming tile's
`compose.yaml` and README change beyond the brief's list, a recorded deviation that neither fixture
shows.

**QG09.** F1: the asset `pnpm-workspace.yaml` (`allowBuilds: { protobufjs: false }`) emitted as
`generated-extension` in every export; the plain install passes (verified on both after-exports).
F2: `METADATA_SERVER_DETECTION: none` through `localEndpoints` for a service with `pubsub`. F3: the
`pubsubChannel` constant spread into both `new PubSub(` of `module-clients.ts` and inline in
`pubsub-init.mjs`; `ClientConfig` has no `grpc.*` key, so the spread is how it type-checks. The
suite: `pubsub.system.test.ts`, three stacks, P1–P8, with the emulator's REST API reached from
inside a stack container and pause/unpause on the one `local-pubsub` container the project's label
names. The points raised: a held message can be redelivered (finding 3; `minAckDeadline` is unset:
the SDK starts its client-side deadline at 10 s and extends at 90 % of it less latency, with
jitter); F3 changed `pubsub-init.mjs`, within "every `new PubSub(`"; `pnpm-workspace.yaml` is the
application's, consistent with QG03, with a Dockerfile consequence (finding 6); P6 shows recovery
after a pause, not the reconnect bound (finding 4).

**QG10.** `postgres.ts` gets `ssl: false` for `disable` (so `PGSSLMODE` cannot change it) and
`{ rejectUnauthorized: true, ca?, servername?, checkServerIdentity? }` for `verify-full`; the
`checkServerIdentity` override is needed because pg 8.23.1's `upgradeToSSL` replaces `servername`
with a host name. `valkey.ts` passes `tls: true, rejectUnauthorized: true, ca, servername` to the
socket. `transport()` reads `_TLS` with no default, `_CA_FILE` and `_TLS_SERVERNAME` only with
`verify-full`, fails `Unreadable CA file <variable> (<code>)` without the path, and under
`JEEVES_REQUIRE_TLS=true` refuses `disable` (not a socket directory), a non-`https:`
`JEEVES_TILE_*`/`JEEVES_EXTERNAL_*`/`OIDC_*` URL and any `PUBSUB_EMULATOR_HOST`; an invalid switch
value fails by name. Compose sets `disable` everywhere. The points raised hold and are limits: the
broker, object storage and search stay plain text (R8 and the compiled names); a cache whose
certificate is refused is unavailable, not fatal (finding 12); Node's `checkServerIdentity` can't
match a `project:instance` name (finding 13); `migrate.mjs` follows `PGSSLMODE`, which pg maps to
`ssl: true` with Node's roots only, so a private CA can't be verified there (finding 11).

**QG18.** `unreachable()` matches a message that is exactly `Query read timeout` on the error or
its `cause` chain; both callers still exclude a `NonRetryable`. The brief's "false for a
`NonRetryable` wrapping it" was read where the decision is made (the delivery runner), because
`unreachable()` has never looked at `NonRetryable`; the test shows such an error ends the message
at once. The catch the owner accepted stands: a stall that never ends cycles every 5 s per held
message. The faults suite passed on QG18's tree and again here (B09 database, the stopped
server's `57P01`/`ECONNRESET` path, and the other four rows, in the rerun alone).

**QG20.** `target(name, internal)` is the shared core; `httpTarget` is unchanged in behaviour,
`externalTarget(base)` is unmarked, `identityTarget` is marked; `outsideClient` emits them for an
`HttpTarget` link to an External API or to an Identity a sign-in binds, and `unavailable` stays
for a token check, an Identity no sign-in binds, CDNs and tiles that run no process. Compose sets
no `JEEVES_EXTERNAL_*`, so a process fails startup until the application sets it (the wiring
fixture now sets Partner's in its own `compose.override.yaml`, through a harness `override` role
that admits only that file when the manifest does not list it). The points raised: **the Identity
client could not reach Keycloak locally**: its base was `OIDC_ISSUER`, which Compose must set to
the browser's issuer (`http://127.0.0.1:$LOCAL_IDENTITY_PORT/realms/<id>`, what a sign-in
compares `iss` with), and inside a container that is the container itself. Decided and fixed here
(The fix, below). The report's `environment` omits `JEEVES_EXTERNAL_<ID>_URL` (finding 7).
`delivery.ts`'s comments still name only `httpTarget` as marking (finding 8).

## Interactions

- **`module-clients.ts.template`** (QG04, QG06, QG07, QG08, QG09 F3, QG10, QG20): one file. The
  endpoint reader is shared by every client; `requireTls()` is read where each endpoint is read, so
  a process with no endpoint never checks the switch, and an invalid switch value fails before the
  `_TLS` value. Clients are built in the order of the `clients` object (sorted keys), so a stub
  tile's validation of a later client's variable follows an earlier client's probe (QG06's note).
  `refuseEmulator()` sits before each `new PubSub(`; F3's `pubsubChannel` is spread into both.
- **`valkey.ts.template`** (QG04, QG06, QG10): `cacheEndpoint` (the cache read's) and
  `transport()` (the stub's) read the same variables with the same rules and messages;
  `createValkeyCache` treats a binding without `tls` as plain TCP (untyped callers only).
- **`tile-loop.ts.template`** (QG06, QG08, QG18): `startModuleLoop` takes a transport or a broker
  binding; `failureStep` is one rule for both runners and `storeUnreachable` carries QG18's match
  to the Pub/Sub loop; `moduleHandler` skips the retry wait when the transport spaces retries.
- **`postgres.ts.template`** (QG10 with batch 1's QG17): `query_timeout` and `ssl` in one options
  object; QG10's tests assert QG17's values with `ssl: false`.
- **`http-wiring.ts`** (QG06, QG24, QG10): the cache read binds `cacheEndpoint(resource)` with the
  bindings' secret; the guard's setup validates the switch and the two URLs by name.
- **`compose.yaml`** (QG06, QG07, QG09 F2, QG10, QG20, with batch 1's QG11): one `environment`
  map per service from `localEndpoints` plus the sign-in's `OIDC_*`; the report's
  `processes.tiles[].environment` and the README's per-process list are the same keys, so the three
  can't drift (QG06's test); the fix keeps that by adding the Identity's variable to
  `localEndpoints`.
- **QG08 + QG18 + QG09's lease:** a Pub/Sub loop waiting out a stalled database (QG18's
  `Query read timeout`, 5 s per cycle) is exactly the case in which a lease lapse redelivers the
  held message (finding 3).
- **QG20 + QG10 + QG24:** three readers of `OIDC_ISSUER`'s shape existed (the guard's `signInUrl`,
  QG06's `url` rule, and the Identity client); after the fix the client reads its own variable by
  QG06's rule, and the two rules differ as QG24 recorded (QG24's accepts a query and credentials).

## The fix: a stub's Identity client reads `JEEVES_IDENTITY_<ID>_URL`

**Decision.** QG20's brief named `OIDC_ISSUER` as the base. That value must stay the browser's
issuer, because a sign-in compares tokens' `iss` with it, and locally that address is unreachable
from a container, so the generated client could never work in a local stack: the probe's Front
answered 503 (QG20's proof), and QRWTY r83's Session API (Sign-in flow, API forwarding; its only
link to the Identity) could not have exercised its Identity calls in Q07 as exported. A tile with
a sign-in and such a stub has no application-side workaround at all, and Session API's (pointing
`OIDC_ISSUER` at Keycloak's internal name in its override) only works because it has no sign-in.
Jeeves already separates "what tokens carry" from "where to fetch" for the key set
(`OIDC_JWKS_URL` is the in-network address), so the client follows that precedent and QG06's
convention: `JEEVES_IDENTITY_<ID>_URL`, the Identity's base URL as the process reaches it. In a
deployment the two are usually the same origin; locally they differ. This is A's frozen baseline,
so the fix is made now rather than proposed. It deviates from the brief's variable name; the Goal
(a real client to the Identity) is what it serves.

**What changed.**
- `module-clients.ts.template`: `identityTarget(binding: { identity })` reads
  `variable("IDENTITY", identity, "URL")` through the same `target(name, true)` (QG06's URL rule,
  QG10's `https:` refusal under the switch, the internal-call mark).
- `client-wiring.ts`: `identityVariable(local)`; the emitted call is
  `identityTarget({ identity: "<local id>" })`; the stores row names the variable and Keycloak's
  address inside the network.
- `local-contract.ts`: `localEndpoints` takes `issuer` and gives `JEEVES_IDENTITY_<ID>_URL` →
  `http://identity-<id>:8080`, so Compose, the report's `environment` and the README's per-process
  list all carry it (QG06's rule that the three agree). `local.ts` no longer sets `OIDC_ISSUER`
  for a stub tile that only calls the Identity (it keeps the refusal that the Identity must be one
  a sign-in binds); the generated README's sentence says what the variable is, that a stub adds
  the realm's paths (`/realms/<id>/...`), that a deployment sets its issuer's origin or another
  address its processes reach, and that `OIDC_ISSUER` is what tokens carry; the switch's list gains
  the variable. `tile-processes.ts`'s `environmentOf` drops its `OIDC_ISSUER`-for-issuer line (the
  variable now comes from `localEndpoints`). `http-wiring.ts`'s field comment.
- Tests: 7 existing QG20 tests updated to the new variable and call (they fail on `78371fe`, pass
  here): `module-clients.test.ts` 4 (the marked rejection; the base, now asserting the call goes to
  `http://identity-identity:8080/...` while `OIDC_ISSUER` is set to the browser's address, and that
  the variable is the Identity's own by local ID; the unset/invalid names; the switch) and
  `client-wiring.test.ts` 3 (the probe's `front.ts` line and import; Compose: Front gains the
  variable beside its sign-in's `OIDC_*`, r83's Session API has the variable and no `OIDC_*`,
  Account API has no Identity variable, `depends_on` unchanged; the stores row, the README phrases,
  and that a design calling neither has no `JEEVES_IDENTITY_` text). `tile-guard.test.ts` and
  `http-wiring.test.ts` are unchanged: a sign-in's `OIDC_*` lines did not move.
- Docs: `jeeves-generator/README.md` (the Provisioning row, Module clients, the switch list),
  `docs/studio.md`, `docs/template-gaps.md` (the "Open" row is "Fixed in QGR2").
- Pins: none. Emitted output: inside QG20's list (above).

**Proof.** Runs, below: on the probe export with the Q03 bodies, `GET …/front-probe/identity`
answers 200 `{"status":200}` in 61 ms (the stub's `request("/realms/identity")` reached Keycloak's
realm document, `{"realm":"identity"}` with its public key, from inside the network), where
`78371fe`'s export answered 503 `UNAVAILABLE` (QG20's proof); from inside `app-front`, a fetch of
`OIDC_ISSUER` is still `ECONNREFUSED`.

## Findings

1. **Medium, fixed.** QG20's Identity client was unreachable locally (above).
2. **Medium, QRWTY's design, not a Jeeves defect. A publish the request deadline abandons can still
   land.** Front's admission answers 503 `DEADLINE` at 1000 ms while `pubsubPublisher`'s publish
   runs on to its 2000 ms bound; QG07's `b2` answered 503 and reached the capture. `publishMessage`
   takes no signal, so Jeeves can't cancel it. A consumer deduplicates a client's resend by
   `messageId`, but a redirect that answered 503 may still count a click. For QRWTY's durable-clicks
   oracle and for QL02 (a route's deadline signal reaches the stub, not the publisher).
3. **Medium. A Pub/Sub loop's lease can lapse while it holds a message, which redelivers it and
   counts an attempt.** QG09 saw `p5-0` with attempts 1 and 2 and `x-1` with 1, 2 and 3 while held
   in the unreachable-store wait. The SDK's client-side deadline starts at 10 s
   (`startingAckDeadline`), adapts to the 99th percentile ack latency bounded by `minAckDeadline`
   (unset) and `maxAckDeadline` (10 min), and is extended at `deadline × 0.9 − latency` with
   jitter: under load the margin is thin. Each lapse adds a copy the client also holds and raises
   `deliveryAttempt`, and since Pub/Sub counts every redelivery (QG08's note), a message that waits
   out a long outage can arrive at attempt 6 and end `RETRY_EXHAUSTED` on its first real failure,
   where a RabbitMQ loop would have five retries left. The subscription's own deadline is 60 s
   (QG07), which the client's 10 s silently shortens. Proposed unit QG27.
4. **Low. F3 is unproven, and bounds the channel, not the stream.** P6's `docker pause` keeps TCP
   connections, so it exercises neither grpc-js's reconnect (F3's two options) nor the SDK's own
   stream retry: `message-stream.js` retries an ended streaming pull with its own
   `ExponentialRetry`, 100 ms doubling to 60 s with jitter, reset when data flows or the stream ends
   `OK`/`DEADLINE_EXCEEDED`. For a lost connection each retry first waits on the channel
   (`waitForReady`, up to the stream timeout), which F3 bounds, so one or two doublings; for a
   reachable server that answers `UNAVAILABLE` the stream backoff grows to 60 s regardless of F3.
   QRWTY's Toxiproxy rows (a cut, not a pause) are the test that would show it. For the lessons
   plan (QL01's folded claim).
5. **Low. Several loop stubs of one tile on one Pub/Sub topic share one subscription**, so each
   message reaches one of them, where RabbitMQ gives each module its own queue; documented, not
   refused. Proposed unit QG28 (needs the owner).
6. **Low, a limit. The image installs without `pnpm-workspace.yaml`.** The Dockerfile copies
   `package.json` and `pnpm-lock.yaml` and installs with `--ignore-scripts`, so an application
   package whose install script must run (one it allows in `allowBuilds`) wouldn't run it in the
   image; none of the template's needs one. Recorded; no unit until an application needs it.
7. **Low. The report's `processes.tiles[].environment` omits `JEEVES_EXTERNAL_<ID>_URL`.** It lists
   what Compose sets; the External API's variable is in the API's `stores` row and one README
   sentence, not in the per-process list a deployer would read. Proposed unit QG26.
8. **Low, wording.** `delivery.ts`'s comments say only `httpTarget` marks a call as internal;
   `identityTarget` marks too. The file is pinned and outside every batch-2 list; the next unit
   that edits `delivery.ts.template` should say so.
9. **Low.** `tile-loop.ts`'s `loopBroker` is a compiled `local-broker:5672` default no generated
   process uses (QG06 left it; invariant 2 in letter). Folded into QG27.
10. **Low, wording.** Every stub process file's comment says "a failed probe fails startup", which
    QG04 made inexact for a cache (raised by QG04, QG06, QG07 and QG24). Folded into QG26.
11. **Low. `migrate.mjs` can't verify a private CA.** It follows `PGSSLMODE`, which pg 8.23.1 maps
    to `ssl: true` (Node's roots, host name checked) or `false`; `PGSSLROOTCERT` isn't read. A
    managed database with its own CA (Cloud SQL by private address) is reachable for migrations
    only through its Unix socket or an auth proxy. Proposed unit QG29 (needs the owner); for
    QRWTY's Q12a.
12. **Low. Under `JEEVES_REQUIRE_TLS=true`, a cache whose certificate the client refuses is
    unavailable, not fatal** (QG04's rule applies to a refused handshake too). A wrong CA in
    production shows as one failure line a second and 503s from the stub's cache routes. QL14's
    decision says configuration errors still fail fast; a certificate refused at the first connect
    is one. For the lessons plan (QL14).
13. **Low, a limit.** A Cloud SQL server certificate whose only name is `<project>:<instance>` can't
    pass Node's `checkServerIdentity`, so `_TLS_SERVERNAME` can't name it; reach the instance by
    its socket directory or a CA whose certificates carry DNS names. Folded into QG23 (one
    sentence for deployers); for QRWTY's Q04 and Q12a.
14. **Low, UI, needs a look.** `InspectorForm` now narrows every `select` whose control has
    `supported.values` to those values plus the saved one (QG07, outside its Files). Right by
    AGENTS.md, and the Queue was mouse-checked, but a template-bound Database's or Search index's
    Provider and Engine selects are narrowed too and were not. A mouse check in the next UI unit.
15. **Low, operational.** With `package.json` and the lock the application's own (QG03), a
    template's later pin change (QG07's SDK, say) reaches an existing export only as
    `.jeeves/generated/` shadows to merge by hand; `update:v2` says `keepChanged`. YouTube v4's
    `package.json` override is now inert (`keepChanged`, not refused). Documented by QG03; nothing
    to add for a fresh export.
16. **Note.** The asset lock already held 20 entries under 14 days old before QG07 (`@aws-sdk/*`,
    `@smithy/*`, `cookie`, `semver`, `thread-stream`, `fast-json-stringify`); QG07 held only its
    new entries to the rule. Whether to backfill is the owner's.
17. **Note.** QG08's compose and README change for a Pub/Sub consumer's service is beyond its
    Emitted output list; recorded in its handoff, shown by no fixture. Accepted.
18. **Low.** QG24's and QG06's URL rules accept a value with trailing whitespace (`URL.parse`
    trims); the guard then refuses every token on `iss`. Folded into QG26 (refuse `\s`).
19. **Note.** QG18's accepted catch: a stall that never ends cycles for ever; no message reaches
    `.failed`. And a route's `Query read timeout` is still the fallback 503 without `Retry-After`
    until QG21.
20. **Note.** QG20's harness `override` attachment role is test infrastructure; it admits only
    `compose.override.yaml` when the manifest doesn't list it, so a fixture can't smuggle a
    generated file.

## Proposed units

- **QG26 — The report lists every variable a process reads (ready).** `tile-processes.ts`
  `environmentOf`: add `(service.external ?? []).map(externalVariable)`; `local.ts`'s per-process
  README list the same (the sentence "Here `app-x` reads …" may then go). Test: QG06's rows test
  becomes "Compose's keys plus the process's `JEEVES_EXTERNAL_*`", and QG20's Compose test asserts
  r83's Billing API row contains `JEEVES_EXTERNAL_STRIPE_API_URL` while its service doesn't. Same
  unit, same files: `client-wiring.ts`'s emitted comment becomes "each probed once before the
  process is ready; a failed probe fails startup, except a cache's, which is logged"; and the
  `url` rule in `module-clients.ts.template` and `signInUrl` in `http-wiring.ts` refuse a value
  matching `/\s/` (tests: a trailing newline fails `Invalid endpoint <name>`). Emitted output:
  process files, README, report, `module-clients.ts`; pins none (processes off has no guard and
  no stub); regressions check, e2e, build, `--suite=wiring`.
- **QG27 — Pub/Sub loops keep their lease for the subscription's deadline (ready).**
  `module-clients.ts.template`, `pubsubConsumer`: `client.subscription(queue, { flowControl,
  minAckDeadline: Duration.from({ seconds: 60 }) })` (`Duration` from `@google-cloud/pubsub`; the
  value is QG07's `ackDeadlineSeconds`), so the client extends every ~54 s instead of ~9 s and a
  5 s wait never lapses. Same file: remove `loopBroker` from `tile-loop.ts.template` and make
  `startModuleLoop`'s transport required (every emitted call passes one since QG06). Tests:
  `tile-loop.test.ts` records the subscription options; a pubsub-suite row **P9**: a `hold-` ID the
  fixture's Count holds 30 s is delivered once (`m_count.deliveries` one row, attempt 1). The
  trade-off to record in the generator README: a crashed consumer's messages come back after up to
  60 s instead of about 10 s (P4 measures it). Emitted output: `module-clients.ts` (Pub/Sub
  designs), `tile-loop.ts`, report, manifest; pins none expected (Rule 7 if
  `processes-off.test.ts` fails); regressions check, e2e, build, `--suite=pubsub`, `--suite=core`.
- **QG28 — Two loop stubs of one tile on one Pub/Sub topic (needs the owner).** Today they share
  `<topic>--<tile>` and split the messages; RabbitMQ gives each module its own queue. Either give
  each consuming module its own subscription `<topic>--<tile>--<module>` (`pubsubSubscription`
  takes the module; `infra/local.json`, `pubsub-init.mjs`, `loop-wiring.ts`, the report rows) or
  refuse the design with a required gap naming both modules. The owner picks; the first keeps the
  RabbitMQ semantics, the second keeps QG07's names.
- **QG29 — `migrate.mjs` verifies TLS with the deployment's CA (needs the owner).** The admin
  connection takes `JEEVES_MIGRATE_TLS` (`disable` | `verify-full`), `_CA_FILE` and
  `_TLS_SERVERNAME` by QG10's rules (or the owner's names), `ssl` set explicitly so `PGSSLMODE`
  can't change it; Compose sets `disable`; `JEEVES_REQUIRE_TLS=true` refuses `disable`. Docker
  proof as QG10's hostssl one, on the migration. For QRWTY's Q12a.
- **Into QG21 (ready, already approved):** two more cases for its test, both now common for a
  stub: a route whose stub throws `Cache deadline`/`Cache unavailable` (QG04) and one whose
  Identity call rejected with a marked `fetch failed` (QG20) answer 503 `UNAVAILABLE` with
  `Retry-After: 1`.
- **Into QG23 (ready, docs):** one Known limits sentence for deployers: a Cloud SQL certificate
  whose only name is `<project>:<instance>` can't be checked by `_TLS_SERVERNAME`; use the socket
  directory or a CA with DNS names (finding 13). And the `migrate.mjs`/`PGSSLMODE` limit until
  QG29 (QG10's row says it; QG23 can point a deployer at the socket directory).
- **QG22 and QG25:** nothing from this batch folds in.

## Notes for the QRWTY lessons plan (`docs/plans/qrwty-lessons/`)

- **QL01 (folded into QG09 as F3):** the two grpc-js options bound the channel's reconnect, not the
  SDK's stream retry (finding 4). The Goal's "reconnects within about two seconds" holds for a cut
  connection as long as the stream's retry is on its first or second attempt; a reachable but
  refusing emulator would still back off to 60 s. QL's review (QLR1) should read B's F-rows with
  that in mind.
- **QL02 (route deadline signal):** the signal can bound a stub's own `fetch`, not a Pub/Sub
  publish (finding 2); the brief should say a publish abandoned by the deadline may still land.
- **QL12 (Browser session):** its Compose list names `OIDC_ISSUER` for the issuer's discovery and
  the token exchange; locally that address is unreachable from a container (QG20's proof), so the
  session's backchannel calls need `JEEVES_IDENTITY_<ID>_URL` (this fix) as their base, and
  Keycloak's discovery document lists the browser-facing endpoints, so the generated session must
  derive the token endpoint from the internal base (or configure Keycloak's backchannel hostname)
  rather than from discovery. Its invariant 6 (discovery retried every 5 s) should name the
  variable it discovers from.
- **QL14 (configuration still fails fast):** a certificate refused at a cache's first connect
  under `verify-full` is a configuration error by that decision's words; today it is "unavailable"
  (finding 12).
- **QL11/QL12 and QG20:** a tile with a sign-in and a Browser session (or any Identity-calling
  stub) now has two Identity variables: `OIDC_ISSUER` (what tokens carry) and
  `JEEVES_IDENTITY_<ID>_URL` (where to call). The README says so; QL12's brief should too.

## Disclosure

F3's reconnect backoff (`grpc.initial_reconnect_backoff_ms` 500, `grpc.max_reconnect_backoff_ms`
2000) came from QRWTY **arm B's** review (B05 review F1 and B05b's measurement), written up as
lesson QL01 and folded into QG09 by the owner on 2026-11-14 with the owner's approval. Arm A's
templates therefore carry one change whose evidence was B's. It is recorded here so the arms'
comparison can account for it.

## For Q05: the frozen baseline

- The baseline is this commit (QGR2), not `78371fe`. Relative to `78371fe`, a stub's Identity
  client is `identityTarget({ identity: "<id>" })` reading `JEEVES_IDENTITY_<ID>_URL`. In r83,
  **Session API** reads `JEEVES_IDENTITY_IDENTITY_URL` (Compose: `http://identity-identity:8080`)
  and no `OIDC_ISSUER`; its stub adds the realm's paths (`/realms/identity/protocol/openid-connect/…`)
  and, for the browser's authorization redirect and `iss` checks, needs the browser-facing issuer
  from its own `compose.override.yaml` variable. Account API, Billing API and Link API keep their
  sign-ins' `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`.
- r83's **Billing API** and **Link API** fail startup until `JEEVES_EXTERNAL_STRIPE_API_URL` and
  `JEEVES_EXTERNAL_REPUTATION_API_URL` are set in `compose.override.yaml` (`Invalid endpoint …`);
  the report's `environment` doesn't list them (finding 7), the README's sentence and the `stores`
  rows do.
- `pnpm install --frozen-lockfile` (no `--ignore-scripts`) and `pnpm add stripe@<exact>` work in
  the export; `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are the application's.
- Every process reads `JEEVES_DATABASE_<ID>_HOST/_PORT/_TLS`, `JEEVES_CACHE_<ID>_HOST/_PORT/_TLS`,
  `JEEVES_BROKER_HOST/_PORT`, `JEEVES_TILE_<ID>_URL` as `compose.yaml` sets them; the production
  profile sets `JEEVES_REQUIRE_TLS=true`, `verify-full` with `_CA_FILE` and `_TLS_SERVERNAME`, and
  gets `Insecure endpoint <variable>` refusals for anything plain text except the broker, object
  storage and search (not checked) and a database's socket directory.
- r83's Events is RabbitMQ as saved (provider unspecified); Google Cloud needs the design edit
  (`edit <queue> {provider: "google-cloud"}`), after which Redirect service publishes to Pub/Sub
  and Analytics worker consumes `events--analytics-worker`; findings 2–5 then apply.
- Delivery through Pub/Sub is at-least-once with `messageId` deduplication by the consumer; a
  publish abandoned at Front's request deadline may land (finding 2); a held message can be
  redelivered with a higher attempt (finding 3) until QG27.
- Known flakes seen in this batch, none a defect: e2e's `Project:` menu not visible under load
  (arm B's stacks), B10's clock step, B09 media's case 3.

## Runs

**The probe stack** (QG20's fix and QG04's rows), on the fixed tree's probe export with the Q03
bodies at their `generated-extension` paths (`src/modules/front/front-probe.ts`,
`front-internal-grant.ts`, `src/modules/tally/tally-count.ts`, the two product SQL files) and an
application `compose.override.yaml` giving `app-front` `JEEVES_EXTERNAL_PROVIDER_URL:
http://127.0.0.1:18080` (QG20's rule: without it Front fails startup). Project `qgr2-probe`, ports
47991–47993, built and started 23:10:47–23:12:22 beside the suite's first stacks; every container
healthy (`uid` 1000 from `/env`).

- `GET /api/front/modules/front-probe/identity`: **200 `{"status":200}`** in 61 ms. From inside
  `app-front`, `fetch(JEEVES_IDENTITY_IDENTITY_URL + "/realms/identity")` gave 200 with
  `{"realm":"identity","hasKey":true}`; `fetch(OIDC_ISSUER)` gave `ECONNREFUSED`. On `78371fe`
  the same route answered 503 `UNAVAILABLE` (QG20's proof).
- `…/provider`, with a loopback server inside `app-front` answering 418: `{"status":418}`
  (QG20's own proof, repeated).
- QG04: `docker pause` of `cache-hot`: `…/cache` answered **503 in 0.169 s** (`UNAVAILABLE`, the
  stub's `Cache deadline` through the fallback 503, QGR1 finding 1), the next in 0.001 s. After
  the unpause, within 6 s, `…/cache-set` then `…/cache` gave `v1`: the client came back by itself.
  Then `cache-hot` stopped and `app-front` restarted: healthy, `…/redirect` **302** 2 s after the
  restart; its log has the `warn`/`unavailable` probe line after the earlier `ok` ones.
- Teardown: `pnpm stop` exit 0, `docker compose --profile '*' down --volumes --remove-orphans`
  exit 0, `docker image rm qgr2-probe-app:latest` exit 0, `.runtime` removed; no `qgr2` container,
  image, network or volume is left.

**The suites** ran from the repository with `--artifacts` in the scratchpad, so nothing was added
under `test-results/generated/`; their cleanup records show each `gs-*` project's containers,
networks, volumes and images empty before and after. The `--suite=all` run's three Pub/Sub stacks
passed P1–P8 first time (P6: paused 60,169 ms, the first 202 **78 ms** and the backlog counted
**1,418 ms** after the unpause, against bounds of 3 s and 10 s; P7's probe and first publish under
2 s; P8's plain install exit 0).

**Scratch.** The clone at `b55644a`, the clone at `78371fe` (the fix's fails-before run), the
`before-*`, `after-*` and `after2-*` exports and the proof script were deleted at the end. The
checkout's `node_modules` was not touched by the clones (each had its own offline install).
