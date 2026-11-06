# Architecture review and the path to reliable foundations

2026-11-06. Review of the owner's three screenshots, the saved designs read through the local
API, and source at `5caefc2`. The screenshots and the owner's questions are preserved in
[HUMAN_FEEDBACK](../../HUMAN_FEEDBACK.md#2026-11-06--three-study-review-and-reliable-code-foundations).
The [proposed units](units.md) turn these findings into bounded work. This is a review and plan;
the proposed architecture, contracts and generator do not exist yet.

Jeeves has a useful foundation: finite settings, shared commands for chat and mouse edits,
revision checks, an atomic chat turn, undo, and a deterministic blueprint projection. Its main
gap is semantic. A graph can pass the current rules while leaving the important behavior
undefined. A Service, Database and Queue joined by lines do not specify an application that a
generator can implement without making architectural and business decisions.

The direction should be a typed architecture specification, edited through a readable diagram,
with a separate compiler that assembles reviewed templates. The diagram is the human view of
that specification. Names, prose and screen coordinates must never become hidden instructions
to the compiler.

## What the review established

| Observation | Evidence | Consequence |
| --- | --- | --- |
| Original videos has a reader | YouTube's `transcoder-read` connects Transcoder to Original videos; its label is Reads originals | This part is a visibility problem, not a missing dependency. Keep durable originals. |
| Upload and processing state is intentionally absent from the metadata DB | `studio-examples/youtube.ts` carries title and description in messages and writes the video record only on completion | The study cannot yet explain pending, failed, cancelled or edited videos. Multipart progress is not the whole video lifecycle. |
| Search and metadata are sibling projections of completion | Completion events feeds both Completion handler and Search indexer | Search can expose a video before its authoritative record is available. |
| The no-cycle rule influenced service boundaries | YouTube's playbook pattern 2 and Marketplace's source comment explicitly cite it | A presentation constraint is deciding where business state lives. |
| Dashes describe ancestry as well as interaction | `studio-lanes.ts` sets dashed for asynchronous edges **or** sources not reachable by an entirely synchronous path | A worker's ordinary database/storage request looks like another asynchronous message. |
| Store access is inferred from ownership | `studioStoreAccess` returns write for the owner or owning package's members, read for everyone else | An owner's read is not distinguishable from a write; another service's write cannot be declared and rejected as such. Packages already provide part of a broader ownership model. |
| The in-app assistant does not receive the playbook | `chat/tools.ts` supplies instructions and six tools; `chat/service.ts` sends that context, history and attachments | Repository lessons currently help development agents, not automatically Jeeves chat. |
| OpenAI tool schemas use best-effort generation | `packages/providers/src/openai.ts` explicitly sets `strict: false` because command fields are optional | Keep existing server validation; evaluate a compatible strict tool interface rather than flipping a flag. |
| Blueprint v2 describes design intent | It has kinds, settings, purposes, links and modules; no executable API/event contracts or template verification | An empty findings list is not evidence that code can be generated or that a composition works. |

Saved copies differ from current presets. The local API reported YouTube 2.1.0 revision 1,
Marketplace 1.2.0 revision 1, and TinyURL 2.0.0 revision 41. Source presets are YouTube 2.1.0,
Marketplace 1.3.0 and TinyURL 3.2.0. Saved projects are independent documents; this review does
not replace them.

## YouTube

The broad ingredients are reasonable for an upload-and-playback system. They are a reference
slice, not an implementation of YouTube's actual infrastructure.

### Originals and the upload fork

Keep Original videos. The queue should carry an object reference and job metadata, not the
video's bytes. The Transcoder reads the original, writes renditions and manifests, and can retry
or create new encodings from the durable source. AWS's reference video pipeline likewise keeps
source and output objects separately and serves outputs through a CDN.
[AWS video architecture](https://docs.aws.amazon.com/solutions/latest/video-on-demand-on-aws-foundation/architecture-overview.html)

The Upload service legitimately has two responsibilities visible here: authorize/complete the
upload, then arrange processing. One line describes storage access; the other describes a job.
They should not look like two competing user journeys. With signed URLs, the service controls
permission while the client transfers bytes directly. Keep that distinction explicit in the
inspector and blueprint even if the overview retains the owner's preferred service-first shape.
Multipart storage records uploaded parts; it does not by itself model the application's video
status, permissions or processing attempts.
[S3 multipart behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)

### What completion means

Completion events currently means “the transcoder produced these playable assets.”
Completion handler means “record the playable video's metadata.” Both are valid responsibilities;
neither name communicates much to a newcomer. More useful names would be Transcode results
and a completion consumer within the Video service.

Do not infer that each handler needs its own independently owned microservice. An HTTP API and
background consumer can belong to the same business service, sharing its schema and release
contract, even when they run as separate processes. The current package-owner support is worth
building on. “One data owner” should identify a business boundary, not prohibit multiple worker
replicas or force a new service for each callback.

### The missing lifecycle

Recommended future flow:

1. A Video service creates a durable video/upload record and checks creator permissions.
2. Its upload endpoint authorizes the transfer. After storage confirms completion, it records
   Processing and reliably schedules a job containing the video ID, source object/version and
   processing attempt.
3. The Transcoder reads Original videos, writes versioned output assets, and reports success or
   failure. It does not decide whether the video is publicly visible.
4. The Video service consumes the result, checks the attempt is still current, and updates its
   authoritative record. Ready, Failed, Cancelled and visibility are explicit decisions.
5. A committed publication change produces VideoPublished/VideoUpdated/VideoUnpublished events;
   the Search indexer maintains its derived index from those events.

This conceptual sequence deliberately visits the **same** Video service twice:

~~~text
Video service -> processing job -> Transcoder -> result -> Video service
                                                        |
                                          committed publication event
                                                        |
                                                  Search indexer
~~~

That is a normal asynchronous lifecycle, not necessarily an infinite execution loop. The
semantic model must distinguish that return from accidental recursion. A readable journey can
show separate steps referencing one service identity.

Persisting state and publishing a message need an explicit recovery mechanism. An outbox can
couple a database state change with the intent to publish; consumers still need duplicate
handling. It does not make an object-store write and a database transaction atomic. Upload
finalization and completed processing need resumable reconciliation or provider notifications,
stable operation IDs and safe retries.
[Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

Publishing after the record commits improves the search ordering. It does not eliminate every
read race: the Watch API currently reads replicas and caches. Define read-after-publish behavior,
negative-cache handling, and visibility checks too. Index lag can be acceptable; serving a deleted
or unauthorized video is a different question.

Other details should be contract choices, not more overview tiles: retry limits and dead-letter
recovery, incomplete-upload cleanup, job deduplication, stale completion rejection, cache
invalidation, and whether view counts are approximate or deduplicated. Public videos alone are
a legitimate scope; private playback and moderation must be explicit exclusions or supported
policies, not implied by “enterprise.”

## Marketplace

Catalog, search projection, cart, payments and image delivery are sensible ingredients. The study
explicitly leaves out stock reservation and shipping and records orders only once paid. That is
an understandable demo scope, but too narrow for a general retail foundation.

The highest-priority changes are about checkout:

- Create a durable Pending order/checkout attempt before requesting payment. Capture the price
  and items used for that attempt; correlate retries, provider sessions and later notifications.
- Have checkout obtain authoritative price and availability through the Catalog/Inventory
  contract. Payments currently reads Shop's Catalog database directly. Either declare these
  processes part of one owned service boundary or replace that shared-schema dependency.
- For finite stock, reserve it with an expiry and concurrency rule; release or compensate on
  failure. Inventory can start inside Catalog. It does not automatically need another service.
- Payments owns provider interaction and payment records. Orders owns order transitions. Handle
  a timeout where a payment may have succeeded, duplicate or delayed notifications, cancellation
  and eventual reconciliation.
- Keep browsing/search eventually consistent, while rechecking price and availability at
  checkout. A search index is not the checkout authority.

These are my recommendations for the intended scope. Independent services with private data
and explicit APIs avoid accidental coupling through each other's database schemas.
[Microsoft's data ownership guidance](https://learn.microsoft.com/en-us/azure/architecture/microservices/design/data-considerations)

The source already describes signature verification, once-only webhook handling and an outbox
in modules. Those are useful intentions, not existing implementations. A payment template must
prove the behavior, including duplicate and unordered notifications.
[Stripe webhook behavior](https://docs.stripe.com/webhooks)

If checkout spans services, a persisted workflow with compensations is an appropriate candidate
pattern. A failed step may require releasing stock or requesting a refund; that is not a
database rollback across all participants.
[Saga pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)

Taxes, shipping, refunds, seller settlement, auctions and regional rules vary substantially.
Define a narrow “fixed-price, finite-stock checkout” profile before claiming a reusable
marketplace template. Do not hide these business decisions inside a generic Payments brick.

## TinyURL

This is the strongest first generator exercise: a small create/read contract, durable data,
cache behavior and a separable analytics path.

The screenshot's core path is sound, with two qualifications:

- Its saved CDN has `cacheRedirects: enabled`, and the CDN-to-Redirect link says “Forwards cache
  misses.” Hits therefore bypass the component publishing click events. Count at the edge too,
  or disable redirect-response caching if every redirect is supposed to reach that publisher.
  This is an inference from the saved configuration, not a runtime measurement.
- There is no visible reader for Analytics store. Add a Stats API if analytics is a product
  feature, or explicitly call it an external reporting sink.

The current 3.2.0 preset already removes the CDN and adds Stats API. The owner's 2.0.0 project
has custom edits and should not be silently replaced. Its reputation API is also outside the
current preset.

Remaining behavior belongs in the first template's contract: code uniqueness/collision handling,
idempotent creation, unknown/expired/disabled links, cache freshness, immediate read after create
when replicas lag, authorization for management/stats, and the loss/duplication policy for
analytics. Expiry must affect lookup behavior even if a later cleanup job removes old records.
Do not add a tile for each of these rules.

## Why the paths are hard to read

The canvas currently mixes user journeys, service dependencies and data access in one routing
scheme. Shared trunks look like meaningful junctions; return paths look like group borders;
dashes after a queue obscure ordinary reads/writes. Fewer pixels of line is not enough to make
these distinctions understandable.

Recommended progression:

1. Give every relationship direction. Define arrows as caller-to-target for requests and
   producer-to-channel-to-consumer for messaging; “reads” is not an arrow showing byte travel.
2. Base solid/dashed style on that relationship's interaction. A database request remains a
   request when its caller is a background worker.
3. Make read/write/publish/consume visible through short labels, distinct endpoint positions
   and a persistent legend. Separate unrelated routes before they resemble a bus.
4. Offer a mouse-driven focus on one journey or tile's dependencies, with an obvious way to
   reveal everything and a count of hidden relationships.
5. Keep logical services/resources in one model; let overview and journey views project it.
   Do not create duplicate services just to draw the same participant twice.

C4 similarly distinguishes a static model from a view of interactions in a particular use case.
The proposal here applies that separation within Jeeves' approachable canvas.
[C4 dynamic diagrams](https://c4model.com/diagrams/dynamic)

The four-link and two-action limits should eventually be presentation defaults or complexity
warnings, rather than universal claims about software. Change those rules deliberately with
migration and mouse-edit support; do not simply disable graph validation.

## Helping the in-app assistant

Give it a smaller, better-defined design problem and executable checks.

**Reference material:** distill the reviewed playbook into versioned pattern records. Each needs
applicability, required roles and relationships, allowed variants, invariants, failure modes,
tradeoffs, a small example, sources and unsupported obligations. Start with cache-aside lookup,
durable jobs, publication-to-search, and pending-order/payment workflows. Mark patterns that
cannot yet be represented by the current model. Do not feed the existing playbook wholesale:
its “jobs done once,” one-writer shortcuts and no-cycle workarounds need the qualifications in
this review.

**Tools and harness:** add bounded pattern lookup and deterministic design review to the existing
tool loop. The model should establish the user's use case, retrieve relevant patterns, propose
a small command batch, preview its effects, inspect structured diagnostics, and repair within a
fixed limit. Preserve revision checks, whole-turn undo and server-side validation. Start with
local lookup by kind/use case; a vector database or multiple agents is not required for a small
catalog.

**Schema discipline:** evaluate strict tool schemas with nullable optionals and explicit
normalization into current commands. Strict output constrains the shape; it does not prove a
correct architecture. Keep semantic validators.
[Function calling](https://developers.openai.com/api/docs/guides/function-calling),
[Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

**Evidence:** run the intended economical chat model against reviewed tasks and held-out variants.
Include building a design, changing requirements, repairing a broken design and refusing to
invent unsupported behavior. Measure semantic defects, unintended edits, successful repairs,
clarifying questions, latency and cost. A scripted fake proves application plumbing, not model
design quality. Evaluate the checks and resulting graph independently of the model's explanation;
use human review for readability and architectural tradeoffs.
[Evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices)

The proposed runtime can remain one agent with tools. Sequential Sol xhigh development agents
are a separate implementation workflow, not a requirement for Jeeves' users.

## The generator boundary

Keep the generator in a separate project. Its input should be an immutable blueprint snapshot
with a content hash, exact contract and template versions, and a resolved compatibility profile.
Jeeves remains usable for designs that are not yet generatable.

| Contract area | Minimum explicit information |
| --- | --- |
| Business responsibility | Logical owner, state it owns, exposed capabilities and custom obligations |
| API | Versioned operation and schema references, errors, auth/authorization policy, timeout and idempotency behavior |
| Events/jobs | Message schema/version, publisher and consumers, delivery/ordering scope, deduplication, retry/dead-letter policy |
| Data | Owner, access intent, schema/migration reference, source versus projection, freshness policy |
| Lifecycle | Supported transitions, correlation/attempt IDs, completion/failure and reconciliation behavior |
| Implementation | Template ID/version, provider/runtime profile, typed extension points and unsupported combinations |
| Verification | Exact composition and artifact hashes, test-suite version, environment and results |

Use established API/schema formats where they fit, such as OpenAPI for HTTP and AsyncAPI for
messaging. Select and pin the revisions the first implementation supports; this review does
not require the latest revision or a general-purpose schema editor.
[OpenAPI](https://spec.openapis.org/oas/v3.1.1.html),
[AsyncAPI](https://www.asyncapi.com/docs/reference/specification/v3.0.0)

Generic service shells can supply transport, health, logging, persistence adapters and
instrumentation. A template that reliably creates short links or reserves inventory also needs
a specific behavior contract. Arbitrary prose in a custom module cannot supply that guarantee.

Separate three statements: **this design requests a capability**, **a compatible template is
available**, and **this exact generated composition passed these tests**. A tested brick does
not establish that every arrangement of bricks works.

The compiler should emit reproducible source/configuration, typed clients/events, migrations,
runtime policies, tests and a provenance manifest. It must reject unsupported requirements
without guessing, avoid LLM calls during compilation, and preserve custom code through explicit
extension boundaries. Regeneration must detect hand edits to generated files instead of
overwriting them.

Start with one TypeScript/container profile, PostgreSQL, one cache and one messaging adapter,
then a complete TinyURL slice. Prove restart recovery, duplicate delivery, stale-cache behavior
and safe regeneration. Add the media pipeline next; use checkout as the later exercise in
stateful coordination. Language/provider combinations multiply the verification work, so
availability should grow only with tested compositions.

The “60% reliable foundation” is a worthwhile target, but measure supported, tested behaviors
and recovery scenarios rather than lines of code. Production readiness also depends on workload
targets, operational evidence and the application's custom policy. The first deliverable should
be a small foundation whose limits are visible and whose behavior can be reproduced.
