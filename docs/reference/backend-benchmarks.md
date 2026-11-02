# Backend benchmark reference packs

These are inspected architectural references for the [backend roadmap](../build-plan-backend-benchmarks.md),
not application implementations or coverage evidence. P60a supplies Discourse only; P60b owns Vendure,
and P60c owns Zammad and the combined reference review. Their unstarted packs must not be inferred
from this document. The [frozen ledgers](../../benchmarks/README.md) remain authoritative.

## Discourse-core (P60a)

Inspected 2 November 2026. Selected the released **v3.5.0** snapshot, deliberately without claiming
it is the latest release or a recommended dependency. The
[official release announcement](https://meta.discourse.org/t/3-5-0-major-release/379212) is dated
19 August 2025. The [official tag page](https://github.com/discourse/discourse/releases/tag/v3.5.0)
and [annotated tag object](https://api.github.com/repos/discourse/discourse/git/tags/67904f7b4ce20bf74a2b2d8d3af6c0020d116585)
resolve tag object `67904f7b4ce20bf74a2b2d8d3af6c0020d116585` (19 August 2025, 02:51:46 UTC) to
commit **`05a304006600f36c3e45d19c9c5919f43f5541c9`** (02:33:48 UTC that day).
The pinned [version constant](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/version.rb#L8-L18)
also identifies 3.5.0. No default branch is a permanent reference.

The [cache manifest](architecture-sources.json) adds `discourse` alongside the five unchanged
2026-10-30 pins. Its 21 complete source/license files total 304,410 bytes. The
[machine-readable source map](../../benchmarks/discourse-core/v1/source-map.json) records every
path, SHA-256, immutable source URL and inspected line range, plus all 20 D-row mappings and their
66 unchanged observation identities. Ranges identify the reviewed excerpts within complete cached
files; they do not claim every dependency/caller was audited. There is no copied runtime code.

```bash
pnpm references fetch discourse
pnpm references verify discourse
pnpm references verify all
```

`fetch` downloads only missing listed files and rejects hash mismatches. `verify` is offline.
Files live under
`.jeeves-work/references/discourse/05a304006600f36c3e45d19c9c5919f43f5541c9/<source-path>`.
An offline reader needs that cache from a previous fetch; the Git checkout contains the locators
and hashes, not a whole upstream mirror. Use `rg` and the map's ranges to revisit the findings.

### License boundary

The selected paths belong to Discourse's open-source core. The inspected
[LICENSE.txt](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/LICENSE.txt)
contains GPL version 2; [COPYRIGHT.md](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/COPYRIGHT.md)
states GPL version 2 or later for the program and identifies trademark and third-party notices.
Both files are cached and hashed. No separately licensed feature was selected. Plugins, themes,
bundled third-party code/assets, and separately licensed or hosted features are outside this pack;
this is no conclusion about their licenses or availability. No H row is marked absent from
open-source Discourse merely because its implementation was not inspected. Future direct reuse
needs its own provenance/license review; this package adopts architectural ideas only.

### Inspected facts and deliberate adaptations

All links below use the full commit above. Source IDs resolve to exact hashes and ranges in the
sidecar. “Observed” means static code inspection, not an executed upstream guarantee or security
certification. Proposed Jeeves behavior remains unimplemented and unverified.

| Source IDs / inspected responsibility | Observed source fact | Limit and Jeeves adaptation |
| --- | --- | --- |
| `dc-principal`, `dc-session`: [Guardian](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/guardian.rb#L105-L152), [token model](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/models/user_auth_token.rb#L75-L135) | Guardian receives a user or anonymous principal. Tokens persist hashed values; lookup checks age, with rotation elsewhere in the same file. | These excerpts do not establish the entire registration/login/logout/CSRF protocol. Reuse Jeeves's existing session boundary, application isolation and durable revocation. Do not port the upstream token derivation. |
| `dc-category`, `dc-topic-access`: [category grants](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/guardian/category_guardian.rb#L4-L73), [topic visibility](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/guardian/topic_guardian.rb#L266-L284) | Category management requires admin/configured moderator authority. Visibility checks unrestricted categories or secure category IDs; topic checks delegate to category/private-message policy. | Admin/staged-user exceptions and memoized grants are upstream choices. A category/group is not automatically a tenant. Jeeves uses trusted workspace scope, finite grants and current persisted membership on each relevant request/worker execution. |
| `dc-post-access`, `dc-revision-access`: [post permissions/history](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/guardian/post_guardian.rb#L300-L355), [revision permissions](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/guardian/post_revision_guardian.rb#L4-L26) | Post reads distinguish hidden/deleted content and privilege. Hidden revisions require staff; edit-history visibility includes wiki/public-history shortcuts. | Do not infer universal parent authorization from these methods alone: the public-history shortcut precedes later post checks. Jeeves always applies current category and removal policy to history; hidden text is moderator-only under the benchmark policy. |
| `dc-create`: [creation boundary](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/post_creator.rb#L186-L259), [transaction selection](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/post_creator.rb#L391-L399) | Topic creation and initial post save occur inside the transaction wrapper; failed post save calls rollback handling. Reply creation also uses a topic mutex. Unique-post-key storage and follow-up publication occur afterward. | This is not the frozen canonical-input command receipt or proof of safe lost-response replay. Jeeves requires one SQL transaction for topic, initial post, command receipt and durable event intent. No Redis/mutex dependency is adopted. |
| `dc-revise`: [revision flow](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/post_revisor.rb#L219-L335), [history writes](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/post_revisor.rb#L582-L637) | A revision operation uses a transaction. Depending on the version/grace-period branch it creates, updates, or removes the current revision record. | Upstream history is not strictly append-only. Jeeves appends prior text/author/time on every accepted edit and uses atomic expectedVersion checks; concurrent stale-edit rejection has not been inferred from upstream. |
| `dc-topic-access`, `dc-review`: [moderation permissions](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/guardian/topic_guardian.rb#L339-L357), [flag review](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/models/reviewable_flagged_post.rb#L46-L82) | Topic actions have privilege checks. Pending flagged posts offer hide/keep/delete actions; agreement records the moderator on active flags. | Base review locking, controller authorization and queue claims are not comprehensively inspected. Jeeves requires explicit state tables, unique active reporter/post flags, version-fenced review and transactional audit. No inherited double-action prevention claim. |
| `dc-remove`: [removal](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/post_destroyer.rb#L178-L260) | Removal updates related state, notifications and conditional staff logs; permanent deletion also destroys revisions. Actor-dependent author removal/restoration follows other branches. | Neither all removals nor all audits share one universal retention policy. Jeeves preserves deliberate tombstones/protected audit while suppressing ordinary text/history/search, including repeat removal. Privacy retention/legal holds stay D18 policy. |
| `dc-subscription`: [topic preference changes](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/models/topic_user.rb#L140-L193) | Updates an existing user/topic row or creates one; handles an insert uniqueness race. | The internal function accepts a user ID; it is not route-level owner authorization. Jeeves authenticates the preference owner and enforces scoped subscription uniqueness and bounded channels. |
| `dc-alert`: [notification materialization](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/services/post_alerter.rb#L527-L628) | Checks notification eligibility and mute preferences, then examines recent existing notifications to suppress repeat types. Mention extraction is a separate method. | A read-before-create suppression check does not prove crash/concurrent deduplication. Jeeves needs transactional per-event/recipient inbox receipts and current-policy rechecks; sanitized rich text remains D16. |
| `dc-job`: [worker execution](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/jobs/base.rb#L260-L357), [publication](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/jobs/base.rb#L380-L447) | The Sidekiq worker selects site DB context, records errors and reraises a wrapped exception. Queued publication uses an after-commit callback. | After-commit publication alone leaves a crash window before queue push. Jeeves uses PostgreSQL atomic intent, finite retries, fenced claims and visible exhaustion; no upstream exactly-once guarantee or retry-count default is asserted. |
| `dc-mail`, `dc-notification-cleanup`: [mail eligibility/retry](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/jobs/regular/user_email.rb#L4-L89), [inaccessible inbox cleanup](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/jobs/regular/delete_inaccessible_notifications.rb#L4-L16) | Mail rechecks current post access; SMTP-busy errors get delayed retry timing. Digest preferences are checked later. A separate job deletes notifications for unreadable topics. | Asynchronous deletion is not immediate revocation; mail-send ambiguity is not resolved by a retry timer. Jeeves rechecks sensitive inbox reads/materialization/delivery and records uncertain external outcomes. D15 chooses its own digest selection/window. |
| `dc-search`: [candidate query](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/search.rb#L1161-L1175), [category filter/paging](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/search.rb#L1264-L1291) | Search joins posts/search data/topics, excludes hidden posts, filters restricted category IDs, and uses offset/limit. Relevance uses configurable category/rank weights and bumped time. | Not a complete index/list/rebuild audit. Jeeves uses bounded keyset cursors with stable ID ties and authoritative access/removal checks before emitting snippets/counts. Discovery ranking remains versioned D20 policy. |
| `dc-upload-policy`, `dc-upload-route`: [classification](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/lib/upload_security.rb#L75-L129), [secure bytes route](https://github.com/discourse/discourse/blob/05a304006600f36c3e45d19c9c5919f43f5541c9/app/controllers/uploads_controller.rb#L184-L207) | Security classification considers settings/reference history/controlling post. Secure routes call a permission helper and redirect to expiring store URLs; size checks use settings. | Permission-helper/provider internals and cleanup are not audited. A previously issued signed URL can outlive revocation. Jeeves proxies authorized private bytes, caps core files at 10 MiB with a finite MIME list, and models recoverable staging/association separately. |

### Every D row has a provenance boundary

The sidecar's `rows` array covers the frozen manifest in order, preserving G/H targets and required
observation IDs. A primary `source` means inspected inspiration with deliberate adaptation; it
does not mean the upstream excerpt guarantees every row observation. A primary
`jeeves-specific-decision` names a bounded hook whose semantics cannot be inferred from the pack.

| Row | Primary reference or decision | Required Jeeves boundary |
| --- | --- | --- |
| D01 | `dc-session` | Durable session protocol, credentials/mutation protection, restart and application isolation. |
| D02 | `dc-category` | Current same-scope grants; no self-promotion; replay uniqueness. |
| D03 | `dc-create` | Atomic topic/first post/receipt/intent; canonical-input replay after response loss. |
| D04 | `dc-revise` | Immutable edit history and one expectedVersion winner; current author/history access. |
| D05 | `dc-topic-access` | Finite topic/post transitions; rejected/stale actions change nothing. |
| D06 | `dc-category` plus search/upload/mail paths | All six revocation observations; no detail/list/title/snippet/count/byte/pending-effect leaks. |
| D07 | `dc-subscription` | Owner-only watch/mute/channel preferences and one scoped subscription. |
| D08 | `dc-alert` plus worker/mail paths | Durable eligible inbox and per-recipient receipts across crash/lost acknowledgement. |
| D09 | `dc-upload-route` | Private staged/validated/associated files, current bytes authorization and orphan recovery. |
| D10 | `dc-review` | Unique active flags, version-fenced moderator review and atomic action/audit. |
| D11 | `dc-search` | Bounded keyset reads, access-filtered search, rebuild and deletion visibility. |
| D12 | `dc-remove` | Tombstones/protected audit; repeat-safe removal and suppressed ordinary history/search. |
| D13 | `JH-trust` (Jeeves decision) | Server activity snapshot → proposed level/reasons; privileged change command. |
| D14 | `JH-abuse` (Jeeves decision), review context | Bounded content/history → allow/review/reject; explicit appeal/override. |
| D15 | `JH-digest` (Jeeves decision), mail context | Principal/timezone/window/eligible IDs → bounded selection and deduplication identity. |
| D16 | `JH-render` (Jeeves decision), mention context | Source/format/context → sanitized representation and bounded authorized mentions; no network/grants. |
| D17 | `JH-restructure` (Jeeves decision), permission context | Source/target versions/post IDs → validated move plan with preserved identity/history and recovery. |
| D18 | `JH-privacy` (Jeeves decision) | Subject/authority/retention/hold policy → bounded export/erase plan, retained reasons and progress. |
| D19 | `JH-email` (Jeeves decision) | Verified envelope/bytes/message ID → normalized authorized reply candidates or rejection. |
| D20 | `JH-ranking` (Jeeves decision), relevance context | Authorized candidates/features/version → ordered subset, stable ties and freshness metadata. |

Every H decision in the sidecar also records rejection/recovery, the remaining exact policy choice,
and its next specification owners. Unimplemented hooks return the benchmark's HTTP 503 without
domain changes; that readiness rejection earns no functional points. No trust algorithm, abuse
classifier, renderer, split/merge implementation, privacy engine or inbound-mail parser was audited.
The mail excerpt does not establish digest selection and the relevance excerpt does not establish
a discovery product policy. These are identified evidence limits, not assertions that upstream
lacks those capabilities.

### Decisions still owned by later assignments

P60a has no unresolved source-location/pin blocker. Before **P61b**, fix independent endpoint,
success/error/header schemas and fixture values for every frozen observation. For the H rows this
includes trust thresholds/activity window; abuse appeal/override results; digest timezone/window,
selection and duplicate-delivery policy; format/parser/sanitizer limits; split/merge subscriptions
and recovery; privacy retention/holds/cancellation; inbound authentication/thread/MIME/deduplication;
and ranking features/ties/freshness/rebuild. Do not generate expectations from an implementation.
**P71a/b** then bind the authoritative model and typed hook briefs, including transaction boundary,
timeout/cancellation, allowed dependencies/effects, private data and owned paths. None of these
decisions permits changing the frozen v1 behavior to match convenient upstream code.

The shared roadmap deliberately uses **REST/JSON and OpenAPI** for all three cores. Discourse's
[API documentation](https://docs.discourse.org/) is supplementary moving documentation; only the
pinned source above establishes this pack's source facts. Vendure's upstream GraphQL API will be
adapted to REST without API parity; **P60b** records its actual source facts. Zammad's planned core
uses a **reduced first-response SLA**: business-time clock from creation, stopped by an authorized
customer-visible agent reply, not an internal note or pending state; closing cancels without
satisfying it, and reopening adds no new first-response clock. **P60c** must distinguish that
benchmark choice from inspected upstream SLA behavior. Neither adaptation is licensed as an
upstream fact by this Discourse-only assignment.

No template availability, observed benchmark pass, upstream execution, production capacity,
generated application or runtime change follows from this reference pack. Parent P60 remains
incomplete until P60b/c supply their own evidence and the combined review.
