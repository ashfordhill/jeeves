# Generated backend system tests

From the repository root, with Node 24.21.0, pnpm 12.16.1 and Docker Compose:

```sh
pnpm test:generated
pnpm test:generated --suite=core --artifacts=/absolute/evidence-directory
pnpm test:generated --suite=wiring --artifacts=/absolute/new-wiring-results
pnpm test:generated --suite=all
```

`core` and `wiring` are implemented. Unknown or future suite names fail; `all` prints the implemented
suites it selects. These Docker/network tests run separately from `pnpm check` and the studio
E2E tests. Vitest runs files serially, with no test retries and no green skips for unavailable
Docker, failed setup or missing observations. Setup failures and application assertion failures
have distinct phases in each stack's `result.json`.

Each run exports the saved diagram through the default registry's `export:v2`, checks the
installed template selections, attaches only the explicit application-owned map, performs a
frozen install and build outside the workspace, and starts the exported `first-run` with private
runtime files, three allocated loopback ports and a unique Compose project. Nothing from the
checkout is mounted into application containers. The original report keeps its required custom
gaps: attaching hooks supplies application code, not a generator attestation of completeness.

The Activity fixture has a public event publisher, a topic with one Counter subscriber queue,
an installed receipt counter and a public read-only totals reader. Its three small owned files
validate/publish an activity, decode its identity and read the generated public view. The generated
template owns receipt transactions, counting, AMQP delivery and permissions. A 202 means
RabbitMQ confirmed the publication; the publisher has no transactional outbox guarantee. No product SQL is needed for
this fixture because the counter supplies its own private tables and public view.

| Behavior | Executable test | Observations |
| --- | --- | --- |
| B01 | `core.system.test.ts` | Initial zero through edge; confirmed submission; eventual one through edge; exact private receipt and total from PostgreSQL |
| B02 | `core-delivery.system.test.ts` | Two workers each process alone with their own real database connection; two broker consumers then handle 200 confirmed submissions for 50 identities, yielding exactly 50 receipts/increments after ready and unacknowledged deliveries drain; either copy of either public API may stop |
| B03 | `core-delivery.system.test.ts` | Completed totals and five confirmed queued events survive ordinary stop/start with identical runtime history and volume identities; a new event still succeeds |
| B04 | `core-delivery.system.test.ts` | Malformed bytes reach `events--counter.failed` with `MALFORMED_MESSAGE`; the next valid event succeeds; the actual reader login can read the published view but private reads/writes fail with PostgreSQL `42501` |

The counter's installed policy selects the topic; both Counter copies compete on its single
`events--counter` queue. Wiring separately proves fanout and a work queue. Public API failover
allows transient edge responses while nginx refreshes names (10 s), and asserts a joint
submission/read recovery within 15 s after each stopped copy. Poll observations retain transient
responses; repeated submissions use the same stable identity. The edge stays single.

The Wiring fixture adapts the studio stub-stack, cache-read and search graph patterns through
commands. Its explicit attachment map contains only stub bodies, the installed cache reader's
hooks and product SQL. The generated clients, loops, process mounts, provider configuration,
permissions, frozen lockfile and other scaffolds stay unchanged. Catalog records are immutable;
its product SQL publishes only records whose state is `published`. Activity totals are never
cached. Harness and fixture source earn no backend-generation benchmark credit.

| Behavior | Executable test | Observations |
| --- | --- | --- |
| B05 | `wiring.system.test.ts` | Two inputs cross a generated same-process module link and a generated internal HTTP client; internal target returns 404 at the edge; custom external adapter reaches the controlled service with exact received inputs; three message IDs appear independently in each topic subscriber's SQL effects; two copies each consume alone then compete for twenty work messages with exactly twenty-two durable identities; 4,099 known bytes roundtrip through the generated object client with identical hash; valid credentials scoped to the other private bucket fail both reads and writes; generated search stub queries a real explicitly mapped/seeded OpenSearch index |
| B06 normal | `wiring.system.test.ts` | Positive reader returns the immutable published row, stores its exact value with a four-second expiry, serves a hit with no authoritative load and an independently measured Valkey hit, actually expires and reloads; repeated missing/draft reads stay 404 and uncached |

The two fanout modules have different `broadcasts--audit` and `broadcasts--notify` subscriber
queues. Two Workers copies compete on the separate `jobs` work queue. Owned consumer bodies
only insert the message ID, input value and worker identity into their domain tables; they add
no acknowledgement, retry, deduplication or transaction mechanism. All effects and empty failed
queues are independently checked in PostgreSQL/RabbitMQ. Each work copy's solo effect proves it
can handle delivery; the concurrent burst has no fairness requirement.

The internal call uses the generated `HttpTarget` across separate application containers.
External API dependencies deliberately remain unavailable: there is no installed external
endpoint adapter. The tiny owned external-call body supplies that custom integration with a
bounded native fetch; it does **not** demonstrate a generated external API client. The harness
starts the controlled server separately using the built application's pinned Node image, on
only this stack's private network, with exact project labels and no published port or source
mount. Its endpoint is supplied in the test request, outside generated configuration. Recovery
removes that container with the rest of the exact project. Search mapping/seed setup is likewise
harness-owned: only the edge request under test calls the generated search client. The original
report retains both custom work and its unfinished search-mapping gap.

Cache hits are proved by exact cached value, unchanged authoritative-load observations and
Valkey INFO-only keyspace-hit counters immediately around the request (exactly one new hit).
PTTL and actual key removal prove expiry; a second load proves the following request refills it. B06 cache outage and
recovery remain GS07; this unit establishes normal operation only.

Run generated suites and browser checks in separate phases: changing Compose networks can
interrupt Chromium module loading. Keep image builds separate from offline checks too, so they
do not compete with existing test deadlines.

`integration/author-activity.ts` and `integration/author-wiring.ts` record the studio commands
used to author the saved diagrams. They are development helpers, never application runtime
code. To rebuild the diagrams deliberately:

```sh
pnpm --filter @jeeves/generator exec tsx integration/author-activity.ts
pnpm --filter @jeeves/generator exec tsx integration/author-wiring.ts
```

Evidence defaults to ignored `test-results/generated/<run-id>/`. It contains source and fixture
hashes, commit/dirty state, tool versions, original manifest/report (gzip), install/build/start
logs, sanitized HTTP/SQL observations, container state/logs, JUnit/JSON results, final scaffold
hash verification, summary and cleanup inventory. Runtime secret values (including individual
JSON credential members), bearer tokens and signed query parameters are redacted; `.runtime` and binary/provider data are never retained.
Use a fresh artifact directory for each invocation. A source change during setup fails the run.

Cleanup removes only containers, networks and volumes whose exact Compose project label
matches this run. It removes the temporary export and private runtime, retaining Docker build
and provider caches. Success, failure and handled signals attempt cleanup. SIGKILL, host failure
or a broken Docker daemon can prevent that; recover using the surviving ownership record:

```sh
pnpm test:generated --cleanup /absolute/evidence-directory/run.json
```

Do not run global Docker prune or remove unrelated projects. If setup fails, inspect the phase,
`failure.log`, stack logs and `cleanup.json` before running again. A failed application invariant
must be diagnosed; fix a template and export afresh if generated code is at fault. Never repair
a generated scaffold, replace a real provider with a fake, weaken an assertion or add retries.

## CI and other runners

`.github/workflows/generated-system.yml` runs core on every pull request and push to `main`,
with manual `core`, `wiring` or `all` selection. It calls the same command as a plain local shell:

```sh
pnpm install --frozen-lockfile
pnpm test:generated --suite=core --artifacts=/absolute/new-results-directory
```

Another CI system needs the pinned Node/pnpm versions, Linux Docker with Compose/Buildx,
enough room for the provider images, and collection of that results directory. The harness has
no GitHub environment requirement. Repository installation precedes the standalone exports;
each exported application still performs its own frozen install and build.

The GitHub adapter caches pnpm downloads using both the repository and exported application's
lockfiles. Its single Buildx builder reuses content-addressed layers across the fresh exports
and ordinary restart rebuilds within the job. BuildKit layers are not exported between jobs.
Neither cache holds provider volumes, runtime files, tokens or application data. Attempts have
unique artifact directories and upload names. There are no workflow path filters, retries or
provider definitions in YAML; the existing studio CI remains separate.

The job always attempts the record-based cleanup again. Recovery validates the recorded scope,
clears any stale completion marker and scrubs existing artifacts with the still-present runtime
secret values before deleting the runtime. Unreadable secrets or artifact errors fail recovery
and preserve the runtime for repair; genuinely absent startup secrets are allowed. A fresh
`sanitized.json` identifies the successfully scrubbed run. `runner-cleanup.json` preserves the
runner's original removal inventory before that idempotent
recovery. The adapter prepares an upload folder containing the full run only after successful
recovery and a matching completion marker. Otherwise it contains only safe outcome metadata;
raw error operands are not copied into that fallback. `adapter.json` records install/test
outcomes even if repository setup fails before the runner creates a record. A host failure or forcibly killed job can still prevent final steps;
use the run record's recovery command on a surviving self-hosted machine.
The generated step has a 15-minute limit inside the 20-minute job, leaving headroom for the
three-minute recovery step and artifact collection instead of sharing the harness's full
20-minute Vitest command deadline.

Missing Docker, provider startup/install failures, changed source during setup, absent fault
observations and assertion failures are unsuccessful runs. Inspect the summary, phase, final
observation, container logs and cleanup evidence to distinguish their causes. Keep the source
stable, use a fresh artifact directory and restore or fix the diagnosed prerequisite before a
new invocation. Do not rerun a failing invariant until it happens to pass.

Local cost measurements and the controlled-failure proof are recorded in
[GS03 evidence](../../docs/plans/generated-system-tests/evidence/gs03/README.md). Hosted execution
is pending until the owner publishes these commits. Verify the first hosted run before making
its status required; only the owner changes branch protection.
