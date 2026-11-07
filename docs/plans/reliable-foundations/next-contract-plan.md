# Next contract milestone: one complete TinyURL foundation first

Execution authorized, 2026-11-07. The owner's existing “goahead and kick it off” and
subsequent correction that work should continue across milestone boundaries authorize the
bounded first phase NC01–NC06 and NC14 under the defaults below. The earlier coordinator stop
was a coordination error, not a missing owner action. G1 and G4 are recorded decisions for NC01;
remaining gates are implementation prerequisites resolved within this accepted scope, not
repeated owner-approval requests. NC01 implements the scope/version boundary, NC02 ownership/access, and NC03 the finite Create link contract/bindings; subsequent contracts remain planned until their own units complete. The
[Milestone 1 review](milestone1-review.md) is the evidence. This refines the work
areas in [units](units.md); it does not authorize the generator, replace saved projects or ask an
agent to build a general architecture language. Development remains sequential on primary main,
one fresh agent/unit, one commit, coordinator review before dispatching the next unit.

**Owner clarification, 2026-11-07:** “Keep backend implementation for later.” Continue the
authorized Jeeves sequence NC02–NC06 and NC14. The separate backend remains a concrete future
build plan, with repository/conventions and real runtime tests still dependencies; no backend or
generator implementation is authorized by these units.

The default next milestone is the small typed **create/resolve** profile in NC01–NC06, followed
by independent NC14 review of that completed subset. Then prove the first TinyURL foundation in
the separate backend once its repository/conventions are known. NC07–NC13 are deferred domain
expansions, not prerequisites for that first runtime proof. A generic Service remains useful
for design without claiming a capability or generation readiness.

## Accepted defaults and decision gates

The owner has authorized the first-phase defaults for NC01–NC06 and its NC14 review.
The coordinator records prerequisite decisions/evidence and resolves routine details within that
scope without repeated owner permission. A changed product scope/meaning or missing external
dependency needs a new decision; a gate below is not a request for repeated approval.

| Gate | Chosen default | Must be settled before |
| --- | --- | --- |
| G1: first workload — recorded NC01 | One public short-link namespace; immutable destinations; authenticated create, public resolve; optional expiry. No custom slugs, destination mutation/disable API, exact analytics, quotas, reputation enforcement or deployment claim. Required excluded features must instead block that profile. | NC01; changing scope requires a new profile/version. |
| G2: owner and presentation — recorded NC02 | One logical **Links** owner; create and resolve are API roles inside it, a later analytics consumer may be a worker role. Roles may share one deployable; role ≠ owner ≠ process. Default collapsed owner tile, mouse expansion of roles. Preserve existing element IDs as role/resource references where possible; do not merge legacy owners automatically. | NC02; a concrete small owner/expanded-role sketch is reviewed at both sizes before coding presentation. |
| G3: contracts and policies — recorded NC03 | Local immutable finite records with exact IDs/versions/schema hashes. Select a profile and bounded parameters; no route/entity/policy DSL or arbitrary expressions. Start with exact caller/receiver version equality; compatible evolution is a later explicit rule. | NC03; schema/command budget audit before adding tools. |
| G4: version boundary — recorded NC01 | New stored design schema and blueprint **v3**, with explicit reader/writer migration. Existing default `/blueprint` stays v2 during rollout; explicit `?version=3` opts in. Legacy-only designs retain exact v2 meaning. A design using v3-only semantics refuses v2 export with a structured unsupported-content list, never a silently lossy success. Default-version switch is a separate final-review decision. | NC01; review API consumer impact and migration fixtures first. |
| G5: first consistency policy — recorded NC04 | Authoritative primary lookup; immutable target; cache entries never outlive expiry; no negative cache initially, no browser/CDN redirect-response cache. Cache miss/outage falls back to authority; bounded outage protection is part of the profile. Create success follows durable commit; immediate resolve must find it. | NC04; cache fallback/overload behavior and finite parameter bounds are pinned in the profile. |
| G6: runtime profile boundary — recorded NC05 | Four independent report stages; generation eligibility excludes future output evidence. No product registry/manifests/verifiers/dependencies/outputs/evidence exist. Optional host-only pinned content resolver supports one exact semantic composition, with independently pinned expected output receipt and evidence. Positive trust plumbing stays isolated in tests. No runtime/language/provider support is guessed from future recommendations. | NC05 reports unavailable implementation and no runtime evidence honestly. Actual support requires a real trusted registry and backend proof; repository/conventions remain future dependencies. |
| G7: expansion | Finish NC14 review of the small TinyURL contract and then its separate backend proof before considering messaging/video/checkout expansion. Expansion needs its own accepted scope. Mini/live strict acceptance is still an evidence gate; no additional live paid run is implicitly authorized here. | After NC06/NC14 and backend proof; NC07+ stay deferred. |
| G8: same-owner return | Semantic relationships and finite state/result contracts may revisit one owner; overview/journey steps reference that same identity. Acyclic lane projection remains a view invariant. A repeated reference is visibly the same participant, not a second owner or generated service. | NC08/NC09; review one concrete Video → job → Transcoder → result → Video projection first. |

G1 deliberately narrows the older broad TinyURL briefs. If disabling links, editable destinations,
management, abuse protection or exact counting is required for the first product, revise the
profile before implementation; do not let an agent silently add it or certify an exclusion.
Expiry must affect resolve, independently of physical cleanup. Unknown/expired and dependency
failure responses are required. There is no claim of enterprise completeness.

## Contract shape and compatibility rules

Use stable identities and references, with versioned records as the source of truth. Display
names, labels, purposes, module paragraphs and screen coordinates remain presentation/intent.
These are conceptual boundaries, not a mandated TypeScript implementation:

- **Owner / role / deployable:** logical owner ID; roles referencing it and their existing tile
  identity; optional deployable assignment. A resource has one logical authority and a source/
  projection classification. Co-deployment does not grant access or merge ownership.
- **Access:** per-operation read/write intent and explicit role grant. A cache read-and-fill uses
  both permissions. Same-owner read stays a read; ownership never fabricates a write. Cross-owner
  direct writes are refused for the new profile; a deliberate read projection/contract is
  explicit. Legacy inferred access remains labeled legacy/unspecified in v3, never converted
  into declared permission from a saved verb.
- **Capability:** exact `capabilityId@version`, operation ID and request/response/error schema
  references. Call bindings reference both caller expectation and receiver implementation.
  Validate payload/version, auth principal/authorization scope, side effects, timeout and
  idempotency promises together. An HTTP-looking line proves none of these.
- **Messages:** exact message/envelope schema, publisher, channel and subscription identities.
  Independent subscriptions each get their own stream; replicas inside one subscription compete.
  Delivery duplicates, ordering scope, event/attempt IDs, deduplication retention, retry/exhaustion,
  dead-letter and reconciliation behavior are separate typed choices. A queue name supplies no
  exactly-once promise.
- **State/failure:** finite reviewed transitions with entity, operation and attempt IDs, stale/
  duplicate result guards and named failure/recovery outcomes. Start with the named profiles;
  no arbitrary workflow interpreter. An outbox promises only one local database transaction's
  state change and publication intent, never an atomic remote payment/object-store write.
- **Persistent requirements:** included/excluded behaviors, criticality and unresolved custom
  obligations live in the design and blueprint, survive reload/history and are visible to chat.
  RF04's turn-local scope stays distinct. “Represented” never becomes “runtime verified.”
- **Availability/evidence:** capability intent, compatible template availability and exact artifact
  verification are separate fields/reports. Unknown versions are retained as unresolved references,
  never replaced by latest. Unknown critical contracts, omitted required parts, open custom
  obligations and unsupported combinations all block generation readiness.

Reject malformed references, contradictory typed grants and incompatible newly bound operations
atomically. Well-formed unknown versions and legacy missing declarations can remain saveable
with explicit unresolved findings; they cannot pass compatibility. No implicit schema subtyping,
version range, label inference or “best matching” template fallback in the initial implementation.

## Rules applying to every implementation unit

Each unit owns a complete vertical behavior: schema/ref catalog, commands/validation, mouse form,
chat tool/context/review and blueprint output together. A feature is incomplete if only one of
those paths can edit it. Keep the finite settings allowlist and current docs synchronized.

Acceptance for **each** NC unit includes:

1. Network-free PGlite unit tests for its real contract boundary and meaningful failures; shared
   mouse/chat commands yield equal saved contracts. Atomic refusal, one Undo, stale revision,
   removal/reference cleanup and reload/history are covered when the new binding participates.
2. Old saved fixture loads without behavioral inference or silent migration; explicit upgrade is
   previewed and undoable. Unknown refs remain unknown. v2 compatibility behavior and normalized
   v3 blueprint snapshots cover exactly the same meaning as the inspector and chat summary.
3. Mouse at 1440×900 and 1280×800: create/select/edit the new declaration, inspect its precise
   unresolved finding, fit/focus/Show all and verify unchanged full export for view-only actions.
   Default TinyURL still renders. Do not replace the owner's saved projects.
4. `pnpm check`, `pnpm test:e2e`, `pnpm --filter @jeeves/web build`, docs/handoff/feedback and one
   local commit. Tests/layout success do not close domain or runtime questions.
5. Audit the actual provider schemas before enlarging tools: current `applyStudioCommands` emits
   **427 properties, 538 enum values, nesting nine**. Prefer narrow reference/binding tools over
   expanding the nested command union blindly. Preserve omitted/null/default/history semantics
   and synthesized review-call replay; report emitted budgets in the handoff. Refuse unaudited
   schema constructs explicitly. Do not silently loosen strictness.
6. Keep deterministic replay records immutable as-run evidence. If prompt/tool/result changes
   intentionally invalidate RF06 replay, retain old records and explain the exact mismatch; add
   separately versioned fixtures. Compare request size/rounds/refusals and scope precision against
   RF06, whose current arm used 2.44× input and 2.07× responses. Do not impose invented cost or
   latency wins. Any later paid evaluation needs separate authorization and actual model access.

## Sequential vertical units

### NC01 — Persist the narrow profile and expose the version boundary

**Progress, 2026-11-07:** NC01 implements explicit stored v2/v3 readers, upgrade/set-scope
operations, finite profile and persistent requirements, shared mouse/chat preview/apply, complete
history Undo/Redo and opt-in blueprint v3. Default v2 refuses exact unsupported scope paths.
Legacy schema2 reads/findings/v2 export preserve their meaning. Unknown refs/custom behavior
remain unresolved; profile selection reports owner/access/API/expiry/cache contracts unspecified.
No owner project/preset migration, runtime or generator. Evidence/checks are in the NC01 handoff.

**Depends:** G1/G4 recorded. Add the v3 read/write/export boundary and a finite
`tinyurl-create-resolve@1.0.0` scope selection, including persistent included/excluded requirements
and targeted unresolved custom requirements. The mouse can select scope, inspect what is still
unspecified, save/reload and Undo it. Chat can read/edit those same declarations and distinguishes
them from its turn-only review assumptions. New profile selection cannot certify a generic tile.

**Acceptance:** old schema-v2 fixtures and owner-style custom TinyURL remain unchanged absent an
explicit operation. Upgrade preview says what stays unspecified; no label becomes a capability.
v2 export succeeds identically for legacy-only semantics and refuses exact v3-only content;
explicit v3 export names every unresolved requirement. No empty “ready” result for old projects.
This unit introduces no owner/API/messaging inference, runtime manifest or generator.

### NC02 — One Links owner, API roles and explicit data access

**Progress, 2026-11-07:** implemented the optional v3 ownership/access vertical slice. G2's
concrete collapsed/expanded 1440/1280 sketch and actual 1280 images were reviewed by the
coordinator. Existing role/resource/connection IDs remain canonical; one logical owner is a
view projection with safe expansion fallback, independent of deployable assignment. Shared
mouse/chat preview/apply declares authority, source/projection, role grants and dependency intent.
Contradictory grants/foreign writes refuse atomically; cross-owner published reads and projection
population/freshness/failure remain targeted unresolved intent. Legacy inference stays separate.
Exact removal/transfer rows, stale previews, reload/history and one Undo are covered. V2 refuses
every nonempty row, including empty-scope ownership. Operation contracts still belong to NC03/04;
no preset, owner project, template, generator or runtime was changed. Evidence/checks are in the
NC02 handoff and `evidence/nc02/`.

**Depends:** NC01/G2. Assign create/resolve roles to one logical owner without forcing a new
owner or deployable for each handler. Declare resource/dependency access intent and explicit
role grants: Links DB authority, create write, resolve read, cache read/fill separately.
NC03/NC04 operation bindings must refine those intents within the grants; NC02 does not invent
operation schemas before they exist. Mouse expansion/collapse references stable identities.
Link access selectors and chat commands edit the same typed intent, not the legacy inferred flag.

**Acceptance:** create writes Links DB; resolve reads it; owner read is exported as read; cache
fill requires write. A foreign-owner write is refused, and deliberate cross-owner reads require
a declared boundary/projection. Co-deployment grants nothing. Removing/moving a role reports or
removes exactly its dependent bindings in one operation; Undo restores them. Legacy ownership is
preserved with unspecified operation intent. No forced split/merge of saved service identities.

### NC03 — Create-link capability and caller/receiver bindings

**Progress, 2026-11-07:** implemented finite `links-create@1.0.0`, full-definition and schema
SHA256 refs, separate stable receiver/call binding IDs, exact entry/connection endpoints and a
tagged create-link configuration. Shared mouse/chat preview/apply, strict transport, operation
selection, v3 export/v2 refusal and exact removal/transfer cleanup preserve old designs. Known
contradictions refuse; unknown exact refs remain unresolved without acquiring Create semantics.
Auth verifier/template/runtime availability remains absent, separately from the known requirement.
G3 coordinator review accepted 24-hour committed-success retention, 16 random bytes / 22 base64url
characters, five total allocation attempts including the initial attempt, and one total 10-second
deadline. Authenticate/parse and retained fingerprint lookup precede new-request expiry freshness;
post-retention requests are revalidated. Concurrent transactions serialize until their result is
observable or return dependency failure/same-key retry at deadline; no hidden pending/lease
machine. Expiry is a valid future supported RFC3339 instant, no extra 365-day business ceiling.
[Complete decisions](../../studio-contracts.md). Small-view sketch and actual 1280 card/inspector/
preview were coordinator reviewed. This first named responsibility supplies no read/publish ports
or returned-data arrows. Existing shorter API timeouts must be explicitly edited, never migrated.
NC04 owns resolve/cache lookup policy. One-namespace composition remains explicitly unresolved: NC04/NC05 must check that every selected-profile create/resolve binding agrees on one authoritative source and compatible owner; per-operation presence does not prove it. Independent arbitrary designs are not prohibited. No backend, generator, preset rewrite or live model run.

**Depends:** NC02/G3. Add an immutable create-link operation/schema profile and bounded binding
UI/tool. Proposed behavior: authenticated principal, validated HTTP(S) target, server-allocated
opaque unique code, optional expiry, durable commit before success. Idempotency key is scoped to
principal + operation: same request returns the original result; changed payload conflicts.
Pin retention and allocation-attempt bounds in this profile before coding it; proposed retention
is 24 hours. Exhausted allocation/dependency/auth errors have explicit schema references.

**Acceptance:** entry/caller expectation and receiver both reference the exact operation/schema
version; incompatible auth/idempotency/payload promises refuse atomically. Rename does not change
binding. Missing auth verifier/retention/unknown ref produces targeted unresolved readiness,
never a guessed implementation. Display a compact operation card and inspect details by mouse.
This is contract validation, not an HTTP runtime or a route/schema programming editor.

### NC04 — Resolve-link, expiry and a compatible lookup policy

**Progress, 2026-11-07:** G5 coordinator review accepted GET `/links/{code}`, canonical 16-byte/
22-character base64url, 307 Location, explicit 400/404/410/503 schemas and all-outcome no-store.
New immutable Resolve/positive-cache records retain NC03 Create identity. Fixed policy clamps
positive entries to expiry with 300s maximum, 50 ms cache phases, 1000 ms primary, 64 actual primary
calls shared per runtime instance and 1200 ms total monotonic deadline. Cache failure falls back;
fill failure preserves timely success; primary failure never becomes 404. Stable 410 retains
minimal durable expiration evidence indefinitely; no code reuse. Static source/read/cache-fill
permissions, applicable settings/modules/CDN and selected-profile namespace agreement now check
against exact declarations. Shared mouse/chat form/preview/history, operation selection and v3
export remain finite and preserve legacy designs. Generic SQL/Redis connection controls are not
expanded. Coordinator reviewed real 1280 form/preview. Backend/adapters/clocks/templates/runtime
proof remain unavailable; no preset or owner project migration. [Complete decisions](../../studio-contracts.md).

**Depends:** NC03/G5. Add public resolve, unknown/expired and dependency failure contracts. Proposed
response is a temporary redirect with explicit no-response-cache policy; target stays immutable
in this profile. Use primary authority on cache misses; no negative caching initially. Select a
reviewed **clamp-to-record-expiry** cache policy so a runtime entry's lifetime cannot extend its
record expiry; a static document check validates that policy declaration, not future record
timestamps. Cache loss/outage fallback and overload refusal are
finite policy variants with pinned bounds. Creation's durable success is compatible with an
immediate resolve; no replica-lag promise is hidden in a label.

**Acceptance:** core profile checks reject redirect-response caching and incompatible cache-policy
declarations, and surface incompatible caller/authority consistency. Operation read/write intent
must stay within NC02 role grants. Unknown and
expired behavior survives blueprint/reload/Undo. A request for destination mutation/disable or
an edge cache becomes an explicit excluded/unsupported requirement, not a silent broadening.
No simulated lookup test is described as runtime verification. Actual cache expiry/clamping and
immediate read-after-create behavior need later backend HTTP/real-adapter tests. Optional
analytics adds publisher-coverage checks only when that extension is selected.

### NC05 — Readiness for the exact TinyURL contract, separate from implementation evidence

**Progress, 2026-11-07:** G6 coordinator review accepted four independent stages, exact canonical
composition/profile hashes, trusted content-addressed manifest/receipt/evidence inputs and compact
mouse targets. One `designReadiness` function serves inspector, blueprint v3 and read-only chat;
initial chat context carries only statuses/counts/hash. Product has no registry or output, so
implementation is unavailable and runtime evidence none. First generation needs valid/complete/
available, never future output evidence; eligibility is not verification. Full `validateDesign`
and whole-design coverage block generic/legacy/unknown/custom/extra behavior. Create retained-
result lookup/reconciliation now requires explicit read-write dependency/grant; old write-only
intent stays saveable with a targeted gap, not migrated. Frozen operation records remain unchanged.
Only isolated tests resolve compatible manifests and pinned output evidence; their bytes prove
trust plumbing, not HTTP/storage/cache/concurrency runtime behavior. [Report identity, formats and
limits](../../studio-readiness.md). NC06 owns the new narrow study; no owner project/preset,
generator, backend, deployment or live/paid model call is added.

**Depends:** NC04/G6. Expose a deterministic mouse/blueprint/chat compatibility report over the
snapshot + exact profile + optional pinned template manifest. Report design validity, contract
completeness, template availability and exact-runtime evidence separately, with targeted blockers.
The product has no real template/evidence registry yet; absent artifacts remain **unavailable**.

**Acceptance:** an old/generic/unknown-critical/custom-unresolved design never passes generation
readiness. Mismatched provider/settings/contracts/template versions identify exact blockers.
Only isolated test fixtures can exercise a positive manifest/evidence path; they cannot become
product verification badges. Evidence binds output/template/dependency/profile hashes, suite,
environment and results; a different composition invalidates it. No compiler/runtime is added.

### NC06 — Rework and review the TinyURL study only

**Progress, 2026-11-07:** implemented the distinct `studio-tinyurl-foundation@1.0.0` default,
with one Links owner/two canonical API roles/shared deployable intent, PostgreSQL authority,
exact positive cache projection and explicit read/write grants. Existing Create/Resolve/cache
records and profile digest remain unchanged; the extended study source/goal and saved projects
are preserved. Shared complete version-aware seeding fixes the chooser/fresh-install/eval seam;
missing declared writes warn without inventing legacy writer metadata. Actual blank mouse
construction and scripted ChatService tools agree on the complete semantic blueprint/contracts/
report. This proves plumbing with chosen inputs, not model design quality. Coordinator accepted
both-size presentation; owner usability and runtime acceptance remain open. See the short
[NC06 review ledger](nc06-review.md) and [evidence](evidence/nc06/README.md). NC14 is next.

**Depends:** NC05. Add a new explicit preset version for the chosen small foundation: one logical
Links owner with API roles, durable create/resolve and the exact cache/profile choices. State
analytics, management/disable, reputation and custom slug exclusions visibly. Keep a separate
clearly design-only legacy/extended example if useful; do not upgrade or replace the owner's
CDN/reputation/custom copy. A requirement for those extras blocks the narrow profile.

**Acceptance:** build the slice by mouse and by chat, compare exact contracts/blueprint; prove
failure/refusal/migration/Undo semantics and inspect both fitted/focused sizes. Owner can explain
who owns Links and how create→resolve behaves without reading modules. Produce a short review
ledger, then run NC14 on this subset. This is the default contract milestone: one precise design
foundation with honest absent-runtime evidence. Next prove it in the separate backend; NC07–NC13
remain deferred behind G7.

### NC07 — Optional click events, independent subscriptions and a Stats reader

**Depends:** G7, NC06. Add an explicit optional TinyURL analytics extension with exact
`LinkResolved` envelope, event ID and bounded delivery/deduplication policies. Include a concrete
Analytics consumer/store and owner-authorized Stats read capability; do not inherit an unrelated
upload/job lifecycle. Proposed first profile is approximate: redirect publication can be lost,
accepted messages may redeliver, aggregation deduplicates only within its declared retention.
No exact global click count or exactly-once transport claim.

**Acceptance:** publisher coverage includes response-cache bypass policy; two independent
subscriptions each receive intent while workers in one subscription compete. Schema/order/
retention mismatches and missing reader/auth/loss policy block this extension. Tests distinguish
pre-acceptance publication loss from accepted-channel redelivery. Optional analytics does not
turn itself into a mandatory lifecycle for create/resolve-only projects. Update only the new
TinyURL preset when this extension is deliberately selected.

### NC08 — Durable processing job and explicit failure promises

**Depends:** NC07. Add a bounded video-processing job/result profile with source object/version
reference (no video bytes), entity/operation/attempt IDs, output identity, accepted-channel
delivery, ordering scope, retry/exhaustion, dead-letter and reconciliation declarations.
Proposed transport promise is at-least-once accepted delivery; duplicate execution remains
possible. Exact retry bounds and deduplication/retention are required profile values, not prose.

**Acceptance:** incompatible publisher/consumer message versions or a claimed once-only queue
refuse; missing failure/deduplication/recovery declarations remain blockers. Durable source and
separate outputs survive retry-policy edits/removal/Undo. A small golden fixture expresses
contract intent only; no YouTube preset rewrite or runtime adapter is included yet.

### NC09 — Same-owner result journey and finite Video state

**Depends:** NC08/G8. One Video owner exposes upload/API and result-consumer roles. Persist the
finite lifecycle and attempt/result guards; proposed states are PendingUpload, Processing, Ready,
Failed and Cancelled. Storage finalization, scheduling and result persistence have separate
recovery declarations. Journey steps revisit the same semantic owner identity through job →
Transcoder → result; the default overview remains approachable and visibly references one owner.

**Acceptance:** duplicate/current/stale/cancelled results have explicit outcomes; output success
does not itself publish. Outbox intent does not claim storage/database atomicity. Semantic-return
support does not disable arbitrary graph validation: accidental recursive synchronous calls are
still rejected/reported. Repeated references edit one owner, one Undo restores the entire change,
and filtering/journey layout never changes full contracts. No fake completion owner is needed.

### NC10 — Committed publication and searchable visibility

**Depends:** NC09. Add distinct processed-result and committed-publication message contracts.
Video owns Ready/public visibility; search projects versioned Published/Updated/Unpublished
changes after authoritative commit. Proposed first media profile is public-only; private access/
moderation are excluded requirements, never implied. Define stale/out-of-order projection and
Watch's authoritative visibility/freshness policy, including cache/negative-cache/replica races.

**Acceptance:** a direct raw-transcode→search publication bypass is rejected for this profile.
Late/stale publication and unpublish scenarios have typed outcomes; a replica/cache that cannot
meet declared read-after-publication blocks compatibility. Search lag and unauthorized visibility
are separate concerns. No runtime outbox/search correctness claim follows from passing checks.

### NC11 — Rework the YouTube study only

**Depends:** NC10. New preset version uses one Video owner with upload/result roles, durable
originals, explicit processing lifecycle, separate renditions and committed publication feed.
Name the responsibilities plainly; omit extra independently owned completion services. Preserve
the owner's old saved copy and document included/excluded public-media behavior.

**Acceptance:** mouse traces upload control versus bytes, originals read/output write, same-owner
result and publication→search independently. Both sizes expose readable selected contracts;
record remaining full-overview limitations. Chat produces the same profile or precise unsupported
obligations. Migration preview, complete export and one Undo preserve stable resource identities.

### NC12 — Fixed-price, finite-stock checkout contract

**Depends:** NC11. Extend only the finite reviewed profile vocabulary: one item/quantity one/
currency initially; Orders owns pending attempt and price snapshot; Catalog/Inventory authorizes
price/reservation through capability bindings; Payments owns provider records. Exact reservation
expiry/concurrency, payment request idempotency, authenticated duplicate/unordered notifications,
unknown outcomes and same-Orders result/reconciliation are required typed transitions.

**Proposed late-success default:** after reservation expiry/cancellation, never fulfil automatically;
enter persisted reconciliation/compensation-required state and release/reacquire/refund only
through declared reviewed operations. Required provider status/refund contracts cannot be replaced
by a free-text module. Taxes/shipping/settlement/auctions remain exclusions. Pin expiry values and
provider adapter expectations at dispatch; do not invent a generic shopping-policy engine.

**Acceptance:** typed declarations require pending-before-payment and an atomic conditional
reservation/concurrency contract that forbids promising one finite item twice; document checks
reject missing or contradictory guarantees. They do not prove real competing reservations safe.
Late/duplicate/out-of-order notifications have explicit guarded transitions. Direct
foreign-schema writes and search-index pricing authority refuse. Timeout does not mean payment
failed. Unknown compensation/refund requirements block readiness; runtime stock/payment correctness
still needs future independent real-adapter fault tests.

### NC13 — Rework the Marketplace study only

**Depends:** NC12. New preset names Catalog/Inventory, Orders and Payments authority and their
role/capability bindings. Show pending checkout and owned projections; replace accidental shared
Catalog/Orders schema coupling deliberately. Preserve the existing saved project.

**Acceptance:** mouse follows authoritative price/reserve, payment request/outcome and the same
Orders owner through failure/reconciliation. Duplicate/late-notification edits preserve unrelated
stock settings/identity and undo once. Export/chat/mouse agree on scope, errors and exclusions;
no new service is created merely to keep a journey acyclic. Record readability and support gaps.

### NC14 — Independent contract milestone review

**Progress, 2026-11-07:** independent source/diff/seam review of NC01–NC06, with a concrete
[review ledger](nc14-review.md) and [future backend build plan](backend-first-proof-plan.md).
Confirmed corrections make declared inspector facts primary, check Create's actual source
transport/security, detach v3 ownership projections and require suite-v2 executable-bundle content
identity. Frozen contracts/profile, old schema2 studies, default-v2 export and deferred runtime
boundary remain intact. Verification/evidence details belong to the ledger; backend implementation
and NC07–NC13 remain deferred.

**Depends:** NC01–NC06 for the default first milestone. Repeat a separately scoped review after
any later NC07–NC13 expansion; those units are not first-proof prerequisites. Review diffs and migration/
wire/schema seams; load unmodified owner-style old projects; trace each changed preset by mouse
at both sizes. Compare persistent requirements, operation/message bindings, inspector, chat,
full blueprint and compatibility report. Audit exact runtime-claim separation, unknown-critical
blockers, deletion/conflict/Undo and model/schema headroom. Report remaining scope precision and
request/token overhead, and owner/intended-model evidence still missing.

**Exit:** a concrete ledger of what the chosen profiles express and what remains unknown. Do not
close architecture questions because tests pass. Only then prepare separate backend units after
the backend repository, its AGENTS/conventions, selected adapters/manifests and runtime fault-test
plan are known. No generator, deployment or blanket “enterprise-ready” claim belongs to Jeeves.
