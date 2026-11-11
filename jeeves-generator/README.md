# Experimental generator foundation

The separate v2 API now accepts explicit schema3 generation selections. See
[v2 registry and export](#v2-registry-and-export) for its standalone local foundation;
the frozen v1 API, CLI and emitted bytes below retain their original contract.

FP03a provides `@jeeves/generator`, a Node/TypeScript workspace package exporting source directly.
It assembles deterministic **in-memory file bundles** through trusted local template code.
The explicit `localV1Templates` registry installs **19 experimental local template families** and
a conservative new-directory exporter. Jeeves now offers a guarded experimental preview/ZIP
download (FP03b). FP04 retains the actual untouched [field baseline](../field-projects/youtube/v1/notes/baseline.md).
G01–G08 custom planning and implementation follow that checkpoint.

Only the frozen `youtube-local-v1@1.0.0` profile is accepted: source schema2, blueprint3,
snapshot005, source hash `7d1874a1…7979cc93`, project revision 3. This is deliberately a finite
experiment, not a general study/provider registry. Another source, profile or dependency pin
requires an explicit reviewed profile/version change; names and prose never select algorithms
or ownership. Existing strict `generationEligible`, template availability and runtime evidence
are copied without modification and receive no credit from this experimental path.

## API

`validateExperimentalInput(input)` validates and freezes the exact inputs.
`assembleExperimental(input, registry = [])` returns `{ files, manifest, report }`.
Each file has a portable relative `path` and `Uint8Array` bytes. The registry defaults empty for diagnostic callers. Pass `localV1Templates` to emit standalone
TypeScript HTTP/worker shells, clients, local resource setup, containers and exact dependency/OS
locks. This partial output is not a working YouTube application.

```ts
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  assembleExperimental, localV1Templates, type ExperimentalInput, youtubeLocalProfile,
} from "@jeeves/generator";

// Run from the Jeeves checkout; the generator itself does not read these files.
const inputDirectory = resolve("field-projects/youtube/v1/inputs");
const artifacts = Object.fromEntries(await Promise.all(
  Object.keys(youtubeLocalProfile.artifacts).map(async (name) =>
    [name, await readFile(join(inputDirectory, name), "utf8")]),
)) as ExperimentalInput["artifacts"];
const bundle = assembleExperimental({ profileId: "youtube-local-v1", artifacts }, localV1Templates);
// bundle.files contains real partial application scaffolding and provenance.
// Optional diagramPng must contain the exact snapshot005 PNG bytes.

```

The input record requires `profileId: "youtube-local-v1"` and all five exact UTF-8 artifacts:
`manifest.json`, `design.json`, `blueprint.json`, `local-bindings.json`, `runtime-pins.json`.
Validation checks the strict Jeeves schema and structural findings, fresh blueprint projection,
canonical IDs, exact definitions/settings/legacy owners, component hosts/links, connection
endpoints/protocol/security, unsupported paths and trusted whole-artifact hashes. Frozen manifest
hashes cannot authorize altered selectors or floating dependencies. Malformed input throws a
`GeneratorRefusal` with actionable `code`, `path` and message. Intentional source changes need a
new archived snapshot and reviewed profile; even reformatting frozen artifact bytes is refused.

An optional `diagramPng` is copied and hash-checked. Without bytes, the manifest records only
the snapshot reference/hash and `included: false`. With bytes, `.jeeves/inputs/diagram.png` is
included; a private copy preserves it across renderer hooks. No image is synthesized.

## Template hook and report

`ExperimentalTemplate` has a bounded known ID, exact version, actual template-source SHA256 and
synchronous pure `render({ input, targets })`. Install templates in trusted repository code;
no input-selected executable code or remote loading is supported. `local.project` can own shared
Compose/project files once with all contributing source paths; family templates receive only
their exact selector targets. Helpers can share implementation without a fragment merge DSL.
`local.project` does not implicitly mark the proposed family templates installed: the report
lists actual family registrations separately. The local registry fingerprints the actual source
and embedded assets, including standalone locks; see [templates](templates/README.md).

Each template file declares `generated-scaffold` or `generated-extension` ownership and exact
contributing design JSON pointers. Initial extension files are still generated output, not
custom implementation credit. `.jeeves/` is reserved for the generator. Duplicate paths,
case collisions, file/directory collisions, traversal, absolute paths and portable reserved names
refuse the whole assembly. Source paths must exist and belong to the selected declarations
(shared project templates can cite any exact declaration).

Every leaf in tile/component/connection settings, connection planned intent and frozen local
configuration gets a report entry with artifact, source path, value, status and explanation.
Untreated paths stay `unimplemented`; all 25 frozen overrides stay `unsupported`. A template can
supply an explicit `emitted`, `configuration-only`, `custom` or additional `unsupported` decision.
Emitted/configuration-only decisions must cite files it actually emits; they establish emitted
bytes, not observed runtime correctness. Unknown/duplicate decisions and erasing frozen overrides
refuse. Seven named business extensions, G01–G08 and unrun S01–S08 remain visible.

`.jeeves/manifest.json` records generator/profile/template identities, frozen input hashes,
source/diagram identity, full runtime pins and each payload file's hash, byte count, ownership,
template and source paths. It excludes its own hash to avoid self-reference. The report is a
hashed payload file, so gap/unsupported decisions are covered. There are no current timestamps,
random secrets, environment-dependent paths or runtime data in assembly output. Frozen input
timestamps remain input bytes. Same inputs and pure template versions emit identical bytes;
templates must not read clocks, randomness, network, environment or mutable files at render time.
Trusted registry code is responsible for honest template-source fingerprints and version changes.

## Preserving work and remaining export work

`planFileWrites(bundle.files, existingFiles = [])` is a pure preflight returning `create` and
`unchanged`. Exact existing bytes are retained; any differing destination refuses with
`EXISTING_OUTPUT_CHANGED`. Unrelated custom files are neither removed nor returned for overwrite.
It does not merge, regenerate edited output or write to disk. `exportNewDirectory(files, path)`
creates a new private root with exclusive file creation, refuses existing destinations/ancestor
symlinks, and creates readable non-secret subdirectories for container bind mounts. It never
deletes partial output on failure. Its parent must be trusted against concurrent hostile rename;
Node cannot make that attack safe with portable filesystem APIs. Runtime secrets remain private.

`loadYoutubeLocalInput()` loads the trusted exact frozen artifacts and real source-linked PNG.
Production server packaging ships `jeeves-generator/` (including source/assets) and the five
`field-projects/youtube/v1/inputs/` files plus `diagrams/005-local-intent-aligned/diagram.png` at
their repository-relative locations with ownership readable by the non-root API user. The Jeeves
API calls the same loader/assembler API; it never writes output to the server filesystem. The outer
Docker context admits only those six field files, excluding future apps and runtime secrets.

`pnpm --filter @jeeves/generator export:new /absolute/new-directory` is a physical CLI export.
It does not create the field baseline in this checkout. Follow the emitted README to build/run.

The diagnostic renderer in the original boundary tests emits one JSON file only. It supplies no upload,
transcode, search, playback, auth, count or Docker behavior and is not in the production registry.
Heavy template certification stays deferred. Existing Jeeves checks plus network-free generator
boundary tests cover determinism, identity/setting correspondence, provenance, collisions and
preservation of edits. New network-free checks cover real-registry determinism, image/provenance, honest reports and
exclusive/symlink-refusing export. The independent build and bounded startup evidence lives in
[field FP03a evidence](../field-projects/youtube/v1/notes/evidence/fp03a/README.md). Field business
scenarios remain separate and unmeasured; no functional credit comes from placeholder handlers.

## Jeeves preview and ZIP download

The canvas **Generate project → Preview scaffold → Download project ZIP** flow dispatches explicitly:

- `profileId: selected-source-v2`: canonical saved schema3 source with explicit generation, resolved
  against the cached executing `loadLocalV2Registry()`. Supported edits reach actual generated
  consumers. Preview returns `mode: selected-source-v2`, full support/custom-hook report, exact
  input/runtime/preset/template/registry identities and archive hashes. Required hooks remain partial;
  complete selected backend assembly grants no runtime or strict TinyURL certification.
- `profileId: youtube-local-v1`: only the exact canonical frozen snapshot005 source (including
  revision 3). Preview returns `mode: legacy-exact-v1`; the original 108-file payload/provenance is
  unchanged. Selected-project identity is separate from the frozen origin.

Unknown refs, invalid bindings and unsupported settings refuse v2 export. Known uninstalled
template/preset declarations remain explicit custom gaps in a partial export; catalog presence
does not implement them. The active registry emits reusable mechanisms, not YouTube product
adapters, public-video schemas or an application recipe. Normal authoring selects templates only
through modules; the video preset stays installed for designs that attached it. [Corrected boundary and measurement](../docs/plans/reliable-foundations/youtube-v2-generic-baseline.md).
No label or project name selects code; failed source checks never substitute an old archive.

Read-only POST routes under `/projects/:id/experimental-generation/preview` and `/download`
accept `{ profileId, baseRevision, sourceSha256 }`; download additionally requires the preview's
`archiveSha256`. Bodies are strict; no output directory, artifact upload or executable selection
is accepted. Preview returns its mode-specific full report plus versions, source and
archive hashes. Both recheck the saved source after assembly; stale source/archive returns 409,
unsupported profile/source returns 422, missing project 404, malformed request 400, and
input/PNG or assembly failures inside a request return 503. Legacy templates load eagerly; v2 assets are captured when the shared executing registry first
loads. Missing trusted assets must be repaired before generation is available. All responses use `Cache-Control: no-store`.

The server wraps the unchanged assembler files in a deterministic stored ZIP (`zip-store-v1`):
stable ASCII path ordering, 1980-01-01 dates, no extras/comments, no symlink/executable entries,
maximum 256 files, 8 MiB per file and 16 MiB archive. Dotfiles are included; legacy output also retains the exact frozen diagram PNG. V2 inputs contain
the complete canonical selected source, without a fabricated diagram snapshot.
Extract into a new directory; run scripts through `bash` as the emitted README describes.
The same inputs/template versions yield the same payload and ZIP bytes. Download checks the
preview archive hash and the browser checks it again before saving. Project switch/close cancels
pending browser work; drafts/history actions and changed/stale sources require a fresh preview.

## V2 registry and export

`assembleV2({designJson}, registry)` uses `@jeeves/spec`'s `resolveGeneration` with installed
consumer contracts derived from a trusted `createV2Registry(sources, emitters)`. It accepts edited
supported selections rather than a frozen whole-document hash. `validateV2Input` preserves exact
input bytes and original declarations separately from schema-parsed semantics. Source pointers
must exist in the original JSON, including when parsing would materialize a default.

Module-level selections (component targets) resolve on the same path. A template selection
targets its lead module (a kind in the capability's `componentTargets`), and its binding comes from
its parts' links, which the module commands derive. The lead is the module source of a field it
fills itself: the Lifecycle writer's Pool size and Statement timeout feed its lifecycle's `state`
SQL inputs. Its other fields read the parts their links trace, as a tile-level selection does; a
module with a selection of its own is never another selection's part. Each template then emits
exactly what the same tile-level selection would: `module-templates.test.ts` exports v2 built from
modules and its tile-level twin (v2's seven installed selections, renamed to their leads), and
their payloads outside `.jeeves/` and `diagnostics/` match apart from the two stubs' files and the
fixed values v2 declares explicitly (replicas, read replicas, cache eviction and topology, read
routing), which only appear as application-binding inputs. A `module-stub@0.1.0` selection, which module commands derive for every module without a complete template, needs no
role and its host's settings are not audited. It must target a module; the resolver adds that
module's name, kind and slots, with each link's target, host link and read or write, to its
normalized row.

### Module stubs

`local.module-stubs` provides `module-stub@0.1.0` beside the composition (not in the
dependency-only registry). For each stub module it writes:

- `src/modules/<host>/<module>.slots.ts` (scaffold): a `Dependencies` type with one typed
  property per connected slot, named after the target tile or module, and a `slots` descriptor
  naming the tile, its host link and how it is used. Each unconnected slot is a comment line,
  such as `// outbox: not connected (Database, write, optional)`.
- `src/modules/<host>/<module>.ts` (extension): an entry point named after the module that takes
  `Dependencies` and throws `Not implemented: <name>`.
- one shared `src/modules/dependencies.ts` (scaffold): a minimal interface per tile kind and use
  (database read or read-write, queue publish or consume, object read or write, cache, search
  read or write, token verifier, HTTP target, module call).

Stubs import no template library and, with Runnable processes off, provision nothing, so a
stub-only export installs and builds. Each stub is a required `custom` gap. A connection changes only the `.slots.ts` file.
Existing preservation applies: export writes only to a new directory, and `planFileWrites`
refuses an edited `<module>.ts` with `EXISTING_OUTPUT_CHANGED`; export afresh and carry your
bodies over.

`.jeeves/report.json` gains `modules` only when the design has a module-level selection, so
tile-level reports keep their shape. Each row has the module, its name, host, kind, status
(`template`, `stub`, `custom` or `refused`), template, selection, files (those that cite its
selection, apart from the shared project and diagnostics), unconnected slots and reason. The
studio's preview response lists `modules` for every design.

### Runnable processes

The design's `generation.processes: true` (absent means off) turns on a runnable process per
application tile ([tile process contract](../docs/plans/tile-processes/contract.md) §1–2). The
resolver adds `model.processes` only when it is on: one row per Service, Uploads, Worker,
Redirect, Billing and Notifications tile, sorted by ID, including tiles with no modules, with its
shape (`http` or `worker`), exposure (public for a lane entry or a saved public exposure), HTTP
limits (a template on the tile that consumes Request timeout and Concurrency limit, else the
fixed 1000 ms and 1000), its template selections and each stub's role (loop, route or library).
Without an installed processes owner the option is a `NEEDS_TEMPLATE` finding at
`/generation/processes`, which refuses studio export; the dependency-only registry never installs
it.

`local.tile-processes` (`src/v2/tile-processes.ts`, with `src/v2/http-wiring.ts` and
`src/v2/loop-wiring.ts`), registered by `loadLocalV2Registry`, provides `processes`. For each row it writes the scaffold
`src/processes/<id>.ts` with its compiled `config` (settings, listen address, and its `templates`
and `stubs` tables) and contributes a `local.services` entry: `app-<id>` running
`node dist/processes/<id>.js`, profile `application`, `init: true`, no restart policy, no
published port, `depends_on` only on the providers its templates and stubs use, and a healthcheck
on the ready marker. An HTTP process starts `createHttpService` on `0.0.0.0:3000`, answering
`GET /healthz` (200 once ready, 503 before and while draining), its module routes, and 404
elsewhere; any process runs its loops, and a process with nothing to run holds an idle timer.
Each writes the ready marker through `runProcess` once its loops have subscribed and its HTTP
service listens; just before it, each mounted or placeholder template logs one `started` line
naming what its startup ran (`{"level":"info","event":"started","tile","module","template","wiring",
"checks"}`, for example `"checks":["sweep at start","publication relay started","subscribed
completion-events--completion-handler","sweep every 30 s"]`). It drains on SIGTERM in reverse: HTTP admission, then loops, then publishers,
clients and pools. The foundation accepts process hosts with no selection, closes
`application-services` for them, and substitutes `scripts/local.mjs`'s startup gate (exactly
once, or it refuses) so `first-run` and `start` read `report.processes.runnable` instead of
`applicationComplete`. Composition and primitives also emit `src/runtime/process.ts`, `http.ts`
and `admission.ts` when a process needs them, `amqp.ts` and `delivery.ts` for a loop stub, and
the libraries of the stores a process's stub clients use (below).

**The edge.** When a public HTTP process exists, the processes owner contributes an `edge` row per
public host and the foundation writes `app-edge`: the nginx pinned in `assets/providers.json`,
published at `127.0.0.1:${LOCAL_HTTP_PORT}:8080`, `depends_on` each public process healthy, and
healthy on its own `GET /healthz` (`{"service":"edge","application":"ready"}`).
`infra/edge/nginx.conf` routes `/api/<id>/` to `app-<id>:3000/` (resolved per request through
Docker DNS) and answers 404 JSON for anything else, so an internal process is reached only inside
the network at `http://app-<id>:3000`. The edge owns the single HTTP port: a service contributing
`http: true` beside it refuses, and so does a tile whose ID is `edge`.

**Module routes** (contract §3–4). Every route sits under `/modules/<module id>`:

- The tile's **sign-in** (v3 contract §2): an Auth guard connected to an Identity selects
  `verified-identity@0.1.0`, and the process builds one `createTileGuard` (the scaffold
  `src/runtime/tile-guard.ts`, emitted when a guard exists) on `createPrincipalVerifier`
  (`OIDC_ISSUER`, audience `<identity id>-web`, `OIDC_JWKS_URL`, RS256, a 3 s key-set timeout,
  `exp` and `sub` required). Every module route of the tile is mounted through
  `guard.routes(...)`: **Required** answers 401
  `{"error":"SIGN_IN_REQUIRED","message":"Sign in to continue."}` without a valid
  `Authorization: Bearer` token; **Optional** treats a request without the header as anonymous
  and still answers 401 for a token that fails verification (a key-set failure included).
  `/healthz` stays open. `guard.caller(request)` gives `{signedIn: true, principal}` or
  `{signedIn: false}`, verified once per request; `guard.require(request)` gives the principal or
  401. `GET /modules/<guard>/me` answers `{signedIn: true, subject, username}` (the token's
  `preferred_username`, or null) or `{signedIn: false}`. The guard declares no roles and has no
  hooks file: a product adds roles and accounts through Keycloak's admin API (as v2's account
  script did) and checks them in its own hooks.
- A **route stub** (any stub in an HTTP tile that consumes no queue) answers any method on
  `/modules/<module id>` and every path below it. Its `<module>.ts` takes
  `(dependencies, request: ModuleRequest): Promise<ModuleResponse>`; the types live in the
  scaffold `src/modules/entry.ts`. `request.caller` is the tile's sign-in caller, and always
  `{signedIn: false}` in a tile with no guard. Its `dependencies` are real clients (provisioning for stubs,
  below). Library stubs (a Worker's stubs that consume nothing) keep their files, are compiled
  and get their clients, and are called only through another module's link.
- **Multipart uploads** is mounted on its real libraries: its private schema (named from the
  selection ID) with the uploads table (`ownedUploadPersistence`) and a `jobs` outbox in
  migration `100-<selection>.sql`, granted to its host; S3 control and signing clients; the
  transaction; the jobs publisher and outbox relay; and a sweep at start and every 30 s. Its six
  operations are mounted at `/modules/<lead>/uploads…`. It needs its tile's Auth guard set to
  Required (the derivation keeps it a stub otherwise): its hooks factory gets `guard`, and
  `principal` is `return resources.guard.require(request);`, so a start with a valid token
  reaches `validate` first. When an asset lifecycle names the upload, the upload's process also
  builds that lifecycle (`createAssetLifecycle`, from the lifecycle's own hooks file and the same
  binding its worker uses) and the factory gets `lifecycle`, its upload hooks: `reserve`,
  `complete` and `closed` delegate to it, so their "Not implemented" comes from the lifecycle
  hooks they reach (`metadata`, `job.construct`, `response`).
- **Cache reader** is mounted with `createPositiveReader` on a source login (no grants) and the
  Valkey cache at `GET /modules/<lead>/:key`; null answers 404.
- **Favorites** (v3 contract §3; `local.favorites` emits `src/runtime/favorites.ts`, with
  `transaction.ts` and `durable-sql.ts` from `local.durability`) is mounted on its own table
  `<selection sql>.favorites` (`account` 1–255, `item` 1–200 of `A-Za-z0-9._:-`, `added_at`
  `clock_timestamp()`, primary key `(account, item)`, an index on `(account, added_at DESC,
  item)`), created by migration `100-<selection>.sql` on its `state` database; its tile's login
  gets SELECT, INSERT and DELETE, and nothing is published. It needs its tile's Auth guard set
  to Required (the mount refuses otherwise), and the account is the principal's subject. Under
  `/modules/<lead>/items`: `PUT /items/<itemId>` adds it, idempotently (200 `{itemId, addedAt}`,
  the same `addedAt` again); `DELETE` answers 204, also when it isn't there; `GET /items/<itemId>`
  gives 200 or 404 `NOT_FAVORITE`; `GET /items?after=<cursor>` gives `{items, next}`, newest
  first. Errors: 401 from the guard, 400 `ITEM_ID` and `CURSOR`, and on add only 404
  `NOT_ELIGIBLE` ("This item can't be added to favorites.") and 409 `FAVORITES_FULL`. One item's
  path is a wildcard route, so a 200-character ID passes Fastify's 100-character parameter
  limit. Adds of one account are serialized (an advisory lock), so its count never passes the
  bound. The bounds come from the `favorites-policy` record (item ID size, **1,000 per
  account**, **50 to a page**) into the process config; the table's checks use the same values.
  The hooks file `src/modules/<host>/<lead>.hooks.ts` exports
  `<lead>Hooks(resources: { items: pg.Pool }): FavoritesHooks` with one hook,
  `eligible(itemId): Promise<boolean>`, which throws `Not implemented: eligible for <lead name>`
  (501) until written; only adding asks it. `items` is a pool on the database its **items** Data
  access reads (that Data access's Pool size and Statement timeout), whose login may select that
  database's `published` views; with no items Data access the resources are empty. Its own pool
  runs fixed at 10 connections and 2000 ms. With processes off it emits only the runtime file
  and an unfinished `favorites-application-bindings` gap.
- **Search query** is a placeholder: `GET /modules/<lead>` answers "Not implemented" for its
  mapping and query preset, which are product data.

**Consume loops** (contract §3–5). A loop consumes a topic's `<topic>--<tile>` subscriber queue
or a work queue itself, through the shared `createConsumer` and delivery runner (manual ack,
prefetch equal to its concurrency, `x-delivery-attempt`, and `<queue>.failed` with
`x-terminal-code`). The report's `loops` rows name each queue, module and what a failure does,
and the process file's `config.loops` holds each loop's queue, `.failed`, retry limit and
concurrency.

- A **loop stub** (any stub, in any tile, connected to consume a queue) gets one loop per queue
  it consumes, one message at a time. Its `<module>.ts` takes `(dependencies, message:
  ModuleMessage): Promise<void>` (`body`, `messageId`, `headers`, `attempt` from 1, and `source`,
  the queue). Its `.slots.ts` keeps the slot's descriptor, and the consumed queue's property
  becomes a comment: it is the input, not a dependency. "Not implemented" is terminal at once
  (`NOT_IMPLEMENTED`: the message goes to `<queue>.failed` on its first delivery). Any other
  error is retried 5 times; before retry *n* the handler waits `min(250 ms × 2^(n−1), 10 s)`
  (7.75 s over the five), then the message ends in `.failed` as `RETRY_EXHAUSTED`.
- **Asset lifecycle** runs `startAssetLifecycleWorker` on the results subscriber
  (`<results>--<tile>`, which the processes owner contributes because the template didn't), with
  its publication relay when bound. Its `assets` and `receipts` tables sit in its upload
  selection's schema (one owner), beside the uploads table and the one outbox, whose destinations
  are `jobs` and `publication`; its tile gets a login and grants, and the upload tile `assets`.
- **Video HLS** runs `startMediaWorker` on its jobs work queue (concurrency 1) after
  `verifyVideoRuntime()`, with its results publisher and S3 clients; its process uses the `media`
  image (`target: media`, 21 m stop grace).
- **Event counter** runs `startCounterWorker` on its events subscriber, on its private schema's
  `receipts` and `totals` and the public view `<schema>_public.totals`.
- **Search projection** is a placeholder: a loop on its events subscriber whose every message is
  `NOT_IMPLEMENTED` until a mapping and an event codec exist.

A mounted template keeps its own limits and handling: a codec or parse hook that throws is
terminal at once, other failures retry within its limit (lifecycle 10, video 3, counter 5). A
message that ends in `.failed` after reaching a hook that isn't written goes there as
`NOT_IMPLEMENTED`, as a stub's does, rather than the template's generic `MALFORMED_MESSAGE` or
`RETRY_EXHAUSTED`; a code of the template's own (the media worker's `INVALID_MEDIA`) is kept, and
so are its retries. A failed message logs one JSON line: `not-implemented` (`tile`, `module`,
`what`, `queue`, `messageId`, `action`, such as `sent to uploaded.failed (NOT_IMPLEMENTED)`) when
it reached a hook or stub that isn't written, otherwise `loop-error` with the attempt, the error
and the next step. Lines are rate limited like the 501s. Nothing in a loop stops the process
except a lost broker connection (it drains and exits 1, with no restart). `pnpm stop` cancels
each subscription, cuts a retry wait short (the message is republished for its next attempt) and
settles the message in hand before closing; undelivered messages stay in their queue.
`src/runtime/tile-loop.ts` holds the loop and its handlers, `tile-http.ts` the 501 wrapper and
route stubs, and `tile-process.ts` `NotImplemented`, the log and the `started` line. Two loops in
one tile on one topic share its subscriber queue, so each message reaches one of them.

**Provisioning for stubs** (contract §6). With the option on, every store or channel a stub
links to is provisioned for its tile. The resolver works the facts out as it reads the design:
each loop stub's `consumes` and each stub's `stores` (`NormalizedStubStore`: the tile, its kind,
the link's access by `stubLinkUse` — read, write or read-write for a store, publish for a queue
it doesn't consume — and its saved provider, engine, queue mode and object access). MA05's
ownership is only read: a database, bucket or index whose authority is another owner gives the
stub read only (`boundary: "published-read"`). Nothing is written to ownership and nothing
derives. `stubStores` (`local-contract.ts`) merges a tile's links per store, with the widest
access, and the foundation adds them beside the templates' own resources, through the same setup
scripts:

| Store | Provisioned for each stub tile |
| --- | --- |
| Database | The database and its setup-only owner (`migrate.mjs`), and a runtime login `r_<db>__<tile>` with CONNECT and USAGE on `public`, and SELECT on its `published` views (product tables, below). A stub that writes it also has its own schema there. Read only of another owner's database: also SELECT on every view its templates contribute (for example `counter_sum_public.totals`). |
| Queue | The broker; a topic's exchange or a work queue, and `<topic>--<tile>` for a consuming tile, each with `.failed` (`broker-init.mjs`); the broker credential |
| Cache | `cache-<id>` (Valkey) and its password |
| Object storage | Garage, the bucket (a website when saved public) and the tile's key `s3-<tile>` with read, write or both (`bootstrap.mjs`) |
| Search index | `search-<id>` (OpenSearch), with no index: a module's own mapping is custom work |

Each process gets its credentials and `depends_on` its providers healthy. A store whose saved
provider isn't unspecified or self-hosted, or whose engine isn't unspecified or the local one
(PostgreSQL, Redis-compatible, OpenSearch), isn't provisioned: a required `unsupported` gap
`provider-<module>-<tile>`, so the stack isn't runnable. Identity isn't provisioned for stubs
(an Auth guard connected to it is a sign-in template, the tile's only one), and nor are CDN or
External API tiles.

**Keycloak** comes from every guard selection (and from a tile-level multipart, as in v2): each
binds its Identity, which runs as `identity-<id>` with one realm `<id>` and one public PKCE client
`<id>-web` whose redirect is the edge origin `/`, written once at setup (`setup.mjs`), with the
admin and database passwords generated into `.runtime/secrets`. Each guarded process gets
`OIDC_ISSUER` and `OIDC_JWKS_URL` and `depends_on` Keycloak healthy. One Identity per design.

**Product tables and published views** (v3 contract §1). With the option on, every module that
writes a database other than through an Event publisher's outbox gets its own SQL file,
`infra/postgres/<database id>/modules/<module id>.sql`: a writing Data access (a stub's or a
template part's), a Lifecycle writer, and any stub whose link writes the database. The resolver
lists them per process (`writers`, `NormalizedModuleWriter`): a template's module whose link fills
a database field its template writes, and a stub's link with its `stubLinkUse` access, so a store
another owner holds is read only and gives no file. The file is a `generated-extension` with a
header only: the module, its tile and database, its schema `m_<module sql>`, the logins that may
read `published`, and the database's template tables and views by qualified name. It is yours,
like a hooks file: export never overwrites it, so carry it over to a fresh export.

`infra/local.json` lists each database's writers (`databases[].modules`: module, host, schema,
file), and the foundation substitutes `migrate.mjs`'s product step exactly once, refusing an
asset whose anchor isn't there once; with the option off the asset keeps its bytes. The step is
`scripts/products.mjs`, inside the database's one setup transaction run by its setup-only owner
`o_<db>`: after the template migrations and views it creates `published` and each `m_<module>`
(no PUBLIC access), runs each writer's file in module-ID order with `SET LOCAL search_path TO
m_<module>` (so unqualified names land there), and after the template grants it grants again.
Every runtime login on the database gets USAGE on `published` and SELECT on all its views, with
default privileges for views added later; only the writer's tile login gets USAGE on its module
schema and SELECT, INSERT, UPDATE and DELETE on its tables (USAGE, SELECT and UPDATE on its
sequences), also with default privileges. No login can create objects, and a reader can't read
a writer's tables: only what it publishes. This gives the cache read's source login its read.

**The file runs at every `first-run` and `start`**, not once, so an edited file applies at the
next start (the composition hash covers the list, not the files' content, and `start` rebuilds
the setup image). Keep it re-runnable: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF
NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, `CREATE OR REPLACE VIEW`, and no `BEGIN` or
`COMMIT`. Keep one definition per view and edit it in place: `CREATE OR REPLACE VIEW` may only add
columns at the end, so an older, narrower definition left earlier in the file fails the next run.
A failing file rolls the whole database back, and setup stops naming it (`Product SQL <file>
failed: …`). Template tables stay their templates' (uploads, assets, receipts, outboxes, counter
totals): a product file never creates them, and a template never touches `m_*` or `published`.
Each writer's row in `report.modules` gains `sql` (`[{database, file, schema}]`, one per database
it writes), and a stub store's `provisioned` text says `SELECT on published` and names the
stub's own schema.

**Module clients.** The scaffold `src/runtime/module-clients.ts` holds the real clients behind
the stub interfaces in `src/modules/dependencies.ts`, keeping only the sections a design uses:
`databaseClient` (a pool on the tile's login, pool size 10 and 2 s statements, `query` and
`execute`), `queuePublisher` (publisher confirms; each message gets a fresh ID), `cacheClient`
(`get`, `set` with a TTL, `delete`; it reconnects in the background), `objectClient` (`get`,
`undefined` for a missing key, and `put`), `searchClient` (`search`, `index`, `remove`) and
`httpTarget` (another tile's process at `http://app-<id>:3000`, with no probe or `depends_on`).
Each client runs one bounded startup probe its access allows (5 s): `SELECT 1`, opening the
broker and a confirm channel, `PING`, `HeadBucket` (or, for a write-only key, opening and
aborting a multipart upload) and cluster health. Each logs one JSON line
(`{"event":"probe","tile","client","kind","check","result":"ok"}`); a failure logs the error and
fails startup, so a healthy process has reached every store it uses with its own credentials.
The process file builds one client per store before its loops subscribe and its service listens,
then each stub's `dependencies["<module>"]`, named as in its `.slots.ts`. A module link calls
the module it names (a route stub with the caller's input as its request, a library stub with
none). What isn't provisioned (another provider, an Identity, a CDN or External API, a tile with
no process, a template's part) is `unavailable(...)`: every call answers "Not implemented:
<tile> for <module> (<why>)". A stub's own "Not implemented" still answers 501 or goes to
`.failed`.

**Credentials** are generated at first run, as for templates: `setup.mjs` writes the
passwords, and `bootstrap.mjs` the Garage keys, into private `.runtime/secrets` (0700). None is
in the export or the repository. `pnpm stop` and `pnpm start` keep them and the volumes.

Each mounted lead gets `src/modules/<host>/<lead>.hooks.ts` (a `generated-extension`): one
factory over the template's generic resources whose every hook throws `NotImplemented("<hook>
for <lead name>")`. The multipart's are `validate`, `metadata`, `response`, `originalKey` and
`job`, plus `reserve`, `complete` and `closed` when no asset lifecycle names the upload
(`principal` is the sign-in's); the cache reader's `key`, `codec`,
`eligible`, `load` and `expiresAt`; the lifecycle's `metadata`, `event`, `result`, `failure`,
`job.codec`, `job.construct`, `response`, `publication.codec`/`construct` and the three
`identities`; the video's codecs (`job`, `video`, `result`, `eventId`, `event`) and the source and
results `owns`; the counter's `event`, `aggregateKey`, `eventId` and `identity`; Favorites'
`eligible`. The process wraps
the hooks so a loop's log names the hook a message reached. Its `*-application-bindings` gap
becomes a required `custom` gap naming that file; the search placeholders' gap stays
`unfinished`. The scaffold
`src/runtime/tile-process.ts` holds `NotImplemented`, the rate-limited log and the `started`
line, and `tile-http.ts` the 501 wrapper: an error that is a `NotImplemented` or whose message
starts with "Not implemented" answers 501
`{"error":"NOT_IMPLEMENTED","message":"Not implemented: …"}` and logs one JSON line
(`level`, `event: "not-implemented"`, `tile`, `module`, `what`, `route`, `action`) at most once a
second per module and hook, the next line carrying a `suppressed` count. An `HttpError` keeps its
status and anything else answers the existing 503. Fill a stub in its `<module>.ts` and a
template in its `.hooks.ts`; no scaffold changes.

With the option on, the manifest records `"processes": true` beside `runtime`, and the report
gains `processes`: `runnable` (no findings, no `unsupported` gap and a service for every
application tile; `applicationComplete` keeps its meaning) and `tiles`, each with its service,
shape, exposure, edge path, entry point, settings with their origin, routes and loops (each with
what it answers), templates (`mounted` or `placeholder`), hooks files and `stores` (each store or
channel its stubs use, the access, the modules, and what is `provisioned` for it or why it is
`unsupported`). With it off, nothing
changes: `processes-off.test.ts` pins the export of frozen v2, the v2 module design with its
values and the stub stack (`spec/src/fixtures/stub-stack.ts`) as they were before the option
existed, every payload byte and the provenance files apart from their source and emitter
inventory.

To run one, export it into a new directory, then, in it, `pnpm install --frozen-lockfile
--ignore-scripts` and `pnpm build`; allocate the project and ports as below and run
`pnpm first-run`. Each `app-*` is healthy once ready. Public processes answer at
`http://127.0.0.1:$LOCAL_HTTP_PORT/api/<id>/`, for example `/api/<id>/healthz` or
`/api/<id>/modules/<module id>`; reach an internal one from inside the network, for example
`docker compose --profile '*' exec app-<id> node -e
"fetch('http://app-<other>:3000/healthz').then(r=>r.text()).then(console.log)"`. A loop's log
lines are in `docker compose --profile '*' logs app-<id>`, and `docker compose --profile '*' exec
local-broker rabbitmqctl list_queues name messages consumers` shows each queue's consumer and
what reached `.failed`. A process's probe lines are in its log too. `pnpm stop` drains every
process (exit 0) and `pnpm start` brings them back healthy, with the `.failed` messages,
credentials and volumes kept.

`captureV2Sources(rootUrl, paths)` captures trusted repository files before assembly. The registry
hashes actual source/asset bytes and each emitter's complete source closure. Each emitter declares
its exact version, dependencies and optional runtime/preset/template consumer responsibilities.
Semantic descriptor `sha256` values remain separate from executable `sourceSha256` values.
Render receives only a frozen normalized model, setting decisions and copied pinned assets;
an emitter can read only assets in its own fingerprinted closure. Trusted renderers must not read
mutable files, clocks, randomness, network or environment. They must emit no feature files for
unselected responsibilities. Input declarations cannot supply executable selectors.

Each file has one writer, ownership class and original design pointers. Shared-file owners compose
their complete output once and explicitly name any contributing emitters/source pointers. Duplicate,
case-colliding, unsafe or reserved `.jeeves/` paths refuse; there is no implicit append/overwrite or
generic fragment language. Every selected installed consumer's advertised output must actually be
emitted and owned by that emitter or explicitly composed on its behalf. Missing outputs refuse.

The bundle includes `.jeeves/inputs/design.json`, `.jeeves/normalized.json`,
`.jeeves/report.json` and `.jeeves/manifest.json`. The manifest identifies exact input, canonical
source, normalized semantic input, actual registry sources, runtime/preset/template/dependency refs
and payload hashes/owners/contributors. It excludes its own hash. The report distinguishes installed
mechanisms, fixed policies, custom hooks, unsupported choices and unfinished work. Semantic support
does not imply emitted build/runtime evidence or strict TinyURL readiness; required hook gaps keep
`applicationComplete` false. Partial and diagnostic emitters cannot install complete support.

`loadLocalV2Registry()` installs the **local runtime foundation**, with exact standalone
package/lock/build files, selected pinned providers and private setup/restart/access wiring.
Feature/preset implementations remain unfinished; no handlers or domain tables are started, and
no process runs unless [Runnable processes](#runnable-processes) is on. `diagnostics/generation.json` and required report gaps retain that distinction.
No v2 studio preview or browser controls are wired yet.

Selected owned uploads also emit the actual generic signed multipart engine, S3 adapter and
explicit HTTP handler factory. `local.multipart` contributes only selected storage read/write
access and signed-PUT CORS; application principal/content/metadata/transaction hooks, namespaces
and service mounts remain required compiled-recipe gaps. No complete multipart application or
lifecycle application is installed yet. See the [transport API and limits](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-08--owned-signed-multipart-transport-and-http-mounts).

Selected asset lifecycle also emits the fixed generic lifecycle repository, upload completion/
terminal hooks and worker factory. It reuses transaction/outbox/receipts, enforces fixed DB
queue/processing deadlines and supports optional transaction-bound publication. Metadata/result/
event codecs, public view and actual service wiring remain compiled-recipe gaps. See the
[lifecycle API and limits](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-09--fixed-asset-lifecycle-and-committed-publication-hooks).

Selected video processing emits a fixed reusable CPU HLS engine, strict result/marker codecs and
shared asset/job identities, without importing lifecycle SQL or product metadata. It retains the
MP4/H.264/AAC landscape bounds,360p/720p ladder, full-size thumbnail and byte-hashed inventory.
Object download/reuse/upload ordering, pinned FFmpeg runtime and actual worker/service recipe
remain required gaps; no source-bound video template is installed from engine files alone. See
the [engine API and cleanup contract](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-10--fixed-reusable-video-to-hls-engine).

Selected search projection/query emits public-document validation, explicit versioned mapping
assertion, repeat-safe event upsert, a bounded query factory and a draining consumer factory.
The public-video record/mapping and title/description/channel query preset are separate feature
assets. Compiled recipes still supply committed event codecs, mappings, service construction
and HTTP response mapping; no private SQL login or complete application is installed. See the
[search interfaces and limits](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-14--public-search-projection-and-bounded-query).

Trusted feature registration can pass `V2Emitter[]` to `loadLocalV2Registry(features)`.
`V2Emitter.local(context)` returns the finite `V2LocalContribution` hooks for migrations,
runtime logins, schema-qualified views/relation grants, topic subscribers, storage access/CORS,
versioned search mappings and runnable services. The foundation owns each shared file once and
records only its actual contributors; static utility assets do not credit unrelated features.
See the [actual interface record](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-04--standalone-local-foundation).

Exports use Node 24.21.0/pnpm 12.16.1 and the captured exact v1 dependency/provider pins.
Rendering never reads mutable v1 files. Install with `pnpm install --frozen-lockfile --ignore-scripts`
and build with `pnpm build` in the export. Allocate `COMPOSE_PROJECT_NAME`, `LOCAL_HTTP_PORT`,
`LOCAL_IDENTITY_PORT`, `LOCAL_OBJECT_PORT` together; all three ports must be distinct, free,
loopback ports outside the owner/v1 reservations. Run `pnpm first-run` once, `pnpm stop` for
all profiles and `pnpm start` to retain the exact project, private `.runtime` credentials and
recorded Docker volume identities. Changed/missing identities refuse. Interrupted storage
bootstrap requires manual inspection. Migration hash changes refuse without resetting data.
Owners are setup-only; runtime users require explicit relation grants and published readers
can receive only contributed views. Provider startup is not application readiness.

```
pnpm --filter @jeeves/generator export:v2 /path/to/schema3-design.json /absolute/new-directory
```

The CLI exports this honest partial bundle using the existing `exportNewDirectory`; it refuses
every existing destination, including an empty or edited one, and symlink ancestors. It prints
completeness/findings without claiming the export runs. `planFileWrites` remains available for
pure edit/custom-file preservation checks. V1 continues using `export:new` unchanged.
