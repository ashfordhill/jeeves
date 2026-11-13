# Generated backend system tests

From the repository root, with Node 24.21.0, pnpm 12.16.1 and Docker Compose:

```sh
pnpm test:generated
pnpm test:generated --suite=core --artifacts=/absolute/evidence-directory
pnpm test:generated --suite=all
```

Only `core` is implemented. Unknown or future suite names fail; `all` prints the implemented
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
`events--counter` queue. This does not prove fanout or a separate work queue. Public API failover
allows transient edge responses while nginx refreshes names (10 s), and asserts a joint
submission/read recovery within 15 s after each stopped copy. Poll observations retain transient
responses; repeated submissions use the same stable identity. The edge stays single.

Run generated suites and browser checks in separate phases: changing Compose networks can
interrupt Chromium module loading. Keep image builds separate from offline checks too, so they
do not compete with existing test deadlines.

`integration/author-activity.ts` records the studio commands used to author the saved diagram.
It is a development helper, never application runtime code. To rebuild the diagram deliberately:

```sh
pnpm --filter @jeeves/generator exec tsx integration/author-activity.ts
```

Evidence defaults to ignored `test-results/generated/<run-id>/`. It contains source and fixture
hashes, commit/dirty state, tool versions, original manifest/report (gzip), install/build/start
logs, sanitized HTTP/SQL observations, container state/logs, JUnit/JSON results, final scaffold
hash verification, summary and cleanup inventory. Runtime secret values, bearer tokens and
signed query parameters are redacted; `.runtime` and binary/provider data are never retained.
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
