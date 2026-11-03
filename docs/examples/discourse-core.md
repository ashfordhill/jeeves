# Discourse core — partial backend design (P71a)

Choose **Library → Examples → Discourse core · partial backend design → Use example** to create
an independent editable project. Mattermost remains the default; existing projects are not migrated.
[The example](../../packages/spec/src/discourse-core-example.ts) uses the shared design model.

**P71a is a foundation, and parent P71 is incomplete.** Context, C2/C3, REST payloads/transports,
entities, aggregates, bounded reads and current access are authored. P71b owns executable command
and effect bindings, all eight typed H briefs, five scenarios, focused views, deployment intent,
unverified workload objectives and the final D01–D20 input/policy/state/effect/outcome case trace.
The example contains no backend operations, effects, hooks or implementation selections yet.
No template, generated application, runtime or benchmark pass is supplied. All D rows remain
**absent/not run, zero observed implementation points**.

## Boundaries and provenance

C1 contains visitor, member, moderator and administrator. An external thin client consumes the
backend contracts; it is outside generated scope. Private object storage and email are explicit
external boundaries. C2 has one modular API, one independent worker, authoritative PostgreSQL,
private bytes, external email and the external client. Named delivery/projection/cleanup channels
belong in PostgreSQL; there is no extra broker, cache or search cluster.

The API has ten responsibilities: existing account/session adaptation, membership/access,
categories, topics/posts/revisions, moderation, subscriptions/preferences, attachment lifecycle,
scoped search, protected audit and privacy requests. Four worker responsibilities own notification
and digest selection/delivery, projection maintenance, bounded cleanup and inbound mail processing.
An endpoint, table or H hook is not a separate process. All implementations remain planned.

[P60a's source map](../../benchmarks/discourse-core/v1/source-map.json) pins Discourse **v3.4.0**,
commit `05a304006600f36c3e45d19c9c5919f43f5541c9`. Its
[inspected facts and adaptation boundaries](../reference/backend-benchmarks.md#discourse-core-p60a)
remain authoritative provenance. TypeScript, REST/JSON/OpenAPI, append-only accepted edit history,
atomic command/receipt/event intent, current-policy private byte proxies and stronger replay and
revocation requirements are **Jeeves design decisions**, not upstream guarantees. No upstream code
or license text is copied into this example. The independent
[P61b REST contract](../../benchmarks/discourse-core/v1/contracts.openapi.yaml), fixtures, hashes,
66 observations and five scenarios are unchanged; this is not Discourse API compatibility.

## Exact definitions

[REST declarations](../../packages/spec/src/discourse-core-contracts.ts) describe all **35** frozen
operations across cohesive session/access/content/subscription/file/moderation/search/audit/privacy,
trust, digest and inbound-mail contracts. Methods, paths, parameter locations, JSON bodies,
success/error fields, headers, enums, nullable values and bounds are explicit. Local field-error
types share shape without copying another editable schema. Binary download is a distinct bounded
body; fixture descriptors are not JSON wire output. JSON content type and byte length come from
transport/body descriptors. Provider verification/session security still need P71b's precise
behavior bindings; a declared contract or access selection does not implement enforcement.

[Data definitions](../../packages/spec/src/discourse-core-data.ts) contain 23 entities and datasets:
workspace, group, workspace membership, group membership, category, category grant, topic, post,
immutable revision, subscription, notification, moderation flag, attachment metadata, association,
audit, trust profile, recorded activity, retention hold, abuse adjudication, digest, privacy progress/hold, inbound receipt and search
projection. Session principal IDs reference the existing session implementation; there is no second
user/session table. API ownership, worker module use and PostgreSQL authority remain explicit.
Private byte storage is outside SQL atomicity.

Topic, post and immutable revision form one consistency boundary with named rows in stable lock
order. Other mutable roots have exact optimistic versions. Per-operation selectors, per-post/topic
version guards, transactional receipt/outbox intent and failure behavior are still P71b. Authoritative
UUID IDs are globally unique, with scoped compound keys for references. Display renames preserve
physical identities. Subscription, event/recipient inbox, active flag, grant and receipt keys are
separate identities. A flag's active-review discriminator is distinct from command replay identity.

[Access and reads](../../packages/spec/src/discourse-core-access.ts) bind exact resource versions.
Current workspace membership gates scope; private category permission joins the real grant to
active membership in the same group. Public categories still require current workspace membership.
Post, revision, subscription, attachment association and search follow named parent relations to
the current category. Revocation uses current persisted state, no authorization cache, and all nine
sensitive recheck sites. Service selection uses a persisted recipient, bounded purpose and scope;
the initiating actor is provenance only. P71b still must bind recipient preferences and exact command
participants, including attachment owner plus parent access and both restructuring topics.

Read projections separate content visibility from row identity. Visible post text is readable;
hidden text requires moderator access; removed post text becomes `null` even for moderators.
The row/tombstone remains. Immutable history checks the **current parent post** and excludes removed
ordinary history while protecting retained internal text. Audit exposes only metadata. Read/null
redaction does not weaken accepted write input or make nonnullable persisted history nullable.

Eight bounded queries cover topic/post lists, history, preferences, inbox, review queue, audit and
search candidates. Default 25, maximum 100, explicit projections and stable keyset order are shared
with exact current policies. Search uses `(topic.createdAt, topic.id, post.id)` with a complete root
identity tie-breaker; every joined source has its own policy. Cursors do not establish authority.
Search matching/projection rebuild and precise notification preference rechecks remain the typed
P71b settings/effect bindings; no query runs in this package.

## Review and reuse

The example and every API contract state **partial** coverage. Review retains unsupported planned
hosts/components/relationships. P71a's design corrections add the originally specified finite
group-grant predicate, one-parent owner/visibility checks, bounded conditional read redaction,
named protocol string constraints and safe ordering through existing to-one joins. These supply
editable design vocabulary, not an authorization/query runtime or implementation descriptor.
See [access semantics](../backend-access.md), [data/query semantics](../backend-data.md) and
[contract types](../contract-types.md).

Use **Configure component → Data / Access** for exact definitions and **Inspect contract** for
REST operations. Save is one atomic edit; Cancel, Undo/Redo, reload and conflict recovery use the
ordinary project history. Referenced policies remain protected; use explicit successors for
semantic edits. Export uses the revision-bound architecture handoff. Library extraction includes
exact grant/membership/parent dependencies and retains physical storage identities; required
external roles must be explicitly bound when reusing a fragment.

P71b must resolve every remaining operation, recipient preference, effect, hook and scenario
obligation against the frozen ledgers. This partial example is not a complete design gate or a
foundation/complete-generation readiness claim.
