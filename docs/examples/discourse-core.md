# Discourse core — complete backend design (P71)

Choose **Library → Examples → Discourse core · complete backend design → Use example**. The
[example](../../packages/spec/src/discourse-core-example.ts) creates an independent editable project.
P71a supplied context, containers, contracts, data and access; P71b completes operations, effects,
eight typed H seams, five journeys, focused views, deployment intent and the final case trace.

**This is complete design intent. All runtime implementations remain unsupported, the application
is absent/not run, and observed implementation points remain zero.** No frontend, application
runtime, template, generated output, provider execution or capacity measurement is supplied.
Mattermost remains the default; existing saved designs do not adopt this example automatically.

## Boundaries and authority

Four people use an explicit external thin client. One proposed TypeScript modular API and one
independent worker share authoritative PostgreSQL. Private object bytes and external email have
exact adapter contracts; neither participates in SQL atomicity. Search starts with a PostgreSQL
projection. Named notification, projection, cleanup, digest and privacy channels use database
intent/claims; no broker, Redis, search cluster or per-component deployment is implied.

Fourteen C3 responsibilities separate sessions, access, categories, content/revisions, moderation,
preferences, files, search, protected audit, privacy, notification delivery, projection maintenance,
cleanup and inbound normalization. The existing session owner remains the only credential/principal/
session authority. The four session operations carry typed delegation, Origin/CSRF, durable opaque
session and application isolation requirements; registration grants no workspace privilege.

The current model contains 25 domain entities (including protected administrative audit and immutable adjudication history),
15 bounded queries, seven lifecycles, 41 domain/internal worker operations,
23 effects, 23 mechanism settings and eight pure hooks. The 35 frozen REST operations retain exact
methods, paths, parameters, accepted bodies, response/error fields, statuses and headers. Internal
worker operations have no public HTTP route; fixture reset/drain/fault controls remain test support.

[P60a's frozen source map](../../benchmarks/discourse-core/v1/source-map.json) pins Discourse
**v3.5.0**, commit `05a304006600f36c3e45d19c9c5919f43f5541c9`. P71a's historical v3.4.0 label is
superseded by the current design decision. [Source facts and adaptation](../reference/backend-benchmarks.md#discourse-core-p60a)
remain distinct: REST/JSON/OpenAPI, TypeScript, keyset cursors, immutable accepted history, atomic
receipts/event intent and current-policy byte proxying are Jeeves decisions, not upstream parity.
No upstream application code was copied.

## Exact behavior and failure boundaries

[Finite protocol plans](../../packages/spec/src/discourse-core-complete.ts) live on the same backend
operations as their exact wire targets, access, guards, writes, transactions and outcomes. They
bind all normalized input fields, selected records/keys, current policies/projections, field writers,
version fences, lifecycle dispatch, trusted hook snapshots and outputs. Procedure and derived-writer
choices are finite reviewed algorithms; explanatory pre/post text cannot introduce expressions,
SQL, JavaScript, a second workflow graph or an implementation claim.

- Topic create commits topic, first post, terminal command receipt and one post-created intent
  together. Reply increments the topic; an edit fences/increments only its post and appends the
  previous accepted text/version/author/time. Rejected commands leave no receipt or effect.
- Current authority precedes replay, which precedes expected-version fencing. Canonical normalized
  input binds operation version/scope/principal/key for seven days. A lost response is an explicit
  payload-free **Unknown / Reconcile first** outcome with no presumed HTTP response. Ordinary 409,
  unavailable hooks and other precommit failures leave state **Unchanged**. One HTTP503 error shape
  can name unavailable, failed/invalid/timeout and cancelled hook outcomes through bounded aliases.
- Topic open→closed→open and open/closed→archived, post visible→hidden→visible and visible/hidden→removed,
  flag review and file/digest/privacy states retain exact transition identities. Removed posts are
  terminal. Fresh-key removal at the current version is a same-version no-op without another audit.
- Current workspace/group grants apply before detail, list, history, snippets, counts, paging,
  downloads, inbox observations and effects. Hidden text requires moderator visibility; removed
  ordinary text is null/absent while protected internal history/holds remain inaccessible.
- File stage is committed before byte verification outside SQL. Association checks owner **and**
  current parent access. A SQL association failure leaves validated v2 bytes as a recoverable orphan,
  with no link/receipt/download; retry attaches once as v3. Cleanup selects only exact unlinked/
  incomplete objects older than 24 hours, rechecking claim/version/association before deletion.
- Worker selection uses persisted recipients and service purpose; the event actor is provenance.
  Event cutoff, current watch/mute and separate inbox/email flags apply per channel. Inbox and
  effect receipt commit together. Claims lease 30 seconds, reject stale acknowledgements, stop on
  shutdown and retain exhausted/uncertain states. Three explicit delays are 1/5/30 seconds; batches
  are at most 100 with durable continuation. Email follows committed intent outside SQL; uncertain
  acceptance retains one identity and requires reconciliation. SMTP does not promise exactly once.
- Search applies current source/category/removal state before matching, snippets or limits. Nullable
  tombstones are excluded before indexing/matching. Rebuilds use bounded batches and atomic projection
  versions; rebuilding cannot resurrect hidden/removed text. Search objectives and rank freshness
  are distinct: rank-v1 is fresh for 600 seconds inclusive and otherwise fails safely.

Existing exact v1 API, data, policy and aggregate definitions remain. Current API v2 successors
clarify state and delegation without changing frozen HTTP payloads. Dataset ownership remains one
API authority; exact worker grants allow bounded execution without copying domain ownership.
Local audit datasets are explicit source-transaction participants and expose only safe metadata.

## Eight remaining H implementations

Every [typed hook](../../packages/spec/src/discourse-core-hooks-contracts.ts) has exact input/result/
safe-error contracts, source owner/operation, allowed proposed writes, no direct repositories or
services, fixed acceptance IDs and a project-owned `src/hooks/*.ts` seam. Calls are pure, bounded to
two seconds and cooperatively cancelled. Missing/invalid/timed-out hooks return HTTP503 before any
domain mutation, receipt or intent. Read-only rendering/ranking never writes or publishes work.
The frozen [hook policy and examples](../../benchmarks/discourse-core/v1/hooks.md) are normative.

| Hook | Owner decision, precondition and validated postcondition |
| --- | --- |
| JH-trust / D13 | Admin, server activity in prior 30 UTC days; levels 1 at 10/2/1 and 2 at 50/10/5 reads/replies/approvals, highest wins, else 0; expiry demotes and authorized override never grants roles. |
| JH-abuse / D14 | Current post/owner appeal or moderator override, at most 20 prior decisions; abuse-v1 fixture classification/appeal/override proposes safe adjudication and reason, with no implicit hide/grant. Accepted decisions also append immutable history. |
| JH-digest / D15 | Owner and America/Chicago local-midnight half-open window including DST; at most 20 currently readable public non-muted topics, stable window identity; send rechecks preferences/access and reconciles unknown acceptance. |
| JH-render / D16 | Current topic/eligible mentions, source ≤4096 characters, ≤100 tokens/20 nesting levels; escaped/sanitized safe-v1 HTML ≤40000 characters, http/https links only, duplicate-free authorized mentions, no standalone effects. |
| JH-restructure / D17 | Moderator, distinct open same-category topics, both current versions, ≤100 selected posts; preserve post/history/file identities, copy subscriptions with target mute winning and channel union, atomic move/audit/receipt, merge archives source. |
| JH-privacy / D18 | Self/admin, authoritative subject posts/holds/pending deliveries and durable progress; export current readable owned posts, erase in fenced batches ≤100, preserve holds/audit, cancel only pending subject deliveries, resume one plan without duplicate tombstones. |
| JH-email / D19 | Source HMAC over timestamp plus original bytes, ≤300s skew, confirmed sender/single topic token, plain MIME ≤1MiB/100 parts/5 files; normalize and recheck posting, atomically deduplicate scope/source/message and normalized content. |
| JH-ranking / D20 | Current authorized visible candidates and server features; reply count over seven UTC days descending, last activity descending, topic ID ascending; validated subset/order/version/asOf, stale or foreign result safely unavailable. |

The frozen H17/H18 signatures and returned ID sets are bounded to 100. Owners reject oversized
inventories before mutation; they do not silently truncate subscriptions, privacy plans or output.
The privacy progress descriptor persists its exact validated plan and bounded continuation; current
holds can override a queued erase proposal before each batch.

## Journeys, views and unverified workload

The five [scenarios](../../packages/spec/src/discourse-core-journeys.ts) use existing C2 relationships:
D-create, D-revoke, D-edit, D-failure and D-moderate. Their expected outcomes preserve the exact 66
observation identities (lowercase local scenario IDs) and reference the independent literal oracle.
[The fixtures](../../benchmarks/discourse-core/v1/fixtures.json) alone own request/control ordering,
barriers, failure points, assertions and exact pre/post counts; the design does not execute them.

Three saved focused C2 views show content mutation, permission/revocation and async delivery over
these same identities. Companion Deployment shows a declared one-API/one-worker local arrangement
and later two-API target sharing authority. Neither claims running health, failover or cloud scope.

Frozen D-core objectives remain **unmeasured**: 10,000 principals, 100,000 topics, 1,000,000 posts,
50 offered requests/second for 600 seconds after warm-up, at least 20 active clients, 70% reads /
20% search / 10% writes; read/search p95 ≤500ms, command p95 ≤1000ms, notification/projection p95
lag ≤10s and unexpected failures <0.1%. Record actual CPU/RAM/SSD/container/DB limits, seed, offered/
achieved rate, failures, queue growth and resources. One/two-API, contention and restart/recovery
runs remain future work; the suggested 8-CPU/16-GiB host is not measured capacity.

## Final D01–D20 trace

[The machine-readable design trace](../../packages/spec/src/discourse-core-trace.ts) preserves all
20 weights/targets, source/adaptation identities, 66 exact expectations and fixture scenario/step
references. Its derived report resolves current wire/delegation, backend operation, data, policy,
query, hook and effect versions from the single design; every observation stays `not-run`, every
runtime stays `unsupported`, and observed points stay zero. G is a candidate template target, not
supplied behavior. The first twelve rows still total 66 points; H rows total 34.

| Case / target / weight | Exact contract operations | Authority and effect boundary | Frozen observations |
| --- | --- | --- | --- |
| D01 / G / 5 | `register`, `login`, `logout`, `getSession`, `createTopic` | Existing session owner | `D01-session-cycle`<br>`D01-session-boundary`<br>`D01-restart-session` |
| D02 / G / 5 | `putGrant`, `putMembership`, `putSubscription` | Membership, grants, subscriptions | `D02-category-grants`<br>`D02-privilege-escalation`<br>`D02-grant-replay` |
| D03 / G / 6 | `createTopic` | Topic + initial post + receipt/intent | `D03-topic-first-post`<br>`D03-denied-create`<br>`D03-atomicity`<br>`D03-lost-response-retry` |
| D04 / G / 7 | `reply`, `postHistory`, `editPost` | Topic, post, immutable revision | `D04-reply-edit-history`<br>`D04-foreign-author`<br>`D04-stale-write` |
| D05 / G / 6 | `transitionTopic`, `transitionPost`, `reply` | Topic/post lifecycle and audit | `D05-allowed-transitions`<br>`D05-invalid-transition`<br>`D05-transition-race` |
| D06 / G / 6 | `getTopic`, `listTopics`, `downloadFile`, `listPosts`, `postHistory`, `search`, `inbox` | Current authority on every sensitive path | `D06-granted-access`<br>`D06-denied-detail`<br>`D06-denied-list`<br>`D06-denied-search`<br>`D06-denied-bytes`<br>`D06-pending-notification` |
| D07 / G / 5 | `putSubscription` | Unique subscription + independent channels | `D07-watch-mute-preferences`<br>`D07-foreign-preferences`<br>`D07-duplicate-subscription` |
| D08 / G / 6 | `inbox` | Recipient query, inbox/effect receipt, delivery | `D08-eligible-inbox`<br>`D08-ineligible-recipient`<br>`D08-crash-deduplication` |
| D09 / G / 5 | `stageFile`, `putFileBytes`, `attachFile`, `downloadFile` | Private metadata, association, bytes/cleanup | `D09-file-lifecycle`<br>`D09-foreign-byte-access`<br>`D09-invalid-upload`<br>`D09-association-orphan` |
| D10 / G / 5 | `flagPost`, `reviewQueue`, `audit`, `reviewFlag` | Active flag, post CAS, protected audit | `D10-flag-review-audit`<br>`D10-unauthorized-review`<br>`D10-duplicate-stale-review` |
| D11 / G / 5 | `listTopics`, `search` | Authorized source/projection, bound cursor | `D11-bounded-search-pages`<br>`D11-invalid-cursor-scope`<br>`D11-projection-rebuild` |
| D12 / G / 5 | `transitionPost`, `listPosts`, `audit`, `postHistory`, `search` | Post tombstone, protected history/audit | `D12-tombstone-audit`<br>`D12-removed-history-visibility`<br>`D12-removed-search-visibility`<br>`D12-repeated-removal` |
| D13 / H / 4 | `evaluateTrust` | Recorded activity + trust proposal | `D13-trust-progression`<br>`D13-untrusted-counters`<br>`D13-activity-replay` |
| D14 / H / 5 | `adjudicate` | Post/adjudication + appeal/override | `D14-adjudication-appeal`<br>`D14-policy-authority`<br>`D14-adjudication-unavailable` |
| D15 / H / 5 | `scheduleDigest`, `getDigest` | Eligible topics/window + digest/delivery | `D15-digest-window`<br>`D15-digest-exclusions`<br>`D15-digest-delivery-retry` |
| D16 / H / 4 | `render` | Authorized source/mentions; pure result | `D16-safe-render-mentions`<br>`D16-unsafe-render-recipient`<br>`D16-renderer-unavailable` |
| D17 / H / 4 | `restructure` | Both topics/posts/history/subscriptions | `D17-split-merge-history`<br>`D17-merge-authority`<br>`D17-split-merge-recovery` |
| D18 / H / 4 | `privacy` | Subject/holds/progress + pending cancellation | `D18-privacy-plan`<br>`D18-privacy-boundary`<br>`D18-privacy-resume` |
| D19 / H / 4 | `inboundEmail` | Verified source/message + reply/intent | `D19-email-reply`<br>`D19-email-source-authority`<br>`D19-email-deduplication` |
| D20 / H / 4 | `rank` | Authorized candidates/features/projection | `D20-deterministic-ranking`<br>`D20-ranking-visibility`<br>`D20-ranking-rebuild` |

## Editing and reuse

Use **Configure component → Behavior → Bounded protocol plan** for procedure, inputs, records,
trusted snapshots, version fences and dispatch. Smaller sections keep exact inputs and writers
inspectable; derived algorithms stay finite choices. Data, Access, Effects & hooks and Settings
use their existing exact-reference editors. Save is atomic; Cancel, reload, Undo/Redo and stale
revision conflicts retain normal project behavior. Referenced exact definitions use successors.

Revision-bound JSON/Markdown handoff includes the complete plan; SVG exports the loaded view.
Library extraction retains effects, recovery scenarios/actors and every exact dependency. The
complete fragment has 21 roles, so the finite fragment bound is 32; old 20-role entries retain
their identities. The aggregate bound is 100 so two preserved-version compositions (84 aggregates)
fit; 101 rejects. External client/object/email roles and the scenario Member actor require explicit
selection during insertion;
exact pinned reuse preserves storage identities and does not duplicate backend definitions.
Design-operation writes are bounded to 4MiB, allowing the complete preserved-version snapshot
and one insertion; other API routes retain their existing body limits. No unbounded import or
implicit truncation is introduced.
