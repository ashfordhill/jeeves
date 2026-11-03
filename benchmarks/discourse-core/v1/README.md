# Discourse-core v1 independent acceptance pack (P61b)

**Contracts and expectations only. Discourse-core is absent/not run.** These files establish no
application logic, supported template, provider approval, runner, benchmark pass or measured points.
P61b completes only the D child of P61; V/Z fixtures and the combined gate remain P61c/d.
The [frozen manifest](manifest.json), [66 mandatory observations](requirements.json),
[integrity pins](integrity.json) and [P60 source map](source-map.json) are unchanged.

- [contracts.openapi.yaml](contracts.openapi.yaml): OpenAPI 3.1, encoded using JSON syntax, which is
  valid YAML 1.2. All routes, body/response/parameter types and security declarations are exported
  from the [independent acceptance schemas](../../../packages/spec/src/discourse-benchmark.ts).
  This exports no runtime descriptors. Snapshot equality is checked offline.
- [fixtures.json](fixtures.json): fixed seed, two scopes, eight actors, typed initial rows, all
  20 cases / 66 observations, ordered requests, negative payloads and exactly five scenarios.
  [fixtures.ts](fixtures.ts) validates through the P61a interfaces and frozen ledger, returning a
  typed `BenchmarkFixture`; it does not run the descriptions.
- [hooks.md](hooks.md), [hooks.contracts.json](hooks.contracts.json) and
  [hooks.examples.json](hooks.examples.json): all eight pure hook seams, independently typed
  inputs/results, exact policy choices, fixed examples, authority/effect boundaries and recovery.
- [hello.txt](hello.txt): intentional six-byte attachment fixture, UTF-8 `hello` followed by LF,
  SHA-256 `5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03`.
  `fixtureFile` in an expected download is test support's file descriptor, not JSON on the wire.
  The HTTP success is those actual bytes and the declared MIME/length/disposition, with no redirect.

Read with [protocol v1](../../protocol/v1/README.md), the
[scope/scenarios](../../../docs/plans/backend-benchmarks/benchmarks.md#3-discourse-core) and
[P60 decisions](../../../docs/reference/backend-benchmarks.md#discourse-core-p60a).
Expected state and counts are authored constants. No runtime SQL, generator or hook evaluator is
imported to produce them. Offline tests validate structure/identity/payloads and fixed invariants;
they cannot establish access, crash safety or delivery correctness in an absent application.

## Authority, state and transport

The configured loopback origin is `http://127.0.0.1:4321` (future disposable application only; no
server is started here). Its session cookie is `jeeves_session_ab8d833d23266de108e6deb84bbba24f`.
P61a owns cookie hashing/attributes, Origin/CSRF, errors, no-store/correlation, key normalization,
seven-day replay and exact principal/scope/operation identities. Fixture correlation and CSRF values
are deterministic injected values, never live credentials. Login/register use only email/password.
Public registration does not create scope membership or privilege. Test support establishes seeded
credentials and roles outside the production API. Each successful public login/register stores its
unique fixed sample cookie in the jar for the returned principal ID; subsequent named actor requests
use that principal's current jar. These opaque sample token values are fixture-factory outputs.
D-create logs the administrator and Alice in again after advancing beyond session expiry. Every
scenario starts independently from the full same seed, clock `2026-10-30T12:00:00Z`, empty command/effect receipts, audit, projection work and inbox.

Suffixes of the `d1000000-0000-4000-8000-…` UUIDs distinguish fixed identities: scopes 1/2; Alice 11,
Bob 12, admin/moderator 13, second moderator 14, foreign member 15 and revoked member 16. Provider
17 has source authentication, no user cookie authority; newly registered account 18 has no grants.
Groups 21/22 and private categories 31/33 belong to their matching scope; public category 32 belongs
to scope 1. Alice and both moderators are active red members; Bob and revoked are initially revoked.
Alice has trust level 0/version 1; each scope has a ready projection version 1 as of the fixed clock.
Bob remains an active workspace member with access to public content. Foreign has only scope 2.

Trusted workspace membership gates every session route, including public-category content. Anonymous
has account/session endpoints only; an unauthenticated scoped route returns 401. Named resources
that are absent, private, foreign-scope or outside current category access return the same 404 safe
body. Readable objects with a disallowed action return 403. Moderator routes additionally require
current moderator/admin authority. Only admin may write membership/role/grants; no self-promotion.
Category `write` includes `read`. All referenced group/category/subject/post/file IDs must be in the
validated scope. The server selects principal and scope; no request body can assign audit actor,
author, owner, activity counters, provider identity or arbitrary roles.

Topic create commits topic, first post, command receipt and one post-created outbox intent together.
Reply increments its topic version and adds one post at version 1 plus one intent. Post edits fence
only the post, increment its version and append its previous text/version/author/time to immutable
history. The seeded private post is version 3 with two historical revisions. A barrier makes
`edit-winner` obtain the CAS first: one v4 write, three historical revisions total, one new receipt;
the loser gets 409 without a receipt or intent. Barriers select scheduling in test support, never
through an application endpoint. Parallel same-key creation permits one declared in-progress 409
with `Retry-After: 1`; retry uses the same key. Response loss asserts no presumed HTTP status or
rollback; subsequent replay plus inspection establishes one committed command.

Moderators may transition topic open→closed, closed→open, open/closed→archived; archived is terminal.
Closed/archived reject ordinary replies with 422 at the current version. Posts allow visible→hidden,
hidden→visible, visible/hidden→removed; removed is terminal. A fresh-key remove of an already removed
post at its current version is a terminal no-op: same version/tombstone, no extra removal audit.
A same-key replay is checked before expectedVersion, with current access checked first. Stale
new commands return 409. Rejected commands do not change state, audit, receipts or intents.

Ordinary history/search hide hidden and removed text; removed list entries contain `text: null`.
Moderators may read hidden revisions after category authorization; removed text is excluded from
ordinary history/search even when immutable internal revisions remain protected. Audit is
moderator-only metadata (`actorId`, action, target, time), never an alternate text/identity export.
A flag is unique per active reporter/post; a second key for that active flag returns the same flag.
Review CAS, hide action, flag version and audit commit together. D-moderate grants Bob access before
flagging, races two moderators, then revokes Bob before public paging.

Subscriptions are unique per scope/principal/topic, owner-only, with `watch` or `mute` and distinct
inbox/email channels. First PUT uses expectedVersion 1 and returns version 2, including create.
Muted/removed/revoked/author recipients are ineligible. Recheck current access/preferences before
inbox materialization, every inbox read and external delivery. A post-created event has one inbox
receipt per recipient, independent from its command receipt. Lost worker acknowledgement retries
the same event; a worker's stale lease cannot acknowledge another claim. External mail is separate:
uncertain send goes to reconciliation and is not blindly sent with a new identity.

Listing uses `(createdAt ASC, id ASC)`, post history `(version ASC, postId ASC)`, inbox/audit/reviews
`(createdAt ASC, id ASC)`. Search orders `(topic.createdAt ASC, topicId ASC, postId ASC)` after scoped
plain-text matching, using current source visibility before snippets/page bounds. No implicit total,
unscoped aggregate or hidden feature exists in a page. All seeded topics have tied timestamps;
inaccessible private topic 103 sits between public 102 and 104. The fixed cursor strings in samples
are deterministic fixture-adapter tokens for their operation/query/order/scope/last tuple. They
must be authenticated by the future adapter, never treated as authoritative text. A changed query,
foreign scope or tampered cursor rejects with 400; a valid old cursor rechecks current access.
Search rebuild reads source policy/removal state and cannot resurrect deleted text. The `rebuild` control queues a bounded full search/ranking projection rebuild; `drain` executes
it. Repeating a rebuild preserves current results while advancing its projection version.

Attachments allow only text/plain and image/png, 1–10485760 bytes, owner-only staging/upload/link,
sha256 and actual MIME/size verification. The portable fixture JSON transports base64 upload bytes;
the object adapter decodes outside SQL and verifies them before validation. Stage→validated→attached
uses versions 1→2→3. Association checks current parent and file-owner policy, not the filename or
knowledge of an ID. A failed association preserves validated bytes as an orphan retaining v2 for
same-key retry, but no link/receipt or available download. Interrupted bytes are unavailable.
Unlinked/incomplete objects are reclaimable after 24 hours; the fault scenario advances to
`2026-10-31T12:00:01Z` and asserts removal of the selected orphan only. Storage and SQL are not
claimed to share a transaction. Already attached unrelated objects remain outside that selector.

## Five executable descriptions and test-support boundary

| Scenario | Ordered contract and independently fixed oracle |
| --- | --- |
| D-create | Account lifecycle/restart/isolation; privilege denial; private create after dropped response yields one topic/post/receipt/intent; precommit failure yields zero; simultaneous identical input has one owner; trust promotion/demotion/override and rendering boundaries. |
| D-revoke | Grant Bob, authorized private detail/bytes/cursor, one subscription, queue reply then revoke; detail/posts/history/bytes return 404, list/search/inbox/replay exclude private data. Digest window/reconciliation and subject privacy hold/cancellation/resume. |
| D-edit | Reply, two edits at version 3 → one version 4 and one new revision; topic state/closed-reply rejection; post hide/restore; atomic split/merge identity/subscription recovery; authenticated inbound mail receipt replay. |
| D-failure | Worker crashes after inbox commit before ack → restart still one inbox/receipt; byte verification, storage interruption, SQL association failure/retry and 24-hour orphan cleanup; private/foreign file rejection. |
| D-moderate | One active flag; one of two moderator claims hides post and creates one audit; removal/tombstone and metadata audit; interleaved policy-before-page search/list, cursor rejection and rebuild; abuse appeal/override and rank freshness. |

The future adapter owns reset/seeding, deterministic IDs/time/correlation, session establishment,
original-byte HMAC signing, barriers, faults, worker stop/restart/drain and privileged inspection.
`request` and `parallel` steps compare literal status/body/headers (or observe connection loss).
`control` steps have typed input/output and literal equals/absent assertions. Every observation
names its owning operation(s) and has explicit request assertions; subsequent inspection compares
state. Fixture controls are **not HTTP application routes** and may only operate in a disposable
loopback harness. No production bypass or runner integration is added.

`inspect.selector` is a bounded named adapter inspection, not SQL or an expression. `command-key:*`
selects only rows/effects caused by that command; `hook:*` checks only that invocation; `attachment`
checks only listed attachments. `edited-post`, `flag`, `removed-post`, `restructure*`, `trust`,
`source-message`, `privacy-subject`, `digest`, `event-recipient` and `recipient:*` select the named
entities/relationship or event cause. `receipts` means terminal command receipts, `inboxReceipts`
means durable worker-effect receipts, `messageReceipts` authenticated mail receipt identities.
`intents` counts original domain event intents, not handler fan-out; `deliveries` counts emitted
sensitive payloads, `providerAttempts` actual send calls and `logicalDeliveries` stable delivery IDs.
`forbiddenTextOccurrences: 0` scans the selected ordinary output/projection/queued delivery surfaces,
not protected legal-hold bytes or internal retained audit storage. Arrays of versions follow input
ID order; unrelated rows are never silently counted. `mutationWinners`/`versionConflicts` inspect
barrier-group outcomes. Whole-body equality asserts exact array membership and excludes extra
private IDs/text; explicit absent assertions additionally forbid privateTitle and implicit totals.

Fault points name exact boundaries: precommit rollback; connection loss after command commit;
worker death after inbox/effect receipt commit before ack; partial object write; attachment SQL
precommit; restructuring precommit; privacy after one durable batch; hook timeout/invalid output.
Every fault is one-shot unless cleared, with a named operation. Restart preserves persistent
sessions/receipts and releases/expires leases only according to the fixture clock. Leases last 30 seconds; D-failure restarts at
`2026-10-30T12:00:31Z` before retrying. Drain processes at
most 100 selected jobs, with finite attempts (three, delays 1/5/30 seconds), fenced claims, and
explicit exhausted/reconcile state; it never loops until success. `completed` counts handled jobs,
`suppressed` ineligible recipients, `crashed` controlled process deaths and `uncertain` ambiguous
external sends. A completed notification job may also suppress a recipient. Hook `reference` means
the later test adapter supplies the declared deterministic reference result, not an implementation
of application glue or proof that a hook is supplied. All H cases stay not run when absent.

## Offline validation

```bash
pnpm work run unit packages/spec/src/discourse-benchmark.test.ts packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/delivery.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
```

Use Node 24 and the batch's authorized lint/type/focused-offline policy. Contract checks verify
strict positive/negative payloads, all identities/routes, snapshots and literal invariant values.
`benchmarkFixtureUnavailable` can declare 66 not-run/blocked observations with a reason and has
no pass or scoring option. No results file is written here. P74/P79 owns actual execution.
