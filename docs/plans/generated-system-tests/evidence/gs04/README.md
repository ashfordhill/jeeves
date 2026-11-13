# GS04: real Wiring clients and immutable cache reads

Recorded 2026-11-13 above `655d4b3`. These are local results; hosted CI remains pending
publication. No template, generated scaffold, existing regression assertion, dependency pin,
historical field app or studio UI changed. Manual CI now offers `wiring`; core remains the PR gate.

| Run | Result | Full artifacts |
| --- | --- | --- |
| Current Wiring | B05/B06 normal 2/2; 132.740 s Vitest, 169.601 s including cleanup | `/tmp/gs04-wiring-confirmed`; `/tmp/gs04-wiring-confirmed-command.log` |
| Core regression | B01–B04 4/4; 220.730 s Vitest, 270.459 s including cleanup | `/tmp/gs04-core-final`; `/tmp/gs04-core-final-command.log` |
| Prior Wiring pass | 2/2; 174.355 s including cleanup, before the observation-order improvement below | `/tmp/gs04-wiring-final`; `/tmp/gs04-wiring-final-command.log` |
| First probe | B05 passed, B06 hit-counter observer assertion failed; exit 1 and complete cleanup | `/tmp/gs04-wiring-first`; `/tmp/gs04-wiring-first-command.log` |

`wiring/` retains original report/manifest gzip, source and tool identities, JUnit, results,
HTTP/SQL/provider observations, useful container/startup logs, mapped owned-file hashes and
scaffold checks, and matching scrub/cleanup evidence. Every stack freshly exported the saved
command-authored diagram through the default registry, attached only its explicit owned map,
and performed a frozen standalone install/build outside the workspace. The original report
still declares custom work and an unfinished search mapping; selections are twelve implemented
module stubs and the implemented positive-cache reader. `authoring-proof.log` records byte equality
between the saved design and current studio-command authoring output. Provider image pins are
listed in `provider-images.json` and the startup evidence.

B05 proves two independent inputs through a generated module call and an internal generated
HTTP process; the internal service has no public edge route. A separately managed private HTTP
fixture records the exact external request inputs. Its small custom adapter uses bounded native
fetch because external API dependencies have no installed endpoint adapter; no generated external
API client is claimed. External logs are captured on request/assertion failure, and its project
label enrolls the server in ordinary recovery. Search setup creates and observes a strict mapped
OpenSearch index with two documents; requests under test use the generated search client.

Three broadcast identities appear independently in each subscriber module's SQL effects. Two
work-queue consumers each commit alone on their own container identity, then compete for twenty
new IDs: exactly twenty-two durable effects, exact input values, drained ready/unacknowledged
messages and empty failed queues. The owned consumers add only domain inserts, not delivery,
retry or deduplication mechanisms. A generated object client writes/reads 4,099 known bytes with
an exact hash; actual valid keys scoped to the other private bucket fail reads and writes with
`403 AccessDenied` in both directions. An independent S3 SDK read with the internal service's
normal credential also verifies the durable internal request input.

B06 observes the exact immutable published record in Valkey, its four-second PTTL, an actual
HTTP cache hit (INFO-only counter increases exactly one and authoritative load count stays one),
actual expiry, reload/refill, and two uncached 404 reads apiece for missing and draft identities.
Activity mutable totals are never cached. Cache outage/recovery is deferred to GS07.

## Observation corrections and source boundary

`first-probe-failure/` preserves the initial expected delta two versus observed three: both the
observer's GET and PTTL count as Valkey key lookups. The corrected test measures INFO alone
immediately before/after the HTTP request, expecting exactly one hit, plus the same exact value
and unchanged authoritative-load assertions. No application invariant or timeout was weakened.

The first corrected Wiring run passed, then core passed on the same effective source. Review
noticed that the refill-value observation ran after a slow Compose log inspection and had only
61 ms of cache life left. `observation-order.patch` moves that value observation directly after
HTTP reload; it preserves every assertion, TTL and deadline. The complete Wiring suite passed
again. `source-boundary.json` confirms that only this Wiring test file differs from core's source;
all generated/owned application inputs are identical. The two Wiring exports' original compressed
report/manifest and final scaffold/owned hashes are byte/value identical. The earlier passing
run remains in `wiring-before-observation-order/`; it does not replace the current run.

## Privacy, cleanup and limits

`json-secret-probe/` retains the disposable probe and result. Sanitization now includes string
members of JSON credential files, covering individual S3 key values and pretty-printed objects.
The real probe also checks bearer/signed-query redaction, recovery scrubbing before runtime
deletion, unreadable-secret EACCES preserving runtime and clearing a stale marker, and successful
cleanup after repairing permission. These are synthetic credentials, never actual provider keys.
The existing upload-marker guard and fail-closed recovery behavior stay intact.

The failed Wiring run and both passing Wiring runs each removed 26 containers, two networks,
ten volumes and private runtime; core removed 27 containers, four networks and eight volumes.
All exact project inventories were empty and scrub markers matched. Completed stacks remain
until outer reporter sanitization: peak retained Wiring stacks are 26 containers. GS06 still
needs to review sequential resource cleanup before expanding providers; no runtime-secret
lifecycle change was made here. No cold/warm or hosted measurements are claimed for GS04.

`unimplemented-suite.log` records that future `identity` fails before creating artifacts and
reports exactly `core, wiring`. The workflow passes actionlint syntax/context validation using
the existing GS03 tool with shellcheck disabled. The first repository check stopped at copied
JSON formatting (`initial-formatting-check.log.gz`); formatting preserved all 49 parsed evidence
values, and compressed observations preserve the original bytes. Final regression results and
exact log paths are recorded in `verification.json`. No skips or test retries were introduced.
