# Backend benchmark reference packs

These are inspected architectural references for the [backend roadmap](../build-plan-backend-benchmarks.md),
not application implementations or coverage evidence. P60a supplies Discourse and P60b supplies
Vendure; P60c owns the unstarted Zammad pack and combined reference review. The
[frozen ledgers](../../benchmarks/README.md) remain authoritative.

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
pinned source above establishes this pack's source facts. Vendure's planned core adapts the
upstream GraphQL API to REST without API parity; [P60b below](#vendure-core-p60b) records its
source facts. Zammad's planned core uses a **reduced first-response SLA**: business-time clock
from creation, stopped by an authorized customer-visible agent reply, not an internal note or
pending state; closing cancels without
satisfying it, and reopening adds no new first-response clock. **P60c** must distinguish that
benchmark choice from inspected upstream SLA behavior. Neither adaptation is licensed as an
upstream fact by this Discourse-only assignment.

No template availability, observed benchmark pass, upstream execution, production capacity,
generated application or runtime change follows from this reference pack. Parent P60 remains
incomplete until all three children supply their own evidence and the combined review.

## Vendure-core (P60b)

Inspected 2 November 2026. Selected released **v3.3.0** as a stable research snapshot, not a
latest-version, dependency or security recommendation. The
[official release](https://github.com/vendurehq/vendure/releases/tag/v3.3.0) was published
**12 May 2025 at 11:53:38 UTC** (neither draft nor prerelease). Annotated tag
[`2f32df1378f62cc856b8a3474b5a98df516b0c54`](https://api.github.com/repos/vendurehq/vendure/git/tags/2f32df1378f62cc856b8a3474b5a98df516b0c54),
tagged at 10:58:13 UTC that day, resolves to full commit
**`a4c56359ec831b0c54dd01eab14fb75455c43ab7`**, committed **12 May 2025 at 10:57:57 UTC**.
The pinned [core package metadata](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/package.json#L1-L20) independently identifies version 3.3.0.
No default branch is a permanent source reference.

The [cache manifest](architecture-sources.json) appends `vendure` alongside the **six unchanged
prior references**, including P60a's Discourse. Its **25 complete source/license files total
344,731 bytes**. The [Vendure sidecar](../../benchmarks/vendure-core/v1/source-map.json) follows
P60a's format: release/tag/commit/date/license metadata, exact file hashes and immutable source
URLs, **43 inspected ranges**, all **20 V rows / 63 unchanged mandatory observations**, and source
versus Jeeves-specific decisions. Listed ranges describe inspected excerpts of complete cached
files; unread callers, adapters and strategies may add behavior. No upstream code is adopted.

```bash
pnpm references fetch vendure
pnpm references verify vendure
pnpm references verify all
```

`fetch` retrieves only missing listed files and rejects hash mismatches; `verify` is offline.
The cache is under
`.jeeves-work/references/vendure/a4c56359ec831b0c54dd01eab14fb75455c43ab7/<source-path>`.
An offline reader needs a prior fetch; Git holds hashes/locators rather than an upstream mirror.
No upstream dependencies were installed and no upstream application was run.

### Vendure license boundary

The selected paths are open-source core, including the repository's default job/search and email
plugin source. [LICENSE.md](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/LICENSE.md#L1-L42) identifies Community Edition's GPL terms and an
alternative commercial agreement. Its program notice and the pinned core package metadata state
**GPL-3.0-or-later**. The complete [GPL v3 text](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/license/gpl-3.0.txt#L1-L24) is cached; only its title/preamble
is a separately listed inspected range. The [plugin exception](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/license/plugin-exception.txt#L1-L20)
permits different licensing for separately distributed plugins using core APIs while distinguishing
modifications to core. It does not make copied core implementation permissively licensed.

No commercial agreement or separately licensed feature was selected. External plugins, hosted
features, bundled third-party code/assets and trademarks are outside the pack, with no conclusion
about their terms or availability. This is a boundary on inspected material, not a license review
of the full dependency graph or a claim that an uninspected H capability is absent or commercial.
Future direct reuse requires its own provenance and applicable license treatment; this package
records architectural ideas only.

### GraphQL source and REST adaptation

The inspected Shop/Admin files use **GraphQL** query/mutation decorators, generated argument/result
types and union error results. The [Shop order resolver](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/resolvers/shop/shop-order.resolver.ts#L315-L381) delegates
active-order commands to services, while the [Admin order resolver](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/resolvers/admin/order.resolver.ts#L54-L123)
requires staff permissions. These are source facts. The benchmark deliberately uses **REST/JSON,
OpenAPI, explicit HTTP errors, Idempotency-Key and expected aggregate versions**. It does not port
the GraphQL schema, expose a GraphQL compatibility layer or preserve endpoint/error parity. X1 is
separate work. P61a/c fixes the independent REST protocol/fixtures; P72a/b binds that contract to
the later design. None is supplied by this reference pack.

### Inspected commerce and recovery facts

All links use the full commit above; source IDs resolve to exact paths/hashes/ranges in the sidecar.
“Observed” means static inspection, not an executed guarantee or exhaustive concurrency/security
audit. Required Jeeves behavior below remains unimplemented and unverified.

| Source IDs / responsibility | Observed source fact | Limit and deliberate Jeeves adaptation |
| --- | --- | --- |
| `vd-auth`, `vd-shop-order`, `vd-admin-order`: [guard](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/middleware/auth-guard.ts#L48-L169), [owner reads](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/resolvers/shop/shop-order.resolver.ts#L74-L145), [staff permissions](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/resolvers/admin/order.resolver.ts#L54-L123) | The guard establishes session/context and checks permission metadata; it can create anonymous owner sessions and associate a customer with an active channel. Shop direct reads compare owner identity; staff order reads/changes have ReadOrder/UpdateOrder permissions. | Auth-disable/public/no-metadata branches and delegated channel selection are upstream choices. This is no complete login/revocation audit. Core checkout requires authenticated customers and existing Jeeves durable sessions; trusted shop scope and owner/staff access apply to lists/history/downloads/callbacks/workers. Channel token/order code alone is no tenant authority. |
| `vd-catalog`: [Shop products](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/resolvers/shop/shop-products.resolver.ts#L38-L76) | Product lists force enabled=true; detail rejects disabled products and removes private facet values. | Variant/asset bytes, publication mutations and their callers were not fully inspected. Jeeves must enforce current publication before detail/list/search/counts/assets, with bounded queries and repeat-safe publication. |
| `vd-order`, `vd-shop-order`: [order creation](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/order.service.ts#L425-L473), [cart updates](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/order.service.ts#L574-L684), [recalculation](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/order.service.ts#L1925-L2054) | A new Order starts before payment. Cart changes inspect state/quantity/configured limits, may constrain quantity while returning errors, and recalculate prices from server strategies. Recalculation can change order currency from request context. | This is different from a separate immutable checkout snapshot. Jeeves requires positive integer quantities <=1000, <=100 lines, authenticated cart ownership, expectedVersion and all-or-conflict commands with durable same-input replay. It atomically creates one line/address/price snapshot order and reservations from a valid quote. |
| `vd-calculator`, `vd-round`, `vd-payment-handler`: [calculation sequence](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/helpers/order-calculator/order-calculator.ts#L53-L140), [rounding](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/common/round-money.ts#L1-L18), [payment amount interface](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/config/payment/payment-method-handler.ts#L30-L89) | Calculation resets promotions, applies tax/promotions/shipping and recalculates totals; rounding delegates to MoneyStrategy. The payment result interface documents integer amounts. | Interfaces/delegation do not prove safe arithmetic or overflow guards. Jeeves fixes USD minor units, validates safe-integer upper bounds before arithmetic and snapshots quote inputs. Flat shipping and fixture tax are core fixtures, not production tax/carrier integrations; V13–V15/V18 remain hooks. |
| `vd-order-process`, `vd-order`: [state graph](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/config/order/default-order-process.ts#L173-L235), [guards and history](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/config/order/default-order-process.ts#L298-L453), [transition persistence](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/order.service.ts#L1183-L1204) | The default graph includes AddingItems, ArrangingPayment, payment/partial-shipment/delivery/modification states. Configurable guards check contents/customer/shipping/stock, covered payments and fulfillment status. Placement records quantities, publishes an event, invokes seller splitting and writes transition history. | Options can disable guards; these are not the frozen benchmark states or expected-version semantics. Jeeves freezes a smaller graph, rejects unpaid shipment/forged payment/stale actions, and keeps transitions/audit/receipts atomic. Seller splitting is an inspected call, not audited seller payout or isolation. |
| `vd-allocation`, `vd-stock-movement`, `vd-stock-level`: [allocation timing](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/config/order/default-stock-allocation-strategy.ts#L1-L26), [adjustments/allocations](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/stock-movement.service.ts#L84-L192), [release](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/stock-movement.service.ts#L317-L357), [stock operations](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/stock-level.service.ts#L56-L135) | Default allocation runs when ArrangingPayment becomes PaymentAuthorized/PaymentSettled. Services persist allocation/release movements and update allocated stock; stock availability is strategy-based. Inspected updates read values before updating them. | No conclusion about every caller's locks follows. These ranges do not establish a last-item race guarantee or expiring prepayment reservations. Jeeves reserves atomically at checkout in one location, serializes competing stock changes, and separates active/held/consumed/released/expired states. Unknown payment holds stock; expiry and start-payment must choose one valid transition after restart. |
| `vd-payment`, `vd-payment-process`, `vd-payment-handler`: [payment create/settle/cancel](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/payment.service.ts#L104-L209), [default payment process](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/config/payment/default-payment-process.ts#L26-L91), [handler delegation](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/config/payment/payment-method-handler.ts#L354-L395) | Payment creation awaits a configured handler before saving the payment result. The default graph includes Created/Authorized/Settled/Declined/Error/Cancelled; settlement maps handler success/error. Transition history and covered totals can drive order state. | No raw-byte callback authentication, durable attempt receipt or accepted-but-timeout resolution was inspected. Jeeves dispatches outside SQL transactions with a durable provider identity, records unknown/payment-review, holds stock and reconciles signed late settlement once. Duplicate/older failure cannot reverse settlement. V08 is a local reference protocol; V19 still needs a named concrete adapter. |
| `vd-order`, `vd-fulfillment`: [quantity checks](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/order.service.ts#L1465-L1549), [fulfillment persistence](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/fulfillment.service.ts#L50-L146) | OrderService checks selected quantities against existing fulfillment lines; the inspected helper finds a matching line. FulfillmentService calls a handler, persists fulfillment/lines and publishes an event. | A matching-line read is not proof of a cumulative concurrent ceiling or retry deduplication. Jeeves sums all active shipments under aggregate concurrency control and caps by paid/reserved/remaining quantities. Same-key retry returns one shipment; external carrier ambiguity is separate. |
| `vd-payment`, `vd-admin-order`: [refund constraints](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/service/services/payment.service.ts#L275-L358), [staff refund boundary](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/api/resolvers/admin/order.resolver.ts#L54-L123) | Refund code inspects prior refunds, constrains refundable amounts and selects a payment handler. Staff refund mutation requires UpdateOrder. | The selected range does not audit full refund execution, return eligibility, concurrent quantities or provider reconciliation. V16 specifies those separately, including one refund identity across ambiguous responses. |
| `vd-event`, `vd-sql-job`, `vd-polling`: [event stream](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/event-bus/event-bus.ts#L100-L154), [commit-aware subscribers](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/event-bus/event-bus.ts#L311-L348), [job insertion](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/plugin/default-job-queue-plugin/sql-job-queue-strategy.ts#L39-L49), [claim/update](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/plugin/default-job-queue-plugin/sql-job-queue-strategy.ts#L82-L174), [execution/stop](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/job-queue/polling-job-queue-strategy.ts#L92-L175), [shutdown timeout](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/job-queue/polling-job-queue-strategy.ts#L178-L229) | RxJS events wait for an associated commit before ordinary subscribers. SQL job insertion can use a passed transaction context. PostgreSQL-style claiming locks a pending/retrying row and marks it RUNNING; retries apply backoff. Polling persists completion/failure and graceful stop can defer work. | Commit-aware in-memory events are not an outbox. These claim/update ranges do not establish expired RUNNING recovery, a lease token or stale-worker acknowledgement fencing. Graceful stop cannot prove hard-kill recovery or stop an already-running external promise. Jeeves needs atomic intent, finite fenced claims, due times, receipts and inspectable exhaustion/reconciliation. |
| `vd-mail`: [email queue](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/email-plugin/src/plugin.ts#L344-L362), [email subscriber](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/email-plugin/src/plugin.ts#L397-L434) | Email event handlers materialize data then queue send-email with five requested retries; handler errors are logged. Testing transport bypasses the queue. This publication does not pass a transaction context. | Five retries do not establish crash deduplication, current recipient authorization or external exactly-once mail. Jeeves persists eligible internal intent/receipts atomically, rechecks scope/preferences before sensitive effects and records uncertain external delivery. |
| `vd-search`, `vd-search-index`: [search paging](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/plugin/default-search-plugin/search-strategy/postgres-search-strategy.ts#L82-L146), [channel predicate](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/plugin/default-search-plugin/search-strategy/postgres-search-strategy.ts#L254-L261), [projection jobs](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/plugin/default-search-plugin/indexer/search-index.service.ts#L30-L102), [reindex progress/error](https://github.com/vendurehq/vendure/blob/a4c56359ec831b0c54dd01eab14fb75455c43ab7/packages/core/src/plugin/default-search-plugin/indexer/search-index.service.ts#L153-L184) | Search uses offset/limit (default take 25), a variant-ID tie-break, optional enabled filtering and a channel predicate. Projection/reindex jobs pass context for insertion and expose progress/errors. | No complete resolver/indexer/private-field audit or measured rebuild guarantee. Jeeves uses bounded keyset cursors (25 default/100 max), authoritative publication/scope before snippets/counts and a public projection that excludes private prices/stock internals. Rebuild cannot resurrect hidden data. |

### Every V row has a provenance boundary

The sidecar preserves ledger order, G/H targets and every mandatory observation ID. Primary `source`
means inspected inspiration with deliberate adaptation; it does not assert that upstream supplies
every observation. Primary `jeeves-specific-decision` names a bounded hook. Supporting context
never turns an unimplemented H row into supplied behavior.

| Row | Primary reference or decision | Required Jeeves boundary |
| --- | --- | --- |
| V01 | `vd-auth` | Authenticated customer/admin sessions, role/shop isolation, restart and durable revocation. |
| V02 | `vd-catalog` | Published product/variant/asset visibility; bounded queries and repeat-safe publication. |
| V03 | `vd-calculator` | Immutable inputs, exact integer minor units, currency/quantity bounds and overflow rejection. |
| V04 | `vd-order` | Server prices, bounded versioned cart; replay never doubles quantity; stale update conflicts. |
| V05 | `vd-order` | Atomic immutable order/address/price snapshot, reservations and receipt; changed quote/version rolls back. |
| V06 | `vd-allocation` | Last-item serialization, release/expiry once, held-payment protection and expiry/start-payment race. |
| V07 | `vd-order-process` | Frozen guarded lifecycle and cancellation; unpaid/stale actions cannot pay or ship. |
| V08 | `vd-payment` | Reference-provider request/event identities, raw callback authentication, unknown/review/held stock and reconciliation. |
| V09 | `vd-order` | All-shipment quantity sum under concurrency control, paid/reserved ceiling and one replayable shipment. |
| V10 | `vd-search` | Public scoped keyset search, private-field suppression and rebuild without visibility resurrection. |
| V11 | `vd-shop-order` | Current owner/staff isolation on direct/list/history/count/download/callback paths. |
| V12 | `vd-order-process` | Immutable actor audit, atomic notification intent, current redaction and internal effect receipts. |
| V13 | `JH-promotion` | Immutable quote + promotions → exact allocations/rejection; explicit exclusions/caps/rounding, no accumulated recalculation. |
| V14 | `JH-tax` | Trusted address/items/currency → versioned provider quote/provenance/expiry or unavailable; fixture tax earns no adapter points. |
| V15 | `JH-shipping` | Package/address/cart → bounded eligible quotes; trusted price, service compatibility and expiry/unavailable policy. |
| V16 | `JH-returns` | Paid/fulfilled/refunded snapshot → authorized quantities/amounts/next command; one refund identity and uncertainty recovery. |
| V17 | `JH-marketplace` | Seller attribution/window/payment refs → isolated entitlements/settlement plan distinct from customer charge. |
| V18 | `JH-currency` | Original amounts + rate snapshot → rounded quote/provenance; completed money is immutable. |
| V19 | `JH-provider` | Durable request/typed amount and verified raw callback → provider status/event; signature, idempotency and reconciliation evidence. |
| V20 | `JH-inventory-sync` | Verified source revision/mapping → local command or reconciliation; explicit stock authority, duplicate/order recovery. |

All eight hooks have inputs, results, rejection/recovery and exact remaining decisions in the
sidecar. Their unimplemented default is **HTTP 503 with no domain changes**; that readiness
rejection earns no functional points. No promotion ruleset, production tax/carrier adapter,
complete returns engine, seller payout, currency-rate provider, real payment plugin or ERP connector
was audited. This identifies inspection limits, not unavailable upstream features.

### Vendure decisions still owned by later assignments

P60b has no unresolved pin/source-location blocker. **P61a/c** must freeze independent REST
endpoints, schemas, headers and concrete fixtures for all 63 observations, including quote bounds,
overflow edges, immutable address/price snapshots, last-item/expiry barriers, signed event bytes,
timeout acceptance, event ordering and the 3→2+1 shipment example. **P72a/b** then binds data,
authority, transaction/lock order and exact hook briefs to that model. Each hook still needs its
specific choice: promotion stacking/remainder ties; production tax provider/expiry; package/carrier
rate policy; return window/restock/refund allocation; seller attribution/fees/payout recovery;
rate authority/precision/rounding; named real provider signature/status/idempotency/reconciliation;
and ERP absolute-versus-delta/revision/conflict authority. Later briefs also fix execution purity,
timeout/cancellation, allowed dependencies/effects, private data, acceptance IDs and owned paths.
These are explicit future specification decisions, not permission to change frozen v1 behavior.

No runtime/template offering, observed benchmark pass, upstream execution, generated application
or capacity result follows from P60b. Earlier pins, P60a's map and all nine frozen P59 files remain
unchanged. **P60c is next**, for Zammad and the combined reference review; parent P60 remains partial.
