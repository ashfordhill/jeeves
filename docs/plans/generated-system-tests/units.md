# Generated system tests: build and run the backend Jeeves actually exports

**Status:** build plan, 2026-11-12. Requested by the owner after the generator testing review.
No runner, fixture application or workflow in this plan has been implemented. The repository
was inspected at `cc27a33` (PF06 complete); later agents must read the latest handoff.

**Outcome:** one local command generates an application from its diagram, supplies its small
application-owned parts, builds it independently, runs real providers and generated processes,
and fails if the observable behavior is wrong. GitHub Actions runs that same command.

## Fit with the owner's strategy

- The diagram remains the source of generated files. Tests never repair an exported scaffold.
  A defect becomes a [template gap](../../template-gaps.md), a template fix and a fresh export.
- Most new testing effort goes into system behavior. Existing offline checks remain; this plan
  does not add Docker or network requirements to `pnpm check` or replace the studio's E2E tests.
- The trial application supplies only small hook implementations, stub bodies and product SQL.
  Installed templates do the counting, transactions, delivery, caching, uploads and processing.
  Tests must not reimplement those mechanisms in their fixtures.
- Production correctness includes concurrent process copies and recovery from provider failure.
  Copies, ports and fault controls belong to the test harness, with no new canvas settings,
  deployment feature, user-facing test dashboard or certification badge.
- Field projects supply examples and failures that improve reusable templates. The trial has no
  browser UI or product roadmap. YouTube remains useful evidence, not a product to preserve.
- The 60% backend-source goal stays separate from behavior evidence. Test code, fixtures and
  harness code earn no generated-backend or application-feature credit.
- This is a bounded suite for installed templates and their current local providers. Exhaustive
  provider combinations, load/soak campaigns, cloud deployments and a certification framework
  remain deferred.

### Relationship to production foundations

[Production foundations](../production-foundations/units.md) remains the active implementation
sequence. Finish PF07–PF14 and review its results before assigning GS01. Do not interrupt those
units, rewrite their checks, or turn PF12/PF13 into this runner while they are in progress.
This is the proposed next sequence; the coordinator assigns one unit at a time on `main` in
the primary checkout. Planning this sequence does not start its implementation units.

PF06–PF08 supply failure reporting and recovery behavior to exercise. PF09–PF10 supply the
regeneration path. PF12–PF13 supply observed scenarios, and PF14 identifies unresolved defects.
Their evidence remains dated evidence; a new test must run against the templates it reports.
If the coordinator explicitly assigns GS01 earlier, its dependency is PF08; GS08 additionally
requires PF10. Concurrent work in these shared generator files is not part of this plan.

## Starting points, and what they currently prove

| Existing work | Reuse | Missing proof |
| --- | --- | --- |
| [Generator CLI](../../../jeeves-generator/src/v2/cli.ts) and emitted Compose/local scripts | Actual export, installation, provisioning, startup and shutdown | Fresh export and application behavior on every test run |
| [Stub stack](../../../jeeves/packages/spec/src/fixtures/stub-stack.ts), [TP08 run](../tile-processes/evidence/tp08/README.md) | Supported graphs, real provider clients, startup and failure routing | Successful work through completed stub bodies and installed templates |
| [Durability tests](../../../jeeves-generator/src/v2/durability.test.ts), [loop tests](../../../jeeves-generator/src/v2/tile-loop.test.ts) | Expected transaction and delivery semantics | Real PostgreSQL connections, RabbitMQ delivery and process failure; the current tests serialize PGlite access or replace transport |
| [Sign-in](../../../jeeves/packages/spec/src/fixtures/sign-in-stack.ts), [favorites](../../../jeeves/packages/spec/src/fixtures/favorites-stack.ts), [search](../../../jeeves/packages/spec/src/fixtures/search-stack.ts) fixtures | Existing module commands and valid compositions | Runnable hooks and repeatable behavior assertions |
| [YouTube scenarios](../../../field-projects/youtube/v3/notes/scenarios.md) and [operator harness](../youtube-v3/evidence/v3-17/README.md) | PKCE client, real multipart transfer, readback and publication scenarios | Maintained source, explicit assertions, bounded waits and normal test-runner exit codes |
| [Product attachment example](../../../jeeves-generator/examples/product-attachment/README.md) | A second use of the real upload/lifecycle/encoding mechanisms | General system suite; the example has no public HTTP or authentication proof |
| [Current CI](../../../.github/workflows/ci.yml) | Existing toolchain pins and repository checks | Generated application test job |

## What runs for real

The system under test is the exported backend: generated nginx edge, HTTP processes, workers,
provider clients, runtime helpers, migrations and permission setup. Providers are the exact
PostgreSQL, RabbitMQ, Valkey, Garage, Keycloak and OpenSearch images selected by the registry;
media tests run the exported FFmpeg image. A small scenario starts only its needed providers.

Application-owned code supplies domain decisions: request validation, stable event identities,
record shapes, eligible items and SQL views. It can use the generated interfaces and helpers.
It cannot replace a selected template with a fake. An external API may be a local
HTTP fixture service with recorded requests and controlled responses; internal service calls
still cross real generated HTTP processes. No paid services or owner accounts are needed.

The harness sends HTTP requests through the edge. Provider inspection is allowed to establish
an otherwise invisible invariant or a fault boundary. It must use application credentials for
access-control assertions. Administrative credentials are limited to setup, observations and
fault injection, not the application's successful requests.

## Repository shape and command contract

These are proposed paths, to be created by their units:

```text
jeeves-generator/integration/
  run.ts                    # suite selection and lifecycle orchestration
  vitest.config.ts          # separate from the offline generator project
  harness/                  # export, Compose, HTTP, polling, evidence and cleanup
  scenarios/                # *.system.test.ts; one named behavior per test
field-projects/generator-system/
  README.md                 # fixture ownership, commands and behavior inventory
  fixtures/
    activity/               # first small application: events and counts
    wiring/                 # stub clients, service calls, storage, immutable cache reads
    identity/               # real sign-in and favorites
    media/                  # real upload -> processing -> publication -> search
```

Each fixture has one saved `design.json`, an `owned/` tree and a small explicit attachment map.
The diagram is the sole generation input. Reuse the existing studio command helpers to author
it; do not maintain another hand-written provider topology or a second fixture specification.
The attachment map names destination paths and roles, never generated runtime implementations.

Keep field fixtures outside workspace discovery. Their completed application is created under
an OS temporary directory outside the checkout, with its own frozen install and build. Do not
check in generated applications, `node_modules`, build output, runtime secrets or binary media.
An internal fixture README may document how to inspect that standalone export.

The root command will be:

```sh
pnpm test:generated                         # core, once GS01 implements it
pnpm test:generated --suite=core
pnpm test:generated --suite=wiring
pnpm test:generated --suite=identity
pnpm test:generated --suite=media
pnpm test:generated --suite=faults
pnpm test:generated --suite=regeneration
pnpm test:generated --suite=all
```

Add suites only in their assigned units. Unknown and not-yet-implemented suites fail clearly;
`all` reports exactly which implemented suites it ran. The runner reuses the pinned Vitest and
tsx already in the repository. A dedicated configuration selects only `integration/scenarios/`
and initially runs files serially, with no test retries. Include the harness in generator
typechecking; keep its Docker tests out of the existing `src/**/*.test.ts` project.
[Vitest supports explicit includes](https://vitest.dev/config/include) and
[JSON/JUnit reporters](https://vitest.dev/guide/reporters).

### Lifecycle, isolation and evidence

1. Record the commit, relevant dirty-source hashes, fixture/owned-code hashes, tool versions,
   selected suite, unique run ID and intended Compose project before creating resources.
   A source change during export/setup invalidates that run; do not certify a moving checkout.
2. Export through `export:v2` and the default registry. Save the original manifest/report and
   validate the expected installed template selections. Required custom hooks remain declared
   custom work; do not rewrite the report to claim the app is complete.
3. Apply only the attachment map's hook files, stub bodies, product SQL and named additional
   application files. Verify path ownership against the generated module/report information.
   Refuse a scaffold, Compose, migration scaffold, package, `.slots.ts` or `.jeeves/` override.
4. Use the export's frozen lockfile, install and build outside the workspace, without shims,
   workspace symlinks or mounting repository source into application containers. Run the
   exported `first-run` with a fresh private runtime, three free loopback ports and a unique
   `COMPOSE_PROJECT_NAME`. Resource control must use discovered service/container IDs scoped
   to that project, never fixed container names or global Docker cleanup.
5. Wait for startup readiness, then prove application behavior. A healthy container, 501
   response, logged success or empty queue alone is not a passing functional scenario.
   Expectations come from the scenario contract, not imported generated functions.
6. Each network request, startup step, asynchronous wait, fault and cleanup has a deadline.
   Poll for named conditions and preserve the last observation on timeout. No arbitrary sleeps
   as the sole proof of completion, no retry-until-green wrapper and no automatic whole-test retry.
7. Capture a summary, JUnit/JSON results, sanitized requests, container state and relevant logs,
   input/output hashes and observed fault boundaries. Never publish `.runtime`, credentials,
   bearer tokens or signed query strings. Preserve evidence before cleanup; expose an
   `--artifacts=<directory>` option for any CI system. A failed setup must still produce a result.
8. Verify generated scaffold hashes against the original manifest after attaching application
   files and after the run. Changed owned paths are listed separately. Always clean this run's
   containers, networks, volumes and private runtime on success, failure and handled signals.
   Keep cached provider/base images; no global prune. Provide a cleanup command using the run
   record for interrupted runs, checking project labels before removal. SIGKILL/host failure
   cannot guarantee cleanup; record that limit and the recovery command.

A scenario passes only if every required invariant and its fault preconditions were observed.
Missing Docker, missing images, failed installation or an unobserved fault is an unsuccessful
run, not a green skip. Keep environment/setup failure distinct from an application assertion
failure in results. A selected suite with no tests fails. Restore providers after each fault;
start a new isolated stack if restoration cannot be established.

## Behavior inventory

| ID | Behavior and independent observation | Suite / first unit |
| --- | --- | --- |
| B01 | A request through the edge publishes a stable event; the generated counter consumes it; a read API returns the committed count | core / GS01 |
| B02 | Duplicate and concurrent deliveries yield one durable effect per identity, with two worker copies and real PostgreSQL connections | core / GS02 |
| B03 | Completed and queued work survive ordinary stop/start; fresh work still succeeds | core / GS02 |
| B04 | A malformed message reaches `.failed`; the next valid message succeeds; a reader cannot write private counter tables | core / GS02 |
| B05 | Module calls and HTTP calls reach their actual targets; topic subscribers and work queues have the intended delivery behavior; storage readback matches sent bytes | wiring / GS04 |
| B06 | An immutable record is read through the generated cache template; an outage falls back; restored cache use is independently observed | wiring, faults / GS04, GS07 |
| B07 | Required/optional sign-in, invalid tokens and account isolation work through real Keycloak; favorites are idempotent and persist | identity / GS05 |
| B08 | Actual multipart bytes resume/abort correctly, produce real encoded output, commit publication and become searchable; unfinished/failed assets stay unpublished | media / GS06 |
| B09 | In-flight worker death rolls back or completes safely; accepted messages survive broker failure; database loss produces bounded errors and recoverable work | faults / GS07 |
| B10 | A supported diagram setting changes runtime behavior; updating an existing export preserves owned code and data and gives the new behavior | regeneration / GS08 |

The inventory is finite. A topology or provider not exercised remains unverified. As new
templates are installed, add a focused composition and a behavioral scenario to this inventory.
Do not expand it into every combination of settings or a new catalog of diagram-review rules.

## Execution units

Each unit reads `AGENTS.md`, the latest handoff, this plan's shared contract and its own section.
Preserve unrelated changes. Never edit the root README, historical field apps or generated
files. The normal finish is `pnpm check`, `pnpm test:e2e` (Docker fallback if needed), web build,
the relevant generated suites, a short appended handoff and one local commit; push only when
asked. A studio browser check is required if a unit changes anything user-visible there; none
of these units intends a studio UI change.

A routine implementation adjustment stays inside the assigned unit and is recorded. If a
system test exposes a template defect, first retain its failing result and record the gap.
A small fix to the mechanism the unit exercises may be included, with a new export and all
applicable checks; never repair its generated output. A larger fix becomes a separately
assigned unit before the dependent gate is enabled. Do not weaken the invariant or add an
expected-failure exemption. Preserve frozen local-v1 output and review any processes-off pin
changes path by path, following the existing production-foundations pin procedure.

### GS01 — One generated application succeeds end to end

**Deliver:** the runner, separate Vitest configuration, core command and Activity fixture.
**Paths:** new integration and Activity fixture paths above; root/generator package scripts;
generator tsconfig; project README/ignore entries as needed. No new dependencies expected.

- Build a small module-authored graph: public Activity API with an event-publisher stub;
  Events queue; Counter worker with the installed event-counter template, its consumer and
  writer parts; Totals database; public Totals API with a data-access stub reading the generated
  public totals view. Follow current store ownership and lane rules; do not give the reader
  write access. Real services: edge, the three application processes, PostgreSQL and RabbitMQ.
- Complete only the publisher/reader stub bodies and counter codec/identity hooks. Use simple
  activity/aggregate IDs unrelated to YouTube. The publisher waits for the real broker confirm
  before acknowledging; it does not claim a transactional outbox guarantee it does not provide.
- Implement B01: initially zero; submit one event; eventually exactly one through the read API,
  with matching receipt evidence. Require fresh output to build without repository dependencies.
- Implement cleanup and failure evidence now. Prove a deliberately wrong test expectation
  produces a nonzero result and still cleans the run; restore the correct expectation. This is
  a harness check, not permission to edit generated code.

**Done when:** `pnpm test:generated` passes from a fresh temporary export, records its identities
and leaves no run-owned Docker resources. A controlled failing assertion is also recorded.
**Commit:** `GS01: run a freshly generated activity backend end to end`.

### GS02 — Duplicate delivery, two copies and restart persistence

**Deliver:** B02–B04 in the same small fixture; no new application framework or provider.

- Submit 50 distinct event IDs and repeat each three times with bounded concurrent HTTP calls.
  Assert a count of 50 and exactly 50 matching receipts. Reuse one aggregate for contention.
  Count successful confirmed submissions separately from transport failures.
- Run two copies of the Counter service using Compose scaling. Establish that each copy can
  process work by briefly running each alone, then run the duplicate burst with both subscribed.
  Do not assume equal scheduling proves correctness. Observe the real broker's two consumers.
- Run two copies of each public API too. Stop each copy in turn and verify submissions and
  reads through the edge recover within the documented routing bound. Keep the edge single;
  record any allowed transient responses instead of assuming instant failover.
- Stop the workers, submit confirmed events, stop/start the stack with the same runtime and
  volumes, then verify the queued events and earlier totals. Confirm a new event still works.
- Send a malformed envelope through a test-owned ingress path or scoped broker injection;
  assert its terminal queue/code and that a following valid event increments the count.
- Probe the generated Totals reader's credentials: published view read succeeds, private-table
  read/write fails. Application requests still use the normal generated login.

**Done when:** all core scenarios pass with one and two copies as specified, without a fake
broker/database or duplicate-suppression code in the publisher fixture.
**Commit:** `GS02: verify delivery and persistence with competing workers`.

### GS03 — Make the core suite a portable CI job

**Deliver:** `.github/workflows/generated-system.yml` and usage/troubleshooting documentation.
**Dependencies:** GS01 and GS02. The existing studio CI remains intact.

- Run core on pull requests and pushes to main, and allow manual selection of implemented
  suites. Use a Linux Docker runner, existing pinned Node/pnpm and action revisions, and a
  frozen repository install. YAML calls the same CLI; it contains no provider definitions,
  scenario assertions or GitHub-specific requirements in the harness.
- Always attempt scoped cleanup and upload sanitized results, including when a test fails.
  Use a bounded job timeout and unique names for run attempts. Cache downloads/build layers
  with appropriate source/lockfile identities, never mutable provider data or credentials.
- Measure one cold and one warm run, recording total time and peak resource observations.
  Aim for core to be practical on every PR; set its timeout from measurements. Do not loosen
  behavior assertions to meet a time target. Avoid workflow-level path filters that would
  prevent a future required status from being reported.
- Demonstrate the documented command in a plain shell with no GitHub environment variables.
  GitHub is the first adapter; other CI systems need Node/pnpm, Docker Compose and artifact
  collection. Do not build a plugin system or multiple speculative workflow adapters.

**Done when:** local core and controlled-failure cleanup pass, the workflow is reviewable, and
commands/results are documented. A hosted run is pending until the owner publishes the commit;
do not push or change branch protection under this unit. Once published, verify its first run
before the owner makes the status required. GitHub provides
[Linux container support](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers),
[workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
and [artifact storage](https://docs.github.com/en/actions/tutorials/store-and-share-data).
**Commit:** `GS03: run generated backend behavior in GitHub Actions`.

**First usable milestone:** GS01–GS03. The generator now has a small, repeatable system check
and a CI job, without waiting for the entire provider/template set or fault campaign.

### GS04 — Exercise stub connections and real cache reads

**Deliver:** Wiring fixture and B05/B06's normal behavior; `--suite=wiring`.
Reuse the stub-stack/cache-read/search fixture patterns, adapting their graph through commands.

- Use small completed stub bodies to exercise module-to-module calls, HTTP to an internal
  generated service and HTTP to a controlled external endpoint. Verify the input arrives and
  the returned value depends on that input. Confirm the internal service has no public edge
  route. The external fixture is managed outside generated application configuration.
- Exercise topic fanout to two different subscriber modules, and competing consumers of one
  work queue. Assert the durable observable effect appropriate to each, retaining message IDs.
- Put known bytes through a generated object-store client and read them back with permitted
  credentials; compare bytes/hash and prove an inappropriate credential cannot read/write.
  Exercise a search stub with a real mapped index. Setup may seed the index, but the request
  under test must use the generated search client.
- Complete the installed positive-cache reader's hooks over an immutable published catalog
  record, using real PostgreSQL and Valkey. Observe the cached value and expiry, a cache hit,
  and absence remaining uncached. Never cache the Activity fixture's mutable counter totals.
- Keep helpers/application code small. A need to implement cache recovery, AMQP retry or
  another generic mechanism in a fixture is a template gap.

**Done when:** the wiring suite proves successful input/output for each named connection and
preserves generated scaffolds; startup probes or 501 responses earn no credit.
**Commit:** `GS04: verify generated stub clients and cache reads together`.

### GS05 — Real identity and favorites

**Deliver:** Identity fixture and B07; `--suite=identity`.

- Reuse the sign-in/favorites graphs and PKCE flow from the archived harness as maintained,
  typed source. Provision disposable test users through the local Keycloak admin API.
  Required sign-in rejects missing/invalid tokens; optional sign-in accepts no token but still
  rejects an invalid one. Use actual signed tokens; do not inject a trusted principal.
- Supply a tiny eligible-items table/view through product SQL and required hooks. PUT twice
  keeps one favorite and the same creation time; GET/list and DELETE give the documented
  results. Another account cannot see or remove the first account's favorite.
- Ineligible items are refused, and favorites survive an ordinary restart. These accounts are
  fixtures for existing generated authentication behavior, not new studio multi-user features.

**Done when:** all assertions pass through the edge with real identity and database services;
no tokens/passwords appear in retained evidence.
**Commit:** `GS05: verify sign-in and favorites against real providers`.

### GS06 — Complete media and search composition

**Deliver:** Media fixture and B08; `--suite=media`. Reuse PF14-reviewed YouTube v4 inputs and
owned hooks/SQL as source material, inspecting their ownership before copying. Save a separate
backend-only fixture diagram and attachment set; never copy v4's generated scaffold or browser
overrides. The product-attachment example can inform domain-neutral hook names and envelopes.

- Generate a small reproducible video at test time with the pinned FFmpeg runtime. Record its
  bytes/hash; choose its size to exercise at least two real multipart parts. Generate invalid
  bytes too. No dependency on an owner's `.runtime/media` file or a downloaded video.
- Through real sign-in/upload endpoints, start an upload, transfer a part, resume via ListParts,
  complete and verify the stored original's hash. A separate aborted upload cannot complete.
- Observe processing and eventual publication. Retrieve the real HLS playlist, a segment and
  thumbnail through delivery; inspect media with FFprobe. Retain failure evidence if processing
  never starts. Do not substitute fake encoder results or claim human listening was checked.
- Verify the ready item becomes searchable, and pending, failed and aborted items do not.
  Replay a publication event through the actual broker and retain one search document.
  Exercise the same fixture's generated counts and favorites so the template combination runs
  as one system, not only in independent fixture stacks.
- Follow actual backend contracts: do not require v3's missing creator-status UI or change
  multipart's 200 response to 202 as incidental test work. Known unimplemented product behavior
  is listed separately from the suite's required invariants.

**Done when:** real bytes cross the upload, queue, encoder, lifecycle, publication, search and
delivery path, with failure paths and data exclusions asserted. Record cold/warm cost; add
scheduled and manual runs for the expanded suites, executing stacks sequentially at first.
**Commit:** `GS06: test the generated media pipeline as a complete system`.

### GS07 — Failure and recovery with observed boundaries

**Deliver:** B06 recovery and B09; `--suite=faults`, reusing the existing fixtures.
Read PF12/PF13/PF14 evidence first; convert useful observations into assertions.
Runs after [broker reconnect](../broker-reconnect/units.md) BR01–BR02 (owner, 2026-11-12); read
BR02's evidence too.

| Fault | Required observation and invariant |
| --- | --- |
| Cache stop/start, then a separate stalled-cache case | Immutable reads fall back within their bound. After restoration, clear the key, read again and observe a real fill/use without restarting the API. Record the expected failure/recovery signals. |
| Counter dies before SQL commit | Hold the relevant total row with a separate PostgreSQL transaction; submit an event; observe that worker's query blocked and the broker delivery unacknowledged. Kill that worker, release the lock, recover, and assert one increment and one receipt. |
| Committed event delivered again | Replay the committed event through RabbitMQ; the durable effect stays one. Label this duplicate-delivery proof, not a crash between commit and ack. |
| Outbox relay dies after publish confirmation | In the media fixture, install a temporary PostgreSQL fault gate that blocks the relay's `sent_at` update, using a trigger waiting on a harness-held advisory lock. Submit work through the real API, observe the blocked update and downstream delivery, then kill the relay's process. Release/remove the gate and restart the process. The committed pending intent must be relayed again and eventually marked sent, with one durable downstream publication/effect. |
| Broker stop/start with queued accepted work | Stop consumers, submit confirmed messages and observe them in the real queue; restart the broker without restarting any application process, and assert every accepted identity's effect exactly once. During the outage assert bounded failure for unavailable publication (503), not unconditional acceptance, and that reads which don't need the broker keep answering. |
| PostgreSQL unavailable during work | Observe request/worker failure within configured bounds; restore the database and perform the documented process recovery. Accepted work eventually completes once; a new request succeeds. |
| Transcoder dies while encoding | Observe the job processing and FFmpeg running in the identified container before killing it. After recovery, obtain one publication and valid output; failed/partial output was never publicly ready. |

After BR01, a process that loses the broker stays up and reconnects by itself. The harness never
restarts an application process after a broker fault: it asserts that none exited or restarted,
and that each broker client logged its `broker` failure line and then `"state":"available"`. Do
not install a production restart policy. A request whose response is lost has an uncertain outcome: retry its same stable
identity and assert one final effect, rather than calling it definitely accepted or rejected.

For a precise interruption test, run only one copy of the targeted relay/worker; keep its
downstream providers and processes real. Record that topology separately from GS02's competing
copies. A temporary database gate must not accidentally block an unrelated process's work.

Fault preconditions are assertions. If a short encode cannot be caught, adjust the test fixture
within its resource bound and record it; stopping an idle worker is not a passing substitute.
Use real locks/process/network controls or existing application-owned hooks for coordination.
The temporary database gate only blocks execution: it supplies no application effect, retry or
deduplication, is scoped to the known fixture relation, and is removed before recovery assertions.
Never add test-only branches to generated runtime code. Exact consumer post-commit/pre-ack crash
timing and network partitions remain unverified unless a later unit adds a controllable, observed
boundary. Logs support the assertions; absence of an error log is not recovery proof.

**Done when:** every selected fault has evidence of injection, restoration and the durable
outcome, or fails. Add faults to scheduled/manual CI; ordinary core remains small.
**Commit:** `GS07: verify generated backends recover from real failures`.

### GS08 — Diagram settings and regeneration change live behavior

**Deliver:** B10; `--suite=regeneration`. Requires PF10's implemented update command.

- Use the immutable-cache fixture to test one necessary supported decision: its TTL. Save
  diagram A and a command-derived diagram B with a different supported TTL. Fresh exports of
  each must demonstrate their own cache expiry behavior against Valkey, using time bounds
  that distinguish the configured values rather than exact scheduler timing.
- On a disposable running A export with seeded data and completed owned files, stop it, plan
  and apply B through `update:v2`, then resume according to the implemented runtime contract.
  Preserve hashes of hooks, stub bodies and product SQL, plus IDs/counts of retained data.
- Do not edit `.runtime/local-setup.json` or bypass composition/history checks to make the update
  run. If current regeneration cannot resume this change while retaining data, record a gap
  and assign its fix; a fresh-volume test cannot stand in for preservation.
- Confirm B's behavior and a subsequent update check with no unexpected scaffold changes.
  Keep any fixture design-authoring helper out of application runtime code.

**Done when:** both fresh-export setting behavior and actual update/preservation behavior pass.
The test's expected expiry is specified independently of the generated binding implementation.
**Commit:** `GS08: verify diagram changes and regeneration in a running backend`.

### GS09 — Review coverage and choose the permanent gates

**Deliver:** a short review in this folder and an up-to-date fixture README. The coordinator
should assign a reviewer who did not implement the runner; this plan does not launch agents.

- Map B01–B10 to executable tests, installed templates, provider versions, observed results and
  remaining limits. Include stub connections, sign-in, multipart, lifecycle, encoding, cache,
  counter, search indexing/query and favorites. No implied coverage for untested variants.
- Run core and the expanded suites on clean exports. Review failure cleanup, scoped resources,
  fixture ownership and assertion independence. Run the standard repository checks.
- Record one deliberate harness failure and its artifacts, and check that omitted/unobserved
  fault steps cannot produce a successful suite. Avoid a general mutation-testing platform.
- Recommend permanent PR versus scheduled/manual gates from observed duration, resources and
  reliability. A flaky result is a defect to diagnose; do not hide it with retries or weaken it.
- Record open template gaps and focused next units. Keep GitHub run status separate from local
  evidence if the workflow has not been published. Only the owner changes branch protection.

**Done when:** the owner has a compact coverage/gap report and a working command with a known
cost. New template changes have an obvious relevant system suite to run.
**Commit:** `GS09: review generated system coverage and CI gates`.

## Completion and remaining boundaries

This plan is complete when GS01–GS09's required local outcomes pass and the workflow is ready
to run the same suites. Hosted CI proof additionally requires the owner to publish the commits;
until then mark that proof pending, without calling local results GitHub results.

The suite proves the selected behaviors on the pinned local provider implementations and
tested topologies. It does not establish cloud-provider equivalence, arbitrary scale, every
fault timing, capacity, production deployment or a generated application's UI correctness.
Those limits do not reduce the requirement to preserve the accepted durable work tested here.
