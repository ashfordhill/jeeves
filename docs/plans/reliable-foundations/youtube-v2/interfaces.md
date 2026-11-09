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

## YV2-03 — registry, assembly, provenance and fresh export

Public exports from `@jeeves/generator`, implemented separately in `jeeves-generator/src/v2/`:

- `validateV2Input({designJson})` / `V2Input` / `V2ValidatedInput`: strict explicit schema3
  generation; preserve exact saved bytes, original parsed `rawDesign`, schema-parsed `design`,
  `sourceSha256` and `sourceCanonicalSha256`. Schema defaults do not create source declarations
  for file provenance. Unsupported selected choices stay diagnostic; structural contradictions
  refuse with `GeneratorRefusal`.
- `captureV2Sources(rootUrl, paths)` / `V2Source`: trusted registration reads repository bytes
  once. `createV2Registry(sources, emitters)` / `V2Registry`: snapshot immutable source/asset
  content, derive actual `sourceSha256` per emitter and full registry `sha256`, then derive the
  spec's `GenerationInstalledSupport`. Semantic `{id,version,sha256}` refs remain distinct from
  executable identity `{id,version,sourceSha256,sources,dependencies}` / `V2EmitterIdentity`.
  Hosts supply the complete actual source closure; function text or descriptor SHA cannot replace
  it. `asset(path)` returns copied bytes only; a renderer may read only its own declared closure.
- `V2Emitter` has unique `id`, exact `version`, `sourcePaths` naming captured implementation/
  assets, exact `dependencies?`, `status: implemented|partial|diagnostic`, `description`, optional
  `provides`, and synchronous pure `render(context) -> {files,gaps?}`. `provides.runtime` and
  `.presets[]` carry `{ref,outputPaths}`; `.templates[]` reuse **the actual spec contract**
  `{ref,consumers:[{input,consumer,outputPaths}]}`. One emitter owns each runtime/preset/template
  responsibility. Only real `implemented` emitters can attest installation. Partial/diagnostic
  emitters cannot install complete support; partial emitters automatically add a required gap.
- `V2RenderContext` is `{model: NormalizedGeneration, settings: GenerationSettingDecision[],
  asset(path)}`. All trusted emitters are invoked in stable ID order; **feature emitters must
  filter the normalized selections for their responsibility and return no feature files when
  unselected**. Project owners may inspect the entire normalized model to compose shared output.
  Renderers read no mutable files, v1 app, environment, clocks, randomness or network.
- `V2TemplateFile` is `{path,content,ownership,sourcePaths,contributors?}`. Ownership is
  `generated-scaffold|generated-extension`; source paths are distinct exact original-design JSON
  pointers. `contributors` is `[{emitter,sourcePaths}]`, with unique other registered emitter IDs.
  There is exactly one writer per file. A project owner composes the full file and names its
  contributors; other emitters never append/overwrite. YV2-04 can introduce its specific typed
  migration/access hooks using this single-writer boundary; no universal fragment DSL exists.
- `V2Gap` is `{id,status: custom|unfinished|unsupported,description,sourcePaths,required}`.
  Emitters must report missing required application hooks rather than treating generated shells
  as implemented behavior. Required gaps prevent application completion.
- `assembleV2({designJson}, registry) -> {files,manifest,report}`: use `resolveGeneration` exactly
  once, render frozen normalized semantics, validate paths/collisions/original pointers and
  verify **every selected installed consumer output against files actually emitted**, including
  that consumer's owner/explicit contribution. A path advertisement or somebody else's file
  does not count. Missing output refuses `MISSING_CONSUMER_OUTPUT`.

Metadata paths are `.jeeves/inputs/design.json` (exact bytes), `.jeeves/normalized.json`,
`.jeeves/report.json` and `.jeeves/manifest.json`. `.jeeves/` is assembler-owned. The manifest
records source/canonical/normalized hashes, complete registry source hashes, exact runtime/preset/
all declared template refs (including unsupported refs), executable/dependency identities and
each payload's hash/bytes/owner/design pointers/contributors. It excludes itself; the support
report is hashed. No timestamp, source filename, checkout path or project envelope selects code.

The report retains resolver settings/findings and `localAdapterTreatments`. Setting `status`
retains semantic meaning; `implementationStatus` separately says
`implemented|fixed-policy|unsupported|unfinished`, so a supported value without an emitted
consumer remains unfinished. Selections/fixed policies and custom/unfinished gaps stay explicit.
`semanticComplete` is resolver support; `applicationComplete` additionally requires no required
gap. Neither attests build/runtime/scenario evidence (`runtimeVerification: none`) nor strict
readiness (`strictReadiness: not-assessed`).

`loadLocalV2Registry()` in `templates/local-v2/index.ts` snapshots generator/spec source and assets
and currently registers **only** `local.diagnostic`. It emits `diagnostics/generation.json`, with
the required `application-implementations` unfinished gap; no semantic runtime/preset/template is
installed. YV2-04 replaces/refines this broad diagnostic gap when the project envelope exists and
registers only its real foundation. Later feature units register only their actual implementation.
`export:v2 <saved-design.json> <new-directory>` uses the same registry and existing safe
`exportNewDirectory`. Existing `assembleExperimental`, `export:new`, local-v1 assets/identities and
108-file output (including manifest) remain unchanged. No forms, server preview or v2 app exists.

Five focused offline cases cover determinism/semantic versus raw identity, actual changed asset
identity/immutable capture, missing/wrong-owner consumers and explicit shared ownership, unsupported
selections, unsafe/defaulted source paths, edited/custom output preservation and frozen v1 output.
The CLI is also exercised against a disposable saved fixture. Next owner: **YV2-04 only**.

## YV2-04 — standalone local foundation

`loadLocalV2Registry(features: readonly V2Emitter[] = [])` now snapshots optional trusted feature
registrations and installs `local.foundation` for `generationRuntime.ref`. It still uses
`createV2Registry` → `assembleV2` → `resolveGeneration`; no second assembly/normalization path
exists. `createLocalFoundation(sourcePaths, features)` in `src/v2/local.ts` owns project files.
`local.diagnostic` retains a required missing-feature gap only while selected templates are
uninstalled. No preset/feature is installed by this unit.

`V2Emitter.local?: V2LocalContributor` and exported `V2LocalContribution` in
`src/v2/local-contract.ts` are trusted compiled-template hooks, never saved-design fields:

- `sourcePaths`: actual selected source pointers, required for any contribution.
- `migrations: {resource,id,sql}[]`: selected SQL resource, unique ordered `001-...sql` or later;
  trusted SQL is emitted once into `infra/postgres/<canonical-resource>/<id>`.
- `logins: {resource,host}[]`: canonical bound host/store; creates an exact composed runtime role
  with CONNECT/USAGE, no implicit table or sequence grants. Migration-owner/admin mounts stay
  setup-only. Role credentials are verified on every migration, never rotated.
- `views: {resource,schema?,name,selectSql}[]` and
  `grants: {resource,host,schema?,relation,kind: table|view,privileges}[]`: finite SELECT/INSERT/
  UPDATE/DELETE privileges, separately quoted bounded schema/relation identifiers. Schema defaults
  to `public`; explicit schema USAGE accompanies relation grants. Declared normalized access bounds
  privileges; a foreign `published-read` may receive only an explicitly contributed view. All
  login/view declarations are gathered before cross-module grants, independent of emitter order.
- `broker: {resource,host}[]`: durable topic subscriber for an actual normalized consuming host.
  Selected work queues use their canonical resource ID; selected topics use canonical exchange
  IDs and contributed `<resource>--<host>` queues. Every delivery queue has a `.failed` queue.
- `storage: {resource,host,corsPut?}[]`: exact bound read/write permissions, private generated
  per-host keys; optional PUT CORS uses the injected HTTP origin and temporary owner permission
  revoked in `finally`. Selected buckets/public website intent derive from canonical bindings.
- `search: {resource,version,properties}[]`: explicit strict versioned mapping; finite keyword,
  text, integer, long, double, date fields and optional `index` flag. Existing mismatches refuse
  without deletion. Missing selected mappings remain required unfinished gaps.
- `services: {host,command,http?,identity?,dependsOn,sql?,storage?,broker?,cache?}[]`: one real
  later implementation per canonical host, exact runtime credential mounts and selected dependency
  health ordering. Optional `identity` must match the host's normalized principal binding and
  supplies public issuer/internal JWKS URLs. The HTTP slot exposes one service; multiple APIs
  require a later explicit edge. This unit contributes no application services or fake readiness.

The foundation is the sole writer for `compose.yaml`, `infra/local.json`, migration SQL and the
standalone envelope. Only actual typed contributors appear on composed outputs; each migration
names its specific contributor; static assets have no feature contributors. Runtime resource
bindings aggregate required access per host/store (read + write → read-write), preserve deliberate
publication boundaries and validate authority/grant/dependency provenance before credentials.
SQL identities use injective canonical slug conversion and quoted identifiers. Composed database/
role names must fit PostgreSQL's 63-byte limit; storage/broker names validate provider limits.
Oversized identities refuse; nothing truncates or sanitizes into a collision.

`templates/local-v2/assets/` captures v1 package/lock and provider pins as extraction material at
implementation time. It contains no v1 runtime reads or product names/demo users/domain schema.
TypeScript source assets use `.ts.template`, outside generator dependency resolution; the exported
standalone project compiles them with its own exact lock/dependencies. Internal workspace imports
and `workspace:` dependencies never enter application output. All existing exact dependencies are
retained in this first envelope; feature units can reuse them without introducing new pins.

Generated output: package/lock/tsconfig/Dockerfile, ignored private-runtime boundaries,
`src/runtime/local.ts` (actual secret reader/quoted SQL utility), `scripts/{common,status,setup,
local,migrate,broker-init,bootstrap,storage-config,search-init}.mjs`, selected provider/setup Compose,
`infra/local.json`, per-store `000-foundation.sql`, README and unchanged assembler provenance.
Postgres role/database creation moved into the explicit setup migration service; no product init
shell or domain table is copied. The sole foundation table tracks migration hashes. Keycloak receives a distinct vendor runtime
login (`ik_<canonical-sql-id>`) with schema CREATE in its isolated database, never the setup-only
migration owner (`io_<canonical-sql-id>`) or that owner credential. This vendor capability does
not extend to ordinary application logins.

First-run requires an explicit unique Compose project and a free distinct injected port trio;
HTTP/identity/object ports bind `127.0.0.1` only. Owner/v1 reserved ports refuse. Secrets are created
only after export under ignored `.runtime/secrets`, with private 0700 parent directories and
container-readable credential files. The 0600 state records project/ports/composition, credential
hashes and exact Docker volume identities. Normal restart verifies all of them; unknown existing
runtime/Docker state (including exact-name unlabeled volume/default-network collisions), missing/recreated volumes, changed credentials/composition or an interrupted
single-use storage bootstrap refuse. `stop` addresses every Compose profile. Scoped disposable
cleanup uses the exact recorded project with `docker compose --profile '*' down --volumes`;
there is no global prune/reset operation. No runtime evidence is inferred by assembly reports.

Next owner: **YV2-05 only**, repaired reusable HTTP/verified identity and messaging mechanics.
No domain feature, field app, saved v2 snapshot, forms, server preview or v1 change exists yet.

Integration boundary for **YV2-16**: the foundation currently permits one directly exposed HTTP
service slot. YouTube needs three internal APIs behind its single pinned nginx edge, plus static
browser/public media routing. Extend the finite service/edge composition in that assigned unit;
do not add public API ports or editor configuration to bypass the boundary.

## YV2-05 — reusable HTTP, identity and transport clients

`loadLocalV2Registry` additionally registers `local.primitives` (`implemented`, dependency on
`generationRuntime.ref`). It emits actual dependency libraries, with exact selected declaration
pointers, through the same registry/assembler. It declares **no** `provides.templates` or preset:
none of the upload/lifecycle/video/cache/counter/search business implementations or their controls
become installed. No services, credentials, mapping, tables or application hooks are contributed.
Missing selected implementations/application services/mappings remain explicit required gaps.

Generated modules below belong to `local.primitives`; source assets are the corresponding
`templates/local-v2/assets/src/runtime/<name>.ts.template`. Field SDK imports compile only in the
standalone emitted package, with the unchanged YV2-04 exact package/lock. The emitter omits
unselected responsibilities: HTTP when a selection consumes `host.requestTimeoutMs`, identity
when a normalized principal binding exists, and SQL/object/search/messaging by the actual bound
resource kind. `src/runtime/local.ts` remains foundation-owned and is reused, never duplicated.

- `admission.ts`: `HttpSettings {requestTimeoutMs,concurrencyLimit}`, safe public
  `HttpError(statusCode,code,message)`, `createAdmission(settings) -> {open,stop,run,drain}`.
  The response deadline never releases the slot before the admitted promise settles.
- `http.ts`: reexports `HttpError`/`HttpSettings`; `HttpRoutes.route({method,url,handler})`;
  `createHttpService({id,settings,configure,initialize}) -> {inject,start({host,port}),close}`.
  Configure completes before listen; only awaited route handlers are exposed, not lifecycle/plugin
  hooks outside the budget. All auth/JWKS/dependency/effect work must be awaited inside those
  handlers. `initialize` is required and awaited before listening/readiness. `/healthz` returns
  uninitialized503/ready200/draining503; all responses are no-store. Unknown routes return404;
  arbitrary provider errors expose only finite safe messages. Start is single-use; close is
  idempotent, stops admission, closes HTTP and drains work before caller closes dependencies.
- `identity.ts`: `IdentityBinding {issuer,audience,jwksUrl,algorithms,jwksTimeoutMs}`;
  `createPrincipalVerifier(binding,keySet?: JWTVerifyGetKey) -> verify(token)` returns
  `VerifiedPrincipal {subject,claims}`. It verifies signature, explicit issuer/audience/algorithm,
  exp and nonempty bounded sub. Optional JOSE key adapter supports an existing/offline service.
  No role, username, browser client, realm prefix or business authorization policy is inferred.
  Later local adapters use foundation-supplied OIDC issuer/JWKS; explicit API audience and creator
  policy/setup remain the YouTube adapter/composition's responsibility, not a guessed helper default.
- `delivery.ts`: `Delivery {messageId,headers,deliveryCount,redelivered}`, `MessageHandler`,
  `NonRetryable(code)`, `ConsumerHooks {onTerminal?,onFatal?}`, `DeliveryBinding
  {queue,failedQueue,retryLimit}`, `validateDeliveryBinding`, `DeliveryMessage<Receipt>`,
  `DeliveryTransport<Receipt> {cancel,republish,ack,close}` and
  `createDeliveryRunner(options) -> {accept,close,closed,fatal}`. It awaits the effect before ack;
  failures await terminal hook when applicable, then confirmed retry/failed publication, then ack.
  Retry limit counts additional attempts; metadata uses `x-delivery-attempt`, terminal codes use
  `x-terminal-code`. Invalid attempt metadata exhausts the bounded retry policy. Cancel precedes
  admitted-task drain, channel close, connection close. Terminal/confirm failure initiates fatal
  closure without awaiting its own task; no ack follows failed terminal work/confirmation.
- `amqp.ts`: reexports `Delivery`, `MessageHandler`, `ConsumerHooks`, `NonRetryable`;
  `BrokerBinding {hostname,port,username,passwordSecret,heartbeatSeconds,confirmTimeoutMs,
  credential?}`; `createPublisher(binding,{exchange,routingKey},hooks?)` returns
  `{publish(body,messageId),close,closed}`; `createConsumer(binding,{queue,failedQueue,concurrency,
  retryLimit,handle,onTerminal?,onFatal?})` returns `{close,closed}`. Publisher confirms are bounded
  and pending confirms drain before channel/connection close. Consumer prefetch is explicit;
  invalid delivery/concurrency bindings refuse before allocating a connection/credential read.
  Both `closed` promises resolve `{fatal:boolean}` after drain. `onFatal` is a notification:
  application orchestration owns signals/exit policy and must never await its own drain inside
  delivery/terminal work. There is no reconnect/exactly-once guarantee.
- `postgres.ts`: `createPostgres({hostname,port,login,poolSize,statementTimeoutMs,
  connectionTimeoutMs,credential?}) -> pg.Pool`. `login` takes exact `{database,user,secret}`
  from foundation `infra/local.json` login entries. Their `host` identifies the application host,
  so the network `hostname` is separate. Reuse `local.ts`'s `quoteSqlIdentifier` for later trusted
  schema/relation descriptors; this unit adds no transactions/domain SQL.
- `objects.ts`: `createObjects({endpoint,region,credentialSecret,credential?}) -> S3Client`;
  `signPart(client,{bucket,key,uploadId,partNumber,expiresInSeconds})`. Private credential JSON
  uses the actual foundation-generated storage secret. Pass distinct control/signing endpoints;
  the caller owns ownership, upload phases, part/size constraints and signed-URL policy.
- `search.ts`: `createSearch({endpoint,requestTimeoutMs}) -> Client`, retries disabled;
  no default index/mapping/query. SQL/object/broker credential readers default to the actual
  emitted `readSecret`, with optional explicit adapters for an existing service.

Resource names/logins/secret identities/queue topology come from the YV2-04 plan and contributions,
not source-ID prefix conventions. For local messaging, use the plan's exact exchange/queue and
its asserted `<queue>.failed` destination; the generic clients also accept unrelated explicit
bindings. No helper contains YouTube contracts, resource IDs, audience or product constants.
[Bounded actual evidence and limits](../evidence/youtube-v2/yv2-05-primitives.md).
Next owner: **YV2-06 only**, generic transactional outbox/inbox/receipts.

## YV2-06 — transactional delivery and receipt dependencies

`loadLocalV2Registry` also registers `local.durability`, an implemented dependency emitter with
no `provides.templates` or preset. Actual owned-multipart, asset-lifecycle or event-counter
selections emit `src/runtime/{transaction,durable-sql,outbox,receipts}.ts`, with their selected
source pointers. This installs no owned-upload/lifecycle/counter business template, policy,
service, migration or implicit permission. Required application/feature/mapping gaps remain.

- `transaction.ts`: `Tx` exposes a typed generic `query<Row>(sql,values?)` for one active
  transaction; `TransactionPool` is the actual pg pool's connect boundary.
  `transaction<T>(pool,effect: (tx: Tx) => Promise<T>)` begins, awaits the callback and commits,
  or rolls back/releases. `assertTransaction` rejects inactive/failed scopes;
  `abortTransaction(tx,error)` invalidates the scope. Failed queries, enqueue and receipt hooks
  poison it even when a compiled adapter catches the error, so an aborted PostgreSQL transaction
  cannot return false committed success. Failed rollback discards the connection. Callbacks must
  await their SQL work and use this scope; they are trusted compiled adapters, never saved-source
  code. Business state and intent/receipt effects use this same `Tx`.
- `durable-sql.ts`: `SqlRelation {schema,table}`, `OutboxTable` additionally has finite unique
  `destinations`. `qualifiedRelation` reuses foundation `quoteSqlIdentifier` independently for
  schema/table; invalid identifiers/destinations refuse. `outboxSchema(binding)` and
  `receiptSchema(binding)` return SQL with private schema/public revocation, fixed generic
  columns and constraints, no owner name, product schema, message schema or grants. Outbox
  event/intent IDs are explicit bounded text keys; intent keys are unique across that table.
  Receipts key `(scope_key,event_id)` and retain validated identity payload plus result.
  `durableIdentity`, `jsonPayload`, `validateOutboxTable` are shared validation helpers.
- `outbox.ts`: `PayloadCodec<T> = (unknown,eventId) => T` validates/normalizes actual payloads;
  `ConfirmedPublisher` derives `publish` directly from YV2-05 `createPublisher`'s return type.
  `createOutbox<Payload>(table,destination,codec)` snapshots the validated qualified table and
  requires a destination in its finite allowlist. `enqueue(tx,{eventId,intentKey,payload})`
  returns true on insert, false for the same persisted intent/payload, and refuses conflicting
  IDs/keys/payloads. IDs and payloads come from the adapter; it generates no replacement UUIDs.
  `relayBatch(pool,publisher,limit=10)` returns `{selected,sent,deferred}`. Due rows lock with
  `FOR UPDATE SKIP LOCKED`, ordered and bounded to 1–25. Codec/confirm failure defers the row
  with capped 250–5000ms exponential backoff and saturating attempt count; pending intent is
  retained, with no automatic terminal deletion. Confirm precedes sent-mark SQL. SQL failure
  rolls back the batch. `startRelay(outbox,pool,publisher,{limit?,onError?})` polls every second
  and returns idempotent `close()` that stops scheduling and drains the admitted bounded batch.
  The caller then closes publisher/pool. `onError` is a synchronous notification, not drain work.
- `receipts.ts`: `createReceipts<Payload,Result>(relation,{payload,result,identity?})` returns
  `withEffect(tx,{scopeKey,eventId,payload},effect: (sameTx,parsedPayload) => Promise<Result>)`.
  New receipt + validated result + SQL effect commit together; repeat returns
  `{applied:false,result}` without rerunning the effect. Conflicting/incomplete receipt refuses.
  Default duplicate identity compares the full validated payload. Optional trusted
  `identity(parsedPayload)` projects stable business fields, allowing regenerated transport
  timestamps to differ without weakening payload validation. Adapters must retain every field
  relevant to the effect in that projection. Outbox intent payloads instead remain immutable.

Generator exports `outboxSchema`, `receiptSchema`, `SqlRelation` and `OutboxTable` through
`src/v2/durability.ts`/`src/index.ts`. Later compiled feature emitters call them from `local`
contributions and explicitly declare YV2-04 migrations, exact runtime logins and schema-qualified
table/view grants. No permission follows from table names or from selecting these libraries.
The foundation remains the sole migration/shared-file writer. Dependency-free
`assets/src/runtime/{local,durable-sql}.ts` are shared directly by the generator and emitted
project so SQL quoting/schema implementation has one source. `local.ts` moved unchanged from
`.ts.template`; SDK-bearing runtime assets remain `.ts.template` and compile in the standalone
package. This adds only generator dev dependency PGlite at the existing workspace pin 0.5.9;
no emitted runtime dependency/version changed.

Broker I/O is **not atomic with SQL**. A crash or commit failure after confirmed publish can
deliver the same stable event ID again; consumers commit their receipt/effect before ack through
YV2-05. This is at least once, with no distributed transaction, reconnect or exactly-once claim.
[Offline/standalone/actual SQL-broker evidence](../evidence/youtube-v2/yv2-06-durability.md).
Next owner: **YV2-07 only**, generic owned-upload persistence/hooks.

## YV2-07 — owned upload persistence and application hooks

`loadLocalV2Registry` registers `local.upload-state`, an implemented **dependency emitter**.
Actual normalized `owned-multipart` selections emit `src/runtime/owned-upload.ts` and
`src/runtime/upload-sql.ts`, with their exact selection pointers. There is no
`provides.templates`/preset, S3 operation, HTTP route, service or installed multipart consumer;
YV2-08 owns that engine. Application/feature/mapping gaps remain required and unfinished.
No v2 field app exists. Runtime assets are captured local-v2 sources; the dependency-free
`upload-sql.ts` is shared directly with the generator, with no mutable v1 reads.

Generator exports from `src/v2/upload-state.ts` / `src/index.ts`:

- `ownedUploadSchema(relation: SqlRelation) -> string`: separately quoted schema/table,
  private schema/public revocation, generic upload table and bounded-sweep indexes. It has
  **no application foreign key, video table, title, channel or implicit runtime grant**.
- `ownedUploadPersistence({resource,host,relation,migrationId,sourcePaths}) -> V2LocalContribution`:
  a trusted compiled recipe's actual migration plus explicit runtime login and schema-qualified
  SELECT/INSERT/UPDATE table grant. The foundation remains sole migration/shared-file writer
  and validates canonical source/store/host/authority/access. This dependency alone contributes
  no migration/login/grant; the consuming recipe binds them with this helper through `local`.
  Application metadata, lifecycle and outbox tables/grants are separate contributions. No DELETE,
  schema CREATE or setup-owner credential is required by the repository.

Emitted `owned-upload.ts` exports `createOwnedUploads<M,R>(binding,hooks) ->
OwnedUploadRepository<M,R>`, plus `UploadBinding`, `UploadPrincipal`, `UploadFile`,
`UploadRecord<M,R>`, `UploadHooks<M,R>`, `VerifiedOriginal`, `UploadState`, `UploadPhase`,
`UploadFailure`, `UploadTerminal`, `BeginUploadCompletion<M,R>` and `UploadCompletion<R>`.

`UploadBinding` is `{schema,table,originalKey({assetId,uploadId,file})}`. The key constructor is
trusted compiled code, never saved-source/client input. Reservation generates new UUID asset
and upload identities on the server every time; no idempotent-start feature is introduced.
UUID lookup inputs normalize to lowercase; principal subjects remain exact case-sensitive text.
Original keys are unique bounded 1024-byte values. `UploadFile` retains fileName, size,
contentType, lastModified and lowercase SHA256; generic bounds preserve 1 byte–256 MiB transport,
safe filename and integer limits. Application validation owns accepted content/metadata, such
as MP4 or PDF; generic SQL does not require a video MIME type.

`UploadRecord` exposes camelCase identities/owner/key/provider ID, file/typed metadata,
createdAt/updatedAt/expiresAt/dbNow, stable completeResponse/originalEtag, failureCode and
cleanupNeeded. Transport `state` is uploading/completed/failed/aborted/expired; `phase` is
initiating/active/completing/closed. These are separate from YV2-09's pending/processing/ready
application lifecycle. PostgreSQL `clock_timestamp()` owns the fixed 24-hour expiry, 1-minute
interrupted-initiation age and all transition times; no client clock extends a resume window.

Every repository operation takes the active branded YV2-06 `Tx`; no private pool or hidden
transaction boundary exists. SQL/codec/hook failures poison that scope even if a caller catches
the rejection. `UploadPrincipal` is `Pick<VerifiedPrincipal,"subject">` for owner lookups and
stored-owner reconciliation. `reserve` receives the full **already verified** principal so its
application validator can use verified claims; identity verification and creator authorization
remain caller responsibilities. No owner, asset ID, provider ID or key is read from client input.

| Repository method (after `tx`) | Actual behavior |
| --- | --- |
| `reserve(principal,input)` | Validates application input/file/metadata, inserts initiating upload, awaits reservation hook; returns durable record. |
| `owned(uploadId,principal,lock=false)` / `recent(principal)` | Exact owner match or null; optional row lock; recent records bounded to 50. Foreign owner gets no record. |
| `saveProvider(uploadId,principal,providerId)` | Locked initiating→active; rejects unknown/conflicting/expired state; retains provider identity durably. |
| `beginComplete(uploadId,principal)` | Locked active/completing→completing; stable replay wins; due uploads expire through the terminal hook. |
| `complete(uploadId,principal,original)` | Locked completing→completed after key/size/SHA/ETag checks; awaits hook, validates/stores response in the same transaction. Returns completed/duplicate with response, or unknown/conflict/expired/mismatch. |
| `close(uploadId,principal,"aborted"\|"expired")` / `fail(uploadId,principal,code)` | Terminal state + cleanup flag + terminal hook commit together; due close prefers expired, early expiry returns not-due. Failure codes are INITIATION_FAILED/UPLOAD_MISMATCH. Closed states refuse new completion. |
| `reopenIncomplete(uploadId,principal)` | Reopens only unexpired uploading/completing to active after incomplete provider inventory. |
| `cleanup()` / `interrupted()` / `clearCleanup(uploadId)` | **Privileged internal sweeper APIs**, not client routes. Up to 50 due/flagged records, or completing/old-initiating records; cleanup flag clears only when closed. No provider deletion is performed. |

`UploadHooks` requires synchronous `validate(input,verifiedPrincipal) -> {file,metadata}`,
`metadata(unknown) -> M`, `response(unknown) -> R`, and awaited
`reserve(tx,upload)`, `complete(tx,upload,verifiedOriginal) -> R`,
`closed(tx,upload,terminal)`. Explicit no-op callbacks support applications needing no additional
SQL effect. Metadata and response must be non-null JSON data; dates/classes/undefined/nonfinite
values refuse. Codecs validate normalized JSON snapshots on write/read and must round-trip
stably. A bad response rolls back the completion effect and intent, not just response storage.
Hook records are detached snapshots. Complete/closed hooks see the **pretransition** upload
under the held row lock and share exactly the caller's Tx, so YV2-09 can commit pending+job
outbox intent or abort/expiry/failure lifecycle changes without forking this core. They must
await SQL effects; network effects are never atomic with SQL. Reservation sees the inserted
initiating record with DB expiry, allowing an adapter to insert its related metadata atomically.

For YouTube, map `upload.assetId` to its existing `videoId` in the narrow adapter; bind
`originals/<assetId>/<uploadId>/source.mp4` through `originalKey`, validate title/description
and verified channel in the application hook, and persist the video/lifecycle relationship in
later recipe SQL. The generic table needs none of those fields or relationships. Completion
hook creates the job/attempt IDs once in the committed transaction and returns the existing
pending HTTP response; replay returns that saved response before any hook or expiry check,
even when the later application lifecycle has progressed.

Provider initiation/completion remain separate network phases. A SQL failure after provider
success leaves initiating/completing state for bounded reconciliation; it must not be silently
reset or represented as atomic. YV2-08 must validate real provider parts/Head metadata against
the durable asset/upload/key/size/SHA identity before constructing `VerifiedOriginal`.
Its SHA is the expected source fingerprint, not proof that Head hashed the bytes. Transport
mismatch returns a finite outcome; its caller chooses the existing terminal failure path.
[Focused offline/standalone evidence and limits](../evidence/youtube-v2/yv2-07-upload-state.md).
Next owner: **YV2-08 only**, generic signed multipart engine and HTTP factory.

## YV2-08 — Owned signed multipart transport and HTTP mounts

`local.multipart` emits `src/runtime/{multipart,multipart-objects,multipart-http}.ts` for an
owned-multipart selection. It contributes that selection's object read/write credential and
signed-PUT CORS through the foundation, which configures the selected HTTP origin and revokes
its temporary storage-owner permission. It creates no SQL login, application service or job
publisher. Use YV2-07's `ownedUploadPersistence` for the bound repository and application SQL.
Do not contribute the same host/resource storage binding a second time in a recipe.

`multipart.ts` exports `createOwnedMultipart<M,R>({repository,transaction,objects})`,
`OwnedMultipart<M,R>`, `UploadTransaction`, `MultipartObjects<M,R>`, `MultipartCursor`,
`UploadPart`, `MultipartError`, `validateParts`, `uploadView`, `PART_SIZE`,
`MAX_UPLOAD_SIZE` and `SIGNED_URL_SECONDS`. `repository` is YV2-07's
`OwnedUploadRepository<M,R>` with its required validation/codecs/reservation/completion/closed
hooks; `transaction` is `<T>((tx: Tx) => Promise<T>) => Promise<T>` using the actual branded
YV2-06 Tx, normally `effect => transaction(pool,effect)`. No second transaction helper exists.

| Engine method | Actual contract |
| --- | --- |
| `start(verifiedPrincipal,input)` | Repository validates content/metadata and reserves server identities; creates provider upload, stores provider ID, returns uploadId/assetId/uploading/partSize/partCount/expiresAt. Initiation failure closes with INITIATION_FAILED and attempts provider abort; unknown outcomes remain reconcilable. No idempotent-start guarantee. |
| `list(principal)` | Up to 50 owner records as uploadId/assetId/metadata/state/createdAt/failureCode summaries. |
| `status(uploadId,principal)` | Checks DB expiry, reconciles completing records, returns public transport snapshot and actual sorted ListParts inventory for active records. Missing active inventory fails with UPLOAD_MISMATCH. |
| `sign(uploadId,principal,partNumber)` | Owned active upload only; integer part number within exact count; returns URL and expiresAt. Never accepts a client key/provider ID. |
| `complete(uploadId,principal)` | Validates actual exact part numbers/count/sizes/ETags, begins durable completing phase, completes provider inventory, checks Head identity/size/declared SHA metadata and nonempty ETag, then calls the repository completion hook in SQL. Stored response replays without a new hook/provider effect. Missing consumed inventory is recoverable only in completing phase; mismatch is terminal. |
| `abort(uploadId,principal)` | Commits terminal callback/state first, aborts known provider upload, clears cleanup flag; aborted/expired completion refuses. Failed provider cleanup retains the flag. |
| `sweep()` | Explicit single-flight bounded reconciliation/cleanup call, no implicit timer. Up to 50 due/flagged records, 50 interrupted records and one <=50-entry orphan inventory page per call. Aborts only recognized namespace keys older than 24 hours. Retains pagination cursor for the next call; failures defer remaining work. Call/await periodically (v1 uses 30 seconds), and await outstanding work before closing clients. |

The public status snapshot has uploadId, assetId, typed metadata, transport state/phase,
file fingerprint, ISO createdAt/expiresAt, failureCode, partSize/partCount and parts. It excludes
owner subject, object key, provider ID and private completion response. It has no application
pending/processing/ready state. YouTube status/list enrichment belongs to YV2-15/16.

`createMultipartObjects<M,R>({control,signing,bucket,prefix,ownsKey,metadata})` in
`multipart-objects.ts` implements the real S3 operations through injected YV2-05 clients.
`metadata` explicitly names four distinct lower-case provider metadata keys:
`{assetId,uploadId,sha256,expectedSize}`. YouTube can bind `assetId:"video-id"` while a document
adapter binds `assetId:"asset-id"`; generic transport imports neither product contract.
`prefix` must be nonempty; `ownsKey(key)` recognizes only the caller's canonical original keys,
and every operation checks both. Orphan ListMultipartUploads scans that prefix only. The caller
owns/destroys both clients and can give signing a different public endpoint. The adapter's
`missing(error)` recognizes NoSuchUpload/NotFound/NoSuchKey; other failures propagate safely.
The injectable `MultipartObjects` interface also permits offline transport probes without an SDK.

Fixed current policy: **5 MiB** parts, **1 byte–256 MiB** files, **900 seconds** per signed URL,
repository DB-clock **24-hour** resume window, **4-second** provider calls, at most three ListParts
pages/52 inventory entries and one 50-entry orphan page per sweep. Resume exposes the original
fileName/size/contentType/lastModified/SHA fingerprint and actual acknowledged parts; the reused
browser must compare its selected file as in v1. No tus or new content/media validation exists.
Head validates identity and the declared source SHA metadata; it does **not** hash provider bytes.
The YV2-11 runner still owns downloaded-byte hash validation before processing. Provider and SQL
are separate effects; uncertain completion retains completing state, and already completed objects
are not deleted by multipart abort/orphan cleanup. No distributed atomicity is claimed.

`createMultipartHttpHandlers<M,R>({multipart,principal,response?,error?})` in
`multipart-http.ts` returns `{handlers,mount}`. `principal(request)` is awaited inside each
admitted handler and must return a verified principal with product authorization applied.
`response` optionally maps each typed operation result plus principal to an awaited application
body; `error(MultipartError)` can bind existing product wording/status through HttpError.
Default public transport refusals use safe HttpError codes with no provider details.
Engine error codes: UPLOAD_NOT_FOUND(404), UPLOAD_CLOSED(410), UPLOAD_CONFLICT/
UPLOAD_MISMATCH/INCOMPLETE_PARTS/PARTS_LIMIT(409), PART_NUMBER(400), INITIATION_FAILED(503).
The HTTP boundary also refuses malformed UUIDs with UPLOAD_ID(400).

`mount(routes: HttpRoutes,mounts)` requires exactly one explicit mount for each operation:
start(POST), list(GET), status(GET), sign(POST), complete(POST), abort(POST). Each mount is
`{operation,method,url,statusCode?}`; identity routes use `:uploadId`, signing also uses
`:partNumber`. Paths have no product defaults. Mount during YV2-05 createHttpService.configure;
all auth, content validation, SQL and provider work is awaited within admission/drain. A separate
product `/me` route and API/browser response compatibility remain YV2-15 responsibilities.

The engine is implemented dependency output, **not yet a completely installed source-bound
ownedMultipart template**: compiled principal/content/metadata/namespace/repository/hooks,
HTTP settings/service constructor and lifecycle/job wiring remain required recipe gaps. The
report retains `multipart-application-bindings` and `applicationComplete:false`; no normal studio
control or lifecycle installation is attested. YV2-09 can bind complete/closed without editing
transport; YV2-16 must install actual consumers once these application bindings exist.
[Offline, standalone and real provider evidence](../evidence/youtube-v2/yv2-08-multipart.md).

## YV2-09 — fixed asset lifecycle and committed publication hooks

`local.asset-lifecycle` is an implemented **dependency emitter** for normalized
`asset-lifecycle` selections. It emits `src/runtime/{asset-sql,asset-lifecycle,asset-worker}.ts`.
It installs no source-bound feature, service, SQL credential, timer or application public view.
Required `asset-lifecycle-application-bindings` and `applicationComplete:false` remain until
YV2-15/16 binds codecs, identities, hooks, persistence, consumer/publisher and service constructors.
There is no YouTube metadata, event namespace, search/count dependency or media-worker SQL access.

Generator exports from `src/v2/asset-lifecycle.ts` / `src/index.ts`:

- `assetLifecycleSchema(SqlRelation)` emits a private generic asset table with uploading/pending/
  processing/ready/failed/aborted/expired state, version CAS, upload/job/attempt UUIDs, JSON metadata/
  result, timestamps and fixed-deadline sweep index. No FK to a particular application is assumed.
- `assetReadySelect(SqlRelation)` defines the authoritative **committed-ready source contract**:
  `asset_id,job_id,attempt_id,state_version,metadata,result,ready_at,publication_version`, filtered
  by `state='ready'`. It creates no view/grant. Metadata can be private: a later compiled adapter
  must select its actual public fields into its public view, not expose this source as an HTTP body.
- `assetLifecyclePersistence({resource,uploadHost,lifecycleHost,relation,receipts,outbox,
  migrationId,sourcePaths})` contributes the asset/receipt/outbox migration and exact runtime logins/
  grants through the existing foundation. Upload gets asset SELECT/INSERT/UPDATE and outbox
  SELECT/INSERT/UPDATE; lifecycle gets asset SELECT/UPDATE, receipt SELECT/INSERT/UPDATE and outbox
  SELECT/INSERT/UPDATE. Same-host bindings merge safely. Canonical store/access/authority validation
  remains in the foundation. No media/reader login or implicit public projection is contributed.
  Bind YV2-07 `ownedUploadPersistence` separately; YV2-08 already contributes selected object/CORS
  access, so do not duplicate that storage contribution.

`asset-lifecycle.ts` exports `createAssetLifecycle<M,R,Response,Job,Publication=never>`,
`AssetLifecycleBinding`, `AssetLifecycleHooks`, `AssetJobIdentity`, `AssetCompletion`,
`AssetEvent<R>`, `ProcessingKind`, `AssetState`, `AssetOutcome`, `AssetRecord<M,R>`,
`CommittedReadyAsset<M,R>`, `assetUuid` and `assetEventId`.

Binding is `{relation,receipts,receiptScope,outbox,jobsDestination,identities}`. Identities are
trusted compiled `request(job)`, `result(job,kind)` and optional `publication(assetId)` constructors.
`assetUuid` normalizes domain UUIDs before keys; generic durable text/event IDs remain exact and
case-sensitive. `assetEventId(namespace,...parts)` is an optional stable hashed UUID constructor,
with an explicit namespace and no product default. Later event adapters can bind existing v1 IDs.

Hooks require `metadata`, `event`, `result`, `failure`, `job:{codec,construct}` and `response`.
`event(rawWire)` validates/maps the application's finite envelope to `AssetEvent<unknown>`:
asset/job/attempt IDs, eventId, occurredAt and kind started/succeeded/failed (result or failure code).
Core checks IDs and transport messageId, validates result with the normalized job identity, and
limits JSON to 64 KiB. Result/metadata codecs must be stable non-null JSON snapshots; the result
codec owns its finite fields and job-bound paths. Failure codec accepts bounded application labels;
it adds no states or retry policy. Optional `failed(tx,asset)` runs after an actual job failure,
including fixed deadlines; upload terminal callbacks do not invoke it. Optional `publication:{destination,codec,construct}` decides the
application's ready/public projection. Both constructors and failure hooks are SQL-only, awaited
on the caller's branded YV2-06 Tx; caught failures still poison rollback.

| Returned API | Contract |
| --- | --- |
| `uploadHooks.reserve(tx,upload)` | Insert uploading metadata in the upload reservation transaction. |
| `uploadHooks.complete(tx,upload,verifiedOriginal)` | Under the upload row lock, lock related asset; generate job/attempt once, CAS uploading→pending, set DB queue deadline, await job constructor, enqueue one job intent and return `response(AssetCompletion)`. YV2-07 validates/stores this stable response; replay bypasses hooks even after lifecycle progresses. |
| `uploadHooks.closed(tx,upload,terminal)` | CAS uploading→aborted/expired/failed with upload terminal state in the same Tx. Initiation/fingerprint failure codes synchronize here without editing upload core. |
| `parse(rawWire,messageId?)` | Validate/map the wire event. Original wire must be retained for `apply`, not replaced by this normalized result. |
| `apply(tx,rawWire,messageId?)` | Existing receipt-with-effect returns `{applied,result:{outcome}}`; records unknown/stale/terminal outcomes, checks DB deadline before effect, rejects unrelated job/attempt and terminal transitions. Matching success accepts pending or processing. Ready/result/version + optional publication intent + receipt commit together. |
| `get(tx,assetId)` | Internal typed lifecycle record; no owner/public authorization is implied. Application status enrichment owns those boundaries. |
| `sweep(tx)` | Fail at most 50 overdue pending/processing rows, ordered and locked with SKIP LOCKED. No upload/provider cleanup or hidden scheduling. |
| `jobs` / optional `publications` | Actual YV2-06 outbox bindings for the application's confirmed relay. |

Queue deadline remains **10 minutes**, processing deadline **30 minutes**, using PostgreSQL
`clock_timestamp()`, enforced by `apply` even before any sweep. First start changes pending to
processing; a repeated start never changes an already processing deadline. There is one job/
attempt, no retry/reprocessing workflow. Receipt identity retains all validated effect fields and
omits **only** occurredAt, allowing regenerated transport timestamps; a changed result/failure/
asset/job/attempt conflicts. Ready never publishes from failed/stale/late/terminal results.
`CommittedReadyAsset` is the transaction-bound publication constructor input; it is durable only
after commit, and contains state/version, metadata/result, normalized job identity, readyAt and
publicationVersion1. Constructor code can read ready on the same Tx; a throw rolls back ready,
intent and receipt together. Optional publication can be absent for an attachment composition.
Broker effects remain at least once through the existing outbox, not SQL/network atomicity.

`asset-worker.ts` exports `startAssetLifecycleWorker<Publication>`, `LifecycleConsumer`,
`LifecyclePublisher` and `LifecycleWorkerRepository`. Bind the actual YV2-05 consumer with
`openConsumer(handle)` and optional `{outbox,openPublisher}`. It sweeps before admission, validates
bounded JSON/message identity (malformed messages use `NonRetryable`), awaits transaction commit
before handler resolution, and schedules one single-flight sweep every **30 seconds**. It starts
and drains the existing optional publication relay. `close()` is idempotent, stops the timer,
drains the consumer and sweep, then attempts relay/publisher close even if another close fails;
`closed` reports fatal transport/teardown failure. The worker owns opened transports; the caller
owns/ends its SQL pool. No service starts until a later compiled recipe calls this factory.
[Focused offline, standalone and regression evidence](../evidence/youtube-v2/yv2-09-lifecycle.md).
Next owner: **YV2-10 only**, reusable fixed video-to-HLS engine.

## YV2-10 — fixed reusable video-to-HLS engine

`loadLocalV2Registry()` now registers dependency emitters `local.video-hls` and
`local.asset-identity`. A selected `video-hls` emits **`src/runtime/media-process.ts`,
`video-result.ts`, `video-hls.ts` and `asset-identity.ts`**. The single identity writer also serves
`asset-lifecycle`; existing `assetUuid` and `AssetJobIdentity` imports from `asset-lifecycle.ts`
remain valid reexports. The extracted identity module imports no SQL/SDK/transport code.
`assetEventId`, lifecycle hooks and all YV2-09 behavior remain unchanged. Engine-only output needs
no lifecycle/Postgres/search/count module or application domain contract.

`video-result.ts` exports strict Zod codecs `videoSourceFingerprint`, `videoHlsJob`,
`videoHlsResult`, `videoCompletionMarker`, their `VideoSourceFingerprint`, `VideoHlsJob`,
`VideoHlsResult`, `VideoCompletionMarker` types, plus `videoContentType`, `bindVideoResult` and
`bindVideoMarker`. Job shape is the existing **`AssetJobIdentity`** (`assetId/jobId/attemptId`,
normalized by the existing `assetUuid`) plus **`source:{key,size,sha256}`** and **`resultPrefix`**.
The source is structurally compatible with the fingerprint portion of YV2-07's
`VerifiedOriginal`; ETag is not a byte checksum. Source size is 1–268435456, lowercase SHA256;
source/result keys are bounded relative ASCII object keys with no empty/dot/traversal segments.
The immutable result prefix is explicit, relative, at most150 characters and ends in `/`.
The trusted job adapter **must derive/check that prefix against its authoritative job namespace**;
core does not invent a product path convention. `bindVideoMarker(raw,job)` checks all three IDs,
all source fingerprint fields and the exact result prefix. `bindVideoResult(raw,resultPrefix)`
is available to application/lifecycle result codecs with that same authoritative binding.

`encodeVideoHls({input,output,job,signal}:VideoHlsInput):Promise<VideoCompletionMarker>` from
`video-hls.ts` accepts **absolute local paths**. Caller supplies a previously downloaded/hash-
verified regular input; the engine checks actual byte size, then probes the source. Hashing the
original download belongs to **YV2-11**, not a new assertion about storage metadata. The engine
creates **a fresh output directory exclusively**; the caller creates only its parent workspace.
Existing output directories/files are refused without modification. On any failure after mkdir,
the engine waits for subprocess close and removes its newly created output; it never removes
caller input. **The runner must unconditionally finally remove the entire execution workspace,
including input and successful output, after consuming/uploading the returned package.**

Fixed behavior: one H.264 and one AAC stream in MP4; even landscape720–1080p, width≤1920,
no nonzero rotation, duration1–600s. Encodes sequential 640×360/1000k and 1280×720/3000k
libx264 veryfast/yuv420p, two encoding threads,128k stereo48kHz AAC, four-second VOD MPEG-TS
segments with closed independent GOPs; aspect preserved with padding. Thumbnail is a single
full-source-size MJPEG frame at0.5s, one thread. Both encoded streams/dimensions/duration and
thumbnail codec/dimensions are independently ffprobed before packaging. No editor knobs.

`media-process.ts` exports `InvalidMedia` (`code:"INVALID_MEDIA"`), `MediaProbe`,
`validateVideoOriginal`, `probeMedia`, `localMediaPath` and `runMedia`. Subprocesses use argv,
`no shell`, no stdin, a local file/crypto/data protocol allowlist,1MiB stdout bound,4KiB retained
stderr tail,30s probe/20m FFmpeg timeouts, and TERM→KILL after1s on abort. Close is awaited;
abort reason is preserved and a timeout cannot resolve as success. The whole encode/package
operation also has one20m AbortSignal deadline. Missing executable/OS runtime is not installed
by emitting these files; later composition must supply the exact retained FFmpeg pin.

`videoPlaylistReferences(playlist,names)` and
`packageVideoHls(output,job,duration,signal)` expose the finite local packaging checks for reuse.
Only360/720/index.m3u8, segmentNNNNN.ts, thumbnail.jpg and generated master.m3u8 are accepted;
each VOD rendition has1–160 unique local segment references, no extra files or URI tags.
Packaging requires a fresh three-entry encoded root, writes master exclusively, checks regular
nonempty bounded files and streams their actual byte hashes into the marker inventory. Marker
has required master/thumbnail/both playlists/segments, unique paths and exact content types.
It returns a marker object; **it does not write `_complete.json` or publish any object**.

`video-hls-worker-bindings` remains a required gap; no `provides.templates` attestation, runnable
service, FFmpeg install/image stage or normal configuration control was added. **YV2-11** owns
bounded object download/hash verification, immutable existing-marker/inventory validation/reuse,
segment→playlist→master→marker upload ordering, confirmed result callbacks, concurrency1 and
workspace cleanup. **YV2-15/16** own product event/path adapters, actual source-bound compiled
recipe and pinned service/image wiring; non-video builds must continue without FFmpeg.
[Real pinned-media, standalone and regression evidence](../evidence/youtube-v2/yv2-10-video-engine.md).

## YV2-11 — storage-backed media worker runner

`local.media-worker` is an implemented **dependency emitter** for normalized `video-hls`
selections. It emits `src/runtime/{media-worker,media-objects}.ts`, using the YV2-05 delivery/
AMQP clients and YV2-10 fixed engine/result/identity modules. Its explicit `local` contribution
adds selected originals read and outputs read/write storage bindings and the consuming jobs
queue to the foundation. The foundation still validates actual normalized authority/access,
creates scoped storage keys and durable queue/failed topology, and remains the sole shared-file
writer. Selected results exchange topology comes from the normalized publish channel; a later
lifecycle consumer contributes its subscriber queue. No SQL login, mount, service, image change,
source-template attestation or normal control is added. Do not duplicate these media storage
bindings in a later recipe. Required `video-hls-worker-bindings` remains until YV2-15/16 supplies
the compiled application/queue/runtime/service bindings; `applicationComplete:false` is honest.

`startMediaWorker<J,R>({codecs,objects,openPublisher,openConsumer,engine?,tempRoot?,onFatal?})`
returns `{close,closed}`. `engine` defaults to the actual `encodeVideoHls`; an injected trusted
engine must keep the same `VideoHlsInput -> VideoCompletionMarker` contract. This permits
existing/offline composition without installing another processing preset. `tempRoot` defaults
to the OS temporary directory; it must be an existing absolute local directory. The factory
owns its objects and opened transports. It opens the publisher before its consumer, requires
consumer **concurrency:1**, and gives every valid delivery one **20-minute** execution deadline.
Only one configured worker may serialize an immutable namespace; no distributed lock is added.

`MediaCodecs<J,R>` has the following required application boundaries:

- `job(rawWire,messageId):J` validates the actual job envelope and its transport identity.
  The runner bounds JSON to **64 KiB**, requires a nonempty bounded message ID and maps any
  decode/binding error to `NonRetryable("MALFORMED_MESSAGE")`. It never feeds a normalized job
  back to the application's wire codec; terminal handling re-decodes the **original** body.
- `video(job):VideoHlsJob` derives/checks authoritative original key and result prefix. The runner
  then applies the existing strict `videoHlsJob` codec. No product source/result namespace is
  assumed. Identity/source/prefix must describe the actual committed job, not client paths.
- `result(rawVideoResult,job):R` validates/maps the bound engine result for this application.
  The runner validates the fixed result/prefix before calling it.
- `eventId(job,kind):string` constructs the stable logical started/succeeded/failed identity,
  independent of retry/timestamp. `event(job,{kind,eventId,occurredAt,result?|code?}):unknown`
  constructs **and validates** the actual application wire. The runner bounds serialized JSON
  to64 KiB and awaits `MediaPublisher.publish(body,eventId)` broker confirmation. The trusted
  application codec owns the correspondence between its wire fields and the supplied job/event.

`MediaEvent<R>` is started, succeeded with result, or failed with **INVALID_MEDIA** or
**PROCESSING_FAILED** only. `MediaPublisher` is confirmed `publish` plus `close/closed`;
`MediaTransport` is `close/closed`. Bind `openPublisher(hooks)` and
`openConsumer({handle,onTerminal,onFatal,concurrency:1})` to the actual YV2-05 factories,
including explicit queue, failedQueue and bounded retryLimit. `onFatal` is notification-only;
it must be wired so loss cancels an in-progress encoder immediately, before transport drain
completes. A malformed job emits no invented application failure. Invalid media is nonretryable;
other failures use the existing bounded delivery retries, then a confirmed finite failure before
confirmed failed-queue publication/ack. No SQL/outbox transaction is performed by this runner.

`downloadMediaSource(objects,job,file,signal)` requires provider ContentLength to match and
streams into an exclusively created local file, rejecting overflow/truncation and checking
**actual source-byte SHA256**, not just declared metadata. The workspace alone is created with
`mkdtemp`; engine output creation stays exclusive. A `finally` always removes the entire
workspace, including source and successful/partial output, after upload/confirmation or failure.

`reuseMediaMarker(objects,job,signal)` first reads the bounded marker and applies the strict
`bindVideoMarker`: all asset/job/attempt IDs, every source fingerprint field and result prefix.
It then Heads every inventory entry and checks actual **size, content type and SHA metadata**.
This metadata check is not an independent hash of remote output bytes. A valid duplicate emits
the same logical success with no source read, encode, local workspace or object rewrite.
An invalid existing marker/inventory fails rather than silently overwriting completed output.
Without a complete marker, partial output may be rewritten under the single-worker policy.
`mediaUploadRank(path)` orders segments → rendition playlists → thumbnail → master; final
`_complete.json` comes last. Marker plus entire remote inventory is re-read/checked before
confirmed success. This is neither multi-object atomic publication nor a stronger ACL boundary.
Remote partial/orphan cleanup remains outside this unit.

`MediaObjects` is the narrow source/marker/head/put/complete/close interface.
`createMediaObjects({source,results,sha256Metadata})` supplies its actual S3 implementation:
source/results each require `{client,bucket,owns(job)}`. The trusted `owns` callbacks check their
complete authoritative namespaces on every operation; no bucket/key/prefix defaults exist.
SHA metadata name is explicit and lower-case. Marker Get requires JSON, nonzero exact length
≤256 KiB and a bounded stream; missing404 alone means absent. Put streams local regular files
with exact ContentLength/type/SHA metadata. Playlists cache60s; segments/thumbnail/marker use
immutable one-year caching, preserving v1 policy. Both injected clients are destroyed (once if
shared), attempting each even if another close fails. There is no List/Delete/SQL operation.

`close()` is idempotent: normal shutdown cancels consumer admission and drains bounded work,
then attempts publisher and object-client close even after an earlier close rejection. Fatal
notification aborts ongoing execution and schedules close without awaiting its own delivery.
`closed` reports `{fatal}` including transport/startup/teardown failures. No process signal or
readiness file is installed by emitting this library. **YV2-16 must verify the pinned FFmpeg/
ffprobe runtime before marking a process ready**, install the exact image/service, bind actual
codecs/publishers/consumer retry policy, and wire process signals to the owned close lifecycle.
Non-video apps still require no FFmpeg. [Real provider and regression evidence](../evidence/youtube-v2/yv2-11-media-worker.md).

## YV2-12 — immutable positive-cache read dependency

`createLocalPositiveCache(sourcePaths)` in `jeeves-generator/src/v2/positive-cache.ts`, registered
as **`local.positive-cache`**, emits only for selected `positive-cache-read` responsibilities:

- `src/runtime/positive-cache.ts`: `PositiveCache`, `PositiveReadAdapter<I,R>`,
  `createPositiveReader<I,R>({adapter,ttlSeconds,cache?})` → `(input:I)=>Promise<R|null>`.
- `src/runtime/valkey.ts`: `ValkeyBinding`,
  `createValkeyCache({binding,credential?})` → `Promise<PositiveCache & {close():void}>`.
- `src/features/positive-cache-bindings.ts`: `positiveCacheBindings[selectionId]` with exact
  normalized `{host,source:{resource},cache:{resource,hostname,port,secret},ttlSeconds}`. Cache
  hostname/secret match the foundation's `cache-<canonical-resource>` service/credential; port6379
  is internal. No copied runtime password appears in source. The caller passes this cache binding
  to `createValkeyCache` and its TTL to `createPositiveReader`.

**The cache tile `ttlSeconds` remains the sole TTL authority.** The existing resolver still
requires the traced `cache-reader.l2TtlSeconds` mirror, if present, to agree; conflict refuses
before rendering. The reader has no TTL default or independent normal setting. Fresh exports
with a renamed host/source/cache and TTL7200 compile and execute through this exact binding.
No new editor control, algorithm/policy selection or provider pin was introduced.

`PositiveReadAdapter` supplies `key(input)`, `codec.parse(unknown)`,
`eligible(record,input)`, authoritative `load(input):Promise<unknown|null>` and optional
`expiresAt(record):number|null` (absolute UTC milliseconds). The adapter owns canonical input,
immutable eligibility, complete public-record shape and **requested identity binding** on both
cache and loader output. Its key must include every input affecting loader or eligibility
semantics: same-key requests share one result. Schema validation does not authenticate cache
contents; a trusted isolated namespace remains an application/runtime assumption. Never pass
private status, not-ready state or mutable totals as eligible records.

The core coalesces the entire read/fill per key within one reader instance; it removes the
promise after success, absence or failure and retains no L1 value. A valid eligible hit avoids
the primary. Corrupt JSON/codec, wrong identity, ineligible/expired hit or failed cache falls
back once to the authoritative loader. Null/ineligible primary results return null without
writing; malformed primary data and primary errors propagate. This is not negative caching.
An expired cached record triggers primary reload; an expired loaded record returns null.
The application owns distinguishing expired/not-ready/unknown HTTP outcomes.

Every cache read/fill phase is capped at150ms. A stalled phase disables cache use in that
reader, preventing repeated requests from accumulating hung injected cache calls. Ordinary
fill errors preserve a successful primary read. The real Valkey client independently bounds
commands at150ms and startup at500ms, destroys its connection on failure/deadline, has queue32,
`disableOfflineQueue:true` and `reconnectStrategy:false`. Connection failure returns an
unavailable optional cache, allowing primary fallback. `close()` is idempotent and destroys
the socket; later service constructors must own that close. Endpoint and credential come
from the explicit normalized binding, never labels or a hardcoded cache service.

Fills atomically `SET` value with absolute `PXAT=min(fill wall-clock+ttlSeconds*1000,
record-expiry)`; omit the second limit for null/no expiry. No upward rounding is performed.
Skip writes when remaining life is below1000ms, while returning a still-live record. Recheck
record expiry after optional fill, including failed fill, so expiry crossed during fill
returns null. This does not provide synchronized clocks, propagated total/primary budgets,
global primary admission, expired410 tombstones, HTTP response policy or the complete strict
TinyURL Resolve contract. Injected cache adapters own cancellation/late completion; the real
client destroys its socket, and delayed writes cannot extend the absolute expiry.

Generator export **`positiveCacheReadAccess({resource,host,view:{schema,name},sourcePaths})`**
returns a narrow YV2-04 contribution: exact SQL runtime login plus SELECT on that trusted
explicit view, with no private-table grant, migration or product SQL. The owning recipe must
separately contribute the actual view definition. Foundation permission/boundary validation
still applies, including explicit declared published reads; a role/view label confers nothing.
Default emission contributes no SQL login or view. Existing foundation service `cache:[resource]`
wiring mounts the exact cache secret once the later real service exists.

No `provides.templates` is claimed: required gap **`positive-cache-application-bindings`**
retains actual loader/codec/key/eligibility, ready-only public view/login and service construction.
YV2-15/16 own the actual public-video projection and Watch constructor, including using the
emitted TTL/client and reading totals separately. No YouTube adapter, SQL view, HTTP route,
mutable invalidation, L1, negative/HTTP caching or standalone application is installed here.
[Focused/export/regression evidence](../evidence/youtube-v2/yv2-12-positive-cache.md).

## YV2-13 — receipt-based event counts

`createLocalEventCounter(sourcePaths)` in `jeeves-generator/src/v2/event-counter.ts`, registered
as **`local.event-counter`**, emits selected `event-counter` dependencies:

- `src/runtime/counter-sql.ts`: `CounterTables {receipts:SqlRelation,totals:SqlRelation}`,
  `validateCounterTables`, `counterSchema(tables,publicView)` and `counterTotalsSelect(tables)`.
  Uses the existing YV2-06 receipt schema; totals are `{aggregate_key:text,total:bigint>=0}`.
  Schema SQL creates private tables and the explicitly named public schema; the foundation
  creates the contributed view selecting **only aggregate_key,total**. Private/view identities
  must differ; all SQL identifiers use the existing strict quoted relation boundary.
- `src/runtime/event-counter.ts`: `CounterAdapter<Event>`, `CounterEvent`,
  `createEventCounter<Event>(tables,adapter)` → `{parse,record}` and
  `createTotalReader<Input>({pool,view,key})` → `(input)=>Promise<string>`.
- `src/runtime/counter-worker.ts`: `CounterConsumer` and
  `startCounterWorker({pool,counter,openConsumer})` → `Promise<{close,closed}>`.

`CounterAdapter` supplies `event(rawWire,messageId?)`, `aggregateKey(event)`, `eventId(event)`
and required `identity(event)`. **The caller qualifies the event** before publication; the core
knows no video readiness, page session, playback time, score/amount or analytics policy. The wire
codec runs once. `parse` snapshots a JSON-compatible internal `CounterEvent` containing the
validated aggregate key, event ID and stable semantic identity. Receipt revalidation uses this
separate internal envelope, never the application's wire codec on an already normalized event.
Adapter identity includes every meaningful event field and excludes regenerated transport times
unused by the effect (e.g. acceptedAt/occurredAt). The receipt identity always also includes the
aggregate and event IDs. Conflicting stable identity refuses through the existing receipt helper.

Generic YV2-06 text identities remain **case-sensitive**, bounded1–512 and control-free; there
is no UUID/video normalization in the core. When supplied, the transport message ID must exactly
match the derived event ID, even if a wire adapter forgets that check. **YV2-15 must canonicalize
video UUIDs before constructing text aggregate/receipt keys and canonical transport IDs**. This
preserves SQL UUID identity semantics while leaving unrelated case-sensitive keys unchanged.

`record(tx,event)` accepts the parsed internal event, calls YV2-06 `createReceipts.withEffect`
and adds exactly one with a SQL upsert in that **same active transaction**. It returns `true`
for a newly applied receipt and `false` for a duplicate. Deduplication is **per aggregate+event**,
preserving v1's `(video_id,event_id)` scope; the same event ID may count in another aggregate.
There is no arbitrary increment amount or second transaction/durability implementation. The
caller awaits YV2-06 `transaction` commit before returning to the delivery runner for ack.

The worker requires a message ID and JSON body≤64KiB. Malformed envelopes/identity/codecs become
existing `NonRetryable("MALFORMED_MESSAGE")`; other failures use the actual YV2-05 consumer's
bounded retries and confirmed failed queue. Bind `openConsumer(handle)` to `createConsumer`
with explicit broker, queue, failedQueue, concurrency and retryLimit. The factory owns that
opened consumer and exposes its `closed` result; `close()` calls its drain once and is idempotent.
The **caller owns the pool**, ending it only after worker close. Failed consumer startup cleanup,
fatal notification, terminal handling and cancellation/drain remain YV2-05 responsibilities;
no separate retry loop, reconnect or process signal/readiness implementation is installed.

`createTotalReader` uses only the explicitly bound view and read pool, validates the adapter's
canonical key, returns the current bigint as a decimal string or `"0"` when absent, and retains
no cache. The public reader needs **no private table credential**. Mutable totals remain outside
the positive metadata cache.

Exported generator helpers (also from generator `src/index.ts`):

- `eventCounterPersistence({resource,writerHost,tables,publicView,migrationId,sourcePaths})`
  contributes one ordered migration, the actual narrow totals view, exact writer login and
  SELECT/INSERT/UPDATE on the two private tables. No owner credential or DELETE grant.
- `eventCounterReadAccess({resource,host,publicView,sourcePaths})` contributes only an exact
  runtime login and SELECT on that explicitly contributed view. It invents no view or permission.
- `counterSchema`, `counterTotalsSelect`, `CounterTables` reuse the emitted SQL implementation.

The dependency emitter contributes the **actual normalized event consuming host/resource** to
foundation broker topology, including the topic subscriber and failed queue. Explicit compiled
recipes contribute persistence/read helpers; default dependency emission grants no SQL access.
Foundation ownership, published-read, resource/login and view validation remain authoritative;
private/public names are internal recipe bindings, never normal editor fields. No service or
`provides.templates` attestation is installed. Required gap **`event-counter-application-bindings`**
remains until YV2-15/16 binds the real ViewPlayed/Watch qualifier and canonical IDs, tables/public
view, runtime constructors/credentials, retry/drain/signals and source-bound complete service.
[Focused/standalone/real-provider evidence](../evidence/youtube-v2/yv2-13-event-counter.md).

## YV2-14 — public search projection and bounded query

`createLocalSearch(sourcePaths)` in `jeeves-generator/src/v2/search.ts`, registered as
**`local.search-projection-query`**, emits dependency modules for selected `search-projection`
and/or `search-query` responsibilities. All are source-fingerprinted standalone files:

- `src/runtime/search-contract.ts`: `SearchField`, `SearchMapping<Document>`, `SearchIndex`,
  `SearchDocument<Document>`, `defineSearchDocument({mapping,codec,id,version})`,
  `validateSearchMapping`, `validateSearchIndex`, `searchIdentity`, `searchVersion`.
- `src/runtime/search-schema.ts`: `assertSearchIndex(client,binding)`.
- `src/runtime/search-projection.ts`: `SearchProjectionEvent<Document>` and
  `createSearchProjection<Event,Document>({client,binding,document,adapter})` → `{parse,upsert}`.
- `src/runtime/search-indexer.ts`: `SearchConsumer` and
  `startSearchIndexer({projection,openConsumer})` → `Promise<{close,closed}>`.
  Projection/indexer files require a selected projection; query-only output omits them.
- `src/runtime/search-query.ts`: `SearchInput`, `SearchQueryPreset`, `parseSearchInput(raw)` and
  `createSearchQuery({client,binding,document,preset})` → `(raw)=>Promise<{input,pageSize:20,
  total,documents}>`. HTTP paths/URLs and exact browser response mapping remain YV2-15.
- `src/features/search-bindings.ts`: `searchBindings[selectionId]` with exact normalized host,
  `index:{resource,endpoint}` and, for a projection, `events:{resource,exchange,queue,failedQueue}`.
  Endpoint is the foundation service `http://search-<resource>:9200`; topic queue is exactly
  `<resource>--<host>` and its `.failed` queue, matching the foundation broker contribution.
  Caller passes that endpoint plus explicit request timeout to existing `createSearch` and
  binds actual broker/concurrency/retry settings to existing YV2-05 `createConsumer`.

`SearchMapping` is a **trusted compiled descriptor**, not saved source or an editor schema.
Every document property has an explicit supported scalar mapping; typed mappings cover every
key. The document factory checks the complete field set both before and after the codec,
validates the derived ID/version and snapshots JSON. Codecs must validate values and eligibility;
private/extra fields cannot be silently stripped into an accepted document. Generic IDs remain
case-sensitive nonempty/control-free UTF-8 strings ≤512 bytes; versions are positive safe
integers. No `videoId`, channel, YouTube namespace, SQL loader or product eligibility exists in
these runtime modules. Typed catalog documents use the same exported factories.

`adapter.event(rawWire,messageId?)`, `eventId(event)` and `document(event)` decode raw wire once
and select only public data. Supplied transport IDs must also exactly match the derived event
ID, regardless of the adapter's own checks. `parse` returns the distinct internal
`{eventId,id,version,document}` envelope. `upsert` revalidates that envelope/document and checks
its derived ID/version; it never passes normalized data back to the application wire decoder.
Writes use the explicitly bound index, ID, positive document version, `external_gte` and `3s`
OpenSearch timeout. Repeated same-version events retain one document at that external version.
As in v1, equal-version writes may replace contents and stale-version conflicts propagate;
this is versioned repeat-safe upsert, not an additional event-receipt/conflict policy.

`assertSearchIndex` creates only an absent index, with **one shard/no replicas**, `dynamic:strict`,
`_meta:{version}` and exact properties. Existing mapping version/properties, analyzers/subfields/
indexing changes, disabled source/mapping and dynamic templates refuse, as do incompatible
shard/replica settings. No delete, reset or putMapping repair occurs, even on an empty incompatible
index. It agrees with YV2-04's actual `search-init.mjs`. Generator helper
**`searchProjectionMapping({resource,mapping,sourcePaths})`**, exported from generator
`src/index.ts`, contributes those same validated version/properties through `V2Emitter.local`.
Default dependency emission contributes no product mapping; the foundation still reports its
required missing-mapping gap until a compiled recipe supplies one. No provider/pin changed.

The indexer requires a message ID and JSON body ≤64KiB. Bad wire/document/identity becomes
YV2-05 `NonRetryable("MALFORMED_MESSAGE")`; index errors use that consumer's existing finite
retry/confirmed-failed behavior. Successful upsert completes before ack. The factory owns the
opened consumer and drains once; **caller owns the search client** and closes it afterward.
Caller asserts mapping/settings before admission. No SQL credential/mount, private metadata
read, separate retry loop, readiness file or process signals are added by this library.
Producers must commit eligible public metadata and outbox intent together before relay.

The query factory accepts only raw `{q:string,page?:string}`. It trims q, requires1–200 chars,
defaults page1, accepts the existing nonzero-decimal syntax and bounds page1–100. It fixes
`from=(page-1)*20`, size20, `track_total_hits:true`, timeout750ms. Only the trusted compiled
preset supplies query/sort, never HTTP/saved-source DSL. Results reject timeout/shard failure,
nonexact/invalid totals, oversized hit windows, invalid public documents and `_id` mismatch.
They return validated documents without media URL or browser response policy.

When `youtube-search` is selected, separate feature files are emitted:

- `src/features/public-video.ts`: `publicVideoRecord`, `PublicVideoRecord`,
  `publicVideoDocumentSchema`, `PublicVideoDocument`, `publicVideoMapping`, `publicVideoDocument`.
  The strict reusable record has **videoId(UUID),publicationVersion(literal1),title(1–200),
  description(≤5000),channel(1–200),durationSeconds(finite1–600),manifest/thumbnail(nonempty≤250),
  publishedAt(ISO timestamp)**. Document adds only `state:"ready"`, `visibility:"public"`.
  Mapping version1 matches the v1 fields/types; manifest/thumbnail are unindexed keywords.
  It rejects pending/private status and creator/original/upload/job/private extra fields.
- `src/features/public-video-search.ts`: reexports that shared schema and provides
  `publicVideoQueryPreset`. It preserves ready/public term filters, `multi_match` best_fields
  **title^3,description,channel^2**, default matching (no added AND/prefix), and sorts
  score desc/publishedAt desc/videoId asc. No relevance/filter/paging/sort choice is exposed.

**YV2-15 should reuse this record/schema rather than duplicate validators.** Generic lifecycle
`assetId` maps to this feature's `videoId` at the application adapter. The UUID schema does not
canonicalize case; YV2-15 must normalize document/event/transport UUID identities consistently.
The feature intentionally does not authenticate paths/namespaces or define `VideoPublished`
wire identity: YV2-15 must bind actual asset/job/attempt paths and public-media URL mapping,
validate the wire envelope, and project its committed public fields. Manifest/thumbnail string
validation alone is not proof of ownership. Watch can reuse the public record through its own
emitter without requiring a search consumer; these files currently emit on `youtube-search`.

No `provides.templates` attestation or complete service is installed. Required gap
**`search-application-bindings`** remains until YV2-15/16 installs the actual publication wire
codec/projection, source-bound mapping/preset, Search HTTP mapping, client/consumer construction,
readiness and signals. Actual mappings/services are compiled recipe contributions, never user
mapping/weight/version/internal-ID fields. No broad Marketplace schema/search, prefix matching,
recommendations or private database access was added.
[Focused/standalone/committed-event evidence](../evidence/youtube-v2/yv2-14-search.md).

## YV2-15 — YouTube contracts and browser API adapters

`createLocalYouTubeAdapters(sourcePaths)` (`src/v2/youtube.ts`, registered by the local-v2
registry) emits **contract libraries only**. It has no `provides.templates`/preset attestation,
service, implicit login/grant or normal editor control. `youtube-service-composition` and prior
application-binding gaps remain required. The full fixture emits 80 files deterministically;
YV2-16 must install the actual compiled resource/service recipe before claiming support.

Actual output/API (all production backend, with explicit `local.youtube-adapters` ownership):

| Path under `src/` | Exported interface and responsibility |
| --- | --- |
| `features/video-paths.ts` | `videoUuid`, `originalKey`, `originalIdentity`, `resultPrefix`, `publicPaths`; canonical lowercase UUIDs and exact original/result namespaces |
| `features/public-video.ts` | Existing `publicVideoRecord`, `PublicVideoRecord`, `publicVideoDocumentSchema`, `PublicVideoDocument`, `publicVideoMapping`, `publicVideoDocument`, now shared by all selected YouTube adapters |
| `features/public-video-search.ts` | Existing unchanged finite `publicVideoQueryPreset` and public-schema reexports; emitted for `youtube-search` |
| `adapters/youtube-contract.ts` | `creator`, `videoMetadata`/`VideoMetadata`, `newUpload`, `completionResponse`/`CompletionResponse`, `viewPlayed`/`ViewPlayed`, `videoPublished`/`VideoPublished`, `publishedCodec`, `wireEvent`, `logicalEventId`, `publicationEventId`, `failure`, `failureMessages`, `sha256`, `timestamp` |
| `adapters/youtube-events.ts` | `processingRequested`/`ProcessingRequested`, `requestedCodec`, `processingEvent`, `videoEventIdentities`, `youtubeMediaCodecs`; publication codec/type and stable-ID reexports |
| `adapters/youtube-lifecycle.ts` | `createYouTubeLifecycle({binding,publicationDestination})`, `YouTubeLifecycle`; delegates to actual `createAssetLifecycle`, binds metadata/result/event/job/completion/publication codecs and stable IDs |
| `adapters/youtube-upload.ts` | `creatorIdentity`, `createCreatorPrincipal(verify)`, `validateYouTubeUpload`, `createYouTubeUpload({binding,lifecycle,transaction,objects})`, `YouTubeMultipart`, `mountYouTubeUpload(routes,{multipart,lifecycle,transaction,principal})` |
| `adapters/youtube-objects.ts` | `createYouTubeMultipartObjects({control,signing,bucket})`; existing S3 factory with explicit original namespace and `video-id`, `upload-id`, `sha256`, `expected-size` metadata names |
| `adapters/youtube-public-sql.ts` | `youtubeReadySelect(assets)`, `youtubeReadyView(assets,view)`; actual SQL over `assetReadySelect`, trusted `SqlRelation` inputs only; also exported from generator `src/index.ts` |
| `adapters/youtube-watch.ts` | `createYouTubeReadyReader({pool,view,ttlSeconds,cache?})`, `createYouTubeTotalReader({pool,view})`, `mountYouTubeWatch(routes,{read,total,publisher})` |
| `adapters/youtube-counter.ts` | `createYouTubeViewCounter(tables)`; actual generic receipt counter with canonical `ViewPlayed` qualifier/identity; emitted with Watch + counter selections |
| `adapters/youtube-projection.ts` | `createYouTubeSearchProjection({client,binding})`; actual generic projection of strict committed `VideoPublished`; emitted with a selected projection + YouTube adapter |
| `adapters/youtube-search.ts` | `createYouTubeSearch({client,binding})`, `mountYouTubeSearch(routes,search)`; actual generic bounded query plus browser hits/media URL mapping |

The YouTube boundary maps generic `assetId` to wire/browser `videoId`; generic lifecycle,
transport, cache, counter and query algorithms are reused. Creator access requires the verified
principal's `realm_access.roles` to contain `creator`; channel is trimmed preferred username or
subject, bounded to 200. Input accepts only the existing file fingerprint/title/description, with
5 MiB parts/256 MiB maximum/MP4 policy retained by the underlying transport and product validator.
Neither owner subject nor object/provider identity is client-selectable or exposed in responses.

Original keys must equal `originals/<video UUID>/<upload UUID>/source.mp4`; completion checks
both IDs against its authoritative upload. Result codec delegates to `bindVideoResult` with
`videos/<video UUID>/<job UUID>/<attempt UUID>/`. The shared public record now validates the
same exact paired `master.m3u8` and `thumbnail.jpg` paths, including valid nested UUIDs; private,
extra and pending fields are rejected. Publication construction uses the committed-ready
lifecycle hook/result, never a provider result delivered directly to Search/Watch. Stable IDs
retain v1's **`youtube-v1` hash namespace**, independent of new deployment/realm/bucket names.
Publication ID is `logicalEventId(videoId,"publication","1")`; processing IDs use canonical
job/attempt plus unchanged message type. UUID input/envelope/transport/document/aggregate IDs
are normalized consistently before generic case-sensitive text keys. Object keys remain exact,
canonical namespace strings rather than case-folding arbitrary storage keys.

All public metadata validators are the actual shared YV2-14 record/document schema, strengthened
in place; Watch does not duplicate it. Search mapping/query bytes and fixed OR/full-word semantics
are unchanged. Public projection strips only the validated event envelope fields, then parses
the exact public document. Search and counter each decode raw wire once and revalidate their
separate normalized envelope through the existing generic factory. YV2-09 lifecycle deliberately
continues its existing pure repeated validation of **raw** wire (not normalized input); its
API, receipt/deadline/transition/outbox algorithms are unchanged.

Two small dependency seams were separated without changing their algorithms:

- `assetEventId` moved verbatim to `src/runtime/event-identity.ts`, retaining its lifecycle
  reexport. Public wire codecs can use the mechanism without importing lifecycle persistence.
- `createTotalReader` moved to `src/runtime/counter-read.ts`, retaining its event-counter
  reexport. Watch can read public totals without loading receipt/writer modules. These shared
  dependencies, public schema contract and result codec emit when their actual consumers need
  them; they create no unselected process or credential. `publicVideoQueryPreset` now has an
  explicit `SearchQueryPreset` annotation: the previous `satisfies` inference failed when first
  passed to the actual query constructor. Its runtime query/sort object is unchanged.

Public SQL has exactly `video_id,title,description,channel,duration_seconds,manifest,thumbnail,
published_at,publication_version`, from committed `state='ready'`. It contains no private owner,
fingerprint, upload/provider, failure/job fields or totals. In a foundation recipe use
`youtubeReadySelect` in the foundation's **sole** `views` contribution and create/revoke its
public schema through a migration; `youtubeReadyView` is the standalone SQL helper (do not also
ask the foundation to CREATE that same view). YV2-16 owns actual bound resources/logins/grants.

Internal mounts preserve the browser API (the `/api/{upload,watch,search}` edge prefixes remain
YV2-16 routing work): Upload `GET /me`, `POST /uploads` 201, `GET /uploads`,
`GET /uploads/:uploadId`, `POST /uploads/:uploadId/parts/:partNumber`,
`POST /uploads/:uploadId/complete` 202 and `POST /uploads/:uploadId/abort`. Start/list/status
map asset ID to video ID; status/list enrich from the actual lifecycle, preserving top-level
metadata, phase/file/parts, queued/deadline/job/attempt and safe failure fields. Watch
`GET /videos/:videoId` returns ready metadata, `/media/<key>` URLs and a **fresh string** total;
`POST /videos/:videoId/views` accepts only `{eventId:UUID}`, rejects not-ready with 404 and
awaits the supplied confirmed publisher before 202 `{eventId,accepted:true,acceptedAt,
publicationVersion:1}`. Search `GET /videos` returns `{q,page,pageSize:20,total,hits}` with
exact browser hit fields and thumbnail URL. Typed injected clients must implement real confirms;
these route adapters do not open/own transports themselves.

Ready cache keys retain `ready-video:v1:<canonical ID>`. Pass the emitted cache binding's
`ttlSeconds` explicitly; no adapter default. The reader uses actual positive-cache single-flight,
positive eligibility/codec and public-view loader. Null/private/pending records and totals are
never cached; counts use their separate public-view pool on every details request.

YV2-16 still owns complete source-bound feature/preset/services, SQL/grants/settings/client
bindings, actual readiness, finite edge routes/static/media, pinned FFmpeg/ffprobe verification
before readiness, and transport/client/pool/signal/drain ownership. No services or final field
app are supplied by this unit. [Focused/standalone/HTTP evidence and limits](../evidence/youtube-v2/yv2-15-adapters.md);
[separate backend adapter LOC](../evidence/youtube-v2/yv2-15-adapter-loc.json).

## YV2-16 — video attachment and complete YouTube local recipe

`@jeeves/spec.buildGenerationPresetCommand(design,{preset:"video"|"youtube",prefix?})`
returns one explicit operation batch. It materializes graph, C3 modules, exact generation refs,
owners, roles, grants and dependencies; callers apply the entire batch as one history change.
The compiled `generation-preset-source.json` is a captured creation seed, independent of v1 at
runtime. Creation explicitly selects supported local HTTP/private-network intent. Existing source
is never normalized on read/render; its unsupported HTTPS/service-identity declarations remain
preserved and diagnosed. A prefix remaps canonical refs, never labels. Existing unrelated graph,
settings, scope and ownership are retained; collisions/existing presets refuse for explicit review.

The **video** attachment adds nine tiles/four roles and only owned-multipart, asset-lifecycle and
video-hls selections. It omits the publication module/channel, ready cache, search and counts.
It supplies reusable dependency libraries and bound resource constructors, **not a complete base
application**: metadata/result/wire/response codecs, verified principal, product routes/namespaces,
SQL contributions and service hooks remain required custom work. No stub service starts, no SQL
login is invented, and its report stays application-incomplete. YV2-20 owns alternate-product proof.

`loadLocalV2Registry()` now includes `local.video-composition`; the source-bound **youtube-core**
recipe requires one explicit connected selection per responsibility and seven distinct hosts.
It checks upload/lifecycle refs, shared Video authority/store, actual original/job/result/publication
resources, Watch ready/count/event refs and Search index refs. Names/prefixes select no work.
`loadLocalV2Dependencies(features?)` is the explicit library/custom-recipe host, without the
YouTube recipe or complete-template claims; predecessor focused tests retain their original
assertions against that host. Both functions and `youtubeComposition`/`videoRelations` are exported.

Generated composition paths:

- `src/features/application-bindings.ts`: normalized exact selected IDs, resources and authoritative
  inputs; base output excludes count/public-read relation defaults.
- `src/features/local-bindings.ts`: foundation-owned exact contributed SQL logins, with no secrets.
- `src/features/service-resources.ts`: `selected(kind,id?)`, `input`, `resource`, `httpSettings` and
  only selected-resource `pool`, `publisher`, `consumer`, `objects` constructors. Custom recipes
  can use these without importing YouTube policy; pools require explicit contributed logins.
- `src/runtime/process.ts`: `runProcess`, `ProcessScope`, `periodic`; owns startup readiness,
  SIGINT/SIGTERM/fatal shutdown and reverse dependency drain. Register clients/pools before users.
- `src/features/video-runtime.ts`: `verifyVideoRuntime()` verifies actual **ffmpeg and ffprobe**
  version 5.1.9-0+deb12u1 before opening media consumers/advertising process readiness.
- `src/services/youtube.ts`: actual Upload/Watch/Search HTTP and lifecycle/media/counter/indexer
  constructors; explicit process argument selects one of the seven responsibilities.
- `infra/edge/nginx.conf`, `public/index.html`: finite three API prefixes, static browser slot and
  public-output media proxy only. Internal exposure removes that API's external route. The static
  notice is an explicit browser hook; existing browser reuse remains YV2-22.

Foundation composes each migration/view/grant/service once. Upload and lifecycle share explicit
private asset tables/receipt/outbox permissions; Watch gets only the nine-column ready view and
separate public totals view. Media/indexer have no SQL login or mount. S3 bindings are contributed
once by existing transport/worker emitters; no second storage binding exists. Setup owners/admin
remain setup-only. `youtubeReadySelect` is the foundation's sole ready view definition.

Actual settings consumption: HTTP deadline/admission through `httpSettings` → `createHttpService`;
SQL pool size/statement timeout through `pool` → `createPostgres`; primary routing uses the explicit
primary endpoint; worker concurrency/retry through `consumer` → existing `createConsumer`; cache
TTL through `createYouTubeReadyReader` (the tile/mirror remains its sole authority); query request
deadline through `createSearch`. Fixed batches/linger/outbox/provider/execution/language/replica/
transfer/media policies correspond to existing finite constructors and foundation topology, not
ignored alternative choices. Exposure affects actual loopback routing. No new settings/provider/pin.

The Docker `media` stage retains the exact v1 Node base, Debian snapshot, FFmpeg package hash and
complete `ffmpeg-os.lock`; generated builds read only captured v2 assets. One media service/prefetch1.
The optional trusted `V2LocalContribution.identityRoles[{element,roles}]` names an actual selected
identity and one bounded application role vocabulary. The foundation invents no product role; only
the YouTube recipe contributes creator. Base creation uses generic system/principal labels.

Application readiness is written only after actual initialization. HTTP admission stops before
client/pool close; workers drain consumers, relay/publishers, then caller pools/clients. Compose
allows the existing bounded media deadline to drain (21m; other application processes 6m).
First-run waits for application health and refuses required report gaps. Storage-generated keys
are excluded from placeholder creation/initial credential hashes, then their real hashes join
strict restart validation after bootstrap/owner revocation; restart never rotates credentials.

Installed template consumer claims name actual bound constructor output as well as binding inputs;
complete YouTube preset claims name its runnable entrypoint. Library dependency hooks are resolved
by an explicit validated recipe using `V2Emitter.render().resolves[{emitter,id}]`; nonexistent hook
resolution refuses. Partial source still has required hooks and no application readiness. Runtime
verification remains `none` in the deterministic report: observed smoke evidence is recorded
separately, not promoted into strict TinyURL certification. [Evidence/limits](../evidence/youtube-v2/yv2-16-composition.md).

## YV2-17 — Installed feature authoring through mouse and chat

- `@jeeves/spec` exports `supportedAuthoringCommandSchema`, `SupportedAuthoringCommand`,
  `buildSupportedAuthoringCommand(design, command, installed)`, `supportedGenerationPresets`,
  `normalGenerationControls` and `normalSettingFields`. Normal settings require the resolver's
  installed consumer/output responsibility and `userNeed`; only the first source path is editable.
  Cache TTL and adjustable worker concurrency mirrors update in the same `setStudio` batch.
- `attachGenerationPreset` accepts `preset: video | youtube` and optional explicit prefix, checks
  actual installed support and delegates to YV2-16's atomic graph/module/ownership/generation
  command. The system General inspector previews the addition and any schema2 upgrade before
  attachment. It chooses a free prefix without exposing internal identities. Chat's existing
  `applyStudioCommands` accepts the same command and normal setting changes.
- `GET /generation-support` (web proxy `/api/generation-support`) returns `GenerationInstalledSupport`
  with `Cache-Control: no-store`, from cached actual `loadLocalV2Registry()`. It is neither an
  independent hard-coded registry nor the dependency-only test host. Failed support lookup exposes
  no template settings. Inspector drafts, component drafts and connection-label drafts share the
  normal command builder; arbitrary kind/module/link policy authoring is unavailable there.
- Normal useful fields reuse existing HTTP timeout/admission, adjustable worker concurrency,
  cache TTL and traced SQL pool/statement timeout fields. Fixed Docker/TypeScript/providers,
  fixed media concurrency, retry/outbox/cache policy, languages/tus/cloud alternatives, internal
  IDs/versions/schemas/mappings/grants have no normal controls. Broader historical source schemas
  and low-level commands remain available for explicit source import/diagnostics. Reading and
  renaming retains old source. New local link defaults explicitly use HTTP/Private network where
  applicable; historical HTTPS/service-identity intent is retained and diagnosed by the resolver.
- Changed TTL is emitted in `src/features/application-bindings.ts`; the actual Watch constructor
  in `src/services/youtube.ts` passes `input(s, "cache.ttlSeconds")` to `createYouTubeReadyReader`.
  No template algorithm/provider changed. Base video still requires typed product/service hooks;
  normal attachment and successful build grant no strict readiness/runtime evidence. YV2-18 owns
  remaining ownership/operation/presentation clutter; YV2-19 owns v2 saved-source preview/ZIP.
- [Evidence and snapshots](../evidence/youtube-v2/yv2-17-authoring.md). Historical source/wire,
  foundation contracts/history and evaluator validation remain covered; unsupported settings are
  seeded explicitly as historical source rather than through normal chat configuration.

## YV2-18 — Canonical process presentation and read-only diagnostics

Normal `Workspace`/`LaneCanvas` render the existing canonical lane graph directly. Ownership
projection is no longer the authoring view; no logical source/ownership, routing or layout rule
changed. Tile faces retain icons/names without role/operation/deployable subtitles. The inspector
starts with name/kind and installed useful fields, followed by focus; module findings remain
visible after fields. Normal forms omit legacy writer edits and manual ownership/operation/
requirements declarations. Existing source schemas/commands/validators/history remain intact.

`ExportDiagram.onDiagnostics` opens `SourceDiagnostics` with exact source JSON download,
read-only `OwnershipSummary`/`OperationsSummary`, scope/full source and unchanged strict
`ReadinessReport`. `onTarget(ReadinessTarget)` closes diagnostics and selects the exact canonical
tile/edge or owner/operation chat reference. No server API, generation contract, template or output
changed. This path supplies no editable Advanced menu. Generation preview/ZIP remains YV2-19.
[Source-linked normal/native snapshots and checks](../evidence/youtube-v2/yv2-18-clarity.md).

## YV2-19 — selected saved-source preview and deterministic ZIP

`POST /projects/:id/experimental-generation/{preview,download}` keeps the strict body
`{profileId,baseRevision,sourceSha256}` (download also `archiveSha256`). Explicit
`selected-source-v2` resolves the actual saved design against
`executingGenerationRegistry().installed`, refuses incomplete semantic support, then calls
`assembleV2({designJson:canonicalJson(savedDesign)}, registry)`. The same cached default registry
supplies `GET /generation-support` and authoring. Names never dispatch code. Explicit
`youtube-local-v1` retains its exact whole-source check and unchanged assembler/payload bytes.
No fallback occurs between modes. Both share the existing bounded deterministic `scaffoldArchive`,
post-assembly source reread, archive conflict and response provenance headers.

V2 preview returns `mode:selected-source-v2`, complete/partial experimental status, selected source,
exact generator/runtime/preset/template refs, input/registry identities, archive metadata and full
actual support report. Legacy adds `mode:legacy-exact-v1` without changing its old fields.
`GenerateProject` chooses v2 only from explicit source generation; separate
`V2GenerationDetails`/`LegacyGenerationDetails` render consumers, required hooks and strict/runtime
limitations. Invalid/dirty drafts, history flight, saved/source conflicts, project-switch cancellation
and browser archive hash checks remain. Source diagnostics/native diagram exports remain separate.

ZIP v2 output is the existing 93-file selected backend, including canonical saved source in
`.jeeves/inputs/design.json`, normalized model/report/manifest, actual services/features/runtime,
SQL/resource/setup/edge and standalone locks. No fake PNG or source substitution is added.
Base video remains application-incomplete with typed product/service hooks and no unfinished
application services. Complete backend assembly grants no browser completion, strict TinyURL
readiness or runtime evidence; deterministic reports keep `runtimeVerification:none`.

The studio Dockerfile explicitly retains trusted generator package/src/templates and production
workspace dependency links, approved frozen v1 inputs/PNG, and runtime-readable root manifests/lock
(the lock is fingerprinted by v2). No field app/runtime/media/secrets enter the image. Bounded normal
production startup and real API dispatch reproduce both actual v2 and exact v1 ZIPs; no generated
provider runtime/fault matrix was repeated. [Evidence and limits](../evidence/youtube-v2/yv2-19-generation.md).

## YV2-20 — product attachment consumer and frozen field input

`jeeves-generator/examples/product-attachment/recipe.ts.createProductAttachmentExample()` is an
explicit trusted `V2Emitter`, passed to **default** `loadLocalV2Registry([example])`. Its exporter
uses the same `buildGenerationPresetCommand(...,{preset:"video",prefix:"fitting"})` and canonical
assembler/exporter. No saved label/ID installs code. The base pack without that contributor keeps
required hooks and no runnable app; no new source schema, preset or normal control was added.

It contributes exact `attachment_private.{transfers,attachments,delivery_receipts,job_intents}`
through existing owned-upload/lifecycle persistence helpers, two runtime logins and three process
hooks. Generated extension paths are `src/examples/{product-bindings,product,attachment-service}.ts`.
The adapter owns only productId/caption codecs, completion/job/result envelopes and attachment/
rendition namespaces. Shared generic/video runtime modules are emitted unchanged. Internal
`prove` consumes the retained fixture through signed multipart and existing transaction/outbox/
media/result/receipt hooks; `inspect <asset-id>` only checks the ready association/actual HLS.
The proof principal is operator-supplied; no authentication, public HTTP API, catalog or browser
is implemented. Media has only S3/broker credentials, no SQL login. Search/count/YouTube source,
resources/processes/credentials are absent. The fixed dependency envelope retains its existing pins.

Necessary packaging correction: foundation emits `scripts/search-init.mjs` only for a selected
search mapping. Full YouTube output retains it. Necessary example-only correction: Garage website
inspection uses node:http so its explicit virtual-host header reaches the provider; Node fetch
ignored that Host override. Retained ready media was re-read, with no second encode/provider loop.
Example target's `"media" as const` preserves the typed contribution; root TypeScript now includes
`examples/`. Neither correction changes a generic mechanism or YouTube wire contract.

`source-loc-v2` scope accepts optional `configurationPaths`, using the existing
configuration-or-build exclusion in both totals after UI precedence. The v2 review lists only four
pure-data binding files; mixed executable files remain backend. Parser/LCS/method version and
absent-option v1 CLI bytes remain unchanged. Root Biome excludes v2 app and archived input/diagram
JSON; existing explicit workspace/test roots already omit field apps.

Frozen canonical input, exact93 output hashes, normalized model, actual registry source/asset
hashes, template/implementation identities and concrete YV2-21 CLI command live in
`field-projects/youtube/v2/inputs/`. The kept studio project/source/native/normal snapshots are in
`v2/diagrams/001-frozen-generation/`. No `v2/app` exists; browser reuse, independent restart and
final retained-template percentage remain YV2-22/23. Deterministic runtimeVerification:none and
strictReadiness:not-assessed remain honest. [Actual proof/checks/limits](../evidence/youtube-v2/yv2-20-reuse-and-freeze.md).
