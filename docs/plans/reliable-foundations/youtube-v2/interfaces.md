# Implemented YouTube v2 interfaces

Owned by **YV2-01**. Import public symbols from `@jeeves/spec`; source lives in
`jeeves/packages/spec/src/`. Later units append their actual APIs and emitted paths here.
No v2 implementation is installed and no application files are emitted in this unit.

## Source and catalog

`generation.ts` exports `generationSchema`, `Generation`, `generationSelectionSchema`,
`GenerationSelection`, `generationTargetSchema`, `GenerationTarget`, `generationBindingSchema`,
`GenerationBinding`, `generationDependencySchema`, `GenerationDependency`,
`generationIdentitySchema`, `GenerationIdentity` and `GenerationResourceKind`.

Schema3 has optional `generation: {version: 1, runtime: ExactContractRef, preset?: ExactContractRef,
selections: GenerationSelection[]}` (maximum 500). A selection is
`{id, target, template: ExactContractRef, binding}`. Targets are
`{kind: "element", element}` or `{kind: "component", component, host}`. Selection IDs have their
own namespace. Exact refs use existing `{id, version, sha256}` / `exactContractRefSchema`.
No parser supplies generation, grants, settings, selections or an upgrade when they are absent.

`generation-catalog.ts` exports immutable `generationRuntime`, `generationPolicies`,
`generationTemplates`, `generationTemplateCatalog`, `generationPresets`,
`generationPresetCatalog`, `GenerationBindingKind`, `knownGenerationTemplate(ref)` and
`knownGenerationPreset(ref)`. Records contain `{ref, definition}`; SHA256 identifies canonical
descriptor JSON, **not executable template assets**. All initial descriptors are `0.1.0` and
experimental. Template records are keyed by the binding kinds below. Presets are `video`
(`video-feature`) and `youtube` (`youtube-core`). The local runtime ID is `local-runtime`.
Installed implementation/assets and their fingerprints belong to the later host/assembler.
Known catalog refs never imply installation, permission or certification.

Policies (`ownedMultipart`, `assetLifecycle`, `videoHls`, `positiveCache`, `eventCounter`,
`publicVideo`) hold internal fixed values and semantic constraints. They draw from frozen v1
[scenarios](../../../../field-projects/youtube/v1/notes/scenarios.md), `state/video.ts`,
`lib/media.ts` and `extensions/search-query.ts`; they are not a configurable policy language.
Existing adjustable settings remain authoritative; e.g. cache TTL is not duplicated in a binding.
The generic catalog records contain no YouTube resource IDs, schema names or bucket names.

## Binding variants

In this table **dep** means `{resource, connection}` with canonical element/connection IDs;
**selection** means another selection ID, not a template or element ID. Consumption follows
queue → host; publication and store use follow host → resource.

| `binding.kind` | Exact fields beyond `kind` |
| --- | --- |
| `owned-multipart` | `state: dep(database)`, `objects: dep(object-store)`, `jobs: dep(queue publish)`, `identity: {element, guard}` identifying an Identity tile and same-host auth-guard component; no fabricated Identity edge |
| `asset-lifecycle` | `upload: selection(owned-multipart)`, `state: dep(database)`, `results: dep(queue consume)`, `publication?: dep(queue publish)` |
| `video-hls` | `originals: dep(object-store)`, `outputs: dep(object-store)`, `jobs: dep(queue consume)`, `results: dep(queue publish)` |
| `positive-cache-read` | `source: dep(database)`, `cache: dep(cache)` |
| `event-counter` | `state: dep(database)`, `events: dep(queue consume)` |
| `search-projection` | `index: dep(search)`, `events: dep(queue consume)` |
| `search-query` | `index: dep(search)` |
| `youtube-upload` | `upload: selection(owned-multipart)`, `lifecycle: selection(asset-lifecycle)` |
| `youtube-watch` | `reader: selection(positive-cache-read)`, `counts: dep(database)`, `events: dep(queue publish)` |
| `youtube-search` | `query: selection(search-query)` |

`designGeneration(design)` returns `Generation | undefined`. `generationHost(selection)` returns
the canonical application host. `generationReferences(binding)` returns typed `resources`
(`field`, `dependency`, `kind`, optional `channel`) and `selections` (`field`, `selection`, `kind`,
`relation: host|authority`) for source paths/resolution. Identity/guard references are explicit
in the owned-upload variant. Lifecycle↔upload and YouTube upload→lifecycle are cross-role,
same-authority relations; other selection refs require the same host. Lifecycle and upload
must use the same state resource. Jobs originate at upload; lifecycle does not invent a job edge.

`generationFindings(design)` validates duplicates, exact known-ref/binding agreement, canonical
targets, component hosts, resource kinds, endpoints, channel direction/use, identity/guard and
selection relations. Structural contradictions refuse even on previously invalid source.
Unknown refs remain exportable `NEEDS_TEMPLATE` declarations. Known refs also remain unavailable
pending an installed registry. Missing authority is `CONFIG_REQUIRED`; conflicting authority
refuses. Full grants, provider/settings/policy normalization and actual availability are YV2-02.

## Atomic editing and preservation

`generation-command.ts` exports `generationCommandSchema`, `GenerationCommandInput`,
`buildGenerationCommand(design, {generation: Generation|null, ownership?: Ownership, upgrade?: boolean})`
and `previewGeneration(design, input)`. Builder returns `{ops}`: optional explicit upgrade and
ownership replacement plus `setGeneration`, all committed as one existing operation batch.
The preview lists generation before/after, exact ownership/operation changes and targeted findings;
it writes nothing. Schema2 apply requires `upgrade: true`. No-op builders return no operations.
Primitive `setGeneration` requires schema3; `null` removes the optional field.

`pruneGenerationTargets(design, removedElements?, removedComponents?)` cleans only explicitly
deleted selected targets. Canonical deletion and component removal call it. Removing a bound
resource/connection/guard or a selection still used by a surviving selection refuses; explicitly
detach/change that consumer in the same batch. History stores full before/after snapshots;
Undo/Redo restore declarations and schema as new revisions. Chat context and `studioChanges`
carry source declarations without adding an editor or chat configuration tool yet.

Blueprint v3 optionally preserves detached `generation` and `generationFindings`; absent fields
stay absent. V2 refuses `generation.version`, `.runtime`, optional `.preset` and each
`.selections[index]`, even for an explicit empty declaration. Strict TinyURL readiness includes
present generation in its subject/hash and refuses it as outside the finite strict composition;
absent-generation subjects and frozen v1 output identities remain unchanged.

The small offline fixture `fixtures/yv2-selections.ts` attaches all variants to read-only native010
source. It is test material, not the future v2 snapshot or an export input. No generator, renderer,
forms, preset attachment implementation or field app exists yet. Next owner: **YV2-02**.

## YV2-02 — semantic normalization and installed control support

Public exports from `@jeeves/spec`:

- `generationCapabilities`, `GenerationCapability`, `GenerationResourceRequirement`,
  `GenerationSettingRule`, `GenerationSupportedValues`, `GenerationValue` in
  `generation-support.ts`: finite per-template host/role/store/access/channel/mode requirements
  and setting authorities, supported values, internal defaults, consumer responsibilities and
  optional necessary-user-choice rationale. These are semantic descriptors, not another provider
  registry or installed code. Fixed alternatives/policies never become normal controls.
- `GenerationInstalledSupport` is supplied explicitly by the trusted host. It has optional exact
  `runtime`, optional exact `presets`, and `templates: GenerationInstalledTemplate[]`. Each template
  has exact `ref` plus `consumers: {input, consumer, outputPaths}[]`. Paths are actual safe relative
  generated outputs; each input is unique per installed template. The assembler owns executable
  code/asset fingerprints. A host must attest real wiring, never register a future placeholder.
- `resolveGeneration(design, installed = {templates: []})` returns a recursively frozen
  `{model, findings, settings, complete}` without modifying source or installation data.
  `NormalizedGeneration` / `NormalizedGenerationSelection` contain canonical target/host/owner,
  role provenance, exact template/policies, strict bindings, finite consumed `inputs`, canonical
  resources and local identities, least required access plus declared grant/boundary provenance,
  queue direction and optional verified JWT/Keycloak identity binding. Unknown exact selections
  remain findings and cannot become normalized executable selections. Structural contradictions
  return no model. Missing/unsupported/uninstalled choices may retain a partial diagnostic model;
  **only `complete: true` has no semantic/support blockers**. This does not prove application hook
  completion, emitted build/runtime correctness or strict TinyURL readiness. Those remain host/
  assembler/module evidence responsibilities.
- `GenerationSettingDecision` gives each input's actual source paths/value, supported values,
  consumer, host-attested output paths, explicit source/descriptor-default/missing origin,
  supported/fixed/unsupported/missing status, optional
  `userNeed` and `normalControl`. A normal control requires both necessary choice and actual
  installed consumer/runtime support; absence of a consumer cannot be satisfied by copying a value
  into JSON. No v2 host installs code by default in this unit. Binding and fixed-policy responsibility
  also require consumer attestations: input `binding`, consumer equal to `binding.kind`; each
  policy uses input `policy.<policy-ref.id>` with the same consumer. Setting input/consumer keys
  are the exact values in `generationCapabilities[kind].settings`.

Cache tile `ttlSeconds` is the single TTL source; traced cache-reader `l2TtlSeconds`, when present,
asserts equality. Worker tile `concurrency` is authoritative; traced consumer concurrency asserts
equality. Conflicts refuse, and absent authoritative values require explicit source edits.
Media concurrency is fixed at one. Batch size one, linger zero and bounded retry counts
(media3/lifecycle10/counter5/projection5) are internal descriptor defaults, not normal choices.
Descriptor defaults have no invented document source paths.
Other existing source values are consumed only through declared rules; unconsumed selected
settings have precise unsupported findings. Nothing is cleared or filled into saved source.

Stores require explicit role grants and dependency access, correct source/projection semantics
and deliberate cross-authority published reads. Cache projection source must equal the reader's
bound source. Queues require explicit publish/consume direction and work-queue/topic mode; they
use canonical channel bindings rather than fabricated store grants. Native010's queue→consumer,
publisher→queue, same-authority Upload/lifecycle roles and guard-without-Identity-edge remain.
The selected preset requires its explicitly listed templates; normalization never attaches them.

The one direct YV2-01 amendment is a demonstrated relational contradiction: `generationFindings`
now refuses a YouTube upload adapter whose lifecycle references a different owned-upload selection,
even if each individual selection is valid. Atomic source commands therefore refuse it too.
No binding fields or template identities changed.

The fixed local runtime requires SQL/Redis/Messaging/HTTP and private-network transport for bound
resources. Inherited HTTPS/Service identity promises stay explicit unsupported findings at their
original connection paths; the later v2 seed may correct those intentionally. The required Identity
service-language field cannot express a vendor product. `model.localAdapterTreatments` preserves
its exact declared TS/Go value and source path as `unsupported-intent`, with actual vendor
`keycloak` and an explicit finite OIDC substitution reason. This record is nonfatal and must remain
visible in generated provenance/support reports; it never claims a TS/Go Identity implementation.
Identity execution/provider/exposure/replica settings are checked; other intent stays unsupported.

`generationLocalIdentity(id)` validates the existing 63-character canonical slug, preserves it as
`local`, and replaces hyphens with underscores as `sql`. This is injective because source IDs
cannot contain underscores; no truncation/prefix/label inference occurs. SQL renderers must quote
this validated identifier, including possible SQL keywords, and separately validate any composed
identifier/path or provider-specific limit they introduce. Selection IDs retain their own namespace;
future emitters must not conflate selection and element paths.

Four offline boundary cases cover complete trusted-host normalization, setting edits/conflicts,
unknown/catalog-only/missing-consumer support, provider/language/local intent, unknown definitions
and Identity settings, endpoints/grants/channel modes/cross-selection/extra-binding refusal, labels,
immutability and safe identity/output paths. These are test-host attestations, not installed runtime
features. No renderer, executable template, forms, broad registry or field output exists yet.
Next owner: **YV2-03 only**.
