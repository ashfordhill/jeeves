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
