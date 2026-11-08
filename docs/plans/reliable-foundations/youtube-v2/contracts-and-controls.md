# Shared contract for YouTube v2 agents

Read with the [plan](../youtube-v2-plan.md) and only your assigned
[unit](assignments.md). This is a finite implementation contract, not a proposed user form.
Names below are planning names; YV2-01 records the actual exported symbols once, and later
agents reuse those names rather than inventing parallel interfaces.

## Semantic input and output

Add optional `generation` to schema3, with `version: 1`, an exact local runtime reference and
an array of explicit module/template selections. Each selection has a stable ID, an existing
canonical element/component target, an exact template reference, and a finite tagged binding
for that template's resource/connection/component references. Use strict discriminated schemas.
No arbitrary configuration object, executable path, SQL text, callback source or inferred
implementation from a name/purpose is allowed in a saved design.

Keep creation defaults in versioned descriptors, materialized on an explicit preset/module
command. A pure read never fills missing permission, changes schema or silently substitutes
a template. Where an existing setting already owns a value, the binding refers to that setting
instead of storing a second value. Schema3 absent-generation documents preserve current shape.
Keep existing explicit ownership/access models as the semantic source for generated access;
module attachment writes required declarations through one atomic command, with a preview of
affected existing facts when necessary. Do not require users to maintain a permission matrix.

The initial binding variants cover owned multipart, fixed asset lifecycle, fixed video-HLS,
positive-cache read, event counter, search projection/query and the bounded video/YouTube
adapters. Runtime libraries and resource templates may be contributed dependencies rather than
separate user selections. Each selected component's host and each connection endpoint must
match its declared binding. Validate the necessary source/store/role grants and channel mode.
Missing, wrong-kind or conflicting references refuse or produce explicit incomplete support;
the exporter never guesses credentials or publishes incomplete required behavior as a full app.

Persist/export these semantics in v3 source/blueprint, command history and chat context. V2
blueprint refuses the `generation` paths it cannot carry. Exact TinyURL readiness is still
strict and separate: account for new output-relevant declarations conservatively or reject
them for that strict composition. A v2 experimental template does not certify TinyURL contracts.

Resolve to one immutable normalized generation model containing canonical targets, validated
bindings, actual settings, exact preset policies, selected template identities and local resource
identities. It drives rendering, capability lookup and setting decisions. Source hash, project
revision and raw input snapshot are provenance. A changed supported setting changes its actual
emitted consumer. An unsupported setting cannot be silently copied to JSON and treated as honored.

Two identities are useful: exact saved input hash for stale-preview/provenance checks, and
normalized semantic input for compilation. Camera/selection/history/project envelope are not
behavior selectors. Human names may affect documentation; algorithm selection remains explicit.
Do not reuse a stale archive after any required source check fails.

Keep old `assembleExperimental`/frozen v1 dispatch and identities working. Add a separate v2
assembly API/registry and route dispatch. New template sources/assets are trusted repo files
with actual fingerprints. Rendering reads validated inputs and pinned assets only, never clocks,
randomness, network, environment secrets or the mutable v1 app.

Each emitted file declares its owner template and contributing source paths. The manifest names
the exact runtime/preset/template/dependency identities and payload hashes. The support report
names implemented, fixed-policy, custom, unsupported and unfinished behavior honestly. Resolve
shared-file ownership in the assembler, not by last-writer-wins string concatenation.

Generated app paths use `src/runtime/`, `src/features/`, `src/adapters/` and `src/services/` or
similarly clear backend directories. Custom work uses separate hook/adapter paths, never edits
hidden template interiors by convention. The final scope must explicitly classify every eligible
backend/UI path. SQL/scripts/infrastructure remain essential outputs outside the LOC metric.

## Reusable runtime interfaces

Use the concrete v1 source as extraction material, with provenance. Keep generic mechanics small.
Callbacks below mean typed application/template code compiled into the output, not user-entered
code. Do not invent a runtime plugin loader or public configuration DSL.

| Mechanism | Required input/interface | Owner of behavior |
| --- | --- | --- |
| HTTP factory | Service ID, actual admission/deadline settings, configure-before-listen callback, readiness initializer, idempotent close | Runtime owns admission/drain/safe errors; route adapter owns auth/business decisions |
| Identity verifier | Explicit issuer/audience/JWKS/algorithm binding; returns verified principal | Runtime verifies token; adapter requires creator/upload access |
| Publisher/consumer | Explicit endpoint/queue, concurrency/retry, body+delivery metadata, terminal/fatal hooks, close promise | Runtime owns confirms/ack/drain; handler owns durable effect |
| SQL transaction | Pool and awaited transaction callback | Callback commits receipt/state/intent together; no external network effect claimed atomic |
| Outbox relay | Validated schema/table/destination binding, payload codec, dedicated confirmed publisher | Mechanism locks due intents, confirms and marks sent; duplicate remains possible |
| Owned upload state | Upload identity/principal/file fingerprint, validated application metadata hook, provider-phase state | Upload module owns transport lifecycle; adapter owns video metadata and downstream intent |
| Complete-upload hook | Runs inside the completion SQL transaction, stable completed identity/fingerprint and replay response | Adapter creates exactly one logical job intent with pending state; no publish-before-commit |
| Asset lifecycle | Asset/job/attempt identity, finite result codec, fixed deadlines, transactional success/failure hook | Core rejects stale/terminal results; adapter constructs domain publication/public view |
| Media engine | Verified local original, output directory, source fingerprint, asset/job/attempt IDs, AbortSignal, fixed preset | Engine encodes/validates; it knows no listing/channel/search/count policy |
| Media runner | Bound object clients/buckets, job/result codecs, engine, start/result/terminal callbacks | Runner downloads/hash-checks, uses immutable marker inventory, publishes confirmed results |
| Positive cache | Key function, codec, authoritative loader, TTL/optional record-expiry adapter, cache adapter, bounded phases | Mechanism coalesces/falls back; adapter defines eligible immutable public record |
| Counter | Validated aggregate key+event ID, table binding, transaction and read-view binding | Mechanism deduplicates/increments; accepting app defines qualifying event |
| Search projection | Typed public document codec, ID/version functions, explicit mapping/index binding, event codec | Mechanism validates/version-upserts; adapter chooses public fields and eligibility |
| Search query | Bounded query input, explicitly supported typed query preset and result codec | Adapter chooses title/description/channel weights, filters, page size and sort |

The extraction can preserve the current SQL storage layout for YouTube through an explicit
binding while offering generic helpers elsewhere. It must not achieve genericity by adding
unused factories or renaming domain code without separating dependencies. Prevent arbitrary
SQL identifier interpolation: derive identifiers from validated bound IDs/trusted descriptors.

Avoid rewriting every message name unnecessarily. YouTube's HTTP contract remains compatible
with the reused browser; internal media interfaces can use `assetId` with narrow event adapters
mapping to `videoId`. Record the event schemas and where each validation/identity check happens.
Generic media code must be exercisable without importing YouTube's event/domain module.

## Fixed policies and persistence invariants

- Upload ownership derives from verified principal and durable records, never client-provided
  creator, key or provider ID. Complete checks real ListParts and Head/fingerprint; repeated
  completion returns the stable result. Aborted/expired uploads cannot complete. Keep provider/
  SQL uncertainty and bounded reconciliation visible.
- Commit pending state and job outbox intent together. A result cannot mark an unrelated job/
  attempt ready. Receipt, conditional transition and publication intent share one transaction.
  Enforce DB deadlines even if the sweep has not run. Terminal state ignores late success.
- Public metadata/search receive only committed eligible results. Media runner has no SQL
  credential. Indexer has no private metadata credential. Watch sees ready view and public
  totals; migration-owner credentials are setup-only. Binding grants produce actual logins,
  mounts and views, not just documentation.
- Preserve the current fixed media ladder, marker fingerprint/inventory checks, write ordering,
  duplicate reuse and unconditional local-temp cleanup. A complete marker is not an atomic ACL
  boundary for all objects. One configured media worker/concurrency1 remains a bound.
- Counter receipt and increment commit together. API validates ready/public before confirming
  acceptance. Do not infer playback from a metadata/search/media GET. Browser qualification
  remains reused custom UI. Totals are not inside the immutable metadata cache.
- Search uses committed publication, explicit public fields and versioned repeat-safe upsert.
  Do not reset an incompatible index. Preserve v1 search semantics rather than adding prefix
  search or recommendations.

## Reuse acceptance, with limits

The alternate composition is a small **product-attachment example**, not Marketplace v1.
Use different canonical IDs, authority/schema/bucket names and service labels. Generate the
same owned-upload/lifecycle/media templates without Search API, search index, counter or
YouTube browser. Exercise an asset completion/result path and a non-video-specific generic
mechanism (for example, receipt counter or durable job) through its typed interface.

The generated media core accepts an asset/result interface. A product service would own the
product↔asset association and decide how/when to display the ready asset. Do not implement
product catalog, checkout, inventory, social feeds, moderation or game rules now. No claim
that the full Marketplace/TinyURL/social/game application is implemented follows from reuse.

At minimum show that: emitted code compiles without YouTube contracts; changed bound names
reach actual clients/resources; no unselected search/count processes/credentials are required;
and the same registered implementation handles the alternate source. A renamed screenshot or
copy of the entire YouTube app does not pass. Keep proof bounded; no matrix of imagined products.

## Normal controls: two conditions, not one

A normal control must have an implemented template consumer **and** represent a necessary,
meaningful user choice. Internal metadata can be essential to generation and still stay hidden.
Unknown selections remain diagnosable/exportable, without normal editable false promises.

| Surface | Normal editor behavior | Internal/diagnostic behavior |
| --- | --- | --- |
| Feature/template selection | Choose supported capability such as owned upload or video processing through existing project/module workflow | Pin exact versions/policies and required dependencies automatically; no hash/version fields on tiles |
| Tile identity and connections | Clear name/kind, useful purpose, actual connected resources; normal mouse creation/selection/focus | Stable IDs and precise binding/grant source retained |
| Deployment/provider/language | Only genuinely implemented alternatives; fixed local preset can show one concise summary | Exact pins/provider overrides in generation details; no nonfunctional Go/tus/cloud choices |
| Execution grouping/roles/authority | Existing service/worker tiles; no repeated role chips, deployable placeholders or single-role owner cards | Canonical ownership/grants and supported grouping metadata retained/exported; no manual matrix required |
| HTTP/SQL/queue limits | Reuse existing fields only where supported and user-adjustable within the preset | One authoritative value; fixed media concurrency and required outbox not editable toggles |
| Cache | A needed, supported cache choice/TTL when useful | One TTL authority; keys/codecs/fill/fallback/expiry policy in template/adapter; no unsupported L1/negative knobs |
| Media details | Supported video-processing feature/preset; no custom FFmpeg form | Codecs/ladder/timeouts/marker/cleanup bounds in versioned descriptor and generated code |
| Operations/requirements/readiness | Relevant generation support and actionable errors near Generate | Preserve strict TinyURL contracts/report semantics through blueprint/diagnostics; remove unrelated authoring forms from YouTube and unsupported normal workflows |
| Legacy/custom declarations | Indicate a real custom extension/generation gap only when relevant | Preserve old values; exact export/diagnostic access, not an Advanced settings dumping ground |

Use one declarative capability descriptor to drive supported mouse choices, chat-edit validation
and generator input checking. Track template consumer/output path for every normal setting.
Being present in the descriptor is insufficient if the executing registry lacks that template;
the host exposes actual installed support. Unsupported historical values must not be silently
cleared on selection/reload or silently normalized to a different product.

Normal actions for old projects must still work: open/render, name, select, focus, export,
history and choose/attach a supported feature with explicit preview of necessary changes.
Do not preserve a nonfunctional settings form merely because an old UI test opens it. Retain
the underlying validation and data; adapt affected E2Es to real supported flows. Never make
all projects appear supported by hiding blocker counts or weakening strict readiness.

Every intentional diagram/presentation change gets an immutable native/source/studio snapshot
with a short reason. Capture useful focused views and a normal viewport, not only a giant export.
Stop adding canvas text when the selected template already determines the fact.
