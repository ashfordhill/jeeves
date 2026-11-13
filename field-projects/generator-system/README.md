# Generated backend system tests

From the repository root, with Node 24.21.0, pnpm 12.16.1 and Docker Compose:

```sh
pnpm test:generated
pnpm test:generated --suite=core --artifacts=/absolute/evidence-directory
pnpm test:generated --suite=wiring --artifacts=/absolute/new-wiring-results
pnpm test:generated --suite=identity --artifacts=/absolute/new-identity-results
pnpm test:generated --suite=media --artifacts=/absolute/new-media-results
pnpm test:generated --suite=regeneration --artifacts=/absolute/new-regeneration-results
pnpm test:generated --suite=faults --artifacts=/absolute/new-faults-results
pnpm test:generated --suite=all
```

`core`, `wiring`, `identity`, `media`, `regeneration` and `faults` are implemented. Unknown or future suite names fail; `all` prints the implemented
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

The Identity fixture reuses the studio Favorites graph and Sign-in's Optional guard setting.
Account API uses Required sign-in and the installed Favorites template. A separate Viewer API
uses Optional sign-in. Both verify real Keycloak-signed access tokens. The only attachments are
the eligibility hook, a catalog stub and product SQL publishing two eligible items while excluding
a draft. The original report retains both required custom gaps; no generated authentication,
favorites transactions, permissions or runtime code is replaced.

| Behavior | Executable test | Observations |
| --- | --- | --- |
| B07 | `identity.system.test.ts` | Local Keycloak admin API creates two disposable accounts; real authorization-code PKCE S256 sign-in reaches both edge guard routes with the expected subjects; missing, malformed and signature-tampered tokens fail Required routes, anonymous Optional succeeds and invalid Optional fails; repeated PUT returns the same creation time and one durable row; GET/list/DELETE follow the documented 200/404/204 contracts; account B cannot read or remove A's favorite; missing/draft items return NOT_ELIGIBLE; ordinary stop/start retains runtime history, secret hashes, volume identity, both user IDs/passwords and the favorite; new sign-ins and writes still work |

Accounts exist only in the disposable generated provider database; this adds no studio account
feature. The browser flow adapts the archived v3-17 operator harness into maintained typed source,
with five-second request bounds. Provider observations independently check rows in the generated
favorites table, the published catalog view and Keycloak's user table. Successful app requests
use normal signed account tokens; admin credentials only provision users.


The Media fixture saves the PF14-reviewed v4 backend graph separately, with an explicit map of
hooks, two stub bodies and the lifecycle's product SQL. Its provenance records original source
hashes and ownership. The shared domain codec lives in the reported lifecycle hook; no additional
scaffold, browser override or generated runtime is copied. Any verified disposable account can
upload; this fixture adds no creator-role management. Installed templates own multipart state,
transactions, outbox relay, lifecycle receipts/publication, FFmpeg encoding, search projection,
counts, immutable detail caching and favorites.

| Behavior | Executable test | Observations |
| --- | --- | --- |
| B08 | `media.system.test.ts` | Synthetic H.264/AAC MP4 is generated at run time by the export's pinned FFmpeg image; its byte size/hash and FFprobe output are recorded. Real PKCE sign-in starts an upload; an actual first part survives a separate ListParts status request and transfer resumes with remaining parts. Repeated complete returns the current 200/pending contract; normal read-only object credentials independently verify the original hash. A paused worker establishes pending exclusion before real processing/publication. Public delivery returns master and both rendition playlists, actual H.264/AAC segments and JPEG thumbnail, inspected by FFprobe. Invalid bytes reach terminal INVALID_MEDIA; a separate part-uploaded abort is independently absent at the provider (NoSuchUpload) and cannot complete. Only the ready asset reaches public details/search/favorites. An actual publication envelope is confirmed into RabbitMQ with the subscriber paused, observed queued, consumed after restart and leaves the identical one search document. The same stack counts two reports of one play once and supplies idempotent, account-isolated favorites with durable rows. |

No owner media, downloads or committed binary is used. FFprobe checks codecs, dimensions and
positive duration; it does not establish human listening or browser playback. Multipart's 200
completion and missing creator-status UI remain known product limits (gap 1), outside B08's
required invariants. All normal application operations use account tokens; admin access is only
provider setup/observation. [GS06 evidence](../../docs/plans/generated-system-tests/evidence/gs06/README.md)
records cold/warm boundaries, costs and scoped cleanup.

The Regeneration fixture is the command-authored catalog-only portion of Wiring: one public
API, PostgreSQL and Valkey, with the same three mapped hook/stub/SQL attachments byte for byte.
`design.json` sets a four-second TTL; `design-b.json` derives from it through one edit command
setting sixteen seconds. `provenance.json` saves the authoring commands and owned-source hashes.
Neither the authoring helper nor another provider topology is part of the running application.

| Behavior | Executable test | Observations |
| --- | --- | --- |
| B10 | `regeneration.system.test.ts` | Separate fresh A and B exports fill/hit/expire/refill against real Valkey; B stays live after A's seven-second expiry bound. A stops, public `update:v2 --check` is read-only, public update applies B, and ordinary `pnpm start` resumes with the original project, ports, exact runtime/history/secret hashes and volume identities. Exact owned-file hashes, database/relation IDs, row count and data including row transaction IDs survive; a random extra published row absent from product SQL proves this is retained state. Updated A demonstrates B expiry, and a final read-only update check requires zero scaffold replacements. |

Expiry bounds are specified in the scenario independently of generated bindings. INFO-only
counters bracket API hits; GET/PTTL observations are kept outside that bracket. Missing/draft
records remain uncached. The first independent B export supplies the new scaffold oracle: every
updated non-owned file and the exact new manifest must match it before the harness changes its
baseline. Original A/B manifests/reports remain in their stack evidence; `baseline-transition.json`
lists the intentional setting-driven changes. Final scaffold checks remain enabled. This covers
the compatible TTL setting change, not arbitrary topology or schema migrations.
[GS08 evidence](../../docs/plans/generated-system-tests/evidence/gs08/README.md) records the
failed authoring input, independent fresh exports, update/preservation observations and checks.

The faults suite reuses the Regeneration (catalog), Activity and Media fixtures unchanged; it
adds no fixture, owned file or provider. Faults are real process and network controls on
containers discovered by exact project label (`docker stop`, `start`, `kill`, `pause`,
`unpause`), a held PostgreSQL row lock, and one temporary trigger gate. Each fault's precondition
is an assertion; an unobserved boundary fails the run. Broker rows restart no application process:
each running process keeps its container, start time and zero restarts, and each broker client
logs its `broker` failure line and then `"state":"available"`. Containers stopped before a fault
as its precondition are judged separately. The precise interruptions run one copy of the
targeted worker or relay, unlike B02's competing copies.

| Behavior | Executable test | Observations |
| --- | --- | --- |
| B06 recovery | `faults.system.test.ts` | Catalog cache stopped for eight seconds of reads, then (separately) frozen with `docker pause`: every read answers 200 from PostgreSQL within 1.5 s and counts one authoritative load; the frozen cache's first read waits out its 150 ms deadline. The API logs `cache catalog-read` (lost) and `cache read catalog-read` (failed read), then `"event":"cache","state":"available"` once restored. A cleared key is refilled by one read (exact value, 2–4 s PTTL) and the next read is one INFO-measured hit with no load; the API is never restarted |
| B09 counter | `faults.system.test.ts` | A harness transaction holds the total row; a submitted event's increment waits behind it (`pg_stat_activity` lock wait from the worker's address) while RabbitMQ shows the delivery unacknowledged. The worker is killed; the same backend, transaction and statement are still waiting after the kill. Releasing the row lets the dead backend end with nothing committed; the delivery returns to the queue; the restarted worker commits exactly one increment and receipt. Then, as duplicate-delivery proof (not a commit/ack crash), the committed envelope is replayed through the real exchange with the worker stopped, observed queued, and consumed: total and receipts unchanged, nothing in `.failed` |
| B09 broker | `faults.system.test.ts` | Five confirmed events wait in the queue with the Counter stopped (precondition). The broker stops for at least 12 s: submissions answer 503 within 1.5 s and reads 200, at the start and after two failed reconnect attempts; no running process exits. After `docker start`, the queue still holds the five, the 503's identity is resubmitted and counts once, and all accepted identities commit exactly once. A second outage with the Counter running shows publisher and consumer failure/available lines and resubscription without restart |
| B09 database | `faults.system.test.ts` | PostgreSQL stops right after committed work. Submissions are still accepted (broker only); reads answer 503 within 1.5 s; the Counter's failure is observed (its process exits, its raw output retained). After restore and the README's documented `pnpm start`, every accepted identity commits exactly once and a new request succeeds |
| B09 media | `faults-media.system.test.ts` | A 40-second synthetic video (pinned FFmpeg, under 30 MiB) keeps an encode observable. (1) The Transcoder is killed while `docker top` shows FFmpeg on the processing job; the job returns to its queue, the restarted worker re-encodes, details stay 404 until ready, delivery is FFprobe-valid and there is exactly one publication. (2) A trigger on the outbox, scoped to that video's `jobs` row and waiting on a harness-held advisory lock, blocks the relay's `sent_at` update after its confirmed publish (job observed queued); the Upload API (the relay's process) is killed, the dead backend ends uncommitted, the gate is removed, the restarted relay sends the intent again and marks it sent; two copies of the job yield one publication. (3) The broker stops while FFmpeg runs another job and a completed upload's intent waits in the outbox: reads answer, a play answers 503, the intent is deferred, the job in hand runs on and fails only its final publish; after `docker start`, all eight broker clients log available, no process restarted, both videos become ready once and the play's identity counts once |

Database gates block execution only: the trigger supplies no effect, retry or deduplication, is
scoped to one row of the known relation and is dropped (and checked absent) before recovery
assertions. Untested here: a PostgreSQL outage while a template worker's pool is idle, exact
consumer commit/ack crash timing, network partitions, Garage, OpenSearch, Keycloak and Valkey
data loss. [GS07 evidence](../../docs/plans/generated-system-tests/evidence/gs07/README.md)
records each boundary, duration and limit.

Transient passwords, PKCE verifiers/codes/state, OAuth tokens and session cookies are registered
before use in a mode-0600 private sibling file under the mode-0700 OS temporary run directory.
No OAuth forms, URLs, headers or response bodies are recorded. The private file survives until
global reporter sanitization and interrupted-run recovery have scrubbed observations, failures,
JSON and JUnit; cleanup then removes the entire private temporary directory. Unreadable, malformed
or symlink redaction inputs fail closed. A disposable probe exercises failure reporters and
recovery before deletion, including unreadable-input failure and stale-marker removal:

```sh
pnpm --filter @jeeves/generator exec tsx integration/privacy-probe.ts /absolute/new-privacy-results
```

Run generated suites and browser checks in separate phases: changing Compose networks can
interrupt Chromium module loading. Keep image builds separate from offline checks too, so they
do not compete with existing test deadlines.

`integration/author-activity.ts`, `integration/author-wiring.ts`, `integration/author-identity.ts` and `integration/author-regeneration.ts` record the studio commands
used to author the saved diagrams. They are development helpers, never application runtime
code. To rebuild the diagrams deliberately:

```sh
pnpm --filter @jeeves/generator exec tsx integration/author-activity.ts
pnpm --filter @jeeves/generator exec tsx integration/author-wiring.ts
pnpm --filter @jeeves/generator exec tsx integration/author-identity.ts
pnpm --filter @jeeves/generator exec tsx integration/author-regeneration.ts
```

Evidence defaults to ignored `test-results/generated/<run-id>/`. It contains source and fixture
hashes, commit/dirty state, tool versions, original manifest/report (gzip), install/build/start
logs, sanitized HTTP/SQL observations, container state/logs, JUnit/JSON results, final scaffold
hash verification, summary and cleanup inventory. Runtime secret values (including individual
JSON credential members) and the private transient identity inputs, bearer tokens and signed query parameters are redacted; `.runtime` and binary/provider data are never retained.
Use a fresh artifact directory for each invocation. A source change during setup fails the run.

Each completed stack captures its observations and behavioral result before removing its
containers, networks and volumes with exact project-label checks. `stack-cleanup.json` retains
the actual removal inventory; the outer cleanup remains idempotent for interruption/recovery.
Stacks execute sequentially, so expanded suites do not retain completed providers. Private
application directories, runtime secrets and transient redaction files remain until every global
reporter has been scrubbed; only then does outer cleanup remove the temporary run directory.
Docker build and provider caches remain. Success, failure and handled signals attempt cleanup. SIGKILL, host failure
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
with weekly scheduled `all` and manual `core`, `wiring`, `identity`, `media`, `regeneration`, `faults` or `all` selection. It calls the same command as a plain local shell:

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
Core keeps a 15-minute step inside a 20-minute job. One expanded manual suite allows a
30-minute step inside a 40-minute job; the CLI bounds one suite's serial Vitest command to 20
minutes. `all` (weekly, or chosen manually) runs every suite, faults included, so the CLI bounds it
to 40 minutes inside a 50-minute step and a 60-minute job. Each leaves headroom for the
three-minute recovery step and artifact collection.

Missing Docker, provider startup/install failures, changed source during setup, absent fault
observations and assertion failures are unsuccessful runs. Inspect the summary, phase, final
observation, container logs and cleanup evidence to distinguish their causes. Keep the source
stable, use a fresh artifact directory and restore or fix the diagnosed prerequisite before a
new invocation. Do not rerun a failing invariant until it happens to pass.

Local cost measurements and the controlled-failure proof are recorded in
[GS03 evidence](../../docs/plans/generated-system-tests/evidence/gs03/README.md). Hosted execution
is pending until the owner publishes these commits. Verify the first hosted run before making
its status required; only the owner changes branch protection.
