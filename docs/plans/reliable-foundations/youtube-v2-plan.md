# YouTube v2 build plan

Historical execution plan. The owner subsequently clarified that product-specific code belongs
after the generated baseline. YV2-15/16 below placed YouTube implementation before YV2-21 and
caused the misleading 100% credit. Do not repeat that ordering. The
[generic replay](youtube-v2-generic-baseline.md) removes those implementations from active v2
generation while preserving the historical application and the counting scope.

Owner decisions: 2026-11-08. Based on the [completed review](youtube-v2-review.md), commit
`5a700c2`. This document settles the planning questions and replaces that review's provisional
unit list. It is the execution specification for future assignments; this planning unit does
not start the implementation agents.

## Outcome and acceptance

Generate a fresh YouTube v2 with the same basic functionality as v1 and a backend retained
template share **strictly greater than 5.53%**, using the existing backend-only method.
**60% is an eventual target across field projects, not a v2 acceptance threshold.** Keep the
actual numerator, denominator and custom completion record, not just the percentage.

Reuse is a primary outcome. YouTube must compose generic templates and a reusable video
feature. A Marketplace product video must be able to use the media feature without adopting
YouTube's discovery/counting/product policy. The same generic mechanisms should be usable
in TinyURL, social applications, browser games or an existing service when their requirements
fit. Do not build those products during this iteration.

The normal editor shows only a configuration that both affects an implemented template and
is a useful decision for the user. Generation may need internal identities, schemas, grants,
state policies and defaults without asking the user to configure or read them. Keep those in
typed source/template metadata and diagnostics. Do not move the clutter into an Advanced form.

Completion requires all of the following:

- An actual untouched v2 generator output commit, followed by separately recorded custom work.
- The frozen v1 S01–S08 functionality and policies retained, with observed/partial/unobserved
  criteria reported honestly. The existing v1 no-human-listening record remains historical.
- Real generated backend build/start and upload/processing/publication/playback/search/count
  evidence, plus independent outside-checkout execution and normal restart.
- A reviewed backend/UI scope and `source-loc-v2` report whose `templatePercent > 5.53`.
- A second small composition exercising the same generic/video templates with unrelated IDs
  and without YouTube search/count modules; no copied second implementation.
- Mouse-usable, template-backed studio controls without repeated role/deployable explanations
  or unrelated TinyURL operation forms. Legacy source remains preservable/exportable.
- Existing Jeeves required checks pass; v1 inputs/export identity, app, runtime and historical
  evidence remain intact. No root README edits or push.

## Fixed product scope

Keep local Docker, TypeScript, PostgreSQL, Garage/S3-compatible storage, RabbitMQ, Valkey,
OpenSearch, Keycloak and nginx, using the existing exact pins. Creator sign-in/out, owned
multipart upload/resume/abort/status, real CPU HLS/thumbnail, automatic successful publication,
public ready-only Watch/search and eventual basic counts remain.

Preserve v1's transfer/media/time/count/search policies in
[`scenarios.md`](../../../field-projects/youtube/v1/notes/scenarios.md). In particular: 5 MiB
parts, 256 MiB transport maximum, 15-minute signed URLs, 24-hour owned resume window, fixed
queue/processing deadlines, MP4/H.264/AAC landscape input bounds, 360p/720p HLS, and one
playback event after two cumulative qualifying seconds per page session. Retain public metadata
commit before search publication and transactional duplicate-event suppression.

Reuse the existing browser as custom UI. Change only environment/identity bindings needed to
connect it to v2. No account creation, inventory browsing, search-prefix improvement, analytics,
video editing, new codecs, cloud deployment, fraud prevention, moderation or UI redesign.
Remote partial/orphan outputs and existing local-security limits remain explicit; do not turn
cleanup/security improvements into prerequisites or claim new guarantees.

## Design: compose reusable mechanisms

| Template area | Generic responsibility | Other fitting use | Application work retained |
| --- | --- | --- | --- |
| HTTP service/verified identity | Startup, admission, deadline, safe errors, verified principal adapter | TinyURL create, game API, social API | Routes and business authorization policy |
| Durable queue worker/publisher | Confirms, delivery metadata, bounded retry/terminal hook, drain | Imports, notifications, media jobs | Job schema and actual work |
| SQL transaction/outbox/inbox | Commit intent with state, relay, receipt with effect | Listing events, social posts, game activity | Event shape and domain transition |
| Owned multipart upload | Provider operations, ownership, phases, expiry, reconciliation | Product media, documents, game assets | Accepted content and metadata, completion hook |
| Asset-processing lifecycle | Fixed upload/job/result/terminal mechanics and stable identities | Product video, report/import processing | Metadata, result codec, publication policy; not arbitrary workflows |
| CPU video-to-HLS | Validate/probe, encode, thumbnail, inventory/marker, storage/job execution | Marketplace video, social clip, course video | Linking asset to product/post/course and deciding visibility |
| Positive cache-aside | Key/codec/loader, single-flight, expiry/fallback | Immutable link lookup, public asset details | Domain validity/expiry adapter; not the entire strict TinyURL contract |
| Event counter | Durable receipt plus one increment, public total | Views, social interactions, game activity totals | What qualifies as an event; not fraud-resistant analytics |
| Search projection/query | Explicit public document/version/mapping, event upsert, bounded query | Marketplace catalog, public posts | Indexed fields, eligibility and query preset |

The generic layer must not import YouTube contracts or assume `videoId`, `creator`, `channel`,
`youtube-v1`, hardcoded bucket/schema names or element-ID prefixes. Pass validated bindings,
codecs and narrow typed callbacks. Video-specific code may know codecs/renditions and asset/job
identities. YouTube adapters may know title/description/channel, its public projection, API
shapes and playback-event acceptance. Preserve those distinctions in generated paths/manifests.

Do not make every module depend on search, counters or video. Do not create a universal
workflow/entity/policy language. Start with the finite proven v1 mechanisms, explicit adapter
interfaces and versioned presets. An existing service can consume a generated module through
those interfaces; requiring the whole YouTube runtime is a reuse failure.

The [shared contract and controls](youtube-v2/contracts-and-controls.md) fixes the input,
ownership, interface and UI rules. The [assignments](youtube-v2/assignments.md) gives each fresh
agent its own reads, allowed work, checks and stopping point.

## Repository and generation boundaries

- Existing `jeeves-generator/templates/local-v1/`, frozen v1 profile/inputs, original identities
  and output remain byte-reproducible. New assets belong under `templates/local-v2/` and new
  implementation under `src/v2/`. Reuse safe utilities without altering v1 behavior.
- Shared declarative generation selections/capability descriptors belong in
  `jeeves/packages/spec/`, so mouse, chat, blueprint and generator use one semantic contract.
  The spec package must not import executable templates or Node filesystem code.
- Add an optional, strictly typed `generation` selection to schema3. No schema4 migration,
  read-time upgrade, arbitrary config map or extra visible role editor is needed. Preserve
  declarations in blueprint v3; blueprint v2 must refuse semantic loss. Details are in the
  shared contract. Unknown template refs cannot select code.
- Accept supported selected-source edits, not only one exact whole-document hash. Pin actual
  inputs, template source/assets, dependencies and output; labels/prose never select algorithms.
- Generate standalone application source and all required SQL/resource/setup wiring. No app
  imports from this checkout, `workspace:` dependencies, network/model calls at render time,
  secrets in source, or reads of the mutable v1 app during rendering.
- Keep partial intermediate assemblies explicitly partial; do not start unfinished workers or
  call a shell ready. Complete export eligibility follows installed implementations, separately
  from the unchanged strict TinyURL readiness/evidence semantics.
- Export only to a new directory. Preserve custom paths and refuse edited-output overwrite.
  Automatic merging and in-place v1 data migration are outside scope.

Use `field-projects/youtube/v2/{inputs,diagrams,notes,app}` for the field experiment when its
assigned snapshot/baseline units arrive. Early template scratch exports belong in owned `/tmp`
directories. Reuse evidence belongs under
`docs/plans/reliable-foundations/evidence/youtube-v2/`. Do not prefill `v2/app` manually.

## Execution order

All work is sequential on main in `/home/ash/github/jeeves`. The coordinator gives a fresh
agent exactly one ID, waits for its completed commit/handoff, then assigns the next. Do not
spawn a parallel reviewer/writer. Do not have a builder execute the next row autonomously.
Once the sequence is assigned for execution, the coordinator advances after ordinary passing
handoffs without asking the owner for permission at every unit.

| ID | Bounded deliverable |
| --- | --- |
| YV2-01 | Typed generation selections, atomic source command, validation and blueprint preservation |
| YV2-02 | Pure binding resolver and supported-capability/control descriptors |
| YV2-03 | Separate deterministic v2 assembler, manifest/report and fresh-directory CLI export |
| YV2-04 | Local project/provider setup, migration/access composition and exact standalone locks |
| YV2-05 | Reusable repaired HTTP/identity and AMQP runtime helpers |
| YV2-06 | Generic SQL outbox/inbox/receipt transaction mechanisms |
| YV2-07 | Owned-upload persistence and typed completion/metadata interfaces |
| YV2-08 | Reusable signed multipart engine and HTTP handler factory |
| YV2-09 | Fixed asset lifecycle, result receipts, deadlines and committed-publication hooks |
| YV2-10 | Reusable fixed FFmpeg/HLS/thumbnail/inventory engine |
| YV2-11 | Storage/queue media-worker runner and immutable-result reuse |
| YV2-12 | Generic positive-cache reader and ready-view adapter interface |
| YV2-13 | Generic event-counter consumer, schema and public-total reader |
| YV2-14 | Generic search projection/query machinery and public-video preset |
| YV2-15 | YouTube HTTP/event/metadata adapters with unchanged browser API |
| YV2-16 | Video feature pack and YouTube preset composition; generated backend integration |
| YV2-17 | Supported feature/settings choices shared by mouse and chat |
| YV2-18 | Inspector/canvas decluttering and relevant generation support presentation |
| YV2-19 | Selected saved-source preview/ZIP flow and v1 compatibility dispatch |
| YV2-20 | Reuse proof, final template preflight and v2 diagram/input snapshot |
| YV2-21 | Actual untouched v2 generated app commit; no custom completion in this unit |
| YV2-22 | Reuse browser, bounded residual completion and integrated field walkthrough |
| YV2-23 | Independent run/restart, backend benchmark, provenance and owner review pack |

YV2-01 freezes concrete exported symbol/binding names in a small implementation interface
record; later agents use it. Each module unit appends its actual API/output paths there.
This is a coordination document, not an extra editor or a replacement for compiling output.
If an interface must change, the assigned agent updates its existing direct consumers in that
unit, explains why, and records it; it must not leave the next agent to guess.

A missing dependency is not authorization to take over another unit. Resolve small interface
defects in scope; otherwise stop with exact file/symbol/evidence and the smallest proposed split.
Do not ask the owner again about settled scope, generic/video reuse, UI policy or the 60% target.
Do ask if actual new behavior, a provider/pin change, destructive owner-data operation or a
material product choice is necessary. Ordinary implementation choices are the builder's work.

## Check and handoff policy

Every unit reads AGENTS and the latest handoff, stages only its own changes, runs the existing
required `pnpm check`, `pnpm test:e2e` (Docker fallback if necessary) and web build, appends a
short handoff and creates one local commit. User-visible changes also get an actual mouse
check with TinyURL still rendering. Do not weaken assertions or increase timeouts to pass.
When a control is intentionally removed, update the corresponding UI tests to the new supported
flow while retaining applicable underlying validation/history guarantees and explaining the change.

Generator/template checks stay small: exact-input determinism, real changed-output binding,
unsupported/refused choice, custom preservation and a few important durable invariants. Prefer
compiling/building emitted code and exercising the actual feature. No large new unit-test,
provider, fault, load or certification matrix. Unit tests remain offline and Docker-free.

Each unit emitting executable application code builds fresh output with its own lockfile
(the project envelope arrives in YV2-04). Field apps are outside the
root workspace; `pnpm check` alone does not verify them. Update root discovery/Biome exclusions
for v2 only when needed, preserving baseline bytes rather than formatting generated output.

Preserve owner services, ports, credentials, volumes and the fixture. Allocate a free v2 port
trio, project name and runtime/secrets directory together; record them before first start.
Never use global Docker prune, reset v1, or commit videos, signed URLs, tokens, secrets,
dependencies or runtime/build data. New DB unit probes use PGlite or focused existing offline
adapters; real provider smokes belong in isolated runtime evidence.

Each handoff names: unit/commit; changed contracts and generated files; checks and actual result;
remaining explicit gaps; next exact unit; owners/resources to preserve. Record generator work
separately from field custom work. The coordinator verifies those facts before advancing.

## Coordinator assignment text

```text
Execute YV2-XX only from docs/plans/reliable-foundations/youtube-v2/assignments.md.
Read AGENTS.md, the latest docs/handoff.md,
docs/plans/reliable-foundations/youtube-v2-plan.md and
docs/plans/reliable-foundations/youtube-v2/contracts-and-controls.md first,
then your unit's source references.
Work sequentially on main in the primary checkout. Do not delegate, branch, stash,
push, edit root README.md, alter v1's app/runtime/inputs, or start the next unit.
Use the shared interface record and existing predecessor output; do not redesign it.
Complete your unit's explicit checks plus AGENTS checks, append a short handoff,
and make one local commit with only your changes. Report exact remaining blockers.
```

The planned next implementation unit is **YV2-01**. The owner has settled the three review
questions and the cross-project reuse priority; no further planning clarification is needed.
