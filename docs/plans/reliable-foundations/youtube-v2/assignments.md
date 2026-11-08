# Sequential assignments

Give a fresh agent **one section only**, together with the coordinator prompt from the
[plan](../youtube-v2-plan.md). All units depend on completion of the immediately preceding
unit. Read the [shared contract](contracts-and-controls.md), AGENTS and latest handoff first.
The additional reads/checks below keep each assignment bounded; they do not replace required
Jeeves checks, generated-output builds, mouse checks where applicable, or one local commit.

Repository-relative source prefixes below:

- `S`: `jeeves/packages/spec/src/`
- `G`: `jeeves-generator/`
- `F`: `field-projects/youtube/v1/app/` (extraction source; never edit it)
- `W`: `jeeves/apps/web/src/`
- `A`: `jeeves/apps/server/src/`

Every template unit uses `G/templates/local-v2/` and/or `G/src/v2/`. Preserve v1 assets and
identities. It registers the implementation with the new assembler, records its emitted API/
paths and provenance, and leaves remaining unimplemented selections explicitly incomplete.
Build a disposable standalone emitted project. Do not create `field-projects/youtube/v2/app`
before YV2-21. Do not implement future units to make a partial assembly appear complete.

Keep an agent-maintained `interfaces.md` beside this file once YV2-01 creates it.
It records actual exported symbols, binding variants, generated paths and their current owner
unit. Each unit adds only its own concrete interfaces and direct necessary amendments. This
keeps later agents from duplicating helpers or guessing the previous agent's intent.

## YV2-01 — Source selections and blueprint boundary

**Goal:** represent exact template selections without adding editor clutter.

**Read:** `S/design.ts`, `operations.ts`, `apply.ts`, `studio-blueprint.ts`, `ownership.ts`,
`design-readiness.ts`, `readiness-subject.ts`; shared contract's semantic input section.

**Do:** implement optional strict schema3 `generation`, finite tagged bindings, exact refs,
one atomic generation command and canonical reference validation. Include selection cleanup/
refusal when its target is removed, history/Undo, v3 blueprint round-trip and v2 loss refusal.
Keep missing/unknown refs explicit and non-executable; preserve absent-generation documents.
Add the finite template/preset reference catalog and internal default-policy definitions;
presence in the catalog does not mark an implementation installed. Create `interfaces.md`.

**Check:** a supported source round-trips; target deletion and Undo retain correct semantics;
unknown ref cannot execute; v2 refuses the new exact paths; existing v1 blueprint/output stays
unchanged. A few focused offline cases suffice. Update blueprint/settings documentation.

**Do not:** add template rendering, forms, a generic policy language or default grants on read.
**Done:** the next agent can parse typed selections and obtain targeted findings without UI.
**Commit:** `YV2-01: add typed template selections to design source`.

## YV2-02 — Binding resolver and control support

**Goal:** one declarative semantic model for generation, mouse and chat.

**Read:** YV2-01 interfaces; `S/studio-definitions.ts`, `studio-components.ts`,
`studio-validation.ts`; `G/src/input.ts` and `templates/local-v1/index.ts` as legacy examples.

**Do:** implement pure selection/binding normalization, typed per-template requirements,
setting-source resolution, necessary role/store/channel validation and support descriptors.
Descriptors identify actual consumer, generated setting/output responsibility, supported
alternatives, fixed defaults and normal-control necessity. Accept host-supplied installed
template identities, rather than claiming all declared catalog refs are available. Resolve
existing settings once; no competing TTL/concurrency/grant values or ID-prefix inference.

**Check:** valid selection resolves; wrong connection endpoint/grant refuses; supported numeric
edit changes normalized consumer input; unsupported alternative stays explicit; labels do not
select an implementation. Confirm unknown/extra bindings cannot acquire permission.

**Do not:** implement runtime features, inspector forms or a second provider registry.
**Done:** assembler and UI can consume one normalized model and query actual supported choices.
**Commit:** `YV2-02: resolve template bindings and supported controls`.

## YV2-03 — V2 assembler and safe export

**Goal:** real deterministic assembly infrastructure independent of frozen v1.

**Read:** `G/src/{assemble,input,profile,files,export,cli}.ts`, `A/generation/archive.ts`,
new resolver and interfaces. Inspect how v1 source/assets are fingerprinted before changing exports.

**Do:** add v2 registry/assembler/CLI entry, exact normalized-input/template fingerprints,
source-linked file ownership, deterministic report/manifest and fresh-directory export.
Contributors share files through explicit single ownership/composition. Support partial registry
reports without treating unfinished features as a working app. Keep the old API/CLI available;
reuse existing safe path/collision/write-preservation helpers where appropriate.

**Check:** same input/registry emits identical files; actual asset edit changes template identity;
edited destination refuses; old v1 emitted path/hash list remains identical, including manifest.
Use a small trusted diagnostic emitter to exercise ownership and an explicit incomplete report;
the standalone project envelope/build starts in YV2-04.

**Do not:** use mutable v1 files as render inputs, expose a public executable selector, or wire
the new web preview before YV2-19. **Done:** later units can register independent real emitters.
**Commit:** `YV2-03: assemble and export versioned v2 templates`.

## YV2-04 — Standalone local runtime and access wiring

**Goal:** a reusable local project envelope which later feature units can populate.

**Read:** `F/compose.yaml`, `Dockerfile`, `scripts/{setup,bootstrap,local,migrate,broker-init,
storage-config,search-init}.mjs`, `infra/postgres/init.sh`; v1 runtime pins/lockfiles; new assembler.

**Do:** emit exact standalone package/lock/build files and pinned local providers. Compose only
selected resources/services. Provide migration-fragment and runtime-login/grant/view composition,
broker declaration hooks, private runtime secrets, first-run versus normal restart and scoped
all-profile shutdown. Replace hardcoded product/bucket/schema/port names with validated bindings.
Migration-owner secrets remain setup-only. Required unfinished features must not advertise ready.

**Check:** own frozen install/build outside checkout; bounded provider startup/restart with
retained credential/volume identity; unselected resources absent; applied migration hash mismatch
refuses without reset. Keep scratch resources isolated and clean up only those owned resources.

**Do not:** emit domain tables yet, alter provider pins, start v1 jobs or create an app framework.
**Done:** feature emitters can contribute migrations, credentials and services through known hooks.
**Commit:** `YV2-04: emit standalone local runtime and access foundation`.

## YV2-05 — HTTP, identity and messaging primitives

**Goal:** retain repaired transport behavior through reusable typed entry points.

**Read:** `F/src/lib/{http,jwt,amqp,worker,postgres,objects,search}.ts`, clients and relevant
FP06/FP07 handoffs. Use completed helpers, not the older template assets.

**Do:** emit generic configure-before-listen HTTP/start/readiness/close and verified-principal
adapters, SQL/object/search clients, confirmed publisher and metadata-aware consumer with
bounded retry/terminal/fatal/drain handling. Generic helpers take validated identity/resource
bindings and inject actual handlers. Keep request slots until admitted work settles after timeout.
Keep all app-level work awaited inside the handler budget.

**Check:** emitted code compiles; a configured HTTP handler starts and closes; bounded admission/
drain and receipt-after-effect behavior are preserved with small offline probes; generic code
contains no YouTube constants/imports. No unused shell receives behavior credit.

**Do not:** add business routes, new reconnect/exactly-once guarantees or comprehensive fault tests.
**Done:** subsequent modules import these helpers instead of editing their internals.
**Commit:** `YV2-05: extract reusable HTTP and messaging runtime`.

## YV2-06 — Transactional durability mechanisms

**Goal:** reusable outbox/inbox/receipt boundaries with explicit application effects.

**Read:** `F/src/lib/outbox.ts`, `src/state/{transaction,counts,video}.ts`, metadata/count
migrations; YV2-04 access hooks and YV2-05 publisher interface.

**Do:** emit transaction wrapper, bound outbox schema/relay and receipt-with-effect functions.
Take validated table/destination/payload bindings; do not depend on `video_private` or video
messages. Relay confirms before marking sent, with bounded retries and repeat-safe logical IDs.
Provide atomic callback hooks, never network effects presented as part of a SQL transaction.

**Check:** one focused offline transaction/duplicate-effect case and relay retry/confirm case;
emitted build plus bounded actual SQL/broker smoke when integrated. A different namespace and
payload codec use the same implementation. Stage only nonsecret evidence.

**Do not:** invent a distributed transaction engine or emit the VideoPublished policy.
**Done:** upload, lifecycle and counter modules can commit their own effects with these helpers.
**Commit:** `YV2-06: extract transactional delivery and receipt modules`.

## YV2-07 — Owned-upload durable state

**Goal:** generic durable transfer records independent of video publication policy.

**Read:** `F/src/state/video.ts` upload functions, upload SQL, `src/contracts/v1.ts` file
validation and `src/extensions/upload-multipart.ts` storage expectations.

**Do:** separate upload ownership/file fingerprint/provider phases/replay/expiry/cleanup state
behind a typed repository interface. Emit its migration/access requirements. Define metadata
validation/reservation and completion callbacks so video metadata and pending job intent can
share the right transaction later. Preserve SQL/provider uncertainty and stable identities.
Document how an asset binding maps to the current video identity without requiring a title/channel.
The generic upload migration must work without a video table; application relationships/metadata
come from hooks and later recipe migrations, not a hardcoded foreign key to YouTube tables.

**Check:** create/lookup rejects another principal; repeat completion retains its response;
expired/aborted state refuses completion; completion hook shares the state transaction. Offline
state checks stay focused; compile output with a small non-video metadata adapter.

**Do not:** implement S3 calls, FFmpeg, public video fields or a general entity editor.
**Done:** the multipart engine has one concrete repository/hook contract to call.
**Commit:** `YV2-07: extract owned upload persistence and hooks`.

## YV2-08 — Signed multipart engine

**Goal:** working generic owned resumable transfer, replacing the seven-line shell category.

**Read:** full `F/src/extensions/upload-multipart.ts`, upload API route shapes and browser
uploader's request expectations; YV2-07 interface.

**Do:** emit real create/sign/ListParts/complete/Head/abort, owner checks, exact part validation,
resume/status/reconciliation and bounded cleanup. Inject object/store bindings, content/metadata
validator, principal provider, upload repository and completion hook. Export an HTTP handler
factory with explicit mounts; YouTube's paths and error wording can be bound by its adapter.
Keep fixed current part/URL/size/expiry behavior; allow no unsupported transfer variant.

**Check:** own emitted build; isolated real multipart start/part/list/complete and one bounded
resume/abort, with exact bytes/fingerprint and foreign-owner refusal. A document-like metadata
adapter compiles without importing video contracts. No secrets/signed URLs in retained logs.

**Do not:** add tus, account creation, new media validation or frontend design.
**Done:** a consuming recipe binds real upload handlers without editing generic transport code.
**Commit:** `YV2-08: generate owned signed multipart transfers`.

## YV2-09 — Asset job lifecycle

**Goal:** reuse finite job/result state mechanics while retaining domain publication hooks.

**Read:** `F/src/state/video.ts`, `src/workers/completion-handler.ts`, `contracts/v1.ts`,
metadata migration and native010 ownership; YV2-06/07 interfaces.

**Do:** emit finite uploading/pending/processing/ready/failed/aborted/expired state integration,
job/attempt checks, result inbox, CAS/terminal rules, fixed DB deadlines/sweep and lifecycle
worker factory. Bind metadata/result codecs and a transaction-bound publication constructor.
Complete-upload hook commits pending+job intent; successful result commits ready+publication
intent. Runtime access derives from declared authority; media worker receives no SQL secret.

**Check:** stale/duplicate/late/failed results cannot publish; success has exactly one logical
publication intent and committed ready view contract. Exercise the concrete hooks with a bounded
non-YouTube result codec. Preserve deadlines rather than extending them for a test harness.

**Do not:** build a state-machine editor, add arbitrary retries/reprocessing/product states or
give a new independent owner access to bypass validation. **Done:** processing state and public
publication can be composed through explicit codecs/hooks.
**Commit:** `YV2-09: generate asset lifecycle and committed publication hooks`.

## YV2-10 — Video-to-HLS engine

**Goal:** a video feature usable inside a product/social/course app.

**Read:** `F/src/lib/media.ts`, `src/extensions/transcoder-{encoder,packager,thumbnails}.ts`,
media-result/marker validators and frozen fixture recipe.

**Do:** emit fixed safe subprocess/probe/input validation, 360/720 encoding, full-size thumbnail,
playlist/inventory verification and bound completion marker. Use generic asset/job/source
fingerprint interfaces, explicit paths and AbortSignal. Preserve fixed media bounds and local
cleanup contracts. Keep no YouTube title/channel/publication/search/count import in the engine.

**Check:** run real pinned FFmpeg on the existing fixture bytes in an owned scratch directory;
verify both renditions/codecs/duration/thumbnail/inventory and invalid-media failure. Reuse the
same engine API with an asset identity unrelated to `videoId`.

**Do not:** add codecs, portrait support, GPU/DAG scheduling, editing knobs or remote cleanup.
**Done:** the next unit can run this engine without any product metadata dependency.
**Commit:** `YV2-10: generate reusable fixed video processing`.

## YV2-11 — Media worker runner

**Goal:** connect the media engine to generic queue/storage work safely.

**Read:** `F/src/workers/transcoder.ts`, result prefix/message/marker validation and duplicate
evidence; YV2-05/09/10 interfaces.

**Do:** emit job decoder/identity binding, bounded object download/hash check, temporary workspace,
immutable output upload ordering, marker inventory validation/reuse, confirmed start/success/
terminal-result callbacks and graceful/fatal shutdown. Inject job/result codecs, buckets and
publisher. Preserve concurrency1. Add required object permissions/queue wiring contributions.

**Check:** actual storage/broker/FFmpeg result; duplicate job reuses outputs/marker with no
rewrite; invalid media emits a finite failure; local temps clean. Confirm no SQL mount and no
imports of YouTube domain schemas in the generic runner.

**Do not:** change global provider configuration or claim atomic object publication/ACLs.
**Done:** the same worker can serve an attachment pipeline without search/count infrastructure.
**Commit:** `YV2-11: generate storage-backed media job runner`.

## YV2-12 — Positive-cache read module

**Goal:** reusable cache/read mechanics with a small domain adapter.

**Read:** `F/src/state/watch.ts`, cache initialization/bounds in `services/watch.ts`,
`src/lib/cache.ts`; finite TinyURL cache records for understanding differences only.

**Do:** emit key/codec/loader-based positive-cache reader with single-flight, bounded cache
phases/fallback, TTL and optional record-expiry clamp. Use existing meaningful settings through
one authoritative source. Domain adapter decides eligible immutable public record and its shape.
Keep counts/private/not-ready records outside the cache; emit required clients/access wiring.

**Check:** same-key fill coalesces, corrupt/failed cache falls back, miss is not cached, failed
fill preserves successful read, optional expiry clamp works. Emit a differently shaped immutable
lookup using the same code. No claim this alone implements strict TinyURL Resolve.

**Do not:** add L1, negative caching, HTTP response caching, mutable-record invalidation or new forms.
**Done:** a public-ready adapter supplies loader/codec without duplicating the cache algorithm.
**Commit:** `YV2-12: extract positive cache read template`.

## YV2-13 — Receipt counter module

**Goal:** generic repeat-safe event counts, independent of video qualification.

**Read:** `F/src/state/counts.ts`, `extensions/counter-sum.ts`, `workers/view-counter.ts`,
counts migration and Watch's accepting route.

**Do:** emit bound aggregate/event identity validation, receipt+increment transaction, consumer
factory, totals schema/public view and reader. Keep qualifier at the caller/adapter; generic
counter takes a validated event and knows no page sessions, video readiness or browser time.
Use YV2-06 transactions/receipts rather than a second durability helper.

**Check:** repeat ID increments once; another event increments again; public reader sees totals
without private receipts; alternate non-video key/event codec works through the same template.
Own emitted build and small isolated DB/broker smoke suffice.

**Do not:** add unique viewers, analytics, score rules, arbitrary aggregation DSL or fraud policy.
**Done:** YouTube can bind ViewPlayed while another service binds a different qualifying event.
**Commit:** `YV2-13: generate generic receipt-based event counts`.

## YV2-14 — Search projection and query

**Goal:** reusable event-driven public projection with a finite video query preset.

**Read:** `F/src/lib/search-schema.ts`, `extensions/{indexer-writer,search-query}.ts`,
`services/search.ts`, `workers/search-indexer.ts` and publication event schema.

**Do:** emit generic typed public-document validation/mapping assertion, event-to-document
ID/version upsert and bounded query/result factory. Define the current title/description/channel
video preset separately from the mechanism. Bind index/client/queue explicitly; no private SQL
credential. Preserve filters, full-word behavior, paging/sort and incompatible-index refusal.

**Check:** real committed event becomes queryable; repeated event preserves one versioned doc;
pending/private fields cannot enter the public preset; a small catalog-like document compiles
through the same projection machinery. Never reset an existing index for a successful demo.

**Do not:** add prefix search, new relevance behavior, full Marketplace search or schema editors.
**Done:** YouTube binds committed publication, while other projections can omit video fields.
**Commit:** `YV2-14: generate search projection and bounded query modules`.

## YV2-15 — YouTube adapters and existing API

**Goal:** preserve product behavior with narrow adapters around extracted modules.

**Read:** `F/src/contracts/v1.ts`, `services/{upload,watch,search}.ts`, `state/watch.ts`,
public SQL views and all browser request/response usage. Use actual predecessor interfaces.

**Do:** emit video metadata/result/event codecs and adapter bindings for creator policy,
title/description/channel, ready-only public view, stable publication IDs, original/result paths,
Watch details/count/event acceptance and existing Upload/Search HTTP shapes. Compose existing
module factories; do not copy their algorithms. Keep API paths/status/body semantics compatible
with reused browser. Separate generic assetId from the videoId boundary where required.

**Check:** route/schema compatibility against current browser calls, public fields exclude private
state, view acceptance validates ready and awaits confirm, totals remain fresh outside cached
metadata. Record adapter LOC separately; it may be generated as part of the preset.

**Do not:** polish UI or add features; do not move core algorithms into YouTube adapters simply
to avoid fixing an interface. **Done:** the product contract is available to a composition unit.
**Commit:** `YV2-15: bind YouTube behavior to reusable feature modules`.

## YV2-16 — Composable video pack and YouTube preset

**Goal:** a connected generated backend rather than a bag of registered modules.

**Read:** predecessor APIs, normalized descriptors, native010 and v1 implementation plan's
authority/routing table. Inspect every emitted process's actual credential/resource needs.

**Do:** register a reusable base video-upload/processing feature pack and a YouTube core preset
that adds ready reads/search/count adapters. Materialize default graph/modules/ownership through
explicit commands. Attach a base pack to an existing design without selecting search/counters.
Assemble selected services/resources/SQL/migrations/grants/edge routes once, with no implicit
work inferred from names. Resolve binding inconsistencies in direct consumers and record them.

**Check:** generated backend own install/build/first-run and API upload→ready→Watch/search/count;
all required modules implemented, no business stub starts, unselected services absent. Compare
consumed settings to actual constructor/env/SQL arguments and report remaining custom hooks.

**Do not:** create the final field app/baseline yet or expand to a full Marketplace app.
**Done:** a complete template assembly is available for UI/reuse preflight.
**Commit:** `YV2-16: compose video feature and YouTube local preset`.

## YV2-17 — Supported mouse and chat configuration

**Goal:** users choose useful supported features through one consistent semantic path.

**Read:** `W/studio/InspectorForm.tsx`, `W/studio/inspector-drafts.ts`,
`W/studio/component-drafts.ts`, `W/studio/DesignScopeForm.tsx`, `W/canvas/TileInspector.tsx`,
`A/chat/tools.ts`, current project/module creation flow, support descriptors and actual registry.

**Do:** use existing creation/module/preset workflow for supported feature selection and atomic
attachment. Normal settings require installed consumer and user need. Hide fixed/internal
policies and unsupported alternatives. Apply the same capability rules to chat/tools so hidden
choices cannot be inserted as apparently supported intent. Keep legacy declarations unchanged;
explicit user-requested custom work becomes a visible generation gap, not an invented template.

**Check:** mouse attach a supported module/preset, change one supported useful value, Undo/reload;
chat shares the normalized command; uninstalled or unsupported selection refuses clearly. Changed
setting must reach actual generated output. Preserve complete original projects after review.

**Do not:** create a second settings panel, permission editor, generic config map or expose every
supported internal parameter. **Done:** only implemented useful configuration is normally editable.
**Commit:** `YV2-17: align editor and chat with installed template support`.

## YV2-18 — Inspector and diagram clarity

**Goal:** remove the observed clutter without hiding necessary generation decisions.

**Read:** review screenshots; `W/canvas/Workspace.tsx`, `W/canvas/TileInspector.tsx`,
`W/canvas/ownerProjection.ts`,
`W/studio/{OwnershipSummary,OperationsSummary,ReadinessReport}.tsx`; existing E2E assertions.

**Do:** put tile name/kind/useful settings first; remove repeated role/deployable narration,
single-role owner cards and ineffective collapse actions from normal generation authoring.
Use recognizable process tiles. Remove unrelated/declaration-only operations/requirements forms
from normal workflows; retain source/strict reports in appropriate diagnostic/export paths.
Keep useful selection/focus/error explanations. Update affected UI tests for actual supported
flows, retaining applicable underlying history/validation checks. No blanket test deletion.

**Check:** mouse YouTube and TinyURL open/render/select/focus/export; supported forms remain usable
at 1280×800 and 1440×900; Undo/reload preserve semantic data; repeated explanations and unrelated
contract actions absent. Capture source-linked before/after normal viewport evidence and update
studio/settings/blueprint/catalog documentation for actual behavior.

**Do not:** redesign routing/layout, split logical owners, delete old declarations, or move all
removed text into an Advanced menu. **Done:** editor reflects the owner's two-condition rule.
**Commit:** `YV2-18: simplify diagram and inspector authoring`.

## YV2-19 — Saved-source preview and ZIP

**Goal:** generate the selected supported design through Jeeves by mouse.

**Read:** `A/routes/generation.ts`, `A/generation/archive.ts`, `W/canvas/GenerateProject.tsx`,
`W/project/generation-api.ts`, existing preview/download tests and new assembler.

**Do:** dispatch legacy exact-v1 export and supported-source v2 export without substituting one
for the other. Expose relevant support/custom gaps near Generate and use actual registry support.
Keep stale revision/source/archive checks, dirty/invalid draft guards, project-switch cancellation,
deterministic ZIP/provenance and browser hash check. Include new trusted assets in Docker packaging
without including field app/runtime/secrets. Keep strict readiness/evidence separate.

**Check:** mouse current supported copy→preview→download; actual extracted own build; a changed
supported value changes its consumer/output; stale/unknown source cannot download old output;
legacy v1 bytes still reproduce. Bounded server packaging/start smoke includes the real v2 assets.

**Do not:** unconditionally require strict TinyURL eligibility or bypass source validation to get
a ZIP. **Done:** the next unit can capture and export a real selected v2 diagram.
**Commit:** `YV2-19: generate v2 projects from selected saved source`.

## YV2-20 — Reuse proof and final preflight

**Goal:** prove reusable boundaries and freeze credible v2 inputs before baseline generation.

**Read:** shared contract's reuse section, all emitted interfaces, v1 scenarios/fixture identity,
source-LOC method and existing diagram snapshot/export workflow.

**Do:** generate/build a small product-attachment composition through the same registry with
different IDs/resources/metadata and no search/count dependency. Exercise a real media/result
path and generic mechanism as specified; fix necessary template defects here. Run complete
YouTube generated-backend preflight in scratch. Prepare v2-specific reviewed backend/UI scope
and root tooling exclusions needed to preserve untouched field output. Create a separate v2
studio project from explicit selections, archive its native/source/studio snapshot and exact
inputs under `field-projects/youtube/v2/`. Do not change owner's v1/study projects.

**Check:** actual reuse evidence, no YouTube import in generic layer, no unselected credentials,
all backend preflight flows pass, meaningful setting changes reach consumers, input/output hashes
and legacy export stable. Retain fixture bytes. Allocate/document isolated v2 runtime ports/names.

**Do not:** build Marketplace itself or manually populate `v2/app`. **Done:** template defects
found before baseline are generator investment; complete frozen inputs are ready to export.
**Commit:** `YV2-20: verify template reuse and freeze v2 inputs`.

## YV2-21 — Untouched generated baseline

**Goal:** a genuine immutable baseline, with no post-generation application edits.

**Read:** YV2-20 frozen inputs and runtime allocation, `v1/notes/baseline.md`, generator export
instructions and benchmark method. Confirm destination `v2/app` does not exist.

**Do:** run the actual reviewed generator/new-directory exporter into `field-projects/youtube/v2/app`.
Commit exactly its emitted files, including manifest/report/source snapshot. Own frozen install/
build and bounded backend smoke may create ignored local artifacts only. Check every payload
against the manifest; record command/template/source identity in evidence outside the app.
Reuse browser/custom work starts in the next commit. Put this baseline's commit hash in the next
unit's notes, not a self-referential generated manifest.

**Check:** emitted hashes match; app has no checkout imports/secrets/dependencies/runtime data
staged; independent build works; required checks pass. If a template defect requires changed
payload, return to a clearly recorded pre-baseline repair/re-export before committing—never hand
edit the generated app. **Do not:** format/fix/apply UI files in the app in this unit.
**Done:** one exact generated-output commit exists as the comparison anchor.
**Commit:** `YV2-21: commit untouched generated YouTube v2`.

## YV2-22 — Browser reuse and residual completion

**Goal:** the same usable app on the generated backend, with honest custom accounting.

**Read:** new baseline manifest/commit, all v1 browser files/build/edge bindings, S01–S08,
review pack and implementation/runtime handoffs. Inspect actual v2 gaps before writing code.

**Do:** copy existing browser/presentation as reused custom UI; adjust issuer/client/callback/
ports together with backend environment binding. Complete only remaining required adapters/hooks.
Classify each change as reused UI, custom backend, generated-file repair or integration; preserve
baseline `.jeeves` bytes. Do not retroactively move post-baseline repairs into baseline credit.
Run full integrated S01–S08 bounded walkthrough with the exact fixture, including invalid media,
foreign ownership, refresh/resume, signed-out playback, search, duplicate counts and normal stop/start.

**Check:** actual mouse flows and observable backend/provider results; no new feature/UI polish;
record any partial/unobserved criteria and failed attempts. Update baseline notes with the prior
commit hash. Preserve v1 runtime/data and v2 credentials/volumes for the independent review.

**Do not:** rewrite templates merely to relabel completed custom work, change acceptance policy,
or start v3. **Done:** working v2 plus exact completion/provenance record is ready for fresh review.
**Commit:** `YV2-22: complete YouTube v2 with reused browser`.

## YV2-23 — Independent comparison and owner handoff

**Goal:** verify the actual deliverable and measure improvement fairly.

**Read:** v2 baseline/completion/input/scope records, v1 FP07b independent-run procedure,
source-LOC CLI/method and latest handoff.

**Do:** use an outside tracked copy with its own dependencies, fresh exact-project runtime and
credentials. Run the same bounded scenarios, restart and data/identity retention, then scoped
all-profile cleanup; retain the owner's normal stacks. Produce `source-loc-v2` using the actual
untouched baseline commit, actual completion commit and reviewed backend/UI scope. Preserve v1
reports. Add per-feature generated/custom/repaired attribution, reuse findings and owner walkthrough.

**Check:** report percentage is strictly above 5.53%, with legitimate composition/scoping and no
dead-code padding; complete app runs without Jeeves/network models; current templates/source
match frozen provenance; core functionality retained. Record 60% as long-run target, not this
acceptance threshold. Unknown effort remains unknown; template share is not reliability.

If share fails the improvement criterion, report the failure and concrete remaining custom area;
do not rewrite baseline, scope or denominator. A further extraction requires a separately assigned
iteration. **Do not:** repair product code while reporting a previous completion commit, change
the benchmark rules to pass, or start another field version. **Done:** evidence-backed owner
review pack and measured result, with no automatic v3.
**Commit:** `YV2-23: verify independent v2 and compare backend template share`.
