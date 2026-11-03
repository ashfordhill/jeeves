# Independent Zammad-core v1 acceptance pack

**P61d is contract/fixture work only. The application, worker and all eight hooks are absent/not
run.** These are fixed expectations, not observed results. No template availability, benchmark
points, upstream API parity or production readiness follows from parsing them.

- [OpenAPI 3.1](contracts.openapi.yaml) (JSON syntax, valid YAML 1.2) and
  [independent strict types](../../../packages/spec/src/zammad-benchmark.ts) define 42 operations.
- [Fixed seed/requests/observations/scenarios](fixtures.json) bind the unchanged
  [20-row ledger](manifest.json), [66 observations](requirements.json) and [canonical pins](integrity.json).
  [Typed entry](fixtures.ts) requires that frozen ledger and validates payloads/references only.
- [Eight hook decisions](hooks.md), [hook schema snapshot](hooks.contracts.json) and
  [trusted input/result examples](hooks.examples.json) fix the H seams before implementation.
- [Original-byte signed source examples](sources.examples.json), [inbound MIME](inbound.eml) and
  [16-byte file](private.txt) use fixture-only secrets and invented data. No credential is live.
- [P60c source map](source-map.json) and [review](../../../docs/reference/backend-benchmarks.md#zammad-core-p60c)
  distinguish source facts from these deliberate Jeeves adaptations.

Use [protocol v1](../../protocol/v1/README.md) for errors, sessions, headers, paging, canonical
command identity, seven-day replay and fixture adapter isolation. The fixed loopback origin is
`http://127.0.0.1:4323`; its SHA-256-derived cookie differs from D/V. Public registration never
accepts role/scope/privileged fields. Actors' durable sessions/CSRF are established only through
login or disposable test support; an actor label is not production authority. Every response has
no-store/correlation headers. Commands require current Origin/CSRF and Idempotency-Key, apart from
authenticated source callbacks with their own message/revision identity.

## Access and projections

Scope is separate from organization/group. Alice and Bob belong to the same organization, with
`shareTickets: false`: each sees their own tickets. The agent and second agent have support-group
write membership, the supervisor/administrator also have the restricted group, and a revoked
agent has no current grant. A second application scope contains a foreign customer/group/ticket.
Administrative membership/organization/rule/calendar/SLA routes require the declared capability.
Assignment requires source and target grants, same-scope eligible assignee and CAS under lock.
Replay rechecks current membership and article/byte access before revealing a stored response.

Customer requests explicitly reject privileged fields. Customers may request a public follow-up;
internal visibility is forbidden. Article author/kind/time are server-established and immutable.
Every internal article lookup is 404 for a customer. Article paging/history and conversation export
exclude its text, ID and attachment references. File metadata and proxied bytes authorize both the
current ticket and article, including old byte references after a group move. Search filters current
policy before matching/snippets/paging; an internal-only match gives an empty page, without a hidden
count. Audit carries safe metadata and suppresses internal events for customers. Public response
notifications use public excerpts only; internal-note customer inbox/email counts are zero.

Ticket listing orders by creation time/UUID, articles/search/audit by article or event time/UUID.
Limit is 25 by default, maximum 100; no total count. Fixed cursor strings are future test-adapter
bindings to signed query/scope/last-tuple identities, never standalone authorization. The needle
pages put Bob/foreign records between Alice's authorized hits; tamper, foreign and query-mismatched
cursors reject. Moving a ticket to restricted immediately denies the former agent's reads, search,
audit/export, receipt replay, old byte reference and pending sensitive effects, before index rebuild.

## Fixed business time and clock policy

Calendar/SLA references are immutable `{id,version}` snapshots. Baseline Chicago working intervals
are Monday–Friday 09:00–17:00, half-open, with no remote feed. Holiday calendar v1 additionally
excludes **2026-11-02**. A separate **Sunday 00:00–04:00** calendar tests DST inside working hours;
it does not silently replace the weekday baseline. Positive duration is actual elapsed UTC time
whose local wall time falls in a working interval. Repeated fall time counts twice; spring's missing
hour contributes nothing. Invalid/overlapping/nonincreasing local intervals reject, not normalize.

All following values are committed literals, independently checked by a small test-only minute
counter using IANA time conversion, with no import from a runtime calculator:

| 120-business-minute case | Start UTC | Due UTC | Local result |
| --- | --- | --- | --- |
| Fall weekday/weekend | 2026-10-30 21:00Z | 2026-11-02 16:00Z | Fri 16:00 CDT → Mon 10:00 CST |
| Monday holiday | 2026-10-30 21:00Z | 2026-11-03 16:00Z | Tue 10:00 CST |
| Spring weekday/weekend | 2026-03-06 22:00Z | 2026-03-09 15:00Z | Fri 16:00 CST → Mon 10:00 CDT |
| Repeated Sunday hour | 2026-11-01 05:30Z | 2026-11-01 07:30Z | 00:30 CDT → second 01:30 CST |
| Missing Sunday hour | 2026-03-08 06:30Z | 2026-03-08 08:30Z | 00:30 CST → 03:30 CDT |
| Weekend start | 2026-10-31 12:00Z | 2026-11-02 17:00Z | Mon 11:00 CST |
| Exact interval end | 2026-10-30 20:00Z | 2026-10-30 22:00Z | Fri 15:00 → 17:00 CDT |

Creation starts first response. Internal notes, customer follow-ups, pending and resolution do not
stop/pause it. An authorized public agent reply satisfies it. Closing cancels an unmet clock,
with `satisfiedAt: null`. Explicit resolved→open creates no new first-response clock; closed→open
is unavailable. The core has one schedule generation; state updates increment deadline version.
A prior escalation is retained with a later `satisfiedAt`, so late response cannot erase lateness.

The clock scenario appends calendar v2 (10:00–18:00) and SLA v2 (180 minutes) without changing any
v1 deadline. New preview due is **2026-11-02T17:00:00Z**; existing due remains **16:00:00Z** across
restart. Overwriting v1 conflicts. Z15 explicitly owns additional clocks and recalculation.

## Five executable descriptions

Each scenario resets all declared datasets and starts at Friday 2026-10-30T21:00:00Z, with worker
automatic scheduling paused until requested. The report-only archived timeline (ticket identities 1501–1513, October 23–26) is separate from
the active ticket set (101–114); scenario mutations never rewrite that immutable input snapshot.
Steps execute in order. A barrier chooses the named deterministic winner for each contention test;
the race scenario also tests the opposite deadline commit order. No expected winner is inferred
from nondeterministic wall-clock ordering.

| Scenario | Authoritative invariants and forbidden outcomes |
| --- | --- |
| Z-create | Before initial article failure: zero tickets/articles/deadlines/receipts/intents/audits for the key. Lost committed response/retry: one of each, no changed-input replay. Session/capability and source hook cases also run here. |
| Z-private | Internal data absent from every customer surface; moved group denies the former agent. Partial bytes/SQL association never create readable partial files; retry protects one live link against cleanup while an abandoned orphan is reclaimed. One public inbox/receipt, unknown mail acknowledgement requires reconciliation. Knowledge/hold-aware privacy seams remain explicit. |
| Z-clock | Exact table above; internal/pending/customer reply keep running; public agent stops; close cancels; reopen creates no clock. Immutable calendar/SLA snapshots survive restart. Explicit additional-clock decisions preserve elapsed facts. |
| Z-race | Assignments at ticket v8 yield one v9 winner, one conflict and one audit. Response-first deadline transaction suppresses escalation. Escalation-first records one late outcome; satisfied/cancelled and fenced old claims cannot add one. Conversation/workflow retries preserve identities and versions. |
| Z-recover | Nine due baseline clocks remain late while worker is down. Crash after first commit leaves one receipt. Restart progresses backlog 9→8→6→4→2→0 in bounded batches; nine logical escalations total, no duplicate/fenced commit. Routing does not loop; reports preserve scoped counts after rebuild. |

Routing snapshots use ascending priority then UUID, explicit first/all mode, at most five actions,
and once per rule/originating event. Three all-match actions set high, assign eligible agent and
set normal; they do not create another routing event. A repeat with another command key still
cannot reapply the same event. Scripts, role grants, excess actions and foreign assignees reject.

## Future adapter and verification boundary

`controls` in the independent contract declare local-only faults, clock/ID factories, barriers,
worker start/stop/restart/bounded drains, fenced deadline claims, hook/reference provider modes,
projection rebuild, authoritative invariant inspection and a controlled concurrent customer edit.
They are **not production routes**. Inspection selectors identify command/event/recipient-specific
counts, not whole-database counts. The future adapter must map them explicitly to authoritative
state and inspect forbidden outputs. Seeded fixed times/UUIDs must bind deterministic factories;
request keys are durable command identities, not per-attempt IDs. Private-byte descriptors assert
file bytes/hash/content headers; they are not JSON delivered instead of bytes by an app.

Reference hook controls supply fixed typed outputs only in disposable tests; default, timeout or
invalid output returns 503 HOOK_UNAVAILABLE before domain writes/receipts/intent. Missing application
returns per-observation `not-run`/`blocked`, never pass. P74/P79 own execution integration; P73a/b
own design/data/access/brief bindings. Contract-only tests cover schema/negative payloads, fixed
UTC/arithmetic/bytes/identities, not live access, database transactions, worker fencing or provider
behavior. Mail unknown acknowledgement is not proof of SMTP exactly-once delivery. No runner alias,
app generation, provider account, runtime, benchmark result or observed implementation point exists.
