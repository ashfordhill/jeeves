# Discourse v1 hook contracts and independent policy choices

P61b fixes the **acceptance contract**, not an implementation. H rows remain explicit project hooks
and absent/not run. [Typed seams](../../../packages/spec/src/discourse-benchmark.ts) export to
[hooks.contracts.json](hooks.contracts.json); [fixed examples](hooks.examples.json) validate both
inputs and results. HTTP requests/results and failures are in [the five scenarios](fixtures.json).
The [P60 map](source-map.json) remains unchanged: these choices resolve its `remainingDecision`
items for fixtures, without implying upstream behavior or completion of P71b's implementation brief.

All hooks receive validated, scope-bound snapshots from their owner. Only original-byte verified
provider context enters email normalization. Body IDs, counters, role flags, selected candidates
and legal-hold assertions from a client cannot substitute for trusted snapshots. Inputs/results
are strict and bounded; the owner validates result references/subsets and current policy again
before exposing bytes/text or committing effects. Unknown fields and invalid result identities
fail closed. `hooks.examples.json` contains data only, not executable policies/evaluators.

Hooks have a 2000ms deadline, cooperative cancellation and no implicit retries inside a transaction.
No external I/O, database writes, filesystem access, credential access, network requests, grants or
queue publication are permitted in these pure strategy calls. The owner may supply only the listed
snapshots and execute the listed effects. Availability/timeout/invalid result returns safe HTTP
503 `HOOK_UNAVAILABLE` before domain mutation, receipt or intent; lookup/action authorization still
precedes hook execution. Unknown source authentication returns 401 before email parsing. Default
unavailable is never a fallback allow/empty success. Fixture `reference` mode supplies fixed sample
results through test support only. Every hook has a declared success path, rejection path and
material replay/failure/unavailable path; none has been run against an application.

| Hook / row | Trusted input and validated result | Owner and permitted effects |
| --- | --- | --- |
| JH-trust / D13 | Principal/current level, policy, server activity window and authorized override → proposed level/reasons. | Admin-only trust command CAS; one level change/audit/command receipt, no membership/role grants. |
| JH-abuse / D14 | Current post text, bounded prior decisions, policy and authorized appeal/override → allow/review/reject with safe reason. | Moderation owner persists adjudication version/audit/receipt; hide/remove require their own allowed transition and audit. |
| JH-digest / D15 | Principal, Chicago half-open window and already eligible candidate IDs → at most 20 selected IDs and stable window identity. | Digest owner persists one schedule/delivery intent per principal/window/policy; worker rechecks access/preferences at send. |
| JH-render / D16 | At most 4096 source characters, format and authorized mention candidates → sanitized HTML and at most 100 eligible mentions. | Pure render owner may persist validated representation only alongside a separate accepted post edit; standalone render has no writes or notifications. |
| JH-restructure / D17 | Moderator-authorized source/target, versions, selected posts and subscriptions → subset move plan. | One SQL command locks topic IDs ascending, rechecks both policies/versions and commits moves/subscriptions/audit/receipt together; no external effects. |
| JH-privacy / D18 | Subject/authority, versioned policy, owned post IDs, authoritative holds, queued deliveries and progress identity → exact export/erase/retain/cancel plan. | Privacy owner writes durable plan, fenced batches, pseudonymization/tombstones and cancellation; protected hold/audit access stays privileged. |
| JH-email / D19 | Verified source, message/body hash, original bytes and authorized sender/thread candidates → one sender/topic/plain-text body and at most five attachment refs. | Inbound owner rechecks posting policy and topic state, then commits reply/topic version, source-message receipt and intent atomically. |
| JH-ranking / D20 | Already authorized candidates/features, clock, projection/algorithm version and bound → ordered subset, freshness metadata. | Query owner rechecks visibility and membership of returned IDs before serialization; no mutations or provider access. |

## Trust: trust-v1

Use server activity in `[now minus 30 calendar days UTC, now)`. Counters are sums of immutable,
uniquely identified recorded events, never client counters. Level 1 requires at least 10 reads,
2 replies and 1 approval in that window. Level 2 requires 50 reads, 10 replies and 5 approvals.
Otherwise level 0; lower recent activity can demote. Highest satisfied threshold wins. Level 1/2
qualification uses reason `qualified`, expiry to 0 uses `inactive`. Admin override 0–2 requires
current admin authority, uses reason `override` and does not alter roles or historical activity.

At fixture time Alice's three server records supply 10/2/1, so v1→v2 level 1. Replay produces no
second change. At `2026-12-01T12:00:00Z` they are outside the window: v2→v3 level 0. Authorized
override gives level 2/v4. An activityCount field is malformed 400; ordinary override is 403.
Three trust changes/receipts are fixed. Missing hook at the next version changes nothing.

## Abuse: abuse-v1

The deliberately simple reference classifier marks text containing case-insensitive literal
`needle` as `review` with reason `fixture-token`; literal `blocked-spam` gives `reject`, otherwise
`allow`, using that same safe rule reason. This is a fixture policy, not a useful spam model or
request-rate limiter. Prior decision history is bounded to 20. Seeded public post 202 contains
`needle`, so its owner gets review version 1. An owner appeal provides the fixed false-positive
context through the owner's persisted case and yields allow/version 2, `appeal-accepted`.
The client cannot supply a classifier decision, history or privilege.

Only current moderators may `override-allow`; the second accepted override yields allow/version 3,
`moderator-override`. Ordinary Bob gets 403. Timeout at version 3 returns 503, preserving that
version and zero new hook writes. Replay is the shared command protocol, not another moderation
transition. Hook output cannot itself grant access or hide a post without owner validation.

## Digest: digest-v1

Schedule local midnight once daily in `America/Chicago`, covering the preceding local calendar day
as a half-open `[start, end)` window. UTC bounds are explicit accepted inputs and must agree with
that local window; inverted/non-midnight/mismatched bounds are 422. The fixture day is
`2026-10-29T05:00:00Z` through `2026-10-30T05:00:00Z`. For fall-back, the local day 1 November 2026
would be `2026-11-01T05:00:00Z` through `2026-11-02T06:00:00Z` (25 hours); no fixed-24-hour shortcut.
A topic created exactly at start qualifies; at end it belongs to the next window.

Select only public, currently readable, non-muted topics with visible posts created in the window,
ascending `(createdAt, topicId)`, at most 20. Private content is excluded even when Alice can read it;
W is muted; U is the sole selected fixture topic. Window identity is
`<scopeId>:<principalId>:<start>:<end>:digest-v1` and is unique across keys. Recheck current access,
mute/channel preferences and removal at materialization/delivery. A later revocation suppresses
private or now-inaccessible content; no previously selected ID supplies authority.

One intent/delivery identity survives request replay. The mail fixture accepts but loses its ack:
state becomes uncertain/version 2, one provider attempt and one logical delivery. Worker redrain
makes zero new sends. Explicit provider reconciliation reports accepted, yielding delivered/version 3.
This reference provider supports that lookup; SMTP Message-ID alone would not. A provider lacking
reconciliation requires an operator-visible uncertain state and possible duplicate delivery, never
an exactly-once assertion or blind new-key send. Unavailable hook creates no schedule/intent.

## Rendering: safe-v1

The reference format supports plain text, `**strong**`, single-line paragraphs, and `@alice`, `@bob`,
`@revoked` mention tokens. It escapes raw HTML, recognizes no embedded HTML/scripts/images, and
permits only http/https links; unsafe schemes lose the link while retaining escaped label text.
No remote fetch or user-supplied HTML is allowed. Maximum input 4096 Unicode characters, 100
recognized tokens, 20 formatting nesting levels, 40000 output characters; beyond budget is safe
422 (schema length overflow is 400). No recursive/network parsing. This is a required renderer
contract; the actual parser/sanitizer dependency is a later implementation choice.

The fixed examples assert exact safe output for strong text and a script/javascript-link attack.
Mentions must be members who can currently read the topic; Bob/revoked are omitted in private T.
Public U permits Bob. Standalone rendering sends no notifications; later post-owned mention
materialization must use those IDs and recheck eligibility. Malicious hook HTML, added recipient,
timeout or unavailability yields 503 with no writes/notifications, not an unsanitized fallback.

## Restructure

Split means moving a nonempty subset of posts into a distinct, existing same-category topic;
merge moves all visible/hidden/removed post identities from source to that target. At most 100
selected IDs; each must still belong to source. Source/target must be in the same validated scope,
same category and open. Cross-category moves reject 422 rather than silently changing access.
Non-moderators get 403; foreign/inaccessible resources get 404. A stale source or target is 409.
Post IDs, authors, versions, revisions and attachment associations are preserved. A source topic
with no posts remains as an empty topic; a merge archives the source, with the declared topic
version increment. The supplied move plan cannot duplicate or invent a post.

For selected posts, copy each source subscription to target if absent. Existing target mute wins
against source watch, union channels with distinct values, one row per principal/topic; split
retains source subscriptions, merge removes source subscriptions. The fixture splits Q from U to W
(v1/v1→v2/v2), retaining Q's identity, then merges Q/K from W to U (v2/v2→v3/v3). Alice's merged
subscription is one mute row on U, because W was muted. SQL-precommit interruption leaves both
posts on W, both topic versions at 2 and zero receipt. Retry commits both together; history and
post identity counts never change. Unavailable hook makes no move. Request cancellation before
commit rolls back; a lost response after commit requires same-key replay.

## Privacy: privacy-v1

Only self or an authorized administrator can export/erase; foreign subject is 403 and inaccessible
scope remains 404. Export contains only the subject's currently readable owned posts, no other
identity/private text or retained staff notes. It uses plan 802; export is not the erase progress
identity. Erase uses plan 801 bound to subject/policy/key and principal expectedVersion 1. Pseudonymize
principal, tombstone authored content and suppress ordinary revisions/search; preserve protected
metadata audit without email/password/source text. Legal hold on post Q retains its protected bytes
and association with reason `legal-hold`; no public or foreign-subject export bypasses the hold.

In D-revoke, Alice owns P/Q/J/K plus her new private reply. Erase tombstones P/J/K/reply, retains Q,
and cancels one not-yet-materialized delivery from Bob's public reply to subscribed Alice. Already
delivered digests cannot be recalled. Revocation's suppressed Bob delivery is unrelated and cannot
be counted as Alice's cancellation. One durable erase plan advances fenced batches of at most 100
posts; a crash after its first batch loses the response. Restart drains the same plan, and same-key
retry returns complete/version 2 with four erased IDs, held Q and one cancellation. No second plan
or duplicate tombstone/audit; inspection's `privacyPlans: 1` selects the erase plan. New exports after
erasure contain no erased text. Availability failure has zero new writes. Production retention,
legal advice and jurisdictional compliance are not claimed by this fixture policy.

## Inbound email

The adapter authenticates source `fixture-mail` using HMAC-SHA256 with a fixture-only generated
secret, over ASCII timestamp + `.` + **original HTTP body bytes**. Headers are `X-Mail-Timestamp`
(decimal Unix seconds) and `X-Mail-Signature` (lowercase hex digest); reject a timestamp more than
300 seconds from server clock, invalid signature, or an authenticated event whose message identity
was reused with different normalized content. Test support signs each sample's original bytes;
`fixture-hmac-valid`/`fixture-hmac-invalid` are fixture placeholders and must never be accepted as
production signatures. No committed secret or production authentication bypass exists.

Sender is selected from the verified source envelope and an exact confirmed email mapping, never
an arbitrary parsed From header. Exactly one topic token must resolve in the selected source scope;
zero/ambiguous mappings reject 422. Scope is resolved by configured source/token mapping, not a raw
client scope field. Normalization allows text/plain MIME, at most 1 MiB decoded source, 5 attachments
within file limits, 20000 normalized body characters and 100 MIME parts; unsupported MIME/ambiguous
multipart/over-budget content is 422. The fixed raw email is the minimal text/plain body `mail reply`.
No HTML execution, remote fetch or recursive forwarded-thread guessing.

The owner rechecks sender membership/current topic posting state before a reply. Public-alpha-token
maps to U; private-red-token maps to T; ambiguous-token has multiple candidates and is rejected.
After D-edit's restructure, U is open. First authenticated message commits one post (403 suffix),
source-message receipt and intent. Repeated same source/scope/message ID returns the same 201 after
current access recheck; changed normalized bytes returns 409, no second reply. Invalid signature is
401; Bob private reply is 404; unavailable mapping/hook returns 503 or explicit 422 as specified,
never a partial reply. Authentication timestamps are refreshed/signed by support on a real replay.

## Ranking: rank-v1

Candidates are current readable topics with visible posts; filter category/removal policy before
feature extraction, ranking/counting and limits. Compute server-recorded reply count over the last
7 UTC days; descending count, then descending lastActivity, then ascending topic ID breaks ties.
The fixture's public U and W have equal features and timestamps, so `[U, W]` is fixed. Hidden private
V and removed private post P cannot be added to the candidate set. Client features/extra query
fields are 400. The pure strategy may only return a duplicate-free subset of supplied candidates.
An injected inaccessible/foreign ID makes the whole result invalid → 503 without revealing it.

The projection snapshot is fresh for 600 seconds inclusive; at `12:10:01Z` the `12:00:00Z` snapshot
is stale and returns explicit 503. The search rebuild has already advanced projection version 1→2 before the first rank request.
The next rebuild increments version 2→3 but preserves `asOf`
and ordering at the same fixture clock. Repeated evaluation does not mutate or advance freshness.
Current visibility is reapplied after rebuild and before serialization; hook unavailability/stale
projection cannot turn into an empty success or a borrowed ordering from hidden features.
